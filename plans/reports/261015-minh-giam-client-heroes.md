# Bổ sung võ tướng từ client Global 24.526 — Minh Giám

- Ngày: 2026-10-15
- Phạm vi: Global (client "Tam Quốc Chí - Chiến Lược 24.526", PID 183080, tài khoản người dùng); mùa: không áp dụng (dữ liệu thẻ tướng cấp 1).
- Nguồn: màn hình Võ Tướng → Minh Giám → Tổng thể (241 mục) và trang chi tiết từng tướng, chụp bằng Windows Graphics Capture.
- Kết luận trước: catalog có 202 tướng; 91 tướng thiếu `iconUrl`; 14 tướng trống chỉ số/binh chủng.

## Kết quả

| Hạng mục | Số lượng | Trạng thái |
|---|---|---|
| Tướng mới (không có trong SGSDeck/baseline) | 50 (5 bản thường 4★, 32 tướng 3★, 9 tướng 2★, 4 thẻ lính 1★) | Đã đối chiếu (đọc từ client) |
| Ảnh chân dung tự host `public/heroes/*.webp` | 129 (50 mới + 79 tướng cũ chưa có ảnh) | Đã đối chiếu |
| Sửa giá trị sai theo client (client là chuẩn cho bản tiếng Việt/Global) | 86 tướng: 63 chỉ số, 85 tăng trưởng, 56 binh chủng, 7 cost | Đã đối chiếu (chép tay từ client, đối chiếu thêm bằng OCR; binh chủng lấy từ 2 nguồn: bảng Tổng thể và màu ô) |
| Bổ sung vai trò (`roleTag`) | 55 | Đã đối chiếu |
| Tên gọi khác theo cách viết của client | 14 | Đã đối chiếu |
| Tên chữ Hán của 50 tướng mới | 50 | Chưa xác minh (client Global không hiển thị chữ Hán; do agent phiên âm ngược) |
| Tướng vẫn thiếu ảnh | 11 (8 CO, 40Y Lữ Bố, Hà Thị, SP Tào Tháo) | Không có trong Minh Giám Global |

Dữ liệu nằm ở `pipeline/lookup-client-heroes.json` và được phát hành qua `pipeline/build_unified_lookup.py`.

## Ghi chú

- Trương Bảo 張寶 (4★, Quần) được hiển thị là "Trương Bảo Khăn Vàng" (`hero:truong-bao-khan-vang`, alias "Trương Bảo"). Lý do: tên gốc tạo id `hero:truong-bao`, trùng với Trương Bào 張苞.
- Tên chiến pháp riêng do client hiển thị (`selfTacticVi`) chỉ được liên kết khi trùng chính xác với tên Việt trong `tactics.json`. Phần lớn không trùng, ví dụ "Lấy Nhu Chế Cương" và `chi-nhu-dong-cuong`, nên trang hồ sơ hiện "Liên kết đang được cập nhật".
- Một số tên client viết khác catalog, ví dụ Lô Trực/Lô Thực, Lý Thôi/Lý Quyết, Quách Dĩ/Quách Tỷ, Văn Xú/Văn Sửu, Chu Hoàn/Chu Hằng, Gia Cát Cẩn/Gia Cát Cảnh. Đây là cùng một tướng; cách viết của client đã được thêm làm tên gọi khác.
- Nguyên nhân sai: SGSDeck ghi giá trị tạm cho tướng 4★ (chỉ số 0, binh chủng `CCCCC`, cost 4). Lưu Diệp mang binh chủng của SP Lưu Diệp. 7 giá trị ghim trong `GOLDEN_HERO_DELTAS` (Mị của Vương Nguyên Cơ, Trương Xuân Hoa, Quan Ngân Bình, Mã Vân Lộc, Lữ Linh Ỷ, Đổng Bạch và Tốc của Nhạc Tiến) khác client nên đã chuyển sang giá trị client.
- Còn 6 tướng chưa có vai trò (6 tướng CO) và 11 tướng chưa có ảnh, vì đều không có trong Minh Giám Global. Liên kết chiến pháp để session sau.
- SGSDeck: chưa có mốc SGSDeck đã xác minh (các tướng này không có trong snapshot SGSDeck).

## CO / 40Y — đã xử lý (2026-10-16, promote `client-heroes-261016b`)

