# Phase 3 — Cloudflare Worker proxy + Qwen3.7-Plus

## Context
- Site static không giữ key → Worker giữ `QWEN_API_KEY` (secret). Gọi Qwen3.7-Plus (Alibaba Model Studio, OpenAI-compatible endpoint).
- Guardrail bắt buộc: Turnstile + rate-limit IP + hard daily cap (chống bill sốc).
- Repo riêng/thư mục `worker/` (không deploy lên GitHub Pages).

## Requirements
- Endpoint `POST /analyze`: verify Turnstile → rate-limit (KV/IP) → daily cap → **[H5] global monthly cap / kill-switch** → gọi Qwen → validate → trả JSON.
- Schema trả về: `{heroes:[{nameCn, tacticsCn:[..], statFocusCn}], raw}`. (Tên Hán; site map sang Việt qua dict.)
- **[H4] Input guard (KHÔNG tin client):** max payload ≤1.5MB sau nén; reject non-image (validate MIME/magic bytes); xử lý **OPTIONS preflight** rõ; Turnstile token verify 1 lần (chống replay/expiry).
- **[H5] Kill-switch:** env flag tắt feature + auto-disable khi monthly counter chạm ngưỡng (KHÔNG chờ thủ công). KHÔNG gắn thẻ thanh toán vào account Qwen / đặt budget alert nếu hỗ trợ.
- CORS chỉ cho domain site. KHÔNG lưu ảnh. Log tối thiểu (đếm, không nội dung).
- Secrets qua `wrangler secret` (KEY, TURNSTILE_SECRET). Không commit.

## [C2] Gate pháp lý (ĐIỀU KIỆN SHIP — không phải nice-to-have)
Trước khi public: đọc ToS Alibaba Model Studio, xác nhận (1) input **không bị dùng train** hoặc đã opt-out, (2) cho phép gửi **ảnh screenshot game** bản quyền bên thứ 3, (3) ghi rõ **region endpoint** (Singapore vs CN — data-retention khác). Nếu không thỏa → đổi provider (GPT/Gemini) qua lớp `callModel()`.

## Files
- Tạo: `worker/src/index.ts` (handler), `worker/wrangler.toml`, `worker/README.md` (deploy guide), `worker/schema.ts` (JSON schema + validate), `worker/.dev.vars.example`.
- KHÔNG đụng site chính.

## Steps
1. `wrangler init`; cấu hình KV namespace (rate-limit + daily counter).
2. Handler: Turnstile verify (siteverify) → rate-limit (IP hash, vd 10/giờ) → daily cap (vd 500/ngày, reset UTC) → gọi Qwen.
3. Prompt vision: "Đọc screenshot đội hình TQCCL. Trả JSON đúng schema: heroes[].nameCn (tên tướng chữ Hán), tacticsCn[] (chiến pháp chữ Hán), statFocusCn (chất tướng vd 全智力). Chỉ JSON, không giải thích."
4. **[M1] Spike nhỏ trước build:** xác nhận Qwen3.7-Plus có `response_format` structured-output. Nếu CÓ → dùng. Nếu KHÔNG → parse tolerant (strip ```json fence) + validate. Test cả 2 path.
5. Validate response theo schema; lỗi → 422 "không đọc được".
5. Hard cap chạm → 429 "hết lượt hôm nay".

## Tests (TDD)
- `worker/test/`: validate schema (hợp lệ/thiếu field + tolerant parse fence), rate-limit (mock KV), daily/monthly cap + kill-switch, Turnstile fail + replay, **[H4] reject payload quá lớn / non-image / OPTIONS preflight**. `vitest` + miniflare hoặc hàm thuần.
- Không gọi Qwen thật trong unit; mock fetch. 1 smoke test thủ công với ảnh thật + key dev.

## Risks / Rollback
- Free tier hết → daily cap + thông báo; có thể tắt feature bằng env flag.
- Qwen schema drift → validate chặt + version prompt; fallback message.
- Abuse vượt Turnstile → rate-limit IP + cap cứng là chốt chặn cuối.
- Lock-in → tách lớp `callModel()` để đổi sang GPT/Gemini (OpenAI-compatible).
