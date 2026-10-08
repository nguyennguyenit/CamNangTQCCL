import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildKnowledgeArtifacts,
  computeKnowledgeVersion,
  loadKnowledgeBundle,
} from "../../scripts/generate-knowledge-bundle.js";
import { KNOWLEDGE_VERSION } from "../../src/generated/knowledge-bundle.js";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const repoRoot = join(packageRoot, "..");
const sourceDir = join(repoRoot, "agent-knowledge");
const generatedPath = join(packageRoot, "src/generated/knowledge-bundle.ts");

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function copyDataset(): string {
  const root = mkdtempSync(join(tmpdir(), "knowledge-"));
  temporary.push(root);
  cpSync(sourceDir, join(root, "agent-knowledge"), { recursive: true });
  return join(root, "agent-knowledge");
}

function runCheck(source: string, output = generatedPath): { ok: boolean; stderr: string } {
  try {
    execFileSync(
      process.execPath,
      ["--import", "tsx", "scripts/generate-knowledge-bundle.ts", "--check", "--source", source, "--output", output],
      { cwd: packageRoot, stdio: "pipe" },
    );
    return { ok: true, stderr: "" };
  } catch (error) {
    const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : String(error);
    return { ok: false, stderr };
  }
}

describe("generate-knowledge-bundle", () => {
  it("the checked-in bundle and schemas match agent-knowledge/", () => {
    expect(runCheck(sourceDir)).toEqual({ ok: true, stderr: "" });
    const artifacts = buildKnowledgeArtifacts(sourceDir);
    expect(artifacts.version).toBe(KNOWLEDGE_VERSION);
    expect(readFileSync(generatedPath, "utf8")).toBe(artifacts.module);
  });

  it("--check fails when a rule changes without regenerating", () => {
    const copy = copyDataset();
    const path = join(copy, "rules/lookup.jsonl");
    writeFileSync(path, readFileSync(path, "utf8").replace("Tra bảy nhóm Tra cứu", "Tra bảy nhóm Tra cứu (sửa)"));
    const result = runCheck(copy);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("stale");
  });

  it("--check fails when a schema file drifts", () => {
    const copy = copyDataset();
    writeFileSync(join(copy, "schemas/rule.schema.json"), "{}\n");
    const result = runCheck(copy);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("rule.schema.json");
  });

  it("rejects an invalid dataset instead of generating", () => {
    const copy = copyDataset();
    const path = join(copy, "rules/lookup.jsonl");
    const lines = readFileSync(path, "utf8").trimEnd().split("\n");
    writeFileSync(path, `${lines.join("\n")}\n${lines[0]}\n`);
    const result = runCheck(copy);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("DUPLICATE_RULE_ID");
  });

  it("rejects a rule placed in the wrong rules file", () => {
    const copy = copyDataset();
    const lookup = readFileSync(join(copy, "rules/lookup.jsonl"), "utf8");
    const coexist = join(copy, "rules/coexist.jsonl");
    writeFileSync(coexist, `${readFileSync(coexist, "utf8")}${lookup.split("\n")[0]}\n`);
    expect(loadFailure(copy)).toContain("đặt sai file");
  });

  it("knowledgeVersion follows content, not file layout", () => {
    const original = loadKnowledgeBundle(sourceDir);
    const changed = structuredClone(original);
    const first = changed.rules[0];
    if (first === undefined) throw new Error("dataset has no rules");
    first.revision += 1;
    expect(computeKnowledgeVersion(original)).toBe(KNOWLEDGE_VERSION);
    expect(computeKnowledgeVersion(changed)).not.toBe(KNOWLEDGE_VERSION);
    expect(KNOWLEDGE_VERSION).toMatch(/^knowledge:sha256b64:[A-Za-z0-9_-]{43}$/u);
  });

  it("ships the five JSON schemas", () => {
    expect(readdirSync(join(sourceDir, "schemas")).sort()).toEqual([
      "aliases.schema.json",
      "manifest.schema.json",
      "rule.schema.json",
      "work-packet.schema.json",
      "workflow.schema.json",
    ]);
  });
});

function loadFailure(source: string): string {
  try {
    loadKnowledgeBundle(source);
  } catch (error) {
    return (error as Error).message;
  }
  return "";
}

describe("knowledge core is Worker-safe", () => {
  it("no src/knowledge or generated module imports node:*", () => {
    const files = [
      ...readdirSync(join(packageRoot, "src/knowledge")).map((name) => join(packageRoot, "src/knowledge", name)),
      generatedPath,
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/from\s+["']node:|require\(["']node:|import\(["']node:/u);
    }
  });
});
