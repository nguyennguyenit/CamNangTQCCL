import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTacticSubstitutes,
  finalTeamTactics,
  recommendRoster,
} from "../js/roster-season-candidates.js";
import { buildTacticRules, canonicalTacticId, recommendTeams } from "../js/team-recommend-engine.js";
import {
  FIXTURE_IDS,
  buildableBy,
  deepRankProbe,
  realData,
  rosterOf,
  seasonFrom,
  withUsage,
} from "./fixtures/roster-adapter-fixtures.mjs";

const { tacticsDict, legacyTeams, legacyTier } = realData();
const tacticInfo = new Map(tacticsDict.map((t) => [t.viet, t]));
const tacticRules = buildTacticRules(tacticsDict);

const slotOf = (team, tactic) => {
  for (const [heroIndex, hero] of team.heroes.entries()) {
    const slotIndex = hero.tactics.findIndex((t) => t.name === tactic);
    if (slotIndex >= 0) return { heroIndex, slotIndex, holderName: hero.name };
  }
  throw new Error(`${tactic} not in ${team.id}`);
};

/** Kiểm luật đội độc lập với engine, chỉ dựa từ điển: 1 trận pháp, 1 binh chủng, binh chủng hợp loại binh. */
function ruleProblems(unitType, tactics) {
  const infos = tactics.map((name) => tacticInfo.get(name)).filter(Boolean);
  const formations = infos.filter((t) => t.type === "FORMATION");
  const troops = infos.filter((t) => t.type === "TROOP");
  const problems = [];
  if (formations.length > 1) problems.push("formation-limit");
  if (troops.length > 1) problems.push("troop-limit");
  const unit = unitType.map((u) => u.toLowerCase());
  for (const troop of troops) {
    const fit = troop.troopFit.map((f) => f.toLowerCase().replace(/\s*binh$/u, ""));
    if (unit.length === 0 || !unit.some((u) => fit.includes(u))) problems.push("troop-unit");
  }
  return problems;
}

const run = (season, roster, extra = {}) => recommendRoster({
  seasonTeams: season.teams,
  seasonTier: season.teamTier,
  tacticsDict,
  ...roster,
  ...extra,
});

// ---- Lỗi 7: ô chưa đối chiếu ---------------------------------------------------------------

test("s28-wutugu-huangma: ô 御敵屏障 giữ tên Việt dự phòng, không rơi khỏi đội", () => {
  const season = seasonFrom("pk-s28", [FIXTURE_IDS.unresolvedSlot]);
  const [team] = season.teams;
  assert.equal(team.id, FIXTURE_IDS.unresolvedSlot);
  const slot = team.heroes[1].tactics[1];
  assert.deepEqual({ name: slot.name, unresolved: slot.unresolved, raw: slot.raw }, { name: "Ngự Địch Bình Chướng", unresolved: true, raw: "御敵屏障" });
  assert.deepEqual(team.conditionalTactics, []);
  // Ô chưa đối chiếu không là nguồn món bù.
  assert.equal([...season.usage.values()].some((c) => c.has("Ngự Địch Bình Chướng")), false);
});

test("s28-wutugu-huangma: đủ kho vẫn không báo 'xây ngay' khi còn ô chưa đối chiếu", () => {
  const season = seasonFrom("pk-s28", [FIXTURE_IDS.unresolvedSlot]);
  const result = run(season, rosterOf(season.teams));
  const [entry] = result.portfolioTeams;
  assert.equal(entry.team.id, FIXTURE_IDS.unresolvedSlot);
  assert.equal(entry.status, "unreconciled");
  assert.deepEqual(entry.unresolvedTactics, ["Ngự Địch Bình Chướng"]);
  assert.ok(entry.selectedTactics.includes("Ngự Địch Bình Chướng"));
  assert.ok(entry.tacticSelections.some((s) => s.unresolved === true && s.selectedTactic === "Ngự Địch Bình Chướng"));
  assert.notEqual(entry.status, "build-now");
});

