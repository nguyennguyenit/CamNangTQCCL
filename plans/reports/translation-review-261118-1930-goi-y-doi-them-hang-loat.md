# Duyệt bản dịch vi ↔ zh: Gợi ý đội thêm hàng loạt (#61)

Ngày duyệt: 18/11/2026 (Asia/Saigon). Trang: `/goi-y-doi-tu-kho/` ("Gợi ý đội từ kho" / 武将库配队).

## Phạm vi

- `git diff origin/main -- js/roster-recommend-ui.js js/roster-picker.js`: chỉ phần thêm.
  - `js/roster-recommend-ui.js`: 6 cặp `L()` mới (thanh Hoàn tác + nút "Tôi có tất cả món thiếu của đội này").
  - `js/roster-picker.js`: không có cặp `L()` mới (chỉ import, cờ `paste` trong policy, gắn khối dán, `setDisabled`).
- `js/roster-pasted-name-list-panel.js` (file mới, toàn bộ): 25 cặp (tính cả 2 nhãn loại ở `KIND_TAGS`, gọi qua `L(...)`).
- Đã xác nhận không có chuỗi hiển thị trong `js/roster-pasted-name-list-match.js` và `js/roster-team-missing-items-bulk-add.js`: chỉ có comment/JSDoc tiếng Việt và khoá dữ liệu (`"heroes"`, `"tactics"`, `"ownedTactics"`...), không gọi `L()`.

Tổng: **31 cặp**, **28 ĐẠT**, **3 SỬA** (1 cặp cần sửa thật: aria-label zh; 2 cặp sửa nhẹ về câu chữ).

## Thuật ngữ đối chiếu (đã có trên site)

- kho = 库存: `js/roster-recommend-ui.js:225` ("Đồng bộ kho" / 库存同步), `:265`, `:353`.
- hộp kho = 库存盒: `js/roster-recommend-ui.js:113`, `:222` ("Hộp kho" / 库存盒), `:648`.
- tướng = 武将, chiến pháp = 战法: `js/roster-recommend-ui.js:1200`, `:1202`, `:48` ("Thiếu chiến pháp" / 缺少战法).
- chiến pháp tự mang = 自带: `js/roster-picker.js:127` (`SOURCE_LABELS.INNATE: ["Tự mang", "自带"]`).
- danh mục / Tra cứu = 图鉴: `js/roster-picker.js:250` ("Tìm trong danh mục" / 搜索图鉴), `js/roster-recommend-ui.js:889` (从图鉴快速添加), `:1060`, `:1258`.
- tên Việt, Hán-Việt, chữ Hán = 越南名、汉越音或汉字: `js/roster-picker.js:250` (placeholder ô tìm).
- "Tôi có…" = 我有…: `js/roster-recommend-ui.js:1200` (`我有武将${…}`), `:1202` (我有这个武将 / 我有这个战法), `:1523` (点“我有…”).
- món = 项: `js/roster-recommend-ui.js:1316` (`Thiếu ${total} món` / `缺 ${total} 项`), `:284`. (Có chỗ cũ dùng 件 ở `:1410`, `:1426`; bản mới dùng 项, khớp nhãn "Thiếu N món" trên cùng thẻ.)
- Hoàn tác = 撤销: `js/recruit-tracker.js:436` (`L("Hoàn tác", "撤销")`), `:434` (已撤销。).
- Bỏ qua = 跳过: `js/community-admin-ai.js:344`.
- Hủy = 取消: `js/roster-recommend-ui.js:353` ("Chọn Hủy" / 请选择取消), `js/community-admin-dialogs.js:43`.
- Đối chiếu / chưa đối chiếu = 核对 / 未核对: `js/roster-recommend-ui.js:52` (有未核对的战法), `:1094` ("chưa đối chiếu" / 未核对), `:713` (待核对).

## Bảng các cặp

