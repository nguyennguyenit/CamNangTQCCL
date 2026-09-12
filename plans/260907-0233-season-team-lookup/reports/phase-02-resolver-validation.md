# Shared seasonal resolver API and validation

Date: 2026-09-12. Status: assigned resolver/engine implementation complete; focused checks Green. No full build run while parallel artifact owners are working.

## Consumers

`js/season-context.js` exports the following; import directly in browser and MCP. Never reconstruct eligibility, score matching or candidate limits in consumers.

| Export | Result / usage |
|---|---|
| `validateSeasonBundle(data)` async | Validates all data/cross references/hashes, clones and deeply freezes. Returns `{data}`. Invalid input throws `SeasonContextError` with fixed code `SEASON_BUNDLE_INVALID` and public-safe message. |
| `resolveBrowseState(model,selection={},options={origin:'restore'})` | `{kind,scenarioId?,rulesetId?,seasonContext:null\|pair,diagnostics:[]}`. Kinds: all-reference, scenario-reference, verified-pair, invalid. Only origin `scenario-change` may auto-select sole reviewed rule. |
| `resolveSeasonContext(model,pair)` | `{ok:true,context:pair}` or `{ok:false,code,message}`. Exact reviewed pair only. |
| `projectSeasonBrowse(model,browseState)` | `{applicable,scenarioReference,unknown,coexist:{applicable,scenarioReference,unknown},diagnostics}`. Arrays contain display models described below. Invalid state yields empty groups + diagnostic. |
| `projectSeasonCandidates(model,pair,policy={})` | Success `{ok:true,seasonContext,teams,teamTier,diagnostics,limits:{maxCandidates:500,candidateCount}}`; failure `{ok:false,code,message,teams:[],teamTier:[],diagnostics,limits?}`. Policy `experimentalUntiered`, `mode:'meta'\|'all'`, `lockedTeams?`. Mandatory unsupported conditions always exclude. |
| `resolveTeamConfig(model,{teamId?,configId?,context})` | `{ok:true,config,team,evaluation}`; failure `{ok:false,code,message,choices?}`. Ambiguity choices `{kind:"team-config",teamId,configIds,totalCount,omittedCount}`; IDs sorted by Unicode code point, maximum 20. Does not choose first matching canonical team. |
| `selectionFromEntry(model,entry)` | Final complete actual selection or null. Reads holder-aware engine assignments and fixed unambiguous config units/books; unresolved requirements/bundles/options return null. |
| `resolveSelectionScore(model,configId,actualSelection)` | Original validated sourceScore object or null. Compare after final portfolio selection, not candidate eligibility. |
| `canonicalSeasonJSON(value)` / `seasonFingerprint(value)` async | Canonical JSON / `sha256:<hex>`. Safe integer-only numbers in fingerprint payload; floating original score excluded. |
| `configFingerprintProjection(config)` / `contentFingerprintProjection(value)` | Shared exact projections matching Python validator. |
| `compareSeasonIds(left,right)` | Unicode code-point comparator shared with seasonal engine tie-break and ambiguity IDs. |
| `SeasonContextError` | Public-safe validator error type. |

Input `data` accepts **exactly** these filename-without-extension keys, all arrays: `season-registry`, `season-evidence`, `season-team-configs`, `season-team-evaluations`, `season-content-links`, `teams`, `coexist`, `heroes-dict`, `tactics`, `books-dict`. No network/loading/hash-manifest responsibility in resolver; consumer verifies whole artifact-byte generation before bundle activation. `model.data` exposes validated arrays for search/capability consumers; internal indexes cannot be mutated externally.

Selection input uses omitted keys for no context / scenario only. Explicit `null`, empty/unknown IDs or invalid pairs are rejected, never interpreted as missing context. URL adapter should omit genuinely absent query keys; it must not discard present invalid keys. No preferences are read by this module.

## Display and engine shapes

Config display: `{configId,candidateKey,teamId,config,team,evaluation,tier:null|string,sourceScore:null|object,requirementResults,seasonContext}`. Team follows legacy team shape for render/filter compatibility, with canonical `id` unchanged, separate `configId/candidateKey`, projected variant-specific heroes/tactics/books and `unitType`. Requirement result `{requirementId,supported:false,status:'unknown',reason:'unsupported-requirement'|'unreviewed-requirement'}` is computed, never accepted as artifact readiness.

