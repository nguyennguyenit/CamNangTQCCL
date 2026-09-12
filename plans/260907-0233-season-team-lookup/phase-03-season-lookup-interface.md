---
title: "Phase 3: Season lookup interface"
status: completed
---

# Phase 3: Season lookup interface

## Overview

Trạng thái 2026-09-12: Kongming cho phép đóng phase 3; [closure](reports/final-advisory.md), [UI validation](reports/phase-03-ui-validation.md), [review](reports/review-season-ui.md), [final gates](reports/final-validation.md). E2E 55/55 gồm 28 season; Astro check/build/dist/verify passed. Scoped execution được fixture-test, không promote dữ kiện VN. Baseline bên dưới là lịch sử.

TDD: các failures theo slice được ghi trong UI validation. Hash/filter-combination/inventory identity/responsive và một số edge cases là regression sau implementation. Checkbox dưới xác nhận delivered coverage; không nhận mọi case là pre-code Red.

Đọc/sửa `js/app.js`, `render.js`, `team-pk.js`, `meta-cu.js`, `team-filter-section.js`, `analyze.js`, `roster-recommend-ui.js`, `roster-scan-state.js`, `src/pages/index.astro`, public manifest và `docs/design-guidelines.md`. Dùng resolver phase 2.

Prerequisite artifact checkpoint: phase 1 đã khai báo hai sidecars; phase 2 thêm ba sidecars và resolver cùng manifest, build/dist đạt. Phase này dùng bộ năm sidecars đã có để nối UI/hash activation; không sở hữu lần khai báo route đầu tiên.

## Ranh giới với bộ tra cứu thống nhất — 2026-09-12

Session bàn giao (tài liệu ngoài nhánh: `../reports/analysis-260912-1142-unified-lookup.md`) đã chốt danh mục thống nhất dùng tên Việt, không hiện tên/URL nguồn hoặc màn hình chọn nguồn; provenance giữ nội bộ. Plan mùa không triển khai thêm bốn danh mục mới hay khôi phục nhãn nguồn trên các hồ sơ thống nhất; giữ ID/variant và đọc lại owner dictionary trước tích hợp.

Người dùng xác nhận lúc 12:47 ngày 2026-09-12: **giữ nhãn “Điểm SGSDeck” cho đội; chỉ ẩn nguồn ở danh mục thống nhất**. Giữ filter/source links, query `source` và nhãn điểm của Team PK/Meta phe cũ/Cùng Tồn theo contract bên dưới; không đổi thành “Điểm đánh giá” hoặc bỏ nguồn ở phần đội vì policy danh mục. Cùng Tồn reference không tự có điểm; Khai hoang vẫn không hiển thị nguồn theo quyết định riêng. Giữ giá trị điểm, context/selection matching và provenance nội bộ/MCP. Câu hỏi ranh giới UI đã đóng.

Acceptance tích hợp: card/chi tiết đội có điểm đúng config vẫn hiện “Điểm SGSDeck”, thiếu điểm hiện “Chưa có điểm SGSDeck”; hồ sơ danh mục thống nhất không có tên/URL/bộ chọn nguồn. Kiểm cùng `render.js` không làm lẫn hai policy và không đổi sao/phẩm chất tướng. Không thêm luồng hỏi lại quyết định này trước triển khai UI.

## Mẫu tham chiếu và luồng đã chọn

