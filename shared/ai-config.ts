// Danh sách nhà cung cấp AI (OpenAI-compatible Chat Completions) dùng chung cho `worker/` và
// `community-worker/`. Admin nhập ở tab AI (/quan-tri/); lưu MỘT bản ghi KV `ai:providers`,
// mã hoá AES-GCM với khoá dẫn xuất HKDF từ secret `AI_CONFIG_SECRET` (cùng giá trị ở cả hai Worker).
// Thứ tự mảng = thứ tự ưu tiên khi failover.

export interface AiProvider {
  id: string;
  label: string;
  endpoint: string;
  modelId: string;
  apiKey: string;
  enabled: boolean;
}

/** Phần KV cần dùng (KVNamespace của Workers thoả mãn). */
export interface AiConfigKv {
  get(key: string, options?: { cacheTtl?: number }): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export const AI_PROVIDERS_KEY = "ai:providers";
export const MAX_PROVIDERS = 10;
export const MAX_ID_CHARS = 64;
export const MAX_LABEL_CHARS = 80;
export const MAX_ENDPOINT_CHARS = 500;
export const MAX_MODEL_ID_CHARS = 120;
export const MAX_API_KEY_CHARS = 500;
/** Thời gian chờ mỗi lần gọi một nhà cung cấp trước khi chuyển mục kế. */
export const PROVIDER_TIMEOUT_MS = 45_000;

const encoder = new TextEncoder();
const HKDF_SALT = encoder.encode("tqccl-ai-config");
const HKDF_INFO = encoder.encode("ai:providers v1");

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

/** Mã hoá danh sách -> chuỗi JSON `{v, iv, data}` (IV ngẫu nhiên 12 byte mỗi lần ghi). */
export async function encryptProviders(providers: AiProvider[], secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(providers)));
  return JSON.stringify({ v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(data)) });
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Nhận một mục đã giải mã; sai hình dạng -> null (bị bỏ qua). */
function toProvider(value: unknown): AiProvider | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const id = str(v.id);
  const label = str(v.label);
  const endpoint = str(v.endpoint);
  const modelId = str(v.modelId);
  const apiKey = str(v.apiKey);
  if (!id || label === null || !endpoint || !modelId || !apiKey || typeof v.enabled !== "boolean") return null;
  return { id, label, endpoint, modelId, apiKey, enabled: v.enabled };
}

/** Giải mã bản ghi KV; sai secret/hỏng dữ liệu -> ném lỗi. */
export async function decryptProviders(blob: string, secret: string): Promise<AiProvider[]> {
  const parsed: unknown = JSON.parse(blob);
  const rec = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const iv = str(rec.iv);
  const data = str(rec.data);
  if (rec.v !== 1 || !iv || !data) throw new Error("ai config: bản ghi không hợp lệ");
  const key = await deriveKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(data));
  const list: unknown = JSON.parse(new TextDecoder().decode(plain));
  if (!Array.isArray(list)) throw new Error("ai config: không phải danh sách");
  return list.map(toProvider).filter((p): p is AiProvider => p !== null);
}

/**
 * Đọc toàn bộ danh sách (kể cả mục tắt). Thiếu secret, chưa có bản ghi, giải mã lỗi -> [] (coi như
 * chưa cấu hình). `cacheTtl` cho phép KV cache ở edge (thay đổi có hiệu lực trong khoảng 1 phút).
 */
export async function loadProviders(kv: AiConfigKv, secret: string | undefined, cacheTtl?: number): Promise<AiProvider[]> {
  if (!secret) return [];
  try {
    const blob = await kv.get(AI_PROVIDERS_KEY, cacheTtl ? { cacheTtl } : undefined);
    return blob ? await decryptProviders(blob, secret) : [];
  } catch {
    return [];
  }
}

/** Mục đang bật, giữ thứ tự ưu tiên. Rỗng = chưa cấu hình. */
export function activeProviders(providers: AiProvider[]): AiProvider[] {
  return providers.filter((p) => p.enabled && p.apiKey && p.endpoint && p.modelId);
}

export async function saveProviders(kv: AiConfigKv, secret: string, providers: AiProvider[]): Promise<void> {
  await kv.put(AI_PROVIDERS_KEY, await encryptProviders(providers, secret));
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
 * Thử lần lượt các mục đang bật; trả Response 2xx đầu tiên (caller tự đọc nội dung — không đọc được
 * là lỗi của caller, KHÔNG thử mục khác). 401/402/403/429/5xx/lỗi mạng/timeout -> chuyển mục kế;
 * 4xx khác (yêu cầu hỏng) -> dừng. Hết mục: 429 cuối -> 503 quá tải, còn lại 502. Không mục nào bật -> 503.
 */
export async function callWithFailover(
  providers: AiProvider[],
  buildBody: (modelId: string) => unknown,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = PROVIDER_TIMEOUT_MS,
): Promise<Response> {
  const active = activeProviders(providers);
  if (!active.length) throw new AiCallError(503, "ai_not_configured", "Chưa cấu hình dịch vụ AI");
  let lastStatus = 0;
  for (const provider of active) {
    let resp: Response;
    try {
      resp = await fetchImpl(provider.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(provider.modelId)),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      lastStatus = 0; // lỗi mạng / timeout
      logProviderFailure(provider, 0, e instanceof Error ? e.message : String(e));
      continue;
    }
    if (resp.ok) return resp;
    lastStatus = resp.status;
    // Đọc một đoạn ngắn thông báo lỗi chỉ để ghi log Worker; nội dung upstream không bao giờ trả ra ngoài.
    logProviderFailure(provider, resp.status, (await resp.text().catch(() => "")).slice(0, 300));
    // Chỉ chuyển mục khi lỗi thuộc về nhà cung cấp: khoá sai/hết tiền/bị chặn/quá tải/lỗi máy chủ.
    const s = resp.status;
    if (!(s === 401 || s === 402 || s === 403 || s === 429 || s >= 500)) break;
  }
  if (lastStatus === 429) throw new AiCallError(503, "ai_overloaded", "Dịch vụ AI đang quá tải, thử lại sau");
  throw new AiCallError(502, "ai_unavailable", "Dịch vụ AI tạm lỗi, thử lại sau");
}

/** Log vận hành (Workers Logs, chỉ chủ tài khoản xem): mục nào lỗi, mã gì. Không ghi key. */
function logProviderFailure(provider: AiProvider, status: number, detail: string): void {
  console.warn(JSON.stringify({
    event: "ai_provider_failed",
    label: provider.label,
    // Endpoint đã được kiểm là URL https hợp lệ khi admin lưu.
    host: new URL(provider.endpoint).host,
    model: provider.modelId,
    status,
    detail,
  }));
}
