# Handoff Research MCP cho consumer GoClaw

## Mục đích và ranh giới sở hữu

Tài liệu này giúp đội sở hữu GoClaw trong tương lai xây một skill dùng Research MCP của TQCCL. Đây là hợp đồng handoff, không phải runbook cài đặt hay cấu hình GoClaw.

Repository này sở hữu MCP read-only: transport, xác thực, catalog, schema, lỗi, version dữ liệu và quy trình release. Đội GoClaw tương lai sở hữu toàn bộ skill, prompt, `read_image`, chuyển ảnh thành dữ liệu có cấu trúc, UX xác nhận, đăng ký MCP, credential, grant, retry, channel, lưu giữ media và rollout/rollback phía consumer.

Không thêm skill hoặc cấu hình GoClaw vào repository này. MCP phải build, test, deploy và rollback độc lập khi GoClaw không tồn tại hoặc bị gỡ bỏ.

## Kết nối và xác thực

- Local development có stdio; consumer remote dùng Streamable HTTP tại route `/mcp`.
- Remote yêu cầu managed-client pre-shared bearer trong header `Authorization` trên mọi method.
- Cơ chế này không phải MCP OAuth: MCP không cung cấp authorization server, discovery, grant hay protected-resource metadata.
- Trước khi tích hợp, đội consumer phải kiểm chứng phiên bản GoClaw thực tế có thể gắn custom header vào mọi request và reconnect. Nếu không, đội đó phải sở hữu một OAuth gateway riêng; không nới lỏng xác thực MCP.
- Không ghi endpoint thật, bearer, tenant ID hoặc credential vào skill, prompt, log hay tài liệu commit.

Transport và thứ tự guard hiện hành thuộc [`worker.ts`](../mcp-worker/src/worker.ts), [`request-guards.ts`](../mcp-worker/src/security/request-guards.ts) và các [transport contract tests](../mcp-worker/test/transport/worker.integration.test.ts).

## Catalog công cụ

MCP xuất đúng bảy tên đã có prefix (bề mặt P*; tám tên cũ đã bị xoá, không alias). Trạng thái: **chưa deploy**; Dewee R0–R2 **chưa chạy**.

| Công cụ | Vai trò trong consumer flow |
|---|---|
| `tqccl_get_playbook` | Lấy `workflowVersion`, `knowledgeVersion`, capability, mùa nguồn, luật bắt buộc và tool kế tiếp trước một luồng mới. |
| `tqccl_search` | Tìm entity (tướng, chiến pháp, trang bị, quân sư, cải tạo, công trình, binh thư, đội), có phân trang và `pagePath` vi/zh. |
| `tqccl_get_entity` | Hồ sơ entity như trang Tra cứu; phần dài phân trang bằng `section`/cursor. |
| `tqccl_find_teams` | Duyệt/đối chiếu đội tham khảo theo `collection`. |
| `tqccl_get_team` | Đọc một đội theo selector `reference`. |
| `tqccl_normalize_entities` | Chuẩn hóa các quan sát có thứ tự thành canonical state để rà soát. |
| `tqccl_recommend_teams` | Ghép đội từ kho đã được người dùng xác nhận (`basis:"source-reference-fit"`, `rulesetVerified:false`). |

`tqccl_search_rules` chỉ là lõi knowledge + lệnh CLI, không đăng ký thành MCP tool.

Không tự thêm prefix lần hai. Đội GoClaw phải kiểm tra quy tắc đặt tên và collision của đúng phiên bản sẽ triển khai, rồi grant tối thiểu theo các tên MCP thực sự discovery được.

Catalog, schema input/output và annotation có nguồn thực thi tại [`research-contracts.ts`](../mcp-worker/src/research/research-contracts.ts) và [`tool-definitions.ts`](../mcp-worker/src/mcp/tool-definitions.ts). Không sao chép schema từ tài liệu này vào skill. Catalog/reference/recommend cần snapshot manifest v3; trên v1/v2 chúng trả `CAPABILITY_UNAVAILABLE` (không bao giờ là mảng rỗng). Giới hạn kết quả `TQCCL_MCP_MAX_RESULT_BYTES` là 131072 (128 KiB; trước đó 96 KiB) vì `tools/list` vượt trần cũ.

