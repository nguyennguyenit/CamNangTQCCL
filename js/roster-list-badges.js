// Phần hiển thị của badge kho trên danh sách Đội chuẩn (#62): badge "Ráp được / Thiếu N món" kèm dòng "Thiếu: …" gắn
// lên thẻ và hàng bảng ĐÃ dựng (theo `data-reference-key`), thanh kho (tóm tắt, thanh đo, chú giải, nút lọc/sắp theo kho),
// và khối dẫn khi máy chưa có kho — theo artboard MainKho / MainKhoMobile.
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
/** Khối badge + dòng món thiếu gắn vào thẻ/hàng; gỡ cả khối khi vẽ lại. */
const COVERAGE_CLASS = "roster-stock-cov";
const SVG_NS = "http://www.w3.org/2000/svg";

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

/** Biểu tượng nét (trang trí, `aria-hidden`): `paths` là các thuộc tính `d`. */
function strokeIcon(paths, size) {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [key, value] of Object.entries({
    "aria-hidden": "true", width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round",
  })) svg.setAttribute(key, String(value));
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

const ICON_READY = ["M5 12l5 5L20 7"];
const ICON_MISSING = ["M12 3.5l9 15.5H3z", "M12 10v4", "M12 16.8v.2"];
const ICON_SORT = ["M7 4v16", "M3 16l4 4 4-4", "M14 6h7", "M14 12h5", "M14 18h3"];
const ICON_STOCK = ["M4 4h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M5 9v10h14V9", "M10 13h4"];
const ICON_ARROW = ["M5 12h14", "M13 6l6 6-6 6"];

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

/** Badge "Ráp được" / "Thiếu N món" có icon; badge đủ kho giữ `title` gợi ý, badge thiếu không lặp danh sách vào `title`. */
function badgeNode(entry) {
  const ready = entry.missingCount === 0;
  return node("span", {
    class: `badge ${BADGE_CLASS} ${ready ? "is-ready" : "is-missing"}`,
    dataset: { missingCount: String(entry.missingCount) },
    title: ready ? L("Kho của bạn có đủ tướng và chiến pháp của đội này", "你的库存已有该阵容的全部武将和战法") : null,
  }, [
    strokeIcon(ready ? ICON_READY : ICON_MISSING, 13),
    ready ? L("Ráp được", "可组建") : L(`Thiếu ${entry.missingCount} món`, `缺 ${entry.missingCount} 件`),
  ]);
}

/** Dòng "Thiếu: tướng …, chiến pháp …" (bản zh "缺少：武将…、战法…", không dấu cách sau dấu hai chấm toàn khổ). */
function missingListNode(entry, attrs = {}) {
  const list = entry.missing.map(missingItemText).join(L(", ", "、"));
  return node("p", { class: "roster-stock-missing", ...attrs }, [node("b", {}, L("Thiếu:", "缺少：")), L(` ${list}`, list)]);
}

/**
 * Badge của một đội kèm danh sách món thiếu hiện ngay trên thẻ (artboard MainKho `.kb-cov`): `entry` là
 * `{missingCount, missing}` của `buildListCoverage`. Danh sách là chữ thường trên thẻ — xem được trên màn hình cảm ứng
 * và trình đọc màn hình đọc theo thứ tự (badge rồi "Thiếu: …").
 */
export function coverageBadgeNode(entry) {
  return node("div", { class: COVERAGE_CLASS }, [badgeNode(entry), entry.missingCount === 0 ? null : missingListNode(entry)]);
}

/** Hàng phụ dưới hàng đội ở kiểu Bảng chứa danh sách món thiếu (ngoài ô tiêu đề hàng `th scope=row`). */
const MISSING_ROW_CLASS = "roster-stock-missing-row";
let missingIdSeq = 0;

/**
 * Kiểu Bảng: badge ở lại trong ô đội (`th scope=row`), danh sách món thiếu nằm ở hàng phụ trải hết bề rộng ngay dưới,
 * badge trỏ tới nó bằng `aria-describedby` — tiêu đề hàng của các ô tướng chỉ còn tên đội + badge, không kéo cả danh sách.
 */
