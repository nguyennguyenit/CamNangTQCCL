// Đồng bộ kho/đội qua `/api/roster` (hợp đồng: docs/roster-sync.md). Khách chỉ dùng local (UI không tạo sync khi không có
// phiên); người đã đăng nhập kéo theo con trỏ `rev`, đẩy các bản ghi dirty theo khúc 200 kèm `expectedUserId`.
// Cache và con trỏ lưu CÙNG một giá trị `tqccl.roster.cloud.v1`; mọi đọc–sửa–ghi chạy trong `navigator.locks` và gộp blob
// mới nhất với state của tab, nên hai tab ghi đồng thời không đè nhau. Không ném lỗi cho UI: kết quả báo qua callback.
// Không dùng chung code với `js/recruit-sync.js` (tính năng đang chạy, ngoài phạm vi).

import { api as defaultApi, loadSession as defaultLoadSession, signIn as defaultSignIn } from "./community-api.js";
import {
  CLOUD_STORAGE_KEY,
  MAIN_BOX_ID,
  applyPull,
  applyResults,
  canonicalKinds,
  dismissRejected as dismissRejectedIn,
  emptyCloudState,
  ensureBoxDefaults,
  mergeCloudStates,
  mergeLocal,
  mergeStatusOf,
  normalizeCloudState,
  pendingPush,
  recordKey,
  setMergeStatus,
} from "./roster-cloud-store.js";

export { CLOUD_STORAGE_KEY };
export const PUSH_DEBOUNCE_MS = 1500;
export const PUSH_CHUNK_SIZE = 200;
/** Gợi ý đội chỉ kéo năm loại này; "Đội của tôi" thêm `group,team`. */
export const DEFAULT_KINDS = ["box", "owned", "season", "locked", "override"];
const ENDPOINT = "/api/roster";
const LOCK_NAME = "tqccl-roster";
const STALE = Symbol("stale");
/** Trạng thái không đồng bộ tiếp: hết phiên (chỉ đọc) hoặc chủ cache đã đổi (UI khóa, nạp lại phiên). */
const BLOCKED = new Set(["signed-out", "mismatch"]);

/** Lỗi mạng hoặc dịch vụ vắng (CommunityError.unavailable / không có status) = mất kết nối tạm thời. */
const isOffline = (error) => Boolean(error?.unavailable) || !error?.status;
const isUserMismatch = (error) => error?.status === 409 && error?.code === "user_mismatch";

