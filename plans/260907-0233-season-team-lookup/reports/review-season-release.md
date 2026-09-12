# Phase 04 Release Tooling Code Review

Date: 2026-09-12
Reviewer: code-reviewer
Scope: read-only review of the completed release-tooling slice. This review intentionally excludes concurrently edited UI/MCP shared handlers and does not deploy, commit, or publish assets.

## Code Review Summary

### Scope

- Implementation reviewed:
  - `mcp-worker/scripts/build-worker-assets.ts`
  - `mcp-worker/scripts/verify-worker-assets.ts`
  - `mcp-worker/scripts/verify-release.ts`
  - `mcp-worker/src/release/worker-release-evidence.ts`
  - `mcp-worker/src/data/artifact-contracts.ts` API surface only
- Tests and fixtures reviewed:
  - `mcp-worker/test/release/season-worker-assets.test.ts`
  - `mcp-worker/test/release/verify-release.test.ts`
  - `mcp-worker/test/release/build-worker-assets.test.ts`
  - `mcp-worker/test/data/season-snapshot.test.ts`
  - `mcp-worker/test/data/static-assets-data-source.test.ts`
  - `mcp-worker/test/fixtures/release-snapshot/*`
- Plans/reports read:
  - `plans/260907-0233-season-team-lookup/reports/phase-04-release-tooling.md`
  - `plans/260907-0233-season-team-lookup/reports/season-shared-contract.md`
  - `plans/260907-0233-season-team-lookup/reports/phase-04-release-tests.log`
  - `plans/260907-0233-season-team-lookup/reports/season-release-red.log`
  - `plans/260907-0233-season-team-lookup/reports/season-release-reader-red.log`
  - `plans/260907-0233-season-team-lookup/reports/season-release-discovery-red.log`
  - `plans/260907-0233-season-team-lookup/reports/season-release-private-red.log`
- Erratum — 2026-09-12: the earlier claim that Phase 04's plan file was absent was incorrect. It exists at [phase-04-mcp-and-release-validation.md](../phase-04-mcp-and-release-validation.md). This review used the implementation report listed above; that is execution evidence, not a replacement for the owning phase. The bounded review verdict is unchanged; [Kongming closure](final-advisory.md) and [final validation](final-validation.md) govern phase closure.
- Focus: exact 6/11 artifact manifests, 7/12 private asset files, immutable v1 fixture identity, partial/hash/count/cross-reference rejection, unchanged clean-SHA release guard, exact discovery `manifestVersion` names, public output without private catalog, and the narrow optional `data/sgsdeck/` private-directory exception.

### Overall Assessment

Verdict: PASS for the release-tooling slice.

- Critical count: 0
- High count: 0
- Medium count: 0
- Low count: 0
- Review score: 9/10. The remaining point is reserved for final end-to-end release identity regeneration after concurrently edited consumers settle; no source-grounded release-tooling defect was found.

## Priority Findings

### Critical Issues

None.

### High Priority

None.

### Medium Priority

None.

### Low Priority

None.

## Acceptance and Edge Cases Checked

