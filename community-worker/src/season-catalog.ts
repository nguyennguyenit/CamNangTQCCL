// Danh mục mùa của Đội cộng đồng = `seasonOptions` của Đội chuẩn đang publish trên site.
// Đọc lúc chạy (worker deploy tay nên không bundle được mùa mới), theo đúng chuỗi xác minh của frontend
// (`loadVerifiedRecommendedManifest` trong js/recommended-reference-state.js):
//   current.json -> <gen>/manifest.json (sha256 = manifestSha256) -> <gen>/seasons.json (sha256 + bytes theo manifest).
// Cache trong isolate chỉ để giảm độ trễ; không phải bản bền.

import type { Ctx } from "./context";
import { siteOrigin, type Env } from "./env";
import { ApiError } from "./http";

export interface CatalogSeason {
  id: string;
  code: string;
  labelVi: string;
  labelZh: string;
}

export interface SeasonCatalog {
  generationId: string;
  /** Mùa hiện hành của Đội chuẩn (`defaultSourceSeasonId`), không phải phần tử đầu danh sách. */
  current: string;
  /** Theo thứ tự `seasonOptions`. */
  seasons: CatalogSeason[];
}

/** Bản cache còn mới trong khoảng này thì không fetch lại. */
export const CATALOG_TTL_MS = 10 * 60_000;
/** Sau một lần fetch (thành công hay lỗi), trong khoảng này không fetch lại khi gặp mùa lạ / khi đang lỗi. */
export const CATALOG_COOLDOWN_MS = 30_000;
/** Hạn chót cho cả chuỗi 3 lượt fetch. */
export const CATALOG_DEADLINE_MS = 5_000;

const CATALOG_PATH = "/data/recommended/";
const HASH_RE = /^[0-9a-f]{64}$/u;

/**
 * Origin đọc catalog. Tách khỏi chỗ dùng `SITE_ORIGIN` khác (Better Auth, CORS): nếu fetch ngược zone bị chặn,
 * chỉ đổi hàm này (vd sang https://tqccl.pages.dev).
 */
export function catalogOrigin(env: Env): string {
  return siteOrigin(env);
}

/** Luật id mùa = CHECK của D1 (`id glob '[a-z0-9]*' and length(id) between 1 and 40`), khác `all` (giá trị lọc). */
export function isSeasonId(value: unknown): value is string {
  if (typeof value !== "string" || value === "all") return false;
  const length = Array.from(value).length;
  return length >= 1 && length <= 40 && /^[a-z0-9]/u.test(value);
}

export const catalogUnavailable = () =>
  new ApiError(503, "season_catalog_unavailable", "Chưa tải được danh sách mùa, thử lại sau");

class CatalogError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function parseJson(bytes: Uint8Array, step: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CatalogError(`${step}: JSON hỏng`);
  }
}

/** Dựng danh mục từ `seasons.json` đã xác minh hash; sai hình dạng -> lỗi (không bỏ qua phần tử hỏng). */
export function parseSeasonsJson(raw: unknown, generationId: string): SeasonCatalog {
  if (!isObj(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.seasonOptions) || !raw.seasonOptions.length) {
    throw new CatalogError("seasons.json: sai schema");
  }
  const seen = new Set<string>();
  const seasons = raw.seasonOptions.map((option): CatalogSeason => {
    if (!isObj(option) || !isSeasonId(option.sourceSeasonId) || seen.has(option.sourceSeasonId)) {
      throw new CatalogError("seasons.json: sourceSeasonId sai hoặc trùng");
    }
    if (!nonEmpty(option.displayCode) || !nonEmpty(option.nameRaw)) throw new CatalogError("seasons.json: thiếu nhãn mùa");
    seen.add(option.sourceSeasonId);
    const nameVi = nonEmpty(option.displayNameVi) ? option.displayNameVi : option.nameRaw;
    return {
      id: option.sourceSeasonId,
      code: option.displayCode,
      labelVi: `${option.displayCode} · ${nameVi}`,
      labelZh: `${option.displayCode} · ${option.nameRaw}`,
    };
  });
  if (typeof raw.defaultSourceSeasonId !== "string" || !seen.has(raw.defaultSourceSeasonId)) {
    throw new CatalogError("seasons.json: defaultSourceSeasonId không thuộc danh sách");
  }
  return { generationId, current: raw.defaultSourceSeasonId, seasons };
}

