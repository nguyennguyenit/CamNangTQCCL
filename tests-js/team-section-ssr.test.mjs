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

test("Đội chuẩn dựng sẵn: chỉ đội của mùa mặc định, tối đa một lượt đầu, mỗi đội có link chi tiết theo bản ngôn ngữ", async () => {
  const website = await websiteDisplayPublicationSnapshot();
  const catalog = await teamDetailCatalog();
  const registry = parse(website.recommended.files["seasons.json"]);
  const records = parse(website.recommended.files["index.json"]).records;
  const bySource = new Map(records.map((row) => [row.sourceConfigId, row]));
  for (const locale of ["vi", "zh"]) {
    const { html, source } = await teamSectionParts("team-chuan", locale);
    assert.equal(source, website.pin.sha256);
    const keys = keysOf(html);
    // Mỗi đội xuất hiện đúng một lần ở thẻ (khóa nằm trên thẻ `article`); hàng đầu tiên là đội của mùa mặc định.
    assert.ok(keys.length > 0 && keys.length <= 60, `${locale}: số đội dựng sẵn ${keys.length}`);
    for (const key of keys) assert.equal(bySource.get(key)?.sourceSeasonId, registry.defaultSourceSeasonId, `${locale}: ${key} không thuộc mùa mặc định`);
    for (const key of keys) {
      const entry = catalog.recommended.find((candidate) => candidate.sourceConfigId === key);
      assert.ok(html.includes(`href="${locale === "zh" ? "/zh" : ""}${entry.routePath}?from=${encodeURIComponent(locale === "zh" ? "/zh/doi-chuan/" : "/doi-chuan/")}"`), `${locale}: ${key} thiếu link chi tiết mang nguồn quay lại`);
    }
    assert.equal(count(html, /<h1\b/gu), 1);
    assert.equal(count(html, /class="reference-view" data-ssr-signature=/gu), 1);
  }
});

test("Đội khác dựng sẵn: xem mọi mùa, mỗi thẻ có link tới trang đội gốc của chính nó", async () => {
  const website = await websiteDisplayPublicationSnapshot();
  const catalog = await teamDetailCatalog();
  const rows = parse(website.recommended.files["other-teams.json"]).records;
  const byVariant = new Map(rows.map((row) => [row.legacyVariantId, row]));
  for (const locale of ["vi", "zh"]) {
    const { html } = await teamSectionParts("team-khac", locale);
    const keys = keysOf(html);
    assert.ok(keys.length > 0 && keys.length <= 60);
    for (const key of keys) {
      const entry = catalog.legacy.find((candidate) => candidate.legacyTeamId === byVariant.get(key)?.legacyTeamId);
      assert.ok(entry, `${locale}: ${key} không phải đội gốc có route`);
      assert.ok(html.includes(`href="${locale === "zh" ? "/zh" : ""}${entry.routePath}?variant=${encodeURIComponent(key)}`), `${locale}: ${key} thiếu link đúng biến thể`);
    }
    assert.equal(count(html, /<h1\b/gu), 1);
  }
});

test("Cùng Tồn dựng sẵn: nhóm đầu của mùa mới nhất, năm đội, mỗi đội ba tướng", async () => {
  for (const locale of ["vi", "zh"]) {
    const { html } = await teamSectionParts("coexist", locale);
    assert.equal(count(html, /coexist-team-card/gu) >= 5, true, `${locale}: thiếu thẻ đội`);
    assert.equal(count(html, /class="coexist-group-view" data-ssr-signature=/gu), 1);
    assert.equal(count(html, /<h1\b/gu), 1);
    const firstCard = html.split("coexist-team-card")[1];
    assert.equal(count(firstCard.split("</article>")[0], /class="hero reference-holder"/gu), 3, `${locale}: đội đầu phải có ba tướng`);
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
