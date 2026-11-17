const PAYLOAD_NAMES = ["heroes-dict.json", "lookup-catalog.json", "tactics.json"];
const MANIFEST_NAME = "lookup-manifest.json";
const HEX256 = /^[0-9a-f]{64}$/;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const loads = new WeakMap();
const HERO_KEYS = ["id", "chinese", "hanViet", "viet", "aliases", "faction", "stars", "cost", "stats", "troopApt", "selfTacticCn", "inheritTacticCn", "roleTag", "roleTagViet", "iconUrl", "isSP", "linkScore", "pending", "lookup"];
const TACTIC_KEYS = ["id", "chinese", "hanViet", "viet", "aliases", "type", "quality", "effect", "effectViet", "target", "targetViet", "troopFit", "source", "sourceHeroCn", "iconUrl", "linkScore", "pending", "lookup"];
const COMMON_KEYS = ["id", "nameVi", "aliasesVi", "aliasesZh", "conditions", "missingFields"];
const HERO_LOOKUP_KEYS = ["conditions", "missingFields", "revisions", "variant", "selfTacticId", "inheritTacticId", "advisorId", "growth", "otherAptitudes", "categoryVi", "exclusiveTitleVi", "exclusiveTitleZh", "civil", "civilInnatePoints", "collectibleBonusVi", "redRulesVi", "flags", "usageVi", "usageZh", "cardPacks"];
const CARD_PACK_KEYS = ["packVi", "packZh", "categoryVi", "categoryZh", "isCore", "coreRate", "nonCoreRate"];
const TACTIC_LOOKUP_KEYS = ["conditions", "missingFields", "revisions", "activationRate", "cooldown", "maxUsers", "pointCost", "effectTypeVi", "exchangeConditionVi", "acquiredFromVi", "inheritedFromIds", "conflictsVi", "formerIds", "effectZhSource"];
/** Nguồn chữ Hán hiệu ứng không đến từ SGSDeck; `null` = SGSDeck hoặc chưa có chữ Hán. */
const ZH_EFFECT_KINDS = new Set(["source", "capture", "translation"]);
/** Chữ giữ chỗ của SGSDeck (`MISSING_TEXT` của pipeline/build_unified_lookup.py): không phải chữ Hán hiệu ứng. */
const MISSING_TEXT = new Set(["待補充", "待补充"]);
const CONDITION_KINDS = new Set(["season", "scenario", "requirement"]);
const HERO_VARIANTS = new Set(["base", "sp", "co", "40y"]);
/** Bộ giá trị đóng của hàng kỳ lược (hợp đồng catalog; nhãn hiển thị ở `qilueLabel` của js/lookup-detail.js). */
export const QILUE_CARD_TYPES = Object.freeze(["dung", "muu", "phu", "sach", "te"]);
export const QILUE_RARITIES = Object.freeze(["common", "rare"]);
export const QILUE_TARGETS = Object.freeze(["Toàn quân ta", "Một quân ta", "Nhóm quân ta", "Một quân địch", "Toàn quân địch"]);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isOptionalString = (value) => value === null || typeof value === "string";
const isOptionalNumber = (value) => value === null || (typeof value === "number" && Number.isFinite(value));
const isFraction = (value) => typeof value === "number" && value >= 0 && value <= 1;
const isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");

function requireShape(owner, value, keys) {
  if (!isPlainObject(value) || !keysEqual(value, keys)) throw new Error(`${owner} có shape không hợp lệ`);
}

