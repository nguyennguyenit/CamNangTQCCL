# Tên client cho 5 phương lược và 40 thẻ kỳ lược PK-S27 (Hán Diễm Trường Minh), client Global 24.547

- Ngày: 2026-11-17. Issue #116.
- Phạm vi: Global (client "Tam Quốc Chí - Chiến Lược 24.547", tài khoản người dùng đang ở server PK-S27); mùa PK-S27.
- Nguồn:
  - Thẻ: **Kỳ Lược Triều Hán › Võ Lược Kỳ Mưu › Đồ Giám**. Có 5 tab (Dũng, Mưu, Phụ, Sách, Tế), mỗi tab 8 thẻ. Bấm từng thẻ để mở bảng chi tiết. Đồ Giám hiện đủ 40 thẻ, kể cả thẻ chưa nhận.
  - Phương lược: **ô Hiệp 2 › nút đổi cạnh tên phương lược › Phương Lược Tác Chiến**. Chỉ mở danh sách, không bấm "Xác nhận chọn", không bấm "Lưu".
  - Luật: **Đồ Giám › ?** (Hướng dẫn).
- Cách chụp: Windows Graphics Capture theo HWND, nhập bằng `PostMessage` từ helper chạy quyền admin. Không dùng con trỏ thật, nên chuột của người dùng không bị ảnh hưởng. Chỉ đọc. Không đổi đội, không gắn hay tháo thẻ, không mua.
- Ảnh và bản ghép nằm ở `%TEMP%\tqccl-cap\ky-luoc\`, **không nằm trong repo**:
  - `cT_N.png`: thẻ thứ N của tab T. Tab: 1 Dũng, 2 Mưu, 3 Phụ, 4 Sách, 5 Tế. Thứ tự N: 1 trên cùng, 2 trái trên, 3 phải trên, 4 giữa trên, 5 giữa dưới, 6 trái dưới, 7 phải dưới, 8 dưới cùng.
  - `mT.png`: ảnh ghép 8 thẻ của tab T.
  - `tabT.png`: toàn tab.
  - `s11.png`, `s12.png`: danh sách phương lược.
  - `h1.png`–`h3.png`: luật.
  - `win_5570822.png`: màn vào, có số phiên bản trên thanh tiêu đề.
- Nối thẻ với chữ Hán: theo hiệu ứng, số liệu và đối tượng, so với bảng SGSDeck <https://sgsdeck.com/seasons/pk-s27>. Không nối theo tên. Đối tượng khớp 40/40, độ hiếm khớp 40/40.
- Cột "Repo hiện dùng" lấy từ bảng thuật ngữ `plans/reports/translation-draft-261103-doi-chuan-notes-terms.md` (dòng 43, 67, 290–336). Đây là tên đang có trong ghi chú đội.

## Kết luận

- Sheet VN khớp client **25/26 tên**. Chỉ lệch 治延軍勢: sheet ghi "Trấn Giữ Quân Diên", client ghi "Trị Duyên Quân Thế".
- Repo đã có tên cho 34/40 thẻ. Trong đó **28/34 tên client khác tên Hán-Việt repo đang dùng**, 6 tên trùng. 6 thẻ còn lại chưa có tên trong repo.
- Ghi chú đội đang dùng tên Hán-Việt, ví dụ "Thiết Phục Thập Diện", "Đa Đa Ích Thiện". Client dùng tên dịch nghĩa, ví dụ "Bố Trí Thập Diện", "Càng Nhiều Càng Tốt".
- Tên phương lược **trong client tự lệch nhau**. Thẻ chọn phương lược và Hướng dẫn ghi khác nhau ở 4/5 phương lược (xem bảng dưới).
- Thuật ngữ client:

  | Hán | Client |
  |---|---|
  | 奇謀武略 | Võ Lược Kỳ Mưu |
  | 作戰方略 | Phương Lược Tác Chiến |
  | 奇略卡 | Thẻ Kỳ Lược |
  | 勛業臺 | Đài Huân Nghiệp (lối vào). Hướng dẫn ghi "Đài Công Huân". |
  | 經史文略 | Văn Lược Kinh Sử |
  | Màn mùa | Kỳ Lược Triều Hán |
  | 勇 / 謀 / 輔 / 策 / 濟 | Dũng / Mưu / Phụ / Sách / Tế |
  | Thường / 稀有 | Thường / Hiếm |

- Thẻ Hiếm có khung vàng và nhãn "Max". Mỗi tab có 2 thẻ Hiếm, nằm ở 2 ô giữa.

## Phương lược

| Hán | Loại thẻ (client) | Sheet VN | Client: thẻ chọn | Client: Hướng dẫn | Repo hiện dùng | Mô tả client | Buff mỗi thẻ (client) |
|---|---|---|---|---|---|---|---|
| 整軍 | Phụ, Tế | — | **Toàn quân** | Chỉnh Đốn Quân | Chỉnh Quân | Lính mạnh giáp tốt, Giảm ST và cung cấp hiệu ứng tăng ích | Mỗi trang bị 1 Kỳ Lược, Võ Tướng quân ta tăng 3 điểm Thống Soái |
| 強攻 | Dũng, Phụ | — | **Cường Công** | Cường Công | Cường Công | Bẫy trận xông pha, cường hóa sát thương bùng nổ của Chiến Pháp Đột Kích | … tăng 3 điểm Võ Lực |
| 謀算 | Mưu, Phụ | Mưu Tính | **Mưu tính** | Mưu Toán | Mưu Toán | Vận dụng kế sách, cường hóa khả năng sử dụng Chiến Pháp chủ động | … tăng 3 điểm Trí Lực |
| 久戰 | Dũng, Tế | — | **Chiến đấu lâu dài** | Chiến Dài | Chiến Đấu Trường Kỳ | Mặc giáp kịch chiến, cường hóa khả năng Chịu ST và Chiến Pháp Đột Kích | … tăng 2 điểm Võ Lực và Thống Soái |
| 襲擾 | Mưu, Sách | — | **Quấy nhiễu** | Tập Kích | Tập Nhiễu | Khắc chế địch linh hoạt, cường hóa Chiến Pháp Chủ Động và hiệu ứng khống chế | Mỗi trang bị 1 Kỳ Lược, Võ Tướng địch giảm 2 điểm Võ Lực và Trí Lực |

Màn đội (`s01.png`) và "Chi tiết buff" (`s06.png`) cũng ghi "Toàn quân", nên tên trên thẻ chọn là tên người chơi thấy khi cấu hình. Loại thẻ và buff khớp SGSDeck ở cả 5 phương lược.

Ghi chú: repo đang dùng "Chiến Đấu Trường Kỳ" cho 久戰 theo identity map, nhưng đó là tên binh thư 久战. Báo cáo 261022 ghi client gọi binh thư này là "Cửu Chiến". Tên phương lược và tên binh thư cần tách riêng.

## Luật (Hướng dẫn, nguyên văn)

- Phương Lược Tác Chiến:
  - "Mỗi đội quân có thể tự chọn một loại Phương Lược Tác Chiến để trang bị Thẻ Kỳ Lược, cung cấp các hiệu quả tăng ích khác nhau trong chiến đấu, nhưng chỉ có hiệu lực khi đội quân có 3 vị Võ Tướng và tổng Binh Lực hiện tại ≥ 65% Binh Lực tối đa"
  - "Phương Lược Tác Chiến gồm 5 loại: Chỉnh Đốn Quân, Cường Công, Mưu Toán, Chiến Dài, và Tập Kích, tương ứng với các phong cách chuẩn bị chiến đấu khác nhau, mỗi Phương Lược chỉ được sử dụng 2 loại Thẻ Kỳ Lược, và dựa trên Phương Lược Tác Chiến cùng số lượng Thẻ Kỳ Lược trang bị để cung cấp các hiệu ứng buff khác nhau"
  - "Mỗi Phương Lược Tác Chiến gồm 5 ô Thẻ Kỳ Lược, tương ứng với hiệp thứ hai đến hiệp thứ sáu trong trận đấu, mỗi Ô Thẻ chỉ được đặt 1 thẻ Kỳ Lược"
  - "Mỗi Phương Lược Tác Chiến ban đầu tối đa chứa 3 thẻ Kỳ Lược, sau này có thể tối đa chứa 5 thẻ Kỳ Lược"
- Thẻ Kỳ Lược:
  - "Thẻ Kỳ Lược được chia thành hai phẩm chất Thường và Hiếm, mỗi bộ Kỳ Lược chỉ được sử dụng 1 thẻ Hiếm"
  - "Thẻ Kỳ Lược gồm 5 loại: Dũng, Mưu, Phụ, Sách, Tế, mỗi loại tương ứng với một hiệu quả chiến đấu và có 6 thẻ Thường và 2 thẻ Hiếm"
  - "Hiệu quả của Thẻ Kỳ Lược có hiệu lực từ đầu mỗi hiệp, nếu các đội quân khác nhau sử dụng Thẻ Kỳ Lược cùng hiệp, thứ tự hiệu lực của Thẻ Kỳ Lược sẽ được xác định theo thuộc tính tốc độ của Tướng Chính tương ứng"
- Cách Nhận Thẻ Kỳ Lược: "Thẻ Kỳ Lược có thể nhận được thông qua việc nhận thưởng từ Đài Huân Nghiệp, EXP Đài Công Huân sẽ tự động tăng theo thời gian mỗi ngày"

## Thẻ

Cột "Đối tượng" và "Hiệu ứng" chép nguyên văn từ client, kể cả lỗi của client. Mọi thẻ đều có dòng "Hiệu ứng Kỳ Lược" ở trên, bảng dưới không chép lại dòng này. **Đậm** ở cột Client: tên khác sheet VN.

### Dũng (勇), đồ giám Hoắc Khứ Bệnh

| Ảnh | Hán | Hiếm | Sheet VN | Repo hiện dùng | Client | Đối tượng | Hiệu ứng |
|---|---|---|---|---|---|---|---|
| c1_1 | 封狼居胥 | | Phong Lang Cư Tư / Cư Tế | Phong Lang Cư Tư | Phong Lang Cư Tư | Toàn quân ta | Hiệp này Chiến Pháp Đột Kích tỉ lệ phát động tăng 10% |
| c1_2 | 橫掃河西 | | Càn Quét Tây Hà | Hoành Tảo Hà Tây | Càn Quét Tây Hà | Một quân ta | Cá thể có Võ Lực Cao Nhất trong hiệp này nhận 40% tỉ lệ Liên Kích |
| c1_3 | 摧鋒陷敵 | | Phá Mũi Giáp Địch | Thôi Phong Hãm Địch | Phá Mũi Giáp Địch | Toàn quân ta | Hiệp này Chiến Pháp Đột Kích gây ra sát thương tăng 12% |
| c1_4 | 壯志不絕 | Hiếm | Chí Khí Ngập Tràn | Tráng Chí Bất Tuyệt | Chí Khí Ngập Tràn | Một quân ta | Võ Tướng Võ Lực cao nhất quân ta gây ra sát thương Binh Đao tăng 5% (trước đó mỗi lần dùng 1 lá Kỳ Lược hoặc đã tổn thất 15% Binh Lực thì tăng thêm 3%) |
| c1_5 | 斬逆納降 | Hiếm | Trảm Địch Chiêu Hàng | Trảm Nghịch Nạp Hàng | Trảm Địch Chiêu Hàng | Toàn quân ta | Trước đây mỗi lần phát động 1 Chiến Pháp Đột Kích, trong hiệp này Chiến Pháp Đột Kích sát thương tăng 3% |
| c1_6 | 孤軍深入 | | Đơn Độc Thâm Nhập | Cô Quân Thâm Nhập | Đơn Độc Thâm Nhập | Một quân ta | Hiệp này phát động thất bại Chiến Pháp Đột Kích thử phát động lại 1 lần |
| c1_7 | 擒王破營 | | — | — | Bắt Vua Phá Doanh | Toàn quân ta | Hiệp này sau khi phát động Chiến Pháp Đột Kích, tỉ lệ phát động Chiến Pháp Đột Kích của Võ Tướng đồng đội tăng 5% (có thể tích lũy) |
| c1_8 | 追亡逐北 | | Truy Kích Tử Trận | Truy Vong Trục Bắc | Truy Kích Tử Trận | Toàn quân ta | Hiệp này sau khi Tấn công thường, Trị Liệu đơn thể Đồng Minh (tỷ lệ Trị Liệu 40%) |

### Mưu (謀), đồ giám Hàn Tín

| Ảnh | Hán | Hiếm | Sheet VN | Repo hiện dùng | Client | Đối tượng | Hiệu ứng |
|---|---|---|---|---|---|---|---|
| c2_1 | 設伏十面 | | Bố Trí Thập Diện | Thiết Phục Thập Diện | Bố Trí Thập Diện | Nhóm quân ta | Hiệp này Chiến Pháp Chủ Động tỉ lệ phát động tăng 10% |
| c2_2 | 背水列陣 | | Dàn Trận Tử Chiến | Bối Thủy Liệt Trận | Dàn Trận Tử Chiến | Nhóm quân ta | Một cá thể có Trí Lực và Võ Lực cao nhất trong hiệp này miễn dịch Kế Tận |
| c2_3 | 楚歌四起 | | Sở Ca Tứ Khởi | Sở Ca Tứ Khởi | Sở Ca Tứ Khởi | Toàn quân ta | Hiệp này Chiến Pháp Chủ Động gây ra sát thương tăng 10% |
| c2_4 | 誘敵離營 | Hiếm | Dụ Địch Rời Trại | Dụ Địch Ly Doanh | Dụ Địch Rời Trại | Toàn quân ta | Đã phóng thích 1 lần Chiến Pháp Chủ Động trước đó, sau khi Kỳ Lược hiệu lực sẽ có 10% xác suất phát huy hiệu lực thêm 1 lần nữa |
| c2_5 | 多多益善 | Hiếm | Càng Nhiều Càng Tốt | Đa Đa Ích Thiện | Càng Nhiều Càng Tốt | Toàn quân ta | Trước đó, mỗi lần dùng Kỳ Lược 1 lần, Chiến Pháp Chủ Động đầu tiên trong hiệp này của quân ta sau khi phát động sẽ có 15% xác suất thử phát động lại |
| c2_6 | 拔旗易幟 | | — | Bạt Kỳ Dị Xí | Nhổ Cờ Dịch Cờ | Một quân ta | Hiệp này sau khi tính toán tỉ lệ phát động Chiến Pháp Chủ Động của cá thể có Trí Lực cao nhất trong quân ta sẽ bị đảo ngược |
| c2_7 | 合圍夾擊 | | Hợp Vây Giáp Kích | Hợp Vi Giáp Kích | Hợp Vây Giáp Kích | Toàn quân ta | Hiệp này sau khi phát động Chiến Pháp Chủ Động, Trị Liệu đơn thể Đồng Minh Binh Lực thấp nhất (tỷ lệ Trị Liệu 50%) |
| c2_8 | 暗度陳倉 | | Ám Độ Trần Thương | Ám Độ Trần Thương | Ám Độ Trần Thương | Nhóm quân ta | Khi thi triển Chiến Pháp chuẩn bị hiệp này có 50% xác suất bỏ qua chuẩn bị |

Sở Ca Tứ Khởi và Ám Độ Trần Thương trùng tên giữa client và repo.

### Phụ (輔), đồ giám Trương Lương

| Ảnh | Hán | Hiếm | Sheet VN | Repo hiện dùng | Client | Đối tượng | Hiệu ứng |
|---|---|---|---|---|---|---|---|
| c3_1 | 博浪椎秦 | | Bác Lãng Chuy Tần | Bác Lãng Chùy Tần | Bác Lãng Chuy Tần | Toàn quân ta | Tăng 20% Phá Trận |
| c3_2 | 圯橋受書 | | — | Di Kiều Thụ Thư | Nhận Sách Di Kiều | Nhóm quân ta | Trong hiệp này ngẫu nhiên nhận 1 Tăng ích chức năng chưa từng nhận trước đó |
| c3_3 | 三策並進 | | — | Tam Sách Tịnh Tiến | Tam Sách Cùng Tiến | Toàn quân ta | Trong hiệp này trạng thái chức năng mà quân địch nhận được cũng sẽ được áp dụng cho một đơn vị của quân ta |
| c3_4 | 功成身退 | Hiếm | Lui Bước Công Thành | Công Thành Thân Thoái | Lui Bước Công Thành | Toàn quân ta | Trước đó, cứ mỗi Kỳ Lược Kỳ Lược đã dùng, khi sử dụng Kỳ Lược sau đó sẽ có 30% xác suất ngẫu nhiên thi triển 1 Kỳ Lược đã từng được phe ta dùng |
| c3_5 | 諫封示公 | Hiếm | Kỳ Công Gián Phong | Gián Phong Thị Công | Kỳ Công Gián Phong | Một quân ta | Nhận ngẫu nhiên 1 loại Tăng ích tính năng cho một đơn vị địch ngẫu nhiên (Sau hiệp chuẩn bị với mỗi nhận 1 trạng thái tính năng từng nhận sẽ có 30% xác suất lặp lại 1 lần) |
| c3_6 | 臨危不懼 | | Không Sợ Lâm Nguy | Lâm Nguy Bất Cụ | Không Sợ Lâm Nguy | Nhóm quân ta | Tăng ích ngẫu nhiên đã có kéo dài thêm 1 hiệp |
| c3_7 | 定計安儲 | | Lập Kế An Trữ | Định Kế An Trữ | Lập Kế An Trữ | Một quân ta | Hiệp này đơn thể có Binh Lực cao nhất của quân ta cứu viện toàn thể quân ta, đồng thời giảm 30% sát thương tấn công thường phải chịu |
| c3_8 | 借箸代籌 | | — | — | Thay Mặt Bày Mưu | Nhóm quân ta | Trong hiệp này khi nhận Tăng ích chức năng, nhận thêm một Tăng ích chức năng khác |

Lỗi của client, chép nguyên văn:
- Lui Bước Công Thành: chữ "Kỳ Lược" lặp hai lần.
- Kỳ Công Gián Phong: client ghi "cho một đơn vị **địch** ngẫu nhiên". Đối tượng phát huy của chính thẻ này là "Một quân ta", và SGSDeck ghi 我軍單體. Có thể đây là lỗi dịch của client.
- 定計安儲: bảng thuật ngữ không có dòng này, nhưng ghi chú đội dùng "Định Kế An Trữ" (ví dụ `src/data/recommended-reference/dd307f54…/index.json`).

### Sách (策), đồ giám Tiêu Hà

| Ảnh | Hán | Hiếm | Sheet VN | Repo hiện dùng | Client | Đối tượng | Hiệu ứng |
|---|---|---|---|---|---|---|---|
| c4_1 | 藏書納籍 | | — | — | Nạp Sách Tàng Thư | Một quân địch | Trong hiệp này quân địch ngẫu nhiên nhận được 1 trạng thái khống chế |
| c4_2 | 月下追賢 | | — | Nguyệt Hạ Truy Hiền | Cầu Hiền Dưới Trăng | Nhóm quân ta | Sau khi thi triển trạng thái khống chế trong hiệp này, trạng thái này còn được áp dụng lên một quân địch khác |
| c4_3 | 築闕長安 | | — | — | Dựng Điện Trường An | Một quân địch | Hiệp này địch quân thi triển Chiến Pháp Chủ Động không chuẩn bị cần chuẩn bị 1 hiệp |
| c4_4 | 居功至偉 | Hiếm | — | — | Công Lao Hiển Hách | Toàn quân địch | Vô hiệu Kỳ Lược địch sử dụng lần sau |
| c4_5 | 受封增邑 | Hiếm | — | Thụ Phong Tăng Ấp | Phong Thưởng Tăng Ấp | Toàn quân địch | Sau hiệp chuẩn bị, mỗi lần toàn địch bị thi triển trạng thái ST duy trì, thì khi quân địch trúng ST duy trì hiệp này, sẽ phải chịu thêm 5% sát thương |
| c4_6 | 居儉避禍 | | — | Cư Kiệm Tị Hóa (ghi 居儉避貨) | Tránh Họa Cự Kiệm | Toàn quân địch | Trong hiệp này quân địch ngẫu nhiên nhận được 1 trạng thái sát thương duy trì (chịu ảnh hưởng bởi chỉ số cao hơn trong Võ Lực và Trí Lực, tỷ lệ sát thương 50%) |
| c4_7 | 韜晦自污 | | — | — | Giấu Tài Giấu Của | Nhóm quân ta | Hiệp này khi quân ta hành động, nếu Trạng thái Khống chế có hiệu lực， thì làm cho Quân địch đơn thể nhận cùng một Trạng thái Khống chế |
| c4_8 | 治延軍勢 | | Trấn Giữ Quân Diên | Trị Diên Quân Thế | **Trị Duyên Quân Thế** | Toàn quân ta | Trạng thái sát thương duy trì do quân ta thi triển trong hiệp này kéo dài 1 hiệp |

- Giấu Tài Giấu Của: client dùng dấu phẩy toàn khổ "，".
- Tránh Họa Cự Kiệm: client ghi "Cự Kiệm", trong khi Hán-Việt của 居儉 là "Cư Kiệm". Báo cáo giữ đúng chữ client.

### Tế (濟), đồ giám Lưu Bang

| Ảnh | Hán | Hiếm | Sheet VN | Repo hiện dùng | Client | Đối tượng | Hiệu ứng |
|---|---|---|---|---|---|---|---|
| c5_1 | 芒碭隱蹤 | | Ẩn Tích Mang Thương | Mang Đãng Ẩn Tung | Ẩn Tích Mang Thương | Nhóm quân ta | Giảm 8% ST phải chịu hiệp này |
| c5_2 | 親釋刑縛 | | — | Thân Thích Hình Phược | Gỡ Bỏ Xiềng Xích | Một quân ta | Tại đầu hiệp này nếu đang ở trạng thái Khống chế, thì nhận trạng thái miễn dịch tương ứng với trạng thái đó trong 1 hiệp |
| c5_3 | 疲楚奪勢 | | — | Bì Sở Đoạt Thế | Bì Sở Đoạt Thế | Toàn quân ta | Hiệp này sau khi chịu tấn công thường, gây 1 lần sát thương Binh Đao cho cá thể quân địch (tỷ lệ sát thương 50%) |
| c5_4 | 約法三章 | Hiếm | Ước Pháp Tam Chương | Ước Pháp Tam Chương | Ước Pháp Tam Chương | Một quân ta | Hiệp này Trị Liệu đơn thể Binh Lực thấp nhất của quân ta (tỷ lệ Trị Liệu 100%), gây sát thương Mưu Lược cho đơn thể Binh Lực thấp nhất của quân địch (tỷ lệ sát thương bị ảnh hưởng bởi lượng Trị Liệu dôi ra tích lũy, tối đa 200%) |
| c5_5 | 敗中求生 | Hiếm | Sống Trong Thất Bại | Bại Trung Cầu Sinh | Sống Trong Thất Bại | Toàn quân ta | Mỗi khi quân ta phải chịu 1 lần Công Thường, giảm 2% ST phải chịu |
| c5_6 | 沛縣聚義 | | Bái Huyện Tụ Nghĩa | Bái Huyện Tụ Nghĩa | Bái Huyện Tụ Nghĩa | Toàn quân ta | Tăng 15% lượng trị liệu gây ra trong hiệp này |
| c5_7 | 鴻門遁險 | | Lánh Hiểm Hồng Môn | Hồng Môn Độn Hiểm | Lánh Hiểm Hồng Môn | Toàn quân ta | Hiệp này khi gây Trị Liệu có xác suất gây thêm sát thương Mưu Lược cho đơn thể quân địch (bằng 30% lượng Trị Liệu, mỗi Võ Tướng tối đa kích hoạt 5 lần) |
| c5_8 | 推食解衣 | | Nhường Cơm Sẻ Áo | Thôi Thực Giải Y | Nhường Cơm Sẻ Áo | Nhóm quân ta | Hiệp này khi nhận sát thương sẽ trị liệu đơn thể Đồng Minh (tỷ lệ Trị Liệu 40%) |

- Ước Pháp Tam Chương, Bì Sở Đoạt Thế và Bái Huyện Tụ Nghĩa trùng tên giữa client và repo.
- Lánh Hiểm Hồng Môn: client có thêm "có xác suất", SGSDeck không có.

## Tổng hợp lệch

| | Số thẻ |
|---|---|
| Client khác sheet VN | 1/26 (治延軍勢) |
| Client khác repo, trong số thẻ repo đã có tên | 28/34 |
| Client trùng repo | 6/34: 封狼居胥 Phong Lang Cư Tư, 楚歌四起, 暗度陳倉, 約法三章, 疲楚奪勢, 沛縣聚義 |
| Repo chưa có tên | 6: 擒王破營, 借箸代籌, 藏書納籍, 築闕長安, 居功至偉, 韜晦自污 |

Các biến thể chữ Hán sai trong ghi chú đội: 十面埋伏, 合圍突擊, 圯橋授書, 壯志不決, 延治軍勢, 推衣解食, 摧鋒陷陣, 敗中求勝, 斬將納降, 斬敵納降, 芒場影蹤, 鴻門遇險, 居儉避貨. Khi đổi tên cần gom các biến thể này về đúng mã thẻ ở bảng trên.

Phương lược: client có 2 bộ tên, xem mục Phương lược. Repo dùng tên Hướng dẫn cho 2/5 (Cường Công, Mưu Toán); 3 tên còn lại khác cả hai bộ.

## Giới hạn

- Mỗi thẻ chỉ chép một lượt, đọc từ ảnh gốc 1282×752.
- Không mở màn nhận thưởng của Đài Huân Nghiệp. Đồ Giám đã hiện đủ 40 thẻ, kể cả thẻ chưa nhận, nên không cần màn này để lấy tên.
- Tên phương lược nên dùng tên trên thẻ chọn hay tên trong Hướng dẫn là việc của gate review bản dịch. Báo cáo chỉ ghi lại cả hai.
- Có 3 client cùng chạy. Chụp và bấm theo HWND `5570822`, cửa sổ đang mở màn Kỳ Lược Triều Hán. Không thao tác trên 2 cửa sổ kia.

## Việc tiếp theo

Chưa sửa tên trong ghi chú đội và Tra cứu. Việc này phải qua gate review bản dịch, theo dõi ở #119.