test("ô chưa đối chiếu không khóa tài nguyên của đội khác", () => {
  const season = seasonFrom("pk-s28", [FIXTURE_IDS.unresolvedSlot]);
  const other = { id: "other", name: "Other", heroes: [{ name: "Tướng Lạ", tactics: [{ name: "Ngự Địch Bình Chướng", alternatives: [] }] }] };
  const roster = rosterOf(season.teams);
  const result = recommendRoster({
    seasonTeams: [...season.teams, other], seasonTier: [...season.teamTier, { teamId: "other", rankings: [{ tier: "T0" }] }],
    ownedHeroes: [...roster.ownedHeroes, "Tướng Lạ"], ownedTactics: [...roster.ownedTactics, "Ngự Địch Bình Chướng"], tacticsDict,
  });
  assert.deepEqual(result.portfolioTeams.map((e) => e.team.id).sort(), ["other", FIXTURE_IDS.unresolvedSlot].sort());
});

// ---- Ba loại sai trên toàn bộ mùa thật --------------------------------------------------------

test("mọi mùa fixture: không 'xây ngay' khi còn ô chưa đối chiếu; kho dựng được thì có đội mùa", () => {
  let teamsChecked = 0;
  let unresolvedTeams = 0;
  for (const seasonId of ["pk-s28", "pk-s26", "pk-s24"]) {
    const season = seasonFrom(seasonId);
    for (const fullBox of [false, true]) {
      for (const team of season.teams) {
        const roster = rosterOf([team]);
        if (!buildableBy(team, roster)) continue;
        const result = run(season, roster, { mode: "redStars", fullBox, legacyTeams, legacyTier });
        const seasonEntries = result.portfolioTeams.filter((e) => e.source === "team");
        assert.ok(seasonEntries.length >= 1, `${seasonId}/${team.id} buildable but 0 season teams (fullBox=${fullBox})`);
        for (const entry of result.portfolioTeams) {
          if ((entry.unresolvedTactics || []).length) {
            unresolvedTeams++;
            assert.notEqual(entry.status, "build-now", `${entry.team.id} build-now with unresolved slot`);
          }
        }
        teamsChecked++;
      }
    }
  }
  assert.ok(teamsChecked > 400, `fixture set too small: ${teamsChecked}`);
  assert.ok(unresolvedTeams > 0, "no unresolved-slot team was exercised");
});

// ---- Lỗi 1: cắt pool trước khi kiểm kho ----------------------------------------------------------

test("pk-s26 Meta: kho chỉ dựng được đội xếp sau thứ hạng 60 vẫn ra đội mùa", () => {
  const { season, poolSize, picks, roster } = deepRankProbe("pk-s26", 65);
  assert.ok(poolSize > 80, `pool too small to probe the cut: ${poolSize}`);
  assert.ok(picks.length >= 2, `probe needs buildable deep teams, got ${picks.length}`);
  const result = run(season, roster, { mode: "meta", legacyTeams, legacyTier });
  const ids = result.portfolioTeams.filter((e) => e.source === "team").map((e) => e.team.id);
  assert.ok(ids.length >= 1, "0 season teams although the roster can build");
  for (const id of ids) assert.ok(buildableBy(season.teams.find((t) => t.id === id), roster), `${id} not buildable`);
  for (const pick of picks) assert.ok(ids.includes(pick.id), `${pick.id} (deep-ranked, buildable) missing`);
});

test("probe >80 ứng viên (fullBox, Nhiều hột): đội xếp sau thứ hạng 80 vẫn được xét", () => {
  const { season, picks, roster, poolSize } = deepRankProbe("pk-s26", 82, 2, { metaOnly: false });
  assert.ok(poolSize > 85, `pool too small to probe the 80 cut: ${poolSize}`);
  assert.ok(picks.length >= 1, "probe needs a buildable team beyond rank 80");
  const result = run(season, roster, { mode: "redStars", fullBox: true, legacyTeams, legacyTier });
  const ids = result.portfolioTeams.filter((e) => e.source === "team").map((e) => e.team.id);
  for (const pick of picks) assert.ok(ids.includes(pick.id), `${pick.id} missing`);
});

