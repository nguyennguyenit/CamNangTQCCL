import { el, icon, svgNode } from "./render.js";
import { createDropdownMenu } from "./site-nav.js";
import { L } from "./i18n.js";
import { describeError, googleIcon } from "./community-api.js";
import { createRecruitSync } from "./recruit-sync.js";
import {
  DAILY_BANNER_ID,
  DAILY_PULL_LIMIT,
  STORAGE_KEY,
  bannerDisplayName,
  createAccount,
  createLimitedBanner,
  deleteAccount,
  deleteBanner,
  deletePullEvents,
  getRecruitTrackerSummary,
  loadRecruitTrackerState,
  mergeRecruitRecords,
  mergeRecruitTrackerState,
  recordBannerFiveStar,
  recordBannerMiss,
  recordDailyFiveStar,
  recordDailyMisses,
  renameAccount,
  restorePullEvents,
  saveRecruitTrackerState,
  setActiveAccount,
  setBannerArchived,
  setPity,
  updateBanner,
  updatePullEvent,
  validateRecruitTrackerImport,
} from "./recruit-tracker-store.js";

// Theo dõi chiêu mộ (schema v2): mọi con số đọc từ `getRecruitTrackerSummary`; mỗi thao tác ghi là một hàm
// thuần của store rồi lưu localStorage, báo đồng bộ cloud (nếu đã đăng nhập) và vẽ lại tại chỗ.
// Hộp thoại dùng `<dialog>` native theo mẫu `.footer-dialog` của site (không `prompt`/`confirm`).
// Bố cục theo artboard Recruit / RecruitFiveStar (+ Mobile): cột chính [Hôm nay, lời mời, Nhật ký],
// cột phụ [Thống kê, Gói hạn giờ, thông báo lưu dữ liệu].

const VALUE_CLASSES = ["Chưa phân loại", "Chủ lực", "Dùng đội", "Tình huống", "Nội chính", "Vật liệu"];
const DEFAULT_VALUE_CLASS = VALUE_CLASSES[0];
/** Phân loại lưu trong kho luôn là giá trị tiếng Việt ở trên; bản zh chỉ đổi chữ hiển thị. */
const VALUE_CLASS_ZH = {
  "Chưa phân loại": "未分类",
  "Chủ lực": "主力",
  "Dùng đội": "组队可用",
  "Tình huống": "特定场景",
  "Nội chính": "内政",
  "Vật liệu": "材料",
};
const valueClassLabel = (value) => L(value, VALUE_CLASS_ZH[value] || value);
/** Badge phân loại tướng 5★: "Chủ lực" nền son nhạt, các mức còn lại nền giấy đậm. */
const VALUE_BADGE_CLASS = { "Chủ lực": "rt-value-accent" };

/** Thời gian toast "Hoàn tác" còn trên màn hình. */
const TOAST_MS = 6000;
/** Khóa nhớ người dùng đã tắt lời mời đăng nhập sau 5★ đầu tiên. */
const INVITE_KEY = "tqcclRecruitTracker:invite";
/** Số dòng nhật ký mỗi lượt hiện ("Xem thêm" nối thêm đúng số này). */
const LOG_PAGE = 20;
const SET_PITY_MAX = 999;
const DAY_MS = 24 * 60 * 60 * 1000;

// `<html lang>` cố định theo trang nên nhãn dịch lúc nạp module vẫn đúng ngôn ngữ.
const RULE_WARNING = L("Kiểm tra lại dữ liệu/quy tắc game", "请核对数据或游戏规则");
const FIVE_STAR_LABEL = L("Có 5★", "出 5★");
const SYNC_TEXT = {
  guest: L("Chưa đồng bộ", "未同步"),
  syncing: L("Đang đồng bộ…", "正在同步…"),
  synced: L("Đã đồng bộ", "已同步"),
  offline: L("Ngoại tuyến · sẽ đồng bộ lại", "离线 · 稍后同步"),
  error: L("Lỗi đồng bộ", "同步出错"),
};

const plusIcon = (size = 16) => icon([
  svgNode("line", { x1: 12, y1: 5, x2: 12, y2: 19 }),
  svgNode("line", { x1: 5, y1: 12, x2: 19, y2: 12 }),
], { size, stroke: 2 });

const minusIcon = () => icon([
  svgNode("line", { x1: 5, y1: 12, x2: 19, y2: 12 }),
], { size: 16, stroke: 2 });

const downloadIcon = () => icon([
  svgNode("path", { d: "M12 4v12" }),
  svgNode("path", { d: "M7 11l5 5 5-5" }),
  svgNode("path", { d: "M4 20h16" }),
], { size: 16 });

const uploadIcon = () => icon([
  svgNode("path", { d: "M12 16V4" }),
  svgNode("path", { d: "M7 9l5-5 5 5" }),
  svgNode("path", { d: "M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" }),
], { size: 16 });

const shieldIcon = () => icon([
  svgNode("path", { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" }),
], { size: 17 });

const cloudIcon = () => icon([
  svgNode("path", { d: "M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" }),
], { size: 15 });

const starIcon = () => icon([
  svgNode("path", { d: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" }),
], { size: 16 });

const clockIcon = () => icon([
  svgNode("circle", { cx: 12, cy: 12, r: 9 }),
  svgNode("path", { d: "M12 7v5l3 2" }),
], { size: 14 });

const checkIcon = () => icon([
  svgNode("path", { d: "M5 12l5 5L20 7" }),
], { size: 16 });

const undoIcon = () => icon([
  svgNode("path", { d: "M9 14L4 9l5-5" }),
  svgNode("path", { d: "M4 9h10a6 6 0 0 1 0 12h-3" }),
], { size: 15 });

const moreIcon = () => icon([
  svgNode("circle", { cx: 5, cy: 12, r: 1.5 }),
  svgNode("circle", { cx: 12, cy: 12, r: 1.5 }),
  svgNode("circle", { cx: 19, cy: 12, r: 1.5 }),
], { size: 16 });

const editIcon = () => icon([
  svgNode("path", { d: "M4 20h4L19 9l-4-4L4 16z" }),
], { size: 16 });

const trashIcon = () => icon([
  svgNode("path", { d: "M4 7h16" }),
  svgNode("path", { d: "M9 7V4h6v3" }),
  svgNode("path", { d: "M6 7l1 13h10l1-13" }),
], { size: 16 });

const closeIcon = () => icon([
  svgNode("path", { d: "M6 6l12 12" }),
  svgNode("path", { d: "M18 6L6 18" }),
], { size: 16 });

function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Gợi ý tên tướng: bản zh dùng tên chữ Hán gốc, bản Việt dùng tên Việt. */
function heroName(hero) {
  return L(
    hero.name || hero.viet || hero.hanViet || hero.chinese || "",
    hero.chinese || hero.name || hero.viet || hero.hanViet || "",
  );
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, L("vi", "zh-CN")));
}

/** Số cho thanh tiến độ: giữ giá trị thật của store, chỉ gộp phần trăm hiển thị trong khoảng 0–100. */
function pityView(pity) {
  const limit = Number(pity?.pityLimit) > 0 ? Number(pity.pityLimit) : 0;
  const value = Math.max(Number(pity?.pullsSinceFiveStar) || 0, 0);
  return {
    value,
    limit,
    remaining: Number(pity?.remaining) || 0,
    isOverLimit: Boolean(pity?.isOverLimit),
    percent: limit ? Math.min(100, Math.round((value / limit) * 100)) : 0,
  };
}

const dayNumber = (date) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ""));
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS : null;
};

/**
 * Đếm ngược tới ngày hết hạn của gói (ngày cuối vẫn quay được). Không đặt ngày thì không hiện gì.
 * `tone` chọn màu chip hạn: "warn" ngày cuối, "avoid" đã quá hạn.
 */
export function expiryView(expiresAt, today) {
  const end = dayNumber(expiresAt);
  const now = dayNumber(today);
  if (end === null || now === null) return { text: "", expired: false, tone: "" };
  const days = end - now;
  if (days < 0) return { text: L("hết hạn", "已过期"), expired: true, tone: "avoid" };
  if (days === 0) return { text: L("hết hạn hôm nay", "今日截止"), expired: false, tone: "warn" };
  return { text: L(`còn ${days} ngày`, `剩 ${days} 天`), expired: false, tone: "" };
}

/** Ngày của dòng nhật ký: "Hôm nay", "Hôm qua", "27/09" (cùng năm với hôm nay) hoặc "27/09/2025". */
export function logDateLabel(date, today) {
  const day = dayNumber(date);
  const now = dayNumber(today);
  if (day === null || now === null) return String(date || "");
  if (day === now) return L("Hôm nay", "今天");
  if (day === now - 1) return L("Hôm qua", "昨天");
  const [year, month, dayOfMonth] = date.slice(0, 10).split("-");
  return year === today.slice(0, 4) ? `${dayOfMonth}/${month}` : `${dayOfMonth}/${month}/${year}`;
}

/** Ngày đầy đủ dd/mm/yyyy (ô Ngày chỉ đọc của hộp thoại 5★ gói ngày, tooltip ngày nhật ký). */
function fullDate(date) {
  const [year, month, day] = String(date || "").slice(0, 10).split("-");
  return day ? `${day}/${month}/${year}` : "";
}

