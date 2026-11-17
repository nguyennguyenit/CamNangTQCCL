# Scout: kiến trúc Tra cứu (2026-11-17)

Mục đích: tìm các chỗ phải sửa khi thêm nhóm Tra cứu thứ 8 (Kỳ lược). Chỉ đọc code, không sửa gì.

## Nhóm hiện có được dựng thế nào
- Commit mẫu:
  - `4759dde`: khung nhóm.
  - `d62a882`: dữ liệu client cho troopMods, buildings, advisors, equipment.
  - `f015627`: UI dạng danh sách và trang chi tiết.
  - `27cb923`: nhãn i18n.
- Input: các file `pipeline/lookup-client-*.json`, `pipeline/lookup-identity.json`, `pipeline/lookup-translations.json`, `pipeline/lookup-route-handles.json`.
- Builder: `pipeline/build_unified_lookup.py`.
  - Các bước áp dữ liệu client: `_apply_client_troop_mods` (l.1397), `_apply_zh_texts` (l.1503), `_apply_client_catalog` (l.1561).
  - Dựng và kiểm: `_build_model` (l.1626), `_validate_payloads` (l.1975), `build_candidate` (l.2341), `validate_candidate` (l.2413).
  - Catalog chỉ nhận đúng 6 khóa, kiểm ở l.1981.
- Slug: `pipeline/lookup_route_handles.py:110`. Tệp `public/_redirects` do script sinh, không sửa tay.
- Hằng số và kiểm tra bên JS:
  - `js/lookup-ids.js`: `LOOKUP_GROUP_SLUGS` (l.265), `GROUP_BY_KIND`, `lookupItemPath` (l.342), `lookupHref` (l.348).
  - `js/unified-lookup.js`: `LOOKUP_GROUPS` (l.15), `EMPTY_CATALOG` (l.125).
  - `js/lookup-data.js`: danh sách khóa catalog (l.170).
- Trang Astro:
  - Route: `src/pages/tra-cuu/[group].astro`, `[group]/[slug].astro`, `src/pages/zh/tra-cuu/[group].astro`.
  - Lib: `src/lib/lookup-pages.ts`, `lookup-item-pages.ts`, `lookup-detail-routes.ts`.
  - Component: `LookupGroupPage.astro`, `LookupItemPage.astro`.
  - Client: `js/lookup-master.js`.
- SEO và feed: `src/pages/sitemap.xml.ts:29`, `src/lib/llms-documents.ts:130`, `src/lib/structured-data.ts`.
- MCP:
  - `mcp-worker/src/data/publication-builder.ts` liệt kê cứng khóa catalog (l.250, l.303, l.314).
  - `mcp-worker/src/research/catalog-handlers.ts:13` giữ `SEARCH_KINDS`.

## Mùa
Tra cứu không có bộ lọc theo mùa. Thông tin mùa nằm trong `lookup.conditions` (kind `season`, gồm `textVi` và `textZh`). Xem `_conditions` (l.251) và `heroNotes`/`tacticNotes`.

## Bản zh
- `zhTexts` và `zhEffects` đều kèm `viSha256`. Khi chữ Việt đổi thì build dừng.
- Nguồn chữ Hán: `source` (chỉ host trong allowlist), `capture` hoặc `translation`.
- Allowlist: `ZH_SOURCE_HOSTS = {sanzhan.slgsim.com, forum.gamer.com.tw}` (l.68).
- Bản dịch được gắn cờ "dịch từ tiếng Việt". Cờ này không đưa vào meta.

## Test
- Python: `python3 -m unittest discover -s tests`. Các file: `test_build_unified_lookup.py`, `test_lookup_route_handles.py`.
- JS: `npm run test:node`. Các file: `lookup-ids`, `lookup-data`, `lookup-master`, `unified-lookup`. Fixture: `tests-js/fixtures/lookup-bundle-fixtures.mjs`.
- Kiểm site đã dựng: `npm run test:dist`, file `astro-dist-contract.test.mjs` (bảng slug ở l.138).
- E2E: `unified-lookup.spec.mjs`, `lookup-item-pages.spec.mjs`, `zh-locale.spec.mjs:88`.
- Kiểm tổng: `npm run verify`.

## Link sâu
- Có hai dạng link: trang riêng `/tra-cuu/<nhóm>/<slug>/` và `?id=`. `lookupHref` ưu tiên trang riêng.
- Đội chuẩn hiện chỉ link tới tactic và book (`src/lib/team-detail-pages.ts:94`, `js/recommended-reference-render.js:169`).
