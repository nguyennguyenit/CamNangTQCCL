import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTeam } from "../js/my-teams-model.js";
import {
  fromAnalyze,
  fromKhaiHoang,
  fromLegacy,
  fromRecommended,
  fromRosterEntry,
  khaiHoangSourceHash,
  legacySourceHash,
  newTeamId,
  recommendedSourceHash,
  sourceHash,
  sourceKeyPart,
  variantKey,
} from "../js/my-teams-sources.js";
import { buildSeasonCandidates, recommendRoster } from "../js/roster-season-candidates.js";
import {
  admittedVariants,
  heroesDict,
  ids,
  khaiHoang,
  khaiHoangById,
  legacyById,
  legacyTeams,
  recommendedById,
  recommendedRecords,
  tacticsDict,
  workerCheck,
} from "./support/my-teams-fixtures.mjs";

const tacticId = (name) => ids.tactic(null, name);
const heroId = (name) => ids.hero(null, name);
const bookId = (name) => ids.book(null, name);
const valid = (draft) => assert.deepEqual(validateTeam(draft), { ok: true, errors: [] });

test("#7 fromRecommended: bond bị bỏ, binh thư đúng ID, vị trí ô giữ nguyên", async () => {
  // s27-han-hanshi-gong-1: tướng đầu có ô thứ hai là bond (桃園結義), cả ba tướng có binh thư.
  const record = recommendedById("s27-han-hanshi-gong-1");
  const { draft, source, unresolved, defaultGroup } = fromRecommended(record, ids, { id: "team-a" });
  assert.equal(draft.id, "team-a");
  assert.equal(defaultGroup, "ghep-team");
  assert.equal(draft.name, record.displayNameVi);
  assert.equal(draft.tierLabel, record.tierRaw ?? "");
  assert.equal(draft.seasonId, record.sourceSeasonId);
  assert.deepEqual(draft.heroes.map((item) => item.hero), record.heroes.map((item) => ids.hero(item.nameRaw, item.displayNameVi)));
  assert.ok(draft.heroes.every((item) => item.slotState === "ok" && /^hero:/u.test(item.hero)));
  assert.equal(draft.heroes[0].tactics[0].primary, tacticId("Nhạn Hành Trận"));
  assert.deepEqual(draft.heroes[0].tactics[1], { primary: null, alternatives: [], rawName: "" }, "ô bond bị bỏ, ô vẫn giữ vị trí");
  assert.deepEqual(draft.heroes[0].books, ["三軍之眾", "久戰", "統軍"].map((raw, index) => ids.book(raw, record.heroes[0].bookSlotsVi[index])));
  assert.ok(draft.heroes[0].books.every((id) => /^book:/u.test(id)));
  assert.deepEqual(unresolved, []);
  assert.deepEqual(source, { kind: "recommended", key: "s27-han-hanshi-gong-1", contentHash: recommendedSourceHash(record) });
  assert.match(source.contentHash, /^[0-9a-f]{16}$/u);
  valid(draft);
  assert.equal((await workerCheck(draft)).ok, true);

  // Vị trí ô: đưa bond lên ô đầu (biến đổi thử của bản ghi thật) thì chiến pháp vẫn nằm đúng ô thứ hai.
  const swapped = structuredClone(record);
  for (const key of ["tacticSlotsRaw", "tacticSlotKinds", "tacticSlotsVi"]) swapped.heroes[0][key].reverse();
  const moved = fromRecommended(swapped, ids, { id: "team-b" }).draft;
  assert.deepEqual(moved.heroes[0].tactics.map((slot) => slot.primary), [null, tacticId("Nhạn Hành Trận")]);

  // statFocusRaw → statNote (tên hiển thị của cộng điểm).
  const stat = fromRecommended(recommendedById("s23-sp-xunyu-shanhe-gong-2"), ids, { id: "team-c" }).draft;
  assert.equal(stat.heroes[0].statNote, "Toàn Trí Lực");
  assert.ok(stat.heroes.every((item) => item.books.length === 3));

  // Chiến pháp không đối chiếu được: ô giữ tên gốc ở rawName, ghi vào unresolved; binh thư không tra được vào unresolved.
  const odd = recommendedById("og-bingyan-40y-lvbu-b");
  const oddResult = fromRecommended(odd, ids, { id: "team-d" });
  assert.ok(oddResult.unresolved.some((item) => item.rawName === "以退為進" && /books/u.test(item.field)));
  valid(oddResult.draft);

  // Ghi chú đội, cấu hình thay thế của nguồn (cả bộ tướng khác) và counters.
  const withAlternatives = recommendedRecords.find((row) => row.alternativeHoldersRaw.length > 0);
  const alt = fromRecommended(structuredClone(withAlternatives), ids, { id: "team-e" }).draft;
  assert.match(alt.notes.general, /Cấu hình thay thế 1: /u);
  const holder = withAlternatives.alternativeHoldersRaw[0];
  assert.ok(alt.notes.general.includes(holder.displayNameVi || holder.nameRaw));
  const noted = recommendedById("yxms-005-孫尚香凌統");
  assert.match(fromRecommended(noted, ids, { id: "team-f" }).draft.notes.general, /Tốc độ Tôn Thượng Hương phải nhanh hơn Lăng Thống/u);
  // Counters của nội dung đội gốc đã đối chiếu (một bản ghi thật của other-teams gắn vào tham chiếu).
  const withCounters = admittedVariants.find((row) => row.legacyContent?.counters?.good?.length && row.legacyContent?.counters?.avoid?.length);
  const referenced = recommendedById("s27-han-hanshi-gong-1");
  referenced.legacyReferences = [{ legacyTeamId: withCounters.legacyTeamId, legacyContent: withCounters.legacyContent }];
  const countered = fromRecommended(referenced, ids, { id: "team-g" }).draft;
  assert.equal(countered.notes.goodAgainst, withCounters.legacyContent.counters.good.join(" · "));
  assert.equal(countered.notes.avoid, withCounters.legacyContent.counters.avoid.join(" · "));
});

