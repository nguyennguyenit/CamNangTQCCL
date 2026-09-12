# Cùng Tồn — adversarial input and contract review

Date: 2026-09-07. Scope: saved phases 1–2 and relevant current runtime owners. Plan review only; no builds, tests, fetches, runtime/data edits or deployment. Phases 3–4 were excluded while under concurrent edit.

## Findings

No evidence-backed Critical, High or Medium defect remains within this bounded review. This is a review of the specified design, not a claim that its pending implementation is secure or verified.

## Attacks checked and disposition

| Attack / failure | Plan contract and verified source | Disposition |
|---|---|---|
| Reuse legacy parsing to collapse two sources with the same group title | `phase-02-season-team-configurations.md:32,93` requires source-scoped reviewed IDs and a dedicated CSV adapter. Existing `pipeline/parse_coexist.py:100-110` demonstrably indexes only the group label. | Addressed explicitly; preserve the dedicated adapter and reorder/collision tests. |
| Misinterpret J as advisor skill or flatten conditional variants | `phase-02-season-team-configurations.md:95` separates unit-tactic effects and raw coupled bundles. Existing `pipeline/parse_coexist.py:86-94` removes empty book slots and assigns J to `advisorSkill`. Pinned CSV physical lines 169–177 contain the concrete coupled bow/cavalry example. | Addressed; do not reuse legacy cleanup for new raw payloads. |
| Failed import overwrites unrelated curated data | `phase-02-season-team-configurations.md:97` requires candidate validation, staging, failure preservation and rollback, and forbids the general builder. `pipeline/build_json.py:108-123` does write all four legacy outputs. | Addressed with a cause-aligned boundary and isolated failure tests. |
| Forge exact ruleset applicability from the confirmed scenario name | `phase-01-start.md:39-49` distinguishes attribution evidence from reviewed pair; `phase-02-season-team-configurations.md:34,99` forbids ruleset-null applicability and engine promotion. Existing `mcp-worker/src/domain/recommendation-service.ts:206-223` keeps coexist reference separate from scored engine output. | Addressed. User confirmation of Binh Diễn Xuân Thu is retained; no repeated confirmation required. |
| Inline/legacy union confusion or stale positional identity | `phase-02-season-team-configurations.md:23-34` requires discriminated targets, unique legacy fingerprint match, stable reviewed record IDs and revision review. Existing coexist validation at `mcp-worker/src/data/artifact-contracts.ts:187-204` only knows the old nested legacy shape. | New branch validation is correctly owned by the new contract; do not weaken the legacy validator or demand that inline records exist in legacy data. |
| Raw upstream text becomes executable browser markup | Existing `js/render.js:12-14,154-188` uses text nodes for coexist source strings. Source-link precedent `js/render.js:257-263` accepts HTTPS and uses noopener/noreferrer. Phase 2 retains raw strings rather than requiring HTML interpretation. | No current XSS demonstrated. Keep these existing rendering/URL conventions when adding provenance links; do not report arbitrary raw text as an exploit by itself. |

## Considered but not escalated

The inline group owns `configIds[]`, while nested source teams have separate record IDs. This does not itself prove incorrect mapping: the plan explicitly prohibits deriving engine candidates from reference payloads, and canonical configurations have independent reviewed evidence. No requirement in the inspected phases calls for label/position-based automatic binding. If later UI behavior needs per-subteam canonical navigation, require an explicit reviewed binding there rather than guessing.

The inspected plan already preserves five sidecars, immutable legacy bytes and the eleven-artifact v2 design. No demonstrated input-boundary failure requires adding another public artifact.

## Remaining evidence limits

Ruleset attribution, decorated canonical identities and coupled-build relationships remain intentionally unresolved. They block executable configuration promotion, not raw reference intake. Runtime URL rendering and v2 output bounds belong to the concurrently edited consumer phases; this report does not certify those unsaved changes.

Status: DONE
Summary: Verified the saved input/schema/parser/identity/legacy design against current source; no supported severity finding in this scope.
Concerns: Implementation must execute the planned Red/Green failure cases; no tests were run during this review.
