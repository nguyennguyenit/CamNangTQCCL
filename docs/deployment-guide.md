# Hướng dẫn triển khai

## Tổng quan

Deploy tách hai surface: static site trên Cloudflare Pages và Vision proxy trên Cloudflare Workers. Pipeline dữ liệu chạy local trước deploy, không chạy trên Pages. Bản này là hướng dẫn evergreen; phiên bản/commit/URL preview theo thời điểm nằm ở [Deployment Record](deployment.md).

## Prerequisite

- Node `24.20.0` theo `.node-version`, npm và Chromium cho Astro build/E2E.
- Python 3 cho pipeline và test dữ liệu.
- Cloudflare account, Wrangler login, Pages project, Worker và Turnstile widget.
- Alibaba DashScope/Qwen API key phù hợp region/model.
- Khi rebuild: HTML export đúng tên trong `Meta Team PK/`; raw crawl cache hoặc quyền/network để recrawl.

## Preview và test local

```bash
npm ci
npm run dev
```

Mở URL Astro in ra terminal, không dùng `file://`. Kiểm tra artifact deploy:

```bash
npm run build
npm run preview
```

Full verification tại repository root:

```bash
npm run check
npm run build
npm run test:dist
npm run verify
npm run test:e2e
npm run test:node
python3 -m unittest discover -s tests
(cd worker && npm ci && npm test && npm run typecheck)
```

Cài Chromium một lần bằng `npx playwright install chromium`. Test Node/E2E cũng kiểm tra local HTTP preview, routed HTTPS, private-path exclusion và mixed-content mà không gọi live third-party.

Contract route chi tiết, `404.html`, `robots.txt`, `sitemap.xml` và `_headers` thuộc `npm run test:dist` (`tests-js/astro-dist-contract.test.mjs` và `tests-js/pages-headers-contract.test.mjs`) cùng `npm run verify`. Hành vi trình duyệt của route và 404 kiểm bằng:

```bash
npx playwright test tests-e2e/team-detail-pages.spec.mjs
```

Các lệnh này chạy trên preview local; chúng không chứng minh response của Pages.

## Rebuild dữ liệu có kiểm soát

Các lệnh dự án:

```bash
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_dict
python3 -m pipeline.build_books_dict
python3 -m pipeline.build_team_tier
```

Curate tier từ HTML xếp hạng tải tay:

```bash
python3 -m pipeline.suggest_team_tier path/to/saved-tier-list.html
```

`suggest_team_tier` chỉ in gợi ý; maintainer review rồi cập nhật `pipeline/team-tier-map.json` trước khi chạy builder tier.

### Cảnh báo bắt buộc

Không chạy `pipeline.build_json` trực tiếp trên artifact production mà chưa backup. Builder cố ý loại `Team Đô Úy.html` và hiện dựng 50 Team PK + 110 meta cũ, trong khi `data/teams.json` công khai có 56 + 110. `pipeline/do-uy-ss18-source.json` giữ 40 record nguồn thô làm archive và không được publish. `facets.json` vẫn lệch một team. Một clone sạch thường thiếu HTML nguồn và raw crawl cache vì chúng bị ignore.

Quy trình an toàn:

1. Copy/backup `data/` ngoài worktree hoặc tạo branch/worktree riêng.
2. Xác nhận HTML/cache/map nguồn đủ và expected count đã phản ánh đường build thực.
3. Chạy từng builder; không dùng `--recrawl` nếu chưa chấp nhận network/source drift.
4. So sánh schema, count, ID, source distribution và nội dung diff; không chỉ nhìn test pass.
5. Chạy full gate; chỉ commit artifact sau review.

## Static Pages

Production origin hiện tại: `https://tqccl.pages.dev`.

Build contract:

```text
Root directory: repository root
Build command: npm run build
Build output: dist
Node: 24.20.0
```

