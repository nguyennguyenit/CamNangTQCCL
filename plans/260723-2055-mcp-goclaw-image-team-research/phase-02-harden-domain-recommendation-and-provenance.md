---
phase: 2
title: "Harden domain recommendation and provenance"
status: completed
priority: P1
effort: 4d
dependencies: [1]
---

# Phase 2: Harden domain recommendation and provenance

<!-- Astro validation 2026-07-23: decision 3A applied. -->

## Context Links

- [Plan](./plan.md)
- [Phase 1 contracts](./phase-01-contracts-and-characterization.md)
- [Domain scout](./reports/scout-domain-phases-01-02.md)
- [Domain reuse research](./research/researcher-domain-reuse.md)

## Overview

Correct verified identity, ambiguity, similarity, allocation, tier-order, and provenance defects in the shared ES domain modules. Changes remain additive for the browser and are consumed through typed adapters by pure TypeScript normalization and recommendation services.

## Requirements

- Functional:
  - SP/CO canonical IDs are distinct from base forms; `familyId` remains a separate comparison field.
  - Combined artifact slots represent alternatives, never multiple simultaneous requirements.
  - Normalize exact/fuzzy/ambiguous/unmatched observations with runner-up margin and explicit `reviewRequired`.
  - Block recommendation if low confidence or ambiguity can change ownership, locked heroes/tactics, or feasibility.
  - Rank lexicographically by tier before red copies; exclude untiered from meta mode unless `experimentalUntiered: true`.
  - Allocate tactics per hero slot without duplicate heroes/tactics and preserve full owned alternatives throughout portfolio search.
  - Include data-version-ready provenance, tier rankings, warnings, conflicts, trade-offs, and deterministic ordering.
  - Return `workflowVersion`, deterministic `normalizationDigest`, and a `ConfirmationBinding`; MCP validates exact state/workflow binding, while the external caller owns evidence that the user confirmed it.
  - Preserve privacy-safe `observationBatchId`, field-presence provenance, and `sourceScope` so current-turn, prior-note, and manual evidence have explicit precedence.
  - Treat `coexist.json` as reference-only; no fuzzy scoring or guessed join.
  - Treat observation and corpus strings as untrusted data: normalize control characters, clamp lengths, label raw/source fields as untrusted, and never allow them into an agent-facing text template.
- Non-functional:
  - Existing public browser fields remain; new fields/exports are additive.
  - No fixed corpus counts, fabricated URLs/dates, tactic-mechanics claims, transport code, or data I/O.
  - Preserve search bounds; add deterministic performance coverage.

## Architecture

```text
hero-identity.js -> analyze-map.js + team-recommend-engine.js
match-dict.js -> evidence-rich mapper exports
structured observations -> normalization-service -> confirmation gate
canonical-state projection + canonical JSON -> normalizationDigest
caller-confirmed binding + workflowVersion + injected snapshot -> recommendation-service
```

`familyId` may support display/grouping but never substitutes for ownership equality. Tier order is a tuple, not a blended numeric score. Curated tactic alternatives are authoritative; absent mechanics data yields `notEvaluated` warnings.

Canonical state uses a versioned projection before hashing. Strings normalize to Unicode NFC; object keys use RFC 8785/JCS ordering; non-finite numbers are rejected; absent and explicit `null` remain distinct; set-like collections sort by stable canonical ID; semantic team/hero/slot order is preserved. Display labels, raw observations, confidence prose, timestamps, and transport metadata stay outside the digest.

### Source precedence

| Field/evidence case | Rule |
|---|---|
| Field absent in newer source | Does not override an older present value. |
| Explicit `manualCorrection` value | Highest priority, including an explicit `null` deletion marker. |
| Present `currentTurnImage` value | Overrides `priorConfirmedNote`; competing current-image identity/owner/lock values remain conflicts requiring review. |
| `priorConfirmedNote` value | Lowest priority; retained with provenance when no higher source supplies the field. |
| Level/red-copy observations in one priority scope | Use highest supported numeric value; retain all competing evidence and warning. |
| Owned inventory lists | Canonical union after identity resolution; unresolved aliases do not silently merge. |
| Locked/current team membership or tactic holder conflicts | No automatic winner; mark `reviewRequired`. |

## File Inventory

