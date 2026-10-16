// Hộp thoại hồ sơ Tra cứu (artboard LookupProfile) của tướng, chiến pháp và binh thư: tướng có cột chỉ số + thẻ
// chiến pháp + khối "Trong cẩm nang"; binh thư là một cột: đoạn văn hiệu ứng theo phiên bản (đoạn đầu nổi trong
// khung) và bảng thông số hai cột. Bốn nhóm catalog (trang bị, quân sư, cải tạo, công trình) không dùng hộp thoại mà
// có panel chi tiết riêng (`js/lookup-master.js`). Chỉ dựng DOM, không giữ state trang: `js/lookup-page.js` sở hữu
// route, lịch sử và focus.
//
// Quy tắc render (plan.md quyết định #14): dữ liệu động chỉ qua `el()`/`textContent`, không `innerHTML`.

import { el, icon, svgNode } from "./render.js";
import { LOOKUP_EMPTY, effectVersions, lookupDisplayName, lookupProfile, tacticTypeLabel, zhSafeValue } from "./lookup-detail.js";
import { L, currentLocale, localePath } from "./i18n.js";
import { heroPortrait } from "./hero-portrait.js";
import { lookupProfilePath } from "./lookup-ids.js";
import { tacticDisplayName } from "./recommended-reference-state.js";
import { barPercent, camNangView, lookupCardView, lookupGroupLabels } from "./unified-lookup.js";
import { representativeTeamHref, tacticBadges, tacticProfileBody, tacticSummaryBlock } from "./lookup-tactic-profile.js";

const MISSING = "—";
const FACTION_CODE_BY_LABEL = { "Ngụy": "nguy", "Thục": "thuc", "Ngô": "ngo", "Quần": "quan", "Hỗn hợp": "honhop", "魏": "nguy", "蜀": "thuc", "吴": "ngo", "群": "quan" };
/* Trần thanh chỉ số hồ sơ: artboard LookupProfile vẽ 81→68%, 89→74%, 91→76%, 37→31% (= giá trị/120).
   Dữ liệu thật đa số ≤100 nhưng vài tướng vượt (tới ~249); phần vượt 120 khoá đầy thanh, số vẫn in đúng. */
const STAT_BAR_MAX = 120;
/** Hướng điểm (tên Việt từ số liệu build) → chữ Trung; dạng không nhận ra trả rỗng để bản zh bỏ qua. */
const STAT_ZH = { "Trí Lực": "智力", "Võ Lực": "武力", "Thống Soái": "统率", "Tốc Độ": "速度", "Chính Trị": "政治", "Mị Lực": "魅力" };
/** Trường chữ dài: hiện thành đoạn văn thay vì một hàng của bảng thông số. */
const PROSE_KEYS = new Set(["effect"]);
/** Hàng thông số có giá trị dài hơn ngưỡng này chiếm cả hai cột của bảng. */
const WIDE_FACT_CHARS = 28;

const shown = (value) => (value === null || value === undefined || value === "" ? "" : String(zhSafeValue(value) ?? ""));
const fieldByKey = (profile, key) => profile.fields.find((field) => field.key === key) ?? null;
const valueText = (field, fallback = MISSING) => {
  if (!field) return fallback;
  const value = field.value;
  if (value === null || value === undefined || value === "") return fallback;
  return field.textVi;
};
const isEmptyText = (value) => value === null || value === undefined || value === "" || value === LOOKUP_EMPTY;

function statFocusZh(name) {
  const value = String(name ?? "").trim();
  const full = /^Toàn (.+)$/u.exec(value);
  if (full) return STAT_ZH[full[1]] ? `全${STAT_ZH[full[1]]}` : "";
  const pair = /^(.+) và (.+)$/u.exec(value);
  if (pair) return STAT_ZH[pair[1]] && STAT_ZH[pair[2]] ? `${STAT_ZH[pair[1]]}、${STAT_ZH[pair[2]]}` : "";
  return STAT_ZH[value] ?? "";
}

function barFill(percent, className) {
  const fill = el("span", { class: className });
  fill.style.width = `${percent}%`;
  return fill;
}

function revisionText(revision) {
  const parts = Object.entries(revision ?? {})
    .filter(([key, value]) => value && (key.endsWith("Vi") || ["date", "effectiveDate", "version"].includes(key)))
    .map(([, value]) => String(value));
  return parts.join(" · ") || L("Đã ghi nhận cập nhật", "已记录更新");
}

