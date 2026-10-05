import { L } from "./i18n.js";

// Kho Theo dõi chiêu mộ, schema v2: một luồng bản ghi làm nguồn sự thật duy nhất.
// Mọi bản ghi (tài khoản, gói, lượt) có `id`, `updatedAt`, `deletedAt` (dấu xóa) để hoàn tác, sửa/xóa nhật ký
// và gộp giữa nhiều thiết bị theo luật "bản sửa sau cùng thắng" cho từng bản ghi. Bảo hiểm, "Hôm nay x/4",
// số lượt tới 5★ và thống kê đều tính lại từ các lượt còn sống, sắp theo `occurredAt` rồi `id` — không lưu riêng.

const STORAGE_KEY = "tqcclRecruitTracker";
const SCHEMA_VERSION = 2;
const LEGACY_SCHEMA_VERSION = 1;
const DAILY_BANNER_ID = "danh-tuong-pk";
/** Số lượt rẻ (miễn phí + nửa giá) mỗi ngày của gói ngày. */
const DAILY_PULL_LIMIT = 4;
const DEFAULT_PITY_LIMIT = 30;
/** Mốc thời gian của bản ghi mặc định: mọi sửa thật đều mới hơn, nên máy mới không đè tên đã đổi khi gộp. */
const EPOCH = new Date(0).toISOString();
const DEFAULT_ACCOUNT_ID = "acc_main";
const DEFAULT_VALUE_CLASS = "Chưa phân loại";
const SET_PITY_MAX = 999;

/** Bốn ô lượt ngày của schema v1: chỉ còn để đọc/validate dữ liệu cũ và hiện nhãn `drawSlot` của bản ghi cũ. */
const LEGACY_DAILY_SLOT_DEFS = [
  { key: "free_1", label: "Miễn phí 1", labelZh: "免费 1" },
  { key: "half_1", label: "Nửa giá 1", labelZh: "半价 1" },
  { key: "free_2", label: "Miễn phí 2", labelZh: "免费 2" },
  { key: "half_2", label: "Nửa giá 2", labelZh: "半价 2" },
];
// Tên gói ngày mặc định lưu trong kho luôn là bản Việt (dữ liệu, không đổi theo ngôn ngữ).
const DAILY_BANNER_NAME = "Danh tướng PK";

const PULL_RESULTS = new Set(["miss", "fiveStar"]);
const EVENT_RESULTS = new Set(["miss", "fiveStar", "set"]);
const LEGACY_SLOT_STATUSES = new Set(["pending", "miss", "fiveStar"]);
const LEGACY_SLOT_KEYS = new Set(LEGACY_DAILY_SLOT_DEFS.map((slot) => slot.key));
const RECORD_KINDS = ["account", "banner", "event"];

/* ---------- Tiện ích ---------- */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toDate(now) {
  if (now instanceof Date) return now;
  return now === undefined || now === null ? new Date() : new Date(now);
}

