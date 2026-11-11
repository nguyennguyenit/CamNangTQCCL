// Phần hiển thị của badge kho trên danh sách Đội chuẩn (#62): badge "Ráp được / Thiếu N món" gắn lên thẻ và hàng
// bảng ĐÃ dựng (theo `data-reference-key`), dòng tóm tắt, nút lọc/sắp theo kho, và dòng dẫn khi máy chưa có kho.
// Gắn lên DOM có sẵn thay vì đổi cây view, nên danh sách dựng sẵn lúc build và danh sách khi chưa có kho giữ nguyên.
// Số liệu do `js/roster-list-coverage.js` tính; module này chỉ vẽ.
import { L, localePath } from "./i18n.js";
import {
  ROSTER_FILTER_NEAR,
  ROSTER_FILTER_READY,
  ROSTER_SORT_EASIEST,
  sourceName,
  tacticDisplayName,
} from "./recommended-reference-state.js";

const BADGE_CLASS = "roster-stock-badge";

function node(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") element.className = value;
    else if (key === "dataset") Object.assign(element.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2).toLowerCase(), value);
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  element.append(...[].concat(children).filter((child) => child !== null && child !== undefined));
  return element;
}

/**
 * Tên một món thiếu theo ngôn ngữ trang: bản vi dùng tên game VN hiện hành; bản zh dùng tên Hán của từ điển
 * (`nameZh`), rồi mới tới bộ tra tên của trang; chỉ ô chưa đối chiếu được mới còn tên gốc của nguồn.
 */
function missingItemText(item) {
  const vi = item.kind === "tactic" ? tacticDisplayName(item.name) : item.name;
  const name = L(vi, item.nameZh || sourceName(item.name) || item.name);
  if (item.kind === "hero") return L(`tướng ${name}`, `武将${name}`);
  return item.unresolved
    ? L(`chiến pháp ${name} (chưa đối chiếu)`, `战法${name}（尚未核对）`)
    : L(`chiến pháp ${name}`, `战法${name}`);
}

/** Badge của một đội: `entry` là `{missingCount, missing}` của `buildListCoverage`. */
export function coverageBadgeNode(entry) {
  const ready = entry.missingCount === 0;
  const list = entry.missing.map(missingItemText).join(L(", ", "、"));
  return node("span", {
    class: `badge ${BADGE_CLASS} ${ready ? "is-ready" : "is-missing"}`,
    dataset: { missingCount: String(entry.missingCount) },
    title: ready ? L("Kho của bạn có đủ tướng và chiến pháp của đội này", "你的库存已有该阵容的全部武将和战法") : L(`Thiếu: ${list}`, `缺少：${list}`),
  }, ready ? L("Ráp được", "可组建") : L(`Thiếu ${entry.missingCount} món`, `缺 ${entry.missingCount} 件`));
}

/**
 * Gắn (hoặc gỡ) badge cho mọi thẻ/hàng trong `root`. Gọi lại bao nhiêu lần cũng được: badge cũ bị thay.
 * `byConfigId` rỗng hoặc `null` thì chỉ gỡ badge.
 */
export function decorateCoverageBadges(root, byConfigId) {
  if (!root) return;
  for (const item of root.querySelectorAll("[data-reference-key]")) {
    for (const old of item.querySelectorAll(`.${BADGE_CLASS}`)) old.remove();
    const entry = byConfigId?.get(item.dataset.sourceConfigId || item.dataset.referenceKey);
    if (!entry) continue;
    const host = item.querySelector(".reference-card-title, .reference-table-team");
    host?.append(coverageBadgeNode(entry));
  }
}

/** Dòng tóm tắt "ráp được X / Y đội của mùa". */
export function rosterSummaryNode(summary) {
  return node("p", { class: "reference-roster-summary" }, [
    L("Kho của bạn ráp được ", "你的库存可组建 "),
    node("strong", {}, `${summary.complete} / ${summary.total}`),
    L(" đội của mùa này.", " 支本赛季阵容。"),
  ]);
}

/** Dòng dẫn khi máy chưa có kho: không có badge, chỉ một link sang Gợi ý đội. */
export function rosterHintNode() {
  return node("p", { class: "reference-roster-hint" }, [
    L("Nhập kho ở ", "在"),
    node("a", { href: localePath("/goi-y-doi-tu-kho/") }, L("Gợi ý đội", "武将库配队")),
    L(" để xem đội nào ráp được.", "中录入库存，即可查看哪些阵容可组建。"),
  ]);
}

/**
 * Nút lọc và sắp theo kho. `filter` là giá trị `kho` đang bật (`null` = không lọc), `sort` là giá trị `xep`.
 * `onChange({kho, xep})` nhận phần thay đổi để ghi lên query; bấm lại nút đang bật thì tắt.
 */
export function rosterControlNodes({ filter = null, sort = null, onChange }) {
  const chip = (label, active, change, focusKey) => node("button", {
    type: "button",
    class: `fchip roster-chip${active ? " on" : ""}`,
    "aria-pressed": String(active),
    dataset: { focusKey },
    onClick: () => onChange(change),
  }, [node("span", { class: "fchip-check", "aria-hidden": "true" }), node("span", { class: "fchip-label" }, label)]);
  return node("div", { class: "reference-roster-controls", role: "group", "aria-label": L("Lọc và sắp theo kho", "按库存筛选和排序") }, [
    chip(L("Ráp được", "可组建"), filter === ROSTER_FILTER_READY, { kho: filter === ROSTER_FILTER_READY ? null : ROSTER_FILTER_READY }, "kho:rap-duoc"),
    chip(L("Thiếu tối đa 2", "最多缺 2 件"), filter === ROSTER_FILTER_NEAR, { kho: filter === ROSTER_FILTER_NEAR ? null : ROSTER_FILTER_NEAR }, "kho:thieu-2"),
    chip(L("Dễ ráp nhất", "最易组建"), sort === ROSTER_SORT_EASIEST, { xep: sort === ROSTER_SORT_EASIEST ? null : ROSTER_SORT_EASIEST }, "xep:de-rap"),
  ]);
}
