# Phase 2 — 7 lỗi nặng (2026-09-27)

Hai commit: phần 1 (A–F + `--pack`) và phần G (sửa tên trong `data/teams.json`, publish sau khi người dùng duyệt).

## Test đỏ → xanh
| Bước | Test | Đỏ trước sửa | Sau sửa |
|---|---|---|---|
| A | `tests-js/browser-baseline.test.mjs` | `actual: ["js/season-context.js: This regular expression flag is only available when targeting 'es2024' or later."]`, `expected: []` | xanh |
| A | `season-context.test.mjs` "raw text keeps newline…" (bảo toàn) | xanh trước và sau | xanh |
| B | `unified-lookup.test.mjs` "tìm không dấu coi đ/Đ là d/D" | `actual: []`, `expected: ['hero:dieu-thuyen']` | xanh |
| C | `team-recommend-engine.test.mjs` "blocked strong team names each missing slot…" | `missingHeroSlotNames` `actual: undefined` | xanh |
| C | e2e "đội mạnh chưa xây được ghi tên tướng thiếu theo slot…" | `Received "…Thiếu tướng: hero:bang-thong, hero:gia-cat-luong…"` | xanh |
| D | e2e "đổi ảnh trong lúc đang soi…" | `expect.poll(resets)` Expected 1 Received 0 (nút kẹt) | xanh |
| E | `recruit-tracker-store.test.mjs` "import rejects malformed…" | `pullEvents chứa null`: `true !== false` | xanh |
| E | `recruit-tracker-store.test.mjs` "any import accepted by validation…" | `Cannot read properties of null (reading 'accountId')` | xanh |
| E | e2e "nhập JSON hỏng…" | `.rt-message` Expected "Dữ liệu không hợp lệ." Received "" | xanh |
| F | `roster-scan-state.test.mjs` "đọc lại cùng ảnh…" | `lockedTeams.length` 2 !== 1 | xanh |
| F | `team-recommend-engine.test.mjs` "hai đội khóa chung tướng…" (thay test cũ ghim hành vi bỏ cả hai) | `addTeams use locked heroes: true` | xanh |
| F | e2e "đội khóa có nút bỏ… xóa toàn bộ kho" | không có nút `Bỏ đội Đội khóa A` (click timeout) | xanh |
| G | `tests/test_recommended_team_dedup.py` `--pack` | `recommended_team_dedup: error: the following arguments are required: --cache` | xanh; chạy thật trên pack repo: ledger trùng byte `pipeline/recommended-other-teams.json` |

Lệnh: `node --experimental-strip-types --test tests-js/<file>`; e2e chạy trên `astro build` + preview (build thật bị chặn vì hash lệch trước G3); `python3 -m unittest tests.test_recommended_team_dedup`.

## G0 — tuple của file sửa
- `js/season-context.js`, `js/team-recommend-engine.js`, `css/styles.css`: 0 tuple.
- `js/unified-lookup.js`: 53 (`authored-vi`, không binding).
- `js/roster-recommend-ui.js`: 42 (10 `translate`, 32 `authored-vi`, 2 binding) — giữ nguyên `Thiếu tướng: `, `Thiếu chiến pháp: `.
- `js/roster-scan-state.js`: 1 `translate` (`ui:roster-state/team-default`) giữ nguyên.
- `js/analyze.js`: 28 (4 `translate`, 2 binding) — giữ nguyên `localizeWorkerError(...)`, `describeAnalyzeError(e, ANALYZE_ACTION_ERROR)`.
- `js/recruit-tracker-store.js`: 6 `translate` giữ nguyên; `js/recruit-tracker.js`: 44 giữ nguyên.

## G1 — tuple thêm (authored-vi)
`ui:roster/locked-remove` ("Bỏ đội"), `ui:roster/locked-remove-aria` ("Bỏ đội ${team.teamName}"), `ui:roster/clear-all` ("Xóa toàn bộ kho"), `ui:roster/clear-all-confirm` ("Xóa toàn bộ kho đã đọc (tướng, chiến pháp, đội khóa)? Không hoàn tác được."). Không đổi/bỏ tuple `translate`.

