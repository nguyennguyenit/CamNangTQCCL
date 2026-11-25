# Scout: bản đồ code Đội khác (origin/main 54163452, 2026-11-20)

Đọc qua `git show`/grep, không chạy build. Số liệu đếm từ `other-teams.json` của generation `0386fde1`.

## Danh sách `/doi-khac/`
- `src/pages/doi-khac/index.astro` → `SectionPage` (`src/components/pages/SectionPage.astro:13,36-40`); bản `/zh/`, `/ja/` riêng.
- SSR: `src/lib/team-section-ssr.js:48-61` `recommendedSectionTrees` (family `other`, 60 đội đầu `:57`), `:145` SECTION_PATHS.
- Client: `js/app.js:45-46,447,525-526`; dữ liệu `other-teams.json` qua `js/recommended-reference-state.js:339-341`.
- Lọc/sắp: `js/recommended-reference-state.js:165-175` (`referenceSectionState('other')`), `:183-184` `isRecommendedOtherRow`, `:268-283` `fixedRank` (đề cử trước, tie-break hash `legacyVariantId`).
- Thẻ/bảng/bộ lọc: `js/team-filter-section.js:262` `createRecommendedSection`, `:175` PRIMARY_FACETS, `:232-251` nhãn mùa tĩnh, `:552` "Mỗi lượt hiện 60 đội", `:560-566` nhóm theo tier. Chế độ xem `js/team-view.js`.
- Nhãn Đề cử: `js/recommended-reference-render.js:216-217`, `:1034`.

## Trang chi tiết `/doi-khac/<handle>/`
- `src/pages/doi-khac/[team].astro` → `legacyDetailPaths` (`src/lib/team-detail-pages.ts:374-415`) → `LegacyDetail.astro`. Một trang mỗi đội gốc (`legacyTeamId`), không theo biến thể.
- Catalog route: `src/lib/team-detail-routes.ts:47-61,90,122-184,220-240,342-389,395`.
- Handle `pipeline/team-route-handles.json` family `legacy` (443, key legacyTeamId), đóng băng; `generationId` + `legacyTeamsSha256` phải khớp.
- SSR `src/lib/team-ssr.ts:144-149,187-199,223-233`; `?variant=` `js/team-detail.js:103-106,155-182,205-206`.
- Điều hướng `js/team-detail-navigation.js:113,130-133,455`; alias `js/legacy-routes.js:18-20`.
- Sitemap `src/pages/sitemap.xml.ts:18,173-180`; llms `src/lib/llms-documents.ts:106-111,165`.

## Pipeline
- `pipeline/recommended_team_dedup.py:20-31` dedup key = 3 hero identity + tactic identity (không có unit, binh thư); `:34-62` classify; `:131-145` gộp trùng nội bộ; `:147-227` ledger (`legacyVariantId` = "v-"+sha(id+holders) `:172`, `recommended` `:199`, sort `:219`).
- `pipeline/build_recommended_reference.py:398-414` validate other; `:441-465` ghi `other-teams.json` (record nguyên từ ledger); `:801-838` `otherTeams = ledger["admitted"]`.
- Record fields: classification, dedupKeyVersion, faction, historicalRankings, historicalTier, holders[], legacyContent, legacyContentSha256, legacyTeamId, legacyVariantId, name, nickname, origin, recommended, seasonAttribution, source, sourceLabel, sourceSeasonIds, sourceState, unit.
- Locator `(legacyTeamId, legacyVariantId)` bắt buộc khớp ở `pipeline/hero_summaries.py:284,325`, `pipeline/tactic_summaries.py:224`.

## Nơi khác dùng Đội khác
- `js/hero-summaries.js`, `js/tactic-summaries.js` (locator); `js/my-teams-sources.js:369-389`, `js/my-teams-links.js:37`, `js/my-teams-save-button.js` (key `variantKey`); `js/lookup-tactic-profile.js:45`; `js/analyze.js:1127,1386`, `js/analyze-map.js:402`; `src/components/landing/Landing.astro:86` (đếm).
- MCP: `mcp-worker/src/data/publication-builder.ts:98,126,146,194,523-602`; `mcp-worker/src/research/team-handlers.ts:46,55,175,252,938`; `catalog-handlers.ts:125`. Merge vào main tự release MCP.
- Không dùng: `js/team-recommend-engine.js`, `js/roster-season-candidates.js` (đọc `data/teams.json`).

## Test
- `package.json`: `test:node`, `test:dist`, `test:e2e`, `build`/`check` chạy `site_localization check --stage public`, `verify`.
- JS: `tests-js/doi-khac-single-season.test.mjs`, `recommended-reference-state.test.mjs`, `recommended-reference-artifacts.test.mjs`, `team-section-ssr.test.mjs`, `team-detail-routes.test.mjs`, `team-detail-navigation.test.mjs`, `team-view-trees.test.mjs`.
- E2E: `tests-e2e/doi-khac-single-season.spec.mjs`, `team-detail-pages.spec.mjs`, `team-ssr-parity.spec.mjs`, `team-ssr-nojs.spec.mjs`, `team-ssr-detail-states.spec.mjs`, `site-localization.spec.mjs`.
- Python: `tests/test_recommended_team_dedup.py`, `test_build_recommended_reference.py`, `test_hero_summaries.py`, `test_tactic_summaries.py`, `test_site_localization.py`.
- MCP: `mcp-worker/test/research/team-tools.test.ts`, `team-section-build.test.ts`, `recommend-teams.test.ts`, `recommend-web-parity.test.ts`.

## Docs
- `README.md:9,12,14,162,167`; `docs/design-guidelines.md:28-29,53,77,82`; `docs/code-standards.md:25,41,44,49,74,81`; `docs/codebase-summary.md:83`; `docs/deployment-guide.md:111,146,364-366`; mockup `docs/design/so-binh-phap/project/DoiKhac*.dc.html`.

## Điểm dễ vỡ
- `legacyVariantId` là khóa của `?variant=`, Đội của tôi, MCP selector, locator summaries: không được đổi.
- Handle legacy đóng băng theo `legacyTeamId`; đổi generation phải `team_route_handles --rebind`.
- `pipeline/site-localization-policy.json` ghim hash `src/pages/doi-khac/*.astro` (`:828-829`) và `js/*`; chuỗi UI mới cần batch review (`pipeline/localization-reviews/`, `pipeline/site-translation-reviews.json`), mẫu `doi-khac-261117-*`.
