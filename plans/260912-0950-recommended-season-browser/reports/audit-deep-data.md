# Phase 1 deep/TDD data audit

Date: 2026-09-12. Read-only audit of implementation; only this report was added.

Plan paths below are relative to `/Users/plateau/Project/CamNangTQCCL`. Code/test/data paths are relative to `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`.

## Verdict

**Needs revision before calling Phase 1 execution-ready for `--deep --tdd`.** The desired behavior and important boundaries are sound, but five executable contracts are missing. This is a planning-sufficiency verdict, not a demand that pending implementation already exist.

Preserve the accepted initial intake decision: existing local nonduplicates do **not** require fresh research or battle reports. `plans/reports/brainstorm-260912-team-chuan-team-khac.md:30-32,51` explicitly permits that intake and forbids inventing variant combinations. Unknown identity is a separate dedup problem, not a provenance gate.

## Prioritized findings

### 1. P1 — Full acquisition has no executable scope inventory or completion rule

Evidence: `phase-01-start.md:18,30-37,76-79,107-109` promises all selected season/category scopes, resume markers and 29 season options but never defines the selected set, acquisition owner/command, or manifest membership schema. `reports/browser-research.md:3,45-46` says no all-season acquisition occurred. The only current CLI is offline `--cache/--output` (`pipeline/sgsdeck_recommended.py:284-289`); its inventory is capped at 501 entries and supports exactly one list (`:228-253`). The list parser equates its first advertised count to extracted cards (`:129,157-159`), while the plan itself warns that counts may be season-wide (`phase-01-start.md:125`).

Consequence: importing the known scope plus 29 dropdown labels can satisfy a loose interpretation of “selected” without discovering all requested Recommended content. A many-scope manifest can also retain the old 501-total cap accidentally. A zero category and an uncollected season need different evidence states.

Correction: name an acquisition runbook or script owner (browser/manual capture is acceptable), enumerate the discovered season/category scope matrix, and freeze the intended scope set for a snapshot. Specify scope URL/ID binding, list-page membership, card URLs, source count meaning, observed count, missing URLs, completion/empty/uncollected/blocked states, resume checkpoint semantics, and per-file/per-scope limits. A shared detail URL may be cached once and referenced by several scopes; distinguish duplicate cache entries from valid scope membership. Define how a source legitimately removing a card differs from incomplete acquisition.

Required Red cases: nondefault URL served with default-season/category HTML; interrupted/resumed acquisition; two scopes sharing a detail; missing list-page/card coverage; zero category versus uncollected season; more than 501 aggregate entries; source total not equal to category count. Green must prove the entire intended scope matrix is reconciled, without deriving category counts from unrelated labels.

### 2. P1 — Exact cross-language hero/tactic identity bridge has no owner or format

Evidence: `phase-01-start.md:23-26,42,60-66,82-83` requires exact identity IDs and base/SP/CO/40Y separation but lists no alias/mapping input or identity resolver contract. Source records currently expose Chinese `nameRaw` and `tacticSlotsRaw` (`pipeline/sgsdeck_recommended.py:190-205`) and deliberately have `canonicalRef: null` (`:258`). Local rows use Vietnamese names (`data/teams.json:141-155,176-191`). `js/hero-identity.js:5,22-25,29-43` derives Latin slugs and recognizes only SP/CO variant metadata. It is not a verified Chinese-to-Vietnamese mapping and reports 40Y as base. The assigned `pipeline/sgsdeck_identity.py` is absent from this worktree.

Consequence: the dedup algorithm can be mathematically correct yet fail to compare equivalent source/local builds, or hold almost the whole initial intake because identities never become comparable. Treating an unmapped Recommended row as irrelevant can falsely prove a local build distinct.

Correction: identify the actual reviewed hero **and tactic** alias authority, or explicitly own a bounded mapping artifact and resolver. Define resolved/ambiguous/missing output, exact variant identity, mapping version/hash, conflict handling, and the policy when an unresolved Team chuẩn row prevents a negative dedup conclusion. Do not create canonical IDs through transliteration or import JavaScript slug generation as a cross-language resolver.

Required Red cases: a reviewed Chinese/Vietnamese equivalent compares equal; base/SP/CO/40Y differ; same family does not collapse variants; unknown hero and unknown tactic cannot establish distinctness; conflicting alias stays pending; mapping revision invalidates/recomputes membership. Use reviewed fixture mappings, with expected IDs and evidence, rather than guessed aliases.

### 3. P1 — Legacy variants are mentioned but extraction of real alternatives is undefined

Evidence: `phase-01-start.md:41,46,81,96-99` talks about “rows and variants” without defining an intake record or how a variant is obtained. Actual local data has separate alternatives on several tactic slots (`data/teams.json:147-156,182-192`) and slash-separated hero names (`data/teams.json:3522,5256,6422`). `js/hero-identity.js:68-93` enumerates hero slot alternatives but establishes no complete build combination. The brainstorm explicitly says not to synthesize combinations absent from the source (`plans/reports/brainstorm-260912-team-chuan-team-khac.md:51`).

Consequence: a Cartesian expansion invents builds; taking only first choices loses source-supported alternatives; treating a whole row as one build can discard unrelated configurations when one matches Team chuẩn.

Correction: define a ledger candidate as one explicit complete configuration with stable legacy team ID plus variant/config ID, source-row pointer and provenance state. State which local representation proves a complete configuration, how exact primary configurations are retained, and when uncorrelated slot alternatives become review-pending instead of expanded. Define whether multiple Recommended matches are stored as a list, and how a legacy link chooses a stable destination without deleting other variants.

