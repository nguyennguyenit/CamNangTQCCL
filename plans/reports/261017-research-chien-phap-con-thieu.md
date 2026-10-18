# Research: các chiến pháp còn thiếu/ghép trùng sau lượt đối chiếu client Global

- Ngày research: 2026-10-17
- Chủ đề (khóa): xác minh 10 chiến pháp chưa có dữ liệu client và 9 cặp mã trùng vừa chép dữ liệu (2026-10-17 c)
- Phạm vi: client Global 24.526 (máy chủ Việt Nam, do người dùng chơi); mùa không áp dụng. Phạm vi xác định từ các lượt chụp client trong phiên này.
- Nguồn đã dùng: dữ liệu chụp client (`pipeline/lookup-client-tactics.json`), snapshot SGSDeck trong repo (`data/sgsdeck/*.json`, bản TW), mô tả nguồn Trung của kho (`pipeline/lookup-inputs/tactics.json`), 5 lượt tìm web.
- SGSDeck: **chưa có mốc SGSDeck đã xác minh** cho từng cặp ghép; snapshot SGSDeck chỉ dùng để so chữ Hán và mô tả.

## Kết luận

Giữ cả 9 cặp mã trùng đã chép dữ liệu client. 4 cặp khớp số liệu từng chữ với mô tả Trung; 5 cặp còn lại là phương án từ nguồn. Với `ung-thi` (鷹視) và `luc-luc-thuong-tam` (戮力上心), người dùng tra client Việt Nam chỉ ra một chiến pháp (Ưng Thị Lang Cố, Lục Lực Thượng Quốc). Mục nguồn Trung riêng của hai mã này nhiều khả năng là bản cũ hoặc lỗi tên của cùng chiến pháp, không phải chiến pháp thứ hai.

## Đối chiếu 9 cặp mã trùng

| Mã thiếu | Tên client đã chép | Bằng chứng | Trạng thái |
|---|---|---|---|
| `tram-doc` 鴆毒 | Rượu Độc | Mô tả Trung 鴆毒 (giảm 30%→60% Võ Lực, độc phát 113%→226%, giảm 30→60 Thống Soái) trùng số với chữ client; 鳩毒 của mã kia là lỗi chữ của cùng chiến pháp. | Đã đối chiếu |
| `cuong-dung-vo-tien` 剛勇無前 | Vô Địch Can Trường | Mô tả Trung (+10%→20% Hội Tâm, +32.5%→65% đòn kế) trùng chữ client. | Đã đối chiếu |
| `hoa-si-nguyen-lieu` 火熾原燎 | Lửa Lan Khắp Chốn | Mô tả Trung (Thiêu Đốt 28%→56%, 2–3 người, 2 hiệp) trùng chữ client. | Đã đối chiếu |
| `khac-tuan-hoa-nhat` 克遵画一 | Khắc Tôn Họa Nhất | 克遵画一 và 克遵畫一 chỉ khác giản/phồn thể. | Đã đối chiếu |
| `ho-gia-thap-bat-phach` 胡笳十八拍 | Tiếng Sáo Dư Âm | Mô tả Trung "hồi binh 2 người, giảm sát thương, 2 hiệp" gần với 胡笳餘音 (chiến pháp tự mang của Thái Văn Cơ ở SGSDeck) nhưng không có số liệu. | Phương án từ nguồn |
| `thuong-lam-nhi-thuc` 仓廪而实 | Thành Quả To Lớn | Mô tả Trung "Quan Lương Thảo, lương thực +1%" khớp hiệu ứng client (1%→2%); tên client lại gần nghĩa 碩果累累. | Phương án từ nguồn |
| `pha-phong-doan-nhan` 破锋断刃 | Thôi Phong Đoạn Nhẫn | Mã này không có mô tả; chỉ gần tên với 摧鋒斷刃 (chữ đầu khác). | Phương án từ nguồn |
| `ung-thi` 鷹視 | Ưng Thị Lang Cố | SGSDeck có hai mục: 鷹視 (A, kế thừa) và 鷹視狼顧 (S, tự mang Tư Mã Ý). Phần 4 hiệp đầu khác nhau, nhưng phần từ hiệp 5 (sát thương mưu lược 77%→154% lên 1→2 địch) và thưởng chủ tướng (+8%→16% Kỳ Mưu) giống nhau, nên 鷹視 giống bản cũ của cùng chiến pháp. Người dùng tra "Ưng Thị" ở client Việt Nam chỉ ra Ưng Thị Lang Cố. Chữ client trùng 鷹視狼顧. | Phương án từ nguồn |
| `luc-luc-thuong-tam` 戮力上心 | Lục Lực Thượng Quốc | Mô tả Trung 戮力上心 "Quan chủ chính, tăng sản lượng mọi tài nguyên" (không có số, kho ghi cách nhận là Tào Phi); 戮力上國 "Quan chủ chính, giảm 15% thời gian nâng cấp công trình". Người dùng tra "Lục Lực" ở client chỉ ra Lục Lực Thượng Quốc (giảm 15%→30% thời gian nâng cấp) và không có chiến pháp tăng sản lượng mọi tài nguyên; mô tả 戮力上心 nhiều khả năng sai. | Phương án từ nguồn |

