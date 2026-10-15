import { seasonConsumerFixture } from "../../../tests-js/fixtures/season-fixtures.mjs";
import { createDataManifest, validateDataSnapshot, type ArtifactName } from "../../src/data/artifact-contracts.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";

/** Handlers trên snapshot v2 (có season sidecar, không có publication). */
export async function seasonalHandlers() {
  const data = { ...(await seasonConsumerFixture()), "team-tier": [] };
  const bytes = new Map(Object.entries(data).map(([name, value]) => [name as ArtifactName, new TextEncoder().encode(JSON.stringify(value))]));
  const snapshot = await validateDataSnapshot(await createDataManifest(bytes), bytes);
  return createResearchHandlers({ dataSource: { load: async () => snapshot } });
}
