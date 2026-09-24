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
`Lookup.dc.html:39-48`, `LookupTactics.dc.html:40-54`, `LookupProfile.dc.html:32-77`, `LookupMobile.dc.html:39-44`.

## Files to Create / Modify
- Modify: `js/unified-lookup.js` (`:151-200,263-276,315-339`), `js/lookup-detail.js` (`:9,35-62,75-93`), `css/styles.css` (`:906-920` và mới).
- Modify: policy + obligations; `scripts/design-compare.mjs`; `tests-e2e/unified-lookup.spec.mjs`, `tests-js/unified-lookup.test.mjs`.

## Tasks & Steps
1. **Nhóm tra cứu:** chip nhóm có số đếm (`.lookup-chip` giữ) + ô tìm 50px + "`n` tướng" (`role="status"`).
2. **Lưới tướng:** 6 cột desktop / 2 cột mobile; ô chân dung từ `iconUrl` (`loading="lazy"`, `alt` = tên tướng); lỗi ảnh hoặc không có `iconUrl` → ô màu `--accent-soft`/màu phe + chữ Hán đầu tên (`--font-cjk`, `lang="zh-Hant"`, `aria-hidden`). `.lookup-card` giữ.
3. **Bảng chiến pháp:** cột phẩm, loại, hiệu quả, mục tiêu, tỷ lệ từ dữ liệu profile đã có (`lookup-detail.js:75-93`); trường thiếu → "—".
4. **Hộp thoại hồ sơ** (giữ `article[role=dialog]` hiện có + backdrop `.lookup-backdrop`): ảnh/fallback, eyebrow loại, tên serif + tên Trung, badge (SP/phẩm, phe, sao, meta), bảng vai trò/danh hiệu, thanh chỉ số và tăng trưởng từ dữ liệu có sẵn. Kiểm lại khóa focus (Tab/Shift+Tab vòng trong hộp thoại), Escape đóng, focus trả về thẻ đã mở, cuộn nền bị khóa.
5. **Sửa `bonusVi:`**: nhãn trường `civil`/generic hiện dùng chính khóa làm nhãn (`lookup-detail.js:9,59-62`) → bảng nhãn tiếng Việt cho mọi khóa hiển thị; khóa không có nhãn → không render trường (và log cảnh báo dev), không bao giờ in khóa thô. Nhãn mới → obligations.
6. Cặp so ảnh: Lookup (`/tra-cuu/`), LookupTactics (`/tra-cuu/?group=tactics`), LookupProfile (setup: mở hồ sơ tướng đầu tiên), LookupMobile.

## Verification
- e2e: chặn ảnh bằng `page.route('**/cloud.lingxigames.com/**', r => r.abort())` → mọi thẻ hiện fallback chữ Hán, không ảnh vỡ; không phần tử nào có text khớp `/\b[a-z]+[A-Z][A-Za-z]*:/` (khóa thô) trong hồ sơ; hộp thoại khóa focus + Escape + trả focus; deep-link `?group=&id=` mở đúng hồ sơ.
- `node --test tests-js/unified-lookup.test.mjs`
- `npm run check && npm run build && npm run verify && npm run test:e2e`
- `node scripts/design-compare.mjs --phase 07` → `reports/visual-phase-07.md`.
