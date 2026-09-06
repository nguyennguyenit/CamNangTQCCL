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
