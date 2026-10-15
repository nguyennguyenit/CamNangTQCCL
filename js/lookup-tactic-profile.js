// Thân hộp thoại hồ sơ chiến pháp (artboard LookupTacticProfile): bốn ô thông số, hiệu ứng có nút chọn phiên
// bản và số cấp in đậm, cột "Cách nhận" (tướng truyền thừa/tự mang + bảng nguồn), rồi khối "Trong cẩm nang"
// từ `tactic-summaries.json`. Đầu hộp thoại và vòng đời hộp thoại vẫn do `js/lookup-profile.js`/`lookup-page.js`.
//
// Quy tắc render (plan.md quyết định #14): dữ liệu động chỉ qua `el()`/`textContent`, không `innerHTML`.

import { el, icon, svgNode } from "./render.js";
import { L, currentLocale, localePath } from "./i18n.js";
import { lookupDisplayName, tacticTypeLabel, zhSafeValue } from "./lookup-detail.js";
import { lookupProfilePath } from "./lookup-ids.js";
import { heroPortrait } from "./hero-portrait.js";
import { teamDetailHref } from "./team-detail-navigation.js";
import { tacticCamNangView, tacticEffectSegments, tacticEffectVersions, tacticSourceLabel, tacticTroopFit } from "./lookup-tactic-view.js";

const MISSING = "—";
const zh = () => currentLocale() === "zh";
const fieldByKey = (profile, key) => profile.fields.find((field) => field.key === key) ?? null;
const hasValue = (field) => field && field.value !== null && field.value !== undefined && field.value !== "";
const fieldText = (profile, key) => {
  const field = fieldByKey(profile, key);
  return hasValue(field) ? String(field.textVi) : null;
};

function barFill(percent) {
  const fill = el("span", { class: "cam-nang-bar-fill" });
  fill.style.width = `${percent}%`;
  return fill;
}