Astro dùng static output, không adapter và không có Pages Functions. `dist/` phải chỉ chứa `index.html` (Landing), `404.html`, `sitemap.xml`, `robots.txt`, đúng bộ tám trang mục (`<mục>/index.html`), đúng bộ trang chi tiết đội sinh từ catalog, manifest-approved `js/`, `css/`, `fonts/`, `data/` và `_headers`. Shared verifier đối chiếu raw bytes với source và từ chối `pipeline/`, `worker/`, tests, plans, symlink, secret-like hoặc file lạ.

Publication hiển thị là một snapshot fail-closed: `data/website-display.json` pin source JSON, generation Recommended và generation/hash Lookup đã review. `npm run build` kiểm publication hiện hành trước Astro; `npm run verify` kiểm lại publication và exact `dist/`. Không publish candidate site nếu Lookup công khai chưa được promote đúng candidate.

Trang chi tiết đội là route tĩnh sinh sẵn: `/doi-chuan/<mùa>-<handle>/` cho mỗi bản ghi Recommended, `/doi-khac/<handle>/` cho mỗi đội gốc trong `data/teams.json`, và `/khai-hoang/<handle>/` cho mỗi đội Khai hoang trong publication đã xác minh. [`src/lib/team-detail-routes.ts`](../src/lib/team-detail-routes.ts) là inventory dùng chung cho build và verifier, đọc handle đóng băng trong `pipeline/team-route-handles.json` (ledger v2, publication Recommended v1) và **fail** nếu ledger lệch generation/hash/key-set, handle không routable hoặc route trùng; `dist/` không được thừa/thiếu trang. Handle gán một lần; khi publication sinh successor chỉ rebind `generationId`, không sinh lại handle, rồi `python3 -m pipeline.team_route_handles --check` trước `npm run build`. Không có SPA fallback/redirect: `404.html` top-level giữ `not-found-title`, không boot `app.js` hoặc detail entry; URL cũ `/teams/...` hay bất kỳ handle ngoài catalog phải trả 404 tĩnh thay vì root shell.

`public/_headers` đặt `Cache-Control: public, max-age=0, must-revalidate` cho đúng **mười sáu** rule (Landing, 8 trang mục,
3 họ trang chi tiết, 404, JS/CSS/font/data và favicon):

```text
/
/index.html
/doi-chuan/*
/doi-khac/*
/khai-hoang/*
/cung-ton/*
/tra-cuu/*
/chieu-mo/*
/soi-doi/*
/goi-y-doi/*
/404.html
/js/*
/css/*
/fonts/*
/data/*
/favicon.png
```

Local test chỉ xác nhận syntax, coverage của mọi shell/trang mục/trang chi tiết/raw asset (gồm `fonts/`) đã publish và exact copy vào `dist/_headers`; phải quan sát header response thật trên Pages preview trước promotion. Pages parse `_headers` như deployment control, không phục vụ file này như static asset.

Trước deploy:

- có ủy quyền release riêng; review diff source/artifact/docs;
- ghi base commit, scoped-source digest và `dist/` digest;
- xác nhận `js/config.js` trỏ đúng Worker URL và Turnstile public site key;
- chạy local HTTP/routed-HTTPS exposure probe và full gate;
- xác nhận `.github/workflows/mcp-worker.yml` là workflow CI duy nhất và full `npm run check:repository` credential-free đã đạt; workflow này không deploy Pages;
- xác nhận `worker/wrangler.toml` `ALLOWED_ORIGIN` khớp exact Pages origin.

### Preview, promotion và canary

Không thực hiện các bước sau trong build/local verification. Khi release được ủy quyền:

1. Tạo release commit tập trung; không deploy từ worktree dirty.
2. Ghi deployment ID/version production known-good hiện tại trước khi tạo preview.
3. Kiểm tra Pages settings khớp root/build/output/Node ở trên.
4. Trên preview, xác nhận `/`, `/404.html`, vài route thuộc cả ba họ `/doi-chuan/…`, `/doi-khac/…`, `/khai-hoang/…`, JS/CSS và JSON public trả đúng artifact. Kiểm `/robots.txt` khớp byte source, trỏ đúng `Sitemap` production origin; `/sitemap.xml` trả MIME XML với đúng tập URL, không `/teams/…` hay trùng. ID/handle ngoài catalog, `/teams/…` cũ và private path phải trả 404 tĩnh, không shell root; status/body thật chỉ chứng minh trên preview.
5. Quan sát `Cache-Control` thật cho shell, trang chi tiết đội, `404.html`, JS/CSS/JSON và xác nhận `_headers` không được phục vụ như asset.
6. Preview origin khác production nên Vision POST bị Worker từ chối theo exact `ALLOWED_ORIGIN`; không nới origin để làm preview canary.
7. Sau phê duyệt promotion, kiểm tra production-origin `POST /analyze` được phép, origin lạ bị từ chối, và `OPTIONS` trả CORS headers đã cấu hình. Preflight chỉ là CORS transport, không xác thực caller.
8. Giữ production origin `https://tqccl.pages.dev`, nên origin của localStorage production không đổi; preview có storage origin riêng.
9. Kiểm tra client mới và client đã cache đều nhận cùng deployment sau revalidation. Chỉ ghi facts vào Deployment Record sau khi có bằng chứng thực.

## Research MCP Worker

Research MCP có release boundary riêng với Vision Worker. Local verification không upload hoặc tạo deployment. Gate credential-free trong clean checkout:

```bash
cd mcp-worker
npm ci
npm run --silent build:worker-assets > /secure/artifact/worker-release-evidence.json
npm run verify:worker-assets -- /secure/artifact/worker-release-evidence.json
npm run check
npm run check:repository
```

Production dùng `ASSETS` private binding với `run_worker_first: true`; bundle gồm manifest và sáu JSON, đi cùng code trong một Worker version. Workflow production chỉ chạy bằng manual dispatch từ `main` khi checkbox production bật và full SHA 40 ký tự khớp `HEAD`, `GITHUB_SHA` lẫn current `origin/main`. Đây là cơ chế owner-approved cho repo private khi required-reviewer environment không khả dụng. Candidate được thêm ở `0%`, kiểm qua Version Override và exact runtime version header trước khi trở thành version duy nhất ở `100%`.

Nếu live inventory xác nhận Worker chưa có deployment, lần chạy đầu phải bật manual input `bootstrap_first_release` và giữ `rehearse_rollback: false`. Read-only preflight dừng trước mutation nếu Worker đã có deployment. Nhánh one-time tạo Worker/version đầu bằng `wrangler deploy`, truyền bearer qua secret file tạm mode `0600`, áp dụng Custom Domain, rồi controller read-back đúng candidate duy nhất ở `100%` và xác minh production; nếu verify fail thì mở incident vì chưa có prior để rollback. Sau đó bắt buộc chạy lần hai với `bootstrap_first_release: false` và `rehearse_rollback: true`; nhánh normal dùng `wrangler versions upload` để chứng minh `100/0`, promotion, exact prior rollback, code/data identity và re-promotion. Không dùng bootstrap để ghi đè Worker đã hoạt động.

Live verifier lấy bearer từ `TQCCL_MCP_BEARER_CURRENT`; Cloudflare control-plane verifier lấy token chỉ đọc từ environment. Không đặt secret trong argv/query/artifact. Sau Custom Domain trigger, workflow poll public `/healthz` tối đa 120 giây để hấp thụ DNS/TLS propagation trước khi đọc prior identity. Một scheduler dùng chung giãn tối thiểu `1.100 ms` giữa mọi request `/mcp` trong candidate/production/rollback verification để không tự va edge `10/10`. Controller re-read exact deployment trước promote và rollback: nếu current drift khỏi deployment do run sở hữu thì mở incident, không overwrite release khác. Mỗi mùa khoảng ba tháng tạo một reviewed code+data Worker version; GoClaw URL/bearer/tool contract không đổi.

