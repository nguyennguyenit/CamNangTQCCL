# Controller scout — 2026-09-12

## Accepted contract

Owner: ../../reports/brainstorm-260912-1203-unified-lookup.md. Full six groups,
source-hidden Vietnamese lookup; SGSDeck meaningful fields win, preserve
IDs/names, missing/placeholder falls back to legacy. Identity review before
merge, translation done by agent. No team/score/season implementation, new MCP
catalog API, deployment or commits in planning.

## Current evidence

- Git: main, one worktree, existing tracked/untracked WIP. Season plan now
  in-progress; pipeline/build_season_data.py and tests/test_build_season_data.py
  appeared from another session. Do not reset or edit these.
- Reconciliation SHA-256 check: all nine inputs still match the analysis JSON.
- Snapshot: 805 parent, 708 children; 202 generals, 393 tactics, 114 equipment
  + 90 specials, 39 advisors, 16 troop mods + 192 options, 41 buildings + 426
  levels. Dictionaries have unique Vietnamese names.
- `python3 -m pipeline.query_sgsdeck_catalog validate`: valid six categories.
- `python3 -m unittest tests.test_sgsdeck_identity tests.test_query_sgsdeck_catalog`:
  13 passed.
- `node --test tests-js/hero-detail.test.mjs tests-js/hero-identity.test.mjs tests-js/tactics-data.test.mjs tests-js/match-dict.test.mjs`:
  26 passed.
- These are current narrow baselines, NOT new-feature Red/Green or broad
  build/release proof. Node v24.20.0 matches local pin.

## Integration observations

- Python stdlib, Astro static shell, vanilla JS, explicit public manifest.
- Source `load_catalog` accepts hero_path/tactic_path for canonical validation
  (`pipeline/query_sgsdeck_catalog.py:305`). Source inputHashes are build
  provenance (`pipeline/build_sgsdeck_catalog.py:317`), not compared to current
  dictionaries by load_catalog. Do not invent a current hash-validation failure.
- Unified builder reads frozen legacy inputs, accepted source snapshot and
  reviewed mapping/translations, never its own generated outputs. Use existing
  explicit input overrides for validating original SGSDeck refs. New unified
  identities belong in a separate registry; do not require a complete recrawl.
- effectViet must describe selected winning source text, not a stale old
  effect. Dated revisions are history/alternatives, not simultaneous mechanics.
- Staged offline generation with serialized promotion, rollback and generation
  verification is acceptable; never claim multi-file crash atomicy. Plan must
  choose one concrete mechanism and reject mixed generations at build/read.
- Four phases: identity/baseline; field merge/translations; public lookup/UI;
  consumer/build regression/handoff. TDD within every phase.

## Cross-plan scan

- SGSDeck catalog completed: prerequisite available, no pending blocker. Do
  not reopen importer or change its historical acceptance.
- Season plan in-progress: no whole-plan block. It owns scenario/config/score;
  this plan owns unified lookup/dictionary identity. Conditional dependency for
  configs needing new entities. Serialize shared dictionary/app/render/manifest/
  identity/MCP closure edits.
- June hero/tier index is stale pending over existing modules. Reuse them;
  do not rerun old phases or change their status.
- Research skill changes skill files, no runtime blocking dependency. Node
  runtime completed, preserve existing WIP.

## Plan mechanics

CLI created `260912-0607-unified-lookup` in UTC (13:07 local). Keep its directory;
do not create duplicate 1307 folder. All four stubs read. `ak plan use` pins
this explicit plan. `.claude/scripts/set-active-plan.cjs` is absent, so that
hook was not run or invented. No usable session task CRUD exposed; phase files
remain task owner. Reuse accepted decisions, no artificial re-interview.
