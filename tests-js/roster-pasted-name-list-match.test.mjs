import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCatalog, addPicked } from "../js/roster-picker.js";
import { MAX_PASTED_NAMES, buildPasteIndex, matchPastedNames, splitPastedNames } from "../js/roster-pasted-name-list-match.js";
import { createInitialRosterScanState } from "../js/roster-scan-state.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const catalog = buildCatalog({ heroesDict: load("heroes-dict.json"), tacticsDict: load("tactics.json") }, "inventory");
const index = buildPasteIndex(catalog);
const names = (rows) => rows.map((row) => row.item.name);

test("tách theo dòng, tab, dấu phẩy, chấm phẩy (cả dấu Trung), bỏ số thứ tự/gạch đầu dòng, tên rỗng và tên trùng", () => {
  const text = "1. Tào Tháo\r\n2) Lưu Bị, Quan Vũ;Gia Cát Lượng\n\n - Chu Du\tTôn Quyền\n• 吕布，赵云；马超、貂蝉\n tào  tháo \n​Lưu Bị";
  const { names: got, truncated } = splitPastedNames(text);
  assert.deepEqual(got, ["Tào Tháo", "Lưu Bị", "Quan Vũ", "Gia Cát Lượng", "Chu Du", "Tôn Quyền", "吕布", "赵云", "马超", "貂蝉"]);
  assert.equal(truncated, 0);
});

test("tên có số trong thân (SP, 40Y) không bị cắt; chỉ ký hiệu đầu dòng có dấu chấm/ngoặc/khoảng trắng mới bị bỏ", () => {
  assert.deepEqual(splitPastedNames("SP Lữ Mông\n10. SP Tào Tháo").names, ["SP Lữ Mông", "SP Tào Tháo"]);
});

test("quá trần thì cắt và báo số tên bị bỏ", () => {
  const text = Array.from({ length: MAX_PASTED_NAMES + 5 }, (_, i) => `ten-${i}`).join("\n");
  const { names: got, truncated } = splitPastedNames(text);
  assert.equal(got.length, MAX_PASTED_NAMES);
  assert.equal(truncated, 5);
});

test("tiêu chí #61: dán 10 tên trong đó 2 tên sai → 8 món khớp, 2 tên ở danh sách không nhận ra", () => {
  const text = "Tào Tháo\nLưu Bị\nQuan Vũ\nGia Cát Lượng\nChu Duu\nTôn Quyền\nLữ Bố\nTriệu Vân\nMã Siêu\nXyz Không Có";
  const result = matchPastedNames(splitPastedNames(text).names, index);
  assert.deepEqual(names(result.matched), ["Tào Tháo", "Lưu Bị", "Quan Vũ", "Gia Cát Lượng", "Tôn Quyền", "Lữ Bố", "Triệu Vân", "Mã Siêu"]);
  assert.deepEqual(result.unrecognized, ["Chu Duu", "Xyz Không Có"]);
  assert.deepEqual(result.ambiguous, []);
  // Thêm vào kho đúng 8 món theo tên Việt chuẩn.
  const state = addPicked(createInitialRosterScanState(), result.matched.map((row) => row.item));
  assert.equal(state.ownedHeroes.length, 8);
});

test("tên gõ gần đúng không bị đoán sang món khác (không so Levenshtein)", () => {
  const result = matchPastedNames(["Tao Thao X", "Tào", "Lưu Bỵ", "曹"], index);
  assert.deepEqual(result.matched, []);
  assert.deepEqual(result.unrecognized, ["Tao Thao X", "Tào", "Lưu Bỵ", "曹"]);
});

test("nhận tên bỏ dấu, hoa thường, Hán-Việt, chữ Hán giản/phồn; tên khác nhau trỏ cùng món gộp một dòng", () => {
  const result = matchPastedNames(["tao thao", "曹操", "LƯU BỊ", "刘备", "劉備", "SP吕蒙", "sp  lữ mông", "Binh Vô Thường Thế", "兵锋"], index);
  assert.deepEqual(names(result.matched), ["Tào Tháo", "Lưu Bị", "SP Lữ Mông", "Binh Vô Thường Thế", "Binh Phong"]);
  assert.deepEqual(result.matched[0].inputs, ["tao thao", "曹操"]);
  assert.deepEqual(result.matched[1].inputs, ["LƯU BỊ", "刘备", "劉備"]);
  assert.equal(result.matched[3].item.type, "tactics");
  assert.deepEqual(result.unrecognized, []);
});

test("tên mơ hồ (khớp nhiều món sau khi bỏ dấu) vào nhóm cần chọn, không tự chọn; gõ đúng dấu thì khớp một món", () => {
  const vague = matchPastedNames(["truong bao"], index);
  assert.deepEqual(vague.matched, []);
  assert.equal(vague.ambiguous.length, 1);
  assert.equal(vague.ambiguous[0].input, "truong bao");
  assert.deepEqual(vague.ambiguous[0].candidates.map((item) => item.name).sort(), ["Trương Bào", "Trương Bảo Khăn Vàng"]);

  // "Trương Bảo" là alias giữ dấu của Trương Bảo Khăn Vàng; "Trương Bào" là tên của Trương Bào.
  assert.deepEqual(names(matchPastedNames(["Trương Bảo"], index).matched), ["Trương Bảo Khăn Vàng"]);
  assert.deepEqual(names(matchPastedNames(["Trương Bào"], index).matched), ["Trương Bào"]);
});

test("chiến pháp tự mang có trong danh mục nhưng không vào kho: tách nhóm riêng, không tính là khớp", () => {
  const result = matchPastedNames(["Bách Phát Bách Trúng", "百步穿楊"], index);
  assert.deepEqual(result.matched, []);
  assert.deepEqual(result.unrecognized, []);
  assert.deepEqual(result.innate.map((row) => [row.input, row.item.name]), [
    ["Bách Phát Bách Trúng", "Bách Phát Bách Trúng"],
    ["百步穿楊", "Bách Phát Bách Trúng"],
  ]);
});

test("nhận danh mục trực tiếp thay cho chỉ mục; danh mục không có `names` dùng `name`; binh thư bị bỏ", () => {
  const tiny = [
    { type: "heroes", id: "hero:a", name: "Tướng A" },
    { type: "books", id: "book:a", name: "Tướng A" },
  ];
  const result = matchPastedNames(["tuong a", "Sách"], tiny);
  assert.deepEqual(result.matched.map((row) => row.item.id), ["hero:a"]);
  assert.deepEqual(result.unrecognized, ["Sách"]);
});
