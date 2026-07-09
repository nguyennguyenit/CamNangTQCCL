---
phase: 2
title: TDD store
status: completed
priority: P1
effort: 2h
dependencies:
  - 1
---

# Phase 2: TDD store

## Overview

Build the tracker state layer tests-first. This is the correctness core: accounts, banners, daily slots, pull events, derived pity, history, import/export validation, and corrupt-storage fallback.

## Requirements

- Functional: store can create accounts/banners, record miss/five-star events, derive pity/history, export/import JSON.
- Non-functional: pure functions where possible, no DOM dependency, no framework, deterministic local-date helpers.

## Architecture

`js/recruit-tracker-store.js` exports pure operations and a small localStorage adapter. `pullEvents` is source of truth; selectors derive pity/history. UI should not mutate raw state directly.

## Related Code Files

- Create: `tests-js/recruit-tracker-store.test.mjs`
- Create: `js/recruit-tracker-store.js`

## Implementation Steps

1. RED: write tests for default state, active account, default `Danh tướng PK`.
2. RED: tests for daily slot miss/five-star and derived pity reset.
3. RED: tests for limited banner `+1`, `+5`, and over-30 warning condition.
4. RED: tests for history sorting and free-text hero.
5. RED: tests for export/import validation and corrupt localStorage fallback.
6. GREEN: implement the smallest store API to pass tests.
7. Refactor names/helpers only after tests are green.

## Proposed Store API

```js
createDefaultRecruitTrackerState(now)
normalizeRecruitTrackerState(input)
createAccount(state, name)
renameAccount(state, accountId, name)
deleteAccount(state, accountId)
createLimitedBanner(state, attrs)
recordDailySlotMiss(state, { accountId, date, slotKey })
recordDailySlotFiveStar(state, { accountId, date, slotKey, heroName, note })
recordBannerMiss(state, { accountId, bannerId, pulls })
recordBannerFiveStar(state, { accountId, bannerId, pulls, heroName, note, date })
getRecruitTrackerSummary(state, { accountId, date })
validateRecruitTrackerImport(value)
loadRecruitTrackerState(storage)
saveRecruitTrackerState(storage, state)
```

## Success Criteria

- [x] Store tests fail before implementation for missing module/API.
- [x] Store tests pass after implementation.
- [x] Store functions avoid DOM and direct browser globals except adapter functions.
- [x] Pity is derived from event data or recomputed safely.
- [x] Invalid import never overwrites current state.