| Action | Absolute path | Rough delta | Test impact |
|---|---|---:|---|
| Create | `/Users/plateau/Project/CamNangTQCCL/js/hero-identity.js` | 80–110 | Single canonical identity/slot authority. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/src/lib/public-artifact-manifest.mjs` | +1 entry | Publish `hero-identity.js` through the Astro-owned route/source manifest. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-js/hero-identity.test.mjs` | 110–150 | SP/CO/family/combined-slot regressions. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/js/match-dict.js` | +30–50 | Add second score, margin, ambiguity/review without removing fields. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/tests-js/match-dict.test.mjs` | +70–100 | Exact/fuzzy/tie/unmatched/traditional evidence. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/js/analyze-map.js` | +40–70 | Full identity, holder-aware tactics, deterministic ties. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/tests-js/analyze-map.test.mjs` | +100–140 | Identity and similarity behavior. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/js/roster-scan-map.js` | +40–70 | Add evidence-rich exports; preserve default SPA shape. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/tests-js/roster-scan-map.test.mjs` | +80–110 | CN/score/margin/review preservation. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/js/roster-scan-state.js` | +30–50 | Identity dedupe, evidence merge, confirmation invalidation/privacy. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/tests-js/roster-scan-state.test.mjs` | +70–110 | Multi-observation merge and edit behavior. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/js/team-recommend-engine.js` | +100–160 | Slots, tuple ranking, late alternatives, per-holder selection, diagnostics. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/tests-js/team-recommend-engine.test.mjs` | +180–250 | Portfolio correctness/performance. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/domain/contracts.ts` | +100–150 | Accepted semantics and result shapes. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package.json` | +5–10 | Add deterministic workflow-build generate/check scripts. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/domain/legacy-domain-adapter.ts` | +70–110 | Consume additive evidence exports. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/domain/normalization-service.ts` | 140–200 | Aggregate observations and gate confirmation. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/domain/canonical-state.ts` | 120–170 | Versioned semantic projection, NFC/JCS serialization, and digest input ownership. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/workflow-source-manifest.json` | 45–70 | Generated/checked transitive semantic closure plus explicit non-semantic exclusions and rationales. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/generate-workflow-build.ts` | 140–200 | Walk actual imports from semantic entrypoints, prove closed-manifest equality, hash the closure, and generate the shared build identity. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/generated/workflow-build.ts` | generated | Reproducible `workflowBuildId`; CI regeneration must be clean. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/domain/recommendation-service.ts` | 180–250 | Pure snapshot-driven match/build/coexist orchestration. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/domain/normalization-service.test.ts` | 180–240 | Evidence merge, ambiguity, privacy. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/domain/recommendation-service.test.ts` | 240–330 | Real-record/provenance/portfolio flow. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-e2e/mcp-domain-compatibility.spec.mjs` | 140–200 | Reuse Astro-owned Playwright/root targets for scan/persist/recommend and analyze/similar-team smoke. |
| Delete | None | 0 | Python CLI and Vision Worker remain unchanged. |

## Function and Interface Checklist

- [x] `canonicalHeroId`, `heroFamilyId`, `heroIdentityKey`, `heroSlotAlternatives`, `normalizeHeroSlot`.
- [x] Prefix parsing applies to the named alternative only; never spreads SP/CO across slash-separated alternatives.
- [x] `matchDict` keeps existing return fields and adds `secondScore`, `margin`, `ambiguous`, `reviewRequired`.
- [x] Evidence-rich mapping exports preserve raw Chinese, normalized text, score, runner-up, dictionary link score, and image ordinal.
- [x] `findSimilarTeams` matches full IDs, counts tactics on the correct holder, and ties by stable team ID.
- [x] `normalizeTeamCandidate` exposes hero slots while retaining compatible `requiredHeroes`.
- [x] `recommendTeams` uses the full owned tactic set at every greedy/DFS branch.
- [x] Ranking tuple: eligible tier rank, hard-conflict count, missing count, red-copy preference, stable ID.
- [x] Meta mode defaults to ranked T0/T0.5/T1 only; experimental opt-in labels untiered and never presents it as meta proof.
- [x] Per-slot selection returns holder ID, slot index, selected tactic, alternatives, reason, and downgrade.
- [x] `normalizeObservations`, `requiresConfirmation`, `applyConfirmedCorrections`, `recommendTeam`, `recommendCoexist`, `suggestReplacements`.
- [x] `createWorkflowBuildId(sourceManifest)`, `createWorkflowVersion(releaseId, workflowBuildId)`, `projectCanonicalState`, `canonicalizeCanonicalState`, `createNormalizationDigest`, `verifyConfirmationBinding`.
- [x] `ConfirmationBinding` is exactly `{ workflowVersion, normalizationDigest, canonicalProjectionVersion }`; it does not duplicate `workflowBuildId`. Normalization may issue the binding, but only the external caller records the later human confirmation action before echoing it to a recommendation call.
- [x] Digest domain separator and projection version are fixed; semantically irrelevant display/provenance fields are excluded by the projection.
- [x] CI regenerates `workflow-build.ts` and fails when schema/semantic source changes without a matching generated build identity.
- [x] The closure gate includes all transitively reachable semantic inputs—at minimum `filters.js`, `hanviet.js`, canonicalization/runtime validators, public runtime schemas, and behavior-affecting compile/build/lock inputs—and fails on missing or unexpected semantic files.
- [x] Files excluded from identity are explicit, non-semantic, and justified; an unresolved/dynamic import fails closed.
- [x] Evidence distinguishes `currentTurnImage`, `priorConfirmedNote`, and `manualCorrection`; per-field presence decides precedence without caller-side merge logic.
- [x] Browser `confirmed:boolean` remains local-only and cannot satisfy or deserialize into MCP confirmation.
- [x] Provenance retains artifact name, record ID, all tier rankings, source labels/dates present in artifacts, and injected data version.

