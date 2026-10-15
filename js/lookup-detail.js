import { L, currentLocale, normalizeLocale, pick } from "./i18n.js";

// Bản zh (`<html lang="zh-Hans">`): nhãn dịch sang tiếng Trung; giá trị chỉ hiện khi có chữ Hán nguồn
// (tên, hiệu ứng/mục tiêu chiến pháp), là số, hoặc thuộc bộ giá trị đóng đã dịch bên dưới. Nội dung chỉ
// có bản Việt (mô tả, điều kiện, lịch sử…) bị bỏ khỏi hồ sơ zh để không trộn hai ngôn ngữ.
const ZH = () => currentLocale() === "zh";
/** Chữ cho ô chưa có dữ liệu (theo ngôn ngữ trang; hàm để build dựng cả hai ngôn ngữ trong một tiến trình). */
export const lookupEmpty = () => L("Đang cập nhật", "暂无数据");
const labels = () => ({
  luc: L("Vũ lực", "武力"), tri: L("Trí lực", "智力"), thong: L("Thống soái", "统率"), toc: L("Tốc độ", "速度"),
  chinh: L("Chính trị", "政治"), mi: L("Mị lực", "魅力"),
  ky: L("Kỵ binh", "骑兵"), thuan: L("Khiên binh", "盾兵"), cung: L("Cung binh", "弓兵"), thuong: L("Thương binh", "枪兵"),
  khiGioi: L("Khí giới", "器械"), infantry: L("Bộ binh", "步兵"), navy: L("Thủy quân", "水军"),
});
/** Khóa có giá trị là số/hạng chữ cái (chỉ số, tăng trưởng, thích tính) — hiện được ở bản zh. */
const LANGUAGE_NEUTRAL_KEYS = new Set(["luc", "tri", "thong", "toc", "chinh", "mi", "ky", "thuan", "cung", "thuong", "khiGioi", "infantry", "navy"]);
/** Bộ giá trị đóng của dữ liệu (tiếng Việt) → chữ Trung cho bản zh. */
const ZH_VALUES = {
  "Ngụy": "魏", "Thục": "蜀", "Ngô": "吴", "Quần": "群",
  "Quân sự": "军事", "Nội chính": "内政",
  "Vũ khí": "武器", "Phòng cụ": "防具", "Tọa kỵ": "坐骑", "Bảo vật": "宝物",
  "Cam": "橙", "Tím": "紫",
  "Hỏa": "火", "Phong": "风", "Lâm": "林", "Sơn": "山",
  "Tăng ích": "增益", "Giảm ích": "减益", "Khống chế": "控制", "Trị liệu": "治疗", "Viện hộ": "援护",
  "Sát thương binh khí quần thể": "群体兵刃伤害", "Sát thương binh khí đơn thể": "单体兵刃伤害",
  "Mưu lược quần thể": "群体谋略伤害", "Mưu lược đơn thể": "单体谋略伤害",
};
/**
 * Giá trị hiển thị của bản zh: số và hạng giữ nguyên, giá trị trong bộ đóng được dịch, còn lại `null`
 * (bị bỏ). Bản Việt luôn trả chữ gốc. `locale` mặc định là ngôn ngữ trang (build truyền tường minh).
 */