Edge rate rule trên Cloudflare Free dùng `10 request/10 giây` cho `/mcp`; limiter trong Worker vẫn là `60 request/60 giây`. Không đổi edge threshold sang chu kỳ 60 giây nếu zone chưa nâng gói vì cấu hình đó không được Free hỗ trợ.

Thứ tự, command, rotation và incident runbook đầy đủ ở [Research MCP server](mcp-research-server.md). Chỉ cập nhật [Deployment Record](deployment.md) sau khi có release ID, Worker version, workflow identity, approval và canary evidence thực tế.

## Cloudflare Worker

### Setup lần đầu

```bash
cd worker
npm install
npx wrangler login
npx wrangler kv namespace create RL
```

Gắn namespace ID vào `[[kv_namespaces]]` trong `wrangler.toml`. Dev local:

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars` không được commit.

### Public vars và bindings

Commit trong `worker/wrangler.toml`:

- `ALLOWED_ORIGIN`: exact production origin.
- `REGION`, `MODEL_ID`, tùy chọn `MODEL_ENDPOINT`.
- `FEATURE_ENABLED` kill-switch.
- `RL_PER_HOUR`, `DAILY_CAP`, `MONTHLY_CAP`, `MAX_IMAGE_BYTES`.
- KV binding `RL` và namespace ID.

Frontend public config trong `js/config.js`:

- `workerUrl`.
- `turnstileSiteKey`.
- client image compression settings.

Các giá trị này công khai, không phải secret.

### Secrets

```bash
cd worker
npx wrangler secret put QWEN_API_KEY
npx wrangler secret put TURNSTILE_SECRET
```

Không commit API key, Turnstile secret, token, `.dev.vars` hoặc credential Cloudflare.

### Deploy

```bash
cd worker
npm test
npm run typecheck
npm run deploy
```

Config hiện dùng region `intl`, model `qwen3.7-plus`, endpoint DashScope Model Studio theo region. Chỉ đặt `MODEL_ENDPOINT` khi chủ đích đổi endpoint/provider; không dùng Coding Plan endpoint cho Vision.

## Publish lại bản dịch hiển thị

Mọi thay đổi chữ UI hoặc file trong `sourceFiles` của `pipeline/site-localization-policy.json` đều phải đi qua chuỗi
dựng/kiểm/publish (policy nằm trong `localizationInputsHash` nên mỗi lần đổi sinh generation Recommended mới):

```bash
# 1) ghim lại ĐÚNG hash nguồn đã sửa trong policy.sourceFiles (dùng sha256_hex trên bytes của file),
#    rồi cập nhật baseline.notes từ inventory nếu số obligation/digest đổi:
python3 -m pipeline.site_localization inventory --root . --report <file>
python3 -m pipeline.site_localization build --root . --stage all --output .cache/site-localization-candidate
python3 -m pipeline.site_localization check --root . --stage all --candidate .cache/site-localization-candidate
python3 -m pipeline.site_localization publish --root . --candidate .cache/site-localization-candidate
python3 -m pipeline.site_localization check --root . --stage public
# re-pin generationId trong pipeline/team-route-handles.json theo data/website-display.json rồi:
python3 -m pipeline.team_route_handles --check
npm run build && npm run verify && npm run test:dist
```

`inventory` chỉ **báo** số mới: policy phải được sửa (hash nguồn + `baseline.notes`) trước khi dựng candidate, nếu không `check` sẽ báo `reviewed source hash is stale` hoặc baseline lệch. Chỉ đổi hash nguồn (không thêm/dời/đổi chữ) thì vẫn phải publish lại và re-pin; đổi fingerprint của obligation lớp
`translate` cần receipt người duyệt độc lập, còn lớp `authored-vi` không cần. Dev server giữ snapshot pin trong bộ nhớ
nên phải khởi động lại sau khi publish.

## Verification sau deploy

Preflight:

```bash
curl -i -X OPTIONS \
  https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/analyze \
  -H 'Origin: https://tqccl.pages.dev'
```

Kỳ vọng `204` và `access-control-allow-origin: https://tqccl.pages.dev`.

