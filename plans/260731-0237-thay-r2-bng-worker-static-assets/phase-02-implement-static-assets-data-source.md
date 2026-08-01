---
title: "Phase 2: Triển khai Static Assets DataSource và Worker wiring"
status: completed
---

# Phase 2: Triển khai Static Assets DataSource và Worker wiring

## Overview

- **Ưu tiên:** P1
- **Phụ thuộc:** Phase 1
- **Mục tiêu:** Viết Static Assets tests trước, sau đó thay production R2 reader bằng một `ASSETS.fetch()` capability hẹp.
- **Giữ nguyên:** Filesystem source cho CLI/stdio, tám tools và HTTP/auth contracts.

## Context Links

- [Cloudflare Static Assets research](./research/cloudflare-static-assets.md)
- [R2 impact map](./research/r2-impact-map.md)
- `mcp-worker/src/data/data-source.ts`
- `mcp-worker/src/worker.ts`

## Requirements

- Named binding `ASSETS`; `run_worker_first: true`.
- Named version metadata binding; authenticated `/mcp` response emits one fixed safe Worker-version header for verifier.
- Internal fixed paths: `/manifest.json` và sáu `/${artifact.key}`; không nhận path từ MCP input.
- External GET/HEAD vào asset paths, `/data/*` và unknown route luôn `404`.
- Missing/non-2xx/redirect/oversize/invalid UTF-8/JSON/hash/count/key fail closed thành safe `DATA_UNAVAILABLE`.
- Reader kiểm `Content-Length` khi có và stream với hard byte cap; cancel ngay khi chunked body vượt giới hạn.
- Cache một validated immutable snapshot theo Worker version/isolate; không force-refresh.

## File Inventory

