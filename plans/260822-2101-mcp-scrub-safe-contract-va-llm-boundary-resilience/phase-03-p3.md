---
phase: 3
title: "Field-level validation errors (B3)"
status: pending
priority: P2
effort: "3h"
dependencies: [2]
---

# Phase 3: Field-level validation errors (B3)

## Overview

`INVALID_REQUEST` hiện trả `"Yêu cầu không hợp lệ."` trống trơn (`research-handlers.ts:306`, `publicMessage`). Agent không biết field nào sai nên bỏ cuộc, không retry — quan sát trực tiếp ở trace `01a0299d`. Bổ sung đường dẫn field vi phạm, không lộ giá trị.

## Requirements

**Functional**
- Lỗi validation liệt kê tên/đường dẫn field sai (vd `limit`, `heroes[0].tacticIds`).
- **Không** đưa giá trị người dùng gửi vào thông báo lỗi.
- Các mã lỗi khác (`WORKFLOW_VERSION_CHANGED`, `DATA_UNAVAILABLE`, `CURSOR_INVALID`) giữ nguyên nội dung.

**Non-functional**
- Thông báo tiếng Việt, đồng bộ giọng với `publicMessage` hiện có.
- Giới hạn số field liệt kê (đề xuất 5) để không phình response.

## Architecture

`research-handlers.ts:296-310` bắt lỗi zod và ném `ResearchHandlerError("INVALID_REQUEST", publicMessage("INVALID_REQUEST"))`. Zod 4.4.3 có `error.issues[].path` dạng `PropertyKey[]` — đã probe thực nghiệm: `{limit:"abc"}` thiếu `teamId` cho ra `[["limit"],["teamId"]]`. Chỉ cần join thành chuỗi, không phải viết thêm gì.

Path lồng nhau (vd `heroes[0].tacticIds`) là mảng hỗn hợp string/number — cần hàm format riêng, có test.

Cấu trúc `structuredContent.error` bổ sung `fields: string[]`, giữ nguyên `code`/`message`/`nextAction`/`retryable`. Đây là mở rộng cộng thêm, không phá client cũ.

Lý do không lộ giá trị: response đi thẳng vào context LLM và vào trace; giá trị có thể chứa dữ liệu người dùng dán vào.

## Related Code Files

- Modify: `src/research/research-handlers.ts` (296-310, và type `ResearchHandlerError` nếu cần mang thêm field)
- Modify: `src/research/research-contracts.ts` nếu output schema lỗi cần khai báo `fields`
- Modify: `src/mcp/format-result.ts` nếu nó tự dựng payload lỗi
- Modify: `test/research/research-handlers.test.ts`

## Implementation Steps (TDD)

1. **RED** — test: gửi `limit: "abc"` → lỗi chứa `"limit"`; gửi thiếu `teamId` → chứa `"teamId"`; nhiều field sai → liệt kê nhiều, tối đa 5.
2. **RED** — test bảo mật: giá trị gửi lên (vd chuỗi mốc `"SENTINEL_VALUE_XYZ"`) **không** xuất hiện ở bất kỳ đâu trong response.
3. **GREEN** — map `error.issues[].path` thành `fields`, nối vào message.
4. **RED/GREEN** — test các mã lỗi khác giữ nguyên message cũ.
5. Kiểm tay qua CLI: `search --input '{"query":"x","limit":"abc"}'` → lỗi nêu `limit`.

## Success Criteria

- [ ] Lỗi nêu đúng field cho ít nhất 3 tool khác nhau
- [ ] Test mốc: không giá trị input nào rò vào response
- [ ] Message các mã lỗi khác không đổi
- [ ] Số field liệt kê bị chặn trần

## Risk Assessment

**Lộ cấu trúc schema cho nội dung không tin cậy.** Tên field vốn đã công khai trong tool definition (`mcp/tool-definitions.ts`) nên không thêm thông tin gì mới. Chỉ giá trị mới nhạy cảm — đã có test mốc chặn.

**Response phình khi input sai hàng loạt.** Giảm thiểu: trần 5 field.
