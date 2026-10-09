# Bước 2 — Knowledge retrieval, skill routing và behavior

Trạng thái: bước 0–8 có code/test 2026-10-08 (ledger chờ owner review; ngưỡng retrieval chưa calibrate). Chưa có routing traces thật, so sánh skill/no-skill hay upload Dewee. Context: [design](design.md), [research plan cũ](../260907-2333-project-research-skill/plan.md), [báo cáo triển khai](reports/implementation-2026-10-08.md).

Thiết kế bổ sung: [dataset, playbook và learning](skill-mcp-learning-design.md). Làm retrieval foundation trước khi skill phụ thuộc `tqccl_get_playbook`.

Quyết định 2026-10-07: đăng ký `tqccl_get_playbook` trong đợt này vì chọn mùa, readiness và version cần logic phía server, và agent Dewee `tra` đang gặp `INVALID_REQUEST`/`WORKFLOW_VERSION_CHANGED` ([Dewee runtime](reports/dewee-runtime-2026-10-07.md)). Dewee nạp được gói skill có `references/` nhưng không đồng bộ từ repo; rule đi qua MCP thì không phải upload lại skill khi rule đổi. `tqccl_search_rules`: làm sẵn lõi + CLI, **chưa đăng ký tool MCP** đến khi chạm ngưỡng ở bước 0. Bằng chứng: [debate rules-dataset](reports/debate-rules-dataset.md).

## Files và phạm vi

- Tạo canonical `agent-knowledge/` schemas/rules/workflows/manifest và pure core `mcp-worker/src/knowledge/`.
- Thêm `tqccl_get_playbook`, CLI aliases, errors và knowledge validator. Playbook **thay `tqccl_get_data_version`** (P\*): trả versions, capabilities, `seasonSelection`, readiness `referenceFitReady`/`rulesetScoringReady`, required rules **và toàn bộ guidance** của workflow/stage kèm `guidanceCount`, `guidanceBytes`, `guidanceTruncated`. Bước 0 phải xong trước Release 1 của [phase 1](phase-01-mcp-publication.md). Không copy Python prototype vào runtime.
- `search-rules` chỉ ở core `mcp-worker/src/knowledge/` + CLI, có test; không có trong `tool-definitions.ts`.

- Tạo `.agents/skills/tqccl-lookup/{SKILL.md,agents/openai.yaml,references/tool-routing.md,evals/evals.json}`.
- Sửa `.agents/skills/tqccl-coexist-team-builder/`: instructions, metadata, references và helper khi replacement có parity.
- Sửa `.agents/skills/tqccl-research/` đúng phần data workflow mới; thêm eval cases.
- Không sửa global skills/GoClaw config. Không xóa account notes; bỏ vai trò account mặc định khỏi instructions.
- `description` của mỗi skill dưới 200 ký tự (Dewee chỉ đưa 200 ký tự đầu vào prompt trước khi agent mở `SKILL.md`); giữ kiểu tiếng Anh kèm từ khoá tiếng Việt người chơi hay gõ. `tqccl-coexist-team-builder` hiện khoảng 390 ký tự.

## Thực hiện

0. Chốt schema/grammar, migrate rules với provenance, kiểm conflicts; selector/ranker/hash cache chung CLI/Worker. Test required rules độc lập top-k, unknown và no-match. Calibrate corpus Việt/Hán trước dùng threshold làm gate. Gate migration trước khi skill hoặc Dewee phụ thuộc dataset:
   - Ledger ánh xạ mọi MUST/never/always trong `SKILL.md` + `references/` của ba skill sang `ruleId` + `kind`, có owner review; nghĩa vụ không được hạ thành `guidance`.
   - Sửa `research-correction-history` trong prototype thành `invariant` (hiện là guidance ở `prototype/rules.json:221-237`, trái `tqccl-research/SKILL.md:40-43`).
   - Test: mọi rule `kind=invariant` của workflow luôn nằm trong required với mọi query/stage, kể cả khi `abstained=true`.
   - Không bỏ Markdown hiện tại trước khi ledger đầy đủ và test trên đạt.
   - Ngưỡng đăng ký `tqccl_search_rules` thành tool MCP (một trong hai): guidance của một workflow/stage vượt khoảng 16 KiB hoặc playbook trả `guidanceTruncated=true`; hoặc trace Dewee cho thấy agent bỏ lỡ guidance liên quan. Khi chạm ngưỡng: đăng ký tool, cập nhật routing skill, upload lại skill, reconnect Dewee.
