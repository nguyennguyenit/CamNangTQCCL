// Lớp mỏng của "Đội của tôi" trên `createRosterSync` (js/roster-sync.js) cho các kind `box, group, team, owned`.
// Bộ nhớ đệm CHỈ nằm trong bộ nhớ của trang (một `storage` giả riêng), không ghi `localStorage`: đội là dữ liệu tài khoản,
// không có chế độ offline, và không để lại đội của người này trên máy dùng chung.
// `saveTeam` trả một trong:
//   {ok: true, outcome: "applied" | "already-applied", team}
//   {ok: false, conflict: true, server, loser}      server có bản mới hơn (bản của server là chuẩn)
//   {ok: false, rejected: true, code, errors?}      kiểm trước (`validation`/`schema`), không phiên (`guest`/`signed-out`/`mismatch`)
//                                                    hoặc server từ chối (`bytes`, `quota`, `cap`, …)
//   {ok: false, pending: true, code}                chưa rõ kết quả (mất mạng): bản nháp còn dirty, thử lại cùng `team.id`
// Thao tác hộp/nhóm/đội (`createBox`, `renameBox`, `deleteBox`, `createGroup`, `renameGroup`, `deleteGroup`, `moveTeam`,
// `deleteTeam`) trả cùng dạng `{ok: true, ...}` | `{ok: false, rejected: true, code}` | `{ok: false, pending: true, code}`.

import { api as defaultApi } from "./community-api.js";
import { escapedBytes, normalizeTeam, stripControl, validateTeam } from "./my-teams-model.js";
import { MAIN_BOX_ID, boxes, ensureBoxDefaults as ensureBoxDefaultsIn, groupsOf, putRecord, recordKey, removeRecord } from "./roster-cloud-store.js";
import { createRosterSync } from "./roster-sync.js";

export const MY_TEAMS_KINDS = ["box", "group", "team", "owned"];
/** Hộp thoại "Lưu vào đội của tôi" chỉ cần hộp + nhóm (không kéo cả kho `owned` của người dùng). */
export const SAVE_DIALOG_KINDS = ["box", "group"];

/** `localStorage` giả chỉ trong bộ nhớ: đủ cho `createRosterSync` đọc/ghi blob đệm mà không chạm đĩa. */
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}