function decorateTableRow(row, entry) {
  const host = row.querySelector(".reference-table-team");
  if (!host) return;
  const badge = badgeNode(entry);
  host.append(node("div", { class: COVERAGE_CLASS }, badge));
  if (entry.missingCount === 0) return;
  const id = `roster-missing-${++missingIdSeq}`;
  badge.setAttribute("aria-describedby", id);
  row.after(node("tr", { class: MISSING_ROW_CLASS }, node("td", { colspan: String(row.children.length) }, missingListNode(entry, { id }))));
}

/**
 * Gắn (hoặc gỡ) badge cho mọi thẻ/hàng trong `root`. Gọi lại bao nhiêu lần cũng được: badge cũ bị thay.
 * `byConfigId` rỗng hoặc `null` thì chỉ gỡ badge.
 */
export function decorateCoverageBadges(root, byConfigId) {
  if (!root) return;
  for (const old of root.querySelectorAll(`.${MISSING_ROW_CLASS}`)) old.remove();
  for (const item of root.querySelectorAll("[data-reference-key]")) {
    for (const old of item.querySelectorAll(`.${COVERAGE_CLASS}`)) old.remove();
    const entry = byConfigId?.get(item.dataset.sourceConfigId || item.dataset.referenceKey);
    if (!entry) continue;
    if (item.tagName === "TR") decorateTableRow(item, entry);
    else item.querySelector(".reference-card-title")?.append(coverageBadgeNode(entry));
  }
}

/** Câu "Kho của bạn ráp được X / Y đội của mùa" (`allSeasons`: phạm vi "Tất cả", đếm đội của mọi mùa). */
function summaryLine(summary, allSeasons) {
  return node("p", { class: "reference-roster-summary" }, [
    L("Kho của bạn ráp được ", "你的库存可组建 "),
    node("strong", {}, `${summary.complete} / ${summary.total}`),
    allSeasons ? L(" đội của mọi mùa.", " 支全部赛季阵容。") : L(" đội của mùa này.", " 支本赛季阵容。"),
  ]);
}

const percent = (part, total) => `${total ? Math.round((part / total) * 1000) / 10 : 0}%`;

/**
 * Đang lọc theo chip (loại binh, phe, tier…) hoặc tìm từ khoá: số "Ráp được N" của cả mùa sẽ lệch với danh sách đang
 * hiện, nên ẩn số khi có lọc/tìm và hiện lại khi bỏ (thanh kho vẽ lại ở mỗi lần đổi lọc). Đọc từ DOM của chính khu danh
 * sách vì `team-filter-section.js` (bị ghim hash bản dịch) không truyền trạng thái lọc vào thanh kho.
 */
function listNarrowed(bar) {
  const section = bar.closest("section, [id^='section-']") ?? bar.parentElement;
  if (!section) return false;
  if (section.querySelector(".reference-filters .fchip[aria-pressed='true']")) return true;
  return Boolean(section.querySelector(".reference-search-input")?.value.trim());
}

/**
 * Số đội trên hai nút lọc ("Ráp được 4", "Thiếu tối đa 2 10") của cụm nút nằm cạnh khối tóm tắt trong cùng thanh kho.
 * Điều kiện để chạy đúng (hợp đồng ngầm với `paintRosterBar` của `js/team-filter-section.js`, file bị ghim hash bản dịch
 * nên không đổi được chữ ký):
 * - khối tóm tắt và cụm nút được gắn vào CÙNG một phần tử cha (thanh kho), cụm nút là anh em của khối;
 * - cả hai được tạo và gắn trong CÙNG một lượt đồng bộ (`rosterBar.replaceChildren(rosterSummaryNode(…),
 *   rosterControlNodes(…))`), để microtask dưới đây chạy khi cả hai đã ở trong DOM;
 * - hàm này có tác dụng phụ lên phần tử anh em (thêm/gỡ `.fchip-count` trong nút lọc) — gọi `rosterSummaryNode` ở nơi
 *   khác (trang mùa cũ) phải dùng `{ line: true }` để không có tác dụng phụ này.
 * Khi bỏ được ghim hash, nên truyền số vào `rosterControlNodes` trực tiếp thay cho microtask.
 */
