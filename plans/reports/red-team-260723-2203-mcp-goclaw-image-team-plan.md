# Red-team pass 2: MCP + GoClaw image-team plan

Date: 2026-07-23  
Target: `plans/260723-2055-mcp-goclaw-image-team-research/`  
Mode: advisory only; no plan/code changes.

## Resolution

All 12 findings were incorporated on 2026-07-23 into the MCP plan and its bidirectional Astro dependency metadata. The original findings below remain as audit evidence; they no longer represent open plan blockers.

## Verdict

Architecture remains viable, but implementation should not start unchanged. Three Critical contract defects and five High operational/dependency defects remain after the first red-team corrections.

## Findings

### 1. Critical — Confirmation is not bound to the reviewed payload

- Plan: Phase 1 contracts; Phase 2 normalization; Phase 3 `expectedDataVersion`; Phase 5 review flow.
- Evidence: current SPA clears `confirmed` whenever state changes in `js/roster-scan-state.js:46-75`, then recommends from that same state in `js/roster-recommend-ui.js:218-236`. Stateless MCP loses this shared-object invariant.
- Failure: user confirms roster R at data V1; GoClaw modifies one nested hero/tactic/lock while building the request but keeps confirmation and V1; recommendation accepts unreviewed R′.
- Required correction: normalization returns `normalizationDigest = hash(canonicalState, dataVersion, contractVersion)`. Confirmation records that digest. Every recommendation recomputes it and returns `CONFIRMATION_REQUIRED` on mismatch. Test a one-field post-confirmation mutation.

### 2. Critical — Data-version binding does not bind the normalization/engine contract

- Plan: `plan.md` acceptance; Phase 3 `expectedDataVersion`; Phase 4 stateless deployment; Phase 6 Worker rollout.
- Failure: normalize under Worker build A and data V1; deploy build B with different canonicalization/ranking but unchanged artifacts; recommendation sees expected V1 and proceeds under B.
- Required correction: expose a stable `contractVersion`/`engineVersion` and bind dependent calls to an opaque `workflowVersion` combining data version, normalization schema, and engine contract. Return `WORKFLOW_VERSION_CHANGED` and restart review when any component changes.
- Time risk: implementation overlaps the upcoming MCP SDK/spec transition. Freeze and assert the negotiated protocol version rather than silently changing SDK generation.

### 3. Critical — Phase 5 still says MCP accepts canonical observations only

- Plan: `phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:21,27-28,67-71,186`.
- Evidence: `js/roster-scan-map.js:4-20` needs dictionary matching before OCR text becomes canonical.
- Failure: implementer follows success criterion line 186 and blocks noncanonical OCR before `tqccl_normalize_entities`, recreating the canonicalization deadlock/dual ownership fixed earlier.
- Required correction: state: “MCP receives structured observations only; unconfirmed observations may enter normalization; recommendation tools receive only confirmed canonical state; raw media/path never enters MCP.”

### 4. High — New Astro plan creates an unrecorded phase dependency

- Plan: MCP `plan.md` says no cross-plan dependencies. MCP Phase 2 creates its own browser harness.
- Evidence: `plans/260723-2127-migrate-static-spa-to-astro/plan.md:42` says MCP shared `js/` edits must wait for Astro Phase 3 and consume its build/dist/E2E gate. Astro owns root Playwright, `.node-version`, package lock, deletes `index.html`, and both plans edit shared docs.
- Failure: duplicate Playwright ownership, smoke test targets deleted static entry, concurrent `js/` edits, or release with broken Astro build.
- Required correction: record phase-level dependency on Astro Phase 3; reuse root E2E and Node pin; include Astro build/dist/E2E in `check:repository`; serialize both documentation phases.

### 5. High — R2 rollback objects are not immutable at the storage layer

