export const ROSTER_SCAN_STORAGE_KEY = "tqccl.rosterRecommend.scanState.v1";

const FORBIDDEN_KEYS = new Set([
  "image",
  "screenshot",
  "imagedataurl",
  "imageurl",
  "base64",
  "blob",
  "bytes",
  "turnstiletoken",
  "token",
  "apikey",
  "credential",
  "authorization",
  "secret",
  "providersecret",
  "path",
]);

const FORBIDDEN_KEY_SUFFIXES = [
  "image",
  "screenshot",
  "imagedataurl",
  "imageurl",
  "base64",
  "blob",
  "bytes",
  "token",
  "apikey",
  "credential",
  "authorization",
  "secret",
  "path",
];

const ITEM_KEYS = new Set([
  "name",
  "canonicalId",
  "familyId",
  "confidence",
  "redStars",
  "level",
  "rawChinese",
  "rawTextTrust",
  "normalizedText",
  "score",
  "secondScore",
  "margin",
  "ambiguous",
  "reviewRequired",
  "runnerUp",
  "dictionaryLinkScore",
  "imageOrdinal",
  "evidence",
]);

const EVIDENCE_KEYS = new Set([
  "observationId",
  "batchId",
  "sourceScope",
  "trust",
  "imageOrdinal",
  "fieldPresence",
]);

function isForbiddenKey(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    FORBIDDEN_KEYS.has(normalized) ||
    FORBIDDEN_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

export function createInitialRosterScanState() {
  return {
    ownedHeroes: [],
    ownedTactics: [],
    lockedTeams: [],
    confirmed: false,
    updatedAt: null,
  };
}

function cleanValue(value) {
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isForbiddenKey(key)) continue;
      if (nested === undefined || nested === null || nested === "") continue;
      out[key] = cleanValue(nested);
    }
    return out;
  }
  return value;
}

function cleanEvidence(evidence) {
  return Object.fromEntries(
    Object.entries(cleanValue(evidence || {})).filter(([key]) =>
      EVIDENCE_KEYS.has(key),
    ),
  );
}

function cleanItem(item) {
  const projected = Object.fromEntries(
    Object.entries(item || {}).filter(([key]) => ITEM_KEYS.has(key)),
  );
  if (Array.isArray(projected.evidence)) {
    projected.evidence = projected.evidence.map(cleanEvidence);
  }
  return cleanValue(projected);
}

function evidenceKey(evidence) {
  return JSON.stringify(evidence);
}

function mergeItems(current, next) {
  const evidence = [];
  const seenEvidence = new Set();
  for (const item of [...(current.evidence || []), ...(next.evidence || [])]) {
    const clean = cleanEvidence(item);
    const key = evidenceKey(clean);
    if (!seenEvidence.has(key)) {
      seenEvidence.add(key);
      evidence.push(clean);
    }
  }
  const merged = { ...current, ...next };
  for (const field of ["redStars", "level"]) {
    const values = [current[field], next[field]].filter(Number.isFinite);
    if (values.length) merged[field] = Math.max(...values);
  }
  if (evidence.length) merged.evidence = evidence;
  return merged;
}

function uniqByName(items) {
  const positions = new Map();
  const out = [];
  for (const item of items || []) {
    const clean = cleanItem(item);
    const name = String(clean.name || "").trim();
    if (!name) continue;
    const key = String(clean.canonicalId || name).trim();
    const position = positions.get(key);
    if (position === undefined) {
      positions.set(key, out.length);
      out.push({ ...clean, name });
    } else {
      out[position] = mergeItems(out[position], { ...clean, name });
    }
  }
  return out;
}

function normalizeLockedTeam(team) {
  return {
    ...(typeof team?.teamId === 'string' && team.teamId ? {teamId:team.teamId} : {}),
    ...(typeof team?.configId === 'string' && team.configId ? {configId:team.configId} : {}),
    ...(typeof team?.seasonContext?.scenarioId === 'string' && typeof team?.seasonContext?.rulesetId === 'string' ? {seasonContext:{scenarioId:team.seasonContext.scenarioId,rulesetId:team.seasonContext.rulesetId}} : {}),
    teamName: String(team?.teamName || team?.name || "Đội đã được lập").trim(),
    heroes: [...new Set((team?.heroes || []).map((h) => String(h).trim()).filter(Boolean))],
    tactics: [...new Set((team?.tactics || []).map((t) => String(t).trim()).filter(Boolean))],
  };
}

export function applyScanResult(state, type, result) {
  const next = serializeRosterScanState(state || createInitialRosterScanState());
  if (type === "heroes") {
    next.ownedHeroes = uniqByName([...(next.ownedHeroes || []), ...(result?.heroes || [])]);
  } else if (type === "tactics") {
    next.ownedTactics = uniqByName([...(next.ownedTactics || []), ...(result?.tactics || [])]);
  } else if (type === "builtTeams") {
    next.lockedTeams = [...(next.lockedTeams || []), ...(result?.teams || []).map(normalizeLockedTeam)];
  }
  next.confirmed = false;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function addCanonicalItem(state, type, name) {
  const key = type === "tactics" ? "ownedTactics" : "ownedHeroes";
  return {
    ...state,
    [key]: uniqByName([...(state?.[key] || []), { name, confidence: "manual" }]),
    confirmed: false,
  };
}

export function removeItem(state, type, name) {
  const key = type === "tactics" ? "ownedTactics" : "ownedHeroes";
  return {
    ...state,
    [key]: (state?.[key] || []).filter((item) => item.name !== name),
    confirmed: false,
  };
}

export function lockedConstraints(state) {
  return {
    heroes: [...new Set((state?.lockedTeams || []).flatMap((team) => team.heroes || []))],
    tactics: [...new Set((state?.lockedTeams || []).flatMap((team) => team.tactics || []))],
  };
}

export function serializeRosterScanState(state) {
  return {
    ownedHeroes: uniqByName(state?.ownedHeroes || []),
    ownedTactics: uniqByName(state?.ownedTactics || []),
    lockedTeams: (state?.lockedTeams || []).map(normalizeLockedTeam),
    confirmed: state?.confirmed === true,
    updatedAt: state?.updatedAt || null,
  };
}

export function deserializeRosterScanState(value) {
  try {
    return serializeRosterScanState(typeof value === "string" ? JSON.parse(value) : value);
  } catch {
    return createInitialRosterScanState();
  }
}
