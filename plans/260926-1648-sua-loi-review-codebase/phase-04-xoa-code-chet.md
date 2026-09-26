---
phase: 4
title: "Xoá code chết"
status: completed
priority: P2
effort: "2.5d"
dependencies: [3]
---

# Phase 4: Xoá code chết

## Goal
Bỏ mọi module, export, nhánh, CSS, method MCP, trường Worker, hàm/CLI pipeline không còn đường chạy production, cùng test chỉ phủ chúng và docs còn liệt kê chúng. Không đổi hành vi người dùng thấy.

## Contract
- JS: ReviewJsCore#2 = ReviewAstroCss#1 ⊃ ReviewJsTools#18 (5 module mồ côi + manifest), ReviewJsCore#3 = ReviewAstroCss#2 (chuỗi `team-filter-section.js` chết), ReviewJsCore#7 phần chết (`app.js:229-232,245-246`; phần render một lần ở Phase 5), ReviewJsCore#11 (`lookupUI`, tham số `data`, catch nuốt lỗi), ReviewJsCore#12 (export thừa), ReviewJsTools#20 (export không có caller production), #21 (trường engine không ai đọc), #22 (chặn paste từ thời tab), #23 (nhãn `food`, nhánh cảnh báo, `continue` không tới được).
- Astro/CSS: ReviewAstroCss#10 (`src/lib/recommended-reference-data.mjs`), #15 (`findAdmittedVariant`, `teamDetailHtmlPaths`), #16 (`.cam-nang-status`, `.detail-score` bị ghi đè).
- Docs đi cùng phần xoá: ReviewJsCore#15 (bảng module + comment), ReviewJsTools#19, ReviewAstroCss#9. Phần docs không liên quan module (FR-01, `:218`, đếm dữ liệu) ở Phase 7.
- MCP/Worker: ReviewWorkers#6 (15/17 method `LegacyDomainAdapter`), #7 (export chết/chỉ test, `AuthenticatedBearer.slot`), #8 (`parseAndValidate`, `AnalyzeResult.raw`, `GuardOk.bytes`).
- Pipeline: ReviewPipeline#8 (CLI v1 `build_recommended_evidence` + JSON không người đọc), #9 (`build_registry`, `allocate_child_ids`), #10 (`check_data_candidate`, `compile_data_candidate`, `LEDGER_PATH` + ba nơi khai đường ledger), #11 (`EXPECTED_COUNTS`), #12 phần xoá (`stat_focus_vn`, `STAT_MAP`; phần CLI/docs của `parse_coexist_csv` ở Phase 7), #13 (15 output reviewer mồ côi).

**Không xoá** (có consumer thật, đã grep): export của `js/season-context.js` và `js/roster-scan-map.js` mà `mcp-worker/src/domain/season-domain-adapter.ts` dùng; `normalizeText`, `teamSearchBlob` (`js/filters.js`, dùng ở `mcp-worker/src/research/research-handlers.ts:3`, `data/entity-identity.ts:1`, `data/snapshot-index.ts:1`); `SOURCE_LABEL`, `FACTION_CODE`, `bestTier`, `tierClass` của `js/render.js` nếu còn importer sau khi xoá (grep lại); `parse_*` của `pipeline/sgsdeck_recommended.py`; `build_content_links` của `pipeline/parse_coexist_csv.py`.

