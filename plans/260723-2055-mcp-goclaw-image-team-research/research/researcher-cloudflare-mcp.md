---
title: "Cloudflare MCP dual-transport architecture research"
status: complete
researched_at: "2026-07-23T20:56:00+07:00"
scope: "Planning only; TypeScript stdio + Cloudflare Workers Streamable HTTP"
---

# Cloudflare MCP dual-transport architecture research

## Summary

Use a separate `mcp-worker/` TypeScript package. One runtime-neutral factory registers the tools on a fresh `McpServer`; two thin entrypoints inject either a filesystem or R2 data source and connect stdio or Streamable HTTP. Do not merge this into the existing Vision Worker: its package is a distinct service on Wrangler 3-era dependencies and has unrelated secrets, routes, rate limits, and failure modes.

For production on 2026-07-23, use `@modelcontextprotocol/sdk` v1 and Cloudflare `createMcpHandler()` from `agents/mcp`. The official SDK repository says v2 is still beta until the planned 2026-07-28 release and v1 remains the supported production line. The latest v1 release visible in the official repository is `v1.29.0`, but implementation must resolve and lock a mutually compatible `sdk` + `agents` pair rather than copy an unverified `agents` version from `main`.

Keep the accepted R2 design: private R2 Standard objects, versioned by a manifest, with best-effort warm-isolate caching. The committed six JSON files are only 860,045 bytes total, so Worker static assets are technically sufficient, but they couple data and code deployment. R2 preserves the explicit requirement that data can publish independently from MCP code.

## Decision

| Concern | Decision | Reason |
|---|---|---|
| Tool ownership | One `createMcpServer(deps)` factory | Same names, schemas, annotations, handlers across transports |
| Local transport | SDK `StdioServerTransport` | Official local subprocess transport |
| Remote transport | `createMcpHandler(server, { route: "/mcp", enableJsonResponse: true })` | Stateless, no Durable Object, least Worker-specific plumbing |
| Server lifecycle | Fresh `McpServer` per stdio process and per HTTP request | Avoid shared transport/session state and permit request-scoped `env` |
| Remote auth | Pre-handler `Authorization: Bearer <secret>` | Small trusted service-to-service deployment; compatible if GoClaw can set headers |
| Data | R2 Standard + immutable release prefix + current manifest | Independent atomic-ish data publishing, private binding, cheap at this size |
| Runtime cache | Module-level parsed snapshot keyed by manifest version/ETag, bounded TTL | Reduces R2 reads/JSON parse; never correctness-critical |
| Deployment | New `mcp-worker/`, not `worker/` | Isolates Vision Worker contracts and rollback |

Cloudflare documents `createMcpHandler()` specifically for stateless tools in a plain Worker, with no Durable Object; raw `WebStandardStreamableHTTPServerTransport` is the full-control alternative. Streamable HTTP is the current remote transport and SSE is legacy. See [remote MCP server guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/), [`createMcpHandler` API](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/), and [transport guidance](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/).

## Exact module and entrypoint design

```text
mcp-worker/
  package.json
  package-lock.json
  tsconfig.json
  wrangler.jsonc
  src/
    core/
      contracts.ts              # runtime-neutral domain/input/output types
      research-service.ts       # normalize/search/detail/context behavior
    data/
      data-source.ts            # DataSource interface + Snapshot/Manifest types
      validate-snapshot.ts      # schema/count/hash/version checks
      fs-data-source.ts         # Node-only; imported only by stdio
      r2-data-source.ts         # Worker-only; imported only by worker
    mcp/
      tool-definitions.ts       # registry array: name/schema/annotations/handler
      create-mcp-server.ts      # creates McpServer and registers every definition
      format-result.ts          # MCP structuredContent + bounded text fallback
    stdio.ts                    # Node entrypoint
    worker.ts                   # Cloudflare module Worker entrypoint
  test/
    core/
    contract/
    transport/
```

Core contract:

```ts
type McpDependencies = {
  dataSource: DataSource;
  logger: Pick<Console, "error" | "warn">;
  limits: ResultLimits;
};

export function createMcpServer(deps: McpDependencies): McpServer {
  const server = new McpServer({ name: "tqccl", version: SERVER_VERSION });
  registerTools(server, deps);
  return server;
}
```

Stdio:

