---
phase: 1
title: "Source coverage and dedup contract"
status: completed
priority: P1
effort: "3d"
dependencies: []
---

# Phase 1: Source Coverage And Dedup Contract

## Overview

Acquire the full Recommended season/category corpus with Python; produce raw Team chuẩn references and separately deduplicated existing Team khác configurations. Deliver a validated immutable generation for Phase 2 without activating browser UI or gameplay eligibility.

Effort: 3 working days provisionally split acquisition/parser/full-scope reconciliation (1d), reviewed mapping/legacy extraction/dedup (1d), and generation transaction/tests (1d). Full corpus and unmapped alias counts are not measured yet; re-estimate from the inventory instead of cutting scope if review exceeds this allocation.

Exact path aliases: `R=/Users/plateau/Project/CamNangTQCCL`; `W=/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`; `P=R/plans/260912-0950-recommended-season-browser`; `F=W/tests/fixtures/sgsdeck-recommended`; `C=W/.cache/sgsdeck-recommended`; `G=W/src/data/recommended-reference`. These abbreviate absolute paths, not system environment overrides.

Read [accepted brainstorm](../reports/brainstorm-260912-team-chuan-team-khac.md), [browser evidence](./reports/browser-research.md), [data audit](./reports/audit-deep-data.md), [Python probe](./reports/python-acquisition-probe.md). Environment: macOS/zsh, Node 24.20.0; preserve dirty main and four-file worktree spike. Python HTTP returned S28 list 200 / 333231 bytes / 93 records, and one detail 200 / 80021 bytes / 3 heroes, 6 tactics, 9 books. Only two pages were probed: Python viability, not corpus coverage or pinned HTML evidence.

## Requirements

- Acquire every observed source season (29 currently) across 開荒/交戰/器械, discovering actual query tokens; preserve new observed seasons/categories, never silently limit to Binh Diễn/S28.
- Preserve source IDs, URL/TW region, season/status/count metadata, raw category/faction/unit/tier/subcategory/stage, group/list order, unclamped nullable score, three ordered holders, two tactic positions, up to three book positions, stats, traits, intro, full notes and author. Unknown labels remain raw; Vietnamese labels require verified mappings.
- Initial Team khác admits existing explicit nonduplicates with original IDs and honest source state, without fresh research/chiến báo. Future external intake requires actual research/battle-report attribution; identity ambiguity remains a separate pending reason.
- Dedup exact base/SP/CO/40Y hero identities and assigned tactic multisets per hero against the whole accepted Team chuẩn corpus before filters. Preserve ownership/multiplicity; ignore leader role, display/slot order, books, stats, equipment, season, score and tier.
- Python acquisition is an explicit maintainer command; importer/builder remain offline from checksum cache. No runtime crawl, fuzzy canonical IDs, fake VN text, gameplay dictionary changes, score-derived tier, login automation or submission backend.

## Architecture

### Acquisition and scope contract

