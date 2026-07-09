---
phase: 4
title: Frontend scan review UI
status: completed
priority: P2
effort: 1.5d
dependencies:
  - 2
  - 3
---

# Phase 4: Frontend scan review UI

## Overview

Add the `Gợi ý đội từ kho` tab. The UI guides users through upload, scan review, correction, and recommendation.

## Requirements

- Functional: new nav section and tab separate from `Soi đội từ ảnh`.
- Functional: upload/paste images by scan type: heroes, tactics, built teams.
- Functional: review step is mandatory before recommendation.
- Functional: review tables support remove item and search-add from local dictionaries.
- Functional: recommendation result shows portfolio 5 teams, add teams, blocked strong teams, and diagnostics.
- Functional: localStorage stores scan result, not image/base64.
- Non-functional: mobile-friendly, no nested cards, no extra dependencies.

## Architecture

New modules:

```text
js/roster-scan-state.js
  createInitialRosterScanState()
  applyScanResult()
  removeItem()
  addCanonicalItem()
  serialize/deserialize localStorage shape

js/roster-scan-map.js
  map scan result from Worker to Vietnamese canonical names

js/roster-recommend-ui.js
  render tab, scan controls, review tables, recommendation output
```

`js/app.js` loads data once and passes dependencies:

```js
initRosterRecommend({
  teams,
  teamTier,
  heroesDict,
  tacticsDict,
  workerConfig,
  onOpenTeam
}, mount)
```

Persisted state:

- localStorage key: `tqccl.rosterRecommend.scanState.v1`.
- Allowed: canonical hero/tactic names, confidence, level/redStars if scanned, locked team names/tactics, timestamps.
- Forbidden: image data URLs, base64, blobs, raw uploaded filenames, Turnstile tokens.

## Related Code Files

- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/styles.css`
- Create: `js/roster-scan-state.js`
- Create: `js/roster-scan-map.js`
- Create: `js/roster-recommend-ui.js`
- Modify/create tests: `tests-js/roster-scan-state.test.mjs`, `tests-js/mobile-section-menu.test.mjs`, `tests-js/roster-scan-map.test.mjs`

## Implementation Steps

1. Write failing tests for scan state:
   - applying scan result merges without image storage.
   - serialization strips `image`, `imageDataUrl`, `base64`, `blob`, and `turnstileToken`.
   - remove/add canonical item works.
   - locked team tactics become locked constraints.
2. Write failing mapping tests for Chinese/Vietnamese canonical matching.
3. Add new section/tab and update mobile nav tests.
4. Build UI controls:
   - scan cards per image type,
   - review tables,
   - preference selector `Meta T0 -> T1` / `Nhiều hột`,
   - optional filter `Chỉ hiện đội build ngay`.
5. Wire recommendation button to `recommendTeams()`.
6. Render result groups:
   - `Portfolio sau khi build`
   - `Nên thêm`
   - `Team mạnh nhưng chưa build được`
   - `Cần scan/sửa thêm`
7. Run JS tests and local smoke.

## Success Criteria

- [ ] Tab `Gợi ý đội từ kho` appears and does not replace `Cùng Tồn` or `Soi đội từ ảnh`.
- [ ] User cannot run recommendation until review state exists/confirmed.
- [ ] Scan result stored in localStorage excludes image/base64.
- [ ] Test covers forbidden persisted fields.
- [ ] Mobile nav tests updated and passing.
- [ ] UI clearly distinguishes total portfolio from added teams when locked teams exist.

## Risk Assessment

- Risk: UI becomes too complex on mobile. Mitigation: 3-step wizard layout and compact tables.
- Risk: dictionary add/search duplicates existing behavior. Mitigation: reuse `match-dict.js` where possible.
- Risk: old analyze tab breaks from shared upload code. Mitigation: do not refactor `analyze.js` unless necessary; share only small helpers after tests.
