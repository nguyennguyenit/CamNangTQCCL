---
title: Plan tach Team Cham Su trong Khai Hoang
date: 2026-09-07
summary: Lập plan sửa phân loại Chạm Sứ; chưa sửa runtime.
---

# Lập plan tách Team Chạm Sứ

## Context

Người dùng yêu cầu lập plan sau brainstorm. Nguồn CSV và báo cáo nhập ngày 2026-09-06 xác định cột I–K là bảng Chạm Sứ độc lập; parser và renderer cũ vẫn dùng transforms.

## Decision

Plan: plans/260907-0236-cham-su-khai-hoang/plan.md. Tách mục Chạm Sứ/Ăn vạ, đối chiếu nhóm theo nguồn, bảo toàn build curated, thêm fixture hồi quy độc lập file HTML ignored. Chỉ lập kế hoạch, không sửa code/dữ liệu, commit hoặc deploy.

## Next steps

Triển khai theo plan khi người dùng yêu cầu; kiểm tra WIP và các plan đồng thời trước khi sửa.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
