---
title: "TQCCL research MCP server"
description: "Add a read-only TypeScript research service with local CLI, stdio MCP, authenticated Cloudflare Streamable HTTP, and one future GoClaw skill handoff guide."
status: in_progress
priority: P1
effort: 22d
issue: null
branch: main
tags: [feature, backend, api, infra, tdd]
blockedBy: []
blocks: []
created: 2026-07-23
---

# TQCCL research MCP server

## Overview

Build a separate `mcp-worker/` package with one deterministic research core, local filesystem source, immutable R2 Standard releases, CLI, stdio MCP, and stateless Cloudflare Streamable HTTP. Release data uses separate locked release and mutable pointer buckets so the stage/activate boundary matches capabilities Cloudflare can enforce. This repository owns only the MCP service and its operational documentation. GoClaw, Dewee, skills, image handling, grants, and channel orchestration are external consumers.

## Scope Contract

- **Mode:** HOLD. Deliver the accepted MCP service; no adjacent RAG, memory, crawler, image tool, mutation API, or consumer-platform implementation.
- **In:** eight read-only tools, TypeScript CLI, stdio, authenticated remote MCP, local/R2 parity, Cloudflare/R2 release gates, MCP operations docs, and exactly one non-executable GoClaw skill handoff guide.
- **Out:** implementing or packaging a skill; modifying `.agents/skills/`; GoClaw/Dewee registration, configuration, grants, media, confirmation UI, channels, or canaries; raw image/base64/path in MCP; Vision Worker changes/Turnstile bypass; `worker/src/schema.ts` extraction; `coexist.json` scoring; Python CLI removal.
- **Identity:** SP/CO IDs remain distinct; `familyId` is separate; combined slots are alternatives. Low-confidence or material ambiguity blocks recommendation until confirmed.
- **Ranking:** `T0 > T0.5 > T1`; untiered excluded from meta mode by default and available only with explicit experimental opt-in.
- **Compatibility:** existing browser ES modules remain browser-compatible; changes are additive and protected by characterization tests. Python CLI stays a frozen fallback until later removal.

## Architecture

```text
external agent/skill -> ordered structured observations
 -> tqccl_normalize_entities -> canonical state + normalizationDigest
 -> external agent records user confirmation -> confirmationBinding
 -> workflow-version-bound tqccl_* calls
 -> research handlers -> typed ES-domain adapters -> data snapshot
local: filesystem -> CLI/stdio       remote: R2 manifest -> fresh server/request
```

- One handler set serves CLI and both MCP transports.
- `releaseId` is the full collision-safe digest of the canonical data manifest; compact `dataVersion` is display-only. `workflowVersion` binds `releaseId` to a reproducible `workflowBuildId` derived from the versioned canonical-state projection, runtime schemas, and semantic engine source hashes.
- MCP verifies `confirmationBinding` against the exact canonical projection and workflow. The external agent—not MCP—is the trusted owner of evidence that the user actually confirmed it.
- Remote HTTP uses a managed-client pre-shared bearer header, not MCP OAuth authorization. The service makes no OAuth-conformance claim; generic clients must support explicit custom headers or use a separately owned OAuth gateway.
- `createMcpHandler` creates a stateless request path; only validated snapshot/index cache may be isolate-scoped.
- R2 publication builds a clean-source, content-addressed release, conditionally writes immutable objects to a locked release bucket, verifies one exact candidate Worker version against current and candidate manifests, records an immutable promotion receipt, then ETag-CAS switches `current.json` in a separate pointer bucket. A failed live verification conditionally restores the prior pointer; local source synthesizes the same snapshot contract.
- The service exposes already-prefixed `tqccl_*` names. Consumer-specific prefixing, credentials, grants, registration, and orchestration remain outside this repository.

## Phases and Dependencies

| # | Phase | Status | Depends on | Effort |
|---|---|---|---|---:|
| 1 | [Contracts and characterization](./phase-01-contracts-and-characterization.md) | Completed | — | 2d |
| 2 | [Domain recommendation and provenance](./phase-02-harden-domain-recommendation-and-provenance.md) | Pending | 1 | 4d |
| 3 | [Research tools, data loaders, and CLI](./phase-03-build-research-tools-data-loaders-and-cli.md) | Pending | 2 | 4d |
| 4 | [stdio and Streamable HTTP transports](./phase-04-add-stdio-and-streamable-http-transports.md) | Pending | 3 | 5d |
| 5 | [Publish GoClaw consumer handoff guide](./phase-05-publish-goclaw-consumer-handoff.md) | Pending | 4 | 1d |
| 6 | [Secure MCP release and operations](./phase-06-validate-secure-release-and-operations.md) | Pending | 4 | 6d |

