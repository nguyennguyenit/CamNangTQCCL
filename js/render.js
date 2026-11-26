// Builder markup thuần — nhận data, không state, không innerHTML data thô. Nội dung đội (thẻ, nhóm Cùng Tồn,
// Khai hoang) là cây view (`t`/`h`, chạy trong Node không cần `document`); `el`/`svgNode`/`icon` còn dựng DOM
// trực tiếp cho phần chỉ có ở trình duyệt (chrome tương tác, `seasonConfigDetail`, các công cụ).

import { legacyLabelZh, sourceName, sourcePrefixedTactic, tacticDisplayName } from './recommended-reference-state.js';
import { L, contentLocaleIsVietnamese, contentMode, currentLocale, withLocale } from './i18n.js';
import { h, treeToDom, enableControl } from './view-tree.js';

/** Helper tạo element gọn. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Element SVG tĩnh: `document.createElementNS`, không dựng hình bằng chuỗi HTML. */
export function svgNode(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value != null) node.setAttribute(key, String(value));
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

/**
 * Nút cây view với chữ ký của `el`: `class`, `dataset` (thành `data-*`) và thuộc tính thường. Cây không mang
 * sự kiện nên prop hàm bị từ chối; builder gắn sự kiện sau `treeToDom` bằng `data-*` / class có sẵn.
 */
export function t(tag, props = {}, children = []) {
  const attrs = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "function") throw new Error(`Cây view không mang sự kiện: ${tag}.${key}`);
    if (key === "dataset") {
      for (const [name, data] of Object.entries(value)) attrs[`data-${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`] = data;
    } else attrs[key] = value;
  }
  return h(tag, attrs, children);
}

/** Nút SVG dạng cây (`treeToDom` tạo bằng `createElementNS`). */
export const svgTree = (tag, attrs = {}, children = []) => h(tag, attrs, children);

/** Icon nét trang trí dạng cây, cùng thuộc tính với `icon`. */
export const iconTree = (children, { size = 18, stroke = 1.8, viewBox = "0 0 24 24" } = {}) => svgTree("svg", {
  "aria-hidden": "true",
  width: size,
  height: size,
  viewBox,
  fill: "none",
  stroke: "currentColor",
  "stroke-width": stroke,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
}, children);

/** Icon nét trang trí (aria-hidden) theo quy ước artboard: khung vuông, nét tròn 1.8. */
export function icon(children, { size = 18, stroke = 1.8, viewBox = "0 0 24 24" } = {}) {
  return svgNode("svg", {
    "aria-hidden": "true",
    width: size,
    height: size,
    viewBox,
    fill: "none",
    stroke: "currentColor",
    "stroke-width": stroke,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }, children);
}

const CJK_TEXT = /[\u3400-\u9fff\uf900-\ufaff]/u;
// `sourceText`: trang không phải bản Việt hiện chữ nguồn (chữ Hán) thay cho lớp dịch Việt; hiện chỉ có bản zh.
const sourceText = () => !contentLocaleIsVietnamese(currentLocale());
/**
 * Bản ja: văn xuôi chữ Trung của nguồn chưa có bản dịch Nhật nên bị ẩn, thay bằng đúng một dòng báo thiếu (ghi chú đội Đội chuẩn,
 * panel cấu hình mùa `?config=`).
 */
export const SOURCE_PROSE_MISSING_JA = "中国語の原文しかない説明は、日本語訳がないため表示していません。";
/**
 * Chữ công khai của một trường nguồn. Bản vi: chuỗi còn chữ Hán không được hiện (dùng nhãn dự phòng).
 * Bản zh: dữ liệu không áp bản dịch nên chữ Hán gốc là nội dung chính, hiện nguyên.
 */
const publicText = (value, fallback = L("Nội dung tiếng Việt chưa sẵn sàng", "内容尚未就绪", "内容はまだ準備中です")) =>
  typeof value === "string" && value.trim() && (sourceText() || !CJK_TEXT.test(value)) ? value.trim() : fallback;
/**
 * Giữ tiền tố bản cải tạo của chiến pháp và dàn dấu phân cách như các nhãn trên thẻ đội. Bản ja giữ nguyên: tên đã qua bộ tra
 * tên Nhật mang sẵn dạng `転・<tên>` của bản Nhật.
 */
export const formatModifiedTactic = value => typeof value === "string" && contentMode(currentLocale()) !== "ja"
  ? value.replace(/^(Tinh|Chuyển|Thác|精|轉|拓)\s*[·・]\s*/u, "$1 · ")
  : value;
/** Tên chiến pháp lưu trong dữ liệu → tên hiển thị của trang (bản vi: `viet` hiện hành của danh mục; bản zh: chữ Hán nguồn). */
const tacticName = (value) => tacticDisplayName(sourceName(value));
/** Văn xuôi tác giả viết bằng tiếng Việt (ghi chú, hướng dẫn): bản zh bỏ hẳn để trang không trộn hai ngôn ngữ. */
const viProse = (value) => (sourceText() ? "" : value);

const UNIT_CLASS = { "Kỵ": "u-ky", "Cung": "u-cung", "Thương": "u-thuong", "Khiên": "u-khien" };
/** Nhãn loại binh của dữ liệu cũ theo ngôn ngữ trang (class màu vẫn tra theo giá trị gốc). */
export const unitLabel = (value) => legacyLabelZh("unit", value) ?? value;
// Phe -> hậu tố class màu (Ngụy xanh đậm, Thục xanh lá, Ngô đỏ, Quần vàng, Hán xanh mòng két).
export const FACTION_CODE = { "Ngụy": "nguy", "Thục": "thuc", "Ngô": "ngo", "Quần": "quan", "Hán": "han", "Hỗn hợp": "honhop" };
// Nhãn nguồn của đội cũ (`data/teams.json`): chip Nguồn ở Đội khác và trang chi tiết.
export const SOURCE_LABEL = {
  "team-intro": "Giới thiệu",
  "do-uy": "Đô úy",
  "moi-phe": "Meta phe (cũ)",
  "youtube": "YouTube",
};
/** Nhãn nguồn đội cũ theo ngôn ngữ trang; giá trị lạ trả nguyên mã. */
export const sourceLabel = (value) => legacyLabelZh("source", value) ?? SOURCE_LABEL[value] ?? value;

/** Chuẩn hoá CRLF của trường nguồn nhiều dòng; chuỗi đã nhận được giữ nguyên, không trim. */
const sourceTextLines = (value) => (typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "");
/** Trường nguồn nhiều dòng hiện gọn trên thẻ: cắt khoảng trắng hai đầu mỗi dòng, bỏ dòng trống, giữ ngắt dòng. */
const sourceLines = (value) => sourceTextLines(value).split("\n").map((line) => line.trim()).filter(Boolean).join("\n");

/**
 * Nội dung một trường thô của nguồn: chỉ cắt khoảng trắng để biết ô có rỗng không, còn chữ hiện nguyên văn
 * (kể cả khoảng trắng cuối dòng của nguồn). Kiểm tra an toàn tiếng Việt giữ như trước: chuỗi còn chữ Hán
 * không được hiện ra. Trả `null` khi không có gì để dựng ô.
 */
const sourceFieldText = (value) => {
  const text = sourceTextLines(value);
  if (!text.trim()) return null;
  return CJK_TEXT.test(text) && !sourceText() ? publicText(text) : text;
};

/**
 * Tên tướng của nguồn Cùng Tồn ghi phần phụ ở dòng cuối (`"Hứa Du\n(Thương S)"`).
 * Chỉ tách để hiện: dòng cuối khớp `pattern` thành pill, các dòng còn lại nối bằng dấu cách như trước.
 */
function splitSourceTag(value, pattern) {
  const lines = String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const tag = lines.length > 1 ? lines[lines.length - 1].match(pattern) : null;
  return tag ? { name: lines.slice(0, -1).join(" "), tag: tag[1] } : { name: lines.join(" "), tag: "" };
}
const TEAM_LEVEL_TAG = /^(\d+C)$/;
const HERO_NOTE_TAG = /^[(（](.+)[)）]$/u;

/**
 * Tên đội Cùng Tồn của nguồn: dòng đầu luôn là tên; các dòng sau có thể là cấp đội (`19C`), ghi chú phụ trong ngoặc
 * (`(Kỹ Năng Quân Sư Điêu Thuyền)`) hoặc phần tên viết xuống dòng. Cấp và ghi chú nhận ở bất kỳ vị trí nào sau dòng đầu
 * (`"Tiềm Long Lữ Bố Cung\n19C\n(Kỹ Năng Quân Sư Điêu Thuyền)"` → tên + `19C` + ghi chú); dòng còn lại nối vào tên bằng
 * dấu cách như trước. Chỉ lấy cấp đầu tiên; dòng cấp thứ hai (nguồn chưa có) giữ nguyên trong tên để không mất chữ.
 */
function splitTeamName(value) {
  const [first = "", ...rest] = String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const name = [first];
  const notes = [];
  let level = "";
  for (const line of rest) {
    const levelMatch = level ? null : line.match(TEAM_LEVEL_TAG);
    const noteMatch = line.match(HERO_NOTE_TAG);
    if (levelMatch) level = levelMatch[1];
    else if (noteMatch) notes.push(noteMatch[1].trim());
    else name.push(line);
  }
  return { name: name.join(" "), level, note: notes.join(" · ") };
}

/**
 * Số liệu kiểm tra trùng của một nhóm: số đội, số tướng khác nhau và tên tướng xuất hiện hơn một lần
 * (tính trực tiếp từ mảng tướng của từng đội, không đọc thêm trường dữ liệu nào).
 */
export function coexistCounts(teams = []) {
  const appearances = new Map();
  for (const team of teams || []) for (const hero of team.heroes || []) {
    const name = typeof hero?.name === "string" ? hero.name : "";
    // Tên chưa tra được chữ Hán (bản zh) không phải một tướng cụ thể nên không tính trùng.
    if (!name || name === UNRESOLVED_NAME) continue;
    appearances.set(name, (appearances.get(name) ?? 0) + 1);
  }
  return {
    teams: (teams || []).length,
    heroes: appearances.size,
    duplicates: [...appearances].filter(([, count]) => count > 1).map(([name]) => name),
  };
}

/**
 * Chuẩn hóa hai nhánh dữ liệu Cùng Tồn về cùng một khung hiển thị: nhánh bảng gốc giữ nguyên văn
 * mọi trường nội dung, nhánh legacy chỉ dùng đúng những trường nó có. Tên đội tách cấp (`level` "19C") và ghi chú
 * phụ trong ngoặc (`note`) ở mọi dòng sau tên; tên tướng tách phần phụ ở dòng cuối (`tag` "Thương S").
 * Cả hai nhánh đều ghi bằng tiếng Việt: bản zh đổi tên tướng/chiến pháp/binh thư sang chữ Hán gốc, tên đội
 * dựng lại từ tên tướng, còn văn xuôi, thích tính, cải tạo, Trang Bị, ghi chú đội/tướng (chưa có bản Trung) bị bỏ.
 * Trang Bị (`equipmentRaw`) và Thẻ Kỳ Lược (`strategyCardsRaw` + mã `strategyCardIds`) chỉ có ở bảng 11 cột; thẻ có
 * mã hiện ở mọi bản bằng tên client/chữ Hán/tên Nhật của catalog Kỳ lược.
 */
