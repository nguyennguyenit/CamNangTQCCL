---
phase: 1
title: "Token, font, component nền, công cụ so ảnh"
status: pending
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Token, font, component nền, công cụ so ảnh

## Goal
Toàn site dùng bảng token sáng/tối, font self-host và các component nền của artboard StyleGuide; có công cụ chụp ảnh ghép để soát mọi phase sau.

## Contract
Brainstorm §5 #4 (font), §5 #5 (bảng tối), §11.1, §11.4 (ấn 兵, font CJK), §11.5 (tương phản), §11.6 (bảng token).

## Files to Create / Modify
- Modify: `css/styles.css` — viết lại khối token đầu file và thêm component nền (chưa đổi bố cục từng mục).
- Create: `public/fonts/*.woff2` (Be Vietnam Pro 400/500/600/700, Noto Serif Display 700; subset latin, latin-ext, vietnamese), `public/fonts/OFL.txt`.
- Modify: `public/_headers` (rule `/fonts/*`), `scripts/verify-astro-dist.mjs` (kiểm kê chính xác `public/fonts/`), `tests-js/pages-headers-contract.test.mjs`, `tests-js/astro-dist-contract.test.mjs` (fixture dist tạm).
- Modify: `src/layouts/SiteLayout.astro`, `src/pages/index.astro` — `<link rel="preload">` 2 font màn đầu (cả hai head, vì Phase 2 mới gộp).
- Create: `scripts/design-compare.mjs` (tái dùng phần khởi chạy Playwright/server của `scripts/design-capture.mjs` bằng import hoặc tách hàm chung, không chép).
- Modify: `.gitignore` — thêm `.cache/`.
- Modify: `docs/design/so-binh-phap/README.md` — bảng token + nguồn gốc asset (bước 3–4).
- Modify: `pipeline/site-localization-policy.json` (hash 2 file `.astro`, không đổi chữ) → theo plan.md "Quy trình bắt buộc mỗi phase" bước 2b–e: publish lại, generation mới dưới `src/data/recommended-reference/`, `data/website-display.json`, `pipeline/team-route-handles.json` (`generationId`).
- Create: `plans/260923-1949-so-binh-phap-redesign/reports/visual-phase-01.md` — báo cáo StyleGuide (bảng token so với `renderVals()` + kết quả tương phản), thay cho so ảnh (A1).

