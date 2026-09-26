import { ANALYZE_CONFIG, isAnalyzeConfigured } from "./config.js";
import { callWorker, compressImage, describeAnalyzeError, loadTurnstile } from "./analyze.js";
import { el, icon, svgNode } from "./render.js";
import { mapBuiltTeamsScan, mapHeroesScan, mapTacticsScan } from "./roster-scan-map.js";
import {
  ROSTER_SCAN_STORAGE_KEY,
  addCanonicalItem,
  applyScanResult,
  deserializeRosterScanState,
  removeItem,
  serializeRosterScanState,
} from "./roster-scan-state.js";
import { recommendTeams } from "./team-recommend-engine.js";

const SCAN_TYPES = [
  { id: "heroes", label: "Tướng", mode: "scanHeroes", unit: "tướng" },
  { id: "tactics", label: "Chiến pháp", mode: "scanTactics", unit: "chiến pháp" },
  { id: "builtTeams", label: "Đội đã xây dựng", mode: "scanBuiltTeams", unit: "đội" },
];

const ROSTER_PROVIDER_ERROR = "Không đọc được ảnh. Vui lòng thử lại.";
const ROSTER_STATUS_LABELS = {
  "missing-tactic": "Thiếu chiến pháp",
  "move-tactic": "Cần điều chuyển chiến pháp",
  variant: "Dùng biến thể",
  "build-now": "Có thể xây dựng ngay",
  locked: "Đã khóa",
};

/** Bề rộng hẹp: nút "Sửa kho đã đọc" mở/đóng khu kiểm tra kho. */
const COMPACT_QUERY = "(max-width: 680px)";

