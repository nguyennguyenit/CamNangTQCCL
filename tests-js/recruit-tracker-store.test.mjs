import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DAILY_BANNER_ID,
  createAccount,
  createDefaultRecruitTrackerState,
  createLimitedBanner,
  deleteAccount,
  deleteBanner,
  deletePullEvents,
  getFiveStarHistory,
  getRecruitTrackerSummary,
  loadRecruitTrackerState,
  mergeRecruitRecords,
  mergeRecruitTrackerState,
  recordBannerFiveStar,
  recordBannerMiss,
  recordDailyFiveStar,
  recordDailyMisses,
  recruitRecords,
  renameAccount,
  restorePullEvents,
  saveRecruitTrackerState,
  setActiveAccount,
  setBannerArchived,
  setPity,
  updateBanner,
  updatePullEvent,
  validateRecruitTrackerImport,
} from "../js/recruit-tracker-store.js";

const TODAY = "2026-07-10";
const NOW = "2026-07-10T03:30:00.000Z";
const V1 = JSON.parse(readFileSync(new URL("./fixtures/recruit-tracker-v1.json", import.meta.url), "utf8"));

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

/** Đồng hồ giả: mỗi lần gọi tiến 1 giây, để thứ tự ghi không phụ thuộc máy chạy test. */
function clock(start = NOW) {
  let t = Date.parse(start);
  return () => new Date((t += 1000));
}

const dailyPity = (state, accountId, date = TODAY) => getRecruitTrackerSummary(state, { accountId, date }).daily.pity.pullsSinceFiveStar;
const eventIds = (state) => new Set(state.pullEvents.map((event) => event.id));
const newIds = (before, after) => [...eventIds(after)].filter((id) => !eventIds(before).has(id));

test("default state: one account, Danh tướng PK, nothing recorded today", () => {
  const state = createDefaultRecruitTrackerState(NOW);
  const summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.accounts.length, 1);
  assert.equal(state.activeAccountId, state.accounts[0].id);
  assert.equal(summary.daily.banner.name, "Danh tướng PK");
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 0);
  assert.equal(summary.daily.todayDone, 0);
  assert.equal(summary.daily.remainingToday, 4);
  assert.equal(summary.isEmpty, true);
});

test("account CRUD keeps a live active account and the last account cannot be deleted", () => {
  let state = createDefaultRecruitTrackerState(NOW);
  state = createAccount(state, "Alt");
  const alt = state.accounts.find((account) => account.name === "Alt");
  assert.equal(state.activeAccountId, alt.id);
  state = renameAccount(state, alt.id, "Alt S2");
  assert.equal(getRecruitTrackerSummary(state, { date: TODAY }).account.name, "Alt S2");
  state = deleteAccount(state, alt.id);
  const summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.deepEqual(summary.accounts.map((account) => account.id), ["acc_main"]);
  assert.equal(state.activeAccountId, "acc_main");
  assert.equal(deleteAccount(state, "acc_main").accounts.filter((account) => !account.deletedAt).length, 1);
});

test("quick daily buttons clamp to the 4 cheap pulls left today", () => {
  const now = clock();
  let state = createDefaultRecruitTrackerState(NOW);
  state = recordDailyMisses(state, { date: TODAY, pulls: 2, now: now() });
  let summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.equal(summary.daily.todayDone, 2);
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 2);

  state = recordDailyMisses(state, { date: TODAY, pulls: 4, now: now() });
  summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.equal(summary.daily.todayDone, 4);
  assert.equal(summary.daily.remainingToday, 0);
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 4);

  const before = state;
  state = recordDailyMisses(state, { date: TODAY, pulls: 2, now: now() });
  assert.equal(state.pullEvents.length, before.pullEvents.length, "no pulls left today -> no record");
  assert.equal(getRecruitTrackerSummary(state, { date: "2026-07-11" }).daily.remainingToday, 4, "next day starts fresh");
});

