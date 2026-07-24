---
title: "Audit: MCP GoClaw image-team research plan"
date: 2026-07-23
plan: "260723-2055-mcp-goclaw-image-team-research"
status: "resolved"
---

# Audit: MCP GoClaw image-team research plan

## Summary

- Structural validation: pass.
- Audit tier: Full; six phases, repo contracts, cross-plan sequencing, release flow, and current Cloudflare/MCP docs checked.
- Result: 10 findings — 1 Critical, 7 High, 2 Medium.
- Audit-time recommendation: do not start `/ak:cook` until Critical and High findings are adjudicated and propagated through the whole plan. This gate is now cleared by the resolution below.
- Scope preserved: TypeScript, CLI + stdio + Streamable HTTP, Cloudflare, GoClaw-owned vision, eight read-only tools, no RAG/crawler/mutation expansion.

## Findings

### 1. Critical — `ConfirmationProof` proves payload equality, not user confirmation

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:35`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:49`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:94`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:72`

`normalizationDigest` is deterministic and recomputed from caller-submitted state. Any client that can call normalize can replay the returned digest without a human action. The MCP server can verify state binding; it cannot prove the user reviewed or approved it.

**Impact**

Plan overstates the trust guarantee. A buggy or compromised GoClaw orchestration can bypass the intended human-review invariant while passing MCP verification.

**Recommended disposition: Accept**

Choose one honest contract:

1. Recommended: rename to `ConfirmationBinding`; MCP verifies exact state/workflow binding, while GoClaw is the trusted owner of user-confirmation evidence and audit.
2. Stronger: require a trusted GoClaw-signed attestation with actor/session/time/expiry. This expands key management and should be chosen only if the threat model requires cryptographic human-action evidence.

### 2. High — Manual version constants do not guarantee engine/schema changes invalidate workflows

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:74`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:94`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:128`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:58`

`workflowVersion = dataVersion + contractVersion + engineVersion`, but the plan defines no build gate tying `ContractVersion` or `EngineVersion` to the actual schema/normalization/recommendation source. Behavior can change while the constant stays unchanged.

**Impact**

The exact stale-workflow failure the version was added to prevent can still occur.

**Recommended disposition: Accept**

Define a reproducible `workflowBuildId` from canonical hashes of owned schemas and semantic engine modules, or maintain a checked manifest whose expected hash must change with those files. Add a negative CI test: semantic source change without manifest/version update fails.

### 3. High — `normalizationDigest` lacks a canonical serialization contract

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:94`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-03-build-research-tools-data-loaders-and-cli.md:83`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:80`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:83`

The plan specifies canonicalization for `dataVersion`, not for canonical state. It does not define key ordering, array ordering, Unicode normalization, absent versus `null`, numeric encoding, or which provenance/display fields enter the digest.

**Impact**

Equivalent payloads can fail confirmation after JSON round trips; irrelevant display/provenance changes can invalidate confirmation; excluded semantic fields can permit unsafe replay.

**Recommended disposition: Accept**

Freeze a versioned canonical-state projection and canonical JSON algorithm. Add permutation, Unicode, missing/null, numeric, array-order, included-field, and excluded-field golden tests across CLI/stdio/HTTP.