async function fetchCatalog(fetchImpl: typeof fetch, origin: string): Promise<SeasonCatalog> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_DEADLINE_MS);
  const get = async (name: string): Promise<Uint8Array> => {
    let res: Response;
    try {
      res = await fetchImpl(`${origin}${CATALOG_PATH}${name}`, { signal: controller.signal });
    } catch (e) {
      throw new CatalogError(`${name}: ${controller.signal.aborted ? "quá hạn" : String(e)}`);
    }
    if (res.status !== 200) throw new CatalogError(`${name}: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
  try {
    const pin = parseJson(await get("current.json"), "current.json");
    if (!isObj(pin) || pin.schemaVersion !== 1 || typeof pin.generationId !== "string" || !HASH_RE.test(pin.generationId)
      || typeof pin.manifestSha256 !== "string" || !HASH_RE.test(pin.manifestSha256)) {
      throw new CatalogError("current.json: sai schema");
    }
    const generationId = pin.generationId;
    const manifestBytes = await get(`${generationId}/manifest.json`);
    if ((await sha256Hex(manifestBytes)) !== pin.manifestSha256) throw new CatalogError("manifest.json: sai sha256");
    const manifest = parseJson(manifestBytes, "manifest.json");
    if (!isObj(manifest) || manifest.schemaVersion !== 1 || manifest.generationId !== generationId || manifest.dedupKeyVersion !== 1) {
      throw new CatalogError("manifest.json: sai định danh");
    }
    const expected = isObj(manifest.files) ? manifest.files["seasons.json"] : undefined;
    if (!isObj(expected) || typeof expected.sha256 !== "string" || typeof expected.bytes !== "number") {
      throw new CatalogError("manifest.json: thiếu seasons.json");
    }
    const seasonsBytes = await get(`${generationId}/seasons.json`);
    if (seasonsBytes.byteLength !== expected.bytes || (await sha256Hex(seasonsBytes)) !== expected.sha256) {
      throw new CatalogError("seasons.json: sai sha256/bytes");
    }
    return parseSeasonsJson(parseJson(seasonsBytes, "seasons.json"), generationId);
  } finally {
    clearTimeout(timer);
  }
}

interface CacheState {
  value: SeasonCatalog | null;
  fetchedAt: number;
  failedAt: number | null;
  inflight: Promise<SeasonCatalog> | null;
}

let cache: CacheState = { value: null, fetchedAt: 0, failedAt: null, inflight: null };

/** Chỉ dùng trong test: mỗi harness bắt đầu với cache rỗng. */
export function resetSeasonCatalogCache(): void {
  cache = { value: null, fetchedAt: 0, failedAt: null, inflight: null };
}

/** Một lượt fetch dùng chung cho mọi request đồng thời; lỗi không ghi đè bản tốt. */
function refresh(c: Ctx): Promise<SeasonCatalog> {
  if (cache.inflight) return cache.inflight;
  const state = cache;
  const { fetchImpl, now } = c.get("deps");
  state.inflight = fetchCatalog(fetchImpl, catalogOrigin(c.env))
    .then(
      (value) => {
        Object.assign(state, { value, fetchedAt: now(), failedAt: null });
        return value;
      },
      (error: unknown) => {
        state.failedAt = now();
        console.error("season-catalog: refresh failed", error instanceof Error ? error.message : error);
        throw error;
      },
    )
    .finally(() => {
      state.inflight = null;
    });
  return state.inflight;
}

/** Danh mục hiện hành; lỗi mà còn bản cũ -> bản cũ; không có bản nào -> 503 (lỗi gần đây thì không fetch lại). */
export async function loadSeasonCatalog(c: Ctx): Promise<SeasonCatalog> {
  const now = c.get("deps").now();
  if (cache.value && now - cache.fetchedAt < CATALOG_TTL_MS) return cache.value;
  if (cache.failedAt !== null && now - cache.failedAt < CATALOG_COOLDOWN_MS) {
    if (cache.value) return cache.value;
    throw catalogUnavailable();
  }
  try {
    return await refresh(c);
  } catch {
    if (cache.value) return cache.value;
    throw catalogUnavailable();
  }
}

/**
 * Tìm mùa theo id. `null` chỉ khi một lượt fetch THÀNH CÔNG gần đây (trong cooldown) xác nhận không có;
 * không xác nhận được (lỗi/đang cooldown lỗi) -> 503. Mùa lạ với bản cache cũ -> fetch lại một lần trước khi kết luận
 * (isolate khác có thể đã thấy mùa mới).
 */
export async function findSeason(c: Ctx, id: string): Promise<CatalogSeason | null> {
  const catalog = await loadSeasonCatalog(c);
  const hit = catalog.seasons.find((s) => s.id === id);
  if (hit) return hit;
  const now = c.get("deps").now();
  if (now - cache.fetchedAt < CATALOG_COOLDOWN_MS) return null;
  if (cache.failedAt !== null && now - cache.failedAt < CATALOG_COOLDOWN_MS) throw catalogUnavailable();
  let fresh: SeasonCatalog;
  try {
    fresh = await refresh(c);
  } catch {
    throw catalogUnavailable();
  }
  return fresh.seasons.find((s) => s.id === id) ?? null;
}
