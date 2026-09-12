---
title: "Audit kế hoạch tra cứu đội theo mùa"
date: 2026-09-12
scope: audit-only
status: remediated-in-plan
---

# Audit kế hoạch tra cứu đội theo mùa

## Kết luận

**Cập nhật sau yêu cầu “fix plan”: ba Medium dưới đây đã được bổ sung vào index và bốn phase ngày 2026-09-12.** Nội dung audit ban đầu giữ làm evidence; “chưa áp dụng” bên dưới mô tả thời điểm audit, không phải trạng thái kế hoạch sau sửa. Runtime vẫn chưa triển khai. Xem mục “Xử lý findings trong kế hoạch” cuối báo cáo.

**0 Critical, 0 High, 3 Medium cần bổ sung trước triển khai toàn kế hoạch.** Hai finding của audit 2026-09-07 vẫn chưa vào phase; một finding mới về thứ tự tạo public artifacts. Không sửa plan, runtime, dữ liệu hoặc Git state. Chỉ tạo báo cáo này; giữ WIP có sẵn.

Đã đọc `plan.md`, cả bốn phase, các báo cáo audit/contract liên quan; đối chiếu source hiện tại trên `main`, Node `v24.20.0`. Catalog SGSDeck đã có implementation/private snapshot trong workspace; thông tin planning cũ không còn là baseline cho catalog. Chưa có các file implementation season được kế hoạch chỉ định.

Kế hoạch **đã có `--deep --tdd`**: từng phase yêu cầu Red đúng hành vi trước Green, Refactor và regression; lỗi môi trường/thiếu module không tính Red. Đây là chất lượng thiết kế test, chưa phải bằng chứng các tính năng season đã được triển khai hoặc test pass.

## Findings

### 1. Medium — Thiếu đường trả ambiguity config tới client

- **Plan:** `plans/260907-0233-season-team-lookup/phase-04-mcp-and-release-validation.md:61` yêu cầu thiếu `configId` giữa nhiều cấu hình phải trả lỗi cùng danh sách ID bounded. Inventory phase 4 chưa giao owner error serializer/CLI.
- **Source:** `mcp-worker/src/research/research-contracts.ts:735` có error envelope strict chỉ code/message/nextAction/retryable/fields; `fields` chỉ chứa tên field. `mcp-worker/src/research/research-handlers.ts:276` map lỗi domain sang public message, không mang payload lựa chọn. `mcp-worker/src/mcp/format-result.ts:70` dựng lại envelope; `mcp-worker/src/cli.ts:134` và `:178` serialize lỗi riêng.
- **Failure:** service nhận diện ambiguity đúng nhưng danh sách config không tới client, hoặc schema strict từ chối payload mới. Agent không có dữ liệu có cấu trúc để yêu cầu người dùng chọn config.
- **Đề xuất:** thêm contract ambiguity v2 optional có config IDs đã validate, giới hạn count và dấu hiệu truncation; truyền xuyên domain error → handler → formatter/CLI → output schema. Bổ sung `format-result.ts`, `cli.ts` và test owners vào phase 4. Giữ shape legacy khi payload vắng; không nhét ID vào `fields` hoặc raw error message.
- **TDD cần thêm:** cùng hai config tới client qua CLI/stdio/HTTP; declared outputSchema chấp nhận error; ID sai scope bị loại; danh sách quá trần có count/truncation; lỗi no-context cũ không đổi.
- **Disposition:** Accept ở mức audit; **chưa áp dụng**. Finding cũ còn mở trong `reports/audit-260907-season-plan-summary.md`.

### 2. Medium — Chưa thống nhất giới hạn candidate sau khi mở rộng theo config