function coexistModel(reference) {
  const content = reference?.content || {};
  const zh = sourceText();
  if (reference?.source) {
    const empty = () => L("Chưa có dữ liệu", "暂无数据", "データがありません");
    // Ô trống giữ nhãn "chưa có dữ liệu"; bản zh bỏ ô có chữ mà không tra được chữ Hán.
    const slot = (value, zhName) => (zh && typeof value === "string" && value.trim() ? zhName(value.trim()) : publicText(value, empty()));
    return {
      groupLabel: zh ? coexistGroupLabel(content.groupLabel) : publicText(content.groupLabel),
      raw: zh
        ? { summary: "", opening: "", notes: "" }
        : { summary: content.summaryRaw, opening: content.openingSuggestionsRaw, notes: content.notesRaw },
      teams: (content.teams || []).map((team) => {
        const heroes = (team.heroes || []).map((hero) => {
          const { name, tag } = splitHeroName(publicText(hero.nameRaw));
          return {
            name: zh ? zhCoexistHeroName(name) : name,
            tag: zh ? "" : tag,
            tactics: (hero.tacticSlotsRaw || []).map((value) => slot(value, zhModifiedTactic) || null).filter(Boolean)
              .map((value) => formatModifiedTactic(tacticDisplayName(value))),
            books: (hero.bookSlotsRaw || []).map((value) => slot(value, sourceName) || null).filter(Boolean),
            statFocus: zh ? "" : publicText(hero.statFocusRaw, empty()),
            equipment: zh ? "" : publicText(sourceLines(hero.equipmentRaw), ""),
          };
        });
        const { name, level, note } = splitTeamName(publicText(team.teamNameRaw));
        const strategyCardIds = Array.isArray(team.strategyCardIds) ? [...team.strategyCardIds] : [];
        return {
          name: zh ? heroes.map((hero) => hero.name).filter((value) => value !== UNRESOLVED_NAME).join(" · ") || UNRESOLVED_NAME : name,
          level,
          note: zh ? "" : note,
          unitTacticEffects: zh ? "" : publicText(team.unitTacticEffectsRaw, ""),
          // Thẻ đã nối với catalog Kỳ lược lúc dựng dữ liệu (`strategyCardIds`) hiện ở mọi bản theo bảng tra;
          // chữ thô của nguồn chỉ còn là đường lui ở bản vi khi đội chưa có mã thẻ.
          strategyCardIds,
          strategyCards: zh || strategyCardIds.length ? "" : publicText(sourceLines(team.strategyCardsRaw), ""),
          heroes,
        };
      }),
    };
  }
  // Nhánh legacy: bản zh cũng tra chữ Hán từng tên; tên đội dựng lại từ tên tướng.
  return {
    groupLabel: coexistGroupLabel(content.groupLabel),
    raw: { summary: viProse(content.summary), opening: "", notes: "" },
    teams: (content.teams || []).map((team) => ({
      ...splitTeamName(zh
        ? (team.heroes || []).map((hero) => sourceName(hero.name || "")).filter(Boolean).join(" · ") || UNRESOLVED_NAME
        : team.teamName || ""),
      strategyCardIds: [],
      unitTacticEffects: viProse(team.unitTacticEffects || ""),
      heroes: (team.heroes || []).map((hero) => ({
        ...splitHeroName(seatName(hero.name || "")),
        tactics: (hero.tactics || []).map((value) => tacticName(value)).filter(Boolean),
        books: (hero.books || []).map((value) => sourceName(value)).filter(Boolean),
        statFocus: viProse(hero.statFocus || ""),
        advisorSkill: sourceName(hero.advisorSkill || ""),
      })),
    })),
  };
}

const splitHeroName = (value) => splitSourceTag(value, HERO_NOTE_TAG);

/** Tiền tố bản cải tạo của chiến pháp theo chữ Hán của nguồn (cùng tập với `formatModifiedTactic`). */
const MODIFIED_PREFIX_ZH = { Tinh: "精", Chuyển: "轉", Thác: "拓" };
/**
 * Bản không phải tiếng Việt: chiến pháp Hán-Việt → tên của bản đang xem; tiền tố "Tinh·" đổi sang "精" (bản ja: bộ tra tên Nhật
 * dựng `精・<tên>` hoặc tên kịch bản của `prefixedTactics`); không tra được thì chuỗi rỗng.
 */
function zhModifiedTactic(value) {
  const match = value.match(/^(Tinh|Chuyển|Thác)\s*[·・]\s*(.+)$/su);
  if (!match) return sourceName(value);
  const localized = sourcePrefixedTactic(match[1], match[2]);
  if (localized !== undefined) return localized;
  const name = sourceName(match[2]);
  return name ? `${MODIFIED_PREFIX_ZH[match[1]]} · ${name}` : "";
}
/** Bản zh: tên tướng của bảng Cùng Tồn → chữ Hán; hậu tố "40th" của nguồn thành tiền tố `40Y` như chip biến thể. */
function zhCoexistHeroName(value) {
  const aged = value.match(/^(.+?)\s*40th$/iu);
  const name = seatName(aged ? aged[1] : value);
  return aged && name !== UNRESOLVED_NAME ? `40Y ${name}` : name;
}

/**
 * Nhãn nhóm Cùng Tồn theo ngôn ngữ trang. Bản vi: nhãn nguồn, thiếu thì "Nhóm". Bản zh: nhãn chữ Hán giữ nguyên,
 * "Cùng tồn N" đổi thành "共存 N", nhãn tiếng Việt khác dùng nhãn chung.
 */
export function coexistGroupLabel(label) {
  const value = typeof label === "string" ? label.trim() : "";
  if (!sourceText()) return value || "Nhóm";
  if (CJK_TEXT.test(value)) return sourceName(value);
  const number = value.match(/^Cùng tồn\s*(\d+)$/iu)?.[1];
  return number ? L(`Cùng tồn ${number}`, `共存 ${number}`, `共存 ${number}`) : L("Nhóm", "分组", "グループ");
}

/**
 * 1 phiên bản Cùng Tồn: dòng tóm tắt + kiểm tra trùng tướng, phần ghi chú/gợi ý khai hoang gập
 * trong một disclosure, rồi lưới thẻ đội. Trả cây view. `teamCard(team)` dựng cây thẻ (dùng chung khung thẻ Đội
 * chuẩn); `locale` ép ngôn ngữ khi dựng ngoài trình duyệt (mặc định ngôn ngữ trang).
 */
export function seasonCoexistGroup(reference, { teamCard, locale } = {}) {
  return withLocale(locale, () => coexistGroupTree(reference, teamCard));
}

function coexistGroupTree(reference, teamCard) {
  const model = coexistModel(reference);
  const counts = coexistCounts(model.teams);
  const rawBlock = (label, value) => {
    const text = sourceFieldText(value);
    if (text === null) return null;
    // Nguồn tự mở đầu bằng đúng nhãn (vd. "Ghi chú\n…"): giữ nguyên văn, bỏ nhãn trùng và tô dòng đầu như nhãn.
    const titled = text.split("\n")[0].trim().replace(/:$/, "").toLocaleLowerCase("vi") === label.toLocaleLowerCase("vi");
    return t("div", { class: "coexist-note-block" }, [
      titled ? null : t("span", { class: "coexist-col-label" }, label),
      t("p", { class: titled ? "coexist-raw-text coexist-raw-titled" : "coexist-raw-text" }, text),
    ].filter(Boolean));
  };
  const summary = sourceFieldText(model.raw.summary);
  const noteBlocks = [
    rawBlock(L("Ghi chú", "备注", "メモ"), model.raw.notes),
    rawBlock(L("Gợi ý khai hoang", "开荒建议", "開拓のヒント"), model.raw.opening),
  ].filter(Boolean);
  const props = { class: "coexist-group" };
  if (reference?.recordId) props.dataset = { recordId: reference.recordId };
  return t("section", props, [
    t("h2", { class: "visually-hidden" }, model.groupLabel),
    t("div", { class: "coexist-brief" }, [
      summary ? t("p", { class: "coexist-summary" }, summary) : null,
      t("p", { class: "coexist-count-line" }, [
        L(`${counts.teams} đội · ${counts.heroes} tướng · `, `${counts.teams} 队 · ${counts.heroes} 名武将 · `, `${counts.teams}編成 · 武将${counts.heroes}名 · `),
        counts.duplicates.length
          ? t("span", { class: "coexist-count-dup" }, L(`có trùng: ${counts.duplicates.join(", ")}`, `有重复：${counts.duplicates.join("、")}`, `重複あり：${counts.duplicates.join("、")}`))
          : t("span", { class: "coexist-count-ok" }, L("không trùng", "无重复", "重複なし")),
      ].filter(Boolean)),
    ].filter(Boolean)),
    noteBlocks.length
      ? t("details", { class: "coexist-notes" }, [
          t("summary", { class: "coexist-notes-summary" }, [
            L("Ghi chú & gợi ý khai hoang", "备注与开荒建议", "メモ・開拓のヒント"),
            iconTree([svgTree("polyline", { points: "6 9 12 15 18 9" })], { size: 16, stroke: 2 }),
          ]),
          t("div", { class: "coexist-notes-body" }, noteBlocks),
        ])
      : null,
    t("div", { class: "reference-view coexist-team-view" }, [
      t("div", { class: "team-grid" }, model.teams.map((team) => teamCard(team))),
    ]),
  ].filter(Boolean));
}

/** Chip chiến pháp (không bấm-search, chỉ hiển thị). */
function tacticChip(name, cls = "t-tactic") {
  return name ? t("span", { class: `tag ${cls}` }, name) : null;
}

const VARIANT_CLASS = { SP: "sp", CO: "co", "40Y": "y40" };

/** Tên tướng đã bản địa hoá → node; tiền tố biến thể (SP/CO/40Y) tách thành nhãn riêng như thẻ Đội chuẩn. */
export function variantNameNodes(value) {
  const match = value.match(VARIANT_NAME);
  if (!match) return [t("span", { class: "hn" }, value)];
  return [
    t("span", { class: `pre ${VARIANT_CLASS[match[1]]}` }, match[1]),
    " ",
    t("span", { class: "hn" }, match[2].trim()),
  ];
}

// Accept a separate prefix or one attached to Chinese text, never part of a Latin name.
const VARIANT_NAME = /^(SP|CO|40Y)(?:\s+|(?=[\u3400-\u9fff]))(.+)$/u;
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LATIN_EDGE = /[\p{Script=Latin}\p{N}]/u;

/**
 * Văn ghi chú → node: tên tướng trong đội (đủ tiền tố SP/CO/40Y hoặc tên gốc) in đậm.
 * Tên chữ Latin chỉ khớp trọn từ; tên chữ Hán khớp liền văn vì chữ Hán không có khoảng trắng.
 */