Kết quả cuối, theo thẻ cấp 1 của **Hảo Hữu → Thượng Thư Đài** (gõ "Vô Song <tên>" hoặc "40 Năm Lữ Bố"; Đã đối chiếu):

| Tướng | Võ | Trí | Thống | Tốc | Trị | Mị | Đã sửa |
|---|---|---|---|---|---|---|---|
| 40Y Lữ Bố | 100 | 26 | 97 | 74 | 13 | 40 | 6 chỉ số (trước là giá trị cấp 50), tăng trưởng Trị +0.08 / Mị +0.58 |
| CO Chân Cơ | 50 | 95 | 80 | 80 | 66 | 94 | Trí 155 → 95; vai trò Mưu lược / Liên |
| CO Chu Nhiên | 69 | 71 | 79 | 55 | 60 | 75 | Võ 129 → 69 |
| CO Quan Bình | 82 | 72 | 80 | 57 | 60 | 76 | Võ 122 → 82, Tốc 87 → 57; vai trò Khống chế / Phụ trợ / Liên |
| CO Tinh Thái | 83 | 60 | 85 | 52 | 22 | 78 | Thống 145 → 85; vai trò Phòng thủ / Chiến / Liên |
| CO Đại Kiều | 58 | 82 | 88 | 80 | 78 | 92 | vai trò Phụ trợ / Liên (thay câu mô tả dài) |
| CO Lữ Linh Ỷ | 88 | 37 | 79 | 60 | 18 | 34 | vai trò Vũ lực / Liên (thay câu mô tả dài) |
| CO Tiểu Kiều | 82 | 74 | 40 | 81 | 77 | 92 | vai trò Phụ trợ / Vũ lực / Liên |
| CO Tào Phi | 86 | 86 | 80 | 56 | 86 | 82 | không cần sửa số liệu |

- Cả 9 tướng có ảnh chân dung (7 cắt từ ảnh người dùng gửi, Chu Nhiên và Tào Phi cắt từ thẻ của Thượng Thư Đài).
- Người dùng xác nhận game Global chỉ có 8 tướng CO, đúng với dự án.
- Còn lại: CO Chu Nhiên và CO Tào Phi chưa có vai trò (người dùng chưa sở hữu nên không mở được trang chi tiết; Thượng Thư Đài không hiện nhãn vai trò). Nghĩa của nhãn "Liên" (聯) chưa xác minh. Hà Thị và SP Tào Tháo vẫn chưa có ảnh.

### Ghi chép trong quá trình đối chiếu

Mục Tổng thể của Minh Giám **không liệt kê** bản CO/40Y; các bản này chỉ hiện trong danh sách Võ Tướng đã chiêu mộ. Ghi chú trước đây rằng chúng "không có trong Minh Giám Global" là sai.

Đối chiếu 7 ảnh chụp người dùng gửi (client 24.526). Chỉ số cấp 1 tính bằng `giá trị hiện − tăng trưởng × (cấp − 1)`; công thức này chỉ đúng khi tướng chưa cộng điểm (ở Lv5 chưa có điểm cộng; ở Lv20 dùng được khi nút "Thêm điểm" còn chấm đỏ báo điểm chưa dùng).

| Tướng (cấp trong ảnh) | Võ | Trí | Thống | Tốc | Trị | Mị | Binh chủng | Vai trò client |
|---|---|---|---|---|---|---|---|---|
| CO Tiểu Kiều (Lv5), client / dự án | 82 / 82 | 74 / 74 | 40 / 40 | 81 / 81 | 77 / 77 | 92 / 92 | `B C A A C` khớp | Phụ / Võ / Liên |
| CO Lữ Linh Ỷ (Lv20, còn điểm chưa dùng) | 88 / 88 | 37 / 37 | 79 / 79 | 60 / 60 | 18 / 18 | 34 / 34 | `S B S A C` khớp | Võ / Liên |
| CO Quan Bình (Lv5) | **82 / 122** | 72 / 72 | 80 / 80 | **57 / 87** | 60 / 60 | 76 / 76 | `S A C S C` khớp | Khống / Phụ / Liên |
| CO Tinh Thái (Lv5) | 83 / 83 | 60 / 60 | **85 / 145** | 52 / 52 | 22 / 22 | 78 / 78 | `B S C S B` khớp | Khiên / Chiến / Liên |
| CO Chân Cơ (Lv20, có thể đã cộng điểm) | 50 / 50 | **≤95 / 155** | 80 / 80 | 80 / 80 | 66 / 66 | 94 / 94 | `S B S B C` khớp | Mưu / Liên |
| CO Đại Kiều (Lv45, Thức tỉnh, đã cộng điểm) | 58 / 58 | ? / 82 | ? / 88 | 80 / 80 | ? / 78 | ? / 92 | `A C S A C` khớp | Phụ / Liên |
| 40Y Lữ Bố (Lv20, còn điểm chưa dùng) | **100 / 248.96** | **26 / 39.23** | **97 / 165.6** | **74 / 143.09** | **13 / 0** | **40 / 0** | `A B S S C` khớp | Võ |

