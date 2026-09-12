---
title: "Phase 2: Season team configurations"
status: completed
---

# Phase 2: Season team configurations

## Overview

Trạng thái 2026-09-12: hoàn thành data/resolver/engine; [data](reports/phase-02-data-validation.md), [resolver](reports/phase-02-resolver-validation.md), [Recommended](reports/recommended-score-inventory.md), [final gates](reports/final-validation.md). Năm nhóm mới/25 đội/75 vị trí là scenario-reference; config/evaluation public rỗng vì chưa có ruleset VN reviewed. Baseline bên dưới là lịch sử trước implementation.

Ngoại lệ TDD được Kongming chấp nhận: 11 resolver cases đầu có Green nhưng không có assertion Red trước code; identity-map/golden và một số ca bổ sung là regression. Checkbox xác nhận coverage/bằng chứng thực, không khẳng định mọi test đều test-first. [Quyết định cuối](reports/final-advisory.md).

Dùng registry phase 1; tự curate corpus hiện có. Đọc `js/render.js`, `js/team-recommend-engine.js`, `js/hero-identity.js`, tests engine/tier. Evidence từ catalog tích hợp sau khi identity map reviewed, không là điều kiện khởi động.

Tạo curate `pipeline/season-team-configs.json`, `pipeline/season-team-evaluations.json`, `pipeline/season-content-links.json`; builder phase 1 xuất ba mảng cùng tên trong `data/`. Thêm ba entry data và entry `season-context.js` vào public manifest cùng lát cắt tạo từng file; checkpoint cuối phase có đủ năm sidecar và resolver, không có entry/file mồ côi. Candidate outputs vẫn validate trong thư mục tạm trước promote; không đợi UI phase 3 mới sửa manifest.

```text
config={id,teamId,scenarioId,rulesetId,reviewStatus,evidenceRefs[],unitTypes[],
 heroSlots:[{heroRefs[],tacticSlots:[{tacticRefs[]}],bookSlots:[{bookRefs[]}],statFocusRaw}],requirements[],effectBundles[],notes}
evaluation={id,configId,scenarioId,rulesetId,rankings:[{id,tier,evidenceRefs[]}],
 sourceScore:null|{provider:"sgsdeck",value,sourceConfigId,sourceSeason,provenance,evidenceRefs[],
 sourceSnapshotHash,configFingerprint,selectionFingerprint},
 defaultRankingId:null|string,reviewStatus,reviewNote}
contentLink={id,kind:"coexist",recordId,scenarioId:null|string,
 rulesetId:null|string,configIds[],reviewStatus,evidenceRefs[],target}
target={type:"legacy-locator",dataset:"coexist",locator,contentFingerprint}
     | {type:"source-owned-coexist",source:{id,url,sheetId,gid,format,snapshotHash,
          disclaimerRaw},contentFingerprint,payload:{groupLabel,summaryRaw,
          openingSuggestionsRaw,notesRaw,teams:[{recordId,sourceLocator,
          contentFingerprint,teamNameRaw,teamName,unitTacticEffectsRaw,
          heroes:[{nameRaw,tacticSlotsRaw:[string,string],statFocusRaw,
                   bookSlotsRaw:[string,string,string]}]}]}}
```

Giữ team ID; `config.id` riêng cho bản cấu hình, chuỗi ổn định không rỗng tối đa 128 ký tự, không chứa control characters; dùng cùng bound trong builder/projector/MCP và ambiguity payload. Hero SP/CO/bản thường, alternatives và tactic holder giữ canonical semantics. Legacy thiếu ID dùng legacy-locator; nguồn mới dùng source-owned-coexist trong content-links, không ghi coexist.json hoặc tạo artifact thứ sáu. RecordId nhóm/đội ổn định theo namespace nguồn và reviewed key, khác legacy/canonical team; không lấy label, row index hoặc fingerprint làm ID. Locator chỉ evidence. Fingerprint là revision; reorder giữ ID, nội dung đổi phải review lại.