| # | file:line | vi | zh | Kết luận |
|---|-----------|----|----|----------|
| 1 | js/roster-recommend-ui.js:934 | `Đã gỡ ${added.length} món vừa thêm.` | `已移除刚添加的 ${added.length} 项。` | ĐẠT |
| 2 | js/roster-recommend-ui.js:936 | Hoàn tác | 撤销 | ĐẠT |
| 3 | js/roster-recommend-ui.js:939 | `Đã thêm ${added.length} món của đội ${label} vào hộp “${box}”.` | `已将 ${label} 缺少的 ${added.length} 项加入库存盒“${box}”。` | ĐẠT (ghi chú 1) |
| 4 | js/roster-recommend-ui.js:940 | `Đã thêm ${added.length} món của đội ${label} vào kho.` | `已将 ${label} 缺少的 ${added.length} 项加入库存。` | ĐẠT (ghi chú 1) |
| 5 | js/roster-recommend-ui.js:1300 (aria-label) | `Tôi có tất cả ${items.length} món thiếu của đội ${label}` | `${label} 缺少的 ${items.length} 项我都有` | **SỬA** |
| 6 | js/roster-recommend-ui.js:1305 | Tôi có tất cả món thiếu của đội này | 这支队伍缺的我都有 | ĐẠT |
| 7 | js/roster-pasted-name-list-panel.js:10 | Tướng | 武将 | ĐẠT |
| 8 | js/roster-pasted-name-list-panel.js:10 | Chiến pháp | 战法 | ĐẠT |
| 9 | js/roster-pasted-name-list-panel.js:36 | Dán danh sách tên | 粘贴名称列表 | ĐẠT |
| 10 | js/roster-pasted-name-list-panel.js:46 | Đối chiếu | 核对 | ĐẠT |
| 11 | js/roster-pasted-name-list-panel.js:48 | Kết quả đối chiếu | 核对结果 | ĐẠT |
| 12 | js/roster-pasted-name-list-panel.js:50 | Danh sách tên | 名称列表 | ĐẠT |
| 13 | js/roster-pasted-name-list-panel.js:51-54 | Chép từ game, Zalo hoặc Excel: mỗi tên một dòng, hoặc ngăn bằng dấu phẩy, dấu chấm phẩy. Nhận tên Việt, Hán-Việt hoặc chữ Hán. Chưa ghi vào kho cho tới khi bạn xác nhận. | 可从游戏、Zalo 或 Excel 复制：每行一个名称，或用逗号、分号分隔。支持越南名、汉越音或汉字。确认之前不会写入库存。 | ĐẠT |
| 14 | js/roster-pasted-name-list-panel.js:95 | Hủy | 取消 | ĐẠT |
| 15 | js/roster-pasted-name-list-panel.js:98 | `Thêm ${count} món vào kho` | `将 ${count} 项加入库存` | ĐẠT |
| 16 | js/roster-pasted-name-list-panel.js:104 | Khớp | 已匹配 | ĐẠT |
| 17 | js/roster-pasted-name-list-panel.js:112 | `` · từ “${typed.join("”, “")}”`` | `` · 来自“${typed.join("”“")}”`` | ĐẠT (ghi chú 2) |
| 18 | js/roster-pasted-name-list-panel.js:113 | ` · đã có trong kho` | ` · 已在库存中` | ĐẠT |
| 19 | js/roster-pasted-name-list-panel.js:120 | Cần chọn | 需要选择 | ĐẠT (ghi chú 3) |
| 20 | js/roster-pasted-name-list-panel.js:121 | Tên này khớp nhiều món. Chọn đúng món hoặc để Bỏ qua. | 该名称匹配多个条目。请选择正确的一项，或保持“跳过”。 | **SỬA** (nhẹ) |
| 21 | js/roster-pasted-name-list-panel.js:125 | Bỏ qua | 跳过 | ĐẠT |
| 22 | js/roster-pasted-name-list-panel.js:142 | Không nhận ra | 无法识别 | ĐẠT |
| 23 | js/roster-pasted-name-list-panel.js:143-146 | Không thêm vào kho. Sửa chính tả rồi đối chiếu lại, hoặc tìm trong danh mục bên dưới. | 不会加入库存。请修正拼写后重新核对，或在下方图鉴中搜索。 | ĐẠT |
| 24 | js/roster-pasted-name-list-panel.js:153 | Chiến pháp tự mang | 自带战法 | ĐẠT |
| 25 | js/roster-pasted-name-list-panel.js:154 | Chiến pháp tự mang đi theo tướng, không cần thêm vào kho. | 自带战法随武将拥有，无需加入库存。 | **SỬA** (nhẹ) |
| 26 | js/roster-pasted-name-list-panel.js:157 | `từ “${text}”` | `来自“${text}”` | ĐẠT (ghi chú 2) |
| 27 | js/roster-pasted-name-list-panel.js:172 | `Đã thêm ${items.length} món vào kho. ${leftover.length} tên không nhận ra vẫn còn trong ô để sửa.` | `已将 ${items.length} 项加入库存。${leftover.length} 个无法识别的名称仍保留在输入框中，可修改。` | ĐẠT (ghi chú 4) |
| 28 | js/roster-pasted-name-list-panel.js:173 | `Đã thêm ${items.length} món vào kho.` | `已将 ${items.length} 项加入库存。` | ĐẠT |
| 29 | js/roster-pasted-name-list-panel.js:186-189 | `${result.matched.length} khớp · ${result.ambiguous.length} cần chọn · ${result.unrecognized.length} không nhận ra` | `${result.matched.length} 项匹配 · ${result.ambiguous.length} 项需选择 · ${result.unrecognized.length} 项无法识别` | ĐẠT |
| 30 | js/roster-pasted-name-list-panel.js:190 | `Chỉ đối chiếu ${review.names} tên đầu, bỏ ${truncated} tên còn lại.` | `仅核对前 ${review.names} 个名称，其余 ${truncated} 个已忽略。` | ĐẠT |
| 31 | js/roster-pasted-name-list-panel.js:203 | Chưa có tên nào để đối chiếu. | 还没有可核对的名称。 | ĐẠT |