test("daily 5★ resets pity at the hit and keeps the pulls made after it", () => {
  const now = clock();
  let state = createDefaultRecruitTrackerState(NOW);
  state = recordDailyMisses(state, { date: "2026-07-09", pulls: 4, now: now() });
  state = recordDailyFiveStar(state, { date: TODAY, hitAt: 2, pullsAfter: 2, heroName: "SP Quan Vũ", heroValueClass: "Chủ lực", now: now() });
  const summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.equal(summary.daily.todayDone, 4);
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 2);
  assert.deepEqual(summary.history.map((item) => [item.heroName, item.pullCount, item.heroValueClass]), [["SP Quan Vũ", 6, "Chủ lực"]]);
});

test("pity and resets are per account and per banner", () => {
  const now = clock();
  let state = createDefaultRecruitTrackerState(NOW);
  state = createAccount(state, "Alt");
  const alt = state.activeAccountId;
  state = createLimitedBanner(state, { name: "Kỳ Tật Như Phong", expiresAt: "2026-07-20" });
  const banner = state.banners.find((item) => item.name === "Kỳ Tật Như Phong");
  state = recordDailyMisses(state, { accountId: "acc_main", date: TODAY, pulls: 2, now: now() });
  state = recordDailyMisses(state, { accountId: alt, date: TODAY, pulls: 4, now: now() });
  state = recordBannerMiss(state, { accountId: "acc_main", bannerId: banner.id, pulls: 5, date: TODAY, now: now() });
  state = recordBannerFiveStar(state, { accountId: "acc_main", bannerId: banner.id, pulls: 26, heroName: "Lưu Bị", date: TODAY, now: now() });

  const main = getRecruitTrackerSummary(state, { accountId: "acc_main", date: TODAY });
  assert.equal(main.daily.pity.pullsSinceFiveStar, 2);
  assert.equal(main.limitedBanners.find((item) => item.banner.id === banner.id).pity.pullsSinceFiveStar, 0);
  assert.equal(main.history[0].pullCount, 31);
  assert.equal(dailyPity(state, alt), 4);
});

test("over-30 pity is retained and flagged instead of capped", () => {
  let state = createDefaultRecruitTrackerState(NOW);
  state = createLimitedBanner(state, { name: "Động Như Lôi Đình" });
  const banner = state.banners.find((item) => item.name === "Động Như Lôi Đình");
  state = recordBannerMiss(state, { bannerId: banner.id, pulls: 31, date: TODAY });
  const limited = getRecruitTrackerSummary(state, { date: TODAY }).limitedBanners[0];
  assert.equal(limited.pity.pullsSinceFiveStar, 31);
  assert.equal(limited.pity.isOverLimit, true);
});

test("set-pity from the game becomes the starting point and later pulls add on top", () => {
  const now = clock();
  let state = createDefaultRecruitTrackerState(NOW);
  state = recordDailyMisses(state, { date: "2026-07-08", pulls: 4, now: now() });
  state = setPity(state, { bannerId: DAILY_BANNER_ID, value: 17, date: "2026-07-09", now: now() });
  assert.equal(dailyPity(state, "acc_main"), 17);
  assert.equal(getRecruitTrackerSummary(state, { date: "2026-07-09" }).daily.todayDone, 0, "a sync is not a pull of the day");
  state = recordDailyMisses(state, { date: TODAY, pulls: 4, now: now() });
  state = recordDailyFiveStar(state, { date: "2026-07-11", hitAt: 1, pullsAfter: 0, heroName: "Tào Tháo", now: now() });
  const summary = getRecruitTrackerSummary(state, { date: "2026-07-11" });
  assert.equal(summary.history[0].pullCount, 22);
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 0);
  assert.equal(summary.log.find((row) => row.result === "set").pulls, 17);
});

