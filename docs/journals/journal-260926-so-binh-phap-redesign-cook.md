# Sổ binh pháp redesign — cook run (2026-09-24 → 2026-09-26)

Plan: `plans/260923-1949-so-binh-phap-redesign/plan.md` (10 phases, `--tdd --advice --auto`, decision authority delegated to Kongming). One commit per phase on `main`, pushed.

| Phase | Commit | Kongming rounds |
|---|---|---|
| 1 Token, font, component nền | 3f4c7ac | NO-GO ×2 → GO |
| 2 Đường dẫn + layout | 65666d4 | NO-GO ×2 → GO |
| 3 Header/menu/footer | 8b23fe5 | NO-GO → GO-with-nits |
| 4 Landing | a30a8da | NO-GO → GO-with-nits |
| 5 Đội danh sách | 4fcdd0d | NO-GO → GO-with-nits |
| 6 Chi tiết đội | 1b55353 | NO-GO → GO-with-nits |
| 7 Tra cứu | c11b58a | NO-GO → GO-with-nits |
| 8 Cùng Tồn + Khai hoang | d28dd31 | NO-GO → GO-with-nits |
| 9 Công cụ Beta | a9f8cb5 | NO-GO ×2 → fixed by orchestrator |
| 10 Tối, a11y, docs | (this commit) | NO-GO → fixes verified by orchestrator (Kongming usage limit reached) |

## What the reviews kept catching
Every phase had a full green A2 gate on first submission, and every phase still got a NO-GO. Green suites did not catch: tooling that never exits, contrast regressions caused by token changes, same-document Back/Forward leaving stale renders, prototype-name hash lookups, outbound links missing `target`/`rel` in menus, stale roster recommendations after inventory edits, invisible focus on transparent inputs, and mobile targets under 44px. What caught them was inspecting the real browser across 1440/390/320 in both themes and exercising the actual state transitions.

## Delegated decisions
- Phase 7 load spike took 2058 ms, over the 2 s budget. Kongming approved build-time `hero-summaries.json` in the pinned generation, which brought it to 1029 ms. The narrow lazy-loading exception is recorded in plan decisions #1 and #12.
- Reviewed translate text was kept everywhere (e.g. credit "Được xây dựng bởi"). No human translation receipts were needed.

## Final state
Legacy CSS ceiling 657 → 0. Gate: check, build (1559 pages), verify, test:dist 28, test:node 347, e2e 258, unittest 377. A1–A7 ticked. Phase 10 fixes got no second independent review because the Kongming runtime hit its usage limit. The orchestrator re-verified the dead-token grep, the doc claims against code, and the full gate.

## Open follow-ups (recorded in reports/phase-10-final.md)
- Theme follows OS only at page load. Live OS switching is not implemented; the docs say so.
- Whole-page bootstrap on section pages still loads shared publication data (red-team finding #18). A per-route loading project was deliberately not started.

## Opus re-review (2026-09-26)
Kongming was switched to `anthropic/claude-opus-5-5` and every phase was re-reviewed independently over four rounds. The re-review found blockers that the first review missed:
- Game dropdown clipped off-screen; header broken between 821 and 1279px; 404 page without a gutter.
- hero-summaries counted duyên phận slots and "Lưu ý" notes; rate floats; `null` building costs.
- Faction squares never drawn; detail action panel spilling off the left edge; default-blue source link.
- Pending ✓ marks in Soi đội; stale results reappearing after clearing.
- Several mobile targets under 44px.

Fixes were verified until phases 1–10 were all GO or GO-with-nits. Final gate: check, build 1559, verify, dist 28, node 349, e2e 278, unittest 379; `design-tokens --check` passes with legacy 0.

Open nits:
- Dark-theme selected chip vs page contrast (N8-1).
- Mùa change does not reset the Turnstile widget (N9-5).
- Mobile Landing table score column is only reachable by sideways scroll (N4-1).
- QR provenance does not reach the built SVG (N4-2).
- Source-data outlier `activationRate` 50 and editorial strings in catalog data.
