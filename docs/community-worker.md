# Community Worker (đăng nhập, bình luận, chiến báo, bài viết, góp ý)

`community-worker/` là Cloudflare Worker (Hono) tách biệt site tĩnh: Better Auth với Google, D1 cho dữ liệu, R2 cho ảnh, nhà cung cấp AI OpenAI-compatible (cấu hình chung + chuỗi failover riêng từng tính năng, quản lý ở tab **AI** của `/quan-tri/`) để đọc ảnh chiến báo, GitHub `repository_dispatch` để build lại site khi xuất bản bài viết, và Cloudflare Email Service (binding `send_email`) để gửi thư báo góp ý. Hợp đồng API nằm trong [`plans/260927-cong-dong-song-ngu/plan.md`](../plans/260927-cong-dong-song-ngu/plan.md).

Trình duyệt không gọi thẳng `workers.dev`. Mọi request `/api/*` trên `tqccl.com`, `www.tqccl.com` và `tqccl.pages.dev` đi qua Pages Function [`functions/api/[[path]].ts`](../functions/api/[[path]].ts), nên cookie phiên là cookie first-party của đúng domain đó.

```text
Trình duyệt ──/api/*──► Pages Function (proxy) ──service binding COMMUNITY──► community-worker ─┬─ D1  DB
                                                (dự phòng: COMMUNITY_API_ORIGIN)                ├─ R2  MEDIA
                                                                                                ├─ KV  AI_KV (ai:config) → nhà cung cấp AI (chuỗi failover theo nhóm)
                                                                                                ├─ GitHub repository_dispatch → .github/workflows/pages-deploy.yml
                                                                                                ├─ Turnstile siteverify (góp ý ẩn danh)
                                                                                                └─ send_email FEEDBACK_MAIL → hộp thư admin
```

## Cấu hình

| Tên | Loại | Ý nghĩa |
|---|---|---|
| `DB` | D1 binding | Bảng Better Auth và bảng ứng dụng (`migrations/`) |
| `MEDIA` | R2 binding | `pending/<uploadId>` là ảnh chiến báo chờ gửi, `reports/<id>.<ext>` là ảnh chiến báo đã gửi, `posts/<id>.<ext>` là ảnh bài viết |
| `SITE_ORIGIN` | var | Danh sách origin của site, phân tách dấu phẩy (`https://tqccl.com,https://www.tqccl.com,https://tqccl.pages.dev,https://preview-community.tqccl.pages.dev`). Origin đầu là mặc định. Better Auth lấy `baseURL` theo domain của request nếu domain đó nằm trong danh sách; tất cả đều là origin tin cậy |
| `ADMIN_EMAILS` | var | Danh sách email admin, phân tách bằng dấu phẩy, không phân biệt hoa thường |
| `AI_KV` | KV binding | Cùng namespace `RL` của `worker/` (`6fff7d73c885457dbb71756de99e66fa`). Khoá `ai:config` chứa cấu hình AI đã mã hoá (nhà cung cấp + chuỗi của bốn nhóm tính năng); Worker này ghi (tab AI), `worker/` chỉ đọc |
| `AI_CONFIG_SECRET` | secret | Khoá dẫn xuất (HKDF) để mã hoá/giải mã `ai:config`; **phải trùng giá trị** với `worker/`. Thiếu thì analyze trả 503 `ai_not_configured` và API tab AI trả 503 `ai_secret_missing` |
| `FEATURE_ENABLED` | var | Đặt `"false"` để tắt `POST /api/reports/analyze` (trả 503 `feature_disabled`) |
| `BETTER_AUTH_SECRET` | secret | Chuỗi ngẫu nhiên từ 32 byte trở lên, ví dụ tạo bằng `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | secret | OAuth client loại Web application |
| `GITHUB_REPOSITORY` | var | `nguyennguyenit/CamNangTQCCL`, repo nhận `repository_dispatch` |
| `GITHUB_DISPATCH_TOKEN` | secret | Fine-grained PAT chỉ cho repo trên, quyền **Contents: Read and write** (bắt buộc cho `repository_dispatch`). Nếu thiếu, publish vẫn lưu DB nhưng trả `deploy.ok=false` |
| `FEEDBACK_MAIL` | send_email binding | Gửi thư báo góp ý; `destination_address` khoá cứng người nhận `nguyennlt.ncc@gmail.com`. Thiếu binding hoặc gửi lỗi thì góp ý vẫn lưu D1 (chỉ ghi log) |
| `FEEDBACK_FROM`, `FEEDBACK_TO` | var | Địa chỉ gửi `gopy@mail.tqccl.com` (subdomain đã bật Email Routing) và địa chỉ nhận (trùng `destination_address`) |
| `TURNSTILE_SECRET` | secret | Secret của widget Turnstile có site key trong `js/config.js` (dùng chung với công cụ đọc ảnh). Thiếu thì khách ẩn danh gửi góp ý nhận 503 `feedback_unavailable` |
| `IP_HASH_SECRET` | secret | Khoá HMAC băm IP cho giới hạn góp ý ẩn danh (≥ 32 byte ngẫu nhiên). Thiếu thì khách ẩn danh nhận 503 `feedback_unavailable`; người đã đăng nhập vẫn gửi được |

Cron `17 * * * *` chạy mỗi giờ để xoá object R2 `pending/` cũ hơn 24 giờ, bản ghi upload `pending` quá hạn và bộ đếm rate limit đã hết cửa sổ.

## Hạ tầng đã dựng (2026-09-27)

| Thành phần | Giá trị |
|---|---|
| Worker | `tqccl-community` — `https://tqccl-community.nguyennlt-ncc.workers.dev` |
| D1 | `tqccl-community` (`3289bb76-b190-4f92-b154-adb91917fdf0`, APAC), đã áp `0001`, `0002` |
| R2 | `tqccl-community-media` |
| Pages `tqccl` | Service binding `COMMUNITY` → `tqccl-community` cho Production và Preview |
| Secret đã đặt | `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Google OAuth | Project `my-project-11711cam-nang-tqccl` (tên "Cam Nang TQCCL", tài khoản `nguyennlt.ncc@gmail.com`), Google Auth Platform: External, **In production**, client Web `tqccl-community-web`; privacy policy `https://tqccl.com/chinh-sach-bao-mat/` |
| Admin | `nguyennlt.ncc@gmail.com` |

