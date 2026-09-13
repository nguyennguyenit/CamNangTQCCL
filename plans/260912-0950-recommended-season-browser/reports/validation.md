# Validation — Team chuẩn và Team khác

Date: 2026-09-12  
Worktree: `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`  
Branch: `feat/season-team-lookup`  
Selected generation: `89317bb82ae31a886e49cf0d04180f413cb654ec75e5d25b29f3ff9173d4a9d0`  
Manifest SHA-256: `1e99c46372a36176a439eb1b5fb87933c0103f4845efbe71f7031d95be67e37c`

## Approved translation batch, variant badges and bonds — local follow-up

- Applied 79 additional approved alias groups. Verified every group appears with its exact approved label in published holder slots, including SP Hoàng Phổ Tung, Trương Nhiệm and the requested book/tactic wording. Translation-only entries have no stable identity.
- SP/CO/40Y render as separate leading badges on cards, details and alternatives. CO names retain Vô Song. The 40Y badge uses dark text on its gold background.
- Classified all five indexed source occurrences of `桃園結義` as `bond`, displayed as **Duyên phận: Kết Nghĩa Vườn Đào**, never as selectable tactics. Raw source slots remain unchanged; `tacticSlotKinds` records the display classification in parallel.
- The worksheet now contains one unresolved tactic, `戮力上心`, with 11 occurrences. The [source page](https://sgsdeck.com/recommended/s27-han-hanshi-gong-1) and the existing reviewed `勠力同心` → Đồng Lòng Hợp Sức dictionary entry do not establish equivalence. A [separate tactic description](https://m.51nacs.com/article/1040.html) supports the latter spelling, not the proposed source typo. No alias was invented.
- Compared all 90 payloads against preceding generation `35c00d98fef3e37ffe5a1ca0ba3ad463173fb51a10318e84a452848c28e1a671`, excluding only localized fields, slot-kind annotations and publication fingerprints: raw source content, IDs, slots, order and scores are unchanged. Dedup ledger differs only in the mapping-file byte hash; identity mapping hash and all decisions remain unchanged.
- Python suite: 216 run, 12 skipped, zero failures. Node: 200 passed. Full Playwright: 80 passed, including real published SP/CO/40Y cards/details and bond separation. Dist verification: 137 files, 42 raw assets. Astro check: zero errors, warnings or hints across 13 files.
- Restarted the persistent dev server at `http://127.0.0.1:4321/#team-chuan` and verified it serves this generation. Live smoke exercised variant badges, CO Vô Song Đại Kiều search in Vietnamese/Chinese, card/detail bond separation, retained ambiguous source spelling and a 320px dark layout without horizontal overflow.
- Visually inspected desktop badge screenshots and mobile detail: `/tmp/approved-batch-40y-sp.png`, `/tmp/approved-batch-co.png`, `/tmp/approved-batch-bond-mobile.png`. These are transient artifacts; the verification browser is closed and dev remains running.
- An initial smoke assertion incorrectly required broad `Vô Song`/`無雙` query result parity: accent-insensitive Vietnamese also matches **Văn Võ Song Toàn**, while Chinese also matches untranslated source notes. Replaced that assumption with the exact hero-name scenario; it passed without changing search behavior.
- Changes remain local after PR commit `623aa05`; earlier remote CI does not attest this batch. No English dictionary or language switcher was implemented.

## Earlier five-name approval — local follow-up

- Applied only the five user-approved display names: 40Y Lữ Bố, Vương Dị, SP Pháp Chính, SP Lư Thực, SP Điêu Thuyền. Translation approval does not resolve unknown identity or merge base/SP/40Y variants.
- Compared all 90 payloads against generation `20d85cbbc63d16b40a2b952c9a0ffad79ebfbd61c1bcf64495c0f0bb36206e5a`: exactly 114 index/detail holder appearances changed display names; other differences are publication fingerprints. All dedup decisions and admitted rows are unchanged.
- At this stage the missing-name worksheet had 80 groups (37 hero, 36 tactic, 7 book); the additional approvals are recorded in the later batch above.
- Python regression suite: 214 run, 12 skipped, no failures. Translation-only identity boundary regression passes. Build/check/verify and 22 Recommended browser tests passed after the first approval; final five-name generation rebuilt and passed dist verification.
- Restarted dev at port 4321 and visually verified all five names. Live smoke confirms Chinese/Vietnamese Lữ Bố search returns identical cards and details use the approved display name.
- These additions are local changes after PR commit `623aa05`; the prior PR CI result does not attest this new generation.

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
