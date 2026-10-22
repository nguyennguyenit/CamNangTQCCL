import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateWarnings, escapedBytes, missingItems, normalizeTeam, validateTeam } from "../js/my-teams-model.js";
import { fromRecommended } from "../js/my-teams-sources.js";
import { ids, recommendedById, workerCheck } from "./support/my-teams-fixtures.mjs";

const slot = (primary = null, extra = {}) => ({ primary, alternatives: [], rawName: "", ...extra });
const hero = (id, tactics = [null, null], extra = {}) => ({
  hero: id,
  slotState: id ? "ok" : "source-empty",
  rawName: "",
  heroAlternatives: [],
  redStars: null,
  tactics: tactics.map((tactic) => slot(tactic)),
  books: [],
  bookType: "",
  troopNote: "",
  statNote: "",
  gearNote: "",
  ...extra,
});
const team = (heroes, extra = {}) => ({
  id: "team-a",
  name: "Đội thử",
  seasonId: null,
  tierLabel: "",
  replacesTeamId: null,
  heroes,
  notes: { general: "", strengths: "", goodAgainst: "", avoid: "" },
  userAlternatives: [],
  source: { kind: "analyze", key: "analyze-0123456789abcdef", contentHash: "" },
  ...extra,
});
const three = () => [hero("hero:a"), hero("hero:b"), hero("hero:c")];
const fields = (result) => result.errors.map((error) => error.field);

test("#1 validateTeam: bốn tướng và ô chiến pháp thứ ba báo đúng trường", () => {
  const four = validateTeam(team([...three(), hero("hero:d")]));
  assert.equal(four.ok, false);
  assert.ok(fields(four).includes("heroes"), `lỗi: ${JSON.stringify(four.errors)}`);

  const thirdSlot = team(three());
  thirdSlot.heroes[1].tactics.push(slot("tactic:x"));
  const result = validateTeam(thirdSlot);
  assert.equal(result.ok, false);
  assert.ok(fields(result).includes("heroes[1].tactics"));

  const none = validateTeam(team([]));
  assert.ok(fields(none).includes("heroes"));

  const manyAlt = team(three());
  manyAlt.heroes[0].heroAlternatives = ["hero:p", "hero:q", "hero:r", "hero:s"];
  manyAlt.heroes[0].books = ["book:a", "book:b", "book:c", "book:d"];
  manyAlt.heroes[2].tactics[1].alternatives = ["tactic:a", "tactic:b", "tactic:c", "tactic:d"];
  assert.deepEqual(fields(validateTeam(manyAlt)).sort(), ["heroes[0].books", "heroes[0].heroAlternatives", "heroes[2].tactics[1].alternatives"]);

  assert.deepEqual(validateTeam(team(three())), { ok: true, errors: [] });
});

test("#2 đội nguồn hai tướng (ô source-empty) hợp lệ, ô thứ ba trống, Worker nhận", async () => {
  const { draft } = fromRecommended(recommendedById("yxms-005-孫尚香凌統"), ids, { id: "team-two-heroes" });
  assert.equal(draft.heroes.length, 3);
  assert.equal(draft.heroes[2].slotState, "source-empty");
  assert.equal(draft.heroes[2].hero, null);
  assert.deepEqual(draft.heroes[2].tactics.map((item) => item.primary), [null, null]);
  assert.deepEqual(validateTeam(draft), { ok: true, errors: [] });
  const checked = await workerCheck(draft);
  assert.equal(checked.ok, true, JSON.stringify(checked));
});

test("#3 tướng chưa đối chiếu được: hero null, unresolved, rawName; vẫn hợp lệ", async () => {
  const record = recommendedById("yxms-005-孫尚香凌統");
  record.heroes[1].nameRaw = "不存在的武將";
  record.heroes[1].displayNameVi = null;
  const { draft, unresolved } = fromRecommended(record, ids, { id: "team-unresolved" });
  assert.equal(draft.heroes[1].hero, null);
  assert.equal(draft.heroes[1].slotState, "unresolved");
  assert.equal(draft.heroes[1].rawName, "不存在的武將");
  assert.ok(unresolved.some((item) => item.rawName === "不存在的武將"));
  assert.deepEqual(validateTeam(draft), { ok: true, errors: [] });
  assert.equal((await workerCheck(draft)).ok, true);
  // Tướng "ok" mà không có hero là hợp đồng sai.
  const broken = structuredClone(draft);
  broken.heroes[0].hero = null;
  assert.ok(fields(validateTeam(broken)).includes("heroes[0].hero"));
});

