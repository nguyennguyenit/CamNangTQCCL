import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const data = JSON.parse(await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8"));

test.beforeEach(async ({ context }) => {
  await context.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue() : route.abort());
});

test("every source option replaces only its card and restores the default", async ({ page }) => {
  await page.goto("/#khaihoang");
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  await expect(page.locator(".kh-season-context")).toContainText("Binh Diễn Xuân Thu");
  for (const [index, team] of data.teams.entries()) {
    const card = page.locator(".kh-card").nth(index);
    const initial = await card.locator(".kh-build").textContent();
    const next = page.locator(".kh-card").nth((index + 1) % data.teams.length);
    const neighbor = await next.textContent();
    const select = card.getByRole("combobox");
    await expect(select).toHaveCount(team.variants?.length ? 1 : 0);
    for (const variant of team.variants || []) {
      await select.selectOption(variant.id);
      await expect(card.locator(".kh-build-context")).toContainText(variant.period);
      await expect(card.locator(".kh-build-note")).toHaveText(variant.note);
      await expect(card.locator(".card-head .badge")).toHaveText(variant.unitType);
      await expect(card.locator(".kh-transforms")).toHaveCount(0);
      for (const [i, hero] of variant.heroes.entries()) {
        const row = card.locator(".hero").nth(i);
        await expect(row.locator(".hn")).toHaveText(hero.name);
        await expect(row.locator(".tag")).toHaveText([hero.tacticBefore, ...(hero.tacticsAfter || [])].filter(Boolean));
        await expect(row.locator(".kh-label")).toHaveText([
          hero.tacticBefore ? "Trước" : null, hero.tacticsAfter?.length ? "Sau" : null,
        ].filter(Boolean));
      }
      for (const source of variant.sources) {
        await expect(card.getByRole("link", { name: source.label, exact: true })).toHaveAttribute("href", source.url);
      }
      await expect(next).toHaveText(neighbor);
    }
    if (team.variants?.length) {
      await select.selectOption("");
      await expect(card.locator(".kh-build")).toHaveText(initial);
    }
  }
});

test("source selection works with keyboard on mobile without overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/#khaihoang");
  const select = page.getByRole("combobox", { name: `Cấu hình ${data.teams[0].title}`, exact: true });
  await select.focus();
  // Native select type-ahead also works in macOS headless Chromium without a popup menu.
  await page.keyboard.press("c");
  await expect(select).toHaveValue(data.teams[0].variants[0].id);
  await expect(select).toBeFocused();
  await expect(page.locator(".kh-card").first().locator(".kh-build-note")).toHaveText(data.teams[0].variants[0].note);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".kh-card").first().screenshot({ path: testInfo.outputPath("mobile-option.png") });
});

// Right-hand groups from source-260906-1413-khaihoang-google-sheet.csv,
// rows 21–22 and 30–31; alternatives span the first pair in the HTML source.
const chamSuTeams = [
  {
    id: "lu-mong-gia-hu", title: "Lữ Mông – Giả Hủ",
    heroes: [{ name: "Lữ Mông", tactic: "Bạch Mã Nghĩa Tòng" }, { name: "Giả Hủ", tactic: "Ngụy Thư Tương Gian" }],
    note: "mang 1 lính. Tướng thay thế: Điêu Thuyền, Hoàng Cái, Phùng Kỷ.",
  },
  {
    id: "ton-thuong-huong-lang-thong", title: "Tôn Thượng Hương – Lăng Thống",
    heroes: [{ name: "Tôn Thượng Hương", tactic: "Lõa Y Huyết Chiến" }, { name: "Lăng Thống", tactic: "Phong Thi Trận" }],
    note: "mang 1 lính",
  },
].map((team) => ({ ...team, sources: [{
  label: "Bảng Khai hoang", url: "https://docs.google.com/spreadsheets/d/1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw/edit#gid=562317106",
}] }));

async function routeKhaihoang(page, payload) {
  await page.route("**/data/khaihoang.json*", (route) => route.fulfill({ json: payload }));
  await page.goto("/#khaihoang");
}

for (const width of [1280, 375]) {
  test(`standalone Chạm Sứ groups preserve source content and order at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 812 });
    await routeKhaihoang(page, { ...data, chamSuTeams });
    await expect(page.getByRole("heading", { name: "Team Chạm Sứ / Ăn vạ", exact: true })).toBeVisible();
    await expect(page.locator(".kh-section-title")).toHaveText([
      "Đội hình khai hoang đề xuất", "Team Chạm Sứ / Ăn vạ", "Quân thủ các mỏ",
    ]);
    await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
    await expect(page.locator(".cham-su-card")).toHaveCount(chamSuTeams.length);
    await expect(page.getByText("Chuyển hình đề xuất", { exact: true })).toHaveCount(0);
    for (const [index, team] of chamSuTeams.entries()) {
      const card = page.locator(".cham-su-card").nth(index);
      await expect(card.getByRole("heading")).toHaveText(team.title);
      await expect(card.locator(".hn")).toHaveText(team.heroes.map((hero) => hero.name));
      await expect(card.locator(".tag")).toHaveText(team.heroes.map((hero) => hero.tactic));
      await expect(card.locator(".kh-build-note")).toHaveText(team.note);
      await expect(card.getByRole("combobox")).toHaveCount(0);
      await expect(card.locator(".kh-label, .badge.unit")).toHaveCount(0);
      const link = card.getByRole("link", { name: team.sources[0].label, exact: true });
      await expect(link).toHaveAttribute("href", team.sources[0].url);
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator(".cham-su-card").first().screenshot({ path: testInfo.outputPath(`cham-su-${width}.png`) });
  });
}

for (const shape of ["missing", "empty", "legacy"]) {
  test(`Khai hoang supports ${shape} Chạm Sứ data`, async ({ page }) => {
    const { chamSuTeams: ignored, ...withoutChamSu } = data;
    const payload = shape === "legacy" ? data.mines
      : shape === "empty" ? { ...withoutChamSu, chamSuTeams: [] } : withoutChamSu;
    await routeKhaihoang(page, payload);
    await expect(page.getByRole("heading", { name: "Quân thủ các mỏ", exact: true })).toBeVisible();
    await expect(page.locator(".mine")).toHaveCount(data.mines.length);
    await expect(page.locator(".kh-card")).toHaveCount(shape === "legacy" ? 0 : data.teams.length);
    await expect(page.getByRole("heading", { name: "Team Chạm Sứ / Ăn vạ", exact: true })).toHaveCount(0);
    await expect(page.locator(".cham-su-card")).toHaveCount(0);
    await expect(page.getByText("Chuyển hình đề xuất", { exact: true })).toHaveCount(0);
  });
}
