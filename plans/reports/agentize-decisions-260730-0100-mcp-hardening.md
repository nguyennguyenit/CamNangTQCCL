---
title: "Agentize decisions — MCP hardening"
status: accepted
created: 2026-07-30
plan: ../260730-0100-agentize-mcp-hardening/plan.md
---

# Agentize decisions — MCP hardening

## Decisions

| Axis | Decision | Reason |
|---|---|---|
| Output | Keep internal CLI + MCP | User explicitly declined npm publishing. |
| Tool set | Keep eight read-only tools | Existing workflow and confirmation boundary are intentional. |
| Schema | Enrich existing Zod authority | Avoid duplicate schema/docs source. |
| Errors | Add safe recovery metadata | Improve agent autonomy without weakening redaction. |
| Coverage | Enforce core thresholds in package and CI | Convert unmeasured quality into executable gate. |
| Transports | Keep stdio + stateless Streamable HTTP | SSE outside accepted scope. |
| Deployment | No live action | Hardening must finish before staging. |

## Unresolved Questions

None.
