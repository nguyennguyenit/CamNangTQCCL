import assert from "node:assert/strict";
import test from "node:test";

import { createEntityIndex, draftFromRead, emptyDraft, normalizeTeamRead, sureCell } from "../js/analyze-map.js";
import { createTeamLexicon } from "../js/community-team-data.js";
import {
  TROOPS,
  mergePage,
  modeFromSearch,
  pickSide,
  similarWarning,
  teamPayloadFromDraft,
} from "../js/community-team-state.js";

const HEROES = [
  { chinese: "曹操", viet: "Tào Tháo" },
  { chinese: "關羽", aliases: ["关羽"], viet: "Quan Vũ" },
  { chinese: "張飛", aliases: ["张飞"], viet: "Trương Phi" },
];
const TACTICS = [
  { chinese: "魅惑", viet: "Mê Hoặc" },
  { chinese: "神机妙算", viet: "Thần Cơ Diệu Toán" },
  { chinese: "夺魂挟魄", viet: "Đoạt Hồn Hiệp Phách" },
  { chinese: "当锋摧决", viet: "Đương Phong Thôi Quyết" },
  { chinese: "焚辎营垒", viet: "Thiêu Đốt Doanh Lũy" },
  { chinese: "灵机一动", viet: "Nhanh Trí Động Não" },
];
const BOOKS = [{ id: "book:giap-sat", chinese: "铁甲", viet: "Giáp Sắt" }];
const INDEXES = {
  heroes: createEntityIndex(HEROES, "hero"),
  tactics: createEntityIndex(TACTICS, "tactic"),
  books: createEntityIndex(BOOKS, "book"),
};

function fullDraft() {
  const draft = emptyDraft();
  const heroes = ["hero:a", "hero:b", "hero:c"];
  draft.heroes.forEach((member, index) => {
    member.hero = sureCell(heroes[index]);
    member.tactics = [sureCell(`tactic:t${index}a`), sureCell(`tactic:t${index}b`)];
  });
  return draft;
}

const FIELDS = {
  title: "  Đội Quan Vũ  ",
  troop: "ky",
  playstyle: "Mở đầu bằng khống chế rồi dồn sát thương.",
  strengths: " Mạnh ",
  weaknesses: "",
  counters: "",
  counteredBy: "",
  substitutes: "",
  lang: "vi",
  uploadIds: ["up1", "up2"],
};

test("teamPayloadFromDraft: đủ 3 tướng + 6 chiến pháp cho body đúng hình dạng API, không có season", () => {
  const body = teamPayloadFromDraft(fullDraft(), FIELDS);
  assert.deepEqual(body.heroes, ["hero:a", "hero:b", "hero:c"]);
  assert.deepEqual(body.tactics, [["tactic:t0a", "tactic:t0b"], ["tactic:t1a", "tactic:t1b"], ["tactic:t2a", "tactic:t2b"]]);
  assert.equal(body.title, "Đội Quan Vũ");
  assert.equal(body.strengths, "Mạnh");
  assert.equal(body.troop, "ky");
  assert.deepEqual(body.uploadIds, ["up1", "up2"]);
  assert.equal("season" in body, false);
});

test("teamPayloadFromDraft: thiếu tướng, thiếu/trùng chiến pháp, ô chưa chắc đều bị chặn kèm mã", () => {
  const code = (draft, fields = FIELDS) => {
    try {
      teamPayloadFromDraft(draft, fields);
    } catch (error) {
      return error.code;
    }
    return null;
  };
  const missingHero = fullDraft();
  missingHero.heroes[2].hero = sureCell(null);
  assert.equal(code(missingHero), "invalid_heroes");

  const dupHero = fullDraft();
  dupHero.heroes[1].hero = sureCell("hero:a");
  assert.equal(code(dupHero), "invalid_heroes");

  const missingTactic = fullDraft();
  missingTactic.heroes[0].tactics[1] = sureCell(null);
  assert.equal(code(missingTactic), "invalid_tactics");

  const dupTactic = fullDraft();
  dupTactic.heroes[2].tactics[0] = sureCell("tactic:t0a");
  assert.equal(code(dupTactic), "invalid_tactics");

  const unsure = fullDraft();
  unsure.heroes[0].tactics[0] = { state: "unsure", raw: "x", id: null, candidates: ["tactic:t0a"] };
  assert.equal(code(unsure), "invalid_tactics");

  assert.equal(code(fullDraft(), { ...FIELDS, title: "   " }), "invalid_title");
  assert.equal(code(fullDraft(), { ...FIELDS, troop: "xe" }), "invalid_troop");
  assert.equal(code(fullDraft(), { ...FIELDS, playstyle: "ngắn" }), "invalid_text");
  assert.equal(code(fullDraft(), { ...FIELDS, uploadIds: [] }), "invalid_uploads");
  assert.deepEqual(TROOPS, ["cung", "khiGioi", "ky", "thuan", "thuong"]);
});

test("pickSide: 0 side -> nháp rỗng, 1 side tự chọn, 2 side cần người dùng chọn", () => {
  const left = { side: "left", heroes: [{ nameCn: "曹操" }] };
  const right = { side: "right", heroes: [{ nameCn: "关羽" }] };
  assert.deepEqual(pickSide(null, null), { heroes: [] });
  assert.deepEqual(pickSide({ screen: "other", sides: [] }, null), { heroes: [] });
  assert.deepEqual(pickSide({ screen: "other", sides: [left] }, null), left);
  assert.equal(pickSide({ screen: "battleReport", sides: [left, right] }, null), null);
  assert.equal(pickSide({ screen: "battleReport", sides: [left, right] }, "middle"), null);
  assert.deepEqual(pickSide({ screen: "battleReport", sides: [left, right] }, "right"), right);
});

