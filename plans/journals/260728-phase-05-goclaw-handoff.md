---
date: 2026-07-28
session: phase-05-goclaw-handoff
---

# Nhật ký: 2026-07-28 — Phase 5 GoClaw handoff

## Bối cảnh

Phase 5 xuất bản đúng một guide Markdown không thực thi: [handoff Research MCP cho consumer GoClaw](../../docs/goclaw-mcp-skill-handoff.md). Repository TQCCL chỉ sở hữu endpoint, xác thực, catalog, schema, lỗi, versioning và release/rollback của MCP read-only. Đội GoClaw tương lai sở hữu skill, prompt/orchestration, `read_image`, chuyển ảnh thành observation, UX xác nhận, đăng ký MCP, credential/grant, retry/reconnect, channel, media retention và rollout/rollback.

Journal này chỉ ghi lịch sử thực hiện. Guide và các source/contract test được guide liên kết mới là nơi kiểm chứng hiện hành; journal không thay thế tài liệu hay hợp đồng runtime đó.

## Diễn tiến

1. **TDD scope gate:** kiểm tra khi file handoff còn thiếu cho kết quả RED, khóa yêu cầu chỉ tạo `docs/goclaw-mcp-skill-handoff.md`; không thêm skill, cấu hình GoClaw/Dewee, fixture, package hoặc staging artifact.
2. **Contract-first guide:** catalog tám tên `tqccl_*` được đối chiếu với [`research-contracts.ts`](../../mcp-worker/src/research/research-contracts.ts), [`tool-definitions.ts`](../../mcp-worker/src/mcp/tool-definitions.ts), [registry contract test](../../mcp-worker/test/mcp/registry.contract.test.ts) và [all-tools transport parity test](../../mcp-worker/test/transport/all-tools-parity.test.ts). Guide liên kết source thay vì sao chép schema có thể drift.
3. **Consumer flow:** chốt chuỗi observation có thứ tự từ vision bên ngoài MCP → `tqccl_normalize_entities` → hiển thị canonical state/conflict/review → consumer thu nhận xác nhận người dùng → gửi nguyên `canonicalState`, `confirmationBinding` và `workflowVersion` vào recommendation. `WORKFLOW_VERSION_CHANGED` hoặc `CONFIRMATION_REQUIRED` buộc quay lại đúng điểm review, không tự xác nhận hay suy diễn kết quả.
4. **Interoperability boundary:** remote `/mcp` dùng managed-client pre-shared bearer trong `Authorization`, không triển khai MCP OAuth. Consumer tương lai phải chứng minh runtime thực tế gắn được custom header cho mọi request/reconnect; nếu không, chính consumer sở hữu OAuth gateway riêng, không nới xác thực MCP.
5. **Media và trust boundary:** ảnh, base64, URL/path/media ID, channel/user credential và provider secret không đi vào MCP. Observation, source label, provenance text và corpus field vẫn là dữ liệu không tin cậy dù nằm trong `structuredContent`; không nối chúng vào system/developer prompt hay thực thi như chỉ dẫn. Human-readable fallback chỉ dùng fixed-template text do MCP trả.
6. **Validation GREEN:** guide chứa đủ `8/8` tên tool và `10/10` relative link đều resolve. Trên Node `22.16.0`, hai file test tập trung `mcp-worker/test/mcp/registry.contract.test.ts` và `mcp-worker/test/transport/all-tools-parity.test.ts` đạt `7/7` test.
7. **Review correction:** reviewer nêu một finding Medium: bản đầu đã phổ quát hóa cursor từ mọi `truncated: true`, trong khi chỉ `tqccl_search` tạo cursor; `get_team`, recommendation và coexist có thể truncated mà không có trang kế. Guide được sửa để chỉ phân trang search khi có `nextCursor`; với tool không pageable, `truncated: true` chỉ báo kết quả không đầy đủ và không cho phép giả định trang sau. Targeted re-review cuối **PASS**.

## Quyết định

| Quyết định | Lý do | Tác động |
|---|---|---|
| Chỉ phát hành một guide không thực thi | Giữ ranh giới MCP/consumer và khả năng release độc lập | Không có GoClaw skill/config/runtime mutation trong repository |
| Hợp đồng được dẫn về source và test | Tránh tài liệu chép lại schema rồi drift | Tool discovery, runtime schema và contract tests giữ vai trò kiểm chứng |
| Xác nhận thuộc consumer, binding thuộc MCP | MCP không thể chứng minh hành động con người | Chỉ canonical state đã review và binding nguyên vẹn mới đi vào recommendation |
| Managed bearer không được gọi là OAuth | MCP hiện không có discovery, grant hay authorization server | Custom-header support phải được kiểm chứng ngoài repo |
| Raw media ở ngoài MCP; structured fields vẫn untrusted | Giảm phạm vi dữ liệu nhạy cảm nhưng không xóa rủi ro prompt injection | Consumer phải sở hữu privacy/retention và không prompt-concatenate dữ liệu nguồn |
| Cursor chỉ áp dụng cho search | Phù hợp contract thực thi hiện tại | `truncated` ở tool khác không được biến thành pagination giả |

## Bài học

- Một handoff tốt cần khóa cả ownership lẫn thứ tự workflow; tên tool đúng nhưng xác nhận sai chỗ vẫn có thể phá fail-closed contract.
- `truncated` là tín hiệu độ đầy đủ, không phải bằng chứng chung rằng API hỗ trợ cursor. Review theo từng tool đã ngăn guide tạo ra consumer behavior không tồn tại.
- RED cho missing artifact hữu ích để chứng minh delivery scope; GREEN phải tiếp tục dựa trên source-linked contracts thay vì prose tự xác nhận.

## Bước tiếp theo

Phase 6 vẫn còn: xác minh live control plane, deployment, release evidence và vận hành MCP. Phase 6 phụ thuộc trực tiếp Phase 4, không phụ thuộc guide advisory này; việc xây GoClaw skill cần một kế hoạch do đội consumer sở hữu.

## Câu hỏi chưa giải quyết

Không có blocker mở cho Phase 5. Production readiness chỉ được kết luận sau khi các release gate Phase 6 có bằng chứng.