Biến `${...}`: cả 31 cặp khớp tên và số lượng biến giữa vi và zh. Dấu câu zh dùng đúng `，。：“”`; tiếng Việt đủ dấu.

Ghi chú cho các cặp ĐẠT (không bắt buộc sửa):

1. #3, #4: `label` bản zh là tên tướng nối bằng ` · ` (`teamLabel`, `js/roster-recommend-ui.js:185-188`), ví dụ `已将 曹操 · 荀彧 · 郭嘉 缺少的 3 项加入库存。`. Đọc được, và site đã có tiền lệ dùng `label` trần như vậy (`js/roster-recommend-ui.js:1533`, `已为 ${teamLabel(team)} 选择的…`). Nếu muốn khớp chữ "đội" của bản vi: `已将队伍 ${label} 缺少的 … 项加入…`.
2. #17, #26: 来自“x” cho "từ “x”" (tên người dùng gõ) hiểu được. Nối các trích dẫn liền `“a”“b”` không chèn 顿号 là đúng GB/T 15834 (các thành phần song song đã có dấu ngoặc kép thường không dùng 、).
3. #19: 需要选择 đúng nghĩa; 待选择 gọn hơn và cùng kiểu với 待核对 (`js/roster-recommend-ui.js:713`). Tùy chọn.
4. #27: …仍保留在输入框中，可修改。 đúng nghĩa; có thể viết trọn ý hơn: …仍保留在输入框中，可修改后重新核对。 Tùy chọn.

Kiểm thêm về độ đúng của câu hướng dẫn #13: bộ tách tên `SEPARATORS = /[\r\n\t,;，；、]+/u` (`js/roster-pasted-name-list-match.js:13`) nhận cả dòng mới, phẩy, chấm phẩy (nửa/toàn độ), 、 và tab (ô Excel). Câu hướng dẫn nêu dòng/phẩy/chấm phẩy là đúng; không nêu tab và 、 nhưng không sai.

## Chi tiết các cặp SỬA

### #5. js/roster-recommend-ui.js:1300 (aria-label nút "Tôi có tất cả món thiếu của đội này")

