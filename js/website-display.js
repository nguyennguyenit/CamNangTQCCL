import { L, currentLocale, normalizeLocale } from "./i18n.js";

const HASH = /^[0-9a-f]{64}$/;
const GENERATION = /^site-localization:[0-9a-f]{64}$/;
const decoder = new TextDecoder();
const encode = value => new TextEncoder().encode(value);
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map(value => value.toString(16).padStart(2, "0")).join("");
const asBytes = value => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return encode(value);
};

const immutable = value => {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = immutable(value[key]);
    return Object.freeze(value);
  }
  return value;
};

export const displayLocationKey = (entityId, fieldPath) => JSON.stringify([entityId, fieldPath]);

/** Nguồn `data/` mà `loadWebsiteDisplay` đã băm và đối chiếu, theo từng publication đã trả về. */
const verifiedSources = new WeakMap();

const publicPath = name => name === "website-display.json"
  ? "/data/website-display.json"
  : name.startsWith("data/")
    ? `/${name}`
    : `/data/${name.replace(/\.json$/, "")}.json`;

/**
 * Bộ nạp byte dùng chung của một trang: mỗi đường dẫn gọi mạng một lần dù nhiều bộ kiểm cùng đọc.
 * Nhận `website-display.json`, `data/<tên>.json` hoặc tên trần (`teams`, `teams.json`).
 * Lần tải lỗi bị bỏ khỏi bộ nhớ để "Thử lại" tải lại thật.
 */
export function createByteLoader(fetchImpl = globalThis.fetch) {
  const requests = new Map();
  return name => {
    const path = publicPath(name);
    if (!requests.has(path)) {
      const request = fetchImpl(path).then(async response => {
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      });
      requests.set(path, request);
      request.catch(() => { if (requests.get(path) === request) requests.delete(path); });
    }
    return requests.get(path);
  };
}

function dataPathParts(path) {
  const parts = [];
  let consumed = "";
  for (const match of path.matchAll(/(?:^|\.)([A-Za-z_$][\w$-]*)|\[(\d+)\]/g)) {
    consumed += match[0];
    parts.push(match[1] ?? Number(match[2]));
  }
  if (consumed !== path || !parts.length) throw new Error(L("Đường dẫn nội dung tiếng Việt không hợp lệ", "越南语内容路径无效"));
  return parts;
}

/**
 * Bản dữ liệu để hiển thị. Bản Việt áp lớp dịch đã duyệt lên nguồn; bản Trung (`locale` = `zh`) giữ
 * nguyên chữ nguồn, không áp lớp dịch — nhưng vẫn đòi nguồn đã được `loadWebsiteDisplay` băm khớp.
 */
export function localizeData(publication, sourcePath, source, locale = currentLocale()) {
  if (!verifiedSources.get(publication)?.has(sourcePath)) {
    throw new Error(`${L("Nguồn dữ liệu chưa được xác minh", "数据来源尚未验证")}: ${sourcePath}`);
  }
  const localized = structuredClone(source);
  if (normalizeLocale(locale) === "zh") return localized;
  const prefix = `data:${sourcePath}:`;
  for (const [key, value] of Object.entries(publication?.values || {})) {
    let location;
    try { location = JSON.parse(key); } catch { continue; }
    if (!Array.isArray(location) || !location[0]?.startsWith(prefix)) continue;
    const parts = dataPathParts(location[1]);
    let owner = localized;
    for (const part of parts.slice(0, -1)) {
      owner = owner?.[part];
      if (!owner || typeof owner !== "object") throw new Error(L("Không tìm thấy vị trí nội dung tiếng Việt", "找不到越南语内容的位置"));
    }
    const field = parts.at(-1);
    if (!(field in owner)) throw new Error(L("Không tìm thấy trường nội dung tiếng Việt", "找不到越南语内容字段"));
    owner[field] = value;
  }
  return localized;
}

/**
 * Nạp publication hiển thị đã pin rồi băm song song các nguồn `data/` trong `paths` (mặc định: mọi nguồn
 * publication khai). Chỉ nguồn đã băm khớp mới được `localizeData` áp bản dịch.
 */
