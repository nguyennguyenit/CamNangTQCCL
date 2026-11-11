// Badge kho trên danh sách Đội chuẩn (#62): "Ráp được" / "Thiếu N món" theo kho đã lưu trên máy, dòng tóm tắt,
// lọc `kho=` và sắp `xep=`. Số liệu mong đợi tính bằng chính `buildListCoverage` trên bản ghi thật đang pin.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildSeasonCandidates } from "../js/roster-season-candidates.js";
import { buildListCoverage } from "../js/roster-list-coverage.js";

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const { generationId } = read("src/data/recommended-reference/current.json");
const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
const dicts = { heroesDict: read("data/heroes-dict.json"), tacticsDict: read("data/tactics.json") };

const SCAN_KEY = "tqccl.rosterRecommend.scanState.v1";
const SEASON = "og-兵演春秋";
const OLD_SEASON = "pk-s24";
const READY_TEAMS = ["og-bingyan-40y-lvbu-b", "og-bingyan-wunv-cavalry-hubaoqi"];

/** Kho có đúng tướng và chiến pháp (đã đối chiếu) của các đội `configIds` thuộc mùa `seasonId`. */
function rosterFor(seasonId, configIds) {
  const { teams } = buildSeasonCandidates(records.filter((record) => configIds.includes(record.sourceConfigId)), seasonId, dicts);
  const heroes = new Set();
  const tactics = new Set();
  for (const team of teams) {
    for (const hero of team.heroes) {
      heroes.add(hero.name);
      for (const tactic of hero.tactics) if (!tactic.unresolved) tactics.add(tactic.name);
    }
  }
  return {
    ownedHeroes: [...heroes].map((name) => ({ name })),
    ownedTactics: [...tactics].map((name) => ({ name })),
    lockedTeams: [],
    confirmed: true,
    updatedAt: "2026-11-11T00:00:00.000Z",
  };
}
const expectedFor = (seasonId, roster) => buildListCoverage({ records, seasonId, ...dicts, roster });

/** Ghi kho local trước khi trang chạy; chỉ ghi khi khóa còn trống để tải lại không đè dữ liệu. */
const seedRoster = (page, roster) => page.addInitScript(([key, value]) => {
  if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
}, [SCAN_KEY, JSON.stringify(roster)]);