function barRow(label, value, percent) {
  return el("li", { class: "cam-nang-bar" }, [
    el("span", { class: "cam-nang-bar-label" }, label),
    el("span", { class: "cam-nang-bar-value" }, String(value)),
    el("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [barFill(percent)]),
  ]);
}

/** Link trang chi tiết của một đội tiêu biểu (Đội chuẩn theo mã cấu hình, Đội khác theo mã đội cũ). */
export function representativeTeamHref(team) {
  const detail = team.family === "recommended"
    ? teamDetailHref({ sourceConfigId: team.sourceConfigId }, { from: location.href })
    : teamDetailHref({ legacyTeamId: team.legacyTeamId, legacyVariantId: team.legacyVariantId }, { from: location.href });
  return detail ? localePath(detail) : null;
}

/** Huy hiệu đầu hồ sơ: phẩm, loại (nền mực), binh chủng hợp khi hẹp hơn "mọi binh chủng", dạng hiệu ứng. */
export function tacticBadges(record, profile) {
  const badges = [];
  const quality = zhSafeValue(record.quality);
  if (quality) badges.push(el("span", { class: "badge badge-accent" }, L(`Phẩm ${quality}`, `品质 ${quality}`)));
  const type = tacticTypeLabel(record.type);
  if (type) badges.push(el("span", { class: "badge badge-ink" }, type));
  const troops = tacticTroopFit(record.troopFit);
  if (troops && !troops.all) for (const label of troops.labels) badges.push(el("span", { class: "badge badge-fill" }, label));
  const effectType = fieldText(profile, "effectTypeVi");
  if (effectType) badges.push(el("span", { class: "badge badge-outline" }, effectType));
  return badges;
}

/** Tướng gắn với chiến pháp: tướng truyền thừa rồi tướng tự mang, đều từ quan hệ hồ sơ (`lookup-detail.js`). */
function sourceHeroes(corpus, profile) {
  const rows = [];
  for (const relation of profile.relations) {
    if (!relation.key.startsWith("inheritedFrom:")) continue;
    const hero = relation.resolved ? corpus.byId.get(relation.targetId) : null;
    rows.push(hero
      ? { hero, note: L("Truyền thừa · tháo chiến pháp từ tướng này", "传承 · 拆解该武将获得") }
      : { pending: `${relation.labelVi}: ${relation.statusVi}` });
  }
  for (const relation of profile.relations) {
    if (!relation.key.startsWith("innateHolder:") || !relation.resolved) continue;
    const hero = corpus.byId.get(relation.targetId);
    if (hero && !rows.some((row) => row.hero === hero)) {
      rows.push({ hero, note: L("Tự mang · chiến pháp bản thân của tướng này", "自带 · 该武将的自带战法") });
    }
  }
  return rows;
}

function sourceHeroCard({ hero, note }) {
  const record = hero.record ?? {};
  const name = lookupDisplayName(record, hero.nameVi);
  return el("a", { class: "lookup-source-hero", href: localePath(lookupProfilePath(hero.id)) }, [
    heroPortrait({ chinese: record.chinese, nameVi: name, iconUrl: record.iconUrl, className: "lookup-source-portrait" }),
    el("span", { class: "lookup-source-body" }, [
      el("span", { class: "lookup-source-name" }, name),
      el("span", { class: "lookup-source-note" }, note),
    ]),
  ]);
}

/** Đoạn hiệu ứng: chữ thường xen số cấp in đậm. */
function effectParagraph(text) {
  return el("p", { class: "lookup-tactic-effect-text" }, tacticEffectSegments(text).map((segment) => (segment.strong
    ? el("strong", { class: "lookup-tactic-level" }, segment.text)
    : segment.text)));
}

/** Khung hiệu ứng: nút chọn phiên bản (bản hiện hành chọn sẵn), đoạn của bản đang chọn, chú thích số in đậm. */
function effectSection(record) {
  const versions = tacticEffectVersions(record).filter((version) => version.paragraphs.length);
  const body = el("div", { class: "lookup-tactic-effect-body" });
  const show = (version) => body.replaceChildren(...version.paragraphs.map(effectParagraph));
  const head = el("div", { class: "lookup-tactic-effect-head" }, [
    el("h3", { class: "lookup-section-title", id: "lookup-tactic-effect-title" }, L("Hiệu ứng", "效果")),
  ]);
  if (versions.length > 1 || versions[0]?.label) {
    const buttons = versions.map((version, index) => el("button", {
      type: "button",
      class: "lookup-version-button",
      "aria-pressed": index === 0 ? "true" : "false",
    }, version.label || L("Bản hiện hành", "当前版本")));
    buttons.forEach((button, index) => button.addEventListener("click", () => {
      for (const other of buttons) other.setAttribute("aria-pressed", other === button ? "true" : "false");
      show(versions[index]);
    }));
    head.append(el("div", { class: "lookup-version-buttons", role: "group", "aria-label": L("Phiên bản hiệu ứng", "效果版本") }, buttons));
  }
  if (versions.length) show(versions[0]);
  else body.append(el("p", { class: "lookup-prose-text is-empty" }, L("Đang cập nhật", "暂无数据")));
  const leveled = versions.some((version) => version.paragraphs.some((text) => tacticEffectSegments(text).some((part) => part.strong)));
  const notes = [
    leveled ? L("Số in đậm: giá trị ở cấp 1 → cấp tối đa.", "粗体数字：1 级 → 满级数值。") : null,
    versions.length > 1 ? L(`${versions.length} phiên bản; chọn để xem bản cũ.`, `共 ${versions.length} 个版本，可切换查看旧版。`) : null,
  ].filter(Boolean);
  return el("section", { class: "lookup-tactic-effect", "aria-labelledby": "lookup-tactic-effect-title" }, [
    head,
    body,
    notes.length ? el("span", { class: "lookup-tactic-note" }, notes.join(" ")) : null,
  ]);
}

/** Bốn ô thông số dưới đầu hồ sơ; ô không có dữ liệu hiện gạch ngang. */
function statTiles(profile) {
  const tiles = [
    [L("Tỷ lệ kích hoạt", "发动率"), fieldText(profile, "activationRate")],
    [L("Mục tiêu", "目标"), fieldText(profile, "target")],
    [L("Người mang tối đa", "最多携带人数"), fieldText(profile, "maxUsers")],
    [L("Xung đột", "冲突"), fieldText(profile, "conflictsVi")],
  ];
  return el("dl", { class: "lookup-tactic-tiles" }, tiles.map(([label, value]) => el("div", { class: "lookup-tactic-tile" }, [
    el("dt", { class: "lookup-tactic-tile-label" }, label),
    el("dd", { class: "lookup-tactic-tile-value" }, value ?? MISSING),
  ])));
}

/** Cột "Cách nhận": thẻ tướng nguồn, hoặc chữ cách nhận khi không có tướng; bảng nguồn/dạng/binh chủng. */
function sourceColumn(corpus, entryRow, profile) {
  const record = entryRow.record ?? {};
  const heroes = sourceHeroes(corpus, profile);
  // Cách nhận khác tên tướng đã có thẻ (sự kiện, đổi thưởng…) vẫn phải hiện; tên trùng thẻ tướng thì bỏ.
  const heroNames = new Set(heroes.filter((row) => row.hero).map((row) => row.hero.nameVi));
  const acquiredField = fieldByKey(profile, "acquiredFromVi");
  const acquired = hasValue(acquiredField)
    ? (Array.isArray(acquiredField.value) ? acquiredField.value.filter((item) => !heroNames.has(item)).join(", ") : String(acquiredField.textVi)) || null
    : null;
  const facts = [
    [L("Nguồn", "来源"), tacticSourceLabel(record.source)],
    [L("Dạng hiệu ứng", "效果类型"), fieldText(profile, "effectTypeVi")],
    [L("Hợp binh chủng", "适用兵种"), tacticTroopFit(record.troopFit)?.text ?? null],
    [L("Hồi chiêu", "冷却"), fieldText(profile, "cooldown")],
    [L("Điểm chiến pháp", "战法点"), fieldText(profile, "pointCost")],
    [L("Điều kiện đổi", "兑换条件"), fieldText(profile, "exchangeConditionVi")],
  ].filter(([, value]) => value);
  return el("section", { class: "lookup-tactic-source", "aria-labelledby": "lookup-tactic-source-title" }, [
    el("h3", { class: "lookup-section-title", id: "lookup-tactic-source-title" }, L("Cách nhận", "获取方式")),
    ...heroes.map((row) => (row.hero ? sourceHeroCard(row) : el("p", { class: "lookup-relation-pending" }, row.pending))),
    acquired ? el("p", { class: "lookup-prose-text lookup-source-acquired" }, acquired) : null,
    !heroes.length && !acquired ? el("p", { class: "lookup-prose-text is-empty" }, L("Đang cập nhật", "暂无数据")) : null,
    facts.length ? el("dl", { class: "lookup-tactic-facts" }, facts.flatMap(([label, value]) => [
      el("dt", {}, label),
      el("dd", {}, value),
    ])) : null,
  ]);
}

/** Thân hồ sơ chiến pháp (không gồm đầu hộp thoại và khối "Trong cẩm nang"). */
export function tacticProfileBody(corpus, entryRow, profile, tail = []) {
  return el("div", { class: "lookup-profile lookup-tactic-profile" }, [
    statTiles(profile),
    el("div", { class: "lookup-tactic-columns" }, [effectSection(entryRow.record ?? {}), sourceColumn(corpus, entryRow, profile)]),
    ...tail,
  ]);
}

function camNangCards(view, record) {
  const appearance = el("article", { class: "cam-nang-card" }, [
    el("h4", { class: "cam-nang-title" }, L("Xuất hiện trong", "出现于")),
    el("div", { class: "cam-nang-counts" }, [
      el("div", { class: "cam-nang-count" }, [
        el("span", { class: "cam-nang-number" }, String(view.standard)),
        el("span", { class: "cam-nang-unit" }, L("đội chuẩn", "支推荐阵容")),
      ]),
      el("div", { class: "cam-nang-count" }, [
        el("span", { class: "cam-nang-number" }, String(view.other)),
        el("span", { class: "cam-nang-unit" }, L("đội khác", "支其他阵容")),
      ]),
    ]),
    el("ul", { class: "cam-nang-bars" }, view.positions.map((row) => barRow(row.label, row.count, row.percent))),
  ]);
  const carriers = el("article", { class: "cam-nang-card" }, [
    el("h4", { class: "cam-nang-title" }, L("Tướng hay mang", "常见携带武将")),
    view.carriers.length
      ? el("ul", { class: "cam-nang-bars" }, view.carriers.map((item) => barRow(item.name, item.teams, item.percent)))
      : el("p", { class: "lookup-relation-pending" }, L("Chưa khớp được tướng mang.", "暂无可识别的携带武将。")),
    view.companions.length ? el("div", { class: "cam-nang-facts" }, [
      el("span", { class: "cam-nang-fact" }, [
        el("span", { class: "cam-nang-fact-label" }, L("Hay đi cùng trong đội", "常见同队战法")),
        el("span", { class: "cam-nang-fact-value" }, view.companions.map((item) => `${item.name} (${item.teams})`).join(" · ")),
      ]),
    ]) : null,
  ]);
  const query = zh() ? record.chinese : record.viet ?? record.hanViet;
  const teams = el("article", { class: "cam-nang-card" }, [
    el("h4", { class: "cam-nang-title" }, L("Đội tiêu biểu", "代表阵容")),
    el("ul", { class: "cam-nang-teams" }, view.representative.map((team) => {
      const href = representativeTeamHref(team);
      // Tên đội chỉ có bản Việt: bản zh dùng nhãn chung, tướng mang/mùa ở dòng phụ vẫn phân biệt từng đội.
      const name = zh() ? "查看阵容" : team.name;
      return el("li", { class: "cam-nang-team" }, [
        href ? el("a", { class: "cam-nang-team-name", href }, name) : el("span", { class: "cam-nang-team-name" }, name),
        el("span", { class: "cam-nang-team-score" }, team.score === null ? MISSING : String(team.score)),
        team.meta ? el("span", { class: "cam-nang-team-meta" }, team.meta) : null,
      ]);
    })),
    // Kết quả tìm theo tên có thể gồm đội chỉ trùng chữ trong tên đội, nên link không hứa đúng con số đếm.
    query ? el("a", { class: "cam-nang-link", href: localePath(`/doi-chuan/?${new URLSearchParams({ season: "all", q: query })}`) }, [
      L("Tìm chiến pháp này trong Đội chuẩn", "在推荐阵容中查找该战法"),
      icon([svgNode("line", { x1: 5, y1: 12, x2: 19, y2: 12 }), svgNode("polyline", { points: "13 6 19 12 13 18" })], { size: 15, stroke: 2 }),
    ]) : null,
  ]);
  return el("div", { class: "cam-nang-grid" }, [appearance, carriers, teams]);
}

/**
 * Khối "Trong cẩm nang" của chiến pháp: số liệu tải lười ở lần mở hồ sơ đầu tiên; `isCurrent()` bỏ kết quả
 * về trễ của hồ sơ đã đóng. `getCorpus()` trả corpus mới nhất (có kho tướng khi payload hồ sơ đã tải).
 */
export function tacticSummaryBlock({ id, record, summaries, getCorpus, isCurrent }) {
  const status = el("p", { class: "lookup-summary-status", role: "status" }, L("Đang tải số liệu đội hình…", "正在加载阵容数据…"));
  const block = el("section", { class: "cam-nang", "aria-labelledby": "cam-nang-title" }, [
    el("div", { class: "cam-nang-head" }, [
      el("h3", { class: "cam-nang-heading", id: "cam-nang-title" }, L("Trong cẩm nang", "攻略收录")),
      el("span", { class: "cam-nang-note" }, L("Tính từ đội chuẩn và đội khác đang có · mọi mùa", "统计自现有推荐阵容与其他阵容 · 全部赛季")),
    ]),
    status,
  ]);
  summaries().then((table) => {
    if (!isCurrent() || !block.isConnected) return;
    const view = tacticCamNangView(table[id], getCorpus());
    if (!view) {
      status.textContent = L("Chưa có trong đội nào.", "尚未出现在任何阵容中。");
      return;
    }
    status.remove();
    block.append(camNangCards(view, record));
  }).catch(() => {
    if (!isCurrent() || !block.isConnected) return;
    status.textContent = L("Chưa tải được số liệu Trong cẩm nang.", "无法加载“攻略收录”数据。");
  });
  return block;
}
