---
phase: 3
title: "Khoá bằng test, verifier và cập nhật docs"
status: completed
priority: P2
effort: "3h"
dependencies: [2]
---

# Phase 3: Khoá bằng test, verifier và cập nhật docs

## Goal

Có test chặn tái phát hai lỗi: nhảy bố cục, và khung dựng sẵn lệch với khung client dựng. Docs mô tả đúng hợp đồng mới.

## Files to Create / Modify

- Create `tests-e2e/team-ssr-layout-shift.spec.mjs`.
  - Dùng lại cách giữ `app.js` của `bootWithProbe` (`tests-e2e/team-ssr-adopt.spec.mjs:8`).
  - Tách helper ra `tests-e2e/helpers/` và đổi caller cũ sang helper mới.
- Modify `tests-e2e/team-ssr-parity.spec.mjs`: thêm locale `ja` (`/ja`). Vẫn so `.reference-view`.
  - Lý do không mở rộng phép so: cả hai phía của spec này đều là DOM sau boot. Phép so bản dựng sẵn với bản sau boot nằm trong spec layout-shift. <!-- Red Team: A8 -->
- Modify docs:
  - `docs/system-architecture.md:114-116`: câu "Sidebar lọc, ô chọn mùa và "Xem thêm" vẫn do …" ở dòng 114 cần viết lại theo hợp đồng mới. <!-- Red Team: A fact fix -->
    - khung dựng từ cùng cây;
    - client giữ nguyên node khung, chỉ thay con;
    - chỉ `.reference-view` theo chữ ký;
    - điều khiển khoá bằng `disableControls`;
    - `data-ssr-failed` và `data-ssr-filters-open`.
  - `docs/code-standards.md`, mục cây view (khoảng `:55`):
    - thêm `js/reference-shell-tree.js` vào danh sách cây dùng chung;
    - quy tắc chọn gốc sự kiện cho delegation;
    - Collator tất định.
  - `docs/codebase-summary.md:42`: thêm `js/reference-shell-tree.js`. `docs/codebase-summary.md:135`: thêm spec mới.
  - `docs/project-changelog.md`: thêm mục mới.
- Modify `plans/261015-1658-seo-ai-render-san/reports/phase-02.md:46,72`: thêm ghi chú "đã xử lý ở plan 261126-0819", giữ nguyên nội dung gốc.

## Tests Before

Spec layout-shift ở dưới phải **đỏ** khi tạm bỏ phần khung khỏi `recommendedSectionTrees` (revert cục bộ), rồi xanh lại trên code của phase 2.

## Tests After

`tests-e2e/team-ssr-layout-shift.spec.mjs` chạy cho `/doi-chuan/` và `/doi-khac/`, mỗi trang ở vi/zh/ja và ở viewport 1440×900 lẫn 390×844.

**Chuẩn bị đo** (Red Team FM10), trước **mỗi** lần đo:
1. Khẳng định `document.querySelector('link[href="/css/styles.css"]').sheet` khác null.
2. Ép layout, rồi `await document.fonts.load(...)` cho font đã tính (computed) của chữ trong thẻ, trong sidebar và trong toolbar, theo từng locale.
3. `await document.fonts.ready`, rồi đo trong `requestAnimationFrame`.

**Các khẳng định:**
- **Vị trí.** Giữ `app.js`, đọc `getBoundingClientRect()` của thẻ `[data-reference-key]` đầu tiên và của `.reference-filters` (ở desktop). Thả `app.js`, chờ `body[data-boot=ready]`, rồi đọc lại.
  - `/doi-khac/`: lệch `x`, `y`, `width` ≤1px.
  - `/doi-chuan/`, **cả khi là khách lẫn khi máy có kho**: lệch `x` và `width` ≤1px. Lệch `y` phải **đúng bằng** chiều cao `.reference-roster-bar` cộng gap của `.reference-results-body`, sai số ±1px.
  - Lý do: thanh gợi ý kho hiện chắc chắn sau boot. Khách: ngay sau boot, vì `js/community-api.js:229-233` trả `Promise.resolve(null)` nên kho trống. Máy có kho: khi kho và từ điển tải xong. Phần này để lại cho #181. Anh đã chốt: không giấu thanh kho trong test. <!-- Red Team: FM4/A3 -->
  - **Thay đổi phạm vi (review PR #184, anh chốt): máy có kho cũng thuộc #181.** Bản đầu của phase này đòi máy có kho lệch `x`, `y`, `width` ≤1px; thanh kho của máy có kho hiện sau khi kho tải xong nên không đạt được. Spec đặt cùng một luật cho hai trường hợp (tham số `rosterBar181` của `expectStableLayout`) và đặt tên test theo #181; mọi dung sai khác giữ nguyên.
- **Khớp DOM** (Red Team A8). Lấy `outerHTML` của `.reference-head` và `.reference-results` trước boot và sau boot ở trạng thái mặc định. Trước khi so:
  - bỏ con của `.reference-view` và `.reference-roster-bar`;
  - bỏ `disabled`/`aria-disabled` của điều khiển khung;
  - bỏ thuộc tính `hidden` của `.reference-roster-bar`.

  Hai bản phải bằng nhau.

## Regression gate (toàn bộ, chạy một lần ở cuối)

```bash
npm run test:node
npm run build && npm run verify && npm run test:dist
npx playwright test tests-e2e/team-ssr-adopt.spec.mjs tests-e2e/team-ssr-nojs.spec.mjs tests-e2e/team-ssr-parity.spec.mjs tests-e2e/team-ssr-layout-shift.spec.mjs tests-e2e/recommended-browser.spec.mjs tests-e2e/selected-state-contrast.spec.mjs tests-e2e/bai-viet-kho-redesign.spec.mjs tests-e2e/analytics-events.spec.mjs tests-e2e/doi-chuan-roster-badges.spec.mjs tests-e2e/doi-khac-single-season.spec.mjs
```

## Todo

- [x] Viết `team-ssr-layout-shift.spec.mjs` (đo đúng cách, roster = đúng chiều cao), xác nhận nó bắt được lỗi khi bỏ khung
- [x] So DOM của `.reference-head` và `.reference-results` trước và sau boot
- [x] Parity: thêm `ja`
- [x] Cập nhật docs và changelog
- [x] Ghi chú vào report cũ của plan 261015
- [x] Regression gate toàn bộ xanh
- [ ] Mở PR từ `feat/ssr-khung-bo-loc` vào `main`, đề xuất Astra review

## Success Criteria

- Mọi tiêu chí trong `plan.md` (mục Success Criteria) đều có test hoặc lệnh kiểm tra tương ứng, và tất cả xanh.
- `docs/system-architecture.md` mô tả đúng hợp đồng mới; không còn câu nói rằng sidebar, ô chọn mùa do client dựng sau.

## Risks

- Test đo pixel có thể chập chờn vì font. Đã xử lý bằng các bước chuẩn bị đo ở trên. Không được nới sai số; nếu còn chập chờn thì tìm nguyên nhân.
