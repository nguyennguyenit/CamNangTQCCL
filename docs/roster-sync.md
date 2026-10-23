# Hợp đồng dữ liệu: đồng bộ kho và Đội của tôi

**Trạng thái: hiện hành** (đã cài ở `community-worker/src/routes/roster.ts`, `roster-schema.ts`, `migrations/0011_roster.sql` và client `js/roster-*.js`, `js/my-teams-*.js`; chưa rollout lên production, xem [deployment-guide.md](./deployment-guide.md#đồng-bộ-kho-và-đội-của-tôi-roster_records)). Mục [Thay đổi sau duyệt](#thay-đổi-sau-duyệt) ghi các chỗ khác bản đã duyệt ở phase 1 và thắng khi hai bản lệch.

Tài liệu này là hợp đồng giữa `community-worker` (`/api/roster`, bảng D1 `roster_records`) và client (`js/roster-sync.js`, `/goi-y-doi-tu-kho/`, `/doi-cua-toi/`). Đổi bất kỳ mục nào dưới đây là đổi hợp đồng: sửa tài liệu này cùng lúc với migration, route và client.

Mẫu tham khảo là đồng bộ Theo dõi chiêu mộ (`migrations/0004_recruit.sql`, `src/routes/recruit.ts`, `js/recruit-sync.js`). Roster dùng bảng, route và client riêng; không sửa `recruit-sync`.

## Bảng D1 (`community-worker/migrations/0011_roster.sql`)

`0007`–`0010` đã có chủ (rollback trigger chặn user, plan Đội cộng đồng), nên roster dùng `0011`.

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

- Tách khỏi `recruit_records` để không đổi `check (kind in …)` của bảng đang chạy và giữ quota riêng.
- `deleted` cho phép đếm bản ghi sống không cần parse JSON; index theo `box_id` phục vụ xóa con phía server.

## Các kind và `data`

Mọi `data` có `id`, `updatedAt` (ISO, khớp `updated_at` ms của bản ghi, như `recruit.ts`), `deletedAt` (`""` hoặc ISO). Trần tính trên byte UTF-8 của `JSON.stringify(data)`.

| kind | id | data (ngoài id/updatedAt/deletedAt) | Trần `data` |
|---|---|---|---|
| `box` | `main` cho hộp mặc định; còn lại `box-…` ngẫu nhiên | `name` | 1 KiB |
| `owned` | `${boxId}~${canonicalId}` | `boxId`, `item` (`hero:…`/`tactic:…`), `name` (tên Việt chuẩn), `type`, `redStars?` | 1 KiB |
| `season` | `boxId` | `boxId`, `seasonId` | 1 KiB |
| `locked` | `${boxId}~${lockedTeamKey}` | `boxId`, một phần tử `lockedTeams` (dạng `serializeRosterScanState`) | 2 KiB |
| `override` | `${boxId}~${overrideTeamKey}~${heroIndex}~${slotIndex}` | `boxId`, `teamId`, `heroIndex`, `slotIndex`, `tactic` (một phần tử `tacticOverrides`) | 1 KiB |
| `group` | `${boxId}~khai-hoang`, `${boxId}~ghep-team` cho nhóm mặc định; còn lại `grp-…` | `boxId`, `name`, `order` | 1 KiB |
| `team` | `team-…` | xem [Mô hình đội](#mô-hình-đội) | 16 KiB |

- Hộp `main` và hai nhóm mặc định có id cố định để hai máy tạo cùng lúc không sinh bản trùng.
- Đội khóa: tối đa 30 mỗi hộp khi **thêm** (đọc ảnh/thêm tay; nạp và lưu dữ liệu đã có không cắt), **chỉ client thực thi** (server không đếm riêng `locked`, chỉ có quota chung); `data` gồm `teamName` ≤ 180 B, `heroes` ≤ 3, `tactics` ≤ 6, `teamId?`/`configId?` ≤ 128 B, `seasonContext?` `{scenarioId, rulesetId}`.
- `lockedTeamKey` = 16 ký tự hex đầu của SHA-256 trên bộ ID tướng và chiến pháp đã sắp xếp; ổn định, không phụ thuộc vị trí trong mảng.
- `overrideTeamKey` = 16 ký tự hex đầu của SHA-256 (UTF-8) của `teamId`, cùng kiểu `lockedTeamKey`. Lý do: `teamId` của override là `sourceConfigId` của đội gợi ý và 67/1 366 id thật có chữ Hán (vd. `yxms-010-周劭蜀弓`), không khớp `^[a-z0-9][a-z0-9~:-]*$` của id bản ghi. `data.teamId` giữ id thô (mọi ký tự không điều khiển, ≤ 128 B); `data.tactic` là tên chiến pháp đã lưu, ≤ 80 B. Server tính lại hash bằng Web Crypto và từ chối id không khớp (`schema`).
- Chữ trong `data` (`teamName`, `heroes`, `tactics`, `teamId`, `configId`, `seasonContext`, `tactic`...) nhận chữ Hán và tiếng Việt có dấu; chỉ id bản ghi và tham chiếu (`hero:…`, `tactic:…`, `book:…`, `boxId`, `team-…`, `grp-…`) bị ràng buộc ASCII.
- `box_id` **bất biến** sau khi bản ghi được tạo: server từ chối cập nhật đổi `boxId` của `group/team/owned/season/locked/override` (`box_changed`). Mọi id có tiền tố hộp phải khớp `data.boxId`; cột `box_id` lấy từ chính giá trị đã kiểm. Chuyển đội giữa hộp nằm ngoài phạm vi.

## Đối chiếu ID món kho

Kho local chỉ lưu `{name, confidence}` (`js/roster-scan-state.js` `addCanonicalItem`, `js/roster-scan-map.js`). ID của `owned` suy bằng đúng quy tắc của engine (`js/team-recommend-engine.js`): `canonicalId` nếu có, không thì `canonicalHeroId(name)` / `createTacticIdResolver(tacticsDict)(name)`.

Hai resolver này **không kiểm từ điển**: `canonicalHeroId("Tướng Không Tồn Tại")` trả `hero:tuong-khong-ton-tai`, `canonicalHeroId("曹操")` ném lỗi, resolver chiến pháp tự tạo `tactic:<slug>` (`js/lookup-ids.js` `createTacticIdResolver`). Vì vậy:

- Sau khi suy ID phải kiểm ID có trong tập ID của `heroes-dict`/`tactics` (kể cả former tactic ID đã map); tên chuẩn lấy từ hàng từ điển.
- Lỗi được bắt theo từng món. Món không qua kiểm là "chỉ có trên máy này" và không được đẩy.
- `owned.data.name` giữ tên Việt chuẩn vì kho, `removeItem` và UI khóa theo tên.

## Mô hình đội

`data` của kind `team`:

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
        { primary, alternatives: [], rawName }   // primary "tactic:…" | null; "A/B" tách vào alternatives (≤3)
      ],
      books: [],                    // ≤3 id "book:…"
      bookType, troopNote, statNote, gearNote,   // chữ tự do
    },
  ],
  notes: { general, strengths, goodAgainst, avoid },
  userAlternatives: [],             // ≤6 {heroIndex, slotIndex, tactic}; món bù chọn từ Gợi ý, KHÔNG tính vào hash
  source: { kind, key, contentHash },   // kind ∈ recommended|legacy|khaihoang|analyze|roster-recommend
}
```

- Issue #23 ghi `source` là `{kind, id, version}`; hợp đồng này dùng `{kind, key, contentHash}`: `key` gồm cả biến thể (`${id}~${variant}`), `contentHash` thay cho số phiên bản vì dữ liệu nguồn không có phiên bản.
- Ô bond (`js/recommended-reference-render.js`) bị bỏ, ghi rõ trong bộ chuyển.
- Đội nguồn có ô `source-empty` (đội 2 tướng) lưu được, không bị `validateTeam` chặn.
- `team.id` sinh một lần lúc tạo nháp và giữ nguyên qua thử lại/tải lại, kể cả bản lưu dở qua OAuth.
- Không tạo đội trống; không chia sẻ/công khai đội.

### Bảng ghép trường nguồn → đội

| Nguồn | Trường hiển thị | Trường của đội |
|---|---|---|
| Đội chuẩn | tướng, ô chiến pháp (`tacticSlotsRaw/Vi`), binh thư (`bookSlotsRaw/Vi`) | `hero`, `tactics[].primary`, `books` theo đúng vị trí ô |
| Đội chuẩn | phương án thay của tướng/chiến pháp/binh thư | `heroAlternatives`, `tactics[].alternatives`; phương án thay binh thư vào `bookType` dạng chữ |
| Đội chuẩn | `statFocusRaw` (cộng điểm) | `statNote` |
| Đội chuẩn | counters | `notes.goodAgainst` / `notes.avoid` |
| Đội khác | `heroes[].name` ("A / B"), `alternatives`, `tactics`, `books`; `team.notes` (cả khi là biến thể, như `js/team-detail.js` `loadLegacy`) | như trên; `notes.general` |
| Khai hoang | build **Sau cấp 20**: `tacticsAfter`, `unitTypeAfter`, thứ tự chủ tướng theo `commanderAfter` (chủ tướng đứng đầu, như `js/render.js`) | `hero`, `tactics`, `troopNote` |
| Khai hoang | build **Trước cấp 20**: `tacticBefore`, `unitTypeBefore`, `commanderBefore`; `buildNote`, `openingNote`, `note`, ghi chú từng tướng | `notes.general` dạng chữ có nhãn "Trước cấp 20 / Chủ tướng / Ghi chú build"; không suy thêm dữ liệu Trước khi nguồn không có |
| Gợi ý | đội gốc + lựa chọn engine đang hiện (`heroAssignments`, `tacticSelections`) | nền là bản ghi đầy đủ (giữ binh thư, hash); **áp** tướng và chiến pháp đang hiện vào đúng ô (map ô engine → ô nguồn vì `roster-season-candidates.js` bỏ ô trống/bond); lựa chọn gốc khác lựa chọn đang hiện vào `alternatives`/`heroAlternatives`; món bù người dùng chọn vào `userAlternatives` |
| Soi đội | `{hero, tactics[2], book}` | `hero`, `tactics[].primary`, `books[0]`; không hash, không link nguồn |

Không thuộc bản sao: chiến báo, bình luận, điểm/tier hướng dẫn chung ngoài `tierLabel`.

### Giới hạn chữ tự do

Byte của một trường chữ = byte UTF-8 của chuỗi **sau khi JSON escape**, không tính hai dấu ngoặc kép (`TextEncoder` trên `JSON.stringify(s).slice(1, -1)`). Cách đếm này làm trần 16 KiB đúng với mọi nội dung: `"` và `\` chiếm 2 B, chữ Hán 3 B. UI đếm cùng cách, không đếm `.length`.

