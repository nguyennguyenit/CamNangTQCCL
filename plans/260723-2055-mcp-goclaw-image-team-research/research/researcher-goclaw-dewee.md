---
title: GoClaw/Dewee Contracts for TQCCL Screenshot Agent
date: 2026-07-23
status: complete
scope: planning-only
upstream:
  goclaw_commit: 519df3dd17e06e146c45161ab910e0e69ca6ffe0
  goclaw_docs_commit: 4b2b2b6b2abdda1396c6b5db49d0e8a4fd3aafeb
---

# GoClaw/Dewee Contracts for TQCCL Screenshot Agent

## Summary

Recommended boundary:

```text
Telegram or Zalo OA or Web client
  -> GoClaw/Dewee agent
      -> channel image download/upload + per-user .uploads persistence
      -> read_image vision extraction
      -> tqccl-coexist-team-builder SKILL.md workflow
      -> tqccl_* tools over remote MCP Streamable HTTP + Bearer auth
          -> read-only TQCCL data/recommendation service
```

Use remote `streamable-http`, not `stdio`, in production. Register the MCP server through GoClaw's DB-backed Dashboard/API, store the token in `api_key`, grant only the TQCCL agent, and allow only required tools. GoClaw injects `Authorization: Bearer <api_key>` and encrypts the API key, headers, and env at rest when `GOCLAW_ENCRYPTION_KEY` is configured. Final plan decision: upstream tools already use `tqccl_`, so omit `tool_prefix`.

Do not make the MCP server accept screenshots in MVP. GoClaw already normalizes inbound channel media and can either attach images to a vision-capable main model or route them to a dedicated `read_image` provider. The skill should turn screenshots into structured roster/current-team/locked-tactic input, then call the stateless MCP.

Dewee publicly describes a GoClaw v4-based enterprise control plane with tenant isolation, scoped permissions, channels, WebSocket/HTTP APIs, and “D1·R2·MCP,” but publishes no exact MCP/skill/media administration contract. Treat GoClaw contracts below as the implementation target only after Dewee confirms its hosted control plane exposes the same endpoints/configuration.

## Confirmed contracts

### MCP transport, auth, discovery, and grants

| Capability | Confirmed behavior | Production implication |
|---|---|---|
| Transport | GoClaw supports `stdio`, `sse`, and `streamable-http`. `stdio` spawns a local process; HTTP transports use a URL. | Remote TQCCL service: `streamable-http`. Keep `stdio` for local development only. |
| Custom headers | `headers` is supported for both SSE and Streamable HTTP. Source passes headers through `WithHeaders` / `WithHTTPHeaders`. | Custom `Authorization` or tenant headers work. |
| Bearer secret | DB-backed `api_key` becomes `Authorization: Bearer <api_key>` unless an explicit Authorization header exists. Context/user credentials override server defaults. | Prefer `api_key`; do not embed a token in SKILL.md. |
| Encryption | PostgreSQL and SQLite stores AES-GCM encrypt `api_key`, `headers`, and `env` when an encryption key exists. | `GOCLAW_ENCRYPTION_KEY` is mandatory in production; rotate by updating the server, which evicts its pooled connection. |
| Config-file server | `tools.mcp_servers` servers are loaded at startup and shared across all agents/users; config path has no grant filtering. | Avoid for a privileged production MCP. It is broader than needed and risks plaintext secret configuration. |
| Config env references | Current source resolves `env:` values with a fail-closed allowlist that does not include an arbitrary `MCP_TOKEN`. | Do not assume `"Authorization": "Bearer env:MCP_TOKEN"` works. Use DB-backed secret storage. |
| Grants | Current source routes are `POST /v1/mcp/servers/{id}/grants/agent` and `/grants/user`; agent grants accept `tool_allow` and `tool_deny`. Filtering occurs before tools enter the LLM registry and is rechecked at execution. | Grant only the TQCCL agent; allow exact domain tools. |
| Tool naming | `tool_prefix` prefixes discovered MCP tool names. Collisions without a prefix are skipped. | Final catalog is already `tqccl_`-prefixed; omit `tool_prefix` and grant exact upstream names to avoid double prefix. |
| Large catalogs | Above 40 MCP tools, GoClaw keeps 40 inline and exposes `mcp_tool_search`; deferred tools lazy-activate on direct call. | Keep this MCP catalog small; no search-mode dependency for core workflow. |
| Availability | Health check every 30 seconds; disconnected after 3 consecutive failures; exponential reconnect from 2 seconds, max 10 attempts, cap 60 seconds, then cooldown. | Surface a friendly “data service unavailable” response; do not fabricate recommendations. |
| Trust boundary | MCP results are marker-sanitized and wrapped as external untrusted content; tenant-scoped pool keys and grants are enforced. | Still keep MCP read-only and validate structured outputs. |