### 4. High — GoClaw research report contradicts the executable tool naming contract

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/research/researcher-goclaw-dewee.md:46`
- `plans/260723-2055-mcp-goclaw-image-team-research/research/researcher-goclaw-dewee.md:62`
- `plans/260723-2055-mcp-goclaw-image-team-research/research/researcher-goclaw-dewee.md:75`
- `plans/260723-2055-mcp-goclaw-image-team-research/research/researcher-goclaw-dewee.md:86`
- `plans/260723-2055-mcp-goclaw-image-team-research/research/researcher-goclaw-dewee.md:177`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:74`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:88`

The linked research instructs `tool_prefix: "tqccl_"`, unprefixed allowlist entries, and an obsolete `tqccl_recommend_coexist_teams` name. Phase 5 requires already-prefixed upstream names, no `tool_prefix`, and `tqccl_recommend_coexist`.

**Impact**

An implementer following the context link can create double-prefixed or undiscoverable tools despite Phase 5 being correct.

**Recommended disposition: Accept**

Mark the old examples superseded in the research report or replace them with the final exact eight-name/no-prefix contract. Keep historical evidence, remove executable ambiguity.

### 5. High — Cross-plan metadata cannot express the documented partial dependency

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/plan.md:10`
- `plans/260723-2055-mcp-goclaw-image-team-research/plan.md:69`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:134`
- `plans/260723-2127-migrate-static-spa-to-astro/plan.md:42`

MCP plan frontmatter is blocked by the entire Astro plan. Prose says MCP Phase 1 may begin, but Phase 1 itself requires Astro’s `.node-version`; Phase 2 waits for Astro Phase 3.

**Impact**

Automation may block too much, while manual execution may start too early. The actual phase-level prerequisites are unclear.

**Recommended disposition: Accept**

Choose one executable sequence:

- Simplest: Astro Phase 1 → MCP Phase 1 → Astro Phases 2–3 → MCP Phase 2 onward; encode this in one coordination plan or phase-level external dependencies.
- Or keep whole-plan blocking and remove claims that MCP Phase 1 can proceed early.

### 6. High — “Old + new workflow version compatibility” conflicts with fail-closed version handling

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-03-build-research-tools-data-loaders-and-cli.md:31`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-03-build-research-tools-data-loaders-and-cli.md:117`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:43`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:100`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:158`

Phase 3 rejects a prior workflow version before domain work. Phase 6 claims a Worker compatible with old and new workflow versions, but no version-dispatch engine, previous schema registry, or retention boundary is planned.

**Impact**

Release acceptance is unimplementable as written or silently expands scope into multi-version engine support.

**Recommended disposition: Accept**

Recommended MVP: require compatibility with current and candidate **data snapshots**, not simultaneous workflow engines. In-flight old workflows receive `WORKFLOW_VERSION_CHANGED` and restart. If zero-restart rollout is required, explicitly add dual-version dispatch, retention duration, tests, and rollback ownership.

### 7. High — Browser `confirmed:boolean` and MCP confirmation are not separated

**Evidence**

- `js/roster-scan-state.js:10`
- `js/roster-scan-state.js:90`
- `js/roster-recommend-ui.js:138`
- `js/roster-recommend-ui.js:220`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-01-contracts-and-characterization.md:35`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:68`

The existing SPA persists and trusts a local `confirmed:boolean`. Phase 2 modifies the same state module while introducing digest-bound confirmation, but never states whether the browser schema remains local-only or migrates.

**Impact**

Implementation may break the frozen v1 storage contract or accidentally treat the weak browser flag as valid MCP confirmation.

**Recommended disposition: Accept**

Name and test two boundaries: legacy `BrowserScanConfirmation` stays backward-compatible; MCP `ConfirmationBinding` is a separate transport-neutral type and never deserializes from browser localStorage.

### 8. High — R2 lock protection omits lock-configuration authority and monitoring

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:33`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:82`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:90`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:221`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:231`

Cloudflare bucket locks prevent object overwrite/deletion, but authorized configuration users can remove the rules. Event notifications cover object create/delete, not lock-rule configuration. R2 account audit logs omit object data operations and the documented operation list does not establish lock-rule audit coverage. See [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [Event notifications](https://developers.cloudflare.com/r2/buckets/event-notifications/), and [R2 audit logs](https://developers.cloudflare.com/r2/platform/audit-logs/).

**Impact**

A publisher/control-plane credential with bucket-config authority can weaken the lock before mutating releases; the planned object-event canary detects the object mutation, not the preceding control failure.

**Recommended disposition: Accept**

Require separate credentials: publisher cannot edit bucket lock configuration; lock administrator cannot publish/activate. Add scheduled lock-policy verification and an explicit response to lock drift. Do not claim event notifications monitor lock configuration.

### 9. Medium — Source precedence is named but not fully specified

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:36`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-02-harden-domain-recommendation-and-provenance.md:95`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:69`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:71`

The plan names `manualCorrection`, `currentTurnImage`, and `priorConfirmedNote`, but does not freeze the total order, tie behavior within one scope, empty/null/delete semantics, or how red-copy/level maxima interact with recency.

**Impact**

Different implementers can produce different canonical state and digest from the same evidence.

**Recommended disposition: Accept**

Add a field-level precedence truth table and golden conflicts for every mutable field. Keep the skill renderer-only.

### 10. Medium — Cloudflare capacity decision occurs too late

**Evidence**

- `plans/260723-2055-mcp-goclaw-image-team-research/phase-04-add-stdio-and-streamable-http-transports.md:206`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:128`
- `plans/260723-2055-mcp-goclaw-image-team-research/phase-06-validate-secure-release-and-operations.md:201`

