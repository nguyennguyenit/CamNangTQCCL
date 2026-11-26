---
phase: 2
title: "Phát khung từ build"
status: pending
priority: P2
effort: "6h"
dependencies: [1]
---

# Phase 2: Phát khung từ build

## Goal

HTML dựng sẵn của `/doi-chuan/` và `/doi-khac/` (vi/zh/ja) có sẵn khung tương tác ở trạng thái mặc định, với mọi điều khiển của khung bị khoá. Client **giữ nguyên các node khung tại chỗ** (`.reference-head`, `.reference-browser`, `.reference-results`, `.reference-results-body`, `.reference-view`) và chỉ thay **nội dung** của ô chọn mùa, thanh công cụ và sidebar, tất cả trong cùng một task. Vì vậy bố cục không nhảy và focus không mất.

## Context

- `recommendedSectionTrees` (`src/lib/team-section-ssr.js:51-71`) được gọi từ `src/lib/team-ssr.ts:263-264`. Kết quả chèn vào mount qua `src/components/pages/SectionPage.astro:108` (`set:html`); script chặn trạng thái lệch ở `:110`. <!-- Red Team: fact fix :94→:108 -->
- Client nhận lại danh sách bằng `mount.querySelector(':scope > .reference-view[data-ssr-signature]')` (`js/team-filter-section.js:306`), rồi gọi `mount.replaceChildren(head, reference-browser)` (`:366-369`). Chuyển node như vậy làm mất focus của người đã tab vào thẻ trước khi boot. Khai hoang đã tránh việc này (`js/app.js:657`). <!-- Red Team: FM9 -->
- `disableButtons` (`js/view-tree.js:58-64`) chỉ khoá `button`. Nó được gọi qua `inertUntilBound` (`src/lib/team-section-ssr.js:33`); `inertUntilBound` lại được gọi ở `src/lib/team-section-ssr.js:64`, `:145` và `src/lib/team-ssr.ts:194` (trang chi tiết Khai hoang). <!-- Red Team: S6 -->
- Trạng thái lệch:
  - `ssrStaleGuardScript` (`src/lib/team-section-ssr.js:~159-173`) gắn `data-ssr-stale`.
  - CSS ở `css/styles.css:7837` chỉ ẩn `.reference-view`/`.coexist-group-view` bằng `visibility:hidden`.
  - `finally` của `main()` gỡ dấu (`js/app.js:739`).
- Đường lỗi khi JS chạy (Red Team FM1/S3):
  - Lỗi tải dữ liệu bị nuốt ở `js/app.js:257`. Sau đó `sections[...] = null` và một dòng lỗi được chèn lên đầu (`:586-599`).
  - `main()` throw: `catch`/`finally` giữ nguyên thân dựng sẵn (`:731-740`).
- Mobile: `.reference-results` là `display:block` và `.reference-filters.collapsed` là `display:none` (`css/styles.css:4882`, `:4957`). Khi quay lại từ trang chi tiết, `restoreReturnState` mở panel sau khi boot. Bộ chặn hiện chỉ đọc snapshot quay lại cho Khai hoang (`returnKey`, `src/lib/team-section-ssr.js:163-166`). <!-- Red Team: FM9 -->
- Nhãn mùa tĩnh của Đội khác là `div.reference-season-field.reference-season-static` (`js/team-filter-section.js:254-257`). Đây là nội dung, không phải điều khiển. <!-- Red Team: FM8/A6 -->

## Files to Create / Modify

- `js/view-tree.js`
  - Đổi `disableButtons` thành `disableControls(node, matches)`, khoá `button`/`input`/`select`/`textarea`. Đổi caller duy nhất (`src/lib/team-section-ssr.js:25,33`), không giữ alias.
  - Không đổi `enableControl`.
  - Chạy `lsp references` trước khi đổi.
- `src/lib/team-section-ssr.js`, `recommendedSectionTrees`:
  - Phát `header.reference-head`. Đội chuẩn thêm `referenceSeasonFieldTree`, Đội khác giữ nhãn tĩnh. Sau đó là `referenceShellTree(...)`, với ô danh sách là `.reference-view[data-ssr-signature]` hiện có.
  - Cơ chế khoá, tách rõ hai phần (Red Team S6):
    1. `disableControls(shellTreeKhôngCóView, () => true)` chỉ áp lên cây khung (gồm cả ô chọn mùa trong header).
    2. `inertUntilBound([viewTree])` áp lên danh sách như cũ.
  - `inertUntilBound` và `NEEDS_SCRIPT` giữ nguyên, nên HTML của Khai hoang (danh sách và trang chi tiết) không đổi một byte.
  - Số đếm `N / M đội`, chip facet và các cờ `hidden` của notice/more/empty tính bằng đúng hàm client dùng (`projectRecommendedRows` / `otherTeamListEntries`, `facetEntries` và luật `hidden` ở phase 1). Trạng thái đầu vào là trạng thái mặc định `referenceSectionState(family, url, registry, null)`.
