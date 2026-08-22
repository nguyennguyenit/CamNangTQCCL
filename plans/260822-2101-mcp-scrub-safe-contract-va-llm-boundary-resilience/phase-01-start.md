---
phase: 1
title: "Scrub-safe digest encoding (B1)"
status: completed
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Scrub-safe digest encoding (B1)

## Overview

Đổi mọi token client phải echo lại từ hex 64 ký tự sang base64url 43 ký tự, giữ trọn 256-bit. Giữ nguyên `releaseId` dạng sha256 hex đầy đủ vì đó là digest toàn vẹn và không ai echo nó.

## Requirements

**Functional**
- `expectedWorkflowVersion` và cả hai trường của `confirmationBinding` (`workflowVersion`, `normalizationDigest`): không còn hex ≥64.
- Round-trip được: encode rồi decode ra đúng digest gốc.
- `verifyConfirmationBinding` vẫn so khớp đúng sau khi đổi encoding.
- `releaseId` và `dataVersion` giữ nguyên định dạng hiện tại.

**Non-functional**
- Không mất entropy: vẫn 256 bit, không cắt ngắn.
- Không thêm state phía server (Worker stateless, nhiều isolate) — encoding phải thuần hàm.
- Prefix `sha256b64:` phân biệt rõ với `sha256:` hex.
- **Không import `node:*`.** `test/security/import-boundaries.test.ts:20` duyệt closure từ `src/worker.ts` và **ném lỗi** với bất kỳ specifier `node:` nào. `digest-encoding.ts` nằm trong closure đó (canonical-state → research-handlers → worker), nên `Buffer.from(x).toString("base64url")` sẽ làm đỏ test security.

## Architecture

Module mới `src/domain/digest-encoding.ts`:

```ts
export const SCRUB_SAFE_DIGEST_PREFIX = "sha256b64:";
export type ScrubSafeDigest = `sha256b64:${string}`;

// "sha256:<64hex>" -> "sha256b64:<43 base64url>"
export function toScrubSafeDigest(hexDigest: string): ScrubSafeDigest;
// nghịch đảo, dùng cho test round-trip và mọi chỗ cần digest gốc
export function fromScrubSafeDigest(token: string): `sha256:${string}`;
```

Base64url không padding (43 ký tự cho 32 byte). Ném `TypeError` khi input sai định dạng — không im lặng trả rác.

**Chỉ dùng Web API.** Repo đã có sẵn idiom cho cả hai chiều, bám theo cho nhất quán (DRY):
- encode: `btoa` — đã dùng ở `research/research-handlers.ts:187`
- base64url to base64: `.replace(/-/gu, "+").replace(/_/gu, "/")` + pad — đã dùng ở `security/bearer-auth.ts:38-40`

Chiều encode cần bước ngược lại: `btoa(...)` rồi thay `+` thành `-`, `/` thành `_`, bỏ `=` cuối.

Luồng đổi:
- `canonical-state.ts:191` `createNormalizationDigest` → trả `ScrubSafeDigest`.
- `canonical-state.ts:204` `createWorkflowVersion` → nhận releaseId, tự encode phần digest.
- `scripts/generate-workflow-build.ts` → emit `WORKFLOW_BUILD_ID` dạng `build:sha256b64:<43>`.
- `research-handlers.ts:286` gọi `createWorkflowVersion(snapshot.releaseId, WORKFLOW_BUILD_ID)` — chữ ký giữ nguyên, chỉ đổi giá trị bên trong.
- Cursor `v` (`research-handlers.ts:345,393`) mang workflowVersion → tự động theo, không sửa.

`domain/contracts.ts:14` `NormalizationDigest` đổi từ `` `sha256:${string}` `` sang `` `sha256b64:${string}` ``.

## Related Code Files

- Create: `src/domain/digest-encoding.ts`
- Create: `test/domain/digest-encoding.test.ts`
- Create: `test/security/no-long-hex-in-echoed-fields.test.ts`
- Modify: `src/domain/canonical-state.ts` (191-231)
- Modify: `src/domain/contracts.ts` (12-14)
- Modify: `src/research/research-contracts.ts` (14-20 validator `workflowVersion`, 112-119 `confirmationBindingSchema`)
- Modify: `scripts/generate-workflow-build.ts`
- Regenerate: `src/generated/workflow-build.ts` (qua `npm run generate:workflow-build`)
- Touch nếu cần: `test/domain/canonical-state.test.ts`, `test/research/research-handlers.test.ts`, `test/mcp/registry.contract.test.ts`

