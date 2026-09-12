---
title: "Phase 4: MCP and release validation"
status: completed
---

# Phase 4: MCP and release validation

## Overview

Bản sửa hậu review `e39db07` đã chạy lại toàn bộ gate và build assets sau E2E mà source vẫn sạch. [Bằng chứng cập nhật](../reports/fix-260912-1610-season-review-findings.md); Node194, MCP351, E2E55, Workerd3.

Trạng thái 2026-09-12: **completed** — implementation/reviews và real clean-source release gate đã đạt trên `f2741f5`. MCP 351, Workerd 3, E2E 55 và Wrangler dry-run pass; [closure](reports/isolated-release-closure.md) ghi counts, Python skips và ranh giới final-HEAD verification. Các lỗi `SOURCE_NOT_CLEAN`/thiếu assets trong [final gate cũ](reports/final-validation.md) là lịch sử trước worktree được cho phép.

TDD có Red cho inventory/context/schema/bounds và lỗi audit; transport/score-alternative/5-group snapshot cùng một số release tests là regression sau implementation. Không nhận lỗi import/setup là Red. Checkbox đối chiếu bằng chứng thực; baseline bên dưới là lịch sử trước implementation.

Baseline MCP có sáu artifact dạng mảng, manifest v1 và output `.length(6)`. Hiện đã hỗ trợ exact union v1/v2, snapshot immutable và tám tool CLI/stdio/HTTP. Giữ phạm vi entity hiện có của MCP; tra cứu Khai hoang thuộc website.

Owners thuộc `mcp-worker/`: `src/data/artifact-contracts.ts`, data sources/index; `src/research/research-contracts.ts`, handlers; `src/domain/contracts.ts`, `canonical-state.ts`, `recommendation-service.ts`; `src/mcp/tool-definitions.ts`, `src/mcp/format-result.ts`, `src/cli.ts`; build/verify-worker-assets scripts, generator và `workflow-source-manifest.json`. Đọc trước sửa release fixtures/tests và docs MCP.

Manifest v2 gồm sáu artifact cũ + năm season sidecars: 11 artifact, 12 private asset files kể cả manifest. V1 vẫn đọc nguyên trạng; v2 bắt buộc đủ bộ, không nới v1 thành arbitrary optional. Content links chỉ chứa Cùng Tồn; không tạo hoặc chấp nhận nhánh kind/dataset khaihoang trong sidecar mùa mới. Không thêm search kind hoặc recommendation Khai hoang.

Optional request `seasonContext={scenarioId,rulesetId}` cho search/detail/match/normalize/recommend/coexist/suggest_replacements. Giữ tám tên tool và input bắt buộc cũ; no-context giữ nghĩa legacy. Registry được discover qua data-version capability; detail và suggest_replacements nhận configId; được bỏ qua chỉ khi context resolve duy nhất một cấu hình hợp lệ. Search kinds giữ tập hiện có. Output phân biệt record gốc/config, metadata context tùy chọn và provenance bounded.

## Requirements

- [x] UI/MCP dùng cùng projector; context được bind vào confirmation và cursor.
- [x] Giữ tám tool và phạm vi entity hiện có; gợi ý thay chiến pháp dùng đúng config/context.
- [x] Strict client schema v1 phải refresh tool discovery/schema trước output v2. Thay đổi đã được chấp nhận trong [quyết định thực thi](reports/execution-decisions.md); không hứa tương thích output hoàn toàn.

## Implementation Steps

### TDD — Red → Green → Refactor

- [x] Đối chiếu Red/Green inventory v1/v2, partial/hash/count/cross-ref, replacement config/context, binding/cursor, output migration và no-context; fixture v1 nguyên bytes. MCP/release validation phân biệt behavioral Red với regression sau implementation, không nhận mọi case là pre-code Red.
- [x] Green: triển khai từng contract/handler/workflow binding; không nới schema để bỏ lỗi.
- [x] Refactor: focused tests, transport parity, workflow và controlled release suites pass; lỗi review có Red được ghi đúng chronology. Real release gate được tách riêng bên dưới.

