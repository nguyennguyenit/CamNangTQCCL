// Trạng thái thuần của kho/đội đồng bộ qua `/api/roster` (hợp đồng: docs/roster-sync.md). Không chạm mạng hay storage:
// mọi hàm nhận state và trả state mới (hoặc chính state đó khi không đổi). `js/roster-sync.js` lo kéo/đẩy và lưu blob
// `tqccl.roster.cloud.v1` = `{userId, cursor, pulledKinds, records, dirty, rejected}`.
//
// - `records`: khóa `kind:id` → bản ghi theo dạng dây `{kind, id, boxId, updatedAt, rev?, deleted, data}`; bản xóa mềm vẫn
//   được giữ (gộp kho local không được tạo lại khóa đã xóa trên cloud). Bản chưa lên server không có `rev`.
// - `dirty`: khóa → `updatedAt` của phiên bản cần đẩy. Chỉ bỏ khỏi dirty khi phiên bản hiện tại vẫn là bản đã gửi.
// - Đóng dấu Lamport: `updatedAt = max(now, lớn nhất đã thấy + 1)` như `stamp` của `js/recruit-tracker-store.js`.

export const CLOUD_STORAGE_KEY = "tqccl.roster.cloud.v1";
export const MERGED_STORAGE_KEY = "tqccl.roster.merged.v1";
export const MAIN_BOX_ID = "main";
export const ROSTER_KINDS = ["box", "owned", "season", "locked", "override", "group", "team"];
/** Thứ tự đẩy: hộp trước rồi tới nhóm, để hộp + con vào cùng request (hoặc hộp ở lô trước). */
const PUSH_ORDER = new Map(["box", "group", "season", "owned", "locked", "override", "team"].map((kind, index) => [kind, index]));
export const DEFAULT_GROUPS = [
  { suffix: "khai-hoang", name: "Khai Hoang", order: 0 },
  { suffix: "ghep-team", name: "Ghép Team", order: 1 },
];
const MAIN_BOX_NAME = "Hộp chính";
const FALLBACK_BOX_NAME = "Hộp kho";
const SCAN_OWNED_TYPES = [
  { key: "ownedHeroes", type: "hero", resolveType: "heroes" },
  { key: "ownedTactics", type: "tactic", resolveType: "tactics" },
];
const MAX_REJECTED = 50;

export const recordKey = (kind, id) => `${kind}:${id}`;
const isoOf = (ms) => new Date(ms).toISOString();
const isObj = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/* ---------- SHA-256 đồng bộ (16 hex đầu) ---------- */
// Id override/locked cần băm lúc dựng bản ghi trong hàm thuần đồng bộ; `crypto.subtle` bất đồng bộ và chỉ có ở ngữ
// cảnh an toàn. Kiểm bằng Web Crypto trong tests-js/roster-cloud-store.test.mjs.

