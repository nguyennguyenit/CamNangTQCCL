// Modal chi tiết tướng: stats + thích tính binh chủng + 2 chiến pháp (tự mang /
// truyền thừa) LINK theo `chinese` từ tactics.json (DRY — không nhân bản mô tả).
// Logic resolve tách thuần (test bằng node:test); builder DOM dùng `el`. 0 dep.

import { el } from "./render.js";

const STAT_LABELS = [
  ["luc", "Lực"], ["tri", "Trí"], ["thong", "Thống"],
  ["toc", "Tốc"], ["chinh", "Chính"], ["mi", "Mị"],
];
const TROOP_LABELS = [
  ["ky", "Kỵ"], ["thuan", "Thuẫn"], ["cung", "Cung"],
  ["thuong", "Thương"], ["khiGioi", "Khí giới"],
];

/**
 * Resolve 2 chiến pháp bằng canonical ID; chỉ fallback chữ Hán khi dữ liệu cũ
 * chưa có ID và tên Hán khớp duy nhất.
 * @returns {Array<{slot,chinese,viet,hanViet,type,quality,effect,linked}>}
 */
export function resolveHeroTactics(hero, tacticsDict) {
  const tactics = tacticsDict || [];
  const byId = new Map(tactics.map((t) => [t.id, t]));
  const slots = [
    ["Tự mang", hero.lookup?.selfTacticId, hero.selfTacticCn],
    ["Truyền thừa", hero.lookup?.inheritTacticId, hero.inheritTacticCn],
  ];
  const out = [];
  for (const [slot, id, cn] of slots) {
    if (!id && !cn) continue;
    const matches = id ? [] : tactics.filter((t) => t.chinese === cn);
    const t = id ? byId.get(id) : matches.length === 1 ? matches[0] : null;
    out.push(t
      ? { slot, chinese: t.chinese || cn || "", viet: t.viet || "", hanViet: t.hanViet || "", type: t.type || "", quality: t.quality || "", effect: t.effect || "", linked: true }
      : { slot, chinese: cn || "", viet: "", hanViet: "", type: "", quality: "", effect: "", linked: false });
  }
  return out;
}

function statGrid(stats) {
  return el("div", { class: "hero-stats" }, STAT_LABELS.map(([k, label]) =>
    el("div", { class: "hero-stat" }, [
      el("span", { class: "hs-label" }, label),
      el("span", { class: "hs-val" }, stats?.[k] ?? "—"),
    ])));
}

function troopAptRow(apt) {
  return el("div", { class: "hero-apt" }, TROOP_LABELS.map(([k, label]) => {
    const v = apt?.[k] ?? "—";
    return el("span", { class: `apt apt-${String(v).toLowerCase()}` }, [
      el("span", { class: "apt-troop" }, label),
      el("span", { class: "apt-grade" }, v),
    ]);
  }));
}

function tacticBlock(s) {
  const title = s.linked && s.viet ? s.viet : s.chinese;
  return el("div", { class: "hero-tactic" }, [
    el("div", { class: "ht-head" }, [
      el("span", { class: "ht-slot" }, s.slot),
      el("span", { class: "ht-name" }, title),
      s.quality ? el("span", { class: `tac-q q-${s.quality}` }, s.quality) : null,
      s.type ? el("span", { class: "ht-type" }, s.type) : null,
    ].filter(Boolean)),
    s.linked
      ? el("p", { class: "ht-effect" }, s.effect)
      : el("p", { class: "ht-effect pending" }, "⏳ Mô tả đang cập nhật"),
  ]);
}

/** Build node modal chi tiết tướng. Caller chèn vào overlay + gắn close. */
export function heroDetailModal(hero, tacticsDict) {
  const slots = resolveHeroTactics(hero, tacticsDict);
  const fcode = { "Ngụy": "nguy", "Thục": "thuc", "Ngô": "ngo", "Quần": "quan" }[hero.faction];
  const head = el("div", { class: "hero-modal-head" }, [
    hero.iconUrl ? el("img", { class: "hero-modal-icon", src: hero.iconUrl, alt: hero.hanViet, loading: "lazy" }) : null,
    el("div", { class: "hero-modal-id" }, [
      el("h3", { class: "hero-modal-name" }, [
        hero.isSP ? el("span", { class: "pre sp" }, "SP") : null,
        hero.hanViet,
      ].filter(Boolean)),
      el("div", { class: "hero-modal-badges" }, [
        hero.faction ? el("span", { class: `badge faction${fcode ? " f-" + fcode : ""}` }, hero.faction) : null,
        hero.stars != null ? el("span", { class: "badge stars" }, "★".repeat(hero.stars)) : null,
        hero.roleTagViet ? el("span", { class: "badge role" }, hero.roleTagViet) : null,
      ].filter(Boolean)),
      el("div", { class: "hero-modal-cn" }, hero.chinese),
    ]),
  ].filter(Boolean));

  return el("div", { class: "hero-modal" }, [
    head,
    statGrid(hero.stats),
    troopAptRow(hero.troopApt),
    el("div", { class: "hero-tactics" }, slots.map(tacticBlock)),
  ]);
}
