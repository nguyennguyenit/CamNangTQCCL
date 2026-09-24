---
phase: 7
title: "Tra cứu + hồ sơ"
status: pending
priority: P2
effort: "2d"
dependencies: [3]
---

# Phase 7: Tra cứu + hồ sơ

## Goal
`/tra-cuu/` có lưới tướng 6 cột, bảng chiến pháp, hộp thoại hồ sơ theo artboard; ảnh chân dung có fallback chữ Hán; hết lỗi lộ khóa `bonusVi:`.

## Contract
Brainstorm §5 #6 (chân dung + fallback), §6 (Tra cứu), §11.4 (font CJK), acceptance §4 (hộp thoại khóa focus + Escape).

## Artboard
`Lookup.dc.html:39-48`, `LookupTactics.dc.html:40-54`, `LookupProfile.dc.html` (bản chụp `1790191281-3a81`: cao 1350, thêm dòng "Đặc tính" và khối "Trong cẩm nang"), `LookupMobile.dc.html:39-44`.

## Files to Create / Modify
- Modify: `js/unified-lookup.js` (`:151-200,263-276,315-339`), `js/lookup-detail.js` (`:9,35-62,75-93`), `css/styles.css` (`:906-920` và mới).
- Modify: policy + obligations; `scripts/design-compare.mjs`; `tests-e2e/unified-lookup.spec.mjs`, `tests-js/unified-lookup.test.mjs`.

## Tasks & Steps
1. **Nhóm tra cứu:** chip nhóm có số đếm (`.lookup-chip` giữ) + ô tìm 50px + "`n` tướng" (`role="status"`).
2. **Lưới tướng:** 6 cột desktop / 2 cột mobile; ô chân dung từ `iconUrl` (`loading="lazy"`, `alt` = tên tướng); lỗi ảnh hoặc không có `iconUrl` → ô màu `--accent-soft`/màu phe + chữ Hán đầu tên (`--font-cjk`, `lang="zh-Hant"`, `aria-hidden`). `.lookup-card` giữ.
3. **Bảng chiến pháp:** cột phẩm, loại, hiệu quả, mục tiêu, tỷ lệ từ dữ liệu profile đã có (`lookup-detail.js:75-93`); trường thiếu → "—".
4. **Hộp thoại hồ sơ** (giữ `article[role=dialog]` hiện có + backdrop `.lookup-backdrop`): ảnh/fallback, eyebrow loại, tên serif + tên Trung, badge (SP/phẩm, phe, sao, meta), bảng vai trò/danh hiệu/đặc tính, thanh chỉ số và tăng trưởng từ dữ liệu có sẵn. Kiểm lại khóa focus (Tab/Shift+Tab vòng trong hộp thoại), Escape đóng, focus trả về thẻ đã mở, cuộn nền bị khóa.
4b. **Khối "Trong cẩm nang"** (tính lúc mở hồ sơ, không thêm dữ liệu): số đội chuẩn / đội khác có tướng này, đếm theo vị trí (Chủ tướng, Phó 1, Phó 2), chiến pháp hay mang (top 3 + số đội), binh thư hay dùng, hướng điểm hay dùng, 3 đội tiêu biểu (tên, mùa, điểm, vị trí) và link "Xem cả n đội chuẩn" → `/doi-chuan/?q=<tên>` (khóa `q` đã có). Nguồn: `index.json` của generation Recommended đang pin (1366 bản ghi, mỗi tướng có `roleRaw`, `tacticSlotsVi`, `bookSlotsVi`, `statFocusVi`) + `other-teams.json`; file nặng ~3,4 MB nên **chỉ tải khi mở hồ sơ đầu tiên**, giữ trong bộ nhớ cho các lần sau. Khớp tướng Tra cứu ↔ tướng trong đội bằng bản đồ định danh hiện có (`pipeline/lookup-identity.json` / `pipeline/recommended-identity-map.json`, xem cách `unified-lookup.js` đang tra), không so chuỗi tên. Tướng không xuất hiện → khối ghi "Chưa có trong đội nào". Thứ tự "đội tiêu biểu": điểm giảm dần rồi thứ tự nguồn. Nếu lúc làm phát hiện khóa định danh không nối được hai phía → dừng, báo người dùng thay vì đoán.
5. **Sửa `bonusVi:`**: nhãn trường `civil`/generic hiện dùng chính khóa làm nhãn (`lookup-detail.js:9,59-62`) → bảng nhãn tiếng Việt cho mọi khóa hiển thị; khóa không có nhãn → không render trường (và log cảnh báo dev), không bao giờ in khóa thô. Nhãn mới → obligations.
6. Cặp so ảnh: Lookup (`/tra-cuu/`), LookupTactics (`/tra-cuu/?group=tactics`), LookupProfile (setup: mở hồ sơ SP Lữ Mông như artboard), LookupMobile.

## Verification
- e2e: chặn ảnh bằng `page.route('**/cloud.lingxigames.com/**', r => r.abort())` → mọi thẻ hiện fallback chữ Hán, không ảnh vỡ; không phần tử nào có text khớp `/\b[a-z]+[A-Z][A-Za-z]*:/` (khóa thô) trong hồ sơ; hộp thoại khóa focus + Escape + trả focus; deep-link `?group=&id=` mở đúng hồ sơ; số liệu "Trong cẩm nang" của 1 tướng khớp phép đếm độc lập trong test; `index.json` không được tải khi chưa mở hồ sơ (đếm request).
- `node --test tests-js/unified-lookup.test.mjs`
- `npm run check && npm run build && npm run verify && npm run test:e2e`
- `node scripts/design-compare.mjs --phase 07` → `reports/visual-phase-07.md`.
