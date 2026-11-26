// `loadSession({fresh})`: trang trả về từ bfcache hỏi lại phiên; kết quả của lượt hỏi cũ về muộn không được đè phiên mới
// (hint `tqccl:community-session` và sự kiện `community:session` cho header).
import { test } from "node:test";
import assert from "node:assert/strict";

const HINT_KEY = "tqccl:community-session";
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.document = new EventTarget();
// Domain chính có gtag: `track()` của js/analytics.js gửi `gtag('event', …)`; test đếm sự kiện `login`.
const gtagCalls = [];
globalThis.window = { location: { hostname: "tqccl.com", pathname: "/" }, gtag: (...args) => gtagCalls.push(args) };
const logins = () => gtagCalls.filter((call) => call[0] === "event" && call[1] === "login");
const events = [];
document.addEventListener("community:session", (event) => events.push(event.detail.user?.id ?? null));

/** `/api/me` giả: mỗi lượt gọi chờ đến khi test trả lời, để điều khiển thứ tự hoàn tất. */
const pending = [];
globalThis.fetch = () => new Promise((resolve, reject) => {
  pending.push((user, error) => (error ? reject(error) : resolve(new Response(JSON.stringify({ user }), { headers: { "content-type": "application/json" } }))));
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const { loadSession } = await import("../js/community-api.js");

test("lượt hỏi cũ về sau lượt fresh: không xoá hint, không phát sự kiện, phiên nhớ vẫn là lượt mới", async () => {
  store.set(HINT_KEY, "1");
  events.length = 0;
  const stale = loadSession({ probe: false });
  const fresh = loadSession({ probe: false, fresh: true });
  assert.equal(pending.length, 2);
  pending[1]({ id: "u-bob" });
  assert.equal((await fresh).id, "u-bob");
  pending[0](null);
  assert.equal(await stale, null);
  await settle();
  assert.equal(store.get(HINT_KEY), "1");
  assert.deepEqual(events, ["u-bob"]);
  assert.equal((await loadSession({ probe: false })).id, "u-bob");
  pending.length = 0;
});

test("fresh khi hint đã mất (đăng xuất ở tab khác): trả null, không gọi API, báo header về khách", async () => {
  store.delete(HINT_KEY);
  events.length = 0;
  assert.equal(await loadSession({ probe: false, fresh: true }), null);
  assert.equal(pending.length, 0);
  assert.deepEqual(events, [null]);
});

test("lượt fresh lỗi mạng rồi đăng xuất ở tab khác: lượt fresh sau vẫn báo header về khách", async () => {
  store.set(HINT_KEY, "1");
  events.length = 0;
  const failing = loadSession({ probe: false, fresh: true });
  assert.equal(pending.length, 1);
  pending.shift()(undefined, new TypeError("network"));
  await assert.rejects(failing);
  store.delete(HINT_KEY);
  assert.equal(await loadSession({ probe: false, fresh: true }), null);
  assert.deepEqual(events, [null]);
});

// `login` (GA4): hint `pending` do signIn() ghi trước khi rời sang Google; lần đầu thấy phiên có người dùng sau lượt quay về là một đăng nhập.
test("login: quay về từ OAuth có phiên thì báo một lần với method google; các lần tải sau (hint '1') không báo", async () => {
  gtagCalls.length = 0;
  store.set(HINT_KEY, "pending");
  const first = loadSession({ probe: false, fresh: true });
  assert.equal(pending.length, 1);
  pending.shift()({ id: "u-carol", email: "carol@example.com", name: "Carol" });
  assert.equal((await first).id, "u-carol");
  assert.deepEqual(logins(), [["event", "login", { method: "google" }]]);
  assert.equal(store.get(HINT_KEY), "1");

  const again = loadSession({ probe: false, fresh: true });
  pending.shift()({ id: "u-carol" });
  await again;
  assert.equal(logins().length, 1, "tải lại khi đã đăng nhập không báo thêm");
});

test("login: hủy đăng nhập hoặc không có phiên thì không báo, hint bị xóa; khách thường không báo", async () => {
  gtagCalls.length = 0;
  store.set(HINT_KEY, "pending");
  const cancelled = loadSession({ probe: false, fresh: true });
  pending.shift()(null);
  assert.equal(await cancelled, null);
  assert.equal(store.has(HINT_KEY), false);

  store.delete(HINT_KEY);
  assert.equal(await loadSession({ probe: false, fresh: true }), null);
  const probed = loadSession({ probe: true, fresh: true });
  pending.shift()(null);
  await probed;
  assert.deepEqual(logins(), []);
});

test("login: lượt hỏi lỗi mạng không báo; thử lại thành công vẫn báo đúng một lần", async () => {
  gtagCalls.length = 0;
  store.set(HINT_KEY, "pending");
  const failing = loadSession({ probe: false, fresh: true });
  pending.shift()(undefined, new TypeError("network"));
  await assert.rejects(failing);
  assert.deepEqual(logins(), []);
  assert.equal(store.get(HINT_KEY), "pending", "hint giữ nguyên để lượt hỏi sau còn nhận ra lượt quay về");
  const retry = loadSession({ probe: false });
  pending.shift()({ id: "u-dan" });
  await retry;
  assert.equal(logins().length, 1);
});

test("login: hai lượt hỏi phiên chồng nhau chỉ báo một lần (dùng chung lượt, hoặc lượt fresh thay lượt cũ)", async () => {
  gtagCalls.length = 0;
  store.set(HINT_KEY, "pending");
  const a = loadSession({ probe: false, fresh: true });
  const b = loadSession({ probe: false });
  assert.equal(pending.length, 1, "lượt thứ hai dùng lại lượt đang chờ");
  pending.shift()({ id: "u-erin" });
  await Promise.all([a, b]);
  assert.equal(logins().length, 1);

  gtagCalls.length = 0;
  store.set(HINT_KEY, "pending");
  const stale = loadSession({ probe: false, fresh: true });
  const fresh = loadSession({ probe: false, fresh: true });
  assert.equal(pending.length, 2);
  const [answerStale, answerFresh] = pending.splice(0);
  answerStale({ id: "u-frank" });
  await stale;
  assert.deepEqual(logins(), [], "lượt cũ đã bị lượt fresh thay: không báo");
  answerFresh({ id: "u-frank" });
  await fresh;
  assert.equal(logins().length, 1);
});
