import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  assertStageCredentialBoundary,
  loadBuiltRelease,
  parseStageArguments,
  stageBuiltRelease,
  validateReleaseTarget,
  verifyCanonicalDataSource,
} from "../../scripts/stage-data-release.js";
import type { ImmutableReleaseStore } from "../../scripts/publish-data-release.js";
import { stableStringify } from "../../src/domain/contracts.js";

const fixture = new URL("../fixtures/release-snapshot/", import.meta.url);

class MemoryStore implements ImmutableReleaseStore {
  readonly objects = new Map<string, Uint8Array>();

  async putIfAbsent(key: string, bytes: Uint8Array) {
    if (this.objects.has(key)) return { created: false };
    this.objects.set(key, bytes.slice());
    return { created: true };
  }

  async read(key: string) {
    const bytes = this.objects.get(key);
    return bytes === undefined ? null : { bytes: bytes.slice() };
  }
}

describe("stage-data-release driver", () => {
  it("đọc đúng immutable build metadata và bảy release objects", async () => {
    const manifestBytes = new Uint8Array(
      await readFile(new URL("manifest.json", fixture)),
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    const manifestSha256 = `sha256:${[...new Uint8Array(
      await crypto.subtle.digest("SHA-256", manifestBytes),
    )]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;
    const built = await loadBuiltRelease({
      metadata: {
        releaseId: manifest.releaseId,
        dataVersion: manifest.dataVersion,
        manifestSha256,
        sourceTree: "git-tree:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        artifactNames: [
          "teams",
          "team-tier",
          "coexist",
          "heroes-dict",
          "tactics",
          "books-dict",
        ],
      },
      releaseDirectory: fixture,
    });

    expect(built.objects.size).toBe(7);
    expect([...built.objects].at(-1)?.[0]).toMatch(/\/manifest\.json$/u);
    expect(built.buildEvidence).toEqual({
      sourceTree: "git-tree:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      manifestSha256,
    });
    const canonicalManifestSha256 = `sha256:${[...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${stableStringify(manifest)}\n`),
      ),
    )]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;
    const canonicalMetadata = {
      ...built.metadata,
      manifestSha256: canonicalManifestSha256,
    };
    await expect(
      verifyCanonicalDataSource({
        dataRoot: fixture,
        metadata: canonicalMetadata,
      }),
    ).resolves.toBeUndefined();
    await expect(
      verifyCanonicalDataSource({
        dataRoot: fixture,
        metadata: {
          ...canonicalMetadata,
          releaseId:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          dataVersion: "data:aaaaaaaaaaaa",
        },
      }),
    ).rejects.toThrow();
  });

  it("nối metadata vào conditional stage và không chạm pointer", async () => {
    const manifestBytes = new Uint8Array(
      await readFile(new URL("manifest.json", fixture)),
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    const manifestSha256 = `sha256:${[...new Uint8Array(
      await crypto.subtle.digest("SHA-256", manifestBytes),
    )]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}` as const;
    const sourceTree =
      "git-tree:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
    const store = new MemoryStore();
    const verifyPreflight = vi.fn(async () => undefined);
    const verifyRepositoryGate = vi.fn(async () => ({ sourceTree }));

    const result = await stageBuiltRelease({
      metadata: {
        releaseId: manifest.releaseId,
        dataVersion: manifest.dataVersion,
        manifestSha256,
        sourceTree,
        artifactNames: [
          "teams",
          "team-tier",
          "coexist",
          "heroes-dict",
          "tactics",
          "books-dict",
        ],
      },
      releaseDirectory: fixture,
      releaseStore: store,
      verifyPreflight,
      verifyRepositoryGate,
    });

    expect(result.created).toBe(7);
    expect([...store.objects]).toHaveLength(7);
    expect(verifyPreflight).toHaveBeenCalledOnce();
    expect(verifyRepositoryGate).toHaveBeenCalledOnce();
  });

  it("CLI chỉ nhận path/evidence không bí mật và từ chối flag thừa", () => {
    expect(
      parseStageArguments([
        "--metadata",
        "/tmp/build.json",
        "--release-directory",
        "/tmp/release",
        "--environment",
        "staging",
      ]),
    ).toEqual({
      metadataPath: "/tmp/build.json",
      releaseDirectory: "/tmp/release",
      environment: "staging",
    });
    expect(() =>
      parseStageArguments([
        "--metadata",
        "/tmp/build.json",
        "--release-directory",
        "/tmp/release",
        "--environment",
        "staging",
        "--token",
        "secret",
      ]),
    ).toThrow();
    expect(() =>
      validateReleaseTarget(
        "staging",
        "tqccl-release-objects",
        "tqccl-release-pointer",
      ),
    ).toThrow();
    for (const name of [
      "TQCCL_R2_POINTER_ACCESS_KEY_ID",
      "TQCCL_R2_POINTER_SECRET_ACCESS_KEY",
      "CLOUDFLARE_API_TOKEN",
    ]) {
      expect(() =>
        assertStageCredentialBoundary({ [name]: "private" }),
      ).toThrow();
    }
  });
});