- `src/lib/team-section-ssr.js`, `ssrStaleGuardScript` (Red Team FM9): với `team-chuan`/`team-khac`, đọc snapshot quay lại theo đúng khoá và định dạng mà `restoreReturnState` dùng (xác minh ở `js/app.js` trước khi viết). Nếu `disclosures.filters === true` thì gắn `data-ssr-filters-open` lên mount. CSS mở panel mobile khi có dấu đó, và `setDisclosureState` gỡ dấu sau khi boot.
- `js/team-filter-section.js`, nhận lại khung tại chỗ (Red Team FM9):
  - Khi `adopt` và mount có `.reference-browser` dựng sẵn: lấy lại `.reference-head`, `.reference-results`, `.reference-results-body` và `.reference-view` có sẵn.
  - Thay **con** của `label.reference-season-field`, `.reference-toolbar` và `aside.reference-filters` bằng bản `treeToDom` từ cùng cây (không còn khoá). Không gọi `mount.replaceChildren`.
  - `.reference-view` vẫn theo luật chữ ký cũ: khớp thì giữ con, lệch thì `renderView` thay con.
  - Không `adopt` (khác publication hoặc thiếu `data-ssr-source`): dựng mới như hiện nay.
- `js/app.js`, đường lỗi (Red Team FM1/S3): ở nhánh `!recommendedModel` (`:594-599`) và trong `catch` của `main()` (`:731-738`), gắn `mount.dataset.ssrFailed = ''` cho hai mục này.
- `css/styles.css`:
  - Mở rộng luật `[data-ssr-stale]` (`:7837`): giữ chỗ nhưng ẩn `.reference-filters .chip-row`, `.reference-filters .clear-btn`, `.reference-filter-head`, `.reference-count`, `.reference-view-toggle`, `.reference-search-input` và **toàn bộ nội dung** của `label.reference-season-field` (cả badge "Đang diễn ra"). <!-- Red Team: A5/FM7 -->
  - Ẩn khung chết. Cùng một luật cho `@media (scripting: none)` và `.section[data-ssr-failed]`:
    - ẩn `.reference-toolbar`, `.reference-filters`, `label.reference-season-field` (không phải `.reference-season-static`) và `.reference-more`;
    - cho `.reference-results-body` chiếm cả hàng (`grid-column: 1 / -1`).
  - `[data-ssr-filters-open]` mở `.reference-filters.collapsed` trên mobile.
- `scripts/verify-astro-dist.mjs:79-80`: thêm marker `class="reference-toolbar"` và `class="reference-filters` cho `team-chuan` và `team-khac`.
- `tests-js/astro-dist-contract.test.mjs:180-181`: thêm marker mới vào fixture, kèm một ca âm tính thiếu khung.
- Cập nhật các test đang ghim hợp đồng cũ (Red Team FM5/S5/A2):
  - `tests-e2e/team-ssr-adopt.spec.mjs:72-80`: đổi 7 selector `#section-team-* > .reference-view` thành `#section-team-* .reference-view`.
  - `tests-js/team-section-ssr.test.mjs:115-126`: viết lại thành ba ý: (a) mọi điều khiển của khung bị khoá; (b) nút trong danh sách theo `NEEDS_SCRIPT`; (c) Khai hoang không đổi.
- `tests-e2e/helpers/`, helper `gotoBooted(page, url)` (Red Team A9): `goto` rồi chờ `body[data-boot=ready]`. Mọi `goto` trong `recommended-browser.spec.mjs`, `selected-state-contrast.spec.mjs`, `bai-viet-kho-redesign.spec.mjs` và `analytics-events.spec.mjs` mà chạm `.reference-filters`, `.reference-toolbar` hoặc ô chọn mùa đều chuyển sang helper này.

## Tests Before (viết trước, phải đỏ trên code hiện tại)

1. `tests-js/team-section-ssr.test.mjs`, chạy cho từng locale vi/zh/ja và cả hai family:
   - HTML có cấu trúc `.reference-browser > .reference-results`, bên trong gồm `.reference-toolbar`, `aside.reference-filters` và `.reference-results-body > .reference-view[data-ssr-signature]`.
   - Mọi điều khiển của khung bị khoá (`disabled` + `aria-disabled="true"`). Khai hoang không đổi.
   - Đội chuẩn có `select` mùa, chọn đúng `defaultSourceSeasonId`. Đội khác không có `select` nhưng còn `.reference-season-static`.
   - Số đếm và số chip của từng facet khớp với kết quả tính lại từ fixture. Notice rỗng có `hidden`.
   - Chỉ có đúng một `<h1>`.
2. `tests-e2e/team-ssr-adopt.spec.mjs`, qua `bootWithProbe`:
   - Trước khi thả `app.js`: `.reference-filters` và `.reference-toolbar` có mặt, điều khiển bị khoá.
   - Sau boot: điều khiển dùng được; `.reference-head`, `.reference-results-body` và `.reference-view` vẫn là node dựng sẵn (kiểm bằng `window.__ssrNodes`).
   - Tab vào thẻ đầu tiên trước boot thì sau boot focus vẫn ở đó.

