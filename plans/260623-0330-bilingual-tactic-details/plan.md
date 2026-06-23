---
title: "Hiển thị mô tả chiến pháp song ngữ"
description: "Giữ mô tả tiếng Trung và bổ sung bản dịch tiếng Việt cho các chiến pháp đã cập nhật."
status: completed
priority: P2
effort: 45m
branch: main
tags: [bugfix, frontend, data]
blockedBy: []
blocks: []
created: 2026-06-23
---

# Hiển thị mô tả chiến pháp song ngữ

## Overview

Tách dữ liệu nguồn Trung và bản dịch Việt; thẻ chiến pháp hiển thị cả hai.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Cập nhật schema và UI song ngữ](./phase-01-bilingual-data-and-ui.md) | Completed |

## Dependencies

- Follow-up plan `260623-0316-update-vietnamese-tactic-details` đã hoàn tất.
- Không thêm thư viện hoặc framework.

## Success Criteria

- 6 chiến pháp giữ `effect`/`target` tiếng Trung và có `effectViet`/`targetViet`.
- UI hiện tiếng Việt trước, tiếng Trung sau; record cũ vẫn hiện bình thường.
- Pipeline rebuild bảo toàn field song ngữ; toàn bộ test pass.
