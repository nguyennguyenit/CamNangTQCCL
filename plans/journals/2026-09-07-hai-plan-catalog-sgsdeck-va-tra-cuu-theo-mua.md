---
title: Hai plan catalog SGSDeck và tra cứu theo mùa
date: 2026-09-07
summary: Tách nhập catalog nguồn khỏi tra cứu cấu hình theo kịch bản; hiện chỉ lập kế hoạch.
---

# Hai plan catalog SGSDeck và tra cứu theo mùa

## Kết quả

Tạo hai kế hoạch pending: `plans/260907-0228-sgsdeck-catalog/plan.md` và `plans/260907-0233-season-team-lookup/plan.md`. Cả hai qua `ak plan validate`; kiểm tra liên kết và whitespace đạt. Chưa nhập dữ liệu hoặc sửa runtime.

## Quyết định đề xuất

Catalog sở hữu sáu nhóm dữ liệu nguồn và identity mapping. Tra cứu mùa sở hữu scenario/ruleset, cấu hình, đánh giá và UI/MCP. Chia sẻ provenance/sourceSeason nhưng không đồng nhất mùa nguồn với mùa Việt Nam. Có thể phân loại đội hiện có mà không chờ toàn bộ catalog.

## Bàn giao

Khi triển khai, xác minh quyền dùng dữ liệu bulk và bằng chứng áp dụng VN; giữ unknown khi chưa đủ nguồn. MCP v2 cần migration output schema cho strict clients; không mở thêm search domain Khai hoang. Giữ thay đổi Chạm Sứ của phiên khác. AgentWiki publish skipped; chỉ lưu local.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
