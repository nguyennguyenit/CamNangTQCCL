import { L, contentLocaleIsVietnamese, contentMode as contentModeOf, currentLocale, pick } from "./i18n.js";
import { LOOKUP_FIELD_LABELS } from "./lookup-field-labels.js";
import { heroSelfTacticId, innateHolderIndex, uniqueTacticIdByChinese } from "./lookup-innate-holders.js";

// Bản zh (`<html lang="zh-Hans">`): nhãn dịch sang tiếng Trung; giá trị chỉ hiện khi có chữ Hán nguồn
// (tên, hiệu ứng/mục tiêu chiến pháp), là số, hoặc thuộc bộ giá trị đóng đã dịch bên dưới. Nội dung chỉ
// có bản Việt (mô tả, điều kiện, lịch sử…) bị bỏ khỏi hồ sơ zh để không trộn hai ngôn ngữ.
// `sourceText()`: trang không phải bản Việt dựng hồ sơ từ chữ Hán nguồn (hiện chỉ có bản zh).
const sourceText = () => !contentLocaleIsVietnamese(currentLocale());
/** Nguồn chữ của trang theo ngôn ngữ (`vi` / `source` / `ja`), mặc định ngôn ngữ trang hiện tại; định nghĩa ở `js/i18n.js`. */
export const contentMode = (locale = currentLocale()) => contentModeOf(locale);
/** Chữ cho ô chưa có dữ liệu (theo ngôn ngữ trang; hàm để build dựng cả hai ngôn ngữ trong một tiến trình). */
export const lookupEmpty = () => L("Đang cập nhật", "暂无数据", "情報更新中");
/**
 * Chữ Hán hiệu ứng là bản dịch từ tiếng Việt, chưa đối chiếu nguồn (`lookup.effectZhSource.kind`, xem
 * docs/unified-lookup.md). Chỉ `translation` mang cờ; `source`/`capture`/`null` thì không.
 */
export const isTranslatedZhEffect = (record) => record?.lookup?.effectZhSource?.kind === "translation";
/** Hàng catalog (quân sư, công trình, cải tạo, lựa chọn) có chữ Hán chính dịch từ tiếng Việt (`zhSource.kind`). */
export const isTranslatedZhText = (record) => record?.zhSource?.kind === "translation";
/** Câu cờ bản dịch (hồ sơ, thẻ liên quan, bảng nhóm zh); mỗi nơi tự dựng thẻ với `ZH_TRANSLATED_TAG_ATTRS`. */
export const zhTranslatedNote = (locale = currentLocale()) => pick(locale, "Hiệu ứng chữ Hán dịch từ tiếng Việt, chưa đối chiếu", "中文效果译自越南语，未经核对", "効果文の原文はベトナム語からの翻訳で、未照合です");
/** Câu cờ cho chữ Hán (tên/mô tả) của hàng catalog dịch từ tiếng Việt. */
export const zhTranslatedTextNote = (locale = currentLocale()) => pick(locale, "Chữ Hán dịch từ tiếng Việt, chưa đối chiếu", "中文译自越南语，未经核对", "原文はベトナム語からの翻訳で、未照合です");
export const ZH_TRANSLATED_TAG_ATTRS = Object.freeze({ class: "lookup-version-tag lookup-zh-translated", "data-zh-source": "translation" });
const labels = () => Object.fromEntries(Object.keys(LOOKUP_FIELD_LABELS).map((key) => [key, L(...LOOKUP_FIELD_LABELS[key])]));

/* ---------- Lớp tiếng Nhật (`data/lookup-ja.json`) ---------- */

/** Mục ja theo bản ghi: gắn bởi `bindLookupJa` khi dựng corpus có lớp ja (khóa theo đối tượng nên corpus không có ja không bị ảnh hưởng). */
const JA_ENTRIES = new WeakMap();
/**
 * Gắn mục `entries[id]` của `data/lookup-ja.json` vào từng bản ghi của `records` (theo `id`, không theo mặt chữ).
 * @param {Iterable<any>} records
 * @param {Record<string, any>} entries
 */
