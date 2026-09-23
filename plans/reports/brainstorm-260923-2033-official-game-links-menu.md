# Brainstorm — Liên kết chính thức vào Menu + section tải game trên trang chủ

Trạng thái: brainstorm, chưa implement. Nguồn scan: https://tqccl.vntth.com/#/index (2026-09-23).

## 1. Link đã scan

| Nhóm | Nhãn trên site gốc | URL | Đích |
|---|---|---|---|
| Menu | Trang Chủ | https://tqccl.vntth.com/ | Menu |
| Menu | Đổi Quà (title: "Trang đổi thưởng") | https://game-notice.vntth.com/64102ce206c21e0ac034b0b9/index | Menu |
| Menu | Web Nạp | https://shop.vntth.com/s3g/vn | Menu |
| Cộng đồng | Facebook | https://www.facebook.com/tamquocchi.chienluoc | Menu |
| Cộng đồng | Groups | https://www.facebook.com/groups/707102010925675 | Menu |
| Cộng đồng | YouTube | https://www.youtube.com/@tamquocchi-chienluoc | Menu |
| Hỗ trợ | CSKH (popup, không phải link) | mailto:s3g.service@thienthuonghoa.com | Menu |
| Hỗ trợ | Tra xem tư cách trở về | https://tqccl.vntth.com/prism-m0gbm2e5/index?access=s3gvn_website | Menu |
| Tải game | QR | ảnh CDN `cdn-os.qookkagames.com/.../mag7sg5p7d3fplyj9yq.png` | Section trang chủ |
| Tải game | App Store | https://apps.apple.com/vn/app/id1616630100 | Section trang chủ |
| Tải game | Google Play | https://play.google.com/store/apps/details?id=com.vntth.sgzzlb.gp.vn&gl=vn | Section trang chủ |
| Tải game | Tải bản máy tính | https://global-package-publish.qookkagames.com/s3gsource/13/s3g_vn_0610.pc.exe | Section trang chủ |
| Bỏ qua | Chính sách bảo mật, Điều khoản dịch vụ | r.vntth.com/... | — |

## 2. Contract

- **Outcome:** menu site có nhóm "Liên kết game" (8 link trên) trên cả trang chủ lẫn trang chi tiết đội; trang chủ có section "Tải game" (QR + App Store + Google Play + PC).
- **Constraints:** link ngoài không được dùng class `.nav-tab`/`data-section` (app.js gắn tab + phím mũi tên vào mọi `.nav-tab`; `frontend-shell-contract-assertions.mjs` so khớp danh sách `data-section`). Giữ tablist ARIA hợp lệ. Site là cẩm nang fan → không dùng logo/branding nhà phát hành, ghi rõ "liên kết chính thức của NPH". Light/dark theo token có sẵn. Mobile dùng menu ☰ hiện tại.
- **Non-goals:** Chính sách/Điều khoản; sửa lệch SECTIONS giữa `SiteLayout.astro` (heroes/tactics) và `index.astro` (lookup); đồng bộ tự động link khi NPH đổi.
- **Acceptance:** 8 link mở tab mới `rel="noopener noreferrer"`; tab nav + phím mũi tên không đổi hành vi; `npm run check`, `npm run build`, `npm run test:dist` xanh; e2e mới kiểm link menu (desktop + mobile ☰) và section tải game; screenshot light/dark, 375px không cuộn ngang.

## 3. Hiện trạng code liên quan

- `src/pages/index.astro` tự viết header/nav riêng (không dùng `SiteLayout`); `nav.section-nav` mang `role="tablist"`.
- `src/layouts/SiteLayout.astro` dùng cho trang chi tiết/404, nav là `<a>` thật.
- Menu mobile: `js/mobile-section-menu.js` toggle `.section-nav.open`; đóng khi click tab/Escape.
- Không có CSP. Thêm file vào `public/` kéo theo contract `_headers` + `astro-dist-contract` test.

## 4. Menu — phương án

