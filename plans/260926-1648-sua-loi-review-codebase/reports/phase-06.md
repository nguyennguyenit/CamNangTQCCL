# Phase 6 — Vision Worker + Research MCP (2026-09-27)

Finding: ReviewWorkers#1, #3, #4, #5, #9, #10, #11, #12, #13, #14, #15. Quyết định Q3 = A, Q6 = A. Một commit.

## Vision Worker

Test đỏ chạy bằng `(cd worker && npx vitest run)` trên code HEAD `fa8e9a2` với test mới; sau sửa 9 file, 85/85 xanh (trước phase: 6 file, 53 test).

| Finding | Test đỏ (trích) | Sửa |
|---|---|---|
| #1 KV lỗi | `index.test.ts` "lỗi ghi bộ đếm ngày vẫn trả kết quả JSON có CORS": `KV PUT failed: 429` ném khỏi handler; "lỗi đọc bộ đếm coi như 0 lượt": `KV GET failed: 429` ném khỏi handler | `ratelimit.ts`: `read` bắt lỗi → 0, `incr` bắt lỗi ghi (best-effort); `index.ts` tách `handle()`, `fetch` bọc `try/catch` → `json({error: "Lỗi xử lý, thử lại sau"}, 500, cors)`. Ca "lỗi bất ngờ khi gọi model → JSON 500" là test bảo vệ (đã xanh trước vì `callModel` nằm trong `try` cũ). |
| #10 Content-Length | "Content-Length vượt ngưỡng → 413…": `expected 200 to be 413` | kiểm `Content-Length > ceil(maxImageBytes·4/3) + 4096` trước `request.json()`; ca đúng ngưỡng vẫn 200. |
| #9 guard ảnh | không có đỏ tự nhiên (tối ưu). Test bảo toàn mới trong `guard.test.ts` (biên `maxBytes`/`maxBytes+1` với 0/1/2 `=`, ký tự `*`/`=`/`-` ở giữa → 400, magic PNG/JPEG/WebP, `dataUri` = `data:<mime>;base64,<phần base64 input>` kể cả khi tiền tố data URI khai MIME khác) xanh trước (12/12) và sau. | regex `^[A-Za-z0-9+/]*={0,2}$` + độ dài chia hết 4, kích thước = `len/4·3 − padding`, chỉ giải mã 16 ký tự đầu (12 byte) cho magic bytes, `dataUri` từ chuỗi đã kiểm; bỏ `decodeBase64`/`toBase64`. Base64 không chuẩn (thiếu padding, khoảng trắng bên trong) trước được `atob` nhận, nay 400 — `canvas.toDataURL` không tạo dạng đó. |
| #11 siteverify | `turnstile.test.ts` hostname lạ vẫn `ok: true`; `index.test.ts` "siteverify trả hostname lạ → 403": `expected 200 to be 403`; "một lượt thành công chỉ đọc/ghi bộ đếm": thừa 2 thao tác `ts:` | `verifyTurnstile(token, secret, ip, expectedHostname)` kiểm `data.hostname` (bỏ qua khi `ALLOWED_ORIGIN = *`), xoá `tokenKey`/`seenKey` và tham số KV. "Token xác thực đã dùng" hết nguồn phát → bỏ mục ánh xạ ở `js/analyze.js` (không phải tuple). |
| #12 upstream | `model.test.ts`: `expected Error: Model upstream lỗi 401 … to match object { status: 502 …}` (401/403/500/503/429); `index.test.ts`: `expected { error: 'Model upstream lỗi 401' } to deeply equal …`, 429: `expected 502 to be 503` | `model.ts`: 429 → 503 "Dịch vụ AI đang quá tải, thử lại sau", còn lại → 502 "Dịch vụ AI tạm lỗi, thử lại sau"; `index.ts` trả nguyên thông điệp cố định của lỗi có `status`, lỗi khác rơi xuống 500 chung. |
| #13 băm IP | `ratelimit.test.ts`: secret khác vẫn `'fec52565aa0cf18f'` như nhau; `/64`: `expected 'd1803fda1caff316' to be 'e5f9d2d93340cf0e'`; `index.test.ts` thiếu secret (`undefined` và `""`): `expected 200 to be 503` | `hashIp(ip, secret)` HMAC-SHA256 (`importKey`/`sign`), hex 16 byte; `ipBucket` mở rộng `::`, bỏ zone `%…`, IPv4 nhúng, lấy 4 nhóm đầu → `x:x:x:x::/64`. `index.ts` kiểm `IP_HASH_SECRET` ngay sau route/Origin (trước Content-Length, body, KV). `Env.IP_HASH_SECRET`, `wrangler.toml` comment, `.dev.vars.example`. |
| #4 danh sách tướng | `hero-names.test.ts`: `expected Set{ 'SP吕蒙', … (109) } to deeply equal Set{ … (199) }` (112 so với 202) | sinh lại `worker/src/hero-names.ts` (202 tên Giản thể, sắp xếp) bằng lệnh ghi ở comment, cùng quy tắc với test. Tập cũ là tập con của tập mới. |
| #15 README | docs | `worker/README.md`: request `{image, turnstileToken, mode}`, 4 chế độ và shape response, bảng mã lỗi, Pages `https://tqccl.pages.dev`, ba secret và 503 khi thiếu `IP_HASH_SECRET`. |

