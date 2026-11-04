import { L, currentLocale, normalizeLocale, pick } from "./i18n.js";
import { LOOKUP_FIELD_LABELS } from "./lookup-field-labels.js";
import { heroSelfTacticId, innateHolderIndex, uniqueTacticIdByChinese } from "./lookup-innate-holders.js";

// Bản zh (`<html lang="zh-Hans">`): nhãn dịch sang tiếng Trung; giá trị chỉ hiện khi có chữ Hán nguồn
// (tên, hiệu ứng/mục tiêu chiến pháp), là số, hoặc thuộc bộ giá trị đóng đã dịch bên dưới. Nội dung chỉ
// có bản Việt (mô tả, điều kiện, lịch sử…) bị bỏ khỏi hồ sơ zh để không trộn hai ngôn ngữ.
const ZH = () => currentLocale() === "zh";
/** Chữ cho ô chưa có dữ liệu (theo ngôn ngữ trang; hàm để build dựng cả hai ngôn ngữ trong một tiến trình). */
export const lookupEmpty = () => L("Đang cập nhật", "暂无数据");
/**
 * Chữ Hán hiệu ứng là bản dịch từ tiếng Việt, chưa đối chiếu nguồn (`lookup.effectZhSource.kind`, xem
 * docs/unified-lookup.md). Chỉ `translation` mang cờ; `source`/`capture`/`null` thì không.
 */
export const isTranslatedZhEffect = (record) => record?.lookup?.effectZhSource?.kind === "translation";
/** Hàng catalog (quân sư, công trình, cải tạo, lựa chọn) có chữ Hán chính dịch từ tiếng Việt (`zhSource.kind`). */
export const isTranslatedZhText = (record) => record?.zhSource?.kind === "translation";
/** Câu cờ bản dịch (hồ sơ, thẻ liên quan, bảng nhóm zh); mỗi nơi tự dựng thẻ với `ZH_TRANSLATED_TAG_ATTRS`. */
export const zhTranslatedNote = (locale = currentLocale()) => pick(locale, "Hiệu ứng chữ Hán dịch từ tiếng Việt, chưa đối chiếu", "中文效果译自越南语，未经核对");
/** Câu cờ cho chữ Hán (tên/mô tả) của hàng catalog dịch từ tiếng Việt. */
export const zhTranslatedTextNote = (locale = currentLocale()) => pick(locale, "Chữ Hán dịch từ tiếng Việt, chưa đối chiếu", "中文译自越南语，未经核对");
export const ZH_TRANSLATED_TAG_ATTRS = Object.freeze({ class: "lookup-version-tag lookup-zh-translated", "data-zh-source": "translation" });
const labels = () => Object.fromEntries(Object.entries(LOOKUP_FIELD_LABELS).map(([key, [vi, zh]]) => [key, L(vi, zh)]));
/** Khóa có giá trị là số/hạng chữ cái (chỉ số, tăng trưởng, thích tính) — hiện được ở bản zh. */
const LANGUAGE_NEUTRAL_KEYS = new Set(["luc", "tri", "thong", "toc", "chinh", "mi", "ky", "thuan", "cung", "thuong", "khiGioi", "infantry", "navy"]);
/** Bộ giá trị đóng của dữ liệu (tiếng Việt) → chữ Trung cho bản zh. */
const ZH_VALUES = {
  "Ngụy": "魏", "Thục": "蜀", "Ngô": "吴", "Quần": "群", "Hán": "汉",
  "Quân sự": "军事", "Nội chính": "内政",
  "Vũ khí": "武器", "Phòng cụ": "防具", "Tọa kỵ": "坐骑", "Bảo vật": "宝物",
  "Cam": "橙", "Tím": "紫",
  "Hỏa": "火", "Phong": "风", "Lâm": "林", "Sơn": "山",
  "Tăng ích": "增益", "Giảm ích": "减益", "Khống chế": "控制", "Trị liệu": "治疗", "Viện hộ": "援护",
  "Sát thương binh khí quần thể": "群体兵刃伤害", "Sát thương binh khí đơn thể": "单体兵刃伤害",
  "Mưu lược quần thể": "群体谋略伤害", "Mưu lược đơn thể": "单体谋略伤害",
  // Dạng hiệu ứng chiến pháp theo client (Thượng Thư Đài).
  "Mưu Lược đơn": "单体谋略伤害", "Mưu Lược nhóm": "群体谋略伤害", "Binh đao đơn": "单体兵刃伤害", "Binh đao nhóm": "群体兵刃伤害",
  "Cứu Viện": "援护", "Bất lợi + mưu lược quần thể": "减益 + 群体谋略伤害",
  // Mục tiêu chiến pháp chỉ có chữ Việt client (chữ Hán nguồn, khi có, dùng `target`).
  "Tôi": "自身", "Một quân địch": "敌军单体", "Một quân ta": "我军单体", "Một quân Đồng Minh": "友军单体",
  "Tập thể địch (1-2 người)": "敌军群体（1-2人）", "Tập thể địch (2 người)": "敌军群体（2人）", "Tập thể địch (3 người)": "敌军群体（3人）",
  "Tập thể quân ta (2 người)": "我军群体（2人）", "Tập thể quân ta (2-3 người)": "我军群体（2-3人）", "Tập thể quân ta (3 người)": "我军群体（3人）",
  "Nhóm tướng Đồng Minh (2 người)": "友军群体（2人）", "Toàn thể hai bên": "敌我全体",
  // Trạng thái trong ô Xung đột (so khớp không phân biệt hoa thường, nhãn ghép " / " dịch từng phần).
  "Không": "无", "Chấn nhiếp": "震慑", "Cấm trị liệu": "禁疗", "Cấp cứu": "急救", "Hỗn loạn": "混乱", "Khiêu khích": "挑衅",
  "Kháng cự": "抵御", "Kế cùng": "计穷", "Cạn kế": "计穷", "Kiệt kế": "计穷", "Kỹ cùng": "技穷", "Liên kích": "连击", "Động sát": "洞察",
  "Né tránh": "规避", "Nghỉ dưỡng": "休整", "Hưu chỉnh": "休整", "Hưu dưỡng": "休整", "Phá trận": "破阵", "Phản loạn": "叛逃",
  "Phản kích": "反击", "Chia sẻ": "分担", "Chia sẻ sát thương": "分担伤害", "Gánh thay": "分担", "Suy nhược": "虚弱", "Suy yếu": "虚弱",
  "Tan tác": "溃逃", "Hội tẩu": "溃走", "Thiêu đốt": "灼烧", "Trúng độc": "中毒", "Bão cát": "沙暴", "Thủy công": "水攻",
  "Thiết tỏa liên hoàn": "铁索连环", "Tiên công": "先攻", "Tất trúng": "必中", "Tước vũ khí": "缴械", "Phá hoại": "破坏",
  "Miễn nhiễm": "免疫", "Cảnh giới": "警戒", "Hồi phục binh lực": "恢复兵力", "Chống đỡ": "抵挡", "Ngụy báo": "伪报", "Bị tập kích": "遇袭",
  // Đối chiếu ô "效果衝突" của SGSDeck cùng chiến pháp (白衣渡江, 陷陣突襲, 鐵騎驅馳, 暗箭難防, 威武並昭).
  "Phòng ngự": "抵御", "Cùng truy": "穷追", "Tập kích": "遇袭", "Bắt giữ": "捕获", "Nhìn thấu": "看破",
  // Binh chủng và mùa.
  "Khiên binh": "盾兵", "Cung binh": "弓兵", "Thương binh": "枪兵", "Kỵ binh": "骑兵", "Khí giới": "器械",
  "Binh Diễn Xuân Thu": "兵演春秋",
  // Cấp lựa chọn cải tạo (client và nguồn).
  "Đặc biệt": "特殊", "Cơ bản": "基础", "Sơ cấp": "初级", "Trung cấp": "中级", "Cao cấp": "高级",
};
/** Khóa so khớp không phân biệt hoa thường của bộ giá trị đóng (dữ liệu client viết "Phá Trận" lẫn "Phá trận"). */
const ZH_VALUES_FOLDED = new Map(Object.entries(ZH_VALUES).map(([vi, zh]) => [vi.toLocaleLowerCase("vi"), zh]));
const zhValue = (value) => ZH_VALUES[value] ?? ZH_VALUES_FOLDED.get(String(value).trim().toLocaleLowerCase("vi")) ?? null;
/**
 * Giá trị hiển thị của bản zh: số và hạng giữ nguyên, giá trị trong bộ đóng được dịch (không phân biệt hoa thường;
 * nhãn ghép "A / B" và danh sách dịch được khi mọi phần đều dịch được), còn lại `null` (bị bỏ). Bản Việt luôn trả
 * chữ gốc. `locale` mặc định là ngôn ngữ trang (build truyền tường minh).
 */
