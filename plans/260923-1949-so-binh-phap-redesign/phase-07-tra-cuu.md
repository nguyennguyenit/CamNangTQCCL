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
- Modify: `js/unified-lookup.js` (`:151-200,263-276,315-339`), `js/lookup-detail.js` (`:9,35-62,75-93`), `js/analyze.js` (`:202`, dùng helper chân dung chung), `css/styles.css` (`:906-920` và mới).
- Create (nếu chưa có chỗ hợp lý): helper chân dung dùng chung (vd `js/hero-portrait.js` + `entry()` manifest) cho Tra cứu, hồ sơ, Soi đội.
- Modify: policy + obligations theo plan.md "Quy trình bắt buộc mỗi phase" bước 2; `scripts/design-compare.mjs`; `tests-e2e/unified-lookup.spec.mjs`, `tests-js/unified-lookup.test.mjs`.

## Tasks & Steps
0. **Spike đo tải "Trong cẩm nang" — làm trước mọi bước khác.** Trang thử tạm (không commit) trên `/tra-cuu/`: gọi `loadVerifiedRecommendedManifest` + tải `index.json`, `other-teams.json` + hash + parse + phép đếm cho 1 tướng. Playwright ở 390px, throttle CDP "Fast 3G" (`Network.emulateNetworkConditions`: 1,6 Mbps xuống, latency 150 ms), CPU ×4, cache trống, trung vị 3 lần; ghi số vào `visual-phase-07.md`. (`astro preview` có gzip: `node_modules/vite/dist/node/chunks/node.js:34920`; gzip `index.json` ≈ 309 KB, riêng truyền đã ≈ 1,5 s.) Trung vị ≤ 2 s → làm bước 4b như dưới. Trung vị > 2 s → **dừng ngay**, báo người dùng; phương án đề xuất: tính số liệu theo tướng lúc build thành file nhỏ công khai (manifest + verifier + `/data/*` header đã có) — không tự làm khi chưa được duyệt.
1. **Nhóm tra cứu:** chip nhóm có số đếm (`.lookup-chip` giữ) + ô tìm 50px + "`n` tướng" (`role="status"`).
2. **Lưới tướng:** 6 cột desktop / 2 cột mobile; ô chân dung từ `iconUrl` qua helper chung: đổi `http:` → `https:` lúc render (92/112 URL hiện là `http://image.aligames.com/…`, `data/heroes-dict.json:308`; site chạy HTTPS → mixed content; bản `https` đã thử trả 200), `referrerpolicy="no-referrer"` (như `js/analyze.js:202`, CDN chặn hotlink theo Referer), `loading="lazy"`, `decoding="async"`, `alt` = tên tướng; lỗi ảnh hoặc không có `iconUrl` → ô màu `--accent-soft`/màu phe + chữ Hán đầu tên (`--font-cjk`, `lang="zh-Hant"`, `aria-hidden`). `.lookup-card` giữ. Render bằng `el()`/`textContent` (plan.md quyết định #14); bỏ các `innerHTML` tĩnh trong vùng viết lại (`unified-lookup.js:175,242,252`).
3. **Bảng chiến pháp:** cột phẩm, loại, hiệu quả, mục tiêu, tỷ lệ từ dữ liệu profile đã có (`lookup-detail.js:75-93`); trường thiếu → "—".
4. **Hộp thoại hồ sơ** (giữ `article[role=dialog]` hiện có + backdrop `.lookup-backdrop`): ảnh/fallback, eyebrow loại, tên serif + tên Trung, badge (SP/phẩm, phe, sao, meta), bảng vai trò/danh hiệu/đặc tính, thanh chỉ số và tăng trưởng từ dữ liệu có sẵn. Kiểm lại khóa focus (Tab/Shift+Tab vòng trong hộp thoại), Escape đóng, focus trả về thẻ đã mở, cuộn nền bị khóa.
4b. **Khối "Trong cẩm nang"** (chỉ khi spike bước 0 đạt; tính lúc mở hồ sơ, không thêm dữ liệu): số đội chuẩn / đội khác có tướng này, đếm theo vị trí (Chủ tướng, Phó 1, Phó 2), chiến pháp hay mang (top 3 + số đội), binh thư hay dùng, hướng điểm hay dùng, 3 đội tiêu biểu (tên, mùa, điểm, vị trí; tên là link tới trang chi tiết kèm `from` = URL hồ sơ `/tra-cuu/?group=heroes&id=…`, giữ được vì Phase 2 cho `/tra-cuu/` giữ `group`, `id`) và link **"Tìm tướng này trong Đội chuẩn"** → `/doi-chuan/?season=all&q=<tên>` (không ghi số n trên link: `q` là tìm chuỗi rộng, kết quả không bằng n — vd SP Lữ Mông n = 48 nhưng `?q=` ra 54 với `season=all`, 3 với mùa mặc định). Nguồn: `index.json` của generation Recommended đang pin (1366 bản ghi, 3.374.425 byte; mỗi tướng có `nameRaw`, `roleRaw`, `tacticSlotsVi`, `bookSlotsVi`, `statFocusVi`) + `other-teams.json` (`holders[].nameRaw`); **chỉ tải khi mở hồ sơ đầu tiên** qua bộ nạp đã xác minh hash (`loadVerifiedRecommendedManifest`, `recommended-reference-state.js:187`), giữ promise trong bộ nhớ cho các lần sau; lần tải lỗi thì xóa promise để lần mở sau thử lại, khối hiện lỗi `role="status"`. Mọi tên từ dữ liệu render bằng `textContent`.
   **Khóa nối (đã đo 2026-09-25):** tướng trong đội **không** mang ID Tra cứu; `holders[].heroIdentityId` của Đội khác thuộc không gian ID khác (`hero:e351…`); `pipeline/recommended-identity-map.json` không có ID Tra cứu và không được publish. Nối bằng **so khớp chính xác theo từng nguồn**, không so gần đúng:
   - Đội chuẩn (`index.json`, `nameRaw` chữ Hán): `nameRaw` ↔ `chinese`/`aliases[]` của `heroes-dict.json`, chỉ bỏ khoảng trắng (`SP荀彧` ≡ `SP 荀彧`) → 4071/4098 ô khớp đúng 1 ID, 0 mơ hồ, 27 không khớp (tướng ngoài catalog như `周劭`, `陳翊`, ô rỗng, `任意武將`, `死士`); không có đếm trùng SP/không SP (`40Y 呂布` là ID riêng).
   - Đội khác (`other-teams.json`, `holders[].nameRaw` tên Việt, vd "SP Lữ Mông"): `nameRaw` ↔ `hanViet` (duy nhất trên 202 tướng) → 120/120 ô khớp.
   - Ô không khớp không tính cho tướng nào; `nameRaw` khớp ≥ 2 ID → bỏ ô đó, log cảnh báo dev. Test đơn vị ghim cả hai quy tắc (khoảng trắng, mơ hồ, không khớp, nguồn Việt vs Hán). Tướng không xuất hiện → "Chưa có trong đội nào". Thứ tự "đội tiêu biểu": điểm giảm dần rồi thứ tự nguồn.
5. **Sửa `bonusVi:`**: nhãn trường `civil`/generic hiện dùng chính khóa làm nhãn (`lookup-detail.js:9,59-62`) → bảng nhãn tiếng Việt cho mọi khóa hiển thị; khóa không có nhãn → không render trường (và log cảnh báo dev), không bao giờ in khóa thô. Nhãn mới → obligations.
6. Cặp so ảnh: Lookup (`/tra-cuu/`), LookupTactics (`/tra-cuu/?group=tactics`), LookupProfile (setup: mở hồ sơ SP Lữ Mông như artboard), LookupMobile.

## Verification
- e2e: chặn ảnh bằng `page.route` cho **mọi** host chân dung trong `heroes-dict.json` (lấy từ dữ liệu trong test; hiện `image.aligames.com` 92, `cloud.lingxigames.com` 20; 90 tướng không có `iconUrl`) → mọi thẻ hiện fallback chữ Hán, không ảnh vỡ; mọi `img` chân dung có `src` bắt đầu `https://` và `referrerpolicy="no-referrer"`; không phần tử nào có text khớp `/\b[a-z]+[A-Z][A-Za-z]*:/` (khóa thô) trong hồ sơ; hộp thoại khóa focus + Escape + trả focus; deep-link `?group=&id=` mở đúng hồ sơ; số liệu "Trong cẩm nang" của SP Lữ Mông khớp phép đếm độc lập trong test (cả số đội chuẩn và đội khác > 0); `index.json` không được tải khi chưa mở hồ sơ (đếm request); từ đội tiêu biểu vào chi tiết rồi "Quay lại" về đúng hồ sơ.
- Số đo spike (bước 0) + số đo lại sau khi làm xong 4b, cùng điều kiện, ghi vào `visual-phase-07.md`.
- `node --test tests-js/unified-lookup.test.mjs`
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3).
- `node scripts/design-compare.mjs --phase 07` → `reports/visual-phase-07.md`.
