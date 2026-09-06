import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PUBLIC_ARTIFACTS } from "../src/lib/public-artifact-manifest.mjs";

const storageFixture = JSON.parse(
  await readFile(new URL("./fixtures/legacy-storage.json", import.meta.url), "utf8"),
);
const teamsFixture = JSON.parse(
  await readFile(new URL("../data/teams.json", import.meta.url), "utf8"),
);
const distRoot = new URL("../dist/", import.meta.url);
const publicArtifactPaths = PUBLIC_ARTIFACTS.map(
  (artifact) => `/${artifact.kind}/${artifact.sourceBasename}`,
);
const privateProbePaths = [
  "/pipeline/build_json.py",
  "/worker/src/index.ts",
  "/tests/test_build.py",
  "/plans/260723-2127-migrate-static-spa-to-astro/plan.md",
];
const runtimeJson = [
  "teams.json",
  "coexist.json",
  "khaihoang.json",
  "tactics.json",
  "heroes-dict.json",
  "books-dict.json",
];
const sections = [
  "team-pk",
  "meta-cu",
  "coexist",
  "khaihoang",
  "heroes",
  "tactics",
  "recruit-tracker",
  "analyze",
  "roster-recommend",
];
const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/XP8W3QAAAABJRU5ErkJggg==",
  "base64",
);
const distContentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function fulfillFromDist(route) {
  const url = new URL(route.request().url());
  const relativePath = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  if (
    !relativePath
    || relativePath.split("/").some((segment) => segment === ".." || segment.includes("\\"))
  ) {
    await route.fulfill({ status: 404, body: "Not found" });
    return;
  }
  const assetUrl = new URL(relativePath, distRoot);
  if (!assetUrl.href.startsWith(distRoot.href)) {
    await route.fulfill({ status: 404, body: "Not found" });
    return;
  }
  try {
    const body = await readFile(assetUrl);
    const extension = relativePath.slice(relativePath.lastIndexOf("."));
    await route.fulfill({
      status: 200,
      contentType: distContentTypes[extension] || "application/octet-stream",
      body,
    });
  } catch {
    await route.fulfill({ status: 404, body: "Not found" });
  }
}

test.beforeEach(async ({ context }) => {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1") {
      await route.continue();
      return;
    }
    if (url.hostname === "challenges.cloudflare.com") {
      await route.fulfill({
        contentType: "application/javascript",
        body: "window.turnstile={render(){return 'fixture-widget'},reset(){}};",
      });
      return;
    }
    if (request.resourceType() === "image") {
      await route.fulfill({ contentType: "image/png", body: transparentPng });
      return;
    }
    await route.abort("blockedbyclient");
  });
});

async function waitForBoot(page) {
  await expect(page.locator("#section-team-pk .team-card").first()).toBeAttached();
  await expect(page.locator("script[src*='turnstile']")).toHaveCount(1);
}

async function expectActiveSection(page, name) {
  await expect(page.locator(`.nav-tab[data-section="${name}"]`)).toHaveClass(/\bactive\b/);
  await expect(page.locator(`#section-${name}`)).toHaveClass(/\bactive\b/);
  await expect(page.locator(".nav-tab.active")).toHaveCount(1);
  await expect(page.locator(".section.active")).toHaveCount(1);
}

