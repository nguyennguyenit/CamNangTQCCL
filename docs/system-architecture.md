# Kiến trúc hệ thống

## Tổng quan

Hệ thống có bốn boundary triển khai: pipeline dữ liệu chạy local, Astro static build tạo artifact Pages, Vision Worker tùy chọn và Research MCP read-only. Browser đọc JSON đã commit; không gọi pipeline và không có backend/database chung.

```text
DATA BUILD (local)                 SITE BUILD (local)               STATIC RUNTIME (Pages)
HTML export + curate maps         src/pages/index.astro             dist/index.html
raw crawl cache (tùy có)          root js|css|data                   dist/js|css|data
          │                              │                                │
          ▼                              ▼                                ├── fetch data/*.json
pipeline Python stdlib ───────► committed JSON ── Astro static ───────────┤
          │                              │                                ├── localStorage
          └── review diff                └── public/_headers ─► dist       └── local recommendation

OPTIONAL EXTERNAL VISION PATH
Browser image + Turnstile ──POST /analyze──► Cloudflare Worker
                                             │ guards + best-effort KV
                                             ▼
                                      DashScope Qwen Vision
                                             │ structured Chinese JSON
                                             ▼
Browser canonical mapping + local matching/recommendation

RESEARCH MCP PATH
managed client ──Bearer + Streamable HTTP──► Cloudflare Worker + private Static Assets
local MCP client ───────────stdio──────────► filesystem snapshot
                                     cả hai ──► cùng 8 schema/handler read-only
```

`mcp-worker/` là boundary nghiên cứu riêng, không nằm trong browser/Vision flow. Package có snapshot dữ liệu read-only, JSON CLI, stdio MCP và Cloudflare Streamable HTTP dùng chung registry/handler.

## Build-time data flow

1. HTML export trong `Meta Team PK/` được parser grid/team/Cùng Tồn/khai hoang đọc.
2. `normalize.py` áp aliases, nickname và chuẩn hóa team.
3. `build_json.py` dự kiến ghi `teams.json`, `facets.json`, `coexist.json`, `khaihoang.json`.
4. `build_dict.py` đọc cache/crawl Lingxi, link với facet và merge `tactics-generic.json` để ghi từ điển tướng/chiến pháp.
5. `build_books_dict.py` validate map binh thư curate với facet.
6. `build_team_tier.py` join bảng tier curate vào team ID.
7. Maintainer review diff và chạy test trước khi publish artifact.

Đường Tra cứu thống nhất tách khỏi legacy builder. `build_unified_lookup.py` đọc
baseline bất biến, snapshot SGSDeck đã checksum, registry danh tính và bản dịch
đã review từ một lần capture bytes; nó chỉ tạo candidate private. Promotion qua
`promote_unified_lookup.py` giữ shared lock và durable journal để thay bốn file
generation công khai có thể recover. Xem [quy trình vận hành](unified-lookup.md).

### Publication hiển thị tiếng Việt

`pipeline/site_localization.py` capture nguồn Recommended bất biến, kiểm ledger cùng receipt review, rồi dựng candidate private. Candidate đầy đủ chứa generation Recommended, `site-display.json` và một candidate Lookup được `build_unified_lookup.py` dựng/kiểm lại. Manifest site bind hash input, pin Recommended, generation cùng hash public Lookup và các source JSON hiển thị; publish chỉ thay generation Recommended với `data/website-display.json`, đồng thời từ chối nếu bốn file Lookup công khai không trùng candidate đã review.

`textRaw` và identity nguồn không bị sửa. `textVi` chỉ đi vào projection hiển thị sau review; dữ liệu root dùng overlay theo exact entity/field path. `npm run build` và `npm run verify` chạy gate public fail-closed trước khi tạo hoặc chấp nhận `dist/`.

Đường build cố ý không đưa `Team Đô Úy.html` vào artifact nên pipeline dựng ra ít Team PK hơn artifact công khai; các Team PK bổ sung vẫn chưa có đường tái tạo nhìn thấy. `pipeline/do-uy-ss18-source.json` giữ nguồn Đô Úy thô làm archive, không phải input publication. HTML/cache còn bị ignore. Vì vậy pipeline là công cụ bảo trì có điều kiện, chưa phải clean-clone reproducible build; số lượng hiện tại và quy trình an toàn thuộc [cảnh báo rebuild](deployment-guide.md).

