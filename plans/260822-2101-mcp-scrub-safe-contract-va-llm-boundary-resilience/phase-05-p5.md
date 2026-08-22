---
phase: 5
title: "Full verification gate (B5)"
status: completed
priority: P1
effort: "3h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Full verification gate (B5)

## Overview

Chạy toàn bộ cổng kiểm tra của repo, xác nhận không hồi quy integrity/release/security, và khoá lại invariant chính bằng bằng chứng chạy thật.

## Requirements

- Toàn bộ `npm run check` xanh.
- Test worker (workerd) xanh.
- Không hồi quy hợp đồng release và toàn vẹn artifact.
- Có bằng chứng black-box qua CLI, không chỉ unit test.

## Architecture

`npm run check` = `check:workflow-build` → `check:local-secrets` → `test:coverage` → `typecheck` → `typecheck:worker` → `build` → `test:node-min` → `verify:control-plane`.

Test worker chạy riêng: `npm run test:worker` (2 config: `vitest.worker.config.ts` + `vitest.worker-production.config.ts`).

Nhóm test dễ hồi quy nhất sau Phase 1: `test/release/*` (7 file), `test/security/*` (6 file), `test/transport/all-tools-parity.test.ts`, `test/e2e/team-research-workflow.test.ts`.

Hai test là **neo bắt buộc xanh**, đỏ là dấu hiệu sai thiết kế chứ không phải assert lỗi thời:
- `test/e2e/team-research-workflow.test.ts:56` — `releaseId` khớp `/^sha256:[a-f0-9]{64}$/u`; chứng minh Phase 1 không đụng nhầm trường toàn vẹn.
- `test/security/import-boundaries.test.ts` — không `node:*` nào lọt vào closure của `src/worker.ts`; chứng minh `digest-encoding.ts` dùng Web API chứ không dùng `Buffer`.

## Related Code Files

- Không sửa code sản phẩm trong phase này. Chỉ sửa test nếu phát hiện assert sai do đổi hợp đồng có chủ đích ở Phase 1 — mỗi lần sửa test phải ghi lý do vào commit message.

## Implementation Steps

1. `npm run test:coverage` — soi riêng `test/release/`, `test/security/`, `test/transport/`.
2. `npm run typecheck && npm run typecheck:worker`.
3. `npm run check:workflow-build` — file generated phải khớp, không diff.
4. `npm run test:worker` — cả 2 config.
5. `npm run verify:release` và `npm run build:worker-assets` — xác nhận `releaseId` vẫn `sha256:<64hex>` và integrity check không đổi.
6. `npm run check` — chạy trọn chuỗi.
7. Black-box CLI, ghi lại output làm bằng chứng:
   - `version` → `workflowVersion` không chứa hex ≥64
   - `team` với `expectedWorkflowVersion` lấy từ bước trên → OK, trả `Vũ Tung Úc`
   - `search` với args stringify → OK, có `matchedTerm`
   - `search --input '{"query":"x","limit":"abc"}'` → lỗi nêu `limit`
8. Đo chuỗi `workflowVersion`: phải < 64 ký tự mỗi thành phần, và toàn chuỗi không khớp `/[a-fA-F0-9]{64,}/`.

## Success Criteria

- [x] `npm run check` exit 0
- [x] `npm run test:worker` xanh cả 2 config
- [x] `verify:release` xanh, `releaseId` vẫn hex 64
- [x] 4 lệnh CLI black-box cho đúng kết quả kỳ vọng
- [x] Guard test Phase 1 vẫn xanh sau khi mọi phase đã merge
- [x] Không test nào bị sửa để cho qua mà không có lý do ghi trong commit

## Risk Assessment

**Cám dỗ sửa test cho xanh.** Phase 1 đổi hợp đồng công khai nên một số assert sẽ đỏ hợp lệ. Ranh giới: chỉ sửa assert về **định dạng chuỗi digest**. Bất kỳ test nào đỏ về **ngữ nghĩa** (verify binding, integrity, auth, giới hạn request) là dấu hiệu sai thiết kế → dừng và replan, không sửa test.

**Test worker cần môi trường workerd.** Nếu không chạy được cục bộ, đó là blocker thật, không được bỏ qua — ghi lại và báo trước khi tuyên bố hoàn thành.

**Ngoài phạm vi:** e2e thật qua dewee (gửi lại 5 prompt gốc cho agent `tra`) thuộc hạng mục A5, cần dewee đã sửa. Không tính vào tiêu chí hoàn thành của plan này.
