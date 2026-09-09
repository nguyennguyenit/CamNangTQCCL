# Bổ sung hướng dẫn trong từng team khai hoang

Status: Accepted
Date: 2026-09-07

## Outcome

Mỗi team khai hoang có hướng dẫn giúp người chơi chọn quân thủ, hiểu yêu cầu hột, tách đội đánh đất và chuyển hình. Dùng một bản hướng dẫn mới nhất; không chia mùa, không hiển thị nguồn.

## Quyết định đã chốt

Bổ sung sáu nhóm thông tin từ 11 ảnh người dùng cung cấp:

1. Đặc điểm và mục đích sử dụng đội.
2. Điểm mở đất 4, 5, 6, 7–8; chuyển hình; tổng hợp.
3. Yêu cầu hột tối thiểu và khuyến nghị, nếu ảnh phân biệt.
4. Thứ tự quân thủ đất 4 và 5 từ dễ đến khó, riêng từng đội.
5. Phương án tách đội đánh đất: tướng, chiến pháp, mục tiêu.
6. Lộ trình chuyển hình: đội đích, tướng luyện thêm, mốc thành chính, thống ngự và thời điểm được nêu.

Card hiển thị tóm tắt; hướng dẫn đánh đất và chuyển hình mở rộng bên trong. Cập nhật nội dung mới trực tiếp vào team tương ứng. Không dùng mùa hoặc nguồn làm điều kiện chặn cập nhật.

Ngày 2026-09-09, người dùng chốt “Theo bộ ba tướng”: guide và điểm thuộc roster, dùng chung giữa các cấu hình chiến pháp cùng ba tướng. Hiển thị ghi chú ngắn rằng chưa chấm riêng từng bộ chiến pháp; giữ mọi điều kiện cụ thể. Chiến pháp, binh chủng và chủ tướng theo giai đoạn vẫn thuộc cấu hình được chọn. Đổi cấu hình giữ nguyên hướng dẫn và trạng thái mở/đóng.

## Constraints

- Giữ nguyên cấu hình hiện có trừ phần được cập nhật có căn cứ từ ảnh.
- Không nhập trạng thái kho cá nhân trong ảnh như đã sở hữu, thiếu tướng hoặc số hột đang có thành yêu cầu chung.
- Không suy diễn ngưỡng quân, cấp tướng, tỷ lệ thắng hoặc bộ chiến pháp còn thiếu.
- Tách đội đánh đất thuộc team chính, độc lập với khối Team Chạm Sứ / Ăn vạ.
- Bộ chọn cấu hình thay đổi chiến pháp/chủ tướng, không thay guide/điểm chung của roster. Không trình bày điểm chung như điểm chấm riêng cấu hình, không chia sẻ guide sang bộ ba khác.
- Bảo toàn WIP không liên quan. Chưa có yêu cầu commit hoặc deploy.

## Non-goals

- Chia dữ liệu hoặc giao diện theo mùa.
- Hiển thị nguồn cho nội dung bổ sung.
- Đồng bộ kho tướng cá nhân từ trạng thái trong ảnh.
- Tự suy ra tier hoặc cơ chế chiến đấu từ điểm đánh giá.
- Thực hiện code/data trong bước chốt brainstorm này.

## Đối chiếu ảnh

| Ảnh | Team | Trạng thái khi kiểm tra |
|---|---|---|
| 1 | Lục Tốn · Tả Từ · Trương Xuân Hoa | Đã có |
| 2 | Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ | Người dùng xác nhận 2026-09-07; Trình Phổ thay ở giai đoạn sau |
| 3 | Gia Cát Khác · Quan Ngân Bình · Nhạc Tiến | Đã có |
| 4 | Hạ Hầu Uyên · Thái Sử Từ · Hoàng Nguyệt Anh | Đã có |
| 5 | Khương Duy · Hạ Hầu Uyên · Gia Cát Khác | Đã có |
| 6 | Khương Duy · Hạ Hầu Uyên · Pháp Chính | Đã có |
| 7 | Trương Xuân Hoa · Lữ Bố · Tả Từ | Chưa có |
| 8 | Gia Cát Khác · Thái Sử Từ · Tả Từ | Đã có; yêu cầu Thái Sử Từ từ 3 đỏ theo ảnh |
| 9 | SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác | Chưa có |
| 10 | Khương Duy · Quan Ngân Bình · Thái Văn Cơ | Đã có |
| 11 | SP Viên Thiệu · Hạ Hầu Uyên · Trương Xuân Hoa | Đã có |

## Evidence và hướng triển khai

Đã đọc `data/khaihoang.json` (15 team), `js/render.js` (khaihoangTeamCard, khaihoangTable) và `docs/system-architecture.md`. Card có tướng, chiến pháp trước/sau cấp 20, cấu hình và ghi chú; bảng quân thủ hiện dùng chung. Mở rộng owner hiện tại, không tạo trang riêng. Khi lập kế hoạch phải kiểm tra lại trạng thái thực tế.

## Acceptance criteria

- Sáu nhóm thông tin được hỗ trợ và hiển thị khi có dữ liệu; không tạo nội dung giả để lấp trường trống.
- Điểm số và thứ tự quân thủ khớp ảnh, gắn đúng bộ ba tướng; điều kiện cụ thể vẫn được giữ khi dùng chung giữa các cấu hình.
- Tên tướng và chiến pháp Việt hóa nhất quán với từ điển dự án.
- Không có bộ lọc mùa hoặc nhãn nguồn mới cho hướng dẫn này.
- Trạng thái sở hữu cá nhân trong ảnh không xuất hiện như dữ liệu chung.
- Tách đội và chuyển hình không bị trộn với Chạm Sứ.
- Card tóm tắt và phần mở rộng sử dụng được trên desktop/mobile.
- Kiểm tra dữ liệu và kiểm thử hiển thị tập trung phù hợp thay đổi; bảo toàn đội và dữ liệu không liên quan.

## Các điểm cần giải quyết khi lập kế hoạch

- Danh tính ảnh 2 đã xác nhận; guide/điểm theo bộ ba tướng đã được chốt ngày 2026-09-09.
- Tìm đủ bộ chiến pháp chính cho đội mới ở ảnh 7 và 9; không lấy phương án tách đội làm bộ chính.