function factRow(labelVi, textVi) {
  return el("div", { class: "lookup-fact" }, [
    el("dt", { class: "lookup-fact-key" }, labelVi),
    el("dd", { class: "lookup-fact-value" }, textVi),
  ]);
}

/**
 * Bộ dựng hộp thoại hồ sơ của một trang nhóm.
 * - `group`: nhóm của trang; mục cùng nhóm mở tại chỗ qua `openInPage(id, opener)`, mục nhóm khác là link
 *   sang trang của nhóm đó.
 * - `summaries()`: số liệu "Trong cẩm nang" (tướng hoặc chiến pháp, theo nhóm của trang); `rawNames()`: bộ tra
 *   tên Hán (bản zh) hoặc `null`.
 */
export function createProfileRenderer({ group, openInPage, onClose, summaries = null, rawNames = async () => null }) {
  const labels = lookupGroupLabels();
  const zh = currentLocale() === "zh";

  /** Link/nút mở một mục khác từ hộp thoại (quan hệ, mục con). */
  function relationLink(labelText, targetGroup, id, className) {
    if (targetGroup === group) {
      const button = el("button", { type: "button", class: className }, labelText);
      button.addEventListener("click", () => openInPage(id));
      return button;
    }
    return el("a", { class: className, href: localePath(lookupProfilePath(id)) }, labelText);
  }

  function relationRow(relation) {
    return relation.resolved
      ? relationLink(`${relation.labelVi}: ${relation.titleVi}`, relation.targetGroup, relation.targetId, "lookup-child-link")
      : el("p", { class: "lookup-relation-pending" }, `${relation.labelVi}: ${relation.statusVi}`);
  }

  function statRow(labelVi, value, growthText) {
    const bar = el("span", { class: "lookup-stat-bar", "aria-hidden": "true" }, [
      barFill(barPercent(value, STAT_BAR_MAX), "lookup-stat-fill"),
    ]);
    return el("div", { class: "lookup-stat" }, [
      el("span", { class: "lookup-stat-label" }, labelVi),
      el("span", { class: "lookup-stat-value" }, value === null || value === undefined || value === "" ? MISSING : String(value)),
      bar,
      el("span", { class: "lookup-stat-growth" }, growthText || MISSING),
    ]);
  }

  /** Thẻ chiến pháp của hồ sơ (tên bấm được, phẩm, loại · dạng hiệu ứng, hiệu ứng gốc). */
  function tacticCard(corpus, relation) {
    const target = corpus.byId.get(relation.targetId);
    const card = el("article", { class: "lookup-relation-card" }, [
      el("span", { class: "lookup-relation-label" }, relation.labelVi),
    ]);
    if (!relation.resolved || !target) {
      card.append(el("p", { class: "lookup-relation-pending" }, relation.statusVi ?? LOOKUP_EMPTY));
      return card;
    }
    const record = target.record ?? {};
    const name = relationLink(lookupDisplayName(record, target.nameVi), target.group, target.id, "lookup-relation-name");
    name.dataset.lookupRelation = target.id;
    const head = el("div", { class: "lookup-relation-head" }, [name]);
    const sub = [tacticTypeLabel(record.type), shown(record.lookup?.effectTypeVi)].filter(Boolean).join(" · ");
    if (sub) head.append(el("span", { class: "lookup-relation-sub" }, sub));
    card.append(head);
    // Bản zh dùng hiệu ứng chữ Hán nguồn (`effect`), bản Việt dùng bản dịch. Thẻ chỉ hiện phiên bản hiện
    // hành; bản cũ nằm trong hồ sơ của chính chiến pháp.
    const [current] = effectVersions(zh ? record.effect : record.effectViet);
    if (current?.labelVi) card.append(el("span", { class: "lookup-version-tag" }, current.labelVi));
    if (current) card.append(el("p", { class: "lookup-relation-effect" }, current.paragraphs.join(" ")));
    return card;
  }

  /** Đoạn văn của một chữ hiệu ứng: phiên bản hiện hành mở sẵn, bản cũ gập trong `<details>`. */
  function versionNodes(value) {
    const paragraphs = (block) => block.paragraphs.map((text) => el("p", { class: "lookup-prose-text" }, text));
    const [current, ...older] = effectVersions(value);
    if (!current) return [];
    return [
      current.labelVi ? el("span", { class: "lookup-version-tag" }, current.labelVi) : null,
      ...paragraphs(current),
      ...older.map((block) => el("details", { class: "lookup-version" }, [
        el("summary", { class: "lookup-version-summary" }, block.labelVi),
        el("div", { class: "lookup-version-body" }, paragraphs(block)),
      ])),
    ].filter(Boolean);
  }

  function proseSection(field) {
    const body = isEmptyText(field.value) ? [] : versionNodes(field.textVi);
    return el("section", { class: "lookup-prose" }, [
      el("h3", { class: "lookup-section-title" }, field.labelVi),
      ...(body.length ? body : [el("p", { class: "lookup-prose-text is-empty" }, LOOKUP_EMPTY)]),
    ]);
  }

  /** Hàng bảng thông số: nhãn mờ bên trái, giá trị bên phải; giá trị dài chiếm cả hai cột, giá trị trống chữ mờ. */
  function factTile(field) {
    const row = factRow(field.labelVi, field.textVi);
    if (isEmptyText(field.value)) row.lastChild.classList.add("is-empty");
    else if (String(field.textVi).length > WIDE_FACT_CHARS) row.classList.add("is-wide");
    return row;
  }

  /** Bảng vai trò / danh hiệu / đặc tính theo artboard LookupProfile, cùng các trường hồ sơ tướng khác khi có. */
  function heroFacts(profile) {
    const rows = [
      [L("Vai trò", "定位"), valueText(fieldByKey(profile, "roleTagViet"), "")],
      [L("Danh hiệu độc quyền", "专属称号"), valueText(fieldByKey(profile, "exclusiveTitleVi"), "")],
      [L("Đặc tính", "特性"), valueText(fieldByKey(profile, "flags"), "")],
      // Nhãn do hồ sơ (`lookup-detail.js`) đặt; trường vắng thì `fieldByKey` trả null và dòng bị bỏ.
      ...["civilInnatePoints", "collectibleBonusVi", "redRulesVi"].map((key) => {
        const field = fieldByKey(profile, key);
        return [field?.labelVi, valueText(field, "")];
      }),
    ].filter(([, value]) => value);
    if (!rows.length) return null;
    return el("dl", { class: "lookup-dialog-facts" }, rows.map(([labelVi, textVi]) => factRow(labelVi, textVi)));
  }

  /** Ảnh + tên + huy hiệu của hộp thoại (mọi nhóm). */
  function dialogHeader(entryRow, profile) {
    const record = entryRow.record ?? {};
    const view = lookupCardView(entryRow.group, entryRow);
    const chinese = view.chinese;
    const tactic = entryRow.group === "tactics";
    const eyebrow = [labels[entryRow.group], tactic ? tacticTypeLabel(record.type) : shown(record.lookup?.categoryVi ?? record.qualityVi ?? record.slotVi ?? record.elementVi)]
      .filter(Boolean).join(" · ");
    const badges = el("div", { class: "lookup-dialog-badges" });
    if (view.variant) badges.append(el("span", { class: "badge badge-band" }, view.variant));
    if (view.faction) badges.append(el("span", { class: `badge faction f-${FACTION_CODE_BY_LABEL[view.faction] ?? "none"}` }, view.faction));
    if (view.stars) badges.append(el("span", { class: "badge badge-fill" }, view.stars));
    if (record.cost) badges.append(el("span", { class: "badge badge-fill" }, L(`Thống ngự ${record.cost}`, `统御 ${record.cost}`)));
    // Chiến pháp: phẩm · loại · binh chủng · dạng hiệu ứng (artboard LookupTacticProfile).
    if (tactic) badges.append(...tacticBadges(record, profile));
    // Tướng: hạng mục (badge 'Quân sự' của artboard); nhóm khác: phẩm của chính mục.
    const grade = tactic ? "" : shown(entryRow.group === "heroes" ? record.lookup?.categoryVi : record.quality);
    if (grade) badges.append(entryRow.group === "heroes"
      ? el("span", { class: "badge badge-fill" }, String(grade))
      : el("span", { class: "lookup-quality" }, String(grade)));
    const close = el("button", { type: "button", class: "lookup-close", "aria-label": L("Đóng hồ sơ", "关闭详情") }, [
      icon([
        svgNode("line", { x1: 6, y1: 6, x2: 18, y2: 18 }),
        svgNode("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
      ], { size: 20 }),
    ]);
    close.addEventListener("click", () => onClose());
    const header = el("header", { class: "lookup-dialog-head" }, [
      heroPortrait({ chinese, nameVi: profile.titleVi, iconUrl: record.iconUrl, className: "lookup-dialog-portrait" }),
      el("div", { class: "lookup-dialog-ident" }, [
        el("span", { class: "lookup-dialog-eyebrow" }, eyebrow),
        el("div", { class: "lookup-dialog-titles" }, [
          el("h2", { class: "lookup-dialog-title", id: "lookup-dialog-title" }, profile.titleVi),
          // Bản zh: tiêu đề đã là chữ Hán, không lặp lại dòng chữ Hán phụ.
          chinese && !zh ? el("span", { class: "lookup-dialog-zh", lang: "zh-Hant" }, chinese) : null,
        ]),
        badges.childElementCount ? badges : null,
        heroFacts(profile),
      ]),
      close,
    ]);
    return { element: header, close };
  }

  /** Cột trái hồ sơ tướng: sáu chỉ số có thanh + tăng trưởng, thích tính binh chủng. */
  function heroStats(profile) {
    const growth = new Map((profile.sections.find((section) => section.key === "growth")?.fields ?? [])
      .map((item) => [item.key, item.value]));
    const rows = ["luc", "tri", "thong", "toc", "chinh", "mi"].map((key) => {
      const field = fieldByKey(profile, key);
      if (!field) return null;
      const perLevel = growth.get(key);
      const growthText = perLevel === null || perLevel === undefined || perLevel === ""
        ? MISSING
        : `${Number(perLevel) > 0 ? "+" : ""}${perLevel} ${L("/ cấp", "/ 级")}`;
      return statRow(field.labelVi, field.value, growthText);
    }).filter(Boolean);
    const block = el("section", { class: "lookup-profile-section" }, [
      el("h3", { class: "lookup-section-title" }, L("Chỉ số", "属性")),
      el("div", { class: "lookup-stats" }, rows),
    ]);
    const aptitudes = profile.aptitudes.filter((item) => item && item.value);
    if (aptitudes.length) {
      block.append(el("h3", { class: "lookup-section-title" }, L("Thích tính binh chủng", "兵种适性")));
      block.append(el("div", { class: "lookup-aptitudes" }, aptitudes.map((item) => el("div", {
        class: "lookup-aptitude",
        dataset: { grade: String(item.textVi) },
      }, [
        el("span", { class: "lookup-aptitude-grade" }, item.textVi),
        el("span", { class: "lookup-aptitude-label" }, item.labelVi),
      ]))));
    }
    return block;
  }

  function listBlock(titleVi, rows, className) {
    if (!rows.length) return null;
    return el("section", { class: "lookup-profile-section" }, [
      el("h3", { class: "lookup-section-title" }, titleVi),
      el("div", { class: className }, rows),
    ]);
  }

  /** "Cách nhận" của tướng: mỗi gói một hàng trải hết bề ngang (nhãn gói · giá trị lõi/tỉ lệ). */
  function cardPackBlock(section) {
    return el("section", { class: "lookup-profile-section" }, [
      el("h3", { class: "lookup-section-title" }, section.titleVi),
      el("dl", { class: "lookup-fact-grid" }, section.fields.map((field) => {
        const row = factRow(field.labelVi, field.textVi);
        row.classList.add("is-wide");
        return row;
      })),
    ]);
  }

  function camNangCards(view, rawName) {
    /** Danh sách tên cho bản đang xem; bản zh bỏ tên không tra được chữ Hán để không trộn ngôn ngữ. */
    const localNames = (items) => (zh
      ? items.map((item) => ({ ...item, name: rawName ? rawName(item.name) : null })).filter((item) => item.name)
      : items);
    const appearance = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, L("Xuất hiện trong", "出现于")),
      // Số đếm chỉ là số liệu: link "Tìm tướng này trong Đội chuẩn" (thẻ Đội tiêu biểu) mới dẫn sang danh sách,
      // vì kết quả tìm theo tên không trùng khớp con số đếm theo vị trí tướng.
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
      el("ul", { class: "cam-nang-bars" }, view.positions.map((row) => el("li", { class: "cam-nang-bar" }, [
        el("span", { class: "cam-nang-bar-label" }, row.label),
        el("span", { class: "cam-nang-bar-value" }, String(row.count)),
        el("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [
          barFill(row.percent, "cam-nang-bar-fill"),
        ]),
      ]))),
    ]);
    const books = localNames(view.books.items);
    const statFocus = zh ? view.statFocus.items.map((item) => ({ ...item, name: statFocusZh(item.name) })).filter((item) => item.name) : view.statFocus.items;
    const tactics = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, L("Chiến pháp hay mang", "常带战法")),
      el("ul", { class: "cam-nang-bars" }, localNames(view.tactics).map((item) => ({ ...item, name: tacticDisplayName(item.name) })).map((item) => el("li", { class: "cam-nang-bar" }, [
        el("span", { class: "cam-nang-bar-label" }, item.name),
        el("span", { class: "cam-nang-bar-value" }, String(item.teams)),
        el("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [
          barFill(item.percent, "cam-nang-bar-fill"),
        ]),
      ]))),
      el("div", { class: "cam-nang-facts" }, [
        books.length ? el("span", { class: "cam-nang-fact" }, [
          el("span", { class: "cam-nang-fact-label" }, zh
            ? `常用兵书（${view.books.teams} 支阵容）`
            : ["Binh thư hay dùng (", String(view.books.teams), " đội)"]),
          el("span", { class: "cam-nang-fact-value" }, books.map((item) => item.name).join(" · ")),
        ]) : null,
        statFocus.length ? el("span", { class: "cam-nang-fact" }, [
          el("span", { class: "cam-nang-fact-label" }, zh
            ? `常用加点（${view.statFocus.teams} 支阵容）`
            : ["Hướng điểm hay dùng (", String(view.statFocus.teams), " đội)"]),
          el("span", { class: "cam-nang-fact-value" }, statFocus.map((item) => item.name).join(" · ")),
        ]) : null,
      ].filter(Boolean)),
    ]);
    const teams = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, L("Đội tiêu biểu", "代表阵容")),
      el("ul", { class: "cam-nang-teams" }, view.representative.map((team) => {
        const href = representativeTeamHref(team);
        // Tên đội chỉ có bản Việt: bản zh dùng nhãn chung, mùa/vị trí ở dòng phụ vẫn phân biệt từng đội.
        const name = zh ? "查看阵容" : team.name;
        return el("li", { class: "cam-nang-team" }, [
          href
            ? el("a", { class: "cam-nang-team-name", href }, name)
            : el("span", { class: "cam-nang-team-name" }, name),
          el("span", { class: "cam-nang-team-score" }, team.score === null ? MISSING : String(team.score)),
          el("span", { class: "cam-nang-team-meta" }, [team.seasonLabel, team.positionLabel].filter(Boolean).join(" · ")),
        ]);
      })),
      el("a", { class: "cam-nang-link", href: localePath(`/doi-chuan/?${new URLSearchParams({ season: "all", q: view.searchName })}`) }, [
        L("Tìm tướng này trong Đội chuẩn", "在推荐阵容中查找该武将"),
        icon([svgNode("line", { x1: 5, y1: 12, x2: 19, y2: 12 }), svgNode("polyline", { points: "13 6 19 12 13 18" })], { size: 15, stroke: 2 }),
      ]),
    ]);
    return el("div", { class: "cam-nang-grid" }, [appearance, tactics, teams]);
  }

  /** Khối "Trong cẩm nang": số liệu tính lúc build, chỉ tải khi mở hồ sơ đầu tiên. */
  function summaryBlock(id, isCurrent) {
    const block = el("section", { class: "cam-nang", "aria-labelledby": "cam-nang-title" }, [
      el("div", { class: "cam-nang-head" }, [
        el("h3", { class: "cam-nang-heading", id: "cam-nang-title" }, L("Trong cẩm nang", "攻略收录")),
        el("span", { class: "cam-nang-note" }, L("Tính từ đội chuẩn và đội khác đang có · mọi mùa", "统计自现有推荐阵容与其他阵容 · 全部赛季")),
      ]),
    ]);
    const status = el("p", { class: "lookup-summary-status", role: "status" }, L("Đang tải số liệu đội hình…", "正在加载阵容数据…"));
    block.append(status);
    Promise.all([summaries(), zh ? rawNames().catch(() => null) : null]).then(([table, rawName]) => {
      if (!isCurrent() || !block.isConnected) return;
      const view = camNangView(table[id]);
      if (!view) {
        status.textContent = L("Chưa có trong đội nào.", "尚未出现在任何阵容中。");
        return;
      }
      status.remove();
      block.append(camNangCards(view, rawName));
    }).catch(() => {
      if (!isCurrent() || !block.isConnected) return;
      status.textContent = L("Chưa tải được số liệu Trong cẩm nang.", "无法加载“攻略收录”数据。");
    });
    return block;
  }

  /**
   * Hộp thoại hồ sơ `id` trên `corpus` (payload đã có); `null` khi mã không có trong corpus.
   * `isCurrent()` cho biết hộp thoại còn là hộp thoại đang mở (bỏ kết quả tải trễ của hồ sơ cũ).
   */
  return function renderProfile(corpus, id, isCurrent) {
    const profile = lookupProfile(corpus, id);
    const entryRow = corpus.byId.get(id);
    if (!profile || !entryRow) return null;
    const dialog = el("article", { class: "lookup-dialog", role: "dialog", "aria-modal": "true", tabindex: "-1", "aria-labelledby": "lookup-dialog-title" });
    const { element: header, close } = dialogHeader(entryRow, profile);
    let body = el("div", { class: "lookup-profile" });
    const conditions = listBlock(L("Điều kiện", "条件"), profile.conditions.map((text) => el("p", { class: "lookup-child-row" }, text)), "lookup-children");
    // Bản zh đã bỏ nội dung chỉ có chữ Việt: báo một dòng để người đọc biết hồ sơ chưa đầy đủ.
    const zhNote = profile.viOnly ? el("p", { class: "lookup-child-row lookup-zh-note" }, "部分说明暂无中文原文，未在此显示。") : null;
    if (entryRow.group === "tactics") {
      body = tacticProfileBody(corpus, entryRow, profile, [conditions, zhNote].filter(Boolean));
    } else if (entryRow.group === "heroes") {
      const revisions = listBlock(L("Lịch sử cập nhật", "更新记录"), profile.revisions.map((revision) => el("p", { class: "lookup-child-row" }, revisionText(revision))), "lookup-children");
      const tail = [conditions, revisions, zhNote].filter(Boolean);
      const tacticRelations = profile.relations.filter((relation) => relation.key === "selfTactic" || relation.key === "inheritTactic");
      const right = el("div", { class: "lookup-profile-column" });
      for (const relation of tacticRelations) right.append(tacticCard(corpus, relation));
      for (const relation of profile.relations.filter((item) => !tacticRelations.includes(item))) right.append(relationRow(relation));
      const usage = fieldByKey(profile, "usage");
      if (usage) right.append(proseSection(usage));
      const cardPacks = profile.sections.find((section) => section.key === "cardPacks");
      if (cardPacks) right.append(cardPackBlock(cardPacks));
      body.append(el("div", { class: "lookup-profile-column" }, [heroStats(profile)]), right, ...tail);
    } else {
      // Binh thư (bốn nhóm catalog dùng panel chi tiết của `js/lookup-master.js`): đoạn văn hiệu ứng rồi bảng thông số.
      const prose = profile.fields.filter((item) => PROSE_KEYS.has(item.key));
      const facts = profile.fields.filter((item) => !PROSE_KEYS.has(item.key));
      body.classList.add("lookup-profile-entry");
      body.append(...[
        ...prose.map(proseSection),
        facts.length ? el("dl", { class: "lookup-fact-grid" }, facts.map(factTile)) : null,
        conditions,
        zhNote,
      ].filter(Boolean));
      body.querySelector(".lookup-prose")?.classList.add("is-lead");
    }
    dialog.append(header, body);
    if (entryRow.group === "heroes" && summaries) dialog.append(summaryBlock(id, isCurrent));
    if (entryRow.group === "tactics" && summaries) {
      dialog.classList.add("is-tactic");
      dialog.append(tacticSummaryBlock({ id, record: entryRow.record ?? {}, summaries, getCorpus: () => corpus, isCurrent }));
    }
    return { dialog, close };
  };
}
