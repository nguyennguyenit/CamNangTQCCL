// Máy tính nâng cấp nhiều công trình trong trang nhóm Tra cứu Công trình (`/tra-cuu/cong-trinh/`, bản zh
// `/zh/tra-cuu/cong-trinh/`): mỗi dòng chọn công trình, cấp hiện tại và cấp đích; khối kết quả cộng từng loại tài nguyên và
// tổng thời gian. Thuần client, dữ liệu là `catalog.buildings` trang đã tải. Các dòng nằm trên query (`?nang=`, ghi bằng
// replaceState, giữ `?id=` của panel chi tiết). Phép tính ở `js/building-upgrade-totals.js`; ở đây chỉ có cây view
// (dựng được trong node để test) và phần gắn DOM.

import { h, treeToDom } from "./view-tree.js";
import { formatNumber, normalizeLocale, pick } from "./i18n.js";
import { lookupDisplayName } from "./lookup-detail.js";
import {
  BUILDING_COST_KEYS,
  MAX_UPGRADE_ROWS,
  buildingMaxLevel,
  clampLevel,
  combineRangeTotals,
  splitDuration,
  sumLevelRange,
  upgradeRowsFromQuery,
  upgradeRowsSearch,
} from "./building-upgrade-totals.js";

const isZh = (locale) => normalizeLocale(locale) === "zh";
const text = (locale, vi, zh) => pick(locale, vi, zh);
const COST_LABELS = { wood: ["Gỗ", "木材"], stone: ["Đá", "石料"], iron: ["Sắt", "铁矿"] };
const costLabel = (key, locale) => pick(locale, ...COST_LABELS[key]);

/** Tên công trình theo ngôn ngữ trang (bản zh dùng tên chữ Hán nguồn). */
const buildingName = (record, locale) => lookupDisplayName(record, record?.nameVi ?? "", locale);

/** Thời lượng từ số giây: "2 ngày 3 giờ 15 phút" / "2天3小时15分钟"; phần bằng 0 bị bỏ, 0 giây là "0 phút" / "0分钟". */
export function formatUpgradeDuration(totalSeconds, locale) {
  const { days, hours, minutes, seconds } = splitDuration(totalSeconds);
  const parts = [
    [days, "ngày", "天"],
    [hours, "giờ", "小时"],
    [minutes, "phút", "分钟"],
    [seconds, "giây", "秒"],
  ].filter(([value]) => value > 0);
  if (!parts.length) return text(locale, "0 phút", "0分钟");
  return isZh(locale)
    ? parts.map(([value, , zh]) => `${value}${zh}`).join("")
    : parts.map(([value, vi]) => `${value} ${vi}`).join(" ");
}

/**
 * Các dòng "thiếu dữ liệu cấp N" của một kết quả `sumLevelRange`: cấp thiếu cả hai, chỉ thiếu tài nguyên, chỉ thiếu thời
 * gian (mỗi nhóm một câu, cấp theo thứ tự tăng dần).
 */
export function missingLevelMessages(result, locale) {
  const time = new Set(result.missingTimeLevels);
  const cost = new Set(result.missingCostLevels);
  const both = result.missingCostLevels.filter((level) => time.has(level));
  const costOnly = result.missingCostLevels.filter((level) => !time.has(level));
  const timeOnly = result.missingTimeLevels.filter((level) => !cost.has(level));
  const list = (levels) => levels.join(isZh(locale) ? "、" : ", ");
  return [
    both.length ? text(locale, `Thiếu dữ liệu cấp ${list(both)}: tài nguyên và thời gian`, `缺少第 ${list(both)} 级数据：资源和耗时`) : null,
    costOnly.length ? text(locale, `Thiếu dữ liệu cấp ${list(costOnly)}: tài nguyên`, `缺少第 ${list(costOnly)} 级数据：资源`) : null,
    timeOnly.length ? text(locale, `Thiếu dữ liệu cấp ${list(timeOnly)}: thời gian`, `缺少第 ${list(timeOnly)} 级数据：耗时`) : null,
  ].filter(Boolean);
}

