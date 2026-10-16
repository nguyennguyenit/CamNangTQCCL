import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { canonicalHeroId, heroFamilyId } from "../../../js/hero-identity.js";
import { MAX_TACTIC_OVERRIDES, deserializeRosterScanState, setTacticOverride } from "../../../js/roster-scan-state.js";
import { analyzeTacticSubstitutes, recommendRoster, seasonTacticUsage } from "../../../js/roster-season-candidates.js";
import { buildTacticRules, canonicalTacticId } from "../../../js/team-recommend-engine.js";
import { createTacticNameResolver } from "../../src/data/entity-identity.js";
// Fixtures shared with the website adapter audit (`tests-js/roster-adapter-audit.test.mjs`).
import {
  FIXTURE_IDS,
  deepRankProbe,
  realData,
  rosterOf as rosterOfUntyped,
  seasonFrom as seasonFromUntyped,
} from "../../../tests-js/fixtures/roster-adapter-fixtures.mjs";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { publicSnapshotView } from "../../src/data/public-snapshot-view.js";
import { buildSnapshotIndex } from "../../src/data/snapshot-index.js";
import { createWorkflowVersion } from "../../src/domain/canonical-state.js";
import { normalizeObservations } from "../../src/domain/normalization-service.js";
import { WORKFLOW_BUILD_ID } from "../../src/generated/workflow-build.js";
import { handleRecommendTeams, type RecommendTeamsOutput } from "../../src/research/recommend-handlers.js";
import { createToolContext, type ToolContext } from "../../src/research/tool-context.js";

const realDataRoot = fileURLToPath(new URL("../../../data", import.meta.url));

interface Roster {
  ownedHeroes: string[];
  ownedTactics: string[];
}
type Rec = Record<string, any>;
type Direct = Rec;
/** Website-shape locked team (`js/roster-scan-state.js` `uniqLockedTeams`): names, not canonical ids. */
interface WebLockedTeam {
  teamId: string;
  teamName: string;
  heroes: string[];
  tactics: string[];
}
interface Extra {
  fullBox?: boolean;
  lockedTeams?: WebLockedTeam[];
  tacticOverrides?: Rec[];
}

let ctx: ToolContext;
/**
 * Name → canonical tactic id as an MCP client receives it (catalog `id`, stable across display renames).
 * Season teams carry display names (`viet`), which no longer slug to the id for renamed tactics; names
 * outside the catalog (synthetic fixtures) keep the slug, like the website's `createTacticIdResolver`.
 */
let tacticIdOf: (name: string) => string;
const data = realData();
const seasonFrom = seasonFromUntyped as (seasonId: string, configIds?: string[] | null) => { teams: Rec[]; teamTier: Rec[]; usage: Map<string, Map<string, number>> };
const rosterOf = rosterOfUntyped as (teams: unknown[], options?: { skipTactics?: string[] }) => Roster;

beforeAll(async () => {
  const snapshot = await publicSnapshotView(await new FilesystemDataSource({ dataRoot: realDataRoot }).load());
  ctx = createToolContext(snapshot, buildSnapshotIndex(snapshot), createWorkflowVersion(snapshot.releaseId, WORKFLOW_BUILD_ID));
  const resolveTactic = createTacticNameResolver(snapshot.artifacts.tactics);
  tacticIdOf = (name) => resolveTactic(name) ?? canonicalTacticId(name);
}, 120_000);