Thiết lập lại từ đầu (chạy trong `community-worker/`):

```bash
npm install
npx wrangler d1 create tqccl-community          # dán database_id vào wrangler.jsonc
npx wrangler r2 bucket create tqccl-community-media
npx wrangler d1 migrations apply tqccl-community --remote

openssl rand -base64 48 | tr -d '\n' | npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
openssl rand -base64 48 | tr -d '\n'   # sinh AI_CONFIG_SECRET một lần, dán cho CẢ HAI Worker
npx wrangler secret put AI_CONFIG_SECRET
npx wrangler secret put GITHUB_DISPATCH_TOKEN
npx wrangler deploy
```

### Google OAuth

Đã tạo (2026-09-27) trong project `my-project-11711cam-nang-tqccl`. Tạo lại: Google Auth Platform → Branding (tên app, email hỗ trợ, trang chủ `https://tqccl.com/`, privacy policy) → Audience External, Publish app → Clients → Web application:

- Authorized JavaScript origins: `https://tqccl.com`, `https://www.tqccl.com`, `https://tqccl.pages.dev`, `https://preview-community.tqccl.pages.dev`
- Authorized redirect URIs: thêm `/api/auth/callback/google` sau từng origin trên, ví dụ `https://tqccl.com/api/auth/callback/google`.
- Khi dev cục bộ, thêm `http://localhost:4321` và `http://localhost:4321/api/auth/callback/google`.

Người dùng đăng nhập riêng trên từng domain (cookie gắn theo domain). Bỏ alias preview khỏi `SITE_ORIGIN` và Google khi không cần thử trên preview nữa.

### Build lại site khi xuất bản bài

Project Pages `tqccl` là direct upload (không nối Git) nên không có Deploy hook. Khi admin publish, unpublish, sửa hoặc xoá một bài đang public, Worker gửi `POST https://api.github.com/repos/<GITHUB_REPOSITORY>/dispatches` với `event_type: "blog-publish"`. Workflow [`pages-deploy.yml`](../.github/workflows/pages-deploy.yml) checkout `main`, chạy `npm run build` + `npm run verify` rồi `wrangler pages deploy dist --branch main` từ root (đóng gói luôn `functions/`). Workflow cũng chạy tay được bằng `workflow_dispatch`. Nếu dispatch lỗi, dữ liệu trong DB vẫn giữ nguyên và response trả `deploy: {ok:false, status, error}`.

