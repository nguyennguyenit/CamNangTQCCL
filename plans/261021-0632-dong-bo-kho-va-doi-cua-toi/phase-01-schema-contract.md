---
phase: 1
title: "Chốt schema và hợp đồng dữ liệu (điểm dừng duyệt)"
status: done
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Chốt schema và hợp đồng dữ liệu

## Goal

Viết và được người dùng duyệt tài liệu hợp đồng dữ liệu `docs/roster-sync.md` (bảng D1, các kind, giới hạn theo byte, xóa, đóng dấu thời gian, gộp lần đầu, mô hình đội, payload nguồn, hash nguồn) trước khi có migration nào.

**STOP:** kết thúc phase bằng một câu hỏi duyệt schema cho người dùng. Không bắt đầu phase 2 khi chưa có câu trả lời "duyệt".

## Files to Create / Modify

- Create: `docs/roster-sync.md` (hợp đồng dữ liệu, tài liệu lâu dài)
- Read only: `community-worker/migrations/0004_recruit.sql`, `community-worker/src/routes/recruit.ts`, `js/recruit-sync.js`, `js/recruit-tracker-store.js` (`stamp`, `:68-70`), `js/roster-scan-state.js`, `js/roster-scan-map.js`, `js/team-recommend-engine.js:85-95`, `js/hero-identity.js`, `js/lookup-ids.js`, `js/analyze-state.js`, `src/lib/team-detail-pages.ts`, `js/team-detail.js`, `js/khaihoang-detail.js`, `js/roster-season-candidates.js`

## Draft to put up for approval

### Bảng D1 (migration `NNNN_roster.sql`)

Số migration lấy số kế tiếp còn trống lúc làm phase 2: `rollback/0007_drop_user_block_triggers.sql` đã dùng 0007, plan Đội cộng đồng (`plans/261021-0628-doi-cong-dong/`) giữ `0008_community_teams.sql` và `rollback/0009`, `0010`. Nếu plan đó đã merge thì dùng `0011_roster.sql`; nếu chưa, vẫn dùng `0011` để không giành số đã giữ.

```sql
create table roster_records (
  user_id text not null references "user" ("id") on delete cascade,
  kind text not null check (kind in ('box', 'owned', 'season', 'locked', 'override', 'group', 'team')),
  id text not null,
  box_id text,                       -- null chỉ với kind = 'box'
  updated_at integer not null,       -- ms, đóng dấu Lamport phía client, khoá LWW
  rev integer not null,              -- tăng dần theo user, con trỏ kéo
  deleted integer not null default 0 check (deleted in (0, 1)),
  payload text not null,             -- bản xoá chỉ giữ {id, updatedAt, deletedAt, boxId}
  primary key (user_id, kind, id),
  check ((kind = 'box') = (box_id is null))
);
create index roster_records_user_rev_idx on roster_records (user_id, rev);
create index roster_records_user_kind_live_idx on roster_records (user_id, kind, deleted);
create index roster_records_user_box_idx on roster_records (user_id, box_id);
```

<!-- Red Team: cột `deleted` để đếm bản ghi sống không cần parse JSON; index theo box để xoá con phía server — 2026-10-21 -->

Tách bảng khỏi `recruit_records` để không đổi `check (kind in ...)` của bảng đang chạy và giữ quota riêng.

### Các kind và `data`

Mọi `data` có `id`, `updatedAt` (ISO, khớp `updatedAt` ms của bản ghi như `recruit.ts:51`), `deletedAt` (`""` hoặc ISO).

| kind | id | data (ngoài id/updatedAt/deletedAt) | Trần `data` (byte UTF-8) |
|---|---|---|---|
| `box` | `main` cho hộp mặc định; còn lại `box-…` ngẫu nhiên | `name` | 1 KiB |
| `owned` | `${boxId}~${canonicalId}` | `boxId`, `item` (`hero:…`/`tactic:…`), `name` (tên Việt chuẩn), `type`, `redStars?` | 1 KiB |
| `season` | `boxId` | `boxId`, `seasonId` | 1 KiB |
| `locked` | `${boxId}~${lockedTeamKey}` | `boxId`, một phần tử `lockedTeams` (dạng `serializeRosterScanState`) | 2 KiB |
| `override` | `${boxId}~${teamId}~${heroIndex}~${slotIndex}` | `boxId`, một phần tử `tacticOverrides` | 1 KiB |
| `group` | `${boxId}~khai-hoang`, `${boxId}~ghep-team` cho nhóm mặc định; còn lại `grp-…` | `boxId`, `name`, `order` | 1 KiB |
| `team` | `team-…` | xem mô hình đội | 16 KiB |