Validator bắt buộc đúng một nhánh discriminator, reject both/neither/field sai nhánh. Legacy yêu cầu unique fingerprint match ở dataset đúng kind; inline chỉ cho kind coexist, validate nested payload/3 heroes/slot/source hash, không yêu cầu có record trong legacy. Reject duplicate/conflicting IDs; configIds rỗng hợp lệ cho reference, nếu có phải tồn tại, reviewed và đúng scope/evidence. Ruleset null không được review như exact-pair applicable. Link/evidence sở hữu scope, payload sở hữu text; chưa normalize canonical giữ null.

## Requirements

- [x] Inventory toàn bộ đội theo mùa, tier, Cùng Tồn: reviewed applicable/incompatible hoặc unknown; không suy `moi-phe` hết hiệu lực hay `team-intro` hiện hành. Khai hoang dùng hướng dẫn mới nhất, ngoài content links.
- [x] Cấu hình thiếu tier khác với chưa xác minh áp dụng; mọi cấu hình public reviewed có evidence.

## Implementation Steps

### TDD — Red → Green → Refactor

- [x] Đối chiếu coverage cùng team khác tactic/tier, conflict null, scope/holder/alternatives, khóa tài nguyên, no-context và cross-ref/content-link. Engine/data và lỗi resolver bổ sung có behavioral Red; 11 resolver cases đầu không có pre-code Red, giữ ngoại lệ đã nêu.
- [x] Green: triển khai projector/engine theo từng hành vi; giữ policy legacy.
- [x] Refactor: chạy lại Node/Python tests liên quan, ghi bằng chứng vào báo cáo validation của plan.

### Triển khai theo từng lát cắt

1. Curate cấu hình không nhân bản qua mọi mùa. Tạo `js/season-context.js` resolver/projector dùng chung browser/MCP, giữ no-context legacy.
2. Trong context chọn đúng `defaultRankingId` đã review; conflict chưa giải quyết trả tier mặc định null, giữ mọi nguồn. Không chọn min(T) lịch sử hoặc ngày crawl mới nhất.
3. `experimentalUntiered` chỉ vượt thiếu tier ở cấu hình đã xác minh áp dụng; không vượt unknown/incompatible. Locked team ngoài scope vẫn khóa tài nguyên và cảnh báo, không trở thành candidate được đề cử.
4. Matching đo trùng tướng/chiến pháp, không chứng minh đội mạnh. Match ngoài scope có nhãn tham khảo. Recommendation chỉ dùng config đúng scope; không parse display string Cùng Tồn để chấm điểm, không áp scoring PK cho khai hoang.

## Todo

- [x] Mở rộng builder/cross-ref tests; tạo `tests-js/season-context.test.mjs` và mở rộng engine/tier tests.
- [x] Focused Node tests rồi `npm run test:node`: cùng team hai ruleset đổi tactic/tier, conflict tier, unknown, đúng holder/alternatives, locked resources và no-context parity.

## Success Criteria

Mọi record được kiểm kê; config reviewed có evidence; tier/source breakdown nhất quán và khoảng trống hiện rõ.

## Rủi ro và rollback

Policy tier có context đã được chấp nhận trong [quyết định thực thi](reports/execution-decisions.md); giữ legacy best-tier. Sidecar hỏng chặn context, giữ tra cứu nền. Rollback bỏ adapter/artifact mới, không rewrite dữ liệu nền.

## Điểm SGSDeck thay sao đánh giá đội

- Bổ sung thu thập điểm từ trang Recommended và trang cấu hình chi tiết, có URL, thời gian và nguồn mùa. Bước này thuộc plan mùa; sáu danh mục catalog không cung cấp điểm đội. Áp dụng giới hạn truy cập/reuse đã kiểm ở plan catalog khi thu thập nguồn.
- Chỉ gắn sourceScore khi đã đối chiếu đúng đội hình, variant, chiến pháp và context nguồn với config; kiểm chứng ánh xạ VN riêng. Không chuyển điểm giữa các cấu hình cùng teamId, không cộng/trừ hoặc quy đổi từ sao/tier. Không giả định thang 100 vì nguồn có điểm vượt 100.
- Điểm nguồn là đánh giá SGSDeck, không phải phần trăm thắng hoặc độ khớp kho. Giữ thuật toán điểm recommendation nội bộ riêng; yêu cầu này không đổi công thức engine.
- TDD Red trước implementation: đọc đúng giá trị số (kể cả >100), điểm thiếu trả null, sai config/mùa không gắn, provenance bắt buộc; Green rồi Refactor với suite config/evaluation.

