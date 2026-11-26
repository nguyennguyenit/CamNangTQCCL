# Baseline output và thời gian (phase H)

Ngày 2026-11-18 (Asia/Saigon). Branch `feat/ja-locale-h`, sau khi ghép `origin/main` (`875c1005`) và ghim lại localization. Máy có nhiều session khác chạy song song (load trung bình 10–15 lúc đo), nên số giây dao động vài giây.

## So output vi/zh

Baseline là build của `origin/main` hiện tại, dựng trong worktree tạm `CamNangTQCCL-ja-h-base` (detached `875c1005`, dùng chung `node_modules`). Head là build của branch sau ghép. Cả hai snapshot dùng `--allow-locale ja` (bỏ thư mục `ja/`, thẻ hreflang/`og:locale:alternate` ja và gộp cụm nút chuyển ngôn ngữ).

| | Baseline (`origin/main` `875c1005`) | Head (`feat/ja-locale-h`) |
|---|---|---|
| Generation Recommended | `1fe48308…` | `86673de2…` (có `jpTiersHash`) |
| Số file (trừ `js/`, `ja/`) | 6.129 | 6.131 |
| `filesSha256` | `f7270e8e…bdda7cbce0` | `fbe0e079…7453ae725` |

`compare --allow-locale ja` với allowlist dùng chung (`404.html`, `robots.txt`, `_headers`, `_redirects`, `css/styles.css`, `llms.txt`) cộng 21 file PK-S26 đổi có chủ đích của tier JP (danh sách ở `phase-e2-report.md`, mục "Output đổi"):

- đổi 27, thêm 2, mất 0; ngoài allowlist **0**;
- 21 file tier JP: trang chi tiết 7 đội PK-S26 và trang mùa `doi-chuan/pk-s26/` ở vi và zh (16 file), `data/recommended/<gen>/index.json`, `manifest.json`, `details-s-d8a6775f….json`, `llms-full.txt`, `llms/doi-chuan/pk-s26.txt`. Trùng đúng danh sách của E2 (E2 có thêm 7 + 1 file ja, nằm trong `ja/` nên không tính ở đây);
- thêm: `data/lookup-ja.json`, `data/ja-kanji-variants.json` (dữ liệu ja mới của B/C);
- không trang Cùng Tồn nào đổi: thẻ bảng 11 cột của main (Trang bị, Thẻ Kỳ Lược) dựng giống hệt ở vi/zh sau ghép.

Manifest nằm ở `.cache/locale-baseline/` (không commit). Tái tạo: build `875c1005` rồi `node scripts/compare-locale-output.mjs snapshot --root <dist base> --out .cache/locale-baseline/base.json --allow-locale ja`.

## Thời gian

| Lệnh | Phase A (5.799 trang, trước `/ja/`) | `origin/main` hôm nay (5.799 trang) | Phase H (8.698 trang) |
|---|---|---|---|
| `npm run build` | 19 s | 17,5 s (Astro 11,0 s) | 18,4 s (Astro 13,7 s) |
| `npm run verify` | 11 s | — | 10,9 s ("Verified 9136 dist files") |
| `npm run test:dist` | 11 s | — | 13 s |
| `npm run test:e2e` | không đo | — | 396 s cho 711 test (Playwright báo 6,6 phút; gồm một lần build + preview) |

Thêm 2.899 trang `/ja/` (+50% số trang) làm phần dựng trang của Astro tăng khoảng 25% (11,0 s → 13,7 s), tổng `npm run build` gần như không đổi so với mốc phase A. Verifier vẫn khoảng 11 s. Mức tăng thấp hơn nhiều so với 40–50% plan dự kiến.

E2E chạy bằng cấu hình tạm cổng 4194 (4174/4175 bị session khác chiếm) và bỏ `bai-viet-kho-redesign.spec.mjs` vì spec viết cứng fixture cổng 4175; spec đó chạy riêng (16/16, 36 s), tổng 727 test. Phase A không đo thời gian e2e, nên không có mốc so trực tiếp; phase C ghi 723/725 test với cùng bộ spec (có `bai-viet-kho-redesign`).