Workflow cần secret GitHub `CLOUDFLARE_PAGES_API_TOKEN`: API token Cloudflare quyền **Account › Cloudflare Pages › Edit** trên account `e2ab96bb7fa53e5ad848286816d344a5`. Workflow luôn build từ `main`, nên chỉ nội dung đã push lên `main` mới được deploy.

Lúc build, Astro đọc `GET {COMMUNITY_API_ORIGIN}/api/posts`. Workflow đặt `COMMUNITY_API_ORIGIN=https://tqccl-community.nguyennlt-ncc.workers.dev`; build tay cũng phải đặt biến này, nếu không blog sẽ rỗng.

### Binding cho Pages Function

Service binding `COMMUNITY` (Production và Preview) đã được đặt qua Cloudflare API. Cách dự phòng: biến môi trường `COMMUNITY_API_ORIGIN` với URL `workers.dev` của Worker; proxy gắn `X-Forwarded-Host` để Worker biết domain gốc.

Nếu không có cả hai, `/api/*` trả 503 `{"error":{"code":"community_unavailable",...}}`. Proxy chuyển tiếp nguyên method, header và body với `redirect: "manual"`, rồi trả nguyên response, nên giữ đủ mọi `Set-Cookie` và `Location` của luồng OAuth. Better Auth lấy IP client từ `cf-connecting-ip` để rate limit.

### Góp ý, sửa lỗi: gửi thư qua Email Routing

Thư báo góp ý chỉ đi tới một địa chỉ đã xác minh, nên dùng Email Routing (miễn phí, không tính vào quota gửi) thay vì dịch vụ mail bên thứ ba. Email Routing bật trên subdomain `mail.tqccl.com`, không bật trên apex: MX/SPF của `tqccl.com` vẫn là forwarding Porkbun (`fwd1/fwd2.porkbun.com`, `include:_spf.porkbun.com`). Địa chỉ gửi phải thuộc domain đã bật Email Routing; thiếu thì thư lỗi âm thầm (chỉ `console.error("feedback mail failed", …)`), góp ý vẫn lưu D1. Người gửi để lại email thì thư có `Reply-To` là email đó: bấm Reply trong Gmail là trả lời thẳng người gửi. Làm một lần:

1. Bật Email Routing cho subdomain. Dashboard: **Email Service** → **Email Routing** → `tqccl.com` → **Settings** → **Subdomains** → `mail.tqccl.com`. Hoặc API `POST /zones/{zone_id}/email/routing/dns` với `{"name":"mail.tqccl.com"}`. Cloudflare thêm MX `route{1,2,3}.mx.cloudflare.net` và SPF `include:_spf.mx.cloudflare.net` chỉ trên `mail.tqccl.com`.
2. **Destination addresses** → thêm `nguyennlt.ncc@gmail.com` rồi bấm link xác minh trong Gmail.
3. Tuỳ chọn: **Routing rules** → `gopy@mail.tqccl.com` chuyển về Gmail, để thư gửi tới địa chỉ gửi đi vẫn nhận được.
4. Turnstile → widget của site key trong `js/config.js` → **Hostname management** phải có `tqccl.com`, `www.tqccl.com`, `tqccl.pages.dev` (thêm `preview-community.tqccl.pages.dev` nếu thử trên preview). Worker chỉ nhận token có hostname thuộc `SITE_ORIGIN`.
5. Trong `community-worker/`:

```bash
npx wrangler secret put TURNSTILE_SECRET                               # cùng secret với worker/
openssl rand -base64 48 | tr -d '\n' | npx wrangler secret put IP_HASH_SECRET
npx wrangler d1 migrations apply tqccl-community --remote              # 0003_feedback
npx wrangler deploy
```

Deploy Worker **trước** khi deploy Pages để nút góp ý không gọi vào route chưa có. Kiểm tra sau deploy: gửi thử một góp ý khi chưa đăng nhập, xem thư về Gmail, bấm Reply thấy đúng email người gửi, và `npx wrangler d1 execute tqccl-community --remote --command "select id, kind, status from feedback order by created_at desc limit 5"` có dòng mới.

