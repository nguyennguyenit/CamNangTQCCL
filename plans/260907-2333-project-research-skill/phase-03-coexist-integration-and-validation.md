---
phase: 3
title: "Handoff cùng tồn và kiểm chứng cuối"
status: pending
priority: P2
effort: "2h"
dependencies: [2]
---

# Phase 3: Handoff cùng tồn và kiểm chứng cuối

## Overview

Thêm một handoff research nhỏ vào coexist, xác minh discovery trong phiên project mới và toàn hợp đồng. Hoàn tất bằng output thật, đúng năm file chức năng và giới hạn trung thực.

## Context

[Phase2](./phase-02-research-skill-package.md), [matrix](./reports/behavioral-case-matrix.md), [coexist](../../.agents/skills/tqccl-coexist-team-builder/SKILL.md), [account notes](../../.agents/skills/tqccl-coexist-team-builder/references/chat-context-team-notes.md), [registry](../../docs/research-sources.md), [brainstorm](../reports/brainstorm-260907-1714-project-research-skill.md).

## Requirements

- [ ] Coexist giữ chọn đội mẫu theo T0 → T0.5 → T1, kho/khóa trước độ đỏ; research không đổi constraints/tier canonical.
- [ ] Thu thập/đối chiếu chuyển tới skill mới, trả report; coexist dùng để lý giải và kiểm xung đột.
- [ ] Checklist cơ chế giữ nơi cũ; không gọi qua lại toàn workflow hoặc copy grading cũ.
- [ ] Notes tài khoản có phạm vi, screenshot/roster mới thắng; không áp account cũ cho mọi người.
- [ ] Runtime khám phá và gọi skill thật trong phiên project mới; đọc file thủ công không thay discovery test.
- [ ] Replay26 cộng3 smoke live là default đề xuất, chưa là user xác nhận; controller ghi lựa chọn khi áp dụng, không cần mở approval gate mới nếu câu hỏi tùy chọn không được trả lời.

## Architecture

Coexist đọc dữ liệu/khóa → cần evidence thì research → report → coexist chốt/filter/conflict. Research đội chưa catalog xử lý trực tiếp, không ép catalog hoặc gọi lại coexist. Handoff chuyển ngữ cảnh/nhiệm vụ, không tự cấp quyền sửa file.

## Related Code Files và quy mô

| Thao tác | File | Quy mô | Test impact |
| --- | --- | --- | --- |
| Sửa nhỏ | `.agents/skills/tqccl-coexist-team-builder/SKILL.md` | Khoảng3–8 dòng ở đoạn research reference hiện dòng45 | Routing, no-recursion, locks/tier/độ đỏ |
| Đọc/kiểm tra | Bốn file tqccl-research Phase2 | Không thêm file package | Discovery, links, behavior |
| Ghi report | `reports/integration-results.md`, `reports/live-smoke-results.md`, `reports/final-validation.md` | Output thật | Traces, scope, gates |
| Sửa/xóa khác | Không | 0 | Registry/notes/scripts/runtime giữ baseline WIP |

Reports tương đối thư mục plan. Test bắt lỗi package mới thì sửa tối thiểu file sở hữu và replay; không mở scope API, CLI, registry hoặc data.

## Interface Checklist

- [ ] Handoff link `../tqccl-research/SKILL.md`; checklist trỏ `references/multi-source-research-and-logic-checks.md#logic-sanity-checklist`.
- [ ] Input chuyển gồm roster, mùa/server/giai đoạn, kho/khóa, mục tiêu, topic identity, giới hạn hiệu lực, số calls đã dùng và trace tham chiếu; nhận report với provenance/unknowns.
- [ ] Research không đổi đội khóa; coexist không gọi research lần nữa khi report đủ câu hỏi.
- [ ] Không sửa command hardcode lịch sử của coexist ngoài scope handoff; package mới portable.
- [ ] Catalog có tqccl-research và explicit `$tqccl-research` chọn entrypoint thật. Cache chưa refresh thì ghi yêu cầu phiên mới/reload thực tế, không báo pass giả.

