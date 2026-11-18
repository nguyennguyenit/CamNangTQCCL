// js/building-upgrade-calculator.js — cây view của máy tính nâng cấp công trình (vi/zh/ja): thời lượng, câu "thiếu dữ liệu
// cấp N", dòng, khối tổng và dòng mới mặc định.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildingCalculatorBodyTree,
  buildingCalculatorShellTree,
  formatUpgradeDuration,
  missingLevelMessages,
  nextUpgradeRow,
} from "../js/building-upgrade-calculator.js";
import { sumLevelRange } from "../js/building-upgrade-totals.js";
import { treeToHtml } from "../js/view-tree.js";

const plain = (trees) => [].concat(trees).filter(Boolean).map(treeToHtml).join(" ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const level = (number, costs, durationVi) => ({ level: number, costs, durationVi, durationZh: null });
const BARRACKS = {
  id: "building:quan-doanh", nameVi: "Quân Doanh", aliasesZh: ["軍營"], maxLevel: 3,
  levels: [
    level(1, { wood: null, stone: null, iron: null }, null),
    level(2, { wood: 100, stone: 200, iron: null }, "1 giờ"),
    level(3, { wood: 300, stone: 400, iron: 50 }, "1 ngày 30 phút"),
  ],
};
const STORE = {
  id: "building:kho", nameVi: "Kho", aliasesZh: ["倉庫"], maxLevel: 2,
  levels: [level(1, { wood: 10, stone: 10, iron: 10 }, "30 giây"), level(2, { wood: 20, stone: 20, iron: 20 }, "2 phút")],
};
const RECORDS = [BARRACKS, STORE];

test("formatUpgradeDuration hiện ngày/giờ/phút/giây theo ngôn ngữ", () => {
  assert.equal(formatUpgradeDuration(90061, "vi"), "1 ngày 1 giờ 1 phút 1 giây");
  assert.equal(formatUpgradeDuration(7200, "vi"), "2 giờ");
  assert.equal(formatUpgradeDuration(0, "vi"), "0 phút");
  assert.equal(formatUpgradeDuration(90060, "zh"), "1天1小时1分钟");
  assert.equal(formatUpgradeDuration(0, "zh"), "0分钟");
  assert.equal(formatUpgradeDuration(90061, "ja"), "1日1時間1分1秒");
  assert.equal(formatUpgradeDuration(0, "ja"), "0分");
});

test("missingLevelMessages nêu rõ cấp thiếu tài nguyên và/hoặc thời gian", () => {
  const result = { missingCostLevels: [1, 2], missingTimeLevels: [1, 4] };
  assert.deepEqual(missingLevelMessages(result, "vi"), [
    "Thiếu dữ liệu cấp 1: tài nguyên và thời gian",
    "Thiếu dữ liệu cấp 2: tài nguyên",
    "Thiếu dữ liệu cấp 4: thời gian",
  ]);
  assert.deepEqual(missingLevelMessages({ missingCostLevels: [1, 2], missingTimeLevels: [1, 2] }, "zh"), ["缺少第 1、2 级数据：资源和耗时"]);
  assert.deepEqual(missingLevelMessages({ missingCostLevels: [1, 2], missingTimeLevels: [1, 2] }, "ja"), ["Lv 1、2 の資源・所要時間データがありません"]);
  assert.deepEqual(missingLevelMessages(sumLevelRange(STORE.levels, 0, 2), "vi"), []);
});

test("thân máy tính: dòng, cảnh báo cấp thiếu và khối tổng (vi)", () => {
  const rows = [{ buildingId: BARRACKS.id, from: 0, to: 3 }, { buildingId: STORE.id, from: 1, to: 2 }];
  const html = buildingCalculatorBodyTree(rows, RECORDS, "vi").filter(Boolean).map(treeToHtml).join("");
  const words = plain(buildingCalculatorBodyTree(rows, RECORDS, "vi"));
  assert.match(html, /<option value="building:quan-doanh" selected>Quân Doanh · Lv 3<\/option>/u);
  assert.match(html, /data-field="from"[^>]*>|value="0"/u);
  assert.match(words, /Lv 0 → 3 · Gỗ 400 · Đá 600 · Sắt 50 · 1 ngày 1 giờ 30 phút/u);
  assert.match(words, /Thiếu dữ liệu cấp 1: tài nguyên và thời gian/u);
  assert.match(words, /Lv 1 → 2 · Gỗ 20 · Đá 20 · Sắt 20 · 2 phút/u);
  assert.match(words, /Tổng cộng Gỗ 420 Đá 620 Sắt 70 Thời gian 1 ngày 1 giờ 32 phút/u);
  assert.match(words, /Tổng chưa gồm 1 cấp thiếu dữ liệu\./u);
  assert.match(html, /aria-label="Bỏ dòng Quân Doanh"/u);
});

test("thân máy tính bản zh và trạng thái rỗng/khoảng sai", () => {
  const zh = plain(buildingCalculatorBodyTree([{ buildingId: STORE.id, from: 0, to: 2 }], RECORDS, "zh"));
  assert.match(zh, /倉庫 · 2 级/u);
  assert.match(zh, /0 级 → 2 级 · 木材 30 · 石料 30 · 铁矿 30 · 2分钟30秒/u);
  assert.match(zh, /合计 木材 30 石料 30 铁矿 30 耗时 2分钟30秒/u);
  assert.doesNotMatch(zh, /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u);
  assert.match(plain(buildingCalculatorBodyTree([], RECORDS, "vi")), /Chưa có công trình nào\./u);
  assert.match(plain(buildingCalculatorBodyTree([{ buildingId: STORE.id, from: 2, to: 1 }], RECORDS, "vi")), /Cấp đích cần lớn hơn cấp hiện tại\./u);
});

test("khung dựng lúc build ẩn tới khi có JavaScript", () => {
  const html = treeToHtml(buildingCalculatorShellTree("vi"));
  assert.match(html, /^<section class="building-calc" data-building-calc hidden aria-labelledby="building-calc-title">/u);
  assert.match(html, /Tính tài nguyên nâng cấp/u);
  assert.match(treeToHtml(buildingCalculatorShellTree("zh")), /升级资源计算/u);
});

test("nextUpgradeRow ưu tiên công trình đang mở, rồi công trình chưa chọn", () => {
  assert.deepEqual(nextUpgradeRow([], RECORDS, STORE.id), { buildingId: STORE.id, from: 0, to: 2 });
  assert.deepEqual(nextUpgradeRow([{ buildingId: BARRACKS.id, from: 0, to: 3 }], RECORDS), { buildingId: STORE.id, from: 0, to: 2 });
  assert.deepEqual(nextUpgradeRow([{ buildingId: STORE.id, from: 0, to: 2 }], RECORDS, STORE.id), { buildingId: BARRACKS.id, from: 0, to: 3 });
  assert.equal(nextUpgradeRow([], []), null);
});

test("bản ja: nhãn, đơn vị và khối tổng bằng tiếng Nhật, không lộ chữ Việt", () => {
  const ja = plain(buildingCalculatorBodyTree([{ buildingId: STORE.id, from: 0, to: 2 }], RECORDS, "ja"));
  assert.match(ja, /Lv 0 → 2 · 木材 30 · 石材 30 · 鉄鉱 30 · 2分30秒/u);
  assert.match(ja, /合計 木材 30 石材 30 鉄鉱 30 所要時間 2分30秒/u);
  assert.match(ja, /現在のレベル/u);
  assert.match(plain(buildingCalculatorBodyTree([], RECORDS, "ja")), /施設がまだありません/u);
  assert.doesNotMatch(ja, /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u);
  assert.match(treeToHtml(buildingCalculatorShellTree("ja")), /レベルアップ資源の計算/u);
});
