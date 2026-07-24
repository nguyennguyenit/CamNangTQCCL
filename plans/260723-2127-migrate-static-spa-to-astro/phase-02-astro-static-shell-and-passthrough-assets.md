---
phase: 2
title: "Astro static shell and passthrough assets"
status: completed
priority: P1
effort: "2d"
dependencies: [1]
---

# Phase 2: Astro static shell and passthrough assets

<!-- Validation 2026-07-23: decisions 1A, 2A, and 3A applied. -->

## Overview

Build `dist/` with Astro static output while preserving the existing document and public asset URLs. Root assets remain the only editable copies.

## Requirements

- No SSR, adapter, UI renderer, content collection, or pipeline rebuild.
- `/js/*`, `/css/*`, `/data/*` must be allowlisted endpoints. Static build
  output is byte-exact; Astro dev may apply Vite transformations to JavaScript
  and CSS while preserving module resolution, MIME, refresh, and browser
  behavior. JSON remains byte-exact in dev.
- `js/app.js` executes only in browser via `<script is:inline type="module" src="/js/app.js">`.

## Architecture

```text
src/pages/index.astro ───────────────► dist/index.html
root js|css|data -> typed allowlist -> static GET endpoints -> dist/{js,css,data}
worker/ ─────────────────────────────► unchanged separate deployment
```

`src/lib/root-static-artifacts.ts` reads an explicit manifest for the three public trees. Each entry has an extensionless `routeParam`, an exact `sourceBasename`, and a publication class (`runtime` or `legacy-public/build-input`). Unknown or missing source files fail the build. It uses `lstat`, rejects symlinks/non-regular entries, verifies `realpath` containment, and returns raw bytes with explicit MIME types. Endpoint params come only from `getStaticPaths()`.

## File Inventory

