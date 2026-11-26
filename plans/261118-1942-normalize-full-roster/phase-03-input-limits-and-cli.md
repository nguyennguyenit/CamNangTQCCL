---
phase: 3
title: "Trần đầu vào, CLI file/stdin, ngân sách"
status: completed
priority: P1
effort: "6h"
dependencies: [2]
---

# Phase 3: Trần đầu vào, CLI file/stdin, ngân sách
<!-- Updated: Red Team 2026-11-19 - trần lấy từ số đo phase 1, CLI đọc async có giới hạn, test HTTP trên production workerd, ngân sách normalize -->

## Goal
Kho thật (≥ 238 mục, gửi tên) đi qua schema, CLI, stdio và HTTP; trần đầu vào/đầu ra khớp nhau và có ngân sách CPU.

## Decisions
- `MAX_NORMALIZE_OBSERVATIONS` = **300**, `MAX_NORMALIZE_REQUEST_BYTES` = **60 770 B** (`1,07 × byte + 512 ≤ 65 536`), chốt ở phase 1 (Validation Session 2). Đặt thành hằng có tên trong `shared-schemas.ts`, dùng ở `research-contracts.ts:15-18`. Bảo đảm kích thước: ≤ 300 mục với ≤ 40 mục chưa rõ (tỉ lệ tướng/chiến pháp như kho thật) lọt 40 000 ký tự; vượt → `RESULT_TOO_LARGE` có kiểu. `PUBLIC_ERRORS.RESULT_TOO_LARGE.nextAction` (`handler-error.ts:45`) thêm hướng dẫn cho normalize (sửa/bỏ mục chưa rõ hoặc gửi ít mục hơn).
- `warnings` (state và kết quả, max 100): khi > 100 gộp theo loại thành đếm (`conflicting-redStars:150`) trong `summarizeWarnings`; giữ max 100, không nâng schema. Đo: 300 mục ảnh lệch redStars/level cho 300 cảnh báo → gộp còn 2.
- CLI: `--input-file <path>` và `--input -` (stdin), loại trừ lẫn nhau với `--input '<json>'`. Đọc async ngoài `parseCliArgs`: file phải là regular file (từ chối FIFO/thiết bị), đọc theo chunk dừng ở 256 KiB + 1; stdin qua `CliIo.stdin` cũng đọc có giới hạn; UTF-8 không BOM, BOM/sai UTF-8 → `CLI_USAGE`.
- Không đổi `TQCCL_MCP_MAX_BODY_BYTES`, `MAX_RESULT_BYTES`, `TQCCL_MCP_MAX_RESULT_BYTES`.

## Files to Create / Modify
- Modify: `mcp-worker/src/research/shared-schemas.ts`, `research-contracts.ts`, `src/domain/normalization-service.ts` (chỉ nếu gộp cảnh báo; không đổi digest).
- Modify: `mcp-worker/src/cli.ts` (`CliIo` thêm `stdin`, đọc input async, usage `:114`).
- Modify tests: `test/research/research-handlers.test.ts:129-147` (tách: N+1 mục → `INVALID_REQUEST`; vượt byte → `INVALID_REQUEST`), `test/cli.integration.test.ts:10,62-80`, `test/transport/season-tools-parity.test.ts:63,103`.
- Modify: `test/performance/worker-budget.workerd.test.ts` (chạy bằng `vitest.worker-production.config.ts`, data thật) thêm `normalizeMs` và `recommendMs` kho đầy đủ.
- Regenerate: `src/generated/workflow-build.ts`.

## Tests Before
1. Handler: đúng N mục ngắn → OK; N+1 → `INVALID_REQUEST`; byte vượt → `INVALID_REQUEST`.
2. Kích thước bảo đảm: 300 mục tỉ lệ thật (93:145) trong đó 40 chưa rõ (ambiguous/unknown, candidates thật từ catalog) → kết quả < 40 000 ký tự và ≤ 43 008 B, `formatToolResult` ≤ 98 304 B. Ca toàn tên sai 300 mục → `RESULT_TOO_LARGE` (không `INTERNAL_ERROR`), nextAction có hướng dẫn normalize.
3. Phase 1 test 1 đảo: biến thể (a) 238 mục và (b) 238+25 → thành công; `normalize → recommend` trả đội có tên catalog (không chỉ "không lỗi").
4. Cảnh báo tối đa: N mục ảnh trùng hero với `redStars`/`level` lệch → không `INTERNAL_ERROR`, output parse.
5. CLI: `--input-file`/`--input -` cho kết quả byte-giống `--input`; file > 256 KiB, FIFO/không phải regular file, stdin vượt trần, BOM, cả hai option → `CLI_USAGE`.
6. HTTP (production workerd): request đúng trần byte, escape ASCII toàn bộ, kèm `_meta` → 200; vượt → lỗi đã ghi trong docs (413 hoặc `INVALID_REQUEST`, khẳng định cụ thể).
7. Ngân sách: `normalizeMs` (tên, N mục) và `recommendMs` (kho 238, fullBox) dưới ngưỡng ghi trong test (ngưỡng từ số đo phase 1 + biên).

## Regression Gate
- `cd mcp-worker && npm run check:workflow-build && npm test && npm run test:stdio && npm run test:worker && npx vitest run -c vitest.worker-production.config.ts && npm run typecheck`
- `rg "it\.(fails|skip|todo)" mcp-worker/test/research/normalize-full-roster.test.ts` rỗng.

## Success Criteria
- Test 1–7 xanh; fixture chạy normalize → recommend qua CLI `--input -`.

## Risk Assessment
- Ngân sách vượt trên workerd: dừng, replan (hạ trần hoặc tối ưu tra tên), không nâng ngưỡng âm thầm.
- Người chơi > N mục: lỗi `INVALID_REQUEST` rõ; tqccl-auto chặn trước bằng `roster_too_large` (phase 4).
