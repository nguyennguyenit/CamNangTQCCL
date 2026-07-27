---
title: "MCP plan implementation-readiness audit"
date: 2026-07-27
plan: "260723-2055-mcp-goclaw-image-team-research"
status: resolved
---

# MCP plan implementation-readiness audit

## Verdict

**HOLD before implementing the Phase 1 confirmation contract.**

The architecture remains directionally sound and `ak plan validate` passes, but
the plan is not contract-ready. Two high-severity identity/binding defects need
resolution first. Six medium findings should be folded into the affected phase
gates before Phase 4/release work.

Finding count: **8** — 0 critical, 2 high, 6 medium.

## Findings

### 1. High — Workflow binding uses a deliberately non-collision-safe data identity

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/plan.md:42`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:114`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:39`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:91`

`workflowVersion` binds `dataVersion` to `workflowBuildId`, while Phase 6 says
`dataVersion` is compact/display-oriented and only the full manifest
`releaseId` is collision-safe. Confirmation, cursors, and multi-call workflow
rejection therefore depend on an identity the plan explicitly says is not
collision-safe.

**Impact**

Two releases with the same compact identity can share a workflow version.
Bindings or cursors could survive a data change that should force
normalize/review/confirm.

**Recommended disposition: Accept**

Define one collision-safe semantic snapshot identity from the full canonical
manifest digest. Use it in `workflowVersion`, confirmation verification, and
cursors. Keep compact `dataVersion` for display only. Add a forced-collision
test proving two compact display versions still produce different workflow
versions.

### 2. High — `ConfirmationBinding` has three incompatible shapes

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:36`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:115`
- `mcp-worker/test/domain/contracts.test.ts:135`

Phase 2 freezes the binding as
`{ workflowVersion, normalizationDigest, projectionVersion }`. Phase 1 names
the type `CanonicalProjectionVersion`. The in-progress test instead requires
`workflowVersion`, `workflowBuildId`, `canonicalProjectionVersion`, and
`normalizationDigest`.

`workflowBuildId` is also redundant if `workflowVersion` already includes it.

**Impact**

The first implementation can satisfy the test while violating the authoritative
Phase 2 contract, or vice versa. That shape then propagates into all schemas,
CLI, MCP transports, handoff docs, and compatibility tests.

**Recommended disposition: Accept**

Freeze one field vocabulary and exact shape before implementing
`contracts.ts`. Recommended:

```text
{ workflowVersion, normalizationDigest, canonicalProjectionVersion }
```

Remove redundant `workflowBuildId` from the binding, then update Phase 1,
Phase 2, tests, later schemas, and handoff wording consistently.

