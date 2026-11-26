---
phase: 1
title: "Tách khung thành cây dùng chung (không đổi hành vi)"
status: pending
priority: P2
effort: "5h"
dependencies: []
---

# Phase 1: Tách khung thành cây dùng chung (không đổi hành vi)

## Goal

Khung của `createRecommendedSection` được mô tả bằng hàm cây thuần, chạy được trong Node mà không cần `document`. Client dựng khung từ đúng các cây đó. Hành vi và DOM sau boot không đổi, trừ hai điểm có chủ đích: thứ tự chip khi hoà số đếm trở nên tất định, và giá trị URL độc hại không còn làm crash.

## Context

- Khung hiện dựng bằng `el()` có closure `onClick` (`js/team-filter-section.js:288-369`, `:453-501`). `t()` cấm prop là hàm (`js/render.js:36-49`), nên sự kiện phải chuyển sang delegation hoặc gắn trực tiếp sau `treeToDom`.
- Khác biệt ngữ nghĩa giữa `el()` và `t()`:
  - **Boolean:** `el` ghi `false` thành chuỗi `"false"` và `true` thành `"true"`. `t` bỏ `false`/null và ghi `true` thành thuộc tính trần. Mọi `aria-pressed`, `aria-expanded` phải truyền dạng chuỗi.
  - **Con là object:** `el` biến con không có `nodeType` thành text. `h()` coi mọi object là node cây (`js/view-tree.js:7-8`). <!-- Red Team: Security F2 -->
- Có sẵn: `iconTree` (`js/render.js:54`), `svgTree`, `treeToDom`/`treeToHtml` (`js/view-tree.js`). Đã có cây dùng chung: `referenceHeadTextTree`, `referenceSeasonLabelTree`.
- `select` mùa nằm trong `header.reference-head`, là anh em của `.reference-browser`, không nằm trong `results` (`js/team-filter-section.js:356-368`). <!-- Red Team: F2/A1/S4 -->
- Chip kho cũng là `.fchip` (`fchip roster-chip`, `js/roster-list-badges.js:228-233`). Nó nằm trong `.reference-roster-bar`, bên trong `results`, và có `onClick` riêng. <!-- Red Team: FM3/S1/A1 -->
- `js/team-filter-section.js` đã 700 dòng. Theo quy tắc modular hoá, đặt cây mới ở file riêng.

## Files to Create / Modify

- Create: `js/reference-shell-tree.js`, gồm các hàm cây thuần:
  - `referenceSeasonFieldTree({registry, state})`: `label.reference-season-field` gồm `select` (option `all` + `seasonOptions`, `selected` theo state), badge "Đang diễn ra" (`hidden` theo đúng luật `seasonStatus.hidden` ở `:404`) và chevron. Chỉ dùng cho Đội chuẩn.
  - `referenceToolbarTree({mountId, title, state, count, scopeCount, activeCount})`: ô tìm, nút toggle (`aria-controls`, `aria-expanded="false"`, `filter-count`), số đếm, nhóm `view-btn` (`aria-pressed` theo `state.view`).
  - `referenceFiltersChildrenTree({mountId, scopeItems, state, labels, family, openFacets})`: đầu sidebar (`h2` + `clear-btn`, có `disabled` khi không có lọc) và các `fgroup`/`fchip`.
  - `referenceResultsBodyTree({noticeText, emptyText, emptyHidden, moreHidden, viewTree})`: `.reference-results-body > [roster-bar hidden, notice, view, more, empty]`. Cờ `hidden` của notice, more và empty được tính bằng đúng luật của `render()`/`renderMore()` (`:559-560`, `:566`, `:631-632`). <!-- Red Team: FM7/A7 -->
  - `referenceShellTree(...)`: `.reference-browser > .reference-results > [toolbar, aside.reference-filters.collapsed#${mountId}-filters, resultsBody]`.
  - Chuyển vào đây và không giữ bản cũ: `VIEW_OPTIONS`, `PRIMARY_FACETS`, `SECONDARY_FACETS`, `facetLabel`, `facetEntries`, `chipText`, `displayLabel`, `chevron`, `filterIcon`, cùng bản thuần nhận tham số của `narrowingCount`/`activeFilterCount`.
