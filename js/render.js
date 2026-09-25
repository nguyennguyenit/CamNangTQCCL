// DOM builders thuần — nhận data, trả HTMLElement. Không state, không innerHTML data thô.

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
const publicText = (value, fallback = "Nội dung tiếng Việt chưa sẵn sàng") =>
  typeof value === "string" && value.trim() && !CJK_TEXT.test(value) ? value.trim() : fallback;

const UNIT_CLASS = { "Kỵ": "u-ky", "Cung": "u-cung", "Thương": "u-thuong", "Khiên": "u-khien" };
// Phe -> hậu tố class màu (Ngụy xanh đậm, Thục xanh lá, Ngô đỏ, Quần vàng).
export const FACTION_CODE = { "Ngụy": "nguy", "Thục": "thuc", "Ngô": "ngo", "Quần": "quan", "Hỗn hợp": "honhop" };
// Nhãn trạng thái dùng chung (cũng dùng ở app.js qua export).
export const STATUS_LABEL = {
  meta: "Meta",
  "out-meta": "Cũ",
  "youtuber-untested": "Youtuber",
  situational: "Tình huống",
};
// Nhãn nguồn team (theo file gốc trong Meta Team PK).
export const SOURCE_LABEL = {
  "team-intro": "Giới thiệu",
  "do-uy": "Đô úy",
  "moi-phe": "Meta phe (cũ)",
};

/** Bậc tier tốt nhất (T số nhỏ nhất) trong list rankings. Rỗng -> null. */
export function bestTier(rankings) {
  if (!rankings || !rankings.length) return null;
  return rankings.reduce((best, r) =>
    parseFloat(r.tier.slice(1)) < parseFloat(best.slice(1)) ? r.tier : best,
    rankings[0].tier);
}

/** Tier -> hậu tố class CSS (bỏ dấu chấm: T0.5 -> t-05). */
export function tierClass(tier) {
  return "t-" + tier.slice(1).replace(".", "");
}

/** Badge tier team + tooltip liệt kê mọi nguồn (multi-source minh bạch). */
function tierBadge(rankings) {
  const tier = bestTier(rankings);
  if (!tier) return null;
  const tip = rankings
    .map((r) => `${r.tier} — ${r.source} (${r.updatedAt})`)
    .join("\n");
  return el("span", { class: `badge tier ${tierClass(tier)}`, title: `Tham khảo:\n${tip}` }, tier);
}


function statusBadge(status) {
  if (status === "meta") return null;
  return el("span", { class: `badge status status-${status}` }, STATUS_LABEL[status] || status);
}

/** Badge "Khuyến nghị" cho team được đề cử (cờ team.recommended). */
function recommendBadge(team) {
  if (!team.recommended) return null;
  return el("span", { class: "badge recommend", title: "Đội được khuyến nghị" }, "Khuyến nghị");
}

function variantTags(g, cls, onTag) {
  // g = {name, alternatives[]}
  const wrap = el("span", { class: "vg" });
  const main = el("button", {
    class: `tag ${cls}`,
    type: "button",
    onclick: onTag ? () => onTag(g.name) : null,
  }, g.name);
  wrap.append(main);
  for (const alt of g.alternatives || []) {
    wrap.append(el("span", { class: "alt-sep" }, "/"));
    wrap.append(
      el("button", { class: `tag ${cls} alt`, type: "button", onclick: onTag ? () => onTag(alt) : null }, alt)
    );
  }
  return wrap;
}

function heroRow(hero, onTag) {
  const altName = (hero.alternatives || []).length ? " / " + hero.alternatives.join(" / ") : "";
  const nameEl = el("div", { class: "hero-name" }, [
    hero.isSP ? el("span", { class: "pre sp" }, "SP") : null,
    hero.isCO ? el("span", { class: "pre co" }, "CO" ) : null,
    el("span", { class: "hn" }, hero.baseName + altName),
    hero.variant ? el("span", { class: "variant" }, `(${hero.variant})`) : null,
  ]);

  const tactics = el("div", { class: "line tactics" },
    (hero.tactics || []).map((g) => variantTags(g, "t-tactic", onTag)));

  const books = el("div", { class: "line books" },
    (hero.books || []).map((g) => variantTags(g, "t-book", onTag)));

  return el("div", { class: "hero" }, [nameEl, tactics, (hero.books || []).length ? books : null]);
}

