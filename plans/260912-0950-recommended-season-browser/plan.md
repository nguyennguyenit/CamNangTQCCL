---
title: "Team chuẩn và Team khác theo mùa"
description: "Python thu thập SGSDeck Recommended; đối chiếu team có sẵn và hiển thị hai tab theo mùa, với deep/TDD."
status: completed
priority: P1
effort: "7–8d dự kiến; điều chỉnh theo corpus và mapping thực"
branch: "feat/season-team-lookup"
tags: [recommended, sgsdeck, season, deep, tdd, ui]
created: 2026-09-12
---

# Team chuẩn và Team khác theo mùa

Product decisions: [Brainstorm đã chốt — Team chuẩn và Team khác](../reports/brainstorm-260912-team-chuan-team-khac.md). This is the consolidated decision reference; the phases below own execution and validation.

## Outcome

Build two visible browse surfaces with locked names. `Team chuẩn` is SGSDeck Recommended across source seasons. It shows source season/category/faction/unit/tier/subcategory facets, fixed source ranking, cards with three holders plus tactics/books, and click-through full details. `Team khác` initially contains existing local teams that are not duplicates of Team chuẩn by heroes + tactics. Future external Team khác intake requires research or player battle-report source attribution before admission.

The page must not create VN gameplay eligibility, ruleset UI, point filters, score sort controls, fake translations, inferred tiers, user-submission backend, or SGSDeck scores for `Team khác`. Existing records without source keep honest `Nguồn chưa xác định` or their current source labels. Preserve old `#team-pk` and `#meta-cu` hashes as historical aliases into `Team khác`/legacy-filter views. Removing old nav labels is not deleting legacy corpus, IDs, tests, or MCP contracts.

## Verified Context

- Current root nav owns `Team PK`, `Meta phe (cũ)`, `Cùng Tồn`, `Khai hoang`, lookup and tools in `src/pages/index.astro:33-61`; hash routing defaults unknown hashes to `team-pk` in `js/app.js:52-80`. This plan replaces visible team-nav labels with `Team chuẩn` and `Team khác`.
- Existing season controls are one shared mount in `src/pages/index.astro:52`; current app fills scenario/ruleset controls in `js/app.js:165-184`.
- Existing season team section has filter chips and grouping in `js/team-filter-section.js:179-220`, but includes a sort select at `js/team-filter-section.js:184-196`; Team chuẩn must remove score/tier sort UI and keep fixed ranking.
- Existing configured cards strip tactics/books for config cards in `js/render.js:402-408`; Team chuẩn cards must show holders, tactics and books directly.
- Current public artifact allowlist is basename-only in `src/lib/public-artifact-manifest.mjs:17-58`; root artifact tree rejects undeclared root entries in `src/lib/root-static-artifacts.ts:47-73`.
- Recommended adapter is source-reference and offline-cache based in `pipeline/sgsdeck_recommended.py:1`; URL/cache/list/detail guards are at `pipeline/sgsdeck_recommended.py:99-113` and `:225-281`.
- Docs already state Recommended rights are closed for website display, but evidence remains internal and not auto VN gameplay score in `docs/season-team-data.md:74-90`.
- Browser research confirms user contract, no score filter/sort, visible tactics/books on cards, no ruleset selector and no pending rights question in `reports/browser-research.md:5-13`; live observations show 29 source season options, S28 mixed faction, empty-season behavior and detail content in `reports/browser-research.md:18-29`.

## Data Flow

**Python HTTP → raw cache/checkpoint → offline parser → reviewed identity bridge + concrete legacy variants → dedup → immutable generation → current pointer → Astro/HTML pin → browser views.** Browser is the verification/fallback tool when direct HTML is insufficient. The [Python probe](./reports/python-acquisition-probe.md) returned 93 S28 teams and one detail with 3 heroes/6 tactics/9 books; this is two-page feasibility evidence, not complete corpus acquisition.

P1 freezes all discovered seasons/categories, owns a reviewed hero/tactic mapping, and compares existing local candidates against the whole Team chuẩn corpus before filters. Public Team khác contains admitted rows only, with honest source state; internal duplicate/pending records remain separate. Future external additions require actual research/battle-report provenance. Gameplay engines and MCP eligibility retain their reviewed config/evaluation model.

