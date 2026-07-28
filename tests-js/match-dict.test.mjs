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
  { chinese: "夺魂挟魄", hanViet: "Đoạt Hồn Hiệp Phách", viet: "Đoạt Hồn Hiệp Phách" },
  { chinese: "当锋摧决", hanViet: "Đương Phong Thôi Quyết", viet: "Đương Phong Thôi Quyết" },
  { chinese: "刮骨疗毒", hanViet: "Quát Cốt Liệu Độc", viet: "Cắt Xương Trị Độc" },
  { chinese: "上兵伐谋", hanViet: "Thượng Binh Phạt Mưu", viet: "Thượng Binh Phạt Mưu" },
  { chinese: "焚辎营垒", hanViet: "Phần Truy Doanh Lũy", viet: "Thiêu Đốt Doanh Lũy" },
  { chinese: "灵机一动", hanViet: "Linh Cơ Nhất Động", viet: "Nhanh Trí Động Não" },
  { chinese: "临机制胜", hanViet: "Lâm Cơ Chế Thắng", viet: "Thời Cơ Chiến Thắng" },
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
  assert.equal(r.secondScore < r.score, true);
  assert.equal(r.ambiguous, false);
  assert.equal(r.reviewRequired, false);
});

test("Hán OCR-lỗi-giả -> fuzzy về đúng top", () => {
  // 神机刀算 (sai 1 ký tự) -> 神机妙算
  const r = matchDict("神机刀算", DICT);
  assert.equal(r.record.viet, "Thần Cơ Diệu Toán");
  assert.ok(r.score >= 0.7 && r.score < 1, `score=${r.score}`);
});

test("Hán viết tắt trong ảnh -> khớp chiến pháp đầy đủ", () => {
  for (const [query, expected] of [
    ["夺魂", "Đoạt Hồn Hiệp Phách"],
    ["当锋", "Đương Phong Thôi Quyết"],
    ["刮骨", "Cắt Xương Trị Độc"],
    ["上兵", "Thượng Binh Phạt Mưu"],
    ["焚辎", "Thiêu Đốt Doanh Lũy"],
    ["灵机", "Nhanh Trí Động Não"],
    ["荧薙", "Thiêu Đốt Doanh Lũy"],
  ]) {
    const r = matchDict(query, DICT);
    assert.equal(r.matched, true, `${query} should be accepted`);
    assert.equal(r.record.viet, expected);
  }
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
  assert.equal(r.reviewRequired, true);
});

test("runner-up sát điểm buộc review thay vì tự chọn", () => {
  const ambiguous = [
    { chinese: "荀彧", viet: "SP Tuân Úc" },
    { chinese: "荀彧", viet: "Tuân Úc" },
  ];
  const r = matchDict("荀彧", ambiguous);

  assert.equal(r.score, 1);
  assert.equal(r.secondScore, 1);
  assert.equal(r.margin, 0);
  assert.equal(r.ambiguous, true);
  assert.equal(r.reviewRequired, true);
});

test("fuzzy margin đủ rộng không buộc review", () => {
  const r = matchDict("神机", DICT);

  assert.ok(r.margin > 0.05);
  assert.equal(r.ambiguous, false);
  assert.equal(r.reviewRequired, false);
});

test("searchDict trả nhiều kết quả xếp hạng", () => {
  const res = searchDict("tran", DICT); // 'trận' bỏ dấu -> Bát Môn Kim Tỏa Trận
  assert.ok(res.length >= 1);
  assert.equal(res[0].record.viet, "Bát Môn Kim Tỏa Trận");
});