test("deleting, editing and restoring any log row recomputes pity, history and stats", () => {
  const now = clock();
  let state = createDefaultRecruitTrackerState(NOW);
  state = recordDailyMisses(state, { date: "2026-07-08", pulls: 4, now: now() });
  const before = state;
  state = recordDailyMisses(state, { date: "2026-07-09", pulls: 4, now: now() });
  const [wrong] = newIds(before, state);
  state = recordDailyFiveStar(state, { date: TODAY, hitAt: 3, pullsAfter: 1, heroName: "Lữ Mông", now: now() });
  assert.equal(getRecruitTrackerSummary(state, { date: TODAY }).history[0].pullCount, 11);

  state = deletePullEvents(state, [wrong], { now: now() });
  let summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.equal(summary.history[0].pullCount, 7);
  assert.equal(summary.log.some((row) => row.id === wrong), false);
  assert.equal(summary.stats.averagePulls, 7);

  state = restorePullEvents(state, [wrong], { now: now() });
  assert.equal(getRecruitTrackerSummary(state, { date: TODAY }).history[0].pullCount, 11);

  const five = getRecruitTrackerSummary(state, { date: TODAY }).history[0];
  state = updatePullEvent(state, five.id, { heroName: "SP Lữ Mông", pulls: 1, note: "sửa" }, { now: now() });
  summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.deepEqual([summary.history[0].heroName, summary.history[0].pullCount, summary.history[0].note], ["SP Lữ Mông", 9, "sửa"]);
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 1);
});

test("undo of a quick action is deleting exactly the records it created", () => {
  const now = clock();
  let state = createDefaultRecruitTrackerState(NOW);
  state = recordDailyMisses(state, { date: TODAY, pulls: 2, now: now() });
  const before = state;
  state = recordDailyFiveStar(state, { date: TODAY, hitAt: 1, pullsAfter: 1, heroName: "Lưu Bị", now: now() });
  const created = newIds(before, state);
  assert.equal(created.length, 2);
  state = deletePullEvents(state, created, { now: now() });
  const summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.equal(summary.daily.todayDone, 2);
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 2);
  assert.equal(summary.history.length, 0);
});

test("limited banners: rename, expiry, archive and delete; the daily banner is protected", () => {
  const now = clock();
  let state = createDefaultRecruitTrackerState(NOW);
  state = createLimitedBanner(state, { name: "Gói A", expiresAt: "2026-07-20", now: now() });
  const id = state.banners.find((item) => item.name === "Gói A").id;
  state = updateBanner(state, id, { name: "Gói A2", expiresAt: "2026-07-21" }, { now: now() });
  let limited = getRecruitTrackerSummary(state, { date: TODAY }).limitedBanners;
  assert.deepEqual(limited.map((item) => [item.banner.name, item.banner.expiresAt, item.archived]), [["Gói A2", "2026-07-21", false]]);

  state = setBannerArchived(state, id, true, { now: now() });
  limited = getRecruitTrackerSummary(state, { date: TODAY }).limitedBanners;
  assert.equal(limited[0].archived, true);

  state = recordBannerMiss(state, { bannerId: id, pulls: 3, date: TODAY, now: now() });
  state = deleteBanner(state, id, { now: now() });
  const summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.equal(summary.limitedBanners.length, 0);
  assert.equal(summary.log.length, 0, "records of a deleted banner leave the log");

  const kept = deleteBanner(setBannerArchived(state, DAILY_BANNER_ID, true), DAILY_BANNER_ID);
  assert.equal(getRecruitTrackerSummary(kept, { date: TODAY }).daily.banner.id, DAILY_BANNER_ID);
  assert.equal(kept.banners.find((item) => item.id === DAILY_BANNER_ID).deletedAt || "", "");
});

test("stats: total 5★, average pulls per 5★ and consecutive-day streak", () => {
  const now = clock();
  let state = createDefaultRecruitTrackerState(NOW);
  state = recordDailyMisses(state, { date: "2026-07-05", pulls: 4, now: now() });
  state = recordDailyMisses(state, { date: "2026-07-07", pulls: 4, now: now() });
  state = recordDailyFiveStar(state, { date: "2026-07-08", hitAt: 2, pullsAfter: 0, heroName: "A", now: now() });
  state = recordDailyMisses(state, { date: "2026-07-09", pulls: 2, now: now() });
  state = recordDailyFiveStar(state, { date: TODAY, hitAt: 2, pullsAfter: 0, heroName: "B", now: now() });
  assert.deepEqual(getRecruitTrackerSummary(state, { date: TODAY }).stats, { fiveStars: 2, averagePulls: 7, streakDays: 4 });
  assert.equal(getRecruitTrackerSummary(state, { date: "2026-07-11" }).stats.streakDays, 4, "streak still alive until today is recorded");
  assert.equal(getRecruitTrackerSummary(state, { date: "2026-07-12" }).stats.streakDays, 0);
  assert.deepEqual(getRecruitTrackerSummary(createDefaultRecruitTrackerState(NOW), { date: TODAY }).stats, { fiveStars: 0, averagePulls: null, streakDays: 0 });
});

