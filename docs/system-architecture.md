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

Đường build cố ý không đưa `Team Đô Úy.html` vào artifact và hiện tạo 50 Team PK + 110 meta cũ, trong khi artifact công khai có 56 + 110. Sáu Team PK bổ sung vẫn chưa có đường tái tạo nhìn thấy. `pipeline/do-uy-ss18-source.json` giữ 40 record nguồn thô làm archive, không phải input publication. HTML/cache còn bị ignore. Vì vậy pipeline là công cụ bảo trì có điều kiện, chưa phải clean-clone reproducible build.

## Static runtime

`src/pages/index.astro` là document authority duy nhất và khai báo 9 section. Astro build phát shell thành `dist/index.html`; `app.js` vẫn là ES module browser canonical tại root và:

- khởi tạo theme và hash navigation;
- fetch `teams`, `coexist`, `khaihoang`, `tactics`, `heroes-dict`, `books-dict` song song;
- fetch `team-tier` theo kiểu optional;
- init hai tab team, tra cứu, tracker, analyze và roster recommender.

Hai tab team đều gọi `team-filter-section.js`. Module này tính facet trực tiếp từ tập source, tạo search/chip, thu gọn bộ lọc trên mobile và render card. `data/facets.json` không được load runtime.

Tra cứu và gợi ý cốt lõi chạy local:

- `match-dict.js`: match Việt bỏ dấu/Hán-Việt/Hán.
- `hero-identity.js`: SP, CO và bản thường có canonical ID riêng; `familyId` chỉ biểu diễn quan hệ cùng họ, không thay thế identity khi xét sở hữu. Mỗi combined slot là một tập alternatives và chỉ cần đúng một alternative để thỏa slot.
- `filters.js`: search/filter team.
- `team-recommend-engine.js`: xét ownership, conflict tướng/chiến pháp, alternatives, tier/red stars và portfolio tối đa 5 team.
- `coexist.json` chỉ render nhóm tham khảo; recommender dùng `teams.json` + `team-tier.json`, không parse display string Cùng Tồn.

## Research MCP boundary

Luồng dùng chung hiện có:

```text
snapshot sáu artifact (filesystem hoặc Worker Static Assets)
  → validate manifest/hash/cross-reference và dựng index
structured observations
  → normalize thành canonical state
  → caller rà soát/xác nhận
  → binding state + workflow
  → tám research handler
  → JSON CLI hoặc MCP stdio/Streamable HTTP
```

Snapshot gồm đúng sáu artifact được khai báo tại [`artifact-contracts.ts`](../mcp-worker/src/data/artifact-contracts.ts). [`FilesystemDataSource`](../mcp-worker/src/data/filesystem-data-source.ts) đọc JSON local và tự tạo canonical manifest; [`StaticAssetsDataSource`](../mcp-worker/src/data/static-assets-data-source.ts) đọc đúng bảy private asset path rồi dùng cùng validator. [`data-source.ts`](../mcp-worker/src/data/data-source.ts) single-flight cold load và giữ snapshot immutable trong suốt process/isolate.

`mcp-worker/src/domain/normalization-service.ts` sở hữu chuẩn hóa và source precedence; ambiguity, identity/family conflict hoặc locked-resource conflict đặt trạng thái cần review. `canonical-state.ts` sở hữu projection/digest và xác minh binding. `recommendation-service.ts` chỉ gọi engine sau khi workflow, canonical state và binding khớp; trạng thái chưa phân giải hoặc binding cũ bị từ chối. Bằng chứng người dùng thật sự đã xác nhận vẫn thuộc caller, không phải điều research handler tự chứng minh.

Tám tên handler cùng schema request/result thuộc [`research-contracts.ts`](../mcp-worker/src/research/research-contracts.ts); dispatch và version/provenance/error behavior thuộc [`research-handlers.ts`](../mcp-worker/src/research/research-handlers.ts). CLI `npm run cli -- <lệnh>`, stdio `npm run stdio` và HTTP đều gọi cùng handler/schema. [`tool-definitions.ts`](../mcp-worker/src/mcp/tool-definitions.ts) chỉ thêm mô tả và annotation read-only; mỗi factory tạo `McpServer` mới.

Corpus team công khai không gồm source `do-uy`. Ngoài việc artifact hiện tại đã loại source này, request context trong `research-handlers.ts` còn chiếu snapshot về tập public trước khi dựng index và gọi match/recommend, để snapshot cũ không thể tái công khai team hoặc tier Đô Úy.

Stdio dùng official SDK transport, giữ stdout chỉ cho protocol và ghi diagnostic cố định vào stderr. Remote Worker dùng raw Web-standard Streamable HTTP transport của SDK v1 ở chế độ JSON stateless; protocol `2025-11-25` được pin cho cả `initialize` đơn lẻ và trong batch. Trình tự `/mcp` là header guard rẻ → managed-client pre-shared bearer → rate/in-flight → đọc JSON theo byte thực tế và kiểm protocol → Static Assets/server; `/healthz` là liveness no-I/O. Origin hiện diện phải khớp chính xác và result cũng có trần. Bearer này không phải OAuth; không có OAuth server/discovery, client phải tự gắn `Authorization` header.

Remote data nằm trong cùng immutable Worker version với code. Worker chạy trước asset routing nên chỉ application code được gọi; public asset URL luôn `404`. Release builder tạo deterministic manifest + sáu JSON từ Git tree sạch. Controller dùng prior `100%` + candidate `0%`, Version Override và exact deployment ownership trước khi promote/rollback. Chi tiết vận hành nằm ở [Research MCP server](mcp-research-server.md).

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

Worker không chủ động lưu ảnh; log tối thiểu. KV eventual consistency không tạo hard quota. Turnstile là rào chính chống lạm dụng ngoài browser.

## Deployment boundary

| Surface | Artifact | Config |
|---|---|---|
| Cloudflare Pages | `dist/` từ `npm run build` | `public/_headers`, public Worker URL + Turnstile site key |
| Cloudflare Worker | `worker/src/*.ts` | vars trong `wrangler.toml`, KV binding, secrets trong Worker env |
| Research MCP Worker | `mcp-worker/src/worker.ts` | `wrangler.jsonc`, `ASSETS`, version metadata, managed bearer secret, Origin/limit vars |
| Research MCP local | `mcp-worker/src/stdio.ts` | filesystem snapshot; stdout protocol-only |
| Maintainer local | `pipeline/*.py`, HTML/cache/maps | không publish nguồn/cache riêng tư |

Config commit hiện trỏ Pages `https://tqccl.pages.dev` tới Worker `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/analyze`. Đây là public config hoạt động, không phải placeholder.

Astro dùng `output: "static"` và không có Cloudflare adapter/Pages Functions. Manifest explicit trong `src/lib/public-artifact-manifest.mjs` cho phép đúng các route JS/CSS/JSON; helper từ chối file lạ, symlink và path thoát root. `scripts/verify-astro-dist.mjs` là policy output duy nhất: kiểm allowlist, byte parity của raw asset và `public/_headers` → `dist/_headers`, đồng thời từ chối source/private/secret-like output.

`_headers` yêu cầu browser revalidate shell, JS, CSS và JSON (`public, max-age=0, must-revalidate`). Đây là local deployment contract; response header thật và SPA fallback body chỉ được xác nhận trên Pages preview có ủy quyền.

## Failure và fallback

- Thiếu `team-tier.json`: site vẫn render team không badge tier.
- Lỗi JSON bắt buộc: Team PK hiển thị hướng dẫn tải lại/liên hệ quản trị; các init sau không hoàn tất.
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
