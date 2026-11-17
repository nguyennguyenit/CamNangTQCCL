// Trang mùa Đội chuẩn (#6): danh mục trang mùa, redirect mùa hiện tại, nhãn "mùa cũ", SSR đủ đội của mùa mặc định.
// Kỳ vọng lấy từ dữ liệu thật của publication đã pin (không phải số viết tay); đổi mùa mặc định thử trên bản sao registry.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { treeToHtml } from "../js/view-tree.js";
import { seasonOptionText } from "../js/team-filter-section.js";
import { websiteDisplayPublicationSnapshot } from "../src/lib/root-static-artifacts.ts";
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";
import { prepare } from "../src/lib/team-ssr.ts";
import { recommendedSectionTrees } from "../src/lib/team-section-ssr.js";
import { isOldSeason, seasonPageCatalog, seasonRedirectRules } from "../src/lib/season-pages.ts";

const parse = (bytes) => JSON.parse(Buffer.from(bytes).toString("utf8"));
const data = async () => {
  const website = await websiteDisplayPublicationSnapshot();
  return {
    registry: parse(website.recommended.files["seasons.json"]),
    rows: parse(website.recommended.files["index.json"]).records,
    catalog: await teamDetailCatalog(),
  };
};
const withDefault = (registry, defaultSourceSeasonId) => ({ ...registry, defaultSourceSeasonId });

test("1. slug trang mùa là displayCode viết thường và là tiền tố routeSegment của mọi slug đội trong mùa đó", async () => {
  const { registry, catalog } = await data();
  const { pages } = seasonPageCatalog(registry, catalog);
  assert.ok(pages.length > 10, `phải có trang cho các mùa cũ (${pages.length})`);
  for (const page of pages) {
    const option = registry.seasonOptions.find((item) => item.sourceSeasonId === page.sourceSeasonId);
    assert.equal(page.slug, option.displayCode.toLowerCase());
    assert.match(page.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "không lộ chữ Hán");
    const teams = catalog.recommended.filter((entry) => entry.sourceSeasonId === page.sourceSeasonId);
    assert.ok(teams.length > 0);
    for (const entry of teams) assert.ok(entry.routeSegment.startsWith(`${page.slug}-`), `${entry.routeSegment} không bắt đầu bằng ${page.slug}-`);
    assert.equal(page.routePath, `/doi-chuan/${page.slug}/`);
    assert.equal(page.htmlPath, `doi-chuan/${page.slug}/index.html`);
  }
  assert.ok(pages.some((page) => page.slug === "pk-s24") && pages.some((page) => page.slug === "s1"));
});

test("2. không có trang cho mùa hiện tại và mùa 0 đội", async () => {
  const { registry, catalog } = await data();
  const result = seasonPageCatalog(registry, catalog);
  const current = registry.seasonOptions.find((item) => item.sourceSeasonId === registry.defaultSourceSeasonId);
  assert.equal(result.defaultSourceSeasonId, registry.defaultSourceSeasonId);
  assert.ok(!result.pages.some((page) => page.sourceSeasonId === registry.defaultSourceSeasonId));
  assert.equal(result.current?.slug, current.displayCode.toLowerCase());
  const empty = registry.seasonOptions.filter((item) => !catalog.recommended.some((entry) => entry.sourceSeasonId === item.sourceSeasonId));
  assert.ok(empty.length >= 1, "dữ liệu thật có mùa chưa thu thập");
  for (const item of empty) assert.ok(!result.pages.some((page) => page.sourceSeasonId === item.sourceSeasonId), `${item.displayCode} 0 đội mà vẫn có trang`);
});

test("3. số đội mỗi trang bằng số dòng index.json của mùa (không dùng advertisedCountRaw)", async () => {
  const { registry, rows, catalog } = await data();
  const { pages } = seasonPageCatalog(registry, catalog);
  for (const page of pages) {
    const expected = rows.filter((row) => row.sourceSeasonId === page.sourceSeasonId).length;
    assert.equal(page.count, expected, page.slug);
  }
  // Thế hệ 2026-11 không còn mùa nào quảng cáo sai số đội, nên cho một mùa quảng cáo lệch (bản sao registry): trang vẫn theo dòng thật.
  const target = pages.find((page) => page.sourceSeasonId === "pk-s19");
  const skewed = { ...registry, seasonOptions: registry.seasonOptions.map((item) => (item.sourceSeasonId === "pk-s19" ? { ...item, advertisedCountRaw: target.count + 4 } : item)) };
  const skewedPage = seasonPageCatalog(skewed, catalog).pages.find((page) => page.sourceSeasonId === "pk-s19");
  assert.equal(skewedPage.count, target.count);
});

