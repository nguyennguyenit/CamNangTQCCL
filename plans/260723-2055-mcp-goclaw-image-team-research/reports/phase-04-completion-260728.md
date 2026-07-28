# Báo cáo hoàn tất Phase 4 — 2026-07-28

## Kết quả

- Đã thêm một MCP registry dùng đúng tám schema/handler Phase 3 cho CLI, stdio và HTTP.
- Stdio dùng official SDK transport; stdout chỉ chứa protocol và process con tắt sạch khi client đóng.
- Remote dùng raw Web-standard Streamable HTTP SDK v1, server/transport mới theo POST request, hai R2 binding và snapshot cache đã validate.
- `/mcp` áp cheap header guard → managed bearer → rate/in-flight → actual-byte JSON → R2/server; `/healthz` là no-I/O liveness.
- Bearer là pre-shared credential cho managed client, không phải OAuth. Generator chỉ đưa token CSPRNG 256 bit qua stdin của managed secret sink.
- Control-plane artifact và verifier chỉ đọc đã khóa edge rate rule, release-bucket lock và R2 event queue. Live verification vẫn là release gate Phase 6.

## Dependency và protocol

| Thành phần | Pin |
|---|---|
| Node | `22.16.0` |
| MCP SDK v1 | `1.30.0` |
| MCP protocol | `2025-11-25`; chấp nhận `2025-06-18` cho subsequent request |
| Wrangler | `4.114.0` |
| Workers Vitest integration | `0.18.8` |
| Workers types | `5.20260728.1` |

Cloudflare `agents` không được giữ trong dependency graph vì stable line tương thích handler mới kéo Node engine cao hơn pin repository, còn legacy line khóa SDK cũ có advisory. Phase 4 dùng fallback đã duyệt: raw Web-standard transport của SDK v1, không dùng `createMcpHandler`.

## Bằng chứng budget

Workerd với hai R2 binding và toàn corpus production ghi nhận wall-clock proxy:

| Case | Quan sát |
|---|---:|
| Cold data-version | `17–29ms` |
| Warm data-version | `3ms` |
| Recommendation, `maxTeams=10` | `14–17ms` |

Đây là wall-clock proxy local, không phải CPU SLA. Kết hợp CPU proxy Phase 3 đã vượt `10ms`, tier vận hành được chọn là **Workers Paid**; không giảm validation hoặc recommendation correctness để ép Free.

## Bằng chứng xác thực

- Reviewer cuối: **PASS** sau bản sửa khóa protocol cho cả JSON-RPC scalar và batch.
- MCP Node `165/165`, workerd `2/2`, tổng `167/167`; Node/Worker typecheck, build, workflow identity, Wrangler types/dry-run và `npm audit`: PASS.
- Wrangler dry-run: upload `1347.44 KiB`, gzip `237.82 KiB`, không cần Node compatibility flag.
- Root Node `133/133`, Python `82/82`, Vision Worker `53/53`: PASS trên gate tương ứng.
- Các warning sourcemap của MCP SDK trong workerd đến từ package upstream thiếu source file; test/runtime và dry-run vẫn PASS.

## Giới hạn còn chủ ý

- Chưa deploy, chưa ghi secret thật và chưa thay đổi Cloudflare account state.
- Live WAF/rate, bucket lock, event queue/alert và route TLS là Phase 6 release gate.
- Không thêm OAuth server/discovery, Durable Object, session/user state, skill, GoClaw config, media hay mutation tool.
