import { L, contentLocaleIsVietnamese, currentLocale, pick } from "./i18n.js";
import { createTacticDisplayTable } from "./lookup-ids.js";
import { loadLookupJa } from "./lookup-data.js";
import { parseKanjiVariants, toShinjitai } from "./shinjitai.js";

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
  if (consumed !== path || !parts.length) throw new Error(L("Đường dẫn nội dung tiếng Việt không hợp lệ", "越南语内容路径无效", "ベトナム語コンテンツのパスが無効です"));
  return parts;
}

/**
 * Bản dữ liệu để hiển thị. Bản Việt áp lớp dịch đã duyệt lên nguồn; bản Trung (`locale` = `zh`) giữ
 * nguyên chữ nguồn, không áp lớp dịch — nhưng vẫn đòi nguồn đã được `loadWebsiteDisplay` băm khớp.
 */
export function localizeData(publication, sourcePath, source, locale = currentLocale()) {
  if (!verifiedSources.get(publication)?.has(sourcePath)) {
    throw new Error(`${L("Dữ liệu chưa được xác minh", "数据尚未验证", "データが未検証です")}: ${sourcePath}`);
  }
  const localized = structuredClone(source);
  if (!contentLocaleIsVietnamese(locale)) return localized;
  const prefix = `data:${sourcePath}:`;
  for (const [key, value] of Object.entries(publication?.values || {})) {
    let location;
    try { location = JSON.parse(key); } catch { continue; }
    if (!Array.isArray(location) || !location[0]?.startsWith(prefix)) continue;
    const parts = dataPathParts(location[1]);
    let owner = localized;
    for (const part of parts.slice(0, -1)) {
      owner = owner?.[part];
      if (!owner || typeof owner !== "object") throw new Error(L("Không tìm thấy vị trí nội dung tiếng Việt", "找不到越南语内容的位置", "ベトナム語コンテンツの位置が見つかりません"));
    }
    const field = parts.at(-1);
    if (!(field in owner)) throw new Error(L("Không tìm thấy trường nội dung tiếng Việt", "找不到越南语内容字段", "ベトナム語コンテンツの項目が見つかりません"));
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
    throw new Error(L("Pin bản hiển thị không hợp lệ", "显示版本校验码无效", "表示データの検証コードが無効です"));
  }
  if (typeof loadBytes !== "function") throw new Error(L("Thiếu bộ nạp dữ liệu hiển thị", "缺少显示数据加载器", "表示データの読み込み処理がありません"));
  const raw = await loadBytes("website-display.json");
  const bytes = asBytes(raw);
  if (await sha256(bytes) !== pin.sha256) throw new Error(L("Dữ liệu hiển thị không khớp mã kiểm tra", "显示数据与校验码不符", "表示データが検証コードと一致しません"));
  let document;
  try { document = JSON.parse(decoder.decode(bytes)); } catch { throw new Error(L("Dữ liệu hiển thị không phải JSON hợp lệ", "显示数据不是有效的 JSON", "表示データが有効な JSON ではありません")); }
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
  ) throw new Error(L("Cấu trúc dữ liệu hiển thị không hợp lệ", "显示数据结构无效", "表示データの構造が無効です"));
  if (
    !recommendedPin || !expectedRecommended
    || expectedRecommended.schemaVersion !== recommendedPin.schemaVersion
    || expectedRecommended.generationId !== recommendedPin.generationId
    || expectedRecommended.manifestSha256 !== recommendedPin.manifestSha256
  ) throw new Error(L("Bản đội chuẩn không khớp dữ liệu hiển thị", "推荐阵容版本与显示数据不符", "おすすめ編成のバージョンが表示データと一致しません"));
  for (const [path, expected] of Object.entries(document.sourceHashes)) {
    if (!/^data\/[^/]+\.json$/.test(path) || !HASH.test(expected)) throw new Error(L("Dữ liệu hiển thị không hợp lệ", "显示数据无效", "表示データが無効です"));
  }
  const requested = [...new Set(paths ?? Object.keys(document.sourceHashes))];
  if (requested.some(path => !Object.hasOwn(document.sourceHashes, path))) throw new Error(L("Dữ liệu hiển thị không hợp lệ", "显示数据无效", "表示データが無効です"));
  await Promise.all(requested.map(async path => {
    const sourceBytes = asBytes(await loadBytes(path));
    if (await sha256(sourceBytes) !== document.sourceHashes[path]) throw new Error(`${L("Dữ liệu đã thay đổi", "数据已变更", "データが変更されています")}: ${path}`);
  }));
  const publication = immutable(document);
  verifiedSources.set(publication, new Set(requested));
  return publication;
}

