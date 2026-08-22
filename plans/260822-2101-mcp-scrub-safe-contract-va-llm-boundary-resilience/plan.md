---
title: "MCP scrub-safe contract va LLM-boundary resilience"
description: "Loai bo digest 64-hex khoi moi truong client phai echo, va lam bien LLM cua tqccl chiu duoc input sai kieu"
status: completed
priority: P1
effort: "2-3d"
tags: [mcp-worker, contract, llm-boundary, tdd]
created: 2026-08-22
blockedBy: []
blocks: []
---

# MCP scrub-safe contract và LLM-boundary resilience

Repo: `mcp-worker/` — hạng mục B1→B5 trong `plans/reports/debug-260822-1917-dewee-tqccl-trace-bug.md`.

## Overview

Điều tra ngày 2026-08-22 cho thấy 5 tool của tqccl hỏng 100% khi gọi qua dewee: gateway scrub mọi chuỗi hex ≥64 ký tự trước khi trả cho LLM (`dewee-src/internal/tools/scrub.go:36`), nên `workflowVersion` model nhận được là `workflow:sha256:[REDACTED]:build:sha256:[REDACTED]`. Model echo lại chuỗi hỏng → `WORKFLOW_VERSION_CHANGED` vĩnh viễn.

Plan này **không** sửa dewee (đó là hạng mục A, repo riêng, làm song song). Plan này làm hợp đồng MCP không còn phụ thuộc vào việc client có scrub hay không, và vá 3 chỗ khác ở biên LLM đã lộ ra trong cùng đợt điều tra.

Nguyên tắc xuyên suốt: **mọi giá trị client phải echo lại đều không được chứa chuỗi hex ≥64 ký tự.** Giá trị dùng cho toàn vẹn (`releaseId`) giữ nguyên sha256 hex đầy đủ vì không ai echo nó.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Không token client-echo nào chứa hex ≥64 ký tự, giữ nguyên 256-bit collision resistance | P1 |
| 2 | Biên LLM chấp nhận args bị stringify mà không mất kiểm tra hợp lệ | P1 |
| 3 | Lỗi validation nêu được field sai để agent tự sửa | P2 |
| 4 | Kết quả search cho biết vì sao khớp (alias/nickname) | P2 |
| 5 | Không hồi quy: integrity, release verify, security tests còn nguyên | P1 |

## Non-goals

- Không sửa `dewee-src` (hạng mục A).
- Không đổi `releaseId` sang dạng ngắn — nó là digest toàn vẹn thật (`artifact-contracts.ts:308,471`, `release/worker-release-evidence.ts:131` ép `SHA256_PATTERN`).
- Không nới lỏng auth, rate limit, hay giới hạn kích thước request.
- Không sửa prompt agent `tra` (hạng mục C).

## Bối cảnh kỹ thuật

Các trường **client phải echo lại** (đều đang là hex 64):

| Trường | Nơi định nghĩa | Tool tiêu thụ |
|---|---|---|
| `expectedWorkflowVersion` | `research-contracts.ts:14-20`, `:413-419` | get_team, match_team, recommend_team, recommend_coexist, suggest_replacements |
| `confirmationBinding.workflowVersion` | `research-contracts.ts:112-114` | recommend_team, recommend_coexist, suggest_replacements |
| `confirmationBinding.normalizationDigest` | `research-contracts.ts:115-119` | recommend_team, recommend_coexist, suggest_replacements |

**KHÔNG** phải client-echo (chỉ xuất, không ai gửi lại): `releaseId` (`commonResultSchema:377-380`) và artifact `sha256` (`versionOutputSchema:462`). Hai trường này vẫn bị dewee redact nhưng đó chỉ là bất tiện hiển thị — không tool nào yêu cầu echo chúng, nên không gây lỗi. Giữ nguyên hex 64 cho toàn vẹn.

Sinh ra tại: `domain/canonical-state.ts:191` (`createNormalizationDigest`), `:204` (`createWorkflowVersion`), `src/generated/workflow-build.ts` (`WORKFLOW_BUILD_ID`, sinh bởi `scripts/generate-workflow-build.ts`).

Tiền lệ đã có trong repo: `dataVersion: /^data:[a-f0-9]{12}$/` (`research-contracts.ts:381-384`) — nhãn ngắn tách khỏi `releaseId` đầy đủ. `dataVersion` sống sót qua scrub của dewee trong khi `releaseId` thì không, đã xác nhận bằng trace thật.

### Quyết định thiết kế: base64url, không cắt ngắn

Cắt ngắn xuống 12-16 hex sẽ dodge được scrub nhưng hạ collision resistance của `normalizationDigest` — trường này là **binding bảo mật** (`canonical-state.ts:213-230` `verifyConfirmationBinding` ràng recommendation vào đúng canonical state đã rà soát). Base64url giữ trọn 256 bit và chỉ dài 43 ký tự.

Đã probe thực tế qua `ScrubCredentials` của dewee: base64url 43 ký tự → CLEAN; hex 64 → SCRUBBED. Xem Phần 2 của report điều tra.

Dùng prefix riêng `sha256b64:` thay vì tái dùng `sha256:` để không ai giả định thân chuỗi là hex.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Scrub-safe digest encoding (B1)](./phase-01-start.md) | Completed |
| 2 | [Phase 2: LLM-boundary input coercion (B2)](./phase-02-p2.md) | Completed |
| 3 | [Phase 3: Field-level validation errors (B3)](./phase-03-p3.md) | Completed |
| 4 | [Phase 4: Search match provenance (B4)](./phase-04-p4.md) | Completed |
| 5 | [Phase 5: Full verification gate (B5)](./phase-05-p5.md) | Completed |

