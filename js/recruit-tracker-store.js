import { L } from "./i18n.js";

const STORAGE_KEY = "tqcclRecruitTracker";
const SCHEMA_VERSION = 1;
const DAILY_BANNER_ID = "danh-tuong-pk";

const DAILY_SLOT_DEFS = [
  { key: "free_1", label: "Miễn phí 1", labelZh: "免费 1", drawKind: "free" },
  { key: "half_1", label: "Nửa giá 1", labelZh: "半价 1", drawKind: "half" },
  { key: "free_2", label: "Miễn phí 2", labelZh: "免费 2", drawKind: "free" },
  { key: "half_2", label: "Nửa giá 2", labelZh: "半价 2", drawKind: "half" },
];
// Tên gói ngày mặc định lưu trong kho luôn là bản Việt (dữ liệu, không đổi theo ngôn ngữ).
const DAILY_BANNER_NAME = "Danh tướng PK";

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

/** Tên một lượt ngày theo ngôn ngữ trang (`free_1` → "Miễn phí 1" / "免费 1"); giá trị lạ (bản ghi cũ đã lưu nhãn) giữ nguyên. */
export function dailySlotLabel(slotKey) {
  const def = dailySlotDef(slotKey);
  return def ? L(def.label, def.labelZh) : String(slotKey || "");
}

/** Tên gói để hiển thị: gói ngày còn giữ tên mặc định thì dịch theo ngôn ngữ trang; tên người dùng đặt giữ nguyên. */
export function bannerDisplayName(banner) {
  if (banner?.id === DAILY_BANNER_ID && banner.name === DAILY_BANNER_NAME) return L(DAILY_BANNER_NAME, "PK名将招募");
  return banner?.name || "";
}

function defaultDailyBanner() {
  return {
    id: DAILY_BANNER_ID,
    name: DAILY_BANNER_NAME,
    type: "normal",
    drawMode: "daily",
    hasFiveStar: true,
    pityLimit: 30,
    dailyCheapPullLimit: 4,
  };
}

export function createDefaultRecruitTrackerState(now = new Date()) {
  const account = { id: "acc_main", name: L("Chính", "主号"), createdAt: typeof now === "string" ? now : nowIso() };
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
  return pityOf(normalizeRecruitTrackerState(state), accountId, bannerId);
}

/** Pity trên state đã normalize: không clone lại, chỉ đọc. */
function pityOf(next, accountId, bannerId) {
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
  const fallback = L("Tài khoản", "账号");
  const account = { id: makeId("acc"), name: String(name || fallback).trim() || fallback, createdAt: nowIso() };
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
  const fallback = L("Gói hạn giờ", "限时卡包");
  const name = String(attrs.name || fallback).trim() || fallback;
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
  if (!slot || slot.status !== "pending") return next;
  const pulls = 1;
  const pullCount = pityOf(next, actualAccountId, DAILY_BANNER_ID).pullsSinceFiveStar + pulls;
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
    heroName: String(heroName || L("Tướng chưa ghi", "未记录武将")).trim() || L("Tướng chưa ghi", "未记录武将"),
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
  const pullCount = pityOf(next, actualAccountId, bannerId).pullsSinceFiveStar + actualPulls;
  addPullEvent(next, {
    accountId: actualAccountId,
    bannerId,
    date,
    drawKind: "adHoc",
    pulls: actualPulls,
    pullCount,
    result: "fiveStar",
    heroName: String(heroName || L("Tướng chưa ghi", "未记录武将")).trim() || L("Tướng chưa ghi", "未记录武将"),
    heroValueClass,
    note,
  });
  return next;
}

export function getFiveStarHistory(state) {
  return fiveStarHistoryOf(normalizeRecruitTrackerState(state));
}

