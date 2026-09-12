---
title: Kế hoạch tra cứu thống nhất sáu danh mục
date: 2026-09-12
summary: Chốt plan deep TDD từ brainstorm đã duyệt; giữ nguồn ưu tiên và tương thích.
---

# Kế hoạch tra cứu thống nhất sáu danh mục

## Công việc

Tạo plans/260912-0607-unified-lookup/plan.md và bốn phase cho đối chiếu danh tính, hợp nhất và Việt hóa, giao diện sáu nhóm, tương thích và bàn giao. Hai báo cáo nghiên cứu, ba lượt phản biện và 40 nhận định về code đã được kiểm chứng.

## Quyết định

Giữ tên Việt và ID cũ, ưu tiên giá trị SGSDeck có nội dung sau khi ghép đúng danh tính, giữ nguồn nội bộ. Bổ sung kiểm tra đọc dữ liệu qua CLI/stdio, khóa writer dùng chung, bản ghi khôi phục code và dữ liệu, cùng kiểm tra phụ thuộc ID của plan mùa. Cả 11 vấn đề sau gộp đã được xử lý trong plan và reviewer đọc lại xác nhận.

## Kiểm chứng và bước tiếp

CLI xác nhận plan hợp lệ, bốn phase pending, chưa triển khai tính năng. Baseline 13 Python và 26 Node tests đã pass; đó chưa phải Red/Green của tính năng mới. Nhật ký và reports là lịch sử công việc, plan cùng brainstorm đã chốt là đầu vào cho cook --tdd. Không chỉnh runtime, commit hoặc deploy trong lượt lập plan.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
