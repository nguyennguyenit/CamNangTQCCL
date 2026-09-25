import { el, icon, svgNode } from "./render.js";
import { createDropdownMenu } from "./site-nav.js";
import {
  createAccount,
  createLimitedBanner,
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
/** Badge phân loại tướng 5★: "Chủ lực" nền son nhạt, các mức còn lại nền giấy đậm (artboard Recruit). */
const VALUE_BADGE_CLASS = { "Chủ lực": "rt-value-accent" };
/** Bề rộng gộp cột trên mobile: nút ⋯ chỉ có ở đó, hàng thao tác hiện thẳng ở bề rộng lớn. */
const COMPACT_QUERY = "(max-width: 680px)";

const SLOT_STATUS_LABEL = {
  pending: "Chưa quay",
  miss: "Không ra",
  fiveStar: "Ra 5★",
};

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

function heroName(hero) {
  return hero.name || hero.viet || hero.hanViet || hero.chinese || "";
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
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
  return {
    accountLabel: summary.account?.name || "Tài khoản",
    accounts: summary.accounts,
    heroOptions: uniqueSorted(heroes.map(heroName)),
    daily: {
      title: "Danh tướng PK - Hằng ngày",
      pityText: `${summary.daily.pity.pullsSinceFiveStar}/${summary.daily.pity.pityLimit}`,
      remainingText: `Còn ${summary.daily.pity.remaining} lượt`,
      todayText: `Hôm nay: ${summary.daily.todayDone}/4`,
      todayDone: summary.daily.todayDone,
      pity: pityView(summary.daily.pity),
      warning: summary.daily.pity.isOverLimit ? "Kiểm tra lại dữ liệu/quy tắc game" : "",
      slots: summary.daily.slots.map((slot) => ({
        ...slot,
        statusLabel: SLOT_STATUS_LABEL[slot.status] || slot.status,
      })),
    },
    limitedBanners: summary.limitedBanners.map((item) => ({
      ...item,
      id: item.banner.id,
      name: item.banner.name,
      pityText: `${item.pity.pullsSinceFiveStar}/${item.pity.pityLimit}`,
      pity: pityView(item.pity),
      warning: item.pity.isOverLimit ? "Kiểm tra lại dữ liệu/quy tắc game" : "",
    })),
    history: summary.history,
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
    "aria-label": "Chọn tài khoản",
    onchange: (event) => mutate(setActiveAccount(state, event.target.value)),
  });
  const accountActions = el("div", { class: "rt-account-actions", id: "rt-account-actions", "data-dropdown-panel": "" });
  const accountToggle = el("button", {
    class: "rt-btn rt-account-toggle",
    type: "button",
    "aria-label": "Tùy chọn tài khoản",
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
      el("span", { class: "rt-kicker" }, "Tài khoản"),
      accountSelect,
    ]),
    accountMenu.root,
  ]);
  accountActions.append(
    el("button", { class: "rt-btn", type: "button", onclick: addAccount }, "+ Tài khoản"),
    el("button", { class: "rt-btn", type: "button", onclick: renameActiveAccount }, "Đổi tên"),
    el("button", { class: "tool-text-action", type: "button", onclick: deleteActiveAccount }, "Xóa tài khoản"),
    el("span", { class: "rt-account-gap" }),
    el("button", { class: "rt-btn", type: "button", onclick: exportJson }, [downloadIcon(), "Xuất JSON"]),
    renderImportControl(),
  );

  const messageNode = el("p", { class: "rt-message", role: "status", hidden: "" });

  const dailyTitle = el("h2", { class: "rt-section-title" }, "Danh tướng PK - Hằng ngày");
  const pityLabel = el("span", { class: "rt-kicker" }, "Mốc bảo hiểm 5★");
  const pityValue = el("strong", { class: "rt-pity-value" });
  const pityUnit = el("span", { class: "rt-pity-unit" });
  const pityFill = el("span", { class: "rt-pity-fill" });
  const pityMeter = el("span", {
    class: "rt-pity-meter",
    role: "meter",
    "aria-label": "Tiến độ bảo hiểm 5★",
    "aria-valuemin": "0",
  }, [pityFill]);
  const pityMeta = el("span", { class: "rt-pity-meta" });
  const pityWarning = el("p", { class: "rt-warning", hidden: "" });
  const slotNodes = new Map();
  const slotGrid = el("div", { class: "rt-slot-grid" });

  const dailySection = el("section", { class: "rt-section" }, [
    el("header", { class: "rt-section-head" }, [
      el("div", {}, [dailyTitle, el("p", { class: "rt-sub" }, "4 lượt miễn phí / nửa giá mỗi ngày")]),
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
        el("h2", { class: "rt-section-title" }, "Gói hạn giờ / Đột xuất"),
        el("p", { class: "rt-sub" }, "Tạo riêng cho banner có thời hạn hoặc gói theo giai đoạn."),
      ]),
      el("button", { class: "rt-btn", type: "button", onclick: addLimitedBanner }, [plusIcon(), "Thêm gói"]),
    ]),
    bannerList,
  ]);

  const historyList = el("ol", { class: "rt-history" });
  const historyEmpty = el("p", { class: "rt-empty" }, "Chưa ghi nhận tướng 5★.");
  const historySection = el("aside", { class: "rt-section rt-history-section" }, [
    el("header", { class: "rt-section-head" }, [
      el("div", {}, [
        el("h2", { class: "rt-section-title" }, "Lịch sử 5★"),
        el("p", { class: "rt-sub" }, "Mới nhất trước, lọc theo tài khoản đang chọn."),
      ]),
      el("span", { class: "rt-section-note" }),
    ]),
    historyList,
    historyEmpty,
  ]);

  const formSlot = el("div", { class: "rt-form-slot" });

  const head = el("header", { class: "tool-head" }, [
    el("div", { class: "reference-head-text" }, [
      el("span", { class: "reference-kicker" }, "Công cụ · Beta"),
      el("h1", { class: "reference-title", tabindex: "-1" }, "Theo dõi chiêu mộ"),
      el("p", { class: "reference-lead" }, "Đếm lượt tới mốc bảo hiểm 5★ cho từng tài khoản và ghi lại tướng 5★ đã ra."),
    ]),
  ]);

  mount.replaceChildren(el("div", { class: "rt-shell" }, [
    head,
    el("p", { class: "tool-notice" }, [
      el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
      el("span", {}, [
        "Dữ liệu chỉ lưu trong trình duyệt này và có thể mất khi xóa dữ liệu trang. Dùng ",
        el("strong", {}, "Xuất JSON"),
        " để sao lưu, ",
        el("strong", {}, "Nhập JSON"),
        " để khôi phục.",
      ]),
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
    const summary = getRecruitTrackerSummary(state, { date: currentDate() });
    const viewModel = buildRecruitTrackerViewModel(summary, heroesDict);
    paintAccounts(viewModel);
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
    accountToggle.setAttribute("aria-label", `Tùy chọn tài khoản${active ? ` · ${active.name}` : ""}`);
  }

  /** Đồng hồ pity: thanh `role="meter"` + chữ "x / y" lấy thẳng từ giá trị store đã tính. */
  function paintPity(pity, daily) {
    pityValue.textContent = String(pity.value);
    pityUnit.textContent = `/ ${pity.limit} lượt`;
    pityMeter.setAttribute("aria-valuemax", String(pity.limit));
    pityMeter.setAttribute("aria-valuenow", String(Math.min(pity.value, pity.limit)));
    pityMeter.setAttribute("aria-valuetext", `${pity.value} / ${pity.limit} lượt`);
    pityFill.style.width = `${pity.percent}%`;
    pityMeta.replaceChildren(
      el("strong", {}, daily.remainingText),
      ` tới mốc bảo hiểm · Hôm nay ${daily.todayDone}/4`,
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
        }, "Không ra");
        const fiveStarButton = el("button", {
          class: "rt-btn rt-btn-small",
          type: "button",
          onclick: () => openFiveStarForm({ mode: "daily", slotKey: slot.key, pulls: 1 }),
        }, "Ra 5★");
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
            el("span", { class: "rt-sub" }, "Bảo hiểm riêng của gói"),
          ]),
          el("div", { class: "rt-banner-progress" }, [
            el("span", { class: "rt-banner-progress-row" }, [el("span", {}, "Tiến độ"), el("strong", { class: "rt-banner-count" })]),
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
            }, "Ra 5★"),
          ]),
          el("p", { class: "rt-warning", hidden: "" }),
        ]);
        bannerNodes.set(item.id, node);
        bannerList.append(node);
      }
      node.querySelector(".rt-banner-name").textContent = item.name;
      const meter = node.querySelector(".rt-banner-meter");
      meter.setAttribute("aria-label", `Tiến độ bảo hiểm 5★ · ${item.name}`);
      meter.setAttribute("aria-valuemin", "0");
      meter.setAttribute("aria-valuemax", String(item.pity.limit));
      meter.setAttribute("aria-valuenow", String(Math.min(item.pity.value, item.pity.limit)));
      meter.setAttribute("aria-valuetext", `${item.pity.value} / ${item.pity.limit} lượt`);
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
      if (!bannerList.querySelector(".rt-empty")) bannerList.append(el("p", { class: "rt-empty" }, "Chưa có gói hạn giờ."));
    } else {
      bannerList.querySelector(".rt-empty")?.remove();
    }
  }

  function paintHistory(viewModel) {
    const items = viewModel.history || [];
    historyList.replaceChildren(...items.map(renderHistoryItem));
    historyList.hidden = !items.length;
    historyEmpty.hidden = Boolean(items.length);
    historySection.querySelector(".rt-section-note").textContent = `Mới nhất trước · ${viewModel.accountLabel}`;
  }

  function renderHistoryItem(item) {
    return el("li", { class: "rt-history-item" }, [
      el("span", { class: "rt-history-hero" }, item.heroName || "Tướng chưa ghi"),
      el("span", { class: `badge rt-value ${VALUE_BADGE_CLASS[item.heroValueClass] || ""}`.trim() }, item.heroValueClass || "Chưa phân loại"),
      el("span", { class: "rt-history-date" }, [item.date, " · ", item.bannerName, item.drawSlot ? ` · ${item.drawSlot}` : ""]),
      el("span", { class: "rt-history-pulls" }, `lượt ${item.pullCount || item.pulls || 1}/30`),
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
      ? `Ghi 5★ · ${pendingFiveStar.slotKey}`
      : `Ghi 5★ · ${pendingFiveStar.bannerName}`;
    const signature = `${pendingFiveStar.mode}|${pendingFiveStar.slotKey || pendingFiveStar.bannerId}`;
    if (formSlot.dataset.signature === signature) return;
    formSlot.dataset.signature = signature;
    formSlot.replaceChildren(el("section", { class: "rt-section rt-form-section" }, [
      el("div", { class: "rt-section-head" }, [
        el("h2", { class: "rt-section-title" }, title),
        el("button", { class: "rt-btn rt-btn-small", type: "button", onclick: closeFiveStarForm }, "Đóng"),
      ]),
      el("form", { class: "rt-form", onsubmit: submitFiveStar }, [
        el("label", {}, [
          el("span", {}, "Tướng"),
          el("input", { name: "heroName", list: "rt-hero-options", required: "required", autocomplete: "off", "data-hero-input": "true" }),
        ]),
        el("datalist", { id: "rt-hero-options" }, viewModel.heroOptions.map((name) => el("option", { value: name }))),
        el("label", {}, [el("span", {}, "Ngày"), el("input", { name: "date", type: "date", value: currentDate() })]),
        pendingFiveStar.mode === "limited" ? el("label", {}, [
          el("span", {}, "Số lượt"),
          el("input", { name: "pulls", type: "number", min: "1", value: "1" }),
        ]) : null,
        el("label", {}, [
          el("span", {}, "Phân loại"),
          el("select", { name: "heroValueClass" }, VALUE_CLASSES.map((entry) => el("option", { value: entry }, entry))),
        ]),
        el("label", { class: "rt-form-wide" }, [el("span", {}, "Ghi chú"), el("input", { name: "note", autocomplete: "off" })]),
        el("button", { class: "rt-btn rt-primary", type: "submit" }, "Lưu 5★"),
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
    return el("label", { class: "rt-btn rt-import" }, ["Nhập JSON", input]);
  }

  function addAccount() {
    const name = prompt("Tên tài khoản mới:");
    if (!name) return;
    mutate(createAccount(state, name.trim()), "Đã thêm tài khoản.");
  }

  function renameActiveAccount() {
    const current = state.accounts.find((account) => account.id === state.activeAccountId);
    const name = prompt("Tên tài khoản:", current?.name || "");
    if (!name) return;
    mutate(renameAccount(state, state.activeAccountId, name.trim()), "Đã đổi tên tài khoản.");
  }

  function deleteActiveAccount() {
    const current = state.accounts.find((account) => account.id === state.activeAccountId);
    if (!current || state.accounts.length <= 1) {
      message = "Cần giữ ít nhất 1 tài khoản.";
      render();
      return;
    }
    if (!confirm(`Xóa tài khoản "${current.name}" và dữ liệu chiêu mộ của tài khoản này?`)) return;
    mutate(deleteAccount(state, current.id), "Đã xóa tài khoản.");
  }

  function addLimitedBanner() {
    const name = prompt("Tên gói/banner có thời hạn:");
    if (!name) return;
    mutate(createLimitedBanner(state, { name: name.trim() }), "Đã thêm gói hạn giờ.");
  }

  function submitFiveStar(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const heroName = String(form.get("heroName") || "").trim();
    if (!heroName) return;
    const date = String(form.get("date") || currentDate());
    const note = String(form.get("note") || "");
    const heroValueClass = String(form.get("heroValueClass") || "Chưa phân loại");
    const context = pendingFiveStar;
    pendingFiveStar = null;
    if (context.mode === "daily") {
      mutate(recordDailySlotFiveStar(state, {
        accountId: state.activeAccountId,
        date,
        slotKey: context.slotKey,
        heroName,
        note,
        heroValueClass,
      }), "Đã lưu tướng 5★.");
    } else {
      mutate(recordBannerFiveStar(state, {
        accountId: state.activeAccountId,
        bannerId: context.bannerId,
        pulls: Number(form.get("pulls")) || 1,
        heroName,
        note,
        date,
        heroValueClass,
      }), "Đã lưu tướng 5★.");
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
      const summary = validation.summary;
      const ok = confirm(`Ghi đè dữ liệu hiện tại?\nFile có ${summary.accounts} tài khoản, ${summary.banners} đợt chiêu mộ, ${summary.events} lượt quay.\nNên Xuất JSON sao lưu trước nếu chưa chắc.`);
      if (!ok) return;
      mutate(parsed, "Đã nhập JSON.");
    } catch {
      message = "File JSON không hợp lệ.";
      render();
    }
  }

  render();
  return { refresh, getState: () => state };
}