Required Red cases: one explicit duplicate and one explicit distinct variant under the same team; multiple independent slot alternatives with no complete-build evidence; slash hero alternatives; stable IDs after rerun/reorder; known versus unknown legacy source labels. Assert initial resolved nonduplicates with no new battle report still publish.

### 4. P1 — Source-missing slots remain conflated with failed extraction

Evidence: `reports/browser-research.md:33` explicitly requires support for truly source-missing slots without weakening mismatch checks. `phase-01-start.md:19,95,111` retains a two-tactic-slot requirement but supplies neither a missing-slot representation nor a Red case. Current parsing rejects any empty tactic and pads books with empty strings (`pipeline/sgsdeck_recommended.py:193-203`). The existing incomplete-stream test deliberately rejects missing streamed content (`tests/test_sgsdeck_recommended.py:68-70`).

Consequence: legitimate incomplete source configurations may block a scope, or an implementer may allow empty strings and silently accept truncated/changed HTML. Dedup then cannot distinguish source absence from unknown identity.

Correction: define slot state and source evidence separately: populated, explicitly source-empty, and extraction-error/unresolved. State which source states may appear in reference display and which are insufficient to prove distinctness. Retain three-holder/order and list/detail parity guards. Add an owning real-source fixture when an empty-slot example is discovered; do not claim such an example has already been observed.

Required Red cases: explicit source-empty tactic/book preserved without invented content; missing streamed fragment still rejects; unsupported/missing slot label is not treated as source-empty; source-empty/unknown identity cannot accidentally compare equal to a populated slot. Preserve raw details even when canonical dedup remains pending.

### 5. P1 — Atomic publication promises do not define one coherent snapshot transaction

Evidence: `phase-01-start.md:25,50-54,84-85,101-102` requires atomic Team chuẩn refresh, Team khác recomputation and aggregate manifests, but does not define a transaction boundary. Existing atomicity is one `os.replace` of one output (`pipeline/sgsdeck_recommended.py:266-280`). Existing coverage guards are per-source-season only (`:269-274`). Current tests cover one output surviving checksum failure, not a whole projection bundle (`tests/test_sgsdeck_recommended.py:123-139`).

Consequence: independent atomic writes can expose new Team chuẩn with stale Team khác or a manifest that names missing details. A failure between writes violates the stated invariant even though every individual write is atomic.

Correction: specify one generation/snapshot ID binding intended scope inventory, accepted source hashes, identity-map version, dedup-key version, index/details and Team khác membership. Stage and validate a full generation, then switch one manifest/pointer only after all referenced files are present; preserve the previous generation. Define stale fallback and blocked-scope treatment explicitly so last-good evidence is not mislabeled as freshly acquired.

Required Red cases: injected failure after source staging and after dedup staging leaves old snapshot byte-identical/readable; mixed-generation hashes rejected; failed aggregate validation leaves all old links valid; successful refresh reclassifies a formerly distinct local variant; scope shrink requires explicit observed cause. Restart/resume must never publish a half-built bundle.

## Minimum interface and test inventory

The plan can name equivalent interfaces, but should make these boundaries explicit:

| Boundary | Required inputs / outputs | Test owner |
|---|---|---|
| Acquisition handoff | frozen scopes, rendered cache, scope/list/detail membership, checkpoints, count semantics, checksums | source tests plus acquisition/runbook validation |
| Source parser/join | requested scope + cache → raw records and distinct empty/blocked states | `tests/test_sgsdeck_recommended.py` |
| Identity resolution | source/local names + reviewed mapping version → exact IDs or reasoned unresolved result | new identity-focused tests, or named section of dedup tests |
| Legacy extraction | existing row + explicit build evidence → stable candidate(s), pending alternatives | `tests/test_recommended_team_dedup.py` |
| Dedup | exact holder→tactics multisets + whole accepted corpus → key, decision, all matching references | `tests/test_recommended_team_dedup.py` |
| Projection/publication | generation + validated source/decisions → allowed public fields, coherent manifest | new `tests/test_build_recommended_reference.py` (not currently in Phase 1 file list) |

Also add direct cases for holder/tactic-slot permutation equality, tactic ownership change, multiplicity, books/stats/season insensitivity, same source title/heroes with different config IDs, nullable score ordering, unknown raw facet retention, and exclusion of internal pending/provenance fields from public payloads. These are behavior contracts, not a requirement to add new abstraction layers.

## Verified baseline and Red discipline

Ran in the implementation worktree:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_sgsdeck_recommended -v
```

Result: **14 passed**. Existing source tier independence is already proven by `tests/test_sgsdeck_recommended.py:39-48`; do not report it as newly Red merely because the new S28 fixture is absent. Pin the new S28 behavior that actually fails, or classify the existing rule as regression. New tests in this report are proposed gates; no Red failures were recorded and no implementation was changed during this audit.

Status: DONE_WITH_CONCERNS

Summary: Phase 1 captures the accepted product direction but needs five concrete data/acquisition/test contracts before deep/TDD execution. The existing 14 source tests pass.

Concerns/Blockers: No product clarification needed. Resolve identity authority, scope inventory/acquisition handoff, actual variant extraction, missing-slot states and snapshot transaction design in the plan. The requested identity Python file is absent.