/** Số thập phân theo ngôn ngữ trang: "21,4" (vi) / "21.4" (zh). */
const decimal = (value) => L(String(value).replace(".", ","), String(value));

/** Chữ một dòng nhật ký: "+4 không ra", "★ Tào Tháo · lượt 27", "Đồng bộ 17 lượt". */
function logText(row) {
  if (row.result === "fiveStar") {
    const count = row.pullCount ?? row.pulls;
    return L(`★ ${row.heroName} · lượt ${count}`, `★ ${row.heroName} · 第 ${count} 抽`);
  }
  if (row.result === "set") return L(`Đồng bộ ${row.pulls} lượt`, `同步为 ${row.pulls} 抽`);
  return L(`+${row.pulls} không ra`, `+${row.pulls} 未出`);
}

/**
 * Vị trí lượt rẻ trong ngày của mỗi dòng không ra ở gói ngày ("Lượt 1–2/4"): cộng dồn các dòng gói ngày cùng ngày
 * theo thứ tự xảy ra. Ngày có dữ liệu cũ vượt 4 lượt thì bỏ nhãn của các dòng vượt thay vì hiện số sai.
 */
function dailySlotTexts(log) {
  const byDate = new Map();
  for (const row of log) {
    if (row.bannerId !== DAILY_BANNER_ID || row.result === "set") continue;
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }
  const texts = new Map();
  for (const rows of byDate.values()) {
    rows.sort((a, b) => String(a.occurredAt || "").localeCompare(String(b.occurredAt || "")));
    let done = 0;
    for (const row of rows) {
      const start = done + 1;
      done += row.pulls;
      if (row.result !== "miss" || done > DAILY_PULL_LIMIT) continue;
      const range = start === done ? String(done) : `${start}–${done}`;
      texts.set(row.id, L(`Lượt ${range}/${DAILY_PULL_LIMIT}`, `第 ${range}/${DAILY_PULL_LIMIT} 抽`));
    }
  }
  return texts;
}

/** Nút nhanh của gói ngày: số lượt thật sẽ ghi đã kẹp theo lượt rẻ còn lại hôm nay; dòng phụ nói đúng số đó. */
function quickButton(key, label, wanted, remainingToday) {
  const pulls = Math.max(Math.min(wanted, remainingToday), 0);
  let sub = L(`Hôm nay đã đủ ${DAILY_PULL_LIMIT} lượt`, `今日 ${DAILY_PULL_LIMIT} 次已记满`);
  if (pulls && key === "free") sub = L(`Ghi +${pulls} lượt không ra`, `记录 +${pulls} 次未出`);
  else if (pulls) sub = L(`Ghi ${pulls} lượt rẻ còn lại`, `记录剩余 ${pulls} 次低价招募`);
  return {
    key,
    label,
    pulls,
    disabled: pulls < 1,
    sub,
    ariaLabel: pulls
      ? L(`${label} (ghi ${pulls} lượt không ra)`, `${label}（记录 ${pulls} 次未出）`)
      : L(`${label} (hôm nay đã đủ ${DAILY_PULL_LIMIT} lượt)`, `${label}（今日 ${DAILY_PULL_LIMIT} 次已记满）`),
  };
}

const pityText = (pity) => `${pity.value} / ${pity.limit}`;

/** Dòng phụ của ô "TB lượt / 5★": so trung bình với mốc bảo hiểm gói ngày. */
function averageSub(average, limit) {
  if (average === null) return L("chưa có 5★", "暂无 5★");
  if (average < limit) return L(`thấp hơn mốc ${limit}`, `低于保底 ${limit}`);
  if (average > limit) return L(`cao hơn mốc ${limit}`, `高于保底 ${limit}`);
  return L(`bằng mốc ${limit}`, `等于保底 ${limit}`);
}

export function buildRecruitTrackerViewModel(summary, heroesDict = [], { today = todayLocalDate() } = {}) {
  const heroes = Array.isArray(heroesDict) ? heroesDict : Object.values(heroesDict || {});
  const { daily, stats } = summary;
  const dailyPity = pityView(daily.pity);
  const remainingToday = Math.max(Number(daily.remainingToday) || 0, 0);
  const limitedBanners = summary.limitedBanners.map((item) => {
    const pity = pityView(item.pity);
    return {
      id: item.banner.id,
      name: item.banner.name,
      expiresAt: item.banner.expiresAt || "",
      archived: Boolean(item.archived),
      expiry: expiryView(item.banner.expiresAt, today),
      pity,
      pityText: pityText(pity),
      warning: pity.isOverLimit ? RULE_WARNING : "",
    };
  });
  const average = stats.averagePulls;
  const slotTexts = dailySlotTexts(summary.log);
  const mainForces = summary.history.filter((row) => row.heroValueClass === "Chủ lực").length;
  const dailyFull = remainingToday < 1;
  return {
    accounts: summary.accounts.map((account) => {
      const pity = pityView(account.dailyPity);
      return { id: account.id, name: account.name, optionText: `${account.name} · ${pity.value}/${pity.limit}` };
    }),
    activeAccountId: summary.account?.id || "",
    accountName: summary.account?.name || "",
    heroOptions: uniqueSorted(heroes.map(heroName)),
    isEmpty: Boolean(summary.isEmpty),
    daily: {
      title: L(`${bannerDisplayName(daily.banner)} · Hôm nay`, `${bannerDisplayName(daily.banner)} · 今日`),
      name: bannerDisplayName(daily.banner),
      pity: dailyPity,
      pityText: pityText(dailyPity),
      remainingText: L(`Còn ${dailyPity.remaining} lượt`, `还差 ${dailyPity.remaining} 抽`),
      cheapText: dailyFull
        ? L(`hôm nay đã đủ ${DAILY_PULL_LIMIT} lượt`, `今日 ${DAILY_PULL_LIMIT} 次已记满`)
        : L(`hôm nay còn ${remainingToday} lượt rẻ`, `今日还剩 ${remainingToday} 次低价招募`),
      todayDone: daily.todayDone,
      remainingToday,
      todayText: L(`Hôm nay ${daily.todayDone}/${DAILY_PULL_LIMIT}`, `今日 ${daily.todayDone}/${DAILY_PULL_LIMIT}`),
      warning: dailyPity.isOverLimit ? RULE_WARNING : "",
      quick: [
        quickButton("free", L("2 miễn phí", "2 次免费"), 2, remainingToday),
        quickButton("fill", L(`Đủ ${DAILY_PULL_LIMIT}`, `补满 ${DAILY_PULL_LIMIT}`), DAILY_PULL_LIMIT, remainingToday),
      ],
      fiveStarDisabled: dailyFull,
      fiveStarSub: dailyFull
        ? L(`Hôm nay đã đủ ${DAILY_PULL_LIMIT} lượt`, `今日 ${DAILY_PULL_LIMIT} 次已记满`)
        : L("Ghi tướng vừa ra", "记录刚出的武将"),
      hint: dailyFull ? L(`Hôm nay đã ghi đủ ${DAILY_PULL_LIMIT} lượt.`, `今日 ${DAILY_PULL_LIMIT} 次已记满。`) : "",
    },
    limitedBanners,
    activeBanners: limitedBanners.filter((item) => !item.archived),
    archivedBanners: limitedBanners.filter((item) => item.archived),
    log: summary.log.map((row) => ({
      id: row.id,
      date: row.date,
      dateLabel: logDateLabel(row.date, today),
      result: row.result,
      bannerId: row.bannerId,
      bannerName: row.bannerName,
      pulls: row.pulls,
      pullCount: row.pullCount,
      heroName: row.heroName || "",
      heroValueClass: row.heroValueClass || "",
      note: row.note || "",
      text: logText(row),
      slotText: slotTexts.get(row.id) || "",
      valueLabel: row.result === "fiveStar" ? valueClassLabel(row.heroValueClass || DEFAULT_VALUE_CLASS) : "",
      valueBadgeClass: row.result === "fiveStar" ? VALUE_BADGE_CLASS[row.heroValueClass] || "" : "",
    })),
    stats: {
      fiveStars: stats.fiveStars,
      averagePulls: average,
      streakDays: stats.streakDays,
      averageText: average === null ? "—" : decimal(average),
      averageSub: averageSub(average, dailyPity.limit),
      fiveStarsSub: L(`${mainForces} Chủ lực`, `${mainForces} 个主力`),
      streakSub: L("ngày liên tiếp", "天连续记录"),
    },
  };
}