test("boots once with clean first-party requests and stable metadata", async ({ page }) => {
  const firstPartyFailures = [];
  const consoleErrors = [];
  const unexpectedExternalRequests = [];
  const runtimeRequests = new Map();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.hostname !== "127.0.0.1"
      && url.hostname !== "challenges.cloudflare.com"
      && request.resourceType() !== "image"
    ) {
      unexpectedExternalRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1") {
      firstPartyFailures.push(`FAILED ${url.pathname}: ${request.failure()?.errorText || "unknown"}`);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.hostname !== "127.0.0.1") return;
    if (response.status() >= 400) firstPartyFailures.push(`${response.status()} ${url.pathname}`);
    if (url.pathname.startsWith("/data/")) {
      runtimeRequests.set(url.pathname, (runtimeRequests.get(url.pathname) || 0) + 1);
    }
  });

  await page.goto("/");
  await waitForBoot(page);

  await expect(page).toHaveTitle("Cẩm Nang Game Tam Quốc Chí - Chiến Lược");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Tổng hợp meta team/);
  const appModule = page.locator('script[type="module"]');
  await expect(appModule).toHaveCount(1);
  await expect(appModule).toHaveAttribute("src", /^(?:\.\/|\/)js\/app\.js$/);
  await expect(page.locator(".nav-tab")).toHaveCount(9);
  await expect(page.locator(".section")).toHaveCount(9);
  await expectActiveSection(page, "team-pk");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(firstPartyFailures).toEqual([]);
  expect(unexpectedExternalRequests).toEqual([]);
  for (const name of [...runtimeJson, "team-tier.json"]) {
    expect(runtimeRequests.get(`/data/${name}`)).toBe(1);
  }

  const childCounts = await page.locator(".section").evaluateAll((mounts) =>
    mounts.map((mount) => mount.childElementCount));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");

  await page.reload();
  await waitForBoot(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.locator(".section").evaluateAll((mounts) =>
    mounts.map((mount) => mount.childElementCount))).toEqual(childCounts);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(firstPartyFailures).toEqual([]);
  expect(unexpectedExternalRequests).toEqual([]);
});

test("all hash sections support direct links, clicks, back, and forward", async ({ page }) => {
  await page.goto("/#khaihoang");
  await waitForBoot(page);
  await expectActiveSection(page, "khaihoang");

  for (const name of sections) {
    await page.locator(`.nav-tab[data-section="${name}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${name}$`));
    await expectActiveSection(page, name);
  }

  await page.goBack();
  await expectActiveSection(page, "analyze");
  await page.goForward();
  await expectActiveSection(page, "roster-recommend");

  await page.goto("/#not-a-section");
  await expectActiveSection(page, "team-pk");
  await expect(page).toHaveURL(/#not-a-section$/);
});

test("legacy storage payloads survive load and sanitize forbidden roster fields on save", async ({ page }) => {
  const serialized = Object.fromEntries(
    Object.entries(storageFixture).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
  }, serialized);

  await page.goto("/#recruit-tracker");
  await waitForBoot(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#section-recruit-tracker")).toContainText("Sentinel Account");
  await expect(page.locator("#section-roster-recommend")).toContainText("Sentinel Hero");

  const before = await page.evaluate((keys) => Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  ), Object.keys(serialized));
  expect(before).toEqual(serialized);

  await page.locator("#section-recruit-tracker .rt-slot").first()
    .getByRole("button", { name: "Không ra", exact: true }).click();
  const savedTracker = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tqcclRecruitTracker")));
  expect(savedTracker.schemaVersion).toBe(1);
  expect(savedTracker.activeAccountId).toBe("acc_sentinel");
  expect(savedTracker.pullEvents).toHaveLength(1);

  await page.locator('.nav-tab[data-section="roster-recommend"]').click();
  await expectActiveSection(page, "roster-recommend");
  const heroPanel = page.locator("#section-roster-recommend .roster-review-panel").filter({
    has: page.locator("h3", { hasText: "Tướng đã đọc" }),
  });
  await heroPanel.locator('input[placeholder="Thêm thủ công"]').fill("Sentinel Hero Two");
  await heroPanel.getByRole("button", { name: "Thêm", exact: true }).click();

  const savedRoster = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tqccl.rosterRecommend.scanState.v1")));
  expect(savedRoster.ownedHeroes.map((hero) => hero.name)).toContain("Sentinel Hero Two");
  expect(JSON.stringify(savedRoster)).not.toContain("imageDataUrl");
  expect(JSON.stringify(savedRoster)).not.toContain("turnstileToken");

  await page.reload();
  await waitForBoot(page);
  await expect(page.locator("#section-recruit-tracker")).toContainText("Sentinel Account");
  await expect(page.locator("#section-recruit-tracker .rt-slot-miss")).toHaveCount(1);
  await expect(page.locator("#section-roster-recommend")).toContainText("Sentinel Hero Two");
  const reloadedStorage = await page.evaluate(() => ({
    tracker: JSON.parse(localStorage.getItem("tqcclRecruitTracker")),
    roster: JSON.parse(localStorage.getItem("tqccl.rosterRecommend.scanState.v1")),
  }));
  expect(reloadedStorage.tracker.pullEvents).toHaveLength(1);
  expect(reloadedStorage.roster.ownedHeroes.map((hero) => hero.name)).toContain("Sentinel Hero Two");
});