test("fullBox: poolLimit chỉ giới hạn DFS, đội ngoài giới hạn vẫn vào qua bước tham lam dự phòng", () => {
  const { season, picks, roster } = deepRankProbe("pk-s26", 30);
  const result = run(season, roster, { mode: "meta", fullBox: true, poolLimit: 5 });
  const ids = result.portfolioTeams.map((e) => e.team.id);
  for (const pick of picks) assert.ok(ids.includes(pick.id), `${pick.id} outside poolLimit but buildable`);
});

test("engine: không cắt theo 60/80 trước khi kiểm kho, kể cả không có seasonContext", () => {
  const teams = Array.from({ length: 90 }, (_, i) => ({
    id: `probe-${String(i).padStart(2, "0")}`, name: `P${i}`,
    heroes: [{ name: `Tướng ${i}`, tactics: [{ name: `CP ${i}`, alternatives: [] }] }],
  }));
  const teamTier = teams.map((t, i) => ({ teamId: t.id, rankings: [{ tier: i < 85 ? "T0" : "T1" }] }));
  for (const fullBox of [false, true]) {
    const result = recommendTeams({ teams, teamTier, ownedHeroes: ["Tướng 88"], ownedTactics: ["CP 88"], fullBox });
    assert.deepEqual(result.portfolioTeams.map((e) => e.team.id), ["probe-88"], `fullBox=${fullBox}`);
  }
});

// ---- Lỗi 2: loại đội cũ chỉ theo đội mùa đã chọn ---------------------------------------------------------

test("đội cũ cùng bộ tướng với đội mùa CHƯA chọn được thay thế vẫn có thể dùng", () => {
  const jyspt = seasonFrom("pk-s24", ["team-jyspt"]);
  const [team] = jyspt.teams;
  const legacy = {
    id: "legacy-same-heroes", name: "Legacy", unitType: ["Thương"],
    heroes: team.heroes.map((h, i) => ({ name: h.name, tactics: [{ name: `Legacy CP ${i}`, alternatives: [] }] })),
  };
  const { ownedHeroes } = rosterOf([team]);
  const result = recommendRoster({
    seasonTeams: jyspt.teams, seasonTier: jyspt.teamTier,
    legacyTeams: [legacy], legacyTier: [{ teamId: legacy.id, rankings: [{ tier: "T1" }] }],
    ownedHeroes, ownedTactics: legacy.heroes.map((h) => h.tactics[0].name), tacticsDict,
  });
  // Đội mùa thiếu món (kho không có chiến pháp của nó) nên không được chọn ⇒ đội cũ cùng bộ tướng dùng được.
  assert.deepEqual(result.portfolioTeams.map((e) => [e.team.id, e.source]), [[legacy.id, "legacy"]]);
  assert.deepEqual(result.blockedStrongTeams.map((b) => b.team.id), ["team-jyspt"]);
});

test("đội cũ cùng bộ tướng với đội mùa ĐÃ chọn bị loại", () => {
  const jyspt = seasonFrom("pk-s24", ["team-jyspt"]);
  const [team] = jyspt.teams;
  const roster = rosterOf([team]);
  const legacy = { id: "legacy-dup", name: "Dup", heroes: team.heroes.map((h) => ({ name: h.name, tactics: [] })) };
  const result = recommendRoster({
    seasonTeams: jyspt.teams, seasonTier: jyspt.teamTier,
    legacyTeams: [legacy], legacyTier: [{ teamId: legacy.id, rankings: [{ tier: "T1" }] }], ...roster, tacticsDict,
  });
  assert.deepEqual(result.portfolioTeams.map((e) => e.team.id), ["team-jyspt"]);
  assert.equal(result.legacyUsed, false);
});

// ---- Lỗi 3-5: món bù theo luật đội --------------------------------------------------------------

