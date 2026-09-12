# Deep plan validation — 2026-09-12

## Scope and evidence

Planning only, `--deep --tdd`. Two researchers, a planner, three adversarial
reviewers, then controller adjudication and cross-phase propagation. Current
code was read to verify claims; no proposed feature has been implemented.

- [Data research](research-data.md), [consumer research](research-consumers.md).
- [Security review](red-team-security.md): 20 selected claims verified.
- [Assumptions review](red-team-assumptions.md): 20 selected claims verified.
- [Failure review](red-team-failure.md): cross-boundary caller/rollback trace.
- [Decision validation](decision-validation.md): accepted user choices reused;
  no new interview or inferred user approval.
- [Controller baseline](controller-scout.md): existing snapshot valid, 13 Python
  and 26 Node tests passed. These are baseline tests, not feature Red/Green.

Standard verification tier: **40 current-code claims, 40 verified, 0 failed,
0 unverified**, ten per phase. Additional contract gaps below were found outside
those selected current-state claims. Thus 40/40 does not mean the draft had no gaps.

## Adjudication

Fourteen reviewer findings deduplicated into eleven: **5 High, 6 Medium,
0 Critical; 11 accepted, 0 rejected**. Fixes are evidence-backed engineering
clarifications within accepted scope; none reverses the user's source-priority,
Vietnamese UI, identity, or team-score decisions.

| # | Finding / original reviewers | Evidence | Disposition and plan owner |
|---|---|---|---|
| 1 | Filesystem MCP bypass — assumptions/failure, High | `mcp-worker/src/data/filesystem-data-source.ts:34–52`; `src/cli.ts:169`, `src/stdio.ts:43` under mcp-worker | Accept. P3 validates raw ingress, preserves genuine legacy roots/cached snapshot; P4 caller tests and exact workflow entrypoint/closure. |
| 2 | Legacy writer activation race — security/failure, High | `pipeline/build_dict.py:95–108,118–138` | Accept. P3 early activation/transaction guard plus shared lock and recheck at write boundary. |
| 3 | Promotion/recovery physical path boundary — security, High | `src/lib/root-static-artifacts.ts:55–61,92–101`; `pipeline/build_sgsdeck_catalog.py:165–175` | Accept. P3 fixed path set, real parent containment, bounded transaction ID, verified backups, traversal/symlink tests. |
| 4 | Missing activation code rollback record — failure, High | `src/lib/root-static-artifacts.ts:63–70`; `js/app.js:77–109` | Accept. P3 before/post code/config/test checkpoint bound to data journal; P4 full preflight/rehearsal preserves dirty preimages and stops on later edits. |
| 5 | Seasonal new-ID dependency outlives rollback — failure, High | `pipeline/build_season_data.py:232–245`; `pipeline/season_validation.py:86–91,117–147` | Accept. P3/P4 certified-generation handoff, pre-rollback dependent-ref validation, owner coordination/fix-forward; reciprocal season-plan note. |
| 6 | Preflight versus actual served bytes — security/failure, Medium | `src/lib/root-static-artifacts.ts:104–107`; `mcp-worker/scripts/build-worker-assets.ts:221–254` | Accept. P3 validator returns raw buffers, all readers reuse exact verified bytes; interleaving tests. |
| 7 | Directory durability ordering — security, Medium | `pipeline/build_sgsdeck_catalog.py:165–181`; `tests/test_build_sgsdeck_catalog.py:208–242` | Accept. P3 backup/journal/payload file and parent fsync ordering; simulated interruption is not real power-loss qualification. |
| 8 | Dev privacy fixture lacks actual private files — security, Medium | `tests-js/astro-dev-contract.test.mjs:81–90,179–180`; `astro.config.mjs:3–6` | Accept. P3 creates real sentinel files, asserts presence, probes direct/raw/module/fs paths with positive controls. Conditional config owner; no untested claim of an existing live leak. |
| 9 | Event acquisition union/choice semantics — assumptions, Medium | `data/sgsdeck/tactics.json:8192–8203` | Accept. P2 handles arrays/objects/null, nested/sibling condition resolution, any-N versus each-N and real event goldens. |
| 10 | Historical screenshot assertions read current data — assumptions, Medium | `tests-js/tactics-data.test.mjs:7,58–121` | Accept. P4 splits historical assertions onto frozen P1 tactics baseline; current-source assertions remain separate and strong. |
| 11 | Legacy reviews lack new metadata — assumptions, Medium | `pipeline/sgsdeck-name-map.json:4–17`; `pipeline/sgsdeck_identity.py:90–96` | Accept. P1 read-only legacy-origin adapter bound to accepted hashes; new decisions retain stricter metadata, no fabricated reviewer/date. |

Reviewer follow-up tables live in their original reports. All findings are
closed at the plan-contract level; their behavior still needs the execution
tests specified in each phase.

## Validation and task state

- No remaining product question requires repeating the accepted brainstorm.
- CLI scaffolding created four files but did not populate the complete index
  table. After reading live help and all stubs, controller normalized the table
  to the four existing pending phases; no status was toggled by hand.
- Plan files are task authority. No usable runtime task CRUD was exposed.
  `ak plan use` pins this plan; absent `set-active-plan.cjs` was not invented/run.
- `ak plan validate plans/260912-0607-unified-lookup --json`: valid, no errors.
- `ak plan status ... --json`: pending, 4 phases, 0 done, 0% progress.
- `ak plan resolve --json`: best match is this exact plan; explicit cook path
  remains recommended because another session is working on the season plan.
- Markdown link scan: 40 targets checked, 0 missing. Test-command path scan:
  every missing-on-disk target belongs to the explicit planned-create set.

## Whole-plan consistency sweep

Controller reread index and all four phases after review edits. Checked eleven
finding deltas plus the 40Y bridge, frozen-input DAG, one supplemental filename,
manifest/reader return contract, source priority, real-null semantics, translation
freshness, all source children, exact public/MCP inventories, and source-hidden
catalog versus team-score scope. Reconciled rollback WIP preimage wording,
candidate output-directory notation, effort range (8–13 days), filesystem runtime
entrypoint/closure, and actual stdio integration-test path.

The original source-priority proposal appears only as explicitly superseded
history. No remapped-source loop, extra MCP kinds, build-only filesystem reader,
manifest-only writer guard, implicit historical screenshot fixture, or automatic
season-file rollback remains prescribed. **Unresolved contradictions: 0.**

All three reviewers reread their affected contracts and closed their findings at
the plan level. Baseline tests are the only actual tests run for this planning
task. Future TDD, translation QA, candidate promotion and broad release checks
remain unchecked execution work. No runtime files were edited by this planning
task; concurrent source changes belong to other ongoing work.