## Files to Create / Modify
- Delete: `js/team-pk.js`, `js/meta-cu.js`, `js/tactics.js`, `js/hero-list.js`, `js/hero-detail.js`, `tests-js/hero-list.test.mjs`, `tests-js/hero-detail.test.mjs`, `src/lib/recommended-reference-data.mjs`, `pipeline/sgsdeck-recommended-evidence.json`, 15 file `pipeline/localization-reviews/site-review-{final-000,final-006,final-009,final-010,v5-016,v5-022,v5-026,v5-030,v5-031,v5-053,v5-055,v5-073,v5-081,v5-088,v5-089}.json` (danh sách lấy lại bằng lệnh ở bước P2).
- Modify: `src/lib/public-artifact-manifest.mjs` (bỏ 5 entry, `:26,28,37,50,55`; nếu `filters`/`season-ui-state` còn importer thì giữ), `js/team-filter-section.js`, `js/render.js`, `js/filters.js`, `js/season-ui-state.js`, `js/app.js`, `js/season-context.js`, `js/detail-actions.js`, `js/team-detail-navigation.js`, `js/recommended-reference-state.js`, `js/roster-scan-state.js`, `js/hero-identity.js`, `js/lookup-data.js`, `js/team-recommend-engine.js`, `js/analyze.js`, `js/unified-lookup.js`, `js/recommended-reference-render.js`, `src/lib/team-detail-routes.ts`, `css/styles.css`.
- Modify MCP/Worker: `mcp-worker/src/domain/legacy-domain-adapter.ts`, `mcp-worker/src/domain/contracts.ts`, `mcp-worker/src/domain/normalization-service.ts`, `mcp-worker/src/domain/digest-encoding.ts`, `mcp-worker/src/data/lookup-bundle.ts`, `mcp-worker/src/data/artifact-contracts.ts`, `mcp-worker/src/security/bearer-auth.ts`, `mcp-worker/workflow-source-manifest.json` (nếu bao đóng đổi), `mcp-worker/src/generated/workflow-build.ts`, `worker/src/schema.ts`, `worker/src/guard.ts`.
- Modify pipeline: `pipeline/sgsdeck_recommended.py`, `pipeline/unified_lookup_identity.py`, `pipeline/site_localization.py` (xoá wrapper/hằng; `DATA_INVENTORY_OWNERS` `data/coexist.json` → `js/render.js::seasonCoexistGroup`; bỏ tuple `ui:season/tier-sort`, `ui:season/tier-label`), `pipeline/parse_team_intro.py`, `pipeline/hanviet.py`, `pipeline/site-translations.json` (bỏ 2 mục ledger), `pipeline/site-translation-reviews.json` (bỏ đúng 2 item).
- Modify tests: `tests-js/{astro-dist-contract (:906),tactics-data (:5,141-149),filters,season-ui-state,team-tier-badge,team-detail-navigation,recommended-reference-state,roster-scan-state,hero-identity,lookup-data,team-recommend-engine (:315-317),unified-lookup,team-detail-routes}.test.mjs`, `mcp-worker/test/domain/{legacy-domain-adapter,contracts,normalization-service,digest-encoding}.test.ts`, `mcp-worker/test/security/bearer-auth.test.ts`, `worker/test/schema.test.ts` (`:70-72`), `worker/test/guard.test.ts`, `tests/{test_sgsdeck_recommended,test_unified_lookup_identity,test_hanviet,test_site_localization}.py`.
- Modify gate: policy, generation mới, `data/website-display.json`, `pipeline/team-route-handles.json`.
- Modify docs: `docs/codebase-summary.md` (`:11,30,36-39,107`), `docs/system-architecture.md` (`:102`), comment `js/render.js:53`, `js/filters.js:1`, `js/team-filter-section.js:1-4`, `docs/project-changelog.md`.

## Tasks & Steps
Phase xoá code chết: miễn test-first. Trước mỗi lần xoá, grep lại consumer trên `js/ src/ scripts/ tests-js/ tests-e2e/ mcp-worker/src/ worker/src/ pipeline/`; còn consumer production → không xoá, ghi vào báo cáo.