1. `crawl_sgsdeck_recommended.py` uses standard-library HTTP for public rendered HTML. Discover seasons/categories, freeze `scopeInventory`, then fetch every combination unless explicit source evidence proves category unavailable. Newly discovered options create a new inventory/run; never silently change a resumed inventory.
2. Cache manifest v2 includes `schemaVersion`, `runId`, `inventoryHash`, `seasonOptions`, `scopes`, URL-keyed `pages` and checkpoints. Scope fields: raw `sourceScopeId`, `safeScopeKey` (`s-` + full SHA-256 of canonical raw season/category pair), requested query tokens, source labels, list URLs/hashes, ordered detail URLs, `advertisedCountRaw`, `advertisedCountMeaning` (`scope|season|unknown`), `observedCardCount`, `missingUrls`, state/reason. Reject collisions/duplicate raw-key ownership.
3. States: `complete`, `empty-category`, `uncollected-season`, `blocked`. Crawl unfiltered lists; zero search matches is not empty-source evidence. Season-wide count is not category completeness. Follow every advertised page/load-more segment; browser verifies/captures rendered HTML when HTTP cannot expose it, using the same provenance contract. Extend URL queries only from observed public navigation, never guessed pagination.
4. Validate requested/returned scope, canonical URLs, all card membership, list/detail title/score/season/holder parity and explicit empty messages. Cache each URL once, allow multiple scope references. Scope membership owns list facets/ranking; later category joins cannot overwrite raw details. Preserve list URL/fetchedAt as well as detail provenance.
5. Sequential requests, minimum 1 second between starts, 30-second timeout, three total attempts for timeout/429/5xx, delays 2 then 4 seconds. Honor Retry-After up to 60 seconds; checkpoint/pause longer values. Other 4xx or redirects outside public allowlist block. Revalidate each redirect before requesting it. No credentials/cookies; browser fallback verifies unsupported pages rather than bypassing access controls.
6. Keep 4 MiB/page limit. Default caps: 10000 unique URLs and 1 GiB cache bytes/run. Cap hit pauses with checkpoint/reason, never truncates completeness claims. Resume checks URL+SHA-256 under the same inventory and refetches corrupt/incomplete entries. Record maintainer cap increases after inventory review.
7. Pages record original/final URL, status, fetchedAt, sha256, safe local filename, transport (`python-http|browser-rendered`) and parser outcome. Cache/checkpoints stay internal. Interruption preserves resume; reject concurrent cache writers. Do not log unrelated cookies/response headers.
8. All intended scopes require complete/empty/uncollected evidence before selecting a new generation. Blocked acquisition remains internal and preserves current selection; first run cannot publish a partial corpus. Source removals require a complete new list and explicit per-ID removal diff/reason; missing detail is never removal evidence.
9. The same crawler module owns `record_rendered_page(inventory, cache, capture)`, exposed by `--import-rendered-page <capture.json>` instead of network discovery. Capture metadata declares original/final public URL, status, fetchedAt, HTML file and SHA-256, requested scope and browser verification evidence. Validate inventory membership, URL/redirect policy, safe local regular file and size, checksum, parser/scope/parity through the same admission path as HTTP; set `transport=browser-rendered`. Capture alone never marks a scope complete. Test valid admission, wrong scope/hash/host, incomplete rendering and interrupted import; the runbook records the exact capture/import steps.

### Identity and actual legacy configuration contract

