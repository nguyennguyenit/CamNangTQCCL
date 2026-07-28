---
phase: 3
title: "Build research tools, data loaders, and CLI"
status: completed
priority: P1
effort: 4d
dependencies: [2]
---

# Phase 3: Build research tools, data loaders, and CLI

## Context Links

- [Plan](./plan.md)
- [Platform scout](./reports/scout-platform-phases-03-04.md)
- [Cloudflare MCP research](./research/researcher-cloudflare-mcp.md)
- [Brainstorm contract](../reports/260713-brainstorm-mcp-build-tqccl.md)

## Overview

Build the transport-neutral data contract, local and R2 sources, immutable release validation, eight research handlers, and JSON CLI. All surfaces call the same handlers; this phase adds no MCP protocol or deployed route.

## Requirements

- Functional:
  - Load six artifacts: teams, team-tier, coexist, heroes dictionary, tactics, books dictionary.
  - Local source reads the repository filesystem from any CWD and synthesizes the same full canonical-manifest `releaseId` plus compact display `dataVersion` used by remote snapshots.
  - R2 source reads `current.json` from a pointer bucket, then an immutable manifest and only manifest-declared keys from a separate locked release bucket; activate a snapshot after all schema/hash/cross-reference checks pass.
  - Expose eight handler names exactly: `tqccl_get_data_version`, `tqccl_normalize_entities`, `tqccl_search`, `tqccl_get_team`, `tqccl_match_team`, `tqccl_recommend_team`, `tqccl_recommend_coexist`, `tqccl_suggest_replacements`.
  - CLI subcommands map one-to-one to those handlers and emit one JSON document.
  - Every request derived from prior normalization/detail/match output carries `expectedWorkflowVersion` and, for recommendations, `confirmationBinding`; mismatch returns `WORKFLOW_VERSION_CHANGED` or `CONFIRMATION_REQUIRED` before domain work. Workflow identity uses full `releaseId`, never compact `dataVersion`.
- Non-functional:
  - Deterministic, read-only, stateless handler behavior with bounded inputs/results, pagination/truncation, version, provenance, warnings, and typed errors.
  - Counts are observed diagnostics, not schema constants.
  - Filesystem and process APIs stay outside Worker import graph; R2 keys never derive from user input.
  - Cache is correctness-neutral: swap only complete snapshots; cold start always works; stale-on-error has a monotonic, absolute, non-extendable deadline derived from the last successful snapshot activation.
  - `research-contracts.ts` is the authoritative runtime-schema source for all eight public requests/results and infers their TypeScript types; CLI and both MCP transports reuse these schema objects.

## Architecture

```text
filesystem reader ------------------------\
pointer-bucket reader -> release-bucket reader -> DataSource -> validated DataSnapshot -> indexes
Phase 2 services ---------------------------------------> research handlers
research handlers --------------------------------------> JSON CLI
                                                     \--> Phase 4 MCP registry
```

Local and remote share `DataManifest` and `DataSnapshot`. `coexist.json` is loaded and exposed as reference provenance only. The release publisher is deferred to Phase 6; the reader contract is implemented and tested here.

## File Inventory

