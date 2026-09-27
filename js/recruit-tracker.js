import { el, icon, svgNode } from "./render.js";
import { createDropdownMenu } from "./site-nav.js";
import { L } from "./i18n.js";
import {
  bannerDisplayName,
  createAccount,
  createLimitedBanner,
  dailySlotLabel,
  deleteAccount,
  getRecruitTrackerSummary,
  loadRecruitTrackerState,
  recordBannerFiveStar,
  recordBannerMiss,
  recordDailySlotFiveStar,
  recordDailySlotMiss,
  renameAccount,
  saveRecruitTrackerState,
  setActiveAccount,
  validateRecruitTrackerImport,
} from "./recruit-tracker-store.js";

const VALUE_CLASSES = ["Chưa phân loại", "Chủ lực", "Dùng đội", "Tình huống", "Nội chính", "Vật liệu"];
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
/** Badge phân loại tướng 5★: "Chủ lực" nền son nhạt, các mức còn lại nền giấy đậm (artboard Recruit). */
const VALUE_BADGE_CLASS = { "Chủ lực": "rt-value-accent" };
/** Bề rộng gộp cột trên mobile: nút ⋯ chỉ có ở đó, hàng thao tác hiện thẳng ở bề rộng lớn. */
const COMPACT_QUERY = "(max-width: 680px)";

// `<html lang>` cố định theo trang nên nhãn dịch lúc nạp module vẫn đúng ngôn ngữ.
const SLOT_STATUS_LABEL = {
  pending: L("Chưa quay", "未抽"),
  miss: L("Không ra", "未出"),
  fiveStar: L("Ra 5★", "出 5★"),
};
const RULE_WARNING = L("Kiểm tra lại dữ liệu/quy tắc game", "请核对数据或游戏规则");

const plusIcon = (size = 16) => icon([
  svgNode("line", { x1: 12, y1: 5, x2: 12, y2: 19 }),
  svgNode("line", { x1: 5, y1: 12, x2: 19, y2: 12 }),
], { size, stroke: 2 });

const downloadIcon = () => icon([
  svgNode("path", { d: "M12 4v11" }),
  svgNode("polyline", { points: "7 10 12 15 17 10" }),
  svgNode("path", { d: "M5 20h14" }),
], { size: 16 });

const uploadIcon = () => icon([
  svgNode("path", { d: "M12 20V9" }),
  svgNode("polyline", { points: "7 14 12 9 17 14" }),
  svgNode("path", { d: "M5 4h14" }),
], { size: 16 });

