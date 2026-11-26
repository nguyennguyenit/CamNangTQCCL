import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POOL_LIMIT, recommendTeams } from "../js/team-recommend-engine.js";
import { recommendRoster } from "../js/roster-season-candidates.js";

/**
 * Mode meta với `metaSearch`: danh sách tối ưu theo khóa thứ tự (số đội T0+T0.5, số T0, số đội, tổng điểm nguồn,
 * tổng hột) bằng DFS cắt nhánh, thay vì tham lam theo đội đầu bảng. Website chưa bật nên mặc định giữ hành vi cũ.
 */

/** Đội ba tướng không chiến pháp; `score` là điểm nguồn (khóa phụ). */
const team = (id, heroes, score = null) => ({ id, name: id, ...(score === null ? {} : { score }), heroes: heroes.map((name) => ({ name, tactics: [] })) });
const tier = (teamId, value) => ({ teamId, rankings: [{ tier: value }] });
const ids = (result) => result.portfolioTeams.map((entry) => entry.team.id);

function call(teams, teamTier, overrides = {}) {
  const ownedHeroes = [...new Set(teams.flatMap((entry) => entry.heroes.map((hero) => hero.name)))];
  return recommendTeams({ teams, teamTier, ownedHeroes, ownedTactics: [], mode: "meta", maxTeams: 5, ...overrides });
}

// Đội T0 đầu bảng giữ hai tướng mà hai đội T0.5 cần: tham lam lấy T0 rồi chỉ còn đội T1.
const blocking = [
  team("a-t0", ["X", "Y", "Z"]),
  team("b-t05", ["X", "B1", "B2"]),
  team("c-t05", ["Y", "C1", "C2"]),
  team("d-t1", ["D1", "D2", "D3"]),
];
const blockingTier = [tier("a-t0", "T0"), tier("b-t05", "T0.5"), tier("c-t05", "T0.5"), tier("d-t1", "T1")];

test("metaSearch đổi đội T0 đầu bảng lấy hai đội T0.5: nhiều đội T0+T0.5 hơn", () => {
  assert.deepEqual(ids(call(blocking, blockingTier)), ["a-t0", "d-t1"]);
  const result = call(blocking, blockingTier, { metaSearch: true });
  assert.deepEqual(ids(result), ["b-t05", "c-t05", "d-t1"]);
  assert.equal(result.diagnostics.searchCapped, false);
  assert.ok(result.diagnostics.searchedCandidates > 0);
});

test("metaSearch chỉ áp cho mode meta; mode redStars giữ đường cũ", () => {
  const plain = call(blocking, blockingTier, { mode: "redStars" });
  assert.deepEqual(ids(call(blocking, blockingTier, { mode: "redStars", metaSearch: true })), ids(plain));
});

test("hòa số đội T0+T0.5 thì nhiều đội T0 hơn thắng", () => {
  // Một T0 + một T0.5 (tham lam) so với một T0 + một T0.5 khác cộng thêm... cùng 2 đội đỉnh: phải chọn bộ có 2 T0.
  const teams = [
    team("t0-a", ["P", "Q", "R"]),
    team("t0-b", ["P", "S1", "S2"]),
    team("t0-c", ["Q", "U1", "U2"]),
    team("t05-d", ["V1", "V2", "V3"]),
  ];
  const tiers = [tier("t0-a", "T0"), tier("t0-b", "T0"), tier("t0-c", "T0"), tier("t05-d", "T0.5")];
  // Tham lam: t0-a chặn t0-b và t0-c → {t0-a, t05-d}: 2 đội đỉnh, 1 T0. Tìm: {t0-b, t0-c, t05-d}: 3 đội đỉnh.
  assert.deepEqual(ids(call(teams, tiers, { metaSearch: true })), ["t0-b", "t0-c", "t05-d"]);
  // Cùng 2 đội đỉnh (maxTeams 2): chọn 2 T0 thay vì T0 + T0.5.
  assert.deepEqual(ids(call(teams, tiers, { metaSearch: true, maxTeams: 2 })), ["t0-b", "t0-c"]);
});

test("hòa số đội đỉnh và T0 thì nhiều đội hơn thắng, rồi tổng điểm nguồn, rồi tổng hột", () => {
  // Số đội: t1-a chặn hai đội T1 còn lại.
  const byCount = [team("t1-a", ["M", "N", "O"]), team("t1-b", ["M", "B1", "B2"]), team("t1-c", ["N", "C1", "C2"])];
  const countTier = byCount.map((entry) => tier(entry.id, "T1"));
  assert.deepEqual(ids(call(byCount, countTier, { metaSearch: true })), ["t1-b", "t1-c"]);

  // Điểm nguồn: cùng một đội T0, đội điểm cao hơn thắng dù xếp sau.
  const byScore = [team("s1-low", ["K", "L1", "L2"], 80), team("s2-high", ["K", "H1", "H2"], 120)];
  const scoreTier = byScore.map((entry) => tier(entry.id, "T0"));
  assert.deepEqual(ids(call(byScore, scoreTier, { maxTeams: 1 })), ["s1-low"]);
  assert.deepEqual(ids(call(byScore, scoreTier, { metaSearch: true, maxTeams: 1 })), ["s2-high"]);

  // Hột: cùng bậc, cùng điểm; đội có tướng nhiều hột hơn thắng.
  const byRed = [team("r-a", ["J", "A1", "A2"], 100), team("r-b", ["J", "R1", "R2"], 100)];
  const redTier = byRed.map((entry) => tier(entry.id, "T0"));
  const ownedHeroes = ["J", "A1", "A2", { name: "R1", redStars: 5 }, "R2"];
  // Không tìm: hột đã là khóa phụ của thứ tự xếp hạng; có tìm: hột là khóa cuối của danh sách.
  assert.deepEqual(ids(call(byRed, redTier, { ownedHeroes, maxTeams: 1 })), ["r-b"]);
  assert.deepEqual(ids(call(byRed, redTier, { ownedHeroes, metaSearch: true, maxTeams: 1 })), ["r-b"]);
});

