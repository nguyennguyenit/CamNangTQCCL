# Domain reuse for image-driven team research

## Recommendation

Use a TypeScript MCP orchestration/core layer, but do **not** rewrite the existing
domain algorithms in the first delivery.

1. Extract the portable vision result types/validators from
   `worker/src/schema.ts` into one shared TypeScript contract.
2. Keep image acquisition, image validation, model calls, auth, and Turnstile
   outside the domain core behind a `VisionExtractor` interface.
3. Import the pure vanilla ES modules unchanged behind typed TypeScript adapters:
   `match-dict.js`, `hanviet.js`, `analyze-map.js`,
   `roster-scan-map.js`, and `team-recommend-engine.js`.
4. Add characterization and real-artifact contract tests before fixing identity,
   ranking, or portfolio behavior.
5. Keep the Python skill CLI as a compatibility/operator utility during the
   transition; do not make it a second recommendation implementation.

This is the smallest path that preserves the static SPA and gives stdio/HTTP MCP
transports one canonical contract. A direct TypeScript port would create two
implementations because the SPA has no TypeScript build step. Moving the browser
to generated bundles can be a later, separately accepted migration.

## Existing reusable symbols

| Concern | Exact symbols | Reuse decision |
|---|---|---|
| Vision modes and raw shapes | `AnalyzeMode`, `ANALYZE_MODES`, `HeroRead`, `AnalyzeResult`, `RosterHeroRead`, `RosterHeroesScanResult`, `TacticsScanResult`, `BuiltTeamsScanResult`, `AnalyzeModeResult` in `worker/src/schema.ts` | **Extract** as shared TS contract. |
| Output hardening | `tolerantParse`, `validateResult`, `validateRosterHeroesResult`, `validateTacticsScanResult`, `validateBuiltTeamsScanResult`, `parseAndValidateByMode` in `worker/src/schema.ts` | **Extract/reuse**. These are runtime trust-boundary functions, not transport logic. |
| Provider adapter | `promptByMode`, `buildRequestBody`, `extractContent`, `callModel` in `worker/src/model.ts` | Keep behind `VisionExtractor`; reuse only in a Qwen/OpenAI-compatible adapter. Do not make it the domain API. |
| Chinese/Vietnamese match | `matchDict`, `searchDict`, `levenshtein`, `ratio`, `DEFAULT_THRESHOLD` in `js/match-dict.js`; `toVietHanViet` in `js/hanviet.js` | **Import unchanged initially** through a typed adapter. |
| Team-image mapping | `statFocusVn`, `mapRead`, `mapTeamRead` in `js/analyze-map.js` | **Import unchanged initially**. |
| Roster mapping | `mapHeroesScan`, `mapTacticsScan`, `mapBuiltTeamsScan` in `js/roster-scan-map.js` | **Import unchanged initially**. |
| Similarity | `findSimilarTeams` in `js/analyze-map.js` | Import only after characterization tests; fix identity semantics before presenting it as authoritative MCP research. |
| Portfolio | `normalizeTeamCandidate`, `recommendTeams` in `js/team-recommend-engine.js` | Import behind a typed adapter; treat current output as provisional until the gaps below are covered. |
| Text normalization | `normalizeText` in `js/filters.js` | Safe in Node/Worker, but it is an awkward dependency on a UI filtering module. Import now; extract a tiny shared text utility only when a second implementation would otherwise appear. |
| Python candidate listing | `best_tier`, `hero_names`, `tactic_names`, `main` in `.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py` | Retain for skill/operator use; converge it on MCP/CLI later instead of extending its independent logic. |

The five requested ES modules and their transitive `hanviet.js` dependency contain
no `window`, `document`, `localStorage`, `fetch`, canvas, or DOM usage. They are
runtime-portable ES modules even though they lack TypeScript declarations.

## Proposed canonical domain contracts

Names below are proposed contracts, not current source symbols.