test("#8 fromLegacy: tướng 'A / B' vào heroAlternatives, biến thể có key ~variant và notes của đội gốc", async () => {
  const team = legacyById("team-intro-27");
  const { draft, source, defaultGroup } = fromLegacy(team, ids, { legacyTeamId: team.id, id: "team-l" });
  assert.equal(defaultGroup, "ghep-team");
  const third = draft.heroes[2];
  assert.equal(third.hero, heroId("SP Lữ Mông"));
  assert.deepEqual(third.heroAlternatives, [heroId("Trình Phổ")]);
  assert.deepEqual(third.books, ["Tam Quân Chi Chúng", "Rèn Luyện", "Dẫn Quân"].map(bookId));
  assert.equal(third.bookType, "Tam Quân Chi Chúng: Kỳ Chính Tương Sinh; Rèn Luyện: Văn Thao; Dẫn Quân: Cầm Binh Khí");
  assert.equal(draft.name, "Khảng Khái Cung");
  assert.equal(draft.notes.goodAgainst, "các loại thương");
  assert.equal(draft.notes.avoid, "các loại khiên");
  assert.deepEqual(source, { kind: "legacy", key: "team-intro-27", contentHash: legacySourceHash(team) });
  valid(draft);
  assert.equal((await workerCheck(draft)).ok, true);

  // Biến thể: nội dung đúng như trang đang hiện = `{...legacyContent, notes: team.notes}`; key có `~variant`.
  const variant = admittedVariants.find((row) => legacyById(row.legacyTeamId).notes);
  const original = legacyById(variant.legacyTeamId);
  const content = { ...variant.legacyContent, notes: original.notes };
  const viaVariant = fromLegacy(content, ids, { legacyTeamId: variant.legacyTeamId, legacyVariantId: variant.legacyVariantId, id: "team-v" });
  assert.equal(viaVariant.source.key, `${variant.legacyTeamId}~${variant.legacyVariantId}`);
  assert.ok(viaVariant.draft.notes.general.includes(String(original.notes).trim().split("\n")[0].trim()), "notes.general là ghi chú của đội gốc");
  assert.equal(viaVariant.source.contentHash, legacySourceHash(content));
  valid(viaVariant.draft);
  assert.equal((await workerCheck(viaVariant.draft)).ok, true);

  // Hash do client truyền vào (chép từ index) thắng giá trị tính lại.
  assert.equal(fromLegacy(content, ids, { legacyTeamId: variant.legacyTeamId, legacyVariantId: variant.legacyVariantId, id: "team-v", contentHash: "0123456789abcdef" }).source.contentHash, "0123456789abcdef");
});

