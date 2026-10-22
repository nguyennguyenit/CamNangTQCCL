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
| `MEDIA` | R2 binding | `pending/<uploadId>` là ảnh chiến báo chờ gửi, `pending/team-<uploadId>` là ảnh đội cộng đồng chờ gửi, `reports/<id>.<ext>` là ảnh chiến báo đã gửi, `community-teams/<teamId>/<vị trí>.<ext>` là ảnh đội đã đăng, `posts/<id>.<ext>` là ảnh bài viết |
| `SITE_ORIGIN` | var | Danh sách origin của site, phân tách dấu phẩy (`https://tqccl.com,https://www.tqccl.com,https://tqccl.pages.dev,https://preview-community.tqccl.pages.dev`). Origin đầu là mặc định. Better Auth lấy `baseURL` theo domain của request nếu domain đó nằm trong danh sách; tất cả đều là origin tin cậy |
| `ADMIN_EMAILS` | var | Danh sách email **root** (quản trị viên cao nhất), phân tách bằng dấu phẩy, không phân biệt hoa thường. Root chỉ lấy từ biến này, không cấp được qua UI; kiểm duyệt viên (KDV) do root cấp trên UI (xem [Vai trò và người dùng](#vai-trò-và-người-dùng)) |
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

Cron `17 * * * *` chạy mỗi giờ để xoá object R2 `pending/` cũ hơn 24 giờ (gồm cả `pending/team-`, vì cùng tiền tố), bản ghi upload `pending` quá hạn và bộ đếm rate limit đã hết cửa sổ.

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

- `GET /api/admin/ai/config` (chỉ root; KDV 403) → `{providers: [{id, label, preset, endpoint, enabled, extraModels, keyLast4}], groups, presets, effortLevels, groupNeedsVision}`. Không bao giờ trả key.
- `PUT /api/admin/ai/config` (chỉ root; KDV 403, ghi `ai.config.update` vào nhật ký) với `{providers, groups}` ghi đè cả bản ghi. Mục có `apiKey` rỗng/thiếu giữ key cũ khi cùng `id` **và** cùng `endpoint`; mục mới hoặc đổi endpoint mà thiếu key → 400 `missing_api_key` (key không tự đi theo sang host khác). Nhà cung cấp: tối đa 10; `id` 1–64 ký tự `[A-Za-z0-9_-]`, không trùng (`duplicate_id`); `preset` phải tồn tại (`invalid_preset`) và `endpoint` phải trùng endpoint của mẫu, hoặc là URL `https:` ≤ 500 ký tự khi tùy chỉnh (`invalid_endpoint`); `label` ≤ 80, `apiKey` ≤ 500; `extraModels` ≤ 20 (`invalid_models`), `modelId` ≤ 120 và không trùng catalog/nhau (`duplicate_model`), `effortStyle` hợp lệ (`invalid_effort_style`), `efforts` là tập con khác rỗng của mức theo kiểu (`invalid_efforts`). Nhóm: đủ bốn nhóm (`invalid_groups`), ≤ 10 mắt xích (`invalid_chain`), mắt xích trỏ tới nhà cung cấp có thật (`unknown_provider`), model có trong catalog của nó (`unknown_model`), effort model nhận (`invalid_effort`), nhóm đọc ảnh chỉ nhận model `vision` (`model_not_vision`), `timeoutMs` (`invalid_timeout`), `budgetMs` (`invalid_budget`).
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

Quản trị người dùng thêm các bộ test sau (đều chạy qua guard thật của app, harness đọc DB chứ không thay `getUser` bằng danh sách tĩnh): `test/permissions.test.ts` (ma trận 403/200 của KDV theo từng endpoint admin), `test/users.test.ts` (danh sách, phân trang, che email, khoá/mở/cấp quyền/xoá, thử lại sau lỗi R2), `test/visibility.test.ts` (nội dung của user bị khoá biến khỏi API công khai, còn ở API admin, hiện lại khi hết hạn), `test/audit.test.ts` + `test/moderation.test.ts` (nhật ký, token thông báo, che email). `test/auth-ban.test.ts` chạy **Better Auth thật** (dialect D1 dựng sẵn) trên D1 giả: đăng nhập Google được giả lập ở bước đổi code, nên test phủ hook `session.create.before`, trigger `session_block_blocked_user`, race khoá chen sau hook, token `ACCOUNT_BANNED` + `GET /api/ban-notice`, phiên cũ bị chặn bằng cookie thật, và việc `additionalData`/`/update-user` không tự đặt được `role`/`banned_until`. Giới hạn trung thực: **chưa có kiểm thử đăng nhập Google thật** (OAuth giả lập trong test, e2e mock `/api/*`); giao diện đã được smoke bằng `wrangler dev` + `wrangler pages dev` với session Better Auth tạo sẵn, không qua màn hình Google. Trigger đã chạy thử trên engine D1 cục bộ (`wrangler d1 migrations apply --local --persist-to <thư mục tạm>`).

Kiểm tra đầy đủ trước khi phát hành (từ thư mục gốc repo):

```bash
(cd community-worker && npx tsc --noEmit && npx vitest run)
npm run test:node
npm run build && npm run verify && npm run test:dist
npm run test:e2e
```

## Vai trò và người dùng

Kế hoạch: [`plans/261016-1757-quan-ly-nguoi-dung/plan.md`](../plans/261016-1757-quan-ly-nguoi-dung/plan.md). Migration [`0006_user_admin.sql`](../community-worker/migrations/0006_user_admin.sql) thêm cột vào bảng `user`, bảng `admin_audit`, các index và 4 trigger.

### Hai cấp quyền

- **root**: email nằm trong `ADMIN_EMAILS`. Không cấp được qua UI; vai trò hiệu lực đọc lại mỗi request (`effectiveRole`: root thắng cột `user.role`).
- **Kiểm duyệt viên (KDV)**: `user.role = 'moderator'`, do root cấp/thu ở khu Người dùng (`POST /api/admin/users/:id/role`); hiệu lực ngay ở request kế tiếp.
- `GET /api/me` trả `user.role` (`root`/`moderator`/`user`) thay cho cờ boolean quản trị cũ; client mới bắt buộc có trường này.

| Việc | root | KDV |
|---|---|---|
| Duyệt/từ chối chiến báo (`/api/admin/reports*`) | có | có, kể cả chiến báo của chính mình |
| Bình luận: xem toàn site, xoá | xoá mọi bình luận | xoá bình luận của người khác trừ KDV/root khác; điều kiện này nằm trong câu `DELETE` |
| Góp ý: xem, đổi trạng thái | email đầy đủ | email che, `emailMasked: true` |
| Soi đội: thống kê, mẫu, ảnh, duyệt/từ chối, fixture | có | có, kể cả mẫu của chính mình |
| Số việc chờ `GET /api/admin/counts` | có | có |
| Người dùng: danh sách, chi tiết, khoá, mở khoá | có | có, với giới hạn bên dưới; email che |
| Cấp/thu KDV, xoá tài khoản | có | không (403) |
| Bài viết và ảnh bài viết (`/api/admin/posts*`, `/api/admin/uploads`) | có | không |
| Cấu hình AI (`/api/admin/ai/config`) | có | không |
| Nhật ký toàn cục `GET /api/admin/audit` | có | không |

Mọi bình luận, góp ý, chiến báo, mẫu soi đội mà KDV thao tác đều ghi nhật ký; riêng KDV vẫn xem được **lịch sử nhật ký theo từng user** trong chi tiết user (`GET /api/admin/users/:id` trả 20 dòng `admin_audit` có `subject_user_id` của user đó, 10 bình luận và 10 chiến báo gần nhất), nhưng không có khu Nhật ký toàn cục.

### Danh sách và chi tiết user

`GET /api/admin/users?q=&role=user|moderator|root&status=active|banned|deleting&cursor=`: mới đăng ký trước, 20/trang (cursor theo `createdAt` + `id`). Mỗi dòng: `id, name, email, emailMasked?, image, createdAt, lastSeenAt, role, ban:{until|null, reason, byRole}|null, deleting, counts:{comments, reports, feedback, scanSamples}`.

- Root: `q` khớp một phần tên hoặc email (`%`/`_` được escape). KDV: `q` khớp một phần **tên**, còn email chỉ khớp khi gõ **nguyên địa chỉ**, nên KDV không dò được email bằng tiền tố.
- Email với KDV đi qua `maskEmail` ở server (`ng***@gmail.com`; phần trước `@` ≤ 2 ký tự giữ 1 ký tự). Việc che email chỉ áp cho trường email: nội dung góp ý (`body`) là văn bản tự do và **không** bị che, nên có thể chứa email hay số điện thoại do người gửi tự viết.

### Khoá tài khoản

- `POST /api/admin/users/:id/ban` `{duration: "1d"|"7d"|"30d"|"permanent", reason}` (staff; `reason` 1–500 ký tự bắt buộc). Khoá vĩnh viễn lưu `banned_until = 8.64e15`; API trả `until: null`.
- Cột: `banned_until` (epoch ms), `ban_reason`, `banned_by`, `banned_by_role` (`root`/`moderator`). Ban xong huỷ mọi phiên của user, và chỉ huỷ khi dòng nhật ký `user.ban` của đúng yêu cầu đó đã ghi.
- Ràng buộc đích nằm trong chính câu SQL ghi: không tự khoá mình (400 `invalid_target`), không khoá root (403), không khoá user đang xoá (409 `user_deleting`); KDV chỉ khoá user thường (không khoá KDV khác) và **không đè khoá còn hạn do root đặt** (KDV chỉ thay được khoá do KDV đặt, hoặc khoá đã hết hạn).
- `POST /api/admin/users/:id/unban`: root mở mọi khoá; KDV chỉ mở khoá có `banned_by_role = 'moderator'` trên user thường. Không bị khoá → 409 `not_banned`. Nếu khoá vừa bị thay giữa lúc đọc và ghi → 409 `conflict` (root) hoặc 403 (KDV), không mở nhầm.
- Hết hạn là tự hết (so với `banned_until`), không cần cron; trạng thái khoá không cần dọn.

### Guard, trigger và hai đồng hồ

- **Guard theo request** (`toSessionUser` trong `src/auth.ts`, một chỗ duy nhất): mỗi request đọc dòng user từ phiên Better Auth rồi trả `null` (401 với route cần đăng nhập; `GET /api/me` trả `user: null`) khi `banned_until > deps.now()` hoặc `deleting_at` khác null. Guard dùng đồng hồ `deps.now()` của Worker.
- **4 trigger `before insert`** chạy theo **đồng hồ của DB** (`unixepoch('subsec') * 1000`) và `raise(abort, 'account_blocked')` cho tài khoản bị khoá/đang xoá: `session_block_blocked_user` (bảng `session`), `uploads_block_blocked_user` (`uploads`), `battle_reports_block_blocked_user` (`battle_reports`), `scan_samples_block_blocked_user` (`scan_samples`). Chỉ các bảng giữ khoá R2 và session mới có trigger, để request đã qua guard ngay trước lúc khoá không để lại ảnh mồ côi hay phiên mới. Bình luận, góp ý, bản ghi chiêu mộ chỉ có guard; nội dung đã ghi bị ẩn bởi bộ lọc công khai. Điều kiện chặn trong trigger khớp `isBlocked` ở Worker nhưng đọc đồng hồ khác (DB so với `deps.now()`; hook đăng nhập dùng `Date.now()`), nên quanh đúng mốc hết hạn hai bên có thể bất đồng trong khoảng ngắn nếu đồng hồ Worker và DB lệch nhau.
- **Đăng nhập**: hook Better Auth `databaseHooks.session.create.before` (`src/auth.ts`) đọc `banned_until`/`deleting_at`; nếu đang bị chặn thì ném `APIError FORBIDDEN` với `code` `ACCOUNT_BANNED` (hoặc `ACCOUNT_UNAVAILABLE` khi đang xoá) và `message` là token thông báo. Không có wrapper nào bọc callback, nên lỗi hạ tầng không bị đổi thành "bị khoá".
- **Race đăng nhập trả 500 một lần**: nếu khoá chen vào sau khi hook đã đọc nhưng trước khi `insert session`, trigger `session_block_blocked_user` huỷ lệnh chèn và Better Auth trả 500 (không có phiên nào được tạo). Lần đăng nhập kế tiếp qua hook và nhận `ACCOUNT_BANNED` bình thường. Test `auth-ban.test.ts` ("race") khẳng định status 500, 0 session.

### Thông báo bị khoá

Lý do khoá không đi qua URL. Hook trả lỗi qua `errorCallbackURL` (client gửi URL trang hiện tại đã bỏ `error`, `error_description`) nên trang nạp lại với `?error=ACCOUNT_BANNED&error_description=<token>`. Token là `base64url(userId).exp.chữ ký HMAC-SHA256` ký bằng `BETTER_AUTH_SECRET` (thông điệp ký có tiền tố miền `ban-notice:v1.` để không dùng lẫn với chữ ký cookie của Better Auth), hạn 10 phút (`BAN_NOTICE_TTL_MS`). Client gọi `GET /api/ban-notice?token=<token>` → `{until: ISO|null, reason, deleting}`; token sai/hết hạn hoặc user không còn bị chặn → 404 `not_found`. Client hiển thị `reason` bằng `textContent`; khi không phải 200 chỉ hiện câu cố định "Không đăng nhập được. Thử lại sau." (không in chữ nào lấy từ URL), rồi `history.replaceState` bỏ `error`, `error_description` nhưng giữ tham số khác và hash. Mã `error` khác vẫn đi đường cũ.

### Ẩn nội dung

Chỉ các route công khai lọc bằng `visibleUserSql` (tác giả không còn khoá và không đang xoá, theo `deps.now()`): `GET /api/comments`, `GET /api/reports`, `GET /api/reports/stats` (không tính chiến báo của user bị khoá) và `GET /api/reports/:id/image` (404 cho khách; chủ và staff vẫn xem). Hàng chờ admin (`/api/admin/comments`, `/api/admin/reports`), `/api/me/reports` và chi tiết user không lọc. Hết khoá hoặc mở khoá thì nội dung hiện lại ngay, không cần cron.

### Xoá tài khoản (chỉ root)

`DELETE /api/admin/users/:id` `{confirmEmail}`:

1. `confirmEmail` phải khớp email của user (trim, không phân biệt hoa thường) → nếu không 400 `confirm_mismatch`. Không xoá mình/root. User **đang bị khoá còn hạn** → 409 `user_banned` (phải mở khoá trước).
2. Một batch: ghi nhật ký `user.delete.start`, đặt `deleting_at`, huỷ mọi phiên. Từ đây guard và 4 trigger chặn user. Dòng `start` chỉ sinh khi yêu cầu thật sự chuyển trạng thái, nên gọi lại không nhân đôi.
3. Xoá object R2 của user theo lô ≤ 1000 khoá: `uploads` loại `report`, `battle_reports.image_key`, `scan_samples.image_key`. **Không** xoá ảnh bài viết (`uploads.kind = 'post'`). Lỗi R2 → nhật ký `user.delete` `failed` (`meta.step: "r2"`) và 502 `delete_incomplete`; user giữ trạng thái đang xoá, gọi lại để làm tiếp (bỏ qua bước 2).
4. Một batch cuối: ghi nhật ký `user.delete` `ok` (đặt **trước** câu xoá, cùng điều kiện đủ quyền), chuyển `uploads` loại `post` sang root đang thao tác, `posts.author_id = null` (giữ `author_name`), `feedback.email = null` và `feedback.user_id = null` (nội dung `body` giữ lại, ẩn danh), `reviewed_by = null` trên chiến báo/mẫu soi đội, rồi `delete from "user"` (cascade bình luận, chiến báo, mẫu soi đội, `recruit_records`, `account`, `session`). Trả `{ok: true, removedObjects}`.

Giới hạn độ bền: nếu D1 hỏng **sau khi** R2 đã xoá xong, dòng nhật ký `failed` có thể không ghi được (chỉ `console.error`); không thể đảm bảo vì chính D1 là nơi ghi. Trạng thái vẫn an toàn: user còn `deleting_at`, gọi lại sẽ chạy tiếp.

### Nhật ký quản trị

Bảng `admin_audit` (epoch ms): người làm (`actor_id`, `actor_role`, `actor_label` đã che email), `action`, `target_type/id/label`, `subject_user_id` (chủ nội dung hoặc user đích, để tra theo user), `reason`, `meta` (JSON chọn lọc, không key/token/body thô), `status`, `created_at`. Chuỗi giống email trong nhãn (tên, tiêu đề người dùng nhập) bị che. `GET /api/admin/audit?action=&cursor=` chỉ root, mới nhất trước, 20/trang.

Mỗi thao tác ghi của quản trị sinh một dòng, chung batch D1 với thay đổi (`insert … select … where exists`, điều kiện chứng minh chính yêu cầu này đã xảy ra: nhật ký lỗi thì thay đổi rollback). Riêng thao tác xoá đặt dòng nhật ký **trước** câu `DELETE` với cùng điều kiện đủ quyền, vì sau khi xoá không còn gì để chứng minh. Hành động: `report.approve|reject`, `comment.delete` (chủ tự xoá không phải thao tác quản trị), `feedback.status`, `scan_sample.approve|reject`, `post.create|update|delete|publish|unpublish|upload`, `ai.config.update`, `user.ban|unban|role|delete.start|delete`, `team.approve|reject|delete` (xoá đội chỉ ghi khi staff xoá, chủ tự xoá không ghi), `season.open`.

Quy tắc `status`:

- `ok`: thay đổi đã áp dụng đầy đủ (kể cả dispatch deploy thành công nếu có).
- `partial`: đã áp dụng nhưng phần phụ chưa trọn: dispatch deploy lỗi (`meta.deploy = {ok:false, status}`; trong lúc chờ là `meta.deploy: "pending"`, UI hiện "chưa rõ kết quả deploy"), từ chối mẫu soi đội đã xoá ảnh R2 mà D1 lỗi, upload ảnh bài viết R2 xong, D1 lỗi và xoá bù cũng lỗi (`meta.orphan`).
- `failed`: không có thay đổi D1 nào: R2 hay KV lỗi trước khi đổi D1 (từ chối mẫu, `ai.config.update` lỗi KV, `user.delete` lỗi R2), hoặc upload bị huỷ và xoá bù thành công.

Dòng `failed`/`partial` ghi bằng `writeAuditQuietly` để lỗi ghi nhật ký không che lỗi gốc; vì vậy nếu D1 đang hỏng thì dòng này có thể mất (giới hạn như ở phần xoá tài khoản).

### Lần hoạt động cuối

`user.last_seen_at` (epoch ms) cập nhật nền bằng `waitUntil` khi tra phiên của một request thấy giá trị rỗng hoặc cũ hơn 10 phút: tối đa một lần ghi mỗi 10 phút mỗi user. Lỗi ghi chỉ log.

### Triển khai và rollback

Luật cứng: **không push `main` trước khi Worker mới đã chạy.** Pages build lại từ `main` mỗi lần workflow [`pages-deploy.yml`](../.github/workflows/pages-deploy.yml) chạy (dispatch `blog-publish` khi publish/sửa bài, hoặc chạy tay), và client mới cần `role` từ Worker mới (Better Auth cũng kiểm schema lúc chạy, nên Worker mới không được deploy trước migration).

1. Thử `0006` và trigger trên một D1 remote **không phải production**: insert session cho user bị khoá phải lỗi `SQLITE_CONSTRAINT_TRIGGER` (`account_blocked`).
2. Trong `community-worker/`: `npm run db:migrate:remote`; xác nhận `npx wrangler d1 execute tqccl-community --remote --command "pragma table_info(\"user\")"` có `role`, `banned_until`, `deleting_at`, `last_seen_at`.
3. `npx wrangler deploy` (Worker), rồi mới push `main` và deploy Pages. Thứ tự: migration → Worker → Pages.
4. Sau deploy: đăng nhập root, cấp KDV cho tài khoản thử, khoá/mở, rồi `npx wrangler d1 execute tqccl-community --remote --command "select action,status from admin_audit order by created_at desc limit 10"`.

Rollback (phải **cùng lúc và khớp phiên bản** giữa Pages và Worker: client mới đọc `role`, client cũ đọc cờ boolean quản trị cũ trong `/api/me`; Worker mới không gửi cờ đó, Worker cũ không gửi `role`, nên lệch phiên bản làm mất khu quản trị):

1. Chặn việc Pages tự dựng lại bản không tương thích: revert commit trên `main` (hoặc tạm không publish/sửa bài và không chạy workflow) **trước**, vì `pages-deploy.yml` luôn build từ `main` và Worker cũ vẫn dispatch khi publish.
2. `npx wrangler rollback` Worker và rollback deployment Pages về bản trước, cùng một lượt.
3. Cột mới và bảng `admin_audit` để nguyên (Worker cũ bỏ qua; nội dung từng bị ẩn sẽ hiện lại).
4. Trigger không được Worker cũ hiểu: user đang bị khoá sẽ nhận 500 thay vì thông báo khi đăng nhập. Gỡ trigger bằng [`community-worker/rollback/0007_drop_user_block_triggers.sql`](../community-worker/rollback/0007_drop_user_block_triggers.sql) (không nằm trong `migrations/` nên không tự chạy): `npx wrangler d1 execute tqccl-community --remote --file rollback/0007_drop_user_block_triggers.sql`. Hệ quả: sau đó **không còn cưỡng chế khoá và ẩn nội dung** ở bản Worker cũ (user bị khoá đăng nhập lại được, bình luận/chiến báo của họ hiện lại); muốn bật lại phải deploy lại Worker mới và tạo lại trigger bằng phần trigger trong `0006`.


## Đội cộng đồng

Kế hoạch: [`plans/261021-0628-doi-cong-dong/plan.md`](../plans/261021-0628-doi-cong-dong/plan.md). Trang công khai `/doi-cong-dong/` và `/zh/doi-cong-dong/` (`js/community-teams.js`; bốn chế độ đọc từ query: danh sách, chi tiết `?id=`, đăng `?new=1`, của tôi `?mine=1`). Người dùng đăng đội 3 tướng + 6 chiến pháp kèm 1–3 ảnh, KDV/root duyệt, người khác vote, và bình luận/chiến báo của chính trang đội đó dùng lại hệ thống cũ với page key `/doi-cong-dong/<id>/`. Route nằm ở [`src/routes/teams.ts`](../community-worker/src/routes/teams.ts), kiểm tra đầu vào ở [`src/teams-validate.ts`](../community-worker/src/teams-validate.ts), migration [`0008_community_teams.sql`](../community-worker/migrations/0008_community_teams.sql).

### Bảng và trigger

- `community_seasons` (`id` slug 1–40 ký tự, `label_vi`, `label_zh`, `opened_at`, `closed_at`): unique index trên `(closed_at is null)` nên **đúng một** mùa mở (`closed_at is null`) tại một thời điểm.
- `community_teams`: `status` `pending|rejected|approved`, `title`, `hero_1..3` + `hero_key` (3 id đã sắp xếp, nối `,`), `tactics` (JSON `[[t,t],[t,t],[t,t]]` theo thứ tự tướng), `troop` (`cung|khiGioi|ky|thuan|thuong`), `playstyle` và năm trường phân tích tuỳ chọn (`strengths`, `weaknesses`, `counters`, `countered_by`, `substitutes`), `text_lang` (`vi|zh`), `reject_reason`, `reviewed_by/at`, `deleting_at`, `created_at` (mọi thời gian là epoch ms), bộ đếm `up_votes`, `down_votes`, `evidence_count` và ba cột sinh STORED `points`, `hot_rank`, `top_rank` (để phân trang keyset theo index `community_teams_season_{hot,top,new}_idx`).
- `community_team_images` (`team_id`, `position` 0–2, `object_key` unique, `content_type`): chủ duy nhất của khoá R2 ảnh đội sau khi gắn. `community_team_votes` (`team_id`, `user_id`, `value` ±1): một phiếu mỗi user mỗi đội. Cả hai cascade theo đội/user.
- Trigger: ba trigger `community_team_votes_count_{ins,upd,del}` **đếm lại** `up_votes`/`down_votes` từ bảng phiếu (không cộng trừ 1, nên idempotent); ba trigger `battle_reports_team_evidence_{ins,upd,del}` trên bảng cũ `battle_reports` (chỉ chạy khi `page_key like '/doi-cong-dong/%'`) đếm lại `evidence_count`; trigger `community_teams_block_blocked_user` (`before insert`, đồng hồ DB như `0006`) chặn tác giả bị khoá/đang xoá (`account_blocked`) vì bảng này giữ khoá R2.
- `evidence_count` = số user **khác tác giả** có ít nhất một chiến báo `approved` với `result = 'win'` trên trang của đội.

### Công thức điểm và xếp hạng

```text
points   = up_votes - down_votes + 2 * evidence_count
hot_rank = round(sign(points) * log(max(|points|, 1)) * 1_000_000 + created_at / 172.8)
top_rank = points * 10_000_000_000 + created_at / 1000        (chia nguyên: giây)
```

- `created_at` là epoch ms, nên mỗi 172,8 giây tương đương một đơn vị; một bậc `log` (×10 điểm) trị giá 1 000 000 đơn vị = 48 giờ tuổi.
- `log()` của SQLite là **logarit cơ số 10**. Không dùng `log10()`: workerd/D1 cục bộ từ chối hàm đó (`not authorized to use function`).
- Sắp xếp `hot` → `hot_rank desc, id desc`; `top` → `top_rank desc, id desc`; `new` → `created_at desc, id desc`. Cột sinh STORED yêu cầu SQLite ≥ 3.31 (kiểm trước khi migrate remote, xem Triển khai).

### Điều kiện hiển thị

Đội công khai khi `status = 'approved'`, `deleting_at is null` và tác giả không bị khoá/đang xoá (`visibleUserSql`). Đội chưa công khai chỉ chủ đội hoặc staff xem được (404 cho người khác, kể cả ảnh). Đội `deleting_at` khác null ẩn khỏi **mọi** đọc/ghi, kể cả với chủ và staff (ngoại lệ duy nhất: `GET /api/me/community-teams` và `GET /api/admin/community-teams?status=deleting`, để gọi lại thao tác xoá).

Bình luận và chiến báo trên `/doi-cong-dong/<id>/` đi qua `GET/POST /api/comments` và `/api/reports` cũ, `PAGE_KEY_RE` nhận thêm `/doi-cong-dong/<slug ≤ 64>/` và điều kiện hiển thị đội nằm trong chính câu `insert … select … where exists`:

- Đội không hiển thị: danh sách trả rỗng, thống kê trả rỗng, ghi trả 404 `not_found`; ảnh chiến báo của trang đội chỉ công khai khi đội còn hiển thị.
- Bình luận: kho chung vi/zh (bỏ lọc `lang`), **được ghi ở mùa đã đóng**.
- Chiến báo: bỏ lọc `lang` khi đọc; ghi cần mùa của đội còn mở (mùa đóng → 409 `season_closed`), `season` của chiến báo lấy từ đội (bỏ giá trị client), kiểm tra này chạy **trước** rate limit `report`. `POST /api/reports` từ chối ảnh tạm `pending/team-*` (`invalid_upload`).

### API

Đọc công khai: `GET /api/community-seasons` → `{open: {id, labelVi, labelZh, openedAt}|null, seasons: [{id, labelVi, labelZh, openedAt, closedAt}]}`.

- `GET /api/community-teams?sort=hot|new|top&heroes=hero:a,hero:b&season=<id>|all&cursor=` (20/trang, thiếu `sort` = `hot`): `heroes` tối đa 3 id khác nhau, đội phải chứa **mọi** tướng được lọc; thiếu `season` = mùa đang mở (không có mùa mở → `{items: [], nextCursor: null}`), `all` = mọi mùa. Mỗi mục: `id, title, season, heroes, tactics, troop, author:{id,name,image}, upVotes, downVotes, evidenceCount, points, commentCount, imageCount, textLang, createdAt`. `nextCursor` theo khoá xếp hạng + `id`.
- `GET /api/community-teams/:id`: thêm `status, heroKey, analysis:{playstyle, strengths, weaknesses, counters, counteredBy, substitutes}, myVote (-1|0|1), seasonOpen`, và `rejectReason` (chỉ chủ/staff).
- `GET /api/community-teams/:id/images/:pos` (`pos` 0–2): đội công khai trả `Cache-Control: public, no-cache` + `ETag` của R2 (`If-None-Match` khớp → 304, quyền xét trước ETag); đội chưa công khai (chủ/staff) trả `private, no-store`.
- `GET /api/me/community-teams?cursor=` (cần đăng nhập): đội của mình mới nhất trước, thêm `status`, `rejectReason`, `deleting`. Đội xoá dở trả `deleting: true`.

Ghi (cần đăng nhập; mọi `POST/PUT/DELETE` qua kiểm `Origin` như phần còn lại):

- `POST /api/community-teams/uploads` (multipart `image`, JPEG/PNG/WebP ≤ 1 500 000 byte; rate `team_upload`) → `{uploadId}`. Ảnh lưu R2 `pending/team-<uploadId>` + dòng `uploads` (`kind = 'report'`, `pending`); không dùng được cho chiến báo.
- `POST /api/community-teams/uploads/:id/analyze` → `{read}` (nháp AI, xem [AI đọc nháp đội](#ai-đọc-nháp-đội)). Không tìm thấy ảnh của mình → 404 `not_found`.
- `POST /api/community-teams` body `{title 1–80, heroes[3] hero:<slug> khác nhau, tactics[3][2] tactic:<slug> cả 6 khác nhau, troop, playstyle 10–3000, strengths|weaknesses|counters|counteredBy|substitutes (tuỳ chọn, 1–2000, rỗng = null), lang vi|zh, uploadIds[1–3] khác nhau}` → 201 `{id, status: "pending"}`. Thứ tự: kiểm đầu vào → có mùa mở (409 `season_not_open`) → rate `team_post` → kiểm ảnh (409 `image_missing`) → sao chép từng ảnh sang `community-teams/<teamId>/<vị trí>.<ext>` → một batch D1 `insert` đội (điều kiện: đủ upload còn `pending` của đúng user và mùa còn mở) + `community_team_images` + xoá dòng `uploads` → xoá khoá `pending/team-`. Batch không ghi được: xoá bản sao R2, trả 409 `season_not_open` (mùa vừa đóng) hoặc `image_missing`. Lỗi đầu vào: 400 `invalid_body`, `invalid_title`, `invalid_heroes`, `invalid_tactics`, `invalid_troop`, `invalid_text`, `invalid_uploads`. Server chỉ kiểm **định dạng** id tướng/chiến pháp, không đối chiếu với dữ liệu tra cứu.
- `PUT /api/community-teams/:id/vote` `{value: 1|-1|0}` (0 = bỏ phiếu; rate `team_vote`) → `{upVotes, downVotes, points, myVote}`. Chỉ vote đội công khai ở mùa đang mở; vote đội của mình → 403 `own_team`; mùa đóng → 409 `season_closed`; đội không hiển thị → 404 `not_found`; không ghi được vì race → 409 `vote_conflict`; `value` sai → 400 `invalid_vote`. Bỏ phiếu khi chưa vote vẫn thành công.

Admin (staff = root và KDV; 401/403 như các route admin khác):

- `GET /api/admin/community-teams?status=pending|approved|rejected|deleting&cursor=` (mặc định `pending`; sai → 400 `invalid_status`). `deleting` liệt kê mọi đội có `deleting_at` (mọi trạng thái); các lọc khác bỏ đội đang xoá. Mỗi mục như danh sách công khai + `status, rejectReason, deleting` và `author.email` (KDV: che, `emailMasked: true`).
- `POST /api/admin/community-teams/:id/approve` → `{id, status: "approved"}`; `POST .../:id/reject` `{reason 1–500}` → `{id, status: "rejected", rejectReason}`. Chỉ chuyển từ `pending` (nếu không 409 `not_pending`); KDV duyệt được cả đội của chính mình. Audit đứng **trước** câu `update` với cùng điều kiện `pending`, nên chỉ request thật sự chuyển trạng thái mới ghi nhật ký. Đội bị từ chối **không giữ ảnh**: xoá R2 rồi xoá `community_team_images`; lỗi R2 → 502 `delete_incomplete`, gọi lại `reject` để làm tiếp (không ghi nhật ký lần hai, trả lý do đã lưu ở lần đầu).
- `POST /api/admin/community-seasons` (**chỉ root**) `{id, labelVi, labelZh}` → 201 `{id, labelVi, labelZh, openedAt, closedAt: null, previous}` (`previous` = id mùa vừa đóng hoặc `null`).

### Mùa

Mở mùa mới đóng mùa đang mở và tạo mùa mới trong một batch D1 cùng dòng nhật ký `season.open` (`meta.previous`). `id` khớp `^[a-z0-9][a-z0-9-]{0,39}$` và **không được là `all`** (giá trị lọc "mọi mùa" của `GET /api/community-teams`) → 400 `invalid_season`; nhãn `labelVi`/`labelZh` 1–60 ký tự. Trùng id → 409 `season_exists`. Mùa đang mở đổi giữa lúc đọc và ghi (race) → batch rollback, 409 `season_conflict`, tải lại rồi thử lại. Mùa đóng: không đăng đội, không vote, không gửi chiến báo mới trên trang đội; bình luận vẫn được. Chưa có mùa nào mở thì không đăng được đội (409 `season_not_open`) và danh sách mặc định rỗng; trang hiện "Chưa mở mùa".

### AI đọc nháp đội

`POST /api/community-teams/uploads/:id/analyze` gọi `callModel` của [`worker/src/model.ts`](../worker/src/model.ts) (mode `analyzeTeamImage`, cùng prompt/schema với `/soi-doi-tu-anh/`) qua nhóm cấu hình **`teamScan`** của `ai:config` (cần ít nhất một mắt xích vision, xem [Cấu hình AI](#cấu-hình-ai-tab-ai)). Kết quả chỉ là **nháp**: form để người dùng kiểm tra/sửa trước khi gửi; ảnh vẫn được giữ khi AI lỗi để thử lại hoặc tự nhập.

- Điều kiện: `FEATURE_ENABLED=false` → 503 `feature_disabled`; chuỗi `teamScan` rỗng → 503 `ai_not_configured`.
- Rate limit chạy sau khi xác nhận ảnh còn tồn tại: `team_analyze` 20 lần/ngày/user **và** `team_analyze_global` 300 lần/ngày cho cả site (key `site`) để chặn tổng chi phí nhà cung cấp AI. Vượt → 429 `rate_limited` (`Retry-After`). Lượt đã tính vẫn mất dù AI lỗi.
- Model không đọc được (status 422) → 200 `{read: {screen: "other", sides: []}}`; upstream lỗi (502) → 502 `ai_unavailable`; `AiCallError` (lỗi của chuỗi failover) được trả nguyên status và `code`.

### Xoá đội

`DELETE /api/community-teams/:id` cho chủ đội và staff:

- **Chủ đội**: không xoá được khi đã có chiến báo `approved` của người khác trên trang đội → 409 `has_evidence` (nhờ quản trị viên gỡ). Điều kiện nằm trong câu SQL `update`.
- **Staff**: bắt buộc body `{reason}` 1–500 ký tự; root xoá mọi đội, KDV chỉ xoá đội của tác giả không phải KDV/root (ngược lại 404). Ghi nhật ký `team.delete` (`meta.byAuthor`: số bình luận/chiến báo của từng người trên trang đội) trong cùng batch với bước chốt.
- Thứ tự: (1) chốt `deleting_at` bằng một câu `update` có điều kiện quyền; từ đây đội ẩn khỏi mọi đọc/ghi công khai; (2) xoá R2 theo lô 100 khoá: ảnh đội và ảnh các chiến báo trên trang đội; lỗi R2 → **502 `delete_incomplete`**, gọi lại `DELETE` để làm tiếp (bước (1) bỏ qua khi `deleting_at` đã đặt và người gọi vẫn còn quyền); (3) một batch D1 xoá bình luận, dòng `uploads` của ảnh chiến báo, chiến báo trên trang đội rồi đội (cascade ảnh và phiếu); khoá R2 chèn thêm giữa chừng được dọn nốt. Trả `{ok: true}`.
- `GET /api/me/community-teams` trả `deleting: true` cho đội xoá dở của mình và `GET /api/admin/community-teams?status=deleting` liệt kê cho staff để gọi lại.

### Xoá và khoá tài khoản

- **Khoá** (`POST /api/admin/users/:id/ban`): xoá mọi phiếu vote của user (trigger đếm lại điểm đội), số phiếu ghi vào `meta.votesRemoved` của nhật ký `user.ban`, cùng điều kiện với việc huỷ phiên. Đội của user bị ẩn khỏi API công khai cho tới khi hết khoá (phiếu đã xoá không hiện lại).
- **Xoá tài khoản** (root, `DELETE /api/admin/users/:id`): danh sách khoá R2 cần xoá gồm thêm ảnh đội của user **và** ảnh chiến báo của người khác trên các trang đội của user; bước cuối xoá bình luận, `uploads` và chiến báo của người khác trên các trang đó, rồi đội cascade theo FK `author_id` (ảnh, phiếu). Nhật ký `user.delete` có thêm số đội. Lỗi R2 vẫn là 502 `delete_incomplete` như phần [Xoá tài khoản](#xoá-tài-khoản-chỉ-root).

### Triển khai và rollback

Thứ tự bắt buộc: **migration `0008` → deploy Worker → push `main` → chạy tay `pages-deploy.yml`** (`workflow_dispatch`; push `main` không tự deploy Pages: chỉ `blog-publish` và chạy tay mới chạy). Trước khi migrate remote: `npx wrangler d1 execute tqccl-community --remote --command "select sqlite_version()"` phải ≥ 3.31 và ghi bookmark `npx wrangler d1 time-travel info tqccl-community`. Nhóm `teamScan` ở tab AI phải có mắt xích vision (nhóm này cũng phục vụ `/soi-doi-tu-anh/`). Root mở mùa đầu tiên ở `/quan-tri/`; trước đó trang hiện "Chưa mở mùa".

Rollback:

1. Revert commit trên `main` **trước** (để `blog-publish` kế tiếp không dựng lại frontend mới), chạy lại `pages-deploy.yml`, rồi `npx wrangler rollback` Worker.
2. Bảng/cột của `0008` để nguyên (Worker cũ bỏ qua). Ba trigger evidence nằm trên `battle_reports` vô hại với Worker cũ; nếu cần gỡ chạy tay [`rollback/0009_drop_community_team_triggers.sql`](../community-worker/rollback/0009_drop_community_team_triggers.sql) (`npx wrangler d1 execute tqccl-community --remote --file rollback/0009_drop_community_team_triggers.sql`). Khi deploy lại Worker có Đội cộng đồng chạy [`rollback/0010_restore_community_team_triggers.sql`](../community-worker/rollback/0010_restore_community_team_triggers.sql) (dựng lại ba trigger và đếm lại `evidence_count` cho mọi đội). Cả hai file không nằm trong `migrations/` nên không tự chạy; khi đổi trigger trong `0008` phải giữ ba file đồng bộ.
3. **Không xoá tài khoản** trong thời gian chạy Worker cũ trên DB đã có đội: Worker cũ không biết `community_team_images` nên ảnh đội, chiến báo và bình luận trên trang đội bị bỏ sót và không dọn lại được, cho tới khi deploy lại Worker có Đội cộng đồng.
4. Time Travel ghi đè mọi ghi sau bookmark: chỉ dùng khi dữ liệu sai nghiêm trọng.

## Đồng bộ kho và Đội của tôi

Hợp đồng dữ liệu đầy đủ (kind, `data`, trần byte, kết quả từng bản ghi, đóng dấu Lamport, xóa, gộp lần đầu) nằm ở [roster-sync.md](./roster-sync.md); mục này chỉ ghi phần vận hành. Kế hoạch: [`plans/261021-0632-dong-bo-kho-va-doi-cua-toi/plan.md`](../plans/261021-0632-dong-bo-kho-va-doi-cua-toi/plan.md).

- **Bảng**: `roster_records` (migration [`0011_roster.sql`](../community-worker/migrations/0011_roster.sql), chỉ thêm bảng và ba index, không đụng bảng cũ). Khóa chính `(user_id, kind, id)`, `kind` ∈ `box`/`owned`/`season`/`locked`/`override`/`group`/`team`, cột `box_id`, `rev` tăng dần theo user, `deleted`, `payload`. `on delete cascade` theo `user` nên xoá tài khoản dọn luôn kho và đội (cùng chỗ với `recruit_records` ở bước xoá cuối của [Xoá tài khoản](#xoá-tài-khoản-chỉ-root)).
- **Route** (`src/routes/roster.ts`, schema ở `src/roster-schema.ts`, đăng ký trong `src/app.ts`), cần đăng nhập, không phiên hoặc user bị khoá → 401 `unauthorized`:
  - `GET /api/roster?since=<rev>&kinds=box,owned,…` trả `{userId, records, cursor, more}` theo `rev`, 500 bản ghi/trang; `POST` tối đa 200 bản ghi/lô.
  - `POST /api/roster` nhận `{expectedUserId, records}` tối đa 500 mục; trả `{results: [{kind, id, outcome, code?, server?}], cursor}` với `outcome` là `applied`, `already-applied`, `conflict` hoặc `rejected` (từng bản ghi, lỗi một bản ghi không làm hỏng cả batch). Lỗi cấu trúc thân → 400; `expectedUserId` khác user của cookie → 409 `user_mismatch`. Mã `rejected`: `bytes`, `schema`, `clock_skew` (`updatedAt` vượt `now + 5 phút`), `box_missing`, `group_missing`, `box_changed`, `not_found`, `default_protected`, `quota`, `cap`, `retained_cap`.
- **Giới hạn**: 20 000 bản ghi sống mỗi user, 20 hộp mỗi user, 50 nhóm mỗi hộp, 500 đội mỗi user, 40 000 khóa giữ lại (sống + bản xóa); trần `data` theo kind từ 1 KiB đến 16 KiB đếm byte UTF-8 sau escape. Quota và cap kiểm trong cùng câu ghi (`insert … select … where (count) < cap`), không check-rồi-ghi.
- **Rate limit** (bảng `rate_limits`): `roster_push` 600 lô/giờ, `roster_pull` 1 200 lượt kéo/giờ, theo user (`src/ratelimit.ts`).
- **Không dùng Turnstile hay AI**; chỉ cookie phiên và kiểm `Origin` của request ghi như mọi route khác.
- **Test** (`npx vitest run`): `test/roster.test.ts` (33 ca trên D1 giả chạy `node:sqlite` với migration thật: 401, LWW và kết quả từng bản ghi, `already-applied`, `clock_skew`, `user_mismatch`, `box_missing`/`group_missing`/`box_changed`/`default_protected`, xóa hộp/nhóm theo kết quả LWW kể cả bản xóa đến muộn, quota/cap/`retained_cap`, trần byte, `source.key` lạ, phân trang, cô lập user, rate limit, cascade khi xoá tài khoản). Phía client: `tests-js/roster-sync.test.mjs`, `roster-cloud-store`, `roster-picker`, `roster-id-resolve`, `my-teams-*` (`npm run test:node`) và `tests-e2e/my-teams.spec.mjs` (`npm run test:e2e`).
- **Giới hạn của test**: D1 giả và phiên Better Auth dựng sẵn không chứng minh Google OAuth thật hay D1 production; xem phần kiểm sau rollout ở [Deployment guide](./deployment-guide.md#đồng-bộ-kho-và-đội-của-tôi-roster_records).

### Triển khai và rollback

Thứ tự: `cd community-worker && npm run db:migrate:remote` (áp `0011_roster.sql`; nếu `0008` của Đội cộng đồng chưa áp, wrangler áp theo thứ tự tên file) → `npm run deploy` → deploy Pages. Rollback Pages, rollback Worker và vì sao không xoá bảng: xem [Deployment guide](./deployment-guide.md#đồng-bộ-kho-và-đội-của-tôi-roster_records).

## Hành vi cần biết

- Lỗi luôn có dạng `{error:{code,message}}`. `message` viết bằng tiếng Việt cho log, còn UI phải dựa vào `code` để dịch bằng `L()`. Các code gồm `unauthorized` (401), `forbidden`, `forbidden_origin`, `turnstile_required` và `turnstile_failed` (403), `not_found` (404), `rate_limited` (429, kèm `Retry-After`), `invalid_*`, `duplicate_id`, `duplicate_model`, `unknown_provider`, `unknown_model`, `model_not_vision` và `missing_api_key` (400), `invalid_upload`, `image_too_large`, `recruit_quota_exceeded` (413), `unsupported_media_type` và `invalid_image_type` (415), `slug_taken` và `translation_key_taken` (409), `feature_disabled`, `ai_not_configured`, `ai_secret_missing`, `ai_overloaded` và `feedback_unavailable` (503), `ai_unavailable` (502). Mã riêng của Đội cộng đồng (`own_team` 403; `season_not_open`, `season_closed`, `season_exists`, `season_conflict`, `image_missing`, `has_evidence`, `not_pending`, `vote_conflict` 409; `delete_incomplete` 502; `invalid_season`, `invalid_heroes`, `invalid_tactics`, `invalid_troop`, `invalid_uploads`, `invalid_vote`, `invalid_sort`, `invalid_hero`, `invalid_page` 400) nằm ở mục [Đội cộng đồng](#đội-cộng-đồng).
- Mã lỗi của quản trị người dùng: `invalid_target` (400, thao tác với chính mình), `invalid_duration`, `invalid_role`, `invalid_status`, `invalid_q`, `invalid_action`, `invalid_cursor` (400), `confirm_mismatch` (400, email xác nhận xoá không khớp), `user_banned`, `user_deleting`, `not_banned`, `role_unchanged` và `conflict` (409), `delete_incomplete` (502, xoá tài khoản chưa xong, gọi lại để hoàn tất). `forbidden` (403) còn dùng cho KDV vượt quyền và mọi thao tác nhắm root.
- Request `POST`/`PUT`/`DELETE` có `Origin` không nằm trong `SITE_ORIGIN` và danh sách localhost dev sẽ bị chặn với 403 `forbidden_origin`. Body JSON bắt buộc có `Content-Type: application/json`.
- Rate limit lưu trong bảng D1 `rate_limits`: bình luận 10 lần/giờ, analyze 20 lần/ngày, gửi chiến báo 30 lần/ngày, admin upload 100 lần/ngày, đẩy đồng bộ chiêu mộ 600 lô/giờ, đồng bộ kho/Đội của tôi `roster_push` 600 lô/giờ và `roster_pull` 1 200 lượt kéo/giờ (hợp đồng ở [roster-sync.md](./roster-sync.md)), gửi ảnh mẫu soi đội (`scan_sample`) 10 lần/ngày (theo user); Đội cộng đồng: `team_upload` 30 lần/ngày, `team_analyze` 20 lần/ngày (theo user), `team_analyze_global` 300 lần/ngày cho **cả site** (key `site`), `team_post` 5 lần/ngày, `team_vote` 120 lần/giờ (xem [Đội cộng đồng](#đội-cộng-đồng)); góp ý 10 lần/giờ theo user khi đã đăng nhập, 5 lần/giờ theo IP đã băm HMAC khi ẩn danh (IPv6 gom theo /64, đếm trước siteverify); đếm ẩn danh soi đội (`scan_stats`) 60 lần/giờ theo IP đã băm. Better Auth có thêm rate limit riêng cho `/api/auth/*`, lưu trong bảng `rateLimit`.
- `POST /api/feedback` nhận `{kind, title, body, email?, page?, lang, turnstileToken?}`: `kind` là `feature`/`bug`/`wrong_info`/`other`, tiêu đề 1–120 ký tự (gộp khoảng trắng thành một dòng), nội dung 1–4000 ký tự, email tuỳ chọn, `page` là đường dẫn cùng site (bắt đầu bằng `/`). Khách ẩn danh bắt buộc có `turnstileToken`; người đã đăng nhập bỏ qua Turnstile. Trả 201 `{ok:true}` sau khi lưu; thư gửi nền bằng `waitUntil`. `GET /api/me` trả thêm `email` để hộp thoại điền sẵn.
- Góp ý của admin (root và KDV): `GET /api/admin/feedback?status=new|done&kind=&cursor=` (mới nhất trước, 20/trang) và `POST /api/admin/feedback/:id/status` với `{status}` (ghi `feedback.status` vào nhật ký). Với KDV, `email` bị che (`ng***@gmail.com`) và mục có thêm `emailMasked: true` (UI không tạo link `mailto:`); root thấy email đầy đủ. Che email chỉ áp cho trường `email`: `body` (văn bản tự do người gửi nhập) **không** được che hay lọc, nên KDV vẫn đọc được thông tin liên hệ nếu người gửi tự viết vào nội dung.
- **Soi đội: tín hiệu lỗi** (migration `0005_scan.sql`, bảng `scan_stats` và `scan_samples`; khi deploy phải chạy `npx wrangler d1 migrations apply tqccl-community --remote`, hay `db:migrate:remote`, trước `wrangler deploy`).
  - `POST /api/scan-stats` (ẩn danh, không Turnstile) nhận `{screen: battleReport|teamDetail|other, side: left|right, read, edited, unclear}`, mỗi số nguyên 0..12 và `unclear ≤ read`; sai → 400. Cộng dồn vào `scan_stats` theo ngày UTC + screen + side (chỉ số đếm, không ảnh, không tên, không IP). Trả 201 `{ok:true}`. Giới hạn 60 lần/giờ theo IP đã băm HMAC (`IP_HASH_SECRET`); thiếu secret → 503 `scan_stats_unavailable`.
  - `POST /api/scan-samples` (cần đăng nhập, multipart): `image` JPEG/PNG/WebP ≤ 1,5 MB và `payload` là chuỗi JSON `{screen, side, lang, aiRead:{heroes:[HeroRead…]}, confirmed:{heroes:[{hero:"hero:<slug>", tactics:[id|null, id|null], book:id|null} ×3]}}`. ID phải đúng loại (`hero:`/`tactic:`/`book:` + slug); `aiRead` ≤ 6 tướng, chuỗi cắt còn 40 ký tự. Giới hạn 10 mẫu/ngày/user. Lưu ảnh ở R2 `scan-samples/<id>.<ext>` và D1 trạng thái `pending`; trả 201 `{id, status:"pending"}`. Ảnh chỉ được lưu khi người dùng chủ động bấm gửi (có đồng ý).
  - Admin (root và KDV): `GET /api/admin/scan-stats?days=7|30|90` (mặc định 30) → `{days, rows:[{screen, side, events, read, edited, unclear}]}`; `GET /api/admin/scan-samples?status=pending|approved|rejected&cursor=` (20/trang); `GET /api/admin/scan-samples/:id/image` (chỉ staff, `private, no-store`); `POST .../:id/approve` (409 `image_missing` nếu mẫu đã mất ảnh); `POST .../:id/reject` (xoá object R2, `image_key = null`); `GET .../:id/fixture` (chỉ mẫu approved còn ảnh, nếu không 409 `not_approved`/`image_missing`) trả fixture bộ ảnh chuẩn `{image:"<id>.<ext>", source:"scan-sample <id>", expected:{screen, sides:[{side, heroes}]}}`. KDV duyệt/từ chối được cả mẫu của chính mình. Approve/reject đều ghi nhật ký (`scan_sample.approve`, `scan_sample.reject`). Tab **Soi đội** ở `/quan-tri/` dùng các endpoint này; admin tải ảnh, che tên tài khoản rồi đặt cùng fixture vào `worker/eval/images/` và `worker/eval/fixtures/`.
- Đồng bộ "Theo dõi chiêu mộ" (bảng `recruit_records`, migration `0004_recruit.sql`, cần đăng nhập, 401 nếu chưa): `GET /api/recruit?since=<rev>` trả `{records:[{kind, id, updatedAt, data}], cursor, more}` theo thứ tự `rev`, 500 bản ghi/trang; trang rỗng trả `cursor` = rev lớn nhất hiện có. `POST /api/recruit` nhận `{records}` tối đa 500 mục: `kind` là `account`/`banner`/`event`, `id` 1–100 ký tự, `updatedAt` số nguyên ms, `data` là object có `data.id === id`, `Date.parse(data.updatedAt) === updatedAt` và JSON ≤ 4 KB (sai → 400 `invalid_records`). Ghi LWW: chỉ thay khi `updatedAt` mới hơn bản đang lưu; mỗi dòng thực sự được ghi nhận `rev` mới tăng dần theo user (không nhận `rev` từ client). Trả `{accepted, cursor}` (`accepted` = số dòng đã ghi). Trần 20 000 bản ghi mỗi user; thêm bản ghi mới vượt trần → 413 `recruit_quota_exceeded` (sửa bản ghi đã có vẫn được).
- Nếu model không đọc được ảnh, `analyze` vẫn trả 200 với `analysis` rỗng (`result:null`, không có tướng) và vẫn giữ `uploadId` để người dùng tự nhập. Nếu upstream lỗi, endpoint trả 502/503 và xoá ảnh.
- `POST /api/reports` nhận `allyHeroes` từ 1 đến 5 tên, `enemyHeroes` từ 0 đến 5 tên, mỗi tên dài 1 đến 20 ký tự và không trùng nhau; `note` tối đa 500 ký tự, `season` tối đa 40 ký tự. Ảnh được chuyển từ `pending/` sang `reports/`.
- Ảnh chiến báo chưa duyệt trả 404 cho mọi người trừ chủ báo cáo và staff (`Cache-Control: private, no-store`). Ảnh đã duyệt của tác giả còn hoạt động dùng `Cache-Control: public, no-cache` + `ETag` của R2: trình duyệt phải hỏi lại mỗi lần, `If-None-Match` khớp trả 304 (quyền xem được xét trước ETag nên ETag cũ không dò được ảnh đã ẩn). Ảnh của tác giả đang bị khoá/đang xoá trả 404 cho khách, chỉ chủ và staff còn xem được. Media bài viết `/api/media/posts/...` được cache `immutable` 1 năm. Các khoá R2 khác không đọc được qua đường này.
- Ngoài các endpoint trong plan, có thêm `GET /api/admin/comments?cursor=` để trang quản trị xem bình luận mới nhất toàn site (mỗi mục có kèm `page`).
- `GET /api/admin/counts` (staff: root và KDV; khách 401, người thường 403) → `{reportsPending, postsDraft, feedbackNew, feedbackDone, scanPending, teamsPending}`: số chiến báo chờ duyệt, bài nháp, góp ý chưa/đã xử lý, ảnh soi đội chờ duyệt, đội cộng đồng chờ duyệt (`status = 'pending'` và chưa chốt xoá), một truy vấn đếm theo index trạng thái sẵn có (không migration). `/quan-tri/` dùng cho badge điều hướng và dòng tổng ở khu Góp ý, tải lại sau mỗi thao tác đổi trạng thái.
- `PUT /api/admin/posts/:id` chỉ cập nhật các trường được gửi lên và trả `{post, deploy|null}`. `POST /api/admin/posts` trả post (201). `publish` và `unpublish` trả `{post, deploy}`.
- Đổi phiên bản `better-auth` có thể đổi schema. Khi đó sinh lại SQL bằng `getMigrations(...).compileMigrations()` từ `better-auth/db/migration`, dùng một DB `node:sqlite` trống và đúng cấu hình của `src/auth.ts`, rồi thêm file migration mới. Không sửa file migration đã áp dụng.
