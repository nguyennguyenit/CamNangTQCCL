import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveHeroTactics } from "../js/hero-detail.js";

const TACTICS = [
  { chinese: "乱世奸雄", viet: "Loạn Thế Gian Hùng", hanViet: "Loạn Thế Gian Hùng", type: "Bị động", quality: "S", effect: "Hiệu ứng tự mang." },
  { chinese: "梦中弑臣", viet: "Mộng Trung Thí Thần", hanViet: "Mộng Trung Thí Thần", type: "Đột kích", quality: "A", effect: "Hiệu ứng truyền thừa." },
];

function hero(over) {
  return {
    chinese: "曹操", hanViet: "Tào Tháo", faction: "Ngụy", stars: 5,
    selfTacticCn: "乱世奸雄", inheritTacticCn: "梦中弑臣",
    troopApt: { ky: "S", thuan: "S", cung: "A", thuong: "A", khiGioi: "B" },
    roleTag: "辅", roleTagViet: "Phụ trợ",
    stats: { luc: "72", tri: "91", thong: "99", toc: "64", chinh: "94", mi: "96" },
    ...over,
  };
}

test("link 2 chiến pháp theo chinese -> tên VN + effect", () => {
  const slots = resolveHeroTactics(hero(), TACTICS);
  assert.equal(slots.length, 2);
  const self = slots.find((s) => s.slot === "Tự mang");
  const inherit = slots.find((s) => s.slot === "Truyền thừa");
  assert.equal(self.linked, true);
  assert.equal(self.viet, "Loạn Thế Gian Hùng");
  assert.equal(self.effect, "Hiệu ứng tự mang.");
  assert.equal(inherit.linked, true);
  assert.equal(inherit.viet, "Mộng Trung Thí Thần");
  assert.equal(inherit.effect, "Hiệu ứng truyền thừa.");
});

test("không khớp tactics -> fallback tên Hán, linked=false", () => {
  const slots = resolveHeroTactics(hero({ selfTacticCn: "高橹联营" }), TACTICS);
  const self = slots.find((s) => s.slot === "Tự mang");
  assert.equal(self.linked, false);
  assert.equal(self.chinese, "高橹联营");
  assert.equal(self.viet, ""); // không có tên VN -> UI hiện chinese
});

test("thiếu tên chiến pháp -> bỏ slot", () => {
  const slots = resolveHeroTactics(hero({ inheritTacticCn: "" }), TACTICS);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].slot, "Tự mang");
});
