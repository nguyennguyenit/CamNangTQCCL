# Nghiên cứu consumer UI/MCP — tra cứu thống nhất

Ngày: 2026-09-12. Phạm vi: `--deep --tdd`, **PLAN ONLY**. Đọc source tại workspace đang có WIP plan mùa; không chạy test/build, không sửa runtime, không deploy. Các dòng dẫn dưới đây là snapshot đọc trong lượt này, không phải bằng chứng Green. Đường dẫn tương đối tính từ repository root.

## 1. Kết luận phạm vi

- Sáu nhóm web: **Tướng; Chiến pháp; Trang bị/đặc kỹ; Kỹ năng quân sư; Cải tạo binh chủng; Công trình/cấp nâng cấp**. Mỗi danh tính/biến thể chỉ có một hồ sơ. Các child như đặc kỹ, lựa chọn cải tạo, cấp công trình vẫn giữ đủ record/quan hệ; một nhóm giao diện không có nghĩa gộp mất child.
- Giữ `viet`, `hanViet`, `chinese` cũ và ID đang dùng theo mapping đã review; trường mô tả/chỉ số hợp nhất ưu tiên SGSDeck hợp lệ sau identity. `0` hợp lệ phải được giữ. Placeholder không thay dữ liệu thật. Nếu thiếu cả hai dùng “Đang cập nhật”. Không đổi thành chính sách ưu tiên local.
- Ẩn tên nguồn, URL nguồn và bộ chọn nguồn trong **danh mục**. Provenance dùng để tái lập/kiểm toán phải ở artifact nội bộ; không tải raw snapshot vào browser rồi chỉ giấu bằng CSS. Không quét xóa mọi chuỗi SGSDeck toàn site: nhãn “Điểm SGSDeck” và provenance/phân rã nguồn của đội đã được chốt giữ riêng (`plans/260907-0233-season-team-lookup/plan.md:109`).
- MCP trong brainstorm là **compatibility**, không phải yêu cầu thêm API tra cứu sáu nhóm. Giữ tám tool, kinds `hero/tactic/team/book` và miền observation/recommendation hiện tại. Bốn nhóm mới web không tự thành tài nguyên kho hay đầu vào engine. Nếu muốn MCP đọc chi tiết sáu nhóm, đó là contract addition riêng được mô tả ở mục 5, không giả vờ đã có.

Authority: `plans/reports/brainstorm-260912-1203-unified-lookup.md` (Outcome, quy tắc hợp nhất, acceptance/non-goals). Plan mùa hiện `in-progress`, nhưng narrative có câu “chưa sửa runtime”; source hiện đã có season-registry/evidence trong public manifest (`src/lib/public-artifact-manifest.mjs:47`). Phải dựa source/WIP thực tế khi phân owner, không suy trạng thái chỉ từ narrative cũ.

## 2. Thiết kế UI/nav tối thiểu để controller chốt trong plan

**Đề xuất:** thay hai nút tra cứu hiện tại bằng một nút **Tra cứu**, dẫn tới `#lookup`. Trong section có một ô tìm chung, chip “Tất cả” và sáu nhóm, số kết quả, danh sách card gọn. Click card mở một hồ sơ; bộ lọc chi tiết chỉ hiện khi chọn nhóm cần chúng. Không thêm sáu top-level nav, không yêu cầu chọn nguồn, không thêm framework. Đây là quyết định triển khai đề xuất, không phải UX đã tồn tại.

Giữ `#heroes` và `#tactics` làm alias vào cùng section, preselect Tướng/Chiến pháp. Cả load trực tiếp, hashchange, Back/Forward và menu mobile phải hoạt động; không redirect alias về Team PK. Giữ các hash đội/tracker/soi/kho. Nếu thêm link hồ sơ, dùng ID canonical đã review cùng kind (ví dụ query phía sau `#lookup`), validate route và không tạo ID từ tên hiển thị mới lúc click. `app.js:47-69` hiện chỉ parse nguyên hash theo whitelist; cả parser, active nav và tests hardcoded phải cùng đổi. `src/pages/index.astro:29-56` sở hữu nút/section shell. `tests-e2e/spa-parity.spec.mjs:29-39,158,187` đang giả định 9 section/9 nút, cần cập nhật theo hành vi alias mới chứ không chỉ sửa số.

