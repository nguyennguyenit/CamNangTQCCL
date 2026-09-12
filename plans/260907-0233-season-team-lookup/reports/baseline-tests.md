# Season/team lookup baseline tests

Recorded: 2026-09-12 13:01 +07 (actual local execution clock).

## Scope and environment

- Work context: `/Users/plateau/Project/CamNangTQCCL`.
- Branch: `main`; HEAD: `f221c2f55b9f16d857e5785b7fcb7d25a19b705e`.
- Runtime: Node `v24.20.0`, npm `11.19.0`, Python `3.14.6`; Node satisfies both package manifests (`>=24.20.0 <25`).
- Read root/MCP package manifests and phase 1/4 of this plan before selecting tests.
- Workspace was already dirty, including Node 24 configuration, private SGSDeck work, and artifact-boundary tests. Results below describe that working tree, not a pristine HEAD baseline.
- This task changed no application/test/configuration files and ran no build, generator, deployment, network fetch, or server. Only this report was authored.

## Executed results

| Suite | Passed | Failed | Skipped | Reported duration | Exit |
|---|---:|---:|---:|---|---:|
| Focused root Node tests | 52 | 0 | 0 | 151.406 ms | 0 |
| Python discovery | 126 | 0 | 0 | 0.373 s | 0 |
| Focused MCP Vitest, 4 files | 75 | 0 | 0 | 359 ms | 0 |
| Total | 253 | 0 | 0 | Separate runs | — |

Commands below ran from the work context except MCP, which ran from its `mcp-worker/` subdirectory. Independent commands ran concurrently; every result was inspected.

```sh
node --experimental-strip-types --test tests-js/astro-dist-contract.test.mjs tests-js/runtime-asset-contract.test.mjs tests-js/team-recommend-engine.test.mjs tests-js/roster-scan-state.test.mjs tests-js/filters.test.mjs
```

Node reported `tests 52`, `pass 52`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`. This covers public artifact inventory and byte parity, runtime asset contracts, existing recommendation engine behavior, roster state, and filters.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests
```

Python reported `Ran 126 tests in 0.373s` and `OK`. This discovery includes existing private SGSDeck tests present in the dirty workspace; the total is observed execution, not a count of declarations.

```sh
cd /Users/plateau/Project/CamNangTQCCL/mcp-worker
npm test -- test/data/artifact-contracts.test.ts test/data/snapshot-index.test.ts test/domain/recommendation-service.test.ts test/research/research-handlers.test.ts
```

Vitest `v4.1.10` reported `Test Files 4 passed (4)` and `Tests 75 passed (75)`; start time `13:01:33`.

## Interpretation and remaining gates

- Baseline is green. There was no environment failure and no valid feature-specific Red result in this run.
- New season behavior still requires tests written and executed before its implementation, followed by Green and Refactor evidence. These existing tests do not establish delivery of the proposed season contracts.
- The existing-dist parity test passed against the pre-existing `dist/`. No fresh Astro build was performed or claimed.
- No coverage measurement, typecheck, UI E2E, MCP transports/release suites, or repository-wide shipping checks were requested in this baseline task. They remain later gates under the plan.
- No failing tests or unresolved baseline questions.