### J. JavaScript runtime
- [x] **J1. 5 module mồ côi.** Xoá 5 file + entry manifest; xoá `hero-list.test.mjs`, `hero-detail.test.mjs`; `tactics-data.test.mjs` bỏ import `tacticDescriptions` và ca `:141-149` (chỉ phủ hàm chết), giữ các ca kiểm dữ liệu; `astro-dist-contract.test.mjs:906` bỏ `hero-list`, `tactics` khỏi danh sách module runtime.
- [x] **J2. Chuỗi bộ lọc cũ.** Xoá `facetCount`, `createTeamFilterSection`, `createSeasonTeamSection` (`team-filter-section.js:10-240`) và import kèm; `render.js`: `seasonTeamCard` (`:846`), `teamCard` (`:150`), `statusBadge`, `recommendBadge`, `STATUS_LABEL`, `coexistGroup` (`:314`) nếu hết importer; `filters.js`: `applyFilters`, `emptyState`; `season-ui-state.js`: `validateTeamFilters`, `filterSeasonRows`, `rowFacet` (và `QUERY_FILTERS` nếu chỉ chúng dùng). Xoá ca test chỉ phủ các hàm này (`filters.test.mjs`, `season-ui-state.test.mjs`, `team-tier-badge.test.mjs` phần `teamCard` nếu có). Sau khi xoá, quét lại class CSS không còn ai tham chiếu (cách quét của ReviewAstroCss: selector class so với `js/ src/`, trừ tiền tố động `f-`, `rt-slot-`, `…-item/-vi/-zh`) và xoá cùng.
- [x] **J3. Bản dịch của phần bị xoá.** G1 bỏ tuple `translate` `ui:season/tier-sort`, `ui:season/tier-label` (`site_localization.py:281-282`): xoá tuple, xoá 2 mục ledger trong `pipeline/site-translations.json` (ghi lại bằng `canonical_json_bytes`, định dạng file hiện tại), bỏ đúng 2 item khỏi batch receipt chứa chúng trong `pipeline/site-translation-reviews.json` (định dạng `indent=2`), giữ nguyên file output reviewer. Đổi owner `data/coexist.json` trong `DATA_INVENTORY_OWNERS` sang `js/render.js::seasonCoexistGroup` (owner thật; `data/coexist.json` có 0 obligation `translate`, đã đếm, nên chỉ digest inventory đổi, không cần receipt). G7: số ghim `tests/test_site_localization.py:71` 2088 → 2086 và các số liên quan.
- [x] **J4. `app.js`.** Xoá `sections['team-pk']/['meta-cu']?.update` (`:245-246`), `queryForSection` (`:229-232`), `lookupUI` (`:443,485`), import chỉ phục vụ chúng (`bestTier`, `resolveSelectionScore`, `defaultSeasonSelection`, `assignDerivedFactions`, `tierIndex` — kiểm từng cái); khối catch (`:508-512`) thêm `console.error(err)`, giữ **nguyên văn** `displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")` và `title:'Đội chuẩn'`/`title:'Đội khác'` (tuple `translate`). `season-context.js:152` bỏ tham số `data` không dùng (G8).
- [x] **J5. Export thừa.** `detail-actions.js:6-10` bỏ `export` của 5 hằng (chuỗi `SOURCE_LINK_LABEL = 'Xem nguồn'` của tuple `ui:detail/source-link` vẫn còn nguyên); xoá `clearReturnSnapshot` (`team-detail-navigation.js:397`) + test; xoá `loadVerifiedLegacyTeam` (`recommended-reference-state.js:221`), `resolveTeamDestination` (`:132`), `lockedConstraints` (`roster-scan-state.js:203`), `heroIdentityKey` (`hero-identity.js:56`), `LOOKUP_PAYLOAD_NAMES` (`lookup-data.js:278`) cùng test ghim chúng.
- [x] **J6. Engine.** Bỏ `presetId`, `presetReason`, `coexistSetBonus`, `score` (`team-recommend-engine.js:289-293,345-349`) và hai phần tử luôn 0 của `rankingTuple` (`:111-117`); xoá assertion `tests-js/team-recommend-engine.test.mjs:315-317`. Output MCP không đổi (`recommendation-service.ts` `baseResult` không đọc các trường này — grep lại).
- [x] **J7. Nhánh không tới được.** `analyze.js:4` comment tab cũ và `:468` chặn paste; `unified-lookup.js:795-815` nhãn `food`, `UNKNOWN_COST_KEYS` và nhánh cảnh báo (`lookup-data.js` bắt buộc đúng 3 khoá `wood/iron/stone`) + ca test của nhánh đó; `recommended-reference-render.js:344-345` `if (!value) continue`.

### A. Astro / CSS
- [x] **A1.** Xoá `src/lib/recommended-reference-data.mjs`.
- [x] **A2.** Xoá `findAdmittedVariant`, `teamDetailHtmlPaths` (`src/lib/team-detail-routes.ts:455-466`); `tests-js/team-detail-routes.test.mjs` dùng `catalog.htmlPaths`/`catalog.variants`. File bị ghim → G3.
- [x] **A3.** Xoá `.cam-nang-status` (`css/styles.css:5465-5469`) và khối `.detail-score` đầu (`:865-868`); `node scripts/design-tokens.mjs --check` pass.

