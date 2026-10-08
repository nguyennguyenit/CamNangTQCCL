import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { canonicalHeroId, heroFamilyId } from "../../js/hero-identity.js";
import { canonicalTacticId } from "../../js/team-recommend-engine.js";

import {
  CLI_ALIASES,
  parseCliArgs,
} from "../src/cli.js";
import { FilesystemDataSource } from "../src/data/filesystem-data-source.js";
import { RESEARCH_TOOL_NAMES } from "../src/research/research-contracts.js";
import { createResearchHandlers } from "../src/research/research-handlers.js";
import {
  createActivatedRoot,
  createPackagedRoot,
  encodeJson,
  removeCreatedRoots,
} from "./fixtures/lookup-roots.js";

const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const tsxLoaderPath = fileURLToPath(import.meta.resolve("tsx"));
const fixtureRoot = fileURLToPath(new URL("../../data", import.meta.url));

function runCli(
  args: readonly string[],
  cwd = "/tmp",
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", tsxLoaderPath, cliPath, ...args],
      {
        cwd,
        env: {
          ...process.env,
          NO_COLOR: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("CLI argument contract", () => {
  it("maps exact handler names and compact aliases one-to-one", () => {
    expect(Object.values(CLI_ALIASES)).toEqual(RESEARCH_TOOL_NAMES);
    expect(
      parseCliArgs([
        "search",
        "--input",
        JSON.stringify({ query: "Tướng A" }),
      ]),
    ).toEqual({
      help: false,
      handlerName: "tqccl_search",
      input: { query: "Tướng A" },
    });
  });

  it("rejects unknown commands and malformed JSON as usage errors", () => {
    expect(() => parseCliArgs(["unknown"])).toThrow("CLI_USAGE");
    expect(() =>
      parseCliArgs(["search", "--input", "{bad"]),
    ).toThrow("CLI_USAGE");
    expect(() =>
      parseCliArgs([
        "search",
        "--input",
        JSON.stringify({ query: "x".repeat(300_000) }),
      ]),
    ).toThrow("CLI_USAGE");
  });
});

describe("JSON CLI integration", () => {
  it("documents all seven handlers, aliases and the CLI-only search-rules command in help", async () => {
    const result = await runCli(["--help"]);

    expect(result.code).toBe(0);
    for (const name of RESEARCH_TOOL_NAMES) {
      expect(result.stdout).toContain(name);
    }
    for (const alias of [...Object.keys(CLI_ALIASES), "search-rules"]) {
      expect(result.stdout).toContain(alias);
    }
    expect(result.stderr).toBe("");
  });

  it("loads repository data from a non-repository CWD", async () => {
    const result = await runCli(["playbook", "--input", JSON.stringify({ intent: "lookup" })]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout);
    expect(output.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/);
    // The repository checkout publishes snapshot v3: eleven v2 artifacts plus the publication projection.
    expect(output.manifestVersion).toBe(3);
    expect(output.capabilities).toMatchObject({ catalog: true, reference: true, recommend: true });
  });

  it("emits exactly one JSON success document with no diagnostics on stdout", async () => {
    const result = await runCli([
      "search",
      "--input",
      JSON.stringify({ query: "Lữ Mông", limit: 2 }),
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const output = JSON.parse(result.stdout);
    expect(output.items[0]?.displayName).toContain("Lữ Mông");
  });

  it("emits one redacted JSON usage error and exits 2", async () => {
    const result = await runCli(["search", "--input", "{bad"]);

    expect(result.code).toBe(2);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toEqual({
      error: {
        code: "CLI_USAGE",
        message: "Tham số CLI không hợp lệ.",
        retryable: false,
      },
    });
    expect(result.stdout).not.toContain("{bad");
  });

  it("maps handler errors to exit 1 without leaking input or local paths", async () => {
    const privateInput = "../private/manifest.json";
    const version = await runCli(["playbook", "--input", JSON.stringify({ intent: "lookup" })]);
    const workflowVersion = JSON.parse(version.stdout).workflowVersion;
    const result = await runCli([
      "team",
      "--input",
      JSON.stringify({
        reference: { collection: "recommended", sourceConfigId: privateInput },
        expectedWorkflowVersion: workflowVersion,
      }),
    ]);

    expect(result.code).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.error.code).toBe("REFERENCE_NOT_FOUND");
    expect(result.stdout).not.toContain(privateInput);
    expect(result.stdout).not.toContain("/Users/");
  });

  it("matches shared handler semantics for all seven commands with an explicit data root", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const evidence = { sourceScope: "currentTurnImage" as const, batchId: "cli-parity" };
    const team = (await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 1 })).items[0]!;
    const observations = [
      ...team.heroes.map((hero, index) => ({
        observationId: `hero-${index}`,
        entityKind: "hero" as const,
        canonicalId: canonicalHeroId(hero.nameVi) as `hero:${string}`,
        familyId: heroFamilyId(hero.nameVi) as `hero-family:${string}`,
        displayName: hero.nameVi,
        evidence,
      })),
      ...team.heroes.flatMap((hero, index) =>
        hero.tactics.map((tactic, slot) => ({
          observationId: `tactic-${index}-${slot}`,
          entityKind: "tactic" as const,
          canonicalId: canonicalTacticId(tactic.vi ?? "") as `tactic:${string}`,
          displayName: tactic.vi ?? "",
          evidence,
        })),
      ),
    ];
    const normalized = await handlers.call("tqccl_normalize_entities", { observations });
    const entity = (await handlers.call("tqccl_search", { query: "Thanh Long", kinds: ["equipment"], limit: 1 })).items[0]!;
    const requests = {
      tqccl_get_playbook: { intent: "lookup" as const },
      tqccl_search: { query: "Thanh Long", limit: 5 },
      tqccl_get_entity: { entityId: entity.entityId },
      tqccl_find_teams: { collection: "recommended" as const, limit: 3 },
      tqccl_get_team: { reference: team.reference, expectedWorkflowVersion: normalized.workflowVersion },
      tqccl_normalize_entities: { observations },
      tqccl_recommend_teams: {
        expectedWorkflowVersion: normalized.workflowVersion,
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
        sourceSeasonId: team.sourceSeasonId!,
      },
    } as const;

    for (const name of RESEARCH_TOOL_NAMES) {
      const expected = await handlers.call(name, requests[name] as never);
      const result = await runCli([
        name,
        "--data-root",
        fixtureRoot,
        "--input",
        JSON.stringify(requests[name]),
      ]);
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toEqual(expected);
    }
  });
});

describe("CLI-only search-rules", () => {
  it("calls the knowledge core directly and is not an MCP tool", async () => {
    expect(RESEARCH_TOOL_NAMES as readonly string[]).not.toContain("tqccl_search_rules");
    const result = await runCli(["search-rules", "--input", JSON.stringify({ workflow: "coexist", query: "mùa" })]);
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ requiredRules: expect.any(Array) });
    const bad = await runCli(["search-rules", "--input", JSON.stringify({ workflow: "khong-co" })]);
    expect(bad.code).toBe(1);
    expect(JSON.parse(bad.stdout).error.code).toMatch(/^(INVALID_REQUEST|PLAYBOOK_NOT_FOUND)$/u);
  });
});

