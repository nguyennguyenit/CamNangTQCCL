import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PUBLIC_ARTIFACTS } from "../src/lib/public-artifact-manifest.mjs";

const storageFixture = JSON.parse(
  await readFile(new URL("./fixtures/legacy-storage.json", import.meta.url), "utf8"),
);
const teamsFixture = JSON.parse(
  await readFile(new URL("../data/teams.json", import.meta.url), "utf8"),
);
/** Frozen legacy route segment for a raw original; read from the same ledger the build consumes. */
const routeHandles = JSON.parse(
  await readFile(new URL("../pipeline/team-route-handles.json", import.meta.url), "utf8"),
).handles;
const legacyRoute = (legacyTeamId) => `/doi-khac/${encodeURIComponent(routeHandles.legacy[legacyTeamId])}/`;
const khaiHoangFixture = JSON.parse(
  await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8"),
);
const khaiHoangTeams = khaiHoangFixture.teams;
/** Hai đội có selector cấu hình: đủ cho journey nhiều card cùng lúc. */
const [khaiHoangTeamA, khaiHoangTeamB] = khaiHoangTeams.filter((team) => (team.variants || []).length);
const khaiHoangRoute = (teamId) => `/khai-hoang/${encodeURIComponent(routeHandles.khaihoang[teamId])}/`;
const khaiHoangCard = (page, team) => page.locator(".kh-card").filter({
  has: page.locator(`select[aria-label="Cấu hình ${team.title}"]`),
});
async function seedKhaiHoangReturnSources(page, historyMap, sessionMap, snapshotUrl = "/#khaihoang") {
  await page.addInitScript(({historyMap, sessionMap, snapshotUrl}) => {
    const snapshot = (map) => ({
      version: 1, url: snapshotUrl, scrollY: 0, tab: "khaihoang", disclosures: {},
      ...(map === null ? {} : {khaihoangVariants: map}),
    });
    sessionStorage.setItem("tqccl:team-return:v1", JSON.stringify(snapshot(sessionMap)));
    history.replaceState({teamReturn: snapshot(historyMap)}, "", location.href);
  }, {historyMap, sessionMap, snapshotUrl});
}
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
  "team-chuan",
  "team-khac",
  "coexist",
  "khaihoang",
  "lookup",
  "recruit-tracker",
  "analyze",
  "roster-recommend",
];
const sectionPaths = {
  "team-chuan": "/doi-chuan/",
  "team-khac": "/doi-khac/",
  coexist: "/cung-ton/",
  khaihoang: "/khai-hoang/",
  lookup: "/tra-cuu/",
  "recruit-tracker": "/chieu-mo/",
  analyze: "/soi-doi/",
  "roster-recommend": "/goi-y-doi/",
};
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
  const relativePath = decodeURIComponent(
    url.pathname === "/"
      ? "index.html"
      : `${url.pathname.slice(1)}${url.pathname.endsWith("/") ? "index.html" : ""}`,
  );
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
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
  const section = await page.locator("body").getAttribute("data-page-section");
  if (section === "analyze" || section === "roster-recommend") {
    await expect(page.locator("script[src*='turnstile']")).toHaveCount(1);
  }
}

/** Ba mục Beta nằm trong menu thả "Công cụ": mở menu trước khi bấm link thật. */
const MENU_SECTIONS = ["recruit-tracker", "analyze", "roster-recommend"];
async function clickSectionLink(page, name) {
  const link = page.locator(`a[data-section="${name}"]`);
  if (MENU_SECTIONS.includes(name) && !(await link.isVisible())) await page.locator("#nav-toggle-cong-cu").click();
  await link.click();
}

async function expectActiveSection(page, name) {
  await expect(page.locator(`a[data-section="${name}"]`)).toHaveAttribute("aria-current", "page");
  await expect(page.locator("body")).toHaveAttribute("data-page-section", name);
  await expect(page.locator(".section")).toHaveCount(1);
  await expect(page.locator(".section")).toHaveAttribute("id", `section-${name}`);
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

  await page.goto("/doi-chuan/");
  await waitForBoot(page);

  await expect(page).toHaveTitle("Đội chuẩn — Cẩm Nang Game Tam Quốc Chí - Chiến Lược");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /đội hình/i);
  const appModule = page.locator('script[type="module"][src="/js/app.js"]');
  await expect(appModule).toHaveCount(1);
  await expect(page.locator("a[data-section]")).toHaveCount(sections.length);
  await expect(page.locator(".section")).toHaveCount(1);
  await expectActiveSection(page, "team-chuan");
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

