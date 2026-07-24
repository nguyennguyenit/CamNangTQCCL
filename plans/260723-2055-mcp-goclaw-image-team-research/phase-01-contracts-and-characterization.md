---
phase: 1
title: "Contracts and characterization"
status: todo
priority: P1
effort: 2d
dependencies: []
---

# Phase 1: Contracts and characterization

## Context Links

- [Plan](./plan.md)
- [Domain scout](./reports/scout-domain-phases-01-02.md)
- [Domain reuse research](./research/researcher-domain-reuse.md)
- [Architecture](../../docs/system-architecture.md)

## Overview

Create the strict TypeScript package and typed seam around existing pure ES domain modules. Lock current browser behavior before any domain fixes. The Vision Worker, its schema, and Turnstile path remain unchanged and separate.

## Verified Baseline

- No `mcp-worker/` or root Node package currently exists.
- Portable source set is limited to the named pure ES modules and their `filters.js`/`hanviet.js` dependencies.
- Current domain-focused JS baseline observed by scout: 39/39 tests.
- Current Vision schema/model/mode baseline observed by scout: 28/28 tests.
- Existing source sizes are small enough to wrap directly; a copied/ported implementation would add unjustified drift.
- Verified defects—SP/base collapse, combined-slot mismatch, flat tactic ownership—are characterization targets only until Phase 2.

## Requirements

- Functional:
  - Define canonical IDs, family IDs, hero-slot alternatives, observations, confirmation state, provenance, recommendation requests/results, limits, and typed errors.
  - Define `CanonicalProjectionVersion`, `WorkflowBuildId`, `WorkflowVersion`, `NormalizationDigest`, and `ConfirmationBinding` types without yet implementing Phase 2 semantics.
  - Preserve the browser’s existing v1 `confirmed:boolean` storage field as a local UI contract; it is never accepted as an MCP `ConfirmationBinding`.
  - Wrap only the portable exports from `match-dict.js`, `hanviet.js`, `analyze-map.js`, `roster-scan-map.js`, `roster-scan-state.js`, and `team-recommend-engine.js`.
  - Characterize current behavior with committed artifact samples, including known defects that Phase 2 will intentionally replace.
- Non-functional:
  - Strict ESM TypeScript; exact-pinned build/test dependencies and committed lockfile.
  - Consume Astro’s root `.node-version` as the sole exact Node 22 pin; CI and `test:node-min` must execute the adapter import smoke under that runtime and assert `process.version`.
  - Adapter is the only untyped JS boundary. No DOM, Node filesystem, Cloudflare, MCP, image, or Vision Worker import.
  - Phase 1 contracts own internal domain types only. Phase 3 runtime schemas own public handler/tool validation and infer their public TypeScript types; later transports must not create competing schema definitions.
  - No behavior change to SPA, Python CLI, or existing Vision Worker.

## Architecture

```text
mcp-worker domain contracts -> typed legacy adapter -> pure js/*.js
browser UI -----------------------------------------> same js/*.js
worker/src/schema.ts -> existing Vision Worker only (unchanged)
```

The canonical contract records both `canonicalId` and `familyId`. A `HeroSlot` owns one or more alternative canonical IDs. Evidence metadata may carry privacy-safe source scope/batch/field-presence labels, but types forbid raw bytes, base64, paths, tokens, and provider credentials. MCP confirmation binds a future canonical-state digest, never the browser’s free boolean. The external caller owns evidence that a human performed the confirmation.

## File Inventory