| | A. Dropdown `<details>` "Liên kết game" trong `.section-nav` (Khuyến nghị) | B. Nút 🔗 popover cạnh nút theme | C. Thêm link phẳng vào hàng tab |
|---|---|---|---|
| Desktop | Ô cuối hàng tab, panel xổ xuống chia 3 nhóm: Trang chính thức / Cộng đồng / Hỗ trợ | Icon ở header, popover | Hàng tab dài gấp đôi, lẫn tab nội bộ với link ngoài |
| Mobile | Tự thành 1 mục trong menu ☰, mở ra danh sách | Tách khỏi menu ☰ → người dùng khó thấy | Menu ☰ dài 16 mục |
| Chi phí | Chuyển `role="tablist"` từ `<nav>` xuống `#section-menu-items`; ~10 dòng JS đóng khi click ngoài/Escape trong `site-chrome.js` | Thêm popover + focus management | Thấp nhất nhưng vỡ ngữ nghĩa tablist |
| Giả định chính | e2e `getByRole('tablist').first()` vẫn khớp sau khi dời role | Người dùng tìm link ở header | — |
| Hỏng đầu tiên khi | Có test assert role trên `<nav>` (hiện chưa thấy) | User mobile không phát hiện icon | Luôn — lỗi a11y |

DRY: dữ liệu link gom 1 file `src/lib/official-game-links.ts`; component `src/components/OfficialLinksMenu.astro` dùng chung cho `index.astro` và `SiteLayout.astro`.

## 5. Section tải game — phương án

**Vị trí**
1. Dải "Tải game Tam Quốc Chí – Chiến Lược" ngay trước footer trang chủ, hiện ở mọi tab (Khuyến nghị) — không đẩy công cụ tra cứu xuống dưới.
2. Chỉ trong tab Đội chuẩn (mặc định) — ít thấy khi deep-link sang tab khác.
3. Trên cùng, dưới disclaimer — nổi nhất nhưng chiếm màn hình đầu của công cụ.

**Ảnh QR**
- a. Hotlink CDN của NPH — 0 thay đổi contract dist; hỏng khi NPH đổi/xóa ảnh (fallback: ẩn khối QR khi `onerror`).
- b. Vendor ảnh vào `public/` — bền; phải cập nhật `_headers` + dist contract test; ảnh cũ nếu NPH đổi QR.
- c. Tự sinh SVG QR — cần decode nội dung QR gốc trước (chưa làm; máy không có zbarimg).

**Nút tải:** nút chữ + icon SVG đơn giản theo token site (không dùng badge chính hãng Apple/Google — tránh vi phạm brand guideline, không cần asset). Mobile ẩn QR (không tự quét màn hình mình); nút PC ghi rõ "Tải bản PC (.exe, trực tiếp từ NPH)".

Layout desktop: `[QR] [App Store / Google Play xếp dọc] [Bản PC]`, giống ảnh đính kèm; mobile xếp dọc full-width.

## 6. Khuyến nghị

Menu **A** + section vị trí **1** + nút chữ theo token. QR: nghiêng về **a (hotlink + fallback ẩn)** vì rẻ nhất để bỏ và không đụng dist contract — cần user chốt.

File dự kiến chạm: `src/lib/official-game-links.ts` (mới), `src/components/OfficialLinksMenu.astro` (mới), `src/components/GameDownloadSection.astro` (mới), `src/pages/index.astro`, `src/layouts/SiteLayout.astro`, `js/site-chrome.js`, `css/styles.css`, 1 spec e2e mới.

Lưu ý: working tree đang có nhiều thay đổi chưa commit ở `index.astro`, `SiteLayout.astro`, `css/styles.css` — cần tách commit khi implement.

## Câu hỏi chưa chốt

1. QR: hotlink CDN (a), vendor vào repo (b), hay tự sinh SVG (c)?
2. Vị trí section tải game: trước footer ở mọi tab (1), chỉ tab Đội chuẩn (2), hay trên cùng (3)?
3. Nhãn menu: "Liên kết game" hay "Trang chính thức"?
4. Link PC `.exe` tải trực tiếp: giữ link thẳng, hay trỏ về trang chủ chính thức để NPH cập nhật bản mới (link .exe có số phiên bản `0610`, dễ lỗi thời)?
