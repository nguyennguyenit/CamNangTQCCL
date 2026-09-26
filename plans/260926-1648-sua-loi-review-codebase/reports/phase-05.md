# Phase 5 — Hiệu năng runtime (2026-09-27)

Finding: ReviewJsCore#4, ReviewJsCore#7 (phần hiệu năng), ReviewJsTools#25. Một commit `perf:`.

## A. Bảng nguồn theo trang (trích từ code, dòng sau khi sửa)

Nguồn trang **đọc** (render/khởi tạo) hoặc **dựa vào hash đã xác minh**:

| Trang | Đọc | Trích | Xác minh qua website-display (`paths`) |
|---|---|---|---|
| Đội chuẩn, Đội khác | bộ mùa 10 file (`teams`, `coexist`, `heroes-dict`, `tactics`, `books-dict` + 5 file `season-*`) qua `loadSeasonModel` với `#season-artifact-hashes`; generation Recommended; `teams` chỉ để migrate `legacyTeam` | `app.js:162-163` (mô hình mùa), `:198` (`hasLegacy`), `season-ui-state.js:5` (`SEASON_ARTIFACTS`) | — ; `data/teams.json` khi URL có `legacyTeam` không kèm `config` (`app.js:128,135`; `migrateLegacyReferenceUrl` bỏ qua URL có `config`, `team-detail-navigation.js:409`) |
| Cùng Tồn | bộ mùa 10 file; `coexist` đã dịch (nhánh không có mô hình mùa) | `app.js:143,429` | `data/coexist.json` |
| Khai hoang | `khaihoang` đã dịch (bảng + inventory snapshot) | `app.js:144,462` | `data/khaihoang.json` |
| Tra cứu | kho Tra cứu (`lookup-manifest` neo `heroes-dict`, `tactics`, `lookup-catalog`); `catalogSha256` = hash `heroes-dict` đã xác minh | `app.js:159,493,498`; `lookup-data.js:1-2,260-276` | 4 nguồn Tra cứu (`app.js:43,138`) |
| Theo dõi chiêu mộ | `heroesDict` từ kho Tra cứu | `app.js:510` | 4 nguồn Tra cứu |
| Soi đội | kho Tra cứu, `teams` đã dịch, `books-dict` (không nằm trong `sourceHashes`, như trước) | `app.js:142,145,511` | 4 nguồn Tra cứu + `data/teams.json` |
| Gợi ý đội | kho Tra cứu, `teams` đã dịch, `team-tier` (tuỳ chọn) | `app.js:142,160,512` | 4 nguồn Tra cứu + `data/teams.json` |
| Chi tiết Đội chuẩn/Đội khác | `teams` (kiểm `legacyTeamsSha256` + dịch), generation Recommended | `team-detail.js:94-95,143` | `data/teams.json` |
| Chi tiết Khai hoang | `khaihoang` (kiểm hash trang rồi dịch) | `khaihoang-detail.js:141-146` | `data/khaihoang.json` |

`data/season-content-links.json` không trang nào dịch hay dựa vào hash website-display của nó: bộ mùa tự kiểm bằng `#season-artifact-hashes`. Mọi trang vẫn xác minh chính file `website-display.json` theo pin.

## B. Xác minh song song và theo danh sách (ReviewJsCore#4)

Test đỏ trước (`node --experimental-strip-types --test tests-js/website-display.test.mjs`):
- `requests every listed source before the first one answers`: `actual: [ 'data/teams.json' ]`, `expected: [ 'data/coexist.json', 'data/teams.json' ]` (băm tuần tự).
- `loads and verifies only the listed sources`: `actual: [ 'website-display.json', 'data/teams.json', 'data/coexist.json', 'data/khaihoang.json' ]` (tải đủ mọi nguồn).
- `rejects a requested source the publication does not pin`: `Missing expected rejection`.
- `refuses to localize a source that was never verified`: `Missing expected exception`.

Sửa: `loadWebsiteDisplay(pin, loadBytes, recommendedPin, {paths})` (mặc định mọi nguồn), kiểm dạng mọi mục `sourceHashes` trước, đường không được pin → `Nguồn dữ liệu hiển thị không hợp lệ`, băm bằng `Promise.all`; tập đã xác minh giữ trong `WeakMap` riêng của module (không lộ ra `values`, object giả không giả mạo được); `localizeData` ném `Nguồn dữ liệu chưa được xác minh: <path>`. Test `applies reviewed data bindings…` viết lại để dùng publication đã nạp thật. Sau sửa: 10/10 xanh. Ca hash sai (`đã thay đổi`) giữ nguyên.

