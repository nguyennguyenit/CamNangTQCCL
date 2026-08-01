# Planning journal — R2 → Worker Static Assets

Ngày: 2026-07-31

## Outcome

Tạo deep TDD plan `260731-0237-thay-r2-bng-worker-static-assets`. Plan thay production R2 pointer/release pipeline bằng một Cloudflare Worker version chứa code + canonical manifest + sáu JSON.

## Durable decisions

- Data đổi theo mùa khoảng ba tháng; publish data độc lập không còn đáng với độ phức tạp R2.
- Giữ tám MCP tools, filesystem CLI/stdio source, manifest identities và GoClaw remote contract.
- Không thêm `seasonId`, npm publishing, CMS/storage mới hay R2 compatibility layer.
- Public asset paths luôn `404`; runtime chỉ đọc allowlisted paths qua `ASSETS`.
- Candidate gate dùng serialized `0% + Version Override` trên production route, không public preview URL.
- Rollback phải có expected-current ownership guard; không blind rollback sau concurrent deployment.

## Red-team impact

Red-team phát hiện release race, missing clean-checkout asset build, thiếu prior-version ownership, undefined version observability, weak credential retirement và unbounded body read. Plan đã thêm concurrency, small deployment controller, authenticated version header, same-SHA evidence, R2 secret revocation gate và bounded streaming.

Finding đề nghị mở rộng `workflowBuildId` sang Worker transport bị bác: repo đã định nghĩa đây là semantic identity. Deployment integrity dùng Worker version ID và release evidence riêng.

## Verification

- AgentKit structural validation: pass.
- Initial path/contract scan reported 43/43; implementation-readiness audit later superseded that conclusion.
- Whole-plan consistency sweep: 0 unresolved contradictions.
- Old MCP plan được đánh dấu blocked và phần R2 Phase 6 là superseded; Phases 1–5 giữ nguyên.

## Follow-up audit corrections

- Protected approval moved before all Cloudflare mutations; release secrets are step-scoped.
- Failed `100/0` smoke restores prior deployment only under expected-current ownership.
- Dirty-worktree gates no longer invoke clean-source builder; clean CI owns asset build + Wrangler dry-run.
- Builder rename and CI consumer update happen together; Phase 2 reorders asset build before repository dry-run.
- Replaced nonexistent root `npm test`, inverted raw `rg` gate and wrong `DataSource.loadSnapshot()` claim.
- R2 external evidence is conditional: inventory `not present`, otherwise revoke/retire with evidence.
- Revised plan validation and command existence checks pass; unresolved contradictions: 0.

## Publication

AgentWiki publishing skipped: CLI/capability không có trong session.
