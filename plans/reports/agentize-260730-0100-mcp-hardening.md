---
title: "Agentize completion — MCP hardening"
status: completed
created: 2026-07-30
plan: ../260730-0100-agentize-mcp-hardening/plan.md
---

# Agentize completion — MCP hardening

## Kết quả

Đã đóng ba gap Agentize trong phạm vi MCP/CLI nội bộ:

1. Mọi public input/output field có description; tám tool mô tả rõ khi dùng, kết quả và failure modes.
2. MCP errors trả fixed safe envelope gồm `code`, `message`, `nextAction`, `retryable`. Cả handler errors, malformed input bị SDK chặn, unknown tool và output sai contract đều không phản chiếu exception, input hoặc private payload.
3. Coverage V8 trở thành gate bắt buộc của `npm run check` trên `src/data`, `src/domain`, `src/research`, với ngưỡng statements/lines/functions `80%` và branches `70%`.

Schema metadata đã đổi nên `workflowBuildId` được tái tạo. Bản staging/live tương lai phải dùng identity mới.

## Xác minh

- Official MCP Client contract tests: `9/9`.
- MCP suite: `216/216`.
- Workerd: `2/2`.
- Coverage: statements `89.08%`, branches `81.84%`, functions `95.37%`, lines `89.56%`.
- Typecheck, Worker typecheck, build, Node pin, control-plane artifact, Astro build/dist/E2E, root JS, Python, Vision Worker, Wrangler dry-run và repository release gate đều đạt.
- Dependency audit: `0` vulnerabilities.
- Independent review sau sửa: không còn finding hoặc blocker.

## Phạm vi không thực hiện

- Không publish npm hoặc thêm publishing metadata.
- Không thêm SSE, Docker, companion skill hoặc monorepo split.
- Không gọi Cloudflare/R2 live, không deploy Worker và không đổi release pointer.
- Plan production gốc tiếp tục `in_progress` vì các live release gate vẫn cần ủy quyền riêng.
