---
date: 2026-07-28
session: phase-04-mcp-transports
---

# Nhật ký: 2026-07-28 — Phase 4 MCP transports

## Bối cảnh

Phase 4 đưa tám research handler Phase 3 ra stdio và authenticated Streamable HTTP mà không tạo schema/dispatch thứ hai. Boundary remote phải stateless, bearer-protected trước body/R2 và giữ Vision Worker độc lập.

## Diễn tiến

1. **Dependency gate:** kiểm package hiện hành và loại `agents` stable khỏi graph vì không phù hợp Node `22.16.0`/SDK v1 đã chấp nhận. Chốt SDK `1.30.0`, raw Web-standard adapter, Wrangler `4.114.0` và Workers Vitest `0.18.8`; audit sạch.
2. **Registry TDD:** test đỏ khóa tám tên, schema-object identity, annotation read-only, fresh factory, official client call và non-echo fallback. Registry/formatter/factory sau đó GREEN.
3. **Stdio TDD:** official client spawn process thật, initialize/list/call và shutdown. Entrypoint filesystem giữ stdout protocol-only, diagnostic cố định ở stderr.
4. **Security TDD:** thêm strict base64url bearer tối thiểu 256 bit, dual-token overlap tối đa 15 phút, constant-work digest comparison, truncated fingerprint, Origin/media/encoding/declared/actual byte guards, token rate và in-flight ceiling.
5. **HTTP TDD:** raw SDK v1 transport chạy stateless JSON, auth mọi method trước body, fresh server/transport theo POST, body/result bounds, protocol matrix và explicit custom-header managed clients. GET/DELETE đã xác thực trả `405`.
6. **Workerd/R2:** seed hai R2 binding bằng fixture và corpus production; test liveness, tool call và budget trong workerd. Wrangler dry-run xác nhận Worker graph deploy được không có Node import.
7. **Operational artifacts:** generator đưa bearer trực tiếp vào stdin của `wrangler secret put`; control-plane artifact/verifier chỉ dùng GET để kiểm edge rate, bucket lock và event notification queues.
8. **Parity/regression:** tám success case deep-equal direct handler qua stdio/HTTP; tám validation error tương đương và không echo payload. CLI all-eight parity đã có từ Phase 3. Toàn bộ gate chạy lại trên Node pin.
9. **Đóng review bằng TDD:** reviewer nêu hai lỗi High. Protocol `initialize` trước đó để SDK tự negotiate nên scalar cũ/không biết có thể được nâng lên phiên bản đã chọn; guard mới yêu cầu chính xác `2025-11-25`. Verifier control plane có thể nhận nhầm expression chỉ khớp substring như `ne "/mcp"` và ghép actions từ nhiều queue; bản sửa so sánh expression chính xác và buộc đủ actions trong cùng một queue prefix `tqccl-`. Lượt cuối phát hiện guard scalar còn bị bypass qua JSON-RPC batch; test đỏ khóa trường hợp này trước khi sửa guard duyệt mọi message `initialize`. Reviewer cuối **PASS**.

## Bằng chứng kết thúc

- Node: `165/165` PASS.
- Workerd: `2/2` PASS.
- Tổng gate Phase 4: `167/167` PASS.

## Quyết định

| Quyết định | Lý do | Tác động |
|---|---|---|
| Dùng raw Web-standard MCP SDK v1 | Giữ Node pin và tránh tự nâng qua v2 beta/Agents engine boundary | Chỉ transport adapter thay đổi; registry/handler giữ nguyên |
| Chọn protocol `2025-11-25` | Phiên bản ổn định mới nhất trong SDK v1 pin | Missing header fallback và older `2025-06-18` được test; unsupported trả `400` |
| Managed bearer, không OAuth | Đúng scope managed-client đã duyệt | Client phải gắn custom header; OAuth gateway là scope khác |
| Chọn Workers Paid | Cold/recommendation proxy vượt budget Free `10ms` | Không hạ bounds, validation hoặc correctness |
| Chỉ cache snapshot đã validate | Tránh state/session/user leakage | Server và transport không module-global |
| Validate protocol trước SDK trên toàn bộ batch | Không giao fail-closed policy cho auto-negotiation của SDK | Scalar và batch đều từ chối `initialize` sai trước data source |
| Đối chiếu control plane theo cùng một resource | Tránh bằng chứng tổng hợp từ expression/action không liên quan | Verifier chỉ PASS khi exact expression và đủ actions cùng thuộc queue dự kiến |

## Bài học

- Guard ở biên phải kiểm cấu trúc đầy đủ của wire format; test scalar không chứng minh được batch an toàn.
- Verifier vận hành phải chứng minh quan hệ giữa các trường trong cùng một resource, không chỉ sự hiện diện rời rạc của từng chuỗi.
- Review có giá trị nhất khi finding được chuyển thành test đỏ tối thiểu rồi mới sửa; chuỗi này đã bắt thêm batch bypass sau hai High ban đầu.

## Câu hỏi chưa giải quyết

Không có blocker code Phase 4. Live control-plane state và deployment evidence thuộc Phase 6; không được suy ra từ local artifact/dry-run.
