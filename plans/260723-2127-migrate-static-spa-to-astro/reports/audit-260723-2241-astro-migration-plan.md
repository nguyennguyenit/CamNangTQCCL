---
title: "Audit Astro migration plan"
date: 2026-07-23
status: complete
target: "../plan.md"
---

# Audit Astro Migration Plan

## Summary

- Scope: `plans/260723-2127-migrate-static-spa-to-astro/` plus its MCP dependency.
- Method: evidence-backed assumption, failure-mode, security, and scope review.
- Result: 5 findings — 4 High, 1 Medium.
- User accepted the recommended resolution for all findings.
- Plan changes applied; no code changes.

## Findings

### 1. Forbidden-path 404 contract conflicts with Cloudflare Pages SPA fallback

- **Severity:** High
- **Location:** Phase 4, function checklist and test matrix.
- **Evidence:** `phase-04-cloudflare-pages-release-and-documentation.md:51-65` requires private/source paths to return 404. The repository has `index.html:1-67` but no `404.html` or planned `src/pages/404.astro`. Cloudflare Pages documents that a project without a top-level `404.html` is treated as an SPA and unknown paths are served from `/`.
- **Failure scenario:** Local Astro preview returns 404 for `/pipeline/`, while a later Pages preview returns the application shell with 200. The release probe fails despite no private bytes being deployed, or implementation adds a new 404 page and silently changes the current Pages routing contract.
- **Recommendation:** Preserve compatibility by testing the invariant that forbidden paths never return private/source bytes. Permit either a 404 or the known Pages SPA shell. If strict 404 is desired, record it as an explicit behavior change and add a top-level Astro 404 artifact.
- **Disposition:** Applied.

### 2. Local tests cannot prove Cloudflare interpretation or delivery of `_headers`

- **Severity:** High
- **Location:** Plan success criteria; Phase 4 cache-policy contract.
- **Evidence:** `plan.md:53-54` calls the artifact Pages deploy-ready and says tested rules keep assets revalidated. `phase-04-cloudflare-pages-release-and-documentation.md:42-65,85-95` excludes Pages preview and validates only local syntax/model behavior. Cloudflare documents that Pages parses `_headers` during deployment and does not serve the file as a static asset; Astro only copies `public/` files into `dist/`.
- **Failure scenario:** Local parser tests pass while Pages rejects, combines, or applies a rule differently. The plan reports rollback/cache safety without observing actual response headers.
- **Recommendation:** Keep 5A's local-only boundary, but narrow local success to syntax, coverage, and model verification. Make actual Pages response-header and cached/fresh-client checks a mandatory gate in the separately authorized release runbook before promotion.
- **Disposition:** Applied.

### 3. Phase 4 adds `_headers` without updating the strict artifact verifier contract

- **Severity:** High
- **Location:** Phase 2 verifier ownership versus Phase 4 file inventory.
- **Evidence:** `phase-02-astro-static-shell-and-passthrough-assets.md:47-49,63,69-73,97-99` defines a strict single artifact verifier and fails unexpected output. `phase-04-cloudflare-pages-release-and-documentation.md:42-43,107-116` adds `public/_headers` and reruns `npm run verify`, but does not list the verifier or dist-contract test as modified.
- **Failure scenario:** The correct Phase 4 build contains `dist/_headers`; `npm run verify` rejects it as an unexpected artifact. Alternatively, the verifier is weakened ad hoc, creating the second policy owner the prior red-team explicitly removed.
- **Recommendation:** Add Phase 4 modifications to the shared verifier and `astro-dist-contract.test.mjs`. Treat `_headers` as an explicit deployment-control artifact, verify exact inclusion and syntax, and keep one policy source.
- **Disposition:** Applied.

### 4. Release-candidate SHA requires commit authority that the local-only plan does not define

- **Severity:** High
- **Location:** Phase 4 implementation and success criteria.
- **Evidence:** `phase-04-cloudflare-pages-release-and-documentation.md:91-105` requires a clean-worktree release-candidate SHA. Current `main` is at `1ef332638f3b6ac4c254654f809302cfc417f679` with numerous modified and untracked user files, including both plans. `plan.md:27,58,105` limits work to a local deploy-ready artifact and does not authorize commits.
- **Failure scenario:** A clean worktree at current `HEAD` omits the Astro implementation. Creating a new SHA requires committing, while committing from the dirty tree risks including unrelated user work or exceeds the later cook authorization.
- **Recommendation:** For this plan, identify evidence with a deterministic source/artifact digest and record the base commit separately. Move release-candidate commit/SHA creation into the separately authorized release workflow, unless the user explicitly authorizes a focused commit.
- **Disposition:** Applied.

### 5. Unneeded integration-hook fallback creates an unaudited second implementation

- **Severity:** Medium
- **Location:** Phase 2 risk assessment.
- **Evidence:** `phase-02-astro-static-shell-and-passthrough-assets.md:44-46,56-58,67-77` specifies and tests Astro static endpoints. The fallback at `phase-02-astro-static-shell-and-passthrough-assets.md:131-133` proposes `astro:server:setup` and `astro:build:done` without file inventory, ownership, tests, or deletion of the endpoint path. Astro's official endpoint contract supports dynamic `getStaticPaths()` routes with extensions.
- **Failure scenario:** An implementation problem triggers a second dev/build publishing path, duplicating policy and invalidating the single-verifier/manifest assumptions.
- **Recommendation:** Remove the pre-approved hook fallback. If official endpoints fail an empirical byte-parity gate, stop and re-plan using captured evidence.
- **Disposition:** Applied.

## Verified Non-Findings

- Dynamic endpoint naming is supported: Astro documents `[id].json.ts` plus extensionless `params.id`, matching the plan's `routeParam`/`sourceBasename` split.
- `public/_headers` is the correct source location for an Astro-to-Pages static build.
- Cross-plan dependency is bidirectional: Astro `blocks` MCP, MCP `blockedBy` Astro.
- MCP Phase 2 updates the Astro manifest for `hero-identity.js` and runs build, verify, dist, and browser gates.

## Sources

- Astro endpoints: https://docs.astro.build/en/guides/endpoints/
- Astro project structure and `public/`: https://docs.astro.build/en/basics/project-structure/
- Cloudflare Pages headers: https://developers.cloudflare.com/pages/configuration/headers/
- Cloudflare Pages routing/cache behavior: https://developers.cloudflare.com/pages/configuration/serving-pages/

## Recommendations

1. Rerun whole-plan consistency and `ak plan validate`.
2. Keep actual Pages response/header checks in the separately authorized release gate.

## Unresolved Questions

- None.
