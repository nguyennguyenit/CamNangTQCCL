import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { jsonLd } from "../src/lib/blog-posts.ts";
import { SITE_NAME } from "../src/lib/blog-seo.ts";
import { teamAuthorName, teamPageCopy } from "../src/lib/community-team-pages.ts";
import { validateTeamsExport } from "../src/lib/community-teams.ts";
import { communityTeamJsonLd } from "../src/lib/structured-data.ts";
import { communityTeamSitemapRoutes } from "../src/pages/sitemap.xml.ts";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/community-teams-export.json", import.meta.url), "utf8"));
const TEAMS = validateTeamsExport(FIXTURE);
const byId = (id) => TEAMS.find((team) => team.id === id);
const NAMES_VI = {
  heroes: ["Tào Tháo", "Quan Vũ", "Trương Phi"],
  tactics: [["Binh Phong", "An Ủi Quân Dân"], ["Anh Thành Tự Thủ", "Binh Vô Thường Thế"], ["Bách Bộ Xuyên Dương", "Bách Kế Đa Mưu"]],
};
const NAMES_ZH = {
  heroes: ["曹操", "關羽", "張飛"],
  tactics: [["兵鋒", "撫輯軍民"], ["嬰城自守", "兵無常勢"], ["百步穿楊", "百計多謀"]],
};
const codePoints = (text) => Array.from(text).length;

test("P1: title vi/zh đúng mẫu", () => {
  const team = byId("doi-05");
  const vi = teamPageCopy(team, NAMES_VI, "vi");
  assert.equal(vi.title, `${team.title} (Tào Tháo, Quan Vũ, Trương Phi) — Đội cộng đồng — ${SITE_NAME.vi}`);
  const zhTeam = byId("doi-09");
  const zh = teamPageCopy(zhTeam, NAMES_ZH, "zh");
  assert.equal(zh.title, `${zhTeam.title}（曹操、關羽、張飛）— 社区阵容 — ${SITE_NAME.zh}`);
});

test("P1: description gộp khoảng trắng, ≤ 155 code point, cắt không vỡ ký tự nhiều byte", () => {
  const team = byId("doi-05");
  const short = teamPageCopy(team, NAMES_VI, "vi").description;
  assert.ok(short.startsWith("Kỵ · Tào Tháo, Quan Vũ, Trương Phi — Mở đầu bằng khống chế. Rồi dồn sát thương."), short);
  assert.ok(!/\s{2,}|\n/u.test(short));
  assert.ok(codePoints(short) <= 155);

  const long = { ...team, analysis: { ...team.analysis, playstyle: "😀".repeat(400) } };
  const cut = teamPageCopy(long, NAMES_VI, "vi").description;
  assert.ok(codePoints(cut) <= 155, String(codePoints(cut)));
  assert.ok(cut.endsWith("…"));
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(cut), "lone surrogate");
  assert.equal(teamPageCopy(long, NAMES_ZH, "zh").description.startsWith("骑 · 曹操, 關羽, 張飛 — "), true);
});

test("P1: FAQ chỉ trường khác rỗng, đúng thứ tự, câu hỏi theo locale", () => {
  const full = teamPageCopy(byId("doi-05"), NAMES_VI, "vi").faq;
  assert.deepEqual(full.map((entry) => entry.key), ["lineup", "playstyle", "strengths", "weaknesses", "counters", "counteredBy", "substitutes"]);
  assert.equal(full[1].q, `Đội ${byId("doi-05").title} chơi thế nào?`);
  assert.equal(full[5].q, `Đội nào khắc chế ${byId("doi-05").title}?`);
  assert.equal(full[1].a, byId("doi-05").analysis.playstyle);
  assert.match(full[0].a, /Tào Tháo \(Binh Phong, An Ủi Quân Dân\)/u);
  assert.match(full[0].a, /Kỵ/u);

  const sparse = teamPageCopy(byId("doi-07"), NAMES_VI, "vi").faq;
  assert.deepEqual(sparse.map((entry) => entry.key), ["lineup", "playstyle"]);

  const blank = { ...byId("doi-05"), analysis: { ...byId("doi-05").analysis, strengths: "   ", counters: "Khắc chế X" } };
  assert.deepEqual(teamPageCopy(blank, NAMES_VI, "vi").faq.map((entry) => entry.key), ["lineup", "playstyle", "weaknesses", "counters", "counteredBy", "substitutes"]);

  const zhTeam = byId("doi-09");
  const zh = teamPageCopy(zhTeam, NAMES_ZH, "zh").faq;
  assert.equal(zh[1].q, `${zhTeam.title}怎么玩？`);
  assert.equal(zh[5].q, `哪些阵容克制${zhTeam.title}？`);
});

