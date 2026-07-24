---
phase: 4
title: "Add stdio and Streamable HTTP transports"
status: todo
priority: P1
effort: 5d
dependencies: [3]
---

# Phase 4: Add stdio and Streamable HTTP transports

## Context Links

- [Plan](./plan.md)
- [Phase 3 handlers](./phase-03-build-research-tools-data-loaders-and-cli.md)
- [Platform scout](./reports/scout-platform-phases-03-04.md)
- [Cloudflare MCP research](./research/researcher-cloudflare-mcp.md)

## Overview

Expose the exact eight-handler catalog through one MCP registry, local stdio, and authenticated Cloudflare Streamable HTTP. Use a fresh `McpServer` for the stdio process and every HTTP request; keep only validated snapshot/index cache at module scope.

## Requirements

- Functional:
  - Exact upstream names already include `tqccl_`; no registry alias or transport-specific name.
  - Local entrypoint uses filesystem source and official stdio transport.
  - Remote Worker uses separate pointer/release R2 bindings through Phase 3’s narrow reader interfaces, bearer auth, Origin policy, body/result limits, and `createMcpHandler`.
  - Post-auth rate limiting and an isolate-local in-flight ceiling run before R2/server construction; production also requires a pre-Worker edge/WAF rule with repository-owned requirement artifact and live read-only verification.
  - `/mcp` supports protocol-required methods; every method is authenticated before parsing/handling.
  - Public `/healthz` is constant-time, no-I/O liveness only and exposes no secret, corpus, bucket, readiness, or tenant detail. Authenticated `tqccl_get_data_version` plus the release verifier owns data readiness.
- Non-functional:
  - Pin a production-supported MCP SDK v1, negotiated MCP protocol version, and mutually compatible stable Cloudflare `agents` version; no automatic v2/spec upgrade during delivery.
  - Stateless remote behavior, no Durable Object/session/user state, no singleton server/transport.
  - Stdio stdout is protocol-only; logs/errors go to redacted stderr.
  - Separate Node and Worker import graphs; Wrangler dry-run proves no Node built-ins.
  - Read-only, non-destructive, idempotent, closed-world annotations on every tool.
  - Run production-shaped workerd cold/warm benchmarks before completing the Worker adapter; select Free or Paid without weakening validation or recommendation correctness.

## Architecture

```text
TOOL_DEFINITIONS -> createMcpServer(deps) -> fresh registry/server
filesystem source -----------------------> stdio process
R2 source/cache + bearer + guards -------> Worker request
                                            -> createMcpHandler(..., /mcp)
```

The request-scoped Worker server prevents cross-client transport leakage. Warm snapshot caching is optional and keyed by validated data version. If `createMcpHandler` compatibility fails, the rollback path is a raw Web-standard Streamable HTTP adapter without changing registry or handlers.

## File Inventory

| Action | Absolute path | Rough delta | Purpose / test impact |
|---|---|---:|---|
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package.json` | +30–45 | Exact SDK/Agents/Zod/Workers test and transport scripts. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package-lock.json` | generated | Compatible, reproducible graph. |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/tsconfig.json` | +8–15 | Separate Node/Worker entry settings. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/mcp/tool-definitions.ts` | 220–290 | Import/reuse Phase 3 schema objects; add exact metadata, annotations, and adapters without redefining schemas. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/mcp/create-mcp-server.ts` | 80–110 | Fresh server factory and shared registration. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/mcp/format-result.ts` | 100–150 | Bounded structured content with untrusted-field tags plus fixed-template, non-echo text fallback. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/security/bearer-auth.ts` | 90–130 | Strict bearer parsing/comparison/rotation/redaction. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/security/request-guards.ts` | 100–150 | Route, method, Origin, media/header/body checks. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/security/request-limits.ts` | 90–130 | Post-auth token-fingerprint rate limit and isolate-local in-flight ceiling. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/provision-bearer-token.ts` | 60–90 | Operator-only CSPRNG generation streamed directly into an explicitly selected managed secret sink; token never enters argv, files, logs, or normal stdout. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/infra/control-plane-requirements.json` | 40–70 | Non-secret declarative WAF/rate and R2 event/alert requirements, evidence owner, and failure/rollback policy. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/verify-control-plane.ts` | 100–150 | Read-only live verification of required account-level controls selected from current Cloudflare APIs/IaC. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/stdio.ts` | 50–75 | FS source, one server/process, signals, stderr logger. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/worker.ts` | 160–230 | Guards, auth, R2 deps, fresh server, handler. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/wrangler.jsonc` | 55–85 | Separate Worker, compatibility date, pointer/release R2 bindings, rate-limit binding, overlap expiry, and other non-secret vars. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/vitest.config.ts` | 25–40 | Node/workerd projects. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/tsconfig.json` | 20–30 | Workerd binding types. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/mcp/registry.contract.test.ts` | 220–300 | Exact list/schema/annotation/call/error tests. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/security/bearer-auth.test.ts` | 150–210 | Missing/wrong/current/next/redaction cases. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/security/request-limits.test.ts` | 140–200 | Rate/in-flight limits, 429, recovery, and no downstream work. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/transport/stdio.integration.test.ts` | 180–240 | Official client, framing, shutdown. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/transport/worker.integration.test.ts` | 320–430 | Workerd R2, protocol/auth/concurrency/parity. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/transport/all-tools-parity.test.ts` | 240–330 | Table-driven all-eight CLI/stdio/HTTP success and error parity. |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/performance/worker-budget.test.ts` | 120–170 | Workerd cold/warm CPU, R2-read, and worst-valid recommendation evidence. |
| Modify/Delete | None in `/worker/` | 0 | Vision Worker/config/secrets remain independent. |