```ts
const server = createMcpServer({
  dataSource: new FsDataSource(DATA_DIR),
  logger: stderrLogger,
  limits: DEFAULT_LIMITS,
});
await server.connect(new StdioServerTransport());
```

`stdio.ts` must never write diagnostics to stdout; stdout belongs exclusively to MCP framing.

Worker:

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const route = new URL(request.url).pathname;
    if (route === "/healthz") return healthResponse();
    if (route !== "/mcp") return new Response("Not found", { status: 404 });
    if (!hasValidBearer(request, env.MCP_BEARER_TOKEN)) {
      return unauthorizedResponse();
    }

    const server = createMcpServer({
      dataSource: getR2DataSource(env.DATA_BUCKET),
      logger: redactingLogger,
      limits: DEFAULT_LIMITS,
    });
    return createMcpHandler(server, {
      route: "/mcp",
      enableJsonResponse: true,
    })(request, env, ctx);
  },
};
```

Create a new server rather than exporting a transport-connected singleton. Keep `fs-data-source.ts` out of the Worker import graph so Node built-ins cannot leak into the Worker bundle. The registry owns only MCP adaptation; domain behavior stays in `research-service.ts` so CLI, stdio, and HTTP cannot diverge.

Tool results should set read-only/non-destructive/idempotent annotations and return bounded `structuredContent`. Include `dataVersion`, provenance, truncation/pagination fields, and a short text fallback. Never return the entire ~1 MB corpus by default.

## Version strategy

1. Production baseline now: `@modelcontextprotocol/sdk` v1. The official repository explicitly marks v2 beta and v1 production-supported; its releases page shows `v1.29.0` on 2026-03-30. Sources: [SDK repository](https://github.com/modelcontextprotocol/typescript-sdk#readme), [SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases), and [v1 branch](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x).
2. At implementation, query the package registry once and pin exact versions—no caret, tilde, `latest`, Git SHA, or `main`. Commit the lockfile.
3. Pin `agents` to the newest stable release whose peer/dependency range accepts the selected SDK v1 and which passes Worker build plus transport conformance. Do not guess an exact `agents` number from the mutable [Cloudflare Agents source](https://github.com/cloudflare/agents).
4. Pin `wrangler`, TypeScript, Workers types, and schema library in the new package. The existing Vision Worker's `wrangler ^3.60.0` is not a suitable shared baseline.
5. Pin `compatibility_date`; advance it only in a tested dependency update PR.
6. Upgrade to SDK v2 only after it is stable and Cloudflare `agents` documents/releases compatibility. Treat it as a migration: package names/imports change from the v1 combined package to split v2 server/client packages.

## `createMcpHandler` versus raw Web-standard transport

| | `createMcpHandler` | Raw `WebStandardStreamableHTTPServerTransport` |
|---|---|---|
| Dependencies | `agents` + MCP SDK | MCP SDK only |
| Worker integration | Route, CORS, auth context, Worker transport wrapper | Caller owns all HTTP routing and lifecycle |
| State requirement | None for this use | None for this use |
| Control | Sufficient for `/mcp`, JSON response, stateless calls | Maximum control |
| Compatibility risk | `agents`/SDK version pairing | More application code and protocol edge cases |
| Recommendation | **Use now** | Fallback if Agents compatibility/build fails |

Raw transport is not inherently more correct. It increases responsibility for GET/POST/DELETE behavior, `Accept` and MCP headers, status codes, Origin handling, connection cleanup, and protocol errors. Keep a small transport adapter boundary so replacing `createMcpHandler` does not touch tool definitions or domain code.

Do not use `McpAgent`: tools are read-only/stateless and the service stores no user/session state, so a Durable Object adds cost and lifecycle complexity without a contract need.

## Authentication usable by GoClaw/Dewee

Recommended MVP: one high-entropy Worker secret, sent as an `Authorization: Bearer` header and checked before request parsing or MCP handling.

- Store with Worker secrets; never in `wrangler.jsonc`, logs, health output, tool errors, or query parameters.
- Compare without early character-by-character exit; rotate by temporarily accepting current + next secrets, then remove the old one.
- Return `401` with a minimal `WWW-Authenticate: Bearer` challenge for missing/invalid credentials.
- Apply auth to every `/mcp` method, including GET and DELETE, not just POST.
- Health endpoint reports process/data readiness only, with no corpus or secret metadata.

This is usable only if GoClaw's actual MCP client configuration can attach a fixed custom header. Cloudflare's own MCP client supports custom transport headers for bearer tokens, but that does not prove GoClaw/Dewee support. The GoClaw canary is therefore a release gate.

Fallbacks:

1. If GoClaw supports local stdio only, configure the local stdio entrypoint; no network bearer is needed. Alternatively use a local remote-to-stdio proxy, but that adds another pinned process and secret boundary.
2. If GoClaw supports OAuth but not arbitrary headers, use MCP OAuth 2.1 through Cloudflare's OAuth Provider Library/Access. Cloudflare documents Access, third-party, bring-your-own, and self-hosted OAuth options in [authorization guidance](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/). This is appropriate for multiple users, consent, scopes, and revocation—not for the initial single trusted service.
3. Cloudflare Access service tokens require two custom headers; use only after verifying GoClaw can configure them.

The MCP authorization specification is OAuth-based for HTTP transports; stdio credentials should come from the environment. See the [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization). Static bearer is a pragmatic service credential, not a complete OAuth authorization-server implementation.

## Data storage recommendation

Current corpus measured from the six planned objects:

| Data | Bytes |
|---|---:|
| `teams.json` | 574,880 |
| `team-tier.json` | 13,043 |
| `coexist.json` | 34,989 |
| `heroes-dict.json` | 74,591 |
| `tactics.json` | 156,952 |
| `books-dict.json` | 5,590 |
| **Total** | **860,045** |

Use R2 Standard:

```text
releases/<data-version>/manifest.json
releases/<data-version>/teams.json
...
current.json -> { "dataVersion": "...", "manifestKey": "..." }
```

Publish all immutable release objects and validate hashes/counts first; update `current.json` last. A loader reads the pointer/manifest, then the named objects, validates schema/hash, and only then swaps the in-isolate parsed snapshot. On any partial/corrupt release, keep the previous valid warm snapshot or fail closed with a typed data-unavailable tool error. Expose the loaded version through `get_data_version`.

R2 Standard currently includes 10 GB-month, 1M Class A, and 10M Class B operations monthly; `GetObject` is Class B and egress is free. Standard has no retrieval fee/minimum duration. See [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Six or seven cold-load subrequests remain well below the free Worker limit of 50 subrequests per invocation.

Static assets remain a viable rollback/simplification:

- Advantages: no bucket, atomic code+data deploy, global asset cache, asset binding.
- Disadvantages: code/data cannot release independently; accidental public routing is easy; rollback always rolls both; Wrangler deployment owns the corpus.
- A 1 MB corpus is far below the 25 MiB per-file limit. Asset payload is separate from Worker script, whereas importing JSON into TypeScript risks inflating the script bundle.

Cloudflare explains assets binding/routing in [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/). Because the accepted architecture requires independently live data, retain R2. Do not bundle the JSON into the Worker JavaScript.

## Worker limits and design implications

Relevant current limits from [Workers limits](https://developers.cloudflare.com/workers/platform/limits/):

| Limit | Free | Paid | Implication |
|---|---:|---:|---|
| Worker script size | 3 MB | 10 MB | CI checks compressed upload size; exclude corpus from bundle |
| Memory/isolate | 128 MB | 128 MB | One parsed ~1 MB snapshot is safe; bound caches/results |
| CPU/request | 10 ms | 5 min, 30 s default | Free may be tight for cold JSON parse + recommendation; measure before choosing plan |
| Subrequests/invocation | 50 | 10,000 | 7-object cold load fits; avoid per-candidate R2 reads |
| Free requests | 100,000/day | no fixed daily cap | Rate-limit only if abuse/cost evidence appears |
| Static asset file | 25 MiB | 25 MiB | Current files fit easily |
| HTTP request body | 100 MB on Free/Pro | plan-dependent | MCP must impose a much smaller application limit |

Worker HTTP wall time has no hard limit while the client remains connected, but this service should return bounded JSON promptly. Set application-level input limits, tool timeouts, candidate limits, pagination, and maximum result bytes.

## Failure modes

| Failure | Required behavior |
|---|---|
| SDK/Agents incompatibility | Exact lockfile; Worker build + conformance test blocks merge; raw transport is rollback |
| Singleton server connected to multiple transports | Factory creates fresh server per connection/request |
| stdout contamination | stdio diagnostics only on stderr; test raw stdout framing |
| Missing/wrong bearer | `401` before body parsing, no secret/token logging |
| GoClaw cannot set header | stdio/proxy or OAuth path; do not ship unauthenticated remote |
| Partial R2 publish/schema drift/hash mismatch | Never activate snapshot; retain last valid warm version or typed `503` |
| Warm cache stale | Bounded TTL + manifest version; `get_data_version` exposes actual loaded version |
| Isolate eviction | Correct cold reload; cache is optimization only |
| Free CPU overrun | Measure cold/warm p95; pre-index once per snapshot; move to Paid before weakening validation |
| Oversized tool output | Pagination/truncation and result-byte ceiling |
| Origin/DNS-rebinding risk | Enforce explicit allowed Origins when present; bearer always required; no permissive credentialed CORS |
| Node imports in Worker | Separate TypeScript entry graphs; Worker build test |
| Data differences local/remote | Same validator/manifest contract; parity tests assert version + semantic result |

The MCP Streamable HTTP specification requires Origin validation to mitigate DNS rebinding and recommends authentication; see [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## TDD and transport test matrix

Write failing contract tests before transport adapters.

| Layer | Test | Evidence required |
|---|---|---|
| Registry | Create server, list tools | Exact names, schemas, descriptions, read-only annotations |
| Core | Normalize/search/detail/context against committed dataset | Stable semantic assertions, pagination, provenance, no oversized response |
| Data contract | Filesystem and seeded R2 loaders | Same manifest validation and snapshot hash |
| Stdio integration | Spawn built `stdio.js`; use official SDK client/`StdioClientTransport` | initialize → initialized → list → valid/invalid call; clean stdout; process shutdown |
| HTTP integration | Run Worker under `@cloudflare/vitest-pool-workers` or Miniflare with seeded R2; use SDK `StreamableHTTPClientTransport` | initialize, list, call, JSON response, protocol headers, concurrent independent calls |
| Auth | Direct HTTP | missing/wrong token `401`; valid token works; secret absent from logs/body; all methods protected |
| Routing/security | Direct HTTP | `/mcp` only; other path `404`; allowed/disallowed/absent server-to-server Origin policy; body/result limits |
| Data failure | Seed incomplete/corrupt next release | previous snapshot retained or typed unavailable; never mixed versions |
| Cold/warm | First and repeated request | bounded R2 reads, same result, cache eviction-safe |
| Parity | Same tool/input over stdio and HTTP | Deep-equal structured result except declared runtime metadata |
| Worker gate | Wrangler dry-run/build | no Node built-ins; uploaded bundle < plan limit |
| Real client canary | GoClaw/Dewee staging config | header reaches Worker, list/call succeeds, reconnect works |
| Protocol smoke | MCP Inspector | authorized connect, list/call; error responses remain protocol-valid |

Cloudflare recommends MCP Inspector and real remote clients for testing, while noting that remote authorized connections still vary by client; see [Test a Remote MCP Server](https://developers.cloudflare.com/agents/model-context-protocol/guides/test-remote-mcp-server/). Do not make Inspector the only automated test.

## Implementation sequence

1. Record tool/result and dataset manifest contracts in tests.
2. Implement runtime-neutral core, validator, and registry factory.
3. Add filesystem loader + stdio integration.
4. Resolve/pin the compatible SDK/Agents/Wrangler set; add Worker loader + auth + handler.
5. Add parity, corruption, build-size, and security tests.
6. Run the GoClaw/Dewee staging canary before provisioning production access.
7. Publish R2 release first, Worker second; no production deployment is part of this planning task.

## Unresolved questions

1. Can the exact GoClaw/Dewee MCP client version configure `Authorization` headers for Streamable HTTP, and does it support `application/json` responses? This must be verified in its official config/runtime, not assumed.
2. Is one shared service token acceptable, or is per-user revocation/audit required? The latter changes the decision to OAuth/Access.
3. Must remote data update independently from MCP code? Existing accepted plans say yes (R2); if that requirement is withdrawn, static assets are the simpler MVP.
4. What maximum tool result bytes, pagination defaults, and GoClaw timeout are required?
5. Is Workers Free acceptable after cold/warm CPU measurement, or should production start on Paid for the 30-second default CPU allowance?