export function displayValue(publication, entityId, fieldPath) {
  const value = publication?.values?.[displayLocationKey(entityId, fieldPath)];
  if (typeof value !== "string" || !value.trim()) throw new Error(L("Nội dung tiếng Việt chưa sẵn sàng", "越南语内容尚未就绪", "ベトナム語コンテンツはまだ準備できていません"));
  return value;
}

const blank = value => typeof value !== "string" || !value.trim();

/**
 * Chọn chữ hiển thị giữa bản dịch Việt và chữ nguồn (Hán). Bản Trung ưu tiên chữ nguồn, bản Việt ưu tiên
 * bản dịch; bản Nhật ưu tiên chữ nguồn đã đổi tự dạng qua `resolver.fromRaw` (bộ tra của `loadRawNameResolver`, vắng thì
 * giữ chữ nguồn). Thiếu bên ưu tiên thì lùi sang bên còn lại. Dùng cho cặp `displayNameVi`/`nameRaw`,
 * `tacticSlotsVi`/`tacticSlotsRaw`…
 */
export function displayText(vi, raw, locale = currentLocale(), resolver = null) {
  const converted = blank(raw) ? raw : localRawName(raw, resolver, locale);
  const [first, second] = pick(locale, [vi, raw], [raw, vi], [converted, vi]);
  return blank(first) ? second : first;
}

const nameKey = value => String(value).normalize("NFC").trim().toLocaleLowerCase("vi");
/** Tên dạng "A/B" (ô gộp nhiều lựa chọn): tra được khi mọi phần đều tra được, thiếu một phần thì `null`. */
const joinedLookup = single => name => {
  if (blank(name)) return null;
  const whole = single(name);
  if (whole !== null || !name.includes("/")) return whole;
  const parts = name.split("/").map(part => part.trim() ? single(part) : null);
  return parts.every(part => part !== null) ? parts.join("/") : null;
};

/**
 * Bộ tra tên Hán gốc từ tên Hán-Việt. Dữ liệu cũ (`teams.json`, `khaihoang.json`, `coexist.json`) chỉ lưu
 * tên Việt, nên bản Trung phải tra lại qua từ điển có trường `chinese` (heroes-dict, tactics, books-dict).
 * Khớp đúng `viet`/`hanViet` (không phân biệt hoa thường), rồi thử lại khi bỏ hậu tố dạng " (S)".
 * Tên hiển thị hiện hành `viet` thắng `hanViet` trùng chữ của mục khác (như `createTacticNameIndex` của
 * `js/lookup-ids.js`): "Lập Lờ Đánh Tráo" là `viet` của 移花接木 nhưng là `hanViet` cũ của 暗渡陳倉.
 * Ô gộp nhiều lựa chọn ("A/B") chỉ tra được khi mọi phần đều tra được; thiếu một phần thì trả null.
 * `resolver.fromRaw(chữ Hán)` trả nguyên chữ (bản Trung hiện chữ nguồn).
 */
