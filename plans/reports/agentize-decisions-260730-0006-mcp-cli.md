---
title: "Agentize decisions — TQCCL MCP and CLI"
status: completed
created: 2026-07-30
plan: ../260730-0006-agentize-verify-mcp-cli/plan.md
---

# Agentize decisions — TQCCL MCP and CLI

## Summary

Audit existing implementation as `--both --auto`, verification-only. Preserve accepted product scope; do not scaffold or publish.

## Decisions

| Axis | Decision | Reason |
|---|---|---|
| Output | CLI + MCP | Both already expose the same eight research capabilities. |
| Core | Keep single package | Shared handlers/contracts already isolate behavior; monorepo split adds no current value. |
| CLI | Keep JSON-only local CLI | No remote credential required; deterministic filesystem source. |
| MCP local | Keep stdio | Official SDK transport, tested end-to-end. |
| MCP remote | Keep stateless Streamable HTTP on Cloudflare | Accepted architecture explicitly avoids session state and SSE. |
| Tools | Keep eight `tqccl_*` names | Each is a user-relevant workflow step; human confirmation must remain between normalization and recommendation. |
| Deployment | Cloudflare only | Docker/PaaS outside accepted scope. |
| Companion skill | Do not create | Original user decision assigns skill lifecycle to external consumer repository. |
| Publishing | Not currently intended | Package is private and repository-operated; strict npm packaging evaluated as a gap only if publishability becomes a goal. |

## Unresolved Questions

- Có muốn biến CLI thành npm package công khai hay chỉ giữ repository-internal?
- Có muốn một plan riêng để bổ sung schema descriptions, actionable MCP errors và coverage threshold?
