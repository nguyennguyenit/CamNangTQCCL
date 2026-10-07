// Cấu hình AI dùng chung cho `worker/` và `community-worker/`. Admin nhập ở tab AI (/quan-tri/); lưu MỘT
// bản ghi KV `ai:config` mã hoá AES-GCM với khoá dẫn xuất HKDF từ secret `AI_CONFIG_SECRET` (cùng giá trị
// ở cả hai Worker):
// - `providers`: endpoint + key (chung), mỗi mục có catalog model = mẫu tĩnh (shared/ai-models.ts) ∪ `extraModels`.
// - `groups`: bốn nhóm tính năng, mỗi nhóm một chuỗi failover (provider, model, effort) + timeout mỗi lượt
//   và trần tổng thời gian cho cả chuỗi.

import { AI_PRESETS, type AiModel, type EffortStyle } from "./ai-models";

export interface AiProvider {
  id: string;
  label: string;
  /** id mẫu trong AI_PRESETS; "" = tùy chỉnh (chỉ có `extraModels`). */
  preset: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
  /** Model admin tự thêm ngoài catalog của mẫu. */
  extraModels: AiModel[];
}

export const AI_GROUPS = ["teamScan", "rosterRecommend", "explainSubstitute", "battleReport"] as const;
export type AiGroupId = (typeof AI_GROUPS)[number];
/** Nhóm gửi ảnh chỉ được chọn model `vision`. */
export const GROUP_NEEDS_VISION: Record<AiGroupId, boolean> = {
  teamScan: true,
  rosterRecommend: true,
  explainSubstitute: false,
  battleReport: true,
};

export interface AiChainLink {
  providerId: string;
  modelId: string;
  effort: string;
}

export interface AiGroupConfig {
  chain: AiChainLink[];
  /** Thời gian chờ mỗi lượt gọi. */
  timeoutMs: number;
  /** Trần tổng thời gian cho cả chuỗi; hết trần thì dừng failover. */
  budgetMs: number;
}

export interface AiConfig {
  providers: AiProvider[];
  groups: Record<AiGroupId, AiGroupConfig>;
}

/** Phần KV cần dùng (KVNamespace của Workers thoả mãn). */
export interface AiConfigKv {
  get(key: string, options?: { cacheTtl?: number }): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export const AI_CONFIG_KEY = "ai:config";
export const MAX_PROVIDERS = 10;
export const MAX_EXTRA_MODELS = 20;
export const MAX_CHAIN_LINKS = 10;
export const MAX_ID_CHARS = 64;
export const MAX_LABEL_CHARS = 80;
export const MAX_ENDPOINT_CHARS = 500;
export const MAX_MODEL_ID_CHARS = 120;
export const MAX_API_KEY_CHARS = 500;
export const DEFAULT_TIMEOUT_MS = 45_000;
export const MIN_TIMEOUT_MS = 5_000;
export const MAX_TIMEOUT_MS = 120_000;
export const MAX_BUDGET_MS = 180_000;
/** Thời gian còn lại dưới mức này thì không thử mắt xích kế (lượt gọi gần như chắc chắn timeout). */
export const MIN_ATTEMPT_MS = 3_000;

const encoder = new TextEncoder();
// Nhãn dẫn xuất khoá cố định từ bản đầu tiên — đổi sẽ làm bản ghi `ai:config` đã lưu không giải mã được.
const HKDF_SALT = encoder.encode("tqccl-ai-config");
const HKDF_INFO = encoder.encode("ai:providers v1");
const RECORD_VERSION = 2;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: HKDF_INFO },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Mã hoá cấu hình -> chuỗi `{v, iv, data}` (IV ngẫu nhiên 12 byte mỗi lần ghi). */
export async function encryptConfig(config: AiConfig, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(config)));
  return JSON.stringify({ v: RECORD_VERSION, iv: toBase64(iv), data: toBase64(new Uint8Array(data)) });
}

/** Giải mã bản ghi; sai secret/hỏng dữ liệu/sai phiên bản -> ném lỗi. */
export async function decryptConfig(blob: string, secret: string): Promise<AiConfig> {
  const parsed: unknown = JSON.parse(blob);
  const rec = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const iv = str(rec.iv);
  const data = str(rec.data);
  if (rec.v !== RECORD_VERSION || !iv || !data) throw new Error("ai config: bản ghi không hợp lệ");
  const key = await deriveKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(data));
  return toConfig(JSON.parse(new TextDecoder().decode(plain)));
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function emptyConfig(): AiConfig {
  const groups = {} as Record<AiGroupId, AiGroupConfig>;
  for (const id of AI_GROUPS) groups[id] = { chain: [], timeoutMs: DEFAULT_TIMEOUT_MS, budgetMs: DEFAULT_TIMEOUT_MS };
  return { providers: [], groups };
}

