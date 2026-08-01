# Plan validation

Ngày: 2026-07-31  
Tier: Standard — Fact Checker + Contract Verifier

## Decision interview

Các câu hỏi đã được trả lời trong chuỗi trao đổi dẫn tới plan:

1. **Storage production:** Worker Static Assets (chọn) | R2 | hybrid.
2. **Release boundary:** atomic code+data Worker version (chọn) | data publish độc lập.
3. **Cadence:** theo mùa khoảng ba tháng (chọn) | hàng tháng | ad hoc.
4. **Compatibility:** xóa R2 dead code sau replacement gates (chọn) | giữ dormant adapter.
5. **Distribution:** remote MCP, package private, không npm publish (chọn) | publish npm.

Không có câu trả lời nào bị red-team đảo ngược.

## Verification Results

> Session 1 bị supersede bởi implementation-readiness audit Session 2. Structural/path verification không chứng minh command ordering hoặc release mutation safety.

- Claims checked: 43.
- Verified: 43.
- Failed: 0.
- Unverified product decisions: 0.
- Empirical gates: 4, được ghi rõ trong `plan.md`; không được tính là implementation-ready evidence.

### Fact Checker

- 40 path/config/test claims được đối chiếu; tất cả source targets hiện hữu.
- Ba planned-create targets (`static-assets-data-source.ts`, `worker-release-evidence.ts`, evidence report) được ghi đúng action `Create`, không bị mô tả như code hiện hữu.
- Node pin `22.16.0`, branch `main`, package `private` và eight-tool contract khớp repository evidence.

### Contract Verifier

- `forceRefresh` consumers được enumerate: `data-source.ts`, `research-handlers.ts`, `worker.ts`, `data-sources.test.ts`, `publish-data-release.test.ts`, `verify-release.test.ts`; plan đã phân phase sửa/xóa.
- R2 release consumers gồm Worker datasource/bindings, four release scripts, promotion receipt, release tests, Workerd fixtures, control-plane config/workflow và AWS SDK; inventory bao phủ.
- Existing deployment state reader/exclusive deploy được giữ và refactor, không xóa mù.
- Evergreen docs có R2 claims gồm root README và sáu owning docs surfaces; Phase 4 inventory bao phủ.

## Live-only evidence

- Version Override và authenticated version header trên production route.
- Cloudflare account CPU/memory budget với corpus thật.
- Protected environment/token scope và edge rule state.
- Ownership-safe rollback và conditional R2 inventory/revocation.

Các mục này là acceptance gates, không phải unresolved design questions.

## Whole-Plan Consistency Sweep

- Files reread: `plan.md`, bốn phase files, ba research reports, red-team report.
- Decision deltas: R2→Static Assets; preview→0%-override; blind rollback→ownership guard; weak credential cleanup→denylist+revoke; buffer→bounded stream.
- Stale active-plan references reconciled: 11.
- Unresolved contradictions: 0.

## Session 2 — Implementation-readiness corrections

- Audit findings: 8.
- Applied: 8.
- Rejected: 0.
- Structural validation: PASS after edits.
- Existing command check: root `build/test:dist/test:e2e/test:node`, Vision Worker `test/typecheck`, MCP `check/test:worker/check:repository` all exist.

### Corrections

1. Protected approval moved before every upload/deployment mutation.
2. Failed `100/0` smoke restores prior exclusive deployment under ownership guard.
3. Dirty-worktree Phase 1 no longer invokes clean-source CLI build.
4. Phase 1 updates CI consumer together with builder command rename.
5. Phase 4 uses existing root scripts; removed nonexistent `npm test`.
6. Raw inverted `rg` gate replaced by scoped repository/import-boundary tests.
7. Interface checklist corrected to `DataSource.load()`.
8. R2 evidence is conditional: `not present` inventory or revocation when present.

### Whole-Plan Consistency Sweep

- Decision deltas checked: approval ordering, smoke cleanup, clean/dirty build boundary, script rename ownership, command existence, residue semantics, interface name, conditional external state.
- Unresolved questions: None.
- Unresolved contradictions: 0.
