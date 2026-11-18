// js/building-upgrade-totals.js — máy tính nâng cấp công trình: cộng tài nguyên/thời gian theo khoảng cấp, đọc thời
// lượng vi/zh, gộp nhiều dòng và trạng thái dòng trên query. Đối chiếu với `buildingTotals` trên dữ liệu thật.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_UPGRADE_ROWS,
  buildingMaxLevel,
  clampLevel,
  combineRangeTotals,
  levelDurationSeconds,
  parseDurationSeconds,
  splitDuration,
  sumLevelRange,
  upgradeRowsFromQuery,
  upgradeRowsSearch,
} from "../js/building-upgrade-totals.js";
import { buildingTotals } from "../js/lookup-master.js";

const catalog = JSON.parse(readFileSync(new URL("../data/lookup-catalog.json", import.meta.url), "utf8"));

const level = (number, costs, durationVi, durationZh = null) => ({ level: number, costs, durationVi, durationZh });
const LEVELS = [
  level(1, { wood: 100, stone: 50, iron: null }, "1 phút", "1分"),
  level(2, { wood: 200, stone: 100, iron: null }, "1 giờ 20 phút", "1小時20分"),
  level(3, { wood: null, stone: null, iron: null }, null, null),
  level(4, { wood: 400, stone: 200, iron: 10 }, "2 ngày", "2天"),
];

test("parseDurationSeconds đọc giây/phút/giờ/ngày bản Việt và bản Trung", () => {
  assert.equal(parseDurationSeconds("30 giây"), 30);
  assert.equal(parseDurationSeconds("10 phút"), 600);
  assert.equal(parseDurationSeconds("2 giờ"), 7200);
  assert.equal(parseDurationSeconds("1 giờ 20 phút"), 4800);
  assert.equal(parseDurationSeconds("1 ngày"), 86400);
  assert.equal(parseDurationSeconds("1,5 giờ"), 5400);
  assert.equal(parseDurationSeconds("4小時50分"), 17400);
  assert.equal(parseDurationSeconds("3天"), 259200);
  assert.equal(parseDurationSeconds("10秒"), 10);
  assert.equal(parseDurationSeconds("2小时5分钟"), 7500);
});

test("parseDurationSeconds trả null cho thời lượng thiếu hoặc lạ, không coi là 0", () => {
  for (const value of [null, undefined, "", "  ", "—", "2 tuần", "giờ", "2 giờ chưa rõ", 7200]) {
    assert.equal(parseDurationSeconds(value), null, String(value));
  }
});

test("levelDurationSeconds dùng durationVi, đọc durationZh khi thiếu bản Việt", () => {
  assert.equal(levelDurationSeconds(level(1, {}, "2 giờ", "9小時")), 7200);
  assert.equal(levelDurationSeconds(level(1, {}, null, "9小時")), 32400);
  assert.equal(levelDurationSeconds(level(1, {}, null, null)), null);
});

test("sumLevelRange cộng các cấp từ hiện tại + 1 tới cấp đích", () => {
  const result = sumLevelRange(LEVELS, 0, 2);
  assert.deepEqual(result.costs, { wood: 300, stone: 150, iron: null });
  assert.equal(result.seconds, 60 + 4800);
  assert.equal(result.levelCount, 2);
  assert.deepEqual(result.missingCostLevels, []);
  assert.deepEqual(result.missingTimeLevels, []);
  assert.deepEqual(sumLevelRange(LEVELS, 1, 2).costs, { wood: 200, stone: 100, iron: null });
});

test("sumLevelRange liệt kê cấp thiếu tài nguyên hoặc thời gian và không cộng chúng", () => {
  const result = sumLevelRange(LEVELS, 2, 4);
  assert.deepEqual(result.costs, { wood: 400, stone: 200, iron: 10 });
  assert.equal(result.seconds, 2 * 86400);
  assert.deepEqual(result.missingCostLevels, [3]);
  assert.deepEqual(result.missingTimeLevels, [3]);
  // Cấp nằm ngoài dữ liệu cũng là thiếu dữ liệu.
  const beyond = sumLevelRange(LEVELS, 4, 5);
  assert.deepEqual(beyond.missingCostLevels, [5]);
  assert.deepEqual(beyond.missingTimeLevels, [5]);
});

test("sumLevelRange: cấp đích không lớn hơn cấp hiện tại là khoảng rỗng", () => {
  for (const [from, to] of [[2, 2], [3, 1]]) {
    const result = sumLevelRange(LEVELS, from, to);
    assert.equal(result.levelCount, 0);
    assert.equal(result.seconds, 0);
    assert.deepEqual(result.costs, { wood: null, stone: null, iron: null });
  }
});