## Luồng consumer khuyến nghị

1. Gọi `tqccl_get_playbook` và giữ nguyên `workflowVersion` trả về cho toàn bộ lượt làm việc.
2. Xử lý ảnh hoàn toàn bên ngoài MCP. `read_image` hoặc vision provider phải chuyển từng ảnh thành các structured observation có thứ tự và evidence phù hợp với schema nguồn.
3. Gọi `tqccl_normalize_entities`.
4. Hiển thị canonical state, cảnh báo, xung đột, mục chưa phân giải và cờ `reviewRequired` để người dùng rà soát. Không coi việc MCP trả dữ liệu là bằng chứng người dùng đã xác nhận.
5. Consumer tự thu nhận và ghi nhận hành động xác nhận của người dùng. Giữ nguyên `canonicalState`, `confirmationBinding` và `workflowVersion` do kết quả normalize trả về; không tự tái tạo binding.
6. Dùng `tqccl_search`, `tqccl_get_entity`, `tqccl_find_teams` hoặc `tqccl_get_team` khi cần tra cứu và đối chiếu, luôn truyền workflow version theo schema.
7. Chỉ gọi `tqccl_recommend_teams` sau xác nhận, với đúng canonical state và binding tương ứng.
8. Khi nhận `WORKFLOW_VERSION_CHANGED`, bắt đầu lại từ bước 1. Khi nhận `CONFIRMATION_REQUIRED`, quay lại normalize/rà soát/xác nhận; không tự động xác nhận lại và không đưa ra đội hình suy đoán.

`ConfirmationBinding` gắn đúng workflow với normalization digest và phiên bản canonical projection. Schema authoritative nằm tại `confirmationBindingSchema` trong [`research-contracts.ts`](../mcp-worker/src/research/research-contracts.ts); logic xác minh nằm tại [`canonical-state.ts`](../mcp-worker/src/domain/canonical-state.ts).

## Media, riêng tư và dữ liệu không tin cậy

MCP không nhận ảnh, base64, URL ảnh, file path, media ID, channel credential, user credential hoặc provider secret. Consumer chỉ gửi structured observation đã được giới hạn bởi schema.

Mọi observation, source label, provenance text và corpus field trong `structuredContent` vẫn là dữ liệu không tin cậy. Skill không được nối các giá trị đó vào system/developer prompt, biến chúng thành chỉ dẫn, hoặc thực thi nội dung giống câu lệnh. Khi cần nội dung đọc cho người, chỉ dùng phần text fallback cố định do MCP trả; không tự dựng fallback bằng raw/source field.

Consumer phải tự quyết định chính sách crop ảnh, quyền truy cập, retention, xóa media, log và phân tách tenant. Những chính sách đó không được suy ra từ MCP.

## Lỗi, phân trang và retry

- Lỗi typed và thuộc tính `retryable` do [`ResearchHandlerError`](../mcp-worker/src/research/research-handlers.ts) sở hữu. Không retry chỉ dựa trên HTTP status hoặc message text.
- `DATA_UNAVAILABLE` chỉ được retry có giới hạn khi kết quả protocol đánh dấu retryable. Recommendation phải fail closed trong thời gian MCP không khả dụng.
- `WORKFLOW_VERSION_CHANGED` và `CONFIRMATION_REQUIRED` là tín hiệu khởi động lại workflow như mô tả trên, không phải lỗi để retry nguyên payload.
- Các tool đọc có cursor (`tqccl_search`, `tqccl_get_entity`, `tqccl_find_teams`, `tqccl_get_team`) phân trang khi `nextCursor` hiện diện: gọi trang kế tiếp bằng cùng truy vấn và workflow, không sửa, giải mã hoặc dùng lại cursor cho truy vấn khác. `CURSOR_INVALID` yêu cầu bắt đầu lại. Với kết quả không phân trang, `truncated: true` nghĩa là không đầy đủ; không giả định có trang tiếp theo.
- Luôn giữ `releaseId`, `workflowVersion`, `provenance`, `warnings` và trạng thái truncation cùng kết quả hiển thị hoặc quyết định. `dataVersion` chỉ để hiển thị, không thay cho workflow identity.
- Thiết lập timeout, backoff, reconnect và deduplication thuộc consumer. Không retry mù recommendation và không biến timeout thành kết quả tự suy diễn.