export function zhSafeValue(value, locale = currentLocale()) {
  if (normalizeLocale(locale) !== "zh") return value;
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" || /^[\d.,%+\-/ ~]+$/u.test(String(value)) || /^(?:[SABCD]|T\d|SP|CO|40Y)$/u.test(String(value))) return String(value);
  return ZH_VALUES[String(value)] ?? null;
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
 * (`chinese` của tướng/chiến pháp, `aliasesZh` của catalog), thiếu thì lùi về tên Việt.
 */
export function lookupDisplayName(record, nameVi, locale = currentLocale()) {
  if (normalizeLocale(locale) !== "zh") return nameVi;
  if (typeof record?.chinese === "string" && record.chinese.trim()) return record.chinese.trim();
  for (const value of record?.aliasesZh ?? []) if (typeof value === "string" && /[\u3400-\u9fff]/u.test(value)) return value;
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

function uniqueChineseTactic(corpus, chinese) {
  if (!chinese) return null;
  const matches = corpus.tactics.filter((row) => row.chinese === chinese);
  return matches.length === 1 ? matches[0].id : null;
}

function base(entry) {
  return { id: entry.id, group: entry.group, titleVi: entryTitle(entry), fields: [], aptitudes: [], sections: [], relations: [], children: [], conditions: [], revisions: [], viOnly: false };
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
  for (const [key, value, label] of [
    ["roleTagViet", row.roleTagViet, L("Vai trò", "定位")], ["categoryVi", lookup.categoryVi, L("Phân loại", "类别")],
    ["exclusiveTitleVi", lookup.exclusiveTitleVi, L("Danh hiệu độc quyền", "专属称号")],
  ]) optionalLocalized(profile, key, value, label);
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
  const selfId = lookup.selfTacticId ?? uniqueChineseTactic(corpus, row.selfTacticCn);
  const inheritId = lookup.inheritTacticId ?? uniqueChineseTactic(corpus, row.inheritTacticCn);
  profile.relations.push(relation(corpus, "selfTactic", L("Chiến pháp bản thân", "自带战法"), selfId, "tactics"));
  if (lookup.inheritTacticId || row.inheritTacticCn) profile.relations.push(relation(corpus, "inheritTactic", L("Chiến pháp truyền thừa", "传承战法"), inheritId, "tactics"));
  if (lookup.advisorId) profile.relations.push(relation(corpus, "advisor", L("Kỹ năng quân sư", "军师技"), lookup.advisorId, "advisors"));
  profile.conditions = viOnlyList(profile, conditions(lookup.conditions));
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
    pushLocalized(profile, key, value, label);
  }
  for (const [key, label] of [["cooldown", L("Hồi chiêu", "冷却")], ["maxUsers", L("Số người dùng tối đa", "最多携带人数")], ["pointCost", L("Điểm chiến pháp", "战法点")]]) {
    optionalLocalized(profile, key, lookup[key], label);
  }
  if (lookup.acquiredFromVi?.length) pushLocalized(profile, "acquiredFromVi", lookup.acquiredFromVi, L("Cách nhận", "获取方式"), listText(lookup.acquiredFromVi));
  optionalLocalized(profile, "conflictsVi", lookup.conflictsVi, L("Xung đột", "冲突"));
  for (const id of lookup.inheritedFromIds ?? []) profile.relations.push(relation(corpus, `inheritedFrom:${id}`, L("Truyền thừa từ", "传承自"), id, "heroes"));
  profile.conditions = viOnlyList(profile, conditions(lookup.conditions));
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
  profile.conditions = viOnlyList(profile, conditions(row.conditions));
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
  profile.conditions = viOnlyList(profile, conditions(row.conditions));
  return profile;
}

function advisorProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "elementVi", row.elementVi, L("Nguyên tố", "属性"));
  pushLocalized(profile, "effect", row.effectVi, L("Hiệu ứng", "效果"));
  pushLocalized(profile, "usage", row.usageVi, L("Cách dùng", "用法"));
  pushField(profile, "tacticPoints", row.tacticPoints, L("Điểm chiến pháp", "战法点"));

  profile.children.push({ key: "heroes", titleVi: L("Tướng", "武将"), items: row.heroIds.map((id) => corpus.byId.get(id)).filter(Boolean).map((item) => ({ id: item.id, titleVi: entryTitle(item) })) });
  profile.conditions = viOnlyList(profile, conditions(row.conditions));
  return profile;
}

function troopProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushLocalized(profile, "effect", row.effectVi, L("Hiệu ứng", "效果"));
  pushLocalized(profile, "appliesTo", row.appliesToVi, L("Áp dụng", "适用"));
  pushLocalized(profile, "suggestedBuild", row.suggestedBuildVi, L("Gợi ý", "推荐"));
  pushLocalized(profile, "troopLimitVi", row.troopLimitVi, L("Giới hạn binh chủng", "兵种限制"), listText(row.troopLimitVi, L("Không giới hạn", "无限制")));

  // Lựa chọn cải tạo chỉ có tên/mô tả tiếng Việt: bản zh bỏ danh sách này.
  const options = viOnlyList(profile, row.options);
  profile.children.push({ key: "options", titleVi: L("Lựa chọn", "选项"), items: options.map((item) => ({ id: item.id, titleVi: item.nameVi, tierVi: item.tierVi, descriptionVi: text(item.descriptionVi), convertsToVi: text(item.convertsToVi) })) });
  profile.revisions = viOnlyList(profile, row.revisions.map((item) => ({ ...item })));
  profile.conditions = viOnlyList(profile, conditions(row.conditions));
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
  pushLocalized(profile, "summary", row.summaryVi, L("Tóm tắt", "概述"));
  pushField(profile, "maxLevel", row.maxLevel, L("Cấp tối đa", "最高等级"));
  pushField(profile, "mainCityOnly", row.mainCityOnly, L("Phạm vi xây dựng", "建造范围"), row.mainCityOnly ? L("Chỉ thành chính", "仅主城") : L("Mọi thành", "所有城池"));

  const levels = [...row.levels].sort((a, b) => a.level - b.level).map((item) => {
    const durationVi = durationText(item.durationVi);
    // Hiệu ứng cấp chỉ có chữ Việt: bản zh bỏ ô này (và ô thời lượng không đọc được).
    if (ZH() && ((item.effectVi && item.effectVi !== lookupEmpty()) || durationVi === null)) profile.viOnly = true;
    return { id: item.id, level: item.level, costs: { ...item.costs }, durationVi: durationVi ?? lookupEmpty(), effectVi: ZH() ? lookupEmpty() : text(item.effectVi) };
  });
  profile.children.push({ key: "levels", titleVi: L("Cấp công trình", "建筑等级"), items: levels });
  profile.conditions = viOnlyList(profile, conditions(row.conditions));
  return profile;
}

/**
 * Binh thư: tên (Việt, Hán-Việt, chữ Hán) và hiệu ứng nếu dữ liệu có — bản Việt hiện `effectViet` đã duyệt,
 * bản zh hiện chữ Hán nguồn `effect`, kèm mốc số liệu `effectVersion`. Mục chưa có hiệu ứng để trạng thái
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
  if (hasEffect && row.effectVersion) pushField(profile, "effectVersion", row.effectVersion, L("Số liệu theo bản", "数据版本"));
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