Profile presentation:

| Nhóm | Nội dung tối thiểu và quan hệ |
|---|---|
| Tướng | Tên Việt + biến thể, phe/sao/vai trò khi có, sáu chỉ số, năm thích tính; chiến pháp tự mang/truyền thừa liên kết đúng ID; kỹ năng quân sư liên quan chỉ khi đã review |
| Chiến pháp | Tên Việt, loại/chất lượng, mục tiêu, xác suất/điều kiện/thời gian, mô tả Việt; không trộn khác biệt Tinh/Chuyển thành cùng chiến pháp |
| Trang bị/đặc kỹ | Trang bị và toàn bộ đặc kỹ của nó; giữ owner/đối tượng áp dụng và điều kiện, child mở đúng hồ sơ/đoạn có ID |
| Kỹ năng quân sư | Tên/mô tả Việt và tướng liên quan đã xác minh; chưa rõ relation thì trạng thái cập nhật, không link giả |
| Cải tạo binh chủng | Loại binh, các lựa chọn và điều kiện; trình bày riêng từng option, không tạo tổ hợp Cartesian |
| Công trình/cấp nâng cấp | Một công trình, danh sách cấp có thứ tự và đủ yêu cầu/chi phí/hiệu ứng theo dữ liệu; không cắt danh sách cho vừa card |

Giữ chữ Hán/alias để search nội bộ; default profile/copy dùng tiếng Việt. Trường chưa dịch chưa đạt tiêu chí bàn giao, không lấy raw Chinese làm cách lấp chỗ thiếu. Liên kết nội bộ khác URL nguồn; không bỏ quan hệ cùng với provenance.

Design constraints: gọn/mobile-first, text-safe DOM, lỗi/empty state tiếng Việt, light/dark (`docs/design-guidelines.md:5-9,33-46,86-90`). Chạm modal phải có focus trap, Escape, trả focus về trigger; navigation có selected/keyboard semantics (`docs/design-guidelines.md:48-59`). Hiện `js/hero-list.js:70-84` chỉ đóng bằng Esc/backdrop, chưa trap/restore focus. Không tuyên bố a11y hoàn chỉnh trước E2E.

## 3. Owners và consumer closure

