---
phase: 6
title: "Validate, secure, release, and operate MCP"
status: superseded
priority: P1
effort: 6d
dependencies: [4]
---

# Phase 6: Validate, secure, release, and operate MCP

## Context Links

- [Plan](./plan.md)
- [Parallel consumer handoff](./phase-05-publish-goclaw-consumer-handoff.md)
- [Architecture](../../docs/system-architecture.md)
- [Deployment guide](../../docs/deployment-guide.md)

## Overview

Add whole-system/security gates, immutable R2 publication, live MCP verification, evergreen service/operations documentation, and a staged release/rollback sequence. MCP release acceptance is independent of GoClaw, Dewee, skills, media providers, grants, and channels.

> **Superseded ngày 2026-08-01.** Các yêu cầu và checklist R2 bên dưới được giữ làm lịch sử thiết kế, không phải việc còn mở. Plan [Worker Static Assets](../260731-0237-thay-r2-bng-worker-static-assets/plan.md) đã thay thế release plane này và hoàn tất live exact-version promotion/rollback tại [run 30708870542](https://github.com/nguyennguyenit/CamNangTQCCL/actions/runs/30708870542).

## Requirements

- Functional:
  - Golden structured observations flow through normalization, binding validation, coexist recommendation, and bounded versioned result.
  - Publisher has separate stage and activate operations: validate and conditionally write a content-addressed release to a locked release bucket; a distinct activator updates `current.json` in a pointer bucket only from a valid promotion receipt.
  - Production bucket lock protects the entire release bucket for the declared rollback window. The mutable pointer bucket is separate and monitored.
  - Upload one exact Worker version without normal traffic; verify that version against exact current and candidate manifests through a non-public verifier path, then create a content-addressed promotion receipt.
  - Deploy exactly one Worker version at 100% during activation; no gradual/split deployment. After pointer CAS, a force-refresh live verifier runs and automatically CAS-restores the prior pointer on failure.
  - Verification checks constant-time liveness plus authenticated readiness, MCP initialize/list and calls for all eight tools, exact catalog/annotations, negotiated and subsequent-request protocol headers, authenticated stateless GET/DELETE behavior, workflow version, binding rejection, provenance, managed-client auth, limits, and truncation.
  - A repository-wide release gate owns `mcp-worker` checks plus Astro root build/dist/E2E, root JS, Python fallback, and Vision Worker regressions; deploy/publish scripts refuse any failed constituent.
  - MCP runbook covers provisioning, bearer rotation, Worker/data rollback, retention, incident response, and service disable/recovery.
- Non-functional:
  - R2 Standard only. Two buckets and bucket-scoped credentials separate release publication from pointer activation; bucket lock enforces release retention.
  - Cloudflare R2 credentials and Worker bindings are not falsely described as prefix/create-only/read-only IAM. Publisher writes only the release bucket, activator writes only the pointer bucket, and Worker code exposes bindings only through narrow reader interfaces plus bundle/import guards.
  - Production secrets come from managed secret stores, never argv/query/repository files/logs. Exceptional short-lived local files are permission-restricted, scanned including ignored/untracked paths, and cleaned.
  - Build/test jobs are credential-free and consume an explicit clean Git tree/source digest. Release credentials appear only after immutable artifacts and tests complete.
  - `releaseId` is the full digest of the canonical release manifest and is distinct from display-oriented `dataVersion`; it is the data component of `workflowVersion`, confirmation compatibility, and cursors. Release ID, source digest, artifact manifest hash, Worker version, workflow version, approval evidence, and canary digest are recorded only after verified deployment.
  - No consumer-platform configuration or credential is required to build, test, release, verify, or roll back MCP.

## Architecture

```text
clean Git tree -> credential-free build/test -> immutable artifact + source digest
 -> verify release-bucket lock/control plane -> conditional releases/<releaseId>/*
 -> upload exact Worker version without traffic
 -> version-specific current+candidate verify -> immutable promotion receipt
 -> deploy that version at 100% -> ETag-CAS pointer-bucket/current.json
 -> force-refresh live verifier -> deployment record
                         failure -> conditional prior-pointer restore
```

Data rollback first ETag-CAS repoints `current.json` to the prior release and verifies it through the current Worker. Worker rollback restores retained old code/semantic bundle while reapplying the current compatible secrets, bearer rotation state, bindings, Origin policy, and limits by default; retired tokens never return. A full old-configuration rollback requires separate explicit authorization and an ordered credential transition. Old in-flight workflow bindings receive `WORKFLOW_VERSION_CHANGED` and restart. No consumer registration or skill action participates in MCP rollback.

## File Inventory

| Action | Absolute path | Purpose / test impact |
|---|---|---|
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/e2e/team-research-workflow.test.ts` | Golden normalize/binding/recommend/coexist flow. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/security/release-security.test.ts` | Auth, limits, redaction, manifest/mixed-release rejection. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/security/import-boundaries.test.ts` | No image/Vision/Node-in-Worker/crawler/mutation imports. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/build-data-release.ts` | Validate/hash six local artifacts from a clean source tree; emit `releaseId`, source digest, manifest, and immutable staging output without credentials. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/publish-data-release.ts` | Release-bucket lock preflight, conditional stage, exact candidate verification, promotion receipt, pointer-bucket activation, and conditional auto-restore. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/verify-release.ts` | Read-only liveness/authenticated readiness and all-eight live MCP/control-plane verifier. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/release/promotion-receipt.ts` | Canonical immutable receipt binding release/source/manifest/Worker/prior-pointer/evidence/approval identities. |
| Create | `/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-r2-lock-monitor.yml` | Scheduled/manual release-lock, pointer-change, event-notification, and alert drift monitor. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-worker.yml` | Protected clean-tree credential-free build/test artifact, then separately authorized immutable promotion jobs. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/.gitignore` | Ignore exceptional MCP local secret files while dedicated scanning still includes ignored/untracked paths. |
| Reuse | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/infra/control-plane-requirements.json` | Executable ownership/evidence contract for WAF/rate, release lock, pointer monitoring, and R2 event/alert controls. |
| Reuse | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/verify-control-plane.ts` | Read-only live drift verification; account mutation remains an explicitly authorized infrastructure step. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package.json` | Check, repository gate, release, verifier, dry-run, and deploy scripts. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package-lock.json` | Final pinned dependency graph. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/wrangler.jsonc` | Separate pointer/release R2 bindings, compatibility date, overlap expiry, non-secret limits/routes. |
| Create | `/Users/plateau/Project/CamNangTQCCL/docs/mcp-research-server.md` | MCP architecture, contracts, CLI/stdio/HTTP, release, rollback, and operations. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/system-architecture.md` | MCP boundary and structured-data trust split. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/deployment-guide.md` | MCP data/Worker ordered deploy and rollback. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/deployment.md` | Actual verified MCP IDs/versions/date only after release. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/codebase-summary.md` | New package and ownership boundary. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/code-standards.md` | Package gates, transport separation, secret rules. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/README.md` | Supported MCP surfaces, commands, and doc navigation. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/project-roadmap.md` | Verified MCP release status only. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/project-changelog.md` | User-visible MCP release facts only. |
| Delete | None | Existing data, browser, Python, Vision Worker, and external consumers remain unchanged. |

`docs/goclaw-mcp-skill-handoff.md` is owned exclusively by parallel Phase 5. Phase 6 neither depends on nor verifies that advisory file for build, release, deployment, or rollback, and must not create a second GoClaw guide.

## Function and Interface Checklist

- [x] `buildDataRelease` consumes exactly six known local artifacts and writes no source data.
- [x] `dataVersion` remains a compact display label only; collision-safe `releaseId` is the full digest of the canonical manifest and owns R2 paths, receipts, rollback, workflow compatibility, confirmation, and cursor identity.
- [x] **Superseded:** `publishDataRelease` và cặp release/pointer bucket không còn thuộc runtime; replacement workflow dùng clean-tree Worker Static Assets artifact và manual exact-SHA authorization.
- [x] **Superseded:** release-bucket lock preflight không còn áp dụng vì production release không dùng R2.
- [x] Lock administrator is separate from release-bucket publisher and pointer-bucket activator. Worker bindings are platform write-capable but reachable only through `ArtifactReader`; import/bundle tests reject mutation calls.
- [x] **Superseded:** live credential separation giữa hai R2 bucket không được chạy và không còn cần thiết; inventory xác nhận R2 không hiện diện.
- [x] **Hoàn tất qua replacement:** clean-source gate → exact Worker version candidate `0%` → authenticated verification → một version `100%` → whole-version rollback/re-promotion; không có R2 pointer hoặc receipt.
- [x] Existing versioned keys are accepted only when bytes/hash are identical; mismatch or pointer conflict aborts without overwrite.
- [x] `PromotionReceipt` content-addressedly binds `releaseId`, canonical manifest hash, `dataVersion`, `workflowBuildId`, exact Worker version ID, Git tree/source digest, prior pointer ETag/value, environment, evidence digest, approval reference, and bounded validity.
- [x] Activation accepts only a matching unexpired receipt; live failure automatically restores the prior pointer with the new pointer ETag. A rollback CAS conflict stops automation and pages/manual-incidents instead of overwriting concurrent state.
- [x] `verifyRelease` takes URL and expected immutable identities; bearer and control-plane credentials come from secret environment variables only.
- [x] **Hoàn tất qua replacement:** repository/live verifiers giữ các gate MCP, identity, auth, limits và provenance còn hiệu lực; R2 lock-policy check đã bị supersede. Live probes xác nhận health `200`, unauthenticated MCP `401` và private assets `404`.
- [x] Repository gate và workflow identity gate pass trong production run của replacement plan trên exact SHA được phê duyệt.
- [x] Runtime bundle/import guards reject R2 mutation and publication modules.
- [x] Production `/mcp` có edge rate rule đã xác minh và Worker vẫn giữ post-auth rate/in-flight limits.
- [x] **Hoàn tất qua replacement:** rehearsal rollback phục hồi prior known-good code + data rồi re-promote candidate; bearer không bị rollback.
- [x] Secret scanning covers tracked, untracked, and ignored exceptional local secret files; cleanup and current -> bounded dual -> promote -> retire transitions are tested.
- [x] `npm run check` is deterministic, contains no live deploy, and requires no GoClaw/Dewee environment.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Golden structured observations and valid binding | Exact deterministic coexist result with version/provenance and bounded output. |
| Critical | Material ambiguity or binding mismatch | Confirmation-required result; no recommendation candidate. |
| Critical | Missing/wrong bearer on `/mcp` | Constant-shape 401; no token/log leak. |
| Critical | Corrupt/incomplete/mixed staged or R2 release | Publish/activation blocked; current pointer unchanged. |
| Critical | Concurrent publisher or mismatched existing key | Conditional create/CAS fails safely; identical retry remains idempotent. |
| Critical | New data schema with old live Worker | Pointer cannot switch until Worker proves current/candidate snapshot compatibility. |
| Critical | Release-bucket lock or required WAF/event/alert control is missing/weaker | Publisher refuses stage/activate and reports the named owner/evidence gap. |
| Critical | Tool catalog, shared schema object, or annotation drifts | Repository gate and all-eight live verifier fail release. |
| Critical | Candidate receipt names another manifest, source tree, Worker version, environment, prior ETag, or evidence digest | Activation rejects before pointer mutation. |
| Critical | Post-activation force refresh fails | Activator CAS-restores prior pointer; a rollback CAS conflict stops and raises an incident. |
| Critical | Worker deployment has two traffic-serving versions | Activation blocks until exactly one verified version owns 100% traffic. |
| High | Result/body/string/list/candidate limits | Boundary accepted; over-bound rejected/truncated deterministically. |
| High | Data-only pointer rollback | Prior snapshot returns its recorded semantic golden under current workflow build. |
| High | Worker code rollback under current security configuration | Retained old code passes current bearer, bindings, Origin, rate, and readiness canary without resurrecting retired secrets. |
| High | Prior client binding reaches new workflow build | `WORKFLOW_VERSION_CHANGED`; caller restarts. |
| Critical | Distinct full manifests share a forced compact `dataVersion` | Distinct `releaseId`/`workflowVersion`; old binding and cursor are rejected. |
| High | Trace/log scan | No bearer, local path, image/base64, or control-plane credential. |
| High | Edge/post-auth rate or in-flight limit exceeded | Stable `429`; no body/R2/MCP work; recovery verified. |
| Medium | Worker cold/warm p95 and R2 read count | Confirms Phase 4 tier; release blocks on material regression. |
| High | No GoClaw/Dewee installation is present | All MCP gates, deploy dry-run, verifier, and rollback tests still pass. |
| Critical | Prompt-like observation/corpus strings flow through all eight tools | Structured fields remain tagged untrusted; no agent-facing fallback echoes attacker text. |
| High | R2 refresh fails repeatedly until stale cutoff | `serveStaleUntil` never extends; authenticated readiness ends with `DATA_UNAVAILABLE`, while `/healthz` remains no-I/O liveness. |
| High | Token overlap expires or code rollback uses retired token state | Expired/retired token is rejected; current managed secret configuration remains authoritative. |
| High | Build job has credentials or source tree differs from receipt | Release gate blocks before staging; only the immutable clean-source artifact enters promotion. |

## Tests Before

1. Write golden e2e and security tests before scripts/docs.
2. Write import-boundary rules for raw media, Vision Worker, crawling/RAG/memory, mutation tools, and Node-in-Worker graph.
3. Test release builder/publisher against missing/weakened lock/control-plane evidence, cross-bucket credential denial, fake two-bucket R2 failure, concurrent writers, repeated identical publish, mismatched key, receipt tampering/expiry, pointer CAS conflict, and rollback CAS conflict.
4. Test exact candidate-version verification, 100%-single-version enforcement, automatic force-refresh rollback, and old-code/current-security rollback canary.
5. Test all-eight verifier parity, injection non-echo, redaction, managed-client bearer-from-env, non-OAuth client-header behavior, protocol-header/GET/DELETE matrix, overlap expiry, ignored/untracked secret scanning, and no-I/O health before live use.
6. Test that clean-source/provenance gates have no release credential during build and no GoClaw/Dewee/skill/config dependency.

## Implementation Steps

1. Re-read dirty overlapping docs/source and preserve unrelated user edits.
2. Add failing e2e/security/import-boundary tests and make the package gate green.
3. Implement the clean-tree credential-free release builder, full `releaseId`, source/artifact provenance, and fake two-bucket R2 failure tests.
4. Implement release-bucket lock/control-plane preflight, bucket-separated credentials, conditional stage, promotion receipt, authorized pointer activation, automatic conditional restore, and secret-safe output.
5. Implement all-eight live verifier with pure `/healthz`, authenticated readiness, collision-safe workflow identity, protocol-header/GET/DELETE checks, injection non-echo, and validate it against local/workerd first.
6. Write `docs/mcp-research-server.md`; update architecture/deployment/navigation surfaces without adding another GoClaw document.
7. Run MCP, Astro root build/dist/E2E, JS, Python, Worker, dependency, bundle, and Wrangler dry-run gates.
8. Configure/verify release-bucket lock, pointer monitoring, pre-Worker WAF/rate control, object event notifications/alert sink, scheduled drift monitor, and their repository evidence; stage immutable objects and verify hashes.
9. Upload an exact staging Worker version without traffic, verify it against exact current/candidate manifests, emit the immutable receipt, deploy it alone at 100%, activate the pointer, run force-refresh verification, confirm tier budget, and rehearse automatic data rollback.
10. Canary retained old code with current security/configuration, rehearse default code-only rollback plus the separately authorized full-configuration procedure, and prove retired tokens stay retired.
11. With explicit release authorization, promote the immutable MCP artifact and record actual source/release/Worker/workflow/approval/canary identities.

## Regression Gate

```bash
cd /Users/plateau/Project/CamNangTQCCL/mcp-worker
npm run check:workflow-build
npm test -- --run test/e2e/team-research-workflow.test.ts
npm test -- --run test/security
npm test -- --run test/transport/all-tools-parity.test.ts
npm run verify:control-plane
npm run check
npm run check:repository
npm run deploy:dry-run
cd /Users/plateau/Project/CamNangTQCCL
npm ci
npm run build
npm run test:dist
npm run test:e2e
python3 -m unittest discover -s tests
node --test "tests-js/*.test.mjs"
cd worker && npm test && npm run typecheck
cd ../mcp-worker && npm run check && npm run deploy:dry-run
```

## Release Gates

- [x] Exact dependency/compatibility-date pins and clean package audit.
- [x] **Hoàn tất qua replacement:** clean Git tree/source evidence, credential-free gates, immutable code+assets artifact và manual exact-SHA approval khớp production run; R2 promotion receipt không còn áp dụng.
- [x] **Superseded:** separate release/pointer R2 buckets, conditional staging, receipt-bound pointer switch và R2 rollback không được chạy; replacement rollback toàn Worker version đã pass.
- [x] **Superseded:** release-bucket lock, pointer monitor và R2 event/alert paths không còn áp dụng vì inventory xác nhận R2 không hiện diện.
- [x] Exact candidate Worker version pass current/candidate verification ở `0%`, sau đó là version duy nhất nhận `100%` traffic.
- [x] Worker live verifier và full repository gates pass trong replacement run; public liveness/auth/private-asset probes đúng contract.
- [x] CPU/latency/memory/R2 evidence confirms the Phase 4 tier without weakening correctness.
- [x] **Hoàn tất qua replacement:** pre-Worker edge rate control đã được xác minh; phần R2 monitoring/alerts bị supersede và không được tuyên bố đã chạy.
- [x] Known-good whole-version rollback pass với security boundary hiện tại; bearer cũ không được phục hồi.
- [x] Authorized replacement workflow giữ production secrets ngoài argv/repository/artifact; evidence được redacted và không chứa raw logs.
- [x] No GoClaw/Dewee/skill/media/channel dependency exists in build, test, deploy, verification, or rollback.
- [x] Explicit manual production confirmation và exact-SHA authorization đã được kiểm tra trước external mutation.

## Success Criteria

- [x] Whole-system golden, security, repository và authorized production gates pass qua replacement plan.
- [x] **Superseded:** R2 content-addressed release/pointer/receipt design không được triển khai live; Worker Static Assets exact-version release thay thế contract này.
- [x] Live Worker là stateless, authenticated, bounded, versioned và independently verified.
- [x] Operations docs cover MCP local use, deployment, rotation, retention, incident response, and rollback.
- [x] Production records contain only actual verified MCP versions and dates.
- [x] Vision Worker remains separate/unchanged; no image/raw path or new mutation/crawler/RAG/memory tool exists.
- [x] MCP completion does not require a skill or consumer-platform deployment.

## Validation Log

### Session 10 — 2026-07-29

- Hoàn tất local TDD cho immutable builder, conditional R2 stage, receipt-bound activation, pointer CAS/auto-restore, live MCP verifier, import boundary, local secret cleanup và repository gate.
- Node `22.16.0`: MCP `212/212`, release `41/41`; typecheck/build/workflow identity và Wrangler dry-run PASS. Repository gate: Astro E2E `14/14`, root JS `133/133`, Python `82/82`, Vision Worker `53/53`.
- Live verifier đối chiếu chính xác mô tả, input/output JSON Schema draft-07 và read-only annotations của toàn bộ tám tool với runtime contract.
- Cloudflare Deployment API adapter chỉ đọc trạng thái sau khi receipt/preflight/pointer đã hợp lệ và chỉ chấp nhận candidate duy nhất ở 100% traffic. Response deploy mơ hồ hoặc pointer CAS conflict đều fail closed, không tự ghi đè deployment đồng thời; candidate đã được gate tương thích current/candidate manifest. Toàn bộ test dùng fetch giả, không gọi Cloudflare live.
- Activation API bắt buộc lock bao trùm kiểm deployment, deploy, pointer CAS và live verification; test chứng minh critical section không thoát lock. R2 adapter dùng non-expiring lock record với conditional create/ETag-CAS release, chặn holder đồng thời và fail closed khi release mất ownership. Credential/monitor/break-lock rehearsal live tiếp tục là blocker.
- Primitive activation không còn được export; production driver chỉ có thể dùng wrapper yêu cầu lease.
- Production driver phải cấp `holderId` UUID để correlation với release evidence; malformed record fail closed và lỗi activation được giữ trong `cause` khi release-lock đồng thời lỗi.
- `stage:data-release` là executable driver: environment bind bucket target cố định; canonical manifest được tái tạo từ clean-tree `data/`; pointer/deploy/generic credential bị từ chối và Git child env được lọc; release credential riêng chỉ conditional-stage/read-back đúng bảy object.
- `activate:data-release` là executable driver: managed environment pin receipt ID và approved MCP endpoint; receipt/expectation/environment phải khớp; endpoint phải là HTTPS `/mcp` sạch và khớp tuyệt đối trước khi dùng bearer; release/generic credential bị từ chối; pointer credential, distributed lock, exact Worker deployment, pointer CAS, authenticated force-refresh và read-back đúng một Worker version 100% được nối trong một critical section.
- `npm audit` báo `0` vulnerability. Bundle dry-run hiện tại `1347.86 KiB`, gzip `237.93 KiB`.
- Tạo runbook tiếng Việt và workflow monitor control-plane chỉ đọc. Không gọi Cloudflare/R2 live, không deploy Worker và không đổi pointer; các checkbox live/staging/authorization tiếp tục để mở.

### Session 11 — 2026-07-30

- Agent-facing contract hardening: mọi public schema field có description; tám tool mô tả khi dùng, kết quả và failure modes.
- MCP error envelope thêm safe `message` và `nextAction` theo allowlist code; redaction test chặn exception message, input và private path. SDK-level input/protocol errors cũng đi qua fixed envelope, được kiểm chứng bằng official MCP Client.
- `@vitest/coverage-v8` được pin cùng Vitest `4.1.10`; `npm run check` bắt buộc statements/lines/functions `>=80%`, branches `>=70%` trên `src/data`, `src/domain`, `src/research`.
- Kết quả hiện tại: MCP `216/216`, workerd `2/2`; coverage statements `89.08%`, branches `81.84%`, functions `95.37%`, lines `89.56%`.
- Schema authority đổi nên `workflowBuildId` được regenerate; staging/live release phải dùng identity mới. Không gọi Cloudflare/R2 live.

### Session 12 — 2026-08-01

- Phase R2 này được đóng bằng replacement plan, không phải bằng cách chạy các gate R2 lịch sử. Inventory xác nhận R2 không hiện diện; không có bucket, pointer, receipt hay R2 credential nào được tạo hoặc retire.
- [GitHub Actions run 30708870542](https://github.com/nguyennguyenit/CamNangTQCCL/actions/runs/30708870542) pass cả hai job tại exact SHA [`080c514064e4d9f37618f154e0c4bec09771164c`](https://github.com/nguyennguyenit/CamNangTQCCL/commit/080c514064e4d9f37618f154e0c4bec09771164c).
- Replacement evidence xác nhận traffic prior `[100]`, candidate smoke `[100,0]`, rollback `[100]`, final `[100]`, `rollbackRehearsal: true`; `/healthz` trả `200`, `/mcp` không bearer trả `401`, public manifest/team assets trả `404`, và edge rate rule đạt.
- Yêu cầu release/operations được replacement plan hoàn tất qua Worker Static Assets exact-version promotion và whole-version rollback; Phase R2 này giữ trạng thái superseded, không npm publish và không rollback bearer.

## Security and Privacy

- Use separate bucket-scoped credentials for release publication and pointer activation plus separate lock/control-plane administration and MCP bearer. Document that Worker R2 bindings are platform write-capable; narrow reader interfaces/import guards are application enforcement, not IAM.
- Never pass secrets in argv/query; redact stdout/stderr, traces, CI artifacts, and deployment records.
- Review threat model: corpus integrity, bearer blast radius, prompt-like structured observations, DoS, and supply chain.
- Build from reviewed clean source without credentials; inject release credentials only after immutable artifacts and tests exist. Add cryptographic signing only if a later threat model explicitly requires it.
- Preserve previous valid data and Worker versions until rollback window closes.

## Risks and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Pointer exposes partial/incompatible data | Exact-version candidate verification plus receipt and force-refresh check. | CAS-restore prior pointer; stop/page on rollback conflict. |
| Bucket lock missing or changed | Separate config authority, release preflight, and scheduled policy monitor. | Block publication/activation and restore policy. |
| Worker rollback restores stale security config | Canary retained code under current configuration and separate code from secret/config state. | Restore old code with current secrets/bindings/policy; full config rollback needs explicit credential transition. |
| Platform R2 binding can mutate | Two buckets, locked releases, narrow reader interface, mutation import guards, event/pointer monitoring. | Disable route/version and rotate binding; restore from locked release evidence. |
| Workstation/source compromise | Protected credential-free clean-tree build and receipt-bound source/artifact digests. | Reject artifact and rebuild from reviewed tree; do not promote. |
| Deployment claims outrun evidence | Gate records on observed canaries. | Remove unverified record; keep implementation docs. |
| Bearer exposure | Rotation, redaction, constant-shape auth failure. | Remove compromised token and redeploy secret config. |
| Consumer assumptions leak into service | Explicit import/config gates and independent verifier. | Remove consumer-specific code/docs except the single handoff guide. |
| Dirty user docs overwritten | Read/merge each target and inspect diff. | Revert only this feature’s hunks. |

## Final Handoff

Delivery đã hoàn tất qua replacement plan sau automated MCP gates, authorized release gates, documentation verification và whole-plan acceptance. Building or attaching a GoClaw skill vẫn là một future plan riêng.