export function heroMentionNodes(value, names = []) {
  const terms = [...new Set(names.flatMap((name) => [name, name?.match(VARIANT_NAME)?.[2]?.trim()]))]
    .filter((name) => typeof name === "string" && name.trim().length > 1 && name !== UNRESOLVED_NAME)
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return [value];
  const pattern = new RegExp(terms.map((term) => [
    LATIN_EDGE.test(term.at(0)) ? "(?<![\\p{L}\\p{N}])" : "",
    escapeRegExp(term),
    LATIN_EDGE.test(term.at(-1)) ? "(?![\\p{L}\\p{N}])" : "",
  ].join("")).join("|"), "gu");
  const nodes = [];
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    if (match.index > last) nodes.push(value.slice(last, match.index));
    nodes.push(t("strong", { class: "detail-note-hero" }, match[0]));
    last = match.index + match[0].length;
  }
  if (last < value.length) nodes.push(value.slice(last));
  return nodes;
}

/** Badge loại binh của một giai đoạn: chỉ hiện khi khác loại binh chung của build (đầu thẻ đã nói loại binh đó). */
const stageUnit = (unitType, buildUnit) => unitType && unitType !== buildUnit
  ? t("span", { class: `badge unit small ${UNIT_CLASS[unitType] || ""}` }, unitLabel(unitType))
  : null;

/** Chiến pháp "Trước" và "Sau" của một tướng; tên không tra được chữ Hán (bản zh) bị bỏ. */
const stageTactics = (hero) => ({
  before: [tacticName(hero.tacticBefore)].filter(Boolean),
  after: (hero.tacticsAfter || []).map((tactic) => tacticName(tactic)).filter(Boolean),
});

/**
 * Quy ước chủ tướng của một build: tướng đứng đầu là chủ tướng trước cấp 20 (`commanderBefore` nếu có,
 * không thì tướng đầu của dữ liệu); `commanderAfter` là chủ tướng sau cấp 20, thiếu thì vẫn là tướng đầu.
 */
function commanderFirst(build) {
  const heroes = build.heroes || [];
  const index = heroes.findIndex((hero) => hero.name === build.commanderBefore);
  return index > 0 ? [heroes[index], ...heroes.slice(0, index), ...heroes.slice(index + 1)] : heroes;
}

/** Tên chủ tướng trước và sau cấp 20 theo quy ước trên. */
function buildCommanders(build) {
  const early = commanderFirst(build)[0]?.name || "";
  return { early, late: build.commanderAfter || early };
}

const COMMANDER_LABEL = () => L("Chủ tướng", "主将", "主将");
const EARLY_COMMANDER_LABEL = () => L("Chủ tướng trước cấp 20", "20级前主将", "Lv20前の主将");
const LATE_COMMANDER_LABEL = () => L("Chủ tướng sau cấp 20", "20级后主将", "Lv20後の主将");

/** Ấn "C" chủ tướng (cùng badge với trang chi tiết Đội chuẩn). */
const mainBadge = (label) => t("span", { class: "badge role main-holder", title: label, "aria-label": label }, L("C", "主", "主"));

/**
 * Chỗ đặt ấn "C" của một tướng: chủ tướng trước cấp 20 (tướng đứng đầu) luôn mang ấn sau tên (`name`);
 * đổi chủ tướng thì chủ tướng sau cấp 20 mang thêm ấn ở giai đoạn "Sau" (`after`).
 */
function commanderMarks(hero, build) {
  const { early, late } = buildCommanders(build);
  return {
    changed: early !== late,
    name: hero.name === early ? (early === late ? COMMANDER_LABEL() : EARLY_COMMANDER_LABEL()) : null,
    after: early !== late && hero.name === late ? LATE_COMMANDER_LABEL() : null,
  };
}

/**
 * Một dòng tướng của thẻ danh sách theo hàng cũ `tên | Trước · … → Sau · …`: tên kèm nhãn SP/CO/40Y,
 * chiến pháp là chip son. Tướng đứng đầu là chủ tướng trước cấp 20, ấn "C" đứng sau tên; đổi chủ tướng thì
 * chủ tướng sau cấp 20 mang ấn trước nhãn "Sau". Thẻ hẹp xếp tên / Trước / Sau mỗi phần một dòng.
 * Ghi chú chỉ ở trang chi tiết.
 */
function khaihoangHolder(hero, build) {
  const { before, after } = stageTactics(hero);
  const marks = commanderMarks(hero, build);
  // Nhiều chiến pháp "Sau" nối bằng " + " (ký hiệu, không phải chữ).
  const chips = (tactics) => tactics.map((name) => tacticChip(name))
    .flatMap((chip, index) => (index ? [t("span", { class: "kh-plus", "aria-hidden": "true" }, "+"), chip] : [chip]));
  const stage = (cls, label, unitType, tactics, slot = null) => tactics.length || stageUnit(unitType, build.unitType)
    ? t("span", { class: `kh-stage ${cls}` }, [
        slot,
        t("span", { class: "kh-label" }, label),
        t("span", { class: "kh-stage-chips" }, [stageUnit(unitType, build.unitType), ...chips(tactics)].filter(Boolean)),
      ].filter(Boolean))
    : null;
  const beforeStage = stage("kh-before", L("Trước", "前", "前期"), hero.unitTypeBefore, before);
  // Build đổi chủ tướng: mọi dòng giữ chỗ ấn trước nhãn "Sau" để nhãn các dòng vẫn thẳng cột.
  const afterStage = stage("kh-after", L("Sau", "后", "後期"), hero.unitTypeAfter, after,
    marks.changed ? t("span", { class: "kh-mark" }, marks.after ? mainBadge(marks.after) : []) : null);
  // Chủ tướng sau cấp 20 không có dòng "Sau" (dữ liệu chỉ có một mốc): ấn lùi về sau tên.
  const nameMark = marks.name || (marks.after && !afterStage ? marks.after : null);
  return t("div", { class: "hero reference-holder kh-holder" }, [
    t("div", { class: "hero-name" }, [...variantNameNodes(seatName(hero.name)), nameMark ? mainBadge(nameMark) : null].filter(Boolean)),
    beforeStage || afterStage ? t("div", { class: "kh-stages" }, [
      beforeStage,
      beforeStage && afterStage ? t("span", { class: "kh-arrow", "aria-hidden": "true" }, "→") : null,
      afterStage,
    ].filter(Boolean)) : null,
  ].filter(Boolean));
}

/** Ba dòng tướng của build đang chọn trên thẻ danh sách, chủ tướng trước cấp 20 ở dòng đầu (cây view). */
function khaihoangHolderTrees(build, { locale } = {}) {
  return withLocale(locale, () => commanderFirst(build).map((hero) => khaihoangHolder(hero, build)));
}

/**
 * Một thẻ tướng của trang chi tiết Khai hoang, cùng khung `detail-hero-card` với trang chi tiết Đội chuẩn:
 * đầu thẻ vai trò + loại binh đổi (nếu có), tên, chiến pháp "Trước" và "Sau" đánh số. Ấn "C" theo cùng quy tắc
 * với thẻ danh sách: chủ tướng trước cấp 20 sau tên; đổi chủ tướng thì thêm ấn ở nhãn "Chiến pháp sau".
 */
function khaihoangHeroCard(hero, build) {
  const { before, after } = stageTactics(hero);
  const { early, late } = buildCommanders(build);
  const isEarly = hero.name === early;
  const isLate = hero.name === late;
  const role = isEarly && isLate ? COMMANDER_LABEL()
    : isEarly ? EARLY_COMMANDER_LABEL()
    : isLate ? LATE_COMMANDER_LABEL()
    : L("Phó tướng", "副将", "副将");
  const isMain = isEarly;
  const marks = commanderMarks(hero, build);
  const nameMark = marks.name || (marks.after && !after.length ? marks.after : null);
  const units = [hero.unitTypeBefore, hero.unitTypeAfter].filter(Boolean);
  const unitShift = units.some((unit) => unit !== build.unitType)
    ? [...new Set(units)].map((unit) => unitLabel(unit)).join(" → ")
    : null;
  const tacticList = (names) => t("ol", { class: "detail-hero-tactics" }, names.map((name, index) => t("li", {}, [
    t("span", { class: "detail-hero-tactics-item" }, [
      t("span", { class: "detail-hero-tactics-index", "aria-hidden": "true" }, String(index + 1)),
      t("span", { class: "detail-hero-tactics-vi" }, name),
    ]),
  ])));
  const block = (cls, label, names, badge = null) => names.length
    ? t("div", { class: `detail-hero-block detail-hero-tactics-block ${cls}` }, [
        t("span", { class: "detail-hero-label" }, [label, badge ? " " : null, badge].filter(Boolean)),
        tacticList(names),
      ])
    : null;
  const head = [
    t("span", { class: "detail-hero-role" }, role),
    unitShift ? t("span", { class: "detail-hero-stat" }, unitShift) : null,
  ].filter(Boolean);
  return t("section", { class: `reference-detail-holder detail-hero-card kh-hero-card${isMain ? " is-main" : ""}` }, [
    t("header", { class: "detail-hero-head" }, head),
    t("h3", { class: "detail-hero-name" }, [...variantNameNodes(seatName(hero.name)), nameMark ? mainBadge(nameMark) : null].filter(Boolean)),
    block("kh-before", L("Chiến pháp trước", "前期战法", "前期の戦法"), before),
    block("kh-after", L("Chiến pháp sau", "后期战法", "後期の戦法"), after, marks.after ? mainBadge(marks.after) : null),
  ].filter(Boolean));
}

/**
 * Nội dung build đang chọn ở trang chi tiết: khối "Đội hình" (ba thẻ tướng) rồi khối "Ghi chú" (danh sách cây).
 * Ghi chú lấy đúng owner của build đang chọn — không mượn ghi chú của build mặc định.
 */
export function khaihoangBuildContent(build, { locale } = {}) {
  return withLocale(locale, () => buildContentTrees(build));
}

function buildContentTrees(build) {
  const heroes = commanderFirst(build);
  const cards = heroes.map((hero) => khaihoangHeroCard(hero, build));
  const names = heroes.map((hero) => seatName(hero.name));
  const note = (cls, value, owner = null) => viProse(value)
    ? t("li", { class: `detail-note ${cls}${owner ? " detail-note-holder" : ""}` }, owner
      ? [t("span", { class: "detail-note-owner" }, owner), t("span", { class: "detail-note-text" }, heroMentionNodes(value, names))]
      : heroMentionNodes(value, names))
    : null;
  const notes = [
    note("kh-build-note", build.buildNote),
    note("kh-opening-note", build.openingNote),
    ...heroes.flatMap((hero) => [
      note("kh-note", hero.buildNote, seatName(hero.name)),
      note("kh-opening-note", hero.openingNote, seatName(hero.name)),
    ]),
  ].filter(Boolean);
  return [
    cards.length ? t("section", { class: "detail-section" }, [
      t("h2", {}, L("Đội hình", "阵容", "編成")),
      t("div", { class: "detail-hero-grid" }, cards),
    ]) : null,
    notes.length ? t("section", { class: "detail-section detail-notes" }, [
      t("h2", { class: "detail-notes-title" }, L("Ghi chú", "备注", "メモ")),
      t("ul", { class: "detail-note-list" }, notes),
    ]) : null,
  ].filter(Boolean);
}