| Area | Result | Evidence |
| --- | --- | --- |
| Exact v1/v2 artifact names | PASS | `mcp-worker/src/data/artifact-contracts.ts:5-18` defines six legacy artifacts, five seasonal artifacts, and `artifactNamesForVersion(1|2)`. `createDataManifest` chooses v2 only when seasonal artifacts are present and then requires exact names at `:355-360`. |
| Exact 7/12 private asset files | PASS | `buildWorkerAssets` collects only selected artifact names and emits those JSON files plus `manifest.json` at `mcp-worker/scripts/build-worker-assets.ts:242-286`. `season-worker-assets.test.ts:28-44` asserts twelve v2 files and exact evidence; `build-worker-assets.test.ts:86-110` keeps legacy seven-file behavior. |
| Partial seasonal source rejected before replacement | PASS | `validateSourceRoot` rejects any seasonal count other than 0 or 5 at `build-worker-assets.ts:127-131`; the replacement step is reached only after source validation and staging. `season-worker-assets.test.ts:54-60` proves an accepted output directory is preserved when seasonal input is partial. |
| Hash/count/manifest canonical safety | PASS | `validateManifest` validates schema version, exact names, duplicate rejection, digest shape, byte length, count, and canonical identity at `artifact-contracts.ts:401-505`. `verifyWorkerReleaseEvidence` revalidates snapshot bytes, manifest bytes, release ID, manifest hash, and inventory digest at `worker-release-evidence.ts:168-214`. |
| Cross-reference rejection | PASS | V2 activation calls `validateSeasonBundle` through `validateDataSnapshot` at `artifact-contracts.ts:520-565`; `season-snapshot.test.ts:30-35` mutates a seasonal config team reference to `missing` and verifies activation rejects with `INVALID_ARTIFACT`. |
| Clean SHA/source guard unchanged | PASS | `buildWorkerAssets` reads source identity, requires clean source before and after asset reads, and rejects commit/tree drift at `build-worker-assets.ts:212-255`. The production workflow still verifies exact manual SHA against `GITHUB_SHA`, local HEAD, and `origin/main` at `.github/workflows/mcp-worker.yml:115-124`. |
| Exact discovery manifest version names | PASS | `hasExpectedArtifactInventory` rejects unsupported `manifestVersion`, mismatched v1/v2 inventories, duplicates, unknown names, and malformed SHA values at `verify-release.ts:30-42`; `season-worker-assets.test.ts:74-86` covers the positive and negative discovery matrix. |
| V2 HTTP verifier and rollback identity | PASS | `verify-release.test.ts:125-200` runs both `verifyRelease` and `readReleaseIdentity` against v1 and v2 controlled worker snapshots, checking release identity, workflow version, protocol, catalog, and Worker version. |
| Public output contains no private catalog | PASS | The builder’s expected source set is exact public data artifacts plus explicit allowed source files; `data/sgsdeck/` is filtered before inventory comparison and never copied. `season-worker-assets.test.ts:87-100` asserts neither `sgsdeck` nor sentinel descendants appear in output for v1 or v2. |
| Narrow private SGSDeck exception | PASS | `validateSourceRoot` allows only a real, non-symlink direct-child `sgsdeck` directory whose realpath parent is the data root, then filters it without enumerating descendants at `build-worker-assets.ts:113-126`. `season-worker-assets.test.ts:101-109` rejects file, internal symlink, external symlink, other directory, and unexpected file cases. |
| Immutable v1 fixture identity | PASS | Current fixture `manifest.json` remains schemaVersion 1 with six artifacts. Local inventory check showed the legacy release-snapshot files unchanged in shape; `season-snapshot.test.ts:16-22` asserts the six-artifact fixture manifest identity is exactly reproduced from current bytes. |
| Evidence schema stability | PASS | `WorkerReleaseEvidence` remains `schemaVersion: 1` with commit, tree, manifest hash, release ID, workflow build ID, and asset inventory digest at `worker-release-evidence.ts:46-54`; tests mutate every evidence field and reject ambiguity at `build-worker-assets.test.ts:167-240`. |
| Secret/data leak behavior | PASS | Release verifier uses a fixed public error type and does not surface bearer/upstream private body; `verify-release.test.ts:216-235` covers failure redaction. Endpoint parsing rejects userinfo/query/fragment at `verify-release.test.ts:78-99`. |

## Verification Performed

Fresh release-suite check run during this review:

```text
npm --prefix mcp-worker test -- test/release

Test Files: 10 passed (10)
Tests: 72 passed (72)
Duration: 825ms
```

Existing Phase 04 validation evidence reviewed:

```text
plans/260907-0233-season-team-lookup/reports/phase-04-release-tests.log

Test Files: 10 passed (10)
Tests: 72 passed (72)
```

Current immutable v1 fixture shape checked locally:

```text
mcp-worker/test/fixtures/release-snapshot/manifest.json
schemaVersion=1
artifact_count=6
artifact_names=teams, team-tier, coexist, heroes-dict, tactics, books-dict
```

Package/workflow release-tooling checks:

```text
mcp-worker/package.json
private=true
build:worker-assets -> scripts/build-worker-assets.ts
verify:worker-assets -> scripts/verify-worker-assets.ts

.github/workflows/mcp-worker.yml
production release verifies production_sha == GITHUB_SHA == HEAD == origin/main
production release builds assets and verifies worker-release evidence before runtime/deploy steps
```

## Residual Risks and Explicit Non-Issues

- The optional `data/sgsdeck/` exclusion is intentionally narrow and matches the Kongming-approved private catalog policy recorded in the Phase 04 report. It is not a public artifact exception and does not read or copy descendants.
- Full package/repository gates and final workflow identity regeneration remain dependent on concurrent consumer completion. This review does not mark those consumers ready.
- The local asset reader validates flat directory inventory before evidence verification. It is adequate for the release artifact directory under this contract; adversarial concurrent mutation of the local filesystem during verification is outside the accepted release-tooling threat model and was not treated as a blocker.

Status: DONE
Summary: Release tooling passes the bounded review with no priority findings. Exact v1/v2 artifact inventories, 7/12 private asset output, immutable v1 fixtures, evidence schema stability, partial/hash/count/cross-reference rejection, clean-SHA guard, exact discovery inventory, and the narrow private `data/sgsdeck/` boundary are supported by source inspection and passing release tests.
Concerns: None for the reviewed release-tooling scope.
