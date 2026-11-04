# Xác minh binh thư, trang bị, tuyệt kỹ, công trình, quân sư từ client Global 24.535 — Thượng Thư Đài

- Ngày: 2026-10-22
- Phạm vi: Global (client "Tam Quốc Chí - Chiến Lược 24.535", tài khoản người dùng); mùa: không áp dụng.
- Nguồn: **Hảo Hữu → Thượng Thư Đài**, tra từng tên; chụp bằng Windows Graphics Capture; nhập liệu qua helper chạy cùng quyền admin với game.
- Kết luận trước: binh thư, trang bị, tuyệt kỹ, công trình, quân sư đều lấy từ nguồn Trung (SGSDeck/bảng map), chưa đối chiếu client.
- Chính sách đang áp dụng (2026-10-16): client bản Việt là chuẩn cho phần tiếng Việt.
- **Đã áp dụng vào dự án** (cùng ngày, xem mục "Đã áp dụng"). Bản chép gốc nằm ở `%TEMP%\tqccl-cap` (`bt/client-books.json`, `eq/client-equipment.json`, `sp/client-specials.json`, `ct/client-buildings.json`), **không nằm trong repo**.

## Kết quả

| Hạng mục | Có thẻ client / kho | Lệch số liệu thật | Tên client khác kho | Trạng thái |
|---|---|---|---|---|
| Binh thư (`books-dict.json`) | 67/68 | 4 | 4 | Đã đối chiếu |
| Trang bị (`lookup-catalog.equipment`) | 103/114 | 0 phẩm/loại (1 mục ghép theo nghĩa lệch loại) | 61 | Đã đối chiếu (nội dung); nối ID theo nghĩa tên: Phương án từ nguồn |
| Tuyệt kỹ (`lookup-catalog.specials`) | 66/90 | 0 (1 lệch nghĩa) | 5 | Đã đối chiếu |
| Công trình (`lookup-catalog.buildings`) | 39/41 | 0 cấp tối đa | 39 | Đã đối chiếu (cấp tối đa, hiệu quả); nối ID theo chức năng và tên Hán: Phương án từ nguồn |
| Quân sư (`lookup-catalog.advisors`) | 39/39 (+20 chỉ có ở client) | 8 điểm Kế Lược, 2 hệ, nhiều số trong mô tả | 15 | Đã đối chiếu (Minh Giám › Quân sư, 2026-10-23); nối 15 mục theo tướng mang: Phương án từ nguồn |

## Binh thư

Mọi thẻ ghi: Xác suất 100%, Loại hình Binh Thư, Buff Tăng ích, Mục tiêu Tôi. Có 63 thẻ tra trúng ngay bằng tên trong kho, tên trên thẻ khớp tên tra. Phép so tự động bắt 14 mục có số khác; đọc lại thì 10 mục chỉ khác cách ghi (3,5 so với 3.5) hoặc do câu có thêm số ("1 quân"). Còn 4 mục lệch thật:

| Binh thư | Kho | Client 24.535 |
|---|---|---|
| Binh Hành Quỷ Đạo 兵行诡道 | giảm 75% sát thương gây ra | **giảm 65%** |
| Tam Quân Chi Chúng 三军之众 | cấp cứu tỷ lệ 25% | **30%** |
| Đánh Bất Ngờ Thắng 出奇制胜 | giảm 50% sát thương, hội tâm/kỳ mưu | **giảm 55%** |
| Đánh Giá Tình Hình 审时度势 | sát thương phải chịu +3% | **+5%** (trị liệu +12% khớp) |

Lệch về nghĩa (số khớp):
- Phòng Bị 防备: kho "giảm 3% sát thương phải chịu"; client "sát thương Binh Đao và sát thương Mưu Lược giảm 3%".
- Chia Nhỏ Đánh Nhanh 分而疾战: kho "giảm 3,5% sát thương phải chịu"; client "sát thương Binh Đao và Mưu Lược giảm 3.5% (bị Tốc độ ảnh hưởng)".
- Thuận Thiên Ứng Thời: client không có câu loại trừ "Đoạt Hồn và Trí Kế".
- Liền Mạch Một Hơi: client không có câu "chiến pháp đột kích không gây sát thương cũng làm giảm 1/3".

Tên client khác kho (tìm qua gợi ý, rồi tra lại ra đúng thẻ):

