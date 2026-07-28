# Tóm tắt codebase

## Tổng quan

Repo có ba boundary triển khai hiện hữu: Astro static build + SPA vanilla chạy trong trình duyệt, pipeline Python chạy offline để sinh JSON, và Cloudflare Worker TypeScript cho Vision. `mcp-worker/` là package nghiên cứu riêng với domain services, snapshot loader read-only, tám shared handler và JSON CLI local; stdio/HTTP transport chưa được triển khai. Không có renderer frontend, SSR, backend chung hoặc database ứng dụng.

## Cấu trúc

```text
.
├── src/pages/index.astro   # document shell 10 section
├── src/lib/                # manifest và safe raw-artifact reader
├── src/pages/{js,css,data} # Astro static endpoints
├── css/, js/, data/        # source runtime canonical
├── public/_headers         # Pages cache policy source
├── scripts/                # shared dist verifier
├── pipeline/               # parser/normalizer/builder Python stdlib
├── worker/                 # Vision proxy Cloudflare
├── mcp-worker/             # data/domain/research handlers + JSON CLI; chưa có MCP transport
├── tests/                  # Python unittest
├── tests-js/, tests-e2e/   # Node contracts + Playwright parity
├── docs/                   # tài liệu evergreen
└── plans/                  # kế hoạch/báo cáo lịch sử
```

## Điểm vào và module chính

| File | Vai trò |
|---|---|
| `src/pages/index.astro` | Khai báo 10 tab/section và nạp raw `/js/app.js`; build thành `dist/index.html`. |
| `src/lib/public-artifact-manifest.mjs` | Allowlist route/source/class cho mọi JS/CSS/JSON public. |
| `src/lib/root-static-artifacts.ts` | Đọc raw artifact an toàn và trả bytes/MIME cho static endpoint. |
| `scripts/verify-astro-dist.mjs` | Kiểm toàn bộ `dist/`, byte parity và deployment-control artifact. |
| `js/app.js` | Load 6 JSON bắt buộc + tier tùy chọn; init nav, theme và các section. |
| `js/team-filter-section.js` | Shared full-text search, chip động, stats, clear và mobile collapse cho 3 tab team. |
| `js/team-pk.js`, `js/do-uy.js`, `js/meta-cu.js` | Chọn source, cấu hình filter và sort riêng từng tab. |
| `js/render.js`, `js/filters.js` | DOM builder, team card, tier và pure filter/search. |
| `js/hero-list.js`, `js/hero-detail.js`, `js/tactics.js` | Tra cứu tướng/chiến pháp local. |
| `js/recruit-tracker-store.js` | State schema v1, nhiều account, banner, pity, import/export localStorage. |
| `js/analyze.js`, `js/analyze-map.js` | Nén ảnh, Turnstile, Worker call, canonical map và team similarity. |
| `js/hero-identity.js` | Canonical identity tướng: SP/CO/base tách biệt, `familyId` riêng và combined slot là alternatives. |
| `js/roster-scan-state.js` | Serialize scan state, loại dữ liệu ảnh/token. |
| `js/team-recommend-engine.js` | Chấm tier, kiểm tra conflict, greedy/DFS và tạo portfolio local. |
| [`mcp-worker/src/data/artifact-contracts.ts`](../mcp-worker/src/data/artifact-contracts.ts) | Owner của canonical manifest/snapshot gồm đúng sáu artifact và full `releaseId`. |
| [`mcp-worker/src/data/{filesystem-data-source,r2-data-source,data-source}.ts`](../mcp-worker/src/data/) | Nguồn FS/R2 read-only và cache snapshot atomic, stale có deadline tuyệt đối. |
| `mcp-worker/src/domain/{contracts,canonical-state,normalization-service,recommendation-service}.ts` | Luồng pure normalize → xác nhận binding → recommend. |
| [`mcp-worker/src/research/{research-contracts,research-handlers}.ts`](../mcp-worker/src/research/) | Schema authority và dispatch dùng chung cho tám research operation; kết quả có workflow identity/provenance/bounds. |
| [`mcp-worker/src/cli.ts`](../mcp-worker/src/cli.ts), [`package.json`](../mcp-worker/package.json) | `npm run cli -- <lệnh>` gọi trực tiếp shared handler qua filesystem snapshot và xuất một JSON document. |
| [`mcp-worker/workflow-source-manifest.json`](../mcp-worker/workflow-source-manifest.json), [`generate-workflow-build.ts`](../mcp-worker/scripts/generate-workflow-build.ts) | Owner của semantic closure và `workflowBuildId`; `workflowVersion` ghép identity này với full `releaseId`. |
| `pipeline/build_json.py` | Build team, facet, Cùng Tồn, khai hoang từ HTML export. |
| `pipeline/build_dict.py` | Crawl/cache/link và merge chiến pháp generic, build tướng/chiến pháp. |
| `pipeline/build_books_dict.py` | Validate bảng map Hán→Việt với facet binh thư. |
| `pipeline/build_team_tier.py` | Join tier curate theo team ID, validate tier fail-loud. |
| `worker/src/index.ts` | `POST /analyze`: origin, limits, Turnstile, image guard, model, response. |
| `worker/src/config.ts`, `schema.ts` | Env config và schema kết quả cho 4 mode. |