## C. Tải theo trang (ReviewJsCore#4)

`createByteLoader()` trong `js/website-display.js` (memo theo đường dẫn, bỏ promise lỗi để "Thử lại" tải lại, trả `Uint8Array`) thay bộ nạp riêng của `app.js`, `team-detail.js`, `khaihoang-detail.js` (`byteLoader` cũ xoá). `app.js` truyền `paths` theo `data-page-section`; `teams` chỉ tải ở Soi đội, Gợi ý đội hoặc khi URL có `legacyTeam`; kho Tra cứu chỉ ở 4 trang dùng; `team-tier` chỉ Gợi ý đội; kho Tra cứu, tier và mô hình mùa tải song song. `team-detail.js` và `khaihoang-detail.js` tạo loader mới mỗi lượt tải và truyền `paths` của mình. Thông điệp lỗi và binding `displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")` giữ nguyên.

Test đỏ trước (chạy trên dist của HEAD `3c25a12`):
- `spa-parity` `each section page requests only the data sources it uses, each once`: ví dụ `khaihoang` nhận thêm `books-dict, coexist, heroes-dict, lookup-catalog, lookup-manifest, season-content-links, tactics, team-tier, teams`.
- `team-detail-pages` `Đội chuẩn and Đội khác details fetch only the display publication and teams.json, each once`: nhận thêm 7 file và `teams.json` hai lần.
- `khaihoang-options` `detail fetches only the display publication and khaihoang.json, each once`: nhận thêm 7 file.

Test hiện có chỉnh theo hành vi mới: `boots once…` so bảng nguồn Đội chuẩn thay danh sách chung; `required JSON failure…` chặn `heroes-dict.json` (nguồn bắt buộc của Tra cứu; Tra cứu không còn tải `teams.json`); `optional tier failure is non-fatal` chuyển sang Gợi ý đội (trang duy nhất đọc tier); xoá `a hanging optional tier request retains the legacy blocked-render behavior` (ghim hành vi phụ: Đội chuẩn không còn tải tier). Sau sửa: 4 spec của phase 158/158 xanh.

### Số request `/data/*.json` mỗi trang (cache trống, Chromium; ngoài generation `/data/recommended/`)

| Trang | Trước | Sau | Recommended (trước → sau) |
|---|---|---|---|
| `/doi-chuan/`, `/doi-khac/` | 15 | 11 | 4 → 4 |
| `/cung-ton/` | 15 | 11 | 0 |
| `/khai-hoang/` | 11 | 2 | 0 |
| `/tra-cuu/`, `/theo-doi-chieu-mo/` | 11 | 5 | 0 |
| `/soi-doi-tu-anh/` | 11 | 7 | 0 |
| `/goi-y-doi-tu-kho/` | 11 | 7 | 0 |
| `/doi-chuan/<đội>/` | 10 (`teams.json` ×2) | 2 | 3 → 3 |
| `/doi-khac/<đội>/` | 10 (`teams.json` ×2) | 2 | 0 |
| `/khai-hoang/<đội>/` | 9 | 2 | 0 |

Sau sửa không file nào bị yêu cầu hai lần. Landing: 0 → 0.

## D. Boot `app.js` render một lần (ReviewJsCore#7)

Không có test đỏ tự nhiên. `renderTeams` tìm đúng một hàng theo `configId` qua ba nhóm phân loại theo thứ tự cũ (không map toàn bộ projection); bỏ `renderScope()` thừa sau `refresh()`; phần Cùng Tồn của `renderScope` chỉ chạy khi mục Cùng Tồn đã mount. Test bảo toàn `tests-e2e/season-lookup.spec.mjs` xanh trước (gate A2 của HEAD, Phase 4b: 317 passed) và sau.

Đo (script tạm Playwright, CPU ×4, 15 lượt + 2 khởi động, trung vị thời điểm `body[data-boot=ready]`):

| URL | Trước | Sau | ScriptDuration trước → sau |
|---|---|---|---|
| `/cung-ton/` | 332,3 ms | 208,3 ms | 16,4 → 13,9 ms |
| `/cung-ton/?config=khong-co` | 352,8 ms | 207,5 ms | 17,9 → 13,9 ms |

