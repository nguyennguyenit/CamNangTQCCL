---
title: "Migrate static SPA to Astro"
description: "Replace the root HTML publish with an adapter-free Astro static shell while preserving every browser, data, state, and Worker contract."
status: in_progress
priority: P1
effort: "6d"
issue: null
branch: main
tags: [refactor, frontend, infra, tdd]
blockedBy: []
blocks: [260723-2055-mcp-goclaw-image-team-research]
created: 2026-07-23
---

# Migrate static SPA to Astro

## Overview

Migrate the single-page shell and Pages build to Astro static output. Keep `js/`, `css/`, and `data/` canonical at repository root; build-time static endpoints preserve `/js/*`, `/css/*`, and `/data/*` byte-for-byte. Vanilla DOM behavior, hash navigation, localStorage schemas, Python pipeline, and Vision Worker remain unchanged.

## Scope Contract

- **Mode:** HOLD, deep TDD. Compatibility before componentization.
- **In:** Astro root toolchain, static shell, safe raw-asset endpoints, artifact checks, Chromium parity, Pages `dist/` cutover, rollback/docs.
- **Out:** React/Vue, SSR/adapters, ten new routes, content collections, View Transitions, domain-module rewrite, data rebuild, Worker change.
- **Authority:** root `data/*.json`, `js/*.js`, `css/*.css` remain source truth. No generated `public/` copies.
- **External boundary:** this plan ends at a locally verified, deploy-ready artifact. Pages preview, production promotion, and a real Turnstile/Worker canary require separate authorization.

## Phases

| # | Phase | Status | Depends |
|---|---|---|---|
| 1 | [Freeze browser and asset contracts](./phase-01-start.md) | Completed | — |
| 2 | [Build Astro static shell and passthrough assets](./phase-02-astro-static-shell-and-passthrough-assets.md) | Completed | 1 |
| 3 | [Prove browser parity and cut over](./phase-03-browser-parity-and-legacy-cutover.md) | Pending | 2 |
| 4 | [Prepare Cloudflare Pages release and documentation](./phase-04-cloudflare-pages-release-and-documentation.md) | Pending | 3 |

## Dependencies

- Astro static output only; no `@astrojs/cloudflare` adapter.
- Pin a supported Node 22 LTS line for local/Pages parity; pin Astro and generate the root lockfile. Do not stage or commit without separate authorization.
- This plan blocks all delivery in `260723-2055-mcp-goclaw-image-team-research`. Complete Astro Phases 1–4 first; MCP then consumes the settled root Node pin, public artifact manifest, preview/build/dist/E2E authority, and documentation source of truth.
- Evidence: [Astro research](./research/astro-cloudflare-research.md), [TDD/risk research](./research/tdd-risk-research.md), [repo scout](./reports/repo-scout-report.md).

## Success Criteria

- [ ] One Chromium spec passes unchanged against legacy and built Astro targets before legacy removal.
- [ ] `npm ci && npm run build` emits static `dist/`; root assets and emitted `/js`, `/css`, `/data` bytes match.
- [ ] Manifest entries separate extensionless route params from exact source basenames and classify every currently published JSON as runtime or legacy-public/build-input.
- [ ] Ten hash sections, required/optional JSON semantics, existing storage payloads, responsive menu, and local-only features remain compatible.
- [ ] No `pipeline/`, `worker/`, tests, plans, ignored sources, credentials, or server output enters `dist/`.
- [ ] Existing Python, Node, Worker Vitest, and Worker typecheck gates stay green; baseline is 82/83/53 plus typecheck.
- [ ] The artifact is locally Pages-ready with `npm run build` → `dist`, subject to response-header verification in a separately authorized Pages preview; that release runbook preserves the prior deployment as the atomic rollback target.
- [ ] E2E is hermetic by default, HTTPS mixed-content behavior is characterized locally, and `_headers` syntax/coverage explicitly models `public, max-age=0, must-revalidate` for mutable shell/assets.
- [ ] Evidence records the base commit, deterministic scoped-source digest, and `dist/` digest without requiring a release commit.

## Open Questions

- None. Astro dev may apply Vite transformations to JavaScript and CSS while
  preserving module resolution, MIME types, source refresh, and browser
  behavior. JSON dev responses and every allowlisted static-build artifact
  remain byte-exact. External Pages inspection, preview, production promotion,
  and Vision canary remain outside this plan and require a new authorization.

