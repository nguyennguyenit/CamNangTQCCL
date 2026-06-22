// TDD js/match-dict.js — fuzzy match Hán / Hán-Việt / Việt -> record canonical.
import { test } from "node:test";
import assert from "node:assert/strict";
import { levenshtein, ratio, matchDict, searchDict } from "../js/match-dict.js";

// Dict mẫu (rút gọn từ data/tactics.json).
const DICT = [
  { chinese: "魅惑", hanViet: "Mị Hoặc", viet: "Mê Hoặc" },
  { chinese: "神机妙算", hanViet: "Thần Cơ Diệu Toán", viet: "Thần Cơ Diệu Toán" },
  { chinese: "草船借箭", hanViet: "Thảo Thuyền Tá Tiễn", viet: "Thuyền Cỏ Mượn Tên" },
  { chinese: "八门金锁阵", hanViet: "Bát Môn Kim Tỏa Trận", viet: "Bát Môn Kim Tỏa Trận" },
];

test("levenshtein cơ bản", () => {
  assert.equal(levenshtein("abc", "abc"), 0);
  assert.equal(levenshtein("abc", "abd"), 1);
  assert.equal(levenshtein("", "abc"), 3);
});

test("ratio đối xứng + biên", () => {
  assert.equal(ratio("abc", "abc"), 1);
  assert.equal(ratio("", ""), 1);
  assert.ok(ratio("abc", "abd") > 0.5);
});

test("Hán exact -> high confidence", () => {
  const r = matchDict("魅惑", DICT);
  assert.equal(r.matched, true);
  assert.equal(r.record.viet, "Mê Hoặc");
  assert.equal(r.confidence, "high");
});

test("Hán OCR-lỗi-giả -> fuzzy về đúng top", () => {
  // 神机刀算 (sai 1 ký tự) -> 神机妙算
  const r = matchDict("神机刀算", DICT);
  assert.equal(r.record.viet, "Thần Cơ Diệu Toán");
  assert.ok(r.score >= 0.7 && r.score < 1, `score=${r.score}`);
});

test("Việt bỏ dấu -> khớp viet", () => {
  assert.equal(matchDict("me hoac", DICT).record.viet, "Mê Hoặc");
  assert.equal(matchDict("thuyen co muon ten", DICT).record.viet, "Thuyền Cỏ Mượn Tên");
});

test("Hán-Việt -> khớp hanViet", () => {
  assert.equal(matchDict("Thảo Thuyền Tá Tiễn", DICT).record.viet, "Thuyền Cỏ Mượn Tên");
});

test("tên lạ -> không khớp, confidence thấp", () => {
  const r = matchDict("xyzkhongtontai", DICT);
  assert.equal(r.matched, false);
  assert.equal(r.confidence, "low");
});

test("searchDict trả nhiều kết quả xếp hạng", () => {
  const res = searchDict("tran", DICT); // 'trận' bỏ dấu -> Bát Môn Kim Tỏa Trận
  assert.ok(res.length >= 1);
  assert.equal(res[0].record.viet, "Bát Môn Kim Tỏa Trận");
});