export function zhSafeValue(value, locale = currentLocale()) {
  if (normalizeLocale(locale) !== "zh") return value;
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    const parts = value.map((item) => zhSafeValue(item, locale));
    return parts.length && parts.every((part) => part !== null) ? parts.join("、") : null;
  }
  if (typeof value === "number" || /^[\d.,%+\-/ ~]+$/u.test(String(value)) || /^(?:[SABCD]|T\d|SP|CO|40Y)$/u.test(String(value))) return String(value);
  const whole = zhValue(value);
  if (whole !== null || !String(value).includes(" / ")) return whole;
  const parts = String(value).split(" / ").map(zhValue);
  return parts.every((part) => part !== null) ? parts.join(" / ") : null;
}

/** Khóa không có nhãn bị bỏ khỏi hồ sơ; cảnh báo dev một lần cho mỗi khóa để bổ sung nhãn. */
const UNKNOWN_LABEL_KEYS = new Set();

const text = (value) => value === null || value === undefined || value === "" ? lookupEmpty() : String(value);
function field(key, value, labelVi = labels()[key], render = text(value)) {
  if (!labelVi) {
    if (!UNKNOWN_LABEL_KEYS.has(key)) {
      UNKNOWN_LABEL_KEYS.add(key);
      console.warn(`Tra cứu: chưa có nhãn tiếng Việt cho trường "${key}" — trường bị bỏ khỏi hồ sơ`);
    }
    return null;
  }
  return { key, labelVi, value, textVi: render };
}
/** Đẩy trường đã có nhãn vào hồ sơ; trường không nhãn hoặc rỗng thì bỏ qua. */
function pushField(profile, key, value, labelVi, render) {
  const item = field(key, value, labelVi, render);
  if (item) profile.fields.push(item);
  return item;
}
/**
 * Trường có giá trị là chữ tiếng Việt: bản Việt đẩy như cũ; bản zh chỉ đẩy khi `zhSafeValue` dịch được
 * (hoặc có chữ Hán nguồn `raw`), không thì bỏ và đánh dấu hồ sơ còn nội dung chỉ có bản Việt.
 */