test("#9 fromKhaiHoang: 'A/B' tách vào alternatives, nhóm Khai hoang, chủ tướng sau cấp 20 đứng đầu", async () => {
  const team = khaiHoangById("gia-cat-khac-sp-ma-sieu-phap-chinh");
  const { draft, source, defaultGroup } = fromKhaiHoang(team, null, ids, { id: "team-k" });
  assert.equal(defaultGroup, "khai-hoang");
  assert.equal(draft.name, team.title);
  // commanderAfter = Pháp Chính (tướng thứ ba của nguồn) → đứng đầu.
  assert.deepEqual(draft.heroes.map((item) => item.hero), ["Pháp Chính", "Gia Cát Khác", "SP Mã Siêu"].map(heroId));
  const lead = draft.heroes[0];
  assert.equal(lead.tactics[0].primary, tacticId("Tiềm Long Trận"));
  assert.deepEqual(lead.tactics[0].alternatives, [tacticId("Tam Thế Trận")]);
  assert.equal(lead.tactics[1].primary, tacticId("Thịnh Khí Linh Địch"));
  assert.equal(lead.troopNote, "Thương");
  assert.deepEqual(source, { kind: "khaihoang", key: team.id, contentHash: khaiHoangSourceHash(team, null) });
  valid(draft);
  assert.equal((await workerCheck(draft, { groupId: "main~khai-hoang" })).ok, true);

  // Biến thể: key `${teamId}~${variantId}`, tên có nhãn biến thể.
  const variant = team.variants[1];
  const viaVariant = fromKhaiHoang(team, variant, ids, { id: "team-k2" });
  assert.equal(viaVariant.source.key, `${team.id}~${variant.id}`);
  assert.equal(viaVariant.draft.name, `${team.title} · ${variant.displayLabel}`);
  assert.notEqual(viaVariant.source.contentHash, source.contentHash);
});

test("#9b Khai hoang: chủ tướng không đứng đầu mảng, đổi chủ tướng sau cấp 20, biến thể chỉ có dữ liệu Sau", () => {
  // Chu Thái–Trương Phi–Trương Xuân Hoa, chủ tướng trước/sau = Trương Phi (tướng thứ hai của nguồn).
  const chu = khaiHoangById("chu-thai-truong-phi-truong-xuan-hoa");
  assert.equal(chu.commanderAfter, "Trương Phi");
  const first = fromKhaiHoang(chu, null, ids, { id: "team-1" }).draft;
  assert.deepEqual(first.heroes.map((item) => item.hero), ["Trương Phi", "Chu Thái", "Trương Xuân Hoa"].map(heroId));
  assert.match(first.notes.general, /Trước cấp 20: .*Trương Phi/u, "dữ liệu Trước nằm trong notes.general");
  assert.match(first.notes.general, /Ghi chú build: /u);
  assert.ok(!first.notes.general.includes("Chủ tướng trước cấp 20"), "cùng chủ tướng thì không lặp");

  // Đổi chủ tướng sau cấp 20: Pháp Chính đứng đầu; chủ tướng trước cấp 20 ghi ở nhãn.
  const changed = khaiHoangById("khuong-duy-ha-hau-uyen-phap-chinh");
  const variant = changed.variants[0];
  const swap = structuredClone(variant);
  swap.commanderAfter = "Pháp Chính";
  const swapped = fromKhaiHoang(changed, swap, ids, { id: "team-2" }).draft;
  assert.equal(swapped.heroes[0].hero, heroId("Pháp Chính"));
  assert.match(swapped.notes.general, /Chủ tướng trước cấp 20: Khương Duy/u);

  // Biến thể chỉ có dữ liệu Sau: không bịa dữ liệu Trước.
  const lucTon = khaiHoangById("luc-ton-ta-tu-truong-xuan-hoa");
  const onlyAfter = lucTon.variants.find((item) => item.heroes.every((hero) => !hero.tacticBefore));
  assert.ok(onlyAfter, "dữ liệu thật có biến thể chỉ có Sau");
  const afterDraft = fromKhaiHoang(lucTon, onlyAfter, ids, { id: "team-3" }).draft;
  assert.ok(!/Trước cấp 20/u.test(afterDraft.notes.general));
  assert.equal(afterDraft.heroes[0].hero, heroId(onlyAfter.commanderAfter));
  valid(afterDraft);
});

