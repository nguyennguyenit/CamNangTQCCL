import { matchDict } from "./match-dict.js";
import { normalizeText } from "./filters.js";
import { canonicalHeroId, heroFamilyId } from "./hero-identity.js";
import { toVietHanViet } from "./hanviet.js";

const MAX_UNTRUSTED_TEXT = 256;

function sanitizeText(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_UNTRUSTED_TEXT);
}

function canonicalTacticId(name) {
  return `tactic:${normalizeText(name).replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "")}`;
}

function mapName(cn, dict) {
  const rawChinese = sanitizeText(cn);
  const m = matchDict(rawChinese, dict || []);
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
  const mapped = mapName(source?.nameCn || source?.name || "", dict);
  const canonicalId =
    kind === "hero" ? canonicalHeroId(mapped.name) : canonicalTacticId(mapped.name);
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

export function mapHeroesScan(result, { heroesDict }) {
  return {
    heroes: (result?.heroes || []).map((hero) => {
      const mapped = mapName(hero.nameCn || hero.name || "", heroesDict);
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

export function mapTacticsScan(result, { tacticsDict }) {
  return {
    tactics: (result?.tactics || []).map((tactic) => {
      const mapped = mapName(tactic.nameCn || tactic.name || "", tacticsDict);
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

export function mapBuiltTeamsScan(result, { heroesDict, tacticsDict }) {
  return {
    teams: (result?.teams || []).map((team) => ({
      teamName: team.teamName || team.name || "Đội đã được lập",
      heroes: (team.heroesCn || team.heroes || []).map((name) => mapName(name, heroesDict).name).filter(Boolean),
      tactics: (team.tacticsCn || team.tactics || []).map((name) => mapName(name, tacticsDict).name).filter(Boolean),
    })),
  };
}

export function mapBuiltTeamsScanRich(result, context) {
  return {
    teams: (result?.teams || []).map((team) => ({
      teamName: sanitizeText(team.teamName || team.name || "Đội đã được lập"),
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
