// TDD data/tactics.json — manual tactic details entered from in-game screenshots.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tacticDescriptions } from "../js/tactics.js";
import { matchDict } from "../js/match-dict.js";

const tactics = JSON.parse(await readFile(new URL("../pipeline/lookup-inputs/tactics.json", import.meta.url), "utf8"));

test("Vô Địch Can Trường has one complete record and retains its Han-Viet lookup", async () => {
  const matches = tactics.filter((item) => item.viet === "Vô Địch Can Trường");
  assert.equal(matches.length, 1);
  const tactic = matches[0];
  assert.equal(tactic.chinese, "刚勇无前");
  assert.equal(tactic.hanViet, "Cương Dũng Vô Tiền");
  assert.equal(tactic.type, "Bị động");
  assert.equal(tactic.quality, "S");
  assert.ok(tactic.effect);
  assert.ok(tactic.iconUrl);
  assert.equal(tactic.pending, undefined);
  for (const query of ["Vô Địch Can Trường", "vo dich can truong", "Cương Dũng Vô Tiền", "刚勇无前"]) {
    assert.equal(matchDict(query, tactics).record, tactic, query);
  }
  const overrides = JSON.parse(await readFile(new URL("../pipeline/tactic-name-overrides.json", import.meta.url), "utf8"));
  assert.equal(overrides.overrides["刚勇无前"].viet, tactic.viet);
  const generic = JSON.parse(await readFile(new URL("../data/tactics-generic.json", import.meta.url), "utf8"));
  assert.equal(generic.tactics.some((item) => item.viet === tactic.viet), false);
});

test("Đồng Lòng Hợp Sức resolves to the event heal instead of Cao Pi's domestic tactic", () => {
  const matches = tactics.filter((item) => item.viet === "Đồng Lòng Hợp Sức");
  assert.equal(matches.length, 1);
  const tactic = matches[0];
  assert.equal(tactic.chinese, "勠力同心");
  assert.equal(tactic.type, "Chủ động");
  assert.match(tactic.effectViet, /50%/);
  assert.match(tactic.effectViet, /1–4/);
  assert.match(tactic.effectViet, /51%→102%/);
  assert.match(tactic.effectViet, /8→16/);
  assert.equal(tactic.targetViet, "Một quân ta");
  assert.equal(tactic.pending, undefined);
  assert.equal(tactics.find((item) => item.chinese === "戮力上国").type, "Nội chính");
});

test("Toàn Quân Đồng Lòng has in-game details", () => {
  const tactic = tactics.find((item) => item.viet === "Toàn Quân Đồng Lòng");

  assert.ok(tactic, "missing tactic");
  assert.equal(tactic.chinese, "众志成城");
  assert.equal(tactic.hanViet, "Chúng Chí Thành Thành");
  assert.equal(tactic.quality, "S");
  assert.equal(tactic.type, "Chỉ huy");
  assert.equal(tactic.pending, undefined);
  assert.match(tactic.effect, /18%→36%/);
  assert.match(tactic.effect, /治疗率48%→96%/);
  assert.match(tactic.effect, /谋略伤害/);
});

test("Không Đánh Mà Thắng links to verified 非攻制胜 tactic name", () => {
  const tactic = tactics.find((item) => item.viet === "Không Đánh Mà Thắng");

  assert.ok(tactic, "missing tactic");
  assert.equal(tactic.chinese, "非攻制胜");
  assert.equal(tactics.filter((item) => item.chinese === "不战而胜").length, 0);
});

test("Nhanh Trí Động Não links to verified 灵机一动 active tactic", () => {
  const matches = tactics.filter((item) => item.viet === "Nhanh Trí Động Não");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].chinese, "灵机一动");
  assert.equal(matches[0].type, "Chủ động");
  assert.deepEqual(matches[0].troopFit, ["Kỵ", "Khí giới"]);
  assert.match(matches[0].effectViet, /30%→55%/);
  assert.match(matches[0].effectViet, /Trí Lực, Thống Soái, Mị Lực/);
  assert.notEqual(tactics.find((item) => item.chinese === "才辩机捷")?.viet, "Nhanh Trí Động Não");
});

