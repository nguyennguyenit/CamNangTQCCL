---
title: "MCP P* cutover, snapshot v3, knowledge dataset, skill rework (TDD cook)"
date: 2026-10-08
summary: "Implemented phases 1, 1b, 2 of plan 260927-1727 on feat/mcp-skill-redesign; all local gates green; nothing deployed"
---

# MCP P* cutover, snapshot v3, knowledge dataset, skill rework (TDD cook)

## What happened
- Worktree `../worktrees/CamNangTQCCL-mcp-skill-redesign` (branch `feat/mcp-skill-redesign` from main@9291400). The plan dir was uncommitted WIP in main and was copied into the worktree.
- Phase 1b: 8 adapter bugs fixed in `recommendRoster` and the shared adapter, with real-data fixtures. Phase 1: snapshot v3 publication projection, then a cutover to the 7 P* tools (8 old names removed). Phase 2: `agent-knowledge/` dataset, knowledge core, playbook, `search-rules` CLI, the new `tqccl-lookup` skill, and coexist/research reworked.
- Code review found that MCP suggested a locked team's tactic as a substitute while the web did not. Cause: `canonicalTacticId` is not idempotent on `tactic:` ids. Fixed with an ID-aware key and locked-team parity tests. Also fixed: the playbook size budget (research is at ~33.9k of the 40k cap), finite `sourceScore`, and `tools/list` slimmed to ~85 KB so the 98304 cap stays.
- Changing UI strings meant republishing the localization (new Recommended generation 9945cf05) and re-pinning the route-handle ledger.

## Lessons
- Subagent tool paths resolve against the main checkout. Three agents wrote into main by mistake and reverted. Pass absolute worktree paths from the start.
- Several agents wrote code before tests even under `--tdd`. The review fixes did follow RED→GREEN.

## Next steps
- Owner review of the rule-migration ledger; calibrate retrieval thresholds.
- Ship website (phase 1b step 9); phase 1 step 0 live check; Dewee R0–R2 on `tra-eval`; then phase 3 evolution `suggest_only`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
