// Phần thân dựng sẵn của bốn trang danh sách đội (lúc build): mùa/kịch bản mặc định, số đội, link chi tiết, vân tay
// publication. Dữ liệu thật của repo qua `src/lib/team-ssr.ts` — cùng đường mà Astro gọi.
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { teamSectionParts } from "../src/lib/team-ssr.ts";
import { websiteDisplayPublicationSnapshot } from "../src/lib/root-static-artifacts.ts";
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";
import { referenceViewSignature, PAGE_SIZE } from "../js/team-filter-section.js";
import { TEAM_VIEW_CARDS } from "../js/team-view.js";
import { SOURCE_TIER_ORDER, referenceFacetValues } from "../js/recommended-reference-state.js";
import { treeToHtml } from "../js/view-tree.js";
import { recommendedSectionTrees, ssrStaleGuardScript } from "../src/lib/team-section-ssr.js";
import { WAITING_OR_JS_REQUIRED } from "../scripts/verify-astro-dist.mjs";

const parse = (bytes) => JSON.parse(Buffer.from(bytes).toString("utf8"));
const keysOf = (html) => [...html.matchAll(/data-reference-key="([^"]*)"/gu)].map((match) => match[1]);
const count = (html, pattern) => (html.match(pattern) ?? []).length;

test("Đội chuẩn dựng sẵn: đủ mọi đội của mùa mặc định, mỗi đội có link chi tiết theo bản ngôn ngữ", async () => {
  const website = await websiteDisplayPublicationSnapshot();
  const catalog = await teamDetailCatalog();
  const registry = parse(website.recommended.files["seasons.json"]);
  const records = parse(website.recommended.files["index.json"]).records;
  const bySource = new Map(records.map((row) => [row.sourceConfigId, row]));
  for (const locale of ["vi", "zh"]) {
    const { html, source } = await teamSectionParts("team-chuan", locale);
    assert.equal(source, website.pin.sha256);
    const keys = keysOf(html);
    // Mỗi đội xuất hiện đúng một lần ở thẻ (khóa nằm trên thẻ `article`); dựng đủ mọi đội của mùa mặc định.
    const expected = records.filter((row) => row.sourceSeasonId === registry.defaultSourceSeasonId).length;
    assert.ok(expected > 0);
    assert.equal(keys.length, expected, `${locale}: số đội dựng sẵn ${keys.length}`);
    assert.equal(new Set(keys).size, expected);
    for (const key of keys) assert.equal(bySource.get(key)?.sourceSeasonId, registry.defaultSourceSeasonId, `${locale}: ${key} không thuộc mùa mặc định`);
    for (const key of keys) {
      const entry = catalog.recommended.find((candidate) => candidate.sourceConfigId === key);
      assert.ok(html.includes(`href="${locale === "zh" ? "/zh" : ""}${entry.routePath}"`), `${locale}: ${key} thiếu link chi tiết sạch (URL canonical, không nguồn quay lại)`);
    }
    assert.equal(count(html, /<h1\b/gu), 1);
    assert.equal(count(html, /class="reference-view" data-ssr-signature=/gu), 1);
  }
});