| Trường | Trần |
|---|---|
| `name` | 180 B |
| `tierLabel` | 48 B |
| `rawName` (tướng, chiến pháp) | 80 B |
| `bookType` | 120 B |
| mỗi `troopNote` / `statNote` / `gearNote` | 360 B |
| mỗi trường `notes` | 2 000 B |
| `team.groupId` | 128 B |
| id bản ghi (`id` của mọi kind, id ghép nhiều thành phần) | 256 B |
| id đơn (`box-…`, `grp-…`, `team-…`), `boxId`, tham chiếu `hero:…`/`tactic:…`/`book:…` | 64 B |
| `seasonId`, `replacesTeamId` | 64 B |
| `source.key` | 128 B |

Ký tự điều khiển C0/C1 trừ `\n` và `\t` bị server từ chối (`schema`); client bỏ chúng khi nhập. `id` mọi kind khớp `^[a-z0-9][a-z0-9~:-]*$` và ≤ 256 B (id ghép nhiều thành phần); id đơn và tham chiếu ≤ 64 B với ký tự `[a-z0-9-]` sau tiền tố. Id hộp khớp `^(main|box-[a-z0-9][a-z0-9-]*)$`.

### Quy tắc kiểm `data` (server)

- Khóa lạ trong `data` → `schema` (không bỏ âm thầm). Payload lưu được dựng lại theo thứ tự khóa cố định nên gửi lại với khóa xáo trộn vẫn là `already-applied`.
- `locked.data`: `teamName`, `heroes` (≤ 3), `tactics` (≤ 6), `teamId?`, `configId?`, `seasonContext?`.
- `override.data`: `teamId`, `heroIndex`, `slotIndex`, `tactic`.
- `source.key` khớp `^[A-Za-z0-9][A-Za-z0-9._~-]*$`; `source.contentHash` là 16 hex hoặc rỗng.

