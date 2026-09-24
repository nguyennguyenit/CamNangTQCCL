---
phase: 4
title: "Landing + Tải game"
status: pending
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
- Modify: `js/landing.js` (chỉ nếu Landing có tương tác ngoài menu — theo artboard thì không).
- Modify: `pipeline/site_localization.py` (obligations `authored-vi` cho chữ Landing), `pipeline/site-localization-policy.json` (hash).
- Modify: `scripts/design-compare.mjs` (cặp Landing, LandingMobile), `tests-e2e/spa-parity.spec.mjs` (hoặc spec Landing mới nếu file đó quá tải).

## Tasks & Steps
1. **Số liệu thật.** Artboard ghi 1.366 cấu hình / 26 mùa nguồn, 166 đội người chơi, 202 tướng, 406 chiến pháp, 25 đội, 5 nhóm × 5 đội / 15 tướng, 17 đội mở đất, 8 đội Chạm Sứ, quân thủ 5 mỏ. Mỗi số phải có hàm tính trong `landing-stats.ts` từ dữ liệu build; số nào không có nguồn dữ liệu thì **bỏ câu chứa số**, ghi vào báo cáo phase (không hard-code). Định dạng số kiểu Việt (`1.366`).
2. **Dải số liệu** mang `id="nguon-du-lieu"` và dòng "Tổng hợp từ SGSDeck và người chơi · tham khảo, không phải phương án duy nhất." (thay hàng ghi chú footer cũ). Thông báo DashScope giữ ở trang Soi đội, không đưa lên Landing.
3. **Các khối điều hướng** ("Bạn đang cần gì?", 2 kho đội, Giữ đất/mở đất, công cụ): thẻ là `<a href>` tới trang mục; mô tả ngắn đúng artboard.
4. **Tải game `#tai-game`:** QR sinh **một lần** từ `https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true` bằng `npx --yes qrcode@1 -t svg` (không thêm dependency), tối ưu path, nhúng SVG `role="img" aria-label="Mã QR tải game"`; ghi lệnh sinh vào comment đầu SVG. Nút App Store, Google Play, "Tải bản máy tính" dùng icon SVG chung (điện thoại/tải xuống), **không** logo Apple/Google; link trực tiếp theo `official-links.ts`, `.exe` giữ link trực tiếp.
5. **CTA tối** + nút "Mở cẩm nang" → `/doi-chuan/`.
6. Mobile theo `LandingMobile`: xếp dọc, hero 1 cột, header nút "Mở" nhỏ.
7. Chữ Landing là chữ tác giả → obligation `authored-vi` từng chuỗi, key `ui:landing/<khối>/<trường>`.

## Verification
- Kiểm QR: chụp SVG ra PNG bằng Playwright và giải mã (`zbarimg` nếu có; không có thì người dùng quét bằng điện thoại) → đúng URL gốc. Ghi kết quả vào báo cáo.
- e2e: `/` có 7 khối theo thứ tự, anchor `#nguon-du-lieu`, `#tai-game` cuộn đúng; số liệu khớp dữ liệu (so với số đếm do test tự tính từ `data/`/publication); link ngoài có `target`/`rel`; không ảnh từ domain nhà phát hành.
- `npm run check && npm run build && npm run verify && npm run test:e2e`
- `node scripts/design-compare.mjs --phase 04` → `reports/visual-phase-04.md`.