async function stateFor(roster: Roster, lockedTeams: WebLockedTeam[] = []) {
  const evidence = { sourceScope: "currentTurnImage", batchId: "parity" } as const;
  const normalized = await normalizeObservations({
    workflowVersion: ctx.workflowVersion,
    observations: [
      ...roster.ownedHeroes.map((name, index) => ({
        observationId: `h${index}`,
        entityKind: "hero" as const,
        canonicalId: canonicalHeroId(name),
        familyId: heroFamilyId(name),
        displayName: name,
        evidence,
      })),
      ...roster.ownedTactics.map((name, index) => ({
        observationId: `t${index}`,
        entityKind: "tactic" as const,
        canonicalId: tacticIdOf(name),
        displayName: name,
        evidence,
      })),
      ...lockedTeams.map((team) => ({
        observationId: team.teamId,
        entityKind: "team" as const,
        canonicalId: team.teamId,
        heroIds: team.heroes.map(canonicalHeroId),
        tacticIds: team.tactics.map(tacticIdOf),
        evidence: { sourceScope: "priorConfirmedNote", batchId: "locked", fieldPresence: ["canonicalId", "heroIds", "tacticIds"] },
      })),
    ] as never,
  });
  return {
    expectedWorkflowVersion: ctx.workflowVersion,
    canonicalState: normalized.canonicalState,
    confirmationBinding: normalized.confirmationBinding,
  };
}

/** `state.tacticOverrides` as the website holds it: written through `setTacticOverride`, restored through `cleanTacticOverrides`. */
function webOverrides(overrides: Rec[] = []): Rec[] {
  return (deserializeRosterScanState({ tacticOverrides: overrides }) as { tacticOverrides: Rec[] }).tacticOverrides;
}

/** The website call of `js/roster-recommend-ui.js:544-556`, on the same roster/season/generation. */
function websiteCall(seasonId: string, roster: Roster, mode: "meta" | "redStars", extra: Extra = {}) {
  const season = seasonFrom(seasonId);
  const fullBox = extra.fullBox ?? (roster.ownedHeroes.length > 40 && roster.ownedTactics.length > 60);
  const result = recommendRoster({
    seasonTeams: season.teams,
    seasonTier: season.teamTier,
    legacyTeams: data.legacyTeams,
    legacyTier: data.legacyTier,
    tacticOverrides: webOverrides(extra.tacticOverrides),
    ownedHeroes: roster.ownedHeroes,
    ownedTactics: roster.ownedTactics,
    lockedTeams: extra.lockedTeams ?? [],
    mode,
    keepExistingTeams: true,
    tacticsDict: data.tacticsDict,
    fullBox,
  } as never) as Direct;
  return { result, season, fullBox };
}

/** The substitute block of `renderRecommendation` (`js/roster-recommend-ui.js:724-740`). */
function websiteSubstitutes(result: Direct, usage: Map<string, Map<string, number>>, roster: Roster, overrides: Rec[] = []) {
  const tacticRules = buildTacticRules(data.tacticsDict);
  const reserved = (result.portfolioTeams as Rec[]).flatMap((entry) => entry.selectedTactics ?? []);
  return (result.blockedStrongTeams as Rec[]).map((entry) => ({
    teamId: entry.team.id as string,
    slots: entry.status === "missing-hero"
      ? []
      : (entry.missingTacticSlots as Rec[]).map((slot) => {
          const analysis = analyzeTacticSubstitutes({
            heroName: slot.holderName,
            missingTactic: slot.tactic,
            team: entry.team,
            tacticOverrides: webOverrides(overrides),
            heroIndex: slot.heroIndex,
            slotIndex: slot.slotIndex,
            tacticRules,
            usage,
            ownedTactics: roster.ownedTactics,
            reservedTactics: reserved,
          } as never) as { substitutes: Rec[]; incompatible: Rec[] };
          return { tactic: slot.tactic as string, substitutes: analysis.substitutes, incompatible: analysis.incompatible };
        }),
  }));
}

function sourceOf(entry: Rec): "season" | "legacy" | "locked" {
  return entry.locked ? "locked" : entry.source === "legacy" ? "legacy" : "season";
}