## Tasks & Steps
1. **Bảng token** (README design + khối `:root` / `:root[data-theme="dark"]`). Giữ tên biến đang dùng để khỏi đổi hàng loạt: Giấy → `--bg`, Thẻ → `--panel`, Giấy đậm → `--panel-2`, Mực → `--ink`, Chữ phụ → `--muted`, Viền → `--line`, Son → `--accent`, Son nhạt → `--accent-soft`, phe → `--f-nguy/--f-thuc/--f-ngo/--f-quan/--f-honhop`. Thêm: `--band` (Dải header `#1C1A17` / `#0F0E0B`), `--band-ink`, `--band-muted`, `--ink-2` (`#3A352D`), `--line-2` (`#E6DECF`), `--accent-ink` (chữ son trên nền sáng `#8E1B24`), `--font-sans`, `--font-serif`, `--font-cjk` (`'Songti TC','Noto Serif CJK TC',serif`), thang chữ (48–64 tiêu đề trang, 21–26 tên đội, 15 thân, 11 nhãn caps), radius (6/10/12/14/16/999), bóng. Giá trị lấy nguyên từ `StyleGuide.dc.html` `renderVals()` và inline style các artboard; giá trị nào không có trong StyleGuide ghi nguồn artboard trong bảng.
2. Thay mọi mã hex ngoài khối token (đếm 2026-09-25: 43 lần trên 38 dòng, vd `css/styles.css:134,164-170,218-225,241-243,257,323,361,861`) bằng token. Tiêu chí: `grep -nE '#[0-9A-Fa-f]{3,8}\b' css/styles.css` chỉ còn trong khối token.
3. **Font.** Lấy file woff2 từ Google Fonts CSS2 API (User-Agent trình duyệt hiện đại), giữ đúng `unicode-range` của 3 subset; viết `@font-face` với `font-display: swap`. `--font-sans: 'Be Vietnam Pro', system-ui, sans-serif`; `--font-serif: 'Noto Serif Display', Georgia, serif`. Mục tiêu 150–250 KB (red-team đo thử 2026-09-25: 15 file, 176.504 byte). `OFL.txt` chứa bản quyền + giấy phép của cả hai font. **Nguồn gốc:** ghi vào README design URL request CSS2, URL + SHA-256 từng woff2, ngày tải.
4. **Ấn 兵:** trích outline glyph 兵 từ Noto Serif TC Bold bằng fontTools (một lần, không commit font CJK), lưu path vào component dùng ở Phase 3. fontTools chưa cài (`python3 -c 'import fontTools'` lỗi) → cài phiên bản cố định trong venv tạm ngoài repo (`pip install fonttools==<bản cụ thể>`); ghi vào README design: lệnh trích, phiên bản fontTools, URL + SHA-256 file font nguồn.
5. **Component nền** theo StyleGuide "Thành phần": badge phe (ô 8px `aria-hidden` + chữ), badge loại binh, nút chiến pháp (tìm), nút khắc chế, chip lọc tắt/bật (`aria-pressed`, min-height 44px trên mobile theo §11.4), nút chính / phụ / chữ, số điểm serif màu son, thẻ, focus-visible. Đặt tên class theo quy ước hiện có; **không đổi** các class test/code đang bắt: `.nav-tab .section .active .open .reference-team-card .reference-holder .reference-detail-holder .reference-score .team-name .scope-note .fchip .fgroup .empty .counters .ana-link-btn .reference-alternatives .detail-score .main-holder .kh-card .kh-build .kh-season-context .kh-guide .kh-guide-details .kh-opening-note .kh-build-note .kh-commander .hero .kh-note .lookup-chip .lookup-card .lookup-backdrop .clear-btn .badge.tier .coexist-subteam .team-card .stats .error .roster-results .roster-review-panel .top-header .tagline` (nguồn: `tests-e2e/*`, `tests-js/frontend-shell-contract-assertions.mjs:37-38`; `.top-header` đo ở `js/app.js:224`, `season-lookup.spec.mjs:368`; `.tagline` ở `season-lookup.spec.mjs:49`).
5b. StyleGuide bản `1790191281-3a81` có thêm 2 mục đặc tả: **"Điều hướng & khung trang"** (header 72px, mục đang xem, menu thả: radius 14, bóng `0 24 60`, cách nút 6px, mục 15/600 + mô tả 12.5, mục đang trỏ nền son nhạt, link ngoài) và **"Nhập liệu & hiển thị dữ liệu"** (Thẻ/Bảng, ô tìm 48/radius 12, select 44 có nhãn caps…). Đưa mọi giá trị ở hai mục này vào bảng token/component ở bước 1 và 5; Phase 3 và Phase 5 dùng lại, không đo lại từ artboard trang.
6. **Asset contract:** `_headers` thêm `/fonts/*` cùng chính sách revalidate như `/css/*` (`public/_headers:19-29`); verifier so khớp chính xác danh sách `public/fonts/` với `dist/fonts/` từng byte; cập nhật `expectedRules`/`publicPaths` và fixture dist tạm (`tests-js/astro-dist-contract.test.mjs:420-426,483-490,723-730`).
7. **`scripts/design-compare.mjs`:** bảng cặp `{phase, artboard, path, width, setup?, clip?}`; cờ `--base` (mặc định `http://127.0.0.1:4321` của `npm run preview`), `--phase NN`, `--theme light|dark` (dark đặt `localStorage.theme='dark'` bằng init script trước khi tải). Chụp localhost ở đúng `w` của artboard (fullPage, DPR 1); `clip` `{y,height}` cắt cả hai ảnh (dùng cho header ở Phase 3); dựng trang HTML tạm đặt `screens/<Artboard>.png` cạnh ảnh localhost có nhãn, chụp ra `.cache/design-compare/phase-NN[-dark]/<Artboard>.png`. `setup` là danh sách thao tác (click selector) cho artboard ở trạng thái mở (MobileFilters, LandingMenu, LandingMenuMobile, LookupProfile). Phase 1 chưa có cặp nào (StyleGuide soát bằng `visual-phase-01.md`); mỗi phase sau thêm cặp của mình.
8. Refresh hash `SiteLayout.astro`, `index.astro` trong policy và chạy trọn plan.md "Quy trình bắt buộc mỗi phase" bước 2b–e (publish lại + re-pin); ghi generation mới vào báo cáo.

## Verification
- `grep -nE '#[0-9A-Fa-f]{3,8}\b' css/styles.css` → chỉ dòng thuộc khối token.
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3) + `node --test tests-js/runtime-asset-contract.test.mjs` + `python3 -m pipeline.team_route_handles --check`.
- Trình duyệt: DevTools Network thấy chỉ tải woff2 từ `/fonts/`, không request `fonts.googleapis.com`; chữ tiếng Việt có dấu hiển thị đúng font (kiểm "Đội chuẩn", "Thục", "Nguỵ").
- Script tương phản (tạm) đọc token → khớp §11.5; kết quả dán vào `reports/visual-phase-01.md`.