### Triển khai theo từng lát cắt

1. Thêm parser/cross-ref/index/exact inventory v2. Filesystem tạo v2 khi sidecars đủ, thiếu một phần báo lỗi; snapshot v1 nhận request context trả không hỗ trợ, không bỏ qua scope.
2. Giữ hash/releaseId fixture v1 nguyên văn, tạo identity mới cho v2. Builder/verifier/schema phân nhánh version, không thay mọi số 6 thành 11 làm mất kiểm chứng lịch sử.
3. Context tham gia canonical semantic projection/confirmationBinding ở seasonal request; no-context giữ legacy projection. Đổi scenario/ruleset/config data/workflow làm confirmation hết hiệu lực; không chấp nhận legacy binding cho context request.
4. Cursor khóa query+kinds+context+workflowVersion+releaseId; đổi một thành phần từ chối tái dùng. Context validation có bounds và pair registry reviewed.
5. Giữ public exclusion `do-uy` trên tất cả output kể cả config/provenance. Coexist lọc reference theo scope; chỉ config liên kết reviewed được engine xét như team bình thường.
6. `tqccl_suggest_replacements` resolve holder/slot từ config được chọn; config không thuộc team/context bị từ chối, không fallback sang cấu hình legacy.
7. Cập nhật semantic closure inventory, regenerate workflow build và tests; docs owning surfaces README/architecture/MCP/design chỉ cập nhật khi implementation có thật.
8. Seasonal engine input dùng projector phase 2: lọc scope/eligibility trước cap 500 configs, một effective tier row/config; tập vượt cap trả `CANDIDATE_LIMIT_EXCEEDED`, không chạy engine. Không truyền lại qua slice 500/1.000 của `engineRequest` legacy. Đồng bộ diagnostic giới hạn và ambiguity qua serializers/schema bên dưới; no-context giữ nhánh cũ.

## Todo

- [x] Focused Vitest data/schema/handlers/canonical-state/workflow/release: v1/v2 missing/extra/hash/count/cross-ref, replacement đúng/sai config/context, migration output client v1 sang v2, stale binding/cursor, legacy input parity và Đô Úy exclusion.
- [x] All-tools CLI/stdio/HTTP parity, workflow E2E, root Node/Python, Astro build/dist/verify và UI E2E đạt. `check:repository` đã đạt exit 0 trong worktree; lần exit 1 trước đây được giữ trong `reports/validation.md`.
- [x] Release gate: real `build:worker-assets`, `verify:worker-assets`, và `check:repository` gồm Wrangler dry-run đạt trên cùng data/workflow generation tại clean `f2741f5`. Bảo toàn WIP; không fake assets, stash, commit tạm hoặc bypass guard. Commit tài liệu chốt được kiểm lại identity-sensitive packaging theo closure; không cần deploy.

## Success Criteria

Capability v2 đồng nhất UI/MCP; lỗi data không activate; input no-context không bắt buộc chọn mùa; strict client output v1 cần refresh schema v2; seasonal request không rơi ngầm xuống legacy. Build bundle local không tạo quyền upload/promotion. Không deploy hoặc paid source fetch.

## Rủi ro và rollback

Snapshot/output lớn hơn phải đo budget bằng corpus thực, giữ bounds. Fixture v1 riêng. Rollback code/data/workflow identity thành bộ known-good thống nhất; token release khác phải xác nhận lại, không tái sử dụng.

## Contract điểm nguồn

Season evaluation/output chi tiết mang `sourceScore` nullable với provenance và scope đã validate; không ghi đè trường score nội bộ của recommendation bằng điểm SGSDeck. Dùng sidecar evaluation hiện có, không thêm artifact. TDD Red cho điểm >100, thiếu điểm, nguồn/config/context sai và UI/MCP trả cùng sourceScore; Green/Refactor cùng migration schema v2.

## Audit: replacement không được chọn ngầm

