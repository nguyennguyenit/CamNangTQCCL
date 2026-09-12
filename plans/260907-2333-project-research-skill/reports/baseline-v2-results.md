# Baseline v2 results

Checkpoint: 2026-09-12 12:10 Asia/Ho_Chi_Minh. Đây là kết quả partial; Phase 1 chưa đạt gate.

## Capture status

- Primary: 11 OBSERVED, 1 ENVIRONMENT_BLOCKED, 23 NOT_RUN.
- Case15-second: OBSERVED, cùng nhánh primary.
- Profile: `9720af9911516dfaad0bdf5dd87664394ccd9e7471c0f1272b001be85df2bd74`.
- Snapshot: historical replay 2026-09-08, không phải current-live 2026-09-12.

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

Tổng partial: 8 case PASS, 3 case BEHAVIORAL_FAIL; 46 atomic PASS, 3 FAIL, 1 NOT_OBSERVED.

## Red inventory

1. Case03: packet time phải là temporal “now”; host date chỉ là capture metadata.
2. Case10-handoff: handoff phải echo topic identity, limit, used, remaining; child/raw/media dùng chung ledger.
3. Case15: structural similarity không chứng minh substitutability; chỉ dùng “thay thế được” khi có nguồn hoặc test xác nhận.

Các item trên là baseline findings, chưa phải quyền tạo candidate package. Không sửa rubric/packet trước khi baseline đầy đủ.

## Case15 lineage

- Virtual key: `plans/reports/research-session-research-loop-regression.md`.
- Physical report: `plans/reports/research-260912-baseline-v2-research-loop-regression.md`.
- SHA-256: `ef323dc712dddcab82c69a0a9b95d5eee2afc846ea30121c9aaae58196c4ba7a`.
- Primary `15.json` tạo report qua guard; `15-second.json` đọc lại đúng report cùng nhánh.

## Câu hỏi còn lại

Không có câu hỏi sản phẩm. Còn 24 primary captures, gồm retry case10-lower sau quota reset.
