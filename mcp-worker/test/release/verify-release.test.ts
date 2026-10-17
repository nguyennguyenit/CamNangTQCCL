import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { toJSONSchema } from "zod";

import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { WORKFLOW_BUILD_ID } from "../../src/generated/workflow-build.js";
import { createWorker, type WorkerEnvironment } from "../../src/worker.js";
import {
  matchesExpectedToolCatalog,
  parseVerifyReleaseArguments,
  readReleaseIdentity,
  ReleaseVerificationError,
  verifyRelease,
  type ReleaseVerificationFixture,
} from "../../scripts/verify-release.js";
import { slimListedTool } from "../../src/mcp/slim-tool-list.js";
import { TOOL_DEFINITIONS } from "../../src/mcp/tool-definitions.js";
import { toScrubSafeDigest } from "../../src/domain/digest-encoding.js";
import { repositoryDataRoot } from "../fixtures/publication-sources.js";
import { ARTIFACT_NAMES, SEASON_ARTIFACT_NAMES, createDataManifest, validateDataSnapshot, type ArtifactName } from "../../src/data/artifact-contracts.js";

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);
const bearer = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const workerVersionId = "11111111-2222-4333-8444-555555555555";
const env = {
  CF_VERSION_METADATA: {
    id: workerVersionId,
  },
  TQCCL_MCP_BEARER_CURRENT: bearer,
  TQCCL_MCP_ALLOWED_ORIGINS: "",
  TQCCL_MCP_MAX_BODY_BYTES: "65536",
  TQCCL_MCP_MAX_RESULT_BYTES: "98304",
  TQCCL_MCP_RATE_MAX: "100",
  TQCCL_MCP_RATE_WINDOW_MS: "60000",
  TQCCL_MCP_MAX_IN_FLIGHT: "4",
} as WorkerEnvironment;

const fixture: ReleaseVerificationFixture = {
  observations: [
    {
      observationId: "hero",
      entityKind: "hero",
      canonicalId: "hero:tuong-a",
      familyId: "hero-family:tuong-a",
      displayName: "Tướng A",
      evidence: {
        sourceScope: "currentTurnImage",
        batchId: "release-verifier",
      },
    },
    {
      observationId: "tactic",
      entityKind: "tactic",
      canonicalId: "tactic:chien-phap-a",
      displayName: "Chiến Pháp A",
      evidence: {
        sourceScope: "currentTurnImage",
        batchId: "release-verifier",
      },
    },
  ],
  teamId: "team-a",
};

const productionFixture = JSON.parse(
  await readFile(new URL("../fixtures/release-verification.json", import.meta.url), "utf8"),
) as ReleaseVerificationFixture;

async function releaseSource(version: number) {
  if (version === 3) return new FilesystemDataSource({ dataRoot: repositoryDataRoot });
  const legacy = new FilesystemDataSource({ dataRoot: fixtureRoot });
  if (version === 1) return legacy;
  const objects = new Map<ArtifactName, Uint8Array>(await Promise.all(ARTIFACT_NAMES.map(async name => [name, new Uint8Array(await readFile(`${fixtureRoot}/${name}.json`))] as const)));
  for (const name of SEASON_ARTIFACT_NAMES) objects.set(name, new TextEncoder().encode('[]'));
  const snapshot = await validateDataSnapshot(await createDataManifest(objects), objects);
  return { load: async () => snapshot };
}

