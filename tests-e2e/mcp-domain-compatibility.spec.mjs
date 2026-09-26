import { expect, test } from "@playwright/test";

async function waitForBoot(page) {
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
  const section = await page.locator("body").getAttribute("data-page-section");
  if (section === "analyze" || section === "roster-recommend") {
    await expect(page.locator("script[src*='turnstile']")).toHaveCount(1);
  }
}

test("scan được lưu/hiển thị và recommendation giữ assignment theo holder", async ({
  page,
}) => {
  await page.goto("/goi-y-doi-tu-kho/");
  await waitForBoot(page);

  const compatibility = await page.evaluate(async () => {
    const [
      { applyScanResult, createInitialRosterScanState, serializeRosterScanState },
      { mapHeroesScan },
      { recommendTeams },
      heroesDict,
      teams,
      teamTier,
    ] = await Promise.all([
      import("/js/roster-scan-state.js"),
      import("/js/roster-scan-map.js"),
      import("/js/team-recommend-engine.js"),
      fetch("/data/heroes-dict.json").then((response) => response.json()),
      fetch("/data/teams.json").then((response) => response.json()),
      fetch("/data/team-tier.json").then((response) => response.json()),
    ]);
    const target = teams.find((team) => team.id === "team-intro-1");
    const scanned = mapHeroesScan(
      { heroes: [{ nameCn: "SP荀彧", redStars: 3 }] },
      { heroesDict },
    );
    const persisted = serializeRosterScanState(
      applyScanResult(createInitialRosterScanState(), "heroes", scanned),
    );
    localStorage.setItem(
      "tqccl.rosterRecommend.scanState.v1",
      JSON.stringify(persisted),
    );

    const ownedHeroes = target.heroes.map((hero) => hero.name);
    const ownedTactics = target.heroes.flatMap((hero) =>
      hero.tactics.map((tactic) => tactic.name),
    );
    const recommendation = recommendTeams({
      teams: [target],
      teamTier,
      ownedHeroes,
      ownedTactics,
      maxTeams: 1,
      mode: "meta",
    });
    return {
      scannedHero: persisted.ownedHeroes[0],
      teamId: recommendation.portfolioTeams[0]?.team.id,
      tacticSelections: recommendation.portfolioTeams[0]?.tacticSelections,
      tacticCount: ownedTactics.length,
    };
  });

  expect(compatibility.scannedHero.name).toBe("SP Tuân Úc");
  expect(compatibility.teamId).toBe("team-intro-1");
  expect(compatibility.tacticSelections).toHaveLength(compatibility.tacticCount);
  expect(
    compatibility.tacticSelections.every(
      (selection) => selection.holderId && Number.isInteger(selection.slotIndex),
    ),
  ).toBe(true);

  await page.reload();
  await waitForBoot(page);
  await expect(page.locator("#section-roster-recommend")).toContainText("SP Tuân Úc");
});

test("analyze-map chạy trong Astro preview và đối chiếu đúng full hero identity", async ({
  page,
}) => {
  await page.goto("/soi-doi-tu-anh/");
  await waitForBoot(page);

  const result = await page.evaluate(async () => {
    const [{ mapTeamRead, findSimilarTeams }, heroesDict, tacticsDict, teams] =
      await Promise.all([
        import("/js/analyze-map.js"),
        fetch("/data/heroes-dict.json").then((response) => response.json()),
        fetch("/data/tactics.json").then((response) => response.json()),
        fetch("/data/teams.json").then((response) => response.json()),
      ]);
    const target = teams.find((team) => team.id === "team-intro-0");
    const reads = target.heroes.map((hero) => {
      const heroRecord = heroesDict.find((record) => record.viet === hero.name);
      const tacticsCn = hero.tactics.map(
        (slot) =>
          tacticsDict.find((record) => record.viet === slot.name)?.chinese ??
          slot.name,
      );
      return {
        nameCn: heroRecord?.chinese ?? hero.name,
        tacticsCn,
        booksCn: [],
        statFocusCn: "",
      };
    });
    const mapped = mapTeamRead(reads, {
      heroesDict,
      tacticsDict,
      booksDict: [],
    });
    const similar = findSimilarTeams(mapped, teams, {
      minHeroes: target.heroes.length,
      limit: 5,
    });
    return {
      mappedIds: mapped.map((entry) => entry.hero.canonicalId),
      targetId: similar[0]?.team.id,
    };
  });

  expect(result.mappedIds).toContain("hero:sp-tuan-uc");
  expect(result.mappedIds).not.toContain("hero:tuan-uc");
  expect(result.targetId).toBe("team-intro-0");
});
