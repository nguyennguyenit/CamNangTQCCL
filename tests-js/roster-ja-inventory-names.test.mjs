// Gợi ý đội bản ja: ô "Dán danh sách tên" và ô tìm của bảng chọn nhanh khớp tên Nhật (lookup-ja) và chữ Hán tự dạng Nhật
// (shinjitai), dùng chung lớp tên Nhật với Soi đội. Dữ liệu thật của `data/`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCatalog, filterCatalog } from "../js/roster-picker.js";
import { matchPastedNames } from "../js/roster-pasted-name-list-match.js";
import { withJaInventoryNames } from "../js/locale-name-aliases.js";
import { parseKanjiVariants } from "../js/shinjitai.js";
import { createJaNameResolver } from "../js/website-display.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const heroesDict = load("heroes-dict.json");
const tacticsDict = load("tactics.json");
const jaDocument = load("lookup-ja.json");
const resolver = createJaNameResolver([heroesDict, tacticsDict, load("books-dict.json")], jaDocument, parseKanjiVariants(load("ja-kanji-variants.json")));
const jaCatalog = buildCatalog({
  heroesDict: withJaInventoryNames(heroesDict, jaDocument.entries, resolver.shinjitai),
  tacticsDict: withJaInventoryNames(tacticsDict, jaDocument.entries, resolver.shinjitai),
}, "inventory");
const baseCatalog = buildCatalog({ heroesDict, tacticsDict }, "inventory");
const matchedIds = (result) => result.matched.map((row) => row.item.id);

test("bộ tra tên ja đưa phép đổi tự dạng Nhật ra ngoài", () => {
  assert.equal(resolver.shinjitai("蔡文姬"), "蔡文姫");
  assert.equal(resolver.shinjitai("Quan Vũ"), "Quan Vũ");
});

test("dán tên Nhật: 関羽 về Quan Vũ (danh mục chưa nối tên Nhật thì không nhận)", () => {
  assert.deepEqual(matchedIds(matchPastedNames(["関羽"], jaCatalog)), ["hero:quan-vu"]);
  assert.deepEqual(matchPastedNames(["関羽"], baseCatalog).unrecognized, ["関羽"]);
  // Tên Việt, Hán-Việt và chữ Hán nguồn vẫn khớp như trước.
  assert.deepEqual(matchedIds(matchPastedNames(["Quan Vũ", "關羽", "关羽"], jaCatalog)), ["hero:quan-vu"]);
});

test("chữ Hán chỉ khác tự dạng Nhật vẫn khớp, kể cả khi tên Nhật là tên khác", () => {
  // 蔡文姬 (nguồn) viết kiểu Nhật là 蔡文姫; tên Nhật của tướng là 蔡琰. Cả hai đều về đúng tướng.
  assert.deepEqual(matchedIds(matchPastedNames(["蔡文姫"], jaCatalog)), ["hero:thai-van-co"]);
  assert.deepEqual(matchedIds(matchPastedNames(["蔡琰"], jaCatalog)), ["hero:thai-van-co"]);
  assert.deepEqual(matchPastedNames(["蔡文姫"], baseCatalog).unrecognized, ["蔡文姫"]);
});

test("tên mơ hồ vẫn vào nhóm cần chọn: tên Nhật của mục này trùng tự dạng Nhật của mục khác", () => {
  // Dữ liệu thật hiện không có tên chữ Hán nào trỏ hai món thêm được vào kho, nên dựng hai tướng giả.
  const heroes = [
    { id: "hero:a", viet: "Tướng A", chinese: "張遼", aliases: [] },
    { id: "hero:b", viet: "Tướng B", chinese: "張遼將", aliases: [] },
  ];
  const catalog = buildCatalog({ heroesDict: withJaInventoryNames(heroes, { "hero:b": { name: "張遼" } }, resolver.shinjitai) }, "inventory");
  const { matched, ambiguous } = matchPastedNames(["張遼"], catalog);
  assert.equal(matched.length, 0);
  assert.deepEqual(ambiguous.map((row) => row.candidates.map((item) => item.id).sort()), [["hero:a", "hero:b"]]);
});

test("金城湯池 (tên Nhật của 固若金湯, cũng là chữ Hán nguồn của chiến pháp khác) chỉ vào nhóm tự mang, không khớp nhầm", () => {
  const { matched, ambiguous, innate } = matchPastedNames(["金城湯池"], jaCatalog);
  assert.equal(matched.length + ambiguous.length, 0);
  assert.equal(innate.length, 1);
});

test("ô tìm của bảng chọn nhanh nhận tên Nhật và tự dạng Nhật", () => {
  const ids = (query, kind) => filterCatalog(jaCatalog, { kind, query }).map((item) => item.id);
  assert.ok(ids("関羽", "heroes").includes("hero:quan-vu"));
  assert.ok(ids("蔡文姫", "heroes").includes("hero:thai-van-co"));
  assert.deepEqual(filterCatalog(baseCatalog, { kind: "heroes", query: "関羽" }), []);
});

test("withJaInventoryNames không đổi bản ghi gốc, không có bảng tự dạng thì chỉ nối tên Nhật", () => {
  const record = heroesDict.find((row) => row.id === "hero:thai-van-co");
  const before = JSON.stringify(record);
  const [onlyJa] = withJaInventoryNames([record], jaDocument.entries);
  assert.ok(onlyJa.aliases.includes("蔡琰"));
  assert.ok(!onlyJa.aliases.includes("蔡文姫"));
  const [noLayer] = withJaInventoryNames([record], null, resolver.shinjitai);
  assert.ok(noLayer.aliases.includes("蔡文姫"));
  assert.equal(JSON.stringify(record), before);
});
