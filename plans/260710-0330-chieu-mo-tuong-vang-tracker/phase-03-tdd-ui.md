---
phase: 3
title: TDD UI
status: completed
priority: P1
effort: 3h
dependencies:
  - 2
---

# Phase 3: TDD UI

## Overview

Add the tracker tab and compact UI on top of the tested store. Keep `app.js` as orchestrator and put tracker DOM/event code in a dedicated module.

## Requirements

- Functional: user can manage accounts, daily slots, limited banners, 5-star records, and JSON import/export from the tab.
- Non-functional: vanilla DOM, safe text rendering, mobile-friendly controls, no nested cards, no hidden deferred features.

## Architecture

`index.html` adds nav/section. `js/app.js` imports and calls `initRecruitTracker({ heroesDict, mount })`. `js/recruit-tracker.js` renders state, binds event handlers, calls store operations, and saves after mutations. CSS adds tracker-specific classes in the existing stylesheet.

## Related Code Files

- Modify: `index.html`
- Modify: `js/app.js`
- Create: `js/recruit-tracker.js`
- Modify: `css/styles.css`
- Create: `tests-js/recruit-tracker-ui.test.mjs`

## Implementation Steps

1. RED: write a narrow UI/view-model test before UI code. Prefer a pure `buildRecruitTrackerViewModel(summary, heroesDict)` helper or a small fake-DOM render test, no new dependency.
2. Patch `index.html` nav and section.
3. Patch `js/app.js` to include `recruit-tracker` in `SECTIONS` and initialize after `heroesDict` loads.
4. Implement `js/recruit-tracker.js` with compact sections:
   - account bar + import/export
   - daily `Danh tướng PK`
   - collapsed limited banners
   - 5-star history
5. GREEN: implement only enough UI/view-model code to pass the test, then expand with additional failing tests for critical UI behavior when needed.
6. Add CSS for tracker layout, slot states, warning states, and mobile.
7. Verify no existing section navigation regresses.

## Success Criteria

- [x] `#recruit-tracker` deep-link opens the tab.
- [x] UI/view-model test fails before implementation and passes after implementation.
- [x] Account bar actions work and persist.
- [x] Daily slot buttons change status and update pity.
- [x] `Ra 5★` form records free-text hero and updates history.
- [x] Limited banner actions work.
- [x] Export/import UI uses validated store functions.
- [x] Mobile layout remains readable and controls do not overlap.