function toMs(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

const isoOf = (ms) => new Date(ms).toISOString();

/** Đồng hồ của kho: `updatedAt` lớn nhất trong mọi bản ghi (kể cả bản ghi gộp từ máy khác). */
function clockOf(state) {
  let max = 0;
  for (const list of [state.accounts, state.banners, state.pullEvents]) {
    for (const record of list) max = Math.max(max, toMs(record.updatedAt));
  }
  return max;
}

/**
 * Dấu thời gian cho một thay đổi tại chỗ: mới hơn mọi bản ghi kho đã thấy (đồng hồ Lamport), nên thay đổi sau cùng
 * luôn thắng khi gộp và luôn được đẩy lên dù đồng hồ máy này chậm hơn máy đã đồng bộ trước đó.
 */
function stamp(state, now) {
  return isoOf(Math.max(toDate(now).getTime(), clockOf(state) + 1));
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

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const isId = (value) => typeof value === "string" && value.length > 0;
const isIso = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const isOptionalIso = (value) => value === undefined || value === null || value === "" || isIso(value);
const isLive = (record) => !record.deletedAt;
const asArray = (value) => (Array.isArray(value) ? value : []);
const cleanName = (value, fallback) => String(value ?? "").trim() || fallback;
const toInt = (value, fallback) => (Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback);

/* ---------- Nhãn hiển thị ---------- */

/** Tên một ô lượt ngày của bản ghi cũ (`free_1` → "Miễn phí 1" / "免费 1"); giá trị lạ (đã lưu nhãn) giữ nguyên. */
export function dailySlotLabel(slotKey) {
  const def = LEGACY_DAILY_SLOT_DEFS.find((slot) => slot.key === slotKey);
  return def ? L(def.label, def.labelZh) : String(slotKey || "");
}

/** Tên gói để hiển thị: gói ngày còn giữ tên mặc định thì dịch theo ngôn ngữ trang; tên người dùng đặt giữ nguyên. */
export function bannerDisplayName(banner) {
  if (banner?.id === DAILY_BANNER_ID && banner.name === DAILY_BANNER_NAME) return L(DAILY_BANNER_NAME, "PK名将招募");
  return banner?.name || "";
}

/* ---------- Bản ghi mặc định ---------- */

function defaultDailyBanner() {
  return {
    id: DAILY_BANNER_ID,
    name: DAILY_BANNER_NAME,
    type: "normal",
    drawMode: "daily",
    hasFiveStar: true,
    pityLimit: DEFAULT_PITY_LIMIT,
    dailyCheapPullLimit: DAILY_PULL_LIMIT,
    expiresAt: "",
    note: "",
    archivedAt: "",
    createdAt: EPOCH,
    updatedAt: EPOCH,
    deletedAt: "",
  };
}

function defaultAccount() {
  return { id: DEFAULT_ACCOUNT_ID, name: L("Chính", "主号"), createdAt: EPOCH, updatedAt: EPOCH, deletedAt: "" };
}

export function createDefaultRecruitTrackerState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeAccountId: DEFAULT_ACCOUNT_ID,
    accounts: [defaultAccount()],
    banners: [defaultDailyBanner()],
    pullEvents: [],
  };
}

/* ---------- Kiểm tra từng bản ghi v2 ---------- */

function validAccount(account) {
  return isRecord(account) && isId(account.id) && typeof account.name === "string"
    && isIso(account.updatedAt) && isOptionalIso(account.deletedAt);
}

function validBanner(banner) {
  return isRecord(banner) && isId(banner.id) && typeof banner.name === "string"
    && isIso(banner.updatedAt) && isOptionalIso(banner.deletedAt) && isOptionalIso(banner.archivedAt)
    && (banner.pityLimit === undefined || (Number.isFinite(banner.pityLimit) && banner.pityLimit > 0));
}

function validEvent(event) {
  if (!isRecord(event) || !isId(event.id) || !isId(event.accountId) || !isId(event.bannerId)) return false;
  if (!isIso(event.occurredAt) || !isIso(event.updatedAt) || !isOptionalIso(event.deletedAt)) return false;
  if (typeof event.date !== "string" || !EVENT_RESULTS.has(event.result)) return false;
  if (typeof event.pulls !== "number" || !Number.isFinite(event.pulls)) return false;
  return event.result === "set" ? event.pulls >= 0 : event.pulls >= 1;
}

const RECORD_VALIDATORS = { account: validAccount, banner: validBanner, event: validEvent };
const RECORD_LISTS = { account: "accounts", banner: "banners", event: "pullEvents" };

/* ---------- Chuẩn hoá, chuyển v1 → v2 ---------- */

/** Giữ ít nhất một tài khoản sống (gộp có thể xóa hết) và tài khoản đang chọn luôn là tài khoản sống. */
function ensureLiveAccount(state, activeAccountId, now) {
  if (!state.accounts.length) state.accounts.push(defaultAccount());
  if (!state.accounts.some(isLive)) {
    const latest = state.accounts.reduce((best, account) => (toMs(account.updatedAt) > toMs(best.updatedAt) ? account : best));
    latest.deletedAt = "";
    latest.updatedAt = stamp(state, now);
  }
  const live = state.accounts.filter(isLive);
  state.activeAccountId = live.some((account) => account.id === activeAccountId) ? activeAccountId : live[0].id;
  return state;
}

function ensureDailyBanner(banners) {
  const index = banners.findIndex((banner) => banner.id === DAILY_BANNER_ID);
  const daily = { ...defaultDailyBanner(), ...(index >= 0 ? banners[index] : {}), deletedAt: "", archivedAt: "" };
  if (index >= 0) banners[index] = daily;
  else banners.unshift(daily);
  return banners;
}

function normalizeV2(input, now) {
  const state = {
    schemaVersion: SCHEMA_VERSION,
    activeAccountId: "",
    accounts: clone(asArray(input.accounts).filter(validAccount)),
    banners: ensureDailyBanner(clone(asArray(input.banners).filter(validBanner))),
    pullEvents: clone(asArray(input.pullEvents).filter(validEvent)),
  };
  return ensureLiveAccount(state, input.activeAccountId, now);
}