Người dùng chọn [SGSDeck Recommended](https://sgsdeck.com/recommended) ngày 2026-09-07 làm mẫu tổ chức tra cứu. Đã đọc trang danh sách, nhánh Khai hoang và [một cấu hình chi tiết](https://sgsdeck.com/recommended/og-bingyan-40y-lvbu-b). Quan sát: context mùa, tìm tên đội, bộ lọc loại đội/phe/binh chủng/tier/phân loại phụ; danh sách chia nhóm tier có số lượng; chi tiết có chủ/phó tướng, chiến pháp, binh thư, cộng điểm và ghi chú. Nhánh Khai hoang có trạng thái không có kết quả. Đây là tham chiếu luồng thông tin, chưa là đối chiếu hình ảnh từng pixel hoặc bằng chứng đã kiểm toàn bộ tương tác nguồn.

### Áp dụng vào project

1. Đặt “Kịch bản đang chơi” và “Phiên bản luật” trên vùng tra cứu, luôn thấy context hiện tại. Dùng registry VN, vẫn chọn lại kịch bản cũ được.
2. Trong các section theo mùa (Team PK, Meta phe cũ, Cùng Tồn), đặt thanh tìm tên đội/tướng và bộ lọc dạng chip: phe, binh chủng, tier, nguồn. Nhóm nội dung dùng điều hướng Team PK/Khai hoang/Cùng Tồn hiện có; Meta phe cũ giữ URL và diễn giải là nguồn tham khảo. Phân loại phụ chỉ hiện khi dữ liệu có taxonomy đã review; không thêm nhóm Công thành rỗng chỉ để giống nguồn.
3. Team PK hiển thị nhóm tier theo thứ tự đã chuẩn hóa của project, có số cấu hình sau lọc. Card gọn: tên đội, ba tướng đúng variant, binh chủng, tier và context. Count tính config, không đếm nhầm teamId khi có nhiều biến thể. Thiếu tier được ghi riêng; unknown/incompatible không lẫn vào nhóm áp dụng. Khai hoang/Cùng Tồn giữ tiêu chí riêng, không gán tier PK.
4. Mở chi tiết đúng config: chủ/phó tướng, chiến pháp theo holder, binh thư, cộng điểm nếu có bằng chứng, lựa chọn thay thế, điều kiện vận hành và nguồn đánh giá. Field chưa có dữ liệu hiển thị rõ; hiển thị “Điểm SGSDeck” từ sourceScore đã đối chiếu; chưa có thì ghi rõ, không tự tính điểm. Dùng component chi tiết hiện có khi phù hợp.
5. Nút “Đối chiếu kho của tôi” dùng inventory/scan state local hiện có, cho biết tướng/chiến pháp đủ và thiếu theo đúng config/context. Khi chưa có kho, dẫn tới luồng nhập/quét hiện tại. Phân biệt độ khớp tài nguyên với tier/sức mạnh; không thêm đăng nhập, sao chép vào tài khoản game hoặc backend theo nguồn mẫu.
6. URL lưu context, tìm kiếm, bộ lọc và config đang mở bằng query params có validate; giữ hash section cũ. Đóng chi tiết/back khôi phục danh sách và bộ lọc. Không có kết quả phải nêu context và cho xóa lọc section, không tự đổi mùa hoặc đổ đội ngoài scope vào.

### Acceptance TDD bổ sung cho mẫu Recommended

- [x] Kết hợp tìm kiếm/phe/binh chủng/tier chỉ trả config đúng context; số card/count nhóm khớp, thứ tự tier ổn định, unknown tách riêng. Scoped cards/search có Red; filter-combination là regression bổ sung.
- [x] Cùng teamId hai config mở đúng holder/tactic/books; reload/back-forward/đóng chi tiết giữ filter/context; sai scope bị từ chối. Card/detail và close/history có Red đã ghi; không nhận mọi ca bổ sung là pre-code Red.
- [x] Đối chiếu kho đủ/thiếu đúng variant/chiến pháp; thiếu kho dẫn tới nhập; đổi mùa vô hiệu kết quả. Action/invalidation có Red; inventory-identity bổ sung là regression.
- [x] Green rồi Refactor: kiểm mobile/keyboard, trạng thái không có kết quả và legacy hashes cùng các ca mới; ghi bằng chứng trong `reports/validation.md`.

## Yêu cầu xuyên suốt

- [x] Selector chung “Kịch bản đang chơi”/“Phiên bản luật”, lựa chọn “Tất cả — tham khảo”. Không mặc định mùa lớn nhất; chỉ auto chọn ruleset khi người dùng chọn scenario mới trên UI, có duy nhất một bản reviewed và không có URL/state đã chọn ghi rõ scenario-only; hiển thị rõ.
- [x] Ba nhóm nội dung theo mùa (Team PK, Meta phe cũ, Cùng Tồn), soi đội và gợi ý kho đồng bộ scope, giữ chín section và source filter hiện có.

## Implementation Steps

### TDD — Red → Green → Refactor

- [x] Đối chiếu state/E2E: URL ưu tiên local, pair sai không fallback, đổi scope hủy kết quả, hash cũ, unknown, missing artifact và shell/data hash mismatch. Chỉ failures ghi trong UI validation được tính behavioral Red; không khẳng định mỗi case đều test-first.
- [x] Green: triển khai selector/loading/cards theo từng luồng; kiểm tương tác UI thật, không chỉ snapshot markup.
- [x] Refactor: chạy lại tests liên quan và các gate bên dưới; ghi bằng chứng vào báo cáo validation của plan.

### Triển khai theo từng lát cắt

1. URL dùng `?scenario=<id>&ruleset=<id>#team-pk`; giữ mọi hash cũ. URL thắng preference local; thiếu context mở tham khảo. Scenario hợp lệ nhưng thiếu ruleset là reference-only (Kongming đã chốt), không phải pair lỗi. Ruleset thiếu scenario, ID/pair sai hoặc pair chưa reviewed báo rõ và chặn effective context, không đổi ngầm sang mùa khác.
2. Sửa intro Meta phe cũ để nguồn cũ không đồng nghĩa vô hiệu. Shared filter tính facets theo scope; “Xóa lọc” reset bộ lọc section, selector scope có control riêng.
3. Card hiện config/tier đúng scope và nguồn chi tiết có thể mở trên mobile. Unknown nằm vùng “Chưa xác định kịch bản — tham khảo”, không tính chung số đội áp dụng.
4. Chỉ Cùng Tồn lọc bằng content links; resolve cả legacy-locator và source-owned-coexist. Khai hoang đứng ngoài seasonal projector: đổi kịch bản không lọc, xóa hoặc thay hướng dẫn Khai hoang. Plan hướng dẫn Khai hoang sở hữu bỏ nhãn mùa và nguồn hiển thị ở section đó; không derive mùa cho khaihoangTable. Giữ hash, mỏ và Chạm Sứ độc lập.
5. `onOpenTeam` mang config/context để mở đúng record, không chỉ search tướng đầu. Soi đội có opt-in match ngoài scope; đổi scope xóa recommendation cũ và yêu cầu xác nhận lại scope, giữ inventory/scan state hợp lệ.
6. Kiểm năm sidecars và `season-context.js` đã nằm trong `src/lib/public-artifact-manifest.mjs` từ phase 1–2; không thêm trùng hoặc nới allowlist. Astro build tính SHA-256 cho năm sidecar và các dataset canonical được tham chiếu, nhúng manifest hash vào JSON không thực thi trong shell. Browser đối chiếu byte hash và cross-reference trước khi activate nguyên bộ context; chỉ cùng schemaVersion chưa đủ. Load/validate bộ context cùng nhau; thiếu/hỏng một file giữ legacy có thông báo, chặn seasonal recommendation, không trộn version. `team-tier.json` vẫn optional cho legacy.
7. Gợi ý từ kho dùng kết quả projector phase 2 trước engine. Trên 500 config executable hiện “Quá nhiều cấu hình phù hợp phạm vi; chưa thể tạo gợi ý”, giữ kho và danh sách tra cứu, không render portfolio cũ hoặc tự lấy 500 config đầu. Diagnostic mang cùng `CANDIDATE_LIMIT_EXCEEDED`/counts với MCP; giảm số đội mong muốn không phải cách vượt bound.

## Todo

- [x] Mở rộng shell/runtime asset contracts; E2E chọn mùa/ruleset, hash cũ, reload/back-forward, state cũ, mobile/keyboard/light-dark, unknown, missing artifact và shell/data khác generation gây hash mismatch.
- [x] Focused tests rồi `npm run check`, `npm run build`, `npm run test:dist`, `npm run verify`, E2E liên quan. Không tạo server trùng; dừng process do task tạo.

## Success Criteria

Ba nhóm theo mùa, match/recommend phản ánh cùng context, dữ liệu thiếu được nói rõ, tracker/tướng/chiến pháp không bị ảnh hưởng.

## Rủi ro và rollback

Không xóa localStorage cũ để migration dễ hơn. Rollback nguyên bộ shell/JS/JSON tương thích; query chưa biết xử lý an toàn. Không deploy.

## Thay sao bằng điểm SGSDeck

- Sửa owner `js/render.js` (badge sao đánh giá team) và `js/team-pk.js` (chip Sao), kiểm các consumer dùng chung: bỏ sao đánh giá đội khỏi card/chi tiết và bộ lọc. Giữ sao/phẩm chất tướng.
- Card/chi tiết hiển thị giá trị nguyên bản với nhãn “Điểm SGSDeck”, nguồn và mùa trong phần giải thích; tier vẫn là nhóm riêng. Có lựa chọn sắp xếp điểm giảm dần trong cùng context, null đứng cuối; mặc định vẫn nhóm tier. Không lấy số điểm làm phần trăm.
- State/filter sao cũ được bỏ qua an toàn, không khiến danh sách rỗng. Không chuyển giá trị sao cũ sang điểm.
- TDD Red: không còn badge/filter sao đánh giá đội; điểm đúng config/context, giá trị >100 không bị clamp, null không thành 0, sort ổn định và nguồn có thể mở; kiểm sao tướng không bị ảnh hưởng. Green/Refactor rồi chạy các gate UI hiện có.

## Audit: owner bộ lọc và URL

Bổ sung `js/filters.js` và `tests-js/filters.test.mjs` vào files sửa: lọc sao hiện nằm trong `applyFilters`, không chỉ chip. Adapter state bỏ khóa stars trước lọc ở UI tra cứu, giữ dữ liệu team.stars lịch sử cho consumer legacy nếu còn cần. Kiểm `js/team-filter-section.js` và `js/render.js`: biểu tượng sao của “Khuyến nghị” không phải điểm sao; đổi icon sang nhãn chữ để giao diện đội không còn gây nhầm lẫn, giữ boolean recommended.

Query contract: `scenario`, `ruleset`, `q`, `faction`, `unit`, `tier`, `source`, `sort=tier|sgsdeck-score`, `config`; repeated filter keys là OR trong nhóm, AND giữa nhóm. Filter áp dụng section hiện tại từ hash; ID/filter sai bị bỏ với thông báo, context sai vẫn không fallback. URL có context thắng preference; URL thiếu context mở tham khảo theo quy tắc hiện có. Search dùng replaceState, đổi context/mở config dùng pushState; popstate không tự push vòng lặp. TDD khẳng định state stars cũ không còn lọc ngầm và back-forward không nhân history.

## Cùng Tồn: state và render contract

Một shared selection: `browseState = all-reference | scenario-reference(scenarioId) | verified-pair(scenarioId,rulesetId) | invalid`. `referenceScope` chỉ là projection của state trên web, không một selector/preference hoặc input MCP mới. `seasonContext` chỉ tồn tại ở verified-pair. Đổi state lập tức vô hiệu kết quả/confirmation cũ nhưng giữ kho hợp lệ; chỉ xác nhận lại sau pair hợp lệ hoặc lựa chọn legacy rõ ràng. URL `?scenario=<id>#coexist` biểu đạt scenario-only nên reload/popstate phải giữ reference mode dù có một ruleset reviewed. Chỉ thao tác chọn scenario mới trên UI mới được auto-select khi có duy nhất một ruleset reviewed; cập nhật query pair và hiển thị rõ. Restore URL/state không auto-upgrade; nếu không có ruleset reviewed vẫn xem reference, không bịa luật.

| State | Cùng Tồn | Gameplay |
|---|---|---|
| all-reference / URL không context | Các bộ theo nguồn; cũ ghi “Chưa xác định kịch bản — tham khảo”, mới ghi Binh Diễn Xuân Thu/chưa xác minh luật | Legacy no-context parity |
| scenario-reference | Reference đã xác nhận scenario, nhãn “Chưa xác minh phiên bản luật”; không trộn legacy unknown | Không gửi match/recommend/replacements, không dùng context cũ hoặc legacy ngầm |
| verified-pair | `applicable` đúng pair; cùng scenario/null ruleset ở vùng `scenario-reference` riêng, count riêng; null không là wildcard | Chỉ configs reviewed đúng pair |
| invalid / missing data | Thông báo nguyên nhân, không tự đổ bộ mùa khác | Chặn seasonal request |

Không có nhóm applicable: “Chưa có bộ Cùng Tồn được xác minh cho phiên bản luật này”; có thể vẫn mở vùng tham khảo scenario với nhãn riêng. Scenario không có dữ liệu: “Chưa có bộ Cùng Tồn cho kịch bản này”. Unknown chỉ truy cập từ all-reference, không vào count scoped. Muốn gameplay khi scenario-only phải chọn pair reviewed hoặc chủ động trở về “Tất cả — tham khảo”.

`app.js` thay nội dung mount bằng replaceChildren khi scope đổi (hiện append một lần). Render header/source và 5 nhóm mới/25 đội, ba hero mỗi đội; giữ raw multiline/ordered slots/notes/khai hoang/chủ lực và điều kiện. Khai hoang là text gợi ý của nguồn, không tự tạo transforms hoặc nhập thêm đội sang Khai hoang. J hiển thị “Cải tạo chiến pháp binh chủng”; advisor requirement trong tên tướng giữ riêng. Không hiện PK tier/Điểm SGSDeck cho reference group. Dùng DOM text nodes như el hiện tại; URL nguồn chỉ http(s) đã validate, không chèn raw HTML/handler nguồn.

Đối chiếu kho chỉ xác nhận tài nguyên đã kiểm được. Mandatory condition chưa biết/không hỗ trợ hiện “Chưa xác minh điều kiện” cùng lý do, không ghi dùng ngay dù đủ tướng/chiến pháp; giữ cấu hình tra cứu, không đưa vào portfolio executable. TDD bảo vệ nhãn và diagnostic theo phase 2.

## Deep inventory, interfaces và test matrix

| Files | Action |
|---|---|
| `js/app.js`, `js/render.js`, `src/pages/index.astro`, `css/styles.css` | Shared lifecycle, tagline động, reference render/responsive |
| `js/season-context.js`, `js/filters.js`, `js/team-filter-section.js`, `js/team-pk.js`, `js/meta-cu.js` | Dùng resolver phase 2; giữ filter/score contract |
| `js/analyze.js`, `js/roster-recommend-ui.js`, `js/roster-scan-state.js` | Invalidate/chặn request khi scope chưa effective |
| `src/lib/public-artifact-manifest.mjs`, `tests-js/frontend-shell-contract.test.mjs`, `tests-js/runtime-asset-contract.test.mjs`, `tests-js/astro-dist-contract.test.mjs` | 5 sidecar/resolver, hash generation và legacy contracts |
| `tests-js/season-context.test.mjs`, `tests-js/season-ui-state.test.mjs` | Extend/tạo state và source-shaped render tests |
| `tests-e2e/season-lookup.spec.mjs`, `tests-e2e/spa-parity.spec.mjs` | Tạo focused flow, giữ parity |
| `docs/design-guidelines.md`, `docs/system-architecture.md`, `README.md` | Chỉ cập nhật khi behavior thực đã có |

Dependency: phase 1 registry → phase 2 union/projector → shared state → render → phase 4 parity. Không đợi catalog để hiện source text.

Interface checklist:
- [x] Một query/state owner; popstate không push vòng lặp.
- [x] Invalid/scenario-only không để context cũ còn dùng được.
- [x] coexistGroup nhận resolved reference, không suy ID/season bằng label.
- [x] Mount không nhân đôi; raw text không thành HTML.
- [x] Hash activation nguyên generation; sidecar lỗi không trộn legacy dưới nhãn scoped.

| Red case | Green invariant |
|---|---|
| All → Binh Diễn → khác → back/reload | Restore query/hash, 5/25 mới đúng scope, không duplicate |
| Scenario-only/invalid pair/đổi khi request đang chạy | Không request sai; bỏ kết quả stale |
| Scoped executable configs 500/501, record khác scope đứng trước | Cùng cap/diagnostic MCP; giữ browse, không trả portfolio một phần |
| Null-ruleset/exact pair/unknown | Phân loại và counts riêng |
| J/actual advisor/multiline/coupled modes | Đúng nhãn/raw option, không auto-mix |
| Empty scenario/exact pair | Empty state đúng, không fallback mùa khác |
| HTML-like source/unsafe URL | Literal text; reject unsafe href |
| Mobile/keyboard/details/hash legacy | Đọc đủ, focus rõ, không overflow |
| Missing sidecar/mixed generation | Seasonal disabled; fallback legacy có thông báo |

Baseline declarations: frontend-shell 4, runtime-asset 5 (static, không phải pass count); chưa có season/coexist suite. Red trước từng UI slice, Green rồi Refactor. Focused: `node --experimental-strip-types --test tests-js/season-context.test.mjs tests-js/season-ui-state.test.mjs`; `npx playwright test tests-e2e/season-lookup.spec.mjs --project=astro`; sau đó gate build/verify/parity phía trên. Kiểm port trước chạy, track và dừng chỉ process do task tạo.