function pushLocalized(profile, key, value, labelVi, render = text(value), raw = null) {
  if (!ZH()) return pushField(profile, key, value, labelVi, render);
  const rawText = typeof raw === "string" ? raw.trim() : "";
  if (rawText) return pushField(profile, key, rawText, labelVi, rawText);
  if (value === null || value === undefined || value === "") return pushField(profile, key, value, labelVi, render);
  const shown = zhSafeValue(value);
  if (shown === null) {
    profile.viOnly = true;
    return null;
  }
  return pushField(profile, key, value, labelVi, String(shown));
}
/** Điều kiện/lịch sử chỉ có bản Việt: bản zh bỏ và đánh dấu. */
function viOnlyList(profile, rows) {
  if (!ZH()) return rows;
  if (rows.length) profile.viOnly = true;
  return [];
}
/** Điều kiện: bản zh hiện khi mọi dòng thuộc bộ giá trị đóng (vd mùa "Binh Diễn Xuân Thu"), không thì bỏ và đánh dấu. */
function localizedConditions(profile, rows) {
  if (!ZH()) return rows;
  const shown = rows.map((row) => zhSafeValue(row));
  if (shown.every((row) => row !== null)) return shown;
  profile.viOnly = true;
  return [];
}
const conditions = (rows) => (Array.isArray(rows) ? rows.map((row) => typeof row === "string" ? row : row?.textVi).filter(Boolean) : []);
const unresolved = (key, labelVi) => ({ key, labelVi, resolved: false, targetId: null, targetGroup: null, titleVi: null, statusVi: L("Liên kết đang được cập nhật", "关联条目更新中") });
const listText = (values, empty = lookupEmpty()) => Array.isArray(values) && values.length ? values.join(", ") : empty;
const variantLabels = () => ({ base: L("Thường", "普通"), sp: "SP", co: "CO", "40y": "40Y" });
/** Loại chiến pháp trong dữ liệu là enum tiếng Anh/đã Việt hoá; UI chỉ hiện nhãn đã dịch (cặp vi/zh). */
const TYPE_LABELS = {
  ACTIVE: ["Chủ động", "主动"], PASSIVE: ["Bị động", "被动"], COMMAND: ["Chỉ huy", "指挥"], INTERNAL: ["Nội chính", "内政"],
  FORMATION: ["Trận pháp", "阵法"], TROOP: ["Binh chủng", "兵种"], BURST: ["Bùng nổ", "突击"],
};
/** Vài bản ghi lưu loại đã Việt hoá: bản zh đổi về cùng nhãn Trung với enum. */
const VI_TYPE_TO_ENUM = { "Chủ động": "ACTIVE", "Bị động": "PASSIVE", "Chỉ huy": "COMMAND", "Nội chính": "INTERNAL", "Trận pháp": "FORMATION", "Binh chủng": "TROOP", "Bùng nổ": "BURST" };
const RAW_ENUM = /^[A-Z][A-Z0-9_]*$/;

/**
 * Tỷ lệ kích hoạt trong dữ liệu là phân số 0–1 → "55%" / "37.5%". Giá trị ngoài khoảng đó (hoặc không
 * hữu hạn) là lỗi dữ liệu: không in ra số vô nghĩa ("5000%"), hiện gạch ngang và cảnh báo dev một lần.
 */
const INVALID = "—";
const RATE_WARNED = new Set();
export function ratePercentText(value) {
  if (value === null || value === undefined || value === "") return lookupEmpty();
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    if (!RATE_WARNED.has(String(value))) {
      RATE_WARNED.add(String(value));
      console.warn(`Tra cứu: tỷ lệ kích hoạt ngoài khoảng 0–1 (${String(value)}) — không hiển thị`);
    }
    return INVALID;
  }
  return `${Number((rate * 100).toFixed(1))}%`;
}

/** Từ mở đầu nhãn phiên bản: bản Việt và chữ Hán nguồn mà bản zh hiển thị ("2021-06-09 更新（平衡）", "原始版本"). */
const VERSION_WORD = "(?:Cập nhật|Phiên bản gốc|\\d{4}-\\d{2}-\\d{2}\\s*更新|原始版本)";
/** Đoạn chỉ gồm nhãn phiên bản: "Cập nhật 2021-06-09 (cân bằng)", "Phiên bản gốc". */
const VERSION_ONLY = new RegExp(`^${VERSION_WORD}[^:：.;。；]{0,60}$`, "u");
/** Đoạn mở bằng nhãn phiên bản rồi dấu hai chấm: "Cập nhật ngày 2020-04-01: <hiệu ứng>". */
const VERSION_INLINE = new RegExp(`^(${VERSION_WORD}[^:：.;。；]{0,60}?)\\s*[:：]\\s*([\\s\\S]+)$`, "u");

/** Đoạn chỉ là nhãn phiên bản (có thể kèm dấu hai chấm cuối): "Cập nhật 2023-05-09 (tăng cường):", "Phiên bản gốc". */
const VERSION_HEADING = new RegExp(`^${VERSION_WORD}[^:：.;。；]{0,60}[:：]?$`, "u");
export const isVersionHeading = (paragraph) => VERSION_HEADING.test(String(paragraph ?? "").trim());

/**
 * Tách chữ hiệu ứng nhiều phiên bản thành các khối `{ labelVi, paragraphs }` theo thứ tự nguồn (bản hiện hành
 * trước). Nguồn ngăn đoạn bằng " / " (có khi " / / ") hoặc xuống dòng, và mỗi phiên bản mở bằng một đoạn nhãn
 * ("Cập nhật … / <hiệu ứng> / Phiên bản gốc / <hiệu ứng>"). Chữ không mở bằng nhãn phiên bản chỉ tách theo
 * xuống dòng: " / " ở đó nghĩa là "hoặc" ("công thành / đánh khí giới").
 */
export function effectVersions(value) {
  const source = String(value ?? "").trim();
  if (!source) return [];
  const parts = (pattern) => source.split(pattern).map((part) => part.trim()).filter(Boolean);
  const first = source.split(/\s+\/\s+|\n/u, 1)[0].trim();
  if (!VERSION_ONLY.test(first) && !VERSION_INLINE.test(first)) return [{ labelVi: null, paragraphs: parts(/\n+/u) }];
  const blocks = [];
  for (const part of parts(/\s+(?:\/\s+)+|\n+/u)) {
    const head = VERSION_ONLY.test(part) ? [part, null] : VERSION_INLINE.exec(part)?.slice(1);
    if (head) blocks.push({ labelVi: head[0].trim(), paragraphs: head[1] ? [head[1].trim()] : [] });
    else blocks.at(-1).paragraphs.push(part);
  }
  return blocks.filter((block) => block.paragraphs.length);
}