- Plan: Phase 6 relies on conditional publication, import guards, and account audit/alerting.
- Evidence: an R2 binding grants read/write capability. R2 audit logs omit object data operations such as `PutObject`; import guards cannot prevent a dependency from calling the binding dynamically. Cloudflare bucket locks prevent overwrite/deletion by prefix.
- Failure: runtime defect or operator deletes/overwrites `releases/<version>/`; rollback target disappears without the audit evidence claimed by the plan.
- Required correction: production gate verifies a bucket-lock rule on `releases/` for the rollback/retention window; keep `current.json` outside the locked prefix. Add object event notifications and a lock-policy canary.
- Sources: [R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [R2 audit-log coverage](https://developers.cloudflare.com/r2/platform/audit-logs/), [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

### 6. High — Public `/mcp` has no abuse-rate or concurrency enforcement

- Plan: Phase 4 bounds one request but defines no request-rate, concurrency, or `429` contract.
- Failure: invalid-bearer traffic still invokes the Worker and can consume quota; leaked bearer drives repeated R2/domain work and cost.
- Required correction: edge/WAF rate rule before Worker where available; post-auth limiter keyed by a non-secret token fingerprint plus concurrency ceiling before R2/server construction. Test `429`, recovery, and zero body/R2 work when limited.
- Source: [Cloudflare Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

### 7. High — Phase 6 dependency map still deploys in the unsafe order

- Plan: Phase 6 architecture correctly deploys an old/new-compatible Worker before pointer CAS, but `phase-06...md:94-98` still says publish/switch pointer, then deploy Worker.
- Failure: executor follows the dependency map and exposes a candidate schema to incompatible live code.
- Required correction: make every phase section use one order: build/verify immutable objects → deploy compatible Worker → CAS pointer → live verify → GoClaw canaries.

### 8. High — Observation precedence is not representable in the envelope

- Plan: Phase 5 says current-turn evidence overrides stale notes only for observed fields, but envelope has ordinal/confidence only.
- Evidence: current skill reads previous notes (`.agents/skills/tqccl-coexist-team-builder/SKILL.md:43,53`); current scan state has only global `updatedAt` (`js/roster-scan-state.js:85-92`).
- Failure: cropped current image omits tactics while stale notes contain them; normalizer cannot distinguish omission from observation or determine field-level precedence.
- Required correction: add privacy-safe `observationBatchId`, `sourceScope` (`currentTurnImage`, `priorConfirmedNote`, `manualCorrection`), and field-presence provenance. Keep precedence solely in normalization.

### 9. High — Minimum Node gate is declarative, not executable

- Plan: Phase 1 claims Node 22.12+ proof via `test:node-min`.
- Evidence: current runtime is Node 24.14.0; repository has no current `.node-version`/CI job. Astro plan separately owns the future root `.node-version`.
- Failure: npm script runs on Node 24 and falsely certifies the Node 22.12 sibling-ESM boundary.
- Required correction: reuse Astro’s exact Node 22 pin and CI/runtime manager; gate must assert actual runtime and execute the adapter import smoke under that binary.

### 10. Medium — Failed R2 refresh may serve stale data indefinitely

- Plan: Phase 3 has bounded refresh age but retains the old valid snapshot whenever refresh fails; no maximum stale-on-error duration.
- Failure: corrupt/revoked V2 pointer causes permanent serving of cached V1.
- Required correction: separate `refreshAfter` and `serveStaleUntil`; after the hard stale deadline return `DATA_UNAVAILABLE`. Test repeated failure across the deadline.

### 11. Medium — Bearer strength and overlap lifetime are unspecified

- Plan: comparison and rotation exist, but generation entropy, accepted length/format, overlap deadline, and fingerprint method do not.
- Failure: human token remains guessable; indefinite dual-token overlap expands exposure.
- Required correction: CSPRNG token with at least 256 bits; startup validation; explicit overlap expiry; record only keyed or safely truncated fingerprints.

### 12. Medium — GoClaw server enable/disable lifecycle is untested

- Plan: tests grant revoke, token rotation, and skill rollback, but not the independent MCP server `enabled` state.
- Failure: disabled/bad server leaves pooled tools visible or fails to recover after re-enable.
- Required correction: independent drill: enable/call → disable → poll catalog omission and execution denial → re-enable → reconnect/discover/call.

## Confirmed sound

- TypeScript remains the better primary implementation choice.
- CLI, stdio, and Cloudflare Streamable HTTP can share one handler registry.
- Fresh `McpServer` per HTTP request matches current Cloudflare guidance and SDK 1.26+ safety requirements.
- GoClaw owning image bytes while MCP receives structured observations remains the correct trust boundary.
- SP/CO identity, combined alternatives, tier-first ranking, reference-only coexist data, and frozen Python fallback remain coherent.

## Recommended disposition

- Block implementation until Findings 1–4 are incorporated.
- Findings 5–9 must block the relevant R2/HTTP/Phase 2 release gate.
- Findings 10–12 must be closed before production staging approval.

## Unresolved questions

1. What exact Astro phase/status is authoritative when MCP Phase 2 begins?
2. What contract-version policy triggers a forced user re-confirmation?
3. What R2 retention window and bucket-lock policy are acceptable operationally?
4. Which Cloudflare plan/WAF controls are available for pre-Worker rate limiting?

Status: DONE  
Summary: 12 findings were accepted and integrated into the plan.  
Concerns/Blockers: None at plan level; implementation and production gates remain explicit in the phases.