test("v1 data migrates to v2 with identical pity and 5★ history", () => {
  const storage = memoryStorage({ tqcclRecruitTracker: JSON.stringify(V1.state) });
  const state = loadRecruitTrackerState(storage, NOW);
  assert.equal(state.schemaVersion, 2);
  assert.equal("dailyStates" in state, false);
  assert.equal(state.activeAccountId, V1.state.activeAccountId);
  for (const [accountId, expected] of Object.entries(V1.expect)) {
    const summary = getRecruitTrackerSummary(state, { accountId, date: "2026-07-12" });
    assert.equal(summary.daily.pity.pullsSinceFiveStar, expected.daily, accountId);
    assert.deepEqual(Object.fromEntries(summary.limitedBanners.map((item) => [item.banner.id, item.pity.pullsSinceFiveStar])), expected.limited, accountId);
    assert.deepEqual(summary.history.map((h) => [h.heroName, h.bannerName, h.pullCount, h.date, h.heroValueClass]), expected.history, accountId);
  }
  assert.equal(getRecruitTrackerSummary(state, { accountId: "acc_main", date: "2026-07-11" }).daily.todayDone, 3);
});

test("local changes after merging a device with a faster clock are still newer than everything merged", () => {
  const slow = new Date("2026-07-10T04:00:00.000Z");
  let fast = recordDailyMisses(createDefaultRecruitTrackerState(NOW), { date: TODAY, pulls: 2, now: new Date("2026-07-10T09:00:00.000Z") });
  fast = renameAccount(fast, "acc_main", "Fast", { now: new Date("2026-07-10T09:00:01.000Z") });
  let local = mergeRecruitRecords(createDefaultRecruitTrackerState(NOW), recruitRecords(fast));
  const seen = Math.max(...recruitRecords(local).map((record) => record.updatedAt));
  local = renameAccount(local, "acc_main", "Slow", { now: slow });
  const [id] = local.pullEvents.map((event) => event.id);
  local = updatePullEvent(local, id, { pulls: 1 }, { now: slow });
  local = recordDailyMisses(local, { date: TODAY, pulls: 1, now: slow });
  const changed = recruitRecords(local, { since: seen });
  assert.deepEqual(changed.map((record) => record.kind).sort(), ["account", "event", "event"]);
  assert.equal(getRecruitTrackerSummary(mergeRecruitRecords(fast, changed), { date: TODAY }).account.name, "Slow");
});

test("v1 events without timestamps keep their array order and stored 5★ pull counts", () => {
  const v1 = {
    schemaVersion: 1,
    activeAccountId: "acc_main",
    accounts: [{ id: "acc_main", name: "Main" }],
    banners: [],
    dailyStates: [],
    pullEvents: [
      { id: "b", accountId: "acc_main", bannerId: DAILY_BANNER_ID, pulls: 1, result: "fiveStar", date: "2026-07-09", heroName: "SP Lữ Mông", pullCount: 30 },
      { id: "a", accountId: "acc_main", bannerId: DAILY_BANNER_ID, pulls: 1, result: "miss", date: "2026-07-10" },
    ],
  };
  const state = loadRecruitTrackerState(memoryStorage({ tqcclRecruitTracker: JSON.stringify(v1) }), NOW);
  const summary = getRecruitTrackerSummary(state, { date: TODAY });
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 1);
  assert.equal(summary.history[0].pullCount, 30);
});

