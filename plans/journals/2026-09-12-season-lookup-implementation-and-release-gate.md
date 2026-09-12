---
title: Season lookup implementation and release gate
date: 2026-09-12
summary: Season implementation and isolated clean-source release validation completed.
---

# Season lookup implementation and release gate

## What happened

Implemented seasonal registry, data, UI and eight Research MCP tools. One VN scenario and five reference groups preserve 25 teams and 75 hero positions; zero reviewed VN rulesets, configs or evaluations are promoted. Nine legacy artifact hashes are unchanged.

## Decisions and evidence

User invoked --auto --advice --tdd with Kongming authority. Scenario-only stays reference; gameplay requires a reviewed pair. Team scores keep Điểm SGSDeck tied to exact configuration and selection. Khai hoang stays latest-maintained. Kongming closes phases 1–3 and records phase 4 implementation complete with release validation open.

User subsequently answered the optional rights question YES, including Recommended on the website. Authorization is closed; score publication still requires verified exact config, source context and selection evidence. No data promotion follows merely from permission.

Final checks: MCP 351, Workerd 3, Node 186, Python 187, Vision 53, dist 13, E2E 55 pass; verify 43 files and 40 raw assets. See ../260907-0233-season-team-lookup/reports/final-validation.md. Initial 11 resolver cases and supplementary regression cases did not have pre-code Red; this gap remains disclosed.

## Release closure

The original dirty-source gate failures remain historical evidence. The user subsequently authorized an isolated worktree and durable local commits. Full repository gate, real asset build/verification, Wrangler dry-run and Workerd passed at `f2741f5`; Python ran 151 cases: 139 passed and 12 existing real-HTML cases skipped. See [closure](../260907-0233-season-team-lookup/reports/isolated-release-closure.md). Both checkout portability defects were repaired with their evidence preserved. All four phases are complete. The documentation-only closure commit requires a fresh asset identity and dry-run; final attestation is stored externally. Original code WIP is preserved. No push, merge, deploy, stash, fake assets or guard bypass. AgentWiki publish skipped; local history only.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

Storage note: created with `ak journal create` in the repository cwd; the CLI matched enclosing registry `plateau`. The same file was relocated without overwrite into this repository's `plans/journals/`; no duplicate or registry edit.

## Post-review repairs

Fixed both reproduced P2 issues in local commits `920a98f` and `e39db07`. Seasonal feasibility now reaches admitted tail configurations; full-box keeps its bounded DFS with a whole-pool greedy incumbent. Browser screenshots use per-test outputs, with a tracked-PNG hash guard. Eight engine regressions and the screenshot guard failed before the repair, then passed. Independent review found no critical/important defects; its9/10 score was retained and Kongming explicitly approved under user delegation.

Final clean-SHA repository gate passed: MCP351, Node194, E2E55, dist13, Vision53, Workerd3; Python139 passed and12 existing source-dependent skips. Real assets rebuilt successfully immediately after E2E, then verified and dry-run packaged; no manual screenshot restoration needed. Nine legacy data hashes unchanged. [Evidence](../reports/fix-260912-1610-season-review-findings.md). No push, merge or deployment. AgentWiki publish skipped.