export async function loadWebsiteDisplay(pin, loadBytes, recommendedPin, {paths} = {}) {
  if (!pin || !HASH.test(pin.sha256 || "") || !GENERATION.test(pin.generationId || "")) {
    throw new Error(L("Pin bản hiển thị không hợp lệ", "显示版本校验码无效"));
  }
  if (typeof loadBytes !== "function") throw new Error(L("Thiếu bộ nạp dữ liệu hiển thị", "缺少显示数据加载器"));
  const raw = await loadBytes("website-display.json");
  const bytes = asBytes(raw);
  if (await sha256(bytes) !== pin.sha256) throw new Error(L("Dữ liệu hiển thị không khớp mã kiểm tra", "显示数据与校验码不符"));
  let document;
  try { document = JSON.parse(decoder.decode(bytes)); } catch { throw new Error(L("Dữ liệu hiển thị không phải JSON hợp lệ", "显示数据不是有效的 JSON")); }
  const expectedRecommended = document?.recommendedPin;
  if (
    !document || document.schemaVersion !== 1 || document.generationId !== pin.generationId
    || Object.keys(document).sort().join(",") !== "generationId,recommendedPin,schemaVersion,sourceHashes,values"
    || !document.values || typeof document.values !== "object" || Array.isArray(document.values)
    || Object.entries(document.values).some(([key, value]) => {
      try {
        const location = JSON.parse(key);
        return !Array.isArray(location) || location.length !== 2
          || location.some(part => typeof part !== "string")
          || JSON.stringify(location) !== key || typeof value !== "string" || !value.trim();
      } catch { return true; }
    })
    || !document.sourceHashes || typeof document.sourceHashes !== "object" || Array.isArray(document.sourceHashes)
  ) throw new Error(L("Cấu trúc dữ liệu hiển thị không hợp lệ", "显示数据结构无效"));
  if (
    !recommendedPin || !expectedRecommended
    || expectedRecommended.schemaVersion !== recommendedPin.schemaVersion
    || expectedRecommended.generationId !== recommendedPin.generationId
    || expectedRecommended.manifestSha256 !== recommendedPin.manifestSha256
  ) throw new Error(L("Bản đội chuẩn không khớp dữ liệu hiển thị", "推荐阵容版本与显示数据不符"));
  for (const [path, expected] of Object.entries(document.sourceHashes)) {
    if (!/^data\/[^/]+\.json$/.test(path) || !HASH.test(expected)) throw new Error(L("Nguồn dữ liệu hiển thị không hợp lệ", "显示数据来源无效"));
  }
  const requested = [...new Set(paths ?? Object.keys(document.sourceHashes))];
  if (requested.some(path => !Object.hasOwn(document.sourceHashes, path))) throw new Error(L("Nguồn dữ liệu hiển thị không hợp lệ", "显示数据来源无效"));
  await Promise.all(requested.map(async path => {
    const sourceBytes = asBytes(await loadBytes(path));
    if (await sha256(sourceBytes) !== document.sourceHashes[path]) throw new Error(`${L("Nguồn dữ liệu đã thay đổi", "数据来源已变更")}: ${path}`);
  }));
  const publication = immutable(document);
  verifiedSources.set(publication, new Set(requested));
  return publication;
}

export function displayValue(publication, entityId, fieldPath) {
  const value = publication?.values?.[displayLocationKey(entityId, fieldPath)];
  if (typeof value !== "string" || !value.trim()) throw new Error(L("Nội dung tiếng Việt chưa sẵn sàng", "越南语内容尚未就绪"));
  return value;
}

const blank = value => typeof value !== "string" || !value.trim();

/**
 * Chọn chữ hiển thị giữa bản dịch Việt và chữ nguồn (Hán). Bản Trung ưu tiên chữ nguồn, bản Việt ưu tiên
 * bản dịch; thiếu bên ưu tiên thì lùi sang bên còn lại. Dùng cho cặp `displayNameVi`/`nameRaw`,
 * `tacticSlotsVi`/`tacticSlotsRaw`, `textVi`/`textRaw`…
 */
export function displayText(vi, raw, locale = currentLocale()) {
  const [first, second] = normalizeLocale(locale) === "zh" ? [raw, vi] : [vi, raw];
  return blank(first) ? second : first;
}

const nameKey = value => String(value).normalize("NFC").trim().toLocaleLowerCase("vi");

/**
 * Bộ tra tên Hán gốc từ tên Hán-Việt. Dữ liệu cũ (`teams.json`, `khaihoang.json`, `coexist.json`) chỉ lưu
 * tên Việt, nên bản Trung phải tra lại qua từ điển có trường `chinese` (heroes-dict, tactics, books-dict).
 * Khớp đúng `viet`/`hanViet` (không phân biệt hoa thường), rồi thử lại khi bỏ hậu tố dạng " (S)".
 * Ô gộp nhiều lựa chọn ("A/B") chỉ tra được khi mọi phần đều tra được; thiếu một phần thì trả null.
 */
export function createRawNameResolver(...dicts) {
  const index = new Map();
  for (const dict of dicts) {
    for (const entry of Array.isArray(dict) ? dict : []) {
      if (blank(entry?.chinese)) continue;
      for (const name of [entry.viet, entry.hanViet]) {
        if (!blank(name) && !index.has(nameKey(name))) index.set(nameKey(name), entry.chinese.trim());
      }
    }
  }
  const single = name => index.get(nameKey(name)) ?? index.get(nameKey(name.replace(/\s*\([^()]*\)\s*$/u, ""))) ?? null;
  return viName => {
    if (blank(viName)) return null;
    const whole = single(viName);
    if (whole !== null || !viName.includes("/")) return whole;
    const parts = viName.split("/").map(part => part.trim() ? single(part) : null);
    return parts.every(part => part !== null) ? parts.join("/") : null;
  };
}

/** Tên hiển thị theo ngôn ngữ: bản Trung dùng tên Hán gốc khi tra được, bản Việt giữ nguyên. */
export function localName(viName, resolver, locale = currentLocale()) {
  if (normalizeLocale(locale) !== "zh" || typeof resolver !== "function") return viName;
  return resolver(viName) ?? viName;
}

/** Từ điển có trường `chinese` dùng để tra tên Hán gốc cho bản Trung. */
export const RAW_NAME_SOURCES = Object.freeze(["data/heroes-dict.json", "data/tactics.json", "data/books-dict.json"]);

/**
 * Bộ tra tên Hán gốc cho trang hiện tại: bản Việt trả `null` và không tải gì; bản Trung tải ba từ điển
 * qua `loadBytes` (bộ nạp dùng chung của trang, nên nguồn đã tải cho Tra cứu không bị gọi mạng lại).
 */
export async function loadRawNameResolver(loadBytes, locale = currentLocale()) {
  if (normalizeLocale(locale) !== "zh") return null;
  const dicts = await Promise.all(RAW_NAME_SOURCES.map(async path => JSON.parse(decoder.decode(asBytes(await loadBytes(path))))));
  return createRawNameResolver(...dicts);
}