test("team-1imndp3 (khiên): không gợi ý Phi Hùng Quân (kỵ) hay trận pháp thứ hai", () => {
  const season = seasonFrom("pk-s24");
  const team = season.teams.find((t) => t.id === FIXTURE_IDS.troopRules);
  assert.deepEqual(team.unitType, ["Khiên"]);
  const slot = slotOf(team, "Mê Hoặc");
  const ownedTactics = ["Phi Hùng Quân", "Phong Thi Trận", "Hãm Trận Doanh", "Lính Giáp Mây"];
  const input = {
    heroName: slot.holderName, missingTactic: "Mê Hoặc", team, heroIndex: slot.heroIndex, slotIndex: slot.slotIndex,
    usage: season.usage, ownedTactics, tacticRules,
  };
  const { substitutes, incompatible } = analyzeTacticSubstitutes(input);
  assert.deepEqual(substitutes.map((s) => s.tactic).sort(), ["Hãm Trận Doanh", "Lính Giáp Mây"]);
  assert.deepEqual(
    Object.fromEntries(incompatible.map((i) => [i.tactic, i.reason])),
    { "Phi Hùng Quân": "troop-unit-mismatch", "Phong Thi Trận": "formation-limit" },
  );
  // Không truyền luật ⇒ giữ hành vi cũ (tương thích ngược): cả bốn món đều được gợi ý.
  assert.equal(analyzeTacticSubstitutes({ ...input, tacticRules: null, limit: 9 }).substitutes.length, 4);
});

test("ô trận pháp bị thiếu thì trận pháp khác được thay (ô đang thay không tính vào đội)", () => {
  const season = seasonFrom("pk-s24");
  const team = season.teams.find((t) => t.id === FIXTURE_IDS.troopRules);
  const slot = slotOf(team, "Ngư Lân Trận");
  const { substitutes } = analyzeTacticSubstitutes({
    heroName: slot.holderName, missingTactic: "Ngư Lân Trận", team, heroIndex: slot.heroIndex, slotIndex: slot.slotIndex,
    usage: season.usage, ownedTactics: ["Phong Thi Trận"], tacticRules,
  });
  assert.deepEqual(substitutes.map((s) => s.tactic), ["Phong Thi Trận"]);
});

test("team-831163 (kỵ, đã có Phi Hùng Quân): không thêm binh chủng thứ hai dù hợp loại binh", () => {
  const season = seasonFrom("pk-s24");
  const team = season.teams.find((t) => t.id === FIXTURE_IDS.troopKy);
  assert.deepEqual(team.unitType, ["Kỵ"]);
  const slot = slotOf(team, "Mê Hoặc");
  const usage = withUsage(season.usage, slot.holderName, { "Hổ Báo Kỵ": 3 });
  const analysis = analyzeTacticSubstitutes({
    heroName: slot.holderName, missingTactic: "Mê Hoặc", team, heroIndex: slot.heroIndex, slotIndex: slot.slotIndex,
    usage, ownedTactics: ["Hổ Báo Kỵ"], tacticRules,
  });
  assert.deepEqual(analysis.substitutes, []);
  assert.deepEqual(analysis.incompatible, [{ tactic: "Hổ Báo Kỵ", configCount: 3, reason: "troop-limit" }]);
});

test("món bù đã chọn ở ô khác của đội được tính vào luật (kể cả khi chưa nằm trong tên gốc)", () => {
  const season = seasonFrom("pk-s24");
  const team = season.teams.find((t) => t.id === FIXTURE_IDS.troopRules);
  const chosen = slotOf(team, "Mê Hoặc");
  const quanVu = slotOf(team, "Kích Kỳ Nọa Quy");
  const overrides = [{ teamId: team.id, heroIndex: chosen.heroIndex, slotIndex: chosen.slotIndex, tactic: "Hãm Trận Doanh" }];
  assert.ok(finalTeamTactics(team, overrides).includes("Hãm Trận Doanh"));
  assert.ok(!finalTeamTactics(team, overrides).includes("Mê Hoặc"));
  const usage = withUsage(season.usage, quanVu.holderName, { "Lính Giáp Mây": 4 });
  const analysis = analyzeTacticSubstitutes({
    heroName: quanVu.holderName, missingTactic: "Kích Kỳ Nọa Quy", team, tacticOverrides: overrides,
    heroIndex: quanVu.heroIndex, slotIndex: quanVu.slotIndex, usage, ownedTactics: ["Lính Giáp Mây", "Hãm Trận Doanh"], tacticRules,
  });
  assert.deepEqual(analysis.substitutes, []);
  assert.deepEqual(analysis.incompatible.map((i) => [i.tactic, i.reason]), [["Lính Giáp Mây", "troop-limit"]]);
});

