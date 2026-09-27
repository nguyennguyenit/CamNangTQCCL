import { isAnalyzeConfigured } from "./config.js";
import { callWorker, compressImage, describeAnalyzeError } from "./analyze.js";
import { renderTurnstileWidget } from "./turnstile.js";
import { el, icon, svgNode } from "./render.js";
import { mapBuiltTeamsScan, mapHeroesScan, mapTacticsScan } from "./roster-scan-map.js";
import {
  ROSTER_SCAN_STORAGE_KEY,
  addCanonicalItem,
  applyScanResult,
  clearRosterScanState,
  deserializeRosterScanState,
  removeItem,
  removeLockedTeam,
  serializeRosterScanState,
} from "./roster-scan-state.js";
import { recommendTeams } from "./team-recommend-engine.js";
import { L, currentLocale } from "./i18n.js";
import { createRawNameResolver, localName } from "./website-display.js";

// `<html lang>` cố định theo trang nên nhãn dịch lúc nạp module vẫn đúng ngôn ngữ.
// `unit` dùng cho câu đếm tiếng Việt, `unitZh` là lượng từ + danh từ cho câu đếm tiếng Trung.
const SCAN_TYPES = [
  { id: "heroes", label: L("Tướng", "武将"), mode: "scanHeroes", unit: "tướng", unitZh: "名武将" },
  { id: "tactics", label: L("Chiến pháp", "战法"), mode: "scanTactics", unit: "chiến pháp", unitZh: "个战法" },
  { id: "builtTeams", label: L("Đội đã xây dựng", "已组建队伍"), mode: "scanBuiltTeams", unit: "đội", unitZh: "支队伍" },
];