function counterChips(counters, onTag) {
  const wrap = el("div", { class: "counters" });
  for (const g of counters.good || []) {
    wrap.append(el("button", { class: "chip good", type: "button", title: "Khắc được", onclick: onTag ? () => onTag(g) : null }, "⚔ " + g));
  }
  for (const a of counters.avoid || []) {
    wrap.append(el("button", { class: "chip avoid", type: "button", title: "Nên tránh", onclick: onTag ? () => onTag(a) : null }, "⚠ " + a));
  }
  return wrap.childElementCount ? wrap : null;
}

/** Card 1 team PK. onTag(value): callback khi bấm chip (để search). */
export function teamCard(team, onTag, rankings) {
  const fcode = FACTION_CODE[team.faction];
  // Tiêu đề: ưu tiên tên gọi khác (nickname), mặc định tên ghép từ âm tiết cuối 3 tướng.
  const title = team.nickname || team.name;
  const titleEl = title
    ? el("button", { class: "team-name", type: "button", title: "Tìm theo tên team", onclick: onTag ? () => onTag(title) : null }, title)
    : null;
  const head = el("div", { class: "card-head" }, [
    el("div", { class: "units" }, (team.unitType || []).map((u) =>
      el("span", { class: `badge unit ${UNIT_CLASS[u] || ""}` }, u))),
    el("div", { class: "head-right" }, [
      recommendBadge(team),
      tierBadge(rankings),
      team.faction ? el("span", { class: `badge faction${fcode ? " f-" + fcode : ""}` }, team.faction) : null,

      statusBadge(team.status),
    ]),
  ]);

  const heroes = el("div", { class: "heroes" }, team.heroes.map((h) => heroRow(h, onTag)));
  const foot = counterChips(team.counters || {}, onTag);
  const notes = team.notes ? el("div", { class: "notes" }, team.notes) : null;

  const cls = ["team-card", team.status === "out-meta" ? "dim" : "", fcode ? "fa-" + fcode : ""]
    .filter(Boolean).join(" ");
  return el("article", { class: cls }, [titleEl, head, heroes, foot, notes].filter(Boolean));
}

/** 1 tướng trong đội Cùng Tồn — khối dọc giống card Team PK. */
function coexistHeroRow(h) {
  const tactics = (h.tactics || []).length
    ? el("div", { class: "line" }, h.tactics.map((t) => el("span", { class: "tag t-tactic" }, t)))
    : null;
  const books = (h.books || []).length
    ? el("div", { class: "line" }, h.books.map((b) => el("span", { class: "tag t-book" }, b)))
    : null;
  const meta = [];
  if (h.statFocus) meta.push(el("span", { class: "ct-meta-item" }, ["Thêm: ", el("b", {}, h.statFocus)]));
  if (h.advisorSkill) meta.push(el("span", { class: "ct-meta-item" }, ["QS: ", el("b", {}, h.advisorSkill)]));
  return el("div", { class: "hero" }, [
    el("div", { class: "hero-name" }, [el("span", { class: "hn" }, h.name)]),
    tactics,
    books,
    meta.length ? el("div", { class: "ct-meta" }, meta) : null,
  ].filter(Boolean));
}

function coexistTeams(teams) {
  return el("div", { class: "coexist-teams" }, teams.map((team) =>
    el("article", { class: "coexist-subteam" }, [
      el("h4", { class: "coexist-subteam-title" }, team.teamName),
      team.unitTacticEffects
        ? el("div", { class: "ct-meta" }, [
            el("span", { class: "ct-meta-item" }, ["Cải tạo: ", el("b", {}, team.unitTacticEffects)]),
          ])
        : null,
      el("div", { class: "heroes" }, (team.heroes || []).map(coexistHeroRow)),
    ].filter(Boolean))));
}

/** 1 nhóm Cùng Tồn. */
export function coexistGroup(group) {
  return el("section", { class: "coexist-group" }, [
    el("h3", {}, group.groupLabel || "Nhóm"),
    group.summary
      ? el("details", { class: "coexist-summary-box" }, [
          el("summary", {}, "Tổng quan combo"),
          el("p", { class: "coexist-summary" }, group.summary),
        ])
      : null,
    coexistTeams(group.teams),
  ].filter(Boolean));
}