| Owner/consumer hiện tại | Contract/rủi ro và việc plan phải ghi |
|---|---|
| `js/app.js:77-109` | Load hai dictionary rồi truyền cùng object cho lookup, tracker, soi đội, kho; tích hợp merged hero/tactic phải ở boundary này, tránh UI lookup dùng bản mới còn scanner dùng cũ. Supplemental lookup load/failure cần hiện trong section lookup; không làm cả site rơi vào catch Team PK duy nhất (`:110-111`). |
| `js/hero-list.js:23-30,44-61,87-153` | Search/filter/list từ stats/apt/faction/stars/role; hiện tên `hanViet` + badge `isSP`, chưa thể hiện CO/40Y rõ. Có thể giữ helper filter và renderer, chuyển ownership mount sang lookup coordinator; không duy trì hai bản hồ sơ cạnh nhau. |
| `js/hero-detail.js:22-36,39-44,57-68,73-96` | Self/inherit resolve bằng `chinese`, title fallback Chinese, effect chưa ưu tiên effectViet; `stats?.[k] || "—"` nuốt số 0. Cần relation ID chính + legacy fallback đã kiểm; liên kết thiếu không trỏ bừa, UI hiển thị Việt và pending đúng. |
| `js/tactics.js:10-16,20-44,48-107` | Hiện cả effectViet và raw effect; list giới hạn search mặc định 60 (`js/match-dict.js:144-155`). Unified lookup phải có cách duyệt hết kết quả, không khiến record ngoài 60 mất khả năng truy cập; mô tả Việt đủ và source-free. |
| `js/match-dict.js:51-70,98-137` | Việt/alias ở nhánh Việt, nhánh CJK hiện chỉ so `chinese`; thêm alias phồn/giản phải có case CJK và ambiguity. Không dùng fuzzy search như bằng chứng merge; giữ threshold/review semantics. |
| `js/hero-identity.js:5,29-43,59-65` | IDs/family lấy từ tên Việt; chỉ nhận SP/CO. 40Y cần policy reviewed giữ riêng canonical identity, không âm thầm thành base hoặc đổi IDs cũ. Trailing parenthesis bị loại (`:15-17`), nên không encode biến thể mới chỉ trong ngoặc. |
| `js/analyze-map.js:61-78,90-95`; `js/analyze.js` | Mapper dùng `record.viet` và canonicalHeroId; context dictionary truyền từ app; kiểm read/scan cũ ra đúng IDs, review khi ambiguity. Không đổi provider/upload scope. |
| `js/roster-scan-map.js:23-62,71-129`; `js/roster-scan-state.js`; `js/roster-recommend-ui.js:117-134,177-182` | Tên Việt là lựa chọn thủ công và persisted names; rich mapping có canonical/family IDs, runner-up. Snapshot cũ/import/review phải còn dùng được. Không nhét equipment/advisor/building vào ownedHeroes/ownedTactics. |
| `js/recruit-tracker.js:34-47`; `js/recruit-tracker-store.js` | Options từ name/viet/hanViet/chinese, history/state riêng; không rename lịch sử đã lưu, không migrate schema tracker để làm lookup. Test options có thực thể mới mà event/export/import cũ nguyên nghĩa. |
| `js/derive-team-faction.js:6-14,37-44`; `js/team-pk.js` | Dictionary phe ảnh hưởng filter đội vì app Team PK có derive. Giữ mọi tên cũ trong index, kiểm canonical corpus cũ không bị mất phe; không thêm chính sách đánh giá đội. |
| `js/team-recommend-engine.js:2,37,91-119`; `js/filters.js`, `js/render.js`, `js/meta-cu.js`, `js/team-filter-section.js` | Identity/shared names là consumer gián tiếp. Engine không được lấy stats/apt mới suy điểm/tier/cấu hình; old roster với cùng team corpus phải có candidate/selection parity. Nhãn source/score của đội thuộc plan mùa. |
| `mcp-worker/src/data/{artifact-contracts.ts,entity-identity.ts,snapshot-index.ts}` | Artifact dictionaries yêu cầu `viet`, tạo ID từ display name, reject duplicate canonical IDs (`artifact-contracts.ts:205-209,254-270`; `entity-identity.ts:15-22`; `snapshot-index.ts:102-124`). Thêm ID lưu trong JSON không khiến MCP tự dùng ID đó. |
| `mcp-worker/src/domain/legacy-domain-adapter.ts:1-20`; normalization/recommendation/canonical-state; research handlers/contracts | MCP gọi chung matcher/maps/engine. Chỉnh shared JS phải tính cả workflow hash, stale binding/cursor, parity transport; không chỉ UI unit tests. |
| `pipeline/build_dict.py`, `pipeline/crawl_tactics.py`, `pipeline/build_sgsdeck_catalog.py`, `pipeline/query_sgsdeck_catalog.py`, `pipeline/suggest_team_tier.py` | Consumer/producer offline có dictionary references; data owner cần review để writer cũ không overwrite merged output. `suggest_team_tier` chỉ kiểm tương thích đầu vào trong plan này, không chạy rồi promote tier mới. |

