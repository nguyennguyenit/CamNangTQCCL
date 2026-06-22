# TQCCL Vision Proxy (Cloudflare Worker)

Proxy giữ API key Qwen + guardrail cho tính năng **Soi đội từ ảnh**. Hạ tầng
**tách biệt** site tĩnh (KHÔNG deploy lên GitHub Pages). Site gọi `POST /analyze`.

## Kiến trúc

```
Site (Pages) ──POST /analyze {image, turnstileToken}──► Worker
   Worker: OPTIONS → origin → cap/kill-switch/rate-limit → Turnstile → input guard → Qwen → validate → JSON
   Trả: { heroes: [{ nameCn, tacticsCn[], statFocusCn }] }   (Hán; site map sang Việt qua dict)
```

KHÔNG lưu ảnh. Log tối thiểu (đếm, không nội dung). IP chỉ lưu dạng hash.

## Setup deploy

1. **Cloudflare account** + cài wrangler: `npm i -g wrangler` rồi `wrangler login`.
2. **KV namespace**: `wrangler kv namespace create RL` → dán `id` vào `wrangler.toml` (`[[kv_namespaces]] id`).
3. **Turnstile** (Cloudflare dashboard → Turnstile): tạo site → lấy **site-key** (public, để vào site `config.js`) + **secret**.
4. **Qwen key**: tạo trên Alibaba Model Studio / DashScope → API key.
5. **Vars**: sửa `wrangler.toml` → `ALLOWED_ORIGIN` = URL site thật (vd `https://user.github.io`); chốt `MODEL_ID`/`MODEL_ENDPOINT` (xem §Region).
6. **Secrets** (KHÔNG commit):
   ```bash
   wrangler secret put QWEN_API_KEY
   wrangler secret put TURNSTILE_SECRET
   ```
7. **Deploy**: `npm install && npm run deploy`. Dev: copy `.dev.vars.example`→`.dev.vars`, `npm run dev`.

## Test

```bash
npm install
npm test          # vitest: schema (tolerant parse M1), guard (H4), rate-limit/cap (H5)
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

Code chọn endpoint theo `REGION` (`wrangler.toml [vars]`). Mặc định `intl` (khuyến nghị: free tier + data Singapore). Đặt `REGION = "cn"` để dùng mainland. Hoặc set `MODEL_ENDPOINT` để override hẳn (provider khác).

### Model ID
Mặc định `qwen-vl-max`. **Xác minh id model vision hiện hành trên DashScope console** (vd `qwen-vl-max`, `qwen3-vl-plus`, hoặc `qwen3.7-plus` theo plan) trước khi ship — đặt qua `MODEL_ID`.

## Chi phí / chống bill sốc (H5)
- **KHÔNG gắn thẻ thanh toán** vào account Qwen, hoặc đặt budget alert nếu hỗ trợ. Đây là **backstop cứng thật**.
- `MONTHLY_CAP` auto-disable khi chạm. Theo dõi KV counter `m:YYYY-MM`.
- ⚠️ **Cap là best-effort, KHÔNG cứng (H1)**: counter KV không atomic (eventual consistency) → burst song song có thể vượt nhẹ. Đặt `MONTHLY_CAP` thấp hơn ngân sách thật (headroom). Cần giới hạn cứng tuyệt đối → dùng Durable Object cho counter tháng.
- **Turnstile là rào chống lạm dụng CHÍNH** cho client không phải browser (CORS chỉ chặn browser). BẮT BUỘC set `ALLOWED_ORIGIN` đúng URL site (đừng để `*` ở production) + đảm bảo Turnstile secret/sitekey khớp.
- Xoay API key định kỳ.

## Disclaimer (Phase 4, M3)
UI phải nêu đích danh: *"Ảnh gửi tới Alibaba Cloud DashScope để xử lý, không lưu; tránh ảnh lộ tên tài khoản."* + link policy.
