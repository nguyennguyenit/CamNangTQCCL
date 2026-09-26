# Phase 4 — Xoá code chết (2026-09-27)

Chia hai phần chạy tuần tự: 4a (JavaScript, Astro/CSS, docs đi cùng) và 4b (MCP/Worker, pipeline, output reviewer mồ côi). Mỗi phần tự chạy G0–G8 và gate A2 rồi commit. Phase xoá code chết được miễn test-first; trước mỗi lần xoá đã grep lại consumer trên `js/ src/ scripts/ tests-js/ tests-e2e/ mcp-worker/src/ mcp-worker/scripts/ worker/src/ pipeline/`.

## Part 4a — JavaScript, Astro, CSS

### Đã xoá
| Mục | Finding | Nội dung | Test đi cùng |
|---|---|---|---|
| J1 | ReviewJsCore#2, ReviewAstroCss#1, ReviewJsTools#18 | `js/team-pk.js`, `js/meta-cu.js`, `js/tactics.js`, `js/hero-list.js`, `js/hero-detail.js` + 5 entry manifest | xoá `hero-list.test.mjs`, `hero-detail.test.mjs`; `tactics-data.test.mjs` bỏ import `tacticDescriptions` và ca của nó (các ca kiểm dữ liệu giữ nguyên); `astro-dist-contract.test.mjs` bỏ `hero-list`, `tactics` khỏi danh sách module runtime (`tactics` dạng data vẫn giữ) |
| J1 (thêm) | ReviewJsCore#7 | `js/derive-team-faction.js` + entry manifest: consumer duy nhất còn lại là khối dựng hàng chết của `app.js` (J4) và `team-pk.js` | xoá `derive-team-faction.test.mjs` |
| J2 | ReviewJsCore#3, ReviewAstroCss#2 | `team-filter-section.js`: `facetCount`, `createTeamFilterSection`, `createSeasonTeamSection`, `replaceFilterButtons`; `render.js`: `teamCard`, `seasonTeamCard`, `coexistGroup`, `STATUS_LABEL`, `statusBadge`, `recommendBadge`, `tierBadge`, `variantTags`, `heroRow`, `counterChips`, và `bestTier`/`tierClass` (hết importer sau J4); `filters.js`: `applyFilters`, `emptyState`, `matchSet`; `season-ui-state.js`: `validateTeamFilters`, `filterSeasonRows`, `rowFacet` (`QUERY_FILTERS` còn dùng trong `readSeasonQuery` nên giữ, chỉ bỏ `export`) | xoá `team-tier-badge.test.mjs` (chỉ phủ `bestTier`/`tierClass`); `filters.test.mjs` bỏ ca `applyFilters`, hai ca tìm theo phương án thay thế và tên/biệt danh viết lại trên `teamSearchBlob`; `season-ui-state.test.mjs` bỏ phần `validateTeamFilters`/`filterSeasonRows`, giữ ca `updateSeasonURL` |
| J2 (CSS) | ReviewAstroCss#16 | quét class CSS so với `js/ src/` trước/sau xoá: `.card-head`, `.head-right`, `.tag.t-book`, `.fchip.recommend`, `.tac-card`, `.tac-search`, `.combo-input`, `.team-filter-bar select`, `.flabel-inline`; `docs/design/so-binh-phap/tokens.json` bỏ cùng selector | quét lại: 0 class mất tham chiếu |
| J3 | — | tuple `translate` `ui:season/tier-sort`, `ui:season/tier-label` (+ 2 mục ledger, 2 item của batch `site-review-v5-094`; file output reviewer giữ nguyên); owner `data/coexist.json` → `js/render.js::seasonCoexistGroup` | số ghim `tests/test_site_localization.py` |
| J4 | ReviewJsCore#7 (phần chết), #11 | `app.js`: `sections['team-pk'/'meta-cu']?.update`, `queryForSection`, các trường hàng chỉ hai lời gọi đó đọc (`legacyRankings`, `legacyTier`, `contextLabel`, `sourceScore`, bản sao `team` có phe suy ra), `tierIndex`, import `bestTier`/`resolveSelectionScore`/`defaultSeasonSelection`/`assignDerivedFactions`, `lookupUI`; catch khởi động thêm `console.error(err)` (giữ nguyên `displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")`, `title:'Đội chuẩn'`/`'Đội khác'`). `season-context.js`: `validateRegistry` bỏ tham số `data` | — |
| J5 | ReviewJsCore#12, ReviewJsTools#20 | bỏ `export` của 5 hằng `detail-actions.js` (`SOURCE_LINK_LABEL = 'Xem nguồn'` giữ nguyên); xoá `clearReturnSnapshot`, `resolveTeamDestination`, `loadVerifiedLegacyTeam`, `lockedConstraints`, `heroIdentityKey`, `LOOKUP_PAYLOAD_NAMES` | bỏ ca/assertion ghim chúng trong `team-detail-navigation`, `recommended-reference-state`, `roster-scan-state`, `hero-identity` test |
| J6 | ReviewJsTools#21 | engine bỏ `presetId`, `presetReason`, `coexistSetBonus`, `score`, `baseScore` (chỉ `score` đọc) và hai phần tử luôn 0 của `rankingTuple` (`redTotal` đọc `rankingTuple[1]`) | xoá ca "result includes preset slots…" (ghim hằng mặc định) |
| J7 | ReviewJsTools#22, #23 | `analyze.js`: comment tab cũ + chặn paste theo `.active` (mount luôn `section active`); `unified-lookup.js`: nhãn `food`, `UNKNOWN_COST_KEYS`, nhánh cảnh báo; `recommended-reference-render.js`: `if (!value) continue` | `unified-lookup.test` ca chi phí bỏ phần khoá lạ/cảnh báo |
| A1 | ReviewAstroCss#10 | `src/lib/recommended-reference-data.mjs` | — |
| A2 | ReviewAstroCss#15 | `findAdmittedVariant`, `teamDetailHtmlPaths` | `team-detail-routes.test`: bỏ hai assertion so `catalog.htmlPaths` với chính nó; ca biến thể kiểm trực tiếp `catalog.variants` (đúng hai cặp đã nhận, không cặp chéo) |
| A3 | ReviewAstroCss#16 | `.cam-nang-status`, khối `.detail-score` đầu; `node scripts/design-tokens.mjs --check` ok | — |
| D1 | ReviewJsCore#15 (phần module), ReviewJsTools#19 (phần module), ReviewAstroCss#9 | `docs/codebase-summary.md` (cây `src/pages`, bảng module: Landing + 8 trang mục, `team-filter-section.js`, `render.js`, `filters.js`, `unified-lookup.js`/`lookup-data.js`/`lookup-detail.js`; bỏ dòng `team-pk/meta-cu`, `hero-list/hero-detail/tactics`, ghi chú `50 team`); `docs/system-architecture.md` (`filters.js` = chuẩn hoá chữ + blob tìm kiếm dùng chung với MCP; đoạn `team-filter-section.js`); comment đầu `team-filter-section.js`, `filters.js:1`, comment `SOURCE_LABEL` của `render.js` (comment `STATUS_LABEL` đi cùng hằng) | — |

