# TQCCL Vision Proxy (Cloudflare Worker)

Proxy gọi AI + guardrail cho các công cụ đọc ảnh (**Soi đội từ ảnh**,
**Gợi ý đội từ kho**). Hạ tầng **tách biệt** site tĩnh: site chạy trên Cloudflare
Pages với domain chính `https://tqccl.com` (`wrangler.toml` `ALLOWED_ORIGINS` nhận cả
`https://www.tqccl.com` và `https://tqccl.pages.dev`), Worker deploy
riêng bằng `wrangler`. Site gọi `POST /analyze`.

## Kiến trúc

```
Site (Pages) ──POST /analyze {image, turnstileToken, mode}──► Worker
   Worker: OPTIONS → origin → IP_HASH_SECRET → danh sách nhà cung cấp AI (KV `ai:providers`) → Content-Length
           → cap/kill-switch/rate-limit → Turnstile (siteverify: một lần dùng + đúng hostname) → input guard
           → nhà cung cấp AI (failover theo thứ tự) → validate → JSON
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
| `analyzeTeamImage` | Soi đội từ ảnh | `{ heroes: [{ nameCn, tacticsCn[2], booksCn[], statFocusCn }] }` |
| `scanHeroes` | Gợi ý đội: đọc kho tướng | `{ heroes: [{ nameCn, level?, redStars? }] }` |
| `scanTactics` | Gợi ý đội: đọc kho chiến pháp | `{ tactics: [{ nameCn }] }` |
| `scanBuiltTeams` | Gợi ý đội: đọc đội đã build | `{ teams: [{ teamName, heroesCn[], tacticsCn[] }] }` |

`analyzeTeamImage` chỉ chép chữ in trong ảnh: không nhận diện tướng qua chân dung và không gửi
danh sách tên tướng cho model. Cột không có tên in đọc được trả `nameCn: "未知"`. `tacticsCn` luôn
đúng 2 phần tử theo vị trí ô A/B; ô không đọc được hoặc trống là `"未知"` tại đúng vị trí đó (Worker
đệm/cắt về 2 ô), để site gắn đúng slot trong editor xác nhận. `booksCn` giữ thứ tự in, binh thư
chính trước.

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
3. **Turnstile** (Cloudflare dashboard → Turnstile): tạo site với đủ hostname của site (`tqccl.com`, `www.tqccl.com`, `tqccl.pages.dev`) → lấy **site-key** (public, để vào `js/config.js`) + **secret**.
4. **Nhà cung cấp AI**: không nằm trong env. Admin nhập ở tab **AI** của `/quan-tri/` (community-worker ghi bản ghi
   mã hoá `ai:providers` vào cùng KV namespace `RL`; Worker này chỉ đọc). Xem §Nhà cung cấp AI.
5. **Vars**: `wrangler.toml` → `ALLOWED_ORIGINS` = các origin exact của site, phân cách dấu phẩy (`https://tqccl.com,https://www.tqccl.com,https://tqccl.pages.dev`); CORS echo đúng origin gửi lên kèm `Vary: Origin`, và `hostname` siteverify trả về phải là host của một origin trong danh sách. Thiếu/rỗng → `/analyze` trả `503` (fail-closed); `*` chỉ dùng khi dev.
6. **Secrets** (KHÔNG commit), cả ba bắt buộc:
   ```bash
   wrangler secret put TURNSTILE_SECRET
   openssl rand -base64 48 | wrangler secret put IP_HASH_SECRET
   wrangler secret put AI_CONFIG_SECRET   # CÙNG giá trị với community-worker
   ```
   Thiếu hoặc rỗng `IP_HASH_SECRET` → mọi `POST /analyze` trả **503** `Dịch vụ soi ảnh chưa được cấu hình`
   (không đọc/ghi KV, không gọi Turnstile hay model). Đổi secret làm bộ đếm per-IP bắt đầu lại (TTL 2 giờ).
   Thiếu `AI_CONFIG_SECRET`, sai giá trị (giải mã lỗi), chưa có danh sách hoặc không mục nào bật → cũng **503**
   `Dịch vụ soi ảnh chưa được cấu hình` (không ghi KV, không gọi Turnstile hay model).
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

> **Số liệu cap là placeholder** — chốt theo số dư/ngân sách thực (L2).

## Nhà cung cấp AI

Danh sách endpoint Chat Completions OpenAI-compatible (`{ id, label, endpoint, modelId, apiKey, enabled }`,
thứ tự = ưu tiên) nằm trong KV `ai:providers`, mã hoá AES-GCM (IV ngẫu nhiên 12 byte, khoá HKDF-SHA-256 từ
`AI_CONFIG_SECRET`). Code dùng chung một bản: `shared/ai-config.ts` (cả `worker/` lẫn `community-worker/`
import tương đối; wrangler bundle luôn). Worker đọc với `cacheTtl` 60 giây → đổi ở `/quan-tri/` có hiệu lực
trong khoảng 1 phút.

Mỗi request thử lần lượt các mục đang bật: 401/402/403/429/5xx, lỗi mạng hoặc timeout (45 giây/mục) → chuyển
mục kế; 4xx khác → dừng (yêu cầu hỏng). Gặp 2xx là dừng — nội dung không đọc được thành 422, không thử mục khác.
Hết mục: 429 cuối → 503 `Dịch vụ AI đang quá tải, thử lại sau`, còn lại → 502 `Dịch vụ AI tạm lỗi, thử lại sau`.

Mẫu có sẵn trong tab AI: **DeepSeek** `https://api.deepseek.com/chat/completions` (model `deepseek-flash`,
V4.1 Flash, đọc được ảnh) và **OpenCode Zen** `https://opencode.ai/zen/v1/chat/completions`
(model `deepseek-v4.1-flash`). Ảnh gửi dạng `image_url` base64 data URI; `response_format: json_object`
yêu cầu prompt có chữ "json" — mọi prompt đều có.

Trước khi ship lần đầu với model/nhà cung cấp mới: **test 5–10 screenshot thật** cho cả bốn `mode`.
Chính sách lưu giữ và dùng dữ liệu của từng nhà cung cấp: đọc privacy policy và cập nhật disclaimer nếu khác.

## Chi phí / chống bill sốc (H5)
- DeepSeek tính phí trả trước: **không bật tự nạp**; hết số dư thì upstream trả 402 → Worker chuyển sang mục kế
  trong danh sách; hết mục thì trả 502 `Dịch vụ AI tạm lỗi, thử lại sau`. Số dư trả trước là **backstop cứng thật**
  cho từng nhà cung cấp.
- `MONTHLY_CAP` auto-disable khi chạm. Theo dõi KV counter `m:YYYY-MM`.
- ⚠️ **Cap là best-effort, KHÔNG cứng (H1)**: counter KV không atomic (eventual consistency) → burst song song có thể vượt nhẹ. Đặt `MONTHLY_CAP` thấp hơn ngân sách thật (headroom). Cần giới hạn cứng tuyệt đối → dùng Durable Object cho counter tháng.
- **Turnstile là rào chống lạm dụng CHÍNH** cho client không phải browser (CORS chỉ chặn browser). BẮT BUỘC set `ALLOWED_ORIGINS` đúng các origin site (đừng để `*` ở production) + đảm bảo Turnstile secret/sitekey khớp.
- Xoay API key định kỳ.

## Disclaimer (Phase 4, M3)
UI phải nêu đích danh: *"Ảnh được gửi tới DeepSeek để AI phân tích; site không lưu ảnh. Tránh ảnh lộ tên tài khoản."* + link policy.