Các file UI mới hợp lý: `js/unified-lookup.js` (state/search/nav bridge) và chỉ thêm `js/lookup-detail.js` khi profile chung đủ phức tạp để tách. `css/styles.css` là owner styling. Tên/số supplemental JSON phải lấy schema/data-owner đã thống nhất; **không viết một bộ tên khác ở UI và MCP**. Không cần sửa tất cả consumer trong bảng nếu adapter/dictionary compatibility đã đáp ứng; bảng là closure kiểm chứng, không manifest edit mặc định.

## 4. Publication và release closure

1. Browser public owner là `src/lib/public-artifact-manifest.mjs:17-53`; mọi JS/JSON root mới phải allowlist cùng checkpoint tạo file. Routes `src/pages/data/[file].json.ts`/`src/pages/js/[file].js.ts` dùng `src/lib/root-static-artifacts.ts`; validator so exact root inventory (`:45-72`). Giữ private `data/sgsdeck` exclusion với directory/symlink/root checks (`:18-42`). Internal merge ledger đặt dưới private subtree hoặc ngoài data root; không thêm wildcard.
2. `scripts/verify-astro-dist.mjs:36-60` kiểm exact emitted paths và exact bytes; private path check ở `:85`. Cần test raw snapshot/identity/provenance ledger không có URL route trong dev, build/dist và preview; public lookup JSON không chứa sourceName/sourceUrl/sourceRecord/sourceSnapshot/raw Chinese description bị lộ qua card/source controls. Không nhầm test cấm provenance public với cấm chữ Hán trong search aliases.
3. Worker inventory khác public manifest. Hiện `ARTIFACT_NAMES` chỉ sáu artifact (`mcp-worker/src/data/artifact-contracts.ts:4-11`) và static source yêu cầu exact set (`static-assets-data-source.ts:121-125`). Các supplemental JSON website-only thuộc **allowed input files**, không phải emitted MCP assets. `build-worker-assets.ts:111-125` hiện còn reject mọi directory, kể cả private sgsdeck; CLI allowed files chỉ facets/khaihoang/tactics-generic (`:285-297`). Đây là closure gap hiện có cần sửa có test với season owner: exact permitted public non-MCP files + một private subtree được kiểm thật, không skip arbitrary directories. Không cố build sạch bằng bỏ file/WIP hay bypass clean-state guard (`:178-185`).
4. Plan mùa phase 4 sở hữu versioned v1 six/v2 eleven artifact inventory, giữ fixture v1 bytes (`plans/260907-0233-season-team-lookup/phase-04-mcp-and-release-validation.md:10-16,34-40`). Unified catalog không hardcode thay `6→10`/`11→15`. Handoff một inventory đã compose theo version thực tế; bốn nhóm web có thể nằm một hoặc nhiều public artifact nhưng không tự nhập MCP snapshot.
5. `mcp-worker/workflow-source-manifest.json:8-29` gồm shared matcher/identity/maps/engine/data/contracts. Sau sửa semantic graph, update closure nếu có dependency mới, regenerate `src/generated/workflow-build.ts` và verify generator. Dữ liệu định danh riêng bằng releaseId (`:49-51`); changed hero/tactic bytes tạo release mới dù công cụ không đổi.
6. Release checks/fixtures owner: `mcp-worker/scripts/{build-worker-assets,verify-worker-assets,verify-release,generate-workflow-build}.ts`, `mcp-worker/src/release/worker-release-evidence.ts`, `mcp-worker/test/data/*`, `test/release/*`, `test/domain/{source-graph,workflow-build}.test.ts`, `test/fixtures/release-snapshot/manifest.json`. Không overwrite historical fixture bằng corpus mới. Catalog-only data update vẫn phải invalid stale data/workflow bindings theo contract đang có.

## 5. MCP: bắt buộc tương thích và phần không tự mở rộng