### Giữ lại vì còn consumer
- `normalizeText`, `teamSearchBlob` (`js/filters.js`): `mcp-worker/src/research/research-handlers.ts`, `data/entity-identity.ts`, `data/snapshot-index.ts`, `domain/legacy-domain-adapter.ts`, và `season-ui-state.js`/`render.js`.
- `UNIT_CLASS` (`js/render.js`): thẻ và bảng Khai hoang (`khaihoangConfigRow`, badge loại binh).
- `FACTION_CODE` (`js/render.js`): `team-filter-section.js`, `src/pages/index.astro`. `SOURCE_LABEL`: `team-filter-section.js`, `analyze.js`, `src/pages/doi-khac/[team].astro`.
- `QUERY_FILTERS` (`js/season-ui-state.js`): `readSeasonQuery` dùng; bỏ `export`.
- `loadVerifiedLegacyTeams` (số nhiều): trang chi tiết đội dùng.
- `.pre.sp`/`.pre.co`, `.hero-name`, `.hn`, `.counters`, `.tag`, `.t-tactic`, `.team-card`, `.units`: còn được `recommended-reference-render.js`, `unified-lookup.js`, `src/pages/index.astro` dựng.
- Phần "render một lần" của ReviewJsCore#7 (dựng hàng hai lần lúc boot, chỉ resolve một hàng khi có `config`) để Phase 5 như plan.

