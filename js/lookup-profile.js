// Hồ sơ Tra cứu (artboard LookupProfile) của tướng, chiến pháp và binh thư: tướng có cột chỉ số + thẻ
// chiến pháp + khối "Trong cẩm nang"; binh thư là một cột: đoạn văn hiệu ứng theo phiên bản (đoạn đầu nổi trong
// khung) và bảng thông số hai cột. Bốn nhóm catalog (trang bị, quân sư, cải tạo, công trình) không dùng hộp thoại mà
// có panel chi tiết riêng (`js/lookup-master.js`). Không giữ state trang: `js/lookup-page.js` sở hữu
// route, lịch sử và focus.
//
// Mọi khối là cây view (`js/view-tree.js`, không DOM) nên cùng một định nghĩa dựng cả hai nơi: hộp thoại của trình duyệt
// (`renderProfile`: `treeToDom` rồi gắn sự kiện) và trang riêng từng mục dựng lúc build (`profilePageTree` + `treeToHtml`).
// Khác biệt hộp thoại ↔ trang riêng chỉ có: nút đóng, thẻ `h1`/`h2`, quan hệ cùng nhóm là nút (hộp thoại) hay link tới trang riêng.
//
// Quy tắc render (plan.md quyết định #14): dữ liệu động chỉ qua cây view, không `innerHTML`.

import { t, iconTree, svgTree } from "./render.js";
import { effectVersions, lookupDisplayName, lookupEmpty, lookupProfile, tacticTypeLabel, zhSafeValue } from "./lookup-detail.js";
import { L, currentLocale, localePath } from "./i18n.js";
import { portraitTree } from "./hero-portrait.js";
import { lookupHref } from "./lookup-ids.js";
import { tacticDisplayName } from "./recommended-reference-state.js";
import { treeToDom } from "./view-tree.js";
import { barPercent, camNangView, lookupCardView, lookupGroupLabels } from "./unified-lookup.js";
import {
  bindTacticEffectVersions,
  representativeTeamHref,
  tacticBadges,
  tacticProfileBody,
  tacticSummaryBlock,
  tacticSummaryBlockTree,
} from "./lookup-tactic-profile.js";

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
const isEmptyText = (value) => value === null || value === undefined || value === "" || value === lookupEmpty();

function statFocusZh(name) {
  const value = String(name ?? "").trim();
  const full = /^Toàn (.+)$/u.exec(value);
  if (full) return STAT_ZH[full[1]] ? `全${STAT_ZH[full[1]]}` : "";
  const pair = /^(.+) và (.+)$/u.exec(value);
  if (pair) return STAT_ZH[pair[1]] && STAT_ZH[pair[2]] ? `${STAT_ZH[pair[1]]}、${STAT_ZH[pair[2]]}` : "";
  return STAT_ZH[value] ?? "";
}

const barFill = (percent, className) => t("span", { class: className, style: `width: ${percent}%;` });

function revisionText(revision) {
  const parts = Object.entries(revision ?? {})
    .filter(([key, value]) => value && (key.endsWith("Vi") || ["date", "effectiveDate", "version"].includes(key)))
    .map(([, value]) => String(value));
  return parts.join(" · ") || L("Đã ghi nhận cập nhật", "已记录更新");
}

function factRow(labelVi, textVi, className = "lookup-fact") {
  return t("div", { class: className }, [
    t("dt", { class: "lookup-fact-key" }, labelVi),
    t("dd", { class: "lookup-fact-value" }, textVi),
  ]);
}

/**
 * Bộ dựng hồ sơ của một trang nhóm.
 * - `group`: nhóm của trang; mục cùng nhóm mở tại chỗ qua `openInPage(id, opener)`, mục nhóm khác là link
 *   sang trang riêng của mục đó.
 * - `summaries()`: số liệu "Trong cẩm nang" (tướng hoặc chiến pháp, theo nhóm của trang); `rawNames()`: bộ tra
 *   tên Hán (bản zh) hoặc `null`.
 * Trả `{renderProfile, profilePageTree}`: hộp thoại DOM cho trình duyệt và cây view của trang riêng cho build.
 */