test("two devices recording offline merge to the union of their records", () => {
  const base = createDefaultRecruitTrackerState(NOW);
  const phone = recordDailyMisses(base, { date: TODAY, pulls: 2, now: new Date("2026-07-10T04:00:00.000Z") });
  const laptop = createLimitedBanner(base, { name: "Gói B", now: new Date("2026-07-10T04:30:00.000Z") });
  const bannerId = laptop.banners.find((item) => item.name === "Gói B").id;
  const laptop2 = recordBannerMiss(laptop, { bannerId, pulls: 3, date: TODAY, now: new Date("2026-07-10T05:00:00.000Z") });
  const phoneThenLaptop = mergeRecruitRecords(phone, recruitRecords(laptop2));
  const laptopThenPhone = mergeRecruitRecords(laptop2, recruitRecords(phone));
  for (const merged of [phoneThenLaptop, laptopThenPhone]) {
    const summary = getRecruitTrackerSummary(merged, { date: TODAY });
    assert.equal(summary.daily.pity.pullsSinceFiveStar, 2);
    assert.equal(summary.limitedBanners.find((item) => item.banner.id === bannerId).pity.pullsSinceFiveStar, 3);
  }
  assert.deepEqual(
    getRecruitTrackerSummary(phoneThenLaptop, { date: TODAY }).log.map((row) => row.id),
    getRecruitTrackerSummary(laptopThenPhone, { date: TODAY }).log.map((row) => row.id),
  );
});

test("merge is last-write-wins per record: a later delete beats an earlier edit, and vice versa", () => {
  let state = recordDailyMisses(createDefaultRecruitTrackerState(NOW), { date: TODAY, pulls: 4, now: new Date("2026-07-10T04:00:00.000Z") });
  const [id] = state.pullEvents.map((event) => event.id);
  const edited = updatePullEvent(state, id, { pulls: 3 }, { now: new Date("2026-07-10T05:00:00.000Z") });
  const deleted = deletePullEvents(state, [id], { now: new Date("2026-07-10T06:00:00.000Z") });
  assert.equal(dailyPity(mergeRecruitRecords(edited, recruitRecords(deleted)), "acc_main"), 0);
  assert.equal(dailyPity(mergeRecruitRecords(deleted, recruitRecords(edited)), "acc_main"), 0);
  const reEdited = updatePullEvent(edited, id, { pulls: 2 }, { now: new Date("2026-07-10T07:00:00.000Z") });
  assert.equal(dailyPity(mergeRecruitRecords(deleted, recruitRecords(reEdited)), "acc_main"), 2);
});

test("a fresh device never overwrites a renamed default account on first sync", () => {
  const renamed = renameAccount(createDefaultRecruitTrackerState(NOW), "acc_main", "Chính S1");
  const fresh = createDefaultRecruitTrackerState("2026-09-01T00:00:00.000Z");
  const merged = mergeRecruitRecords(fresh, recruitRecords(renamed));
  assert.equal(getRecruitTrackerSummary(merged, { date: TODAY }).account.name, "Chính S1");
});

test("recruitRecords can list only records changed after a cursor; invalid remote records are ignored", () => {
  let state = recordDailyMisses(createDefaultRecruitTrackerState(NOW), { date: TODAY, pulls: 2, now: new Date("2026-07-10T04:00:00.000Z") });
  const cursor = Date.parse("2026-07-10T04:30:00.000Z");
  state = recordDailyMisses(state, { date: TODAY, pulls: 2, now: new Date("2026-07-10T05:00:00.000Z") });
  const changed = recruitRecords(state, { since: cursor });
  assert.deepEqual(changed.map((record) => record.kind), ["event"]);
  assert.equal(typeof changed[0].updatedAt, "number");

  const merged = mergeRecruitRecords(state, [
    { kind: "event", id: "x", updatedAt: Date.now(), data: { id: "x", result: "boom" } },
    { kind: "nope", id: "y", updatedAt: 1, data: {} },
    null,
  ]);
  assert.equal(merged.pullEvents.length, state.pullEvents.length);
});

