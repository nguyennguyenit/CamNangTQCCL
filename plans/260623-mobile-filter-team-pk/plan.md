---
title: Cải thiện mobile filter Team PK
description: >-
  Sửa UX bộ lọc Team PK trên mobile: tách khỏi menu trang, thêm nút
  search/close, giữ desktop sidebar.
status: completed
priority: P2
branch: main
tags:
  - frontend
  - mobile
  - ux
  - tdd
blockedBy: []
blocks: []
created: '2026-06-23T07:05:58.474Z'
createdBy: 'ck:plan'
source: skill
---

# Cải thiện mobile filter Team PK

## Overview

Mobile hiện gây nhầm vì nút `Bộ lọc` nằm chung hàng tab trang như một mục menu, còn drawer lọc không có lối thoát rõ ràng. Plan này gom các trang vào menu toggle mobile, chuyển filter thành hành động riêng của Team PK, thêm tiêu đề drawer + nút đóng + nút xem kết quả, và giữ filter engine/data contract không đổi.

Brainstorm: [brainstorm-mobile-filter-team-pk.md](./reports/brainstorm-mobile-filter-team-pk.md)  
Red-team + audit: [red-team-audit-mobile-filter-team-pk.md](./reports/red-team-audit-mobile-filter-team-pk.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Mobile filter UX](./phase-01-mobile-filter-ux.md) | Completed |
| 2 | [TDD implementation](./phase-02-tdd-implementation.md) | Completed |
| 3 | [Verification review](./phase-03-verification-review.md) | Completed |

## Dependencies

- `index.html`, `css/styles.css`, `js/app.js`: UI shell, mobile drawer, nav.
- `js/filters.js`: giữ nguyên public behavior; không đổi filter state schema.
- `tests-js/`: thêm test DOM hẹp cho drawer nếu chạy được bằng Node.

## Acceptance Criteria

- Mobile nav chỉ chứa các trang; `Bộ lọc` không còn là tab/menu page.
- Các trang trên mobile nằm trong menu toggle riêng, không trộn với filter.
- Team PK mobile có nút mở filter riêng, nhãn rõ, đủ dễ bấm.
- Drawer filter có tiêu đề, nút `Đóng`, nút `Tìm / Xem kết quả`, và search field rõ ràng.
- Bấm `Tìm / Xem kết quả`, `Đóng`, overlay, hoặc phím Escape đều thoát drawer.
- Đổi sang section khác tự đóng drawer và không để filter overlay che trang khác.
- Desktop vẫn là sidebar filter sticky, không thêm overlay/drawer chrome.
- Filter/search hiện có vẫn lọc đúng dữ liệu và không đổi contract `applyFilters`.
- Test hẹp và kiểm tra mobile bằng browser pass.

## Open Questions

None.
