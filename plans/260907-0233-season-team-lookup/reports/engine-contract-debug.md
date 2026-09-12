# Engine contract diagnosis

Date: 2026-09-12. Read-only diagnosis for phase 2; no implementation edits. Line numbers refer to source inspected during this run.

## Verified result

The current legacy engine cannot safely accept multiple seasonal configurations sharing canonical `team.id`. A minimal in-memory probe reproduced all three failures:

- Two records `same-team/cfg-a` and `same-team/cfg-b`, disjoint heroes, tier rows T0/T1: **both records become T1 and both enter portfolio**, in greedy and full-box modes.
- With `maxTeams:1`, cfg-a selected but `prunedCandidates:[]`: cfg-b disappears from diagnostics.
- Out-of-corpus locked team passed unchanged retains its hero reservation and blocks a conflicting candidate. This behavior already works; preserve it in the seasonal adapter.

The probe uses one hero per synthetic candidate to isolate identity mechanics, not as accepted runtime data. Existing baseline remains green: `node --test tests-js/team-recommend-engine.test.mjs` **22/22**; `npm test -- test/domain/recommendation-service.test.ts test/domain/legacy-domain-adapter.test.ts` from `mcp-worker` **24/24**. These do not test seasonal behavior.

## Identity change locations

| Owner / line | Current behavior | Seasonal branch contract |
|---|---|---|
| `js/team-recommend-engine.js:46–48` | tier map keyed by `entry.teamId`; later row overwrites earlier | Key by validated candidateKey/configId; preserve canonical teamId alongside |
| `:91–92` | lookup `team.id`, choose historical best tier | lookup config key; projector supplies one effective reviewed ranking, or empty list for unresolved/default conflict |
| `:109`, `:119` | ranking tuple and comparator end in team.id | deterministic candidateKey tie-break; legacy keeps team.id |
| `:262–280` | makeEntry emits team/tier/assignments, no config identity | carry configId/candidateKey/context separately; keep `entry.team.id` canonical |
| `:387–399` | greedy checks only resource overlap | explicitly exclude a candidate whose canonical team is already selected/locked |
| `:447–477` | recursive search also lacks team exclusion | enforce same invariant on each recursive branch; skip branch remains available |
| `:572–605` | missing/conflict diagnostics identify only teamId | retain teamId and add configId/candidateKey for each candidate |
| `:573–599` | blocked entries carry team/tier only | carry config identity and scope too |
| `:636–645` | selected lookup uses team.id, hides sibling configs | compare candidate identity for selection/pruning; do not deduplicate diagnostics by canonical team |
| `recommendation-service.ts:159–185` | output rebuilds team/provenance from teams.json + team.id | emit config/context/evaluation provenance explicitly; do not replace canonical record ID with config ID |
| `recommendation-service.ts:241–251` | replacement lookup finds first team.id, then first tactic name after flattening holders | resolve exact config or return ambiguity; validate holderId + slotIndex before choosing a slot |

Use a single identity helper in engine for branch selection, not ad-hoc ID rewriting. The projector must establish seasonal mode from validated context; arbitrary extra artifact fields must not silently switch legacy behavior. Same-team mutual exclusion uses canonical team ID; candidate lookup/index/tie-break/diagnostic identity uses config key. These are intentionally different comparisons.

## Locked resources

`lockedEntry` (`:284–337`) and `addEntry` (`:339–348`) already reserve canonical hero IDs and both tactic assignments/flat tactic IDs. Seeding (`:512–550`) is independent of candidate corpus. `recommendation-service.ts:130–142` currently passes locks from canonical state, which is correct.

Seasonal filtering must apply to candidates only. Out-of-scope lock remains in portfolio/resource seed, gets an explicit warning, and cannot become an in-scope recommendation. Initialize canonical-team exclusion from retained locks as well, so a disjoint alternative configuration of the same team cannot sneak in. Preserve existing keepExistingTeams behavior and existing conflicting-lock policy: both conflicting locks are rejected (`:527–547`), covered by engine test at line 165. Do not redesign lock policy in this slice.

`contracts.ts:109–113` is the simpler roster type; service actually consumes `CanonicalState` and `CanonicalLockedTeamState` in `canonical-state.ts:34–50`, including tacticAssignments. Adding fields only to contracts.ts will miss the active service path. Context added outside the canonical projection will not enter current confirmation digest (`canonical-state.ts:158–189`); phase 4 must bind scope deliberately.

## Selection and source score

There is currently **no sourceScore, selectionFingerprint, book-slot, or requirements handling** in the engine/service/adapter inspected. This is a missing feature seam, not an existing source-score invalidation implementation.

Actual choices are produced by `assignHeroes` (`:150–172`) and `selectTactics` (`:184–258`). A late portfolio conflict can switch tactic alternatives during `buildCandidate` inside greedy/search, after the initial eligibility probe. Therefore validate sourceScore against the **final entry selections**, never copy candidate score at normalization or initial eligibility. The engine's numeric `score` (`:279`) remains an internal ranking measure, unrelated to SGSDeck.

Shared result projection can compare final holder-aware hero/tactic selections plus config-carried books/unit/mandatory conditions against the reviewed selection fingerprint. Any unknown or changed component yields `sourceScore:null`. Preserve the original reviewed score only for the exact scored selection. Test alternate hero, alternate tactic, holder swap, book change and unit/condition change. Card source score for the original configuration must be labeled separately from the recommendation's selected alternative.

`hero-identity.js:68–99` splits slash-delimited display names and derives slot ID from alternatives. For seasonal configs, preserve reviewed canonical ordered slots; do not send unreviewed coupled source text into this legacy splitter or strip advisor conditions through name cleanup (`:15–16`). Canonical IDs stay variant-specific; never use familyId as the resource identity. Repeated/ambiguous holder shapes should fail validation rather than be assigned by display string.

## Adapter, limits and tests

- `legacy-domain-adapter.ts:103–117` structured-clones input and JSON-round-trips output. Plain config metadata survives if emitted; function callbacks do not pass this boundary. `:329–370` validates current entry fields but does not validate new seasonal metadata: extend bounded contracts where seasonal data enters/exits.
- Service `:119–120` slices 500 teams/1,000 tier rows before engine. Retain this only for no-context legacy. Seasonal projector must first validate/filter requirements + scope + policy, then reject 501 executable configs, and pass the complete ≤500 set without another prefilter slice. Diagnostics/counts should match browser.
- Separate existing engine search heuristics from the new projector input cap: candidatePool slices 60/80 at `:129`, full-box search 60 at `:414`, search budget 250,000 at `:449`. These are existing behavior, not proof of exhaustive optimization over 500 candidates. Do not silently expand them as part of ID migration; record any proposed search-policy change separately.
- Preserve legacy tests for locks/holders (engine lines 41–185), variant assignment (249, 282, 321, 348), historical tier-first ranking (377, 403), untiered opt-in (448), late alternatives (474), team-ID stable tie (528). MCP adapter tests 116–180 assert SP/CO, combined slots, historical multi-ranking and holder-aware output; service tests assert confirmation, locks and reference-only Cùng Tồn.
- Add Red cases: same team/same pair/two configs distinct tier+tactic; reversed input keeps config tie order; one selected sibling remains in pruned diagnostics; greedy and full-box choose at most one config per team; out-of-scope lock reserves resources and emits warning; final alternative invalidates source score; scenario-only/invalid never calls engine; 500 vs 501 cap; no-context output deep-equals baseline.

Concerns: implementation and seasonal tests remain outstanding. No public input schema or transport code changed in this diagnosis. No unresolved user decision required.
