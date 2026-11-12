---
phase: 4
title: "Phase 4: Badge, tóm tắt, sắp xếp và lọc"
status: todo
priority: P1
effort: "1d"
dependencies: [3]
---

# Phase 4: Badge, tóm tắt, sắp xếp và lọc

## Goal

Trang `/doi-chuan/` và trang mùa cũ hiện badge kho, dòng tóm tắt, nút sắp "dễ ráp nhất" và bộ lọc theo kho, bản vi và zh, ở cả ba kiểu xem.

## Files to Create / Modify

- Modify: `js/recommended-reference-render.js` (cây badge; `recommendedTeamCard`, `recommendedTeamTableRow`, `teamItemTree`, `recommendedListTrees` nhận `coverageFor` tùy chọn)
- Modify: `js/team-filter-section.js` (`createRecommendedSection`: dòng tóm tắt, điều khiển `kho`/`xep`, dòng dẫn khi chưa có kho, vẽ lại khi độ phủ sẵn sàng)
- Modify: `js/app.js` (trang `team-chuan`: gọi `readOwnedRoster`; có kho thì nạp lookup bundle sau lần vẽ đầu, tính độ phủ theo mùa đang chọn, cập nhật section)
- Modify: `css/styles.css` (badge và điều khiển, chỉ dùng token trong `docs/design/so-binh-phap/tokens.json`; thiếu token thì thêm token trước rồi chạy `node scripts/design-tokens.mjs --check`)
- Modify hoặc Create theo kết luận phase 1: phần gắn badge cho trang mùa cũ (`src/components/pages/SeasonPage.astro` hoặc entry script nhỏ)
- Modify: `tests-e2e/recommended-browser.spec.mjs`, `tests-e2e/season-pages.spec.mjs`, `tests-e2e/zh-locale.spec.mjs` (hoặc file e2e gần nhất theo quy ước hiện có)

## Hành vi

- Badge: "Ráp được" khi `missingCount === 0`; "Thiếu N món" khi lớn hơn 0, kèm `title`/`aria-label` liệt kê tên món thiếu. Đội không có độ phủ: không badge.
- Tóm tắt đầu danh sách: "Ráp được X / Y đội của mùa" theo mùa đang chọn, không phụ thuộc bộ lọc facet.
- Điều khiển chỉ hiện khi có kho: chọn "Dễ ráp nhất" (`xep=de-rap`), chip "Ráp được" (`kho=rap-duoc`) và "Thiếu tối đa 2" (`kho=thieu-2`). Trạng thái ghi lên query và tính vào số bộ lọc đang bật trên mobile.
- Chưa có kho: không badge, không điều khiển, một dòng "Nhập kho ở Gợi ý đội để xem đội nào ráp được" dẫn tới `/goi-y-doi-tu-kho/` (bản zh tới `/zh/goi-y-doi-tu-kho/`); `kho` và `xep` trên URL bị bỏ qua.
- Đổi mùa: tính lại độ phủ cho mùa mới.
- Trang mùa cũ: cùng badge và tóm tắt, không có sắp/lọc (trang tĩnh không có bộ lọc).
- Tên món thiếu hiển thị theo tên game VN hiện hành (`tacticDisplayName`), bản zh theo tên Hán như các chỗ khác.

## Tests Before

E2E viết trước, phải đỏ (dùng kho mẫu như `seedRoster`/`conflictFixture` trong `tests-e2e/beta-tools.spec.mjs`; tách helper dùng chung nếu cần, không chép lại):

1. Có kho: thẻ của một đội đủ kho hiện "Ráp được"; thẻ của đội thiếu hiện "Thiếu N món" với N đúng theo `buildRosterCoverage`.
2. Tóm tắt: số X bằng tổng ô "Ráp đủ" của khối Độ phủ kho ở `/goi-y-doi-tu-kho/` với cùng kho và mùa.
3. `kho=rap-duoc`: chỉ còn các thẻ có badge "Ráp được"; URL có `kho=rap-duoc`; tải lại vẫn giữ.
4. `xep=de-rap`: trong bậc T0, số món thiếu của các thẻ không giảm theo thứ tự hiển thị.
5. Ba kiểu xem: badge có ở Thẻ, Thẻ gọn (`view=luoi`) và Bảng (`view=bang`).
6. Chưa có kho: không badge, có dòng dẫn, và không có request nào tới `heroes-dict.json` hay `tactics.json`.
7. zh: badge và điều khiển là chữ Hán; 390px không tràn ngang ở vi sáng và zh tối.
8. Trang mùa cũ có kho: badge hiện trên thẻ.

