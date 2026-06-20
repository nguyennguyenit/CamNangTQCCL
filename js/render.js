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
// Nhãn trạng thái dùng chung (cũng dùng ở app.js qua export).
export const STATUS_LABEL = {
  meta: "Meta",
  "out-meta": "Cũ",
  "youtuber-untested": "Youtuber",
  situational: "Tình huống",
};

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
export function teamCard(team, onTag) {
  const head = el("div", { class: "card-head" }, [
    el("div", { class: "units" }, (team.unitType || []).map((u) =>
      el("span", { class: `badge unit ${UNIT_CLASS[u] || ""}` }, u))),
    el("div", { class: "head-right" }, [
      team.faction ? el("span", { class: "badge faction" }, team.faction) : null,
      starsBadge(team.stars),
      statusBadge(team.status),
    ]),
  ]);

  const heroes = el("div", { class: "heroes" }, team.heroes.map((h) => heroRow(h, onTag)));
  const foot = counterChips(team.counters || {}, onTag);
  const notes = team.notes ? el("div", { class: "notes" }, team.notes) : null;

  return el("article", { class: `team-card${team.status === "out-meta" ? " dim" : ""}` },
    [head, heroes, foot, notes].filter(Boolean));
}

/** 1 nhóm Cùng Tồn. */
export function coexistGroup(group) {
  const teams = el("div", { class: "coexist-teams" }, group.teams.map((t) => {
    const heroes = el("ul", { class: "coexist-heroes" }, t.heroes.map((h) =>
      el("li", {}, [
        el("strong", {}, h.name),
        el("span", { class: "muted" }, " — " + (h.tactics || []).join(" / ")),
        h.statFocus ? el("span", { class: "stat" }, " · " + h.statFocus) : null,
        h.advisorSkill ? el("span", { class: "advisor" }, " · QS: " + h.advisorSkill) : null,
      ])));
    return el("div", { class: "coexist-subteam" }, [el("h4", {}, t.teamName), heroes]);
  }));
  return el("section", { class: "coexist-group" }, [
    el("h3", {}, group.groupLabel || "Nhóm"),
    group.summary ? el("p", { class: "coexist-summary" }, group.summary) : null,
    teams,
  ].filter(Boolean));
}

/** Bảng Khai hoang. */
export function khaihoangTable(mines) {
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
