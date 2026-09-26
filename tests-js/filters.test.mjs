import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeText, teamSearchBlob } from "../js/filters.js";

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

test("teamSearchBlob includes tactic alternatives, not just the primary name", () => {
  const t = team({
    heroes: [{ baseName: "X", name: "X", tactics: [{ name: "Uy Mưu Vô Địch", alternatives: ["Vạn Quân Đoạt Sư"] }], books: [] }],
  });
  assert.ok(teamSearchBlob(t).includes(normalizeText("Vạn Quân Đoạt Sư")));
});

test("normalizeText strips Vietnamese diacritics and đ", () => {
  assert.equal(normalizeText("Đương Phong"), "duong phong");
});

test("teamSearchBlob includes counters", () => {
  const blob = teamSearchBlob(team({ counters: { good: ["Khiên TMY"], avoid: ["Quần Cung"] } }));
  assert.ok(blob.includes("quan cung"));
});

test("teamSearchBlob matches team name and nickname without diacritics", () => {
  const blob = teamSearchBlob(team({ name: "Ninh Từ Thái", nickname: "Hổ Thần Cung" }));
  assert.ok(blob.includes("ninh tu thai"));
  assert.ok(blob.includes("ho than cung"));
});