- Task-owned `recommended-identity-map.json` is the reviewed hero+tactic bridge: kind, exact source/local aliases, stable ID, hero variant, verified displayNameVi, review status and evidence reference; hash/version input. Existing root catalog mappings may seed candidates only after verification; absent in W, they do not make unified lookup a prerequisite. Never mutate gameplay dictionaries or treat JavaScript Latin slugging as Chinese translation.
- Read-only evidence inputs are `W/data/heroes-dict.json`, `W/data/tactics.json`, `W/data/books-dict.json` and `W/pipeline/aliases.json`. The mapping descriptor records each input SHA-256 and each accepted alias's evidence pointer; books aid display only, never the dedup key. Dictionary presence is evidence to review, not automatic alias acceptance. Changed evidence invalidates affected alias reviews until rechecked; absent/unresolved mappings stay explicit. No ad hoc transliteration.
- Resolver returns `resolved(id,variant)` or `missing/ambiguous(reason,candidates)`. Base/SP/CO/40Y differ. Ignore annotations only under reviewed alias rules. Unmapped Chinese remains displayable raw; mapping changes force complete dedup recomputation.
- `recommended-other-teams.json` records `legacyTeamId`, stable `legacyVariantId`, exact row/configuration pointer, configuration snapshot/hash, origin (`existing-local|external`), source state/label/evidence and review reasons. Fully specified primary holder/tactic selections are explicit builds. Slash hero fields and independent alternatives do not authorize Cartesian expansion. Admit separately documented complete variants; uncorrelated branches remain pending. Keep an exact primary build when another alternative branch needs review.
- Preserve original team ID; derive `legacyVariantId` from canonical explicit configuration content, independent of list order and distinct from gameplay configId. Same dedup key may retain separate provenance. One duplicate variant cannot remove another distinct variant. Internally retain all matching Team chuẩn scope/config references and stable legacy aliases.
- Two tactic positions per holder; slots carry `populated`, `source-empty` or `unresolved` state plus raw value. Explicit source-empty books/tactics display honestly; missing streamed fragments, expected labels or structure reject the page. Never convert extraction failure into empty. Source-empty/unknown identity cannot prove distinctness.
- Versioned key serializes sorted `(heroIdentityId, sorted assignedTacticIds)` entries, preserving multiplicity. A known duplicate stays duplicate even if unrelated source rows are unresolved. An unmatched candidate stays pending when unresolved source rows cannot be excluded using known exact identity/ownership evidence. Never ignore unmapped Recommended rows to prove uniqueness; report mapping gaps/counts.
- Existing-local origin needs exact dedup identity and honest source state, not new battle evidence. External origin also needs attributable research/battle-report evidence. Public Other includes `distinct` only; duplicate/pending evidence remains internal.
- `dedup-summary.json` separates configuration counts `primaryExplicitAdmitted`, `explicitVariantAdmitted`, `duplicate`, `pendingAlternative`, `pendingIdentity`; pending reason arrays may overlap but each candidate has one primary classification. Report input team-row count and rows containing alternatives separately from explicit configuration/branch counts, with row-to-decision references. Never advertise ambiguous alternatives as admitted teams or count raw rows as complete builds.

### Public generation and Phase 2 handoff

- Immutable `G/<generationId>/` contains `manifest.json`, `seasons.json`, `index.json`, `details-<safeScopeKey>.json`, `other-teams.json`. Generation ID is SHA-256 of canonical descriptor inputs/payload hashes excluding self-referential generation/hash fields; schemaVersion is explicit. Filenames allow lowercase ASCII letters/digits/hyphens plus `.json`; raw sourceScopeId is never a path. Reject unsafe paths, duplicate keys, undeclared files and broken references.
- Manifest binds frozen inventory/hash and per-scope snapshots, mapping hash, dedupKeyVersion, payload hashes/byte lengths, allowed scope/detail keys, internal decision snapshot hash and aggregate counts. Public manifest contains hashes/source-reference metadata, not ledger paths or review notes. Internal acceptance report binds detailed provenance.
- `seasons.json`: observed options/groups/statuses, scope availability, advertised counts/meaning, categories and `defaultSourceSeasonId`. Use the verified source default; if none is explicit, use the first source-ordered available season and record the fallback reason. It must reference an existing option. `index.json`: sourceConfigId, safeScopeKey, raw facets, group/list positions, holder tactics/books, reviewed labels, nullable score and detail key. Fixed order: source tier groups, score descending within group (null last), then list index/sourceConfigId. Preserve unknown raw group order.
- Scoped details use typed paragraphs/lists/text, never executable HTML; preserve holder conditions, stat focus, traits, intro, notes, author, URL/TW region. No automatic translation/gameplay eligibility fields.
- Other rows: `legacyTeamId`, `legacyVariantId`, exact holders/tactics/books, honest `sourceState/sourceLabel`, `sourceSeasonIds: string[] | null`, `seasonAttribution: [{sourceSeasonId,evidenceRef}]`. Null means unknown; empty season arrays invalid. Populate only from reviewed explicit source-season evidence; never infer TW season from local VN labels. Exclude pending/duplicate arrays/internal comments.
- Validate all staged files, finalize immutable directory, then atomically replace only `G/current.json` (`schemaVersion`, `generationId`, `manifestSha256`). This single selection commits the bundle; independent file replacements do not. Reject concurrent publishers; interrupted staging never changes selection.
- Retain selected and immediately preceding accepted generation locally; no automatic deletion here. Phase 2 publishes the selected generation only at `/data/recommended/current.json` and `/data/recommended/<generationId>/<safe-file>.json`, with exact-byte route inventory. An old HTML pin whose generation is no longer publicly available must show reload/unavailable rather than switch or mix bytes. Local retained generations enable rollback and rebuild, not a promise of public old-generation availability. Local selector atomicity does not imply atomic deployment; Phase 3 owns release coherency.