async function expectParity(seasonId: string, roster: Roster, mode: "meta" | "redStars", extra: Extra = {}) {
  const { result, season, fullBox } = websiteCall(seasonId, roster, mode, extra);
  const body = await stateFor(roster, extra.lockedTeams);
  const output: RecommendTeamsOutput = await handleRecommendTeams(ctx, {
    ...body,
    sourceSeasonId: seasonId,
    mode,
    fullBox,
    maxTeams: 5,
    ...(extra.tacticOverrides ? { tacticOverrides: extra.tacticOverrides } : {}),
  } as never);

  const portfolio = result.portfolioTeams as Rec[];
  expect(output.portfolioTeams.map((entry) => entry.teamId)).toEqual(portfolio.map((entry) => entry.team.id));
  expect(output.portfolioTeams.map((entry) => entry.tier)).toEqual(portfolio.map((entry) => entry.tier));
  expect(output.portfolioTeams.map((entry) => entry.status)).toEqual(portfolio.map((entry) => entry.status));
  expect(output.portfolioTeams.map((entry) => entry.source)).toEqual(portfolio.map(sourceOf));
  expect(output.portfolioTeams.map((entry) => entry.variantUnrated)).toEqual(portfolio.map((entry) => entry.variantUnrated === true));
  // Locked teams reach the tool as canonical ids and the website as names: same tactics, compared by identity.
  const tacticKey = (value: string) => (value.startsWith("tactic:") ? value : tacticIdOf(value));
  expect(output.portfolioTeams.map((entry) => entry.selectedTactics.map(tacticKey))).toEqual(
    portfolio.map((entry) => (entry.selectedTactics as string[]).map(tacticKey)),
  );
  expect(output.portfolioTeams.map((entry) => entry.unresolvedTactics)).toEqual(portfolio.map((entry) => entry.unresolvedTactics ?? []));
  expect(output.portfolioTeams.map((entry) => entry.usedAlternatives)).toEqual(portfolio.map((entry) => entry.usedAlternatives));
  expect(output.legacyUsed).toBe(result.legacyUsed);

  const blocked = websiteSubstitutes(result, seasonTacticUsage(season.teams), roster, extra.tacticOverrides);
  expect(output.blockedStrongTeams.map((entry) => entry.teamId)).toEqual(blocked.slice(0, output.blockedStrongTeams.length).map((entry) => entry.teamId));
  expect(output.blockedStrongTeams.length + output.omittedCounts.blockedStrongTeams).toBe(blocked.length);
  output.blockedStrongTeams.forEach((entry, index) => {
    expect(entry.missingTacticSlots.map((slot) => slot.tactic)).toEqual(blocked[index]!.slots.map((slot) => slot.tactic));
    entry.missingTacticSlots.forEach((slot, slotIndex) => {
      expect(slot.substitutes).toEqual(blocked[index]!.slots[slotIndex]!.substitutes);
      expect(slot.incompatible).toEqual(blocked[index]!.slots[slotIndex]!.incompatible);
    });
  });
  const incompatible = result.incompatibleTeams as Rec[];
  expect(output.incompatibleTeams.map((entry) => entry.teamId)).toEqual(incompatible.slice(0, output.incompatibleTeams.length).map((entry) => entry.team.id));
  const conflicted = result.conflictedTeams as Rec[];
  expect(output.conflictedTeams.map((entry) => [entry.teamId, entry.sharedTactics.map((item) => item.tactic), entry.sharedHeroes.map((item) => item.hero)])).toEqual(
    conflicted
      .slice(0, output.conflictedTeams.length)
      .map((entry) => [entry.team.id, entry.sharedTactics.map((item: Rec) => item.tactic), entry.sharedHeroes.map((item: Rec) => item.hero)]),
  );
  expect(output.conflictedTeams.length + output.omittedCounts.conflictedTeams).toBe(conflicted.length);
  return { output, result };
}