test("Đội khác dựng sẵn: 60 team đầu theo optionRank của đại diện, thẻ dựng bằng đại diện, ghi số phương án, link tới trang của chính nó", async () => {
  const website = await websiteDisplayPublicationSnapshot();
  const catalog = await teamDetailCatalog();
  const payload = parse(website.recommended.files["other-teams.json"]);
  const byVariant = new Map(payload.records.map((row) => [row.legacyVariantId, row]));
  // Tập kỳ vọng dựng thẳng từ `teamGroups` của builder: team có đại diện, theo optionRank của đại diện.
  const teams = payload.teamGroups
    .filter((group) => group.representativeVariantId !== null)
    .sort((a, b) => byVariant.get(a.representativeVariantId).optionRank - byVariant.get(b.representativeVariantId).optionRank);
  assert.ok(teams.length > 60, "dữ liệu thật phải hơn một lượt");
  const firstPage = teams.slice(0, 60);
  const multi = firstPage.filter((group) => group.completeVariantIds.length > 1);
  assert.ok(multi.length > 0, "lượt đầu phải có team nhiều phương án");
  const optionLabel = { vi: (n) => `${n} phương án`, zh: (n) => `${n} 种方案`, ja: (n) => `${n} 通りの構成` };
  for (const locale of ["vi", "zh", "ja"]) {
    const { html } = await teamSectionParts("team-khac", locale);
    const keys = keysOf(html);
    assert.deepEqual(keys, firstPage.map((group) => group.representativeVariantId), `${locale}: đúng 60 team đầu, đúng thứ tự`);
    for (const key of keys) {
      const record = byVariant.get(key);
      assert.equal(record.dataComplete, true, `${locale}: ${key} thiếu dữ liệu`);
      const entry = catalog.legacy.find((candidate) => candidate.legacyTeamId === record.legacyTeamId);
      assert.ok(entry, `${locale}: ${key} không phải đội gốc có route`);
      const path = `${locale === "vi" ? "" : `/${locale}`}${entry.routePath}`;
      assert.ok(html.includes(`href="${path}"`) || html.includes(`href="${path}?from=`), `${locale}: ${key} thiếu link tới trang của chính nó`);
    }
    // Mỗi đội gốc đúng một phương án: link tới trang Đội khác không mang `?variant=`.
    assert.doesNotMatch(html, /[?&]variant=/u, `${locale}: link danh sách không mang ?variant=`);
    // Mỗi team nhiều phương án ghi đúng số phương án đủ dữ liệu; team một phương án không ghi.
    const cards = html.split(/(?=<article\b)/u).slice(1);
    for (const group of firstPage) {
      const card = cards.find((item) => item.includes(`data-reference-key="${group.representativeVariantId}"`));
      const n = group.completeVariantIds.length;
      if (n > 1) assert.ok(card.includes(`<span class="reference-option-count">${optionLabel[locale](n)}</span>`), `${locale}: ${group.teamGroupId} thiếu "${optionLabel[locale](n)}"`);
      else assert.doesNotMatch(card, /reference-option-count/u, `${locale}: ${group.teamGroupId} một phương án không ghi số`);
    }
    assert.equal(count(html, /class="reference-option-count"/gu), multi.length);
    assert.equal(count(html, /<h1\b/gu), 1);
  }
});

test("Cùng Tồn dựng sẵn: nhóm đầu của mùa mới nhất, năm đội, mỗi đội ba tướng", async () => {
  for (const locale of ["vi", "zh", "ja"]) {
    const { html } = await teamSectionParts("coexist", locale);
    assert.equal(count(html, /coexist-team-card/gu) >= 5, true, `${locale}: thiếu thẻ đội`);
    assert.equal(count(html, /class="coexist-group-view" data-ssr-signature=/gu), 1);
    assert.equal(count(html, /<h1\b/gu), 1);
    const firstCard = html.split("coexist-team-card")[1];
    assert.equal(count(firstCard.split("</article>")[0], /class="hero reference-holder"/gu), 3, `${locale}: đội đầu phải có ba tướng`);
    // Nguồn bảng 11 cột: bản vi dựng sẵn Trang bị từng tướng (bản zh, ja không có). Thẻ Kỳ Lược từng đội có ở mọi bản:
    // năm thẻ theo hiệp, mỗi thẻ link trang riêng Tra cứu Kỳ lược theo bản ngôn ngữ (bản ja dùng tên Nhật của lookup-ja).
    assert.equal(count(html, /coexist-hero-equipment/gu), locale === "vi" ? 15 : 0, `${locale}: số dòng Trang bị`);
    assert.equal(count(html, /class="detail-qilue coexist-qilue"/gu), 5, `${locale}: số ô Thẻ Kỳ Lược`);
    assert.equal(count(html, new RegExp(`class="detail-qilue-card is-link"[^>]*href="${locale === "vi" ? "" : `/${locale}`}/tra-cuu/ky-luoc/`, "gu")), 25, `${locale}: link thẻ`);
    assert.equal(count(html, /coexist-card-strategy/gu), 0, `${locale}: không còn dòng chữ thô`);
  }
});

