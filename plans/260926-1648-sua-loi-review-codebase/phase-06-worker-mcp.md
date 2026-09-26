---
phase: 6
title: "Vision Worker + Research MCP"
status: pending
priority: P2
effort: "2.5d"
dependencies: [5]
---

# Phase 6: Vision Worker + Research MCP

## Goal
Vision Worker không ném lỗi thô khi KV lỗi, luôn trả JSON có CORS, không lộ trạng thái upstream, kiểm kích thước sớm, xác thực hostname siteverify, băm IP bằng HMAC có secret (thiếu secret thì từ chối rõ ràng) và gom IPv6 /64, danh sách tướng cho nhận diện chân dung đủ 202 tướng; ba nút đọc ảnh không dùng chung một token; MCP vẫn nhận token CURRENT khi token NEXT hết hạn và trả mã HTTP đúng quy ước.

## Contract
- ReviewWorkers#1 — `worker/src/ratelimit.ts:14` `kv.put` không bắt lỗi; `worker/src/index.ts:59,77` không bọc `checkLimits`/`commitGlobalUsage`; lỗi → 500 của Cloudflare không có CORS.
- ReviewWorkers#3 — `js/roster-recommend-ui.js:66,122-147` ba nút dùng chung `token`, mỗi nút chỉ tự disable, token bị xoá cả khi nén ảnh lỗi trước khi gửi.
- ReviewWorkers#4 — `worker/src/hero-names.ts:5` 112 tên, `data/heroes-dict.json` 202 bản ghi; lệnh regen ở comment `:4` in tên Phồn thể có khoảng trắng (`SP 呂蒙`), prompt yêu cầu Giản thể.
- ReviewWorkers#5 — `mcp-worker/src/security/bearer-auth.ts:80-87` hết `NEXT_NOT_AFTER` → `invalidConfiguration()` → `worker.ts:259` 503 cho cả token CURRENT. Quyết định Q3 = A: NEXT hết hạn coi như không có.
- ReviewWorkers#9 — `worker/src/guard.ts:22-29,61-68` giải mã rồi mã hoá lại toàn ảnh bằng vòng lặp ký tự.
- ReviewWorkers#10 — `worker/src/index.ts:44` `request.json()` trước mọi kiểm kích thước/giới hạn.
- ReviewWorkers#11 — `worker/src/turnstile.ts:48` chỉ kiểm `success`; lớp KV `seenKey` (`:31-34,52`) thêm 1 đọc + 1 ghi mỗi request mà siteverify đã tự bảo đảm dùng một lần.
- ReviewWorkers#12 — `worker/src/model.ts:101-103` `Model upstream lỗi ${status}` trả nguyên cho client (`index.ts:90-92` chỉ giấu khi 500); `js/analyze.js` không có ánh xạ 502.
- ReviewWorkers#13 — `worker/src/ratelimit.ts:81-86` SHA-256 không muối, cắt 8 byte; bucket theo địa chỉ IPv6 đầy đủ. Quyết định Q6 = A: HMAC-SHA256 với secret `IP_HASH_SECRET`, gom IPv6 /64, thiếu secret → 503 fail-closed có CORS.
- ReviewWorkers#14 — `mcp-worker/src/worker.ts:126` 500 `RESULT_TOO_LARGE`; `mcp-worker/src/security/request-guards.ts:73` 400 `ORIGIN_NOT_ALLOWED` (SDK transport dùng 403).
- ReviewWorkers#15 — `worker/README.md:4,8-,22` sai contract (thiếu `mode`, 4 chế độ) và nhắc GitHub Pages.

