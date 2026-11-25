## Scout report — `tqccl_normalize_entities` output/limits (issue #165)

### 1. Consumers of normalize output fields

**In-repo (mcp-worker/src):** only the handler constructs the payload; **nothing in `src/` reads `result.observations[]`**. `handleNormalize` returns `{...ctx.commonResult(...), ...normalized}` (`src/research/research-handlers.ts:128-146`). `normalizeObservations` returns `{canonicalState, observations: sanitizedObservations, warnings, reviewRequired, confirmationBinding}` (`src/domain/normalization-service.ts:626-642`); output observations are re-sanitized copies retaining `observationId, entityKind, observedText, canonicalId, familyId, displayName, redStars, level, reviewRequired, candidates, replacesCanonicalId, heroIds, tacticIds, tacticAssignments, trust, evidence` (`normalization-service.ts:378-448`).

**Recommend input schema** (`src/research/recommend-handlers.ts:41` → `canonicalStateSchema` at `src/research/shared-schemas.ts:336-360`):
- `canonicalHeroSchema` (`shared-schemas.ts:262-283`) **requires** `canonicalId`, `familyId`, `displayName`; `confidence` and `evidence` are **optional**.
- `canonicalTacticSchema` (`shared-schemas.ts:285-299`) **requires** `canonicalId`, `displayName`; `confidence`/`evidence` optional.
- Recommend reads only `displayName`/`canonicalId`/`redStars` for heroes (`recommend-handlers.ts:286-290`) and `displayName`/`canonicalId` for tactics (`recommend-handlers.ts:303-307`), plus `lockedTeams`/`unresolved`/`seasonContext` gates (`recommend-handlers.ts:260-279`). It never reads `evidence` or `confidence`.
- Digest/projection **exclude `displayName`, `evidence`, `confidence`** (`src/domain/canonical-state.ts:82-110`, `165-192`), and `verifyConfirmationBinding` recomputes from the submitted state (`canonical-state.ts:227-244`). Covered by `test/domain/canonical-state.test.ts:59` (“excludes display and evidence but keeps semantic inventory”).
- Consequence: dropping `evidence`/`confidence` (and even `displayName`) from the wire `canonicalState` cannot break binding; keeping `displayName` is still needed for recommend’s human-facing output.

**External consumer `tqccl-auto/tqkh/advise.py`** (outside this repo):
- `MAX_OBSERVATIONS = 100`, `MAX_CMDLINE = 30000` (`advise.py:20-21`); `call()` builds `node … src/cli.ts <alias> --input <json>` and rejects >30k chars (`advise.py:41-57`).
- Reads output `observations[]`: `o.get("canonicalId")`, `o.get("reviewRequired")`, `o["observationId"]` (`advise.py:188-196`).
- Reads `canonicalState`: `unresolved` (`advise.py:194`, `201-207`), `heroes[].displayName|canonicalId|redStars`, `tactics[].displayName|canonicalId`, `lockedTeams` (`advise.py:210-216`), `confirmationBinding.normalizationDigest` (`advise.py:202`).
- Before recommend it calls `_strip_state()` which pops `evidence` and `confidence` from heroes/tactics (`advise.py:161-169`), then sends `_strip_state(nm["canonicalState"])` plus the original binding (`advise.py:245-248`) — proof the recommended input contract already tolerates their absence.

**js/, shared/, worker/, .agents/, agent-knowledge/:** no consumer of MCP normalize output. `grep canonicalState|confirmationBinding js shared worker` yields none; `js/analyze-map.js` `reviewRequired` is the unrelated image-scan path. Only doc/skill mentions: `docs/goclaw-mcp-skill-handoff.md:47`, `.agents/skills/tqccl-coexist-team-builder/SKILL.md:20,34`, `agent-knowledge/rules/coexist.jsonl:26`.

### 2. Tests touching normalize and size/schema pins