## Audit: nguồn điểm và cấu hình được chấm

Files bổ sung: tạo `pipeline/sgsdeck_recommended.py`, `pipeline/sgsdeck-recommended-evidence.json`, `tests/test_sgsdeck_recommended.py`; builder mùa tiêu thụ evidence curate. Cache thô nằm ngoài public allowlist; fixture tối thiểu có nguồn và checksum. Ghi inventory URL/season/category, expected/extracted/unmapped/error tại `reports/recommended-score-inventory.md`. Tái dùng helper fetch/parser của catalog nếu đã có; module Recommended phải chạy được với đầu vào cache/export độc lập, không bắt buộc nhập đủ sáu danh mục.

Baseline 2026-09-12: catalog đã có helper `pipeline/sgsdeck_source.py`, nhưng URL/category allowlist chỉ dành cho sáu danh mục, không nhận `/recommended`. Adapter Recommended sở hữu contract cache/export và parser riêng; chỉ tái dùng phần chung tương thích, không tự mở rộng allowlist hoặc nhập Recommended vào manifest catalog. Bảng đối chiếu [danh mục thống nhất](../reports/analysis-260912-1142-unified-lookup.md) có 259 ứng viên mới, không phải reviewed mappings; chỉ dùng liên kết đã review cho config cần thực thể tương ứng.

Thu thập danh sách và detail, đối chiếu ID/điểm; mismatch hoặc thiếu detail không promote điểm. Output deterministic từ snapshot đã khóa; lỗi fetch/parser giữ evidence trước đó. Không coi một trang mặc định là đủ toàn bộ mùa; inventory đánh dấu phạm vi đã lấy. TDD bao phủ list/detail mismatch, duplicate nguồn, parser drift, offline parity và failure preservation.

`configFingerprint` khóa nội dung config và context; `selectionFingerprint` khóa lựa chọn thực tế (variant từng chủ/phó tướng, chiến pháp theo slot/holder, binh thư, binh chủng và điều kiện bắt buộc được nguồn ghi). Đổi lựa chọn phải invalidate điểm cho lựa chọn đó. Card có thể ghi điểm của cấu hình gốc được chấm, nhưng kết quả dùng phương án thay thế chưa được chấm trả sourceScore null. Hash snapshot lưu bằng chứng cũ khi nguồn cập nhật; cập nhật config/evidence phải review lại, không tự chuyển điểm theo slug. TDD phải chứng minh hai lựa chọn trong cùng config không thừa hưởng điểm của nhau.

## Audit: identity xuyên engine

Seasonal candidate có `candidateKey=config.id` và `teamId` canonical riêng; không thay team.id canonical bằng config ID. Tier index, tie-break, diagnostics và selected-candidate lookup dùng candidateKey trong nhánh seasonal. Carry configId qua projector, engine result, UI open-detail và MCP provenance. Legacy no-context giữ identity cũ. Trong portfolio, các config cùng teamId là lựa chọn loại trừ nhau; engine chọn tối đa một config cho team đó, nhưng diagnostics vẫn phân biệt từng config.

Owners: `js/team-recommend-engine.js`, `js/season-context.js`, `mcp-worker/src/domain/contracts.ts`, `mcp-worker/src/domain/recommendation-service.ts` và consumer UI/research phase 3–4. TDD Red bắt buộc hai config cùng teamId **cùng scenario/ruleset** khác tier/tactic: không ghi đè index, không mất diagnostic, mở đúng config, thứ tự ổn định, không đưa cả hai vào portfolio.

## Giới hạn candidate dùng chung UI/MCP