Phase 2/3/4 độc lập về logic với Phase 1 nhưng cùng đụng `research-contracts.ts` → chạy tuần tự để tránh xung đột. Phase 5 phụ thuộc cả 4.

## Success Criteria

- [x] Guard test: không response nào của 8 tool chứa chuỗi khớp `[a-fA-F0-9]{64,}` ở trường client-echo
- [x] `releaseId` vẫn là `sha256:<64hex>` đầy đủ; `verify:release` và `build:worker-assets` xanh
- [x] `tqccl_search` nhận `{"kinds":"[\"team\"]","limit":"5"}` và trả kết quả đúng
- [x] Lỗi `INVALID_REQUEST` nêu tên field sai, không lộ giá trị
- [x] Search item có `matchedTerm`; query "Hoàng Quan Thương" trả `Vũ Tung Úc` kèm `matchedTerm` là nickname
- [x] `npm run check` xanh toàn bộ

## Rollback

Mỗi phase là một commit độc lập, revert được riêng. Phase 1 đổi hợp đồng công khai: revert sẽ làm client đang giữ token mới nhận `WORKFLOW_VERSION_CHANGED` một lần rồi tự phục hồi sau khi gọi lại `tqccl_get_data_version` — đúng hành vi thiết kế của staleness guard, không mất dữ liệu.

## Quyết định đã chốt (validation gate, 2026-08-22)

- **B1 làm đầy đủ**, không hoãn. Lý do: hợp đồng MCP hết phụ thuộc vào việc client có scrub hay không; sửa dewee bên A không bảo vệ được client thứ hai.
- **Cắt thẳng, không dual-accept.** Không có client bên thứ ba ngoài dewee. Client giữ token cũ nhận `WORKFLOW_VERSION_CHANGED` một lần rồi tự phục hồi — đúng hành vi thiết kế của staleness guard. Dual-accept sẽ làm yếu chính invariant mà guard test đang khoá.
- **Phase 2 chỉ áp coercion nơi đã có bằng chứng lỗi** (`searchInputSchema`: `kinds`, `limit`). Schema khác ghi comment lý do bỏ qua thay vì nới lỏng phòng xa.

## Open questions

- `suggest_replacements` chưa có bằng chứng được gọi thật lần nào trong trace. Vẫn sửa vì cùng class bug, nhưng ưu tiên kiểm thử thấp hơn `get_team`.

<!-- slug: mcp-scrub-safe-contract-va-llm-boundary-resilience -->

## Kết quả thực thi (2026-08-22)

Branch `feat/mcp-scrub-safe-contract`, worktree `../worktrees/mcp-scrub-safe-contract/CamNangTQCCL`.

| Cổng | Kết quả |
|---|---|
| `npm run check` | exit 0 (Node 22.16.0, đúng pin `.node-version`) |
| `npm run test:worker` | xanh cả 2 config |
| `npm run build:worker-assets` | xanh, `releaseId` vẫn `sha256:<64hex>` |
| Test suite | 302 test / 37 file, xanh |

Bằng chứng black-box qua MCP Client thật (`InMemoryTransport`):

- `workflowVersion` = `workflow:sha256b64:<43>:build:sha256b64:<43>`, không khớp `/[a-fA-F0-9]{64,}/`
- `tqccl_get_team` với `expectedWorkflowVersion` vừa nhận → `Vũ Tung Úc`
- `tqccl_search` với `{"kinds":"[\"team\"]","limit":"5"}` → `team:team-intro-2`, `matchedTerm: "Hoàng Quan Thương"`
- `limit: "abc"` → `INVALID_REQUEST`, `fields: ["limit"]`, không rò khoá/giá trị client gửi

`npm run verify:release` cần endpoint và bearer live nên không chạy được cục bộ; nó thất bại y hệt trên `main`, không phải hồi quy. Logic đã đổi của nó do `test/release/verify-release.test.ts` phủ.

### Sai lệch so với plan

- **`z.coerce.number()` bị loại.** Probe thực tế cho thấy nó nhận `true`→1, `["3"]`→3, `"0x10"`→16, `"1e1"`→10 — đúng rủi ro "coerce quá tay che mất lỗi thật" mà Phase 2 đã lường. Dùng phương án dự phòng đã ghi sẵn trong plan: `preprocess` chỉ nhận chuỗi khớp `/^\d+$/`.
- **Phase 3 phải mở rộng sang `create-mcp-server.ts`.** Plan giả định lỗi validation phát sinh trong handler. Thực tế SDK validate arguments trước, nên handler không chạy và danh sách field bị mất đúng ở biên MCP — biên duy nhất mà trace ghi nhận sự cố. Đã vá tại error boundary bằng cách parse lại raw arguments với schema của tool.
- **`build:sha256b64:` chạm thêm 2 file ngoài dự kiến.** `src/release/worker-release-evidence.ts` và `scripts/verify-release.ts` khoá `WORKFLOW_BUILD_PATTERN` theo hex; plan ghi "không đụng worker-release-evidence" nhưng ràng buộc đó nói về `releaseId`, còn build id thì buộc phải theo.
- **`generate:workflow-build` chuyển sang `tsx`.** `--experimental-strip-types` không resolve được import `.js`→`.ts`, nên không dùng chung được hàm mã hoá. Chuyển sang tsx theo đúng quy ước sẵn có của mọi script khác trong repo, thay vì nhân bản logic mã hoá.

### Câu hỏi chưa giải quyết

- Giả định "base64url thoát được mọi scrub của client" mới chỉ chứng thực với dewee. Cần xác nhận bằng trace thật sau khi deploy.
- `suggest_replacements` vẫn chưa có bằng chứng được gọi thật; đã sửa theo cùng class bug nhưng chưa quan sát được ngoài thực tế.
- e2e qua dewee (hạng mục A5) nằm ngoài phạm vi, cần dewee đã sửa.
