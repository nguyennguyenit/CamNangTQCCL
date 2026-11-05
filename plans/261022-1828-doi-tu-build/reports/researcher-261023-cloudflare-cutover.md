# Nghiên cứu cutover "Đội cộng đồng → Đội tự build": Pages `_redirects`, D1 migration, cờ bảo trì Worker, asset cũ, workflow Pages

Ngày: 2026-10-23. Repo: `CamNangTQCCL`, nhánh `main`, HEAD `0f89e2e`. Thiết kế nền: `local://doi-tu-build-design.md` (quyết định của user giữ nguyên).
Phạm vi: chỉ đọc repo và tài liệu chính thức. Không chạy build, test, migration, deploy hay lệnh ghi lên Cloudflare/GitHub.

Quy ước: **[Đã kiểm]** là điều đã đọc trực tiếp trong repo, tài liệu chính thức hoặc mã nguồn mở chính thức của Cloudflare (ghim commit). **[Suy luận]** là kết luận ghép từ các nguồn đó nhưng chưa quan sát trên production.

Mã nguồn tham chiếu được ghim: `cloudflare/workers-sdk@5c909cc` và `cloudflare/workerd@aaef35f` (HEAD lúc đọc).

## Kết luận chính

1. **[Đã kiểm]** Rule `/doi-cong-dong/* /doi-tu-build/:splat 301` giữ query của request (`?id=`, `?new=1`, `?mine=1`), vì đích không có query riêng. Rule này **không** khớp `/doi-cong-dong` (thiếu `/` cuối), nên cần thêm một rule tĩnh riêng. Mỗi locale cần hai dòng, và các dòng splat phải nằm cuối file.
2. **[Đã kiểm]** Sáu cột `playstyle, strengths, weaknesses, counters, countered_by, substitutes` không bị index, trigger, cột sinh, view hay CHECK nào tham chiếu, nên `ALTER TABLE … DROP COLUMN` chạy được (cần SQLite ≥ 3.35.0). Chỉ có **ba** trigger đụng `page_key`, cả ba nằm trong `0008`. Không được dựng lại bảng `community_teams`: D1 luôn bật foreign key, và `DROP TABLE` sẽ xoá dây chuyền ảnh và vote.
3. **[Đã kiểm]** Đổi một `vars` luôn tạo version mới và phải deploy, dù làm qua `wrangler deploy --var` hay qua dashboard. Worker production hiện tại **chưa có** middleware bảo trì (`app.ts:55-66` chỉ chặn CSRF), nên phải phát hành middleware này **trước** cửa sổ cutover. Cờ KV dùng được (đã có binding `AI_KV`) nhưng chậm tới khoảng 60 giây hoặc hơn, nên xếp sau.
4. **[Đã kiểm]** Asset hash của deployment cũ **không được bảo đảm** còn truy cập được qua domain production. Chỉ có cache bảo tồn theo từng data center, dạng "best effort", tối đa khoảng một tuần. Client phải bắt lỗi `import()` như thiết kế đã chốt.
5. **[Đã kiểm]** `pages-deploy.yml` chỉ chạy khi có `repository_dispatch` (`blog-publish`, `site-publish`) hoặc `workflow_dispatch`. Workflow không có `schedule` và không có `push`. Có thể chặn bằng `gh workflow disable pages-deploy.yml`, nhưng lệnh này không huỷ run đang chạy.

---

## 1. Cloudflare Pages `_redirects`

### 1.1 Query string có được giữ không

