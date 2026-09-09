# Ledger chép 11 guide khai hoang

Ngày rà soát: 2026-09-09. Nguồn thao tác đã xác minh: [Yaojing Team — 开荒配将](https://www.yaojingteam.com/tools/lineup/) (mở `开荒配将` → `匹配开荒队伍` → `看个示例`; mở từng card). Bản dữ liệu công khai đối chiếu: `https://www.yaojingteam.com/tools/lineup-app/js/data/kaihuang.js`.

Mỗi dòng dưới đây được chép vào một `teams[].guide`, theo đúng bộ ba tướng; không có `variant.guide`. Các điểm là sáu cột theo thứ tự Đất 4 / Đất 5 / Đất 6 / Đất 7–8 / Chuyển / Tổng. Danh sách thủ Đất 4 và Đất 5 giữ nguyên thứ tự dễ → khó ở `data/khaihoang.json`; kiểm thử fixture độc lập giữ từng thứ tự đầy đủ.

| Card nguồn | Bộ ba tướng | Điểm | Hột / tách đội / chuyển hình |
| --- | --- | --- | --- |
| 三势陆 | Lục Tốn · Tả Từ · Trương Xuân Hoa | 6.8 / 7 / 7 / 7 / 7 / 6.96 | Tướng trắng dùng được; tách đánh Thương; Nhục/Xã Tắc/Đô Đốc/Tam Tiên ở thành 7, chuyển trần 48 giờ. |
| 关乐枪 | Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ | 6 / 7 / 8.5 / 8 / 5 / 6.9 | Tướng trắng dùng được; không khuyến nghị tách đội; Ngũ Hồng Thương, Quan Quan Trương, hoặc chuyển trần 48 giờ. |
| 关乐诸 | Gia Cát Khác · Quan Ngân Bình · Nhạc Tiến | 7 / 8 / 8.5 / 9 / 7 / 7.9 | Tướng trắng dùng được; ba phương án tách đội; Ngũ Hồng Thương, Quan Quan Trương, hoặc chuyển trần 48 giờ. |
| 夏太黄 | Hạ Hầu Uyên · Thái Sử Từ · Hoàng Nguyệt Anh | 6 / 7 / 6.8 / 6 / 8 / 6.76 | Tướng trắng dùng được; tách đất 5 không phải Thương; Uyên Kỵ/Hổ Thần Cung/chuyển trần 48 giờ. |
| 姜夏恪 | Khương Duy · Hạ Hầu Uyên · Gia Cát Khác | 8 / 9 / 8.5 / 7 / 8 / 8.1 | Tướng trắng dùng được; tách Thương hoặc Trần Kiểu; Uyên Kỵ/Đẳng Phong/Kỳ Lân/chuyển trần 48 giờ. |
| 姜夏法 | Khương Duy · Hạ Hầu Uyên · Pháp Chính | 7 / 7.5 / 7 / 6.5 / 7.5 / 7.1 | Tướng trắng dùng được; hai nhánh đất 5; Đẳng Phong/Thục Kỵ/Kỳ Lân/Tam Thế Trương Giác/chuyển trần 48 giờ. |
| 张吕左 | Trương Xuân Hoa · Lữ Bố · Tả Từ | 7.5 / 8 / 8.5 / 7.5 / 8.5 / 8 | Tướng trắng dùng được; hai nhánh tách; Ôn Hầu giữ riêng thành 7 luyện Hứa Du, thành 8 đủ 18 thống ngự rồi thêm; Bế Nguyệt/Lữ Bố碰瓷/chuyển trần 48 giờ. |
| 恪太左 | Gia Cát Khác · Thái Sử Từ · Tả Từ | 9 / 10 / 10 / 8.5 / 8.5 / 9.2 | Thái Sử Từ tối thiểu 3 đỏ; hai nhánh tách; Hổ Thần/Khảng Khái/chuyển trần 48 giờ. |
| 朱夏恪 | SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác | 8 / 8 / 8 / 7 / 8 / 7.8 | Tướng trắng dùng được; hai nhánh tách; Uyên Kỵ/Hạch Bạo/Quần Cung/chuyển trần 48 giờ. |
| 蜀骑 | Khương Duy · Quan Ngân Bình · Thái Văn Cơ | 7.5 / 7.5 / 7.8 / 8 / 7 / 7.56 | Tướng trắng dùng được; hai nhánh đất 5; Đẳng Phong/Thục Kỵ/Kỳ Lân/Quan Quan Trương/Ngũ Hồng/chuyển trần 48 giờ. |
| 袁夏张 | SP Viên Thiệu · Hạ Hầu Uyên · Trương Xuân Hoa | 7.5 / 7.8 / 7.5 / 7 / 8.5 / 7.66 | Tướng trắng dùng được; hai nhánh tách; Uyên Kỵ/Hạch Bạo/Quần Cung/chuyển trần 48 giờ. |

## Điều kiện chung và build tách biệt

- Tất cả 11 guide giữ nguyên cảnh báo: Tào Chương Khiên, Hoàng Quyền Cung và Trần Kiểu Khiên nên tránh; cuối danh sách khó hơn. Riêng thứ tự từng đội không bị thay bằng xếp hạng chung.
- Image 7 (`张吕左`): guide là dữ liệu roster. Build quan sát được chỉ sau cấp 20: Trương Xuân Hoa chủ tướng Cung với Thịnh Khí Linh Địch / Võ Phong Trận; Lữ Bố Thôi Phong Đoạn Nhẫn / Mau Giành Lợi Thế; Tả Từ Lâm Nguy Cứu Chủ / Tạm Lánh Sóng Gió. Không gán build trước cấp 20.
- Image 9 (`朱夏恪`): trước cấp 20 SP Chu Tuấn chủ tướng; sau cấp 20 Gia Cát Khác chủ tướng. Cả hai giai đoạn Cung, với các slot chiến pháp chép trong fixture độc lập và `tests-js/khaihoang-data.test.mjs`.

Giới hạn: đây là phương án từ nguồn, không là kết luận meta Global hay chứng minh tỷ lệ thắng. Nội dung source/region/mùa giữ trong metadata nội bộ; UI Khai hoang không hiển thị provenance.
