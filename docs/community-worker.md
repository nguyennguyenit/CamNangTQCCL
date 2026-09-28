# Community Worker (đăng nhập, bình luận, chiến báo, bài viết, góp ý)

`community-worker/` là Cloudflare Worker (Hono) tách biệt site tĩnh: Better Auth với Google, D1 cho dữ liệu, R2 cho ảnh, Qwen Vision (DashScope) để đọc ảnh chiến báo, GitHub `repository_dispatch` để build lại site khi xuất bản bài viết, và Cloudflare Email Service (binding `send_email`) để gửi thư báo góp ý. Hợp đồng API nằm trong [`plans/260927-cong-dong-song-ngu/plan.md`](../plans/260927-cong-dong-song-ngu/plan.md).

Trình duyệt không gọi thẳng `workers.dev`. Mọi request `/api/*` trên `tqccl.com`, `www.tqccl.com` và `tqccl.pages.dev` đi qua Pages Function [`functions/api/[[path]].ts`](../functions/api/[[path]].ts), nên cookie phiên là cookie first-party của đúng domain đó.

```text
Trình duyệt ──/api/*──► Pages Function (proxy) ──service binding COMMUNITY──► community-worker ─┬─ D1  DB
                                                (dự phòng: COMMUNITY_API_ORIGIN)                ├─ R2  MEDIA
                                                                                                ├─ DashScope (Qwen Vision)
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
| `REGION`, `MODEL_ID`, `MODEL_ENDPOINT` | var | Giống `worker/`: `REGION=intl` (Singapore) hoặc `cn`; nếu có `MODEL_ENDPOINT` thì giá trị này được dùng thay endpoint theo region |
| `FEATURE_ENABLED` | var | Đặt `"false"` để tắt `POST /api/reports/analyze` (trả 503 `feature_disabled`) |
| `BETTER_AUTH_SECRET` | secret | Chuỗi ngẫu nhiên từ 32 byte trở lên, ví dụ tạo bằng `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | secret | OAuth client loại Web application |
| `QWEN_API_KEY` | secret | Khoá DashScope. Nếu thiếu, analyze trả 503 `ai_not_configured` |
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
npx wrangler secret put QWEN_API_KEY
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

## Dev cục bộ

```bash
cd community-worker
cat > .dev.vars <<'EOF'
BETTER_AUTH_SECRET=<chuỗi ngẫu nhiên dài>
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
SITE_ORIGIN=http://localhost:4321
ADMIN_EMAILS=<email của bạn>
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

Test dùng D1 giả chạy trên `node:sqlite` (áp dụng migration thật), R2 giả trong bộ nhớ và binding thư giả. Test bao phủ pageKey/lang, quyền xoá và kiểm duyệt, quyền xem ảnh chưa duyệt, thống kê, ngưỡng rate limit, slug trùng, deploy hook, cách parse kết quả phân tích, và góp ý (Turnstile, giới hạn theo IP/user, thư báo, lỗi gửi thư, lọc và đổi trạng thái của admin).

## Hành vi cần biết

- Lỗi luôn có dạng `{error:{code,message}}`. `message` viết bằng tiếng Việt cho log, còn UI phải dựa vào `code` để dịch bằng `L()`. Các code gồm `unauthorized` (401), `forbidden`, `forbidden_origin`, `turnstile_required` và `turnstile_failed` (403), `not_found` (404), `rate_limited` (429, kèm `Retry-After`), `invalid_*` (400), `invalid_upload`, `image_too_large` (413), `unsupported_media_type` và `invalid_image_type` (415), `slug_taken` và `translation_key_taken` (409), `feature_disabled`, `ai_not_configured`, `ai_overloaded` và `feedback_unavailable` (503), `ai_unavailable` (502).
- Request `POST`/`PUT`/`DELETE` có `Origin` không nằm trong `SITE_ORIGIN` và danh sách localhost dev sẽ bị chặn với 403 `forbidden_origin`. Body JSON bắt buộc có `Content-Type: application/json`.
- Rate limit lưu trong bảng D1 `rate_limits`: bình luận 10 lần/giờ, analyze 20 lần/ngày, gửi chiến báo 30 lần/ngày, admin upload 100 lần/ngày (theo user); góp ý 10 lần/giờ theo user khi đã đăng nhập, 5 lần/giờ theo IP đã băm HMAC khi ẩn danh (IPv6 gom theo /64, đếm trước siteverify). Better Auth có thêm rate limit riêng cho `/api/auth/*`, lưu trong bảng `rateLimit`.
- `POST /api/feedback` nhận `{kind, title, body, email?, page?, lang, turnstileToken?}`: `kind` là `feature`/`bug`/`wrong_info`/`other`, tiêu đề 1–120 ký tự (gộp khoảng trắng thành một dòng), nội dung 1–4000 ký tự, email tuỳ chọn, `page` là đường dẫn cùng site (bắt đầu bằng `/`). Khách ẩn danh bắt buộc có `turnstileToken`; người đã đăng nhập bỏ qua Turnstile. Trả 201 `{ok:true}` sau khi lưu; thư gửi nền bằng `waitUntil`. `GET /api/me` trả thêm `email` để hộp thoại điền sẵn.
- Admin: `GET /api/admin/feedback?status=new|done&kind=&cursor=` (mới nhất trước, 20/trang) và `POST /api/admin/feedback/:id/status` với `{status}`.
- Nếu model không đọc được ảnh, `analyze` vẫn trả 200 với `analysis` rỗng (`result:null`, không có tướng) và vẫn giữ `uploadId` để người dùng tự nhập. Nếu upstream lỗi, endpoint trả 502/503 và xoá ảnh.
- `POST /api/reports` nhận `allyHeroes` từ 1 đến 5 tên, `enemyHeroes` từ 0 đến 5 tên, mỗi tên dài 1 đến 20 ký tự và không trùng nhau; `note` tối đa 500 ký tự, `season` tối đa 40 ký tự. Ảnh được chuyển từ `pending/` sang `reports/`.
- Ảnh chiến báo chưa duyệt trả 404 cho mọi người trừ chủ báo cáo và admin (`Cache-Control: private, no-store`). Ảnh đã duyệt được cache công khai 1 giờ. Media bài viết `/api/media/posts/...` được cache `immutable` 1 năm. Các khoá R2 khác không đọc được qua đường này.
- Ngoài các endpoint trong plan, có thêm `GET /api/admin/comments?cursor=` để trang quản trị xem bình luận mới nhất toàn site (mỗi mục có kèm `page`).
- `PUT /api/admin/posts/:id` chỉ cập nhật các trường được gửi lên và trả `{post, deploy|null}`. `POST /api/admin/posts` trả post (201). `publish` và `unpublish` trả `{post, deploy}`.
- Đổi phiên bản `better-auth` có thể đổi schema. Khi đó sinh lại SQL bằng `getMigrations(...).compileMigrations()` từ `better-auth/db/migration`, dùng một DB `node:sqlite` trống và đúng cấu hình của `src/auth.ts`, rồi thêm file migration mới. Không sửa file migration đã áp dụng.
