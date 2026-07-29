---
title: "Agentize verification for TQCCL MCP and CLI"
description: "Đối chiếu read-only implementation hiện tại với các gate agent-centric của ak:agentize."
status: completed
priority: P1
effort: small
branch: main
tags: [verification, mcp, cli, agentize]
created: 2026-07-30
---

# Agentize verification for TQCCL MCP and CLI

## Invocation

`ak:agentize mcp-worker --both --auto` ở chế độ **verification-only** theo yêu cầu người dùng.

## Scope

- Kiểm chứng core/adapter boundary, CLI, stdio MCP và Streamable HTTP hiện có.
- Đối chiếu tool design, auth, credential boundary, packaging, tests, CI và tài liệu.
- Không scaffold lại, không thêm SSE/Docker/companion skill, không publish hoặc deploy.
- Chỉ đề xuất thay đổi nếu có gap thực tế; không coi khác biệt ngoài accepted scope là lỗi.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Agentize verification](./phase-01-agentize-verification.md) | Completed |

## Checklist

- [x] Scout entry points, capabilities, side effects, config, secrets, runtime và tests.
- [x] Lập Agentization Map cho tám capability hiện có.
- [x] Xác nhận output mode và accepted scope từ plan gốc.
- [x] Đánh giá scaffold/core/CLI/MCP adapter hiện tại.
- [x] Chạy hardening gates phù hợp và kiểm tra security boundary.
- [x] Kết luận package/readiness, gaps và non-issues.
- [x] Ghi báo cáo verification và cập nhật trạng thái plan.

## Acceptance Criteria

- Kết luận dựa trên source/test cụ thể, không suy diễn từ README.
- Phân biệt gap thực tế với yêu cầu Agentize không thuộc accepted scope.
- Không gọi Cloudflare/R2 live và không thay đổi production.
- Plan validator và `git diff --check` đạt.

## Dependencies

- Existing MCP implementation commit `8d6a16e`.
- Node `22.16.0` exact repository pin.

## Reports

- [Agentize decisions](../reports/agentize-decisions-260730-0006-mcp-cli.md)
- [Agentize verification](../reports/agentize-260730-0006-mcp-cli-verification.md)
