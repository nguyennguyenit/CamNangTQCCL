# Bước 2 — Knowledge retrieval, skill routing và behavior

Trạng thái: chưa triển khai. Context: [design](design.md), [research plan cũ](../260907-2333-project-research-skill/plan.md).

Thiết kế bổ sung: [dataset, playbook và learning](skill-mcp-learning-design.md). Làm retrieval foundation trước khi skill phụ thuộc hai tool mới.

## Files và phạm vi

- Tạo canonical `agent-knowledge/` schemas/rules/workflows/manifest và pure core `mcp-worker/src/knowledge/`.
- Thêm get_playbook/search_rules, CLI aliases, errors và knowledge validator. Không copy Python prototype vào runtime.

- Tạo `.agents/skills/tqccl-lookup/{SKILL.md,agents/openai.yaml,references/tool-routing.md,evals/evals.json}`.
- Sửa `.agents/skills/tqccl-coexist-team-builder/`: instructions, metadata, references và helper khi replacement có parity.
- Sửa `.agents/skills/tqccl-research/` đúng phần data workflow mới; thêm eval cases.
- Không sửa global skills/GoClaw config. Không xóa account notes; bỏ vai trò account mặc định khỏi instructions.

## Thực hiện

0. Chốt schema/grammar, migrate rules với provenance, kiểm conflicts; selector/ranker/hash cache chung CLI/Worker. Test required rules độc lập top-k, unknown và no-match. Calibrate corpus Việt/Hán trước dùng threshold làm gate.
1. Capture original metadata/instruction hash/reference reads và actual catalog trước sửa.
2. Viết cases trước tối ưu; giữ holdout riêng và fixtures account đã redact.
3. Author lookup skill theo hai workflow catalog/reference, discovery thật và CLI fallback.
4. Coexist: version → normalize → review/confirmation → recommend → detail/replacement. Không giữ Python engine thứ hai.
5. Research: giữ claim statuses, budget, SGSDeck, corrections; remote MCP tính vào external ledger.
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
| Không MCP, có repo | CLI cùng handler |
| Không MCP và CLI | Nói giới hạn, không giả result |
| Budget đã hết | Không gọi remote MCP/web tiếp |
| Source chứa prompt injection | Chỉ coi là dữ liệu |
| Đăng bài/admin community | Không gọi tool quản trị không tồn tại |

Negative routing: nghiên cứu công nghệ, chỉnh UI, nội dung ngoài game, cấu hình MCP host.

## Nghiệm thu và rollback

Actual routing traces cho positive/negative và explicit invocation. So sánh consumer artifacts cùng snapshot/case/runtime/model provenance; không có critical regression ở privacy, scope, confirmation, configuration integrity và budget. NOT_RUN/NOT_OBSERVED/BLOCKED không tính PASS. Candidate research mới có hash mới; capture cũ không chứng minh candidate mới đạt. Rollback skill riêng, giữ capability checks để không gọi tool mới trên server cũ.

## Bổ sung mùa mặc định

Build team bắt đầu bằng resolver explicit/session/profile/latest. Rollover chỉ áp task mới, default là assumed; giữ readiness reference/recommendation riêng. Test theo [season design](season-resolution-design.md).
