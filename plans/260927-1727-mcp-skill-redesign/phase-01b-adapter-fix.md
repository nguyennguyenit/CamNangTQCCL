# Bước 1b — Sửa adapter Gợi ý kho trước khi nối MCP

Trạng thái: chưa triển khai. Chạy song song [phase 1](phase-01-mcp-publication.md). Là điều kiện của Release 2 (`tqccl_recommend_teams`).

Context: [design §4](design.md), audit hai lượt trên plan [260929 gợi ý đội theo mùa](../260929-0415-goi-y-doi-theo-mua/plan.md) (debate `goi-y-doi-mua-1-fallback` và `goi-y-doi-mua-2-substitutes`, 2026-09-29).

## Mục tiêu

Website và MCP gọi chung `recommendRoster` (`js/roster-season-candidates.js`). Sửa lỗi ở đây trước để lỗi không lan sang Dewee; website hưởng bản sửa trước.

## Lỗi cần sửa (còn trong code tại `2b528a0`)

| # | Lỗi | Vị trí | Hệ quả quan sát |
|---|---|---|---|
| 1 | Cắt pool 60/80 trước khi kiểm kho khi không có `seasonContext` (đường website) | `js/team-recommend-engine.js:133`; bước tìm cắt tiếp còn 60 ở `:429` | pk-s26 chế độ Meta: dựng được 21/81 cấu hình nhưng trả 0 đội mùa, đội cũ lấp sai |
| 2 | Loại đội cũ trùng bộ 3 tướng với **mọi** đội mùa, không chỉ đội mùa đã chọn | `js/roster-season-candidates.js:142-145` | Đội mùa thiếu món X loại luôn đội cũ cùng bộ tướng dùng món Y có trong kho → `portfolio=[]` |
| 3 | Món bù không kiểm luật đội: tối đa 1 trận pháp, 1 binh chủng, binh chủng phải hợp loại binh | `js/roster-season-candidates.js:170-188` | pk-s24 `team-1imndp3`: gợi ý Phi Hùng Quân (chỉ kỵ binh) cho đội khiên binh; fixture hai trận pháp vào cùng đội ở T0 |
| 4 | Cấu hình thiếu `unitTypesRaw` vẫn được gợi ý binh chủng | adapter + dữ liệu | 48/1336 cấu hình Giao chiến thiếu; pk-s24 có 2/80 |
| 5 | Gợi ý món bù bỏ qua món bù đã chọn trước | `js/roster-recommend-ui.js` (danh sách chiến pháp đội lấy từ tên gốc) | Gợi ý trùng hoặc vượt luật sau lần thay thứ hai |
| 6 | Món bù thứ 21 bị bỏ âm thầm | `js/roster-scan-state.js` (`MAX_TACTIC_OVERRIDES = 20`, nối cuối rồi cắt) | Mất lựa chọn của người chơi không báo |
| 7 | Ô chiến pháp không đối chiếu được tên: chưa fallback tên Việt, vẫn báo xây ngay | `js/roster-season-candidates.js:25-33` (`conditionalTactics`) | Báo "xây ngay" cho đội còn ô chưa đối chiếu |
| 8 | Nhãn bậc biến thể đã thay | UI kết quả | Hiện "T0" cạnh "Đã thay" như thể bản thay đã được đánh giá |

## Thực hiện

1. Viết fixture đỏ trước: `s28-wutugu-huangma`, `team-831163` (`team-jyspt`), probe >60 và >80 ứng viên, pk-s26 chế độ Meta, pk-s24 `team-1imndp3`, fixture hai trận pháp, cấu hình thiếu `unitTypesRaw`, 21 món bù.
2. Lỗi 1: lọc theo kho trước khi cắt; thêm option `poolLimit`; fullBox có dự phòng xét toàn danh sách. Không bịa `seasonContext` để né giới hạn.
3. Lỗi 2: chỉ bỏ đội cũ trùng bộ tướng với đội mùa **đã chọn** (`season.addTeams`).
4. Lỗi 3–5: kiểm tổ hợp chiến pháp cuối của đội (≤1 trận pháp, ≤1 binh chủng, binh chủng hợp loại binh); tính cả món bù đã chọn; thiếu `unitTypesRaw` thì không gợi ý binh chủng. Hết tổ hợp hợp lệ thì trạng thái riêng "không tương thích", không gộp vào "thiếu món".
5. Lỗi 6: không bỏ âm thầm; báo khi đầy.
6. Lỗi 7: ô chưa đối chiếu fallback tên Việt và ghi "chưa đối chiếu"; đội còn ô như vậy không báo xây ngay.
7. Lỗi 8: nhãn "Bậc cấu hình gốc: Tx · bản đã thay chưa được đánh giá"; biến thể xếp sau đội cùng bậc không bị thay.
8. Ghi chính sách đã chốt: chốt đội mùa trước, đội cũ chỉ dùng tài nguyên còn lại; không bảo đảm số đội tối đa khi trộn hai nguồn.
9. Ship website; ghi changelog.

## Nghiệm thu

- Mọi fixture ở bước 1 đạt trên website.
- Ba loại sai bằng 0 trên bộ fixture: báo "xây ngay" khi còn ô chưa đối chiếu; món bù sai luật đội; trả 0 đội mùa khi kho dựng được.
- `js/roster-season-candidates.js` và dependency nằm trong `mcp-worker/workflow-source-manifest.json` `semanticFiles` ([phase 1](phase-01-mcp-publication.md)); sửa adapter làm đổi `workflowVersion`.
- Cùng bộ fixture dùng lại cho test parity web = MCP của `tqccl_recommend_teams`.

## Ngoài phạm vi

Chấm theo ruleset mùa; giới hạn phe/truyền thừa chưa có dữ liệu (ghi rõ trong output, không đoán).
