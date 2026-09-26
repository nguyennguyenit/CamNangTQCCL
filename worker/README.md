# TQCCL Vision Proxy (Cloudflare Worker)

Proxy giữ API key Qwen + guardrail cho các công cụ đọc ảnh (**Soi đội từ ảnh**,
**Gợi ý đội từ kho**). Hạ tầng **tách biệt** site tĩnh: site chạy trên Cloudflare
Pages `https://tqccl.pages.dev` (`wrangler.toml` `ALLOWED_ORIGIN`), Worker deploy
riêng bằng `wrangler`. Site gọi `POST /analyze`.

## Kiến trúc

```
Site (Pages) ──POST /analyze {image, turnstileToken, mode}──► Worker
   Worker: OPTIONS → origin → IP_HASH_SECRET → Content-Length → cap/kill-switch/rate-limit
           → Turnstile (siteverify: một lần dùng + đúng hostname) → input guard → Qwen → validate → JSON
```

Request JSON:

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `image` | string | Base64 chuẩn hoặc data URI `data:image/...;base64,...` (PNG/JPEG/WebP, ≤ `MAX_IMAGE_BYTES` sau giải mã) |
| `turnstileToken` | string | Token Turnstile, dùng một lần |
| `mode` | string (tuỳ chọn) | Một trong 4 chế độ dưới đây; thiếu/rỗng = `analyzeTeamImage` |

Response 200 theo `mode` (chữ Hán Giản thể; site map sang tiếng Việt qua từ điển):

| `mode` | Công cụ | Response |
|---|---|---|
| `analyzeTeamImage` | Soi đội từ ảnh | `{ heroes: [{ nameCn, tacticsCn[], booksCn[], statFocusCn, nameFromPortrait? }] }` |
| `scanHeroes` | Gợi ý đội: đọc kho tướng | `{ heroes: [{ nameCn, level?, redStars? }] }` |
| `scanTactics` | Gợi ý đội: đọc kho chiến pháp | `{ tactics: [{ nameCn }] }` |
| `scanBuiltTeams` | Gợi ý đội: đọc đội đã build | `{ teams: [{ teamName, heroesCn[], tacticsCn[] }] }` |

Lỗi luôn là JSON `{ error: "<thông điệp cố định>" }` kèm header CORS: 400 (body/mode/base64/ảnh hỏng),
403 (origin, Turnstile), 404, 413 (ảnh hoặc `Content-Length` quá lớn), 415, 422 (model không đọc được),
429 (hết lượt ngày, quá nhiều lần/giờ), 502 (`Dịch vụ AI tạm lỗi, thử lại sau`),
503 (`Dịch vụ AI đang quá tải, thử lại sau`, kill-switch/cap tháng, `Dịch vụ soi ảnh chưa được cấu hình`),
500 (lỗi bất ngờ, `Lỗi xử lý, thử lại sau`). Không trả mã hay nội dung từ upstream.

KHÔNG lưu ảnh. Log tối thiểu (đếm, không nội dung). IP chỉ lưu dạng HMAC có khoá
(`IP_HASH_SECRET`), IPv6 gom theo /64. Bộ đếm KV là best-effort: KV lỗi đọc coi như
0, lỗi ghi bị bỏ qua.

## Setup deploy

1. **Cloudflare account** + cài wrangler: `npm i -g wrangler` rồi `wrangler login`.
2. **KV namespace**: `wrangler kv namespace create RL` → dán `id` vào `wrangler.toml` (`[[kv_namespaces]] id`).
3. **Turnstile** (Cloudflare dashboard → Turnstile): tạo site với hostname của site Pages → lấy **site-key** (public, để vào `js/config.js`) + **secret**.
4. **Qwen key**: tạo trên Alibaba Model Studio / DashScope → API key.
5. **Vars**: `wrangler.toml` → `ALLOWED_ORIGIN` = origin site thật (`https://tqccl.pages.dev`); hostname của origin này cũng là hostname Turnstile phải khớp. Chốt `REGION`/`MODEL_ID` (xem §Region).
6. **Secrets** (KHÔNG commit), cả ba bắt buộc:
   ```bash
   wrangler secret put QWEN_API_KEY
   wrangler secret put TURNSTILE_SECRET
   openssl rand -base64 48 | wrangler secret put IP_HASH_SECRET
   ```
   Thiếu hoặc rỗng `IP_HASH_SECRET` → mọi `POST /analyze` trả **503** `Dịch vụ soi ảnh chưa được cấu hình`
   (không đọc/ghi KV, không gọi Turnstile hay model). Đổi secret làm bộ đếm per-IP bắt đầu lại (TTL 2 giờ).