**Trong scope:** merged heroes/tactics ở đúng file/key dạng mảng, `viet` và canonical IDs cũ bất biến; duplicate canonical IDs bị reject; search aliases/matchedTerm bounded và không trả “record mới” thành team; normalization/review/conflict giữ semantics. `snapshot-index.ts:10,102-124,183-227` hiện chỉ four search kinds; `research-contracts.ts:533-590` strict search input/output và result tối đa 50; `research-handlers.ts:399-434` search chỉ chiếu identity, không trả mô tả chi tiết hero/tactic. Không hứa MCP mới xem được chỉ số merged chỉ vì dictionary có field đó.

**Không bắt buộc sửa domain union:** `domain/contracts.ts:4-33` và `canonical-state.ts:45-50` mô hình tài nguyên hero/tactic/team, giữ nguyên. Variant 40Y có thể cần mở enum identity có chủ đích và parity tests nếu shared identity output được đổi; không cần mở observation cho equipment/advisor/building.

**Nếu controller muốn thêm MCP sáu nhóm:** phải ghi rõ public contract addition: new versioned artifact schema/count/hash/index cho supplemental catalogs; search kind enums và namespace ID; bounded lookup detail tool/handler (hiện chỉ có get_team); schema/tool registry/descriptions, pagination/cursor, source/provenance/error payload, CLI/stdio/HTTP parity và snapshot capability discovery. Cần giữ old tool input/output compatibility hoặc ghi migration/version chính xác; không chỉ thêm enum `kind` rồi tuyên bố đủ. Chưa nằm trong accepted brainstorm, nên không đưa việc này thành điều kiện chặn giao sáu nhóm web.

## 6. Red → Green → Refactor cho execution plan

Mọi hàng: viết và **chạy Red đúng lỗi hành vi trước code**, lưu command/assertion/output; Green bằng hành vi thật/merged corpus reviewed; Refactor chạy focused set lại rồi consumer regression. Lỗi Node/environment, thiếu dependency hoặc stale build không tính Red. Report này không có test đã chạy.