| Action | File | Rough size | Test impact |
|---|---|---:|---|
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/static-assets-data-source.ts` | 180 LOC | New unit tests |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/data-source.ts` | 180 LOC | Simplify immutable cache |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/filesystem-data-source.ts` | 80 LOC | Remove obsolete load options |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/research/research-handlers.ts` | 350 LOC | Remove force-refresh dependency |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/worker.ts` | 220 LOC | Replace R2 binding/cache |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/wrangler.jsonc` | small | Static assets binding |
| Modify | `/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-worker.yml` | small | Build assets before repository dry-run |
| Regenerate | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/worker-configuration.d.ts` | generated | Binding types |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/vitest.worker.config.ts` | small | Actual asset binding |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/data/data-sources.test.ts` | 250 LOC | Filesystem/static parity |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/research/research-handlers.test.ts` | existing | Loader error/parity contract |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/transport/worker.integration.test.ts` | 200 LOC | Remove force-refresh contract |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/transport/worker.workerd.test.ts` | existing | Binding integration |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/performance/worker-budget.workerd.test.ts` | existing | Cold/warm corpus budget |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/security/import-boundaries.test.ts` | existing | Fixed fetch allowlist |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/release/verify-release.test.ts` | existing | Exact version header contract |

## Tests Before

1. Preserve registry/all-tools/CLI/stdio/HTTP parity characterization.
2. Add failing `StaticAssetsDataSource` parity and malformed-asset tests.
3. Add failing Workerd tests proving real binding load and public-path `404`.
4. Add failing test that `TQCCL-MCP-Force-Refresh` no longer affects the request.

## Refactor

1. Implement an injected `Fetcher`-shaped reader; no Cloudflare global in core data code.
2. Fetch/validate manifest first, then only its six allowlisted keys; reject redirects and unexpected keys.
3. Wire Worker env to `ASSETS` và version metadata, remove bucket-reader creation and per-request force refresh.
4. Emit version ID only on authenticated `/mcp` responses; do not add it to public `/healthz` or tool schemas.
5. Set Wrangler assets directory/binding/routing, keep public preview URLs disabled and regenerate types.
6. Configure Workerd tests against committed `test/fixtures/release-snapshot/`; production `.worker-assets/` remains clean-checkout build output.
7. Move the CI `build:worker-assets` step before `check:repository`, because that gate ends with the production Wrangler dry-run after Static Assets config lands.
8. Read response bodies through a bounded streaming helper; reject redirects before materializing content.
9. Remove `DataSourceLoadOptions.forceRefresh` and its handler/transport propagation; immutable Worker versions no longer have an in-version refresh event.
10. Keep R2 files present but unused until all gates below pass.

## Tests After

- Filesystem and Static Assets sources produce the same snapshot and all-tool semantics.
- Auth/protocol/error non-echo behavior remains green.
- Production-size cold/warm/recommendation measurements are recorded, not silently relaxed.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Valid manifest + six assets | Snapshot parity |
| Critical | Missing/hash/count/key mismatch | `DATA_UNAVAILABLE`, no partial cache |
| Critical | External asset URL with/without bearer | `404`, no bytes leaked |
| High | Redirect, non-2xx, oversize, invalid UTF-8/JSON | Fail closed, redacted |
| High | Chunked body crosses byte cap | Stream cancelled before unbounded allocation |
| High | Concurrent first load | One valid immutable snapshot; no mixed state |
| High | Subsequent load in same isolate/version | No periodic asset re-fetch after successful activation |
| Medium | Cold/warm production corpus | Within documented account budget |

## Function / Interface Checklist

- [x] `DataSource.load()` public result/error behavior unchanged; obsolete load options removed from every caller.
- [x] Every `forceRefresh` consumer in `data-source.ts`, `research-handlers.ts`, Worker and tests is reconciled.
- [x] `StaticAssetsDataSource` accepts only an injected read/fetch capability.
- [x] `WorkerEnvironment` exposes `ASSETS`, not R2 buckets.
- [x] Runtime exposes a safe exact-version identity for release verification, without leaking account data.
- [x] Version header is absent on unauthenticated/error-before-auth and `/healthz` responses.
- [x] Worker cache lifetime is isolate/version scoped and correctness does not depend on cache.
- [x] Eight `RESEARCH_CONTRACTS` and public error envelopes are unchanged.

## Dependency Map

```text
Phase 1 .worker-assets -> ASSETS binding -> StaticAssetsDataSource -> handlers
FilesystemDataSource ---------------------> same handlers
Phase 2 -> Phase 3 may delete R2 pipeline
```

## Regression Gate

```bash
cd mcp-worker
npm run test -- test/data test/transport/worker.integration.test.ts test/transport/all-tools-parity.test.ts test/security/import-boundaries.test.ts
npm run test:worker
npm run typecheck
npm run typecheck:worker
```

Production asset build and Wrangler dry-run run later in the clean-checkout Phase 3 gate. Workerd uses the committed release snapshot fixture, so this phase remains runnable in a dirty implementation worktree.

## Todo

- [x] Viết unit, Workerd và public-path tests trước.
- [x] Implement datasource và Worker binding.
- [x] Xóa force-refresh behavior.
- [x] Chạy parity, security, performance và dry-run gates.

## Success Criteria

- [x] Remote Worker không cần R2 binding.
- [x] Asset paths không thể đọc từ public HTTP.
- [x] CLI/stdio/HTTP giữ semantic parity cho tám tools.
- [x] Có evidence cold/warm budget với corpus thật.

## Risks and Rollback

- **Risk:** `run_worker_first` sai làm lộ JSON. **Mitigation:** config assertion + Workerd/production-route override probe.
- **Risk:** parse vượt CPU/memory. **Mitigation:** production-shaped benchmark; fail gate nếu vượt budget.
- **Rollback:** R2 code/bindings chưa bị xóa trong commit chuyển runtime; revert Worker wiring nếu gate fail.

## Security Considerations

- Không passthrough external `request` vào `ASSETS.fetch`.
- Không để user input chọn path; error không lộ path, bytes hoặc asset content.
