import { ANALYZE_CONFIG, isAnalyzeConfigured } from "./config.js";
import { callWorker, compressImage, loadTurnstile } from "./analyze.js";
import { el } from "./render.js";
import { mapBuiltTeamsScan, mapHeroesScan, mapTacticsScan } from "./roster-scan-map.js";
import {
  ROSTER_SCAN_STORAGE_KEY,
  addCanonicalItem,
  applyScanResult,
  createInitialRosterScanState,
  deserializeRosterScanState,
  removeItem,
  serializeRosterScanState,
} from "./roster-scan-state.js";
import { recommendTeams } from "./team-recommend-engine.js";

const SCAN_TYPES = [
  { id: "heroes", label: "Tướng", mode: "scanHeroes" },
  { id: "tactics", label: "Chiến pháp", mode: "scanTactics" },
  { id: "builtTeams", label: "Team đã build", mode: "scanBuiltTeams" },
];

function loadState() {
  return deserializeRosterScanState(localStorage.getItem(ROSTER_SCAN_STORAGE_KEY));
}

function saveState(state) {
  localStorage.setItem(ROSTER_SCAN_STORAGE_KEY, JSON.stringify(serializeRosterScanState(state)));
}

function itemList(items, emptyText, type, onRemove) {
  if (!items?.length) return el("p", { class: "roster-empty" }, emptyText);
  return el("ul", { class: "roster-chip-list" }, items.map((item) =>
    el("li", {}, [
      el("span", {}, item.name || item),
      onRemove ? el("button", { type: "button", class: "roster-remove", onclick: () => onRemove(type, item.name || item) }, "x") : null,
    ]),
  ));
}

function teamList(teams) {
  if (!teams?.length) return el("p", { class: "roster-empty" }, "Chưa có team khóa.");
  return el("div", { class: "roster-locked-list" }, teams.map((team) =>
    el("article", { class: "roster-locked-team" }, [
      el("strong", {}, team.teamName),
      el("p", {}, `Tướng: ${(team.heroes || []).join(", ") || "-"}`),
      el("p", {}, `Chiến pháp: ${(team.tactics || []).join(", ") || "-"}`),
    ]),
  ));
}

function addControl(type, options, onAdd) {
  const input = el("input", { class: "ana-input", type: "search", list: `roster-${type}-options`, placeholder: "Thêm thủ công" });
  const datalist = el("datalist", { id: `roster-${type}-options` }, options.map((name) => el("option", { value: name })));
  const button = el("button", { type: "button", class: "ana-btn", onclick: () => {
    const value = input.value.trim();
    if (!value) return;
    onAdd(type, value);
    input.value = "";
  } }, "Thêm");
  return el("div", { class: "roster-add-row" }, [input, datalist, button]);
}

function renderReview(state, { heroOptions = [], tacticOptions = [], onRemove, onAdd } = {}) {
  return el("div", { class: "roster-review-grid" }, [
    el("section", { class: "roster-review-panel" }, [
      el("h3", {}, "Tướng đã đọc"),
      itemList(state.ownedHeroes, "Chưa đọc tướng.", "heroes", onRemove),
      addControl("heroes", heroOptions, onAdd),
    ]),
    el("section", { class: "roster-review-panel" }, [
      el("h3", {}, "Chiến pháp đã đọc"),
      itemList(state.ownedTactics, "Chưa đọc chiến pháp.", "tactics", onRemove),
      addControl("tactics", tacticOptions, onAdd),
    ]),
    el("section", { class: "roster-review-panel" }, [
      el("h3", {}, "Team đang khóa"),
      teamList(state.lockedTeams),
    ]),
  ]);
}

