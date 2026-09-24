---
phase: 3
title: "Header, menu thả, menu mobile, footer"
status: pending
priority: P1
effort: "2d"
dependencies: [2]
---

# Phase 3: Header, menu thả, menu mobile, footer

## Goal
Mọi trang có header và footer đúng artboard: header trang trong 1 hàng 72px, header Landing riêng, menu thả dùng được bằng bàn phím, menu mobile toàn màn hình, footer đầy đủ dùng chung.

## Contract
Brainstorm §10.1 (liên kết game chính thức), §10.2 (header, menu mobile, footer, nút sáng/tối, credit, "Nguồn dữ liệu"), §10.3 (link ngoài, bàn phím), quyết định plan #8 (ngày build, ẩn "Góp ý", "dành cho game"). Link gốc: [brainstorm-260923-2033-official-game-links-menu.md §1](../reports/brainstorm-260923-2033-official-game-links-menu.md).

## Artboard
Header trong `Main.dc.html:21-31` (và header mọi artboard trang trong), header Landing `Landing.dc.html:20-27`, `LandingMenu`, `LandingMenuMobile`, header mobile `MobileList.dc.html:20-30`, footer `Landing.dc.html` + `LandingMobile.dc.html:60-83`.

## Files to Create / Modify
- Modify: `src/layouts/SiteLayout.astro` (header 2 biến thể, footer, ấn 兵 SVG).
- Create: `src/lib/official-links.ts` — một nguồn cho 6 link game + 3 link cộng đồng + 3 link tải (App Store, Google Play, `.exe`) + mailto CSKH; dùng ở header, menu mobile, footer, Landing.
- Create: `js/site-nav.js` (+ `entry("js","site-nav")`); Delete: `js/mobile-section-menu.js`, `tests-js/mobile-section-menu.test.mjs`, dòng `entry("js", "mobile-section-menu")` (`src/lib/public-artifact-manifest.mjs:34`); đổi import trong `js/site-chrome.js:3` (consumer duy nhất) sang `site-nav.js`.
- Create: `src/lib/build-date.ts` — ngày build một lần cho mọi trang (bước 4).
- Modify: `css/styles.css` (header, dropdown, menu mobile, footer).
- Modify: `pipeline/site_localization.py` (UI obligations mới, lớp `authored-vi`), `pipeline/site-localization-policy.json` (hash, `sourceFiles` thêm `js/site-nav.js`, `src/lib/official-links.ts` nếu chứa chữ hiển thị) → theo plan.md "Quy trình bắt buộc mỗi phase" bước 2 (baseline, publish, re-pin, số ghim `tests/test_site_localization.py`).
- Modify: `scripts/design-compare.mjs` (cặp phase 03), `tests-e2e/spa-parity.spec.mjs`, `tests-js/frontend-shell-contract-assertions.mjs` (đang khóa `#section-menu-toggle`, `#section-menu-items`, `#theme-toggle` qua `npm run test:dist`).