test("#4 chữ tự do: đếm byte sau JSON escape, vượt thì lỗi theo trường, không cắt im lặng", async () => {
  assert.equal(escapedBytes("曹"), 3);
  assert.equal(escapedBytes('"'), 2);
  assert.equal(escapedBytes("\\"), 2);
  assert.equal(escapedBytes("a\nb"), 4);

  assert.equal(validateTeam(team(three(), { name: "曹".repeat(60) })).ok, true, "180 B vừa trần");
  const over = validateTeam(team(three(), { name: "曹".repeat(61) }));
  assert.deepEqual(fields(over), ["name"]);
  assert.equal(over.errors[0].code, "bytes");
  // Dấu `"` chiếm 2 B: 91 dấu = 182 B > 180 dù chỉ 91 ký tự.
  assert.deepEqual(fields(validateTeam(team(three(), { name: '"'.repeat(91) }))), ["name"]);

  // Ký tự điều khiển (trừ \n, \t) bị từ chối; chuẩn hóa bỏ chúng khi nhập.
  assert.ok(fields(validateTeam(team(three(), { name: "a\u0007b" }))).includes("name"));
  assert.equal(validateTeam(team(three(), { name: "a\tb\nc" })).ok, true);
  assert.equal(normalizeTeam(team(three(), { name: "a\u0007b\u009fc" })).name, "abc");

  // Đội xấu nhất: mọi trường chữ Hán tối đa, 3 tướng, mỗi tướng 3 phương án thay, mỗi ô 3 phương án thay, 3 binh thư,
  // 6 món bù, key 128 B, groupId 128 B. Trần từng trường phải giữ tổng dưới 16 KiB (số đo trong docs/roster-sync.md).
  const cjk = (bytes) => "曹".repeat(Math.floor(bytes / 3));
  const tacticRef = "tactic:giang-dong-tieu-ba-vuong";
  const worst = team(
    [0, 1, 2].map((i) =>
      hero(`hero:truong-bao-khan-vang-${i}`, [tacticRef, tacticRef], {
        rawName: cjk(80),
        heroAlternatives: ["hero:truong-bao-khan-vang-a", "hero:truong-bao-khan-vang-b", "hero:truong-bao-khan-vang-c"],
        books: ["book:tranh-the-manh-cua-dich", "book:tranh-the-manh-cua-dich", "book:tranh-the-manh-cua-dich"],
        bookType: cjk(120),
        troopNote: cjk(360),
        statNote: cjk(360),
        gearNote: cjk(360),
      }),
    ),
    {
      name: cjk(180),
      tierLabel: cjk(48),
      notes: { general: cjk(2000), strengths: cjk(2000), goodAgainst: cjk(2000), avoid: cjk(2000) },
      userAlternatives: Array.from({ length: 6 }, () => ({ heroIndex: 2, slotIndex: 1, tactic: tacticRef })),
      source: { kind: "recommended", key: "k".repeat(128), contentHash: "0123456789abcdef" },
      groupId: `box-${"a".repeat(60)}~${"b".repeat(60)}`,
    },
  );
  for (const h of worst.heroes) {
    for (const t of h.tactics) {
      t.rawName = cjk(80);
      t.alternatives = [tacticRef, tacticRef, tacticRef];
    }
  }
  const full = validateTeam(worst);
  assert.deepEqual(full, { ok: true, errors: [] }, JSON.stringify(full.errors));
  const wire = await workerCheck(worst, { boxId: "main", groupId: "main~ghep-team" });
  assert.equal(wire.ok, true, JSON.stringify(wire));
  assert.ok(Buffer.byteLength(wire.record.payload) <= 16384, `payload ${Buffer.byteLength(wire.record.payload)} B`);

  // Notes 2 400 B (bản nháp cũ): lỗi đúng trường, không cắt âm thầm; Worker cũng từ chối.
  const longNotes = structuredClone(worst);
  longNotes.notes.general = cjk(2400);
  assert.deepEqual(fields(validateTeam(longNotes)), ["notes.general"]);
  assert.equal((await workerCheck(longNotes, { groupId: "main~ghep-team" })).code, "bytes");
  assert.equal(longNotes.notes.general, cjk(2400), "validateTeam không sửa dữ liệu");
});