const jsonLdInput = (team, names, locale) => {
  const copy = teamPageCopy(team, names, locale);
  return {
    locale,
    site: "https://tqccl.com",
    path: locale === "zh" ? `/zh/doi-cong-dong/${team.id}/` : `/doi-cong-dong/${team.id}/`,
    name: team.title,
    description: copy.description,
    createdAt: team.createdAt,
    approvedAt: team.approvedAt,
    authorName: teamAuthorName(team, locale),
    heroes: [{ name: "Tào Tháo", path: "/tra-cuu/tuong/tao-thao/" }],
    faq: copy.faq,
  };
};

const hasKey = (value, key) => Array.isArray(value)
  ? value.some((item) => hasKey(item, key))
  : value !== null && typeof value === "object" && (key in value || Object.values(value).some((item) => hasKey(item, key)));

test("P2: communityTeamJsonLd có url/inLanguage/author/datePublished, không aggregateRating/interactionStatistic", () => {
  const team = byId("doi-05");
  const blocks = communityTeamJsonLd(jsonLdInput(team, NAMES_VI, "vi"));
  assert.deepEqual(blocks.map((block) => block["@type"]), ["WebPage", "BreadcrumbList", "FAQPage"]);
  const [page, crumbs, faq] = blocks;
  assert.equal(page.url, `https://tqccl.com/doi-cong-dong/${team.id}/`);
  assert.equal(page.inLanguage, "vi");
  assert.equal(page.author.name, "<b>Gia Cát</b>");
  assert.equal(page.datePublished, team.approvedAt);
  assert.equal(page.dateCreated, team.createdAt);
  assert.equal(page.about[0].url, "https://tqccl.com/tra-cuu/tuong/tao-thao/");
  assert.equal(crumbs.itemListElement.at(-1).name, team.title);
  assert.equal(faq.mainEntity.length, 7);
  assert.equal(faq.mainEntity[0]["@type"], "Question");
  for (const key of ["aggregateRating", "interactionStatistic", "image"]) assert.ok(!hasKey(blocks, key), key);

  const zhTeam = byId("doi-09");
  const zh = communityTeamJsonLd(jsonLdInput(zhTeam, NAMES_ZH, "zh"));
  assert.equal(zh[0].inLanguage, "zh-Hans");
  assert.equal(zh[0].url, `https://tqccl.com/zh/doi-cong-dong/${zhTeam.id}/`);
});

test("P2: jsonLd() của tiêu đề độc không còn </script", () => {
  const team = byId("doi-04");
  assert.match(team.title, /<\/script><img src=x/u);
  const text = jsonLd(communityTeamJsonLd(jsonLdInput(team, NAMES_VI, "vi")));
  assert.ok(!text.includes("</script"));
  assert.ok(!text.includes("<img"));
  assert.ok(text.includes("\\u003c/script"));
  assert.equal(JSON.parse(text)[0].name, team.title);
});

test("P3: sitemap trang đội — một URL/đội, ngưỡng 10 mới thêm cặp danh sách", () => {
  const route = (team) => ({ path: `/doi-cong-dong/${team.id}/`, lastmod: team.approvedAt });
  const nine = communityTeamSitemapRoutes(TEAMS.slice(0, 9).map(route));
  assert.equal(nine.length, 9);
  assert.ok(nine.every((entry) => entry.path !== "/doi-cong-dong/" && entry.path !== "/zh/doi-cong-dong/"));
  assert.ok(nine.every((entry) => entry.alternates === undefined && entry.lastmod));

  const ten = communityTeamSitemapRoutes(TEAMS.map(route));
  assert.equal(ten.length, 12);
  const listing = ten.filter((entry) => entry.path === "/doi-cong-dong/" || entry.path === "/zh/doi-cong-dong/");
  assert.equal(listing.length, 2);
  assert.ok(listing.every((entry) => entry.alternates?.length === 3));
  assert.ok(ten.filter((entry) => !listing.includes(entry)).every((entry) => entry.alternates === undefined));
});

test("P2: metaText bỏ < > khỏi chữ người dùng đi vào thuộc tính meta", async () => {
  const { metaText } = await import("../src/lib/community-team-pages.ts");
  const text = metaText(byId("doi-04").title);
  assert.ok(!/[<>]/u.test(text));
  assert.ok(!text.includes("<img"));
  assert.equal(metaText("<b>Gia Cát</b>"), "‹b›Gia Cát‹/b›");
  assert.equal(metaText("Đội thường"), "Đội thường");
});

test("P2: tác giả rỗng/khoảng trắng/null → Người chơi / 玩家 ở trang và JSON-LD", () => {
  for (const [id, locale, names, expected] of [["3f2c-team", "vi", NAMES_VI, "Người chơi"], ["doi-02", "vi", NAMES_VI, "Người chơi"], ["doi-01", "vi", NAMES_VI, "Người chơi"], ["doi-01", "zh", NAMES_ZH, "玩家"]]) {
    const team = byId(id);
    assert.equal(team.author.name, null, id);
    assert.equal(teamAuthorName(team, locale), expected);
    assert.equal(communityTeamJsonLd(jsonLdInput(team, names, locale))[0].author.name, expected);
  }
  assert.equal(teamAuthorName(byId("doi-05"), "vi"), "<b>Gia Cát</b>");
});
