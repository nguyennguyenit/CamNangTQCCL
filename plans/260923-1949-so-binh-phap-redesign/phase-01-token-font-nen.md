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
- Create: `scripts/design-compare.mjs`.
- Modify: `.gitignore` — thêm `.cache/`.
- Modify: `docs/design/so-binh-phap/README.md` — bảng token.
- Modify: `pipeline/site-localization-policy.json` — hash mới của 2 file `.astro` (không đổi chữ).

## Tasks & Steps
1. **Bảng token** (README design + khối `:root` / `:root[data-theme="dark"]`). Giữ tên biến đang dùng để khỏi đổi hàng loạt: Giấy → `--bg`, Thẻ → `--panel`, Giấy đậm → `--panel-2`, Mực → `--ink`, Chữ phụ → `--muted`, Viền → `--line`, Son → `--accent`, Son nhạt → `--accent-soft`, phe → `--f-nguy/--f-thuc/--f-ngo/--f-quan/--f-honhop`. Thêm: `--band` (Dải header `#1C1A17` / `#0F0E0B`), `--band-ink`, `--band-muted`, `--ink-2` (`#3A352D`), `--line-2` (`#E6DECF`), `--accent-ink` (chữ son trên nền sáng `#8E1B24`), `--font-sans`, `--font-serif`, `--font-cjk` (`'Songti TC','Noto Serif CJK TC',serif`), thang chữ (48–64 tiêu đề trang, 21–26 tên đội, 15 thân, 11 nhãn caps), radius (6/10/12/14/16/999), bóng. Giá trị lấy nguyên từ `StyleGuide.dc.html` `renderVals()` và inline style các artboard; giá trị nào không có trong StyleGuide ghi nguồn artboard trong bảng.
2. Thay 39 mã hex ngoài khối token (`css/styles.css:134,164-170,218-225,241-243,257,323,361,861`…) bằng token. Tiêu chí: `grep -nE '#[0-9A-Fa-f]{3,8}\b' css/styles.css` chỉ còn trong khối token.
3. **Font.** Lấy file woff2 từ Google Fonts CSS2 API (User-Agent trình duyệt hiện đại), giữ đúng `unicode-range` của 3 subset; viết `@font-face` với `font-display: swap`. `--font-sans: 'Be Vietnam Pro', system-ui, sans-serif`; `--font-serif: 'Noto Serif Display', Georgia, serif`. Ghi tổng dung lượng vào báo cáo (mục tiêu 150–250 KB). `OFL.txt` chứa bản quyền + giấy phép của cả hai font.
4. **Ấn 兵:** trích outline glyph 兵 từ Noto Serif TC Bold bằng fontTools (một lần, không commit font CJK), lưu path vào component dùng ở Phase 3; ghi lệnh trích vào README design.
5. **Component nền** theo StyleGuide "Thành phần": badge phe (ô 8px `aria-hidden` + chữ), badge loại binh, nút chiến pháp (tìm), nút khắc chế, chip lọc tắt/bật (`aria-pressed`, min-height 44px trên mobile theo §11.4), nút chính / phụ / chữ, số điểm serif màu son, thẻ, focus-visible. Đặt tên class theo quy ước hiện có; **không đổi** các class test đang bắt: `.nav-tab .section .active .open .reference-team-card .reference-holder .reference-detail-holder .reference-score .team-name .scope-note .fchip .fgroup .empty .counters .ana-link-btn .reference-alternatives .detail-score .main-holder .kh-card .kh-build .kh-season-context .kh-guide .kh-guide-details .kh-opening-note .kh-build-note .kh-commander .hero .kh-note .lookup-chip .lookup-card .lookup-backdrop .clear-btn .badge.tier .coexist-subteam .team-card .stats .error .roster-results .roster-review-panel` (nguồn: `tests-e2e/*`, `tests-js/frontend-shell-contract-assertions.mjs:37-38`).
6. **Asset contract:** `_headers` thêm `/fonts/*` cùng chính sách revalidate như `/css/*` (`public/_headers:19-29`); verifier so khớp chính xác danh sách `public/fonts/` với `dist/fonts/` từng byte; cập nhật `expectedRules`/`publicPaths` và fixture dist tạm (`tests-js/astro-dist-contract.test.mjs:420-426,483-490,723-730`).
7. **`scripts/design-compare.mjs`:** bảng cặp `{phase, artboard, path, width, setup?}`; chạy với `--base` (mặc định `http://127.0.0.1:4321` của `npm run preview`) và `--phase NN`; chụp localhost ở đúng `w` của artboard (fullPage, DPR 1), dựng trang HTML tạm đặt `screens/<Artboard>.png` cạnh ảnh localhost có nhãn, chụp ra `.cache/design-compare/phase-NN/<Artboard>.png`. `setup` là danh sách thao tác (click selector) cho artboard ở trạng thái mở (MobileFilters, LandingMenu, LandingMenuMobile, LookupProfile). Phase 1 chưa có cặp nào (StyleGuide được soát bằng bảng token ở bước 1); mỗi phase sau thêm cặp của mình vào bảng.
8. Refresh hash `SiteLayout.astro`, `index.astro` trong policy; chạy gate.

## Verification
- `grep -nE '#[0-9A-Fa-f]{3,8}\b' css/styles.css` → chỉ dòng thuộc khối token.
- `npm run build && npm run verify && npm run test:dist && node --test tests-js/runtime-asset-contract.test.mjs`
- `python3 -m pipeline.site_localization check --root . --stage public`
- `npm run test:e2e` (CSS đổi có thể ảnh hưởng hiển thị).
- Trình duyệt: DevTools Network thấy chỉ tải woff2 từ `/fonts/`, không request `fonts.googleapis.com`; chữ tiếng Việt có dấu hiển thị đúng font (kiểm "Đội chuẩn", "Thục", "Nguỵ").
- Script tương phản (tạm) đọc token → khớp §11.5.
