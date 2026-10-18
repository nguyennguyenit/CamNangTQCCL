# Bổ sung và xác minh chiến pháp từ client Global 24.526 — mục Chiến Pháp và Thượng Thư Đài

- Ngày: 2026-10-16
- Phạm vi: Global (client "Tam Quốc Chí - Chiến Lược 24.526", tài khoản người dùng); mùa: không áp dụng (thẻ chiến pháp ở mức đầy cấp).
- Nguồn (chụp bằng Windows Graphics Capture):
  - **Chiến Pháp > Toàn bộ**: 182 dòng, mở từng dòng ở chế độ "Xem hiệu quả đầy cấp". Mục này chỉ gồm chiến pháp tài khoản đang có.
  - **Chiến Pháp > Kế thừa**: 15 chiến pháp, lấy thêm "Có thể mang".
  - **Chiến Pháp > Sự kiện**: 51 sự kiện, tới Lâm Phong Quyết Địch; lấy điều kiện quy đổi và popup đầy cấp.
  - **Thượng Thư Đài**: thẻ chiến pháp, luôn bấm "Xem hiệu quả đầy cấp" rồi chụp một lượt, kèm các dải cuộn khi chữ dài.
    - Tra theo tên Hán-Việt của kho: 89 thẻ.
    - Mở từ chiến pháp tự mang/kế thừa trên thẻ tướng mang: 74 thẻ (tướng CO viết là "Vô Song X", SP viết là "X SP").
    - Tra theo gợi ý của Thượng Thư Đài: 4 thẻ.

  Tổng cộng 167 chiến pháp lấy từ Thượng Thư Đài, 204 từ mục Chiến Pháp.
- Kết luận trước: 406 chiến pháp dịch từ nguồn Trung (SGSDeck/baseline). 45 chiến pháp chưa có mô tả, 127 chưa có mục tiêu, 132 chưa có dạng hiệu ứng; loại hình, phẩm và tỷ lệ phát động có chỗ lệch client.
- Chính sách người dùng chốt ngày 2026-10-16: client bản Việt là chuẩn cho phần tiếng Việt. Mô tả được thay bằng chữ client, các trường có cấu trúc ghi đè khi lệch.

## Kết quả

| Hạng mục | Số lượng | Trạng thái |
|---|---|---|
| Chiến pháp có mục trong `pipeline/lookup-client-tactics.json` | 396/406 (9 mã trùng chép dữ liệu, mục 2026-10-17 c); (9 qua tướng xanh lam nối ID theo nghĩa tên; 7 qua thẻ tướng: Quốc Chi Trinh Cán và 6 chiến pháp ở mục 2026-10-17 b) | Đã đối chiếu (đọc từ client) |
| `effectViet` và bản hiện hành của `lookup.revisions` | 396 | Đã đối chiếu |
| `targetViet` (Mục tiêu) / `lookup.effectTypeVi` (Buff) | 369 / 199 | Đã đối chiếu |
| `troopFit` (khớp mẫu biểu tượng, không chép tay) | 97 | Đã đối chiếu |
| `lookup.activationRate` / `type` / `quality` | 29 / 15 / 9 | Đã đối chiếu |
| `lookup.exchangeConditionVi` (Sự kiện) / `lookup.maxUsers` (Kế thừa) | 47 / 1 | Đã đối chiếu |
| Tên client thay tên hiển thị `viet` (ID giữ nguyên, tên cũ ở `hanViet`) | 127 | Đã đối chiếu |
| Tướng client nối được chiến pháp tự mang qua alias | 14 | Đã đối chiếu |
| Chiến pháp kho chưa có dữ liệu client | 35 | Chưa xác minh |

Phát hành: promote `client-tactics-261016e` (`lookup:f7aee7f1…`), generation Đội chuẩn `c47c5c65…`. Tên chiến pháp hiển thị toàn site (Tra cứu, Đội chuẩn, Đội khác, Khai hoang, Cùng Tồn, công cụ) theo tên client; dữ liệu đội giữ tên đã lưu và được đổi ở lớp hiển thị.

## Cách xác minh