### Cấu hình AI (tab AI)

Endpoint/model/key và mức suy luận của mọi tính năng AI không nằm trong env mà trong một bản ghi KV `ai:config` `{providers, groups}`, mã hoá AES-GCM (IV ngẫu nhiên 12 byte, khoá HKDF-SHA-256 từ `AI_CONFIG_SECRET`). Code dùng chung: [`shared/ai-config.ts`](../shared/ai-config.ts) và catalog model [`shared/ai-models.ts`](../shared/ai-models.ts).

- **Nhà cung cấp** (chung): `{id, label, preset, endpoint, apiKey, enabled, extraModels}`. `preset` là mẫu trong catalog (`deepseek`, `opencode-zen`) hoặc `""` (tùy chỉnh); model chọn được = model của mẫu ∪ `extraModels` admin tự thêm. Mỗi model khai báo `vision` (nhận ảnh), `effortStyle` và `efforts` (các mức nhận được).
- **Nhóm tính năng** (riêng): `teamScan` (Soi đội, mode `analyzeTeamImage`), `rosterRecommend` (Gợi ý đội: `scanHeroes`, `scanTactics`, `scanBuiltTeams`), `explainSubstitute` (giải thích món bù, chỉ văn bản) và `battleReport` (chiến báo). Mỗi nhóm: `chain` là danh sách có thứ tự `{providerId, modelId, effort}`, `timeoutMs` mỗi lượt (5–120 s, nguyên giây) và `budgetMs` trần tổng cho cả chuỗi (timeout–180 s, nguyên giây).
- **Effort → body** theo `effortStyle` của model: `deepseek` → `thinking: {type: "disabled"}` khi `off`, còn lại `thinking: {type: "enabled"}` + `reasoning_effort` (`low`/`high`/`max`); `openai` → `reasoning_effort` (`none`/`low`/`medium`/`high`); `none` → không gửi trường nào.
- **Failover:** thử lần lượt mắt xích của nhóm (bỏ mắt xích trỏ tới nhà cung cấp tắt/model không còn); 401/402/403/429/5xx, lỗi mạng, timeout → mắt xích kế; gặp 2xx là dừng. Mỗi lượt chờ `min(timeoutMs, thời gian còn lại của trần tổng)`; còn dưới 3 giây thì dừng. Chuỗi rỗng hoặc không mắt xích nào chạy được → nhóm đó trả chưa cấu hình (không kế thừa nhóm khác). Log `ai_provider_failed` có `group`, `model`, `effort`.

- `GET /api/admin/ai/config` (admin) → `{providers: [{id, label, preset, endpoint, enabled, extraModels, keyLast4}], groups, presets, effortLevels, groupNeedsVision}`. Không bao giờ trả key.
- `PUT /api/admin/ai/config` (admin) với `{providers, groups}` ghi đè cả bản ghi. Mục có `apiKey` rỗng/thiếu giữ key cũ khi cùng `id` **và** cùng `endpoint`; mục mới hoặc đổi endpoint mà thiếu key → 400 `missing_api_key` (key không tự đi theo sang host khác). Nhà cung cấp: tối đa 10; `id` 1–64 ký tự `[A-Za-z0-9_-]`, không trùng (`duplicate_id`); `preset` phải tồn tại (`invalid_preset`) và `endpoint` phải trùng endpoint của mẫu, hoặc là URL `https:` ≤ 500 ký tự khi tùy chỉnh (`invalid_endpoint`); `label` ≤ 80, `apiKey` ≤ 500; `extraModels` ≤ 20 (`invalid_models`), `modelId` ≤ 120 và không trùng catalog/nhau (`duplicate_model`), `effortStyle` hợp lệ (`invalid_effort_style`), `efforts` là tập con khác rỗng của mức theo kiểu (`invalid_efforts`). Nhóm: đủ bốn nhóm (`invalid_groups`), ≤ 10 mắt xích (`invalid_chain`), mắt xích trỏ tới nhà cung cấp có thật (`unknown_provider`), model có trong catalog của nó (`unknown_model`), effort model nhận (`invalid_effort`), nhóm đọc ảnh chỉ nhận model `vision` (`model_not_vision`), `timeoutMs` (`invalid_timeout`), `budgetMs` (`invalid_budget`).
- `worker/` đọc với `cacheTtl` 60 giây nên thay đổi có hiệu lực trong khoảng 1 phút; chiến báo đọc mới mỗi lượt.
- Catalog model tĩnh: `node scripts/scan-ai-models.mjs` (tuỳ chọn `DEEPSEEK_API_KEY`, `OPENCODE_API_KEY`) in model mới/đã mất so với `shared/ai-models.ts`; cờ `vision`/`effortStyle`/`efforts` điền tay theo tài liệu nhà cung cấp rồi deploy cả hai Worker. Model lẻ thì thêm ở tab AI (`extraModels`), không cần deploy.

