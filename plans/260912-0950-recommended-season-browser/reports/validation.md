# Validation — Team chuẩn và Team khác

Date: 2026-09-12  
Worktree: `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`  
Branch: `feat/season-team-lookup`  
Selected generation: `20d85cbbc63d16b40a2b952c9a0ffad79ebfbd61c1bcf64495c0f0bb36206e5a`  
Manifest SHA-256: `2ae1257f40b7cacf7c0ad9d1d42a7b80ff08e067dc3f511e25c7dc421efafea1`

## Localization follow-up — 2026-09-12

- Initial Vietnamese holder names were committed/pushed before continuing, as requested; [Draft PR #3](https://github.com/nguyennguyenit/CamNangTQCCL/pull/3) targets main. No merge or production deployment.
- Shared display map now covers 29 source seasons (including all uncollected seasons), faction/unit/category labels, and distinguishes existing project names from reference season translations. Raw identity, Chinese names, scope/filter values and URLs remain separate.
- Missing-translation worksheet: 85 alias groups (42 hero, 36 tactic, 7 book), 898 occurrences, zero ambiguous groups. Includes original variants and source context; unknown names remain Chinese. User-approved translations must enter the shared identity map, not individual rows.
- All 90 publication payloads were compared against the preceding generation after removing display-only fields: raw source data, IDs, ranking and scores match. Team khác dedup ledger is byte-identical.
- `python3 -m unittest discover -s tests`: 213 tests run, 12 skipped, no failures.
- `npm run test:node`: 200 passed. `npm run test:e2e`: 77 passed, including translated facets/raw URL values, bilingual season search with stable selection, consistent card/detail names, and existing Back/Forward/gameplay navigation.
- `npm run build`, `npm run verify` and `npm run check` passed: 137 files, 42 raw assets, zero Astro diagnostics.
- PR CI initially caught invalid hashes displaying Team chuẩn without normalizing the URL. Canonicalization now handles both old aliases and invalid hashes; the existing failing SPA navigation test passes unchanged.
- Actual preview exercised at 1280×900 and 375×812: 29 season labels, Chinese/accented/plain Vietnamese/code lookup, raw URL filters, card/detail consistency, mobile filtering, no horizontal overflow, uncollected-season notice and invalid-hash normalization retaining query parameters. Desktop season control widened after visual inspection to avoid unnecessary truncation.
- Local preview emitted only the existing Cloudflare Turnstile hostname error `110200` on localhost; no application page errors. Turnstile production operation was not tested or changed.
- Screenshots `/tmp/team-chuan-final-vi-desktop.png` and `/tmp/team-chuan-final-vi-mobile.png` are transient review artifacts; preview server and browser were closed.

The sections below retain the original browser implementation evidence from generation `996d7b36b9954e64d24358cbb0fb1371a18a39e72748c8ceb1a837add76f88e5`.

## Source and admission evidence

- Frozen source picker: 29 seasons, 87 season/category scopes.
- Reconciled states: 29 complete, 49 source-empty categories, 9 source-uncollected scopes; zero blocked/pending scopes in the publication input.
- Parsed configurations: 1,366 from 1,444 cached list/detail pages.
- Mapping: 410 reviewed dictionary identities and 145 collision-free exact source aliases. 87 distinct source tokens and 380 configurations remain unresolved.
- Dedup: 166 local rows; 40 admitted; 19 exact duplicates; 79 pending alternative branches; 107 primary rows pending identity; 0 pending source. Every local row has exactly one final primary decision. Unknown source identities are wildcards during possible-duplicate matching and never prove distinctness.
- Reports: `source-coverage.json`, `identity-review.json`, `dedup-summary.json`.

## TDD evidence

Behavioral Reds observed before their fixes:

1. New Python acquisition/identity/dedup/builder tests initially failed because the modules did not exist.
2. Full-corpus generation rejected five S24 rows with `Recommended holder mismatch`; the source list exposed two three-holder sets per card. The parser now preserves the first set plus `alternativeHeroSetsRaw`, while details preserve extra holders.
3. `npm run test:dist` rejected test fixtures that lacked the mandatory selected Recommended generation. The isolated fixture now supplies a strict current/manifest/file inventory; rogue/symlink/missing-byte rejection remains.
4. Initial Recommended E2E failed mobile nav visibility and ambiguous season locators. The matrix now opens the existing mobile menu at its real 820px breakpoint and scopes controls to the active tab.
5. Migrated gameplay E2E initially had 12 failures because old Team PK cards/visible browse ruleset controls no longer exist. Tests now use coexist/analyze/roster or exact `config` detail destinations, preserving score, inventory, focus, sticky-header, Khaihoang and Cùng Tồn behavior.

## Passing gates

- `python3 -m unittest discover -s tests` — 167 tests passed, 12 skipped.
- Focused Python source/crawler/identity/dedup/builder suite — includes regressions for missing details, blank source holders, source alternatives and explicit local primaries.
- `npm run test:node` — 199 tests passed.
- `npm run check` — 0 errors, 0 warnings, 0 hints across 13 files.
- `npm run build` — selected generation emitted through Astro routes.
- `npm run verify` — 137 dist files verified; 42 root raw assets plus exact scoped Recommended bytes and matching HTML publication pin.
- `npm run test:dist` — 13 tests passed.
- Affected Playwright suites (`recommended-browser`, `season-lookup`, `spa-parity`, `mcp-domain-compatibility`) — 60 tests passed, followed by a focused Back/Forward restoration regression passing 1/1 after its final repair; repository Playwright config managed port 4174.
- `npm --prefix mcp-worker run test:release` — 10 files, 72 tests passed.
- `npm --prefix mcp-worker run typecheck` — passed.
- Post-E2E `lsof -nP -iTCP:4174 -sTCP:LISTEN` returned no listener.

## Visual inspection

Actual built UI was opened at 1280×900. Team chuẩn showed 25 cards in the default source scope. Team khác showed all 40 conservatively admitted cards, defaulted to `season=all`, rendered the original historical tier labels and had no horizontal overflow. Capture: `local://recommended-final.png`.

## Known limits

- 380 source configurations contain at least one unresolved hero/tactic token. They remain in Team chuẩn as raw source reference. Team khác admission remains conservative through wildcard compatibility; 107 local primary configurations remain pending when identity is unresolved or a possible source match cannot be excluded.
- 79 local rows have uncorrelated alternative branches that remain internal pending; explicit resolved primaries were still classified, and no Cartesian variants were synthesized.
- Browser screenshots generated by Playwright are transient test artifacts; committed screenshot baselines were not modified.

## Rollback

Set `src/data/recommended-reference/current.json` to a previously validated local generation only after rechecking its manifest and every declared byte. Rebuild and rerun `npm run verify`. Do not delete the raw cache, identity ledger, pending decisions, legacy teams, gameplay sidecars or MCP data.