function guideDefenders(defenders = {}) {
  const ordered = (title, rows) => rows?.length ? t("div", { class: "kh-guide-list" }, [
    t("h3", {}, title),
    t("ol", { class: "kh-guide-defenders" }, rows.map((row) => t("li", {}, `${seatName(row.hero)}${row.unitType ? ` ${unitLabel(row.unitType)}` : ""}`))),
  ]) : null;
  return [ordered(L("Đất 4 · dễ → khó", "4级地 · 易 → 难", "Lv4土地 · 易 → 難"), defenders.land4), ordered(L("Đất 5 · dễ → khó", "5级地 · 易 → 难", "Lv5土地 · 易 → 難"), defenders.land5),
    viProse(defenders.warning) ? t("p", { class: "kh-guide-warning" }, defenders.warning) : null].filter(Boolean);
}

/**
 * Điểm đánh giá của một team khai hoang (owner theo bộ ba): thanh 6 mốc + thang điểm.
 * Đội không có `guide.ratings` thì không dựng khối.
 */
function ratingsTree(guide) {
  const bar = ratingBarTree(guide?.ratings);
  if (!bar) return null;
  return t("section", { class: "detail-section kh-ratings-block" }, [
    t("h2", {}, L("Điểm đánh giá", "评分", "評価点")),
    bar,
    t("p", { class: "kh-ratings-note" }, L(
      "Điểm /10 cho cả bộ ba tướng, chưa chấm riêng từng bộ chiến pháp · Tướng trắng vẫn dùng được; càng nhiều đỏ càng tốt.",
      "满分 10 分，针对三名武将整体，未单独评估各套战法 · 白板武将也可使用，红度越高越好。",
      "10点満点で、武将3名の編成全体への評価です（戦法の組み合わせごとの個別評価ではありません） · 白武将でも使えます。赤が多いほど有利です。",
    )),
  ]);
}

/**
 * Hướng dẫn đánh đất của một team khai hoang (owner theo bộ ba, không theo build).
 * Bản zh chỉ giữ phần có cấu trúc (yêu cầu đỏ, danh sách tướng); văn xuôi tiếng Việt bị bỏ.
 */
export function khaihoangGuide(guide, { locale } = {}) {
  return withLocale(locale, () => guideTree(guide));
}

function guideTree(guide) {
  if (!guide || !Object.keys(guide).length) return null;
  const red = (guide.redRequirements || []).map((item) => [
    seatName(item.hero),
    item.minimum !== undefined ? L(`từ ${item.minimum} đỏ`, `至少 ${item.minimum} 红`, `赤${item.minimum}以上`) : null,
    item.recommended !== undefined ? L(`khuyến nghị ${item.recommended} đỏ`, `建议 ${item.recommended} 红`, `推奨 赤${item.recommended}`) : null,
    viProse(item.note),
  ].filter(Boolean).join(" · "));
  const split = guide.splitTeams;
  const transitions = (guide.transitions || []).map((item) => t("li", {}, [
    viProse(item.target) ? t("strong", {}, item.target) : null,
    viProse(item.note) ? t("p", { class: "kh-guide-note" }, item.note) : null,
    t("ol", {}, (item.steps || []).map((step) => t("li", {}, [
      step.mainCityLevel ? L(`Thành chính ${step.mainCityLevel}`, `主城 ${step.mainCityLevel} 级`, `本拠地 Lv${step.mainCityLevel}`) : null,
      step.commandCost ? L(`${step.commandCost} thống ngự`, `${step.commandCost} 统御`, `コスト${step.commandCost}`) : null,
      viProse(step.timing),
      step.trainHeroes?.length ? L(`Luyện ${step.trainHeroes.join(" + ")}`, `练 ${step.trainHeroes.map((hero) => seatName(hero)).join(" + ")}`, `育成 ${step.trainHeroes.map((hero) => seatName(hero)).join(" + ")}`) : null,
      viProse(step.note),
    ].filter(Boolean).join(" · ")))),
  ].filter(Boolean)));
  const splitTeams = split?.teams?.length ? t("div", { class: "kh-guide-list" }, [
    t("h3", {}, L("Tách đội đánh đất", "分队打地", "部隊を分けて土地を攻略")),
    t("ul", {}, split.teams.map((item) => t("li", {}, [
      viProse(item.target) ? t("strong", {}, item.target) : null,
      item.heroes?.length ? t("ul", {}, item.heroes.map((hero) => t("li", {}, [
        seatName(hero.name),
        hero.tactics?.map((tactic) => sourceName(tactic)).some(Boolean) ? ` (${hero.tactics.map((tactic) => tacticName(tactic)).filter(Boolean).join(" / ")})` : null,
      ].filter(Boolean).join("")))) : null,
      viProse(item.note) ? t("p", { class: "kh-guide-note" }, item.note) : null,
    ].filter(Boolean)))),
  ]) : null;
  const details = [
    ...guideDefenders(guide.defenders),
    viProse(split?.note) ? t("p", { class: "kh-guide-note" }, split.note) : null,
    splitTeams,
    transitions.length ? t("div", { class: "kh-guide-list" }, [t("h3", {}, L("Chuyển hình", "转型", "転換")), t("ul", {}, transitions)]) : null,
  ].filter(Boolean);
  const overview = viProse(guide.overview);
  if (!overview && !red.length && !details.length) return null;
  return t("section", { class: "detail-section kh-guide" }, [
    t("h2", { class: "kh-guide-title" }, L("Hướng dẫn khai hoang", "开荒攻略", "開拓攻略")),
    overview ? t("p", { class: "kh-guide-overview" }, overview) : null,
    red.length ? t("p", { class: "kh-guide-red" }, [t("strong", {}, L("Yêu cầu đỏ: ", "红度要求：", "赤星の条件：")), red.join("; ")]) : null,
    ...details,
  ].filter(Boolean));
}

/** Số nguyên có dấu phân cách nghìn theo ngôn ngữ trang (vi: "15.243", zh/ja: "15,243"), không phụ thuộc ICU của máy build. */
const groupedNumber = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, L(".", ",", ","));
const percentText = (value) => L(value.toFixed(1).replace(".", ","), value.toFixed(1), value.toFixed(1));

/**
 * Bản zh/ja của các khuyến nghị trong `fieldLog.recommendations` (khoá theo `id`; bản vi lấy từ `note` của dữ liệu).
 * Mọi số trong khuyến nghị phải tính lại được từ các trận đã ghi trong `fieldLog.phases`; test khoá đủ bản dịch cho mỗi `id`.
 */
export const FIELD_LOG_RECOMMENDATIONS = Object.freeze({
  zh: Object.freeze({
    "dat4-som": "4级地：武将 8 级、带满 2400 兵即可打。8–10 级时优先打弓兵守军的地，骑兵守军的地放后面：弓兵守军一战损兵 178（伤兵 59，阵亡 119，即 5.0%；n=1），骑兵守军两战损兵 483 与 436（n=2），是前者的 2.4–2.7 倍。",
    "dat5-cap-20": "5级地（守军 27 级，3×3000）：武将 20 级带满 6000 兵已能打下：骑兵守军一战阵亡 198（3.3%），弓兵守军一战阵亡 525（8.8%）（n=2）。日志里没有更低等级打 5 级地的记录，所以还无法确定最早可打的等级。",
    "dat6-28": "6级地：武将 28 级、兵接近满员时已能打下，但唯一一战（弓兵守军 30 级，3×5000）阵亡 734，即 12.2%（n=1），所以每次只拿必要的地，例如 1 块 6 级石料地供屯田。",
    "bo-sung-binh": "战前补满兵：日志中有兵力记录的战斗都是满兵或接近满兵出战（8 级 2400、20 级 6000、28 级 5992）。日志里还没有缺兵出战的记录可供对比。",
    "cong-diem": "加点：陸遜与左慈全加智力；張春華的速度保持高于陸遜速度的 1.2 倍以抢先出手，其余加智力（日志：張春華速度 82.5，陸遜 59.9）。",
  }),
  ja: Object.freeze({
    "dat4-som": "4級地：武将Lv8・兵2,400満員から攻略できる。Lv8〜10では弓兵守備の土地を優先し、騎兵守備の土地は後回しに。弓兵守備との1戦は損失178（負傷兵59、戦死119＝5.0%、n=1）、騎兵守備との2戦は損失483と436（n=2）で、2.4〜2.7倍。",
    "dat5-cap-20": "5級地（守備Lv27、3×3,000）：武将Lv20・兵6,000満員で攻略済み。騎兵守備は戦死198（3.3%）、弓兵守備は戦死525（8.8%）（n=2）。より低いレベルで5級地を攻めた記録がないため、最も早く攻略できるレベルはまだ判断できない。",
    "dat6-28": "6級地：武将Lv28・兵ほぼ満員で攻略済みだが、唯一の1戦（弓兵守備Lv30、3×5,000）で戦死734＝12.2%（n=1）。そのため必要な土地だけを取る（例：屯田用の6級石材地を1つ）。",
    "bo-sung-binh": "戦闘前に兵を満員まで補充する：兵数を記録した戦闘はすべて満員かほぼ満員で出陣した（Lv8で2,400、Lv20で6,000、Lv28で5,992）。兵が不足した状態の記録はまだなく、比較はできない。",
    "cong-diem": "加点：陸遜と左慈は知力に全振り。張春華は速度を陸遜の1.2倍以上に保って先に行動させ、残りは知力へ（ログ：張春華の速度82.5、陸遜59.9）。",
  }),
});
const FIELD_LOG_REGION = Object.freeze({ zh: { "Ba Thục": "巴蜀" }, ja: { "Ba Thục": "巴蜀" } });

/**
 * Số binh chết của một trận: `lost` là tổng hao (gồm cả thương binh, như cột "Tổn thất" của báo cáo trận), nên chết =
 * hao − thương binh. Hao lấy từ binh trước/sau khi có, nếu không thì từ `lost`. Thiếu số hoặc số vô lý → `null`.
 */
export function fieldLogBattleDead(battle) {
  const { troopsBefore, troopsAfter, wounded } = battle;
  const lost = Number.isFinite(troopsBefore) && Number.isFinite(troopsAfter) ? troopsBefore - troopsAfter : battle.lost;
  if (!Number.isFinite(lost) || !Number.isFinite(wounded) || !(troopsBefore > 0)) return null;
  if (wounded < 0 || wounded > lost || lost > troopsBefore) return null;
  return lost - wounded;
}

const fieldLogImageTitle = (image, battle) => {
  const where = Number.isFinite(battle.x) && Number.isFinite(battle.y) ? ` (${battle.x}, ${battle.y})` : "";
  return image.kind === "stats"
    ? L(`Thống kê trận${where}`, `战斗统计${where}`, `戦闘統計${where}`)
    : L(`Kết quả trận${where}`, `战报${where}`, `戦闘結果${where}`);
};

