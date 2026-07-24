---
title: "MCP dual transport"
description: "Initial transport-only outline superseded by the image-driven GoClaw/Dewee plan."
status: cancelled
priority: P1
effort: ""
tags: [feature, api, infra]
blockedBy: []
blocks: []
created: 2026-07-23
---

# MCP dual transport

Superseded by
[MCP GoClaw image team research](../260723-2055-mcp-goclaw-image-team-research/plan.md).
Do not implement this outline independently.

Status: cancelled

## Outcome

AI Agent có thể research dữ liệu TQCCL qua cùng một bộ MCP tools bằng:

- `stdio` khi chạy local;
- Streamable HTTP tại `/mcp` khi deploy Cloudflare Workers;
- CLI cho truy vấn thủ công và automation.

## Constraints

- TypeScript strict, tool registry và research core dùng chung giữa các transport.
- Read-only, stateless; dữ liệu local đọc từ `data/`, remote đọc từ Cloudflare R2.
- Remote yêu cầu Bearer token; không log hoặc commit secret.
- Kết quả có pagination, giới hạn kích thước và provenance.
- Không sửa hoặc gộp vào Vision Worker hiện tại.

## Non-goals

- Web crawling, Browser Rendering, LLM inference.
- Lưu roster/session người dùng.
- Recommender portfolio và thay thế chiến pháp trong lần triển khai nền transport này.
- Deploy production hoặc tạo Cloudflare resources.

## Phases

1. [Core và CLI](phase-01-core-and-cli.md)
2. [MCP transports](phase-02-mcp-transports.md)
3. [Validation và docs](phase-03-validation-and-docs.md)

## Dependencies

- Node.js 20+.
- `@modelcontextprotocol/sdk` v1 stable, `agents`, `zod`.
- Cloudflare R2 binding `DATA_BUCKET` khi chạy remote.

## Acceptance criteria

- CLI search/status/team/find/research-context chạy từ checkout hiện tại.
- MCP client qua stdio list/call được tools.
- Cloudflare handler nhận MCP Streamable HTTP tại `/mcp`.
- Cả hai transport đăng ký cùng tên, schema và handler tools.
- Remote từ chối thiếu/sai Bearer token.
- Build, typecheck, unit tests và transport integration tests pass.