const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex16(text) {
  const bytes = new TextEncoder().encode(String(text));
  const length = bytes.length;
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((length * 8) / 2 ** 32));
  view.setUint32(padded.length - 4, (length * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return [h[0], h[1]].map((word) => word.toString(16).padStart(8, "0")).join("");
}

/* ---------- Khóa bản ghi ---------- */

/** `lockedTeamKey`: 16 hex của SHA-256 trên bộ ID tướng + chiến pháp đã sắp xếp (không phụ thuộc thứ tự mảng). */
export function lockedTeamKey(team, resolve) {
  const ids = [
    ...(team?.heroes || []).map((name) => resolve.looseId("heroes", name)),
    ...(team?.tactics || []).map((name) => resolve.looseId("tactics", name)),
  ].sort();
  return sha256Hex16(ids.join("\n"));
}

/** `${boxId}~${sha256hex16(teamId)}~${heroIndex}~${slotIndex}`; `teamId` thô có thể chứa chữ Hán nên không vào id. */
export const overrideRecordId = (boxId, teamId, heroIndex, slotIndex) => `${boxId}~${sha256Hex16(teamId)}~${heroIndex}~${slotIndex}`;

/* ---------- State ---------- */

export function emptyCloudState(userId) {
  return { userId, cursor: 0, pulledKinds: [], records: {}, dirty: {}, rejected: [] };
}

/** Đồng hồ Lamport: `updatedAt` lớn nhất trong mọi bản ghi (kể cả bản kéo về từ máy khác). */
export function clockOf(state) {
  let max = 0;
  for (const record of Object.values(state.records)) if (record.updatedAt > max) max = record.updatedAt;
  return max;
}

export const nextStamp = (state, now = Date.now()) => Math.max(now, clockOf(state) + 1);

function normalizeRecord(raw) {
  if (!isObj(raw) || typeof raw.kind !== "string" || typeof raw.id !== "string") return null;
  if (!Number.isSafeInteger(raw.updatedAt) || !isObj(raw.data)) return null;
  const record = {
    kind: raw.kind,
    id: raw.id,
    boxId: raw.kind === "box" ? null : typeof raw.boxId === "string" ? raw.boxId : (raw.data.boxId ?? null),
    updatedAt: raw.updatedAt,
    deleted: raw.deleted === true || raw.deleted === 1,
    data: raw.data,
  };
  if (Number.isSafeInteger(raw.rev)) record.rev = raw.rev;
  if (Number.isSafeInteger(raw.acked)) record.acked = raw.acked;
  return record;
}

/** Blob đọc từ storage → state hợp lệ của `userId`, hoặc `null` (hỏng / của người khác). */
export function normalizeCloudState(raw, userId) {
  if (!isObj(raw) || typeof raw.userId !== "string" || (userId && raw.userId !== userId)) return null;
  const state = emptyCloudState(raw.userId);
  if (Number.isSafeInteger(raw.cursor) && raw.cursor > 0) state.cursor = raw.cursor;
  state.pulledKinds = canonicalKinds(Array.isArray(raw.pulledKinds) ? raw.pulledKinds : []);
  for (const candidate of isObj(raw.records) ? Object.values(raw.records) : []) {
    const record = normalizeRecord(candidate);
    if (record) state.records[recordKey(record.kind, record.id)] = record;
  }
  for (const [key, ts] of Object.entries(isObj(raw.dirty) ? raw.dirty : {})) {
    if (state.records[key] && Number.isSafeInteger(ts)) state.dirty[key] = ts;
  }
  state.rejected = (Array.isArray(raw.rejected) ? raw.rejected : []).filter((item) => isObj(item) && typeof item.key === "string").slice(-MAX_REJECTED);
  return state;
}

export function canonicalKinds(kinds) {
  return ROSTER_KINDS.filter((kind) => kinds.includes(kind));
}

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isObj(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const sameData = (a, b) => stable(a) === stable(b);
const bodyOf = ({ updatedAt: _u, deletedAt: _d, ...rest }) => rest;
const sameBody = (a, b) => sameData(bodyOf(a), bodyOf(b));

/** Bản ghi của hộp bị xóa: bỏ mọi bản ghi con (và dirty của chúng) khỏi `records`/`dirty` đã sao chép. */
function pruneBoxChildren(records, dirty, boxId) {
  for (const [key, record] of Object.entries(records)) {
    if (record.kind !== "box" && record.boxId === boxId) {
      delete records[key];
      delete dirty[key];
    }
  }
}

function pruneDeletedBoxes(records, dirty) {
  for (const record of Object.values(records)) if (record.kind === "box" && record.deleted) pruneBoxChildren(records, dirty, record.id);
}

/* ---------- Ghi tại chỗ ---------- */

/** Sao chép một lần, cho `fn` ghi qua `draft`; trả state cũ nếu không có gì đổi. */
function edit(state, now, fn) {
  const next = { ...state, records: { ...state.records }, dirty: { ...state.dirty } };
  const stamp = nextStamp(state, now);
  let changed = false;
  const draft = {
    /** Ghi bản sống; trả `false` khi nội dung không đổi (không đóng dấu lại). */
    put(kind, id, boxId, body) {
      const key = recordKey(kind, id);
      const data = { id, ...(kind === "box" ? {} : { boxId }), ...body, updatedAt: isoOf(stamp), deletedAt: "" };
      const old = next.records[key];
      if (old && !old.deleted && sameBody(old.data, data)) return false;
      next.records[key] = { kind, id, boxId: kind === "box" ? null : boxId, updatedAt: stamp, deleted: false, data };
      next.dirty[key] = stamp;
      changed = true;
      return true;
    },
    has: (kind, id) => Object.hasOwn(next.records, recordKey(kind, id)),
    /** Xóa mềm; khóa chưa từng tồn tại hoặc đã xóa thì bỏ qua (server từ chối `not_found`). */
    tombstone(kind, id) {
      const key = recordKey(kind, id);
      const old = next.records[key];
      if (!old || old.deleted) return false;
      const boxId = kind === "box" ? null : old.boxId;
      next.records[key] = {
        kind,
        id,
        boxId,
        updatedAt: stamp,
        deleted: true,
        data: { id, updatedAt: isoOf(stamp), deletedAt: isoOf(stamp), boxId: boxId ?? id },
      };
      next.dirty[key] = stamp;
      if (kind === "box") pruneBoxChildren(next.records, next.dirty, id);
      changed = true;
      return true;
    },
    records: next.records,
  };
  fn(draft);
  return changed ? next : state;
}

/** Ghi một bản ghi sống tuỳ ý (`data` chỉ gồm trường riêng của kind; id/boxId/updatedAt/deletedAt do store thêm). */
export function putRecord(state, { kind, id, boxId = null, data }, { now = Date.now() } = {}) {
  return edit(state, now, (draft) => draft.put(kind, id, boxId, data));
}

export function removeRecord(state, kind, id, { now = Date.now() } = {}) {
  return edit(state, now, (draft) => draft.tombstone(kind, id));
}

/**
 * Idempotent: hộp + hai nhóm mặc định `${boxId}~khai-hoang`/`${boxId}~ghep-team`; với `main` thêm `season main` khi biết
 * `seasonId`. Chỉ tạo khóa chưa có (kể cả khi trên cloud là bản đã xóa). Người gọi CHỈ gọi sau một lần kéo thành công có phủ các
 * kind `box`/`group` (`js/roster-sync.js` kiểm); `groups: false` khi không kéo `group`.
 */
export function ensureBoxDefaults(state, boxId, { name, seasonId, groups = true, now = Date.now() } = {}) {
  return edit(state, now, (draft) => {
    if (!draft.has("box", boxId)) draft.put("box", boxId, null, { name: name || (boxId === MAIN_BOX_ID ? MAIN_BOX_NAME : FALLBACK_BOX_NAME) });
    // `groups: false` cho trang không kéo kind `group` (Gợi ý đội): không biết nhóm đã có chưa thì không dựng lại với dấu mới.
    for (const group of groups ? DEFAULT_GROUPS : []) {
      const id = `${boxId}~${group.suffix}`;
      if (!draft.has("group", id)) draft.put("group", id, boxId, { name: group.name, order: group.order });
    }
    if (boxId === MAIN_BOX_ID && seasonId && !draft.has("season", boxId)) draft.put("season", boxId, boxId, { seasonId });
  });
}

/* ---------- Đọc ---------- */

const liveData = (state, kind, boxId) =>
  Object.values(state.records)
    .filter((record) => record.kind === kind && !record.deleted && (boxId === undefined || record.boxId === boxId))
    .sort((a, b) => a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : 1))
    .map((record) => record.data);

export function boxes(state) {
  return liveData(state, "box").sort((a, b) => (b.id === MAIN_BOX_ID) - (a.id === MAIN_BOX_ID));
}
export const ownedOf = (state, boxId) => liveData(state, "owned", boxId);
export const lockedOf = (state, boxId) => liveData(state, "locked", boxId);
export const overridesOf = (state, boxId) => liveData(state, "override", boxId);
export const teamsOf = (state, boxId) => liveData(state, "team", boxId);
export const groupsOf = (state, boxId) => liveData(state, "group", boxId).sort((a, b) => a.order - b.order);
export const seasonOf = (state, boxId) => liveData(state, "season", boxId)[0] ?? null;

/* ---------- Kho Gợi ý đội <-> bản ghi ---------- */

const encoder = new TextEncoder();
// Cùng cách đếm với server (docs/roster-sync.md § Giới hạn chữ tự do): byte UTF-8 sau JSON escape, không tính dấu ngoặc kép.
const escapedBytes = (text) => encoder.encode(JSON.stringify(text)).byteLength - 2;
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u;
const textFits = (value, max, { min = 1 } = {}) => typeof value === "string" && value.length >= min && escapedBytes(value) <= max && !CONTROL.test(value);

function lockedBody(team) {
  const fits =
    textFits(team.teamName, 180, { min: 0 }) &&
    team.heroes.length <= 3 &&
    team.tactics.length <= 6 &&
    [...team.heroes, ...team.tactics].every((name) => textFits(name, 80)) &&
    (team.teamId === undefined || textFits(team.teamId, 128)) &&
    (team.configId === undefined || textFits(team.configId, 128)) &&
    (team.seasonContext === undefined || (textFits(team.seasonContext.scenarioId, 128) && textFits(team.seasonContext.rulesetId, 128)));
  if (!fits) return null;
  return {
    teamName: team.teamName,
    heroes: [...team.heroes],
    tactics: [...team.tactics],
    ...(team.teamId ? { teamId: team.teamId } : {}),
    ...(team.configId ? { configId: team.configId } : {}),
    ...(team.seasonContext ? { seasonContext: { scenarioId: team.seasonContext.scenarioId, rulesetId: team.seasonContext.rulesetId } } : {}),
  };
}

/**
 * Bản ghi mong muốn của một kho local trong hộp `boxId` + những món không đẩy được (`localOnly`: ngoài từ điển, quá
 * trần byte, ký tự điều khiển).
 */
function desiredFromScan(boxId, scan, resolve) {
  const records = [];
  const localOnly = { heroes: [], tactics: [], lockedTeams: [], overrides: [] };
  const seen = new Set();
  const add = (kind, id, body) => {
    const key = recordKey(kind, id);
    if (seen.has(key)) return false;
    seen.add(key);
    records.push({ kind, id, body });
    return true;
  };
  for (const { key, type, resolveType } of SCAN_OWNED_TYPES) {
    for (const item of scan?.[key] || []) {
      const resolved = resolve.item(resolveType, item);
      if (!resolved) {
        localOnly[resolveType].push(typeof item === "string" ? item : item?.name);
        continue;
      }
      const stars = Number.isFinite(item?.redStars) ? Math.min(5, Math.max(0, Math.round(item.redStars))) : null;
      add("owned", `${boxId}~${resolved.id}`, { item: resolved.id, name: resolved.name, type, ...(stars === null ? {} : { redStars: stars }) });
    }
  }
  for (const team of scan?.lockedTeams || []) {
    const body = lockedBody(team);
    if (!body) localOnly.lockedTeams.push(team.teamName);
    else add("locked", `${boxId}~${lockedTeamKey(team, resolve)}`, body);
  }
  for (const override of scan?.tacticOverrides || []) {
    const { teamId, heroIndex, slotIndex, tactic } = override;
    if (!textFits(teamId, 128) || !textFits(tactic, 80)) {
      localOnly.overrides.push(`${teamId}`);
      continue;
    }
    add("override", overrideRecordId(boxId, teamId, heroIndex, slotIndex), { teamId, heroIndex, slotIndex, tactic });
  }
  const seasonId = textFits(scan?.seasonId, 64) ? scan.seasonId : null;
  return { records, localOnly, seasonId };
}

/**
 * Gộp kho local lần đầu vào hộp `boxId` (mặc định `main`): hộp, nhóm mặc định, season (nếu cloud chưa có) rồi mỗi món,
 * đội khóa, món bù CHỈ khi khóa chưa tồn tại trên cloud (kể cả bản đã xóa). Chạy lại sau gộp dở không nhân đôi.
 */
export function mergeLocal(state, scan, resolve, { boxId = MAIN_BOX_ID, groups = true, now = Date.now() } = {}) {
  const desired = desiredFromScan(boxId, scan, resolve);
  const base = ensureBoxDefaults(state, boxId, { seasonId: desired.seasonId, groups, now });
  let created = 0;
  const next = edit(base, now, (draft) => {
    for (const { kind, id, body } of desired.records) {
      if (!draft.has(kind, id) && draft.put(kind, id, boxId, body)) created += 1;
    }
  });
  return { state: next, localOnly: desired.localOnly, created };
}

/**
 * Ghi kho Gợi ý đội của `boxId` sau một thay đổi trên UI: thêm/sửa/hồi sinh món, đội khóa, món bù; `seasonId` đổi thì ghi
 * lại (kho chưa có mùa thì giữ nguyên bản cloud). Xóa mềm chỉ theo CHÊNH LỆCH tường minh: khóa có trong `previous` (kho UI
 * trước thay đổi) mà không còn trong `scan`. Không có `previous` thì không xóa gì. Bản cloud mà client không dựng được
 * (ngoài từ điển bản này, hay do máy khác thêm) không bao giờ nằm trong chênh lệch nên không bị xóa.
 */
export function writeScanState(state, boxId, scan, resolve, { now = Date.now(), previous = null, groups = true } = {}) {
  const desired = desiredFromScan(boxId, scan, resolve);
  const base = ensureBoxDefaults(state, boxId, { groups, now });
  const wanted = new Set(desired.records.map(({ kind, id }) => recordKey(kind, id)));
  const removed = previous ? desiredFromScan(boxId, previous, resolve).records.map(({ kind, id }) => recordKey(kind, id)).filter((key) => !wanted.has(key)) : [];
  const next = edit(base, now, (draft) => {
    for (const { kind, id, body } of desired.records) draft.put(kind, id, boxId, body);
    for (const key of removed) {
      const record = draft.records[key];
      if (record && record.boxId === boxId && !record.deleted) draft.tombstone(record.kind, record.id);
    }
    if (desired.seasonId) draft.put("season", boxId, boxId, { seasonId: desired.seasonId });
  });
  return { state: next, localOnly: desired.localOnly };
}

/** Kho của hộp dưới dạng state của `js/roster-scan-state.js` (`scans`/`confirmed` chỉ ở máy, không đồng bộ). */
export function toScanState(state, boxId) {
  const items = (type) =>
    ownedOf(state, boxId)
      .filter((data) => data.type === type)
      .map((data) => ({ name: data.name, confidence: "manual", ...(Number.isFinite(data.redStars) ? { redStars: data.redStars } : {}) }));
  return {
    ownedHeroes: items("hero"),
    ownedTactics: items("tactic"),
    lockedTeams: lockedOf(state, boxId).map(({ id: _i, boxId: _b, updatedAt: _u, deletedAt: _d, ...team }) => team),
    tacticOverrides: overridesOf(state, boxId).map(({ teamId, heroIndex, slotIndex, tactic }) => ({ teamId, heroIndex, slotIndex, tactic })),
    scans: {},
    seasonId: seasonOf(state, boxId)?.seasonId ?? null,
    confirmed: false,
    updatedAt: null,
  };
}

/* ---------- Kéo / gộp / kết quả đẩy ---------- */

/**
 * Áp bản ghi kéo về theo LWW: bản mới hơn thắng, hòa nhận bản server (hòa khác payload → bản local dirty bị mất và được
 * báo trong `lost`). Bản local dirty mới hơn bản server được giữ để đẩy. Bản xóa của hộp bỏ mọi bản ghi con. Trang rỗng với
 * `cursor` thấp hơn con trỏ local → con trỏ về 0 và `reset: true` (kéo lại toàn bộ).
 */
export function applyPull(state, incoming, cursor) {
  const records = { ...state.records };
  const dirty = { ...state.dirty };
  const lost = [];
  for (const raw of incoming) {
    const remote = normalizeRecord(raw);
    if (!remote) continue;
    const key = recordKey(remote.kind, remote.id);
    const local = records[key];
    if (local) {
      if (remote.updatedAt < local.updatedAt) continue;
      const pending = dirty[key];
      if (pending !== undefined && !(remote.updatedAt === local.updatedAt && remote.deleted === local.deleted && sameData(remote.data, local.data))) {
        lost.push(toWire(local));
      }
    }
    records[key] = remote;
    delete dirty[key];
    if (remote.kind === "box" && remote.deleted) pruneBoxChildren(records, dirty, remote.id);
  }
  // Trang rỗng mà `cursor` của server thấp hơn con trỏ local: con trỏ lệch (D1 khôi phục, hoặc đã lấy nhầm của tài khoản khác) và
  // đã bỏ sót bản ghi: về 0 để kéo lại toàn bộ (`reset` báo cho vòng kéo chạy tiếp).
  const reset = incoming.length === 0 && Number.isSafeInteger(cursor) && cursor < state.cursor;
  const next = { ...state, records, dirty, cursor: reset ? 0 : Number.isSafeInteger(cursor) ? Math.max(state.cursor, cursor) : state.cursor };
  return { state: next, lost, reset };
}

/** Bản ghi dạng gửi/trả cho người dùng (không `rev`). */
const toWire = (record) => ({ kind: record.kind, id: record.id, updatedAt: record.updatedAt, deleted: record.deleted, data: record.data });

/** Các bản ghi dirty theo thứ tự đẩy (hộp trước, rồi nhóm…; cùng loại theo `updatedAt`). */
export function pendingPush(state) {
  return Object.keys(state.dirty)
    .map((key) => state.records[key])
    .filter(Boolean)
    .sort((a, b) => PUSH_ORDER.get(a.kind) - PUSH_ORDER.get(b.kind) || a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : 1))
    .map(toWire);
}