## Related Code Files

| Exact path via aliases | Action / responsibility | Dependency |
|---|---|---|
| `W/pipeline/sgsdeck_recommended.py` | Modify parser/v2 cache/join; preserve v1 callers | 14 source tests |
| `W/pipeline/crawl_sgsdeck_recommended.py` | Create HTTP discovery/acquisition/resume and browser capture import | shared URL/cache/structure guards |
| `W/pipeline/recommended_identity.py`, `W/pipeline/recommended-identity-map.json` | Create reviewed resolver/bridge | source + reviewed aliases |
| `W/pipeline/recommended_team_dedup.py`, `W/pipeline/recommended-other-teams.json` | Create extraction/ledger/classification | resolver + complete corpus |
| `W/pipeline/recommended_reference_schema.py`, `W/pipeline/build_recommended_reference.py` | Create Python validator/projection/selection | source + dedup |
| `W/tests/test_sgsdeck_recommended.py` | Modify source regressions/fixtures | parser |
| `W/tests/test_crawl_sgsdeck_recommended.py`, `W/tests/test_recommended_identity.py` | Create acquisition/resolver tests | crawler/resolver |
| `W/tests/test_recommended_team_dedup.py`, `W/tests/test_build_recommended_reference.py` | Create intake/key/generation tests | dedup/builder |
| `F/source-season-picker.html`, `F/source-s28-list.html`, `F/source-s28-detail.html`, `F/source-empty-season.html`, `F/source-empty-category.html` | Create rendered fixtures with provenance/checksums | real source capture |
| `F/identity-cases.json`, `F/legacy-build-cases.json`, `F/source-slot-states.html` | Create reviewed alias/build cases; real missing-slot fixture only when observed | reviewed evidence |
| `G/<generationId>/*.json`, `G/current.json` | Generate projection inputs; Phase 2 owns routes | accepted generation |
| `P/reports/acquisition-runbook.md`, `P/reports/source-coverage.json`, `P/reports/identity-review.md`, `P/reports/dedup-summary.json`, `P/reports/phase-01-tdd/` | Create runbook/inventories/actual execution evidence | implementation run |
| `W/data/teams.json`, `W/js/hero-identity.js`, `W/src/lib/public-artifact-manifest.mjs`, `W/src/lib/root-static-artifacts.ts` | Read contracts here; Phase 2 owns publication integration | preserve legacy/gameplay |
| `W/data/heroes-dict.json`, `W/data/tactics.json`, `W/data/books-dict.json`, `W/pipeline/aliases.json` | Read/hash reviewed identity/display evidence; no mutations | mapping descriptor/review |

No deletions. Do not adopt unfinished `W/src/lib/recommended-reference-data.mjs` spike.

## Interface Checklist And Dependency Map

| Producer interface | Caller / required output |
|---|---|
| `discover_scopes(html)` / `crawl_scope(inventory, cache, options)` | acquisition CLI → frozen inventory/resumable provenance; no runtime HTTP |
| `record_rendered_page(inventory, cache, capture)` | browser capture import CLI → same validated v2 page/checkpoint admission as HTTP |
| `parse_recommended_list(html, requested_scope)` / `parse_recommended_detail(html, url)` / `join_recommended_evidence(...)` | offline builder → validated raw records; compatible defaults for old callers |
| `resolve_identity(kind, raw, mapping)` | dedup/display → exact reviewed ID/label or reasoned unresolved result |
| `extract_existing_configs(rows)` / `dedup_key(config)` / `classify_candidates(candidates, corpus)` | builder → stable explicit configurations/internal decisions |
| `validate_generation(candidate)` / `build_generation(inputs)` / `select_generation(id)` | maintainer CLI → coherent immutable payloads then atomic selector |
| `manifest.json` + `current.json` | Phase 2 loader/routes → single generation, declared files and verified hashes |

