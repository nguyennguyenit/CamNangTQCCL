---
phase: 3
title: "Phase 3: Đọc kho và tính độ phủ cho danh sách"
status: todo
priority: P1
effort: "4h"
dependencies: [2]
---

# Phase 3: Đọc kho và tính độ phủ cho danh sách

## Goal

Có một module thuần cho trang danh sách: đọc kho từ máy, tính độ phủ theo `sourceConfigId`, và lọc/sắp hàng theo độ phủ qua tham số `kho` và `xep`.

## Files to Create / Modify

- Create: `js/roster-list-coverage.js` (không có chữ UI)
- Create: `tests-js/roster-list-coverage.test.mjs`
- Modify: `js/recommended-reference-state.js` (đọc/ghi `kho`, `xep`; `projectRecommendedRows` nhận độ phủ)
- Modify: test node hiện có của `recommended-reference-state` (thêm ca mới)
- Modify: `src/lib/public-artifact-manifest.mjs` (khai báo module mới như các module `js` khác)

## Hợp đồng

```js
// null khi máy không có kho (hoặc kho không có tướng lẫn chiến pháp).
readOwnedRoster(storage) -> { ownedHeroes, ownedTactics, source: "cloud" | "local" } | null

buildListCoverage({ records, seasonId, heroesDict, tacticsDict, roster })
  -> { byConfigId: Map<string, { missingCount, missing }>, summary: { complete, total } }
```

- `readOwnedRoster` theo luật đã chốt ở phase 1; dùng `toScanState(state, MAIN_BOX_ID)` cho cache cloud và `deserializeRosterScanState` cho kho local. Lỗi storage hoặc JSON hỏng trả `null`, không ném.
- `buildListCoverage` gọi `buildSeasonCandidates` rồi `buildRosterCoverage` với cùng bộ đối chiếu chiến pháp mà Gợi ý đội dùng (`createTacticIdResolver`), không áp `tacticOverrides`.
- `summary.total` là số đội có trong `byConfigId`; `summary.complete` là số đội có `missingCount === 0`.
- Query: `kho` nhận `rap-duoc` hoặc `thieu-2`; `xep` nhận `de-rap`. Chỉ có nghĩa với họ `recommended`; giá trị lạ hoặc lặp bị bỏ kèm canonical hóa URL như `view`.
- `projectRecommendedRows(rows, state, labels, coverage?)`: không có `coverage` thì kết quả y hệt hiện nay. Có `coverage`: `kho=rap-duoc` giữ hàng `missingCount === 0`; `kho=thieu-2` giữ hàng `missingCount <= 2`; hàng không có độ phủ bị loại khi đang lọc theo kho. `xep=de-rap` sắp theo `missingCount` tăng dần rồi tới `fixedRank`; hàng không có độ phủ đứng sau. Nhóm theo bậc giữ nguyên ở tầng render.

## Tests Before

Viết trước, phải đỏ:

1. `readOwnedRoster`: storage rỗng → `null`; chỉ kho local → `source: "local"`; có cache cloud hộp `main` → `source: "cloud"`; JSON hỏng → `null`.
2. `buildListCoverage`: với fixture mùa nhỏ, `byConfigId` có đúng khóa `sourceConfigId` của hạng mục Giao chiến; đội ngoài hạng mục và đội chưa đối chiếu tướng không có khóa.
3. Khớp Độ phủ kho: `summary.complete` bằng tổng `tiers[].complete.length` của `buildRosterCoverage` trên cùng đầu vào.
4. Query: đọc `?kho=rap-duoc&xep=de-rap`; bỏ `?kho=abc`; `?sort=x` vẫn bị gỡ như cũ.
5. `projectRecommendedRows`: không truyền `coverage` cho kết quả trùng snapshot hiện tại; ba ca lọc/sắp ở trên.

## Refactor

Thêm `kho` và `xep` vào danh sách scalar của `readRecommendedQuery` và hàm ghi URL tương ứng; thêm tham số thứ tư cho `projectRecommendedRows`.

## Tests After

Test hiện có của `recommended-reference-state` và `roster-season-candidates` vẫn xanh.

## Regression gate

`npm run test:node`.

## Success Criteria

- [x] Module mới không import DOM, không có chuỗi hiển thị.
- [x] Ca "không truyền coverage" chứng minh hành vi cũ không đổi.
- [x] `summary.complete` khớp khối Độ phủ kho trên cùng fixture.
