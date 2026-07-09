export const ROSTER_SCAN_STORAGE_KEY = "tqccl.rosterRecommend.scanState.v1";

const FORBIDDEN_KEYS = new Set(["image", "imageDataUrl", "base64", "blob", "turnstileToken"]);

export function createInitialRosterScanState() {
  return {
    ownedHeroes: [],
    ownedTactics: [],
    lockedTeams: [],
    confirmed: false,
    updatedAt: null,
  };
}

function cleanItem(item) {
  const out = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

function uniqByName(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const clean = cleanItem(item);
    const name = String(clean.name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ ...clean, name });
  }
  return out;
}

function normalizeLockedTeam(team) {
  return {
    teamName: String(team?.teamName || team?.name || "Team đã build").trim(),
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