- Output shape/semantics:
  - `test/research/normalize-tool.test.ts` — `describe` “hero family” (8), “name resolution” (54), “request contract” (138); tests at 9, 26, 36, 68, 90, 104, 125, 141, 157 (familyId derivation, canonicalId wins, `candidates/reviewRequired` preserved, `WORKFLOW_VERSION_CHANGED`).
  - `test/research/research-handlers.test.ts:56-73` (“normalizes observations and binds the result to the workflow”); `:110-126` (“validates every successful result with its authoritative output schema”); `:129-147` rejects 300 observations as `INVALID_REQUEST`.
  - `test/domain/normalization-service.test.ts` — 18 describes its: 19, 74, 109, 133, 176, 199, 236, 314, 353, 392, 421, 443, 465, 493, 530, 566, 603, 644, 673, 699, 717; `:304` reads output `observations[].evidence.sourceScope`; `:699-714` pins the 500-observation domain limit.
  - `test/e2e/team-research-workflow.test.ts:13` (normalize → binding → recommend golden flow); `test/research/season-research.test.ts:14-17` (`seasonContext` accepted/rejected).
  - `test/cli.integration.test.ts:164-215` (all seven CLI commands; feeds full `normalized.canonicalState` into recommend); `test/transport/all-tools-parity.test.ts:99-140`; `test/security/no-long-hex-in-echoed-fields.test.ts:51-82`.
  - `test/performance/domain-budget.test.ts:123-175` normalizes 60 production observations and recommends; `test/performance/worker-budget.workerd.test.ts:60-85` does the same through workerd.
  - `test/research/recommend-teams.test.ts:135-176` state/version gates; helper builds canonicalState with `displayName` + `evidence` at 38-56 (`recommend-web-parity.test.ts:69-94` likewise).
- Size limits:
  - `test/mcp/registry.contract.test.ts:269` pins `MAX_RESULT_BYTES * 2 * 1.1 < 98_304`.
  - `test/mcp/registry.contract.test.ts:546-550` is the **tools/list < 90 KiB** pin (“Trần tools/list: 90 KiB (Worker cho phép 96 KiB…)”).
  - `test/release/verify-release.test.ts:36` env `TQCCL_MCP_MAX_RESULT_BYTES: "98304"`; `test/transport/worker.integration.test.ts:379-383` forces `"10"` and expects 413 `RESULT_TOO_LARGE`; `test/research/playbook.test.ts:224-228` overflow → `RESULT_TOO_LARGE`.
  - **No test references `MAX_NORMALIZE_REQUEST_BYTES`** (grep across `test/` is empty); no test asserts the 16 KiB normalize cap or normalize-specific `RESULT_TOO_LARGE`.
- Schema snapshots/golden files: **none committed** (no `*.snap`, no tool-schema JSON anywhere under `mcp-worker`). Schemas are generated at runtime from Zod (`src/mcp/tool-definitions.ts:44-53`, `src/research/research-contracts.ts:118-124`) and pinned by:
  - `test/mcp/registry.contract.test.ts:536-555` (Ajv-compiles every advertised input/output schema, root-description rule, 90 KiB).
  - `test/research/research-handlers.test.ts:27-42` and `:110-126` (shared schema objects, authoritative output parse).
  - Release verification compares live `tools/list` byte-for-byte against locally generated schemas: `scripts/verify-release.ts:107-135` (`matchesExpectedToolCatalog`, including slimmed `outputSchema`), used at `:185-188` and `:383-386`; normalize in release is exercised at `:406-420` via `test/fixtures/release-verification.json` (2 observations) and parsed at `:598-607`.
- `scripts/check-repository.ts` has no schema check; it only sequences gates (`REPOSITORY_GATE_COMMANDS`, lines 20-80) and credential/retired-release scans (100-192).

### 3. CLI / transports / result-size enforcement

- `src/cli.ts:61-95` parses strictly paired options; `--input` JSON only, rejects >`MAX_REQUEST_BYTES` (256 KiB, `shared-schemas.ts:5`) at `cli.ts:82`, `JSON.parse` at 86. No `--input-file`/stdin support; usage text at `cli.ts:114` documents only `--input '<JSON>'`. Per-command byte cap is enforced later by the handler schema (`boundedRequest(..., MAX_NORMALIZE_REQUEST_BYTES)`, `research-contracts.ts:120`), not by the CLI.
- `src/stdio.ts:46-50` passes `{ maxBufferSize: MAX_REQUEST_BYTES }` to `StdioServerTransport` (256 KiB): no separate normalize cap.
- HTTP: body cap from `TQCCL_MCP_MAX_BODY_BYTES` (`worker.ts:102`) → `readBoundedJson` (`worker.ts:291-294`, streaming guard `src/security/request-guards.ts:117-145`, Content-Length early reject 81). Response cap from `TQCCL_MCP_MAX_RESULT_BYTES` (`worker.ts:103`) → `boundedResponse` returning 413 `RESULT_TOO_LARGE` (`worker.ts:120-127`, applied at `:309`). Deployed values `65536` / `98304` (`mcp-worker/wrangler.jsonc:26-27`; `src/worker-configuration.d.ts:8-9`).
- In-process 42 KiB check: `MAX_RESULT_BYTES = 42 * 1024` (`src/research/tool-context.ts:11`); `enforceResultSize` sums `JSON.stringify` bytes and also rejects `>= 40_000` chars (`tool-context.ts:118-126`); called before output-schema validation (`research-handlers.ts:182-190`). So compacting must happen inside `handleNormalize` before this point (or the cap is measured on the handler result).

