// Worker entry: POST /analyze proxy Vision LLM với guardrail đầy đủ.
// Thứ tự (rẻ -> đắt): OPTIONS -> origin/method -> kill-switch+cap+rate-limit ->
// Turnstile -> input guard -> callModel -> validate -> JSON.
// KHÔNG lưu ảnh; log tối thiểu (đếm, không nội dung).

import { Env, loadConfig } from "./config";
import { corsHeaders, preflight, validateImage } from "./guard";
import { callModel } from "./model";
import { checkLimits, commitGlobalUsage, hashIp } from "./ratelimit";
import { verifyTurnstile } from "./turnstile";

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cfg = loadConfig(env);
    const cors = corsHeaders(cfg.allowedOrigin);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return preflight(cfg.allowedOrigin);
    if (request.method !== "POST" || url.pathname !== "/analyze") {
      return json({ error: "Not found" }, 404, cors);
    }
    // CORS origin enforcement (ngoài header) — chặn origin lạ ở tầng app.
    const origin = request.headers.get("Origin");
    if (cfg.allowedOrigin !== "*" && origin && origin !== cfg.allowedOrigin) {
      return json({ error: "Origin không được phép" }, 403, cors);
    }

    let payload: any;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Body JSON không hợp lệ" }, 400, cors);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "";
    const ipHash = await hashIp(ip);

    // Cap + kill-switch + rate-limit (trước khi đụng Turnstile/model).
    const limit = await checkLimits(env.RL, ipHash, new Date(), cfg);
    if (!limit.allowed) {
      return json({ error: limit.message }, limit.status || 429, cors);
    }

    // Turnstile (chống bot + replay).
    const ts = await verifyTurnstile(payload?.turnstileToken, env.TURNSTILE_SECRET, ip, env.RL);
    if (!ts.ok) {
      return json({ error: ts.message }, 403, cors);
    }

    // Input guard (size/MIME/magic bytes) — KHÔNG tin nén client.
    const img = validateImage(payload?.image, cfg.maxImageBytes);
    if (!img.ok) {
      return json({ error: img.message }, img.status, cors);
    }

    // [H2] Đếm quota global CHỈ khi đã qua Turnstile + guard (sắp tốn tiền thật).
    await commitGlobalUsage(env.RL, new Date());

    // Gọi model.
    try {
      const result = await callModel(img.dataUri, {
        endpoint: cfg.modelEndpoint,
        apiKey: env.QWEN_API_KEY,
        modelId: cfg.modelId,
      });
      return json(result, 200, cors);
    } catch (e: any) {
      // Chỉ trả message khi có status đã biết (đều là chuỗi an toàn). Lỗi không
      // lường trước -> message chung, tránh leak chi tiết upstream (L1).
      const status = typeof e?.status === "number" ? e.status : 500;
      const message = status === 500 ? "Lỗi xử lý, thử lại sau" : e?.message || "Lỗi xử lý";
      return json({ error: message }, status, cors);
    }
  },
};
