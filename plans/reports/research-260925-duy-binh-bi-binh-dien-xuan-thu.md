# Duy Bình Bị trong Binh Diễn Xuân Thu

- Research date: 2026-09-25, Asia/Ho_Chi_Minh
- Branch: team build
- Topic lock: biến thể Khương Duy + Quan Ngân Bình + Lưu Bị trong Binh Diễn Xuân Thu

## Phạm vi và kết luận trước đó

| Trường | Giá trị | Căn cứ |
| --- | --- | --- |
| Mùa | Binh Diễn Xuân Thu / 兵演春秋 | Người dùng đã chọn ở lượt trước |
| Server | unknown | Người dùng chưa nêu |
| Bản cập nhật áp dụng cho tài khoản | unknown | Chưa có thông tin server hoặc chiến báo |

`data/teams.json` đang có `team-intro-17` (Duy Bị Bình, Khương Duy + Lưu Bị + Quan Ngân Bình, Phi Hùng thường) và `moi-phe-111` (Duy Bình Bị, không dùng Phi Hùng). `data/team-tier.json` ghi T0 cho `team-intro-17` từ Zeabur ở **Anh Hùng Mệnh Thế PK-S26**. Đây là nhãn của mùa khác, không được chuyển sang Binh Diễn Xuân Thu. Báo cáo [PK tier](research-260703-team-pk-tier-report.md) cũng đã nêu sai khác vị trí Phi Hùng/Phong Thi giữa bản repo và Zeabur.

Trong `src/data/recommended-reference/current.json`, phép lọc đồng thời ba tướng 姜維, 關銀屏, 劉備 cho 18 cấu hình; không có cấu hình mang `sourceSeasonCode: OG` (Binh Diễn Xuân Thu). **chưa có mốc SGSDeck đã xác minh** cho đúng đội và mùa. Không chuyển điểm hay T0 của mùa khác sang cấu hình này.

## Nguồn đúng mùa và ranh giới chứng cứ

[Kazten, bài đội hình S26 兵演春秋, 08/09/2026](https://kazten.com/entry/2026/09/08/200000) nói rõ đây là hướng dẫn mùa 兵演春秋. Phần trang đã mở xác nhận cơ chế sửa tối đa bốn chiến pháp binh chủng, binh chủng đã sửa vẫn có thể dùng song song với bản thường, và chiến pháp sao chép gồm 拓·草船借箭. Ở phần giải thích đội Khương Duy + Triệu Vân + Lưu Bị, tác giả nhắc đội T0 蜀 `等風騎` có Quan Ngân Bình. Kết quả tìm kiếm của chính bài Kazten hiển thị cấu hình liên quan:

| Vị trí | Chiến pháp trong kết quả tìm kiếm | Tên Việt đối chiếu cục bộ |
| --- | --- | --- |
| Khương Duy | 文武両道 hoặc 刮目相待 + 上兵破謀 | Văn Võ Song Toàn hoặc Sĩ Biệt Tam Nhật + Thượng Binh Phạt Mưu |
| Quan Ngân Bình | 草船借箭 + 鋒矢陣 | Thuyền Cỏ Mượn Tên + Phong Thi Trận |
| Lưu Bị | 霊気一動 + 精飛熊軍 | Nhanh Trí Động Não + Tinh·Phi Hùng Quân |

**Trạng thái: Chưa xác minh** cho đúng sáu chiến pháp của đội này: kết quả tìm kiếm chỉ dùng để định vị, còn đoạn cấu hình tương ứng trong bài chưa được mở trực tiếp. Vì vậy đây là đầu mối nghiên cứu, chưa phải bản khuyên người dùng lắp như một cấu hình đã xác thực. Chủ tướng, sách binh pháp, cộng điểm, tốc độ, điều kiện trang bị và thiết lập nâng cấp Tinh·Phi Hùng Quân cũng chưa được đọc ở đúng mục.

**Đã đối chiếu:** Hai cấu hình của dự án là dữ liệu runtime hiện có; nhãn T0 trong `data/team-tier.json` thuộc Anh Hùng Mệnh Thế, không phải Binh Diễn. Tên Việt của 文武雙全, 靈機一動, 飛熊軍 khớp `data/tactics.json`. Bài Kazten đã mở xác nhận cơ chế binh chủng mùa, nhưng không chứng minh hiệu suất thực chiến của bộ ba trên server người dùng.

**Phương án từ nguồn:** Bài Kazten đề xuất lõi Đẳng Phong Kỵ có Quan Ngân Bình trong nhóm T0 Thục. Đây là xếp hạng của tác giả trong bài, không phải thứ hạng đã được chứng minh cho tài khoản người dùng.

**Chưa xác minh:** Cấu hình sáu chiến pháp dùng Tinh·Phi Hùng Quân ở bảng trên, hiệu suất thực chiến, cỡ mẫu và điểm nguồn cho đúng cấu hình.

## Ràng buộc khi dùng cùng các đội khác

- Nếu Đô Đốc Cung hoặc Cam Ninh + Thái Sử Từ đã dùng Thuyền Cỏ Mượn Tên, bản Kazten trên sẽ tranh chiến pháp gốc. Mùa này có `拓·草船借箭` trong danh sách chiến pháp sao chép, nhưng khả năng mua, số lượt chọn và thời điểm mở khóa của tài khoản cần kiểm tra trước khi ghép đội.
- Nếu đội khác đã dùng binh chủng Phi Hùng tùy chỉnh, không thể mặc nhiên cấp thêm một `Tinh·Phi Hùng Quân` riêng. Phi Hùng thường vẫn dùng song song với một bản tùy chỉnh theo phần cơ chế trong Kazten.
- Dữ liệu mùa khác (`team-intro-17`, `moi-phe-111`) chỉ là đối chiếu, không là biến thể đã chứng minh mạnh nhất cho Binh Diễn Xuân Thu.

## Ngân sách tra cứu và bước tiếp

| Topic | Limit | Used | Remaining |
| --- | ---: | ---: | ---: |
| Duy Bình Bị / Binh Diễn Xuân Thu | 5 | 5 | 0 |

Đã tính ba truy vấn tìm kiếm, một lần mở bài Kazten, một lần tìm trong bài. Không mở thêm nguồn. Lần nghiên cứu tiếp theo cần mở trực tiếp đoạn `等風騎` trong bài Kazten, rồi xác định toàn bộ sáu chiến pháp, chủ tướng, điểm/tốc độ, binh thư và cách sửa Tinh·Phi Hùng Quân; sau đó đối chiếu chiến báo hoặc SGSDeck đúng mùa nếu có.