/** Entry thật của engine Gợi ý đội (đội cũ `team-intro-27`: chỉ có Trình Phổ trong kho, không có SP Lữ Mông). */
function legacyEntry() {
  const team = legacyById("team-intro-27");
  const owned = team.heroes.map((hero) => (hero.name.includes("/") ? "Trình Phổ" : hero.name));
  const result = recommendRoster({
    seasonTeams: [],
    seasonTier: [],
    legacyTeams: [team],
    legacyTier: [{ teamId: team.id, rankings: [{ tier: "T0" }] }],
    ownedHeroes: owned,
    ownedTactics: team.heroes.flatMap((hero) => hero.tactics.map((item) => item.name)),
    tacticsDict,
  });
  return result.portfolioTeams[0];
}

test("#10/#11 fromRosterEntry (đội cũ): khớp thẻ đang hiện, SP Lữ Mông vào heroAlternatives, hash của bản ghi gốc", async () => {
  const entry = legacyEntry();
  assert.equal(entry.source, "legacy");
  const { draft, source } = fromRosterEntry(entry, [], ids, { id: "team-e1" });
  assert.equal(draft.heroes[2].hero, heroId("Trình Phổ"), "đang hiện Trình Phổ ở ô tướng");
  assert.deepEqual(draft.heroes[2].heroAlternatives, [heroId("SP Lữ Mông")]);
  assert.equal(draft.heroes[0].hero, heroId("Cam Ninh"));
  assert.equal(source.kind, "legacy");
  assert.equal(source.key, "team-intro-27");
  assert.equal(source.contentHash, legacySourceHash(legacyById("team-intro-27")), "hash vẫn là hash nguồn gốc");
  assert.equal(source.contentHash, fromLegacy(legacyById("team-intro-27"), ids, { legacyTeamId: "team-intro-27" }).source.contentHash);
  valid(draft);
  assert.equal((await workerCheck(draft)).ok, true);
  // Entry không có bản ghi (đội khóa, hoặc mùa chưa tải) → null, không ném.
  assert.equal(fromRosterEntry({ source: "locked", team: { id: "x" } }, [], ids), null);
  assert.equal(fromRosterEntry({ team: { source: "season", id: "không-có" } }, [], ids), null);
});

test("#10 fromRosterEntry (đội mùa): ô bond đứng trước chiến pháp, chiến pháp đã chọn đúng ô, món bù vào userAlternatives", async () => {
  // Bản ghi thật; đưa bond lên ô đầu của tướng đầu (biến đổi thử) để engine đánh số lại ô (bỏ bond).
  const record = recommendedById("s27-han-hanshi-gong-1");
  for (const key of ["tacticSlotsRaw", "tacticSlotKinds", "tacticSlotsVi"]) record.heroes[0][key].reverse();
  const candidates = buildSeasonCandidates([record], record.sourceSeasonId, { heroesDict, tacticsDict });
  const [team] = candidates.teams;
  const substitute = "Thuyền Cỏ Mượn Tên";
  const result = recommendRoster({
    seasonTeams: candidates.teams,
    seasonTier: candidates.teamTier,
    ownedHeroes: team.heroes.map((hero) => hero.name),
    // Kho thiếu chiến pháp chính của tướng đầu (Nhạn Hành Trận) nhưng có món bù đã chọn.
    ownedTactics: [...team.heroes.flatMap((hero) => hero.tactics.map((slot) => slot.name)).filter((name) => name !== "Nhạn Hành Trận"), substitute],
    tacticsDict,
    tacticOverrides: [{ teamId: team.id, heroIndex: 0, slotIndex: 0, tactic: substitute }],
  });
  const entry = result.portfolioTeams[0];
  assert.equal(entry.status, "variant");
  assert.equal(entry.tacticSelections[0].slotIndex, 0, "engine đánh số ô sau khi bỏ bond");

  const { draft, source } = fromRosterEntry(entry, [record], ids, { id: "team-e2" });
  assert.deepEqual(draft.heroes[0].tactics[0], { primary: null, alternatives: [], rawName: "" }, "ô bond (ô nguồn 0) vẫn trống");
  assert.equal(draft.heroes[0].tactics[1].primary, tacticId(substitute), "chiến pháp đã chọn nằm ở ô nguồn 1");
  assert.deepEqual(draft.heroes[0].tactics[1].alternatives, [tacticId("Nhạn Hành Trận")], "lựa chọn gốc chuyển vào alternatives");
  assert.deepEqual(draft.userAlternatives, [{ heroIndex: 0, slotIndex: 1, tactic: tacticId(substitute) }]);
  assert.equal(draft.heroes[1].tactics[0].primary, tacticId("Cương Nhu Kết Hợp"));
  assert.equal(source.kind, "recommended");
  assert.equal(source.contentHash, recommendedSourceHash(record), "hash là hash bản ghi gốc, không tính món bù");
  assert.deepEqual(draft.heroes[0].books, fromRecommended(record, ids, { id: "x" }).draft.heroes[0].books, "giữ binh thư của bản ghi");
  valid(draft);
  assert.equal((await workerCheck(draft)).ok, true);
});