Legacy unknown team display has `{teamId,team,configId:null,tier:null,sourceScore:null,requirementResults:[]}`. Unknown content only appears in all-reference. Cùng Tồn item `{linkId?,recordId,scenarioId?,rulesetId?,source,content,configIds?,reviewStatus?,classification}`; `content` is the original legacy group or source-owned payload. Source payload preserves raw multiline slots/notes/effects and is not engine input. `source` is null for legacy, validated source descriptor for new payload. Card/detail renderer supplies Vietnamese attribution labels.

Projected `teamTier` has one row per config: `{teamId,candidateKey,configId,rankings:[{tier}]}` or empty rankings. The full evidence breakdown remains on display evaluation; effective ranking is selected only by reviewed `defaultRankingId`. Never use canonical historical min-tier in seasonal mode.

Engine invocation: `recommendTeams({...projected, ownedHeroes, ownedTactics, lockedTeams, ...engineOptions})` with projected `seasonContext` present. Inspect `projected.ok` first. Seasonal engine result entries and candidate diagnostics add `candidateKey`, `configId`, `seasonContext`; canonical `team.id`/diagnostic `teamId` remain unchanged. Locks remain resource seeds, never filter them with candidate context. No-context calls emit no new optional fields and preserve old identity behavior. Existing greedy/search heuristics are unchanged; the 500 input bound does not imply exhaustive search.

## Evidence so far

- Baseline before edits: engine 22/22; MCP recommendation service + adapter 24/24.
- Resolver initial import failure: module did not exist. This is **not behavioral Red evidence**; initial 11 cases were not observed failing assertions before implementation. Subsequent meaningful Red cases below validate uncovered failures without rolling code back.
- Engine meaningful Red: 3 new cases failed (same-team dual selection, missing config identity/tie, same-team lock bypass); existing 23 cases passed including new legacy-shape assertion.
- Engine Green after implementation: 26/26.
- Initial resolver Green: 11/11, including 501 rejection vs 500 success after eligibility, exact score >100, changed final tactic null score, and real scenario-only registry.

Additional meaningful Red: 6 failures across source attribution/snapshot binding, exact 20-choice ambiguity shape (two assertions), source-season score proof binding, Unicode code-point key order and seasonal ordered holders. Golden test initially used the wrong fixture property name; that test setup error is excluded from behavioral Red evidence.

Additional meaningful Red→Green cases: exact-config evidence for tier; lock applicability warnings independent of tier filtering; provenance URL authority/clock validation; 128 non-BMP-character ID parity; missing/invalid config lookup identity. Invalid duplicate scored heroes/tactics and unreviewed mandatory score conditions are covered by passing regression cases.

## Final focused verification

- `node --test tests-js/season-context.test.mjs tests-js/team-recommend-engine.test.mjs tests-js/hero-identity.test.mjs tests-js/team-tier-badge.test.mjs`: **62/62 passed** (25 resolver, 28 engine, 5 hero identity, 4 tier badge).
- MCP focused recommendation-service + legacy-domain-adapter: **24/24 passed** after adding resolver dependency and seasonal engine behavior.
- Direct pre-change comparison: imported engine from `git show HEAD:js/team-recommend-engine.js`, ran 16 combinations of mode meta/all, greedy/full-box, untiered opt-in on/off, lock present/absent against the current engine; **all outputs deep-equal**. No temporary repository artifact created.
- Actual five published sidecars + all canonical datasets: JS bundle activation succeeded; Binh Diễn scenario-only projection returned **5 source groups / 25 teams / 0 scoped unknown groups**. No reviewed production pair/config/score invented.
- Python-authored golden configuration hash and literal Unicode/newline hash match JavaScript. Extra supplementary-character key-order case passes.
- Scoped `git diff --check` passed. No build/dev server started. Manifest registration delegated to its owning worker when module was created.

Root owns full build/UI/MCP integration gates. This report does not claim those delivered.

Concerns: first 11 resolver behaviors have Green regression evidence but did not have observed assertion Red before implementation; import failure is excluded from behavioral TDD. Later identified validator/identity failures have actual Red→Green evidence recorded above. No unresolved user decision.
