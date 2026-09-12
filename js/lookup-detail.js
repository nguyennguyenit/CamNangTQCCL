const EMPTY = "Đang cập nhật";
const LABELS = {
  luc: "Vũ lực", tri: "Trí lực", thong: "Thống soái", toc: "Tốc độ", chinh: "Chính trị", mi: "Mị lực",
  ky: "Kỵ binh", thuan: "Khiên binh", cung: "Cung binh", thuong: "Thương binh", khiGioi: "Khí giới",
};

const text = (value) => value === null || value === undefined || value === "" ? EMPTY : String(value);
const field = (key, value, labelVi = LABELS[key] ?? key, render = text(value)) => ({ key, labelVi, value, textVi: render });
const conditions = (rows) => (Array.isArray(rows) ? rows.map((row) => typeof row === "string" ? row : row?.textVi).filter(Boolean) : []);
const unresolved = (key, labelVi) => ({ key, labelVi, resolved: false, targetId: null, targetGroup: null, titleVi: null, statusVi: "Liên kết đang được cập nhật" });

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
  const profile = base(entry);
  for (const key of ["luc", "tri", "thong", "toc", "chinh", "mi"]) profile.fields.push(field(key, row.stats?.[key]));
  profile.aptitudes = ["ky", "thuan", "cung", "thuong", "khiGioi"].map((key) => field(key, row.troopApt?.[key]));
  const growth = Object.entries(row.lookup?.growth ?? {}).map(([key, value]) => field(key, value, LABELS[key] ?? key));
  const civil = Object.entries(row.lookup?.civil ?? {}).map(([key, value]) => field(key, value, key));
  profile.sections.push({ key: "growth", titleVi: "Tăng trưởng", fields: growth });
  profile.sections.push({ key: "civil", titleVi: "Nội chính", fields: civil });
  const selfId = row.lookup?.selfTacticId ?? uniqueChineseTactic(corpus, row.selfTacticCn);
  const inheritId = row.lookup?.inheritTacticId ?? uniqueChineseTactic(corpus, row.inheritTacticCn);
  profile.relations.push(relation(corpus, "selfTactic", "Chiến pháp bản thân", selfId, "tactics"));
  if (row.lookup?.inheritTacticId || row.inheritTacticCn) profile.relations.push(relation(corpus, "inheritTactic", "Chiến pháp truyền thừa", inheritId, "tactics"));
  if (row.lookup?.advisorId) profile.relations.push(relation(corpus, "advisor", "Kỹ năng quân sư", row.lookup.advisorId, "advisors"));
  profile.conditions = conditions(row.lookup?.conditions);
  profile.revisions = row.lookup?.revisions ?? [];
  return profile;
}

function tacticProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  profile.fields.push(field("effect", row.effectViet, "Hiệu ứng"));
  profile.fields.push(field("target", row.targetViet, "Mục tiêu"));
  const rate = row.lookup?.activationRate;
  profile.fields.push(field("activationRate", rate, "Tỷ lệ kích hoạt", rate == null ? EMPTY : `${rate * 100}%`));
  for (const [key, label] of [["type", "Loại"], ["quality", "Phẩm chất"], ["effectTypeVi", "Dạng hiệu ứng"], ["exchangeConditionVi", "Điều kiện đổi"]]) {
    const value = key in row ? row[key] : row.lookup?.[key];
    if (value !== undefined) profile.fields.push(field(key, value, label));
  }
  for (const id of row.lookup?.inheritedFromIds ?? []) profile.relations.push(relation(corpus, `inheritedFrom:${id}`, "Truyền thừa từ", id, "heroes"));
  profile.conditions = conditions(row.lookup?.conditions);
  profile.revisions = Array.isArray(row.lookup?.revisions) ? row.lookup.revisions.map((item) => ({ ...item })) : [];
  return profile;
}

function equipmentProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  profile.fields.push(field("slot", row.slotVi, "Vị trí"), field("quality", row.qualityVi, "Phẩm chất"));
  const items = corpus.catalog.specials.filter((item) => item.equipmentId === row.id).map((item) => ({ id: item.id, titleVi: item.nameVi }));
  profile.children.push({ key: "specials", titleVi: "Đặc kỹ", items });
  profile.conditions = conditions(row.conditions);
  return profile;
}

function specialProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  profile.fields.push(field("description", row.descriptionVi, "Mô tả"), field("tier", row.tierVi, "Bậc"), field("slot", row.slotVi, "Vị trí"));
  profile.relations.push(relation(corpus, "equipment", "Trang bị", row.equipmentId, "equipment"));
  if (row.exclusiveHeroId) profile.relations.push(relation(corpus, "exclusiveHero", "Tướng độc quyền", row.exclusiveHeroId, "heroes"));
  profile.conditions = conditions(row.conditions);
  return profile;
}

function advisorProfile(corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  profile.fields.push(field("effect", row.effectVi, "Hiệu ứng"), field("usage", row.usageVi, "Cách dùng"), field("tacticPoints", row.tacticPoints, "Điểm chiến pháp"));
  profile.children.push({ key: "heroes", titleVi: "Tướng", items: (row.heroIds ?? []).map((id) => corpus.byId.get(id)).filter(Boolean).map((item) => ({ id: item.id, titleVi: item.nameVi })) });
  profile.conditions = conditions(row.conditions);
  return profile;
}

function troopProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  profile.fields.push(field("effect", row.effectVi, "Hiệu ứng"), field("appliesTo", row.appliesToVi, "Áp dụng"), field("suggestedBuild", row.suggestedBuildVi, "Gợi ý"));
  profile.children.push({ key: "options", titleVi: "Lựa chọn", items: (row.options ?? []).map((item) => ({ id: item.id, titleVi: item.nameVi, tierVi: item.tierVi, descriptionVi: text(item.descriptionVi), convertsToVi: text(item.convertsToVi) })) });
  profile.revisions = (row.revisions ?? []).map((item) => ({ ...item }));
  profile.conditions = conditions(row.conditions);
  return profile;
}

function buildingProfile(_corpus, entry) {
  const row = entry.record;
  const profile = base(entry);
  profile.fields.push(field("summary", row.summaryVi, "Tóm tắt"), field("maxLevel", row.maxLevel, "Cấp tối đa"));
  profile.children.push({ key: "levels", titleVi: "Cấp công trình", items: [...(row.levels ?? [])].sort((a, b) => a.level - b.level).map((item) => ({ id: item.id, level: item.level, costs: { ...item.costs }, durationVi: text(item.durationVi), effectVi: text(item.effectVi) })) });
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