### M. MCP / Vision Worker
- [x] **M1.** `LegacyDomainAdapter` chỉ còn `findSimilarTeams`, `recommendTeams` (`legacy-domain-adapter.ts:373-422,424-566`), bỏ import `js/*` không còn dùng. Thay test ghim danh sách method (`legacy-domain-adapter.test.ts:40-58`) bằng test hành vi của hai method (đội tương tự trả đúng đội có sẵn; gợi ý đội tôn trọng kho). Bao đóng import đổi → cập nhật `semanticFiles` đúng như generator in ra (`generate-workflow-build.ts:161-164`) → G8.
- [x] **M2.** Xoá `LOOKUP_SIDECAR_FILES`, `ReleasePointer`, `UnresolvedObservation`, `ConfirmationDecision`, `RecommendationResult`, `ResultPage`, `DomainError`; hàm chỉ test dùng: `requiresConfirmation` (tautology, xoá cả test), `applyConfirmedCorrections`, `fromScrubSafeDigest`, `createHeroSlot`, `parseBrowserScanConfirmation`, `parseConfirmationBinding`, `parseRosterSnapshot`; trường `AuthenticatedBearer.slot` (`bearer-auth.ts:31,144`). `npm --prefix mcp-worker run test:coverage` giữ ngưỡng 80/70 (`docs/code-standards.md:113`).
- [x] **M3.** Vision Worker: xoá `parseAndValidate` (`schema.ts:162`, test `schema.test.ts:70-72` chuyển sang `parseAndValidateByMode`), `AnalyzeResult.raw` (`:16`), `GuardOk.bytes` (`guard.ts:12,61`). `worker/src/schema.ts` bị ghim (tuple `translate` `Team ${i + 1}` giữ nguyên) → G3.

### P. Pipeline
- [x] **P1.** `sgsdeck_recommended.py`: xoá `build_recommended_evidence` (`:284`), `main()` và CLI, test tương ứng trong `tests/test_sgsdeck_recommended.py`, file `pipeline/sgsdeck-recommended-evidence.json`; giữ `parse_*`.
- [x] **P2.** `unified_lookup_identity.py`: xoá `build_registry` (`:322`) và `allocate_child_ids` (`:283`) + ca test `tests/test_unified_lookup_identity.py:11,191`. `site_localization.py`: xoá `check_data_candidate` (`:2035`), `compile_data_candidate` (`:2013`; test gọi `compile_candidate(root, out, stage="data")`), `LEDGER_PATH` (`:44`); `ui_source_locations` (`:1630`) nhận đường ledger từ `policy["artifacts"]["ledger"]` như `:1888,1909`. `parse_team_intro.py:23` xoá `EXPECTED_COUNTS`. `hanviet.py` xoá `STAT_MAP` (`:103`), `stat_focus_vn` (`:169`) + `tests/test_hanviet.py:48-56`.
- [x] **P3.** Output reviewer mồ côi: liệt kê lại bằng `python3 -c "import json,os;r=json.load(open('pipeline/site-translation-reviews.json'));u={b['outputPath'] for b in r['batches']};print(sorted({'pipeline/localization-reviews/'+f for f in os.listdir('pipeline/localization-reviews')}-u))"` (sau bước J3; hiện 15 file) → `git rm`. Lịch sử git giữ bằng chứng; validator chỉ đọc `batch.outputPath`.

### D. Docs
- [x] **D1.** `docs/codebase-summary.md`: bỏ dòng `team-pk/meta-cu` (`:37`), `hero-list/hero-detail/tactics` (`:39`), dòng comment `50 team` (`:107`); thay bằng `js/unified-lookup.js`, `js/lookup-data.js`, `js/lookup-detail.js`; `:11,30` mô tả Landing + 8 trang mục; `:36,38` mô tả đúng `team-filter-section.js`, `render.js`, `filters.js`. `docs/system-architecture.md:102` `filters.js` = chuẩn hoá chữ + blob tìm kiếm dùng chung với MCP. Comment `render.js:53`, `filters.js:1`, đầu `team-filter-section.js`.
- [x] **D2.** G0–G8 một lần cho phase (`policyVersion` `site-vi-2609xx-xoa-code-chet`); changelog; `reports/phase-04.md` ghi danh sách đã xoá và những gì giữ lại vì còn consumer.

## Verification
- `rg -n "team-pk|meta-cu|hero-list|hero-detail|recommended-reference-data|createTeamFilterSection|createSeasonTeamSection" js src scripts tests-js tests-e2e mcp-worker/src` → chỉ còn bảng chuyển hash cũ `js/legacy-routes.js` và test chuyển hash (`#team-pk`, `#meta-cu` là URL cũ hợp lệ).
- `npm run build` rồi `ls dist/js | grep -E "team-pk|meta-cu|tactics|hero-list|hero-detail"` → rỗng.
- `npm run check && npm run build && npm run verify && npm run test:dist && npm run test:node && npm run test:e2e && python3 -m unittest discover -s tests` → pass.
- `(cd worker && npm test && npm run typecheck)`, `(cd mcp-worker && npm run check)` → pass (coverage giữ ngưỡng).
- `python3 -m pipeline.site_localization check --root . --stage public` → exit 0; `python3 -m pipeline.team_route_handles --check` → pass.
