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
import { ssrStaleGuardScript } from "../src/lib/team-section-ssr.js";

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
      // Đội chuẩn và thẻ Khai hoang (cấu hình mặc định) là URL canonical trần; Đội khác chỉ có `variant` chọn nội dung.
      for (const href of details) {
        const keys = [...new URL(href, "https://tqccl.invalid").searchParams.keys()];
        assert.deepEqual(keys, section === "team-khac" ? ["variant"] : [], `${locale} ${section}: ${href}`);
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