| Action | Absolute path | Rough delta | Purpose / test impact |
|---|---|---:|---|
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package.json` | 35–50 | Private ESM package; exact root-Node compatibility check; test/typecheck/build scripts; no MCP dependency yet. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package-lock.json` | generated | Exact reproducible dependency graph. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/tsconfig.json` | 25–35 | Node 22.12+ and Worker-compatible ES target; strict mode; narrow `allowJs`. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/domain/contracts.ts` | 220–300 | Canonical domain, evidence, request/result, error, limit interfaces. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/domain/legacy-domain-adapter.ts` | 120–170 | Typed wrappers over portable ES exports; clone/serialize outputs. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/domain/contracts.test.ts` | 130–180 | Identity, alternatives, JSON/privacy, invalid-shape contracts. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/domain/legacy-domain-adapter.test.ts` | 220–300 | Current behavior and real-artifact characterization. |
| Create | `/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-worker.yml` | 45–70 | Uses root `.node-version`; proves minimum-runtime import/test/typecheck/build independently of the developer shell. |
| Reuse | `/Users/plateau/Project/CamNangTQCCL/.node-version` | Astro-owned | Single exact Node 22 patch authority; MCP must not create a competing pin. |
| Modify/Delete | None | 0 | `worker/src/schema.ts`, browser modules, tests, and Python fallback are read-only inputs. |

## Function and Interface Checklist

- [ ] `CanonicalId`, `FamilyId`, `HeroIdentity`, `HeroSlot`, `CanonicalEntity`.
- [ ] `StructuredObservation`, `ObservationEvidence`, `UnresolvedObservation`, `ConfirmationDecision`.
- [ ] `CanonicalProjectionVersion`, `WorkflowBuildId`, `WorkflowVersion`, `NormalizationDigest`, `ConfirmationBinding`.
- [ ] `BrowserScanConfirmation` remains a backward-compatible browser/localStorage concept and has no conversion to `ConfirmationBinding`.
- [ ] `OwnedHero`, `OwnedTactic`, `LockedTeam`, `RosterSnapshot`; no image/path/secret fields.
- [ ] `TierRanking`, `ProvenanceRef`, `TeamMatch`, `TacticSelection`, `ConflictDiagnostic`.
- [ ] `RecommendationRequest`, `RecommendationResult`, `ResultPage`, `ResultLimits`, `DomainError`.
- [ ] `LegacyDomainAdapter` methods for normalization, dictionary search, scan mapping, team matching, candidate normalization, and recommendation.
- [ ] Source-graph guard rejects imports from `js/analyze.js`, `js/roster-recommend-ui.js`, `worker/`, MCP, filesystem, DOM, and Cloudflare packages.
- [ ] Source-graph guard also emits the actual transitive semantic import closure from declared entrypoints so Phase 2 can prove workflow identity coverage instead of trusting a manually curated list.

## Dependency Map

```text
contracts.ts -> legacy-domain-adapter.ts
adapter -> match-dict.js -> filters.js
        -> analyze-map.js -> match-dict.js + hanviet.js
        -> roster-scan-map.js -> match-dict.js + hanviet.js
        -> roster-scan-state.js
        -> team-recommend-engine.js -> filters.js