### 4. `workflowVersion` / `WORKFLOW_BUILD_ID`

- `workflowVersion = workflow:${scrubSafe(releaseId)}:${WORKFLOW_BUILD_ID}` (`src/domain/canonical-state.ts:215-225`), assembled in `research-handlers.ts:177`.
- `WORKFLOW_BUILD_ID` is a committed generated constant (`src/generated/workflow-build.ts:2`) produced by `scripts/generate-workflow-build.ts`: SHA-256 over domain + sorted input list + file bytes (`:167-196`), `--check` mode fails when stale (`:227-238`). Inputs = transitive static-import closure of three entrypoints (`workflow-source-manifest.json:3-7`) plus lockfile/node-version. Closure **includes** `mcp-worker/src/research/{research-handlers,research-contracts,shared-schemas,tool-context,recommend-handlers}.ts` (`workflow-build.ts:48-52`), so any code change here changes the build id — regenerate via `npm run generate:workflow-build`; `npm run check:workflow-build` guards it (`package.json:10-11`).
- Tests pin the behavior: `test/domain/workflow-build.test.ts:129` (“đổi build ID khi nguồn ngữ nghĩa hoặc build input đổi”), `:158` (changes when `js/roster-season-candidates.js` changes); consumer contract says any identity change forces re-normalize (`docs/mcp-research-server.md:33`).

### 5. Docs/skills to update

- `docs/mcp-research-server.md:17` — “Mỗi kết quả dưới 40.000 ký tự và 42 KiB … trần `TQCCL_MCP_MAX_RESULT_BYTES` 98304”; tool list at `:12`; normalize/confirmation flow `:31,99`.
- `docs/goclaw-mcp-skill-handoff.md:39` — claims `TQCCL_MCP_MAX_RESULT_BYTES` is **131072 (128 KiB)**, contradicting the deployed `98304`; flow at `:45-50`; CLI fallback `:77`.
- `docs/project-changelog.md:3` (add entry at top) and historical normalize/tool-surface entries at `:741,752,758,765-768`; limit statement `:767`.
- `.agents/skills/tqccl-coexist-team-builder/SKILL.md:20` (one-shot normalize semantics: “Call … once with every roster item… `ambiguous`/`unknown` `candidates`”), `:34` (CLI `--input '<json>'` — must gain `--input-file`/stdin).
- `agent-knowledge/rules/coexist.jsonl:26` (`review-canonical-state`) and `agent-knowledge/workflows.json:105-141` describe normalize→review, no limits; `.agents/skills/tqccl-lookup/SKILL.md:26` only forbids calling normalize.

### 6. Verification commands (`mcp-worker/package.json:9-37`)

- `npm test` = `vitest run` (all `test/**/*.test.ts` except `*.workerd.test.ts`; `testTimeout: 30_000`, `vitest.config.ts:9`).
- `npm run test:coverage` = same + v8 coverage thresholds 70/80/80/80 on `src/{data,domain,research}` (`vitest.config.ts:12-30`).
- `npm run typecheck` (`tsc --noEmit`), `typecheck:worker` (`test/tsconfig.json`), `build` (`tsconfig.build.json`).
- `npm run check:repository` = full multi-project gate: mcp `check` (workflow-build + knowledge-bundle + local secrets + coverage + both typechecks + build + node-min smoke + control-plane), Astro build/test:dist/verify/e2e, root JS tests, Python `unittest`, Vision worker tests+typecheck, Wrangler dry-run (`scripts/check-repository.ts:20-80`). CI budgets 40 minutes for it (`.github/workflows/mcp-gate.yml:47`); expect the full gate to be the long pole (multi-minute to tens of minutes) [INFERENCE], while `npm test` is the fast loop.
- `npm run test:worker` = workerd configs; `npm run test:stdio` = stdio integration.

### Open points / contradictions
- Docs disagree on the deployed result cap (`98304` in `mcp-research-server.md:17` and `wrangler.jsonc:27` vs `131072` in `goclaw-mcp-skill-handoff.md:39`); the plan should reconcile both.
- `enforceResultSize` measures the **pre-output-schema** result, and `formatToolResult` duplicates the JSON into `content[0].text` + `structuredContent`; the real MCP response is ~2× the measured payload (already the stated rationale for 42 KiB vs 98 KiB).
- No test currently protects the 16 KiB normalize input cap, so raising it is unpinned on the low side; `MAX_RESULT_BYTES*2*1.1 < 98304` (registry test:269) and the 90 KiB `tools/list` pin must both still hold after any output-schema addition.