test("đội đã thay món không tính điểm nguồn", () => {
  const teams = [
    team("orig", ["K", "O1", "O2"], 90),
    { ...team("swapped", ["K", "W1", "W2"], 200), heroes: [{ name: "K", tactics: [{ name: "Món Gốc", userAlternatives: ["Món Bù"], alternatives: ["Món Bù"] }] }, { name: "W1", tactics: [] }, { name: "W2", tactics: [] }] },
  ];
  const tiers = teams.map((entry) => tier(entry.id, "T0"));
  const result = call(teams, tiers, { ownedTactics: ["Món Bù"], metaSearch: true, maxTeams: 1 });
  assert.deepEqual(ids(result), ["orig"]);
});

test("chạm trần nút thì trả danh sách tốt nhất đã thấy và báo searchCapped", () => {
  // Trần nhỏ (mặc định SEARCH_NODE_LIMIT): kết quả không bao giờ kém danh sách tham lam ban đầu.
  const capped = call(blocking, blockingTier, { metaSearch: true, searchNodeLimit: 2 });
  assert.equal(capped.diagnostics.searchCapped, true);
  assert.equal(capped.diagnostics.searchedCandidates, 2);
  assert.deepEqual(ids(capped), ["a-t0", "d-t1"]);
  // Đủ nút để đi tới lá thứ hai: đã thấy danh sách tốt hơn thì trả danh sách đó dù chưa duyệt hết.
  const partial = call(blocking, blockingTier, { metaSearch: true, searchNodeLimit: 9 });
  assert.equal(partial.diagnostics.searchCapped, true);
  assert.deepEqual(ids(partial), ["b-t05", "c-t05", "d-t1"]);
});

test("pool của metaSearch luôn gồm mọi đội T0/T0.5; đội bậc khác vượt poolLimit thì báo searchPoolTruncated", () => {
  assert.equal(call(blocking, blockingTier, { metaSearch: true }).diagnostics.searchPoolTruncated, false);
  // poolLimit 2 nhưng có 3 đội T0/T0.5: pool vẫn gồm cả ba, chỉ đội T1 bị cắt rồi được lấp lại sau tìm kiếm.
  const truncated = call(blocking, blockingTier, { metaSearch: true, poolLimit: 2 });
  assert.equal(truncated.diagnostics.searchPoolTruncated, true);
  assert.deepEqual(ids(truncated), ["b-t05", "c-t05", "d-t1"]);
  // 61 đội T0.5 độc lập vượt poolLimit nhưng đều vào pool; 61 đội T1 thì bị cắt.
  const tops = Array.from({ length: DEFAULT_POOL_LIMIT + 1 }, (_, index) => team(`q-${String(index).padStart(2, "0")}`, [`q${index}-1`, `q${index}-2`, `q${index}-3`]));
  assert.equal(call(tops, tops.map((entry) => tier(entry.id, "T0.5")), { metaSearch: true }).diagnostics.searchPoolTruncated, false);
  const many = Array.from({ length: DEFAULT_POOL_LIMIT + 1 }, (_, index) => team(`p-${String(index).padStart(2, "0")}`, [`p${index}-1`, `p${index}-2`, `p${index}-3`]));
  assert.equal(call(many, many.map((entry) => tier(entry.id, "T1")), { metaSearch: true }).diagnostics.searchPoolTruncated, true);
});

test("recommendRoster: chạm trần ở lượt bù đội cũ cũng được báo", () => {
  // Lượt mùa: một đội, không chạm trần. Lượt đội cũ: bốn đội tranh tướng, trần nhỏ chạm ở lượt này.
  const seasonTeams = [team("season-only", ["S1", "S2", "S3"])];
  const seasonTier = [tier("season-only", "T0")];
  const ownedHeroes = [...new Set([...seasonTeams, ...blocking].flatMap((entry) => entry.heroes.map((hero) => hero.name)))];
  const options = { seasonTeams, seasonTier, legacyTeams: blocking, legacyTier: blockingTier, ownedHeroes, ownedTactics: [], mode: "meta", metaSearch: true, maxTeams: 5, searchNodeLimit: 4 };
  const seasonOnly = recommendTeams({ teams: seasonTeams, teamTier: seasonTier, ownedHeroes, ownedTactics: [], mode: "meta", metaSearch: true, maxTeams: 5, searchNodeLimit: 4 });
  assert.equal(seasonOnly.diagnostics.searchCapped, false);
  const result = recommendRoster(options);
  assert.equal(result.legacyUsed, true);
  assert.equal(result.diagnostics.searchCapped, true);
  // Không trần: cả hai lượt đều duyệt hết.
  assert.equal(recommendRoster({ ...options, searchNodeLimit: undefined }).diagnostics.searchCapped, false);
});
