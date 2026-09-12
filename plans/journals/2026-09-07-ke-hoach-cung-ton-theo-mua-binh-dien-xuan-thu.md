---
title: Ke hoach Cung Ton theo mua Binh Dien Xuan Thu
date: 2026-09-07
summary: "Mo rong plan mua theo deep TDD, giu legacy va shared selector; chua implementation."
---

# Kế hoạch Cùng Tồn theo mùa

## Context

User xác nhận sheet Cùng Tồn thuộc Binh Diễn Xuân Thu, muốn dùng bộ chọn mùa chung, yêu cầu --deep --tdd.

## What happened

Mở rộng plans/260907-0233-season-team-lookup/plan.md và 4 phase, cập nhật quan hệ catalog. Lưu snapshot nguồn có checksum, 2 báo cáo research, 3 review và validation. Sửa 1 High về projection MCP theo node budget và 1 Medium về mandatory conditions chưa đủ để dùng đội ngay, ở mức kế hoạch.

## Decisions

Giữ legacy coexist.json; source-owned reference nằm trong season-content-links đã dự kiến. Scenario-only browse là đề xuất có nhãn chưa xác minh luật, không giả user approval. Gameplay/MCP cần pair reviewed; không chấm source text. Giữ TDD và toàn bộ scope plan mùa trước.

## Validation

40 owner paths có thật; links không thiếu; snapshot SHA-256 khớp; CLI plan validate đạt. Legacy TestCoexist: 1 pass từ researcher. Không code/build/feature tests/deploy. Active plan pinned, index rebuilt; hook active-plan script không tồn tại. Chỉ sửa tài liệu planning và snapshot nghiên cứu.

## Next

User review plan và chọn cook --tdd khi muốn triển khai. Kiểm lại WIP/plans đồng thời trước sửa runtime; plan Khai hoang team details mới xuất hiện còn scaffold nên chưa có đủ bằng chứng để gán dependency.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
