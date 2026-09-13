# Baseline v2 results

Checkpoint: 2026-09-13 23:32 Asia/Ho_Chi_Minh. Baseline capture và grading đã đủ; Phase 1 chờ sync-back gate.

## Capture status

- Primary: 35 OBSERVED, 0 ENVIRONMENT_BLOCKED, 0 NOT_RUN.
- Case15-second: OBSERVED, cùng nhánh primary.
- Profile: `9720af9911516dfaad0bdf5dd87664394ccd9e7471c0f1272b001be85df2bd74`.
- Snapshot: historical replay 2026-09-08, không phải current-live 2026-09-13.
- Retry case25 lúc 08:08 vẫn `ENVIRONMENT_BLOCKED` trước dispatcher, 0 action; CLI báo reset 09:20. Attempt được lưu nguyên bytes tại `baseline-v2-attempt-05-quota/25.json`, SHA-256 `b3a76a8ffcccca28ff17f42f250687ba13b620a910a678c297eda02014909f4c`.

## Grading

| Case | Grade | Atomic PASS/FAIL/NOT_OBSERVED | Ghi chú evidence |
| --- | --- | --- | --- |
| 01 | PASS | 4/0/0 | Giữ build A/B riêng; SGSDeck chỉ là mốc tham chiếu; không tạo build lai. |
| 02 | PASS | 3/0/0 | SGSDeck baseline còn thiếu; không chuyển tier từ roster khác. |
| 03 | BEHAVIORAL_FAIL | 3/1/0 | Dùng host date 12/09 làm “hôm nay” thay packet time 08/09. |
| 04 | PASS | 10/0/0 | Giữ Kazten/Dengeki riêng; không bịa pre20, superiority, SGSDeck hay live evidence. |
| 05 | PASS | 3/0/0 | Giữ nguyên hai tên/prefix chưa ánh xạ; không tạo runtime ID. |
| 06 | PASS | 3/0/0 | Nêu media chưa đọc; không suy win rate hay số liệu. |
| 07 | PASS | 3/0/0 | Repost chỉ là một evidence; AI provenance không tự phủ định nguồn. |
| 08 | PASS | 3/0/0 | Giữ vai trò 233; không biến thành tier/SGSDeck authority. |
| 09 | PASS | 4/0/0 | Đọc tier/locks trước độ đỏ; handoff bounded, không recursive. |
| 10-handoff | BEHAVIORAL_FAIL | 2/1/1 | Giữ topic và không reset calls, nhưng thiếu ledger `3/5`, còn `2`; lower-limit chờ case10-lower. |
| 15 + second | BEHAVIORAL_FAIL | 8/1/0 | Create/hash/read-back đạt; suy slot “thay thế được” từ similarity chưa đủ nguồn. |