function fieldLogBattleTree(battle) {
  const lost = Number.isFinite(battle.troopsAfter) && Number.isFinite(battle.troopsBefore) ? battle.troopsBefore - battle.troopsAfter : battle.lost;
  const dead = fieldLogBattleDead(battle);
  const head = [
    Number.isFinite(battle.x) && Number.isFinite(battle.y) ? `(${battle.x}, ${battle.y})` : null,
    L(`Tướng cấp ${battle.heroLevel}`, `武将 ${battle.heroLevel} 级`, `武将 Lv${battle.heroLevel}`),
    battle.won ? L("thắng", "胜", "勝利") : L("thua", "败", "敗北"),
  ].filter(Boolean).join(" · ");
  // Tướng thủ chưa có tên trong từ điển thì bản zh/ja bỏ tên đó (thêm "…") thay vì hiện dấu "—" hay tên Việt.
  const defenderNames = (battle.defenders || []).map((item) => seatName(item.hero));
  const knownDefenders = defenderNames.filter((name) => name !== UNRESOLVED_NAME);
  const defenders = knownDefenders.length ? `${knownDefenders.join(" · ")}${knownDefenders.length < defenderNames.length ? " …" : ""}` : "";
  const garrison = [
    battle.defenders?.[0]?.unitType ? unitLabel(battle.defenders[0].unitType) : null,
    battle.defenderLevel ? L(`cấp ${battle.defenderLevel}`, `${battle.defenderLevel} 级`, `Lv${battle.defenderLevel}`) : null,
    battle.garrisonPerHero ? `${battle.defenders?.length || 3}×${groupedNumber(battle.garrisonPerHero)}` : null,
  ].filter(Boolean).join(", ");
  const before = groupedNumber(battle.troopsBefore);
  const troops = [
    Number.isFinite(battle.troopsBefore) && Number.isFinite(battle.troopsAfter)
      ? L(`Binh ${before} → ${groupedNumber(battle.troopsAfter)}`, `兵力 ${before} → ${groupedNumber(battle.troopsAfter)}`, `兵力 ${before} → ${groupedNumber(battle.troopsAfter)}`)
      : Number.isFinite(battle.troopsBefore) ? L(`Xuất quân ${before} binh`, `出兵 ${before}`, `出陣 ${before}`) : null,
    Number.isFinite(lost) ? L(`mất ${groupedNumber(lost)}`, `损兵 ${groupedNumber(lost)}`, `損失 ${groupedNumber(lost)}`) : null,
    Number.isFinite(battle.wounded) ? L(`${groupedNumber(battle.wounded)} thương binh`, `${groupedNumber(battle.wounded)} 伤兵`, `負傷兵 ${groupedNumber(battle.wounded)}`) : null,
    dead !== null ? (() => {
      const share = percentText((dead / battle.troopsBefore) * 100);
      return L(`chết ${groupedNumber(dead)} (${share}%)`, `阵亡 ${groupedNumber(dead)}（${share}%）`, `戦死 ${groupedNumber(dead)}（${share}%）`);
    })() : null,
    Number.isFinite(battle.exp) ? L(`EXP +${groupedNumber(battle.exp)} mỗi tướng`, `每名武将经验 +${groupedNumber(battle.exp)}`, `各武将 経験値 +${groupedNumber(battle.exp)}`) : null,
    Number.isFinite(battle.levelTo) ? L(`lên cấp ${battle.levelTo}`, `升至 ${battle.levelTo} 级`, `Lv${battle.levelTo}に上昇`) : null,
  ].filter(Boolean).join(" · ");
  const skills = (battle.skills || []).map((skill) => t("li", {}, [
    `${seatName(skill.hero)} · ${tacticName(skill.tactic)}: `,
    [
      Number.isFinite(skill.fired) ? L(`phát động ${skill.fired}×`, `发动 ${skill.fired} 次`, `発動 ${skill.fired}回`) : null,
      Number.isFinite(skill.kills) ? L(`diệt ${groupedNumber(skill.kills)}`, `击杀 ${groupedNumber(skill.kills)}`, `撃破 ${groupedNumber(skill.kills)}`) : null,
      Number.isFinite(skill.rescued) ? L(`cứu viện ${groupedNumber(skill.rescued)}`, `救援 ${groupedNumber(skill.rescued)}`, `救援 ${groupedNumber(skill.rescued)}`) : null,
    ].filter(Boolean).join(", "),
  ]));
  return t("li", { class: "kh-fieldlog-battle" }, [
    t("strong", {}, head),
    defenders || garrison ? t("p", { class: "kh-guide-note" }, [t("span", { class: "kh-fieldlog-label" }, L("Thủ quân: ", "守军：", "守備軍：")), defenders ? (garrison ? `${defenders} (${garrison})` : defenders) : garrison]) : null,
    troops ? t("p", { class: "kh-guide-note" }, troops) : null,
    skills.length ? t("ul", { class: "kh-fieldlog-skills" }, skills) : null,
  ].filter(Boolean));
}

function fieldLogGallery(battles) {
  const figures = battles.flatMap((battle) => (battle.images || []).map((image) => {
    const caption = `${fieldLogImageTitle(image, battle)} · ${L(`tướng cấp ${battle.heroLevel}`, `武将 ${battle.heroLevel} 级`, `武将 Lv${battle.heroLevel}`)}`;
    return t("figure", { class: "kh-fieldlog-shot" }, [
      t("a", {
        class: "kh-fieldlog-shot-link", href: image.url, target: "_blank", rel: "noopener",
        title: L("Mở ảnh gốc ở tab mới", "在新标签页打开原图", "新しいタブで元画像を開く"),
      }, [t("img", { src: image.url, alt: caption, width: image.width, height: image.height, loading: "lazy", decoding: "async" })]),
      t("figcaption", {}, caption),
    ]);
  }));
  return figures.length ? t("div", { class: "kh-fieldlog-gallery" }, figures) : null;
}

/**
 * Nhật ký thực chiến của một team khai hoang (owner theo bộ ba): ba giai đoạn đánh đất theo cấp tướng, ảnh báo cáo
 * trận và khuyến nghị rút từ log. Số liệu một tài khoản, mẫu nhỏ: khối luôn mở bằng lời cảnh báo đó (một lần).
 * Văn xuôi vi chỉ hiện ở bản vi; bản zh/ja dựng câu từ trường có cấu trúc và bản dịch của khuyến nghị.
 */
function fieldLogTree(log) {
  if (!log?.phases?.length) return null;
  const range = (phase) => (phase.heroLevelMin === phase.heroLevelMax ? `${phase.heroLevelMin}` : `${phase.heroLevelMin}–${phase.heroLevelMax}`);
  const phases = log.phases.map((phase, index) => t("div", { class: "kh-fieldlog-phase" }, [
    t("h3", {}, L(
      `Giai đoạn ${index + 1} · Tướng cấp ${range(phase)} đánh đất ${phase.landLevel} · ${phase.period}`,
      `阶段 ${index + 1} · ${range(phase)} 级武将打 ${phase.landLevel} 级地 · ${phase.period}`,
      `段階 ${index + 1} · Lv${range(phase)} 武将で ${phase.landLevel}級地 · ${phase.period}`,
    )),
    viProse(phase.note) ? t("p", { class: "kh-guide-note" }, phase.note) : null,
    t("ul", { class: "kh-fieldlog-battles" }, (phase.battles || []).map(fieldLogBattleTree)),
    fieldLogGallery(phase.battles || []),
  ].filter(Boolean)));
  const translated = L(null, FIELD_LOG_RECOMMENDATIONS.zh, FIELD_LOG_RECOMMENDATIONS.ja);
  const recommendations = (log.recommendations || [])
    .map((item) => [item.id, translated ? translated[item.id] : item.note])
    .filter(([, text]) => text);
  const region = L(log.region, FIELD_LOG_REGION.zh[log.region], FIELD_LOG_REGION.ja[log.region]);
  return t("section", { class: "detail-section kh-guide kh-fieldlog" }, [
    t("h2", { class: "kh-guide-title" }, L("Nhật ký thực chiến", "实战日志", "実戦記録")),
    t("p", { class: "kh-guide-note" }, [
      L(`Tài khoản ${log.account}`, `账号 ${log.account}`, `アカウント ${log.account}`), region ? ` · ${region}` : null,
      " · ",
      L(log.note,
        "来自单个账号的实战记录，样本很小，仅供参考，不是强度排名。结果取决于武将红度、装备与守军。",
        "1アカウントの実戦記録で、サンプルが少ないため参考程度。強さのランキングではない。結果は武将の凸数、装備、守備軍によって変わる。"),
    ]),
    ...phases,
    recommendations.length ? t("div", { class: "kh-guide-list kh-fieldlog-recs" }, [
      t("h3", {}, L("Khuyến nghị rút từ log (mục tiêu ít chết lính)", "实战建议（以少死兵为目标）", "実戦からの提案（戦死を減らすのが目標）")),
      t("ol", {}, recommendations.map(([id, text]) => t("li", { dataset: { recommendation: id } }, text))),
    ]) : null,
  ].filter(Boolean));
}

/** Cấu hình đang chọn của một team: bản thân team là build mặc định. */
function khaihoangBuildFor(team, variantId) {
  if (!variantId) return team;
  return (team.variants || []).find((variant) => variant.id === variantId) || team;
}

/**
 * Thân trang chi tiết một đội khai hoang (cây view): khối chọn phiên bản + build đang chọn (đội hình, ghi
 * chú), rồi điểm và hướng dẫn của team. Điểm và hướng dẫn thuộc team nên nằm ngoài khối build `.kh-build`:
 * client đổi phiên bản chỉ dựng lại `.kh-build`. Loại binh của build chỉ hiện ở đầu trang
 * (`#team-detail-badges`), khối build không lặp lại huy hiệu đó. `variantId` lạ coi như build mặc định.
 */
export function khaihoangDetailTrees(team, { variantId = "", locale } = {}) {
  return withLocale(locale, () => {
    const selected = (team.variants || []).some((variant) => variant.id === variantId) ? variantId : "";
    return [
      t("div", { class: "kh-detail-build" }, [
        t("div", { class: "kh-versions" }, [
          t("span", { class: "kh-versions-label", "aria-hidden": "true" }, L("Phiên bản", "版本", "バージョン")),
          khaihoangConfigRowTree(team, { selected }),
        ]),
        t("div", { class: "kh-build", "aria-live": "polite" }, buildContentTrees(khaihoangBuildFor(team, selected))),
      ]),
      ratingsTree(team.guide),
      guideTree(team.guide),
      fieldLogTree(team.fieldLog),
    ].filter(Boolean);
  });
}

/** Cập nhật badge binh chủng của thẻ tại chỗ khi đổi build (trang chi tiết dùng `#team-detail-badges`). */
function applyKhaihoangUnit(node, build) {
  node.textContent = unitLabel(build.unitType);
  node.className = unitBadgeClass(build.unitType);
}

/** Class badge loại binh của thẻ Khai hoang (class màu theo giá trị gốc của loại binh). */
const unitBadgeClass = (unitType) => `badge unit ${UNIT_CLASS[unitType] || ""}`;

/** Huy hiệu "Tiến cử" của đội do nhà phát hành giới thiệu (`team.recommended`); đội khác không có. */
export const khaihoangRecommendedBadge = (team) => (team?.recommended === true
  ? t("span", { class: "badge badge-band kh-recommended" }, L("Tiến cử", "推荐", "おすすめ"))
  : null);

