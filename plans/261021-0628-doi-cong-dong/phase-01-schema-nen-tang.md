---
phase: 1
title: "Schema, mùa, id tướng/CP, nền tảng validate"
status: completed
priority: P1
effort: "0.75d"
dependencies: []
---

# Phase 1 — Schema, mùa, id tướng/CP, nền tảng validate

<!-- Updated: Red Team 2026-10-21 - bỏ allow-list (#8), regex page key không ép uuid (#5), paginateByKey riêng (#15), rollback + restore trigger (#10), ID_RE chuyển sang validate.ts -->
<!-- Updated: Astra audit 2026-10-21 - cột deleting_at (A#2, A#3), batch fake D1 đồng bộ + meta.changes cho returning (A#8) -->

## Mục tiêu
Có bảng mùa, đội, ảnh, vote với bộ đếm và thứ hạng do DB tự giữ đúng; có validator và phân trang keyset dùng cho phase 2–4.

## Bằng chứng
- Migration hiện có: `community-worker/migrations/0002_community.sql` (comments, uploads `kind check in ('report','post')`, battle_reports), `0006_user_admin.sql:44-58` (trigger chặn user bị khoá). Không migration nào từng rebuild bảng.
- Fake D1 chạy mọi `migrations/*.sql` trên `node:sqlite` 3.53.4 (`community-worker/test/fakes.ts:50-54`); id trong harness dạng `id-0001` (`fakes.ts:254`).
- Generated column STORED + `log10` + trigger chạy với `ON DELETE CASCADE` đã thử cục bộ: [research-d1-ranking](./reports/research-d1-ranking.md) §Q2.
- `PAGE_KEY_RE` `community-worker/src/validate.ts:5`; `paginate` `src/http.ts:65-73` (6 caller: `routes/audit.ts:60`, `routes/comments.ts:66,147`, `routes/feedback.ts:176`, `routes/reports.ts:85`, `routes/scan.ts:248`) — **không đổi**.
- Kiểm định dạng id hiện có: `ID_RE`/`parseId` `community-worker/src/routes/scan.ts:24-28,48-53`.
- `troopApt` keys trong `data/heroes-dict.json`: `cung, khiGioi, ky, thuan, thuong`.

## File
- Tạo: `community-worker/migrations/0008_community_teams.sql` (số 0007 đã dùng cho `rollback/0007_drop_user_block_triggers.sql`; bỏ qua để tránh trùng tên).
- Tạo: `community-worker/rollback/0009_drop_community_team_triggers.sql`, `community-worker/rollback/0010_restore_community_team_triggers.sql`
- Tạo: `community-worker/src/teams-validate.ts`
- Tạo: `community-worker/test/teams-schema.test.ts`, `community-worker/test/teams-validate.test.ts`
- Sửa: `community-worker/src/validate.ts` (`PAGE_KEY_RE`, `communityTeamIdFromPage`, nhận `ID_RE`/`parseId` từ `scan.ts`)
- Sửa: `community-worker/src/routes/scan.ts` (import `ID_RE`/`parseId` từ `validate.ts`, không đổi hành vi)
- Sửa: `community-worker/src/http.ts` (thêm `paginateByKey`)
- Sửa: `community-worker/test/fakes.ts` (batch chạy đồng bộ, không nhường lượt giữa các câu; `meta.changes` đúng cho câu có `returning`)
- Tạo: `community-worker/test/fakes.test.ts` (hợp đồng của harness)

## Thiết kế

### Migration `0008_community_teams.sql`
```sql
-- Mùa của kho Đội cộng đồng. Đúng một dòng closed_at is null = mùa đang mở.
create table community_seasons (
  id text not null primary key check (id glob '[a-z0-9]*' and length(id) between 1 and 40),
  label_vi text not null,
  label_zh text not null,
  opened_at integer not null,
  closed_at integer
);
create unique index community_seasons_one_open_uidx on community_seasons ((closed_at is null)) where closed_at is null;

create table community_teams (
  id text not null primary key,
  author_id text not null references "user" ("id") on delete cascade,
  season_id text not null references community_seasons ("id"),
  status text not null check (status in ('pending', 'approved', 'rejected')),
  title text not null,
  hero_1 text not null, hero_2 text not null, hero_3 text not null,
  hero_key text not null,              -- 3 id tướng đã sắp xếp, nối bằng ','
  tactics text not null,               -- JSON [[t,t],[t,t],[t,t]] theo thứ tự tướng
  troop text not null check (troop in ('cung', 'khiGioi', 'ky', 'thuan', 'thuong')),
  playstyle text not null,
  strengths text, weaknesses text, counters text, countered_by text, substitutes text,
  text_lang text not null check (text_lang in ('vi', 'zh')),
  reject_reason text,
  reviewed_by text,                    -- không FK, giống battle_reports
  reviewed_at integer,
  deleting_at integer,                 -- khác null = đã chốt xoá (đang dọn R2); ẩn khỏi mọi đọc/ghi công khai
  created_at integer not null,
  up_votes integer not null default 0,
  down_votes integer not null default 0,
  evidence_count integer not null default 0,
  points integer generated always as (up_votes - down_votes + 2 * evidence_count) stored,
  hot_rank integer generated always as (
    cast(round((case when points > 0 then 1 when points < 0 then -1 else 0 end)
      * log(max(abs(points), 1)) * 1000000 + created_at / 172.8) as integer)) stored,
  top_rank integer generated always as (points * 10000000000 + created_at / 1000) stored
);
create index community_teams_season_hot_idx on community_teams (season_id, status, hot_rank desc, id desc);
create index community_teams_season_top_idx on community_teams (season_id, status, top_rank desc, id desc);
create index community_teams_season_new_idx on community_teams (season_id, status, created_at desc, id desc);
create index community_teams_status_created_idx on community_teams (status, created_at desc, id desc);
create index community_teams_hero_key_idx on community_teams (hero_key, status);
create index community_teams_author_idx on community_teams (author_id, created_at desc, id desc);

-- Chủ duy nhất của khoá R2 ảnh đội sau khi gắn (dòng uploads tạm bị xoá lúc gắn).
create table community_team_images (
  team_id text not null references community_teams ("id") on delete cascade,
  position integer not null check (position between 0 and 2),
  object_key text not null unique,
  content_type text not null,
  primary key (team_id, position)
);

create table community_team_votes (
  team_id text not null references community_teams ("id") on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  value integer not null check (value in (-1, 1)),
  created_at integer not null,
  primary key (team_id, user_id)
);
create index community_team_votes_user_idx on community_team_votes (user_id);
```
Trigger (tất cả **đếm lại**, không ±1, để idempotent):
- `community_team_votes_count_{ins,upd,del}` `after insert|update|delete on community_team_votes`: `update community_teams set up_votes = (select count(*) … value = 1), down_votes = (… value = -1) where id = <new|old>.team_id`.
- `battle_reports_team_evidence_{ins,upd,del}` `after insert | after update of status, result | after delete on battle_reports when <new|old>.page_key like '/doi-cong-dong/%'`: `update community_teams set evidence_count = (select count(distinct r.user_id) from battle_reports r where r.page_key = X and r.status = 'approved' and r.result = 'win' and r.user_id <> community_teams.author_id) where id = substr(X, 16, length(X) - 16)` (`'/doi-cong-dong/'` dài 15 ký tự; bỏ `/` cuối).
- `community_teams_block_blocked_user` `before insert on community_teams`: chép nguyên khối điều kiện `0006_user_admin.sql:44-50`, đổi `NEW.user_id` → `NEW.author_id`.

Rollback:
- `0009_drop_community_team_triggers.sql`: `drop trigger if exists battle_reports_team_evidence_*` (trigger nằm trên bảng cũ `battle_reports`); để nguyên bảng mới (Worker cũ bỏ qua). Header ghi lệnh chạy tay như file 0007.
- `0010_restore_community_team_triggers.sql`: tạo lại 3 trigger evidence (chép từ 0008) **và** chạy một lần `update community_teams set evidence_count = (<cùng subquery>)` cho mọi dòng — dùng khi roll-forward sau 0009.

### `src/teams-validate.ts`
- `SEASON_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/`; `parseSeasonInput({id,labelVi,labelZh})` (nhãn 1–60 ký tự).
- `parseTeamInput(input)` → `{title (1–80), heroes:[h1,h2,h3], tactics:[[a,b]×3], troop, playstyle (10–3000), strengths…substitutes (≤2000, null nếu rỗng), lang, uploadIds (1–3, khác nhau)}`. Id tướng qua `parseId('hero', …)`, CP qua `parseId('tactic', …)` (định dạng). Lỗi: `invalid_title`, `invalid_heroes` (không đủ 3, trùng, sai định dạng), `invalid_tactics` (thiếu, trùng trong cả đội, sai định dạng), `invalid_troop`, `invalid_text`, `invalid_uploads`.
- `heroKey(heroes)` = sắp xếp + nối `,`.
- `parseVote(value)` ∈ {1, -1, 0}; `parseTeamSort` ∈ `hot|new|top` (mặc định `hot`); `parseHeroFilter` (≤3 id đúng định dạng); `parseSeasonFilter` (`all` hoặc id mùa).

### `validate.ts`, `http.ts`
- `PAGE_KEY_RE` = `/^\/(?:(doi-chuan|doi-khac|khai-hoang)\/[a-z0-9][a-z0-9-]{0,120}|doi-cong-dong\/[a-z0-9][a-z0-9-]{0,63})\/$/u` (không ép uuid; đội có tồn tại hay không do DB quyết). Thêm `communityTeamIdFromPage(page): string | null`.
- `paginateByKey<T extends {id: string}, K extends keyof T>(rows, limit, key: K)` — hàm riêng, cursor `[row[key], row.id]` với `encodeCursor/decodeCursor` có sẵn; `paginate` giữ nguyên.

### Harness fake D1 (`test/fakes.ts`)
Hiện `batch()` gọi `await s.run()` trong vòng lặp giữa `begin`/`commit` (`fakes.ts:57-68`) nên request chạy song song có thể `begin` lồng vào transaction đang mở; câu có cột trả về (`returning`) báo `changes: 0` (`fakes.ts:36,43`). Sửa:
- `FakeStatement` có hàm đồng bộ `runSync()`; `batch()` chạy toàn bộ `begin` → các `runSync()` → `commit` không có `await` ở giữa (giống D1: batch tuần tự, nguyên tử).
- Câu có cột trả về: dùng `stmt.all()` rồi lấy `changes()` của SQLite (`select changes()`) để điền `meta.changes`.

## Tests Before (đỏ trước)
- `fakes.test.ts`: hai `batch()` gọi qua `Promise.all` không ném lỗi transaction lồng và kết quả như chạy tuần tự; `delete … returning` trả đúng dòng và `meta.changes` = số dòng xoá; batch lỗi giữa chừng rollback toàn bộ.
- `teams-schema.test.ts`:
  - Chèn 2 mùa mở → lỗi unique; đóng mùa cũ rồi mở mùa mới → ok.
  - Vote insert/đổi giá trị/xoá → `up_votes/down_votes` khớp `count(*)`; xoá user → vote cascade, bộ đếm giảm.
  - Chiến báo `/doi-cong-dong/<id>/`: approve thắng của user khác → `evidence_count` 1; cùng user 2 chiến báo thắng → vẫn 1; chiến báo của tác giả → 0; reject/xoá → giảm; `result='loss'` → không tính; page_key đội chuẩn → không đụng bảng đội.
  - `points`, `hot_rank`, `top_rank` đúng công thức trên 3 dòng mẫu; `explain query plan` cho `order by hot_rank desc, id desc` dùng `community_teams_season_hot_idx`.
  - Trigger chặn: user `banned_until` tương lai chèn đội → `account_blocked`.
  - `deleting_at` mặc định null; không ảnh hưởng trigger đếm.
  - Xoá đội → ảnh và vote cascade.
  - Áp `0009` rồi `0010` → trigger hoạt động lại và `evidence_count` khớp đếm lại (chạy file rollback trên fake D1).
- `teams-validate.test.ts`: biên của từng trường (độ dài, 3 tướng trùng, CP trùng giữa hai tướng, id sai định dạng, 0/4 ảnh, troop sai); `PAGE_KEY_RE` nhận `/doi-cong-dong/id-0001/` và uuid, từ chối `/doi-cong-dong/` rỗng, ký tự hoa, thiếu `/` cuối.
- `paginateByKey` với khoá `hot_rank` (giá trị bằng nhau → phân xử bằng `id`).

## Refactor
- Chuyển `ID_RE`/`parseId` từ `scan.ts` sang `validate.ts`; `scan.test.ts` hiện có phải xanh nguyên.

## Tests After
- Toàn bộ test `community-worker` cũ xanh (migration mới không phá fake D1).

## Regression gate
`cd community-worker && npm test && npm run typecheck && npm run db:migrate:local`

## Rủi ro
- D1 production có SQLite cũ hơn 3.53.4 → kiểm ở phase 7 trước khi apply; generated column cần ≥ 3.31, `log10` BỊ CẤM trên D1 cục bộ (workerd: "not authorized to use function"): migration dùng `log()` (= log cơ số 10 của SQLite, cho phép).
- Biểu thức index `((closed_at is null))`: `db:migrate:local` trong gate chứng minh chạy trên engine D1 cục bộ.
- Id CP bị gộp sau này (`formerIds`): lưu nguyên id cũ; client giải bằng `createTacticIdResolver` (phase 5). `hero_key` chỉ chứa id tướng (không có cơ chế gộp tướng hiện nay).

## Bảo mật
- Trigger chặn user bị khoá ở mức DB cho bảng giữ khoá R2.
- Id chỉ nhận đúng định dạng slug → không mang được HTML/script vào UI.

## Todo
- [x] Sửa batch fake D1 + `fakes.test.ts` (đỏ trước, xanh sau)
- [x] Viết `teams-schema.test.ts`, `teams-validate.test.ts`, test `paginateByKey` (đỏ)
- [x] Migration `0008_community_teams.sql` + rollback `0009`, `0010`
- [x] `teams-validate.ts`, `PAGE_KEY_RE`, `communityTeamIdFromPage`, chuyển `ID_RE`/`parseId`
- [x] `paginateByKey`
- [x] Regression gate xanh
