---
title: "Agentize MCP hardening"
description: "Bổ sung schema guidance, actionable MCP errors và coverage gate cho MCP/CLI nội bộ."
status: completed
priority: P1
effort: medium
branch: main
tags: [mcp, cli, agentize, tdd, coverage]
created: 2026-07-30
---

# Agentize MCP hardening

## Invocation

`ak:agentize mcp-worker --both --auto`, giới hạn hardening nội bộ; người dùng quyết định không publish npm.

## Scope

- Thêm mô tả agent-facing vào schema authority và rich tool descriptions.
- Thêm safe actionable MCP errors, giữ redaction và transport parity.
- Thêm coverage provider, script và threshold cho core.
- Không thêm npm `bin`, publishing metadata, SSE, Docker hoặc companion skill.
- Không deploy hoặc gọi Cloudflare/R2 live.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Implement Agentize hardening](./phase-01-implement-agentize-hardening.md) | Completed |

## Acceptance Criteria

- Mọi public input field có description; output fields trọng yếu có description đủ để agent diễn giải.
- Tám tool descriptions nêu khi dùng, kết quả và failure modes.
- MCP error có machine code, safe message và recovery action; không echo input/path/token/upstream.
- Coverage gate đạt line `>=80%`, branch `>=70%` trên core ownership đã định nghĩa.
- CLI/stdio/HTTP parity, workflow identity, typecheck, build và repository gate xanh.
- Plan validator và `git diff --check` đạt.

## Dependencies

- Existing implementation commit `8d6a16e`.
- Verification report: [Agentize verification](../reports/agentize-260730-0006-mcp-cli-verification.md).
- Node `22.16.0` exact repository pin.

## Reports

- [Decision record](../reports/agentize-decisions-260730-0100-mcp-hardening.md)
- [Completion report](../reports/agentize-260730-0100-mcp-hardening.md)
