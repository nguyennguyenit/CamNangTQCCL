import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  createDefaultRecruitTrackerState,
  createLimitedBanner,
  deleteAccount,
  getFiveStarHistory,
  getRecruitTrackerSummary,
  loadRecruitTrackerState,
  recordBannerFiveStar,
  recordBannerMiss,
  recordDailySlotFiveStar,
  recordDailySlotMiss,
  renameAccount,
  saveRecruitTrackerState,
  validateRecruitTrackerImport,
} from "../js/recruit-tracker-store.js";

const TODAY = "2026-07-10";
const NOW = "2026-07-10T03:30:00+07:00";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("default state has one account, Danh tướng PK, and four pending daily slots", () => {
  const state = createDefaultRecruitTrackerState(NOW);
  const summary = getRecruitTrackerSummary(state, { date: TODAY });

  assert.equal(state.schemaVersion, 1);
  assert.equal(state.accounts.length, 1);
  assert.equal(state.activeAccountId, state.accounts[0].id);
  assert.equal(summary.daily.banner.name, "Danh tướng PK");
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 0);
  assert.equal(summary.daily.todayDone, 0);
  assert.deepEqual(summary.daily.slots.map((slot) => [slot.key, slot.status]), [
    ["free_1", "pending"],
    ["half_1", "pending"],
    ["free_2", "pending"],
    ["half_2", "pending"],
  ]);
});

test("account CRUD keeps active account valid", () => {
  let state = createDefaultRecruitTrackerState(NOW);
  state = createAccount(state, "Alt");
  const alt = state.accounts.find((account) => account.name === "Alt");

  assert.ok(alt);
  assert.equal(state.activeAccountId, alt.id);

  state = renameAccount(state, alt.id, "Alt S2");
  assert.equal(state.accounts.find((account) => account.id === alt.id).name, "Alt S2");

  state = deleteAccount(state, alt.id);
  assert.equal(state.accounts.some((account) => account.id === alt.id), false);
  assert.equal(state.activeAccountId, state.accounts[0].id);
});

test("daily miss increments pity and five-star resets only that account banner", () => {
  let state = createDefaultRecruitTrackerState(NOW);
  const main = state.activeAccountId;
  state = createAccount(state, "Alt");
  const alt = state.activeAccountId;

  state = recordDailySlotMiss(state, { accountId: main, date: TODAY, slotKey: "free_1" });
  state = recordDailySlotMiss(state, { accountId: main, date: TODAY, slotKey: "half_1" });
  state = recordDailySlotMiss(state, { accountId: alt, date: TODAY, slotKey: "free_1" });

  assert.equal(getRecruitTrackerSummary(state, { accountId: main, date: TODAY }).daily.pity.pullsSinceFiveStar, 2);
  assert.equal(getRecruitTrackerSummary(state, { accountId: alt, date: TODAY }).daily.pity.pullsSinceFiveStar, 1);

  state = recordDailySlotFiveStar(state, {
    accountId: main,
    date: TODAY,
    slotKey: "free_2",
    heroName: "SP Quan Vũ",
    note: "free-text hero missing from current data",
  });

  const mainSummary = getRecruitTrackerSummary(state, { accountId: main, date: TODAY });
  const altSummary = getRecruitTrackerSummary(state, { accountId: alt, date: TODAY });

  assert.equal(mainSummary.daily.pity.pullsSinceFiveStar, 0);
  assert.equal(altSummary.daily.pity.pullsSinceFiveStar, 1);
  assert.equal(mainSummary.daily.slots.find((slot) => slot.key === "free_2").status, "fiveStar");
  assert.equal(getFiveStarHistory(state)[0].heroName, "SP Quan Vũ");
  assert.equal(getFiveStarHistory(state)[0].pullCount, 3);
});