function renderRecommendation(result, onOpenTeam) {
  const teamRow = (entry) => el("article", { class: "roster-result-team" }, [
    el("div", { class: "roster-result-head" }, [
      el("strong", {}, entry.team?.name || "Team đã build"),
      el("span", { class: "roster-status" }, entry.status || "locked"),
    ]),
    entry.tier ? el("p", {}, `Tier: ${entry.tier}`) : null,
    entry.selectedTactics?.length ? el("p", {}, `Chiến pháp: ${entry.selectedTactics.join(", ")}`) : null,
    entry.usedAlternatives?.length
      ? el("p", {}, `Biến thể: ${entry.usedAlternatives.map((a) => `${a.from} -> ${a.to}`).join(", ")}`)
      : null,
    entry.team && !entry.locked ? el("button", { type: "button", class: "ana-link-btn", onClick: () => onOpenTeam?.(entry.team) }, "Mở team") : null,
  ]);

  return el("div", { class: "roster-results" }, [
    el("section", {}, [
      el("h3", {}, "Portfolio sau khi build"),
      ...(result.portfolioTeams || []).map(teamRow),
    ]),
    el("section", {}, [
      el("h3", {}, "Nên thêm"),
      (result.addTeams || []).length ? (result.addTeams || []).map(teamRow) : [el("p", { class: "roster-empty" }, "Đã đủ 5 team hoặc chưa có team phù hợp.")],
    ]),
    el("section", {}, [
      el("h3", {}, "Team mạnh nhưng chưa build được"),
      ...(result.blockedStrongTeams || []).slice(0, 5).map((entry) =>
        el("article", { class: "roster-result-team muted" }, [
          el("strong", {}, entry.team.name),
          el("p", {}, entry.missingHeroes?.length ? `Thiếu tướng: ${entry.missingHeroes.join(", ")}` : `Thiếu chiến pháp: ${(entry.missingTactics || []).join(", ")}`),
        ]),
      ),
    ]),
  ]);
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
  let state = loadState();
  let token = "";
  let preference = "meta";
  const output = el("div", { class: "roster-output" });
  const tsBox = el("div", { class: "ana-turnstile" });
  const heroOptions = (heroesDict || []).map((h) => h.viet).filter(Boolean).sort();
  const tacticOptions = (tacticsDict || []).map((t) => t.viet).filter(Boolean).sort();
  let recommendBtn = null;

  const refreshRecommend = () => {
    if (recommendBtn) recommendBtn.disabled = !state.confirmed;
  };

  const rerender = () => {
    output.replaceChildren(renderReview(state, {
      heroOptions,
      tacticOptions,
      onRemove: (type, name) => {
        state = removeItem(state, type, name);
        saveState(state);
        rerender();
      },
      onAdd: (type, name) => {
        state = addCanonicalItem(state, type, name);
        saveState(state);
        rerender();
      },
    }));
    refreshRecommend();
  };

  const scanControls = SCAN_TYPES.map((scan) => {
    const fileInput = el("input", { type: "file", accept: "image/*" });
    const btn = el("button", { type: "button", class: "ana-btn" }, `Đọc ${scan.label}`);
    const status = el("p", { class: "ana-note" }, "");
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
        const raw = await callWorker(await compressImage(file), token, scan.mode);
        const mapped = scan.id === "heroes"
          ? mapHeroesScan(raw, { heroesDict, tacticsDict })
          : scan.id === "tactics"
            ? mapTacticsScan(raw, { heroesDict, tacticsDict })
            : mapBuiltTeamsScan(raw, { heroesDict, tacticsDict });
        state = applyScanResult(state, scan.id, mapped);
        saveState(state);
        rerender();
        status.textContent = "Đã đọc xong. Kiểm tra lại dữ liệu bên dưới.";
      } catch (err) {
        status.textContent = err.message || "Không đọc được ảnh.";
      } finally {
        token = "";
        if (window.turnstile) window.turnstile.reset(tsBox);
        btn.disabled = false;
      }
    });
    return el("section", { class: "roster-scan-card" }, [
      el("h3", {}, scan.label),
      fileInput,
      btn,
      status,
    ]);
  });

  loadTurnstile().then((ts) => {
    ts.render(tsBox, {
      sitekey: ANALYZE_CONFIG.turnstileSiteKey,
      callback: (tok) => { token = tok; },
      "expired-callback": () => { token = ""; },
    });
  }).catch(() => {
    tsBox.textContent = "Không tải được Turnstile.";
  });
  const modeSelect = el("select", {
    class: "ana-input",
    onChange: (event) => { preference = event.target.value; },
  }, [
    el("option", { value: "meta" }, "Meta T0 -> T1"),
    el("option", { value: "redStars" }, "Nhiều hột"),
  ]);
  const confirmBtn = el("button", { type: "button", class: "ana-btn" }, "Xác nhận dữ liệu scan");
  confirmBtn.addEventListener("click", () => {
    state = { ...serializeRosterScanState(state), confirmed: true, updatedAt: new Date().toISOString() };
    saveState(state);
    rerender();
  });
  recommendBtn = el("button", { type: "button", class: "ana-btn primary", disabled: "" }, "Gợi ý 5 team");
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
    output.replaceChildren(renderReview(state, {
      heroOptions,
      tacticOptions,
      onRemove: (type, name) => {
        state = removeItem(state, type, name);
        saveState(state);
        rerender();
      },
      onAdd: (type, name) => {
        state = addCanonicalItem(state, type, name);
        saveState(state);
        rerender();
      },
    }), renderRecommendation(result, onOpenTeam));
  });

  mount.replaceChildren(
    el("div", { class: "analyze-panel roster-recommend" }, [
      el("h2", {}, "Gợi ý đội từ kho"),
      el("p", { class: "ana-note" }, "AI chỉ đọc ảnh. Team được chọn bằng engine local từ dữ liệu đã curate."),
      el("div", { class: "roster-token-row" }, [tsBox, modeSelect, confirmBtn, recommendBtn]),
      el("div", { class: "roster-scan-grid" }, scanControls),
      output,
    ]),
  );
  rerender();
}
