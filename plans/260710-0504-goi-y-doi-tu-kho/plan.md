---
title: Gợi ý đội từ kho
description: >-
  Tab cá nhân hóa đội hình: scan kho tướng/chiến pháp/team đã build, review dữ
  liệu, engine local chọn portfolio 5 team cùng tồn.
status: completed
priority: P2
branch: main
tags:
  - frontend
  - worker
  - vision
  - tdd
  - team-recommendation
blockedBy: []
blocks: []
created: '2026-07-09T22:09:27.866Z'
createdBy: 'ck:plan'
source: skill
---

# Gợi ý đội từ kho

## Overview

Build tab mới `Gợi ý đội từ kho` cho CamNangTQCCL. User upload ảnh kho tướng, kho chiến pháp, và team đã build; app dùng Worker/Vision chỉ để đọc ảnh thành dữ liệu cấu trúc, cho user sửa nhanh, rồi engine local deterministic chọn portfolio 5 team nên build.

Plan này tổng hợp:

- Brainstorm: `plans/reports/260710-0440-brainstorm-goi-y-5-team-tu-kho.md`
- Red-team final: `plans/reports/260710-0452-red-team-final-goi-y-5-team-tu-kho.md`
- Red-team addendum: `plans/reports/260710-0504-red-team-brainstorm-addendum-goi-y-5-team-tu-kho.md`
- Plan audit + patch: `plans/reports/260710-0512-audit-plan-goi-y-doi-tu-kho.md`

## Scout Summary

- Project là static site vanilla JS, không bundler; frontend chính ở `index.html`, `css/styles.css`, `js/*.js`.
- Worker hiện có route `POST /analyze`, dùng Turnstile + rate-limit + image guard + Vision LLM, schema hiện tại chỉ cho `Soi đội từ ảnh`.
- Data chuẩn cho engine là `data/teams.json`, `data/team-tier.json`, `data/tactics.json`, `data/heroes-dict.json`; `data/coexist.json` là display data cho tab `Cùng Tồn`, không engine-ready.
- Tests hiện có: Node tests trong `tests-js/*.test.mjs`, Python tests trong `tests/`, Worker tests trong `worker`.
- Có plan cũ về `Soi đội từ ảnh` đã implemented/completed; feature mới mở rộng nhưng không được làm regression flow hiện tại.

## Requirements

- Expected output: tab mới `Gợi ý đội từ kho` trong UI, cho scan/review dữ liệu và xuất portfolio tối đa 5 team nên build.
- Acceptance: engine không đưa team thiếu tướng lõi vào 5 team chính; không trùng tướng/chiến pháp trong portfolio; giữ team đã build mặc định; full-box dùng search/backtracking giới hạn; Worker mode không đổi output mode analyze hiện tại.
- Scope: MVP chưa curate `data/coexist-sets.json`; chưa cần battle-report database; chưa cần OCR offline/browser-only; chưa cần deploy Worker.
- Non-negotiable: AI chỉ scan ảnh, không quyết team; engine dùng normalized data, không parse thẳng chuỗi display trong `coexist.json`; `Không trùng chiến pháp` là invariant, không phải toggle chính.
- MVP definition: all 3 heroes in a `teams.json` record are required heroes; missing any one excludes the team from main recommendations.
- MVP definition: tactic alternatives are explicit only; no automatic replacement by type/name similarity.
- Touchpoints: `index.html`, `css/styles.css`, `js/app.js`, `js/config.js`, `js/analyze.js`, `js/analyze-map.js`, new JS engine/UI files, `worker/src/model.ts`, `worker/src/schema.ts`, `worker/src/index.ts`, Worker tests, JS tests, docs.

## Architecture

```text
Images
  -> Worker /analyze { mode, image, turnstileToken }
  -> mode-specific schema:
       analyzeTeamImage | scanHeroes | scanTactics | scanBuiltTeams
  -> frontend canonical mapping
  -> review state in browser
  -> team-recommend-engine
  -> portfolio 5 teams + diagnostics
```

Engine inputs:

```js
{
  ownedHeroes: [{ name, level, redStars, confidence }],
  ownedTactics: [{ name, confidence }],
  lockedTeams: [{ teamName, heroes, tactics }],
  mode: "meta" | "redStars",
  keepExistingTeams: true
}
```

Engine output:

```js
{
  portfolioTeams: [],
  addTeams: [],
  blockedStrongTeams: [],
  diagnostics: {
    missingHeroes: [],
    missingTactics: [],
    tacticConflicts: [],
    searchedCandidates: 0,
    prunedCandidates: []
  }
}
```

Preset slots are included from MVP even before `coexist-sets.json` exists:

```js
{
  presetId: null,
  presetReason: "",
  coexistSetBonus: 0,
  source: "team" | "preset" | "search"
}
```

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Plan contract and test fixtures](./phase-01-plan-contract-and-test-fixtures.md) | Completed |
| 2 | [Recommendation engine TDD](./phase-02-recommendation-engine-tdd.md) | Completed |
| 3 | [Worker scan modes TDD](./phase-03-worker-scan-modes-tdd.md) | Completed |
| 4 | [Frontend scan review UI](./phase-04-frontend-scan-review-ui.md) | Completed |
| 5 | [Integration verification and docs](./phase-05-integration-verification-and-docs.md) | Completed |

## Dependencies

- Related completed plans:
  - `plans/260621-2324-screenshot-team-analyzer-vision-llm/plan.md`
  - `plans/260623-1440-soi-doi-binhthu-portrait/plan.md`
- Related pending but non-blocking plan:
  - `plans/260626-1600-cap-nhat-data-tuong-tier-ui/plan.md` already shipped parts of tier/heroes data; current work reads existing JSON only.

## Validation Gates

- TDD: write failing tests first for each logic phase.
- JS tests: `node --test tests-js/*.test.mjs`
- Worker tests: `cd worker && npm test && npm run typecheck`
- Python smoke: `python3 -m unittest discover -s tests`
- Manual local smoke: `python3 -m http.server 8000`, verify nav/tab render, old `Soi đội từ ảnh` still loads.

## Kill Criteria

- Engine parses `data/coexist.json` slash strings directly.
- Worker reuses one schema/prompt for all modes and changes existing analyze output.
- UI recommends before user review/confirm scan result.
- Team missing core hero appears in 5 main teams.
- Engine invents tactic alternatives not present in candidate/rule data.
- Portfolio is top-5 independent sort instead of conflict-aware selection.
- Full-box output cannot explain why a T0 candidate was skipped.

## Open Questions

None.