Phần lớn chênh lệch là 4 request ít hơn và tải song song; dữ liệu thật có 0 cấu hình mùa nên phần "một hàng" chỉ thấy rõ trên fixture.

## E. Clone state Chiêu mộ (ReviewJsTools#25)

Không có test đỏ tự nhiên. `getRecruitTrackerSummary` normalize một lần rồi gọi `pityOf`/`fiveStarHistoryOf` nội bộ; `getPity`/`getFiveStarHistory` export giữ hành vi (normalize rồi gọi helper); `recordDailySlotFiveStar`/`recordBannerFiveStar` cũng dùng `pityOf` trên state đã normalize. `recruit-tracker-store.test.mjs` + `recruit-tracker-ui.test.mjs` 12/12 xanh trước và sau.

Đo (script tạm Node, 5 banner × 2000 sự kiện, 40 lượt): trung vị 33,15 ms → 4,80 ms (p90 35,3 → 5,27 ms); đầu ra giống hệt (340 mục lịch sử, pity 28 cho cả 5 banner).

## Test khác

`tests-e2e/recommended-browser.spec.mjs` N5-3 đỏ ngẫu nhiên **cả trên HEAD** (2/5 lượt chạy cả file trên dist của `3c25a12`): hai mục lịch sử cùng URL `/doi-chuan/` nên `goBack` trả về trước khi trang cũ commit, `page.evaluate` sau đó gặp "Execution context was destroyed". Sửa test: chờ `framenavigated` của khung chính cùng `goBack` rồi so `toHaveURL(/\/doi-chuan\/$/)` (không evaluate trong trang). 8/8 lượt chạy cả file xanh.

## G0–G8

- **G0:** `js/app.js` 3 tuple `translate` (`ui:app/load-error` binding, `ui:app/team-chuan-title`, `ui:app/team-khac-title`) giữ nguyên; `js/recruit-tracker-store.js` 6 tuple `translate` (owner `createDefaultRecruitTrackerState`, `createAccount`, `validateRecruitTrackerImport`) không đụng; `js/website-display.js`, `js/team-detail.js`, `js/khaihoang-detail.js` 0 tuple (file bị ghim).
- **G1:** không thêm/đổi/bỏ tuple.
- **G2/G3:** stale đúng 5 file; `unknownLocationDetails` rỗng. `sourceFiles`: `js/app.js` `b08b4228…` → `0e59287f…`, `js/khaihoang-detail.js` `8f9d7a1c…` → `f4a2e3ff…`, `js/recruit-tracker-store.js` `21d4bdc4…` → `19fe4dba…`, `js/team-detail.js` `2be28b14…` → `e96a1ebc…`, `js/website-display.js` `db19587b…` → `b663990e…`. `baseline.notes` không đổi (56669 location, `abc4f153…`, 2086 site obligation, 5589 obligation, 66 `translate` UI). `policyVersion` `site-vi-260927-xoa-code-chet-b` → `site-vi-260927-hieu-nang`.
- **G4:** build/check/publish/`check --stage public` đều exit 0. Generation mới `eeaa9c420c169b8c9286ef3131f528b6afbee0398511af25cdf8072f6a430340`.
- **G5:** `pipeline/team-route-handles.json` `generationId` `75a88d67…` → `eeaa9c42…` (`teams.json`/`khaihoang.json` không đổi); `--check` pass.
- **G6:** `git rm` generation `75a88d67…` (Phase 4b tạo).
- **G7:** số ghim không đổi; `tests.test_site_localization tests.test_team_route_handles tests.test_build_recommended_reference` 80 OK.
- **G8:** không file nào thuộc bao đóng MCP; `WORKFLOW_BUILD_ID` không đổi.

## Docs

`docs/code-standards.md` (bảng nguồn theo trang, `paths`, `createByteLoader`), `docs/system-architecture.md` (Static runtime, failure `team-tier`/dependency), `docs/project-changelog.md`.

## Gate A2

Exit 0, 208 s.

| Bộ | Kết quả |
|---|---|
| `npm run verify` | `Verified 1725 dist files (52 raw assets, 16 static public files)` |
| `npm run test:dist` | 29/29 |
| `npm run test:node` | 346/346 |
| `npm run test:e2e` | 319 passed |
| `python3 -m unittest discover -s tests` | 377 OK |
| `team_route_handles --check` | pass (generation `eeaa9c42…`) |
| `worker` vitest | 6 file, 53 test; `typecheck` ok |
| `mcp-worker` check | 43 file, 336 test |