## Số đo (2026-10-21)

Đo bằng script tạm trên `data/` và `dist/` của `main` tại `e41a30a`.

| Đo | Kết quả | Trần | Ghi chú |
|---|---|---|---|
| Đội xấu nhất, mọi trường chữ Hán tối đa | 15 781 B | 16 384 B | 3 tướng, mỗi tướng 3 phương án thay, 2 ô × 3 phương án, 3 binh thư, `rawName` tối đa, 6 món bù, `source.key` 128 B |
| Đội xấu nhất, mọi trường toàn `"` | 15 807 B | 16 384 B | nhờ đếm byte sau escape |
| Cùng đội với `notes` 2 400 B (bản nháp) | 17 389 B | 16 384 B | vượt trần → hạ `notes` xuống 2 000 B |
| `locked` lớn nhất | 1 115 B | 2 048 B | 3 tướng + 6 chiến pháp tên dài nhất (26 B / 34 B), `teamName` 180 B chữ Hán, `teamId`/`configId` 128 B |
| Trang Khai hoang lớn nhất (phase 5, `dist/`) | `khai-hoang/gia-cat-khac-thai-su-tu-ta-tu/` 88 236 B HTML, trong đó payload lưu đội 6 607 B (3 bản: mặc định + 2 biến thể); payload lớn nhất của mọi trang chi tiết cũng là trang này | — | đo bằng `tests-js/astro-dist-contract.test.mjs` trên `dist/` đã build; nguồn thô trước khi nhúng: 6 892 B |
| Index nguồn (phase 5, `dist/my-teams-source-index.json`) | 1 601 mục, 83 562 B, 24 349 B gzip | — | 1 366 Đội chuẩn + 166 Đội khác + 17 Khai hoang + 40 biến thể Đội khác + 12 biến thể Khai hoang; hash 16 hex; khóa Đội chuẩn có chữ Hán đã đổi sang `h-<16 hex>` nên ngắn hơn số đo nháp |