const section = (page) => page.locator("#section-team-chuan");
const bar = (page) => section(page).locator(".reference-roster-bar");
const card = (page, configId) => section(page).locator(`[data-reference-key="${configId}"]`);
const badge = (locator) => locator.locator(".roster-stock-badge");
const waitForCoverage = (page) => expect(bar(page)).toHaveAttribute("data-state", "ready");
const noHorizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe("Đội chuẩn: badge kho", () => {
  const roster = rosterFor(SEASON, READY_TEAMS);
  const expected = expectedFor(SEASON, roster);
  // Đội còn thiếu ít món nhất (nhưng chưa đủ) của mùa: dùng để kiểm chữ "Thiếu N món".
  const missingTeam = [...expected.byConfigId].filter(([, entry]) => entry.missingCount > 0).sort((a, b) => a[1].missingCount - b[1].missingCount)[0];

  test("có kho: đội đủ hiện Ráp được, đội thiếu hiện đúng số món và tên món trong title", async ({ page }) => {
    await seedRoster(page, roster);
    await page.goto("/doi-chuan/");
    await waitForCoverage(page);
    for (const id of READY_TEAMS) {
      await expect(badge(card(page, id))).toHaveText("Ráp được");
      await expect(badge(card(page, id))).toHaveAttribute("data-missing-count", "0");
    }
    const [missingId, entry] = missingTeam;
    await expect(badge(card(page, missingId))).toHaveText(`Thiếu ${entry.missingCount} món`);
    await expect(badge(card(page, missingId))).toHaveAttribute("title", /Thiếu: /);
  });

  test("tóm tắt bằng tổng Ráp đủ của khối Độ phủ kho ở Gợi ý đội với cùng kho", async ({ page }) => {
    await seedRoster(page, roster);
    await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
    await page.goto("/doi-chuan/");
    await waitForCoverage(page);
    await expect(bar(page).locator(".reference-roster-summary")).toContainText(`${expected.summary.complete} / ${expected.summary.total}`);

    await page.goto(`/goi-y-doi-tu-kho/?season=${encodeURIComponent(SEASON)}`);
    await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
    const tool = page.locator("#section-roster-recommend");
    await tool.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();
    await expect(tool.locator(".roster-coverage-section h2")).toHaveText("Độ phủ kho");
    const cells = await tool.locator('.roster-coverage-section td[data-kind="complete"]').allTextContents();
    expect(cells.reduce((sum, text) => sum + Number(text), 0)).toBe(expected.summary.complete);
  });

  test("lọc Ráp được: chỉ còn đội đủ kho, URL có kho=rap-duoc và giữ sau tải lại", async ({ page }) => {
    await seedRoster(page, roster);
    await page.goto("/doi-chuan/");
    await waitForCoverage(page);
    await bar(page).getByRole("button", { name: "Ráp được", exact: true }).click();
    await expect(page).toHaveURL(/[?&]kho=rap-duoc/);
    const check = async () => {
      await waitForCoverage(page);
      await expect(section(page).locator("[data-reference-key]")).toHaveCount(expected.summary.complete);
      await expect(section(page).locator('.roster-stock-badge[data-missing-count="0"]')).toHaveCount(expected.summary.complete);
      await expect(bar(page).getByRole("button", { name: "Ráp được", exact: true })).toHaveAttribute("aria-pressed", "true");
    };
    await check();
    await page.reload();
    await check();

    await bar(page).getByRole("button", { name: "Thiếu tối đa 2", exact: true }).click();
    await expect(page).toHaveURL(/[?&]kho=thieu-2/);
    const near = [...expected.byConfigId.values()].filter((entry) => entry.missingCount <= 2).length;
    await expect(section(page).locator("[data-reference-key]")).toHaveCount(near);
  });

  test("sắp Dễ ráp nhất: trong từng bậc số món thiếu không giảm, URL có xep=de-rap", async ({ page }) => {
    await seedRoster(page, roster);
    await page.goto("/doi-chuan/");
    await waitForCoverage(page);
    await bar(page).getByRole("button", { name: "Dễ ráp nhất", exact: true }).click();
    await expect(page).toHaveURL(/[?&]xep=de-rap/);
    await expect(bar(page).getByRole("button", { name: "Dễ ráp nhất", exact: true })).toHaveAttribute("aria-pressed", "true");
    const tiers = await section(page).locator(".reference-tier-section").evaluateAll((sections) => sections.map((tier) =>
      [...tier.querySelectorAll("[data-reference-key]")].map((node) => {
        const mark = node.querySelector(".roster-stock-badge");
        return mark ? Number(mark.dataset.missingCount) : Number.POSITIVE_INFINITY;
      })));
    expect(tiers.length).toBeGreaterThan(0);
    for (const counts of tiers) expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(tiers[0][0]).toBe(0);
  });

  for (const [label, query] of [["Thẻ", ""], ["Thẻ gọn", "?view=luoi"], ["Bảng", "?view=bang"]]) {
    test(`badge có ở kiểu ${label}`, async ({ page }) => {
      await seedRoster(page, roster);
      await page.goto(`/doi-chuan/${query}`);
      await waitForCoverage(page);
      await expect(badge(card(page, READY_TEAMS[0]))).toHaveText("Ráp được");
      await expect(badge(card(page, READY_TEAMS[0]))).toBeVisible();
    });
  }

  /** Số lần trang tải từng từ điển (trang Đội chuẩn vốn đã tải chúng một lần cho mô hình mùa). */
  const dictionaryRequests = (requests) => ["heroes-dict.json", "tactics.json"].map((name) => requests.filter((url) => url.endsWith(`/data/${name}`)).length);

  test("chưa có kho: không badge, có dòng dẫn sang Gợi ý đội, kho và xep trên URL không có tác dụng", async ({ page }) => {
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/doi-chuan/?kho=rap-duoc&xep=de-rap");
    await expect(bar(page)).toHaveAttribute("data-state", "empty");
    await expect(bar(page).locator('a[href="/goi-y-doi-tu-kho/"]')).toBeVisible();
    await expect(section(page).locator(".roster-stock-badge")).toHaveCount(0);
    await expect(bar(page).getByRole("button")).toHaveCount(0);
    await expect(section(page).locator("[data-reference-key]")).toHaveCount(records.filter((record) => record.sourceSeasonId === SEASON).length);
    for (const count of dictionaryRequests(requests)) expect(count).toBeLessThanOrEqual(1);
  });

  test("có kho: badge không làm trang tải từ điển tướng và chiến pháp thêm lần nào", async ({ page }) => {
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    await seedRoster(page, roster);
    await page.goto("/doi-chuan/");
    await waitForCoverage(page);
    expect(dictionaryRequests(requests)).toEqual([1, 1]);
  });

  for (const [locale, theme, prefix, ready] of [["vi", "light", "", "Ráp được"], ["zh", "dark", "/zh", "可组建"]]) {
    test(`${locale}, theme ${theme}, mobile 390px: badge đúng ngôn ngữ và không tràn ngang`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await seedRoster(page, roster);
      await page.goto(`${prefix}/doi-chuan/`);
      await waitForCoverage(page);
      await expect(badge(card(page, READY_TEAMS[0]))).toHaveText(ready);
      expect(await noHorizontalOverflow(page)).toBe(true);
      await page.goto(`${prefix}/doi-chuan/?view=bang`);
      await waitForCoverage(page);
      expect(await noHorizontalOverflow(page)).toBe(true);
    });
  }
});