- **Plan:** `plans/260907-0233-season-team-lookup/phase-02-season-team-configurations.md:86` cho nhiều config trên một team và dùng candidateKey riêng. Phase 4 yêu cầu parity UI/MCP nhưng chưa định nghĩa bound cho đầu vào engine seasonal; bound reference response không giải quyết giới hạn này.
- **Source:** `mcp-worker/src/domain/recommendation-service.ts:41` cắt bằng `slice`; `:116` truyền tối đa 500 teams và 1.000 tier rows. Browser `js/roster-recommend-ui.js:227` truyền toàn bộ teams/teamTier vào engine; `js/team-recommend-engine.js:489` nhận tập caller cấp.
- **Failure:** config phù hợp duy nhất nằm ở vị trí 501 có thể được web đề cử nhưng MCP loại im lặng. Nếu cắt trước lọc scope, record mùa khác chiếm budget. Đây là rủi ro khi nhân cấu hình, không phải khẳng định corpus hiện tại đã vượt 500.
- **Đề xuất:** shared seasonal projector lọc scope/eligibility trước khi kiểm bound. Chính sách đơn giản nhất: từ chối rõ tập scoped vượt bound và trả cùng diagnostic trên UI/MCP. Nếu chọn deterministic truncation thì phải cùng thứ tự, cùng tập candidate và omission count trên cả hai consumer. Ghi chính sách vào phase 2–4; giữ nhánh slice legacy.
- **TDD cần thêm:** 500/501 configs với lựa chọn phù hợp ở cuối; nhiều record ngoài scope đứng trước; tương tác với tier rows; cùng outcome/diagnostic UI/MCP; không silently drop.
- **Disposition:** Accept ở mức audit; **chưa áp dụng**. Finding cũ còn mở; không tự nâng cap hoặc đổi scoring.

### 3. Medium — Phase 1–2 tạo artifact trước khi phase 3 khai báo manifest

- **Plan:** `plans/260907-0233-season-team-lookup/phase-01-start.md:12` tạo hai output trong `data/`; phase 2 tạo thêm ba output và `js/season-context.js`. Nhưng `phase-03-season-lookup-interface.md:52` mới thêm năm sidecar/module vào public manifest. Cuối phase 2 còn yêu cầu chạy toàn bộ Node tests.
- **Source:** `src/lib/root-static-artifacts.ts:65` so khớp chính xác source entries với manifest và throw khi có file thừa. `tests-js/astro-dist-contract.test.mjs:20` kiểm cùng invariant; file này thuộc `npm run test:node` trong `package.json`. `staticPathsFor` cũng gọi validator trước khi tạo route.
- **Kiểm chứng:** probe dùng manifest/validator thật trên thư mục tạm: inventory baseline PASS; chỉ thêm `data/season-registry.json` thì nhận `Public artifact source set mismatch for data`. Thư mục tạm đã dọn. Không thêm file thử vào corpus thật.
- **Failure:** thực hiện đúng thứ tự phase khiến build và full Node regression lỗi ở checkpoint phase 1–2, dù builder/resolver focused tests có thể xanh. Thêm module JS trước manifest gây cùng vấn đề. Đây là khoảng trống thứ tự tích hợp, không phải lỗi validator.
- **Đề xuất:** ghi rõ outputs/module được giữ trong staging ngoài public source roots ở các lát cắt đầu; promote bộ artifact cùng cập nhật manifest trong một thay đổi tích hợp có kiểm chứng. Hoặc đưa phần manifest/asset contract về cùng phase đầu tiên tạo từng file public. Giữ exact allowlist, không nới validator để bỏ qua mọi file mới. Nếu chọn staging, phải điều chỉnh đường import/test và thời điểm full regression tương ứng.
- **TDD cần thêm:** source-tree/build contract tại checkpoint thực sự promote; tập thiếu/thừa bị reject; sau promotion đủ bộ thì pass; `data/sgsdeck/` vẫn private; legacy artifact bytes bất biến.
- **Disposition:** Accept ở mức audit; **finding mới, chưa áp dụng**.

## Những điểm đã xử lý đúng, không mở lại

- `candidateKey` tách `teamId`, giữ config cụ thể xuyên detail/replacement và portfolio mutual exclusion: đã có requirement/test matrix.
- Điểm SGSDeck giữ nguyên thang nguồn, source/config/selection fingerprints; alternative chưa được chấm không thừa hưởng điểm. Không đổi điểm nội bộ recommender.
- Reference Cùng Tồn tách attribution/applicability/readiness; ruleset null không thành wildcard hoặc engine candidate. Projection MCP có schema-preserving truncation và giới hạn 64 KiB.
- Khai hoang tiếp tục dùng hướng dẫn mới nhất, không chia mùa; legacy no-context, hash và kho người dùng được giữ.
- Năm sidecars / 11 MCP artifacts / 12 private files nhất quán trong kế hoạch. Không đòi thêm artifact chỉ để giải quyết findings trên.

## Thay đổi baseline cần lưu ý khi thực thi

