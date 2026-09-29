// Worker entry: POST /analyze proxy LLM với guardrail đầy đủ.
// Thứ tự (rẻ -> đắt): OPTIONS -> method -> cấu hình origin -> origin -> secret băm IP -> Content-Length
// -> mode -> chuỗi AI của nhóm ứng với mode (KV) -> kill-switch+cap+rate-limit -> Turnstile -> input guard
// (ảnh cho mode đọc ảnh, `context` cho mode chỉ văn bản explainSubstitute) -> callModel (failover) -> validate -> JSON.
// Mọi lỗi (kể cả bất ngờ) đều trả JSON có CORS. KHÔNG lưu ảnh; log tối thiểu.

import { loadAiConfig, resolveRoute, type AiGroupId } from "../../shared/ai-config";
import { Config, Env, loadConfig } from "./config";
import { corsHeaders, preflight, validateImage } from "./guard";
import { callExplainModel, callModel } from "./model";
import { checkLimits, commitGlobalUsage, hashIp } from "./ratelimit";
import {
  ANALYZE_MODES,
  AnalyzeMode,
  AnalyzeModeResult,
  ExplainContext,
  ExplainResult,
  INVALID_CONTEXT,
  validateExplainContext,
} from "./schema";
import { verifyTurnstile } from "./turnstile";

const NOT_CONFIGURED = "Dịch vụ soi ảnh chưa được cấu hình";
// KV cache ở edge: đổi cấu hình ở /quan-tri/ có hiệu lực trong khoảng 1 phút.
const CONFIG_CACHE_TTL = 60;
/** Nhóm cấu hình AI (tab AI của /quan-tri/) của từng mode. */
const GROUP_BY_MODE: Record<AnalyzeMode, AiGroupId> = {
  analyzeTeamImage: "teamScan",
  scanHeroes: "rosterRecommend",
  scanTactics: "rosterRecommend",
  scanBuiltTeams: "rosterRecommend",
  explainSubstitute: "explainSubstitute",
};

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
    return json({ error: NOT_CONFIGURED }, 503, cors);
  }
  // CORS origin enforcement (ngoài header) — chặn origin lạ ở tầng app.
  const origin = request.headers.get("Origin");
  if (allowedOrigins !== "*" && origin && !allowedOrigins.includes(origin)) {
    return json({ error: "Origin không được phép" }, 403, cors);
  }
  // Thiếu khoá băm IP -> từ chối trước mọi thao tác KV/siteverify/model (fail-closed).
  const ipHashSecret = env.IP_HASH_SECRET;
  if (!ipHashSecret) {
    return json({ error: NOT_CONFIGURED }, 503, cors);
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
  // Chuỗi AI của nhóm (mã hoá trong KV); thiếu secret/giải mã lỗi/chuỗi rỗng/mọi mắt xích tắt -> 503.
  const route = resolveRoute(await loadAiConfig(env.RL, env.AI_CONFIG_SECRET, CONFIG_CACHE_TTL), GROUP_BY_MODE[mode]);
  if (!route.targets.length) {
    return json({ error: NOT_CONFIGURED }, 503, cors);
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

  // Input guard — KHÔNG tin client. Mode ảnh: size/MIME/magic bytes (không tin nén client);
  // explainSubstitute: `context` đúng khoá + độ dài, không cần ảnh.
  let run: () => Promise<AnalyzeModeResult | ExplainResult>;
  if (mode === "explainSubstitute") {
    let context: ExplainContext;
    try {
      context = validateExplainContext(payload?.context);
    } catch {
      return json({ error: INVALID_CONTEXT }, 400, cors);
    }
    run = () => callExplainModel(context, { route });
  } else {
    const img = validateImage(payload?.image, cfg.maxImageBytes);
    if (!img.ok) {
      return json({ error: img.message }, img.status, cors);
    }
    run = () => callModel(img.dataUri, { route }, mode);
  }

  // [H2] Đếm quota global CHỈ khi đã qua Turnstile + guard (sắp tốn tiền thật).
  await commitGlobalUsage(env.RL, new Date());

  try {
    return json(await run(), 200, cors);
  } catch (e: any) {
    // callModel/callExplainModel chỉ gắn `status` cho lỗi có thông điệp cố định, an toàn để trả nguyên.
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