## Function and Interface Checklist

- [ ] `ToolDefinition`, `TOOL_DEFINITIONS`, `registerTools`, `createMcpServer`.
- [ ] Catalog exactly: `tqccl_get_data_version`, `tqccl_normalize_entities`, `tqccl_search`, `tqccl_get_team`, `tqccl_match_team`, `tqccl_recommend_team`, `tqccl_recommend_coexist`, `tqccl_suggest_replacements`.
- [ ] Tool definitions import the exact Phase 3 runtime schema objects; no second input/output schema authority exists.
- [ ] Annotations: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`.
- [ ] Results expose bounded `structuredContent`, version/provenance/truncation, and explicit untrusted raw/source-field metadata.
- [ ] Text fallback uses fixed templates containing only safe canonical IDs, counts, versions, truncation flags, and error codes; it never interpolates observations, source labels, artifact prose, or other untrusted corpus text.
- [ ] `runStdio` creates one server, connects once, logs only to stderr, and closes on signals.
- [ ] `parseBearer`, `authenticateBearer`, constant-work digest/full-byte comparison, optional next token.
- [ ] Controlled generator/managed secret store creates tokens; runtime honestly validates only base64url format and at least 256 decoded bits, not entropy provenance.
- [ ] Rotation state is current -> dual current/next with required `NEXT_TOKEN_NOT_AFTER` (maximum 15 minutes) -> promote next -> remove old; expired/missing overlap state fails closed and cannot remain valid indefinitely.
- [ ] Operational/rate-limit identity uses only a safely truncated SHA-256 fingerprint; token never enters keys, logs, traces, or records.
- [ ] Missing configured secret fails closed; `WWW-Authenticate: Bearer`; no token echo.
- [ ] Worker `Env` includes separate pointer/release R2 bindings, current/next bearer secrets, `NEXT_TOKEN_NOT_AFTER`, allowed Origins, and non-secret limits. The runtime bundle exposes bindings only through `ArtifactReader`; platform write capability is explicitly application-constrained, not mislabeled IAM.
- [ ] Request order: edge/WAF -> route/method plus cheap Origin/header/declared-length checks -> bearer -> post-auth rate/in-flight limit -> streaming actual-byte/content checks and body parse -> dependencies -> fresh server -> handler.
- [ ] Absent Origin is allowed for authenticated server-to-server clients; present Origin must exactly match the allowlist.
- [ ] `createMcpHandler(server, { route: "/mcp", enableJsonResponse: true })` uses a fresh server/request.
- [ ] Initialize result and tests assert the selected negotiated protocol version; incompatible client negotiation fails explicitly rather than auto-upgrading.
- [ ] `control-plane-requirements.json` assigns every pre-Worker WAF/rate and R2 event/alert control an artifact/evidence owner, expected live state, failure behavior, and rollback; live verification is a Phase 6 release prerequisite.

## Dependency Map

```text
Phase 3 handlers -> TOOL_DEFINITIONS -> createMcpServer
FilesystemDataSource ---------------------------> stdio
R2DataSource/cache + auth/guards ---------------> worker
worker -> fresh createMcpServer -> createMcpHandler
```

No transport imports flow inward to handlers/domain. No `McpServer` or connected transport is module-global.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Initialize/list/call through stdio | Eight exact tools; valid structured result; clean shutdown. |
| Critical | Two concurrent HTTP clients | Independent initialization/calls; no cross-client state/result leak. |
| Critical | Missing/wrong bearer on GET/POST/DELETE `/mcp` | Minimal `401` before body parse; no secret in response/log. |
| Critical | Valid bearer and seeded R2 | Protocol initialize/list/call succeeds with JSON response. |
| Critical | Each of all eight operations via CLI, stdio, HTTP | Deep-equal semantic structured content and equivalent typed outcomes. |
| High | Present disallowed Origin | Rejected before MCP handling; absent Origin remains allowed. |
| High | Oversized/malformed body or wrong headers | Bounded HTTP/protocol error; handler not invoked. |
| Critical | Wrong bearer with chunked, compressed, or malformed body | Minimal `401`; body stream is not consumed before authentication. |
| High | Repeated request after cache expiry/corrupt pointer | Valid old snapshot or typed unavailable; never mixed data. |
| High | Stdio diagnostic is emitted | Appears only on stderr; stdout remains parseable MCP framing. |
| High | Worker dry-run bundle | No Node built-in and below configured size limit. |
| Medium | `/other` and `/healthz` while R2 is unavailable | `404`; health remains constant-time no-I/O liveness while authenticated readiness fails safely. |
| Medium | Current/next overlap reaches `NEXT_TOKEN_NOT_AFTER`, then promotion/removal | Both valid only in the bounded window; expired next and removed old are rejected deterministically. |
| Critical | Burst exceeds token rate or isolate in-flight ceiling | Bounded `429`; body/R2/server untouched; requests recover after window/drain. |
| Critical | Weak, malformed, or expired-overlap bearer configuration | Worker fails closed before serving `/mcp`. |
| High | Negotiated protocol differs from the frozen supported version | Compatibility gate fails and rollout stops; no protocol generation is accepted implicitly. |
| High | Free-tier 10 ms CPU budget is exceeded by production-shaped cold/warm cases | Phase 4 selects Paid or performs bounded optimization before remote integration continues. |
| Critical | Adversarial observation/source text asks the agent to ignore rules | Raw value may remain tagged structured data, but no text fallback echoes it on any transport. |
| Critical | All-eight validation, workflow mismatch, confirmation rejection, and pagination/truncation cases | CLI/stdio/HTTP map the same authoritative schemas and typed error semantics for every applicable tool. |

## Tests Before

1. Freeze exact catalog, annotations, imported Phase 3 schema-object identity, and handler mapping in registry contract tests.
2. Write official SDK client stdio initialize/list/call and raw stdout contamination tests.
3. Write bearer/guard matrix before Worker handler code.
4. Write rate/in-flight limit tests before Worker construction and prove rejected requests do no body/R2 work.
5. Write workerd integration with seeded two-bucket R2, parallel clients, direct HTTP failures, negotiated-version assertions, and production-shaped CPU/R2-read measurements.
6. Write table-driven all-eight parity across success, validation error, workflow mismatch, binding rejection, and applicable pagination/truncation, including injection fixtures.
7. Add Worker import-graph/dry-run gate before merging Worker entrypoint.

## Refactor

1. Resolve and exact-pin compatible SDK v1/Agents/Wrangler/Vitest plus protocol version; record evidence and do not float across the v2 boundary.
2. Implement registry by importing Phase 3 schemas, then implement the non-echo formatter and factory.
3. Add stdio as the first working protocol surface.
4. Implement auth/guards/rate/in-flight limits, controlled token generation, explicit overlap expiry, and rotation transitions independently and fully test them.
5. Add Worker entrypoint with request-scoped server and injected R2 source.
6. Add cross-surface parity and cold/warm/concurrency coverage.

## Implementation Steps

1. Query current package metadata and Cloudflare peer ranges; select stable compatible versions, never `latest`/caret/tilde.
2. Write registry contract tests and register all eight handlers.
3. Implement `createMcpServer`; prove each invocation returns a new unconnected instance.
4. Implement and test stdio with official client transport.
5. Implement bearer strength validation, request guards, rate/in-flight limits, timed rotation, and redaction.
6. Configure separate pointer/release Wrangler bindings and generated types; introduce the declarative control-plane requirements and read-only verifier after confirming current supported Cloudflare APIs/IaC.
7. Implement Worker fetch with exact guard ordering and fresh handler/server per request.
8. Add workerd seeded-R2 tests, two-client isolation, protocol failure cases, and cold/warm budget evidence.
9. Select the Cloudflare Worker tier from the measured budget; do not defer an infeasible Free-tier decision to release.
10. Add table-driven CLI/stdio/HTTP semantic parity for all eight operations and required error/pagination families.
11. Run typecheck/build/dry-run and all project regressions.

## Tests After

- [ ] Duplicate/missing tool names fail catalog test.
- [ ] Handler thrown errors are sanitized and protocol-valid.
- [ ] All methods and content negotiation paths preserve authentication.
- [ ] Rate-limited requests return stable `429` without body consumption, R2 reads, or MCP construction.
- [ ] Cache module stores only validated snapshot/index, never request/server/user state.
- [ ] Worker response never includes bearer, bindings, stack, local path, or raw input.
- [ ] Fixed text fallback never includes untrusted observation/source/corpus strings; control characters are normalized before structured output.
- [ ] Token generator emits correctly sized base64url material, overlap expiry is mandatory/bounded, and retired tokens never return during code rollback.
- [ ] SDK Inspector smoke is documented as manual evidence, not the automated gate.

## Regression Gate

```bash
cd /Users/plateau/Project/CamNangTQCCL/mcp-worker
npm test -- --run test/mcp test/security
npm run test:stdio
npm run test:worker
npm run typecheck
npm run build
npm run wrangler:types
npm run deploy:dry-run
cd /Users/plateau/Project/CamNangTQCCL
node --test "tests-js/*.test.mjs"
python3 -m unittest discover -s tests
cd worker && npm test && npm run typecheck
```

## Success Criteria

- [ ] Registry lists exactly eight already-prefixed upstream tools with correct read-only annotations.
- [ ] CLI, stdio, and HTTP reuse one runtime-schema authority and pass table-driven all-eight semantic/error parity.
- [ ] Stdio stdout is protocol-clean; Worker has no Node dependency.
- [ ] Every remote MCP method is bearer-protected, protocol-pinned, rate/in-flight limited, and Origin/body/result bounded.
- [ ] Fresh-server/request and parallel-client tests prove stateless isolation.
- [ ] Pinned build, typecheck, workerd tests, Wrangler dry-run, and project regressions pass.
- [ ] Production-shaped workerd evidence records the selected Free/Paid tier before external consumer integration.
- [ ] Existing Vision Worker is unchanged.

## Security and Privacy

- Store production bearer only in a managed Worker secret store; never in `wrangler.jsonc`, argv, query, logs, health, or errors. A permission-restricted, ignored local `.dev.vars` is exceptional, short-lived, scanned including ignored/untracked files, and deleted after use.
- TLS is mandatory in staging/production. CORS is not authentication.
- Remote route is read-only and has no data publication, media, crawler, memory, or admin tool.
- Use least-information errors and bounded work before expensive parsing/handler calls.

## Risks and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| SDK/Agents incompatibility | Exact pair plus protocol/build tests. | Swap only transport adapter to raw Web-standard transport. |
| Cross-client state leak | Fresh server/request and two-client regression. | Disable remote route; stdio/CLI remain usable. |
| Free Worker CPU too low | Measure in Phase 3 proxy and Phase 4 workerd; choose Paid before integration if needed. | Change plan tier, not validation/correctness. |
| Bearer compromise | Managed generation, bounded dual-token overlap, revoke, and pool-eviction staging test. | Remove compromised token, promote a fresh current token, and never restore retired secret state with old code. |
| Quota/cost exhaustion | Edge/WAF rule plus token-keyed rate limit and isolate-local in-flight cap. | Disable route or tighten limits without weakening correctness. |

## Next Steps

Phase 5 may publish the consumer handoff in parallel. Phase 6 depends directly on this phase and determines MCP production readiness; registration, grants, prefix configuration, and reconnect behavior belong to the consuming platform.