test("required JSON failure stays in Team PK and can remain hidden on another hash", async ({ page }) => {
  await page.route("**/data/teams.json", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));

  await page.goto("/#heroes");
  const error = page.locator("#section-team-pk .error");
  await expect(error).toContainText("Lỗi tải dữ liệu: ./data/teams.json: 503");
  await expect(error).toContainText("Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn");
  await expect(error).not.toContainText(/python3|http server|index\.html/i);
  await expectActiveSection(page, "heroes");
  await expect(error).toBeHidden();
  await expect(page.locator("#section-heroes")).toBeEmpty();
});

test("optional tier failure is non-fatal", async ({ page }) => {
  await page.route("**/data/team-tier.json", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));

  await page.goto("/");
  await expect(page.locator("#section-team-pk .team-card").first()).toBeVisible();
  await expect(page.locator("#section-team-pk .error")).toHaveCount(0);
});

test("a hanging optional tier request retains the legacy blocked-render behavior", async ({ page }) => {
  let releaseTier;
  const tierGate = new Promise((resolve) => {
    releaseTier = resolve;
  });
  await page.route("**/data/team-tier.json", async (route) => {
    await tierGate;
    await route.abort("timedout");
  });

  await page.goto("/");
  await expect(page.locator("#section-team-pk .team-card")).toHaveCount(0);
  await expect(page.locator("#section-team-pk .error")).toHaveCount(0);
  releaseTier();
  await expect(page.locator("#section-team-pk .team-card").first()).toBeVisible();
});

test("Turnstile failure does not break local sections or duplicate its script", async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort("blockedbyclient"));

  await page.goto("/#analyze");
  await expect(page.locator("#section-team-pk .team-card").first()).toBeAttached();
  await expect(page.locator("#section-analyze .ana-status")).toContainText("Không tải được Turnstile");
  await expect(page.locator("#section-roster-recommend .ana-turnstile")).toContainText("Không tải được Turnstile");
  await expect(page.locator("script[src*='turnstile']")).toHaveCount(1);

  await page.locator('.nav-tab[data-section="heroes"]').click();
  await expect(page.locator("#section-heroes")).not.toBeEmpty();
});

test("mobile section menu closes after selection and Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForBoot(page);
  const toggle = page.locator("#section-menu-toggle");
  const nav = page.locator(".section-nav");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(nav).toHaveClass(/\bopen\b/);
  await page.locator('.nav-tab[data-section="coexist"]').click();
  await expect(nav).not.toHaveClass(/\bopen\b/);
  await expectActiveSection(page, "coexist");

  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).not.toHaveClass(/\bopen\b/);
});

test("team search remains a local interaction", async ({ page }) => {
  await page.goto("/#team-pk");
  await waitForBoot(page);
  const section = page.locator("#section-team-pk");
  const search = section.locator('input[type="search"]').first();

  await search.fill("sentinel-no-match");
  await expect(section.locator(".empty")).toContainText("Không có");
  await search.fill("");
  await expect(section.locator(".team-card").first()).toBeVisible();
});

