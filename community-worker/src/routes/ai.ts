// Quản trị danh sách nhà cung cấp AI (tab AI của /quan-tri/). Lưu mã hoá trong KV `ai:providers`
// (shared/ai-config.ts); worker/ đọc cùng bản ghi. API KHÔNG bao giờ trả key, chỉ 4 ký tự cuối.

import { Hono } from "hono";
import {
  activeProviders,
  loadProviders,
  MAX_API_KEY_CHARS,
  MAX_ENDPOINT_CHARS,
  MAX_ID_CHARS,
  MAX_LABEL_CHARS,
  MAX_MODEL_ID_CHARS,
  MAX_PROVIDERS,
  saveProviders,
  type AiProvider,
} from "../../../shared/ai-config";
import { requireAdmin, type AppEnv, type Ctx } from "../context";
import { ApiError } from "../http";
import { parseText, readJson } from "../validate";

const ID_RE = new RegExp(`^[A-Za-z0-9_-]{1,${MAX_ID_CHARS}}$`, "u");

const bad = (code: string, message: string) => new ApiError(400, code, message);

/** Bản xem an toàn: bỏ key, chỉ còn 4 ký tự cuối (key quá ngắn -> không lộ ký tự nào). */
function toView(providers: AiProvider[]) {
  return {
    providers: providers.map(({ apiKey, ...rest }) => ({ ...rest, keyLast4: apiKey.length >= 8 ? apiKey.slice(-4) : "" })),
    configured: activeProviders(providers).length > 0,
  };
}

function parseEndpoint(value: unknown): string {
  const text = parseText(value, "endpoint", 1, MAX_ENDPOINT_CHARS);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw bad("invalid_endpoint", "endpoint phải là URL hợp lệ");
  }
  if (url.protocol !== "https:") throw bad("invalid_endpoint", "endpoint phải dùng https");
  return text;
}

/** Validate cả danh sách; mục có apiKey rỗng/thiếu giữ key cũ theo id, mục mới bắt buộc có key. */
function parseProviders(value: unknown, previous: AiProvider[]): AiProvider[] {
  if (!Array.isArray(value)) throw bad("invalid_providers", "providers phải là danh sách");
  if (value.length > MAX_PROVIDERS) throw bad("invalid_providers", `Tối đa ${MAX_PROVIDERS} nhà cung cấp`);
  const oldKeys = new Map(previous.map((p) => [p.id, p.apiKey]));
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw bad("invalid_providers", "Mỗi mục phải là object");
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) throw bad("invalid_id", "id không hợp lệ");
    if (ids.has(raw.id)) throw bad("duplicate_id", "id bị trùng");
    ids.add(raw.id);
    if (typeof raw.enabled !== "boolean") throw bad("invalid_enabled", "enabled phải là true/false");
    const typedKey = raw.apiKey == null ? "" : parseText(raw.apiKey, "apiKey", 0, MAX_API_KEY_CHARS);
    const apiKey = typedKey || oldKeys.get(raw.id);
    if (!apiKey) throw bad("missing_api_key", "Nhà cung cấp mới cần API key");
    return {
      id: raw.id,
      label: parseText(raw.label, "label", 1, MAX_LABEL_CHARS),
      endpoint: parseEndpoint(raw.endpoint),
      modelId: parseText(raw.modelId, "modelId", 1, MAX_MODEL_ID_CHARS),
      apiKey,
      enabled: raw.enabled,
    };
  });
}

function requireSecret(c: Ctx): string {
  const secret = c.env.AI_CONFIG_SECRET;
  if (!secret) throw new ApiError(503, "ai_secret_missing", "Chưa đặt AI_CONFIG_SECRET cho Worker");
  return secret;
}

export const ai = new Hono<AppEnv>();

ai.get("/api/admin/ai/providers", async (c) => {
  await requireAdmin(c);
  const secret = requireSecret(c);
  return c.json(toView(await loadProviders(c.env.AI_KV, secret)));
});

ai.put("/api/admin/ai/providers", async (c) => {
  await requireAdmin(c);
  const secret = requireSecret(c);
  const input = await readJson(c.req.raw);
  const providers = parseProviders(input.providers, await loadProviders(c.env.AI_KV, secret));
  await saveProviders(c.env.AI_KV, secret, providers);
  return c.json(toView(providers));
});