`js/season-context.js` sở hữu thứ tự: validate context → lọc scope/review/applicability, mandatory requirements và policy tier/`experimentalUntiered` → kiểm số config executable → gọi engine đối chiếu tài nguyên kho. Không slice corpus trước lọc và không dựa vào kết quả match kho để né giới hạn. Nhánh seasonal nhận tối đa **500 config**, mỗi config tạo đúng một tier row đã resolve theo `defaultRankingId` (rankings rỗng nếu thiếu tier và được opt-in); breakdown nguồn chỉ phục vụ chi tiết, không nhân bản tier rows đầu vào engine.

Nếu tập sau lọc có trên 500 config, projector trả `CANDIDATE_LIMIT_EXCEEDED` với `limits={maxCandidates:500,candidateCount}`; không gọi engine, không trả portfolio từ 500 config đầu. `candidateCount` là số nguyên an toàn không âm. Browser và MCP dùng cùng projector/limit/diagnostic, không có hai thuật toán chọn tập con. Giới hạn chỉ áp dụng recommendation/coexist executable, không cắt danh sách tra cứu hoặc reference groups. Giữ nguyên slice legacy no-context 500 teams/1.000 tier rows.

TDD Red: 500 config hợp lệ gọi engine, 501 config bị từ chối rõ dù config phù hợp kho duy nhất nằm cuối; record khác scope/pending/không đạt điều kiện đứng trước không chiếm budget; nhiều rankings của một config vẫn chỉ tạo một effective tier row. Green/Refactor kiểm cùng outcome và counts qua web/MCP, `experimentalUntiered` không vượt cap. Phase 4 đưa diagnostic này qua public errors; không dùng `boundedRecords` legacy để cắt lại seasonal input sau projector.


## Source intake Cùng Tồn và reference contract

Dùng [snapshot/source research](reports/coexist-source-research.md): 94 CSV records/220 physical lines/10 cột, SHA-256 `838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb`; acceptance 5 nhóm/25 đội/75 vị trí. Dedicated CSV adapter dùng csv.reader, không splitlines hoặc đưa vào HTML grid/group_coexist khóa label. Giữ quoted multiline/empty slots và boundaries ba hero; reject orphan continuation, header drift/reorder, malformed/truncated/login HTML.

Giữ disclaimer/A summary/khai hoang/chủ lực/ghi chú, B raw suffix C và thứ tự nguồn. Giữ 40th/SP/CO, parentheses, Chính Lệnh, S proficiency/phe, tactic prefixes Tinh·/Chuyển·/Thác·, raw stat priorities/splits. J là cải tạo chiến pháp binh chủng, không advisorSkill; quân sư trong hero label là requirement riêng. Không fill-down J qua đội khi thiếu merged ownership evidence. Slash hero/tactic/books/effects giữ raw coupled bundles, không Cartesian-product hoặc tự đoán alignment. Config đã normalize dùng ordered book slots, conditions/effect bundles và selection fingerprint; chỉ split canonical variants sau review.

Importer tạo candidate content-links riêng, validate toàn bộ rồi publish input/output có rollback nếu replace lỗi; temp staging tránh partial generation. Offline reproducible từ snapshot/hash đã khóa, lỗi fetch/parser/identity/validation giữ accepted bytes. Không gọi pipeline.build_json, không sửa teams/facets/khaihoang/coexist legacy; failure tests dùng temp outputs.

referenceScope={scenarioId} đã được Kongming chốt, chỉ attribution. Effective seasonContext={scenarioId,rulesetId} cần reviewed pair. Exact pair đặt scenario-only records trong vùng tham khảo riêng, không count applicable; unknown legacy vẫn xem được. Reference không tự thành engine candidate/tier/SGSDeck score. No-context MCP dùng legacy projection như cũ, không auto thêm inline nguồn mới.

Applicability khác roster readiness. Seasonal config có mandatory requirements (quân sư, thích tính S, Chính Lệnh, cải tạo) chỉ vào executable candidate khi mọi điều kiện được evaluator hỗ trợ và chứng minh thỏa từ input hiện có. Điều kiện không hỗ trợ/unknown/unmet: giữ config để tra cứu, loại khỏi portfolio có thể dùng ngay, trả diagnostic bounded theo configId; không thêm kho capability/scoring mới. experimentalUntiered chỉ vượt thiếu tier, không vượt điều kiện. Legacy no-context giữ parity. Red: đúng pair + đủ 3 tướng/6 chiến pháp nhưng unknown quân sư/S không có build-now; config không có điều kiện đặc biệt và reference browsing vẫn hoạt động. Kiểm shared projector, engine và MCP cùng kết quả.