test("đường ống thật: normalizeTeamRead -> pickSide -> draftFromRead cho 3 tướng + 6 chiến pháp", () => {
  const read = {
    screen: "teamDetail",
    sides: [{
      side: "left",
      heroes: [
        { nameCn: "曹操", tacticsCn: ["魅惑", "神机妙算"], booksCn: ["铁甲"], statFocusCn: "" },
        { nameCn: "关羽", tacticsCn: ["夺魂挟魄", "当锋摧决"], booksCn: ["铁甲"], statFocusCn: "" },
        { nameCn: "张飞", tacticsCn: ["焚辎营垒", "灵机一动"], booksCn: ["铁甲"], statFocusCn: "" },
      ],
    }],
  };
  const side = pickSide(normalizeTeamRead(read), null);
  const draft = draftFromRead({ heroes: side.heroes }, INDEXES);
  assert.deepEqual(draft.heroes.map((member) => member.hero.id), ["hero:tao-thao", "hero:quan-vu", "hero:truong-phi"]);
  assert.equal(draft.heroes.flatMap((member) => member.tactics).filter((cell) => cell.state === "sure").length, 6);
});

test("từ điển như trang dựng (createTeamLexicon): binh thư trùng tên chiến pháp không làm rơi chiến pháp đọc đúng", () => {
  const books = [...BOOKS, { id: "book:tam-quan-chi-chung", chinese: "三军之众", viet: "Tam Quân Chi Chúng" }];
  const tactics = [...TACTICS, { chinese: "三軍之眾", aliases: ["三军之众"], viet: "Tam Quân Chi Chúng" }];
  const read = { heroes: [{ nameCn: "曹操", tacticsCn: ["魅惑", "神机妙算"], booksCn: ["三军之众"], statFocusCn: "" }] };
  const lexicon = createTeamLexicon({ heroes: HEROES, tactics, books }, "vi");
  const draft = draftFromRead(read, lexicon.indexes);
  assert.deepEqual(draft.heroes[0].tactics.map((cell) => cell.id), ["tactic:me-hoac", "tactic:than-co-dieu-toan"]);
  assert.equal(draft.heroes[0].book.state, "sure");
  // Thiếu binh thư (chỉ mục rỗng) thì chiến pháp đầu bị gạt thành "tự mang".
  const bare = draftFromRead(read, createTeamLexicon({ heroes: HEROES, tactics }, "vi").indexes);
  assert.notDeepEqual(bare.heroes[0].tactics.map((cell) => cell.id), ["tactic:me-hoac", "tactic:than-co-dieu-toan"]);
});

test("teamPayloadFromDraft: độ dài văn bản đếm theo code point như server", () => {
  const astral = "𠮷".repeat(80);
  assert.equal(astral.length, 160);
  assert.equal(teamPayloadFromDraft(fullDraft(), { ...FIELDS, title: astral }).title, astral);
  assert.throws(() => teamPayloadFromDraft(fullDraft(), { ...FIELDS, title: "𠮷".repeat(81) }), { code: "invalid_title" });
  assert.throws(() => teamPayloadFromDraft(fullDraft(), { ...FIELDS, playstyle: "𠮷".repeat(5) }), { code: "invalid_text" });
});

test("đường ống thật: kết quả rỗng hoặc không đọc được cho nháp rỗng, không lỗi", () => {
  for (const read of [null, undefined, {}, { screen: "other", sides: [] }, { heroes: [] }, "x"]) {
    const side = pickSide(normalizeTeamRead(read), null);
    const draft = draftFromRead({ heroes: side.heroes }, INDEXES);
    assert.deepEqual(draft, emptyDraft());
  }
});

test("modeFromSearch: id hợp lệ -> chi tiết; new=1; mine=1; còn lại danh sách", () => {
  assert.deepEqual(modeFromSearch(""), { mode: "list", id: null });
  assert.deepEqual(modeFromSearch("?id=abc-123"), { mode: "detail", id: "abc-123" });
  assert.deepEqual(modeFromSearch("?id=Bad/Id"), { mode: "list", id: null });
  assert.deepEqual(modeFromSearch("?new=1"), { mode: "new", id: null });
  assert.deepEqual(modeFromSearch("?mine=1"), { mode: "mine", id: null });
  assert.deepEqual(modeFromSearch("?new=0"), { mode: "list", id: null });
  assert.deepEqual(modeFromSearch("?id=x1&new=1"), { mode: "detail", id: "x1" });
});

test("mergePage: nối trang sau và bỏ id đã có", () => {
  const first = [{ id: "a" }, { id: "b" }];
  const merged = mergePage(first, [{ id: "b" }, { id: "c" }, { id: "c" }]);
  assert.deepEqual(merged.map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(first.map((item) => item.id), ["a", "b"]);
});

test("similarWarning: không cảnh báo khi 0, có số đội theo locale", () => {
  assert.equal(similarWarning(0, "vi"), "");
  assert.match(similarWarning(3, "vi"), /3 đội/);
  assert.match(similarWarning(2, "zh"), /2/);
  assert.match(similarWarning(2, "zh"), /阵容/);
});