export function createRawNameResolver(...dicts) {
  const index = new Map();
  for (const field of ["viet", "hanViet"]) {
    for (const dict of dicts) {
      for (const entry of Array.isArray(dict) ? dict : []) {
        const name = entry?.[field];
        if (blank(entry?.chinese) || blank(name) || index.has(nameKey(name))) continue;
        index.set(nameKey(name), entry.chinese.trim());
      }
    }
  }
  const single = name => index.get(nameKey(name)) ?? index.get(nameKey(name.replace(/\s*\([^()]*\)\s*$/u, ""))) ?? null;
  return Object.assign(joinedLookup(single), { fromRaw: raw => raw });
}

/** Tiền tố bản cải tạo của chiến pháp (Việt, chữ Hán nguồn, tự dạng Nhật) → tiền tố của bản Nhật. */
const JA_TACTIC_PREFIX = Object.freeze({ Tinh: "精", Chuyển: "転", Thác: "拓", 精: "精", 轉: "転", 転: "転", 拓: "拓" });
const PREFIXED_RAW = /^(精|轉|転|拓)\s*[·・]\s*(.+)$/su;
const PREFIXED_VI = /^(Tinh|Chuyển|Thác)\s*[·・]\s*(.+)$/su;
const HAN = /[\u3400-\u9fff\uf900-\ufaff]/u;

/**
 * Bộ tra tên Nhật cho bản ja: tên Việt/Hán-Việt của từ điển (heroes-dict, tactics, books-dict) → mã → `entries[mã].name` của
 * `data/lookup-ja.json`; mã chưa có tên Nhật thì đổi tự dạng chữ Hán `chinese` của từ điển. Ô gộp "A/B" như `createRawNameResolver`.
 * - `resolver.fromRaw(chữ Hán thô)`: chữ Hán trùng `chinese` của một mục từ điển (nguyên dạng hoặc sau khi đổi tự dạng) → tên Nhật
 *   theo mã; chưa đối chiếu được (ô Đội chuẩn, tên đội `nameZh`) thì đổi tự dạng.
 * - `resolver.prefixed(tiền tố, tên)`: chiến pháp bản cải tạo (`Chuyển`/`轉`/`転`…): tên kịch bản của `prefixedTactics` khi có
 *   (`転・神算鬼謀`), không có thì `<tiền tố Nhật>・<tên Nhật>`; tên gốc không tra được thì `null`.
 * Cả hai lối vào nhận luôn dạng có tiền tố (`轉·刮骨療毒`, `Chuyển · Quát Cốt Liệu Độc`).
 * - `resolver.nameOf(mã)`: tên Nhật của một mục từ điển theo mã (`null` khi mã lạ).
 * @param {readonly unknown[][]} dicts
 * @param {{entries: Record<string, {name: string}>, prefixedTactics?: {baseId: string, name: string, prefix: string}[]}} jaDocument
 * @param {Readonly<Record<string, string>>} variants bảng của `parseKanjiVariants`
 */
