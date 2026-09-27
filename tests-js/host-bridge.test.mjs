import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  HOST_BRIDGE_KEYS,
  HOST_BRIDGE_SCRIPT,
  planHostBridge as planWithKeys,
  runHostBridge,
} from "../src/lib/host-bridge.ts";
import { STORAGE_KEY as RECRUIT_TRACKER_KEY } from "../js/recruit-tracker-store.js";
import { ROSTER_SCAN_STORAGE_KEY } from "../js/roster-scan-state.js";
import { TEAM_VIEW_STORAGE_KEY } from "../js/team-view.js";

const planHostBridge = (input) => planWithKeys(input, HOST_BRIDGE_KEYS);

const PREFIX = "#tqccl-migrate=";

function memoryStorage(entries = {}, { failGet = false, failSet = false } = {}) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    getItem(key) {
      if (failGet) throw new Error("SecurityError");
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (failSet) throw new Error("QuotaExceededError");
      store.set(key, String(value));
    },
  };
}

const page = (overrides) => ({
  hostname: "tqccl.com",
  pathname: "/theo-doi-chieu-mo/",
  search: "?tab=1",
  hash: "",
  storage: memoryStorage(),
  ...overrides,
});

const payloadHash = (payload) => PREFIX + encodeURIComponent(JSON.stringify(payload));

function decodePayload(url) {
  const hash = new URL(url).hash;
  assert.ok(hash.startsWith(PREFIX), url);
  return JSON.parse(decodeURIComponent(hash.slice(PREFIX.length)));
}

test("allowlist is exactly the app's persistent localStorage keys", () => {
  assert.deepEqual([...HOST_BRIDGE_KEYS].sort(), [
    "theme",
    "tqccl.rosterRecommend.scanState.v1",
    "tqccl.teamView.v1",
    "tqcclRecruitTracker",
  ]);
  for (const key of [RECRUIT_TRACKER_KEY, ROSTER_SCAN_STORAGE_KEY, TEAM_VIEW_STORAGE_KEY]) {
    assert.ok(HOST_BRIDGE_KEYS.includes(key), key);
  }
});

for (const hostname of ["tqccl.pages.dev", "www.tqccl.com"]) {
  test(`${hostname}: carries every stored key and the original hash to https://tqccl.com`, () => {
    const storage = memoryStorage({
      tqcclRecruitTracker: '{"v":1}',
      "tqccl.rosterRecommend.scanState.v1": '{"ownedHeroes":["a"]}',
      theme: "dark",
      "tqccl.teamView.v1": "bang",
      unrelated: "leave-me",
      "tqccl:team-return:v1": "session-only",
    });
    const plan = planHostBridge(page({ hostname, hash: "#khaihoang", storage }));
    assert.equal(plan.action, "redirect");
    const url = new URL(plan.url);
    assert.equal(url.origin, "https://tqccl.com");
    assert.equal(url.pathname + url.search, "/theo-doi-chieu-mo/?tab=1");
    assert.deepEqual(decodePayload(plan.url), {
      v: 1,
      hash: "#khaihoang",
      items: {
        tqcclRecruitTracker: '{"v":1}',
        "tqccl.rosterRecommend.scanState.v1": '{"ownedHeroes":["a"]}',
        theme: "dark",
        "tqccl.teamView.v1": "bang",
      },
    });
  });
}

test("legacy host without stored keys redirects with the original hash untouched", () => {
  const plan = planHostBridge(page({ hostname: "tqccl.pages.dev", hash: "#lookup?group=heroes", search: "" }));
  assert.deepEqual(plan, { action: "redirect", url: "https://tqccl.com/theo-doi-chieu-mo/#lookup?group=heroes" });
});

test("legacy host still redirects without data when storage is blocked", () => {
  for (const storage of [null, memoryStorage({ theme: "dark" }, { failGet: true })]) {
    assert.deepEqual(planHostBridge(page({ hostname: "www.tqccl.com", hash: "#x", storage })), {
      action: "redirect",
      url: "https://tqccl.com/theo-doi-chieu-mo/?tab=1#x",
    });
  }
});

test("preview, local and unrelated hosts are untouched", () => {
  for (const hostname of ["abc123.tqccl.pages.dev", "localhost", "127.0.0.1", "tqccl.com.evil.example", "evil.example"]) {
    const storage = memoryStorage({ theme: "dark" });
    assert.deepEqual(planHostBridge(page({ hostname, hash: payloadHash({ v: 1, hash: "", items: { theme: "light" } }), storage })), { action: "none" }, hostname);
  }
});

test("primary host without a migration fragment does nothing", () => {
  for (const hash of ["", "#khaihoang", "#tqccl-migrate", "#x-tqccl-migrate="]) {
    assert.deepEqual(planHostBridge(page({ hash })), { action: "none" }, hash);
  }
});

test("primary host imports only absent keys and restores the original hash", () => {
  const storage = memoryStorage({ theme: "light" });
  const plan = planHostBridge(page({
    storage,
    hash: payloadHash({ v: 1, hash: "#lookup?group=tactics", items: { theme: "dark", tqcclRecruitTracker: '{"v":1}' } }),
  }));
  assert.deepEqual(plan, {
    action: "rewrite",
    writes: [["tqcclRecruitTracker", '{"v":1}']],
    url: "/theo-doi-chieu-mo/?tab=1#lookup?group=tactics",
  });
});