/** Chip chiến pháp (không bấm-search, chỉ hiển thị). */
function tacticChip(name, cls = "t-tactic") {
  return name ? el("span", { class: `tag ${cls}` }, name) : null;
}

/**
 * 1 hàng tướng trong đội hình khai hoang — khối dọc giống card Team PK.
 * `buildNote` thuộc đúng build đang chọn; `openingNote` chỉ hiện ở trang chi tiết.
 */
function khaihoangHeroRow(h, openingNotes = false) {
  const name = el("div", { class: "hero-name" }, [
    el("span", { class: "hn" }, h.name),
  ]);
  const before = el("div", { class: "line kh-line" }, [
    el("span", { class: "kh-label" }, "Trước"),
    el("span", { class: `badge unit small ${UNIT_CLASS[h.unitTypeBefore] || ""}` }, h.unitTypeBefore),
    tacticChip(h.tacticBefore),
  ].filter(Boolean));
  const after = el("div", { class: "line kh-line" }, [
    el("span", { class: "kh-label" }, "Sau"),
    el("span", { class: `badge unit small ${UNIT_CLASS[h.unitTypeAfter] || ""}` }, h.unitTypeAfter),
    ...(h.tacticsAfter || []).map((t) => tacticChip(t)),
  ].filter(Boolean));
  return el("div", { class: "hero" }, [
    name,
    h.tacticBefore ? before : null,
    h.tacticsAfter?.length ? after : null,
    h.buildNote ? el("div", { class: "kh-note" }, h.buildNote) : null,
    openingNotes && h.openingNote ? el("div", { class: "kh-opening-note" }, h.openingNote) : null,
  ].filter(Boolean));
}

/**
 * Nội dung build khai hoang dùng chung cho card và trang chi tiết.
 * Ghi chú lấy đúng owner của build đang chọn — không mượn ghi chú của build mặc định;
 * `openingNotes` bật phần hướng dẫn mở đất chỉ dành cho trang chi tiết.
 */
export function khaihoangBuildContent(build, openingNotes = false) {
  return [
    build.buildNote ? el("p", { class: "kh-build-note" }, build.buildNote) : null,
    openingNotes && build.openingNote ? el("p", { class: "kh-opening-note" }, build.openingNote) : null,
    build.commanderBefore ? el("p", { class: "kh-commander" }, `Chủ tướng trước cấp 20: ${build.commanderBefore}`) : null,
    build.commanderAfter ? el("p", { class: "kh-commander" }, `Chủ tướng sau cấp 20: ${build.commanderAfter}`) : null,
    el("div", { class: "heroes" }, (build.heroes || []).map((hero) => khaihoangHeroRow(hero, openingNotes))),
  ].filter(Boolean);
}

function guideRatings(ratings = {}) {
  const labels = [["land4", "Đất 4"], ["land5", "Đất 5"], ["land6", "Đất 6"], ["land7to8", "Đất 7–8"], ["transition", "Chuyển"], ["overall", "Tổng"]];
  const values = labels.filter(([key]) => ratings[key] !== undefined && ratings[key] !== null)
    .map(([key, label]) => el("span", { class: "kh-guide-rating" }, `${label}: ${ratings[key]}`));
  return values.length ? el("div", { class: "kh-guide-ratings" }, values) : null;
}

function guideDefenders(defenders = {}) {
  const ordered = (title, rows) => rows?.length ? el("div", { class: "kh-guide-list" }, [
    el("strong", {}, title),
    el("ol", {}, rows.map((row) => el("li", {}, `${row.hero}${row.unitType ? ` ${row.unitType}` : ""}`))),
  ]) : null;
  return [ordered("Đất 4 · dễ → khó", defenders.land4), ordered("Đất 5 · dễ → khó", defenders.land5),
    defenders.warning ? el("p", { class: "kh-guide-warning" }, defenders.warning) : null].filter(Boolean);
}