### G0: tuple của file sửa (trước khi sửa)
| File | Tuple | Ghi chú |
|---|---|---|
| `js/team-filter-section.js` | 31 (3 `translate`) | 2 `translate` thuộc `createSeasonTeamSection` bị bỏ (J3); `ui:recommended/introduction` giữ |
| `js/app.js` | 3 `translate` | giữ nguyên cả 3 |
| `js/render.js` | 48 `authored-vi` | không tuple nào thuộc hàm bị xoá |
| `js/analyze.js` | 29 (4 `translate`) | không đụng |
| `js/detail-actions.js` | 5 `authored-vi` | chữ giữ nguyên, chỉ bỏ `export` |
| `js/roster-scan-state.js` | 1 `translate` | không đụng |
| `js/unified-lookup.js` | 53 `authored-vi` | nhãn chi phí không có tuple |
| `js/recommended-reference-render.js` | 28 `authored-vi` | không đụng |
| `js/team-detail-navigation.js`, `js/recommended-reference-state.js`, `js/lookup-data.js`, `src/lib/team-detail-routes.ts` | 0 (file bị ghim) | hash cập nhật ở G3 |
| `js/filters.js`, `js/season-ui-state.js`, `js/season-context.js`, `js/hero-identity.js`, `js/team-recommend-engine.js`, `css/styles.css`, `src/lib/public-artifact-manifest.mjs`, 6 module bị xoá, `src/lib/recommended-reference-data.mjs` | 0 | không ghim |

### G1: tuple
- **Bỏ** 2 tuple `translate`: `ui:season/tier-sort` (`Theo tier`, `textVi` `Theo bậc`), `ui:season/tier-label` (`tier:'Tier'`); xoá 2 mục ledger `pipeline/site-translations.json` (ghi lại bằng `canonical_json_bytes`) và 2 item của batch `site-review-v5-094` trong `pipeline/site-translation-reviews.json` (`indent=2`, 102 → 100 item). File `pipeline/localization-reviews/site-review-v5-094.json` giữ nguyên.
- **Đổi owner** `DATA_INVENTORY_OWNERS["data/coexist.json"]` `js/render.js::coexistGroup` → `js/render.js::seasonCoexistGroup`.
- **Không** thêm hay đổi chữ tuple nào.

### Mốc
- `policyVersion`: `site-vi-260927-ui-ux-c` → `site-vi-260927-xoa-code-chet-a`.
- `baseline.notes`:
  - `concreteLocationCount` 56671 → 56669
  - `concreteInventorySha256` `6ba7478a…` → `abc4f153…`
  - `siteLedgerObligations` 2088 → 2086, `translationObligations` 5591 → 5589, `uiTranslateObligations` 68 → 66
- **Generation mới:** `8e1f02314463c81ac60b438c984779eec0f957fcef97255b97501ce38a6d16d3`.
  - G6: `git rm` generation `b3636bad…` do phần 3c tạo.
  - Generation `0cbb320b…` sinh ở lượt publish đầu của phần này, bị thay khi trả lại `UNIT_CLASS` cho `render.js` (lượt xoá đầu bỏ nhầm hằng mà thẻ Khai hoang còn dùng; gate A2 bắt được qua 24 ca e2e Khai hoang); đã xoá, chưa từng commit.
  - `pipeline/team-route-handles.json` đã re-pin; `--check` pass.
- **`WORKFLOW_BUILD_ID`:** `build:sha256b64:16lthgms6OS6yKbBUjEd-ca3F-XW76my0UXhZLYDCNE` → `build:sha256b64:lQ0YYP4AFveKhGRXcKAP0rZzMn-FXVyNMHoYALFHe_Q` (`js/filters.js`, `js/hero-identity.js`, `js/lookup-data.js`, `js/roster-scan-state.js`, `js/season-context.js`, `js/team-recommend-engine.js` thuộc bao đóng; bao đóng import không đổi nên `semanticFiles` giữ nguyên).
- **Số ghim `tests/test_site_localization.py`:** site obligation 2088 → 2086; `coverage.expected` 5591 → 5589, `coverage.missing` 121 → 119; `uiPending`/`uiValues` 68 → 66.

### Docs
- `docs/codebase-summary.md`, `docs/system-architecture.md` (D1 ở trên).
- `docs/design/so-binh-phap/tokens.json`: bỏ selector CSS đã xoá.
- `docs/project-changelog.md`: thêm mục phần 4a.