describe("verifyRelease", () => {
  it("từ chối endpoint có userinfo, query hoặc fragment", () => {
    for (const endpoint of [
      "https://user@mcp.example/mcp",
      "https://mcp.example/mcp?target=other",
      "https://mcp.example/mcp#fragment",
    ]) {
      expect(() =>
        parseVerifyReleaseArguments([
          "--endpoint",
          endpoint,
          "--release-id",
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "--workflow-build-id",
          WORKFLOW_BUILD_ID,
          "--worker-version-id",
          workerVersionId,
          "--fixture",
          "/tmp/fixture.json",
        ]),
      ).toThrow();
    }
  });

  it("đối chiếu chính xác mô tả, schema và annotation của đủ bảy tool", () => {
    const catalog = TOOL_DEFINITIONS.map((definition) => ({
      name: definition.name,
      description: definition.description,
      inputSchema: toJSONSchema(definition.inputSchema, { target: "draft-7" }),
      outputSchema: slimListedTool({ outputSchema: toJSONSchema(definition.outputSchema, { target: "draft-7" }) as Record<string, unknown> }).outputSchema,
      annotations: definition.annotations,
    }));

    expect(matchesExpectedToolCatalog(catalog)).toBe(true);
    expect(
      matchesExpectedToolCatalog([
        {
          ...catalog[0],
          inputSchema: {
            type: "object",
            properties: { injected: { type: "string" } },
          },
        },
        ...catalog.slice(1),
      ]),
    ).toBe(false);
    const changed = structuredClone(catalog);
    function changeNestedLimit(value: unknown): boolean {
      if (!value || typeof value !== 'object') return false;
      const node = value as Record<string, unknown>;
      const properties = node.properties as Record<string, Record<string, unknown>> | undefined;
      if (properties?.maxCandidates) { properties.maxCandidates.const = 501; return true; }
      return Object.values(node).some(changeNestedLimit);
    }
    expect(changeNestedLimit(changed[0]!.outputSchema)).toBe(true);
    expect(matchesExpectedToolCatalog(changed)).toBe(false);
  });

  it.each([3])("xác minh health/auth/protocol/catalog và đủ bảy tool trên manifest v%i", async version => {
    const steps: string[] = [];
    const source = await releaseSource(version);
    const snapshot = await source.load();
    let loads = 0;
    const worker = createWorker({
      createDataSource: () => ({
        load: async () => {
          loads += 1;
          return source.load();
        },
      }),
      now: () => Date.parse("2026-07-29T00:00:00.000Z"),
    });
    const fetcher: typeof fetch = async (input, init) =>
      worker.fetch(new Request(input, init), env);

    try {
      const result = await verifyRelease({
        endpoint: new URL("https://mcp.example/mcp"),
        bearer,
        expectedReleaseId: snapshot.releaseId,
        expectedWorkflowBuildId: WORKFLOW_BUILD_ID,
        expectedWorkerVersionId: workerVersionId,
        fixture: productionFixture,
        fetcher,
        onStep: (step) => steps.push(step),
      });
      expect(result).toMatchObject({
        verified: true,
        releaseId: snapshot.releaseId,
        workerVersionId,
        tools: 7,
        protocolVersion: "2025-11-25",
      });
      expect(loads).toBeGreaterThan(0);
    } catch (error) {
      throw new Error(`Verifier trace: ${steps.slice(-5).join(" > ")}`, {
        cause: error,
      });
    }
  });

  it.each([3])("đóng dấu exact Worker version và data identity v%i cho rollback rehearsal", async version => {
    const source = await releaseSource(version);
    const worker = createWorker({
      createDataSource: () => source,
      now: () => Date.parse("2026-07-29T00:00:00.000Z"),
    });
    const fetcher: typeof fetch = async (input, init) =>
      worker.fetch(new Request(input, init), env);

    const steps: string[] = [];
    const first = await readReleaseIdentity({
      endpoint: new URL("https://mcp.example/mcp"),
      bearer,
      expectedWorkerVersionId: workerVersionId,
      fetcher,
      onStep: (step) => steps.push(step),
    });
    const second = await readReleaseIdentity({
      endpoint: new URL("https://mcp.example/mcp"),
      bearer,
      expectedWorkerVersionId: workerVersionId,
      fetcher,
    });

    expect(second).toEqual(first);
    expect(first.snapshotDigest).toMatch(/^sha256:[a-f0-9]{64}$/u);
    // workflowVersion nhúng bản mã hoá scrub-safe của cùng releaseId đó.
    expect(first.workflowVersion).toContain(toScrubSafeDigest(first.releaseId));
    expect(steps).toContain("protocol");
    expect(steps).toContain("catalog");
    expect(steps).toContain("data-version");
    expect(steps.at(-1)).toBe("verified");
  });

  it.each([1, 2])("không xác minh release trên manifest v%i (chỉ v3 là release hợp lệ)", async version => {
    const source = await releaseSource(version);
    const snapshot = await source.load();
    const worker = createWorker({ createDataSource: () => source, now: () => Date.parse("2026-07-29T00:00:00.000Z") });
    const fetcher: typeof fetch = async (input, init) => worker.fetch(new Request(input, init), env);
    await expect(
      readReleaseIdentity({ endpoint: new URL("https://mcp.example/mcp"), bearer, expectedWorkerVersionId: workerVersionId, fetcher }),
    ).rejects.toBeInstanceOf(ReleaseVerificationError);
    await expect(
      verifyRelease({
        endpoint: new URL("https://mcp.example/mcp"),
        bearer,
        expectedReleaseId: snapshot.releaseId,
        expectedWorkflowBuildId: WORKFLOW_BUILD_ID,
        expectedWorkerVersionId: workerVersionId,
        fixture,
        fetcher,
      }),
    ).rejects.toBeInstanceOf(ReleaseVerificationError);
  });

  it("ghi stage an toàn khi runtime Worker version không khớp", async () => {
    const steps: string[] = [];
    await expect(
      readReleaseIdentity({
        endpoint: new URL("https://mcp.example/mcp"),
        bearer,
        expectedWorkerVersionId: workerVersionId,
        fetcher: async () => new Response(null, { status: 200 }),
        onStep: (step) => steps.push(step),
      }),
    ).rejects.toBeInstanceOf(ReleaseVerificationError);
    expect(steps.at(-1)).toBe("worker-version-missing");
  });

  it("báo status và loại header của từng response để evidence ghi được lần fail cuối", async () => {
    // Response 429 RATE_LIMITED vẫn mang đúng header version; evidence cần status mới phân biệt được.
    const observations: Array<{ status: number; version: string }> = [];
    await expect(
      verifyRelease({
        endpoint: new URL("https://mcp.example/mcp"),
        bearer,
        expectedReleaseId: `sha256:${"a".repeat(64)}`,
        expectedWorkflowBuildId: WORKFLOW_BUILD_ID,
        expectedWorkerVersionId: workerVersionId,
        fixture,
        fetcher: async (input) =>
          new URL(new Request(input).url).pathname === "/healthz"
            ? new Response(null, { status: 200 })
            : new Response(null, { status: 429, headers: { "TQCCL-MCP-Worker-Version": workerVersionId } }),
        onResponse: (observation) => observations.push(observation),
      }),
    ).rejects.toBeInstanceOf(ReleaseVerificationError);
    expect(observations[0]).toEqual({ status: 200, version: "missing" });
    expect(observations.at(-1)).toEqual({ status: 429, version: "expected" });
  });

  it("không phản chiếu bearer khi xác minh thất bại", async () => {
    const privateBearer = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

    try {
      await verifyRelease({
        endpoint: new URL("https://mcp.example/mcp"),
        bearer: privateBearer,
        expectedReleaseId:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        expectedWorkflowBuildId: WORKFLOW_BUILD_ID,
        expectedWorkerVersionId: workerVersionId,
        fixture,
        fetcher: async () => new Response("private upstream body", { status: 500 }),
      });
      throw new Error("expected failure");
    } catch (error) {
      expect(String(error)).not.toContain(privateBearer);
      expect(String(error)).not.toContain("private upstream body");
    }
  });
});
