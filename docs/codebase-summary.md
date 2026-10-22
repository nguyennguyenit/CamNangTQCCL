# Tóm tắt codebase

## Tổng quan

Repo có bốn boundary triển khai: Astro static build + SPA vanilla chạy trong trình duyệt, pipeline Python offline, Cloudflare Worker cho Vision và Research MCP read-only. `mcp-worker/` có domain services, snapshot loader, bảy shared handler, JSON CLI, stdio và authenticated Streamable HTTP. Không có framework UI, SSR lúc chạy, backend chung hoặc database ứng dụng; nội dung trang đội và Tra cứu được dựng sẵn lúc build từ cùng builder cây view với trình duyệt.

## Cấu trúc

```text
.
├── src/pages/              # Landing + 8 trang mục + trang chi tiết đội + trang nhóm/trang riêng Tra cứu + llms
├── src/lib/                # manifest, safe raw-artifact reader, dựng sẵn trang đội/Tra cứu, JSON-LD, llms
├── src/pages/{js,css,data} # Astro static endpoints
├── css/, js/, data/        # source runtime canonical
├── public/_headers         # Pages cache policy source
├── scripts/                # shared dist verifier, soát token/thiết kế, báo cáo zh-gaps (`docs/zh-gaps.md`)
├── pipeline/               # parser/normalizer/builder Python stdlib
├── worker/                 # Vision proxy Cloudflare
├── mcp-worker/             # data/domain + CLI/stdio/HTTP Research MCP read-only
├── tests/                  # Python unittest
├── tests-js/, tests-e2e/   # Node contracts + Playwright parity
├── docs/                   # tài liệu evergreen
└── plans/                  # kế hoạch/báo cáo lịch sử
```

## Điểm vào và module chính

