const PAYLOAD_NAMES = ["heroes-dict.json", "lookup-catalog.json", "tactics.json"];
const MANIFEST_NAME = "lookup-manifest.json";
const HEX256 = /^[0-9a-f]{64}$/;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const loads = new WeakMap();

function keysEqual(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
}

async function digest(bytes) {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function parseJson(name, bytes) {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    throw new Error(`${name} không phải JSON hợp lệ`);
  }
}

function requireRecords(name, records, prefix, allIds) {
  if (!Array.isArray(records) || records.length === 0) throw new Error(`${name} phải là mảng không rỗng`);
  for (const record of records) {
    const id = record?.id;
    if (typeof id !== "string" || !id.startsWith(prefix)) throw new Error(`${name} có id yêu cầu ${prefix}; nhận ${String(id)}`);
    if (allIds.has(id)) throw new Error(`ID trùng: ${id}`);
    allIds.add(id);
  }
}

function validateDocuments(heroes, tactics, catalog) {
  const allIds = new Set();
  requireRecords("heroes-dict.json", heroes, "hero:", allIds);
  requireRecords("tactics.json", tactics, "tactic:", allIds);
  const catalogKeys = ["schemaVersion", "equipment", "specials", "advisors", "troopMods", "buildings"];
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) throw new Error("lookup-catalog.json không hợp lệ");
  if (catalog.schemaVersion !== 1) throw new Error("lookup-catalog.json schemaVersion không hợp lệ");
  if (!keysEqual(catalog, catalogKeys)) {
    const differing = catalogKeys.find((key) => !(key in catalog))
      ?? Object.keys(catalog).find((key) => !catalogKeys.includes(key))
      ?? "lookup-catalog.json";
    throw new Error(`lookup-catalog.json có nhóm không hợp lệ: ${differing}`);
  }
  const groups = [
    ["equipment", "equipment:"],
    ["specials", "equipment-special:"],
    ["advisors", "advisor:"],
    ["troopMods", "troop-mod:"],
    ["buildings", "building:"],
  ];
  for (const [key, prefix] of groups) {
    if (!Array.isArray(catalog[key])) throw new Error(`lookup-catalog.json thiếu ${key}`);
    for (const record of catalog[key]) {
      const id = record?.id;
      if (typeof id !== "string" || !id.startsWith(prefix)) throw new Error(`${key} có id không hợp lệ`);
      if (allIds.has(id)) throw new Error(`ID trùng: ${id}`);
      allIds.add(id);
    }
  }
  const heroIds = new Set(heroes.map((row) => row.id));
  const tacticIds = new Set(tactics.map((row) => row.id));
  const advisorIds = new Set(catalog.advisors.map((row) => row.id));
  const equipmentIds = new Set(catalog.equipment.map((row) => row.id));
  for (const hero of heroes) {
    for (const [field, allowed] of [["selfTacticId", tacticIds], ["inheritTacticId", tacticIds], ["advisorId", advisorIds]]) {
      const id = hero.lookup?.[field];
      if (id != null && !allowed.has(id)) throw new Error(`Tham chiếu treo: ${id}`);
    }
  }
  for (const tactic of tactics) {
    for (const id of tactic.lookup?.inheritedFromIds ?? []) if (!heroIds.has(id)) throw new Error(`Tham chiếu treo: ${id}`);
  }
  for (const advisor of catalog.advisors) {
    for (const id of advisor.heroIds ?? []) if (!heroIds.has(id)) throw new Error(`Tham chiếu treo: ${id}`);
  }
  for (const special of catalog.specials) {
    if (special.equipmentId != null && !equipmentIds.has(special.equipmentId)) throw new Error(`Tham chiếu treo: ${special.equipmentId}`);
    if (special.exclusiveHeroId != null && !heroIds.has(special.exclusiveHeroId)) throw new Error(`Tham chiếu treo: ${special.exclusiveHeroId}`);
  }
  for (const troop of catalog.troopMods) {
    if (!Array.isArray(troop.options) || !Array.isArray(troop.revisions)) throw new Error(`${troop.id} thiếu options hoặc revisions`);
    for (const option of troop.options) if (typeof option?.id !== "string" || !option.id.startsWith("troop-option:")) throw new Error(`${troop.id} có option không hợp lệ`);
  }
  for (const building of catalog.buildings) {
    if (!Array.isArray(building.levels)) throw new Error(`${building.id} thiếu levels`);
    for (const level of building.levels) if (!Number.isInteger(level?.level) || typeof level?.id !== "string") throw new Error(`${building.id} có level không hợp lệ`);
  }
}