test("section links navigate across pages and browser history", async ({ page }) => {
  await page.goto("/khai-hoang/");
  await waitForBoot(page);
  await expectActiveSection(page, "khaihoang");

  for (const name of sections) {
    if (name === "khaihoang") continue;
    await clickSectionLink(page, name);
    await expect(page).toHaveURL(sectionPaths[name]);
    await waitForBoot(page);
    await expectActiveSection(page, name);
  }

  await page.goBack();
  await expect(page).toHaveURL(sectionPaths.analyze);
  await expectActiveSection(page, "analyze");
  await page.goForward();
  await expect(page).toHaveURL(sectionPaths["roster-recommend"]);
  await expectActiveSection(page, "roster-recommend");

  await page.goto("/#not-a-section");
  await expect(page).toHaveURL("/#not-a-section");
  expect(await page.locator("body").getAttribute("data-page-section")).toBeNull();
  await expect(page.locator('script[type="module"][src="/js/app.js"]')).toHaveCount(0);
});
for (const [hash, destination] of [
  ["#team-chuan", "/doi-chuan/"],
  ["#team-khac", "/doi-khac/"],
  ["#team-pk", "/doi-khac/?source=team-intro"],
  ["#meta-cu", "/doi-khac/?source=moi-phe"],
  ["#coexist", "/cung-ton/"],
  ["#khaihoang", "/khai-hoang/"],
  ["#lookup", "/tra-cuu/"],
  ["#tactics", "/tra-cuu/?group=tactics"],
  ["#lookup?group=tactics", "/tra-cuu/?group=tactics"],
  ["#heroes", "/tra-cuu/?group=heroes"],
  ["#recruit-tracker", "/chieu-mo/"],
  ["#analyze", "/soi-doi/"],
  ["#roster-recommend", "/goi-y-doi/"],
]) {
  test(`legacy hash ${hash} redirects to ${destination}`, async ({ page }) => {
    await page.goto(`/${hash}`);
    await expect(page).toHaveURL(destination);
    const [name] = Object.entries(sectionPaths).find(([, path]) => destination.startsWith(path));
    await waitForBoot(page);
    await expectActiveSection(page, name);
  });
}

test("legacy query before a hash survives the Team chuẩn redirect", async ({ page }) => {
  await page.goto("/?season=s26#team-chuan");
  await expect(page).toHaveURL("/doi-chuan/?season=s26");
  await waitForBoot(page);
  await expectActiveSection(page, "team-chuan");
});

test("a legacy score query still redirects to Team chuẩn and is then retired", async ({ page }) => {
  // `score` còn trong bảng khóa root đóng băng (nhận diện URL gốc cũ) nhưng bộ lọc điểm đã bỏ,
  // nên đích chuyển tiếp là /doi-chuan/ và tham số bị xóa ngay lần replaceState đầu.
  await page.goto("/?score=113");
  await expect(page).toHaveURL("/doi-chuan/");
  await waitForBoot(page);
  await expect(page.locator("#section-team-chuan .reference-team-card").first()).toBeVisible();
  await expect(page.locator("#section-team-chuan .fgroup .flabel")).not.toContainText(["Điểm"]);
});

test("legacy lookup hash merges only supported hash keys over the outer query", async ({ page }) => {
  await page.goto("/?group=heroes&source=campaign#lookup?group=tactics&unsupported=ignored");
  await expect(page).toHaveURL(/\/tra-cuu\/\?/);
  const query = new URL(page.url()).searchParams;
  expect(query.get("group")).toBe("tactics");
  expect(query.get("source")).toBe("campaign");
  expect(query.has("unsupported")).toBe(false);
  await waitForBoot(page);
  await expect(page.locator('#section-lookup .lookup-chip[data-group="tactics"]')).toHaveAttribute("aria-pressed", "true");
});

test("a real legacy detail query reaches its dedicated source detail", async ({ page, request }) => {
  const pin = await (await request.get("/data/recommended/current.json")).json();
  const index = await (await request.get(`/data/recommended/${pin.generationId}/index.json`)).json();
  const row = index.records.find((item) => item.sourceConfigId);
  expect(row).toBeTruthy();

  await page.goto(`/?detail=${encodeURIComponent(row.sourceConfigId)}`);
  await expect(page).toHaveURL(/\/doi-chuan\/[^/?]+\/\?from=%2Fdoi-chuan%2F$/);
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await expect(page.locator("#team-detail-root")).toHaveAttribute("data-source-config-id", row.sourceConfigId);
});

test("gameplay config keeps precedence on a legacy analyze URL", async ({ page }) => {
  await page.goto("/?config=x&legacyTeam=y#analyze");
  await expect(page).toHaveURL("/soi-doi/?config=x&legacyTeam=y");
  await waitForBoot(page);
  await expectActiveSection(page, "analyze");
});

test("unknown and retired hashes stay on the Landing page", async ({ page }) => {
  for (const hash of ["#xyz", "#nguon-du-lieu", "#tai-game", "#dau-trang"]) {
    await page.goto(`/${hash}`);
    await expect(page).toHaveURL(`/${hash}`);
    expect(await page.locator("body").getAttribute("data-page-section")).toBeNull();
    await expect(page.locator('script[type="module"][src="/js/app.js"]')).toHaveCount(0);
  }
});

test("empty and unknown-only Landing queries do not enter a section", async ({ page }) => {
  for (const url of ["/", "/?utm_source=campaign&fbclid=click-id"]) {
    await page.goto(url);
    await expect(page).toHaveURL(url);
    expect(await page.locator("body").getAttribute("data-page-section")).toBeNull();
    await expect(page.locator('script[type="module"][src="/js/app.js"]')).toHaveCount(0);
  }
});