## Mốc
- `policyVersion`: `site-vi-260926-bo-mua-cong-cu` → `site-vi-260927-loi-nang`.
- `baseline.notes`: `concreteLocationCount` 56657 → 56661; `concreteInventorySha256` `18be950c…` → `fc6da1ed…`; `siteLedgerObligations` 2088, `translationObligations` 5591, `uiTranslateObligations` 68 (không đổi).
- Generation mới: `5c6668435aa68263f73166c66adea68db2cb3a5f1f84bb567181afa10a475fbe` (thay `f93a51ea…`, generation có từ trước plan nên để Phase 7 dọn); `pipeline/team-route-handles.json` re-pin, `--check` pass.
- `WORKFLOW_BUILD_ID`: `build:sha256b64:lusCsTDpwKjnvfr2zYciePPmkCfjc_Cqx8HzD9GrUTk` → `build:sha256b64:qHn02bMBS3j-EM1Snk1N6QLK9yLx-m8NrwSGD6gy0-I`.
- Số ghim `tests/test_site_localization.py` không đổi (2088 site obligation).

## Gate A2 phần 1 (exit 0, 170 s)
| Bộ | Kết quả |
|---|---|
| `npm run test:dist` | 28/28 |
| `npm run test:node` | 359/359 (không gồm `teams-data-integrity.test.mjs`, test này còn đỏ tới khi sửa dữ liệu phần G) |
| `npm run test:e2e` | 287 passed |
| `python3 -m unittest discover -s tests` | 382 OK |
| `worker` vitest | 6 file, 53 test |
| `mcp-worker` check | 43 file, 374 test |

## Ghi chú
- `PENDING_SOURCE_NAMES` có thêm `Bái Sư Hứa Du`, cùng lý do Q4b. Plan chỉ liệt kê Pháp Chính và SP Tuân Úc, nhưng tên này cũng chặn đội theo cùng cách. Main đã đồng ý.
- Test `--pack` tự dựng cache theo đúng layout crawler từ fixture: một scope, chạy `crawl_scope` với `fetch_page` được mock. Pin trong policy tạm lấy từ provenance của chính pack fixture.

## Phần G — sửa tên `data/teams.json` (Q4 = A, Q4b)

### Đỏ → xanh
- `tests-js/teams-data-integrity.test.mjs`, trước khi sửa: 22 chuỗi có dấu kết hợp rời (`Lục Tốṇ`, `Giả Hụ̉`, `Lỗ Túc̣`, tên đội `Tốṇ…`/`…Hụ̉…`). Các đội bị chặn: `SP Hoàng Phổ Tung` (team-intro-1, 2, 3, 31), `Thịnh Khí` (intro-16), `SP Đổng Trách` (intro-35), `Tinh·Phong Thi Trận` (intro-37). Sau khi sửa: 3/3 xanh.
- `PENDING_SOURCE_NAMES`:
  - `SP Lô Trực`, `Tiêu Chỉ`, `Đồng Tâm Hiệp Lực`: "không có bản ghi từ điển".
  - `Bái Sư Pháp Chính`, `Bái Sư SP Tuân Úc`, `Bái Sư Hứa Du`: "biến thể đệ tử bái sư, chưa có bản ghi từ điển".
  - `Tinh·Phong Thi Trận`: "chiến pháp bản tinh, chưa có bản ghi từ điển".

### Quyết định của người dùng khi duyệt
- `Tinh·Phong Thi Trận`: **giữ nguyên** vì đây là chiến pháp khác (bản tinh). Không thêm alias; tên nằm trong danh sách chờ nguồn.
- Tên đội team-intro-35: `Trách Thuyền Bố` → `Trác Thuyền Bố`. Handle `trach-thuyen-bo` giữ nguyên.

### Dòng đổi trong `data/teams.json` (34 dòng)
| Thay tên | Số dòng | Đội |
|---|---|---|
| `Lục Tốṇ(S)`/`Lục Tốṇ` → `Lục Tốn(S)`/`Lục Tốn` | 10 | moi-phe-113, 114, 115, 116, 133 |
| `Giả Hụ̉(S)`/`Giả Hụ̉` → `Giả Hủ(S)`/`Giả Hủ` | 4 | moi-phe-72, 86 |
| `Lỗ Túc̣(S)` → `Lỗ Túc(S)` | 1 | moi-phe-133 |
| Tên đội `Tốṇ Túc Mông` (×2), `Mông Tốṇ Túc`, `Tốṇ Ninh Phổ`, `Tốṇ Túc Phổ`, `Tháo Hụ̉ Chiêu`, `Tháo Hoảng Hụ̉` → bỏ dấu rời | 7 | moi-phe-113, 114, 115, 116, 133, 72, 86 |
| `SP Hoàng Phổ Tung`/`Hoàng Phổ Tung` → `…Phủ Tung` | 8 | team-intro-1, 2, 3, 31 |
| `SP Đổng Trách`/`Đổng Trách` → `…Trác` | 2 | team-intro-35 |
| Tên đội `Trách Thuyền Bố` → `Trác Thuyền Bố` | 1 | team-intro-35 |
| Chiến pháp `Thịnh Khí` → `Thịnh Khí Linh Địch` | 1 | team-intro-16 |