test("cấu hình thiếu unitTypesRaw: không gợi ý binh chủng nào", () => {
  const season = seasonFrom("pk-s24");
  const team = season.teams.find((t) => t.id === FIXTURE_IDS.unitMissing);
  assert.deepEqual(team.unitType, []);
  assert.deepEqual(team.unitTypesRaw, []);
  const slot = slotOf(team, "Vạn Quân Đoạt Suý");
  const usage = withUsage(season.usage, slot.holderName, { "Phi Hùng Quân": 2, "Hãm Trận Doanh": 2 });
  const analysis = analyzeTacticSubstitutes({
    heroName: slot.holderName, missingTactic: "Vạn Quân Đoạt Suý", team, heroIndex: slot.heroIndex, slotIndex: slot.slotIndex,
    usage, ownedTactics: ["Phi Hùng Quân", "Hãm Trận Doanh"], tacticRules,
  });
  assert.deepEqual(analysis.substitutes, []);
  assert.deepEqual(analysis.incompatible.map((i) => i.reason), ["troop-unit-unknown", "troop-unit-unknown"]);
});

test("mọi mùa fixture: không món bù nào phạm luật đội, và luật thực sự loại bớt món", () => {
  let slots = 0;
  let suggested = 0;
  let rejected = 0;
  for (const seasonId of ["pk-s24", "pk-s26", "pk-s28"]) {
    const season = seasonFrom(seasonId);
    const allTactics = new Set([...season.usage.values()].flatMap((counts) => [...counts.keys()]));
    for (const team of season.teams) {
      for (const [heroIndex, hero] of team.heroes.entries()) {
        for (const [slotIndex, tactic] of hero.tactics.entries()) {
          if (tactic.unresolved) continue;
          slots++;
          const { substitutes, incompatible } = analyzeTacticSubstitutes({
            heroName: hero.name, missingTactic: tactic.name, team, heroIndex, slotIndex,
            usage: season.usage, ownedTactics: [...allTactics], tacticRules, limit: 99,
          });
          const others = finalTeamTactics(team, [], { heroIndex, slotIndex });
          for (const { tactic: sub } of substitutes) {
            suggested++;
            assert.deepEqual(ruleProblems(team.unitType, [...others, sub]).filter((p) => !ruleProblems(team.unitType, others).includes(p)), [],
              `${seasonId}/${team.id}: ${sub} for ${tactic.name} breaks team rules`);
          }
          rejected += incompatible.length;
        }
      }
    }
  }
  assert.ok(slots > 1000, `only ${slots} slots exercised`);
  assert.ok(suggested > 0 && rejected > 0, `suggested=${suggested} rejected=${rejected}`);
});

// ---- Món bù đã chọn qua recommendRoster: trạng thái riêng "không tương thích" ----------------------------

function overridePipeline(seasonId, teamId, tacticToReplace, replacement, { skip = [], add = [] } = {}) {
  const season = seasonFrom(seasonId, [teamId]);
  const [team] = season.teams;
  const slot = slotOf(team, tacticToReplace);
  const roster = rosterOf([team], { skipTactics: [tacticToReplace, ...skip] });
  const result = recommendRoster({
    seasonTeams: season.teams, seasonTier: season.teamTier, tacticsDict,
    ownedHeroes: roster.ownedHeroes, ownedTactics: [...roster.ownedTactics, replacement, ...add],
    tacticOverrides: [{ teamId, heroIndex: slot.heroIndex, slotIndex: slot.slotIndex, tactic: replacement }],
  });
  return { team, result };
}