- Thứ tự chip tất định (Red Team A10), trong `facetEntries`:
  - Hoà số đếm: so bằng `Intl.Collator(<locale trang>, {sensitivity:'variant'})`, rồi so mã giá trị thô (`a < b`) làm khoá cuối.
  - Tier: `SOURCE_TIER_ORDER`, rồi so mã thô. Không còn `localeCompare` không có locale.
- Chặn giá trị URL độc hại (Red Team S2):
  - `sourceLabel` (`js/render.js:120`) dùng `Object.hasOwn(SOURCE_LABEL, value)`.
  - `chipText` luôn trả `String(...)`.
- Modify: `js/team-filter-section.js`, `createRecommendedSection`:
  - Khung dựng bằng `treeToDom(...)` từ các cây trên.
  - Gốc sự kiện, ghi rõ từng chỗ (Red Team F2/F3):
    - `aside.reference-filters`: một `click` cho `.fchip`, `.flabel-toggle` và `.clear-btn`. Chip bấm được đọc bằng `closest('.fchip')`, phải nằm trong `filters`, và khoá lấy từ `data-focus-key` **có sẵn** (`key:value`, tách ở dấu `:` đầu tiên). Bỏ qua nếu `key` không thuộc `PRIMARY_FACETS ∪ SECONDARY_FACETS` hoặc `value` không có trong `facetEntries(currentScopeRows, key)` giữ ở closure. Giá trị lấy từ state, không lấy từ DOM (Red Team S7). Không thêm thuộc tính `data-facet-*`.
    - `.reference-toolbar`: `click` cho `[data-view]` và `.filter-collapse-toggle`, `input` cho ô tìm.
    - `select` mùa: gắn `change` trực tiếp lên phần tử sau `treeToDom`.
    - `.reference-roster-bar`: giữ nguyên handler của `roster-list-badges.js`, không có delegation nào chạm tới.
  - `renderFacets` thay con của `aside` bằng `treeToDom(referenceFiltersChildrenTree(...))`, vẫn giữ focus theo `data-focus-key`.
  - Ô chọn mùa: giữ cách thay `option` tại chỗ như hiện nay, không dựng lại cả `label`.
- Create: `tests-js/reference-shell-tree.test.mjs`.

## Tests Before

1. Ghi baseline xanh:
   - `npx playwright test tests-e2e/recommended-browser.spec.mjs tests-e2e/team-ssr-adopt.spec.mjs tests-e2e/team-ssr-parity.spec.mjs tests-e2e/analytics-events.spec.mjs tests-e2e/doi-chuan-roster-badges.spec.mjs`
2. Oracle tạm, không commit (Red Team FM6/A4): một script Playwright cục bộ ghi `outerHTML` của `#section-team-chuan .reference-browser`, `#section-team-khac .reference-browser` và `.reference-head` sau boot, ở vi/zh/ja. Script bỏ đi con của `.reference-view`, `data-ssr-signature`, chữ số trong `.fchip-count` và `.reference-count`. Ghi trước refactor vào `reports/phase-01-dom-before/`, so lại sau refactor. Chỉ được lệch ở thứ tự chip hoà số đếm, và mỗi chỗ lệch phải giải thích được. Xoá script khi kết thúc phase.
3. Thêm e2e vào `tests-e2e/recommended-browser.spec.mjs`. Phải xanh trên code cũ.
   - Đổi mùa ở `/doi-chuan/` thì URL có `?season=` và có đúng một sự kiện `filter_change` kiểu `season`.
   - Với máy có kho, bấm chip "Ráp được" của thanh kho: URL chỉ thêm `kho`, không có khoá `undefined`, và `filter_change` được ghi đúng một lần.

