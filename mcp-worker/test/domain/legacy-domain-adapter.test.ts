import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  LegacyDomainAdapterError,
  legacyDomainAdapter,
} from "../../src/domain/legacy-domain-adapter.js";

const repositoryRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

function loadJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8"));
}

const teams = loadJson("data/teams.json") as Array<Record<string, unknown>>;
const teamTier = loadJson("data/team-tier.json") as Array<Record<string, unknown>>;
const heroes = loadJson("data/heroes-dict.json") as Array<Record<string, unknown>>;
const tactics = loadJson("data/tactics.json") as Array<Record<string, unknown>>;

function team(id: string): Record<string, unknown> {
  const record = teams.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing committed team fixture: ${id}`);
  return record;
}

describe("legacy domain adapter characterization", () => {
  it("loads independently of process.cwd and exposes only the typed adapter", () => {
    expect(repositoryRoot).toMatch(/CamNangTQCCL$/);
    expect(Object.keys(legacyDomainAdapter).sort()).toEqual([
      "deserializeBrowserScanState",
      "findSimilarTeams",
      "mapBuiltTeamsScan",
      "mapHeroesScan",
      "mapRead",
      "mapTacticsScan",
      "mapTeamRead",
      "matchDictionary",
      "normalizeTeamCandidate",
      "normalizeText",
      "recommendTeams",
      "searchDictionary",
      "serializeBrowserScanState",
      "toVietHanViet",
    ]);
  });

  it("maps a committed dictionary record without mutating input", () => {
    const dictionary = structuredClone(heroes);
    const before = structuredClone(dictionary);
    const matched = legacyDomainAdapter.matchDictionary("SP Tuân Úc", dictionary);

    expect(matched.record?.viet).toBe("SP Tuân Úc");
    expect(dictionary).toEqual(before);
    expect(JSON.parse(JSON.stringify(matched))).toEqual(matched);
  });

  it("executes dictionary search and Hán-Việt transliteration", () => {
    const searched = legacyDomainAdapter.searchDictionary("Tuân Úc", heroes, {
      limit: 2,
    });

    expect(searched[0]?.record.viet).toBe("Tuân Úc");
    expect(legacyDomainAdapter.toVietHanViet("荀彧")).toBe("Tuân Úc");
  });

  it("tolerates unknown artifact fields while validating fields it uses", () => {
    const result = legacyDomainAdapter.mapHeroesScan(
      { heroes: [{ nameCn: "荀彧", redStars: 2, futureField: "ignored" }] },
      { heroesDict: heroes },
    );

    expect(result.heroes).toHaveLength(1);
    expect(result.heroes[0]?.name).toBeTruthy();
  });

  it("captures the temporary SP/base collapse for Phase 2 replacement", () => {
    const candidate = legacyDomainAdapter.normalizeTeamCandidate(team("team-intro-0"));

    expect(candidate.requiredHeroes).toContain("Tuân Úc");
    expect(candidate.requiredHeroes).not.toContain("SP Tuân Úc");
  });

  it("captures the temporary combined-slot mismatch for Phase 2 replacement", () => {
    const candidate = legacyDomainAdapter.normalizeTeamCandidate(team("team-intro-27"));

    expect(candidate.requiredHeroes).toContain("Lữ Mông");
    expect(candidate.requiredHeroes).not.toContain("Trình Phổ");
  });

  it("characterizes CO, multi-ranking, and untiered committed artifacts", () => {
    const tierByTeam = new Map(
      teamTier.map((entry) => [
        String(entry.teamId),
        (entry.rankings as Array<Record<string, unknown>>) ?? [],
      ]),
    );
    const coCandidate = legacyDomainAdapter.normalizeTeamCandidate(team("team-intro-25"));
    const rankedCandidate = legacyDomainAdapter.normalizeTeamCandidate(
      team("team-intro-1"),
      tierByTeam,
    );
    const untieredCandidate = legacyDomainAdapter.normalizeTeamCandidate(
      team("team-intro-0"),
      tierByTeam,
    );

    expect(coCandidate.requiredHeroes).toContain("Chân Cơ");
    expect(coCandidate.requiredHeroes).not.toContain("CO Chân Cơ");
    expect(rankedCandidate.tier).toBe("T0");
    expect(untieredCandidate.tier).toBe("");
  });

  it("keeps current recommendation tactics flat for Phase 2 replacement", () => {
    const source = team("team-intro-0");
    const sourceHeroes = (source.heroes as Array<{ baseName: string }>).map(
      ({ baseName }) => baseName,
    );
    const sourceTactics = (
      source.heroes as Array<{ tactics: Array<{ name: string }> }>
    ).flatMap(({ tactics: slots }) => slots.map(({ name }) => name));
    const result = legacyDomainAdapter.recommendTeams({
      teams: [source],
      teamTier,
      ownedHeroes: sourceHeroes,
      ownedTactics: sourceTactics,
      maxTeams: 1,
    });

    expect(result.portfolioTeams[0]?.selectedTactics).toEqual(sourceTactics);
    expect(result.portfolioTeams[0]?.tacticSelections).toBeUndefined();
  });

  it("maps current team reads and returns defensive JSON output", () => {
    const input = [
      {
        nameCn: "荀彧",
        tacticsCn: ["草船借箭"],
        booksCn: [],
        statFocusCn: "全智力",
      },
    ];
    const before = structuredClone(input);
    const result = legacyDomainAdapter.mapTeamRead(input, {
      heroesDict: heroes,
      tacticsDict: tactics,
      booksDict: [],
    });

    expect(input).toEqual(before);
    expect(result).not.toBe(input);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("executes single-read and similar-team mapping", () => {
    const read = {
      nameCn: "荀彧",
      tacticsCn: ["草船借箭"],
      booksCn: [],
      statFocusCn: "全智力",
    };
    const dicts = {
      heroesDict: heroes,
      tacticsDict: tactics,
      booksDict: [],
    };
    const mapped = legacyDomainAdapter.mapRead(read, dicts);
    const similar = legacyDomainAdapter.findSimilarTeams(
      [mapped],
      teams,
      { minHeroes: 1, limit: 3 },
    );

    expect((mapped.hero as Record<string, unknown>).viet).toBe("Tuân Úc");
    expect(similar.length).toBeGreaterThan(0);
  });

  it("executes tactic, built-team, and browser-state adapters", () => {
    const tacticScan = legacyDomainAdapter.mapTacticsScan(
      { tactics: [{ nameCn: "草船借箭" }] },
      { tacticsDict: tactics },
    );
    const builtScan = legacyDomainAdapter.mapBuiltTeamsScan(
      {
        teams: [
          {
            teamName: "Đội đã build",
            heroesCn: ["荀彧"],
            tacticsCn: ["草船借箭"],
          },
        ],
      },
      { heroesDict: heroes, tacticsDict: tactics },
    );
    const serialized = legacyDomainAdapter.serializeBrowserScanState({
      ownedHeroes: [{ name: "Tuân Úc" }],
      ownedTactics: [],
      lockedTeams: [],
      confirmed: true,
      updatedAt: null,
    });
    const deserialized = legacyDomainAdapter.deserializeBrowserScanState(
      JSON.stringify(serialized),
    );

    expect(tacticScan.tactics[0]?.name).toBe("Thuyền Cỏ Mượn Tên");
    expect(builtScan.teams[0]).toMatchObject({
      teamName: "Đội đã build",
      heroes: ["Tuân Úc"],
      tactics: ["Thuyền Cỏ Mượn Tên"],
    });
    expect(deserialized).toEqual(serialized);
  });

  it.each([
    () =>
      legacyDomainAdapter.mapBuiltTeamsScan(
        { teams: [{ teamName: 42, heroes: [], tactics: [] }] },
        { heroesDict: heroes, tacticsDict: tactics },
      ),
    () =>
      legacyDomainAdapter.normalizeTeamCandidate({
        heroes: [{ baseName: 42, tactics: [] }],
      }),
  ])("rejects malformed legacy output instead of trusting a TypeScript cast", (operation) => {
    expect(operation).toThrow(LegacyDomainAdapterError);
  });

  it.each([
    ["normalizeText", () =>
      legacyDomainAdapter.normalizeText({
        toString() {
          throw new Error("/Users/private/artifact.json");
        },
      } as unknown as string)],
    ["toVietHanViet", () =>
      legacyDomainAdapter.toVietHanViet({
        trim() {
          throw new Error("/Users/private/artifact.json");
        },
      } as unknown as string)],
  ])("redacts legacy errors from %s", (operation, invoke) => {
    expect(invoke).toThrow(LegacyDomainAdapterError);
    try {
      invoke();
    } catch (error) {
      expect(error).toMatchObject({ operation });
      expect(String(error)).not.toContain("/Users/private");
    }
  });
});