### Dữ liệu đội theo kịch bản

[Builder sidecar](../pipeline/build_season_data.py) sở hữu đường build độc lập từ
nguồn curate `pipeline/season-*.json`. Việc xác nhận kịch bản không đồng nghĩa
với xác nhận luật VN; dữ liệu chỉ có attribution vẫn là tham khảo. `scenarioId`
giữ identity kịch bản qua các lần mở lại, còn `rulesetId` phân biệt bộ luật.
Không suy hai identity này từ số mùa hoặc ngày của nguồn nước ngoài.

[Resolver dùng chung](../js/season-context.js) sở hữu scope, cấu hình, tier và
điểm gắn với lựa chọn; [engine](../js/team-recommend-engine.js) sở hữu đối chiếu
tài nguyên và portfolio. `teamId` giữ identity đội, `configId` phân biệt cấu
hình để nhiều cấu hình cùng đội không trở thành nhiều đội trong portfolio.
Raw Cùng Tồn chỉ cung cấp nội dung tham khảo; dữ liệu nguồn chưa review không
tự trở thành cấu hình có thể gợi ý. Khai hoang tiếp tục dùng bản bảo trì mới
nhất, ngoài phạm vi sidecar mùa.

Xem [bảo trì dữ liệu đội theo kịch bản](season-team-data.md) cho đường cập nhật,
nguồn Recommended, điều kiện promote và kiểm chứng. Danh sách public artifact
thuộc [manifest của site](../src/lib/public-artifact-manifest.mjs).

## Static runtime