Seasonal detail/replacement thiếu configId: một config hợp lệ thì resolve, nhiều config trả lỗi ambiguity có danh sách ID bounded, không lấy phần tử đầu. Replacement bổ sung selector holderId/slotIndex khi tên tactic match nhiều vị trí; kiểm selector thuộc config/context và tactic thực sự ở slot đó. `mcp-worker/src/research/research-contracts.ts` sở hữu input mới, tool schema và service phải đồng bộ; no-context giữ hành vi legacy.

Result/diagnostics/provenance mang teamId và configId riêng theo phase 2. TDD Red: omitted config giữa hai cấu hình, tactic cùng tên ở nhiều slot, selector sai holder/slot, đúng selector trả đúng replacement và không làm rò điểm SGSDeck sang lựa chọn mới.

### Public error v2: ambiguity và candidate limit

Thêm mã lỗi `CONFIG_AMBIGUOUS` cho trường hợp nhiều config hợp lệ khi caller bỏ selector. Error envelope v2 nhận optional `choices={kind:"team-config",teamId,configIds,totalCount,omittedCount}`. IDs lấy từ configs đã validate và thuộc đúng team/context; không lấy raw input làm gợi ý. `configIds` unique, sắp theo ID tăng dần bằng so sánh code point, tối đa 20; mỗi ID tối đa 128 ký tự theo config schema chung. Counts là số nguyên an toàn không âm; `totalCount>1`, `omittedCount=totalCount-configIds.length`. Không trả IDs khác scope/Đô Úy. Một config thì resolve; không có config thì lỗi không tìm thấy theo contract, không trả ambiguity rỗng.

Khi trên 20 lựa chọn, giữ 20 IDs và báo số bị lược; hướng client dùng search team đúng context để duyệt/paginate đủ configs rồi gọi lại detail/replacement với `configId`. Search seasonal phải mang configId trong mỗi kết quả và dùng cursor binding đã định nghĩa; không thêm tool/kind hoặc dùng detail đang ambiguity làm đường duy nhất tìm các IDs còn lại.

`CANDIDATE_LIMIT_EXCEEDED` nhận optional `limits={maxCandidates:500,candidateCount}` với `candidateCount>500`; retryable=false, thông báo tập cấu hình quá lớn và cần rà lại phạm vi/dữ liệu. Không khuyên giảm `maxTeams` để chữa giới hạn đầu vào. Lỗi này không trả portfolio một phần; web dùng cùng mã/count từ projector.

Hai field là optional trong envelope chung nhưng bắt buộc trên mã lỗi tương ứng: `choices` chỉ có trên `CONFIG_AMBIGUOUS`, `limits` chỉ có trên `CANDIDATE_LIMIT_EXCEEDED`; validate tương quan code/payload. Giữ message công khai từ catalog lỗi, `fields` chỉ chứa tên field và không chứa config IDs. Không đưa raw source text/exception vào payload. Bounds trên vẫn phải nằm trong response cap 64 KiB.

Luồng cần sửa rõ: `DomainServiceError` (`src/domain/recommendation-service.ts`) → `ResearchHandlerError`/`mapDomainError`/`publicMessage` (`src/research/research-handlers.ts`) → `PUBLIC_ERRORS`/`formatToolError` (`src/mcp/format-result.ts`) và `errorDocument`/catch (`src/cli.ts`). `src/research/research-contracts.ts` sở hữu strict errorEnvelopeSchema và declared tool outputSchema v2; đồng bộ cả lỗi detail được tạo trực tiếp tại handler. CLI giữ envelope legacy riêng khi payload vắng; không ép thêm nextAction vào lỗi CLI cũ. CLI/stdio/HTTP phải trả cùng code, choices/limits và counts; differences envelope cũ được giữ có chủ đích.