- Mỗi màn có hai lượt chép độc lập. Chỗ hai lượt lệch nhau được phân xử bằng ảnh phóng to:
  - Toàn bộ: lệch 27 trường trên 179 ô.
  - Sự kiện: lệch 11 trường.
  - Thượng Thư Đài: 25 chỗ lệch trên 174 thẻ, phần lớn là khoảng trắng.
- Tên đã được soát thủ công trên ảnh phóng to:
  - 182 tên ở Toàn bộ: sửa 19 lỗi dấu (ví dụ Ỷ Thế Cầm Quyền, Kỵ Hổ Nan Hạ, Thần Thương Thiệt Chiến).
  - 172 tên thẻ Thượng Thư Đài: sửa Tọa Điếu Kình Ngao, Chỉ Qua Vi Vũ, Si Điều Phượng Tư; giữ đúng chữ của game ở "Nghĩa Đản Hùng Tâm".
- Mỗi thẻ đều được kiểm tra đúng chiến pháp đã hỏi:
  - Thẻ tra theo tên: tên thẻ phải trùng tên tra.
  - Thẻ mở từ tướng: ô "Võ Tướng tự mang" hoặc "Kế thừa từ" phải có tướng đã hỏi.
  - 12 thẻ mở từ tướng bị chụp nhầm thẻ trước đó vì khung chat không cuộn theo. 10 thẻ đã được chụp lại; 2 thẻ (SP Tào Tháo) không lấy lại được nên bị loại.
- Chuẩn hóa chữ đã đối chiếu ảnh:
  - "Lính" trước tên binh.
  - "Đảo Phản" (倒戈).
  - Thêm khoảng trắng giữa số/% và từ khóa màu.
- Cột "Phát động" ở Toàn bộ hiện mức cấp 1. Tỷ lệ phát động lấy giá trị đầy cấp:
  - Dòng có "(Xác suất phát động a%→b%)" lấy b.
  - Thẻ Thượng Thư Đài có Xác suất dạng "a%→b%" cũng lấy b.
  - Hệ quả: Thiên Uy Khiếu Trận phát hành 55% (hiệu chỉnh nguồn 50% vẫn ở ledger). Test đã cập nhật theo.

## Ghi chú về tên trùng và ID trùng

- Kho có 10 cặp ID cùng là một chiến pháp ở client. Mỗi ID nhận cùng dữ liệu client; chưa gộp ID vì đội hình đang tham chiếu ID.

  | Tên client | Các ID trong kho |
  |---|---|
  | Ám Triều Dũng Động | `am-trieu-dung-dong` (暗潮湧動), `am-trieu-hung-dung` (暗潮洶湧) |
  | Lập Lờ Đánh Tráo | `di-hoa-tiep-moc` (移花接木), `lap-lo-danh-trao` (kho ghi 暗渡陳倉 — có thể ghi nhầm chữ Hán) |
  | Lấy Ít Đánh Nhiều | `di-qua-dich-chung` (以寡敵眾), `lay-it-danh-nhieu` (以少胜多) |
  | Đoản Binh Tương Kiến | `doan-binh-tuong-kien` (短兵相見), `doan-binh-tuong-tiep` (短兵相接) |
  | Gió Táp Mưa Sa | `gio-tap-mua-sa`, `tat-phong-sau-vu` (疾風驟雨) |
  | Lửa Cháy Ngùn Ngụt | `han-thien-si-dia` (熯天熾地), `lua-chay-ngun-ngut` |
  | Nhanh Chân Tranh Đất | `nhanh-chan-tranh-dat`, `si-tranh-tien-pho` (士爭先赴) |
  | Thâm Mưu Viễn Lược | `tham-muu-vien-lu` (深謀遠慮), `tham-muu-vien-luoc` (深谋远略) |
  | Tử Sĩ Tiên Phong | `tien-dang-tu-si` (先登死士), `tu-si-tien-phong` |
  | Vạn Quân Đoạt Sư | `van-quan-doat-su`, `van-quan-doat-suy` (萬軍奪帥) |