| Mã | Tên kho | Tên client |
|---|---|---|
| 分利 | Chia Lời | Chia lời |
| 久战 | Chiến Đấu Trường Kỳ | Cửu Chiến (client: "nhận 3% Công Tâm và Làm Phản") |
| 顺天应时 | Thuận Thiên Thuận Tời | Thuận Thiên Ứng Thời |
| 胜而益强 | Thắng Sẽ Càng Mạnh | Thắng Càng Mạnh |

`viet` của binh thư phải thuộc `facets.json.books` (lấy từ dữ liệu đội), nên đổi tên cần đi kèm alias.

**Chưa xác minh**: 驰援 Cứu Viện. Tra "Cứu Viện" chỉ ra thuật ngữ trạng thái Cứu viện. "Trì Viện", "Tiếp Viện", "Chi Viện" chỉ ra gợi ý; "Viện Trợ" là tuyệt kỹ của Áo giáp Bát Bảo Dạ.

## Trang bị

Phẩm chất client "Báu vật" tương ứng **Cam**, "Thượng phẩm" tương ứng **Tím**. Loại hình "Thú cưỡi" tương ứng Tọa kỵ; Vũ Khí, Phòng cụ, Bảo vật giữ nguyên. Cả 103 mục khớp phẩm chất và loại hình của kho, trừ một mục:

- Cân Quắc Nữ Y 巾幗女衣 ghép với "Khăn Choàng Áo Nữ": client ghi **Phòng cụ**, kho ghi Bảo vật. Mục này ghép theo nghĩa tên, cần xác nhận lại trước khi sửa.

Có 61 tên client khác tên kho. Phần lớn chỉ đảo trật tự Hán-Việt hoặc thêm từ loại, ví dụ:
- Đao Thanh Long Yển Nguyệt
- Giáo Trượng Bát Xà
- Kiếm Ỷ Thiên
- Áo giáp Bát Bảo Dạ

Một số tên dịch hẳn nghĩa:

| Kho | Client |
|---|---|
| Huyền Thiết Liên Hoàn Giáp | Giáp Liên Hoàn sắt đen |
| Phụng Sí Hoàng Kim Giáp | Giáp Hoàng Kim Cánh Phượng |
| Lưu Kim Khôi | Mũ Mạ Vàng |
| Cứ Xỉ Đao | Đao răng cưa |
| Kim Ty Nhuyễn Giáp | Giáp Mềm Sợi Vàng |
| Tứ Luân Xa | Xe Bốn Bánh |
| Linh Nhị | Chuông Gió Lông Vũ |
| Dị Kinh | Kinh Dịch |
| Phụ Kỷ Giác | Ly Phụ Kỷ |
| Thác Kim / Thanh Đồng Bác Sơn Lô | Lò Bác Sơn nạm vàng / đồng thau |

Tên client có dấu chấm ở cuối: "Tam lược..", "Binh pháp Ngụy Công Tử.", "Túi thơm La Kỳ.".

Nối ID: client không hiện chữ Hán, nên tên nối theo nghĩa. Ba mục nối chắc nhờ thẻ tuyệt kỹ chuyên dụng nêu tên trang bị: Giáp Mềm Sợi Vàng (Linh Động), Xe Bốn Bánh (Thiên Cơ, Gia Cát Lượng), Chuông Gió Lông Vũ (Phong Thanh).

**Chưa xác minh** (11; tra theo tên kho và tên đoán đều chỉ ra gợi ý): Trảm Xà Kiếm, Điêu Cung Trưởng Kiếm, Bạch Thước, Ô Nhân, Khoái Hàng, Đồng Tước, Phụng Hoàng Vũ Y, Địa Qua Chuỳ, Hàn Thiết Khải, Đại Diệp Thanh Đồng Giáp, Tấn Thiết Trọng Giáp. Riêng Trảm Xà Kiếm: thẻ Hiền Minh ghi "Riêng của Kiếm Trảm Xà", nhưng tra "Kiếm Trảm Xà" không ra thẻ trang bị.

## Tuyệt kỹ

Mọi thẻ ghi "Võ Tướng tự mang: Tuyệt kỹ, trang bị cấp báu vật được mặc". Phép so tự động chỉ bắt 3 mục có số khác:
- Thiên Công và Tế Thế: chỉ do cách diễn đạt.
- Đảm Lược: lệch nghĩa. Kho "tăng 5% xác suất hội tâm (khi kích hoạt, sát thương binh khí tăng 100%)"; client "tăng 5% Tỉ Lệ Hội Tâm và **Làm Phản**".

