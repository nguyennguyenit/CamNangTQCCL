// Chiến pháp trước cấp 20 (trường tùy chọn `tacticBeforeLevel20*` của tướng): trang chi tiết hiện một dòng riêng
// trước danh sách chiến pháp, bản vi nhãn "Trước cấp 20", bản zh nhãn "20级前"; bản ghi không có trường thì không có dòng.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { treeToHtml } from "../js/view-tree.js";
import { createRawNameResolver } from "../js/website-display.js";
import { setZhNameResolver } from "../js/recommended-reference-state.js";
import { recommendedTeamDetailContent } from "../js/recommended-reference-render.js";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const GENERATION = json("src/data/recommended-reference/current.json").generationId;
const REFERENCE = `src/data/recommended-reference/${GENERATION}`;
const labels = json(`${REFERENCE}/seasons.json`).displayLabels;
const resolveZh = createRawNameResolver(...["heroes-dict", "tactics", "books-dict"].map((name) => json(`data/${name}.json`)));
const filled = (values) => (values ?? []).filter((value) => typeof value === "string" && value.trim());
const base = readdirSync(new URL(`../${REFERENCE}`, import.meta.url))
  .filter((name) => name.startsWith("details-s-"))
  .flatMap((name) => json(`${REFERENCE}/${name}`).records)
  .find((row) => row.heroes.length === 3 && row.heroes.every((hero) => filled(hero.tacticSlotsRaw).length === 2 && filled(hero.tacticSlotsVi).length === 2));
assert.ok(base, "bản ghi mẫu có đủ chiến pháp");

/** Chữ người đọc thấy: bỏ thẻ, gộp khoảng trắng. */
const textOf = (trees) => [].concat(trees).map(treeToHtml).join("").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const withPhase = (record) => {
  const copy = structuredClone(record);
  // Dùng tên chiến pháp của tướng khác trong cùng đội để chắc chắn tra được cả chữ Hán lẫn tên Việt.
  copy.heroes[0].tacticBeforeLevel20Raw = base.heroes[1].tacticSlotsRaw[0];
  copy.heroes[0].tacticBeforeLevel20Vi = base.heroes[1].tacticSlotsVi[0];
  copy.heroes[0].tacticBeforeLevel20Kind = "tactic";
  return copy;
};
const zh = (run) => {
  setZhNameResolver(resolveZh);
  try { return run(); } finally { setZhNameResolver(null); }
};
const detail = (record, locale, lookupLinks = null) => {
  const run = () => recommendedTeamDetailContent(record, { labels, lookupLinks, locale });
  return locale === "zh" ? zh(run) : run();
};

test("bản vi: dòng 'Trước cấp 20' hiện chiến pháp trước cấp 20 của đúng tướng, kèm link Tra cứu", () => {
  const record = withPhase(base);
  const links = { tactic: { [record.heroes[0].tacticBeforeLevel20Raw]: "tactic:an-ui-quan-dan" }, book: {} };
  const trees = detail(record, "vi", links);
  const html = [].concat(trees).map(treeToHtml).join("");
  assert.ok(textOf(trees).includes("Trước cấp 20"));
  assert.equal((html.match(/detail-hero-before-block/g) ?? []).length, 1, "chỉ tướng mang trường có dòng này");
  const block = html.match(/<div class="detail-hero-block detail-hero-before-block">.*?<\/ul>/s)?.[0] ?? "";
  assert.ok(block.includes(record.heroes[0].tacticBeforeLevel20Vi));
  assert.match(block, /<a [^>]*class="detail-hero-books-item is-link"/);
  assert.ok(block.indexOf("Trước cấp 20") < block.indexOf(record.heroes[0].tacticBeforeLevel20Vi));
  assert.ok(html.indexOf("detail-hero-before-block") < html.indexOf("detail-hero-tactics-block"), "dòng nằm trước danh sách chiến pháp");
});

test("bản zh: nhãn '20级前' và chiến pháp chữ Hán, không lộ tên Việt hay nhãn vi", () => {
  const record = withPhase(base);
  const text = textOf(detail(record, "zh"));
  assert.ok(text.includes("20级前"));
  assert.ok(text.includes(record.heroes[0].tacticBeforeLevel20Raw));
  assert.ok(!text.includes("Trước cấp 20"));
});

test("bản ghi không có trường thì không dựng dòng trước cấp 20 (vi và zh)", () => {
  for (const locale of ["vi", "zh"]) {
    const html = [].concat(detail(base, locale)).map(treeToHtml).join("");
    assert.ok(!html.includes("detail-hero-before-block"), locale);
  }
});