/**
 * Đội `recommended` đứng đầu theo `recommendedOrder` (thứ tự ảnh nhà phát hành), đội còn lại giữ thứ tự dữ liệu.
 * Thứ tự dữ liệu không đổi để khoá bản dịch theo vị trí (`teams[N]`) vẫn đúng.
 */
export const khaihoangRecommendedFirst = (list) => {
  const rank = (item) => (item?.recommended === true && Number.isFinite(item.recommendedOrder) ? item.recommendedOrder : Infinity);
  return [...(list || [])].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra === rb ? 0 : ra < rb ? -1 : 1;
  });
};

/** 6 mốc điểm Khai hoang và thang quy đổi chiều dài thanh. */
const ratingMarks = () => [
  ["land4", L("Đất 4", "4级地", "Lv4土地")], ["land5", L("Đất 5", "5级地", "Lv5土地")], ["land6", L("Đất 6", "6级地", "Lv6土地")],
  ["land7to8", L("Đất 7–8", "7–8级地", "Lv7–8土地")], ["transition", L("Chuyển", "转型", "転換")], ["overall", L("Tổng", "综合", "総合")],
];
const RATING_SCALE = 10;

/** Điểm hiển thị theo thập phân dấu phẩy ("8,5"). */
const ratingText = (value) => String(value).replace(".", ",");

/**
 * Thanh điểm 6 mốc đọc thẳng `guide.ratings`; đội không có `ratings` thì không vẽ thanh.
 * Cột "Tổng" dùng màu mực, các mốc còn lại màu son.
 */
function ratingBarTree(ratings) {
  const marks = ratingMarks().filter(([key]) => Number.isFinite(Number(ratings?.[key])));
  if (!marks.length) return null;
  return t("div", { class: "kh-ratings" }, marks.map(([key, label]) => {
    const value = Number(ratings[key]);
    const percent = Math.max(0, Math.min(100, Math.round((value / RATING_SCALE) * 100)));
    const fill = t("span", { class: `kh-rating-fill${key === "overall" ? " kh-rating-fill-total" : ""}`, style: `width: ${percent}%;` });
    return t("div", { class: "kh-rating" }, [
      t("span", { class: "kh-rating-head" }, [
        t("span", { class: "kh-rating-label" }, label),
        t("strong", { class: "kh-rating-value" }, ratingText(value)),
      ]),
      t("span", { class: "kh-rating-track" }, fill),
    ]);
  }));
}

/**
 * Ấn điểm tổng ở đầu thẻ, cùng khuôn ấn điểm của thẻ Đội chuẩn; đội chưa được chấm dùng khuôn viền đứt "—".
 */
function khaihoangScoreStamp(ratings) {
  const value = Number(ratings?.overall);
  const label = L("Điểm tổng khai hoang (thang 10)", "开荒综合评分（满分 10）", "開拓総合評価点（10点満点）");
  if (!Number.isFinite(value)) {
    const missing = L("Chưa có điểm khai hoang", "暂无开荒评分", "開拓の評価点はまだありません");
    return t("span", { class: "reference-score-wrap is-missing", title: missing }, [
      t("span", { class: "badge score reference-score missing-score", "aria-hidden": "true" }, "—"),
      t("span", { class: "visually-hidden" }, missing),
      t("span", { class: "reference-score-unit", "aria-hidden": "true" }, L("điểm", "分", "点")),
    ]);
  }
  return t("span", { class: "reference-score-wrap", title: label }, [
    t("span", { class: "badge score reference-score" }, ratingText(value)),
    " ",
    t("span", { class: "reference-score-unit" }, L("điểm", "分", "点")),
  ]);
}

/** Một chip chọn cấu hình: cùng phần tử cho mặc định và từng biến thể. `data-variant` rỗng là build mặc định. */
const khaihoangConfigChip = (label, variantId, selected) => t("button", {
  type: "button",
  class: "fchip kh-config-chip",
  "aria-pressed": String(selected === variantId),
  dataset: { variant: variantId },
}, label);

/**
 * Nhóm chip chọn phiên bản dùng chung cho thẻ danh sách và trang chi tiết (cây view). Đội không có biến thể
 * vẫn có đúng một chip "Mặc định" để mọi thẻ cùng một bố cục; `selected` là cấu hình đang bật (`""` = mặc định).
 * Chip chọn bằng `data-variant`; client gắn sự kiện sau `treeToDom` bằng `bindKhaihoangConfigRow`.
 */
function khaihoangConfigRowTree(team, { selected = "", locale } = {}) {
  return withLocale(locale, () => {
    const variants = team.variants || [];
    const chips = [khaihoangConfigChip(L("Mặc định", "默认", "デフォルト"), "", selected)].concat(
      variants.map((v, index) => khaihoangConfigChip(
        L(v.displayLabel || `Cấu hình ${index + 1}`, `配置 ${index + 1}`, `構成${index + 1}`), v.id, selected,
      )),
    );
    return t("div", { class: "kh-config-row", role: "group", "aria-label": L(`Chọn cấu hình ${team.title}`, `选择配置：${khaihoangTitle(team)}`, `構成を選択：${khaihoangTitle(team)}`) }, chips);
  });
}

/**
 * Gắn sự kiện chọn cấu hình cho một nhóm chip đã `treeToDom`: bấm chip gọi `onSelect(variantId)`.
 * Trả danh sách chip để caller đồng bộ `aria-pressed`.
 */
export function bindKhaihoangConfigRow(root, onSelect) {
  const chips = [...root.querySelectorAll(".kh-config-chip")];
  for (const chip of chips) { chip.addEventListener("click", () => onSelect(chip.dataset.variant || "")); enableControl(chip); }
  return chips;
}

/**
 * Thẻ một đội khai hoang, cùng khung thẻ Đội chuẩn: tên (link) + loại binh + ấn điểm tổng, các phiên bản,
 * ba dòng tướng và chân "Chi tiết". Ghi chú, điểm từng mốc và hướng dẫn chỉ ở trang chi tiết.
 * `href` rỗng/không phải chuỗi thì hai link không có `href` (chờ `updateLinks` của client).
 */
function khaihoangTeamCardTree(team, href) {
  const link = typeof href === "string" && href ? { href } : {};
  return t("article", { class: "team-card reference-team-card kh-card", dataset: { factionCode: "none" } }, [
    t("header", { class: "reference-card-head kh-card-head" }, [
      t("div", { class: "reference-card-title" }, [
        t("h3", { class: "team-name kh-title" }, t("a", { class: "kh-title-link", ...link }, khaihoangTitle(team))),
        t("p", { class: "reference-meta" }, [t("span", { class: unitBadgeClass(team.unitType) }, unitLabel(team.unitType)), khaihoangRecommendedBadge(team)].filter(Boolean)),
      ]),
      khaihoangScoreStamp(team.guide?.ratings),
    ]),
    t("div", { class: "kh-versions" }, [
      t("span", { class: "kh-versions-label", "aria-hidden": "true" }, L("Phiên bản", "版本", "バージョン")),
      khaihoangConfigRowTree(team),
    ]),
    t("div", { class: "heroes kh-build", "aria-live": "polite" }, khaihoangHolderTrees(team)),
    t("footer", { class: "reference-card-foot" }, [t("a", { class: "ana-link-btn kh-detail-link", ...link }, [
      L("Chi tiết", "详情", "詳細"),
      iconTree([svgTree("line", { x1: 5, y1: 12, x2: 19, y2: 12 }), svgTree("polyline", { points: "13 6 19 12 13 18" })], { size: 16 }),
    ])]),
  ]);
}

/** Tên mỏ theo ngôn ngữ trang (`Mỏ 4` → `矿 4`). */
const mineName = (value) => L(value, String(value ?? "").replace(/^Mỏ\s*/u, "矿 "), String(value ?? "").replace(/^Mỏ\s*/u, "鉱山 "));

/** Nhóm Chạm Sứ độc lập, giữ nguyên tướng và chiến pháp. */
function chamSuTeamCard(team) {
  return t("article", { class: "cham-su-card" }, [
    t("h3", { class: "cham-su-title" }, [khaihoangTitle(team), khaihoangRecommendedBadge(team) ? " " : null, khaihoangRecommendedBadge(team)].filter(Boolean)),
    t("ul", { class: "cham-su-list" }, (team.heroes || []).map((hero) =>
      t("li", {}, [
        t("span", { class: "cham-su-hero" }, seatName(hero.name)),
        sourceName(hero.tactic) ? " — " : null,
        sourceName(hero.tactic) ? t("span", { class: "cham-su-tactic" }, tacticName(hero.tactic)) : null,
      ].filter(Boolean)))),
    viProse(team.note) ? t("p", { class: "cham-su-note" }, team.note) : null,
  ].filter(Boolean));
}

/** Bảng quân thủ các mỏ (desktop): mỗi mỏ một hàng, mỗi đội một ô. */
function minesTable(mines) {
  const squads = Math.max(...mines.map((mine) => (mine.enemies || []).length));
  return t("div", { class: "kh-table-frame" }, [
    t("table", { class: "kh-mines" }, [
      t("caption", {}, L("Quân thủ từng mỏ", "各矿守军", "各鉱山の守備軍")),
      t("thead", {}, [
        t("tr", {}, [
          t("th", { scope: "col" }, L("Mỏ", "矿", "鉱山")),
          t("th", { scope: "colgroup", colspan: String(squads) }, L(`Quân thủ (${squads} đội)`, `守军（${squads} 队）`, `守備軍（${squads}編成）`)),
        ]),
      ]),
      t("tbody", {}, mines.map((mine) =>
        t("tr", {}, [
          t("th", { scope: "row" }, mineName(mine.name)),
          ...(mine.enemies || []).map((enemy) =>
            t("td", {}, [
              t("span", { class: "kh-mine-hero" }, seatName(enemy.hero)),
              enemy.unitType ? t("span", { class: "kh-mine-unit" }, unitLabel(enemy.unitType)) : null,
            ].filter(Boolean))),
        ]))),
    ]),
  ]);
}

/** Cùng nội dung dạng thẻ cho mobile: mỗi mỏ một thẻ. */
function mineCards(mines) {
  return t("div", { class: "kh-mine-cards" }, mines.map((mine) =>
    t("article", { class: "kh-mine-card" }, [
      t("h3", {}, mineName(mine.name)),
      t("div", { class: "kh-mine-enemies" }, (mine.enemies || []).map((enemy) =>
        t("span", { class: "kh-mine-enemy" }, [
          t("strong", {}, seatName(enemy.hero)),
          enemy.unitType ? ` · ${unitLabel(enemy.unitType)}` : null,
        ].filter(Boolean)))),
    ])));
}

/**
 * Tham khảo chung của cả mục Khai hoang (trang danh sách, sau lưới đội): nhóm Chạm Sứ rồi quân thủ các mỏ.
 * Không thuộc đội nào nên không theo bộ lọc loại binh. Khối nào không có dữ liệu thì bỏ hẳn.
 */
