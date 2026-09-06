# Bổ sung đội khai hoang từ Google Sheet

Ngày: 2026-09-06. Phạm vi: thêm bộ ba còn thiếu, không thay chiến pháp đội đã có, không sửa quân thủ mỏ.

## Nguồn

- [Google Sheet, gid 562317106](https://docs.google.com/spreadsheets/d/1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw/edit?gid=562317106#gid=562317106).
- Đọc qua export CSV đúng gid, HTTP 200; [snapshot CSV](source-260906-1413-khaihoang-google-sheet.csv).
- Cột A–G chứa đội chính. Cột I–K thuộc bảng riêng “Team Chạm Sứ------mang 1 lính”, không phải chuyển hình và không được import vào `transforms`.

## Đối chiếu

Khóa so sánh là tập ba tên tướng, giữ phân biệt SP/bản thường. Tách dấu `/` ở tên tướng để kiểm tra mỗi lựa chọn; dấu `/` ở chiến pháp vẫn là lựa chọn cùng một ô. Điền binh chủng từ hàng đầu cho ba hàng cùng khối.

| Hàng sheet | Kết quả |
|---|---|
| 21–23 | Thêm SP Lô Trực · Thái Sử Từ · Trương Xuân Hoa, cung |
| 24–26 | Thêm SP Hoàng Nguyệt Anh · SP Mã Siêu · Gia Cát Khác, thương; nhánh Pháp Chính đã có |
| 27–29 | Gia Cát Khác · Thái Sử Từ · Tả Từ đã có; giữ build được duyệt trước |
| 30–32 | Lặp khối 24–26; không thêm lại |
| 33–56 | Tám bộ ba đã có; không đổi chiến pháp |
| 57–62 | Hai build cùng Khương Duy · Quan Ngân Bình · Thái Văn Cơ; đã có |
| 63–65 | Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ đã có |

15 khối nguồn tương ứng 14 bộ ba duy nhất khi tách lựa chọn tướng. Ban đầu 12 đội; thêm 2 thành 14. Giữ toàn bộ 12 đội hiện có và 5 mỏ.

## Giới hạn và quyết định dữ liệu

- Giữ nguyên chiến pháp nguồn cho hai đội mới, không tự thêm binh thư, điểm cộng hoặc tier.
- Ô F23 ghi “Đồng Lòng Hợp Sức”. `data/tactics.json` đang ánh xạ tên này sang 戮力上国, loại Nội chính, qua override mức medium. Chưa đủ chứng cứ xác định tên Hán đúng của ô sheet; giữ nguyên tên và ghi chú hiển thị cần đối chiếu chiến pháp chiến đấu trong game. Không thay bằng Toàn Quân Đồng Lòng hoặc tự sửa từ điển dùng chung.
- Team khai hoang hiển thị chiến pháp dạng text chip, không tự mở mô tả chiến pháp Nội chính này.
- Bổ sung trực tiếp JSON canonical theo cách bảo trì hiện tại; khi rebuild bằng HTML cũ phải bảo toàn ba đội bổ sung ngày 2026-09-06. Snapshot CSV là bằng chứng nguồn, không phải input pipeline tự động.

## Kiểm tra

- Đối chiếu tự động đủ 14 bộ ba nguồn, không trùng; 12 đội trước đó và toàn bộ mỏ giữ nguyên.
- Chiến pháp của hai đội mới khớp từng ô nguồn trước/sau cấp 20.
- 11 test runtime/tactics và 9 test dist đạt; Astro build và verifier 35 file đạt.
- Chưa commit hoặc deploy.

## Còn chưa rõ

- Tên Hán/cơ chế chính xác của “Đồng Lòng Hợp Sức” trong ô F23.