Bản ghi cũ `ai:providers` (danh sách provider có `modelId`) đã được chuyển sang `ai:config` ngày 2026-10-05; code không còn đọc khoá cũ. Khoá HKDF vẫn dẫn xuất với nhãn `ai:providers v1` — đổi nhãn sẽ làm `ai:config` đã lưu không giải mã được.

## Dev cục bộ

```bash
cd community-worker
cat > .dev.vars <<'EOF'
BETTER_AUTH_SECRET=<chuỗi ngẫu nhiên dài>
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
SITE_ORIGIN=http://localhost:4321
ADMIN_EMAILS=<email của bạn>
AI_CONFIG_SECRET=<chuỗi ngẫu nhiên dài>   # KV cục bộ của wrangler dev; nhập nhà cung cấp qua tab AI
EOF
npm run db:migrate:local
npm run dev            # wrangler dev --port 8788
```

`.dev.vars` và `.wrangler/` đã có trong `community-worker/.gitignore`. Site phải gọi `/api` cùng origin với trang. Có hai cách:

- `astro dev` (cổng 4321): thêm proxy của Vite trong `astro.config.mjs`, `vite.server.proxy = { "/api": "http://127.0.0.1:8788" }`, rồi giữ `SITE_ORIGIN=http://localhost:4321` để URL callback OAuth quay về cổng Astro.
- Chạy giống production: `npm run build` ở root, rồi `npx wrangler pages dev dist --service COMMUNITY=tqccl-community` khi Worker vẫn đang chạy `wrangler dev`. Nếu dùng cách này, đặt `SITE_ORIGIN` theo cổng mà `pages dev` in ra.

## Kiểm tra

```bash
cd community-worker
npx tsc --noEmit
npx vitest run
```

Test dùng D1 giả chạy trên `node:sqlite` (áp dụng migration thật), R2/KV giả trong bộ nhớ và binding thư giả. Test bao phủ pageKey/lang, quyền xoá và kiểm duyệt, quyền xem ảnh chưa duyệt, thống kê, ngưỡng rate limit, slug trùng, deploy hook, cách parse kết quả phân tích, góp ý (Turnstile, giới hạn theo IP/user, thư báo, lỗi gửi thư, lọc và đổi trạng thái của admin), cấu hình AI (`test/ai-config.test.ts` cho mã hoá, chuyển bản ghi v1, phân giải chuỗi, effort → body, failover + trần tổng của `shared/ai-config.ts`; `test/ai-admin.test.ts` cho API tab AI) và đồng bộ theo dõi chiêu mộ (`test/recruit.test.ts`: LWW, rev, phân trang, trần bản ghi). Client đồng bộ `js/recruit-sync.js` có test riêng `node --experimental-strip-types --test tests-js/recruit-sync.test.mjs`.

## Hành vi cần biết