- Đổi theo client:
  - Khô Mộc Phùng Xuân (mục chờ kiểm, ghi Chỉ huy) → Nội chính.
  - Ngự Địch Bình Chướng → Chỉ huy.
  - Biết Mình Biết Ta → phẩm S.
  - Tam Quân Chi Chúng: client ghi loại "Binh Thư", không có trong enum nên giữ loại của kho.
- Nối ID nhờ thẻ tướng:
  - Thể Hiện Tài Năng = `phong-mang-tat-lo` (kế thừa Mã Trung).
  - Kế Hoạch Quyết Đoán = `dinh-muu-quy-quyet` (kế thừa Hứa Du).
- Tên client khác hẳn tên Hán-Việt, ví dụ:
  - Bốn Bề Rung Động (`chan-hai-tu-canh`)
  - Vững Như Thành Đồng (`co-nhuoc-kim-thang`)
  - Gan Góc Phi Thường (`nhat-than-thi-dam`)
  - Vực Sâu Khó Dò (`uyen-nhien-nan-trac`)

  Các tên này giờ là tên hiển thị; tên Hán-Việt cũ vẫn tìm được.

## Bổ sung 2026-10-17: tra tướng xanh lam ở Thượng Thư Đài

- Tra 45 tướng 1–3 sao có trong kho (gợi ý của người dùng), mở chiến pháp tự mang và kế thừa trên thẻ tướng, chụp đầy cấp. Kết quả: 46 thẻ khác nhau; tướng xanh lam tự mang và kế thừa cùng một chiến pháp, trừ Phan Phụng. Hai lượt chép độc lập, 13 chỗ lệch (dấu, tên tướng) đã phân xử trên ảnh. Vệ Thành không có ở Thượng Thư Đài.
- 9 chiến pháp B được thêm. Client không hiện chữ Hán nên ID nối theo nghĩa tên Hán-Việt + loại hình. Nội dung là chữ client: **Đã đối chiếu**. Phép nối ID: **Phương án từ nguồn**.

  | ID kho | Tên client | Tướng | Căn cứ nối |
  |---|---|---|---|
  | `bac-van` 博聞 | Uyên Bác | Đặng Chi | uyên bác = 博聞; B nội chính |
  | `chu-tuong` 鑄匠 | Thợ Rèn | Gia Cát Chiêm | thợ đúc; Quan Sắt; B nội chính |
  | `xao-tuong` 巧匠 | Nghệ Nhân | Mao Giới | thợ khéo; Quan Rèn; B nội chính |
  | `dam-tam` 談心 | Tâm Sự | Hướng Sủng | tâm sự = 談心; B chủ động |
  | `thich-thuong` 刺傷 | Đâm Thương | Ngô Ý | đâm thương = 刺傷; B chủ động |
  | `dien-hau` 殿後 | Chốt Đuôi | Ngu Phiên | đi chặn hậu = 殿後; B chủ động |
  | `khien-lien` 牽連 | Liên Luỵ | Tôn Hạo | liên luỵ = 牽連; B đột kích |
  | `tien-dap` 踐踏 | Giẫm Đạp | Tống Hiến | giẫm đạp = 踐踏; B chủ động, mục tiêu 2 người (kho: 群體 2人) |
  | `truy-thuong` 追傷 | Sát Thương Thêm | Phan Phụng (kế thừa) | B đột kích; còn 牽連 đã ứng với Liên Luỵ |

- Không ứng với chiến pháp còn thiếu nào: Thiên Vận (Lưu Thiện, +Mị Lực), Hộ Vệ (Phó Sĩ Nhân, Gánh Vác cho chủ tướng), chiến pháp tướng 1–2 sao (Áp Chế-Sơ, Hào Hùng-Sơ, Làm Loạn-Sơ, Cổ Vũ-Sơ, Cấp Cứu-Sơ, Cấp Tốc, Dũng Võ, Gan Dạ). Các thẻ còn lại trùng chiến pháp đã có dữ liệu.

