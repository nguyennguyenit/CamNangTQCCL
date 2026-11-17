import { test, expect } from "@playwright/test";

// Đội khác chỉ có một mùa (mùa mặc định của registry): nhãn mùa tĩnh thay ô chọn, `?season=` bị bỏ qua, hàng đề cử
// (`recommended`) có nhãn "Đề cử" và đứng đầu. Đội chuẩn giữ ô chọn mùa.

const referenceData = async (request) => {
  const pin = await (await request.get("/data/recommended/current.json")).json();
  const load = async (name) => (await request.get(`/data/recommended/${pin.generationId}/${name}`)).json();
  const [seasons, other] = await Promise.all([load("seasons.json"), load("other-teams.json")]);
  return { seasons, other };
};
const seasonOf = (seasons) => seasons.seasonOptions.find((item) => item.sourceSeasonId === seasons.defaultSourceSeasonId);

for (const [locale, prefix, home] of [["vi", "", "/doi-khac/"], ["zh", "/zh", "/zh/doi-khac/"]]) {
  test(`Đội khác (${locale}): nhãn mùa tĩnh lấy từ registry, không ô chọn, đủ đội với mọi ?season=`, async ({ page, request }) => {
    const { seasons, other } = await referenceData(request);
    const season = seasonOf(seasons);
    const name = locale === "zh" ? season.nameRaw : season.displayNameVi;
    const section = page.locator("#section-team-khac");
    for (const query of ["", "?season=pk-s24", "?season=khong-ton-tai", "?season=all", "?season=unknown"]) {
      await page.goto(`${home}${query}`);
      await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
      const label = section.locator(".reference-season-static");
      await expect(label).toHaveCount(1);
      await expect(label).toContainText(`${locale === "zh" ? "赛季" : "Mùa"} ${name}`);
      await expect(section.locator("select")).toHaveCount(0);
      await expect(section.locator(".reference-notice")).toBeHidden();
      await expect(section.locator(".reference-empty")).toBeHidden();
      await expect(section.locator(".reference-team-card").first()).toBeVisible();
      await expect(section.locator(".reference-count")).toContainText(`/ ${other.records.length}`);
    }
    // Link chi tiết không mang season của Đội khác vào URL quay lại.
    await page.goto(`${home}?season=pk-s24&q=`);
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
    const href = await section.locator("a[data-team-detail-link]").first().getAttribute("href");
    expect(href).not.toContain("season");
    expect(href.startsWith(`${prefix}/doi-khac/`)).toBe(true);
  });
}

test("Đội chuẩn vẫn có ô chọn mùa, Đội khác không", async ({ page, request }) => {
  const { seasons } = await referenceData(request);
  await page.goto("/doi-chuan/");
  await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
  const select = page.locator("#section-team-chuan").getByLabel("Mùa", { exact: true });
  await expect(select).toBeVisible();
  await expect(select).toHaveValue(seasons.defaultSourceSeasonId);
  await expect(page.locator("#section-team-chuan .reference-season-static")).toHaveCount(0);
});

test("Đội khác: hàng recommended có nhãn Đề cử ở thẻ, thẻ gọn và bảng, đứng đầu; field vắng thì không nhãn", async ({ page, request }) => {
  const { seasons, other } = await referenceData(request);
  await page.goto("/doi-khac/");
  await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
  // Dựng đúng module của trang trong một mount tách rời với dữ liệu giả lập (field mới gắn có kiểm soát).
  const result = await page.evaluate(async ({ rows, registry }) => {
    const [{ createRecommendedSection }, { referenceSectionState }] = await Promise.all([
      import("/js/team-filter-section.js"),
      import("/js/recommended-reference-state.js"),
    ]);
    const mount = document.createElement("section");
    mount.id = "stub-team-khac";
    document.body.append(mount);
    const section = createRecommendedSection({ mount, family: "other", onQuery() {}, hrefFor: () => null, onNavigate() {} });
    const state = referenceSectionState("other", "https://x.test/doi-khac/?season=pk-s24", registry, null);
    const keys = () => [...mount.querySelectorAll(".reference-view [data-reference-key]")].map((node) => node.dataset.referenceKey);
    const seen = {};
    const paint = (name, data, view) => {
      section.update(data, { ...state, view }, registry);
      seen[name] = {
        keys: keys(),
        badges: [...mount.querySelectorAll(".reference-view .reference-recommended")].map((node) => node.textContent),
        selects: mount.querySelectorAll("select").length,
        label: mount.querySelector(".reference-season-static")?.textContent ?? null,
      };
    };
    const flagged = new Set(rows.slice(-2).map((row) => row.legacyVariantId));
    const marked = rows.map((row) => ({ ...row, sourceSeasonIds: [registry.defaultSourceSeasonId], recommended: flagged.has(row.legacyVariantId) }));
    paint("bare", rows, null);
    paint("cards", marked, null);
    paint("grid", marked, "luoi");
    paint("table", marked, "bang");
    mount.remove();
    return { seen, flagged: [...flagged], bareOrder: seen.bare.keys };
  }, {
    // Generation thật đã mang `recommended`/`sourceSeasonIds`: bỏ hai field để có mẫu "field vắng", rồi gắn lại có kiểm soát.
    rows: other.records.slice(0, 8).map(({ recommended, sourceSeasonIds, ...row }) => row),
    registry: seasons,
  });

  expect(result.seen.bare.badges).toEqual([]);
  for (const view of ["cards", "grid", "table"]) {
    const seen = result.seen[view];
    expect(seen.selects, view).toBe(0);
    expect(seen.label, view).toContain(seasonOf(seasons).displayNameVi);
    expect(seen.badges, view).toEqual(["Đề cử", "Đề cử"]);
    expect(new Set(seen.keys.slice(0, 2)), view).toEqual(new Set(result.flagged));
    // Phần còn lại giữ thứ tự cũ.
    expect(seen.keys.slice(2), view).toEqual(result.bareOrder.filter((key) => !result.flagged.includes(key)));
  }
});