const shieldIcon = () => icon([
  svgNode("path", { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" }),
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

export function buildRecruitTrackerViewModel(summary, heroesDict = []) {
  const heroes = Array.isArray(heroesDict) ? heroesDict : Object.values(heroesDict || {});
  const pullCount = (item) => item.pullCount || item.pulls || 1;
  return {
    accounts: summary.accounts,
    heroOptions: uniqueSorted(heroes.map(heroName)),
    daily: {
      title: L(`${bannerDisplayName(summary.daily.banner)} - Hằng ngày`, `${bannerDisplayName(summary.daily.banner)} · 每日`),
      pityText: `${summary.daily.pity.pullsSinceFiveStar}/${summary.daily.pity.pityLimit}`,
      remainingText: L(`Còn ${summary.daily.pity.remaining} lượt`, `还差 ${summary.daily.pity.remaining} 抽`),
      todayText: L(`Hôm nay: ${summary.daily.todayDone}/4`, `今日：${summary.daily.todayDone}/4`),
      todayDone: summary.daily.todayDone,
      pity: pityView(summary.daily.pity),
      warning: summary.daily.pity.isOverLimit ? RULE_WARNING : "",
      slots: summary.daily.slots.map((slot) => ({
        ...slot,
        // Nhãn lưu trong kho là bản Việt; nhãn hiển thị lấy theo khóa lượt và ngôn ngữ trang.
        label: dailySlotLabel(slot.key) || slot.label,
        statusLabel: SLOT_STATUS_LABEL[slot.status] || slot.status,
      })),
    },
    limitedBanners: summary.limitedBanners.map((item) => ({
      ...item,
      id: item.banner.id,
      name: item.banner.name,
      pityText: `${item.pity.pullsSinceFiveStar}/${item.pity.pityLimit}`,
      pity: pityView(item.pity),
      warning: item.pity.isOverLimit ? RULE_WARNING : "",
    })),
    // Lịch sử: tên lượt ngày theo ngôn ngữ trang, số lượt so với mốc bảo hiểm của chính gói đó.
    history: summary.history.map((item) => ({
      ...item,
      slotText: item.drawSlot ? dailySlotLabel(item.drawSlot) : "",
      pullsText: L(`lượt ${pullCount(item)}/${item.pityLimit}`, `第 ${pullCount(item)}/${item.pityLimit} 抽`),
    })),
  };
}

export function initRecruitTracker({ heroesDict = [], mount, storage = localStorage } = {}) {
  if (!mount) return null;
  let state = loadRecruitTrackerState(storage);
  let pendingFiveStar = null;
  let message = "";
  const doc = mount.ownerDocument ?? globalThis.document;
  const compact = globalThis.matchMedia?.(COMPACT_QUERY) ?? null;
  const currentDate = () => todayLocalDate();
  /** Ngày của lưới lượt ngày đang vẽ: đổi ngày (qua nửa đêm) thì vẽ lại để 4 ô về "Chưa quay". */
  let renderedDate = "";

  const persist = () => saveRecruitTrackerState(storage, state);
  const refresh = () => render();
  const mutate = (nextState, nextMessage = "") => {
    state = nextState;
    message = nextMessage;
    persist();
    refresh();
  };

  function openFiveStarForm(context) {
    pendingFiveStar = context;
    message = "";
    render();
    mount.querySelector("[data-hero-input]")?.focus();
  }

  function closeFiveStarForm() {
    pendingFiveStar = null;
    refresh();
  }

  /* ---------- Khung dựng một lần (nút đang bấm luôn được giữ trong DOM) ---------- */

  const accountSelect = el("select", {
    class: "rt-select",
    id: "rt-account-select",
    "aria-label": L("Chọn tài khoản", "选择账号"),
    onchange: (event) => mutate(setActiveAccount(state, event.target.value)),
  });
  const accountActions = el("div", { class: "rt-account-actions", id: "rt-account-actions", "data-dropdown-panel": "" });
  const accountToggle = el("button", {
    class: "rt-btn rt-account-toggle",
    type: "button",
    "aria-label": L("Tùy chọn tài khoản", "账号选项"),
    "aria-controls": "rt-account-actions",
    "data-dropdown-button": "",
  }, "…");
  const accountMenu = createDropdownMenu({
    root: el("div", { class: "rt-account-menu", "data-dropdown": "rt-account" }),
    button: accountToggle,
    panel: accountActions,
    closeSelector: "button, a[href], label",
    shouldHidePanel: () => Boolean(compact?.matches),
  });
  accountMenu.root.append(accountToggle, accountActions);

  const accountBar = el("div", { class: "rt-account-bar" }, [
    el("label", { class: "rt-account-pick", for: "rt-account-select" }, [
      el("span", { class: "rt-kicker" }, L("Tài khoản", "账号")),
      accountSelect,
    ]),
    accountMenu.root,
  ]);
  accountActions.append(
    el("button", { class: "rt-btn", type: "button", onclick: addAccount }, L("+ Tài khoản", "+ 账号")),
    el("button", { class: "rt-btn", type: "button", onclick: renameActiveAccount }, L("Đổi tên", "重命名")),
    el("button", { class: "tool-text-action", type: "button", onclick: deleteActiveAccount }, L("Xóa tài khoản", "删除账号")),
    el("span", { class: "rt-account-gap" }),
    el("button", { class: "rt-btn", type: "button", onclick: exportJson }, [downloadIcon(), L("Xuất JSON", "导出 JSON")]),
    renderImportControl(),
  );

  const messageNode = el("p", { class: "rt-message", role: "status", hidden: "" });

  const dailyTitle = el("h2", { class: "rt-section-title" });
  const pityLabel = el("span", { class: "rt-kicker" }, L("Mốc bảo hiểm 5★", "5★ 保底"));
  const pityValue = el("strong", { class: "rt-pity-value" });
  const pityUnit = el("span", { class: "rt-pity-unit" });
  const pityFill = el("span", { class: "rt-pity-fill" });
  const pityMeter = el("span", {
    class: "rt-pity-meter",
    role: "meter",
    "aria-label": L("Tiến độ bảo hiểm 5★", "5★ 保底进度"),
    "aria-valuemin": "0",
  }, [pityFill]);
  const pityMeta = el("span", { class: "rt-pity-meta" });
  const pityWarning = el("p", { class: "rt-warning", hidden: "" });
  const slotNodes = new Map();
  const slotGrid = el("div", { class: "rt-slot-grid" });

  const dailySection = el("section", { class: "rt-section" }, [
    el("header", { class: "rt-section-head rt-section-head-inline" }, [
      dailyTitle,
      el("p", { class: "rt-sub" }, L("4 lượt miễn phí / nửa giá mỗi ngày", "每日 4 次免费 / 半价招募")),
    ]),
    el("div", { class: "rt-pity-block" }, [pityLabel, el("div", { class: "rt-pity-figures" }, [pityValue, pityUnit]), pityMeter, pityMeta, pityWarning]),
    slotGrid,
  ]);

  const bannerList = el("div", { class: "rt-limited-list" });
  const bannerNodes = new Map();
  /** Ảnh chụp gói hạn giờ của lần vẽ gần nhất (nút "Ra 5★" đọc tên đang hiện). */
  let latestBanners = [];
  const limitedSection = el("section", { class: "rt-section" }, [
    el("header", { class: "rt-section-head" }, [
      el("div", {}, [
        el("h2", { class: "rt-section-title" }, L("Gói hạn giờ / Đột xuất", "限时 / 临时卡包")),
        el("p", { class: "rt-sub" }, L("Tạo riêng cho banner có thời hạn hoặc gói theo giai đoạn.", "为限时卡池或阶段性卡包单独创建。")),
      ]),
      el("button", { class: "rt-btn", type: "button", onclick: addLimitedBanner }, [plusIcon(), L("Thêm gói", "添加卡包")]),
    ]),
    bannerList,
  ]);

  const historyList = el("ol", { class: "rt-history" });
  const historyEmpty = el("p", { class: "rt-empty" }, L("Chưa ghi nhận tướng 5★.", "尚未记录 5★ 武将。"));
  const historySection = el("aside", { class: "rt-section rt-history-section" }, [
    el("header", { class: "rt-section-head rt-section-head-inline" }, [
      el("h2", { class: "rt-section-title" }, L("Lịch sử 5★", "5★ 记录")),
      el("p", { class: "rt-sub" }, L("Mới nhất trước, lọc theo tài khoản đang chọn.", "最新在前，仅显示当前账号。")),
    ]),
    historyList,
    historyEmpty,
  ]);

  const formSlot = el("div", { class: "rt-form-slot" });

  const head = el("header", { class: "tool-head" }, [
    el("div", { class: "reference-head-text" }, [
      el("span", { class: "reference-kicker" }, L("Công cụ · Beta", "工具 · Beta")),
      el("h1", { class: "reference-title", tabindex: "-1" }, L("Theo dõi chiêu mộ", "招募记录")),
      el("p", { class: "reference-lead" }, L("Đếm lượt tới mốc bảo hiểm 5★ cho từng tài khoản và ghi lại tướng 5★ đã ra.", "按账号统计距离 5★ 保底的抽数，并记录已抽到的 5★ 武将。")),
    ]),
  ]);

  mount.replaceChildren(el("div", { class: "rt-shell" }, [
    head,
    el("p", { class: "tool-notice" }, [
      el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
      el("span", {}, L([
        "Dữ liệu chỉ lưu trong trình duyệt này và có thể mất khi xóa dữ liệu trang. Dùng ",
        el("strong", {}, "Xuất JSON"),
        " để sao lưu, ",
        el("strong", {}, "Nhập JSON"),
        " để khôi phục.",
      ], [
        "数据仅保存在本浏览器中，清除网站数据后可能丢失。请用",
        el("strong", {}, "导出 JSON"),
        "备份，用",
        el("strong", {}, "导入 JSON"),
        "恢复。",
      ])),
    ]),
    accountBar,
    messageNode,
    el("div", { class: "rt-grid" }, [
      el("div", { class: "rt-col" }, [dailySection, limitedSection]),
      historySection,
    ]),
    formSlot,
  ]));

  const syncCompactMenu = () => accountMenu.sync();
  accountMenu.sync();
  compact?.addEventListener?.("change", syncCompactMenu);
  doc?.addEventListener("click", (event) => accountMenu.handleDocumentClick(event));
  doc?.addEventListener("focusout", (event) => accountMenu.handleDocumentFocusOut(event));
  doc?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    accountMenu.handleEscape();
  });

  /* ---------- Cập nhật tại chỗ ---------- */

  function render() {
    renderedDate = currentDate();
    const summary = getRecruitTrackerSummary(state, { date: renderedDate });
    const viewModel = buildRecruitTrackerViewModel(summary, heroesDict);
    paintAccounts(viewModel);
    dailyTitle.textContent = viewModel.daily.title;
    messageNode.textContent = message || "";
    messageNode.hidden = !message;
    paintPity(viewModel.daily.pity, viewModel.daily);
    paintSlots(viewModel.daily.slots);
    paintBanners(viewModel.limitedBanners);
    paintHistory(viewModel);
    paintForm(viewModel);
  }

  function paintAccounts(viewModel) {
    const signature = `${state.activeAccountId}|${viewModel.accounts.map((account) => `${account.id}:${account.name}`).join("|")}`;
    if (accountSelect.dataset.signature !== signature) {
      accountSelect.dataset.signature = signature;
      accountSelect.replaceChildren(
        ...viewModel.accounts.map((account) => el("option", {
          value: account.id,
          selected: account.id === state.activeAccountId ? "selected" : null,
        }, account.name)),
      );
      accountSelect.value = state.activeAccountId;
    }
    const active = viewModel.accounts.find((account) => account.id === state.activeAccountId);
    accountToggle.setAttribute("aria-label", L("Tùy chọn tài khoản", "账号选项") + (active ? ` · ${active.name}` : ""));
  }

  /** Đồng hồ pity: thanh `role="meter"` + chữ "x / y" lấy thẳng từ giá trị store đã tính. */
  function paintPity(pity, daily) {
    pityValue.textContent = String(pity.value);
    pityUnit.textContent = L(`/ ${pity.limit} lượt`, `/ ${pity.limit} 抽`);
    pityMeter.setAttribute("aria-valuemax", String(pity.limit));
    pityMeter.setAttribute("aria-valuenow", String(Math.min(pity.value, pity.limit)));
    pityMeter.setAttribute("aria-valuetext", L(`${pity.value} / ${pity.limit} lượt`, `${pity.value} / ${pity.limit} 抽`));
    pityFill.style.width = `${pity.percent}%`;
    pityMeta.replaceChildren(
      el("strong", {}, daily.remainingText),
      L(` tới mốc bảo hiểm · Hôm nay ${daily.todayDone}/4`, `即达保底 · 今日 ${daily.todayDone}/4`),
    );
    pityWarning.textContent = daily.warning || "";
    pityWarning.hidden = !daily.warning;
  }

  function paintSlots(slots) {
    for (const slot of slots) {
      let entry = slotNodes.get(slot.key);
      if (!entry) {
        const missButton = el("button", {
          class: "rt-btn rt-btn-small",
          type: "button",
          onclick: () => mutate(recordDailySlotMiss(state, {
            accountId: state.activeAccountId,
            date: currentDate(),
            slotKey: slot.key,
          })),
        }, SLOT_STATUS_LABEL.miss);
        const fiveStarButton = el("button", {
          class: "rt-btn rt-btn-small",
          type: "button",
          onclick: () => openFiveStarForm({ mode: "daily", slotKey: slot.key, date: renderedDate, pulls: 1 }),
        }, SLOT_STATUS_LABEL.fiveStar);
        const statusNode = el("span", { class: "rt-slot-status" });
        const node = el("div", { class: "rt-slot" }, [
          el("div", { class: "rt-slot-main" }, [el("span", { class: "rt-slot-label" }, slot.label), statusNode]),
          el("div", { class: "rt-slot-actions" }, [missButton, fiveStarButton]),
        ]);
        entry = { node, statusNode, missButton, fiveStarButton };
        slotNodes.set(slot.key, entry);
        slotGrid.append(node);
      }
      const pending = slot.status === "pending";
      entry.node.className = `rt-slot rt-slot-${slot.status}`;
      entry.statusNode.textContent = slot.statusLabel;
      // Trạng thái đã ghi hiện ngay trên nút vừa bấm; cả hai nút khóa lại như hành vi cũ.
      entry.missButton.disabled = !pending;
      entry.missButton.setAttribute("aria-pressed", String(slot.status === "miss"));
      entry.fiveStarButton.disabled = !pending;
      entry.fiveStarButton.setAttribute("aria-pressed", String(slot.status === "fiveStar"));
    }
    for (const [key, entry] of slotNodes) {
      if (slots.some((slot) => slot.key === key)) continue;
      entry.node.remove();
      slotNodes.delete(key);
    }
  }

  function paintBanners(banners) {
    // Ảnh chụp mới nhất của kho: nút "Ra 5★" đọc tên gói đang hiện, không giữ bản chụp lúc tạo nút
    // (nhập JSON cùng id nhưng đổi tên phải hiện ngay, không cần tải lại trang).
    latestBanners = banners;
    for (const item of banners) {
      let node = bannerNodes.get(item.id);
      if (!node) {
        node = el("article", { class: "rt-banner" }, [
          el("div", { class: "rt-banner-main" }, [
            el("strong", { class: "rt-banner-name" }, item.name),
            el("span", { class: "rt-sub" }, L("Bảo hiểm riêng của gói", "卡包独立保底")),
          ]),
          el("div", { class: "rt-banner-progress" }, [
            el("span", { class: "rt-banner-progress-row" }, [el("span", {}, L("Tiến độ", "进度")), el("strong", { class: "rt-banner-count" })]),
            el("span", { class: "rt-pity-meter rt-banner-meter", role: "meter" }, [el("span", { class: "rt-pity-fill" })]),
          ]),
          el("div", { class: "rt-banner-actions" }, [
            el("button", {
              class: "rt-btn rt-btn-small",
              type: "button",
              onclick: () => mutate(recordBannerMiss(state, {
                accountId: state.activeAccountId,
                bannerId: item.id,
                pulls: 1,
                date: currentDate(),
              })),
            }, "+1"),
            el("button", {
              class: "rt-btn rt-btn-small",
              type: "button",
              onclick: () => mutate(recordBannerMiss(state, {
                accountId: state.activeAccountId,
                bannerId: item.id,
                pulls: 5,
                date: currentDate(),
              })),
            }, "+5"),
            el("button", {
              class: "rt-btn rt-btn-small",
              type: "button",
              onclick: () => openFiveStarForm({
                mode: "limited",
                bannerId: item.id,
                bannerName: latestBanners.find((entry) => entry.id === item.id)?.name || item.name,
                pulls: 1,
              }),
            }, SLOT_STATUS_LABEL.fiveStar),
          ]),
          el("p", { class: "rt-warning", hidden: "" }),
        ]);
        bannerNodes.set(item.id, node);
        bannerList.append(node);
      }
      node.querySelector(".rt-banner-name").textContent = item.name;
      const meter = node.querySelector(".rt-banner-meter");
      meter.setAttribute("aria-label", L("Tiến độ bảo hiểm 5★ · ", "5★ 保底进度 · ") + item.name);
      meter.setAttribute("aria-valuemin", "0");
      meter.setAttribute("aria-valuemax", String(item.pity.limit));
      meter.setAttribute("aria-valuenow", String(Math.min(item.pity.value, item.pity.limit)));
      meter.setAttribute("aria-valuetext", L(`${item.pity.value} / ${item.pity.limit} lượt`, `${item.pity.value} / ${item.pity.limit} 抽`));
      node.querySelector(".rt-banner-count").textContent = item.pityText;
      node.querySelector(".rt-pity-fill").style.width = `${item.pity.percent}%`;
      const warning = node.querySelector(".rt-warning");
      warning.textContent = item.warning || "";
      warning.hidden = !item.warning;
    }
    for (const [id, node] of bannerNodes) {
      if (banners.some((item) => item.id === id)) continue;
      node.remove();
      bannerNodes.delete(id);
    }
    if (!banners.length) {
      if (!bannerList.querySelector(".rt-empty")) bannerList.append(el("p", { class: "rt-empty" }, L("Chưa có gói hạn giờ.", "暂无限时卡包。")));
    } else {
      bannerList.querySelector(".rt-empty")?.remove();
    }
  }

  function paintHistory(viewModel) {
    const items = viewModel.history || [];
    historyList.replaceChildren(...items.map(renderHistoryItem));
    historyList.hidden = !items.length;
    historyEmpty.hidden = Boolean(items.length);
  }

  function renderHistoryItem(item) {
    return el("li", { class: "rt-history-item" }, [
      el("span", { class: "rt-history-hero" }, item.heroName || L("Tướng chưa ghi", "未记录武将")),
      el("span", { class: `badge rt-value ${VALUE_BADGE_CLASS[item.heroValueClass] || ""}`.trim() }, valueClassLabel(item.heroValueClass || "Chưa phân loại")),
      el("span", { class: "rt-history-date" }, [item.date, " · ", item.bannerName, item.slotText ? ` · ${item.slotText}` : ""]),
      el("span", { class: "rt-history-pulls" }, item.pullsText),
      item.note ? el("p", { class: "rt-note" }, item.note) : null,
    ]);
  }

  function paintForm(viewModel) {
    if (!pendingFiveStar) {
      formSlot.replaceChildren();
      formSlot.dataset.signature = "";
      return;
    }
    const title = pendingFiveStar.mode === "daily"
      ? L("Ghi 5★ · ", "记录 5★ · ") + dailySlotLabel(pendingFiveStar.slotKey)
      : L("Ghi 5★ · ", "记录 5★ · ") + pendingFiveStar.bannerName;
    const signature = `${pendingFiveStar.mode}|${pendingFiveStar.slotKey || pendingFiveStar.bannerId}`;
    if (formSlot.dataset.signature === signature) return;
    formSlot.dataset.signature = signature;
    formSlot.replaceChildren(el("section", { class: "rt-section rt-form-section" }, [
      el("div", { class: "rt-section-head" }, [
        el("h2", { class: "rt-section-title" }, title),
        el("button", { class: "rt-btn rt-btn-small", type: "button", onclick: closeFiveStarForm }, L("Đóng", "关闭")),
      ]),
      el("form", { class: "rt-form", onsubmit: submitFiveStar }, [
        el("label", {}, [
          el("span", {}, L("Tướng", "武将")),
          el("input", { name: "heroName", list: "rt-hero-options", required: "required", autocomplete: "off", "data-hero-input": "true" }),
        ]),
        el("datalist", { id: "rt-hero-options" }, viewModel.heroOptions.map((name) => el("option", { value: name }))),
        // Lượt ngày ghi vào đúng ô của lưới đã mở form, nên chỉ gói hạn giờ mới chọn ngày.
        ...(pendingFiveStar.mode === "limited" ? [
          el("label", {}, [el("span", {}, L("Ngày", "日期")), el("input", { name: "date", type: "date", value: currentDate() })]),
          el("label", {}, [
            el("span", {}, L("Số lượt", "抽数")),
            el("input", { name: "pulls", type: "number", min: "1", value: "1" }),
          ]),
        ] : []),
        el("label", {}, [
          el("span", {}, L("Phân loại", "分类")),
          el("select", { name: "heroValueClass" }, VALUE_CLASSES.map((entry) => el("option", { value: entry }, valueClassLabel(entry)))),
        ]),
        el("label", { class: "rt-form-wide" }, [el("span", {}, L("Ghi chú", "备注")), el("input", { name: "note", autocomplete: "off" })]),
        el("button", { class: "rt-btn rt-primary", type: "submit" }, L("Lưu 5★", "保存 5★")),
      ]),
    ]));
  }

  function renderImportControl() {
    const input = el("input", {
      type: "file",
      accept: "application/json,.json",
      class: "rt-file",
      onchange: importJson,
    });
    return el("label", { class: "rt-btn rt-import" }, [L("Nhập JSON", "导入 JSON"), input]);
  }

  function addAccount() {
    const name = prompt(L("Tên tài khoản mới:", "新账号名称："));
    if (!name) return;
    mutate(createAccount(state, name.trim()), L("Đã thêm tài khoản.", "已添加账号。"));
  }

  function renameActiveAccount() {
    const current = state.accounts.find((account) => account.id === state.activeAccountId);
    const name = prompt(L("Tên tài khoản:", "账号名称："), current?.name || "");
    if (!name) return;
    mutate(renameAccount(state, state.activeAccountId, name.trim()), L("Đã đổi tên tài khoản.", "已重命名账号。"));
  }

  function deleteActiveAccount() {
    const current = state.accounts.find((account) => account.id === state.activeAccountId);
    if (!current || state.accounts.length <= 1) {
      message = L("Cần giữ ít nhất 1 tài khoản.", "至少需保留 1 个账号。");
      render();
      return;
    }
    if (!confirm(L(`Xóa tài khoản "${current.name}" và dữ liệu chiêu mộ của tài khoản này?`, `删除账号“${current.name}”及其招募数据？`))) return;
    mutate(deleteAccount(state, current.id), L("Đã xóa tài khoản.", "已删除账号。"));
  }

  function addLimitedBanner() {
    const name = prompt(L("Tên gói/banner có thời hạn:", "限时卡包 / 卡池名称："));
    if (!name) return;
    mutate(createLimitedBanner(state, { name: name.trim() }), L("Đã thêm gói hạn giờ.", "已添加限时卡包。"));
  }

  function submitFiveStar(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const heroName = String(form.get("heroName") || "").trim();
    if (!heroName) return;
    const context = pendingFiveStar;
    const date = context.mode === "daily" ? context.date : String(form.get("date") || currentDate());
    const note = String(form.get("note") || "");
    const heroValueClass = String(form.get("heroValueClass") || "Chưa phân loại");
    pendingFiveStar = null;
    if (context.mode === "daily") {
      mutate(recordDailySlotFiveStar(state, {
        accountId: state.activeAccountId,
        date,
        slotKey: context.slotKey,
        heroName,
        note,
        heroValueClass,
      }), L("Đã lưu tướng 5★.", "已保存 5★ 武将。"));
    } else {
      mutate(recordBannerFiveStar(state, {
        accountId: state.activeAccountId,
        bannerId: context.bannerId,
        pulls: Number(form.get("pulls")) || 1,
        heroName,
        note,
        date,
        heroValueClass,
      }), L("Đã lưu tướng 5★.", "已保存 5★ 武将。"));
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tqccl-chieu-mo-tracker-${currentDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validation = validateRecruitTrackerImport(parsed);
      if (!validation.ok) {
        message = validation.error;
        render();
        return;
      }
      // Chạy thử đúng đường vẽ trước khi ghi: file lọt kiểm tra mà vẫn làm hỏng tracker thì không ghi đè.
      getRecruitTrackerSummary(parsed, { date: currentDate() });
      const summary = validation.summary;
      const ok = confirm(L(
        `Ghi đè dữ liệu hiện tại?\nFile có ${summary.accounts} tài khoản, ${summary.banners} đợt chiêu mộ, ${summary.events} lượt quay.\nNên Xuất JSON sao lưu trước nếu chưa chắc.`,
        `覆盖当前数据？\n文件包含 ${summary.accounts} 个账号、${summary.banners} 个卡池、${summary.events} 条抽卡记录。\n如不确定，请先导出 JSON 备份。`,
      ));
      if (!ok) return;
      mutate(parsed, L("Đã nhập JSON.", "已导入 JSON。"));
    } catch {
      message = L("File JSON không hợp lệ.", "JSON 文件无效。");
      render();
    }
  }

  /* ---------- Qua ngày khi trang vẫn mở ---------- */

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
  return { refresh, getState: () => state };
}