export function bindLookupJa(records, entries) {
  if (!entries || typeof entries !== "object") return;
  for (const record of records) {
    if (record && typeof record === "object" && typeof record.id === "string" && Object.hasOwn(entries, record.id)) JA_ENTRIES.set(record, entries[record.id]);
  }
}
/** Mục ja của bản ghi (`{name, nameStatus, nameOriginal, texts, translatedFromVi?}`), chưa gắn thì `null`. */
export const lookupJaEntry = (record) => (record && typeof record === "object" ? JA_ENTRIES.get(record) ?? null : null);
/** Bản dịch máy khóa `key` của bản ghi (bảng khóa ở docs/ja-lookup-data.md); khóa vắng → `null` (chưa có bản dịch). */
export function lookupJaText(record, key) {
  const value = lookupJaEntry(record)?.texts?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
/**
 * Chữ nguồn của một trường ở trang không phải bản Việt: bản zh trả chữ Hán `zh`; bản ja trả bản dịch máy khóa `key`
 * (chưa dịch → rỗng). Không có chữ Hán nguồn thì rỗng ở mọi bản. Bản Việt trả chữ Hán (nơi gọi không dùng tới).
 */
export function sourceTextOf(record, key, zh, locale = currentLocale()) {
  const raw = typeof zh === "string" ? zh.trim() : "";
  if (!raw || contentMode(locale) !== "ja") return raw;
  return lookupJaText(record, key) ?? "";
}
/** Trường có chữ Hán nguồn nhưng bản đang xem không hiện được (bản ja chưa có bản dịch khóa `key`). */
export const sourceTextMissing = (record, key, zh, locale = currentLocale()) => Boolean(String(zh ?? "").trim()) && !sourceTextOf(record, key, zh, locale);

const NAME_ORIGINAL_LANGS = new Set(["zh-Hans", "zh-Hant", "zh"]);
/** Nhãn trạng thái tên Nhật: `verified` (đã thấy trong nguồn Nhật) / `derived` (đổi tự dạng hoặc nguồn chưa chắc). */
const NAME_STATUS = Object.freeze({
  verified: { label: "確認済み", title: "日本語版の資料で確認した名称です" },
  derived: { label: "字形変換", title: "日本語版での表記は未確認です（中国語名を日本の字体に変換した名称）" },
});
/**
 * Tên gốc và trạng thái tên của trang ja (`{original, lang, status, label, title}`): trang chi tiết luôn hiện tên chữ Hán gốc
 * ("原名") cạnh tên Nhật. `lang` là `nameOriginalLang` của lớp ja (lối viết tính lúc build), vắng hay lạ thì `zh`. Bản khác hoặc
 * bản ghi chưa gắn lớp ja → `null`.
 */
export function lookupNameInfo(record, locale = currentLocale()) {
  if (contentMode(locale) !== "ja") return null;
  const entry = lookupJaEntry(record);
  const status = NAME_STATUS[entry?.nameStatus];
  if (!entry || !status || typeof entry.nameOriginal !== "string") return null;
  const lang = NAME_ORIGINAL_LANGS.has(entry.nameOriginalLang) ? entry.nameOriginalLang : "zh";
  return { original: entry.nameOriginal, lang, status: entry.nameStatus, label: status.label, title: status.title };
}
/** Nhãn "原名" (tên chữ Hán gốc) của trang ja. */
export const NAME_ORIGINAL_LABEL = "原名";
/** Hai nhãn của mô tả dịch máy ở trang ja: nhãn 機械翻訳 và dòng mốc số liệu. */
export const MACHINE_TRANSLATION_NOTICE = Object.freeze({ label: "機械翻訳", edition: "数値は中国大陸版に基づく" });
/** Câu báo hồ sơ bỏ phần chưa có chữ ở bản đang xem (bản zh: chưa có chữ Hán nguồn; bản ja: chưa có bản dịch). */
export const sourceMissingNote = (locale = currentLocale()) => pick(locale,
  "Một số mô tả chưa có ở bản này nên không hiển thị.",
  "部分说明暂无中文原文，未在此显示。",
  "一部の説明は日本語訳がないため、ここには表示していません。");

/** Khóa có giá trị là số/hạng chữ cái (chỉ số, tăng trưởng, thích tính) — hiện được ở bản zh. */
const LANGUAGE_NEUTRAL_KEYS = new Set(["luc", "tri", "thong", "toc", "chinh", "mi", "ky", "thuan", "cung", "thuong", "khiGioi", "infantry", "navy"]);
/**
 * Bộ giá trị đóng của dữ liệu (tiếng Việt) → `[chữ Trung, chữ Nhật]`: một bảng theo cột locale (thứ tự cột = `SITE_LOCALES`
 * bỏ bản Việt), tra bằng `pick(locale, giá trị Việt, zh, ja)`.
 */
const CLOSED_VALUES = {
  "Ngụy": ["魏", "魏"], "Thục": ["蜀", "蜀"], "Ngô": ["吴", "呉"], "Quần": ["群", "群"], "Hán": ["汉", "漢"],
  "Quân sự": ["军事", "軍事"], "Nội chính": ["内政", "内政"],
  "Vũ khí": ["武器", "武器"], "Phòng cụ": ["防具", "防具"], "Tọa kỵ": ["坐骑", "坐騎"], "Bảo vật": ["宝物", "宝物"],
  "Cam": ["橙", "橙"], "Tím": ["紫", "紫"],
  "Hỏa": ["火", "火"], "Phong": ["风", "風"], "Lâm": ["林", "林"], "Sơn": ["山", "山"],
  "Tăng ích": ["增益", "強化"], "Giảm ích": ["减益", "弱体"], "Khống chế": ["控制", "制御"], "Trị liệu": ["治疗", "回復"], "Viện hộ": ["援护", "援護"],
  "Sát thương binh khí quần thể": ["群体兵刃伤害", "群体兵刃ダメージ"], "Sát thương binh khí đơn thể": ["单体兵刃伤害", "単体兵刃ダメージ"],
  "Mưu lược quần thể": ["群体谋略伤害", "群体計略ダメージ"], "Mưu lược đơn thể": ["单体谋略伤害", "単体計略ダメージ"],
  // Dạng hiệu ứng chiến pháp theo client (Thượng Thư Đài).
  "Mưu Lược đơn": ["单体谋略伤害", "単体計略ダメージ"], "Mưu Lược nhóm": ["群体谋略伤害", "群体計略ダメージ"], "Binh đao đơn": ["单体兵刃伤害", "単体兵刃ダメージ"], "Binh đao nhóm": ["群体兵刃伤害", "群体兵刃ダメージ"],
  "Cứu Viện": ["援护", "援護"], "Bất lợi + mưu lược quần thể": ["减益 + 群体谋略伤害", "弱体 + 群体計略ダメージ"],
  // Mục tiêu chiến pháp chỉ có chữ Việt client (chữ Hán nguồn, khi có, dùng `target`).
  "Tôi": ["自身", "自身"], "Một quân địch": ["敌军单体", "敵軍単体"], "Một quân ta": ["我军单体", "自軍単体"], "Một quân Đồng Minh": ["友军单体", "友軍単体"],
  "Tập thể địch (1-2 người)": ["敌军群体（1-2人）", "敵軍群体（1-2人）"], "Tập thể địch (2 người)": ["敌军群体（2人）", "敵軍群体（2人）"], "Tập thể địch (3 người)": ["敌军群体（3人）", "敵軍群体（3人）"],
  "Tập thể quân ta (2 người)": ["我军群体（2人）", "自軍群体（2人）"], "Tập thể quân ta (2-3 người)": ["我军群体（2-3人）", "自軍群体（2-3人）"], "Tập thể quân ta (3 người)": ["我军群体（3人）", "自軍群体（3人）"],
  "Nhóm tướng Đồng Minh (2 người)": ["友军群体（2人）", "友軍群体（2人）"], "Toàn thể hai bên": ["敌我全体", "敵味方全体"],
  // Trạng thái trong ô Xung đột (so khớp không phân biệt hoa thường, nhãn ghép " / " dịch từng phần).
  "Không": ["无", "なし"], "Chấn nhiếp": ["震慑", "威圧"], "Cấm trị liệu": ["禁疗", "禁療"], "Cấp cứu": ["急救", "急救"], "Hỗn loạn": ["混乱", "混乱"], "Khiêu khích": ["挑衅", "挑発"],
  "Kháng cự": ["抵御", "抵御"], "Kế cùng": ["计穷", "計窮"], "Cạn kế": ["计穷", "計窮"], "Kiệt kế": ["计穷", "計窮"], "Kỹ cùng": ["技穷", "技窮"], "Liên kích": ["连击", "連撃"], "Động sát": ["洞察", "洞察"],
  "Né tránh": ["规避", "回避"], "Nghỉ dưỡng": ["休整", "休整"], "Hưu chỉnh": ["休整", "休整"], "Hưu dưỡng": ["休整", "休整"], "Phá trận": ["破阵", "破陣"], "Phản loạn": ["叛逃", "離反"],
  "Phản kích": ["反击", "反撃"], "Chia sẻ": ["分担", "分担"], "Chia sẻ sát thương": ["分担伤害", "ダメージ分担"], "Gánh thay": ["分担", "分担"], "Suy nhược": ["虚弱", "虚弱"], "Suy yếu": ["虚弱", "虚弱"],
  "Tan tác": ["溃逃", "潰走"], "Hội tẩu": ["溃走", "潰走"], "Thiêu đốt": ["灼烧", "灼焼"], "Trúng độc": ["中毒", "中毒"], "Bão cát": ["沙暴", "砂嵐"], "Thủy công": ["水攻", "水攻"],
  "Thiết tỏa liên hoàn": ["铁索连环", "鉄鎖連環"], "Tiên công": ["先攻", "先攻"], "Tất trúng": ["必中", "必中"], "Tước vũ khí": ["缴械", "武装解除"], "Phá hoại": ["破坏", "破壊"],
  "Miễn nhiễm": ["免疫", "免疫"], "Cảnh giới": ["警戒", "警戒"], "Hồi phục binh lực": ["恢复兵力", "兵力回復"], "Chống đỡ": ["抵挡", "防御"], "Ngụy báo": ["伪报", "偽報"], "Bị tập kích": ["遇袭", "被襲撃"],
  // Đối chiếu ô "效果衝突" của SGSDeck cùng chiến pháp (白衣渡江, 陷陣突襲, 鐵騎驅馳, 暗箭難防, 威武並昭).
  "Phòng ngự": ["抵御", "抵御"], "Cùng truy": ["穷追", "窮追"], "Tập kích": ["遇袭", "被襲撃"], "Bắt giữ": ["捕获", "捕獲"], "Nhìn thấu": ["看破", "看破"],
  // Binh chủng và mùa.
  "Khiên binh": ["盾兵", "盾兵"], "Cung binh": ["弓兵", "弓兵"], "Thương binh": ["枪兵", "槍兵"], "Kỵ binh": ["骑兵", "騎兵"], "Khí giới": ["器械", "器械"],
  "Binh Diễn Xuân Thu": ["兵演春秋", "兵演春秋"],
  // Cấp lựa chọn cải tạo (client và nguồn).
  "Đặc biệt": ["特殊", "特殊"], "Cơ bản": ["基础", "基礎"], "Sơ cấp": ["初级", "初級"], "Trung cấp": ["中级", "中級"], "Cao cấp": ["高级", "上級"],
};
/**
 * Kỳ lược (bảng nhãn của hợp đồng catalog): loại thẻ và độ hiếm là mã (`type`, `rarity`), đối tượng là chữ client
 * (`targetVi`, đúng năm giá trị; bộ giá trị hợp lệ do js/lookup-data.js kiểm). Chữ Hán theo tên trong game (phồn thể) nên tách khỏi `ZH_VALUES`: "Một quân ta" /
 * "Một quân địch" ở đó là nhãn mục tiêu chiến pháp (giản thể) và không được đổi.
 */
const QILUE_LABELS = Object.freeze({
  type: { dung: ["Dũng", "勇"], muu: ["Mưu", "謀"], phu: ["Phụ", "輔"], sach: ["Sách", "策"], te: ["Tế", "濟"] },
  rarity: { common: ["Thường", "普通"], rare: ["Hiếm", "稀有"] },
  target: {
    "Toàn quân ta": ["Toàn quân ta", "我軍全體"], "Một quân ta": ["Một quân ta", "我軍單體"], "Nhóm quân ta": ["Nhóm quân ta", "我軍群體"],
    "Một quân địch": ["Một quân địch", "敵軍單體"], "Toàn quân địch": ["Toàn quân địch", "敵軍全體"],
  },
});
/** Nhãn kỳ lược theo ngôn ngữ (`kind`: `type` | `rarity` | `target`); giá trị ngoài bảng trả `null` (không hiện). */
export function qilueLabel(kind, value, locale = currentLocale()) {
  const pair = Object.hasOwn(QILUE_LABELS, kind) && Object.hasOwn(QILUE_LABELS[kind], value) ? QILUE_LABELS[kind][value] : null;
  return pair ? pick(locale, ...pair) : null;
}
/** Mã loại thẻ theo thứ tự hiển thị (Dũng → Mưu → Phụ → Sách → Tế). */
export const QILUE_TYPE_ORDER = Object.freeze(Object.keys(QILUE_LABELS.type));
/** Khóa so khớp không phân biệt hoa thường của bộ giá trị đóng (dữ liệu client viết "Phá Trận" lẫn "Phá trận"). */
const CLOSED_VALUES_FOLDED = new Map(Object.entries(CLOSED_VALUES).map(([vi, row]) => [vi.toLocaleLowerCase("vi"), row]));
/** Dịch một giá trị đóng sang ngôn ngữ `locale` (không phải bản Việt); không có trong bảng → `null`. */
function closedValue(value, locale = currentLocale()) {
  const row = CLOSED_VALUES[value] ?? CLOSED_VALUES_FOLDED.get(String(value).trim().toLocaleLowerCase("vi"));
  if (!row) return null;
  const [zh, ja] = row;
  return pick(locale, value, zh, ja);
}
/**
 * Giá trị hiển thị của bản không phải tiếng Việt: số và hạng giữ nguyên, giá trị trong bộ đóng được dịch (không phân biệt
 * hoa thường; nhãn ghép "A / B" và danh sách dịch được khi mọi phần đều dịch được), còn lại `null` (bị bỏ). Bản Việt luôn
 * trả chữ gốc. `locale` mặc định là ngôn ngữ trang (build truyền tường minh).
 */
export function zhSafeValue(value, locale = currentLocale()) {
  if (contentLocaleIsVietnamese(locale)) return value;
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    const parts = value.map((item) => zhSafeValue(item, locale));
    return parts.length && parts.every((part) => part !== null) ? parts.join("、") : null;
  }
  if (typeof value === "number" || /^[\d.,%+\-/ ~]+$/u.test(String(value)) || /^(?:[SABCD]|T\d|SP|CO|40Y)$/u.test(String(value))) return String(value);
  const whole = closedValue(value, locale);
  if (whole !== null || !String(value).includes(" / ")) return whole;
  const parts = String(value).split(" / ").map((part) => closedValue(part, locale));
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
 * Chữ nguồn của trường `jaKey` cho hồ sơ đang dựng: bản zh trả nguyên chữ Hán `zh`; bản ja trả bản dịch máy (bật
 * `profile.machineTranslated`), chưa dịch thì rỗng và ghi khóa vào `profile.untranslated`. Bản Việt trả `zh` (không dùng tới).
 */
function sourceFor(profile, record, jaKey, zh) {
  if (contentMode() !== "ja") return zh;
  const raw = typeof zh === "string" ? zh.trim() : "";
  if (!raw) return zh;
  const translated = lookupJaText(record, jaKey);
  if (translated) {
    profile.machineTranslated = true;
    return translated;
  }
  if (!profile.untranslated.includes(jaKey)) profile.untranslated.push(jaKey);
  return "";
}
/**
 * Trường có giá trị là chữ tiếng Việt: bản Việt đẩy như cũ; bản khác chỉ đẩy khi `zhSafeValue` dịch được
 * (hoặc có chữ nguồn `raw` của bản đó), không thì bỏ và đánh dấu hồ sơ còn nội dung chưa hiện được.
 */
function pushLocalized(profile, key, value, labelVi, render = text(value), raw = null) {
  if (!sourceText()) return pushField(profile, key, value, labelVi, render);
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
/** Điều kiện/lịch sử chỉ có bản Việt: bản không phải tiếng Việt bỏ và đánh dấu. */
function viOnlyList(profile, rows) {
  if (!sourceText()) return rows;
  if (rows.length) profile.viOnly = true;
  return [];
}
/** Điều kiện: bản khác hiện khi mọi dòng thuộc bộ giá trị đóng (vd mùa "Binh Diễn Xuân Thu"), không thì bỏ và đánh dấu. */
function localizedConditions(profile, rows) {
  if (!sourceText()) return rows;
  const shown = rows.map((row) => zhSafeValue(row));
  if (shown.every((row) => row !== null)) return shown;
  profile.viOnly = true;
  return [];
}
const conditions = (rows) => (Array.isArray(rows) ? rows.map((row) => typeof row === "string" ? row : row?.textVi).filter(Boolean) : []);
/**
 * Điều kiện của tướng: dòng có `textZh` (ghi chú mùa, chữ Hán dịch từ tiếng Việt) hiện ở bản zh (bản ja: bản dịch máy khóa
 * `conditions.N`, N là vị trí trong dữ liệu) và bật `conditionsZhTranslated` để giao diện gắn cờ "dịch, chưa đối chiếu";
 * dòng khác theo bộ giá trị đóng như `localizedConditions`.
 */
function heroConditions(profile, record, rows) {
  const list = (Array.isArray(rows) ? rows : []).map((row, index) => ({ row, index })).filter(({ row }) => typeof row?.textVi === "string" && row.textVi);
  if (!sourceText()) return list.map(({ row }) => row.textVi);
  const shown = [];
  for (const { row, index } of list) {
    const translated = typeof row.textZh === "string" && row.textZh ? sourceFor(profile, record, `conditions.${index}`, row.textZh) || null : null;
    const value = translated ?? (typeof row.textZh === "string" && row.textZh ? null : zhSafeValue(row.textVi));
    if (value === null) profile.viOnly = true;
    else shown.push(value);
    if (translated) profile.conditionsZhTranslated = true;
  }
  return shown;
}
const unresolved = (key, labelVi) => ({ key, labelVi, resolved: false, targetId: null, targetGroup: null, titleVi: null, statusVi: L("Liên kết đang được cập nhật", "关联条目更新中", "関連項目を更新中") });
const listText = (values, empty = lookupEmpty()) => Array.isArray(values) && values.length ? values.join(", ") : empty;
const variantLabels = () => ({ base: L("Thường", "普通", "通常"), sp: "SP", co: "CO", "40y": "40Y" });
/** Loại chiến pháp trong dữ liệu là enum tiếng Anh/đã Việt hoá; UI chỉ hiện nhãn đã dịch (bộ vi/zh/ja). */
const TYPE_LABELS = {
  ACTIVE: ["Chủ động", "主动", "アクティブ"], PASSIVE: ["Bị động", "被动", "パッシブ"], COMMAND: ["Chỉ huy", "指挥", "指揮"], INTERNAL: ["Nội chính", "内政", "内政"],
  FORMATION: ["Trận pháp", "阵法", "陣法"], TROOP: ["Binh chủng", "兵种", "兵種"], BURST: ["Bùng nổ", "突击", "突撃"],
};
/** Vài bản ghi lưu loại đã Việt hoá: bản khác đổi về cùng nhãn với enum. */
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

/**
 * Từ mở đầu nhãn phiên bản: bản Việt, chữ Hán nguồn mà bản zh hiển thị ("2021-06-09 更新（平衡）", "原始版本") và bản dịch máy
 * của bản ja ("2021-06-09 更新（バランス調整）", "初期版").
 */
const VERSION_WORD = "(?:Cập nhật|Phiên bản gốc|\\d{4}-\\d{2}-\\d{2}\\s*更新|原始版本|初期版)";
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
 * bị bỏ (kèm cảnh báo dev) để UI không bao giờ in enum; giá trị khác trả nguyên văn (bản khác: bỏ).
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
  if (!contentLocaleIsVietnamese(locale)) {
    const enumKey = VI_TYPE_TO_ENUM[text];
    return enumKey ? pick(locale, ...TYPE_LABELS[enumKey]) : null;
  }
  return text;
}
const flagLabels = () => ({
  isCollectible: L("Sưu tầm", "典藏", "典蔵"), isDynamicOpen: L("Mở động", "动态开放", "動態開放"), isMusou: L("Vô Song", "无双", "無双"), isCO: "CO", isSp: "SP",
});

/**
 * Tên hiển thị của một mục tra cứu: bản Việt dùng tên Việt; bản zh dùng tên chữ Hán nguồn (`chinese` của tướng/chiến pháp,
 * `aliasesZh` của catalog), rồi tên dịch `nameZh` của catalog, thiếu thì lùi về tên Việt; bản ja dùng tên Nhật của lớp ja
 * (`data/lookup-ja.json`, theo ID), bản ghi chưa gắn lớp ja thì lùi như bản zh.
 */
export function lookupDisplayName(record, nameVi, locale = currentLocale()) {
  const source = chineseDisplayName(record) ?? nameVi;
  return pick(locale, nameVi, source, lookupJaEntry(record)?.name ?? source);
}

/** Tên chữ Hán của một mục tra cứu: `chinese` nguồn, rồi `aliasesZh` có chữ Hán, rồi tên dịch `nameZh`; không có → `null`. */
function chineseDisplayName(record) {
  if (typeof record?.chinese === "string" && record.chinese.trim()) return record.chinese.trim();
  for (const value of record?.aliasesZh ?? []) if (typeof value === "string" && /[㐀-鿿]/u.test(value)) return value;
  if (typeof record?.nameZh === "string" && record.nameZh.trim()) return record.nameZh.trim();
  return null;
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

/**
 * Khung hồ sơ chung. Bản ja thêm `name` (`lookupNameInfo`: tên gốc chữ Hán + trạng thái tên); `machineTranslated` bật khi
 * hồ sơ hiện ít nhất một bản dịch máy, `untranslated` liệt kê khóa có chữ Hán nguồn mà chưa có bản dịch Nhật.
 */
function base(entry) {
  return {
    id: entry.id, group: entry.group, titleVi: entryTitle(entry), fields: [], aptitudes: [], sections: [], relations: [], children: [], conditions: [], revisions: [],
    viOnly: false, zhTranslated: false, conditionsZhTranslated: false,
    name: lookupNameInfo(entry.record), machineTranslated: false, untranslated: [],
  };
}

/** Bản ghi võ tướng (có `chinese`) theo tên Việt hiển thị trong dữ liệu (tên chính, Hán-Việt, bí danh không có chữ Hán). */
const HERO_BY_VI_NAME = new WeakMap();
function heroByViName(corpus, name) {
  if (!corpus?.byId) return null;
  let index = HERO_BY_VI_NAME.get(corpus);
  if (!index) {
    index = new Map();
    for (const entry of corpus.byId.values()) {
      const record = entry?.record;
      if (entry?.group !== "heroes" || typeof record?.chinese !== "string" || !record.chinese.trim()) continue;
      for (const value of [entry.nameVi, record.viet, record.hanViet, ...(record.aliases ?? [])]) {
        if (typeof value === "string" && value.trim() && !/[㐀-鿿]/u.test(value) && !index.has(value.trim())) index.set(value.trim(), record);
      }
    }
    HERO_BY_VI_NAME.set(corpus, index);
  }
  return index.get(String(name ?? "").trim()) ?? null;
}
/** Tên võ tướng theo tên Việt cho bản đang xem: bản zh là chữ Hán nguồn, bản ja là tên Nhật (chưa gắn lớp ja → `null`). */
function heroSourceName(corpus, name) {
  const record = heroByViName(corpus, name);
  if (!record) return null;
  return contentMode() === "ja" ? lookupJaEntry(record)?.name ?? null : record.chinese.trim();
}

const CJK = /[㐀-鿿]/u;

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
 * khác cùng tên (khóa bằng tên trong "Sự kiện X — …" lẫn mục `acquiredFromVi` duy nhất), rồi `EVENT_ZH`. Bản ja không có
 * tên sự kiện tiếng Nhật đã đối chiếu nên trả `null` (ô ghép từ tên sự kiện bị bỏ và đánh dấu thiếu).
 */
const EVENT_ZH_BY_NAME = new WeakMap();
function eventChinese(corpus, row, name) {
  if (contentMode() === "ja") return null;
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

/** Mẫu câu của các ô ghép (cách nhận, điều kiện đổi) theo ngôn ngữ trang không phải bản Việt. */
const composed = {
  grade: (grade) => L(` (cấp ${grade})`, `（${grade}级）`, `（${grade}級）`),
  heroList: (names) => names.join(L(", ", "、", "、")),
  factionTier: (faction, stars, cards) => L(`tướng ${stars} sao phe ${faction}: cần ${cards} thẻ`, `${faction}阵营 ${stars} 星武将需 ${cards} 张`, `${faction}陣営の星${stars}武将：${cards}枚`),
  heroFaction: (name, faction) => L(`${name} (${faction})`, `${name}（${faction}）`, `${name}（${faction}）`),
  alternatives: (heroes, cards) => L(`${heroes.join(" hoặc ")}: cần ${cards} thẻ`, `${heroes.join("或")}需 ${cards} 张`, `${heroes.join("または")}：${cards}枚`),
  anyOf: (names, cards) => L(`${names.join(" / ")} (chọn ${cards} thẻ bất kỳ)`, `${names.join("、")}（任选 ${cards} 张）`, `${names.join("、")}（任意の${cards}枚）`),
  heroCards: (hero, cards) => L(`${hero} (cần ${cards} thẻ)`, `${hero}需 ${cards} 张`, `${hero}：${cards}枚`),
  cardList: (cells) => cells.join(L(", ", "；", "；")),
  event: (event, body) => L(`Sự kiện ${event} — ${body}`, `${event}事件：${body}`, `イベント「${event}」：${body}`),
};

/** Một mục "Cách nhận" dạng tên võ tướng: "A & SP A" / "A, B", hậu tố "(cấp B)" theo ngôn ngữ; tên không tra được thì `null`. */
function acquiredItemSource(corpus, item) {
  const grade = /^(.+?)\s*\(cấp ([A-Z])\)$/u.exec(item);
  const names = (grade ? grade[1] : item).split(/ & |, /u).map((name) => heroSourceName(corpus, name));
  return names.every(Boolean) ? `${composed.heroList(names)}${grade ? composed.grade(grade[2]) : ""}` : null;
}

/**
 * Cách nhận (bản không phải tiếng Việt): bản zh dùng chữ Hán nguồn `sourceHeroCn` khi có; còn lại ghép tên võ tướng/sự kiện
 * theo ngôn ngữ trang (mọi mục phải tra được).
 */
function acquiredFromSource(corpus, row) {
  if (contentMode() !== "ja" && typeof row.sourceHeroCn === "string" && CJK.test(row.sourceHeroCn)) return row.sourceHeroCn.trim();
  const items = (row.lookup?.acquiredFromVi ?? []).map((item) => (row.source === "EVENT" ? eventChinese(corpus, row, item) : null) ?? acquiredItemSource(corpus, item));
  return items.length && items.every(Boolean) ? composed.heroList(items) : null;
}

/** Một ô đổi thẻ: "A (Thục) hoặc B (Ngô): cần 1 thẻ" hoặc "tướng 5 sao phe Quần: cần 3 thẻ"; dạng khác/tên lạ thì `null`. */
function exchangeCellSource(corpus, cell) {
  const tier = /^tướng (\d) sao phe (Ngụy|Thục|Ngô|Quần|Hán): cần (\d+) thẻ$/u.exec(cell);
  if (tier) return composed.factionTier(closedValue(tier[2]), tier[1], tier[3]);
  const match = /^(.+): cần (\d+) thẻ$/u.exec(cell);
  if (!match) return null;
  const heroes = match[1].split(" hoặc ").map((part) => {
    const hero = /^(.+?) \((Ngụy|Thục|Ngô|Quần|Hán)\)$/u.exec(part);
    const name = hero ? heroSourceName(corpus, hero[1]) : null;
    return name ? composed.heroFaction(name, closedValue(hero[2])) : null;
  });
  return heroes.every(Boolean) ? composed.alternatives(heroes, match[2]) : null;
}

/**
 * Điều kiện đổi không theo mẫu "Sự kiện X — …": "A / B / C (chọn 4 thẻ bất kỳ)" hoặc "A (cần 1 thẻ), B (cần 1 thẻ)";
 * dạng khác hoặc tên không tra được thì `null`.
 */
function heroCardsSource(corpus, text) {
  const any = /^(.+) \(chọn (\d+) thẻ bất kỳ\)$/u.exec(text);
  if (any) {
    const names = any[1].split(" / ").map((name) => heroSourceName(corpus, name));
    return names.every(Boolean) ? composed.anyOf(names, any[2]) : null;
  }
  const cells = text.split(", ").map((cell) => {
    const match = /^(.+?) \(cần (\d+) thẻ\)$/u.exec(cell);
    const hero = match ? heroSourceName(corpus, match[1]) : null;
    return hero ? composed.heroCards(hero, match[2]) : null;
  });
  return cells.every(Boolean) ? composed.cardList(cells) : null;
}

/**
 * Điều kiện đổi chiến pháp (bản không phải tiếng Việt): "Sự kiện X — A (Thục): cần 1 thẻ; …" ghép từ tên sự kiện
 * (`eventChinese`) và từng ô đổi thẻ; dạng chỉ có danh sách thẻ (`heroCardsSource`) thêm tên sự kiện nguồn khi chiến pháp là
 * chiến pháp sự kiện.
 */
function exchangeConditionSource(corpus, row) {
  const text = String(row.lookup?.exchangeConditionVi ?? "");
  const match = /^Sự kiện (.+?) — (.+)$/u.exec(text);
  if (!match) {
    const cards = text ? heroCardsSource(corpus, text) : null;
    const event = cards && row.source === "EVENT" ? eventChinese(corpus, row, row.lookup?.acquiredFromVi?.[0]) : null;
    return cards && event ? composed.event(event, cards) : cards;
  }
  const event = eventChinese(corpus, row, match[1]);
  if (!event) return null;
  const parts = match[2].split("; ").map((cell) => exchangeCellSource(corpus, cell));
  return parts.every(Boolean) ? composed.event(event, composed.cardList(parts)) : null;
}

const percentText = (rate) => `${Number((rate * 100).toFixed(1))}%`;
/** Một dòng "Cách nhận": loại gói · tên gói, tướng có phải tướng lõi không và tỉ lệ ra tướng lõi/thường của cả gói. */
function cardPackField(profile, record, pack, index) {
  const category = sourceFor(profile, record, `cardPacks.${index}.category`, pack.categoryZh);
  const name = sourceFor(profile, record, `cardPacks.${index}.pack`, pack.packZh);
  const labelVi = sourceText() ? [category, name].filter(Boolean).join(" · ") : `${pack.categoryVi} · ${pack.packVi}`;
  if (!labelVi) {
    profile.viOnly = true;
    return null;
  }
  const tier = pack.isCore ? L("Tướng lõi", "核心", "コア") : L("Thường", "非核心", "非コア");
  const rates = `${L("lõi", "核心", "コア")} ${percentText(pack.coreRate)} / ${L("thường", "非核心", "非コア")} ${percentText(pack.nonCoreRate)}`;
  return field(`cardPack${index}`, pack.isCore, labelVi, `${tier} · ${rates}`);
}

function heroProfile(corpus, entry) {
  const row = entry.record;
  const lookup = row.lookup ?? {};
  const profile = base(entry);
  optionalField(profile, "variant", lookup.variant, L("Biến thể", "版本", "種類"), variantLabels()[lookup.variant] ?? text(lookup.variant));
  optionalLocalized(profile, "faction", row.faction, L("Phe", "阵营", "陣営"));
  optionalField(profile, "stars", row.stars, L("Sao", "星级", "星"));
  optionalField(profile, "cost", row.cost, L("Thống ngự", "统御", "コスト"));
  // Vai trò và danh hiệu: bản zh hiện chữ Hán nguồn (`roleTag`, `exclusiveTitleZh`), bản ja hiện bản dịch máy của chúng.
  if (row.roleTagViet) pushLocalized(profile, "roleTagViet", row.roleTagViet, L("Vai trò", "定位", "役割"), text(row.roleTagViet), sourceFor(profile, row, "roleTag", row.roleTag));
  optionalLocalized(profile, "categoryVi", lookup.categoryVi, L("Phân loại", "类别", "分類"));
  if (lookup.exclusiveTitleVi) pushLocalized(profile, "exclusiveTitleVi", lookup.exclusiveTitleVi, L("Danh hiệu độc quyền", "专属称号", "専用称号"), text(lookup.exclusiveTitleVi), sourceFor(profile, row, "exclusiveTitle", lookup.exclusiveTitleZh));
  optionalField(profile, "civilInnatePoints", lookup.civilInnatePoints, L("Điểm nội chính", "内政点数", "内政ポイント"));
  for (const [key, value, label] of [
    ["collectibleBonusVi", lookup.collectibleBonusVi, L("Thưởng sưu tầm", "典藏加成", "典蔵ボーナス")],
    ["redRulesVi", lookup.redRulesVi, L("Quy tắc điểm đỏ", "红度规则", "紅度ルール")],
  ]) optionalLocalized(profile, key, value, label);
  const enabledFlags = Object.entries(lookup.flags ?? {}).filter(([, enabled]) => enabled === true).map(([key]) => flagLabels()[key] ?? key);
  if (enabledFlags.length) pushField(profile, "flags", enabledFlags, L("Đặc tính", "特性", "特性"), enabledFlags.join(" · "));
  // Đánh giá giữ/rã thẻ: bản zh hiện chữ Hán nguồn `usageZh`.
  if (lookup.usageVi) pushLocalized(profile, "usage", lookup.usageVi, L("Đánh giá", "评价", "評価"), lookup.usageVi, sourceFor(profile, row, "usage", lookup.usageZh));
  for (const key of ["luc", "tri", "thong", "toc", "chinh", "mi"]) pushField(profile, key, row.stats?.[key]);
  profile.aptitudes = [
    ...["ky", "thuan", "cung", "thuong", "khiGioi"].map((key) => field(key, row.troopApt?.[key])),
    ...["infantry", "navy"].map((key) => field(key, lookup.otherAptitudes?.[key])),
  ].filter(Boolean);
  const growth = Object.entries(lookup.growth ?? {}).map(([key, value]) => field(key, value)).filter(Boolean);
  profile.sections.push({ key: "growth", titleVi: L("Tăng trưởng", "成长", "成長"), fields: growth });
  if (lookup.cardPacks?.length) {
    profile.sections.push({ key: "cardPacks", titleVi: L("Cách nhận", "获取途径", "入手方法"), fields: lookup.cardPacks.map((pack, index) => cardPackField(profile, row, pack, index)).filter(Boolean) });
  }
  const selfId = heroSelfTacticId(row, corpus.tactics);
  const inheritId = lookup.inheritTacticId ?? uniqueTacticIdByChinese(corpus.tactics, row.inheritTacticCn);
  profile.relations.push(relation(corpus, "selfTactic", L("Chiến pháp bản thân", "自带战法", "固有戦法"), selfId, "tactics"));
  if (lookup.inheritTacticId || row.inheritTacticCn) profile.relations.push(relation(corpus, "inheritTactic", L("Chiến pháp truyền thừa", "传承战法", "伝承戦法"), inheritId, "tactics"));
  if (lookup.advisorId) profile.relations.push(relation(corpus, "advisor", L("Kỹ năng quân sư", "军师技", "軍師技"), lookup.advisorId, "advisors"));
  profile.conditions = heroConditions(profile, row, lookup.conditions);
  profile.revisions = viOnlyList(profile, lookup.revisions ?? []);
  return profile;
}

function tacticProfile(corpus, entry) {
  const row = entry.record;
  const lookup = row.lookup ?? {};
  const profile = base(entry);
  // Hiệu ứng và mục tiêu có chữ Hán nguồn (`effect`, `target`): bản zh hiện nguyên văn, bản ja hiện bản dịch máy.
  pushLocalized(profile, "effect", row.effectViet, L("Hiệu ứng", "效果", "効果"), text(row.effectViet), sourceFor(profile, row, "effect", row.effect));
  pushLocalized(profile, "target", row.targetViet, L("Mục tiêu", "目标", "対象"), text(row.targetViet), sourceFor(profile, row, "target", row.target));
  const rate = lookup.activationRate;
  pushField(profile, "activationRate", rate, L("Tỷ lệ kích hoạt", "发动率", "発動確率"), ratePercentText(rate));
  for (const [key, label] of [["type", L("Loại", "类型", "種類")], ["quality", L("Phẩm chất", "品质", "品質")], ["effectTypeVi", L("Dạng hiệu ứng", "效果类型", "効果タイプ")], ["exchangeConditionVi", L("Điều kiện đổi", "兑换条件", "交換条件")]]) {
    const value = key in row ? row[key] : lookup[key];
    if (value === undefined || value === "") continue;
    if (key === "type") {
      const typeVi = tacticTypeLabel(value);
      if (!typeVi) continue;
      pushField(profile, key, value, label, typeVi);
      continue;
    }
    pushLocalized(profile, key, value, label, text(value), key === "exchangeConditionVi" ? exchangeConditionSource(corpus, row) : null);
  }
  for (const [key, label] of [["cooldown", L("Hồi chiêu", "冷却", "クールタイム")], ["maxUsers", L("Số người dùng tối đa", "最多携带人数", "最大装備人数")], ["pointCost", L("Điểm chiến pháp", "战法点", "戦法ポイント")]]) {
    optionalLocalized(profile, key, lookup[key], label);
  }
  if (lookup.acquiredFromVi?.length) pushLocalized(profile, "acquiredFromVi", lookup.acquiredFromVi, L("Cách nhận", "获取方式", "入手方法"), listText(lookup.acquiredFromVi), acquiredFromSource(corpus, row));
  optionalLocalized(profile, "conflictsVi", lookup.conflictsVi, L("Xung đột", "冲突", "競合"));
  for (const id of lookup.inheritedFromIds ?? []) profile.relations.push(relation(corpus, `inheritedFrom:${id}`, L("Truyền thừa từ", "传承自", "伝承元"), id, "heroes"));
  for (const id of innateHolders(corpus).get(row.id) ?? []) profile.relations.push(relation(corpus, `innateHolder:${id}`, L("Chiến pháp tự có của", "自带武将", "固有武将"), id, "heroes"));
  profile.conditions = localizedConditions(profile, conditions(lookup.conditions));
  profile.revisions = viOnlyList(profile, lookup.revisions.map((item) => ({ ...item })));
  return profile;
}

function equipmentProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "slot", row.slotVi, L("Vị trí", "部位", "部位"));
  pushLocalized(profile, "quality", row.qualityVi, L("Phẩm chất", "品质", "品質"));
  const items = corpus.catalog.specials.filter((item) => item.equipmentId === row.id).map((item) => ({ id: item.id, titleVi: lookupDisplayName(item, item.nameVi) }));
  profile.children.push({ key: "specials", titleVi: L("Đặc kỹ", "特技", "特技"), items });
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

function specialProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "description", row.descriptionVi, L("Mô tả", "描述", "説明"));
  pushLocalized(profile, "tier", row.tierVi, L("Bậc", "等级", "段階"));
  pushLocalized(profile, "slot", row.slotVi, L("Vị trí", "部位", "部位"));
  pushLocalized(profile, "acquisitionVi", row.acquisitionVi, L("Cách nhận", "获取方式", "入手方法"), listText(row.acquisitionVi));
  profile.relations.push(relation(corpus, "equipment", L("Trang bị", "装备", "装備"), row.equipmentId, "equipment"));
  if (row.exclusiveHeroId) profile.relations.push(relation(corpus, "exclusiveHero", L("Tướng độc quyền", "专属武将", "専用武将"), row.exclusiveHeroId, "heroes"));
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

function advisorProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "elementVi", row.elementVi, L("Nguyên tố", "属性", "属性"));
  pushLocalized(profile, "effect", row.effectVi, L("Hiệu ứng", "效果", "効果"), text(row.effectVi), sourceFor(profile, row, "effect", row.effectZh));
  pushLocalized(profile, "usage", row.usageVi, L("Cách dùng", "用法", "使い方"), text(row.usageVi), sourceFor(profile, row, "usage", row.usageZh));
  profile.zhTranslated = sourceText() && isTranslatedZhText(row);
  pushField(profile, "tacticPoints", row.tacticPoints, L("Điểm chiến pháp", "战法点", "戦法ポイント"));

  profile.children.push({ key: "heroes", titleVi: L("Tướng", "武将", "武将"), items: row.heroIds.map((id) => corpus.byId.get(id)).filter(Boolean).map((item) => ({ id: item.id, titleVi: entryTitle(item) })) });
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

function troopProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "effect", row.effectVi, L("Hiệu ứng", "效果", "効果"), text(row.effectVi), sourceFor(profile, row, "effect", row.effectZh));
  pushLocalized(profile, "appliesTo", row.appliesToVi, L("Áp dụng", "适用", "適用"), text(row.appliesToVi), sourceFor(profile, row, "appliesTo", row.appliesToZh));
  pushLocalized(profile, "suggestedBuild", row.suggestedBuildVi, L("Gợi ý", "推荐", "おすすめ"), text(row.suggestedBuildVi), sourceFor(profile, row, "suggestedBuild", row.suggestedBuildZh));
  pushLocalized(profile, "troopLimitVi", row.troopLimitVi, L("Giới hạn binh chủng", "兵种限制", "兵種制限"), listText(row.troopLimitVi, L("Không giới hạn", "无限制", "制限なし")));

  // Bản không phải tiếng Việt hiện lựa chọn có chữ Hán (nguồn hoặc bản dịch); lựa chọn chỉ có chữ Việt bị bỏ và hồ sơ được đánh dấu.
  const options = sourceText() ? row.options.filter((item) => item.nameZh) : row.options;
  if (sourceText() && options.length < row.options.length) profile.viOnly = true;
  profile.children.push({ key: "options", titleVi: L("Lựa chọn", "选项", "選択肢"), items: options.map((item) => {
    if (!sourceText()) return { id: item.id, titleVi: item.nameVi, tierVi: item.tierVi, descriptionVi: text(item.descriptionVi), convertsToVi: text(item.convertsToVi) };
    const description = sourceFor(profile, item, "description", item.descriptionZh);
    if (item.descriptionZh && !description) profile.viOnly = true;
    return { id: item.id, titleVi: contentMode() === "ja" ? lookupDisplayName(item, item.nameVi) : item.nameZh, tierVi: zhSafeValue(item.tierVi) ?? lookupEmpty(), descriptionVi: text(description || null), convertsToVi: zhSafeValue(item.convertsToVi) ?? lookupEmpty() };
  }) });
  profile.zhTranslated = sourceText() && (isTranslatedZhText(row) || options.some(isTranslatedZhText));
  profile.revisions = viOnlyList(profile, row.revisions.map((item) => ({ ...item })));
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

