import { describe, expect, it } from "vitest";

import { context, refreshConfigProofs, seasonConsumerFixture } from "../../../tests-js/fixtures/season-fixtures.mjs";
import { createDataManifest, validateDataSnapshot, type ArtifactName } from "../../src/data/artifact-contracts.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";
import { repositoryDataRoot } from "../fixtures/publication-sources.js";
import { realHandlers, realPublication } from "../fixtures/real-handlers.js";
import { seasonalHandlers } from "../fixtures/season-handlers.js";

const handlers = realHandlers();

const publication = realPublication;

describe("tqccl_find_teams collections", () => {
  it("lists each collection with selectors, source scope and raw tier/score", async () => {
    const pub = await publication();
    const counts = Object.fromEntries(pub.seasons.collections.map((entry) => [entry.id, entry.count]));
    for (const collection of ["recommended", "other", "khaihoang", "engine"] as const) {
      const result = await handlers.call("tqccl_find_teams", { collection, limit: 5 });
      expect(result.collection).toBe(collection);
      expect(result.total).toBe(counts[collection]);
      expect(result.items.length).toBeGreaterThan(0);
      for (const item of result.items) {
        expect(item.reference.collection).toBe(collection);
        if (collection !== "engine") expect(item.pagePath).toMatch(/^\/(doi-chuan|doi-khac|khai-hoang)\//u);
        else expect(item.pagePath).toBeUndefined();
      }
    }
    const recommended = await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 3 });
    expect(recommended.items[0]).toMatchObject({
      sourceSeasonId: expect.any(String),
      sourceCategoryId: expect.any(String),
      tierRaw: expect.any(String),
      score: expect.any(Number),
      reference: { collection: "recommended", sourceConfigId: expect.any(String) },
    });
    const zh = await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 1, locale: "zh" });
    expect(zh.items[0]?.pagePath).toBe(`/zh${recommended.items[0]?.pagePath}`);
  });

  it("validates sourceSeasonId against the registry and filters recommended by season", async () => {
    const pub = await publication();
    const season = pub.seasons.seasonOptions.find((option) => pub.teams.some((team) => team.sourceSeasonId === option.sourceSeasonId))!;
    const result = await handlers.call("tqccl_find_teams", { collection: "recommended", sourceSeasonId: season.sourceSeasonId, limit: 50 });
    expect(result.total).toBe(pub.teams.filter((team) => team.collection === "recommended" && team.sourceSeasonId === season.sourceSeasonId).length);
    expect(result.items.every((item) => item.sourceSeasonId === season.sourceSeasonId)).toBe(true);
    await expect(handlers.call("tqccl_find_teams", { collection: "recommended", sourceSeasonId: "khong-co-mua" })).rejects.toMatchObject({ code: "REFERENCE_SCOPE_INVALID", fields: ["sourceSeasonId"], retryable: false });
    await expect(handlers.call("tqccl_find_teams", { collection: "recommended", sourceCategoryId: "khong-co-nhom" })).rejects.toMatchObject({ code: "REFERENCE_SCOPE_INVALID" });
  });

  it("rejects season/category scope on collections without a registry", async () => {
    const pub = await publication();
    const sourceSeasonId = pub.seasons.defaultSourceSeasonId;
    const sourceCategoryId = pub.seasons.categories[0]!.sourceCategoryId;
    for (const collection of ["khaihoang", "other", "engine"] as const) {
      await expect(handlers.call("tqccl_find_teams", { collection, sourceSeasonId })).rejects.toMatchObject({ code: "REFERENCE_SCOPE_INVALID" });
      await expect(handlers.call("tqccl_find_teams", { collection, sourceCategoryId })).rejects.toMatchObject({ code: "REFERENCE_SCOPE_INVALID" });
    }
    await expect(handlers.call("tqccl_find_teams", { collection: "recommended", seasonContext: { scenarioId: "a", rulesetId: "b" } })).rejects.toMatchObject({ code: "REFERENCE_SCOPE_INVALID" });
  });

  it("matches a roster by holder with minHeroes like the old match tool", async () => {
    const pub = await publication();
    const team = pub.teams.find((candidate) => candidate.collection === "recommended" && candidate.heroes.every((hero) => hero.heroId && hero.tactics.every((tactic) => tactic.tacticId)))!;
    const roster = team.heroes.map((hero) => ({ canonicalId: hero.heroId!, tacticIds: hero.tactics.map((tactic) => tactic.tacticId!) }));
    const result = await handlers.call("tqccl_find_teams", { collection: "recommended", heroes: roster, limit: 10 });
    expect(result.items[0]).toMatchObject({ heroHit: 3, tacticHit: 6, total: 3 });
    expect(result.items.map((item) => item.ref)).toContain(team.ref);
    for (let i = 1; i < result.items.length; i += 1) {
      const [a, b] = [result.items[i - 1]!, result.items[i]!];
      expect(a.heroHit! > b.heroHit! || (a.heroHit === b.heroHit && a.tacticHit! >= b.tacticHit!)).toBe(true);
    }
    // Chiến pháp đặt sai holder không được tính.
    const swapped = [
      { canonicalId: roster[0]!.canonicalId, tacticIds: roster[1]!.tacticIds },
      { canonicalId: roster[1]!.canonicalId, tacticIds: roster[0]!.tacticIds },
      roster[2]!,
    ];
    const wrong = await handlers.call("tqccl_find_teams", { collection: "recommended", heroes: swapped, limit: 50 });
    expect(wrong.items.find((item) => item.ref === team.ref)?.tacticHit).toBeLessThan(6);
    const one = await handlers.call("tqccl_find_teams", { collection: "recommended", heroes: roster.slice(0, 1) });
    expect(one.total).toBe(0);
    const loosened = await handlers.call("tqccl_find_teams", { collection: "recommended", heroes: roster.slice(0, 1), minHeroes: 1, limit: 50 });
    expect(loosened.total).toBeGreaterThan(0);
  });

  it("matches engine teams through the legacy matcher", async () => {
    const pub = await publication();
    const engine = (await handlers.call("tqccl_find_teams", { collection: "engine", limit: 1 })).items[0]!;
    const hero = engine.heroes.find((entry) => entry.heroId)!;
    const result = await handlers.call("tqccl_find_teams", {
      collection: "engine",
      heroes: engine.heroes.filter((entry) => entry.heroId).map((entry) => ({ canonicalId: entry.heroId!, tacticIds: entry.tactics.flatMap((tactic) => (tactic.tacticId ? [tactic.tacticId] : [])) })),
    });
    expect(hero.heroId).toBeTruthy();
    expect(result.items.map((item) => item.reference.teamId)).toContain(engine.reference.teamId);
    expect(pub.seasons.collections.find((entry) => entry.id === "engine")?.count).toBeGreaterThan(0);
  });

  it("pages with cursors without losing items and bounds the result size", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    let workflowVersion: string | undefined;
    let total = 0;
    do {
      const page = await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 50, ...(cursor ? { cursor, expectedWorkflowVersion: workflowVersion } : {}) });
      expect(JSON.stringify(page).length).toBeLessThan(40_000);
      seen.push(...page.items.map((item) => item.ref));
      workflowVersion = page.workflowVersion;
      cursor = page.nextCursor;
      total = page.total;
    } while (cursor);
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
    await expect(handlers.call("tqccl_find_teams", { collection: "other", limit: 50, cursor: "e30=", expectedWorkflowVersion: workflowVersion })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
  });

  it("refuses to reuse a cursor in another collection or filter", async () => {
    const first = await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 2 });
    const reuse = { limit: 2, cursor: first.nextCursor, expectedWorkflowVersion: first.workflowVersion };
    await expect(handlers.call("tqccl_find_teams", { collection: "other", ...reuse })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    await expect(handlers.call("tqccl_find_teams", { collection: "recommended", query: "x", ...reuse })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    await expect(handlers.call("tqccl_search", { query: "", ...reuse })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
  });
});