test("opening a roster recommendation selects its source tab and hero search", async ({ page }) => {
  const seedTeams = teamsFixture.slice(0, 20);
  const rosterState = {
    ownedHeroes: [...new Set(seedTeams.flatMap((team) =>
      team.heroes.map((hero) => hero.name || hero.baseName)))].map((name) => ({ name })),
    ownedTactics: [...new Set(seedTeams.flatMap((team) =>
      team.heroes.flatMap((hero) => hero.tactics.map((tactic) => tactic.name))))].map((name) => ({ name })),
    lockedTeams: [],
    confirmed: true,
    updatedAt: "2026-07-25T00:00:00.000Z",
  };
  await page.addInitScript((state) => {
    localStorage.setItem("tqccl.rosterRecommend.scanState.v1", JSON.stringify(state));
  }, rosterState);
  await page.addInitScript(() => {
    window.__scrollCalls = [];
    window.scrollTo = (...args) => window.__scrollCalls.push(args);
  });

  await page.goto("/#roster-recommend");
  await waitForBoot(page);
  await page.getByRole("button", { name: "Gợi ý 5 team", exact: true }).click();
  const recommendation = page.locator(".roster-result-team").filter({
    has: page.getByRole("button", { name: "Mở team", exact: true }),
  }).first();
  const selectedName = await recommendation.locator("strong").textContent();
  const selectedTeam = teamsFixture.find((team) => team.name === selectedName);
  expect(selectedTeam).toBeTruthy();

  await recommendation.getByRole("button", { name: "Mở team", exact: true }).click();
  const expectedSection = {
    "moi-phe": "meta-cu",
    "team-intro": "team-pk",
  }[selectedTeam.source] || "team-pk";
  await expectActiveSection(page, expectedSection);
  await expect(page.locator(`#section-${expectedSection} input[type="search"]`).first())
    .toHaveValue(selectedTeam.heroes[0].baseName);
  await expect.poll(() => page.evaluate(() => window.__scrollCalls.at(-1))).toEqual([
    { top: 0, behavior: "smooth" },
  ]);
});

test("local preview serves approved artifacts and excludes private source paths", async ({ request }) => {
  for (const path of ["/", ...publicArtifactPaths]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
  for (const path of privateProbePaths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test("synthetic HTTPS serves dist locally and characterizes legacy HTTP icons", async ({ page }) => {
  const externalImageRequests = [];
  await page.route("https://astro.local/**", fulfillFromDist);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "astro.local" && request.resourceType() === "image") {
      externalImageRequests.push(url);
    }
  });

  await page.goto("https://astro.local/#heroes");
  await waitForBoot(page);
  await expectActiveSection(page, "heroes");
  const icon = page.locator("#section-heroes img[src^='http://']").first();
  await expect(icon).toBeAttached();
  await expect.poll(() => externalImageRequests.length).toBeGreaterThan(0);
  expect(externalImageRequests.every((url) => url.protocol === "https:")).toBe(true);

  const exposure = await page.evaluate(async ({ publicPaths, privatePaths }) => {
    const probe = async (path) => {
      const response = await fetch(path);
      return [path, response.status, await response.text()];
    };
    return {
      publicResults: await Promise.all(publicPaths.map(probe)),
      privateResults: await Promise.all(privatePaths.map(probe)),
    };
  }, { publicPaths: publicArtifactPaths, privatePaths: privateProbePaths });
  expect(exposure.publicResults.every(([, status]) => status === 200)).toBe(true);
  expect(exposure.privateResults.every(([, status, body]) =>
    status === 404 && body === "Not found")).toBe(true);

  for (const escapedPath of ["//etc/hosts", "/%252e%252e/package.json"]) {
    const response = await page.goto(`https://astro.local${escapedPath}`);
    expect(response.status()).toBe(404);
    await expect(page.locator("body")).toHaveText("Not found");
  }
});