## Dữ liệu runtime

| Artifact | Snapshot 2026-07-11 |
|---|---:|
| `data/teams.json` | 214: 56 team-intro, 48 do-uy, 110 moi-phe |
| `data/team-tier.json` | 57 team, 65 rankings |
| `data/tactics.json` | 239, gồm 27 record pending sau merge generic |
| `data/heroes-dict.json` | 112 |
| `data/books-dict.json` | 66 |
| `data/coexist.json` | 5 nhóm, 25 team |
| `data/khaihoang.json` | 11 team, 5 mỏ |
| `data/tactics-generic.json` | 29 record nguồn |

`data/facets.json` có 91 tướng, 119 chiến pháp, 67 binh thư, 4 loại binh, 3 mức sao, 5 phe, 2 trạng thái, 3 nguồn; tổng source/status là 213. Frontend không fetch artifact này: tab team tính facet trực tiếp từ tập team runtime.

## Local state và external state

- `theme`: light/dark trong `localStorage`.
- `tqcclRecruitTracker`: tracker schema version 1; có export/import JSON.
- `tqccl.rosterRecommend.scanState.v1`: tên tướng/chiến pháp/team khóa, xác nhận và timestamp; không ảnh/base64/blob/token.
- Ảnh preview giữ trong memory/data URL của phiên UI, gửi tới Worker khi người dùng xác thực.
- Worker dùng KV cho replay/rate/cap; secret và API key chỉ ở Worker environment.

## Kiểm thử

- `tests/`: parser, normalize, build, từ điển, tier, crawl/link.
- `tests-js/`: Astro/dist/header contracts, filter, map, hero UI, mobile menu, tracker, roster state và recommend engine.
- `tests-e2e/`: Chromium parity, storage, JSON failure, exposure local/routed HTTPS và mixed-content.
- `worker/test/`: config, guard, model, rate-limit, scan modes, schema.
- `mcp-worker/test/`: snapshot/FS/R2/cache, tám handler, workflow identity, CLI parity, bounds và performance proxy.

Gate hiện được kiểm bằng script trong root, `worker/package.json` và [`mcp-worker/package.json`](../mcp-worker/package.json); lần xác minh hiện tại: MCP 131, root Node 133, Python 82, Worker 53.

## Điểm cần chú ý

- Comment `50 team` trong `js/team-pk.js` đã cũ; UI dùng số runtime nên vẫn hiện 56.
- `build_json.py` vẫn expect 50 Team PK và 12 Đô Úy; không tái tạo artifact hiện tại an toàn.
- `facets.json` chậm hơn `teams.json` một team nhưng hiện không ảnh hưởng filter runtime.
- `plans/` có thể chứa mô tả cũ; kiểm chứng bằng code, config và JSON commit.

## Bước tiếp theo

Khi sửa behavior: bắt đầu từ module section/store/engine tương ứng, chạy test hẹp, rồi mở rộng test contract. Khi sửa data: backup artifact và review diff trước khi commit.

## Tham chiếu

- [Chuẩn code](code-standards.md)
- [Kiến trúc hệ thống](system-architecture.md)
- [Roadmap](project-roadmap.md)
