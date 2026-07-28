import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ARTIFACT_NAMES,
  ArtifactContractError,
  MAX_ARTIFACT_BYTES,
  createDataManifest,
  parseArtifact,
  validateDataSnapshot,
  validateManifest,
  type ArtifactBytes,
  type ArtifactName,
} from "../../src/data/artifact-contracts.js";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

async function committedArtifacts(): Promise<Map<ArtifactName, Uint8Array>> {
  const entries = await Promise.all(
    ARTIFACT_NAMES.map(async (name) => [
      name,
      new Uint8Array(
        await readFile(
          new URL(`../../../data/${name}.json`, import.meta.url),
        ),
      ),
    ] as const),
  );
  return new Map(entries);
}

async function fixtureArtifacts(): Promise<Map<ArtifactName, Uint8Array>> {
  const entries = await Promise.all(
    ARTIFACT_NAMES.map(async (name) => [
      name,
      new Uint8Array(
        await readFile(
          new URL(`../fixtures/release-snapshot/${name}.json`, import.meta.url),
        ),
      ),
    ] as const),
  );
  return new Map(entries);
}

describe("artifact contracts", () => {
  it("parses all six committed artifacts without freezing corpus counts", async () => {
    const artifacts = await committedArtifacts();

    for (const name of ARTIFACT_NAMES) {
      const parsed = parseArtifact(name, artifacts.get(name)!);
      expect(parsed.length).toBeGreaterThan(0);
    }
  });

  it("creates and validates one collision-safe canonical manifest", async () => {
    const artifacts = await committedArtifacts();
    const manifest = await createDataManifest(artifacts);
    const validated = await validateManifest(manifest);
    const snapshot = await validateDataSnapshot(validated, artifacts);

    expect(validated.schemaVersion).toBe(1);
    expect(validated.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(validated.dataVersion).toMatch(/^data:[a-f0-9]{12}$/);
    expect(validated.artifacts.map(({ name }) => name)).toEqual(
      ARTIFACT_NAMES,
    );
    expect(snapshot.releaseId).toBe(validated.releaseId);
    expect(snapshot.dataVersion).toBe(validated.dataVersion);
    expect(snapshot.artifacts.teams.length).toBeGreaterThan(0);
  });

  it("keeps the minimal release fixture pinned to its explicit manifest", async () => {
    const expected = JSON.parse(
      await readFile(
        new URL("../fixtures/release-snapshot/manifest.json", import.meta.url),
        "utf8",
      ),
    );

    expect(await createDataManifest(await fixtureArtifacts())).toEqual(expected);
  });

  it("changes release identity when one artifact byte changes", async () => {
    const original = await committedArtifacts();
    const changed = new Map(original);
    const currentTeams = original.get("teams")!;
    const teams = new Uint8Array(currentTeams.length + 1);
    teams.set(currentTeams);
    teams[teams.length - 1] = 10;
    changed.set("teams", teams);

    const left = await createDataManifest(original);
    const right = await createDataManifest(changed);

    expect(right.releaseId).not.toBe(left.releaseId);
  });

  it("rejects missing, duplicate, unknown and traversal descriptors", async () => {
    const manifest = await createDataManifest(await committedArtifacts());
    const first = manifest.artifacts[0]!;

    await expect(
      validateManifest({
        ...manifest,
        artifacts: manifest.artifacts.slice(1),
      }),
    ).rejects.toThrow("missing required artifact");
    await expect(
      validateManifest({
        ...manifest,
        artifacts: [...manifest.artifacts, first],
      }),
    ).rejects.toThrow("duplicate artifact");
    await expect(
      validateManifest({
        ...manifest,
        artifacts: [
          ...manifest.artifacts,
          {
            ...first,
            name: "unknown",
            key: "unknown.json",
          },
        ],
      }),
    ).rejects.toThrow("unknown artifact");
    await expect(
      validateManifest({
        ...manifest,
        artifacts: manifest.artifacts.map((descriptor, index) =>
          index === 0 ? { ...descriptor, key: "../teams.json" } : descriptor,
        ),
      }),
    ).rejects.toThrow("artifact key");
  });

  it("rejects size, hash, count and used-field corruption before activation", async () => {
    const artifacts = await committedArtifacts();
    const manifest = await createDataManifest(artifacts);
    const wrongBytes = new Map(artifacts);
    wrongBytes.set("books-dict", new TextEncoder().encode("[]"));

    await expect(
      validateDataSnapshot(manifest, wrongBytes),
    ).rejects.toBeInstanceOf(ArtifactContractError);

    const invalidTeams = new Map(artifacts);
    invalidTeams.set(
      "teams",
      new TextEncoder().encode(JSON.stringify([{ id: "", heroes: "wrong" }])),
    );
    await expect(
      createDataManifest(invalidTeams),
    ).rejects.toThrow("teams[0]");
  });

  it("rejects canonical dictionary collisions and oversized artifacts before activation", async () => {
    const collision = await committedArtifacts();
    collision.set(
      "heroes-dict",
      new TextEncoder().encode(
        JSON.stringify([{ viet: "A" }, { viet: "Á" }]),
      ),
    );
    await expect(createDataManifest(collision)).rejects.toThrow(
      "duplicate canonical identity",
    );

    expect(() =>
      parseArtifact(
        "books-dict",
        new Uint8Array(MAX_ARTIFACT_BYTES + 1),
      ),
    ).toThrow("size limit");
  });

  it("tolerates unknown future fields and reports weak cross references", async () => {
    const artifacts: ArtifactBytes = new Map([
      [
        "teams",
        new TextEncoder().encode(
          JSON.stringify([
            {
              id: "team-a",
              name: "Đội A",
              heroes: [],
              futureField: { nested: true },
            },
          ]),
        ),
      ],
      [
        "team-tier",
        new TextEncoder().encode(
          JSON.stringify([
            {
              teamId: "missing-team",
              rankings: [{ tier: "T0", future: true }],
            },
          ]),
        ),
      ],
      ["coexist", new TextEncoder().encode("[]")],
      [
        "heroes-dict",
        new TextEncoder().encode(
          JSON.stringify([{ viet: "Tướng A", future: true }]),
        ),
      ],
      [
        "tactics",
        new TextEncoder().encode(
          JSON.stringify([{ viet: "Chiến Pháp A", future: true }]),
        ),
      ],
      [
        "books-dict",
        new TextEncoder().encode(
          JSON.stringify([{ viet: "Binh Thư A", future: true }]),
        ),
      ],
    ]);
    const manifest = await createDataManifest(artifacts);
    const snapshot = await validateDataSnapshot(manifest, artifacts);

    expect(snapshot.warnings).toContain(
      "tier-team-not-found:missing-team",
    );
  });

  it("does not leak repository paths in validation errors", () => {
    expect(repositoryRoot).not.toBe("");
    expect(() =>
      parseArtifact("teams", new TextEncoder().encode("{bad json")),
    ).toThrow("artifact teams contains invalid JSON");
    try {
      parseArtifact("teams", new TextEncoder().encode("{bad json"));
    } catch (error) {
      expect(String(error)).not.toContain(repositoryRoot);
    }
  });
});
