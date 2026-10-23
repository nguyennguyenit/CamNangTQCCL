import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRosterIdResolver } from "../js/roster-id-resolve.js";
import { canonicalHeroId } from "../js/hero-identity.js";
import { createTacticIdResolver } from "../js/lookup-ids.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const heroesDict = load("heroes-dict.json");
const tacticsDict = load("tactics.json");
const resolver = createRosterIdResolver({ heroesDict, tacticsDict });

// Fixture là món kho local thật: `{name, confidence}` — không có `canonicalId` (xem addCanonicalItem).
test("1. món thủ công có trong từ điển ra đúng ID như engine, tên chuẩn lấy từ từ điển", () => {
  assert.deepEqual(resolver.item("heroes", { name: "Mã Siêu", confidence: "manual" }), { id: "hero:ma-sieu", name: "Mã Siêu" });
  assert.deepEqual(resolver.item("heroes", { name: "SP Quách Gia", confidence: "manual" }), { id: "hero:sp-quach-gia", name: "SP Quách Gia" });
  assert.equal(resolver.item("heroes", { name: "Mã Siêu" }).id, canonicalHeroId("Mã Siêu"));

  const idOf = createTacticIdResolver(tacticsDict);
  const tactic = resolver.item("tactics", { name: "Đương Phong Thôi Quyết", confidence: "manual" });
  assert.deepEqual(tactic, { id: "tactic:duong-phong-thoi-quyet", name: "Đương Phong Thôi Quyết" });
  assert.equal(tactic.id, idOf("Đương Phong Thôi Quyết"));
});

test("1b. alias chiến pháp và ID đã gộp (former) ra ID còn sống, tên chuẩn của hàng sống", () => {
  // `Thác-Cắt Xương Trị Độc` chỉ là alias của `tactic:cat-xuong-tri-doc`.
  assert.deepEqual(resolver.item("tactics", { name: "Thác-Cắt Xương Trị Độc" }), { id: "tactic:cat-xuong-tri-doc", name: "Cắt Xương Trị Độc" });

  const tactics = [
    { id: "tactic:moi", viet: "Tên Mới", hanViet: "", aliases: [], lookup: { formerIds: ["tactic:ten-cu"] } },
  ];
  const mini = createRosterIdResolver({ heroesDict: [], tacticsDict: tactics });
  // Tên cũ không còn trong từ điển nhưng slug của nó là ID đã gộp -> map sang hàng sống.
  assert.deepEqual(mini.item("tactics", { name: "Tên Cũ" }), { id: "tactic:moi", name: "Tên Mới" });
});

test("1c. canonicalId có sẵn vẫn phải có trong từ điển; tên chuẩn lấy từ hàng từ điển", () => {
  assert.deepEqual(resolver.item("heroes", { name: "bất kỳ", canonicalId: "hero:ma-sieu" }), { id: "hero:ma-sieu", name: "Mã Siêu" });
  assert.equal(resolver.item("heroes", { name: "Mã Siêu", canonicalId: "hero:khong-co" }), null);
});

test("2. tên Việt không tồn tại, tên chỉ chữ Hán, tên rỗng: null, không ném", () => {
  assert.equal(resolver.item("heroes", { name: "Tướng Không Tồn Tại" }), null);
  assert.equal(resolver.item("heroes", { name: "曹操" }), null); // canonicalHeroId ném TypeError
  assert.equal(resolver.item("tactics", { name: "Chiến Pháp Không Có" }), null);
  assert.equal(resolver.item("tactics", { name: "刮骨療毒" }), null);
  assert.equal(resolver.item("heroes", { name: "" }), null);
  assert.equal(resolver.item("heroes", null), null);
  assert.equal(resolver.item("heroes", "Mã Siêu")?.id, "hero:ma-sieu", "nhận cả chuỗi trần như engine");
});

test("2b. `looseId` luôn trả một ID ổn định (kể cả tên ngoài từ điển) cho khóa đội khóa", () => {
  assert.equal(resolver.looseId("heroes", "Mã Siêu"), "hero:ma-sieu");
  assert.equal(resolver.looseId("heroes", "Tướng Không Tồn Tại"), "hero:tuong-khong-ton-tai");
  assert.equal(resolver.looseId("heroes", "曹操"), "raw:曹操");
  assert.equal(resolver.looseId("tactics", "Đương Phong Thôi Quyết"), "tactic:duong-phong-thoi-quyet");
});