test("hai trận pháp trong một đội T0: 'không tương thích', không phải 'thiếu món'", () => {
  const { team, result } = overridePipeline("pk-s24", FIXTURE_IDS.troopRules, "Mê Hoặc", "Phong Thi Trận");
  assert.equal(team.tier, "T0");
  assert.deepEqual(result.portfolioTeams, []);
  assert.deepEqual(result.blockedStrongTeams, []);
  assert.equal(result.incompatibleTeams.length, 1);
  const [entry] = result.incompatibleTeams;
  assert.equal(entry.team.id, team.id);
  assert.equal(entry.status, "incompatible");
  assert.deepEqual(entry.incompatibleTactics, [{ tactic: "Phong Thi Trận", from: "Mê Hoặc", reason: "formation-limit" }]);
});

test("binh chủng không hợp loại binh (Phi Hùng Quân cho đội khiên) bị chặn", () => {
  const { result } = overridePipeline("pk-s24", FIXTURE_IDS.troopRules, "Mê Hoặc", "Phi Hùng Quân");
  assert.deepEqual(result.portfolioTeams, []);
  assert.deepEqual(result.incompatibleTeams[0].incompatibleTactics.map((i) => i.reason), ["troop-unit-mismatch"]);
});

test("thiếu unitTypesRaw: món bù binh chủng chọn tay bị chặn với lý do riêng", () => {
  const { result } = overridePipeline("pk-s24", FIXTURE_IDS.unitMissing, "Vạn Quân Đoạt Suý", "Phi Hùng Quân");
  assert.deepEqual(result.portfolioTeams, []);
  assert.deepEqual(result.incompatibleTeams[0].incompatibleTactics.map((i) => i.reason), ["troop-unit-unknown"]);
});

test("món bù hợp luật vẫn vào danh sách: bản đã thay, bậc là của cấu hình gốc, chưa được đánh giá", () => {
  const { team, result } = overridePipeline("pk-s24", FIXTURE_IDS.troopRules, "Mê Hoặc", "Hãm Trận Doanh");
  assert.deepEqual(result.incompatibleTeams, []);
  const [entry] = result.portfolioTeams;
  assert.equal(entry.team.id, team.id);
  assert.equal(entry.status, "variant");
  assert.equal(entry.variantUnrated, true);
  assert.equal(entry.originalTier, "T0");
  assert.equal(entry.tier, "T0");
  assert.deepEqual(entry.usedAlternatives, [{ from: "Mê Hoặc", to: "Hãm Trận Doanh" }]);
});

test("biến thể xếp sau đội cùng bậc không bị thay, kể cả khi id đứng trước", () => {
  const plain = (id, hero, tactics) => ({ id, name: id, heroes: [{ name: hero, tactics: tactics.map((name) => ({ name, alternatives: [] })) }] });
  const seasonTeams = [plain("a-substituted", "Tướng A", ["CP 1", "CP 2"]), plain("b-unchanged", "Tướng B", ["CP 3"])];
  const seasonTier = seasonTeams.map((t) => ({ teamId: t.id, rankings: [{ tier: "T0" }] }));
  const base = { seasonTeams, seasonTier, ownedHeroes: ["Tướng A", "Tướng B"], ownedTactics: ["CP 1", "CP 8", "CP 3"], maxTeams: 1 };
  const overrides = [{ teamId: "a-substituted", heroIndex: 0, slotIndex: 1, tactic: "CP 8" }];
  for (const fullBox of [false, true]) {
    const result = recommendRoster({ ...base, fullBox, tacticOverrides: overrides });
    assert.deepEqual(result.portfolioTeams.map((e) => e.team.id), ["b-unchanged"], `fullBox=${fullBox}`);
  }
  // Còn chỗ thì đội bị thay vẫn vào, xếp sau.
  const both = recommendRoster({ ...base, maxTeams: 2, tacticOverrides: overrides });
  assert.deepEqual(both.portfolioTeams.map((e) => [e.team.id, e.variantUnrated]), [["b-unchanged", false], ["a-substituted", true]]);
});

