import { test, expect } from "@playwright/test";

// Đội khác chỉ có một mùa (mùa mặc định của registry): nhãn mùa tĩnh thay ô chọn, `?season=` bị bỏ qua. Danh sách là team
// (bộ 3 tướng + binh chủng) có phương án đủ dữ liệu, dựng từ phương án đại diện theo `optionRank` của builder: team đề cử
// có nhãn "Đề cử" và đứng đầu, team nhiều phương án ghi "N phương án". Đội chuẩn giữ ô chọn mùa.

const referenceData = async (request) => {
  const pin = await (await request.get("/data/recommended/current.json")).json();
  const load = async (name) => (await request.get(`/data/recommended/${pin.generationId}/${name}`)).json();
  const [seasons, other] = await Promise.all([load("seasons.json"), load("other-teams.json")]);
  return { seasons, other };
};
const seasonOf = (seasons) => seasons.seasonOptions.find((item) => item.sourceSeasonId === seasons.defaultSourceSeasonId);
/** Team có đại diện theo optionRank của đại diện, dựng thẳng từ `teamGroups` của builder. */
const teamsOf = (other) => {
  const byVariant = new Map(other.records.map((row) => [row.legacyVariantId, row]));
  return other.teamGroups
    .filter((group) => group.representativeVariantId !== null)
    .map((group) => ({ group, rep: byVariant.get(group.representativeVariantId) }))
    .sort((a, b) => a.rep.optionRank - b.rep.optionRank);
};

for (const [locale, prefix, home] of [["vi", "", "/doi-khac/"], ["zh", "/zh", "/zh/doi-khac/"]]) {
  test(`Đội khác (${locale}): nhãn mùa tĩnh lấy từ registry, không ô chọn, đủ team với mọi ?season=`, async ({ page, request }) => {
    const { seasons, other } = await referenceData(request);
    const season = seasonOf(seasons);
    const name = locale === "zh" ? season.nameRaw : season.displayNameVi;
    const section = page.locator("#section-team-khac");
    const teams = teamsOf(other);
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
      // Đếm theo team có phương án đủ dữ liệu, không theo record.
      await expect(section.locator(".reference-count")).toContainText(`/ ${teams.length}`);
    }
    // Lượt đầu: 60 team đầu theo optionRank, mỗi thẻ là đại diện của team.
    await page.goto(home);
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
    const keys = await section.locator(".reference-view [data-reference-key]").evaluateAll((nodes) => nodes.map((node) => node.dataset.referenceKey));
    expect(keys).toEqual(teams.slice(0, 60).map((item) => item.group.representativeVariantId));
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

test("Đội khác: team đề cử có nhãn Đề cử ở thẻ, thẻ gọn và bảng, đứng đầu; team nhiều phương án ghi số phương án", async ({ page, request }) => {
  const { seasons, other } = await referenceData(request);
  const teams = teamsOf(other);
  // Mẫu: hai team đề cử + sáu team thường, trong đó có team nhiều phương án; `teamGroups` xếp team thường lên trước.
  const recommended = teams.filter((item) => item.rep.recommended === true).slice(0, 2);
  const multi = teams.filter((item) => item.rep.recommended !== true && item.group.completeVariantIds.length > 1).slice(0, 2);
  const plain = teams.filter((item) => item.rep.recommended !== true && !multi.includes(item)).slice(0, 4);
  const picked = [...multi, ...plain, ...recommended];
  expect(recommended).toHaveLength(2);
  expect(multi.length).toBeGreaterThan(0);
  const ids = new Set(picked.map((item) => item.group.teamGroupId));
  const payload = { ...other, records: other.records.filter((row) => ids.has(row.teamGroupId)), teamGroups: picked.map((item) => item.group) };
  const expectedOrder = [...picked].sort((a, b) => a.rep.optionRank - b.rep.optionRank).map((item) => item.group.representativeVariantId);
  await page.goto("/doi-khac/");
  await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
  // Dựng đúng module của trang trong một mount tách rời với payload con của dữ liệu thật.
  const result = await page.evaluate(async ({ payload, registry }) => {
    const [{ createRecommendedSection }, { referenceSectionState }] = await Promise.all([
      import("/js/team-filter-section.js"),
      import("/js/recommended-reference-state.js"),
    ]);
    const mount = document.createElement("section");
    mount.id = "stub-team-khac";
    document.body.append(mount);
    const section = createRecommendedSection({ mount, family: "other", onQuery() {}, hrefFor: (row) => `/doi-khac/${row.legacyTeamId}/`, onNavigate() {} });
    const state = referenceSectionState("other", "https://x.test/doi-khac/?season=pk-s24", registry, null);
    const seen = {};
    const paint = (name, data, view) => {
      section.update(data, { ...state, view }, registry);
      seen[name] = {
        keys: [...mount.querySelectorAll(".reference-view [data-reference-key]")].map((node) => node.dataset.referenceKey),
        badges: [...mount.querySelectorAll(".reference-view .reference-recommended")].map((node) => node.textContent),
        options: [...mount.querySelectorAll(".reference-view [data-reference-key]")]
          .map((node) => [node.dataset.referenceKey, node.querySelector(".reference-option-count")?.textContent ?? null]),
        count: mount.querySelector(".reference-count")?.textContent ?? "",
        selects: mount.querySelectorAll("select").length,
        label: mount.querySelector(".reference-season-static")?.textContent ?? null,
      };
    };
    paint("bare", { ...payload, records: payload.records.map(({ recommended, ...row }) => row) }, null);
    paint("cards", payload, null);
    paint("grid", payload, "luoi");
    paint("table", payload, "bang");
    mount.remove();
    return seen;
  }, { payload, registry: seasons });

  expect(result.bare.badges).toEqual([]);
  expect(result.bare.keys).toEqual(expectedOrder);
  const optionText = new Map(picked.map((item) => [
    item.group.representativeVariantId,
    item.group.completeVariantIds.length > 1 ? `${item.group.completeVariantIds.length} phương án` : null,
  ]));
  for (const view of ["cards", "grid", "table"]) {
    const seen = result[view];
    expect(seen.selects, view).toBe(0);
    expect(seen.label, view).toContain(seasonOf(seasons).displayNameVi);
    expect(seen.badges, view).toEqual(["Đề cử", "Đề cử"]);
    expect(seen.keys, view).toEqual(expectedOrder);
    expect(new Set(seen.keys.slice(0, 2)), view).toEqual(new Set(recommended.map((item) => item.group.representativeVariantId)));
    expect(seen.options, view).toEqual(expectedOrder.map((key) => [key, optionText.get(key)]));
    expect(seen.count, view).toContain(`/ ${picked.length}`);
  }
});