export function createJaNameResolver(dicts, jaDocument, variants) {
  const entries = jaDocument?.entries ?? {};
  const shinjitai = raw => toShinjitai(raw, variants);
  const prefixedNames = new Map();
  for (const row of Array.isArray(jaDocument?.prefixedTactics) ? jaDocument.prefixedTactics : []) {
    const key = `${JA_TACTIC_PREFIX[row?.prefix] ?? row?.prefix}|${row?.baseId}`;
    if (typeof row?.name === "string" && !prefixedNames.has(key)) prefixedNames.set(key, row.name);
  }
  // Tên Việt/Hán-Việt → khóa mục, chữ Hán (nguyên dạng và tự dạng Nhật) → khóa mục; khóa mục → tên Nhật.
  const viIndex = new Map();
  const rawIndex = new Map();
  const names = new Map();
  const indexed = [];
  for (const dict of dicts) {
    for (const entry of Array.isArray(dict) ? dict : []) {
      const chinese = blank(entry?.chinese) ? null : entry.chinese.trim();
      const id = typeof entry?.id === "string" ? entry.id : chinese && `raw:${chinese}`;
      const name = id && Object.hasOwn(entries, id) ? entries[id].name : chinese ? shinjitai(chinese) : null;
      if (!name) continue;
      if (!names.has(id)) names.set(id, name);
      indexed.push([entry, id]);
      for (const key of [chinese, shinjitai(chinese)]) if (!rawIndex.has(key)) rawIndex.set(key, id);
    }
  }
  // `viet` của mọi mục thắng `hanViet` trùng chữ của mục khác, cùng thứ tự với `createRawNameResolver`.
  for (const field of ["viet", "hanViet"]) {
    for (const [entry, id] of indexed) {
      const key = entry[field];
      if (!blank(key) && !viIndex.has(nameKey(key))) viIndex.set(nameKey(key), id);
    }
  }
  const viId = name => viIndex.get(nameKey(name)) ?? viIndex.get(nameKey(name.replace(/\s*\([^()]*\)\s*$/u, ""))) ?? null;
  const rawId = raw => rawIndex.get(raw) ?? rawIndex.get(shinjitai(raw)) ?? null;
  const prefixed = (prefix, value) => {
    const jaPrefix = JA_TACTIC_PREFIX[prefix];
    if (!jaPrefix || blank(value)) return null;
    const base = value.trim();
    const id = viId(base) ?? rawId(base);
    const scenario = id ? prefixedNames.get(`${jaPrefix}|${id}`) : null;
    if (scenario) return scenario;
    const name = id ? names.get(id) : HAN.test(base) ? shinjitai(base) : null;
    return name ? `${jaPrefix}・${name}` : null;
  };
  const single = name => {
    const modified = name.match(PREFIXED_VI);
    if (modified) return prefixed(modified[1], modified[2]);
    const id = viId(name);
    return id ? names.get(id) : null;
  };
  const fromRaw = raw => {
    if (typeof raw !== "string") return raw;
    const trimmed = raw.trim();
    const modified = trimmed.match(PREFIXED_RAW);
    if (modified) return prefixed(modified[1], modified[2]) ?? shinjitai(raw);
    const id = rawId(trimmed);
    return id ? names.get(id) : shinjitai(raw);
  };
  const nameOf = id => (typeof id === "string" ? names.get(id) ?? null : null);
  return Object.assign(joinedLookup(single), { fromRaw, prefixed, nameOf });
}

/** Tên hiển thị theo ngôn ngữ: bản không phải tiếng Việt dùng tên của bộ tra (chữ Hán gốc / tên Nhật) khi tra được, bản Việt giữ nguyên. */
export function localName(viName, resolver, locale = currentLocale()) {
  if (contentLocaleIsVietnamese(locale) || typeof resolver !== "function") return viName;
  return resolver(viName) ?? viName;
}

/**
 * Tên hiển thị của một mục từ điển (`{id, viet, chinese}`) theo locale: bản Việt `viet`, bản Trung chữ Hán `chinese`, bản Nhật tên
 * Nhật theo mã qua bộ tra của `loadRawNameResolver` (vắng bộ tra thì chữ Hán). Thiếu chữ Hán thì lùi về `viet`.
 */
export function localRecordName(record, resolver, locale = currentLocale()) {
  if (!record) return "";
  const chinese = String(record.chinese || "").trim();
  if (contentLocaleIsVietnamese(locale) || !chinese) return record.viet || "";
  return resolver?.nameOf?.(record.id) ?? localRawName(chinese, resolver, locale) ?? chinese;
}

/** Chữ Hán thô (chưa đối chiếu từ điển) cho bản đang xem: bản Nhật đổi tự dạng qua `resolver.fromRaw`, bản khác giữ nguyên. */
export function localRawName(raw, resolver, locale = currentLocale()) {
  if (contentLocaleIsVietnamese(locale) || typeof resolver?.fromRaw !== "function") return raw;
  return resolver.fromRaw(raw);
}

