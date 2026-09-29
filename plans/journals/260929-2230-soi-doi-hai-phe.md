# Soi đội đọc cả hai phe; đếm ẩn danh, gửi ảnh tự nguyện, bộ ảnh chuẩn

## Việc đã làm
- Worker `analyzeTeamImage` trả `{screen, sides}`; prompt bỏ "chỉ chép phe 我方", chép cả hai phe (phe phải đọc ngược để 主将 đứng đầu), bản game tiếng Việt chép nguyên chữ Việt.
- Soi đội: bước chọn phe cho ảnh hai phe, nút đổi phe giữ draft từng phe, câu chờ sau 15 s; đếm ẩn danh `POST /api/scan-stats` và gửi ảnh tự nguyện `POST /api/scan-samples` (community-worker, migration 0005, tab Soi đội ở `/quan-tri/`).
- `worker/eval/`: 5 ảnh thật đã che tên + fixture ID canonical, `npm run eval:vision` chấm qua `draftFromRead`.
- Trang Quyền riêng tư, disclaimer, docs cập nhật; bản dịch publish lại.

## Quyết định
- Chấm độ chính xác trên ID canonical sau bộ khớp từ điển (đúng thứ người dùng thấy), không so chuỗi Hán thô: ảnh phồn thể/tiếng Việt chấm được cùng thước.
- `readStats` chỉ tính ô AI có chép; ô trống người dùng tự điền (tướng thiếu, binh thư màn chiến báo) không phải lỗi đọc — review chỉ ra bản đầu làm % ô sửa vượt 100%.
- Fixture xuất từ mẫu người dùng không mang `screen` (nhãn AI tự đoán); `screen`/`sideCount` tuỳ chọn trong fixture.
- Đổi phe dùng bộ đếm huỷ riêng (`compareGeneration`), không dùng chung `generation` với lượt đọc Worker.
- Không đổi prompt theo phát hiện SP (xem dưới) khi chưa đo bằng provider thật.

## Còn lại
- Chạy `npm run eval:vision -- --save base` với provider thật để có mốc; chưa có key trong máy này nên chỉ smoke bằng endpoint giả.
- Phát hiện từ fixture: prompt cấm đọc icon nên tướng SP (chữ "SP" in trên chân dung) về bản thường — battle-trad-1/2, battle-vi-1 sẽ trượt ô tướng SP. Thử câu "chữ SP in trên chân dung thì nameCn = 'SP ' + tên" và đo.
- Bộ chuẩn mới 5 ảnh (mục tiêu 15–30); đáp án do agent chép, cần người xem lại, nhất là battle-vi-1.
- Deploy: `db:migrate:remote` 0005 → community-worker → Pages → worker/; rồi gỡ nhánh dạng cũ `{heroes}` trong `normalizeTeamRead`.