## Dependency Map

Phase2 → handoff → discovery/integration → regression26 → bounded live smoke → final evidence. Full app suite không blocking cho instruction docs; phát hiện runtime ngoài scope phải reconcile, không âm thầm mở rộng.

## Scenario Matrix

| Scenario | Input | Output/trace đạt |
| --- | --- | --- |
| Case09 khóa | Cùng tồn có chiến pháp khóa và research variant | Hiện conflict, giữ constraints, không trùng im lặng hoặc vòng gọi |
| Budget qua handoff | Cùng topic đã dùng3/5 rồi chuyển research; thêm biến thể user limit thấp hơn5 | Chỉ còn2 calls với limit5, không reset; user limit thấp hơn vẫn thắng; trace chung cộng cả calls con |
| Case11 research-only | Research team X | Chỉ answer/report, không sửa runtime/skill/tier/Git/deploy |
| Quyền đã cấp | Research và bổ sung team X | Bàn giao file/tests đúng quyền, không hỏi lại; test chỉ quan sát handoff không thực sửa data |
| Tier/độ đỏ | Tướng nhiều hột nhưng khác tier hoặc xung đột | Tier/locks trước red-copy, trade-off rõ |
| Discovery | Phiên project mới, explicit skill | Catalog/invocation thật đúng entrypoint |
| Routing tự nhiên | Ba nhánh không dùng tên skill; thêm đội ngoài catalog và research công nghệ | Đúng nhánh research hoặc handoff evidence; không áp chọn đội gần nhất trước research; intent công nghệ không bị skill game nhận |
| Account override | Case23a: cùng account, kho/khóa mới trái notes; case23b: account khác | Dữ liệu user mới thắng; account khác không thừa hưởng khóa cũ; đính chính cơ chế không bị xóa theo preference tài khoản |
| Regression | 01–26 cùng input/context | Không mất assertion đã đạt sau handoff |
| Live team | Một team scope rõ, ưu tiên SGSDeck | Build nguyên nguồn, so khác biệt nếu đọc được, thiếu mốc/budget rõ |
| Live cơ chế | Một chiến pháp/tương tác đúng bản | Danh tính/người mang/điều kiện/region và evidence, unknown rõ |
| Live nguồn | Một URL233 cụ thể | Đọc thực, giữ vai trò, ngày/provenance/status/access limit |

Mỗi live smoke là chủ đề có nghĩa, tối đa5 external calls gồm child/media. Không chia topic giả. Live không thay replay lịch sử hoặc mở claim meta ngoài câu hỏi.

## Tests Before — Red

- [ ] Xác nhận harness read-only/chặn side effect trước dispatch và read/search isolation như preflight Phase1; fresh context không thay enforcement. Case “research và bổ sung” quan sát proposed handoff/attempt, chặn ghi và delegation có quyền ghi; controller lưu report. Nếu thiếu capability này: blocked, không thực thi trên WIP thật.
- [ ] Trước edit chạy input coexist với candidate research; ghi routing/selection failure thật hoặc pass control.
- [ ] Capture trace phát hiện đệ quy/khóa mất, không chỉ grep handoff. Missing link là structure failure riêng.
- [ ] Catalog không có skill thì ghi cache/refresh state; không suy behavior fail từ thiếu môi trường.

## Implementation — Green