### Alias và dữ liệu sinh lại
- Alias `heroes`: `Lục Tốṇ`, `Hoàng Phổ Tung`, `Đổng Trách`. `Giả Hụ̉` và `Lỗ Túc̣` đã có sẵn. Alias `tactics`: `Thịnh Khí`.
- `pipeline/team-nicknames.json`: 3 khoá `Hoàng Phổ Tung|…` đổi thành `Hoàng Phủ Tung|…`, để nickname vẫn khớp `baseName` sau khi áp alias.
- `data/facets.json` sinh lại bằng `build_facets`. File đã commit vốn đã cũ (ví dụ `statuses.meta` 103 so với 56), nên diff lớn hơn phần đổi tên.
- `pipeline/recommended-other-teams.json` sinh lại bằng `--pack`:
  - `counts` không đổi (distinct 40, duplicate 19, pendingIdentity 107); admitted 40 → 40.
  - Chỉ đổi `legacyVariantId` của 9 đội và `localTeamsSha256`.
  - moi-phe-72, 86, 113, 114, 115, 116, 133 vẫn `pendingIdentity`, vì identity map không nhận tên có đuôi `(S)` và `SP Lữ Mông/Trình Phổ`. Không đội nào mới lên `/doi-khac/`.

### Mốc
- `policyVersion`: `site-vi-260927-loi-nang` (giữ nguyên). `baseline.notes` không đổi; chỉ hash `data/teams.json` đổi.
- Generation `5c666843…` (tạo ở phần 1) → `07792857058889034cb799b8795b5d2963d81fac78f5142726a429ad9cd3a432`. Đã `git rm` generation trung gian `5c666843…` (G6).
- `pipeline/team-route-handles.json`: `generationId` mới, `legacyTeamsSha256` `sha256:d71f617f…` → giá trị mới; `--check` pass.
- `WORKFLOW_BUILD_ID` không đổi (`check:workflow-build` pass).

### Test handle ledger (đổi theo thiết kế ledger đóng băng)
Đổi tên đội team-intro-35 thành `Trác Thuyền Bố` làm slug sinh lại thành `trac-thuyen-bo`, trong khi URL đã phát hành là `trach-thuyen-bo`. Người dùng chốt giữ handle này.

Trước đây `test_committed_ledger_is_exactly_what_the_current_inputs_generate` bắt handle legacy phải bằng slug sinh từ tên hiện tại. Điều đó mâu thuẫn với ledger đóng băng: `--write` từ chối gán lại ledger đã có, và `--check` không suy handle từ tên. Test nay khẳng định:
- (a) Tập id đội trong ledger bằng đúng tập sinh từ `data/teams.json`.
- (b) Mọi handle legacy là duy nhất và route được.

Handle recommended và Khai hoang vẫn phải bằng đúng giá trị sinh lại. Ý (c) (entry mới dùng slug sinh ra) chưa có đường code riêng, vì mọi đội đều đã có trong ledger và `--write` chỉ sinh ledger mới. Không thêm ngoại lệ riêng cho team-intro-35.

### Gate A2 phần G (exit 0, 177 s)
test:dist 28/28 · test:node 362/362 (gồm teams-data-integrity) · e2e 287 passed · python 382 OK · worker 6 file/53 test · mcp-worker 43 file/374 test · `team_route_handles --check` pass.
Kiểm dist: `dist/doi-khac/ton-tuc-mong-113/index.html` còn và có 0 ký tự U+0323; `dist/doi-khac/trach-thuyen-bo/` hiện "Trác Thuyền Bố"; `Bái Sư Pháp Chính`, `Bái Sư SP Tuân Úc` còn nguyên trong `data/teams.json`.
