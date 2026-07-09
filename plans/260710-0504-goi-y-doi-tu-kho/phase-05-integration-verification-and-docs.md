---
phase: 5
title: Integration verification and docs
status: completed
priority: P2
effort: 0.5d
dependencies:
  - 2
  - 3
  - 4
---

# Phase 5: Integration verification and docs

## Overview

Run full verification, document the feature, and prepare commit/push. This phase proves the implementation meets brainstorm and red-team gates.

## Requirements

- Functional: all project test suites pass or any un-runnable suite is explicitly explained.
- Functional: docs mention new tab, mode-based Worker behavior, and boundaries.
- Functional: code review confirms no regression in `Soi đội từ ảnh`, existing team tabs, or data rendering.
- Non-functional: no secrets, no image data persisted, no deploy required in this phase.

## Architecture

Verification matrix:

| Area | Evidence |
|---|---|
| Engine | JS unit tests |
| Worker | Worker tests + typecheck |
| UI/nav | JS tests + local smoke |
| Existing data | Python tests + data tests |
| Docs | README/docs update if user-facing behavior changed |

## Related Code Files

- Modify: `README.md`
- Modify: `docs/project-overview-pdr.md`
- Modify: `docs/system-architecture.md`
- Modify: `docs/design-guidelines.md` only if UI guidance changes
- Create: `docs/journals/<timestamp>-goi-y-doi-tu-kho.md` if journal skill/workflow requires

## Implementation Steps

1. Run targeted tests after each phase, then final broad tests:
   - `node --test tests-js/*.test.mjs`
   - `python3 -m unittest discover -s tests`
   - `cd worker && npm test`
   - `cd worker && npm run typecheck`
2. Run local server smoke:
   - `python3 -m http.server 8000`
   - verify HTML/JS load and tab nav exists.
3. Update docs for new tab and Worker mode behavior.
4. Run code review against pending changes.
5. Fix any critical/important findings.
6. Commit and push via `ck:git cp` after secret scan.

## Success Criteria

- [ ] All automated tests pass.
- [ ] Code review has no open critical/important findings.
- [ ] Docs reflect the new tab and data boundaries.
- [ ] Git commit is focused and conventional.
- [ ] Push succeeds.

## Risk Assessment

- Risk: Worker tests require environment. Mitigation: use existing test harness/mocks; no real API call.
- Risk: local smoke cannot validate real Vision model due config/Turnstile. Mitigation: verify UI and pure flow locally; Worker behavior covered by tests.
- Risk: unrelated untracked reports exist. Mitigation: stage only files from this feature and plan/report files that belong to the requested workflow.
