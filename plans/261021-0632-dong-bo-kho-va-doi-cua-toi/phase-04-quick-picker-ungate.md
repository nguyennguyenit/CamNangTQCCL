---
phase: 4
title: "Client: bảng chọn nhanh và gỡ chặn Worker AI"
status: done
priority: P2
effort: "1.5d"
dependencies: [3]
---

# Phase 4: Client — bảng chọn nhanh và gỡ chặn Worker AI

## Goal

Người dùng thêm kho hàng loạt bằng lọc + "Chọn tất cả N mục", và Gợi ý đội chạy được khi `isAnalyzeConfigured()` (`js/config.js:15`) sai: chỉ ẩn đọc ảnh và nút "Vì sao?". Ở production hàm này đang trả đúng (giá trị cứng ở `js/config.js:4-12`); hàm chỉ trả sai khi giá trị còn chứa `REPLACE_ME` (chuỗi rỗng vẫn trả đúng), nên phần gỡ chặn chỉ đổi hành vi với cấu hình placeholder. Cùng phase này dựng bộ chọn dùng lại được cho trình soạn đội ở phase 6.

## Files to Create / Modify

- Create: `js/roster-picker.js` — `filterCatalog(items, filters, policy)` thuần và `pickerTree(...)`, với hai **policy** dùng chung cơ chế tìm/lọc: <!-- Astra M5 -->
  - `inventory` (nhập kho): tướng lọc `faction`, `stars` (1–5), `cost` (dữ liệu là chuỗi `"7"`, so sánh dạng số) từ `data/heroes-dict.json`; chiến pháp lọc `type` (COMMAND/ACTIVE/PASSIVE/BURST/FORMATION/TROOP/INTERNAL), `source` (INHERITANCE/EVENT; `INNATE` và `"Tự mang"` luôn bị loại vì không vào kho; `null` vào nhóm "Khác"), `quality` (S/A/B/C; `null` vào "Khác") từ `data/tactics.json`; có "Chọn tất cả N".
  - `editor` (trình soạn đội): toàn bộ danh mục tướng và chiến pháp **kể cả** INNATE/`"Tự mang"`, thêm danh mục binh thư từ `books-dict` (ID `book:<slug>` theo `js/lookup-ids.js:17-20,144-150`); chọn từng mục, không có "Chọn tất cả".
  - Tìm theo tên Việt/Hán-Việt/Hán; số "Chọn tất cả N" đếm đúng tập đang hiện.
- Modify: `js/roster-recommend-ui.js` — gắn picker vào màn "review"; thêm món qua `addCanonicalItem` (khách, ID suy lúc gộp/đồng bộ bằng `roster-id-resolve`) hoặc `roster-cloud-store` (đã đăng nhập); bỏ `return` sớm ở `:100-108`; chỉ dựng thẻ đọc ảnh, Turnstile (`tsBox`) và nút `explainSubstitute` (`:618`) khi `isAnalyzeConfigured()`; khi không cấu hình thì một dòng ghi chú thay khu đọc ảnh.
- Modify: `css/styles.css` — style picker bằng token Sổ binh pháp.
- Modify: `src/lib/public-artifact-manifest.mjs` — `entry("js", "roster-picker")`.
- Localization: `js/roster-recommend-ui.js` đổi hash và có chữ mới → chạy lại chuỗi "Publish lại bản dịch hiển thị" (`docs/deployment-guide.md:251-271`).
- Create: `tests-js/roster-picker.test.mjs`
- Modify: `tests-e2e/beta-tools.spec.mjs` — ca chọn tất cả; ca chưa cấu hình AI bằng route intercept trả `/js/config.js` vẫn export đủ `ANALYZE_CONFIG` và `isAnalyzeConfigured`, với `workerUrl`/`turnstileSiteKey` chứa `REPLACE_ME`.
- Check: `tests-e2e/spa-parity.spec.mjs:162-164` chờ script Turnstile trên `roster-recommend`; giữ nguyên vì cấu hình production vẫn đầy đủ.

## Test Matrix

| # | Ca | Kỳ vọng |
|---|---|---|
| 1 | Tướng Ngụy + 5★ + cost 6 | đúng tập con (so `cost` dạng số) |
| 2 | Chiến pháp với dữ liệu thật, policy `inventory` | không bao giờ có INNATE hay `"Tự mang"` (`tactic:vo-song-thuong-tuong`); 29 mục `source: null` nằm trong "Khác" |
| 2b | Cùng `tactic:vo-song-thuong-tuong`, policy `editor` | chọn được |
| 2c | Binh thư, policy `editor` | tìm và chọn được; ID `book:<slug>` khớp `books-dict` |
| 3 | Chọn tất cả 36 mục đang lọc | thêm 36 món, món đã có không nhân đôi |
| 4 | Bỏ chọn tất cả | chỉ gỡ món đang lọc |
| 5 | zh: tìm tên Hán | khớp; kho lưu tên Việt chuẩn (như `canonicalByShown`, `:135`) |
| 6 | Khách chọn tất cả rồi đăng nhập + đồng ý gộp | đủ 36 `owned` trên cloud (ID suy từ tên) |
| 7 | E2E chưa cấu hình AI (intercept `/js/config.js`) | thấy picker, "Gợi ý 5 đội" chạy; không có thẻ đọc ảnh, không tải Turnstile |
| 8 | E2E đã cấu hình | các ca đọc ảnh ở `beta-tools.spec.mjs:846-956` vẫn xanh |

## Tasks & Steps

1. Viết `roster-picker.test.mjs` (ca 1–5) trên dữ liệu thật; chạy đỏ; viết `filterCatalog` đến xanh.
2. Dựng UI picker; nối thêm/bỏ món cho khách và đã đăng nhập.
3. Gỡ chặn: tách phần đọc ảnh/Turnstile/giải thích thành nhánh điều kiện.
4. Manifest + publish lại bản dịch; E2E 7–8.

## Verification

- `npm run test:node` xanh.
- `npm run check && npm run build && npm run test:dist` xanh.
- `npx playwright test tests-e2e/beta-tools.spec.mjs tests-e2e/spa-parity.spec.mjs` xanh.
