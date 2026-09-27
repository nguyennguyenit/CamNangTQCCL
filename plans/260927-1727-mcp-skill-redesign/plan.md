# Thiết kế lại MCP và skill theo repo hiện tại

Ngày: 2026-09-27 · Trạng thái: **thiết kế mở rộng và prototype hoàn tất; chưa triển khai runtime**.
Mốc khảo sát: working tree hiện tại trên `main`, gồm thay đổi chưa commit.

## Kết quả cần đạt

Agent đọc được cùng catalog, đội chuẩn, đội khác, Khai hoang và ngôn ngữ mà website công bố; gợi ý đội vẫn dựa trên engine và phạm vi đã xác minh. Skill và MCP hỗ trợ hai chiều qua workflow cards và searchable rules. Các skill bàn giao chung scope/evidence/budget; feedback vào vòng học dùng chung có kiểm chứng và rollback.

## Ràng buộc và ngoài phạm vi

- Giữ tám tool cũ và hành vi legacy; thêm bốn tool dữ liệu và hai tool playbook/rules, tổng 14.
- Build team chọn mùa trước: user/session/profile đã xác nhận, nếu chưa có thì latest trong policy; mặc định ban đầu Binh Diễn Xuân Thu theo user.
- Giữ phân biệt source season, scenario/ruleset, locale và server/region.
- Chỉ dùng projection công khai đã xác minh; không mở private SGSDeck, tài khoản, cookie, ảnh hoặc credential.
- Không đổi SDK/protocol, thuật toán xếp đội, policy bằng chứng, hạn mức research hay quyền GoClaw trong đợt này.
- Community/blog được khảo sát và có ranh giới tích hợp; chưa đưa dữ liệu động hoặc thao tác quản trị vào MCP game.
- Rule lớn ở dataset và search core; Markdown giữ entrypoint. Prototype chỉ ở thư mục kế hoạch.
- Learning phân biệt personal preference, input correction, rule gap và tool/data bug; chưa bật collector/auto-promote/global memory.
- Bản thiết kế không sửa runtime, skill đang dùng, dữ liệu game, Git hay deployment.

## Tài liệu và thứ tự

| Bước | Tài liệu | Trạng thái | Phụ thuộc |
|---|---|---|---|
| Khảo sát | [Bằng chứng hiện trạng](reports/repo-scan.md) | Đã làm | working tree |
| Thiết kế | [Kiến trúc và hợp đồng](design.md) | Đã làm | khảo sát |
| Thiết kế mở rộng | [Skill–MCP, dataset và learning loop](skill-mcp-learning-design.md) | Đã làm | yêu cầu bổ sung + upstream source |
| Mùa mặc định | [Season resolution và rollover](season-resolution-design.md) | Đã thiết kế | quyết định user 2026-09-27 |
| Consumer và auth | [Dewee và cấp quyền từng user](dewee-access-design.md) | Đề xuất, đã đối chiếu source gốc | commit Dewee đã pin; runtime chưa smoke |
| 1 | [Snapshot và MCP](phase-01-mcp-publication.md) | Chưa làm | chốt baseline WIP |
| 2 | [Knowledge, skill và kiểm chứng hành vi](phase-02-skills.md) | Chưa làm | tool discovery mới |
| 3 | [Learning từ feedback](phase-03-learning.md) | Chưa làm | 2 + host identity |
| 4 | [Tích hợp và chuyển đổi](phase-04-integration.md) | Chưa làm | 1 + 2 + 3 |

## Nghiệm thu triển khai

1. Bốn tool mới đọc sáu nhóm lookup và ba họ đội; kết quả có ID, version, nguồn, scope và link đúng ngôn ngữ.
2. CLI/stdio/HTTP trả kết quả tương đương; tám tool cũ giữ hợp đồng đã cam kết.
3. Không dùng source season để tạo ruleset, không chuyển điểm nguồn sang đội thay thế, không ngầm dùng legacy khi scope sai.
4. Snapshot sai hash, mixed generation, private fields, cursor cũ và response quá giới hạn đều bị xử lý có kiểm thử.
5. Ba skill nghiệp vụ và một skill bảo trì có routing/consumer traces thật; handoff giữ scope và budget.
6. Không gọi trạng thái local là production; release và consumer rollout có evidence riêng.
7. Required rules không phụ thuộc top-k; retrieval có no-match và knowledge version.
8. Feedback dedup/subject isolation, candidate eval, scoped promotion và rollback được kiểm chứng. Mỗi feedback có outcome; không bắt mọi feedback sinh rule.

9. Latest đổi qua dataset, không sửa skill; user pinned mùa cũ vẫn được giữ, assumption không thành confirmed fact và thiếu ruleset không fallback legacy.

## Kết quả kiểm tra lúc thiết kế

67 test MCP đạt; CLI `version` đọc được snapshot v2. Node shell là 24.14.0, thấp hơn yêu cầu 24.20.0 của repo. Chưa chạy full release gate hay authenticated tool smoke. Probe remote sau khảo sát: healthz 200, MCP không token 401. Chi tiết trong báo cáo khảo sát.

Prototype dataset có 14 rules; 10 deterministic retrieval tests đạt. Chưa là consumer A/B hoặc learning-loop implementation. Xem [thiết kế và giới hạn](skill-mcp-learning-design.md).