test("pasting a legacy hash on Landing redirects through hashchange", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { location.hash = "#analyze"; });
  await expect(page).toHaveURL("/soi-doi/");
  await waitForBoot(page);
  await expectActiveSection(page, "analyze");
});


test("Khai hoang selection uses its own query URL and survives detail round trips", async ({ page }) => {
  const teamA = khaiHoangTeamA;
  const teamB = khaiHoangTeamB;
  const variantA = teamA.variants[0].id;
  const variantB = teamB.variants[0].id;
  const pairFrom = (teamId, variantId) => `/khai-hoang/?khTeam=${teamId}${variantId ? `&khVariant=${variantId}` : ""}`;
  const cardA = khaiHoangCard(page, teamA);
  const cardB = khaiHoangCard(page, teamB);

  await page.goto("/khai-hoang/");
  await waitForBoot(page);
  await expect(page.locator(".kh-card")).toHaveCount(khaiHoangTeams.length);
  expect(new URL(page.url()).search).toBe("");
  // Card mặc định đã tự đủ state: `from` mang đúng cặp của chính nó và không mang query lạ nào.
  await expect(cardA.locator(".kh-detail-link")).toHaveAttribute(
    "href",
    `${khaiHoangRoute(teamA.id)}?from=${encodeURIComponent(pairFrom(teamA.id, ""))}`,
  );

  // Đổi selector ghi cặp vào URL root và dựng lại href của đúng card đó.
  await cardA.locator("select").selectOption(variantA);
  expect(new URL(page.url()).searchParams.get("khTeam")).toBe(teamA.id);
  expect(new URL(page.url()).searchParams.get("khVariant")).toBe(variantA);
  const hrefA = `${khaiHoangRoute(teamA.id)}?variant=${variantA}&from=${encodeURIComponent(pairFrom(teamA.id, variantA))}`;
  await expect(cardA.locator(".kh-title-link")).toHaveAttribute("href", hrefA);
  await expect(cardA.locator(".kh-detail-link")).toHaveAttribute("href", hrefA);
  await expect(cardB.locator(".kh-detail-link")).toHaveAttribute(
    "href",
    `${khaiHoangRoute(teamB.id)}?from=${encodeURIComponent(pairFrom(teamB.id, ""))}`,
  );

  // Primary click: URL detail mang variant và `from` an toàn, nút quay lại dùng đúng `from`.
  await cardA.locator(".kh-detail-link").click();
  await expect(page.locator("#team-detail-body")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(khaiHoangRoute(teamA.id));
  expect(new URL(page.url()).searchParams.get("variant")).toBe(variantA);
  await expect(page.locator("#team-return-link")).toHaveAttribute("href", pairFrom(teamA.id, variantA));

  // A4: chọn B rồi A, mở A bằng primary click, Back: cả hai lấy từ map của snapshot.
  await page.goBack();
  await expect(cardA.locator("select")).toHaveValue(variantA);
  await cardB.locator("select").selectOption(variantB);
  await cardA.locator("select").selectOption(variantA);
  await cardA.locator(".kh-title-link").click();
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await page.goBack();
  await expect(cardA.locator("select")).toHaveValue(variantA);
  await expect(cardB.locator("select")).toHaveValue(variantB);

  // Copy link của B rồi mở trong cùng tab: B lấy từ URL, A vẫn lấy từ map cùng context.
  const hrefB = await cardB.locator(".kh-detail-link").getAttribute("href");
  await page.goto(new URL(hrefB, page.url()).href);
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await page.locator("#team-return-link").click();
  await expect(cardB.locator("select")).toHaveValue(variantB);
  await expect(cardA.locator("select")).toHaveValue(variantA);

  // Surface khác không mang cặp Khai hoang sang query của nó, và quay lại thì cặp được phục hồi.
  await page.locator('a[data-section="coexist"]').click();
  await expect(page).toHaveURL(sectionPaths.coexist);
  await waitForBoot(page);
  await expectActiveSection(page, "coexist");
  expect(new URL(page.url()).searchParams.has("khTeam")).toBe(false);
  expect(new URL(page.url()).searchParams.has("khVariant")).toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(/\/khai-hoang\/\?khTeam=/);
  await waitForBoot(page);
  await expectActiveSection(page, "khaihoang");
  await expect.poll(() => new URL(page.url()).searchParams.get("khTeam")).toBe(teamB.id);
  await expect(cardA.locator("select")).toHaveValue(variantA);
});

test("Khai hoang restore falls back to the URL pair when session storage is denied", async ({ page }) => {
  const team = khaiHoangTeamA;
  const variant = team.variants[0].id;
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("denied"); } });
  });

  await page.goto(`/khai-hoang/?khTeam=${team.id}&khVariant=${variant}`);
  await waitForBoot(page);
  const card = khaiHoangCard(page, team);
  await expect(card.locator("select")).toHaveValue(variant);
  // Không có snapshot thì chỉ active team trên URL sống sót; card khác về mặc định.
  await expect(khaiHoangCard(page, khaiHoangTeamB).locator("select")).toHaveValue("");
  // Điều hướng vẫn hoạt động dù storage bị chặn.
  await card.locator(".kh-detail-link").click();
  await expect(page.locator("#team-detail-body")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("variant")).toBe(variant);
});

