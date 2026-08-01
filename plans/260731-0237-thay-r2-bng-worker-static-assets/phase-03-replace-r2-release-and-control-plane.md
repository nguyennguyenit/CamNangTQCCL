---
title: "Phase 3: Thay R2 release và control plane"
status: completed
---

# Phase 3: Thay R2 release và control plane

## Overview

- **Ưu tiên:** P1
- **Phụ thuộc:** Phase 2 full gate
- **Mục tiêu:** Chuyển CI/release sang exact Worker version, giữ security gates không phụ thuộc R2, rồi xóa dead R2 code.
- **Release contract:** Manual exact-SHA approval → exact-SHA build/gates → upload candidate → add candidate at 0% → authenticated version-override verification → single-version 100% promotion → production verification → ownership-safe restore/rollback.

## Context Links

- [Release/security research](./research/release-security.md)
- [Cloudflare Versions](https://developers.cloudflare.com/workers/versions-and-deployments/)
- [Cloudflare Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

## Requirements

- Asset build, dry-run, upload và evidence dùng cùng exact commit SHA.
- Candidate verification assert expected Worker version, `releaseId` và `workflowBuildId`.
- Không có nonzero traffic split giữa hai workflow versions; temporary deployment duy nhất được phép là prior `100%` + candidate `0%` trong smoke gate.
- Manual dispatch phải có SHA đủ 40 ký tự khớp `HEAD`, `GITHUB_SHA` và current `origin/main`, cùng xác nhận production, trước mọi Cloudflare access.
- Nếu override/smoke fail, controller phục hồi prior single-version deployment dưới expected-current guard; drift thì mở incident, không overwrite.
- Production workflow dùng một concurrency group, `cancel-in-progress: false`; controller re-read current deployment before mutation.
- Rollback chỉ được phép nếu production vẫn là candidate version do chính run đó vừa promote.
- Giữ bearer rotation, MCP verifier, edge rate-limit and repository gate.
- Không AWS/R2 credentials, npm publish, pointer/CAS/lock/receipt hoặc dormant R2 compatibility.

## File Inventory

| Action | File/group | Rough size | Test impact |
|---|---|---:|---|
| Modify | `/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-worker.yml` | medium | Same-SHA asset/upload gate |
| Rename/modify | `/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-r2-lock-monitor.yml` → `mcp-edge-security-monitor.yml` | medium | Edge-only monitor |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/verify-release.ts` | 400 LOC | Remove force-refresh; assert identities |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/verify-control-plane.ts` | 300 LOC | Edge control only |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/check-repository.ts` | 200 LOC | Remove R2 consumers; retain forbidden secret names |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/infra/control-plane-requirements.json` | small | Keep `edge-mcp-rate-limit` only |
| Retain/refactor | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/cloudflare-deployment-client.ts` | 180 LOC | Expected-current promote/rollback |
| Delete | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/{stage-data-release,activate-data-release,publish-data-release,r2-release-store}.ts` | large | Delete R2 release tests |
| Delete | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/r2-data-source.ts` | 200 LOC | R2 tests replaced in Phase 2 |
| Delete | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/release/promotion-receipt.ts` | 220 LOC | Delete receipt test |
| Delete | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/fixtures/{seed-r2,seed-production-r2}.workerd.ts` | small | Static fixtures already own tests |
| Delete | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/release/{stage-data-release,activate-data-release,publish-data-release,r2-release-store,promotion-receipt}.test.ts` | large | Superseded |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/release/{verify-release,repository-gate}.test.ts` | medium | New invariants |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/security/control-plane-requirements.test.ts` | existing | One external control |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package.json` and `package-lock.json` | generated | Remove AWS SDK/R2 scripts |

## Tests Before

1. Add failing workflow/static assertions: same checkout, exact asset inventory, no R2/npm secrets or commands.
2. Add verifier tests for authenticated expected-version header, release/workflow identities and public asset `404`.
3. Add workflow tests proving production job only runs on confirmed manual dispatch of exact current `main` SHA and keeps secrets step-scoped.
4. Add deployment-state tests for 100/0 candidate override, failed-smoke restoration, one version at `100%`, drift and concurrent runs.
5. Add rollback contract capturing prior deployment immediately before mutation and rejecting stale ownership.

## Refactor

1. Keep PR/push jobs credential-free. Add a separate production job guarded by manual dispatch on `main`, explicit production confirmation, exact current-main SHA checks and job-level production concurrency (`cancel-in-progress: false`).
2. After manual exact-SHA approval, build assets, validate evidence, run Workerd/coverage/type/build and Wrangler dry-run before upload; do not map release secrets into these gate steps, and never rely on an ignored pre-existing directory or artifact filename.
3. Serialize production with a small deployment controller that performs expected-current read/compare/test-deploy/promote/restore/rollback.
4. Capture prior exclusive deployment immediately before mutation; upload candidate, create prior `100%` + candidate `0%`, call production route with Version Override, and require authenticated runtime version header equality.
5. On override failure, restore prior exclusive deployment only if current state still equals this run's test deployment; otherwise open incident without mutation.
6. Keep an audit evidence artifact bound to commit/tree/asset/version/release/workflow/prior/test/final deployment; do not reintroduce an R2 promotion receipt subsystem.
7. Slim control-plane requirements/verifier/monitor to the edge rate rule.
8. Remove R2 credential use; inventory external keys and revoke only those that exist, while retaining old R2 variable names in repository/environment denylist.
9. Remove force-refresh, AWS SDK, R2 scripts/source/fixtures/tests only after replacement tests pass.
10. Map each secret only on the step that consumes it: deploy token for Cloudflare mutation, bearer for authenticated verifier, read token for control-plane evidence. Không đặt release secrets ở job-level environment.

## Tests After

- Secret/repository scan proves no R2 credential or npm publish path remains.
- Candidate smoke failure leaves normal traffic on prior version and restores the prior single-version deployment when ownership still matches.
- Post-promotion failure rolls back only when current state still equals this run's candidate; drift opens an incident instead of overwriting another release.
- If old Worker/R2 resources exist, they are not retired until inventory and rollback rehearsal prove they are no longer needed.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | 0%-override verifier fails | No production promotion |
| Critical | Override fails after `100/0` mutation | Restore prior exclusive deployment, or incident on drift |
| Critical | PR/push workflow | Never enters production job or reads deploy secrets |
| Critical | Credential-free gate after approval | No release secret mapped into gate subprocess environment |
| Critical | Wrong version/release/workflow identity | Fail gate |
| Critical | Post-promotion verifier fails | Rollback known-good whole version |
| Critical | Concurrent run or pre-promote drift | Abort; never overwrite newer deployment |
| Critical | Stale rollback after another deploy | Reject rollback and escalate |
| High | Deployment has split versions | Reject release |
| High | R2/AWS/npm publish token or command remains | Repository gate fails |
| Medium | Edge rate rule drift | Monitor/release gate fails; bearer remains active |

## Function / Interface Checklist

- [x] `verify-release` no longer accepts force-refresh or bucket inputs.
- [x] Control-plane verifier has one owned external control.
- [x] Package graph has no `@aws-sdk/client-s3`.
- [x] `rg` finds no runtime R2/pointer/CAS/receipt consumer.
- [x] Deployment evidence includes exact SHA, Worker version, `releaseId`, `workflowBuildId`.
- [x] Deployment controller records prior deployment/version immediately before mutation and uses expected-current guards.
- [x] Old R2 credential names remain forbidden.
- [x] External inventory records `not present` or redacted revocation evidence.

## Dependency Map

```text
Phase 2 static runtime PASS
 -> credential-free CI
 -> manual main dispatch + exact-SHA confirmation
 -> exact-SHA asset build + full gate + dry-run
 -> capture prior deployment + upload candidate
 -> candidate 0% + version-override verify
 -> 100% exact-version promote
 -> production verify / whole-version rollback
 -> Phase 4 docs + live closure
```

## Regression Gate

```bash
cd mcp-worker
npm run test:release
npm run test -- test/security
npm run check
npm run test:worker
```

`repository-gate.test.ts` và `import-boundaries.test.ts` own the residue contract: runtime/config/dependencies/workflows must have no R2 consumer, while the exact historical R2 credential names remain allowed only in the denylist test fixture. Không dùng raw `rg` zero-match vì exit semantics bị đảo và denylist là intentional match.

Clean-checkout production job owns the credential-free release gate in this order:

```bash
npm run build:worker-assets
npm run check:repository
```

Không chạy clean-source builder từ dirty Cook worktree.

## Todo

- [x] Viết workflow/verifier/control-plane tests trước.
- [x] Chuyển exact-version release flow.
- [x] Xóa R2 code/config/dependency/workflow.
- [x] Chạy release, security, repository và rollback rehearsal gates bằng local controller tests.

## Success Criteria

- [x] Không còn R2 runtime/release/control-plane dependency.
- [x] Release contract/tests bắt buộc candidate được verify trước traffic và production chỉ một version 100%.
- [x] Bearer và edge rate control giữ nguyên threat boundary.
- [x] Không có npm publishing.

## Risks and Rollback

- **Risk:** Version cũ cần R2 để rollback nếu version/resource đó tồn tại. **Mitigation:** inventory trước release; giữ external buckets read-only ngoài code scope đến sau rehearsal khi applicable.
- **Risk:** Version override âm thầm fallback. **Mitigation:** authenticated version header must equal candidate before any promote.
- **Risk:** Concurrent releases. **Mitigation:** concurrency + live expected-current compare; no blind rollback.
- **Rollback:** Upload fail không đổi deployment. Override fail restores prior exclusive deployment under ownership predicate. Post-promote fail uses recorded prior version only under the same predicate. Không rollback bearer secret.

## Security Considerations

- Production mutation chỉ từ confirmed exact-current-main dispatch với least-privilege token.
- Repository secrets remain step-scoped; repository gate stays credential-free.
- Override `/mcp` vẫn bearer-protected và đi qua production edge controls; asset paths vẫn `404`.
