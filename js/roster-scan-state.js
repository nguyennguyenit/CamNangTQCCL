import { L } from "./i18n.js";

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
    tacticOverrides: [],
    scans: {},
    seasonId: null,
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
    teamName: String(team?.teamName || team?.name || L("Đội đã được lập", "已组建的队伍")).trim(),
    heroes: [...new Set((team?.heroes || []).map((h) => String(h).trim()).filter(Boolean))],
    tactics: [...new Set((team?.tactics || []).map((t) => String(t).trim()).filter(Boolean))],
  };
}

function lockedTeamKey(team) {
  return JSON.stringify([[...team.heroes].sort(), [...team.tactics].sort()]);
}

/**
 * Tối đa khi THÊM đội khóa (server không đếm riêng, xem docs/roster-sync.md): đầy thì bỏ bản cũ nhất, UI báo qua
 * `droppedLockedTeams`. Nạp/lưu dữ liệu đã có không cắt (khách cũ, hộp cloud gộp nhiều máy), kẻo xóa mất đội của người dùng.
 */
export const MAX_LOCKED_TEAMS = 30;

/** Đội khóa trùng tướng + chiến pháp (không kể thứ tự) chỉ giữ bản đầu tiên. */
function dedupeLockedTeams(teams) {
  const seen = new Set();
  return (teams || []).map(normalizeLockedTeam).filter((team) => {
    const key = lockedTeamKey(team);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Kết quả đọc ảnh vào kho. `droppedLockedTeams` (không lưu, `serializeRosterScanState` bỏ) = số đội khóa cũ bị loại
 * vì vượt `MAX_LOCKED_TEAMS`; UI phải báo.
 */
export function applyScanResult(state, type, result) {
  const next = serializeRosterScanState(state || createInitialRosterScanState());
  let droppedLockedTeams = 0;
  if (type === "heroes") {
    next.ownedHeroes = uniqByName([...(next.ownedHeroes || []), ...(result?.heroes || [])]);
  } else if (type === "tactics") {
    next.ownedTactics = uniqByName([...(next.ownedTactics || []), ...(result?.tactics || [])]);
  } else if (type === "builtTeams") {
    const all = dedupeLockedTeams([...(next.lockedTeams || []), ...(result?.teams || [])]);
    next.lockedTeams = all.slice(-MAX_LOCKED_TEAMS);
    droppedLockedTeams = all.length - next.lockedTeams.length;
  }
  const now = new Date().toISOString();
  if (SCAN_TYPES.includes(type)) {
    next.scans = { ...next.scans, [type]: { images: Math.min((next.scans[type]?.images || 0) + 1, MAX_SCAN_IMAGES), at: now } };
  }
  next.confirmed = false;
  next.updatedAt = now;
  return { ...next, droppedLockedTeams };
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

export function removeLockedTeam(state, index) {
  return {
    ...state,
    lockedTeams: (state?.lockedTeams || []).filter((_, position) => position !== index),
    confirmed: false,
  };
}

export const MAX_TACTIC_OVERRIDES = 20;
const overrideKey = (override) => `${override.teamId}\u0000${override.heroIndex}\u0000${override.slotIndex}`;
const boundedIndex = (value) => Number.isInteger(value) && value >= 0 && value < 10;
const boundedText = (value, max) => typeof value === "string" && value.trim() !== "" && value.length <= max;

const SCAN_TYPES = ["heroes", "tactics", "builtTeams"];
const MAX_SCAN_IMAGES = 999;

/** Số ảnh đã đọc + lần đọc gần nhất của từng loại (thẻ đọc ảnh hiện "3 ảnh · 2 phút trước"). */
function cleanScans(scans) {
  const out = {};
  for (const type of SCAN_TYPES) {
    const item = scans?.[type];
    if (!item || typeof item !== "object") continue;
    const images = Number.isInteger(item.images) && item.images > 0 ? Math.min(item.images, MAX_SCAN_IMAGES) : 0;
    const at = boundedText(item.at, 40) && !Number.isNaN(Date.parse(item.at)) ? item.at : null;
    if (images && at) out[type] = { images, at };
  }
  return out;
}

/** Món bù đã chọn: mỗi ô (đội + tướng + ô chiến pháp) một món, lần chọn sau thay lần trước. */
function cleanTacticOverrides(overrides) {
  const bySlot = new Map();
  for (const item of Array.isArray(overrides) ? overrides : []) {
    if (!item || typeof item !== "object") continue;
    const { teamId, heroIndex, slotIndex, tactic } = item;
    if (!boundedText(teamId, 128) || !boundedIndex(heroIndex) || !boundedIndex(slotIndex) || !boundedText(tactic, 80)) continue;
    const override = { teamId, heroIndex, slotIndex, tactic };
    bySlot.delete(overrideKey(override));
    bySlot.set(overrideKey(override), override);
  }
  // Không bao giờ bỏ âm thầm: `setTacticOverride` từ chối món mới khi đầy (xem `tacticOverrideBlocked`);
  // quá trần ở đây chỉ gặp với dữ liệu lưu bị sửa tay, giữ các lựa chọn cũ nhất theo thứ tự.
  return [...bySlot.values()].slice(0, MAX_TACTIC_OVERRIDES);
}

/**
 * Đã đầy: thêm món bù cho một ô MỚI sẽ vượt `MAX_TACTIC_OVERRIDES`. Đổi món của ô đã có hoặc bỏ món vẫn được.
 * UI phải báo cho người dùng thay vì để lần chọn biến mất.
 */
export function tacticOverrideBlocked(state, { teamId, heroIndex, slotIndex }) {
  const list = state?.tacticOverrides || [];
  return list.length >= MAX_TACTIC_OVERRIDES && !list.some((item) => overrideKey(item) === overrideKey({ teamId, heroIndex, slotIndex }));
}

/**
 * Đặt (hoặc bỏ, khi `tactic` rỗng) món bù cho một ô thiếu. Khi đã đầy mà ô là ô mới: trả lại `state`
 * nguyên vẹn (không bỏ lựa chọn nào); gọi `tacticOverrideBlocked` trước để báo người dùng.
 */
export function setTacticOverride(state, { teamId, heroIndex, slotIndex, tactic }) {
  if (tactic && tacticOverrideBlocked(state, { teamId, heroIndex, slotIndex })) return state;
  const others = (state?.tacticOverrides || []).filter((item) => overrideKey(item) !== overrideKey({ teamId, heroIndex, slotIndex }));
  return {
    ...state,
    tacticOverrides: cleanTacticOverrides(tactic ? [...others, { teamId, heroIndex, slotIndex, tactic }] : others),
  };
}

/** Kho trống như lần đầu mở công cụ (tướng, chiến pháp, đội khóa đều bỏ). */
export function clearRosterScanState() {
  return createInitialRosterScanState();
}

export function serializeRosterScanState(state) {
  return {
    ownedHeroes: uniqByName(state?.ownedHeroes || []),
    ownedTactics: uniqByName(state?.ownedTactics || []),
    lockedTeams: dedupeLockedTeams(state?.lockedTeams),
    tacticOverrides: cleanTacticOverrides(state?.tacticOverrides),
    scans: cleanScans(state?.scans),
    seasonId: boundedText(state?.seasonId, 64) ? state.seasonId : null,
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
