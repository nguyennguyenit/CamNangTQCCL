// js/han-script.js: lối viết (giản / phồn) của tên chữ Hán để gắn `lang`.
import assert from "node:assert/strict";
import test from "node:test";
import { hanScriptLang } from "../js/han-script.js";

test("giản thể → zh-Hans, phồn thể → zh-Hant", () => {
  assert.equal(hanScriptLang("白马替主"), "zh-Hans");
  assert.equal(hanScriptLang("霸王讨逆"), "zh-Hans");
  assert.equal(hanScriptLang("隱忍奪權"), "zh-Hant");
  assert.equal(hanScriptLang("八陣圖"), "zh-Hant");
  // Chữ hai lối viết cùng dùng (群) không là bằng chứng.
  assert.equal(hanScriptLang("舌戰群儒"), "zh-Hant");
  assert.equal(hanScriptLang("SP 荀彧"), "zh");
});

test("không có chữ phân biệt được hoặc lẫn cả hai lối viết → zh", () => {
  assert.equal(hanScriptLang("恩服兵心"), "zh");
  assert.equal(hanScriptLang("白马白馬"), "zh");
  // OpenCC coi 秘 là chữ giản thể (phồn 祕) còn 術 là phồn thể: lẫn thì không đoán.
  assert.equal(hanScriptLang("金丹秘術"), "zh");
  assert.equal(hanScriptLang(""), "zh");
  assert.equal(hanScriptLang(null), "zh");
  assert.equal(hanScriptLang("Bạch Mã"), "zh");
});
