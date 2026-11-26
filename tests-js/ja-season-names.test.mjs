// Tên mùa bản ja: bảng `js/ja-season-names.js` là bản chiếu của các thuật ngữ mùa đã xác minh trong `pipeline/ja-glossary.json`
// (glossary là nơi duy nhất quyết định tên). Test giữ hai nơi khớp nhau và kiểm mọi chỗ hiện tên mùa ở bản ja.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JA_SEASON_NAMES, jaSeasonLabel, jaSeasonName, localSeasonName } from "../js/ja-season-names.js";
import { seasonLabel } from "../js/community-team-data.js";
import { withLocale } from "../js/i18n.js";
import { referenceSeasonLabelTree, seasonNameText, seasonOptionText } from "../js/team-filter-section.js";
import { createJaNameResolver, createRawNameResolver, localRawName } from "../js/website-display.js";
import { treeToHtml } from "../js/view-tree.js";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const glossary = json("pipeline/ja-glossary.json").terms;
const GENERATION = json("src/data/recommended-reference/current.json").generationId;
const registry = json(`src/data/recommended-reference/${GENERATION}/seasons.json`);
const verified = (term) => typeof term.source === "string" && /^https?:\/\//u.test(term.source);
const s27 = registry.seasonOptions.find((item) => item.sourceSeasonId === "pk-s27");

test("bảng tên mùa ja khớp đúng thuật ngữ mùa đã xác minh của glossary", () => {
  const seasonRaw = new Set(registry.seasonOptions.map((item) => item.nameRaw).filter(Boolean));
  const expected = {};
  for (const term of glossary) {
    const raws = term.zh.filter((zh) => seasonRaw.has(zh));
    if (!raws.length) continue;
    assert.ok(verified(term), `tên mùa ${raws.join("/")} trong glossary phải có nguồn xác minh trước khi lên bản ja`);
    for (const raw of raws) expected[raw] = term.ja;
  }
  assert.deepEqual({ ...JA_SEASON_NAMES }, expected);
  assert.equal(JA_SEASON_NAMES["漢焰長明"], "漢焔不滅");
});

test("localSeasonName và jaSeasonLabel: chỉ bản ja đổi, mùa chưa có tên Nhật giữ nguyên", () => {
  assert.equal(localSeasonName("漢焰長明", "ja"), "漢焔不滅");
  assert.equal(localSeasonName("漢焰長明", "zh"), "漢焰長明");
  assert.equal(localSeasonName("英雄命世", "ja"), "英雄命世");
  assert.equal(jaSeasonLabel("PK-S27 · 漢焰長明"), "PK-S27 · 漢焔不滅");
  assert.equal(jaSeasonLabel("漢焰長明"), "漢焔不滅");
  assert.equal(jaSeasonLabel("PK-S26 · 英雄命世"), null);
  assert.equal(jaSeasonLabel(null), null);
});

test("nhãn mùa Đội cộng đồng bản ja: 漢焔不滅 kể cả khi chưa có bộ tra tên (lúc build); zh và vi giữ nhãn cũ", () => {
  const season = { id: "pk-s27", labelVi: "PK-S27 · Hán Diễm Trường Minh", labelZh: "PK-S27 · 漢焰長明" };
  assert.equal(seasonLabel(season, "ja"), "PK-S27 · 漢焔不滅");
  assert.equal(seasonLabel(season, "zh"), "PK-S27 · 漢焰長明");
  assert.equal(seasonLabel(season, "vi"), "PK-S27 · Hán Diễm Trường Minh");
  assert.equal(seasonLabel({ id: "pk-s26", labelVi: "PK-S26 · Anh Hùng Mệnh Thế", labelZh: "PK-S26 · 英雄命世" }, "ja"), "PK-S26 · 英雄命世");
});

test("jaSeasonName chỉ trả tên đã xác minh, mùa khác trả null", () => {
  assert.equal(jaSeasonName("漢焰長明"), "漢焔不滅");
  assert.equal(jaSeasonName(" 漢焰長明 "), "漢焔不滅");
  assert.equal(jaSeasonName("英雄命世"), null);
  assert.equal(jaSeasonName(""), null);
  assert.equal(jaSeasonName(null), null);
  assert.equal(jaSeasonName("toString"), null);
});

test("ô chọn mùa, chip mùa và nhãn mùa Đội khác: bản ja hiện 漢焔不滅, bản zh giữ 漢焰長明", () => {
  assert.ok(s27, "registry phải có PK-S27");
  const other = registry.seasonOptions.find((item) => item.sourceSeasonId === "pk-s26");
  const rows = [{ sourceSeasonIds: ["pk-s27"] }];
  withLocale("ja", () => {
    assert.equal(seasonNameText(s27), "PK-S27 · 漢焔不滅");
    assert.match(seasonOptionText(s27, "pk-s27"), /^PK-S27 · 漢焔不滅/u);
    assert.doesNotMatch(seasonOptionText(s27, "pk-s27"), /漢焰長明/u);
    assert.match(treeToHtml(referenceSeasonLabelTree(registry, rows)), /漢焔不滅/u);
    // Mùa chưa có tên Nhật đã xác minh: giữ tên nguồn, không tự dịch.
    assert.equal(seasonNameText(other), `PK-S26 · ${other.nameRaw}`);
  });
  withLocale("zh", () => {
    assert.equal(seasonNameText(s27), "PK-S27 · 漢焰長明");
    assert.match(treeToHtml(referenceSeasonLabelTree(registry, rows)), /漢焰長明/u);
  });
});

test("bộ tra tên ja của trang dựng sẵn: tên mùa nguồn ra tên mùa Nhật, chữ Hán khác vẫn đổi tự dạng", () => {
  const resolver = createJaNameResolver([], { entries: {} }, { 焰: "焔", 亂: "乱" });
  assert.equal(localRawName("漢焰長明", resolver, "ja"), "漢焔不滅");
  assert.equal(localRawName("長安之亂", resolver, "ja"), "長安之乱");
  // Bản zh dùng bộ tra chữ Hán gốc (`createRawNameResolver`), không qua bảng tên mùa Nhật.
  assert.equal(localRawName("漢焰長明", createRawNameResolver([]), "zh"), "漢焰長明");
});

test("báo cáo ja-gaps liệt kê tên mùa: mùa có tên Nhật và mùa giữ tên nguồn", async () => {
  const { jaSeasonRows, renderJaGapsReport } = await import("../scripts/report-ja-gaps.mjs");
  const rows = jaSeasonRows(registry);
  assert.equal(rows.length, registry.seasonOptions.filter((item) => item.nameRaw).length);
  assert.deepEqual(rows.find((row) => row.code === "PK-S27"), { code: "PK-S27", nameRaw: "漢焰長明", ja: "漢焔不滅" });
  assert.equal(rows.find((row) => row.code === "PK-S26").ja, null);
  const report = renderJaGapsReport([], { heroes: 0 }, { heroes: { verified: 0, derived: 0, missing: 0 } }, rows);
  assert.match(report, /## Tên mùa/u);
  assert.match(report, /\| PK-S27 \| 漢焰長明 \| 漢焔不滅 \|/u);
  assert.match(report, /\| PK-S26 \| 英雄命世 \| — \(chưa có\) \|/u);
  assert.doesNotMatch(renderJaGapsReport([], { heroes: 0 }, { heroes: { verified: 0, derived: 0, missing: 0 } }), /## Tên mùa/u);
});
