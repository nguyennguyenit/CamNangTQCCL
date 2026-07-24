---
title: "Targeted red team: MCP-only ownership revision"
date: 2026-07-23
plan: "260723-2055-mcp-goclaw-image-team-research"
status: "applied"
---

# Targeted red team: MCP-only ownership revision

## Summary

- Scope: current MCP-only master plan and all six current phase files.
- Lenses: Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic.
- Verification tier: Full.
- Reviewer proposals: 33 before deduplication.
- Final adjudicated set: 15 — 1 Critical, 10 High, 4 Medium.
- Final disposition: 11 Accept and applied, 4 Reject retained.
- User decision: option `1`, apply the complete accepted set.
- Plan mutations: master plan and all six phase files updated on 2026-07-24.

## Accepted Findings

### 1. Critical — Planned R2 privilege separation is not enforceable

**Location:** Phase 6 requirements, release contract, security boundary.

**Evidence**

- `phase-06-validate-secure-release-and-operations.md:28`
- `phase-06-validate-secure-release-and-operations.md:34`
- `phase-06-validate-secure-release-and-operations.md:83-86`
- `phase-06-validate-secure-release-and-operations.md:182`

The plan assumes create-only, pointer-only, and read-only principals over one R2 bucket. Native R2 object permissions are bucket-scoped rather than prefix/create-only scoped. A Worker R2 binding exposes object mutation methods; it is not a platform-enforced read-only principal.

**Failure:** A credential or bound Worker can mutate objects outside its claimed role, so the two-step stage/activate trust boundary passes review without existing at the platform layer.

**Proposed fix:** Redesign around capabilities Cloudflare actually enforces. Options include separate buckets plus a narrow activation broker, or an explicitly documented write-capable binding protected by bucket lock, code/import guards, pointer monitoring, and separate deployment credentials. Add forbidden-operation credential tests.

### 2. High — Optional GoClaw guide still blocks MCP release

**Evidence**

- `plan.md:56-57`
- `phase-05-publish-goclaw-consumer-handoff.md:103-107`
- `phase-06-validate-secure-release-and-operations.md:7`
- `phase-06-validate-secure-release-and-operations.md:21`
- `phase-06-validate-secure-release-and-operations.md:178`

Phase 5 says GoClaw absence cannot affect MCP release, but Phase 6 declares `dependencies: [5]`.

**Failure:** A wording or link defect in advisory consumer documentation blocks an otherwise releasable MCP service.

**Proposed fix:** Make Phase 6 depend directly on Phase 4. Phase 5 remains an overall delivery artifact but never a build, deployment, verification, or rollback prerequisite.

### 3. High — Workflow identity does not prove transitive semantic coverage

**Evidence**

- `phase-01-contracts-and-characterization.md:85-91`
- `phase-02-harden-domain-recommendation-and-provenance.md:91-93`
- `phase-02-harden-domain-recommendation-and-provenance.md:113-116`
- `js/match-dict.js:8`
- `js/team-recommend-engine.js:1`

`workflow-source-manifest.json` is manually curated. The plan has no gate proving it includes every transitively reachable semantic dependency, including `filters.js`, `hanviet.js`, runtime validators, and behavior-affecting dependency/build inputs.

**Failure:** A reachable semantic input changes without changing `workflowBuildId`; stale bindings remain valid against changed behavior.

**Proposed fix:** Generate or verify import-graph closure from semantic entrypoints. CI fails when a reachable semantic input is absent. Add mutation tests for each transitive dependency class and explicitly define which dependency/build inputs affect workflow identity.

### 4. High — Candidate promotion protocol is incomplete

**Evidence**

- `plan.md:45`
- `phase-06-validate-secure-release-and-operations.md:27`
- `phase-06-validate-secure-release-and-operations.md:42-49`
- `phase-06-validate-secure-release-and-operations.md:83-89`
- `phase-06-validate-secure-release-and-operations.md:103-110`
- `phase-06-validate-secure-release-and-operations.md:129-135`

Four linked invariants are missing:

1. No executable route verifies the exact candidate snapshot before `current.json` points to it.
2. No immutable receipt binds candidate manifest hash, Worker version, prior pointer ETag, and verification evidence.
3. A post-activation verifier failure does not require immediate conditional rollback.
4. The deployment gate does not explicitly prohibit split/gradual Worker versions during pointer activation.

**Failure:** The wrong or incompatible candidate can be activated, a broken candidate can remain live after verifier failure, or old/new Worker versions can serve different data semantics.

