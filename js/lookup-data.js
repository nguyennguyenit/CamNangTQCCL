const PAYLOAD_NAMES = ["heroes-dict.json", "lookup-catalog.json", "tactics.json"];
const MANIFEST_NAME = "lookup-manifest.json";
const HEX256 = /^[0-9a-f]{64}$/;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const loads = new WeakMap();
const HERO_KEYS = ["id", "chinese", "hanViet", "viet", "aliases", "faction", "stars", "cost", "stats", "troopApt", "selfTacticCn", "inheritTacticCn", "roleTag", "roleTagViet", "iconUrl", "isSP", "linkScore", "pending", "lookup"];
const TACTIC_KEYS = ["id", "chinese", "hanViet", "viet", "aliases", "type", "quality", "effect", "effectViet", "target", "targetViet", "troopFit", "source", "sourceHeroCn", "iconUrl", "linkScore", "pending", "lookup"];
const COMMON_KEYS = ["id", "nameVi", "aliasesVi", "aliasesZh", "conditions", "missingFields"];
const HERO_LOOKUP_KEYS = ["conditions", "missingFields", "revisions", "variant", "selfTacticId", "inheritTacticId", "advisorId", "growth", "otherAptitudes", "categoryVi", "exclusiveTitleVi", "civil", "civilInnatePoints", "collectibleBonusVi", "redRulesVi", "flags", "usageVi", "usageZh", "cardPacks"];
const CARD_PACK_KEYS = ["packVi", "packZh", "categoryVi", "categoryZh", "isCore", "coreRate", "nonCoreRate"];
const TACTIC_LOOKUP_KEYS = ["conditions", "missingFields", "revisions", "activationRate", "cooldown", "maxUsers", "pointCost", "effectTypeVi", "exchangeConditionVi", "acquiredFromVi", "inheritedFromIds", "conflictsVi", "formerIds", "effectZhSource"];
/** Nguồn chữ Hán hiệu ứng không đến từ SGSDeck; `null` = SGSDeck hoặc chưa có chữ Hán. */
const ZH_EFFECT_KINDS = new Set(["source", "capture", "translation"]);
const CONDITION_KINDS = new Set(["season", "scenario", "requirement"]);
const HERO_VARIANTS = new Set(["base", "sp", "co", "40y"]);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isOptionalString = (value) => value === null || typeof value === "string";
const isOptionalNumber = (value) => value === null || (typeof value === "number" && Number.isFinite(value));
const isFraction = (value) => typeof value === "number" && value >= 0 && value <= 1;
const isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");

function requireShape(owner, value, keys) {
  if (!isPlainObject(value) || !keysEqual(value, keys)) throw new Error(`${owner} có shape không hợp lệ`);
}

function requireConditions(owner, rows) {
  if (!Array.isArray(rows)) throw new Error(`${owner}.conditions phải là mảng`);
  for (const row of rows) {
    requireShape(`${owner}.conditions`, row, ["kind", "textVi"]);
    if (!CONDITION_KINDS.has(row.kind) || typeof row.textVi !== "string") throw new Error(`${owner}.conditions không hợp lệ`);
  }
}

function requireRevisions(owner, rows) {
  if (!Array.isArray(rows)) throw new Error(`${owner}.revisions phải là mảng`);
  for (const row of rows) {
    requireShape(`${owner}.revisions`, row, ["labelVi", "effectiveDate", "textVi", "isCurrent"]);
    if (typeof row.labelVi !== "string" || !isOptionalString(row.effectiveDate) || typeof row.textVi !== "string" || typeof row.isCurrent !== "boolean") {
      throw new Error(`${owner}.revisions không hợp lệ`);
    }
  }
  if (rows.length && rows.filter((row) => row.isCurrent).length !== 1) throw new Error(`${owner}.revisions thiếu bản hiện hành duy nhất`);
}

function requireCommon(owner, record, keys) {
  requireShape(owner, record, keys);
  if (typeof record.id !== "string" || typeof record.nameVi !== "string" || !isStringList(record.aliasesVi)
    || !isStringList(record.aliasesZh) || !isStringList(record.missingFields)) {
    throw new Error(`${owner} có scalar không hợp lệ`);
  }
  requireConditions(owner, record.conditions);
}