/**
 * Nhãn của một giá trị `type` chiến pháp theo ngôn ngữ, dùng chung cho mọi chỗ hiển thị (bảng, thẻ
 * chiến pháp, thẻ kết quả). Giá trị đã Việt hoá giữ nguyên ở bản Việt; enum thô không có nhãn
 * bị bỏ (kèm cảnh báo dev) để UI không bao giờ in enum; giá trị khác trả nguyên văn (bản zh: bỏ).
 */
export function tacticTypeLabel(value, locale = currentLocale()) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  const label = TYPE_LABELS[text];
  if (label) return pick(locale, ...label);
  if (RAW_ENUM.test(text)) {
    if (!UNKNOWN_LABEL_KEYS.has(`type:${text}`)) {
      UNKNOWN_LABEL_KEYS.add(`type:${text}`);
      console.warn(`Tra cứu: chưa có nhãn tiếng Việt cho loại chiến pháp "${text}" — không hiển thị`);
    }
    return null;
  }
  if (normalizeLocale(locale) === "zh") {
    const pair = TYPE_LABELS[VI_TYPE_TO_ENUM[text]];
    return pair ? pair[1] : null;
  }
  return text;
}
const flagLabels = () => ({
  isCollectible: L("Sưu tầm", "典藏"), isDynamicOpen: L("Mở động", "动态开放"), isMusou: L("Vô Song", "无双"), isCO: "CO", isSp: "SP",
});

/**
 * Tên hiển thị của một mục tra cứu: bản Việt dùng tên Việt, bản zh dùng tên chữ Hán nguồn
 * (`chinese` của tướng/chiến pháp, `aliasesZh` của catalog), rồi tên dịch `nameZh` của catalog, thiếu thì lùi về tên Việt.
 */
export function lookupDisplayName(record, nameVi, locale = currentLocale()) {
  if (normalizeLocale(locale) !== "zh") return nameVi;
  if (typeof record?.chinese === "string" && record.chinese.trim()) return record.chinese.trim();
  for (const value of record?.aliasesZh ?? []) if (typeof value === "string" && /[\u3400-\u9fff]/u.test(value)) return value;
  if (typeof record?.nameZh === "string" && record.nameZh.trim()) return record.nameZh.trim();
  return nameVi;
}

const entryTitle = (entry) => lookupDisplayName(entry.record, entry.nameVi);

function optionalField(profile, key, value, labelVi, render = text(value)) {
  if (value !== null && value !== undefined && value !== "") pushField(profile, key, value, labelVi, render);
}

function optionalLocalized(profile, key, value, labelVi, render = text(value)) {
  if (value !== null && value !== undefined && value !== "") pushLocalized(profile, key, value, labelVi, render);
}

function relation(corpus, key, labelVi, targetId, targetGroup) {
  const target = targetId ? corpus.byId.get(targetId) : null;
  return target
    ? { key, labelVi, resolved: true, targetId: target.id, targetGroup, titleVi: entryTitle(target), statusVi: null }
    : unresolved(key, labelVi);
}

const innateHolderCache = new WeakMap();

/** Chiều ngược của "Chiến pháp bản thân": chiến pháp → tướng, tính một lần cho mỗi corpus. */
function innateHolders(corpus) {
  if (!innateHolderCache.has(corpus)) innateHolderCache.set(corpus, innateHolderIndex(corpus.heroes, corpus.tactics));
  return innateHolderCache.get(corpus);
}

function base(entry) {
  return { id: entry.id, group: entry.group, titleVi: entryTitle(entry), fields: [], aptitudes: [], sections: [], relations: [], children: [], conditions: [], revisions: [], viOnly: false, zhTranslated: false };
}

/** Tên chữ Hán của võ tướng theo tên Việt hiển thị trong dữ liệu (tên chính, Hán-Việt, bí danh không có chữ Hán). */
const HERO_ZH_BY_NAME = new WeakMap();
function heroChinese(corpus, name) {
  if (!corpus?.byId) return null;
  let index = HERO_ZH_BY_NAME.get(corpus);
  if (!index) {
    index = new Map();
    for (const entry of corpus.byId.values()) {
      const record = entry?.record;
      if (entry?.group !== "heroes" || typeof record?.chinese !== "string" || !record.chinese.trim()) continue;
      for (const value of [entry.nameVi, record.viet, record.hanViet, ...(record.aliases ?? [])]) {
        if (typeof value === "string" && value.trim() && !/[\u3400-\u9fff]/u.test(value) && !index.has(value.trim())) index.set(value.trim(), record.chinese.trim());
      }
    }
    HERO_ZH_BY_NAME.set(corpus, index);
  }
  return index.get(String(name ?? "").trim()) ?? null;
}

const CJK = /[\u3400-\u9fff]/u;

/**
 * Tên sự kiện chữ Hán (TW) theo tên Việt client, đối chiếu trang chiến pháp sự kiện tương ứng trên sgsdeck.com
 * (tên trong "Sự kiện X — …" và tên ở "Cách nhận"). Sự kiện chưa có nguồn đối chiếu thì không có ở đây.
 */
