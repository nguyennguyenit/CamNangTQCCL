// Worker entry: POST /analyze proxy Vision LLM với guardrail đầy đủ.
// Thứ tự (rẻ -> đắt): OPTIONS -> method -> cấu hình origin -> origin -> secret băm IP -> Content-Length ->
// kill-switch+cap+rate-limit -> Turnstile -> input guard -> callModel -> validate -> JSON.
// Mọi lỗi (kể cả bất ngờ) đều trả JSON có CORS. KHÔNG lưu ảnh; log tối thiểu.

import { Config, Env, loadConfig } from "./config";
import { corsHeaders, preflight, validateImage } from "./guard";
import { callModel } from "./model";
import { checkLimits, commitGlobalUsage, hashIp } from "./ratelimit";
import { ANALYZE_MODES, AnalyzeMode } from "./schema";
import { verifyTurnstile } from "./turnstile";

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export function resolveAnalyzeMode(value: unknown): AnalyzeMode {
  if (value === undefined || value === null || value === "") return "analyzeTeamImage";
  if (typeof value === "string" && (ANALYZE_MODES as string[]).includes(value)) return value as AnalyzeMode;
  throw new Error("Mode không hợp lệ");
}

/** Trần body: base64 của ảnh lớn nhất (4/3) + chỗ cho token, mode và khung JSON. */
function maxRequestBytes(maxImageBytes: number): number {
  return Math.ceil((maxImageBytes * 4) / 3) + 4096;
}

async function handle(request: Request, env: Env, cfg: Config, cors: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") return preflight(cors);
  if (request.method !== "POST" || url.pathname !== "/analyze") {
    return json({ error: "Not found" }, 404, cors);
  }
  // Thiếu ALLOWED_ORIGINS -> không có origin/hostname nào hợp lệ; từ chối trước KV/siteverify.
  const { allowedOrigins } = cfg;
  if (allowedOrigins !== "*" && allowedOrigins.length === 0) {
    return json({ error: "Dịch vụ soi ảnh chưa được cấu hình" }, 503, cors);
  }
  // CORS origin enforcement (ngoài header) — chặn origin lạ ở tầng app.
  const origin = request.headers.get("Origin");
  if (allowedOrigins !== "*" && origin && !allowedOrigins.includes(origin)) {
    return json({ error: "Origin không được phép" }, 403, cors);
  }
  // Thiếu khoá băm IP -> từ chối trước mọi thao tác KV/siteverify/model (fail-closed).
  const ipHashSecret = env.IP_HASH_SECRET;
  if (!ipHashSecret) {
    return json({ error: "Dịch vụ soi ảnh chưa được cấu hình" }, 503, cors);
  }
  // Chặn body quá lớn theo header trước khi đọc; thiếu header thì guard ảnh vẫn kiểm.
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (declaredLength > maxRequestBytes(cfg.maxImageBytes)) {
    return json({ error: "Ảnh quá lớn" }, 413, cors);
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Body JSON không hợp lệ" }, 400, cors);
  }
  let mode: AnalyzeMode;
  try {
    mode = resolveAnalyzeMode(payload?.mode);
  } catch (e: any) {
    return json({ error: e?.message || "Mode không hợp lệ" }, 400, cors);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ipHash = await hashIp(ip, ipHashSecret);

  // Cap + kill-switch + rate-limit (trước khi đụng Turnstile/model).
  const limit = await checkLimits(env.RL, ipHash, new Date(), cfg);
  if (!limit.allowed) {
    return json({ error: limit.message }, limit.status || 429, cors);
  }

  // Turnstile (siteverify: một lần dùng + hostname thuộc một origin của site).
  const expectedHostnames = allowedOrigins === "*" ? null : allowedOrigins.map((allowed) => new URL(allowed).hostname);
  const ts = await verifyTurnstile(payload?.turnstileToken, env.TURNSTILE_SECRET, ip, expectedHostnames);
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

  try {
    const result = await callModel(img.dataUri, {
      endpoint: cfg.modelEndpoint,
      apiKey: env.QWEN_API_KEY,
      modelId: cfg.modelId,
    }, mode);
    return json(result, 200, cors);
  } catch (e: any) {
    // callModel chỉ gắn `status` cho lỗi có thông điệp cố định, an toàn để trả nguyên.
    if (typeof e?.status === "number" && typeof e?.message === "string") {
      return json({ error: e.message }, e.status, cors);
    }
    throw e;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cfg = loadConfig(env);
    const cors = corsHeaders(cfg.allowedOrigins, request.headers.get("Origin"));
    try {
      return await handle(request, env, cfg, cors);
    } catch {
      // Lỗi không lường trước -> câu chung, không lộ chi tiết (L1).
      return json({ error: "Lỗi xử lý, thử lại sau" }, 500, cors);
    }
  },
};