/** Đơn vị thời lượng của dữ liệu ("2 giờ", "5 phút") → `[zh, ja]`. */
const DURATION_UNITS = { "giờ": ["小时", "時間"], "phút": ["分钟", "分"], "ngày": ["天", "日"], "giây": ["秒", "秒"] };
/** Thời lượng dạng "2 giờ" / "5 phút" ở bản không phải tiếng Việt: đổi đơn vị theo ngôn ngữ trang; dạng lạ trả `null`. */
export function durationSourceText(value, locale = currentLocale()) {
  const match = /^(\d+(?:[.,]\d+)?)\s*(giờ|phút|ngày|giây)$/u.exec(String(value ?? "").trim());
  if (!match) return null;
  const [zh, ja] = DURATION_UNITS[match[2]];
  return pick(locale, `${match[1]} ${match[2]}`, `${match[1]} ${zh}`, `${match[1]}${ja}`);
}

/** Thời lượng dữ liệu dạng "2 giờ" / "5 phút": bản khác đổi đơn vị, dạng khác bỏ (`null`). */
function durationText(value) {
  const shown = text(value);
  if (!sourceText() || shown === lookupEmpty()) return shown;
  return durationSourceText(value);
}

function buildingProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "summary", row.summaryVi, L("Tóm tắt", "概述", "概要"), text(row.summaryVi), sourceFor(profile, row, "summary", row.summaryZh));
  profile.zhTranslated = sourceText() && isTranslatedZhText(row);
  pushField(profile, "maxLevel", row.maxLevel, L("Cấp tối đa", "最高等级", "最大レベル"));
  pushField(profile, "mainCityOnly", row.mainCityOnly, L("Phạm vi xây dựng", "建造范围", "建設範囲"), row.mainCityOnly ? L("Chỉ thành chính", "仅主城", "本城のみ") : L("Mọi thành", "所有城池", "すべての城"));

  // Khóa bản dịch theo vị trí cấp trong dữ liệu (`levels.N.*`), trước khi sắp theo cấp.
  const levels = row.levels.map((item, index) => ({ item, index })).sort((a, b) => a.item.level - b.item.level).map(({ item, index }) => {
    const durationSource = sourceFor(profile, row, `levels.${index}.duration`, item.durationZh);
    const durationVi = sourceText() && item.durationZh ? durationSource || durationText(item.durationVi) : durationText(item.durationVi);
    // Hiệu ứng cấp: bản zh dùng chữ Hán nguồn (bản ja: bản dịch máy); cấp chỉ có chữ Việt (hoặc thời lượng không đọc được) bị bỏ ô và đánh dấu.
    const effectSource = sourceFor(profile, row, `levels.${index}.effect`, item.effectZh) || null;
    if (sourceText() && ((!effectSource && item.effectVi && item.effectVi !== lookupEmpty()) || durationVi === null)) profile.viOnly = true;
    return { id: item.id, level: item.level, costs: { ...item.costs }, durationVi: durationVi ?? lookupEmpty(), effectVi: sourceText() ? text(effectSource) : text(item.effectVi) };
  });
  profile.children.push({ key: "levels", titleVi: L("Cấp công trình", "建筑等级", "施設レベル"), items: levels });
  profile.conditions = localizedConditions(profile, conditions(row.conditions));
  return profile;
}