Phase 1 -> Phase 2; no Phase 3/4 imports allowed yet
```

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Serialize a roster containing fields named image/base64/path/token | Contract/parser rejects or strips them; test proves no value survives. |
| Critical | `SP Tuân Úc`, `Tuân Úc`, `CO Chân Cơ`, `Chân Cơ` | Contract can express four distinct canonical IDs plus separate families. |
| Critical | `SP Lữ Mông/Trình Phổ` | One slot contains two alternatives; not two required heroes. |
| Critical | Browser `confirmed:true` is submitted as MCP confirmation | Contract rejects it; only a workflow- and digest-bound `ConfirmationBinding` is accepted. |
| High | Import adapter under Node without browser globals | All allowed methods load and execute; forbidden graph guard stays green. |
| High | Actual team/tier/dictionary samples | Adapter outputs JSON-serializable typed shapes without mutating inputs. |
| High | Current base-name collapse and flat tactic output | Captured as named temporary characterization, linked to Phase 2 replacement tests. |
| Medium | Unknown artifact fields | Tolerated at adapter boundary; required used fields remain validated. |
| Medium | Existing browser/Worker/Python suites | All remain green with zero product-source changes. |
| Medium | Legacy module mutates an input fixture | Adapter test detects mutation and wrapper returns a defensive result. |
| Medium | Adapter error contains a full artifact/path | Error is mapped to a typed safe shape without local path disclosure. |

## Tests Before

1. Add contract tests for identity, slots, evidence separation, forbidden fields, deterministic serialization, and invalid inputs.
2. Add adapter tests against selected real records: `team-intro-0`, one CO record, one combined-slot record, one multi-ranking tier record, and one untiered record.
3. Add import-graph test before the adapter imports any legacy module.
4. Make the graph test classify allowed semantic inputs and explicit non-semantic exclusions with rationale; fail on unresolved dynamic imports.
5. Run the current JS and Vision Worker baselines and record counts in the implementation report.

## Refactor

1. Scaffold `mcp-worker/` with exact-pinned TypeScript/Vitest versions confirmed from current registries at implementation time.
2. Implement contracts without copying the Vision Worker schema.
3. Implement narrow adapter wrappers and explicit return types; do not port algorithms.
4. Make fixtures select minimal committed records at test setup; do not duplicate the full corpus.
5. Replace temporary `any` only at adapter internals; do not broaden TypeScript compilation to browser source.

## Review Checklist

- [ ] Every proposed symbol has one owning file and one test owner.
- [ ] No Phase 2 behavior is implemented early.
- [ ] Lockfile contains no floating dependency range.
- [ ] A recorded pre-implementation status plus `git diff -- mcp-worker` shows only intended Phase 1 changes; unrelated dirty user files remain untouched.
- [ ] Baseline counts are recorded as observations, not assertions in production code.

## Implementation Steps

1. Begin only after the Astro plan completes; reuse its exact root `.node-version`, artifact manifest, and browser/build authority.
2. Write all failing Tests Before and ensure failures are contract absence, not fixture/path mistakes.
3. Define the canonical types and runtime assertion helpers used at the JS boundary.
4. Add adapter wrappers one module at a time; run the focused adapter test after each.
5. Add CWD-independent test fixture resolution from the repository root.
6. Run package typecheck/build, then the full browser, Python, and Vision Worker regressions.
7. Record temporary characterization names in Phase 2’s replacement checklist; do not encode plan IDs in test names.

## Tests After

- [ ] Invalid nested values and unknown-field tolerance.
- [ ] Input immutability and output JSON round-trip.
- [ ] No raw image/base64/path/Turnstile/token fields in any domain result.
- [ ] Adapter exports are fully typed; no unguarded legacy import is public.
- [ ] Test execution from a non-repository CWD.
- [ ] Minimum-runtime gate fails on a different Node patch and passes only when the adapter smoke actually runs under the root pin.
- [ ] Existing browser v1 serialized state round-trips unchanged; its boolean confirmation cannot enter MCP contracts.

## Regression Gate

```bash
cd /Users/plateau/Project/CamNangTQCCL/mcp-worker
npm test -- --run test/domain
npm run typecheck
npm run build
npm run test:node-min
cd /Users/plateau/Project/CamNangTQCCL
node --test tests-js/{match-dict,analyze-map,roster-scan-map,roster-scan-state,team-recommend-engine}.test.mjs
node --test "tests-js/*.test.mjs"
python3 -m unittest discover -s tests
cd worker && npm test && npm run typecheck
```

## Success Criteria

- [ ] Strict package installs reproducibly and passes test/typecheck/build under the Astro-owned exact Node pin from a clean checkout.
- [ ] Canonical contract represents distinct SP/CO identities, families, and combined-slot alternatives.
- [ ] Typed adapter covers only verified portable ES exports and preserves current output.
- [ ] Privacy/source-graph tests prove no image, path, secret, DOM, MCP, Cloudflare, or Vision Worker coupling.
- [ ] Existing SPA, Python, and Vision Worker gates pass unchanged.

## Security and Privacy

- Treat every observation string as untrusted data, never instructions.
- Forbid raw media, filesystem paths, base64, bearer, Turnstile, channel/user credentials, and provider keys in domain types and snapshots.
- Do not read environment variables or files at module import time.

## Risks and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| `allowJs` spreads untyped values | One adapter boundary plus compile-time/type tests. | Remove new package; browser remains untouched. |
| Characterization freezes defects | Mark defect behavior temporary; Phase 2 writes corrected tests before edits. | Keep characterization while reverting only failed wrapper. |
| Tests depend on mutable full counts | Assert required shapes/IDs, not observed 214/57 counts. | Restore fixture selector to last valid records. |
| Vision contract duplication is tempting | Explicitly prohibit import/extraction; structured observations are a separate MCP contract. | Delete accidental shared module and rerun Worker suite. |

## Next Steps

Phase 2 may start only after every regression gate is green. It replaces temporary defect characterizations with accepted identity, ambiguity, ranking, and provenance behavior.
