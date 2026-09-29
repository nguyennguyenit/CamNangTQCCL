// Đồng bộ đám mây (tuỳ chọn) cho "Theo dõi chiêu mộ": khách chỉ dùng localStorage, người đã đăng nhập
// kéo thay đổi theo con trỏ rev rồi đẩy bản ghi sửa sau mốc `pushedAt` lên `/api/recruit`.
// Không bao giờ ném lỗi cho UI: mọi kết quả báo qua `onStatus(status, detail)`.

import { api as defaultApi, loadSession as defaultLoadSession, signIn as defaultSignIn } from "./community-api.js";
import { recruitRecords } from "./recruit-tracker-store.js";

export const SYNC_META_KEY = "tqcclRecruitTracker:sync";
export const PUSH_DEBOUNCE_MS = 1500;
export const PUSH_CHUNK_SIZE = 500;
const ENDPOINT = "/api/recruit";

function emptyMeta(userId) {
  return { userId, cursor: 0, pushedAt: 0 };
}

function readMeta(storage) {
  try {
    const meta = JSON.parse(storage?.getItem(SYNC_META_KEY) || "null");
    if (meta && typeof meta.userId === "string" && Number.isSafeInteger(meta.cursor) && Number.isSafeInteger(meta.pushedAt)) {
      return { userId: meta.userId, cursor: meta.cursor, pushedAt: meta.pushedAt };
    }
  } catch {
    // Meta hỏng: coi như chưa đồng bộ lần nào.
  }
  return null;
}

function writeMeta(storage, meta) {
  try {
    storage?.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // Storage bị chặn/đầy: lần sau kéo/đẩy lại từ đầu, server gộp LWW nên vẫn đúng.
  }
}

/** Lỗi mạng hoặc dịch vụ vắng (CommunityError.unavailable / không có status) = mất kết nối tạm thời. */
function isOffline(error) {
  return Boolean(error?.unavailable) || !error?.status;
}

export function createRecruitSync({
  storage,
  getState,
  applyRemote,
  onStatus = () => {},
  api = defaultApi,
  loadSession = defaultLoadSession,
  signIn = defaultSignIn,
  timers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
  doc = globalThis.document,
  win = globalThis.window,
} = {}) {
  let status = "guest";
  let user = null;
  let meta = null;
  let startPromise = null;
  let pushTimer = null;
  let queue = Promise.resolve();

  function setStatus(next, detail) {
    status = next;
    try {
      onStatus(next, detail);
    } catch {
      // Lỗi render của UI không được làm hỏng vòng đồng bộ.
    }
  }

  function fail(error) {
    if (error?.status === 401) {
      // Phiên đã hết: quay về chế độ khách, dữ liệu tại chỗ vẫn giữ.
      user = null;
      setStatus("guest");
    } else if (isOffline(error)) {
      setStatus("offline", error);
    } else {
      setStatus("error", error);
    }
  }

  function saveMeta(patch) {
    meta = { ...meta, ...patch };
    writeMeta(storage, meta);
  }

  async function pull() {
    const records = [];
    let cursor = meta.cursor;
    for (;;) {
      const page = await api(`${ENDPOINT}?since=${cursor}`);
      if (Array.isArray(page?.records)) records.push(...page.records);
      if (Number.isSafeInteger(page?.cursor)) cursor = page.cursor;
      if (!page?.more) break;
    }
    if (records.length) applyRemote(records);
    if (cursor !== meta.cursor) saveMeta({ cursor });
  }

  async function push() {
    const since = meta.pushedAt > 0 ? meta.pushedAt : undefined;
    const pending = recruitRecords(getState(), { since }).sort((a, b) => a.updatedAt - b.updatedAt);
    for (let i = 0; i < pending.length; i += PUSH_CHUNK_SIZE) {
      const chunk = pending.slice(i, i + PUSH_CHUNK_SIZE);
      const res = await api(ENDPOINT, { method: "POST", json: { records: chunk } });
      const chunkMax = chunk[chunk.length - 1].updatedAt;
      const next = pending[i + PUSH_CHUNK_SIZE];
      // Lô sau có thể trùng mốc updatedAt với cuối lô này: lùi 1 ms để lỗi giữa chừng không bỏ sót bản ghi.
      const pushedAt = next ? Math.min(chunkMax, next.updatedAt - 1) : chunkMax;
      const patch = { pushedAt: Math.max(meta.pushedAt, pushedAt) };
      // Server không có ai ghi xen giữa (cursor mới = cũ + số dòng vừa ghi) -> khỏi kéo lại chính bản ghi mình.
      if (Number.isSafeInteger(res?.cursor) && res.cursor === meta.cursor + (res?.accepted ?? 0)) patch.cursor = res.cursor;
      saveMeta(patch);
    }
  }

  /** Xếp hàng tác vụ mạng để kéo/đẩy không chạy chồng; lỗi đổi thành trạng thái. */
  function enqueue(task) {
    queue = queue.then(async () => {
      if (!user) return;
      setStatus("syncing");
      try {
        await task();
        if (user) setStatus("synced");
      } catch (error) {
        fail(error);
      }
    });
    return queue;
  }

  const syncAll = () =>
    enqueue(async () => {
      await pull();
      await push();
    });

  function onResume() {
    if (user) return syncAll();
    // Lần hỏi phiên đầu thất bại do mạng: thử lại khi có mạng.
    if (status === "offline") {
      startPromise = null;
      return start();
    }
    return Promise.resolve();
  }

  function onVisibility() {
    return doc?.visibilityState === "visible" ? onResume() : Promise.resolve();
  }

  let listening = false;
  function listen() {
    if (listening) return;
    listening = true;
    doc?.addEventListener?.("visibilitychange", onVisibility);
    win?.addEventListener?.("online", onResume);
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
    const stored = readMeta(storage);
    // Lần đầu của user này (hoặc đổi tài khoản): kéo tất cả từ rev 0 rồi đẩy mọi bản ghi tại chỗ.
    if (stored?.userId === user.id) {
      meta = stored;
    } else {
      meta = emptyMeta(user.id);
      writeMeta(storage, meta);
    }
    await syncAll();
  }

  function start() {
    if (!startPromise) startPromise = begin();
    return startPromise;
  }

  /**
   * Đẩy sau ~1,5 s. `full: true` (sau khi Nhập JSON) đẩy lại mọi bản ghi: bản ghi gộp từ file giữ `updatedAt` cũ,
   * có thể nhỏ hơn `pushedAt`, nên đẩy thường sẽ bỏ sót chúng. Server gộp LWW nên gửi lại là vô hại.
   */
  function schedulePush({ full = false } = {}) {
    if (!user) return;
    if (full && meta) saveMeta({ pushedAt: 0 });
    if (pushTimer !== null) timers.clearTimeout(pushTimer);
    pushTimer = timers.setTimeout(() => {
      pushTimer = null;
      return enqueue(push);
    }, PUSH_DEBOUNCE_MS);
  }

  return {
    start,
    schedulePush,
    /**
     * Chuyển sang đăng nhập Google (trang rời đi). Không ném: lỗi được trả về để UI báo; khách lỗi đăng nhập vẫn là
     * khách (giữ nút Đăng nhập), chỉ người đang đăng nhập mới đổi trạng thái theo lỗi.
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
    status: () => status,
  };
}
