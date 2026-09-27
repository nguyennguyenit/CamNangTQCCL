# Tóm tắt codebase

## Tổng quan

Repo có bốn boundary triển khai: Astro static build + SPA vanilla chạy trong trình duyệt, pipeline Python offline, Cloudflare Worker cho Vision và Research MCP read-only. `mcp-worker/` có domain services, snapshot loader, tám shared handler, JSON CLI, stdio và authenticated Streamable HTTP. Không có renderer frontend, SSR, backend chung hoặc database ứng dụng.

## Cấu trúc

```text
.
├── src/pages/              # Landing + 8 trang mục + trang chi tiết đội
├── src/lib/                # manifest và safe raw-artifact reader
├── src/pages/{js,css,data} # Astro static endpoints
├── css/, js/, data/        # source runtime canonical
├── public/_headers         # Pages cache policy source
├── scripts/                # shared dist verifier
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
| `js/render.js` | DOM builder dùng chung (`el`, icon), nhóm Cùng Tồn, bảng Khai hoang và chi tiết cấu hình mùa. |
| `js/filters.js` | Chuẩn hoá chữ bỏ dấu và blob tìm kiếm của một đội, dùng chung với MCP. |
| `js/unified-lookup.js`, `js/lookup-data.js`, `js/lookup-detail.js` | Tra cứu sáu nhóm: nạp và xác minh snapshot, tìm kiếm, hồ sơ và quan hệ theo ID. |
| `js/recruit-tracker-store.js` | State schema v1, nhiều account, banner, pity, import/export localStorage. |
| `js/analyze.js`, `js/analyze-map.js` | Nén ảnh, Turnstile, Worker call, canonical map và team similarity. |
| `js/hero-identity.js` | Canonical identity tướng: SP/CO/base tách biệt, `familyId` riêng và combined slot là alternatives. |
| `js/roster-scan-state.js` | Serialize scan state, loại dữ liệu ảnh/token. |
| `js/team-recommend-engine.js` | Chấm tier, kiểm tra conflict, greedy/DFS và tạo portfolio local. |
| [`mcp-worker/src/data/artifact-contracts.ts`](../mcp-worker/src/data/artifact-contracts.ts) | Owner của canonical manifest/snapshot gồm đúng sáu artifact và full `releaseId`. |
| [`mcp-worker/src/data/{filesystem-data-source,static-assets-data-source,data-source}.ts`](../mcp-worker/src/data/) | Nguồn filesystem/Static Assets read-only và cache snapshot immutable. |
| `mcp-worker/src/domain/{contracts,canonical-state,normalization-service,recommendation-service}.ts` | Luồng pure normalize → xác nhận binding → recommend. |
| [`mcp-worker/src/research/{research-contracts,research-handlers}.ts`](../mcp-worker/src/research/) | Schema authority và dispatch dùng chung cho tám research operation; kết quả có workflow identity/provenance/bounds. |
| [`mcp-worker/src/cli.ts`](../mcp-worker/src/cli.ts), [`package.json`](../mcp-worker/package.json) | `npm run cli -- <lệnh>` gọi trực tiếp shared handler qua filesystem snapshot và xuất một JSON document. |
| [`mcp-worker/src/mcp/`](../mcp-worker/src/mcp/) | Registry dùng đúng tám schema object Phase 3, annotation read-only, factory server mới và formatter non-echo. |
| [`mcp-worker/src/stdio.ts`](../mcp-worker/src/stdio.ts) | Official stdio transport; stdout chỉ chứa MCP protocol, diagnostic vào stderr. |
| [`mcp-worker/src/worker.ts`](../mcp-worker/src/worker.ts), [`wrangler.jsonc`](../mcp-worker/wrangler.jsonc) | Stateless Streamable HTTP `/mcp`, managed bearer, guards, private Static Assets và version metadata. |
| [`mcp-worker/src/security/`](../mcp-worker/src/security/) | Bearer rotation tối đa 15 phút, digest/fingerprint, request guards và isolate-local limits. |
| [`mcp-worker/workflow-source-manifest.json`](../mcp-worker/workflow-source-manifest.json), [`generate-workflow-build.ts`](../mcp-worker/scripts/generate-workflow-build.ts) | Owner của semantic closure và `workflowBuildId`; `workflowVersion` ghép identity này với full `releaseId`. |
| [`mcp-worker/scripts/`](../mcp-worker/scripts/) | Deterministic asset build/evidence, exact-version deployment controller, live/edge verifier và repository gate credential-free. |
| `pipeline/site_localization.py`, `pipeline/site-localization-policy.json` | Inventory/review gate, candidate private và publication pin chung cho display, Recommended và Lookup. |
| `pipeline/build_json.py` | Build team, facet từ HTML export + `team-intro-supplement.json` (trùng byte bản commit, `--check`); Cùng Tồn, khai hoang chỉ với `--overwrite-curated`. |
| `pipeline/build_books_dict.py` | Validate bảng map Hán→Việt với facet binh thư. |
| `pipeline/build_team_tier.py` | Join tier curate theo team ID, validate tier fail-loud. |
| `worker/src/index.ts` | `POST /analyze`: origin, limits, Turnstile, image guard, model, response. |
| `worker/src/config.ts`, `schema.ts` | Env config và schema kết quả cho 4 mode. |

## Dữ liệu runtime

| Artifact | Snapshot công khai 2026-09-27 |
|---|---:|
| `data/teams.json` | 166: 56 team-intro, 110 moi-phe |
| `data/team-tier.json` | 31 team, 39 rankings |
| `data/tactics.json` | 406 (Tra cứu thống nhất, [unified-lookup.md](unified-lookup.md)) |
| `data/heroes-dict.json` | 202 (Tra cứu thống nhất) |
| `data/books-dict.json` | 66 |
| `data/coexist.json` | 5 nhóm, 25 team |
| `data/khaihoang.json` | 17 team, 5 mỏ |
| `data/tactics-generic.json` | 29 record nguồn |

Ngày 2026-09-06, `data/khaihoang.json` trong repository có **15 team, 5 mỏ**: thêm Gia Cát Khác · Thái Sử Từ · Tả Từ theo [research](../plans/reports/research-260906-1347-gia-cat-khac-thai-su-tu-ta-tu.md), hai bộ ba còn thiếu theo [đối chiếu Google Sheet](../plans/reports/import-260906-1413-khaihoang-google-sheet.md), và Chu Thái · Trương Phi · Trương Xuân Hoa theo [nguồn Nhật Global](../plans/reports/research-260906-1533-chu-thai-truong-phi-truong-xuan-hoa-global.md). Đội mới dùng bản Kazten với Trương Phi chủ tướng và Kích Kỳ Nọa Quy sau thức tỉnh; khác biệt S20 được ghi chú, chưa gán tên Việt cho 疾風豪雨 hoặc tier mùa hiện tại. Bốn đội bổ sung được curate trực tiếp trong JSON canonical; khi chạy lại pipeline HTML phải giữ lại vì nguồn HTML cũ chưa chứa các đội này. Đây là trạng thái local, không xác nhận đã deploy.

Tab Khai hoang hỗ trợ `variants[]` tùy chọn trên từng đội: cấu hình độc lập với `id`, `label`, `region`, `period`, `unitType`, `heroes`, `note`, `sources[{label,url}]` và chủ tướng trước/sau cấp 20 khi đã xác minh. Native select đổi cả bộ chiêu và nguồn; không kế thừa giai đoạn hoặc chuyển hình chưa được nguồn xác nhận. Không có `variants` thì giữ card cũ. Lựa chọn chỉ có hiệu lực trong phiên trang, không lưu vào kho tướng. Snapshot local có 12 lựa chọn trên 10 đội; Khác–Bình–Tiến dùng Thương ở cả hai giai đoạn. Pipeline HTML là importer nguồn cũ, chưa sở hữu phần curate này: khi rebuild phải bảo toàn `variants`, `context`, `sources` và các sửa tay, không dùng output HTML ghi đè trực tiếp runtime. Contract được kiểm bởi `tests-js/khaihoang-data.test.mjs` và `tests-e2e/khaihoang-options.spec.mjs`.

`season`/`seasonNote` ở root khai hoang ghi mùa mục tiêu Binh Diễn Xuân Thu theo xác nhận người dùng; nguồn mùa khác vẫn được ghi riêng, không tự nâng thành tier mùa hiện tại. Các cấu hình chưa mô tả nhánh binh chủng tùy chỉnh.

Đồng Lòng Hợp Sức được xác minh bằng ảnh client Việt 06/09/2026 là 勠力同心, chiến pháp sự kiện Chủ động trị liệu/tăng Thống Soái; bản ghi hiện nằm trong từ điển do Tra cứu thống nhất sở hữu ([unified-lookup.md](unified-lookup.md)); `data/tactics-generic.json` chỉ còn là artifact công khai cũ (`legacy-public/build-input`). 戮力上国 giữ nguyên hiệu ứng Nội chính và tên Hán-Việt Lục Lực Thượng Quốc; override cũ gán Đồng Lòng Hợp Sức đã được sửa.

`data/facets.json` có 74 tướng, 106 chiến pháp, 67 binh thư, 4 loại binh, 3 mức sao, 5 phe, 2 trạng thái, 2 nguồn; tổng source là 166 (bằng `teams.json`, `tests/test_build.py` chặn lệch). Frontend không fetch artifact này: tab team tính facet trực tiếp từ tập team runtime.

## Local state và external state

- `theme`: light/dark trong `localStorage`.
- `tqcclRecruitTracker`: tracker schema version 1; có export/import JSON.
- `tqccl.rosterRecommend.scanState.v1`: tên tướng/chiến pháp/team khóa, xác nhận và timestamp; không ảnh/base64/blob/token.
- `tqccl.teamView.v1`: kiểu xem Thẻ/Thẻ gọn/Bảng của Đội chuẩn/Đội khác.
- Bốn khóa trên là allowlist `HOST_BRIDGE_KEYS` mà cầu chuyển domain (`src/lib/host-bridge.ts`) mang từ host cũ sang `https://tqccl.com`.
- Ảnh preview giữ trong memory/data URL của phiên UI, gửi tới Worker khi người dùng xác thực.
- Worker dùng KV cho replay/rate/cap; secret và API key chỉ ở Worker environment.

## Kiểm thử

- `tests/`: parser, normalize, build, từ điển, tier, crawl/link.
- `tests-js/`: Astro/dist/header contracts, filter, map, Tra cứu, mobile menu, tracker, roster state và recommend engine.
- `tests-e2e/`: Chromium parity, storage, JSON failure, exposure local/routed HTTPS và mixed-content.
- `worker/test/`: config, guard, model, rate-limit, scan modes, schema.
- `mcp-worker/test/`: snapshot/filesystem/Static Assets/cache, tám handler, CLI/stdio/HTTP parity, bearer/limits/protocol, ownership-safe release/rollback, verifier, import guard và production-shaped Workerd budget.

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
