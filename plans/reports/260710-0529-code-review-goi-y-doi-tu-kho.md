# Code Review: Goi y doi tu kho

Ngay: 2026-07-10

## Summary

Review pending implementation for `Goi y doi tu kho`.

Scope:

- New tab `Gợi ý đội từ kho`
- Local recommendation engine
- Roster scan state/map helpers
- Worker scan modes
- Tests/docs/plan artifacts

## Findings

None critical/important open.

## Review Checks

- Spec compliance: pass.
  - New tab exists.
  - AI only scans images; team selection is local engine.
  - Review scan is mandatory before recommend.
  - Missing required hero excluded from main recommendations.
  - No duplicate tactics in selected portfolio tests.
  - Worker modes are schema/prompt separated and default old analyze mode remains.

- Regression check: pass.
  - Existing `Soi đội từ ảnh` keeps default mode `analyzeTeamImage`.
  - Existing JS, Python, Worker suites pass.

- Privacy check: pass.
  - Scan state serialization strips image/base64/blob/Turnstile token.
  - localStorage stores canonical scan state only.

- Data boundary: pass.
  - Engine uses `teams.json`/tier input.
  - No direct `coexist.json` parsing in engine.

## Verification Evidence

- `node --test "tests-js/*.test.mjs"`: 82 pass.
- `python3 -m unittest discover -s tests`: 80 pass.
- `cd worker && npm test`: 53 pass.
- `cd worker && npm run typecheck`: pass.
- Static smoke `python3 -m http.server 8765` + curl `/`: HTTP 200 and new tab/section present.

## Residual Risk

- Real Vision accuracy still depends on deployed Worker/model and real screenshots; local tests cover schema and UI logic only.
- `coexist-sets.json` remains phase-later as designed.

## Unresolved Questions

None.