| Action | Absolute path | Rough delta | Purpose / test impact |
|---|---|---:|---|
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package.json` | +20–30 | CLI/build/data test scripts; exact dependencies. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package-lock.json` | generated | Lock graph after additions. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/artifact-contracts.ts` | 200–270 | Manifest, descriptors, parsed artifact/snapshot validators. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/data-source.ts` | 140–200 | Reader/source/cache/index interfaces, `SnapshotCachePolicy`, refresh state machine, and typed errors. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/filesystem-data-source.ts` | 100–140 | Node-only reader, hashing, local manifest/version. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/r2-data-source.ts` | 170–230 | Web-standard separate pointer/release readers and immutable release activation behind a narrow read-only application interface. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/snapshot-index.ts` | 120–180 | Precomputed canonical/search/team/tier indexes. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/research/research-contracts.ts` | 240–330 | Single authoritative runtime schemas for eight inputs/outputs, inferred public types, pages, provenance, and limits. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/research/research-handlers.ts` | 340–460 | Same callable handlers for CLI/MCP. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/workflow-source-manifest.json` | +4–8 | Extend and re-prove the generated transitive closure with authoritative runtime schemas and semantic handler/index sources. |
| Regenerate | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/generated/workflow-build.ts` | generated | Capture the expanded closed manifest before CLI/MCP consumers use it. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/cli.ts` | 180–240 | Argument parser, dispatch, JSON stdout, stderr/exit codes. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/data/artifact-contracts.test.ts` | 220–300 | Real artifacts, malformed values, cross references. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/data/data-sources.test.ts` | 260–350 | FS/R2 parity, corruption, cache swap. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/research/research-handlers.test.ts` | 320–430 | Eight handlers and bounds. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/cli.integration.test.ts` | 200–280 | Subprocess stdout/stderr/CWD/exit behavior. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/performance/domain-budget.test.ts` | 100–150 | Production-shaped cold/warm parse/index/recommend CPU proxy before transport work. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/fixtures/release-snapshot/` | 180–260 | Minimal real-schema immutable release; no images/secrets. |
| Modify/Delete | None outside `mcp-worker/` | 0 | Existing data is read-only input; Python CLI frozen. |

## Function and Interface Checklist

- [x] `ArtifactName` is a closed six-name union; `ArtifactDescriptor`, `ReleasePointer`, `DataManifest`, `DataSnapshot`.
- [x] Narrow `PointerReader.readCurrent`, `ReleaseReader.readKnownObject`, `DataSource.load`, `validateManifest`, `parseArtifact`, `validateCrossReferences`; no mutation method exists in application-facing interfaces.
- [x] Hashing verifies exact bytes before parse; `releaseId` is the full digest of the canonical manifest, while compact `dataVersion` is display-only; manifest version/key/hash/count metadata is returned without fabrication.
- [x] `FilesystemDataSource` resolves an explicitly configured data root; never uses request/query text.
- [x] `R2DataSource` accepts separate injected pointer/release readers and validates prefix/key traversal, object absence, size, hash, version, and mixed release.
- [x] `SnapshotCachePolicy` separates `refreshAfter` from `serveStaleUntil = lastSuccessfulActivationMonotonic + maxStaleAge`; failed refreshes never move that deadline, and expiry returns `DATA_UNAVAILABLE`.
- [x] Cache has single-flight refresh, pointer version/ETag capture, compare-and-swap activation, and a verifier-only force-refresh path.
- [x] `buildSnapshotIndex` precomputes canonical IDs and deterministic search/team/tier maps once per version.
- [x] Eight handler functions exactly match the frozen upstream catalog names; their request/result types are inferred from the runtime schemas in `research-contracts.ts`.
- [x] Every handler loads one snapshot and returns `releaseId`, display `dataVersion`, `workflowVersion`, provenance, warnings, `truncated`, and `nextCursor` where applicable.
- [x] Dependent handlers validate `expectedWorkflowVersion`; recommendation handlers project/canonicalize submitted state and verify its `confirmationBinding` before domain work.
- [x] `workflowVersion` binds full collision-safe `releaseId` to the generated content-derived `workflowBuildId`; no compact display identity or manually bumped engine/schema constant is authoritative.
- [x] `tqccl_match_team` retrieves matches only; `tqccl_recommend_team` performs one build; coexist tool performs portfolio allocation.
- [x] Replacement handler uses curated alternatives from team records only and labels unsupported mechanics.
- [x] `parseCliArgs`, `runCli`, `main`; handler-name subcommands plus compact aliases documented by `--help`.
- [x] CLI stdout contains exactly one JSON result/error; diagnostics only on stderr; exits 0 success, 1 runtime/data, 2 usage.

## Dependency Map

```text
data/*.json -> FilesystemDataSource --\
pointer R2 + locked release R2 -> R2DataSource -> cache -> DataSnapshot -> indexes
Phase 2 normalization/recommendation -------------------> handlers
handlers -> CLI
handlers -> Phase 4 tool definitions
```