function khaihoangReference({ chamSuTeams, chamSuTip, mines }) {
  return [
    chamSuTeams.length ? t("section", { class: "kh-reference", id: "cham-su" }, [
      t("h2", {}, L("Đội Chạm Sứ / Ăn vạ", "碰瓷队伍", "当たり屋編成")),
      viProse(chamSuTip) ? t("p", { class: "cham-su-tip" }, chamSuTip) : null,
      t("div", { class: "cham-su-cards" }, chamSuTeams.map(chamSuTeamCard)),
    ].filter(Boolean)) : null,
    mines.length ? t("section", { class: "kh-reference", id: "mo" }, [
      t("h2", {}, L("Quân thủ các mỏ", "各矿守军", "各鉱山の守備軍")),
      minesTable(mines),
      mineCards(mines),
    ]) : null,
  ].filter(Boolean);
}

/** Nút nhảy trong trang: một link cho mỗi khối đang có, kèm số mục của khối; không khối nào thì không có nav. */
function khaihoangJumpNav(links) {
  const shown = links.filter(([, , count]) => count > 0);
  return shown.length ? t("nav", { class: "kh-jump", "aria-label": L("Trong trang", "页内导航", "ページ内ナビ") }, shown
    .map(([href, label, count]) => t("a", { class: "kh-jump-link", href }, [label, " ", t("span", { class: "kh-jump-count" }, String(count))]))) : null;
}

/** Tiêu đề đội khai hoang / Chạm Sứ (`"A · B · C"`): bản zh đổi từng tên tướng sang chữ Hán gốc. */
export function khaihoangTitle(team) {
  return seatName(team?.title ?? "");
}

/** Tên ở một ô đơn (tướng, chủ tướng): bản zh không tra được chữ Hán thì hiện "—" thay vì tên tiếng Việt. */
export const UNRESOLVED_NAME = "—";
function seatName(value) {
  const name = sourceName(value);
  return name || (value ? UNRESOLVED_NAME : name);
}

/**
 * Section Khai hoang dạng cây view: đầu trang, nút nhảy trong trang, lọc loại binh và lưới thẻ đội (các phiên
 * bản + ba dòng tướng), rồi tham khảo chung (Chạm Sứ, quân thủ mỏ). Ghi chú, điểm từng mốc và hướng dẫn đánh
 * đất thuộc trang chi tiết. Trạng thái dựng sẵn là trạng thái mặc định: mọi đội hiện, bộ lọc "Tất cả", mỗi
 * đội ở cấu hình mặc định; `hrefFor(teamId, "")` cho link của từng thẻ.
 */
export function khaihoangTableTree(data, { hrefFor, locale } = {}) {
  return withLocale(locale, () => {
    // Tương thích ngược: payload mảng (cấu trúc cũ chỉ có mỏ) không có đội nào.
    const teams = Array.isArray(data) ? [] : khaihoangRecommendedFirst(data.teams);
    const shared = Array.isArray(data) ? {} : data;
    const chamSuTeams = khaihoangRecommendedFirst(shared.chamSuTeams);
    const mines = shared.mines || [];

    // Lọc loại binh: chip đếm theo chính dữ liệu đang dựng; "Tất cả" luôn đứng đầu.
    const unitCounts = new Map();
    for (const team of teams) unitCounts.set(team.unitType, (unitCounts.get(team.unitType) ?? 0) + 1);
    // Giảm dần theo số đội; bằng nhau giữ thứ tự xuất hiện trong dữ liệu (sort ổn định).
    const unitChips = [["", L("Tất cả", "全部", "すべて"), teams.length], ...[...unitCounts].sort((a, b) => b[1] - a[1]).map(([unit, count]) => [unit, unitLabel(unit), count])]
      .map(([value, label, count]) => t("button", {
        type: "button", class: "fchip kh-unit-chip", "aria-pressed": String(value === ""),
        dataset: { unit: value },
      }, [label, " ", t("span", { class: "kh-unit-count" }, String(count))]));
    const cards = teams.map((team) => khaihoangTeamCardTree(team, typeof hrefFor === "function" ? hrefFor(team.id, "") : null));

    return t("div", { class: "khaihoang" }, [
      t("header", { class: "khaihoang-head" }, [
        t("div", { class: "reference-head-text" }, [
          t("span", { class: "reference-kicker" }, L("Đội hình", "阵容", "編成")),
          t("h1", { class: "reference-title", tabindex: "-1" }, L("Khai hoang", "开荒", "開拓")),
          t("p", { class: "reference-lead" }, L("Đội mở đất và các phiên bản chiến pháp. Mở Chi tiết để xem điểm từng mốc đất, ghi chú và hướng dẫn đánh đất.", "开荒队伍及其各版本战法。打开详情可查看各级地评分、备注和打地攻略。", "開拓用の編成と、各バージョンの戦法です。詳細を開くと、各レベルの土地ごとの評価点、メモ、土地攻略ガイドを確認できます。")),
        ]),
      ]),
      khaihoangJumpNav([
        ["#de-xuat", L("Đội đề xuất", "推荐队伍", "おすすめ編成"), teams.length],
        ["#cham-su", L("Chạm Sứ / Ăn vạ", "碰瓷队伍", "当たり屋編成"), chamSuTeams.length],
        ["#mo", L("Quân thủ mỏ", "各矿守军", "各鉱山の守備軍"), mines.length],
      ]),
      teams.length
        ? t("section", { class: "kh-block", id: "de-xuat", "aria-label": L("Đội khai hoang", "开荒队伍", "開拓編成") }, [
            t("div", { class: "kh-toolbar" }, [
              t("div", { class: "kh-unit-filter", role: "group", "aria-label": L("Lọc theo loại binh", "按兵种筛选", "兵種で絞り込み") }, unitChips),
              t("p", { class: "kh-result-count", "aria-live": "polite" }, [t("strong", {}, String(teams.length)), L(` / ${teams.length} đội`, ` / ${teams.length} 队`, ` / ${teams.length}編成`)]),
            ]),
            t("div", { class: "reference-view kh-team-view" }, [t("div", { class: "team-grid kh-cards" }, cards)]),
            t("p", { class: "empty", hidden: true }, L("Không có đội khai hoang nào dùng loại binh này.", "没有使用该兵种的开荒队伍。", "この兵種を使う開拓編成はありません。")),
          ])
        : null,
      ...khaihoangReference({ chamSuTeams, chamSuTip: shared.chamSuTip, mines }),
    ].filter(Boolean));
  });
}

/**
 * Section Khai hoang trên trình duyệt: DOM từ `khaihoangTableTree` (hoặc DOM dựng sẵn được `adopt`), rồi gắn lọc
 * loại binh, chọn cấu hình và link thẻ.
 *
 * Trả `{element, getVariants, setVariants, updateLinks}`: phần điều phối URL/snapshot sở hữu
 * lựa chọn, controller chỉ dựng build/chip/href và báo thay đổi qua callback.
 */
export function khaihoangTable(data, { hrefFor, onNavigate, onChange, adopt = null } = {}) {
  const teams = Array.isArray(data) ? [] : khaihoangRecommendedFirst(data.teams);
  const selections = new Map(teams.map((team) => [team.id, ""]));
  const readHref = (teamId, variantId) => (typeof hrefFor === "function" ? hrefFor(teamId, variantId) : null);
  let unitFilter = "";
  // `adopt`: section do build dựng sẵn từ cùng dữ liệu và cùng `khaihoangTableTree`; đủ thẻ thì nhận lại nguyên DOM
  // (chỉ gắn sự kiện), lệch thì dựng mới như cũ.
  const element = adopt?.querySelectorAll(".kh-card").length === teams.length ? adopt : treeToDom(khaihoangTableTree(data, { hrefFor }));

  function writeLinks(entry) {
    const variantId = selections.get(entry.team.id) || "";
    const href = readHref(entry.team.id, variantId);
    for (const link of entry.links) {
      if (typeof href === "string" && href) link.setAttribute("href", href);
      else link.removeAttribute("href");
    }
  }

  function showBuild(entry) {
    const variantId = selections.get(entry.team.id) || "";
    const build = khaihoangBuildFor(entry.team, variantId);
    applyKhaihoangUnit(entry.unit, build);
    entry.content.replaceChildren(...khaihoangHolderTrees(build).map((tree) => treeToDom(tree)));
    for (const chip of entry.chips) chip.setAttribute("aria-pressed", String((chip.dataset.variant || "") === variantId));
    writeLinks(entry);
  }

  const entries = [...element.querySelectorAll(".kh-card")].map((card, index) => {
    const team = teams[index];
    const entry = {
      team,
      element: card,
      unit: card.querySelector(".reference-meta .badge.unit"),
      content: card.querySelector(".kh-build"),
      links: [...card.querySelectorAll(".kh-title-link, .kh-detail-link")],
    };
    entry.chips = bindKhaihoangConfigRow(card, (variantId) => {
      selections.set(team.id, variantId);
      showBuild(entry);
      if (typeof onChange === "function") onChange(team.id, variantId);
    });
    // Anchor thật của card: click thường mới điều hướng; click đã sửa (Cmd/Ctrl/Shift/Alt) hoặc
    // middle-click do trình duyệt tự xử lý.
    for (const link of entry.links) {
      link.addEventListener("click", (event) => {
        if (!link.hasAttribute("href") || event.defaultPrevented) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (typeof onNavigate === "function") onNavigate(event, team.id, selections.get(team.id) || "");
      });
    }
    return entry;
  });

  const unitChips = [...element.querySelectorAll(".kh-unit-chip")];
  const shownCount = element.querySelector(".kh-result-count strong");
  const empty = element.querySelector(".kh-block > .empty");
  function applyUnitFilter() {
    let shown = 0;
    for (const entry of entries) {
      const visible = !unitFilter || entry.team.unitType === unitFilter;
      entry.element.hidden = !visible;
      if (visible) shown += 1;
    }
    for (const chip of unitChips) chip.setAttribute("aria-pressed", String((chip.dataset.unit || "") === unitFilter));
    shownCount.textContent = String(shown);
    empty.hidden = shown > 0;
  }
  for (const chip of unitChips) { chip.addEventListener("click", () => { unitFilter = chip.dataset.unit || ""; applyUnitFilter(); }); enableControl(chip); }

  return {
    element,
    // Bản ghi rời chỉ chứa cặp khác mặc định; thiếu key nghĩa là build mặc định.
    getVariants: () => {
      const record = {};
      for (const [teamId, variantId] of selections) if (variantId) record[teamId] = variantId;
      return record;
    },
    // Thay toàn bộ lựa chọn; key thiếu/không hợp lệ quay về mặc định, không dựng lại DOM card.
    setVariants: (source) => {
      const map = source && typeof source === "object" && !Array.isArray(source) ? source : {};
      for (const team of teams) {
        const requested = map[team.id];
        const known = typeof requested === "string" && (team.variants || []).some((v) => v.id === requested);
        selections.set(team.id, known ? requested : "");
      }
      entries.forEach(showBuild);
    },
    updateLinks: () => entries.forEach(writeLinks),
  };
}