export function createRosterSync({
  kinds = DEFAULT_KINDS,
  storage,
  api = defaultApi,
  loadSession = defaultLoadSession,
  signIn = defaultSignIn,
  locks = globalThis.navigator?.locks,
  timers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
  doc = globalThis.document,
  win = globalThis.window,
  now = () => Date.now(),
  onStatus = () => {},
  onChange = () => {},
  onConflict = () => {},
  onRejected = () => {},
  onMismatch = () => {},
} = {}) {
  let status = "guest";
  let user = null;
  /** State của tab: luôn đã gộp với blob ở lần đọc–sửa–ghi gần nhất. */
  let tab = null;
  /** Tăng mỗi khi phiên cũ bị bỏ (mismatch / đổi chủ cache): mọi request/response của epoch cũ bị vứt. */
  let epoch = 0;
  let startPromise = null;
  /** Đã có một lần kéo thành công trong phiên này (cache đã phản ánh server): chỉ khi đó mới dựng bản ghi mặc định. */
  let pulledOnce = false;
  let pushTimer = null;
  let queue = Promise.resolve();
  let lockTail = Promise.resolve();
  const wantedKinds = canonicalKinds(kinds);

  const safely = (fn, ...args) => {
    try {
      fn(...args);
    } catch {
      // Lỗi render của UI không được làm hỏng vòng đồng bộ.
    }
  };

  function setStatus(next, detail) {
    status = next;
    safely(onStatus, next, detail);
  }

  function clearTimer() {
    if (pushTimer !== null) timers.clearTimeout(pushTimer);
    pushTimer = null;
  }

  /** Chủ cache đã đổi (hoặc server báo `user_mismatch`): dừng timer, bỏ phiên cũ, khóa UI. */
  function enterMismatch() {
    epoch += 1;
    pulledOnce = false;
    clearTimer();
    if (status !== "mismatch") {
      setStatus("mismatch");
      safely(onMismatch);
    }
  }

  function fail(error) {
    if (isUserMismatch(error)) return enterMismatch();
    if (error?.status === 401) {
      // Hết phiên: giữ kho cloud ở chế độ chỉ đọc, KHÔNG chuyển sang kho local.
      clearTimer();
      return setStatus("signed-out", error);
    }
    return setStatus(isOffline(error) ? "offline" : "error", error);
  }

  /* ---------- Blob + khóa tab ---------- */

  function readBlob() {
    try {
      const raw = storage?.getItem(CLOUD_STORAGE_KEY);
      return raw ? normalizeCloudState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function writeBlob(state) {
    try {
      storage?.setItem(
        CLOUD_STORAGE_KEY,
        JSON.stringify({ userId: state.userId, cursor: state.cursor, pulledKinds: state.pulledKinds, records: state.records, dirty: state.dirty, rejected: state.rejected }),
      );
    } catch {
      // Storage đầy/bị chặn: giữ trong bộ nhớ; dirty vẫn được đẩy lên server trong phiên này.
    }
  }

  function withLock(fn) {
    if (locks?.request) return locks.request(LOCK_NAME, fn);
    // Không có Web Locks (trình duyệt cũ): chỉ tuần tự trong tab này.
    const run = lockTail.then(fn);
    lockTail = run.catch(() => {});
    return run;
  }

  /**
   * Đọc–sửa–ghi dưới khóa: đọc blob mới nhất, kiểm chủ, gộp với state của tab rồi chạy `fn(merged)` →
   * `{state, result, write = true}`. Trả `STALE` khi epoch đã đổi hoặc chủ cache không còn là user của phiên.
   */
  function transact(myEpoch, fn) {
    return withLock(async () => {
      if (myEpoch !== epoch || !user || !tab) return STALE;
      const blob = readBlob();
      if (!blob || blob.userId !== user.id) {
        enterMismatch();
        return STALE;
      }
      const merged = mergeCloudStates(tab, blob);
      const out = fn(merged);
      tab = out.state;
      if (out.write !== false) writeBlob(tab);
      return out.result;
    });
  }

  /* ---------- Kéo / đẩy ---------- */

  async function pull(myEpoch) {
    for (;;) {
      const since = tab.cursor;
      const page = await api(`${ENDPOINT}?since=${since}&kinds=${tab.pulledKinds.join(",")}`);
      if (myEpoch !== epoch) return;
      // Cookie đã sang tài khoản khác (tab khác đăng xuất/đăng nhập): không áp trang nào, cache này không còn đúng chủ.
      if (page?.userId !== user.id) return enterMismatch();
      const records = Array.isArray(page?.records) ? page.records : [];
      const cursor = Number.isSafeInteger(page?.cursor) ? page.cursor : since;
      let reset = false;
      const lost = await transact(myEpoch, (merged) => {
        const applied = applyPull(merged, records, cursor);
        reset = applied.reset;
        const conflicts = applied.lost.map((loser) => {
          const server = applied.state.records[recordKey(loser.kind, loser.id)];
          return { key: recordKey(loser.kind, loser.id), loser, server: server && { kind: server.kind, id: server.id, boxId: server.boxId, updatedAt: server.updatedAt, rev: server.rev, deleted: server.deleted, data: server.data } };
        });
        return { state: applied.state, result: conflicts };
      });
      if (lost === STALE) return;
      if (records.length || lost.length) safely(onChange, tab);
      for (const conflict of lost) safely(onConflict, conflict);
      if (reset) continue; // con trỏ đã lệch về 0: kéo lại từ đầu
      if (!page?.more || cursor <= since) break;
    }
    if (myEpoch === epoch) pulledOnce = true;
  }

  async function push(myEpoch) {
    const pending = await transact(myEpoch, (merged) => ({ state: merged, result: pendingPush(merged), write: false }));
    if (pending === STALE) return;
    const expectedUserId = user.id;
    for (let i = 0; i < pending.length; i += PUSH_CHUNK_SIZE) {
      const chunk = pending.slice(i, i + PUSH_CHUNK_SIZE);
      const response = await api(ENDPOINT, { method: "POST", json: { expectedUserId, records: chunk } });
      if (myEpoch !== epoch) return;
      const outcome = await transact(myEpoch, (merged) => {
        const applied = applyResults(merged, chunk, response?.results);
        return { state: applied.state, result: applied };
      });
      if (outcome === STALE) return;
      if (outcome.conflicts.length) safely(onChange, tab);
      for (const conflict of outcome.conflicts) safely(onConflict, conflict);
      if (outcome.rejected.length) safely(onRejected, outcome.rejected);
    }
  }

  /** Xếp hàng tác vụ mạng để kéo/đẩy không chạy chồng; lỗi đổi thành trạng thái. */
  function enqueue(task) {
    queue = queue.then(async () => {
      const myEpoch = epoch;
      if (!user || BLOCKED.has(status)) return;
      setStatus("syncing");
      try {
        await task(myEpoch);
        if (myEpoch === epoch && status === "syncing") setStatus("synced");
      } catch (error) {
        if (myEpoch === epoch) fail(error);
      }
    });
    return queue;
  }

  const syncAll = () =>
    enqueue(async (myEpoch) => {
      await pull(myEpoch);
      await push(myEpoch);
    });

  function schedulePush() {
    if (!user || BLOCKED.has(status)) return;
    clearTimer();
    pushTimer = timers.setTimeout(() => {
      pushTimer = null;
      return enqueue(push);
    }, PUSH_DEBOUNCE_MS);
  }

  /** Tab khác ghi blob: chỉ kích hoạt gộp (không thay state đang dirty bằng snapshot); blob mất/đổi chủ = mismatch. */
  async function reconcile() {
    if (!user || BLOCKED.has(status)) return;
    const result = await transact(epoch, (merged) => ({ state: merged, result: true, write: false }));
    if (result !== STALE) safely(onChange, tab);
  }

  function onResume() {
    if (user) return BLOCKED.has(status) ? Promise.resolve() : syncAll();
    // Lần hỏi phiên đầu thất bại do mạng: thử lại khi có mạng.
    if (status === "offline") {
      startPromise = null;
      return start();
    }
    return Promise.resolve();
  }

  const onVisibility = () => (doc?.visibilityState === "visible" ? onResume() : Promise.resolve());
  const onStorage = (event) => (event?.key === CLOUD_STORAGE_KEY || event?.key === null ? reconcile() : Promise.resolve());

  let listening = false;
  function listen() {
    if (listening) return;
    listening = true;
    doc?.addEventListener?.("visibilitychange", onVisibility);
    win?.addEventListener?.("online", onResume);
    win?.addEventListener?.("storage", onStorage);
  }

  async function begin() {
    listen();
    let sessionUser;
    try {
      sessionUser = await loadSession({ probe: false });
    } catch (error) {
      fail(error);
      return;
    }
    if (!sessionUser?.id) {
      user = null;
      setStatus("guest");
      return;
    }
    user = sessionUser;
    pulledOnce = false;
    const myEpoch = (epoch += 1);
    await withLock(async () => {
      const stored = readBlob();
      // Blob của người khác (máy dùng chung, đổi tài khoản) không bao giờ lộ cho user này: bỏ và kéo lại từ rev 0.
      let state = stored?.userId === user.id ? stored : emptyCloudState(user.id);
      if (!wantedKinds.every((kind) => state.pulledKinds.includes(kind))) {
        // Cursor chỉ đúng với các kinds đã kéo: mở rộng phạm vi thì kéo lại từ đầu.
        state = { ...state, cursor: 0, pulledKinds: canonicalKinds([...state.pulledKinds, ...wantedKinds]) };
      }
      tab = state;
      writeBlob(tab);
    });
    if (myEpoch !== epoch) return;
    safely(onChange, tab);
    await syncAll();
  }

  function start() {
    if (!startPromise) startPromise = begin();
    return startPromise;
  }

  /** Ghi qua `fn(state, {now}) → state` (hàm của `roster-cloud-store`); từ chối khi khách, hết phiên hoặc đã khóa. */
  async function mutate(fn) {
    if (!user || !tab) return { ok: false, reason: "guest" };
    if (BLOCKED.has(status)) return { ok: false, reason: status };
    const changed = await transact(epoch, (merged) => {
      const next = fn(merged, { now: now() });
      return { state: next, result: next !== merged };
    });
    if (changed === STALE) return { ok: false, reason: "mismatch" };
    if (changed) schedulePush();
    return { ok: true };
  }

  /**
   * Như `mutate` nhưng chỉ sau một lần kéo thành công trong phiên (cache chưa kéo được thì không biết hộp/nhóm đã có trên
   * server chưa, dựng mặc định sẽ ghi đè bằng dấu mới hơn). Chưa kéo được → `{ok: false, reason: "offline" | "error"}`.
   */
  async function mutateAfterPull(fn) {
    if (user && tab && !BLOCKED.has(status) && !pulledOnce) return { ok: false, reason: status === "error" ? "error" : "offline" };
    return mutate(fn);
  }

  return {
    start,
    mutate,
    mutateAfterPull,
    schedulePush,
    /** Kéo rồi đẩy ngay (không chờ debounce). */
    syncNow: syncAll,
    status: () => status,
    user: () => user,
    state: () => tab,
    rejected: () => tab?.rejected ?? [],
    dismissRejected(key) {
      if (tab) tab = dismissRejectedIn(tab, key);
      return mutate((state) => dismissRejectedIn(state, key));
    },
    /** `"none"` (chưa hỏi gộp kho local) | `"merged"` | `"declined"`, theo `userId`. */
    mergeStatus: () => (user ? mergeStatusOf(storage, user.id) : "none"),
    declineMerge() {
      if (user) setMergeStatus(storage, user.id, "declined");
    },
    /** Gộp kho local vào hộp `main` (chỉ tạo khóa chưa có) rồi đặt cờ "đã gộp". Chạy lại sau gộp dở là an toàn. */
    async mergeLocal(scan, resolve) {
      let report = null;
      const result = await mutateAfterPull((state, { now: stamp }) => {
        report = mergeLocal(state, scan, resolve, { boxId: MAIN_BOX_ID, groups: wantedKinds.includes("group"), now: stamp });
        return report.state;
      });
      if (!result.ok) return result;
      setMergeStatus(storage, user.id, "merged");
      return { ok: true, localOnly: report.localOnly, created: report.created };
    },
    /** Đảm bảo có hộp `main` + nhóm mặc định (người đăng nhập không có hộp nào, hoặc từ chối gộp). */
    ensureMainBox: ({ seasonId } = {}) =>
      mutateAfterPull((state, { now: stamp }) => ensureBoxDefaults(state, MAIN_BOX_ID, { seasonId, groups: wantedKinds.includes("group"), now: stamp })),
    /**
     * Chuyển sang đăng nhập Google (trang rời đi). Không ném: lỗi được trả về để UI báo; khách lỗi đăng nhập vẫn là
     * khách, chỉ người đang đăng nhập mới đổi trạng thái theo lỗi.
     */
    async signIn() {
      try {
        await signIn();
        return null;
      } catch (error) {
        if (user) fail(error);
        return error;
      }
    },
  };
}
