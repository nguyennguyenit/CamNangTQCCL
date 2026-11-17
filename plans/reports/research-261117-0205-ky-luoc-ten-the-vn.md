# Research: Kỳ Lược (奇略) PK-S27, tên thẻ bản VN

Ngày: 2026-11-17. Bối cảnh: tab "Đội Hình Kỳ Lược" trong sheet VN `1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw`.

## Kết luận

- Tab "Đội Hình Kỳ Lược" là bản dịch sang tiếng Việt của bảng **台服官方推薦** (đề xuất chính thức của server Đài) mùa Hán Diễm Trường Minh. Có 15 trên 16 đội trùng khớp từng vị trí thẻ (vòng 2→6) với chuỗi `作戰方略 / 奇略卡` mà repo đã lưu ở các bản ghi `s27-official-*`. Đội còn thiếu là Chu Du/Lục Tốn (襲擾).
- Vì vậy có thể ghép trực tiếp **26 trên 40 thẻ** từ chữ Hán sang tên VN, không phải đoán. Tên VN là tên dịch nghĩa (ví dụ 設伏十面 → "Bố Trí Thập Diện", 多多益善 → "Càng Nhiều Càng Tốt"), khác với tên Hán-Việt repo đang dùng ("Thiết Phục Thập Diện", "Đa Đa Ích Thiện").
- Còn 14 thẻ chưa có tên VN, phần lớn thuộc nhóm Sách (策) vì đội 襲擾 ít được đề xuất. Trong 5 phương lược mới chốt được 1 tên: 謀算 = "Mưu Tính" (đội Trương Giác ghi "Phương Lược Mưu Tính").
- Theo quy ước giữ tên theo bản game VN, nên lấy tên VN này làm tên hiển thị. Nhưng câu đầu tab ghi rằng nội dung được biên soạn từ người chơi khu vực khác. Vì vậy cần một ảnh chụp trong game VN để xác nhận đây là tên chính thức, không phải người soạn sheet tự dịch.

## Cơ chế (nguồn: sgsdeck.com/seasons/pk-s27, tổng hợp từ fanpage và website 台服)

- Mỗi đội chọn 1 phương lược, rồi gắn 5 thẻ cho các vòng 2 đến 6. Thẻ có hiệu lực từ đầu vòng.
- Mỗi phương lược dùng được 2 loại thẻ và được gắn tối đa 1 thẻ hiếm. Mỗi thẻ gắn vào cộng thêm chỉ số theo phương lược.
- Khi binh lực đội xuống dưới 65% binh lực tối đa, cả phương lược lẫn thẻ đều mất hiệu lực.
- Thẻ nhận từ 勛業臺. Sau trận, chiến báo cho biết thẻ nào đã thực sự có hiệu lực.

| 方略 | Tên VN | Loại thẻ | Chỉ số mỗi thẻ |
|---|---|---|---|
| 整軍 | chưa rõ | Phụ (輔), Tế (濟) | Thống +3 |
| 強攻 | chưa rõ | Dũng (勇), Phụ | Võ +3 |
| 謀算 | Mưu Tính | Mưu (謀), Phụ | Trí +3 |
| 久戰 | chưa rõ | Dũng, Tế | Võ +2, Thống +2 |
| 襲擾 | chưa rõ | Mưu, Sách (策) | Võ và Trí địch −2 |

## Bảng 40 thẻ

Cột "VN (sheet)" lấy từ tab Kỳ Lược và tab Team Cùng Tồn, ghép theo vị trí với chuỗi 台服. Cột "Repo hiện dùng" lấy từ `translation-draft-261103-doi-chuan-notes-terms.md`.

