---
title: "Platform scout: phases 03 and 04"
status: complete
scouted_at: "2026-07-23T21:06:00+07:00"
---
# Platform scout: phases 03 and 04

## Summary and constraints
Create a separate `mcp-worker/`. Phase 3 owns transport-neutral data/research handlers and CLI; Phase 4 adapts the same handlers to one MCP registry, stdio, and a stateless Cloudflare Worker.

Verified today: 25/25 characterization tests pass across analyze-map/roster-map/recommendation; 28/28 relevant Vision schema/model/mode tests pass. No MCP, CLI, R2, bearer, or transport tests exist.

- MCP SDK `main` is v2 beta; v1 is production-supported and v1.29.0 is latest visible. Exact-pin v1; defer v2.
- Resolve and exact-pin a stable `agents` compatible with that v1; commit lockfile.
- SDK 1.26+ forbids reconnecting a used `McpServer` after a cross-client leak fix: fresh server per Worker request.
- `createMcpHandler` is the documented stateless/no-Durable-Object path; use `route` and `enableJsonResponse`.
- Workers Vitest integration requires Vitest 4.1+; existing Vision Worker uses 2.1.9. Keep packages separate.

Sources: [SDK](https://github.com/modelcontextprotocol/typescript-sdk), [`createMcpHandler`](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/), [Workers testing](https://developers.cloudflare.com/workers/testing/), [Vitest setup](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/), [bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/).

# Phase 3 — Research handlers, filesystem/R2 sources, CLI
## File inventory
| File(s) | Action | LOC | Purpose / test impact |
|---|---|---:|---|
| `package.json`, `tsconfig.json`, generated lockfile | Create | 80+ | Strict ESM/Node20 scripts; reproducible graph |
| `src/data/artifact-contracts.ts` | Create | 190 | Manifest/snapshot types + validators |
| `src/data/data-source.ts` | Create | 100 | Reader/source/cache interfaces and typed errors |
| `src/data/filesystem-data-source.ts` | Create | 90 | Sole Node fs/path/crypto owner |
| `src/data/r2-data-source.ts` | Create | 120 | Structural R2 reader; versioned manifest objects |
| `src/research/research-contracts.ts` | Create | 200 | Inputs/outputs/provenance/limits |
| `src/research/research-handlers.ts` | Create | 320 | Seven canonical handlers |
| `src/cli.ts` | Create | 180 | `parseArgs`, JSON stdout, stderr/exit |
| `test/data/*.test.ts` | Create | 400 | Real artifacts, FS/R2, corruption/cache |
| `test/research/*.test.ts`, `test/cli.integration.test.ts` | Create | 470 | Handler and subprocess contracts |
| Existing `data/`, `js/`, `worker/`, Python skill | No change | 0 | Inputs/regressions |
| Any file | Delete | 0 | None; Python removal deferred |

Six artifacts total 860,045 bytes: 214 teams, 57 tier joins, 5 coexist groups, 112 heroes, 239 tactics, 66 books. Counts are observations, not permanent contracts.

## Function/interface checklist
- Data: `ArtifactName`, `ArtifactDescriptor`, `DataManifest`, `DataSnapshot`, `ArtifactReader.read`, `DataSource.load`, `validateManifest`, `parseArtifact`, `validateCrossReferences`, `createCachedDataSource`.
- Filesystem: CWD-independent data path; hash six files; synthesize local version; never write.
- R2: `current.json` → immutable manifest → declared objects; reject traversal/missing/mixed/hash mismatch; cache swap only after full validation.
- Handlers: `getDataVersion`, `normalizeGameEntities`, `searchGameData`, `getTeamDetail`, `recommendTeamBuild`, `recommendCoexistTeams`, `suggestTacticReplacements`.
- Every handler: one snapshot, deterministic order, bounded result, `dataVersion`, provenance, warnings, pagination.
- Recommendation delegates to Phase 2; replacements use curated alternatives only.
- CLI: `parseCliArgs`, `runCli`, `main`; aliases `status/search/team/find/research-context`; one JSON stdout; exits 0/1/2.
- Freeze seven names. Decide whether currently omitted GoClaw `search_game_data` is remote or CLI-only.

## Dependency map
```text
data/*.json -> FilesystemDataSource --\
R2 objects  -> R2DataSource ----------> DataSource/cache -> DataSnapshot
Phase 2 domain adapters --------------------------------> research-handlers
research-handlers --------------------------------------> CLI + Phase 4 registry
```
Handlers import no MCP/Cloudflare/process APIs. FS stays outside Worker graph; R2 binding is injected; no top-level I/O.

## Tests, TDD, regression
Existing: match-dict; 15 analyze-map; 3 roster-map; 7 recommendation; 28 Vision contract tests. Python CLI has no tests. Missing: artifact atomicity/hash/version, FS/R2 parity, corrupt R2/cache refresh, ambiguity/provenance, pagination/byte ceiling, CLI contract, CLI/MCP parity.

Tests before: real artifacts parse; invalid/mixed release fails safely; FS/R2 semantic parity; seven handlers happy/invalid/empty/paginated; five CLI aliases from non-repo CWD. Refactor: validators → reader/cache → FS → R2 → handlers → CLI.
```bash
cd mcp-worker
npm test -- test/data test/research test/cli.integration.test.ts
npm run typecheck && npm run build
npm run cli -- status
node --test ../tests-js/match-dict.test.mjs ../tests-js/analyze-map.test.mjs \
  ../tests-js/roster-scan-map.test.mjs ../tests-js/team-recommend-engine.test.mjs
cd ../worker && npm test && npm run typecheck
```

## Build/security risks
- Artifact drift: validate used fields, tolerate unknowns, no fixed counts.
- Partial R2: immutable prefix + manifest/hash; retain last valid or fail closed.
- Node leakage: separate entry graphs; Phase 4 Wrangler dry-run.
- Free CPU: pre-index snapshot, clamp input/output, measure cold/warm p95.
- Path injection: artifact union; user text never becomes FS/R2 key.
- Python/TS drift: freeze Python; wrap/remove only after parity.

# Phase 4 — Shared registry, stdio, HTTP Worker, bearer
## File inventory
| File(s) | Action | LOC | Purpose / test impact |
|---|---|---:|---|
| `package.json`, lockfile | Modify | +25 | Exact SDK/Agents/Zod/Workers test deps |
| `src/mcp/tool-definitions.ts` | Create | 230 | Seven schemas/metadata/handler adapters |
| `src/mcp/create-mcp-server.ts` | Create | 90 | Fresh server + shared registration |
| `src/security/bearer-auth.ts` | Create | 85 | Strict bearer, digest compare, 401 |
| `src/stdio.ts` | Create | 45 | FS source + stdio |
| `src/worker.ts` | Create | 150 | Guards/auth/R2/fresh server/handler |
| `wrangler.jsonc`, generated Worker types | Create | 45+ | Separate Worker, R2 binding/date |
| `vitest.config.ts`, `test/tsconfig.json` | Create | 50 | Workerd pool/binding types |
| `test/mcp/registry.contract.test.ts` | Create | 180 | Catalog/schema/annotation/call |
| `test/security/bearer-auth.test.ts` | Create | 130 | Auth/rotation/redaction |
| `test/transport/stdio.integration.test.ts` | Create | 150 | Official client + spawned process |
| `test/transport/worker.integration.test.ts` | Create | 280 | Workerd + real seeded R2 + concurrency |
| Existing Vision Worker / any delete | No change | 0 | Separate deployment/rollback |

## Function/interface checklist
- `ToolDefinition`, `TOOL_DEFINITIONS`, `registerTools`, `createMcpServer`; exact unique names; bounded `structuredContent` + short text.
- Annotations: read-only true, destructive false, idempotent true, open-world false.
- Stdio: one server/process; stdout protocol only; stderr diagnostics; clean signal close.
- `authenticateBearer`: only `Authorization: Bearer`; fixed-length digest/full-byte compare; optional next token; missing secret fails closed; minimal challenge.
- Worker `Env`: `DATA_BUCKET`, current/next bearer, Origin allowlist.
- Order: route/method/Origin/size → bearer → dependencies → fresh server → `createMcpHandler(server,{route:"/mcp",enableJsonResponse:true})`.
- `/healthz` liveness only; every `/mcp` method auth; absent Origin allowed for GoClaw, present Origin exact-match.

## Dependency map
```text
Phase 3 handlers -> tool definitions -> fresh createMcpServer
FS source ------------------------------------------> stdio
R2 binding -> R2 source/cache --\
secret -> bearer ----------------> worker -> createMcpHandler/WorkerTransport
```
Transport depends inward; no global server/transport. Only parsed snapshot/index cache may be module-scoped.

## Tests, TDD, regression
Missing entirely: initialize/list/call both transports; exact catalog; fresh-server regression; auth all methods; Origin/content-type/Accept/protocol errors; workerd R2 cold/warm; two-client isolation; cross-transport parity; upload/Node-import gate.

Tests before: registry contract; stdio official client; bearer matrix; Worker pool seeded R2 + HTTP client; parallel clients; direct 401/404/Origin/errors; CLI/stdio/HTTP equality. Refactor: registry → factory → stdio → auth → Worker → workerd/parity → dry-run.
```bash
cd mcp-worker
npm test -- test/mcp test/security
npm run test:stdio && npm run test:worker
npm run typecheck && npm run build
npm run wrangler:types && npm run deploy:dry-run
```
Full regression also runs root Python/JS and existing Worker gates. Use pinned local binaries, never `npx @latest`. Final staging canary: GoClaw DB `api_key`, `streamable-http`, `tqccl_` prefix, exact tool grant, connect/list/call/reconnect/rotation.

## Build/security risks
- SDK/Agents/v2 churn: exact compatible v1 pair + conformance; raw Web-standard transport rollback.
- Cross-client leak: fresh server/request + parallel-client regression.
- Vitest masks Node APIs: Web-standard graph + Wrangler dry-run.
- Bearer bypass/leak: auth all `/mcp` methods before parsing; digest compare; secret/redaction tests.
- DNS rebinding/browser misuse: exact Origin when present, TLS, bearer; CORS never auth.
- DoS/catalog drift: limits/timeouts/pagination/bounded portfolio; exact-name snapshot + GoClaw canary.

## Unresolved questions
1. Is `search_game_data` remote or CLI-only?
2. Exact result-byte ceiling, pagination, and GoClaw timeout?
3. Is dual-token rotation required initially?
4. Which Phase 6 workflow publishes R2 and switches `current.json`?
5. Does CPU evidence require Workers Paid?
6. Which exact stable `agents` matches the implementation-time SDK v1 pin?
