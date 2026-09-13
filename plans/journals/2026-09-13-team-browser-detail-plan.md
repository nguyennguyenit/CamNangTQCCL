---
title: "Lập deep TDD plan cho team browser và detail pages"
summary: "Hoàn thành plan bốn phase, đủ 13 acceptance criteria, xử lý 12 findings từ ba reviewer; chưa triển khai code."
date: 2026-09-13
---

# Team browser/detail planning

## What happened

Theo brainstorm được chỉ định, tạo [plan riêng](../260912-1916-team-browser-detail-pages/plan.md) trong worktree season-team-lookup. Khảo sát source và JSON xác định 1,366 Recommended records, 661 tên đội, 166 originals, 53 originals có counters và tối đa 36 điểm khác nhau mỗi mùa.

Ba reviewer độc lập phát hiện các rủi ro snapshot/ledger lệch, --input bỏ qua validation, thiếu caller migration, Pages SPA fallback, storage boot failure, thứ tự build/test, native-anchor dependency, invalid-config precedence, duplicate notes, badge và counter-search omissions. Parent đã sửa plan; chi tiết ở [review report](../260912-1916-team-browser-detail-pages/reports/plan-review.md).

## Decisions

Dữ liệu → dedicated static pages/native links → compact browser → actual verification. Bảo toàn raw và admission; note ownership chỉ là display projection. Original pages truy cập độc lập Recommended runtime nhưng build phải ràng buộc cùng snapshot. Không thay gameplay/ruleset hoặc tự triển khai/deploy.

`ak plan validate` đạt; `ak plan resolve` chọn CamNangTQCCL/260912-1916 đúng branch/worktree. 15 implementation tasks được hydrate ở trạng thái chờ cook, không hoàn tất giả.

## Storage and next step

Nhật ký ghi trực tiếp tại đường dẫn worktree rõ ràng: journal CLI hiện không có --basedir/--path để khóa đích vào worktree, nên không thực hiện CLI mutation có thể dùng registry root khác. Không sửa checkout main hoặc project registration để viết nhật ký. AgentWiki/social publishing skipped.

Bước tiếp theo thuộc quyền người dùng: gọi ak-cook với plan mới. Chưa chạy implementation tests/build/browser và chưa thay application source/data trong lượt lập plan này.
