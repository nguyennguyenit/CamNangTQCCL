# Scout: domain Phases 1–2

Scope: shared contracts/characterization, then identity/normalization/recommendation/provenance hardening. No loaders, MCP registry, transports, GoClaw setup, publishing, or deploy.

## Baseline

- No `mcp-worker/` exists; root has no `package.json`.
- Full observed gates: root JS **83/83**; Vision Worker **53/53**.
- Domain root tests: `match-dict` 9, `analyze-map` 15, `roster-scan-map` 3, `roster-scan-state` 5, `team-recommend-engine` 7 = **39/39**.
- Shared-vision Worker tests: `schema` 20, `model` 5, `scan-modes` 3 = **28/28**.
- Current LOC: `worker/src/schema.ts` 172; `match-dict.js` 136; `analyze-map.js` 129; `roster-scan-map.js` 41; `roster-scan-state.js` 101; `team-recommend-engine.js` 313.

## Phase 1 — shared contracts and characterization

Objective: create a strict TS seam, share the existing vision schema, and type/import current pure ES behavior without changing SPA or Worker behavior.

### File inventory

| Action | File | Rough delta | Test impact |
|---|---|---:|---|
| Create | `mcp-worker/package.json`, `package-lock.json`, `tsconfig.json` | 55–70 + generated | Private ESM; exact-pinned TypeScript/Vitest; `allowJs:true`, `checkJs:false`; `test`/`typecheck`. No MCP/Agents yet. |
| Create | `shared/vision-contract.ts` | 170–190 | Move vision types/parser/validators verbatim. |
| Modify | `worker/src/schema.ts` | replace 172 with 3–8 | Re-export old symbols; existing imports remain valid. |
| Create | `mcp-worker/src/domain/contracts.ts` | 170–230 | Canonical name, identity, roster, tier, provenance, similarity, recommendation types. |
| Create | `mcp-worker/src/domain/legacy-domain-adapter.ts` | 100–150 | Typed wrappers over current ES exports; no algorithm port. |
| Create | `mcp-worker/test/domain/vision-contract.test.ts` | 120–170 / ~12 tests | Prove independent consumer and all four modes. |
| Create | `mcp-worker/test/domain/legacy-domain-adapter.test.ts` | 180–240 / ~12 tests | Characterize actual ES behavior and selected committed-artifact records. |
| Modify | `worker/test/schema.test.ts`, possibly `worker/tsconfig.json` | +5–20 | Re-export parity; include parent shared module only if transitive resolution fails. |
| Delete | none | 0 | Retain all ES modules/tests. |

Approximate authored delta: **600–850 LOC**, about half tests/contracts; lockfile excluded.

### Function/interface checklist

- Move unchanged: `AnalyzeMode`, `ANALYZE_MODES`, all raw result interfaces, `tolerantParse`, four validators, `parseAndValidate`, `parseAndValidateByMode`.
- Wrap unchanged: `normalizeText`; `matchDict`/`searchDict`; `toVietHanViet`; `mapRead`/`mapTeamRead`/`findSimilarTeams`; three roster scan mappers; `normalizeTeamCandidate`/`recommendTeams`.
- Add types: `Confidence`, `CanonicalName`, `HeroIdentity`, `HeroSlot`, `OwnedHero`, `LockedTeam`, `RosterSnapshot`, `TierRanking`, `ProvenanceRef`, `ExtractionEvidence`, `TeamMatch`, `TacticSelection`, `RecommendationRequest/Entry/Diagnostics/Result`, `LegacyDomainAdapter`.
- Encode now, enforce Phase 2: full identity is not `baseName`; `reviewRequired` differs from `matched`; preserve raw CN; per-slot tactics; separate artifact/vision evidence; no image bytes/secrets in roster.

### Dependency map