## Refactor

Làm theo mục Files. Các bất biến phải giữ:

- Đo lường không đổi: `trackFilter` chỉ gọi từ thao tác người dùng, mỗi thao tác một lần.
- Không đổi API: Escape đóng panel trên mobile, `setFiltersExpanded`, `getDisclosureState`/`setDisclosureState`, `focus()` (h1), `focusItem`.
- "Xoá lọc" trả focus về ô tìm. Bấm chip giữ focus theo `data-focus-key` khi sidebar được dựng lại.

## Tests After

- `tests-js/reference-shell-tree.test.mjs` (chạy bằng Node, không shim DOM), cho từng locale vi/zh/ja qua `withLocale`:
  - Cây khung có đúng một `aside.reference-filters` với `id` = `${mountId}-filters`. Nút toggle có `aria-controls` trỏ đúng id đó.
  - Đếm facet đúng trên một fixture nhỏ (2 phe, 2 loại binh, 1 tier). Giá trị đang chọn nhưng không có trong phạm vi vẫn hiện, với số 0. Tier xếp theo `SOURCE_TIER_ORDER`.
  - Thứ tự khi hoà số đếm ổn định và không phụ thuộc locale mặc định của tiến trình: chạy với `LANG=C` và `LANG=vi_VN` cho cùng kết quả.
  - Không có lọc thì `clear-btn` có `disabled` và `filter-count` có `hidden`.
  - Notice rỗng thì có `hidden`. `more` có `hidden` khi số mục ≤ `PAGE_SIZE`.
  - `filters.source = ['__proto__','constructor','toString']`: `treeToHtml` không throw, nhãn chip là chuỗi.
  - `treeToHtml` của cây không chứa chuỗi khớp `WAITING_OR_JS_REQUIRED` (`scripts/verify-astro-dist.mjs:66-67`).
- So oracle tạm (Tests Before mục 2) đạt; e2e ở Tests Before mục 3 vẫn xanh.

## Regression gate

```bash
node --experimental-strip-types --test tests-js/reference-shell-tree.test.mjs tests-js/team-section-ssr.test.mjs
npm run build
npx playwright test tests-e2e/recommended-browser.spec.mjs tests-e2e/team-ssr-adopt.spec.mjs tests-e2e/team-ssr-parity.spec.mjs tests-e2e/analytics-events.spec.mjs tests-e2e/doi-chuan-roster-badges.spec.mjs
```

## Todo

- [ ] Ghi baseline e2e, chụp oracle DOM tạm (vi/zh/ja)
- [ ] Thêm e2e đổi mùa và chip kho (xanh trên code cũ)
- [ ] Tạo `js/reference-shell-tree.js`, chuyển hằng số và hàm facet sang
- [ ] `facetEntries` dùng Collator theo locale cộng khoá mã thô; `sourceLabel` dùng `Object.hasOwn`; `chipText` trả `String`
- [ ] Chuyển `createRecommendedSection` sang `treeToDom`, gắn sự kiện theo đúng gốc đã định
- [ ] Viết `tests-js/reference-shell-tree.test.mjs`
- [ ] So oracle, rồi xoá script tạm
- [ ] Regression gate xanh

## Success Criteria

- DOM sau boot khớp oracle, trừ các chỗ lệch thứ tự chip đã được giải thích. Mọi spec e2e liên quan đều xanh.
- `js/team-filter-section.js` không còn dựng node khung bằng `el()` kèm handler riêng.
- Đổi mùa và chip kho chạy đúng; không có khoá `undefined` trong URL.

## Risks

- Delegation làm đổi thứ tự focus hoặc sự kiện bàn phím của chip. Các test bàn phím `recommended-browser.spec.mjs:860` và `:881` phải xanh. (`:794` là kiểm tra độ tương phản màu phe, không phải test bàn phím.)
