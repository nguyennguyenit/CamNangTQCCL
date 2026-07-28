# Audit failure mode Phase 2

## Kết luận

- Trạng thái audit cuối: **không còn lỗi tái hiện được trong phạm vi đã giao**.
- Trong quá trình rà độc lập đã tìm thấy nhiều lỗi thật ở binding, source precedence, workflow closure và allocator. Controller sửa ngay trong phiên; tất cả repro đỏ ban đầu đã được chạy lại và chuyển xanh.
- Không sửa code, test hoặc config trong lượt audit này; chỉ tạo báo cáo.

## Lỗi thật đã phát hiện và xác nhận đóng

### 1. Canonical projection, JCS và binding replay

Trước sửa:

- `unresolved: [ambiguity]` và `unresolved: []` có cùng digest; xóa `unresolved` khỏi payload cho phép `recommendTeam` nhận binding cũ.
- JCS chấp nhận lone surrogate `"\ud800"` thay vì fail closed.
- Locked team chỉ bind tập hero/tactic, chưa bind tactic holder; đổi holder cho cùng tactic cho digest giống nhau.

Sau sửa:

- Projection bind `reviewRequired` và `tacticAssignments` tại `mcp-worker/src/domain/canonical-state.ts:82`, `mcp-worker/src/domain/canonical-state.ts:157`.
- Unicode không hợp lệ bị từ chối tại `mcp-worker/src/domain/canonical-state.ts:110`.
- Regression tương ứng: `mcp-worker/test/domain/canonical-state.test.ts:53`, `mcp-worker/test/domain/canonical-state.test.ts:96`, `mcp-worker/test/domain/canonical-state.test.ts:107`.

Repro cuối:

```text
{"ambiguityDigestChanges":true,"holderDigestChanges":true,"loneSurrogateRejected":true}
```

Binding replay bằng cách bỏ `unresolved` cũng bị từ chối:

```text
{"ambiguityStripAccepted":false}
```

### 2. Source precedence, correction và locked state

Trước sửa:

- `applyConfirmedCorrections` làm rơi unresolved khác, locked teams và evidence nguồn gốc.
- Hai family ID cạnh tranh cho cùng canonical hero được chọn theo thứ tự input, không yêu cầu review.
- Hai locked teams dùng chung hero/tactic được nhận; locked team order bị sort theo ID.
- Cùng flat sets nhưng tactic đổi holder không thể biểu diễn/xung đột không bị phát hiện.
- Canonical ID sai namespace hoặc bare prefix có thể bị bỏ im lặng.

Sau sửa:

- Result giữ observations đã sanitize; correction giữ cả batch gốc và batch manual.
- Family, identity, membership, cross-team resource và tactic-holder conflicts đều tạo unresolved/review.
- Locked semantic order được giữ.
- Contract có `tacticAssignments` tại `mcp-worker/src/domain/contracts.ts:43`; normalization xử lý holder tại `mcp-worker/src/domain/normalization-service.ts:217`.
- Regression chính: `mcp-worker/test/domain/normalization-service.test.ts:415`, `:437`, `:524`, `:560`, `:597`.

Repro cuối:

```text
{"familyReview":true,"lockedOrder":["team:z","team:a"],"evidence":["original","manual"]}
```

### 3. Workflow source closure và hash mutation

Trước sửa:

- Regex bỏ sót dynamic import có comment gap.
- Static import hợp lệ `import { value } from /* gap */ "./semantic.js"` pass parser nhưng dependency không vào closure; thay đổi dependency có thể không đổi build ID.

Sau sửa:

- Closure dùng TypeScript AST tại `mcp-worker/scripts/generate-workflow-build.ts:62`.
- Dynamic import fail closed; static import có comment vẫn được thu thập.
- Regression: `mcp-worker/test/domain/workflow-build.test.ts:58`, `:71`, `:88`, `:101`.

Repro cuối:

```text
{"staticClosure":["src/entry.mjs","src/semantic.mjs"]}
```

`npm run check:workflow-build` pass trên generated identity hiện tại.

### 4. SP/CO, combined slots và resource uniqueness

Trước sửa:

- Một combined slot `A/B` có thể được tính thành hai hero hits trong similarity.
- Hero/tactic chưa được reserve trong cùng candidate.
- Greedy assignment báo false conflict cho `[A|B], [A]` và `[X|Y], [X]` dù có nghiệm.
- Hai locked teams trùng resource đều được seed.
- Full-box dùng tổng numeric score nên có thể chọn T0.5 trước T0 khi T0 dùng tactic alternatives.

Sau sửa:

- Similarity đếm tối đa một hit mỗi semantic slot.
- Assignment backtrack và enforce uniqueness trong candidate/portfolio.
- Locked overlaps bị loại với diagnostics.
- Full-box so tier trước downgrade/red-copy.
- Regression: `tests-js/analyze-map.test.mjs:189`, `tests-js/team-recommend-engine.test.mjs:87`, `:117`, `:144`, `:171`, `:325`.

## Xác minh cuối

Các lệnh chạy fresh sau freeze cuối:

```bash
cd /Users/plateau/Project/CamNangTQCCL/mcp-worker
npm run check:workflow-build
npm test -- --run test/domain
npm run typecheck
npm run build
```

Kết quả: 7 test files, **78/78 tests pass**; workflow check, typecheck và build đều exit 0.

```bash
cd /Users/plateau/Project/CamNangTQCCL
node --test tests-js/{hero-identity,analyze-map,team-recommend-engine}.test.mjs
```

Kết quả: **42/42 tests pass**.

Adversarial repro cuối xác nhận:

- static import comment-gap nằm trong closure;
- ambiguity và tactic-holder mutation đổi digest;
- lone surrogate bị reject;
- correction giữ evidence gốc;
- family conflict yêu cầu review;
- locked order được giữ;
- bỏ `unresolved` không replay được binding.

## Concern chưa tính là lỗi Phase 2

- `WORKFLOW_BUILD_ID` hiện là generated primitive; runtime composition/injection của workflow version thuộc Phase 3. Phase 3 cần có integration test chứng minh release ID + generated build ID được lấy từ trusted server state, không lấy hai giá trị tự nhất quán từ request.

## Câu hỏi chưa giải quyết

- Không có blocker trong Phase 2.
