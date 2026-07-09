const STORAGE_KEY = "tqcclRecruitTracker";
const SCHEMA_VERSION = 1;
const DAILY_BANNER_ID = "danh-tuong-pk";

const DAILY_SLOT_DEFS = [
  { key: "free_1", label: "Miễn phí 1", drawKind: "free" },
  { key: "half_1", label: "Nửa giá 1", drawKind: "half" },
  { key: "free_2", label: "Miễn phí 2", drawKind: "free" },
  { key: "half_2", label: "Nửa giá 2", drawKind: "half" },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function localDateFrom(value = new Date()) {
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultDailySlots() {
  return DAILY_SLOT_DEFS.map((slot) => ({ key: slot.key, label: slot.label, status: "pending" }));
}

function dailySlotDef(slotKey) {
  return DAILY_SLOT_DEFS.find((slot) => slot.key === slotKey);
}

function defaultDailyBanner() {
  return {
    id: DAILY_BANNER_ID,
    name: "Danh tướng PK",
    type: "normal",
    drawMode: "daily",
    hasFiveStar: true,
    pityLimit: 30,
    dailyCheapPullLimit: 4,
  };
}

export function createDefaultRecruitTrackerState(now = new Date()) {
  const account = { id: "acc_main", name: "Main", createdAt: typeof now === "string" ? now : nowIso() };
  return {
    schemaVersion: SCHEMA_VERSION,
    activeAccountId: account.id,
    accounts: [account],
    banners: [defaultDailyBanner()],
    dailyStates: [],
    pullEvents: [],
  };
}

export function normalizeRecruitTrackerState(input, now = new Date()) {
  const valid = validateRecruitTrackerImport(input);
  if (!valid.ok) return createDefaultRecruitTrackerState(now);

  const state = clone(input);
  state.banners = ensureDailyBanner(state.banners);
  state.dailyStates = Array.isArray(state.dailyStates) ? state.dailyStates : [];
  state.pullEvents = Array.isArray(state.pullEvents) ? state.pullEvents : [];
  return state;
}

function ensureDailyBanner(banners) {
  const list = Array.isArray(banners) ? clone(banners) : [];
  if (!list.some((banner) => banner.id === DAILY_BANNER_ID)) list.unshift(defaultDailyBanner());
  return list;
}

function withState(state) {
  const next = normalizeRecruitTrackerState(state);
  return next;
}

function findAccountId(state, accountId) {
  return accountId || state.activeAccountId || state.accounts[0]?.id;
}

function dailyStateIndex(state, accountId, date, bannerId = DAILY_BANNER_ID) {
  return state.dailyStates.findIndex((item) => item.accountId === accountId && item.date === date && item.bannerId === bannerId);
}

function ensureDailyState(state, accountId, date, bannerId = DAILY_BANNER_ID) {
  const idx = dailyStateIndex(state, accountId, date, bannerId);
  if (idx >= 0) return state.dailyStates[idx];
  const dailyState = {
    date,
    accountId,
    bannerId,
    slots: defaultDailySlots(),
    nextFreeAt: "",
  };
  state.dailyStates.push(dailyState);
  return dailyState;
}

function addPullEvent(state, event) {
  state.pullEvents.push({
    id: makeId("evt"),
    pulls: 1,
    result: "miss",
    date: localDateFrom(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...event,
  });
}

function eventMatches(event, accountId, bannerId) {
  return event.accountId === accountId && event.bannerId === bannerId;
}

export function getPity(state, accountId, bannerId) {
  const next = normalizeRecruitTrackerState(state);
  const banner = next.banners.find((item) => item.id === bannerId) || defaultDailyBanner();
  let pullsSinceFiveStar = 0;
  for (const event of next.pullEvents) {
    if (!eventMatches(event, accountId, bannerId)) continue;
    if (event.result === "fiveStar") pullsSinceFiveStar = 0;
    else pullsSinceFiveStar += Number(event.pulls) || 0;
  }
  return {
    pullsSinceFiveStar,
    pityLimit: banner.pityLimit || 30,
    remaining: Math.max((banner.pityLimit || 30) - pullsSinceFiveStar, 0),
    isOverLimit: pullsSinceFiveStar >= (banner.pityLimit || 30),
  };
}

export function createAccount(state, name) {
  const next = withState(state);
  const account = { id: makeId("acc"), name: String(name || "Account").trim() || "Account", createdAt: nowIso() };
  next.accounts.push(account);
  next.activeAccountId = account.id;
  return next;
}

export function renameAccount(state, accountId, name) {
  const next = withState(state);
  const account = next.accounts.find((item) => item.id === accountId);
  if (account) account.name = String(name || account.name).trim() || account.name;
  return next;
}

export function deleteAccount(state, accountId) {
  const next = withState(state);
  if (next.accounts.length <= 1) return next;
  next.accounts = next.accounts.filter((account) => account.id !== accountId);
  next.dailyStates = next.dailyStates.filter((daily) => daily.accountId !== accountId);
  next.pullEvents = next.pullEvents.filter((event) => event.accountId !== accountId);
  if (!next.accounts.some((account) => account.id === next.activeAccountId)) {
    next.activeAccountId = next.accounts[0]?.id || "";
  }
  return next;
}

export function setActiveAccount(state, accountId) {
  const next = withState(state);
  if (next.accounts.some((account) => account.id === accountId)) next.activeAccountId = accountId;
  return next;
}

export function createLimitedBanner(state, attrs = {}) {
  const next = withState(state);
  const name = String(attrs.name || "Gói hạn giờ").trim() || "Gói hạn giờ";
  next.banners.push({
    id: makeId("banner"),
    name,
    type: attrs.type || "limited",
    drawMode: "adHoc",
    hasFiveStar: true,
    pityLimit: 30,
    expiresAt: attrs.expiresAt || "",
    note: attrs.note || "",
    createdAt: nowIso(),
  });
  return next;
}

export function recordDailySlotMiss(state, { accountId, date = localDateFrom(), slotKey }) {
  const next = withState(state);
  const actualAccountId = findAccountId(next, accountId);
  const slotDef = dailySlotDef(slotKey);
  if (!slotDef) return next;
  const daily = ensureDailyState(next, actualAccountId, date);
  const slot = daily.slots.find((item) => item.key === slotKey);
  if (!slot || slot.status !== "pending") return next;
  slot.status = "miss";
  addPullEvent(next, {
    accountId: actualAccountId,
    bannerId: DAILY_BANNER_ID,
    date,
    drawSlot: slotKey,
    drawKind: slotDef.drawKind,
    pulls: 1,
    result: "miss",
  });
  return next;
}

export function recordDailySlotFiveStar(state, { accountId, date = localDateFrom(), slotKey, heroName, note = "", heroValueClass = "Chưa phân loại" }) {
  const next = withState(state);
  const actualAccountId = findAccountId(next, accountId);
  const slotDef = dailySlotDef(slotKey);
  if (!slotDef) return next;
  const daily = ensureDailyState(next, actualAccountId, date);
  const slot = daily.slots.find((item) => item.key === slotKey);
  if (!slot) return next;
  const pulls = 1;
  const pullCount = getPity(next, actualAccountId, DAILY_BANNER_ID).pullsSinceFiveStar + pulls;
  slot.status = "fiveStar";
  addPullEvent(next, {
    accountId: actualAccountId,
    bannerId: DAILY_BANNER_ID,
    date,
    drawSlot: slotKey,
    drawKind: slotDef.drawKind,
    pulls,
    pullCount,
    result: "fiveStar",
    heroName: String(heroName || "Tướng chưa ghi").trim() || "Tướng chưa ghi",
    heroValueClass,
    note,
  });
  return next;
}

export function recordBannerMiss(state, { accountId, bannerId, pulls = 1, date = localDateFrom() }) {
  const next = withState(state);
  const actualAccountId = findAccountId(next, accountId);
  const actualPulls = Math.max(1, Number(pulls) || 1);
  addPullEvent(next, {
    accountId: actualAccountId,
    bannerId,
    date,
    drawKind: "adHoc",
    pulls: actualPulls,
    result: "miss",
  });
  return next;
}

export function recordBannerFiveStar(state, { accountId, bannerId, pulls = 1, heroName, note = "", date = localDateFrom(), heroValueClass = "Chưa phân loại" }) {
  const next = withState(state);
  const actualAccountId = findAccountId(next, accountId);
  const actualPulls = Math.max(1, Number(pulls) || 1);
  const pullCount = getPity(next, actualAccountId, bannerId).pullsSinceFiveStar + actualPulls;
  addPullEvent(next, {
    accountId: actualAccountId,
    bannerId,
    date,
    drawKind: "adHoc",
    pulls: actualPulls,
    pullCount,
    result: "fiveStar",
    heroName: String(heroName || "Tướng chưa ghi").trim() || "Tướng chưa ghi",
    heroValueClass,
    note,
  });
  return next;
}

export function getFiveStarHistory(state) {
  const next = normalizeRecruitTrackerState(state);
  const accountById = new Map(next.accounts.map((account) => [account.id, account]));
  const bannerById = new Map(next.banners.map((banner) => [banner.id, banner]));
  return next.pullEvents
    .filter((event) => event.result === "fiveStar")
    .map((event) => ({
      ...event,
      accountName: accountById.get(event.accountId)?.name || "",
      bannerName: bannerById.get(event.bannerId)?.name || event.bannerId,
      pullCount: event.pullCount || Number(event.pulls) || 1,
    }))
    .sort((a, b) => {
      const byDate = String(b.date || "").localeCompare(String(a.date || ""));
      if (byDate !== 0) return byDate;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

export function getRecruitTrackerSummary(state, { accountId, date = localDateFrom() } = {}) {
  const next = normalizeRecruitTrackerState(state);
  const actualAccountId = findAccountId(next, accountId);
  const dailyState = ensureDailyState(next, actualAccountId, date);
  const dailyBanner = next.banners.find((banner) => banner.id === DAILY_BANNER_ID) || defaultDailyBanner();
  const limitedBanners = next.banners
    .filter((banner) => banner.id !== DAILY_BANNER_ID && banner.hasFiveStar !== false)
    .map((banner) => ({ banner, pity: getPity(next, actualAccountId, banner.id) }));
  return {
    state: next,
    account: next.accounts.find((account) => account.id === actualAccountId),
    accounts: next.accounts,
    daily: {
      banner: dailyBanner,
      slots: dailyState.slots,
      todayDone: dailyState.slots.filter((slot) => slot.status !== "pending").length,
      pity: getPity(next, actualAccountId, DAILY_BANNER_ID),
    },
    limitedBanners,
    history: getFiveStarHistory(next).filter((event) => event.accountId === actualAccountId),
  };
}

export function validateRecruitTrackerImport(value) {
  if (!value || typeof value !== "object") return { ok: false, error: "Dữ liệu không hợp lệ." };
  if (value.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: "Sai phiên bản dữ liệu." };
  if (!Array.isArray(value.accounts) || value.accounts.length === 0) return { ok: false, error: "Thiếu account." };
  if (!value.accounts.every((account) => account && typeof account.id === "string" && typeof account.name === "string")) {
    return { ok: false, error: "Account không hợp lệ." };
  }
  if (!value.accounts.some((account) => account.id === value.activeAccountId)) return { ok: false, error: "Active account không hợp lệ." };
  if (!Array.isArray(value.banners)) return { ok: false, error: "Thiếu banner." };
  if (!Array.isArray(value.pullEvents)) return { ok: false, error: "Thiếu lịch sử quay." };
  return { ok: true, summary: { accounts: value.accounts.length, banners: value.banners.length, events: value.pullEvents.length } };
}

export function loadRecruitTrackerState(storage = globalThis.localStorage, now = new Date()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createDefaultRecruitTrackerState(now);
    return normalizeRecruitTrackerState(JSON.parse(raw), now);
  } catch {
    return createDefaultRecruitTrackerState(now);
  }
}

export function saveRecruitTrackerState(storage = globalThis.localStorage, state) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(normalizeRecruitTrackerState(state)));
}

export { DAILY_BANNER_ID, DAILY_SLOT_DEFS, STORAGE_KEY };