function fillControlCounts(block, summary) {
  queueMicrotask(() => {
    const bar = block.parentElement;
    const controls = bar?.querySelector(".reference-roster-controls");
    if (!controls) return;
    const hidden = listNarrowed(bar);
    const counts = { "kho:rap-duoc": summary.complete, "kho:thieu-2": summary.complete + summary.near };
    for (const [key, count] of Object.entries(counts)) {
      const chip = controls.querySelector(`[data-focus-key="${key}"]`);
      if (!chip) continue;
      chip.querySelector(".fchip-count")?.remove();
      if (hidden) continue;
      // Dấu cách đầu số: tên truy cập của nút đọc "Ráp được 4", không dính "Ráp được4" (flex item bỏ khoảng trắng đầu dòng).
      chip.append(node("span", { class: "fchip-count" }, ` ${count}`));
    }
  });
}

/**
 * Tóm tắt kho. `summary` của `buildListCoverage` có đủ ba mức và cỡ kho thì vẽ khối của artboard MainKho: câu ráp được,
 * thanh đo hai đoạn (`role=meter`: ráp được, thiếu 1–2 món), chú giải ba mức và nguồn kho + link "Sửa kho"; `line: true`
 * (trang mùa cũ) hoặc `summary` chỉ có `complete/total` thì chỉ một câu.
 * Bản đầy đủ có tác dụng phụ lên phần tử anh em: sau lượt vẽ, nó điền số đội vào cụm nút `rosterControlNodes` gắn cùng
 * cha trong cùng lượt đồng bộ (điều kiện ghi ở `fillControlCounts`).
 */
export function rosterSummaryNode(summary, { allSeasons = false, line = false } = {}) {
  const detailed = !line && Number.isFinite(summary.near) && Number.isFinite(summary.far);
  if (!detailed) return summaryLine(summary, allSeasons);
  const { complete, near, far, total, roster } = summary;
  const meter = node("div", {
    class: "roster-meter",
    role: "meter",
    "aria-label": L("Độ phủ kho", "库存覆盖"),
    "aria-valuemin": "0",
    "aria-valuemax": String(total),
    "aria-valuenow": String(complete),
    "aria-valuetext": L(`${complete} trên ${total} đội ráp được`, `${total} 支中可组建 ${complete} 支`),
  }, [node("span", { class: "roster-meter-ready" }), node("span", { class: "roster-meter-near" })]);
  meter.children[0].style.width = percent(complete, total);
  meter.children[1].style.width = percent(near, total);
  const swatch = (band) => node("i", { class: `roster-swatch is-${band}`, "aria-hidden": "true" });
  const source = roster
    ? node("p", { class: "roster-source" }, [
      roster.source === "cloud"
        ? L(`Theo kho tài khoản (bản lưu trên máy này): ${roster.heroes} tướng · ${roster.tactics} chiến pháp. `, `依据账号库存（本机缓存）：${roster.heroes} 名武将 · ${roster.tactics} 个战法。`)
        : L(`Theo kho đã lưu trên máy này: ${roster.heroes} tướng · ${roster.tactics} chiến pháp. `, `依据本机保存的库存：${roster.heroes} 名武将 · ${roster.tactics} 个战法。`),
      node("a", { href: localePath("/goi-y-doi-tu-kho/") }, L("Sửa kho", "编辑库存")),
    ])
    : null;
  const block = node("div", { class: "roster-summary-block" }, [
    summaryLine(summary, allSeasons),
    meter,
    node("p", { class: "roster-legend" }, [
      node("span", {}, [swatch("ready"), L(`${complete} ráp được`, `${complete} 支可组建`)]),
      node("span", {}, [swatch("near"), L(`${near} thiếu 1–2 món`, `${near} 支缺 1–2 件`)]),
      node("span", {}, [swatch("far"), L(`${far} thiếu từ 3 món`, `${far} 支缺 3 件以上`)]),
    ]),
    source,
  ]);
  fillControlCounts(block, summary);
  return block;
}

/**
 * Máy đang có phiên đăng nhập (dấu hiệu phiên của `js/community-api.js`, khoá `tqccl:community-session`). Chỉ dùng để chọn
 * câu dẫn; đọc đồng bộ vì `rosterHintNode` được gọi đồng bộ trong lượt vẽ thanh kho.
 */