/** Catalog model của một nhà cung cấp: model của mẫu (nếu có) rồi tới model admin tự thêm. */
export function modelsOf(provider: Pick<AiProvider, "preset" | "extraModels">): AiModel[] {
  return [...(AI_PRESETS.find((p) => p.id === provider.preset)?.models ?? []), ...provider.extraModels];
}

// Đọc bản ghi đã giải mã: dữ liệu do chính route admin ghi (đã validate), nên chỉ kiểm hình dạng và bỏ
// mục hỏng thay vì ném lỗi.
function toModel(value: unknown): AiModel | null {
  const v = obj(value);
  const modelId = str(v?.modelId);
  const style = str(v?.effortStyle) as EffortStyle | null;
  if (!v || !modelId || !style || typeof v.vision !== "boolean" || !Array.isArray(v.efforts)) return null;
  return { modelId, vision: v.vision, effortStyle: style, efforts: v.efforts.filter((e): e is string => typeof e === "string") };
}

function toProvider(value: unknown): AiProvider | null {
  const v = obj(value);
  if (!v) return null;
  const [id, label, preset, endpoint, apiKey] = [v.id, v.label, v.preset, v.endpoint, v.apiKey].map(str);
  if (!id || label === null || preset === null || !endpoint || !apiKey || typeof v.enabled !== "boolean") return null;
  const extraModels = Array.isArray(v.extraModels) ? v.extraModels.map(toModel).filter((m): m is AiModel => m !== null) : [];
  return { id, label, preset, endpoint, apiKey, enabled: v.enabled, extraModels };
}

function toConfig(value: unknown): AiConfig {
  const v = obj(value);
  const config = emptyConfig();
  if (!v) throw new Error("ai config: không phải object");
  if (Array.isArray(v.providers)) {
    config.providers = v.providers.map(toProvider).filter((p): p is AiProvider => p !== null);
  }
  const groups = obj(v.groups);
  for (const id of AI_GROUPS) {
    const g = obj(groups?.[id]);
    if (!g) continue;
    const chain = (Array.isArray(g.chain) ? g.chain : []).flatMap((link): AiChainLink[] => {
      const l = obj(link);
      const [providerId, modelId, effort] = [l?.providerId, l?.modelId, l?.effort].map(str);
      return providerId && modelId && effort ? [{ providerId, modelId, effort }] : [];
    });
    const timeoutMs = typeof g.timeoutMs === "number" ? g.timeoutMs : DEFAULT_TIMEOUT_MS;
    config.groups[id] = { chain, timeoutMs, budgetMs: typeof g.budgetMs === "number" ? g.budgetMs : timeoutMs };
  }
  return config;
}

/**
 * Đọc cấu hình. Thiếu secret, chưa có bản ghi, giải mã lỗi -> cấu hình rỗng (mọi nhóm chưa cấu hình).
 * `cacheTtl` cho phép KV cache ở edge (thay đổi có hiệu lực trong khoảng 1 phút).
 */
export async function loadAiConfig(kv: AiConfigKv, secret: string | undefined, cacheTtl?: number): Promise<AiConfig> {
  if (!secret) return emptyConfig();
  try {
    const blob = await kv.get(AI_CONFIG_KEY, cacheTtl ? { cacheTtl } : undefined);
    return blob ? await decryptConfig(blob, secret) : emptyConfig();
  } catch {
    return emptyConfig();
  }
}

export async function saveAiConfig(kv: AiConfigKv, secret: string, config: AiConfig): Promise<void> {
  await kv.put(AI_CONFIG_KEY, await encryptConfig(config, secret));
}

/** Một mắt xích đã phân giải: đủ thông tin để gọi. */
export interface AiTarget {
  label: string;
  endpoint: string;
  apiKey: string;
  modelId: string;
  effortStyle: EffortStyle;
  effort: string;
}

export interface AiRoute {
  group: AiGroupId;
  targets: AiTarget[];
  timeoutMs: number;
  budgetMs: number;
}

/**
 * Chuỗi của một nhóm -> các mắt xích gọi được, giữ thứ tự. Bỏ mắt xích trỏ tới provider tắt/thiếu key,
 * model không còn trong catalog hoặc effort model không nhận. `targets` rỗng = nhóm chưa cấu hình.
 */