- **SP Lô Thực = SP Lô Trực** (盧植; "SP Lô Trực" là alias client của `hero:sp-lo-thuc`). Tra "SP Lô Trực" ở Thượng Thư Đài: tự mang **Nòng Cốt Quốc Gia** (Chỉ huy, 100%, Tập thể quân ta 3 người) → `quoc-chi-trinh-can` 國之楨榦, **Đã đối chiếu** theo tướng mang; kế thừa Nhạn Hành Trận (đã có). Lần trước tra "Lô Trực SP" không ra vì client đặt "SP" ở đầu tên.

## Bổ sung 2026-10-17 b: kiểm chiến pháp tự mang/kế thừa của tướng

- 206 tướng (trừ 45 tướng xanh lam và SP Lô Trực); tra thẻ tướng ở Thượng Thư Đài, hai lượt chép độc lập, đối chiếu tên tướng trên thẻ với tên tra (thẻ cũ còn trên màn hình bị loại). Tướng SP ở client có hai dạng tên: "SP X" hoặc "X SP" (Hứa Chử SP, Mã Siêu SP, Quách Gia SP…).
- Kết quả 204 thẻ: 382 dòng khớp kho sau khi sửa; 80 liên kết ghi bằng `overrides` (**Đã đối chiếu** theo thẻ tướng); 16 dòng trỏ mã còn lại của cặp mã trùng tên client (cùng chiến pháp ở client, giữ nguyên).
- Sửa sai: Chu Tuấn kế thừa Dương Đông Kích Tây (kho: Thiên Lý Trì Viện, của Chu Hoàn); tự mang Trấn Áp Khăn Vàng chưa có trong kho → bỏ liên kết sai. `lap-lo-danh-trao` 暗渡陳倉 = Ám Độ Trần Thương (Đặng Ngải), không phải Lập Lờ Đánh Tráo.
- Chiến pháp mới từ thẻ tướng (nối ID theo tướng mang + nghĩa tên; **Phương án từ nguồn** phần ID): Tranh Phân → 爭分奪秒 (Lưu Biểu), Cẩn Thận Tỉ Mỉ → 細緻入微 (Bộ Luyện Sư), Án Đồ Tác Kí → 按圖索驥 (Mã Thiết), Biết Được Gỗ Tốt → 曉知良木 (Thái Ung; số 1.5%→3% trùng bản Trung), Thành Quả To Lớn → 碩果累累 (Trần Lâm; hiệu ứng lương thảo, cũng gần 仓廪而实 — chọn theo nghĩa tên), Nghi Thành → 宜城之志 (Từ Thịnh).
- Chưa có trong kho: Chi Diệp Phù Tô (Lý Nghiêm, Quan Gỗ 1%→2%), Trấn Áp Khăn Vàng (Chu Tuấn). 40Y Lữ Bố tra bằng "40周年吕布" (tên client hiện chữ Hán): tự mang Thiên Uy Khiếu Trận, không kế thừa — khớp kho. SP Chu Tuấn tra bằng "Chu Tuấn SP": Vi Sư Tất Khuyết / Mau Giành Lợi Thế — khớp kho. Không mở được: Hà Thị và SP Tào Tháo (không có ở client Việt Nam). Đã kiểm 204/206 tướng (2 tướng còn lại không có ở client Việt Nam).

## Bổ sung 2026-10-17 c: mã trùng do người dùng nhận diện

Người dùng đối chiếu mô tả nguồn Trung với tên client. Các cặp là mã trùng trong kho (tên Hán khác chữ/OCR hoặc tên cũ); mã thiếu nhận cùng dữ liệu client với mã đã chụp, chưa gộp ID:

| Mã thiếu | Tên client | Mã đã có dữ liệu |
|---|---|---|
| `tram-doc` 鴆毒 | Rượu Độc | `cuu-doc` 鳩毒 |
| `ung-thi` 鷹視 | Ưng Thị Lang Cố | `ung-thi-lang-co` 鷹視狼顧 |
| `cuong-dung-vo-tien` 剛勇無前 | Vô Địch Can Trường | `vo-dich-can-truong` |
| `hoa-si-nguyen-lieu` 火熾原燎 | Lửa Lan Khắp Chốn | `lua-lan-khap-chon` |
| `ho-gia-thap-bat-phach` 胡笳十八拍 | Tiếng Sáo Dư Âm | `ho-gia-du-am` 胡笳餘音 |
| `khac-tuan-hoa-nhat` 克遵画一 | Khắc Tôn Họa Nhất | `khac-tuan-hoach-nhat` 克遵畫一 |
| `thuong-lam-nhi-thuc` 仓廪而实 | Thành Quả To Lớn | `thac-qua-luy-luy` |
| `luc-luc-thuong-tam` 戮力上心 | Lục Lực Thượng Quốc | `luc-luc-thuong-quoc` 戮力上國 |
| `pha-phong-doan-nhan` 破锋断刃 | Thôi Phong Đoạn Nhẫn | `thoi-phong-doan-nhan` 摧鋒斷刃 |

