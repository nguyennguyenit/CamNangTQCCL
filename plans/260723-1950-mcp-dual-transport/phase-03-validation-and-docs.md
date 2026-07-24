# Validation và docs

## Files

- `mcp-worker/test/`
- `mcp-worker/evaluation.xml`
- `docs/mcp-research-server.md`
- README/docs architecture/deployment chỉ cập nhật liên kết hoặc boundary cần thiết.

## Implementation

1. Thêm 10 evaluation read-only, câu trả lời ổn định theo snapshot.
2. Tài liệu lệnh CLI, cấu hình MCP client, R2 upload và Wrangler deploy.
3. Ghi rõ remote auth, data freshness và non-goals.
4. Review giới hạn response, error handling và không lộ internal details.

## Validation

1. `npm run build`
2. `npm run typecheck`
3. `npm test`
4. `npm run test:transports`
5. Kiểm tra Wrangler dry-run.

## Risk và rollback

- Không ghi count snapshot như contract vĩnh viễn; status tool tính từ artifact.
- Không deploy hoặc upload R2 trong bước build này.