## Red Team Review

### Session — 2026-07-23

Security, failure-mode, and assumption reviews are evidence-filtered. Accepted findings are integrated in the phases; Worker hostname/action and hostile-preflight findings are rejected as pre-existing Worker security scope, not claims this migration certifies.

**Findings:** 15 (13 accepted, 2 rejected). **Severity:** 3 Critical, 9 High, 3 Medium.

| Finding group | Disposition | Applied to |
|---|---|---|
| Explicit manifest, symlink/realpath defense, npm trust policy | Accept | Phases 1–2 |
| Frozen assertions, dev contract, storage fixtures, MCP sequencing | Accept | Plan, Phases 1–3 |
| Exact boot failure and duplicate-init behavior | Accept | Phases 1–3 |
| Release identity, branch controls, rollback/risk window | Accept; identity refined by later audit | Phase 4 |
| Turnstile binding and hostile OPTIONS enforcement | Reject | Existing Worker security scope; migration canary does not certify these controls |

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all four phase files.
- Decision deltas checked: 8.
- Reconciled stale references: directory enumeration, mutable E2E, Linux claim, visible error, preview order.
- Unresolved contradictions: 0.

### Second Session — 2026-07-23

The user accepted all ten proposed findings, the publication-surface clarification, and the recommended execution boundary. The plan now separates route parameters from source basenames; provisions Chromium explicitly; synchronizes MCP manifest/server gates; uses disposable dev fixtures and one shared verifier; makes E2E hermetic; preserves and classifies all currently published JSON; protects storage fixtures/traces; adds cache-safe `_headers`; replaces obsolete recovery copy; and limits Linux claims to evidence actually produced.

**Disposition:** 11 accepted (including one accepted clarification). **External execution:** local deploy-ready only.

### Audit Session — 2026-07-23

All five findings in [the implementation-readiness audit](./reports/audit-260723-2241-astro-migration-plan.md) are accepted:

| Finding | Severity | Applied to |
|---|---|---|
| Preserve Pages SPA fallback while excluding private bytes | High | Phase 4 |
| Narrow local `_headers` proof; require real Pages header checks later | High | Plan, Phase 4 |
| Add `_headers` to the shared artifact-verifier contract | High | Phase 4 |
| Replace unauthorized release SHA with base/source/artifact digests | High | Plan, Phases 1 and 4 |
| Remove the unaudited Astro hook fallback | Medium | Phase 2 |

## Validation Log

### Verification Results — 2026-07-23

- Tier: Standard (Fact Checker + Contract Verifier); claims checked: 40.
- Verified: 38; failed: 0; external facts excluded from implementation readiness: 2 (Pages dashboard settings, deployment authorization).
- Confirmed: HOLD scope, adapter-free static output, explicit raw-asset manifest, frozen legacy-first E2E, root module/data authority, separate Worker.
- Whole-plan sweep: all five plan files reread; unresolved contradictions: 0.

### Validation Interview — 2026-07-23

- Decisions: `1A 2A 3A 4A 5A`.
- Red-team findings accepted: 11/11.
- Public compatibility: preserve the current `data/*.json` surface with manifest classification.
- Cross-plan contract: MCP Phase 2 updates the manifest and runs root Astro gates.
- Release hardening: hermetic E2E, local HTTPS mixed-content smoke, and `_headers` cache policy.
- Delivery boundary: locally deploy-ready only; no Pages mutation or deployment.

### Final Consistency Sweep — 2026-07-23

- Files reread: `plan.md`, all four Astro phase files, the second-pass report, and MCP Phase 2.
- Accepted second-pass findings traced to executable steps/tests: 11/11.
- Format validation: Astro plan valid; MCP plan valid.
- External facts required for local execution: 0.
- Unresolved questions: 0.
- Unresolved contradictions: 0.

### Post-Audit Consistency Sweep — 2026-07-23

- Decision deltas: SPA fallback, `_headers` proof boundary, verifier ownership, evidence identity, endpoint-only implementation.
- Files reread: `plan.md` and all four phase files.
- Reconciled stale references: release SHA/commit instructions, strict 404 expectation, short-cache wording, Cloudflare-proof claim, hook fallback.
- Unresolved questions: 0.
- Unresolved contradictions: 0.

<!-- slug: migrate-static-spa-to-astro -->