```text
shared/vision-contract.ts -> worker/src/schema.ts -> model.ts/index.ts/tests
contracts.ts -> legacy-domain-adapter.ts
adapter -> analyze-map.js -> match-dict.js -> filters.js
                         \-> hanviet.js
        -> roster-scan-map.js -> match-dict.js + hanviet.js
        -> team-recommend-engine.js -> filters.js
```

Never import `js/analyze.js`, `js/roster-recommend-ui.js`, or `worker/src/index.ts` into the core.

### Coverage gaps

- No Worker/new-package validator parity test.
- Per-mode malformed nested objects and exact caps (12/80/300/12) are incomplete.
- No typed actual-artifact shape, mutation, JSON-serializability, or secret/image exclusion test at the TS seam.
- No source-graph guard against DOM/transport imports.
- Existing tests characterize output, but not a strict TypeScript adapter.

### TDD

**Tests before:** add shared-path consumer tests; adapter shape/type tests; mark current SP/base-name and tactic-allocation defects as temporary characterization.

**Refactor:** move schema verbatim; re-export it; scaffold strict package; add typed wrappers only.

**Tests after:** existing Worker 28, domain JS 39, new package tests/typecheck, browser-free import check.

**Regression:**

```bash
node --test tests-js/{match-dict,analyze-map,roster-scan-map,roster-scan-state,team-recommend-engine}.test.mjs
cd mcp-worker && npm test && npm run typecheck
cd ../worker && npm test && npm run typecheck
cd .. && node --test "tests-js/*.test.mjs"
python3 -m unittest discover -s tests
```

### Risks

- Parent shared import may fail Wrangler resolution: prove immediately; fallback is `packages/vision-contract/`, never copy.
- `allowJs` leaks `any`: adapter signatures must be the only exported surface; add type assertions.
- Characterization can freeze defects: label temporary tests and replace first in Phase 2.
- Avoid overdesign: loaders/manifests/pagination/MCP/auth stay later.

## Phase 2 — identity, normalization, recommendation, provenance

Objective: correct verified domain defects behind compatible exports and return agent-safe identity, uncertainty, deterministic tier-first portfolios, per-slot tactics, and evidence.

### File inventory

| Action | File(s) | Rough delta | Test impact |
|---|---|---:|---|
| Create | `js/hero-identity.js`; `tests-js/hero-identity.test.mjs` | 70–100 + 100–140 / 8–10 tests | One SP/CO/combined-slot identity authority. |
| Modify | `js/match-dict.js`; its test | +25–45 + 60–90 / 5–7 tests | Runner-up score/margin/review signal; preserve old fields. |
| Modify | `js/analyze-map.js`; its test | +35–60 + 90–130 / 7–9 tests | Full identity, holder-aware tactic hit, deterministic tie. |
| Modify | `js/roster-scan-map.js`; its test | +35–60 + 70–100 / 5–7 tests | Opt-in raw CN/score/review evidence; default SPA shape unchanged. |
| Modify | `js/roster-scan-state.js`; its test | +25–45 + 60–100 / 5–7 tests | Identity dedupe, evidence merge, confirmation/privacy invariants. |
| Modify | `js/team-recommend-engine.js`; its test | +80–140 + 150–220 / 10–14 tests | Slot heroes, tier-first order, late tactic allocation, per-holder selections, diagnostics. |
| Modify | `mcp-worker/src/domain/{contracts,legacy-domain-adapter}.ts` | +90–170 | Consume evidence-rich additive API. |
| Create | `mcp-worker/src/domain/{normalization-service,recommendation-service}.ts` | 240–360 | Pure orchestration with injected data/version; no file/R2 reads. |
| Create | two matching service tests | 320–460 / 18–26 tests | Multi-image/review/provenance/end-to-end domain flow. |
| Delete | none | 0 | Do not extend Python duplicate; skill convergence is Phase 5. |

Approximate authored delta: **1,400–2,000 LOC**, about half tests. Do not parallel-edit these shared JS files.

### Function/interface checklist

