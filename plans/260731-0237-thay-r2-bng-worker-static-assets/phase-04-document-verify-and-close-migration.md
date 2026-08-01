---
title: "Phase 4: Tài liệu, full verification và đóng migration"
status: in-progress
---

# Phase 4: Tài liệu, full verification và đóng migration

## Overview

- **Ưu tiên:** P1
- **Phụ thuộc:** Phase 3
- **Mục tiêu:** Đồng bộ evergreen docs, rehearsal quy trình mùa theo quý, chạy full gates và chỉ đóng plan cũ khi live evidence đạt.

## Context Links

- [Release/security research](./research/release-security.md)
- `docs/mcp-research-server.md`
- `docs/deployment-guide.md`
- `plans/260723-2055-mcp-goclaw-image-team-research/plan.md`

## Requirements

- Docs mô tả Worker Static Assets là production source; CLI/stdio vẫn filesystem.
- Mỗi mùa khoảng ba tháng là một reviewed code+data Worker deployment.
- GoClaw URL, bearer và tám tool contract không đổi; không cần npm/R2.
- Full local/repository gates xanh trước external mutation.
- Live evidence đóng override routing, performance, exact identity, edge control, conditional R2 inventory/revocation và rollback ownership.
- Live inventory 2026-08-01 xác nhận Worker chưa tồn tại; phải chốt hostname/zone và chạy first-release bootstrap để tạo prior known-good trước normal `100/0` rehearsal.
- GitHub live audit xác nhận repo private hiện chưa có `mcp-production`; production workflow phải fail closed nếu environment không có `required_reviewers`. Owner cần chọn public repo hoặc gói GitHub hỗ trợ protection phù hợp; không hạ cấp sang environment rỗng.

## File Inventory

| Action | File | Rough size | Test impact |
|---|---|---:|---|
| Modify | `/Users/plateau/Project/CamNangTQCCL/README.md` | small | Production status claim |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/mcp-research-server.md` | medium | Command/link checks |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/system-architecture.md` | medium | Architecture source |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/codebase-summary.md` | medium | Source map |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/deployment-guide.md` | medium | Runbook/rollback |
| Modify if linked by docs navigation | `/Users/plateau/Project/CamNangTQCCL/docs/deployment.md` | small | Avoid conflicting runbook |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/code-standards.md` | small | Release rules |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/project-roadmap.md` | small | Durable decision |
| Modify if present/required | `/Users/plateau/Project/CamNangTQCCL/docs/project-changelog.md` | small | User-visible architecture change |
| Modify | `/Users/plateau/Project/CamNangTQCCL/plans/260723-2055-mcp-goclaw-image-team-research/plan.md` | small | Superseded R2 gate/closure |
| Create | `/Users/plateau/Project/CamNangTQCCL/plans/260731-0237-thay-r2-bng-worker-static-assets/reports/implementation-verification.md` | report | Evidence index |

## Tests Before

1. Add/extend docs assertions that reject live R2/pointer/CAS/force-refresh commands.
2. Add runbook checks for build/upload/0%-override/promote/verify/rollback order.
3. Freeze GoClaw handoff contract and eight-tool discovery.

## Refactor

1. Update the smallest owning docs surfaces after implementation commands are real.
2. Add quarterly seasonal workflow: curated diff, review, deterministic asset build, exact-version release.
3. Run credential-free full gates; then execute authorized 0%-override/staging/live checks.
4. Record evidence, remaining account-specific limits and known-good rollback version.
5. Mark old R2 acceptance gate superseded; close both plans only when new acceptance criteria are proven.

## Tests After

- Link/command/date/claim sweep across all touched docs.
- Full MCP, Workerd, root Node/Python/Vision gates required by repository.
- Live authenticated tool discovery/calls, private asset paths, rate control and rollback rehearsal.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Full repository gate | All required suites pass |
| Critical | Override/public asset probes | Exact candidate; assets always `404` |
| Critical | Production identity/rollback | Expected IDs; known-good restoration proven |
| High | Quarterly data-only change | New Worker version; GoClaw config unchanged |
| High | Docs stale R2 command | Validation fails |
| Medium | Account limit differs | Document evidence; adjust budget without weakening correctness |

## Function / Interface Checklist

- [x] Eight tool names/schema and GoClaw handoff unchanged.
- [x] `build:worker-assets`, verifier and deploy commands match package/workflow.
- [x] Docs distinguish public liveness from authenticated readiness.
- [x] Old plan dependency/status and acceptance criteria match actual evidence.
- [x] No claim says R2 resource was deleted unless externally verified.

## Dependency Map

```text
Phases 1-3 complete
 -> evergreen docs
 -> full local/repository gates
 -> authorized override/live verification
 -> evidence report
 -> close migration
 -> unblock/complete original MCP plan
```

## Regression Gate

```bash
env PATH="/Users/plateau/.nvm/versions/node/v22.16.0/bin:$PATH" zsh -c '
  npm run build &&
  npm run test:dist &&
  npm run test:e2e &&
  npm run test:node &&
  python3 -m unittest discover -s tests &&
  (cd worker && npm test && npm run typecheck) &&
  cd mcp-worker &&
  npm run check &&
  npm run test:worker
'
git diff --check
```

Clean-checkout production workflow separately runs `build:worker-assets` before `check:repository`/Wrangler dry-run; local dirty-worktree gate above uses only scripts that actually exist and the committed Workerd fixture.

## Todo

- [x] Viết docs/runbook regression checks trước.
- [x] Đồng bộ docs và quarterly workflow.
- [x] Chạy full local/repository validation.
- [x] Triển khai và test nhánh first-release bootstrap opt-in, fail-closed; không chạy live khi chưa chốt hostname/authorization.
- [ ] Chốt production hostname/zone, chạy first-release bootstrap, rồi chạy 0%-override/live/rollback gates khi có authorization.
- [ ] Provision `mcp-production` với required reviewer trên GitHub plan/repository visibility hỗ trợ; live preflight phải pass trước Cloudflare access.
- [x] Cập nhật implementation/local verification evidence.
- [ ] Đóng cross-plan dependency sau khi có live evidence.

## Success Criteria

- [x] Docs, commands, architecture và code cùng nói một Static Assets contract.
- [x] Full gates xanh trên Node `22.16.0`.
- [ ] Live override/production/rollback hoàn tất; R2 inventory ghi `not present` hoặc revocation evidence nếu resource/key tồn tại.
- [x] Original MCP plan không còn gate R2 lỗi thời.

## Risks and Rollback

- **Risk:** Docs đi trước implementation. **Mitigation:** chỉ cập nhật sau Phase 3, verify từng claim.
- **Risk:** Live state chưa được phép thay đổi. **Mitigation:** giữ plan pending; local completion không giả mạo production completion.
- **Rollback:** Revert docs/config/code cùng Worker version; external asset/resource retirement là thao tác riêng có approval.

## Security Considerations

- Redact bearer, account/token IDs và raw logs khỏi reports.
- Kill route/rollback version khi live verification fail; không phục hồi secret cũ.