test("quay lại từ trang chi tiết khi đang sắp theo kho: giữ thứ tự theo kho và trả focus về đúng thẻ", async ({ page }) => {
  const roster = rosterFor(SEASON, READY_TEAMS);
  await seedRoster(page, roster);
  await page.goto("/doi-chuan/?xep=de-rap");
  await waitForCoverage(page);
  const cards = section(page).locator(".reference-team-card");
  // Thẻ thứ ba của bậc đầu: vị trí của nó phụ thuộc thứ tự sắp theo kho, không trùng thứ tự mặc định.
  const target = cards.nth(2);
  const key = await target.getAttribute("data-reference-key");
  const order = await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.referenceKey));
  await target.locator("a[data-team-detail-link]").first().evaluate((node) => node.click());
  await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
  await page.goBack();
  await expect(page).toHaveURL(/[?&]xep=de-rap/);
  await waitForCoverage(page);
  expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.referenceKey))).toEqual(order);
  await expect(section(page).locator(`.reference-team-card[data-reference-key="${key}"] a[data-team-detail-link]`).first()).toBeFocused();
});

test("thanh kho ẩn không chiếm chỗ: Đội khác không có thanh kho hiển thị", async ({ page }) => {
  await page.goto("/doi-khac/");
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
  const hidden = page.locator("#section-team-khac .reference-roster-bar");
  await expect(hidden).toBeHidden();
  expect(await hidden.evaluate((node) => getComputedStyle(node).display)).toBe("none");
});

test("trang mùa cũ: có kho thì thẻ có badge và dòng tóm tắt; chưa có kho thì trang giữ nguyên", async ({ page }) => {
  const season = buildSeasonCandidates(records, OLD_SEASON, dicts);
  const target = season.teams[0];
  const roster = rosterFor(OLD_SEASON, [target.id]);
  const expected = expectedFor(OLD_SEASON, roster);

  await page.goto(`/doi-chuan/${OLD_SEASON}/`);
  await expect(page.locator("#section-season-page [data-reference-key]").first()).toBeVisible();
  await expect(page.locator(".roster-stock-badge")).toHaveCount(0);

  await seedRoster(page, roster);
  await page.goto(`/doi-chuan/${OLD_SEASON}/`);
  const page24 = page.locator("#section-season-page");
  await expect(page24.locator(`[data-reference-key="${target.id}"] .roster-stock-badge`)).toHaveText("Ráp được");
  await expect(page24.locator(".reference-roster-summary")).toContainText(`${expected.summary.complete} / ${expected.summary.total}`);
});
