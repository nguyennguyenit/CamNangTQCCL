---
phase: 3
title: "Browser parity and legacy cutover"
status: completed
priority: P1
effort: "1.5d"
dependencies: [2]
---

# Phase 3: Browser parity and legacy cutover

<!-- Validation 2026-07-23: decisions 1A and 4A applied. -->

## Overview

Run the same browser contract against Astro preview, reconcile only migration regressions, then remove the duplicated root HTML entry.

## Requirements

- Preserve ten hashes, runtime JSON failure semantics, storage continuity, local UI, mobile menu, and first-party console/network cleanliness.
- Never call the paid Vision endpoint; production integration requires a separately authorized release.
- Remove `index.html` only after legacy and Astro targets both pass.

## Architecture

```text
one parity spec -> legacy HTTP target ─┐
                                     ├─ same assertions -> parity decision
                  Astro preview target┘
parity green -> delete root index.html -> Astro becomes sole document authority
```

## File Inventory

| Action | File | Rough size | Test impact |
|---|---|---:|---|
| Modify | `/Users/plateau/Project/CamNangTQCCL/tests-e2e/spa-parity.spec.mjs` | configuration only | Enable Astro target; assertions frozen in Phase 1. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/playwright.config.mjs` | +15–25 | Built Astro preview target and mobile viewport. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/scripts/verify-astro-dist.mjs` | small | Keep one Phase 2 verifier implementation; tests and CLI share it. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/package.json` | +8–15 | Final `test:e2e`, `test:dist`, `verify` gates. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/package-lock.json` | generated | Script/dependency lock only. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/tests-js/frontend-shell-contract.test.mjs` | +10–20 | Astro becomes sole target after cutover. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/js/app.js` | +1 | Replace obsolete root-HTML Python-server recovery text with host-neutral deployment advice after legacy characterization. |
| Delete | `/Users/plateau/Project/CamNangTQCCL/index.html` | 67 | Remove duplicate document authority after proof. |

## Function and Interface Checklist

- [x] `main()` initializes once with all required data.
- [x] `sectionFromHash()` covers valid, empty, invalid, and history navigation.
- [x] `loadOptionalJSON()` failure stays non-fatal.
- [x] Theme/tracker/roster keys survive reload on unchanged origin.
- [x] Roster serialization still strips forbidden fields.
- [x] `loadTurnstile()` remains de-duplicated; third-party failure is isolated.
- [x] All third-party requests are denied unless explicitly stubbed; icon rendering uses deterministic stubs.
- [x] Artifact has one app module tag; boot instrumentation proves one init and one handler effect per interaction.
- [x] `onOpenTeam()` still changes tab/search and scrolls.
- [x] Required-data failure retains placement/visibility semantics while its recovery message no longer assumes root `index.html` or a Python server.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | All hashes, reload, Back/Forward | Same active tab/section/hash. |
| Critical | Seed real schema-v1 state | Readable/editable after reload; no key rename. |
| Critical | Required vs optional JSON interception | Exact hidden Team-PK error on other hashes; fast optional failure is non-fatal; hanging optional request blocks render. |
| High | Team/search/tracker local flows | Render and mutate locally from committed data. |
| High | Turnstile blocked | No unhandled error; local site stays usable. |
| Medium | Desktop/mobile console and requests | No first-party failure; responsive menu works. |
| High | HTTPS shell with legacy HTTP icon URLs | Mixed-content behavior is characterized without permitting live third-party traffic; existing icon debt is recorded, not expanded into self-hosting work. |

## Dependency Map

- Depends on Phase 2 deterministic build.
- Blocks Phase 4 cutover/release docs.
- Serialize with MCP edits to shared `js/` and tests; this phase itself should not change domain semantics.

## Tests Before

1. Enable the frozen Phase 1 parity spec against `npm run preview`; capture failures.
2. Do not add or weaken assertions after observing Astro; a new requirement must first pass the legacy target.
3. Require legacy target to remain green until failures are classified.

## Refactor

Fix Astro shell/endpoint integration only. If a test reveals a pre-existing product bug, record it separately rather than expanding migration scope.

## Tests After

- Run the unchanged parity assertions against both targets.
- Delete `index.html`, switch contract to Astro source/output, and rebuild from clean output using the scoped source inventory.
- Verify no HTML duplication remains and artifact hashes are stable.

## Implementation Steps

1. Run dual-target matrix; classify every delta with trace/network evidence.
2. Correct migration-owned markup, route, or boot-order defects.
3. Fulfill a synthetic `https://astro.local/` origin entirely from `dist/` through Playwright routing; assert mixed-content behavior without certificates or live third-party requests.
4. After legacy behavior is frozen, update only the obsolete recovery guidance and prove its error semantics remain unchanged.
5. Run full gates twice.
6. Delete legacy entry; rerun build/contracts/E2E and inspect final `dist/`.

## Success Criteria

- [x] Same E2E spec passes both targets before deletion and Astro after deletion.
- [x] No root JS/data/CSS behavior or public URL changed.
- [x] One document authority remains.

## Verification Results — 2026-07-25

- Before cutover, the same expanded Playwright spec passed legacy and Astro:
  `22/22`. The only intentional runtime-copy change was host-neutral required-data
  recovery guidance, first observed red on legacy and then green on both targets.
- After deleting root `index.html`, Playwright runs only the `astro` project and
  passes `11/11`. The source contract passes `8/8` and explicitly requires the
  legacy entry to remain absent.
- Browser coverage preserves ten hashes, Back/Forward, storage schema-v1 reload,
  required/optional/hanging JSON behavior, Turnstile isolation, mobile menu,
  local search, and roster `onOpenTeam()` tab/search/scroll behavior.
- The synthetic HTTPS origin is fulfilled from `dist/`; external images are
  deterministically stubbed, Chromium upgrades legacy HTTP icon requests to
  HTTPS, and normalized paths outside `dist/` are rejected with regression
  cases for absolute and encoded parent paths.
- Full root/Python/Worker gates passed twice: Astro diagnostics `0`; dist
  contract `6/6`; verifier `34` files (`33` raw assets); Node `99/99`; Python
  `82/82`; Worker `53/53` plus typecheck. The pinned Node `22.16.0` root gate
  separately passed check, build, dist/verifier, Playwright `11/11`, and Node
  `99/99`.
- Consecutive Node 24 builds and the pinned Node 22 build produced the same
  deterministic `dist/` digest:
  `5c91f2798bbf2fa1e6172ad492a5eb1d140e1560515107ce14befd7fc80dd987`.
  No Astro dev/preview process remained after the gates.
- Independent tester, debugger, and code-review passes found no remaining Phase
  3 blocker after the synthetic-origin containment and browser assertions were
  strengthened.

## Regression Gate

```bash
npm run check
npm run build
npm run test:dist
npm run verify
npm run test:e2e
npm run test:node
python3 -m unittest discover -s tests
(cd worker && npm ci && npm test && npm run typecheck)
```

## Risk Assessment

Do not weaken parity assertions to make Astro pass. Roll back the shell/endpoint change if DOM, URL, storage, or boot-order parity cannot be achieved without rewriting domain behavior. Existing HTTP icon URLs are recorded debt; this migration neither contacts them in E2E nor takes ownership of hosting them.