test("#5 duplicateWarnings: chung tướng có, replacesTeamId không, đội đã xóa/khác hộp không", () => {
  const a = team([hero("hero:a", ["tactic:x", "tactic:y"]), hero("hero:b"), hero("hero:c")], { id: "team-a", boxId: "main" });
  const b = team([hero("hero:d", ["tactic:z", "tactic:w"]), hero("hero:a"), hero("hero:e")], { id: "team-b", boxId: "main" });
  const warnings = duplicateWarnings([a, b]);
  assert.equal(warnings.length, 1);
  assert.deepEqual([warnings[0].a, warnings[0].b], ["team-a", "team-b"]);
  assert.deepEqual(warnings[0].heroes, ["hero:a"]);

  // Chung chiến pháp chính cũng là trùng.
  const c = team([hero("hero:q", ["tactic:x", null]), hero("hero:r"), hero("hero:s")], { id: "team-c", boxId: "main" });
  assert.deepEqual(duplicateWarnings([a, c])[0].tactics, ["tactic:x"]);

  // B thay A: không cảnh báo (theo cả hai chiều).
  assert.deepEqual(duplicateWarnings([a, { ...b, replacesTeamId: "team-a" }]), []);
  assert.deepEqual(duplicateWarnings([{ ...a, replacesTeamId: "team-b" }, b]), []);
  // Đội đã xóa, đội khác hộp.
  assert.deepEqual(duplicateWarnings([a, { ...b, deletedAt: "2026-10-21T08:00:00.000Z" }]), []);
  assert.deepEqual(duplicateWarnings([a, { ...b, boxId: "box-2" }]), []);
  // Chỉ phương án thay trùng thì không tính; ô trống/unresolved không tạo trùng.
  const alt = team([hero("hero:k", [null, null], { heroAlternatives: ["hero:a"] }), hero(null), hero(null)], { id: "team-k", boxId: "main" });
  assert.deepEqual(duplicateWarnings([a, alt]), []);
  const alt2 = team([hero("hero:m", [null, null], { heroAlternatives: ["hero:a"] }), hero(null), hero(null)], { id: "team-k2", boxId: "main" });
  assert.deepEqual(duplicateWarnings([alt, alt2]), []);
});

test("#6 missingItems: tướng và chiến pháp chính không có trong kho; phương án thay không xóa dấu thiếu", () => {
  const t = team([
    hero("hero:a", ["tactic:x", "tactic:y"], { heroAlternatives: ["hero:z"] }),
    hero("hero:b", [null, "tactic:w"]),
    hero(null, [null, null], { slotState: "unresolved", rawName: "不存在" }),
  ]);
  t.heroes[0].tactics[0].alternatives = ["tactic:own"];
  const owned = new Set(["hero:z", "tactic:own", "tactic:y"]);
  assert.deepEqual(missingItems(t, owned), [
    { type: "hero", id: "hero:a", heroIndex: 0 },
    { type: "tactic", id: "tactic:x", heroIndex: 0, slotIndex: 0 },
    { type: "hero", id: "hero:b", heroIndex: 1 },
    { type: "tactic", id: "tactic:w", heroIndex: 1, slotIndex: 1 },
  ]);
  // Ô source-empty/unresolved không tính; kho đủ thì không thiếu; nhận cả mảng.
  assert.deepEqual(missingItems(t, ["hero:a", "hero:b", "tactic:x", "tactic:y", "tactic:w"]), []);
});

test("#13 normalizeTeam bản ghi hỏng từ server trả null, không ném", () => {
  const good = team(three(), { boxId: "main", groupId: "main~ghep-team", updatedAt: "2026-10-21T08:00:00.000Z", deletedAt: "" });
  const normalized = normalizeTeam(good);
  assert.equal(normalized.id, "team-a");
  assert.equal(normalized.groupId, "main~ghep-team");
  assert.deepEqual(normalizeTeam(normalized), normalized, "chuẩn hóa là phép lũy đẳng");

  for (const bad of [null, undefined, 7, "x", [], {}, { ...good, heroes: "x" }, { ...good, heroes: [] }, { ...good, heroes: [null] }, { ...good, id: 5 }, { ...good, source: null }, { ...good, source: { kind: "lạ", key: "k" } }]) {
    assert.equal(normalizeTeam(bad), null, JSON.stringify(bad));
  }
  const badSlot = structuredClone(good);
  badSlot.heroes[0].slotState = "lạ";
  assert.equal(normalizeTeam(badSlot), null);
  const badTactics = structuredClone(good);
  badTactics.heroes[0].tactics = [slot()];
  assert.equal(normalizeTeam(badTactics), null);
  // Trường tùy chọn thiếu nhận mặc định.
  const sparse = normalizeTeam({ id: "team-s", name: "S", heroes: [{ hero: "hero:a", slotState: "ok", tactics: [{}, {}] }], source: { kind: "analyze", key: "a" } });
  assert.equal(sparse.notes.general, "");
  assert.deepEqual(sparse.heroes[0].books, []);
  assert.equal(sparse.source.contentHash, "");
  assert.deepEqual(sparse.userAlternatives, []);
});