/** Hướng dẫn đánh đất của một team khai hoang (owner theo bộ ba, không theo build). */
export function khaihoangGuide(guide) {
  if (!guide || !Object.keys(guide).length) return null;
  const red = (guide.redRequirements || []).map((item) => [
    item.hero,
    item.minimum !== undefined ? `từ ${item.minimum} đỏ` : null,
    item.recommended !== undefined ? `khuyến nghị ${item.recommended} đỏ` : null,
    item.note,
  ].filter(Boolean).join(" · "));
  const split = guide.splitTeams;
  const transitions = (guide.transitions || []).map((item) => el("li", {}, [
    el("strong", {}, item.target),
    item.note ? el("p", { class: "kh-guide-note" }, item.note) : null,
    el("ol", {}, (item.steps || []).map((step) => el("li", {}, [
      step.mainCityLevel ? `Thành chính ${step.mainCityLevel}` : null,
      step.commandCost ? `${step.commandCost} thống ngự` : null,
      step.timing,
      step.trainHeroes?.length ? `Luyện ${step.trainHeroes.join(" + ")}` : null,
      step.note,
    ].filter(Boolean).join(" · ")))),
  ]));
  const splitTeams = split?.teams?.length ? el("div", { class: "kh-guide-list" }, [
    el("strong", {}, "Tách đội đánh đất"),
    el("ul", {}, split.teams.map((item) => el("li", {}, [
      item.target ? el("strong", {}, item.target) : null,
      item.heroes?.length ? el("ul", {}, item.heroes.map((hero) => el("li", {}, [
        hero.name,
        hero.tactics?.length ? ` (${hero.tactics.join(" / ")})` : null,
      ].filter(Boolean).join("")))) : null,
      item.note ? el("p", { class: "kh-guide-note" }, item.note) : null,
    ].filter(Boolean)))),
  ]) : null;
  const details = [
    ...guideDefenders(guide.defenders),
    split?.note ? el("p", { class: "kh-guide-note" }, split.note) : null,
    splitTeams,
    transitions.length ? el("div", { class: "kh-guide-list" }, [el("strong", {}, "Chuyển hình"), el("ul", {}, transitions)]) : null,
  ].filter(Boolean);
  const hasContent = guide.overview || guideRatings(guide.ratings) || red.length || details.length;
  if (!hasContent) return null;
  return el("section", { class: "kh-guide" }, [
    el("h2", { class: "kh-guide-title" }, "Hướng dẫn khai hoang"),
    guide.overview ? el("p", { class: "kh-guide-overview" }, guide.overview) : null,
    guideRatings(guide.ratings),
    el("p", { class: "kh-guide-scope" }, "Đánh giá chung cho bộ ba tướng; chưa chấm riêng từng bộ chiến pháp."),
    red.length ? el("p", { class: "kh-guide-red" }, [el("strong", {}, "Yêu cầu đỏ: "), red.join("; ")]) : null,
    details.length ? el("details", { class: "kh-guide-details" }, [
      el("summary", {}, "Hướng dẫn đánh đất và chuyển hình"),
      ...details,
    ]) : null,
  ].filter(Boolean));
}

/** Cấu hình đang chọn của một team: bản thân team là build mặc định. */
function khaihoangBuildFor(team, variantId) {
  if (!variantId) return team;
  return (team.variants || []).find((variant) => variant.id === variantId) || team;
}

/**
 * Anchor thật của card. `href` do caller cấp qua `hrefFor`; click thường mới điều hướng,
 * click đã sửa (Cmd/Ctrl/Shift/Alt) hoặc middle-click do trình duyệt tự xử lý.
 */
