import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureTeams, fixtureTier } from "./fixtures/team-recommend-fixtures.mjs";
import { normalizeTeamCandidate, recommendTeams } from "../js/team-recommend-engine.js";

const allHeroes = [
  "Hứa Du", "SP Mã Siêu", "Quan Ngân Bình", "Hoàng Mã", "Tào Tháo",
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

test("locked canonical IDs giữ nguyên namespace và chặn tái sử dụng resource", () => {
  const team = {
    id: "would-reuse-locked",
    name: "Would reuse locked",
    heroes: [
      {
        name: "Tướng A",
        tactics: [{ name: "Dùng Chung", alternatives: [] }],
      },
    ],
  };
  const result = recommendTeams({
    teams: [team],
    teamTier: [{ teamId: team.id, rankings: [{ tier: "T0" }] }],
    ownedHeroes: [{ name: "Tướng A", canonicalId: "hero:tuong-a" }],
    ownedTactics: [{ name: "Dùng Chung", canonicalId: "tactic:dung-chung" }],
    lockedTeams: [
      {
        teamName: "Locked",
        heroes: ["hero:tuong-a"],
        tactics: ["tactic:dung-chung"],
      },
    ],
    maxTeams: 2,
  });

  assert.equal(result.portfolioTeams.length, 1);
  assert.equal(result.portfolioTeams[0].heroAssignments[0].canonicalId, "hero:tuong-a");
  assert.equal(result.portfolioTeams.some((entry) => entry.team.id === team.id), false);
});

test("locked team giữ canonical team ID và tactic assignment theo holder", () => {
  const result = recommendTeams({
    lockedTeams: [
      {
        teamId: "team:locked-a",
        teamName: "Đội đã khóa",
        heroes: ["hero:tuong-a"],
        tactics: ["tactic:dung-chung"],
        tacticAssignments: [
          {
            holderId: "hero:tuong-a",
            tacticId: "tactic:dung-chung",
            slotIndex: 1,
          },
        ],
      },
    ],
    maxTeams: 1,
  });

  assert.equal(result.portfolioTeams[0].team.id, "team:locked-a");
  assert.deepEqual(result.portfolioTeams[0].tacticSelections, [
    {
      holderId: "hero:tuong-a",
      slotIndex: 1,
      selectedTactic: "tactic:dung-chung",
      selectedTacticId: "tactic:dung-chung",
      alternatives: ["tactic:dung-chung"],
      reason: "locked",
      downgrade: false,
    },
  ]);
});

test("locked assignments thiếu slotIndex được suy ra ổn định theo từng holder", () => {
  const result = recommendTeams({
    lockedTeams: [
      {
        teamId: "team:locked-a",
        heroes: ["hero:tuong-a"],
        tactics: ["tactic:a", "tactic:b"],
        tacticAssignments: [
          { holderId: "hero:tuong-a", tacticId: "tactic:a" },
          { holderId: "hero:tuong-a", tacticId: "tactic:b" },
        ],
      },
    ],
    maxTeams: 1,
  });

  assert.deepEqual(
    result.portfolioTeams[0].tacticSelections.map(({ slotIndex }) => slotIndex),
    [0, 1],
  );
});

test("locked assignments suy slot không đè slot tường minh xuất hiện sau", () => {
  const result = recommendTeams({
    lockedTeams: [
      {
        teamId: "team:locked-a",
        heroes: ["hero:tuong-a"],
        tactics: ["tactic:a", "tactic:b"],
        tacticAssignments: [
          { holderId: "hero:tuong-a", tacticId: "tactic:a" },
          { holderId: "hero:tuong-a", tacticId: "tactic:b", slotIndex: 0 },
        ],
      },
    ],
    maxTeams: 1,
  });

  assert.deepEqual(
    result.portfolioTeams[0].tacticSelections.map(({ slotIndex }) => slotIndex),
    [1, 0],
  );
});

test("hai locked teams trùng resource đều bị loại thay vì chọn đội đầu", () => {
  const result = recommendTeams({
    lockedTeams: [
      {
        teamName: "Locked A",
        heroes: ["hero:tuong-a"],
        tactics: ["tactic:dung-chung"],
      },
      {
        teamName: "Locked B",
        heroes: ["hero:tuong-a"],
        tactics: ["tactic:dung-chung"],
      },
    ],
    maxTeams: 2,
  });

  assert.equal(result.portfolioTeams.length, 0);
  assert.equal(result.diagnostics.heroConflicts.length, 2);
  assert.equal(result.diagnostics.tacticConflicts.length, 2);
});

test("selected portfolio never duplicates tactics silently", () => {
  const result = run();
  const tactics = result.portfolioTeams.flatMap((entry) => entry.selectedTactics || []);

  assert.equal(new Set(tactics).size, tactics.length);
  assert.equal(result.portfolioTeams.some((entry) => entry.team?.id === "t1-conflict"), false);
});

test("một candidate không được dùng cùng tướng cho hai slot", () => {
  const team = {
    id: "overlapping-hero-slots",
    name: "Overlapping heroes",
    heroes: [
      {
        name: "Tướng A",
        tactics: [{ name: "Chiến Pháp A", alternatives: [] }],
      },
      {
        name: "Tướng A/Tướng B",
        tactics: [{ name: "Chiến Pháp B", alternatives: [] }],
      },
    ],
  };
  const result = recommendTeams({
    teams: [team],
    teamTier: [{ teamId: team.id, rankings: [{ tier: "T0" }] }],
    ownedHeroes: ["Tướng A"],
    ownedTactics: ["Chiến Pháp A", "Chiến Pháp B"],
    maxTeams: 1,
  });

  assert.equal(result.portfolioTeams.length, 0);
  assert.equal(result.diagnostics.heroConflicts[0].teamId, team.id);
});

test("một candidate không được dùng cùng chiến pháp cho hai slot", () => {
  const team = {
    id: "duplicate-tactic-slots",
    name: "Duplicate tactics",
    heroes: [
      {
        name: "Tướng A",
        tactics: [{ name: "Dùng Chung", alternatives: [] }],
      },
      {
        name: "Tướng B",
        tactics: [{ name: "Dùng Chung", alternatives: [] }],
      },
    ],
  };
  const result = recommendTeams({
    teams: [team],
    teamTier: [{ teamId: team.id, rankings: [{ tier: "T0" }] }],
    ownedHeroes: ["Tướng A", "Tướng B"],
    ownedTactics: ["Dùng Chung"],
    maxTeams: 1,
  });

  assert.equal(result.portfolioTeams.length, 0);
  assert.equal(result.diagnostics.tacticConflicts[0].teamId, team.id);
});

test("assignment backtrack để tránh false-negative ở slot ít lựa chọn", () => {
  const team = {
    id: "constrained-assignment",
    name: "Constrained assignment",
    heroes: [
      {
        name: "Tướng A/Tướng B",
        tactics: [{ name: "Chiến Pháp X", alternatives: ["Chiến Pháp Y"] }],
      },
      {
        name: "Tướng A",
        tactics: [{ name: "Chiến Pháp X", alternatives: [] }],
      },
    ],
  };
  const result = recommendTeams({
    teams: [team],
    teamTier: [{ teamId: team.id, rankings: [{ tier: "T0" }] }],
    ownedHeroes: ["Tướng A", "Tướng B"],
    ownedTactics: ["Chiến Pháp X", "Chiến Pháp Y"],
    maxTeams: 1,
  });

  assert.deepEqual(
    result.portfolioTeams[0].heroAssignments.map(({ canonicalId }) => canonicalId),
    ["hero:tuong-b", "hero:tuong-a"],
  );
  assert.deepEqual(result.portfolioTeams[0].selectedTactics, [
    "Chiến Pháp Y",
    "Chiến Pháp X",
  ]);
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
  assert.equal(result.portfolioTeams.length, 4);
  assert.equal(result.portfolioTeams.every(({ tier }) => ["T0", "T0.5", "T1"].includes(tier)), true);
  assert.equal(result.portfolioTeams.some((entry) => entry.team?.id === "t0-alpha"), true);
});

test("result includes preset slots even before coexist sets exist", () => {
  const [first] = run().portfolioTeams;

  assert.equal(first.presetId, null);
  assert.equal(first.presetReason, "");
  assert.equal(first.coexistSetBonus, 0);
  assert.equal(first.source, "team");
});

test("base hero không thỏa team cần SP cùng family", () => {
  const team = {
    id: "sp-required",
    name: "SP required",
    heroes: [
      {
        name: "SP Tuân Úc",
        baseName: "Tuân Úc",
        isSP: true,
        tactics: [{ name: "Thuyền Cỏ Mượn Tên", alternatives: [] }],
      },
    ],
  };
  const result = recommendTeams({
    teams: [team],
    teamTier: [{ teamId: "sp-required", rankings: [{ tier: "T0" }] }],
    ownedHeroes: ["Tuân Úc"],
    ownedTactics: ["Thuyền Cỏ Mượn Tên"],
    maxTeams: 1,
  });

  assert.equal(result.portfolioTeams.length, 0);
  assert.deepEqual(result.blockedStrongTeams[0].missingHeroSlots, [
    ["hero:sp-tuan-uc"],
  ]);
});

test("combined slot được thỏa bởi alternative thứ hai đúng một lần", () => {
  const team = {
    id: "combined",
    name: "Combined",
    heroes: [
      {
        name: "SP Lữ Mông/Trình Phổ",
        baseName: "Lữ Mông",
        tactics: [{ name: "An Ủi Quân Dân", alternatives: [] }],
      },
    ],
  };
  const candidate = normalizeTeamCandidate(team);
  const result = recommendTeams({
    teams: [team],
    teamTier: [{ teamId: "combined", rankings: [{ tier: "T1" }] }],
    ownedHeroes: ["Trình Phổ"],
    ownedTactics: ["An Ủi Quân Dân"],
    maxTeams: 1,
  });

  assert.equal(candidate.heroSlots.length, 1);
  assert.deepEqual(candidate.heroSlots[0].alternatives.map((item) => item.canonicalId), [
    "hero:sp-lu-mong",
    "hero:trinh-pho",
  ]);
  assert.equal(result.portfolioTeams[0].heroAssignments[0].canonicalId, "hero:trinh-pho");
});

test("tier xếp trước red copies trong meta mode", () => {
  const makeTeam = (id, hero, tactic) => ({
    id,
    name: id,
    heroes: [{ name: hero, baseName: hero, tactics: [{ name: tactic, alternatives: [] }] }],
  });
  const result = recommendTeams({
    teams: [
      makeTeam("t05-many-red", "Tướng B", "Chiến Pháp B"),
      makeTeam("t0-no-red", "Tướng A", "Chiến Pháp A"),
    ],
    teamTier: [
      { teamId: "t05-many-red", rankings: [{ tier: "T0.5" }] },
      { teamId: "t0-no-red", rankings: [{ tier: "T0" }] },
    ],
    ownedHeroes: [
      { name: "Tướng A", redStars: 0 },
      { name: "Tướng B", redStars: 5 },
    ],
    ownedTactics: ["Chiến Pháp A", "Chiến Pháp B"],
    maxTeams: 1,
  });

  assert.equal(result.portfolioTeams[0].team.id, "t0-no-red");
});

test("full-box vẫn xếp tier trước số tactic alternative", () => {
  const makeTeam = (id, hero, tactics) => ({
    id,
    name: id,
    heroes: [
      {
        name: hero,
        tactics: tactics.map(([name, alternatives]) => ({ name, alternatives })),
      },
    ],
  });
  const t0 = makeTeam(
    "t0-alternatives",
    "Tướng T0",
    [1, 2, 3, 4].map((index) => [
      `Primary ${index}`,
      [`Alternative ${index}`],
    ]),
  );
  const t05 = makeTeam("t05-primary", "Tướng T05", [
    ["Primary A", []],
    ["Primary B", []],
  ]);
  const result = recommendTeams({
    teams: [t05, t0],
    teamTier: [
      { teamId: t0.id, rankings: [{ tier: "T0" }] },
      { teamId: t05.id, rankings: [{ tier: "T0.5" }] },
    ],
    ownedHeroes: ["Tướng T0", "Tướng T05"],
    ownedTactics: [
      "Alternative 1",
      "Alternative 2",
      "Alternative 3",
      "Alternative 4",
      "Primary A",
      "Primary B",
    ],
    maxTeams: 1,
    fullBox: true,
  });

  assert.equal(result.portfolioTeams[0].team.id, "t0-alternatives");
});

test("untiered bị loại mặc định và chỉ vào bằng experimental opt-in", () => {
  const untiered = {
    id: "untiered",
    name: "Untiered",
    heroes: [
      {
        name: "Tướng Thử",
        baseName: "Tướng Thử",
        tactics: [{ name: "Chiến Pháp Thử", alternatives: [] }],
      },
    ],
  };
  const input = {
    teams: [untiered],
    teamTier: [],
    ownedHeroes: ["Tướng Thử"],
    ownedTactics: ["Chiến Pháp Thử"],
    maxTeams: 1,
  };

  assert.equal(recommendTeams(input).portfolioTeams.length, 0);
  const experimental = recommendTeams({ ...input, experimentalUntiered: true });
  assert.equal(experimental.portfolioTeams[0].team.id, "untiered");
  assert.equal(experimental.portfolioTeams[0].experimentalUntiered, true);
});

test("late conflict dùng lại full owned alternatives và trả assignment theo holder", () => {
  const teams = [
    {
      id: "a-first",
      name: "A",
      heroes: [
        {
          name: "Tướng A",
          baseName: "Tướng A",
          tactics: [{ name: "Dùng Chung", alternatives: [] }],
        },
      ],
    },
    {
      id: "b-late-alternative",
      name: "B",
      heroes: [
        {
          name: "Tướng B",
          baseName: "Tướng B",
          tactics: [{ name: "Dùng Chung", alternatives: ["Dự Phòng"] }],
        },
      ],
    },
  ];
  const result = recommendTeams({
    teams,
    teamTier: teams.map((team) => ({
      teamId: team.id,
      rankings: [{ tier: "T0" }],
    })),
    ownedHeroes: ["Tướng A", "Tướng B"],
    ownedTactics: ["Dùng Chung", "Dự Phòng"],
    maxTeams: 2,
  });

  assert.equal(result.portfolioTeams.length, 2);
  const second = result.portfolioTeams.find(
    ({ team }) => team.id === "b-late-alternative",
  );
  assert.deepEqual(second.selectedTactics, ["Dự Phòng"]);
  assert.deepEqual(second.tacticSelections, [
    {
      holderId: "hero:tuong-b",
      slotIndex: 0,
      selectedTactic: "Dự Phòng",
      selectedTacticId: "tactic:du-phong",
      alternatives: ["Dự Phòng"],
      reason: "primary-conflict",
      downgrade: true,
    },
  ]);
});

test("semantic tie được quyết định bằng stable team ID", () => {
  const teams = ["team-z", "team-a"].map((id) => ({
    id,
    name: id,
    heroes: [
      {
        name: `Tướng ${id}`,
        baseName: `Tướng ${id}`,
        tactics: [{ name: `Tactic ${id}`, alternatives: [] }],
      },
    ],
  }));
  const result = recommendTeams({
    teams,
    teamTier: teams.map(({ id }) => ({ teamId: id, rankings: [{ tier: "T1" }] })),
    ownedHeroes: teams.map(({ heroes }) => heroes[0].name),
    ownedTactics: teams.map(({ heroes }) => heroes[0].tactics[0].name),
    maxTeams: 1,
  });

  assert.equal(result.portfolioTeams[0].team.id, "team-a");
});
