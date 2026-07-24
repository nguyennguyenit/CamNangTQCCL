---
phase: 1
title: "Freeze browser and asset contracts"
status: completed
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Freeze browser and asset contracts

<!-- Validation 2026-07-23: decisions 1A and 4A applied. -->

## Overview

Create tests that describe the current site before Astro changes the entry document. Use committed production-shaped domain JSON and a real Chromium browser; use synthetic sentinels only for user-owned storage fixtures.

## Requirements

- Preserve the ten-tab DOM/hash contract in `index.html:1-67` and `js/app.js:47-71`.
- Preserve six required JSON requests and optional `team-tier.json` behavior in `js/app.js:20-33,78-87`.
- Preserve `theme`, tracker, and roster storage contracts; no external Vision request.

## Architecture

```text
legacy index.html -> python HTTP server -> same Playwright parity spec
root data/js/css -> Node contract tests -> later Astro artifact comparator
```

## File Inventory

| Action | File | Rough size | Test impact |
|---|---|---:|---|
| Create | `/Users/plateau/Project/CamNangTQCCL/package.json` | 35–50 | Root scripts; isolated from `worker/package.json`. |
| Create | `/Users/plateau/Project/CamNangTQCCL/package-lock.json` | generated | Reproducible Astro/Playwright install. |
| Create | `/Users/plateau/Project/CamNangTQCCL/.node-version` | 1 | Pin supported Node 22 LTS for Pages parity. |
| Create | `/Users/plateau/Project/CamNangTQCCL/playwright.config.mjs` | 35–55 | Chromium, legacy/dist projects, trace on failure. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-e2e/spa-parity.spec.mjs` | 240–340 | Complete target-neutral browser characterization; frozen after this phase. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-e2e/fixtures/legacy-storage.json` | 20–40 | Synthetic sentinel schema-v1 tracker/roster/theme byte fixtures. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-js/frontend-shell-contract.test.mjs` | 70–100 | Stable metadata/nav/mount hooks. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-js/runtime-asset-contract.test.mjs` | 90–130 | Runtime file set, JSON shape, tier joins. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/.gitignore` | +5 | Ignore Astro/Playwright/build output. |
| Delete | None | 0 | Legacy entry remains test target. |

## Function and Interface Checklist

- [x] `sectionFromHash()` and `switchSection()` behavior characterized.
- [x] `loadJSON()` vs `loadOptionalJSON()` failures characterized.
- [x] `createMobileSectionMenu()` click/Escape behavior exercised in browser.
- [x] `createTeamFilterSection().setSearch()` remains available through live UI.
- [x] Storage keys and roster forbidden-field stripping remain covered.
- [x] Exact serialized legacy fixtures transfer unchanged between target contexts before load/edit/save/reload assertions.
- [x] Fixtures contain synthetic sentinel identities only; traces/output are ignored, never committed, and retained briefly with restricted CI access.
- [x] `loadTurnstile()` creates at most one script; network blocked in tests.
- [x] Third-party requests are denied by default; image responses are deterministic local stubs.
- [x] Exactly one app module/boot occurs; assert single handler effects and stable mount child counts, not only Turnstile count.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Ten tabs/mounts, direct hash, click, Back/Forward | Exactly one active matching pair. |
| Critical | Seed legacy tracker/roster/theme then reload | Same keys/schema/content remain usable. |
| Critical | Required JSON failure on Team PK and other hashes | Error is appended only to Team PK; characterize that it is hidden when another section is active. |
| High | Optional tier failure | App still initializes without tier. |
| High | Optional tier request hangs | All section rendering remains blocked; characterize without adding a timeout. |
| High | Turnstile request aborted | Local sections remain usable; no paid call. |
| Medium | Mobile menu and metadata | Menu works; title/lang/description retained. |

## Dependency Map

- Inputs: current clean `index.html`, current dirty root modules/data.
- Blocks: Phases 2–4.
- Cross-plan: browser harness should land before MCP shared-domain edits; no file relocation.

## Tests Before

1. Add shell/runtime Node tests and observe failures for unsupported assumptions.
2. Install the pinned Chromium binary, then add the Playwright spec and run it only against `python3 -m http.server` until green.
3. Treat any legacy failure as a bad assertion or separate behavior request.

## Refactor

Add root tooling and test seams only. Do not edit runtime source, data, Worker, or user-visible copy.

## Tests After

- Add artifact-target parameterization without enabling it until Phase 2.
- Assert first-party console/network cleanliness and Turnstile de-duplication.

## Implementation Steps

1. Re-read dirty files; record `git status` and test baseline.
2. Pin exact direct dependency versions, generate/review the root lockfile and audit output, and keep the Pages build secret-free. Do not stage or commit without separate authorization.
3. Write the complete target-neutral Chromium characterization against the legacy server, including state, failures, mobile, duplicate init, and exact storage fixtures.
4. Verify tests use committed JSON, synthetic storage sentinels, deterministic image stubs, and route interception only for transport failures.
5. Ignore Playwright output/trace directories; prohibit committed traces and document short, access-restricted CI retention.

## Success Criteria

- [x] Legacy target passes the full parity matrix.
- [x] No runtime file changed.
- [x] Root install does not alter `worker/package-lock.json`.

## Verification — 2026-07-24

- Independent gates: 7 contract, 9 Chromium, 90 Node, 82 Python, and 53 Worker tests passed; Worker typecheck passed.
- Review follow-up closed target-neutral script, storage reload, duplicate-init, console, request-failure, and unexpected-outbound coverage gaps.
- Root audit: 0 vulnerabilities. Existing Worker audit findings are outside this migration and unchanged.
- Environment note: the workspace shell ran Node 24.14.0 while `.node-version` pins 22.16.0; the fresh Node 22 gate remains required before local release readiness.
- Runner note: Playwright uses fixed port 4173 and must be serialized; an immediate concurrent/back-to-back runner can contend during server teardown.

## Regression Gate

```bash
npm ci
npx playwright install chromium
npm run test:contracts
npm run test:e2e:legacy
python3 -m unittest discover -s tests
node --test "tests-js/*.test.mjs"
(cd worker && npm ci && npm test && npm run typecheck)
```

## Risk Assessment

Playwright may expose pre-existing Turnstile or console behavior. Characterize it; do not silently “fix” it in this migration. Keep external requests blocked. Retain failure traces only in ignored local output or short-lived, access-restricted CI artifacts. Linux CI/test provisioning may use `npx playwright install --with-deps chromium`; the Pages production build must not.
