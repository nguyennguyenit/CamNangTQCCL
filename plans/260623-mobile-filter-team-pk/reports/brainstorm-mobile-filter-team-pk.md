---
type: brainstorm
date: 2026-06-23
slug: mobile-filter-team-pk
---

# Brainstorm Mobile Filter Team PK

## Problem

Mobile Team PK filter looks like a page menu item because `Bộ lọc` is a `.nav-tab` inside `.section-nav`. Drawer lacks explicit close/search/apply actions, so user can get stuck or think filter is another section.

## Requirements

- Expected output: improved mobile Team PK filter UI in `index.html`, `css/styles.css`, `js/app.js`.
- Acceptance: page tabs stay page-only; filter has open/search/close/apply; drawer exits on close/apply/overlay/Escape/section switch.
- Scope: no filter data/schema changes, no framework, no redesign of cards.
- Constraints: static vanilla JS, Vietnamese short labels, mobile-first readability.
- Touchpoints: section nav, filter aside, drawer JS, tests-js.

## Options

| Option | Pros | Cons |
|---|---|---|
| Keep nav button, add close only | Smallest diff | Preserves root confusion: filter still reads as menu page |
| Separate mobile filter action + drawer chrome | Fixes mental model, modest code | Needs markup/CSS/JS coordination |
| Convert filters to full-screen modal | Very clear | Heavy, hides results context, more layout risk |

## Recommendation

Use separate mobile filter action + drawer chrome. It directly fixes the user complaint with the least architecture change.

## Success Metrics

- User sees `Team PK` as current page and `Bộ lọc` as action.
- Drawer has visible title, search input, `Đóng`, `Xem kết quả`.
- Result count remains visible after applying filter.

## Open Questions

None.
