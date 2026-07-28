import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import {
  dirname,
  extname,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

export interface WorkflowSourceManifest {
  version: 1;
  entrypoints: string[];
  semanticFiles: string[];
  buildInputs: string[];
  exclusions: Array<{ path: string; reason: string }>;
}

const HASH_DOMAIN = "tqccl:workflow-build:v1\u0000";

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function portablePath(path: string): string {
  return path.split(sep).join("/");
}

function repositoryPath(repositoryRoot: string, filename: string): string {
  const path = portablePath(relative(repositoryRoot, filename));
  if (path === ".." || path.startsWith("../")) {
    throw new Error(`Semantic import escapes repository root: ${filename}`);
  }
  return path;
}

function resolveSourceImport(importer: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    throw new Error(`Package import is not allowed in semantic closure: ${specifier}`);
  }
  const direct = resolve(dirname(importer), specifier);
  const candidates = [direct];
  if (extname(direct) === ".js") candidates.push(direct.slice(0, -3) + ".ts");
  if (extname(direct) === ".mjs") candidates.push(direct.slice(0, -4) + ".mts");
  if (extname(direct) === "") {
    candidates.push(`${direct}.ts`, `${direct}.js`, resolve(direct, "index.ts"));
  }
  const resolved = candidates.find(existsSync);
  if (!resolved) {
    throw new Error(`Cannot resolve semantic import ${specifier} from ${importer}`);
  }
  return resolved;
}

function sourceImports(filename: string, source: string): string[] {
  const parsed = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const parseDiagnostics = (
    parsed as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
  if ((parseDiagnostics?.length ?? 0) > 0) {
    throw new Error(`Cannot parse semantic source: ${filename}`);
  }
  const specifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      throw new Error(
        `Dynamic import cannot be resolved in semantic closure: ${filename}`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return specifiers;
}

export function collectSemanticClosure(
  repositoryRoot: string,
  entrypoints: readonly string[],
): string[] {
  const pending = entrypoints.map((entrypoint) => resolve(repositoryRoot, entrypoint));
  const visited = new Set<string>();
  while (pending.length > 0) {
    const filename = pending.pop();
    if (!filename || visited.has(filename)) continue;
    if (!existsSync(filename)) {
      throw new Error(`Semantic source does not exist: ${repositoryPath(repositoryRoot, filename)}`);
    }
    visited.add(filename);
    const source = readFileSync(filename, "utf8");
    for (const specifier of sourceImports(
      repositoryPath(repositoryRoot, filename),
      source,
    )) {
      pending.push(resolveSourceImport(filename, specifier));
    }
  }
  return [...visited]
    .map((filename) => repositoryPath(repositoryRoot, filename))
    .sort(comparePaths);
}

function sortedUnique(paths: readonly string[], label: string): string[] {
  const sorted = [...paths].sort(comparePaths);
  if (new Set(sorted).size !== sorted.length) {
    throw new Error(`${label} contains duplicate paths`);
  }
  return sorted;
}

export function validateWorkflowSourceManifest(
  repositoryRoot: string,
  manifest: WorkflowSourceManifest,
): string[] {
  if (manifest.version !== 1) throw new Error("Unsupported workflow manifest version");
  if (manifest.entrypoints.length === 0) throw new Error("entrypoints must not be empty");
  if (manifest.exclusions.some(({ path, reason }) => !path || !reason.trim())) {
    throw new Error("Every workflow exclusion needs a path and rationale");
  }
  const actual = collectSemanticClosure(repositoryRoot, manifest.entrypoints);
  const declared = sortedUnique(manifest.semanticFiles, "semanticFiles");
  if (JSON.stringify(actual) !== JSON.stringify(declared)) {
    throw new Error(
      `semanticFiles must equal the transitive closure\nactual=${JSON.stringify(actual)}\ndeclared=${JSON.stringify(declared)}`,
    );
  }
  for (const path of [...actual, ...manifest.buildInputs]) {
    if (!existsSync(resolve(repositoryRoot, path))) {
      throw new Error(`Workflow identity input does not exist: ${path}`);
    }
  }
  return actual;
}

export function createWorkflowBuildId(
  repositoryRoot: string,
  manifest: WorkflowSourceManifest,
): `build:sha256:${string}` {
  const semanticFiles = validateWorkflowSourceManifest(repositoryRoot, manifest);
  const inputs = sortedUnique(
    [...semanticFiles, ...manifest.buildInputs],
    "workflow identity inputs",
  );
  const hash = createHash("sha256");
  hash.update(HASH_DOMAIN);
  hash.update(JSON.stringify({ version: manifest.version, inputs }));
  for (const path of inputs) {
    const contents = readFileSync(resolve(repositoryRoot, path));
    hash.update(`\u0000${path}\u0000${contents.byteLength}\u0000`);
    hash.update(contents);
  }
  return `build:sha256:${hash.digest("hex")}`;
}

function renderGeneratedSource(
  workflowBuildId: string,
  manifest: WorkflowSourceManifest,
): string {
  const semanticFiles = sortedUnique(manifest.semanticFiles, "semanticFiles");
  const buildInputs = sortedUnique(manifest.buildInputs, "buildInputs");
  return `// Tệp được sinh bởi scripts/generate-workflow-build.ts. Không sửa thủ công.
export const WORKFLOW_BUILD_ID = ${JSON.stringify(workflowBuildId)} as const;
export const WORKFLOW_SEMANTIC_FILES = ${JSON.stringify(semanticFiles, null, 2)} as const;
export const WORKFLOW_BUILD_INPUTS = ${JSON.stringify(buildInputs, null, 2)} as const;
`;
}

function main(): void {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const repositoryRoot = resolve(packageRoot, "..");
  const manifestPath = resolve(packageRoot, "workflow-source-manifest.json");
  const outputPath = resolve(packageRoot, "src/generated/workflow-build.ts");
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as WorkflowSourceManifest;
  const output = renderGeneratedSource(
    createWorkflowBuildId(repositoryRoot, manifest),
    manifest,
  );
  if (process.argv.includes("--check")) {
    if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== output) {
      throw new Error(
        "workflow-build.ts is stale; run npm run generate:workflow-build",
      );
    }
    return;
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