export async function validateLookupBundle(manifest, rawFiles) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("lookup manifest không hợp lệ");
  if (manifest.schemaVersion !== 1) throw new Error("lookup manifest schemaVersion không hợp lệ");
  if (!("generationId" in manifest)) throw new Error("lookup manifest thiếu generationId");
  if (!keysEqual(manifest, ["schemaVersion", "generationId", "files"])) throw new Error("lookup manifest không hợp lệ");
  if (typeof manifest.generationId !== "string") throw new Error("lookup manifest generationId không hợp lệ");
  if (!keysEqual(manifest.files, PAYLOAD_NAMES)) {
    const differing = PAYLOAD_NAMES.find((name) => !manifest.files || !(name in manifest.files))
      ?? Object.keys(manifest.files ?? {}).find((name) => !PAYLOAD_NAMES.includes(name))
      ?? "files";
    throw new Error(`lookup manifest files không hợp lệ: ${differing}`);
  }
  if (!rawFiles || typeof rawFiles !== "object") throw new Error("lookup raw files không hợp lệ");
  if (!keysEqual(rawFiles, PAYLOAD_NAMES)) {
    const differing = PAYLOAD_NAMES.find((name) => !(name in rawFiles))
      ?? Object.keys(rawFiles).find((name) => !PAYLOAD_NAMES.includes(name))
      ?? "raw files";
    throw new Error(`lookup raw files không hợp lệ: ${differing}`);
  }
  for (const name of PAYLOAD_NAMES) {
    if (!(rawFiles[name] instanceof Uint8Array)) throw new Error(`${name} phải là Uint8Array`);
    if (!HEX256.test(manifest.files[name])) throw new Error(`${name} có digest không hợp lệ`);
    if (await digest(rawFiles[name]) !== manifest.files[name]) throw new Error(`${name} không khớp digest`);
  }
  const orderedFiles = Object.fromEntries(Object.keys(manifest.files).sort().map((key) => [key, manifest.files[key]]));
  const generationId = `lookup:${await digest(encoder.encode(`${JSON.stringify(orderedFiles)}\n`))}`;
  if (generationId !== manifest.generationId) throw new Error("lookup manifest generationId không hợp lệ");
  const heroes = parseJson("heroes-dict.json", rawFiles["heroes-dict.json"]);
  const tactics = parseJson("tactics.json", rawFiles["tactics.json"]);
  const catalog = parseJson("lookup-catalog.json", rawFiles["lookup-catalog.json"]);
  validateDocuments(heroes, tactics, catalog);
  Object.freeze(manifest.files);
  Object.freeze(manifest);
  Object.freeze(rawFiles);
  return Object.freeze({ heroes, tactics, catalog, manifest, rawFiles });
}

export function loadLookupBundle(fetchFn) {
  if (typeof fetchFn !== "function") return Promise.reject(new TypeError("fetchFn phải là hàm"));
  const cached = loads.get(fetchFn);
  if (cached) return cached;
  const pending = (async () => {
    const names = [MANIFEST_NAME, ...PAYLOAD_NAMES];
    const values = await Promise.all(names.map((name) => fetchFn(name)));
    const manifestBytes = values[0];
    if (!(manifestBytes instanceof Uint8Array)) throw new Error(`${MANIFEST_NAME} phải là Uint8Array`);
    const manifest = parseJson(MANIFEST_NAME, manifestBytes);
    const rawFiles = Object.fromEntries(PAYLOAD_NAMES.map((name, index) => [name, values[index + 1]]));
    return validateLookupBundle(manifest, rawFiles);
  })();
  loads.set(fetchFn, pending);
  pending.catch(() => { if (loads.get(fetchFn) === pending) loads.delete(fetchFn); });
  return pending;
}

export const LOOKUP_PAYLOAD_NAMES = Object.freeze([...PAYLOAD_NAMES]);
