# Phase 2 — 7 lỗi nặng (2026-09-27)

Phần 1 (A–F + `--pack`) đã commit. Phần G (sửa tên trong `data/teams.json`) đang chờ người dùng duyệt diff ledger, chưa publish, xem `phase-02-review-packet.md`.

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

## Gate A2 (exit 0, 170 s)
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
