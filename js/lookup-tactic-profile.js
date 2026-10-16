// Thân hồ sơ chiến pháp (artboard LookupTacticProfile): bốn ô thông số, hiệu ứng có nút chọn phiên
// bản và số cấp in đậm, cột "Cách nhận" (tướng truyền thừa/tự mang + bảng nguồn), rồi khối "Trong cẩm nang"
// từ `tactic-summaries.json`. Đầu hộp thoại và vòng đời hộp thoại vẫn do `js/lookup-profile.js`/`lookup-page.js`.
//
// Mọi khối là cây view (`js/view-tree.js`, không DOM): build dựng trang riêng của chiến pháp bằng `treeToHtml`,
// hộp thoại trong trình duyệt dựng bằng `treeToDom` rồi gắn sự kiện (`bindTacticEffectVersions`, `tacticSummaryBlock`).
// Quy tắc render (plan.md quyết định #14): dữ liệu động chỉ qua cây view, không `innerHTML`.

import { t, iconTree, svgTree } from "./render.js";
import { L, currentLocale, localePath } from "./i18n.js";
import { lookupDisplayName, tacticTypeLabel, zhSafeValue } from "./lookup-detail.js";
import { lookupHref } from "./lookup-ids.js";
import { portraitTree } from "./hero-portrait.js";
import { teamDetailHref } from "./team-detail-navigation.js";
import { treeToDom } from "./view-tree.js";
import { tacticCamNangView, tacticEffectSegments, tacticEffectVersions, tacticSourceLabel, tacticTroopFit } from "./lookup-tactic-view.js";

const MISSING = "—";
const zh = () => currentLocale() === "zh";
const fieldByKey = (profile, key) => profile.fields.find((field) => field.key === key) ?? null;
const hasValue = (field) => field && field.value !== null && field.value !== undefined && field.value !== "";
const fieldText = (profile, key) => {
  const field = fieldByKey(profile, key);
  return hasValue(field) ? String(field.textVi) : null;
};

const barFill = (percent) => t("span", { class: "cam-nang-bar-fill", style: `width: ${percent}%;` });