test("an invalid payload only strips the fragment", () => {
  const invalid = [
    PREFIX + "%E0%A4%A",
    PREFIX + encodeURIComponent("not json"),
    payloadHash(null),
    payloadHash([]),
    payloadHash({ v: 2, hash: "", items: { theme: "dark" } }),
    payloadHash({ v: 1, hash: "", items: { theme: 1 } }),
    payloadHash({ v: 1, hash: "", items: { theme: "dark", __proto__polluter: "x" } }),
    payloadHash({ v: 1, hash: "", items: { "tqccl:team-return:v1": "{}" } }),
    payloadHash({ v: 1, hash: "", items: [] }),
    payloadHash({ v: 1, hash: "javascript:alert(1)", items: {} }),
    payloadHash({ v: 1, hash: 3, items: {} }),
    payloadHash({ v: 1, hash: payloadHash({ v: 1, hash: "", items: {} }), items: {} }),
  ];
  for (const hash of invalid) {
    const storage = memoryStorage();
    assert.deepEqual(planHostBridge(page({ hash, storage })), { action: "rewrite", writes: [], url: "/theo-doi-chieu-mo/?tab=1" }, hash);
  }
});

test("blocked storage on the primary host keeps the original hash and writes nothing", () => {
  const hash = payloadHash({ v: 1, hash: "#x", items: { theme: "dark" } });
  for (const storage of [null, memoryStorage({}, { failGet: true })]) {
    assert.deepEqual(planHostBridge(page({ hash, storage })), { action: "rewrite", writes: [], url: "/theo-doi-chieu-mo/?tab=1#x" });
  }
});

/** Cửa sổ giả: ghi lại replace/replaceState để kiểm phần có tác dụng phụ. */
function fakeWindow(href, storage) {
  const url = new URL(href);
  const calls = [];
  const win = {
    location: {
      hostname: url.hostname,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      replace: (target) => calls.push(["replace", target]),
    },
    history: { replaceState: (state, title, target) => calls.push(["replaceState", state, title, target]) },
  };
  Object.defineProperty(win, "localStorage", {
    get() {
      if (storage === "throw") throw new Error("SecurityError");
      return storage;
    },
  });
  return { win, calls };
}

test("runHostBridge writes absent keys, tolerates a failing write and rewrites the URL", () => {
  const storage = memoryStorage({ theme: "light" });
  const hash = payloadHash({ v: 1, hash: "#k", items: { theme: "dark", "tqccl.teamView.v1": "bang" } });
  const { win, calls } = fakeWindow(`https://tqccl.com/doi-chuan/${hash}`, storage);
  runHostBridge(win, planWithKeys, HOST_BRIDGE_KEYS);
  assert.equal(storage.store.get("theme"), "light");
  assert.equal(storage.store.get("tqccl.teamView.v1"), "bang");
  assert.deepEqual(calls, [["replaceState", null, "", "/doi-chuan/#k"]]);

  const failing = memoryStorage({}, { failSet: true });
  const second = fakeWindow(`https://tqccl.com/${hash}`, failing);
  runHostBridge(second.win, planWithKeys, HOST_BRIDGE_KEYS);
  assert.deepEqual(second.calls, [["replaceState", null, "", "/#k"]]);
});

test("runHostBridge redirects a legacy host even when the storage getter throws", () => {
  const { win, calls } = fakeWindow("https://tqccl.pages.dev/tra-cuu/?group=heroes#x", "throw");
  runHostBridge(win, planWithKeys, HOST_BRIDGE_KEYS);
  assert.deepEqual(calls, [["replace", "https://tqccl.com/tra-cuu/?group=heroes#x"]]);
});

test("the inline script round-trips data from a legacy host to the primary host", () => {
  const legacyStorage = memoryStorage({ tqcclRecruitTracker: '{"accounts":[]}', theme: "dark" });
  const legacy = fakeWindow("https://www.tqccl.com/theo-doi-chieu-mo/#top", legacyStorage);
  vm.runInNewContext(HOST_BRIDGE_SCRIPT, { window: legacy.win });
  assert.equal(legacy.calls.length, 1);
  const [kind, target] = legacy.calls[0];
  assert.equal(kind, "replace");

  const primaryStorage = memoryStorage({ theme: "light" });
  const primary = fakeWindow(target, primaryStorage);
  vm.runInNewContext(HOST_BRIDGE_SCRIPT, { window: primary.win });
  assert.deepEqual(primary.calls, [["replaceState", null, "", "/theo-doi-chieu-mo/#top"]]);
  assert.deepEqual(Object.fromEntries(primaryStorage.store), { theme: "light", tqcclRecruitTracker: '{"accounts":[]}' });
});

test("the inline script never throws into the page", () => {
  const { win } = fakeWindow("https://tqccl.pages.dev/", memoryStorage());
  win.location.replace = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => vm.runInNewContext(HOST_BRIDGE_SCRIPT, { window: win }));
});
