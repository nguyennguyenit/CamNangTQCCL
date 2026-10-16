// Builder nội dung đội (thẻ/hàng, Cùng Tồn, Khai hoang, thân trang chi tiết) trả cây view chạy trong Node,
// không `document`: cùng cây dùng cho HTML dựng lúc build (`treeToHtml`) và DOM của trình duyệt (`treeToDom`).
// Mỗi ca lấy bản ghi thật của repo và hỏi nội dung người đọc cần có (tướng, chiến pháp, binh thư, ghi chú).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { h, treeToHtml } from "../js/view-tree.js";
import { currentLocale } from "../js/i18n.js";
import { createRawNameResolver } from "../js/website-display.js";
import { setZhNameResolver } from "../js/recommended-reference-state.js";
import {
  coexistTeamCard,
  legacyOriginalDetailContent,
  recommendedListTrees,
  recommendedTeamCard,
  recommendedTeamDetailContent,
  recommendedTeamTable,
} from "../js/recommended-reference-render.js";
import {
  khaihoangDetailTrees,
  khaihoangTableTree,
  seasonCoexistGroup,
} from "../js/render.js";
import { TEAM_VIEW_CARDS, TEAM_VIEW_TABLE } from "../js/team-view.js";

assert.equal(typeof document, "undefined", "test chạy ngoài trình duyệt");

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const GENERATION = json("src/data/recommended-reference/current.json").generationId;
const REFERENCE = `src/data/recommended-reference/${GENERATION}`;
const teams = json("data/teams.json");
const khaihoang = json("data/khaihoang.json");
const coexist = json("data/coexist.json");
const seasonLinks = json("data/season-content-links.json");
const labels = json(`${REFERENCE}/seasons.json`).displayLabels;
const resolveZh = createRawNameResolver(...["heroes-dict", "tactics", "books-dict"].map((name) => json(`data/${name}.json`)));

const detailRecords = readdirSync(new URL(`../${REFERENCE}`, import.meta.url))
  .filter((name) => name.startsWith("details-s-"))
  .flatMap((name) => json(`${REFERENCE}/${name}`).records);
const filled = (values) => (values ?? []).filter((value) => typeof value === "string" && value.trim());
const fullRecord = detailRecords.find((row) => row.heroes.length === 3
  && row.heroes.every((hero) => filled(hero.tacticSlotsVi).length && filled(hero.bookSlotsVi).length)
  && row.displayNotes?.blocks?.some((block) => block.owner === "team"));
const alternativeRecord = detailRecords.find((row) => row.alternativeHoldersRaw?.length
  && row.heroes.every((hero) => filled(hero.tacticSlotsVi).length));
const otherRecords = json(`${REFERENCE}/other-teams.json`).records;

const zhOnly = (run) => {
  setZhNameResolver(resolveZh);
  try { return run(); } finally { setZhNameResolver(null); }
};
/** Chữ người đọc thấy: bỏ thẻ, gộp khoảng trắng. */
const textOf = (trees) => [].concat(trees).map(treeToHtml).join("").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
/** Mọi giá trị thuộc tính phải là chữ/số/cờ: không có hàm xử lý sự kiện lọt vào cây. */
function assertPlainTree(node, path = "root") {
  if (typeof node === "string") return;
  for (const [name, value] of Object.entries(node.attrs)) {
    assert.ok(["string", "number", "boolean"].includes(typeof value), `${path}@${name} là ${typeof value}`);
  }
  node.children.forEach((child, index) => assertPlainTree(child, `${path}>${node.tag}[${index}]`));
}
const assertPlain = (trees) => [].concat(trees).forEach((tree) => assertPlainTree(tree));
const includesAll = (text, values, label) => {
  assert.ok(values.length, `${label}: dữ liệu mẫu có giá trị`);
  for (const value of values) assert.ok(text.includes(value), `${label}: thiếu "${value}"`);
};

const heroValues = (record, locale) => record.heroes.flatMap((hero) => locale === "zh"
  ? [hero.nameRaw, ...filled(hero.tacticSlotsRaw), ...filled(hero.bookSlotsRaw)]
  : [hero.displayNameVi, ...filled(hero.tacticSlotsVi), ...filled(hero.bookSlotsVi)]);