/** Từ điển có trường `chinese` dùng để tra tên Hán gốc cho bản Trung. */
export const RAW_NAME_SOURCES = Object.freeze(["data/heroes-dict.json", "data/tactics.json", "data/books-dict.json"]);

/** Pin `data/lookup-ja.json` mà build nhúng ở trang `/ja/` (`<script type="application/json" id="lookup-ja-pin">`). */
export function readLookupJaPin(documentTarget = globalThis.document) {
  const text = documentTarget?.querySelector?.("#lookup-ja-pin")?.textContent;
  if (!text) return null;
  try {
    const pin = JSON.parse(text);
    return typeof pin === "string" ? pin : null;
  } catch {
    return null;
  }
}

/**
 * Bộ tra tên cho trang hiện tại: bản Việt trả `null` và không tải gì; bản Trung tải ba từ điển qua `loadBytes` (bộ nạp dùng
 * chung của trang, nên nguồn đã tải cho Tra cứu không bị gọi mạng lại) và tra chữ Hán gốc; bản Nhật tải thêm
 * `data/lookup-ja.json` (khớp pin của trang) và bảng tự dạng, tra tên Nhật; lớp ja lỗi (thiếu/lệch pin, lệch thế hệ, lỗi mạng)
 * thì tra chữ Hán nguồn đã đổi tự dạng, không bao giờ lùi về tên Việt. Chỉ khi chính từ điển lỗi thì Promise lỗi.
 */
export async function loadRawNameResolver(loadBytes, locale = currentLocale(), { pin = readLookupJaPin() } = {}) {
  if (contentLocaleIsVietnamese(locale)) return null;
  const dictsPromise = Promise.all(RAW_NAME_SOURCES.map(async path => JSON.parse(decoder.decode(asBytes(await loadBytes(path))))));
  const kind = pick(locale, "vi", "source", "ja");
  if (kind !== "ja") return createRawNameResolver(...await dictsPromise);
  // Lớp ja (tên Nhật theo mã + bảng tự dạng đã khớp hash) lỗi thì không kéo cả bộ tra xuống: trang ja không được hiện tên Việt.
  const jaLayer = loadLookupJa(loadBytes, pin, { withVariants: true })
    .then(({ document, variants }) => ({ document, variants: parseKanjiVariants(variants) }))
    .catch(() => null);
  const [dicts, layer] = await Promise.all([dictsPromise, jaLayer]);
  if (layer) return createJaNameResolver(dicts, layer.document, layer.variants);
  return createJaNameResolver(dicts, null, await loadFallbackKanjiVariants(loadBytes));
}

/**
 * Bảng tự dạng khi lớp ja không nạp được (lệch pin/thế hệ, lỗi mạng): đọc thẳng `data/ja-kanji-variants.json` (không còn hash
 * của `lookup-ja.json` để đối chiếu, bảng vẫn qua `parseKanjiVariants`). Bảng cũng lỗi thì bảng rỗng: tên giữ chữ Hán nguồn.
 */
async function loadFallbackKanjiVariants(loadBytes) {
  try {
    return parseKanjiVariants(JSON.parse(decoder.decode(asBytes(await loadBytes("data/ja-kanji-variants.json")))));
  } catch {
    return Object.freeze({});
  }
}

/**
 * Bộ đổi tên chiến pháp lưu → tên Việt hiện hành cho bản Việt, đọc bảng nhúng `#tactic-display-names` của trang (tính
 * lúc build, cùng bảng với bản dựng sẵn). Trang không nhúng hoặc bảng hỏng thì `null` (tên lưu hiển thị nguyên).
 */
export function readTacticDisplayTable(documentTarget = globalThis.document) {
  const text = documentTarget?.querySelector?.("#tactic-display-names")?.textContent;
  if (!text) return null;
  try {
    return createTacticDisplayTable(JSON.parse(text));
  } catch {
    return null;
  }
}