/**
 * Binh thư: tên (Việt, Hán-Việt, chữ Hán) và hiệu ứng nếu dữ liệu có — bản Việt hiện `effectViet` đã duyệt,
 * bản zh hiện chữ Hán nguồn `effect` (bản ja: bản dịch máy của nó), kèm mốc số liệu: bản Việt dùng `effectVietVersion`
 * khi chữ Việt chép từ client Global (mốc riêng), không thì `effectVersion` của nguồn. Mục chưa có hiệu ứng để trạng thái
 * trống chung, không bịa. Tên Hán-Việt chỉ hiện ở bản Việt khi khác tên dịch nghĩa. Tên cũ trong nguồn
 * (`formerNames`, chữ Hán) chỉ hiện ở bản zh để trang Việt không lẫn chữ Hán (bản ja đã có dòng "原名").
 */
function bookProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  const mode = contentMode();
  if (mode === "vi" && row.hanViet && row.hanViet !== row.viet) pushField(profile, "hanViet", row.hanViet, L("Tên Hán-Việt", "汉越名", "漢越名"));
  if (mode === "source" && row.formerNames?.length) pushField(profile, "formerNames", row.formerNames.join(" · "), L("Tên cũ", "旧名", "旧名"));
  const hasEffect = Boolean(row.effect && row.effectViet);
  const effect = !hasEffect ? null : sourceText() ? sourceFor(profile, row, "effect", row.effect) || null : row.effectViet;
  if (hasEffect && effect === null) profile.viOnly = true;
  pushField(profile, "effect", effect, L("Hiệu ứng", "效果", "効果"));
  const version = sourceText() ? row.effectVersion : (row.effectVietVersion ?? row.effectVersion);
  if (effect !== null && version) pushField(profile, "effectVersion", version, L("Số liệu theo bản", "数据版本", "データ版"));
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
