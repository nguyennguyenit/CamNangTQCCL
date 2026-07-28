// Logic thuần Phase 4 (testable, 0-dep): map output Hán từ vision -> tên Việt
// canonical (3 trục: tướng / chiến pháp / chất tướng) + đối chiếu 172 team.
// Chống hallucination: mọi tên qua matchDict; dưới ngưỡng -> cờ "không chắc".

import { normalizeText } from "./filters.js";
import { canonicalHeroId, normalizeHeroSlot } from "./hero-identity.js";
import { matchDict } from "./match-dict.js";
import { toVietHanViet } from "./hanviet.js";

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
function canonicalTacticId(name) {
  return `tactic:${normalizeText(name).replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "")}`;
}

function mapName(cn, dict, { unknownLabel = null, kind = "tactic" } = {}) {
  const raw = (cn || "").trim();
  if (unknownLabel && UNKNOWN_HERO_TERMS.has(raw)) {
    return {
      cn: raw,
      viet: unknownLabel,
      icon: "",
      matched: false,
      confidence: "low",
      sure: false,
      reviewRequired: true,
      canonicalId: null,
    };
  }
  const m = matchDict(cn, dict);
  const viet = m.matched ? m.record.viet : toVietHanViet(cn);
  return {
    cn,
    // matched -> tên Việt canonical; unmatched -> PHIÊN Hán-Việt (vd 周劭->Chu Thiệu)
    // thay vì giữ chữ Hán hoặc ép match sai. Vẫn gắn cờ sure=false để biết chưa chắc.
    viet,
    icon: m.matched ? (m.record.iconUrl || "") : "", // icon official để mắt thường xác nhận
    matched: m.matched,
    confidence: m.confidence,
    sure: m.matched && !m.reviewRequired,
    score: m.score,
    secondScore: m.secondScore,
    margin: m.margin,
    ambiguous: m.ambiguous,
    reviewRequired: m.reviewRequired,
    canonicalId:
      m.matched && kind === "hero"
        ? canonicalHeroId(viet)
        : m.matched
          ? canonicalTacticId(viet)
          : null,
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
    .map((t) => mapName(t, tacticsDict, { kind: "tactic" }));
  const books = (read.booksCn || []).map((b) => mapName(b, booksDict, { kind: "book" }));
  const hero = mapName(read.nameCn || "", heroesDict, {
    unknownLabel: "Chưa rõ",
    kind: "hero",
  });
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
function teamHeroSlots(team) {
  return (team.heroes || []).map(normalizeHeroSlot);
}

function matchReadHeroesToSlots(readHeroes, slots) {
  const heroes = [...readHeroes];
  let best = [];
  function visit(heroIndex, usedSlots, matches) {
    if (heroIndex >= heroes.length) {
      if (matches.length > best.length) best = matches;
      return;
    }
    visit(heroIndex + 1, usedSlots, matches);
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      if (usedSlots.has(slotIndex)) continue;
      if (
        !slots[slotIndex].alternatives.some(
          ({ canonicalId }) => canonicalId === heroes[heroIndex],
        )
      ) {
        continue;
      }
      visit(
        heroIndex + 1,
        new Set([...usedSlots, slotIndex]),
        [
          ...matches,
          { readHeroId: heroes[heroIndex], slotIndex },
        ],
      );
    }
  }
  visit(0, new Set(), []);
  return best;
}

/**
 * Đối chiếu đội đọc được với 172 team (M2). Đếm số tướng trùng (canonical, đã
 * normalize); tie-break theo số chiến pháp trùng. Trả top `limit` team đạt ngưỡng.
 * @param mapped kết quả mapTeamRead
 */
export function findSimilarTeams(mapped, teams, { minHeroes = 2, limit = 5 } = {}) {
  // [M1] CHỈ tính tướng đã nhận diện (matched) — tên Hán không khớp không vào mẫu số.
  const identified = mapped.filter(
    (item) =>
      item.hero.matched &&
      item.hero.canonicalId &&
      item.hero.reviewRequired !== true,
  );
  const readHeroes = new Set(identified.map((item) => item.hero.canonicalId));
  const readTacticsByHolder = new Set(
    identified.flatMap((item) =>
      item.tactics
        .filter(
          (tactic) =>
            tactic.matched &&
            tactic.canonicalId &&
            tactic.reviewRequired !== true,
        )
        .map((tactic) => `${item.hero.canonicalId}|${tactic.canonicalId}`),
    ),
  );
  if (readHeroes.size === 0) return [];

  const scored = [];
  for (const team of teams) {
    const slots = teamHeroSlots(team);
    const heroMatches = matchReadHeroesToSlots(readHeroes, slots);
    const heroHit = heroMatches.length;
    if (heroHit < minHeroes) continue;

    const tTacticsByHolder = new Set(
      (team.heroes || []).flatMap((hero, index) =>
        (hero.tactics || []).flatMap((tactic) => {
          const holder = heroMatches.find(({ slotIndex }) => slotIndex === index);
          if (!holder) return [];
          return [tactic.name, ...(tactic.alternatives || [])].map(
            (name) => `${holder.readHeroId}|${canonicalTacticId(name)}`,
          );
        }),
      ),
    );
    let tacticHit = 0;
    for (const tactic of readTacticsByHolder) {
      if (tTacticsByHolder.has(tactic)) tacticHit++;
    }

    scored.push({ team, heroHit, tacticHit, total: readHeroes.size });
  }
  scored.sort(
    (a, b) =>
      b.heroHit - a.heroHit ||
      b.tacticHit - a.tacticHit ||
      String(a.team.id || "").localeCompare(String(b.team.id || "")),
  );
  return scored.slice(0, limit);
}
