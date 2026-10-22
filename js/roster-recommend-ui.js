import { isAnalyzeConfigured } from "./config.js";
import { callWorker, callWorkerExplain, compressImage, describeAnalyzeError } from "./analyze.js";
import { renderTurnstileWidget } from "./turnstile.js";
import { el, icon, svgNode } from "./render.js";
import { mapBuiltTeamsScan, mapHeroesScan, mapTacticsScan } from "./roster-scan-map.js";
import {
  MAX_LOCKED_TEAMS,
  MAX_TACTIC_OVERRIDES,
  ROSTER_SCAN_STORAGE_KEY,
  addCanonicalItem,
  applyScanResult,
  clearRosterScanState,
  deserializeRosterScanState,
  removeItem,
  removeLockedTeam,
  serializeRosterScanState,
  setTacticOverride,
  tacticOverrideBlocked,
} from "./roster-scan-state.js";
import { analyzeTacticSubstitutes, buildSeasonCandidates, recommendRoster, seasonTacticUsage } from "./roster-season-candidates.js";
import { buildTacticRules } from "./team-recommend-engine.js";
import { readRecommendedQuery, tacticDisplayName } from "./recommended-reference-state.js";
import { seasonNameText, seasonOptionText, seasonOptionTitle } from "./team-filter-section.js";
import { L, currentLocale } from "./i18n.js";
import { createRawNameResolver, localName } from "./website-display.js";
import { describeError } from "./community-api.js";
import { boxes, toScanState } from "./roster-cloud-store.js";
import { createScanWriter } from "./roster-scan-writer.js";
import { createRosterIdResolver } from "./roster-id-resolve.js";
import { DEFAULT_KINDS, createRosterSync } from "./roster-sync.js";
import { addPicked, buildCatalog, createPicker, removePicked } from "./roster-picker.js";
import { createSaveButton } from "./my-teams-save-button.js";

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
  unreconciled: L("Còn ô chưa đối chiếu", "有未核对的战法"),
  incompatible: L("Không tương thích luật đội", "与队伍规则不兼容"),
  locked: L("Đã khóa", "已锁定"),
};
const MODE_LABELS = { meta: "Meta T0 → T1", redStars: L("Nhiều hột", "红度优先") };
/** Lý do một món bù phạm luật đội (mã từ `tacticRuleViolation`). */
const RULE_REASON_LABELS = {
  "formation-limit": { vi: "đội đã có một trận pháp", zh: "队伍已有一个阵法" },
  "troop-limit": { vi: "đội đã có một binh chủng", zh: "队伍已有一个兵种战法" },
  "troop-unit-mismatch": { vi: "binh chủng không hợp loại binh của đội", zh: "兵种战法与队伍兵种不符" },
  "troop-unit-unknown": { vi: "nguồn không ghi loại binh của đội", zh: "来源未标明队伍兵种" },
};
/** Số chip hiện trước khi bấm "Hiện tất cả" (Roster.dc.html: "48 tướng · hiện 16", "63 chiến pháp · hiện 12"). */
const CHIP_LIMITS = { heroes: 16, tactics: 12 };
const MAX_TEAMS = 5;

/* ---------- Icon nét theo artboard (aria-hidden) ---------- */
const paths = (...list) => list.map((d) => svgNode("path", { d }));
const checkIcon = (size = 16) => icon(paths("M5 12l5 5L20 7"), { size });
const uploadIcon = () => icon(paths("M12 16V4", "M7 9l5-5 5 5", "M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"), { size: 16 });
const imageIcon = () => icon([
  svgNode("rect", { x: 3, y: 5, width: 18, height: 14, rx: 2 }),
  svgNode("circle", { cx: 9, cy: 10, r: 1.8 }),
  ...paths("M21 16l-5-5-8 8"),
], { size: 22 });
const closeIcon = () => icon(paths("M6 6l12 12", "M18 6L6 18"), { size: 14 });
const plusIcon = () => icon(paths("M12 5v14", "M5 12h14"), { size: 16 });
const lockIcon = () => icon([svgNode("rect", { x: 5, y: 11, width: 14, height: 10, rx: 2 }), ...paths("M8 11V7a4 4 0 0 1 8 0v4")], { size: 18 });
const trashIcon = () => icon(paths("M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"), { size: 16 });
const sparkIcon = (size = 16) => icon(paths("M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"), { size });
const pencilIcon = () => icon(paths("M4 20h4L19 9l-4-4L4 16z"), { size: 16 });
const arrowIcon = () => icon(paths("M5 12h14", "M13 6l6 6-6 6"), { size: 15 });
const swapIcon = () => icon(paths("M7 7h11l-3-3", "M17 17H6l3 3"), { size: 16 });
const warnIcon = () => icon(paths("M12 3l10 18H2z", "M12 10v4", "M12 17.5v.1"), { size: 16 });
const questionIcon = () => icon([svgNode("circle", { cx: 12, cy: 12, r: 9 }), ...paths("M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6", "M12 17v.1")], { size: 16 });
const historyIcon = () => icon(paths("M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5", "M12 8v4l3 2"), { size: 17 });
const shieldIcon = () => icon(paths("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"), { size: 17 });

const pill = (text, tone, extra = {}) => el("span", { class: "roster-pill", ...extra, dataset: { tone, ...(extra.dataset || {}) } }, text);

function loadState() {
  return deserializeRosterScanState(localStorage.getItem(ROSTER_SCAN_STORAGE_KEY));
}

function saveState(state) {
  localStorage.setItem(ROSTER_SCAN_STORAGE_KEY, JSON.stringify(serializeRosterScanState(state)));
}

/* ---------- Đồng bộ kho theo hộp (chỉ khi đã đăng nhập) ---------- */
const BOX_STORAGE_KEY = "tqccl.roster.box.v1";
const SYNC_STATUS_TEXT = {
  syncing: L("Đang đồng bộ…", "正在同步…"),
  synced: L("Đã đồng bộ với tài khoản.", "已与账号同步。"),
  offline: L("Chưa có kết nối. Thay đổi được giữ trên máy và sẽ đồng bộ khi có mạng.", "当前无网络连接。修改会保留在本机，联网后自动同步。"),
  error: L("Chưa đồng bộ được lúc này. Thay đổi vẫn được giữ trên máy.", "暂时无法同步。修改仍保留在本机。"),
  // "signed-out" và "mismatch" chỉ hiện qua cảnh báo `role="alert"` (có nút hành động), không lặp ở dòng trạng thái.
};
const REJECT_REASONS = {
  bytes: L("nội dung quá dài", "内容过长"),
  schema: L("dữ liệu không hợp lệ", "数据无效"),
  clock_skew: L("đồng hồ máy lệch so với máy chủ", "本机时间与服务器相差过大"),
  box_missing: L("hộp kho không còn tồn tại", "库存盒已不存在"),
  quota: L("tài khoản đã đủ số bản ghi tối đa", "账号已达记录数量上限"),
  cap: L("đã đủ số lượng tối đa", "已达数量上限"),
  retained_cap: L("tài khoản đã đủ số bản ghi lưu giữ tối đa", "账号已达保留记录上限"),
};

/** Nội dung kho (không kể ảnh đã đọc và cờ xác nhận) dưới dạng chuỗi so sánh, không phụ thuộc thứ tự món. */
function inventorySignature(scan) {
  const items = (list) => (list || []).map((item) => `${item.name}|${Number.isFinite(item.redStars) ? item.redStars : ""}`).sort();
  return JSON.stringify([
    items(scan?.ownedHeroes),
    items(scan?.ownedTactics),
    (scan?.lockedTeams || []).map((team) => JSON.stringify([team.teamName, team.heroes, team.tactics, team.teamId ?? "", team.configId ?? ""])).sort(),
    (scan?.tacticOverrides || []).map((item) => `${item.teamId}|${item.heroIndex}|${item.slotIndex}|${item.tactic}`).sort(),
    scan?.seasonId ?? null,
  ]);
}

const hasLocalInventory = (scan) =>
  Boolean(scan?.ownedHeroes?.length || scan?.ownedTactics?.length || scan?.lockedTeams?.length || scan?.tacticOverrides?.length || scan?.seasonId);

/** Tên các món không đẩy được (ngoài từ điển, quá trần byte) để báo "chỉ có trên máy này". */
const localOnlyList = (localOnly) => [...(localOnly?.heroes || []), ...(localOnly?.tactics || []), ...(localOnly?.lockedTeams || []), ...(localOnly?.overrides || [])];

const recordLabel = (record) => record?.data?.name || record?.data?.teamName || record?.data?.tactic || record?.data?.seasonId || record?.id || "";

/** "vừa xong" / "2 phút trước" cho lần đọc ảnh gần nhất. */
function relativeTime(iso, locale) {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 60) return L("vừa xong", "刚刚");
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 3600) return format.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return format.format(-Math.floor(seconds / 3600), "hour");
  return format.format(-Math.floor(seconds / 86400), "day");
}