| Action | File | Rough size | Test impact |
|---|---|---:|---|
| Create | `/Users/plateau/Project/CamNangTQCCL/astro.config.mjs` | 15–25 | `output: "static"`, canonical `site`, no adapter. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tsconfig.json` | 8–15 | Astro strict base config. |
| Create | `/Users/plateau/Project/CamNangTQCCL/src/env.d.ts` | 2 | Astro client types. |
| Create | `/Users/plateau/Project/CamNangTQCCL/src/pages/index.astro` | 75–100 | Exact legacy shell contract. |
| Create | `/Users/plateau/Project/CamNangTQCCL/src/lib/root-static-artifacts.ts` | 80–120 | Enumeration, path/MIME/raw-byte seam. |
| Create | `/Users/plateau/Project/CamNangTQCCL/src/lib/public-artifact-manifest.mjs` | 50–80 | Single explicit publication policy: route param, exact basename, and classification. |
| Create | `/Users/plateau/Project/CamNangTQCCL/src/pages/data/[file].json.ts` | 25–40 | Emits every canonical JSON file. |
| Create | `/Users/plateau/Project/CamNangTQCCL/src/pages/js/[file].js.ts` | 25–40 | Emits root ES modules unchanged. |
| Create | `/Users/plateau/Project/CamNangTQCCL/src/pages/css/[file].css.ts` | 25–40 | Emits root CSS unchanged. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-js/astro-dist-contract.test.mjs` | 130–180 | Output allowlist and byte parity. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-js/astro-dev-contract.test.mjs` | 80–120 | Dev HTTP filenames, MIME, bytes, and refresh. |
| Create | `/Users/plateau/Project/CamNangTQCCL/scripts/verify-astro-dist.mjs` | 80–120 | Reusable artifact verifier imported by tests and invoked by `npm run verify`. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/package.json` | +15–25 | `dev`, `build`, `check`, `preview`, artifact scripts. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/package-lock.json` | generated | Add Astro/check/TypeScript pins. |
| Delete | None | 0 | Keep legacy `index.html` for dual-target parity. |

## Function and Interface Checklist

- [x] `getStaticPaths()` returns each extensionless route param once and maps it to one exact source basename; extension collisions, unknown, and missing files fail.
- [x] The manifest classifies `teams.json`, `coexist.json`, `khaihoang.json`, `tactics.json`, `heroes-dict.json`, `books-dict.json`, and `team-tier.json` as runtime; it preserves `facets.json` and `tactics-generic.json` as legacy-public/build-input. New files require explicit review.
- [x] `GET()` rejects missing/non-allowlisted files, symlinks, and escaped realpaths; returns raw bytes/MIME.
- [x] All relative imports inside root `js/*.js` resolve at `/js/*`.
- [x] Existing `./data/*.json` URLs resolve from root document.
- [x] Astro shell keeps every ID, class, `data-section`, metadata, and initial active state.
- [x] Generated client/server/Functions output is absent.
- [x] Dist contract tests and `npm run verify` call the same exported verifier and consume the same manifest; neither duplicates allowlist policy.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Source/emitted asset set and hashes | Exact match for `js`, `css`, `data`. |
| Critical | Traversal/private directory attempt | No route/output; source-only paths absent. |
| Critical | Relative/absolute symlink or unknown basename | Rejected before read/build. |
| Critical | Static build | `dist/index.html`; no server/adapter artifact. |
| High | Missing or extra root artifact | Build/contract test fails loudly. |
| Critical | Route/source extension mapping | `teams` emits `teams.json`, never `teams.json.json`; collisions fail. |
| High | Duplicate app boot | One app entry and one Turnstile script maximum. |
| Medium | MIME/extension | JSON/JS/CSS content types correct in preview. |
| High | Astro dev endpoint/refresh | JavaScript module resolution, CSS/JS source refresh, MIME, and JSON bytes match the temporary fixture contract; canonical dirty assets are untouched. |

## Dependency Map

- Depends on Phase 1 contracts and root lockfile.
- Blocks Phase 3 browser parity.
- Root modules/data/pipeline/Worker stay outside Astro ownership.

## Tests Before

1. Write dist/dev contracts first; fail on missing output/server.
2. Add traversal, symlink, realpath escape, route/source extension, collision, duplicate, unknown, and missing-manifest cases.
3. Reuse shell contract against intended `dist/index.html`.

## Refactor

Add the minimal Astro page and three endpoint surfaces. Copy current shell markup; do not split into components until reuse exists. Do not import DOM modules in Astro frontmatter.

## Tests After

- Compare emitted asset names and bytes to root sources.
- Reject `dist/{pipeline,worker,tests,tests-js,plans,.git}` and secret-like files.
- Run legacy and dist shell contracts together.

## Implementation Steps

1. Install pinned Astro, `@astrojs/check`, and TypeScript; generate and review the root lockfile without staging or committing.
2. Implement manifest, shared verifier, helper, and endpoint tests red → green.
3. Port document shell to `index.astro`; use unprocessed module URL intentionally.
4. Run dev module-resolution and CSS/JS/JSON refresh coverage through an
   injected temporary fixture root or disposable clean worktree; never
   edit/revert canonical dirty assets. Accept Vite-transformed JS/CSS only in
   dev; keep JSON and static-build artifacts byte-exact.
5. Build twice from clean output and prove deterministic artifact parity.
6. Keep legacy entry until Phase 3.

## Success Criteria

- [x] `npm run check && npm run build` passes adapter-free.
- [x] `dist/` contains only intended site output.
- [x] Root assets are unchanged and no `public/` duplicate exists.

## Regression Gate

```bash
npm run check
npm run build
npm run test:dist
npm run verify
npm run test:dev-contract
npm run test:contracts
npm run test:e2e:legacy
npm run test:node
python3 -m unittest discover -s tests
(cd worker && npm test && npm run typecheck)
```

## Risk Assessment

Static endpoints are deliberate compatibility machinery backed by Astro's
documented dynamic endpoint contract. Static-build byte parity is mandatory.
Astro dev may transform JavaScript and CSS only under the approved development
contract above; do not introduce a second hook-based publisher ad hoc. Never
set repository root as `publicDir`.

## Blocker Evidence — 2026-07-25

- `npm run check`, `npm run build`, `npm run test:dist`, and `npm run verify`
  pass. The static artifact contains 33 allowlisted assets with exact source
  bytes.
- A disposable-fixture contract and an independent root-server probe both show
  that Astro dev/Vite transforms endpoint responses:
  - `js/app.js`: source 5,013 bytes, dev response 27,472 bytes; relative imports
    become root-relative and an inline source map is appended.
  - `css/styles.css`: source 38,653 bytes, dev response 39,916 bytes.
  - `data/teams.json`: source and dev response are both 574,880 bytes with the
    same SHA-256 digest.
- This triggered the phase's mandatory stop condition. No middleware, custom
  hook, or second publisher was introduced before the development-serving
  contract was explicitly re-planned.

### Resolution — 2026-07-25

The user approved option A: Astro dev may apply Vite transformations to
JavaScript and CSS. Dev verification now owns functional module resolution,
MIME types, fixture refresh, private-path rejection, and exact JSON bytes.
Static build and preview artifacts remain byte-exact. Phase 2 may continue
without a custom middleware or second publisher.

## Verification Results — 2026-07-25

- Clean install and Astro gates ran under the pinned Node `22.16.0`:
  `npm ci`, `npm run check`, `npm run build`, `npm run test:dist`,
  `npm run verify`, `npm run test:dev-contract`, `npm run test:contracts`, and
  `npm run test:node` all passed. TypeScript-importing Node suites use the
  Node-22-compatible `--experimental-strip-types` flag.
- Results: Astro diagnostics `0`; dist contract `6/6`; dev/preview contract
  `2/2`; frozen contracts `7/7`; aggregate Node `98/98`; legacy Chromium `9/9`;
  Python `82/82`; Worker `53/53` plus typecheck.
- Two consecutive builds produced the same deterministic dist digest:
  `673ff34131a0500b3ab40af8250b6135df04197380f51b2f095f0dff8c7f8b23`.
- The dev contract models Chromium's stylesheet `Accept` header, verifies
  module resolution and fixture refresh, and explicitly stops the managed Astro
  server. Repeated aggregate runs pass `98/98` without orphan dev/preview
  processes.
- Independent test, diagnosis, and code-review passes found no remaining Phase
  2 blockers after full Astro shell parity, preview HTTP, and negative
  filesystem/verifier coverage were added.
