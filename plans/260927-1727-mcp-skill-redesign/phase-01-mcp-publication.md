# Bước 1 — Publication và MCP

Trạng thái: chưa triển khai. Context: [design](design.md), [scan](reports/repo-scan.md).

## Điều kiện đầu vào

Chốt baseline WIP và ownership trước sửa; không discard/stash thay đổi người khác. Xác minh Node theo `.node-version`. Pin bytes/generation dùng cho cả website và MCP.

## Files

- Sửa `mcp-worker/src/data/{artifact-contracts,filesystem-data-source,static-assets-data-source,lookup-bundle,public-snapshot-view}.ts`.
- Sửa `mcp-worker/src/research/{research-contracts,research-handlers}.ts`, `mcp-worker/src/mcp/tool-definitions.ts`, `mcp-worker/src/cli.ts`.
- Sửa scripts builder/verifier/release có inventory assumptions, `mcp-worker/workflow-source-manifest.json`; generated ID chỉ sinh bằng script owner.
- Tạo `mcp-worker/src/data/publication-projection.ts`, `mcp-worker/src/research/catalog-handlers.ts`, `mcp-worker/src/research/reference-handlers.ts`.
- Chỉ tách pure validator từ website khi cần; không import Node/DOM vào Worker.

## Thực hiện

1. Đo bytes projection và max detail; chốt deterministic shard layout dưới 8 MiB/artifact trước khi viết reader.
2. Viết RED tests cho snapshot v3, mixed generation, private-field exclusion, route/locale parity.
3. Implement builder và readers dùng verified bytes; v1/v2 fixtures giữ identity cũ.
4. Thêm bốn tools, CLI aliases, schemas strict, bounds và cursor bind tool/filter/locale/version.
5. Mở rộng version capabilities và kiểm output migration qua discovery thật.
6. Cập nhật source graph, regenerate workflow ID, kiểm closure không bỏ semantic dependencies.

## RED → GREEN

| RED | GREEN |
|---|---|
| Lookup equipment/advisor không truy được | Search/detail đúng ID, public fields và link |
| Recommended chỉ có trên site | Reference đúng source season và holder/slot |
| Source season bị dùng như ruleset | Đọc reference được; recommendation thiếu luật vẫn bị từ chối |
| Other trả raw legacy tùy ý | Chỉ admitted variant trong tool mới; tool cũ giữ nghĩa |
| Roster không biết nhưng claim buildable | Giữ unknown; chặn suy luận sở hữu |
| Cursor replay khác scope/tool/locale | CURSOR_INVALID |
| Detail quá lớn | Section/pagination hoặc lỗi bounded; không mất slot mà báo đầy đủ |
| Sai hash, symlink, mixed inventory | DATA_UNAVAILABLE đã redact |
| Client ném protocol error khi tool lỗi | OutputSchema validate structured error sau listTools |

Tests mới: `mcp-worker/test/data/publication-snapshot.test.ts`, `test/research/catalog-tools.test.ts`, `test/research/reference-tools.test.ts`. Mở rộng `test/transport/all-tools-parity.test.ts` và release tests hiện có.

## Validation, rủi ro và rollback

Chạy tests mới trước, rồi data/research/domain/transport, typecheck và source-graph checks. Build release chỉ từ baseline sạch đã kiểm chứng. Inventory v3 phải được cập nhật coherent ở builder, reader, verifier và version output. Giữ exact v1/v2 release để rollback; không vá digest bằng tay khi publication đổi giữa chừng.

## Bổ sung mùa mặc định

Season policy: thêm artifact/schema latest theo scope, pin cùng registry và hash vào game release. Không lấy latest từ array/source season; xem [season design](season-resolution-design.md).