`filesystem-data-source.ts` may import Node APIs. Nothing reachable from `r2-data-source.ts` or handlers may import Node/process globals.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | R2 pointer switches before an object exists | New release rejected; no mixed snapshot activates. |
| Critical | Object bytes mismatch manifest hash | Typed unavailable/refresh error; previous warm snapshot retained. |
| Critical | Materially ambiguous normalize input is sent to recommendation | Confirmation-required error, no candidate output. |
| Critical | Same input/version through FS and seeded R2 | Deep-equal semantic handler result. |
| Critical | All eight catalog handler names | Unique, exact, callable; no alias leaks into MCP contract. |
| High | Local CLI from `/tmp` with explicit project/data root | Loads successfully without relying on CWD. |
| High | Search/result exceeds limit/byte ceiling | Deterministic truncation and cursor; never dumps corpus. |
| High | Tier/coexist cross-reference is absent or weak | Tier warning or reference-only coexist; no guessed join. |
| High | Unknown future fields in artifacts | Tolerated when used fields remain valid. |
| High | User query contains `../` or R2-like key | Treated as search text only; never becomes object path. |
| Medium | Empty search/team/roster | Valid bounded empty result or specific validation error. |
| Medium | Repeated warm load and simulated eviction | Same result; cache changes read count only. |
| Critical | Normalize under workflow W1, then data/contract/engine changes to W2 | Typed `WORKFLOW_VERSION_CHANGED`; no reinterpretation or candidate output. |
| Critical | Canonical payload differs by one nested field from the confirmed binding | Typed `CONFIRMATION_REQUIRED`; no candidate output. |
| Critical | Two fixtures are forced to share one compact `dataVersion` | Their full `releaseId` and `workflowVersion` remain distinct; cursor/binding reuse is rejected. |
| High | Slow V1 refresh completes after fast V2; pointer rolls V1→V2→V1 | CAS prevents stale overwrite and cache follows pointer within declared max age. |
| High | Candidate pointer stays corrupt beyond `serveStaleUntil` | Cached prior snapshot stops serving and returns `DATA_UNAVAILABLE`. |
| High | Repeated refresh failures occur before stale expiry | The absolute deadline is unchanged; no retry extends stale serving. |
| High | Semantic source/schema changes with unchanged data | Regenerated `workflowBuildId` changes; stale generated output fails CI and prior workflow is rejected. |
| Medium | Production-shaped cold parse/index plus worst-valid recommendation | Early CPU proxy is recorded before Phase 4; a clearly infeasible Free-tier result selects Paid or triggers bounded optimization now. |

## Tests Before

1. Create minimal valid release fixture and corrupt variants before validators.
2. Test all committed artifacts parse without encoding their current counts as permanent requirements.
3. Write local/two-bucket-R2 parity, incomplete/mixed/hash failure, reader-capability, and atomic cache-swap tests.
4. Write controlled refresh-interleaving, rollback-visibility, hard stale-deadline, workflow-version-change, and confirmation-binding tests.
5. Write handler contract tests for valid, invalid, ambiguous, empty, paginated, and over-limit inputs.
6. Write CLI subprocess tests before parser/entrypoint code.

## Refactor

1. Implement validators from leaf artifact records upward to manifest/snapshot.
2. Add reader abstraction and atomic cache, then filesystem and R2 sources.
3. Build indexes only after snapshot validation.
4. Define handler schemas and dispatch table; delegate domain work to Phase 2.
5. Add CLI as a thin adapter over dispatch; no duplicated logic or formatting.

## Implementation Steps

1. Resolve exact current library versions needed for validation/CLI and update lockfile.
2. Add fixture releases with generated hashes and explicit expected version.
3. Implement artifact/manifest validation and cross-reference warnings.
4. Implement bounded single-flight source/cache refresh and prove corrupt, stale-completion, hard stale-deadline, and rollback safety.
5. Implement filesystem source; test from non-repository CWD.
6. Implement structural R2 source with separate injected pointer/release reader interfaces; keep Cloudflare’s write-capable binding outside those interfaces.
7. Implement snapshot indexes and all eight authoritative runtime request/result schemas with inferred types.
8. Implement handlers one at a time, running its focused test immediately.
9. Implement CLI help/dispatch/error mapping and subprocess tests.
10. Run the production-shaped CPU proxy and record cold/warm parse, index, and worst-valid recommendation work before Phase 4 transport design.
11. Run Phase 2 and existing project regressions; inspect the Worker entry graph for Node leakage in Phase 4.

