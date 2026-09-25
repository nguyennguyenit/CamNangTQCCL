const EMPTY = "Đang cập nhật";
const LABELS = {
  luc: "Vũ lực", tri: "Trí lực", thong: "Thống soái", toc: "Tốc độ", chinh: "Chính trị", mi: "Mị lực",
  ky: "Kỵ binh", thuan: "Khiên binh", cung: "Cung binh", thuong: "Thương binh", khiGioi: "Khí giới",
  infantry: "Bộ binh", navy: "Thủy quân",
  // Nội chính: dữ liệu có thể trống từng phần, nhãn vẫn phải là tiếng Việt (không bao giờ in khóa thô).
  bonusVi: "Thưởng nội chính", roleVi: "Chức vụ nội chính", specialtyVi: "Sở trường nội chính",
  tacticBonusVi: "Thưởng chiến pháp",
};

/** Khóa không có nhãn bị bỏ khỏi hồ sơ; cảnh báo dev một lần cho mỗi khóa để bổ sung nhãn. */
const UNKNOWN_LABEL_KEYS = new Set();

const text = (value) => value === null || value === undefined || value === "" ? EMPTY : String(value);
function field(key, value, labelVi = LABELS[key], render = text(value)) {
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
const conditions = (rows) => (Array.isArray(rows) ? rows.map((row) => typeof row === "string" ? row : row?.textVi).filter(Boolean) : []);
const unresolved = (key, labelVi) => ({ key, labelVi, resolved: false, targetId: null, targetGroup: null, titleVi: null, statusVi: "Liên kết đang được cập nhật" });
const listText = (values, empty = EMPTY) => Array.isArray(values) && values.length ? values.join(", ") : empty;
const VARIANT_LABELS = { base: "Thường", sp: "SP", co: "CO", "40y": "40Y" };
/** Loại chiến pháp trong dữ liệu là enum tiếng Anh/đã Việt hoá; UI chỉ hiện nhãn Việt. */
const TYPE_LABELS = {
  ACTIVE: "Chủ động", PASSIVE: "Bị động", COMMAND: "Chỉ huy", INTERNAL: "Nội chính",
  FORMATION: "Trận pháp", TROOP: "Binh chủng", BURST: "Bùng nổ",
};
const RAW_ENUM = /^[A-Z][A-Z0-9_]*$/;

/**
 * Nhãn Việt của một giá trị `type` chiến pháp, dùng chung cho mọi chỗ hiển thị (bảng, thẻ chiến pháp,
 * thẻ kết quả nhóm hỗn hợp). Giá trị đã Việt hoá giữ nguyên; enum thô không có nhãn bị bỏ (kèm cảnh báo
 * dev) để UI không bao giờ in enum; giá trị khác trả nguyên văn.
 */
export function tacticTypeLabel(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  const label = TYPE_LABELS[text];
  if (label) return label;
  if (RAW_ENUM.test(text)) {
    if (!UNKNOWN_LABEL_KEYS.has(`type:${text}`)) {
      UNKNOWN_LABEL_KEYS.add(`type:${text}`);
      console.warn(`Tra cứu: chưa có nhãn tiếng Việt cho loại chiến pháp "${text}" — không hiển thị`);
    }
    return null;
  }
  return text;
}
const FLAG_LABELS = {
  isCollectible: "Sưu tầm", isDynamicOpen: "Mở động", isMusou: "Vô Song", isCO: "CO", isSp: "SP",
};

function optionalField(profile, key, value, labelVi, render = text(value)) {
  if (value !== null && value !== undefined && value !== "") pushField(profile, key, value, labelVi, render);
}

function relation(corpus, key, labelVi, targetId, targetGroup) {
  const target = targetId ? corpus.byId.get(targetId) : null;
  return target
    ? { key, labelVi, resolved: true, targetId: target.id, targetGroup, titleVi: target.nameVi, statusVi: null }
    : unresolved(key, labelVi);
}

function uniqueChineseTactic(corpus, chinese) {
  if (!chinese) return null;
  const matches = corpus.tactics.filter((row) => row.chinese === chinese);
  return matches.length === 1 ? matches[0].id : null;
}

function base(entry) {
  return { id: entry.id, group: entry.group, titleVi: entry.nameVi, fields: [], aptitudes: [], sections: [], relations: [], children: [], conditions: [], revisions: [] };
}

function heroProfile(corpus, entry) {
  const row = entry.record;
  const lookup = row.lookup ?? {};
  const profile = base(entry);
  optionalField(profile, "variant", lookup.variant, "Biến thể", VARIANT_LABELS[lookup.variant] ?? text(lookup.variant));
  for (const [key, value, label] of [
    ["faction", row.faction, "Phe"], ["stars", row.stars, "Sao"], ["cost", row.cost, "Thống ngự"],
    ["roleTagViet", row.roleTagViet, "Vai trò"], ["categoryVi", lookup.categoryVi, "Phân loại"],
    ["exclusiveTitleVi", lookup.exclusiveTitleVi, "Danh hiệu độc quyền"],
    ["civilInnatePoints", lookup.civilInnatePoints, "Điểm nội chính"],
    ["collectibleBonusVi", lookup.collectibleBonusVi, "Thưởng sưu tầm"],
    ["redRulesVi", lookup.redRulesVi, "Quy tắc điểm đỏ"],
  ]) optionalField(profile, key, value, label);
  const enabledFlags = Object.entries(lookup.flags ?? {}).filter(([, enabled]) => enabled === true).map(([key]) => FLAG_LABELS[key] ?? key);
  if (enabledFlags.length) pushField(profile, "flags", enabledFlags, "Đặc tính", enabledFlags.join(" · "));
  for (const key of ["luc", "tri", "thong", "toc", "chinh", "mi"]) pushField(profile, key, row.stats?.[key]);
  profile.aptitudes = [
    ...["ky", "thuan", "cung", "thuong", "khiGioi"].map((key) => field(key, row.troopApt?.[key])),
    ...["infantry", "navy"].map((key) => field(key, lookup.otherAptitudes?.[key])),
  ].filter(Boolean);
  const growth = Object.entries(lookup.growth ?? {}).map(([key, value]) => field(key, value)).filter(Boolean);
  const civil = Object.entries(lookup.civil ?? {}).map(([key, value]) => field(key, value)).filter(Boolean);
  profile.sections.push({ key: "growth", titleVi: "Tăng trưởng", fields: growth });
  profile.sections.push({ key: "civil", titleVi: "Nội chính", fields: civil });
  const selfId = lookup.selfTacticId ?? uniqueChineseTactic(corpus, row.selfTacticCn);
  const inheritId = lookup.inheritTacticId ?? uniqueChineseTactic(corpus, row.inheritTacticCn);
  profile.relations.push(relation(corpus, "selfTactic", "Chiến pháp bản thân", selfId, "tactics"));
  if (lookup.inheritTacticId || row.inheritTacticCn) profile.relations.push(relation(corpus, "inheritTactic", "Chiến pháp truyền thừa", inheritId, "tactics"));
  if (lookup.advisorId) profile.relations.push(relation(corpus, "advisor", "Kỹ năng quân sư", lookup.advisorId, "advisors"));
  profile.conditions = conditions(lookup.conditions);
  profile.revisions = lookup.revisions ?? [];
  return profile;
}

function tacticProfile(corpus, entry) {
  const row = entry.record;
  const lookup = row.lookup ?? {};
  const profile = base(entry);
  pushField(profile, "effect", row.effectViet, "Hiệu ứng");
  pushField(profile, "target", row.targetViet, "Mục tiêu");
  const rate = lookup.activationRate;
  pushField(profile, "activationRate", rate, "Tỷ lệ kích hoạt", rate == null ? EMPTY : `${rate * 100}%`);
  for (const [key, label] of [["type", "Loại"], ["quality", "Phẩm chất"], ["effectTypeVi", "Dạng hiệu ứng"], ["exchangeConditionVi", "Điều kiện đổi"]]) {
    const value = key in row ? row[key] : lookup[key];
    if (value === undefined || value === "") continue;
    if (key === "type") {
      const typeVi = tacticTypeLabel(value);
      if (!typeVi) continue;
      pushField(profile, key, value, label, typeVi);
      continue;
    }
    pushField(profile, key, value, label);
  }
  for (const [key, label] of [["cooldown", "Hồi chiêu"], ["maxUsers", "Số người dùng tối đa"], ["pointCost", "Điểm chiến pháp"]]) {
    optionalField(profile, key, lookup[key], label);
  }
  if (lookup.acquiredFromVi?.length) pushField(profile, "acquiredFromVi", lookup.acquiredFromVi, "Cách nhận", listText(lookup.acquiredFromVi));
  optionalField(profile, "conflictsVi", lookup.conflictsVi, "Xung đột");
  for (const id of lookup.inheritedFromIds ?? []) profile.relations.push(relation(corpus, `inheritedFrom:${id}`, "Truyền thừa từ", id, "heroes"));
  profile.conditions = conditions(lookup.conditions);
  profile.revisions = lookup.revisions.map((item) => ({ ...item }));
  return profile;
}

function equipmentProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushField(profile, "slot", row.slotVi, "Vị trí");
  pushField(profile, "quality", row.qualityVi, "Phẩm chất");
  const items = corpus.catalog.specials.filter((item) => item.equipmentId === row.id).map((item) => ({ id: item.id, titleVi: item.nameVi }));
  profile.children.push({ key: "specials", titleVi: "Đặc kỹ", items });
  profile.conditions = conditions(row.conditions);
  return profile;
}

function specialProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushField(profile, "description", row.descriptionVi, "Mô tả");
  pushField(profile, "tier", row.tierVi, "Bậc");
  pushField(profile, "slot", row.slotVi, "Vị trí");
  pushField(profile, "acquisitionVi", row.acquisitionVi, "Cách nhận", listText(row.acquisitionVi));
  profile.relations.push(relation(corpus, "equipment", "Trang bị", row.equipmentId, "equipment"));
  if (row.exclusiveHeroId) profile.relations.push(relation(corpus, "exclusiveHero", "Tướng độc quyền", row.exclusiveHeroId, "heroes"));
  profile.conditions = conditions(row.conditions);
  return profile;
}

function advisorProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushField(profile, "elementVi", row.elementVi, "Nguyên tố");
  pushField(profile, "effect", row.effectVi, "Hiệu ứng");
  pushField(profile, "usage", row.usageVi, "Cách dùng");
  pushField(profile, "tacticPoints", row.tacticPoints, "Điểm chiến pháp");

  profile.children.push({ key: "heroes", titleVi: "Tướng", items: row.heroIds.map((id) => corpus.byId.get(id)).filter(Boolean).map((item) => ({ id: item.id, titleVi: item.nameVi })) });
  profile.conditions = conditions(row.conditions);
  return profile;
}

function troopProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushField(profile, "effect", row.effectVi, "Hiệu ứng");
  pushField(profile, "appliesTo", row.appliesToVi, "Áp dụng");
  pushField(profile, "suggestedBuild", row.suggestedBuildVi, "Gợi ý");
  pushField(profile, "troopLimitVi", row.troopLimitVi, "Giới hạn binh chủng", listText(row.troopLimitVi, "Không giới hạn"));

  profile.children.push({ key: "options", titleVi: "Lựa chọn", items: row.options.map((item) => ({ id: item.id, titleVi: item.nameVi, tierVi: item.tierVi, descriptionVi: text(item.descriptionVi), convertsToVi: text(item.convertsToVi) })) });
  profile.revisions = row.revisions.map((item) => ({ ...item }));
  profile.conditions = conditions(row.conditions);
  return profile;
}

function buildingProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  pushField(profile, "summary", row.summaryVi, "Tóm tắt");
  pushField(profile, "maxLevel", row.maxLevel, "Cấp tối đa");
  pushField(profile, "mainCityOnly", row.mainCityOnly, "Phạm vi xây dựng", row.mainCityOnly ? "Chỉ thành chính" : "Mọi thành");

  profile.children.push({ key: "levels", titleVi: "Cấp công trình", items: [...row.levels].sort((a, b) => a.level - b.level).map((item) => ({ id: item.id, level: item.level, costs: { ...item.costs }, durationVi: text(item.durationVi), effectVi: text(item.effectVi) })) });
  profile.conditions = conditions(row.conditions);
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
  return null;
}