| Lát cắt | Red cần chứng minh | Green/Refactor và test owners |
|---|---|---|
| Dictionary bridge/identity | Tên/IDs cũ bị đổi; SP/CO/40Y va nhau; alias giản/phồn đúng thực thể bị miss; ambiguity bị tự confirm; tự mang/truyền thừa bị orphan | `tests-js/{hero-identity,match-dict,analyze-map,roster-scan-map,hero-detail}.test.mjs`, MCP `test/data/{artifact-contracts,snapshot-index}.test.ts`, `test/domain/legacy-domain-adapter.test.ts`; full inventory old canonical IDs và reviewed relation fixtures. Không sửa expected identity để che regression. |
| Ưu tiên field và Việt hóa UI | Hạ Hầu Đôn Khiên S chưa ra; 11 field deltas sai profile; valid 0 thành dash; placeholder xóa local; pending giả trong khi có nội dung; hero tactic hiện effect raw thay Việt | Python merge tests do data owner sở hữu + `tests-js/{hero-detail,hero-list,tactics-data}.test.mjs`; dự kiến thêm `tests-js/unified-lookup.test.mjs` cho view model/search. Existing tactics tests có số liệu in-game (`tactics-data.test.mjs:9-35,46-55`): chỉ cập nhật fixture nào SGSDeck valid khác theo quyết định đã chốt, giữ evidence vì sao thay; không blanket nới assertions. |
| Sáu nhóm/nav/detail | Sáu nhóm chưa truy cập; cùng record hiện hai hồ sơ; `#heroes/#tactics` rơi về PK; Back/Forward sai; option/level cuối không mở được; relation missing link giả; nguồn hiện trên catalog | `tests-js/{runtime-asset-contract,frontend-shell-contract,astro-dev-contract}.test.mjs`, `tests-e2e/spa-parity.spec.mjs`, dự kiến `tests-e2e/unified-lookup.spec.mjs`. Exact one active nav/section, group alias, total results accessible, all relation targets, source-free catalog, giữ source/score của đội. |
| A11y/responsive/error | Tab focus thoát modal hoặc không trả trigger; Escape/backdrop lỗi; arrow/selected nav sai; mobile overflow; supplemental load lỗi không có trạng thái trong lookup | UI E2E light/dark + mobile/desktop, focus và keyboard thực; controlled network failure kiểm localized lookup error và sections khác vẫn usable. Dùng existing browser fixtures, không fake data để thay corpus nghiệm thu. |
| Soi/kho/tracker/team | Legacy storage/import mất names; scan cũ đổi IDs; new dictionary làm tùy tiện chọn runner-up; tracker options/history lệch; engine tạo đội/điểm mới | `tests-js/{roster-scan-state,roster-scan-map,recruit-tracker-store,recruit-tracker-ui,derive-team-faction,team-recommend-engine}.test.mjs`, `tests-e2e/{spa-parity,mcp-domain-compatibility}.spec.mjs`; cùng corpus đội/roster cũ phải giữ candidates/selection; new catalog-only entities không thành recommendation. |
| MCP compatibility/version | Duplicate canonical ID được accept; wrong namespace; shared alias khác browser; stale release cursor/binding còn dùng; strict schemas/transport lệch | MCP `test/data/*`, `test/research/research-handlers.test.ts`, `test/mcp/registry.contract.test.ts`, `test/domain/{canonical-state,normalization-service,recommendation-service,workflow-build,source-graph}.test.ts`, `test/transport/all-tools-parity.test.ts`, `test/e2e/team-research-workflow.test.ts`. Không thêm tools/kinds để làm test “six groups” xanh. |
| Allowlist/release | File public mới không route, raw ledger được publish, symlink private bị bỏ qua, worker rejects catalog-only files hoặc emits chúng, v1 fixture/hash đổi | Root `tests-js/{runtime-asset-contract,astro-dist-contract,pages-headers-contract}.test.mjs`; MCP `test/release/{build-worker-assets,docs-static-assets-contract,workflow-release-contract,verify-release}.test.ts`, data sources/static source tests. Compose season inventory theo version. |

Sau focused Green/Refactor, do shared/public contract thay đổi: Node/Python regression phù hợp, root `npm run check`, `npm run build`, `npm run test:dist`, `npm run verify`, UI E2E; MCP generate/check workflow build, `npm run check` và relevant transport/worker tests. Đo real corpus budgets nếu corpus tăng ảnh hưởng snapshot/index/response. Build worker assets/dry-run chỉ trên source sạch hợp lệ và đúng ownership; blocked bởi WIP phải ghi là environment/release gate chưa chạy, không bypass hoặc deploy. Dọn đúng process test/server mình khởi chạy.

## 7. Dependency và unresolved

- Season owner giữ projector/config/score/context; catalog owner giữ merged identity/dictionary. Shared hot paths `js/app.js`, `js/hero-identity.js`, `src/lib/public-artifact-manifest.mjs`, worker builder/inventory và tests phải sequential handoff, không sửa song song cùng file.
- Controller cần thống nhất exact public supplemental filenames/schema với data researcher trước đóng phase manifests; UI research không tự áp schema khác.
- Không còn câu hỏi sản phẩm chặn plan. UI nav alias ở mục 2 là đề xuất cụ thể có thể đưa vào plan. MCP expansion chưa được yêu cầu; chọn compatibility-only làm baseline.

Status: DONE_WITH_CONCERNS
Summary: Đã lập UI/nav tối thiểu cho sáu nhóm, consumer closure, MCP compatibility boundary và các ca Red → Green → Refactor.
Concerns: Worker source-root builder hiện reject private sgsdeck/season files; cần phối hợp season owner và test versioned inventory. Exact supplemental filenames phải dùng một contract chung từ controller/data owner. Không có test/build/implementation được thực thi trong lượt nghiên cứu này.
