# Core và CLI

## Context

- [Brainstorm MCP](../reports/260713-brainstorm-mcp-build-tqccl.md)
- [`data/`](../../data/)
- [`js/match-dict.js`](../../js/match-dict.js)

## Files

- Tạo `mcp-worker/src/core/`.
- Tạo loader local và R2.
- Tạo CLI entrypoint và package configuration.

## Implementation

1. Khai báo kiểu dữ liệu tối thiểu cho team, hero, tactic, book và tier.
2. Load sáu JSON artifact; validate top-level shape và cache theo TTL.
3. Chuẩn hóa tìm kiếm Unicode/bỏ dấu, không nhân bản dữ liệu.
4. Implement status, search, get team, find teams và research context.
5. CLI trả JSON mặc định, lỗi actionable qua stderr và exit code khác 0.

## Validation

- Unit test normalization, pagination, filters, joins tier và provenance.
- CLI smoke test bằng process thực.

## Risk và rollback

- Artifact có field không đồng nhất: parser chỉ yêu cầu field dùng thật, giữ unknown data.
- Xóa riêng `mcp-worker/` để rollback; không ảnh hưởng SPA/Worker vision.