TDD Red → Green → Refactor: 2 configs bỏ selector trả cùng IDs qua ba transport; 21 configs có đúng 20 IDs và omittedCount=1, config còn lại truy cập được qua search/cursor; payload không đúng code, ID sai scope hoặc quá bound bị reject; declared MCP outputSchema validate cả lỗi. 500/501 seasonal configs kiểm cùng outcome/UI/MCP và không slice trước scope; nhiều rankings không chiếm thêm candidate slot. Các lỗi no-context khi không có choices/limits giữ shape cũ; test cả `fields` cũ, public-error scrubbing và Đô Úy exclusion.

## Cùng Tồn: contract v2 và giới hạn reference

Không thêm search kind/tool hoặc referenceScope input MCP. seasonContext vẫn cần scenario/ruleset reviewed; scenario-only browse là web-local. Browser không gọi MCP gameplay khi mới chọn scenario. Request MCP thiếu ruleset phải schema reject; không bỏ scope rồi chạy legacy. Giữ assertConfirmed/binding trên mọi recommend/coexist request.

Seasonal coexistReference dùng cùng resolver phân loại với UI: đúng pair là applicable; cùng scenario/ruleset null là scenario-reference với nhãn chưa xác minh luật. Không trả legacy unknown hoặc khác scenario trong seasonal response. Cả hai loại vẫn trust untrusted và warning coexist-reference-not-scored; applicable chỉ nói evidence áp dụng, không chứng minh đủ tài nguyên hoặc engine chấm. No-context giữ projection legacy hiện tại, không tự thêm inline reference hoặc đổi fixture v1.

Projection v2 mang recordId, groupLabel, summary, source/provenance, attribution/applicability và nested teams/hero display có giới hạn. Code hiện chỉ map id/displayName/name/note nên groupLabel/summary/teams bị bỏ; thêm regression bằng fixture shape corpus thật. Không sửa projection trên nhánh v1/no-context trong delivery này. Không parse display strings để recommend, không tự gán sourceScore cho nhóm.

Schema/projection: tối đa 50 reference groups theo cap hiện tại, tối đa 10 đội/nhóm, 3 hero/đội, giữ 2 tactic slots và 3 book slots; text giữ cap hiện hành và tổng response 64 KiB. Validate artifact quá trần thay vì âm thầm mất source. Source href chỉ http(s); raw fields không thành instructions/canonical data.

Nhánh seasonal v2 dùng projector theo schema, không đưa nested references qua boundedJson generic lần nữa: helper hiện tại dùng chung budget 180 nodes/depth 8 và thay phần vượt budget bằng null, dễ phá nested schema sau khi teams tiêu thụ budget. Giữ helper/nhánh legacy nguyên hành vi. Projector v2 giữ recordId/category/source và summary bắt buộc; nested detail optional, rút theo cả team/group hợp lệ, không tạo null hero/tactic hoặc bỏ field bắt buộc. Nếu thiếu budget cho detail, trả summary-only và báo truncation; nếu thiếu cho một group envelope thì bỏ cả group và ghi omitted count. Đếm đúng node/depth/bytes theo shape, không đơn thuần tăng cap. Handler fitResultSize phải bảo toàn metadata bắt buộc/truncation và schema output sau mọi lần rút. TDD snapshot 5/25/75 cộng portfolio gần trần: output schema vẫn pass, IDs/category không mất, truncation rõ, không nới 64 KiB hoặc thay v1. Website vẫn giữ đầy đủ nguồn, MCP là projection bounded nên không hứa trả đủ 75 vị trí mỗi response.

Seasonal candidate có mandatory condition chưa hỗ trợ/unknown/unmet bị projector loại khỏi executable portfolio theo phase 2; giữ diagnostic bounded theo configId. Đủ hero/tactic không tự trả build-now. Test đúng pair + đủ tài nguyên + thiếu evidence quân sư/S và experimentalUntiered không bypass. Không đổi roster input legacy hoặc thêm inventory capability.

## Deep inventory, interfaces và test matrix