describe("tqccl_get_team", () => {
  it("reads a recommended config with every slot, alternatives fields, page paths and source score", async () => {
    const list = await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 1 });
    const detail = await handlers.call("tqccl_get_team", { reference: list.items[0]!.reference });
    const team = detail.team!;
    expect(team.reference).toEqual(list.items[0]!.reference);
    expect(team.heroes).toHaveLength(3);
    for (const hero of team.heroes) {
      expect(hero.tactics).toHaveLength(2);
      expect(hero.books).toHaveLength(3);
    }
    expect(team.pagePath).toBe(list.items[0]!.pagePath);
    expect(team.sourceScore).toMatchObject({ value: list.items[0]!.score, tierRaw: list.items[0]!.tierRaw, scope: "unmodified-original" });
    expect(detail.sections?.find((entry) => entry.name === "notes")?.total).toBeGreaterThan(0);
  });

  it("reads other variants with per-slot alternatives and tactic page paths", async () => {
    const pub = await publication();
    const ref = pub.teams.filter((team) => team.collection === "other").find((team) => {
      const detail = pub.getTeam(team.ref) as unknown as { variants: Array<{ resolved: { heroes: Array<{ tactics: Array<{ alternatives: unknown[] }> }> } }> };
      return detail.variants[0]!.resolved.heroes.some((hero) => hero.tactics.some((tactic) => tactic.alternatives.length > 0));
    })!;
    const list = await handlers.call("tqccl_find_teams", { collection: "other", query: ref.nameVi, limit: 50 });
    const item = list.items.find((entry) => entry.ref === ref.ref)!;
    const detail = await handlers.call("tqccl_get_team", { reference: item.reference });
    const tactics = detail.team!.heroes.flatMap((hero) => hero.tactics);
    expect(tactics.some((tactic) => (tactic.alternatives ?? []).length > 0)).toBe(true);
    expect(tactics.every((tactic) => tactic.tacticId === null || typeof tactic.pagePath === "string")).toBe(true);
    expect(detail.team!.sourceScore).toBeUndefined();
  });

  it("exposes scrub-safe variant ids for other and accepts both short and full forms", async () => {
    const pub = await publication();
    const team = pub.teams.find((candidate) => candidate.collection === "other")!;
    const full = (pub.getTeam(team.ref) as unknown as { variants: Array<{ variantId: string }> }).variants[0]!.variantId;
    const listed = await handlers.call("tqccl_find_teams", { collection: "other", query: team.nameVi, limit: 50 });
    const item = listed.items.find((entry) => entry.ref === team.ref)!;
    expect(item.reference.legacyVariantId).toBe(full.slice(0, 26));
    expect(JSON.stringify(listed.items)).not.toMatch(/[a-f0-9]{64}/u);
    const short = await handlers.call("tqccl_get_team", { reference: item.reference });
    const long = await handlers.call("tqccl_get_team", { reference: { ...item.reference, legacyVariantId: full } });
    expect(long.team).toEqual(short.team);
  });

  it("reads khaihoang with notes and variants sections instead of truncating", async () => {
    const list = await handlers.call("tqccl_find_teams", { collection: "khaihoang", limit: 50 });
    let withVariants = 0;
    for (const item of list.items) {
      const overview = await handlers.call("tqccl_get_team", { reference: item.reference });
      expect(overview.team!.heroes).toHaveLength(3);
      const variants = overview.sections!.find((entry) => entry.name === "variants");
      if (!variants) continue;
      withVariants += 1;
      const collected: unknown[] = [];
      let cursor: string | undefined;
      do {
        const page = await handlers.call("tqccl_get_team", { reference: item.reference, section: "variants", limit: 1, ...(cursor ? { cursor, expectedWorkflowVersion: overview.workflowVersion } : {}) });
        expect(page.total).toBe(variants.total);
        collected.push(...page.variants!);
        cursor = page.nextCursor;
      } while (cursor);
      expect(collected).toHaveLength(variants.total);
    }
    expect(withVariants).toBeGreaterThan(0);
  });

  it("reads an engine team and uses REFERENCE_NOT_FOUND / INVALID_REQUEST for bad selectors", async () => {
    const list = await handlers.call("tqccl_find_teams", { collection: "engine", limit: 1 });
    const detail = await handlers.call("tqccl_get_team", { reference: list.items[0]!.reference });
    expect(detail.team!.heroes.length).toBeGreaterThan(0);
    await expect(handlers.call("tqccl_get_team", { reference: { collection: "engine", teamId: "khong-co" } })).rejects.toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    await expect(handlers.call("tqccl_get_team", { reference: { collection: "recommended", sourceConfigId: "khong-co" } })).rejects.toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    await expect(handlers.call("tqccl_get_team", { reference: { collection: "other", legacyTeamId: "moi-phe-100", legacyVariantId: "khong-co" } })).rejects.toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    await expect(handlers.call("tqccl_get_team", { reference: { collection: "khaihoang", khaiHoangTeamId: "khong-co" } })).rejects.toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    await expect(handlers.call("tqccl_get_team", { reference: { collection: "khaihoang", sourceConfigId: "x" } })).rejects.toMatchObject({ code: "INVALID_REQUEST", fields: expect.arrayContaining(["reference.khaiHoangTeamId", "reference.sourceConfigId"]) });
    await expect(handlers.call("tqccl_get_team", { reference: { collection: "engine", teamId: list.items[0]!.reference.teamId, configId: "c" } })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

describe("engine collection with a verified seasonContext", () => {
  it("lists config identities, refuses ambiguity with choices and scopes the source score", async () => {
    const h = await seasonalHandlers();
    const listed = await h.call("tqccl_find_teams", { collection: "engine", seasonContext: context, limit: 1 });
    expect(listed.items[0]?.configId).toBe("config-a");
    expect(listed.nextCursor).toBeDefined();
    await expect(h.call("tqccl_find_teams", { collection: "engine", limit: 1, cursor: listed.nextCursor, expectedWorkflowVersion: listed.workflowVersion })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    const input = { reference: { collection: "engine" as const, teamId: "team-a" }, seasonContext: context, expectedWorkflowVersion: listed.workflowVersion };
    await expect(h.call("tqccl_get_team", input)).rejects.toMatchObject({ code: "CONFIG_AMBIGUOUS", choices: { kind: "team-config", teamId: "team-a", configIds: ["config-a", "config-b"], totalCount: 2, omittedCount: 0 } });
    const detail = await h.call("tqccl_get_team", { ...input, reference: { ...input.reference, configId: "config-a" } });
    expect(detail.team?.sourceScore).toMatchObject({ value: 132.5 });
    expect(detail.team?.heroes[0]?.tactics[0]?.tacticRefs?.length).toBeGreaterThan(0);
    await expect(h.call("tqccl_get_team", { ...input, seasonContext: { scenarioId: "x", rulesetId: "y" } })).rejects.toMatchObject({ code: "SEASON_CONTEXT_INVALID" });
    await expect(h.call("tqccl_get_team", { ...input, reference: { ...input.reference, configId: "missing" } })).rejects.toMatchObject({ code: "CONFIG_NOT_FOUND" });
  });

  it("searches configured heroes and alternatives and pages all 501 configs", async () => {
    const h = await seasonalHandlers();
    const hero = await h.call("tqccl_find_teams", { collection: "engine", query: "Anh", seasonContext: context });
    expect(hero.items.map((item) => item.configId)).toEqual(["config-a", "config-b", "config-conditional"]);
    const data = await seasonConsumerFixture();
    const base = data["season-team-configs"][0]!;
    const evaluation = data["season-team-evaluations"][0]!;
    data["season-team-configs"] = Array.from({ length: 501 }, (_, i) => ({ ...structuredClone(base), id: `config-${String(i).padStart(3, "0")}` }));
    data["season-team-evaluations"] = data["season-team-configs"].map((config) => ({ ...structuredClone(evaluation), id: `eval-${config.id}`, configId: config.id, sourceScore: null }));
    refreshConfigProofs(data);
    const bytes = new Map(Object.entries({ ...data, "team-tier": [] }).map(([name, value]) => [name as ArtifactName, new TextEncoder().encode(JSON.stringify(value))]));
    const snapshot = await validateDataSnapshot(await createDataManifest(bytes), bytes);
    const big = createResearchHandlers({ dataSource: { load: async () => snapshot } });
    const seen: Array<string | undefined> = [];
    let cursor: string | undefined;
    let version: string | undefined;
    do {
      const page = await big.call("tqccl_find_teams", { collection: "engine", seasonContext: context, limit: 50, ...(cursor ? { cursor, expectedWorkflowVersion: version } : {}) });
      seen.push(...page.items.map((item) => item.configId));
      version = page.workflowVersion;
      cursor = page.nextCursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(501);
    await expect(big.call("tqccl_get_team", { reference: { collection: "engine", teamId: "team-a" }, seasonContext: context })).rejects.toMatchObject({ code: "CONFIG_AMBIGUOUS", choices: { totalCount: 501, omittedCount: 481 } });
    await expect(
      big.call("tqccl_find_teams", { collection: "engine", seasonContext: context, heroes: [{ canonicalId: "hero:anh", tacticIds: [] }], minHeroes: 1 }),
    ).rejects.toMatchObject({ code: "CANDIDATE_LIMIT_EXCEEDED", limits: { maxCandidates: 500, candidateCount: 501 }, retryable: false });
  });

  it("excludes private descendants before listing and detail", async () => {
    const data = await seasonConsumerFixture();
    data.teams[0]!.source = "do-uy";
    const bytes = new Map(Object.entries({ ...data, "team-tier": [] }).map(([name, value]) => [name as ArtifactName, new TextEncoder().encode(JSON.stringify(value))]));
    const snapshot = await validateDataSnapshot(await createDataManifest(bytes), bytes);
    const h = createResearchHandlers({ dataSource: { load: async () => snapshot } });
    const listed = await h.call("tqccl_find_teams", { collection: "engine", seasonContext: context });
    expect(JSON.stringify(listed)).not.toContain("config-a");
    await expect(h.call("tqccl_get_team", { reference: { collection: "engine", teamId: "team-a", configId: "config-a" }, seasonContext: context })).rejects.toMatchObject({ code: "CONFIG_NOT_FOUND" });
  });
});

describe("capability on snapshots without publication", () => {
  it("returns CAPABILITY_UNAVAILABLE for public collections but still reads engine", async () => {
    const h = await seasonalHandlers();
    for (const collection of ["recommended", "other", "khaihoang"] as const) {
      await expect(h.call("tqccl_find_teams", { collection })).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
    }
    await expect(h.call("tqccl_get_team", { reference: { collection: "recommended", sourceConfigId: "x" } })).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
    const engine = await h.call("tqccl_find_teams", { collection: "engine" });
    expect(engine.total).toBeGreaterThan(0);
  });
});

async function mutableHandlers() {
  const snapshot = await new FilesystemDataSource({ dataRoot: repositoryDataRoot }).load();
  return { snapshot, publication: snapshot.publication!, handlers: createResearchHandlers({ dataSource: { load: async () => snapshot } }) };
}

describe("team detail output boundary", () => {
  it("never lets unknown source fields reach get_team output", async () => {
    const { publication: pub, handlers: h } = await mutableHandlers();
    const kh = pub.teams.find((team) => team.collection === "khaihoang" && (pub.getTeam(team.ref) as unknown as { team: { guide?: unknown } }).team.guide !== undefined)!;
    const khDetail = pub.getTeam(kh.ref) as unknown as { team: Record<string, any> };
    khDetail.team.evilTeam = "leak";
    khDetail.team.guide.evilGuide = "leak";
    khDetail.team.guide.ratings.evilRating = 1;
    khDetail.team.heroes[0].evilHero = "leak";
    const other = pub.teams.find((team) => team.collection === "other")!;
    const variant = (pub.getTeam(other.ref) as unknown as { variants: Array<Record<string, any>> }).variants[0]!;
    variant.holders[0].evilHolder = "leak";
    variant.historicalRankings.push({ tier: "T0", updatedAt: "2026-01-01", evilRanking: "leak" });
    const reference = { collection: "khaihoang" as const, khaiHoangTeamId: kh.id };
    const dumps: unknown[] = [];
    for (const section of ["overview", "guide", "variants", "notes"] as const) {
      dumps.push(await h.call("tqccl_get_team", { reference, section }).catch((error: { code: string }) => error.code));
    }
    const listed = await h.call("tqccl_find_teams", { collection: "other", query: other.nameVi, limit: 50 });
    const item = listed.items.find((entry) => entry.ref === other.ref)!;
    dumps.push(await h.call("tqccl_get_team", { reference: item.reference }));
    expect(JSON.stringify(dumps)).not.toContain("leak");
    expect(JSON.stringify(dumps)).not.toMatch(/evil/u);
  });

  it("uses one finite sourceScore shape", async () => {
    const list = await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 1 });
    const detail = await handlers.call("tqccl_get_team", { reference: list.items[0]!.reference });
    expect(Object.keys(detail.team!.sourceScore!).sort()).toEqual(["scope", "sourceConfigId", "tierOrder", "tierRaw", "value"]);
  });

  it("rejects cursor on non-paginated sections", async () => {
    const list = await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 1 });
    const expectedWorkflowVersion = list.workflowVersion;
    for (const section of ["overview", "guide"] as const) {
      await expect(handlers.call("tqccl_get_team", { reference: list.items[0]!.reference, section, cursor: "abc", expectedWorkflowVersion })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    }
  });

  it("builds each other-variant item from its own variant", async () => {
    const { publication: pub, handlers: h } = await mutableHandlers();
    const other = pub.teams.find((team) => team.collection === "other")!;
    const detail = pub.getTeam(other.ref) as unknown as { variants: Array<Record<string, any>> };
    const first = detail.variants[0]!;
    const second = structuredClone(first);
    second.variantId = `v-${"b".repeat(64)}`;
    second.name = "Biến thể thứ hai";
    second.historicalTier = "T9";
    second.holders = [{ ...second.holders[0], displayNameVi: "Tướng riêng" }];
    second.resolved = { heroes: [{ ...second.resolved.heroes[0], heroId: "hero:rieng" }] };
    detail.variants.push(second);
    const listed = await h.call("tqccl_find_teams", { collection: "other", query: other.nameVi, limit: 50 });
    const items = listed.items.filter((entry) => entry.ref === other.ref);
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ nameVi: "Biến thể thứ hai", tierRaw: "T9", heroes: [{ nameVi: "Tướng riêng", heroId: "hero:rieng" }] });
    expect(items[0]!.heroes[0]!.nameVi).not.toBe("Tướng riêng");
  });
});