- Add `heroIdentityKey`, `heroPrimaryName`, `heroSlotNames`, `normalizeHeroSlot`.
- Required semantics: `SP Tuân Úc` ≠ `Tuân Úc`; `CO Chân Cơ` ≠ `Chân Cơ`; `SP Lữ Mông/Trình Phổ` -> one slot with `["SP Lữ Mông","Trình Phổ"]`.
- Extend `matchDict` additively with `secondScore`, `margin`, `reviewRequired`; keep `record/score/confidence/matched`.
- Refactor `mapRead` and roster mappers to preserve evidence through an opt-in/new export; default output remains compatible.
- Refactor `findSimilarTeams`: full identity, holder-aware tactics, order `heroHit -> tacticHit -> team.id`.
- Refactor `normalizeTeamCandidate` to hero slots while retaining `requiredHeroes`.
- Refactor `recommendTeams`: full owned set at every greedy/DFS step; lexicographic tier/conflict/red order; per-slot tactic records; richer diagnostics; keep current top-level fields.
- Add TS `normalizeVisionResults`, confirmation guard, `findTeamMatches`, `recommendPortfolio`, `provenanceForTeam`.

### Dependency map

```text
hero-identity.js -> analyze-map.js + team-recommend-engine.js
match-dict.js -> analyze-map.js + roster-scan-map.js
vision-contract -> normalization-service -> adapter + contracts
confirmed roster -> recommendation-service -> adapter -> analyze/recommend ES
recommendation-service <- injected {teams, teamTier, coexist?, dataVersion}
```

Treat `coexist.json` as reference-only until stable team IDs exist; fuzzy display-name joins must not score.

### Coverage gaps / tests-before targets

1. SP/CO collapse and combined-slot feasibility.
2. Matcher ambiguity and lost raw/score/review evidence.
3. Similarity tactics counted on wrong holder; unstable final tie.
4. Red bonus can let T0.5 outrank T0; `mode` barely differs.
5. Greedy/DFS retry alternatives using only initially selected tactics, hiding other owned alternatives.
6. Flat selected tactics lose holder/slot; locked hero/pruning diagnostics weak.
7. No `dataVersion` or full tier-ranking provenance; 157/214 teams are untiered.

### TDD

**Tests before:** SP/CO/combined slots; ambiguous matcher; low-confidence confirmation block; holder-aware similarity; T0-before-T0.5; red only after tier; late alternative selection; per-slot output; locked conflicts; untiered label/order; exact provenance.

**Refactor:** add identity helper; extend evidence additively; switch comparator to tuple; pass full owned tactics through search; retain per-slot selections; add pure TS services around injected snapshot.

**Tests after:** multi-image dedupe/evidence merge; real records `team-intro-0`, a CO team, `SP Lữ Mông/Trình Phổ`, multi-source tier, untiered team; serializable/bounded/no-secret result; old SPA shape; raw scan -> confirmed roster -> recommendation.

**Regression:**

```bash
node --test tests-js/{hero-identity,match-dict,analyze-map,roster-scan-map,roster-scan-state,team-recommend-engine}.test.mjs
cd mcp-worker && npm test -- --run test/domain && npm run typecheck
cd .. && node --test "tests-js/*.test.mjs"
cd worker && npm test && npm run typecheck
cd .. && python3 -m unittest discover -s tests
```

### Risks / uncertain decisions

- Confirm SP/CO distinct ownership before live behavior change; report assumes yes from dictionaries/skill rules.
- Combined-slot prefix applies only to primary unless artifact says otherwise.
- Choose optional mapper mode vs new evidence-rich exports during tests; new exports are clearer, optional mode is less duplicate code.
- Recommended untiered policy: label `unranked`, after T1; user/product approval required.
- Separate `dictionaryLinkScore` from OCR `matchScore`; never invent URLs/dates.
- Preserve 60-candidate/250k-node caps and add a performance fixture after late tactic allocation.
- Do not claim tactic-mechanics validation from current names/tier data; return “not evaluated”/warnings.