**Không đụng:** `src/data/artifact-contracts.ts` (releaseId/dataVersion), `src/release/worker-release-evidence.ts`, `versionOutputSchema:444-470` (artifact `sha256` là output-only, không ai echo).

## Implementation Steps (TDD)

1. **RED** — `test/domain/digest-encoding.test.ts`: encode/decode round-trip, độ dài 43, chỉ ký tự base64url, ném lỗi với input sai (hex 63 ký tự, chuỗi rỗng, thiếu prefix, base64 chuẩn có `+`/`/`).
2. **GREEN** — viết `digest-encoding.ts`.
3. **RED** — thêm case vào `test/domain/canonical-state.test.ts`: `createNormalizationDigest` trả prefix `sha256b64:`; `verifyConfirmationBinding` vẫn true với binding hợp lệ và false khi state đổi 1 field.
4. **GREEN** — sửa `canonical-state.ts` + `contracts.ts`.
5. **RED** — `test/security/no-long-hex-in-echoed-fields.test.ts`: chạy cả 8 tool qua handler thật với snapshot fixture, JSON.stringify response, assert **không** khớp `/[a-fA-F0-9]{64,}/` **sau khi loại bỏ** `releaseId` và artifact `sha256` (hai trường output-only được phép giữ hex). Test phải khẳng định rõ danh sách miễn trừ này bằng hằng số, để ai thêm trường echo mới mà quên encode sẽ bị bắt. Đây là test khoá invariant chính của plan.
6. **GREEN** — sửa `research-contracts.ts` (validator `workflowVersion` + `confirmationBindingSchema`), `generate-workflow-build.ts`, chạy `npm run generate:workflow-build`.
7. **REFACTOR** — chạy `npm run check:workflow-build` xác nhận file generated khớp.
8. Cập nhật `describe()` tiếng Việt của các trường đã đổi để nói rõ định dạng mới.

## Success Criteria

- [x] `test/domain/digest-encoding.test.ts` xanh, phủ cả nhánh lỗi
- [x] Guard test `no-long-hex-in-echoed-fields` xanh và **fail được** khi cố tình revert 1 trường về hex (kiểm bằng cách sửa tạm rồi hoàn lại)
- [x] `verifyConfirmationBinding` giữ nguyên ngữ nghĩa: true khi khớp, false khi state đổi
- [x] `releaseId` trong mọi response vẫn `sha256:<64hex>`
- [x] `npm run check:workflow-build` exit 0
- [x] `npm run typecheck` xanh

## Risk Assessment

**Đổi hợp đồng công khai.** Client đang giữ token cũ sẽ nhận `WORKFLOW_VERSION_CHANGED` một lần. Tín hiệu: agent báo lỗi ngay sau deploy. Phản ứng đã định: không làm gì — staleness guard tự phục hồi sau khi agent gọi lại `tqccl_get_data_version`. Đây đúng là hành vi thiết kế.

**Giả định có thể sai: base64url thoát được mọi scrub của client.** Nó thoát regex hex của dewee (đã probe), nhưng một client khác có thể có pattern base64. Tín hiệu: token vẫn về `[REDACTED]` trong trace sau khi deploy. Phản ứng: replan — cân nhắc token ngắn không-hex-không-base64 (vd base32 26 ký tự, đã probe CLEAN).

**`generate-workflow-build.ts` có logic hash riêng** (`HASH_DOMAIN = "tqccl:workflow-build:v1\0"`). Đổi encoding output không được đổi input của hash, nếu không mọi build id đổi vô cớ. Tín hiệu: diff `workflow-build.ts` thay đổi nhiều hơn dự kiến. Phản ứng: tách rõ bước hash và bước encode.

**Rủi ro thấp:** không test nào assert định dạng chuỗi `workflowVersion`/`normalizationDigest` (đã grep `test/domain/workflow-build.test.ts`, `test/release/workflow-release-contract.test.ts` — không có).

**Neo hồi quy đã có sẵn:** `test/e2e/team-research-workflow.test.ts:56` assert `releaseId` khớp `/^sha256:[a-f0-9]{64}$/u`. Test này **phải giữ xanh** — nó chính là bằng chứng Phase 1 không đụng nhầm `releaseId`. Nếu nó đỏ, dừng lại: đã encode nhầm trường.
