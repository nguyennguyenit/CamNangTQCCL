# Cùng Tồn plan review — failure modes and contract verification

Reviewed 2026-09-07, PLAN ONLY, `--deep --tdd`. Read the finalized plan index, all four phases, integration research, and the actual browser/render/recommendation/handler owners. No builds, tests, implementation, source fetches, or runtime/data changes performed.

## High — reference projection can exhaust the existing node budget before the byte budget is reached

**Plan:** `phase-04-mcp-and-release-validation.md:71–73` promises bounded nested team/hero output, retaining two tactic slots and three book slots, with truncation driven by the 64 KiB response ceiling and the existing helpers. Its matrix at lines 100–103 covers shape and oversized payloads but does not cover the separate structural budget.

**Actual consumer:** `mcp-worker/src/research/research-handlers.ts:103–113` gives `boundedJson` only 180 nodes and substitutes `null` after exhaustion. Lines 576–591 share this same state across recommended teams, coexist references, then diagnostics. Thus ordinary team recommendations consume the reference budget first. `fitResultSize` at lines 156–180 only removes top-level array entries after measuring bytes; it cannot repair nodes already replaced with null. The current reference output expects records (`mcp-worker/src/research/research-contracts.ts:684–688`), not null entries.

**Concrete failure:** the accepted 5 groups / 25 teams / 75 heroes already exceed 180 nodes with just one hero object, one name string, and one tactic array per hero (225 nodes), before any actual tactic strings, books, groups, provenance, or recommendations. A richer projection therefore loses slots, IDs/categories in later records, or entire records even when the response is below 64 KiB. If earlier recommendations consume the budget, the reference array itself can become null. A strict v2 consumer then either rejects the shape or receives an unusable reference despite successful domain resolution. A generic `truncated: true` cannot turn null records into the promised valid bounded projection.

**Bounded fix:** specify a seasonal-only, shape-aware projection at the handler boundary. Reserve mandatory record ID, source and attribution/applicability fields; truncate complete optional records/teams or bounded strings while preserving the declared output schema. Account explicitly for structural and byte budgets, and propagate any domain-level truncation. Preserve the legacy/no-context helper path. Do not globally raise limits. Add Red cases for the actual 5/25/75 shape both with an empty portfolio and a nonempty portfolio, assert output-schema validity, preserved IDs/categories and ordered slots for retained teams, honest truncation, and a response within 64 KiB. Include a below-64-KiB fixture that exceeds 180 nodes, since byte-only tests miss the failure.

## Cross-file ambiguities to reconcile

- `phase-03-season-lookup-interface.md:47` states that a valid scenario URL without ruleset is reference-only; lines 34 and 82 auto-select the sole reviewed ruleset. Specify whether this auto-selection occurs only after an explicit selector action or also during URL hydration. Otherwise the same scenario-only URL can mean either reference-only or gameplay-ready depending on consumer implementation. A bounded clarification plus URL hydration test is sufficient; no new selector is needed.
- Historical integration advice at `reports/coexist-integration-research.md:63` says a scenario-only transition must never overwrite a valid confirmation binding, whereas finalized phase 3:82 requires scope changes to invalidate the old confirmation. Preserve inventory, but treat old binding as unusable immediately; mark that historical sentence superseded so an implementer does not preserve authorization across scope changes. The actual browser currently has only a persistent `confirmed` boolean (`js/roster-recommend-ui.js:137–138,218–226`), making this distinction operationally relevant.

## Verified decisions — no additional finding

- Phases 2:99, 3:82–91 and 4:67–69 consistently distinguish scenario-only web browsing from a reviewed effective pair; no new MCP input is needed. Null ruleset is reference-only rather than a wildcard. Unknown legacy records remain accessible through all-reference and excluded from scoped results.
- Phase 2:23–34 defines an explicit target union, stable source identities independent of row order/fingerprint, and branch-specific validation. This addresses the existing label-only renderer (`js/render.js:173–188`) without rewriting legacy bytes.
- Phase 3:93 explicitly replaces the current append-once mount (`js/app.js:93`) and preserves source fields. Its state matrix and stale-result tests already address stale context and accidental legacy gameplay fallback; these are not new findings.
- Phase 4:69–71 intentionally preserves the existing no-context reference projection even though it loses real corpus fields (`recommendation-service.ts:211–220`). Fixing that projection globally would reverse an explicit compatibility boundary; the useful new projection must remain seasonal/v2-specific.

Status: DONE_WITH_CONCERNS
Summary: One consequential handler-boundary failure remains in the plan: the shared 180-node projection cap can destroy the promised nested reference output before the 64 KiB ceiling. Two small state-contract ambiguities should be reconciled before implementation.
Concerns: Resolve structural projection/truncation and URL auto-selection precedence; clarify invalidation wording in historical integration advice. Ruleset evidence remains pending by design.

## Resolution addendum — 2026-09-07

Reread updated phase 4:73–75. The original High finding is **addressed at the plan level**: seasonal v2 now uses a schema-aware projector without another generic boundedJson pass, preserves mandatory IDs/category/source/summary, truncates whole optional teams/groups, reports summary-only/omitted groups, and checks final schema integrity under the unchanged 64 KiB ceiling. The 5/25/75 plus portfolio fixture and explicit node/depth accounting target the demonstrated failure. Legacy projection remains unchanged. This is plan acceptance, not evidence that runtime behavior has been fixed or tests passed.

Controller is separately clarifying URL auto-selection precedence and superseding historical binding wording; those edits were not part of this bounded follow-up verification.

Status: DONE
Summary: Original High projection finding resolved in the updated plan; no further change requested for that finding.
Concerns: Implementation must still prove the specified Red/Green cases. No tests/builds executed in this review.