Đo lại trên bản build cuối (2026-10-22, `dist/`, 5 025 trang): index nguồn vẫn 1 601 mục, 83 562 B, 23 769 B `gzip -9`; trang Khai hoang lớn nhất vẫn `khai-hoang/gia-cat-khac-thai-su-tu-ta-tu/` 88 236 B HTML. Trần byte của server (`roster-schema.ts`) khớp bảng trên; `test/roster.test.ts` ca 28 kiểm đếm byte sau escape và chữ Hán đa byte.

ID dài nhất: `hero:truong-bao-khan-vang` 25 B, `tactic:giang-dong-tieu-ba-vuong` 31 B, `book:tranh-the-manh-cua-dich` 28 B.

## API `/api/roster`

Cả hai route yêu cầu phiên đăng nhập; không có phiên hoặc user bị khóa → 401 `unauthorized`. Vượt rate limit → 429.

### `GET /api/roster?since=<rev>&kinds=box,owned,…`

`kinds` tùy chọn (mặc định mọi kind; Gợi ý đội chỉ kéo `box,owned,season,locked,override`). Trả `{userId, records: [{kind, id, boxId, updatedAt, rev, deleted, data}], cursor, more}` (`userId` = chủ của cookie, để client phát hiện đổi tài khoản) sắp theo `rev`, tối đa 500 bản ghi mỗi trang, như `recruit.ts`. `deleted` là boolean; `boxId` là `null` với kind `box`. Rate limit `roster_pull` 1 200/giờ.

### `POST /api/roster`

Thân `{expectedUserId, records: [{kind, id, updatedAt, deleted, data}]}`, **Batch tối đa 12 bản ghi** (`ROSTER_MAX_BATCH`, client `PUSH_CHUNK_SIZE` bằng đúng số này; lý do ở mục "Trần câu D1"). `deleted` là boolean; push cũng nhận `0`/`1`. Rate limit `roster_push` 600/giờ.

- `expectedUserId` khác user của cookie → 409 `user_mismatch`, không ghi gì.
- Lỗi cấu trúc thân request (không phải JSON, thiếu `records`, quá 12) → 400.
- Lỗi của từng bản ghi không làm hỏng cả batch: trả `{results: [{kind, id, outcome, code?, server?}], cursor}`.

| `outcome` | Khi nào |
|---|---|
| `applied` | bản ghi được ghi |
| `already-applied` | cùng `updatedAt` và cùng payload (gửi lại sau khi mất phản hồi) |
| `conflict` | server có bản mới hơn, hoặc cùng `updatedAt` khác payload; kèm `server` là bản đang lưu |
| `rejected` | kèm `code`: `bytes`, `schema`, `clock_skew`, `box_missing`, `group_missing`, `box_changed`, `not_found`, `default_protected`, `quota`, `cap`, `retained_cap` |

Server xử lý bản ghi `box` trước, rồi `group`, rồi mọi bản ghi còn lại (đội cần nhóm sống). Số câu D1 mỗi lần gọi tối đa `3 × 12 + 1 = 37` (xóa nhóm: ghi + chẩn đoán + chuyển đội; thêm 1 câu đọc rev cuối) cộng 1 câu phiên và 1 câu rate limit (đo trong test `M2`, chừa thêm 4 câu cho Better Auth thật), dưới trần 50 câu mỗi lần gọi của gói Free. Câu ghi bị bỏ qua mà không suy được lý do trả `conflict` kèm bản đang lưu (nếu có) hoặc `quota`, không trả 500 vì batch đã commit; `data` lồng quá 8 tầng → `rejected schema`. Tạo hộp + bản ghi con trong cùng request chạy được; xóa hộp + ghi con trong cùng request thì bản con nhận `box_missing`.

