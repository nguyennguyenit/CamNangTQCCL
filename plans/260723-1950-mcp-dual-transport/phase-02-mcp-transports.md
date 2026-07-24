# MCP transports

## Context

- Cloudflare `createMcpHandler()` cho stateless Streamable HTTP.
- MCP SDK `StdioServerTransport` cho local subprocess.

## Files

- `mcp-worker/src/mcp-server.ts`
- `mcp-worker/src/stdio.ts`
- `mcp-worker/src/worker.ts`
- `mcp-worker/wrangler.jsonc`

## Implementation

1. Factory tạo `McpServer` mới và đăng ký shared tools.
2. Entrypoint stdio chỉ ghi protocol ra stdout; diagnostics dùng stderr.
3. Worker route `/mcp`, validate Bearer token trước MCP handler.
4. Worker dùng R2 loader và cache module-level; health endpoint không tiết lộ secret.
5. Tool annotations đều read-only, non-destructive và idempotent.

## Validation

- MCP stdio client initialize, list tools và call tool.
- HTTP Request MCP initialize/list/call với mock R2.
- Test 401 cho token thiếu/sai và 404 ngoài route.

## Risk và rollback

- SDK/Agents mismatch: pin dependency stable và test build Worker.
- Không dùng Durable Object vì tools stateless; thêm sau nếu contract đổi.

