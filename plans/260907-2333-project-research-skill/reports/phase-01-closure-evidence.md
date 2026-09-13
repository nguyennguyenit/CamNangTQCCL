# Phase 1 closure evidence

Ngày: 2026-09-13, Asia/Ho_Chi_Minh.

## Baseline contract

- Packet/rubric khóa tại `behavioral-case-matrix.md` và `input-packet-manifest.json`.
- Capture: 35/35 primary và `15-second` đều `OBSERVED`, `structured-output-v2`, profile `9720af9911516dfaad0bdf5dd87664394ccd9e7471c0f1272b001be85df2bd74`.
- Parity: 220 primary action khớp 220 primary trace; `15-second` thêm 2 action khớp 2 trace. Tổng 222/222.
- Grading: 139 PASS, 12 BEHAVIORAL_FAIL, 5 NOT_OBSERVED. Chi tiết case-level ở `baseline-v2-results.md`; mapping assertion-level ở `baseline-v2-assertion-evidence.json`.
- Các quota artifact là lịch sử attempt đã archive; active baseline không còn `ENVIRONMENT_BLOCKED` hoặc `CONTAMINATED`.

## WIP và inventory

Snapshot trước baseline v2 được lấy từ controller tool output lúc 2026-09-12 01:50:40 +07:00, lưu trong session log local:

`/Users/plateau/.codex/sessions/2026/09/12/rollout-2026-09-12T01-49-53-01a091ce-06f0-7ae2-854d-7a131514cf53.jsonl`, record timestamp `2026-09-11T18:50:40.287Z`.

Snapshot ghi branch `main...origin/main` đã dirty trước test. Các tracked WIP ngoài task gồm `.gitignore`, `.node-version`, README/deployment docs, package files, generated workflow build, `src/lib/root-static-artifacts.ts`, `tests-js/astro-dist-contract.test.mjs`; các catalog/season/Node plans, SGSDeck pipeline/docs/tests và nhiều report là untracked. Plan research cùng harness/packets/attempt artifacts cũng đã có trong inventory trước baseline v2.

Post-run snapshot lúc 2026-09-13 23:43:56 +07:00 vẫn dirty. WIP ngoài task hiện gồm tactic data/override/test, unified-lookup plan, recommended-season-browser plan và brainstorm report. Controller không stage, commit, reset, deploy hoặc sửa các path đó. Thay đổi Phase 1 giới hạn trong plan/reports/harness của plan và report persistence được allowlist tại `plans/reports/research-260912-baseline-v2-research-loop-regression.md`.

## Failure disposition

| Nhóm | Case/assertion | Disposition |
| --- | --- | --- |
| Thiếu instruction | 03, 10-handoff, 12, 18, 23a, 23b, 24, 25, 26 | Candidate phải làm rõ packet-time, ledger, season provenance, SGSDeck, URL claim, tactic invalid, tier provenance, đầu mối chưa xác minh và sample. Đây là cause hypothesis từ output, chưa phải chứng minh nội tại của model. |
| Bỏ sót thực thi/quan sát | 10, 10-lower, 16, `authorized-handoff` | Output không nói đủ ledger/edit authority hoặc không phát sinh attempted handoff/write. Giữ NOT_OBSERVED khi trace không có event. |
| Bằng chứng không đủ | 15, 23a, 23b, 25 | Similarity, report thiếu URL hoặc tên nghi bịa không đủ để kết luận substitutability, số liệu hoặc loại bỏ claim. |
| Ngữ cảnh tài khoản/hội thoại | 12, 23a, 23b | Candidate phải giữ provenance mùa và precedence same-account/different-account; baseline đã giữ phần lớn nhưng còn omission/claim lỗi. |

Mapping JSON sở hữu disposition từng FAIL/gap; bảng này chỉ là summary, không thay rubric.

## Live smoke đã chọn

Controller áp dụng default đã ghi trong plan; đây là lựa chọn execution, không phải user-confirmed product preference.

| Nhánh | Topic khóa | Giới hạn |
| --- | --- | --- |
| Build team | Chu Thái – Trương Phi – Trương Xuân Hoa, Binh Diễn Xuân Thu Global; đối chiếu SGSDeck trước khi so biến thể | Tối đa 5 external calls cho toàn topic, gồm child/raw/media/handoff |
| Chiến pháp/cơ chế | Kiểm tra vì sao Binh Vô Thường Thế không hợp SP Quách Gia và giữ mechanic correction | Tối đa 5 external calls cho toàn topic |
| Xác minh nguồn | Xác minh vai trò/provenance một bài 233乐园, gồm AI/repost, khu vực và giới hạn độc lập | Tối đa 5 external calls cho toàn topic |

Calls local không tính budget. User limit thấp hơn thắng; không reset hoặc chia topic giả. Live smoke chỉ chạy sau candidate và luôn tách khỏi historical replay.

## Scope comparison

- Package `.agents/skills/tqccl-research/` chưa tồn tại ở Phase 1.
- `.agents/skills/tqccl-coexist-team-builder/SKILL.md` chưa được Phase 1 sửa.
- Runtime, app data, package/dependency, global skill/memory, Git và deploy ngoài scope.
- Preflight v2 hiện hành được trỏ từ `harness-preflight.md`; checkpoint cũ giữ làm lịch sử.

## Câu hỏi chưa giải quyết

Không có.