test("deleting an account on one device hides its records after merge; the local active account stays valid", () => {
  let state = createAccount(createDefaultRecruitTrackerState(NOW), "Alt", { now: new Date("2026-07-10T04:00:00.000Z") });
  const alt = state.activeAccountId;
  state = recordDailyMisses(state, { accountId: alt, date: TODAY, pulls: 4, now: new Date("2026-07-10T04:10:00.000Z") });
  const other = setActiveAccount(deleteAccount(state, alt, { now: new Date("2026-07-10T05:00:00.000Z") }), "acc_main");
  const merged = mergeRecruitRecords(state, recruitRecords(other));
  const summary = getRecruitTrackerSummary(merged, { date: TODAY });
  assert.deepEqual(summary.accounts.map((account) => account.id), ["acc_main"]);
  assert.equal(merged.activeAccountId, "acc_main");
});

test("import validates v1 and v2 files, then merges instead of overwriting", () => {
  assert.equal(validateRecruitTrackerImport(V1.state).ok, true);
  assert.equal(validateRecruitTrackerImport(createDefaultRecruitTrackerState(NOW)).ok, true);
  assert.equal(validateRecruitTrackerImport({ schemaVersion: 999 }).ok, false);
  assert.equal(validateRecruitTrackerImport({ schemaVersion: 1, accounts: [], banners: [], pullEvents: [] }).ok, false);

  const local = recordDailyMisses(createDefaultRecruitTrackerState(NOW), { date: TODAY, pulls: 2, now: new Date("2026-07-10T04:00:00.000Z") });
  const merged = mergeRecruitTrackerState(local, V1.state);
  assert.equal(merged.accounts.filter((account) => !account.deletedAt).length, 2);
  assert.equal(merged.pullEvents.length, local.pullEvents.length + V1.state.pullEvents.length);
  assert.equal(merged.activeAccountId, local.activeAccountId);
});

function validV1() {
  return JSON.parse(JSON.stringify(V1.state));
}

const BROKEN_IMPORTS = {
  "pullEvents chứa null": (s) => { s.pullEvents = [null]; },
  "dailyStates chứa null": (s) => { s.dailyStates = [null]; },
  "dailyState thiếu slots": (s) => { delete s.dailyStates[0].slots; },
  "banners chứa null": (s) => { s.banners = [null]; },
  "pulls không hữu hạn": (s) => { s.pullEvents[0].pulls = Infinity; },
  "pulls không phải số": (s) => { s.pullEvents[1].pulls = "ba"; },
  "slotKey lạ": (s) => { s.dailyStates[0].slots[0].key = "free_9"; },
  "sự kiện trỏ account không tồn tại": (s) => { s.pullEvents[0].accountId = "acc_ghost"; },
  "sự kiện trỏ banner không tồn tại": (s) => { s.pullEvents[1].bannerId = "banner_ghost"; },
  "dailyState trỏ account không tồn tại": (s) => { s.dailyStates[0].accountId = "acc_ghost"; },
};

test("import rejects malformed accounts, banners, events and daily states element by element", () => {
  for (const [label, breakIt] of Object.entries(BROKEN_IMPORTS)) {
    const broken = validV1();
    breakIt(broken);
    assert.equal(validateRecruitTrackerImport(broken).ok, false, label);
  }
  const v2 = recordDailyMisses(createDefaultRecruitTrackerState(NOW), { date: TODAY, pulls: 2 });
  const brokenV2 = JSON.parse(JSON.stringify(v2));
  brokenV2.pullEvents[0].result = "boom";
  assert.equal(validateRecruitTrackerImport(brokenV2).ok, false);
});

test("localStorage adapter falls back on corrupt data and round-trips v2", () => {
  const storage = memoryStorage({ tqcclRecruitTracker: "{not-json" });
  const loaded = loadRecruitTrackerState(storage, NOW);
  const named = renameAccount(loaded, loaded.activeAccountId, "主账号 Main");
  saveRecruitTrackerState(storage, named);
  const reloaded = loadRecruitTrackerState(storage, NOW);
  assert.equal(reloaded.schemaVersion, 2);
  assert.equal(reloaded.accounts[0].name, "主账号 Main");
  assert.equal(getFiveStarHistory(reloaded).length, 0);
});