### Kiểm Verification của phase (phần JS)
- `rg -n "team-pk|meta-cu|hero-list|hero-detail|recommended-reference-data|createTeamFilterSection|createSeasonTeamSection" js src scripts tests-js tests-e2e mcp-worker/src`: chỉ còn `js/legacy-routes.js` và các test chuyển hash cũ (`legacy-routes.test`, `team-detail-navigation.test` `safeReturnUrl('/#team-pk')`, e2e `spa-parity`/`unified-lookup`/`recommended-browser`/`landing`). Test `updateSeasonURL` đổi hash mẫu `#meta-cu` → `#muc`.
- `npm run build` rồi `ls dist/js | grep -E "team-pk|meta-cu|tactics|hero-list|hero-detail|derive-team-faction"`: rỗng.

### Gate A2
Exit 0, 203 s.

| Bộ | Kết quả |
|---|---|
| `npm run verify` | `Verified 1725 dist files (52 raw assets, 16 static public files)` (6 module JS ít hơn Part 3c) |
| `npm run test:dist` | 29/29 |
| `npm run test:node` | 342/342 (bỏ test chỉ phủ code đã xoá) |
| `npm run test:e2e` | 317 passed |
| `python3 -m unittest discover -s tests` | 383 OK |
| `team_route_handles --check` | pass (generation `8e1f0231…`) |
| `worker` vitest | 6 file, 53 test |
| `mcp-worker` check | 43 file, 375 test |

Lượt gate đầu đỏ 24 ca e2e Khai hoang (`.kh-card` 0/17) vì `UNIT_CLASS` bị xoá cùng `teamCard` trong khi `khaihoangConfigRow`/badge loại binh còn dùng; đã trả lại hằng, publish lại và gate xanh.

## Part 4b — MCP, Vision Worker, pipeline