## Files to Create / Modify
- Create: `worker/test/index.test.ts`, `worker/test/turnstile.test.ts`, `worker/test/hero-names.test.ts`.
- Modify Worker: `worker/src/index.ts`, `worker/src/ratelimit.ts`, `worker/src/turnstile.ts`, `worker/src/guard.ts`, `worker/src/model.ts`, `worker/src/config.ts` (`Env.IP_HASH_SECRET`), `worker/src/hero-names.ts`, `worker/wrangler.toml` (comment liệt kê secret bắt buộc, `:1-2`), `worker/README.md`.
- Modify tests Worker: `worker/test/{ratelimit,guard,model}.test.ts`.
- Modify site: `js/analyze.js` (ánh xạ lỗi 502/503, bỏ ánh xạ "Token xác thực đã dùng" nếu hết nguồn phát), `js/roster-recommend-ui.js`; tests `tests-js/analyze-errors.test.mjs`, `tests-e2e/beta-tools.spec.mjs`.
- Modify MCP: `mcp-worker/src/security/bearer-auth.ts`, `mcp-worker/src/security/request-guards.ts`, `mcp-worker/src/worker.ts`; tests `mcp-worker/test/security/{bearer-auth,request-guards}.test.ts`, `mcp-worker/test/transport/worker.integration.test.ts`.
- Modify gate: policy (`js/analyze.js`, `js/roster-recommend-ui.js` bị ghim), `pipeline/site_localization.py` (tuple chữ lỗi mới), generation mới, `data/website-display.json`, `pipeline/team-route-handles.json`.
- Modify docs: `docs/code-standards.md` (`:95,99`), `docs/system-architecture.md` (luồng Worker), `docs/deployment-guide.md` (bước `wrangler secret put IP_HASH_SECRET` trước `wrangler deploy`, cạnh `QWEN_API_KEY`/`TURNSTILE_SECRET`), `docs/mcp-research-server.md` (§Rotation `:208`, bảng mã lỗi), `docs/project-changelog.md`.

## Tasks & Steps

