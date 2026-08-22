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

  it("indexes normalized aliases without using raw input as an object key", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const result = index.search("Lu Mong", {
      kinds: ["hero"],
      limit: 10,
    });

    expect(result.map(({ displayName }) => displayName)).toContain("Lữ Mông");
    expect(result.every(({ artifact }) => artifact === "heroes-dict")).toBe(
      true,
    );
  });

  it("returns deterministic search ordering and hard bounds", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const first = index.search("", { limit: 5 });
    const second = index.search("", { limit: 5 });

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
  });

  it("reports which term produced the match, in its readable form", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const [match] = index.search("Hoàng Quan Thương", {
      kinds: ["team"],
      limit: 1,
    });

    expect(match?.canonicalId).toBe("team:team-intro-2");
    expect(match?.displayName).toBe("Vũ Tung Úc");
    // Nguyên văn, không phải dạng đã bỏ dấu dùng để so khớp.
    expect(match?.matchedTerm).toBe("Hoàng Quan Thương");
  });

  it("reports the display name when the primary name matched", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const [match] = index.search("Vũ Tung Mông", { kinds: ["team"], limit: 1 });

    expect(match?.matchedTerm).toBe(match?.displayName);
  });

  it("omits the matched term when browsing without a query", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const browsed = index.search("", { limit: 3 });

    expect(browsed).toHaveLength(3);
    for (const entry of browsed) {
      expect(entry).not.toHaveProperty("matchedTerm");
    }
  });

  it("prefers the strongest match over the earliest declared term", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const [match] = index.search("team-intro", { kinds: ["team"], limit: 1 });

    // id "team-intro-45" chỉ khớp tiền tố, source "team-intro" khớp chính xác.
    expect(match?.matchedTerm).toBe("team-intro");
  });

  it("breaks equal-score ties on the first declared term, not on map order", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const first = index.search("ntro", { kinds: ["team"], limit: 5 });
    const second = index.search("ntro", { kinds: ["team"], limit: 5 });

    expect(first.map(({ matchedTerm }) => matchedTerm)).toEqual(
      second.map(({ matchedTerm }) => matchedTerm),
    );
    // Cả id lẫn source đều chỉ chứa "ntro"; id được khai báo trước.
    expect(first[0]?.matchedTerm).toBe(first[0]?.recordId);
  });

  it("keeps ranking order unchanged when the matched term is added", async () => {
    const index = buildSnapshotIndex(await realSnapshot());
    const ranked = index.search("Thương", { kinds: ["team"], limit: 8 });

    expect(ranked.map(({ canonicalId }) => canonicalId)).toEqual([
      "team:do-uy-60",
      "team:team-intro-7",
      "team:team-intro-4",
      "team:team-intro-6",
      "team:team-intro-5",
      "team:team-intro-52",
      "team:team-intro-1",
      "team:do-uy-71",
    ]);
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
