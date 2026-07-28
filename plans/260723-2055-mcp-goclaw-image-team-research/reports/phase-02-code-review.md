# Code review cuối Phase 2 — Freeze 6

Ngày review: 2026-07-28
Kết luận: **APPROVED**

## Phát hiện

Không còn blocker hoặc lỗi tái hiện được trong phạm vi Phase 2.

## Xác minh các finding đã đóng

1. **SP/CO/base và combined slot:** canonical ID tách biệt, `familyId` chỉ dùng so sánh; alternative thứ hai thỏa đúng một semantic slot.
2. **Ambiguity/source precedence:** exact tie đặt `reviewRequired:true`, browser `sure:false` và không tham gia similarity. Manual/current/prior precedence, field presence, numeric max, locked conflict và evidence privacy có test xanh.
3. **Tier/allocation:** meta xếp tier trước red copies, untiered chỉ vào bằng opt-in; hero/tactic không bị cấp phát trùng; search dùng lại đầy đủ alternatives; tactic selection gắn đúng holder.
4. **Locked assignment:** normalization chặn resource ngoài locked set, tactic trùng và duplicate explicit holder-slot. Service giữ canonical team ID, provenance record ID và holder mapping.
5. **Slot inference Freeze 6:** `js/team-recommend-engine.js:285-300` pre-reserve toàn bộ explicit slot theo từng holder rồi gán mỗi omission vào slot trống nhỏ nhất.
   - Repro omitted trước + explicit `0` trả `[1,0]`.
   - Gap `explicit 2, omitted, explicit 0, omitted` trả `[2,1,0,3]`.
   - Nhiều holder được cấp slot độc lập.
   - Duplicate explicit slot bị normalization loại với `reviewRequired:true`.
6. **Canonical projection/JCS/binding:** digest bind material ambiguity, nested inventory, locked semantic order và `tacticAssignments`; NFC/JCS, invalid Unicode, exact three-field confirmation binding và workflow mismatch có test xanh.
7. **Workflow closure/CI:** generator dùng TypeScript AST, dynamic import fail-closed, semantic manifest exact, generated build identity được stale-check trong CI.
8. **Privacy/bounds:** browser state dùng item/evidence allowlist, loại compound media/path/secret keys nhưng giữ `imageOrdinal`. Normalization giới hạn observations và collection lồng trước xử lý; recommendation clamp corpus/work/output.
9. **Browser compatibility:** `hero-identity.js` có trong public manifest/dist; focused Astro scan/recommend và analyze/similarity smoke xanh.

## Verification evidence

Fresh trong lượt review Freeze 6:

- `node --test tests-js/team-recommend-engine.test.mjs`: **22/22 pass**.
- `npm run check:workflow-build`: pass.
- `npm test -- --run test/domain`: **84/84 pass**.
- `npm run typecheck`: pass.
- `git diff --check`: pass.
- Repro trực tiếp slot inference mixed/gaps/multiple holders/duplicate explicit: đúng invariant nêu trên.

Controller freeze evidence:

- Root Node: **133/133 pass**.
- Dist: **9/9 pass**.
- Build và workflow gates: pass.

## Security review

- Observation/corpus text được normalize, clamp và tag untrusted; fixed fallback không echo raw instruction-like text.
- Canonical state/result không giữ raw screenshot, base64, persisted path, bearer/provider secret hoặc token.
- Collection/search/output có deterministic caps; locked/canonical conflicts fail closed.
- Không có data I/O, transport mutation hoặc secret access trong pure Phase 2 services.

## Gate tích hợp Phase 3, không phải blocker Phase 2

- Phase 3 phải chứng minh `workflowVersion` được compose từ trusted server `releaseId + WORKFLOW_BUILD_ID`, không nhận cặp tự nhất quán từ request.
- Runtime schemas Phase 3 phải áp cùng limits ở public boundary và kiểm thử parity.

## Quyết định

**APPROVED.** Các finding trước đã được đóng bằng source, regression test và repro độc lập; không còn lỗi Phase 2 mở.

## Câu hỏi chưa giải quyết

- Không.