Generation output is under `src/data/recommended-reference/<generationId>/`. One validated `current.json` selects the complete manifest/index/details/other-teams generation. Explicit routes `/data/recommended/current.json` and `/data/recommended/<generationId>/<file>.json` share inventory/byte validation with the dist verifier. Root HTML pins one generation; browser never mixes updates. Original/gameplay detail resolution stays independent of Team khác admission.

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 1 | [Source coverage and dedup contract](./phase-01-start.md) | Completed | none |
| 2 | [Browser and details](./phase-02-browser-and-details.md) | Completed | Phase 1 |
| 3 | [Validation and release readiness](./phase-03-validation-and-release.md) | Completed | Phase 2 |

## Dependencies and Ownership

- Plan files live in `/Users/plateau/Project/CamNangTQCCL`; code target is `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup` on `feat/season-team-lookup`. Recheck actual baseline/status before cook; preserve dirty main and the four-file uncommitted spike. Old clean-source attestation does not certify that spike.
- Coordinate with [season/team lookup](../260907-0233-season-team-lookup/plan.md): reuse boundaries; do not add Team chuẩn or Team khác to VN ruleset eligibility or roster recommendation without a separate reviewed config path.
- Coordinate with [unified lookup](../260912-0607-unified-lookup/plan.md): catalog ownership stays there, while P1 owns a bounded reviewed source/local identity bridge. Verified catalog mappings may be reused as evidence; no blind dirty-main copy or canonical dictionary mutation. Neither plan blocks the whole other plan; serialize shared app/render/publication edits.
- Ignore unfinished prototype `src/lib/recommended-reference-data.mjs`; it hardcodes one season and transliterates, so redesign instead of adopting.
- File ownership: Phase 1 owns Python acquisition, parsing, identity, variants, dedup/generation and Python tests; Phase 2 owns routes, browser state/render, nav/consumer migration and UI tests; Phase 3 owns integration evidence/docs and sequential regression fixes with the owning phase.

Each phase includes a file inventory, interface/caller checklist, dependency map, scenario matrix and ordered Tests Before → protected changes → Tests After → Regression Gate. New assertions must fail for the intended behavior; already-green invariants remain regression checks. Planning does not claim execution of future tests.

## Acceptance Criteria

- [x] Python acquisition reconciles the complete frozen source scope inventory, resumes interrupted work, and records hashes/empty/uncollected states; browser is fallback/verification.
- [x] Identity mapping and explicit legacy variant extraction have evidence; unknown identity never proves distinctness and no unsupported combinations are synthesized.
- [x] HTML/index/details/Team khác use one validated generation; failed writes retain last-good and every public byte has a declared owner.
- [x] Visible nav names are exactly `Team chuẩn` and `Team khác`; old hashes remain compatible aliases.
- [x] 29 advertised seasons are represented with accurate empty/available states; counts are source-advertised, not summed across categories blindly.
- [x] Source season/category/faction/unit/tier/subcategory facets are preserved, but local facets do not collapse incoherently after a selection.
- [x] Ranking is fixed: source tier group order, then source score descending inside the same tier, then source list order/sourceConfigId; no point filter or sort control.
- [x] Cards show three holders plus tactics/books; detail opens full source descriptions, stat focus, special traits, author, source URL and unknown fields explicitly.
- [x] Initial `Team khác` includes existing local teams that are not duplicates of Team chuẩn; missing provenance is labeled honestly, not fabricated.
- [x] Future external `Team khác` admits only builds with research/chiến báo source attribution and a dedup key different from Team chuẩn.
- [x] Duplicate comparisons use three hero identity variants plus tactics assigned to each hero; holder display order and tactic slot order do not create a new build, but moving tactics between heroes does.
- [x] Khai hoang remains latest-maintained in its current tab/data; source Recommended Khaihoang category, if present, stays Recommended reference content.
- [x] Public artifacts are declared and validated; internal evidence/provenance is not exposed beyond allowed source reference fields.
- [x] Existing TeamPK/MetaCu legacy corpus, IDs, hashes, MCP contracts and old links remain backward compatible; records with unresolved identity/alternatives stay internal pending review and counts are disclosed.

## Unresolved

- No product naming question remains. Full Team chuẩn corpus count, Team khác admission count, duplicate count and unresolved identity count are implementation discovery outputs.

## Readiness review

2026-09-12: **Completed and release-gated.** Published generation `996d7b36b9954e64d24358cbb0fb1371a18a39e72748c8ceb1a837add76f88e5` covers all 87 advertised scopes with explicit complete/empty/uncollected states. [Validation evidence](./reports/validation.md) records corpus counts, hashes, rollback, automated checks and browser proof. Mandatory final review and Kongming phase gates returned GO; unresolved identities and alternative branches remain internal review state rather than guessed public data.

<!-- slug: recommended-season-browser -->
