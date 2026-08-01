# Red-team adjudication

Ngày: 2026-07-31

Ba lens được áp dụng: security/fact checking, failure-mode/contract verification và scope/assumption audit. Hai reviewer độc lập chạy trực tiếp; controller thực hiện lens thứ ba do runtime đạt thread limit.

| # | Finding | Severity | Disposition | Applied |
|---|---|---|---|---|
| 1 | Mất serialization khi bỏ activation lock | Critical | Accept | Phase 3 concurrency + expected-current controller |
| 2 | Clean checkout thiếu `.worker-assets` trước Workerd/dry-run | Critical | Accept | Phases 2–3 build ordering |
| 3 | Không có durable prior-version/rollback ownership | Critical | Accept | Phase 3 retained deployment controller |
| 4 | Exact Worker version chưa có observable contract | High | Accept | Authenticated fixed response header |
| 5 | Public preview bypass zone rate control | High | Accept | Dùng 0% + Version Override; preview disabled |
| 6 | Same-SHA claim chưa bind qua evidence | High | Accept | Phase 1 validated evidence schema |
| 7 | Xóa R2 secret denylist làm yếu gate | High | Accept | Giữ denylist + external revocation evidence |
| 8 | `workflowBuildId` không cover transport | High | Reject as stated | Semantic identity giữ nguyên; Worker version + release evidence cover deployment |
| 9 | Oversize check có thể xảy ra sau allocation | Medium | Accept | Bounded streaming/cancel contract |

## Evidence highlights

- Workflow hiện chưa có concurrency: `.github/workflows/mcp-worker.yml:41`.
- Existing activation serialization/state checks: `mcp-worker/scripts/publish-data-release.ts:192-225`.
- Existing deployment state reader/exclusive deploy: `mcp-worker/scripts/cloudflare-deployment-client.ts:124-174`.
- Verifier hiện chưa nhận Worker version: `mcp-worker/scripts/verify-release.ts:23-31`.
- Public health không có version identity: `mcp-worker/src/worker.ts:229-239`.
- R2 credential denylist hiện hữu: `mcp-worker/scripts/check-repository.ts:77-99`.
- Semantic workflow closure được khai báo riêng: `mcp-worker/workflow-source-manifest.json:3-37`.
- Size validation hiện chạy sau khi bytes tồn tại: `mcp-worker/src/data/artifact-contracts.ts:499-517`.

## Whole-Plan Consistency Sweep

- Files reread: `plan.md`, bốn phase files, ba research reports.
- Decision deltas checked: 8.
- Reconciled stale public-preview, blind-rollback, no-concurrency and weak-secret claims.
- `workflowBuildId` remains semantic; exact Worker identity is separate.
- Unresolved contradictions: 0.