function requireUniqueId(owner, record, prefix, allIds) {
  const id = record?.id;
  if (typeof id !== "string" || !id.startsWith(prefix)) throw new Error(`${owner} có id yêu cầu ${prefix}; nhận ${String(id)}`);
  if (allIds.has(id)) throw new Error(`ID trùng: ${id}`);
  allIds.add(id);
}

function validateHero(record) {
  const owner = record?.id ?? "heroes-dict.json";
  requireShape(owner, record, HERO_KEYS);
  if (![record.chinese, record.hanViet, record.viet].every((value) => typeof value === "string")
    || !isStringList(record.aliases) || ![record.faction, record.cost, record.selfTacticCn, record.inheritTacticCn, record.roleTag, record.roleTagViet, record.iconUrl].every(isOptionalString)
    || (record.stars !== null && !Number.isInteger(record.stars)) || !isOptionalNumber(record.linkScore)
    || typeof record.pending !== "boolean" || typeof record.isSP !== "boolean") {
    throw new Error(`${owner} có scalar không hợp lệ`);
  }
  requireShape(`${owner}.stats`, record.stats, ["luc", "tri", "thong", "toc", "chinh", "mi"]);
  if (!Object.values(record.stats).every((value) => typeof value === "string")) throw new Error(`${owner}.stats không hợp lệ`);
  requireShape(`${owner}.troopApt`, record.troopApt, ["ky", "thuan", "cung", "thuong", "khiGioi"]);
  if (!Object.values(record.troopApt).every(isOptionalString)) throw new Error(`${owner}.troopApt không hợp lệ`);
  const lookup = record.lookup;
  requireShape(`${owner}.lookup`, lookup, HERO_LOOKUP_KEYS);
  requireShape(`${owner}.lookup.growth`, lookup.growth, ["luc", "tri", "thong", "toc", "chinh", "mi"]);
  requireShape(`${owner}.lookup.otherAptitudes`, lookup.otherAptitudes, ["infantry", "navy"]);
  requireShape(`${owner}.lookup.civil`, lookup.civil, ["roleVi", "bonusVi", "specialtyVi", "tacticBonusVi"]);
  requireShape(`${owner}.lookup.flags`, lookup.flags, ["isCollectible", "isDynamicOpen", "isMusou", "isCO", "isSp"]);
  if (!HERO_VARIANTS.has(lookup.variant) || ![lookup.selfTacticId, lookup.inheritTacticId, lookup.advisorId, lookup.categoryVi, lookup.exclusiveTitleVi, lookup.collectibleBonusVi, lookup.redRulesVi, lookup.usageVi, lookup.usageZh].every(isOptionalString)
    || (lookup.usageVi === null) !== (lookup.usageZh === null)
    || !isOptionalNumber(lookup.civilInnatePoints) || !Object.values(lookup.growth).every(isOptionalNumber)
    || !Object.values(lookup.otherAptitudes).every(isOptionalString) || !Object.values(lookup.civil).every(isOptionalString)
    || !Object.values(lookup.flags).every((value) => value === null || typeof value === "boolean")
    || !isStringList(lookup.missingFields) || !Array.isArray(lookup.cardPacks)) {
    throw new Error(`${owner}.lookup có scalar không hợp lệ`);
  }
  for (const pack of lookup.cardPacks) {
    requireShape(`${owner}.lookup.cardPacks`, pack, CARD_PACK_KEYS);
    if (![pack.packVi, pack.packZh, pack.categoryVi, pack.categoryZh].every((value) => typeof value === "string" && value)
      || typeof pack.isCore !== "boolean" || !isFraction(pack.coreRate) || !isFraction(pack.nonCoreRate)) {
      throw new Error(`${owner}.lookup.cardPacks không hợp lệ`);
    }
  }
  requireConditions(`${owner}.lookup`, lookup.conditions);
  requireRevisions(`${owner}.lookup`, lookup.revisions);
}