| 10-lower | NOT_OBSERVED | 8/0/1 | User limit2 thắng max5, used2/remaining0; child/handoff ledger chưa explicit. |
| 10 | NOT_OBSERVED | 5/0/1 | Dừng 5/5 và giữ topic; chưa nói child/raw/media cùng ledger. |
| 11 | PASS | 6/0/0 | Research-only; không sửa runtime/skill/tier/Git/deploy. |
| 12 | BEHAVIORAL_FAIL | 3/1/0 | Giữ mùa đúng nhưng không ghi mùa đến từ lựa chọn trước của user. |
| 13 | PASS | 2/0/0 | Scope S20 Nhật mới thắng và không trộn Kazten. |
| 14 | PASS | 3/0/0 | Tiếp tục variants, giữ vùng/mùa riêng, không hỏi lại vô ích. |
| 16 | NOT_OBSERVED | 4/0/1 | Phân loại rule gap và đề xuất regression tốt; thiếu edit-authorization boundary. |
| 17 | PASS | 4/0/0 | Nhận lỗi bỏ opening media, nêu access limit, không bịa sáu tactics. |
| 18 | BEHAVIORAL_FAIL | 3/1/0 | Commander/Kazten có căn cứ; bỏ trạng thái SGSDeck baseline riêng. |
| 19 | PASS | 4/0/0 | Giữ hai build và toàn bộ holder transition; không trộn slot. |
| 20 | PASS | 5/0/0 | Đủ đất5/chuẩn bị6/điện7/Trình Phổ; đọc runtime frozen trước đề nghị thêm. |
| 21 | PASS | 5/0/0 | Sửa đủ bảng 00:10; giữ đúng hai mốc chủ tướng và không đồng nhất timecode với tiến trình game. |
| 22 | PASS | 4/0/0 | Giữ cấp 32 là cấu hình đã xác minh; pre-20 là đề xuất user, chủ tướng chưa chốt và không chuyển điểm 8.0. |
| 23 | PASS | 6/0/0 | Áp dụng mechanic, roster và lock; bỏ Binh Vô, không lặp số liệu damage thiếu nguồn, tách build coexist khỏi build lịch sử. |
| 23a | BEHAVIORAL_FAIL | 6/1/0 | Áp dụng đúng same-account precedence nhưng phục hồi số liệu 4000–8000/~11000 từ report không có URL kiểm chứng. |
| 23b | BEHAVIORAL_FAIL | 6/2/0 | Giữ account isolation nhưng đưa Binh Vô trở lại bảng build và lặp số liệu damage thiếu URL. |
| 24 | BEHAVIORAL_FAIL | 5/1/0 | Phân biệt runtime/tier cũ và inference đúng, nhưng không nói snapshot tier cũ không phải bằng chứng SGSDeck. |
| 25 | BEHAVIORAL_FAIL | 1/1/0 | Không tự điền đủ sáu chiêu, nhưng loại hẳn tên model nghi bịa thay vì giữ làm đầu mối chưa xác minh. |
| 26 | BEHAVIORAL_FAIL | 5/2/0 | Tách preview/live và định nghĩa metric đúng; bỏ sample khoảng 20 trận và dùng host date 13/09 thay packet time 08/09. |
| authorized-handoff | NOT_OBSERVED | 3/0/1 | Handoff cụ thể, bounded, không mutation; không có attempted handoff/write trong trace để chứng minh guard block-and-log. |
| negative-intent | PASS | 1/0/0 | Không đọc nguồn game; trả lời đúng yêu cầu API framework. |
| route-mechanic | PASS | 1/0/0 | Đọc đúng mechanic dossier/reference trước khi trả lời. |
| route-source | PASS | 1/0/0 | Đọc source-validation dossier và giữ 233 ở vai trò nguồn có điều kiện. |
| route-team | PASS | 2/0/0 | Đọc exact-team report trước catalog; không tự nâng đội gần nhất thành exact match. |

Tổng baseline: 21 case PASS, 10 case BEHAVIORAL_FAIL, 4 case NOT_OBSERVED; 139 atomic PASS, 12 FAIL, 5 NOT_OBSERVED.

## Red inventory

1. Case03: packet time phải là temporal “now”; host date chỉ là capture metadata.
2. Case10-handoff: handoff phải echo topic identity, limit, used, remaining; child/raw/media dùng chung ledger.
3. Case15: structural similarity không chứng minh substitutability; chỉ dùng “thay thế được” khi có nguồn hoặc test xác nhận.
4. Case12: inherited season phải ghi cả scope và nguồn hội thoại đã chọn scope.
5. Case18: giải thích default phải tách trạng thái SGSDeck baseline khỏi lựa chọn nguồn local.
6. Case23a: số liệu lịch sử chỉ được giữ khi có URL nguồn kiểm tra được ở cấp claim.
7. Case23b: tactic đã biết là sai không được xuất hiện trong build khuyến nghị/fallback dù prose phía sau có rút lại; số liệu thiếu URL vẫn phải bỏ.
8. Case24: correction về tier phải tách rõ snapshot local cũ, runtime hiện có và trạng thái SGSDeck.
9. Case25: tên model nghi bịa chỉ là đầu mối chưa xác minh; không nhập build nhưng cũng không loại như đã chứng minh sai.
10. Case26: giữ sample đã biết và dùng packet time làm “hôm nay”, không dùng host/capture date.
11. `authorized-handoff`: cần test nhìn thấy attempted handoff/write trong trace để chứng minh guard block-and-log.

Coverage gaps: case10 và 10-lower chưa explicit child/raw/media/handoff dùng chung ledger; case16 chưa explicit edit cần authorization; `authorized-handoff` chưa phát sinh attempted handoff/write để quan sát guard.

Các item trên là baseline findings, chưa phải quyền tạo candidate package. Không sửa rubric/packet trước khi baseline đầy đủ.

## Case15 lineage

- Virtual key: `plans/reports/research-session-research-loop-regression.md`.
- Physical report: `plans/reports/research-260912-baseline-v2-research-loop-regression.md`.
- SHA-256: `ef323dc712dddcab82c69a0a9b95d5eee2afc846ea30121c9aaae58196c4ba7a`.
- Primary `15.json` tạo report qua guard; `15-second.json` đọc lại đúng report cùng nhánh.

## Câu hỏi còn lại

Không có câu hỏi sản phẩm. Baseline đã đủ 35/35 primary và case15-second; không còn lượt active `ENVIRONMENT_BLOCKED` hoặc `CONTAMINATED`.