/** Lịch sử 5★ trên state đã normalize, mới nhất trước; mỗi mục là bản sao nông của sự kiện. */
function fiveStarHistoryOf(next) {
  const accountById = new Map(next.accounts.map((account) => [account.id, account]));
  const bannerById = new Map(next.banners.map((banner) => [banner.id, banner]));
  return next.pullEvents
    .filter((event) => event.result === "fiveStar")
    .map((event) => ({
      ...event,
      accountName: accountById.get(event.accountId)?.name || "",
      bannerName: bannerDisplayName(bannerById.get(event.bannerId)) || event.bannerId,
      pityLimit: Number(bannerById.get(event.bannerId)?.pityLimit) || defaultDailyBanner().pityLimit,
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
    .map((banner) => ({ banner, pity: pityOf(next, actualAccountId, banner.id) }));
  return {
    state: next,
    account: next.accounts.find((account) => account.id === actualAccountId),
    accounts: next.accounts,
    daily: {
      banner: dailyBanner,
      slots: dailyState.slots,
      todayDone: dailyState.slots.filter((slot) => slot.status !== "pending").length,
      pity: pityOf(next, actualAccountId, DAILY_BANNER_ID),
    },
    limitedBanners,
    history: fiveStarHistoryOf(next).filter((event) => event.accountId === actualAccountId),
  };
}

const PULL_RESULTS = new Set(["miss", "fiveStar"]);
const SLOT_STATUSES = new Set(["pending", "miss", "fiveStar"]);
const DAILY_SLOT_KEYS = new Set(DAILY_SLOT_DEFS.map((slot) => slot.key));

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isId(value) {
  return typeof value === "string" && value.length > 0;
}

/** Mọi phần tử banner/lượt quay/lượt ngày đúng kiểu và chỉ trỏ tới tài khoản, banner có trong file. */
function recordsAreConsistent(value) {
  const accountIds = new Set(value.accounts.map((account) => account.id));
  if (!value.banners.every((banner) => isRecord(banner) && isId(banner.id) && typeof banner.name === "string")) return false;
  const bannerIds = new Set([DAILY_BANNER_ID, ...value.banners.map((banner) => banner.id)]);
  const eventOk = (event) => isRecord(event)
    && accountIds.has(event.accountId) && bannerIds.has(event.bannerId)
    && typeof event.pulls === "number" && Number.isFinite(event.pulls) && event.pulls >= 1
    && PULL_RESULTS.has(event.result);
  if (!value.pullEvents.every(eventOk)) return false;
  if (value.dailyStates === undefined) return true;
  const slotOk = (slot) => isRecord(slot) && DAILY_SLOT_KEYS.has(slot.key) && SLOT_STATUSES.has(slot.status);
  return Array.isArray(value.dailyStates) && value.dailyStates.every((daily) => isRecord(daily)
    && accountIds.has(daily.accountId) && bannerIds.has(daily.bannerId) && typeof daily.date === "string"
    && Array.isArray(daily.slots) && daily.slots.every(slotOk));
}

export function validateRecruitTrackerImport(value) {
  const invalid = L("Dữ liệu không hợp lệ.", "数据无效。");
  if (!value || typeof value !== "object") return { ok: false, error: invalid };
  if (value.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: L("Sai phiên bản dữ liệu.", "数据版本不符。") };
  if (!Array.isArray(value.accounts) || value.accounts.length === 0) return { ok: false, error: L("Thiếu tài khoản.", "缺少账号。") };
  if (!value.accounts.every((account) => isRecord(account) && isId(account.id) && typeof account.name === "string")) {
    return { ok: false, error: L("Tài khoản không hợp lệ.", "账号无效。") };
  }
  if (!value.accounts.some((account) => account.id === value.activeAccountId)) return { ok: false, error: L("Tài khoản hiện tại không hợp lệ.", "当前账号无效。") };
  if (!Array.isArray(value.banners)) return { ok: false, error: L("Thiếu banner.", "缺少卡池。") };
  if (!Array.isArray(value.pullEvents)) return { ok: false, error: L("Thiếu lịch sử quay.", "缺少抽卡记录。") };
  if (!recordsAreConsistent(value)) return { ok: false, error: invalid };
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