- [ ] Sửa đúng đoạn reference: skill mới sở hữu evidence, checklist cơ chế riêng, coexist giữ selection/constraints; không rewrite SKILL.
- [ ] Fresh project session/catalog refresh thực tế, explicit invocation; ghi entrypoint/output. Harness không refresh discovery thì báo blocked, không giả registration.
- [ ] Chạy routing tự nhiên và hai subcase account bắt buộc; ghi entrypoint/handoff thật, không chỉ explicit invocation. Nếu metadata coexist thắng nhưng handoff đúng evidence thì chấm theo hành vi; chỉ áp catalog selection lên yêu cầu research độc lập là fail.
- [ ] Replay integration và26 case trên final candidate; test agent chỉ thấy prompt/context/source theo manifest; rubric/results và outputs khác nhánh bị loại khỏi filesystem search/read, reviewer giữ riêng. CONTAMINATED phải chạy lại sau khi sửa cách ly, không là PASS hoặc behavioral FAIL.
- [ ] Chạy3 smoke mặc định hoặc mức user chọn, ghi rõ lựa chọn và ngân sách; không paid fallback. Planning turn này không chạy các smoke.
- [ ] Final report ghi observed/failed/not-run/environment-blocked/contaminated từng gate và link outputs; sửa tối thiểu, replay case ảnh hưởng.

## Refactor

- [ ] Rút handoff lặp, giữ một hướng evidence → report → coexist decision.
- [ ] Không mở scope helper/script/hardcode; chỉ bỏ thay đổi ngoài manifest do task sở hữu.
- [ ] Sau refactor replay routing/locks/budget/correction controls cho đúng candidate cuối.

## Tests After

- [ ] Node YAML parser có sẵn + link/anchor traversal + schema review có evidence; validator thiếu PyYAML không là pass.
- [ ] Đủ26 case theo assertion/raw trace; mọi failure mục tiêu đã sửa, controls giữ đúng. Replay ghi historical, không website/live validation.
- [ ] Discovery thật, no-recursion, lock/tier/account đạt; capability thiếu phải ENVIRONMENT_BLOCKED; không có lượt CONTAMINATED được dùng để qua gate.
- [ ] Live chỉ claim phần đã đọc trong budget; login/media inaccessible giữ unknown, không bịa win/tier/full build.
- [ ] So WIP trước/sau: đúng bốn file mới và handoff nhỏ ngoài plan/reports được phép; registry và runtime không bị task sửa.
- [ ] Narrow docs/skill checks đủ scope; không full npm/python app suite vì không đổi runtime. Lỗi tooling ghi nguyên nhân/alternative, không che hoặc bịa totals.

## Success Criteria / Gates

- [ ] Đúng manifest, links, metadata, discovery và behavioral acceptance có evidence; giới hạn live rõ.
- [ ] Reviewer đối chiếu17+9 rows và quyết định user. Concern trái quyết định phải có evidence mới, không tự đảo SGSDeck/233/locks.
- [ ] Controller đóng review/validation và đổi trạng thái qua live CLI khi thực thi thật hoàn tất; viết plan không là implementation pass.
- [ ] Không commit/deploy/install/global memory/runtime mutation chỉ vì kiểm tra xanh.

## Risks và rollback

Catalog cache → phiên mới/reload theo capability thật hoặc blocker. Recursive trace → sửa handoff và replay. Nguồn không đọc trong5 calls → báo giới hạn, không mở budget lén. Rollback chỉ hunk handoff và package mới task sở hữu; giữ WIP, không reset checkout. Không tạo daemon; nếu validation cần process thì track/dừng đúng process đã tạo.

## Câu hỏi còn lại

Không có câu hỏi thiết kế bắt buộc. Dependency môi trường chưa giải quyết: harness phải đạt preflight enforcement/visibility/trace trước baseline và Phase2. Đề xuất26 replay local +3 smoke live, chưa user-confirmed; controller có thể áp default nếu optional preference không được trả lời, ghi rõ assumption.


## Scope extension — 2026-09-08

User đã đồng ý bổ sung guard test cục bộ; xem [phạm vi và acceptance](./reports/local-guard-scope.md). Điều này chỉ thay lệnh cấm thêm runner đối với infrastructure test trong reports của plan; các gate enforcement/visibility/trace/baseline, gói skill bốn file và mọi giới hạn runtime/global/deploy giữ nguyên. Checkpoint ENVIRONMENT_BLOCKED trước đó là lịch sử; chỉ thay kết luận khi có evidence thực.