<!-- Red Team: tách `tool` thành season/locked/override theo #21, tránh blob 4 KiB vượt trần và ghi đè lẫn nhau — 2026-10-21 -->

Hộp `main` và hai nhóm mặc định có id cố định để hai máy tạo cùng lúc không sinh bản trùng. Số đội khóa mỗi hộp tối đa 30 (giới hạn mới trong `roster-scan-state`). `lockedTeamKey` là SHA-256 hex 16 ký tự của bộ ID tướng và chiến pháp đã sắp xếp (ổn định, không phụ thuộc vị trí trong mảng). <!-- Astra H4 -->

`box_id` **bất biến** sau khi bản ghi được tạo: server từ chối cập nhật đổi `boxId` của `group/team/owned/season/locked/override` (`box_changed`), và mọi id có tiền tố hộp phải khớp `data.boxId`; cột `box_id` lấy từ chính giá trị đã kiểm. Chuyển đội giữa hộp nằm ngoài phạm vi (#23 chỉ yêu cầu chuyển giữa nhóm). <!-- Astra M1 -->

### Đối chiếu ID món kho

Kho local hiện chỉ lưu `{name, confidence}` (`js/roster-scan-state.js:209-213`, `js/roster-scan-map.js:76-105`). ID của `owned` được suy bằng đúng quy tắc của engine (`js/team-recommend-engine.js:85-95`): `canonicalId` nếu có, nếu không thì `canonicalHeroId(name)` / `createTacticIdResolver(tacticsDict)(name)`. Hai resolver này **không kiểm từ điển**: `canonicalHeroId("Tướng Không Tồn Tại")` trả `hero:tuong-khong-ton-tai`, `canonicalHeroId("曹操")` ném lỗi, resolver chiến pháp tự tạo `tactic:<slug>` (`js/lookup-ids.js:116-123`). Vì vậy sau khi suy ID phải kiểm ID có trong tập ID của `heroes-dict`/`tactics` (kể cả former tactic ID đã map); tên chuẩn lấy từ hàng từ điển. Lỗi được bắt theo từng món. Món không qua kiểm là "chỉ có trên máy này". `owned.data.name` giữ tên Việt chuẩn vì kho, `removeItem` và UI khóa theo tên. <!-- Astra M2 -->

### Mô hình đội (`data` của kind `team`)

```js
{
  id, boxId, groupId, updatedAt, deletedAt,
  name, seasonId, tierLabel, replacesTeamId,
  heroes: [                         // 1–3 phần tử, đúng thứ tự ô của nguồn
    {
      hero,                         // "hero:…" | null
      slotState,                    // "ok" | "source-empty" | "unresolved"
      rawName,                      // tên gốc khi unresolved
      heroAlternatives: [],         // "hero:…", ≤3 (nguồn "A / B")
      redStars,                     // 0–5 | null
      tactics: [                    // đúng 2 ô theo vị trí nguồn
        { primary, alternatives: [], rawName }   // primary "tactic:…" | null; "A/B" tách vào alternatives
      ],
      books: [],                    // ≤3 id "book:…"
      bookType, troopNote, statNote, gearNote,   // chữ tự do
    },
  ],
  notes: { general, strengths, goodAgainst, avoid },
  userAlternatives: [],             // món bù người dùng chọn từ Gợi ý, KHÔNG tính vào hash
  source: { kind, key, contentHash },   // kind ∈ recommended|legacy|khaihoang|analyze|roster-recommend
}
```

Ô bond (`js/recommended-reference-render.js:65-66,81-87`) bị bỏ, ghi rõ trong bộ chuyển. Đội nguồn có ô `source-empty` (đội 2 tướng) lưu được, không bị `validateTeam` chặn. `team.id` sinh một lần lúc tạo nháp và giữ nguyên qua thử lại/tải lại (kể cả bản lưu dở qua OAuth). <!-- Astra H1 -->

### Bảng ghép trường nguồn → đội <!-- Astra H6, H7, M6 -->

| Nguồn | Trường hiển thị | Trường của đội |
|---|---|---|
| Đội chuẩn | tướng, ô chiến pháp (`tacticSlotsRaw/Vi`), binh thư (`bookSlotsRaw/Vi`) | `hero`, `tactics[].primary`, `books` theo đúng vị trí ô |
| Đội chuẩn | phương án thay của tướng/chiến pháp/binh thư | `heroAlternatives`, `tactics[].alternatives`; phương án thay binh thư vào `bookType` dạng chữ |
| Đội chuẩn | `statFocusRaw` (cộng điểm) | `statNote` |
| Đội chuẩn | counters (`recommended-reference-render.js:403-407`) | `notes.goodAgainst` / `notes.avoid` |
| Đội khác | `heroes[].name` ("A / B"), `alternatives`, `tactics`, `books`; `team.notes` (cả khi là biến thể, theo `team-detail.js:151`) | như trên; `notes.general` |
| Khai hoang | build **Sau cấp 20**: `tacticsAfter`, `unitTypeAfter`, thứ tự chủ tướng theo `commanderAfter` (chủ tướng đứng đầu, như `js/render.js:367-379`) | `hero`, `tactics`, `troopNote` |
| Khai hoang | build **Trước cấp 20**: `tacticBefore`, `unitTypeBefore`, `commanderBefore`; `buildNote`, `openingNote`, `note`, ghi chú từng tướng | `notes.general` dạng chữ có nhãn "Trước cấp 20 / Chủ tướng / Ghi chú build"; không suy thêm dữ liệu Trước khi nguồn không có |
| Gợi ý | đội gốc + lựa chọn engine đang hiện (`heroAssignments`, `tacticSelections`, `roster-recommend-ui.js:659-680`) | nền là bản ghi đầy đủ (giữ binh thư, hash); **áp** tướng và chiến pháp đang hiện vào đúng ô (map ô engine → ô nguồn vì `roster-season-candidates.js:38-50` bỏ ô trống/bond); lựa chọn gốc khác với lựa chọn đang hiện vào `alternatives`/`heroAlternatives`; món bù người dùng chọn vào `userAlternatives` |
| Soi đội | `{hero, tactics[2], book}` | `hero`, `tactics[].primary`, `books[0]`; không hash, không link nguồn |

Không thuộc bản sao: chiến báo, bình luận, điểm/tier hướng dẫn chung ngoài `tierLabel`.

<!-- Red Team: mô hình khớp dữ liệu thật (đội 2 tướng, tướng chưa đối chiếu, phương án thay cấp tướng, chuỗi A/B, bond) — 2026-10-21 -->

### Giới hạn chữ tự do (tính bằng byte UTF-8)

`name` ≤ 180 B, `tierLabel` ≤ 48 B, `bookType` ≤ 120 B, mỗi `troopNote/statNote/gearNote` ≤ 360 B, mỗi trường `notes` ≤ 2 400 B. Tổng xấu nhất (chữ Hán ở mọi trường) phải ≤ 16 KiB; task 1 đo lại. UI đếm byte (`TextEncoder`), không đếm `.length`.

### Đóng dấu thời gian, kết quả từng bản ghi và gộp <!-- Astra H1, H2 -->

- Mọi ghi phía client đóng dấu `updatedAt = max(Date.now(), lớn nhất đã thấy + 1)` (Lamport, như `stamp` ở `js/recruit-tracker-store.js:68-70`).
- Dirty là **map khóa → `updatedAt` đã gửi**, không phải tập khóa. Khi nhận kết quả, chỉ bỏ khóa khỏi dirty nếu `updatedAt` hiện tại của bản ghi vẫn bằng bản đã gửi; sửa trong lúc chờ mạng vẫn còn dirty.
- Server từ chối bản ghi có `updatedAt > now + 5 phút` (mã `clock_skew`).
- POST nhận `{expectedUserId, records}`; `expectedUserId` khác user của cookie → 409 `user_mismatch`, không ghi gì. Client gặp lỗi này hoặc thấy chủ cache đổi thì dừng timer, bỏ mọi request/response của phiên cũ, khóa UI và nạp lại phiên.
- Server trả `{results: [{kind, id, outcome, code?, server?}], cursor}` với `outcome` ∈ `applied` | `already-applied` (cùng `updatedAt` và cùng payload — gửi lại sau khi mất phản hồi) | `conflict` (bản server mới hơn, hoặc cùng `updatedAt` khác payload; kèm `server` là bản đang lưu) | `rejected` (byte, schema, `clock_skew`, `box_missing`, `group_missing`, `box_changed`, `not_found`, cap). Lỗi cấu trúc thân request vẫn 400.
- Client: `applied`/`already-applied` → ACK; `conflict` → nhận bản server làm chuẩn, giữ bản thua làm nháp riêng để người dùng chọn (trình soạn) hoặc bỏ (kho); `rejected` → bỏ khỏi dirty, đưa vào danh sách bị từ chối, báo UI.

<!-- Red Team: lệch đồng hồ, một bản ghi hỏng không được kẹt cả batch — 2026-10-21 -->

### Giới hạn số lượng <!-- Astra H9 -->

- Quota 20 000 bản ghi **sống** (`deleted = 0`) mỗi user; tối đa 20 hộp, 50 nhóm mỗi hộp, 500 đội. Kiểm mỗi khi một bản ghi chuyển sang trạng thái sống (tạo mới hoặc hồi sinh), bằng câu `insert … select … where (count) < cap` trong cùng `db.batch` với lệnh ghi, không check-rồi-ghi.
- Trần **tổng số khóa giữ lại** (sống + bản xóa) 40 000 mỗi user: đạt trần thì từ chối tạo khóa mới (`retained_cap`) nhưng vẫn cho sửa/xóa khóa đã có. Không có TTL xóa bản xóa (có thể làm sống lại dữ liệu từ máy lâu không online); xóa hộp là cách giải phóng (bản ghi con bị xóa hẳn).
- Không cho tạo bản xóa cho khóa chưa từng tồn tại (`not_found`).
- Batch tối đa 500 bản ghi, trang kéo 500. Rate limit `roster_push` 600/giờ, `roster_pull` 1 200/giờ.

### Xóa <!-- Astra C1, H5 -->

- Đội, nhóm, món: xóa mềm (`deleted = 1`, payload thu gọn). Bản xóa không tính quota sống.
- **Xóa hộp** là thao tác phía server, gắn với kết quả LWW của chính hộp: câu xóa con chỉ chạy khi `exists (select 1 from roster_records where user_id = ? and kind = 'box' and id = ? and deleted = 1 and updated_at = ?)` với đúng `updatedAt` vừa gửi, tức bản xóa hộp đã thật sự được ghi trong transaction. Bản xóa hộp đến muộn (bị LWW bỏ qua) hoặc bị từ chối (`main`) không xóa gì. Kết quả chỉ đếm bản ghi gửi lên, không đếm dòng con bị dọn.
- Mọi bản ghi con (kể cả `team`) chỉ ghi được khi hộp còn sống, kiểm ngay trong câu ghi (`… where exists (select 1 … kind = 'box' and id = :boxId and deleted = 0)`); ngược lại `box_missing`. Trong cùng một request, server xử lý theo thứ tự: bản ghi `box` trước, rồi bản ghi con; vì vậy tạo hộp + bản ghi con cùng request chạy được, còn xóa hộp + ghi con cùng request thì bản con bị `box_missing`.
- **Xóa nhóm** cũng là thao tác phía server: khi bản xóa nhóm `G` được ghi (cùng điều kiện `exists … updated_at = ?` như trên), server trong cùng batch chuyển mọi `team` sống có `groupId = G` sang `${boxId}~ghep-team`, cấp `rev` mới và `updatedAt` = `updatedAt` của bản xóa nhóm, để máy khác nhận được. Ghi `team` với `groupId` không phải nhóm sống cùng hộp → `group_missing`. Nhóm mặc định không xóa được.
- `ensureBoxDefaults(boxId)` (client, idempotent) tạo `${boxId}~khai-hoang` và `${boxId}~ghep-team` cho **mọi** hộp, gửi cùng request tạo hộp.
- Hộp `main` không xóa được (server từ chối). Xóa tài khoản: `on delete cascade` theo `user`.
- Xóa hộp và xóa nhóm nằm trong phạm vi (người dùng xác nhận ở Validation Session 1). <!-- Updated: Validation Session 1 - giữ xóa hộp/nhóm -->

### Gộp kho local lần đầu (#21)

1. Chỉ chạy sau khi kéo đủ dữ liệu cloud lần đầu.
2. Hỏi người dùng "Gộp kho trên máy này vào tài khoản?" (máy dùng chung không lẫn kho). <!-- Updated: Validation Session 1 - xác nhận hỏi trước khi gộp -->
3. Đồng ý: tạo `box main`, `season main` (giữ `seasonId` local nếu cloud chưa có), hai nhóm mặc định; mỗi món local (đã suy ID và qua kiểm từ điển), mỗi đội khóa (`locked`, khóa theo `lockedTeamKey`) và mỗi món bù (`override`) chỉ tạo bản ghi khi khóa chưa tồn tại trên cloud, kể cả khi trên cloud là bản đã xóa. Không đồng bộ `scans`/ảnh. <!-- Astra H4 -->
4. Cờ "đã hỏi/đã gộp" lưu trong map theo `userId` (`tqccl.roster.merged.v1`), độc lập với meta đồng bộ. Gộp dở (mất mạng giữa chừng) chạy tiếp được vì cùng quy tắc "chỉ tạo khóa chưa có".
5. Đăng xuất xóa cache cloud trên máy (`tqccl.roster.cloud.v1`).

### Cache giữa nhiều tab <!-- Astra H3 -->

- Mọi đọc–sửa–ghi của `tqccl.roster.cloud.v1` chạy trong `navigator.locks.request("tqccl-roster", …)` (Web Locks, có trên mọi trình duyệt mục tiêu): đọc blob mới nhất, gộp bản ghi theo `updatedAt` và **hợp** dirty map của blob với của tab, rồi ghi. Không bao giờ thay nguyên state đang dirty bằng snapshot từ sự kiện `storage`; sự kiện chỉ kích hoạt gộp.
- Cursor chỉ tiến khi các bản ghi tới mốc đó đã nằm trong blob được ghi cùng lần.

### Payload lưu đội trên trang chi tiết (#23)

- Đội chuẩn và Khai hoang (bản mặc định) adopt HTML dựng sẵn mà không tải dữ liệu đội (`js/team-detail.js:119`): nhúng lúc build `<script type="application/json" id="team-save-payload">`, escape kiểu `jsonLd` (`src/lib/blog-posts.ts:387-393`).
- Khai hoang: nhúng mọi biến thể, khóa theo id biến thể; nút lưu đọc biến thể **lúc bấm** từ URL hiện tại (`?variant`), vì đổi biến thể chỉ `replaceState` (`js/khaihoang-detail.js:128-129`).
- Đội khác có `?variant` chỉ biết lúc chạy (`js/team-detail.js:126-153,175-178`): dựng đội nháp lúc bấm từ `admitted.legacyContent`, key `${legacyTeamId}~${legacyVariantId}`.

### Hash nguồn và "Bản gốc đã cập nhật"

- `contentHash` tính trên các trường nguồn thô có ý nghĩa theo bảng ghép trường ở trên: tên gốc tướng/chiến pháp/binh thư theo ô, phương án thay, cộng điểm, chủ tướng và binh chủng theo giai đoạn, ghi chú nguồn. Không tính bản dịch Việt, thứ tự khóa JSON hay mọi chỉnh sửa của người dùng. <!-- Astra M6 -->
- Khi lưu, `contentHash` được **chép** từ payload nhúng hoặc từ index, không tính lại từ đội nháp.
- Index `{ "kind:key": contentHash }` phục vụ bằng Astro endpoint (`src/pages/my-teams-source-index.json.ts`), không phải file `data/`. Chỉ `/doi-cua-toi/` tải.
- `analyze` không có hash và không có link nguồn. Đội từ Gợi ý: `team.source === "season"` → tra bản ghi đầy đủ theo `team.id` rồi coi là `recommended`; `entry.source === "legacy"` → `legacy`.
- Link nguồn trên `/doi-cua-toi/`: `source.key` được tách và kiểm thành `{family, id, variant}`; dựng bằng `teamDetailPath` cộng helper nối `?variant` (`js/team-detail-navigation.js:121-136`). Trang phải tự nhúng và khởi tạo đủ bảng đường dẫn `{r, l, k}` (layout chỉ nhúng `{l}` cho `pageKind="detail"`, `src/layouts/SiteLayout.astro:356-365`). <!-- Astra M4 -->

## Tasks & Steps

1. Đo kích thước bằng script tạm: đội xấu nhất (3 tướng, mọi trường chữ Hán tối đa, ký tự điều khiển, ghi chú Khai hoang hai giai đoạn), một `locked` lớn nhất có thể từ ảnh thật, một trang Khai hoang nhiều biến thể nhất, index nguồn với số trang hiện có. Ghi số đo vào `docs/roster-sync.md`; nếu vượt trần thì hạ giới hạn chữ, không nâng trần.
2. Viết `docs/roster-sync.md` gồm toàn bộ bản nháp trên, kèm số đo.
3. Hỏi người dùng duyệt (một câu hỏi: Duyệt / Sửa điểm …). Ghi quyết định vào `## Validation Log` của `plan.md`.

## Verification

- `docs/roster-sync.md` có đủ các mục trên và số đo.
- Có câu trả lời duyệt của người dùng trong Validation Log.
