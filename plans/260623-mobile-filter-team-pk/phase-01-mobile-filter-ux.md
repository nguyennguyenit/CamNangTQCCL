---
phase: 1
title: Mobile filter UX
status: completed
priority: P1
effort: 30m
dependencies: []
---

# Phase 1: Mobile filter UX

## Overview

Định nghĩa UX mobile cho bộ lọc Team PK dựa trên cấu trúc hiện tại, không thay đổi dữ liệu hay filter engine.

## Requirements

- Functional: mobile pages nằm trong menu toggle; mobile filter opener phải là action riêng, không là `.nav-tab`; drawer có close/search/apply affordance.
- Non-functional: giữ style dashboard tĩnh, text tiếng Việt ngắn, không thêm framework.

## Architecture

- `index.html`: tách `filter-toggle` khỏi `<nav>` thành action gần disclaimer/layout hoặc toolbar Team PK.
- `index.html`: bọc page tabs trong menu toggle mobile.
- `filter-panel`: thêm header drawer và footer action dùng cùng aside desktop.
- `css/styles.css`: desktop ẩn drawer chrome; mobile dùng overlay + side sheet.
- `js/app.js`: quản lý open/close, Escape, overlay click, auto-close khi switch section.

## Related Code Files

- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `js/app.js`

## Implementation Steps

1. Chọn layout: mobile action row dưới disclaimer, chỉ hiện ở Team PK.
2. Thêm filter overlay, drawer header, close button, result/apply button.
3. Đảm bảo section nav chỉ còn các trang.
4. Giữ desktop sidebar như cũ, không hiển thị drawer header/footer.
5. Trên mobile, gom page tabs vào menu toggle và giữ filter action bên ngoài menu.

## Success Criteria

- [x] User hiểu `Bộ lọc` là action, không phải trang.
- [x] Các trang nằm trong menu toggle mobile riêng.
- [x] User có ít nhất 3 đường thoát drawer: Đóng, Tìm / Xem kết quả, overlay/Escape.
- [x] Không section nào ngoài Team PK bị overlay filter che.

## Risk Assessment

- Sticky header/nav có thể overlap drawer: kiểm bằng mobile screenshot.
- Display inline style cũ có thể mâu thuẫn CSS class: thay bằng class state.
