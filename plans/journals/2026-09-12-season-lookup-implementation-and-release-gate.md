---
title: Season lookup implementation and release gate
date: 2026-09-12
summary: Season implementation delivered; release validation blocked by clean-source gate.
---

# Season lookup implementation and release gate

## What happened

Implemented seasonal registry, data, UI and eight Research MCP tools. One VN scenario and five reference groups preserve 25 teams and 75 hero positions; zero reviewed VN rulesets, configs or evaluations are promoted. Nine legacy artifact hashes are unchanged.

## Decisions and evidence

User invoked --auto --advice --tdd with Kongming authority. Scenario-only stays reference; gameplay requires a reviewed pair. Team scores keep Điểm SGSDeck tied to exact configuration and selection. Khai hoang stays latest-maintained. Kongming closes phases 1–3 and records phase 4 implementation complete with release validation open.

User subsequently answered the optional rights question YES, including Recommended on the website. Authorization is closed; score publication still requires verified exact config, source context and selection evidence. No data promotion follows merely from permission.

Final checks: MCP 351, Workerd 3, Node 186, Python 187, Vision 53, dist 13, E2E 55 pass; verify 43 files and 40 raw assets. See ../260907-0233-season-team-lookup/reports/final-validation.md. Initial 11 resolver cases and supplementary regression cases did not have pre-code Red; this gap remains disclosed.

## Next steps

Actual asset builder exits 1 SOURCE_NOT_CLEAN; repository gate exits 1 at Wrangler for missing .worker-assets. Preserve WIP, prepare authorized clean source identity, then run real asset build, verification and matching packaging gates. Plan remains in-progress. No deploy, commit, stash, fake assets or guard bypass. AgentWiki publish skipped; local history only.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

Storage note: created with `ak journal create` in the repository cwd; the CLI matched enclosing registry `plateau`. The same file was relocated without overwrite into this repository's `plans/journals/`; no duplicate or registry edit.