/** "Gỗ 1.234 · Đá 567 · 2 giờ": tài nguyên có số và thời gian (nếu có cấp nào đọc được thời gian) của một dòng. */
function rowTotalsText(result, locale) {
  const parts = BUILDING_COST_KEYS.filter((key) => result.costs[key] !== null)
    .map((key) => `${costLabel(key, locale)} ${formatNumber(result.costs[key], locale)}`);
  if (result.missingTimeLevels.length < result.levelCount) parts.push(formatUpgradeDuration(result.seconds, locale));
  return parts.join(" · ");
}

/** Khung dựng lúc build (Astro): ẩn khi chưa có JavaScript; `js/app.js` gọi `initBuildingCalculator` để mở và vẽ thân. */
export function buildingCalculatorShellTree(locale) {
  return h("section", { class: "building-calc", "data-building-calc": true, hidden: true, "aria-labelledby": "building-calc-title" }, [
    h("details", { class: "building-calc-box" }, [
      h("summary", { class: "building-calc-summary" }, [
        h("span", { class: "building-calc-heading" }, [
          h("span", { class: "building-calc-title", id: "building-calc-title" }, text(locale, "Tính tài nguyên nâng cấp", "升级资源计算")),
          h("span", { class: "building-calc-lead" }, text(locale,
            "Cộng gỗ, đá, sắt và thời gian cần để nâng cấp nhiều công trình",
            "合计多座建筑升级所需的木材、石料、铁矿和耗时")),
        ]),
        h("span", { class: "building-calc-chevron", "aria-hidden": "true" }, [
          h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
            h("polyline", { points: "6 9 12 15 18 9" }),
          ]),
        ]),
      ]),
      h("div", { class: "building-calc-body", "data-building-calc-body": true }),
    ]),
  ]);
}

function levelFieldTree(locale, { label, field, value, max, index }) {
  return h("label", { class: "building-calc-field" }, [
    h("span", { class: "flabel" }, label),
    h("input", {
      class: "building-calc-input",
      type: "number",
      inputmode: "numeric",
      min: "0",
      max: String(max),
      step: "1",
      value: String(value),
      "data-field": field,
      "data-row": String(index),
    }),
  ]);
}

function rowTree(row, index, records, byId, locale) {
  const record = byId.get(row.buildingId);
  const max = buildingMaxLevel(record);
  const result = sumLevelRange(record?.levels ?? [], row.from, row.to);
  const name = buildingName(record, locale);
  return h("li", { class: "building-calc-row" }, [
    h("div", { class: "building-calc-fields" }, [
      h("label", { class: "building-calc-field building-calc-field-building" }, [
        h("span", { class: "flabel" }, text(locale, "Công trình", "建筑")),
        h("select", { class: "building-calc-select", "data-field": "building", "data-row": String(index) }, records.map((item) => {
          const itemMax = buildingMaxLevel(item);
          return h("option", { value: item.id, selected: item.id === row.buildingId }, text(locale,
            `${buildingName(item, locale)} · Lv ${itemMax}`,
            `${buildingName(item, locale)} · ${itemMax} 级`));
        })),
      ]),
      levelFieldTree(locale, { label: text(locale, "Cấp hiện tại", "当前等级"), field: "from", value: row.from, max, index }),
      levelFieldTree(locale, { label: text(locale, "Cấp đích", "目标等级"), field: "to", value: row.to, max, index }),
      h("button", {
        type: "button",
        class: "clear-btn building-calc-remove",
        "data-action": "remove",
        "data-row": String(index),
        "aria-label": text(locale, `Bỏ dòng ${name}`, `移除${name}`),
      }, text(locale, "Bỏ", "移除")),
    ]),
    rowResultTree(row, result, locale),
  ]);
}

