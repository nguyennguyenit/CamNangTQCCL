# Team chuẩn và Team khác: kế hoạch duyệt theo mùa

Date: 2026-09-12

Đã kiểm tra SGSDeck bằng browser, lưu bằng chứng về bộ chọn mùa, Tier, danh sách, chi tiết và mục người chơi chia sẻ. Chốt [plan mới](../260912-0950-recommended-season-browser/plan.md) với hai tab Team chuẩn và Team khác, giữ giao diện/bộ lọc hiện có, thêm mùa, hiển thị chiến pháp và binh thư trên thẻ.

Theo quyết định mới nhất, Team khác ban đầu lấy các team có sẵn không trùng tướng và chiến pháp với Team chuẩn. Không yêu cầu chiến báo mới cho đợt này; giữ nguồn hiện có và ghi rõ nếu chưa xác định. Các bổ sung bên ngoài sau này cần nguồn research hoặc chiến báo thực tế. Đối chiếu chiến pháp theo từng tướng và giữ riêng biến thể không trùng.

Các phase vẫn pending; toàn bộ dữ liệu mùa và giao diện chưa được triển khai. Giữ nguyên spike đang dở trong worktree và WIP ở main. Bước tiếp theo là thu thập đủ phạm vi nguồn và triển khai bộ đối chiếu theo plan, sau đó UI và kiểm thử.

CLI `ak project list --json` lỗi exit 1; journal được ghi trực tiếp đúng repository để tránh chọn nhầm registry của thư mục cha. AgentWiki publish skipped.

## Rà mức sẵn sàng deep/TDD

Đã lưu brainstorm thống nhất và xóa phác thảo UI cũ theo yêu cầu trực tiếp; sửa link liên quan. Audit dữ liệu, UI và các hợp đồng kiểm thử cho thấy plan chưa đủ deep/TDD. Đã ghi [báo cáo](../260912-0950-recommended-season-browser/reports/audit-deep-tdd.md) và trạng thái readiness trong plan. Cần bổ sung hợp đồng thu thập, mapping danh tính, biến thể, snapshot, điều hướng/query và ma trận test trước cook. 14 test parser hiện có pass; không có Red mới hoặc kiểm thử toàn bộ. Không sửa code hay quyết định sản phẩm.

## Chốt brainstorm và hoàn thiện deep/TDD

Đã cập nhật chính plan hiện có thành ba phase thực thi, giữ tất cả phase pending. Chốt Python HTTP là cách thu thập chính; browser xác minh/fallback có đường nhập cache rõ ràng. Bổ sung ownership và hash bằng chứng mapping, tách số primary/alternative, publication cùng generation, nguồn URL, consumer details và test migration. Ba review độc lập kiểm 30 claims và đưa ra 7 findings; [báo cáo cuối](../260912-0950-recommended-season-browser/reports/plan-validation.md) ghi đầy đủ cách xử lý và giới hạn bằng chứng. Không còn câu hỏi sản phẩm trước Phase 1. Không triển khai crawler/UI, chạy feature E2E, commit hoặc deploy trong lượt hoàn thiện plan; AgentWiki publish skipped.