- Đính chính: một bản ghi trước trong mục này nói binh chủng của 40Y Lữ Bố, CO Tiểu Kiều và CO Chân Cơ bị sai. Kết luận đó **sai**: lúc đó đọc binh chủng theo thứ tự khóa trong file (`cung, khiGioi, ky, thuan, thuong`). Đọc đúng thứ tự thì binh chủng cả 7 tướng đều khớp client, cost cũng khớp.
- 40Y Lữ Bố: chỉ số trong dự án đúng bằng giá trị **cấp 50** (ví dụ 100 + 3.04 × 49 = 248.96). Trị và Mị ghi 0 với tăng trưởng 0, trong khi client có +0.08 và +0.58. Đã đối chiếu: dự án sai.
- CO Quan Bình lệch +40 Võ / +30 Tốc, CO Tinh Thái lệch +60 Thống, CO Chân Cơ lệch ít nhất +60 Trí. CO Tiểu Kiều và CO Lữ Linh Ỷ không lệch. Mức chênh không thể là điểm cộng tay (Lv5 chưa có điểm cộng). Theo quyết định "client là chuẩn", sẽ sửa Quan Bình và Tinh Thái theo client.
- CO Chân Cơ: không thấy chấm đỏ ở "Thêm điểm", nên Trí 95 có thể đã gồm điểm cộng. Trí gốc ≤ 95, chưa chốt được. CO Đại Kiều: đã cộng điểm, chỉ xác minh được Võ 58 và Tốc 80.
- Tăng trưởng của cả 7 tướng khớp client, trừ Trị/Mị của 40Y Lữ Bố.
- Nhãn vai trò "Liên" chưa có trong bộ nhãn của dự án; tạm dùng chữ Hán 聯 (chưa xác minh).
- Chưa có ảnh client cho: CO Chu Nhiên, CO Tào Phi.
- Chưa biết game Global còn tướng CO nào chưa có trong dự án; cần kiểm tra danh sách Võ Tướng (lọc CO) trong client.
- Dữ liệu đã chuẩn bị (chưa đưa vào repo): `%TEMP%\tqccl-cap\co\out\` gồm 7 ảnh chân dung WebP 300×300 và `co-fragment.json` (chỉ số cấp 1, tăng trưởng, vai trò). Script: `%TEMP%\tqccl-cap\co\stage_co.py`.
- Cần sửa builder trước khi áp dụng: hiện `roleTags` chỉ điền khi vai trò đang trống, mà CO Đại Kiều và CO Lữ Linh Ỷ đang có câu mô tả dài thay cho nhãn, nên cần cho phép ghi đè vai trò qua `overrides`.

## Nơi lưu dữ liệu

- Dữ liệu đã phát hành: `pipeline/lookup-client-heroes.json` → `data/heroes-dict.json`; ảnh ở `public/heroes/`.
- Ảnh chụp gốc và bản chép tay (`roster.txt`, `stats.txt`, `stats2.txt`, 241 ảnh `det/`) nằm ở `%TEMP%\tqccl-cap`, **không nằm trong repo**.

## Budget ledger

Topic: bổ sung võ tướng từ Minh Giám client 24.526.

| Allowance | Limit | Used | Remaining |
|---|---|---|---|
| External sources | 5 | 1 (tải 1 icon tham chiếu lingxigames) | 4 |
| TQCCL MCP | 5 | 0 | 5 |
