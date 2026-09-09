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

function starsBadge(stars) {
  if (stars == null) return null;
  const full = Math.floor(stars);
  const half = stars % 1 >= 0.5;
  return el("span", { class: "badge stars", title: `${stars} sao` }, "★".repeat(full) + (half ? "½" : ""));
}

function statusBadge(status) {
  if (status === "meta") return null;
  return el("span", { class: `badge status status-${status}` }, STATUS_LABEL[status] || status);
}

/** Badge "Khuyến nghị" cho team được đề cử (cờ team.recommended). */
function recommendBadge(team) {
  if (!team.recommended) return null;
  return el("span", { class: "badge recommend", title: "Đội được khuyến nghị" }, "★ Khuyến nghị");
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
      starsBadge(team.stars),
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

/** 1 nhóm Cùng Tồn. */
export function coexistGroup(group) {
  const teams = el("div", { class: "coexist-teams" }, group.teams.map((t) =>
    el("article", { class: "coexist-subteam" }, [
      el("h4", { class: "coexist-subteam-title" }, t.teamName),
      el("div", { class: "heroes" }, (t.heroes || []).map(coexistHeroRow)),
    ])));
  return el("section", { class: "coexist-group" }, [
    el("h3", {}, group.groupLabel || "Nhóm"),
    group.summary
      ? el("details", { class: "coexist-summary-box" }, [
          el("summary", {}, "Tổng quan combo"),
          el("p", { class: "coexist-summary" }, group.summary),
        ])
      : null,
    teams,
  ].filter(Boolean));
}

/** Chip chiến pháp (không bấm-search, chỉ hiển thị). */
function tacticChip(name, cls = "t-tactic") {
  return name ? el("span", { class: `tag ${cls}` }, name) : null;
}

/** 1 hàng tướng trong đội hình khai hoang — khối dọc giống card Team PK. */
function khaihoangHeroRow(h) {
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
    h.displayNote ? el("div", { class: "kh-note" }, h.displayNote) : null,
  ].filter(Boolean));
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

function khaihoangGuide(guide) {
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

/** 1 card đội hình khai hoang đề xuất. */
function khaihoangTeamCard(t) {
  const unit = el("span", { class: `badge unit ${UNIT_CLASS[t.unitType] || ""}` }, t.unitType);
  const head = el("div", { class: "card-head" }, [
    el("div", { class: "units" }, [unit]),
    el("h4", { class: "kh-title" }, t.title),
  ]);
  const content = el("div", { class: "kh-build", "aria-live": "polite" });
  const variants = t.variants || [];
  const selector = variants.length ? el("select", {
    class: "kh-variant-select", "aria-label": `Cấu hình ${t.title}`,
    onchange: (event) => showBuild(variants.find((v) => v.id === event.target.value) || t),
  }, [
    el("option", { value: "" }, "Cấu hình mặc định"),
    ...variants.map((v, index) => el("option", { value: v.id }, v.displayLabel || `Cấu hình ${index + 1}`)),
  ]) : null;

  function showBuild(build) {
    unit.textContent = build.unitType;
    unit.className = `badge unit ${UNIT_CLASS[build.unitType] || ""}`;
    content.replaceChildren(...[
      build.displayNote ? el("p", { class: "kh-build-note" }, build.displayNote) : null,
      build.commanderBefore ? el("p", { class: "kh-commander" }, `Chủ tướng trước cấp 20: ${build.commanderBefore}`) : null,
      build.commanderAfter ? el("p", { class: "kh-commander" }, `Chủ tướng sau cấp 20: ${build.commanderAfter}`) : null,
      el("div", { class: "heroes" }, (build.heroes || []).map(khaihoangHeroRow)),
    ].filter(Boolean));
  }
  showBuild(t);
  return el("article", { class: "kh-card" }, [
    head,
    selector ? el("label", { class: "kh-variant-control" }, ["Chọn cấu hình", selector]) : null,
    khaihoangGuide(t.guide),
    content,
  ].filter(Boolean));
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

/** Section Khai hoang: đội hình đề xuất, Chạm Sứ và quân thủ các mỏ. */
export function khaihoangTable(data) {
  // Tương thích ngược: nếu nhận mảng (cấu trúc cũ) thì coi là danh sách mỏ.
  const teams = Array.isArray(data) ? [] : (data.teams || []);
  const mines = Array.isArray(data) ? data : (data.mines || []);
  const chamSuTeams = Array.isArray(data) ? [] : (data.chamSuTeams || []);
  return el("div", { class: "khaihoang" }, [
    teams.length
      ? el("div", { class: "kh-block" }, [
          el("h2", { class: "kh-section-title" }, "Đội hình khai hoang đề xuất"),
          el("div", { class: "kh-cards" }, teams.map(khaihoangTeamCard)),
        ])
      : null,
    chamSuTeams.length
      ? el("div", { class: "kh-block" }, [
          el("h2", { class: "kh-section-title" }, "Team Chạm Sứ / Ăn vạ"),
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
}
