import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendRoster } from "../js/roster-season-candidates.js";
import { createRawNameResolver } from "../js/website-display.js";
import { buildConflictView, CONFLICT_CARD_LIMIT } from "../js/roster-conflict-view.js";
import { realData, rosterOf, seasonFrom } from "./fixtures/roster-adapter-fixtures.mjs";

const { tacticsDict, heroesDict } = realData();
const SEASON = "og-兵演春秋";
const LVBU = "og-bingyan-40y-lvbu-b";
const WUNV = "og-bingyan-wunv-cavalry-hubaoqi";

const run = (season, roster, extra = {}) => recommendRoster({
  seasonTeams: season.teams, seasonTier: season.teamTier, tacticsDict, ...roster, fullBox: true, ...extra,
});
const issueResult = () => {
  const season = seasonFrom(SEASON, [LVBU, WUNV]);
  return run(season, rosterOf(season.teams));
};

test("ví dụ của issue: một thẻ Ngô Nữ Kỵ, 2 chiến pháp bị tranh, 0 tướng, đội giữ hiện bằng tên", () => {
  const view = buildConflictView(issueResult());
  assert.equal(view.cards.length, 1);
  assert.equal(view.hiddenCount, 0);
  const [card] = view.cards;
  assert.equal(card.teamId, WUNV);
  assert.equal(card.label, "Ngô Nữ Kỵ (Tinh·Hổ Báo Kỵ)");
  assert.equal(card.tier, "T0");
  assert.equal(card.items.filter((item) => item.kind === "hero").length, 0);
  assert.deepEqual(card.items.filter((item) => item.kind === "tactic").map((item) => item.name).sort(), ["Lâm Nguy Cứu Chủ", "Đương Phong Thôi Quyết"]);
  for (const item of card.items) {
    assert.equal(item.holderLabel, "40Y Lữ Bố Cung (Vương Dị, Pháp Chính)");
    assert.notEqual(item.holderLabel, LVBU);
  }
});

test("kho không tranh chấp (chỉ hết chỗ): view model rỗng", () => {
  const season = seasonFrom(SEASON, [LVBU, "og-bingyan-taishi-bow-feixiong"]);
  const capped = run(season, rosterOf(season.teams), { maxTeams: 1 });
  assert.deepEqual(buildConflictView(capped), { cards: [], hiddenCount: 0 });
  assert.deepEqual(buildConflictView({}), { cards: [], hiddenCount: 0 });
});

test("tranh tướng: thẻ liệt kê tướng kèm đội giữ", () => {
  const team = (id, name) => ({ id, name });
  const result = {
    portfolioTeams: [{ team: team("a", "Đội A") }],
    conflictedTeams: [{
      team: team("b", "Đội B"), tier: "T1",
      sharedHeroes: [{ hero: "Tướng X", heroId: "hx", usedBy: "a" }],
      sharedTactics: [],
    }],
  };
  const [card] = buildConflictView(result).cards;
  assert.deepEqual(card.items, [{ kind: "hero", name: "Tướng X", holderLabel: "Đội A" }]);
  assert.equal(card.tier, "T1");
});

test("đội giữ là đội khóa: tên lấy từ teamName", () => {
  // Engine lọc sớm mọi đội đụng món của đội khóa (diagnostics.tacticConflicts) nên dữ liệu thật hiếm khi tới đây;
  // hợp đồng của view model vẫn là tên đội khóa, không phải id `locked-0`.
  const result = {
    portfolioTeams: [{ locked: true, team: { id: "locked-0", name: "Đội của tôi" } }],
    conflictedTeams: [{
      team: { id: "b", name: "Đội B" }, tier: "T0", sharedHeroes: [],
      sharedTactics: [{ tactic: "Lâm Nguy Cứu Chủ", tacticId: "x", usedBy: "locked-0" }],
    }],
  };
  assert.deepEqual(buildConflictView(result).cards[0].items.map((item) => item.holderLabel), ["Đội của tôi"]);
});

test("id đội giữ không có trong danh mục: nhãn dự phòng, không hiện id", () => {
  const result = {
    portfolioTeams: [],
    conflictedTeams: [{
      team: { id: "b", name: "Đội B" }, tier: "T0", sharedHeroes: [],
      sharedTactics: [{ tactic: "Chiến pháp Y", tacticId: "ty", usedBy: "id-la-hoac-hoa" }],
    }],
  };
  const [item] = buildConflictView(result, { fallbackHolder: "một đội đã chọn" }).cards[0].items;
  assert.equal(item.holderLabel, "một đội đã chọn");
  assert.ok(!JSON.stringify(item).includes("id-la-hoac-hoa"));
});

test("hơn 5 xung đột: 5 thẻ và số đội ẩn", () => {
  const conflictedTeams = Array.from({ length: 8 }, (_, i) => ({
    team: { id: `t${i}`, name: `Đội ${i}` }, tier: "T0", sharedHeroes: [],
    sharedTactics: [{ tactic: `CP ${i}`, tacticId: `c${i}`, usedBy: "a" }],
  }));
  const view = buildConflictView({ portfolioTeams: [{ team: { id: "a", name: "A" } }], conflictedTeams });
  assert.equal(CONFLICT_CARD_LIMIT, 5);
  assert.equal(view.cards.length, 5);
  assert.equal(view.hiddenCount, 3);
  assert.deepEqual(view.cards.map((card) => card.teamId), ["t0", "t1", "t2", "t3", "t4"]);
});

test("zh: tên tướng chữ Hán, tên chiến pháp qua resolver zh", () => {
  const resolve = createRawNameResolver(heroesDict, tacticsDict);
  const zh = (name) => resolve(name) ?? name;
  const teamLabel = (team) => (team.heroes || []).map((hero) => zh(hero.name ?? hero)).join(" · ") || team.name;
  const season = seasonFrom(SEASON, [LVBU, WUNV]);
  const result = run(season, rosterOf(season.teams));
  const [card] = buildConflictView(result, { teamLabel, tacticName: zh, heroName: zh }).cards;
  const han = /\p{Script=Han}/u;
  assert.match(card.label, han);
  assert.doesNotMatch(card.label, /[a-zà-ỹ]/iu);
  for (const item of card.items) {
    assert.match(item.name, han);
    assert.match(item.holderLabel, han);
  }
});