test("limited banner miss and five-star are tracked separately from daily banner", () => {
  let state = createDefaultRecruitTrackerState(NOW);
  const accountId = state.activeAccountId;
  state = createLimitedBanner(state, { name: "Kỳ Tật Như Phong", expiresAt: "2026-07-11T13:40:00+07:00" });
  const banner = state.banners.find((item) => item.name === "Kỳ Tật Như Phong");

  state = recordBannerMiss(state, { accountId, bannerId: banner.id, pulls: 5, date: TODAY });
  state = recordDailySlotMiss(state, { accountId, date: TODAY, slotKey: "free_1" });

  let summary = getRecruitTrackerSummary(state, { accountId, date: TODAY });
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 1);
  assert.equal(summary.limitedBanners.find((item) => item.banner.id === banner.id).pity.pullsSinceFiveStar, 5);

  state = recordBannerFiveStar(state, { accountId, bannerId: banner.id, pulls: 26, heroName: "Lưu Bị", date: TODAY });
  summary = getRecruitTrackerSummary(state, { accountId, date: TODAY });
  assert.equal(summary.daily.pity.pullsSinceFiveStar, 1);
  assert.equal(summary.limitedBanners.find((item) => item.banner.id === banner.id).pity.pullsSinceFiveStar, 0);
  assert.equal(getFiveStarHistory(state)[0].pullCount, 31);
});

test("over-30 pity is retained and flagged instead of capped", () => {
  let state = createDefaultRecruitTrackerState(NOW);
  const accountId = state.activeAccountId;
  state = createLimitedBanner(state, { name: "Động Như Lôi Đình" });
  const banner = state.banners.find((item) => item.name === "Động Như Lôi Đình");

  state = recordBannerMiss(state, { accountId, bannerId: banner.id, pulls: 31, date: TODAY });

  const summary = getRecruitTrackerSummary(state, { accountId, date: TODAY });
  const limited = summary.limitedBanners.find((item) => item.banner.id === banner.id);
  assert.equal(limited.pity.pullsSinceFiveStar, 31);
  assert.equal(limited.pity.isOverLimit, true);
});

test("history is newest first and import validates before overwrite", () => {
  let state = createDefaultRecruitTrackerState(NOW);
  const accountId = state.activeAccountId;
  state = recordBannerFiveStar(state, { accountId, bannerId: "danh-tuong-pk", pulls: 1, heroName: "Lưu Bị", date: "2026-07-09" });
  state = recordBannerFiveStar(state, { accountId, bannerId: "danh-tuong-pk", pulls: 2, heroName: "Tào Tháo", date: "2026-07-10" });

  assert.deepEqual(getFiveStarHistory(state).map((record) => record.heroName), ["Tào Tháo", "Lưu Bị"]);
  assert.equal(validateRecruitTrackerImport(state).ok, true);
  assert.equal(validateRecruitTrackerImport({ schemaVersion: 999 }).ok, false);
  assert.equal(validateRecruitTrackerImport({ schemaVersion: 1, accounts: [], banners: [], pullEvents: [] }).ok, false);
});

test("localStorage adapter falls back on corrupt data and saves valid JSON", () => {
  const storage = memoryStorage({ tqcclRecruitTracker: "{not-json" });
  const loaded = loadRecruitTrackerState(storage, NOW);

  const named = renameAccount(loaded, loaded.activeAccountId, "主账号 Main");
  saveRecruitTrackerState(storage, named);
  const reloaded = loadRecruitTrackerState(storage, NOW);
  assert.equal(validateRecruitTrackerImport(reloaded).ok, true);
  assert.equal(reloaded.accounts[0].name, "主账号 Main");
});

function validImport() {
  let state = createDefaultRecruitTrackerState(NOW);
  state = createLimitedBanner(state, { name: "Gói A" });
  state = recordDailySlotMiss(state, { date: TODAY, slotKey: "free_1" });
  state = recordBannerMiss(state, { bannerId: state.banners[1].id, pulls: 3, date: TODAY });
  return JSON.parse(JSON.stringify(state));
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
  assert.equal(validateRecruitTrackerImport(validImport()).ok, true);
  for (const [label, breakIt] of Object.entries(BROKEN_IMPORTS)) {
    const broken = validImport();
    breakIt(broken);
    assert.equal(validateRecruitTrackerImport(broken).ok, false, label);
  }
});

test("any import accepted by validation can be summarized without throwing", () => {
  for (const [label, breakIt] of Object.entries({ "hợp lệ": () => {}, ...BROKEN_IMPORTS })) {
    const candidate = validImport();
    breakIt(candidate);
    if (!validateRecruitTrackerImport(candidate).ok) continue;
    assert.doesNotThrow(() => getRecruitTrackerSummary(candidate, { date: TODAY }), label);
  }
});
