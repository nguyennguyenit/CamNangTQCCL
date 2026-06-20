import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFilters, emptyState, normalizeText, teamSearchBlob } from "../js/filters.js";

function team(over) {
  return {
    id: "t",
    rawType: "Thương",
    unitType: ["Thương"],
    faction: null,
    stars: 5,
    status: "meta",
    heroes: [
      { baseName: "Mã Siêu", name: "SP Mã Siêu", tactics: [{ name: "Đương Phong", alternatives: [] }], books: [] },
    ],
    counters: { good: [], avoid: [] },
    notes: null,
    ...over,
  };
}

test("empty state returns all", () => {
  const teams = [team(), team({ stars: 4 })];
  assert.equal(applyFilters(teams, emptyState()).length, 2);
});

test("AND between groups", () => {
  const teams = [
    team({ stars: 5, unitType: ["Thương"] }),
    team({ stars: 5, unitType: ["Kỵ"] }),
  ];
  const s = emptyState();
  s.stars.add("5");
  s.unitTypes.add("Thương");
  assert.equal(applyFilters(teams, s).length, 1);
});

test("OR within a group", () => {
  const teams = [team({ stars: 5 }), team({ stars: 4 }), team({ stars: 4.5 })];
  const s = emptyState();
  s.stars.add("5");
  s.stars.add("4");
  assert.equal(applyFilters(teams, s).length, 2);
});

test("matches tactic alternatives (not just primary)", () => {
  const t = team({
    heroes: [
      {
        baseName: "X",
        name: "X",
        tactics: [{ name: "Uy Mưu Vô Địch", alternatives: ["Vạn Quân Đoạt Sư"] }],
        books: [],
      },
    ],
  });
  const s = emptyState();
  s.tactics.add("Vạn Quân Đoạt Sư"); // chỉ có ở vế alternatives
  assert.equal(applyFilters([t], s).length, 1);
});

test("full-text search is diacritic-insensitive", () => {
  const t = team({ heroes: [{ baseName: "Mã Siêu", name: "SP Mã Siêu", tactics: [], books: [] }] });
  const s = emptyState();
  s.query = "ma sieu";
  assert.equal(applyFilters([t], s).length, 1);
});

test("search miss returns empty", () => {
  const s = emptyState();
  s.query = "khong-ton-tai-xyz";
  assert.equal(applyFilters([team()], s).length, 0);
});

test("normalizeText strips Vietnamese diacritics and đ", () => {
  assert.equal(normalizeText("Đương Phong"), "duong phong");
});

test("teamSearchBlob includes counters", () => {
  const blob = teamSearchBlob(team({ counters: { good: ["Khiên TMY"], avoid: ["Quần Cung"] } }));
  assert.ok(blob.includes("quan cung"));
});
