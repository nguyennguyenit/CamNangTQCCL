import { matchDict } from "./match-dict.js";
import { normalizeText } from "./filters.js";
import { canonicalHeroId, heroFamilyId } from "./hero-identity.js";
import { toVietHanViet } from "./hanviet.js";
import { L } from "./i18n.js";
import { createTacticIdResolver } from "./lookup-ids.js";
import { withLocaleAliases } from "./locale-name-aliases.js";

const MAX_UNTRUSTED_TEXT = 256;

function sanitizeText(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_UNTRUSTED_TEXT);
}

const resolverCache = new WeakMap();
/** Tên → mã chiến pháp theo danh mục (tên hiển thị có thể đã đổi, mã giữ nguyên); không có trong danh mục thì slug tên. */
function tacticIdResolver(dict) {
  if (!Array.isArray(dict)) return createTacticIdResolver([]);
  if (!resolverCache.has(dict)) resolverCache.set(dict, createTacticIdResolver(dict));
  return resolverCache.get(dict);
}

const compactCjk = (value) => (typeof value === "string" ? value.replace(/\s+/gu, "") : "");

const jaIndexCache = new WeakMap();
/**
 * Chỉ mục bản ja của một từ điển: bản ghi có `aliases` nối tên Nhật (`withLocaleAliases`) và bảng tên Nhật chính xác
 * (bỏ khoảng trắng) → bản ghi. Tên Nhật trùng ở hai bản ghi thì không còn chắc (`null`, để bộ khớp mờ quyết).
 */
function jaIndex(dict, jaEntries) {
  const cached = jaIndexCache.get(dict);
  if (cached?.jaEntries === jaEntries) return cached;
  const records = withLocaleAliases(dict, jaEntries);
  const entries = jaEntries.entries && typeof jaEntries.entries === "object" ? jaEntries.entries : jaEntries;
  const exact = new Map();
  for (const record of records) {
    const id = typeof record?.id === "string" ? record.id : "";
    const key = id && Object.hasOwn(entries, id) ? compactCjk(entries[id]?.name) : "";
    if (key) exact.set(key, exact.has(key) && exact.get(key) !== record ? null : record);
  }
  const index = { jaEntries, records, exact };
  jaIndexCache.set(dict, index);
  return index;
}

/** Kết quả khớp chắc theo tên Nhật chính xác, cùng dạng với `matchDict`. */
const exactMatch = (record) => ({
  record, score: 1, confidence: "high", matched: true,
  secondRecord: null, secondScore: 0, margin: 1, ambiguous: false, reviewRequired: false,
});

/**
 * Chữ trong ảnh → tên Việt chuẩn. Bản ja (`jaEntries` = `entries` của data/lookup-ja.json): ảnh client Nhật in tên Nhật nên
 * tên Nhật khớp chính xác được ưu tiên (bản Nhật có thể gọi một mục bằng chữ Hán nguồn của mục khác), sau đó khớp mờ trên
 * `chinese` và mọi bí danh chữ Hán (gồm tên Nhật). Không có `jaEntries` thì giữ nguyên bộ khớp của bản vi/zh.
 */
function mapName(cn, dict, jaEntries = null) {
  const rawChinese = sanitizeText(cn);
  const records = Array.isArray(dict) ? dict : [];
  let m;
  if (jaEntries && typeof jaEntries === "object") {
    const index = jaIndex(records, jaEntries);
    const exact = index.exact.get(compactCjk(rawChinese));
    m = exact ? exactMatch(exact) : matchDict(rawChinese, index.records, { cjkAliases: true });
  } else {
    m = matchDict(rawChinese, records);
  }
  const name = m.matched ? m.record.viet : toVietHanViet(rawChinese);
  return {
    name,
    confidence: m.matched ? m.confidence : "low",
    match: m,
    rawChinese,
  };
}

function evidenceFor(item, context) {
  return {
    batchId: sanitizeText(context.batchId || context.observationBatchId),
    sourceScope: sanitizeText(context.sourceScope),
    trust: "untrusted",
    imageOrdinal: Number.isInteger(item?.imageOrdinal) ? item.imageOrdinal : null,
    fieldPresence: Array.isArray(item?.fieldPresence)
      ? item.fieldPresence.map(sanitizeText).filter(Boolean)
      : [],
  };
}