**Proposed fix:** Upload a version without normal traffic, verify that exact Worker version against current and candidate manifests through a version-specific preview/staging path, produce a content-addressed promotion receipt, deploy one version to 100%, activate only from that receipt, then automatically CAS-restore the prior pointer on verifier failure.

### 5. High — Worker rollback is not bound to current security configuration

**Evidence**

- `phase-06-validate-secure-release-and-operations.md:49`
- `phase-06-validate-secure-release-and-operations.md:109`
- `phase-06-validate-secure-release-and-operations.md:134`
- `phase-06-validate-secure-release-and-operations.md:185`
- `phase-04-add-stdio-and-streamable-http-transports.md:85-89`

Restoring a prior Worker may also restore obsolete bearer, Origin, bindings, or rate-limit configuration. Current rollback tests cover semantic results, not current-client access.

**Failure:** An engine rollback succeeds technically but rejects all current clients or points at obsolete resources.

**Proposed fix:** Define rollback as old code plus current compatible configuration unless a full configuration rollback is explicitly authorized. Before every release, canary the retained version against current bearer rotation state, bindings, Origin policy, and rate controls.

### 6. High — Account-level control-plane gates have no executable owner

**Evidence**

- `phase-04-add-stdio-and-streamable-http-transports.md:29`
- `phase-04-add-stdio-and-streamable-http-transports.md:66`
- `phase-04-add-stdio-and-streamable-http-transports.md:90`
- `phase-06-validate-secure-release-and-operations.md:61`
- `phase-06-validate-secure-release-and-operations.md:92`
- `phase-06-validate-secure-release-and-operations.md:133`
- `phase-06-validate-secure-release-and-operations.md:163`
- `phase-06-validate-secure-release-and-operations.md:166`

WAF/rate rules and R2 event notifications are release blockers, but the inventory owns only the Worker config and lock-monitor workflow. It defines no reproducible WAF rule, event-notification rule, Queue/consumer, alert sink, verifier, or external prerequisite owner.

**Failure:** Application deployment passes while required edge limiting or mutation alerts are absent and cannot be reproduced or restored.

**Proposed fix:** Either add explicit infrastructure artifacts and read-only drift verification, or classify each control as an external prerequisite with owner, evidence format, failure behavior, and rollback procedure.

### 7. High — Runtime schemas have multiple authorities and parity is underspecified

**Evidence**

- `phase-01-contracts-and-characterization.md:63`
- `phase-01-contracts-and-characterization.md:73-80`
- `phase-03-build-research-tools-data-loaders-and-cli.md:61-62`
- `phase-03-build-research-tools-data-loaders-and-cli.md:84-91`
- `phase-04-add-stdio-and-streamable-http-transports.md:58`
- `phase-04-add-stdio-and-streamable-http-transports.md:79-83`
- `plan.md:61`
- `phase-04-add-stdio-and-streamable-http-transports.md:114`
- `phase-04-add-stdio-and-streamable-http-transports.md:190`

Internal domain interfaces, handler schemas, and MCP schemas are separately described. Cross-transport parity tests refer to a singular sampled call rather than all eight operations and error families.

**Failure:** CLI accepts a field MCP rejects, or one tool's result/error/pagination adapter drifts while catalog and a sampled call remain green.

**Proposed fix:** Make Phase 3 runtime schemas authoritative and infer internal/public types where practical. Phase 4 registers the same schema objects. Add a table-driven all-eight CLI/stdio/HTTP parity matrix covering success, validation error, workflow mismatch, binding rejection, pagination, and truncation.

### 8. High — Untrusted corpus/observation text can enter agent-visible text output

**Evidence**

- `phase-02-harden-domain-recommendation-and-provenance.md:105`
- `phase-02-harden-domain-recommendation-and-provenance.md:119`
- `phase-02-harden-domain-recommendation-and-provenance.md:231`
- `phase-04-add-stdio-and-streamable-http-transports.md:83`
- `data/teams.json:3-6`
- `data/teams.json:46`
- `data/team-tier.json:3-8`

The plan preserves raw/source text and emits both structured content and a text fallback. “Treat as data” is prose only; there is no non-echo or injection fixture contract.

**Failure:** Prompt-like observation or corpus text is interpolated into agent-facing text and influences an external agent.

**Proposed fix:** Never interpolate untrusted raw/source fields into the text fallback. Normalize control characters, label untrusted structured fields, add adversarial injection fixtures, and make the handoff guide require data-channel handling rather than prompt concatenation.

