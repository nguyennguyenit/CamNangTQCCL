# Phe Hán trên client Global 24.547 — Minh Giám (issue #70, mục 6–7)

- Research date: 2026-11-11 (giờ máy, khoảng 22:50–23:10)
- Branch: source verification
- Topic lock: tướng đang ghi phe Quần (và phe khác) trong dữ liệu Tra cứu đã thành phe Hán trên client mùa PK-S27

## Objective

Kiểm trên client mục 6–7 của issue #70: danh sách tướng phe Hán, tướng nào trong repo đang ghi phe khác, và 7 Tướng Tài Hán mới. Không sửa dữ liệu.

## Scope

| Field | Value | How determined |
| --- | --- | --- |
| Server/region | Global (client tiếng Việt) | Client trên máy người dùng |
| Season | PK-S27 (mùa hiện tại theo #66) | Issue #70/#66; client không hiện tên mùa ở màn này |
| Patch/version | Tam Quốc Chí - Chiến Lược 24.547 | Tiêu đề cửa sổ |
| Capture date | 2026-11-11 | Giờ máy |

## Cách kiểm

- Võ Tướng › Minh Giám › Tổng thể › Lọc › Phe = **Hán**: 38 mục (`24/38` đã chiêu mộ). Cuộn từng đoạn nhỏ, các ảnh nối tiếp có dòng chồng nhau nên không sót.
- Võ Tướng (danh sách đã sở hữu) › Lọc › Phe = Hán: kiểm 40Y Lữ Bố (Minh Giám Tổng thể không liệt kê bản 40Y/CO, xem `261015-minh-giam-client-heroes.md`).
- Ảnh: `%TEMP%\tqccl-cap\han\` (`q00`–`q14.png` Minh Giám, `r2`–`r4.png`, `r21`–`r23.png` danh sách sở hữu, `lubo40.png`). Không nằm trong repo.

## 38 tướng phe Hán trong Minh Giám, đối chiếu `data/heroes-dict.json`

| # | Client (tên, COST) | Repo id | Phe repo |
|---|---|---|---|
| 1 | SP Tào Tháo, 7 | `hero:sp-tao-thao` | Hán (khớp) |
| 2 | Đổng Trác, 7 | `hero:dong-trac` | Quần |
| 3 | SP Lô Trực, 6 | `hero:sp-lo-thuc` | Quần |
| 4 | SP Điêu Thuyền, 6 | `hero:sp-dieu-thuyen` | Quần |
| 5 | SP Đổng Trác, 6 | `hero:sp-dong-trac` | Quần |
| 6 | SP Hoàng Phổ Tung, 6 | `hero:sp-hoang-phu-tung` | Quần |
| 7 | SP Chu Tuấn, 6 | `hero:sp-chu-tuan` | Quần |
| 8 | Thái Ung, 6 | `hero:thai-ung` | Quần |
| 9 | Viên Thiệu, 6 | `hero:vien-thieu` | Quần |
| 10 | Trương Nhượng, 5 | `hero:truong-nhuong` | Quần |
| 11 | Hoa Đà, 5 | `hero:hoa-da` | Quần |
| 12 | Hà Thị, 4 (C C B C C) | `hero:ha-thi` ở `retired` | — |
| 13 | Điêu Thuyền, 4 | `hero:dieu-thuyen` | Quần |
| 14 | Thái Văn Cơ, 3 | `hero:thai-van-co` | Quần |
| 15 | Chu Tuấn, 6 | `hero:chu-tuan` | Quần |
| 16 | Trương Doãn, 5 (Tướng Tài) | chưa có | — |
| 17 | Thuần Vu Quỳnh, 5 (Tướng Tài) | chưa có | — |
| 18 | Bảo Tín, 5 (Tướng Tài) | chưa có | — |
| 19 | Khổng Dung, 5 | `hero:khong-dung` | Quần |
| 20 | Hoàng Phổ Tung, 5 | `hero:hoang-phu-tung` | Quần |
| 21 | Trương Nhiệm, 5 | `hero:truong-nham` | Quần |
| 22 | Lô Trực, 5 | `hero:lo-thuc` | Quần |
| 23 | Trần Lâm, 5 | `hero:tran-lam` | **Ngụy** |
| 24 | Hứa Cống, 4 (Tướng Tài) | chưa có | — |
| 25 | Lưu Ngu, 4 (Tướng Tài) | chưa có | — |
| 26 | Lưu Đại, 4 (Tướng Tài) | chưa có | — |
| 27 | Lưu Chương, 3 (Tướng Tài) | chưa có | — |
| 28 | Lưu Biểu, 3 | `hero:luu-bieu` | Quần |
| 29 | Đào Khiêm, 4 | `hero:dao-khiem` | Quần |
| 30 | Hà Tiến, 3 | `hero:ha-tien` | Quần |
| 31 | Đinh Nguyên, 3 | `hero:dinh-nguyen` | Quần |
| 32 | Vương Doãn, 3 | `hero:vuong-doan` | Quần |
| 33 | Lưu Do, 3 | `hero:luu-do` | Quần |
| 34 | Khổng Trụ, 3 | chưa có | — |
| 35 | Trương Mạc, 3 | chưa có | — |
| 36 | Trương Dương, 3 | chưa có | — |
| 37 | Đổng Thừa, 5 | `hero:dong-thua` | Quần |
| 38 | Nguỵ Du, 3 | chưa có | — |
| ngoài Minh Giám | 40Y Lữ Bố (thẻ sở hữu, nhãn Hán) | `hero:40y-lu-bo` | Quần |

## Claim Evidence

| Claim | Status | Ghi chú |
|---|---|---|
| 25 tướng repo ghi Quần (bảng trên, gồm 40Y Lữ Bố) là phe Hán trên client 24.547 | Đã đối chiếu | Minh Giám lọc Hán; 40Y qua danh sách sở hữu |
| Trần Lâm (`hero:tran-lam`, repo Ngụy) là phe Hán | Đã đối chiếu | Ngoài danh sách fanpage |
| Fanpage kể 11 tên (13 id); client đổi thêm 12 tướng Quần (Chu Tuấn, Hoàng Phổ Tung, Lô Trực, Khổng Dung, Trương Nhiệm, Lưu Biểu, Đào Khiêm, Hà Tiến, Đinh Nguyên, Vương Doãn, Lưu Do, Đổng Thừa) + Trần Lâm | Đã đối chiếu | 11 tên fanpage là danh sách Hán Thất "chuyển sang Quần", không phải toàn bộ phe Hán; danh sách đó trên client cũng khác fanpage (mục Hán Thất) |
| Lữ Bố thường, SP Viên Thiệu, Viên Thuật, Giả Hủ… vẫn ngoài phe Hán | Đã đối chiếu | Không có trong 38 mục lọc Hán; thẻ Lữ Bố thường mang nhãn Quần |
| 7 Tướng Tài Hán mới đã có trong client (Chưa chiêu mộ) | Đã đối chiếu | Chưa có trong repo |
| 4 tướng 3★ Hán khác chưa có trong repo: Khổng Trụ, Trương Mạc, Trương Dương, Nguỵ Du | Đã đối chiếu | Ngoài nội dung fanpage |
| Issue ghi "SP Lô Trực chưa có trong repo" | Sai | Có `hero:sp-lo-thuc` (tên client "SP Lô Trực" là alias) |
| Hà Thị "không có ở client Việt Nam" (lý do `retired`) | Đã đối chiếu là đã lỗi thời | Client 24.547 có Hà Thị trong Minh Giám, Hán, COST 4, ăn ý C C B C C |
| Đổi phe Hán ↔ Quần ở Hán Thất chỉ có hiệu lực trong mùa giải này; cài lại tốn 50K Châu, CD 1 giờ | Đã đối chiếu | Lời trong Hán Thất › Xem Võ Tướng |
| Phe trong Minh Giám là phe gốc mùa PK-S27, không đổi theo lựa chọn Hán Thất của tài khoản | Đã đối chiếu | Tài khoản đã chuyển SP Hoàng Phổ Tung sang Quần (ô 1 Hán Thất có nút Cài lại); thẻ sở hữu mang nhãn Quần, Minh Giám vẫn ghi Hán |
| Mặc định Hán vĩnh viễn hay chỉ PK-S27 | Chưa xác minh | Hán Thất chỉ nói lựa chọn chuyển phe có hiệu lực trong mùa |

## Previous Conclusion and Corrections

- `261015-minh-giam-client-heroes.md` và changelog (bỏ Hà Thị "không có ở client Việt Nam"): không còn đúng ở client 24.547.
- Issue #70 mục 6: danh sách 11 tướng là thiếu; phe Hán thực tế lớn hơn (bảng trên). Danh sách Hán Thất "Quần Hùng Tịnh Khởi" trên client có 15 tướng, **không có Thái Ung**, có thêm Chu Tuấn, Trương Nhiệm, Hoàng Phổ Tung bản thường.

## Hán Thất (Sảnh Chính › Hán Thất › Xem Võ Tướng)

Ảnh `%TEMP%\tqccl-cap\han\h1`–`h8.png`. Chọn 3 tướng; cài lại 50K Châu, CD 1 giờ; hiệu lực trong mùa giải này.

| Tab | Hướng | Tướng (client) | So với fanpage |
|---|---|---|---|
| Quần Hùng Tịnh Khởi | Hán → Quần | Đổng Trác, Hoa Đà, Viên Thiệu, Điêu Thuyền, Thái Văn Cơ, Trương Nhượng, SP Chu Tuấn, SP Hoàng Phổ Tung, SP Đổng Trác, SP Điêu Thuyền, SP Lô Trực, 40Y Lữ Bố, Chu Tuấn, Trương Nhiệm, Hoàng Phổ Tung (15) | Thiếu Thái Ung (fanpage có); thêm Chu Tuấn, Trương Nhiệm, Hoàng Phổ Tung. Tên Trương Nhiệm đọc ở khung xem trước khi chọn thẻ (`w8.png`); cuộn tới đáy danh sách (`w7.png`) |
| Phò Tá Hán Thất | khác → Hán | Lữ Bố (`hero:lu-bo`, Quần), Tào Tháo (`hero:tao-thao`, Ngụy), Tôn Kiên (`hero:ton-kien`, Ngô), Giả Hủ (`hero:gia-hu`, Ngụy; thẻ có nhãn S3), Lưu Bị (`hero:luu-bi`, Thục), Công Tôn Toản (`hero:cong-ton-toan`, Quần), Viên Thuật (`hero:vien-thuat`, Quần), SP Viên Thiệu (`hero:sp-vien-thieu`, Quần), SP Tuân Úc (`hero:sp-tuan-uc`, Ngụy) (9) | Khớp 9 tên fanpage; phe gốc trên thẻ khớp repo. Cuộn từng bước 120 px tới đáy (`w1`–`w6.png`): dòng cuối chỉ có SP Tuân Úc |

Màn chính tab Phò Tá Hán Thất (ảnh `t1.png`, `t3.png`): lời "Chuyển 3 Võ Tướng chỉ định sang phe Hán, có hiệu lực trong mùa giải này, sau khi chuyển phe có thể cài lại lựa chọn"; xem trước ghi "Chuyển đổi phe Võ Tướng thành phe Hán, có hiệu lực trong mùa giải này, sau khi chuyển đổi phe có thể tiêu hao 50K.Châu để cài lại, thời gian CD 1 giờ". Hai tab có 3 suất riêng.

Tài khoản hiện chuyển: Quần Hùng Tịnh Khởi 1/3 (SP Hoàng Phổ Tung → Quần); Phò Tá Hán Thất 0/3 (3 ô trống). Lựa chọn là của tài khoản, không thuộc dữ liệu tướng: 9 tướng Phò Tá giữ phe gốc trong dữ liệu.

## Mục 1–5 issue #70: nguyên văn Thượng Thư Đài (client PC 24.547)

Hảo Hữu › Thượng Thư Đài, gõ tên rồi Gửi; chiến pháp bấm "Xem hiệu quả đầy cấp" và kéo khung mô tả tới cuối. Ảnh `%TEMP%\tqccl-cap\han\ttd\` (`1`–`5.png` thẻ cấp 1, `*F_*.png` đầy cấp, `*_sheet.png` ghép). Trước đó người dùng đã kiểm 5 mục này trên client điện thoại (comment issue #70); lần này đối chiếu lại trên PC. Chép đúng chữ client, kể cả lỗi chính tả ("trạnh thái") và khoảng trắng thiếu ("binh đao(tỷ lệ").

### 1. Hà Thị (thẻ cấp 1)

- Phe Hán, COST 4, 5 sao.
- Binh chủng Ăn Ý: Kỵ C, Khiên C, Cung **B**, Thương C, Xe C.
- Võ 34.00 (+0.06), Trí 67.00 (+1.66), Thống 51.00 (+0.82), Tốc 12.00 (+1.02), Trị 73.00 (+1.32), Mị 65.00 (+1.21).
- Chiến Pháp Võ Tướng: Duy Nội Thiện Quyền. Chiến Pháp kế thừa: Tuyệt Kế Chiết Mưu. Duyên Phận Võ Tướng: Không.
- Lệch repo: `hero:ha-thi`, `tactic:duy-noi-thien-quyen`, `tactic:tuyet-ke-chiet-muu` đang ở `retired` (lý do cũ: không có ở client Việt Nam / chỉ có ở SGSDeck). Client 24.547 có cả ba.

### 2. Thập Diện Mai Phục

- Xác suất **40%**; Hiệu quả xung đột: Đảo Phản; Võ Tướng tự mang: Trình Dục; Kế thừa từ: Không; Chủ động, Mưu Lược nhóm, Tập thể địch (2 người).
- Đầy cấp: "Gây cho nhóm địch (2 người) 2 hiệp Cấm Trị Liệu (không thể hồi Binh Lực) và trạnh thái Đảo Phản (tỉ lệ sát thương 37%→74%, chịu ảnh hưởng bởi thuộc tính cao nhất của Võ Lực hoặc Trí Lực, bỏ qua phòng ngự), sau đó gây cho quân địch có trạng thái bất lợi sát thương Mưu Lược (tỉ lệ sát thương 48%→96%, chịu ảnh hưởng bởi Trí Lực)"
- Lời khớp `effectVi` repo từng chữ; chỉ lệch `activationRate` 0.35 → 0.4.

### 3. Trình Dục (thẻ cấp 1)

- Ngụy, COST 6. Ăn Ý: Kỵ S, Khiên C, Cung A, Thương C, Xe A.
- Võ 49.00 (+0.41), Trí 90.00 (+2.32), Thống 70.00 (**+1.67**), Tốc 44.00 (+0.59), Trị 79.00 (+1.30), Mị 58.00 (+0.96).
- Chiến Pháp Võ Tướng: Thập Diện Mai Phục; kế thừa: Thủ Nhĩ Tất Cố; Duyên Phận: Ngũ Mưu Thần.
- Repo `lookup.growth` hiện `thong: 1.36`, các khóa khác khớp; `overrides["hero:trinh-duc"]` chưa có.

### 4. Con Gái Tướng Môn (`tactic:tuong-mon-ho-nu`)

- Xác suất 60%; xung đột: Chấn Động; tự mang: Quan Ngân Bình; kế thừa: Không; Chủ động, Binh đao nhóm, Tập thể địch (2 người).
- Đầy cấp: "Gây sát thương binh đao cho nhóm địch quân (2 người) (tỷ lệ sát thương 64%→128%) và áp dụng hiệu ứng Hổ Cáu: Trong 1 hiệp tiếp theo, mục tiêu chịu thêm sát thương binh đao(tỷ lệ sát thương 10%→20%, khi mục tiêu chịu sát thương thì tỷ lệ sát thương tăng thêm 15%→30%, có thể cộng dồn tối đa 3 lần). Khi cộng dồn đủ 3 lần, lập tức kích hoạt hiệu ứng Hổ Cáu và gây Chấn Động trong 1 hiệp, đồng thời tăng sát thương binh đao do bản thân gây ra thêm 4%→8% (có thể cộng dồn); Bắt đầu từ hiệp thứ 3, sau mỗi lần kỹ năng này phát động, tỷ lệ phát động tăng thêm 4%→8%"
- Cấp 1 câu cuối: "…tỷ lệ phát động tăng thêm 4%". Fanpage ghi 8% là giá trị đầy cấp.
- Lệch repo: client viết lại **toàn bộ** lời (repo còn bản cũ "Gây cho một nhóm quân địch… hiệu quả Hổ Cáu: 1 hiệp sau sẽ nhận thêm…"), không chỉ thêm một câu.

### 5. Khiêu Chiến Quần Hùng (`tactic:nach-chien-quan-hung`)

- Xác suất 35% (không đổi); xung đột: Không; tự mang: Hoa Hùng; kế thừa: Không; Chủ động, Binh đao nhóm, Tập thể địch (2 người).
- Đầy cấp: "Gây ra một lần sát thương binh đao lên Nhóm quân địch (2 người) (TL Sát thương 100%→200%), sau đó bản thân tăng sát thương binh đao gây ra 12.5%→25%,  giảm sát thương binh đao phải chịu (12.5%→25%, ảnh hưởng bởi Võ Lực), duy trì 2 hiệp; Chiến Pháp này sau khi phát động sẽ vào 1 hiệp CD"
- Lệch repo: bỏ "Chuẩn bị 1 hiệp"; thêm "Chiến Pháp này sau khi phát động sẽ vào 1 hiệp CD" (client dùng "CD", fanpage ghi "đếm ngược 1 hiệp"); phần còn lại cũng viết lại câu chữ. `lookup.cooldown` repo đang `null`.

## Hà Thị và 11 tướng Hán chưa có trong repo (client PC 24.547)

Nguồn: thẻ cấp 1 ở Thượng Thư Đài (chỉ số, tăng trưởng, Ăn Ý, chiến pháp); Võ Tướng › Minh Giám (lọc Hán) › bấm tên → trang chi tiết (nhãn vai trò dưới hàng sao, phẩm chữ cái của chiến pháp tự mang, tranh). Ảnh `%TEMP%\tqccl-cap\han\new\` (`h01`–`h11.png` thẻ, `d_<slug>.png` chi tiết, `c01`–`c10*.png` chiến pháp); số liệu chép ở `staged-heroes.json`; chân dung 300×300 cắt từ tranh trang chi tiết ở `portraits/<slug>.webp`. Ăn Ý ở thẻ khớp cột Minh Giám cho cả 12 tướng.

Tên chữ Hán: client không hiện; cột dưới là phiên âm ngược của agent (Chưa xác minh). Hà Thị có 何氏 trong `pipeline/lookup-identity.json` (snapshot SGSDeck).

| Tướng | Chữ Hán (chưa xác minh) | COST | Sao | Kỵ/Khiên/Cung/Thương/Xe | Võ | Trí | Thống | Tốc | Trị | Mị | Vai trò client | Tự mang (phẩm) | Kế thừa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hà Thị | 何氏 | 4 | 5 | C C B C C | 34 (+0.06) | 67 (+1.66) | 51 (+0.82) | 12 (+1.02) | 73 (+1.32) | 65 (+1.21) | Mưu | Duy Nội Thiện Quyền (S) | Tuyệt Kế Chiết Mưu |
| Trương Doãn | 張允 | 5 | 4 | C C S C A | 67 (+1.33) | 42 (+0.97) | 72 (+1.40) | 31 (+0.81) | 56 (+1.17) | 35 (+0.50) | Phụ | Định Quân An Dân (A) | Định Quân An Dân |
| Thuần Vu Quỳnh | 淳于瓊 | 5 | 4 | S C C A B | 66 (+1.31) | 29 (+0.78) | 72 (+1.40) | 59 (+1.21) | 29 (+0.78) | 24 (+0.34) | Võ | Ô Sào Di Hận (A) | Ô Sào Di Hận |
| Bảo Tín | 鮑信 | 5 | 4 | C B S B A | 67 (+1.33) | 81 (+1.53) | 77 (+1.47) | 52 (+1.11) | 73 (+1.41) | 78 (+1.11) | Mưu | Tiên Tri Nhận Chủ (A) | Tiên Tri Nhận Chủ |
| Hứa Cống | 許貢 | 4 | 4 | C C A A B | 66 (+1.31) | 64 (+1.28) | 44 (+1.00) | 27 (+0.76) | 64 (+1.28) | 30 (+0.43) | Võ | Uống Hận Di Trừu (A) | Uống Hận Di Trừu |
| Lưu Ngu | 劉虞 | 4 | 4 | A B C B B | 33 (+0.84) | 70 (+1.37) | 55 (+1.16) | 14 (+0.57) | 78 (+1.48) | 70 (+1.00) | Phụ | Ân Hậu Đắc Chúng (A) | Ân Hậu Đắc Chúng |
| Lưu Đại | 劉岱 | 4 | 4 | A C C S B | 65 (+1.30) | 32 (+0.83) | 53 (+1.13) | 37 (+0.90) | 54 (+1.14) | 35 (+0.50) | Võ | Thủ Chính Xuất Phong (A) | Thủ Chính Xuất Phong |
| Lưu Chương | 劉璋 | 3 | 4 | C B C B C | 5 (+0.44) | 34 (+0.86) | 31 (+0.81) | 16 (+0.60) | 38 (+0.91) | 55 (+0.79) | Phụ | Bế Cảnh Tự An (A) | Bế Cảnh Tự An |
| Khổng Trụ | 孔伷 | 3 | 3 | C C B C C | 16 (+0.18) | 68 (+0.78) | 26 (+0.30) | 17 (+0.20) | 78 (+0.90) | 29 (+0.33) | Chính | Chính Vận (B) | Chính Vận |
| Trương Mạc | 張邈 | 3 | 3 | C C A C C | 53 (+0.61) | 71 (+0.82) | 52 (+0.60) | 18 (+0.21) | 74 (+0.85) | 12 (+0.14) | Võ | Trí Định (B) | Trí Định |
| Trương Dương | 張楊 | 3 | 3 | A C B C C | 70 (+0.80) | 66 (+0.76) | 72 (+0.83) | 20 (+0.23) | 58 (+0.67) | 10 (+0.11) | Võ | Phấn Tiến (B) | Phấn Tiến |
| Nguỵ Du | 魏攸 | 3 | 2 | C C B C C | 29 (+0.27) | 74 (+0.68) | 46 (+0.42) | 52 (+0.48) | 74 (+0.68) | 14 (+0.13) | Phụ | Áp Chế-Sơ (C; có sẵn `tactic:ap-che-so`) | Không |

Ghi chú: Thượng Thư Đài nhận "Ngụy Du" (gõ "Nguỵ Du" chỉ ra gợi ý); Minh Giám và thẻ viết "Nguỵ Du".

### Chiến pháp (nguyên văn đầy cấp, Thượng Thư Đài)

Không mã nào dưới đây có trong `data/tactics.json` (tra tên Việt và chữ Hán ứng viên); Duy Nội Thiện Quyền và Tuyệt Kế Chiết Mưu đang ở `retired` của `pipeline/lookup-client-tactics.json`.

| Chiến pháp | Loại | Buff | Mục tiêu | Xác suất | Xung đột | Tự mang / Kế thừa từ | Hiệu quả đầy cấp |
|---|---|---|---|---|---|---|---|
| Duy Nội Thiện Quyền | Chủ động | Mưu Lược nhóm | Tập thể địch (2 người) | 70% | Không | Hà Thị / Không | Bản thân nhận 5% Công Tâm, có thể cộng dồn, duy trì đến khi kết thúc chiến đấu; và gây sát thương Mưu Lược cho nhóm địch (2 người) (tỷ lệ sát thương 64%→128%, bị Trí Lực ảnh hưởng), nếu mục tiêu có Võ Lực cao hơn bản thân, sẽ gây thêm sát thương Mưu Lược (tỷ lệ sát thương 49%→98%, bị Trí Lực ảnh hưởng) |
| Tuyệt Kế Chiết Mưu | Chủ động | Mưu Lược đơn | Một quân địch | 40% | Kế Tận | Không / Hà Thị | Gây sát thương Mưu Lược cho Võ Tướng quân địch ngẫu nhiên (118%→236%, bị Trí Lực ảnh hưởng) và áp dụng trạng thái Kế Tận, duy trì 1 hiệp |
| Định Quân An Dân | Chỉ huy | Trị liệu | Một quân ta | 100% | Không | Trương Doãn / Trương Doãn | Trong chiến đấu, mỗi hiệp Trị Liệu Võ Tướng quân ta ngẫu nhiên (tỷ lệ Trị Liệu 43%→86%, bị Thống Soái ảnh hưởng) |
| Ô Sào Di Hận | Chủ động | Binh đao nhóm | Tập thể địch (3 người) | 40% | Không | Thuần Vu Quỳnh / Thuần Vu Quỳnh | Gây sát thương Binh Đao cho toàn bộ quân địch (tỷ lệ sát thương 30%→60%, bị Binh Lực tổn thất của bản thân ảnh hưởng) |
| Tiên Tri Nhận Chủ | Chủ động | Mưu Lược nhóm | Tập thể địch (3 người) | 40% | Không | Bảo Tín / Bảo Tín | Bản thân Trí Lực tăng 5%→10%, duy trì 1 hiệp, và gây sát thương Mưu Lược cho toàn thể quân địch (tỷ lệ sát thương 33%→66%) |
| Uống Hận Di Trừu | Chủ động | Binh đao đơn | Một quân địch | 50% | Không | Hứa Cống / Hứa Cống | Gây sát thương Binh Đao cho Võ Tướng Võ Lực cao nhất quân địch (tỷ lệ sát thương 84%→168%) |
| Ân Hậu Đắc Chúng | Đột Kích | Trị liệu | Một quân ta | 50% | Không | Lưu Ngu / Lưu Ngu | Sau khi Tấn công thường, Trị Liệu Võ Tướng quân ta ngẫu nhiên (tỷ lệ Trị Liệu 54%→108%, bị Trí Lực ảnh hưởng) |
| Thủ Chính Xuất Phong | Bị động | Tăng ích | Tôi | 100% | Không | Lưu Đại / Lưu Đại | Sát thương tấn công thường bản thân tăng 15%→30% (chịu ảnh hưởng bởi Võ Lực) |
| Bế Cảnh Tự An | Chỉ huy | Giảm ích | Tập thể địch (2 người) | 100% | Không | Lưu Chương / Lưu Chương | Chiến đấu 4 hiệp đầu, khiến sát thương gây ra của Tập thể quân địch (2 người) giảm 12.5%→25% |
| Chính Vận | Nội chính | Nội chính | Tôi | 100% | Không | Khổng Trụ / Khổng Trụ | Bản thân Chính Trị, Mị Lực tăng 5→10 |
| Trí Định | Bị động | Tăng ích | Tôi | 100% | Không | Trương Mạc / Trương Mạc | Trí Lực và Thống Soái bản thân tăng 10→20 |
| Phấn Tiến | Chủ động | Tăng ích | Tôi | 30% | Không | Trương Dương / Trương Dương | Khiến sát thương bản thân gây ra tăng 10%→20%, duy trì 1 hiệp |

Phẩm chiến pháp đọc ở chữ cái trên trang chi tiết tướng (S/A/B/C). Thích hợp: cả 5 binh chủng cho mọi mục.

### Chữ Hán tên 10 chiến pháp mới (đối chiếu 2026-11-13)

Client Việt không hiện chữ Hán; bản TW (`sanzhan.slgsim.com/zh-hant/tactics/`) chưa có các chiến pháp này. Bản Đại Lục (`sanzhan.slgsim.com/zh-hans/`, host đã duyệt của `zhEffects`) có đủ, khớp tướng mang và số đầy cấp. `nameZh` ghi dạng phồn thể của tên giản thể đó. Hai tên phiên âm ngược trước đây sai và đã sửa.

| Mã | Tên client | Giản thể (sanzhan) | `nameZh` | Đối chiếu |
|---|---|---|---|---|
| `tactic:an-hau-dac-chung` | Ân Hậu Đắc Chúng | 恩厚得众 (20870) | 恩厚得眾 | khớp |
| `tactic:be-canh-tu-an` | Bế Cảnh Tự An | 闭境自安 (20865) | 閉境自安 | khớp |
| `tactic:chinh-van` | Chính Vận | 政运 (trang 孔伷) | 政運 | khớp |
| `tactic:dinh-quan-an-dan` | Định Quân An Dân | 定军安民 (20871) | 定軍安民 | khớp |
| `tactic:o-sao-di-han` | Ô Sào Di Hận | 乌巢遗恨 (20867) | 烏巢遺恨 | khớp |
| `tactic:phan-tien` | Phấn Tiến | 奋进 (trang 张杨) | 奮進 | khớp |
| `tactic:thu-chinh-xuat-phong` | Thủ Chính Xuất Phong | 守正出锋 (20866) | 守正出鋒 | khớp |
| `tactic:tien-tri-nhan-chu` | Tiên Tri Nhận Chủ | 识主先知 (20864; 鲍信, 66%) | 識主先知 | **sửa** từ 先知認主 |
| `tactic:tri-dinh` | Trí Định | 智定 (trang 张邈) | 智定 | khớp |
| `tactic:uong-han-di-truu` | Uống Hận Di Trừu | 饮恨遗仇 (20872; 许贡, 168%) | 飲恨遺仇 | **sửa** từ 飲恨遺讎 |

Số trong ngoặc là mã trang `sanzhan.slgsim.com/zh-hans/tactics/<tên>-<mã>/`. Hiệu ứng chữ Hán vẫn là `zhEffects` kind `translation`: trang sanzhan chỉ có mức đầy cấp, không đủ `x→y` để thành `source`.

### Kết Nghĩa Vườn Đào (Thượng Thư Đài, 2026-11-12)

Chỉ huy, Tăng ích, Tập thể quân ta (3 người), 100%, xung đột Không, tự mang "Chiến Pháp sự kiện, đổi tại sự kiện Kết Nghĩa Vườn Đào", kế thừa Không. Đầy cấp: "Mỗi hiệp có 20%→40% xác suất (chịu ảnh hưởng Thống Soái, mỗi hiệu quả được xét độc lập) thực hiện các hiệu quả sau: Võ Tướng Mị Lực cao nhất quân ta Trị Liệu cá thể quân ta (tỷ lệ Trị Liệu 18%→36%, bị Trí Lực ảnh hưởng); Võ Tướng Thống Soái cao nhất gây sát thương Mưu Lược cho Võ Tướng Trí Lực thấp nhất quân địch (tỷ lệ sát thương 23%→46%, bị Thống Soái ảnh hưởng); Võ Tướng Võ Lực cao nhất gây sát thương Binh Đao cho Võ Tướng Thống Soái thấp nhất quân địch (tỷ lệ sát thương 23%→46%), tỷ lệ sát thương của Chiến Pháp này bị ảnh hưởng bởi lượng Trị Liệu tràn ra tích lũy của quân ta, sau khi kích hoạt sẽ tái lập lại tiến độ tích lũy". Ảnh `%TEMP%\tqccl-cap\han\new\kn*.png`.

### Chữ Hán tên tướng (nguồn ngoài)

[17173, 12/1/2026](https://news.17173.com/content/01122026/155247463.shtml) liệt kê bản CN cập nhật 14/1/2026: 13 tướng Hán mới (SP曹操, 何氏; 4★ 刘璋, 刘岱, 刘虞, 淳于琼, 鲍信, 许贡, 张允; 3★ 张扬 [sic], 张邈, 孔伷; 2★ 魏攸), 12 tướng Quần thành Hán, 9 tướng chuyển sang Hán được. Khớp chữ Hán phiên âm ngược ở bảng trên: Phương án từ nguồn (bài tổng hợp, không phải trang chính thức; CN cho chuyển 2 tướng/mùa, client Global hiện 3).

## Call Budget

| Topic | Allowance | Limit | Used | Remaining |
| --- | --- | ---: | ---: | ---: |
| Phe Hán Minh Giám | External sources | 5 | 4 (2 tìm kiếm, `sanzhan.slgsim.com/zh-hant/tactics`, bài 17173) | 1 |
| Phe Hán Minh Giám | TQCCL MCP | 5 | 0 | 5 |

Client game và file local không tính.

SGSDeck: chưa có mốc SGSDeck đã xác minh (không dùng cho phe).

## Đã áp dụng (2026-11-12, nhánh `fix/issue-70-pk-s27-client`)

Promote `issue70-pk-s27-client` (`lookup:453023488b98`), xem changelog 2026-11-12. `faction: "Hán"` cho 26 tướng + `heroNotes` (ghi phe trước mùa, cách chuyển ở Hán Thất); Hà Thị (Cung B của SGSDeck, tăng trưởng Trí 1.66, chân dung), Trình Dục, mục 2–5 và Kết Nghĩa Vườn Đào theo client; 11 tướng + 10 chiến pháp mới.

Sửa sau review PR #71 (2026-11-13): `heroNotes` có `textZh` (bản dịch, gắn cờ "dịch, chưa đối chiếu") nên bản zh không mất ghi chú mùa của 35 tướng; chữ Hán 10 chiến pháp mới đối chiếu sanzhan (sửa 2 tên). Sau audit Astra: 10 chiến pháp mới khai `source: INHERITANCE` (trước đó `null`, rơi vào nhóm "Khác" của bảng chọn kho); `textZh` giữ chi phí `50K「Châu」` (chưa có tên tiền tệ chữ Hán đã xác minh nên giữ chữ client). Còn mở, theo dõi bằng issue riêng: xung đột Kế Tận và hồi chiêu (`tactics{}` chưa có khóa `conflictsVi`/`cooldown`), phạm vi thời gian của phe Hán, nguồn theo từng bản ghi cho phần chụp 24.547.