### Đã xoá
| Mục | Finding | Nội dung | Test đi cùng |
|---|---|---|---|
| M1 | ReviewWorkers#6 | `LegacyDomainAdapter` chỉ còn `findSimilarTeams` (`research-handlers.ts` `tqccl_match_team`) và `recommendTeams` (`recommendation-service.ts`); bỏ 15 method, validator/kiểu kết quả chỉ chúng dùng, import `js/filters.js`, `js/hanviet.js`, `js/match-dict.js`, `js/roster-scan-map.js`, `js/roster-scan-state.js` khỏi adapter. Bao đóng workflow bớt `js/roster-scan-map.js`, `js/roster-scan-state.js` → `semanticFiles` sửa đúng như generator in | `legacy-domain-adapter.test.ts` viết lại theo hành vi (6 ca): đọc đủ 3 tướng + 6 chiến pháp của `team-intro-0` → đội đầu là `team-intro-0` (`heroHit 3`, `tacticHit 6`, `total 3`), input không bị sửa; dưới `minHeroes` bị loại, nới `minHeroes` thì có; tướng đoán từ chân dung tính vào tổng nhưng không tính khớp; kho đủ tướng/chiến pháp của `team-intro-1` → được gợi ý, mọi chiến pháp chọn nằm trong kho; kho thiếu một tướng → không gợi ý; lỗi legacy bị che (`LegacyDomainAdapterError`, không lộ đường dẫn). Bỏ ca ghim danh sách method. `test/node-min-smoke.mjs` gọi `findSimilarTeams` thay `normalizeText` |
| M2 | ReviewWorkers#7 | `LOOKUP_SIDECAR_FILES`, `ReleasePointer`, `requiresConfirmation`, `applyConfirmedCorrections`, `fromScrubSafeDigest` (+ hằng `DIGEST_BYTE_LENGTH`, `BASE64URL_BODY_PATTERN`, kiểu `HexDigest` chỉ nó dùng), `AuthenticatedBearer.slot`. `contracts.ts`: `createHeroSlot`, `parseBrowserScanConfirmation`, `parseConfirmationBinding`, `parseRosterSnapshot`, `UnresolvedObservation`, `ConfirmationDecision`, `RecommendationResult`, `ResultPage`, `DomainError`; kéo theo helper/kiểu chỉ các hàm/kiểu đó dùng: `FORBIDDEN_FIELD_NAMES`, `record`, `array`, `string`, `prefixedString`, `optionalFiniteNumber`, `rejectForbiddenFields`, `assertExactKeys`, `parseHeroIdentity`, `parseProvenance`, `parseOwnedHero`, `parseOwnedTactic`, `canonicalIdArray`, `parseLockedTeam`, kiểu `HeroIdentity`, `HeroSlot`, `BrowserScanConfirmation`, `ProvenanceRef`, `OwnedHero`, `OwnedTactic`, `LockedTeam`, `RosterSnapshot`, `TierRanking`, `TacticSelection`, `TeamMatch`, `ConflictDiagnostic`, `ResultLimits`, `RecommendationRequest` (chỉ test kiểu dùng) | `contracts.test` còn `stableStringify` (thêm ca từ chối NaN/hàm); xoá tautology `requiresConfirmation`; ba ca sửa tay của `normalization-service.test` gửi lại quan sát cũ + sửa tay qua `normalizeObservations` (đúng đường production `research-handlers.ts`); `digest-encoding.test` kiểm giải mã base64url bằng `Buffer` thay round-trip qua hàm đã xoá, bỏ nhóm ca decode; `bearer-auth.test` kiểm fingerprint của token được chấp nhận thay `slot` |
| M3 | ReviewWorkers#8 | `parseAndValidate`, `AnalyzeResult.raw`, `GuardOk.bytes` | `schema.test` ca fence chuyển sang `parseAndValidateByMode("analyzeTeamImage", …)` |
| P1 | ReviewPipeline#8 | `build_recommended_evidence`, `main()`/CLI, import chỉ chúng dùng (`argparse`, `hashlib`, `json`, `os`, `tempfile`, `datetime`, `Path`); `pipeline/sgsdeck-recommended-evidence.json` | bỏ `_cache` và 2 ca builder trong `test_sgsdeck_recommended.py` |
| P2 | ReviewPipeline#9–12 | `unified_lookup_identity.py`: `build_registry`, `allocate_child_ids`, `_semantic_child_key` (chỉ allocate dùng). `site_localization.py`: `compile_data_candidate`, `check_data_candidate`, `LEDGER_PATH`; `ui_source_locations(root, ledger_relative, …)` và `concrete_site_locations(root, pack, ledger_relative)` nhận `policy["artifacts"]["ledger"]` từ hai caller. `parse_team_intro.py`: `EXPECTED_COUNTS`. `hanviet.py`: `STAT_MAP`, `stat_focus_vn`; comment `js/analyze-map.js` bỏ "mirror pipeline/hanviet.py STAT_MAP" | bỏ `test_child_ids_survive_reordering`, `StatFocusTest`; test `ui_source_locations` truyền đường ledger của policy; ca data stage gọi `compile_candidate(ROOT, out, stage="data")` |
| P3 | ReviewPipeline#13 | 15 file `pipeline/localization-reviews/site-review-{final-000,final-006,final-009,final-010,v5-016,v5-022,v5-026,v5-030,v5-031,v5-053,v5-055,v5-073,v5-081,v5-088,v5-089}.json` (lệnh P3 liệt kê lại sau J3, đúng 15) | — |

### Giữ lại vì còn consumer
- `join_recommended_evidence`, `parse_*`, `validate_source_url`, `RenderedPage`, `MAX_SOURCE_BYTES` (`sgsdeck_recommended.py`): `build_recommended_reference.py`, `crawl_sgsdeck_recommended.py`.
- `inventory_from_sources` (`unified_lookup_identity.py`): sau khi xoá `build_registry` chỉ test dùng để dựng inventory thật cho `validate_registry`; ngoài danh sách plan, giữ.
- `_variant`, `_name_variant`, `_canonical_id`, `NAMESPACES`, `VARIANTS`: `validate_registry` dùng.
- `LegacyDomainAdapterError`, `stableStringify`/`ContractValidationError`, `ConfirmationBinding`, `StructuredObservation`, `CanonicalEntity`, `ObservationEvidence`, kiểu id: còn caller trong `src/`.
- `js/roster-scan-map.js`, `js/roster-scan-state.js`: còn trình duyệt dùng (`roster-recommend-ui.js`, `team-view.js`, `render.js`, manifest), chỉ ra khỏi bao đóng MCP.
- `mcp-worker/test/research/season-bounds.test.ts` còn import `legacyDomainAdapter` không dùng (không thuộc phạm vi).
- `pipeline/lookup-output/site-vi-candidate/generation.json` ghi `executionHashes["unified_lookup_identity.py"]` cũ; thư mục không ai đọc và được untrack ở Phase 7.