/**
 * v1 → v2: bỏ `dailyStates` (trùng với lượt), gán `occurredAt` tăng dần theo đúng thứ tự mảng cũ (thứ tự bảo hiểm
 * của v1) và giữ số lượt tới 5★ đã lưu: nếu `pullCount` cũ lớn hơn số tích lũy thì `pulls` của lượt 5★ nhận phần chênh.
 */
function migrateV1(v1) {
  const accounts = v1.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    createdAt: isIso(account.createdAt) ? account.createdAt : EPOCH,
    updatedAt: isIso(account.updatedAt) ? account.updatedAt : (isIso(account.createdAt) ? account.createdAt : EPOCH),
    deletedAt: "",
  }));
  const banners = v1.banners.map((banner) => {
    const createdAt = isIso(banner.createdAt) ? banner.createdAt : EPOCH;
    return {
      ...banner,
      expiresAt: typeof banner.expiresAt === "string" ? banner.expiresAt : "",
      note: typeof banner.note === "string" ? banner.note : "",
      archivedAt: "",
      createdAt,
      updatedAt: banner.id === DAILY_BANNER_ID ? EPOCH : createdAt,
      deletedAt: "",
    };
  });
  const running = new Map();
  let previous = 0;
  const pullEvents = v1.pullEvents.map((event) => {
    const occurred = Math.max(toMs(event.createdAt), previous + 1);
    previous = occurred;
    const key = `${event.accountId}\u0000${event.bannerId}`;
    const before = running.get(key) || 0;
    const { pullCount, ...rest } = event;
    let pulls = event.pulls;
    if (event.result === "fiveStar") {
      if (Number.isFinite(pullCount) && pullCount > before) pulls = pullCount - before;
      running.set(key, 0);
    } else {
      running.set(key, before + pulls);
    }
    return {
      ...rest,
      pulls,
      date: typeof event.date === "string" ? event.date : "",
      occurredAt: isoOf(occurred),
      createdAt: isIso(event.createdAt) ? event.createdAt : isoOf(occurred),
      updatedAt: isIso(event.updatedAt) ? event.updatedAt : isoOf(occurred),
      deletedAt: "",
    };
  });
  return { schemaVersion: SCHEMA_VERSION, activeAccountId: v1.activeAccountId, accounts, banners, pullEvents };
}

/** Nhận state v1 hợp lệ (chuyển sang v2) hoặc v2 (bỏ lặng lẽ bản ghi hỏng); còn lại trả state mặc định. */
export function normalizeRecruitTrackerState(input, now = new Date()) {
  if (isRecord(input) && input.schemaVersion === SCHEMA_VERSION) return normalizeV2(input, now);
  if (isRecord(input) && input.schemaVersion === LEGACY_SCHEMA_VERSION && validateV1(input).ok) {
    return normalizeV2(migrateV1(clone(input)), now);
  }
  return createDefaultRecruitTrackerState();
}

const withState = (state, now) => normalizeRecruitTrackerState(state, now);

/* ---------- Truy vấn nội bộ ---------- */

function findAccountId(state, accountId) {
  const live = state.accounts.filter(isLive);
  if (accountId && live.some((account) => account.id === accountId)) return accountId;
  return live.some((account) => account.id === state.activeAccountId) ? state.activeAccountId : live[0]?.id;
}

function liveBanner(state, bannerId) {
  return state.banners.find((banner) => banner.id === bannerId && isLive(banner));
}