Formatter non-echo và mapping lỗi MCP được kiểm chứng tại [registry contract tests](../mcp-worker/test/mcp/registry.contract.test.ts); parity của cả bảy công cụ nằm tại [all-tools transport parity tests](../mcp-worker/test/transport/all-tools-parity.test.ts).

## Cutover, discovery và rollback

- **Đổi catalog = đổi consumer.** Tám tên của bề mặt cũ (danh sách trong changelog) không còn; không có alias. Sau mỗi release đổi catalog, consumer phải reconnect và refresh `tools/list` (Dewee: reconnect server, xem [dewee#887](https://github.com/nextlevelbuilder/dewee/issues/887)), rồi cập nhật grant/service key theo tên mới.
- **Release 1 / Release 2** là lịch deploy (6 tên đọc + playbook, rồi `tqccl_recommend_teams`), thuộc quy trình deploy trong [kế hoạch](../plans/260927-1727-mcp-skill-redesign/design.md), không phải hợp đồng runtime. Hiện **chưa deploy** và **Dewee R0–R2 chưa chạy**; không coi bảy tool là đã live.
- **CLI fallback** (cùng handler, không qua MCP): `playbook`, `search`, `entity`, `find-teams`, `team`, `normalize`, `recommend`, và `search-rules` (chỉ CLI). Bảng alias nằm ở [`cli.ts`](../mcp-worker/src/cli.ts) (`CLI_ALIASES`).
- **Rollback:** deploy exact Worker version trước đó (code và data quay lại cùng lúc); consumer reconnect/refresh discovery lại về tên cũ. Chi tiết trong [Research MCP server](mcp-research-server.md).
- **Sở hữu:** repository này sở hữu MCP, knowledge dataset (`agent-knowledge/`) và skill repo trong `.agents/skills/`; skill/prompt/grant/rollout phía GoClaw/Dewee vẫn thuộc consumer.

## Checklist cho đội GoClaw tương lai

Tất cả mục dưới đây nằm ngoài repository TQCCL này:

- [ ] Chọn và pin phiên bản GoClaw/Dewee sẽ triển khai; kiểm chứng Streamable HTTP, JSON response, custom `Authorization` header và reconnect bằng runtime thật.
- [ ] Tạo skill portable và prompt orchestration; không dùng path máy phát triển.
- [ ] Cấu hình `read_image` hoặc vision provider để tạo structured observation, không chuyển media sang MCP.
- [ ] Xây UX review/xác nhận và lưu bằng chứng người dùng ở phía consumer.
- [ ] Đăng ký endpoint/credential trong secret store được quản lý; grant đúng agent/tenant và đúng bảy tool cần dùng.
- [ ] Kiểm tra prefix/collision trên phiên bản thực tế; tránh biến tên thành `tqccl_tqccl_*`.
- [ ] Thiết kế timeout, retry, reconnect, idempotency, logging/redaction, channel và media retention.
- [ ] Kiểm thử end-to-end với dữ liệu mơ hồ, workflow đổi, confirmation cũ, MCP outage, prompt injection trong ảnh/source field và credential rotation.
- [ ] Rollout và rollback skill/consumer độc lập với release MCP.

Không dùng tài liệu nghiên cứu lịch sử làm cấu hình trực tiếp. Khi code và tài liệu khác nhau, tool discovery, schema runtime và contract tests được liên kết ở trên là nguồn kiểm chứng hiện hành.
