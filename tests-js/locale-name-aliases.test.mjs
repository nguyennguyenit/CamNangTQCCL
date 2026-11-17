// `withLocaleAliases` nối tên Nhật vào bí danh từ điển cho bộ khớp tên (Soi đội, eval Worker): hàm thuần, không sửa bản ghi gốc.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { withLocaleAliases } from "../js/locale-name-aliases.js";
import { classifyName, createEntityIndex } from "../js/analyze-map.js";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

test("nối tên Nhật sau bí danh cũ, bỏ trùng, giữ thứ tự; bản ghi gốc không đổi", () => {
  const dict = [
    { id: "hero:a", chinese: "樂進", aliases: ["Nhạc Tiến", "乐进"] },
    { id: "hero:b", chinese: "法正", aliases: ["法正"] },
    { id: "hero:c", chinese: "關羽" },
  ];
  const before = structuredClone(dict);
  const entries = { "hero:a": { name: "楽進" }, "hero:b": { name: "法正" } };
  const out = withLocaleAliases(dict, entries);
  assert.deepEqual(out.map((row) => row.aliases), [["Nhạc Tiến", "乐进", "楽進"], ["法正"], []]);
  assert.deepEqual(dict, before);
  assert.notEqual(out[0], dict[0]);
  assert.equal(out[2].chinese, "關羽");
});

test("tên biến thể viết liền thêm dạng tách tiền tố như ảnh client in; nhận cả tài liệu lookup-ja", () => {
  const [row] = withLocaleAliases([{ id: "hero:sp", aliases: [] }], { entries: { "hero:sp": { name: "SP法正" } } });
  assert.deepEqual(row.aliases, ["SP法正", "SP 法正"]);
  assert.deepEqual(withLocaleAliases([{ id: "x", aliases: ["a"] }], null)[0].aliases, ["a"]);
  assert.throws(() => withLocaleAliases(null, {}), TypeError);
});

test("bộ khớp tên của Soi đội nhận tên Nhật in trong ảnh sau khi nối bí danh (dữ liệu thật)", () => {
  const heroes = json("data/heroes-dict.json");
  const ja = json("data/lookup-ja.json");
  const plain = createEntityIndex(heroes, "hero");
  const aliased = createEntityIndex(withLocaleAliases(heroes, ja), "hero");
  // Tên Nhật mà bộ khớp cũ không khớp chắc đúng tướng (tự dạng Nhật khác cả phồn lẫn giản thể).
  const gained = heroes.filter((row) => {
    const name = ja.entries[row.id]?.name;
    if (!name) return false;
    const before = classifyName(name, plain);
    return !(before.state === "sure" && before.id === row.id);
  });
  assert.ok(gained.length > 0, "cần ít nhất một tên Nhật mà bộ khớp cũ không khớp chắc");
  for (const row of gained) {
    const after = classifyName(ja.entries[row.id].name, aliased);
    if (aliased.exact.get(ja.entries[row.id].name.replace(/\s+/gu, "")) === null) continue; // trùng tên Nhật giữa hai ID: để mơ hồ
    assert.deepEqual([after.state, after.id], ["sure", row.id], ja.entries[row.id].name);
  }
});
