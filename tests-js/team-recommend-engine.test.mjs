import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureTeams, fixtureTier } from "./fixtures/team-recommend-fixtures.mjs";
import { recommendTeams } from "../js/team-recommend-engine.js";

const allHeroes = [
  "Hứa Du", "Mã Siêu", "Quan Ngân Bình", "Hoàng Mã", "Tào Tháo",
  "Chu Du", "Lỗ Túc", "Trần Dực", "Cam Ninh", "Thái Sử Từ", "Chu Thái",
  "SP Quách Gia", "CO Chân Cơ", "SP Quan Vũ", "SP Hoàng Trung", "Lưu Bị",
  "Tôn Quyền", "Tô Tín", "Lăng Thống", "Trương Giác", "Chu Thiệu", "Tả Từ",
];

const allTactics = [
  "Thuyền Cỏ Mượn Tên", "Đương Phong Thôi Quyết", "Giải Phiền Vệ",
  "Tạm Lánh Sóng Gió", "Lâm Nguy Cứu Chủ", "Phong Thi Trận",
  "Thừa Địch Bất Ngu", "Toàn Quân Đồng Lòng", "Thôi Phong Đoạn Nhẫn",
  "Quân Cẩm Phàm", "Dốc Sức Tính Kế", "Phi Hùng Quân", "Trung Dũng Nghĩa Liệt",
  "Cưỡi Ngựa Nghìn Dặm", "An Ủi Quân Dân", "Nhất Kỵ Đương Thiên",
  "Lõa Y Huyết Chiến", "Hổ Báo Kỵ", "Thái Bình Đạo Pháp", "Lính Giáp Mây",
  "Cắt Xương Trị Độc",
];

function run(overrides = {}) {
  return recommendTeams({
    teams: fixtureTeams,
    teamTier: fixtureTier,
    ownedHeroes: allHeroes,
    ownedTactics: allTactics,
    maxTeams: 5,
    ...overrides,
  });
}

test("missing any required hero excludes team from main recommendations", () => {
  const result = run({ ownedHeroes: allHeroes.filter((h) => h !== "Hoàng Mã") });

  assert.equal(result.portfolioTeams.some((entry) => entry.team.id === "t0-beta"), false);
  assert.equal(result.blockedStrongTeams.some((entry) => entry.team.id === "t0-beta" && entry.status === "missing-hero"), true);
});

test("locked teams seed portfolio and only add enough teams to reach five total", () => {
  const result = run({
    lockedTeams: [
      { teamName: "Locked 1", heroes: ["A"], tactics: ["A1"] },
      { teamName: "Locked 2", heroes: ["B"], tactics: ["B1"] },
      { teamName: "Locked 3", heroes: ["C"], tactics: ["C1"] },
      { teamName: "Locked 4", heroes: ["D"], tactics: ["D1"] },
    ],
  });

  assert.equal(result.portfolioTeams.length, 5);
  assert.equal(result.addTeams.length, 1);
  assert.equal(result.portfolioTeams.filter((entry) => entry.locked).length, 4);
});

test("selected portfolio never duplicates tactics silently", () => {
  const result = run();
  const tactics = result.portfolioTeams.flatMap((entry) => entry.selectedTactics || []);

  assert.equal(new Set(tactics).size, tactics.length);
  assert.equal(result.portfolioTeams.some((entry) => entry.team?.id === "t1-conflict"), false);
});

test("variant appears only when an explicit alternative tactic is available", () => {
  const result = run({
    ownedTactics: allTactics.filter((t) => t !== "Đoạt Hồn Hiệp Phách"),
  });
  const variant = result.portfolioTeams.find((entry) => entry.team?.id === "t1-variant");

  assert.equal(variant.status, "variant");
  assert.deepEqual(variant.usedAlternatives, [
    { from: "Đoạt Hồn Hiệp Phách", to: "Thừa Địch Bất Ngu" },
  ]);
});

test("no implicit alternative is generated from tactic type or name similarity", () => {
  const result = run({
    ownedTactics: allTactics.filter((t) => t !== "Đương Phong Thôi Quyết"),
  });

  assert.equal(result.portfolioTeams.some((entry) => entry.team?.id === "t0-alpha"), false);
  assert.equal(result.blockedStrongTeams.some((entry) => entry.team.id === "t0-alpha" && entry.status === "missing-tactic"), true);
});

test("full-box search can skip the individually best team for stronger portfolio", () => {
  const result = run({ fullBox: true });

  assert.ok(result.diagnostics.searchedCandidates > 0);
  assert.equal(result.portfolioTeams.length, 5);
  assert.equal(result.portfolioTeams.some((entry) => entry.team?.id === "t0-alpha"), true);
});

test("result includes preset slots even before coexist sets exist", () => {
  const [first] = run().portfolioTeams;

  assert.equal(first.presetId, null);
  assert.equal(first.presetReason, "");
  assert.equal(first.coexistSetBonus, 0);
  assert.equal(first.source, "team");
});