[`src/pages/index.astro`](../src/pages/index.astro) là Landing; tám trang mục tĩnh (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`) dùng chung `src/layouts/SiteLayout.astro`, mỗi trang một mount `#section-<id>` và `data-page-section` trên `<body>`. Layout phát pin Recommended, pin website-display, bảng route handle và hash dữ liệu mùa cho đúng trang cần (bảng ở [chuẩn code](code-standards.md)).
[`js/app.js`](../js/app.js) sở hữu khởi tạo runtime; nó capture từng response byte
một lần qua `createByteLoader()`, xác minh sidecar cùng hash của đúng các nguồn trang
đang dùng (băm song song, bảng nguồn theo trang ở [chuẩn code](code-standards.md))
rồi mới áp overlay tiếng Việt; `localizeData` từ chối nguồn chưa được xác minh.
Kho Tra cứu, `team-tier.json` và mô hình mùa chỉ tải ở trang dùng chúng và tải song song.
[`season-ui-state.js`](../js/season-ui-state.js) sở hữu query và kiểm hash toàn bộ
dữ liệu tham chiếu trước activation. [`lookup-data.js`](../js/lookup-data.js)
kiểm inventory/hash/generation của ba payload Tra cứu. Thay đổi ở bất kỳ
dependency đã được website-display pin đều dừng toàn bộ khởi tạo; lỗi semantic
Lookup trong một publication byte-coherent mới chỉ khóa các feature phụ thuộc.

Scope, filter/search, thứ tự hiển thị và chi tiết cấu hình cùng đi qua query owner của đúng trang; mục đang mở do đường dẫn quyết định, hash cũ chỉ được Landing chuyển tiếp qua `js/legacy-routes.js`. Restore scenario-only không tự nâng sang luật đã
review. Hai công cụ Soi đội và Gợi ý đội không có phạm vi mùa: luôn đối chiếu/gợi ý trên dữ liệu đội cũ và bỏ `scenario`/`ruleset`/`config` khỏi URL khi tải. UI không dùng MCP để suy thêm luật.

Hồ sơ tướng của Tra cứu đọc thêm artifact tính lúc build `hero-summaries.json` sinh trong chính generation Recommended đang pin (khóa nối chính xác theo từng nguồn, descriptor mang hash kho Tra cứu), nên mở hồ sơ chỉ cần `manifest.json` + `hero-summaries.json` thay vì nạp toàn bộ kho đội chuẩn. Phạm vi và ngân sách tải của đường này ghi ở [quyết định #12 của plan redesign](../plans/260923-1949-so-binh-phap-redesign/plan.md).

Hai trang danh sách đội đều gọi `createRecommendedSection()` của `team-filter-section.js`; cùng module còn dựng mục Cùng Tồn (`createSeasonCoexistSection()`). Module này tính facet trực tiếp từ tập source, tạo search/chip, thu gọn bộ lọc trên mobile; thẻ và bảng đội do `recommended-reference-render.js` dựng. `data/facets.json` không được load runtime.

Tra cứu và gợi ý cốt lõi chạy local:

- `lookup-data.js`: load một snapshot bốn file đã xác minh; không chấp nhận partial/mixed generation.
- `unified-lookup.js` và `lookup-detail.js`: một search/profile cho sáu nhóm, paging và quan hệ theo ID; không suy team/tier/availability từ catalog.
- `match-dict.js`: match Việt bỏ dấu/Hán-Việt/Hán.
- `hero-identity.js`: SP, CO và bản thường có canonical ID riêng; `familyId` chỉ biểu diễn quan hệ cùng họ, không thay thế identity khi xét sở hữu. Mỗi combined slot là một tập alternatives và chỉ cần đúng một alternative để thỏa slot.
- `filters.js`: chuẩn hoá chữ bỏ dấu (`normalizeText`) và blob tìm kiếm của một đội (`teamSearchBlob`), dùng chung giữa website và MCP.
- `team-recommend-engine.js`: xét ownership, conflict tướng/chiến pháp, alternatives, tier/red stars và portfolio tối đa 5 team.
- `coexist.json` và source-owned Cùng Tồn chỉ render tham khảo; recommender dùng dữ liệu legacy khi không có context hoặc cấu hình từ shared projector khi có cặp luật hợp lệ, không parse display string Cùng Tồn.

### Hợp đồng dữ liệu khai hoang

Trong [`data/khaihoang.json`](../data/khaihoang.json), `chamSuTeams` là trường top-level bổ sung cho bảng nguồn “Team Chạm Sứ------mang 1 lính”, độc lập với đội khai hoang chính. Bỏ `teams[].transforms` để sửa liên kết sai do trước đây ghép hai bảng theo hàng: consumer đọc trường cũ cần chuyển sang danh sách độc lập, không coi đây là phương án chuyển hình của từng đội. Mỗi nhóm giữ `id`, `title`, `heroes: [{name, tactic}]`, `note` và `sources: [{label, url}]`; ghi chú tướng thay thế thuộc cả nhóm khi ô nguồn phủ nhiều tướng. Không suy diễn tướng thứ ba, chủ tướng, binh chủng, tier hoặc cơ chế từ nhãn “mang 1 lính”.

Hướng dẫn khai hoang curate thuộc tùy chọn `teams[].guide`, sở hữu bởi đúng bộ ba tướng và không thuộc `variants[]`. Guide có thể chứa tổng quan, điểm mở đất/chuyển đội, yêu cầu đỏ, thứ tự quân thủ đất 4/5, cảnh báo, tách đội và các bước chuyển hình. Card tại `/khai-hoang/` chỉ dựng build, `buildNote` và anchor thật; `openingNote` cùng guide chỉ nằm trên `/khai-hoang/<handle>/`. `js/render.js` dùng chung phần build, còn `js/khaihoang-detail.js` xác minh pin nguồn/publication và đặt guide ngoài subtree thay thế khi đổi variant, nên nội dung và trạng thái mở giữ nguyên. `buildNote`/`openingNote` giữ owner team/hero/variant gốc; không ghép note của default vào variant. UI Khai hoang không trình bày mùa, khu vực hoặc link nguồn của đội chính; nguồn Chạm Sứ tiếp tục hiển thị theo contract riêng.

Owner hiển thị là [`khaihoangTable` trong `js/render.js`](../js/render.js): thứ tự ba khối là đội chính (`teams`) → **Đội Chạm Sứ / Ăn vạ** (`chamSuTeams`) → quân thủ mỏ (`mines`). Contract tương thích giữ object thiếu/rỗng `chamSuTeams` và input mảng mỏ legacy; chỉ ẩn khối Chạm Sứ khi không có dữ liệu. Kiểm chứng nằm ở [`tests-e2e/khaihoang-options.spec.mjs`](../tests-e2e/khaihoang-options.spec.mjs).
Handle Khai hoang đóng băng theo `teams[].id` trong `pipeline/team-route-handles.json` (ledger v2, Recommended publication vẫn v1); trang detail canonical theo pathname. `variant` chỉ hiện cho cấu hình khác mặc định và `from` chỉ được nhận khi trỏ tới pathname trang mục có trong allowlist `SECTION_QUERY_KEYS`, giữ đúng khóa của pathname đó (URL gốc cũ dạng `/?…#<tab>` được chuẩn hoá trước khi so). Root dùng `khTeam`/`khVariant` và map `khaihoangVariants` trong snapshot history/session hiện có; context key Khai hoang bỏ đúng hai query này để phục hồi các card khác, còn Team chuẩn/Team khác vẫn so URL chính xác. Source hash `data/khaihoang.json` và bản dịch `data/website-display.json` phải khớp trước khi dựng nội dung.

JSON đã curate là dữ liệu runtime cần bảo toàn. [`build_khaihoang_payload` trong `pipeline/build_json.py`](../pipeline/build_json.py) chỉ phản ánh HTML đầu vào: HTML cũ có sáu nhóm Chạm Sứ, còn bản CSV được đối chiếu có tám nhóm và một chiến pháp đã đổi. CSV chưa phải input tự động của pipeline HTML; không chạy full rebuild để nhập phần này vì có thể mất đội bổ sung, variants/options, mùa và mỏ đã curate. [Báo cáo đối chiếu nguồn](../plans/260907-0236-cham-su-khai-hoang/reports/source-reconciliation.md) giữ chi tiết khác biệt và bằng chứng bảo toàn; [fixture parser](../tests/fixtures/khaihoang-cham-su-source.html) giữ boundary kiểm thử không phụ thuộc HTML local bị ignore.

## Research MCP boundary

Luồng dùng chung hiện có:

```text
snapshot theo manifest v1/v2 (filesystem hoặc Worker Static Assets)
  → validate manifest/hash/cross-reference và dựng index
structured observations
  → normalize thành canonical state
  → caller rà soát/xác nhận
  → binding state + workflow
  → tám research handler
  → JSON CLI hoặc MCP stdio/Streamable HTTP
```

Inventory theo version thuộc [`artifact-contracts.ts`](../mcp-worker/src/data/artifact-contracts.ts):
v1 giữ sáu artifact legacy; v2 có thêm toàn bộ năm sidecar mùa.
[`FilesystemDataSource`](../mcp-worker/src/data/filesystem-data-source.ts) phân
biệt ba format: raw legacy, raw lookup có đúng cả hai website sidecar, và packaged
MCP có manifest cùng exact inventory. Mixed/partial root bị từ chối. Lookup
sidecars chỉ xác minh raw dictionary generation, không được emit thành MCP
artifact/tool kind. [`StaticAssetsDataSource`](../mcp-worker/src/data/static-assets-data-source.ts)
dùng manifest package để chọn exact inventory. Cả hai validate trước khi
[`data-source.ts`](../mcp-worker/src/data/data-source.ts) giữ snapshot immutable.

`mcp-worker/src/domain/normalization-service.ts` sở hữu chuẩn hóa và source precedence; ambiguity, identity/family conflict hoặc locked-resource conflict đặt trạng thái cần review. `canonical-state.ts` sở hữu projection/digest và xác minh binding. `recommendation-service.ts` chỉ gọi engine sau khi workflow, canonical state và binding khớp; trạng thái chưa phân giải hoặc binding cũ bị từ chối. Bằng chứng người dùng thật sự đã xác nhận vẫn thuộc caller, không phải điều research handler tự chứng minh.

Tám tên handler cùng schema request/result thuộc [`research-contracts.ts`](../mcp-worker/src/research/research-contracts.ts); dispatch và version/provenance/error behavior thuộc [`research-handlers.ts`](../mcp-worker/src/research/research-handlers.ts). CLI `npm run cli -- <lệnh>`, stdio `npm run stdio` và HTTP đều gọi cùng handler/schema. [`tool-definitions.ts`](../mcp-worker/src/mcp/tool-definitions.ts) chỉ thêm mô tả và annotation read-only; mỗi factory tạo `McpServer` mới.

[`public-snapshot-view.ts`](../mcp-worker/src/data/public-snapshot-view.ts) loại
Đô Úy và các cấu hình, evaluation, liên kết cùng bằng chứng chỉ thuộc phần bị
ẩn trước khi dựng index/projector; bằng chứng dùng chung còn được giữ. Public
view vẫn mang identity của raw release để không tạo một version dữ liệu khác.

Nhánh seasonal bind đúng cặp luật vào canonical confirmation và cursor.
[`season-domain-adapter.ts`](../mcp-worker/src/domain/season-domain-adapter.ts)
gọi shared projector; [`season-reference-projection.ts`](../mcp-worker/src/domain/season-reference-projection.ts)
sở hữu projection tham khảo có giới hạn. Client cần refresh output schema;
input không có context tiếp tục dùng nhánh legacy. Chi tiết hợp đồng consumer
nằm ở [Research MCP server](mcp-research-server.md).

Stdio dùng official SDK transport, giữ stdout chỉ cho protocol và ghi diagnostic cố định vào stderr. Remote Worker dùng raw Web-standard Streamable HTTP transport của SDK v1 ở chế độ JSON stateless; protocol `2025-11-25` được pin cho cả `initialize` đơn lẻ và trong batch. Trình tự `/mcp` là header guard rẻ → managed-client pre-shared bearer → rate/in-flight → đọc JSON theo byte thực tế và kiểm protocol → Static Assets/server; `/healthz` là liveness no-I/O. Origin hiện diện phải khớp chính xác và result cũng có trần. Bearer này không phải OAuth; không có OAuth server/discovery, client phải tự gắn `Authorization` header.

Remote data nằm trong cùng immutable Worker version với code. Worker chạy trước asset routing nên chỉ application code được gọi; public asset URL luôn `404`. Release builder tạo deterministic manifest và inventory đúng version từ Git tree sạch. Controller dùng prior `100%` + candidate `0%`, Version Override và exact deployment ownership trước khi promote/rollback. Chi tiết vận hành nằm ở [Research MCP server](mcp-research-server.md).

`workflowVersion` ghép full `releaseId` của canonical data manifest với `workflowBuildId` của semantic import closure; compact `dataVersion` chỉ để hiển thị. Inventory build chính xác thuộc [`workflow-source-manifest.json`](../mcp-worker/workflow-source-manifest.json); [`generate-workflow-build.ts`](../mcp-worker/scripts/generate-workflow-build.ts) kiểm closure bằng TypeScript AST, từ chối dynamic import không thể đóng và fail khi manifest/generated identity bị lệch.

Boundary này fail closed và có bounds trước xử lý: chuỗi/control characters và collection được giới hạn, ambiguity hay xung đột material chặn recommendation, output/corpus được clamp. Observation và corpus text được coi là dữ liệu không tin cậy; state/result không nhận hoặc giữ ảnh, base64, path, bearer/provider secret hay token. `coexist.json` chỉ là metadata tham khảo, không tham gia chấm điểm.

## Local state boundary

| State | Storage | Nội dung |
|---|---|---|
| Theme | `localStorage.theme` | `light` hoặc `dark` |
| Recruit tracker | `localStorage.tqcclRecruitTracker` | schema v1, account, banner, daily state, pull events |
| Roster scan | `localStorage.tqccl.rosterRecommend.scanState.v1` | tướng, chiến pháp, team khóa, confirmed, updatedAt |
| Ảnh | memory phiên UI | data URL preview/request; không serialize vào roster state |

Roster serializer loại `image`, `imageDataUrl`, `base64`, `blob`, `turnstileToken`. Tracker có validate import và JSON export/import để backup.

## Vision request flow

Các mode của `POST /analyze`:

- `analyzeTeamImage`
- `scanHeroes`
- `scanTactics`
- `scanBuiltTeams`

Luồng Worker:

1. Trả preflight hoặc kiểm tra `POST /analyze`.
2. Nếu request có `Origin`, yêu cầu khớp chính xác `ALLOWED_ORIGIN`; request không `Origin` vẫn được phép.
3. Parse body/mode; hash IP.
4. Kiểm tra kill-switch, per-hour/day/month qua KV best-effort.
5. Xác thực Turnstile và chống replay.
6. Validate image MIME, magic bytes và size sau decode.
7. Commit global usage, gọi DashScope Qwen, tolerant-parse và validate output theo mode.
8. Browser tiếp tục kiểm envelope tương ứng với mode cho cả response `200`; JSON lỗi hoặc sai shape được đổi thành thông báo tiếng Việt hữu hạn, không đi vào state review.

## Deployment boundary

| Surface | Artifact | Config |
|---|---|---|
| Cloudflare Pages | `dist/` từ `npm run build` | `public/_headers`, public Worker URL + Turnstile site key |
| Cloudflare Worker | `worker/src/*.ts` | vars trong `wrangler.toml`, KV binding, secrets trong Worker env |
| Research MCP Worker | `mcp-worker/src/worker.ts` | `wrangler.jsonc`, `ASSETS`, version metadata, managed bearer secret, Origin/limit vars |
| Research MCP local | `mcp-worker/src/stdio.ts` | filesystem snapshot; stdout protocol-only |
| Maintainer local | `pipeline/*.py`, HTML/cache/maps | không publish nguồn/cache riêng tư |

Config commit hiện trỏ Pages `https://tqccl.pages.dev` tới Worker `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/analyze`. Đây là public config hoạt động, không phải placeholder.

Astro dùng `output: "static"` và không có Cloudflare adapter/Pages Functions. Manifest explicit trong `src/lib/public-artifact-manifest.mjs` cho phép đúng các route JS/CSS/JSON; helper từ chối file lạ, symlink và path thoát root. `scripts/verify-astro-dist.mjs` là policy output duy nhất: kiểm allowlist, byte parity của raw asset và của mọi artifact trong `public/` (deployment-control lẫn static public) → `dist/`, đối chiếu `dist/sitemap.xml` với document sinh từ chính inventory route, đồng thời từ chối source/private/secret-like output.

Browser CI chỉ do `.github/workflows/mcp-worker.yml` sở hữu. Pull request/push chạm `data/**`, `pipeline/**`, `js/**`, `src/**`, Astro config hoặc test liên quan đều chạy một repository gate credential-free; gate bao gồm root build, dist contract, `npm run verify`, Playwright, Node, Python, Vision Worker và Wrangler dry-run. Không có workflow Pages thứ hai chạy một tập kiểm tra lệch.

`_headers` yêu cầu browser revalidate shell, JS, CSS và JSON (`public, max-age=0, must-revalidate`). Đây là local deployment contract; response header thật và SPA fallback body chỉ được xác nhận trên Pages preview có ủy quyền.

## Failure và fallback

- Thiếu `team-tier.json`: Gợi ý đội (trang duy nhất đọc file này) vẫn chạy với đội không có tier.
- Lỗi JSON bắt buộc: Team PK hiển thị hướng dẫn tải lại/liên hệ quản trị; các init sau không hoàn tất.
- Dependency trang đang dùng trong `data/website-display.json` đổi bytes hoặc sai pin: toàn bộ khởi tạo của trang dừng trước render và chỉ hiện lỗi tiếng Việt hữu hạn.
- Vision lỗi: tra cứu local và tracker vẫn độc lập; UI trả status theo lỗi Worker.
- Research MCP HTTP lỗi: CLI/stdio local vẫn độc lập; recommendation fail closed, không tự bịa đội hình.
- Research MCP trả `401/429/503` trước dữ liệu khi bearer, quota hoặc cấu hình không hợp lệ; `/healthz` không đại diện data readiness.
- Worker có `FEATURE_ENABLED` kill-switch; rollback Worker/Pages độc lập. Pages rollback phải promote toàn artifact known-good, purge cache bị ảnh hưởng và kiểm tra client mới/cũ.
- Mất localStorage: tracker/scan mất nếu người dùng chưa export backup.

## Bước tiếp theo

Khôi phục pipeline xác định và facet đồng bộ; bổ sung accessibility focus/keyboard/live region; đánh giá Durable Object nếu cần quota cứng.

## Tham chiếu

- [PDR](project-overview-pdr.md)
- [Deployment Guide](deployment-guide.md)
- [Code Standards](code-standards.md)
- [Worker README](../worker/README.md)
