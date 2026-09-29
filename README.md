# Cẩm Nang Team — Tam Quốc Chí Chiến Lược

## Tổng quan

Website tĩnh tra cứu đội hình, tướng, chiến pháp và hỗ trợ quản lý đội cho Tam Quốc Chí Chiến Lược. Astro tạo document shell và artifact `dist/`; behavior vẫn dùng CSS/vanilla ES modules, còn dữ liệu JSON được build trước bằng Python. Tính năng đọc ảnh gọi Cloudflare Worker triển khai riêng.

## Tính năng

- Landing ở `/` và **8 trang mục tĩnh** có đường dẫn riêng: `/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`; Tra cứu có thêm 7 trang nhóm `/tra-cuu/<nhóm>/`. Trạng thái nằm trên query của đúng trang (`?season=`, `?q=`, `?id=`, `?view=luoi|bang`, `?config=`…).
- Hash cũ của SPA (`#team-pk`, `#meta-cu`, `#khaihoang`, `#lookup?group=…`, `#heroes`, `#tactics`…) và URL `/` không hash có khóa cũ được Landing chuyển tiếp sang đường dẫn mới, giữ query; bảng chuyển tiếp ở `js/legacy-routes.js`.
- Hai trang danh sách đội dùng chung một browser và một kiểu thẻ: search toàn văn, một ô chọn mùa nguồn và chip facet (loại binh, phe, nhóm, nguồn) đếm theo mùa đang chọn, chuyển **Thẻ / Thẻ gọn / Bảng** (`?view=luoi`, `?view=bang`), mobile thu gọn vùng lọc sau nút `Bộ lọc`.
- Mỗi đội có trang chi tiết tĩnh riêng dưới `/doi-chuan/<mùa>-<handle>/`, `/doi-khac/<handle>/` hoặc `/khai-hoang/<handle>/`; handle tiếng Việt đóng băng trong `pipeline/team-route-handles.json` nên sửa `displayNameVi` không đổi URL. URL cũ `/teams/…` và URL ngoài danh sách sinh sẵn trả trang 404 tĩnh, không redirect.
- Phạm vi kịch bản/phiên bản luật nằm trên URL (`scenario`, `ruleset`) cho Đội chuẩn, Đội khác và Cùng Tồn; Cùng Tồn chọn kịch bản bằng một hàng nút (mặc định kịch bản đầu theo registry). URL giữ phạm vi, bộ lọc và cấu hình đang mở. Gợi ý đội có một ô "Mùa bạn đang chơi" (`?season=`, mặc định `defaultSourceSeasonId`) và gợi ý từ Đội chuẩn của mùa đó, đội cũ chỉ lấp chỗ trống; Soi đội đối chiếu với Đội chuẩn theo mùa (`?season=`) và Đội khác. Khai hoang dùng bản bảo trì mới nhất.
- Tra cứu local 202 tướng, 406 chiến pháp và bốn nhóm catalog bổ sung, mỗi nhóm một trang (`/tra-cuu/tuong/`, `/chien-phap/`, `/trang-bi/`, `/quan-su/`, `/cai-tao-binh-chung/`, `/cong-trinh/`, `/binh-thu/`) chỉ tải dữ liệu của nhóm; trang đầu dựng lúc build, tìm tên Việt/Hán-Việt/Hán, paging, hộp thoại hồ sơ (dữ liệu nhóm liên quan tải khi mở) và khối "Trong cẩm nang" tính lúc build. `/tra-cuu/` là mục lục.
- Theo dõi chiêu mộ (store schema v2, `js/recruit-tracker-store.js`): nhiều tài khoản, ghi lượt ngày một chạm ("2 miễn phí", "Đủ 4", "Có 5★"), Hoàn tác, nhật ký sửa/xóa từng dòng, đồng bộ số lượt từ game, gói hạn giờ (đổi tên, ngày hết hạn, lưu trữ, xóa), thống kê; dữ liệu nằm trong `localStorage`, xuất/nhập JSON (nhập = gộp). Đăng nhập Google là tuỳ chọn: bật đồng bộ cloud qua `community-worker` (`/api/recruit`, gộp theo từng bản ghi).
- Soi screenshot qua Worker + nhà cung cấp AI OpenAI-compatible (tab AI của `/quan-tri/`: nhà cung cấp và API key dùng chung, mỗi tính năng AI có chuỗi failover riêng gồm nhà cung cấp, model, mức effort cùng timeout/trần tổng; mẫu DeepSeek, OpenCode Zen). AI chỉ chép chữ in trong ảnh (không đoán tướng qua chân dung, không chọn team); người dùng xác nhận từng ô trong editor (hoặc nhập tay), rồi frontend diff từng ô với Đội chuẩn theo mùa và Đội khác. Đội đã xác nhận chia sẻ qua link `?doi=v1.…` (chỉ ID canonical), lưu lịch sử 10 mục trên máy và xuất thẻ PNG.
- Gợi ý portfolio tối đa 5 đội bằng engine local từ Đội chuẩn của mùa đang chọn (đội cũ `teams.json` chỉ lấp khi mùa thiếu, gắn nhãn tham khảo). Mục "Thiếu món" cho bấm "Tôi có…" để bổ sung kho hoặc chọn món bù (chiến pháp tướng đó mang ở cấu hình khác cùng mùa, có trong kho); nút "Vì sao?" gọi Worker mode chỉ văn bản `explainSubstitute` để AI giải thích món bù — AI không chọn đội hay món.
- Giao diện Sổ binh pháp dùng chung một shell (header, menu thả, menu mobile, footer), một stylesheet và bộ token ở `docs/design/so-binh-phap/tokens.json`; theme sáng/tối theo lựa chọn đã lưu hoặc hệ điều hành, không nháy khi chuyển trang.
- Research MCP chỉ đọc có JSON CLI, stdio và authenticated Streamable HTTP dùng chung tám tool.

