// Hồ sơ Tra cứu của tướng, chiến pháp và binh thư là cây view chạy trong Node (không `document`): cùng cây dùng cho
// trang riêng dựng lúc build (`treeToHtml`) và hộp thoại của trình duyệt (`treeToDom`). Dữ liệu thật của corpus Tra cứu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withLocale } from "../js/i18n.js";
import { treeToHtml, treeToText } from "../js/view-tree.js";
import { effectVersions, lookupDisplayName } from "../js/lookup-detail.js";
import { createProfileRenderer } from "../js/lookup-profile.js";
import { setLookupRouteHandles } from "../js/lookup-ids.js";
import { lookupResultTrees } from "../js/unified-lookup.js";
import { masterDetailTree, troopEffectVersions } from "../js/lookup-master.js";
import { lookupBuildCorpus } from "../src/lib/lookup-pages.ts";
import { lookupDetailRoutes } from "../src/lib/lookup-detail-routes.ts";
import { tacticEffectVersions } from "../js/lookup-tactic-view.js";

assert.equal(typeof document, "undefined", "test chạy ngoài trình duyệt");

const corpus = await lookupBuildCorpus();
const routes = await lookupDetailRoutes();
setLookupRouteHandles(Object.fromEntries(routes.entries.map((entry) => [entry.id, entry.slug])));
const visibleText = (html) => html.replace(/<[^>]+>/gu, "").replace(/&amp;/gu, "&").replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/\s+/gu, " ");

function pageHtml(group, id, locale, options = {}) {
  return withLocale(locale, () => {
    const { profilePageTree } = createProfileRenderer({ group, openInPage() {}, onClose() {} });
    const tree = profilePageTree(corpus, id, options);
    assert.ok(tree, id);
    return treeToHtml(tree);
  });
}

const hero = corpus.groups.heroes.find((row) => corpus.byId.get(row.record.lookup?.selfTacticId));
// Chữ client là bản hiện hành không ngày; các bản cũ nằm ở `lookup.revisions` nên chọn theo phiên bản đã gắn nhãn của cả hai ngôn ngữ.
const tacticVersions = (record, locale) => tacticEffectVersions(record, locale).filter((version) => version.paragraphs.length);
const tactic = corpus.groups.tactics.find((row) => tacticVersions(row.record, "vi").length > 1 && tacticVersions(row.record, "zh").length > 1);
const book = corpus.groups.books.find((row) => row.record.effect && row.record.effectViet);