The current Workers Free CPU limit is 10 ms/request, while the plan hashes/parses six artifacts, builds indexes, validates payloads, and performs bounded portfolio search. The Free/Paid decision waits until Phase 6. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

**Impact**

Transport and cache design may be completed before discovering the selected deployment tier cannot meet cold-start CPU limits.

**Recommended disposition: Accept**

Add a Phase 3/early Phase 4 workerd benchmark spike using production-shaped artifacts and worst-valid recommendation input. The final live measurement remains in Phase 6.

## Verified Strengths

- Correct TypeScript choice for shared Node/Worker contracts.
- CLI, stdio, and Streamable HTTP share one handler layer.
- Current Cloudflare guidance supports stateless `createMcpHandler` with one server per request; the plan matches this. See [Cloudflare handler API](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/).
- Streamable HTTP Origin/auth and stdio stdout/stderr boundaries match the MCP transport specification. See [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
- R2 conditional writes, bucket lock, pointer CAS, hard stale cutoff, and staged activation are directionally sound.
- Raw image boundary, GoClaw-owned `read_image`, exact tool grant, fail-closed ambiguity, and Dewee staging gates are appropriate.
- TDD ordering and repository-wide regression ownership are substantially stronger than the initial plan.

## Validation Result

- `ak plan validate`: pass.
- Structural validity did not clear the semantic findings above at audit time.

## Resolution

All 10 findings were accepted and propagated on 2026-07-23:

- `ConfirmationProof` became honest `ConfirmationBinding`; GoClaw owns human-confirmation evidence.
- `workflowBuildId` is content-derived from a closed semantic source/schema manifest.
- Canonical-state projection, NFC/JCS serialization, included/excluded fields, and source precedence are explicit.
- Linked GoClaw research now uses the exact eight already-prefixed names with no `tool_prefix`.
- MCP waits for full Astro plan completion; no partial scheduling claim remains.
- Rollout compatibility now means current/candidate data snapshots; old workflows restart.
- Browser `confirmed:boolean` remains local-only and cannot become MCP binding.
- R2 lock administration/monitoring/publication/activation/runtime credentials are separated.
- Workerd capacity selection moved to Phase 4; Phase 6 confirms it.

The post-edit whole-plan consistency sweep found no stale executable contract, both MCP and Astro plan directories pass `ak plan validate`, and all local Markdown links resolve. The audit gate is closed.

## Post-Audit Ownership Revision

On 2026-07-23 the user narrowed repository ownership after this audit:

- This repository builds, tests, deploys, verifies, and operates MCP only.
- GoClaw/Dewee, skills, image processing, user-confirmation UX, registration, credentials, grants, channels, and consumer rollback are external.
- The prior in-repo skill implementation phase was replaced by exactly one non-executable handoff artifact: `docs/goclaw-mcp-skill-handoff.md`.
- Consumer-platform staging is no longer an MCP release gate.

The security and data-integrity findings retained in the MCP phases remain resolved. Historical GoClaw findings are non-executable context and do not restore consumer ownership to this repository.

## Unresolved Questions

None. Decisions: trusted-GoClaw payload binding; restart old workflows; separate R2 control-plane and data-plane credentials within the corpus-integrity threat model.