7. **Deploy**: `npm install && npm run deploy`. Dev: copy `.dev.vars.example`→`.dev.vars`, `npm run dev`.

## Test

```bash
npm install
npm test          # vitest: handler, schema (M1), guard (H4), rate-limit/cap (H5), Turnstile, danh sách tướng
npm run typecheck
```

## Cấu hình guardrail (`wrangler.toml [vars]`)

| Var | Mặc định | Ý nghĩa |
|---|---|---|
| `RL_PER_HOUR` | 10 | Lượt/IP/giờ |
| `DAILY_CAP` | 500 | Lượt/ngày (reset UTC) |
| `MONTHLY_CAP` | 8000 | Lượt/tháng → chạm là **auto kill-switch** (H5) |
| `MAX_IMAGE_BYTES` | 1500000 | ≤1.5MB sau giải mã (H4) |
| `FEATURE_ENABLED` | true | Đặt `false` để tắt feature ngay |

> **Số liệu cap là placeholder** — chốt theo free tier thực (L2).

## ⚠️ Gate C2 — ToS Alibaba (ĐIỀU KIỆN SHIP, không phải nice-to-have)

Đọc kỹ trước khi public (chi tiết: `plans/reports/from-researcher-to-controller-dashscope-tos-vision-model-260622-2251-report.md`):

- ✅ **Không train trên input**: DashScope cam kết KHÔNG dùng input để train (cả CN lẫn Singapore), mặc định, không cần opt-out.
- ⚠️ **Ảnh game bản quyền**: KHÔNG có policy cấm rõ, nhưng chưa xác nhận chắc → **bắt buộc test 5–10 screenshot thật trước khi ship**; nếu bị khóa key → đổi provider (Gemini/GPT) qua `callModel()` (chỉ đổi `MODEL_ENDPOINT`/`MODEL_ID` + key).
- ⚠️ **Data retention**: không công bố rõ thời hạn → coi là tạm thời, ghi disclaimer.
- ✅ **Đăng ký từ VN**: được (email + SMS + passport).

### Region: hỗ trợ CẢ HAI — đổi bằng 1 biến `REGION`
| | Singapore (`REGION=intl`, **mặc định**) | CN mainland (`REGION=cn`) |
|---|---|---|
| Endpoint | `dashscope-intl.aliyuncs.com/...` | `dashscope.aliyuncs.com/...` |
| Free tier 1M token/90 ngày | ✅ **có** | ❌ không |
| Data residency | Singapore (luật quốc tế) | Bắc Kinh (luật TQ) |
| Giá | đắt hơn chút | rẻ hơn ~30% |

Code chọn endpoint DashScope Model Studio theo `REGION` (`wrangler.toml [vars]`). Mặc định `intl` (khuyến nghị: free tier + data Singapore). Đặt `REGION = "cn"` để dùng mainland. Chỉ set `MODEL_ENDPOINT` khi cố ý đổi sang provider/endpoint khác; không dùng endpoint `coding-intl.dashscope.aliyuncs.com` cho tính năng Vision.

### Model ID
Mặc định `qwen3.7-plus` theo free quota Singapore hiện dùng. **Xác minh id model vision hiện hành trên DashScope console** trước khi ship — đặt qua `MODEL_ID`.

## Chi phí / chống bill sốc (H5)
- **KHÔNG gắn thẻ thanh toán** vào account Qwen, hoặc đặt budget alert nếu hỗ trợ. Đây là **backstop cứng thật**.
- `MONTHLY_CAP` auto-disable khi chạm. Theo dõi KV counter `m:YYYY-MM`.
- ⚠️ **Cap là best-effort, KHÔNG cứng (H1)**: counter KV không atomic (eventual consistency) → burst song song có thể vượt nhẹ. Đặt `MONTHLY_CAP` thấp hơn ngân sách thật (headroom). Cần giới hạn cứng tuyệt đối → dùng Durable Object cho counter tháng.
- **Turnstile là rào chống lạm dụng CHÍNH** cho client không phải browser (CORS chỉ chặn browser). BẮT BUỘC set `ALLOWED_ORIGIN` đúng URL site (đừng để `*` ở production) + đảm bảo Turnstile secret/sitekey khớp.
- Xoay API key định kỳ.

## Disclaimer (Phase 4, M3)
UI phải nêu đích danh: *"Ảnh gửi tới Alibaba Cloud DashScope để xử lý, không lưu; tránh ảnh lộ tên tài khoản."* + link policy.
