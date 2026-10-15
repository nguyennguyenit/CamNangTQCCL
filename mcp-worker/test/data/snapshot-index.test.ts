import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  ARTIFACT_NAMES,
  createDataManifest,
  validateDataSnapshot,
  type ArtifactName,
} from "../../src/data/artifact-contracts.js";
import {
  SnapshotIndexError,
  buildSnapshotIndex,
} from "../../src/data/snapshot-index.js";

async function realSnapshot() {
  const objects = new Map(
    await Promise.all(
      ARTIFACT_NAMES.map(async (name) => [
        name,
        new Uint8Array(
          await readFile(new URL(`../../../data/${name}.json`, import.meta.url)),
        ),
      ] as const),
    ),
  );
  return validateDataSnapshot(await createDataManifest(objects), objects);
}

describe("snapshot index", () => {
  it("precomputes stable team and tier maps once per release", async () => {
    const snapshot = await realSnapshot();
    const index = buildSnapshotIndex(snapshot);
    const firstTeam = snapshot.artifacts.teams[0]!;

    expect(index.releaseId).toBe(snapshot.releaseId);
    expect(index.teamsById.get(firstTeam.id as string)).toBe(firstTeam);
    expect(index.tierByTeam).toBeInstanceOf(Map);
    expect(index.searchEntries.length).toBeGreaterThan(0);
  });

  it("keeps SP, CO and base hero identities distinct", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const heroIds = index.searchEntries
      .filter(({ kind }) => kind === "hero")
      .map(({ canonicalId }) => canonicalId);

    expect(heroIds).toContain("hero:sp-lu-mong");
    expect(heroIds).toContain("hero:lu-mong");
    expect(new Set(heroIds).size).toBe(heroIds.length);
  });

  it("fails closed on duplicate canonical dictionary identity", async () => {
    const snapshot = await realSnapshot();
    const duplicate = {
      ...snapshot,
      artifacts: {
        ...snapshot.artifacts,
        "heroes-dict": [
          { viet: "SP Lữ Mông" },
          { viet: "SP Lữ Mông" },
        ],
      },
    };

    expect(() => buildSnapshotIndex(duplicate)).toThrow(SnapshotIndexError);
  });

  it("does not mutate validated snapshot arrays", async () => {
    const snapshot = await realSnapshot();
    const before = JSON.stringify(snapshot.artifacts["team-tier"]);
    buildSnapshotIndex(snapshot);

    expect(JSON.stringify(snapshot.artifacts["team-tier"])).toBe(before);
  });
});