## Tasks & Steps
1. **Header trang trong (desktop):** ấn 兵 40px SVG + "Cẩm Nang Tam Quốc Chí" serif 19px + dòng phụ `tagline`; nav Đội chuẩn · Đội khác · Cùng Tồn · Khai hoang · Tra cứu · Công cụ [Beta] ▾ · Game ▾; mục đang xem gạch chân son 3px (`#E36A6F` trên dải tối — thêm token); nút sáng/tối 44×44 ở phải. Menu "Công cụ" chứa 3 công cụ; "Game" chứa link chính thức + cộng đồng + tải game (link ngoài có ↗). **Tagline:** artboard ghi "<mùa> · tham khảo" nhưng dữ liệu không có cờ "mùa hiện tại" (`season-registry.json` có 2 kịch bản, không đánh dấu hiện hành; README design `:17` ghi mùa trong artboard là dữ liệu mẫu) → giữ tagline tĩnh theo trang của Phase 2, ghi lệch vào `visual-phase-03.md` ("giữ, không có nguồn dữ liệu"). Wrapper header giữ class `.top-header`; nhãn nav giữ trong mảng `SECTIONS` của `SiteLayout.astro` (obligation `ui:layout/*` bám file này).
2. **Header Landing:** Đội hình ▾ · Tra cứu ▾ · Công cụ ▾ · Game ▾ · Về cẩm nang · sáng/tối · CTA "Mở cẩm nang" → `/doi-chuan/`. Dropdown neo dưới đúng nút của nó, mỗi nút chỉ mở nhóm của mình (`LandingMenu`: thẻ nền `--panel`, mỗi mục có tên + mô tả một dòng).
3. **`js/site-nav.js`:** nút có `aria-expanded` + `aria-controls`; mở một menu thì đóng menu khác; Escape đóng và trả focus về nút; bấm ra ngoài đóng; Tab ra khỏi menu đóng. Menu mobile: ☰ (44×44) mở lớp toàn màn hình theo `LandingMenuMobile` (3 nhóm nội bộ + Game chính thức + Cộng đồng game + Tải game), khóa cuộn nền, focus vào nút đóng, Escape/nút ✕ đóng và trả focus về ☰.
4. **Footer dùng chung** (mọi `pageKind`): cột giới thiệu (ấn + tên + mô tả + chip "Dữ liệu cập nhật dd/mm/yyyy" từ ngày build — tính **một lần** trong module `src/lib/build-date.ts` (memo, múi giờ `Asia/Ho_Chi_Minh`) để mọi trang cùng ngày) + 4 cột (Đội hình, Tra cứu, Công cụ · Beta, Về cẩm nang — mục "Góp ý, báo lỗi dữ liệu" **không render**) + dải "Game chính thức" (6 link + 3 link cộng đồng) + dòng cuối 2 cột: "© 2026 Cẩm Nang TQCCL · Cẩm nang tra cứu build tướng dành cho game Tam Quốc Chí - Chiến Lược" và "Build bởi Nguyễn Nguyên · HLxThanos · Team 2 bang Huynh Đệ" (literal "Build bởi" giữ trong `SiteLayout.astro` cho `ui:layout/build-credit`). Bỏ nút sáng/tối và hàng ghi chú "Nguồn dữ liệu" khỏi footer cũ. Link "Nguồn dữ liệu" trỏ `/#nguon-du-lieu`, link tải game trỏ `/#tai-game` (anchor tạo ở Phase 4) — bảng chuyển tiếp `js/legacy-routes.js` để yên hai anchor này (Phase 2 bước 6); grep chặn `/#` của Phase 2 chỉ nhắm id mục cũ nên hai link này hợp lệ.
5. **Link ngoài:** `target="_blank" rel="noopener noreferrer"` (đúng quy ước hiện có `js/render.js:372,515`, `recommended-reference-render.js:295`, test `khaihoang-options.spec.mjs:280`, và brainstorm link chính thức `brainstorm-260923-2033…:28`) + icon ↗ `aria-hidden` + chữ ẩn "(mở tab mới)"; không nhúng ảnh/logo nhà phát hành. `official-links.ts` giữ `rel` cho mọi mục.
6. **Vùng bấm mobile:** link cột footer và mục menu ≥ 44px (§11.4 thay 40px của artboard).
7. **Chữ UI:** mọi nhãn/mô tả mới khai báo obligation `authored-vi`; nhãn nav cũ đổi chữ (nếu có) là `translate` → danh sách chờ receipt độc lập.
8. Thêm cặp so ảnh: header của Main/MobileList (cắt vùng 0–72px / 0–64px), LandingMenu (setup: click "Đội hình"), LandingMenuMobile (setup: click ☰), footer Landing/LandingMobile.

## Verification
- e2e mới trong `spa-parity.spec.mjs`: mở/đóng từng menu bằng chuột và bàn phím, Escape trả focus, bấm ngoài đóng, chỉ một menu mở; menu mobile 390px khóa cuộn và trả focus; mọi link `target="_blank"` có `rel` chứa cả `noopener` và `noreferrer`; `aria-current` đúng trên 8 trang; footer có trên Landing, trang mục, chi tiết, 404, cùng một ngày cập nhật; không có text "Góp ý".
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3) — gồm `test:dist` (shell assertions) và `test:node` (xóa `mobile-section-menu.test.mjs`).
- `node scripts/design-compare.mjs --phase 03` → `reports/visual-phase-03.md`.
