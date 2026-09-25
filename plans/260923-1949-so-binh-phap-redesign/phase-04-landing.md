---
phase: 4
title: "Landing + Tải game"
status: completed
priority: P1
effort: "2d"
dependencies: [3]
---

# Phase 4: Landing + Tải game

## Goal
`/` hiển thị đầy đủ Landing theo artboard, mọi con số lấy từ dữ liệu lúc build, mục Tải game có QR SVG đúng link gốc.

## Contract
Brainstorm §10.1 (Landing, Tải game, QR, nút cửa hàng), §10.2 ("Nguồn dữ liệu" → dải số liệu), §10.3 (link ngoài), plan quyết định #8.

## Artboard
`Landing.dc.html` (1440), `LandingMobile.dc.html` (390). Khối theo thứ tự: hero `#dau-trang` ("Mùa này chơi đội nào?"), dải số liệu `#nguon-du-lieu`, "Bạn đang cần gì?", "Hai kho đội, một bộ lọc chung", "Giữ đất và mở đất", "Không chỉ tra, còn tính giúp bạn", Tải game `#tai-game`, CTA tối "Mở cẩm nang, chọn đội cho mùa này.", footer (Phase 3).

## Files to Create / Modify
- Modify: `src/pages/index.astro` (các khối Landing), `css/styles.css`.
- Create: `src/lib/landing-stats.ts` — tính số liệu lúc build từ dữ liệu đã publish (dùng loader hiện có của trang chi tiết/Tra cứu, không đọc file thô trùng lặp).
- Create: `src/components/DownloadQr.astro` (SVG QR tĩnh) hoặc đặt SVG trong `index.astro` nếu chỉ dùng một chỗ.
- Không tạo `js/landing.js`: chuyển tiếp hash cũ đã là script inline từ `js/legacy-routes.js` (Phase 2); theo artboard Landing không có tương tác ngoài menu (`site-nav.js`).
- Modify: `pipeline/site_localization.py` (obligations `authored-vi` cho chữ Landing), `pipeline/site-localization-policy.json` → theo plan.md "Quy trình bắt buộc mỗi phase" bước 2. Giữ trong `index.astro` các chữ đã duyệt của `ui:root/brand`, `ui:root/meta-description`, `ui:root/team-chuan`, `ui:root/team-khac`, `ui:root/beta` (Phase 2 bước 9) khi viết lại nội dung.
- Modify: `scripts/design-compare.mjs` (cặp Landing, LandingMobile), `tests-e2e/spa-parity.spec.mjs` (hoặc spec Landing mới nếu file đó quá tải).

## Tasks & Steps
1. **Số liệu thật.** Artboard ghi 1.366 cấu hình / 26 mùa nguồn, 166 đội người chơi, 202 tướng, 406 chiến pháp, 25 đội, 5 nhóm × 5 đội / 15 tướng, 17 đội mở đất, 8 đội Chạm Sứ, quân thủ 5 mỏ. Mỗi số phải có hàm tính trong `landing-stats.ts` từ loader build có sẵn (`websiteDisplayPublicationSnapshot().publicFiles` `src/lib/root-static-artifacts.ts:245-256`, `lookupPublicationSnapshot` `:81`, `recommendedPublicationSnapshot` `src/lib/recommended-reference-artifacts.ts:56`); số nào không có nguồn thì **bỏ câu chứa số**, ghi vào báo cáo phase (không hard-code). **Số đội Đội khác lấy từ `other-teams.json` (40 bản ghi — trang `/doi-khac/` hiện đúng tập này, `js/app.js:393`), không phải 166 của `data/teams.json`** (kho gốc trước khi khử trùng); ghi lệch so với artboard vào `visual-phase-04.md`. Định dạng số kiểu Việt (`1.366`).
2. **Dải số liệu** mang `id="nguon-du-lieu"` và dòng "Tổng hợp từ SGSDeck và người chơi · tham khảo, không phải phương án duy nhất." (thay hàng ghi chú footer cũ). Thông báo DashScope giữ ở trang Soi đội, không đưa lên Landing.
3. **Các khối điều hướng** ("Bạn đang cần gì?", 2 kho đội, Giữ đất/mở đất, công cụ): thẻ là `<a href>` tới trang mục; mô tả ngắn đúng artboard.
4. **Tải game `#tai-game`:** QR sinh **một lần** từ `https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true` bằng `npx --yes qrcode@1.5.4 -t svg` (phiên bản cố định, không thêm dependency), không dùng công cụ tối ưu path ngoài; nhúng SVG `role="img" aria-label="Mã QR tải game"`; ghi lệnh sinh + phiên bản vào comment đầu SVG. Nút App Store, Google Play, "Tải bản máy tính" dùng icon SVG chung (điện thoại/tải xuống), **không** logo Apple/Google; link trực tiếp theo `official-links.ts` với `rel="noopener noreferrer"`, `.exe` giữ link trực tiếp.
5. **CTA tối** + nút "Mở cẩm nang" → `/doi-chuan/`.
6. Mobile theo `LandingMobile`: xếp dọc, hero 1 cột, header nút "Mở" nhỏ.
7. Chữ Landing là chữ tác giả → obligation `authored-vi` từng chuỗi, key `ui:landing/<khối>/<trường>`.

## Verification
- Kiểm QR: chụp SVG ra PNG bằng Playwright và giải mã (`zbarimg` nếu có; không có thì người dùng quét bằng điện thoại) → đúng URL gốc. Ghi kết quả vào báo cáo.
- e2e: `/` có 7 khối theo thứ tự, anchor `#nguon-du-lieu`, `#tai-game` cuộn đúng; số liệu khớp dữ liệu (so với số đếm do test tự tính từ `data/`/publication); link ngoài có `target`/`rel`; không ảnh từ domain nhà phát hành.
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3).
- `node scripts/design-compare.mjs --phase 04` → `reports/visual-phase-04.md`.