for (const snapshotUrl of ["/#khaihoang", "/khai-hoang/"]) {
  test(`Khai hoang ignores malformed or stale snapshot maps from ${snapshotUrl}`, async ({ page }) => {
    const team = khaiHoangTeamA;
    await page.addInitScript(({teamId, snapshotUrl}) => {
      sessionStorage.setItem("tqccl:team-return:v1", JSON.stringify({
        version: 1, url: snapshotUrl, scrollY: 0, tab: "khaihoang", disclosures: {},
        khaihoangVariants: { [teamId]: "variant-da-bo", "team-khong-ton-tai": "variant-la" },
      }));
    }, {teamId: team.id, snapshotUrl});

    await page.goto("/khai-hoang/");
    await waitForBoot(page);
    await expect(khaiHoangCard(page, team).locator("select")).toHaveValue("");
  });
}

for (const snapshotUrl of ["/#khaihoang", "/khai-hoang/"]) {
  test(`an invalid URL variant cannot erase a valid snapshot from ${snapshotUrl}`, async ({ page }) => {
    const team = khaiHoangTeamA;
    const saved = team.variants[0].id;
    const other = khaiHoangTeamB;
    const otherSaved = other.variants[0].id;
    await page.addInitScript(({teamId, variantId, otherId, otherVariantId, snapshotUrl}) => {
      sessionStorage.setItem("tqccl:team-return:v1", JSON.stringify({
        version: 1, url: snapshotUrl, scrollY: 0, tab: "khaihoang", disclosures: {},
        khaihoangVariants: {[teamId]: variantId, [otherId]: otherVariantId},
      }));
    }, {teamId: team.id, variantId: saved, otherId: other.id, otherVariantId: otherSaved, snapshotUrl});
    await page.goto(`/khai-hoang/?khTeam=${team.id}&khVariant=${khaiHoangTeamB.variants[0].id}`);
    await waitForBoot(page);
    await expect(khaiHoangCard(page, team).locator("select")).toHaveValue(saved);
    await expect(khaiHoangCard(page, other).locator("select")).toHaveValue(otherSaved);
    await page.goto(`/khai-hoang/?khTeam=${team.id}&khVariant=not%20routable`);
    await waitForBoot(page);
    await expect(khaiHoangCard(page, team).locator("select")).toHaveValue(saved);
    await expect(khaiHoangCard(page, other).locator("select")).toHaveValue(otherSaved);
    const validOverride = team.variants[1].id;
    await page.goto(`/khai-hoang/?khTeam=${team.id}&khVariant=${validOverride}`);
    await waitForBoot(page);
    await expect(khaiHoangCard(page, team).locator("select")).toHaveValue(validOverride);
    await expect(khaiHoangCard(page, other).locator("select")).toHaveValue(otherSaved);
    // Variant bị thiếu mới có quyền ghi đè snapshot thành build mặc định.
    await page.goto(`/khai-hoang/?khTeam=${team.id}`);
    await waitForBoot(page);
    await expect(khaiHoangCard(page, team).locator("select")).toHaveValue("");
    await expect(khaiHoangCard(page, other).locator("select")).toHaveValue(otherSaved);
  });
}

for (const snapshotUrl of ["/#khaihoang", "/khai-hoang/"]) {
  test(`a valid history map wins over a conflicting session map from ${snapshotUrl}`, async ({page}) => {
    const a = khaiHoangTeamA;
    const b = khaiHoangTeamB;
    await seedKhaiHoangReturnSources(page, {[a.id]: a.variants[0].id}, {[b.id]: b.variants[0].id}, snapshotUrl);
    await page.goto("/khai-hoang/");
    await waitForBoot(page);
    await expect(khaiHoangCard(page, a).locator("select")).toHaveValue(a.variants[0].id);
    await expect(khaiHoangCard(page, b).locator("select")).toHaveValue("");
  });
}

for (const snapshotUrl of ["/#khaihoang", "/khai-hoang/"]) {
  test(`an empty history map cannot resurrect older session selections from ${snapshotUrl}`, async ({page}) => {
    const a = khaiHoangTeamA;
    const b = khaiHoangTeamB;
    await seedKhaiHoangReturnSources(page, {}, {[a.id]: a.variants[0].id, [b.id]: b.variants[0].id}, snapshotUrl);
    await page.goto("/khai-hoang/");
    await waitForBoot(page);
    await expect(khaiHoangCard(page, a).locator("select")).toHaveValue("");
    await expect(khaiHoangCard(page, b).locator("select")).toHaveValue("");
  });
}

