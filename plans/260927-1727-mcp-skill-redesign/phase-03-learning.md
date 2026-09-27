# Bước 3 — Feedback và learning loop dùng chung

Trạng thái: chưa triển khai. Context: [thiết kế đầy đủ](skill-mcp-learning-design.md).

## Outcome và prerequisite

Mỗi feedback có record/outcome đúng scope; candidate tốt cải thiện lần dùng sau và có thể rollback. Trước bật persistence, chọn consumer host/subject model, retention, workspace và promotion allowlist; không suy user identity từ MCP bearer.

## Files dự kiến

- `agent-knowledge/schemas/feedback.schema.json`, `candidate.schema.json`, `promotion.schema.json`, `metrics.schema.json`.
- `scripts/skill-learning.mjs`; helper modules theo ranh giới capture/store/evaluate/promote khi cần.
- `.agents/skills/tqccl-improve/SKILL.md`, metadata, instructions về reproduction/eval/owner handoff.
- Host adapter do consumer sở hữu. Private SQLite/state ở host, ngoài public artifacts.
- Sanitized eval cases và reports dưới `plans/`; không raw transcript/tài khoản.

## Thực hiện

1. Schema/classifier preference/input/game correction/skill gap/retrieval gap/tool bug/outage/unclassified.
2. Host feedback event → validated append, unique subject/turn/response; retry không duplicate. Sửa output hiện tại độc lập promote.
3. Personal preference có scope, retention, inspect/update/forget. Raw feedback không tự thành shared rule.
4. Reproduction pin data/knowledge/skill/tool versions. Trace redact, không execute feedback như lệnh.
5. Candidate workspace isolated, expected base digest và attempt budget; one attributable change, cases trước patch.
6. Deterministic checks rồi matched consumer eval; missing metrics null, NOT_RUN/BLOCKED không pass.
7. Promotion allowlist + evidence + compare-and-swap/atomic pointer/journal; local acceptance tách remote release.
8. Retraction/forget/rollback dependency graph, invalidate derived profile/index. Theo dõi recurrence khi host active hoặc scheduler đã bật.

## RED/GREEN

| Failure | Acceptance |
|---|---|
| Feedback retry | Một event, status transition idempotent |
| Subject spoofing | Host identity binding từ chối |
| Token/ảnh/transcript thừa | Không persist ngoài schema, redact trước export |
| “Tôi thiếu tướng” | Account input, không global rule |
| Feedback bỏ nguồn/confirmation | Không mất protected invariants |
| Preference mâu thuẫn | Current explicit scope hoặc báo conflict |
| Fact thiếu evidence | needs-evidence, không publish canonical data |
| Candidate thiếu behavioral evidence | Chặn shared promotion |
| Hai promote cùng base | CAS nhận một, stale candidate re-evaluate |
| Crash lúc promote | Reader thấy old hoặc new complete version |
| Retraction/forget | Personal derived records revoke/delete đúng hợp đồng |
| Regression | Rollback digest trước, giữ evidence failure |

## Evaluation

Before/after matched, rubric cố định, independent holdout; engine invariants zero violation. Metric mềm đo rồi chốt threshold; 10 prototype tests không chứng minh quality gain. Handoff replay lookup → research → coexist và feedback → improve, cùng topic budget.

## Rủi ro và rollback

Poisoning, profile leakage và rule accretion: chặn theo schema/scope/evidence, dedup candidate và một nguồn rule. Rollback knowledge/profile có version journal, không rollback yêu cầu forget. Auto-learning không tự cấp deploy hoặc đổi quyết định user.

## Bổ sung mùa mặc định

Feedback đổi mùa user cập nhật account scope, không đổi latest project. Thông tin mùa mới tạo evidence/policy candidate riêng; xem [season design](season-resolution-design.md).