test("#12 sourceHash: không đổi theo bản dịch Việt; đổi theo tên gốc, cộng điểm, ghi chú nguồn", () => {
  const base = recommendedById("s23-sp-xunyu-shanhe-gong-2");
  const hash = recommendedSourceHash(base);
  const translated = structuredClone(base);
  translated.displayNameVi = "Tên dịch khác";
  translated.displayNotes = { blocks: [{ id: "p-1", owner: "team", textRaw: "x", textVi: "bản dịch khác" }] };
  for (const item of translated.heroes) {
    item.displayNameVi = "Tướng dịch khác";
    item.tacticSlotsVi = item.tacticSlotsVi.map((value) => (value ? `${value} (dịch lại)` : value));
    item.bookSlotsVi = item.bookSlotsVi.map((value) => (value ? `${value} (dịch lại)` : value));
    item.statFocusVi = "Cộng điểm dịch lại";
  }
  assert.equal(recommendedSourceHash(translated), hash, "bản dịch Việt không tính");

  const renamedTactic = structuredClone(base);
  renamedTactic.heroes[1].tacticSlotsRaw[0] = `${renamedTactic.heroes[1].tacticSlotsRaw[0]}改`;
  assert.notEqual(recommendedSourceHash(renamedTactic), hash, "đổi tên gốc một chiến pháp");
  const statOnly = structuredClone(base);
  statOnly.heroes[0].statFocusRaw = "全攻";
  assert.notEqual(recommendedSourceHash(statOnly), hash, "chỉ đổi cộng điểm");
  const noteOnly = structuredClone(base);
  noteOnly.notesRaw = `${noteOnly.notesRaw ?? ""}。新增`;
  assert.notEqual(recommendedSourceHash(noteOnly), hash, "chỉ đổi ghi chú nguồn");
  const heroNote = structuredClone(base);
  heroNote.heroes[2].notesRaw = "新備註";
  assert.notEqual(recommendedSourceHash(heroNote), hash, "ghi chú nguồn của tướng");

  // Không phụ thuộc thứ tự khóa; deterministic.
  assert.equal(sourceHash({ a: 1, b: [2, { c: 3, d: 4 }] }), sourceHash({ b: [2, { d: 4, c: 3 }], a: 1 }));
  assert.match(sourceHash({}), /^[0-9a-f]{16}$/u);
  assert.equal(recommendedSourceHash(structuredClone(base)), hash);

  // Đội khác / Khai hoang: đổi trường nguồn thì đổi hash, đổi trường không thuộc nguồn (id, nhãn) thì không.
  const legacy = legacyById("team-intro-27");
  const legacyHash = legacySourceHash(legacy);
  const changed = structuredClone(legacy);
  changed.heroes[0].tactics[0].name += " khác";
  assert.notEqual(legacySourceHash(changed), legacyHash);
  assert.equal(legacySourceHash({ ...structuredClone(legacy), id: "khác", name: "đổi tên hiển thị", status: "x" }), legacyHash);
  const kh = khaiHoangById("gia-cat-khac-sp-ma-sieu-phap-chinh");
  const khHash = khaiHoangSourceHash(kh, null);
  const khChanged = structuredClone(kh);
  khChanged.heroes[0].tacticBefore = "Chiến pháp khác";
  assert.notEqual(khaiHoangSourceHash(khChanged, null), khHash);
  assert.notEqual(khaiHoangSourceHash(kh, kh.variants[0]), khHash);
});