## Dependency Map

```text
Phase 1 contracts
  -> hero identity + matcher evidence
  -> mapper/state additive exports
  -> team similarity + recommendation fixes
  -> TS normalization/recommendation services
  -> Phase 3 handlers
coexist.json -----------------------> reference metadata only
```

Shared JS edits are sequential; do not parallel-edit these files. TypeScript service work begins after accepted JS exports exist.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Roster owns base hero but team needs SP form | Team remains infeasible. |
| Critical | Combined slot owns its second alternative | Slot is satisfied once; no false missing hero. |
| Critical | Best/second name scores are close | `reviewRequired`; recommendation returns typed confirmation-required error. |
| Critical | T0.5 has many red copies vs T0 | T0 stays ahead in meta mode. |
| Critical | Alternative tactic becomes necessary after another team is selected | Full owned set is reconsidered; valid alternative is chosen. |
| Critical | Same tactic or hero would be allocated twice | Candidate/portfolio rejected with explicit diagnostics. |
| High | Tactic name exists but on wrong hero in screenshot/team | No holder-aware similarity hit. |
| High | 157 observed untiered teams | Excluded by default; labeled experimental only on opt-in. |
| High | Team has multiple tier rankings | All rankings and actual source/date fields are returned. |
| High | `coexist.json` display string approximately matches | Returned only as reference; never boosts score or asserts identity. |
| High | Observation edit after confirmation | Confirmation invalidated and recommendation blocked again. |
| Critical | One nested hero/tactic/lock changes after confirmation | Binding mismatch returns `CONFIRMATION_REQUIRED`; no recommendation work. |
| Critical | Same data bytes but schema/semantic engine source changes | Generated `workflowBuildId` and `workflowVersion` change; caller restarts normalize/review/confirm. |
| Critical | `filters.js`, `hanviet.js`, a runtime validator/schema, canonicalizer, or behavior-affecting build input changes | Closure remains exact and `workflowBuildId` changes for every transitive semantic class. |
| Critical | Browser localStorage contains `confirmed:true` | MCP rejects it as no binding; browser state remains backward-compatible. |
| High | Same canonical state arrives with permuted object keys or decomposed Unicode | Versioned projection + NFC/JCS yields the same digest. |
| High | Absent, explicit deletion, conflicting identity, and numeric maxima combine across scopes | Source-precedence table produces the exact golden aggregate and review state. |
| High | Cropped current image omits tactics while prior notes contain them | Field-presence/source precedence retains only supported prior fields and exposes conflicts. |
| High | Observation or corpus label contains control characters or prompt-injection prose | Structured value is bounded and marked untrusted; no agent-facing fallback string echoes it. |
| Medium | Equal candidates under every semantic key | Stable canonical team ID decides ordering. |
| Medium | Performance fixture at search caps | Completes within agreed benchmark without relaxing correctness. |
| High | Astro-built SPA scan result is persisted/rendered; analyze result opens similar teams | Focused real-browser smoke passes with exact legacy-facing shapes. |

## Tests Before

1. Replace temporary defect characterizations with failing accepted-behavior tests.
2. Write identity tests before introducing the helper.
3. Write ambiguity and evidence-retention tests before matcher/mapper changes.
4. Write tier tuple, late-alternative, per-holder, uniqueness, and untiered-policy tests before recommendation edits.
5. Write TS service tests for multi-image observations, confirmation binding, provenance, and reference-only coexist.
6. Write canonical projection/JCS, digest mutation, generated workflow identity, transitive-closure mutation, browser-boundary, and full source-precedence tests.
7. After the Astro plan completes, add the focused browser smoke using Astro preview as the sole root server before changing UI-facing shapes; do not recreate a legacy/root-HTML harness.

## Refactor