Sources: [MCP documentation](https://github.com/nextlevelbuilder/goclaw-docs/blob/4b2b2b6b2abdda1396c6b5db49d0e8a4fd3aafeb/advanced/mcp-integration.md), [MCP config type](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/config/config_channels.go), [transport/header client construction](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/mcp/manager_connect.go), [credential merge and Bearer injection](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/mcp/manager.go), [DB encryption](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/store/pg/mcp_servers.go), [current MCP routes](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/http/mcp.go).

Verified DB-backed server shape:

```json
{
  "name": "tqccl-data",
  "display_name": "TQCCL Data",
  "transport": "streamable-http",
  "url": "https://mcp.example.com/mcp",
  "api_key": "<set through secret-bearing admin request>",
  "timeout_sec": 30,
  "enabled": true
}
```

Create with admin-authenticated `POST /v1/mcp/servers`; do not commit this payload. Then grant:

```json
{
  "agent_id": "<agent UUID>",
  "enabled": true,
  "tool_allow": [
    "tqccl_get_data_version",
    "tqccl_normalize_entities",
    "tqccl_search",
    "tqccl_get_team",
    "tqccl_match_team",
    "tqccl_recommend_team",
    "tqccl_recommend_coexist",
    "tqccl_suggest_replacements"
  ],
  "tool_deny": []
}
```

Submit the grant to `POST /v1/mcp/servers/{server-id}/grants/agent`. `tool_allow` uses the exact already-prefixed upstream MCP names; no configured prefix transforms them.

### Skill install, grants, and discovery

- GoClaw loads six tiers, highest first: `<workspace>/skills`, `<workspace>/.agents/skills`, `~/.agents/skills`, `~/.goclaw/skills`, managed `~/.goclaw/skills-store`, builtin. Thus this repository’s `.agents/skills/tqccl-coexist-team-builder/` is discoverable only when it is actually mounted as the agent workspace.
- Production-safe install: ZIP the skill directory, upload via Dashboard or `POST /v1/skills/import`, then grant the resulting managed skill to the agent with `POST /v1/skills/{id}/grants/agent`. Dashboard/API uploads start `internal` and require a grant before injection.
- Managed versions are hash-deduplicated and versioned. The grant can pin `version`; use that for controlled rollout and rollback.
- Skill hot reload is documented at about 500 ms for filesystem tiers. Managed content is stored under `skills-store`.
- At `<=40` skills and estimated `<=5000` summary tokens, GoClaw injects skills inline. Otherwise it exposes `skill_search` (BM25, optionally hybrid embeddings); the agent calls `use_skill` as an observability marker, then `read_file` to load content.
- `SKILL.md` supports `{baseDir}` for companion files. The current TQCCL skill’s hard-coded `/Users/plateau/.../scripts/list_candidate_teams.py` is non-portable to the GoClaw Linux/container runtime. Before packaging, replace it with `{baseDir}` if the script remains, or make the remote MCP the primary data operation.
- Current skill references are suitable domain rules, but the workflow must explicitly add: analyze every current screenshot, normalize extracted names, construct locked tactics/current teams, call only `tqccl_*`, and refuse silent tactic duplication.

Source: [Skills documentation](https://github.com/nextlevelbuilder/goclaw-docs/blob/4b2b2b6b2abdda1396c6b5db49d0e8a4fd3aafeb/advanced/skills.md).

### Image and multimodal handoff

GoClaw’s common agent pipeline persists inbound media into the per-user workspace `.uploads/`, creates lightweight `MediaRef` records, and then chooses one of two paths:

1. No dedicated `read_image` provider: image bytes are loaded (10 MB per-image safety cap), base64 encoded, and attached inline to the main provider request.
2. Dedicated `read_image` provider: images are not sent inline to the main model. The prompt receives media paths/IDs and the agent calls `read_image`; historical images remain available as fallback context.

For TQCCL, choose option 2. It isolates OCR/vision quality from the reasoning model and keeps the image out of the MCP interface.

Verified `read_image` settings shape:

```json
{
  "builtin_tools": {
    "settings": {
      "read_image": {
        "providers": [
          {
            "provider": "<configured vision provider>",
            "model": "<vision-capable model>",
            "enabled": true
          }
        ]
      }
    }
  }
}
```

Also enable/allow the `read_image` built-in for the agent. If no chain is configured, the main model must itself accept image inputs.

Sources: [Image analysis documentation](https://github.com/nextlevelbuilder/goclaw-docs/blob/4b2b2b6b2abdda1396c6b5db49d0e8a4fd3aafeb/advanced/media-generation.md), [input routing](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/agent/loop_input_media.go), [persistence and 10 MB inline cap](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/agent/media.go).

#### Channel matrix

| Channel | Confirmed inbound screenshot path | Constraints / decision |
|---|---|---|
| Telegram | Downloads the highest-resolution photo/document into local media, publishes `MediaFile`, and persists it through the common agent pipeline. Albums coalesce on a 500 ms silence window into one agent turn. | Best-supported launch channel. Group privacy mode must be disabled if the bot needs non-command group messages. |
| Zalo OA | Official Bot API, DM-only. `message.image.received` downloads the expiring/auth-restricted CDN URL immediately and passes the local file into the common pipeline. Default policy is pairing. | Production-acceptable Zalo choice. Keep screenshots comfortably below 5 MB because docs specify 5 MB even though current download source has a separate 10 MB reader cap. |
| Zalo Personal | Source downloads inbound attachments, detects MIME, emits media tags, and passes the file onward for DMs/groups. | Do not use in production: official docs call it an unofficial reverse-engineered protocol with account lock/ban risk. |
| WebSocket/web chat | Client first multipart-uploads each file to authenticated `POST /v1/media/upload` (50 MB cap), receives `{path,mime_type,filename}`, then sends `chat.send` with `media:[{path,filename}]`. Frame cap is 512 KB, so bytes must not be embedded in WebSocket JSON. | Suitable for first-party web UI. Use `/v1/media/upload`; troubleshooting docs still mention stale `/api/media/upload`. |

Sources: [Telegram docs](https://github.com/nextlevelbuilder/goclaw-docs/blob/4b2b2b6b2abdda1396c6b5db49d0e8a4fd3aafeb/channels/telegram.md), [Telegram inbound implementation](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/channels/telegram/handlers.go), [Zalo OA docs](https://github.com/nextlevelbuilder/goclaw-docs/blob/4b2b2b6b2abdda1396c6b5db49d0e8a4fd3aafeb/channels/zalo-oa.md), [Zalo OA implementation](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/channels/zalo/zalo.go), [Zalo Personal docs](https://github.com/nextlevelbuilder/goclaw-docs/blob/4b2b2b6b2abdda1396c6b5db49d0e8a4fd3aafeb/channels/zalo-personal.md), [Zalo Personal inbound implementation](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/channels/zalo/personal/handlers.go), [media upload endpoint](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/internal/http/media_upload.go), [Web client handoff](https://github.com/nextlevelbuilder/goclaw/blob/519df3dd17e06e146c45161ab910e0e69ca6ffe0/ui/web/src/pages/chat/hooks/use-chat-send.ts).

## Confirmed discrepancies and unknowns

- Current GoClaw source routes MCP grants under `/v1/mcp/servers/{id}/grants/agent`; the MCP guide still shows an older `POST /v1/mcp/grants` example. Use source route.
- WebSocket channel docs omit the `media` field and use older `sessionId`/`channel` examples. Current source uses `sessionKey` and `media`; the first-party web client demonstrates the supported flow.
- WebSocket troubleshooting says `/api/media/upload`; current source and REST catalog use `/v1/media/upload`.
- Zalo OA docs claim generic outbound `media` attachments. Current source explicitly does not consume `OutboundMessage.Media`; it only recognizes a `[photo:URL]` content convention. Inbound screenshots are confirmed and sufficient for this agent, but do not promise outbound image/file replies on OA until tested or fixed upstream.
- Zalo OA docs say 5 MB; current inbound downloader uses a separate hard-coded 10 MB reader. Treat 5 MB as the user-facing limit and add a regression test because the implementation can diverge.
- GoClaw main at the researched commit contains unreleased work. Pin a release/commit and run contract tests before deployment.
- Dewee’s public site confirms positioning and broad capabilities only. It does not document MCP server CRUD, Bearer header storage, skill import/grants, image upload, or channel-specific limits. No Dewee-specific API/config should be invented. Source: [dewee public product page](https://dewee.sh/).

## Security and operational controls

- MCP is read-only. It receives structured game entities, not raw screenshots, channel credentials, user IDs beyond a pseudonymous account key, or GoClaw tokens.
- Keep separate secrets: GoClaw gateway admin token, provider API keys, channel tokens, and MCP Bearer token. Never place them in SKILL.md, repository config, screenshots, prompts, or logs.
- Set `GOCLAW_ENCRYPTION_KEY`; restrict admin API access. GoClaw’s authorized MCP list/get endpoints deserialize decrypted server fields, so treat admin responses and traces as secret-bearing surfaces.
- Use TLS for remote MCP and reject redirects/downgrades at the edge. Allowlist GoClaw egress where possible.
- Grant MCP and skill only to the dedicated agent/tenant. Use `tool_allow`; no mutation/data-deploy tools for end users.
- Use Telegram pairing or allowlist and Zalo OA pairing. Do not set open DM access unless abuse/rate limits are in place.
- Bound image count/size, retain screenshots only as long as needed, and document `.uploads` cleanup/retention. Multiple roster screenshots can expand vision token cost substantially.
- Preserve structured uncertainty from vision: each extracted hero/tactic should include source image, confidence, and unresolved text. Ask the user to confirm low-confidence names before making a final recommendation.
- Cache MCP data by version/ETag, but return `dataVersion` on every recommendation. Fail closed on missing data files or MCP timeouts.

## TDD and integration implications

Implement tests in this order:

1. **Vision extraction contract:** fixture screenshots -> normalized JSON with heroes, red copies, current teams, tactic owners, confidence, unresolved entries. Include Vietnamese diacritics, SP/CO variants, cropped/blurred images, duplicates, and multiple screenshots.
2. **Skill decision tests:** extracted structured input -> locked tactics first -> project tier order `T0 > T0.5 > T1` -> zero silent conflicts. Verify screenshots newer than chat-context notes win.
3. **MCP protocol test:** real Streamable HTTP initialize/list/call against a test server; assert `Authorization: Bearer ...`, tool prefix, timeout, JSON schema, 401/403 behavior, and no secret logging.
4. **Grant tests:** ungranted agent cannot see/call server; allowlisted tools are visible; denied or unexpected mutation tools are absent and rejected at execution.
5. **Skill lifecycle test:** import ZIP, hash-idempotent reimport, grant pinned version, skill discoverable inline/search, companion references readable. Prove no macOS absolute path remains.
6. **Channel tests:** Telegram single photo and album produce one run; Zalo OA image produces one persisted media ref; WebSocket HTTP upload followed by `chat.send.media` produces one run. Enforce documented size/frame failures.
7. **Vision routing test:** with dedicated `read_image`, raw base64 is absent from the main model request and the tool receives a valid persisted path; without it, a vision-capable main model receives inline image content.
8. **End-to-end golden:** screenshot set -> extraction -> `tqccl_recommend_coexist` request -> concise Vietnamese recommendation with build, conflicts, tradeoffs, and `dataVersion`. MCP outage or ambiguous OCR must not yield invented teams.
9. **Security tests:** malicious filename/path traversal, oversized/decompression payloads, prompt-like text inside screenshots, MCP prompt injection markers, cross-tenant access, credential rotation, and redaction in logs/traces.

## Recommended rollout

1. Package the portable skill and references; remove absolute local paths.
2. Configure and enable a dedicated `read_image` provider for the agent.
3. Register the remote MCP through DB-backed administration with `streamable-http`, `api_key`, TLS URL, no `tool_prefix`, and an evidence-based timeout.
4. Grant the managed skill and the minimal MCP tool allowlist only to the TQCCL agent.
5. Launch Telegram first, then Zalo OA after its inbound fixture test; keep Zalo Personal development-only.
6. Add WebSocket/web upload only through `/v1/media/upload` -> `chat.send.media`.
7. Pin the tested GoClaw/Dewee runtime version and monitor MCP health, vision failures, tool latency, duplicate-run rate, data version, and token cost.

## Unresolved questions

1. Which exact Dewee plan/runtime exposes GoClaw MCP server CRUD, skill import/grants, channel configuration, and `read_image` settings?
2. Does Dewee permit a customer-supplied remote Streamable HTTP MCP URL and encrypted `api_key`/custom headers, or require vendor provisioning?
3. Which GoClaw/Dewee release will production pin, and do its routes match commit `519df3d`?
4. Which vision provider/model is approved for Vietnamese TQCCL screenshots, and what accuracy/cost target must pass before launch?
5. What screenshot retention/deletion SLA applies to per-user `.uploads` in managed Dewee?
6. Is Zalo OA text-only output acceptable, or must the agent return annotated images/files?
7. Does the MCP Bearer token scope one tenant/agent, or is an additional tenant/user claim required?