test("biến thể có sẵn trong dữ liệu đội không bị coi là 'chưa được đánh giá'", () => {
  const team = { id: "t", name: "T", heroes: [{ name: "Tướng A", tactics: [{ name: "CP 1", alternatives: ["CP 2"] }] }] };
  const result = recommendRoster({
    seasonTeams: [team], seasonTier: [{ teamId: "t", rankings: [{ tier: "T0" }] }], ownedHeroes: ["Tướng A"], ownedTactics: ["CP 2"],
  });
  assert.equal(result.portfolioTeams[0].status, "variant");
  assert.equal(result.portfolioTeams[0].variantUnrated, false);
});

test("luật đội không áp lên dữ liệu gốc của đội (nguồn có thể lệch luật mùa)", () => {
  const team = {
    id: "orig", name: "Orig", unitType: ["Cung"],
    heroes: [{ name: "Tướng A", tactics: [{ name: "Phi Hùng Quân", alternatives: [] }, { name: "Tượng Binh", alternatives: [] }] }],
  };
  const result = recommendRoster({
    seasonTeams: [team], seasonTier: [{ teamId: "orig", rankings: [{ tier: "T0" }] }],
    ownedHeroes: ["Tướng A"], ownedTactics: ["Phi Hùng Quân", "Tượng Binh"], tacticsDict,
  });
  assert.equal(result.portfolioTeams[0].status, "build-now");
  assert.deepEqual(result.incompatibleTeams, []);
});

test("canonicalTacticId của tên trong từ điển khớp khóa luật", () => {
  assert.ok(tacticRules.has(canonicalTacticId("Phi Hùng Quân")));
  assert.equal(tacticRules.get(canonicalTacticId("Ngư Lân Trận")).kind, "formation");
  assert.equal(tacticRules.get(canonicalTacticId("Phi Hùng Quân")).kind, "troop");
  assert.equal(tacticRules.has(canonicalTacticId("Mê Hoặc")), false);
});

// ---- Đội đủ kho nhưng bị loại vì tranh tướng/chiến pháp với đội đã chọn ---------------------

test("đội đủ kho bị loại vì tranh chiến pháp được trả trong conflictedTeams, nêu món tranh chấp và đội đang giữ", () => {
  const season = seasonFrom("og-兵演春秋", ["og-bingyan-40y-lvbu-b", "og-bingyan-wunv-cavalry-hubaoqi"]);
  const roster = rosterOf(season.teams);
  const result = run(season, roster, { fullBox: true });

  assert.deepEqual(result.portfolioTeams.map((entry) => entry.team.id), ["og-bingyan-40y-lvbu-b"]);
  assert.deepEqual(result.blockedStrongTeams, []);
  const [conflicted, ...rest] = result.conflictedTeams;
  assert.equal(rest.length, 0);
  assert.equal(conflicted.team.id, "og-bingyan-wunv-cavalry-hubaoqi");
  assert.deepEqual(
    conflicted.sharedTactics.map((item) => [item.tactic, item.usedBy]).sort(),
    [["Lâm Nguy Cứu Chủ", "og-bingyan-40y-lvbu-b"], ["Đương Phong Thôi Quyết", "og-bingyan-40y-lvbu-b"]].sort(),
  );
  assert.deepEqual(conflicted.sharedHeroes, []);
});

test("đội đủ kho bị loại chỉ vì hết chỗ (không tranh tướng hay chiến pháp) không vào conflictedTeams", () => {
  const season = seasonFrom("og-兵演春秋", ["og-bingyan-40y-lvbu-b", "og-bingyan-taishi-bow-feixiong"]);
  const roster = rosterOf(season.teams);
  const full = run(season, roster, { fullBox: true });
  assert.equal(full.portfolioTeams.length, 2, "hai đội không dùng chung tài nguyên");

  const capped = run(season, roster, { fullBox: true, maxTeams: 1 });
  assert.equal(capped.portfolioTeams.length, 1);
  assert.deepEqual(capped.conflictedTeams, []);
});