const ROSTER_PROVIDER_ERROR = L("Không đọc được ảnh. Vui lòng thử lại.", "无法识别图片，请重试。");
const ROSTER_STATUS_LABELS = {
  "missing-tactic": L("Thiếu chiến pháp", "缺少战法"),
  "move-tactic": L("Cần điều chuyển chiến pháp", "需调配战法"),
  variant: L("Dùng biến thể", "使用替代配置"),
  "build-now": L("Có thể xây dựng ngay", "可立即组建"),
  locked: L("Đã khóa", "已锁定"),
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
        el("p", {}, L("Tính năng gợi ý đội từ kho chưa được cấu hình.", "“武将库配队”功能尚未配置。")),
        el("p", { class: "ana-note" }, L("Cần deploy Worker (worker/) + điền workerUrl & turnstileSiteKey trong js/config.js.", "需部署 Worker（worker/），并在 js/config.js 中填写 workerUrl 与 turnstileSiteKey。")),
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
  const tsStatus = el("p", { class: "ana-status err", role: "status", hidden: "" });
  // Bản zh hiển thị tên chữ Hán gốc; kho vẫn lưu tên Việt chuẩn nên chỉ đổi lúc vẽ.
  const zh = currentLocale() === "zh";
  const resolveRaw = createRawNameResolver(heroesDict, tacticsDict);
  const shown = (name) => localName(name, resolveRaw);
  // Tên đội trong dữ liệu chỉ có bản Việt: bản zh gọi đội bằng tên chữ Hán của các tướng trong đội.
  const teamLabel = (team) => {
    if (!zh || !team?.heroes?.length) return team?.name;
    return team.heroes.map((hero) => shown(typeof hero === "string" ? hero : hero?.name)).filter(Boolean).join(" · ");
  };
  // Gợi ý thêm thủ công: bản zh liệt kê tên chữ Hán; khi thêm, tên Hán được đổi về tên Việt chuẩn để kho
  // vẫn lưu cùng một dạng như ảnh đã đọc.
  const optionPairs = (dict) => (dict || []).filter((item) => item?.viet).map((item) => [shown(item.viet), item.viet]);
  const canonicalByShown = new Map([...optionPairs(heroesDict), ...optionPairs(tacticsDict)].reverse());
  const heroOptions = [...new Set(optionPairs(heroesDict).map(([label]) => label))].sort();
  const tacticOptions = [...new Set(optionPairs(tacticsDict).map(([label]) => label))].sort();
  const recommendBtn = el("button", { type: "button", class: "ana-btn primary", disabled: "" }, L("Gợi ý 5 đội", "推荐 5 支队伍"));
  const confirmBtn = el("button", { type: "button", class: "ana-btn", disabled: "" }, L("Xác nhận dữ liệu đã đọc", "确认识别结果"));
  const resultsSlot = el("div", { class: "roster-results-slot" });

  /* ---------- Bước 1–2–3: tóm tắt tiến trình đọc kho → kiểm tra → gợi ý ---------- */
  const stepNodes = [
    { key: "scan", label: L("Đọc kho", "识别库存") },
    { key: "review", label: L("Kiểm tra", "核对") },
    { key: "suggest", label: L("Gợi ý", "推荐") },
  ].map((step, index) => {
    const mark = el("span", { class: "roster-step-mark", "aria-hidden": "true" });
    return {
      ...step,
      mark,
      node: el("li", { class: "roster-step", dataset: { step: step.key } }, [mark, `${index + 1} · ${step.label}`]),
    };
  });
  const stepList = el("ol", { class: "roster-steps", "aria-label": L("Các bước", "步骤") }, stepNodes.map((step) => step.node));
  const scanned = () => (state.ownedHeroes?.length || 0) + (state.ownedTactics?.length || 0) + (state.lockedTeams?.length || 0) > 0;

  function paintSteps() {
    // Kho rỗng: chưa có gì để kiểm tra hay gợi ý, dù bản lưu cũ còn cờ đã xác nhận.
    const hasScan = scanned();
    const confirmed = hasScan && state.confirmed;
    const states = {
      scan: hasScan ? "done" : "current",
      review: confirmed ? "done" : hasScan ? "current" : "pending",
      suggest: confirmed && recommended ? "done" : confirmed ? "current" : "pending",
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
    // Ô chọn tệp hệ thống ẩn như `.ana-file` của Soi đội; nút "Chọn ảnh" mở hộp chọn tệp, tên tệp hiện cạnh nút.
    const titleId = `roster-scan-title-${scan.id}`;
    const fileInput = el("input", { type: "file", accept: "image/*", class: "ana-file", "aria-labelledby": titleId });
    const fileName = el("span", { class: "ana-file-name" });
    fileInput.addEventListener("change", () => {
      fileName.textContent = fileInput.files?.[0]?.name || "";
    });
    const pickBtn = el("button", { type: "button", class: "ana-btn", "aria-describedby": titleId, onClick: () => fileInput.click() }, L("Chọn ảnh", "选择图片"));
    const btn = el("button", { type: "button", class: "ana-btn" }, L(`Đọc ${scan.label}`, `识别${scan.label}`));
    const status = el("p", { class: "ana-note" }, "");
    const count = el("span", { class: "roster-scan-count" });
    const badge = el("span", { class: "badge roster-scan-state" });
    btn.addEventListener("click", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        status.textContent = L("Chọn ảnh trước.", "请先选择图片。");
        return;
      }
      if (!token) {
        status.textContent = L("Xác thực Turnstile trước.", "请先完成 Turnstile 验证。");
        return;
      }
      // Token Turnstile chỉ dùng được một lần: khoá cả ba nút trong lúc đọc để không
      // thẻ nào gửi lại token đang dùng.
      setScanBusy(true);
      status.textContent = L("Đang đọc ảnh...", "正在识别图片…");
      let sent = false;
      try {
        const imageDataUrl = await compressImage(file);
        // Lấy token và xoá ngay trong cùng một bước (không có await ở giữa).
        const scanToken = token;
        token = "";
        if (!scanToken) {
          status.textContent = L("Xác thực Turnstile trước.", "请先完成 Turnstile 验证。");
          return;
        }
        sent = true;
        const raw = await callWorker(imageDataUrl, scanToken, scan.mode);
        const mapped = scan.id === "heroes"
          ? mapHeroesScan(raw, { heroesDict, tacticsDict })
          : scan.id === "tactics"
            ? mapTacticsScan(raw, { heroesDict, tacticsDict })
            : mapBuiltTeamsScan(raw, { heroesDict, tacticsDict });
        state = applyScanResult(state, scan.id, mapped);
        saveState(state);
        // Đọc xong là thay đổi kho: huỷ kết quả gợi ý cũ và khoá lại nút cho tới khi xác nhận lại.
        rerender();
        status.textContent = L("Đã đọc xong. Kiểm tra lại dữ liệu bên dưới.", "识别完成，请核对下方数据。");
      } catch (err) {
        status.textContent = describeAnalyzeError(err, ROSTER_PROVIDER_ERROR);
      } finally {
        // Chỉ reset widget khi token đã thật sự gửi đi; nén ảnh lỗi thì token còn nguyên.
        if (sent && window.turnstile) window.turnstile.reset(tsBox);
        setScanBusy(false);
      }
    });
    const card = el("section", { class: "roster-scan-card" }, [
      el("header", { class: "roster-scan-head" }, [
        el("span", { class: "roster-step-caps" }, L(`BƯỚC ${index + 1}`, `第 ${index + 1} 步`)),
        badge,
      ]),
      el("h3", { class: "roster-scan-title", id: titleId }, scan.label),
      count,
      el("div", { class: "roster-file-row" }, [pickBtn, fileName]),
      fileInput,
      btn,
      status,
    ]);
    return { scan, card, status, count, badge, btn };
  });
  function setScanBusy(busy) {
    for (const control of scanControls) control.btn.disabled = busy;
  }

  function paintScanCards() {
    const counts = {
      heroes: state.ownedHeroes?.length || 0,
      tactics: state.ownedTactics?.length || 0,
      builtTeams: state.lockedTeams?.length || 0,
    };
    for (const control of scanControls) {
      const total = counts[control.scan.id] || 0;
      // Chưa đọc: chỉ dòng đếm báo "Chưa đọc"; pill "Xong" chỉ hiện khi đã đọc (Roster.dc.html thẻ BƯỚC 3).
      control.count.textContent = total ? L(`${total} ${control.scan.unit} đã đọc`, `已识别 ${total} ${control.scan.unitZh}`) : L("Chưa đọc", "未识别");
      control.badge.textContent = L("Xong", "完成");
      control.badge.hidden = !total;
    }
  }

  /* ---------- Kiểm tra kho: chip và nút thêm giữ nguyên nút/ô nhập khi cập nhật ---------- */
  function itemList(getItems, emptyText, type, onRemove) {
    const empty = el("p", { class: "roster-empty" }, emptyText);
    const list = el("ul", { class: "roster-chip-list" });
    function paint() {
      const items = getItems() || [];
      // Tên đọc từ ảnh độ tin thấp (không khớp từ điển, chỉ phiên âm) gắn dấu "kiểm tra" và lên đầu danh sách.
      const needsCheck = (item) => item?.confidence === "low";
      const ordered = [...items.filter(needsCheck), ...items.filter((item) => !needsCheck(item))];
      list.replaceChildren(...ordered.map((item) => {
        const name = item.name || item;
        const label = shown(name);
        const remove = el("button", { type: "button", class: "roster-remove", "aria-label": L(`Bỏ ${label}`, `移除${label}`) }, [closeIcon()]);
        remove.addEventListener("click", () => onRemove(type, name, remove));
        const flag = needsCheck(item) ? el("span", { class: "ana-flag" }, L("kiểm tra", "待核对")) : null;
        return el("li", needsCheck(item) ? { class: "roster-chip-check" } : {}, [el("span", {}, label), flag, remove]);
      }));
      list.hidden = items.length === 0;
      empty.hidden = items.length > 0;
    }
    return { list, empty, paint };
  }

  function teamList(getItems, onRemove) {
    const empty = el("p", { class: "roster-empty" }, L("Chưa có đội khóa. Đội khóa giữ nguyên tài nguyên đang dùng khi gợi ý.", "暂无锁定队伍。锁定队伍在推荐时会保留其正在使用的资源。"));
    const list = el("div", { class: "roster-locked-list" });
    function paint() {
      const items = getItems() || [];
      list.replaceChildren(...items.map((team, index) =>
        el("article", { class: "roster-locked-team" }, [
          el("strong", {}, team.teamName),
          el("p", {}, L(`Tướng: ${(team.heroes || []).join(", ") || "-"}`, `武将：${(team.heroes || []).map(shown).join("、") || "-"}`)),
          el("p", {}, L(`Chiến pháp: ${(team.tactics || []).join(", ") || "-"}`, `战法：${(team.tactics || []).map(shown).join("、") || "-"}`)),
          el("button", { type: "button", class: "ana-btn", "aria-label": L(`Bỏ đội ${team.teamName}`, `移除队伍 ${team.teamName}`), onClick: () => onRemove(index) }, L("Bỏ đội", "移除队伍")),
        ]),
      ));
      list.hidden = items.length === 0;
      empty.hidden = items.length > 0;
    }
    return { list, empty, paint };
  }

  function addControl(type, options) {
    const input = el("input", { class: "ana-input", type: "search", list: `roster-${type}-options`, placeholder: L("Thêm thủ công", "手动添加") });
    const datalist = el("datalist", { id: `roster-${type}-options` }, options.map((name) => el("option", { value: name })));
    const button = el("button", { type: "button", class: "ana-btn", onclick: () => {
      const value = input.value.trim();
      if (!value) return;
      addItem(type, canonicalByShown.get(value) ?? value);
      input.value = "";
    } }, L("Thêm", "添加"));
    return el("div", { class: "roster-add-row" }, [input, datalist, button]);
  }

  const heroList = itemList(() => state.ownedHeroes, L("Chưa đọc tướng.", "尚未识别武将。"), "heroes", removeItemAt);
  const tacticList = itemList(() => state.ownedTactics, L("Chưa đọc chiến pháp.", "尚未识别战法。"), "tactics", removeItemAt);
  const lockedList = teamList(() => state.lockedTeams, (index) => {
    state = removeLockedTeam(state, index);
    saveState(state);
    rerender();
  });
  const heroPanel = el("section", { class: "roster-review-panel" }, [
    el("h3", {}, L("Tướng đã đọc", "已识别武将")),
    heroList.list,
    heroList.empty,
    addControl("heroes", heroOptions),
  ]);
  const tacticPanel = el("section", { class: "roster-review-panel" }, [
    el("h3", {}, L("Chiến pháp đã đọc", "已识别战法")),
    tacticList.list,
    tacticList.empty,
    addControl("tactics", tacticOptions),
  ]);
  const lockedPanel = el("section", { class: "roster-review-panel" }, [
    el("h3", {}, L("Đội đang khóa", "锁定中的队伍")),
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
  }, L("Sửa kho đã đọc", "编辑已识别库存"));

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
    "aria-label": L("Ưu tiên gợi ý", "推荐优先级"),
    onChange: (event) => { preference = event.target.value; rerender(); },
  }, [
    el("option", { value: "meta" }, "Meta T0 → T1"),
    el("option", { value: "redStars" }, L("Nhiều hột", "红度优先")),
  ]);

  const clearBtn = el("button", { type: "button", class: "ana-btn", onClick: () => {
    if (!confirm(L("Xóa toàn bộ kho đã đọc (tướng, chiến pháp, đội khóa)? Không hoàn tác được.", "清空全部已识别库存（武将、战法、锁定队伍）？此操作无法撤销。"))) return;
    state = clearRosterScanState();
    saveState(state);
    rerender();
  } }, L("Xóa toàn bộ kho", "清空全部库存"));

  confirmBtn.addEventListener("click", () => {
    state = { ...serializeRosterScanState(state), confirmed: true, updatedAt: new Date().toISOString() };
    saveState(state);
    rerender();
  });

  recommendBtn.addEventListener("click", () => {
    if (!state.confirmed || !scanned()) return;
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
    confirmBtn.disabled = !scanned();
    recommendBtn.disabled = !(state.confirmed && scanned());
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
        el("strong", { class: "roster-result-name" }, teamLabel(entry.team) || L("Đội đã xây dựng", "已组建队伍")),
        el("span", { class: "roster-status", dataset: { status: entry.status || "locked" } }, ROSTER_STATUS_LABELS[entry.status] || ROSTER_STATUS_LABELS.locked),
        entry.tier ? el("p", { class: "roster-result-meta" }, L(`Bậc: ${entry.tier}`, `梯度：${entry.tier}`)) : null,
        entry.selectedTactics?.length ? el("p", { class: "roster-result-meta" }, L(`Chiến pháp: ${entry.selectedTactics.join(", ")}`, `战法：${entry.selectedTactics.map(shown).join("、")}`)) : null,
        entry.usedAlternatives?.length
          ? el("p", { class: "roster-result-meta" }, L(
            `Biến thể: ${entry.usedAlternatives.map((a) => `${a.from} -> ${a.to}`).join(", ")}`,
            `替代：${entry.usedAlternatives.map((a) => `${shown(a.from)} -> ${shown(a.to)}`).join("、")}`,
          ))
          : null,
      ]),
      entry.team && !entry.locked ? el("button", { type: "button", class: "ana-link-btn", onClick: () => onOpenTeam?.(entry.team) }, L("Mở đội", "查看队伍")) : null,
    ]);

    const portfolio = result.portfolioTeams || [];
    const addTeams = result.addTeams || [];
    return el("div", { class: "roster-results" }, [
      el("section", {}, [
        el("h3", {}, L("Danh sách đội sau khi xây dựng", "组建后的队伍列表")),
        ...(portfolio.length
          ? [el("ol", { class: "roster-team-list" }, portfolio.map(teamRow))]
          : [el("p", { class: "roster-empty" }, L("Chưa có đội nào xây dựng được từ kho hiện tại.", "当前库存暂无可组建的队伍。"))]),
      ]),
      el("section", {}, [
        el("h3", {}, L("Nên thêm", "建议新增")),
        ...(addTeams.length
          ? [el("ol", { class: "roster-team-list" }, addTeams.map(teamRow))]
          : [el("p", { class: "roster-empty" }, portfolio.length >= 5 ? L("Đã đủ 5 đội.", "已满 5 支队伍。") : L("Chưa có đội phù hợp để thêm từ kho hiện tại.", "当前库存暂无适合新增的队伍。"))]),
      ]),
      el("section", {}, [
        el("h3", {}, L("Đội mạnh nhưng chưa thể xây dựng", "强势但暂无法组建的队伍")),
        ...(result.blockedStrongTeams || []).slice(0, 5).map((entry) =>
          el("article", { class: "roster-result-team muted" }, [
            el("strong", { class: "roster-result-name" }, teamLabel(entry.team)),
            el("p", { class: "roster-result-meta" }, entry.missingHeroSlotNames?.length
              ? L(`Thiếu tướng: ${entry.missingHeroSlotNames.map((names) => names.join(" / ")).join(", ")}`, `缺少武将：${entry.missingHeroSlotNames.map((names) => names.map(shown).join(" / ")).join("、")}`)
              : L(`Thiếu chiến pháp: ${(entry.missingTactics || []).join(", ")}`, `缺少战法：${(entry.missingTactics || []).map(shown).join("、")}`)),
          ]),
        ),
      ]),
    ]);
  }

  renderTurnstileWidget(tsBox, {
    onToken: (tok) => {
      token = tok;
      tsStatus.hidden = true;
    },
    onExpire: () => { token = ""; },
    onError: (message) => {
      tsStatus.textContent = message;
      tsStatus.hidden = false;
    },
  }).catch(() => {
    tsBox.textContent = L("Không tải được Turnstile.", "Turnstile 加载失败。");
  });

  mount.replaceChildren(
    el("div", { class: "analyze-panel roster-recommend" }, [
      el("header", { class: "tool-head" }, [
        el("div", { class: "reference-head-text" }, [
          el("span", { class: "reference-kicker" }, L("Công cụ · Beta", "工具 · Beta")),
          el("h1", { class: "reference-title", tabindex: "-1" }, L("Gợi ý đội từ kho", "武将库配队")),
          el("p", { class: "reference-lead" }, L("Đọc ảnh kho tướng và chiến pháp, kiểm tra lại, rồi để công cụ cục bộ chọn tối đa 5 đội không trùng tài nguyên.", "识别武将与战法库存截图并核对后，由本地工具挑选最多 5 支资源不冲突的队伍。")),
        ]),
      ]),
      el("p", { class: "tool-notice" }, [
        el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
        el("span", {}, L("AI chỉ đọc ảnh. Đội được chọn bằng công cụ cục bộ từ dữ liệu đã tuyển chọn.", "AI 仅负责识别图片，队伍由本地工具依据精选数据挑选。")),
      ]),
      stepList,
      el("div", { class: "roster-controls" }, [
        tsBox,
        tsStatus,
        modeSelect,
        confirmBtn,
        recommendBtn,
        clearBtn,
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