function signedInHint() {
  try {
    return Boolean(globalThis.localStorage?.getItem("tqccl:community-session"));
  } catch {
    return false;
  }
}

/**
 * Khối dẫn khi máy chưa có kho (artboard MainKho "Chưa có kho"): biểu tượng kho, một dòng dẫn sang Gợi ý đội và nút
 * "Nhập kho"; không có badge. Trả fragment ba phần tử để thanh kho xếp chúng thành ba cột. Câu dẫn theo nguồn kho: khách
 * đọc kho lưu trên máy (không cần đăng nhập); người đã đăng nhập đọc kho tài khoản, nên câu nói kho tài khoản chưa có.
 */
export function rosterHintNode() {
  const href = localePath("/goi-y-doi-tu-kho/");
  const fragment = document.createDocumentFragment();
  fragment.append(
    node("span", { class: "roster-empty-icon", "aria-hidden": "true" }, strokeIcon(ICON_STOCK, 20)),
    node("p", { class: "reference-roster-hint" }, [
      L("Nhập kho ở ", "在"),
      node("a", { href }, L("Gợi ý đội", "武将库配队")),
      signedInHint()
        ? L(" để xem đội nào ráp được. Kho của tài khoản bạn chưa có trên máy này.", "中录入库存，即可查看哪些阵容可组建。本机暂无你的账号库存。")
        : L(" để xem đội nào ráp được. Kho chỉ đọc trên máy này, không cần đăng nhập.", "中录入库存，即可查看哪些阵容可组建。库存只在本机读取，无需登录。"),
    ]),
    node("a", { class: "roster-empty-cta", href }, [L("Nhập kho", "录入库存"), strokeIcon(ICON_ARROW, 16)]),
  );
  return fragment;
}

/**
 * Nút lọc và sắp theo kho, kèm nhãn "Lọc và sắp theo kho", vạch ngăn và ghi chú khi đang sắp. `filter` là giá trị `kho`
 * đang bật (`null` = không lọc), `sort` là giá trị `xep`. `onChange({kho, xep})` nhận phần thay đổi để ghi lên query;
 * bấm lại nút đang bật thì tắt. Số đội trên hai nút lọc do khối tóm tắt bản đầy đủ (`rosterSummaryNode`) điền sau lượt
 * vẽ, khi cụm nút này được gắn cùng cha và cùng lượt đồng bộ với khối đó (`fillControlCounts`); dùng riêng thì nút không
 * có số.
 */
export function rosterControlNodes({ filter = null, sort = null, onChange }) {
  const chip = (label, active, change, focusKey, icon = null) => node("button", {
    type: "button",
    class: `fchip roster-chip${active ? " on" : ""}`,
    "aria-pressed": String(active),
    dataset: { focusKey },
    onClick: () => onChange(change),
  }, [
    node("span", { class: "fchip-check", "aria-hidden": "true" }),
    icon ? strokeIcon(icon, 15) : null,
    node("span", { class: "fchip-label" }, label),
  ]);
  const sorted = sort === ROSTER_SORT_EASIEST;
  return node("div", { class: "reference-roster-controls", role: "group", "aria-label": L("Lọc và sắp theo kho", "按库存筛选和排序") }, [
    node("span", { class: "roster-controls-label", "aria-hidden": "true" }, L("Lọc và sắp theo kho", "按库存筛选和排序")),
    chip(L("Ráp được", "可组建"), filter === ROSTER_FILTER_READY, { kho: filter === ROSTER_FILTER_READY ? null : ROSTER_FILTER_READY }, "kho:rap-duoc"),
    chip(L("Thiếu tối đa 2", "最多缺 2 件"), filter === ROSTER_FILTER_NEAR, { kho: filter === ROSTER_FILTER_NEAR ? null : ROSTER_FILTER_NEAR }, "kho:thieu-2"),
    node("span", { class: "roster-controls-sep", "aria-hidden": "true" }),
    chip(L("Dễ ráp nhất", "最易组建"), sorted, { xep: sorted ? null : ROSTER_SORT_EASIEST }, "xep:de-rap", ICON_SORT),
    sorted ? node("p", { class: "roster-sorted-note" }, L("Sắp theo số món thiếu, giữ khối theo bậc.", "按缺少件数排序，保留分级区块。")) : null,
  ]);
}