const EVENT_ZH = new Map(Object.entries({
  "Giả Kế Thoát Hiểm": "詐計脫險", "Bát Trận Đồ": "八陣圖", "Chia Ba Thiên Hạ": "三分天下", "Tam Phân Thiên Hạ": "三分天下",
  "Giải Phiền Vệ": "解煩衛", "Nước Ngập Thất Quân": "水淹七軍", "Thủy Yêm Thất Quân": "水淹七軍",
  "Cắt Râu Vứt Áo": "割須棄袍", "Cắt râu bỏ áo": "割須棄袍", "Chung Hội Chi Loạn": "鍾會之亂", "Loạn Chung Hội": "鍾會之亂",
  "Dương Đông Kích Tây": "彭越撓楚", "Bành Việt Nạo Sở": "彭越撓楚", "Trận Nam Quận": "南郡之戰",
  "Tôn Sách bị thích sát": "孫策遇刺", "Tôn Sách bị ám sát": "孫策遇刺", "Trận trảm Hạ Hầu Uyên": "陣斬夏侯淵",
  "Ép buộc thiên tử lệnh chư hầu": "挾天子令諸侯", "Đồng lực hiệp khế": "同力協契", "Vu Cát Cầu Mưa": "于吉請雨",
  "Đan Dương Tinh Binh": "丹陽精兵", "Đình Phụng Nghi": "鳳儀亭", "Xây Dựng Đồn Điền": "建置屯田", "Kiến Trí Đồn Điền": "建置屯田",
}).map(([vi, zh]) => [vi.toLocaleLowerCase("vi"), zh]));

/**
 * Tên sự kiện chữ Hán theo tên Việt: `sourceHeroCn` nguồn ("事件战法X") của chính chiến pháp, rồi của chiến pháp sự kiện
 * khác cùng tên (khóa bằng tên trong "Sự kiện X — …" lẫn mục `acquiredFromVi` duy nhất), rồi `EVENT_ZH`.
 */
const EVENT_ZH_BY_NAME = new WeakMap();
function eventChinese(corpus, row, name) {
  if (row.source === "EVENT" && typeof row.sourceHeroCn === "string" && CJK.test(row.sourceHeroCn)) return row.sourceHeroCn.replace(/^事件(?:战法|戰法)?/u, "").trim();
  if (!corpus?.byId) return null;
  let index = EVENT_ZH_BY_NAME.get(corpus);
  if (!index) {
    index = new Map();
    for (const entry of corpus.byId.values()) {
      const record = entry?.record;
      if (entry?.group !== "tactics" || record?.source !== "EVENT" || typeof record.sourceHeroCn !== "string" || !CJK.test(record.sourceHeroCn)) continue;
      const zh = record.sourceHeroCn.replace(/^事件(?:战法|戰法)?/u, "").trim();
      const exchange = /^Sự kiện (.+?) — /u.exec(String(record.lookup?.exchangeConditionVi ?? ""))?.[1];
      const acquired = record.lookup?.acquiredFromVi?.length === 1 ? record.lookup.acquiredFromVi[0] : null;
      for (const key of [exchange, acquired]) if (key && !index.has(key)) index.set(key, zh);
    }
    EVENT_ZH_BY_NAME.set(corpus, index);
  }
  const key = String(name ?? "").trim();
  return index.get(key) ?? EVENT_ZH.get(key.toLocaleLowerCase("vi")) ?? null;
}

/** Một mục "Cách nhận" dạng tên võ tướng: "A & SP A" / "A, B", hậu tố "(cấp B)" đổi sang "（B级）"; tên không tra được thì `null`. */
function acquiredItemZh(corpus, item) {
  const grade = /^(.+?)\s*\(cấp ([A-Z])\)$/u.exec(item);
  const names = (grade ? grade[1] : item).split(/ & |, /u).map((name) => heroChinese(corpus, name));
  return names.every(Boolean) ? `${names.join("、")}${grade ? `（${grade[2]}级）` : ""}` : null;
}

/** Cách nhận (bản zh): chữ Hán nguồn `sourceHeroCn`; thiếu thì ghép tên Hán của võ tướng/sự kiện (mọi mục phải tra được). */
function acquiredFromZh(corpus, row) {
  if (typeof row.sourceHeroCn === "string" && CJK.test(row.sourceHeroCn)) return row.sourceHeroCn.trim();
  const items = (row.lookup?.acquiredFromVi ?? []).map((item) => (row.source === "EVENT" ? eventChinese(corpus, row, item) : null) ?? acquiredItemZh(corpus, item));
  return items.length && items.every(Boolean) ? items.join("、") : null;
}

/** Một ô đổi thẻ: "A (Thục) hoặc B (Ngô): cần 1 thẻ" hoặc "tướng 5 sao phe Quần: cần 3 thẻ"; dạng khác/tên lạ thì `null`. */
function exchangeCellZh(corpus, cell) {
  const tier = /^tướng (\d) sao phe (Ngụy|Thục|Ngô|Quần|Hán): cần (\d+) thẻ$/u.exec(cell);
  if (tier) return `${ZH_VALUES[tier[2]]}阵营 ${tier[1]} 星武将需 ${tier[3]} 张`;
  const match = /^(.+): cần (\d+) thẻ$/u.exec(cell);
  if (!match) return null;
  const heroes = match[1].split(" hoặc ").map((part) => {
    const hero = /^(.+?) \((Ngụy|Thục|Ngô|Quần|Hán)\)$/u.exec(part);
    const zh = hero ? heroChinese(corpus, hero[1]) : null;
    return zh ? `${zh}（${ZH_VALUES[hero[2]]}）` : null;
  });
  return heroes.every(Boolean) ? `${heroes.join("或")}需 ${match[2]} 张` : null;
}

/**
 * Điều kiện đổi không theo mẫu "Sự kiện X — …": "A / B / C (chọn 4 thẻ bất kỳ)" hoặc "A (cần 1 thẻ), B (cần 1 thẻ)";
 * dạng khác hoặc tên không tra được thì `null`.
 */
