import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  canonicalHeroId,
  heroFamilyId,
} from "../../../js/hero-identity.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { buildSnapshotIndex } from "../../src/data/snapshot-index.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";

const productionDataRoot = fileURLToPath(
  new URL("../../../data", import.meta.url),
);

function elapsed(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

describe("production-shaped CPU proxy", () => {
  it("paginates the complete production search corpus without repeating a page", async () => {
    const source = new FilesystemDataSource({ dataRoot: productionDataRoot });
    const snapshot = await source.load();
    const handlers = createResearchHandlers({ dataSource: source });
    const seen = new Set<string>();
    let cursor: string | undefined;
    let workflowVersion: string | undefined;
    let pageCount = 0;
    let expectedEntries = 0;

    do {
      const page = await handlers.call("tqccl_search", {
        query: "",
        limit: 50,
        ...(cursor === undefined ? {} : { cursor }),
        ...(workflowVersion === undefined
          ? {}
          : { expectedWorkflowVersion: workflowVersion }),
      });
      for (const item of page.items) {
        const key = `${item.kind}:${item.entityId}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      cursor = page.nextCursor;
      workflowVersion = page.workflowVersion;
      expectedEntries = page.total;
      pageCount += 1;
    } while (cursor !== undefined);

    expect(seen.size).toBe(expectedEntries);
    expect(expectedEntries).toBe(
      snapshot.publication!.entities.length + snapshot.publication!.teams.length + snapshot.artifacts.teams.length,
    );
    expect(pageCount).toBeLessThan(120);
  });

  it("records bounded cold/index/warm recommendation work before transport", async () => {
    const source = new FilesystemDataSource({ dataRoot: productionDataRoot });

    let startedAt = performance.now();
    const snapshot = await source.load();
    const coldLoadMs = elapsed(startedAt);

    startedAt = performance.now();
    const index = buildSnapshotIndex(snapshot);
    const indexMs = elapsed(startedAt);

    const rankedTeamIds = new Set(
      snapshot.artifacts["team-tier"].map(({ teamId }) => teamId),
    );
    const heroIds = new Set(
      index.searchEntries
        .filter(({ kind }) => kind === "hero")
        .map(({ canonicalId }) => canonicalId),
    );
    const tacticNames = new Set(
      index.searchEntries
        .filter(({ kind }) => kind === "tactic")
        .map(({ displayName }) => displayName),
    );
    const rankedTeam = snapshot.artifacts.teams.find((team) => {
      if (!rankedTeamIds.has(team.id)) return false;
      const heroes = team.heroes as
        | Array<{ name?: string; tactics?: Array<{ name?: string }> }>
        | undefined;
      return (
        heroes !== undefined &&
        heroes.every(
          (hero) =>
            hero.name !== undefined &&
            heroIds.has(canonicalHeroId(hero.name)) &&
            (hero.tactics ?? []).every(
              ({ name }) => name !== undefined && tacticNames.has(name),
            ),
        )
      );
    });
    const firstTeamHeroes = (
      rankedTeam?.heroes as
        | Array<{
            name?: string;
            tactics?: Array<{ name?: string }>;
          }>
        | undefined
    ) ?? [];
    const requiredIds = new Set(
      firstTeamHeroes.flatMap((hero) => [
        ...(hero.name === undefined ? [] : [canonicalHeroId(hero.name)]),
        ...(hero.tactics ?? []).flatMap(({ name }) => {
          const tactic = index.searchEntries.find(
            (entry) => entry.kind === "tactic" && entry.displayName === name,
          );
          return tactic === undefined ? [] : [tactic.canonicalId];
        }),
      ]),
    );
    const candidates = index.searchEntries.filter(
      ({ kind }) => kind === "hero" || kind === "tactic",
    );
    const observations = [
      ...candidates.filter(({ canonicalId }) => requiredIds.has(canonicalId)),
      ...candidates.filter(({ canonicalId }) => !requiredIds.has(canonicalId)),
    ]
      .slice(0, 60)
      .map((entry, observationIndex) => ({
        observationId: `budget-${observationIndex}`,
        entityKind: entry.kind as "hero" | "tactic",
        canonicalId: entry.canonicalId as
          | `hero:${string}`
          | `tactic:${string}`,
        ...(entry.kind === "hero"
          ? { familyId: heroFamilyId(entry.displayName) }
          : {}),
        displayName: entry.displayName,
        evidence: {
          sourceScope: "currentTurnImage" as const,
          batchId: "production-budget",
        },
      }));
    const handlers = createResearchHandlers({ dataSource: source });

    startedAt = performance.now();
    const normalized = await handlers.call("tqccl_normalize_entities", {
      observations,
    });
    const recommended = await handlers.call("tqccl_recommend_teams", {
      expectedWorkflowVersion: normalized.workflowVersion,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      sourceSeasonId: snapshot.publication!.seasons.defaultSourceSeasonId,
      maxTeams: 10,
    });
    const warmNormalizeAndRecommendMs = elapsed(startedAt);

    const metrics = {
      releaseId: snapshot.releaseId,
      artifactRecords: snapshot.manifest.artifacts.reduce(
        (total, artifact) => total + artifact.count,
        0,
      ),
      observations: observations.length,
      teamsReturned: recommended.portfolioTeams.length,
      coldLoadMs,
      indexMs,
      warmNormalizeAndRecommendMs,
    };
    console.info("TQCCL_CPU_PROXY", JSON.stringify(metrics));

    expect(snapshot.artifacts.teams.length).toBeGreaterThan(100);
    expect(observations.length).toBe(60);
    expect(recommended.portfolioTeams.length + recommended.blockedStrongTeams.length).toBeGreaterThan(0);
    expect(coldLoadMs).toBeLessThan(2_000);
    expect(indexMs).toBeLessThan(1_000);
    expect(warmNormalizeAndRecommendMs).toBeLessThan(2_000);
  });
});