## Tests After

- [x] Manifest rejects duplicate/missing/unknown required artifact descriptors.
- [x] Maximum input string/list/page/result-byte policies have boundary tests.
- [x] Cursor is opaque, workflow-bound, and rejected after data, contract, or engine change.
- [x] Cursor and confirmation compatibility depend on full `releaseId`; a compact `dataVersion` collision cannot preserve compatibility.
- [x] All multi-call dependent inputs are workflow-bound, not only cursors.
- [x] Errors never include local paths, R2 keys beyond safe artifact labels, or raw input blobs.
- [x] CLI/handler result parity holds for all eight operations.
- [x] Runtime schema identity is reused—not copied—by CLI dispatch and is ready for Phase 4 tool registration.
- [x] Frozen Python utility still runs its existing smoke path but receives no feature additions.

## Regression Gate

```bash
cd /Users/plateau/Project/CamNangTQCCL/mcp-worker
npm run check:workflow-build
npm test -- --run test/data test/research test/cli.integration.test.ts
npm run typecheck
npm run build
npm run cli -- tqccl_get_data_version
cd /Users/plateau/Project/CamNangTQCCL
npm run test:node
python3 -m unittest discover -s tests
cd worker && npm test && npm run typecheck
```

## Success Criteria

- [x] Six artifacts load through both sources under one validated snapshot contract.
- [x] Local and R2 sources derive the same full `releaseId`; compact `dataVersion` is display-only.
- [x] Incomplete/mixed/corrupt releases never activate.
- [x] Eight exact handlers are deterministic, bounded, read-only, versioned, and provenance-rich.
- [x] Dependent calls cannot cross workflow versions or reuse a confirmation binding against a changed payload.
- [x] Workflow source regeneration is clean and a semantic source mutation changes `workflowBuildId`.
- [x] CLI calls only shared dispatch/handlers and behaves correctly from any CWD.
- [x] FS/R2/CLI semantic parity, typecheck, build, and all inherited regressions pass.
- [x] No transport, MCP SDK, image, Vision Worker, or publication behavior is introduced.

## Completion Validation — 2026-07-28

- Môi trường cuối: Node `22.16`; MCP `131/131`, root Node `133/133`, Python `82/82`, Vision Worker `53/53`.
- `typecheck`, `build`, `check:workflow-build` và smoke CLI đều **PASS**.
- CPU proxy quan sát: `693` records / `60` observations; cold `11.56ms`, index `21.87ms`, warm recommendation `25.92ms`. Đây là timing proxy quan sát, không phải SLA.
- Reviewer cuối: **PASS**. Không thêm stdio/HTTP transport hoặc MCP SDK; Phase 4 chưa bắt đầu.

## Security and Privacy

- Closed artifact union prevents path/key injection; reject traversal and abnormal object sizes.
- Clamp input collections, string lengths, page size, search work, candidate count, and output bytes.
- Redact local paths and bucket details from user-facing errors.
- No secrets, media, channel data, or personally identifying state is read/stored.

## Risks and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Artifact drift | Validate only used fields, tolerate unknowns, test committed data. | Pin prior manifest/version; update parser in isolated change. |
| Partial/concurrent R2 publish | Separate pointer/release buckets, conditional release writes, locked release objects, hash manifest, and ETag-CAS pointer activation. | Keep/repoint prior `current.json`; warm snapshot stays valid. |
| Refresh fails for long period | Separate refresh and hard stale deadlines; alert before cutoff. | Fail closed with `DATA_UNAVAILABLE` after cutoff. |
| Worker CPU/memory pressure | Pre-index once, bound cache/results, measure in Phase 4/6. | Reduce page/candidate caps from evidence, not correctness rules. |
| Python/TS divergence | Freeze Python and route new capability only to TS. | Keep Python fallback unchanged until later parity decision. |

## Next Steps

Phase 4 registers these eight names without renaming and adapts the same handlers to stdio and HTTP.