const inGameVietnameseTactics = [
  {
    chinese: "所向披靡",
    viet: "Đánh Đâu Thắng Đó",
    type: "Chủ động",
    target: "敌军群体(3人)",
    targetViet: "Tập thể địch (3 người)",
    effect: "准备1回合，对敌军全体发动一次兵刃攻击（伤害率123%）",
    effectViet: "Chuẩn bị 1 hiệp, phát động 1 lần tấn công Binh Đao cho toàn thể quân địch (tỷ lệ sát thương 123%→246%)",
  },
  {
    chinese: "克敌制胜",
    viet: "Khắc Địch Chế Thắng",
    type: "Đột kích",
    target: "敌军单体",
    targetViet: "Một quân địch",
    effect: "普通攻击之后，对攻击目标再次造成一次谋略伤害（伤害率90%，受智力影响）；若目标处于溃逃或中毒状态，则有70%概率使目标进入虚弱（无法造成伤害）状态，持续1回合",
    effectViet: "Sau khi tấn công thường, gây thêm cho mục tiêu tấn công 1 lần sát thương Mưu Lược (tỉ lệ sát thương 90%→180%, bị Trí Lực ảnh hưởng); Nếu mục tiêu đang mang ít nhất 1 trong 3 trạng thái: Bỏ Chạy, Trúng Độc hoặc Đốt Cháy, thì sẽ có 85% xác suất khiến mục tiêu rơi vào trạng thái Suy Nhược, duy trì 1 hiệp",
  },
  {
    chinese: "合军聚众",
    viet: "Hợp Quân Tụ Chúng",
    type: "Bị động",
    target: "自己",
    targetViet: "Tôi",
    effect: "战斗中，使自己获得休整状态，每回合恢复一定兵力（回复率62%)",
    effectViet: "Trong chiến đấu, bản thân mỗi hiệp hồi phục Binh Lực nhất định (tỷ lệ Trị Liệu 62%→124%, chịu ảnh hưởng thuộc tính cao hơn trong: Thống Soái hoặc Trí Lực)",
  },
  {
    chinese: "盛气凌敌",
    viet: "Thịnh Khí Linh Địch",
    type: "Chỉ huy",
    target: "敌军群体(2人)",
    targetViet: "Tập thể địch (2 người)",
    effect: "战斗开始后前2回合，使敌军群体（2人）每回合都有45%的几率陷入缴械状态，无法进行普通攻击",
    effectViet: "2 hiệp đầu, làm cho tập thể quân địch (2 người) mỗi hiệp đều có 45%→90% xác suất rơi vào trạng thái Giao Binh Khí, không thể tiến hành tấn công thường",
  },
  {
    chinese: "破阵摧坚",
    viet: "Phá Trận Thôi Kiên",
    type: "Chủ động",
    target: "敌军群体(2人)",
    targetViet: "Tập thể địch (2 người)",
    effect: "准备1回合，使敌军群体（2人）统率、智力降低40点（受武力影响），持续2回合，并对其发动一次兵刃攻击（伤害率79%）",
    effectViet: "Chuẩn bị 1 hiệp, khiến thuộc tính chiến đấu của nhóm địch (2 người) giảm 40→80 điểm (bị Võ Lực ảnh hưởng), duy trì 2 hiệp, và phát động 1 lần tấn công Binh Đao lên nhóm địch (tỷ lệ sát thương 79%→158%)",
  },
  {
    chinese: "折冲御侮",
    viet: "Đánh Bại Quân Địch",
    type: "Đột kích",
    target: "敌军单体",
    targetViet: "Một quân địch",
    effect: "普通攻击之后，使随机敌军单体降低100点统率和智力，持续2回合；若自己不是主将，则额外使我军主将获得2次抵御，可免疫伤害，持续2回合",
    effectViet: "Sau khi tấn công thường, làm cho cá thể quân địch ngẫu nhiên giảm 100 điểm Thống Soái và Trí Lực, duy trì 2 hiệp; nếu bản thân không phải là Tướng Chính, sẽ khiến Tướng Chính quân ta nhận thêm 2 lần Chống Đỡ, duy trì 2 hiệp",
  },
];

test("six tactics match Vietnamese in-game screenshots", () => {
  for (const expected of inGameVietnameseTactics) {
    const matches = tactics.filter((item) => item.chinese === expected.chinese);
    assert.equal(matches.length, 1, `${expected.chinese} must have one record`);
    for (const field of ["viet", "type", "target", "targetViet", "effect", "effectViet"]) {
      assert.equal(matches[0][field], expected[field], `${expected.chinese}.${field}`);
    }
  }
});

test("tacticDescriptions returns Vietnamese then Chinese with fallback", () => {
  assert.deepEqual(tacticDescriptions({ effectViet: "Bản dịch", effect: "原文" }), [
    { lang: "vi", label: "Tiếng Việt", text: "Bản dịch" },
    { lang: "zh", label: "中文", text: "原文" },
  ]);
  assert.deepEqual(tacticDescriptions({ effect: "仅中文" }), [
    { lang: "zh", label: "中文", text: "仅中文" },
  ]);
  assert.deepEqual(tacticDescriptions({}), []);
});

test("generated data keeps Đánh Bại Quân Địch references", async () => {
  for (const file of ["teams.json", "khaihoang.json", "coexist.json", "facets.json"]) {
    const content = await readFile(new URL(`../data/${file}`, import.meta.url), "utf8");
    assert.match(content, /Đánh Bại Quân Địch/, file);
  }
});
