import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  canonicalHeroId,
  heroFamilyId,
} from "../../../js/hero-identity.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { buildSnapshotIndex } from "../../src/data/snapshot-index.js";
import { normalizeObservations } from "../../src/domain/normalization-service.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";
import {
  buildIdObservations,
  buildMixedObservations,
  buildNameObservations,
  loadRosterEnv,
  loadRosterFixture,
  prepareForDomain,
  type Observation,
} from "../fixtures/normalize-full-roster.js";

// Số đo 2026-11-19 (domain, máy dev). Không coverage: normalize (a) 21-23 ms, (b) 28-35 ms; recommend 238 mục fullBox
// (snapshot đã nạp) 33-43 ms; recommend lần đầu gồm cold load snapshot + index ~620 ms. Dưới `--coverage` (CI chạy
// test:coverage): normalize (a) 53-60 ms, (b) 81-91 ms; recommend 65-69 ms. Ngưỡng ≈ 3× số đo chậm nhất để chịu cả
// coverage lẫn tải song song: normalize 300 ms, recommend 250 ms.
const NORMALIZE_BUDGET_MS = 300;
const RECOMMEND_BUDGET_MS = 250;

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
    // Handler mới nạp snapshot ở lần gọi đầu; cold load đã đo riêng (coldLoadMs) và rất nhạy tải song song, nên khởi
    // động trước để "warm" đo đúng chi phí normalize + recommend.
    await handlers.call("tqccl_get_playbook", { intent: "lookup" });

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
    // Cô lập ~0,7 s; khi cả bộ test chạy song song (nhiều file nạp snapshot 9 MB) đo được 2-2,6 s, nên ngưỡng 4 s (≈ 6×).
    expect(coldLoadMs).toBeLessThan(4_000);
    expect(indexMs).toBeLessThan(1_000);
    expect(warmNormalizeAndRecommendMs).toBeLessThan(2_000);
  });
});

describe("full-roster CPU budget (#165)", () => {
  it("normalizes the 238/263-item name roster and recommends for the 238-item fullBox roster inside budget", async () => {
    const env = await loadRosterEnv();
    const roster = loadRosterFixture();
    const timeNormalize = async (observations: Observation[]) => {
      const startedAt = performance.now();
      const result = await normalizeObservations({
        workflowVersion: env.ctx.workflowVersion,
        observations: prepareForDomain(env.ctx, observations) as never,
      });
      return { result, ms: elapsed(startedAt) };
    };
    const a = await timeNormalize(buildNameObservations(env, roster));
    const b = await timeNormalize(buildMixedObservations(env, roster));

    const byId = await normalizeObservations({
      workflowVersion: env.ctx.workflowVersion,
      observations: buildIdObservations(env, roster) as never,
    });
    const handlers = createResearchHandlers({ dataSource: new FilesystemDataSource({ dataRoot: productionDataRoot }) });
    // Nạp snapshot + dựng index trước khi đo: recommendMs là chi phí tính toán, cold load đã có test riêng ở trên.
    await handlers.call("tqccl_get_playbook", { intent: "lookup" });
    const startedAt = performance.now();
    const recommended = await handlers.call("tqccl_recommend_teams", {
      expectedWorkflowVersion: env.ctx.workflowVersion,
      canonicalState: byId.canonicalState as never,
      confirmationBinding: byId.confirmationBinding,
      sourceSeasonId: env.snapshot.publication!.seasons.defaultSourceSeasonId,
      maxTeams: 10,
      fullBox: true,
    });
    const recommendMs = elapsed(startedAt);

    console.info("TQCCL_FULL_ROSTER_BUDGET", JSON.stringify({ normalizeAMs: a.ms, normalizeBMs: b.ms, recommendMs, teams: recommended.portfolioTeams.length }));

    expect(recommended.portfolioTeams.length).toBeGreaterThan(0);
    // Ngưỡng và lý do: xem hằng NORMALIZE_BUDGET_MS/RECOMMEND_BUDGET_MS ở đầu file.
    expect(a.ms).toBeLessThan(NORMALIZE_BUDGET_MS);
    expect(b.ms).toBeLessThan(NORMALIZE_BUDGET_MS);
    expect(recommendMs).toBeLessThan(RECOMMEND_BUDGET_MS);
  });
});