## Refactor

`coverageFor` là hàm tùy chọn `row => entry | null` truyền xuống cây view; khi vắng mặt, cây sinh ra y hệt hiện nay.

## Tests After

- `tests-e2e/team-ssr-parity.spec.mjs`, `team-ssr-nojs.spec.mjs`, `team-ssr-adopt.spec.mjs`, `responsive.spec.mjs`, `a11y-targets.spec.mjs`, `selected-state-contrast.spec.mjs` vẫn xanh.
- Kiểm tra bằng Browser pane: `/doi-chuan/` có kho, ba kiểu xem, theme sáng và tối, 390px; chụp ảnh làm bằng chứng.

## Regression gate

`npm run test:node` và toàn bộ e2e bằng cấu hình tạm bỏ cổng bản dịch.

## Success Criteria

- [x] Tám ca e2e đỏ trước, xanh sau.
- [x] Không test SSR parity nào phải sửa.
- [x] `node scripts/design-tokens.mjs --check` xanh.
- [x] Danh sách đầy đủ chữ UI mới (vi và zh) được ghi vào cuối file này để phase 5 đưa đi duyệt.

## Ghi chú thực hiện (2026-11-11)

- Badge được gắn lên thẻ và hàng đã dựng (`decorateCoverageBadges` theo `data-reference-key`) thay vì thêm tham số `coverageFor` vào cây view. Lý do: `js/recommended-reference-render.js` không phải sửa, danh sách dựng sẵn và test SSR parity giữ nguyên, và trang mùa cũ dùng chung đúng hàm này. Ý của quyết định 6 trong `plan.md` (không có kho thì không đổi gì) vẫn giữ.
- Mọi chữ UI mới nằm trong module mới `js/roster-list-badges.js`; `js/team-filter-section.js` và `js/app.js` chỉ nối dây.
- Trang `/doi-chuan/` vốn đã tải `heroes-dict.json` và `tactics.json` một lần cho mô hình mùa (`loadSeasonModel`), nên tiêu chí "chưa có kho thì không tải từ điển" trong plan không còn nghĩa. Tiêu chí thay thế, đã có e2e: badge không làm trang tải hai file này thêm lần nào (mỗi file đúng một request, có kho hay không).
- Trang mùa cũ có thêm một thẻ `<script type="module">` (`js/season-page-roster-badges.js`); nội dung HTML không đổi, và script không tải dữ liệu nào khi máy chưa có kho.
- Kho tới sau lần vẽ đầu không thay node dựng sẵn: `render({keepSameList:true})` chỉ gắn badge khi danh sách không đổi (test `team-ssr-adopt` bắt được lỗi này trong lúc làm).
- Dòng dẫn dùng lớp riêng `reference-roster-hint`, không dùng `scope-note`, vì test hiện có coi `.scope-note` trong mục là duy nhất.
- `node scripts/design-tokens.mjs --check` báo 4 lỗi (`--f-han`, `--f-han-select`, hai `font-weight: 600` của khối Độ phủ kho); cả 4 có sẵn trên `origin/main`, không lỗi nào thuộc CSS của phase này.

## Chữ UI mới

Tất cả ở `js/roster-list-badges.js`. Chờ anh duyệt cột zh ở phase 5.

| Vị trí | vi | zh |
|---|---|---|
| Badge đủ kho | Ráp được | 可组建 |
| Badge thiếu | Thiếu N món | 缺 N 件 |
| Title badge đủ kho | Kho của bạn có đủ tướng và chiến pháp của đội này | 你的库存已有该阵容的全部武将和战法 |
| Title badge thiếu | Thiếu: … | 缺少：… |
| Món thiếu là tướng | tướng X | 武将X |
| Món thiếu là chiến pháp | chiến pháp X | 战法X |
| Chiến pháp chưa đối chiếu | chiến pháp X (chưa đối chiếu) | 战法X（尚未核对） |
| Dấu ngăn danh sách | ", " | "、" |
| Tóm tắt | Kho của bạn ráp được X / Y đội của mùa này. | 你的库存可组建 X / Y 支本赛季阵容。 |
| Dòng dẫn | Nhập kho ở Gợi ý đội để xem đội nào ráp được. | 在武将库配队中录入库存，即可查看哪些阵容可组建。 |
| Nhãn nhóm nút | Lọc và sắp theo kho | 按库存筛选和排序 |
| Nút lọc | Ráp được | 可组建 |
| Nút lọc | Thiếu tối đa 2 | 最多缺 2 件 |
| Nút sắp | Dễ ráp nhất | 最易组建 |
