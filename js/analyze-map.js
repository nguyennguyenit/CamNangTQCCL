// Logic thuần Phase 4 (testable, 0-dep): map output Hán từ vision -> tên Việt
// canonical (3 trục: tướng / chiến pháp / chất tướng) + đối chiếu 172 team.
// Chống hallucination: mọi tên qua matchDict; dưới ngưỡng -> cờ "không chắc".

import { normalizeText } from "./filters.js";
import { matchDict } from "./match-dict.js";

// Chất tướng Hán -> Việt (mirror pipeline/hanviet.py STAT_MAP).
const STAT_MAP = {
  "智力": "Trí", "武力": "Lực", "统率": "Thống", "速度": "Tốc",
  "政治": "Chính", "魅力": "Mị", "防御": "Phòng", "攻击": "Công",
};

// Binh thư Hán: KHÔNG phải chiến pháp. Giữ làm guard phòng thủ — nếu model lỡ
// nhét binh thư vào tacticsCn thì vẫn lọc khỏi tactics. Binh thư thật map riêng
// qua booksCn -> booksDict (xem mapRead).
const NON_TACTIC_TERMS = new Set([
  "三军之众", "惜兵爱民", "统军", "锤炼", "久战", "铁甲", "防备",
  "奇正相生", "胜战", "执锐", "文韬", "分险", "蛮勇非勇",
]);
const UNKNOWN_HERO_TERMS = new Set(["未知", "不详", ""]);

/** Chất tướng Hán -> Việt. '全智力' -> 'Toàn Trí'; '智力' -> 'Trí'. */
export function statFocusVn(cn) {
  let s = (cn || "").trim();
  if (!s) return "";
  let prefix = "";
  if (s.startsWith("全")) {
    prefix = "Toàn ";
    s = s.slice(1);
  }
  return (prefix + (STAT_MAP[s] || s)).trim();
}

/**
 * Map 1 ô tên Hán -> {cn, viet, matched, confidence, sure}.
 * - matched: có khớp dict không (matched -> viet là canonical Việt; unmatched -> giữ Hán).
 * - sure: matched & confidence không thấp (sure=false -> UI gắn cờ "kiểm tra").
 */
function mapName(cn, dict, { unknownLabel = null } = {}) {
  const raw = (cn || "").trim();
  if (unknownLabel && UNKNOWN_HERO_TERMS.has(raw)) {
    return { cn: raw, viet: unknownLabel, icon: "", matched: false, confidence: "low", sure: false };
  }
  const m = matchDict(cn, dict);
  return {
    cn,
    viet: m.matched ? m.record.viet : cn, // unmatched -> giữ Hán + cờ
    icon: m.matched ? (m.record.iconUrl || "") : "", // icon official để mắt thường xác nhận
    matched: m.matched,
    confidence: m.confidence,
    sure: m.matched && m.confidence !== "low",
  };
}

/**
 * Map 1 hero đọc được -> {hero, tactics[], statFocus} đã canonical.
 * @param read {nameCn, tacticsCn[], statFocusCn}
 * @param dicts {heroesDict, tacticsDict, booksDict}
 */
export function mapRead(read, { heroesDict, tacticsDict, booksDict = [] }) {
  const tactics = (read.tacticsCn || [])
    .filter((t) => !NON_TACTIC_TERMS.has((t || "").trim()))
    .map((t) => mapName(t, tacticsDict));
  const books = (read.booksCn || []).map((b) => mapName(b, booksDict));
  const hero = mapName(read.nameCn || "", heroesDict, { unknownLabel: "Chưa rõ" });
  // B0: tên đoán từ chân dung -> luôn gắn cờ kiểm tra (chống auto-accept sai).
  if (read.nameFromPortrait && hero.matched) hero.sure = false;
  return {
    hero,
    tactics,
    books,
    statFocus: statFocusVn(read.statFocusCn || ""),
  };
}

/** Map cả đội. */
export function mapTeamRead(heroes, dicts) {
  return (heroes || []).map((h) => mapRead(h, dicts));
}

/** Tên tướng (normalize) của 1 team trong teams.json. */
function teamHeroNames(team) {
  const out = [];
  for (const h of team.heroes || []) {
    out.push(normalizeText(h.baseName || ""));
    for (const a of h.alternatives || []) out.push(normalizeText(a));
  }
  return out.filter(Boolean);
}

/**
 * Đối chiếu đội đọc được với 172 team (M2). Đếm số tướng trùng (canonical, đã
 * normalize); tie-break theo số chiến pháp trùng. Trả top `limit` team đạt ngưỡng.
 * @param mapped kết quả mapTeamRead
 */
export function findSimilarTeams(mapped, teams, { minHeroes = 2, limit = 5 } = {}) {
  // [M1] CHỈ tính tướng đã nhận diện (matched) — tên Hán không khớp không vào mẫu số.
  const readHeroes = new Set(
    mapped.filter((m) => m.hero.matched).map((m) => normalizeText(m.hero.viet)).filter(Boolean),
  );
  const readTactics = new Set(
    mapped.flatMap((m) => m.tactics.filter((t) => t.matched).map((t) => normalizeText(t.viet))).filter(Boolean),
  );
  if (readHeroes.size === 0) return [];

  const scored = [];
  for (const team of teams) {
    const tHeroes = new Set(teamHeroNames(team));
    let heroHit = 0;
    for (const h of readHeroes) if (tHeroes.has(h)) heroHit++;
    if (heroHit < minHeroes) continue;

    const tTactics = new Set(
      (team.heroes || []).flatMap((h) =>
        (h.tactics || []).flatMap((g) => [normalizeText(g.name), ...(g.alternatives || []).map(normalizeText)]),
      ),
    );
    let tacticHit = 0;
    for (const t of readTactics) if (tTactics.has(t)) tacticHit++;

    scored.push({ team, heroHit, tacticHit, total: readHeroes.size });
  }
  scored.sort((a, b) => b.heroHit - a.heroHit || b.tacticHit - a.tacticHit);
  return scored.slice(0, limit);
}