```ts
type VisionMode =
  | "analyzeTeamImage"
  | "scanHeroes"
  | "scanTactics"
  | "scanBuiltTeams";

interface VisionExtractionEnvelope<T> {
  mode: VisionMode;
  result: T;                    // validated raw Chinese result
  evidence: {
    provider?: string;
    model?: string;
    extractedAt: string;
    imageDigest?: string;       // digest only; never persist the image
    promptVersion?: string;
  };
}

interface CanonicalName {
  kind: "hero" | "tactic" | "book";
  raw: string;
  chinese: string;
  viet: string;
  matched: boolean;
  matchScore: number;
  confidence: "high" | "medium" | "low" | "manual";
  reviewRequired: boolean;
  dictionaryRef?: ProvenanceRef;
}

interface OwnedHero extends CanonicalName {
  level?: number;
  redStars?: number;
}

interface LockedTeam {
  teamName: string;
  heroes: CanonicalName[];
  tactics: CanonicalName[];
}

interface RosterSnapshot {
  heroes: OwnedHero[];
  tactics: CanonicalName[];
  lockedTeams: LockedTeam[];
  confirmed: boolean;
  evidence: VisionExtractionEnvelope<unknown>["evidence"][];
}

interface ProvenanceRef {
  artifact: "teams" | "team-tier" | "coexist" | "heroes-dict" | "tactics" | "books-dict";
  recordId?: string;            // team ID where available
  sourceLabel?: string;
  updatedAt?: string;
  artifactVersion?: string;     // release/version/git SHA supplied by loader
}

interface TeamMatch {
  teamId: string;
  heroHits: number;
  recognizedHeroes: number;
  tacticHits: number;
  tierRankings: TierRanking[];
  provenance: ProvenanceRef[];
}

interface RecommendationRequest {
  roster: RosterSnapshot;
  maxTeams: number;
  keepExistingTeams: boolean;
  preference: "meta" | "redStars";
}
```

Rules at the contract boundary:

- Unconfirmed or `reviewRequired` names must remain visible and must not silently
  become hard ownership/lock constraints.
- Preserve full hero identity (`name`, SP/CO marker, and slot alternatives);
  `baseName` alone is not a canonical hero ID.
- A recommendation must return tactic selection per hero/slot, not only a flat
  `selectedTactics` array.
- Every matched/recommended team must include the team artifact reference and all
  tier rankings used to justify its position.

## Verified gaps and migration hazards

### Hero identity is currently inconsistent

- `teamHeroes()` and `tacticSlots()` in `team-recommend-engine.js` use
  `hero.baseName || hero.name`.
- `teamHeroNames()` in `analyze-map.js` also uses `baseName`.
- `hero_names()` in the Python CLI instead uses `hero.name`.
- `pipeline/normalize.py:parse_hero()` removes `SP `/`CO ` from `baseName`.

Empirical check with `team-intro-0`:

- artifact display heroes: `SP Tuân Úc`, `Trương Liêu`, `Vương Nguyên Cơ`;
- `normalizeTeamCandidate(...).requiredHeroes`: `Tuân Úc`, `Trương Liêu`,
  `Vương Nguyên Cơ`;
- a roster containing the displayed `SP Tuân Úc` was reported missing
  `Tuân Úc`;
- image mapping of `SP荀彧` plus `张辽` scored only one hero hit.

The Python CLI returned no candidate for the same three displayed names because
its exact `hero.name` handling also cannot expand combined slots such as
`SP Lữ Mông/Trình Phổ`. The MCP must define slot alternatives and SP/CO identity
before sharing recommendation results.

### Chinese-to-Vietnamese normalization lacks evidence needed by an agent

- `matchDict()` has one global `0.7` threshold and no best/second-best margin.
- `CJK_OCR_ALIASES` contains one hard-coded repair; there is no general
  traditional-to-simplified conversion if the model violates the prompt.
- A match may have `confidence: "low"` but still be `matched: true`.
- `mapHeroesScan()`/`mapTacticsScan()` discard Chinese input, match score,
  `matched`, and `sure`; they keep only Vietnamese name and a confidence label.
- Dictionary `linkScore` is not considered by `matchDict()`. That field describes
  artifact linking quality, while the matcher confidence describes query
  similarity; the two must not be conflated.
- `mapBuiltTeamsScan()` drops confidence entirely.

The browser mitigates this through human confirmation. An MCP tool needs the same
explicit review gate in its contract rather than accepting low-confidence names
as settled facts.

### Similarity is useful but too weak as final research evidence

`findSimilarTeams()` correctly excludes unmatched heroes from its denominator and
uses tactic hits as a tie-break. It currently:

- collapses SP/CO identity through `baseName`;
- flattens tactics across holders, so a tactic on the wrong hero still scores;
- ignores tier, source, season/date, unit type, and coexist evidence;
- has no stable final tie-break beyond artifact order;
- returns the full mutable team object without an explicit provenance envelope;
- still comments about 172 teams while `data/teams.json` currently contains 214.

Use it as candidate retrieval, then enrich/rank in the TS core. Do not claim it
measures build equivalence.

### Portfolio behavior diverges from the skill rules

`recommendTeams()` is a valuable base: it respects owned resources, locked
tactics, explicit slot alternatives, tiers, and a bounded portfolio search. Gaps:

- Red-star bonus is always added, including `mode: "meta"`. The additive score can
  let `T0.5 + 12` outrank `T0`, contrary to the skill's lexicographic rule
  tier first, red copies later.
- `mode` barely changes behavior: it changes a candidate pool cap, while
  `searchPortfolio()` then truncates to 60 either way.
- `greedy()` and `searchPortfolio()` re-run `selectTactics()` with only the
  tactics selected during the initial seed check as the "owned" set. A later
  conflict can therefore prevent choosing another genuinely owned alternative.
- `coexist.json` is not consumed. `presetId`, `presetReason`, and
  `coexistSetBonus` are constant placeholders.
- Locked hero conflicts are safely skipped later, but are not reported as a
  first-class diagnostic.
- Output flattens selected tactics and loses hero/slot assignment.
- There is no tactic-mechanics sanity check (active/assault, healing dependency,
  troop/formation fit, commander scaling, self-control risk).
- Only 57 of 214 teams have tier records. Untiered team treatment must be
  explicit in MCP results.

The engine should remain the selection implementation, but these semantics need
tests and targeted fixes before calling the MCP recommendation canonical.

### Python CLI is intentionally narrower and already duplicated

`list_candidate_teams.py` is helpful for deterministic inspection but is not a
portfolio engine:

- no locked-hero or cross-candidate tactic allocation;
- no coexist presets or tactic-logic check;
- no red-copy input (its `stars` tie-break is the team rating);
- alternatives are not evaluated;
- combined hero slots are not expanded;
- provenance is limited to team source label and best tier.

After the MCP CLI is stable, update the skill to call that CLI or make the Python
script a thin wrapper. Do not port new recommendation features into both.

## Data and provenance evidence

Current committed artifacts sampled with `jq`:

| Artifact | Shape/count | Provenance strength |
|---|---:|---|
| `data/teams.json` | 214 teams: 56 `team-intro`, 48 `do-uy`, 110 `moi-phe` | Stable team `id` and coarse `source`; no source URL/date per team. |
| `data/team-tier.json` | 57 team joins; tiers T0/T0.5/T1; dates 2026-06-26..2026-07-07 | Best existing evidence: each ranking has `source`, `tier`, `updatedAt`. Preserve every ranking, not only best tier. |
| `data/coexist.json` | 5 groups / 25 display teams | No stable team IDs, dates, or source reference; names/tactics are display strings and may not join exactly to `teams.json`. |
| `data/heroes-dict.json` | 112 records | Chinese/Vietnamese and `linkScore`; no source/date. |
| `data/tactics.json` | 239 records | `source` is acquisition source, not necessarily research URL; includes `linkScore` and some pending/translated fields. |
| `data/books-dict.json` | 66 records | Chinese/Vietnamese only. |

The loader should attach artifact name and deployment version/git SHA without
mutating the JSON. Do not fabricate source URLs. The architecture docs also warn
that the build is not clean-clone reproducible and that blindly rebuilding can
overwrite current augmentation; MCP work should read committed artifacts only.

## Image workflow boundary

Keep this sequence explicit:

```text
MCP transport image reference
  -> image resolver/size+MIME guard
  -> VisionExtractor (provider-specific)
  -> shared parseAndValidateByMode
  -> pure canonical mapper + review gate
  -> similarity retrieval
  -> portfolio recommendation
  -> provenance-rich research response
```

The domain core should accept validated extraction results and artifact
repositories. It should never depend on `Request`, Cloudflare bindings,
Turnstile, DOM APIs, local storage, or image codecs.

Browser-only code that must not enter the core:

- `js/analyze.js`: `URL.createObjectURL`, `Image`, canvas compression, DOM,
  `window.turnstile`, Worker HTTP call, and rendering.
- `js/roster-recommend-ui.js`: DOM, file inputs, `localStorage`, Turnstile, and
  UI state.
- `worker/src/index.ts`: HTTP/CORS, IP hashing, rate limits, KV, Turnstile,
  Worker environment, and response mapping.

`worker/src/model.ts` uses only `fetch` plus portable prompt/schema code, but it
is still a provider adapter. The current `/analyze` endpoint cannot simply be
called by MCP because Turnstile is mandatory; do not add a silent bypass.

## TDD inventory

Preserve existing green characterization suites:

- `tests-js/analyze-map.test.mjs`: 15 tests for stat mapping, exact/fuzzy/unknown
  name mapping, book separation, portrait uncertainty, and team similarity.
- `tests-js/roster-scan-map.test.mjs`: 3 mapper tests.
- `tests-js/team-recommend-engine.test.mjs`: 7 tests for required heroes, locked
  teams, tactic uniqueness, explicit alternatives, full-box search, and output
  placeholders.
