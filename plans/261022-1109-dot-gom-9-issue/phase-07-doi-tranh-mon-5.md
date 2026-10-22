---
phase: 7
title: "Đội tranh món trên Gợi ý kho (#5)"
status: done
priority: P2
effort: "1d"
dependencies: [5]
---

# Phase 7: Đội tranh món trên Gợi ý kho (#5)

## Goal

Trang `/goi-y-doi-tu-kho/` (vi + zh) có mục "Đội dựng được nhưng tranh món với đội đã chọn", hiển thị `conflictedTeams` mà engine đã trả về, để website và MCP trả lời giống nhau cho cùng một kho.

## Hiện trạng (bằng chứng: [reports/scout-05-20-roster.md](./reports/scout-05-20-roster.md) mục 0–2)

- Engine: `js/team-recommend-engine.js:821-841` trả `conflictedTeams[] = {team, tier, sharedHeroes[{hero, heroId, usedBy}], sharedTactics[{tactic, tacticId, usedBy}]}`; `usedBy` là **id đội**, không phải tên. `recommendRoster` truyền nguyên (`js/roster-season-candidates.js:228`). Không cần sửa engine; phụ thuộc `feat/mcp-skill-redesign` trong issue đã hết hiệu lực.
- Ví dụ của issue chạy trên dữ liệu thật (mùa `og-兵演春秋`, chế độ `meta`): `portfolioTeams` = 40Y Lữ Bố Cung (Vương Dị, Pháp Chính); `conflictedTeams` = Ngô Nữ Kỵ (Tinh·Hổ Báo Kỵ), id `og-bingyan-wunv-cavalry-hubaoqi`, T0, `sharedHeroes` rỗng, `sharedTactics` = Đương Phong Thôi Quyết, Lâm Nguy Cứu Chủ, cả hai `usedBy: "og-bingyan-40y-lvbu-b"`.
- UI: `js/roster-recommend-ui.js:694-929` `renderRecommendation`; mục danh mục `:890-906`; mục "Thiếu món" `:907-927`; helper `teamLabel` `:128`, `tacticShown` `:125`, `tierPill` `:685`, `openButton` `:692`; chữ vi/zh qua `L(vi, zh)` (`js/i18n.js:34`). CSS `.roster-missing` `css/styles.css:12633,990,12654,13055`.
- `js/roster-recommend-ui.js` bị ghim bản dịch; `js/team-recommend-engine.js`, `js/roster-season-candidates.js` nằm trong `semanticFiles` MCP — **không sửa** hai file này.

## Thiết kế

- Hàm thuần `js/roster-conflict-view.js`: nhận `result` (`conflictedTeams`, `portfolioTeams`, các đội khóa) và trả view model `[{teamId, label, tier, items:[{kind, name, holderLabel}]}]`. Tên đội giữ món lấy từ `portfolioTeams[].team` hoặc tên đội khóa; không tìm thấy thì hiện "một đội đã chọn", không hiện id thô.
- Mục mới đặt sau mục danh mục, trước "Thiếu món"; mỗi thẻ: tên đội + bậc, từng món bị tranh kèm đội đang giữ, câu "Không dựng cùng lúc được; muốn dựng cả hai cần thêm một bản của mỗi món bị tranh", nút "Mở đội". Hiện tối đa 5 thẻ, kèm "và N đội khác" nếu nhiều hơn. Không có xung đột thì không render mục.
- Dùng lại class `roster-missing` + `data-status="conflicted"`; không thêm token màu.

## Files to Create / Modify

- Create: `js/roster-conflict-view.js`; thêm `entry("js","roster-conflict-view")` vào `src/lib/public-artifact-manifest.mjs`.
- Modify: `js/roster-recommend-ui.js` (ghim), `css/styles.css` nếu cần.
- Create: `tests-js/roster-conflict-view.test.mjs`. Modify: `tests-e2e/beta-tools.spec.mjs`.
- Publish lại bản dịch (chuỗi `docs/deployment-guide.md:251-271`), re-pin `pipeline/team-route-handles.json`.
- Docs: `README.md` (Gợi ý đội), `docs/codebase-summary.md`, `docs/project-changelog.md`.

## TDD (đỏ trước)

`tests-js/roster-conflict-view.test.mjs` (dữ liệu thật qua helper ở `tests-js/roster-adapter-audit.test.mjs:404`):

1. Ví dụ issue: đúng 1 thẻ Ngô Nữ Kỵ, 2 chiến pháp bị tranh, 0 tướng, đội giữ hiển thị "40Y Lữ Bố Cung (Vương Dị, Pháp Chính)", không phải `og-bingyan-40y-lvbu-b`.
2. Kho không tranh chấp (ca "hết chỗ" ở `roster-adapter-audit.test.mjs:421`): view model rỗng.
3. Tranh tướng: thẻ liệt kê tướng kèm đội giữ.
4. Đội giữ là đội khóa: tên lấy từ `teamName`.
5. Id đội giữ không có trong danh mục: hiện nhãn dự phòng, không hiện id.
6. Hơn 5 xung đột: 5 thẻ + số đội ẩn.
7. zh: tên tướng chữ Hán, tên chiến pháp qua resolver zh.

E2E `tests-e2e/beta-tools.spec.mjs` (stub Turnstile và worker như `:24,60`):

8. Seed kho của issue, mở `/goi-y-doi-tu-kho/?season=og-兵演春秋` (ghim mùa, không dựa vào mùa mặc định): có tiêu đề mục mới, "Ngô Nữ Kỵ (Tinh·Hổ Báo Kỵ)", "T0", hai tên chiến pháp, "40Y Lữ Bố Cung", nút "Mở đội"; mục "Thiếu món" vẫn còn.
9. Kho không tranh chấp: không có mục.
10. `/zh/goi-y-doi-tu-kho/`: tiêu đề và tên bằng chữ Hán, không lẫn tên Việt.
11. Sau "Tôi có chiến pháp…" danh sách thẻ cập nhật.
12. Mobile 390px không tràn ngang; theme tối đọc được.

## Verification

```
node --test tests-js/roster-conflict-view.test.mjs
<chuỗi Publish lại bản dịch hiển thị>
python3 -m pipeline.team_route_handles --check
npm run build && npm run verify && npm run test:dist && npm run test:node
npx playwright test tests-e2e/beta-tools.spec.mjs -g "Gợi ý đội"
```

## Risks

- File JS mới thiếu trong `PUBLIC_ARTIFACTS` → lỗi trên `dist`; `runtime-asset-contract` và `astro-dist-contract` chặn.
- Ở chế độ "Nhiều hột" pool không lọc tier, nên thẻ có thể có bậc ngoài meta; hiển thị đúng bậc, không lọc thêm.
