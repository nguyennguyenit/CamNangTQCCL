# Chuẩn code và dữ liệu

## Tổng quan

Chuẩn dự án ưu tiên YAGNI, KISS, DRY; thay đổi nhỏ, test được và giữ đúng ba boundary: static frontend, pipeline offline, Worker. Bám pattern đang có trước khi tạo abstraction hoặc dependency mới.

## Frontend JavaScript

- `src/layouts/SiteLayout.astro` sở hữu document shell; `src/pages/index.astro` là trang root và không tạo lại root `index.html`.
- Astro chỉ làm static build. Không thêm SSR, adapter, renderer UI hoặc Pages Functions khi chưa có yêu cầu riêng.
- Dùng vanilla ES modules; không thêm framework/bundler nếu không có yêu cầu sản phẩm rõ.
- `app.js` chỉ điều phối load/init. Behavior section đặt trong module riêng.
- Hai tab Team chuẩn/Team khác dùng cùng `createRecommendedSection()` trong `js/team-filter-section.js`; không fork filter UI theo family.
- Đội chuẩn/Đội khác dùng chung `js/recommended-reference-render.js`; Khai hoang dùng `js/render.js` cho build ở cả card và trang detail, guide chỉ nằm trên detail và ngoài subtree build bị thay khi đổi variant. Không fork markup build.
- Href, snapshot quay lại và migrate URL tham chiếu cũ thuộc `js/team-detail-navigation.js`; không tự nối path `/doi-chuan/...`, `/doi-khac/...` hoặc `/khai-hoang/...` ở chỗ khác. Bảng route handle do build nhúng (`#team-route-handles`) đăng ký trước lần dựng href đầu tiên, validate và thay nguyên khối; thiếu identity trả `null`, không fallback URL ID cũ. Root Khai hoang dùng `khTeam`/`khVariant`, snapshot cùng map `khaihoangVariants`; chỉ context key của tab Khai hoang bỏ cặp query này, surface khác so full URL.
- Liên kết sang trang chi tiết là anchor thật: chỉ ghi snapshot ở click primary không modifier, không `preventDefault` và không router tự viết.
- Ưu tiên pure function cho normalize, filter, map, score và state transition.
- Render dữ liệu bằng DOM API/`textContent`; không đưa dữ liệu nguồn thô vào `innerHTML`.
- Public config đặt trong `js/config.js`; không coi Worker URL hoặc Turnstile site key là secret.
- Nếu code file vượt khoảng 200 dòng và đang tăng complexity, cân nhắc tách theo boundary thật; không tách cơ học.

## Astro và public artifact

- `js/`, `css/`, `data/` ở repository root là source canonical; không tạo bản copy editable trong `public/`.
- Mọi raw asset public phải có entry explicit trong `src/lib/public-artifact-manifest.mjs`; route param không extension và source basename exact.
- Static endpoint phải trả raw bytes/MIME đúng; từ chối file lạ, symlink, non-regular file và realpath thoát root.
- `public/` chỉ chứa deployment-control/static file do Astro copy; hiện `public/_headers` và `public/robots.txt` phải byte-equal với output tương ứng trong `dist/`.
- `scripts/verify-astro-dist.mjs` là output policy duy nhất. Test và CLI phải gọi cùng verifier, không nhân đôi allowlist.
- Shell/JS/CSS/JSON mutable dùng `Cache-Control: public, max-age=0, must-revalidate`; Pages response thật vẫn phải được kiểm tra trước promotion.
- `src/pages/404.astro` là trang 404 top-level; không dựa vào SPA fallback và không boot `app.js`/`team-detail.js` trong trang đó.
- Ba route `/doi-chuan/<mùa>-<handle>/`, `/doi-khac/<handle>/` và `/khai-hoang/<handle>/` sinh từ `src/lib/team-detail-routes.ts`; handle đóng băng trong `pipeline/team-route-handles.json`, inventory HTML dùng chung cho build và verifier, ID/handle không routable bị loại. `sourceConfigId`/`legacyTeamId`/`khaiHoangTeamId` vẫn là định danh nguồn, không đổi theo route; Khai hoang chỉ render từ publication và pin source hash khớp, không fallback JSON thô.
- `public/_headers` phải phủ cả `/doi-chuan/*`, `/doi-khac/*`, `/khai-hoang/*`, `/404.html` và `/favicon.png`.
- Root và trang con dùng chung `src/layouts/SiteLayout.astro` cùng một `/css/styles.css`; không thêm stylesheet hoặc shell riêng cho trang chi tiết.
- `link rel="canonical"` và `og:url` chỉ khai cho URL công khai ổn định và luôn cùng một giá trị: `src/layouts/SiteLayout.astro` phát từ prop `canonicalUrl`, cả ba họ trang chi tiết truyền pathname chính nó kèm `og:type="article"`; root khai trực tiếp trong `<head>` của `src/pages/index.astro` (không dùng layout) để gom mọi biến thể query. `src/pages/404.astro` chỉ khai `robots=noindex`, không canonical/`og:url`.
- `public/robots.txt` và `src/pages/sitemap.xml.ts` là surface crawl công khai: sitemap phát đúng root cộng inventory route của `src/lib/team-detail-routes.ts`, và origin công khai duy nhất khai ở `site` của `astro.config.mjs` — robots, sitemap, canonical và `og:url` đều phải khớp origin đó. Không thêm `Disallow` cho `/js/`, `/css/`, `/data/` vì crawler cần chúng để render.

## UI và accessibility

- Nhãn tiếng Việt ngắn, trạng thái rõ; mọi control dùng `button`/`input` phù hợp và có tên truy cập được.
- Filter count phải tính từ tập dữ liệu tab hiện tại. Không phụ thuộc `data/facets.json` ở runtime.
- URL sở hữu bộ lọc Team: `season`, `category`, `q`, `faction`, `unit`, `score`, `subcategory`, `source`. Selector cũ `tier`, `stars`, `sort`, `point` đã nghỉ; gặp thì báo notice và bỏ, không map sang điểm nguồn và không đổi thứ tự nguồn.
- Query gameplay (`config`, `tier`, `sort`, `stars`) thuộc Cùng Tồn/soi đội/gợi ý kho; snapshot theo từng surface, không rò giữa hai nhóm.
- Thu gọn là trình bày: mức điểm đang chọn vẫn hiển thị và vẫn lọc dù nằm ngoài tám mức đầu.
- Disclosure phục hồi (`filters`, `score`, `alternatives`) chỉ nhận snapshot khớp đúng một URL root; storage lỗi không được chặn điều hướng.
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
