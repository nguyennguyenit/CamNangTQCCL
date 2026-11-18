import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSeasonCandidates, recommendRoster } from "../js/roster-season-candidates.js";
import { addMissingItems, teamMissingItems, undoAddedItems } from "../js/roster-team-missing-items-bulk-add.js";

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const heroesDict = read("data/heroes-dict.json");
const tacticsDict = read("data/tactics.json");
const { generationId } = read("src/data/recommended-reference/current.json");
const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
const { defaultSourceSeasonId } = read(`src/data/recommended-reference/${generationId}/seasons.json`);
const season = buildSeasonCandidates(records, defaultSourceSeasonId, { heroesDict, tacticsDict });

// Đội T0–T1 (chế độ Meta chỉ đưa các bậc này vào Thiếu món), ba tướng một tên, mỗi tướng hai chiến pháp đã đối chiếu.
const team = season.teams.find((item) => ["T0", "T0.5", "T1"].includes(item.tier)
  && item.heroes.length === 3
  && item.heroes.every((hero) => !hero.name.includes("/") && hero.tactics.length === 2 && hero.tactics.every((tactic) => !tactic.unresolved && !(tactic.alternatives || []).length)));
assert.ok(team, "cần một đội T0–T1 đủ 3 tướng × 2 chiến pháp");
const teamHeroes = team.heroes.map((hero) => hero.name);
const teamTactics = team.heroes.flatMap((hero) => hero.tactics.map((tactic) => tactic.name));

const recommend = (state) => recommendRoster({
  seasonTeams: season.teams,
  seasonTier: season.teamTier,
  ownedHeroes: state.ownedHeroes,
  ownedTactics: state.ownedTactics,
  tacticOverrides: state.tacticOverrides,
  tacticsDict,
  mode: "meta",
  keepExistingTeams: true,
});
const kho = (heroes, tactics) => ({
  ownedHeroes: heroes.map((name) => ({ name })),
  ownedTactics: tactics.map((name) => ({ name })),
  lockedTeams: [],
  tacticOverrides: [],
  confirmed: true,
});
const blockedEntry = (result) => result.blockedStrongTeams.find((entry) => entry.team.id === team.id);
const builtEntry = (result) => result.portfolioTeams.find((entry) => entry.team.id === team.id);

test("đội thiếu 2 chiến pháp: gom đúng 2 món thẻ liệt kê, thêm xong đội chuyển sang Có thể xây dựng ngay", () => {
  const dropped = [teamTactics[0], teamTactics[3]];
  const state = kho(teamHeroes, teamTactics.filter((name) => !dropped.includes(name)));
  const entry = blockedEntry(recommend(state));
  assert.equal(entry?.status, "missing-tactic");
  const items = teamMissingItems(entry);
  assert.deepEqual(items, dropped.map((name) => ({ type: "tactics", name })));

  const { state: next, added } = addMissingItems(state, items);
  assert.deepEqual(added, items);
  const after = recommend(next);
  assert.equal(blockedEntry(after), undefined);
  assert.equal(builtEntry(after)?.status, "build-now");
});

test("đội thiếu tướng: chỉ gom các tướng thẻ liệt kê (engine chưa xét chiến pháp), không thêm hộ chiến pháp", () => {
  const state = kho(teamHeroes.slice(2), teamTactics);
  const entry = blockedEntry(recommend(state));
  assert.equal(entry?.status, "missing-hero");
  const items = teamMissingItems(entry);
  assert.deepEqual(items, entry.missingHeroSlotNames.map((names) => ({ type: "heroes", name: names[0] })));
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.type === "heroes"));

  const { state: next } = addMissingItems(state, items);
  assert.equal(builtEntry(recommend(next))?.status, "build-now");

  // Thiếu cả tướng lẫn chiến pháp: lần bấm đầu chỉ thêm tướng, đội chuyển sang thiếu chiến pháp với đúng ô còn thiếu.
  const partial = kho(teamHeroes.slice(2), teamTactics.slice(1));
  const { state: heroesAdded } = addMissingItems(partial, teamMissingItems(blockedEntry(recommend(partial))));
  const nextEntry = blockedEntry(recommend(heroesAdded));
  assert.equal(nextEntry?.status, "missing-tactic");
  assert.deepEqual(teamMissingItems(nextEntry), [{ type: "tactics", name: teamTactics[0] }]);
});

test("Hoàn tác gỡ đúng các món vừa thêm; món đã có từ trước không bị gỡ và không tính là vừa thêm", () => {
  const state = kho(teamHeroes, ["Món riêng", ...teamTactics.slice(2)]);
  const items = [{ type: "tactics", name: teamTactics[0] }, { type: "tactics", name: teamTactics[1] }, { type: "tactics", name: teamTactics[2] }];
  const { state: next, added } = addMissingItems(state, items);
  // teamTactics[2] đã có trong kho.
  assert.deepEqual(added.map((item) => item.name), [teamTactics[0], teamTactics[1]]);
  assert.equal(next.ownedTactics.length, state.ownedTactics.length + 2);
  assert.equal(next.confirmed, false);

  const undone = undoAddedItems(next, added);
  assert.deepEqual(undone.ownedTactics.map((item) => item.name), state.ownedTactics.map((item) => item.name));
  assert.deepEqual(undone.ownedHeroes.map((item) => item.name), teamHeroes);
});

test("bỏ tên rỗng, loại món lạ và tên trùng trong danh sách món thiếu", () => {
  const items = teamMissingItems({
    status: "missing-tactic",
    missingTacticSlots: [{ tactic: "A" }, { tactic: "A" }, { tactic: "" }, { tactic: "B" }],
  });
  assert.deepEqual(items, [{ type: "tactics", name: "A" }, { type: "tactics", name: "B" }]);
  const { added } = addMissingItems(kho([], []), [{ type: "books", name: "Sách" }, { type: "heroes", name: " " }, ...items]);
  assert.deepEqual(added, items);
});
