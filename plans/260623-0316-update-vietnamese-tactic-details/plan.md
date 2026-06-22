---
title: "Cập nhật tiếng Việt cho 6 chiến pháp"
description: "Đồng bộ tên và mô tả tiếng Việt của 6 chiến pháp theo ảnh trong game."
status: completed
priority: P2
effort: 30m
branch: main
tags: [bugfix, data]
blockedBy: []
blocks: []
created: 2026-06-23
---

# Cập nhật tiếng Việt cho 6 chiến pháp

## Overview

Đồng bộ dữ liệu hiển thị theo 6 ảnh game, giữ nguyên schema và nguồn Hán.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Cập nhật và kiểm thử dữ liệu](./phase-01-update-and-test-tactic-data.md) | Completed |

## Dependencies

- `data/tactics.json` và test dữ liệu Node hiện có.
- Không phụ thuộc plan khác.

## Success Criteria

- 6 chiến pháp có tên/mô tả/mục tiêu tiếng Việt khớp ảnh.
- Tên `Đánh Đâu Thắng Đó` đúng theo xác nhận người dùng.
- Test hẹp và toàn bộ test dự án liên quan đều xanh.