const shieldIcon = () => icon([
  svgNode("path", { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" }),
], { size: 16 });

const closeIcon = () => icon([
  svgNode("line", { x1: 6, y1: 6, x2: 18, y2: 18 }),
  svgNode("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
], { size: 12, stroke: 2.4 });

function loadState() {
  return deserializeRosterScanState(localStorage.getItem(ROSTER_SCAN_STORAGE_KEY));
}

function saveState(state) {
  localStorage.setItem(ROSTER_SCAN_STORAGE_KEY, JSON.stringify(serializeRosterScanState(state)));
}

export function initRosterRecommend({ teams, teamTier, heroesDict, tacticsDict, onOpenTeam }, mount) {
  if (!mount) return;
  if (!isAnalyzeConfigured()) {
    mount.replaceChildren(
      el("div", { class: "ana-setup" }, [
        el("p", {}, "Tính năng gợi ý đội từ kho chưa được cấu hình."),
        el("p", { class: "ana-note" }, "Cần deploy Worker (worker/) + điền workerUrl & turnstileSiteKey trong js/config.js."),
      ]),
    );
    return;
  }
  const doc = mount.ownerDocument ?? globalThis.document;
  const compact = globalThis.matchMedia?.(COMPACT_QUERY) ?? null;
  let state = loadState();
  let reviewExpanded = false;
  let recommended = false;
  let token = "";
  let preference = "meta";
  const tsBox = el("div", { class: "ana-turnstile" });
  const heroOptions = (heroesDict || []).map((h) => h.viet).filter(Boolean).sort();
  const tacticOptions = (tacticsDict || []).map((t) => t.viet).filter(Boolean).sort();
  const recommendBtn = el("button", { type: "button", class: "ana-btn primary", disabled: "" }, "Gợi ý 5 đội");
  const confirmBtn = el("button", { type: "button", class: "ana-btn" }, "Xác nhận dữ liệu đã đọc");
  const resultsSlot = el("div", { class: "roster-results-slot" });

  /* ---------- Bước 1–2–3: tóm tắt tiến trình đọc kho → kiểm tra → gợi ý ---------- */
  const stepNodes = [
    { key: "scan", label: "Đọc kho" },
    { key: "review", label: "Kiểm tra" },
    { key: "suggest", label: "Gợi ý" },
  ].map((step, index) => {
    const mark = el("span", { class: "roster-step-mark", "aria-hidden": "true" });
    return {
      ...step,
      mark,
      node: el("li", { class: "roster-step", dataset: { step: step.key } }, [mark, `${index + 1} · ${step.label}`]),
    };
  });
  const stepList = el("ol", { class: "roster-steps", "aria-label": "Các bước" }, stepNodes.map((step) => step.node));
  const scanned = () => (state.ownedHeroes?.length || 0) + (state.ownedTactics?.length || 0) + (state.lockedTeams?.length || 0) > 0;

  function paintSteps() {
    const states = {
      scan: scanned() ? "done" : "current",
      review: state.confirmed ? "done" : scanned() ? "current" : "pending",
      suggest: recommended ? "done" : state.confirmed ? "current" : "pending",
    };
    for (const step of stepNodes) {
      step.node.dataset.state = states[step.key];
      // Dấu ✓ chỉ hiện ở bước đã xong; bước đang làm được đánh dấu bằng `aria-current="step"`.
      step.mark.hidden = states[step.key] !== "done";
      if (states[step.key] === "current") step.node.setAttribute("aria-current", "step");
      else step.node.removeAttribute("aria-current");
    }
  }

  /* ---------- Ba thẻ đọc ảnh: đếm kết quả đã đọc, trạng thái Xong / Chưa đọc ---------- */
  const scanControls = SCAN_TYPES.map((scan, index) => {
    // Ô chọn ảnh native giữ nhãn hệ thống (chấp nhận ở Phase 9) nhưng phải có tên truy cập được:
    // trỏ `aria-labelledby` vào chính tiêu đề thẻ, không thêm chuỗi UI mới.
    const titleId = `roster-scan-title-${scan.id}`;
    const fileInput = el("input", { type: "file", accept: "image/*", "aria-labelledby": titleId });
    const btn = el("button", { type: "button", class: "ana-btn" }, `Đọc ${scan.label}`);
    const status = el("p", { class: "ana-note" }, "");
    const count = el("span", { class: "roster-scan-count" });
    const badge = el("span", { class: "badge roster-scan-state" });
    btn.addEventListener("click", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        status.textContent = "Chọn ảnh trước.";
        return;
      }
      if (!token) {
        status.textContent = "Xác thực Turnstile trước.";
        return;
      }
      btn.disabled = true;
      status.textContent = "Đang đọc ảnh...";
      try {
        const imageDataUrl = await compressImage(file);
        const raw = await callWorker(imageDataUrl, token, scan.mode);
        const mapped = scan.id === "heroes"
          ? mapHeroesScan(raw, { heroesDict, tacticsDict })
          : scan.id === "tactics"
            ? mapTacticsScan(raw, { heroesDict, tacticsDict })
            : mapBuiltTeamsScan(raw, { heroesDict, tacticsDict });
        state = applyScanResult(state, scan.id, mapped);
        saveState(state);
        // Đọc xong là thay đổi kho: huỷ kết quả gợi ý cũ và khoá lại nút cho tới khi xác nhận lại.
        rerender();
        status.textContent = "Đã đọc xong. Kiểm tra lại dữ liệu bên dưới.";
      } catch (err) {
        status.textContent = describeAnalyzeError(err, ROSTER_PROVIDER_ERROR);
      } finally {
        token = "";
        if (window.turnstile) window.turnstile.reset(tsBox);
        btn.disabled = false;
      }
    });
    const card = el("section", { class: "roster-scan-card" }, [
      el("header", { class: "roster-scan-head" }, [
        el("span", { class: "roster-step-caps" }, `BƯỚC ${index + 1}`),
        badge,
      ]),
      el("h3", { class: "roster-scan-title", id: titleId }, scan.label),
      count,
      fileInput,
      btn,
      status,
    ]);
    return { scan, card, status, count, badge };
  });

  function paintScanCards() {
    const counts = {
      heroes: state.ownedHeroes?.length || 0,
      tactics: state.ownedTactics?.length || 0,
      builtTeams: state.lockedTeams?.length || 0,
    };
    for (const control of scanControls) {
      const total = counts[control.scan.id] || 0;
      // Chưa đọc: chỉ dòng đếm báo "Chưa đọc"; pill "Xong" chỉ hiện khi đã đọc (Roster.dc.html thẻ BƯỚC 3).
      control.count.textContent = total ? `${total} ${control.scan.unit} đã đọc` : "Chưa đọc";
      control.badge.textContent = "Xong";
      control.badge.hidden = !total;
    }
  }

  /* ---------- Kiểm tra kho: chip và nút thêm giữ nguyên nút/ô nhập khi cập nhật ---------- */
  function itemList(getItems, emptyText, type, onRemove) {
    const empty = el("p", { class: "roster-empty" }, emptyText);
    const list = el("ul", { class: "roster-chip-list" });
    function paint() {
      const items = getItems() || [];
      list.replaceChildren(...items.map((item) => {
        const name = item.name || item;
        const remove = el("button", { type: "button", class: "roster-remove", "aria-label": `Bỏ ${name}` }, [closeIcon()]);
        remove.addEventListener("click", () => onRemove(type, name, remove));
        return el("li", {}, [el("span", {}, name), remove]);
      }));
      list.hidden = items.length === 0;
      empty.hidden = items.length > 0;
    }
    return { list, empty, paint };
  }

  function teamList(getItems) {
    const empty = el("p", { class: "roster-empty" }, "Chưa có đội khóa. Đội khóa giữ nguyên tài nguyên đang dùng khi gợi ý.");
    const list = el("div", { class: "roster-locked-list" });
    function paint() {
      const items = getItems() || [];
      list.replaceChildren(...items.map((team) =>
        el("article", { class: "roster-locked-team" }, [
          el("strong", {}, team.teamName),
          el("p", {}, `Tướng: ${(team.heroes || []).join(", ") || "-"}`),
          el("p", {}, `Chiến pháp: ${(team.tactics || []).join(", ") || "-"}`),
        ]),
      ));
      list.hidden = items.length === 0;
      empty.hidden = items.length > 0;
    }
    return { list, empty, paint };
  }

  function addControl(type, options) {
    const input = el("input", { class: "ana-input", type: "search", list: `roster-${type}-options`, placeholder: "Thêm thủ công" });
    const datalist = el("datalist", { id: `roster-${type}-options` }, options.map((name) => el("option", { value: name })));
    const button = el("button", { type: "button", class: "ana-btn", onclick: () => {
      const value = input.value.trim();
      if (!value) return;
      addItem(type, value);
      input.value = "";
    } }, "Thêm");
    return el("div", { class: "roster-add-row" }, [input, datalist, button]);
  }

  const heroList = itemList(() => state.ownedHeroes, "Chưa đọc tướng.", "heroes", removeItemAt);
  const tacticList = itemList(() => state.ownedTactics, "Chưa đọc chiến pháp.", "tactics", removeItemAt);
  const lockedList = teamList(() => state.lockedTeams);
  const heroPanel = el("section", { class: "roster-review-panel" }, [
    el("h3", {}, "Tướng đã đọc"),
    heroList.list,
    heroList.empty,
    addControl("heroes", heroOptions),
  ]);
  const tacticPanel = el("section", { class: "roster-review-panel" }, [
    el("h3", {}, "Chiến pháp đã đọc"),
    tacticList.list,
    tacticList.empty,
    addControl("tactics", tacticOptions),
  ]);
  const lockedPanel = el("section", { class: "roster-review-panel" }, [
    el("h3", {}, "Đội đang khóa"),
    lockedList.list,
    lockedList.empty,
  ]);
  const reviewArea = el("div", { class: "roster-review", id: "roster-review-area" }, [
    el("div", { class: "roster-review-grid" }, [heroPanel, tacticPanel, lockedPanel]),
  ]);

  const toggleReviewBtn = el("button", {
    type: "button",
    class: "rt-btn roster-review-toggle",
    "aria-controls": "roster-review-area",
    onclick: () => {
      reviewExpanded = !reviewExpanded;
      applyReviewVisibility();
    },
  }, "Sửa kho đã đọc");

  function applyReviewVisibility() {
    const collapsed = Boolean(compact?.matches) && !reviewExpanded;
    reviewArea.hidden = collapsed;
    toggleReviewBtn.setAttribute("aria-expanded", String(!collapsed));
  }

  function syncReview() {
    // Chỉ chip và danh sách đổi: panel, ô nhập và nút thêm giữ nguyên nút nên bàn phím không mất focus.
    heroList.paint();
    tacticList.paint();
    lockedList.paint();
    paintScanCards();
    paintSteps();
  }

  function removeItemAt(type, name, button) {
    const list = button.closest(".roster-chip-list");
    const buttons = list ? [...list.querySelectorAll(".roster-remove")] : [];
    const index = buttons.indexOf(button);
    const hadFocus = doc.activeElement === button;
    state = removeItem(state, type, name);
    saveState(state);
    rerender();
    if (!hadFocus) return;
    // Nút vừa bấm biến mất theo chip: chuyển focus sang chip kế tiếp, lùi về ô nhập khi hết chip.
    const panel = type === "heroes" ? heroPanel : tacticPanel;
    const nextButtons = [...panel.querySelectorAll(".roster-remove")];
    const target = nextButtons[index] || nextButtons[index - 1] || panel.querySelector(".roster-add-row input");
    target?.focus();
  }

  function addItem(type, name) {
    state = addCanonicalItem(state, type, name);
    saveState(state);
    rerender();
  }

  const modeSelect = el("select", {
    class: "ana-input",
    "aria-label": "Ưu tiên gợi ý",
    onChange: (event) => { preference = event.target.value; rerender(); },
  }, [
    el("option", { value: "meta" }, "Meta T0 → T1"),
    el("option", { value: "redStars" }, "Nhiều hột"),
  ]);

  confirmBtn.addEventListener("click", () => {
    state = { ...serializeRosterScanState(state), confirmed: true, updatedAt: new Date().toISOString() };
    saveState(state);
    rerender();
  });

  recommendBtn.addEventListener("click", () => {
    if (!state.confirmed) return;
    const result = recommendTeams({
      teams,
      teamTier,
      ownedHeroes: state.ownedHeroes,
      ownedTactics: state.ownedTactics,
      lockedTeams: state.lockedTeams,
      mode: preference,
      keepExistingTeams: true,
      fullBox: state.ownedHeroes.length > 40 && state.ownedTactics.length > 60,
    });
    resultsSlot.replaceChildren(renderRecommendation(result, onOpenTeam));
    recommended = true;
    paintSteps();
  });

  const refreshRecommend = () => {
    recommendBtn.disabled = !state.confirmed;
  };

  const rerender = () => {
    syncReview();
    resultsSlot.replaceChildren();
    recommended = false;
    paintSteps();
    refreshRecommend();
  };

  function renderRecommendation(result, onOpenTeam) {
    const teamRow = (entry, index) => el("li", { class: "roster-result-team" }, [
      el("span", { class: "roster-rank", "aria-hidden": "true" }, String(index + 1)),
      el("div", { class: "roster-result-main" }, [
        el("strong", { class: "roster-result-name" }, entry.team?.name || "Đội đã xây dựng"),
        el("span", { class: "roster-status", dataset: { status: entry.status || "locked" } }, ROSTER_STATUS_LABELS[entry.status] || "Đã khóa"),
        entry.tier ? el("p", { class: "roster-result-meta" }, `Bậc: ${entry.tier}`) : null,
        entry.selectedTactics?.length ? el("p", { class: "roster-result-meta" }, `Chiến pháp: ${entry.selectedTactics.join(", ")}`) : null,
        entry.usedAlternatives?.length
          ? el("p", { class: "roster-result-meta" }, `Biến thể: ${entry.usedAlternatives.map((a) => `${a.from} -> ${a.to}`).join(", ")}`)
          : null,
      ]),
      entry.team && !entry.locked ? el("button", { type: "button", class: "ana-link-btn", onClick: () => onOpenTeam?.(entry.team) }, "Mở đội") : null,
    ]);

    const portfolio = result.portfolioTeams || [];
    const addTeams = result.addTeams || [];
    return el("div", { class: "roster-results" }, [
      el("section", {}, [
        el("h3", {}, "Danh sách đội sau khi xây dựng"),
        ...(portfolio.length
          ? [el("ol", { class: "roster-team-list" }, portfolio.map(teamRow))]
          : [el("p", { class: "roster-empty" }, "Chưa có đội nào xây dựng được từ kho hiện tại.")]),
      ]),
      el("section", {}, [
        el("h3", {}, "Nên thêm"),
        ...(addTeams.length
          ? [el("ol", { class: "roster-team-list" }, addTeams.map(teamRow))]
          : [el("p", { class: "roster-empty" }, "Đã đủ 5 đội hoặc chưa có đội phù hợp.")]),
      ]),
      el("section", {}, [
        el("h3", {}, "Đội mạnh nhưng chưa thể xây dựng"),
        ...(result.blockedStrongTeams || []).slice(0, 5).map((entry) =>
          el("article", { class: "roster-result-team muted" }, [
            el("strong", { class: "roster-result-name" }, entry.team.name),
            el("p", { class: "roster-result-meta" }, entry.missingHeroes?.length ? `Thiếu tướng: ${entry.missingHeroes.join(", ")}` : `Thiếu chiến pháp: ${(entry.missingTactics || []).join(", ")}`),
          ]),
        ),
      ]),
    ]);
  }

  loadTurnstile().then((ts) => {
    ts.render(tsBox, {
      sitekey: ANALYZE_CONFIG.turnstileSiteKey,
      callback: (tok) => { token = tok; },
      "expired-callback": () => { token = ""; },
    });
  }).catch(() => {
    tsBox.textContent = "Không tải được Turnstile.";
  });

  mount.replaceChildren(
    el("div", { class: "analyze-panel roster-recommend" }, [
      el("header", { class: "tool-head" }, [
        el("div", { class: "reference-head-text" }, [
          el("span", { class: "reference-kicker" }, "Công cụ · Beta"),
          el("h1", { class: "reference-title", tabindex: "-1" }, "Gợi ý đội từ kho"),
          el("p", { class: "reference-lead" }, "Đọc ảnh kho tướng và chiến pháp, kiểm tra lại, rồi để công cụ cục bộ chọn tối đa 5 đội không trùng tài nguyên."),
        ]),
      ]),
      el("p", { class: "tool-notice" }, [
        el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
        el("span", {}, "AI chỉ đọc ảnh. Đội được chọn bằng công cụ cục bộ từ dữ liệu đã tuyển chọn."),
      ]),
      stepList,
      el("div", { class: "roster-controls" }, [
        tsBox,
        modeSelect,
        confirmBtn,
        recommendBtn,
      ]),
      el("div", { class: "roster-scan-grid" }, scanControls.map((control) => control.card)),
      toggleReviewBtn,
      reviewArea,
      resultsSlot,
    ]),
  );
  rerender();
  compact?.addEventListener?.("change", applyReviewVisibility);
  applyReviewVisibility();
}
