---
phase: 4
title: "Cloudflare Pages release and documentation"
status: completed
priority: P1
effort: "1d"
dependencies: [3]
---

# Phase 4: Cloudflare Pages release and documentation

<!-- Validation 2026-07-23: decisions 1A, 4A, and 5A applied. -->

## Overview

Make the verified Astro artifact locally deploy-ready, update evergreen authorities, and document preview/promotion/rollback for a separately authorized release. Do not inspect or mutate Pages, deploy, or spend Vision quota in this plan.

## Requirements

- Pages contract: repository root, `npm run build`, output `dist`, pinned Node.
- Local HTTP preview plus a hermetic, route-fulfilled HTTPS origin prove behavior, mixed-content characterization, cache-policy syntax, and excluded paths; neither is a valid Vision canary.
- Production remains `https://tqccl.pages.dev`; Worker and `ALLOWED_ORIGIN` stay unchanged.

## Architecture

```text
base commit + scoped source digest -> full gates -> dist digest -> local HTTP + routed HTTPS proof
separately authorized release -> Pages preview -> approved production canary
release failure -> purge affected cache and promote prior known-good deployment
```

## File Inventory

| Action | File | Rough size | Test impact |
|---|---|---:|---|
| Modify | `/Users/plateau/Project/CamNangTQCCL/README.md` | +20–35 | Astro local/build/full-gate commands. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/system-architecture.md` | +25–45 | Astro shell; unchanged pipeline/Worker boundaries. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/deployment-guide.md` | +40–70 | Pages build, preview, promotion, rollback. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/code-standards.md` | +15–25 | Astro ownership and static endpoint invariants. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/codebase-summary.md` | +20–35 | New source/build/test tree. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/docs/project-overview-pdr.md` | +8–15 | Frontend boundary row. |
| Create | `/Users/plateau/Project/CamNangTQCCL/public/_headers` | 8–16 | Explicit `public, max-age=0, must-revalidate` rules for mutable HTML, JS, CSS, and JSON URLs. |
| Create | `/Users/plateau/Project/CamNangTQCCL/tests-js/pages-headers-contract.test.mjs` | 60–90 | Header syntax/coverage and cached/fresh rollback model. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/scripts/verify-astro-dist.mjs` | +15–25 | Admit `_headers` as an explicit deployment-control artifact and verify exact inclusion. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/tests-js/astro-dist-contract.test.mjs` | +20–35 | Keep `_headers` under the one shared artifact policy; reject other unexpected output. |
| Exclude | `/Users/plateau/Project/CamNangTQCCL/docs/deployment.md` | 0 | No deployment occurs; do not write deployment facts. |
| Exclude | `/Users/plateau/Project/CamNangTQCCL/docs/project-changelog.md` | 0 | No release occurs; do not write a release entry. |
| External, excluded | Cloudflare Pages settings/deployments | n/a | Document expected build/output/Node and separate authorization procedure only. |
| Delete | None | 0 | Source cutover finished in Phase 3. |

## Function and Interface Checklist

- [x] Local previews serve `/`, `/js/app.js`, `/css/styles.css`, and every manifest-approved `/data/*.json`.
- [x] Representative `/pipeline/`, `/worker/`, `/tests/`, and `/plans/` paths never return private/source bytes. Local Astro preview may return 404; a later Pages preview may preserve its SPA-shell fallback.
- [x] The separate release runbook states that production-origin POST must be allowed, mismatched-origin POST rejected, and OPTIONS returns configured CORS headers without authenticating callers.
- [x] Production storage origin is unchanged.
- [x] The separate release runbook requires recording the prior deployment ID/version before promotion.
- [x] `_headers` syntax and path coverage model `Cache-Control: public, max-age=0, must-revalidate` for mutable shell/JS/CSS/JSON. The release runbook requires observing real Pages response headers before promotion.
- [x] The shared artifact verifier accepts exact `dist/_headers`, rejects unapproved output, and remains the only dist-policy implementation.
- [x] The release runbook forbids adding deployment records until evidence exists.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Clean local build | Pinned Node/lockfile build; no claim of Linux equivalence. |
| Critical | Local HTTP and routed-HTTPS artifact exposure probes | Site assets 200; forbidden paths contain no private/source bytes. Local 404 and later Pages SPA-shell fallback are both compatible. |
| Critical | Cache policy contract | Every mutable public URL matches the exact revalidation rule locally; real Pages delivery remains a mandatory release gate. |
| High | Deployment-control artifact | `dist/_headers` exactly matches its source, is accepted by the shared verifier, and no other unexpected file is admitted. |
| High | Release runbook review | Preview Vision origin rejection, production canary, cache purge, and rollback are explicit but not executed. |
| Medium | Docs/commands/links | Match the actual tree, locally verified commands, and documented Pages contract without claiming dashboard inspection. |

## Dependency Map

- Depends on Phase 3 sole Astro entry and green full gate.
- No preview or production dependency for local completion; deployment records remain untouched.
- Serialize doc edits with MCP Phase 6 because both own README and architecture/deployment docs.

## Tests Before

1. Record the current base commit, compute the scoped-source digest, then run local `npm ci`, build, artifact verifier, E2E, legacy unit/Python/Worker gates; do not label macOS evidence Linux-compatible.
2. Probe local HTTP preview and the Playwright route-fulfilled HTTPS origin for all allowlisted and representative forbidden paths; assert absence of private/source bytes and stub/deny third-party traffic.
3. Re-read every dirty documentation target before editing.

## Refactor

Update only owning documentation surfaces. Document the later release procedure without performing it. Do not install the Cloudflare Astro adapter or merge the separate Worker.

## Tests After

- Rerun local full gate after docs/scripts settle.
- Validate exact `_headers` inclusion, syntax/coverage, and the cached/fresh-client model locally; do not claim Cloudflare delivery without Pages evidence.
- Keep production smoke and actual date/commit/URL records as instructions for a separately authorized release.

## Implementation Steps

1. Assign dirty-doc ownership; record the base commit and compute a deterministic digest over the scoped source inventory without staging or committing.
2. Add exact revalidation rules and update the shared verifier/dist contract for `_headers`.
3. Build from clean output, record the `dist/` digest, then run local HTTP and route-fulfilled HTTPS artifact, mixed-content, cached-client, and fresh-client checks with third-party traffic stubbed.
4. Merge—not overwrite—owned doc changes.
5. Document the separate release runbook: create an authorized release commit, inspect settings, record prior deployment, verify actual Pages response headers and fallback bodies, authorize promotion/rollback, purge affected cache on rollback, and record only verified actions.

## Success Criteria

- [x] Repo is locally deploy-ready with `npm run build` → `dist`, pending Pages response-header verification during a separately authorized release.
- [x] Docs and commands match actual source/build boundaries.
- [x] No unverified production claim is written.
- [x] Artifact and docs identify the same base commit, scoped-source digest, and `dist/` digest; no commit is created.
- [x] No Pages setting, preview, production deployment, or Vision request occurs under this plan.

## Verification Results — 2026-07-27

- Added `public/_headers` with five exact mutable-asset rules for `/`,
  `/index.html`, `/js/*`, `/css/*`, and `/data/*`. Contracts validate syntax,
  complete manifest coverage, private-path non-matching, and fresh/cached
  rollback behavior.
- The shared verifier owns deployment-control policy, requires exact
  `public/_headers` → `dist/_headers` bytes, and continues to reject missing,
  unexpected, symlinked, private, and secret-like output. Result: `35` files,
  including `33` raw assets.
- Local Astro preview and routed `https://astro.local` probes cover `/` plus
  every manifest asset (`200`) and representative pipeline/Worker/test/plan
  paths (`404` locally, no private bytes). Third-party traffic remains
  stubbed/blocked; no live Vision request occurred.
- Full gate under pinned Node `22.16.0`: Astro diagnostics `0`; dist/header
  contracts `9/9`; Playwright `12/12`; aggregate Node `102/102`; Python
  `82/82`; Worker `53/53` plus typecheck. Root audit: `0` vulnerabilities.
  Existing Worker audit remains `11` findings and is unchanged by this phase.
- Evidence identity is consistent across artifact, plan, and deployment guide:
  base commit `d40722789452bc66f5f2a6b91d6fddb67c84f3af`;
  46-file scoped-source digest
  `c55cd6a06477e92d665922c208fcfa98c42931e4577b1b1071976429c3a8c3ca`;
  35-file `dist/` digest
  `0d09cadc24fdb49c1b76a14c38f9936f47b079fe119cb2808c565d047f74bdd8`.
- README, architecture, deployment, standards, codebase summary, and PDR were
  updated and independently audited. The runbook separates future authorized
  Pages inspection/promotion/rollback from local evidence and preserves the
  production storage origin.
- Independent tester, debugger, code reviewer, and docs manager found no
  remaining Phase 4 blocker. No commit, Pages mutation/deployment, production
  canary, or Vision call was performed.

## Regression Gate

```bash
npm ci
npx playwright install chromium
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

Pages settings and `_headers` interpretation are external state, and preview origins fail the Worker's exact CORS/origin policy by design. Never broaden `ALLOWED_ORIGIN` as a migration shortcut. A later release must verify actual headers and fallback bodies, roll back the whole Pages artifact, purge affected mutable caches, and verify both fresh and previously cached clients; never mix old HTML with new output.

Production-equivalent Vision validation is impossible locally or on preview under the accepted origin boundary. Preview, promotion, maintenance/risk window, and pre-authorized rollback are separate external work. A preview Worker/Turnstile environment remains outside scope.