### 3. Medium — Static bearer auth is not classified against MCP authorization

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-04-add-stdio-and-streamable-http-transports.md:28`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-04-add-stdio-and-streamable-http-transports.md:90`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-04-add-stdio-and-streamable-http-transports.md:94`

The plan implements a pre-shared bearer and returns
`WWW-Authenticate: Bearer`, but never says whether it claims MCP authorization
conformance. MCP authorization is optional; HTTP implementations that support
it should use the OAuth-based specification. Cloudflare clients also support
explicit custom bearer headers, so a private token mode is viable but has a
different interoperability contract.

**Impact**

Generic clients may interpret the challenge as OAuth discovery and fail.
Documentation could incorrectly describe a private pre-shared-token gateway as
standard MCP authorization.

**Recommended disposition: User decision**

Preserve the accepted static bearer only if the product is explicitly
private/managed-client MCP. Label it non-OAuth pre-shared-token authentication,
document manual-header compatibility, and test the intended client. Otherwise
expand scope to OAuth protected-resource metadata and an authorization server.
Do not silently make that scope change.

References:

- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://developers.cloudflare.com/agents/tools/mcp/

### 4. Medium — HTTP protocol-version and valid GET behavior are underspecified

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-04-add-stdio-and-streamable-http-transports.md:30`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-04-add-stdio-and-streamable-http-transports.md:98`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-04-add-stdio-and-streamable-http-transports.md:99`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-04-add-stdio-and-streamable-http-transports.md:119`

The plan freezes negotiation but does not explicitly test
`MCP-Protocol-Version` on subsequent HTTP requests. It tests unauthenticated
GET/DELETE but does not freeze authenticated stateless behavior: valid GET may
return `405`, and sessionless DELETE may return `405`.

**Impact**

The guard layer or SDK upgrade can accept an unsupported/missing protocol
header, or transport behavior can drift without failing parity tests.

**Recommended disposition: Accept**

Add a direct HTTP matrix for valid, missing, malformed, older, and unsupported
`MCP-Protocol-Version`; freeze the intended missing-header fallback. Add
authenticated GET/DELETE assertions for the selected stateless JSON-response
mode.

Reference:

- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

### 5. Medium — MCP CI does not run when committed data fixtures change

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:66`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:68`
- `.github/workflows/mcp-worker.yml:4`
- `mcp-worker/test/domain/legacy-domain-adapter.test.ts:14`

Phase 1 tests read committed `data/*.json`, but the in-progress workflow path
filter includes `.node-version`, `js/**`, and `mcp-worker/**` only.

**Impact**

A data-only pull request can break MCP characterization or later artifact
parsing without running MCP CI.

**Recommended disposition: Accept**

Make the plan require dependency-derived workflow paths, including `data/**`
and any root artifact-manifest/build inputs consumed by MCP gates. Add a small
test or documented list that keeps CI triggers aligned with the semantic/data
closure.

### 6. Medium — Phase 1 change-scope proof ignores untracked files

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:134`
- Current `git status --short`: `.github/` and `mcp-worker/` are untracked.

The review checklist relies on `git diff -- mcp-worker`. Plain `git diff` does
not show untracked files, which are the entire current Phase 1 implementation.

**Impact**

The named scope gate can report an empty diff while all implementation files
remain unreviewed.

**Recommended disposition: Accept**

Require `git status --short`, an explicit untracked-file inventory, and diff
inspection after intentional staging or an equivalent read-only no-index
review. Never treat plain `git diff` as evidence that untracked scope is clean.

### 7. Medium — The “sole exact Node pin” contract has no anti-drift mechanism

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:42`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:69`
- `.node-version:1`
- `mcp-worker/package.json:7`

The plan says root `.node-version` is the sole exact pin, but the in-progress
package duplicates `22.16.0` in `engines.node`. The smoke test checks the
running process against `.node-version`, not equality between all declared
constraints.

**Impact**

The two declarations can drift and produce different local install, CI, and
runtime expectations.

**Recommended disposition: Accept**

Either keep only `.node-version` exact and make `engines.node` a compatible
range, or add a test that derives and validates every Node declaration against
the root pin. State the chosen rule in Phase 1.

### 8. Medium — Completed Astro dependency is still written as an active blocker

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/plan.md:10`
- `plans/260723-2055-mcp-goclaw-image-team-research/plan.md:73`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:253`
- `plans/260723-2127-migrate-static-spa-to-astro/plan.md:4`

The MCP frontmatter correctly has `blockedBy: []` and is `in_progress`, while
its dependency section still says “Blocked by completion” and Phase 2 says the
MCP plan begins only after Astro completes. Astro is already completed.

**Impact**

Execution agents can interpret the prose as an unresolved gate despite the
frontmatter and current repository state.

**Recommended disposition: Accept**

Rewrite this as a satisfied prerequisite with the settled artifacts now reused.
Keep the historical plan link as evidence, not a live blocker.

## Verified strengths

- The cancelled transport-only plan clearly points to the active plan.
- Fresh `McpServer` per HTTP request matches current Cloudflare guidance and
  avoids the SDK 1.26+ cross-client leakage class.
- Streamable HTTP Origin validation, protocol-only stdio stdout, exact tool
  catalog, bounded results, and stateless design align with current protocol
  guidance.
- Free-tier CPU risk remains correctly gated early; current Workers Free CPU
  remains 10 ms/request.
- Two-bucket R2 separation, bucket lock, conditional writes, receipt-bound
  activation, and rollback-CAS design remain supported by current Cloudflare
  capabilities.
- Prior accepted decisions remain intact: no cryptographic human-attestation
  expansion, no GoClaw implementation, no duplicate MCP-only recommendation
  engine, no weakening of R2/rate/release hardening.

## Validation evidence

- `ak plan validate /Users/plateau/Project/CamNangTQCCL/plans/260723-2055-mcp-goclaw-image-team-research --no-interactive` — **pass**.
- `ak plan status ...` — 0/6 phases complete, 0/178 tasks.
- Phase 1 TDD state is red as expected but not implementation-ready:
  - source-graph test passes;
  - contract and adapter suites fail because their `src/domain/*` modules do
    not yet exist;
  - TypeScript reports the same two missing modules.
- The initial audit pass changed no plan or implementation file; the later
  user-approved resolution changed plan files only.

## Implementation follow-up

1. Update the in-progress binding fixture to the accepted three-field shape.
2. Implement `contracts.ts` against the corrected Phase 1/2 contract.
3. Continue the existing Phase 1 TDD gates.

## Unresolved questions

None.

## Resolution — 2026-07-27

User requested the plan be corrected. All eight findings were applied without
changing implementation files:

- `releaseId` is now the full collision-safe workflow/confirmation/cursor data
  identity; compact `dataVersion` is display-only.
- `ConfirmationBinding` is frozen as
  `{ workflowVersion, normalizationDigest, canonicalProjectionVersion }`.
- Existing bearer scope is preserved and explicitly classified as managed-client
  pre-shared, non-OAuth authentication; no authorization-server expansion.
- Protocol-header and authenticated stateless GET/DELETE matrices were added.
- Phase 1 now requires data/root-input CI triggers, untracked-file inspection,
  and Node-pin anti-drift coverage.
- The completed Astro dependency is recorded as a satisfied prerequisite.
- Whole-plan reread covered `plan.md` and all six phase files; stale-contract
  search found no unresolved plan contradiction.
- `ak plan validate --no-interactive` and `git diff --check` passed after the
  edits.
- The in-progress contract test still contains the superseded four-field
  binding fixture. It is intentionally left for implementation because this
  revision was plan-only.
