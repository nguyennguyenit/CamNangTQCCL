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
import { createTacticNameResolver } from "../../src/data/entity-identity.js";

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

  it("keys a renamed tactic by its published id and resolves old/new names deterministically", async () => {
    const snapshot = await realSnapshot();
    const renamed = [
      { id: "tactic:chan-hai-tu-canh", viet: "Bốn Bề Rung Động", hanViet: "Chấn Hãi Tứ Cảnh", aliases: ["Chấn Hãi Tứ Cảnh"] },
      { id: "tactic:di-hoa-tiep-moc", viet: "Lập Lờ Đánh Tráo", hanViet: "Di Hoa Tiếp Mộc", aliases: ["Di Hoa Tiếp Mộc"] },
      { id: "tactic:lap-lo-danh-trao", viet: "Lập Lờ Đánh Tráo", hanViet: "Lập Lờ Đánh Tráo", aliases: [] },
    ];
    const index = buildSnapshotIndex({
      ...snapshot,
      artifacts: { ...snapshot.artifacts, tactics: renamed } as never,
    });
    const ids = index.searchEntries.filter(({ kind }) => kind === "tactic").map(({ canonicalId }) => canonicalId);
    expect(ids.sort()).toEqual(renamed.map((row) => row.id).sort());

    const resolve = createTacticNameResolver(renamed);
    expect(resolve("Bốn Bề Rung Động")).toBe("tactic:chan-hai-tu-canh");
    expect(resolve("Chấn Hãi Tứ Cảnh")).toBe("tactic:chan-hai-tu-canh");
    expect(resolve("Di Hoa Tiếp Mộc")).toBe("tactic:di-hoa-tiep-moc");
    // Duplicate new name: the row whose id slug equals the name wins.
    expect(resolve("Lập Lờ Đánh Tráo")).toBe("tactic:lap-lo-danh-trao");
    expect(resolve("Không Có")).toBeNull();
  });

  it("prefers the current display name over another row's stale Hán-Việt spelling", () => {
    const resolve = createTacticNameResolver([
      { id: "tactic:di-hoa-tiep-moc", viet: "Lập Lờ Đánh Tráo", hanViet: "Di Hoa Tiếp Mộc", aliases: [] },
      { id: "tactic:lap-lo-danh-trao", viet: "Ám Độ Trần Thương", hanViet: "Lập Lờ Đánh Tráo", aliases: [] },
    ]);
    expect(resolve("Lập Lờ Đánh Tráo")).toBe("tactic:di-hoa-tiep-moc");
    expect(resolve("Ám Độ Trần Thương")).toBe("tactic:lap-lo-danh-trao");
  });

  it("keys a renamed book by its frozen id; rows without id or sharing an id fail closed (no name-slug fallback)", async () => {
    const snapshot = await realSnapshot();
    const renamed = [
      { id: "book:di-truc-bao-oan", chinese: "以直报怨", viet: "Lấy Thẳng Báo Oán", aliases: ["Dĩ Trực Báo Oán"] },
      { id: "book:khai-hap", chinese: "开合", viet: "Khai Hạp" },
    ];
    const index = buildSnapshotIndex({ ...snapshot, artifacts: { ...snapshot.artifacts, "books-dict": renamed } as never });
    expect(index.searchEntries.filter(({ kind }) => kind === "book").map(({ canonicalId }) => canonicalId).sort()).toEqual(["book:di-truc-bao-oan", "book:khai-hap"]);
    for (const books of [[{ chinese: "无", viet: "Không Id" }], [{ id: "", viet: "Id Rỗng" }], [{ id: "book:a", viet: "A" }, { id: "book:a", viet: "B" }]]) {
      expect(() => buildSnapshotIndex({ ...snapshot, artifacts: { ...snapshot.artifacts, "books-dict": books } as never })).toThrow(SnapshotIndexError);
    }
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