for (const locale of ["vi", "zh"]) {
  test(`tướng (${locale}): trang riêng có tên, chỉ số, chiến pháp bản thân dạng link trang riêng; một h1, không nút đóng`, () => {
    const html = pageHtml("heroes", hero.id, locale);
    const self = corpus.byId.get(hero.record.lookup.selfTacticId);
    assert.equal((html.match(/<h1\b/gu) ?? []).length, 1);
    assert.doesNotMatch(html, /lookup-close|role="dialog"|<button[^>]*data-lookup-open/u);
    assert.ok(visibleText(html).includes(lookupDisplayName(hero.record, hero.nameVi, locale)));
    assert.ok(visibleText(html).includes(lookupDisplayName(self.record, self.nameVi, locale)));
    assert.ok(html.includes(`href="${locale === "zh" ? "/zh" : ""}${routes.byId.get(self.id).path}" data-lookup-relation="${self.id}"`));
    assert.ok(html.includes('class="lookup-stats"'));
    assert.ok(html.includes(`data-lookup-item="${hero.id}"`));
  });

  test(`chiến pháp (${locale}): trang riêng mang đủ phiên bản hiệu ứng, bản cũ ẩn; hiệu ứng hiện hành đọc được`, () => {
    const html = pageHtml("tactics", tactic.id, locale);
    const versions = tacticVersions(tactic.record, locale);
    assert.ok(versions.length > 1);
    assert.equal((html.match(/data-effect-panel="/gu) ?? []).length, versions.length);
    assert.equal((html.match(/data-effect-panel="[1-9]\d*"[^>]*\bhidden\b/gu) ?? []).length, versions.length - 1);
    assert.doesNotMatch(html, /data-effect-panel="0"[^>]*\bhidden\b/u);
    assert.equal((html.match(/data-effect-version="/gu) ?? []).length, versions.length);
  });

  test(`binh thư (${locale}): trang riêng có hiệu ứng của chính binh thư`, () => {
    const html = pageHtml("books", book.id, locale);
    assert.ok(visibleText(html).includes(locale === "zh" ? book.record.effect : book.record.effectViet));
  });
}

test("trang riêng nhận bảng Trong cẩm nang đã kiểm: có khối số liệu, tướng chưa vào đội nào thì có dòng báo", () => {
  const withTeams = { [hero.id]: { searchName: hero.nameVi, standard: { teams: 2, positions: [1, 1, 0] }, other: { teams: 1, positions: [0, 1, 0] }, tactics: [{ name: "Chiến Pháp A", teams: 2 }], books: { teams: 1, items: [{ name: "Sách A", teams: 1 }] }, statFocus: { teams: 1, items: [{ name: "Võ Lực", teams: 1 }] }, representative: [] } };
  const html = pageHtml("heroes", hero.id, "vi", { summaryTable: withTeams });
  assert.ok(html.includes("cam-nang-grid"));
  assert.ok(visibleText(html).includes("Chiến Pháp A"));
  const empty = pageHtml("heroes", hero.id, "vi", { summaryTable: {} });
  assert.ok(visibleText(empty).includes("Chưa có trong đội nào."));
  assert.doesNotMatch(empty, /cam-nang-grid/u);
});

test("danh sách dựng sẵn đủ mục: từ visibleCount trở đi mang data-lookup-later, mọi nhóm", () => {
  for (const group of Object.keys(corpus.groups)) {
    const items = corpus.groups[group];
    const visibleCount = Math.min(3, items.length);
    const html = lookupResultTrees(group, items, "vi", { byId: corpus.byId, visibleCount }).map(treeToHtml).join("");
    assert.equal(html.split('data-lookup-id="').length - 1, items.length, group);
    assert.equal(html.split("data-lookup-later").length - 1, items.length - visibleCount, group);
  }
  const all = lookupResultTrees("heroes", corpus.groups.heroes, "vi").map(treeToHtml).join("");
  assert.doesNotMatch(all, /data-lookup-later/u);
});

test("chi tiết catalog trên trang riêng: tiêu đề là h1 và không có link quay lại danh sách", () => {
  const item = corpus.groups.buildings[0];
  const page = treeToHtml(masterDetailTree("buildings", item, corpus, "vi", { page: true }));
  const panel = treeToHtml(masterDetailTree("buildings", item, corpus, "vi"));
  assert.match(page, /<h1 class="lookup-detail-title" id="lookup-detail-title">/u);
  assert.doesNotMatch(page, /data-lookup-back/u);
  assert.match(panel, /<h2 class="lookup-detail-title"/u);
  assert.match(panel, /data-lookup-back/u);
});

/**
 * Bản chữ thuần (llms) và trang không JavaScript giữ cả bản hiệu ứng cũ: mỗi panel phải tự mang nhãn phiên bản ngay trước
 * đoạn của nó, nếu không các đoạn của nhiều phiên bản nối liền nhau và không biết đoạn nào là bản hiện hành.
 */
function assertPanelsLabelled(tree, versions, where) {
  const html = treeToHtml(tree);
  const panels = [...html.matchAll(/<div[^>]*data-effect-panel="(\d+)"[^>]*>([\s\S]*?)<\/div>/gu)];
  assert.equal(panels.length, versions.length, where);
  const lines = treeToText(tree).split("\n");
  versions.forEach((version, index) => {
    assert.ok(visibleText(panels[index][2]).includes(version.label), `${where}: panel ${index} thiếu nhãn "${version.label}"`);
    const head = version.paragraphs[0].slice(0, 20);
    const at = lines.findIndex((line, row) => line.includes(head) && row > 0 && lines[row - 1] === version.label);
    assert.ok(at > 0, `${where}: chữ thuần phải có nhãn "${version.label}" ngay trước đoạn của nó`);
  });
}

test("chiến pháp nhiều phiên bản (vi): mỗi panel trang riêng mang nhãn phiên bản, chữ thuần gắn nhãn với đúng đoạn", () => {
  const versionsOf = (row) => tacticEffectVersions(row.record, "vi").filter((version) => version.paragraphs.length);
  const item = corpus.groups.tactics.find((row) => versionsOf(row).length > 1 && versionsOf(row).every((version) => version.label));
  assert.ok(item, "corpus phải có chiến pháp nhiều phiên bản");
  const tree = withLocale("vi", () => createProfileRenderer({ group: "tactics", openInPage() {}, onClose() {} }).profilePageTree(corpus, item.id, {}));
  assertPanelsLabelled(tree, versionsOf(item), item.id);
});

test("cải tạo binh chủng chỉ giữ một bản client: trang riêng hiện hướng dẫn mùa, không có bản cũ ẩn", () => {
  for (const item of corpus.groups["troop-mods"]) {
    assert.equal(troopEffectVersions(item.record).length, 1, item.id);
    const html = treeToHtml(masterDetailTree("troop-mods", item, corpus, "vi", { page: true }));
    assert.doesNotMatch(html, /data-effect-panel="[1-9]/u, item.id);
    assert.ok(visibleText(html).includes(item.record.effectVi.slice(0, 30)), item.id);
  }
});
