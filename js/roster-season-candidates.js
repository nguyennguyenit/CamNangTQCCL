// Đội chuẩn theo mùa → ứng viên của engine Gợi ý đội, cùng dạng `data/teams.json`
// (`team.id` + `teamTier[{teamId, rankings}]`) nên engine không cần nhánh riêng.
import { canonicalHeroId, normalizeHeroSlot } from "./hero-identity.js";
import { buildTacticRules, canonicalTacticId, recommendTeams, teamUnitTypes, tacticRuleViolation } from "./team-recommend-engine.js";

/** Chỉ cấu hình Giao chiến: Khai hoang có mục riêng và không dùng cho đội PK. */
const BATTLE_CATEGORY = "交戰";
const EMPTY_SLOTS = new Set(["", "—", "-"]);

const rawKey = (value) => (typeof value === "string" ? value.replace(/\s+/gu, "") : "");

/** Tên gốc chữ Hán (kể cả alias) → tên Việt chuẩn của từ điển, cùng dạng kho đã đọc lưu. */
function nameIndex(dict) {
  const index = new Map();
  for (const item of dict || []) {
    if (!item?.viet) continue;
    for (const name of [item.chinese, ...(item.aliases || [])]) {
      const key = rawKey(name);
      if (key && !index.has(key)) index.set(key, item.viet);
    }
  }
  return index;
}

/** Loại binh nguồn Recommended → nhãn ngắn dùng chung với `data/teams.json` (`unitType`). */
const UNIT_LABELS = { 騎: "Kỵ", 弓: "Cung", 盾: "Khiên", 槍: "Thương" };

/**
 * Ô `tactic` không đối chiếu được với từ điển vẫn là ô của đội: giữ tên Việt dự phòng của nguồn (hoặc chữ
 * gốc khi nguồn không có) và đánh dấu `unresolved` để engine không báo đội "xây ngay". Chỉ ô trống và ô
 * không phải chiến pháp (vd. kết nghĩa) mới là "có điều kiện" (`conditionalTactics`).
 */
function mapHero(source, heroNames, tacticNames, heroIndex, conditionalTactics) {
  const name = heroNames.get(rawKey(source.nameRaw));
  if (!name) return null;
  const tactics = [];
  (source.tacticSlotsRaw || []).forEach((raw, slotIndex) => {
    if (raw == null || EMPTY_SLOTS.has(raw.trim())) return;
    if (source.tacticSlotKinds?.[slotIndex] !== "tactic") {
      conditionalTactics.push({ heroIndex, slotIndex, raw });
      return;
    }
    const tactic = tacticNames.get(rawKey(raw));
    if (tactic) {
      tactics.push({ name: tactic, alternatives: [] });
      return;
    }
    const vi = source.tacticSlotsVi?.[slotIndex];
    tactics.push({ name: typeof vi === "string" && vi.trim() ? vi.trim() : raw.trim(), alternatives: [], unresolved: true, raw });
  });
  return { name, tactics };
}

export function buildSeasonCandidates(records, seasonId, { heroesDict, tacticsDict } = {}) {
  const heroNames = nameIndex(heroesDict);
  const tacticNames = nameIndex(tacticsDict);
  const teams = [];
  const teamTier = [];
  const unmapped = [];
  let total = 0;
  for (const record of records || []) {
    if (record?.sourceSeasonId !== seasonId || record.sourceCategoryId !== BATTLE_CATEGORY) continue;
    total++;
    const conditionalTactics = [];
    const heroes = (record.heroes || []).map((hero, index) => mapHero(hero, heroNames, tacticNames, index, conditionalTactics));
    if (heroes.length === 0 || heroes.includes(null)) {
      unmapped.push({
        configId: record.sourceConfigId,
        reason: "hero-unmapped",
        names: record.heroes.filter((_, index) => heroes[index] === null).map((hero) => hero.nameRaw),
      });
      continue;
    }
    const tier = record.tierRaw || "";
    // Thiếu `unitTypesRaw` (48/1336 cấu hình Giao chiến): `unitType` rỗng ⇒ không gợi ý binh chủng cho đội này.
    const unitTypesRaw = Array.isArray(record.unitTypesRaw) ? [...record.unitTypesRaw] : [];
    teams.push({
      id: record.sourceConfigId,
      name: record.displayNameVi,
      source: "season",
      seasonId,
      tier,
      unitType: unitTypesRaw.map((raw) => UNIT_LABELS[raw]).filter(Boolean),
      unitTypesRaw,
      heroes,
      conditionalTactics,
    });
    teamTier.push({ teamId: record.sourceConfigId, rankings: tier ? [{ tier }] : [] });
  }
  return { teams, teamTier, diagnostics: { total, mapped: teams.length, unmapped } };
}

