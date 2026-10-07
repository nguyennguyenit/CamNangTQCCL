# Nguồn hiệu ứng binh thư và các tên chưa có link Tra cứu

- Thời điểm research: 2026-09-28 (Asia/Saigon)
- Dữ liệu runtime đối chiếu: generation `6ded1637…` (`src/data/recommended-reference/current.json`)
- File dữ liệu kèm theo: [`research-260928-binh-thu-effects.json`](research-260928-binh-thu-effects.json)

## Mục lục

1. [Kết quả chính](#kết-quả-chính)
2. [Nguồn hiệu ứng binh thư](#nguồn-hiệu-ứng-binh-thư)
3. [Tên chưa có link: danh tính](#tên-chưa-có-link-danh-tính)
4. [Lỗi phát hiện trong dữ liệu hiện có](#lỗi-phát-hiện-trong-dữ-liệu-hiện-có)
5. [Giới hạn](#giới-hạn)
6. [Trạng thái sau triển khai (2026-10-07)](#trạng-thái-sau-triển-khai-2026-10-07)
7. [Câu hỏi còn mở](#câu-hỏi-còn-mở)

## Kết quả chính

- **Đã có mô tả hiệu ứng cho cả 66 mục của `books-dict`**, cùng 7 binh thư chưa có trong từ điển. Nguồn là ba bài công khai, đọc được toàn văn. Dữ liệu nằm trong file JSON kèm theo, gồm tên nguồn, nhánh, văn bản hiệu ứng, phiên bản số liệu và URL.
- **Đã xác định được 7 trên 8 ô chiến pháp** và toàn bộ 32 ô binh thư chưa link:
  - 3 ô `拓濟世救貧` là `拓·濟貧好施`, loại chiến pháp đã có trong project.
  - 2 ô là placeholder.
  - 3 ô là chiến pháp dị tộc tự tạo, không có hiệu ứng cố định.
  - Ô duy nhất chưa có danh tính: không có.
- **Bốn mục trong dữ liệu hiện có đang sai**:
  - `出其不意` được ghi là binh thư, nhưng thực ra là chiến pháp.
  - `以武止戈` không có trong bất kỳ nguồn nào.
  - `以退為進` đang trỏ link nhầm sang Dĩ Trực Báo Oán (6 ô).
  - `顺应天时` ghi đảo chữ so với tên nguồn.

## Nguồn hiệu ứng binh thư

| Nguồn | Nội dung | Ngày | Đánh giá |
| --- | --- | --- | --- |
| [Bahamut 5254 "兵書大全"](https://forum.gamer.com.tw/C.php?bsn=36815&snA=5254) | Hiệu ứng từng binh thư của 4 nhánh gốc (作戰/虛實/軍形/九變), 49 mục, tên TW | 2021-11-28 | Đầy đủ nhất cho các nhánh gốc. Tên dùng chữ giống SGSDeck (TW). Số liệu thuộc năm 2021. |
| [Bahamut 9596 "(陸)新武將/事件/兵書"](https://forum.gamer.com.tw/C.php?bsn=36815&snA=9596) | Hai nhánh mới 始計/用間 (24 mục) và 6 binh thư được điều chỉnh | 2024-07-13 | Chép lại thông báo bên CN. Có một lỗi gõ ("百次", đúng là "首次"). |
| [7724 156851](https://m.7724.com/sgzzlbyx/news/156851.html) | Cùng nội dung với Bahamut 9596, chữ giản thể | 2024-07-12 | Nguồn CN độc lập, dùng để đối chiếu 9596. |

Cách chọn số liệu: nếu binh thư có trong đợt điều chỉnh 2024-07 thì lấy số 2024, còn lại lấy số của bài 2021. Mỗi dòng trong JSON ghi rõ `version` và `source`.

Không dùng các nguồn sau:
- 9game `3980828`: bị captcha.
- 7724 `95823`: bản dịch máy lỗi, tên binh thư bị dịch sai nghĩa.
- 17173 (2021-09): chỉ có nhận xét, không có mô tả.

Ví dụ ba mục từ file JSON:

```json
{"viet": "Chia Lời", "sourceName": "分利", "category": "用間",
 "effectZhTw": "自身受到兵刃傷害後，統率提升1%，受到謀略傷害則智力提升1%,分別可疊加5次",
 "version": "2024-07", "source": "https://forum.gamer.com.tw/C.php?bsn=36815&snA=9596"}
{"viet": "Tinh Thần Sảng Khoái", "sourceName": "神清氣凈", "category": "始計",
 "effectZhTw": "自身累計受到2次控制狀態時,清除我軍單體負面狀態,僅觸發1次"}
{"viet": null, "sourceName": "無功而厲", "category": "九變",
 "effectZhTw": "每回合行動時，若自身處於繳械、計窮、震懾或混亂狀態，則恢復一定兵力(恢復率80%)"}
```

## Tên chưa có link: danh tính

| Tên SGSDeck (ô) | Danh tính | Bằng chứng | Trạng thái |
| --- | --- | --- | --- |
| 順天應時 (21) | Là mục `顺应天时` / Thuận Thiên Thuận Tời có sẵn: binh thư chính nhánh Hư Thực, 35% cơ hội kéo dài trạng thái thêm 1 hiệp | Bahamut 5254 dùng đúng tên `順天應時`; 17173 ghi `顺应天时` và cũng xếp là binh thư chính Hư Thực | Đã khớp tên và nhánh |
| 分利 (8) | Chia Lời | Hiệu ứng CN (Bahamut 9596 và 7724) trùng từng điều khoản với hiệu ứng trên client VN mà report 2026-06-24 đã ghi: chịu Binh Đao → Thống +1%, chịu Mưu Lược → Trí +1%, cộng dồn 5 lần | Đã khớp hiệu ứng |
| 無功而厲 (3) | 无功而励 (TW viết `厲`), binh thư chính nhánh Cửu Biến | Bahamut 5254 dùng đúng chữ `無功而厲`; hiệu ứng lấy theo bản 2024 | Đã khớp tên. **Chưa có tên game VN.** |
| 拓濟世救貧 (3) | `拓·濟貧好施`: chiến pháp tự mang của Lỗ Túc được "拓印" (sao ra thành chiến pháp dùng chung) trong kịch bản Bá Vương Thảo Nghịch, năm 2025 | [17173 2025-03-22](https://news.17173.com/content/03222025/172101372.shtml): mục "拓·济贫好施" có ví dụ đội "姜维+庞统+诸葛亮（济贫）". SGSDeck `team-nhg3` Thục Cung cũng cho Gia Cát Lượng mang `拓濟世救貧` trong đúng đội đó. SGSDeck ghi sai chữ. | Khớp đội và người mang; chữ nguồn sai |
| 異族弓 / 異族盾 (3) | Chiến pháp binh chủng dị tộc tự tạo của kịch bản Đồng Quan: chọn 3 trong 34 hiệu ứng, tự đặt tên, không có hiệu ứng cố định | [ali213](https://m.ali213.net/news/gl2312/1276373.html); ghi chú SGSDeck cũng ghi từng bản riêng ("淨化+雙治療", "連擊+群弓") | Không thể có hồ sơ chiến pháp riêng |
| 輔兵器, 瞬發主動戰法 (2) | Placeholder | Ghi chú SGSDeck: "「輔兵器」DB 暫無對應戰法" và "瞬發主動戰法配甘寧" | Không nên gắn link |

`出奇制勝` (9 ô) hiện có link, nhưng tới mục mà `books-dict` ghi sai tên Hán (xem phần tiếp theo).

## Lỗi phát hiện trong dữ liệu hiện có

| Mục | Hiện trạng | Bằng chứng | Hậu quả |
| --- | --- | --- | --- |
| `books-dict`: `出其不意` = Đánh Bất Ngờ Thắng | `出其不意` là **chiến pháp** truyền thừa của Bộ Luyện Sư, không phải binh thư. Binh thư đúng là `出奇制勝` (binh thư chính nhánh 用間). | [ali213 gl2007/459169](https://m.ali213.net/news/gl2007/459169.html); Bahamut 9596; 7724 156851 | Hồ sơ zh hiện tên sai. Bảng danh tính còn coi `出奇制勝` là "tên cũ", trong khi đó là tên hiện hành. |
| `books-dict`: `以武止戈` = Lấy Võ Dẹp Loạn | Không nguồn nào có binh thư `以武止戈`. `以治擊亂` (binh thư chính Hư Thực: tăng 12% sát thương lên mục tiêu đang bị khống chế) có trong nguồn nhưng thiếu trong từ điển. Bảng danh tính đang ghép `以治擊亂` → Lấy Võ Dẹp Loạn (261 ô). | Bahamut 5254; tìm `以武止戈` không ra kết quả | Tên Hán trên hồ sơ nhiều khả năng sai. Kết luận này là **suy luận**, cần ảnh client VN để xác nhận. |
| Bảng danh tính: `以退為進` → Dĩ Trực Báo Oán | Nguồn 2024 liệt kê `以直報怨` và `以退為進` là **hai** binh thư chính nhánh 用間 khác nhau. Dĩ Trực Báo Oán là Hán-Việt của `以直報怨`. | Bahamut 9596; 7724 156851 | **6 ô đang trỏ link sai hồ sơ.** |
| `books-dict`: `顺应天时` | Tên nguồn là `順天應時` / `顺天应时`. | Bahamut 5254, SGSDeck | Vì lệch chữ nên 21 ô không nhận ra tên. |

Ngoài ra còn 5 binh thư có trong nguồn nhưng chưa có trong từ điển và chưa có tên game VN: `以退為進`, `千里疾行`, `仙姿`, `謀定後動`, `無功而厲`. `以治擊亂` phụ thuộc vào cách xử lý mục `以武止戈` ở trên.

## Giới hạn

- **Số liệu có thể đã cũ.** 49 binh thư gốc dùng số năm 2021, trừ 6 mục được điều chỉnh năm 2024. Không tìm được thông báo điều chỉnh binh thư nào sau 2024-07. Các thông báo bảo trì 2025-01-08 và 2026-02-11 không nhắc đến binh thư. Chưa có nguồn chính thức đầy đủ cho 2025–2026, vì Lingxi không có thư viện binh thư.
- Nguồn là bài của người chơi và trang tin, không phải mô tả trong game. Bahamut 9596 là bản chép lại thông tin bên CN.
- Không tìm được nguồn tiếng Việt nào có tên binh thư. Tên VN của các binh thư mới chỉ lấy được từ ảnh client.

## Trạng thái sau triển khai (2026-10-07)

Đã làm (xem changelog 2026-10-07):

- 68 binh thư có `effect`/`effectViet`/`effectVersion` trong `pipeline/books-han-viet-map.json` → `data/books-dict.json`; hồ sơ Tra cứu hiện hiệu ứng và mốc số liệu ở cả bản Việt và zh.
- Sửa tên Hán `出其不意` → `出奇制胜`, `顺应天时` → `顺天应时`, `以武止戈` → `以治击乱` (người dùng xác nhận hiệu ứng client VN của Lấy Võ Dẹp Loạn: "Đối với võ tướng trong trạng thái khống chế, sát thương gây ra tăng 12%"); thêm Chia Lời (`分利`) và Tinh Thần Sảng Khoái (`神清气净`).
- Link Đội chuẩn tra binh thư theo tên Hán nguồn (`sourceNames`): 21 ô `順天應時` và 8 ô `分利` có link; 6 ô `以退為進` (`excludedSourceNames` của Dĩ Trực Báo Oán) không còn link sai.

Không làm, vì `pipeline/recommended-identity-map.json` là nguồn glossary của gate bản dịch (sửa là stale toàn bộ review receipt):

- Chữ Việt trên ô Đội chuẩn vẫn là bản dịch cũ: "Thuận Thiên Ứng Thời" (21 ô), "Dĩ Trực Báo Oán" cho `以退為進` (6 ô).
- 3 ô `拓濟世救貧` chưa có link.
- Các alias cũ trong mục danh tính (`以武止戈`, `顺应天时`, `出其不意`) vẫn là khóa tìm của nhóm Binh thư.

Bản đề xuất sửa identity map (đã thử, bị gate chặn) không được lưu; khi có lần duyệt lại toàn bộ bản dịch thì làm cùng: `displayNameVi` của `順天應時` → Thuận Thiên Thuận Tời, `以退為進` không trỏ Dĩ Trực Báo Oán, `拓濟世救貧` → "Thác · Tế Bần Hảo Thi", cập nhật ba mục `reviewed` theo tên Hán mới của `books-dict` và thêm hai mục Chia Lời / Tinh Thần Sảng Khoái.

## Câu hỏi còn mở

- `以退為進` hiện còn trong game không, hay đã được thay bằng `以直報怨`? Nguồn 2024 cho thấy hai binh thư tồn tại song song; dữ liệu hiện coi là hai binh thư khác nhau.
- Tên game VN của `無功而厲`, `以退為進`, `千里疾行`, `仙姿`, `謀定後動` (cần ảnh client).
- Số liệu binh thư sau 2024-07 có đổi không? Cần một nguồn trong game hoặc thông báo chính thức mới hơn.
- "Thuận Thiên Thuận Tời" là tên trên client VN hay lỗi gõ?
- Tên Hán `开合` (Khai Hạp) lệch nguồn `開闔`/`开阖`; chưa sửa (link không bị ảnh hưởng vì `開闔` đã là `sourceNames`).