/**
 * Áp `results` của một lô đã gửi (`sent`). `applied`/`already-applied` → ACK nếu phiên bản hiện tại vẫn là bản đã gửi;
 * `conflict` → nhận bản server (bản thua trong `conflicts`); `rejected` → ra khỏi dirty, vào `rejected`.
 */
export function applyResults(state, sent, results) {
  const byKey = new Map((results || []).filter((r) => r && typeof r.kind === "string").map((r) => [recordKey(r.kind, r.id), r]));
  const records = { ...state.records };
  const dirty = { ...state.dirty };
  const conflicts = [];
  const rejected = [];
  for (const item of sent) {
    const key = recordKey(item.kind, item.id);
    const result = byKey.get(key);
    const current = records[key];
    if (!result || !current) continue;
    const unchanged = current.updatedAt === item.updatedAt;
    if (result.outcome === "applied" || result.outcome === "already-applied") {
      if (unchanged) {
        delete dirty[key];
        // Dấu "server đã nhận bản này": tab cũ còn giữ dirty của nó không đẩy lại (xem `mergeCloudStates`).
        records[key] = { ...current, acked: item.updatedAt };
      }
    } else if (result.outcome === "conflict") {
      const server = normalizeRecord(result.server);
      if (!server) continue;
      if (!unchanged && current.updatedAt > server.updatedAt) continue; // sửa tiếp sau khi gửi và mới hơn bản server: giữ để đẩy
      records[key] = server;
      delete dirty[key];
      conflicts.push({ key, loser: item, server: { ...toWire(server), boxId: server.boxId, rev: server.rev } });
      if (server.kind === "box" && server.deleted) pruneBoxChildren(records, dirty, server.id);
    } else if (result.outcome === "rejected") {
      if (unchanged) delete dirty[key];
      // Xóa khóa server chưa từng có: không có gì để xóa, không phải lỗi.
      if (result.code === "not_found" && item.deleted) continue;
      rejected.push({ key, kind: item.kind, id: item.id, code: String(result.code || "schema"), updatedAt: item.updatedAt, record: item });
    }
  }
  const kept = state.rejected.filter((old) => !rejected.some((item) => item.key === old.key));
  return { state: { ...state, records, dirty, rejected: [...kept, ...rejected].slice(-MAX_REJECTED) }, conflicts, rejected };
}

