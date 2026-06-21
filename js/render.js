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
  const fcode = FACTION_CODE[team.faction];
  const head = el("div", { class: "card-head" }, [
    el("div", { class: "units" }, (team.unitType || []).map((u) =>
      el("span", { class: `badge unit ${UNIT_CLASS[u] || ""}` }, u))),
    el("div", { class: "head-right" }, [
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
  return el("article", { class: cls }, [head, heroes, foot, notes].filter(Boolean));
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
    before,
    after,
    h.note ? el("div", { class: "kh-note" }, h.note) : null,
  ].filter(Boolean));
}

/** 1 card đội hình khai hoang đề xuất. */
function khaihoangTeamCard(t) {
  const head = el("div", { class: "card-head" }, [
    el("div", { class: "units" }, [
      el("span", { class: `badge unit ${UNIT_CLASS[t.unitType] || ""}` }, t.unitType),
    ]),
    el("h4", { class: "kh-title" }, t.title),
  ]);
  const heroes = el("div", { class: "heroes" }, (t.heroes || []).map(khaihoangHeroRow));
  const transforms = (t.transforms || []).length
    ? el("div", { class: "kh-transforms" }, [
        el("span", { class: "kh-tf-label" }, "Chuyển hình đề xuất"),
        ...t.transforms.map((tf) =>
          el("div", { class: "kh-tf" }, [
            el("strong", {}, tf.hero),
            tf.tactic ? tacticChip(tf.tactic, "t-tactic") : null,
            tf.alternatives ? el("span", { class: "muted" }, " — " + tf.alternatives) : null,
          ].filter(Boolean))),
      ])
    : null;
  return el("article", { class: "kh-card" }, [head, heroes, transforms].filter(Boolean));
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

/** Section Khai hoang: đội hình đề xuất + quân thủ các mỏ. */
export function khaihoangTable(data) {
  // Tương thích ngược: nếu nhận mảng (cấu trúc cũ) thì coi là danh sách mỏ.
  const teams = Array.isArray(data) ? [] : (data.teams || []);
  const mines = Array.isArray(data) ? data : (data.mines || []);
  return el("div", { class: "khaihoang" }, [
    teams.length
      ? el("div", { class: "kh-block" }, [
          el("h2", { class: "kh-section-title" }, "Đội hình khai hoang đề xuất"),
          el("div", { class: "kh-cards" }, teams.map(khaihoangTeamCard)),
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
