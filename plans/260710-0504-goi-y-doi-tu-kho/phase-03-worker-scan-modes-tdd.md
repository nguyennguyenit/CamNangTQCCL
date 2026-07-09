---
phase: 3
title: Worker scan modes TDD
status: completed
priority: P1
effort: 1d
dependencies:
  - 1
---

# Phase 3: Worker scan modes TDD

## Overview

Extend the Worker route with mode-specific prompts and schemas while preserving current `Soi đội từ ảnh` behavior.

## Requirements

- Functional: existing `/analyze` payload without mode behaves exactly like current team analysis.
- Functional: payload may include `mode`:
  - `analyzeTeamImage`
  - `scanHeroes`
  - `scanTactics`
  - `scanBuiltTeams`
- Functional: each mode has separate prompt, validator, and result schema.
- Functional: invalid mode returns 400 before model call.
- Non-functional: keep Turnstile/rate-limit/input guard shared and unchanged.

## Architecture

```text
worker/src/schema.ts
  AnalyzeResult
  RosterHeroesScanResult
  TacticsScanResult
  BuiltTeamsScanResult
  parseAndValidateByMode(mode, text)

worker/src/model.ts
  buildRequestBody(modelId, imageDataUri, mode)
  promptByMode(mode)
  callModel(imageDataUri, opts, mode)

worker/src/index.ts
  mode = payload.mode || "analyzeTeamImage"
```

Worker still only returns raw model extraction; frontend maps Chinese/Vietnamese names.

## Related Code Files

- Modify: `worker/src/schema.ts`
- Modify: `worker/src/model.ts`
- Modify: `worker/src/index.ts`
- Modify/add: `worker/test/*.test.ts`
- Do not change: public route path `/analyze`

## Implementation Steps

1. Add failing Worker tests for:
   - default request still uses `analyzeTeamImage` schema.
   - invalid `mode` returns 400 without calling `callModel`.
   - each mode validates its own sample JSON.
   - current analyze sample still validates.
   - route-level default payload without `mode` preserves current response shape.
2. Add mode enum/type and schema validators.
3. Split prompt text by mode.
4. Thread mode through `buildRequestBody()` and `callModel()`.
5. Keep all existing guard/rate-limit/Turnstile behavior.
6. Run Worker tests and typecheck.

## Success Criteria

- [ ] `cd worker && npm test` passes.
- [ ] `cd worker && npm run typecheck` passes.
- [ ] Existing analyze tests still pass unchanged or with explicit compatibility assertions.
- [ ] Route-level baseline proves old `/analyze` payload works without user-visible schema change.
- [ ] Invalid mode is rejected before quota/model cost.
- [ ] Prompts/schemas are mode-specific, not one generic mega-prompt.

## Risk Assessment

- Risk: regression in current `Soi đội từ ảnh`. Mitigation: default mode compatibility test.
- Risk: schema too loose allows bad extraction. Mitigation: cap arrays/strings like current validator and reject missing required top-level arrays.
- Risk: Worker cost increases. Mitigation: mode validation happens before model call; existing rate-limit remains shared.
