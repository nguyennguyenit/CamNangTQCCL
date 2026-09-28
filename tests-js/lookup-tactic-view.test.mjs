import { test } from "node:test";
import assert from "node:assert/strict";

import {
  tacticCamNangView,
  tacticEffectSegments,
  tacticEffectVersions,
  tacticSourceLabel,
  tacticTroopFit,
} from "../js/lookup-tactic-view.js";
import { parseTacticSummaries } from "../js/tactic-summaries.js";

const HASH_T = "a".repeat(64);
const HASH_H = "b".repeat(64);

test("tacticEffectSegments in đậm đúng giá trị cấp 1 → cấp tối đa", () => {
  assert.deepEqual(tacticEffectSegments("tăng 20→40 Võ lực, xác suất 5% → 10%; kéo dài 1 lượt"), [
    { text: "tăng ", strong: false },
    { text: "20→40", strong: true },
    { text: " Võ lực, xác suất ", strong: false },
    { text: "5%→10%", strong: true },
    { text: "; kéo dài 1 lượt", strong: false },
  ]);
  assert.deepEqual(tacticEffectSegments("không có số theo cấp"), [{ text: "không có số theo cấp", strong: false }]);
});

test("tacticEffectVersions: bản Việt dùng revisions (bản hiện hành trước), bản zh tách chữ Hán nguồn", () => {
  const record = {
    effect: "2020-04-01 更新（重做） / 新效果 /  / 原始版本 / 舊效果",
    effectViet: "không dùng khi có revisions",
    lookup: {
      revisions: [
        { effectiveDate: null, isCurrent: false, labelVi: "Bản gốc", textVi: "Hiệu ứng cũ" },
        { effectiveDate: "2020-04-01", isCurrent: true, labelVi: "Bản hiện hành", textVi: "Hiệu ứng mới" },
      ],
    },
  };
  assert.deepEqual(tacticEffectVersions(record, "vi"), [
    { label: "Bản hiện hành · 2020-04-01", paragraphs: ["Hiệu ứng mới"] },
    { label: "Bản gốc", paragraphs: ["Hiệu ứng cũ"] },
  ]);
  assert.deepEqual(tacticEffectVersions(record, "zh"), [
    { label: "2020-04-01 更新（重做）", paragraphs: ["新效果"] },
    { label: "原始版本", paragraphs: ["舊效果"] },
  ]);
  assert.deepEqual(tacticEffectVersions({ effectViet: "Một đoạn", lookup: { revisions: [] } }, "vi"), [
    { label: null, paragraphs: ["Một đoạn"] },
  ]);
});

test("nhãn nguồn và binh chủng hợp theo ngôn ngữ", () => {
  assert.equal(tacticSourceLabel("INHERITANCE", "vi"), "Truyền thừa");
  assert.equal(tacticSourceLabel("INNATE", "zh"), "自带");
  assert.equal(tacticSourceLabel("KHAC", "vi"), null);
  assert.deepEqual(tacticTroopFit(["Kỵ binh"], "vi"), { all: false, labels: ["Kỵ binh"], text: "Kỵ binh" });
  assert.equal(tacticTroopFit(["Kỵ", "Cung", "Thương", "Khiên", "Khí giới"], "zh").text, "全兵种");
  assert.equal(tacticTroopFit([], "vi"), null);
});

function payload(overrides = {}) {
  return {
    schemaVersion: 1,
    provenance: { tacticCatalogSha256: `sha256:${HASH_T}`, heroCatalogSha256: `sha256:${HASH_H}` },
    summaries: {
      "tactic:ho-bao-ky": {
        standard: { teams: 3, positions: [1, 0, 2] },
        other: { teams: 1, positions: [0, 1, 0] },
        carriers: [{ heroId: "hero:tao-thao", teams: 2 }, { heroId: "hero:khong-co", teams: 1 }],
        companions: [{ tacticId: "tactic:thiet-ky", teams: 3 }],
        representative: [
          { family: "recommended", name: "Đội A", seasonLabel: "PK-S1", score: 110, position: 0, heroId: "hero:tao-thao", sourceConfigId: "a" },
          { family: "other", name: "Đội B", seasonLabel: "", score: null, position: 1, heroId: null, legacyTeamId: "b", legacyVariantId: null },
        ],
        ...overrides,
      },
    },
  };
}

test("parseTacticSummaries kiểm provenance hai kho và tổng vị trí", () => {
  const parsed = parseTacticSummaries(payload(), { tacticCatalogSha256: HASH_T, heroCatalogSha256: HASH_H });
  assert.deepEqual(parsed["tactic:ho-bao-ky"].carriers[0], { id: "hero:tao-thao", teams: 2 });
  assert.throws(() => parseTacticSummaries(payload(), { tacticCatalogSha256: HASH_H, heroCatalogSha256: HASH_H }), /không khớp kho/);
  assert.throws(() => parseTacticSummaries(payload({ standard: { teams: 9, positions: [1, 0, 2] } }), { tacticCatalogSha256: HASH_T, heroCatalogSha256: HASH_H }), /không hợp lệ/);
  assert.throws(() => parseTacticSummaries(payload({ carriers: [{ heroId: "hero:x", teams: 9 }] }), { tacticCatalogSha256: HASH_T, heroCatalogSha256: HASH_H }), /xếp hạng/);
});

test("tacticCamNangView lấy tên từ corpus, bỏ ID chưa có, thanh là tỷ lệ trên tổng đội", () => {
  const summary = parseTacticSummaries(payload(), { tacticCatalogSha256: HASH_T, heroCatalogSha256: HASH_H })["tactic:ho-bao-ky"];
  const byId = new Map([
    ["hero:tao-thao", { nameVi: "Tào Tháo", record: { chinese: "曹操" } }],
    ["tactic:thiet-ky", { nameVi: "Thiết Kỵ Khu Trì", record: { chinese: "鐵騎驅馳" } }],
  ]);
  const view = tacticCamNangView(summary, { byId }, "vi");
  assert.equal(view.standard, 3);
  assert.equal(view.other, 1);
  assert.deepEqual(view.positions.map((row) => [row.label, row.count, row.percent]), [["Chủ tướng", 1, 25], ["Phó tướng 1", 1, 25], ["Phó tướng 2", 2, 50]]);
  assert.deepEqual(view.carriers, [{ id: "hero:tao-thao", name: "Tào Tháo", teams: 2, percent: 50 }]);
  assert.deepEqual(view.companions, [{ id: "tactic:thiet-ky", name: "Thiết Kỵ Khu Trì", teams: 3 }]);
  assert.deepEqual(view.representative.map((team) => team.meta), ["Tào Tháo mang · PK-S1", ""]);
  const zh = tacticCamNangView(summary, { byId }, "zh");
  assert.equal(zh.carriers[0].name, "曹操");
  assert.equal(zh.representative[0].meta, "曹操 携带 · PK-S1");
  assert.equal(tacticCamNangView(undefined, { byId }, "vi"), null);
});