**Trần câu D1 (đã đối chiếu, 2026-10-22).** Cloudflare D1 limits (<https://developers.cloudflare.com/d1/platform/limits/>, trang ghi cập nhật 2026-04-21): "Queries per Worker invocation" là 1 000 (Workers Paid) và 50 (Free). Tài liệu không nói rõ một `batch()` tính là 1 hay N câu; hợp đồng giả định N (bảo thủ). Tài khoản đang ở gói **Free** (người dùng xác nhận 2026-10-22), nên `ROSTER_MAX_BATCH` hạ từ 200 xuống 12: lô xấu nhất 37 câu + phiên + rate limit = 39 câu đo được, chừa thêm 4 câu cho Better Auth thật vẫn ≤ 50 (test `M2` đếm mọi câu của request). Hệ quả: kho 2 000 bản ghi cần khoảng 170 request push, dưới rate limit 600/giờ. Lên Workers Paid thì có thể nâng lại (3N + 7 ≤ 1 000), đổi server và client `PUSH_CHUNK_SIZE` trong cùng một lần release.

## Đóng dấu thời gian và dirty

- Mọi ghi phía client đóng dấu `updatedAt = max(Date.now(), lớn nhất đã thấy + 1)` (Lamport, như `stamp` trong `js/recruit-tracker-store.js`).
- Dirty là **map khóa → `updatedAt` đã gửi**, không phải tập khóa. Khi nhận kết quả, chỉ bỏ khóa khỏi dirty nếu `updatedAt` hiện tại của bản ghi vẫn bằng bản đã gửi; sửa trong lúc chờ mạng vẫn còn dirty.
- Server từ chối bản ghi có `updatedAt > now + 5 phút` (`clock_skew`).
- `applied`/`already-applied` → ACK. `conflict` → nhận bản server làm chuẩn, giữ bản thua làm nháp riêng để người dùng chọn (trình soạn) hoặc bỏ (kho). `rejected` → bỏ khỏi dirty, đưa vào danh sách bị từ chối, báo UI bằng `role="alert"` và giữ nội dung (bản ghi mang cờ `rejected`: ghi lại cùng nội dung vẫn đóng dấu mới và đẩy lại, không tính vào đồng hồ Lamport, bản kéo về của server thắng nó).
- `GET` trả `userId`; nếu khác user của phiên (cookie đã sang tài khoản khác ở tab khác) thì `pull` vào trạng thái `mismatch` **trước khi áp trang nào**. `signOut()` xóa `tqccl.roster.cloud.v1` trong `finally` (kể cả khi gọi sign-out lỗi).
- Trang kéo rỗng mà `cursor` của server nhỏ hơn con trỏ local (D1 khôi phục, hoặc con trỏ lệch) → con trỏ về 0 và kéo lại toàn bộ.
- Gặp `user_mismatch` hoặc thấy chủ cache đổi: dừng timer, bỏ mọi request/response của phiên cũ, khóa UI và nạp lại phiên. 401 không chuyển về kho local cũ.

## Giới hạn số lượng

- Quota 20 000 bản ghi **sống** (`deleted = 0`) mỗi user (`quota`); tối đa 20 hộp mỗi user, 50 nhóm mỗi hộp, 500 đội mỗi user (`cap`). Kiểm mỗi khi một bản ghi chuyển sang sống (tạo mới hoặc hồi sinh), bằng `insert … select … where (count) < cap` trong cùng `db.batch` với lệnh ghi, không check-rồi-ghi.
- Trần **tổng số khóa giữ lại** (sống + bản xóa) 40 000 mỗi user: đạt trần thì từ chối tạo khóa mới (`retained_cap`) nhưng vẫn cho sửa/xóa khóa đã có. Không có TTL xóa bản xóa (có thể làm sống lại dữ liệu từ máy lâu không online); xóa hộp là cách giải phóng vì bản ghi con bị xóa hẳn.
- Không tạo bản xóa cho khóa chưa từng tồn tại (`not_found`).

## Xóa

- Đội, nhóm, món: xóa mềm (`deleted = 1`, payload thu gọn còn `{id, updatedAt, deletedAt, boxId}`; với bản xóa của hộp, `boxId` = chính id hộp). Bản xóa không tính quota sống.
- **Xóa hộp** là thao tác phía server gắn với kết quả LWW của chính hộp: câu xóa con chỉ chạy khi `exists (select 1 from roster_records where user_id = ? and kind = 'box' and id = ? and deleted = 1 and updated_at = ?)` với đúng `updatedAt` vừa gửi. Bản xóa hộp đến muộn (bị LWW bỏ qua) hoặc bị từ chối không xóa gì. `results` chỉ chứa bản ghi gửi lên, không đếm dòng con bị dọn.
- Bản ghi con (kể cả `team`) chỉ ghi được khi hộp còn sống, kiểm ngay trong câu ghi (`… where exists (select 1 … kind = 'box' and id = :boxId and deleted = 0)`); ngược lại `box_missing`.
- **Xóa nhóm** `G`: khi bản xóa được ghi (cùng điều kiện `exists … updated_at = ?`), server trong cùng batch chuyển mọi `team` sống có `groupId = G` sang `${boxId}~ghep-team`, mỗi đội nhận `rev` mới riêng biệt và `updated_at = max(hiện tại, thời điểm xóa nhóm)` để máy khác nhận được mà không lùi dấu thời gian. Ghi `team` với `groupId` không phải nhóm sống cùng hộp → `group_missing`.
- Hộp `main` và nhóm mặc định không xóa được (`default_protected`).
- `ensureBoxDefaults(boxId)` (client, idempotent) tạo `${boxId}~khai-hoang` và `${boxId}~ghep-team` cho **mọi** hộp, gửi cùng request tạo hộp. Chỉ chạy sau một lần kéo thành công có phủ `box` (và `group` cho phần nhóm): trang chưa kéo được (offline) không dựng hộp/nhóm mới đè bản của server; Gợi ý đội không kéo `group` nên chỉ dựng hộp.
- Xóa tài khoản: `on delete cascade` theo `user`.

## Thay đổi sau duyệt

- **Khóa override**: id đổi từ `${boxId}~${teamId}~${heroIndex}~${slotIndex}` sang `${boxId}~${overrideTeamKey}~${heroIndex}~${slotIndex}` với `overrideTeamKey` = 16 hex đầu SHA-256 (UTF-8) của `teamId`. Lý do: `teamId` là `sourceConfigId` của đội gợi ý, 67/1 366 id thật chứa chữ Hán nên id cũ luôn bị `rejected`. `data.teamId` giữ nguyên id thô; server kiểm lại hash.
- **`source.key` chỉ ASCII** (phase 5): server chỉ nhận `^[A-Za-z0-9][A-Za-z0-9._~-]*$`, nhưng 67/1 366 `sourceConfigId` Đội chuẩn có chữ Hán (vd. `yxms-005-孫尚香凌統`). Id nguồn ASCII dùng nguyên; id có chữ Hán hoặc dài hơn 60 B đổi thành `h-<16 hex SHA-256 của id>` (`sourceKeyPart` trong `js/my-teams-sources.js`, dùng chung build/client). Key biến thể: `${keyPart}~${variantId}`. Chỉ mục và payload dùng cùng key; `/doi-cua-toi/` dựng link nguồn bằng cách băm từng `sourceConfigId` của bảng `{r}` rồi tra ngược.
- **Payload lưu đội** là `{schema: 1, kind, items: {"": {defaultGroup, draft}, [variantId]: …}}`, `draft` không có `id` (id sinh một lần ở trình duyệt lúc bấm lưu, `newTeamId`); `defaultGroup` là hậu tố nhóm mặc định (`khai-hoang` cho Khai hoang, `ghep-team` còn lại). `contentHash` nằm trong `draft.source`.
- **Bộ chuyển nguồn nhận `ids`**: `fromRecommended(record, ids, opts)`, `fromLegacy(content, ids, opts)`, `fromKhaiHoang(team, variant, ids, opts)`, `fromRosterEntry(entry, seasonRecords, ids, opts)` với `ids` = `createLookupIdResolver` (cùng bộ tra dùng cho link Tra cứu); `fromAnalyze(team, opts)` không cần. Trả `{draft, source, unresolved, defaultGroup}`; `unresolved` ghi tên chưa đối chiếu và phương án thay vượt trần.
- **Đội chuẩn không có phương án thay ở cấp tướng/chiến pháp** trong dữ liệu thật (`alternativeHoldersRaw` là cả bộ tướng thay, 5/1 366 cấu hình): ghi thành chữ `Cấu hình thay thế N: …` vào `notes.general`; `heroAlternatives`/`alternatives` chỉ có từ Đội khác, Khai hoang ("A/B") và lựa chọn của Gợi ý đội. Counters Đội chuẩn lấy từ `legacyReferences[].legacyContent.counters` (hiện không bản ghi nào có).
- **Chữ hiển thị lấy bản Việt khi có**: `statNote` = `statFocusVi || statFocusRaw`, ghi chú dùng `textVi || textRaw`; `rawName` và hash vẫn là chữ gốc. Binh thư không đối chiếu được không vào `books` mà vào `unresolved` và `bookType` (tên gốc); phương án thay binh thư của Đội khác vào `bookType` khi ≤120 B, vượt thì sang `notes.general` (chữ không bao giờ bị cắt).
- **`saveTeam` (js/my-teams-api.js)** trả `{ok: true, outcome, team}`, `{ok: false, conflict: true, server, loser}`, `{ok: false, rejected: true, code, errors?}` (`validation` | `schema` | `guest` | `signed-out` | `mismatch` | mã của server) hoặc `{ok: false, pending: true, code}` khi chưa rõ kết quả (mất mạng; bản nháp còn dirty, thử lại cùng `team.id` ra `already-applied`). Bộ nhớ đệm chỉ nằm trong bộ nhớ trang, không ghi `localStorage`.
- **Quá 3 tướng** là sai hình dạng (`normalizeTeam` trả `null`, `saveTeam` → `schema`), còn `validateTeam` báo lỗi trường `heroes` cho UI hiển thị.
- **Thao tác hộp/nhóm/đội của `/doi-cua-toi/` (phase 6, `js/my-teams-api.js`)**: `createBox` (hộp + hai nhóm mặc định cùng một request), `renameBox`, `deleteBox`, `createGroup` (`order` nối đuôi), `renameGroup`, `deleteGroup`, `moveTeam` (cùng hộp), `deleteTeam`; trả `{ok: true, …}` | `{ok: false, rejected: true, code}` | `{ok: false, pending: true, code}`. `deleteGroup` chuyển luôn các đội đang có trong bộ nhớ đệm về `${boxId}~ghep-team` trong cùng lần ghi, **đóng dấu đội SAU bản xóa nhóm** (server xử lý nhóm trước và đặt `updated_at` của đội = mốc xóa nhóm, nên bản đội của client phải mới hơn mốc đó mới `applied`, không thì mọi lần xóa nhóm có đội báo `conflict`); server cũng chuyển cho máy khác. Hộp `main` và nhóm mặc định: `default_protected` ngay ở client.
- **Link nguồn**: `js/my-teams-links.js` (`createSourceLinker`) tra ngược `source.key` về `{family, id, variant}` bằng cách băm từng id của bảng `{r, l, k}`; `loadSourceIndex` tải chỉ mục hash. Trang Gợi ý đội và biến thể Đội khác lấy `contentHash` từ chỉ mục (không tính lại trên chữ đã bản địa hóa); không tải được chỉ mục thì hash rỗng và không báo "Bản gốc đã cập nhật".
- **Bản lưu dở sau OAuth** được tiếp tục khi `js/my-teams-save-button.js` được nạp (cuối module), không phụ thuộc việc nút đã được dựng; nhóm của bản lưu dở nằm trong `draft.groupId` (`main~<nhóm mặc định của nguồn>`).
- **Bản bị từ chối không được coi là đã lưu** (sửa sau review PR #36): `saveTeam`/thao tác hộp-nhóm chỉ trả thành công khi có kết quả POST `applied`/`already-applied` hoặc bản trong bộ nhớ đệm có bằng chứng server (`rev`/`acked`); không có thì `pending`. Hộp bị xóa cục bộ mà server còn sống (`conflict` hoặc kéo về) đưa con trỏ về 0 để kéo lại bản con. Món "chỉ có trên máy này" ở Gợi ý đội được giữ trong trạng thái trang qua mỗi lần nạp lại từ cloud (không ghi vào khóa kho khách).

- **Sau code review (#21/#23)**: (H1) thứ tự đóng dấu của `deleteGroup` như trên; (H2) `GET` có `userId` và `pull` kiểm chủ; (M1) bản lưu dở OAuth chỉ xóa khi `result.team.id` khớp đội đang chờ; (M2) batch 500 → 200; (M3) `writeScanState` xóa mềm theo chênh lệch `previous → next` (không xóa món cloud mà UI không thấy) và Gợi ý đội hoãn nạp lại từ cache khi còn lần ghi đang chờ (`js/roster-scan-writer.js`); (M4) con trỏ lệch → kéo lại từ 0; (M5) `ensureBoxDefaults` sau lần kéo thành công, `mutateAfterPull`; (L1) bản ghi mang `acked` để tab cũ không đẩy lại; (L2) `/doi-cua-toi/` hiện tên đã lưu của hộp `main` (chỉ tên mặc định `Hộp chính` mới theo ngôn ngữ trang); (L6) `saveTeam` không báo thành công khi hộp vừa bị xóa từ máy khác (`box_missing`); (L7) hộp thoại lưu chỉ kéo `box,group`; (L8) trần 30 đội khóa chỉ khi thêm.

## Gộp kho local lần đầu

1. Chỉ chạy sau khi kéo đủ dữ liệu cloud lần đầu.
2. Hỏi người dùng "Gộp kho trên máy này vào tài khoản?" để máy dùng chung không lẫn kho.
3. Đồng ý: tạo `box main`, `season main` (giữ `seasonId` local nếu cloud chưa có), hai nhóm mặc định; mỗi món local (đã suy ID và qua kiểm từ điển), mỗi đội khóa (`locked`) và mỗi món bù (`override`) chỉ tạo bản ghi khi khóa chưa tồn tại trên cloud, kể cả khi trên cloud là bản đã xóa. Không đồng bộ `scans`/ảnh.
4. Cờ "đã hỏi/đã gộp" lưu trong map theo `userId` (`tqccl.roster.merged.v1`), độc lập với meta đồng bộ. Gộp dở (mất mạng giữa chừng) chạy tiếp được vì cùng quy tắc "chỉ tạo khóa chưa có".
5. Đăng xuất xóa cache cloud trên máy (`tqccl.roster.cloud.v1`).
6. Chưa đăng nhập: Gợi ý đội chạy với kho local như cũ. Đội của tôi bắt buộc đăng nhập, không có chế độ offline cho đội.

## Cache giữa nhiều tab

- Mọi đọc–sửa–ghi của `tqccl.roster.cloud.v1` chạy trong `navigator.locks.request("tqccl-roster", …)`: đọc blob mới nhất, gộp bản ghi theo `updatedAt` và **hợp** dirty map của blob với của tab, rồi ghi. Không thay nguyên state đang dirty bằng snapshot từ sự kiện `storage`; sự kiện chỉ kích hoạt gộp.
- Cursor chỉ tiến khi các bản ghi tới mốc đó đã nằm trong blob được ghi cùng lần.

## Payload lưu đội trên trang chi tiết

- Đội chuẩn và Khai hoang (bản mặc định) dùng HTML dựng sẵn mà không tải dữ liệu đội (`adoptPrerendered` trong `js/team-detail.js`): nhúng lúc build `<script type="application/json" id="team-save-payload">`, escape như `jsonLd` (`src/lib/blog-posts.ts`).
- Khai hoang: nhúng mọi biến thể, khóa theo id biến thể; nút lưu đọc biến thể **lúc bấm** từ URL hiện tại (`?variant`), vì đổi biến thể chỉ `replaceState` (`js/khaihoang-detail.js`).
- Đội khác có `?variant` chỉ biết lúc chạy (`loadLegacy` trong `js/team-detail.js`): dựng đội nháp lúc bấm từ `admitted.legacyContent`, key `${legacyTeamId}~${legacyVariantId}`.

## Hash nguồn và "Bản gốc đã cập nhật"

- `contentHash` (16 hex đầu của SHA-256) tính trên các trường nguồn thô có ý nghĩa theo bảng ghép trường: tên gốc tướng/chiến pháp/binh thư theo ô, phương án thay, cộng điểm, chủ tướng và binh chủng theo giai đoạn, ghi chú nguồn. Không tính bản dịch Việt, thứ tự khóa JSON hay chỉnh sửa của người dùng.
- Khi lưu, `contentHash` được **chép** từ payload nhúng hoặc từ index, không tính lại từ đội nháp.
- Index `{ "kind:key": contentHash }` phục vụ bằng Astro endpoint `src/pages/my-teams-source-index.json.ts`, không phải file `data/`. Chỉ `/doi-cua-toi/` tải.
- `analyze` không có hash và không có link nguồn. Đội từ Gợi ý: `team.source === "season"` → tra bản ghi đầy đủ theo `team.id` rồi coi là `recommended`; `entry.source === "legacy"` → `legacy`.
- Bản gốc đổi chỉ báo "Bản gốc đã cập nhật", không ghi đè đội đã lưu.
- Link nguồn trên `/doi-cua-toi/`: `source.key` được tách và kiểm thành `{family, id, variant}`; dựng bằng `teamDetailPath` cộng helper nối `?variant` (`js/team-detail-navigation.js`). Trang tự nhúng và khởi tạo đủ bảng đường dẫn `{r, l, k}` vì layout chỉ nhúng `{l}` cho `pageKind="detail"` (`src/layouts/SiteLayout.astro`).