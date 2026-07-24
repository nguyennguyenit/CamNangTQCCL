# Red-team adjudication

Date: 2026-07-23

All 18 reported findings were reviewed. Two R2 immutability findings and two normalization-flow findings were duplicates across lenses, leaving 16 unique findings. All 16 were accepted and incorporated without reversing a user decision.

| Area | Resolution in plan |
|---|---|
| Node ESM boundary | Phase 1 pins Node 22.12+ and adds a minimum-runtime gate. |
| Dirty worktree | Phase 1 uses a recorded baseline and path-scoped diff. |
| Browser compatibility | Phase 2 adds a focused real-browser SPA smoke. |
| Normalization ownership | Phase 2 owns merge/materiality; Phase 5 only orchestrates extraction and review. |
| Cross-call consistency | Phases 2–3 bind dependent calls to `expectedWorkflowVersion`; recommendation additionally verifies the exact `ConfirmationBinding`. |
| Cache concurrency | Phase 3 adds bounded single-flight refresh and pointer-aware CAS. |
| Request authentication | Phase 4 authenticates before body consumption/parsing. |
| R2 immutability | Phase 6 uses create-only conditional writes and identical-retry checks. |
| Pointer race | Phase 6 uses ETag compare-and-swap. |
| Runtime R2 capability | Phase 6 acknowledges the write-capable binding and adds mutation/import guards plus audit controls. |
| Version reproducibility | Phase 6 defines a canonical digest excluding timestamps and environment metadata. |
| Rollout compatibility | Phase 6 deploys a Worker proven against current and candidate data snapshots; prior workflows restart on version change. |
| Secret hygiene | Phase 6 adds ignore rules and a tracked-secret gate. |
| Provider privacy | Phases 5–6 add production-blocking provider approval and deletion/redaction canaries. |
| Release regressions | Phase 6 adds one repository-wide blocking gate. |
| GoClaw recovery | Phases 5–6 define grant/revoke/re-grant and dual-token rotation state transitions. |

Whole-plan consistency and structural validation passed after the corrections. Remaining version, capacity, GoClaw/Dewee capability, and retention questions are explicit implementation/staging gates rather than unresolved architecture decisions.

## Pass 2

The later 12-finding review in `plans/reports/red-team-260723-2203-mcp-goclaw-image-team-plan.md` was accepted in full. It added workflow/digest binding, sourced field provenance, hard stale cutoff, token strength, rate limits, R2 bucket locks, GoClaw server lifecycle tests, safe release ordering, and the bidirectional Astro dependency.

Status: DONE
Summary: Sixteen pass-1 findings and all 12 pass-2 findings were accepted and corrected; the deep TDD plan has no remaining internal red-team blocker.
Concerns/Blockers: The entire MCP plan remains blocked until the Astro plan completes. Production rollout remains gated by the evidence checks already recorded in Phases 5–6.

## Audit follow-up

The subsequent 10-finding audit was accepted in full. It replaced human-proof overclaims with trusted-GoClaw payload binding, tied workflow identity to semantic source hashes, fixed canonicalization and source precedence, removed stale prefix/rollout instructions, separated browser/MCP confirmation, hardened R2 lock authority, and moved capacity selection earlier.