function validateTactic(record) {
  const owner = record?.id ?? "tactics.json";
  requireShape(owner, record, TACTIC_KEYS);
  if (![record.chinese, record.hanViet, record.viet].every((value) => typeof value === "string")
    || !isStringList(record.aliases) || !isStringList(record.troopFit)
    || ![record.type, record.quality, record.effect, record.effectViet, record.target, record.targetViet, record.source, record.sourceHeroCn, record.iconUrl].every(isOptionalString)
    || !isOptionalNumber(record.linkScore) || typeof record.pending !== "boolean") {
    throw new Error(`${owner} có scalar không hợp lệ`);
  }
  const lookup = record.lookup;
  requireShape(`${owner}.lookup`, lookup, TACTIC_LOOKUP_KEYS);
  if (![lookup.activationRate, lookup.cooldown, lookup.maxUsers, lookup.pointCost].every(isOptionalNumber)
    || ![lookup.effectTypeVi, lookup.exchangeConditionVi, lookup.conflictsVi].every(isOptionalString)
    || !isStringList(lookup.acquiredFromVi) || !isStringList(lookup.inheritedFromIds) || !isStringList(lookup.missingFields)
    || !isStringList(lookup.formerIds) || lookup.formerIds.some((id) => !id.startsWith("tactic:") || id === record.id)) {
    throw new Error(`${owner}.lookup có scalar không hợp lệ`);
  }
  const zhSource = lookup.effectZhSource;
  if (zhSource !== null && (!isPlainObject(zhSource) || !keysEqual(zhSource, ["kind"]) || !ZH_EFFECT_KINDS.has(zhSource.kind)
    || typeof record.effect !== "string" || !record.effect.trim())) {
    throw new Error(`${owner}.lookup.effectZhSource không hợp lệ`);
  }
  requireConditions(`${owner}.lookup`, lookup.conditions);
  requireRevisions(`${owner}.lookup`, lookup.revisions);
}

function requireRecords(name, records, prefix, allIds, validate) {
  if (!Array.isArray(records) || records.length === 0) throw new Error(`${name} phải là mảng không rỗng`);
  for (const record of records) {
    requireUniqueId(name, record, prefix, allIds);
    validate(record);
  }
}

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

function validateHeroesDocument(heroes) {
  requireRecords("heroes-dict.json", heroes, "hero:", new Set(), validateHero);
}

function validateTacticsDocument(tactics) {
  requireRecords("tactics.json", tactics, "tactic:", new Set(), validateTactic);
}