function barRow(label, value, percent) {
  return t("li", { class: "cam-nang-bar" }, [
    t("span", { class: "cam-nang-bar-label" }, label),
    t("span", { class: "cam-nang-bar-value" }, String(value)),
    t("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [barFill(percent)]),
  ]);
}

/**
 * Link trang chi tiết của một đội tiêu biểu (Đội chuẩn theo mã cấu hình, Đội khác theo mã đội cũ). `from` là URL
 * trang đang xem để trang chi tiết quay lại đúng chỗ: trình duyệt mặc định là trang hiện tại, build không có.
 */
export function representativeTeamHref(team, from = globalThis.location?.href) {
  const detail = team.family === "recommended"
    ? teamDetailHref({ sourceConfigId: team.sourceConfigId }, { from })
    : teamDetailHref({ legacyTeamId: team.legacyTeamId, legacyVariantId: team.legacyVariantId }, { from });
  return detail ? localePath(detail) : null;
}

/** Huy hiệu đầu hồ sơ: phẩm, loại (nền mực), binh chủng hợp khi hẹp hơn "mọi binh chủng", dạng hiệu ứng. */
export function tacticBadges(record, profile) {
  const badges = [];
  const quality = zhSafeValue(record.quality);
  if (quality) badges.push(t("span", { class: "badge badge-accent" }, L(`Phẩm ${quality}`, `品质 ${quality}`)));
  const type = tacticTypeLabel(record.type);
  if (type) badges.push(t("span", { class: "badge badge-ink" }, type));
  const troops = tacticTroopFit(record.troopFit);
  if (troops && !troops.all) for (const label of troops.labels) badges.push(t("span", { class: "badge badge-fill" }, label));
  const effectType = fieldText(profile, "effectTypeVi");
  if (effectType) badges.push(t("span", { class: "badge badge-outline" }, effectType));
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
  return t("a", { class: "lookup-source-hero", href: localePath(lookupHref(hero.id)) }, [
    portraitTree({ chinese: record.chinese, nameVi: name, iconUrl: record.iconUrl, className: "lookup-source-portrait" }),
    t("span", { class: "lookup-source-body" }, [
      t("span", { class: "lookup-source-name" }, name),
      t("span", { class: "lookup-source-note" }, note),
    ]),
  ]);
}

/** Đoạn hiệu ứng: chữ thường xen số cấp in đậm. */
function effectParagraph(text) {
  return t("p", { class: "lookup-tactic-effect-text" }, tacticEffectSegments(text).map((segment) => (segment.strong
    ? t("strong", { class: "lookup-tactic-level" }, segment.text)
    : segment.text)));
}

/** Các phiên bản hiệu ứng có chữ (bản hiện hành trước). */
const effectVersionList = (record) => tacticEffectVersions(record).filter((version) => version.paragraphs.length);

/** Đoạn hiệu ứng của phiên bản thứ `index` (trình duyệt dựng lại khi bấm nút chọn phiên bản của hộp thoại). */
export function tacticEffectBodyTrees(record, index) {
  const version = effectVersionList(record)[index];
  return version ? version.paragraphs.map(effectParagraph) : [];
}

/**
 * Khung hiệu ứng: nút chọn phiên bản (bản hiện hành chọn sẵn), đoạn của bản đang chọn, chú thích số in đậm. Hộp thoại chỉ
 * mang đoạn của bản đang chọn (nút dựng lại đoạn từ bản ghi); trang riêng (`panels`) mang đủ mọi phiên bản, bản cũ ẩn,
 * vì trang không giữ bản ghi nào ở trình duyệt. Khi có nhiều bản, mỗi panel mở bằng nhãn của chính nó: không JavaScript
 * (CSS hiện mọi panel) và bản chữ thuần (llms) vẫn biết đoạn nào thuộc bản nào.
 */
function effectSection(record, { panels = false } = {}) {
  // Nhãn của một phiên bản (nút chọn và nhãn đầu panel dùng chung).
  const versionLabel = (version) => version.label || L("Bản hiện hành", "当前版本");
  const versions = effectVersionList(record);
  const head = [
    t("h3", { class: "lookup-section-title", id: "lookup-tactic-effect-title" }, L("Hiệu ứng", "效果")),
  ];
  if (versions.length > 1 || versions[0]?.label) {
    head.push(t("div", { class: "lookup-version-buttons", role: "group", "aria-label": L("Phiên bản hiệu ứng", "效果版本") },
      versions.map((version, index) => t("button", {
        type: "button",
        class: "lookup-version-button",
        "aria-pressed": index === 0 ? "true" : "false",
        "data-effect-version": String(index),
      }, versionLabel(version)))));
  }
  const bodies = !versions.length
    ? [t("div", { class: "lookup-tactic-effect-body" }, [t("p", { class: "lookup-prose-text is-empty" }, L("Đang cập nhật", "暂无数据"))])]
    : panels
      ? versions.map((version, index) => t("div", {
        class: "lookup-tactic-effect-body",
        "data-effect-panel": String(index),
        hidden: index === 0 ? null : true,
      }, [
        versions.length > 1 ? t("p", { class: "lookup-version-tag lookup-effect-version-label" }, versionLabel(version)) : null,
        ...version.paragraphs.map(effectParagraph),
      ]))
      : [t("div", { class: "lookup-tactic-effect-body" }, versions[0].paragraphs.map(effectParagraph))];
  const leveled = versions.some((version) => version.paragraphs.some((text) => tacticEffectSegments(text).some((part) => part.strong)));
  const notes = [
    leveled ? L("Số in đậm: giá trị ở cấp 1 → cấp tối đa.", "粗体数字：1 级 → 满级数值。") : null,
    versions.length > 1 ? L(`${versions.length} phiên bản; chọn để xem bản cũ.`, `共 ${versions.length} 个版本，可切换查看旧版。`) : null,
  ].filter(Boolean);
  return t("section", { class: "lookup-tactic-effect", "aria-labelledby": "lookup-tactic-effect-title" }, [
    t("div", { class: "lookup-tactic-effect-head" }, head),
    ...bodies,
    notes.length ? t("span", { class: "lookup-tactic-note" }, notes.join(" ")) : null,
  ]);
}

/**
 * Gắn nút chọn phiên bản hiệu ứng của hộp thoại (DOM dựng từ `effectSection`): dựng lại đoạn của bản đang chọn từ `record`.
 * Trang riêng mang đủ panel dựng sẵn và dùng `bindEffectVersionPanels` (js/lookup-effect-panels.js).
 */
export function bindTacticEffectVersions(root, record) {
  const buttons = [...root.querySelectorAll(".lookup-version-button")];
  for (const button of buttons) {
    button.addEventListener("click", () => {
      for (const other of buttons) other.setAttribute("aria-pressed", other === button ? "true" : "false");
      const index = Number(button.dataset.effectVersion);
      root.querySelector(".lookup-tactic-effect-body").replaceChildren(...tacticEffectBodyTrees(record, index).map((tree) => treeToDom(tree)));
    });
  }
}

/** Bốn ô thông số dưới đầu hồ sơ; ô không có dữ liệu hiện gạch ngang. */
function statTiles(profile) {
  const tiles = [
    [L("Tỷ lệ kích hoạt", "发动率"), fieldText(profile, "activationRate")],
    [L("Mục tiêu", "目标"), fieldText(profile, "target")],
    [L("Người mang tối đa", "最多携带人数"), fieldText(profile, "maxUsers")],
    [L("Xung đột", "冲突"), fieldText(profile, "conflictsVi")],
  ];
  return t("dl", { class: "lookup-tactic-tiles" }, tiles.map(([label, value]) => t("div", { class: "lookup-tactic-tile" }, [
    t("dt", { class: "lookup-tactic-tile-label" }, label),
    t("dd", { class: "lookup-tactic-tile-value" }, value ?? MISSING),
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
  return t("section", { class: "lookup-tactic-source", "aria-labelledby": "lookup-tactic-source-title" }, [
    t("h3", { class: "lookup-section-title", id: "lookup-tactic-source-title" }, L("Cách nhận", "获取方式")),
    ...heroes.map((row) => (row.hero ? sourceHeroCard(row) : t("p", { class: "lookup-relation-pending" }, row.pending))),
    acquired ? t("p", { class: "lookup-prose-text lookup-source-acquired" }, acquired) : null,
    !heroes.length && !acquired ? t("p", { class: "lookup-prose-text is-empty" }, L("Đang cập nhật", "暂无数据")) : null,
    facts.length ? t("dl", { class: "lookup-tactic-facts" }, facts.flatMap(([label, value]) => [
      t("dt", {}, label),
      t("dd", {}, value),
    ])) : null,
  ]);
}

/** Thân hồ sơ chiến pháp (không gồm đầu hộp thoại và khối "Trong cẩm nang"); `panels` bật đủ phiên bản hiệu ứng (trang riêng). */
export function tacticProfileBody(corpus, entryRow, profile, tail = [], { panels = false } = {}) {
  return t("div", { class: "lookup-profile lookup-tactic-profile" }, [
    statTiles(profile),
    t("div", { class: "lookup-tactic-columns" }, [effectSection(entryRow.record ?? {}, { panels }), sourceColumn(corpus, entryRow, profile)]),
    ...tail,
  ]);
}

function camNangCards(view, record, from) {
  const appearance = t("article", { class: "cam-nang-card" }, [
    t("h4", { class: "cam-nang-title" }, L("Xuất hiện trong", "出现于")),
    t("div", { class: "cam-nang-counts" }, [
      t("div", { class: "cam-nang-count" }, [
        t("span", { class: "cam-nang-number" }, String(view.standard)),
        t("span", { class: "cam-nang-unit" }, L("đội chuẩn", "支推荐阵容")),
      ]),
      t("div", { class: "cam-nang-count" }, [
        t("span", { class: "cam-nang-number" }, String(view.other)),
        t("span", { class: "cam-nang-unit" }, L("đội khác", "支其他阵容")),
      ]),
    ]),
    t("ul", { class: "cam-nang-bars" }, view.positions.map((row) => barRow(row.label, row.count, row.percent))),
  ]);
  const carriers = t("article", { class: "cam-nang-card" }, [
    t("h4", { class: "cam-nang-title" }, L("Tướng hay mang", "常见携带武将")),
    view.carriers.length
      ? t("ul", { class: "cam-nang-bars" }, view.carriers.map((item) => barRow(item.name, item.teams, item.percent)))
      : t("p", { class: "lookup-relation-pending" }, L("Chưa khớp được tướng mang.", "暂无可识别的携带武将。")),
    view.companions.length ? t("div", { class: "cam-nang-facts" }, [
      t("span", { class: "cam-nang-fact" }, [
        t("span", { class: "cam-nang-fact-label" }, L("Hay đi cùng trong đội", "常见同队战法")),
        t("span", { class: "cam-nang-fact-value" }, view.companions.map((item) => `${item.name} (${item.teams})`).join(" · ")),
      ]),
    ]) : null,
  ]);
  const query = zh() ? record.chinese : record.viet ?? record.hanViet;
  const teams = t("article", { class: "cam-nang-card" }, [
    t("h4", { class: "cam-nang-title" }, L("Đội tiêu biểu", "代表阵容")),
    t("ul", { class: "cam-nang-teams" }, view.representative.map((team) => {
      const href = representativeTeamHref(team, from);
      // Tên đội chỉ có bản Việt: bản zh dùng nhãn chung, tướng mang/mùa ở dòng phụ vẫn phân biệt từng đội.
      const name = zh() ? "查看阵容" : team.name;
      return t("li", { class: "cam-nang-team" }, [
        href ? t("a", { class: "cam-nang-team-name", href }, name) : t("span", { class: "cam-nang-team-name" }, name),
        t("span", { class: "cam-nang-team-score" }, team.score === null ? MISSING : String(team.score)),
        team.meta ? t("span", { class: "cam-nang-team-meta" }, team.meta) : null,
      ]);
    })),
    // Kết quả tìm theo tên có thể gồm đội chỉ trùng chữ trong tên đội, nên link không hứa đúng con số đếm.
    query ? t("a", { class: "cam-nang-link", href: localePath(`/doi-chuan/?${new URLSearchParams({ season: "all", q: query })}`) }, [
      L("Tìm chiến pháp này trong Đội chuẩn", "在推荐阵容中查找该战法"),
      iconTree([svgTree("line", { x1: 5, y1: 12, x2: 19, y2: 12 }), svgTree("polyline", { points: "13 6 19 12 13 18" })], { size: 15, stroke: 2 }),
    ]) : null,
  ]);
  return t("div", { class: "cam-nang-grid" }, [appearance, carriers, teams]);
}

/** Khối "Trong cẩm nang" quanh `content` (cây trạng thái hoặc lưới số liệu). */
function summaryBlockTree(content) {
  return t("section", { class: "cam-nang", "aria-labelledby": "cam-nang-title" }, [
    t("div", { class: "cam-nang-head" }, [
      t("h3", { class: "cam-nang-heading", id: "cam-nang-title" }, L("Trong cẩm nang", "攻略收录")),
      t("span", { class: "cam-nang-note" }, L("Tính từ đội chuẩn và đội khác đang có · mọi mùa", "统计自现有推荐阵容与其他阵容 · 全部赛季")),
    ]),
    ...content,
  ]);
}

/**
 * Khối "Trong cẩm nang" dựng sẵn của trang riêng: `table` là bảng số liệu đã kiểm của chiến pháp (`tactic-summaries.json`),
 * `corpus` có kho tướng để nối tên tướng mang; chiến pháp chưa vào đội nào thì khối chỉ có dòng báo.
 */
export function tacticSummaryBlockTree({ id, record, table, corpus, from }) {
  const view = tacticCamNangView(table[id], corpus);
  return summaryBlockTree(view
    ? [camNangCards(view, record, from)]
    : [t("p", { class: "lookup-summary-status", role: "status" }, L("Chưa có trong đội nào.", "尚未出现在任何阵容中。"))]);
}

/**
 * Khối "Trong cẩm nang" của chiến pháp trong hộp thoại: số liệu tải lười ở lần mở hồ sơ đầu tiên; `isCurrent()` bỏ kết quả
 * về trễ của hồ sơ đã đóng. `getCorpus()` trả corpus mới nhất (có kho tướng khi payload hồ sơ đã tải).
 */
export function tacticSummaryBlock({ id, record, summaries, getCorpus, isCurrent }) {
  const block = treeToDom(summaryBlockTree([
    t("p", { class: "lookup-summary-status", role: "status" }, L("Đang tải số liệu đội hình…", "正在加载阵容数据…")),
  ]));
  const status = block.querySelector(".lookup-summary-status");
  summaries().then((table) => {
    if (!isCurrent() || !block.isConnected) return;
    const view = tacticCamNangView(table[id], getCorpus());
    if (!view) {
      status.textContent = L("Chưa có trong đội nào.", "尚未出现在任何阵容中。");
      return;
    }
    status.remove();
    block.append(treeToDom(camNangCards(view, record)));
  }).catch(() => {
    if (!isCurrent() || !block.isConnected) return;
    status.textContent = L("Chưa tải được số liệu Trong cẩm nang.", "无法加载“攻略收录”数据。");
  });
  return block;
}