function rowResultTree(row, result, locale) {
  if (row.to <= row.from) {
    return h("p", { class: "building-calc-row-result is-empty" }, text(locale, "Cấp đích cần lớn hơn cấp hiện tại.", "目标等级需高于当前等级。"));
  }
  const totals = rowTotalsText(result, locale);
  return h("div", { class: "building-calc-row-result" }, [
    h("p", { class: "building-calc-row-totals" }, [
      h("strong", { class: "building-calc-row-range" }, text(locale, `Lv ${row.from} → ${row.to}`, `${row.from} 级 → ${row.to} 级`)),
      totals ? ` · ${totals}` : null,
    ]),
    ...missingLevelMessages(result, locale).map((message) => h("p", { class: "building-calc-missing" }, message)),
  ]);
}

function totalsTree(rows, byId, locale) {
  const results = rows.filter((row) => row.to > row.from).map((row) => sumLevelRange(byId.get(row.buildingId)?.levels ?? [], row.from, row.to));
  const total = combineRangeTotals(results);
  const tile = (label, value) => h("div", { class: "lookup-stat-tile building-calc-total" }, [
    h("span", { class: "lookup-stat-tile-label" }, label),
    h("span", { class: "lookup-stat-tile-value" }, value),
  ]);
  return h("div", { class: "building-calc-result", "aria-live": "polite" }, [
    h("h3", { class: "building-calc-result-title" }, text(locale, "Tổng cộng", "合计")),
    h("div", { class: "building-calc-totals" }, [
      ...BUILDING_COST_KEYS.map((key) => tile(costLabel(key, locale), formatNumber(total.costs[key] ?? 0, locale))),
      tile(text(locale, "Thời gian", "耗时"), formatUpgradeDuration(total.seconds, locale)),
    ]),
    total.missingLevelCount ? h("p", { class: "building-calc-missing" }, text(locale,
      `Tổng chưa gồm ${total.missingLevelCount} cấp thiếu dữ liệu.`,
      `合计未计入 ${total.missingLevelCount} 个缺少数据的等级。`)) : null,
    h("p", { class: "building-calc-note" }, text(locale,
      "Thời gian là tổng thời gian nâng lần lượt từng cấp, chưa trừ hiệu quả giảm thời gian nâng cấp.",
      "耗时为逐级升级的总和，未扣除升级时间降低效果。")),
  ]);
}

/** Thân máy tính: các dòng, nút thêm và khối tổng (dòng rỗng thì có lời nhắc thay cho danh sách). */
export function buildingCalculatorBodyTree(rows, records, locale) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return [
    rows.length
      ? h("ol", { class: "building-calc-rows" }, rows.map((row, index) => rowTree(row, index, records, byId, locale)))
      : h("p", { class: "building-calc-empty" }, text(locale,
        "Chưa có công trình nào. Bấm “Thêm công trình” để bắt đầu.",
        "尚未添加建筑。点击“添加建筑”开始计算。")),
    h("div", { class: "building-calc-actions" }, [
      h("button", { type: "button", class: "detail-link building-calc-add", "data-action": "add", disabled: rows.length >= MAX_UPGRADE_ROWS }, text(locale, "+ Thêm công trình", "+ 添加建筑")),
    ]),
    rows.length ? totalsTree(rows, byId, locale) : null,
  ];
}

/**
 * Dòng mới: công trình đang mở ở panel chi tiết (`?id=`) nếu chưa có trong danh sách, không thì công trình đầu tiên chưa
 * chọn; nâng từ cấp 0 lên cấp tối đa.
 */
export function nextUpgradeRow(rows, records, preferredId = null) {
  const used = new Set(rows.map((row) => row.buildingId));
  const record = records.find((item) => item.id === preferredId && !used.has(item.id))
    ?? records.find((item) => !used.has(item.id))
    ?? records[0];
  return record ? { buildingId: record.id, from: 0, to: buildingMaxLevel(record) } : null;
}