## Deep file inventory và dependency

| Files | Action |
|---|---|
| Ba season config/evaluation/content-links inputs trong pipeline và outputs trong data | Tạo đúng 3 sidecars bổ sung (tổng 5) |
| `pipeline/build_season_data.py`, `tests/test_build_season_data.py` | Extend union/cross-ref/atomic validation |
| `pipeline/parse_coexist_csv.py`, `tests/test_parse_coexist_csv.py` | Tạo pure adapter + provenance/checksum fixture từ snapshot thật |
| `pipeline/sgsdeck_recommended.py`, `pipeline/sgsdeck-recommended-evidence.json`, `tests/test_sgsdeck_recommended.py` | Recommended evidence theo scope đã chấp nhận |
| `js/season-context.js`, `tests-js/season-context.test.mjs` | Tạo projector reference và applicability riêng |
| `js/team-recommend-engine.js`, engine/tier tests | Sửa candidateKey/config semantics đã audit |
| `src/lib/public-artifact-manifest.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/runtime-asset-contract.test.mjs` | Thêm ba sidecars/resolver đồng thời với file thật; checkpoint đủ năm sidecars |
| `js/hero-identity.js`, `pipeline/parse_coexist.py`, grid extractor, legacy coexist | Đọc; giữ legacy behavior/bytes |

Dependency: phase 1 + snapshot → parser → links/resolver → UI/MCP; canonical mapping → config/evaluation → engine. Catalog chỉ chặn config dùng thực thể mới, không chặn reference.

Interface checklist:
- [x] Parse source groups/boundaries.
- [x] Source-scoped stable identity khác revision.
- [x] Discriminated target validator.
- [x] Stage/validate/publish rollback cùng manifest.
- [x] Reference/applicable/unknown projector.
- [x] Engine candidateKey/teamId separation.
- [x] Exact score selection fingerprint.
- [x] Scope trước cap 500, không silent slice seasonal.

| Red case | Green invariant |
|---|---|
| Real CSV inventory/multiline/blank slots | 5/25/75, 3 heroes mỗi block, không mất raw |
| Drift/orphan/truncation/fetch/commit failure | Reject, accepted và sibling bytes bất biến |
| J + hero advisor requirement + blank next J | Semantics riêng, không inherit |
| Coupled builds/variants/decorated tactics/conditions | Không tạo mix hoặc canonical giả |
| Same label cross-source/reorder/edited fingerprint | ID riêng/ổn định; revision cần review |
| Invalid target/config ref/scope | Reject; inline không cần legacy match |
| Scenario-only/exact pair/no-context | Reference không leak vào engine; legacy parity |
| Same team nhiều configs/tier conflict/locked resources | Giữ audit candidate identity/portfolio |
| 500/501 configs; out-of-scope đứng trước; nhiều rankings/config | Shared limit sau eligibility, lỗi rõ và một tier row/config |
| Tạo sidecar/resolver thiếu manifest; rollback một phía | Reject; file và entry phải cùng checkpoint |
| >100/null/wrong score selection/list-detail mismatch | Không clamp/transfer/promote |

Baseline source research đã chạy `python3 -m unittest tests.test_parse_secondary.TestCoexist -v`: **1 passed**, chỉ sanity legacy. Suite mới chưa chạy. Red trước code: `python3 -m unittest tests.test_parse_coexist_csv tests.test_build_season_data tests.test_sgsdeck_recommended -v`; `node --experimental-strip-types --test tests-js/season-context.test.mjs tests-js/team-recommend-engine.test.mjs tests-js/team-tier-badge.test.mjs`. Green từng behavior → Refactor cùng suite → `npm run build`, `npm run test:dist`, `npm run verify`, `npm run test:node`, `python3 -m unittest discover -s tests`; ghi actual counts. Rollback ba sidecars/resolver cùng entry manifest tương ứng, giữ cặp sidecar phase 1 nếu chỉ rollback phase 2.