### G0: tuple của file sửa (trước khi sửa)
| File | Tuple | Ghi chú |
|---|---|---|
| `worker/src/schema.ts` | 1 `translate` (`ui:worker/team-default`, `Team ${i + 1}`) | không đụng; hash cập nhật ở G3 |
| `js/analyze-map.js` | 0 (file bị ghim) | chỉ sửa comment; hash cập nhật ở G3 |
| `worker/src/guard.ts`, file MCP, file pipeline | 0, không ghim | — |

### G1
Không thêm, đổi hay bỏ tuple nào.

### Mốc
- `policyVersion`: `site-vi-260927-xoa-code-chet-a` → `site-vi-260927-xoa-code-chet-b`.
- `sourceFiles`: `js/analyze-map.js` `9613ccab…` → `f463c3ba…`; `worker/src/schema.ts` `c8455816…` → `1b454723…`.
- `baseline.notes` không đổi (56669 location, 2086 site obligation, 5589 obligation, 66 `translate` UI).
- **Generation mới:** `75a88d67c54fefb9f38599e4eb1014974d8f6484225f2a7c2b776d20951d0b5b`. G6: `git rm` generation `8e1f0231…` (phần 4a).
- `pipeline/team-route-handles.json` re-pin; `--check` pass.
- **`WORKFLOW_BUILD_ID`:** `build:sha256b64:lQ0YYP4AFveKhGRXcKAP0rZzMn-FXVyNMHoYALFHe_Q` → `build:sha256b64:DGo-uPzbFB4gYegvPeWq1Rlsi0Av1rTl1hz1XKdYkzM`; `semanticFiles` bớt `js/roster-scan-map.js`, `js/roster-scan-state.js`.
- Số ghim `tests/test_site_localization.py` không đổi.

### Docs
- `docs/project-changelog.md`: mục phần 4b. Không doc nào khác nhắc phần đã xoá (`docs/codebase-summary.md` mô tả `js/roster-scan-state.js` phía trình duyệt, vẫn đúng).

### Kiểm Verification của phase (phần 4b)
- `rg` chuỗi module cũ: vẫn chỉ `js/legacy-routes.js` và test chuyển hash cũ như phần 4a.
- `npm --prefix mcp-worker run test:coverage`: statements 93.25 %, branches 87.26 %, functions 99.07 %, lines 94.42 % (trước phần 4b: 91.19 / 85.85 / 95.82 / 92), trên ngưỡng 80/70.
- `python3 -m pipeline.site_localization check --root . --stage public`: exit 0 (`coverage.missing` 0, `uiPending` 66).

### Gate A2
Exit 0, 194 s.

| Bộ | Kết quả |
|---|---|
| `npm run verify` | `Verified 1725 dist files (52 raw assets, 16 static public files)` |
| `npm run test:dist` | 29/29 |
| `npm run test:node` | 342/342 |
| `npm run test:e2e` | 317 passed |
| `python3 -m unittest discover -s tests` | 377 OK (bỏ 6 ca chỉ phủ code đã xoá) |
| `team_route_handles --check` | pass (generation `75a88d67…`) |
| `worker` vitest | 6 file, 53 test; `typecheck` ok |
| `mcp-worker` check | 43 file, 336 test (bỏ ca ghim method/tautology/hàm đã xoá); workflow build, typecheck, build, `test:node-min`, `verify:control-plane` ok |

## Tổng kết phase 4
Hai commit (4a `8a2a021`, 4b). Toàn bộ finding của phase đã xoá theo contract: ReviewJsCore#2, #3, #7 (phần chết), #11, #12, #15 (phần module); ReviewJsTools#18–#23, #19 (phần module); ReviewAstroCss#1, #2, #9, #10, #15, #16; ReviewWorkers#6, #7, #8; ReviewPipeline#8–#13 (phần xoá của #12). Phần "render một lần" của ReviewJsCore#7 ở Phase 5; phần CLI/docs của `parse_coexist_csv` (#12) ở Phase 7.