export function dismissRejected(state, key) {
  return state.rejected.some((item) => item.key === key) ? { ...state, rejected: state.rejected.filter((item) => item.key !== key) } : state;
}

/**
 * Gộp state của một tab với blob mới nhất trong storage (cùng `userId`): bản ghi theo `updatedAt`, hợp dirty, bỏ dirty
 * đã được server phủ, cursor chỉ tiến cùng bản có phạm vi kinds đủ.
 */
export function mergeCloudStates(a, b) {
  const records = { ...a.records };
  for (const [key, record] of Object.entries(b.records)) {
    const mine = records[key];
    if (!mine || record.updatedAt > mine.updatedAt || (record.updatedAt === mine.updatedAt && (record.rev !== undefined || record.acked !== undefined))) records[key] = record;
  }
  const dirty = { ...a.dirty };
  for (const [key, ts] of Object.entries(b.dirty)) dirty[key] = Math.max(dirty[key] ?? 0, ts);
  pruneDeletedBoxes(records, dirty);
  for (const [key, ts] of Object.entries(dirty)) {
    const record = records[key];
    // Bản server (có rev) hoặc bản đã được ACK (`acked`) đã phủ phiên bản dirty, hoặc bản ghi mới hơn đã thay thế: dirty cũ không còn ý nghĩa.
    if (!record || record.updatedAt > ts || (record.rev !== undefined && record.updatedAt >= ts) || (record.acked !== undefined && record.acked >= ts)) delete dirty[key];
  }
  const kinds = (state) => new Set(state.pulledKinds);
  const covers = (x, y) => [...kinds(y)].every((kind) => kinds(x).has(kind));
  let cursor;
  let pulledKinds;
  if (covers(a, b) && covers(b, a)) {
    cursor = Math.max(a.cursor, b.cursor);
    pulledKinds = a.pulledKinds;
  } else if (covers(a, b)) {
    ({ cursor, pulledKinds } = a);
  } else if (covers(b, a)) {
    ({ cursor, pulledKinds } = b);
  } else {
    cursor = 0;
    pulledKinds = canonicalKinds([...a.pulledKinds, ...b.pulledKinds]);
  }
  const rejected = [...a.rejected];
  for (const item of b.rejected) if (!rejected.some((old) => old.key === item.key && old.updatedAt === item.updatedAt)) rejected.push(item);
  return { userId: a.userId, cursor, pulledKinds, records, dirty, rejected: rejected.slice(-MAX_REJECTED) };
}

/* ---------- Cờ "đã hỏi/đã gộp" kho local, theo userId ---------- */

function readFlags(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(MERGED_STORAGE_KEY) ?? "null");
    return isObj(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** `"none"` (chưa hỏi) | `"merged"` | `"declined"`. */
export function mergeStatusOf(storage, userId) {
  const value = readFlags(storage)[userId];
  return value === "merged" || value === "declined" ? value : "none";
}

export function setMergeStatus(storage, userId, status) {
  try {
    storage?.setItem(MERGED_STORAGE_KEY, JSON.stringify({ ...readFlags(storage), [userId]: status }));
  } catch {
    // Storage chặn/đầy: lần sau hỏi lại, gộp vẫn đúng vì chỉ tạo khóa chưa có.
  }
}