`docs/sgsdeck-catalog.md` và code hiện tại xác nhận helper catalog giới hạn sáu category. `pipeline/sgsdeck_source.py:473` không nhận `/recommended`; `:510` kiểm resource category và `:517` kiểm URL/key. Phase 2 đã cho phép parser Recommended riêng, chạy từ cache/export độc lập. Vì vậy không coi helper này sẵn dùng cho Recommended hoặc tự mở rộng allowlist catalog. Đây là lưu ý tích hợp, không tính finding mới: kế hoạch đã có đường module độc lập.

Phạm vi xác nhận import được tài liệu hiện tại ghi cho sáu catalog private; không dùng nó làm bằng chứng đã hoàn tất intake Recommended. Audit này không fetch nguồn ngoài, không kiểm lại giao diện/điểm/điều khoản SGSDeck live.

## Validation thực chạy

| Kiểm tra | Kết quả |
|---|---|
| `ak plan validate plans/260907-0233-season-team-lookup --json` | valid; chỉ format |
| Node engine + tier badge + runtime asset + frontend shell | **35 passed, 0 failed** |
| MCP artifact-contracts + recommendation-service + research-handlers | **63 passed, 0 failed** |
| Source-tree probe, thêm sidecar trước manifest | Tái hiện rejection mong đợi |
| CSV snapshot SHA-256 | Khớp `838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb` |
| CSV logical records | 94 |
| Markdown links trong index + 4 phase | 0 target thiếu |

Lệnh Node: `node --experimental-strip-types --test tests-js/team-recommend-engine.test.mjs tests-js/team-tier-badge.test.mjs tests-js/runtime-asset-contract.test.mjs tests-js/frontend-shell-contract.test.mjs`.

Lệnh MCP (cwd `mcp-worker`): `npm test -- test/data/artifact-contracts.test.ts test/domain/recommendation-service.test.ts test/research/research-handlers.test.ts`.

98 tests trên là baseline legacy/current contracts, **không phải Green của season**. Không chạy full build, full suites, browser E2E, deploy hoặc data import. Không khởi tạo background server. Không tuyên bố whole-plan consistency đã giải quyết hết: ba findings vẫn mở.

## Đề xuất tiếp theo

Bổ sung ba contract và owners/tests vào phase liên quan, cập nhật index để dẫn báo cáo audit mới, rồi đọc lại toàn bộ plan đối chiếu assumptions/steps/gates. Chưa cần tạo plan mới hoặc triển khai runtime để sửa các khoảng trống lập kế hoạch này.

## Bổ sung sau khi đọc session 01a093e5-69d8-7213-83bd-0f1f1ee79195

Đã đọc các lượt người dùng, phản hồi và báo cáo bàn giao của session ngày 2026-09-12, theo yêu cầu bổ sung ngữ cảnh. Bằng chứng hiện có tại [đối chiếu thống nhất](../../reports/analysis-260912-1142-unified-lookup.md) và [JSON tái lập](../../reports/analysis-260912-1142-unified-lookup.json). Kiểm lại cả **9 input hashes**, tất cả khớp file hiện tại; không cần chạy lại phép ghép tên chỉ để lấy cùng kết quả.

- **Quyết định sản phẩm đã xác nhận:** người dùng muốn “Một bộ tra cứu thống nhất, không cần ghi nguồn đến từ đâu vì user cũng không quan tâm”, rồi yêu cầu tiếp tục. Nguồn giữ nội bộ; giữ ID/tên Việt và các variant; chỉ hiện mùa/điều kiện khi ảnh hưởng cách chơi. Không mở lại quyết định ẩn nguồn cho danh mục thống nhất.
- **Mức hoàn thành đối chiếu:** 112/112 tướng và 226/240 chiến pháp có cặp tên; 79 liên kết reviewed, 259 ứng viên mới; 11 khác biệt chỉ số/thích tính. Chưa đối chiếu toàn bộ mô tả, Việt hóa hoặc hợp nhất bốn danh mục mới. Không biến kết quả ghép tên thành mapping đã review hay xác nhận áp dụng VN.
- **Quan hệ công việc:** phần hợp nhất sáu danh mục là hướng sản phẩm riêng; plan mùa vẫn sở hữu scenario/ruleset, cấu hình/đánh giá đội, UI và MCP theo mùa. Không cần đợi hợp nhất toàn bộ để làm nền phase 1–2. Mapping tương ứng chỉ chặn config dùng thực thể chưa xác minh. Không tự mở rộng tám tool MCP/chín section trong plan mùa để chứa toàn bộ danh mục mới.
- **Phạm vi UI cần đồng bộ:** phase 3 còn source filter, nguồn mở được và nhãn “Điểm SGSDeck”. Session/báo cáo đối chiếu chưa xác nhận rõ việc ẩn tên nguồn có bao gồm nhãn điểm đội hay không. Trước UI cần làm rõ ranh giới này; không tự bỏ điểm SGSDeck, provenance MCP hoặc điều kiện áp dụng. Đây là mục đồng bộ sản phẩm bổ sung, chưa tính thành finding lỗi kỹ thuật thứ tư.
- **Đánh giá lời khuyên cook trong session:** câu “có thể cook 1 → 2 → 3 → 4” xác nhận không có dependency toàn cục vào hợp nhất danh mục. Nó không cung cấp bằng chứng xử lý ba khoảng trống technical contract của audit hiện tại. Có thể bắt đầu công việc nền độc lập; trước khi đi qua checkpoint liên quan phải bổ sung ba sửa đổi kế hoạch. Không dùng format validation làm chứng cứ đã sẵn sàng triển khai toàn plan nguyên trạng.