describe("CLI filesystem root formats", () => {
  afterEach(removeCreatedRoots);

  it("dùng được cả packaged MCP release root và activated raw root", async () => {
    const packagedRoot = await createPackagedRoot();
    const activated = await createActivatedRoot();

    for (const dataRoot of [packagedRoot, activated.dataRoot]) {
      const result = await runCli(["playbook", "--input", JSON.stringify({ intent: "lookup" }), "--data-root", dataRoot]);

      expect(result.stderr).toBe("");
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout).releaseId).toMatch(
        /^sha256:[a-f0-9]{64}$/,
      );
    }
  });

  it("trả DATA_UNAVAILABLE đã redact cho root trộn, lookup sai hoặc transaction dở dang", async () => {
    const mixed = await createPackagedRoot({ withSidecars: true });
    const tampered = await createActivatedRoot({
      payloadOverrides: { "tactics.json": encodeJson([]) },
    });
    const interrupted = await createActivatedRoot({
      transaction: { state: "writing" },
    });

    for (const dataRoot of [mixed, tampered.dataRoot, interrupted.dataRoot]) {
      const result = await runCli(["playbook", "--input", JSON.stringify({ intent: "lookup" }), "--data-root", dataRoot]);

      expect(result.code).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: {
          code: "DATA_UNAVAILABLE",
          message: "Dữ liệu nghiên cứu hiện không khả dụng.",
        },
      });
      expect(result.stdout).not.toContain(dataRoot);
      expect(result.stdout).not.toContain("lookup");
    }
  });
});