export function createProfileRenderer({ group, openInPage, onClose, summaries = null, rawNames = async () => null }) {
  const labels = lookupGroupLabels();
  const zh = currentLocale() === "zh";

  /**
   * Link/nút mở một mục khác (quan hệ, mục con). Trong hộp thoại, mục cùng nhóm là nút mở tại chỗ (gắn sự kiện qua
   * `data-lookup-open`); ở trang riêng và với nhóm khác là link tới trang riêng của mục.
   */
  function relationLink(labelText, targetGroup, id, className, { page = false, attrs = {} } = {}) {
    if (targetGroup === group && !page) {
      return t("button", { type: "button", class: className, "data-lookup-open": id, ...attrs }, labelText);
    }
    return t("a", { class: className, href: localePath(lookupHref(id)), ...attrs }, labelText);
  }

  function relationRow(relation, page) {
    return relation.resolved
      ? relationLink(`${relation.labelVi}: ${relation.titleVi}`, relation.targetGroup, relation.targetId, "lookup-child-link", { page })
      : t("p", { class: "lookup-relation-pending" }, `${relation.labelVi}: ${relation.statusVi}`);
  }

  function statRow(labelVi, value, growthText) {
    const bar = t("span", { class: "lookup-stat-bar", "aria-hidden": "true" }, [
      barFill(barPercent(value, STAT_BAR_MAX), "lookup-stat-fill"),
    ]);
    return t("div", { class: "lookup-stat" }, [
      t("span", { class: "lookup-stat-label" }, labelVi),
      t("span", { class: "lookup-stat-value" }, value === null || value === undefined || value === "" ? MISSING : String(value)),
      bar,
      t("span", { class: "lookup-stat-growth" }, growthText || MISSING),
    ]);
  }

  /** Thẻ chiến pháp của hồ sơ (tên bấm được, phẩm, loại · dạng hiệu ứng, hiệu ứng gốc). */
  function tacticCard(corpus, relation, page) {
    const target = corpus.byId.get(relation.targetId);
    const label = t("span", { class: "lookup-relation-label" }, relation.labelVi);
    if (!relation.resolved || !target) {
      return t("article", { class: "lookup-relation-card" }, [
        label,
        t("p", { class: "lookup-relation-pending" }, relation.statusVi ?? lookupEmpty()),
      ]);
    }
    const record = target.record ?? {};
    const name = relationLink(lookupDisplayName(record, target.nameVi), target.group, target.id, "lookup-relation-name", {
      page,
      attrs: { "data-lookup-relation": target.id },
    });
    const sub = [tacticTypeLabel(record.type), shown(record.lookup?.effectTypeVi)].filter(Boolean).join(" · ");
    // Bản zh dùng hiệu ứng chữ Hán nguồn (`effect`), bản Việt dùng bản dịch. Thẻ chỉ hiện phiên bản hiện
    // hành; bản cũ nằm trong hồ sơ của chính chiến pháp.
    const [current] = effectVersions(zh ? record.effect : record.effectViet);
    return t("article", { class: "lookup-relation-card" }, [
      label,
      t("div", { class: "lookup-relation-head" }, [name, sub ? t("span", { class: "lookup-relation-sub" }, sub) : null]),
      current?.labelVi ? t("span", { class: "lookup-version-tag" }, current.labelVi) : null,
      current ? t("p", { class: "lookup-relation-effect" }, current.paragraphs.join(" ")) : null,
    ]);
  }

  /** Đoạn văn của một chữ hiệu ứng: phiên bản hiện hành mở sẵn, bản cũ gập trong `<details>`. */
  function versionNodes(value) {
    const paragraphs = (block) => block.paragraphs.map((text) => t("p", { class: "lookup-prose-text" }, text));
    const [current, ...older] = effectVersions(value);
    if (!current) return [];
    return [
      current.labelVi ? t("span", { class: "lookup-version-tag" }, current.labelVi) : null,
      ...paragraphs(current),
      ...older.map((block) => t("details", { class: "lookup-version" }, [
        t("summary", { class: "lookup-version-summary" }, block.labelVi),
        t("div", { class: "lookup-version-body" }, paragraphs(block)),
      ])),
    ].filter(Boolean);
  }

  function proseSection(field, lead = false) {
    const body = isEmptyText(field.value) ? [] : versionNodes(field.textVi);
    return t("section", { class: lead ? "lookup-prose is-lead" : "lookup-prose" }, [
      t("h3", { class: "lookup-section-title" }, field.labelVi),
      ...(body.length ? body : [t("p", { class: "lookup-prose-text is-empty" }, lookupEmpty())]),
    ]);
  }

  /** Hàng bảng thông số: nhãn mờ bên trái, giá trị bên phải; giá trị dài chiếm cả hai cột, giá trị trống chữ mờ. */
  function factTile(field) {
    const empty = isEmptyText(field.value);
    const wide = !empty && String(field.textVi).length > WIDE_FACT_CHARS;
    return t("div", { class: wide ? "lookup-fact is-wide" : "lookup-fact" }, [
      t("dt", { class: "lookup-fact-key" }, field.labelVi),
      t("dd", { class: empty ? "lookup-fact-value is-empty" : "lookup-fact-value" }, field.textVi),
    ]);
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
    return t("dl", { class: "lookup-dialog-facts" }, rows.map(([labelVi, textVi]) => factRow(labelVi, textVi)));
  }

  /** Ảnh + tên + huy hiệu của hồ sơ (mọi nhóm); hộp thoại có nút đóng, trang riêng có `h1` và không có nút đóng. */
  function dialogHeader(entryRow, profile, page) {
    const record = entryRow.record ?? {};
    const view = lookupCardView(entryRow.group, entryRow);
    const chinese = view.chinese;
    const tactic = entryRow.group === "tactics";
    const eyebrow = [labels[entryRow.group], tactic ? tacticTypeLabel(record.type) : shown(record.lookup?.categoryVi ?? record.qualityVi ?? record.slotVi ?? record.elementVi)]
      .filter(Boolean).join(" · ");
    const badges = [];
    if (view.variant) badges.push(t("span", { class: "badge badge-band" }, view.variant));
    if (view.faction) badges.push(t("span", { class: `badge faction f-${FACTION_CODE_BY_LABEL[view.faction] ?? "none"}` }, view.faction));
    if (view.stars) badges.push(t("span", { class: "badge badge-fill" }, view.stars));
    if (record.cost) badges.push(t("span", { class: "badge badge-fill" }, L(`Thống ngự ${record.cost}`, `统御 ${record.cost}`)));
    // Chiến pháp: phẩm · loại · binh chủng · dạng hiệu ứng (artboard LookupTacticProfile).
    if (tactic) badges.push(...tacticBadges(record, profile));
    // Tướng: hạng mục (badge 'Quân sự' của artboard); nhóm khác: phẩm của chính mục.
    const grade = tactic ? "" : shown(entryRow.group === "heroes" ? record.lookup?.categoryVi : record.quality);
    if (grade) badges.push(entryRow.group === "heroes"
      ? t("span", { class: "badge badge-fill" }, String(grade))
      : t("span", { class: "lookup-quality" }, String(grade)));
    const close = page ? null : t("button", { type: "button", class: "lookup-close", "aria-label": L("Đóng hồ sơ", "关闭详情") }, [
      iconTree([
        svgTree("line", { x1: 6, y1: 6, x2: 18, y2: 18 }),
        svgTree("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
      ], { size: 20 }),
    ]);
    return t("header", { class: "lookup-dialog-head" }, [
      portraitTree({ chinese, nameVi: profile.titleVi, iconUrl: record.iconUrl, className: "lookup-dialog-portrait" }),
      t("div", { class: "lookup-dialog-ident" }, [
        t("span", { class: "lookup-dialog-eyebrow" }, eyebrow),
        t("div", { class: "lookup-dialog-titles" }, [
          t(page ? "h1" : "h2", { class: "lookup-dialog-title", id: "lookup-dialog-title" }, profile.titleVi),
          // Bản zh: tiêu đề đã là chữ Hán, không lặp lại dòng chữ Hán phụ.
          chinese && !zh ? t("span", { class: "lookup-dialog-zh", lang: "zh-Hant" }, chinese) : null,
        ]),
        badges.length ? t("div", { class: "lookup-dialog-badges" }, badges) : null,
        heroFacts(profile),
      ]),
      close,
    ]);
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
    const aptitudes = profile.aptitudes.filter((item) => item && item.value);
    return t("section", { class: "lookup-profile-section" }, [
      t("h3", { class: "lookup-section-title" }, L("Chỉ số", "属性")),
      t("div", { class: "lookup-stats" }, rows),
      aptitudes.length ? t("h3", { class: "lookup-section-title" }, L("Thích tính binh chủng", "兵种适性")) : null,
      aptitudes.length ? t("div", { class: "lookup-aptitudes" }, aptitudes.map((item) => t("div", {
        class: "lookup-aptitude",
        "data-grade": String(item.textVi),
      }, [
        t("span", { class: "lookup-aptitude-grade" }, item.textVi),
        t("span", { class: "lookup-aptitude-label" }, item.labelVi),
      ]))) : null,
    ]);
  }

  function listBlock(titleVi, rows, className) {
    if (!rows.length) return null;
    return t("section", { class: "lookup-profile-section" }, [
      t("h3", { class: "lookup-section-title" }, titleVi),
      t("div", { class: className }, rows),
    ]);
  }

  /** "Cách nhận" của tướng: mỗi gói một hàng trải hết bề ngang (nhãn gói · giá trị lõi/tỉ lệ). */
  function cardPackBlock(section) {
    return t("section", { class: "lookup-profile-section" }, [
      t("h3", { class: "lookup-section-title" }, section.titleVi),
      t("dl", { class: "lookup-fact-grid" }, section.fields.map((field) => factRow(field.labelVi, field.textVi, "lookup-fact is-wide"))),
    ]);
  }

  function camNangCards(view, rawName, from) {
    /** Danh sách tên cho bản đang xem; bản zh bỏ tên không tra được chữ Hán để không trộn ngôn ngữ. */
    const localNames = (items) => (zh
      ? items.map((item) => ({ ...item, name: rawName ? rawName(item.name) : null })).filter((item) => item.name)
      : items);
    const appearance = t("article", { class: "cam-nang-card" }, [
      t("h4", { class: "cam-nang-title" }, L("Xuất hiện trong", "出现于")),
      // Số đếm chỉ là số liệu: link "Tìm tướng này trong Đội chuẩn" (thẻ Đội tiêu biểu) mới dẫn sang danh sách,
      // vì kết quả tìm theo tên không trùng khớp con số đếm theo vị trí tướng.
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
      t("ul", { class: "cam-nang-bars" }, view.positions.map((row) => t("li", { class: "cam-nang-bar" }, [
        t("span", { class: "cam-nang-bar-label" }, row.label),
        t("span", { class: "cam-nang-bar-value" }, String(row.count)),
        t("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [
          barFill(row.percent, "cam-nang-bar-fill"),
        ]),
      ]))),
    ]);
    const books = localNames(view.books.items);
    const statFocus = zh ? view.statFocus.items.map((item) => ({ ...item, name: statFocusZh(item.name) })).filter((item) => item.name) : view.statFocus.items;
    const tactics = t("article", { class: "cam-nang-card" }, [
      t("h4", { class: "cam-nang-title" }, L("Chiến pháp hay mang", "常带战法")),
      t("ul", { class: "cam-nang-bars" }, localNames(view.tactics).map((item) => ({ ...item, name: tacticDisplayName(item.name) })).map((item) => t("li", { class: "cam-nang-bar" }, [
        t("span", { class: "cam-nang-bar-label" }, item.name),
        t("span", { class: "cam-nang-bar-value" }, String(item.teams)),
        t("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [
          barFill(item.percent, "cam-nang-bar-fill"),
        ]),
      ]))),
      t("div", { class: "cam-nang-facts" }, [
        books.length ? t("span", { class: "cam-nang-fact" }, [
          t("span", { class: "cam-nang-fact-label" }, zh
            ? `常用兵书（${view.books.teams} 支阵容）`
            : ["Binh thư hay dùng (", String(view.books.teams), " đội)"]),
          t("span", { class: "cam-nang-fact-value" }, books.map((item) => item.name).join(" · ")),
        ]) : null,
        statFocus.length ? t("span", { class: "cam-nang-fact" }, [
          t("span", { class: "cam-nang-fact-label" }, zh
            ? `常用加点（${view.statFocus.teams} 支阵容）`
            : ["Hướng điểm hay dùng (", String(view.statFocus.teams), " đội)"]),
          t("span", { class: "cam-nang-fact-value" }, statFocus.map((item) => item.name).join(" · ")),
        ]) : null,
      ].filter(Boolean)),
    ]);
    const teams = t("article", { class: "cam-nang-card" }, [
      t("h4", { class: "cam-nang-title" }, L("Đội tiêu biểu", "代表阵容")),
      t("ul", { class: "cam-nang-teams" }, view.representative.map((team) => {
        const href = representativeTeamHref(team, from);
        // Tên đội chỉ có bản Việt: bản zh dùng nhãn chung, mùa/vị trí ở dòng phụ vẫn phân biệt từng đội.
        const name = zh ? "查看阵容" : team.name;
        return t("li", { class: "cam-nang-team" }, [
          href
            ? t("a", { class: "cam-nang-team-name", href }, name)
            : t("span", { class: "cam-nang-team-name" }, name),
          t("span", { class: "cam-nang-team-score" }, team.score === null ? MISSING : String(team.score)),
          t("span", { class: "cam-nang-team-meta" }, [team.seasonLabel, team.positionLabel].filter(Boolean).join(" · ")),
        ]);
      })),
      t("a", { class: "cam-nang-link", href: localePath(`/doi-chuan/?${new URLSearchParams({ season: "all", q: view.searchName })}`) }, [
        L("Tìm tướng này trong Đội chuẩn", "在推荐阵容中查找该武将"),
        iconTree([svgTree("line", { x1: 5, y1: 12, x2: 19, y2: 12 }), svgTree("polyline", { points: "13 6 19 12 13 18" })], { size: 15, stroke: 2 }),
      ]),
    ]);
    return t("div", { class: "cam-nang-grid" }, [appearance, tactics, teams]);
  }

  /** Khối "Trong cẩm nang" quanh `content`. */
  function summaryBlockTree(content) {
    return t("section", { class: "cam-nang", "aria-labelledby": "cam-nang-title" }, [
      t("div", { class: "cam-nang-head" }, [
        t("h3", { class: "cam-nang-heading", id: "cam-nang-title" }, L("Trong cẩm nang", "攻略收录")),
        t("span", { class: "cam-nang-note" }, L("Tính từ đội chuẩn và đội khác đang có · mọi mùa", "统计自现有推荐阵容与其他阵容 · 全部赛季")),
      ]),
      ...content,
    ]);
  }

  /** Khối "Trong cẩm nang" của hộp thoại: số liệu tính lúc build, chỉ tải khi mở hồ sơ đầu tiên. */
  function summaryBlock(id, isCurrent) {
    const block = treeToDom(summaryBlockTree([
      t("p", { class: "lookup-summary-status", role: "status" }, L("Đang tải số liệu đội hình…", "正在加载阵容数据…")),
    ]));
    const status = block.querySelector(".lookup-summary-status");
    Promise.all([summaries(), zh ? rawNames().catch(() => null) : null]).then(([table, rawName]) => {
      if (!isCurrent() || !block.isConnected) return;
      const view = camNangView(table[id]);
      if (!view) {
        status.textContent = L("Chưa có trong đội nào.", "尚未出现在任何阵容中。");
        return;
      }
      status.remove();
      block.append(treeToDom(camNangCards(view, rawName)));
    }).catch(() => {
      if (!isCurrent() || !block.isConnected) return;
      status.textContent = L("Chưa tải được số liệu Trong cẩm nang.", "无法加载“攻略收录”数据。");
    });
    return block;
  }

  /** Khối "Trong cẩm nang" dựng sẵn của trang riêng một tướng từ bảng số liệu đã kiểm. */
  function heroSummaryTree(id, table, rawName, from) {
    const view = camNangView(table[id]);
    return summaryBlockTree(view
      ? [camNangCards(view, rawName, from)]
      : [t("p", { class: "lookup-summary-status", role: "status" }, L("Chưa có trong đội nào.", "尚未出现在任何阵容中。"))]);
  }

  /**
   * Đầu + thân của hồ sơ `id` (cây); `null` khi mã không có trong corpus. `page` bỏ nút đóng, đầu là `h1`, quan hệ
   * cùng nhóm là link tới trang riêng và chiến pháp mang đủ phiên bản hiệu ứng.
   */
  function profileParts(corpus, id, page) {
    const profile = lookupProfile(corpus, id);
    const entryRow = corpus.byId.get(id);
    if (!profile || !entryRow) return null;
    const header = dialogHeader(entryRow, profile, page);
    let body;
    const conditions = listBlock(L("Điều kiện", "条件"), profile.conditions.map((text) => t("p", { class: "lookup-child-row" }, text)), "lookup-children");
    // Bản zh đã bỏ nội dung chỉ có chữ Việt: báo một dòng để người đọc biết hồ sơ chưa đầy đủ.
    const zhNote = profile.viOnly ? t("p", { class: "lookup-child-row lookup-zh-note" }, "部分说明暂无中文原文，未在此显示。") : null;
    if (entryRow.group === "tactics") {
      body = tacticProfileBody(corpus, entryRow, profile, [conditions, zhNote].filter(Boolean), { panels: page });
    } else if (entryRow.group === "heroes") {
      const revisions = listBlock(L("Lịch sử cập nhật", "更新记录"), profile.revisions.map((revision) => t("p", { class: "lookup-child-row" }, revisionText(revision))), "lookup-children");
      const tail = [conditions, revisions, zhNote].filter(Boolean);
      const tacticRelations = profile.relations.filter((relation) => relation.key === "selfTactic" || relation.key === "inheritTactic");
      const usage = fieldByKey(profile, "usage");
      const cardPacks = profile.sections.find((section) => section.key === "cardPacks");
      const right = t("div", { class: "lookup-profile-column" }, [
        ...tacticRelations.map((relation) => tacticCard(corpus, relation, page)),
        ...profile.relations.filter((item) => !tacticRelations.includes(item)).map((relation) => relationRow(relation, page)),
        usage ? proseSection(usage) : null,
        cardPacks ? cardPackBlock(cardPacks) : null,
      ]);
      body = t("div", { class: "lookup-profile" }, [t("div", { class: "lookup-profile-column" }, [heroStats(profile)]), right, ...tail]);
    } else {
      // Binh thư (bốn nhóm catalog dùng panel chi tiết của `js/lookup-master.js`): đoạn văn hiệu ứng rồi bảng thông số.
      const prose = profile.fields.filter((item) => PROSE_KEYS.has(item.key));
      const facts = profile.fields.filter((item) => !PROSE_KEYS.has(item.key));
      body = t("div", { class: "lookup-profile lookup-profile-entry" }, [
        ...prose.map((field, index) => proseSection(field, index === 0)),
        facts.length ? t("dl", { class: "lookup-fact-grid" }, facts.map(factTile)) : null,
        conditions,
        zhNote,
      ]);
    }
    return { entryRow, header, body };
  }

  /**
   * Hộp thoại hồ sơ `id` trên `corpus` (payload đã có); `null` khi mã không có trong corpus.
   * `isCurrent()` cho biết hộp thoại còn là hộp thoại đang mở (bỏ kết quả tải trễ của hồ sơ cũ).
   */
  function renderProfile(corpus, id, isCurrent) {
    const parts = profileParts(corpus, id, false);
    if (!parts) return null;
    const { entryRow, header, body } = parts;
    const tactic = entryRow.group === "tactics";
    const dialog = treeToDom(t("article", {
      class: tactic && summaries ? "lookup-dialog is-tactic" : "lookup-dialog",
      role: "dialog",
      "aria-modal": "true",
      tabindex: "-1",
      "aria-labelledby": "lookup-dialog-title",
    }, [header, body]));
    const close = dialog.querySelector(".lookup-close");
    close.addEventListener("click", () => onClose());
    for (const button of dialog.querySelectorAll("[data-lookup-open]")) button.addEventListener("click", () => openInPage(button.dataset.lookupOpen));
    if (tactic) bindTacticEffectVersions(dialog, entryRow.record ?? {});
    if (entryRow.group === "heroes" && summaries) dialog.append(summaryBlock(id, isCurrent));
    if (tactic && summaries) {
      dialog.append(tacticSummaryBlock({ id, record: entryRow.record ?? {}, summaries, getCorpus: () => corpus, isCurrent }));
    }
    return { dialog, close };
  }

  /**
   * Hồ sơ của trang riêng một mục (cây `article`); `null` khi mã không có trong corpus. `summaryTable` là bảng "Trong
   * cẩm nang" đã kiểm của nhóm (tướng hoặc chiến pháp; vắng thì không có khối), `rawName` tra tên Hán của bản zh,
   * `from` là URL trang để các link đội quay lại đúng chỗ (build không có).
   * @param {any} corpus
   * @param {string} id
   * @param {{summaryTable?: any, rawName?: ((viName: string) => string | null) | null, from?: string}} [options]
   */
  function profilePageTree(corpus, id, { summaryTable = null, rawName = null, from } = {}) {
    const parts = profileParts(corpus, id, true);
    if (!parts) return null;
    const { entryRow, header, body } = parts;
    const record = entryRow.record ?? {};
    const summary = !summaryTable ? null
      : entryRow.group === "heroes" ? heroSummaryTree(id, summaryTable, rawName, from)
        : entryRow.group === "tactics" ? tacticSummaryBlockTree({ id, record, table: summaryTable, corpus, from })
          : null;
    return t("article", {
      class: entryRow.group === "tactics" ? "lookup-dialog is-page is-tactic" : "lookup-dialog is-page",
      "aria-labelledby": "lookup-dialog-title",
      "data-lookup-item": id,
    }, [header, body, summary]);
  }

  return { renderProfile, profilePageTree };
}
