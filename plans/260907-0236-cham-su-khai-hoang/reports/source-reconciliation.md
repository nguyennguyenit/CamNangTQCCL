# Đối chiếu bảng Chạm Sứ

Ngày: 2026-09-07. Phạm vi: đối chiếu nguồn để thêm `chamSuTeams` và bỏ attachment `teams[].transforms` sai nghĩa; không rebuild toàn bộ JSON.

## Nguồn và boundary

- [Snapshot CSV ngày 06/09/2026](../../reports/source-260906-1413-khaihoang-google-sheet.csv), cột I–K, hàng 21–43; xuất từ [Google Sheet gid 562317106](https://docs.google.com/spreadsheets/d/1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw/edit?gid=562317106#gid=562317106).
- HTML local `Meta Team PK/Khai hoang.html` ghi header “Team Chạm Sứ------mang 1 lính”; [fixture HTML có provenance](../../../tests/fixtures/khaihoang-cham-su-source.html) lưu bằng chứng phục vụ clean-clone tests.
- [Quyết định import trước](../../reports/import-260906-1413-khaihoang-google-sheet.md) đã xác định A–G là bảng đội chính, I–K là bảng riêng. Nhóm phải không phụ thuộc số hàng hoặc điểm kết thúc đội bên trái.

## Quyết định theo từng cặp

Các số hàng bên dưới là hàng sheet/record CSV, không phải số dòng vật lý khi ô chứa xuống dòng. Mỗi chiến pháp đi cùng tướng theo đúng thứ tự hai hàng.

| Hàng CSV | Nhóm | Chiến pháp tương ứng | Quyết định |
|---|---|---|---|
| 21–22 | Lữ Mông · Giả Hủ | Bạch Mã Nghĩa Tòng · Ngụy Thư Tương Gian | Giữ; alternatives ở cấp nhóm |
| 24–25 | Mã Siêu · Hoàng Nguyệt Anh | Lõa Y Huyết Chiến · Phong Thi Trận | Khớp HTML |
| 27–28 | Trương Nhượng · Hoàng Nguyệt Anh | Văn Võ Song Toàn · Phong Thi Trận | Khớp HTML |
| 30–31 | Tôn Thượng Hương · Lăng Thống | Lõa Y Huyết Chiến · Phong Thi Trận | Dùng CSV: Lăng Thống đổi từ Tây Lương Thiết Kỳ trong HTML sang Phong Thi Trận |
| 33–34 | Thái Sử Từ · Lăng Thống | Bách Kỵ Kiếp Doanh · Hổ Báo Kỳ | Khớp HTML |
| 36–37 | Hạ Hầu Uyên · Tào Thuận | Lõa Y Huyết Chiến · Thiết Kỳ Khu Trì | Khớp HTML |
| 39–40 | Mã Siêu · Lăng Thống | Lõa Y Huyết Chiến · Phong Thi Trận | Cặp mới chỉ có trong CSV |
| 42–43 | Cam Ninh · Lăng Thống | Phá Quân Uy Thắng · Phong Thi Trận | Cặp mới chỉ có trong CSV |

Hàng 23, 26, 29, 32, 35, 38 và 41 trống ở bảng phải, ngăn các cặp. Ô K21 trong HTML có `rowspan="2"`, phủ Lữ Mông và Giả Hủ; CSV chỉ điền K21 với “Điêu Thuyền, Hoàng Cái, Phùng Kỷ”, K22 trống. Vì vậy lưu alternatives một lần trong `note` của nhóm, không gán riêng cho Lữ Mông hoặc nhân đôi cho hai tướng. Mọi nhóm giữ ghi chú “Mang 1 lính.” theo header, không thêm giải thích cơ chế.

## Migration và giới hạn tái tạo

Runtime chọn tám cặp từ CSV. Parser/helper HTML vẫn phản ánh sáu cặp trong snapshot HTML, gồm chiến pháp cũ của Lăng Thống ở cặp Tôn Thượng Hương; không giả vờ HTML đã nhận dữ liệu CSV mới hơn. CSV chỉ là bằng chứng curate, chưa được tự nhập bởi pipeline. Không chạy full builder để tránh ghi đè dữ liệu đã curate.

Baseline trước mutation nằm ở [`khaihoang-baseline.json`](khaihoang-baseline.json). Đối chiếu JSON hiện tại với baseline, chỉ loại `teams[].transforms` khỏi baseline và `chamSuTeams` khỏi kết quả, cho hai object bằng nhau: giữ nguyên 15 đội, variants/options, `season`, `seasonNote` và toàn bộ 5 mỏ. Bảy attachment `transforms` cũ (có Trình Phổ đứng riêng) không phải tám cặp nguồn, nên không chuyển nguyên attachment sang danh sách mới.

`chamSuTeams` là bổ sung public JSON; removal `teams[].transforms` là sửa nghĩa dữ liệu nhưng có thể ảnh hưởng consumer bên ngoài đọc field cũ. Consumer cần đọc nhóm độc lập, không tái tạo quan hệ chuyển hình. Việc rà consumer và kiểm thử tích hợp được ghi riêng trong báo cáo validation của controller. Không thêm tier, binh chủng, chủ tướng, tướng thứ ba hoặc cơ chế không có trong nguồn.

## Câu hỏi còn lại

Không có câu hỏi về đối chiếu tám cặp; báo cáo này không xác nhận deploy hoặc consumer bên ngoài chưa được quan sát.