import { resolveSelectionScore } from './season-context.js';
import { compareSeasonInventory, defaultSeasonSelection } from './season-ui-state.js';
import { ROSTER_SCAN_STORAGE_KEY, deserializeRosterScanState } from './roster-scan-state.js';
import { canonicalHeroId } from './hero-identity.js';
import { normalizeText } from './filters.js';
import { bookRowId, createTacticIdResolver } from './lookup-ids.js';

/** Ordered configuration details use explicit selections; inventory facts never become tiers. */
export function seasonConfigDetail(row, model, {onClose,importHref}) {
  const {config,team} = row;
  const names = new Map();
  // Bản zh hiện tên chữ Hán gốc của từ điển; khóa ref: tướng dựng từ tên Việt, chiến pháp và binh thư theo `id` cố định của dòng.
  const zh = sourceText();
  for (const [dataset,kind] of [['heroes-dict','hero'],['tactics','tactic'],['books-dict','book']]) for (const item of model.data[dataset]) {
    if (kind === 'book' && !bookRowId(item)) continue;
    const ref = kind === 'hero' ? canonicalHeroId(item.viet) : kind === 'book' ? item.id : kind === 'tactic' && typeof item.id === 'string' && item.id.startsWith('tactic:') ? item.id : kind + ':' + normalizeText(item.viet).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    names.set(ref,zh && item.chinese ? sourceName(item.chinese) : item.viet);
  }
  // Bản ja: văn xuôi chữ Trung (đánh giá, điều kiện, hiệu ứng, ghi chú) chưa có bản dịch Nhật nên bị ẩn; cuối panel có một dòng báo thiếu.
  const hideSourceProse = contentMode(currentLocale()) === 'ja';
  let hiddenProse = 0;
  const prose = (value, fallback) => {
    if (hideSourceProse && typeof value === 'string' && CJK_TEXT.test(value)) { hiddenProse++; return null; }
    return publicText(value, fallback);
  };
  const proseNode = (tag, props, value, fallback) => { const text = prose(value, fallback); return text === null ? null : el(tag, props, text); };
  const selection = defaultSeasonSelection(config);
  const score = el('p',{class:'config-score'});
  const comparison = el('div',{class:'season-inventory-comparison',role:'status'});
  function refreshScore() {
    const value = resolveSelectionScore(model,config.id,selection);
    score.textContent = value ? L(`Điểm: ${value.value}`, `评分：${value.value}`, `評価点：${value.value}`) : L('Chưa có điểm', '暂无评分', '評価点はまだありません');
    comparison.replaceChildren();
  }
  function chooser(label,refs,change) {
    const select = el('select',{'aria-label':label},refs.length ? refs.map(ref=>el('option',{value:ref},names.get(ref) || ref)) : [el('option',{value:''},L('Chưa có dữ liệu','暂无数据', 'データがありません'))]);
    const selectedLabel = el('span',{},label.split(' · ').at(-1)+': '+(names.get(refs[0]) || (refs[0] ?? L('Chưa có dữ liệu','暂无数据', 'データがありません'))));
    select.addEventListener('change',()=>{change(select.value);selectedLabel.textContent=label.split(' · ').at(-1)+': '+select.selectedOptions[0].textContent;refreshScore();});
    return el('label',{class:'season-slot'},[selectedLabel,select]);
  }
  const compare = el('button',{type:'button',class:'ana-btn',onClick:()=>{
    const inventory = deserializeRosterScanState(localStorage.getItem(ROSTER_SCAN_STORAGE_KEY));
    if (!inventory.ownedHeroes.length && !inventory.ownedTactics.length) {
      comparison.replaceChildren(el('p',{},L('Chưa có kho để đối chiếu.','尚无可对照的武将库。', '照合できる武将図鑑がまだありません。')),el('a',{class:'ana-link-btn',href:importHref},L('Mở scan / nhập kho','打开扫描 / 导入武将库', 'スキャン / 武将図鑑の取り込みを開く')));
      return;
    }
    const result = compareSeasonInventory(selection,inventory,createTacticIdResolver(model.data.tactics));
    const lines = [];
    for (const [key,label] of [['missingHeroes',L('Thiếu tướng','缺少武将', '不足している武将')],['missingTactics',L('Thiếu chiến pháp','缺少战法', '不足している戦法')],['lockedHeroes',L('Tướng đang khóa','锁定中的武将', 'ロック中の武将')],['lockedTactics',L('Chiến pháp đang khóa','锁定中的战法', 'ロック中の戦法')]]) if (result[key].length) lines.push(`${label}: ${result[key].map(ref=>names.get(ref) || ref).join(', ')}`);
    if (result.duplicateHeroes) lines.push(L('Trùng tướng giữa các vị trí.','不同位置之间有重复武将。', '配置間で武将が重複しています。'));
    if (result.duplicateTactics) lines.push(L('Trùng chiến pháp giữa các vị trí.','不同位置之间有重复战法。', '配置間で戦法が重複しています。'));
    if (!lines.length) lines.push(L('Đủ tướng và chiến pháp cho lựa chọn này.','武将和战法均满足此配置。', 'この構成に必要な武将と戦法が揃っています。'));
    lines.push(L('Binh thư: chưa kiểm chứng từ kho hiện tại.','兵书：尚未根据当前武将库核实。', '兵法書：現在の武将図鑑では未確認です。'));
    if (result.requirementsUnknown) lines.push(config.requirements.some(requirement=>requirement.mandatory)
      ? L('Điều kiện bắt buộc: chưa kiểm chứng; chưa thể đề xuất build.','必要条件：尚未核实，暂时无法推荐配置。', '必須条件：未確認のため、現時点では構成を提案できません。')
      : L('Điều kiện / hiệu ứng bổ sung: chưa kiểm chứng; thông tin tham khảo, không phải điều kiện bắt buộc để gợi ý đội.','附加条件 / 效果：尚未核实；仅供参考，并非推荐阵容的必要条件。', '追加条件 / 効果：未確認です。参考情報であり、おすすめ編成の必須条件ではありません。'));
    comparison.replaceChildren(...lines.map(line=>el('p',{},line)));
  }},L('Đối chiếu kho của tôi','对照我的武将库', '自分の武将図鑑と照合'));
  const detail = el('div',{id:'season-config-detail',class:'season-config-detail',role:'region','aria-label':L('Chi tiết cấu hình','配置详情', '構成の詳細'),tabindex:'-1'},[
    el('button',{type:'button',class:'ana-link-btn',onClick:onClose},L('Đóng chi tiết','关闭详情', '詳細を閉じる')),
    el('h3',{},team.name), el('p',{class:'scope-note'},L(`Cấu hình: ${config.id} · ${config.scenarioId} · ${config.rulesetId || 'Tham khảo kịch bản'}`,`配置：${config.id} · ${config.scenarioId} · ${config.rulesetId || '剧本参考'}`, `構成：${config.id} · ${config.scenarioId} · ${config.rulesetId || 'シナリオ参考'}`)),score,
    chooser(L('Loại binh','兵种', '兵種'),config.unitTypes,value=>{selection.unitType=value;}),
    ...config.heroSlots.map((slot,index)=>el('fieldset',{class:'season-hero-slot'},[
      el('legend',{},L(`Tướng ${index+1} · ${index === 0 ? 'Chủ tướng' : 'Phó tướng ' + index}`,`武将 ${index+1} · ${index === 0 ? '主将' : '副将 ' + index}`, `武将${index+1} · ${index === 0 ? '主将' : '副将' + index}`)),chooser(L(`Tướng ${index+1} · Tướng`,`武将 ${index+1} · 武将`, `武将${index+1} · 武将`),slot.heroRefs,value=>{selection.heroSlots[index].heroRef=value;}),
      ...slot.tacticSlots.map((value,i)=>chooser(L(`Tướng ${index+1} · Chiến pháp ${i+1}`,`武将 ${index+1} · 战法 ${i+1}`, `武将${index+1} · 戦法${i+1}`),value.tacticRefs,ref=>{selection.heroSlots[index].tacticRefs[i]=ref;})),
      ...slot.bookSlots.map((value,i)=>chooser(L(`Tướng ${index+1} · Binh thư ${i+1}`,`武将 ${index+1} · 兵书 ${i+1}`, `武将${index+1} · 兵法書${i+1}`),value.bookRefs,ref=>{selection.heroSlots[index].bookRefs[i]=ref;})),
      el('p',{class:'season-detail-text'},L(`Cộng điểm: ${publicText(slot.statFocusRaw)}`,`加点：${publicText(slot.statFocusRaw)}`, `ステ振り：${publicText(slot.statFocusRaw)}`)),
    ])),
    el('details',{},[
      el('summary',{},L('Đánh giá cấu hình','配置评价', '構成の評価')),
      proseNode('p',{},row.evaluation?.reviewNote, L('Chưa có đánh giá cấu hình.','暂无配置评价。', '構成の評価はまだありません。')),
      ...(row.evaluation?.rankings || []).map(rank=>el('p',{},`${rank.tier}${rank.id === row.evaluation.defaultRankingId ? L(' · Đánh giá được chọn',' · 已选评价', ' · 選択中の評価') : L(' · Đánh giá khác',' · 其他评价', ' · その他の評価')}`)),
    ]),
    el('h4',{},L('Điều kiện và hiệu ứng','条件与效果', '条件と効果')),
    ...config.requirements.map(item=>{
      const description = prose(item.descriptionRaw);
      const status = `${L('Chưa xác minh điều kiện','条件尚未核实', '条件は未確認')}${item.mandatory ? L(' · Bắt buộc',' · 必要', ' · 必須') : ''}`;
      return el('p',{class:'season-detail-text'},description === null ? status : `${description} · ${status}`);
    }),
    ...config.effectBundles.map(item=>el('div',{class:'season-effect'},[
      proseNode('h5',{},item.labelRaw),proseNode('p',{class:'season-detail-text'},item.effectsRaw),
      ...item.requirementIds.map(id=>{
        const description = prose(config.requirements.find(requirement=>requirement.id === id)?.descriptionRaw);
        return description === null ? null : el('p',{class:'season-detail-text'},L(`Điều kiện: ${description}`,`条件：${description}`, `条件：${description}`));
      }),
      el('p',{class:'scope-note'},L('Chưa xác minh điều kiện và hiệu ứng từ kho hiện tại.','尚未根据当前武将库核实条件与效果。', '現在の武将図鑑では条件と効果を確認できていません。')),
    ])),
    !config.requirements.length && !config.effectBundles.length ? el('p',{},L('Không có điều kiện đặc biệt được ghi trong cấu hình.','此配置未记录特殊条件。', 'この構成には特別な条件が記録されていません。')) : null,
    proseNode('p',{class:'season-detail-text'},config.notes, L('Ghi chú: chưa có dữ liệu','备注：暂无数据', 'メモ：データがありません')),
  ]);
  // Đếm văn xuôi bị ẩn sau khi dựng xong các khối trên; dòng báo thiếu đứng trước nút đối chiếu kho.
  if (hiddenProse) detail.append(el('p',{class:'season-detail-text detail-note-missing'},SOURCE_PROSE_MISSING_JA));
  detail.append(compare,comparison);
  refreshScore();
  return detail;
}