/** Gắn máy tính vào khung dựng sẵn; `buildings` là `catalog.buildings` đã tải. */
export function initBuildingCalculator({ mount, buildings, locale }) {
  const body = mount?.querySelector("[data-building-calc-body]");
  const box = mount?.querySelector(".building-calc-box");
  const records = Array.isArray(buildings) ? buildings : [];
  if (!mount || !body || !box || !records.length) return null;
  const byId = new Map(records.map((record) => [record.id, record]));
  let rows = upgradeRowsFromQuery(location.search, records);

  function writeQuery() {
    const url = new URL(location.href);
    url.search = upgradeRowsSearch(url.search, rows);
    history.replaceState(history.state, "", url);
  }

  function render({ focus = null } = {}) {
    body.replaceChildren(...buildingCalculatorBodyTree(rows, records, locale).map((tree) => treeToDom(tree)));
    if (focus) body.querySelector(focus)?.focus();
  }

  /** Đổi cấp trong lúc gõ: chỉ vẽ lại kết quả của dòng và khối tổng để ô đang gõ giữ focus. */
  function paintResults(index) {
    const rowNode = body.querySelectorAll(".building-calc-row")[index];
    const row = rows[index];
    const result = sumLevelRange(byId.get(row.buildingId)?.levels ?? [], row.from, row.to);
    rowNode?.querySelector(".building-calc-row-result")?.replaceWith(treeToDom(rowResultTree(row, result, locale)));
    // Giữ nguyên nút vùng tổng (live region) và chỉ thay nội dung để trình đọc màn hình đọc tổng mới.
    body.querySelector(".building-calc-result")?.replaceChildren(...treeToDom(totalsTree(rows, byId, locale)).childNodes);
  }

  body.addEventListener("click", (event) => {
    const button = event.target.closest?.("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "add") {
      const row = nextUpgradeRow(rows, records, new URLSearchParams(location.search).get("id"));
      if (!row || rows.length >= MAX_UPGRADE_ROWS) return;
      rows = [...rows, row];
      writeQuery();
      render({ focus: `.building-calc-row:last-child select` });
    } else if (button.dataset.action === "remove") {
      const index = Number(button.dataset.row);
      rows = rows.filter((_, position) => position !== index);
      writeQuery();
      render({ focus: rows.length ? `.building-calc-row:nth-child(${Math.min(index, rows.length - 1) + 1}) .building-calc-remove` : ".building-calc-add" });
    }
  });

  body.addEventListener("input", (event) => {
    const input = event.target.closest?.("input[data-field]");
    if (!input) return;
    const index = Number(input.dataset.row);
    const row = rows[index];
    if (!row || input.value === "") return;
    const max = buildingMaxLevel(byId.get(row.buildingId));
    rows = rows.map((item, position) => position === index ? { ...item, [input.dataset.field]: clampLevel(input.value, max, item[input.dataset.field]) } : item);
    writeQuery();
    paintResults(index);
  });

  body.addEventListener("change", (event) => {
    const control = event.target.closest?.("[data-field]");
    if (!control) return;
    const index = Number(control.dataset.row);
    const row = rows[index];
    if (!row) return;
    if (control.dataset.field === "building") {
      const record = byId.get(control.value);
      if (!record) return;
      const max = buildingMaxLevel(record);
      rows = rows.map((item, position) => position === index
        ? { buildingId: record.id, from: Math.min(item.from, max), to: item.to >= buildingMaxLevel(byId.get(item.buildingId)) ? max : Math.min(item.to, max) }
        : item);
      writeQuery();
      render({ focus: `.building-calc-row:nth-child(${index + 1}) select` });
      return;
    }
    // Rời ô cấp: ghi lại giá trị đã kẹp (ô để trống trở về cấp đang dùng).
    control.value = String(row[control.dataset.field]);
    paintResults(index);
  });

  // Back/Forward (panel chi tiết đổi `?id=`): đọc lại các dòng của mục lịch sử đang tới.
  window.addEventListener("popstate", () => {
    rows = upgradeRowsFromQuery(location.search, records);
    render();
  });

  mount.hidden = false;
  if (rows.length) box.open = true;
  render();
  return { render };
}
