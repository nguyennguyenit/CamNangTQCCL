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
const events = [];
document.addEventListener("community:session", (event) => events.push(event.detail.user?.id ?? null));

/** `/api/me` giả: mỗi lượt gọi chờ đến khi test trả lời, để điều khiển thứ tự hoàn tất. */
const pending = [];
globalThis.fetch = () => new Promise((resolve) => {
  pending.push((user) => resolve(new Response(JSON.stringify({ user }), { headers: { "content-type": "application/json" } })));
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
