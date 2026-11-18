---
phase: 2
title: "Thu gọn kết quả normalize"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: Thu gọn kết quả normalize
<!-- Updated: Red Team 2026-11-19 - bỏ tên khỏi state, unresolved là nguồn duy nhất cho mục cần rà soát, giữ dấu untrusted, recommend lấy tên từ catalog -->

## Goal
`tqccl_normalize_entities` trả kết quả gọn theo schema đầu ra riêng; thuật toán, ưu tiên bằng chứng và digest không đổi.

## Key Insights
- Digest chỉ dùng `canonicalId`, `familyId`, `redStars`, `level`, danh sách tactic id, lockedTeams và `unresolved.length` (`canonical-state.ts:165-198`); không dùng `displayName`/`evidence`/`confidence`.
- `canonicalState.unresolved` **đã có** `observedText`, `candidates`, `reason`, `evidence` (`normalization-service.ts:300-313`, `:557-559`) → là nguồn duy nhất cho mục cần rà soát; observations không lặp lại.
- `recommend` chỉ dùng `displayName` để làm nhãn `name` (`recommend-handlers.ts:286-307`), khớp đội theo canonicalId; tên gửi lên hiện là text của client (`research-handlers.ts:94,97`) → lấy từ catalog an toàn hơn và sửa luôn #166 (tên rỗng).
- Không consumer nào trong repo đọc `observations[]` đầu ra; tqccl-auto đọc `observationId`, `canonicalId`, `reviewRequired` (`advise.py:188-196`) và từ unresolved đọc `observationId`, `entityKind`, `reason`, `candidates`, `observedText` (`advise.py:204-206`).

## Design
Hàm chiếu `compactNormalizeResult` trong `research-handlers.ts`, gọi trong `handleNormalize` sau `normalizeObservations`, trước `enforceResultSize`. Domain giữ nguyên.
- `canonicalState.heroes[]`: `canonicalId`, `familyId`, `redStars?`, `level?`, `manual?: true` (chỉ khi `confidence === "manual"`).
- `canonicalState.tactics[]`: `canonicalId`, `manual?: true`.
- `canonicalState.unresolved[]`: bỏ `evidence` và `observedText` (client tự biết text mình gửi qua `observationId`); giữ `observationId`, `entityKind`, `candidates`, `reason`, `trust: "untrusted"`. <!-- Updated: Validation Session 2 - bỏ observedText khỏi unresolved -->
- `lockedTeams`, `warnings`, `seasonContext`: giữ.
- `resolvedIds` (thay `observations[]`): mảng cùng độ dài và thứ tự với `observations` đầu vào; phần tử i = canonicalId server tra tên cho observation i, `null` nếu client gửi sẵn canonicalId, hoặc mục chưa rõ/bị thay thế/xung đột. Không echo `observationId` (kích thước không phụ thuộc độ dài id); `observationId` đầu vào ≤ 32 ký tự. <!-- Updated: Code review 2026-11-19 - H1/M1: positional resolvedIds -->
- Dấu untrusted: `provenance` thêm `{ artifact: "canonical-state", trust: "untrusted" }` (đã có artifact này ở `research-handlers.ts:144`, thêm `trust`).
- Schema: `canonicalHeroSchema`/`canonicalTacticSchema` cho `displayName` **optional** (recommend vẫn nhận state cũ có tên); schema đầu ra normalize riêng (`normalizedObservationSchema`, `compactUnresolvedSchema`), không dùng `structuredObservationSchema`.
- `recommend`: tên tướng/chiến pháp lấy từ catalog theo canonicalId (index `searchEntries` như `withHeroFamilies`), bỏ qua `displayName` client gửi.
- Không thêm cờ `compact`.

## Files to Create / Modify
- Modify: `mcp-worker/src/research/research-handlers.ts`, `research-contracts.ts`, `shared-schemas.ts`, `recommend-handlers.ts`.
- Nếu tách module mới trong `src/`: thêm vào `workflow-source-manifest.json` (`generate-workflow-build.ts:160-163`).
- Regenerate: `npm run generate:workflow-build`.
- Modify tests (field đã bỏ): `test/research/normalize-tool.test.ts:17,79,84`, `test/research/research-handlers.test.ts:56-73,110-126`, `test/cli.integration.test.ts:188-196`, `test/transport/all-tools-parity.test.ts:124-132`, `test/transport/season-tools-parity.test.ts:39-42`, `test/research/season-research.test.ts:14`, `test/research/recommend-teams.test.ts:38-56`, `test/research/recommend-web-parity.test.ts:69-94`, `test/e2e/team-research-workflow.test.ts:13`.

## Tests Before
1. Handler (biến thể (a) phase 1, cắt còn ≤ 100 mục để lọt trần cũ): state không có `displayName`/`evidence`/`confidence`; observations chỉ `{observationId, canonicalId}`; mục mơ hồ chỉ có trong `unresolved`, không có `evidence`, có `trust`.
2. Digest: `normalizationDigest` handler = digest domain cho cùng đầu vào.
3. Binding vẫn chặn: đổi `redStars`, canonicalId, `familyId`, đội khoá trong state gọn → `recommend` trả `CONFIRMATION_REQUIRED`.
4. `recommend` với state gọn (không tên) trả tên catalog trong `portfolioTeams[].heroes[].displayName` (khớp #166); với state có `displayName` giả của client, output vẫn là tên catalog.
5. `manualCorrection` → `manual: true` có mặt; ảnh → không có.
6. `test/security/no-long-hex-in-echoed-fields.test.ts:74` và `research-handlers.test.ts:117`: đổi đầu vào normalize từ `{observations: []}` sang roster có mục giải quyết, mơ hồ, không biết, đội khoá; output parse bằng `RESEARCH_CONTRACTS.tqccl_normalize_entities.output`.
7. `tools/list` < 90 KiB (`registry.contract.test.ts:546-550`), `MAX_RESULT_BYTES*2*1.1 < 98 304` (`:269`) vẫn xanh.

## Regression Gate
- `cd mcp-worker && npm run check:workflow-build && npm test && npm run typecheck && npm run typecheck:worker`

## Success Criteria
- Test 1–7 xanh; số đo phase 1 cho thiết kế này đã ghi; không test nào bị xoá chỉ để qua.

## Risk Assessment
- Consumer ngoài repo đọc field đã bỏ (Dewee/GoClaw). Tín hiệu: smoke Dewee lỗi validate output → thêm lại đúng field đó (optional), không khôi phục bản đầy đủ.
- `WORKFLOW_BUILD_ID` đổi → mọi binding cũ phải normalize + confirm lại. Ghi changelog + handoff doc (phase 4).
