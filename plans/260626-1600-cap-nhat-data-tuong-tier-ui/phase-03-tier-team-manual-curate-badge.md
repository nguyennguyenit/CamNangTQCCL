---
phase: 3
title: "Tier team manual curate + badge"
status: pending
priority: P2
effort: "4h"
dependencies: []
---

# Phase 3: Tier team manual curate + badge

## Overview
Gắn tier T0–T3 vào **team** (172 team) từ bảng curate thủ công, build ra `data/team-tier.json`, hiển thị badge ở card Team PK. Nguồn TQ rank đội hình nên đây là điểm gắn đúng.

## Requirements
- Functional: bảng `pipeline/team-tier-map.json` map **team `id`** → list `rankings:[{source, tier, updatedAt}]` (multi-source đối chiếu); build join vào team theo `id`; badge T0–T3 ở `render.js`; team thiếu tier không vỡ.
- Non-functional: nguồn chân lý manual (commit); build offline stdlib; **KHÔNG có field score/winRate** (đã cắt — research: thưa, YAGNI).

## Architecture
<!-- Updated: Validation Session 1 — khóa=id; storage=file riêng; multi-source rankings; cắt score/winRate -->
- **Khóa join = team `id`** (`team-intro-N`, verify: unique; `name` KHÔNG unique nên không dùng). Curator map tên đội TQ → `id` của ta.
- `pipeline/team-tier-map.json`: `{ "team-intro-0": [{"source":"zhihu/...","tier":"T0","updatedAt":"2026-..."}, ...], ... }` — mỗi team 1 list nhiều nguồn.
- `pipeline/build_team_tier.py`: đọc map + `teams.json` → ghi `data/team-tier.json` `[{teamId, rankings:[{source,tier,updatedAt}]}]`. Fail-loud nếu `id` trong map không tồn tại trong `teams.json` (chống typo).
- `js/app.js` load `team-tier.json`, build index `teamId→rankings`, truyền vào render.
- `js/render.js`: badge `.badge.tier.t-0..t-3`. **Quy tắc hiển thị khi nhiều nguồn lệch**: badge bậc **tốt nhất** (T số nhỏ nhất) + tooltip liệt kê tất cả `{source, tier, updatedAt}`. UI ghi "tham khảo".
- **[Audit A3] Tier có half-tier**: tập hợp lệ `{T0, T0.5, T1, T1.5, T2, T3}`. So sánh "tốt nhất" = parse `float(tier[1:])` lấy min. Build fail-loud nếu tier ngoài tập. CSS badge map T0.5→class `t-05` (tránh dấu chấm trong class).

## Related Code Files
- Create: `pipeline/team-tier-map.json`, `pipeline/build_team_tier.py`, `data/team-tier.json`, `tests/test_build_team_tier.py`, `tests-js/team-tier-badge.test.mjs`
- Modify: `js/app.js`, `js/render.js`, `css/styles.css`

## Implementation Steps (TDD)
0. **Spike đối chiếu**: đo % team map được tên đội TQ → `id` (≥1 nguồn). Curate map ban đầu ~20 team T0/T1, mỗi entry có ≥1 ranking nguồn.
1. **Test trước** (`tests/test_build_team_tier.py`): map (multi-source) + teams fixture → `team-tier.json` có `rankings` đúng; `id` map không khớp team → raise. Đỏ.
2. **Test trước** (`tests-js/team-tier-badge.test.mjs`): team nhiều nguồn lệch → badge bậc tốt nhất; tooltip đủ nguồn; không tier → không badge. Đỏ.
3. Viết `build_team_tier.py` → xanh; tạo `team-tier-map.json` (curate từ nguồn TQ đã chọn, có `source`+`updatedAt`).
4. Sửa `render.js` + `app.js` wiring → xanh.
5. CSS badge tier (4 bậc, accent khác sao/phe).
6. Chạy full test Python + JS.

## Success Criteria
- [ ] `data/team-tier.json` build sạch (`teamId`+`rankings[]`); `id` sai → fail-loud.
- [ ] Badge bậc tốt nhất hiện đúng; tooltip liệt kê mọi nguồn + ngày.
- [ ] Team thiếu tier render bình thường.
- [ ] Test Python + JS pass.

## Risk Assessment
- **% khớp tên đội TQ↔`teams.json` thấp** → spike bước 0 đo trước; nếu thấp, giới hạn phủ T0/T1 trước.
- **Nhiều nguồn lệch hạng** → quy tắc badge bậc tốt nhất + tooltip đủ nguồn để minh bạch.
- **Tier lỗi thời** → bắt buộc `updatedAt`+`source` mỗi ranking; UI ghi "tham khảo".
