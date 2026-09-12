# Phase 2 deep audit: browser, consumer and publication contracts

Date: 2026-09-12. Read-only audit; no implementation, test execution, server, or network access. Only this report was written.

Plan root: `/Users/plateau/Project/CamNangTQCCL/plans/260912-0950-recommended-season-browser/`.
Code root: `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/`.
Plan citations below are relative to the plan root; code citations are relative to the code root. Findings are missing execution contracts, not claims that pending implementation is already broken.

## Verdict

**Needs targeted revision before deep/TDD execution.** The product decisions are sufficient and remain locked. Phase 2 names the intended surfaces, but does not yet close five concrete integration contracts. No product interview, new feature, or architecture expansion is needed to correct them.

## 1. P1 — Consumer “Mở team” handoff lacks an exact surviving destination

**Plan evidence:** `phase-02-browser-and-details.md:29-42` preserves old hashes and gameplay consumers; `:76-77` preserves legacy details, but only specifies hash/source aliases. It does not describe the live callback from analysis/roster results.

**Code evidence:** `js/app.js:213-224` routes `onOpenTeam` through `SOURCE_SECTION` into `team-pk`/`meta-cu`, then uses `sections[name].setSearch(first)` or `openConfig(team.configId)`. `js/app.js:145-157` resolves that detail from the current projected rows. `tests-e2e/season-lookup.spec.mjs:211-223` asserts that a roster result opens its exact reviewed configuration.

**Impact:** Changing hash parsing alone does not migrate direct `switchSection(name)` calls, the section dictionary lookup, or the detail resolver. An excluded duplicate result can land in an empty Team khác search; a reviewed configuration can lose its exact detail when browse rows become admission-only. A shared hero-name search is not an exact legacy/configuration identity contract.

**Correction:** Add an explicit `onOpenTeam` migration step and destination table for (a) admitted local variant, (b) excluded duplicate original, and (c) reviewed gameplay `configId`. Resolve legacy/configuration detail independently of Team khác list admission, preserve its original identity and gameplay context, and keep excluded rows out of browse results. Add behavioral Red cases for analysis and roster “Mở team” on both admitted and excluded builds, including close/back/focus and exact configuration identity. Preserve source-score semantics in the gameplay detail path without assigning them to Team khác cards.

## 2. P1 — Scoped publication omits the actual dist allowlist owner

**Plan evidence:** `phase-01-start.md:50-56,71` chooses generated scoped payloads under `src/data/recommended-reference/`. `phase-02-browser-and-details.md:48,52-63` names an artifact helper and root manifest, but no concrete Astro route or dist verification owner. Phase 3 mentions artifact tests and build verification (`phase-03-validation-and-release.md:43-48,73-76,119`), so the gap is implementation ownership, not absence of an intended gate.

**Code evidence:** `src/pages/data/[file].json.ts:4-9` generates routes only from the root basename manifest. `src/lib/public-artifact-manifest.mjs:67-75` rejects slash paths. `src/lib/root-static-artifacts.ts:64-72,89-102` requires exact root source inventory and basename reads. Crucially, `scripts/verify-astro-dist.mjs:36-60` computes the entire permitted dist tree from that root manifest and checks bytes against root paths.

**Impact:** A valid new scoped route still fails publication verification as an unexpected dist file. Merely adding `recommended-reference-artifacts.ts` does not connect generation, route enumeration, byte pinning and release validation.

**Correction:** Lock the route path and its source-to-output mapping; add that route and `scripts/verify-astro-dist.mjs` to explicit Phase 2 ownership. Have both route enumeration and dist verification consume the declared scoped manifest; retain exact root inventory and private-directory rejection. Start Phase 2 with focused artifact Red tests: declared scoped route emits exact bytes, undeclared/missing/tampered scope fails, extra dist file fails, and the existing root/private checks remain passing. Do not defer these foundational checks until after UI implementation.

## 3. P1 — URL ownership and alias precedence are unspecified across the three state domains

**Plan evidence:** `phase-02-browser-and-details.md:31-35` defines aliases and retention of gameplay parameters; `:70-72` defines reference scalar/facet parsing and preserving filters on season change. It does not state ownership/transition rules for shared `q`, `source`, `faction`, `tier`, or simultaneous `config` and `detail`.

**Code evidence:** `js/season-ui-state.js:19-31` reads the same URL keys for gameplay browse, and `:64-70` updates only specified keys. `js/app.js:127-129` reads that URL for whichever section is active; `:175-188,196-207` rerenders it on navigation/popstate. Source values also differ: the gameplay coexist UI interprets `source` as a source record ID (`js/team-filter-section.js:237-248`), while old team aliases identify `team-intro`/`moi-phe`.