for (const snapshotUrl of ["/#khaihoang", "/khai-hoang/"]) {
  test(`a history snapshot without a map falls back to session state from ${snapshotUrl}`, async ({page}) => {
    const a = khaiHoangTeamA;
    const b = khaiHoangTeamB;
    await seedKhaiHoangReturnSources(page, null, {[a.id]: a.variants[0].id, [b.id]: b.variants[0].id}, snapshotUrl);
    await page.goto("/khai-hoang/");
    await waitForBoot(page);
    await expect(khaiHoangCard(page, a).locator("select")).toHaveValue(a.variants[0].id);
    await expect(khaiHoangCard(page, b).locator("select")).toHaveValue(b.variants[0].id);
  });
}

test("switching into Khai hoang refreshes each native detail link's return URL", async ({ page }) => {
  await page.goto("/doi-chuan/");
  await waitForBoot(page);
  await page.locator('a[data-section="khaihoang"]').click();
  await expect(page).toHaveURL("/khai-hoang/");
  await waitForBoot(page);
  const team = khaiHoangTeamA;
  const link = khaiHoangCard(page, team).locator(".kh-detail-link");
  const returnUrl = `/khai-hoang/?khTeam=${team.id}`;
  await expect(link).toHaveAttribute("href", new RegExp(`from=${encodeURIComponent(returnUrl)}$`));
  await link.click();
  await expect(page.locator("#team-return-link")).toHaveAttribute("href", returnUrl);
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

  await page.goto("/chieu-mo/");
  await waitForBoot(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#section-recruit-tracker")).toContainText("Sentinel Account");

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

  await clickSectionLink(page, "roster-recommend");
  await expect(page).toHaveURL("/goi-y-doi/");
  await waitForBoot(page);
  await expectActiveSection(page, "roster-recommend");
  await expect(page.locator("#section-roster-recommend")).toContainText("Sentinel Hero");
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
  await expect(page.locator("#section-roster-recommend")).toContainText("Sentinel Hero Two");
  const reloadedStorage = await page.evaluate(() => ({
    tracker: JSON.parse(localStorage.getItem("tqcclRecruitTracker")),
    roster: JSON.parse(localStorage.getItem("tqccl.rosterRecommend.scanState.v1")),
  }));
  expect(reloadedStorage.tracker.pullEvents).toHaveLength(1);
  expect(reloadedStorage.roster.ownedHeroes.map((hero) => hero.name)).toContain("Sentinel Hero Two");

  await page.goto("/chieu-mo/");
  await waitForBoot(page);
  await expect(page.locator("#section-recruit-tracker")).toContainText("Sentinel Account");
  await expect(page.locator("#section-recruit-tracker .rt-slot-miss")).toHaveCount(1);
});

test("required JSON failure is shown on its own section page", async ({ page }) => {
  await page.route("**/data/teams.json", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));

  await page.goto("/tra-cuu/");
  await waitForBoot(page);
  const error = page.locator("#section-lookup .error");
  await expect(error).toHaveText("Không thể tải dữ liệu. Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.");
  await expect(error).not.toContainText(/python3|http server|index\.html/i);
  await expectActiveSection(page, "lookup");
});

test("optional tier failure is non-fatal", async ({ page }) => {
  await page.route("**/data/team-tier.json", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));

  await page.goto("/doi-chuan/");
  await waitForBoot(page);
  await expect(page.locator("#section-team-chuan .team-card").first()).toBeVisible();
  await expect(page.locator("#section-team-chuan .error")).toHaveCount(0);
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

  await page.goto("/doi-chuan/");
  await expect(page.locator("#section-team-chuan .team-card")).toHaveCount(0);
  await expect(page.locator("#section-team-chuan .error")).toHaveCount(0);
  releaseTier();
  await expect(page.locator("#section-team-chuan .team-card").first()).toBeVisible();
});

test("Turnstile failure is surfaced only on its protected section pages", async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort("blockedbyclient"));

  await page.goto("/soi-doi/");
  await waitForBoot(page);
  await expect(page.locator("#section-analyze .ana-status")).toContainText("Không tải được Turnstile");
  await expect(page.locator("script[src*='turnstile']")).toHaveCount(1);

  await page.goto("/goi-y-doi/");
  await waitForBoot(page);
  await expect(page.locator("#section-roster-recommend .ana-turnstile")).toContainText("Không tải được Turnstile");
  await expect(page.locator("script[src*='turnstile']")).toHaveCount(1);

  await page.goto("/tra-cuu/");
  await waitForBoot(page);
  await expect(page.locator("#section-lookup")).not.toBeEmpty();
  await expect(page.locator("script[src*='turnstile']")).toHaveCount(0);
});

test("mobile menu closes after selection and Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/doi-chuan/");
  await waitForBoot(page);
  const toggle = page.locator("#section-menu-toggle");
  const overlay = page.locator("#section-menu-items");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(overlay).toBeVisible();
  await overlay.getByRole("link", { name: "Cùng Tồn", exact: true }).click();
  await expect(page).toHaveURL("/cung-ton/");
  await waitForBoot(page);
  await expect(overlay).toBeHidden();
  await expectActiveSection(page, "coexist");

  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(overlay).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("Team chuẩn search remains URL-backed and filterable", async ({ page }) => {
  await page.goto("/doi-chuan/");
  await waitForBoot(page);
  const section = page.locator("#section-team-chuan");
  const search = section.locator('input[type="search"]').first();
  await search.fill("sentinel-no-match");
  await expect(page).toHaveURL(/\/doi-chuan\/\?q=sentinel-no-match/);
  await expect(section.locator(".empty")).toContainText("Không có");
  await search.fill("");
  await expect(section.locator(".team-card").first()).toBeVisible();
});

