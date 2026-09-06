# Research đội khai hoang Gia Cát Khác – Thái Sử Từ – Tả Từ

Ngày kiểm tra: 2026-09-06. Phạm vi: research; không cập nhật dataset hoặc tier công khai.

## Kết luận

Đội cung thường được gọi 武锋太史慈 / 恪太左 / 左太恪; cộng đồng Hàn gọi 제태좌. Có căn cứ sử dụng thực tế ở CN, cộng đồng Hoa ngữ phồn thể và KR. Chưa đủ căn cứ xác nhận sức mạnh hoặc mốc mở đất cho mọi mùa Việt/Global.

## Cấu hình tham khảo

| Tướng | Trước cấp 20 | Sau cấp 20, đã thức tỉnh |
|---|---|---|
| Gia Cát Khác, chủ tướng | Võ Phong Trận | Thêm Thịnh Khí Linh Địch |
| Thái Sử Từ | Thôi Phong Đoạn Nhẫn | Thêm Mau Giành Lợi Thế |
| Tả Từ | Vô Đương Phi Quân | Thêm Thời Cơ Chiến Thắng |

Bản này theo [hướng dẫn của 凱獃 trên Bahamut](https://forum.gamer.com.tw/C.php?bsn=36815&snA=11475). Trang mở trực tiếp lỗi; nội dung cấu hình đọc được qua chỉ mục tìm kiếm. Đây là hướng dẫn cộng đồng, chưa xác minh server cụ thể.

## Căn cứ và khác biệt

- [17173, 2025-12-12](https://news.17173.com/content/12122025/075308054.shtml): bài tổng hợp 秋石小军师, đề nghị Thái Sử Từ từ 3 hột; có thảo luận chiến báo và ảnh. Chưa đọc được số liệu từng ảnh nên không tính tỷ lệ thắng hay tổn thất trung bình.
- [17173, 2026-01-31](https://news.17173.com/content/01312026/204309618.shtml): biến thể Tả Từ dùng Tạm Lánh Sóng Gió, cộng trí; điều kiện thử nghiệm có nhiều hột và trang bị 灵动. Không ghép mốc thành tích của biến thể này vào cấu hình khác.
- [Xiaomi, 2026-04-16](https://game.xiaomi.com/viewpoint/1663267689_1776314759664_100): giải thích phối hợp liên kích, giảm sát thương, né tránh, chống đỡ và Võ Phong; dùng Sĩ Biệt Tam Nhật ở Gia Cát Khác sau cấp 20.
- [DCInside KR, 2026-04-13](https://gall.dcinside.com/mgallery/board/view/?id=3kingdoms&no=355794): người chơi ghi nhận cùng bộ khung; dùng Sĩ Biệt Tam Nhật, chuyển Trình Phổ sau quân vương điện 7. Một bài trải nghiệm, chưa phải mẫu thống kê.
- [Kunduo, 2026-04-13](https://www.kunduo.com/strategy/41151.html): gợi ý chờ khoảng cấp 25–27 mở đất 6; cảnh báo Văn Sính khiên và việc nhìn riêng con số chiến báo có thể đánh giá thấp tổn thất thực.

Đã tìm CN, phồn thể, KR, JP, EN, VI. Chưa thấy nguồn JP/EN/VI đủ sát bộ ba để xác nhận độc lập; video Hoa ngữ gắn hashtag tiếng Nhật không được tính là bằng chứng server Nhật.

## Kiểm tra dữ liệu và logic

- `data/teams.json` và `data/khaihoang.json`: không có mục chứa đủ ba tên; không tự gán T0.
- `data/tactics.json`: Thôi Phong Đoạn Nhẫn = 摧锋断刃, đang `pending`, thiếu cơ chế. Khác Phá Phong Đoạn Nhẫn = 破锋断刃 trong `data/tactics-generic.json`.
- Tên Việt local: 速乘其利 = Mau Giành Lợi Thế; 临机制胜 = Thời Cơ Chiến Thắng; 盛气凌敌 = Thịnh Khí Linh Địch.
- Thần Xạ local ghi liên kích và giảm thống; chưa có phần giảm võ được một số nguồn mới nhắc đến. Không dùng dữ liệu cũ để khẳng định client Việt đã nhận chỉnh sửa.
- Võ Phong cần ba mức thích tính khác nhau. Giữ Thái Sử Từ làm phó tướng gây sát thương; kiểm tra lại thích tính nếu dùng bảo vật hoặc cơ chế mùa.
- Vô Đương chỉ dùng cung. Độc của Vô Đương hỗ trợ nhánh hiệu ứng bổ sung của Thời Cơ Chiến Thắng. Sĩ Biệt cấm đánh thường đầu trận nên không đặt lên Thái Sử Từ.

## Còn chưa rõ

- Server/kịch bản, phiên bản Thần Xạ và Thôi Phong của người dùng.
- Hột tướng, chiến pháp, trang bị và mục tiêu chuyển đội đầu tiên.
- Binh thư: chưa có bộ được kiểm chứng trong các nguồn đã đọc; không tự điền.