- Hiện tại: vi `Tôi có tất cả ${items.length} món thiếu của đội ${label}` / zh `${label} 缺少的 ${items.length} 项我都有`.
- Lý do:
  - Bản zh mở đầu bằng `label`, mà `label` bản zh là chuỗi tên tướng (`曹操 · 荀彧 · 郭嘉`). Trình đọc màn hình đọc ra "曹操 · 荀彧 · 郭嘉 缺少的 3 项我都有": nghe như các tướng đang thiếu đồ, chủ ngữ "我" bị đẩy xuống cuối; thiếu chữ 队伍 mà bản vi có ("của đội").
  - Không theo mẫu aria đã có của nút đơn: `我有武将${…}` (`js/roster-recommend-ui.js:1200`), cũng không theo bản vi (mở bằng "Tôi có").
  - Nhãn hiển thị là 这支队伍缺的我都有, còn aria-label không chứa cụm này. Người dùng điều khiển bằng giọng nói (đọc theo chữ nhìn thấy) khó gọi đúng nút (WCAG 2.5.3 Label in Name).
- Đề xuất zh (chọn một):
  - A (khớp mẫu 我有…, song song với bản vi): `我有队伍 ${label} 缺少的全部 ${items.length} 项`
  - B (chứa nguyên nhãn hiển thị, tốt nhất cho Label in Name): `这支队伍缺的我都有：${label}，共 ${items.length} 项`
- vi: giữ nguyên được. Nếu chọn B cho zh thì vi nên đổi theo để hai bản cùng cấu trúc: `Tôi có tất cả món thiếu của đội này: ${label}, ${items.length} món`.

### #20. js/roster-pasted-name-list-panel.js:121 (gợi ý nhóm "Cần chọn")

- Hiện tại: vi `Tên này khớp nhiều món. Chọn đúng món hoặc để Bỏ qua.` / zh `该名称匹配多个条目。请选择正确的一项，或保持“跳过”。`
- Lý do: câu nằm một lần ở đầu nhóm, mà nhóm có thể chứa nhiều tên. "Tên này" / 该名称 là số ít nên lệch khi có từ 2 tên trở lên. Bản zh đặt “跳过” trong ngoặc như tên tùy chọn, bản vi thì không. Nên thống nhất.
- Đề xuất:
  - vi: `Mỗi tên dưới đây khớp nhiều món. Chọn đúng món hoặc để “Bỏ qua”.`
  - zh: `以下每个名称都匹配多个条目。请选择正确的一项，或保持“跳过”。`

### #25. js/roster-pasted-name-list-panel.js:154 (gợi ý nhóm "Chiến pháp tự mang")

- Hiện tại: vi `Chiến pháp tự mang đi theo tướng, không cần thêm vào kho.` / zh `自带战法随武将拥有，无需加入库存。`
- Lý do: 随武将拥有 đúng ngữ pháp nhưng gượng (随 … 拥有 ít gặp). Người Trung thường nói 随武将获得 / 随武将一起获得. Thêm 单独 để rõ ý "không cần thêm riêng", đúng với "đi theo tướng" của bản vi.
- Đề xuất zh: `自带战法随武将一起获得，无需单独加入库存。`
- vi: giữ nguyên.

---

Người duyệt: agent độc lập (general-purpose subagent), không phải người viết code. Chỉ đọc mã, không sửa file JS.

## Câu hỏi chưa giải quyết

- #5: chọn phương án A hay B cho aria-label zh? B có lợi về Label in Name nhưng phải đổi cả bản vi cho cùng cấu trúc.

## Đã áp dụng (người viết code, sau review)

- `js/roster-recommend-ui.js` aria-label nút thêm tất cả: chọn phương án B cho cả hai bản để tên truy cập chứa nguyên nhãn hiển thị (WCAG 2.5.3): vi `Tôi có tất cả món thiếu của đội này: ${label}, ${items.length} món`, zh `这支队伍缺的我都有：${label}，共 ${items.length} 项`.
- `js/roster-pasted-name-list-panel.js` nhóm Cần chọn: vi `Mỗi tên dưới đây khớp nhiều món. Chọn đúng món hoặc để “Bỏ qua”.`, zh `以下每个名称都匹配多个条目。请选择正确的一项，或保持“跳过”。`
- `js/roster-pasted-name-list-panel.js` chiến pháp tự mang: zh `自带战法随武将一起获得，无需单独加入库存。`
- Gợi ý tuỳ chọn (待选择, thêm 队伍 ở thông báo Hoàn tác, câu trạng thái sau khi thêm) không áp dụng: các cặp đó đã ĐẠT.
