# Cùng Tồn: assumption and contract review

Date: 2026-09-07. Scope: PLAN ONLY, stable phases 1–2 and actual source owners. Read the plan index, phase 1/2, planning contract, source/integration research, pinned CSV, identity helper, legacy parser, recommendation engine and MCP domain contracts. No implementation, fetch, lint, build or test execution.

## Finding — Medium: reviewed source requirements do not establish player readiness

**Plan evidence:** `phase-02-season-team-configurations.md:15–16` adds `requirements[]`/`effectBundles[]`; `:34` accepts reviewed scoped config references; `:53–54` describes recommendation eligibility through verified scope; `:82` fingerprints required conditions; `:95` explicitly preserves advisor requirements and S proficiency. None defines how a reviewed configuration with a player-specific unmet or unknown requirement is treated by the seasonal engine. A fingerprint proves selection identity, not that the player satisfies the requirement.

**Actual source evidence:** pinned `research/coexist-binh-dien-xuan-thu.csv:198–203` specifies Lữ Bố with Điêu Thuyền advisor skill and Quách Gia Cung S. `:216–220` independently specifies Quan Vũ with Quan Hưng advisor skill. `js/hero-identity.js:15–17` strips trailing annotations from canonical display identity. `js/team-recommend-engine.js:351–372` builds candidates from hero/tactic assignment only, and `:245–253` labels a primary selection `build-now`. `mcp-worker/src/domain/contracts.ts:96–119` has no proficiency/advisor/effect capability in its roster contract; `mcp-worker/src/domain/recommendation-service.ts:116–129` forwards hero/tactic ownership without such evidence.

**Failure scenario:** this source remains safely reference-only today. Later, exactly as phase 2 permits, an editor reviews its canonical mapping and ruleset and creates a normalized configuration. A player owns its three heroes and six tactics, but their advisor requirement is absent or unknown. The planned scope/identity checks and fingerprints all pass, while the inherited engine still reports `build-now`. Merely retaining the requirement in detail text does not prevent that false readiness claim. This is distinct from guessing canonical identities or accidentally scoring raw reference strings; those are already prohibited.

**Bounded plan fix:** explicitly separate scenario applicability from roster readiness. In the seasonal projector/engine contract, a mandatory condition not provably satisfied by existing inputs must not produce unconditional `build-now`; retain the configuration for browsing and return a bounded unmet/unknown-requirement diagnostic or a clearly conditional result. Do not add a new capability inventory, scoring system or source catalog solely for this fix. Keep legacy no-context parity. If conditional executable configurations are intentionally outside initial engine support, state their projection eligibility explicitly while preserving all reference content.

**Required Red cases:** reviewed canonical configuration + correct pair + all three heroes/six tactics + unknown advisor/S condition cannot report unconditional readiness; `experimentalUntiered` cannot bypass the condition; reference content and normal supported configurations remain available. Assert the same behavior through shared projector and MCP output.

## Concerns rejected on existing evidence

- CSV parsing/column J/options loss: phase 2 `:93–95,119–122` explicitly requires real fixture counts, multiline/empty slots, dedicated CSV adapter, independent advisor semantics and intact coupled alternatives. Legacy `pipeline/parse_coexist.py:94,100–110` is intentionally not reused for new input.
- Label collisions or reorder changing IDs: phase 2 `:32–34,123–124` requires source namespaces, reviewed stable keys, revision fingerprints and union validation. No positional or label identity is permitted.
- Scenario confirmation being mistaken for ruleset review: phase 1 success criteria and phase 2 `:99,125` separate referenceScope from effective seasonContext. Scenario-only browsing is labeled PROPOSED, not user-approved.
- Missing canonical 40th/decorated-tactic mapping blocking reference delivery: phase 2 `:95,99,113` preserves raw content and blocks only dependent executable configurations. No need to gate this work on all six catalog categories.
- New artifact or legacy dataset rewrite: phase 2 `:24–29,97,105` defines inline sidecar ownership, failure preservation and exactly five season sidecars. No sixth dataset is required.
- Generic atomic publication or input drift concerns: phase 2 `:93,97,120` already requires candidate validation and rollback, with real failure cases. No additional finding without a concrete contradictory path.

## Unresolved questions

No new user question is required for the bounded readiness clarification. Exact source ruleset, alternative coupling and legacy scope remain the existing evidence gaps; this review does not infer answers.

Status: DONE_WITH_CONCERNS
Summary: One Medium planning gap: normalized mandatory requirements need an explicit seasonal readiness rule. Source retention, reference scope, stable identity and dependency assumptions are otherwise concretely bounded.
Concerns/Blockers: Add the readiness invariant and its Red cases before implementation; no runtime change or test result is claimed.