/** Tướng → (chiến pháp → số cấu hình cùng mùa mang nó); nguồn của món bù. */
export function seasonTacticUsage(teams) {
  const usage = new Map();
  for (const team of teams || []) {
    for (const hero of team.heroes || []) {
      const id = canonicalHeroId(hero.name);
      const counts = usage.get(id) || new Map();
      for (const tactic of hero.tactics || []) {
        if (!tactic.unresolved) counts.set(tactic.name, (counts.get(tactic.name) || 0) + 1);
      }
      usage.set(id, counts);
    }
  }
  return usage;
}

/**
 * Món bù người dùng đã chọn cho một ô thiếu: thêm vào `alternatives` của đúng ô đó nên engine chọn
 * nó như biến thể ("đã thay"). Không sửa dữ liệu gốc; ô/đội không còn tồn tại thì bỏ qua.
 */
export function applyTacticOverrides(teams, overrides = []) {
  const byTeam = new Map();
  for (const override of overrides || []) {
    const list = byTeam.get(override?.teamId) || [];
    list.push(override);
    byTeam.set(override?.teamId, list);
  }
  return (teams || []).map((team) => {
    const own = (byTeam.get(team.id) || []).filter((o) => team.heroes?.[o.heroIndex]?.tactics?.[o.slotIndex]);
    if (own.length === 0) return team;
    return {
      ...team,
      heroes: team.heroes.map((hero, heroIndex) => ({
        ...hero,
        tactics: (hero.tactics || []).map((slot, slotIndex) => {
          const added = own.filter((o) => o.heroIndex === heroIndex && o.slotIndex === slotIndex).map((o) => o.tactic);
          return added.length
            ? { ...slot, alternatives: [...(slot.alternatives || []), ...added], userAlternatives: [...(slot.userAlternatives || []), ...added] }
            : slot;
        }),
      })),
    };
  });
}

/** Khóa theo bộ tướng (không thứ tự) để bỏ đội cũ trùng đội mùa. */
const heroSetKey = (team) => (team.heroes || [])
  .map((hero) => normalizeHeroSlot(hero).alternatives[0].canonicalId)
  .sort()
  .join("|");