function heroCardsZh(corpus, text) {
  const any = /^(.+) \(chọn (\d+) thẻ bất kỳ\)$/u.exec(text);
  if (any) {
    const names = any[1].split(" / ").map((name) => heroChinese(corpus, name));
    return names.every(Boolean) ? `${names.join("、")}（任选 ${any[2]} 张）` : null;
  }
  const cells = text.split(", ").map((cell) => {
    const match = /^(.+?) \(cần (\d+) thẻ\)$/u.exec(cell);
    const hero = match ? heroChinese(corpus, match[1]) : null;
    return hero ? `${hero}需 ${match[2]} 张` : null;
  });
  return cells.every(Boolean) ? cells.join("；") : null;
}

/**
 * Điều kiện đổi chiến pháp (bản zh): "Sự kiện X — A (Thục): cần 1 thẻ; …" ghép từ tên sự kiện chữ Hán (`eventChinese`)
 * và từng ô đổi thẻ; dạng chỉ có danh sách thẻ (`heroCardsZh`) thêm tên sự kiện nguồn khi chiến pháp là chiến pháp sự kiện.
 */
function exchangeConditionZh(corpus, row) {
  const text = String(row.lookup?.exchangeConditionVi ?? "");
  const match = /^Sự kiện (.+?) — (.+)$/u.exec(text);
  if (!match) {
    const cards = text ? heroCardsZh(corpus, text) : null;
    const event = cards && row.source === "EVENT" ? eventChinese(corpus, row, row.lookup?.acquiredFromVi?.[0]) : null;
    return cards && event ? `${event}事件：${cards}` : cards;
  }
  const event = eventChinese(corpus, row, match[1]);
  if (!event) return null;
  const parts = match[2].split("; ").map((cell) => exchangeCellZh(corpus, cell));
  return parts.every(Boolean) ? `${event}事件：${parts.join("；")}` : null;
}

const percentText = (rate) => `${Number((rate * 100).toFixed(1))}%`;
/** Một dòng "Cách nhận": loại gói · tên gói, tướng có phải tướng lõi không và tỉ lệ ra tướng lõi/thường của cả gói. */
function cardPackField(pack, index) {
  const labelVi = ZH() ? `${pack.categoryZh} · ${pack.packZh}` : `${pack.categoryVi} · ${pack.packVi}`;
  const tier = pack.isCore ? L("Tướng lõi", "核心") : L("Thường", "非核心");
  const rates = `${L("lõi", "核心")} ${percentText(pack.coreRate)} / ${L("thường", "非核心")} ${percentText(pack.nonCoreRate)}`;
  return field(`cardPack${index}`, pack.isCore, labelVi, `${tier} · ${rates}`);
}

function heroProfile(corpus, entry) {
  const row = entry.record;
  const lookup = row.lookup ?? {};
  const profile = base(entry);
  optionalField(profile, "variant", lookup.variant, L("Biến thể", "版本"), variantLabels()[lookup.variant] ?? text(lookup.variant));
  optionalLocalized(profile, "faction", row.faction, L("Phe", "阵营"));
  optionalField(profile, "stars", row.stars, L("Sao", "星级"));
  optionalField(profile, "cost", row.cost, L("Thống ngự", "统御"));
  // Vai trò và danh hiệu: bản zh hiện chữ Hán nguồn (`roleTag`, `exclusiveTitleZh`).
  if (row.roleTagViet) pushLocalized(profile, "roleTagViet", row.roleTagViet, L("Vai trò", "定位"), text(row.roleTagViet), row.roleTag);
  optionalLocalized(profile, "categoryVi", lookup.categoryVi, L("Phân loại", "类别"));
  if (lookup.exclusiveTitleVi) pushLocalized(profile, "exclusiveTitleVi", lookup.exclusiveTitleVi, L("Danh hiệu độc quyền", "专属称号"), text(lookup.exclusiveTitleVi), lookup.exclusiveTitleZh);
  optionalField(profile, "civilInnatePoints", lookup.civilInnatePoints, L("Điểm nội chính", "内政点数"));
  for (const [key, value, label] of [
    ["collectibleBonusVi", lookup.collectibleBonusVi, L("Thưởng sưu tầm", "典藏加成")],
    ["redRulesVi", lookup.redRulesVi, L("Quy tắc điểm đỏ", "红度规则")],
  ]) optionalLocalized(profile, key, value, label);
  const enabledFlags = Object.entries(lookup.flags ?? {}).filter(([, enabled]) => enabled === true).map(([key]) => flagLabels()[key] ?? key);
  if (enabledFlags.length) pushField(profile, "flags", enabledFlags, L("Đặc tính", "特性"), enabledFlags.join(" · "));
  // Đánh giá giữ/rã thẻ: bản zh hiện chữ Hán nguồn `usageZh`.
  if (lookup.usageVi) pushLocalized(profile, "usage", lookup.usageVi, L("Đánh giá", "评价"), lookup.usageVi, lookup.usageZh);
  for (const key of ["luc", "tri", "thong", "toc", "chinh", "mi"]) pushField(profile, key, row.stats?.[key]);
  profile.aptitudes = [
    ...["ky", "thuan", "cung", "thuong", "khiGioi"].map((key) => field(key, row.troopApt?.[key])),
    ...["infantry", "navy"].map((key) => field(key, lookup.otherAptitudes?.[key])),
  ].filter(Boolean);
  const growth = Object.entries(lookup.growth ?? {}).map(([key, value]) => field(key, value)).filter(Boolean);
  profile.sections.push({ key: "growth", titleVi: L("Tăng trưởng", "成长"), fields: growth });
  if (lookup.cardPacks?.length) profile.sections.push({ key: "cardPacks", titleVi: L("Cách nhận", "获取途径"), fields: lookup.cardPacks.map(cardPackField) });
  const selfId = heroSelfTacticId(row, corpus.tactics);
  const inheritId = lookup.inheritTacticId ?? uniqueTacticIdByChinese(corpus.tactics, row.inheritTacticCn);
  profile.relations.push(relation(corpus, "selfTactic", L("Chiến pháp bản thân", "自带战法"), selfId, "tactics"));
  if (lookup.inheritTacticId || row.inheritTacticCn) profile.relations.push(relation(corpus, "inheritTactic", L("Chiến pháp truyền thừa", "传承战法"), inheritId, "tactics"));
  if (lookup.advisorId) profile.relations.push(relation(corpus, "advisor", L("Kỹ năng quân sư", "军师技"), lookup.advisorId, "advisors"));
  profile.conditions = localizedConditions(profile, conditions(lookup.conditions));
  profile.revisions = viOnlyList(profile, lookup.revisions ?? []);
  return profile;
}