export function resolveRoute(config: AiConfig, group: AiGroupId): AiRoute {
  const { chain, timeoutMs, budgetMs } = config.groups[group];
  const targets = chain.flatMap((link): AiTarget[] => {
    const provider = config.providers.find((p) => p.id === link.providerId);
    if (!provider?.enabled || !provider.apiKey) return [];
    const model = modelsOf(provider).find((m) => m.modelId === link.modelId);
    if (!model?.efforts.includes(link.effort)) return [];
    const { label, endpoint, apiKey } = provider;
    return [{ label, endpoint, apiKey, modelId: model.modelId, effortStyle: model.effortStyle, effort: link.effort }];
  });
  return { group, targets, timeoutMs, budgetMs };
}

/** Trường suy luận thêm vào body Chat Completions theo kiểu API của model. */
export function effortToBody(style: EffortStyle, effort: string): Record<string, unknown> {
  if (style === "deepseek") {
    return effort === "off" ? { thinking: { type: "disabled" } } : { thinking: { type: "enabled" }, reasoning_effort: effort };
  }
  if (style === "openai") return { reasoning_effort: effort };
  return {};
}

export type AiErrorCode = "ai_not_configured" | "ai_overloaded" | "ai_unavailable";

/** Lỗi gọi AI với thông điệp cố định (không mang nội dung/mã upstream). */
export class AiCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Thử lần lượt các mắt xích của nhóm; trả Response 2xx đầu tiên (caller tự đọc nội dung — không đọc được
 * là lỗi của caller, KHÔNG thử mục khác). Body = `buildBody(modelId)` + trường effort của mắt xích.
 * 401/402/403/429/5xx/lỗi mạng/timeout -> chuyển mục kế; 4xx khác (yêu cầu hỏng) -> dừng. Mỗi lượt chờ tối đa
 * `min(timeoutMs, thời gian còn lại của trần tổng)`; còn dưới MIN_ATTEMPT_MS thì dừng. Hết mục: 429 cuối
 * -> 503 quá tải, còn lại 502. Nhóm không có mắt xích nào -> 503.
 */
export async function callWithFailover(
  route: AiRoute,
  buildBody: (modelId: string) => Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<Response> {
  if (!route.targets.length) throw new AiCallError(503, "ai_not_configured", "Chưa cấu hình dịch vụ AI");
  const deadline = now() + route.budgetMs;
  let lastStatus = 0;
  for (const target of route.targets) {
    const remaining = deadline - now();
    if (remaining < MIN_ATTEMPT_MS) {
      logFailure(route, target, 0, "budget_exhausted");
      break;
    }
    let resp: Response;
    try {
      resp = await fetchImpl(target.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${target.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildBody(target.modelId), ...effortToBody(target.effortStyle, target.effort) }),
        signal: AbortSignal.timeout(Math.min(route.timeoutMs, remaining)),
      });
    } catch (e) {
      lastStatus = 0; // lỗi mạng / timeout
      logFailure(route, target, 0, e instanceof Error ? e.message : String(e));
      continue;
    }
    if (resp.ok) return resp;
    lastStatus = resp.status;
    // Đọc một đoạn ngắn thông báo lỗi chỉ để ghi log Worker; nội dung upstream không bao giờ trả ra ngoài.
    logFailure(route, target, resp.status, (await resp.text().catch(() => "")).slice(0, 300));
    // Chỉ chuyển mục khi lỗi thuộc về nhà cung cấp: khoá sai/hết tiền/bị chặn/quá tải/lỗi máy chủ.
    const s = resp.status;
    if (!(s === 401 || s === 402 || s === 403 || s === 429 || s >= 500)) break;
  }
  if (lastStatus === 429) throw new AiCallError(503, "ai_overloaded", "Dịch vụ AI đang quá tải, thử lại sau");
  throw new AiCallError(502, "ai_unavailable", "Dịch vụ AI tạm lỗi, thử lại sau");
}

/** Log vận hành (Workers Logs, chỉ chủ tài khoản xem): nhóm, mục nào lỗi, mã gì. Không ghi key. */
function logFailure(route: AiRoute, target: AiTarget, status: number, detail: string): void {
  console.warn(JSON.stringify({
    event: "ai_provider_failed",
    group: route.group,
    label: target.label,
    // Endpoint đã được kiểm là URL https hợp lệ khi admin lưu.
    host: new URL(target.endpoint).host,
    model: target.modelId,
    effort: target.effort,
    status,
    detail,
  }));
}