Dữ liệu theo kịch bản hiện có Binh Diễn Xuân Thu ở mức tham khảo; chưa có luật,
cấu hình hoặc điểm VN được xác minh để gợi ý theo mùa. Xem
[phạm vi dữ liệu và điều kiện promote](docs/season-team-data.md).

Snapshot dữ liệu công khai được chứng nhận local ngày 2026-09-13:

| Dữ liệu | Quy mô |
|---|---:|
| Đội legacy | 166 = 56 Team PK + 110 Meta phe cũ |
| Tier | 31 team, 39 bản xếp hạng nguồn |
| Cùng Tồn | 5 nhóm, 25 team |
| Khai hoang | 11 team, 5 mỏ |
| Tra cứu | 202 tướng / 406 chiến pháp / 114 trang bị / 39 quân sư / 16 cải tạo / 41 công trình |
| Binh thư map | 66 |

## Chạy local

Yêu cầu Node `24.20.0` (xem `.node-version`), npm và trình duyệt hiện đại:

```bash
npm ci
npm run dev
```

Mở URL Astro in ra terminal. Để kiểm tra đúng artifact sẽ publish:

```bash
npm run build
npm run preview
```

## Kiểm thử

```bash
npm run check
npm run build
npm run test:dist
npm run verify
npm run test:e2e
npm run test:node
python3 -m unittest discover -s tests
(cd worker && npm ci && npm test && npm run typecheck)
(cd mcp-worker && npm ci && npm run test:coverage && npm run check:repository)
```

Soát thiết kế (token là nguồn duy nhất, ảnh artboard chỉ để người duyệt so bố cục):

```bash
node scripts/design-tokens.mjs --check
node scripts/design-compare.mjs --tokens --phase 05 --theme dark
node scripts/design-compare.mjs --phase 05 --theme dark   # cần npm run preview trước
```

Playwright cần Chromium cài một lần bằng `npx playwright install chromium`.

## Rebuild dữ liệu

Đội theo kịch bản dùng builder riêng; xem [bảo trì dữ liệu đội theo kịch bản](docs/season-team-data.md)
để tạo candidate, kiểm bằng chứng và cập nhật sidecar mà không rebuild dữ liệu legacy.

Các lệnh bảo trì dữ liệu legacy:

```bash
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_books_dict
python3 -m pipeline.build_team_tier
```