- Lỗi luôn có dạng `{error:{code,message}}`. `message` viết bằng tiếng Việt cho log, còn UI phải dựa vào `code` để dịch bằng `L()`. Các code gồm `unauthorized` (401), `forbidden`, `forbidden_origin`, `turnstile_required` và `turnstile_failed` (403), `not_found` (404), `rate_limited` (429, kèm `Retry-After`), `invalid_*`, `duplicate_id`, `duplicate_model`, `unknown_provider`, `unknown_model`, `model_not_vision` và `missing_api_key` (400), `invalid_upload`, `image_too_large`, `recruit_quota_exceeded` (413), `unsupported_media_type` và `invalid_image_type` (415), `slug_taken` và `translation_key_taken` (409), `feature_disabled`, `ai_not_configured`, `ai_secret_missing`, `ai_overloaded` và `feedback_unavailable` (503), `ai_unavailable` (502).
- Request `POST`/`PUT`/`DELETE` có `Origin` không nằm trong `SITE_ORIGIN` và danh sách localhost dev sẽ bị chặn với 403 `forbidden_origin`. Body JSON bắt buộc có `Content-Type: application/json`.
- Rate limit lưu trong bảng D1 `rate_limits`: bình luận 10 lần/giờ, analyze 20 lần/ngày, gửi chiến báo 30 lần/ngày, admin upload 100 lần/ngày, đẩy đồng bộ chiêu mộ 600 lô/giờ, gửi ảnh mẫu soi đội (`scan_sample`) 10 lần/ngày (theo user); góp ý 10 lần/giờ theo user khi đã đăng nhập, 5 lần/giờ theo IP đã băm HMAC khi ẩn danh (IPv6 gom theo /64, đếm trước siteverify); đếm ẩn danh soi đội (`scan_stats`) 60 lần/giờ theo IP đã băm. Better Auth có thêm rate limit riêng cho `/api/auth/*`, lưu trong bảng `rateLimit`.
- `POST /api/feedback` nhận `{kind, title, body, email?, page?, lang, turnstileToken?}`: `kind` là `feature`/`bug`/`wrong_info`/`other`, tiêu đề 1–120 ký tự (gộp khoảng trắng thành một dòng), nội dung 1–4000 ký tự, email tuỳ chọn, `page` là đường dẫn cùng site (bắt đầu bằng `/`). Khách ẩn danh bắt buộc có `turnstileToken`; người đã đăng nhập bỏ qua Turnstile. Trả 201 `{ok:true}` sau khi lưu; thư gửi nền bằng `waitUntil`. `GET /api/me` trả thêm `email` để hộp thoại điền sẵn.
- Admin: `GET /api/admin/feedback?status=new|done&kind=&cursor=` (mới nhất trước, 20/trang) và `POST /api/admin/feedback/:id/status` với `{status}`.
- **Soi đội: tín hiệu lỗi** (migration `0005_scan.sql`, bảng `scan_stats` và `scan_samples`; khi deploy phải chạy `npx wrangler d1 migrations apply tqccl-community --remote`, hay `db:migrate:remote`, trước `wrangler deploy`).
  - `POST /api/scan-stats` (ẩn danh, không Turnstile) nhận `{screen: battleReport|teamDetail|other, side: left|right, read, edited, unclear}`, mỗi số nguyên 0..12 và `unclear ≤ read`; sai → 400. Cộng dồn vào `scan_stats` theo ngày UTC + screen + side (chỉ số đếm, không ảnh, không tên, không IP). Trả 201 `{ok:true}`. Giới hạn 60 lần/giờ theo IP đã băm HMAC (`IP_HASH_SECRET`); thiếu secret → 503 `scan_stats_unavailable`.
  - `POST /api/scan-samples` (cần đăng nhập, multipart): `image` JPEG/PNG/WebP ≤ 1,5 MB và `payload` là chuỗi JSON `{screen, side, lang, aiRead:{heroes:[HeroRead…]}, confirmed:{heroes:[{hero:"hero:<slug>", tactics:[id|null, id|null], book:id|null} ×3]}}`. ID phải đúng loại (`hero:`/`tactic:`/`book:` + slug); `aiRead` ≤ 6 tướng, chuỗi cắt còn 40 ký tự. Giới hạn 10 mẫu/ngày/user. Lưu ảnh ở R2 `scan-samples/<id>.<ext>` và D1 trạng thái `pending`; trả 201 `{id, status:"pending"}`. Ảnh chỉ được lưu khi người dùng chủ động bấm gửi (có đồng ý).
  - Admin: `GET /api/admin/scan-stats?days=7|30|90` (mặc định 30) → `{days, rows:[{screen, side, events, read, edited, unclear}]}`; `GET /api/admin/scan-samples?status=pending|approved|rejected&cursor=` (20/trang); `GET /api/admin/scan-samples/:id/image` (chỉ admin, `private, no-store`); `POST .../:id/approve` (409 `image_missing` nếu mẫu đã mất ảnh); `POST .../:id/reject` (xoá object R2, `image_key = null`); `GET .../:id/fixture` (chỉ mẫu approved còn ảnh, nếu không 409 `not_approved`/`image_missing`) trả fixture bộ ảnh chuẩn `{image:"<id>.<ext>", source:"scan-sample <id>", expected:{screen, sides:[{side, heroes}]}}`. Tab **Soi đội** ở `/quan-tri/` dùng các endpoint này; admin tải ảnh, che tên tài khoản rồi đặt cùng fixture vào `worker/eval/images/` và `worker/eval/fixtures/`.
