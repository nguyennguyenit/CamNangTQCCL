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
| Chiến pháp có mục trong `pipeline/lookup-client-tactics.json` | 371/406 | Đã đối chiếu (đọc từ client) |
| `effectViet` và bản hiện hành của `lookup.revisions` | 371 | Đã đối chiếu |
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

## Chưa xác minh

35 chiến pháp trong kho chưa có dữ liệu client. Có ba nhóm:

- **Không tìm thấy ở Thượng Thư Đài, kể cả qua gợi ý; phần lớn là chiến pháp B/nội chính chưa có mô tả**: Án Đồ Tác Ký, Bác Văn, Chú Tượng, Đàm Tâm, Điện Hậu, Đoan Trang Trì Trọng, Hiểu Tri Lương Mộc, Khắc Tuân Họa Nhất, Khiên Chế, Khiên Liên, Lục Lực Thượng Tâm, Nghi Thành Chi Chí, Tế Trí Nhập Vy, Thạc Quả Lũy Lũy, Thích Thương, Thùy Huệ Vạn Vật, Tiễn Đạp, Truy Thương, Xảo Tượng, Trậm Độc, Thương Lẫm Nhi Thực, Thiên Lý Quỹ Lương, Tranh Phân Đoạt Miểu, Ưng Thị, Phá Phong Đoạn Nhẫn.
- **Chiến pháp sự kiện không có trong 51 sự kiện Global**: Cương Dũng Vô Tiền, Hỏa Sí Nguyên Liệu, Đào Viên Kết Nghĩa, Vạn Quân Thủ Tướng.
- **Tướng mang không mở được ở Thượng Thư Đài**:
  - Hà Thị (không có ở Global): Duy Nội Thiện Quyền, Tuyệt Kế Chiết Mưu.
  - SP Tào Tháo: Tàng Khí Đãi Thì, Thừa Thiên Tĩnh Thế.
  - SP Lô Thực: Quốc Chi Trinh Cán.
  - Hồ Già Thập Bát Phách: chưa xác minh.

Chiến pháp client chưa nối được ID trong kho (không tạo mới vì client không hiện chữ Hán):

| Tên client | Manh mối | Ghi chú |
|---|---|---|
| Thiên Vận (B, Nội chính) — Tăng 8→16 Mị Lực | Tự mang và kế thừa: Lưu Thiện | Có thể là 博聞; chưa xác minh |
| Nghệ Nhân (B, Nội chính) — Quan Rèn, Rèn tiêu hao giảm 1%→2% | Tự mang và kế thừa: Mao Giới | 鑄匠 hoặc 巧匠; chưa xác minh |
| Sát Thương Thêm (B, Đột Kích, 25%→40%) — Cấm Trị Liệu 2 hiệp | Kế thừa: Phan Phụng | 追傷 hoặc 牽連; chưa xác minh |
| Tinh • Nhanh Trí Động Não, Chuyển • Bạch Nhị Binh, Tinh • Đại Kích Sĩ, Tinh • Giải Phiền Vệ, Tinh • Lính Giáp Mây | Thượng Thư Đài chỉ gợi ý bản thường | Biến thể tinh luyện của chiến pháp đã có, số liệu khác bản thường |

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
