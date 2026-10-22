// Phần thuần của ledger slug trang riêng Tra cứu (`pipeline/lookup-route-handles.json`): kiểm schema/pin/`handlesSha256`
// rồi đưa ra route từng mục. Dùng chung cho site (`src/lib/lookup-detail-routes.ts`) và builder của mcp-worker
// (chỉ Node: `node:crypto`); không đọc file, không đụng trạng thái toàn cục của `lookup-ids.js`.
import { createHash } from "node:crypto";
import { LOOKUP_GROUP_SLUGS, lookupDerivedSlug } from "./lookup-ids.js";

const LEDGER_SCHEMA_VERSION = 1;
const LEDGER_KEYS = ["booksSha256", "generationId", "handles", "handlesSha256", "note", "retired", "schemaVersion"];
const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @typedef {keyof typeof LOOKUP_GROUP_SLUGS} LookupRouteGroup
 * @typedef {{id: string, group: LookupRouteGroup, slug: string, path: string}} LookupDetailRoute
 * @typedef {{entries: LookupDetailRoute[], byId: Map<string, LookupDetailRoute>, exceptions: Record<string, string>}} LookupDetailRoutes
 */

/** @param {LookupRouteGroup} group @param {string} slug */
export const lookupDetailPath = (group, slug) => `/tra-cuu/${LOOKUP_GROUP_SLUGS[group]}/${encodeURIComponent(slug)}/`;

/** @returns {value is Record<string, any>} */
const plainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/** Canonical JSON khớp `handles_digest` của Python: khoá sắp theo thứ tự code point, không khoảng trắng. */
/** @param {unknown} value @returns {string} */
function canonicalJson(value) {
  if (plainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Exact key-set comparison that names the keys which are missing or no longer in the corpus. */
/** @param {string[]} actual @param {string[]} expected @param {string} label */
function exactKeySet(actual, expected, label) {
  const have = new Set(actual);
  const want = new Set(expected);
  const missing = expected.filter((key) => !have.has(key));
  const unknown = actual.filter((key) => !want.has(key));
  if (missing.length || unknown.length) {
    throw new Error(`${label}: missing ${JSON.stringify(missing.slice(0, 5))} (${missing.length}), unknown ${JSON.stringify(unknown.slice(0, 5))} (${unknown.length})`);
  }
}

/**
 * Kiểm ledger đã parse với id của corpus (`{nhóm: [id…]}`): schema, đúng 7 nhóm, đúng tập id, slug đúng dạng và
 * duy nhất trong nhóm, `handlesSha256` (phủ `handles` + `retired`) khớp (bắt sửa tay). `retired` (id đã rời corpus,
 * slug còn giữ chỗ) không tạo route nhưng slug của nó không được trùng slug đang dùng. `generationId`/`booksSha256`
 * (nếu truyền) phải khớp pin.
 */
/**
 * @param {unknown} raw
 * @param {Record<string, string[]>} corpusIds
 * @param {{generationId?: string, booksSha256?: string}} [pins]
 * @returns {LookupDetailRoutes}
 */
export function parseLookupDetailLedger(raw, corpusIds, pins = {}) {
  const label = "lookup route ledger";
  if (!plainObject(raw)) throw new Error(`${label} must be an object`);
  exactKeySet(Object.keys(raw), LEDGER_KEYS, `${label} keys`);
  if (raw.schemaVersion !== LEDGER_SCHEMA_VERSION) throw new Error(`${label} schemaVersion must be ${LEDGER_SCHEMA_VERSION}`);
  if (pins.generationId !== undefined && raw.generationId !== pins.generationId) throw new Error(`${label} generationId does not match the lookup publication`);
  if (pins.booksSha256 !== undefined && raw.booksSha256 !== pins.booksSha256) throw new Error(`${label} booksSha256 does not match books-dict`);
  const { handles, retired } = raw;
  if (!plainObject(handles)) throw new Error(`${label} handles must be an object`);
  if (!plainObject(retired)) throw new Error(`${label} retired must be an object`);
  /** @type {LookupRouteGroup[]} */
  const groups = /** @type {any} */ (Object.keys(LOOKUP_GROUP_SLUGS));
  exactKeySet(Object.keys(handles), groups, `${label} groups`);
  exactKeySet(Object.keys(retired), groups, `${label} retired groups`);
  exactKeySet(Object.keys(corpusIds), groups, "lookup corpus groups");
  const digest = createHash("sha256").update(canonicalJson({ handles, retired }), "utf8").digest("hex");
  if (raw.handlesSha256 !== digest) throw new Error(`${label} handlesSha256 does not match handles and retired`);

  /** @type {LookupDetailRoute[]} */
  const entries = [];
  /** @type {Map<string, LookupDetailRoute>} */
  const byId = new Map();
  for (const group of groups) {
    const groupHandles = handles[group];
    const groupRetired = retired[group];
    if (!plainObject(groupHandles)) throw new Error(`${label} ${group} must be an object`);
    if (!plainObject(groupRetired)) throw new Error(`${label} ${group} retired must be an object`);
    exactKeySet(Object.keys(groupHandles), corpusIds[group], `${label} ${group}`);
    /** @type {Map<string, string>} */
    const taken = new Map();
    for (const [id, slug] of Object.entries(groupRetired)) {
      if (typeof slug !== "string" || !SLUG_SHAPE.test(slug)) throw new Error(`${label} ${group} retired ${id}: slug ${JSON.stringify(slug)} is not a lowercase ASCII slug`);
      if (Object.hasOwn(groupHandles, id)) throw new Error(`${label} ${group}: ${id} is both live and retired`);
      taken.set(slug, id);
    }
    for (const id of corpusIds[group]) {
      const slug = groupHandles[id];
      if (typeof slug !== "string" || !SLUG_SHAPE.test(slug)) throw new Error(`${label} ${group} ${id}: slug ${JSON.stringify(slug)} is not a lowercase ASCII slug`);
      const clash = taken.get(slug);
      if (clash) throw new Error(`${label} ${group}: slug ${slug} is shared by ${clash} and ${id}`);
      taken.set(slug, id);
      const entry = { id, group, slug, path: lookupDetailPath(group, slug) };
      byId.set(id, entry);
      entries.push(entry);
    }
  }
  return { entries, byId, exceptions: Object.fromEntries(entries.filter((entry) => entry.slug !== lookupDerivedSlug(entry.id)).map((entry) => [entry.id, entry.slug])) };
}