test("opening a roster recommendation preserves its section and opens the exact original", async ({ page }) => {
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
  await page.goto("/goi-y-doi/");
  await waitForBoot(page);
  await page.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();
  const recommendation = page.locator(".roster-result-team").filter({
    has: page.getByRole("button", { name: "Mở đội", exact: true }),
  }).first();
  const selectedName = await recommendation.locator("strong").textContent();
  const selectedTeam = teamsFixture.find((team) => team.name === selectedName);
  expect(selectedTeam).toBeTruthy();

  await recommendation.getByRole("button", { name: "Mở đội", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(legacyRoute(selectedTeam.id)));
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await expect(page.locator("h1#team-detail-title")).toHaveText(selectedTeam.nickname || selectedTeam.name);
  await expect(page.locator("#team-return-link")).toHaveAttribute("href", "/goi-y-doi/");
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

  await page.goto("https://astro.local/tra-cuu/?group=heroes");
  await waitForBoot(page);
  await expectActiveSection(page, "lookup");
  // Phase 7: dữ liệu vẫn có URL `http://` (di sản), nhưng render nâng lên `https://` nên không còn mixed content.
  const legacyHttp = await page.evaluate(async () => {
    const heroes = await (await fetch('/data/heroes-dict.json')).json();
    return heroes.filter((hero) => (hero.iconUrl ?? '').startsWith('http://')).length;
  });
  expect(legacyHttp).toBeGreaterThan(0);
  await expect(page.locator("#section-lookup img[src^='http://']")).toHaveCount(0);
  await expect(page.locator("#section-lookup img[src^='https://']").first()).toBeAttached();
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

/* ===== Phase 3: header, menu thả, menu mobile, footer ===== */

const dropdownMenu = (page, key) => page.locator(`#nav-menu-${key}`);
const dropdownToggle = (page, key) => page.locator(`#nav-toggle-${key}`);

test("menu thả mở độc quyền, Escape trả focus, bấm ra ngoài và Tab ra khỏi menu đều đóng", async ({ page }) => {
  await page.goto("/doi-chuan/");
  await waitForBoot(page);
  const tools = dropdownToggle(page, "cong-cu");
  const game = dropdownToggle(page, "game");

  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "true");
  await expect(dropdownMenu(page, "cong-cu")).toBeVisible();
  await expect(tools).toBeFocused();

  await game.click();
  await expect(game).toHaveAttribute("aria-expanded", "true");
  await expect(dropdownMenu(page, "game")).toBeVisible();
  await expect(dropdownMenu(page, "cong-cu")).toBeHidden();
  await expect(tools).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("Escape");
  await expect(game).toHaveAttribute("aria-expanded", "false");
  await expect(dropdownMenu(page, "game")).toBeHidden();
  await expect(game).toBeFocused();

  await tools.click();
  await expect(dropdownMenu(page, "cong-cu")).toBeVisible();
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await expect(dropdownMenu(page, "cong-cu")).toBeHidden();

  // Bàn phím: mở bằng Enter, đi hết các mục rồi Tab ra ngoài thì menu đóng.
  await tools.focus();
  await page.keyboard.press("Enter");
  await expect(dropdownMenu(page, "cong-cu")).toBeVisible();
  for (let index = 0; index < 3; index += 1) await page.keyboard.press("Tab");
  await expect(page.locator("#nav-menu-cong-cu .nav-menu-item").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dropdownMenu(page, "cong-cu")).toBeHidden();

  // Menu thả không nuốt link: mở Game rồi bấm link nội bộ ở cột khác vẫn điều hướng bình thường.
  await game.click();
  await page.locator('a[data-section="coexist"]').click();
  await expect(page).toHaveURL("/cung-ton/");
  await waitForBoot(page);
  await expect(dropdownMenu(page, "game")).toBeHidden();
});

test("menu mobile toàn màn hình khóa cuộn nền và trả focus về ☰", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/doi-chuan/");
  await waitForBoot(page);
  const toggle = page.locator("#section-menu-toggle");
  const overlay = page.locator("#section-menu-items");

  await page.evaluate(() => window.scrollTo(0, 250));
  await toggle.click();
  await expect(overlay).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/site-menu-open/);
  await expect(page.locator(".site-menu-close")).toBeFocused();
  expect(await page.evaluate(() => {
    const before = window.scrollY;
    window.scrollBy(0, 200);
    return before === window.scrollY;
  })).toBe(true);

  // Nút sáng/tối trong đầu menu cùng một trạng thái với nút ở header.
  const headerBefore = await page.locator("#theme-toggle").getAttribute("aria-pressed");
  await page.locator("#theme-toggle-menu").click();
  await expect(page.locator("#theme-toggle")).not.toHaveAttribute("aria-pressed", headerBefore);
  expect(await page.locator("html").getAttribute("data-theme")).toBe(headerBefore === "true" ? "light" : "dark");

  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
  await expect(page.locator("html")).not.toHaveClass(/site-menu-open/);
  await expect(toggle).toBeFocused();

  await toggle.click();
  await page.locator(".site-menu-close").click();
  await expect(overlay).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("visible");
});