### 9. High — Release integrity is not bound to source provenance

**Evidence**

- `phase-06-validate-secure-release-and-operations.md:42-46`
- `phase-06-validate-secure-release-and-operations.md:81-89`
- `docs/system-architecture.md:27-37`
- `docs/deployment-guide.md:56-66`

Hashes prove internal consistency of uploaded bytes, not that those bytes came from reviewed repository state. The existing pipeline is not clean-clone reproducible.

**Failure:** A compromised workstation or publisher stages self-consistent malicious JSON; hashes, validation, Worker compatibility, and pointer CAS all pass.

**Proposed fix:** Build releases from an identified clean repository tree in a protected, credential-free build job. Bind the promotion receipt to source tree digest, artifact manifest hash, and review/approval evidence. Use signing only if the deployment threat model requires it.

### 10. Medium — Health and stale-cache time semantics are ambiguous

**Evidence**

- `phase-03-build-research-tools-data-loaders-and-cli.md:81`
- `phase-03-build-research-tools-data-loaders-and-cli.md:124`
- `phase-03-build-research-tools-data-loaders-and-cli.md:150`
- `phase-04-add-stdio-and-streamable-http-transports.md:30-31`
- `phase-04-add-stdio-and-streamable-http-transports.md:121`
- `phase-06-validate-secure-release-and-operations.md:29`

The hard stale deadline has no fixed non-extendable anchor. `/healthz` is called both liveness and readiness without saying whether it touches R2.

**Failure:** Failed refreshes continually extend stale serving, or public health either reports ready while tools fail or becomes an unauthenticated R2 amplification path.

**Proposed fix:** Anchor `serveStaleUntil` to last successful activation or first observed failure and never extend it on failure. Make public `/healthz` constant-time, no-I/O liveness. Put data readiness in the authenticated verifier or protected `/readyz`.

### 11. Medium — Token lifecycle and local secret policy are not executable

**Evidence**

- `phase-04-add-stdio-and-streamable-http-transports.md:85-89`
- `phase-04-add-stdio-and-streamable-http-transports.md:122-124`
- `phase-04-add-stdio-and-streamable-http-transports.md:152`
- `phase-06-validate-secure-release-and-operations.md:35`
- `phase-06-validate-secure-release-and-operations.md:62`
- `phase-06-validate-secure-release-and-operations.md:88`
- `phase-06-validate-secure-release-and-operations.md:183`
- `docs/deployment-guide.md:103-108`

Runtime can validate decoded length but cannot prove CSPRNG provenance. No authoritative `notAfter` state enforces the 15-minute overlap. The plan says secrets never enter files while adding ignore rules for local secret files.

**Failure:** Predictable 32-byte tokens pass startup, next token remains valid indefinitely, or ignored local secrets persist while repository scans report clean.

**Proposed fix:** Generate tokens through a controlled script/secret manager; describe runtime checks honestly as format/length checks. Add explicit overlap expiry and promotion/removal transitions. State that production secrets live only in managed stores; permission-restricted local secret files are exceptional, short-lived, scanned, and cleaned.

## Rejected Proposals

### 12. Reject — Require cryptographic proof of human confirmation

**Evidence:** `plan.md:43`; `phase-02-harden-domain-recommendation-and-provenance.md:114`; `phase-02-harden-domain-recommendation-and-provenance.md:224`.

**Rationale:** This repeats the prior audited concern without new evidence. The accepted threat model explicitly trusts the external caller to own human-confirmation evidence; MCP verifies only exact state/workflow binding and does not claim cryptographic proof. Adding signer/nonces/actor identity would silently expand scope and key management. No reversal recommended.

### 13. Reject — Replace content-derived workflow identity with one manual contract constant

**Evidence:** `plan.md:42`; `phase-02-harden-domain-recommendation-and-provenance.md:113-116`; `phase-02-harden-domain-recommendation-and-provenance.md:151`.

**Rationale:** The prior audit specifically found that manual constants allow semantic drift without invalidation. Retain content-derived identity and fix its transitive-closure gap under Finding 3.

### 14. Reject — Move all shared browser-domain corrections into MCP-only copies

**Evidence:** `phase-02-harden-domain-recommendation-and-provenance.md:73-97`; `js/hero-list.js:6`; `js/analyze.js:7`; `js/roster-recommend-ui.js:4-14`.