## 10 chiến pháp chưa có dữ liệu client

| Chiến pháp | Thông tin thêm | Trạng thái |
|---|---|---|
| Vạn Quân Thủ Tướng 萬軍取將 | SGSDeck ghi chiến pháp sự kiện, mô tả sơ sài; người dùng không thấy trong client. | Chưa xác minh |
| Khiên Chế 牽制 | SGSDeck ghi B, kế thừa; người dùng không thấy (manh mối Phan Phụng). | Chưa xác minh |
| Thiên Lý Quỹ Lương 千里饋糧 | SGSDeck ghi A, kế thừa; ở client Lý Nghiêm kế thừa Tịnh Hóa. | Chưa xác minh |
| Đoan Trang Trì Trọng 端莊持重 | SGSDeck ghi B, kế thừa, "Sứ giả tầm phỏng"; client không có Tuân Thái. | Chưa xác minh |
| Thùy Huệ Vạn Vật 垂惠萬物 | Mô tả nguồn là bản OCR đã sửa tay; client chỉ có Đại Kiều tăng tỷ lệ giao dịch. | Chưa xác minh |
| Duy Nội Thiện Quyền, Tuyệt Kế Chiết Mưu | Của Hà Thị (SGSDeck: 何氏 kế thừa 絕計折謀); tướng không có ở client Việt Nam. | Đã đối chiếu (không có ở client, theo người dùng và Thượng Thư Đài) |
| Tàng Khí Đãi Thì, Thừa Thiên Tĩnh Thế | Của SP Tào Tháo (SGSDeck: SP 曹操 kế thừa 藏器待時); chưa phát hành ở client Việt Nam. | Đã đối chiếu (không có ở client, theo người dùng) |
| Đào Viên Kết Nghĩa 桃園結義 | Người dùng: là Duyên phận "Kết Nghĩa Vườn Đào". SGSDeck để mục này là chiến pháp sự kiện, mô tả "待補充". Kết quả tìm kiếm (ejoy, chỉ đọc đoạn trích, chưa mở bài) gọi đội Lưu Bị–Quan Vũ–Trương Phi là "羁绊" (duyên phận). | Phương án từ nguồn |

Riêng Chu Tuấn: SGSDeck (TW) ghi 朱儁 tự mang và kế thừa đều là 千里馳援, còn thẻ client Global ghi Trấn Áp Khăn Vàng / Dương Đông Kích Tây. Hai phiên bản khác nhau; dữ liệu site đang theo client (đúng chính sách). Chữ Hán của "Trấn Áp Khăn Vàng" và "Chi Diệp Phù Tô" (Lý Nghiêm) vẫn **Chưa xác minh**.