const byOccurrence = (a, b) => toMs(a.occurredAt) - toMs(b.occurredAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Lượt còn sống của một tài khoản sống, trên gói còn sống, theo thứ tự xảy ra. */
function accountEvents(state, accountId) {
  const liveBanners = new Set(state.banners.filter(isLive).map((banner) => banner.id));
  const liveAccounts = new Set(state.accounts.filter(isLive).map((account) => account.id));
  return state.pullEvents
    .filter((event) => isLive(event) && event.accountId === accountId && liveAccounts.has(accountId) && liveBanners.has(event.bannerId))
    .sort(byOccurrence);
}

/** Một lượt duyệt: số tích lũy hiện tại của từng gói và số lượt tới 5★ của từng lượt 5★. */
function analyze(events) {
  const running = new Map();
  const pullCountById = new Map();
  for (const event of events) {
    const before = running.get(event.bannerId) || 0;
    if (event.result === "set") running.set(event.bannerId, event.pulls);
    else if (event.result === "fiveStar") {
      pullCountById.set(event.id, before + event.pulls);
      running.set(event.bannerId, 0);
    } else running.set(event.bannerId, before + event.pulls);
  }
  return { running, pullCountById };
}

function pityFor(banner, pullsSinceFiveStar) {
  const pityLimit = banner?.pityLimit || DEFAULT_PITY_LIMIT;
  return {
    pullsSinceFiveStar,
    pityLimit,
    remaining: Math.max(pityLimit - pullsSinceFiveStar, 0),
    isOverLimit: pullsSinceFiveStar >= pityLimit,
  };
}

function dailyPullsOn(events, date) {
  return events
    .filter((event) => event.bannerId === DAILY_BANNER_ID && event.date === date && PULL_RESULTS.has(event.result))
    .reduce((sum, event) => sum + event.pulls, 0);
}

/** Mới nhất trước: theo ngày ghi, rồi thứ tự xảy ra. */
const newestFirst = (a, b) => String(b.date).localeCompare(String(a.date)) || byOccurrence(b, a);

function nextOccurredAt(state, now) {
  const latest = state.pullEvents.reduce((max, event) => Math.max(max, toMs(event.occurredAt)), 0);
  return isoOf(Math.max(toDate(now).getTime(), latest + 1));
}

function addEvent(state, fields, now) {
  const at = nextOccurredAt(state, now);
  const updatedAt = stamp(state, now);
  const event = {
    id: makeId("evt"),
    pulls: 1,
    result: "miss",
    heroName: "",
    heroValueClass: "",
    note: "",
    ...fields,
    occurredAt: at,
    createdAt: at,
    updatedAt,
    deletedAt: "",
  };
  state.pullEvents.push(event);
  return event;
}

function heroFields({ heroName, heroValueClass, note }) {
  const fallback = L("Tướng chưa ghi", "未记录武将");
  return {
    heroName: cleanName(heroName, fallback),
    heroValueClass: String(heroValueClass || DEFAULT_VALUE_CLASS),
    note: String(note || ""),
  };
}

/* ---------- Tài khoản ---------- */

export function createAccount(state, name, { now } = {}) {
  const next = withState(state, now);
  const at = stamp(next, now);
  const account = { id: makeId("acc"), name: cleanName(name, L("Tài khoản", "账号")), createdAt: at, updatedAt: at, deletedAt: "" };
  next.accounts.push(account);
  next.activeAccountId = account.id;
  return next;
}

export function renameAccount(state, accountId, name, { now } = {}) {
  const next = withState(state, now);
  const account = next.accounts.find((item) => item.id === accountId && isLive(item));
  if (!account) return next;
  const nextName = cleanName(name, account.name);
  if (nextName === account.name) return next;
  account.name = nextName;
  account.updatedAt = stamp(next, now);
  return next;
}

/** Xóa mềm tài khoản; các lượt của nó tự rời mọi màn hình. Luôn giữ lại ít nhất một tài khoản. */
export function deleteAccount(state, accountId, { now } = {}) {
  const next = withState(state, now);
  const live = next.accounts.filter(isLive);
  const account = live.find((item) => item.id === accountId);
  if (!account || live.length <= 1) return next;
  account.deletedAt = toDate(now).toISOString();
  account.updatedAt = stamp(next, now);
  return ensureLiveAccount(next, next.activeAccountId, now);
}

export function setActiveAccount(state, accountId) {
  const next = withState(state);
  if (next.accounts.some((account) => account.id === accountId && isLive(account))) next.activeAccountId = accountId;
  return next;
}

/* ---------- Gói hạn giờ ---------- */

export function createLimitedBanner(state, { name, expiresAt = "", note = "", now } = {}) {
  const next = withState(state, now);
  const at = stamp(next, now);
  next.banners.push({
    id: makeId("banner"),
    name: cleanName(name, L("Gói hạn giờ", "限时卡包")),
    type: "limited",
    drawMode: "adHoc",
    hasFiveStar: true,
    pityLimit: DEFAULT_PITY_LIMIT,
    expiresAt: String(expiresAt || ""),
    note: String(note || ""),
    archivedAt: "",
    createdAt: at,
    updatedAt: at,
    deletedAt: "",
  });
  return next;
}

function editableBanner(state, bannerId) {
  return bannerId === DAILY_BANNER_ID ? null : liveBanner(state, bannerId);
}

export function updateBanner(state, bannerId, patch = {}, { now } = {}) {
  const next = withState(state, now);
  const banner = editableBanner(next, bannerId);
  if (!banner) return next;
  if (patch.name !== undefined) banner.name = cleanName(patch.name, banner.name);
  if (patch.expiresAt !== undefined) banner.expiresAt = String(patch.expiresAt || "");
  if (patch.note !== undefined) banner.note = String(patch.note || "");
  banner.updatedAt = stamp(next, now);
  return next;
}

export function setBannerArchived(state, bannerId, archived, { now } = {}) {
  const next = withState(state, now);
  const banner = editableBanner(next, bannerId);
  if (!banner || Boolean(banner.archivedAt) === Boolean(archived)) return next;
  banner.archivedAt = archived ? toDate(now).toISOString() : "";
  banner.updatedAt = stamp(next, now);
  return next;
}

/** Xóa mềm gói hạn giờ; lượt của gói rời nhật ký. Gói ngày không xóa được. */
export function deleteBanner(state, bannerId, { now } = {}) {
  const next = withState(state, now);
  const banner = editableBanner(next, bannerId);
  if (!banner) return next;
  banner.deletedAt = toDate(now).toISOString();
  banner.updatedAt = stamp(next, now);
  return next;
}

/* ---------- Ghi lượt ---------- */

/** Nút nhanh "2 miễn phí" / "Đủ 4": ghi lượt không ra, kẹp theo số lượt rẻ còn lại hôm nay (hết lượt thì không ghi). */
export function recordDailyMisses(state, { accountId, date = localDateFrom(), pulls = DAILY_PULL_LIMIT, now } = {}) {
  const next = withState(state, now);
  const actualAccountId = findAccountId(next, accountId);
  const remaining = DAILY_PULL_LIMIT - dailyPullsOn(accountEvents(next, actualAccountId), date);
  const count = Math.min(toInt(pulls, 0), remaining);
  if (count < 1) return next;
  addEvent(next, { accountId: actualAccountId, bannerId: DAILY_BANNER_ID, date, drawKind: "daily", pulls: count, result: "miss" }, now);
  return next;
}

/**
 * "Có 5★" ở gói ngày: trúng ở lượt thứ `hitAt` trong số lượt còn lại hôm nay, rồi quay tiếp `pullsAfter` lượt không ra.
 * Lưu một lượt 5★ (`pulls = hitAt`) và, nếu có, một lượt không ra cho phần quay tiếp.
 */
export function recordDailyFiveStar(state, { accountId, date = localDateFrom(), hitAt = 1, pullsAfter = 0, heroName, heroValueClass, note, now } = {}) {
  const next = withState(state, now);
  const actualAccountId = findAccountId(next, accountId);
  const remaining = DAILY_PULL_LIMIT - dailyPullsOn(accountEvents(next, actualAccountId), date);
  if (remaining < 1) return next;
  const hit = Math.min(Math.max(toInt(hitAt, 1), 1), remaining);
  const after = Math.min(Math.max(toInt(pullsAfter, 0), 0), remaining - hit);
  const base = { accountId: actualAccountId, bannerId: DAILY_BANNER_ID, date, drawKind: "daily" };
  addEvent(next, { ...base, ...heroFields({ heroName, heroValueClass, note }), pulls: hit, result: "fiveStar" }, now);
  if (after > 0) addEvent(next, { ...base, pulls: after, result: "miss" }, now);
  return next;
}

export function recordBannerMiss(state, { accountId, bannerId, pulls = 1, date = localDateFrom(), now } = {}) {
  const next = withState(state, now);
  if (!liveBanner(next, bannerId)) return next;
  addEvent(next, {
    accountId: findAccountId(next, accountId),
    bannerId,
    date,
    drawKind: "adHoc",
    pulls: Math.max(1, toInt(pulls, 1)),
    result: "miss",
  }, now);
  return next;
}

export function recordBannerFiveStar(state, { accountId, bannerId, pulls = 1, heroName, heroValueClass, note, date = localDateFrom(), now } = {}) {
  const next = withState(state, now);
  if (!liveBanner(next, bannerId)) return next;
  addEvent(next, {
    accountId: findAccountId(next, accountId),
    bannerId,
    date,
    drawKind: "adHoc",
    ...heroFields({ heroName, heroValueClass, note }),
    pulls: Math.max(1, toInt(pulls, 1)),
    result: "fiveStar",
  }, now);
  return next;
}

/** "Đồng bộ N lượt" từ game: một dòng nhật ký đặt số lượt tích lũy của gói về `value`; sửa/xóa được như mọi dòng. */
export function setPity(state, { accountId, bannerId = DAILY_BANNER_ID, value, date = localDateFrom(), now } = {}) {
  const next = withState(state, now);
  const pulls = toInt(value, -1);
  if (!liveBanner(next, bannerId) || pulls < 0 || pulls > SET_PITY_MAX) return next;
  addEvent(next, { accountId: findAccountId(next, accountId), bannerId, date, drawKind: "sync", pulls, result: "set" }, now);
  return next;
}

/* ---------- Sửa / xóa / khôi phục dòng nhật ký ---------- */

export function updatePullEvent(state, eventId, patch = {}, { now } = {}) {
  const next = withState(state, now);
  const event = next.pullEvents.find((item) => item.id === eventId && isLive(item));
  if (!event) return next;
  if (patch.pulls !== undefined) {
    const pulls = toInt(patch.pulls, event.pulls);
    const min = event.result === "set" ? 0 : 1;
    event.pulls = Math.min(Math.max(pulls, min), event.result === "set" ? SET_PITY_MAX : Number.MAX_SAFE_INTEGER);
  }
  if (event.result === "fiveStar") {
    if (patch.heroName !== undefined) event.heroName = cleanName(patch.heroName, event.heroName);
    if (patch.heroValueClass !== undefined) event.heroValueClass = String(patch.heroValueClass || DEFAULT_VALUE_CLASS);
  }
  if (patch.note !== undefined) event.note = String(patch.note || "");
  if (typeof patch.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(patch.date)) event.date = patch.date;
  event.updatedAt = stamp(next, now);
  return next;
}

function setEventsDeleted(state, eventIds, deleted, now) {
  const next = withState(state, now);
  const ids = new Set(eventIds);
  for (const event of next.pullEvents) {
    if (!ids.has(event.id) || Boolean(event.deletedAt) === deleted) continue;
    event.deletedAt = deleted ? toDate(now).toISOString() : "";
    event.updatedAt = stamp(next, now);
  }
  return next;
}

/** Xóa mềm các dòng; "Hoàn tác" một thao tác ghi = xóa đúng các dòng thao tác đó vừa tạo. */
export function deletePullEvents(state, eventIds, { now } = {}) {
  return setEventsDeleted(state, eventIds, true, now);
}

/** Khôi phục dòng đã xóa (Hoàn tác một lần xóa). */
export function restorePullEvents(state, eventIds, { now } = {}) {
  return setEventsDeleted(state, eventIds, false, now);
}

/* ---------- Truy vấn công khai ---------- */

export function getPity(state, accountId, bannerId) {
  const next = normalizeRecruitTrackerState(state);
  const actualAccountId = findAccountId(next, accountId);
  const { running } = analyze(accountEvents(next, actualAccountId));
  return pityFor(liveBanner(next, bannerId) || defaultDailyBanner(), running.get(bannerId) || 0);
}

function describeEvents(next, events, pullCountById) {
  const accountById = new Map(next.accounts.map((account) => [account.id, account]));
  const bannerById = new Map(next.banners.map((banner) => [banner.id, banner]));
  return events.map((event) => ({
    ...event,
    accountName: accountById.get(event.accountId)?.name || "",
    bannerName: bannerDisplayName(bannerById.get(event.bannerId)) || event.bannerId,
    pityLimit: Number(bannerById.get(event.bannerId)?.pityLimit) || DEFAULT_PITY_LIMIT,
    pullCount: pullCountById.get(event.id) ?? null,
  }));
}

/** Lịch sử 5★ của mọi tài khoản sống, mới nhất trước. */
export function getFiveStarHistory(state) {
  const next = normalizeRecruitTrackerState(state);
  return next.accounts.filter(isLive).flatMap((account) => {
    const events = accountEvents(next, account.id);
    const { pullCountById } = analyze(events);
    return describeEvents(next, events.filter((event) => event.result === "fiveStar"), pullCountById);
  }).sort(newestFirst);
}

function previousDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return localDateFrom(new Date(year, month - 1, day - 1));
}

