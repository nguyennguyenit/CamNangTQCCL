// `js/shinjitai.js` phải đổi chữ đúng như `pipeline/shinjitai.py`: cùng bảng `data/ja-kanji-variants.json`, cùng bộ vector
// `tests/fixtures/shinjitai-vectors.json` (Python kiểm ở tests/test_ja_shinjitai.py).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ShinjitaiTableError, createShinjitai, parseKanjiVariants, toShinjitai } from "../js/shinjitai.js";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const table = parseKanjiVariants(json("data/ja-kanji-variants.json"));
const vectors = json("tests/fixtures/shinjitai-vectors.json").cases;

test("mọi vector dùng chung với Python cho đúng kết quả", () => {
  assert.ok(vectors.length > 50, `chỉ có ${vectors.length} vector`);
  for (const { input, expected } of vectors) assert.equal(toShinjitai(input, table), expected, input);
});

test("ký tự ngoài bảng (Latin, số, khoảng trắng, chữ đã là tự dạng Nhật) giữ nguyên; đổi lần hai không đổi thêm", () => {
  assert.equal(toShinjitai("SP 40Y abc 123 劉", table), "SP 40Y abc 123 劉");
  for (const { expected } of vectors) assert.equal(toShinjitai(expected, table), expected);
  assert.equal(toShinjitai("", table), "");
});

test("bảng sai dạng bị từ chối thay vì đổi chữ theo bảng hỏng", () => {
  assert.throws(() => parseKanjiVariants({}), ShinjitaiTableError);
  assert.throws(() => parseKanjiVariants({ map: {} }), ShinjitaiTableError);
  assert.throws(() => parseKanjiVariants({ map: { 國: "国国" } }), ShinjitaiTableError);
  assert.throws(() => parseKanjiVariants({ map: { 國: "國" } }), /tự ánh xạ/);
  assert.throws(() => parseKanjiVariants({ map: { 國: "国", 国: "囗" } }), /nối tiếp/);
  assert.throws(() => toShinjitai(null, table), TypeError);
  assert.throws(() => toShinjitai("國", null), TypeError);
});

test("bảng trả về đông cứng; createShinjitai gắn sẵn bảng", () => {
  assert.ok(Object.isFrozen(table));
  const convert = createShinjitai({ 國: "国", 將: "将" });
  assert.equal(convert("國士將風"), "国士将風");
});
