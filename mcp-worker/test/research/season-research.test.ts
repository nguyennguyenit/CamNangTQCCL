import { expect, it } from "vitest";

import { context } from "../../../tests-js/fixtures/season-fixtures.mjs";
import { createNormalizationDigest } from "../../src/domain/canonical-state.js";
import { seasonalHandlers } from "../fixtures/season-handlers.js";

it("binds explicit context to canonical projection while legacy digest stays separate", async () => {
  const state = { heroes: [], tactics: [], lockedTeams: [] };
  expect(await createNormalizationDigest({ ...state, seasonContext: context })).not.toBe(await createNormalizationDigest(state));
});

it("normalization echoes pair, rejects unverified pairs and keeps the legacy projection separate", async () => {
  const h = await seasonalHandlers();
  const n = await h.call("tqccl_normalize_entities", { observations: [], seasonContext: context });
  expect(n.canonicalState.seasonContext).toEqual(context);
  expect(n.confirmationBinding.canonicalProjectionVersion).not.toBe("projection:v1");
  await expect(h.call("tqccl_normalize_entities", { observations: [], seasonContext: { scenarioId: "x", rulesetId: "y" } })).rejects.toMatchObject({ code: "SEASON_CONTEXT_INVALID" });
  await expect(h.call("tqccl_find_teams", { collection: "engine", seasonContext: { scenarioId: "scenario-a" } } as never)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
});