**Rationale:** The plan intentionally reuses pure shared domain modules to avoid two recommendation engines. Verified defects affect the shared semantics, and characterization plus browser regression gates protect existing consumers. Copying fixes into MCP would create known divergence. No new evidence justifies reversing that design.

### 15. Reject — Remove R2 lock/monitoring, stale safety, and layered rate controls as premature

**Evidence:** `phase-03-build-research-tools-data-loaders-and-cli.md:78-82`; `phase-04-add-stdio-and-streamable-http-transports.md:29`; `phase-04-add-stdio-and-streamable-http-transports.md:86-90`; `phase-06-validate-secure-release-and-operations.md:28`; `phase-06-validate-secure-release-and-operations.md:92`.

**Rationale:** Earlier evidence-backed reviews established real rollback-integrity, stale-serving, and public-abuse failure modes. The current R2 IAM design must become enforceable, not simply weaker. Likewise, edge abuse protection and bounded in-process work have different owners. Retain these controls, simplifying implementation only where equivalent guarantees remain.

## Adjudication Summary

| Severity | Accept | Reject |
|---|---:|---:|
| Critical | 1 | 0 |
| High | 8 | 3 |
| Medium | 2 | 1 |
| Total | 11 | 4 |

## Applied Decision Deltas

1. Replace fictional R2 roles with enforceable storage/control-plane boundaries.
2. Decouple Phase 6 MCP release from Phase 5 guide.
3. Prove transitive workflow-identity closure.
4. Define a receipt-bound, version-specific, auto-rollback promotion protocol.
5. Keep rollback compatible with current security configuration.
6. Give WAF/event controls explicit artifacts or external owners.
7. Establish one runtime-schema authority and all-eight parity.
8. Constrain untrusted text output.
9. Bind releases to reviewed source provenance.
10. Freeze stale-deadline and health semantics.
11. Make token rotation and local-secret policy executable.

## Application Map

| Finding | Applied in |
|---|---|
| Enforceable R2 boundary | Master architecture; Phases 3, 4, and 6 use separate release/pointer buckets, honest binding capabilities, lock policy, reader interfaces, and mutation guards. |
| Guide dependency | Master phase table; Phase 6 depends on Phase 4; Phases 4–6 state the guide is parallel and non-blocking. |
| Transitive workflow identity | Phases 1–3 and 6 require import-graph closure, explicit exclusions, mutation tests, and CI equality checks. |
| Candidate promotion | Master and Phase 6 require exact no-traffic Worker verification, immutable receipt, 100% single version, force-refresh, and conditional auto-restore. |
| Security-compatible rollback | Phases 4 and 6 separate old code from current secrets/bindings/Origin/rate configuration and prohibit retired-token resurrection. |
| Control-plane ownership | Phases 4 and 6 add a declarative requirements artifact, read-only live verifier, evidence owners, failure behavior, and rollback. |
| Schema/parity authority | Phases 1, 3, 4, and 6 make Phase 3 schemas authoritative and require table-driven all-eight parity. |
| Untrusted output | Phases 2, 4, 5, and 6 require tagged/bounded structured data, fixed non-echo fallback, injection fixtures, and consumer prompt-separation guidance. |
| Source provenance | Phase 6 requires clean-tree credential-free builds and receipts bound to source/artifact/review evidence. |
| Health/stale semantics | Phases 3, 4, and 6 fix the non-extendable monotonic stale deadline and make `/healthz` no-I/O liveness only. |
| Token/local secrets | Phases 4 and 6 add controlled generation, explicit overlap expiry/transitions, managed production storage, ignored/untracked scanning, and cleanup. |

The four rejected proposals remain unchanged: no cryptographic human-attestation expansion, no manual workflow-version authority, no duplicated MCP-only domain engine, and no removal of R2/cache/rate hardening.

## Whole-Plan Consistency Status

Completed on 2026-07-24:

- Re-read `plan.md` and all six phase files after applying the findings.
- Confirmed effort/dependencies are consistent: 22d total; Phase 4 is 5d; Phase 6 is 6d and depends on Phase 4; Phase 5 remains parallel.
- Stale-contract search found no active plan claim for one-bucket create-only/read-only principals, Phase 6 -> Phase 5 dependency, mixed liveness/readiness, sampled-only parity, or unbounded token overlap. Matching phrases remain only in this report’s historical evidence.
- Confirmed the four rejected decisions were not silently reversed.
- `git diff --check` passed.
- `ak plan validate plans/260723-2055-mcp-goclaw-image-team-research --no-interactive` returned `[OK]`.

## Unresolved Questions

None.