test("fromAnalyze: kind analyze, không hash, key hợp lệ", async () => {
  const canonical = {
    heroes: [
      { hero: heroId("Tào Tháo"), tactics: [tacticId("Nhạn Hành Trận"), null], book: bookId("Dẫn Quân") },
      { hero: heroId("Lục Tốn"), tactics: [null, null], book: null },
    ],
  };
  const { draft, source, defaultGroup } = fromAnalyze(canonical, { id: "team-an", name: "Từ Soi đội" });
  assert.equal(draft.name, "Từ Soi đội");
  assert.equal(source.kind, "analyze");
  assert.equal(source.contentHash, "");
  assert.match(source.key, /^analyze-[0-9a-f]{16}$/u);
  assert.equal(defaultGroup, "ghep-team");
  assert.deepEqual(draft.heroes[0].books, [bookId("Dẫn Quân")]);
  assert.deepEqual(draft.heroes[1].tactics.map((slot) => slot.primary), [null, null]);
  valid(draft);
  assert.equal((await workerCheck(draft)).ok, true);
  assert.equal(fromAnalyze(canonical).source.key, source.key, "key ổn định theo nội dung");
});

test("id và key: team id ngẫu nhiên hợp lệ; id nguồn có chữ Hán đổi sang h-<hash> ASCII", () => {
  assert.match(newTeamId(), /^team-[0-9a-f]{16}$/u);
  assert.notEqual(newTeamId(), newTeamId());
  assert.equal(sourceKeyPart("s27-han-hanshi-gong-1"), "s27-han-hanshi-gong-1");
  const cjk = sourceKeyPart("yxms-005-孫尚香凌統");
  assert.match(cjk, /^h-[0-9a-f]{16}$/u);
  assert.equal(sourceKeyPart("yxms-005-孫尚香凌統"), cjk);
  assert.equal(variantKey("team-intro-4", "v-abc"), "team-intro-4~v-abc");
  assert.equal(variantKey("team-intro-4", null), "team-intro-4");
  assert.equal(fromRecommended(recommendedById("yxms-005-孫尚香凌統"), ids, { id: "team-h" }).source.key, cjk);
});

test("mọi nguồn thật chuyển được thành đội hợp lệ, Worker nhận; draft.id giữ nguyên qua nhiều lần chuyển", async () => {
  let checked = 0;
  const check = async (result) => {
    valid(result.draft);
    const wire = await workerCheck(result.draft);
    assert.equal(wire.ok, true, `${result.source.kind}:${result.source.key} ${JSON.stringify(wire)}`);
    checked += 1;
  };
  for (const record of recommendedRecords) await check(fromRecommended(record, ids, { id: "team-all" }));
  for (const team of legacyTeams) await check(fromLegacy(team, ids, { legacyTeamId: team.id, id: "team-all" }));
  for (const variant of admittedVariants) {
    const original = legacyById(variant.legacyTeamId);
    await check(fromLegacy({ ...variant.legacyContent, notes: original.notes }, ids, { legacyTeamId: variant.legacyTeamId, legacyVariantId: variant.legacyVariantId, id: "team-all" }));
  }
  for (const team of khaiHoang.teams) {
    await check(fromKhaiHoang(team, null, ids, { id: "team-all" }));
    for (const variant of team.variants ?? []) await check(fromKhaiHoang(team, variant, ids, { id: "team-all" }));
  }
  assert.ok(checked >= 1600, `đã kiểm ${checked} nguồn`);
  const record = recommendedById("s27-han-hanshi-gong-1");
  assert.equal(fromRecommended(record, ids, { id: "team-keep" }).draft.id, "team-keep");
});
