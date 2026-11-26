# Phase 2: chênh kích thước HTML của sáu trang danh sách đội

Đo trên `dist/{,zh/,ja/}doi-{chuan,khac}/index.html`. "Trước" là bản build của Phase 1 (khung lọc chưa được dựng sẵn), "sau" là bản build cuối của Phase 2 (đã phát hành lại thế hệ localization `d5fc5c25…`).
gzip: mức 9. brotli: mức mặc định của Node (11).

| Trang | Trước (byte) | Sau (byte) | Tăng thô | Tăng gzip | Tăng brotli |
|---|---:|---:|---:|---:|---:|
| `/doi-chuan/` | 718956 | 732511 | +13555 | +2238 | +1530 |
| `/doi-khac/` | 377253 | 386448 | +9195 | +1535 | +1229 |
| `/zh/doi-chuan/` | 666113 | 676993 | +10880 | +1984 | +1496 |
| `/zh/doi-khac/` | 356776 | 365845 | +9069 | +1576 | +1165 |
| `/ja/doi-chuan/` | 675219 | 686203 | +10984 | +1993 | +1542 |
| `/ja/doi-khac/` | 362006 | 371205 | +9199 | +1599 | +1243 |

## Quyết định

Mục tiêu "dưới 10 KB thô mỗi trang" là ước lượng chưa kiểm chứng trong plan. Ba trang Đội chuẩn vượt: 13555 / 10880 / 10984 byte thô. Ba trang Đội khác nằm trong mục tiêu (9,1 đến 9,2 KB).

Main đã **chấp nhận**: mức tăng nén là +1,2 đến +2,2 KB trên trang khoảng 0,7 MB, không đáng kể. Phần lớn byte nằm ở những chỗ phải có để Phase 3 so được DOM trước/sau boot:

- Ô chọn mùa của Đội chuẩn: 30 `<option>`, bản Việt 4,7 KB do `title` tiếng Việt của từng mùa (zh/ja 2,2 KB). Client cũng dựng đúng các option này, nên không thể bỏ ở bản dựng sẵn.
- Sidebar lọc khoảng 4,7 KB và thanh công cụ khoảng 3,0 KB (chip, nhãn, nút kiểu hiển thị).
- `aria-disabled="true"` trên điều khiển của khung chỉ chiếm khoảng 0,5 KB, cắt đi không đáng kể.

## Khai hoang và Cùng Tồn

Không đổi byte do mã Phase 2 (vi/zh/ja, 66 tệp gồm trang danh sách và trang chi tiết): bản build trước khi phát hành lại thế hệ giống hệt bản Phase 1 (66/66). Sau khi phát hành lại thì chỉ khác ở các dấu vân tay `sha256:` / thế hệ / `data-ssr-source` (che các dấu này thì 66/66 giống nhau). Khối "panel lọc mở sẵn" của script bảo vệ chỉ được phát cho Đội chuẩn / Đội khác, nên script của hai mục kia giữ nguyên.