## Chưa xác minh

10 chiến pháp trong kho chưa có dữ liệu client (người dùng xác nhận không có trong client Việt Nam hoặc không phải chiến pháp):

- **Không có trong client Việt Nam** (Thượng Thư Đài, 45 tướng xanh lam và người dùng đều không thấy): Vạn Quân Thủ Tướng, Khiên Chế (manh mối Phan Phụng), Thiên Lý Quỹ Lương (Lý Nghiêm mang Tịnh Hóa), Đoan Trang Trì Trọng (không có Tuân Thái; không rõ hoạt động tầm phỏng), Thùy Huệ Vạn Vật (tăng tỷ lệ giao dịch ở client chỉ có Đại Kiều; Vương Nguyên Cơ là tướng S).
- **Tướng mang không có ở client Việt Nam**: Hà Thị — Duy Nội Thiện Quyền, Tuyệt Kế Chiết Mưu; SP Tào Tháo — Tàng Khí Đãi Thì, Thừa Thiên Tĩnh Thế.
- **Không phải chiến pháp**: Đào Viên Kết Nghĩa — ở client là Duyên phận tướng "Kết Nghĩa Vườn Đào" (theo người dùng); mục này trong kho cần rà lại.

Chiến pháp client chưa nối được ID trong kho (không tạo mới vì client không hiện chữ Hán):

| Tên client | Manh mối | Ghi chú |
|---|---|---|
| Thiên Vận (B, Nội chính) — Tăng 8→16 Mị Lực | Tự mang và kế thừa: Lưu Thiện | Không khớp chiến pháp còn thiếu nào |
| Hộ Vệ (Chủ động, 35%) — Gánh Vác 10%→20% sát thương cho chủ tướng | Tự mang và kế thừa: Phó Sĩ Nhân | Không khớp chiến pháp còn thiếu nào |
| Tinh • Nhanh Trí Động Não, Chuyển • Bạch Nhị Binh, Tinh • Đại Kích Sĩ, Tinh • Giải Phiền Vệ, Tinh • Lính Giáp Mây | Thượng Thư Đài chỉ gợi ý bản thường | Biến thể tinh luyện của chiến pháp đã có, số liệu khác bản thường |
| Chiến pháp tướng 1–2 sao (bản "-Sơ", Cấp Tốc, Dũng Võ, Gan Dạ) | Thẻ tướng 1–2 sao | Kho không có các chiến pháp này |

## Giới hạn

- Mô tả tiếng Việt là chữ client (Global). Bản Trung `effect` và lịch sử phiên bản từ nguồn Trung vẫn được giữ.
- Ô "Hiệu quả xung đột" đã chép nhưng chưa đưa vào `lookup.conflictsVi`, vì tên nhiều chữ trong ô không tách chắc được.
- SGSDeck: chưa có mốc SGSDeck đã xác minh. Client Global được coi là nguồn có thẩm quyền độc lập.
- Ảnh gốc và bản chép (`cp/det`, `cp/ke`, `cp/ev`, `cp/ttd`, `tx/*.jsonl`) nằm ở `%TEMP%\tqccl-cap`, **không nằm trong repo**.

## Budget ledger

Topic: bổ sung và xác minh chiến pháp từ client 24.526 (mục Chiến Pháp, Thượng Thư Đài).

| Allowance | Limit | Used | Remaining |
|---|---|---|---|
| External sources | 5 | 0 | 5 |
| TQCCL MCP | 5 | 0 | 5 |