test("tổng từ cấp 0 tới cấp tối đa của mọi công trình bằng đúng buildingTotals", () => {
  assert.ok(catalog.buildings.length > 0);
  for (const record of catalog.buildings) {
    const result = sumLevelRange(record.levels, 0, buildingMaxLevel(record));
    assert.deepEqual(result.costs, buildingTotals(record.levels), record.id);
  }
});

test("dữ liệu thật: cấp thiếu được nêu, thời gian cộng đủ cho công trình đủ dữ liệu", () => {
  const byId = new Map(catalog.buildings.map((record) => [record.id, record]));
  const barracks = byId.get("building:quan-xa");
  const partial = sumLevelRange(barracks.levels, 0, buildingMaxLevel(barracks));
  assert.deepEqual(partial.missingCostLevels, [1, 2]);
  assert.deepEqual(partial.missingTimeLevels, [1, 2]);
  const quarry = byId.get("building:thai-thach-xu");
  const full = sumLevelRange(quarry.levels, 0, 30);
  assert.deepEqual(full.missingCostLevels, []);
  assert.deepEqual(full.missingTimeLevels, []);
  assert.equal(full.costs.stone, null);
  // Cấp 1–3 của Thái Thạch Xứ: 1 phút + 1 phút + 3 phút.
  assert.equal(sumLevelRange(quarry.levels, 0, 3).seconds, 300);
  // Thời lượng vi và zh của mọi cấp đọc ra cùng số giây.
  for (const record of catalog.buildings) {
    for (const item of record.levels) {
      if (item.durationVi || item.durationZh) {
        assert.equal(parseDurationSeconds(item.durationVi), parseDurationSeconds(item.durationZh), `${record.id} cấp ${item.level}`);
        assert.notEqual(parseDurationSeconds(item.durationVi), null, `${record.id} cấp ${item.level}`);
      }
    }
  }
});

test("combineRangeTotals gộp nhiều dòng và đếm cấp thiếu một lần", () => {
  const total = combineRangeTotals([sumLevelRange(LEVELS, 0, 2), sumLevelRange(LEVELS, 2, 4)]);
  assert.deepEqual(total.costs, { wood: 700, stone: 350, iron: 10 });
  assert.equal(total.seconds, 60 + 4800 + 2 * 86400);
  assert.equal(total.levelCount, 4);
  assert.equal(total.missingLevelCount, 1);
  assert.deepEqual(combineRangeTotals([]).costs, { wood: null, stone: null, iron: null });
});

test("splitDuration tách ngày/giờ/phút/giây", () => {
  assert.deepEqual(splitDuration(2 * 86400 + 3 * 3600 + 4 * 60 + 5), { days: 2, hours: 3, minutes: 4, seconds: 5 });
  assert.deepEqual(splitDuration(0), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test("clampLevel và buildingMaxLevel", () => {
  assert.equal(clampLevel("25", 20), 20);
  assert.equal(clampLevel(-3, 20), 0);
  assert.equal(clampLevel("7.9", 20), 7);
  assert.equal(clampLevel("", 20, 5), 5);
  assert.equal(clampLevel("abc", 20, 1), 1);
  assert.equal(buildingMaxLevel({ maxLevel: 10, levels: [] }), 10);
  assert.equal(buildingMaxLevel({ levels: [{ level: 1 }, { level: 3 }] }), 3);
  assert.equal(buildingMaxLevel({}), 0);
});

test("dòng máy tính đọc/ghi trên query, giữ khóa khác và kẹp cấp", () => {
  const buildings = [{ id: "building:quan-dinh", maxLevel: 20 }, { id: "building:thang-kho", maxLevel: 20 }];
  const rows = upgradeRowsFromQuery("?id=building:quan-dinh&nang=quan-dinh.5.20&nang=thang-kho.1.99&nang=khong-co.1.2&nang=sai", buildings);
  assert.deepEqual(rows, [
    { buildingId: "building:quan-dinh", from: 5, to: 20 },
    { buildingId: "building:thang-kho", from: 1, to: 20 },
  ]);
  const search = upgradeRowsSearch("?id=building%3Aquan-dinh&nang=cu.1.2", rows);
  assert.equal(search, "?id=building%3Aquan-dinh&nang=quan-dinh.5.20&nang=thang-kho.1.20");
  assert.deepEqual(upgradeRowsFromQuery(search, buildings), rows);
  assert.equal(upgradeRowsSearch("?nang=quan-dinh.1.2", []), "");
  const many = `?${Array.from({ length: MAX_UPGRADE_ROWS + 5 }, () => "nang=quan-dinh.0.1").join("&")}`;
  assert.equal(upgradeRowsFromQuery(many, buildings).length, MAX_UPGRADE_ROWS);
});