## Acceptance Criteria

- [ ] CLI, stdio, and HTTP call the same eight handlers and produce semantic parity from the same release.
- [ ] Phase 3 runtime schemas are the single public schema authority; all eight tools pass table-driven success and error parity across CLI, stdio, and HTTP.
- [ ] Multi-call flows bind `expectedWorkflowVersion` and `confirmationBinding`; data, canonical projection, schema, semantic engine, or payload changes restart normalize/review/confirm.
- [ ] `workflowVersion`, confirmation verification, and cursors use the full collision-safe `releaseId`; compact `dataVersion` is never an authorization or compatibility identity.
- [ ] Recommendation fails closed on material ambiguity, resource conflicts, invalid/mixed data, or unavailable MCP; no invented team/build.
- [ ] Browser and Vision Worker regression suites remain green; no image bytes/path or Turnstile bypass enters `mcp-worker/`.
- [ ] Remote `/mcp` is TLS-only, bearer-protected on every method, request-scoped, bounded, redacted, and read-only.
- [ ] Tool discovery exposes exactly eight `tqccl_*` names and schemas through both MCP transports.
- [ ] Exactly one implementation artifact documents the future GoClaw skill contract; this repo neither builds nor configures that skill.
- [ ] Immutable R2 release, receipt-bound promotion, current-security-compatible rollback, retention, control-plane evidence, and MCP deployment evidence are documented and verified independently of any consumer platform.

## Cross-Plan Dependencies

- Satisfied prerequisite: `260723-2127-migrate-static-spa-to-astro` is completed. MCP reuses its settled root Node pin, artifact manifest, preview/build/dist/E2E ownership, and documentation source of truth.
- Reuse Astro’s root Node pin, Playwright configuration, `tests-e2e/`, build, dist, and E2E gates; do not create a second browser harness in `mcp-worker/`.
- Astro documentation completes first; MCP Phase 6 then updates the same docs against the migrated source of truth.
- `260723-1950-mcp-dual-transport` remains cancelled/superseded, not a dependency.

## Unresolved Questions

None blocking implementation planning. Exact runtime/protocol pins, result/rate/CPU limits, and R2 rollback-retention window are explicit evidence-based implementation/staging gates. Consumer-platform capabilities are intentionally outside scope.

## Red Team Review

Four lenses reviewed the original broader plan: security/fact checking, failure-mode/flow tracing, assumption/scope auditing, and controller-level contract consistency. The detailed reports and final [adjudication](./reports/red-team-adjudication.md) remain historical evidence. The Session 4 ownership decision supersedes findings and gates that assumed this repository would implement GoClaw or skill lifecycle.

| Outcome | Count | Resolution |
|---|---:|---|
| Pass-1 unique accepted findings | 16 | MCP-relevant corrections retained |
| Pass-2 accepted findings | 12 | MCP-relevant corrections retained |
| Audit accepted findings | 10 | MCP-relevant corrections retained |
| User ownership revision | 1 | Skill and GoClaw execution removed from repo scope |
| User decisions reversed | 0 | Latest ownership decision is authoritative |

Retained corrections include the Node ESM boundary, single ownership of normalization, canonical payload binding, transitive content-derived workflow identity, bounded stale cache, two-bucket and bucket-locked R2 publication, receipt-bound pointer CAS, current/candidate snapshot compatibility, shared Astro browser gates, executable auth/rate/control-plane gates, managed secret rotation, and repository-wide MCP release gates.

### Whole-Plan Consistency Sweep

