---
phase: 2
title: Worker schema + prompt
status: completed
priority: P1
effort: 0.5d
dependencies:
  - 1
---

# Phase 2: Worker schema + prompt

## Overview
Cho Worker đọc **binh thư** (field `booksCn` riêng) và **đoán tướng từ chân dung khi tên vắng** (B0). Worker vẫn KHÔNG map Hán→Việt (site lo) — chỉ trả Hán + nguồn nhận diện.

## Requirements
- Functional: schema thêm `booksCn: string[]` mỗi hero; `VISION_PROMPT` (1) đọc binh thư vào `booksCn` (KHÔNG lẫn `tacticsCn`), (2) cho phép đoán tên tướng từ chân dung CHỈ khi không có tên in, đánh dấu để site hạ confidence.
- Non-functional: giữ tolerant parse + cap chống phình (`MAX_*`); backward-compatible (response cũ không có `booksCn` vẫn parse được → default `[]`).

## Architecture
- `schema.ts`: `HeroRead` thêm `booksCn: string[]`; `validateResult` parse `booksCn` (Array<string>, filter rỗng, slice `MAX_TACTICS`, `cut`); thiếu field → `[]` (không ném).
- Đoán-từ-chân-dung: phương án KISS = thêm cờ optional `nameFromPortrait?: boolean` mỗi hero; site dùng để ép confidence xuống "low" + cờ ⚠. (Nếu thêm field rủi ro prompt phức tạp → tối thiểu chỉ cần nới prompt; cờ là tăng cường.)
- `model.ts` `VISION_PROMPT`: gỡ "không đoán tên tướng từ chân dung, icon"; thêm: "nếu cột không có tên in rõ, có thể suy đoán tướng từ chân dung và đặt nameFromPortrait=true; vẫn ưu tiên tên in". Thêm "đọc binh thư (dòng vàng 三军之众/统军/锤炼...) vào booksCn, KHÔNG vào tacticsCn".

## Related Code Files
- Modify: `worker/src/schema.ts`, `worker/src/model.ts`, `worker/test/schema.test.ts`, `worker/test/model.test.ts`
- Reference: `worker/src/index.ts` (handler — kiểm tra không vỡ shape trả về)

## Implementation Steps (TDD)
1. **Test trước** `worker/test/schema.test.ts`: (a) parse JSON có `booksCn` → giữ đúng mảng; (b) JSON KHÔNG có `booksCn` → `booksCn=[]` (backward-compat); (c) cap `booksCn` quá dài bị cắt; (d) `nameFromPortrait` parse đúng nếu thêm. Chạy đỏ phần mới.
2. Sửa `schema.ts`: thêm field + validate như trên.
3. **Test** `worker/test/model.test.ts`: assert `VISION_PROMPT` chứa hướng dẫn binh thư→booksCn + cho phép đoán chân dung (regression guard chống lỡ tay revert); `buildRequestBody` shape không đổi.
4. Sửa `model.ts` `VISION_PROMPT`.
5. `cd worker && npm test && npm run typecheck` xanh.

## Success Criteria
- [ ] `worker/test/*.ts` xanh; `npm run typecheck` sạch.
- [ ] Response thiếu `booksCn` vẫn validate (default `[]`) — không phá client cũ.
- [ ] Prompt cho binh thư vào `booksCn`, không vào `tacticsCn`; cho đoán chân dung khi tên vắng.

## Risk Assessment
- **[RED-TEAM] `nameFromPortrait` rò rỉ**: model có thể đoán tên từ chân dung mà KHÔNG set cờ → lọt thành tên-in confidence cao → auto-accept sai âm thầm. Giảm nhẹ tự nhiên: matchDict yêu cầu tên khớp heroes-dict (tên bịa rớt ngưỡng). Rủi ro còn lại: đoán nhầm 1 tướng có thật → precision giảm. Cân nhắc test prompt + theo dõi; nếu precision tụt rõ → thu hẹp B0.
- **Hallucination tướng từ chân dung**: bù ở site (P3) — `nameFromPortrait`/low-conf → cờ ⚠, không auto-accept. Prompt vẫn "ưu tiên tên in".
- **Vision nhầm binh chủng↔binh thư**: prompt nêu ví dụ binh thư rõ; dict P1 không chứa binh chủng nên nhầm sẽ rớt ngưỡng match.
- **Rollback**: revert 2 file; field `booksCn` optional nên client cũ/mới đều an toàn.