export function initRosterRecommend({ teams, teamTier, heroesDict, tacticsDict, loadRecommended, onOpenTeam }, mount) {
  if (!mount) return;
  // Gợi ý đội chạy bằng công cụ cục bộ nên không phụ thuộc Worker AI: chưa cấu hình thì chỉ thiếu đọc ảnh và nút "Vì sao?".
  const aiReady = isAnalyzeConfigured();
  const doc = mount.ownerDocument ?? globalThis.document;
  let state = loadState();
  /** Màn đang hiện: "review" = đọc kho + kiểm tra (Roster.dc.html), "result" = danh sách gợi ý (RosterResult.dc.html). */
  let stage = "review";
  let token = "";
  let preference = "meta";
  let scanBusy = false;
  const tsBox = el("div", { class: "ana-turnstile" });
  const tsStatus = el("p", { class: "ana-status err", role: "status", hidden: "" });
  // Bản zh hiển thị tên chữ Hán gốc; kho vẫn lưu tên Việt chuẩn nên chỉ đổi lúc vẽ.
  const zh = currentLocale() === "zh";
  const resolveRaw = createRawNameResolver(heroesDict, tacticsDict);
  const tacticRules = buildTacticRules(tacticsDict);
  const shown = (name) => localName(name, resolveRaw);
  const joinNames = (names) => names.map(shown).join(" · ");
  // Tên chiến pháp lưu trong dữ liệu đội: bản vi hiện `viet` hiện hành của danh mục; bản zh như `shown`.
  const tacticShown = (name) => (zh ? shown(name) : tacticDisplayName(name));
  const joinTactics = (names) => names.map(tacticShown).join(" · ");
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
  const recommendBtn = el("button", { type: "button", class: "ana-btn primary", disabled: "" }, [sparkIcon(), L("Gợi ý 5 đội", "推荐 5 支队伍")]);
  const confirmBtn = el("button", { type: "button", class: "ana-btn", disabled: "" }, [checkIcon(), L("Xác nhận dữ liệu đã đọc", "确认识别结果")]);
  const resultsSlot = el("div", { class: "roster-results-slot" });

  /* ---------- Đồng bộ kho: khách giữ kho local như cũ; đã đăng nhập dùng kho của hộp đang chọn ---------- */
  const idResolver = createRosterIdResolver({ heroesDict, tacticsDict });
  /**
   * "guest": kho local · "loading": đã có phiên, đang kéo kho tài khoản · "cloud": kho của hộp đang chọn ·
   * "readonly": hết phiên (401) hoặc chưa tải được kho, chỉ đọc, KHÔNG chuyển sang kho local ·
   * "locked": tài khoản đã đổi ở tab khác, phải nạp lại phiên.
   */
  let mode = "guest";
  let boxId = null;
  let syncStatus = "guest";
  let localOnlyNames = [];
  const editControls = [];
  let picker = null;
  const canEdit = () => mode === "guest" || mode === "cloud";
  const paintEditable = () => {
    for (const control of editControls) control.disabled = !canEdit();
    picker?.setDisabled(!canEdit());
  };

  const syncLine = el("p", { class: "roster-sync-status", role: "status" });
  const syncAlerts = el("div", { class: "roster-sync-alerts" });
  const boxSelect = el("select", { class: "ana-input", id: "roster-box" });
  const boxField = el("div", { class: "roster-field roster-box-control", hidden: "" }, [
    el("label", { class: "roster-field-label", for: "roster-box" }, L("Hộp kho", "库存盒")),
    boxSelect,
  ]);
  const syncBar = el("section", { class: "roster-sync", "aria-label": L("Đồng bộ kho", "库存同步"), hidden: "" }, [boxField, syncLine, syncAlerts]);

  /** Mỗi cảnh báo là một `role="alert"` riêng; chỉ cảnh báo mới/đổi chữ mới được chèn lại để không đọc lặp. */
  const alertNodes = new Map();
  function setAlert(key, text, action) {
    const old = alertNodes.get(key);
    if (old?.dataset.text === text) return;
    const node = el("p", { class: "roster-sync-alert", role: "alert", dataset: { text } }, [
      el("span", {}, text),
      action ? el("button", { type: "button", class: "roster-ghost", onClick: action.run }, action.label) : null,
    ]);
    if (old) old.replaceWith(node);
    else syncAlerts.append(node);
    alertNodes.set(key, node);
  }
  function clearAlert(key) {
    alertNodes.get(key)?.remove();
    alertNodes.delete(key);
  }
  const dismissAction = (key, after) => ({ label: L("Đã hiểu", "知道了"), run: () => { clearAlert(key); after?.(); } });

  function showConflict({ key, loser }) {
    const label = recordLabel(loser);
    const alertKey = `conflict:${key}`;
    setAlert(alertKey, L(`Bản mới hơn từ thiết bị khác đã thay thế chỉnh sửa của bạn với “${label}”.`, `其他设备上更新的版本已替换你对“${label}”的修改。`), dismissAction(alertKey));
  }
  function showRejected(item) {
    const label = recordLabel(item.record);
    const reason = REJECT_REASONS[item.code] || L("bị từ chối", "被拒绝");
    const alertKey = `rejected:${item.key}`;
    setAlert(
      alertKey,
      L(`Không đồng bộ được “${label}” (${reason}). Nội dung vẫn giữ trên máy này.`, `无法同步“${label}”（${reason}）。内容仍保留在本机。`),
      dismissAction(alertKey, () => sync.dismissRejected(item.key)),
    );
  }

  function guardEdit() {
    if (canEdit()) return true;
    setScanStatus(
      mode === "loading" ? L("Đang tải kho từ tài khoản…", "正在从账号加载库存…") : L("Kho tài khoản đang ở chế độ chỉ đọc.", "账号库存当前为只读。"),
      "err",
    );
    return false;
  }

  function paintSync() {
    paintEditable();
    syncBar.hidden = mode === "guest";
    if (mode === "guest") return;
    const cloudState = sync.state();
    const list = cloudState ? boxes(cloudState) : [];
    boxSelect.replaceChildren(...list.map((box) => el("option", { value: box.id }, box.name)));
    if (boxId) boxSelect.value = boxId;
    boxField.hidden = list.length < 2;
    const base = mode === "loading" ? L("Đang tải kho từ tài khoản…", "正在从账号加载库存…") : SYNC_STATUS_TEXT[syncStatus] || "";
    const extra = localOnlyNames.length
      ? L(
        ` ${localOnlyNames.length} món chỉ có trên máy này, chưa đồng bộ: ${localOnlyNames.slice(0, 5).join(", ")}${localOnlyNames.length > 5 ? "…" : ""}.`,
        ` ${localOnlyNames.length} 项仅存在于本机，尚未同步：${localOnlyNames.slice(0, 5).join("、")}${localOnlyNames.length > 5 ? "…" : ""}。`,
      )
      : "";
    syncLine.textContent = `${base}${extra}`;
    syncLine.dataset.status = syncStatus;
    if (syncStatus === "signed-out") {
      setAlert("session", L("Phiên đăng nhập đã hết. Kho tài khoản chỉ đọc; thay đổi mới chưa được lưu.", "登录已过期。账号库存为只读，新的修改尚未保存。"), {
        label: L("Đăng nhập lại", "重新登录"),
        run: async () => {
          const error = await sync.signIn();
          if (error) setScanStatus(describeError(error), "err");
        },
      });
    } else if (syncStatus === "mismatch") {
      setAlert("session", L("Tài khoản đăng nhập đã đổi ở tab khác. Tải lại trang để tiếp tục.", "登录账号已在其他标签页更换。请重新加载页面后继续。"), {
        label: L("Tải lại trang", "重新加载页面"),
        run: () => location.reload(),
      });
    } else if (mode === "readonly" && !list.length) {
      setAlert("session", L("Chưa tải được kho từ tài khoản. Kiểm tra kết nối rồi tải lại trang.", "尚未能从账号加载库存。请检查网络后重新加载页面。"), {
        label: L("Tải lại trang", "重新加载页面"),
        run: () => location.reload(),
      });
    } else {
      clearAlert("session");
    }
  }

  const preferredBox = (list) => {
    let stored = null;
    try {
      stored = localStorage.getItem(BOX_STORAGE_KEY);
    } catch {
      // Storage bị chặn: dùng hộp mặc định.
    }
    return [stored, "main"].find((id) => list.some((box) => box.id === id)) || list[0].id;
  };

  /** Nạp kho của hộp đang chọn từ cache cloud vào `state` (giữ ảnh đã đọc/cờ xác nhận); trả `true` khi nội dung kho đổi. */
  function refreshFromCloud() {
    const cloudState = sync.state();
    const list = cloudState ? boxes(cloudState) : [];
    if (!list.length) return false;
    if (!list.some((box) => box.id === boxId)) boxId = preferredBox(list);
    const next = toScanState(cloudState, boxId);
    const changed = inventorySignature(next) !== inventorySignature(state);
    state = { ...next, scans: state.scans, confirmed: changed ? false : state.confirmed, updatedAt: state.updatedAt };
    writer.rebase(next);
    return changed;
  }

  async function applySeasonFromState() {
    await seasonReady;
    if (state.seasonId && seasonOptions.has(state.seasonId) && season?.id !== state.seasonId) selectSeason(state.seasonId);
  }

  /** Lần đầu có kho cloud của user này: hỏi gộp kho local (cờ theo userId), bảo đảm có hộp `main`, rồi chuyển sang kho cloud. */
  async function enterCloud() {
    const local = loadState();
    if (sync.mergeStatus() === "none" && hasLocalInventory(local)) {
      if (confirm(L("Gộp kho trên máy này vào tài khoản?\nChọn Hủy nếu đây là máy dùng chung với người khác.", "要把本机的库存合并到账号吗？\n如果这是与他人共用的设备，请选择取消。"))) {
        const merged = await sync.mergeLocal(local, idResolver);
        if (merged.ok) localOnlyNames = localOnlyList(merged.localOnly);
      } else {
        sync.declineMerge();
      }
    }
    if (!(sync.state() && boxes(sync.state()).length)) await sync.ensureMainBox();
    if (mode !== "loading") return;
    mode = "cloud";
    state = { ...state, scans: {} };
    refreshFromCloud();
    for (const item of sync.rejected()) showRejected(item);
    await applySeasonFromState();
    rerender();
  }

  /** Không kéo được (mất mạng / hết phiên) nhưng cache của user này còn: xem kho cache, không rơi về kho local. */
  function enterFromCache(next) {
    state = { ...state, scans: {} };
    refreshFromCloud();
    const usable = Boolean(sync.state() && boxes(sync.state()).length);
    mode = next === "signed-out" || !usable ? "readonly" : "cloud";
    applySeasonFromState().then(() => rerender());
  }

  async function onSyncStatus(next) {
    syncStatus = next;
    try {
      if (mode === "guest" && next !== "guest" && sync.user()) mode = "loading";
      if (next === "synced" && mode === "loading") await enterCloud();
      else if (mode === "loading" && (next === "offline" || next === "error" || next === "signed-out")) enterFromCache(next);
      else if (next === "signed-out" && mode === "cloud") mode = "readonly";
      else if (next === "mismatch") mode = "locked";
    } catch {
      // Lỗi dựng UI không được làm hỏng vòng đồng bộ.
    } finally {
      paintSync();
    }
  }

  function applyCloudChange() {
    // Đang ghi: nạp lại lúc này sẽ kéo `state` lùi về trước thao tác kế tiếp; `persist` nạp lại khi lần ghi cuối xong.
    if (writer.busy()) return paintSync();
    const changed = refreshFromCloud();
    paintSync();
    if (!changed) return;
    applySeasonFromState().then(() => rerender());
  }

  const sync = createRosterSync({
    kinds: DEFAULT_KINDS,
    storage: localStorage,
    onStatus: (status) => void onSyncStatus(status),
    onChange: () => {
      if (mode === "cloud") applyCloudChange();
    },
    onConflict: showConflict,
    onRejected: (items) => items.forEach(showRejected),
    onMismatch: () => {
      mode = "locked";
      paintSync();
    },
  });

  const writer = createScanWriter({ sync, resolve: idResolver, boxId: () => boxId });

  boxSelect.addEventListener("change", () => {
    if (mode !== "cloud" || !boxes(sync.state()).some((box) => box.id === boxSelect.value)) return;
    boxId = boxSelect.value;
    try {
      localStorage.setItem(BOX_STORAGE_KEY, boxId);
    } catch {
      // Storage bị chặn: chọn hộp chỉ còn hiệu lực trong phiên này.
    }
    state = { ...state, scans: {}, confirmed: false };
    refreshFromCloud();
    applySeasonFromState().then(() => rerender());
  });

  /** Khách: lưu local như cũ. Đã đăng nhập: ghi chênh lệch vào hộp đang chọn rồi đồng bộ nền; chỉ đọc thì bỏ qua. */
  function persist(next) {
    if (mode === "guest") {
      saveState(next);
      return;
    }
    if (mode !== "cloud") return;
    writer.write(next).then(({ outcome, localOnly, idle }) => {
      if (outcome.ok) localOnlyNames = localOnlyList(localOnly);
      // Chỉ nạp lại khi không còn lần ghi nào đang chờ (kể cả thay đổi từ cloud bị hoãn trong lúc ghi).
      if (idle && refreshFromCloud()) rerender();
      paintSync();
    });
  }

  /* ---------- Mùa bạn đang chơi: đội chuẩn của mùa là nguồn chính, đội cũ chỉ lấp chỗ trống ---------- */
  // `season` = { id, teams, teamTier, usage } của mùa đang chọn; null khi chưa tải hoặc tải lỗi.
  let season = null;
  let seasonRecords = [];
  const seasonOptions = new Map();
  const seasonSelect = el("select", { class: "ana-input", id: "roster-season", disabled: "" }, [
    el("option", { value: "" }, L("Đang tải mùa…", "正在加载赛季…")),
  ]);
  const seasonNote = el("p", { class: "ana-status err roster-season-note", role: "status", hidden: "" });
  const seasonField = el("div", { class: "roster-field roster-season-control" }, [
    el("label", { class: "roster-field-label", for: "roster-season" }, L("Mùa bạn đang chơi", "你正在玩的赛季")),
    seasonSelect,
    el("p", { class: "roster-field-hint" }, L("Gợi ý từ Đội chuẩn của mùa này; thiếu đội thì lấy đội cũ để tham khảo.", "按本赛季推荐阵容推荐；不足时补充旧阵容作参考。")),
    seasonNote,
  ]);
  function selectSeason(id) {
    season = { id, ...buildSeasonCandidates(seasonRecords, id, { heroesDict, tacticsDict }) };
    season.usage = seasonTacticUsage(season.teams);
    seasonSelect.value = id;
  }
  seasonSelect.addEventListener("change", () => {
    if (!guardEdit()) {
      if (season) seasonSelect.value = season.id;
      return;
    }
    selectSeason(seasonSelect.value);
    state = { ...state, seasonId: season.id };
    persist(state);
    // Mùa ghi trên URL để link chia sẻ mở đúng mùa; replaceState không thêm bước lịch sử.
    const url = new URL(location.href);
    url.searchParams.set("season", season.id);
    history.replaceState(history.state, "", url);
    rerender();
  });
  const seasonReady = Promise.resolve(loadRecommended ? loadRecommended() : Promise.reject(new Error("no recommended")))
    .then((model) => {
      const registry = model.seasons || {};
      const options = registry.seasonOptions || [];
      seasonRecords = model.index?.records || [];
      for (const item of options) seasonOptions.set(item.sourceSeasonId, item);
      // URL > mùa đã lưu > mặc định của site; giá trị lạ về mặc định.
      const explicit = new URL(location.href).searchParams.has("season");
      const fromUrl = explicit ? readRecommendedQuery(location.href, registry).season : null;
      const id = [fromUrl, state.seasonId, registry.defaultSourceSeasonId].find((value) => seasonOptions.has(value)) || options[0]?.sourceSeasonId;
      if (!id) throw new Error("no seasons");
      seasonSelect.replaceChildren(...options.map((item) => el("option", { value: item.sourceSeasonId, title: seasonOptionTitle(item) }, seasonOptionText(item))));
      seasonSelect.disabled = false;
      selectSeason(id);
    })
    .catch(() => {
      season = null;
      seasonSelect.replaceChildren(el("option", { value: "" }, L("Không có dữ liệu mùa", "暂无赛季数据")));
      seasonNote.textContent = L("Không tải được đội chuẩn theo mùa. Gợi ý tạm dùng đội cũ để tham khảo.", "无法加载赛季推荐阵容，暂以旧阵容作参考推荐。");
      seasonNote.hidden = false;
    });

  /* ---------- Ưu tiên gợi ý: hai nút radio dạng phân đoạn ---------- */
  const modeField = el("fieldset", { class: "roster-field roster-mode" }, [
    el("legend", { class: "roster-field-label" }, L("Ưu tiên gợi ý", "推荐优先级")),
    el("div", { class: "roster-seg" }, Object.entries(MODE_LABELS).map(([value, label]) => {
      const input = el("input", { type: "radio", name: "roster-mode", value, class: "roster-seg-input" });
      input.checked = value === preference;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        preference = value;
        rerender();
      });
      return el("label", { class: "roster-seg-option" }, [input, el("span", {}, label)]);
    })),
  ]);
  const settings = el("section", { class: "roster-settings", "aria-label": L("Thiết lập gợi ý", "推荐设置") }, [
    seasonField,
    modeField,
    el("p", { class: "tool-notice" }, [
      el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
      el("span", {}, aiReady
        ? L("AI chỉ đọc ảnh, và chỉ giải thích món bù khi bạn hỏi. Đội được chọn bằng công cụ cục bộ từ dữ liệu đã tuyển chọn.", "AI 仅负责识别图片，并只在你询问时解释替代战法；队伍由本地工具依据精选数据挑选。")
        : L("Đội được chọn bằng công cụ cục bộ từ dữ liệu đã tuyển chọn. Đọc ảnh và giải thích bằng AI đang tạm tắt.", "队伍由本地工具依据精选数据挑选。截图识别与 AI 解释功能暂时关闭。")),
    ]),
  ]);

  /* ---------- Dải 3 bước: Đọc kho → Kiểm tra → Gợi ý ---------- */
  const flowSteps = [
    { key: "scan", label: L("Đọc kho", "识别库存") },
    { key: "review", label: L("Kiểm tra", "核对") },
    { key: "suggest", label: L("Gợi ý", "推荐") },
  ].map((step, index) => {
    const mark = el("span", { class: "ana-flow-mark", "aria-hidden": "true" }, String(index + 1));
    return { ...step, index, mark, node: el("li", { class: "ana-flow-step", dataset: { step: step.key } }, [mark, el("span", { class: "ana-flow-label" }, step.label)]) };
  });
  const flow = el("ol", { class: "ana-flow roster-flow", "aria-label": L("Các bước", "步骤") }, flowSteps.map((step) => step.node));
  const scanned = () => (state.ownedHeroes?.length || 0) + (state.ownedTactics?.length || 0) + (state.lockedTeams?.length || 0) > 0;

  function paintSteps() {
    // Kho rỗng: chưa có gì để kiểm tra hay gợi ý, dù bản lưu cũ còn cờ đã xác nhận.
    const hasScan = scanned();
    const confirmed = hasScan && state.confirmed;
    const states = {
      scan: hasScan ? "done" : "current",
      review: confirmed ? "done" : hasScan ? "current" : "pending",
      suggest: confirmed ? "current" : "pending",
    };
    for (const step of flowSteps) {
      const value = states[step.key];
      step.node.dataset.state = value;
      step.mark.replaceChildren(value === "done" ? checkIcon(15) : String(step.index + 1));
      if (value === "current") step.node.setAttribute("aria-current", "step");
      else step.node.removeAttribute("aria-current");
    }
  }

  /* ---------- Ba thẻ đọc ảnh: chọn ảnh là đọc ngay; "Đọc lại" gửi lại ảnh vừa chọn ---------- */
  const scanStatus = el("p", { class: "ana-status roster-scan-status", role: "status" });
  function setScanStatus(text, kind = "") {
    scanStatus.dataset.kind = kind;
    scanStatus.replaceChildren(...(text ? [kind === "ok" ? checkIcon() : null, el("span", {}, text)].filter(Boolean) : []));
  }
  const scanControls = (aiReady ? SCAN_TYPES : []).map((scan, index) => {
    // Ô chọn tệp hệ thống ẩn như `.ana-file` của Soi đội; nút "Chọn ảnh" mở hộp chọn tệp.
    const titleId = `roster-scan-title-${scan.id}`;
    const fileInput = el("input", { type: "file", accept: "image/*", class: "ana-file", "aria-labelledby": titleId });
    const control = { scan, file: null };
    const pickBtn = el("button", { type: "button", class: "ana-btn", "aria-describedby": titleId, onClick: () => fileInput.click() }, [uploadIcon(), L("Chọn ảnh", "选择图片")]);
    editControls.push(pickBtn);
    const readBtn = el("button", { type: "button", class: "roster-ghost", disabled: "" });
    const count = el("span", { class: "roster-pill roster-scan-count" });
    const previewText = el("span", {});
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      // Chọn lại cùng tệp vẫn phải phát `change`: xoá giá trị sau khi giữ tệp.
      fileInput.value = "";
      if (!file) return;
      control.file = file;
      readScan(control);
    });
    readBtn.addEventListener("click", () => readScan(control));
    const card = el("section", { class: "roster-scan-card", "aria-labelledby": titleId }, [
      el("header", { class: "roster-scan-head" }, [
        el("span", { class: "roster-scan-heading" }, [
          el("span", { class: "roster-step-caps" }, L(`Bước ${index + 1}`, `第 ${index + 1} 步`)),
          el("h3", { class: "roster-scan-title", id: titleId }, scan.label),
        ]),
        count,
      ]),
      el("div", { class: "roster-scan-preview" }, [imageIcon(), previewText]),
      el("div", { class: "roster-scan-actions" }, [pickBtn, readBtn]),
      fileInput,
    ]);
    return Object.assign(control, { card, count, previewText, readBtn });
  });

  async function readScan(control) {
    const { scan, file } = control;
    if (!file || scanBusy || !guardEdit()) return;
    if (!token) {
      setScanStatus(L("Xác thực Turnstile trước.", "请先完成 Turnstile 验证。"), "err");
      paintScanCards();
      return;
    }
    // Token Turnstile chỉ dùng được một lần: khoá cả ba thẻ trong lúc đọc để không thẻ nào gửi lại token đang dùng.
    scanBusy = true;
    control.busy = true;
    paintScanCards();
    setScanStatus(L("Đang đọc ảnh...", "正在识别图片…"));
    let sent = false;
    try {
      const imageDataUrl = await compressImage(file);
      // Lấy token và xoá ngay trong cùng một bước (không có await ở giữa).
      const scanToken = token;
      token = "";
      if (!scanToken) {
        setScanStatus(L("Xác thực Turnstile trước.", "请先完成 Turnstile 验证。"), "err");
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
      const droppedTeams = state.droppedLockedTeams || 0;
      delete state.droppedLockedTeams;
      persist(state);
      // Đọc xong là thay đổi kho: huỷ kết quả gợi ý cũ và khoá lại nút cho tới khi xác nhận lại.
      rerender();
      if (droppedTeams) {
        const limitKey = "limit";
        setAlert(
          limitKey,
          L(`Mỗi hộp chỉ giữ tối đa ${MAX_LOCKED_TEAMS} đội khóa: đã bỏ ${droppedTeams} đội cũ nhất.`, `每个库存盒最多保留 ${MAX_LOCKED_TEAMS} 支锁定队伍：已移除最早的 ${droppedTeams} 支。`),
          dismissAction(limitKey),
        );
      }
      setScanStatus(L("Đã đọc xong. Kiểm tra lại dữ liệu bên dưới.", "识别完成，请核对下方数据。"), "ok");
    } catch (err) {
      setScanStatus(describeAnalyzeError(err, ROSTER_PROVIDER_ERROR), "err");
    } finally {
      // Chỉ reset widget khi token đã thật sự gửi đi; nén ảnh lỗi thì token còn nguyên.
      if (sent && window.turnstile) window.turnstile.reset(tsBox);
      scanBusy = false;
      control.busy = false;
      paintScanCards();
    }
  }

  function paintScanCards() {
    const counts = {
      heroes: state.ownedHeroes?.length || 0,
      tactics: state.ownedTactics?.length || 0,
      builtTeams: state.lockedTeams?.length || 0,
    };
    for (const control of scanControls) {
      const { scan } = control;
      const total = counts[scan.id] || 0;
      const done = total > 0;
      control.count.dataset.tone = done ? "good" : "neutral";
      control.count.replaceChildren(...(done
        ? [checkIcon(13), L(`${total} ${scan.unit} đã đọc`, `已识别 ${total} ${scan.unitZh}`)]
        : [L("Chưa đọc", "未识别")]));
      const record = state.scans?.[scan.id];
      control.previewText.textContent = control.busy
        ? L("Đang đọc ảnh…", "正在识别图片…")
        : record
          ? L(`${record.images} ảnh · ${relativeTime(record.at, "vi")}`, `${record.images} 张图片 · ${relativeTime(record.at, "zh")}`)
          : control.file
            ? L(`Đã chọn ${control.file.name}`, `已选择 ${control.file.name}`)
            : L("Chưa có ảnh", "尚无图片");
      const again = Boolean(record);
      control.readBtn.textContent = again ? L("Đọc lại", "重新识别") : L("Đọc ảnh", "识别图片");
      control.readBtn.setAttribute("aria-label", again ? L(`Đọc lại ảnh ${scan.label}`, `重新识别${scan.label}图片`) : L(`Đọc ảnh ${scan.label}`, `识别${scan.label}图片`));
      control.readBtn.disabled = scanBusy || !control.file || !canEdit();
    }
  }

  /* ---------- Kiểm tra kho: chip và nút thêm giữ nguyên nút/ô nhập khi cập nhật ---------- */
  function itemList(type, getItems, emptyText) {
    const scan = SCAN_TYPES.find((item) => item.id === type);
    const limit = CHIP_LIMITS[type];
    let expanded = false;
    const count = el("span", { class: "roster-panel-count" });
    const empty = el("p", { class: "roster-empty" }, emptyText);
    const list = el("ul", { class: "roster-chip-list" });
    const more = el("button", { type: "button", class: "roster-ghost roster-more", onClick: () => { expanded = !expanded; paint(); } });
    function paint() {
      const items = getItems() || [];
      // Tên đọc từ ảnh độ tin thấp (không khớp từ điển, chỉ phiên âm) gắn dấu "kiểm tra" và lên đầu danh sách.
      const needsCheck = (item) => item?.confidence === "low";
      const ordered = [...items.filter(needsCheck), ...items.filter((item) => !needsCheck(item))];
      const visible = expanded ? ordered : ordered.slice(0, limit);
      list.replaceChildren(...visible.map((item) => {
        const name = item.name || item;
        const label = type === "tactics" ? tacticShown(name) : shown(name);
        const remove = el("button", { type: "button", class: "roster-remove", "aria-label": L(`Bỏ ${label}`, `移除${label}`), disabled: canEdit() ? null : "" }, [closeIcon()]);
        remove.addEventListener("click", () => removeItemAt(type, name, remove));
        const flag = needsCheck(item) ? el("span", { class: "ana-flag" }, L("kiểm tra", "待核对")) : null;
        return el("li", needsCheck(item) ? { class: "roster-chip-check" } : {}, [el("span", {}, label), flag, remove]);
      }));
      const truncated = visible.length < items.length;
      count.textContent = truncated
        ? L(`${items.length} ${scan.unit} · hiện ${visible.length}`, `${items.length} ${scan.unitZh} · 显示 ${visible.length}`)
        : L(`${items.length} ${scan.unit}`, `${items.length} ${scan.unitZh}`);
      more.hidden = items.length <= limit;
      more.textContent = expanded ? L("Thu gọn", "收起") : L(`Hiện tất cả ${items.length}`, `显示全部 ${items.length}`);
      more.setAttribute("aria-expanded", String(expanded));
      list.hidden = items.length === 0;
      empty.hidden = items.length > 0;
    }
    return { count, list, empty, more, paint };
  }

  function addControl(type, options, placeholder) {
    const input = el("input", { class: "ana-input", type: "search", list: `roster-${type}-options`, placeholder, "aria-label": placeholder });
    const datalist = el("datalist", { id: `roster-${type}-options` }, options.map((name) => el("option", { value: name })));
    const button = el("button", { type: "button", class: "ana-btn", onclick: () => {
      const value = input.value.trim();
      if (!value) return;
      addItem(type, canonicalByShown.get(value) ?? value);
      input.value = "";
    } }, [plusIcon(), L("Thêm", "添加")]);
    editControls.push(input, button);
    return el("div", { class: "roster-add-row" }, [input, datalist, button]);
  }

  const reviewPanel = (title, list, add) => el("section", { class: "roster-review-panel" }, [
    el("div", { class: "roster-panel-head" }, [el("h3", {}, title), list.count]),
    list.list,
    list.empty,
    list.more,
    add,
  ]);
  const heroList = itemList("heroes", () => state.ownedHeroes, L("Chưa đọc tướng.", "尚未识别武将。"));
  const tacticList = itemList("tactics", () => state.ownedTactics, L("Chưa đọc chiến pháp.", "尚未识别战法。"));
  const heroPanel = reviewPanel(L("Tướng đã đọc", "已识别武将"), heroList, addControl("heroes", heroOptions, L("Thêm tướng ảnh chưa đọc ra…", "添加截图未识别的武将…")));
  const tacticPanel = reviewPanel(L("Chiến pháp đã đọc", "已识别战法"), tacticList, addControl("tactics", tacticOptions, L("Thêm chiến pháp…", "添加战法…")));

  const lockedCount = el("span", { class: "roster-panel-count" });
  const lockedItems = el("ul", { class: "roster-locked-list" });
  const lockedEmpty = el("p", { class: "roster-empty" }, L("Chưa có đội khóa.", "暂无锁定队伍。"));
  const lockedPanel = el("section", { class: "roster-review-panel roster-locked-panel" }, [
    el("div", { class: "roster-panel-head" }, [el("h3", {}, L("Đội đang khóa", "锁定中的队伍")), lockedCount]),
    lockedItems,
    lockedEmpty,
    el("p", { class: "roster-locked-note" }, L("Đội khóa giữ nguyên tài nguyên đang dùng khi gợi ý.", "锁定队伍在推荐时会保留其正在使用的资源。")),
  ]);
  function paintLocked() {
    const items = state.lockedTeams || [];
    lockedItems.replaceChildren(...items.map((team, index) => el("li", { class: "roster-locked-team" }, [
      el("span", { class: "roster-locked-icon", "aria-hidden": "true" }, [lockIcon()]),
      el("span", { class: "roster-locked-body" }, [
        el("strong", { class: "roster-locked-name" }, team.teamName),
        el("span", { class: "roster-locked-heroes" }, L(`Tướng: ${team.heroes?.length ? joinNames(team.heroes) : "-"}`, `武将：${team.heroes?.length ? joinNames(team.heroes) : "-"}`)),
        el("span", { class: "roster-locked-tactics" }, L(`Chiến pháp: ${team.tactics?.length ? joinTactics(team.tactics) : "-"}`, `战法：${team.tactics?.length ? joinTactics(team.tactics) : "-"}`)),
      ]),
      el("button", {
        type: "button",
        class: "roster-ghost roster-danger",
        disabled: canEdit() ? null : "",
        "aria-label": L(`Bỏ đội ${team.teamName}`, `移除队伍 ${team.teamName}`),
        onClick: () => {
          if (!guardEdit()) return;
          state = removeLockedTeam(state, index);
          persist(state);
          rerender();
        },
      }, L("Bỏ đội", "移除队伍")),
    ])));
    lockedCount.textContent = L(`${items.length} đội`, `${items.length} 支队伍`);
    lockedItems.hidden = items.length === 0;
    lockedEmpty.hidden = items.length > 0;
  }

  const reviewTitle = el("h2", { class: "roster-section-title", id: "roster-review-title", tabindex: "-1" }, L("Kiểm tra kho đã đọc", "核对已识别库存"));
  const reviewArea = el("section", { class: "roster-review", id: "roster-review-area", "aria-labelledby": "roster-review-title" }, [
    el("div", { class: "roster-section-head" }, [
      reviewTitle,
      el("p", { class: "roster-section-lead" }, L("Bỏ món đọc sai, thêm món ảnh chưa đọc ra, rồi xác nhận để gợi ý.", "移除识别错误的项目，补充截图未识别的项目，确认后即可推荐。")),
    ]),
    el("div", { class: "roster-review-grid" }, [heroPanel, tacticPanel]),
    lockedPanel,
  ]);

  function syncReview() {
    // Chỉ chip và danh sách đổi: panel, ô nhập và nút thêm giữ nguyên nút nên bàn phím không mất focus.
    heroList.paint();
    tacticList.paint();
    paintLocked();
    paintScanCards();
    paintSteps();
    picker?.refresh();
  }

  function removeItemAt(type, name, button) {
    const list = button.closest(".roster-chip-list");
    const buttons = list ? [...list.querySelectorAll(".roster-remove")] : [];
    const index = buttons.indexOf(button);
    const hadFocus = doc.activeElement === button;
    if (!guardEdit()) return;
    state = removeItem(state, type, name);
    persist(state);
    rerender();
    if (!hadFocus) return;
    // Nút vừa bấm biến mất theo chip: chuyển focus sang chip kế tiếp, lùi về ô nhập khi hết chip.
    const panel = type === "heroes" ? heroPanel : tacticPanel;
    const nextButtons = [...panel.querySelectorAll(".roster-remove")];
    const target = nextButtons[index] || nextButtons[index - 1] || panel.querySelector(".roster-add-row input");
    target?.focus();
  }

  function addItem(type, name) {
    if (!guardEdit()) return;
    state = addCanonicalItem(state, type, name);
    persist(state);
    rerender();
  }

  const clearBtn = el("button", { type: "button", class: "roster-ghost roster-danger", onClick: () => {
    if (!guardEdit()) return;
    if (!confirm(L("Xóa toàn bộ kho đã đọc (tướng, chiến pháp, đội khóa)? Không hoàn tác được.", "清空全部已识别库存（武将、战法、锁定队伍）？此操作无法撤销。"))) return;
    // Xoá kho không đổi mùa đang chọn.
    state = { ...clearRosterScanState(), seasonId: state.seasonId };
    persist(state);
    rerender();
    setScanStatus("");
  } }, [trashIcon(), L("Xóa toàn bộ kho", "清空全部库存")]);
  editControls.push(clearBtn);

  confirmBtn.addEventListener("click", () => {
    state = { ...serializeRosterScanState(state), confirmed: true, updatedAt: new Date().toISOString() };
    persist(state);
    rerender();
  });

  const actionBar = el("div", { class: "roster-actionbar" }, [
    clearBtn,
    el("div", { class: "roster-actionbar-main" }, [confirmBtn, recommendBtn]),
  ]);

  /* ---------- Màn kết quả: tóm tắt kho + nút quay lại sửa ---------- */
  const summaryChips = el("div", { class: "roster-summary-chips" });
  const editBtn = el("button", { type: "button", class: "ana-btn roster-edit", onClick: () => {
    showStage("review");
    reviewTitle.focus();
  } }, [pencilIcon(), L("Sửa kho đã đọc", "编辑已识别库存")]);
  const summary = el("section", { class: "roster-summary", "aria-label": L("Kho đang dùng để gợi ý", "用于推荐的库存") }, [summaryChips, editBtn]);
  function paintSummary() {
    const option = seasonOptions.get(season?.id);
    const lockedTotal = state.lockedTeams?.length || 0;
    summaryChips.replaceChildren(...[
      option ? pill(seasonNameText(option), "outline") : null,
      pill(MODE_LABELS[preference], "neutral"),
      pill(L(`${state.ownedHeroes.length} tướng · ${state.ownedTactics.length} chiến pháp`, `${state.ownedHeroes.length} 名武将 · ${state.ownedTactics.length} 个战法`), "neutral"),
      lockedTotal ? pill(L(`${lockedTotal} đội khóa`, `${lockedTotal} 支锁定队伍`), "neutral") : null,
    ].filter(Boolean));
  }

  /* ---------- Thêm nhanh từ danh mục: lọc rồi "Chọn tất cả"; khách ghi local, đã đăng nhập ghi vào hộp đang chọn ---------- */
  const catalog = buildCatalog({ heroesDict, tacticsDict }, "inventory");
  const ownedNames = (list) => new Set((list || []).flatMap((entry) => [entry.name, entry.canonicalId].filter(Boolean)));
  /** ID các món trong danh mục đang có trong kho (khớp theo ID canonical hoặc tên Việt chuẩn). */
  const pickerSelected = () => {
    const heroes = ownedNames(state.ownedHeroes);
    const tactics = ownedNames(state.ownedTactics);
    return new Set(catalog.filter((item) => {
      const owned = item.type === "heroes" ? heroes : tactics;
      return owned.has(item.name) || owned.has(item.id);
    }).map((item) => item.id));
  };
  picker = createPicker({
    policy: "inventory",
    catalog,
    title: L("Thêm nhanh từ danh mục", "从图鉴快速添加"),
    lead: L("Tìm hoặc lọc rồi chọn từng món, hoặc “Chọn tất cả” cho đúng tập đang hiện.", "搜索或筛选后逐项选择，也可对当前显示的全部条目“全选”。"),
    selected: pickerSelected,
    label: (item) => (item.type === "tactics" ? tacticShown(item.name) : shown(item.name)),
    onToggle: (items, on) => {
      if (!guardEdit()) return;
      state = on ? addPicked(state, items) : removePicked(state, items);
      persist(state);
      rerender();
    },
  });
  picker.setDisabled(!canEdit());
  const quickAdd = el("div", { class: "roster-quick-add" }, [picker.node]);

  const reviewStage = el("div", { class: "roster-stage", dataset: { stage: "review" } }, [
    settings,
    aiReady
      ? el("div", { class: "roster-scan-grid" }, scanControls.map((control) => control.card))
      : el("p", { class: "tool-notice roster-ai-off" }, [
        el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [imageIcon()]),
        el("span", {}, L("Đọc ảnh kho đang tạm tắt. Hãy thêm tướng và chiến pháp bằng bảng chọn bên dưới.", "截图识别库存暂时关闭。请使用下方的选择面板添加武将和战法。")),
      ]),
    aiReady ? el("div", { class: "roster-verify" }, [tsBox, tsStatus]) : null,
    scanStatus,
    quickAdd,
    reviewArea,
    actionBar,
  ]);
  const resultStage = el("div", { class: "roster-stage", dataset: { stage: "result" }, hidden: "" }, [summary, resultsSlot]);

  function showStage(next) {
    stage = next;
    reviewStage.hidden = stage !== "review";
    resultStage.hidden = stage !== "result";
    if (stage === "review") resultsSlot.replaceChildren();
    paintSteps();
  }

  /** Lượt gợi ý mới nhất; lượt cũ còn chờ tải mùa bị bỏ khi kho đổi hoặc có lượt mới. */
  let runId = 0;

  /** Gợi ý lại trên kho hiện tại; dùng cho nút Gợi ý và cho các thao tác trong mục Thiếu món. */
  async function runRecommend() {
    const run = ++runId;
    await seasonReady;
    if (run !== runId || !state.confirmed || !scanned()) return false;
    const result = recommendRoster({
      seasonTeams: season?.teams || [],
      seasonTier: season?.teamTier || [],
      legacyTeams: teams || [],
      legacyTier: teamTier || [],
      tacticOverrides: state.tacticOverrides,
      ownedHeroes: state.ownedHeroes,
      ownedTactics: state.ownedTactics,
      lockedTeams: state.lockedTeams,
      mode: preference,
      keepExistingTeams: true,
      tacticsDict,
      fullBox: state.ownedHeroes.length > 40 && state.ownedTactics.length > 60,
    });
    resultsSlot.replaceChildren(renderRecommendation(result));
    paintSummary();
    showStage("result");
    return true;
  }
  recommendBtn.addEventListener("click", async () => {
    if (await runRecommend()) resultsSlot.querySelector("#roster-list-title")?.focus();
  });

  /**
   * Hành động trong mục Thiếu món sửa kho theo đúng kết quả người dùng đang xem: giữ trạng thái đã xác
   * nhận và gợi ý lại ngay. Nút vừa bấm biến mất theo lượt vẽ mới: focus về đầu mục Thiếu món.
   */
  async function applyFromResults(next) {
    if (!guardEdit()) return;
    state = { ...next, confirmed: true, updatedAt: new Date().toISOString() };
    persist(state);
    syncReview();
    refreshRecommend();
    if (await runRecommend()) resultsSlot.querySelector(".roster-missing-section h2")?.focus();
  }

  const refreshRecommend = () => {
    confirmBtn.disabled = !scanned();
    recommendBtn.disabled = !(state.confirmed && scanned());
  };

  const rerender = () => {
    runId++;
    syncReview();
    refreshRecommend();
    if (stage !== "review") showStage("review");
  };

  /* ---------- "Vì sao?": AI chỉ giải thích món bù đã có, chỉ gọi khi người dùng bấm ---------- */
  const explanations = new Map();
  const tacticByName = new Map((tacticsDict || []).filter((item) => item?.viet).map((item) => [item.viet, item]));
  const tacticEffect = (name) => {
    const item = tacticByName.get(name) ?? tacticByName.get(tacticDisplayName(name));
    return String((zh ? item?.effect : item?.effectViet || item?.effect) || "").slice(0, 1200);
  };
  // Lời giải thích nêu chiến pháp khác ngoài hai món được hỏi là đã vượt vai trò "chỉ giải thích": không hiện.
  const namesOtherTactic = (text, allowed) => [...tacticByName.values()].some((item) =>
    [item.viet, zh ? item.chinese : null].some((name) => typeof name === "string" && name.length >= 3 && !allowed.has(item.viet) && text.includes(name)));

  async function explainSubstitute({ holderName, missing, substitute, configCount }, button, output, box) {
    const show = (text) => {
      output.textContent = text;
      box.hidden = !text;
    };
    const key = JSON.stringify([missing, substitute, holderName, currentLocale()]);
    if (explanations.has(key)) {
      show(explanations.get(key));
      return;
    }
    // Token Turnstile dùng một lần: lấy và xoá cùng một bước như khi đọc ảnh.
    const explainToken = token;
    token = "";
    if (!explainToken) {
      show(L("Xác thực Turnstile trước.", "请先完成 Turnstile 验证。"));
      return;
    }
    button.disabled = true;
    show(L("Đang hỏi AI…", "正在询问 AI…"));
    try {
      const { explanation } = await callWorkerExplain({
        locale: zh ? "zh" : "vi",
        hero: holderName,
        missing: { name: tacticDisplayName(missing), effect: tacticEffect(missing) },
        substitute: { name: tacticDisplayName(substitute), effect: tacticEffect(substitute) },
        configCount: Math.min(configCount, 999),
      }, explainToken);
      const text = namesOtherTactic(explanation, new Set([missing, substitute, tacticDisplayName(missing), tacticDisplayName(substitute)]))
        ? L("Chưa giải thích được món bù này. Hãy đối chiếu hiệu ứng trong Tra cứu.", "暂时无法解释此替代战法，请在图鉴中对照效果。")
        : explanation;
      explanations.set(key, text);
      show(text);
    } catch (err) {
      show(describeAnalyzeError(err, L("Chưa giải thích được lúc này. Thử lại sau.", "暂时无法给出解释，请稍后再试。")));
    } finally {
      if (window.turnstile) window.turnstile.reset(tsBox);
      button.disabled = false;
    }
  }

  /** Hàng tướng → chiến pháp của một đội; chiến pháp không rõ tướng giữ (đội khóa đọc từ ảnh) gom vào hàng cuối. */
  function heroRows(entry) {
    const heroes = entry.heroAssignments || [];
    const holders = new Set(heroes.map((hero) => hero.canonicalId));
    const byHolder = new Map();
    const unresolved = new Set((entry.unresolvedTactics || []));
    const assigned = new Set();
    for (const selection of [...(entry.tacticSelections || [])].sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))) {
      if (!selection.holderId || !holders.has(selection.holderId)) continue;
      byHolder.set(selection.holderId, [...(byHolder.get(selection.holderId) || []), selection.selectedTactic]);
      assigned.add(selection.selectedTactic);
    }
    const loose = (entry.selectedTactics || []).filter((tactic) => !assigned.has(tactic));
    // Đội khóa đọc từ ảnh không ghi tướng nào giữ chiến pháp nào: hiện hai hàng Tướng / Chiến pháp thay vì đoán.
    const rows = assigned.size === 0 && loose.length
      ? [[L("Tướng", "武将"), heroes.map((hero) => hero.displayName), "roster-hero-list"], [L("Chiến pháp", "战法"), loose]]
      : [
        ...heroes.map((hero) => [shown(hero.displayName), byHolder.get(hero.canonicalId) || []]),
        ...(loose.length ? [[L("Chiến pháp", "战法"), loose]] : []),
      ];
    return el("ul", { class: "roster-hero-rows" }, rows.map(([name, values, valueClass]) => el("li", {}, [
      el("span", { class: "roster-hero-name" }, name),
      el("span", { class: valueClass || "roster-hero-tactics" }, values.length ? values.map((value) => (unresolved.has(value) ? `${(valueClass ? shown : tacticShown)(value)} (${L("chưa đối chiếu", "未核对")})` : (valueClass ? shown : tacticShown)(value))).join(" · ") : "—"),
    ])));
  }

  /** Bản đã thay bằng món bù của người dùng chưa được đánh giá: bậc hiển thị là của cấu hình gốc. */
  const tierPill = (entry) => pill(
    entry.variantUnrated
      ? L(`Bậc cấu hình gốc: ${entry.originalTier || "—"} · bản đã thay chưa được đánh giá`, `原配置梯度：${entry.originalTier || "—"} · 替换版本尚未评级`)
      : L(`Bậc: ${entry.tier || "—"}`, `梯度：${entry.tier || "—"}`),
    "outline",
    { class: "roster-pill roster-tier" },
  );
  const openButton = (team) => el("button", { type: "button", class: "roster-open", onClick: () => onOpenTeam?.(team) }, [L("Mở đội", "查看队伍"), arrowIcon()]);

  /**
   * Nút "Lưu vào đội của tôi" của một thẻ kết quả: đội nháp dựng LÚC BẤM từ đúng lựa chọn đang hiện (tướng/chiến pháp đã
   * thay, món bù). Đội khóa (đội đã xây của bạn) không có bản ghi nguồn nên không có nút. Hash nguồn chép từ chỉ mục build.
   */
  const saveButtonFor = (entry) => {
    if (!entry?.team || entry.locked || !(entry.source === "legacy" || entry.team.source === "season")) return null;
    return createSaveButton({
      className: "ana-btn mt-save-btn",
      build: async () => {
        const [{ createLookupIdResolver }, { fromRosterEntry }, { loadTeamBooks }, { loadSourceIndex }] = await Promise.all([
          import("./lookup-ids.js"),
          import("./my-teams-sources.js"),
          import("./community-team-data.js"),
          import("./my-teams-links.js"),
        ]);
        const [books, index] = await Promise.all([loadTeamBooks(), loadSourceIndex()]);
        const built = fromRosterEntry(entry, seasonRecords, createLookupIdResolver({ tactics: tacticsDict, books, heroes: heroesDict }));
        if (!built) throw new Error("no-draft");
        const { draft } = built;
        const indexed = index?.[`${draft.source.kind}:${draft.source.key}`];
        // Đội khác dựng từ engine không phải đúng chữ nguồn: hash lấy từ chỉ mục (không có thì rỗng, không báo "đã cập nhật" sai).
        if (typeof indexed === "string") draft.source.contentHash = indexed;
        else if (draft.source.kind === "legacy") draft.source.contentHash = "";
        return { draft, defaultGroup: built.defaultGroup, unresolved: built.unresolved };
      },
    });
  };

  function renderRecommendation(result) {
    const portfolio = result.portfolioTeams || [];
    const addTeams = result.addTeams || [];
    const overriddenTeams = new Set((state.tacticOverrides || []).map((override) => override.teamId));
    const clearOverrides = (teamId) => applyFromResults({
      ...state,
      tacticOverrides: (state.tacticOverrides || []).filter((override) => override.teamId !== teamId),
    });
    const teamRow = (entry, index) => {
      const legacy = entry.source === "legacy";
      const alternatives = entry.usedAlternatives || [];
      return el("li", { class: "roster-result-team", dataset: { source: legacy ? "legacy" : entry.locked ? "locked" : "season" } }, [
        el("span", { class: "roster-rank", "aria-hidden": "true" }, String(index + 1)),
        el("div", { class: "roster-result-main" }, [
          el("div", { class: "roster-result-head" }, [
            el("strong", { class: "roster-result-name" }, teamLabel(entry.team) || L("Đội đã xây dựng", "已组建队伍")),
            tierPill(entry),
            legacy
              ? el("span", { class: "roster-status", dataset: { status: "legacy" } }, L("Tham khảo – đội cũ", "参考 · 旧阵容"))
              : el("span", { class: "roster-status", dataset: { status: entry.status || "locked" } }, ROSTER_STATUS_LABELS[entry.status] || ROSTER_STATUS_LABELS.locked),
          ]),
          heroRows(entry),
          (entry.unresolvedTactics || []).length
            ? el("p", { class: "roster-empty roster-unresolved-note", dataset: { status: "unreconciled" } }, L(
              `Chưa đối chiếu được chiến pháp: ${entry.unresolvedTactics.join(", ")}. Cần kiểm lại trước khi xây.`,
              `尚未核对的战法：${entry.unresolvedTactics.map(shown).join("、")}。组建前请先核对。`,
            ))
            : null,
          entry.variantUnrated
            ? el("p", { class: "roster-empty roster-variant-note" }, L(
              "Bản đã thay chưa được đánh giá; bậc hiển thị là của cấu hình gốc.",
              "替换后的版本尚未评级；所示梯度为原配置的梯度。",
            ))
            : null,
          alternatives.length
            ? el("div", { class: "roster-swap" }, [
              swapIcon(),
              el("span", { class: "roster-swap-text" }, [
                el("strong", {}, L("Đã thay:", "已替换：")),
                " ",
                alternatives.map((item) => `${tacticShown(item.from)} → ${tacticShown(item.to)}`).join(zh ? "、" : ", "),
              ]),
              // Gỡ món bù nằm trong khối "Đã thay", không tranh chỗ của "Mở đội".
              !legacy && overriddenTeams.has(entry.team?.id)
                ? el("button", { type: "button", class: "roster-ghost roster-undo", onClick: () => clearOverrides(entry.team.id) }, L("Bỏ món thay", "取消替换"))
                : null,
            ])
            : null,
          el("div", { class: "roster-result-actions" }, [
            entry.team && !entry.locked ? openButton(entry.team) : null,
            saveButtonFor(entry),
          ]),
        ]),
      ]);
    };

    // Chiến pháp đội trong danh sách đang dùng: món bù không được lấy lại của đội khác.
    const reserved = portfolio.flatMap((entry) => entry.selectedTactics || []);
    // `name` là tên hiển thị (chiến pháp: `viet` hiện hành của danh mục); thao tác vẫn dùng tên lưu.
    const haveButton = (type, stored) => {
      const name = type === "tactics" ? tacticDisplayName(stored) : stored;
      return el("button", {
        type: "button",
        class: "ana-btn",
        "aria-label": type === "heroes" ? L(`Tôi có tướng ${name}`, `我有武将${shown(name)}`) : L(`Tôi có chiến pháp ${name}`, `我有战法${shown(name)}`),
        onClick: () => applyFromResults(addCanonicalItem(state, type, stored)),
      }, [checkIcon(), type === "heroes" ? L("Tôi có tướng này", "我有这个武将") : L("Tôi có chiến pháp này", "我有这个战法")]);
    };
    const missingLine = (text, button) => el("div", { class: "roster-missing-line" }, [
      el("p", { class: "roster-missing-text" }, [warnIcon(), el("span", {}, text)]),
      button,
    ]);
    const noSubstitute = () => el("p", { class: "roster-empty" }, L("Kho chưa có món bù từ đội cùng mùa.", "库存中暂无同赛季阵容用过的替代战法。"));

    const incompatibleNote = (items) => el("p", { class: "roster-empty roster-incompatible-note", dataset: { status: "incompatible" } }, L(
      `Không tương thích luật đội: ${items.map((item) => `${tacticDisplayName(item.tactic)} (${RULE_REASON_LABELS[item.reason]?.vi || item.reason})`).join("; ")}.`,
      `与队伍规则不兼容：${items.map((item) => `${shown(item.tactic)}（${RULE_REASON_LABELS[item.reason]?.zh || item.reason}）`).join("；")}。`,
    ));

    function missingTacticBlock(entry, storedSlot) {
      // `slot.tactic` là tên hiển thị; phân tích/thao tác dùng tên lưu `storedSlot.tactic`.
      const slot = { ...storedSlot, tactic: tacticDisplayName(storedSlot.tactic) };
      // Tổ hợp cuối của đội (gồm món bù đã chọn ở ô khác) quyết định món nào còn dùng được và có hợp luật đội không.
      const analysis = analyzeTacticSubstitutes({
        heroName: slot.holderName,
        missingTactic: storedSlot.tactic,
        team: entry.team,
        tacticOverrides: state.tacticOverrides,
        heroIndex: slot.heroIndex,
        slotIndex: slot.slotIndex,
        tacticRules,
        tacticsDict,
        usage: season?.usage,
        ownedTactics: state.ownedTactics,
        reservedTactics: reserved,
      });
      const substitutes = analysis.substitutes;
      const limitReached = tacticOverrideBlocked(state, { teamId: entry.team.id, heroIndex: slot.heroIndex, slotIndex: slot.slotIndex });
      return el("div", { class: "roster-missing-slot" }, [
        missingLine(L(
          `Thiếu chiến pháp ${slot.tactic} (${slot.holderName})`,
          `缺少战法 ${shown(slot.tactic)}（${shown(slot.holderName)}）`,
        ), haveButton("tactics", storedSlot.tactic)),
        ...(limitReached
          ? [el("p", { class: "roster-empty roster-override-full", role: "status" }, L(
            `Đã dùng đủ ${MAX_TACTIC_OVERRIDES} món thay. Hãy bấm “Bỏ món thay” ở một đội để chọn món mới.`,
            `替换战法已达 ${MAX_TACTIC_OVERRIDES} 个上限。请先在某支队伍上点“取消替换”再选择新的。`,
          ))]
          : []),
        ...(substitutes.length
          ? [
            el("h4", { class: "roster-subs-title" }, L("Món bù có trong kho", "库存中的替代战法")),
            el("ul", { class: "roster-substitutes", "aria-label": L("Món bù có trong kho", "库存中的替代战法") }, substitutes.map(({ tactic: storedTactic, configCount }) => {
              const tactic = tacticDisplayName(storedTactic);
              const output = el("span", { class: "roster-explain", "aria-live": "polite" });
              const box = el("div", { class: "roster-explain-box", hidden: "" }, [
                sparkIcon(17),
                el("span", {}, [
                  el("strong", {}, L("Vì sao?", "为什么？")),
                  " ",
                  output,
                  " ",
                  el("span", { class: "roster-explain-source" }, L("AI giải thích · đối chiếu hiệu ứng trong Tra cứu.", "AI 解释 · 请在图鉴中对照效果。")),
                ]),
              ]);
              const why = aiReady ? el("button", { type: "button", class: "roster-ghost" }, [questionIcon(), L("Vì sao?", "为什么？")]) : null;
              why?.addEventListener("click", () => explainSubstitute({ holderName: slot.holderName, missing: storedSlot.tactic, substitute: storedTactic, configCount }, why, output, box));
              return el("li", { class: "roster-substitute" }, [
                el("span", { class: "roster-substitute-text" }, [
                  el("span", { class: "roster-substitute-title" }, L(
                    ["Dùng ", el("span", { class: "roster-substitute-name" }, tactic), ` thay ${slot.tactic}`],
                    ["用", el("span", { class: "roster-substitute-name" }, shown(tactic)), `替换${shown(slot.tactic)}`],
                  )),
                  el("span", { class: "roster-substitute-meta" }, L(`${configCount} cấu hình cùng mùa`, `本赛季 ${configCount} 套配置使用`)),
                ]),
                el("span", { class: "roster-substitute-actions" }, [
                  why,
                  el("button", {
                    type: "button",
                    class: "ana-btn",
                    disabled: limitReached ? "" : null,
                    "aria-label": L(`Dùng ${tactic} thay ${slot.tactic}`, `用${shown(tactic)}替换${shown(slot.tactic)}`),
                    onClick: () => applyFromResults(setTacticOverride(state, { teamId: entry.team.id, heroIndex: slot.heroIndex, slotIndex: slot.slotIndex, tactic: storedTactic })),
                  }, L("Dùng món này", "使用此战法")),
                ]),
                aiReady ? box : null,
              ]);
            })),
          ]
          : [analysis.incompatible.length ? incompatibleNote(analysis.incompatible) : noSubstitute()]),
      ]);
    }

    const missingCard = (entry) => {
      const heroSlots = entry.status === "missing-hero" ? entry.missingHeroSlotNames || [] : [];
      const tacticSlots = entry.status === "missing-hero" ? [] : entry.missingTacticSlots || [];
      const total = heroSlots.length + tacticSlots.length;
      return el("article", { class: "roster-missing" }, [
        el("div", { class: "roster-result-head" }, [
          el("strong", { class: "roster-result-name" }, teamLabel(entry.team)),
          tierPill(entry),
          pill(L(`Thiếu ${total} món`, `缺 ${total} 项`), "warn"),
        ]),
        ...heroSlots.map((names) => el("div", { class: "roster-missing-slot" }, [
          missingLine(L(`Thiếu tướng ${names.join(" / ")}`, `缺少武将 ${names.map(shown).join(" / ")}`), haveButton("heroes", names[0])),
        ])),
        ...(heroSlots.length ? [noSubstitute()] : []),
        ...tacticSlots.map((slot) => missingTacticBlock(entry, slot)),
        el("div", { class: "roster-result-actions" }, [openButton(entry.team), saveButtonFor(entry)]),
      ]);
    };

    const blocked = (result.blockedStrongTeams || []).slice(0, 5);
    const incompatible = (result.incompatibleTeams || []).slice(0, 5);
    // Đủ tướng và món nhưng món bù đã chọn phạm luật đội: trạng thái riêng, không phải "thiếu món".
    const incompatibleCard = (entry) => el("article", { class: "roster-missing roster-incompatible", dataset: { status: "incompatible" } }, [
      el("div", { class: "roster-result-head" }, [
        el("strong", { class: "roster-result-name" }, teamLabel(entry.team)),
        tierPill(entry),
        pill(ROSTER_STATUS_LABELS.incompatible, "warn"),
      ]),
      ...(entry.incompatibleTactics || []).map((item) => el("p", { class: "roster-missing-text" }, [
        warnIcon(),
        el("span", {}, L(
          `${tacticDisplayName(item.tactic)} thay ${tacticDisplayName(item.from)}: ${RULE_REASON_LABELS[item.reason]?.vi || item.reason}`,
          `${shown(item.tactic)} 替换 ${shown(item.from)}：${RULE_REASON_LABELS[item.reason]?.zh || item.reason}`,
        )),
      ])),
      el("button", { type: "button", class: "roster-ghost roster-undo", onClick: () => clearOverrides(entry.team.id) }, L("Bỏ món thay", "取消替换")),
      el("div", { class: "roster-result-actions" }, [openButton(entry.team), saveButtonFor(entry)]),
    ]);
    // Món bù đã chọn mà đội vẫn không vào danh sách (trùng tướng/chiến pháp với đội xếp trên): vẫn phải gỡ được.
    const shownTeams = new Set([...portfolio, ...blocked, ...incompatible].map((entry) => entry.team?.id));
    const idleOverrides = [...overriddenTeams]
      .filter((teamId) => !shownTeams.has(teamId))
      .map((teamId) => season?.teams.find((team) => team.id === teamId))
      .filter(Boolean);
    const full = portfolio.length >= MAX_TEAMS;
    return el("div", { class: "roster-results" }, [
      el("section", { class: "roster-portfolio", "aria-labelledby": "roster-list-title" }, [
        el("div", { class: "roster-portfolio-head" }, [
          el("h2", { class: "roster-section-title", id: "roster-list-title", tabindex: "-1" }, L("Danh sách đội sau khi xây dựng", "组建后的队伍列表")),
          full
            ? pill([checkIcon(13), L(`Đã đủ ${MAX_TEAMS} đội`, `已满 ${MAX_TEAMS} 支队伍`)], "good", { class: "roster-pill roster-portfolio-count" })
            : pill(L(`${portfolio.length}/${MAX_TEAMS} đội`, `${portfolio.length}/${MAX_TEAMS} 支队伍`), "neutral", { class: "roster-pill roster-portfolio-count" }),
        ]),
        result.legacyUsed
          ? el("p", { class: "roster-legacy-note" }, [historyIcon(), el("span", {}, L("Mùa đang chọn chưa đủ đội xây được từ kho: đội cũ được thêm để tham khảo, xếp sau đội của mùa.", "所选赛季可组建的阵容不足：已补充旧阵容作参考，排在本赛季阵容之后。"))])
          : null,
        portfolio.length
          ? el("ol", { class: "roster-team-list" }, portfolio.map(teamRow))
          : el("p", { class: "roster-empty" }, L("Chưa có đội nào xây dựng được từ kho hiện tại.", "当前库存暂无可组建的队伍。")),
        portfolio.length && !full && !addTeams.length
          ? el("p", { class: "roster-empty" }, L("Chưa có đội phù hợp để thêm từ kho hiện tại.", "当前库存暂无适合新增的队伍。"))
          : null,
      ]),
      el("section", { class: "roster-missing-section", "aria-labelledby": "roster-missing-title" }, [
        el("div", { class: "roster-section-head" }, [
          el("h2", { class: "roster-section-title", id: "roster-missing-title", tabindex: "-1" }, L("Thiếu món", "差一点就能组建")),
          el("p", { class: "roster-section-lead" }, L(
            "Đội mạnh của mùa chỉ còn thiếu vài món, đội thiếu ít nhất đứng trước. Nếu bạn có món đó mà ảnh chưa đọc ra, bấm “Tôi có…”.",
            "本赛季强势阵容只差几件，缺得最少的排在前面。若你其实拥有但截图未识别，点“我有…”。",
          )),
        ]),
        ...(blocked.length
          ? blocked.map(missingCard)
          : [el("p", { class: "roster-empty" }, L("Không có đội mạnh nào của mùa đang thiếu món.", "本赛季没有只差几件的强势阵容。"))]),
        ...incompatible.map(incompatibleCard),
        ...idleOverrides.map((team) => el("p", { class: "ana-note roster-idle-override" }, [
          L(
            `Món bù đã chọn cho ${team.name} chưa đưa đội vào danh sách.`,
            `已为 ${teamLabel(team)} 选择的替代战法尚未让该阵容进入列表。`,
          ),
          " ",
          el("button", { type: "button", class: "roster-ghost roster-undo", onClick: () => clearOverrides(team.id) }, L("Bỏ món thay", "取消替换")),
        ])),
      ]),
    ]);
  }

  if (aiReady) {
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
  }

  mount.replaceChildren(
    el("div", { class: "analyze-panel roster-recommend" }, [
      el("header", { class: "tool-head" }, [
        el("div", { class: "reference-head-text" }, [
          el("span", { class: "reference-kicker" }, L("Công cụ · Beta", "工具 · Beta")),
          el("h1", { class: "reference-title", tabindex: "-1" }, L("Gợi ý đội từ kho", "武将库配队")),
          el("p", { class: "reference-lead" }, aiReady
            ? L("Đọc ảnh kho tướng và chiến pháp, kiểm tra lại, rồi để công cụ cục bộ chọn tối đa 5 đội không trùng tài nguyên từ Đội chuẩn của mùa bạn đang chơi.", "识别武将与战法库存截图并核对后，由本地工具从你所在赛季的推荐阵容中挑选最多 5 支资源不冲突的队伍。")
            : L("Chọn tướng và chiến pháp bạn đang có, kiểm tra lại, rồi để công cụ cục bộ chọn tối đa 5 đội không trùng tài nguyên từ Đội chuẩn của mùa bạn đang chơi.", "选择你拥有的武将与战法并核对后，由本地工具从你所在赛季的推荐阵容中挑选最多 5 支资源不冲突的队伍。")),
        ]),
      ]),
      flow,
      syncBar,
      reviewStage,
      resultStage,
    ]),
  );
  rerender();
  sync.start();
}