/** Chuỗi ngày: số ngày liên tiếp có ghi lượt gói ngày, tính tới hôm nay (hoặc hôm qua khi hôm nay chưa ghi). */
function streakDays(events, today) {
  const days = new Set(events.filter((event) => event.bannerId === DAILY_BANNER_ID && PULL_RESULTS.has(event.result)).map((event) => event.date));
  let cursor = days.has(today) ? today : previousDate(today);
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = previousDate(cursor);
  }
  return count;
}

export function getRecruitTrackerSummary(state, { accountId, date = localDateFrom() } = {}) {
  const next = normalizeRecruitTrackerState(state);
  const actualAccountId = findAccountId(next, accountId);
  const events = accountEvents(next, actualAccountId);
  const { running, pullCountById } = analyze(events);
  const dailyBanner = liveBanner(next, DAILY_BANNER_ID) || defaultDailyBanner();
  const todayDone = dailyPullsOn(events, date);
  const log = describeEvents(next, events, pullCountById).sort(newestFirst);
  const history = log.filter((event) => event.result === "fiveStar");
  const totalPulls = history.reduce((sum, event) => sum + event.pullCount, 0);
  return {
    state: next,
    account: next.accounts.find((account) => account.id === actualAccountId),
    // Mỗi tài khoản kèm bảo hiểm gói ngày để ô chọn tài khoản hiện "Tên · x/30".
    accounts: next.accounts.filter(isLive).map((account) => ({
      ...account,
      dailyPity: pityFor(dailyBanner, analyze(accountEvents(next, account.id)).running.get(DAILY_BANNER_ID) || 0),
    })),
    daily: {
      banner: dailyBanner,
      todayDone,
      remainingToday: Math.max(DAILY_PULL_LIMIT - todayDone, 0),
      pity: pityFor(dailyBanner, running.get(DAILY_BANNER_ID) || 0),
    },
    limitedBanners: next.banners
      .filter((banner) => banner.id !== DAILY_BANNER_ID && isLive(banner) && banner.hasFiveStar !== false)
      .map((banner) => ({ banner, archived: Boolean(banner.archivedAt), pity: pityFor(banner, running.get(banner.id) || 0) })),
    history,
    log,
    stats: {
      fiveStars: history.length,
      averagePulls: history.length ? Math.round((totalPulls / history.length) * 10) / 10 : null,
      streakDays: streakDays(events, date),
    },
    isEmpty: events.length === 0,
  };
}

