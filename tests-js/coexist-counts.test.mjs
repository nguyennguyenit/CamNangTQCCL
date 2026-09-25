import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { coexistCounts } from "../js/render.js";

const links = JSON.parse(await readFile(new URL("../data/season-content-links.json", import.meta.url), "utf8"));

test("coexistCounts counts teams, distinct heroes and every duplicated name", () => {
  assert.deepEqual(coexistCounts([]), { teams: 0, heroes: 0, duplicates: [] });
  const teams = [
    { heroes: [{ name: "A" }, { name: "B" }, { name: "C" }] },
    { heroes: [{ name: "C" }, { name: "D" }, { name: "E" }] },
  ];
  assert.deepEqual(coexistCounts(teams), { teams: 2, heroes: 5, duplicates: ["C"] });
  // Tên rỗng không được tính là một tướng, thiếu mảng tướng cũng không làm hỏng phép đếm.
  assert.deepEqual(coexistCounts([{ heroes: [{ name: "" }, { name: "A" }, { name: "A" }] }, {}]),
    { teams: 2, heroes: 1, duplicates: ["A"] });
});

test("every reviewed source group keeps fifteen distinct heroes and no duplicates", () => {
  const payloads = links
    .filter((link) => link.target.type === "source-owned-coexist")
    .map((link) => link.target.payload);
  assert.ok(payloads.length > 0);
  for (const payload of payloads) {
    const counts = coexistCounts(payload.teams.map((team) => ({
      heroes: team.heroes.map((hero) => ({ name: hero.nameRaw.trim() })),
    })));
    assert.equal(counts.teams, 5, `${payload.groupLabel}: số đội`);
    assert.equal(payload.teams.every((team) => team.heroes.length === 3), true, `${payload.groupLabel}: ba tướng mỗi đội`);
    assert.equal(counts.heroes, 15, `${payload.groupLabel}: số tướng khác nhau`);
    assert.deepEqual(counts.duplicates, [], `${payload.groupLabel}: không tướng nào trùng`);
  }
});