## Việc nên làm tiếp

1. Giữ dữ liệu đã chép. Về lâu dài nên gộp các mã trùng (một chiến pháp client, hai mã kho) để danh mục không có hai dòng cùng tên; việc gộp mã cần quyết định riêng.
2. Rà mục `tactic:dao-vien-ket-nghia`: nếu đúng là duyên phận thì không nên nằm trong danh mục chiến pháp. Việc xóa/chuyển mục cần quyết định riêng.
3. Tìm chữ Hán của Trấn Áp Khăn Vàng và Chi Diệp Phù Tô ở thư viện chính thức Lingxi (cần thêm ngân sách tìm kiếm).

## Câu hỏi còn mở

- 鷹視 và 戮力上心 là bản cũ hay lỗi nhập của nguồn? Client Việt Nam chỉ có một chiến pháp cho mỗi cặp (người dùng xác nhận); nguồn Trung hiện có không ghi lịch sử đổi tên.

## Budget ledger

Topic: xác minh chiến pháp còn thiếu/ghép trùng sau đối chiếu client Global.

| Allowance | Limit | Used | Remaining |
|---|---|---|---|
| External sources | 5 | 5 | 0 |
| TQCCL MCP | 5 | 0 | 5 |

Năm lượt tìm web: 鷹視/鷹視狼顧, 戮力上心/戮力上國, 桃園結義 duyên phận, 千里饋糧/牽制/端莊持重/垂惠萬物, 朱儁 tự mang. Chỉ lượt 桃園結義 có đoạn trích liên quan; các lượt khác không ra nguồn dùng được.

## Research tiếp 2026-10-17: giả thuyết "chiến pháp mùa cũ / nguồn sai"

Người dùng bỏ giới hạn lượt tra. Kết luận: phần lớn mục còn thiếu không phải chiến pháp đang có ở client Việt Nam. Chúng rơi vào bốn nhóm: mục nhập trùng hoặc sai trong SGSDeck, cơ chế riêng của một kịch bản Trung Quốc, chiến pháp của tướng chưa có ở Global, và mục không phải chiến pháp. Chưa tìm thấy bằng chứng trực tiếp rằng nhóm này là "chiến pháp mùa cũ" đã bị gỡ.

### Bằng chứng mới