Dependency order: discover/capture → parse/join → reviewed mapping → explicit intake/dedup → projection/transaction → Phase 2. Raw display does not require full catalog mapping; ambiguous dedup stays pending. Preserve season-team-lookup/MCP; unified lookup is optional alias evidence, not release prerequisite.

## Implementation Steps — Tests Before Each Change

Verified baseline: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_sgsdeck_recommended -v` passed **14 tests** in W on 2026-09-12; see audit. Additions are planned, not executed Reds. Each step records commands, exit codes, assertion output and fixture hashes in `P/reports/phase-01-tdd/<step>-{before,after,regression}.txt`. Missing dependencies/fixtures are environment failures, not behavioral Red. Tier independence/mixed faction/93-record parsing may already pass: preserve regression evidence, never manufacture Red.

1. **Acquisition + parsing:** TestsBefore → baseline plus inventory/scope/metadata/slot assertions; record actual failures. Refactor → crawler/parser to Green, then shared validation cleanup. TestsAfter → source+crawler suites and complete-scope offline validation. RegressionGate → prior 14 behaviors green; checksum/parity/login/stream guards strict; inspect browser fallback report.
2. **Identity + legacy dedup:** TestsBefore → reviewed aliases and real explicit/ambiguous local representations; record resolver/ownership/intake failures. Refactor → reviewed resolver, explicit extraction and multiset classifier to Green, then normalization cleanup. TestsAfter → identity+dedup suites and measured admission/duplicate/pending counts. RegressionGate → source+crawler suites green; exact initial nonduplicates lacking new battle evidence admitted.
3. **Projection + publication:** TestsBefore → schema/ranking/public-field/between-stage fault cases; capture old bytes. Refactor → offline projection, deterministic descriptor and single-selector commit to Green, then staging cleanup. TestsAfter → builder suite plus whole intended corpus build twice; equal inputs yield equal hashes. RegressionGate → all Phase 1 suites green; failed scope/dedup/hash validation preserves old generation and public Other is admitted-only.

## Test Matrix And Commands

From W run `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest <module> -v`. Fixtures resolve under F. Unit tests use no live network; transport faults use deterministic local HTTP server, never fake source data as coverage evidence.

| Fixture / scenario | Assertion (new Red where absent; passing behavior is regression) | Exact test file / module |
|---|---|---|
| picker/S28 list/detail/empty season/category | 29 options; URL/HTML scope match; 93 records; mixed faction; T2 82/72 same tier; 3/6/9 plus author/intro/trait; distinct empty states | `W/tests/test_sgsdeck_recommended.py` / `tests.test_sgsdeck_recommended` |
| multi-scope cache/shared detail/interrupted local transport | shared membership; stable resume; Retry-After/caps/redirects; >501 aggregate entries; missing pages/details block; count meaning retained | `W/tests/test_crawl_sgsdeck_recommended.py` / `tests.test_crawl_sgsdeck_recommended` |
| slot-states + existing streamed fragment | observed empty retained; unresolved pending; missing fragment/labels reject; no invented empty evidence | `W/tests/test_sgsdeck_recommended.py` / `tests.test_sgsdeck_recommended` |
| identity-cases | reviewed ZH/VN equal; `40Y 呂布` differs from base `Lữ Bố`; reviewed `當鋒摧決`/`当锋摧决` equal; unresolved Chinese cannot prove distinct; conflicting aliases pending; mapping/input revision invalidates decisions | `W/tests/test_recommended_identity.py` / `tests.test_recommended_identity` |
| legacy-build-cases from real rows | explicit primary retained; no Cartesian expansion; one duplicate preserves another distinct build; slash ambiguity pending; stable IDs/null season | `W/tests/test_recommended_team_dedup.py` / `tests.test_recommended_team_dedup` |
| permutations/ownership/multiplicity changes | permutations equal; ownership/multiplicity differ; books/stats/season ignored; possible unresolved match pending; all duplicate refs retained | same dedup file/module |
| existing unknown source vs external missing evidence | initial exact nonduplicate admitted honestly; external evidence missing rejected; no fabricated research label | same dedup file/module |
| two complete small generations + disk/validation faults | fixed/null ranking; raw labels/source IDs retained; public fields only; unsafe keys/hash mismatch/concurrent selector rejected; old bundle intact; refresh reclassifies Other | `W/tests/test_build_recommended_reference.py` / `tests.test_build_recommended_reference` |

Planned maintainer CLI interfaces (implement these; they do not exist yet):

```sh
python3 -m pipeline.crawl_sgsdeck_recommended --cache .cache/sgsdeck-recommended --all-source-scopes --resume
python3 -m pipeline.crawl_sgsdeck_recommended --cache .cache/sgsdeck-recommended --import-rendered-page .cache/sgsdeck-recommended/capture.json
python3 -m pipeline.build_recommended_reference --cache .cache/sgsdeck-recommended --identity-map pipeline/recommended-identity-map.json --other-ledger pipeline/recommended-other-teams.json --output src/data/recommended-reference
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_sgsdeck_recommended tests.test_crawl_sgsdeck_recommended tests.test_recommended_identity tests.test_recommended_team_dedup tests.test_build_recommended_reference -v
```

Runbook records commands/options, inventory/hash, rate/cap exceptions, fallback captures, removals, mapping reviews/counts; include resume and selector rollback. Acquisition occurs during authorized implementation, not this planning revision.

## Success Criteria

- [x] Every observed season/category reconciled; 29 current options retained; blocked scopes never omitted to select a partial generation.
- [x] Full raw configurations, count meaning and empty distinctions survive acquisition/join; scores/tiers/identity never guessed.
- [x] Reviewed hero+tactic mapping, explicit legacy extraction and variant/ownership/multiplicity dedup pass; initial missing provenance allowed, ambiguous identity separately pending.
- [x] External provenance gate works; admitted Other retains original IDs and explicit/unknown source-season attribution.
- [x] Generation binds all source/mapping/dedup/payload hashes; index/detail/Other agree; prior generation survives interrupted acquisition/publication.
- [x] Actual before/after/regression evidence exists per step; Phase 2 receives schema/sample generation/manifest/results; no UI/gameplay/MCP eligibility activated here.

## Risk Assessment And Rollback

| Observable signal | Response |
|---|---|
| HTTP 200 lacks content or reports wrong scope | Browser verifies/captures public page; pin parser fixture; remain blocked until verified. |
| Count semantics/pagination differ from sample | Reconcile membership/meaning; never weaken parity to fit a guess. |
| Unresolved mappings permit possible duplicates | Keep affected Other pending with counts; continue bounded reviewed aliases without gameplay changes/fake names. |
| Alternatives lack full-build correlation | Retain explicit primary/known variants and unresolved branches; no synthetic combinations. |
| Cap exceeded or refresh interrupted | Checkpoint/pause, inspect cap change; preserve prior selection and full scope. |
| Generation fails or pinned old HTML lacks files | Keep/reselect previous manifest and rebuild selected output; stale browser gets reload/unavailable without mixing. No automatic garbage collection. |

Rollback atomically selects previous validated `G/current.json` after verifying its manifest/files; retain cache/evidence. Revert parser changes without disturbing unrelated spike work. Never delete legacy teams, dictionaries, sidecars, Khaihoang or MCP data. Unresolved product questions: none; corpus counts, mapping coverage and real missing-slot examples remain measured implementation outputs.