Chữ client có lỗi gõ, chép nguyên văn: Tế Thế "bie6ln thành", Cương Nghị "trạng thái xấU Ảnh hưởng". Dòng cuối của Củ Khứu bị khung thẻ cắt mất.

Tên client khác kho:

| Kho | Client |
|---|---|
| Trưởng Kiện | Trường Kiện |
| Tê Phong | Xé Gió |
| Tấn Tật | Nhanh chóng |
| Bạo Táo | Nóng Nảy |
| Kỳ Đảo | Cầu nguyện |
| Xung Trận | Xung Phong |

Năm mục sau (Tê Phong đến Xung Trận) nối theo hiệu ứng trùng mô tả kho. Hai tuyệt kỹ "Học Thức" (+8 Chính Trị) và "Vận May" (+8 Mị Lực) có ở client nhưng không ứng với mục nào trong kho.

Chỉ thấy ở client, khác tên trang bị trong kho:
- Kỳ Toán: "Dành cho Tàm Tùng Cẩm Y".
- Nghịch Lân: "Giáp Vảy Rồng vàng sáng"; thẻ trang bị lại ghi "Giáp Lượng Kim Long Lân".

**Chưa xác minh** (24): Vô Cụ, Hiệu Linh, Phù Chú, Trầm Trọng, Hoạt Lực, Hoàn Giáp, Trưởng Lự, Thải Đạp, Tật Trì, Thiên Mệnh, Hồi Hưởng, Kinh Cức, Chu Toàn, Hảo Học, Kỳ Tập, Liên Dinh, Bình Hành, Nhẫn Nhượng, Đoá Thiểm, Cơ Xảo, Lợi Trảo, Khinh Doanh, Vô Uý, Minh Lãng. Tra "Linh Hoạt" ra một **chiến pháp** (có "Xem hiệu quả đầy cấp"), không phải Hoạt Lực.

## Công trình

Bảng "Xây thành" của Thượng Thư Đài có 3 nhóm:
- Nội chính: 12 công trình.
- Quân sự: 18 công trình.
- Phòng bị: 9 công trình.

Mỗi công trình hiện tổng cấp, tính năng mở, hiệu quả tăng cấp và hiệu ứng đặc biệt. Không có chi phí và hiệu ứng từng cấp, nên `levels[]` vẫn chưa xác minh.

- 39/41 công trình kho ứng được với client. **Cấp tối đa khớp toàn bộ.**
- Tên client khác hẳn tên Hán-Việt của kho, ví dụ:

  | Kho | Client |
  |---|---|
  | Thảng Khố | Kho |
  | Thái Thạch Xứ | Điểm nhặt đá |
  | Dã Thiết Đài | Bệ lò rèn |
  | Thiết Tượng Phô | Tiệm lò rèn |
  | Tuần Mã Trường | Trại Luyện Ngựa |
  | Tầm Phỏng Đài | Đài thăm hỏi |
  | Viên Khâu Đàn | Đàn Tế Trời |
  | Suý Linh Đàn | Soái Lệnh Đàn |
  | Thành Phòng Quân | Quân Thủ Thành |
  | Công Trình Dinh | Trại Công Trình |
  | Công Sự Dinh | Doanh trại công sự |
  | Quân Cơ Dinh | Lều cơ mật |
  | Bát Trận Đồ | Trận bát quái |
  | Khí Giới Dinh | Trại Xe |
  | Binh Chiến－Tốc | Binh chiến-Nhanh |

- `summaryVi` đang trống ở 15 công trình. Client có mô tả cho cả 15, ví dụ:
  - Cửu Cung Đồ: tăng sát thương binh đao và mưu lược của đội quân đồng minh trong phạm vi thành.
  - Binh chiến: tăng Võ, Mưu, tỷ lệ Thống Soái và tốc độ của đội quân trong thành.
  - Các trại binh: đều có hiệu ứng đặc biệt khi đầy cấp.
- Đính chính: `building:my-binh-dinh` có tên Hán 盾兵營, tức chính là **Trại Lính Khiên**. Bản trước của báo cáo ghi nhầm "kho thiếu Trại Lính Khiên"; lỗi lộ ra khi verifier dist báo hai trang zh trùng tiêu đề 盾兵營. "Nơi Chiêu Binh" (tăng giới hạn Lính Dự Bị) là `building:trung-binh-xu` 徵兵處.
- **Chưa xác minh**: Quân Vương Điện, Hiệu Uý Phủ. Tra "Điện Quân Vương", "Hiệu Úy Phủ", "Phủ Hiệu Úy" chỉ ra gợi ý.