/** `zh`: chỉ ghi chú mùa của tướng được kèm `textZh` (chữ Hán dịch từ `textVi`, cờ "dịch, chưa đối chiếu"). */
function requireConditions(owner, rows, { zh = false } = {}) {
  if (!Array.isArray(rows)) throw new Error(`${owner}.conditions phải là mảng`);
  for (const row of rows) {
    const translated = zh && isPlainObject(row) && Object.hasOwn(row, "textZh");
    requireShape(`${owner}.conditions`, row, translated ? ["kind", "textVi", "textZh"] : ["kind", "textVi"]);
    if (!CONDITION_KINDS.has(row.kind) || typeof row.textVi !== "string" || (translated && (typeof row.textZh !== "string" || !/[\u3400-\u9fff]/u.test(row.textZh)))) {
      throw new Error(`${owner}.conditions không hợp lệ`);
    }
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

/** `zh`: điều kiện được kèm `textZh` (kỳ lược: tên mùa chữ Hán theo hợp đồng catalog). */
function requireCommon(owner, record, keys, { zh = false } = {}) {
  requireShape(owner, record, keys);
  if (typeof record.id !== "string" || typeof record.nameVi !== "string" || !isStringList(record.aliasesVi)
    || !isStringList(record.aliasesZh) || !isStringList(record.missingFields)) {
    throw new Error(`${owner} có scalar không hợp lệ`);
  }
  requireConditions(owner, record.conditions, { zh });
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
  if (!HERO_VARIANTS.has(lookup.variant) || ![lookup.selfTacticId, lookup.inheritTacticId, lookup.advisorId, lookup.categoryVi, lookup.exclusiveTitleVi, lookup.exclusiveTitleZh, lookup.collectibleBonusVi, lookup.redRulesVi, lookup.usageVi, lookup.usageZh].every(isOptionalString)
    || (lookup.exclusiveTitleZh !== null && lookup.exclusiveTitleVi === null)
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
  requireConditions(`${owner}.lookup`, lookup.conditions, { zh: true });
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
    || typeof record.effect !== "string" || !record.effect.trim() || MISSING_TEXT.has(record.effect))) {
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
  const catalogKeys = ["schemaVersion", "equipment", "specials", "advisors", "troopMods", "buildings", "qilueStrategies", "qilueCards"];
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
    ["advisors", "advisor:", [...COMMON_KEYS, "elementVi", "effectVi", "usageVi", "tacticPoints", "heroIds", "nameZh", "effectZh", "usageZh", "zhSource"]],
    ["troopMods", "troop-mod:", [...COMMON_KEYS, "effectVi", "appliesToVi", "suggestedBuildVi", "troopLimitVi", "revisions", "options", "effectZh", "appliesToZh", "suggestedBuildZh", "zhSource"]],
    ["buildings", "building:", [...COMMON_KEYS, "summaryVi", "mainCityOnly", "maxLevel", "levels", "summaryZh", "zhSource"]],
    ["qilueStrategies", "qilue-strategy:", [...COMMON_KEYS, "nameZh", "cardTypes", "descriptionVi", "buffVi", "descriptionZh", "buffZh", "zhSource"]],
    ["qilueCards", "qilue-card:", [...COMMON_KEYS, "nameZh", "type", "rarity", "targetVi", "effectVi", "effectZh", "zhSource"]],
  ];
  for (const [key, prefix, keys] of groups) {
    if (!Array.isArray(catalog[key])) throw new Error(`lookup-catalog.json thiếu ${key}`);
    for (const record of catalog[key]) {
      requireUniqueId(key, record, prefix, allIds);
      requireCommon(record.id, record, keys, { zh: key.startsWith("qilue") });
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
    if (![row.elementVi, row.effectVi, row.usageVi, row.nameZh, row.effectZh, row.usageZh].every(isOptionalString) || !isOptionalNumber(row.tacticPoints) || !isStringList(row.heroIds)
      || !isZhSource(row.zhSource, row.nameZh || row.effectZh)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
  }
  for (const row of catalog.troopMods) {
    if (![row.effectVi, row.appliesToVi, row.suggestedBuildVi, row.effectZh, row.appliesToZh, row.suggestedBuildZh].every(isOptionalString) || !isStringList(row.troopLimitVi) || !Array.isArray(row.options)
      || !isZhSource(row.zhSource, row.effectZh)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
    requireRevisions(row.id, row.revisions);
    for (const option of row.options) {
      requireShape(`${row.id}.options`, option, ["id", "tierVi", "nameVi", "descriptionVi", "convertsToVi", "nameZh", "descriptionZh", "zhSource"]);
      requireUniqueId(`${row.id}.options`, option, "troop-option:", allIds);
      if (typeof option.nameVi !== "string" || ![option.tierVi, option.descriptionVi, option.convertsToVi, option.nameZh, option.descriptionZh].every(isOptionalString)
        || !isZhSource(option.zhSource, option.nameZh || option.descriptionZh)) {
        throw new Error(`${row.id}.options có scalar không hợp lệ`);
      }
    }
  }
  for (const row of catalog.buildings) {
    if (![row.summaryVi, row.summaryZh].every(isOptionalString) || !isZhSource(row.zhSource, row.summaryZh) || typeof row.mainCityOnly !== "boolean" || !Number.isInteger(row.maxLevel) || !Array.isArray(row.levels)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
    for (const level of row.levels) {
      requireShape(`${row.id}.levels`, level, ["id", "level", "costs", "durationVi", "effectVi", "effectZh", "durationZh"]);
      requireUniqueId(`${row.id}.levels`, level, "building-level:", allIds);
      requireShape(`${row.id}.levels.costs`, level.costs, ["wood", "iron", "stone"]);
      if (!Number.isInteger(level.level) || !Object.values(level.costs).every(isOptionalNumber) || ![level.durationVi, level.effectVi, level.effectZh, level.durationZh].every(isOptionalString)) {
        throw new Error(`${row.id}.levels có scalar không hợp lệ`);
      }
    }
  }
  validateQilue(catalog);
}

/**
 * Hàng kỳ lược (hợp đồng catalog): tên game `nameZh` có chữ Hán và `aliasesZh` đúng bằng `[nameZh]` (biến thể chữ Hán sai
 * của ghi chú đội không bao giờ vào catalog công khai); chữ Việt chính không rỗng; chữ Hán dịch đi kèm `zhSource`.
 */
function validateQilue(catalog) {
  const nonEmpty = (value) => typeof value === "string" && value.trim() !== "";
  const named = (row) => nonEmpty(row.nameZh) && /[\u3400-\u9fff]/u.test(row.nameZh) && row.aliasesZh.length === 1 && row.aliasesZh[0] === row.nameZh;
  for (const row of catalog.qilueStrategies) {
    const types = row.cardTypes;
    if (!named(row) || ![row.descriptionVi, row.buffVi].every(nonEmpty) || ![row.descriptionZh, row.buffZh].every(isOptionalString)
      || !isStringList(types) || types.length !== 2 || new Set(types).size !== 2 || !types.every((type) => QILUE_CARD_TYPES.includes(type))
      || !isZhSource(row.zhSource, row.descriptionZh || row.buffZh)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
  }
  for (const row of catalog.qilueCards) {
    if (!named(row) || !QILUE_CARD_TYPES.includes(row.type) || !QILUE_RARITIES.includes(row.rarity) || !QILUE_TARGETS.includes(row.targetVi)
      || !nonEmpty(row.effectVi) || !isOptionalString(row.effectZh) || !isZhSource(row.zhSource, row.effectZh)) {
      throw new Error(`${row.id} có scalar không hợp lệ`);
    }
  }
}

/** `zhSource` có khi và chỉ khi hàng có chữ Hán chính, dạng `{kind: "source" | "translation"}`. */
function isZhSource(value, mainText) {
  if (!mainText) return value === null;
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1
    && (value.kind === "source" || value.kind === "translation");
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

/* ---------- Lớp tiếng Nhật (`data/lookup-ja.json`, hợp đồng ở docs/ja-lookup-data.md) ---------- */

export const LOOKUP_JA_SOURCE_NAMES = Object.freeze(["data/books-dict.json", "data/heroes-dict.json", "data/ja-kanji-variants.json", "data/lookup-catalog.json", "data/tactics.json"]);
const JA_ENTRY_KEYS = new Set(["name", "nameStatus", "nameOriginal", "nameOriginalLang", "texts", "translatedFromVi"]);
const JA_NAME_STATUS = new Set(["verified", "derived"]);
/** `lang` của tên gốc, tính lúc build theo lối viết (`pipeline/han_script.py`); vắng trường thì trang dùng `zh`. */
const JA_NAME_ORIGINAL_LANGS = Object.freeze(["zh-Hans", "zh-Hant", "zh"]);
const PIN = /^sha256:([0-9a-f]{64})$/;
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * Kiểm tài liệu `lookup-ja.json` đã parse: đúng schema, cùng `lookupGenerationId` với lookup manifest đang phát (`generationId`),
 * mọi mục có tên/trạng thái/tên gốc (`nameOriginalLang`, nếu có, là một trong `JA_NAME_ORIGINAL_LANGS`), `texts` chỉ chứa chữ. Trả tài liệu (không đông cứng sâu; nơi gọi giữ nguyên, không sửa).
 * @param {any} document
 * @param {{lookupGenerationId: string}} expected
 */
export function validateLookupJaDocument(document, { lookupGenerationId }) {
  if (!isPlainObject(document) || document.schemaVersion !== 1) throw new Error("lookup-ja.json schemaVersion không hợp lệ");
  if (!keysEqual(document, ["schemaVersion", "lookupGenerationId", "sources", "notice", "payloadSha256", "prefixedTactics", "entries"])) {
    throw new Error("lookup-ja.json có shape không hợp lệ");
  }
  if (typeof lookupGenerationId !== "string" || document.lookupGenerationId !== lookupGenerationId) {
    throw new Error("lookup-ja.json không cùng thế hệ với lookup manifest");
  }
  if (!keysEqual(document.sources, LOOKUP_JA_SOURCE_NAMES) || !Object.values(document.sources).every((value) => HEX256.test(value))) {
    throw new Error("lookup-ja.json sources không hợp lệ");
  }
  if (!isPlainObject(document.notice) || document.notice.machineTranslated !== true || !nonEmpty(document.notice.numbersEdition) || !HEX256.test(document.payloadSha256)) {
    throw new Error("lookup-ja.json notice/payloadSha256 không hợp lệ");
  }
  if (!Array.isArray(document.prefixedTactics) || !document.prefixedTactics.every((row) => isPlainObject(row)
    && keysEqual(row, ["baseId", "name", "prefix"]) && typeof row.baseId === "string" && row.baseId.startsWith("tactic:") && nonEmpty(row.name) && nonEmpty(row.prefix))) {
    throw new Error("lookup-ja.json prefixedTactics không hợp lệ");
  }
  if (!isPlainObject(document.entries) || !Object.keys(document.entries).length) throw new Error("lookup-ja.json thiếu entries");
  for (const [id, entry] of Object.entries(document.entries)) {
    if (!isPlainObject(entry) || Object.keys(entry).some((key) => !JA_ENTRY_KEYS.has(key))
      || !nonEmpty(entry.name) || !JA_NAME_STATUS.has(entry.nameStatus) || !nonEmpty(entry.nameOriginal)
      || (entry.nameOriginalLang !== undefined && !JA_NAME_ORIGINAL_LANGS.includes(entry.nameOriginalLang))
      || !isPlainObject(entry.texts) || !Object.values(entry.texts).every(nonEmpty)
      || (entry.translatedFromVi !== undefined && !isStringList(entry.translatedFromVi))) {
      throw new Error(`lookup-ja.json mục không hợp lệ: ${id}`);
    }
  }
  return document;
}

/** Bytes `lookup-ja.json` khớp pin `sha256:<hex>` nhúng trong trang rồi đúng hợp đồng (`validateLookupJaDocument`). */
export async function verifyLookupJa(bytes, pin, { lookupGenerationId }) {
  const expected = PIN.exec(typeof pin === "string" ? pin : "")?.[1];
  if (!expected) throw new Error("Pin lookup-ja.json không hợp lệ");
  if (!(bytes instanceof Uint8Array)) throw new Error("lookup-ja.json phải là Uint8Array");
  if (await digest(bytes) !== expected) throw new Error("lookup-ja.json không khớp pin");
  return validateLookupJaDocument(parseJson("lookup-ja.json", bytes), { lookupGenerationId });
}

/** Bytes `ja-kanji-variants.json` khớp hash mà `lookup-ja.json` khai (`sources`); trả tài liệu đã parse. */
export async function verifyKanjiVariants(bytes, jaDocument) {
  if (!(bytes instanceof Uint8Array)) throw new Error("ja-kanji-variants.json phải là Uint8Array");
  if (await digest(bytes) !== jaDocument?.sources?.["data/ja-kanji-variants.json"]) throw new Error("ja-kanji-variants.json không khớp lookup-ja.json");
  return parseJson("ja-kanji-variants.json", bytes);
}

/**
 * Nạp lớp ja của một trang `/ja/` qua bộ nạp byte dùng chung (`createByteLoader` của js/website-display.js): `lookup-ja.json`
 * khớp `pin`, cùng thế hệ với `lookup-manifest.json` đang phát; `withVariants` tải thêm bảng tự dạng (khớp hash trong
 * `sources`) cho tên thô chưa có trong từ điển. Trả `{document, variants}` (`variants` là tài liệu đã parse hoặc `null`).
 */
export async function loadLookupJa(loadBytes, pin, { withVariants = false } = {}) {
  if (typeof loadBytes !== "function") throw new TypeError("loadBytes phải là hàm");
  const [jaBytes, manifestBytes] = await Promise.all([loadBytes("data/lookup-ja.json"), loadBytes(`data/${MANIFEST_NAME}`)]);
  const manifest = manifestFrom(manifestBytes);
  await validateManifest(manifest);
  const document = await verifyLookupJa(jaBytes, pin, { lookupGenerationId: manifest.generationId });
  const variants = withVariants ? await verifyKanjiVariants(await loadBytes("data/ja-kanji-variants.json"), document) : null;
  return { document, variants };
}