/* ---------- Gộp theo bản ghi (Nhập JSON, đồng bộ cloud) ---------- */

/**
 * Danh sách bản ghi để đồng bộ: `{ kind, id, updatedAt (ms), data }`. `since` (ms) chỉ lấy bản ghi sửa sau mốc đó.
 * Gói ngày là hằng số nên không gửi.
 */
export function recruitRecords(state, { since } = {}) {
  const next = normalizeRecruitTrackerState(state);
  const records = [];
  for (const kind of RECORD_KINDS) {
    for (const data of next[RECORD_LISTS[kind]]) {
      if (kind === "banner" && data.id === DAILY_BANNER_ID) continue;
      const updatedAt = toMs(data.updatedAt);
      if (since !== undefined && updatedAt <= since) continue;
      records.push({ kind, id: data.id, updatedAt, data: clone(data) });
    }
  }
  return records;
}

/** Gộp bản ghi từ nơi khác: mỗi bản ghi hợp lệ thay bản tại chỗ khi `updatedAt` mới hơn; hòa thì giữ bản tại chỗ. */
export function mergeRecruitRecords(state, records, { now } = {}) {
  const next = withState(state, now);
  const indexes = Object.fromEntries(RECORD_KINDS.map((kind) => [kind, new Map(next[RECORD_LISTS[kind]].map((item, index) => [item.id, index]))]));
  for (const record of asArray(records)) {
    if (!isRecord(record) || !RECORD_KINDS.includes(record.kind)) continue;
    const { kind, data } = record;
    if (!RECORD_VALIDATORS[kind](data) || data.id !== record.id) continue;
    if (kind === "banner" && data.id === DAILY_BANNER_ID) continue;
    const list = next[RECORD_LISTS[kind]];
    const index = indexes[kind].get(data.id);
    if (index === undefined) {
      indexes[kind].set(data.id, list.length);
      list.push(clone(data));
    } else if (toMs(data.updatedAt) > toMs(list[index].updatedAt)) {
      list[index] = clone(data);
    }
  }
  return ensureLiveAccount(next, next.activeAccountId, now);
}