function readFlag(storage, key) {
  try {
    return storage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeFlag(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage bị chặn: lời mời chỉ hiện lại ở lần tải sau, không ảnh hưởng dữ liệu.
  }
}

/** Thanh tiến độ bảo hiểm: phần tô + 2 vạch mốc 1/3, 2/3 (vẽ bằng CSS). */
function meterNode(className, fill, label) {
  return el("span", {
    class: className,
    role: "meter",
    "aria-label": label,
    "aria-valuemin": "0",
  }, [
    fill,
    el("span", { class: "rt-pity-tick", "aria-hidden": "true" }),
    el("span", { class: "rt-pity-tick", "aria-hidden": "true" }),
  ]);
}

export function initRecruitTracker({ heroesDict = [], mount, storage = localStorage } = {}) {
  if (!mount) return null;
  let state = loadRecruitTrackerState(storage);
  const doc = mount.ownerDocument ?? globalThis.document;
  const currentDate = () => todayLocalDate();
  /** Ngày của thẻ Hôm nay đang vẽ: đổi ngày (qua nửa đêm) thì vẽ lại để "Hôm nay" về 0/4. */
  let renderedDate = "";
  /** View model của lần vẽ gần nhất: hộp thoại và nút đọc số đang hiện, không giữ bản chụp lúc tạo nút. */
  let view = null;
  let logLimit = LOG_PAGE;
  let syncStatus = "guest";
  /** Lời mời đăng nhập chỉ bật sau khi người dùng vừa ghi một lượt 5★ trong phiên này. */
  let inviteArmed = false;
  let sync = null;

  const persist = () => {
    saveRecruitTrackerState(storage, state);
    sync?.schedulePush();
  };
  const commit = (nextState) => {
    state = nextState;
    persist();
    render();
  };

  /* ---------- Toast "Hoàn tác" (vùng role=status luôn có trong DOM) ---------- */

  const toastText = el("span", { class: "rt-toast-text" });
  let toastUndo = null;
  let toastTimer = null;
  const toastUndoButton = el("button", {
    class: "rt-toast-undo",
    type: "button",
    onclick: () => {
      const undo = toastUndo;
      if (!undo) return;
      undo();
      hideToast();
      showToast(L("Đã hoàn tác.", "已撤销。"));
    },
  }, [undoIcon(), L("Hoàn tác", "撤销")]);
  const toastCard = el("div", { class: "rt-toast-card", hidden: "" }, [
    el("span", { class: "rt-toast-mark", "aria-hidden": "true" }, [checkIcon()]),
    toastText,
    toastUndoButton,
  ]);
  const toastRegion = el("div", { class: "rt-toast", role: "status", "aria-live": "polite" }, [toastCard]);

  function showToast(text, undo = null) {
    clearTimeout(toastTimer);
    toastText.textContent = text;
    toastUndo = undo;
    toastUndoButton.hidden = !undo;
    toastCard.hidden = false;
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toastTimer = null;
    toastUndo = null;
    const hadFocus = toastCard.contains(doc?.activeElement);
    toastCard.hidden = true;
    if (hadFocus) rescueFocus();
  }

  /**
   * Nút vừa bấm có thể bị khoá (hết lượt hôm nay) hoặc ẩn (toast): đưa focus về chỗ hợp lý trong thẻ Hôm nay
   * thay vì để rơi về `<body>`.
   */
  function rescueFocus({ force = false } = {}) {
    const active = doc?.activeElement;
    if (!force && active && active !== doc.body && !active.disabled && !active.closest("[hidden]")) return;
    const candidates = [toastUndoButton, ...[...quickButtons.values()].map((entry) => entry.button), dailyFiveStar, adjustDaily, logTitle];
    candidates.find((node) => node.isConnected && !node.disabled && !node.closest("[hidden]"))?.focus();
  }

  /**
   * Ghi lượt: so id lượt trước/sau để biết thao tác vừa tạo những dòng nào; "Hoàn tác" xóa đúng các dòng đó.
   * Store kẹp/không ghi (ví dụ hết lượt hôm nay) thì không có dòng mới và không có toast.
   */
  function record(nextState, message) {
    const before = new Set(state.pullEvents.map((event) => event.id));
    const created = nextState.pullEvents.filter((event) => !before.has(event.id));
    if (!created.length) return [];
    const ids = created.map((event) => event.id);
    if (created.some((event) => event.result === "fiveStar")) inviteArmed = true;
    commit(nextState);
    showToast(message(created), () => commit(deletePullEvents(state, ids)));
    rescueFocus();
    return ids;
  }

  const pulledText = (events) => {
    const pulls = events.filter((event) => event.result !== "set").reduce((sum, event) => sum + event.pulls, 0);
    const five = events.find((event) => event.result === "fiveStar");
    if (five) return L(`Đã ghi 5★ ${five.heroName} · +${pulls} lượt`, `已记录 5★ ${five.heroName} · +${pulls} 抽`);
    const set = events.find((event) => event.result === "set");
    if (set) return L(`Đã đồng bộ ${set.pulls} lượt`, `已同步为 ${set.pulls} 抽`);
    return L(`Đã ghi +${pulls} lượt`, `已记录 +${pulls} 抽`);
  };

  /* ---------- Hộp thoại (một `<dialog>` dùng lại) ---------- */

  const dialog = el("dialog", { class: "footer-dialog rt-dialog", "aria-labelledby": "rt-dialog-title" });
  let dialogOpener = null;
  const closeDialog = () => {
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      restoreDialogFocus();
    }
  };
  /** Trả focus về nút đã mở; nút đó bị vẽ lại, khoá hoặc ẩn (sửa dòng nhật ký, hết lượt, xóa gói) thì chọn chỗ hợp lý. */
  function restoreDialogFocus() {
    const opener = dialogOpener;
    dialogOpener = null;
    if (opener?.isConnected && !opener.disabled && !opener.closest("[hidden]")) opener.focus();
    // Lúc `close` bắn, focus vẫn nằm trên nút trong hộp thoại vừa đóng: bỏ qua kiểm tra "focus còn hợp lệ".
    else rescueFocus({ force: true });
  }
  // Thân form phủ kín `<dialog>` (padding 0): click trúng chính `<dialog>` là click vào nền.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest?.("[data-rt-dialog-close]")) closeDialog();
  });
  dialog.addEventListener("close", restoreDialogFocus);

  const numberValue = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.floor(number) : fallback;
  };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  /** Ô số có nút −/+ (vùng bấm 44px); đổi số bằng nút cũng bắn `input` để phần xem trước cập nhật. */
  function stepper(spec, id, describedBy) {
    const input = el("input", {
      id,
      name: spec.name,
      class: "cm-input rt-stepper-input",
      type: "number",
      value: spec.value ?? "",
      min: spec.min ?? null,
      max: spec.max ?? null,
      step: "1",
      inputmode: "numeric",
      required: spec.required ? "required" : null,
      autocomplete: "off",
      "aria-describedby": describedBy,
    });
    const nudge = (delta) => {
      const min = input.min === "" ? -Infinity : Number(input.min);
      const max = input.max === "" ? Infinity : Number(input.max);
      input.value = String(clamp(numberValue(input.value, 0) + delta, min, max));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    return el("div", { class: "rt-stepper" }, [
      el("button", { class: "rt-icon-btn rt-stepper-btn", type: "button", "aria-label": L("Bớt 1 lượt", "减 1 抽"), onclick: () => nudge(-1) }, [minusIcon()]),
      input,
      el("button", { class: "rt-icon-btn rt-stepper-btn", type: "button", "aria-label": L("Thêm 1 lượt", "加 1 抽"), onclick: () => nudge(1) }, [plusIcon()]),
    ]);
  }

  function field(spec) {
    if (spec.type === "row") return el("div", { class: "rt-field-row" }, spec.fields.map(field));
    const id = `rt-field-${spec.name || spec.key}`;
    const helpId = spec.help ? `${id}-help` : null;
    const help = spec.help ? el("p", { class: "rt-field-help", id: helpId }, spec.help) : null;
    if (spec.type === "segmented") {
      // Nhóm radio native dựng thành thanh chọn: phím mũi tên, FormData và nhãn đọc màn hình có sẵn.
      return el("fieldset", { class: "cm-field rt-seg", "aria-describedby": helpId }, [
        el("legend", { class: "cm-label" }, spec.label),
        el("div", { class: "rt-seg-track" }, spec.options.map((option) => el("label", { class: "rt-seg-option" }, [
          el("input", {
            class: "rt-seg-input",
            type: "radio",
            name: spec.name,
            value: String(option.value),
            checked: String(option.value) === String(spec.value) ? "checked" : null,
          }),
          el("span", { class: "rt-seg-text" }, option.label),
        ]))),
        help,
      ]);
    }
    let control;
    if (spec.type === "select") {
      control = el("select", { id, name: spec.name, class: "cm-select", "aria-describedby": helpId }, spec.options.map((option) => el("option", {
        value: String(option.value),
        selected: String(option.value) === String(spec.value ?? "") ? "selected" : null,
      }, option.label)));
    } else if (spec.type === "stepper") {
      control = stepper(spec, id, helpId);
    } else if (spec.type === "readonly") {
      control = el("input", { id, class: "cm-input rt-input-readonly", type: "text", value: spec.value, readonly: "readonly" });
    } else {
      control = el("input", {
        id,
        name: spec.name,
        class: "cm-input",
        type: spec.type || "text",
        value: spec.value ?? "",
        min: spec.min ?? null,
        max: spec.max ?? null,
        step: spec.type === "number" ? "1" : null,
        inputmode: spec.type === "number" ? "numeric" : null,
        list: spec.list ?? null,
        maxlength: spec.maxlength ?? (spec.type === "text" || !spec.type ? "80" : null),
        placeholder: spec.placeholder ?? null,
        required: spec.required ? "required" : null,
        autocomplete: "off",
        "aria-describedby": helpId,
      });
    }
    return el("div", { class: "cm-field" }, [el("label", { class: "cm-label", for: id }, spec.label), control, help]);
  }

  /**
   * Mở hộp thoại form: `onSubmit(values, form)` trả `false` để giữ hộp thoại mở. Enter gửi form,
   * Escape/✕/bấm nền đóng và trả focus về `opener` (mặc định: phần tử đang focus).
   * `preview(form)` (tuỳ chọn) trả nội dung khung "Sẽ ghi …", vẽ lại mỗi lần đổi ô.
   */
  function openDialog({ kicker = "", title, lead = "", fields = [], submitLabel, submitIcon = null, tone = "", wide = false, preview, onSubmit, onChange, opener }) {
    const previewBox = preview ? el("div", { class: "rt-dialog-preview", "aria-live": "polite" }) : null;
    const form = el("form", { class: "rt-dialog-form" }, [
      el("div", { class: "rt-dialog-head" }, [
        el("div", { class: "rt-dialog-heading" }, [
          kicker ? el("span", { class: "rt-dialog-kicker" }, kicker) : null,
          el("h2", { id: "rt-dialog-title", class: "rt-dialog-title" }, title),
        ]),
        el("button", {
          class: "rt-icon-btn rt-dialog-close",
          type: "button",
          "data-rt-dialog-close": "",
          "aria-label": L("Đóng", "关闭"),
        }, [closeIcon()]),
      ]),
      lead ? el("p", { class: "rt-dialog-lead" }, lead) : null,
      fields.length ? el("div", { class: "rt-dialog-fields" }, fields.map(field)) : null,
      previewBox,
      el("div", { class: "rt-dialog-actions" }, [
        el("button", { class: "ana-btn", type: "button", "data-rt-dialog-close": "" }, L("Hủy", "取消")),
        el("button", { class: `ana-btn primary${tone ? ` rt-${tone}` : ""}`, type: "submit" }, [submitIcon?.(), submitLabel]),
      ]),
    ]);
    const paintPreview = () => previewBox?.replaceChildren(...preview(form));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      if (onSubmit(values, form) !== false) closeDialog();
    });
    form.addEventListener("change", (event) => {
      onChange?.(event, form);
      paintPreview();
    });
    form.addEventListener("input", paintPreview);
    paintPreview();
    dialog.className = `footer-dialog rt-dialog${wide ? " rt-dialog-wide" : ""}`;
    dialog.replaceChildren(form);
    dialogOpener = opener || doc?.activeElement || null;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    const first = form.querySelector("input:checked, input:not([type=radio]):not([readonly]), select") || form.querySelector("[type=submit]");
    first?.focus();
    if (first?.type === "number") first.select();
    return form;
  }

  const valueClassOptions = VALUE_CLASSES.map((value) => ({ value, label: valueClassLabel(value) }));
  const heroField = (value = "") => ({
    name: "heroName",
    label: L("Tướng", "武将"),
    value,
    list: "rt-hero-options",
    required: true,
    help: L("Gõ để chọn từ danh sách tướng 5★.", "输入以从 5★ 武将列表中选择。"),
  });
  const classField = (value = DEFAULT_VALUE_CLASS) => ({ name: "heroValueClass", label: L("Phân loại", "分类"), type: "select", value, options: valueClassOptions });
  const noteField = (value = "") => ({ name: "note", label: L("Ghi chú", "备注"), value, maxlength: "200", placeholder: L("Không bắt buộc", "选填") });
  const dateField = (value = currentDate()) => ({ name: "date", label: L("Ngày", "日期"), type: "date", value, required: true });
  const dialogKicker = (bannerName) => `${bannerName} · ${view.accountName}`;

  /** Khung xem trước của hộp thoại 5★: lượt ra 5★ tính trên mốc bảo hiểm và tiến độ sau khi lưu. */
  const fiveStarPreview = (count, after, limit) => [
    el("span", { class: "rt-dialog-preview-icon", "aria-hidden": "true" }, [starIcon()]),
    el("span", {}, L(
      ["Sẽ ghi 5★ ở ", el("strong", {}, `lượt ${count}`), " của mốc bảo hiểm", after ? `, rồi +${after} lượt không ra` : "", " · tiến độ về ", el("strong", {}, `${after} / ${limit}`), "."],
      ["将在保底第 ", el("strong", {}, String(count)), " 抽记录 5★", after ? `，之后 +${after} 次未出` : "", " · 进度回到 ", el("strong", {}, `${after} / ${limit}`), "。"],
    )),
  ];

  /* ---------- Menu ⋯ (tài khoản, từng gói) ---------- */

  const menus = [];
  function createMenu({ label, panelClass = "" }) {
    const button = el("button", {
      class: "rt-icon-btn rt-menu-toggle",
      type: "button",
      "aria-label": label,
      "data-dropdown-button": "",
    }, [moreIcon()]);
    const panel = el("div", { class: `rt-menu-panel ${panelClass}`.trim(), "data-dropdown-panel": "" });
    const root = el("div", { class: "rt-menu", "data-dropdown": "" }, [button, panel]);
    const menu = createDropdownMenu({
      root,
      button,
      panel,
      closeSelector: "button",
      onChange: (open) => {
        if (open) for (const other of menus) if (other !== menu) other.close();
      },
    });
    menu.sync();
    menus.push(menu);
    return menu;
  }
  const menuItem = (text, onclick, className = "") => el("button", {
    class: `rt-menu-item ${className}`.trim(),
    type: "button",
    onclick,
  }, text);

  doc?.addEventListener("click", (event) => {
    for (const menu of menus) menu.handleDocumentClick(event);
  });
  doc?.addEventListener("focusout", (event) => {
    for (const menu of menus) menu.handleDocumentFocusOut(event);
  });
  doc?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const menu of menus) menu.handleEscape();
  });

  /* ---------- Hàng tài khoản: chọn tài khoản | chip ☁, + Tài khoản, Xuất/Nhập JSON, ⋯ ---------- */

  const accountSelect = el("select", {
    class: "rt-select",
    id: "rt-account-select",
    "aria-label": L("Chọn tài khoản", "选择账号"),
    onchange: (event) => commit(setActiveAccount(state, event.target.value)),
  });
  const accountMenu = createMenu({ label: L("Tùy chọn tài khoản", "账号选项"), panelClass: "rt-account-actions" });
  accountMenu.root.classList.add("rt-account-menu");
  accountMenu.button.classList.add("rt-account-toggle");
  accountMenu.panel.id = "rt-account-actions";
  accountMenu.button.setAttribute("aria-controls", "rt-account-actions");
  accountMenu.panel.append(
    menuItem(L("Đổi tên", "重命名"), () => renameActiveAccount()),
    menuItem(L("Xóa tài khoản", "删除账号"), () => deleteActiveAccount(), "rt-menu-danger"),
  );
  const addAccountButton = el("button", {
    class: "rt-btn rt-add-account",
    type: "button",
    "aria-label": L("Thêm tài khoản", "添加账号"),
    onclick: (event) => addAccount(event.currentTarget),
  }, [plusIcon(), L("Tài khoản", "账号")]);
  const exportButton = el("button", {
    class: "rt-btn rt-ghost",
    type: "button",
    onclick: () => exportJson(),
  }, [downloadIcon(), L("Xuất JSON", "导出 JSON")]);
  const importInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    class: "rt-file",
    onchange: importJson,
  });
  const importLabel = el("label", { class: "rt-btn rt-ghost rt-import" }, [uploadIcon(), L("Nhập JSON", "导入 JSON"), importInput]);

  const syncText = el("span", { class: "rt-sync-text" });
  const syncSignIn = el("button", {
    class: "tool-text-action rt-sync-signin",
    type: "button",
    onclick: () => startSignIn(syncSignIn),
  }, L("Đăng nhập", "登录"));
  const syncChip = el("div", { class: "rt-sync", "data-status": "guest" }, [
    el("span", { class: "rt-sync-pill" }, [
      el("span", { class: "rt-sync-icon", "aria-hidden": "true" }, [cloudIcon()]),
      syncText,
    ]),
    syncSignIn,
  ]);

  const accountBar = el("div", { class: "rt-account-bar" }, [
    el("div", { class: "rt-account-field" }, [
      el("label", { class: "rt-field-label", for: "rt-account-select" }, L("Tài khoản", "账号")),
      accountSelect,
    ]),
    el("div", { class: "rt-account-tools" }, [
      syncChip,
      el("div", { class: "rt-account-buttons" }, [addAccountButton, exportButton, importLabel, accountMenu.root]),
    ]),
  ]);

  const notice = el("p", { class: "tool-notice rt-notice" }, [
    el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
    el("span", {}, L(
      "Dữ liệu chỉ lưu trong trình duyệt này và có thể mất khi xóa dữ liệu trang. Dùng Xuất JSON để sao lưu, Nhập JSON để gộp lại, hoặc đăng nhập để đồng bộ giữa các máy.",
      "数据仅保存在本浏览器中，清除网站数据后可能丢失。请用“导出 JSON”备份，用“导入 JSON”合并恢复，或登录以在多台设备间同步。",
    )),
  ]);

  /* ---------- Thẻ Hôm nay (gói ngày) ---------- */

  const todayTitle = el("h2", { class: "rt-card-title", id: "rt-today-title" });
  const adjustDaily = el("button", {
    class: "rt-btn rt-ghost rt-adjust",
    type: "button",
    onclick: (event) => openAdjust({ bannerId: DAILY_BANNER_ID, name: view.daily.name, pity: view.daily.pity, opener: event.currentTarget }),
  }, [editIcon(), L("Chỉnh số", "调整")]);
  const pityValue = el("strong", { class: "rt-pity-value" });
  const pityUnit = el("span", { class: "rt-pity-unit" });
  const pityFill = el("span", { class: "rt-pity-fill" });
  const pityMeter = meterNode("rt-pity-meter", pityFill, L("Tiến độ bảo hiểm 5★", "5★ 保底进度"));
  const todayCount = el("span", { class: "rt-today-count" });
  const pips = Array.from({ length: DAILY_PULL_LIMIT }, () => el("span", { class: "rt-pip" }));
  const remainingLine = el("span", { class: "rt-pity-remaining" });
  const pityMeta = el("div", { class: "rt-pity-meta" }, [
    el("span", { class: "rt-today-progress" }, [todayCount, el("span", { class: "rt-pips", "aria-hidden": "true" }, pips)]),
    remainingLine,
  ]);
  const pityWarning = el("p", { class: "rt-warning", hidden: "" });

  const quickButtons = new Map();
  const quickRow = el("div", { class: "rt-quick" });
  for (const key of ["free", "fill"]) {
    const label = el("span", { class: "rt-quick-label" });
    const sub = el("span", { class: "rt-quick-sub" });
    const button = el("button", {
      class: `rt-quick-btn rt-quick-${key}`,
      type: "button",
      onclick: () => {
        const quick = view.daily.quick.find((item) => item.key === key);
        if (!quick?.pulls) return;
        record(recordDailyMisses(state, { accountId: state.activeAccountId, date: currentDate(), pulls: quick.pulls }), pulledText);
      },
    }, [label, sub]);
    quickButtons.set(key, { button, label, sub });
    quickRow.append(button);
  }
  const dailyFiveSub = el("span", { class: "rt-quick-sub" });
  const dailyFiveStar = el("button", {
    class: "rt-quick-btn rt-five-btn",
    type: "button",
    onclick: (event) => openDailyFiveStar(event.currentTarget),
  }, [el("span", { class: "rt-quick-label" }, [starIcon(), FIVE_STAR_LABEL]), dailyFiveSub]);
  quickRow.append(dailyFiveStar);
  const todayHint = el("p", { class: "rt-today-hint", hidden: "" });

  const todayBody = el("div", { class: "rt-today-body" }, [
    el("div", { class: "rt-pity-block" }, [
      el("div", { class: "rt-pity-figures" }, [
        pityValue,
        pityUnit,
        el("span", { class: "rt-pity-caption" }, L("tới mốc bảo hiểm", "距保底")),
      ]),
      pityMeter,
      pityMeta,
      pityWarning,
    ]),
    quickRow,
    todayHint,
  ]);

  const onboardInput = el("input", {
    id: "rt-onboard-value",
    class: "cm-input rt-onboard-input",
    type: "number",
    name: "value",
    min: "0",
    max: String(SET_PITY_MAX),
    step: "1",
    inputmode: "numeric",
    required: "required",
    placeholder: "0–29",
  });
  const onboard = el("form", {
    class: "rt-onboard",
    hidden: "",
    onsubmit: (event) => {
      event.preventDefault();
      startFrom(numberValue(onboardInput.value, 0));
    },
  }, [
    el("h3", { class: "rt-onboard-title" }, L("Bắt đầu theo dõi", "开始记录")),
    el("label", { class: "rt-onboard-label", for: "rt-onboard-value" }, L("Trong game bạn đang ở lượt mấy?", "游戏里你现在是第几抽？")),
    el("p", { class: "rt-sub" }, L(
      "Xem số lượt đã quay từ lần ra 5★ gần nhất trong màn chiêu mộ Danh tướng PK (0–29).",
      "在 PK 名将招募界面查看距上次 5★ 已抽的次数（0–29）。",
    )),
    onboardInput,
    el("div", { class: "rt-onboard-actions" }, [
      el("button", { class: "rt-btn rt-primary", type: "submit" }, L("Bắt đầu", "开始")),
      el("button", { class: "rt-btn", type: "button", onclick: () => startFrom(0) }, L("Bắt đầu từ 0", "从 0 开始")),
    ]),
  ]);

  const todaySection = el("section", { class: "rt-section rt-today", "aria-labelledby": "rt-today-title" }, [
    el("header", { class: "rt-section-head" }, [
      el("div", { class: "rt-section-heading" }, [
        todayTitle,
        el("p", { class: "rt-sub" }, L("4 lượt miễn phí / nửa giá mỗi ngày", "每日 4 次免费 / 半价招募")),
      ]),
      adjustDaily,
    ]),
    todayBody,
    onboard,
  ]);

  /* ---------- Lời mời đăng nhập sau 5★ đầu tiên ---------- */

  const inviteButton = el("button", {
    class: "ana-btn primary cm-signin-btn",
    type: "button",
    onclick: () => startSignIn(inviteButton),
  }, [googleIcon(), L("Đăng nhập bằng Google", "使用 Google 登录")]);
  const invite = el("div", { class: "rt-invite", hidden: "" }, [
    el("p", { class: "rt-invite-text" }, [
      el("strong", {}, L("Đã ghi tướng 5★!", "已记录 5★ 武将！")),
      " ",
      L("Đăng nhập để lưu nhật ký lên cloud và xem trên mọi máy.", "登录后可把记录保存到云端，在任何设备查看。"),
    ]),
    el("div", { class: "rt-invite-actions" }, [
      inviteButton,
      el("button", {
        class: "tool-text-action",
        type: "button",
        onclick: () => {
          writeFlag(storage, INVITE_KEY, "dismissed");
          render();
        },
      }, L("Để sau", "以后再说")),
    ]),
  ]);

  /* ---------- Gói hạn giờ ---------- */

  const bannerList = el("div", { class: "rt-limited-list" });
  const bannerEmpty = el("p", { class: "rt-empty" }, L("Chưa có gói hạn giờ.", "暂无限时卡包。"));
  const archivedList = el("div", { class: "rt-limited-list" });
  const archivedCount = el("span", {});
  const archived = el("details", { class: "rt-archived", hidden: "" }, [
    el("summary", { class: "rt-archived-summary" }, archivedCount),
    archivedList,
  ]);
  const bannerNodes = new Map();
  const limitedSection = el("section", { class: "rt-section rt-limited", "aria-labelledby": "rt-limited-title" }, [
    el("header", { class: "rt-section-head" }, [
      el("h2", { class: "rt-section-title", id: "rt-limited-title" }, L("Gói hạn giờ / Đột xuất", "限时 / 临时卡包")),
      el("button", { class: "rt-btn", type: "button", onclick: (event) => addLimitedBanner(event.currentTarget) }, [plusIcon(), L("Thêm gói", "添加卡包")]),
    ]),
    el("p", { class: "rt-sub rt-limited-lead" }, L(
      "Tạo riêng cho banner có thời hạn hoặc gói theo giai đoạn. Bảo hiểm riêng của gói: 30 lượt.",
      "为限时卡池或阶段性卡包单独创建。每个卡包独立保底：30 抽。",
    )),
    bannerList,
    bannerEmpty,
    archived,
  ]);

  /* ---------- Thống kê + nhật ký ---------- */

  const statNodes = {};
  const statCard = (key, label) => {
    statNodes[key] = { value: el("dd", { class: "rt-stat-value" }), sub: el("dd", { class: "rt-stat-sub" }) };
    return el("div", { class: "rt-stat" }, [el("dt", { class: "rt-kicker" }, label), statNodes[key].value, statNodes[key].sub]);
  };
  const statsSection = el("section", { class: "rt-section rt-stats", "aria-labelledby": "rt-stats-title" }, [
    el("h2", { class: "rt-section-title", id: "rt-stats-title" }, L("Thống kê", "统计")),
    el("dl", { class: "rt-stats-list" }, [
      statCard("average", L("TB lượt / 5★", "平均抽数 / 5★")),
      statCard("fiveStars", L("Tổng 5★", "5★ 总数")),
      statCard("streak", L("Chuỗi ngày", "连续天数")),
    ]),
  ]);

  const logTitle = el("h2", { class: "rt-section-title", id: "rt-log-title", tabindex: "-1" }, L("Nhật ký", "记录"));
  const logList = el("ol", { class: "rt-log-list" });
  const logEmpty = el("p", { class: "rt-empty" }, L("Chưa có lượt nào.", "暂无记录。"));
  const logMore = el("button", {
    class: "rt-btn rt-log-more",
    type: "button",
    hidden: "",
    onclick: () => {
      logLimit += LOG_PAGE;
      render();
    },
  }, L("Xem thêm", "查看更多"));
  const logSection = el("section", { class: "rt-section rt-log", "aria-labelledby": "rt-log-title" }, [
    el("header", { class: "rt-section-heading" }, [
      logTitle,
      el("p", { class: "rt-sub" }, L("Mới nhất trước, lọc theo tài khoản đang chọn.", "最新在前，仅显示当前账号。")),
    ]),
    logList,
    logEmpty,
    logMore,
  ]);

  const head = el("header", { class: "tool-head" }, [
    el("div", { class: "reference-head-text" }, [
      el("span", { class: "reference-kicker" }, L("Công cụ · Beta", "工具 · Beta")),
      el("h1", { class: "reference-title", tabindex: "-1" }, L("Theo dõi chiêu mộ", "招募记录")),
      el("p", { class: "reference-lead" }, L("Đếm lượt tới mốc bảo hiểm 5★ cho từng tài khoản và ghi lại tướng 5★ đã ra.", "按账号统计距离 5★ 保底的抽数，并记录已抽到的 5★ 武将。")),
    ]),
  ]);

  const heroOptions = el("datalist", { id: "rt-hero-options" });

  mount.replaceChildren(el("div", { class: "rt-shell" }, [
    head,
    accountBar,
    el("div", { class: "rt-grid" }, [
      el("div", { class: "rt-col rt-col-main" }, [todaySection, invite, logSection]),
      el("div", { class: "rt-col rt-col-side" }, [statsSection, limitedSection, notice]),
    ]),
    heroOptions,
    toastRegion,
    dialog,
  ]));

  /* ---------- Vẽ tại chỗ ---------- */

  function render() {
    renderedDate = currentDate();
    const summary = getRecruitTrackerSummary(state, { date: renderedDate });
    view = buildRecruitTrackerViewModel(summary, heroesDict, { today: renderedDate });
    paintAccounts();
    paintSync();
    paintToday();
    paintInvite();
    paintBanners();
    paintStats();
    paintLog();
  }

  function paintAccounts() {
    const signature = `${state.activeAccountId}|${view.accounts.map((account) => `${account.id}:${account.optionText}`).join("|")}`;
    if (accountSelect.dataset.signature !== signature) {
      accountSelect.dataset.signature = signature;
      accountSelect.replaceChildren(...view.accounts.map((account) => el("option", {
        value: account.id,
        selected: account.id === state.activeAccountId ? "selected" : null,
      }, account.optionText)));
      accountSelect.value = state.activeAccountId;
    }
    if (heroOptions.dataset.count !== String(view.heroOptions.length)) {
      heroOptions.dataset.count = String(view.heroOptions.length);
      heroOptions.replaceChildren(...view.heroOptions.map((name) => el("option", { value: name })));
    }
  }

  function paintSync() {
    syncChip.dataset.status = syncStatus;
    syncText.textContent = SYNC_TEXT[syncStatus] || SYNC_TEXT.guest;
    syncSignIn.hidden = syncStatus !== "guest";
    // Đã đăng nhập và đồng bộ: dữ liệu không còn chỉ nằm trong trình duyệt này.
    notice.hidden = syncStatus === "synced" || syncStatus === "syncing";
  }

  /** Đồng hồ pity: thanh `role="meter"` (giá trị kẹp trong [0, mốc]) + chữ số thật lấy từ store. */
  function paintMeter(meter, fill, pity) {
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", String(pity.limit));
    meter.setAttribute("aria-valuenow", String(Math.min(pity.value, pity.limit)));
    meter.setAttribute("aria-valuetext", L(`${pity.value} / ${pity.limit} lượt`, `${pity.value} / ${pity.limit} 抽`));
    fill.style.width = `${pity.percent}%`;
  }

  function paintToday() {
    const { daily } = view;
    todayTitle.textContent = daily.title;
    todayBody.hidden = view.isEmpty;
    onboard.hidden = !view.isEmpty;
    adjustDaily.hidden = view.isEmpty;
    if (view.isEmpty) return;
    pityValue.textContent = String(daily.pity.value);
    pityUnit.textContent = L(`/ ${daily.pity.limit} lượt`, `/ ${daily.pity.limit} 抽`);
    paintMeter(pityMeter, pityFill, daily.pity);
    todayCount.textContent = daily.todayText;
    pips.forEach((pip, index) => pip.classList.toggle("is-on", index < daily.todayDone));
    remainingLine.textContent = `${daily.remainingText} · ${daily.cheapText}`;
    pityWarning.textContent = daily.warning;
    pityWarning.hidden = !daily.warning;
    for (const quick of daily.quick) {
      const entry = quickButtons.get(quick.key);
      entry.label.textContent = quick.label;
      entry.sub.textContent = quick.sub;
      entry.button.disabled = quick.disabled;
      entry.button.setAttribute("aria-label", quick.ariaLabel);
    }
    dailyFiveStar.disabled = daily.fiveStarDisabled;
    dailyFiveSub.textContent = daily.fiveStarSub;
    todayHint.textContent = daily.hint;
    todayHint.hidden = !daily.hint;
  }

  function paintInvite() {
    invite.hidden = !(inviteArmed && syncStatus === "guest" && !readFlag(storage, INVITE_KEY));
  }

  function createBannerNode(id) {
    const name = el("strong", { class: "rt-banner-name" });
    const expiry = el("span", { class: "rt-banner-expiry" });
    const expiryRow = el("span", { class: "rt-banner-expiry-row" }, [
      el("span", { class: "rt-banner-clock", "aria-hidden": "true" }, [clockIcon()]),
      expiry,
    ]);
    const count = el("strong", { class: "rt-banner-count" });
    const fill = el("span", { class: "rt-pity-fill" });
    const meter = meterNode("rt-pity-meter rt-banner-meter", fill, "");
    const warning = el("p", { class: "rt-warning", hidden: "" });
    const menu = createMenu({ label: "" });
    const archiveItem = menuItem("", () => {
      const item = bannerView(id);
      if (!item) return;
      const next = !item.archived;
      commit(setBannerArchived(state, id, next));
      showToast(
        next ? L(`Đã lưu trữ ${item.name}.`, `已归档 ${item.name}。`) : L(`Đã bỏ lưu trữ ${item.name}.`, `已取消归档 ${item.name}。`),
        () => commit(setBannerArchived(state, id, !next)),
      );
    });
    menu.panel.append(
      menuItem(L("Đổi tên / ngày hết hạn", "重命名 / 截止日期"), () => editBanner(id, menu.button)),
      menuItem(L("Chỉnh số", "调整"), () => {
        const item = bannerView(id);
        if (item) openAdjust({ bannerId: id, name: item.name, pity: item.pity, opener: menu.button });
      }),
      archiveItem,
      menuItem(L("Xóa gói", "删除卡包"), () => removeBanner(id, menu.button), "rt-menu-danger"),
    );
    const actions = el("div", { class: "rt-banner-actions" }, [
      el("button", { class: "rt-btn rt-banner-add", type: "button", onclick: (event) => openBannerMiss(id, event.currentTarget) }, L("+ Lượt", "+ 抽数")),
      el("button", {
        class: "rt-btn rt-accent rt-five-btn",
        type: "button",
        onclick: (event) => openBannerFiveStar(id, event.currentTarget),
      }, [starIcon(), FIVE_STAR_LABEL]),
    ]);
    const node = el("article", { class: "rt-banner" }, [
      el("div", { class: "rt-banner-head" }, [
        el("div", { class: "rt-banner-main" }, [name, expiryRow]),
        menu.root,
      ]),
      el("div", { class: "rt-banner-progress" }, [meter, count]),
      actions,
      warning,
    ]);
    return { node, name, expiry, expiryRow, count, meter, fill, warning, menu, archiveItem };
  }

  const bannerView = (id) => view.limitedBanners.find((item) => item.id === id);

  function paintBanners() {
    const seen = new Set();
    for (const item of view.limitedBanners) {
      seen.add(item.id);
      let entry = bannerNodes.get(item.id);
      if (!entry) {
        entry = createBannerNode(item.id);
        bannerNodes.set(item.id, entry);
      }
      entry.node.classList.toggle("rt-banner-archived", item.archived);
      entry.name.textContent = item.name;
      entry.expiry.textContent = item.expiry.text;
      entry.expiry.dataset.tone = item.expiry.tone;
      entry.expiryRow.hidden = !item.expiry.text;
      entry.count.textContent = item.pityText;
      entry.meter.setAttribute("aria-label", L("Tiến độ bảo hiểm 5★ · ", "5★ 保底进度 · ") + item.name);
      paintMeter(entry.meter, entry.fill, item.pity);
      entry.warning.textContent = item.warning;
      entry.warning.hidden = !item.warning;
      entry.menu.button.setAttribute("aria-label", L(`Tùy chọn gói ${item.name}`, `卡包选项 ${item.name}`));
      entry.archiveItem.textContent = item.archived ? L("Bỏ lưu trữ", "取消归档") : L("Lưu trữ", "归档");
      // Nối theo đúng thứ tự của store: `append` chỉ di chuyển, nút đang focus vẫn giữ focus.
      (item.archived ? archivedList : bannerList).append(entry.node);
    }
    for (const [id, entry] of bannerNodes) {
      if (seen.has(id)) continue;
      entry.node.remove();
      menus.splice(menus.indexOf(entry.menu), 1);
      bannerNodes.delete(id);
    }
    bannerEmpty.hidden = view.activeBanners.length > 0;
    archived.hidden = view.archivedBanners.length === 0;
    archivedCount.textContent = L(`Đã lưu trữ (${view.archivedBanners.length})`, `已归档（${view.archivedBanners.length}）`);
  }

  function paintStats() {
    const { stats } = view;
    statNodes.average.value.textContent = stats.averageText;
    statNodes.average.sub.textContent = stats.averageSub;
    statNodes.fiveStars.value.textContent = String(stats.fiveStars);
    statNodes.fiveStars.sub.textContent = stats.fiveStarsSub;
    statNodes.streak.value.textContent = String(stats.streakDays);
    statNodes.streak.sub.textContent = stats.streakSub;
  }

  function paintLog() {
    const rows = view.log.slice(0, logLimit);
    logList.replaceChildren(...rows.map(renderLogRow));
    logList.hidden = rows.length === 0;
    logEmpty.hidden = rows.length > 0;
    logMore.hidden = view.log.length <= logLimit;
  }

  const logSeparator = () => el("span", { class: "rt-log-sep", "aria-hidden": "true" }, "·");

  /** Dòng phụ của nhật ký: tên gói · vị trí lượt trong ngày, badge phân loại 5★ hoặc badge "Chỉnh số". */
  function logMeta(row) {
    const parts = [el("span", {}, row.bannerName)];
    if (row.slotText) parts.push(logSeparator(), el("span", {}, row.slotText));
    if (row.valueLabel) parts.push(logSeparator(), el("span", { class: `badge rt-value ${row.valueBadgeClass}`.trim() }, row.valueLabel));
    if (row.result === "set") parts.push(logSeparator(), el("span", { class: "badge rt-value" }, L("Chỉnh số", "调整")));
    return parts;
  }

  function renderLogRow(row) {
    return el("li", { class: "rt-log-item", "data-result": row.result }, [
      el("time", { class: "rt-log-date", datetime: row.date, title: fullDate(row.date) }, row.dateLabel),
      el("div", { class: "rt-log-body" }, [
        el("span", { class: "rt-log-text" }, row.text),
        el("span", { class: "rt-log-banner" }, logMeta(row)),
        row.note ? el("p", { class: "rt-note" }, row.note) : null,
      ]),
      el("span", { class: "rt-log-actions" }, [
        el("button", {
          class: "rt-icon-btn rt-log-edit",
          type: "button",
          "aria-label": L(`Sửa dòng ${row.dateLabel} ${row.text}`, `编辑 ${row.dateLabel} ${row.text}`),
          onclick: (event) => editLogRow(row.id, event.currentTarget),
        }, [editIcon()]),
        el("button", {
          class: "rt-icon-btn rt-log-delete",
          type: "button",
          "aria-label": L(`Xóa dòng ${row.dateLabel} ${row.text}`, `删除 ${row.dateLabel} ${row.text}`),
          onclick: () => deleteLogRow(row),
        }, [trashIcon()]),
      ]),
    ]);
  }

  /* ---------- Thao tác ---------- */

  function startFrom(value) {
    const pulls = Math.min(Math.max(value, 0), SET_PITY_MAX);
    record(setPity(state, { accountId: state.activeAccountId, bannerId: DAILY_BANNER_ID, value: pulls, date: currentDate() }), pulledText);
    adjustDaily.focus();
  }

  function openAdjust({ bannerId, name, pity, opener }) {
    openDialog({
      title: L(`Chỉnh số · ${name}`, `调整 · ${name}`),
      lead: L(
        `Mốc bảo hiểm 5★ là ${pity.limit} lượt. Nhập số lượt đã quay từ lần ra 5★ gần nhất đúng như trong game; nhật ký ghi một dòng "Đồng bộ".`,
        `5★ 保底为 ${pity.limit} 抽。按游戏内显示填写距上次 5★ 已抽的次数，记录中会新增一行“同步”。`,
      ),
      fields: [{ name: "value", label: L("Trong game bạn đang ở lượt mấy?", "游戏里你现在是第几抽？"), type: "number", value: pity.value, min: "0", max: String(SET_PITY_MAX), required: true }],
      submitLabel: L("Lưu", "保存"),
      opener,
      onSubmit: ({ value: next }) => {
        record(setPity(state, { accountId: state.activeAccountId, bannerId, value: numberValue(next, 0), date: currentDate() }), pulledText);
      },
    });
  }

  function openDailyFiveStar(opener) {
    const { remainingToday, todayDone, name, pity } = view.daily;
    if (remainingToday < 1) return;
    const hitAtOf = (form) => clamp(numberValue(form.elements.namedItem("hitAt")?.value, 1), 1, remainingToday);
    openDialog({
      kicker: dialogKicker(name),
      title: FIVE_STAR_LABEL,
      wide: true,
      fields: [
        {
          name: "hitAt",
          label: L("Ra 5★ ở lượt", "出 5★ 的是"),
          type: "segmented",
          value: 1,
          options: Array.from({ length: remainingToday }, (_, index) => ({
            value: index + 1,
            label: L(`Lượt ${todayDone + index + 1}/${DAILY_PULL_LIMIT}`, `第 ${todayDone + index + 1}/${DAILY_PULL_LIMIT} 抽`),
          })),
          help: L(`Hôm nay còn ${remainingToday} lượt rẻ.`, `今日还剩 ${remainingToday} 次低价招募。`),
        },
        { name: "pullsAfter", label: L("Quay tiếp sau đó (không ra)", "之后继续抽（未出）"), type: "stepper", value: remainingToday - 1, min: "0", max: String(remainingToday - 1) },
        heroField(),
        { type: "row", fields: [classField(), { key: "date-shown", label: L("Ngày", "日期"), type: "readonly", value: fullDate(currentDate()) }] },
        noteField(),
      ],
      submitLabel: L("Lưu 5★", "保存 5★"),
      submitIcon: starIcon,
      tone: "accent",
      opener,
      onChange: (event, form) => {
        if (event.target.name !== "hitAt") return;
        // Mặc định coi như quay hết số lượt rẻ còn lại sau lượt ra 5★.
        const max = remainingToday - hitAtOf(form);
        const after = form.elements.namedItem("pullsAfter");
        after.max = String(max);
        after.value = String(max);
      },
      preview: (form) => {
        const hitAt = hitAtOf(form);
        const after = clamp(numberValue(form.elements.namedItem("pullsAfter").value, 0), 0, remainingToday - hitAt);
        return fiveStarPreview(pity.value + hitAt, after, pity.limit);
      },
      onSubmit: (values) => {
        record(recordDailyFiveStar(state, {
          accountId: state.activeAccountId,
          date: currentDate(),
          hitAt: numberValue(values.hitAt, 1),
          pullsAfter: numberValue(values.pullsAfter, 0),
          heroName: values.heroName,
          heroValueClass: values.heroValueClass,
          note: values.note,
        }), pulledText);
      },
    });
  }

  function openBannerFiveStar(id, opener) {
    const item = bannerView(id);
    if (!item) return;
    openDialog({
      kicker: dialogKicker(item.name),
      title: FIVE_STAR_LABEL,
      wide: true,
      fields: [
        {
          name: "pulls",
          label: L("Số lượt quay lần này", "本次抽数"),
          type: "stepper",
          value: 1,
          min: "1",
          max: String(SET_PITY_MAX),
          required: true,
          help: L("Gồm cả lượt ra 5★.", "包含出 5★ 的那一抽。"),
        },
        heroField(),
        { type: "row", fields: [classField(), dateField()] },
        noteField(),
      ],
      submitLabel: L("Lưu 5★", "保存 5★"),
      submitIcon: starIcon,
      tone: "accent",
      opener,
      preview: (form) => fiveStarPreview(item.pity.value + Math.max(numberValue(form.elements.namedItem("pulls").value, 1), 1), 0, item.pity.limit),
      onSubmit: (values) => {
        record(recordBannerFiveStar(state, {
          accountId: state.activeAccountId,
          bannerId: id,
          pulls: numberValue(values.pulls, 1),
          heroName: values.heroName,
          heroValueClass: values.heroValueClass,
          note: values.note,
          date: values.date || currentDate(),
        }), pulledText);
      },
    });
  }

  /** "+ Lượt" của gói hạn giờ: ghi N lượt không ra (mặc định 1, Enter là lưu). */
  function openBannerMiss(id, opener) {
    const item = bannerView(id);
    if (!item) return;
    openDialog({
      kicker: dialogKicker(item.name),
      title: L("Ghi lượt không ra", "记录未出"),
      fields: [{ name: "pulls", label: L("Số lượt", "抽数"), type: "stepper", value: 1, min: "1", max: String(SET_PITY_MAX), required: true }],
      submitLabel: L("Ghi lượt", "记录"),
      opener,
      preview: (form) => {
        const pulls = Math.max(numberValue(form.elements.namedItem("pulls").value, 1), 1);
        return [el("span", {}, L(
          ["Tiến độ về ", el("strong", {}, `${item.pity.value + pulls} / ${item.pity.limit}`), "."],
          ["进度变为 ", el("strong", {}, `${item.pity.value + pulls} / ${item.pity.limit}`), "。"],
        ))];
      },
      onSubmit: (values) => {
        record(recordBannerMiss(state, {
          accountId: state.activeAccountId,
          bannerId: id,
          pulls: numberValue(values.pulls, 1),
          date: currentDate(),
        }), pulledText);
      },
    });
  }

  function editLogRow(id, opener) {
    const row = view.log.find((item) => item.id === id);
    if (!row) return;
    const pullsField = row.result === "set"
      ? { name: "pulls", label: L("Số lượt tích lũy", "累计抽数"), type: "number", value: row.pulls, min: "0", max: String(SET_PITY_MAX), required: true }
      : { name: "pulls", label: L("Số lượt", "抽数"), type: "number", value: row.pulls, min: "1", required: true };
    const fields = row.result === "fiveStar"
      ? [pullsField, heroField(row.heroName), { type: "row", fields: [classField(row.heroValueClass || DEFAULT_VALUE_CLASS), dateField(row.date)] }, noteField(row.note)]
      : [pullsField, dateField(row.date), noteField(row.note)];
    openDialog({
      title: L(`Sửa dòng · ${row.bannerName}`, `编辑记录 · ${row.bannerName}`),
      lead: row.result === "fiveStar"
        ? L("Số lượt của dòng 5★ gồm cả lượt ra 5★.", "5★ 这一行的抽数包含出 5★ 的那一抽。")
        : "",
      fields,
      submitLabel: L("Lưu", "保存"),
      opener,
      onSubmit: (values) => {
        const patch = { pulls: numberValue(values.pulls, row.pulls), note: values.note, date: values.date };
        if (row.result === "fiveStar") Object.assign(patch, { heroName: values.heroName, heroValueClass: values.heroValueClass });
        const before = state;
        commit(updatePullEvent(state, id, patch));
        showToast(L("Đã sửa dòng nhật ký.", "已修改记录。"), () => commit(mergeBack(before, id)));
      },
    });
  }

  /** Hoàn tác một lần sửa: đưa nội dung cũ của dòng trở lại như một lần sửa mới (dấu thời gian mới hơn). */
  function mergeBack(before, id) {
    const old = before.pullEvents.find((event) => event.id === id);
    if (!old) return state;
    return updatePullEvent(state, id, {
      pulls: old.pulls,
      heroName: old.heroName,
      heroValueClass: old.heroValueClass,
      note: old.note,
      date: old.date,
    });
  }

  function deleteLogRow(row) {
    commit(deletePullEvents(state, [row.id]));
    showToast(L(`Đã xóa dòng ${row.text}.`, `已删除 ${row.text}。`), () => commit(restorePullEvents(state, [row.id])));
    (logList.querySelector(".rt-log-edit") || logTitle).focus();
  }

  function addAccount(opener) {
    openDialog({
      title: L("Thêm tài khoản", "添加账号"),
      fields: [{ name: "name", label: L("Tên tài khoản mới:", "新账号名称："), required: true }],
      submitLabel: L("Thêm", "添加"),
      opener,
      onSubmit: ({ name }) => {
        commit(createAccount(state, String(name || "").trim()));
        showToast(L("Đã thêm tài khoản.", "已添加账号。"));
      },
    });
  }

  function renameActiveAccount() {
    const current = state.accounts.find((account) => account.id === state.activeAccountId);
    openDialog({
      title: L("Đổi tên tài khoản", "重命名账号"),
      fields: [{ name: "name", label: L("Tên tài khoản:", "账号名称："), value: current?.name || "", required: true }],
      submitLabel: L("Lưu", "保存"),
      opener: accountMenu.button,
      onSubmit: ({ name }) => {
        commit(renameAccount(state, state.activeAccountId, String(name || "").trim()));
        showToast(L("Đã đổi tên tài khoản.", "已重命名账号。"));
      },
    });
  }

  function deleteActiveAccount() {
    const current = state.accounts.find((account) => account.id === state.activeAccountId);
    if (!current || view.accounts.length <= 1) {
      showToast(L("Cần giữ ít nhất 1 tài khoản.", "至少需保留 1 个账号。"));
      return;
    }
    openDialog({
      title: L("Xóa tài khoản", "删除账号"),
      lead: L(
        `Xóa tài khoản "${current.name}" và dữ liệu chiêu mộ của tài khoản này?`,
        `删除账号“${current.name}”及其招募数据？`,
      ),
      submitLabel: L("Xóa", "删除"),
      tone: "danger",
      opener: accountMenu.button,
      onSubmit: () => {
        commit(deleteAccount(state, current.id));
        showToast(L("Đã xóa tài khoản.", "已删除账号。"));
      },
    });
  }

  function bannerFields(item = null) {
    return [
      { name: "name", label: L("Tên gói/banner có thời hạn:", "限时卡包 / 卡池名称："), value: item?.name || "", required: true },
      { name: "expiresAt", label: L("Ngày hết hạn (không bắt buộc)", "截止日期（可选）"), type: "date", value: item?.expiresAt || "" },
    ];
  }

  function addLimitedBanner(opener) {
    openDialog({
      title: L("Thêm gói hạn giờ", "添加限时卡包"),
      fields: bannerFields(),
      submitLabel: L("Thêm gói", "添加卡包"),
      opener,
      onSubmit: ({ name, expiresAt }) => {
        commit(createLimitedBanner(state, { name: String(name || "").trim(), expiresAt }));
        showToast(L("Đã thêm gói hạn giờ.", "已添加限时卡包。"));
      },
    });
  }

  function editBanner(id, opener) {
    const item = bannerView(id);
    if (!item) return;
    openDialog({
      title: L(`Sửa gói · ${item.name}`, `编辑卡包 · ${item.name}`),
      fields: bannerFields(item),
      submitLabel: L("Lưu", "保存"),
      opener,
      onSubmit: ({ name, expiresAt }) => {
        commit(updateBanner(state, id, { name: String(name || "").trim(), expiresAt }));
        showToast(L("Đã lưu gói.", "已保存卡包。"));
      },
    });
  }

  function removeBanner(id, opener) {
    const item = bannerView(id);
    if (!item) return;
    openDialog({
      title: L("Xóa gói", "删除卡包"),
      lead: L(
        `Xóa gói "${item.name}"? Các lượt của gói này rời khỏi nhật ký và thống kê.`,
        `删除卡包“${item.name}”？该卡包的记录将从记录和统计中移除。`,
      ),
      submitLabel: L("Xóa", "删除"),
      tone: "danger",
      opener,
      onSubmit: () => {
        commit(deleteBanner(state, id));
        showToast(L(`Đã xóa gói ${item.name}.`, `已删除卡包 ${item.name}。`));
      },
    });
  }

  async function startSignIn(button) {
    if (!sync) return;
    button.disabled = true;
    showToast(L("Đang chuyển tới Google…", "正在跳转到 Google…"));
    const error = await sync.signIn();
    button.disabled = false;
    if (error) showToast(describeError(error));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = doc.createElement("a");
    link.href = url;
    link.download = `tqccl-chieu-mo-tracker-${currentDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let parsed;
    let validation;
    try {
      parsed = JSON.parse(await file.text());
      validation = validateRecruitTrackerImport(parsed);
      if (!validation.ok) {
        showToast(validation.error);
        return;
      }
      // Chạy thử đúng đường vẽ trước khi gộp: file lọt kiểm tra mà vẫn làm hỏng tracker thì không ghi.
      getRecruitTrackerSummary(mergeRecruitTrackerState(state, parsed), { date: currentDate() });
    } catch {
      showToast(L("File JSON không hợp lệ.", "JSON 文件无效。"));
      return;
    }
    const summary = validation.summary;
    openDialog({
      title: L("Gộp dữ liệu từ file?", "合并文件中的数据？"),
      lead: L(
        `File có ${summary.accounts} tài khoản, ${summary.banners} đợt chiêu mộ, ${summary.events} lượt quay. Bản ghi trùng giữ bản sửa sau cùng; dữ liệu hiện có không bị ghi đè. Nên Xuất JSON sao lưu trước nếu chưa chắc.`,
        `文件包含 ${summary.accounts} 个账号、${summary.banners} 个卡池、${summary.events} 条抽卡记录。重复记录保留最后修改的版本，现有数据不会被覆盖。如不确定，请先导出 JSON 备份。`,
      ),
      submitLabel: L("Gộp dữ liệu", "合并数据"),
      opener: importInput,
      onSubmit: () => {
        // Gộp lại trên state hiện tại (có thể đã đổi khi hộp thoại mở, ví dụ tab khác vừa ghi).
        commit(mergeRecruitTrackerState(state, parsed));
        // Bản ghi từ file giữ `updatedAt` cũ: đẩy lại toàn bộ để chúng lên đám mây.
        sync?.schedulePush({ full: true });
        showToast(L("Đã nhập JSON.", "已导入 JSON。"));
      },
    });
  }

  /* ---------- Tab khác và qua ngày khi trang vẫn mở ---------- */

  globalThis.addEventListener?.("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      state = loadRecruitTrackerState(storage);
      render();
    } else if (event.key === INVITE_KEY) {
      paintInvite();
    }
  });

  const refreshIfNewDay = () => {
    if (currentDate() !== renderedDate) render();
  };
  // Hẹn giờ tới nửa đêm địa phương kế tiếp; tab ngủ có thể trễ hẹn nên vẫn kiểm lại khi quay về trang.
  const scheduleMidnight = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    setTimeout(() => {
      refreshIfNewDay();
      scheduleMidnight();
    }, midnight.getTime() - now.getTime());
  };
  doc?.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "visible") refreshIfNewDay();
  });
  globalThis.addEventListener?.("focus", refreshIfNewDay);

  render();
  scheduleMidnight();

  /* ---------- Đồng bộ cloud (tuỳ chọn) ---------- */

  sync = createRecruitSync({
    storage,
    getState: () => state,
    applyRemote: (records) => {
      state = mergeRecruitRecords(state, records);
      saveRecruitTrackerState(storage, state);
      render();
    },
    onStatus: (status) => {
      syncStatus = status;
      paintSync();
      paintInvite();
    },
  });
  syncStatus = sync.status();
  paintSync();
  sync.start();

  return { refresh: render, getState: () => state };
}
