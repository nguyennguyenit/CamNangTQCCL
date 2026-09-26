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
  if (consumed !== path || !parts.length) throw new Error("Đường dẫn nội dung tiếng Việt không hợp lệ");
  return parts;
}

export function localizeData(publication, sourcePath, source) {
  if (!verifiedSources.get(publication)?.has(sourcePath)) throw new Error(`Nguồn dữ liệu chưa được xác minh: ${sourcePath}`);
  const localized = structuredClone(source);
  const prefix = `data:${sourcePath}:`;
  for (const [key, value] of Object.entries(publication?.values || {})) {
    let location;
    try { location = JSON.parse(key); } catch { continue; }
    if (!Array.isArray(location) || !location[0]?.startsWith(prefix)) continue;
    const parts = dataPathParts(location[1]);
    let owner = localized;
    for (const part of parts.slice(0, -1)) {
      owner = owner?.[part];
      if (!owner || typeof owner !== "object") throw new Error("Không tìm thấy vị trí nội dung tiếng Việt");
    }
    const field = parts.at(-1);
    if (!(field in owner)) throw new Error("Không tìm thấy trường nội dung tiếng Việt");
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
    throw new Error("Pin bản hiển thị không hợp lệ");
  }
  if (typeof loadBytes !== "function") throw new Error("Thiếu bộ nạp dữ liệu hiển thị");
  const raw = await loadBytes("website-display.json");
  const bytes = asBytes(raw);
  if (await sha256(bytes) !== pin.sha256) throw new Error("Dữ liệu hiển thị không khớp mã kiểm tra");
  let document;
  try { document = JSON.parse(decoder.decode(bytes)); } catch { throw new Error("Dữ liệu hiển thị không phải JSON hợp lệ"); }
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
  ) throw new Error("Cấu trúc dữ liệu hiển thị không hợp lệ");
  if (
    !recommendedPin || !expectedRecommended
    || expectedRecommended.schemaVersion !== recommendedPin.schemaVersion
    || expectedRecommended.generationId !== recommendedPin.generationId
    || expectedRecommended.manifestSha256 !== recommendedPin.manifestSha256
  ) throw new Error("Bản đội chuẩn không khớp dữ liệu hiển thị");
  for (const [path, expected] of Object.entries(document.sourceHashes)) {
    if (!/^data\/[^/]+\.json$/.test(path) || !HASH.test(expected)) throw new Error("Nguồn dữ liệu hiển thị không hợp lệ");
  }
  const requested = [...new Set(paths ?? Object.keys(document.sourceHashes))];
  if (requested.some(path => !Object.hasOwn(document.sourceHashes, path))) throw new Error("Nguồn dữ liệu hiển thị không hợp lệ");
  await Promise.all(requested.map(async path => {
    const sourceBytes = asBytes(await loadBytes(path));
    if (await sha256(sourceBytes) !== document.sourceHashes[path]) throw new Error(`Nguồn dữ liệu đã thay đổi: ${path}`);
  }));
  const publication = immutable(document);
  verifiedSources.set(publication, new Set(requested));
  return publication;
}

export function displayValue(publication, entityId, fieldPath) {
  const value = publication?.values?.[displayLocationKey(entityId, fieldPath)];
  if (typeof value !== "string" || !value.trim()) throw new Error("Nội dung tiếng Việt chưa sẵn sàng");
  return value;
}