1. Capture original metadata/instruction hash/reference reads và actual catalog trước sửa.
2. Viết cases trước tối ưu; giữ holdout riêng và fixtures account đã redact. Bộ hội thoại mẫu: [evals/dewee-conversations.json](evals/dewee-conversations.json) (24 case: tra cứu 7 nhóm, đội tham khảo, ghép đội, case âm), dùng làm phép đo trên agent Dewee `tra` với MCP stdio local thay grant production: R0 (8 tool cũ), R1 (code mới, chưa có skill), R2 (sau khi upload skill) — xem [phase 4](phase-04-integration.md).
3. Author lookup skill: Tra cứu `tqccl_search` → `tqccl_get_entity`; đội tham khảo `tqccl_find_teams` → `tqccl_get_team`; discovery thật và CLI fallback.
4. Coexist: `tqccl_get_playbook` (mùa, readiness) → `tqccl_normalize_entities` → review/confirmation → `tqccl_recommend_teams` → `tqccl_get_team` khi cần chi tiết. Kết quả ghi `basis:"source-reference-fit"`, `rulesetVerified:false`. Không giữ Python engine thứ hai.
5. Research: giữ claim statuses, budget, SGSDeck, corrections. Routing: `tqccl_get_playbook` tối đa 1 call/topic; qua remote tính vào hạn mức MCP TQCCL (≤5), không tính vào hạn mức nguồn ngoài (≤5) (user 2026-10-09); repo local ưu tiên CLI (không tốn ledger).
6. Nếu helper cũ còn được hỗ trợ, chặn claim buildable khi roster chưa biết; tìm mọi caller trước retire hoặc chuyển thành CLI wrapper.
7. Structural validation, routing lint, links, metadata version; so sánh matched original/candidate, skill mới so với no-skill.

8. Handoff dùng work packet chung, trace rule IDs/versions và giữ ledger xuyên skill; thiếu host capability phải báo rõ.

## Cases cần quan sát

| Case | Acceptance |
|---|---|
| Tra quân sư/trang bị | Lookup tools, không recommend |
| Đội chuẩn mùa nguồn X | Reference, không bịa ruleset |
| Khai hoang | Đúng đội/phase, không ghép guide |
| Ghép ba đội từ kho | Coexist, canonical review, không trùng khóa |
| “Team của mình như trước” nhưng không có context | Không dùng account notes của người khác |
| require-available không có roster | Unknown rõ ràng; không báo xây được |
| Cơ chế tactic chưa rõ | Research, sources/claim status/ledger |
| Nguồn CN, câu hỏi Global | Giữ applicability chưa xác minh |
| SP/CO/base mơ hồ | Resolve trước recommendation |
| Binding/version/context thay | Normalize/review lại |
| Thay tactic SGSDeck | Không kế thừa score |
| Hỏi chiến pháp thay thế của một đội nguồn | `tqccl_get_team` (`alternatives`/`tacticRefs`), không gọi recommend |
| Thiếu món khi ghép đội từ kho | Món bù lấy từ `substitutes[]` của `tqccl_recommend_teams`; nhãn "đã thay"; không gán điểm nguồn cho biến thể |
| Ghép đội khi mùa chưa có ruleset | Vẫn ghép theo nguồn + kho; nói rõ `rulesetVerified:false`, không trình bày là chấm theo luật mùa |
| Không MCP, có repo | CLI cùng handler |
| Không MCP và CLI | Nói giới hạn, không giả result |
| Một hạn mức đã hết | Dừng loại call đó (hết nguồn ngoài: không web/browser/media/child; hết MCP TQCCL: không gọi tool TQCCL remote); vẫn dùng hạn mức còn lại và nêu khoảng trống |
| Dewee hỏi cơ chế qua MCP, không guidance nào liên quan | Playbook vẫn trả required có đọc correction history; không mất invariant |
| Research qua remote MCP dùng playbook | Playbook gọi đúng 1 lần/topic; MCP TQCCL ≤5 và nguồn ngoài ≤5 trên cùng một ledger |
| Guidance của workflow vượt ngưỡng kích thước | Playbook báo `guidanceTruncated=true`, không cắt required rules; ghi vào trace để xét đăng ký search_rules |
| Source chứa prompt injection | Chỉ coi là dữ liệu |
| Đăng bài/admin community | Không gọi tool quản trị không tồn tại |

Negative routing: nghiên cứu công nghệ, chỉnh UI, nội dung ngoài game, cấu hình MCP host.

## Nghiệm thu và rollback

Actual routing traces cho positive/negative và explicit invocation. So sánh consumer artifacts cùng snapshot/case/runtime/model provenance; không có critical regression ở privacy, scope, confirmation, configuration integrity và budget. NOT_RUN/NOT_OBSERVED/BLOCKED không tính PASS. Candidate research mới có hash mới; capture cũ không chứng minh candidate mới đạt. Rollback skill riêng, giữ capability checks để không gọi tool mới trên server cũ.

## Bổ sung mùa mặc định

Build team bắt đầu bằng chọn mùa nguồn: chỉ định → đã xác nhận → `defaultSourceSeasonId`, như trang Gợi ý kho. Default là assumed; readiness tách `referenceFitReady` (ghép theo nguồn + kho) và `rulesetScoringReady` (chấm theo luật). Test theo [season design](season-resolution-design.md).