1. Implement identity helper; update similarity first, recommendation second.
2. Extend matcher and mapper APIs additively; keep old browser output paths.
3. Update scan-state dedupe and local confirmation invalidation with privacy invariants; preserve browser v1 serialization and keep MCP binding separate.
4. Replace blended ranking with explicit comparator tuple.
5. Pass full owned resource sets through every portfolio branch and retain slot assignments.
6. Wrap corrected exports in pure TS services using injected snapshots; never read files.

## Implementation Steps

1. Run Phase 1 gate and snapshot existing public fields/callers.
2. Add and test canonical/family/slot helpers.
3. Extend normalization evidence and expose new rich mapper functions.
4. Fix similarity identity, tactic-holder matching, and stable tie-break.
5. Fix candidate normalization, ranking, allocation, and diagnostics.
6. Implement the source-precedence table, structured correction application, and confirmation gate.
7. Implement canonical-state projection/NFC/JCS, import-graph-derived workflow build generation, exact closure validation, digest creation, and exact confirmation-binding verification before recommendation.
8. Implement team/build/coexist/replacement services with provenance.
9. Add real-record tests for SP, CO, combined-slot, ranked, and untiered cases.
10. Measure bounded search fixture; keep existing caps unless evidence requires a separately accepted change.
11. Run focused then full regressions and inspect browser contract diffs.
12. Add `hero-identity.js` to the Astro public manifest, then run root build, shared artifact verification, dist contract, and the real-browser scan/recommend and analyze/similar-team smoke through the Astro-owned preview project.

## Tests After

- [x] Multiple observations dedupe by canonical ID while retaining all evidence ordinals.
- [x] Highest supported level/red-copy value retains conflict provenance.
- [x] Manual correction creates auditable `manual` confidence and invalidates stale match evidence.
- [x] Confirmation binding cannot be replayed against modified state or a different workflow version; it is not described as proof of human action.
- [x] Invalid or unconfirmed inputs never reach the recommendation engine.
- [x] Result is bounded, JSON-serializable, deterministic, and free of image/secret fields.
- [x] Existing SPA callers accept additive outputs without UI regression.
- [x] Adversarial raw/source strings remain bounded structured data and are absent from every fixed agent-facing fallback template.

## Regression Gate

```bash
cd /Users/plateau/Project/CamNangTQCCL
node --test tests-js/{hero-identity,match-dict,analyze-map,roster-scan-map,roster-scan-state,team-recommend-engine}.test.mjs
cd mcp-worker && npm run check:workflow-build && npm test -- --run test/domain && npm run typecheck && npm run build
cd .. && npm run build && npm run verify && npm run test:dist
npm run test:e2e -- tests-e2e/mcp-domain-compatibility.spec.mjs
npm run test:node
python3 -m unittest discover -s tests
cd worker && npm test && npm run typecheck
```

## Success Criteria

- [x] SP/CO/base identity and combined alternatives behave exactly as accepted.
- [x] Material ambiguity blocks recommendation until explicit confirmation.
- [x] Meta ranking is tier-first; untiered policy is enforced and visible.
- [x] Portfolio contains no duplicate hero/tactic and returns per-slot builds.
- [x] Every recommendation includes actual artifact/tier provenance and data-version slot.
- [x] Every recommendation verifies the exact confirmation binding and workflow version without claiming proof of human action.
- [x] `coexist.json` never influences scoring or claims an unverified join.
- [x] Browser, Python, Vision Worker, package typecheck/build, and all tests pass.
- [x] `hero-identity.js` is present byte-for-byte in Astro `dist/js/`, and the focused browser smoke uses the Astro preview server.

## Security and Privacy

- Screenshot/corpus text is untrusted data only; strip disallowed controls, clamp it, tag raw/source fields as untrusted, and ignore instruction-like content.
- Never include user/channel IDs unless a pseudonymous evidence label is explicitly supplied.
- No raw screenshot, base64, persisted path, Turnstile token, bearer, or provider key in state/results.
- Clamp collection sizes and strings before similarity/portfolio work.

## Risks and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Additive JS change breaks browser | Characterize callers/fields; focused browser suites after each file. | Revert one additive export/refactor while keeping tests. |
| Identity fix changes recommendations | Golden SP/CO/combined cases and explicit accepted semantics. | Roll back engine call-site, never canonical contract. |
| Search cost grows | Preserve caps and benchmark worst valid fixture. | Revert optimization/refactor; do not weaken uniqueness. |
| Sparse mechanics cause false confidence | Return `notEvaluated` warnings; use curated alternatives only. | Disable replacement suggestion for unsupported record. |

## Next Steps

Phase 3 consumes only the pure services. It must not recreate normalization, ranking, canonical projection/digest verification, source precedence, or replacement logic. The completed Astro plan supplies the settled Node, manifest, preview, build, dist, and E2E contracts.