test("4. không slug mùa nào trùng slug đội", async () => {
  const { registry, catalog } = await data();
  const teamSlugs = new Set(catalog.recommended.map((entry) => entry.routeSegment));
  const slugs = seasonPageCatalog(registry, catalog).pages.map((page) => page.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) assert.ok(!teamSlugs.has(slug), `${slug} trùng slug đội`);
  const colliding = { recommended: [{ routeSegment: "pk-s24", sourceSeasonId: "pk-s24", sourceSeasonCode: "PK-S24" }] };
  assert.throws(() => seasonPageCatalog({ defaultSourceSeasonId: "og", seasonOptions: [
    { sourceSeasonId: "og", displayCode: "OG", displayNameVi: "A", nameRaw: "甲" },
    { sourceSeasonId: "pk-s24", displayCode: "PK-S24", displayNameVi: "B", nameRaw: "乙" },
  ] }, colliding), /trùng/u);
});

test("5. registry rỗng cho 0 trang, không ném lỗi", async () => {
  for (const registry of [{ schemaVersion: 1, seasonOptions: [], scopes: [] }, {}, null]) {
    const result = seasonPageCatalog(registry, { recommended: [] });
    assert.deepEqual(result.pages, []);
    assert.equal(result.current, null);
    assert.deepEqual(seasonRedirectRules(result), []);
  }
});

test("6. đổi defaultSourceSeasonId: mùa cũ cũ có trang, mùa mới hiện tại mất trang + 301 từ slug của nó, nhãn mùa cũ theo thứ tự registry, client không còn hằng số", async () => {
  const { registry, catalog } = await data();
  const before = seasonPageCatalog(registry, catalog);
  const switched = withDefault(registry, "pk-s24");
  const after = seasonPageCatalog(switched, catalog);
  const current = registry.defaultSourceSeasonId;
  const currentSlug = registry.seasonOptions.find((item) => item.sourceSeasonId === current).displayCode.toLowerCase();
  assert.notEqual(current, "pk-s24");
  assert.ok(!after.pages.some((page) => page.slug === "pk-s24"));
  assert.ok(after.pages.some((page) => page.slug === currentSlug), "mùa hiện tại thành mùa cũ nên có trang");
  assert.ok(before.pages.some((page) => page.slug === "pk-s24") && !before.pages.some((page) => page.slug === currentSlug));
  assert.deepEqual(seasonRedirectRules(after), [
    { from: "/doi-chuan/pk-s24/", to: "/doi-chuan/", status: 301 },
    { from: "/zh/doi-chuan/pk-s24/", to: "/zh/doi-chuan/", status: 301 },
    { from: "/ja/doi-chuan/pk-s24/", to: "/ja/doi-chuan/", status: 301 },
  ]);
  assert.equal(isOldSeason(current, registry.defaultSourceSeasonId), false);
  // Mặc định đổi sang PK-S24: PK-S27 (mùa hiện tại trước đó) giờ mới hơn mặc định nên không nhãn, PK-S20 thì có.
  assert.equal(isOldSeason(current, "pk-s24"), false);
  assert.equal(isOldSeason("pk-s20", "pk-s24"), true);
  assert.equal(isOldSeason("pk-s24", "pk-s24"), false);
  assert.equal(isOldSeason(null, "pk-s24"), false);
  // Chip "Hiện tại" của ô chọn mùa theo registry, không theo hằng số.
  const option = (id) => registry.seasonOptions.find((item) => item.sourceSeasonId === id);
  assert.match(seasonOptionText(option("pk-s24"), "pk-s24"), /Hiện tại/u);
  assert.doesNotMatch(seasonOptionText(option(current), "pk-s24"), /Hiện tại/u);
  assert.match(seasonOptionText(option(current), current), /Hiện tại/u);
  const client = await readFile(new URL("../js/team-filter-section.js", import.meta.url), "utf8");
  assert.doesNotMatch(client, /CURRENT_SOURCE_SEASON_ID|og-兵演春秋/u);
});