## Implementation

Làm theo mục Files, theo thứ tự:
1. `disableControls`.
2. `recommendedSectionTrees`.
3. Nhận lại khung tại chỗ.
4. `ssrFailed`.
5. Stale guard và CSS.
6. Verifier, fixture và cập nhật test cũ.
7. `gotoBooted`.

## Tests After

- `tests-e2e/team-ssr-adopt.spec.mjs`:
  - Các trường hợp stale: `/doi-chuan/?faction=<giá trị>`, `/doi-chuan/?season=pk-s24`, `/doi-chuan/?season=all`, và `/doi-khac/` với kiểu Bảng đã lưu.
    - Trước boot: chip, số đếm, nút kiểu hiển thị, ô chọn mùa và badge "Đang diễn ra" có `visibility:hidden`.
    - Sau boot: tất cả hiện đúng theo URL.
  - Chặn `**/data/recommended/**`. Sau `data-boot=ready`: có dòng lỗi, không có điều khiển nào của khung hiển thị, danh sách chiếm cả hàng.
  - Quay lại ở 390px khi panel lọc đang mở: panel đã mở trước boot, thẻ đầu không bị đẩy khi boot.
- `tests-e2e/team-ssr-nojs.spec.mjs`, mỗi trang thêm một ca:
  - Thanh công cụ, sidebar, ô chọn mùa và "Xem thêm" đều ẩn.
  - Trên `/doi-khac/`, `.reference-season-static` vẫn hiển thị.
  - Danh sách chiếm cả bề ngang nội dung.
- Ghi chênh kích thước `dist/{,zh/,ja/}doi-chuan/index.html` và `doi-khac` (trước/sau) vào `reports/phase-02-size.md`. Mục tiêu dưới 10 KB mỗi trang. Vượt thì báo lại trước khi đi tiếp.

## Regression gate

```bash
node --experimental-strip-types --test tests-js/team-section-ssr.test.mjs tests-js/doi-khac-single-season.test.mjs tests-js/season-pages.test.mjs tests-js/reference-shell-tree.test.mjs
npm run build && npm run verify && npm run test:dist
npx playwright test tests-e2e/team-ssr-adopt.spec.mjs tests-e2e/team-ssr-nojs.spec.mjs tests-e2e/team-ssr-parity.spec.mjs tests-e2e/recommended-browser.spec.mjs tests-e2e/analytics-events.spec.mjs tests-e2e/doi-chuan-roster-badges.spec.mjs tests-e2e/selected-state-contrast.spec.mjs tests-e2e/bai-viet-kho-redesign.spec.mjs
```

## Todo

- [ ] Viết Tests Before (Node + e2e adopt + focus), xác nhận đỏ
- [ ] Đổi `disableButtons` thành `disableControls` (lsp references trước)
- [ ] `recommendedSectionTrees` phát khung; khoá khung riêng, `inertUntilBound` riêng
- [ ] Client nhận lại khung tại chỗ, thay con của season field, toolbar và aside
- [ ] `data-ssr-failed` ở nhánh lỗi dữ liệu và `catch` của `main()`
- [ ] Stale guard: `data-ssr-filters-open` từ snapshot quay lại
- [ ] CSS: mở rộng stale; ẩn khung chết cho `scripting:none` và `ssr-failed`; mở panel khi có `filters-open`
- [ ] Marker verifier và fixture `astro-dist-contract`
- [ ] Cập nhật selector `team-ssr-adopt.spec.mjs:72-80` và `team-section-ssr.test.mjs:115-126`
- [ ] Helper `gotoBooted`, đổi các `goto` liên quan
- [ ] Tests After (stale, lỗi dữ liệu, quay lại trên mobile, nojs) và ghi kích thước
- [ ] Regression gate xanh

## Success Criteria

- HTML dựng sẵn có đủ khung, với điều khiển bị khoá, ở vi/zh/ja. HTML Khai hoang không đổi.
- Client giữ nguyên các node khung và `.reference-view`; focus không mất.
- Trạng thái URL lệch không làm lộ chip, số đếm hay mùa mặc định trước boot.
- Lỗi dữ liệu hoặc lỗi boot không để lại điều khiển chết trên màn hình.

## Risks

- Ô tìm bị khoá nên chưa gõ được trước boot. Đây là chủ đích: chữ gõ sớm sẽ bị `render()` ghi đè (`js/team-filter-section.js:608`).
- `app.js` không tải được (extension chặn, lỗi mạng module): không có JS nào chạy để gỡ khung, người dùng thấy điều khiển bị khoá. Anh đã chấp nhận rủi ro này; nó giống quy ước của chip chiến pháp hiện nay.
- `@media (scripting: none)`: trình duyệt cũ không hỗ trợ query này sẽ thấy điều khiển bị khoá, theo cùng quy ước.
