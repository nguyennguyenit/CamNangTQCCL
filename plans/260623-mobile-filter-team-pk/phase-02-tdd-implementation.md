---
phase: 2
title: TDD implementation
status: completed
priority: P1
effort: 45m
dependencies:
  - 1
---

# Phase 2: TDD implementation

## Overview

Implement bằng TDD cho behavior drawer hẹp, rồi chỉnh markup/CSS/JS tối thiểu.

## Requirements

- Functional: page menu state và drawer state có thể mở/đóng qua controls; drawer auto-close khi chuyển section.
- Non-functional: test chạy bằng Node test, không cần bundler hay browser framework nếu có thể.

## Architecture

- Tách helper nhỏ sang `js/mobile-filter-drawer.js` để test DOM behavior mà không import `app.js` side effect.
- Tách helper nhỏ sang `js/mobile-section-menu.js` để test page toggle behavior.
- Test dựng DOM tối thiểu bằng `node:test` + fake element nhẹ; không thêm dependency.

## Related Code Files

- Create/Modify: `tests-js/mobile-filter-drawer.test.mjs`
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `js/app.js`
- Create: `js/mobile-filter-drawer.js`
- Create: `js/mobile-section-menu.js`

## Implementation Steps

1. Viết test fail cho: drawer open, close button, apply button, Escape, switch section close; page menu open/close/label.
2. Chạy test hẹp để xác nhận fail đúng lý do.
3. Implement DOM hooks và CSS.
4. Chạy test hẹp đến xanh.

## Success Criteria

- [x] Red test fail trước code production.
- [x] Green test pass sau implementation.
- [x] Existing `filters.test.mjs` vẫn pass.
- [x] Page menu test pass.

## Risk Assessment

- `js/app.js` hiện có side effect `main()` khi import; nếu gây khó test, tách helper nhỏ sang module mới chỉ cho drawer behavior.