- Đồng bộ "Theo dõi chiêu mộ" (bảng `recruit_records`, migration `0004_recruit.sql`, cần đăng nhập, 401 nếu chưa): `GET /api/recruit?since=<rev>` trả `{records:[{kind, id, updatedAt, data}], cursor, more}` theo thứ tự `rev`, 500 bản ghi/trang; trang rỗng trả `cursor` = rev lớn nhất hiện có. `POST /api/recruit` nhận `{records}` tối đa 500 mục: `kind` là `account`/`banner`/`event`, `id` 1–100 ký tự, `updatedAt` số nguyên ms, `data` là object có `data.id === id`, `Date.parse(data.updatedAt) === updatedAt` và JSON ≤ 4 KB (sai → 400 `invalid_records`). Ghi LWW: chỉ thay khi `updatedAt` mới hơn bản đang lưu; mỗi dòng thực sự được ghi nhận `rev` mới tăng dần theo user (không nhận `rev` từ client). Trả `{accepted, cursor}` (`accepted` = số dòng đã ghi). Trần 20 000 bản ghi mỗi user; thêm bản ghi mới vượt trần → 413 `recruit_quota_exceeded` (sửa bản ghi đã có vẫn được).
- Nếu model không đọc được ảnh, `analyze` vẫn trả 200 với `analysis` rỗng (`result:null`, không có tướng) và vẫn giữ `uploadId` để người dùng tự nhập. Nếu upstream lỗi, endpoint trả 502/503 và xoá ảnh.
- `POST /api/reports` nhận `allyHeroes` từ 1 đến 5 tên, `enemyHeroes` từ 0 đến 5 tên, mỗi tên dài 1 đến 20 ký tự và không trùng nhau; `note` tối đa 500 ký tự, `season` tối đa 40 ký tự. Ảnh được chuyển từ `pending/` sang `reports/`.
- Ảnh chiến báo chưa duyệt trả 404 cho mọi người trừ chủ báo cáo và admin (`Cache-Control: private, no-store`). Ảnh đã duyệt được cache công khai 1 giờ. Media bài viết `/api/media/posts/...` được cache `immutable` 1 năm. Các khoá R2 khác không đọc được qua đường này.
- Ngoài các endpoint trong plan, có thêm `GET /api/admin/comments?cursor=` để trang quản trị xem bình luận mới nhất toàn site (mỗi mục có kèm `page`).
- `GET /api/admin/counts` (chỉ admin; khách 401, người thường 403) → `{reportsPending, postsDraft, feedbackNew, feedbackDone, scanPending}`: số chiến báo chờ duyệt, bài nháp, góp ý chưa/đã xử lý, ảnh soi đội chờ duyệt, một truy vấn đếm theo index trạng thái sẵn có (không migration). `/quan-tri/` dùng cho badge điều hướng và dòng tổng ở khu Góp ý, tải lại sau mỗi thao tác đổi trạng thái.
- `PUT /api/admin/posts/:id` chỉ cập nhật các trường được gửi lên và trả `{post, deploy|null}`. `POST /api/admin/posts` trả post (201). `publish` và `unpublish` trả `{post, deploy}`.
- Đổi phiên bản `better-auth` có thể đổi schema. Khi đó sinh lại SQL bằng `getMigrations(...).compileMigrations()` từ `better-auth/db/migration`, dùng một DB `node:sqlite` trống và đúng cấu hình của `src/auth.ts`, rồi thêm file migration mới. Không sửa file migration đã áp dụng.