Đo guard (script tạm `/tmp/guard-bench.mts`, `validateImage` với data URI JPEG 1,4 MB, 30 lượt sau 5 lượt khởi động, Node 24): trung vị **12,38 ms → 1,69 ms** (p90 12,75 → 1,90 ms). Script đã xoá.

## Site

**Lỗi upstream / chưa cấu hình (#12, #13).** `tests-js/analyze-errors.test.mjs` "Worker AI and configuration failures get their own Vietnamese sentences" đỏ: `actual: 'Không thể phân tích ảnh. Vui lòng thử lại.'` cho `("Dịch vụ AI tạm lỗi, thử lại sau", 502)`. Sửa: `STATUS_ERRORS[502]` và 3 mục `UPSTREAM_ERRORS` (tạm lỗi, quá tải, chưa cấu hình); binding `localizeWorkerError(data?.error, res.status)` giữ nguyên văn. Sau sửa 5/5.

**Token Turnstile dùng chung (#3).** `tests-e2e/beta-tools.spec.mjs` "ba nút đọc ảnh không dùng chung một token…" chạy trên dist dựng từ `roster-recommend-ui.js` cũ:
- phần nén ảnh lỗi: `expect(await resets()).toBe(0)` → `Received: 1` (widget bị reset, token bị bỏ dù chưa gửi gì);
- phần đọc đồng thời (chạy riêng): `expect(locator).toBeDisabled() failed … Received: enabled` cho "Đọc Chiến pháp".

Sửa: kiểm token trước, khoá cả ba nút (`setScanBusy`) ngay khi bấm, sau nén ảnh lấy và xoá token trong cùng một bước (`const scanToken = token; token = ""`), chỉ reset widget khi request đã gửi. Sau sửa `beta-tools.spec.mjs` 24/24.

## Research MCP

| Finding | Test đỏ (trích) | Sửa |
|---|---|---|
| #5 NEXT hết hạn (Q3 = A) | `bearer-auth.test.ts` "NEXT quá NOT_AFTER bị coi như không có…": `BearerAuthError: Cấu hình xác thực không hợp lệ.`; `worker.integration.test.ts` "NEXT quá NOT_AFTER: CURRENT vẫn 200…" (NOT_AFTER 11 phút trước `now`): `expected 503 to be 200` | `validateBearerConfiguration`: NaN hoặc quá `MAX_OVERLAP_MS` vẫn `AUTH_CONFIG_INVALID`; `NOT_AFTER <= now` → `{ currentToken }`. Ca `NOW - 1` chuyển khỏi danh sách cấu hình sai; thêm ca sai khác (NOT_AFTER không kèm NEXT, thiếu CURRENT, ngày không parse được). Thiếu CURRENT vẫn 503 `SERVICE_MISCONFIGURED`. |
| #14 mã HTTP | `request-guards.test.ts`: `expected RequestGuardError … to match object { status: 403 … }`; `worker.integration.test.ts` "chặn response vượt giới hạn cấu hình": `expected 500 to be 413` | `ORIGIN_NOT_ALLOWED` 400 → 403 (thêm 403 vào kiểu `status`), `RESULT_TOO_LARGE` 500 → 413. |

Docs: `docs/mcp-research-server.md` thêm bảng mã lỗi HTTP (§HTTP và trust boundary) và câu về NEXT hết hạn ở §Rotation. `npm --prefix mcp-worker run check:workflow-build` pass: `src/security/*` và `src/worker.ts` không thuộc `semanticFiles`, `WORKFLOW_BUILD_ID` không đổi (không cần G8).

## G0–G8

- **G0:** `js/analyze.js` 29 tuple (4 `translate`: `ui:analyze/provider-error` binding `localizeWorkerError(data?.error, res.status)`, `ui:analyze/exception` binding `describeAnalyzeError(e, ANALYZE_ACTION_ERROR)`, `ui:analyze/similar-team`, `ui:analyze/no-similar-team`) — giữ nguyên. `js/roster-recommend-ui.js` 49 tuple (10 `translate`, 2 binding `describeAnalyzeError(err, ROSTER_PROVIDER_ERROR)`, `ROSTER_STATUS_LABELS[entry.status]`) — giữ nguyên; `ui:roster/scan-token-first` ("Xác thực Turnstile trước.") vẫn có mặt. `worker/src/schema.ts` (ghim, 1 tuple `translate`) không sửa; các file `worker/src` khác không bị ghim.
- **G1:** thêm 3 tuple `authored-vi`, owner `js/analyze.js::localizeWorkerError`: `ui:analyze/ai-service-error` "Dịch vụ AI đang gặp sự cố. Thử lại sau ít phút.", `ui:analyze/ai-overloaded` "Dịch vụ AI đang quá tải. Đợi vài phút rồi thử lại.", `ui:analyze/worker-unconfigured` "Dịch vụ soi ảnh chưa sẵn sàng. Thử lại sau.". Không thêm/đổi/bỏ tuple `translate`.
- **G2/G3:** stale đúng 2 file; `unknownLocationDetails` chỉ 2 mục `full-site-inventory`. `sourceFiles`: `js/analyze.js` `674c2d1b…` → `d2bc2d86…`, `js/roster-recommend-ui.js` `af3825a7…` → `cd4b32e4…`. `baseline.notes`: `concreteLocationCount` 56669 → 56672 (+3 tuple), `concreteInventorySha256` `abc4f153…` → `71ac9352…`; 2086 site obligation, 5589 obligation, 66 `translate` UI không đổi. `policyVersion` `site-vi-260927-hieu-nang` → `site-vi-260927-worker`. Chạy lại G2: rỗng cả hai.
- **G4:** build/check/publish/`check --stage public` đều exit 0. Generation mới `0cb3ba928835600e3052003a18116ec23ece2660cb1a8d279052c9f7b84c5c0c`.
- **G5:** `pipeline/team-route-handles.json` `generationId` `eeaa9c42…` → `0cb3ba92…`; `--check` pass.
- **G6:** `git rm` generation `eeaa9c42…` (Phase 5 tạo).
- **G7:** số ghim không đổi; `tests.test_site_localization tests.test_team_route_handles tests.test_build_recommended_reference` 80 OK.
- **G8:** không cần (xem trên).

## Docs

`docs/code-standards.md` (§Worker TypeScript: thứ tự guard, JSON có CORS, upstream, HMAC/IPv6 /64, KV best-effort), `docs/system-architecture.md` (luồng Worker 9 bước), `docs/deployment-guide.md` (`wrangler secret put IP_HASH_SECRET` cạnh hai secret cũ, hệ quả thiếu secret, hostname Turnstile khớp `ALLOWED_ORIGIN`), `docs/mcp-research-server.md`, `worker/README.md`, `docs/project-changelog.md`. Không đặt secret thật, không deploy.

## Test khác

`tests-e2e/recommended-browser.spec.mjs` "gameplay config keeps precedence over old reference selectors" đỏ ngẫu nhiên ở lần gate A2 đầu và 1/4 lượt chạy lặp cả file: `Expected: "/cung-ton/"`, `Received: "/cung-ton/?scenario=anh-hung-menh-the"`. Nguyên nhân: boot Cùng Tồn ghi kịch bản đầu tiên vào URL bằng `replaceState` (`js/app.js:207-214`), assertion chỉ xanh khi kịp so trước lượt ghi đó; phase này không đụng đường này. Sửa test: so `/cung-ton/?scenario=<id>` (vẫn kiểm không mang `detail=`). 8/8 lượt xanh.

## Gate A2

Exit 0, ~164 s (lần chạy trước đó đỏ vì test e2e ngẫu nhiên ở trên và một lần vì cổng 4174 bị preview server mồ côi của lượt bị huỷ chiếm).

| Bộ | Kết quả |
|---|---|
| `npm run verify` | `Verified 1725 dist files (52 raw assets, 16 static public files)` |
| `npm run test:dist` | 29/29 |
| `npm run test:node` | 347/347 |
| `npm run test:e2e` | 320 passed |
| `python3 -m unittest discover -s tests` | 377 OK |
| `team_route_handles --check` | pass (generation `0cb3ba92…`) |
| `worker` vitest | 9 file, 85 test; `typecheck` ok |
| `mcp-worker` check | 43 file, 338 test; `check:workflow-build` pass, control plane artifact hợp lệ |
