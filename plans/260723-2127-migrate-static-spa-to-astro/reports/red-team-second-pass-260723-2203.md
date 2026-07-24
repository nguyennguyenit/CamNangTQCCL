# Astro Migration Plan — Red-Team Second Pass

## Summary

- Target: `plans/260723-2127-migrate-static-spa-to-astro/`
- Reviewers: Security Adversary, Failure Mode Analyst, Assumption Destroyer
- Raw findings: 14
- Deduplicated findings: 11
- Severity: 1 Critical, 7 High, 3 Medium
- User disposition: `1A 2A 3A 4A 5A`
- Final disposition: 11 accepted, including one scope-preserving clarification
- Plan changes: applied to the Astro plan and MCP Phase 2

## Findings and Adjudication

| # | Finding | Severity | Disposition | Evidence | Applied plan change |
|---|---|---|---|---|---|
| 1 | Dynamic route params may double file extensions | High | Accept | `js/app.js:78-85`, `index.html:12,66` | Manifest entry separates extensionless `routeParam` from exact `sourceBasename`; test collisions and emitted URLs. |
| 2 | Clean gates omit Chromium provisioning | High | Accept | `README.md:26-44`; Phase 1/4 gates contain only `npm ci` | Add explicit local `playwright install chromium`; Linux-only `--with-deps` belongs to CI/test environment, never Pages production build. |
| 3 | MCP adds `js/hero-identity.js` without manifest ownership | Critical | Accept | MCP Phase 2 `phase-02-harden-domain-recommendation-and-provenance.md:54-65,165-175` | Amend MCP Phase 2 inventory and gates to update the manifest and run root build/dist/E2E. |
| 4 | MCP browser smoke has no server after root `index.html` deletion | High | Accept | MCP Phase 2 `:73,167-174`; Astro Phase 3 deletes the only current entry | Make root Astro preview the sole browser-smoke server; remove or redirect redundant MCP harness. |
| 5 | Dev-refresh test mutates dirty canonical assets | High | Accept | `repo-scout-report.md:34-43`, `js/app.js:5-14` | Exercise refresh through an injectable temporary fixture root or disposable clean worktree only. |
| 6 | Artifact verifier has two policy owners | Medium | Accept | Current deploy authority is one allowlist in `docs/deployment-guide.md:68-81` | One reusable verifier module; tests and `npm run verify` call the same implementation. |
| 7 | Browser parity permits uncontrolled third-party image traffic and misses HTTPS mixed-content differences | High | Accept modified | `js/hero-list.js:44-48`, `data/heroes-dict.json:28,148` | Deny third-party network by default in E2E and stub images. Run an HTTPS Pages-preview smoke for mixed-content; record existing HTTP icon debt without expanding migration into asset hosting. |
| 8 | Manifest/publication semantics confuse runtime JSON with historically public build inputs | Medium | Accept clarification; reject scope reversal | `js/app.js:78-86`, `README.md:92-96`, `pipeline/build_dict.py:23-28,36-37` | Preserve the currently published `data/` surface for compatibility, but mark entries `runtime` vs `legacy-public/build-input`; unknown future files require explicit review. Do not move data in this migration. |
| 9 | Storage fixtures and Playwright traces lack privacy controls | Medium | Accept | `js/recruit-tracker-store.js:142-153,175-188,213-230` | Require synthetic sentinel fixtures, ignore trace/output directories, prohibit committed traces, and document short/restricted CI retention. |
| 10 | Fixed mutable URLs make rollback cache coherence unproven | High | Accept | `index.html:12,66`, `js/config.js:4-8`; no repository `_headers` exists | Add tested Pages `_headers`: revalidation/short-cache policy for mutable HTML/JS/CSS/JSON, plus fresh/cached-client rollback checks and purge procedure. |
| 11 | Runtime error still recommends `python3 -m http.server` after deleting root HTML; Linux evidence is overstated | High | Accept | `js/app.js:112-114`, `README.md:26-34`; no Linux CI exists | After legacy baseline freezes, change recovery copy to host-neutral deployment advice. Label Pages evidence “Linux build-only”; do not claim a Linux full gate without CI. |

## Evidence Filter

All retained findings include repository `file:line` evidence. Duplicate Chromium and MCP-manifest findings were merged. No evidence-free finding survived.

## Applied Impact

- Astro plan: Phases 1–4 and second red-team log updated.
- MCP plan: Phase 2 file inventory/regression gate updated bidirectionally.
- Scope remains static-only, Vanilla JS, no Worker behavior change, no production deployment authorization.
- Estimated effort remains approximately 6 days; added work is contract hardening rather than a new product feature.

## Unresolved Questions

- None.
