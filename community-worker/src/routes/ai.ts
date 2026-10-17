// Quản trị cấu hình AI (tab AI của /quan-tri/): nhà cung cấp chung (endpoint + key + model tự thêm) và chuỗi
// failover (provider, model, effort) + timeout/trần tổng của từng nhóm tính năng. Lưu mã hoá trong KV
// `ai:config` (shared/ai-config.ts); worker/ đọc cùng bản ghi. API KHÔNG bao giờ trả key, chỉ 4 ký tự cuối.

import { Hono } from "hono";
import { writeAudit, writeAuditQuietly } from "../audit";
import {
  AI_CONFIG_KEY,
  AI_GROUPS,
  GROUP_NEEDS_VISION,
  loadAiConfig,
  MAX_API_KEY_CHARS,
  MAX_BUDGET_MS,
  MAX_CHAIN_LINKS,
  MAX_ENDPOINT_CHARS,
  MAX_EXTRA_MODELS,
  MAX_ID_CHARS,
  MAX_LABEL_CHARS,
  MAX_MODEL_ID_CHARS,
  MAX_PROVIDERS,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  modelsOf,
  saveAiConfig,
  type AiChainLink,
  type AiConfig,
  type AiGroupConfig,
  type AiGroupId,
  type AiProvider,
} from "../../../shared/ai-config";
import { AI_PRESETS, EFFORT_LEVELS, type AiModel, type EffortStyle } from "../../../shared/ai-models";
import { requireRoot, type AppEnv, type Ctx } from "../context";
import { ApiError } from "../http";
import { parseText, readJson } from "../validate";

const ID_RE = new RegExp(`^[A-Za-z0-9_-]{1,${MAX_ID_CHARS}}$`, "u");

const bad = (code: string, message: string) => new ApiError(400, code, message);

function record(value: unknown, code: string, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw bad(code, message);
  return value as Record<string, unknown>;
}

/** Bản xem an toàn: bỏ key (chỉ còn 4 ký tự cuối; key quá ngắn -> không lộ ký tự nào) + catalog cho UI. */
function toView(config: AiConfig) {
  return {
    providers: config.providers.map(({ apiKey, ...rest }) => ({ ...rest, keyLast4: apiKey.length >= 8 ? apiKey.slice(-4) : "" })),
    groups: config.groups,
    presets: AI_PRESETS,
    effortLevels: EFFORT_LEVELS,
    groupNeedsVision: GROUP_NEEDS_VISION,
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

function parseExtraModels(value: unknown, presetModels: AiModel[]): AiModel[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw bad("invalid_models", "extraModels phải là danh sách");
  if (value.length > MAX_EXTRA_MODELS) throw bad("invalid_models", `Tối đa ${MAX_EXTRA_MODELS} model tự thêm`);
  const ids = new Set(presetModels.map((m) => m.modelId));
  return value.map((item: unknown) => {
    const raw = record(item, "invalid_models", "Mỗi model phải là object");
    const modelId = parseText(raw.modelId, "modelId", 1, MAX_MODEL_ID_CHARS);
    if (ids.has(modelId)) throw bad("duplicate_model", `Model ${modelId} bị trùng`);
    ids.add(modelId);
    if (typeof raw.vision !== "boolean") throw bad("invalid_models", "vision phải là true/false");
    const style = raw.effortStyle;
    if (typeof style !== "string" || !Object.hasOwn(EFFORT_LEVELS, style)) throw bad("invalid_effort_style", "effortStyle không hợp lệ");
    const allowed = EFFORT_LEVELS[style as EffortStyle];
    const efforts = raw.efforts;
    if (
      !Array.isArray(efforts) || !efforts.length || new Set(efforts).size !== efforts.length ||
      !efforts.every((e) => typeof e === "string" && allowed.includes(e))
    ) {
      throw bad("invalid_efforts", `efforts phải là tập con khác rỗng của ${allowed.join("/")}`);
    }
    return { modelId, vision: raw.vision, effortStyle: style as EffortStyle, efforts: efforts as string[] };
  });
}

/** Validate cả danh sách; mục có apiKey rỗng/thiếu giữ key cũ theo id, mục mới bắt buộc có key. */
function parseProviders(value: unknown, previous: AiProvider[]): AiProvider[] {
  if (!Array.isArray(value)) throw bad("invalid_providers", "providers phải là danh sách");
  if (value.length > MAX_PROVIDERS) throw bad("invalid_providers", `Tối đa ${MAX_PROVIDERS} nhà cung cấp`);
  // Key cũ chỉ được giữ khi cùng id VÀ cùng endpoint: đổi endpoint mà không nhập key thì key không đi theo sang host mới.
  const previousById = new Map(previous.map((p) => [p.id, p]));
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    const raw = record(item, "invalid_providers", "Mỗi mục phải là object");
    if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) throw bad("invalid_id", "id không hợp lệ");
    if (ids.has(raw.id)) throw bad("duplicate_id", "id bị trùng");
    ids.add(raw.id);
    if (typeof raw.enabled !== "boolean") throw bad("invalid_enabled", "enabled phải là true/false");
    const presetId = raw.preset ?? "";
    const preset = AI_PRESETS.find((p) => p.id === presetId);
    if (presetId !== "" && !preset) throw bad("invalid_preset", "Mẫu nhà cung cấp không tồn tại");
    const endpoint = parseEndpoint(raw.endpoint);
    if (preset && endpoint !== preset.endpoint) throw bad("invalid_endpoint", "endpoint phải trùng endpoint của mẫu");
    const typedKey = raw.apiKey == null ? "" : parseText(raw.apiKey, "apiKey", 0, MAX_API_KEY_CHARS);
    const old = previousById.get(raw.id);
    const apiKey = typedKey || (old?.endpoint === endpoint ? old.apiKey : "");
    if (!apiKey) throw bad("missing_api_key", "Nhà cung cấp mới hoặc đổi endpoint cần API key");
    return {
      id: raw.id,
      label: parseText(raw.label, "label", 1, MAX_LABEL_CHARS),
      preset: preset?.id ?? "",
      endpoint,
      apiKey,
      enabled: raw.enabled,
      extraModels: parseExtraModels(raw.extraModels, preset?.models ?? []),
    };
  });
}