test("Khai hoang dựng sẵn: đủ mọi thẻ đội của dữ liệu, mỗi thẻ có link chi tiết theo bản ngôn ngữ", async () => {
  const website = await websiteDisplayPublicationSnapshot();
  const catalog = await teamDetailCatalog();
  const data = parse(website.publicFiles["khaihoang.json"]);
  for (const locale of ["vi", "zh"]) {
    const { html } = await teamSectionParts("khaihoang", locale);
    assert.equal(count(html, /class="team-card reference-team-card kh-card/gu), data.teams.length);
    for (const team of data.teams) {
      const entry = catalog.khaiHoang.find((candidate) => candidate.khaiHoangTeamId === team.id);
      assert.ok(html.includes(`href="${locale === "zh" ? "/zh" : ""}${entry.routePath}"`), `${locale}: ${team.id} thiếu link chi tiết sạch`);
    }
    assert.equal(count(html, /<h1\b/gu), 1);
  }
});

/** Duyệt cây view (`{tag, attrs, children}`) mà `recommendedSectionTrees` trả về, không cần `document`. */
const walk = (node, visit) => {
  if (typeof node === "string") return;
  visit(node);
  for (const child of node.children) walk(child, visit);
};
const findAll = (trees, predicate) => {
  const found = [];
  for (const tree of [].concat(trees)) walk(tree, (node) => { if (predicate(node)) found.push(node); });
  return found;
};
const classesOf = (node) => String(node.attrs?.class ?? "").split(/\s+/u).filter(Boolean);
const hasClass = (node, name) => classesOf(node).includes(name);
const textOf = (node) => (typeof node === "string" ? node : node.children.map(textOf).join(""));
const isControl = (node) => ["button", "input", "select", "textarea"].includes(node.tag);
const isLocked = (node) => node.attrs.disabled === true && node.attrs["aria-disabled"] === "true";
/** Nút của danh sách cần `js/app.js` gắn sự kiện: cùng luật với `NEEDS_SCRIPT` của `src/lib/team-section-ssr.js`. */
const needsScript = (node) => "data-tactic-search" in node.attrs || /(?:^|\s)kh-(?:config|unit)-chip(?:\s|$)/u.test(node.attrs.class ?? "");

const FAMILIES = [["recommended", "team-chuan"], ["other", "team-khac"]];
const LOCALES = ["vi", "zh", "ja"];

/** Cây dựng sẵn của một mục danh sách (`[header.reference-head, div.reference-browser]`) từ dữ liệu thật đang pin. */
async function sectionTrees(family, locale) {
  const website = await websiteDisplayPublicationSnapshot();
  const registry = parse(website.recommended.files["seasons.json"]);
  const data = parse(website.recommended.files[family === "other" ? "other-teams.json" : "index.json"]);
  const trees = family === "other"
    ? recommendedSectionTrees({ family, payload: data, registry, locale })
    : recommendedSectionTrees({ family, rows: data.records, registry, locale });
  return { trees, registry, data };
}

for (const [family, section] of FAMILIES) {
  for (const locale of LOCALES) {
    test(`khung dựng sẵn (${section}, ${locale}): .reference-browser > .reference-results gồm thanh công cụ, sidebar lọc và thân có .reference-view[data-ssr-signature]`, async () => {
      const { trees } = await sectionTrees(family, locale);
      assert.equal(trees.length, 2);
      const [head, browser] = trees;
      assert.equal(head.tag, "header");
      assert.ok(hasClass(head, "reference-head"));
      assert.ok(hasClass(browser, "reference-browser"));
      assert.equal(browser.children.length, 1);
      const [results] = browser.children;
      assert.ok(hasClass(results, "reference-results"));
      assert.deepEqual(results.children.map((child) => child.tag), ["div", "aside", "div"]);
      const [toolbar, filters, body] = results.children;
      assert.ok(hasClass(toolbar, "reference-toolbar"));
      assert.ok(hasClass(filters, "reference-filters"));
      assert.equal(filters.attrs.id, `section-${section}-filters`);
      assert.ok(hasClass(body, "reference-results-body"));
      const views = body.children.filter((child) => hasClass(child, "reference-view"));
      assert.equal(views.length, 1);
      assert.equal(typeof views[0].attrs["data-ssr-signature"], "string");
      const { html } = await teamSectionParts(section, locale);
      assert.equal(count(html, /<h1\b/gu), 1, `${locale}: đúng một h1`);
      assert.ok(html.includes('<div class="reference-browser"><div class="reference-results"><div class="reference-toolbar">'));
      assert.equal(count(html, /class="reference-view" data-ssr-signature=/gu), 1);
    });

    test(`khung dựng sẵn (${section}, ${locale}): mọi điều khiển của khung bị khoá, nút trong danh sách chỉ khoá theo NEEDS_SCRIPT`, async () => {
      const { trees } = await sectionTrees(family, locale);
      const view = findAll(trees, (node) => hasClass(node, "reference-view"))[0];
      const inView = new Set(findAll(view, isControl));
      const shell = findAll(trees, isControl).filter((control) => !inView.has(control));
      // Ô chọn mùa (Đội chuẩn), ô tìm, nút Bộ lọc, ba nút kiểu hiển thị, Xóa lọc và chip: đủ loại điều khiển của khung.
      assert.ok(shell.length >= 10, `${section}: chỉ có ${shell.length} điều khiển của khung`);
      for (const control of shell) assert.ok(isLocked(control), `${section}/${locale}: ${control.tag}.${control.attrs.class ?? ""} chưa khoá`);
      const kinds = new Set(shell.map((control) => control.tag));
      assert.ok(kinds.has("input") && kinds.has("button"));
      assert.equal(kinds.has("select"), family === "recommended", `${section}: ô chọn mùa chỉ có ở Đội chuẩn`);
      const buttons = findAll(view, (node) => node.tag === "button");
      assert.ok(buttons.length > 0 && buttons.some(needsScript), `${section}: danh sách phải có nút cần JavaScript`);
      for (const button of buttons) assert.equal(isLocked(button), needsScript(button), `${section}/${locale}: nút trong danh sách ${JSON.stringify(button.attrs)}`);
    });

    test(`khung dựng sẵn (${section}, ${locale}): ${family === "recommended" ? "ô chọn mùa chọn đúng mùa mặc định, huy hiệu Đang diễn ra hiện" : "không có ô chọn mùa, vẫn có nhãn mùa tĩnh"}`, async () => {
      const { trees, registry } = await sectionTrees(family, locale);
      const [head] = trees;
      if (family === "other") {
        assert.equal(findAll(trees, (node) => node.tag === "select" || node.tag === "option").length, 0);
        assert.equal(findAll(head, (node) => hasClass(node, "reference-season-static")).length, 1);
        assert.equal(findAll(trees, (node) => node.tag === "label" && hasClass(node, "reference-season-field")).length, 0);
        return;
      }
      const [field] = findAll(head, (node) => node.tag === "label" && hasClass(node, "reference-season-field"));
      assert.ok(field, "Đội chuẩn: nhãn .reference-season-field trong đầu mục");
      const [select] = findAll(field, (node) => node.tag === "select");
      const options = findAll(select, (node) => node.tag === "option");
      assert.equal(options[0].attrs.value, "all");
      assert.deepEqual(options.slice(1).map((option) => option.attrs.value), registry.seasonOptions.map((item) => item.sourceSeasonId));
      const selected = options.filter((option) => option.attrs.selected === true);
      assert.deepEqual(selected.map((option) => option.attrs.value), [registry.defaultSourceSeasonId]);
      const [status] = findAll(field, (node) => hasClass(node, "reference-season-status"));
      assert.ok(!status.attrs.hidden, "đang xem đúng mùa mặc định nên huy hiệu hiện");
    });

    test(`khung dựng sẵn (${section}, ${locale}): số đếm và số của từng chip khớp tính lại từ dữ liệu; thông báo rỗng có hidden`, async () => {
      const { trees, registry, data } = await sectionTrees(family, locale);
      // Tập đội của danh sách mặc định, dựng thẳng từ dữ liệu: Đội chuẩn theo hàng của mùa mặc định, Đội khác theo team có đại diện.
      const byVariant = new Map((data.records ?? []).map((row) => [row.legacyVariantId, row]));
      const items = family === "other"
        ? data.teamGroups.filter((group) => group.representativeVariantId !== null).map((group) => group.completeVariantIds.map((id) => byVariant.get(id)))
        : data.records.filter((row) => row.sourceSeasonId === registry.defaultSourceSeasonId).map((row) => [row]);
      assert.ok(items.length > 0);
      const [countNode] = findAll(trees, (node) => hasClass(node, "reference-count"));
      const tail = { vi: `${items.length} đội`, zh: `${items.length} 队`, ja: `${items.length}編成` }[locale];
      assert.equal(textOf(countNode), `${items.length} / ${tail}`);
      for (const key of ["unit", "faction", "tier", "subcategory", "source"]) {
        // Đội chuẩn đếm theo từng giá trị của hàng; Đội khác đếm theo team (hợp giá trị của mọi phương án đủ dữ liệu).
        const expected = new Map();
        for (const records of items) {
          const values = records.flatMap((record) => referenceFacetValues(record, key));
          for (const value of family === "other" ? new Set(values) : values) expected.set(value, (expected.get(value) ?? 0) + 1);
        }
        const [group] = findAll(trees, (node) => node.tag === "div" && hasClass(node, `${key}-group`));
        assert.equal(Boolean(group), expected.size > 0, `${section}/${locale}: nhóm ${key}`);
        if (!group) continue;
        const chips = findAll(group, (node) => node.tag === "button" && hasClass(node, "fchip"));
        const actual = new Map(chips.map((chip) => [chip.attrs["data-focus-key"].slice(key.length + 1), Number(textOf(findAll(chip, (node) => hasClass(node, "fchip-count"))[0]))]));
        assert.deepEqual([...actual].sort(), [...expected].sort(), `${section}/${locale}: số chip ${key}`);
        const valueOf = (chip) => chip.attrs["data-focus-key"].slice(key.length + 1);
        const counts = chips.map((chip) => Number(textOf(findAll(chip, (node) => hasClass(node, "fchip-count"))[0])));
        if (key === "tier") {
          // Tier xếp theo thứ tự cấp bậc của nguồn, không theo số đếm.
          const ranks = chips.map((chip) => { const index = SOURCE_TIER_ORDER.indexOf(valueOf(chip)); return index < 0 ? 999 : index; });
          assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `${section}/${locale}: chip tier theo SOURCE_TIER_ORDER`);
        } else {
          assert.deepEqual(counts, [...counts].sort((a, b) => b - a), `${section}/${locale}: chip ${key} theo số đếm giảm dần`);
        }
      }
      const [notice] = findAll(trees, (node) => hasClass(node, "reference-notice"));
      assert.equal(notice.attrs.hidden, true);
      assert.equal(textOf(notice), "");
      const [empty] = findAll(trees, (node) => hasClass(node, "reference-empty"));
      assert.equal(empty.attrs.hidden, true, "danh sách còn đội nên dòng 'không có đội' ẩn");
      // "Xem thêm": Đội chuẩn dựng đủ mọi đội nên hết; Đội khác chỉ dựng PAGE_SIZE team đầu nên còn lượt sau (nút bị khoá, có ghi chú).
      const [more] = findAll(trees, (node) => hasClass(node, "reference-more"));
      if (family === "other") {
        assert.ok(items.length > PAGE_SIZE);
        assert.ok(!more.attrs.hidden);
        const moreButtons = findAll(more, (node) => node.tag === "button");
        assert.equal(moreButtons.length, 1);
        assert.ok(hasClass(moreButtons[0], "lookup-more") && isLocked(moreButtons[0]));
        assert.equal(findAll(more, (node) => hasClass(node, "lookup-more-note")).length, 1);
      } else {
        assert.equal(more.attrs.hidden, true);
        assert.equal(more.children.length, 0);
      }
      assert.doesNotMatch(trees.map((tree) => treeToHtml(tree)).join(""), WAITING_OR_JS_REQUIRED);
    });
  }
}

test("nút dựng sẵn của Khai hoang không đổi: chỉ chip cần JavaScript bị khoá, nút khác giữ nguyên", async () => {
  const buttons = (html) => [...html.matchAll(/<button\b[^>]*>/gu)].map((match) => match[0]);
  const scripted = (tag) => /data-tactic-search=|kh-config-chip|kh-unit-chip/u.test(tag);
  const { html } = await teamSectionParts("khaihoang", "vi");
  const tags = buttons(html);
  const locked = tags.filter(scripted);
  assert.ok(locked.length > 0, "khaihoang: phải có nút cần JavaScript");
  for (const tag of locked) assert.match(tag, /\sdisabled(?=[\s>])[^>]*aria-disabled="true"|aria-disabled="true"[^>]*\sdisabled(?=[\s>])/u, `khaihoang: nút chưa khoá ${tag}`);
  for (const tag of tags.filter((candidate) => !scripted(candidate))) assert.doesNotMatch(tag, /disabled/u, `khaihoang: nút không cần JS bị khoá ${tag}`);
  // Trang Khai hoang không có khung lọc của danh sách đội.
  assert.doesNotMatch(html, /reference-toolbar|reference-filters|reference-season-field/u);
});

/** Mọi `href` của một đoạn HTML dựng sẵn, đã bỏ escape `&amp;` của thuộc tính. */
const hrefsOf = (html) => [...html.matchAll(/\bhref="([^"]*)"/gu)].map((match) => match[1].replaceAll("&amp;", "&"));

test("link chi tiết dựng sẵn của Đội chuẩn, Đội khác và Khai hoang không mang `from` ở mọi bản (vi, zh, ja)", async () => {
  for (const locale of ["vi", "zh", "ja"]) {
    const prefix = locale === "vi" ? "" : `/${locale}`;
    const detail = new RegExp(`^${prefix}/(?:doi-chuan|doi-khac|khai-hoang)/[^/?#]+/(?:\\?|$)`, "u");
    for (const section of ["team-chuan", "team-khac", "khaihoang"]) {
      const hrefs = hrefsOf((await teamSectionParts(section, locale)).html);
      const details = hrefs.filter((href) => detail.test(href));
      assert.ok(details.length > 0, `${locale} ${section}: phải có link chi tiết`);
      for (const href of hrefs) {
        assert.equal(new URL(href, "https://tqccl.invalid").searchParams.has("from"), false, `${locale} ${section}: ${href}`);
      }
      // Đội chuẩn, Đội khác (mỗi đội gốc một phương án) và thẻ Khai hoang (cấu hình mặc định) đều là URL canonical trần.
      for (const href of details) {
        const keys = [...new URL(href, "https://tqccl.invalid").searchParams.keys()];
        assert.deepEqual(keys, [], `${locale} ${section}: ${href}`);
      }
    }
  }
});

/** Chữ ký `data-ssr-signature` của khối danh sách dựng sẵn (đã bỏ escape thuộc tính HTML), hoặc `null` khi trang không có. */
const signatureOf = (html) => {
  const raw = html.match(/class="reference-view" data-ssr-signature="([^"]*)"/u)?.[1];
  if (raw === undefined) return null;
  return JSON.parse(raw.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"));
};

test("chữ ký danh sách dựng sẵn là [mùa, từ khóa, bộ lọc, kiểu xem, số đội]: không còn thành phần URL", async () => {
  const website = await websiteDisplayPublicationSnapshot();
  const registry = parse(website.recommended.files["seasons.json"]);
  const records = parse(website.recommended.files["index.json"]).records;
  const noFilters = { faction: [], unit: [], tier: [], subcategory: [], source: [] };
  const defaultTeams = records.filter((row) => row.sourceSeasonId === registry.defaultSourceSeasonId).length;
  for (const locale of ["vi", "zh", "ja"]) {
    const chuan = signatureOf((await teamSectionParts("team-chuan", locale)).html);
    assert.deepEqual(chuan, [registry.defaultSourceSeasonId, "", noFilters, TEAM_VIEW_CARDS, Math.max(PAGE_SIZE, defaultTeams)], `${locale}: Đội chuẩn`);
    const khac = signatureOf((await teamSectionParts("team-khac", locale)).html);
    assert.deepEqual(khac, ["all", "", noFilters, TEAM_VIEW_CARDS, PAGE_SIZE], `${locale}: Đội khác`);
    // Trình duyệt dựng cùng chữ ký từ chính trạng thái của nó; vì không có URL nên `?kho=`/`?xep=` không làm lệch dấu.
    assert.equal(
      JSON.stringify(chuan),
      referenceViewSignature({ season: registry.defaultSourceSeasonId, query: "", filters: noFilters }, TEAM_VIEW_CARDS, Math.max(PAGE_SIZE, defaultTeams)),
    );
  }
  assert.equal(signatureOf((await teamSectionParts("khaihoang", "vi")).html), null);
});

/** Chạy script bảo vệ chống nháy trong một context giả; `true` khi nó gắn `data-ssr-stale` lên mount. */
function staleMarked(section, { search = "", storedView = null } = {}) {
  const mount = { dataset: {} };
  vm.runInNewContext(ssrStaleGuardScript(section), {
    URLSearchParams,
    URL,
    location: { search, pathname: "/", href: "https://tqccl.com/" },
    history: { state: null },
    localStorage: { getItem: () => storedView },
    sessionStorage: { getItem: () => null },
    document: { getElementById: (id) => (id === `section-${section}` ? mount : null) },
  });
  return Object.hasOwn(mount.dataset, "ssrStale");
}

test("bảo vệ chống nháy chỉ bật với khóa làm danh sách dựng sẵn sai: `kho`/`xep` thì không", () => {
  for (const [section, search, stale] of [
    ["team-chuan", "", false],
    ["team-chuan", "?utm_source=x", false],
    ["team-chuan", "?kho=rap-duoc", false],
    ["team-chuan", "?xep=de-rap", false],
    ["team-chuan", "?kho=rap-duoc&xep=de-rap&utm_source=x", false],
    ["team-chuan", "?season=pk-s24", true],
    ["team-chuan", "?q=x&kho=rap-duoc", true],
    ["team-chuan", "?unit=x&xep=de-rap", true],
    ["team-khac", "?faction=thuc", true],
    ["team-khac", "?kho=rap-duoc", false],
    ["khaihoang", "?khTeam=x", true],
  ]) {
    assert.equal(staleMarked(section, { search }), stale, `${section}${search}`);
  }
  // Kiểu hiển thị đã lưu khác Thẻ vẫn bật bảo vệ (danh sách đổi); `kho` không cứu được điều đó.
  assert.equal(staleMarked("team-chuan", { storedView: "bang" }), true);
  assert.equal(staleMarked("team-chuan", { search: "?kho=rap-duoc", storedView: "bang" }), true);
  assert.equal(staleMarked("team-chuan", { search: "?kho=rap-duoc", storedView: TEAM_VIEW_CARDS }), false);
});

/** Chạy script bảo vệ chống nháy với snapshot quay lại giả; `true` khi nó gắn `data-ssr-filters-open` lên mount. */
function filtersOpenMarked(section, { path = "/doi-chuan/", search = "", historyState = null, session = null } = {}) {
  const mount = { dataset: {} };
  vm.runInNewContext(ssrStaleGuardScript(section), {
    URLSearchParams,
    URL,
    location: { search, pathname: path, href: `https://tqccl.com${path}${search}` },
    history: { state: historyState },
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: () => session },
    document: { getElementById: (id) => (id === `section-${section}` ? mount : null) },
  });
  return Object.hasOwn(mount.dataset, "ssrFiltersOpen");
}
const returnSnapshot = (url, filters) => ({ version: 1, url, scrollY: 120, tab: "team-chuan", disclosures: { filters } });