const NAME_MAX_BYTES = 180;
const randomSuffix = () => [...globalThis.crypto.getRandomValues(new Uint8Array(6))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const rejected = (code) => ({ ok: false, rejected: true, code });
/** Tên hộp/nhóm: bỏ ký tự điều khiển, gọn khoảng trắng; rỗng hoặc quá 180 B là lỗi `validation` (không cắt im lặng). */
const cleanName = (name) => stripControl(String(name ?? "")).replace(/\s+/gu, " ").trim();
const nameError = (name) => (name && escapedBytes(name) <= NAME_MAX_BYTES ? null : rejected("validation"));

const teamBody = ({ id: _id, boxId: _boxId, updatedAt: _u, deletedAt: _d, ...body }) => body;

export function createMyTeamsApi({ api = defaultApi, kinds = MY_TEAMS_KINDS, onChange = () => {}, onConflict = () => {}, onRejected = () => {}, ...syncOptions } = {}) {
  /** Kết quả POST gần nhất theo khóa bản ghi (`applied`, `already-applied`, `rejected` + code). */
  const outcomes = new Map();
  /** Xung đột và từ chối của lần đồng bộ đang chờ, theo khóa bản ghi. */
  let conflicts = new Map();
  let rejections = new Map();

  const recordingApi = async (path, options) => {
    const response = await api(path, options);
    if (options?.method === "POST") {
      for (const result of response?.results || []) outcomes.set(recordKey(result.kind, result.id), result);
    }
    return response;
  };

  const sync = createRosterSync({
    ...syncOptions,
    kinds,
    storage: memoryStorage(),
    api: recordingApi,
    onChange,
    onConflict(conflict) {
      conflicts.set(conflict.key, conflict);
      onConflict(conflict);
    },
    onRejected(list) {
      for (const item of list) rejections.set(item.key, item);
      onRejected(list);
    },
  });

  const liveRecords = (state, kind) => Object.values(state?.records || {}).filter((record) => record.kind === kind && !record.deleted);

  /** Ảnh chụp đồng bộ từ bộ nhớ đệm: hộp, nhóm, đội đã chuẩn hóa (bản hỏng vào `skipped`) và kho theo hộp. */
  function snapshot() {
    const state = sync.state();
    const teams = [];
    const skipped = [];
    for (const record of liveRecords(state, "team")) {
      const team = normalizeTeam(record.data);
      if (team) teams.push({ ...team, boxId: record.boxId, updatedAt: record.data.updatedAt });
      else skipped.push({ id: record.id, boxId: record.boxId });
    }
    const owned = new Map();
    for (const record of liveRecords(state, "owned")) {
      const item = record.data?.item;
      if (typeof item !== "string") continue;
      if (!owned.has(record.boxId)) owned.set(record.boxId, new Set());
      owned.get(record.boxId).add(item);
    }
    const boxList = state ? boxes(state) : [];
    return {
      status: sync.status(),
      user: sync.user(),
      boxes: boxList,
      groups: boxList.flatMap((box) => groupsOf(state, box.id)),
      teams: teams.sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : a.id < b.id ? -1 : 1)),
      skipped,
      owned,
      rejected: sync.rejected(),
    };
  }

  async function load() {
    await sync.start();
    return snapshot();
  }

  /** Hộp + hai nhóm mặc định (idempotent), chỉ sau một lần kéo thành công. Trả `{ok}` hoặc `{ok: false, reason}` (không phiên, hoặc `offline`/`error` khi chưa kéo được). */
  const ensureBoxDefaults = (boxId = MAIN_BOX_ID) => sync.mutateAfterPull((state, { now }) => ensureBoxDefaultsIn(state, boxId, { now }));

  async function saveTeam(input, { boxId = MAIN_BOX_ID, defaultGroup = "ghep-team", groupId } = {}) {
    const team = normalizeTeam(input);
    if (!team) return { ok: false, rejected: true, code: "schema" };
    const full = { ...team, boxId, groupId: groupId ?? team.groupId ?? `${boxId}~${defaultGroup}` };
    const checked = validateTeam(full);
    if (!checked.ok) return { ok: false, rejected: true, code: "validation", errors: checked.errors };

    await sync.start();
    const ensured = await ensureBoxDefaults(boxId);
    if (!ensured.ok) return ensured.reason === "offline" || ensured.reason === "error" ? { ok: false, pending: true, code: ensured.reason } : { ok: false, rejected: true, code: ensured.reason };
    const key = recordKey("team", team.id);
    // Cùng nội dung → không đóng dấu lại: thử lại sau khi mất phản hồi gửi ĐÚNG bản đã gửi (server trả already-applied).
    const stored = await sync.mutate((state, { now }) => putRecord(state, { kind: "team", id: team.id, boxId, data: teamBody(full) }, { now }));
    if (!stored.ok) return { ok: false, rejected: true, code: stored.reason };

    outcomes.delete(key);
    conflicts = new Map();
    rejections = new Map();
    await sync.syncNow();

    const conflict = conflicts.get(key);
    if (conflict) return { ok: false, conflict: true, server: normalizeTeam(conflict.server?.data), loser: full };
    const rejection = rejections.get(key);
    if (rejection) return { ok: false, rejected: true, code: rejection.code };
    const result = outcomes.get(key);
    if (result?.outcome === "applied" || result?.outcome === "already-applied") return { ok: true, outcome: result.outcome, team: full };
    if (sync.state()?.dirty?.[key] !== undefined) {
      const status = sync.status();
      if (status === "signed-out" || status === "mismatch") return { ok: false, rejected: true, code: status };
      return { ok: false, pending: true, code: status };
    }
    // Không có phản hồi POST nhưng khóa đã sạch: lần kéo trước khi đẩy đã thấy đúng bản này trên server — trừ khi hộp đã bị
    // xóa từ máy khác và lần kéo dọn luôn đội này khỏi bộ nhớ đệm (không có gì được lưu). Không có `rev`/`acked` thì server chưa
    // từng xác nhận bản này: không báo thành công.
    const found = live("team", team.id);
    if (!found) return { ok: false, rejected: true, code: "box_missing" };
    if (found.rev === undefined && found.acked === undefined) return { ok: false, pending: true, code: sync.status() };
    return { ok: true, outcome: "already-applied", team: full };
  }

  /** Đẩy ngay rồi đọc kết quả của đúng các khóa vừa ghi (cùng quy tắc với `saveTeam`). */
  async function settle(keys) {
    for (const key of keys) outcomes.delete(key);
    conflicts = new Map();
    rejections = new Map();
    await sync.syncNow();
    for (const key of keys) {
      if (conflicts.has(key)) return rejected("conflict");
      const rejection = rejections.get(key);
      if (rejection) return rejected(rejection.code);
    }
    const unproven = keys.some((key) => {
      const found = record(...key.split(/:(.*)/su, 2));
      return found && found.rev === undefined && found.acked === undefined;
    });
    if (unproven || keys.some((key) => sync.state()?.dirty?.[key] !== undefined)) {
      const status = sync.status();
      return status === "signed-out" || status === "mismatch" ? rejected(status) : { ok: false, pending: true, code: status };
    }
    return { ok: true };
  }

  /** Ghi một lần rồi đẩy; `edit(state, {now}) → state` chạy trong khóa đa tab, `keys` là các khóa dự kiến ghi. */
  async function write(keys, edit) {
    await sync.start();
    const stored = await sync.mutate(edit);
    if (!stored.ok) return rejected(stored.reason);
    return settle(keys);
  }

  const record = (kind, id) => sync.state()?.records?.[recordKey(kind, id)];
  const live = (kind, id) => {
    const found = record(kind, id);
    return found && !found.deleted ? found : null;
  };

  async function createBox(rawName) {
    const name = cleanName(rawName);
    const invalid = nameError(name);
    if (invalid) return invalid;
    const boxId = `box-${randomSuffix()}`;
    // Hộp + hai nhóm mặc định đi cùng một request: không có hộp "trần" thiếu nhóm.
    const keys = [recordKey("box", boxId), recordKey("group", `${boxId}~khai-hoang`), recordKey("group", `${boxId}~ghep-team`)];
    const result = await write(keys, (state, { now }) => ensureBoxDefaultsIn(state, boxId, { name, now }));
    return result.ok ? { ok: true, boxId } : result;
  }

  async function renameBox(boxId, rawName) {
    const name = cleanName(rawName);
    const invalid = nameError(name);
    if (invalid) return invalid;
    if (!live("box", boxId)) return rejected("not_found");
    return write([recordKey("box", boxId)], (state, { now }) => putRecord(state, { kind: "box", id: boxId, data: { name } }, { now }));
  }

  async function deleteBox(boxId) {
    if (boxId === MAIN_BOX_ID) return rejected("default_protected");
    if (!live("box", boxId)) return rejected("not_found");
    return write([recordKey("box", boxId)], (state, { now }) => removeRecord(state, "box", boxId, { now }));
  }

  async function createGroup(boxId, rawName) {
    const name = cleanName(rawName);
    const invalid = nameError(name);
    if (invalid) return invalid;
    if (!live("box", boxId)) return rejected("box_missing");
    const groupId = `grp-${randomSuffix()}`;
    const order = Math.max(-1, ...groupsOf(sync.state(), boxId).map((group) => group.order)) + 1;
    const result = await write([recordKey("group", groupId)], (state, { now }) =>
      putRecord(state, { kind: "group", id: groupId, boxId, data: { name, order } }, { now }));
    return result.ok ? { ok: true, groupId } : result;
  }

  const isDefaultGroup = (groupId) => /~(?:khai-hoang|ghep-team)$/u.test(groupId);

  async function renameGroup(groupId, rawName) {
    if (isDefaultGroup(groupId)) return rejected("default_protected");
    const name = cleanName(rawName);
    const invalid = nameError(name);
    if (invalid) return invalid;
    const found = live("group", groupId);
    if (!found) return rejected("not_found");
    return write([recordKey("group", groupId)], (state, { now }) =>
      putRecord(state, { kind: "group", id: groupId, boxId: found.boxId, data: { name, order: found.data.order } }, { now }));
  }

  /**
   * Xóa nhóm: đội của nhóm về Ghép Team. Server cũng chuyển (cho máy khác) và đặt `updated_at` của đội = mốc xóa nhóm, nên
   * bản đội của client phải được đóng dấu SAU bản xóa nhóm (mới hơn mốc) để vẫn `applied`, không báo `conflict`. Bản đệm của
   * trang này đổi ngay trong cùng lần ghi để danh sách không treo đội ở nhóm đã xóa.
   */
  async function deleteGroup(groupId) {
    if (isDefaultGroup(groupId)) return rejected("default_protected");
    const found = live("group", groupId);
    if (!found) return rejected("not_found");
    const fallback = `${found.boxId}~ghep-team`;
    const moved = Object.values(sync.state()?.records ?? {}).filter((item) => item.kind === "team" && !item.deleted && item.data?.groupId === groupId);
    const keys = [recordKey("group", groupId), ...moved.map((item) => recordKey("team", item.id))];
    return write(keys, (state, { now }) => {
      let next = removeRecord(ensureBoxDefaultsIn(state, found.boxId, { now }), "group", groupId, { now });
      for (const item of moved) {
        next = putRecord(next, { kind: "team", id: item.id, boxId: item.boxId, data: { ...teamBody(item.data), groupId: fallback } }, { now });
      }
      return next;
    });
  }

  async function moveTeam(teamId, groupId) {
    const found = live("team", teamId);
    if (!found) return rejected("not_found");
    const target = live("group", groupId);
    if (!target || target.boxId !== found.boxId) return rejected("group_missing");
    return write([recordKey("team", teamId)], (state, { now }) =>
      putRecord(state, { kind: "team", id: teamId, boxId: found.boxId, data: { ...teamBody(found.data), groupId } }, { now }));
  }

  async function deleteTeam(teamId) {
    if (!live("team", teamId)) return rejected("not_found");
    return write([recordKey("team", teamId)], (state, { now }) => removeRecord(state, "team", teamId, { now }));
  }

  return { sync, start: sync.start, load, snapshot, ensureBoxDefaults, saveTeam, createBox, renameBox, deleteBox, createGroup, renameGroup, deleteGroup, moveTeam, deleteTeam };
}
