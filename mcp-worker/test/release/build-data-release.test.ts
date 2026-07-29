import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ARTIFACT_NAMES, validateManifest } from "../../src/data/artifact-contracts.js";
import {
  buildDataRelease,
  ReleaseBuildError,
} from "../../scripts/build-data-release.js";

const fixtureRoot = new URL("../fixtures/release-snapshot/", import.meta.url);

describe("buildDataRelease", () => {
  it("tạo release deterministic từ đúng sáu artifact và source tree sạch", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "tqccl-release-"));

    const first = await buildDataRelease({
      dataRoot: fixtureRoot,
      outputRoot,
      sourceTree: "git-tree:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      assertCleanSource: async () => undefined,
    });
    const second = await buildDataRelease({
      dataRoot: fixtureRoot,
      outputRoot,
      sourceTree: "git-tree:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      assertCleanSource: async () => undefined,
    });

    expect(second).toEqual(first);
    expect(first.artifactNames).toEqual(ARTIFACT_NAMES);
    expect(first.releaseDirectory).toContain(
      first.releaseId.slice("sha256:".length),
    );
    const manifest = await validateManifest(
      JSON.parse(await readFile(first.manifestPath, "utf8")),
    );
    expect(manifest.releaseId).toBe(first.releaseId);
    for (const descriptor of manifest.artifacts) {
      expect(
        new Uint8Array(
          await readFile(join(first.releaseDirectory, descriptor.key)),
        ),
      ).toEqual(
        new Uint8Array(
          await readFile(new URL(descriptor.key, fixtureRoot)),
        ),
      );
    }
  });

  it("không build khi source bẩn hoặc sourceTree không phải Git tree digest", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "tqccl-release-"));

    await expect(
      buildDataRelease({
        dataRoot: fixtureRoot,
        outputRoot,
        sourceTree: "main",
        assertCleanSource: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_TREE" });
    await expect(
      buildDataRelease({
        dataRoot: fixtureRoot,
        outputRoot,
        sourceTree: "git-tree:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        assertCleanSource: async () => {
          throw new Error("dirty");
        },
      }),
    ).rejects.toMatchObject({ code: "SOURCE_NOT_CLEAN" });
  });

  it("từ chối overwrite khi release key cũ có byte khác", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "tqccl-release-"));
    const options = {
      dataRoot: fixtureRoot,
      outputRoot,
      sourceTree: "git-tree:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      assertCleanSource: async () => undefined,
    } as const;
    const built = await buildDataRelease(options);
    await writeFile(
      join(built.releaseDirectory, "teams.json"),
      "tampered",
    );

    await expect(buildDataRelease(options)).rejects.toBeInstanceOf(
      ReleaseBuildError,
    );
    await expect(buildDataRelease(options)).rejects.toMatchObject({
      code: "EXISTING_RELEASE_MISMATCH",
    });
  });
});