- **[Đã kiểm]** Tài liệu chính thức không nói rõ. Trang Redirects chỉ ghi rằng đích "Can include fragments, query strings, splats, and placeholders", và rằng bảng "Query Parameters ❌" là để **khớp** theo query ở nguồn (https://developers.cloudflare.com/pages/configuration/redirects/).
- **[Đã kiểm]** Asset server mã nguồn mở của Pages dựng `Location` theo công thức `${destination.pathname}${destination.search || search}${destination.hash}`, trong đó `search` là query của request gốc (`packages/pages-shared/asset-server/handler.ts:191,257`, https://github.com/cloudflare/workers-sdk/blob/5c909cc20a01f7321752c868cf0a9acedcea155d/packages/pages-shared/asset-server/handler.ts#L257). Đích `/doi-tu-build/:splat` không có query, nên `/doi-cong-dong/?id=abc` được chuyển thành `Location: /doi-tu-build/?id=abc`. Với đích cùng origin, `Location` là đường dẫn tương đối.
- **[Suy luận]** Mã trên là asset server dùng cho `wrangler pages dev`, và nó tự nhận là logic phục vụ của Pages. Nó có khớp 100% với production hay không thì vẫn phải kiểm trên preview (xem 1.6).

### 1.2 Splat có khớp URL không dấu `/` cuối không

- **[Đã kiểm]** Hàm biên dịch rule thay `*` bằng `(?<splat>.*)` rồi bọc trong `^…$` (`packages/workers-shared/asset-worker/src/utils/rules-engine.ts:41-58`). Vì vậy `/doi-cong-dong/*` thành `^/doi-cong-dong/(?<splat>.*)$`. Regex này khớp `/doi-cong-dong/` (splat rỗng, đích là `/doi-tu-build/`) và `/doi-cong-dong/index.html`, nhưng **không khớp** `/doi-cong-dong`.
- **[Đã kiểm]** Khi không có rule nào khớp và cũng không còn file `/doi-cong-dong/index.html` trong deployment mới, handler trả về `notFound()` (`handler.ts:339-342`). Nếu không có rule riêng, URL không dấu `/` sẽ thành 404.
- Kết luận: cần thêm `/doi-cong-dong /doi-tu-build/ 301` và `/zh/doi-cong-dong /zh/doi-tu-build/ 301`. Hai rule này trỏ thẳng tới URL có `/` để tránh hai lần chuyển hướng.

### 1.3 Thứ tự ưu tiên với file tĩnh và Functions

- **[Đã kiểm]** Tài liệu ghi: "Redirects are always followed, regardless of whether or not an asset matches the incoming request." Trang này cũng ghi rằng redirect chạy trước `_headers` (https://developers.cloudflare.com/pages/configuration/redirects/). Trong mã, `generateResponse()` kiểm tra redirect tĩnh, rồi tới redirect động, rồi mới tìm asset (`handler.ts:240-242`).
- **[Đã kiểm]** Tài liệu cũng ghi: "Redirects defined in the `_redirects` file are not applied to requests served by Pages Functions". Repo chỉ có một Function là `functions/api/[[path]].ts` (proxy `/api/*`), và không có `_routes.json` tự viết. Pages tự sinh `_routes.json` khi phát hiện thư mục `functions` (https://developers.cloudflare.com/pages/functions/routing/#functions-invocation-routes).
- **[Suy luận]** Vì `_routes.json` tự sinh chỉ gồm route `/api/*`, request `/doi-cong-dong/*` không đi qua Function, nên `_redirects` có hiệu lực. Kiểm trên preview bằng lệnh ở 1.6.
- **[Đã kiểm]** Trên cùng một nguồn, rule đứng trên cùng thắng. Parser bỏ qua rule trùng `from` (`parseRedirects.ts:154`).

### 1.4 Giới hạn số rule, và vì sao splat phải nằm cuối

- **[Đã kiểm]** Giới hạn là 2.000 rule tĩnh và 100 rule động, tổng 2.100. Tài liệu ghi mỗi dòng tối đa 1.000 ký tự (https://developers.cloudflare.com/pages/configuration/redirects/#per-file). Mã ghi `MAX_LINE_LENGTH = 2000` (`workers-shared/utils/configuration/constants.ts:6-9`), lệch với tài liệu nhưng không ảnh hưởng ở đây.
- **[Đã kiểm]** Parser dùng cờ `canCreateStaticRule`. Từ rule động đầu tiên (có `*` hoặc `:placeholder`) trở đi, **mọi** rule sau bị tính là động, kể cả rule không có ký tự đại diện (`parseRedirects.ts:39,83-107`, cùng logic trong `constructConfiguration.ts`). Tài liệu cũng dặn: "Static redirects should appear before dynamic redirects."
- File hiện tại có 38 rule tĩnh (`public/_redirects:2-39`). Thêm 2 rule tĩnh và 2 rule splat sẽ thành 40 tĩnh và 2 động, vẫn xa giới hạn. Nếu đặt splat giữa file, các rule tĩnh phía sau bị đổi sang động. Cách đó vẫn chạy, nhưng tốn suất 100 rule động và chậm hơn. Vì vậy hai dòng splat phải là hai dòng cuối file.

### 1.5 Đề xuất thay đổi generator `pipeline/lookup_route_handles.py`

Hiện trạng **[Đã kiểm]**:
- `redirects_bytes(former_map, ledger, season_lines=())` ghi header, rồi 301 của các chiến pháp đã gộp, rồi `season_lines` (`pipeline/lookup_route_handles.py:267-282`).
- `season_redirect_lines()` sinh `/doi-chuan/<slug>/ /doi-chuan/ 301` cho từng prefix trong `REDIRECT_LOCALE_PREFIXES = ("", "/zh")` (`:41`, `:243-264`).
- Có hai nơi gọi. `write_ledger` ghi file nếu bytes khác (`:307-310`). `check_ledger` ném lỗi `"… is stale; run --write"` khi lệch (`:322-325`). CLI `--write` và `--check` loại trừ nhau (`:333-350`).
- Generator ghi đè toàn bộ `public/_redirects` (header ở `:39`: "không sửa tay"), nên mọi dòng tay sẽ mất ở lần `--write` sau.

Đề xuất (KISS): dùng một hằng số tĩnh, luôn được thêm vào cuối, không cần thêm tham số hay luồng dữ liệu mới.

```python
# Trang đổi tên: URL cũ 301 sang URL mới theo locale. Pages giữ query của request khi đích không có query
# (?id=, ?new=1, ?mine=1). Rule splat là rule động nên đứng cuối file: sau rule động đầu tiên, Pages coi mọi rule là động.
RENAMED_PAGE_ROUTES = (("doi-cong-dong", "doi-tu-build"),)


def renamed_page_redirect_lines() -> list[str]:
    """`/<cũ> /<mới>/ 301` (không dấu `/`, rule tĩnh) mỗi locale, rồi `/<cũ>/* /<mới>/:splat 301` mỗi locale."""
    static = [f"{p}/{old} {p}/{new}/ 301" for old, new in RENAMED_PAGE_ROUTES for p in REDIRECT_LOCALE_PREFIXES]
    splat = [f"{p}/{old}/* {p}/{new}/:splat 301" for old, new in RENAMED_PAGE_ROUTES for p in REDIRECT_LOCALE_PREFIXES]
    return static + splat
```

Trong `redirects_bytes`, ngay sau `lines.extend(season_lines)` (`:281`), thêm `lines.extend(renamed_page_redirect_lines())` và sửa docstring (`:268`). Bốn dòng cuối của `public/_redirects` sau `--write` sẽ là:

```
/doi-cong-dong /doi-tu-build/ 301
/zh/doi-cong-dong /zh/doi-tu-build/ 301
/doi-cong-dong/* /doi-tu-build/:splat 301
/zh/doi-cong-dong/* /zh/doi-tu-build/:splat 301
```

Test hiện có cần sửa theo **[Đã kiểm]** (nằm ở `tests/test_lookup_route_handles.py`, repo không có `pipeline/tests`):
- `test_merged_tactic_gets_one_301_per_locale_and_dropped_one_none` (`:289-296`) so toàn bộ nội dung file với header cộng 2 dòng. Cần nối thêm `*lrh.renamed_page_redirect_lines()`.
- `test_current_season_slug_is_301_to_the_list_and_follows_the_default_season` (`:298-314`) kiểm `lines[-2:]` là rule mùa. Vì bốn dòng mới nằm sau, cần đổi thành lát cắt `lines[-2 - n:-n]` với `n = len(lrh.renamed_page_redirect_lines())`.
- `test_committed_redirects_match_the_ledger` (`:364-374`) kiểm `len(rules) == 2 * pairs + 2` và `all(line.endswith("/ 301"))`. Cần đổi thành `2 * pairs + 2 + 4`. Điều kiện kết thúc dòng phải nhận cả `"/:splat 301"`.
- Nên thêm một test mới: nội dung vi+zh đúng như trên, các dòng splat là hai dòng cuối, và không có dòng nào chứa `*` hay `:` xuất hiện trước một dòng tĩnh. Test này khoá bất biến ở 1.4.
- `test_check_fails_on_stale_redirects` (`:323-331`), `RealBooksRenameTest` (`:378-409`) và `scripts/verify-astro-dist.mjs:720-724` (chỉ kiểm rule mùa) không cần sửa. Dist `_redirects` vốn là bản sao byte của `public/_redirects` (`scripts/verify-astro-dist.mjs:35`).

Tài liệu cần sửa cho khớp: docstring module (`pipeline/lookup_route_handles.py:16-19`), `docs/deployment-guide.md:104`, `docs/unified-lookup.md:158` và changelog. Các chỗ khác cùng đợt đổi URL đã có trong checklist thiết kế: `public/_headers:38` (`/doi-cong-dong/*`), `tests-js/pages-headers-contract.test.mjs:21,124,145` và `scripts/verify-astro-dist.mjs:83`.

### 1.6 Cách kiểm trên preview (bắt buộc, vì 1.1 và 1.3 có phần suy luận)

Deploy bản build lên alias preview đã khai trong `SITE_ORIGIN` (`community-worker/wrangler.jsonc:36`): `wrangler pages deploy dist --project-name tqccl --branch preview-community`. Sau đó dùng GET, không dùng HEAD, để đúng đường đi thật:

```sh
for p in "/doi-cong-dong/?id=abc" "/doi-cong-dong/?new=1" "/doi-cong-dong/?mine=1" "/doi-cong-dong" "/doi-cong-dong/" \
         "/zh/doi-cong-dong/?id=abc" "/zh/doi-cong-dong"; do
  curl -sS -o /dev/null -w "%{http_code} $p -> %{redirect_url}\n" "https://preview-community.tqccl.pages.dev$p"
done
curl -sS -o /dev/null -w "%{http_code}\n" "https://preview-community.tqccl.pages.dev/api/me"   # Function vẫn chạy, không bị redirect
```

Kết quả mong đợi là `301` và `…/doi-tu-build/?id=abc`, v.v. Riêng `/api/me` phải trả `200`.

Lưu ý **[Đã kiểm]**: theo RFC 9110 §15.4.2, mã 301 được trình duyệt cache theo heuristic (https://www.rfc-editor.org/rfc/rfc9110#section-15.4.2). Sau khi lên production, việc "quay lại" URL cũ không rẻ. Rollback chỉ nên lùi frontend và Worker, không nên lùi URL.

---

## 2. D1: ALTER TABLE, phiên bản, transaction, foreign key, Time Travel

### 2.1 Cú pháp ALTER TABLE (SQLite)

Nguồn: https://www.sqlite.org/lang_altertable.html.
- **DROP COLUMN [Đã kiểm]**: có từ 3.35.0 (https://www.sqlite.org/releaselog/3_35_0.html). Lệnh thất bại nếu cột là PK hoặc UNIQUE, có index, nằm trong WHERE của partial index, nằm trong CHECK của cột khác, dùng trong FK, dùng trong biểu thức cột sinh, hoặc "appears in a trigger or view". Lệnh ghi lại nội dung bảng, nên thời gian tỷ lệ với kích thước bảng.
- **ADD COLUMN … NOT NULL DEFAULT [Đã kiểm]**: được phép nếu DEFAULT khác NULL và là literal, không phải biểu thức trong ngoặc hay `CURRENT_*`. Không được thêm cột `GENERATED … STORED`. Từ 3.37.0, CHECK của cột mới được kiểm trên các dòng đã có. Ví dụ `body_md text not null default ''` hợp lệ, rồi điền dữ liệu bằng `UPDATE`.
- **RENAME TABLE [Đã kiểm]**: từ 3.25/3.26, lệnh mang tên mới vào trigger, view và FK. Thiết kế không đổi tên bảng (non-goal), nên không dùng tới.
- **[Đã kiểm]** Authorizer của workerd cho phép `SQLITE_ALTER_TABLE` trên bảng không thuộc vùng tên dành riêng như `_cf_*` (`src/workerd/util/sqlite.c++:1191-1200`, https://github.com/cloudflare/workerd/blob/aaef35fb2d7068aa3e136b62c466785b0d658478/src/workerd/util/sqlite.c%2B%2B#L1191).

### 2.2 Phiên bản SQLite của D1

- **[Đã kiểm]** Tài liệu D1 không công bố phiên bản. Bản workerd dùng cho `wrangler dev` và `--local` build SQLite 3.53.x (`MODULE.bazel:5-7`, bộ patch `sqlite3/3.53.3`).
- **[Đã kiểm]** Runbook hiện tại chỉ đòi `select sqlite_version()` ≥ 3.31 (`docs/community-worker.md:353`). Với `DROP COLUMN`, ngưỡng phải nâng lên **≥ 3.35.0**.
- Lệnh kiểm production (đọc, chưa chạy): `npx wrangler d1 execute tqccl-community --remote --command "select sqlite_version()"`.

### 2.3 Migration có chạy trong transaction không

- **[Đã kiểm]** `wrangler d1 migrations apply` nối SQL của file với `INSERT INTO d1_migrations (name) values (…)` thành một chuỗi (`packages/wrangler/src/d1/migrations/helpers.ts:334-351`). Chuỗi đó được gửi trong **một** lệnh `executeSql` cho mỗi file (`apply.ts` vòng `for` của `unappliedMigrations`). Với `--remote`, wrangler gửi tới REST `/query` dạng `{sql}` (`packages/wrangler/src/d1/execute.ts:505-520`).
- **[Đã kiểm]** API `/query` ghi: "Supports multiple statements, joined by semicolons, which will be executed as a batch" (https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/). Batch của D1 là transaction: "If a statement in the sequence fails … it aborts or rolls back the entire sequence" (https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
- **[Suy luận]** Mỗi file migration, kể cả dòng ghi `d1_migrations`, là nguyên tử: lỗi ở giữa thì toàn file được rollback và file chưa bị đánh dấu đã áp. Không viết `BEGIN`/`COMMIT` trong file. D1 chạy mọi query trong transaction ngầm (https://developers.cloudflare.com/d1/sql-api/foreign-keys/), và authorizer chặn `SQLITE_TRANSACTION` khi regulator không cho phép (`sqlite.c++:1212-1218`).
- **[Đã kiểm]** Wrangler cảnh báo: "Your database may not be available to serve requests during the migration" (`apply.ts:142`). Wrangler đã chuẩn hoá CRLF trong thân trigger vì lỗi #14991 (`execute.ts:507-512`). Dù vậy, vẫn nên giữ file migration ở dạng LF.
- **[Đã kiểm]** Giới hạn mỗi câu lệnh là 100 KB và 30 giây (https://developers.cloudflare.com/d1/platform/limits/). Nếu migration sinh `UPDATE` có literal `body_md`, mỗi câu phải dưới 100 KB. Bài cũ tối đa khoảng 13.000 ký tự nên không chạm giới hạn.

### 2.4 `PRAGMA foreign_keys` và `defer_foreign_keys`

- **[Đã kiểm]** D1 luôn bật FK, tương đương `PRAGMA foreign_keys = on`. Người dùng không đổi được giá trị này trong query hay migration. Thay vào đó có `PRAGMA defer_foreign_keys = on`, hiệu lực tới hết transaction (https://developers.cloudflare.com/d1/sql-api/foreign-keys/). SQLite ghi rõ `PRAGMA foreign_keys` "is a no-op within a transaction" (https://www.sqlite.org/pragma.html#pragma_foreign_keys). Trang SQL statements của D1 vẫn liệt kê `foreign_keys` như một pragma bật/tắt được, và authorizer cho phép cú pháp này (`sqlite.c++:589`). Nhưng vì đang trong transaction ngầm, lệnh đó không có tác dụng.
- **[Đã kiểm]** `defer_foreign_keys` **không** chặn `ON DELETE CASCADE` (https://developers.cloudflare.com/d1/sql-api/sql-statements/#pragma-defer_foreign_keys--onoff). `DROP TABLE` khi FK bật sẽ thực hiện một `DELETE` ngầm và kích hoạt các FK action (https://www.sqlite.org/foreignkeys.html §5).
- **Hệ quả cho plan:** cách dựng lại bảng 12 bước (tạo bảng mới, chép, `DROP TABLE community_teams`, đổi tên) sẽ **xoá sạch** `community_team_images` và `community_team_votes`, vì hai bảng này có `on delete cascade` (`0008_community_teams.sql:58,66`). Phải dùng `DROP COLUMN`. Các bước `UPDATE page_key` và `DROP COLUMN` không vi phạm FK, nên migration không cần `defer_foreign_keys`.

### 2.5 Sáu cột cần xoá: không bị tham chiếu [Đã kiểm]

Tên thật của sáu cột nằm ở `community-worker/migrations/0008_community_teams.sql:27-32`: `playstyle` (text not null), `strengths`, `weaknesses`, `counters`, `countered_by`, `substitutes`.

| Đối tượng schema | Vị trí | Có tham chiếu 6 cột? |
|---|---|---|
| CHECK của bảng | `0008:19` (status), `:26` (troop), `:33` (text_lang) | Không |
| Cột sinh STORED `points`, `hot_rank`, `top_rank` | `0008:43-47`: dùng `up_votes, down_votes, evidence_count, points, created_at` | Không |
| 6 index của `community_teams` | `0008:49-54`: dùng `season_id, status, hot_rank, top_rank, created_at, id, hero_key, author_id` | Không |
| Trigger vote ×3 | `0008:75-101`: ghi `up_votes, down_votes`, lọc theo `id` | Không |
| Trigger evidence ×3 | `0008:106-131`: ghi `evidence_count`, đọc `author_id`, lọc theo `id` | Không |
| `community_teams_block_blocked_user` | `0008:134-140`: chỉ đọc `NEW.author_id` | Không |
| View | Không có `create view` trong `migrations/` | — |
| Migration khác | `0001`, `0004`, `0005`, `0011` không nhắc `community_teams` | — |

Không có đối tượng schema nào chặn `DROP COLUMN`. Nhưng **mã Worker hiện tại** đọc và ghi cả sáu cột: `TEAM_SELECT` (`community-worker/src/routes/teams.ts:104-106`), câu insert (`teams.ts:307-325`) và kiểu dữ liệu (`teams-validate.ts:43-48,113-118`). Sau migration, Worker cũ sẽ lỗi 500 **cả ở GET** danh sách và chi tiết đội. Cách xử lý ở mục Runbook.

### 2.6 Mọi trigger đụng `page_key` [Đã kiểm]

- `0002_community.sql`: **không có trigger**. `page_key` chỉ xuất hiện ở cột (`:6`, `:32`) và index: `comments_page_lang_created_idx` (`:12`), `battle_reports_page_lang_status_created_idx` (`:47`), `battle_reports_page_status_idx` (`:48`). `UPDATE page_key` chỉ cập nhật index, không chặn gì.
- `0006_user_admin.sql`: bốn trigger chặn tài khoản bị khoá: `session_block_blocked_user` (`:36`), `uploads_block_blocked_user` (`:44`), `battle_reports_block_blocked_user` (`:52`), `scan_samples_block_blocked_user` (`:60`). Chúng chỉ đọc `NEW.user_id`/`NEW."userId"` và **không đụng `page_key`**. Trigger trên `battle_reports` là `before insert`, nên `UPDATE page_key` không kích hoạt nó.
- `0008_community_teams.sql`: **ba trigger duy nhất** đụng `page_key`, cùng lọc `like '/doi-cong-dong/%'` và lấy id bằng `substr(page_key, 16, length - 16)`:
  - `battle_reports_team_evidence_ins`, after insert (`:106-113`)
  - `battle_reports_team_evidence_upd`, **after update of status, result** (`:115-122`)
  - `battle_reports_team_evidence_del`, after delete (`:124-131`)
- Bản sao ngoài `migrations/`: `rollback/0010_restore_community_team_triggers.sql:5-36` dựng lại ba trigger kèm đếm lại, với tiền tố cũ. `rollback/0009_drop_community_team_triggers.sql:7-9` gỡ chúng. Test liên quan nằm ở `community-worker/test/teams-schema.test.ts:274-302`.
- **[Đã kiểm]** Trigger `_upd` chỉ chạy khi `status` hoặc `result` đổi. Vì vậy `UPDATE battle_reports SET page_key = …` không kích hoạt trigger nào trong ba trigger trên, và giá trị `evidence_count` vẫn đúng ngay sau khi đổi tiền tố. Bước "đếm lại evidence" trong thiết kế là để an toàn, không phải để sửa số sai.
- **[Đã kiểm]** Độ dài: `'/doi-cong-dong/'` có 15 ký tự, `'/doi-tu-build/'` có 14 ký tự. Trigger mới dùng `substr(page_key, 15, length(page_key) - 15)`, và câu UPDATE là `'/doi-tu-build/' || substr(page_key, 16)`. Kết quả khớp với thiết kế.
- **[Đã kiểm]** Ngoài `page_key`, cột `feedback.page` (`0003_feedback.sql:2,9`) lưu đường dẫn trang đang xem, có thể là `/doi-cong-dong/?id=…`. Đây là dữ liệu lịch sử, và 301 đã lo phần điều hướng. `pagePath()` của admin (`js/community-admin.js:302-305`) nhận diện chuỗi `'/doi-cong-dong/'` và cần đổi theo tiền tố mới.
- **[Đã kiểm]** Test giả lập D1 tự áp mọi file `migrations/*.sql` theo thứ tự tên (`community-worker/test/fakes.ts:59-64`, `node:sqlite`, Node 24.20.0 theo `.node-version`), nên migration `0012` sẽ tự chạy trong test. Khác biệt: bản giả lập dùng `exec` cả file, không bọc batch như D1.

### 2.7 Time Travel [Đã kiểm]

Nguồn: https://developers.cloudflare.com/d1/reference/time-travel/ và https://developers.cloudflare.com/d1/platform/limits/.
- Time Travel luôn bật và không tính phí. Có thể lùi về bất kỳ phút nào trong **30 ngày (Workers Paid) hoặc 7 ngày (Free)**. Giới hạn **10 lần restore mỗi 10 phút** cho mỗi database. Cần wrangler ≥ 3.4 (repo ghim `^4.141.0`, `community-worker/package.json:25`).
- Lệnh: `npx wrangler d1 time-travel info tqccl-community` để lấy bookmark hiện tại, hoặc thêm `--timestamp=<unix|RFC3339>` để lấy bookmark tại một thời điểm. Restore bằng `npx wrangler d1 time-travel restore tqccl-community --bookmark=<b>`.
- Restore là thao tác **phá huỷ**: ghi đè database tại chỗ, huỷ các query đang chạy, và trả về một bookmark để undo. Lệnh lùi cả bảng `d1_migrations`, nên Worker phải được rollback cùng lúc. Mọi ghi xảy ra sau bookmark (bài, vote, bình luận sau khi mở lại) sẽ mất, đúng như `docs/community-worker.md:360` đã cảnh báo.

---

## 3. `vars` của Worker và cơ chế bảo trì

### 3.1 Đổi `vars` có cần deploy không [Đã kiểm]

- Mỗi thay đổi code hoặc cấu hình, kể cả binding và vars, tạo một **version** mới. `wrangler deploy` vừa tạo version vừa deploy ngay 100% traffic (https://developers.cloudflare.com/workers/versions-and-deployments/).
- `wrangler deploy --var KEY:VALUE` ghi đè giá trị trong file cấu hình nếu trùng khoá (https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy). `wrangler versions upload --var …` tạo version có var đó mà chưa deploy. Sau đó `wrangler versions deploy <id>@100% -y` mới phát hành (https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/).
- Trên dashboard (Settings → Variables and Secrets), thao tác cũng kết thúc bằng nút **Deploy** (https://developers.cloudflare.com/workers/configuration/environment-variables/#add-environment-variables-via-the-dashboard). Repo **không** có `keep_vars`, nên lần `wrangler deploy` sau sẽ ghi đè var đặt trên dashboard bằng giá trị trong `wrangler.jsonc` (https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth). Đây là hành vi mong muốn, vì config là nguồn sự thật.
- Thời gian lan toả: tài liệu không nêu con số cho deploy hay rollback. Trang Rollbacks chỉ ghi rằng rollback "will immediately create a new deployment … and become the active deployment" (https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/). Xem mục "Chưa kiểm chứng".

### 3.2 Hiện trạng repo [Đã kiểm]

- `vars` gồm `SITE_ORIGIN, ADMIN_EMAILS, FEEDBACK_FROM, FEEDBACK_TO, GITHUB_REPOSITORY, FEATURE_ENABLED` (`community-worker/wrangler.jsonc:32-47`). Kiểu `Env` khai ở `community-worker/src/env.ts:3-31`.
- `FEATURE_ENABLED` chỉ chặn hai route analyze (`routes/teams.ts:229-231`, `routes/reports.ts:105-107`). Thiết kế đã sửa đúng điểm này.
- Middleware `/api/*` hiện chỉ chặn CSRF cho method ghi, rồi gắn `Cache-Control: no-store` (`community-worker/src/app.ts:30,55-66`). **Chưa có cơ chế bảo trì.**
- `/api/auth/*` (Better Auth) được đăng ký **trước** middleware `/api/*` (`app.ts:53`), nên middleware bảo trì gắn ở `app.ts:55` sẽ không bao route đăng nhập. **[Suy luận]** Điều này chấp nhận được: Better Auth chỉ ghi `session`/`user`/`account`, không đụng `page_key` hay `community_teams`, và repo không bật endpoint xoá user của Better Auth (không có `deleteUser` trong `community-worker/src`).
- Xoá tài khoản đi qua `DELETE /api/admin/users/:id` (`routes/users.ts:396`). Route này nằm dưới `/api/*` nên sẽ bị chặn. Cron `scheduled` (`src/index.ts:10-13`, `wrangler.jsonc:31` mỗi giờ phút 17) chỉ xoá `uploads` pending và `rate_limits` (`src/cleanup.ts:21-24`). Cron vô hại với migration, nhưng nên tránh chạy migration trùng phút :17.
- Đã có binding KV `AI_KV` (`wrangler.jsonc:26`, `env.ts:9`). Namespace này dùng chung với `worker/`.

### 3.3 Các cách bật/tắt bảo trì: xếp hạng

| Tiêu chí | **A. Var `MAINTENANCE` + deploy** (khuyến nghị) | B. Var qua dashboard | C. Cờ KV trong `AI_KV` | D. Dòng cờ trong D1 |
|---|---|---|---|---|
| Cần deploy | Có (`wrangler deploy --var MAINTENANCE:true`, hoặc `versions deploy` một version đã upload sẵn) | Có (nút Deploy) | Không | Không |
| Độ trễ tới khi có hiệu lực | Khi deployment mới phục vụ request (tài liệu không nêu số) | Như A | Theo tài liệu, "up to 60 seconds or more" ở các PoP khác; tra cứu khoá không tồn tại cũng bị cache (https://developers.cloudflare.com/kv/concepts/how-kv-works/#consistency) | Tức thì (primary) |
| Chi phí mỗi request | 0 | 0 | Một lần đọc KV mỗi request ghi | Một query D1 mỗi request ghi, trên đúng DB đang migrate |
| Rủi ro | Thấp. Var nằm trong version, rollback được | Lệch với repo; deploy kế tiếp xoá (không có `keep_vars`) | Namespace dùng chung với `worker/`; nhất quán cuối nên lúc mở lại có PoP vẫn chặn, lúc đóng có PoP vẫn ghi | Bị khoá hoặc chậm đúng lúc migration chạy |
| Hợp với cutover một lần | Rất hợp, vì đằng nào cũng deploy Worker trong cửa sổ | Chỉ để chữa cháy | Hợp nếu cần bật/tắt thường xuyên; ở đây không cần | Không |

Khuyến nghị: dùng **A**. Đây là cách tất định, không thêm I/O, và trùng với nhịp deploy Worker vốn có trong cửa sổ. C chỉ đáng dùng nếu sau này cần bật/tắt nhanh mà không deploy, và phải chấp nhận độ trễ ≥ 60 giây.

---

## 4. Asset hash của deployment cũ sau deploy production mới [Đã kiểm]

- Tài liệu (https://developers.cloudflare.com/pages/configuration/serving-pages/#asset-retention): "Assets have a time-to-live (TTL) of one week but can also disappear at any time. If you do a new deploy, the assets could exist in that data center up to one week."
- Mã nguồn: trước khi trả 404, handler tra "asset preservation cache" để xem asset này có vừa được phục vụ hay không, với `s-maxage=604800` tức 1 tuần (`handler.ts:28-33`, ghi ở `:627-660`, đọc ở `notFound()` `:692-750`). Cache này dùng Cache API, nên **mỗi data center có bản riêng**. Mã tự ghi chú "preservation cache is best effort", và chỉ ghi khi `options.preserve` bật.
- Mỗi deployment còn có URL riêng `<hash>.tqccl.pages.dev`, "atomic and may always be visited in the future" (https://developers.cloudflare.com/pages/configuration/preview-deployments/). Nhưng đó là origin khác, nên `import()` tương đối của trang production không tận dụng được.
- **Kết luận:** không có bảo đảm `/_astro/<hash>.js` cũ còn tải được qua `tqccl.com` sau khi deploy. Một tab đang mở HTML cũ (SPA `pushState`) rồi bấm "Viết bài" có thể nhận 404 cho chunk TipTap cũ. Cơ chế "bắt lỗi `import()` → nút tải lại" trong thiết kế là bắt buộc, không phải tuỳ chọn.
- **[Đã kiểm]** `public/_headers` không có rule cho `/_astro/*`. Pages mặc định gửi `Cache-Control: public, max-age=0, must-revalidate` cho asset cacheable (cùng trang serving-pages), nên HTML mới được tải ngay khi người dùng tải lại trang.

---

## 5. `.github/workflows/pages-deploy.yml` trên main [Đã kiểm]

- Trigger (`:8-11`): `repository_dispatch` với `types: [blog-publish, site-publish]`, và `workflow_dispatch`. **Không có `schedule`, không có `push`.** Push lên `main` không tự deploy Pages; `docs/community-worker.md:353` cũng ghi điều này.
- Workflow luôn checkout `ref: main` (`:29-31`). `concurrency: pages-deploy` với `cancel-in-progress: true` (`:17-19`). Workflow deploy bằng `wrangler pages deploy dist --project-name tqccl --branch main` (`:48-54`), có chạy `npm run verify` trước đó (`:47`).
- Nguồn kích hoạt tự động duy nhất là Worker gọi `POST /repos/{repo}/dispatches` với `site-publish` (`community-worker/src/deploy.ts:14-25`). Các hành động gọi dispatch như duyệt/xoá đội, khoá/xoá tài khoản, xuất bản bài đều là request ghi, nên **sẽ bị middleware bảo trì chặn**.
- Hai workflow có `schedule` khác là `mcp-edge-security-monitor.yml:3-6` và `mcp-worker.yml:49-50`. Chúng không deploy Pages (`wrangler pages deploy` chỉ có trong `pages-deploy.yml:53`).
- GitHub: tắt workflow sẽ "stop a workflow from being triggered", nhưng "doesn't cancel its existing runs" (https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows). Lệnh CLI là `gh workflow disable pages-deploy.yml` và `gh workflow enable pages-deploy.yml` (https://cli.github.com/manual/gh_workflow_disable). `repository_dispatch` chỉ kích hoạt workflow có file trên default branch (https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#repository_dispatch).
- **[Suy luận]** Dispatch đến lúc workflow đang tắt bị bỏ, không xếp hàng. API vẫn trả 204, nên Worker sẽ báo `deploy.ok`. Sau khi bật lại, cần chạy tay một lần.

Khuyến nghị chặn build: (1) bật bảo trì trước, để chặn tận gốc mọi dispatch; (2) `gh workflow disable pages-deploy.yml`; (3) `gh run list --workflow pages-deploy.yml --limit 5` để xác nhận không có run `in_progress`/`queued` (nếu có thì `gh run cancel <id>`); (4) chỉ merge PR vào `main` sau ba bước trên.

---

## Runbook cutover đề xuất

Điều kiện tiên quyết là bản phát hành **P0**, làm vài ngày trước cửa sổ. P0 thêm middleware bảo trì vào `app.ts:55` cho Worker hiện tại: method ghi trả `503 maintenance` kèm `Retry-After`, và `vars.MAINTENANCE = "false"` trong `wrangler.jsonc`. P0 deploy theo luồng thường. Thiếu P0 thì không có cách nào chặn ghi ở Worker cũ trong cửa sổ (3.2).

| # | Bước | Lệnh / kiểm tra | Nguồn |
|---|---|---|---|
| 0 | Kiểm phiên bản SQLite và ghi bookmark | `wrangler d1 execute tqccl-community --remote --command "select sqlite_version()"` (≥ **3.35.0**); `wrangler d1 time-travel info tqccl-community` để lưu bookmark B0 | 2.2, 2.7 |
| 1 | Upload sẵn Worker mới, chưa deploy | Trong `community-worker/`: `npx wrangler versions upload --var MAINTENANCE:true --message "doi-tu-build maint"` và `npx wrangler versions upload --message "doi-tu-build open"`; ghi lại hai version id | 3.1 |
| 2 | Bật bảo trì trên Worker P0 | `npx wrangler deploy --var MAINTENANCE:true` từ commit P0; thử một POST, phải nhận 503 `maintenance` | 3.1, 3.3 |
| 3 | Chặn build Pages | `gh workflow disable pages-deploy.yml`; `gh run list --workflow pages-deploy.yml --limit 5` | 5 |
| 4 | Merge PR redesign vào `main` | Không kích hoạt build vì không có trigger `push` | 5 |
| 5 | Migration `0012` (một file, nguyên tử) | `npm run db:migrate:remote`. Thứ tự trong file: `add column body_md text not null default ''` → `UPDATE` gộp nội dung → `drop trigger` ×3 → `UPDATE comments`/`battle_reports` đổi tiền tố → `create trigger` ×3 với `substr(…,15,…-15)` → đếm lại `evidence_count` → `drop column` ×6. Không `BEGIN`, không `PRAGMA foreign_keys`, không dựng lại bảng. Tránh phút :17 | 2.3–2.6 |
| 6 | Deploy ngay Worker mới, vẫn ở chế độ bảo trì | `npx wrangler versions deploy <id-maint>@100% -y`. Khoảng hở giữa bước 5 và 6, khi Worker cũ GET đội bị 500 (2.5), chỉ còn vài giây | 3.1 |
| 7 | Deploy Pages | `gh workflow enable pages-deploy.yml && gh workflow run pages-deploy.yml --ref main`; theo dõi tới khi xong | 5 |
| 8 | Kiểm tra | Chạy các lệnh `curl` ở 1.6 trên `tqccl.com`; mở `/doi-tu-build/?id=<đội cũ>` và thấy bình luận/chiến báo; `select count(*) from comments where page_key like '/doi-cong-dong/%'` phải bằng 0; `evidence_count` khớp với giá trị đếm lại | 1.6, 2.6 |
| 9 | Mở lại | `npx wrangler versions deploy <id-open>@100% -y` (hoặc `npm run deploy` từ `main`) | 3.1 |

Rollback trước bước 9: deploy lại version P0 (vẫn bảo trì), rollback deployment Pages trên dashboard (https://developers.cloudflare.com/pages/configuration/rollbacks/), rồi `wrangler d1 time-travel restore tqccl-community --bookmark=B0`. Lúc này chưa có ghi mới vì đang bảo trì, nên không mất dữ liệu người dùng. Sau bước 9 thì không nên restore, vì sẽ mất mọi ghi kể từ lúc mở lại.

Phương án thay thế (xếp sau): bỏ P0 bằng cách deploy luôn Worker mới ở chế độ bảo trì trước migration. Cách này đòi chế độ bảo trì chặn **cả GET** của mọi route đọc schema mới (`/api/community-teams*`, admin teams), vì Worker mới đọc `body_md` trước khi cột đó tồn tại. Phạm vi phải chặn rộng hơn, dễ sót, nên không khuyến nghị.

---

## Chưa kiểm chứng

- **Query string và rule tĩnh không dấu `/` trên production Pages.** Mới kiểm bằng mã nguồn mở của asset server (`wrangler pages dev`). Cần chạy `curl` trên preview như 1.6 trước khi merge.
- **`_routes.json` tự sinh chỉ gồm `/api/*`.** Tài liệu chỉ nói file được sinh tự động, không nói nội dung. Cần kiểm bằng `curl` `/doi-cong-dong/` trên preview (phải 301, không phải phản hồi của Function).
- **Phiên bản SQLite của D1 production.** Tài liệu không công bố. Phải chạy `select sqlite_version()` (bước 0). Chưa chạy vì hợp đồng cấm gọi Cloudflare.
- **Tính nguyên tử của migration remote.** Đây là suy luận ghép giữa "executed as a batch" của REST `/query` và "batch là transaction" của Worker API. Chưa có câu tài liệu nói thẳng rằng `migrations apply` là nguyên tử. Có thể thử bằng một migration cố ý lỗi ở câu cuối trên database D1 tạm.
- **Thời gian lan toả của `wrangler deploy`/`versions deploy`.** Tài liệu không có con số. Đo trong cửa sổ bằng cách gửi POST lặp lại tới khi nhận 503 `maintenance`.
- **Plan Workers (Free hay Paid).** Quyết định cửa sổ Time Travel là 7 hay 30 ngày. Chưa kiểm vì cần dashboard hoặc API.
- **Dispatch gửi lúc workflow đang tắt có bị bỏ hay không.** Tài liệu GitHub không nói rõ. Thực tế không quan trọng vì bảo trì đã chặn mọi dispatch.
- **Trạng thái `d1_migrations` trên production** (đã áp tới `0011` chưa; số `0007`/`0009`/`0010` chỉ là file rollback, không có trong `migrations/`). Cần `npx wrangler d1 migrations list tqccl-community --remote` trước bước 5.
- Báo cáo này không bàn cách escape Markdown khi gộp sáu cột (chọn ký tự nào, viết bằng SQL hay script). Đó là phạm vi của bước thiết kế migration.