| Hán | Loại | Hiếm | VN (sheet) | Repo hiện dùng | Hiệu ứng tóm tắt |
|---|---|---|---|---|---|
| 封狼居胥 | Dũng | | Phong Lang Cư Tư (tab Cùng Tồn viết "Cư Tế") | Phong Lang Cư Tư | Toàn quân: tỉ lệ đột kích +10% |
| 橫掃河西 | Dũng | | Càn Quét Tây Hà | Hoành Tảo Hà Tây | Tướng Võ cao nhất: liên kích 40% |
| 孤軍深入 | Dũng | | Đơn Độc Thâm Nhập (*) | Cô Quân Thâm Nhập | Đột kích phát động thất bại thì thử lại 1 lần |
| 追亡逐北 | Dũng | | Truy Kích Tử Trận | Truy Vong Trục Bắc | Sau đánh thường, trị 1 tướng ta (40%) |
| 擒王破營 | Dũng | | — | — | Sau mỗi đột kích, đột kích của tướng ta +5% (cộng dồn) |
| 摧鋒陷敵 | Dũng | | Phá Mũi Giáp Địch | Thôi Phong Hãm Địch | Sát thương đột kích +12% |
| 壯志不絕 | Dũng | ✓ | Chí Khí Ngập Tràn | Tráng Chí Bất Tuyệt | Tướng Võ cao nhất: sát thương binh đao +5%, tăng dần |
| 斬逆納降 | Dũng | ✓ | Trảm Địch Chiêu Hàng | Trảm Nghịch Nạp Hàng | Mỗi đột kích đã phát động: sát thương đột kích +3% |
| 設伏十面 | Mưu | | Bố Trí Thập Diện | Thiết Phục Thập Diện | Tỉ lệ phát động chủ động +10% |
| 背水列陣 | Mưu | | Dàn Trận Tử Chiến | Bối Thủy Liệt Trận | Tướng Trí và Võ cao nhất miễn kế cùng |
| 拔旗易幟 | Mưu | | — | Bạt Kỳ Dị Xí | Lượt phát động chủ động của tướng Trí cao nhất bị đảo kết quả |
| 暗度陳倉 | Mưu | | Ám Độ Trần Thương | Ám Độ Trần Thương | Chiến pháp chuẩn bị có 50% bỏ qua lượt chuẩn bị |
| 合圍夾擊 | Mưu | | Hợp Vây Giáp Kích | Hợp Vi Giáp Kích | Sau chủ động, trị tướng ta binh lực thấp nhất (50%) |
| 楚歌四起 | Mưu | | Sở Ca Tứ Khởi | Sở Ca Tứ Khởi | Sát thương chủ động +10% |
| 誘敵離營 | Mưu | ✓ | Dụ Địch Rời Trại | Dụ Địch Ly Doanh | Sau 1 chủ động, kỳ lược sau có 10% hiệu lực thêm 1 lần |
| 多多益善 | Mưu | ✓ | Càng Nhiều Càng Tốt | Đa Đa Ích Thiện | Mỗi kỳ lược đã dùng: chủ động đầu tiên có 15% thử lại |
| 博浪椎秦 | Phụ | | Bác Lãng Chuy Tần | Bác Lãng Chùy Tần | Phá trận +20% |
| 圯橋受書 | Phụ | | — | Di Kiều Thụ Thư | Nhận ngẫu nhiên 1 tăng ích công năng chưa có |
| 臨危不懼 | Phụ | | Không Sợ Lâm Nguy | Lâm Nguy Bất Cụ | Kéo dài 1 lượt các tăng ích công năng đang có |
| 借箸代籌 | Phụ | | — | — | Khi nhận tăng ích công năng thì nhận thêm 1 cái |
| 定計安儲 | Phụ | | Lập Kế An Trữ | — | Tướng binh lực cao nhất viện hộ toàn quân, nhận đánh thường −30% |
| 三策並進 | Phụ | | — | Tam Sách Tịnh Tiến | Trạng thái công năng địch nhận cũng áp lên 1 tướng ta |
| 功成身退 | Phụ | ✓ | Lui Bước Công Thành | Công Thành Thân Thoái | Mỗi kỳ lược đã dùng: 30% tái hiệu lực 1 kỳ lược cũ |
| 諫封示公 | Phụ | ✓ | Kỳ Công Gián Phong | Gián Phong Thị Công | Nhận 1 tăng ích công năng ngẫu nhiên, có thể lặp |
| 藏書納籍 | Sách | | — | — | Địch đơn nhận ngẫu nhiên 1 khống chế |
| 月下追賢 | Sách | | — | Nguyệt Hạ Truy Hiền | Khống chế lên địch lan sang 1 địch khác |
| 居儉避禍 | Sách | | — | — | Địch toàn quân nhận 1 sát thương duy trì (50%) |
| 治延軍勢 | Sách | | Trấn Giữ Quân Diên | Trị Diên Quân Thế (có chỗ viết "Diên Trị Quân Thế") | Sát thương duy trì của ta kéo dài thêm 1 lượt |
| 韜晦自污 | Sách | | — | — | Khống chế có hiệu lực thì 1 địch khác nhận cùng khống chế |
| 築闕長安 | Sách | | — | — | Chủ động không chuẩn bị của địch phải chuẩn bị 1 lượt |
| 居功至偉 | Sách | ✓ | — | — | Kỳ lược kế tiếp của địch mất hiệu lực |
| 受封增邑 | Sách | ✓ | — | Thụ Phong Tăng Ấp | Địch nhận thêm sát thương duy trì, tăng dần |
| 芒碭隱蹤 | Tế | | Ẩn Tích Mang Thương | Mang Đãng Ẩn Tung | Sát thương nhận vào −8% |
| 親釋刑縛 | Tế | | — | Thân Thích Hình Phược | Đầu lượt đang bị khống chế thì miễn trạng thái đó 1 lượt |
| 沛縣聚義 | Tế | | Bái Huyện Tụ Nghĩa | Bái Huyện Tụ Nghĩa | Lượng trị liệu +15% |
| 推食解衣 | Tế | | Nhường Cơm Sẻ Áo | Thôi Thực Giải Y | Khi nhận sát thương, trị 1 tướng ta (40%) |
| 鴻門遁險 | Tế | | Lánh Hiểm Hồng Môn | Hồng Môn Độn Hiểm | Khi trị liệu, gây thêm sát thương mưu lược lên 1 địch |
| 疲楚奪勢 | Tế | | — | Bì Sở Đoạt Thế | Sau khi nhận đánh thường, phản 1 lần sát thương binh đao (50%) |
| 約法三章 | Tế | ✓ | Ước Pháp Tam Chương | Ước Pháp Tam Chương | Trị tướng ta thấp máu nhất (100%) và gây sát thương mưu lược |
| 敗中求生 | Tế | ✓ | Sống Trong Thất Bại | Bại Trung Cầu Sinh | Mỗi lần bị đánh thường, sát thương nhận vào −2% (cộng dồn) |