- `worker/test/schema.test.ts`, `model.test.ts`, `scan-modes.test.ts`: mode
  selection, prompts, tolerant parsing, bounds, and schema validation.

The three requested JS suites were run together: 25/25 passed.

Add tests in this order:

1. **Shared vision contract:** every mode accepts valid output and rejects
   empty/oversized/wrong shapes; legacy missing `booksCn` remains compatible.
2. **Typed legacy adapter:** actual `data/*.json` samples pass without lossy
   coercion; unknown fields are tolerated.
3. **Identity regression:** `SP Tuân Úc` does not equal `Tuân Úc`; `SP Quách
   Gia` does not equal `Quách Gia`; CO identity is preserved; combined slots are
   represented as alternatives.
4. **Normalization evidence:** exact/fuzzy/ambiguous/unmatched/traditional input,
   second-best margin, dictionary `linkScore`, and review-required propagation.
5. **Roster aggregation:** multiple screenshots deduplicate by canonical
   identity, preserve max/evidence for red stars and level, never persist image
   bytes, and invalidate confirmation after edits.
6. **Similarity:** SP/CO cases, holder-aware tactic hits, deterministic ties,
   tier/provenance enrichment, and no book influence.
7. **Portfolio:** lexicographic tier-before-red ordering; meta vs red modes;
   alternative chosen after cross-team conflicts; locked hero diagnostics;
   per-slot tactic output; no duplicate heroes/tactics; untiered-team policy.
8. **Coexist join:** preset team identity/join failures are explicit, never
   guessed silently.
9. **Logic checks:** encode only mechanics supported by curated fields/rules;
   otherwise return warnings requiring research rather than inventing a pass.
10. **End-to-end MCP/CLI:** fixture extraction -> normalization -> confirmation
    -> similar teams -> portfolio, with provenance and bounded response size.

## Phase and file recommendations

### Phase 1 — contracts and compatibility

- Add `mcp-worker/src/domain/contracts.ts`.
- Add a shared vision contract module (recommended:
  `shared/vision-contract.ts`) and make `worker/src/schema.ts` re-export it.
- Add `mcp-worker/src/domain/legacy-domain-adapter.ts` importing the existing ES
  modules with a narrow declaration surface.
- Add real-artifact fixtures and characterization tests under
  `mcp-worker/test/domain/`.
- No SPA behavioral changes.

### Phase 2 — normalize and scan

- Add `mcp-worker/src/domain/normalize-vision.ts` as orchestration around
  `mapTeamRead`/roster mappers.
- Add `mcp-worker/src/vision/vision-extractor.ts` and a provider-specific adapter.
- Preserve raw Chinese, score, confidence, dictionary evidence, and
  `reviewRequired`; require explicit confirmation before recommendation.
- Keep image resolving/guards in CLI/MCP transport adapters.

### Phase 3 — identity, similarity, and portfolio hardening

- Fix shared semantics in the existing ES modules, test the SPA contract first,
  and let the typed adapter consume the same implementation.
- Introduce one hero-slot identity helper used by similarity and recommendation.
- Correct tier/red ordering and tactic allocation timing in
  `team-recommend-engine.js`.
- Return per-slot builds, diagnostics, and provenance without removing current
  fields used by `roster-recommend-ui.js`.

### Phase 4 — MCP tools and skill convergence

- Expose composable tools: raw image extraction, roster normalization/review,
  similar-team lookup, and portfolio recommendation. Keep a convenience
  image-to-research workflow as orchestration over those primitives.
- Make CLI and MCP registry call the same TS handlers.
- Update the team-builder skill to prefer the new CLI; retain the Python script
  for one compatibility release, then remove only after parity tests.
- Update architecture/deployment docs only after tool/image transport and auth
  decisions are final.

## Unresolved questions

1. How does GoClaw provide images to the MCP server: local path, MCP image
   content, URL, or base64? This determines resolver and SSRF/filesystem policy.
2. Should remote MCP call Qwen directly, reuse a refactored provider adapter, or
   receive already extracted JSON? The existing Turnstile endpoint is not a
   service-to-service API.
3. Are SP/CO forms distinct owned heroes for all recommendation conflicts, and
   how should artifact slots like `SP Lữ Mông/Trình Phổ` be interpreted?
4. May unconfirmed low-confidence scan results participate as soft candidates,
   or must recommendation hard-fail until confirmed?
5. Should `coexist.json` be curated with stable team IDs/provenance now, or only
   surfaced as non-scoring reference evidence?
6. What is the accepted policy for 157 currently untiered teams?