test("6b. mùa mặc định có hơn 60 đội: /doi-chuan/ không JS liệt kê đủ mọi đội", async () => {
  await prepare();
  const { registry, rows } = await data();
  const big = registry.seasonOptions.map((item) => ({ id: item.sourceSeasonId, n: rows.filter((row) => row.sourceSeasonId === item.sourceSeasonId).length }))
    .sort((a, b) => b.n - a.n)[0];
  assert.ok(big.n > 60, `cần mùa >60 đội (${big.n})`);
  for (const locale of ["vi", "zh"]) {
    const html = recommendedSectionTrees({ family: "recommended", rows, registry: withDefault(registry, big.id), locale }).map((tree) => treeToHtml(tree)).join("");
    const keys = [...html.matchAll(/data-reference-key="([^"]*)"/gu)].map((match) => match[1]);
    assert.equal(keys.length, big.n, `${locale}: SSR phải đủ ${big.n} đội`);
    assert.equal(new Set(keys).size, big.n);
    // Dấu danh sách: client chỉ nhận lại DOM khi đúng số đội đang hiện; 60 ≠ n nên client dựng lại theo lượt như cũ.
    assert.doesNotMatch(html, new RegExp(`data-ssr-signature="[^"]*,60\\]"`, "u"));
  }
  // Mùa mặc định ≤ 60 đội: dấu danh sách giữ nguyên `PAGE_SIZE` để client tiếp tục nhận lại DOM.
  const smallId = registry.seasonOptions.map((item) => item.sourceSeasonId)
    .find((id) => { const n = rows.filter((row) => row.sourceSeasonId === id).length; return n > 0 && n <= 60; });
  const small = recommendedSectionTrees({ family: "recommended", rows, registry: withDefault(registry, smallId), locale: "vi" }).map((tree) => treeToHtml(tree)).join("");
  assert.match(small, /data-ssr-signature="[^"]*,60\]"/u);
});

test("6c. nhãn mùa cũ theo số mùa, không theo thứ tự ô chọn của nguồn (#89)", async () => {
  const { registry, catalog } = await data();
  // Thứ tự nguồn của generation #103: PK-S27, PK-S28 … S1, OG (ô chọn, không phải thời gian). Kết quả không được phụ thuộc vào nó.
  const og = registry.seasonOptions.find((item) => item.sourceSeasonId === "og-兵演春秋");
  const first = ["pk-s27", "pk-s28"].map((id) => registry.seasonOptions.find((item) => item.sourceSeasonId === id));
  const rest = registry.seasonOptions.filter((item) => item !== og && !first.includes(item));
  const real = { ...registry, seasonOptions: [...first, ...rest, og] };
  assert.equal(real.seasonOptions[0].sourceSeasonId, "pk-s27");
  assert.equal(real.seasonOptions.at(-1).sourceSeasonId, "og-兵演春秋");
  assert.equal(isOldSeason("pk-s28", "pk-s27"), false);
  assert.equal(isOldSeason("pk-s26", "pk-s27"), true);
  assert.equal(isOldSeason("pk-s4", "pk-s27"), true);
  assert.equal(isOldSeason("s3", "pk-s4"), true);
  assert.equal(isOldSeason("s1", "pk-s27"), true);
  assert.equal(isOldSeason("og-兵演春秋", "pk-s27"), false);
  assert.equal(isOldSeason("pk-s29", "pk-s27"), false);
  assert.equal(isOldSeason("pk-s27", "pk-s27"), false);
  // Không rõ: không nhãn.
  assert.equal(isOldSeason("pk-s999x", "pk-s27"), false);
  assert.equal(isOldSeason("pk-s26", "pk-xyz"), false);
  assert.equal(isOldSeason("pk-s26", null), false);
  assert.equal(isOldSeason(undefined, "pk-s27"), false);
  assert.equal(isOldSeason("", "pk-s27"), false);
  // Mặc định là OG: không mùa nào có nhãn.
  const ogDefault = seasonPageCatalog(withDefault(real, "og-兵演春秋"), catalog);
  assert.ok(ogDefault.pages.length > 10);
  assert.ok(ogDefault.pages.every((page) => page.older === false));
  // Cờ `older` của trang mùa theo cùng hàm, với thứ tự nguồn của #103.
  const result = seasonPageCatalog(withDefault(real, "pk-s27"), catalog);
  assert.equal(result.pages.find((page) => page.sourceSeasonId === "pk-s28").older, false);
  assert.equal(result.pages.find((page) => page.sourceSeasonId === "pk-s26").older, true);
  assert.equal(result.pages.find((page) => page.sourceSeasonId === "s1").older, true);
  assert.equal(result.pages.every((page) => page.older === (page.sourceSeasonId !== "og-兵演春秋" && Number(/(\d+)$/u.exec(page.sourceSeasonId)[1]) < 27)), true);
});