function khaihoangCardLink(className, label, activate) {
  const link = el("a", { class: className }, label);
  link.addEventListener("click", (event) => {
    if (!link.hasAttribute("href") || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    activate(event);
  });
  return link;
}

/** Cập nhật badge binh chủng tại chỗ khi đổi build (card và trang chi tiết dùng chung). */
export function applyKhaihoangUnit(node, build) {
  node.textContent = build.unitType;
  node.className = `badge unit ${UNIT_CLASS[build.unitType] || ""}`;
}

/** 1 card đội hình khai hoang đề xuất: chỉ build, hướng dẫn đánh đất nằm ở trang chi tiết. */
function khaihoangTeamCard(team, { onSelect, onActivate }) {
  const unit = el("span", { class: "badge unit" });
  applyKhaihoangUnit(unit, team);
  const titleLink = khaihoangCardLink("kh-title-link", team.title, onActivate);
  const detailLink = khaihoangCardLink("kh-detail-link", "Xem chi tiết", onActivate);
  const head = el("div", { class: "card-head" }, [
    el("div", { class: "units" }, [unit]),
    el("h3", { class: "kh-title" }, [titleLink]),
  ]);
  const variants = team.variants || [];
  const select = variants.length ? el("select", {
    class: "kh-variant-select", "aria-label": `Cấu hình ${team.title}`,
    onchange: (event) => onSelect(event.target.value),
  }, [
    el("option", { value: "" }, "Cấu hình mặc định"),
    ...variants.map((v, index) => el("option", { value: v.id }, v.displayLabel || `Cấu hình ${index + 1}`)),
  ]) : null;
  const content = el("div", { class: "kh-build", "aria-live": "polite" });
  const element = el("article", { class: "kh-card" }, [
    head,
    el("p", { class: "kh-detail-row" }, [detailLink]),
    select ? el("label", { class: "kh-variant-control" }, ["Chọn cấu hình", select]) : null,
    content,
  ].filter(Boolean));
  return { element, unit, select, content, links: [titleLink, detailLink] };
}

function khaihoangSources(sources = []) {
  const links = sources.filter((source) => /^https:\/\//.test(source.url || ""));
  return links.length ? el("div", { class: "kh-sources" }, [
    el("span", {}, "Nguồn: "),
    ...links.map((source) => el("a", {
      href: source.url, target: "_blank", rel: "noopener noreferrer",
    }, source.label)),
  ]) : null;
}

/** Nhóm Chạm Sứ độc lập, giữ nguyên tướng và chiến pháp từ nguồn. */
function chamSuTeamCard(team) {
  return el("article", { class: "cham-su-card" }, [
    el("h3", { class: "cham-su-title" }, team.title),
    el("div", { class: "heroes" }, (team.heroes || []).map((hero) =>
      el("div", { class: "hero" }, [
        el("div", { class: "hero-name" }, [el("span", { class: "hn" }, hero.name)]),
        tacticChip(hero.tactic),
      ].filter(Boolean)))),
    team.note ? el("p", { class: "kh-build-note" }, team.note) : null,
    khaihoangSources(team.sources),
  ].filter(Boolean));
}

/** Bảng quân thủ các mỏ (PvE). */
function minesGrid(mines) {
  return el("div", { class: "mines" }, mines.map((m) =>
    el("div", { class: "mine" }, [
      el("h3", {}, m.name),
      el("div", { class: "enemies" }, m.enemies.map((e) =>
        el("span", { class: `enemy ${UNIT_CLASS[e.unitType] || ""}` }, [
          el("span", { class: "enemy-name" }, e.hero),
          e.unitType ? el("span", { class: "badge unit small" }, e.unitType) : null,
        ]))),
    ])));
}

/**
 * Section Khai hoang: đội hình đề xuất (build + selector native), Chạm Sứ và quân thủ các mỏ.
 * Hướng dẫn đánh đất không nằm ở đây; trang chi tiết sở hữu phần đó.
 *
 * Trả `{element, getVariants, setVariants, updateLinks}`: phần điều phối URL/snapshot sở hữu
 * lựa chọn, controller chỉ dựng build/select/href và báo thay đổi qua callback.
 */
export function khaihoangTable(data, { hrefFor, onNavigate, onChange } = {}) {
  // Tương thích ngược: nếu nhận mảng (cấu trúc cũ) thì coi là danh sách mỏ.
  const teams = Array.isArray(data) ? [] : (data.teams || []);
  const mines = Array.isArray(data) ? data : (data.mines || []);
  const chamSuTeams = Array.isArray(data) ? [] : (data.chamSuTeams || []);
  const selections = new Map(teams.map((team) => [team.id, ""]));
  const readHref = (teamId, variantId) => (typeof hrefFor === "function" ? hrefFor(teamId, variantId) : null);

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
    entry.content.replaceChildren(...khaihoangBuildContent(build));
    if (entry.select) entry.select.value = variantId;
    writeLinks(entry);
  }

  const entries = teams.map((team) => {
    const entry = khaihoangTeamCard(team, {
      onSelect: (variantId) => {
        selections.set(team.id, variantId);
        showBuild(entry);
        if (typeof onChange === "function") onChange(team.id, variantId);
      },
      onActivate: (event) => {
        if (typeof onNavigate === "function") onNavigate(event, team.id, selections.get(team.id) || "");
      },
    });
    entry.team = team;
    return entry;
  });
  entries.forEach(showBuild);

  const element = el("div", { class: "khaihoang" }, [
    teams.length
      ? el("div", { class: "kh-block" }, [
          el("h2", { class: "kh-section-title" }, "Đội hình khai hoang đề xuất"),
          el("div", { class: "kh-cards" }, entries.map((entry) => entry.element)),
        ])
      : null,
    chamSuTeams.length
      ? el("div", { class: "kh-block" }, [
          el("h2", { class: "kh-section-title" }, "Đội Chạm Sứ / Ăn vạ"),
          el("div", { class: "cham-su-cards" }, chamSuTeams.map(chamSuTeamCard)),
        ])
      : null,
    mines.length
      ? el("div", { class: "kh-block" }, [
          el("h2", { class: "kh-section-title" }, "Quân thủ các mỏ"),
          minesGrid(mines),
        ])
      : null,
  ].filter(Boolean));

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

/** Source-owned coexist payload keeps every original slot and multiline condition. */
export function seasonCoexistGroup(reference) {
  if (!reference.source) return coexistGroup(reference.content);
  const {content, source} = reference;
  const raw = (label, value) => value ? el('p', {class:'season-detail-text'}, [el('strong', {}, label + ': '), publicText(value)]) : null;
  const teams = content.teams.map(team => ({
    teamName: publicText(team.teamNameRaw),
    unitTacticEffects: publicText(team.unitTacticEffectsRaw, ''),
    heroes: team.heroes.map(hero => ({
      name: publicText(hero.nameRaw),
      tactics: hero.tacticSlotsRaw.map(value => publicText(value, 'Chưa có dữ liệu')),
      books: hero.bookSlotsRaw.map(value => publicText(value, 'Chưa có dữ liệu')),
      statFocus: publicText(hero.statFocusRaw, 'Chưa có dữ liệu'),
    })),
  }));
  return el('section', {class:'coexist-group', dataset:{recordId:reference.recordId}}, [
    el('h3', {}, publicText(content.groupLabel)),
    el('p', {class:'scope-note'}, reference.classification === 'applicable' ? 'Áp dụng theo phiên bản luật đã chọn' : 'Tham khảo kịch bản — chưa xác nhận theo phiên bản luật'),
    raw('Tổng quan', content.summaryRaw), raw('Gợi ý khai hoang', content.openingSuggestionsRaw), raw('Ghi chú', content.notesRaw),
    el('a', {href:source.url, target:'_blank', rel:'noopener noreferrer'}, 'Nguồn Cùng Tồn'), raw('Lưu ý nguồn', source.disclaimerRaw),
    coexistTeams(teams),
  ]);
}

export function seasonTeamCard(row, onTag, onOpen) {
  const shownTeam = row.configId ? {...row.team,heroes:row.team.heroes.map(hero=>({...hero,alternatives:[]}))} : row.team;
  const card = teamCard(shownTeam, onTag, row.classification === 'applicable' && row.tier ? [{tier:row.tier,source:'Cấu hình đã xác minh',updatedAt:''}] : row.legacyRankings);
  if (row.configId) {
    card.dataset.configId = row.configId;
    card.querySelectorAll('.heroes .line,.counters,.notes').forEach(node=>node.remove());
  }
  card.append(el('p',{class:'scope-note'},row.classification === 'applicable' ? 'Áp dụng theo phiên bản luật đã chọn' : row.classification === 'unknown' ? 'Chưa rõ mùa — tham khảo' : 'Tham khảo kịch bản'));
  if (row.legacyRankings?.length) card.append(el('details',{class:'legacy-tier-sources'},[el('summary',{},'Bậc lịch sử — tham khảo'),...row.legacyRankings.map(rank=>el('p',{},`${rank.tier} · ${rank.source} · ${rank.updatedAt}`))]));
  if (row.contextLabel) card.append(el('p',{class:'scope-note'},row.contextLabel));
  card.append(el('p',{class:'sgsdeck-score'},row.sourceScore ? `Điểm SGSDeck: ${row.sourceScore.value}` : 'Chưa có điểm SGSDeck'));
  card.append(el('p',{class:'scope-note'},`Nguồn: ${SOURCE_LABEL[row.team.source] || row.team.source || 'Chưa có dữ liệu'}`));
  if (row.sourceScore) card.append(el('a',{href:row.sourceScore.provenance.sourceUrl,target:'_blank',rel:'noopener noreferrer'},'Nguồn điểm SGSDeck'));
  if (row.config?.requirements.some(item=>item.mandatory)) card.append(el('p',{class:'scope-note'},'Có điều kiện bắt buộc chưa xác minh.'));
  if (row.configId) card.append(el('button',{type:'button',class:'ana-link-btn',onClick:onOpen},'Chi tiết cấu hình'));
  return card;
}

import { resolveSelectionScore } from './season-context.js';
import { compareSeasonInventory, defaultSeasonSelection } from './season-ui-state.js';
import { ROSTER_SCAN_STORAGE_KEY, deserializeRosterScanState } from './roster-scan-state.js';
import { canonicalHeroId } from './hero-identity.js';
import { normalizeText } from './filters.js';

/** Ordered configuration details use explicit selections; inventory facts never become tiers. */
export function seasonConfigDetail(row, model, {onClose,importHref}) {
  const {config,team} = row;
  const names = new Map();
  for (const [dataset,kind] of [['heroes-dict','hero'],['tactics','tactic'],['books-dict','book']]) for (const item of model.data[dataset]) {
    const ref = kind === 'hero' ? canonicalHeroId(item.viet) : kind + ':' + normalizeText(item.viet).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    names.set(ref,item.viet);
  }
  const selection = defaultSeasonSelection(config);
  const score = el('p',{class:'sgsdeck-score'});
  const comparison = el('div',{class:'season-inventory-comparison',role:'status'});
  function refreshScore() {
    const value = resolveSelectionScore(model,config.id,selection);
    score.textContent = value ? `Điểm SGSDeck: ${value.value}` : 'Chưa có điểm SGSDeck';
    comparison.replaceChildren();
  }
  function chooser(label,refs,change) {
    const select = el('select',{'aria-label':label},refs.length ? refs.map(ref=>el('option',{value:ref},names.get(ref) || ref)) : [el('option',{value:''},'Chưa có dữ liệu')]);
    const selectedLabel = el('span',{},label.split(' · ').at(-1)+': '+(names.get(refs[0]) || (refs[0] ?? 'Chưa có dữ liệu')));
    select.addEventListener('change',()=>{change(select.value);selectedLabel.textContent=label.split(' · ').at(-1)+': '+select.selectedOptions[0].textContent;refreshScore();});
    return el('label',{class:'season-slot'},[selectedLabel,select]);
  }
  const compare = el('button',{type:'button',class:'ana-btn',onClick:()=>{
    const inventory = deserializeRosterScanState(localStorage.getItem(ROSTER_SCAN_STORAGE_KEY));
    if (!inventory.ownedHeroes.length && !inventory.ownedTactics.length) {
      comparison.replaceChildren(el('p',{},'Chưa có kho để đối chiếu.'),el('a',{class:'ana-link-btn',href:importHref},'Mở scan / nhập kho'));
      return;
    }
    const result = compareSeasonInventory(selection,inventory);
    const lines = [];
    for (const [key,label] of [['missingHeroes','Thiếu tướng'],['missingTactics','Thiếu chiến pháp'],['lockedHeroes','Tướng đang khóa'],['lockedTactics','Chiến pháp đang khóa']]) if (result[key].length) lines.push(`${label}: ${result[key].map(ref=>names.get(ref) || ref).join(', ')}`);
    if (result.duplicateHeroes) lines.push('Trùng tướng giữa các vị trí.');
    if (result.duplicateTactics) lines.push('Trùng chiến pháp giữa các vị trí.');
    if (!lines.length) lines.push('Đủ tướng và chiến pháp cho lựa chọn này.');
    lines.push('Binh thư: chưa kiểm chứng từ kho hiện tại.');
    if (result.requirementsUnknown) lines.push(config.requirements.some(requirement=>requirement.mandatory) ? 'Điều kiện bắt buộc: chưa kiểm chứng; chưa thể đề xuất build.' : 'Điều kiện / hiệu ứng bổ sung: chưa kiểm chứng; thông tin tham khảo, không phải điều kiện bắt buộc để gợi ý đội.');
    comparison.replaceChildren(...lines.map(line=>el('p',{},line)));
  }},'Đối chiếu kho của tôi');
  const detail = el('div',{id:'season-config-detail',class:'season-config-detail',role:'region','aria-label':'Chi tiết cấu hình',tabindex:'-1'},[
    el('button',{type:'button',class:'ana-link-btn',onClick:onClose},'Đóng chi tiết'),
    el('h3',{},team.name), el('p',{class:'scope-note'},`Cấu hình: ${config.id} · ${config.scenarioId} · ${config.rulesetId || 'Tham khảo kịch bản'}`),score,
    row.evaluation?.sourceScore ? el('p',{},[el('a',{href:row.evaluation.sourceScore.provenance.sourceUrl,target:'_blank',rel:'noopener noreferrer'},'Nguồn điểm SGSDeck'),` · ${row.evaluation.sourceScore.provenance.region} · ${row.evaluation.sourceScore.sourceSeason?.label || 'Chưa rõ mùa tại nguồn'}`]) : null,
    chooser('Loại binh',config.unitTypes,value=>{selection.unitType=value;}),
    ...config.heroSlots.map((slot,index)=>el('fieldset',{class:'season-hero-slot'},[
      el('legend',{},`Tướng ${index+1} · ${index === 0 ? 'Chủ tướng' : 'Phó tướng ' + index}`),chooser(`Tướng ${index+1} · Tướng`,slot.heroRefs,value=>{selection.heroSlots[index].heroRef=value;}),
      ...slot.tacticSlots.map((value,i)=>chooser(`Tướng ${index+1} · Chiến pháp ${i+1}`,value.tacticRefs,ref=>{selection.heroSlots[index].tacticRefs[i]=ref;})),
      ...slot.bookSlots.map((value,i)=>chooser(`Tướng ${index+1} · Binh thư ${i+1}`,value.bookRefs,ref=>{selection.heroSlots[index].bookRefs[i]=ref;})),
      el('p',{class:'season-detail-text'},`Cộng điểm: ${publicText(slot.statFocusRaw)}`),
    ])),
    el('details',{},[
      el('summary',{},'Nguồn và đánh giá cấu hình'),
      ...model.data['season-evidence'].filter(proof=>[...config.evidenceRefs,...(row.evaluation?.rankings.flatMap(rank=>rank.evidenceRefs) || [])].includes(proof.id)).map(proof=>el('p',{},[el('a',{href:proof.provenance.sourceUrl,target:'_blank',rel:'noopener noreferrer'},proof.provenance.provider),` · ${proof.provenance.region} · ${proof.provenance.fetchedAt} · ${publicText(proof.note)}`])),
      el('p',{},publicText(row.evaluation?.reviewNote, 'Chưa có đánh giá cấu hình.')),
      ...(row.evaluation?.rankings || []).map(rank=>el('p',{},`${rank.tier}${rank.id === row.evaluation.defaultRankingId ? ' · Đánh giá được chọn' : ' · Tham khảo nguồn khác'}`)),
    ]),
    el('h4',{},'Điều kiện và hiệu ứng'),
    ...config.requirements.map(item=>el('p',{class:'season-detail-text'},`${publicText(item.descriptionRaw)} · Chưa xác minh điều kiện${item.mandatory ? ' · Bắt buộc' : ''}`)),
    ...config.effectBundles.map(item=>el('div',{class:'season-effect'},[
      el('h5',{},publicText(item.labelRaw)),el('p',{class:'season-detail-text'},publicText(item.effectsRaw)),
      ...item.requirementIds.map(id=>el('p',{class:'season-detail-text'},`Điều kiện: ${publicText(config.requirements.find(requirement=>requirement.id === id)?.descriptionRaw)}`)),
      el('p',{class:'scope-note'},'Chưa xác minh điều kiện và hiệu ứng từ kho hiện tại.'),
    ])),
    !config.requirements.length && !config.effectBundles.length ? el('p',{},'Không có điều kiện đặc biệt được ghi trong cấu hình.') : null,
    el('p',{class:'season-detail-text'},publicText(config.notes, 'Ghi chú: chưa có dữ liệu')),compare,comparison,
  ]);
  refreshScore();
  return detail;
}