function richName(item, dict, kind, context) {
  const source = typeof item === "string" ? { nameCn: item } : item;
  const mapped = mapName(source?.nameCn || source?.name || "", dict, context.jaEntries);
  const canonicalId = kind === "hero" ? canonicalHeroId(mapped.name) : tacticIdResolver(dict)(mapped.name);
  return {
    name: mapped.name,
    canonicalId,
    ...(kind === "hero" ? { familyId: heroFamilyId(mapped.name) } : {}),
    confidence: mapped.confidence,
    rawChinese: mapped.rawChinese,
    rawTextTrust: "untrusted",
    normalizedText: normalizeText(mapped.name),
    score: mapped.match.score,
    secondScore: mapped.match.secondScore,
    margin: mapped.match.margin,
    ambiguous: mapped.match.ambiguous,
    reviewRequired: mapped.match.reviewRequired,
    runnerUp: mapped.match.secondRecord?.viet || null,
    dictionaryLinkScore: Number.isFinite(mapped.match.record?.linkScore)
      ? mapped.match.record.linkScore
      : null,
    imageOrdinal: Number.isInteger(source?.imageOrdinal) ? source.imageOrdinal : null,
    evidence: evidenceFor(source, context),
  };
}

export function mapHeroesScan(result, { heroesDict, jaEntries = null }) {
  return {
    heroes: (result?.heroes || []).map((hero) => {
      const mapped = mapName(hero.nameCn || hero.name || "", heroesDict, jaEntries);
      const out = { name: mapped.name, confidence: mapped.confidence };
      if (Number.isFinite(hero.redStars)) out.redStars = hero.redStars;
      if (Number.isFinite(hero.level)) out.level = hero.level;
      return out;
    }).filter((h) => h.name),
  };
}

export function mapHeroesScanRich(result, context) {
  return {
    heroes: (result?.heroes || []).map((hero) => ({
      ...richName(hero, context.heroesDict, "hero", context),
      ...(Number.isFinite(hero.redStars) ? { redStars: hero.redStars } : {}),
      ...(Number.isFinite(hero.level) ? { level: hero.level } : {}),
    })),
  };
}

export function mapTacticsScan(result, { tacticsDict, jaEntries = null }) {
  return {
    tactics: (result?.tactics || []).map((tactic) => {
      const mapped = mapName(tactic.nameCn || tactic.name || "", tacticsDict, jaEntries);
      return { name: mapped.name, confidence: mapped.confidence };
    }).filter((t) => t.name),
  };
}

export function mapTacticsScanRich(result, context) {
  return {
    tactics: (result?.tactics || []).map((tactic) =>
      richName(tactic, context.tacticsDict, "tactic", context),
    ),
  };
}

export function mapBuiltTeamsScan(result, { heroesDict, tacticsDict, jaEntries = null }) {
  return {
    teams: (result?.teams || []).map((team) => ({
      teamName: team.teamName || team.name || L("Đội đã được lập", "已组建的队伍", "編成済みの部隊"),
      heroes: (team.heroesCn || team.heroes || []).map((name) => mapName(name, heroesDict, jaEntries).name).filter(Boolean),
      tactics: (team.tacticsCn || team.tactics || []).map((name) => mapName(name, tacticsDict, jaEntries).name).filter(Boolean),
    })),
  };
}

export function mapBuiltTeamsScanRich(result, context) {
  return {
    teams: (result?.teams || []).map((team) => ({
      teamName: sanitizeText(team.teamName || team.name || L("Đội đã được lập", "已组建的队伍", "編成済みの部隊")),
      heroSlots: (team.heroes || team.heroesCn || []).map((hero) => ({
        hero: richName(hero, context.heroesDict, "hero", context),
        tactics: (hero.tacticsCn || hero.tactics || []).map((tactic) =>
          richName(
            typeof tactic === "string" ? { nameCn: tactic } : tactic,
            context.tacticsDict,
            "tactic",
            context,
          ),
        ),
        imageOrdinal: Number.isInteger(hero.imageOrdinal) ? hero.imageOrdinal : null,
      })),
      evidence: evidenceFor(team, context),
    })),
  };
}