### Vision Worker
- [ ] **KV lỗi (ReviewWorkers#1).** *Test trước:* `worker/test/index.test.ts` gọi `default.fetch(request, env)` với KV giả ném `KV PUT failed: 429` ở lần ghi `d:` thứ hai, `fetch` toàn cục giả cho siteverify và model (`vi.stubGlobal`): request 2 vẫn trả JSON có `Access-Control-Allow-Origin`; mọi exception bất ngờ khác (model ném lỗi thường) → JSON 500 có CORS. Đỏ: request 2 ném khỏi handler. *Sửa:* `incr` bắt lỗi ghi (best-effort, đúng `docs/code-standards.md:100`), lỗi đọc KV trong `checkLimits` coi như 0; bọc toàn handler một `try/catch` trả `json({error: "Lỗi xử lý, thử lại sau"}, 500, cors)`.
- [ ] **Content-Length sớm (ReviewWorkers#10).** *Test trước:* request `Content-Length` > `ceil(maxImageBytes*4/3) + 4096` → 413 có CORS, KV không bị ghi, không gọi siteverify. Đỏ: body bị đọc, KV per-IP bị ghi. *Sửa:* kiểm header trước `request.json()` (`index.ts:44`); body thiếu header vẫn qua guard ảnh như cũ.
- [ ] **Guard ảnh (ReviewWorkers#9).** Tối ưu không đổi output → *test bảo toàn* trong `worker/test/guard.test.ts` (phải xanh trước và sau): kích thước giải mã đúng `maxBytes` qua, `maxBytes + 1` bị 413, với 0/1/2 ký tự `=`; ký tự base64 sai ở giữa chuỗi → 400; magic bytes PNG/JPEG/WebP; `dataUri` = `data:<mime>;base64,<phần base64 của input>`. *Sửa:* kiểm ký tự bằng một regex, ước lượng kích thước từ độ dài và padding, chỉ giải mã ~16 byte đầu cho magic bytes, dựng `dataUri` từ chuỗi đã kiểm (bỏ `toBase64`). *Đo* bằng script tạm (ảnh 1,4 MB): thời gian `validateImage` trước/sau, ghi báo cáo, xoá script.
- [ ] **siteverify + bỏ lớp replay KV (ReviewWorkers#11).** *Test trước:* `worker/test/turnstile.test.ts`: siteverify `success: true, hostname: "evil.example"` → bị từ chối; `hostname` = host của `ALLOWED_ORIGIN` → qua; `verifyTurnstile` không gọi `kv.get`/`kv.put`; siteverify `success: false, error-codes: ["timeout-or-duplicate"]` → "Xác thực chống bot thất bại". Đỏ: hostname lạ vẫn qua, KV bị đọc/ghi. *Sửa:* kiểm `data.hostname`; xoá `seenKey` (siteverify là nguồn dùng-một-lần; giảm 1/4 số ghi KV mỗi lượt, hỗ trợ finding #1); sửa `docs/code-standards.md:95` ("Turnstile/replay" → "Turnstile (siteverify một lần)"). Nếu chuỗi "Token xác thực đã dùng" không còn nơi phát → bỏ mục ánh xạ trong `js/analyze.js` (G0: không phải tuple binding).
- [ ] **Lỗi upstream (ReviewWorkers#12).** *Test trước:* `worker/test/model.test.ts` — upstream 401/403/5xx → lỗi mang thông điệp cố định "Dịch vụ AI tạm lỗi, thử lại sau" (không chứa mã số), upstream 429 → "Dịch vụ AI đang quá tải, thử lại sau"; `index.test.ts` response không chứa `upstream`/mã số. `tests-js/analyze-errors.test.mjs` — `localizeWorkerError("Dịch vụ AI đang quá tải, thử lại sau", 503)` và `(…, 502)` trả câu tiếng Việt riêng, không phải "Không thể phân tích ảnh. Vui lòng thử lại.". Đỏ: lộ "Model upstream lỗi 401", UI trả câu chung. *Sửa:* `model.ts` ném lỗi `status` 502/503 + thông điệp cố định; `index.ts` trả nguyên thông điệp cố định; `analyze.js` thêm mục `UPSTREAM_ERRORS`/`STATUS_ERRORS[502|503]`, giữ **nguyên văn** binding `localizeWorkerError(data?.error, res.status)`; chữ mới → tuple `authored-vi` (G1).
- [ ] **Băm IP (ReviewWorkers#13) — Q6 = A.** *Test trước:* `worker/test/ratelimit.test.ts`: `hashIp(ip, secret)` khác nhau với hai secret khác nhau; `2001:db8:1:2::1` và `2001:db8:1:2:ffff::9` cùng giá trị; `2001:db8:1:3::1` khác; IPv4 theo từng địa chỉ; kết quả không bằng SHA-256 trần của IP. `worker/test/index.test.ts`: `env` không có `IP_HASH_SECRET` (hoặc chuỗi rỗng) → response 503, body JSON `{error: "Dịch vụ soi ảnh chưa được cấu hình"}`, có `Access-Control-Allow-Origin`; KV giả ghi nhận 0 lần `get`/`put`; `fetch` toàn cục (siteverify, model) không được gọi. Có secret → luồng thường chạy. Đỏ: `hashIp` không nhận secret, bucket theo /128; thiếu secret vẫn xử lý bình thường. *Sửa:* HMAC-SHA256 qua `crypto.subtle.importKey`/`sign`, chuẩn hoá IPv6 về /64 (4 nhóm đầu, xử lý `::`) trước khi ký; `Env.IP_HASH_SECRET` (`config.ts:4-7`); `index.ts` kiểm secret ngay sau kiểm route/Origin (`:33-40`), trước khi đọc body và trước mọi thao tác KV — Worker hiện không có kiểm "thiếu khoá" nào, đây là kiểm đầu tiên. `js/analyze.js`: thêm ánh xạ thông điệp 503 này sang câu tiếng Việt cho người dùng (tuple `authored-vi`, G1; giữ nguyên văn binding `localizeWorkerError(data?.error, res.status)`). Docs: `docs/deployment-guide.md` thêm `wrangler secret put IP_HASH_SECRET` (giá trị ngẫu nhiên ≥ 32 byte, ví dụ `openssl rand -base64 48`) vào bước secret trước deploy và ghi hệ quả thiếu secret; `docs/code-standards.md:99` "IP chỉ lưu dạng HMAC có khoá, IPv6 gom /64"; bộ đếm per-IP cũ (TTL 2 giờ) tự hết hạn, không cần migrate.
- [ ] **Danh sách tướng (ReviewWorkers#4).** *Test trước:* `worker/test/hero-names.test.ts` đọc `../../data/heroes-dict.json`, tính tập tên theo quy tắc: alias không khoảng trắng khác `chinese` (bản Giản thể), không có thì `chinese` bỏ khoảng trắng → bằng đúng tập `HERO_NAMES_CN`. Đỏ: 112 so với 202. *Sửa:* sinh lại `worker/src/hero-names.ts` bằng lệnh mới (ghi ở comment `:1-4`, dùng đúng quy tắc của test). Test này là drift check chạy trong CI (`check-repository.ts` bước `vision-worker-tests`).
- [ ] **README (ReviewWorkers#15).** `worker/README.md`: request `{image, turnstileToken, mode}`, 4 chế độ (`analyzeTeamImage`, `scanHeroes`, `scanTactics`, `scanBuiltTeams`, theo `schema.ts:19-20`) và shape response từng chế độ; Cloudflare Pages `https://tqccl.pages.dev` thay GitHub Pages (`wrangler.toml:13-15`); danh sách secret gồm `QWEN_API_KEY`, `TURNSTILE_SECRET`, `IP_HASH_SECRET` và hành vi 503 khi thiếu `IP_HASH_SECRET`.

### Site
- [ ] **Token Turnstile dùng chung (ReviewWorkers#3).** *Test trước:* `tests-e2e/beta-tools.spec.mjs` (stub `:21-28`, Worker giữ response): chọn file ở hai thẻ → bấm "Đọc Tướng" rồi ngay "Đọc Chiến pháp" → Worker nhận đúng 1 request; thẻ thứ hai báo "Xác thực Turnstile trước." hoặc nút bị khoá; khi nén ảnh lỗi (file hỏng) widget không bị reset. Đỏ: 2 request cùng token. *Sửa:* lấy token nguyên tử (`const t = token; token = ""`) trước `await`; khoá cả ba nút khi đang đọc; chỉ reset widget khi request đã gửi.

### Research MCP
- [ ] **Bearer hết hạn (ReviewWorkers#5) — Q3 = A.** *Test trước:* `bearer-auth.test.ts`: cấu hình CURRENT + NEXT, `NEXT_NOT_AFTER` đã qua → `validateBearerConfiguration` trả cấu hình chỉ có CURRENT; token CURRENT xác thực được, token NEXT bị từ chối như token lạ (401); cấu hình sai khác vẫn ném `AUTH_CONFIG_INVALID` (thiếu CURRENT, NEXT không kèm NOT_AFTER hoặc ngược lại, NOT_AFTER không parse được, NOT_AFTER xa hơn `MAX_OVERLAP_MS`). `worker.integration.test.ts`: cùng cấu hình đó, 11 phút sau NOT_AFTER, token CURRENT → 200, token NEXT → 401, cấu hình thiếu CURRENT → 503 `SERVICE_MISCONFIGURED`. Đỏ: token CURRENT nhận 503. *Sửa:* `bearer-auth.ts:80-87` tách điều kiện `nextTokenNotAfterMs <= nowMs` ra khỏi nhóm lỗi cấu hình: hết hạn → `return { currentToken }`; giữ lỗi cho NaN và quá `MAX_OVERLAP_MS`. `docs/mcp-research-server.md` §Rotation: sau NOT_AFTER token NEXT tự hết hiệu lực, dịch vụ vẫn chạy bằng CURRENT; vận hành vẫn phải xoá biến NEXT khỏi môi trường.
- [ ] **Mã HTTP (ReviewWorkers#14).** *Test trước:* `request-guards.test.ts` Origin lạ → 403; `worker.integration.test.ts` kết quả vượt `maxResultBytes` → 413 `{error:{code:"RESULT_TOO_LARGE"}}`. Đỏ: 400 và 500. *Sửa:* `request-guards.ts:73`, `worker.ts:126`; bảng mã lỗi trong `docs/mcp-research-server.md`.

### Kết phase
- [ ] G0–G5, G7 cho `js/analyze.js`, `js/roster-recommend-ui.js`; file MCP sửa ở phase này không thuộc `semanticFiles` (chỉ `src/security`, `src/worker.ts`) nên không cần G8 — kiểm bằng `npm --prefix mcp-worker run check:workflow-build`. `policyVersion` `site-vi-2609xx-worker`; changelog; `reports/phase-06.md`.

## Verification
- `(cd worker && npm test && npm run typecheck)` → pass (mỗi test mới đã thấy đỏ trước sửa).
- `(cd mcp-worker && npm run check)` → pass.
- `node --experimental-strip-types --test tests-js/analyze-errors.test.mjs` và `npx playwright test tests-e2e/beta-tools.spec.mjs` → pass.
- `python3 -m pipeline.site_localization check --root . --stage public` → exit 0; gate A2 exit 0.
