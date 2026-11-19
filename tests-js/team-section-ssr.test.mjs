// Phần thân dựng sẵn của bốn trang danh sách đội (lúc build): mùa/kịch bản mặc định, số đội, link chi tiết, vân tay
// publication. Dữ liệu thật của repo qua `src/lib/team-ssr.ts` — cùng đường mà Astro gọi.
import assert from "node:assert/strict";
import { test } from "node:test";
import { teamSectionParts } from "../src/lib/team-ssr.ts";
import { websiteDisplayPublicationSnapshot } from "../src/lib/root-static-artifacts.ts";
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";

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
      assert.ok(html.includes(`href="${locale === "zh" ? "/zh" : ""}${entry.routePath}?from=${encodeURIComponent(locale === "zh" ? "/zh/doi-chuan/" : "/doi-chuan/")}"`), `${locale}: ${key} thiếu link chi tiết mang nguồn quay lại`);
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
      assert.ok(html.includes(`href="${locale === "vi" ? "" : `/${locale}`}${entry.routePath}?variant=${encodeURIComponent(key)}`), `${locale}: ${key} thiếu link tới trang của chính nó`);
    }
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
      assert.ok(html.includes(`href="${locale === "zh" ? "/zh" : ""}${entry.routePath}?`), `${locale}: ${team.id} thiếu link chi tiết`);
    }
    assert.equal(count(html, /<h1\b/gu), 1);
  }
});

test("nút dựng sẵn cần JavaScript (chip chiến pháp, chip cấu hình/loại binh Khai hoang) bị khoá; nút khác giữ nguyên", async () => {
  const buttons = (html) => [...html.matchAll(/<button\b[^>]*>/gu)].map((match) => match[0]);
  const needsScript = (tag) => /data-tactic-search=|kh-config-chip|kh-unit-chip/u.test(tag);
  for (const section of ["team-chuan", "team-khac", "khaihoang"]) {
    const { html } = await teamSectionParts(section, "vi");
    const tags = buttons(html);
    const locked = tags.filter(needsScript);
    assert.ok(locked.length > 0, `${section}: phải có nút cần JavaScript`);
    for (const tag of locked) assert.match(tag, /\sdisabled(?=[\s>])[^>]*aria-disabled="true"|aria-disabled="true"[^>]*\sdisabled(?=[\s>])/u, `${section}: nút chưa khoá ${tag}`);
    for (const tag of tags.filter((candidate) => !needsScript(candidate))) assert.doesNotMatch(tag, /disabled/u, `${section}: nút không cần JS bị khoá ${tag}`);
  }
});