/** Nhập JSON: file v1 hoặc v2 được gộp vào dữ liệu hiện có (không ghi đè); tài khoản đang chọn giữ nguyên. */
export function mergeRecruitTrackerState(state, incoming, { now } = {}) {
  return mergeRecruitRecords(state, recruitRecords(normalizeRecruitTrackerState(incoming, now)), { now });
}

/* ---------- Kiểm tra file nhập ---------- */

/** v1: mọi banner/lượt quay/lượt ngày đúng kiểu và chỉ trỏ tới tài khoản, banner có trong file. */
function validateV1(value) {
  const invalid = { ok: false, error: L("Dữ liệu không hợp lệ.", "数据无效。") };
  const base = validateShape(value);
  if (!base.ok) return base;
  const accountIds = new Set(value.accounts.map((account) => account.id));
  if (!value.banners.every((banner) => isRecord(banner) && isId(banner.id) && typeof banner.name === "string")) return invalid;
  const bannerIds = new Set([DAILY_BANNER_ID, ...value.banners.map((banner) => banner.id)]);
  const eventOk = (event) => isRecord(event)
    && accountIds.has(event.accountId) && bannerIds.has(event.bannerId)
    && typeof event.pulls === "number" && Number.isFinite(event.pulls) && event.pulls >= 1
    && PULL_RESULTS.has(event.result);
  if (!value.pullEvents.every(eventOk)) return invalid;
  if (value.dailyStates !== undefined) {
    const slotOk = (slot) => isRecord(slot) && LEGACY_SLOT_KEYS.has(slot.key) && LEGACY_SLOT_STATUSES.has(slot.status);
    const dailyOk = Array.isArray(value.dailyStates) && value.dailyStates.every((daily) => isRecord(daily)
      && accountIds.has(daily.accountId) && bannerIds.has(daily.bannerId) && typeof daily.date === "string"
      && Array.isArray(daily.slots) && daily.slots.every(slotOk));
    if (!dailyOk) return invalid;
  }
  return { ok: true };
}

