---
title: Recommended season browser delivery
date: 2026-09-12
summary: Built an evidence-bound SGSDeck Recommended browser with conservative Team khác deduplication and exact legacy navigation.
---

# Recommended season browser delivery

## What happened
Implemented the accepted three-phase Recommended season browser plan. The crawler reconciled 87 source scopes into 29 complete, 49 source-empty, and 9 uncollected scopes, producing 1,366 source configurations. Review found that the first dedup ledger did not bind itself to the corpus and skipped blank/alternative source holders and local primaries with alternatives.

## Decision
Publication now requires exact list/detail/index membership, a writer lock, immutable generation bytes, a build-lifetime selector pin, and matching HTML pin verification. Dedup version 1 compares exact hero identity plus assigned tactic ownership; unresolved source fields remain wildcards. Each of 166 local rows receives one primary decision: 40 distinct admitted, 19 exact duplicate, 107 pending identity, with 79 alternative branches kept pending without Cartesian expansion. Historical labels come from data/team-tier.json rather than star ratings.

## Verification
Python: 167 passed, 12 skipped. Node: 199 passed. Astro diagnostics clean. Dist: 137 files and 42 root assets verified; 13 dist tests passed. Affected Playwright suites: 60 passed, followed by the final Back/Forward restoration regression at 1/1. Direct built-browser inspection showed 25 Team chuẩn cards in the default source scope, 40 Team khác cards in all-season scope, correct historical tier text, and no horizontal overflow.

## Next steps
Keep unresolved identities and uncorrelated alternatives in the internal ledger until evidence supports exact mapping. Regenerate the ledger and immutable generation together whenever source cache, mapping, teams, or historical tier inputs change. Roll back only by selecting a previously revalidated generation and rebuilding.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
