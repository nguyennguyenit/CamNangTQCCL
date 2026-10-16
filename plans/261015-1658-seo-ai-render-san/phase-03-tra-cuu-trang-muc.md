---
phase: 3
title: "Tra cứu đủ mục, hồ sơ view-tree, ledger slug, trang mục (#7)"
status: completed
depends_on: [2]
---

# Phase 3 — Tra cứu đủ mục và trang riêng từng mục

## Mục tiêu
- A. `/tra-cuu/<nhóm>/` (vi + zh) render đủ mục lúc build: tuong 202, chien-phap 406, trang-bi 114, binh-thu 68, quan-su 39, cong-trinh 41, cai-tao-binh-chung 16. "Xem thêm" và lọc chỉ ẩn/hiện ở client (`js/lookup-page.js`), không quyết định mục nào có trong HTML.
- B1. Ledger slug đóng băng: `pipeline/lookup_route_handles.py` + `pipeline/lookup-route-handles.json` theo mẫu `pipeline/team_route_handles.py` / `team-route-handles.json` (slug từ `lookupSlug` của `js/lookup-ids.js:7-12` trên tên Việt, bỏ tiền tố `hero:`…; trùng → hậu tố; `--check` không bao giờ tính lại; mục mới được cấp thêm; pin như ledger đội). Loader TS kiểu `src/lib/team-detail-routes.ts` (sha256, đúng tập khoá = corpus id).
- B2. Hồ sơ tướng/chiến pháp/binh thư (`js/lookup-profile.js`, `js/lookup-tactic-profile.js`, DOM-only) port sang cây view như `masterDetailTree` (`js/lookup-master.js:713`); dialog client dùng `treeToDom`, DOM không đổi.
- B3. Route `src/pages/tra-cuu/[group]/[slug].astro` + `src/pages/zh/tra-cuu/[group]/[slug].astro`: 886 × 2 trang, hồ sơ đầy đủ dựng sẵn, `<title>`/meta description duy nhất, canonical, hreflang vi/zh. Thẻ ở trang nhóm là `<a href="/tra-cuu/<nhóm>/<slug>/">`, click thường vẫn mở dialog (giữ `?id=` deep-link hiện có: `js/lookup-ids.js:112-115`, `js/lookup-page.js`).
- Sitemap thêm 1772 URL → 4912; `verify-astro-dist.mjs` allowlist/catalog + `astro-dist-contract` (3140 → 4912) + fixture.
- Localization: đăng ký file/literal mới; `site_localization check --stage public` xanh.

## TDD
### 3.T (đỏ trước)
- Dist contract: mỗi trang nhóm có đúng số `data-lookup-id` = tổng nhóm (vi + zh); trang mục mẫu mỗi nhóm có tên + trường hồ sơ chính lấy từ corpus (vd tướng: chiến pháp tự mang; chiến pháp: hiệu quả); sitemap 4912.
- Python test ledger (`tests/test_lookup_route_handles.py`): cấp slug ổn định, trùng → hậu tố, `--check` báo lỗi khi corpus có id mới chưa cấp / ledger bị sửa tay, không đổi slug đã cấp khi tên đổi.
- e2e hiện có của Tra cứu (tìm, lọc, "Xem thêm", dialog, Back/focus) xanh trước và sau; thêm ca: thẻ là link tới trang riêng, click thường mở dialog, mở trang riêng không JS thấy hồ sơ.
- Characterization DOM hồ sơ (throwaway, như Phase 1) trước khi port B2.

### 3.V
`npm run build`, `verify`, `test:dist`, `test:node`, `python3 -m unittest` (thư mục `tests/`), e2e toàn bộ. Ghi `reports/phase-03.md` (lệnh, đỏ→xanh, kích thước trang nhóm lớn nhất, thời gian build).

## Xong khi
- [x] Trang nhóm đủ mục ×2.
- [x] Ledger + `--check` + test.
- [x] 1772 trang mục dựng sẵn hồ sơ, meta/canonical/hreflang đúng.
- [x] Sitemap 4912; mọi gate xanh.