- **SGSDeck chứa mục trùng/sai.** Trang [sgsdeck.com/tactics](https://sgsdeck.com/tactics) (đã mở, 2026-10-17) liệt kê cả 鳩毒 (đủ thông tin binh chủng) lẫn 鴆毒 (thiếu binh chủng), cả 胡笳餘音 lẫn 胡笳十八拍, cả 戮力上國 lẫn 戮力上心. Mô tả của 戮力上心 ("武將委任為主政官時，全資源產量提升。") trùng nguyên văn mô tả của 功勳克舉 trên cùng trang, tức chiến pháp Công Huân Khắc Cử của Trương Chiêu. Đây là lỗi chép mô tả, khớp với việc client chỉ có Lục Lực Thượng Quốc. **Đã đối chiếu.**
- **鷹視 ghi "A, kế thừa từ 司馬懿".** Tư Mã Ý là tướng 5 sao, chiến pháp kế thừa hiện tại của ông là 用武通神 (bản snapshot SGSDeck); tướng 5 sao không cho chiến pháp hạng A. Phần từ hiệp 5 của 鷹視 trùng 鷹視狼顧. Đây là mục sai hoặc bản cũ; client chỉ có Ưng Thị Lang Cố. **Phương án từ nguồn.**
- **垂惠萬物 ghi "B, kế thừa từ 王元姬".** Vương Nguyên Cơ là tướng S, có chiến pháp tự mang 垂心萬物; mô tả 垂惠萬物 mang nhãn "【OCR校正】". Nhiều khả năng đây là lỗi nhận dạng chữ của 垂心萬物. **Phương án từ nguồn.**
- **胡笳十八拍** còn là tên một "韬略" của 蔡文姬 trong game khác, 《三国：谋定天下》 (đoạn trích Baidu Baike, chưa mở trang). Mục này trong SGSDeck thiếu binh chủng, là mục trùng của 胡笳餘音. **Phương án từ nguồn.**
- **萬軍取將 là chiến pháp "治军" (chỉnh quân) của Trương Phi trong kịch bản 《争洛阳》 (Trung Quốc, 2026).** Hai bài trên 163.com (chỉ đọc được đoạn trích, trang trả 403) gọi nó là "张飞治军战法" và đề xuất "改为全赛季持有", tức hiện chỉ có trong kịch bản đó. Client Global không có kịch bản này. **Phương án từ nguồn.**
- **端莊持重 ghi "kế thừa từ 荀采".** Client Việt Nam không có Tuân Thái/荀采 (người dùng xác nhận); tìm kiếm không ra thông tin phát hành. **Chưa xác minh.**
- **牽制 ghi "B, kế thừa từ 潘鳳"; 千里饋糧 ghi "A, kế thừa từ 李嚴".** Ở client, Phan Phụng kế thừa Sát Thương Thêm và Lý Nghiêm kế thừa Tịnh Hóa. Mô tả hai mục SGSDeck (牽制: "[B級] 兵刃傷 + giảm 20 Võ/Trí"; 千里饋糧: "Cấp Cứu + tăng Võ Lực") không khớp hai chiến pháp client này. Có thể là bản cũ trước khi đổi; chưa có nguồn xác nhận. **Chưa xác minh.**
- **桃園結義 là duyên phận.** Bài trên trang của nhà phát hành ([sgz.ejoy.com, 2020-03-06](https://sgz.ejoy.com/xinshou/detail-5123.html), đã mở) ghi "桃园队：刘备+关羽+张飞 / 羁绊：第六回合全体2次抵御". Bài không gọi tên duyên phận, nhưng xác nhận đội Đào Viên là một 羁绊 chứ không phải chiến pháp. **Đã đối chiếu** (là duyên phận); tên "Kết Nghĩa Vườn Đào" theo người dùng.
- **Chu Tuấn:** SGSDeck (TW) ghi 朱儁 tự mang và kế thừa đều là 千里馳援, còn client Global ghi Trấn Áp Khăn Vàng / Dương Đông Kích Tây. Tìm kiếm không ra tên Hán của bản Global. **Chưa xác minh.**

### Đề xuất

- Giữ dữ liệu client đã chép cho các mã trùng. Đánh dấu các mục nguồn sai (鷹視, 戮力上心, 垂惠萬物, 胡笳十八拍, 鴆毒) là bản trùng khi gộp mã.
- 萬軍取將, 端莊持重, 牽制, 千里饋糧, Duy Nội Thiện Quyền, Tuyệt Kế Chiết Mưu, Tàng Khí Đãi Thì, Thừa Thiên Tĩnh Thế: ghi "không có ở client Global"; không bịa dữ liệu Việt.
- `tactic:dao-vien-ket-nghia`: chuyển khỏi danh mục chiến pháp sang duyên phận khi có bảng duyên phận; trước mắt ghi chú.

### Ledger (cập nhật)

Người dùng cho phép không giới hạn lượt tra nguồn ngoài cho chủ đề này (2026-10-17). Tổng đã dùng: 26 lượt (5 ở lượt đầu, 21 ở lượt này: 17 tìm web, 4 lần mở trang trong đó 1 trang lỗi 403). TQCCL MCP: 0/5.

## Cập nhật 2026-10-17 (lượt 3): đã làm mục 1–5, đề xuất mục 6–10

### Đã làm
- **Phẩm S/A/B**: lấy từ màu tên chiến pháp trên thẻ tướng client (cam = S, tím = A, xanh = B; hiệu chỉnh 144/144 khớp). 8 mục danh mục cũ ghi khác màu, đều sửa về A. Chiến pháp 1–2★ (tên xanh nhạt) là phẩm C.
- **Mô tả**: rà lỗi theo luật cho mọi chiến pháp (chữ dính số, dấu câu, ngoặc, tỷ lệ kích hoạt, cặp a→b, số người mục tiêu). Đã tách 6 chỗ chữ dính số ("giảm10%", "2hiệp", "Hỗn Loạn2 hiệp"…). Phần còn gắn cờ là chữ gốc của game, giữ nguyên.
- **Gộp mã trùng** (18 cặp): mã cũ bị bỏ, tên cũ thành alias của mã giữ, ghi trong `lookup.formerIds`. Link `?id=<mã cũ>`, MCP `tqccl_get_entity` và phần tìm theo tên vẫn trả về mã giữ.
- **Bỏ `tactic:dao-vien-ket-nghia`**: đây là duyên phận, không phải chiến pháp.
- **17 chiến pháp chỉ có ở client**: đã thêm, cùng tên Hán. Tên Hán 17/17 có nguồn (三略庫 bản TW; ảnh đội trên Bahamut cho các bản 精·/轉·). Hiệu ứng Hán: 13 mục lấy từ nguồn, 4 mục 精·/轉· tự dịch (ghi chú trong `%TEMP%/tqccl-cap/tx/new-tactics-zh.json`). Bản `Tinh •`/`Chuyển •` là chiến pháp bổ sung của mùa Binh Diễn Xuân Thu (người dùng xác nhận): nội dung có thể khác bản gốc một chút (vd Tinh • Nhanh Trí Động Não dùng cho mọi binh chủng, bản gốc chỉ Kỵ/Khí giới; Chuyển • Bạch Nhị Binh cho Lính Cung, bản gốc cho Lính Thương); chiến pháp binh chủng chỉ mùa này cho tùy chỉnh, nên hồ sơ ghi rõ chữ client là một cấu hình. Bản Hán của 鎮壓黃巾 giữ chữ chính thức "戰鬥第2回合"; bản Việt theo client là "2 hiệp đầu".

### Đề xuất mục 6–10 (chưa làm)
| # | Việc | Hiện trạng | Đề xuất |
|---|---|---|---|
| 6 | Mã suy từ tên cũ | 129 mã không trùng slug tên client hiện hành (vd `tactic:lap-lo-danh-trao` = Ám Độ Trần Thương) | Giữ nguyên mã: route handle đội, link cũ và snapshot SGSDeck đều bám theo mã. Nếu cần đổi tên mã thì dùng cơ chế `formerIds` vừa thêm, làm từng đợt và có danh sách duyệt. |
| 7 | `conflictsVi` (trạng thái xung đột) | 136 mục để trống | Đọc lại dòng "Xung đột" trên thẻ chiến pháp client (đã có ảnh thẻ của phần lớn mục) rồi nạp vào client file thành trường mới. Mục có thẻ nhưng không ghi xung đột thì để trống. |
| 8 | `maxUsers` / điều kiện đổi | `maxUsers` trống 18 mục; điều kiện đổi chỉ áp cho chiến pháp sự kiện | Chụp màn Sự kiện/Đổi của client cho 18 mục còn thiếu. Không suy số liệu. |
| 9 | Hiệu ứng chữ Hán | 33 mục chưa có hiệu ứng Hán (cờ `pending`, gồm các chiến pháp binh chủng/nội chính) | Lấy từ trang TW của 三略庫 (sanzhan.slgsim.com), chỉ tự dịch mục không có nguồn và ghi rõ là bản dịch, giống cách đã làm cho 17 mục mới. |
| 10 | Tên cũ trong ghi chú/đội | Tên cũ còn trong prose (`teams.json`, `coexist.json`, `other-teams.json`…; vd "Lửa Cháy Ngùn Ngụt" 7 lần, "Lấy Ít Đánh Nhiều" 7 lần) | Không sửa tay: tên trong dữ liệu đội đã quy về mã qua alias. Hiển thị lấy `viet` hiện hành. Riêng prose trong ghi chú thì thêm bước thay tên cũ → tên client ở pipeline đội (theo alias đã duyệt), có test chống tên cũ lọt ra. |

### Binh chủng Tinh/Chuyển mùa Binh Diễn Xuân Thu (đọc từ client)
- Nguồn Việt: màn Sân Luyện Binh › Binh chủng Xem (Tổng quan binh chủng), 16 binh chủng. Mỗi binh chủng gồm hướng dẫn và 4 cấp cải tạo S/C/B/A, mỗi cấp chọn 1 trong 3. Ô chữ dài được cuộn từng nấc rồi chụp. Hai bản chép độc lập lệch 17 chỗ, đã đối chiếu ảnh để chốt (`%TEMP%/tqccl-cap/tx/troops-vi.json`).
- Nguồn Hán: ảnh màn 訓兵場 client TW trong 4 bài Bahamut (bsn=36815, snA=11565/11567/11568/11571). Có đủ 16 hướng dẫn và 7 lựa chọn 轉, số liệu khớp bản Việt.
- Danh mục: mùa có đúng 16 chiến pháp binh chủng (người dùng xác nhận), mỗi binh chủng một mục `Tinh • <binh chủng>`. `Chuyển • <binh chủng>` chỉ là cùng binh chủng khi chọn cải tạo đặc biệt Chuyển (Phi Hùng Quân → Cung, Vô Đương Phi Quân → Khiên, Tử Sĩ Tiên Phong → Khiên, Bạch Nhị Binh → Cung, Giải Phiền Vệ → Kỵ, Lính Giáp Mây → Kỵ/藤甲象, Lính Đan Dương → Thương), nên được lưu làm alias và ghi chú trong hồ sơ, không tạo mục riêng. Bốn mục chụp trước là cấu hình riêng của tài khoản, nay thay bằng hướng dẫn gốc.
- Lệch với nhóm "Cải tạo binh chủng" (`troopMods`, dịch từ SGSDeck): tên Việt khác client (Đan Dương Binh / Lính Đan Dương, Đằng Giáp Binh / Lính Giáp Mây…), và ở 10/16 binh chủng thứ tự hoặc cấp của lựa chọn, số liệu khác bản mùa hiện tại (vd Phi Hùng Quân Tập Trí 3% → 2%, Tây Lương Thiết Kỵ Võ Lực 40 → 15). Đề xuất: thêm phần `troopMods` vào client file để thay tên, hướng dẫn và 12 lựa chọn theo client (ghép theo tên Hán của lựa chọn, giữ ID con). Việc này cần sửa builder và identity của lựa chọn con nên chưa làm.
- Màn "Hiệu quả Chiến Pháp Xem trước" ở Sân Luyện Binh (người dùng chỉ cách, video 2026-10-17 19:05): chọn thử cải tạo thì client hiện ngay hiệu ứng sau cải tạo, phần đổi được tô màu, các lựa chọn hiện đủ chữ không bị cắt. Đã dùng màn này để chụp câu đầu hiệu ứng khi chọn Chuyển cho cả 7 binh chủng. Mỗi binh chủng có câu riêng, vd "Tiến bậc Lính Cung thành Phi Hùng Quân anh dũng bất phá", không phải chỉ đổi loại binh. Phần còn lại trùng bản Tinh. Ảnh chụp không chọn cải tạo cũng trùng hướng dẫn ở màn Tổng quan. Không lưu phương án nào. Ô 1 (đã được người dùng cài lại trước đó) để trống, ô 2–4 giữ nguyên.
- Ghi chú công cụ: phiên chụp WGC của cửa sổ game trả khung trễ hàng chục giây. Chụp màn hình vùng cửa sổ (PIL ImageGrab, cửa sổ đang ở trên cùng) cho hình đúng lúc.

### Lượt 4: cải tạo binh chủng, quy tắc tên Tinh/Chuyển, Thương nhân › Mùa giải
- Cải tạo binh chủng: thay toàn bộ bằng một bản client (16 binh chủng, 192 lựa chọn). Bản SGSDeck (đợt mùa cũ) không giữ làm lịch sử. Nhãn cấp C theo client là "Cải tạo sơ cấp" nên đổi "Cơ bản" thành "Sơ cấp". 123 lựa chọn trùng tên giữ mã. 69 lựa chọn của đợt cũ (tên/số khác, vd Phò Thương 60% → 40%) được thay bằng lựa chọn client có mã mới. Chữ Hán của lựa chọn: site chưa có trường Hán cho lựa chọn (trang tiếng Trung chỉ hiện giá trị dịch được), nên chưa thêm.
- Quy tắc tên (thử lưu thật ở ô 1 của Sân Luyện Binh, Phi Hùng Quân): cải tạo đặc biệt Kỵ Thuật → "Tinh • Phi Hùng Quân"; đổi sang Chuyển.Cung → "Chuyển • Phi Hùng Quân" (Chiến Pháp › Binh chủng hiện đúng tên này, Thích hợp Cung). Ô 1 hiện để cấu hình thử này (Chuyển.Cung + Phò Thương); ô 2–4 không đổi.
- Thương nhân › Mùa giải: một tab bán Lệnh Đăng Ung (đổi tướng), tab còn lại bán Chiến Pháp mùa giải (đợt hiện tại: Thác-Đoạt Hồn Hiệp Phách, Thác-Dưỡng Sức Đợi Chiến, Thác-Thuyền Cỏ Mượn Tên, Thác-Cắt Xương Trị Độc, Thác-Sĩ Biệt Tam Nhật, Tinh • Nhanh Trí Động Não). Thẻ "Xem Chiến Pháp" đầy cấp của 5 bản Thác trùng bản gốc về phẩm, loại, tỷ lệ, mục tiêu và hiệu ứng, nên lưu làm tên khác + ghi chú, không tạo mục riêng. Cửa hàng xoay hàng; chỉ thấy 6 món đang bán (không bấm Mua hay làm mới).
- 2026-10-18: người dùng xác nhận client chỉ có Thiên Lý Trì Viện (千里馳援, đã có mã riêng, Chu Hằng tự mang), không có Thiên Lý Quỹ Lương (千里饋糧) → bỏ `tactic:thien-ly-quy-luong` (`retired: null`).
- 2026-10-18: theo người dùng, bỏ toàn bộ 9 mục chưa có dữ liệu client (chỉ có ở SGSDeck) và bỏ tướng Hà Thị. Danh mục còn 407 chiến pháp, 251 tướng; SP Tào Tháo còn nhưng chưa có chiến pháp tự mang/kế thừa.
- 2026-10-18: giữ SP Tào Tháo theo người dùng (bản Trung có tướng này); hai ô chiến pháp tự mang/kế thừa để trống vì Thừa Thiên Tĩnh Thế, Tàng Khí Đãi Thì đã bỏ.
- 2026-10-18 (research): SP曹操 có ở bản Trung — bài Zhihu 2026 "sp曹操…传承战法 藏器待時" (zhuanlan.zhihu.com/p/1996634983041876988, chỉ đọc được tiêu đề/đoạn trích, trang trả 403) và bài 2026-08 về đội 拒马弓 SP曹操/卢植/SP貂蝉; SGSDeck (TW) có đủ hiệu ứng 承天靖世 (tự mang) và 藏器待時 (kế thừa). Khôi phục hai mục với nội dung SGSDeck và ghi chú "chưa có ở client Global"; SP Tào Tháo nối lại hai liên kết. **Phương án từ nguồn.**