- [x] One normalization/materiality owner: `tqccl_normalize_entities`.
- [x] Structured observations may enter normalization; only confirmed canonical state enters recommendation.
- [x] Every dependent call is workflow-version- and confirmation-binding-bound; MCP does not claim to prove the human action.
- [x] No raw media/path, Vision Worker schema reuse, Turnstile bypass, crawler, RAG, memory, or mutation tool.
- [x] Eight upstream names remain singly prefixed; consumer prefix configuration is outside repo scope.
- [x] `coexist.json` remains reference-only and Python remains a frozen fallback.
- [x] Implementation creates exactly one GoClaw-related Markdown guide under `docs/` and no skill-package files.
- [x] Astro owns and completes the root Node/browser harness before MCP Phase 1 begins.
- [x] Phase 6 depends on MCP Phase 4, not the advisory GoClaw handoff; Phase 5 may run in parallel and remains required only for whole-plan completion.
- [x] R2 privileges are described honestly: Cloudflare Worker bindings are write-capable, while two buckets, lock policy, credential separation, narrow reader interfaces, and import guards provide the planned boundary.
- [x] Workflow identity covers the verified transitive semantic closure; Phase 3 runtime schemas are the sole public authority reused by all transports.
- [x] Collision-safe `releaseId`, not compact display `dataVersion`, owns workflow compatibility, confirmation, and cursor identity.
- [x] `ConfirmationBinding` uses exactly `{ workflowVersion, normalizationDigest, canonicalProjectionVersion }`; it does not duplicate `workflowBuildId`.
- [x] Static bearer is explicitly managed-client, non-OAuth authentication; OAuth discovery and authorization-server implementation remain outside accepted scope.
- [x] Raw/source text remains tagged untrusted structured data and never enters fixed agent-facing fallback templates.
- [x] Promotion is exact-version, receipt-bound, single-version, source-provenanced, and conditionally auto-rolled back; old-code rollback retains current security configuration.
- [x] `/healthz` is no-I/O liveness, stale serving has a non-extendable deadline, and authenticated verification owns readiness.
- [x] Account controls and token rotation have explicit artifacts, live evidence, expiry/transitions, managed-secret policy, and failure behavior.

## Validation Log

### Sessions 1–3 — 2026-07-23

- Deep TDD planning, two red-team passes, implementation-readiness audit, and structural validation completed.
- Retained MCP decisions: TypeScript; CLI + stdio + Streamable HTTP; Cloudflare deployment; structured-observation-only boundary; canonical binding; content-derived workflow identity; immutable R2 release and rollback.
- Historical GoClaw/Dewee operational research is non-executable context only after Session 4.

### Session 4 — 2026-07-23

- User narrowed ownership: this repository supplies MCP only; GoClaw/Dewee and skill lifecycle are external consumers.
- Replaced in-repo skill implementation and GoClaw staging with one non-executable `docs/goclaw-mcp-skill-handoff.md`.
- Removed consumer registration, grants, media, channel, provider-privacy, and skill rollback from repository release gates.

### Session 5 — 2026-07-24

- Targeted MCP-only red team produced 15 adjudicated findings: 11 accepted and applied, 4 rejected without reversing prior user decisions.
- Applied enforceable two-bucket R2 boundaries, transitive workflow identity closure, single schema authority, all-eight transport parity, non-echo handling of untrusted text, clean-source provenance, receipt-bound promotion and automatic conditional rollback, current-security-compatible Worker rollback, executable control-plane evidence, fixed stale/liveness semantics, and an enforceable token lifecycle.
- Phase 6 now depends directly on Phase 4. The single future GoClaw handoff remains a parallel, non-executable delivery artifact and never gates MCP release.
- Whole-plan reread, stale-contract search, `git diff --check`, and `ak plan validate --no-interactive` passed.
- See [targeted red-team report](./reports/red-team-mcp-only-ownership-260723-2339.md).

### Session 6 — 2026-07-27

- Implementation-readiness audit produced eight findings: two high and six medium; all were accepted and applied to plan files.
- Full canonical-manifest `releaseId` now owns workflow, confirmation, and cursor compatibility; compact `dataVersion` is display-only.
- `ConfirmationBinding` is frozen as `{ workflowVersion, normalizationDigest, canonicalProjectionVersion }` with no duplicate `workflowBuildId`.
- Existing scope decision is explicit: remote authentication is managed-client pre-shared bearer, not MCP OAuth authorization; intended clients must inject the header.
- Added protocol-header and authenticated stateless GET/DELETE matrices, data/root-input CI triggers, untracked-file review, Node-pin anti-drift, and satisfied-Astro prerequisite wording.
- Whole-plan reread covered `plan.md` and all six phases. Stale-contract search found no unresolved plan contradiction; `ak plan validate --no-interactive` and `git diff --check` passed.
- In-progress `mcp-worker/test/domain/contracts.test.ts` still contains the superseded four-field binding fixture and must be corrected during implementation; no code/test file was changed by this plan-only revision.
- See [implementation-readiness audit](../reports/audit-260727-1714-mcp-plan.md).