function tacticProfile(corpus, entry) {
  const row = entry.record;
  const lookup = row.lookup ?? {};
  const profile = base(entry);
  // Hiệu ứng và mục tiêu có chữ Hán nguồn (`effect`, `target`): bản zh hiện nguyên văn.
  pushLocalized(profile, "effect", row.effectViet, L("Hiệu ứng", "效果"), text(row.effectViet), row.effect);
  pushLocalized(profile, "target", row.targetViet, L("Mục tiêu", "目标"), text(row.targetViet), row.target);
  const rate = lookup.activationRate;
  pushField(profile, "activationRate", rate, L("Tỷ lệ kích hoạt", "发动率"), ratePercentText(rate));
  for (const [key, label] of [["type", L("Loại", "类型")], ["quality", L("Phẩm chất", "品质")], ["effectTypeVi", L("Dạng hiệu ứng", "效果类型")], ["exchangeConditionVi", L("Điều kiện đổi", "兑换条件")]]) {
    const value = key in row ? row[key] : lookup[key];
    if (value === undefined || value === "") continue;
    if (key === "type") {
      const typeVi = tacticTypeLabel(value);
      if (!typeVi) continue;
      pushField(profile, key, value, label, typeVi);
      continue;
    }
    pushLocalized(profile, key, value, label, text(value), key === "exchangeConditionVi" ? exchangeConditionZh(corpus, row) : null);
  }
  for (const [key, label] of [["cooldown", L("Hồi chiêu", "冷却")], ["maxUsers", L("Số người dùng tối đa", "最多携带人数")], ["pointCost", L("Điểm chiến pháp", "战法点")]]) {
    optionalLocalized(profile, key, lookup[key], label);
  }
  if (lookup.acquiredFromVi?.length) pushLocalized(profile, "acquiredFromVi", lookup.acquiredFromVi, L("Cách nhận", "获取方式"), listText(lookup.acquiredFromVi), acquiredFromZh(corpus, row));
  optionalLocalized(profile, "conflictsVi", lookup.conflictsVi, L("Xung đột", "冲突"));
  for (const id of lookup.inheritedFromIds ?? []) profile.relations.push(relation(corpus, `inheritedFrom:${id}`, L("Truyền thừa từ", "传承自"), id, "heroes"));
  for (const id of innateHolders(corpus).get(row.id) ?? []) profile.relations.push(relation(corpus, `innateHolder:${id}`, L("Chiến pháp tự có của", "自带武将"), id, "heroes"));
  profile.conditions = localizedConditions(profile, conditions(lookup.conditions));
  profile.revisions = viOnlyList(profile, lookup.revisions.map((item) => ({ ...item })));
  return profile;
}

function equipmentProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "slot", row.slotVi, L("Vị trí", "部位"));
  pushLocalized(profile, "quality", row.qualityVi, L("Phẩm chất", "品质"));
  const items = corpus.catalog.specials.filter((item) => item.equipmentId === row.id).map((item) => ({ id: item.id, titleVi: lookupDisplayName(item, item.nameVi) }));
  profile.children.push({ key: "specials", titleVi: L("Đặc kỹ", "特技"), items });
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

function specialProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "description", row.descriptionVi, L("Mô tả", "描述"));
  pushLocalized(profile, "tier", row.tierVi, L("Bậc", "等级"));
  pushLocalized(profile, "slot", row.slotVi, L("Vị trí", "部位"));
  pushLocalized(profile, "acquisitionVi", row.acquisitionVi, L("Cách nhận", "获取方式"), listText(row.acquisitionVi));
  profile.relations.push(relation(corpus, "equipment", L("Trang bị", "装备"), row.equipmentId, "equipment"));
  if (row.exclusiveHeroId) profile.relations.push(relation(corpus, "exclusiveHero", L("Tướng độc quyền", "专属武将"), row.exclusiveHeroId, "heroes"));
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

function advisorProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "elementVi", row.elementVi, L("Nguyên tố", "属性"));
  pushLocalized(profile, "effect", row.effectVi, L("Hiệu ứng", "效果"), text(row.effectVi), row.effectZh);
  pushLocalized(profile, "usage", row.usageVi, L("Cách dùng", "用法"), text(row.usageVi), row.usageZh);
  profile.zhTranslated = ZH() && isTranslatedZhText(row);
  pushField(profile, "tacticPoints", row.tacticPoints, L("Điểm chiến pháp", "战法点"));

  profile.children.push({ key: "heroes", titleVi: L("Tướng", "武将"), items: row.heroIds.map((id) => corpus.byId.get(id)).filter(Boolean).map((item) => ({ id: item.id, titleVi: entryTitle(item) })) });
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

function troopProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "effect", row.effectVi, L("Hiệu ứng", "效果"), text(row.effectVi), row.effectZh);
  pushLocalized(profile, "appliesTo", row.appliesToVi, L("Áp dụng", "适用"), text(row.appliesToVi), row.appliesToZh);
  pushLocalized(profile, "suggestedBuild", row.suggestedBuildVi, L("Gợi ý", "推荐"), text(row.suggestedBuildVi), row.suggestedBuildZh);
  pushLocalized(profile, "troopLimitVi", row.troopLimitVi, L("Giới hạn binh chủng", "兵种限制"), listText(row.troopLimitVi, L("Không giới hạn", "无限制")));

  // Bản zh hiện lựa chọn có chữ Hán (nguồn hoặc bản dịch); lựa chọn chỉ có chữ Việt bị bỏ và hồ sơ được đánh dấu.
  const options = ZH() ? row.options.filter((item) => item.nameZh) : row.options;
  if (ZH() && options.length < row.options.length) profile.viOnly = true;
  profile.children.push({ key: "options", titleVi: L("Lựa chọn", "选项"), items: options.map((item) => ZH()
    ? { id: item.id, titleVi: item.nameZh, tierVi: zhSafeValue(item.tierVi) ?? lookupEmpty(), descriptionVi: text(item.descriptionZh), convertsToVi: zhSafeValue(item.convertsToVi) ?? lookupEmpty() }
    : { id: item.id, titleVi: item.nameVi, tierVi: item.tierVi, descriptionVi: text(item.descriptionVi), convertsToVi: text(item.convertsToVi) }) });
  profile.zhTranslated = ZH() && (isTranslatedZhText(row) || options.some(isTranslatedZhText));
  profile.revisions = viOnlyList(profile, row.revisions.map((item) => ({ ...item })));
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

/** Thời lượng dữ liệu dạng "2 giờ" / "5 phút": bản zh đổi đơn vị, dạng khác bỏ (`null`). */
function durationText(value) {
  const shown = text(value);
  if (!ZH() || shown === lookupEmpty()) return shown;
  const match = /^(\d+(?:[.,]\d+)?)\s*(giờ|phút|ngày|giây)$/u.exec(String(value).trim());
  if (!match) return null;
  return `${match[1]} ${{ "giờ": "小时", "phút": "分钟", "ngày": "天", "giây": "秒" }[match[2]]}`;
}

function buildingProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "summary", row.summaryVi, L("Tóm tắt", "概述"), text(row.summaryVi), row.summaryZh);
  profile.zhTranslated = ZH() && isTranslatedZhText(row);
  pushField(profile, "maxLevel", row.maxLevel, L("Cấp tối đa", "最高等级"));
  pushField(profile, "mainCityOnly", row.mainCityOnly, L("Phạm vi xây dựng", "建造范围"), row.mainCityOnly ? L("Chỉ thành chính", "仅主城") : L("Mọi thành", "所有城池"));

  const levels = [...row.levels].sort((a, b) => a.level - b.level).map((item) => {
    const durationVi = ZH() && item.durationZh ? item.durationZh : durationText(item.durationVi);
    // Hiệu ứng cấp: bản zh dùng chữ Hán nguồn; cấp chỉ có chữ Việt (hoặc thời lượng không đọc được) bị bỏ ô và đánh dấu.
    const effectZh = item.effectZh ?? null;
    if (ZH() && ((!effectZh && item.effectVi && item.effectVi !== lookupEmpty()) || durationVi === null)) profile.viOnly = true;
    return { id: item.id, level: item.level, costs: { ...item.costs }, durationVi: durationVi ?? lookupEmpty(), effectVi: ZH() ? text(effectZh) : text(item.effectVi) };
  });
  profile.children.push({ key: "levels", titleVi: L("Cấp công trình", "建筑等级"), items: levels });
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

/**
 * Binh thư: tên (Việt, Hán-Việt, chữ Hán) và hiệu ứng nếu dữ liệu có — bản Việt hiện `effectViet` đã duyệt,
 * bản zh hiện chữ Hán nguồn `effect`, kèm mốc số liệu: bản Việt dùng `effectVietVersion` khi chữ Việt chép từ
 * client Global (mốc riêng), không thì `effectVersion` của nguồn. Mục chưa có hiệu ứng để trạng thái
 * trống chung, không bịa. Tên Hán-Việt chỉ hiện ở bản Việt khi khác tên dịch nghĩa. Tên cũ trong nguồn
 * (`formerNames`, chữ Hán) chỉ hiện ở bản zh để trang Việt không lẫn chữ Hán.
 */
function bookProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  if (!ZH() && row.hanViet && row.hanViet !== row.viet) pushField(profile, "hanViet", row.hanViet, L("Tên Hán-Việt", "汉越名"));
  if (ZH() && row.formerNames?.length) pushField(profile, "formerNames", row.formerNames.join(" · "), L("Tên cũ", "旧名"));
  const hasEffect = Boolean(row.effect && row.effectViet);
  pushField(profile, "effect", hasEffect ? (ZH() ? row.effect : row.effectViet) : null, L("Hiệu ứng", "效果"));
  const version = ZH() ? row.effectVersion : (row.effectVietVersion ?? row.effectVersion);
  if (hasEffect && version) pushField(profile, "effectVersion", version, L("Số liệu theo bản", "数据版本"));
  return profile;
}

export function lookupProfile(corpus, id) {
  const entry = corpus?.byId?.get(id);
  if (!entry) return null;
  if (entry.id.startsWith("hero:")) return heroProfile(corpus, entry);
  if (entry.id.startsWith("tactic:")) return tacticProfile(corpus, entry);
  if (entry.id.startsWith("equipment-special:")) return specialProfile(corpus, entry);
  if (entry.id.startsWith("equipment:")) return equipmentProfile(corpus, entry);
  if (entry.id.startsWith("advisor:")) return advisorProfile(corpus, entry);
  if (entry.id.startsWith("troop-mod:")) return troopProfile(corpus, entry);
  if (entry.id.startsWith("building:")) return buildingProfile(corpus, entry);
  if (entry.id.startsWith("book:")) return bookProfile(corpus, entry);
  return null;
}