| File | Vai trò |
|---|---|
| `src/pages/index.astro`, `src/pages/<mục>/index.astro` | Landing tĩnh (số liệu tính lúc build) và 8 trang mục; mỗi trang mục có một mount `#section-<id>` và nạp raw `/js/app.js`. |
| `src/lib/public-artifact-manifest.mjs` | Allowlist route/source/class cho mọi JS/CSS/JSON public. |
| `public/favicon.png` | Logo PNG 128×128, góc trong suốt; ảnh gốc từ [Thiên Thượng Hỏa](https://thienthuonghoa.com/assets/uploads/images/tqccl-logo.jpg). `STATIC_PUBLIC_ARTIFACTS` trong dist verifier kiểm byte parity; `/favicon.png` phải revalidate. |
| `src/lib/root-static-artifacts.ts` | Đọc raw artifact an toàn và trả bytes/MIME cho static endpoint. |
| `src/lib/host-bridge.ts` | Script inline đầu `<head>`: host cũ (`tqccl.pages.dev`, `www.tqccl.com`) chuyển về `https://tqccl.com` kèm localStorage bền trong fragment `#tqccl-migrate=`; host chính nhập khóa còn thiếu rồi trả hash gốc. |
| `scripts/verify-astro-dist.mjs` | Kiểm toàn bộ `dist/`, byte parity và deployment-control artifact. |
| `js/app.js`, `js/website-display.js` | Capture byte runtime, xác minh publication/source hash và áp overlay tiếng Việt trước khi khởi tạo mục của trang đang mở. |
| `js/team-filter-section.js` | Mục Đội chuẩn/Đội khác (`createRecommendedSection`: search, chip động, stats, xoá lọc, thu gọn trên mobile, Thẻ/Thẻ gọn/Bảng) và mục Cùng Tồn (`createSeasonCoexistSection`). |
| `js/render.js` | Builder dùng chung: `el`/icon (DOM) và `t`/`svgTree`/`iconTree` (cây view), nhóm Cùng Tồn, bảng Khai hoang (`khaihoangTableTree`/`khaihoangTable`), thân chi tiết Khai hoang (`khaihoangDetailTrees`) và chi tiết cấu hình mùa. |
| `js/view-tree.js` | Cây view một định nghĩa cho build và trình duyệt: `treeToHtml` (build, luôn escape), `treeToDom` (client), `treeToText` (llms), `disableButtons`/`enableControl` (nút dựng sẵn chờ gắn sự kiện). |
| `js/recommended-reference-render.js` | Thẻ, bảng, nhóm Tier và thân chi tiết Đội chuẩn/Đội khác/Cùng Tồn dưới dạng cây view; nhận `locale` tường minh. |
| `src/lib/team-ssr.ts`, `src/lib/team-section-ssr.js` | Dựng sẵn thân trang chi tiết đội và trạng thái mặc định của bốn trang danh sách từ publication đã pin. |
| `js/filters.js` | Chuẩn hoá chữ bỏ dấu và blob tìm kiếm của một đội, dùng chung với MCP. |
| `js/unified-lookup.js`, `js/lookup-page.js`, `js/lookup-profile.js`, `js/lookup-master.js`, `js/lookup-data.js`, `js/lookup-detail.js`, `src/lib/lookup-pages.ts` | Tra cứu bảy nhóm, mỗi nhóm một trang: nạp và xác minh payload theo trang, tìm kiếm, cây markup dùng chung build/DOM (trang nhóm dựng sẵn đủ mọi mục), hồ sơ và quan hệ theo ID; bốn nhóm catalog (Trang bị, Quân sư, Cải tạo binh chủng, Công trình) dùng bố cục danh sách + chi tiết của `lookup-master.js`. |
| `src/lib/lookup-item-pages.ts`, `src/components/pages/LookupItemPage.astro`, `js/lookup-item-page.js` | Trang riêng `/tra-cuu/<nhóm>/<slug>/` của từng mục: hồ sơ đầy đủ dựng lúc build, client chỉ gắn chân dung và nút phiên bản hiệu ứng. |
| `pipeline/lookup_route_handles.py`, `pipeline/lookup-route-handles.json`, `src/lib/lookup-detail-routes.ts`, `js/lookup-ids.js` | Ledger slug trang riêng đóng băng theo mã (`--write`/`--check`, mã rời corpus vào `retired`), loader kiểm ledger lúc build, `lookupHref`/`lookupItemPath` cho mọi link Tra cứu. |
| `src/lib/structured-data.ts` | JSON-LD trang chi tiết đội, trang nhóm và trang riêng Tra cứu (`ItemPage` + `mainEntity` `Thing`/`DefinedTerm`). |
| `src/lib/llms-documents.ts`, `src/pages/llms.txt.ts`, `src/pages/llms/[...path].txt.ts`, `src/pages/llms-full.txt.ts` | Một hàm sinh bộ llms chữ thuần theo mục và bản gộp `/llms-full.txt`. |
| `scripts/report-zh-gaps.mjs` | Báo cáo mục Tra cứu mà bản zh thiếu chữ (`viOnly`); ghi `docs/zh-gaps.md`; `--check` so với file đó và nằm trong `npm run verify` (`test:dist` chỉ kiểm bất biến). |
| `js/recruit-tracker-store.js`, `js/recruit-tracker.js`, `js/recruit-sync.js` | Theo dõi chiêu mộ: store schema v2 (bản ghi có `id`/`updatedAt`/dấu xóa, chuyển v1→v2, bảo hiểm tính từ lượt theo `occurredAt`, gộp LWW theo bản ghi), UI (ghi nhanh, Hoàn tác, nhật ký, hộp thoại `<dialog>`), client đồng bộ tuỳ chọn với `/api/recruit`. |
| `js/analyze.js`, `js/analyze-map.js`, `js/analyze-state.js` | Soi đội: nén ảnh, Turnstile, Worker call; ảnh hai phe có bước chọn phe (`normalizeTeamRead`); khớp 3 trạng thái cho editor xác nhận, diff từng ô với Đội chuẩn theo mùa/Đội khác (`findSimilarTeams` giữ cho MCP); link `?doi=v1.…`, lịch sử trên máy, thẻ PNG; đếm ẩn danh số ô phải sửa (`readStats` → `/api/scan-stats`) và gửi ảnh tự nguyện (`/api/scan-samples`). |
| `worker/eval/` | Bộ ảnh chuẩn Soi đội: ảnh đã che tên + fixture ID canonical, `score.ts` chấm qua `draftFromRead`, `run-eval.ts` (`npm run eval:vision`) in độ chính xác theo màn hình × trường và p50/p95. |
| `js/hero-identity.js` | Canonical identity tướng: SP/CO/base tách biệt, `familyId` riêng và combined slot là alternatives. |
| `js/roster-scan-state.js` | Serialize scan state, loại dữ liệu ảnh/token. |
| `js/roster-conflict-view.js` | Hàm thuần đổi `conflictedTeams` của engine thành thẻ mục "tranh món" (đổi id đội giữ món thành tên, tối đa 5 thẻ + số đội ẩn); chữ hiển thị do `roster-recommend-ui.js` truyền vào. |
| `js/team-recommend-engine.js` | Chấm tier, kiểm tra conflict, greedy/DFS và tạo portfolio local. |
| [`mcp-worker/src/data/artifact-contracts.ts`](../mcp-worker/src/data/artifact-contracts.ts) | Owner của canonical manifest/snapshot gồm đúng sáu artifact và full `releaseId`. |
| [`mcp-worker/src/data/{filesystem-data-source,static-assets-data-source,data-source}.ts`](../mcp-worker/src/data/) | Nguồn filesystem/Static Assets read-only và cache snapshot immutable. |
| `mcp-worker/src/domain/{contracts,canonical-state,normalization-service,digest-encoding}.ts` | Luồng pure normalize → xác nhận binding; `legacy-domain-adapter.ts` và `season-domain-adapter.ts` là adapter vào `js/` (find-similar, cấu hình mùa engine). Recommend không còn service riêng: `tqccl_recommend_teams` gọi `recommendRoster` trực tiếp. |
| [`mcp-worker/src/data/{publication-projection,publication-builder,publication-source-reader}.ts`](../mcp-worker/src/data/) | Snapshot manifest v3: projection xuất bản (Recommended + Tra cứu) thành artifact, builder thuần bytes→bytes, reader cho checkout raw; `public-snapshot-view.ts` loại phần ẩn, `snapshot-index.ts`/`lookup-bundle.ts` dựng index/sidecar. |
| [`mcp-worker/src/knowledge/`](../mcp-worker/src/knowledge/), [`agent-knowledge/`](../agent-knowledge/), `mcp-worker/src/generated/knowledge-bundle.ts` | Dataset luật canonical cho skill/MCP: contract, validate, điều kiện ba trị, `resolve-playbook`, `search-rules`; bundle sinh bởi `scripts/generate-knowledge-bundle.ts` (`knowledgeVersion` riêng, không nằm trong `workflowVersion`). |
| [`mcp-worker/src/research/{research-contracts,research-handlers}.ts`](../mcp-worker/src/research/) | Schema authority và dispatch dùng chung cho bảy research operation; kết quả có workflow identity/provenance/bounds. |
| [`mcp-worker/src/cli.ts`](../mcp-worker/src/cli.ts), [`package.json`](../mcp-worker/package.json) | `npm run cli -- <lệnh>` gọi trực tiếp shared handler qua filesystem snapshot và xuất một JSON document. |
| [`mcp-worker/src/mcp/`](../mcp-worker/src/mcp/) | Registry dùng đúng bảy schema object, annotation read-only, factory server mới và formatter non-echo. |
| [`mcp-worker/src/stdio.ts`](../mcp-worker/src/stdio.ts) | Official stdio transport; stdout chỉ chứa MCP protocol, diagnostic vào stderr. |
| [`mcp-worker/src/worker.ts`](../mcp-worker/src/worker.ts), [`wrangler.jsonc`](../mcp-worker/wrangler.jsonc) | Stateless Streamable HTTP `/mcp`, managed bearer, guards, private Static Assets và version metadata. |
| [`mcp-worker/src/security/`](../mcp-worker/src/security/) | Bearer rotation tối đa 15 phút, digest/fingerprint, request guards và isolate-local limits. |
| [`mcp-worker/workflow-source-manifest.json`](../mcp-worker/workflow-source-manifest.json), [`generate-workflow-build.ts`](../mcp-worker/scripts/generate-workflow-build.ts) | Owner của semantic closure và `workflowBuildId`; `workflowVersion` ghép identity này với full `releaseId`. |
| [`mcp-worker/scripts/`](../mcp-worker/scripts/) | Deterministic asset build/evidence, exact-version deployment controller, live/edge verifier và repository gate credential-free. |
| `pipeline/site_localization.py`, `pipeline/site-localization-policy.json` | Inventory/review gate, candidate private và publication pin chung cho display, Recommended và Lookup. |
| `pipeline/build_json.py` | Build team, facet từ HTML export + `team-intro-supplement.json` (trùng byte bản commit, `--check`); Cùng Tồn, khai hoang chỉ với `--overwrite-curated`. |
| `pipeline/build_books_dict.py` | Validate bảng map Hán→Việt với facet binh thư; mang hiệu ứng (`effect`/`effectViet`/`effectVersion`, đủ cả ba) và tên nguồn (`sourceNames`/`excludedSourceNames`). |
| `pipeline/build_team_tier.py` | Join tier curate theo team ID, validate tier fail-loud. |
| `worker/src/index.ts` | `POST /analyze`: origin, limits, Turnstile, image guard, model, response. |
| `worker/src/config.ts`, `schema.ts` | Env config và schema kết quả cho 4 mode. |
| `community-worker/src/routes/teams.ts`, `community-worker/src/teams-validate.ts`, `community-worker/migrations/0008_community_teams.sql` | Đội cộng đồng: mùa, đội + ảnh R2, vote, duyệt, xoá hai bước (`deleting_at` rồi dọn R2), AI nháp qua `callModel` nhóm `teamScan`; điểm/`hot_rank`/`top_rank` là cột sinh STORED, bộ đếm do trigger đếm lại. Rollback evidence: `community-worker/rollback/0009*`, `0010*` (chạy tay). |
| `js/community-teams.js`, `js/community-team-state.js`, `js/community-team-form.js`, `js/community-team-data.js`, `src/components/pages/CommunityTeamsPage.astro` | Trang `/doi-cong-dong/` (vi + `/zh/`): danh sách, chi tiết, form đăng, của tôi; hàm thuần tách khỏi DOM và mạng. |

## Dữ liệu runtime

| Artifact | Snapshot công khai 2026-09-27 |
|---|---:|
| `data/teams.json` | 166: 56 team-intro, 110 moi-phe |
| `data/team-tier.json` | 31 team, 39 rankings |
| `data/tactics.json` | 409 (Tra cứu thống nhất, [unified-lookup.md](unified-lookup.md)); 407 chiến pháp lấy chữ/số liệu client Global, 2 chiến pháp của SP Tào Tháo theo bản Trung (`pipeline/lookup-client-tactics.json`, gồm 29 mục chỉ có ở client: 13 chiến pháp và 16 chiến pháp binh chủng Tinh của mùa Binh Diễn Xuân Thu), 18 mã trùng đã gộp (`lookup.formerIds`) |
| `data/heroes-dict.json` | 251 = 201 baseline/SGSDeck (đã bỏ Hà Thị, không có ở client) + 50 từ client Global (`pipeline/lookup-client-heroes.json`) — Tra cứu thống nhất; chân dung tự lưu ở `public/heroes/` |
| `data/books-dict.json` | 68 (mỗi dòng mang `id` cố định từ `pipeline/books-han-viet-map.json`) |
| `data/coexist.json` | 5 nhóm, 25 team |
| `data/khaihoang.json` | 17 team, 5 mỏ |
| `data/tactics-generic.json` | 29 record nguồn |

Ngày 2026-09-06, `data/khaihoang.json` trong repository có **15 team, 5 mỏ**: thêm Gia Cát Khác · Thái Sử Từ · Tả Từ theo [research](../plans/reports/research-260906-1347-gia-cat-khac-thai-su-tu-ta-tu.md), hai bộ ba còn thiếu theo [đối chiếu Google Sheet](../plans/reports/import-260906-1413-khaihoang-google-sheet.md), và Chu Thái · Trương Phi · Trương Xuân Hoa theo [nguồn Nhật Global](../plans/reports/research-260906-1533-chu-thai-truong-phi-truong-xuan-hoa-global.md). Đội mới dùng bản Kazten với Trương Phi chủ tướng và Kích Kỳ Nọa Quy sau thức tỉnh; khác biệt S20 được ghi chú, chưa gán tên Việt cho 疾風豪雨 hoặc tier mùa hiện tại. Bốn đội bổ sung được curate trực tiếp trong JSON canonical; khi chạy lại pipeline HTML phải giữ lại vì nguồn HTML cũ chưa chứa các đội này. Đây là trạng thái local, không xác nhận đã deploy.

Tab Khai hoang hỗ trợ `variants[]` tùy chọn trên từng đội: cấu hình độc lập với `id`, `label`, `region`, `period`, `unitType`, `heroes`, `note` và chủ tướng trước/sau cấp 20 khi đã xác minh. Native select đổi cả bộ chiêu; không kế thừa giai đoạn hoặc chuyển hình chưa được nguồn xác nhận. Không có `variants` thì giữ card cũ. Lựa chọn chỉ có hiệu lực trong phiên trang, không lưu vào kho tướng. Snapshot local có 12 lựa chọn trên 10 đội; Khác–Bình–Tiến dùng Thương ở cả hai giai đoạn. Pipeline HTML là importer nguồn cũ, chưa sở hữu phần curate này: khi rebuild phải bảo toàn `variants`, `context`, `sources` và các sửa tay, không dùng output HTML ghi đè trực tiếp runtime. Contract được kiểm bởi `tests-js/khaihoang-data.test.mjs` và `tests-e2e/khaihoang-options.spec.mjs`.

`season`/`seasonNote` ở root khai hoang ghi mùa mục tiêu Binh Diễn Xuân Thu theo xác nhận người dùng; nguồn mùa khác vẫn được ghi riêng, không tự nâng thành tier mùa hiện tại. Các cấu hình chưa mô tả nhánh binh chủng tùy chỉnh.

Đồng Lòng Hợp Sức được xác minh bằng ảnh client Việt 06/09/2026 là 勠力同心, chiến pháp sự kiện Chủ động trị liệu/tăng Thống Soái; bản ghi hiện nằm trong từ điển do Tra cứu thống nhất sở hữu ([unified-lookup.md](unified-lookup.md)); `data/tactics-generic.json` chỉ còn là artifact công khai cũ (`legacy-public/build-input`). 戮力上国 giữ nguyên hiệu ứng Nội chính và tên Hán-Việt Lục Lực Thượng Quốc; override cũ gán Đồng Lòng Hợp Sức đã được sửa.

`data/facets.json` có 74 tướng, 106 chiến pháp, 67 binh thư, 4 loại binh, 3 mức sao, 5 phe, 2 trạng thái, 2 nguồn; tổng source là 166 (bằng `teams.json`, `tests/test_build.py` chặn lệch). Frontend không fetch artifact này: tab team tính facet trực tiếp từ tập team runtime.

## Local state và external state

- `theme`: light/dark trong `localStorage`.
- `tqcclRecruitTracker`: tracker schema version 2 (v1 tự chuyển khi đọc); có export/import JSON (nhập = gộp). `tqcclRecruitTracker:sync` (`{userId, cursor, pushedAt}`) và `tqcclRecruitTracker:invite` là khóa phụ, không mang qua cầu chuyển domain.
- `tqccl.rosterRecommend.scanState.v1`: tên tướng/chiến pháp/team khóa, xác nhận và timestamp; không ảnh/base64/blob/token.
- `tqccl.teamView.v1`: kiểu xem Thẻ/Thẻ gọn/Bảng của Đội chuẩn/Đội khác.
- `tqccl.analyze.history.v1`: tối đa 10 đội Soi đội đã đối chiếu (`doi` chỉ ID canonical, mùa, thời điểm); không ảnh/token.
- Năm khóa trên là allowlist `HOST_BRIDGE_KEYS` mà cầu chuyển domain (`src/lib/host-bridge.ts`) mang từ host cũ sang `https://tqccl.com`.
- Ảnh preview giữ trong memory/data URL của phiên UI, gửi tới Worker khi người dùng xác thực.
- Worker dùng KV cho replay/rate/cap; secret và API key chỉ ở Worker environment.

## Kiểm thử

- `tests/`: parser, normalize, build, từ điển, tier, crawl/link, ledger handle đội và slug Tra cứu.
- `tests-js/`: Astro/dist/header contracts, SEO dist (`seo-dist-contract`: link path, JSON-LD, llms, bất biến zh-gaps), cây view của builder đội/hồ sơ Tra cứu, filter, map, Tra cứu, mobile menu, tracker, roster state và recommend engine.
- `tests-e2e/`: Chromium parity, nội dung dựng sẵn khi không JavaScript và việc nhận lại DOM (`team-ssr-*`, `lookup-item-pages`), storage, JSON failure, exposure local/routed HTTPS và mixed-content.
- `worker/test/`: config, guard, model, rate-limit, scan modes, schema.
- `mcp-worker/test/`: snapshot/filesystem/Static Assets/cache, bảy tool, CLI/stdio/HTTP parity, bearer/limits/protocol, ownership-safe release/rollback, verifier, import guard và production-shaped Workerd budget.

Gate thống nhất nằm ở `.github/workflows/mcp-worker.yml`: `mcp-worker/scripts/check-repository.ts` chạy MCP, root Astro build/dist/`npm run verify`/E2E/Node/Python, Vision Worker và Wrangler dry-run trong môi trường không có release credential. Kết quả có thời điểm của migration Worker Static Assets nằm trong [`implementation-verification.md`](../plans/260731-0237-thay-r2-bng-worker-static-assets/reports/implementation-verification.md); đây là bằng chứng local, không phải bằng chứng production.

## Điểm cần chú ý

- `build_json.py` cố ý loại Đô Úy; từ HTML + input curate (`aliases.json`, `team-nicknames.json`, `team-intro-supplement.json`) tái tạo trùng byte `teams.json` 56 + 110 và `facets.json`. `khaihoang.json` curate vượt HTML, không rebuild.
- 48 team Đô Úy từng công khai đã được retire; chỉ còn nguồn thô/archive 40 record tại `pipeline/do-uy-ss18-source.json`, không tham gia build/publication.
- `plans/` có thể chứa mô tả cũ; kiểm chứng bằng code, config và JSON commit.
- Remote MCP bearer là pre-shared credential cho managed client, không phải OAuth access token. Production release chỉ tiếp tục khi live edge rate control, exact candidate identity và ownership-safe rollback gate đạt.

## Bước tiếp theo

Khi sửa behavior: bắt đầu từ module section/store/engine tương ứng, chạy test hẹp, rồi mở rộng test contract. Khi sửa data: backup artifact và review diff trước khi commit.

## Tham chiếu

- [Chuẩn code](code-standards.md)
- [Kiến trúc hệ thống](system-architecture.md)
- [Roadmap](project-roadmap.md)