/** Tên chiến pháp bỏ tiền tố cải tạo ("Tinh · X") vì thẻ ghép tiền tố vào chữ hiển thị. */
const bare = (value) => value.replace(/^(Tinh|Chuyển|Thác|精|轉|拓)\s*[·・]\s*/u, "");

test("ngoài trình duyệt locale mặc định là vi và locale tường minh không rò sang lần gọi sau", () => {
  const zhHtml = textOf(recommendedTeamCard(fullRecord, { href: "/doi-chuan/x/", labels, locale: "zh" }));
  assert.match(zhHtml, /详情/);
  assert.equal(currentLocale(), "vi");
  assert.match(textOf(recommendedTeamCard(fullRecord, { href: "/doi-chuan/x/", labels })), /Chi tiết/);
});

for (const locale of ["vi", "zh"]) {
  const run = (build) => (locale === "zh" ? zhOnly(build) : build());

  test(`Đội chuẩn (${locale}): thẻ, hàng bảng và danh sách có tướng, chiến pháp, binh thư của chính bản ghi`, () => {
    const card = run(() => recommendedTeamCard(fullRecord, { href: "/doi-chuan/x/", labels, locale }));
    assertPlain(card);
    const cardText = textOf(card);
    includesAll(cardText, heroValues(fullRecord, locale).map(bare), `thẻ ${locale}`);
    const html = treeToHtml(card);
    assert.match(html, /href="\/doi-chuan\/x\/"/);
    assert.match(html, new RegExp(`data-source-config-id="${fullRecord.sourceConfigId}"`));

    const table = run(() => recommendedTeamTable([fullRecord], { hrefFor: () => "/doi-chuan/x/", labels, locale }));
    assertPlain(table);
    includesAll(textOf(table), fullRecord.heroes.map((hero) => (locale === "zh" ? hero.nameRaw : hero.displayNameVi)), `bảng ${locale}`);

    for (const mode of [TEAM_VIEW_CARDS, TEAM_VIEW_TABLE]) {
      const trees = run(() => recommendedListTrees([fullRecord], { family: "recommended", mode, labels, hrefFor: () => "/doi-chuan/x/", mountId: "m", locale }));
      assertPlain(trees);
      assert.ok(trees.length >= 1);
      assert.ok(textOf(trees).includes(locale === "zh" ? fullRecord.heroes[0].nameRaw : fullRecord.heroes[0].displayNameVi), `${mode} ${locale}`);
    }
  });

  test(`Đội chuẩn (${locale}): thân trang chi tiết có đội hình, ghi chú, cấu hình thay thế`, () => {
    const body = run(() => recommendedTeamDetailContent(fullRecord, { labels, locale }));
    assert.ok(Array.isArray(body));
    assertPlain(body);
    const text = textOf(body);
    includesAll(text, heroValues(fullRecord, locale).map(bare), `chi tiết ${locale}`);
    const teamNote = fullRecord.displayNotes.blocks.find((block) => block.owner === "team");
    assert.ok(text.includes(locale === "zh" ? teamNote.textRaw : teamNote.textVi), `ghi chú ${locale}`);

    const withAlternatives = run(() => recommendedTeamDetailContent(alternativeRecord, { labels, locale }));
    const alt = alternativeRecord.alternativeHoldersRaw[0];
    assert.ok(textOf(withAlternatives).includes(locale === "zh" ? alt.nameRaw : alt.displayNameVi), `thay thế ${locale}`);
  });

  test(`Đội khác (${locale}): thẻ danh sách và nội dung đội gốc có tướng, chiến pháp, binh thư của đội`, () => {
    const row = otherRecords.find((record) => record.legacyContent?.heroes?.length === 3 && record.holders?.length);
    const card = run(() => recommendedTeamCard(row, { href: "/doi-khac/x/", labels, locale }));
    assertPlain(card);
    assert.ok(textOf(card).length > 40);

    const team = teams.find((item) => item.heroes.length === 3 && item.heroes.every((hero) => hero.tactics.length && hero.books.length
      && [hero.name, ...hero.tactics.map((t) => t.name), ...hero.books.map((b) => b.name)].every((name) => resolveZh(name) || locale === "vi")));
    assert.ok(team, "đội gốc mẫu");
    const body = run(() => legacyOriginalDetailContent(team, { locale }));
    assert.ok(Array.isArray(body));
    assertPlain(body);
    const text = textOf(body);
    const names = team.heroes.flatMap((hero) => [hero.name, ...hero.tactics.map((t) => t.name), ...hero.books.map((b) => b.name)]);
    includesAll(text, locale === "zh" ? names.map((name) => resolveZh(name)) : names.map(bare), `đội gốc ${locale}`);
  });

  test(`Cùng Tồn (${locale}): nhóm có đội, tướng, chiến pháp, binh thư; nhánh bảng nguồn cũng dựng được`, () => {
    const group = { content: coexist[0], source: null };
    const tree = run(() => seasonCoexistGroup(group, { teamCard: (team) => coexistTeamCard(team, { locale }), locale }));
    assertPlain(tree);
    const text = textOf(tree);
    const hero = coexist[0].teams[0].heroes[0];
    const want = (name) => (locale === "zh" ? resolveZh(name) : name);
    includesAll(text, [want(hero.name), ...hero.tactics.map(want), ...hero.books.map(want)].filter(Boolean), `cùng tồn ${locale}`);
    if (locale === "vi") assert.ok(text.includes(coexist[0].teams[0].teamName.replace(/\s*\d+C$/u, "")));

    const link = Object.values(seasonLinks.links ?? seasonLinks).find((item) => item?.target?.type === "source-owned-coexist");
    const sourceGroup = { recordId: link.recordId, source: link.target.source, content: link.target.payload };
    const sourceTree = run(() => seasonCoexistGroup(sourceGroup, { teamCard: (team) => coexistTeamCard(team, { locale }), locale }));
    assertPlain(sourceTree);
    assert.match(treeToHtml(sourceTree), new RegExp(`data-record-id="${link.recordId}"`));
    assert.ok(textOf(sourceTree).length > 100);
  });

  test(`Khai hoang (${locale}): trang danh sách và trang chi tiết có tướng, chiến pháp, ghi chú, điểm`, () => {
    const want = (name) => (locale === "zh" ? resolveZh(name) : name);
    const team = khaihoang.teams.find((item) => item.variants?.length && item.guide?.ratings && item.heroes.every((hero) => resolveZh(hero.name)))
      || khaihoang.teams[0];
    const hero = team.heroes[0];
    const list = run(() => khaihoangTableTree(khaihoang, { hrefFor: (id) => `/khai-hoang/${id}/`, locale }));
    assertPlain(list);
    const listText = textOf(list);
    includesAll(listText, [want(hero.name), want(hero.tacticBefore)].filter(Boolean), `danh sách khai hoang ${locale}`);
    const html = treeToHtml(list);
    assert.match(html, new RegExp(`href="/khai-hoang/${team.id}/"`));
    // Mọi đội của dữ liệu đều có thẻ.
    assert.equal((html.match(/class="team-card reference-team-card kh-card"/g) || []).length, khaihoang.teams.length);

    const detail = run(() => khaihoangDetailTrees(team, { variantId: "", locale }));
    assert.ok(Array.isArray(detail));
    assertPlain(detail);
    const detailText = textOf(detail);
    includesAll(detailText, [want(hero.name), want(hero.tacticBefore), ...hero.tacticsAfter.map(want)].filter(Boolean), `chi tiết khai hoang ${locale}`);
    assert.ok(treeToHtml(h("div", {}, detail)).includes("kh-config-chip"));
    if (locale === "vi") assert.ok(detailText.includes(String(team.guide.ratings.overall).replace(".", ",")));
    // Phiên bản đang chọn quyết định chip bật và nội dung build.
    const variant = team.variants[0];
    const picked = treeToHtml(h("div", {}, run(() => khaihoangDetailTrees(team, { variantId: variant.id, locale }))));
    assert.match(picked, new RegExp(`aria-pressed="true"[^>]*data-variant="${variant.id}"`));
  });
}