/** Mọi bề mặt shell: menu thả desktop, lớp phủ mobile, footer. */
const OUTBOUND_SURFACES = {desktop: ".site-nav", mobile: "#section-menu-items", footer: ".site-footer"};

test("link HTTP(S) ở cả ba bề mặt shell mở tab mới an toàn; mailto và link nội bộ thì không", async ({ page, context }) => {
  for (const path of ["/", "/doi-chuan/", "/tra-cuu/"]) {
    await page.goto(path);
    await waitForBoot(page).catch(() => {});
    const audit = await page.evaluate((surfaces) => {
      const http = (href) => /^https?:/i.test(href ?? "");
      const rows = [];
      for (const [surface, selector] of Object.entries(surfaces)) {
        for (const anchor of document.querySelectorAll(`${selector} a[href]`)) {
          rows.push({
            surface,
            href: anchor.getAttribute("href"),
            external: http(anchor.getAttribute("href")),
            target: anchor.getAttribute("target"),
            rel: anchor.getAttribute("rel") ?? "",
            indicator: Boolean(anchor.querySelector("svg[aria-hidden='true']")),
            notice: anchor.textContent.includes("(mở tab mới)"),
          });
        }
      }
      return rows;
    }, OUTBOUND_SURFACES);

    // Đúng số link HTTP(S) của từng bề mặt: 4 link chính thức + 3 cộng đồng + 3 tải game (menu),
    // và 4 + 3 ở dải footer (link CSKH là mailto nên không tính).
    expect(audit.filter((row) => row.surface === "desktop" && row.external).length).toBe(10);
    expect(audit.filter((row) => row.surface === "mobile" && row.external).length).toBe(10);
    expect(audit.filter((row) => row.surface === "footer" && row.external).length).toBe(7);

    for (const row of audit) {
      const where = `${path} ${row.surface} ${row.href}`;
      if (row.external) {
        expect(row.target, where).toBe("_blank");
        expect(row.rel, where).toContain("noopener");
        expect(row.rel, where).toContain("noreferrer");
        expect(row.notice, `${where} thiếu chữ ẩn "(mở tab mới)"`).toBe(true);
        expect(row.indicator, `${where} thiếu chỉ báo ↗`).toBe(true);
      } else {
        expect(row.target, `${where} không được mở tab mới`).toBeNull();
        expect(row.notice, `${where} không được gắn chữ ẩn mở tab mới`).toBe(false);
      }
    }

    // mailto CSKH: có chỉ báo ↗ theo artboard nhưng không target và không chữ ẩn.
    const mailto = audit.filter((row) => row.href.startsWith("mailto:"));
    expect(mailto.length).toBe(3);
    for (const row of mailto) {
      expect(row.target, row.href).toBeNull();
      expect(row.notice, row.href).toBe(false);
      expect(row.indicator, row.href).toBe(true);
    }
  }

  // Một link menu tiêu biểu: mở tab mới thật, đích do test kiểm soát (không phụ thuộc dịch vụ ngoài).
  await context.route("https://tqccl.vntth.com/**", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>popup-kiem-soat</title>ok",
  }));
  await page.goto("/");
  await page.click("#nav-toggle-game");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator('#nav-menu-game a[href="https://tqccl.vntth.com/"]').click(),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  expect(new URL(popup.url()).hostname).toBe("tqccl.vntth.com");
  expect(await popup.title()).toBe("popup-kiem-soat");
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");
  // Link trong menu vẫn để trình duyệt điều hướng và đóng menu thay đổi (disclosure).
  await expect(page.locator("#nav-menu-game")).toBeHidden();
  await expect(page.locator("#nav-toggle-game")).toHaveAttribute("aria-expanded", "false");
  await popup.close();
});

test("aria-current đúng trên cả 8 trang mục", async ({ page }) => {
  for (const name of sections) {
    await page.goto(sectionPaths[name]);
    await waitForBoot(page);
    await expectActiveSection(page, name);
    const active = page.locator(`a[data-section="${name}"]`);
    await expect(active).toHaveAttribute("aria-current", "page");
    for (const toggle of await page.locator(".nav-tab-toggle").all()) {
      if (await active.isVisible()) break;
      await toggle.click();
    }
    // Đúng một dấu "trang hiện tại" nhìn thấy được (footer và menu mobile không lặp).
    await expect(active).toBeVisible();
    await expect(page.locator('a[aria-current="page"]:visible')).toHaveCount(1);
  }
});

