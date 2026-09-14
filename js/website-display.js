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

export async function loadWebsiteDisplay(pin, loadBytes, recommendedPin) {
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
    const source = await loadBytes(path);
    const sourceBytes = asBytes(source);
    if (await sha256(sourceBytes) !== expected) throw new Error(`Nguồn dữ liệu đã thay đổi: ${path}`);
  }
  return immutable(document);
}

export function displayValue(publication, entityId, fieldPath) {
  const value = publication?.values?.[displayLocationKey(entityId, fieldPath)];
  if (typeof value !== "string" || !value.trim()) throw new Error("Nội dung tiếng Việt chưa sẵn sàng");
  return value;
}
