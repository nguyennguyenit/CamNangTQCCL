# 2026-10-07 — Tra cứu tướng: Đánh giá và Cách nhận

## What happened
Hồ sơ tướng có thêm hai mục lấy từ trang chi tiết SGSDeck. **Đánh giá** (評價) là lời khuyên giữ hay rã thẻ, có ở 94 tướng. **Cách nhận** (取得管道) gồm gói, có phải tướng lõi không và tỉ lệ lõi/thường của cả gói, có ở 126 tướng. 94 bản dịch đã được chủ repo duyệt theo `plans/reports/translation-review-261007-tuong-danh-gia-cach-nhan.md`. Generation Tra cứu mới là `lookup:8878e4fc…`, chỉ `heroes-dict.json` đổi. Generation Đội chuẩn mới là `8a5f4b2c…`.

## Decisions
- Dữ liệu dựng từ cache đã có (`pipeline/sgsdeck-cache/`, 2026-09-12), không crawl lại. Ngày 2026-10-05 đã đối chiếu: trang sống không đổi thuộc tính hay `updatedAt` của tướng nào.
- Guide nằm trong file riêng `pipeline/sgsdeck-guide.json` và gắn `snapshotManifestHash`. Snapshot `data/sgsdeck/` giữ nguyên byte.
- Tên gói dịch bằng bảng cố định trong builder, không dịch theo từng tướng. Gói lạ làm build dừng.
- 典藏 dịch là "Sưu tầm" cho khớp cờ `isCollectible` đang hiện trên web. Tên chiến pháp lấy theo tên Việt đã công bố.

## Surprises
- Lần đầu cho guide vào `data/sgsdeck/generals.json`, manifest snapshot đổi, kéo theo `pipeline/lookup-identity.json` phải đổi `sourceManifestHash`. Registry này là nguồn glossary của gate bản dịch, nên glossary digest đổi và toàn bộ receipt bị stale. Đã revert snapshot và registry về HEAD rồi tách guide ra file riêng. Đây là "luồng khác" mà journal Binh thư cùng ngày nhắc tới.
- Dựng lại snapshot từ cùng cache vẫn làm đổi `manifest.json`, vì `inputHashes` ghi hash của `data/heroes-dict.json` hiện tại. Vì vậy có thêm `--guide-only`.
- Nguồn gõ sai 4 tên chiến pháp (兵峰, 運籌帷幄, 擋風摧決, 乘勝不虞). Bản dịch dùng tên đúng.

## Left open
- Chưa prune generation Đội chuẩn `5a4a1e2b…` (của phiên Binh thư, chưa commit).
- Ghi chú TW/VN không hiện, theo quyết định của chủ repo.
