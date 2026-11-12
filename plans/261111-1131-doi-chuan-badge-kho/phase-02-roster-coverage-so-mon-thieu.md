---
phase: 2
title: "Phase 2: roster-coverage trả số món thiếu từng đội"
status: todo
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: roster-coverage trả số món thiếu từng đội

## Goal

`buildRosterCoverage` trả thêm danh sách mọi đội kèm số món thiếu và các món thiếu, không đổi kết quả hiện có.

## Files to Create / Modify

- Modify: `js/roster-coverage.js`
- Modify: `tests-js/roster-coverage.test.mjs`

## Hợp đồng

Thêm khóa `teams` vào giá trị trả về:

```js
teams: [{ team, tier, missingCount, missing: [{ kind: "hero" | "tactic", name, unresolved?: true }] }]
```

- Thứ tự `teams` theo thứ tự `seasonTeams` đầu vào.
- `missing` dùng đúng luật hiện tại: ô `unresolved` luôn tính là thiếu; ô có phương án thay thì đủ khi kho có một phương án.
- `tiers`, `progress`, `unmapped` giữ nguyên hình dạng và giá trị.

## Tests Before

Viết trước, phải đỏ:

1. Đội đủ kho: `missingCount === 0`, `missing` rỗng.
2. Đội thiếu 1 tướng và 2 chiến pháp: `missingCount === 3`, đúng `kind` và `name` từng món, đúng thứ tự ô.
3. Ô chiến pháp `unresolved`: tính thiếu, có `unresolved: true`.
4. Bất biến với kết quả cũ: tập đội có `missingCount === 0` trùng hợp của `tiers[].complete`; tập đội có `missingCount === 1` trùng `tiers[].missingOne`.
5. Kho rỗng: mọi đội có `missingCount` bằng số ô có tên.

## Refactor

Trong vòng lặp hiện có, đẩy `{ team, tier, missingCount, missing }` vào mảng `teams`; dùng chung một hàm đổi ô thiếu sang `{ kind, name, unresolved }` cho cả `missingOne` và `teams`.

## Tests After

Toàn bộ test cũ của `tests-js/roster-coverage.test.mjs` vẫn xanh, không sửa assertion cũ.

## Regression gate

`node --experimental-strip-types --test tests-js/roster-coverage.test.mjs` rồi `npm run test:node`.

## Success Criteria

- [x] Năm test mới đỏ trước khi sửa, xanh sau khi sửa.
- [x] Không test cũ nào bị đổi.
- [x] `js/roster-recommend-ui.js` không cần sửa ở phase này.