| Files trong mcp-worker | Action |
|---|---|
| `src/data/artifact-contracts.ts`, `src/data/snapshot-index.ts`, data sources hiện có | v1/v2 union + inline cross-ref, legacy untouched |
| `src/domain/recommendation-service.ts`, `src/domain/contracts.ts`, `src/domain/canonical-state.ts` | Scoped references/bounds, eligibility/binding, no-context parity |
| `src/research/research-contracts.ts`, `src/research/research-handlers.ts`, `src/mcp/tool-definitions.ts` | Schema v2, bounded projection/truncation, 8 tên tool |
| `src/mcp/format-result.ts`, `src/cli.ts` | Truyền choices/limits đã validate; giữ envelope legacy khi payload vắng |
| `scripts/build-worker-assets.ts`, `scripts/verify-worker-assets.ts`, `scripts/verify-release.ts` | 11 artifact v2/12 files gồm manifest; giữ v1 6 artifact |
| `workflow-source-manifest.json`, `scripts/generate-workflow-build.ts` | Closure shared resolver/identity mới |
| `test/data/artifact-contracts.test.ts`, `test/data/snapshot-index.test.ts`, `test/domain/recommendation-service.test.ts`, `test/research/research-handlers.test.ts` | Focused union/filter/projection |
| `test/release/build-worker-assets.test.ts`, `test/release/verify-release.test.ts`, `test/e2e/team-research-workflow.test.ts`, transport suites hiện có | Inventory/parity/workflow |
| `test/mcp/registry.contract.test.ts`, `test/cli.integration.test.ts`, `test/transport/stdio.integration.test.ts`, `test/transport/worker.integration.test.ts`, `test/transport/all-tools-parity.test.ts` | Error outputSchema, choices/limits và omission parity xuyên transports |

Dependency: phase 2 projector + phase 3 UI contract → v2 data/domain/schema → closure → release/transport parity. Review schema từ phase 1, không đổi status hoặc publication.

Interface checklist:
- [x] Union target validation builder/runtime; inline không cần legacy match.
- [x] Thiếu ruleset reject, không bypass confirmation.
- [x] Cùng resolved IDs/categories UI/MCP; engine không chấm raw refs.
- [x] Bounded nested shape/truncation; unchanged no-context projection.
- [x] Schema/builder/controlled verifier thống nhất 5 sidecar/11 artifact/12 files; fixture v1 nguyên bytes. Real asset bundle đã đạt release gate; commit tài liệu chốt được rebuild/verify theo HEAD mới.
- [x] CONFIG_AMBIGUOUS có đường choices tới CLI/stdio/HTTP; tìm đủ configs qua search/cursor.
- [x] Scope/eligibility trước cap 500, một tier row/config; CANDIDATE_LIMIT_EXCEEDED không tạo portfolio một phần.

| Red case | Green invariant |
|---|---|
| Malformed union/duplicate ID/fingerprint mismatch | Reject trước activation |
| Same label 2 sources/null ruleset/exact pair | ID/category đúng; unknown không vào scoped result |
| Source-shaped group | v2 có nội dung; v1/no-context projection parity |
| Scenario-only request/stale confirmation/cursor | Reject, không fallback/binding cũ |
| Thêm/chỉnh raw ref/nonmatching/pending ref | Không đổi candidate order/score |
| Large nested payload/HTML-like text | Bounded, untrusted, báo truncation |
| Missing/extra/mixed generation/v1 fixture | v2 reject; v1 hash không đổi |
| Ambiguity 2/21 configs, wrong-scope IDs, error payload sai code | Choices bounded tới đủ transports, omission rõ, schema strict vẫn pass |
| 500/501 configs + sai scope đứng trước + nhiều rankings | UI/MCP cùng reject hoặc chạy, không silent slice seasonal |

Baseline declarations: artifact-contracts 9, recommendation-service 8, research-handlers 31 (static, không phải số tests đã chạy). Focused Red/Green/Refactor tại mcp-worker: `npm test -- test/data/artifact-contracts.test.ts test/data/snapshot-index.test.ts test/domain/recommendation-service.test.ts test/research/research-handlers.test.ts`. Sau đó typecheck, transport/workflow/release và `npm run check:repository` theo gate chung. Không deploy.
