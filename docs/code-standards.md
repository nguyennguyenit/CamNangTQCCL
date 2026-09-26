# Chuẩn code và dữ liệu

## Tổng quan

Chuẩn dự án ưu tiên YAGNI, KISS, DRY; thay đổi nhỏ, test được và giữ đúng ba boundary: static frontend, pipeline offline, Worker. Bám pattern đang có trước khi tạo abstraction hoặc dependency mới.

## Frontend JavaScript

- `src/layouts/SiteLayout.astro` sở hữu document shell cho **mọi** loại trang (`pageKind: landing | section | detail | not-found`); không trang nào tự viết lại head/header/footer.
- **Mô hình trang:** Landing ở `src/pages/index.astro`; 8 trang mục tĩnh `src/pages/<đường-dẫn>/index.astro` (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`) mỗi trang đúng một mount `<section id="section-<id>">`; ba họ trang chi tiết sinh từ `src/lib/team-detail-routes.ts`; `src/pages/404.astro` không boot `app.js`/`team-detail.js`.
- Trang mục khai `activeSection` (một trong 8 id); layout gắn `data-page-section="<id>"` lên `<body>` (không dùng `data-section` — nav đã dùng) và `js/app.js` chỉ mount mục đó, không còn tab/hash/`switchSection`.
- `js/app.js` gắn `document.body.dataset.boot = 'ready'` sau khi mount xong (kể cả nhánh lỗi) — tín hiệu cho e2e.
- Astro chỉ làm static build. Không thêm SSR, adapter, renderer UI hoặc Pages Functions khi chưa có yêu cầu riêng.
- Dùng vanilla ES modules; không thêm framework/bundler nếu không có yêu cầu sản phẩm rõ.
- `app.js` chỉ điều phối load/init. Behavior section đặt trong module riêng.
- **Payload mỗi trang mục** do layout phát; Landing là `pageKind="landing"` và **chỉ có hai pin publication**, không có `#team-route-handles`, `#season-artifact-hashes` hay `#season-controls`:

  | Payload | Người đọc | Trang cần |
  |---|---|---|
  | `#recommended-publication`, `#website-display-publication` | `app.js` (verify pin trước khi render) | mọi trang |
  | `#team-route-handles` đủ `{r,l,k}` | `app.js` (href chi tiết, migrate `detail`/`legacyTeam`, migrate `khTeam`/`khVariant`) | cả 8 trang mục; trang chi tiết chỉ `{l}`; **Landing không có** |
  | `#season-artifact-hashes` | `app.js` (model mùa) | Đội chuẩn, Đội khác, Cùng Tồn |
  | `<div id="season-controls">` | `app.js` (`placeSeasonControls`) | 3 trang như trên; Soi đội, Gợi ý đội **không có** (công cụ luôn chạy dữ liệu đội cũ, bỏ `scenario`/`ruleset`/`config` khỏi URL khi tải) |

- **Fetch dữ liệu bằng đường dẫn tuyệt đối** `/data/…` (không dùng `./data/…`: dưới `/<mục>/` sẽ thành `/doi-chuan/data/…` → 404).
- **Bảng chuyển tiếp hash cũ** nằm ở một nguồn `js/legacy-routes.js` (ESM thuần, không import): `index.astro` nhúng `resolveLegacyRoute.toString()` vào script inline chặn trong `<head>`, `js/team-detail-navigation.js` dùng cùng hàm để chuẩn hoá `from` và snapshot cũ. Thêm mục/hash mới thì sửa bảng đó, không viết nhánh riêng.
- **`safeReturnUrl` giữ khóa theo trang**: `SECTION_QUERY_KEYS` là allowlist theo pathname của trang mục (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`), chỉ giữ khóa có trong allowlist của **đúng** pathname đó và bỏ lặng lẽ mọi khóa khác (`fbclid`, `gclid`, `msclkid`, `utm_*`, `score`), không loại cả URL. URL gốc cũ dạng `/?…#<tab>` được chuẩn hoá về pathname + query của trang mục trước khi so allowlist, nên `from` cũ vẫn quay về đúng trang.
- **Bộ chọn theme/điều hướng**: `js/site-nav.js` sở hữu menu thả + menu mobile và `createDropdownMenu` (dùng lại ở menu tài khoản công cụ); `js/site-chrome.js` sở hữu nút đổi theme, `pageshow` và sự kiện `storage`; theme theo hệ điều hành chỉ đọc ở mỗi lần tải trang (không có listener `matchMedia` cho trang đang mở).
- **Artifact tính lúc build**: hồ sơ Tra cứu đọc `hero-summaries.json` sinh trong generation Recommended đang pin (kèm `provenance.catalogSha256`); không tải kho đội chuẩn khi mở hồ sơ.
- Hai trang mục Đội chuẩn/Đội khác dùng cùng `createRecommendedSection()` trong `js/team-filter-section.js`; không fork filter UI theo family.
- Đội chuẩn/Đội khác dùng chung `js/recommended-reference-render.js`; Khai hoang dùng `js/render.js` cho build ở cả card và trang detail, guide chỉ nằm trên detail và ngoài subtree build bị thay khi đổi variant. Không fork markup build.
- Href, snapshot quay lại và migrate URL tham chiếu cũ thuộc `js/team-detail-navigation.js`; không tự nối path `/doi-chuan/...`, `/doi-khac/...` hoặc `/khai-hoang/...` ở chỗ khác. Bảng route handle do build nhúng (`#team-route-handles`) đăng ký trước lần dựng href đầu tiên, validate và thay nguyên khối; thiếu identity trả `null`, không fallback URL ID cũ. Trang mục Khai hoang dùng `khTeam`/`khVariant`, snapshot cùng map `khaihoangVariants`; chỉ context key của trang mục Khai hoang bỏ cặp query này, surface khác so full URL.
- Liên kết sang trang chi tiết là anchor thật: chỉ ghi snapshot ở click primary không modifier, không `preventDefault` và không router tự viết.
- Ưu tiên pure function cho normalize, filter, map, score và state transition.
- Render dữ liệu bằng DOM API/`textContent`; **không** `innerHTML`/`insertAdjacentHTML`/`outerHTML` với dữ liệu (chuỗi HTML còn lại trong `js/` phải là hằng tĩnh).
- `href` lấy từ dữ liệu phải qua kiểm scheme `http(s)`; link ngoài `target="_blank" rel="noopener noreferrer"`; query link dựng bằng `URLSearchParams`.
- Public config đặt trong `js/config.js`; không coi Worker URL hoặc Turnstile site key là secret.
- Nếu code file vượt khoảng 200 dòng và đang tăng complexity, cân nhắc tách theo boundary thật; không tách cơ học.

## Astro và public artifact

- `js/`, `css/`, `data/` ở repository root là source canonical; không tạo bản copy editable trong `public/`.
- Mọi raw asset public phải có entry explicit trong `src/lib/public-artifact-manifest.mjs`; route param không extension và source basename exact.
- Static endpoint phải trả raw bytes/MIME đúng; từ chối file lạ, symlink, non-regular file và realpath thoát root.
- `public/` chỉ chứa deployment-control/static file do Astro copy; hiện `public/_headers`, `public/robots.txt`, `public/favicon.png` và **cả thư mục `public/fonts/`** phải byte-equal với output tương ứng trong `dist/` (`scripts/verify-astro-dist.mjs` so cả bốn nhóm).
- `scripts/verify-astro-dist.mjs` là output policy duy nhất. Test và CLI phải gọi cùng verifier, không nhân đôi allowlist.
- Shell/JS/CSS/JSON mutable dùng `Cache-Control: public, max-age=0, must-revalidate`; Pages response thật vẫn phải được kiểm tra trước promotion.
- `src/pages/404.astro` là trang 404 top-level; không dựa vào SPA fallback và không boot `app.js`/`team-detail.js` trong trang đó.
- Ba route `/doi-chuan/<mùa>-<handle>/`, `/doi-khac/<handle>/` và `/khai-hoang/<handle>/` sinh từ `src/lib/team-detail-routes.ts`; handle đóng băng trong `pipeline/team-route-handles.json`, inventory HTML dùng chung cho build và verifier, ID/handle không routable bị loại. `sourceConfigId`/`legacyTeamId`/`khaiHoangTeamId` vẫn là định danh nguồn, không đổi theo route; Khai hoang chỉ render từ publication và pin source hash khớp, không fallback JSON thô.
- `public/_headers` có **16 luật**, phủ `/`, `/index.html`, **8 trang mục** (`/doi-chuan/*`, `/doi-khac/*`, `/cung-ton/*`, `/khai-hoang/*`, `/tra-cuu/*`, `/theo-doi-chieu-mo/*`, `/soi-doi-tu-anh/*`, `/goi-y-doi-tu-kho/*`), `/404.html`, `/favicon.png`, `/js/*`, `/css/*`, `/fonts/*` và `/data/*` (mọi asset mutable dùng `max-age=0, must-revalidate`).
- Root và trang con dùng chung `src/layouts/SiteLayout.astro` cùng một `/css/styles.css`; không thêm stylesheet hoặc shell riêng cho trang chi tiết.
- **Font self-host** nằm ở `public/fonts/` (Be Vietnam Pro 400/500/600/700 + Noto Serif Display 700, subset latin/latin-ext/vietnamese, `font-display: swap`), khai `@font-face` trong `css/styles.css`, và phải có rule cache trong `public/_headers` cùng entry trong verifier; `public/fonts/OFL.txt` giữ license.
- **CSS chỉ dùng token**: mọi giá trị vi mô lấy từ `docs/design/so-binh-phap/tokens.json` (nguồn duy nhất); `node scripts/design-tokens.mjs --check` phải pass và `node scripts/design-compare.mjs --tokens --phase NN` phải 0 lệch chưa giải thích. Không viết mã màu/px trực tiếp và không giữ lại khối legacy.
- `link rel="canonical"` và `og:url` chỉ khai cho URL công khai ổn định và luôn cùng một giá trị: `src/layouts/SiteLayout.astro` phát từ prop `canonicalUrl`; Landing (`pageKind="landing"`) và 8 trang mục cũng đi qua chính layout đó và truyền pathname sạch của mình (gom mọi biến thể query), cả ba họ trang chi tiết truyền pathname chính nó kèm `og:type="article"`. `src/pages/404.astro` chỉ khai `robots=noindex`, không canonical/`og:url`.
- `public/robots.txt` và `src/pages/sitemap.xml.ts` là surface crawl công khai: sitemap phát đúng root, 8 đường dẫn mục (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`) cộng inventory route của `src/lib/team-detail-routes.ts`, và origin công khai duy nhất khai ở `site` của `astro.config.mjs` — robots, sitemap, canonical và `og:url` đều phải khớp origin đó. Không thêm `Disallow` cho `/js/`, `/css/`, `/data/` vì crawler cần chúng để render.

## UI và accessibility

- Nhãn tiếng Việt ngắn, trạng thái rõ; mọi control dùng `button`/`input` phù hợp và có tên truy cập được.
- Filter count phải tính từ tập dữ liệu của mục đang mở. Không phụ thuộc `data/facets.json` ở runtime.
- URL sở hữu bộ lọc Team: `season`, `q`, `faction`, `unit`, `subcategory`, `source`, `view`. Khóa `score`, `category`, selector cũ `tier`, `stars`, `sort`, `point` đã nghỉ; gặp thì bỏ lặng lẽ, không map sang điểm nguồn và không đổi thứ tự nguồn. Trang chi tiết Đội chuẩn quay lại chỉ mang `season`.
- Query của Cùng Tồn chỉ gồm `group`, `config`, `scenario`, `ruleset` (hàng nút kịch bản là điều khiển phạm vi duy nhất, URL thiếu `scenario` được ghi kịch bản đầu theo thứ tự registry bằng `replaceState`); soi đội/gợi ý kho không có khóa URL nào được giữ khi quay lại (`SECTION_QUERY_KEYS` rỗng) và không nhận `config`/`scenario`/`ruleset`. Snapshot theo từng surface, không rò giữa hai nhóm.
- Bộ lọc điểm đã nghỉ: không còn nhóm facet Điểm, không còn khóa `score` trên URL; điểm nguồn chỉ hiển thị trên thẻ/bảng và không đổi thứ tự nguồn.
- Disclosure phục hồi (`filters`, `alternatives`, `view`) chỉ nhận snapshot khớp đúng pathname + query hiện tại; storage lỗi không được chặn điều hướng.
- Mobile dùng shared inline filter collapse và `js/site-nav.js` (menu toàn màn hình); không tham chiếu drawer/module điều hướng không tồn tại.
- Không thiết kế tương tác chỉ dựa vào hover; giữ touch target đủ dùng.
- Khi thêm dialog/upload/status async: bổ sung focus management, keyboard activation và live region, kèm test.

## Python pipeline

- Dùng Python stdlib theo convention hiện tại.
- Parser, normalize và builder tách trách nhiệm; invariant dữ liệu quan trọng fail-loud.
- JSON generated phải deterministic, UTF-8, có newline cuối file.
- Không chạy builder ghi đè trước khi xác minh đủ nguồn, backup artifact và hiểu expected count.
- Không thêm fake record hoặc sửa assertion chỉ để build pass; sửa đường nguồn/augmentation thực.

## Data contract

- `data/*.json` là artifact runtime commit cùng site.
- Team join tier bằng `team.id`; tên team không bảo đảm unique.
- Tier hợp lệ: `T0`, `T0.5`, `T1`, `T1.5`, `T2`, `T3`; một team có thể có nhiều rankings.
- Chiến pháp giữ field nguồn `effect`/`target`; bản dịch review dùng `effectViet`/`targetViet` tùy chọn.
- Bảng curate đang publish nằm trong `pipeline/aliases.json`, `team-nicknames.json`, `tactic-name-overrides.json`, `team-tier-map.json`, `books-han-viet-map.json` và `role-tag-map.json`; `pipeline/do-uy-ss18-source.json` chỉ là archive nguồn thô, không phải input public.
- Nếu đổi schema: cập nhật builder/normalizer, consumer JS, import validation và test contract liên quan.

## Local state và privacy

- Tracker phải giữ `schemaVersion`, validate import và có đường export/import backup.
- Roster scan chỉ serialize dữ liệu canonical cần cho gợi ý; loại ảnh, data URL/base64, blob và Turnstile token.
- Không log hoặc persist nội dung screenshot ngoài yêu cầu rõ của người dùng.
- UI phải nói rõ ảnh gửi tới DashScope và khuyến nghị crop tên tài khoản.

## Worker TypeScript

- Giữ thứ tự guard rẻ → đắt: route/method/origin, limit/kill-switch, Turnstile/replay, image guard, commit usage, model, schema validation.
- Origin lạ phải bị từ chối khi header có mặt và khác `ALLOWED_ORIGIN`; hiểu rằng request không có `Origin` vẫn qua, nên không xem CORS là authentication.
- Kiểm tra MIME, magic bytes và size server-side; không tin nén client.
- Không leak upstream detail; lỗi ngoài dự kiến trả thông báo chung.
- Không log ảnh; IP chỉ dùng dạng hash cho rate-limit.
- KV quota là best-effort, không diễn đạt như giới hạn cứng. Cần quota cứng thì đổi primitive phù hợp.
- Secret dùng `wrangler secret put`; tuyệt đối không commit `.dev.vars`, key hoặc token.

## Research MCP

- Tám public schema/handler trong `mcp-worker/src/research/` là authority dùng chung cho CLI, stdio và HTTP.
- Public schema field phải có agent-facing description; tool description nêu khi dùng, kết quả và failure modes.
- MCP error chỉ dùng safe allowlist theo code cho `message`/`nextAction`; không chuyển exception message, input, path hoặc upstream body ra transport.
- `releaseId` đầy đủ sở hữu workflow/binding/cursor compatibility; không dùng compact `dataVersion` làm identity bảo mật.
- HTTP giữ thứ tự guard rẻ → đắt, server/transport theo request và chỉ đọc allowlisted Worker Static Assets qua `DataSource`.
- Release phải build deterministic manifest + sáu JSON từ exact Git tree sạch, verify candidate `0%` bằng Version Override, rồi promote duy nhất `100%` dưới expected-current guard.
- Bearer và Cloudflare token chỉ đi qua managed environment ở đúng step tiêu thụ; không argv/query/log/artifact. Gate phải từ chối file secret tạm chưa dọn.
- `npm run check` không được gọi live deploy. `.github/workflows/mcp-worker.yml` là browser CI owner duy nhất; `npm run check:repository` phải bao phủ MCP, Astro build/dist/`npm run verify`/E2E, JS, Python, Vision Worker và Wrangler dry-run.
- MCP core coverage (`src/data`, `src/domain`, `src/research`) phải đạt statements/lines/functions 80% và branches 70%; không hạ threshold để né regression.

## Quy ước tên và tài liệu

- Theo convention repo; file mới dùng tên mô tả, kebab-case nếu không có quy ước mạnh hơn.
- Docs evergreen ở `docs/`; kế hoạch/báo cáo có thời điểm ở `plans/` và không phải runtime truth.
- Cập nhật docs khi đổi behavior, command, schema, deploy boundary, config/security hoặc quyết định kiến trúc.
- Commit tập trung, conventional commit, không nhắc AI và không chứa secret/dữ liệu cá nhân.

## Quality gate

Chạy test hẹp trước, rồi full gate khi đổi contract chung:

```bash
npm run check
npm run build
npm run test:dist
npm run verify
npm run test:e2e
npm run test:node
python3 -m unittest discover -s tests
(cd worker && npm ci && npm test && npm run typecheck)
(cd mcp-worker && npm ci && npm run check:repository)
```

Không che test/lint/type error và không làm yếu assertion để hợp thức hóa regression.

## Bước tiếp theo

Trước merge: review diff dữ liệu, kiểm tra secret, xác nhận docs impact và chạy gate tương ứng. Với pipeline hiện tại, xem cảnh báo rebuild trong [Deployment Guide](deployment-guide.md).

## Tham chiếu

- [Tóm tắt codebase](codebase-summary.md)
- [Kiến trúc](system-architecture.md)
- [Design Guidelines](design-guidelines.md)