test("bảo vệ quay lại mobile: panel lọc mở sẵn khi snapshot khớp URL và `disclosures.filters` là true", () => {
  const open = returnSnapshot("/doi-chuan/", true);
  const closed = returnSnapshot("/doi-chuan/", false);
  const asState = (snapshot) => ({ teamReturn: snapshot });
  assert.equal(filtersOpenMarked("team-chuan"), false, "không có snapshot");
  assert.equal(filtersOpenMarked("team-chuan", { historyState: asState(open) }), true, "history.state.teamReturn");
  assert.equal(filtersOpenMarked("team-chuan", { session: JSON.stringify(open) }), true, "sessionStorage");
  assert.equal(filtersOpenMarked("team-chuan", { historyState: asState(closed) }), false);
  // Như `restoreReturnState`: snapshot của history thắng snapshot của session.
  assert.equal(filtersOpenMarked("team-chuan", { historyState: asState(closed), session: JSON.stringify(open) }), false);
  assert.equal(filtersOpenMarked("team-chuan", { historyState: asState(open), session: JSON.stringify(closed) }), true);
  // Snapshot của URL khác (query hoặc trang khác) không áp.
  assert.equal(filtersOpenMarked("team-chuan", { search: "?q=x", historyState: asState(open) }), false);
  assert.equal(filtersOpenMarked("team-chuan", { historyState: asState(returnSnapshot("/doi-chuan/?q=x", true)) }), false);
  assert.equal(filtersOpenMarked("team-chuan", { path: "/doi-khac/", historyState: asState(open) }), false);
  // Khóa không thuộc allowlist của trang (tracking) không làm lệch; snapshot hỏng thì bỏ qua.
  assert.equal(filtersOpenMarked("team-chuan", { search: "?utm_source=x", historyState: asState(open) }), true);
  assert.equal(filtersOpenMarked("team-chuan", { historyState: asState({ ...open, version: 2 }) }), false);
  assert.equal(filtersOpenMarked("team-chuan", { session: "{không phải JSON" }), false);
  // Đúng URL có bộ lọc: snapshot mang đủ khóa; bản zh và Đội khác dùng chung luật.
  assert.equal(filtersOpenMarked("team-chuan", { search: "?season=pk-s24&q=x", historyState: asState(returnSnapshot("/doi-chuan/?season=pk-s24&q=x", true)) }), true);
  assert.equal(filtersOpenMarked("team-chuan", { path: "/zh/doi-chuan/", historyState: asState(returnSnapshot("/zh/doi-chuan/", true)) }), true);
  assert.equal(filtersOpenMarked("team-khac", { path: "/doi-khac/", historyState: asState(returnSnapshot("/doi-khac/", true)) }), true);
  // Panel lọc không phụ thuộc danh sách đã lọc: mở sớm cả khi URL có `kho`/`xep` (chỉ thẻ đích, focus và cuộn chờ kho, xem `restoreReturnState`),
  // nếu không panel mở muộn đúng lúc kho tới và đẩy danh sách xuống trên mobile.
  assert.equal(filtersOpenMarked("team-chuan", { search: "?kho=rap-duoc", historyState: asState(returnSnapshot("/doi-chuan/?kho=rap-duoc", true)) }), true);
  assert.equal(filtersOpenMarked("team-chuan", { search: "?xep=de-rap", session: JSON.stringify(returnSnapshot("/doi-chuan/?xep=de-rap", true)) }), true);
  assert.equal(filtersOpenMarked("team-chuan", { search: "?kho=rap-duoc&xep=de-rap", historyState: asState(returnSnapshot("/doi-chuan/?kho=rap-duoc&xep=de-rap", true)) }), true);
  // Snapshot ghi panel đóng thì có `kho` cũng không mở; snapshot của URL không có `kho` không áp cho URL có `kho`.
  assert.equal(filtersOpenMarked("team-chuan", { search: "?kho=rap-duoc", historyState: asState(returnSnapshot("/doi-chuan/?kho=rap-duoc", false)) }), false);
  assert.equal(filtersOpenMarked("team-chuan", { search: "?kho=rap-duoc", historyState: asState(open) }), false);
  // Mục khác không có panel lọc này.
  assert.equal(filtersOpenMarked("coexist", { path: "/cung-ton/", historyState: asState(returnSnapshot("/cung-ton/", true)) }), false);
  assert.equal(filtersOpenMarked("khaihoang", { path: "/khai-hoang/", historyState: asState(returnSnapshot("/khai-hoang/", true)) }), false);
});

test("script bảo vệ của Cùng Tồn / Khai hoang không mang khối panel lọc, nên script và thân dựng sẵn của hai mục này không đổi byte (chỉ đổi chỗ: con đầu của mount)", () => {
  for (const section of ["coexist", "khaihoang"]) {
    assert.doesNotMatch(ssrStaleGuardScript(section), /ssrFiltersOpen|openKey|allowed/u, section);
  }
  for (const section of ["team-chuan", "team-khac"]) assert.match(ssrStaleGuardScript(section), /ssrFiltersOpen/u, section);
});