test("footer dùng chung có trên Landing, trang mục, trang chi tiết và 404 với cùng ngày dữ liệu", async ({ page }) => {
  const footer = page.locator(".site-footer");
  const detailPath = legacyRoute(teamsFixture[0].id);
  const dates = new Set();
  for (const path of ["/", "/doi-chuan/", detailPath, "/doi-chuan/khong-ton-tai/"]) {
    await page.goto(path);
    await waitForBoot(page).catch(() => {});
    await expect(footer).toBeVisible();
    const chip = (await footer.locator(".footer-chip").textContent()).trim();
    expect(chip).toMatch(/^Dữ liệu cập nhật \d{2}\/\d{2}\/\d{4}$/);
    dates.add(chip);
    await expect(footer).toContainText("Được xây dựng bởi");
    await expect(footer.locator('a[href="/#nguon-du-lieu"]')).toHaveCount(1);
    // Nút sáng/tối chỉ ở header; footer không còn hàng ghi chú "Nguồn dữ liệu"/"Góp ý".
    await expect(footer.locator('[data-theme-toggle]')).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Góp ý");
  }
  expect(dates.size).toBe(1);
});

test("menu mobile giữ đủ 6 dòng Tra cứu và tiêu đề nhóm là link tới /tra-cuu/", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tra-cuu/");
  await waitForBoot(page);
  await page.locator("#section-menu-toggle").click();
  const overlay = page.locator("#section-menu-items");
  await expect(overlay).toBeVisible();
  const heading = overlay.locator(".site-menu-group-link", { hasText: "Tra cứu" });
  await expect(heading).toHaveAttribute("aria-current", "page");
  await expect(heading).toHaveAttribute("href", "/tra-cuu/");
  const box = await heading.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(overlay.locator('a[href^="/tra-cuu/?group="]')).toHaveCount(6);
  // Bấm dòng con vẫn vào đúng nhóm và menu đóng lại.
  await overlay.locator('a[href="/tra-cuu/?group=tactics"]').click();
  await expect(page).toHaveURL("/tra-cuu/?group=tactics");
  await expect(page.locator("#section-menu-items")).toBeHidden();
});

test("Back/Forward cùng tài liệu đóng menu mobile và mở khóa cuộn", async ({ page }) => {
  // Cùng Tồn có điều khiển mùa hiện ở desktop; chọn mùa rồi mới sang mobile mở lớp phủ.
  await page.goto("/cung-ton/");
  await waitForBoot(page);
  const season = page.locator("#season-scenario");
  const options = await season.locator("option").evaluateAll((nodes) => nodes.map((node) => node.value));
  const first = options[0];
  const second = options.find((value) => value && value !== first);
  const seasonQuery = (value) => new RegExp(`scenario=${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

  await season.selectOption(second);
  await expect(page).toHaveURL(seasonQuery(second));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#section-menu-toggle").click();
  await expect(page.locator("#section-menu-items")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/site-menu-open/);

  await page.goBack();
  await expect(page).not.toHaveURL(seasonQuery(second));
  await expect(page.locator("#section-menu-items")).toBeHidden();
  await expect(page.locator("#section-menu-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("html")).not.toHaveClass(/site-menu-open/);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  // Cuộn nền phải dùng được lại (`scroll-behavior: smooth` nên ép `instant` để đo tức thì).
  const scrolling = await page.evaluate(() => {
    window.scrollTo({top: 0, behavior: "instant"});
    const before = window.scrollY;
    window.scrollTo({top: 240, behavior: "instant"});
    return {before, after: window.scrollY, room: document.scrollingElement.scrollHeight - window.innerHeight};
  });
  expect(scrolling.room).toBeGreaterThan(0);
  expect(scrolling.after).toBeGreaterThan(scrolling.before);

  await page.goForward();
  await expect(page).toHaveURL(seasonQuery(second));
  await expect(page.locator("#section-menu-items")).toBeHidden();
  await expect(page.locator("html")).not.toHaveClass(/site-menu-open/);

  // Đối chiếu lại giá trị mùa do URL sở hữu ở bề rộng desktop.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(season).toHaveValue(second);
  await page.goBack();
  await expect(season).toHaveValue(first);
});

test("rời trang bằng điều hướng khác tài liệu rồi quay lại không giữ lớp phủ hay khóa cuộn", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/doi-chuan/");
  await waitForBoot(page);
  await page.locator("#section-menu-toggle").click();
  await expect(page.locator("html")).toHaveClass(/site-menu-open/);

  await page.goto("/tra-cuu/");
  await waitForBoot(page);
  await page.goBack();
  await waitForBoot(page);

  await expect(page.locator("#section-menu-items")).toBeHidden();
  await expect(page.locator("#section-menu-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("html")).not.toHaveClass(/site-menu-open/);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  // Cuộn nền phải dùng được lại (`scroll-behavior: smooth` nên ép `instant` để đo tức thì).
  const scrolling = await page.evaluate(() => {
    window.scrollTo({top: 0, behavior: "instant"});
    const before = window.scrollY;
    window.scrollTo({top: 240, behavior: "instant"});
    return {before, after: window.scrollY, room: document.scrollingElement.scrollHeight - window.innerHeight};
  });
  expect(scrolling.room).toBeGreaterThan(0);
  expect(scrolling.after).toBeGreaterThan(scrolling.before);
});