describe("tqccl_recommend_teams equals the website adapter call", () => {
  it("s28-wutugu-huangma: unresolved slot is labelled, never build-now", async () => {
    const season = seasonFrom("pk-s28", [FIXTURE_IDS.unresolvedSlot]);
    const { output } = await expectParity("pk-s28", rosterOf(season.teams), "redStars");
    const entry = output.portfolioTeams.find((item) => item.teamId === FIXTURE_IDS.unresolvedSlot);
    expect(entry?.status).toBe("unreconciled");
    expect(entry?.unresolvedLabel).toBe("chưa đối chiếu");
  });

  it("team-831163 (team-jyspt): cavalry team builds with its source score", async () => {
    const season = seasonFrom("pk-s24", [FIXTURE_IDS.troopKy]);
    const { output } = await expectParity("pk-s24", rosterOf(season.teams), "meta");
    const entry = output.portfolioTeams.find((item) => item.teamId === FIXTURE_IDS.troopKy);
    expect(entry).toBeDefined();
    expect(entry?.source).toBe("season");
  });

  it("team-1imndp3 without Phi Hùng Quân: blocked slots and substitutes match the website", async () => {
    const season = seasonFrom("pk-s24", [FIXTURE_IDS.troopRules, FIXTURE_IDS.troopKy, FIXTURE_IDS.unitMissing]);
    const { output } = await expectParity("pk-s24", rosterOf(season.teams, { skipTactics: ["Phi Hùng Quân"] }), "meta");
    expect(output.blockedStrongTeams.some((entry) => entry.missingTacticSlots.length > 0)).toBe(true);
  });

  it("team-1imndp3: khiên team builds with its own tactics", async () => {
    const season = seasonFrom("pk-s24", [FIXTURE_IDS.troopRules]);
    const { output } = await expectParity("pk-s24", rosterOf(season.teams), "meta");
    expect(output.portfolioTeams.some((entry) => entry.teamId === FIXTURE_IDS.troopRules)).toBe(true);
  });

  it("team-epoddo: missing unitTypesRaw still matches the website", async () => {
    const season = seasonFrom("pk-s24", [FIXTURE_IDS.unitMissing]);
    const { output } = await expectParity("pk-s24", rosterOf(season.teams), "meta");
    expect(output.portfolioTeams.some((entry) => entry.teamId === FIXTURE_IDS.unitMissing)).toBe(true);
  });

  it("pk-s26 Meta, buildable teams ranked beyond 60: season teams are returned like the website", async () => {
    const { picks, roster } = deepRankProbe("pk-s26", 65);
    expect(picks.length).toBeGreaterThanOrEqual(2);
    const { output } = await expectParity("pk-s26", roster, "meta");
    const ids = output.portfolioTeams.filter((entry) => entry.source === "season").map((entry) => entry.teamId);
    for (const pick of picks) expect(ids).toContain(pick.id);
  });

  it("pk-s26 fullBox beyond 80 candidates: deep teams are returned like the website", async () => {
    const { picks, roster } = deepRankProbe("pk-s26", 82, 2, { metaOnly: false });
    expect(picks.length).toBeGreaterThanOrEqual(1);
    const { output } = await expectParity("pk-s26", roster, "redStars", { fullBox: true });
    const ids = output.portfolioTeams.filter((entry) => entry.source === "season").map((entry) => entry.teamId);
    for (const pick of picks) expect(ids).toContain(pick.id);
  });

  it("default fullBox follows the website rule (>40 heroes and >60 tactics)", async () => {
    const season = seasonFrom("pk-s26");
    const roster = rosterOf(season.teams.slice(0, 40));
    expect(roster.ownedHeroes.length).toBeGreaterThan(40);
    expect(roster.ownedTactics.length).toBeGreaterThan(60);
    const { output } = await expectParity("pk-s26", roster, "redStars");
    expect(output.fullBox).toBe(true);
  });
  describe("locked teams and tactic overrides", () => {
    const TACTIC = "Trấn Ách Phòng Cự";
    const lockedTeam: WebLockedTeam = {
      teamId: "team:locked-parity",
      teamName: "team:locked-parity",
      heroes: ["Lưu Bị", "Quan Vũ", "Trương Phi"],
      tactics: [TACTIC],
    };
    const epoddoRoster = () => {
      const roster = rosterOf(seasonFrom("pk-s24", [FIXTURE_IDS.unitMissing]).teams, { skipTactics: ["Thiêu Đốt Doanh Lũy"] });
      return { ...roster, ownedTactics: [...roster.ownedTactics, TACTIC] };
    };
    const dataOverride = { teamId: FIXTURE_IDS.unitMissing, heroIndex: 1, slotIndex: 0, tactic: TACTIC };

    it("team-epoddo: a tactic held by a locked team is never suggested as a substitute", async () => {
      const { output } = await expectParity("pk-s24", epoddoRoster(), "meta", { lockedTeams: [lockedTeam] });
      expect(output.portfolioTeams.some((entry) => entry.locked && entry.teamId === lockedTeam.teamId)).toBe(true);
      const slots = output.blockedStrongTeams.flatMap((entry) => entry.missingTacticSlots);
      expect(slots.length).toBeGreaterThan(0);
      for (const slot of slots) {
        expect([...slot.substitutes, ...slot.incompatible].map((item) => item.tactic)).not.toContain(TACTIC);
      }
    });

    it("team-epoddo: a chosen override matches the website", async () => {
      const { output } = await expectParity("pk-s24", epoddoRoster(), "meta", { tacticOverrides: [dataOverride] });
      expect(output.tacticOverrides).toMatchObject({ requested: 1, applied: 1, ignored: [] });
    });

    it("locked team together with an override matches the website", async () => {
      await expectParity("pk-s24", epoddoRoster(), "meta", { lockedTeams: [lockedTeam], tacticOverrides: [dataOverride] });
    });

    it("20 overrides (the website cap) match the website", async () => {
      const teams = seasonFrom("pk-s24").teams.slice(0, MAX_TACTIC_OVERRIDES);
      const overrides = teams.map((team) => ({ teamId: team.id as string, heroIndex: 0, slotIndex: 0, tactic: TACTIC }));
      expect(webOverrides(overrides)).toHaveLength(MAX_TACTIC_OVERRIDES);
      const roster = epoddoRoster();
      await expectParity("pk-s24", { ...roster, ownedTactics: [...roster.ownedTactics, TACTIC] }, "meta", { tacticOverrides: overrides });
    });

    it("the 21st override is refused by the website and by the tool", async () => {
      const teams = seasonFrom("pk-s24").teams.slice(0, MAX_TACTIC_OVERRIDES + 1);
      const overrides = teams.map((team) => ({ teamId: team.id as string, heroIndex: 0, slotIndex: 0, tactic: TACTIC }));
      let state: Rec = { tacticOverrides: [] };
      for (const override of overrides) state = setTacticOverride(state, override);
      expect(state.tacticOverrides).toHaveLength(MAX_TACTIC_OVERRIDES);
      const body = await stateFor(epoddoRoster());
      await expect(
        handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24", tacticOverrides: overrides } as never),
      ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    });

    it("two overrides for one slot: the website keeps the latest, the tool refuses the ambiguity", async () => {
      const other = { ...dataOverride, tactic: "Thâm Mưu Viễn Lự" };
      expect(webOverrides([dataOverride, other])).toEqual([other]);
      const body = await stateFor(epoddoRoster());
      await expect(
        handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24", tacticOverrides: [dataOverride, other] } as never),
      ).rejects.toMatchObject({ code: "INVALID_REQUEST", fields: ["tacticOverrides"] });
    });

    it("a locked team above the engine limits is refused at input", async () => {
      const roster = epoddoRoster();
      const tooManyHeroes = { ...lockedTeam, heroes: [...lockedTeam.heroes, "Triệu Vân"] };
      const body = await stateFor(roster, [tooManyHeroes]);
      await expect(handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24" } as never)).rejects.toMatchObject({
        code: "INVALID_REQUEST",
        fields: ["canonicalState.lockedTeams"],
      });
      const tooManyTactics = { ...lockedTeam, tactics: Array.from({ length: 13 }, (_, i) => `Chiến pháp thử ${i}`) };
      const body2 = await stateFor(roster, [tooManyTactics]);
      await expect(handleRecommendTeams(ctx, { ...body2, sourceSeasonId: "pk-s24" } as never)).rejects.toMatchObject({
        code: "INVALID_REQUEST",
        fields: ["canonicalState.lockedTeams"],
      });
    });
  });
});
