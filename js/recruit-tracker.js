import { el } from "./render.js";
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

const SLOT_STATUS_LABEL = {
  pending: "Chưa quay",
  miss: "Không ra",
  fiveStar: "Ra 5★",
};

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

export function buildRecruitTrackerViewModel(summary, heroesDict = []) {
  const heroes = Array.isArray(heroesDict) ? heroesDict : Object.values(heroesDict || {});
  return {
    accountLabel: summary.account?.name || "Account",
    accounts: summary.accounts,
    heroOptions: uniqueSorted(heroes.map(heroName)),
    daily: {
      title: "Danh tướng PK - Hằng ngày",
      pityText: `${summary.daily.pity.pullsSinceFiveStar}/${summary.daily.pity.pityLimit}`,
      remainingText: `Còn ${summary.daily.pity.remaining} lượt`,
      todayText: `Hôm nay: ${summary.daily.todayDone}/4`,
      warning: summary.daily.pity.isOverLimit ? "Kiểm tra lại dữ liệu/game rule" : "",
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
      warning: item.pity.isOverLimit ? "Kiểm tra lại dữ liệu/game rule" : "",
    })),
    history: summary.history,
  };
}

export function initRecruitTracker({ heroesDict = [], mount, storage = localStorage } = {}) {
  if (!mount) return null;
  let state = loadRecruitTrackerState(storage);
  let pendingFiveStar = null;
  let message = "";
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

  function render() {
    const summary = getRecruitTrackerSummary(state, { date: currentDate() });
    const viewModel = buildRecruitTrackerViewModel(summary, heroesDict);
    mount.replaceChildren(
      el("div", { class: "rt-shell" }, [
        renderHeader(viewModel),
        message ? el("p", { class: "rt-message" }, message) : null,
        renderDaily(viewModel),
        renderLimited(viewModel),
        pendingFiveStar ? renderFiveStarForm(viewModel) : null,
        renderHistory(viewModel),
      ])
    );
  }

  function renderHeader(viewModel) {
    const select = el("select", {
      class: "rt-select",
      "aria-label": "Chọn account",
      onchange: (event) => mutate(setActiveAccount(state, event.target.value)),
    }, viewModel.accounts.map((account) => el("option", {
      value: account.id,
      selected: account.id === state.activeAccountId ? "selected" : null,
    }, account.name)));

    return el("section", { class: "rt-section rt-account-bar" }, [
      el("div", { class: "rt-account-main" }, [
        el("span", { class: "rt-kicker" }, "Account"),
        select,
      ]),
      el("div", { class: "rt-actions" }, [
        el("button", { class: "rt-btn", type: "button", onclick: addAccount }, "+ Account"),
        el("button", { class: "rt-btn", type: "button", onclick: renameActiveAccount }, "Đổi tên"),
        el("button", { class: "rt-btn", type: "button", onclick: deleteActiveAccount }, "Xóa acc"),
        el("button", { class: "rt-btn", type: "button", onclick: exportJson }, "Xuất JSON"),
        renderImportControl(),
      ]),
    ]);
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

  function renderDaily(viewModel) {
    return el("section", { class: "rt-section" }, [
      el("div", { class: "rt-section-head" }, [
        el("div", {}, [
          el("h2", {}, viewModel.daily.title),
          el("p", { class: "rt-sub" }, "Theo dõi 4 lượt miễn phí/nửa giá trong ngày."),
        ]),
        renderPity(viewModel.daily.pityText, viewModel.daily.remainingText, viewModel.daily.warning),
      ]),
      el("div", { class: "rt-daily-meta" }, viewModel.daily.todayText),
      el("div", { class: "rt-slot-grid" }, viewModel.daily.slots.map(renderDailySlot)),
    ]);
  }

  function renderDailySlot(slot) {
    const disabled = slot.status !== "pending" ? "disabled" : null;
    return el("div", { class: `rt-slot rt-slot-${slot.status}` }, [
      el("div", { class: "rt-slot-main" }, [
        el("span", { class: "rt-slot-label" }, slot.label),
        el("span", { class: "rt-slot-status" }, slot.statusLabel),
      ]),
      el("div", { class: "rt-slot-actions" }, [
        el("button", {
          class: "rt-btn rt-btn-small",
          type: "button",
          disabled,
          onclick: () => mutate(recordDailySlotMiss(state, {
            accountId: state.activeAccountId,
            date: currentDate(),
            slotKey: slot.key,
          })),
        }, "Không ra"),
        el("button", {
          class: "rt-btn rt-btn-small rt-primary",
          type: "button",
          disabled,
          onclick: () => openFiveStarForm({ mode: "daily", slotKey: slot.key, pulls: 1 }),
        }, "Ra 5★"),
      ]),
    ]);
  }

  function renderLimited(viewModel) {
    return el("section", { class: "rt-section" }, [
      el("div", { class: "rt-section-head" }, [
        el("div", {}, [
          el("h2", {}, "Gói hạn giờ / Đột xuất"),
          el("p", { class: "rt-sub" }, "Tạo riêng cho banner có hạn giờ hoặc gói theo giai đoạn."),
        ]),
        el("button", { class: "rt-btn rt-primary", type: "button", onclick: addLimitedBanner }, "+ Thêm gói"),
      ]),
      viewModel.limitedBanners.length
        ? el("div", { class: "rt-limited-list" }, viewModel.limitedBanners.map(renderLimitedBanner))
        : el("p", { class: "rt-empty" }, "Chưa có gói hạn giờ."),
    ]);
  }

  function renderLimitedBanner(item) {
    return el("article", { class: "rt-limited" }, [
      el("div", { class: "rt-limited-main" }, [
        el("strong", {}, item.name),
        renderPity(item.pityText, "", item.warning),
      ]),
      el("div", { class: "rt-actions" }, [
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
          class: "rt-btn rt-btn-small rt-primary",
          type: "button",
          onclick: () => openFiveStarForm({ mode: "limited", bannerId: item.id, bannerName: item.name, pulls: 1 }),
        }, "Ra 5★"),
      ]),
    ]);
  }

  function renderPity(pityText, remainingText, warning) {
    return el("div", { class: `rt-pity${warning ? " warn" : ""}` }, [
      el("span", { class: "rt-pity-label" }, "Pity 5★"),
      el("strong", {}, pityText),
      remainingText ? el("span", { class: "rt-sub" }, remainingText) : null,
      warning ? el("span", { class: "rt-warning" }, warning) : null,
    ]);
  }

  function renderFiveStarForm(viewModel) {
    const title = pendingFiveStar.mode === "daily"
      ? `Ghi 5★ · ${pendingFiveStar.slotKey}`
      : `Ghi 5★ · ${pendingFiveStar.bannerName}`;
    return el("section", { class: "rt-section rt-form-section" }, [
      el("div", { class: "rt-section-head" }, [
        el("h2", {}, title),
        el("button", { class: "rt-btn rt-btn-small", type: "button", onclick: closeFiveStarForm }, "Đóng"),
      ]),
      el("form", { class: "rt-form", onsubmit: submitFiveStar }, [
        el("label", {}, [
          el("span", {}, "Tướng"),
          el("input", { name: "heroName", list: "rt-hero-options", required: "required", autocomplete: "off", "data-hero-input": "true" }),
        ]),
        el("datalist", { id: "rt-hero-options" }, viewModel.heroOptions.map((name) => el("option", { value: name }))),
        el("label", {}, [
          el("span", {}, "Ngày"),
          el("input", { name: "date", type: "date", value: currentDate() }),
        ]),
        pendingFiveStar.mode === "limited" ? el("label", {}, [
          el("span", {}, "Số lượt"),
          el("input", { name: "pulls", type: "number", min: "1", value: "1" }),
        ]) : null,
        el("label", {}, [
          el("span", {}, "Phân loại"),
          el("select", { name: "heroValueClass" }, VALUE_CLASSES.map((item) => el("option", { value: item }, item))),
        ]),
        el("label", { class: "rt-form-wide" }, [
          el("span", {}, "Ghi chú"),
          el("input", { name: "note", autocomplete: "off" }),
        ]),
        el("button", { class: "rt-btn rt-primary", type: "submit" }, "Lưu 5★"),
      ]),
    ]);
  }

  function renderHistory(viewModel) {
    return el("section", { class: "rt-section" }, [
      el("div", { class: "rt-section-head" }, [
        el("div", {}, [
          el("h2", {}, "Lịch sử 5★"),
          el("p", { class: "rt-sub" }, "Mới nhất trước, lọc theo account đang chọn."),
        ]),
      ]),
      viewModel.history.length
        ? el("div", { class: "rt-history" }, viewModel.history.map(renderHistoryItem))
        : el("p", { class: "rt-empty" }, "Chưa ghi nhận tướng 5★."),
    ]);
  }

  function renderHistoryItem(item) {
    return el("article", { class: "rt-history-item" }, [
      el("div", { class: "rt-history-meta" }, [
        item.date,
        " · ",
        item.accountName,
        " · ",
        item.bannerName,
        item.drawSlot ? ` · ${item.drawSlot}` : "",
      ]),
      el("div", { class: "rt-history-hero" }, [
        el("strong", {}, item.heroName || "Tướng chưa ghi"),
        el("span", { class: "rt-sub" }, `lượt ${item.pullCount || item.pulls || 1}/30 · ${item.heroValueClass || "Chưa phân loại"}`),
      ]),
      item.note ? el("p", { class: "rt-note" }, item.note) : null,
    ]);
  }

  function addAccount() {
    const name = prompt("Tên account mới:");
    if (!name) return;
    mutate(createAccount(state, name.trim()), "Đã thêm account.");
  }

  function renameActiveAccount() {
    const current = state.accounts.find((account) => account.id === state.activeAccountId);
    const name = prompt("Tên account:", current?.name || "");
    if (!name) return;
    mutate(renameAccount(state, state.activeAccountId, name.trim()), "Đã đổi tên account.");
  }

  function deleteActiveAccount() {
    const current = state.accounts.find((account) => account.id === state.activeAccountId);
    if (!current || state.accounts.length <= 1) {
      message = "Cần giữ ít nhất 1 account.";
      render();
      return;
    }
    if (!confirm(`Xóa account "${current.name}" và dữ liệu chiêu mộ của account này?`)) return;
    mutate(deleteAccount(state, current.id), "Đã xóa account.");
  }

  function addLimitedBanner() {
    const name = prompt("Tên gói/banner hạn giờ:");
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
      const ok = confirm(`Ghi đè dữ liệu hiện tại?\nFile có ${summary.accounts} account, ${summary.banners} banner, ${summary.events} lượt quay.\nNên Xuất JSON backup trước nếu chưa chắc.`);
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