## Quân sư

Thượng Thư Đài không có hệ thống quân sư (tra 39 tên kỹ năng và các từ "Quân sư", "Phong Lâm Hỏa Sơn", "Tham mưu", "Mưu sĩ", "Bổ nhiệm" đều chỉ ra gợi ý không liên quan; "Thạch Binh Bát Trận" ở đó là kiến trúc đồng minh). Người dùng chỉ đường (video 2026-10-22): **Võ Tướng › Minh Giám › tab Quân sư** (59 kỹ năng) › chọn dòng › **Chi tiết** › biểu tượng **Quân sư**. Bảng chi tiết hiện tên kỹ năng, Loại kỹ năng (hệ), Độ Thuần Thục, Tiêu hao Điểm Kế Lược và Giới thiệu kỹ năng; tướng chưa chiêu mộ vẫn xem được.

Cách chụp (2026-10-23): duyệt tuần tự bằng thẻ kế tiếp ở dải trái Minh Giám (bảng tự cuộn tới dòng đang chọn), mở Chi tiết bằng khớp mẫu nút, kéo trong khung mô tả tới khi chữ không đổi. 59/59 mục, ảnh `%TEMP%\tqccl-cap\qsd\NNN_[a-g].png`, bản chép `qsd/client.txt`. Không bấm nút "Mở khóa".

- 24 mục khớp tên kỹ năng với kho; 15 mục khác tên Hán-Việt, nối theo tướng mang, vd:

  | Kho | Client |
  |---|---|
  | Tịch Quyển Tây Lương | Quét Qua Tây Lương |
  | Hoành Trưng Bạo Liễm | Sưu Cao Thuế Nặng |
  | Minh Thệ Thủ Ngự | Bảo Vệ Lời Thề |
  | Đằng Giáp Ngự Địch | Giáp Mây Chống Địch |
  | Lâm Địch Chế Biến | Gặp Địch Ứng Biến |

- Điểm Kế Lược lệch: Trương Liêu 10→12, Vu Cát 15→10, Đổng Trác 13→14, Chung Hội 15→13, Chu Thái 20→18, Quách Gia 10→9, Lý Nho 12→20, Hoàng Nguyệt Anh 20→18.
- Hệ lệch: Đổng Trác Sơn→Lâm, Viên Thiệu Hỏa→Phong.
- Mô tả lệch số, ví dụ: Tư Mã Ý tăng 8 điểm Trí Lực (kho 5); Vu Cát, Tôn Thượng Hương, Tả Từ, Điêu Thuyền khác nhiều số.
- 3 quân sư kho chưa có tướng mang nay đã có: Thống Quân Tái Chiến (Trương Lương), Chấn Phấn Ngang Dương (Hoàng Phổ Tung), Thượng Tướng Uy Danh (Phan Phụng).
- 20 quân sư kho chưa có: Hiệu Lệnh Thiên Hạ (Tào Tháo), Bạch Mã Thay Chủ (Bàng Thống), Vô Kiên Bất Hãm (SP Nhạc Tiến), Tích Lịch Xa Trận (SP Lưu Diệp), Tiết Nghĩa Đa Mưu (Vương Dị), Hổ Vệ Thần Uy (Hứa Chử), Đơn Độc Thâm Nhập (Từ Hoảng), Lao Thẳng Phía Trước (SP Hoàng Trung), Ký Họa Sách Toán (SP Pháp Chính), Võ Thánh Dương Uy (Quan Hưng), Chu Nghịch Bình Phản (Mã Đại), Sủng Vinh Ái Đãi (SP Bộ Luyện Sư), Tình Khiên Kích Nghịch (SP Điêu Thuyền), Tây Lương Phi Hùng (SP Đổng Trác), Thiên Công Tướng Quân (Trương Giác), Đón Quân Đợi Chiến (Đặng Ngải), Bá Vương Thảo Nghịch (Tôn Sách), Chí Bẩy Trận (Cao Thuận), Kế Hoạch Chu Toàn (Trần Cung), Tập Địa Đoạt Thành (Trương Yến).
- Chép mô tả: thẻ nhãn (Động Viên, Bị Động, Xung phong, Binh Pháp, Dưỡng Sức, Từ Xa, Chi Viện, Thống Lĩnh) ghi thành tiền tố "Nhãn: …"; bỏ dòng trạng thái riêng của tài khoản ("số lần sử dụng còn lại hôm nay", "Chiến Công Trợ Chiến hôm nay", "Lãnh địa đã tưới tiêu"). Mô tả Đổng Trác SP hiện nhãn giữa câu ("Dành riêng cho [Động Viên] Kỵ"), ghi lại thành "Động Viên: Dành riêng cho Kỵ".

