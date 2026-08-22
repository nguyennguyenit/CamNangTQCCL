---
phase: 2
title: "LLM-boundary input coercion (B2)"
status: pending
priority: P1
effort: "3h"
dependencies: [1]
---

# Phase 2: LLM-boundary input coercion (B2)

## Overview

Chấp nhận args bị model stringify (`{"kinds":"[\"team\"]","limit":"5"}`) mà không nới lỏng kiểm tra hợp lệ. Chỉ coerce tại biên tool, domain giữ nguyên kiểu chặt.

## Requirements

**Functional**
- `limit` nhận `"5"` và `5`, vẫn từ chối `"abc"`, `0`, `51`, `5.5`.
- `kinds` nhận `["team"]` và `"[\"team\"]"`, vẫn từ chối `"[\"bogus\"]"`, `"not json"`, mảng >4 phần tử.
- Hành vi với input đúng kiểu không đổi một chút nào.

**Non-functional**
- Coerce chỉ ở `research-contracts.ts` tại schema input của tool. Không rò rỉ kiểu lỏng vào `domain/`.
- Không nuốt lỗi: JSON hỏng phải thành `INVALID_REQUEST`, không thành mảng rỗng.

## Architecture

Bằng chứng: trace `01a0299d-70ff-702e-afad-3ce5dd98a454` — model gửi `kinds` là JSON-string, `limit` là string, MCP trả `INVALID_REQUEST`, agent bỏ cuộc không retry. Không tất định: trace 15:09 cùng model gửi đúng kiểu. Đây là đặc tính cố hữu của biên LLM, không phải bug một lần.

Helper dùng chung trong `research-contracts.ts` (cả 8 tool đều có thể hưởng):

```ts
// Model thỉnh thoảng serialize mảng/số thành string. Parse ở biên,
// giữ nguyên schema chặt bên trong để lỗi thật vẫn bị bắt.
const jsonArrayish = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  }, inner);
```

`limit` → `z.coerce.number().int().min(1).max(50).optional()`.

**Zod trong repo là 4.4.3** (`package.json:49`), không phải v3 — API khác ở vài chỗ. Đã probe thực nghiệm bằng chính zod của repo, 13/13 case đúng như thiết kế:

| Input | `limit` | Input | `kinds` |
|---|---|---|---|
| `undefined` | OK `undefined` | `undefined` | OK `undefined` |
| `5` | OK `5` | `["team"]` | OK |
| `"5"` | OK `5` | `"[\"team\"]"` | OK, parse thành mảng |
| `"abc"` | REJECT | `"[\"bogus\"]"` | REJECT |
| `""` | REJECT | `"notjson"` | REJECT |
| `0` / `51` / `5.5` | REJECT | | |

Hai điểm quan trọng đã được chứng thực, không cần đoán:
- `z.coerce.number().optional()` với `undefined` trả `undefined`, **không** thành `NaN` (footgun quen thuộc của zod không xảy ra ở 4.4.3). Vẫn giữ case này trong bảng test để khoá lại.
- `error.issues[].path` trả `[["limit"]]` — đúng thứ Phase 3 cần, không phải làm thêm gì.

`boundedRequest` (`research-contracts.ts:88-107`) bọc schema bằng `.superRefine` để check byte limit, chạy **sau** khi object schema parse xong nên `z.preprocess` bên trong field không bị ảnh hưởng.

## Related Code Files

- Modify: `src/research/research-contracts.ts` (495-519 `searchInputSchema`, thêm helper cạnh `boundedRequest`)
- Modify: `test/research/research-handlers.test.ts`
- Chỉ comment, **không** sửa: `matchInputSchema` (`heroes[].tacticIds`), `recommendationInputSchema` — chưa có bằng chứng model gửi sai kiểu ở đây

## Implementation Steps (TDD)

1. **RED** — test bảng cho `tqccl_search`: `limit` là `"5"`/`5`/`"abc"`/`0`/`51`/`""`; `kinds` là `["team"]`/`"[\"team\"]"`/`"[\"bogus\"]"`/`"khong-phai-json"`.
2. **GREEN** — thêm helper + áp vào `searchInputSchema`.
3. **RED** — test hồi quy: input đúng kiểu cho ra kết quả **giống hệt** trước khi sửa (so cả `items` lẫn `dataVersion`).
4. **REFACTOR** — rà các schema input còn lại và **không** áp helper (quyết định validation gate: chỉ áp nơi có bằng chứng lỗi). Ghi comment ngắn tại `matchInputSchema` và `recommendationInputSchema` nói rõ lý do bỏ qua, để lần sau ai gặp lỗi tương tự biết chỗ cần sửa.
5. Chạy black-box qua CLI: `node --import tsx src/cli.ts search --input '{"query":"Hoàng Quan Thương","kinds":"[\"team\"]","limit":"5"}' --data-root ../data` → phải ra `team:team-intro-2`.

## Success Criteria

- [ ] Bảng test coercion xanh, gồm cả nhánh từ chối
- [ ] Input đúng kiểu: kết quả không đổi
- [ ] CLI black-box với args stringify trả đúng `Vũ Tung Úc`
- [ ] Không kiểu lỏng nào lọt vào `src/domain/` (kiểm bằng `npm run typecheck`)

## Risk Assessment

**Coerce quá tay che mất lỗi thật.** Nếu `z.coerce` nuốt input rác thành giá trị hợp lệ, agent sẽ nhận kết quả sai thay vì lỗi rõ ràng. Tín hiệu: test nhánh từ chối chuyển xanh sai (`"abc"` không còn bị chặn). Phản ứng: bỏ `coerce`, tự viết `preprocess` chỉ nhận chuỗi khớp `/^\d+$/`.

**Phạm vi hẹp có thể để sót.** Nếu model stringify args của `match_team` hay `recommend_team`, lỗi sẽ tái diễn ở đó. Tín hiệu: trace mới có `INVALID_REQUEST` trên các tool đó. Phản ứng: áp helper cho đúng schema đó, không mở rộng đại trà.
