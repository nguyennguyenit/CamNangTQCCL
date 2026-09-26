import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeText } from "../../../js/filters.js";
import { canonicalHeroId } from "../../../js/hero-identity.js";
import {
  LegacyDomainAdapterError,
  legacyDomainAdapter,
} from "../../src/domain/legacy-domain-adapter.js";

function loadJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8"));
}

type TeamFixture = {
  id: string;
  heroes: Array<{ name: string; tactics: Array<{ name: string }> }>;
};

const teams = loadJson("data/teams.json") as TeamFixture[];
const teamTier = loadJson("data/team-tier.json") as Array<Record<string, unknown>>;

function team(id: string): TeamFixture {
  const record = teams.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing committed team fixture: ${id}`);
  return record;
}

function tacticId(name: string): string {
  return `tactic:${normalizeText(name).replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "")}`;
}

function confirmedReads(source: TeamFixture) {
  return source.heroes.map((hero) => ({
    hero: { matched: true, canonicalId: canonicalHeroId(hero.name), reviewRequired: false },
    tactics: hero.tactics.map((tactic) => ({
      matched: true,
      canonicalId: tacticId(tactic.name),
      reviewRequired: false,
    })),
  }));
}

function inventoryOf(source: TeamFixture) {
  return {
    ownedHeroes: source.heroes.map(({ name }) => name),
    ownedTactics: source.heroes.flatMap(({ tactics }) => tactics.map(({ name }) => name)),
  };
}

function recommendedIds(result: { portfolioTeams: Array<{ team: Record<string, unknown> }> }) {
  return result.portfolioTeams.map((entry) => entry.team.id);
}

describe("legacy domain adapter", () => {
  it("finds the committed team whose heroes and tactics were read", () => {
    const source = team("team-intro-0");
    const reads = confirmedReads(source);
    const before = structuredClone(reads);
    const similar = legacyDomainAdapter.findSimilarTeams(reads, teams, { minHeroes: 2, limit: 3 });

    expect(similar[0]).toMatchObject({
      team: { id: "team-intro-0" },
      heroHit: 3,
      tacticHit: 6,
      total: 3,
    });
    expect(reads).toEqual(before);
  });

  it("drops teams below the minimum hero overlap", () => {
    const firstRead = confirmedReads(team("team-intro-0")).slice(0, 1);
    const similar = legacyDomainAdapter.findSimilarTeams(firstRead, teams, { minHeroes: 2, limit: 5 });

    expect(similar).toEqual([]);
    const loosened = legacyDomainAdapter.findSimilarTeams(firstRead, teams, { minHeroes: 1, limit: 50 });
    expect(loosened.map(({ team: match }) => (match as { id: string }).id)).toContain("team-intro-0");
  });

  it("counts a portrait-guessed hero in the total but not as a similar-team hit", () => {
    const read = (canonicalId: string, sure?: boolean) => ({
      hero: { matched: true, canonicalId, ...(sure === undefined ? {} : { sure }) },
      tactics: [],
    });
    const similar = legacyDomainAdapter.findSimilarTeams(
      [read(canonicalHeroId("Tào Tháo")), read(canonicalHeroId("Quan Vũ")), read(canonicalHeroId("Trương Phi"), false)],
      [
        {
          id: "ba-tuong",
          name: "Ba tướng",
          heroes: [
            { name: "Tào Tháo", tactics: [] },
            { name: "Quan Vũ", tactics: [] },
            { name: "Trương Phi", tactics: [] },
          ],
        },
      ],
      { minHeroes: 2, limit: 3 },
    );

    expect(similar).toHaveLength(1);
    expect(similar[0]).toMatchObject({ heroHit: 2, total: 3 });
  });

  it("recommends a team the inventory fully covers, using only owned tactics", () => {
    const source = team("team-intro-1");
    const inventory = inventoryOf(source);
    const result = legacyDomainAdapter.recommendTeams({
      teams,
      teamTier,
      ...inventory,
      maxTeams: 5,
      mode: "all",
    });

    expect(recommendedIds(result)).toContain("team-intro-1");
    for (const entry of result.portfolioTeams) {
      expect(inventory.ownedTactics).toEqual(expect.arrayContaining(entry.selectedTactics));
    }
    const recommended = result.portfolioTeams.find((entry) => entry.team.id === "team-intro-1");
    expect(recommended?.selectedTactics).toEqual(inventory.ownedTactics);
    expect(recommended?.tacticSelections).toHaveLength(inventory.ownedTactics.length);
  });

  it("does not recommend a team when the inventory lacks one of its heroes", () => {
    const source = team("team-intro-1");
    const inventory = inventoryOf(source);
    const result = legacyDomainAdapter.recommendTeams({
      teams,
      teamTier,
      ownedHeroes: inventory.ownedHeroes.slice(1),
      ownedTactics: inventory.ownedTactics,
      maxTeams: 5,
      mode: "all",
    });

    expect(recommendedIds(result)).not.toContain("team-intro-1");
  });

  it("redacts legacy failures instead of leaking internal errors", () => {
    const invoke = () =>
      legacyDomainAdapter.recommendTeams({
        teams: [{ heroes: [{ name: "/Users/private/artifact.json", tactics: 42 }] }],
        ownedHeroes: [],
        seasonContext: { scenarioId: "/Users/private" },
      });
    expect(invoke).toThrow(LegacyDomainAdapterError);
    try {
      invoke();
    } catch (error) {
      expect(error).toMatchObject({ operation: "recommendTeams" });
      expect(String(error)).not.toContain("/Users/private");
    }
  });
});