## Sự cố khi thao tác

- Game chạy quyền Administrator (integrity High). Lệnh đặt con trỏ từ shell quyền thường bị Windows chặn, nhưng lệnh bấm chuột vẫn tới game. Vài cú bấm đầu vì thế rơi vào chỗ chuột thật đang đứng, và đã mở cửa hàng **Thương nhân**, hiện **"Mua thành công"**. Món đã mua chưa xác định; người dùng cần kiểm tra trong game.
- Cách khắc phục: chạy helper điều khiển ở quyền admin. Helper đọc lại vị trí con trỏ trước mỗi lần bấm và không bấm nếu lệch quá 2 px. Từ lúc đó không còn cú bấm lệch.

## Đã áp dụng

- Binh thư: `effectViet` của 67 mục lấy chữ client (`pipeline/books-han-viet-map.json`), gồm 4 số đã sửa. Trường mới `effectVietVersion: "Global 24.535"` là mốc của riêng chữ Việt: trang Việt hiện mốc này, trang zh vẫn hiện `effect`/`effectVersion` nguồn Trung. Tên binh thư **giữ nguyên**, vì tên nằm trong facet đội và quyết định slug; 4 tên client chưa đưa vào.
- `pipeline/lookup-client-tactics.json` có thêm `equipment` (60 tên), `specials` (66 tên + mô tả), `buildings` (39 tên, 15 `summaryVi` còn trống), `advisors` (39 mục: tên, hệ, điểm, mô tả, tướng mang) và `newAdvisors` (20 mục). Builder `_apply_client_catalog` đổi tên hiển thị, đưa tên cũ vào `aliasesVi`, chỉ ghi đè trường được khai, và ghi `lookup.advisorId` của tướng theo quân sư client.
- Không áp dụng:
  - Cân Quắc Nữ Y: ghép theo nghĩa, mâu thuẫn loại hình.
  - Mô tả Củ Khứu: bị cắt chữ.
- Sửa lỗi gõ của client khi chép mô tả:
  - Tế Thế: "bie6ln" → "biến".
  - Cương Nghị: "xấU Ảnh" → "xấu ảnh".
- Phát hành:
  - Lookup generation `lookup:5eded4b4…` (gồm cả quân sư).
  - Transaction `client-catalog-261022-r2`, activation paths [].
  - Ledger slug 958 mã (thêm 20 quân sư), slug cũ không đổi.
  - Localization publish và prune: Recommended `bd231581…`.
  - Ghim lại team route, báo cáo zh-gaps, digest MCP.

Còn mở:
- Tên client cho binh thư (cần đổi cùng facet và slug).
- Cân Quắc Nữ Y (loại hình).
- Đảm Lược (client có thêm "Làm Phản").
- 11 trang bị, 24 tuyệt kỹ, 1 binh thư, 2 công trình chưa xác minh. Quân sư mới chưa có chữ Hán (client không hiện) và chưa có `usageVi`.

## Giới hạn

- Mỗi thẻ chỉ chép một lượt. Báo cáo chiến pháp trước chép hai lượt độc lập, lượt này chưa có lượt thứ hai. Tên đã soát trên ảnh bằng dải tên cạnh tên tra. Số liệu đọc trên ảnh gốc độ phân giải 1282×752.
- Công trình chỉ có cấp tối đa và mô tả hiệu quả, không có số liệu từng cấp.
- SGSDeck: chưa có mốc SGSDeck đã xác minh. Client Global là nguồn có thẩm quyền độc lập.

## Budget ledger

Topic: xác minh binh thư, trang bị, tuyệt kỹ, công trình, quân sư từ Thượng Thư Đài client 24.535.

| Allowance | Limit | Used | Remaining |
|---|---|---|---|
| External sources | 5 | 0 | 5 |
| TQCCL MCP | 5 | 0 | 5 |