(*) 孤軍深入 không có trong chuỗi 台服 nào trên repo. Tên này được ghép theo nghĩa, từ các đội Quyền Kỵ và Ngô Kỵ ở tab Team Cùng Tồn. Đây là thẻ duy nhất trong 26 thẻ không ghép được theo vị trí.

## Bằng chứng ghép vị trí (tab Kỳ Lược ↔ `s27-official-*`)

Ví dụ: SP Mã Siêu, 強攻: 橫掃河西→封狼居胥→摧鋒陷敵→斬逆納降→追亡逐北 = Càn Quét Tây Hà→Phong Lang Cư Tư→Phá Mũi Giáp Địch→Trảm Địch Chiêu Hàng→Truy Kích Tử Trận. Mười bốn đội còn lại (Tuân Úc, Trương Giác, SP Tào Tháo, Lữ Bố Cung/Khiên, Đại Kiều, Hứa Du, SP Gia Cát Lượng Cung/Khiên, Khương Duy, Cam Ninh, SP Quan Vũ, Tư Mã Ý, Chu Thái) khớp theo cùng cách. Nguồn: `pipeline/localization-inputs/recommended.json`, trường `notesRaw` có "奇略卡（第 2→6 回合）".

## Lỗi phát hiện kèm theo

- Tab Kỳ Lược có câu mở đầu "Lối chơi cải tạo Binh Chủng..." được chép từ tab Binh Diễn. Dòng Thái Sử Từ trong đội Cam Ninh là dòng thừa.
- Sheet VN viết cùng một thẻ thành hai tên: "Phong Lang Cư Tư" (tab Kỳ Lược) và "Phong Lang Cư Tế" (tab Cùng Tồn).
- Ghi chú gốc trong repo có biến thể chữ Hán sai: 居儉避貨 (đúng là 居儉避禍, ở `s27-hedan`), 推衣解食 (đúng là 推食解衣), 圯橋授書 (đúng là 圯橋受書), 合圍突擊 (đúng là 合圍夾擊; một ghi chú đã tự nêu điều này). Nếu chuẩn hoá tên thẻ thì nên chuẩn hoá cả các biến thể này.

## Nguồn

- Sheet VN: tab "Đội Hình Kỳ Lược", tab "Team Cùng Tồn".
- https://sgsdeck.com/seasons/pk-s27: cơ chế, 5 phương lược, 40 thẻ (trang cộng đồng, cập nhật 2026-11-09).
- Repo: `pipeline/localization-inputs/recommended.json`, `plans/reports/translation-draft-261103-doi-chuan-notes-terms.md`.
- thanglonghoi.com: không đọc được bằng fetch vì trang render bằng JS. Cần mở bằng trình duyệt nếu muốn đối chiếu thêm.

## Câu hỏi còn mở

1. Sheet này có phải bảng do NPH VN phát hành, và tên thẻ có khớp với tên hiển thị trong game VN không? Cần 1 ảnh chụp màn hình chọn kỳ lược trong game để xác nhận.
2. Tên VN của 14 thẻ còn thiếu và của 4 phương lược (整軍, 強攻, 久戰, 襲擾) lấy từ đâu? Có thể dùng ảnh game, hoặc mở TLH bằng trình duyệt.
3. Nếu chốt theo sheet thì đổi hàng loạt trong ghi chú đội (Thiết Phục Thập Diện có 87 chỗ, Đa Đa Ích Thiện có 48 chỗ, v.v.). Việc đổi phải qua gate review bản dịch, giống quy ước đổi thuật ngữ 碰瓷.
