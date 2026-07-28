---
date: 2026-07-28
session: "Hoàn tất Phase 2 TQCCL research MCP"
status: completed
authority: historical
agentwiki: skipped
---

# Journal: 2026-07-28 — Hoàn tất Phase 2 TQCCL research MCP

## Context

Phase 2 củng cố lớp domain dùng chung cho browser và MCP: canonical identity, normalization, recommendation, provenance và confirmation binding. Mục tiêu là đóng các lỗi ngữ nghĩa trước khi Phase 3 ghép data loader, CLI và public schemas; journal này chỉ ghi lịch sử, không thay thế plan hay tài liệu kiến trúc.

## What Happened

- Vòng TDD đầu khóa SP/CO/base identity, `familyId` và combined slot dưới dạng lựa chọn thay thế; ambiguity vật chất chuyển sang fail-closed và buộc review.
- Ranking đổi sang tier-first; allocator backtracking giữ toàn bộ alternatives, không cấp trùng hero/tactic, trả tactic theo đúng holder/slot và kèm provenance, conflict, warning, trade-off.
- Canonical projection dùng NFC/JCS và binding ba trường; audit bổ sung digest cho ambiguity, locked semantic order và `tacticAssignments`, đồng thời chặn Unicode không hợp lệ và binding replay.
- Source precedence/correction được siết để giữ evidence gốc, field presence và privacy-safe batch provenance; family, membership, locked-resource và holder conflict đều yêu cầu review.
- Workflow closure chuyển sang TypeScript AST, bắt static import có comment gap, fail-closed với dynamic import và stale-check generated workflow identity trong CI.
- Privacy/bounds được khóa bằng serializer allowlist, loại media/path/secret fields, clamp observations/collection/corpus/search/output và không echo raw instruction-like text.
- Các vòng audit allocator cuối xử lý locked referential integrity và Freeze 6 slot inference: reserve toàn bộ explicit slot trước, gán omission vào slot trống nhỏ nhất theo từng holder, giữ gap hợp lệ và từ chối duplicate explicit slot.
- Freeze 6 kết thúc với JS `70/70`, MCP `84/84`, Node `133/133`, E2E `14/14`, Python `82/82`, Worker `53/53`; code review **APPROVED**, không còn blocker Phase 2.
- AgentWiki publish/share được bỏ qua: không tìm thấy CLI trong PATH hoặc MCP publish/share khả dụng; không cài thêm capability.

## Reflection

Các test characterization giúp thay đổi lớn ở domain vẫn giữ tương thích browser. Giá trị lớn nhất đến từ audit bằng repro cụ thể: nhiều lỗi chỉ lộ khi thay đổi holder nhưng giữ nguyên flat resource set, bỏ trường ambiguity khỏi payload, chèn comment giữa import, hoặc trộn explicit/omitted slot. Freeze theo từng vòng và chỉ chấp nhận khi repro đỏ chuyển xanh giúp tránh kết luận sớm.

Phần tốn công nhất là giữ đồng thời ba bất biến: identity chính xác, allocation khả thi và provenance không làm rò dữ liệu. Việc tách pure services khỏi I/O giữ phạm vi Phase 2 rõ ràng và tạo biên tích hợp kiểm chứng được cho Phase 3.

## Decisions

| Quyết định | Lý do | Tác động |
|---|---|---|
| Canonical ID tách SP/CO/base; `familyId` chỉ để so sánh | Tránh hợp nhất sai ownership | Similarity, normalization và allocation dùng cùng identity authority |
| Ambiguity/conflict vật chất fail-closed | Không suy đoán đội hình từ dữ liệu chưa xác nhận | Recommendation chỉ chạy với canonical state và binding hợp lệ |
| Tier đứng trước red-copy; resource cấp theo slot/holder | Giữ đúng ưu tiên meta và tính khả thi | Portfolio deterministic, không trùng hero/tactic |
| Digest bind projection ngữ nghĩa và workflow closure | Chặn replay khi state hoặc semantic engine đổi | Mọi thay đổi vật chất buộc normalize/review/confirm lại |
| Raw evidence là untrusted, bounded và privacy-safe | Giảm prompt injection, rò media/path/secret và tăng trưởng không kiểm soát | Browser/MCP chỉ nhận dữ liệu có allowlist và caps |
| Phase 3 sở hữu trusted workflow composition | `releaseId` thuộc runtime/data layer, chưa tồn tại trong pure Phase 2 | Phase 2 không nhận công triển khai composition từ server state |

## Next

- Phase 3 phải compose `workflowVersion` từ trusted server `releaseId + WORKFLOW_BUILD_ID`, không nhận một cặp tự nhất quán từ request.
- Phase 3 phải áp cùng limits tại public runtime schemas và chứng minh parity qua CLI/transport.
- Tái sử dụng pure normalization/recommendation services; không viết lại canonical projection, source precedence, ranking, allocation hay binding verification.

## Câu hỏi chưa giải quyết

- Không có blocker Phase 2. Trusted workflow composition và public-boundary schema enforcement là gate của Phase 3, chưa được triển khai.