**Kết luận cập nhật:** vẫn 3 Medium kỹ thuật; thêm ngữ cảnh sản phẩm, baseline đối chiếu và một câu hỏi giới hạn ở UI điểm đội. Không sửa phase/code hoặc tự khởi chạy cook từ lời khuyên của session trước.

## Xử lý findings trong kế hoạch — 2026-09-12

Người dùng yêu cầu sửa plan sau khi đọc audit và ngữ cảnh session bổ sung. Đã cập nhật `plan.md` cùng bốn phase, giữ status pending/todo và `--deep --tdd`.

| Finding | Sửa trong kế hoạch | Acceptance bổ sung |
|---|---|---|
| Ambiguity config | Phase 4: `CONFIG_AMBIGUOUS`, choices tối đa 20 IDs/128 ký tự, total/omitted count; DomainServiceError → handler → formatter và CLI → strict outputSchema | 2/21 configs, cùng IDs qua CLI/stdio/HTTP, omitted ID tìm được qua search/cursor; legacy error shape giữ nguyên |
| Candidate cap | Phase 2 sở hữu projector: scope/eligibility/tier trước cap 500; trên cap trả `CANDIDATE_LIMIT_EXCEEDED`, không engine/portfolio một phần; phase 3–4 cùng diagnostic | 500/501, record sai scope đứng trước, nhiều rankings/config chỉ một effective row; UI/MCP cùng outcome |
| Artifact checkpoint | Phase 1 tạo hai sidecar cùng entries; phase 2 thêm ba sidecar/resolver cùng entries; phase 3 dùng bộ đã đăng ký | Build/dist/full Node gate ngay checkpoint tạo public source, exact allowlist, rollback files+entries cùng nhau |

Đã giữ scope riêng cho hợp nhất danh mục, 79 reviewed links khác 259 ứng viên mới, Recommended parser không tự mở allowlist catalog. Quyết định ẩn nguồn danh mục đã chốt; phần mở rộng sang UI điểm đội ghi thành câu hỏi giới hạn trước phase 3, không tự đảo quyết định cũ.

Các lệnh 98 baseline tests trong phần trên thuộc lượt audit; không chạy lại hoặc ghi thành season Green cho lần sửa Markdown. Lần này kiểm format, link targets, owner paths, diff và trạng thái phase; không chạy code/build/import/deploy.

## Xác nhận phạm vi hiển thị nguồn — 12:47 ngày 2026-09-12

Người dùng trả lời: “Giữ nhãn ‘Điểm SGSDeck’ cho đội; chỉ ẩn nguồn ở danh mục thống nhất”. Đã thay câu hỏi mở bằng quyết định này trong index và phase 3, giữ source controls/links của phần đội và provenance MCP; Khai hoang giữ ngoại lệ không hiện nguồn. Acceptance phân biệt UI điểm đội với hồ sơ danh mục thống nhất. Các đoạn ghi chưa chốt ở phần lịch sử trên đã được giải quyết, không còn là gate triển khai UI.

## Câu hỏi còn mở sau sửa plan

- Scenario-only browsing vẫn ghi PROPOSED, chưa là quyết định người dùng đã xác nhận.
- Ruleset VN, scope legacy và evidence tier/config phù hợp còn là nhiệm vụ inventory của phase 1–2; không suy đoán để lấp chỗ trống.
- Không còn bỏ ngỏ chính sách cap hoặc checkpoint manifest: dùng reject sau scope/eligibility và đăng ký manifest cùng lần tạo file public.