/**
 * Điểm vào DUY NHẤT của gợi ý đội theo kho (website và `tqccl_recommend_teams` dùng chung; MCP gọi giống
 * `js/roster-recommend-ui.js`, không truyền `seasonContext`).
 *
 * Chính sách đã chốt khi trộn hai nguồn: chốt đội mùa TRƯỚC (đội đã khóa → đội mùa), đội cũ chỉ dùng tài
 * nguyên (tướng, chiến pháp) còn lại và luôn xếp sau; KHÔNG bảo đảm số đội tối đa khi trộn hai nguồn (một đội
 * mùa chọn trước có thể chiếm tướng/món làm hai đội cũ không xây được). Đội cũ chỉ bị loại khi trùng bộ 3
 * tướng với đội mùa ĐÃ CHỌN (`season.addTeams`), không phải với mọi đội mùa. "Thiếu món" chỉ lấy từ đội mùa,
 * đội thiếu ít món nhất đứng trước (sort ổn định: cùng số món giữ thứ tự bậc của engine).
 *
 * @param {object} input
 * @param {object[]} input.seasonTeams  đội mùa từ `buildSeasonCandidates(...).teams` (`unitType` rỗng = không rõ loại binh)
 * @param {{teamId: string, rankings: {tier: string}[]}[]} input.seasonTier
 * @param {object[]} [input.legacyTeams]  `data/teams.json`
 * @param {object[]} [input.legacyTier]  `data/team-tier.json`
 * @param {{teamId: string, heroIndex: number, slotIndex: number, tactic: string}[]} [input.tacticOverrides]  món bù đã chọn
 * @param {object[]} [input.tacticsDict]  `data/tactics.json`; BẮT BUỘC để áp luật đội cho món bù (không có = không kiểm luật)
 * @param {Map} [input.tacticRules]  thay cho `tacticsDict` nếu đã dựng bằng `buildTacticRules`
 * @param {number} [input.maxTeams=5]
 * @param {number} [input.poolLimit=60]  số đội (đã qua kiểm kho) mà DFS fullBox duyệt; đội ngoài giới hạn vẫn được bước tham lam xét
 * @param {boolean} [input.fullBox]
 * @param {"meta"|"redStars"} [input.mode]
 * @param {Array} input.ownedHeroes  `string | {name, canonicalId?, redStars?}`
 * @param {Array} input.ownedTactics  `string | {name, canonicalId?}`
 * @param {object[]} [input.lockedTeams]
 * @returns {{
 *   portfolioTeams: object[], addTeams: object[], blockedStrongTeams: object[], incompatibleTeams: object[],
 *   diagnostics: object, legacyUsed: boolean,
 * }}
 * Mỗi entry: `status` ∈ build-now | variant | unreconciled | missing-tactic | move-tactic | incompatible | locked.
 * - `unreconciled`: có ô chiến pháp chưa đối chiếu được với từ điển (`unresolvedTactics`, tên Việt dự phòng);
 *   KHÔNG BAO GIỜ là build-now.
 * - `variantUnrated` + `originalTier`: bản đã thay bằng món bù; `tier` là bậc của cấu hình gốc, bản thay chưa được
 *   đánh giá; bản thay xếp sau đội cùng bậc không bị thay.
 * - `incompatibleTeams[]`: đội đủ tướng và món nhưng món bù đã chọn vi phạm luật đội (`incompatibleTactics[{tactic, from, reason}]`,
 *   reason ∈ formation-limit | troop-limit | troop-unit-mismatch | troop-unit-unknown); không nằm trong `blockedStrongTeams`.
 * - `blockedStrongTeams[]`: `status` missing-hero | missing-tactic (kèm `missingTacticSlots`).
 * Giới hạn chưa có dữ liệu (phe/truyền thừa, luật mùa): không được kiểm, không đoán.
 */
export function recommendRoster({
  seasonTeams = [],
  seasonTier = [],
  legacyTeams = [],
  legacyTier = [],
  tacticOverrides = [],
  tacticsDict = null,
  tacticRules = null,
  maxTeams = 5,
  ...engineOptions
} = {}) {
  const rules = tacticRules ?? (tacticsDict ? buildTacticRules(tacticsDict) : null);
  const shared = { ...engineOptions, tacticRules: rules };
  const season = recommendTeams({
    ...shared,
    teams: applyTacticOverrides(seasonTeams, tacticOverrides),
    teamTier: seasonTier,
    maxTeams,
  });
  let portfolioTeams = season.portfolioTeams;
  if (portfolioTeams.length < maxTeams && legacyTeams.length) {
    const chosenKeys = new Set(season.addTeams.map((entry) => heroSetKey(entry.team)));
    const legacy = recommendTeams({
      ...shared,
      teams: legacyTeams.filter((team) => !chosenKeys.has(heroSetKey(team))),
      teamTier: legacyTier,
      maxTeams,
      seedEntries: season.addTeams,
    });
    const chosen = new Set(portfolioTeams);
    portfolioTeams = [
      ...portfolioTeams,
      ...legacy.portfolioTeams.filter((entry) => !chosen.has(entry) && !entry.locked).map((entry) => ({ ...entry, source: "legacy" })),
    ];
  }
  return {
    portfolioTeams,
    addTeams: portfolioTeams.filter((entry) => !entry.locked),
    blockedStrongTeams: [...season.blockedStrongTeams].sort((a, b) => missingCount(a) - missingCount(b)),
    incompatibleTeams: season.incompatibleTeams,
    diagnostics: season.diagnostics,
    legacyUsed: portfolioTeams.some((entry) => entry.source === "legacy"),
  };
}