function validateShape(value) {
  if (!Array.isArray(value.accounts) || value.accounts.length === 0) return { ok: false, error: L("Thiếu tài khoản.", "缺少账号。") };
  if (!value.accounts.every((account) => isRecord(account) && isId(account.id) && typeof account.name === "string")) {
    return { ok: false, error: L("Tài khoản không hợp lệ.", "账号无效。") };
  }
  if (!value.accounts.some((account) => account.id === value.activeAccountId)) return { ok: false, error: L("Tài khoản hiện tại không hợp lệ.", "当前账号无效。") };
  if (!Array.isArray(value.banners)) return { ok: false, error: L("Thiếu banner.", "缺少卡池。") };
  if (!Array.isArray(value.pullEvents)) return { ok: false, error: L("Thiếu lịch sử quay.", "缺少抽卡记录。") };
  return { ok: true };
}

/** v2: mọi bản ghi đúng kiểu và lượt chỉ trỏ tới tài khoản, gói có trong file. */
function validateV2(value) {
  const invalid = { ok: false, error: L("Dữ liệu không hợp lệ.", "数据无效。") };
  const base = validateShape(value);
  if (!base.ok) return base;
  if (!value.accounts.every(validAccount) || !value.banners.every(validBanner) || !value.pullEvents.every(validEvent)) return invalid;
  const accountIds = new Set(value.accounts.map((account) => account.id));
  const bannerIds = new Set([DAILY_BANNER_ID, ...value.banners.map((banner) => banner.id)]);
  if (!value.pullEvents.every((event) => accountIds.has(event.accountId) && bannerIds.has(event.bannerId))) return invalid;
  return { ok: true };
}

export function validateRecruitTrackerImport(value) {
  if (!isRecord(value)) return { ok: false, error: L("Dữ liệu không hợp lệ.", "数据无效。") };
  const validate = { [LEGACY_SCHEMA_VERSION]: validateV1, [SCHEMA_VERSION]: validateV2 }[value.schemaVersion];
  if (!validate) return { ok: false, error: L("Sai phiên bản dữ liệu.", "数据版本不符。") };
  const result = validate(value);
  if (!result.ok) return result;
  const live = (list) => list.filter((item) => !item.deletedAt).length;
  return { ok: true, summary: { accounts: live(value.accounts), banners: live(value.banners), events: live(value.pullEvents) } };
}

/* ---------- localStorage ---------- */

export function loadRecruitTrackerState(storage = globalThis.localStorage, now = new Date()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createDefaultRecruitTrackerState();
    return normalizeRecruitTrackerState(JSON.parse(raw), now);
  } catch {
    return createDefaultRecruitTrackerState();
  }
}

export function saveRecruitTrackerState(storage = globalThis.localStorage, state) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(normalizeRecruitTrackerState(state)));
}

export { DAILY_BANNER_ID, DAILY_PULL_LIMIT, SCHEMA_VERSION, STORAGE_KEY };