function validateCatalogDocument(catalog) {
  const allIds = new Set();
  const catalogKeys = ["schemaVersion", "equipment", "specials", "advisors", "troopMods", "buildings"];
  if (!isPlainObject(catalog)) throw new Error("lookup-catalog.json có shape không hợp lệ");
  if (!keysEqual(catalog, catalogKeys)) {
    const differing = catalogKeys.find((key) => !(key in catalog))
      ?? Object.keys(catalog).find((key) => !catalogKeys.includes(key))
      ?? "lookup-catalog.json";
    throw new Error(`lookup-catalog.json có nhóm không hợp lệ: ${differing}`);
  }
  if (catalog.schemaVersion !== 1) throw new Error("lookup-catalog.json schemaVersion không hợp lệ");
  const groups = [
    ["equipment", "equipment:", [...COMMON_KEYS, "qualityVi", "slotVi"]],
    ["specials", "equipment-special:", [...COMMON_KEYS, "tierVi", "slotVi", "descriptionVi", "acquisitionVi", "equipmentId", "exclusiveHeroId"]],
    ["advisors", "advisor:", [...COMMON_KEYS, "elementVi", "effectVi", "usageVi", "tacticPoints", "heroIds"]],
    ["troopMods", "troop-mod:", [...COMMON_KEYS, "effectVi", "appliesToVi", "suggestedBuildVi", "troopLimitVi", "revisions", "options"]],
    ["buildings", "building:", [...COMMON_KEYS, "summaryVi", "mainCityOnly", "maxLevel", "levels"]],
  ];
  for (const [key, prefix, keys] of groups) {
    if (!Array.isArray(catalog[key])) throw new Error(`lookup-catalog.json thiếu ${key}`);
    for (const record of catalog[key]) {
      requireUniqueId(key, record, prefix, allIds);
      requireCommon(record.id, record, keys);
    }
  }
  for (const row of catalog.equipment) {
    if (![row.qualityVi, row.slotVi].every(isOptionalString)) throw new Error(`${row.id} có scalar không hợp lệ`);
  }
  for (const row of catalog.specials) {
    if (![row.tierVi, row.slotVi, row.descriptionVi, row.equipmentId, row.exclusiveHeroId].every(isOptionalString) || !isStringList(row.acquisitionVi)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
  }
  for (const row of catalog.advisors) {
    if (![row.elementVi, row.effectVi, row.usageVi].every(isOptionalString) || !isOptionalNumber(row.tacticPoints) || !isStringList(row.heroIds)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
  }
  for (const row of catalog.troopMods) {
    if (![row.effectVi, row.appliesToVi, row.suggestedBuildVi].every(isOptionalString) || !isStringList(row.troopLimitVi) || !Array.isArray(row.options)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
    requireRevisions(row.id, row.revisions);
    for (const option of row.options) {
      requireShape(`${row.id}.options`, option, ["id", "tierVi", "nameVi", "descriptionVi", "convertsToVi"]);
      requireUniqueId(`${row.id}.options`, option, "troop-option:", allIds);
      if (typeof option.nameVi !== "string" || ![option.tierVi, option.descriptionVi, option.convertsToVi].every(isOptionalString)) {
        throw new Error(`${row.id}.options có scalar không hợp lệ`);
      }
    }
  }
  for (const row of catalog.buildings) {
    if (!isOptionalString(row.summaryVi) || typeof row.mainCityOnly !== "boolean" || !Number.isInteger(row.maxLevel) || !Array.isArray(row.levels)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
    for (const level of row.levels) {
      requireShape(`${row.id}.levels`, level, ["id", "level", "costs", "durationVi", "effectVi"]);
      requireUniqueId(`${row.id}.levels`, level, "building-level:", allIds);
      requireShape(`${row.id}.levels.costs`, level.costs, ["wood", "iron", "stone"]);
      if (!Number.isInteger(level.level) || !Object.values(level.costs).every(isOptionalNumber) || ![level.durationVi, level.effectVi].every(isOptionalString)) {
        throw new Error(`${row.id}.levels có scalar không hợp lệ`);
      }
    }
  }
}

/** Shape của từng payload; tham chiếu chéo giữa các payload do `validateRelations` kiểm khi có đủ bộ. */
const DOCUMENT_VALIDATORS = Object.freeze({
  "heroes-dict.json": validateHeroesDocument,
  "tactics.json": validateTacticsDocument,
  "lookup-catalog.json": validateCatalogDocument,
});

function validateRelations(heroes, tactics, catalog) {
  const heroIds = new Set(heroes.map((row) => row.id));
  const tacticIds = new Set(tactics.map((row) => row.id));
  const advisorIds = new Set(catalog.advisors.map((row) => row.id));
  const equipmentIds = new Set(catalog.equipment.map((row) => row.id));
  for (const hero of heroes) {
    for (const [field, allowed] of [["selfTacticId", tacticIds], ["inheritTacticId", tacticIds], ["advisorId", advisorIds]]) {
      const id = hero.lookup[field];
      if (id != null && !allowed.has(id)) throw new Error(`Tham chiếu treo: ${id}`);
    }
  }
  for (const tactic of tactics) {
    for (const id of tactic.lookup.inheritedFromIds) if (!heroIds.has(id)) throw new Error(`Tham chiếu treo: ${id}`);
    for (const id of tactic.lookup.formerIds) if (tacticIds.has(id)) throw new Error(`Mã chiến pháp đã gộp vẫn còn là mục sống: ${id}`);
  }
  for (const advisor of catalog.advisors) {
    for (const id of advisor.heroIds) if (!heroIds.has(id)) throw new Error(`Tham chiếu treo: ${id}`);
  }
  for (const special of catalog.specials) {
    if (special.equipmentId != null && !equipmentIds.has(special.equipmentId)) throw new Error(`Tham chiếu treo: ${special.equipmentId}`);
    if (special.exclusiveHeroId != null && !heroIds.has(special.exclusiveHeroId)) throw new Error(`Tham chiếu treo: ${special.exclusiveHeroId}`);
  }
}

/** Manifest đúng schema, digest hex và `generationId` suy ra từ chính bộ digest. */
async function validateManifest(manifest) {
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
  for (const name of PAYLOAD_NAMES) {
    if (!HEX256.test(manifest.files[name])) throw new Error(`${name} có digest không hợp lệ`);
  }
  const orderedFiles = Object.fromEntries(Object.keys(manifest.files).sort().map((key) => [key, manifest.files[key]]));
  const generationId = `lookup:${await digest(encoder.encode(`${JSON.stringify(orderedFiles)}\n`))}`;
  if (generationId !== manifest.generationId) throw new Error("lookup manifest generationId không hợp lệ");
}

async function verifiedDocument(manifest, name, bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error(`${name} phải là Uint8Array`);
  if (await digest(bytes) !== manifest.files[name]) throw new Error(`${name} không khớp digest`);
  const document = parseJson(name, bytes);
  DOCUMENT_VALIDATORS[name](document);
  return document;
}

/**
 * Một payload Tra cứu khớp manifest đã pin: đúng tên, đúng digest, đúng shape của chính tài liệu đó.
 * Tham chiếu chéo sang payload khác không được kiểm ở đây (đã kiểm lúc build trên cả bộ).
 */
export async function validateLookupPayload(manifest, name, bytes) {
  if (!PAYLOAD_NAMES.includes(name)) throw new Error(`lookup payload không hợp lệ: ${name}`);
  await validateManifest(manifest);
  return verifiedDocument(manifest, name, bytes);
}

export async function validateLookupBundle(manifest, rawFiles) {
  await validateManifest(manifest);
  if (!rawFiles || typeof rawFiles !== "object") throw new Error("lookup raw files không hợp lệ");
  if (!keysEqual(rawFiles, PAYLOAD_NAMES)) {
    const differing = PAYLOAD_NAMES.find((name) => !(name in rawFiles))
      ?? Object.keys(rawFiles).find((name) => !PAYLOAD_NAMES.includes(name))
      ?? "raw files";
    throw new Error(`lookup raw files không hợp lệ: ${differing}`);
  }
  const heroes = await verifiedDocument(manifest, "heroes-dict.json", rawFiles["heroes-dict.json"]);
  const tactics = await verifiedDocument(manifest, "tactics.json", rawFiles["tactics.json"]);
  const catalog = await verifiedDocument(manifest, "lookup-catalog.json", rawFiles["lookup-catalog.json"]);
  validateRelations(heroes, tactics, catalog);
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
    const manifest = manifestFrom(values[0]);
    const rawFiles = Object.fromEntries(PAYLOAD_NAMES.map((name, index) => [name, values[index + 1]]));
    return validateLookupBundle(manifest, rawFiles);
  })();
  loads.set(fetchFn, pending);
  pending.catch(() => { if (loads.get(fetchFn) === pending) loads.delete(fetchFn); });
  return pending;
}

function manifestFrom(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error(`${MANIFEST_NAME} phải là Uint8Array`);
  return parseJson(MANIFEST_NAME, bytes);
}

/** Promise đã lưu cache; lần lỗi bị bỏ để lần gọi sau tải lại thật. */
function remember(cache, key, start) {
  if (!cache.has(key)) {
    const pending = start();
    cache.set(key, pending);
    pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
  }
  return cache.get(key);
}

/**
 * Bộ nạp payload theo nhu cầu của một trang: manifest tải một lần, mỗi payload chỉ tải khi được hỏi
 * và mỗi file đúng một request. Trả tài liệu đã xác minh, đông cứng.
 */
export function createLookupPayloadLoader(fetchFn) {
  if (typeof fetchFn !== "function") throw new TypeError("fetchFn phải là hàm");
  const cache = new Map();
  const manifest = () => remember(cache, MANIFEST_NAME, async () => {
    const value = manifestFrom(await fetchFn(MANIFEST_NAME));
    await validateManifest(value);
    return value;
  });
  return (name) => remember(cache, name, async () => {
    if (!PAYLOAD_NAMES.includes(name)) throw new Error(`lookup payload không hợp lệ: ${name}`);
    const [pinned, bytes] = await Promise.all([manifest(), fetchFn(name)]);
    return Object.freeze(await verifiedDocument(pinned, name, bytes));
  });
}
