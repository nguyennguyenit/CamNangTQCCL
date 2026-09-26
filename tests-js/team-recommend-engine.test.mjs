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

test("hai đội khóa chung tướng: giữ đội đầu, đội sau vào xung đột, tướng đội đầu không dùng lại", () => {
  const team = {
    id: "reuses-locked-hero",
    name: "Dùng lại tướng đã khóa",
    heroes: [{ name: "Tướng A", tactics: [{ name: "Chiến Pháp Tự Do", alternatives: [] }] }],
  };
  const result = recommendTeams({
    teams: [team],
    teamTier: [{ teamId: team.id, rankings: [{ tier: "T0" }] }],
    ownedHeroes: ["Tướng A", "Tướng B"],
    ownedTactics: ["Dùng Chung", "Khác", "Chiến Pháp Tự Do"],
    lockedTeams: [
      { teamName: "Locked A", heroes: ["Tướng A"], tactics: ["Dùng Chung"] },
      { teamName: "Locked B", heroes: ["Tướng A", "Tướng B"], tactics: ["Khác"] },
    ],
    maxTeams: 3,
  });

  const reused = result.addTeams.some((entry) => entry.heroAssignments.some((hero) => hero.canonicalId === "hero:tuong-a"));
  assert.equal(reused, false, `addTeams use locked heroes: ${reused}`);
  const locked = result.portfolioTeams.filter((entry) => entry.locked).map((entry) => entry.team.name);
  assert.deepEqual(locked, ["Locked A"]);
  assert.deepEqual(result.diagnostics.heroConflicts.map((conflict) => conflict.teamId).filter((id) => id.startsWith("locked-")), ["locked-1"]);
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

test("seasonal configurations retain canonical team identity and distinct tier indexes", () => {
  const teams = ["a", "b"].map((key) => ({ id: "same-team", candidateKey: `config-${key}`, configId: `config-${key}`, name: key, heroes: [{ name: `Hero ${key}`, tactics: [] }] }));
  for (const fullBox of [false, true]) {
    const result = recommendTeams({ teams, teamTier: [{ teamId: "same-team", candidateKey: "config-a", rankings: [{ tier: "T0" }] }, { teamId: "same-team", candidateKey: "config-b", rankings: [{ tier: "T1" }] }], seasonContext: { scenarioId: "s", rulesetId: "r" }, ownedHeroes: ["Hero a", "Hero b"], maxTeams: 2, fullBox });
    assert.equal(result.portfolioTeams.length, 1);
    assert.equal(result.portfolioTeams[0].team.id, "same-team");
    assert.equal(result.portfolioTeams[0].configId, "config-a");
    assert.equal(result.portfolioTeams[0].tier, "T0");
    assert.ok(result.diagnostics.prunedCandidates.some(d => d.teamId === "same-team" && d.configId === "config-b"));
  }
});

test("seasonal semantic ties use stable config ID independent of input order", () => {
  const teams = ["b", "a"].map(key => ({ id: "same-team", candidateKey: `config-${key}`, configId: `config-${key}`, heroes: [{ name: key, tactics: [] }] }));
  for(const fullBox of [false,true]) {
    const result=recommendTeams({teams,teamTier:teams.map(t=>({teamId:t.id,candidateKey:t.candidateKey,rankings:[{tier:"T0"}]})),seasonContext:{scenarioId:"s",rulesetId:"r"},ownedHeroes:["a","b"],fullBox,maxTeams:1});
    assert.equal(result.portfolioTeams[0].configId,"config-a");
  }
});

test("seasonal locks retain resources and exclude same canonical team configurations", () => {
  const team={id:"already-built",candidateKey:"new-config",configId:"new-config",heroes:[{name:"Other Hero",tactics:[]}]};
  const result=recommendTeams({teams:[team],teamTier:[{teamId:team.id,candidateKey:team.candidateKey,rankings:[{tier:"T0"}]}],seasonContext:{scenarioId:"s",rulesetId:"r"},ownedHeroes:["Other Hero"],lockedTeams:[{teamId:team.id,heroes:["Locked Hero"],tactics:["Locked Tactic"]}],maxTeams:2});
  assert.equal(result.portfolioTeams.length,1);assert.equal(result.portfolioTeams[0].locked,true);
  assert.equal(result.addTeams.length,0);
  assert.ok(result.diagnostics.prunedCandidates.some(d=>d.configId===team.configId));
});

test("no-context recommendations retain exact legacy output shape", () => {
  const baseline=run();
  assert.deepEqual(run({seasonContext:null}),baseline);
  assert.deepEqual(run({seasonContext:undefined}),baseline);
  assert.equal(Object.hasOwn(baseline.portfolioTeams[0],'configId'),false);
  assert.equal(Object.hasOwn(baseline.portfolioTeams[0],'seasonContext'),false);
});

test("seasonal repeated alternative lists keep ordered holders distinct", () => {
  const team={id:'ordered-team',configId:'ordered-config',candidateKey:'ordered-config',heroes:[{name:'Anh',alternatives:['Bình'],tactics:[{name:'Một'}]},{name:'Anh',alternatives:['Bình'],tactics:[{name:'Hai'}]}]};
  const result=recommendTeams({teams:[team],teamTier:[{teamId:team.id,candidateKey:team.candidateKey,rankings:[{tier:'T0'}]}],seasonContext:{scenarioId:'s',rulesetId:'r'},ownedHeroes:['Anh','Bình'],ownedTactics:['Một','Hai']});
  assert.deepEqual(result.portfolioTeams[0].tacticSelections.map(s=>s.holderId),['hero:anh','hero:binh']);
});

test("seasonal ID bounds count Unicode characters consistently with the bundle validator", () => {
  const configId='𐀀'.repeat(128),team={id:'unicode-team',configId,candidateKey:configId,heroes:[{name:'Anh',tactics:[]}]};
  const result=recommendTeams({teams:[team],teamTier:[{teamId:team.id,candidateKey:configId,rankings:[{tier:'T0'}]}],seasonContext:{scenarioId:'s',rulesetId:'r'},ownedHeroes:['Anh']});
  assert.equal(result.portfolioTeams[0].configId,configId);
});

test("blocked strong team names each missing slot with its display alternatives, never raw IDs", () => {
  const team = {
    id: "missing-two-slots",
    name: "Thiếu hai slot",
    heroes: [
      { name: "Mã Siêu", tactics: [{ name: "Thuyền Cỏ Mượn Tên", alternatives: [] }] },
      { name: "Hoàng Phủ Tung", alternatives: ["SP Hoàng Phủ Tung"], tactics: [{ name: "Phong Thi Trận", alternatives: [] }] },
      { name: "Lưu Bị", tactics: [{ name: "Giải Phiền Vệ", alternatives: [] }] },
    ],
  };
  const result = recommendTeams({
    teams: [team],
    teamTier: [{ teamId: team.id, rankings: [{ tier: "T0" }] }],
    ownedHeroes: ["Lưu Bị"],
    ownedTactics: ["Thuyền Cỏ Mượn Tên", "Phong Thi Trận", "Giải Phiền Vệ"],
    maxTeams: 1,
  });
  const [blocked] = result.blockedStrongTeams;
  assert.equal(blocked.status, "missing-hero");
  assert.deepEqual(blocked.missingHeroSlotNames, [["Mã Siêu"], ["Hoàng Phủ Tung", "SP Hoàng Phủ Tung"]]);
  assert.equal(blocked.missingHeroSlotNames.flat().some((name) => name.startsWith("hero:")), false);
  assert.deepEqual(result.diagnostics.missingHeroes[0].heroes, ["hero:ma-sieu", "hero:hoang-phu-tung", "hero:sp-hoang-phu-tung"]);
});

test("Nhiều hột xếp số hột trước bậc; Meta vẫn xếp bậc trước", () => {
  const teams = [
    { id: "a-t0-no-red", name: "A", heroes: [
      { name: "Tướng Chung", tactics: [{ name: "Chiến Pháp A", alternatives: [] }] },
      { name: "Tướng A", tactics: [{ name: "Chiến Pháp A2", alternatives: [] }] },
    ] },
    { id: "b-t1-red", name: "B", heroes: [
      { name: "Tướng Chung", tactics: [{ name: "Chiến Pháp B", alternatives: [] }] },
      { name: "Tướng B", tactics: [{ name: "Chiến Pháp B2", alternatives: [] }] },
    ] },
  ];
  const input = {
    teams,
    teamTier: [
      { teamId: "a-t0-no-red", rankings: [{ tier: "T0" }] },
      { teamId: "b-t1-red", rankings: [{ tier: "T1" }] },
    ],
    ownedHeroes: [
      { name: "Tướng Chung", redStars: 0 },
      { name: "Tướng A", redStars: 0 },
      { name: "Tướng B", redStars: 5 },
    ],
    ownedTactics: ["Chiến Pháp A", "Chiến Pháp A2", "Chiến Pháp B", "Chiến Pháp B2"],
    maxTeams: 5,
  };

  for (const fullBox of [false, true]) {
    assert.deepEqual(recommendTeams({ ...input, fullBox, mode: "meta" }).portfolioTeams.map((entry) => entry.team.id), ["a-t0-no-red"]);
    assert.deepEqual(recommendTeams({ ...input, fullBox, mode: "redStars" }).portfolioTeams.map((entry) => entry.team.id), ["b-t1-red"]);
  }
});

test("full-box Nhiều hột chọn danh sách tổng hột cao hơn khi cùng số đội", () => {
  // A+B và C+D là hai danh sách 2 đội duy nhất (chiến pháp chéo nhau). A có nhiều hột nhất một mình,
  // nhưng C+D có tổng hột cao hơn A+B.
  const makeTeam = (id, hero, tactics) => ({
    id,
    name: id,
    heroes: [{ name: hero, tactics: tactics.map((name) => ({ name, alternatives: [] })) }],
  });
  const input = {
    teams: [
      makeTeam("a", "Tướng A", ["CP 1", "CP 3"]),
      makeTeam("b", "Tướng B", ["CP 2", "CP 4"]),
      makeTeam("c", "Tướng C", ["CP 1", "CP 2"]),
      makeTeam("d", "Tướng D", ["CP 3", "CP 4"]),
    ],
    teamTier: [
      { teamId: "a", rankings: [{ tier: "T0" }] },
      { teamId: "b", rankings: [{ tier: "T1" }] },
      { teamId: "c", rankings: [{ tier: "T1" }] },
      { teamId: "d", rankings: [{ tier: "T1" }] },
    ],
    ownedHeroes: [
      { name: "Tướng A", redStars: 5 },
      { name: "Tướng B", redStars: 0 },
      { name: "Tướng C", redStars: 3 },
      { name: "Tướng D", redStars: 3 },
    ],
    ownedTactics: ["CP 1", "CP 2", "CP 3", "CP 4"],
    maxTeams: 2,
    fullBox: true,
  };
  const ids = (mode) => recommendTeams({ ...input, mode }).portfolioTeams.map((entry) => entry.team.id).sort();

  assert.deepEqual(ids("meta"), ["a", "b"]);
  assert.deepEqual(ids("redStars"), ["c", "d"]);
});
