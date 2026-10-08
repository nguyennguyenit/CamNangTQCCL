import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { stableStringify } from "../src/domain/contracts.js";
import { toScrubSafeDigest } from "../src/domain/digest-encoding.js";
import {
  AliasFileSchema,
  ManifestSchema,
  RuleSchema,
  WorkPacketSchema,
  WorkflowFileSchema,
  type KnowledgeBundle,
} from "../src/knowledge/rule-contracts.js";
import { validateKnowledgeBundle } from "../src/knowledge/validate-knowledge.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const DEFAULT_SOURCE = resolve(repositoryRoot, "agent-knowledge");
const DEFAULT_OUTPUT = resolve(packageRoot, "src/generated/knowledge-bundle.ts");

const VERSION_DOMAIN = "tqccl:knowledge-bundle:v1\0";

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON ${path}: ${(error as Error).message}`);
  }
}

function readJsonl(path: string): unknown[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .flatMap((line, index) => {
      if (line.trim() === "") return [];
      try {
        return [JSON.parse(line) as unknown];
      } catch (error) {
        throw new Error(`Invalid JSONL ${path}:${index + 1}: ${(error as Error).message}`);
      }
    });
}

/** rules/<workflow>.jsonl chỉ chứa rule của đúng workflow đó; core.jsonl chứa rule nhiều workflow. */
function assertPlacement(file: string, rules: readonly z.infer<typeof RuleSchema>[]): void {
  const name = file.replace(/^.*\//u, "").replace(/\.jsonl$/u, "");
  for (const rule of rules) {
    const ok =
      name === "core"
        ? rule.workflows.length > 1
        : rule.workflows.length === 1 && rule.workflows[0] === name;
    if (!ok) {
      throw new Error(`Rule "${rule.id}" đặt sai file ${file} (workflows: ${rule.workflows.join(",")})`);
    }
  }
}

export function loadKnowledgeBundle(sourceDir: string): KnowledgeBundle {
  const manifest = ManifestSchema.parse(readJson(join(sourceDir, "manifest.json")));
  const workflows = WorkflowFileSchema.parse(readJson(join(sourceDir, manifest.files.workflows)));
  const aliases = AliasFileSchema.parse(readJson(join(sourceDir, manifest.files.aliases)));
  const rules = manifest.files.rules.flatMap((file) => {
    const parsed = readJsonl(join(sourceDir, file)).map((entry) => RuleSchema.parse(entry));
    assertPlacement(file, parsed);
    return parsed;
  });
  rules.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const result = validateKnowledgeBundle({
    schemaVersion: 1,
    manifest,
    workflows,
    aliases,
    rules,
  });
  if (!result.ok) {
    throw new Error(
      `Knowledge dataset không hợp lệ:\n${result.issues
        .map((issue) => `- [${issue.code}] ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  return result.bundle;
}

export function computeKnowledgeVersion(bundle: KnowledgeBundle): string {
  const digest = createHash("sha256")
    .update(VERSION_DOMAIN)
    .update(stableStringify(bundle))
    .digest("hex");
  return `knowledge:${toScrubSafeDigest(`sha256:${digest}`)}`;
}

function renderModule(bundle: KnowledgeBundle, version: string): string {
  return `// Tệp được sinh bởi scripts/generate-knowledge-bundle.ts từ agent-knowledge/. Không sửa thủ công.
import type { KnowledgeBundle } from "../knowledge/rule-contracts.js";

export const KNOWLEDGE_VERSION = ${JSON.stringify(version)} as const;
export const KNOWLEDGE_BUNDLE: KnowledgeBundle = ${JSON.stringify(bundle, null, 2)};
`;
}

const SCHEMAS: Record<string, z.ZodType> = {
  "rule.schema.json": RuleSchema,
  "workflow.schema.json": WorkflowFileSchema,
  "manifest.schema.json": ManifestSchema,
  "aliases.schema.json": AliasFileSchema,
  "work-packet.schema.json": WorkPacketSchema,
};

export function renderSchemas(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SCHEMAS).map(([name, schema]) => [
      name,
      `${JSON.stringify(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }), null, 2)}\n`,
    ]),
  );
}

export interface KnowledgeArtifacts {
  version: string;
  module: string;
  schemas: Record<string, string>;
}

export function buildKnowledgeArtifacts(sourceDir: string): KnowledgeArtifacts {
  const bundle = loadKnowledgeBundle(sourceDir);
  const version = computeKnowledgeVersion(bundle);
  return { version, module: renderModule(bundle, version), schemas: renderSchemas() };
}

export function checkKnowledgeArtifacts(
  artifacts: KnowledgeArtifacts,
  sourceDir: string,
  outputPath: string,
): string[] {
  const stale: string[] = [];
  if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== artifacts.module) {
    stale.push(outputPath);
  }
  for (const [name, content] of Object.entries(artifacts.schemas)) {
    const path = join(sourceDir, "schemas", name);
    if (!existsSync(path) || readFileSync(path, "utf8") !== content) stale.push(path);
  }
  return stale;
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value === undefined ? fallback : resolve(value);
}

function main(): void {
  const sourceDir = option("--source", DEFAULT_SOURCE);
  const outputPath = option("--output", DEFAULT_OUTPUT);
  const artifacts = buildKnowledgeArtifacts(sourceDir);
  if (process.argv.includes("--check")) {
    const stale = checkKnowledgeArtifacts(artifacts, sourceDir, outputPath);
    if (stale.length > 0) {
      throw new Error(
        `Knowledge bundle is stale (${stale.join(", ")}); run npm run generate:knowledge-bundle`,
      );
    }
    return;
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, artifacts.module);
  mkdirSync(join(sourceDir, "schemas"), { recursive: true });
  for (const [name, content] of Object.entries(artifacts.schemas)) {
    writeFileSync(join(sourceDir, "schemas", name), content);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