**Impact:** A source faction value such as `魏` or alias `source=team-intro` can become a gameplay/coexist filter when tabs change. A stale `config` can render a gameplay detail alongside reference `detail`. Returning to canonical Team khác after `#meta-cu` can retain an unintended alias restriction. The outcome depends on incidental update order rather than the stated browsing contract.

**Correction:** Add a transition table for Team chuẩn, Team khác/legacy aliases, and gameplay consumers. Define key ownership, alias-vs-explicit-source precedence, canonical URL behavior, inactive detail suppression, and which per-surface filters are retained/restored. Preserve `scenario`/`ruleset` for gameplay without letting them certify reference rows. Test direct load, nav click, reload, Back and Forward for a mixed-parameter URL, and switching from an alias to canonical Team khác. This can use the existing URL/history mechanism; no persistence feature is required.

## 4. P2 — Team khác season filtering has no defined attribution projection

**Plan evidence:** `phase-02-browser-and-details.md:19,70-75,102` applies season/category/facets to the browser but specifies 29 source seasons only for the picker. `phase-01-start.md:54,81,86` defines admitted local rows without a season attribution/display projection. The locked brainstorm explicitly says unknown-season teams must not be assigned a specific season (`../reports/brainstorm-260912-team-chuan-team-khac.md:63`).

**Code evidence:** Current team browse derives context from reviewed configuration `scenarioId`/`rulesetId` and classifies rows through the season model (`js/app.js:133-144`); unconfigured legacy rows have no generated context label (`:138`). Existing filter grouping distinguishes `unknown` from `scenarioReference` (`js/team-filter-section.js:212-220`). Those reviewed gameplay IDs are not the new TW/source season IDs.

**Impact:** The implementer has no deterministic rule for whether admitted legacy teams appear under a selected source season, under an all/unknown scope, or disappear. Reusing the existing season projection also reintroduces the gameplay coupling the plan prohibits. Category/facet counts face the same missing-data problem for local records.

**Correction:** Define Team khác season/category fields and their evidence owner. Keep unknown attribution explicitly unknown; do not infer a TW/source season from dedup similarity or a VN scenario name. Specify the all/unknown view and selected-season inclusion/count rules, including unavailable category/facet metadata. Add fixtures for a known-season admitted variant, unknown-season admitted variant, and duplicate from another season; prove the first two remain discoverable in their stated scopes and the duplicate never enters Team khác.

## 5. P2 — Regression gates preserve assertions that conflict with the accepted navigation change

**Plan evidence:** `phase-02-browser-and-details.md:85-95` requires new alias/source-reference behavior while broadly retaining existing season lookup tests. `phase-03-validation-and-release.md:72,101` repeats the regression requirement without an assertion migration map.

**Code evidence:** `tests-js/runtime-asset-contract.test.mjs:103-124` asserts the exact old section array and old fallback expression; `tests-js/frontend-shell-contract-assertions.mjs:3-13,31-39` asserts exact old nav/mount/default names. `tests-e2e/season-lookup.spec.mjs:21-30` operates gameplay scope controls from `#team-pk`; `:55-65` expects gameplay ruleset labels and scored configured cards there. Under the accepted alias behavior that URL is Team khác, whose browser must not expose ruleset controls or inherit SGSDeck score.

**Impact:** “Keep existing tests green” is not executable unchanged. Implementers may retain prohibited UI to satisfy old assertions, or delete valuable gameplay coverage while replacing selectors.

**Correction:** Add these exact contract-test owners to Phase 2 and a short preserve/migrate matrix. Replace obsolete literal nav/default assertions with canonical-nav plus historical-alias behavior checks. Move gameplay score/configuration assertions to the surviving consumer/detail path from finding 1, retaining exact source selection and ruleset eligibility checks. Keep Khaihoang, coexist, inventory reset, and model byte-validation invariants unchanged. Record the new behavioral Reds separately from intentionally updated old surface assertions; do not report old assertion deletion as a passing regression.

## Preserved decisions and scope

Team chuẩn remains SGSDeck Recommended; Team khác starts with existing admitted nonduplicates and honest sources. Keep the current appropriate filters plus season selection, no ruleset/score controls in these browse surfaces, and three holders with tactics/books on cards. These findings do not reopen rights, names, dedup criteria, gameplay eligibility, or user submission features.

Status: DONE_WITH_CONCERNS
Summary: Five evidence-backed Phase 2 integration gaps identified, each with exact corrective scope and behavioral test expectations.
Concerns/Blockers: Plan is not yet sufficient for deep/TDD execution; no product clarification is required by this audit.