Smoke checklist sau promotion được ủy quyền:

1. Mở production, đi qua Landing và đủ tám đường dẫn mục (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/chieu-mo/`, `/soi-doi/`, `/goi-y-doi/`), kiểm tra JSON/network không lỗi; dán một hash cũ (ví dụ `/#khaihoang`, `/#lookup?group=heroes`) và một URL `/` có khóa cũ vào tab đang mở `/` để xác nhận chuyển tiếp đúng.
2. Kiểm tra Đội chuẩn và Đội khác load đúng generation đang pin, bộ lọc mùa/danh mục/phe/loại binh và chuyển Thẻ/Bảng hoạt động, không có asset/team Đô Úy, panel lọc mobile mở/đóng đúng; đổi theme sáng/tối và tải lại một trang mục để xác nhận không nháy và giữ lựa chọn.
3. Mở trực tiếp một `/doi-chuan/…`, một `/doi-khac/…` và một `/khai-hoang/…`, reload, rồi dùng link quay lại; một handle không tồn tại và một URL `/teams/…` cũ phải trả trang 404 tĩnh.
4. Test tra cứu, theme, tracker export/import bằng dữ liệu không nhạy cảm.
5. Upload screenshot đã crop; xác nhận Turnstile, analyze và map/team match.
6. Test scan/review/recommend; reload và xác nhận state không chứa ảnh/token.
7. Kiểm tra origin lạ có header bị 403 và lỗi không leak upstream detail.

Lưu ý: request không có `Origin` vẫn qua app guard; CORS không phải auth. KV rate/day/month cap là best-effort do eventual consistency.

## Rollback

### Static Pages

1. Promote deployment ID/version known-good đã ghi trước release; rollback toàn artifact, không mix HTML/JS/data giữa hai build.
2. Purge cache bị ảnh hưởng nếu client còn nhận asset của deployment lỗi.
3. Kiểm tra lại header thật, trang 404 tĩnh, một route chi tiết đội, `js/config.js`, data schema, client mới và client đã cache.
4. Chỉ cập nhật Deployment Record bằng ID/URL/thời gian đã quan sát.

### Worker

Dùng Cloudflare dashboard rollback về version known-good hoặc checkout commit known-good rồi chạy full Worker gate và `npm run deploy`. Khi sự cố đang hoạt động, đặt `FEATURE_ENABLED="false"` và deploy để kill-switch trước khi điều tra.

### Data

Khôi phục trọn bộ `data/` từ commit/backup known-good; không mix artifact sinh từ các lần build khác nhau. Re-run static smoke test.

## Bước tiếp theo

Sau mỗi deploy, cập nhật facts có ngày/version trong [Deployment Record](deployment.md), không đóng băng chúng trong guide evergreen.

## Bằng chứng local hiện tại

Evidence migration được tạo trên macOS; không diễn đạt như Linux/Pages runtime proof:

| Evidence | Giá trị |
|---|---|
| Base commit | `d40722789452bc66f5f2a6b91d6fddb67c84f3af` |
| Scoped-source inventory | `.node-version`, `package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json`, cùng mọi file dưới `src/`, `js/`, `css/`, `data/`, `public/` (46 files) |
| Scoped-source SHA-256 | `c55cd6a06477e92d665922c208fcfa98c42931e4577b1b1071976429c3a8c3ca` |
| `dist/` SHA-256 | `0d09cadc24fdb49c1b76a14c38f9936f47b079fe119cb2808c565d047f74bdd8` |

Digest dùng danh sách path đã sort, mỗi path và file bytes được phân cách bằng byte NUL. Recompute cho từng release candidate; các giá trị trên không phải deployment ID và không chứng minh Pages đã phục vụ artifact.

## Tham chiếu

- [Deployment Record](deployment.md)
- [Worker README](../worker/README.md)
- [System Architecture](system-architecture.md)
- [Code Standards](code-standards.md)
- [Cloudflare Pages custom headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages serving và xử lý 404](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