Nguồn SGSDeck có private snapshot tại `data/sgsdeck/`, với đường rebuild offline
từ cache đã checksum. Cache hiện gồm sáu list, 176 detail tướng, 41 detail công
trình và equipment specials; lệnh build không tự gọi mạng:

```bash
python3 -m pipeline.build_sgsdeck_catalog --cache pipeline/sgsdeck-cache
python3 -m pipeline.query_sgsdeck_catalog validate
python3 -m pipeline.query_sgsdeck_catalog query --group generals --name "趙雲"
```

Snapshot nguồn validate đủ 202 generals, 393 tactics, 114 equipment + 90
specials, 39 advisors, 16 troop-mods + 192 options và 41 buildings + 426 levels.
Nguồn, provenance và review evidence vẫn private; website chỉ publish projection
tiếng Việt đã review: 202 tướng, 406 chiến pháp và catalog bổ sung. Xem
[quy trình Tra cứu thống nhất](docs/unified-lookup.md) và
[contract SGSDeck private/public](docs/sgsdeck-catalog.md). Chủ project xác nhận
quyền import trong phạm vi sáu catalog ngày 2026-09-12; đây không phải open license.

`python3 -m pipeline.build_json` tái tạo trùng byte `data/teams.json` (56 Team PK + 110 meta cũ) và `data/facets.json` từ HTML trong `Meta Team PK/` cộng input curate: `pipeline/aliases.json`, `pipeline/team-nicknames.json` và `pipeline/team-intro-supplement.json` (6 Team PK nghiên cứu thêm, không có trong HTML). Mặc định lệnh chỉ ghi hai file đó; `--check` so với `data/` mà không ghi (exit 1 nếu lệch); `--overwrite-curated` mới ghi đè `coexist.json`/`khaihoang.json` từ HTML và làm mất phần curate (hiện `khaihoang.json` lệch HTML). Builder cố ý loại nguồn Đô Úy; `pipeline/do-uy-ss18-source.json` giữ 40 mục làm archive nguồn thô và không tham gia publication. Builder giữ ID đội đã commit và dừng (liệt kê ID) khi đội đã commit không còn trong nguồn. Clone sạch thường thiếu HTML nguồn và cache crawl bị ignore. Trước khi ghi: chạy `--check`, review toàn bộ diff và test ([cảnh báo](docs/deployment-guide.md#cảnh-báo-bắt-buộc)).

## Deploy

- Site production: domain chính `https://tqccl.com` (canonical, sitemap, robots). `https://www.tqccl.com` và `https://tqccl.pages.dev` phục vụ cùng bản build nhưng chuyển ngay về `https://tqccl.com`, mang theo dữ liệu localStorage (tracker, kho scan, theme, kiểu xem, lịch sử Soi đội) qua fragment URL — xem [deployment guide](docs/deployment-guide.md#chuyển-domain-chính-sang-tqcclcom). Contract cho lần release được ủy quyền tiếp theo: repository root, `npm run build`, output `dist/`; settings thật phải được kiểm tra trước promotion.
- `public/_headers` được Astro đưa vào `dist/_headers`; shared verifier yêu cầu byte parity và cache revalidation cho shell, trang chi tiết đội, `404.html`, JS/CSS/JSON.
- Vision proxy: Worker tại `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev`, deploy riêng từ `worker/`.
- Research MCP nằm trong `mcp-worker/`; code và data theo [manifest v1/v2](docs/mcp-research-server.md) được đóng trong cùng Worker Static Assets version. Production release chưa được ghi nhận cho đến khi exact-version smoke, edge control và rollback rehearsal đạt với ủy quyền riêng.
- `js/config.js` chứa Worker URL và Turnstile site key công khai đang hoạt động. Secret chỉ nằm trong môi trường Worker.
- Preview/promotion/rollback là quy trình có ủy quyền riêng; build local không tạo deployment.

Xem [Deployment Guide](docs/deployment-guide.md) và bản ghi triển khai có ngày tại [Deployment Record](docs/deployment.md).

## Cấu trúc

```text
src/pages/index.astro      # Landing (vỏ mỏng → src/components/landing/Landing.astro)
src/pages/<mục>/index.astro # 8 trang mục tĩnh (doi-chuan, doi-khac, cung-ton, khai-hoang, tra-cuu, theo-doi-chieu-mo, soi-doi-tu-anh, goi-y-doi-tu-kho)
src/pages/tra-cuu/[group].astro # 7 trang nhóm Tra cứu (nội dung ở src/components/pages/LookupGroupPage.astro)
src/pages/404.astro        # trang 404 top-level (khối Việt + khối Trung cho /zh/)
src/pages/doi-chuan|doi-khac|khai-hoang/  # ba họ trang chi tiết sinh từ catalog
src/pages/zh/              # bản tiếng Trung: cùng đường dẫn, cùng component với bản Việt
src/components/pages/      # nội dung trang mục/chi tiết/cộng đồng nhận `locale` (route chỉ là vỏ mỏng)
src/layouts/SiteLayout.astro # shell dùng chung (head, header, menu, footer, payload)
src/lib/, src/pages/       # manifest + static endpoints byte-exact
css/, js/, data/           # source runtime canonical
js/legacy-routes.js        # bảng chuyển tiếp hash/URL cũ (một nguồn)
public/_headers, public/fonts/  # Pages deployment-control + font self-host
docs/design/so-binh-phap/tokens.json # token + danh mục component (nguồn duy nhất)
scripts/design-tokens.mjs, scripts/design-compare.mjs # soát token và so ảnh
pipeline/                  # build/normalize dữ liệu bằng Python stdlib
worker/                    # Cloudflare Worker TypeScript, deploy riêng
mcp-worker/                # Research MCP CLI/stdio/HTTP và release tooling
tests/, tests-js/, tests-e2e/
docs/                      # tài liệu evergreen
plans/                     # kế hoạch/báo cáo lịch sử, không phải runtime truth
```

## Tài liệu

- [Tổng quan và PDR](docs/project-overview-pdr.md)
- [Tóm tắt codebase](docs/codebase-summary.md)
- [Chuẩn code](docs/code-standards.md)
- [Kiến trúc](docs/system-architecture.md)
- [Roadmap](docs/project-roadmap.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Research MCP server](docs/mcp-research-server.md)
- [Bảo trì dữ liệu đội theo kịch bản](docs/season-team-data.md)
- [SGSDeck catalog kỹ thuật (private)](docs/sgsdeck-catalog.md)
- [Phân loại nguồn research đội hình](docs/research-sources.md)
- [Design Guidelines](docs/design-guidelines.md)

## Ghi chú vận hành

- `data/facets.json` không được frontend load; hai trang danh sách đội tự tính facet runtime. File là `build_facets(data/teams.json)` của 166 team; `tests/test_build.py` chặn lệch.
- Sửa giao diện thì sửa token/component trong `docs/design/so-binh-phap/tokens.json` trước, rồi chạy `node scripts/design-tokens.mjs --check`; CSS không giữ mã màu hay giá trị vi mô ngoài khối token.
- Theme lưu ở `localStorage.theme`; không có giá trị thì theo `prefers-color-scheme` của hệ điều hành.
- `data/tactics-generic.json` có 29 nguồn bổ sung; 27 record đang mang trạng thái `pending` sau merge vào `tactics.json`.
- Tracker lưu local; chỉ khi người dùng đăng nhập mới đồng bộ bản ghi chiêu mộ lên D1 của `community-worker`. Scan state lưu local, loại bỏ ảnh, base64, blob và Turnstile token; ảnh chỉ giữ trong bộ nhớ của phiên UI.
- Ảnh soi đội và ảnh chiến báo được gửi tới nhà cung cấp AI trong chuỗi của tính năng đó ở tab AI của `/quan-tri/` (mặc định DeepSeek); nên crop thông tin tài khoản trước khi dùng. Soi đội chỉ lưu đếm ẩn danh số ô phải sửa theo ngày (không ảnh, không tên, không IP); ảnh chỉ được lưu khi người dùng đăng nhập, tick đồng ý và tự bấm "Gửi ảnh này" (admin duyệt, từ chối thì xoá ảnh).

## Tham chiếu

Nguồn truth kỹ thuật: code và JSON commit hiện tại. Tài liệu trong `plans/` chỉ dùng làm lịch sử quyết định.