function parseTimeout(value: unknown, code: string, min: number, max: number, message: string): number {
  // Nguyên giây: UI nhập theo giây.
  if (typeof value !== "number" || !Number.isInteger(value) || value % 1000 !== 0 || value < min || value > max) throw bad(code, message);
  return value;
}

/** Mỗi nhóm bắt buộc có mặt; mắt xích phải trỏ tới provider/model/effort đang tồn tại và hợp nhóm. */
function parseGroups(value: unknown, providers: AiProvider[]): Record<AiGroupId, AiGroupConfig> {
  const raw = record(value, "invalid_groups", "groups phải là object");
  const groups = {} as Record<AiGroupId, AiGroupConfig>;
  for (const id of AI_GROUPS) {
    const g = record(raw[id], "invalid_groups", `Thiếu cấu hình nhóm ${id}`);
    if (!Array.isArray(g.chain)) throw bad("invalid_chain", `Chuỗi của nhóm ${id} phải là danh sách`);
    if (g.chain.length > MAX_CHAIN_LINKS) throw bad("invalid_chain", `Tối đa ${MAX_CHAIN_LINKS} mắt xích mỗi nhóm`);
    const chain = g.chain.map((item: unknown): AiChainLink => {
      const link = record(item, "invalid_chain", "Mỗi mắt xích phải là object");
      const provider = providers.find((p) => p.id === link.providerId);
      if (!provider) throw bad("unknown_provider", `Nhóm ${id}: nhà cung cấp không tồn tại`);
      const model = modelsOf(provider).find((m) => m.modelId === link.modelId);
      if (!model) throw bad("unknown_model", `Nhóm ${id}: model không có trong ${provider.label}`);
      if (GROUP_NEEDS_VISION[id] && !model.vision) throw bad("model_not_vision", `Nhóm ${id} cần model nhận ảnh`);
      if (typeof link.effort !== "string" || !model.efforts.includes(link.effort)) {
        throw bad("invalid_effort", `Nhóm ${id}: ${model.modelId} không nhận mức effort này`);
      }
      return { providerId: provider.id, modelId: model.modelId, effort: link.effort };
    });
    const timeoutMs = parseTimeout(g.timeoutMs, "invalid_timeout", MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, `timeoutMs của nhóm ${id} phải trong ${MIN_TIMEOUT_MS}–${MAX_TIMEOUT_MS}`);
    const budgetMs = parseTimeout(g.budgetMs, "invalid_budget", timeoutMs, MAX_BUDGET_MS, `budgetMs của nhóm ${id} phải trong timeoutMs–${MAX_BUDGET_MS}`);
    groups[id] = { chain, timeoutMs, budgetMs };
  }
  return groups;
}

function requireSecret(c: Ctx): string {
  const secret = c.env.AI_CONFIG_SECRET;
  if (!secret) throw new ApiError(503, "ai_secret_missing", "Chưa đặt AI_CONFIG_SECRET cho Worker");
  return secret;
}

export const ai = new Hono<AppEnv>();

ai.get("/api/admin/ai/config", async (c) => {
  await requireRoot(c);
  const secret = requireSecret(c);
  return c.json(toView(await loadAiConfig(c.env.AI_KV, secret)));
});

ai.put("/api/admin/ai/config", async (c) => {
  const viewer = await requireRoot(c);
  const secret = requireSecret(c);
  const input = await readJson(c.req.raw);
  const providers = parseProviders(input.providers, (await loadAiConfig(c.env.AI_KV, secret)).providers);
  const config: AiConfig = { providers, groups: parseGroups(input.groups, providers) };
  // Meta chỉ gồm id nhà cung cấp/nhóm (danh sách cho phép): không endpoint, key, hay object cấu hình.
  const entry = {
    action: "ai.config.update",
    targetType: "ai_config",
    targetId: AI_CONFIG_KEY,
    meta: { providers: providers.map((p) => p.id), groups: AI_GROUPS.filter((id) => id in config.groups) },
  };
  try {
    await saveAiConfig(c.env.AI_KV, secret, config);
  } catch (error) {
    await writeAuditQuietly(c, viewer, { ...entry, meta: { ...entry.meta, step: "kv" }, status: "failed" });
    throw error;
  }
  // Lỗi ghi nhật ký sau khi KV đã lưu nổi lên nguyên văn (không gán nhãn failed của KV).
  await writeAudit(c, viewer, { ...entry, status: "ok" });
  return c.json(toView(config));
});