const missingCount = (entry) => entry.missingHeroSlots?.length || entry.missingTacticSlots?.length || 0;

const ownedTacticId = (item) => (typeof item === "object" && item?.canonicalId) || canonicalTacticId(typeof item === "string" ? item : item?.name);

/** Như `canonicalOwnedTactic` của engine: giữ nguyên ID `tactic:` (đội đã khóa từ trạng thái chuẩn), còn lại suy từ tên. */
const tacticKey = (item) => (typeof item === "string" && item.startsWith("tactic:") ? item : canonicalTacticId(item));

/**
 * Chiến pháp cuối cùng của đội: mỗi ô lấy món bù đã chọn (nếu có) hoặc món gốc; bỏ ô `exclude`
 * (ô đang cần lấp). Dùng để kiểm luật đội và để không gợi ý lại món đã dùng ở ô khác.
 */
export function finalTeamTactics(team, overrides = [], exclude = null) {
  const chosen = new Map((overrides || [])
    .filter((o) => o?.teamId === team?.id)
    .map((o) => [`${o.heroIndex}:${o.slotIndex}`, o.tactic]));
  return (team?.heroes || []).flatMap((hero, heroIndex) => (hero.tactics || []).flatMap((slot, slotIndex) => {
    if (exclude && exclude.heroIndex === heroIndex && exclude.slotIndex === slotIndex) return [];
    return [chosen.get(`${heroIndex}:${slotIndex}`) ?? slot.name];
  }));
}

/**
 * Món bù cho một ô thiếu, kèm món bị loại vì luật đội.
 *
 * Nguồn: chiến pháp tướng đó mang ở cấu hình khác cùng mùa (`usage`), có trong kho, chưa dùng ở đội/ô khác.
 * Luật đội (cần `tacticRules` từ `buildTacticRules`): tối đa 1 trận pháp, tối đa 1 binh chủng, binh chủng phải
 * hợp loại binh của đội; đội không ghi loại binh thì không gợi ý binh chủng nào.
 * Truyền `team` + `heroIndex` + `slotIndex` (+ `tacticOverrides`) để lấy tổ hợp cuối của đội, gồm món bù đã chọn
 * trước đó; hoặc truyền thẳng `teamTactics` + `unitType` (dạng cũ, không có món bù đã chọn tự động).
 * @returns {{substitutes: {tactic: string, configCount: number}[], incompatible: {tactic: string, configCount: number, reason: string}[]}}
 *   `incompatible` không rỗng và `substitutes` rỗng = trạng thái "không tương thích", khác "kho chưa có món bù".
 */
export function analyzeTacticSubstitutes({
  heroName,
  missingTactic,
  teamTactics = [],
  usage,
  ownedTactics = [],
  reservedTactics = [],
  limit = 3,
  team = null,
  tacticOverrides = [],
  heroIndex = null,
  slotIndex = null,
  unitType = null,
  tacticRules = null,
}) {
  const counts = usage?.get(canonicalHeroId(heroName));
  if (!counts) return { substitutes: [], incompatible: [] };
  const others = team && Number.isInteger(heroIndex) && Number.isInteger(slotIndex)
    ? finalTeamTactics(team, tacticOverrides, { heroIndex, slotIndex })
    : teamTactics;
  const units = teamUnitTypes({ unitType: unitType ?? team?.unitType });
  const owned = new Set(ownedTactics.map(ownedTacticId));
  const otherIds = others.map(tacticKey);
  const excluded = new Set([missingTactic, ...others, ...reservedTactics].map(tacticKey));
  const substitutes = [];
  const incompatible = [];
  const ranked = [...counts]
    .filter(([tactic]) => owned.has(canonicalTacticId(tactic)) && !excluded.has(canonicalTacticId(tactic)))
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, "vi"));
  for (const [tactic, configCount] of ranked) {
    const reason = tacticRuleViolation(canonicalTacticId(tactic), otherIds, units, tacticRules);
    if (reason) incompatible.push({ tactic, configCount, reason });
    else substitutes.push({ tactic, configCount });
  }
  return { substitutes: substitutes.slice(0, limit), incompatible: incompatible.slice(0, limit) };
}
