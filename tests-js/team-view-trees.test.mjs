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
  qilueLookupTable,
  recommendedListTrees,
  recommendedTeamCard,
  recommendedTeamDetailContent,
  recommendedTeamTable,
  setCoexistQilueTable,
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
const lookupCatalog = json("data/lookup-catalog.json");
const qilueById = new Map(lookupCatalog.qilueCards.map((row) => [row.id, row]));
// Build đăng ký bảng tra Thẻ Kỳ Lược từ lookup-catalog đã pin trước khi dựng Cùng Tồn (src/lib/team-ssr.ts).
setCoexistQilueTable(qilueLookupTable(lookupCatalog));
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

test("tier JP: huy hiệu cạnh tier SGSDeck trên thẻ/bảng, khối nguồn có link trên trang chi tiết, đủ ba ngôn ngữ", () => {
  const source = { source: "jp", url: "https://kazten.com/entry/2026/06/19/180000", publishedAt: "2026-06-19" };
  const exact = { ...fullRecord, tierSources: [{ ...source, tierRaw: "T0", matchKind: "exact" }] };
  const heroesOnly = { ...fullRecord, tierSources: [{ ...source, tierRaw: "T0.5", matchKind: "heroes-only" }] };
  const notes = { vi: "khác chiến pháp", zh: "战法不同", ja: "戦法違い" };
  for (const locale of ["vi", "zh", "ja"]) {
    const card = treeToHtml(recommendedTeamCard(exact, { href: "/doi-chuan/x/", labels, locale }));
    assert.match(card, /data-tier-source="jp"/, `thẻ ${locale}`);
    assert.ok(textOf(recommendedTeamCard(exact, { href: "/doi-chuan/x/", labels, locale })).includes("JP T0"), `thẻ ${locale}`);
    assert.ok(!card.includes(notes[locale]), `đội khớp đủ không mang nhãn khác chiến pháp (${locale})`);
    // Tier SGSDeck vẫn hiện nguyên bên cạnh.
    assert.ok(textOf(recommendedTeamCard(exact, { labels, locale })).includes(fullRecord.tierRaw));
    assert.ok(textOf(recommendedTeamCard(heroesOnly, { labels, locale })).includes(notes[locale]), `nhãn phụ ${locale}`);
    assert.ok(textOf(recommendedTeamTable([heroesOnly], { labels, locale })).includes("JP T0.5"), `bảng ${locale}`);
    const detail = treeToHtml(h("div", {}, recommendedTeamDetailContent(heroesOnly, { labels, locale })));
    assert.match(detail, /class="detail-section detail-tier-source"/);
    assert.match(detail, /href="https:\/\/kazten\.com\/entry\/2026\/06\/19\/180000"[^>]*rel="noopener noreferrer"/);
    assert.ok(detail.includes("2026-06-19"), `ngày đăng ${locale}`);
  }
  // Hàng không có tier JP giữ nguyên thẻ và trang chi tiết.
  assert.doesNotMatch(treeToHtml(recommendedTeamCard(fullRecord, { labels })), /data-tier-source/);
  assert.doesNotMatch(treeToHtml(h("div", {}, recommendedTeamDetailContent(fullRecord, { labels }))), /detail-tier-source/);
  // URL không phải http(s) không thành link.
  const unsafe = { ...fullRecord, tierSources: [{ ...source, url: "javascript:alert(1)", tierRaw: "T0", matchKind: "exact" }] };
  assert.doesNotMatch(treeToHtml(h("div", {}, recommendedTeamDetailContent(unsafe, { labels }))), /javascript:/);
});

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

  test(`Đội khác (${locale}): tướng không ghi binh thư hiện binh thư tham khảo theo tướng, tướng có binh thư thì không`, () => {
    // Đội thật có đủ binh thư, bỏ binh thư của chủ tướng để có một tướng thiếu và hai tướng còn binh thư của đội.
    const source = teams.find((item) => item.heroes.length === 3 && item.heroes.every((hero) => hero.books?.length
      && [hero.name, ...hero.books.map((b) => b.name)].every((name) => resolveZh(name) || locale === "vi")));
    assert.ok(source, "đội gốc mẫu");
    const team = { ...source, heroes: source.heroes.map((hero, index) => (index === 0 ? { ...hero, books: [] } : hero)) };
    const [empty, filled] = team.heroes;
    const hintNames = ["Tam Quân Chi Chúng", "Dẫn Quân", "Rèn Luyện"];
    const bookHints = {
      [empty.name]: { teams: 7, items: hintNames },
      [filled.name]: { teams: 9, items: ["Giáp Sắt"] },
    };
    const body = run(() => legacyOriginalDetailContent(team, { locale, bookHints }));
    assertPlain(body);
    const html = [].concat(body).map(treeToHtml).join("");
    // Đúng một khối tham khảo (của tướng thiếu binh thư); tướng đã có binh thư giữ binh thư của đội.
    assert.equal((html.match(/detail-hero-book-hint/g) || []).length, 1, `một khối tham khảo ${locale}`);
    const text = textOf(body);
    includesAll(text, locale === "zh" ? hintNames.map((name) => resolveZh(name)) : hintNames, `binh thư tham khảo ${locale}`);
    assert.ok(text.includes(locale === "zh" ? "按武将参考" : "Tham khảo theo tướng"), `nhãn tham khảo ${locale}`);
    assert.ok(text.includes("7"), `số đội có nguồn ${locale}`);

    // Không có gợi ý (hoặc gợi ý rỗng) thì giữ "Chưa có dữ liệu" như cũ.
    const plain = textOf(run(() => legacyOriginalDetailContent(team, { locale, bookHints: { [empty.name]: { teams: 0, items: [] } } })));
    assert.ok(!plain.includes(locale === "zh" ? "按武将参考" : "Tham khảo theo tướng"), `không gợi ý rỗng ${locale}`);
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
    assert.doesNotMatch(treeToHtml(sourceTree), /Trang bị:|Thẻ Kỳ Lược/u, "bảng 10 cột không có Trang bị/Thẻ Kỳ Lược");
  });

  test(`Cùng Tồn bảng 11 cột (${locale}): Trang bị dưới cộng điểm, Thẻ Kỳ Lược theo hiệp có link Tra cứu ở cả hai bản`, () => {
    const links = seasonLinks.filter((item) => item.scenarioId === "han-diem-truong-minh");
    assert.equal(links.length, 5, "kịch bản Hán Diễm Trường Minh có trong dữ liệu");
    const allTeams = links.flatMap((link) => link.target.payload.teams);
    assert.equal(allTeams.length, 25);
    assert.ok(allTeams.every((team) => team.strategyCardIds?.length === team.strategyCardsRaw.split("→").length), "25 đội map đủ thẻ");
    const prefix = locale === "zh" ? "/zh" : "";
    for (const link of links) {
      const group = { recordId: link.recordId, source: link.target.source, content: link.target.payload };
      const tree = run(() => seasonCoexistGroup(group, { teamCard: (item) => coexistTeamCard(item, { locale }), locale }));
      assertPlain(tree);
      const html = treeToHtml(tree);
      const cards = html.split('class="team-card reference-team-card coexist-team-card"').slice(1);
      assert.equal(cards.length, link.target.payload.teams.length);
      link.target.payload.teams.forEach((team, index) => {
        const card = cards[index];
        // Thứ tự hiệp của nguồn: Hiệp 2 → Hiệp 6, mỗi thẻ là link trang riêng Tra cứu, tên client (vi) hoặc chữ Hán (zh).
        const hrefs = [...card.matchAll(/<a class="detail-qilue-card is-link"[^>]*href="([^"]+)"/g)].map((match) => match[1]);
        assert.deepEqual(hrefs, team.strategyCardIds.map((id) => `${prefix}/tra-cuu/ky-luoc/${id.slice("qilue-card:".length)}/`), team.recordId);
        const names = [...card.matchAll(/<span class="detail-qilue-card-name">([^<]+)<\/span>/g)].map((match) => match[1]);
        assert.deepEqual(names, team.strategyCardIds.map((id) => qilueById.get(id)[locale === "zh" ? "nameZh" : "nameVi"]), team.recordId);
        const rounds = [...card.matchAll(/<span class="detail-qilue-round-label">([^<]+)<\/span>/g)].map((match) => match[1]);
        assert.deepEqual(rounds, team.strategyCardIds.map((_, round) => (locale === "zh" ? `第${round + 2}回合` : `Hiệp ${round + 2}`)));
        assert.ok(card.includes(locale === "zh" ? ">奇略卡<" : ">Thẻ Kỳ Lược<"));
        assert.doesNotMatch(card, /coexist-card-strategy|Phương lược|作戰方略/u, "không có chữ thô hay phương lược tự suy");
      });
      if (locale === "zh") {
        assert.doesNotMatch(html, /Trang bị|Thẻ Kỳ Lược|coexist-hero-equipment|Phong Lang Cư Tế|Trấn Giữ Quân Diên/u);
        continue;
      }
      for (const card of cards) assert.equal((card.match(/coexist-hero-equipment/g) || []).length, 3, "mỗi tướng một dòng Trang bị");
      assert.doesNotMatch(html, /Cải tạo:|Phong Lang Cư Tế|Trấn Giữ Quân Diên/u, "tên sheet lệch hiện bằng tên client");
    }
    if (locale === "vi") {
      const link = links[0];
      const team = link.target.payload.teams[0];
      const group = { recordId: link.recordId, source: link.target.source, content: link.target.payload };
      const html = treeToHtml(run(() => seasonCoexistGroup(group, { teamCard: (item) => coexistTeamCard(item, { locale }), locale })));
      // Nguồn "A\n\nB": bỏ dòng trống, giữ ngắt dòng để CSS pre-line hiện hai dòng.
      assert.equal(team.heroes[0].equipmentRaw, "Trị Quân, Ngự Sách\n\nSức Sống, Hộ Chủ");
      assert.ok(html.includes('<p class="line books coexist-hero-extra">+ Thống Soái</p><p class="line books coexist-hero-equipment">Trang bị: Trị Quân, Ngự Sách\nSức Sống, Hộ Chủ</p>'));
      const aliased = allTeams.find((item) => item.strategyCardsRaw.includes("Phong Lang Cư Tế"));
      assert.ok(aliased.strategyCardIds.includes("qilue-card:phong-lang-cu-tu"));
      assert.ok(allTeams.some((item) => item.strategyCardIds.includes("qilue-card:tri-duyen-quan-the")));
    }
  });

  test(`Cùng Tồn (${locale}): tên đội nhiều dòng nhận cấp đội và ghi chú ở bất kỳ dòng nào sau tên`, () => {
    const link = seasonLinks.find((item) => item.scenarioId === "han-diem-truong-minh"
      && item.target.payload.teams.some((team) => team.teamNameRaw.startsWith("Tiềm Long Lữ Bố Cung")));
    assert.ok(link, "đội Tiềm Long Lữ Bố Cung có trong dữ liệu");
    const real = link.target.payload.teams.find((team) => team.teamNameRaw.startsWith("Tiềm Long Lữ Bố Cung"));
    assert.equal(real.teamNameRaw, "Tiềm Long Lữ Bố Cung\n19C\n(Kỹ Năng Quân Sư Điêu Thuyền)");
    const variants = [
      [real.teamNameRaw, "Tiềm Long Lữ Bố Cung", "19C", "Kỹ Năng Quân Sư Điêu Thuyền"],
      ["Tiềm Long Lữ Bố Cung\n(Kỹ Năng Quân Sư Điêu Thuyền)\n19C", "Tiềm Long Lữ Bố Cung", "19C", "Kỹ Năng Quân Sư Điêu Thuyền"],
      ["Ngũ Mưu Bạch Nhị Cung/\n\nHổ Báo Kỵ\n20C", "Ngũ Mưu Bạch Nhị Cung/ Hổ Báo Kỵ", "20C", ""],
      ["Hoàng Mã Thương\n19C", "Hoàng Mã Thương", "19C", ""],
      ["Đội 19C", "Đội 19C", "", ""],
    ];
    for (const [teamNameRaw, name, level, note] of variants) {
      const content = { ...link.target.payload, teams: [{ ...real, teamNameRaw }] };
      const html = treeToHtml(run(() => seasonCoexistGroup({ recordId: link.recordId, source: link.target.source, content },
        { teamCard: (item) => coexistTeamCard(item, { locale }), locale })));
      const title = html.match(/<h3 class="team-name">([^<]*)<\/h3>/)?.[1];
      if (locale === "vi") assert.equal(title, name, teamNameRaw);
      const badge = html.match(/<span class="badge tier reference-tier"[^>]*>([^<]*)<\/span>/)?.[1] ?? "";
      assert.equal(badge, level, teamNameRaw);
      const shown = html.match(/<span class="coexist-team-note">([^<]*)<\/span>/)?.[1] ?? "";
      assert.equal(shown, locale === "zh" ? "" : note, teamNameRaw);
    }
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
    const flagged = [...khaihoang.teams, ...khaihoang.chamSuTeams].filter((item) => item.recommended === true).length;
    assert.equal((html.match(/class="badge badge-band kh-recommended"/g) || []).length, flagged);
    // Đội Tiến cử đứng đầu lúc render (cả đội khai hoang lẫn Chạm Sứ), các đội còn lại theo sau.
    // Mỗi thẻ: đoạn HTML tới thẻ kế tiếp; thẻ khai hoang cuối cắt ở khối tham khảo (Chạm Sứ, mỏ) phía sau.
    const badgeRun = (cardClass) => html.split(`class="${cardClass}"`).slice(1)
      .map((card) => card.split('class="kh-reference"')[0].includes("kh-recommended"));
    for (const [cardClass, list] of [["team-card reference-team-card kh-card", khaihoang.teams], ["cham-su-card", khaihoang.chamSuTeams]]) {
      const n = list.filter((item) => item.recommended === true).length;
      assert.deepEqual(badgeRun(cardClass), list.map((_, i) => i < n), `${cardClass} ${locale}`);
    }
    // Thứ tự 1-2-3 theo `recommendedOrder` (thứ tự ảnh nhà phát hành): thẻ đầu tiên của trang là đội số 1, rồi 2, 3...
    const hrefOrder = [...html.matchAll(/class="team-card reference-team-card kh-card"[\s\S]*?href="\/khai-hoang\/([^"/]+)\/"/g)].map((match) => match[1]);
    const expectedOrder = khaihoang.teams.filter((item) => item.recommended === true)
      .sort((a, b) => a.recommendedOrder - b.recommendedOrder).map((item) => item.id);
    assert.ok(expectedOrder.length >= 3, "cần ít nhất ba đội Tiến cử để khoá thứ tự 1-2-3");
    assert.deepEqual(hrefOrder.slice(0, expectedOrder.length), expectedOrder, `thứ tự recommendedOrder ${locale}`);
    // Tip Chạm Sứ là văn xuôi tiếng Việt: chỉ bản vi có.
    assert.equal(html.includes('class="cham-su-tip"'), locale === "vi" && Boolean(khaihoang.chamSuTip), `chamSuTip ${locale}`);

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
