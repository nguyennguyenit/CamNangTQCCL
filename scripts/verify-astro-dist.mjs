import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PUBLIC_ARTIFACTS, validatePublicArtifactManifest } from "../src/lib/public-artifact-manifest.mjs";

export const DEPLOYMENT_CONTROL_ARTIFACTS = Object.freeze([
  Object.freeze({ sourcePath: "public/_headers", outputPath: "_headers" }),
]);

export const STATIC_PUBLIC_ARTIFACTS = Object.freeze([
  Object.freeze({ sourcePath: "public/favicon.png", outputPath: "favicon.png" }),
]);

async function listFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`dist must not contain symlinks: ${path}`);
    if (entry.isDirectory()) files.push(...await listFiles(path, base));
    else if (entry.isFile()) files.push(relative(base, path).split(sep).join("/"));
    else throw new Error(`dist contains unsupported filesystem entry: ${path}`);
  }
  return files.sort();
}

export async function verifyAstroDist({
  projectRoot = new URL("../", import.meta.url),
  distDir = new URL("../dist/", import.meta.url),
  manifest = PUBLIC_ARTIFACTS,
  controlArtifacts = DEPLOYMENT_CONTROL_ARTIFACTS,
  staticArtifacts = STATIC_PUBLIC_ARTIFACTS,
} = {}) {
  validatePublicArtifactManifest(manifest);
  const rootPath = fileURLToPath(projectRoot);
  const distPath = fileURLToPath(distDir);
  const expectedAssets = manifest.map((artifact) =>
    `${artifact.kind}/${artifact.sourceBasename}`);
  const expectedFiles = [
    "index.html",
    ...expectedAssets,
    ...controlArtifacts.map((artifact) => artifact.outputPath),
    ...staticArtifacts.map((artifact) => artifact.outputPath),
  ].sort();
  const files = await listFiles(distPath);
  const unexpectedFiles = files.filter((file) => !expectedFiles.includes(file));
  const missingFiles = expectedFiles.filter((file) => !files.includes(file));
  if (unexpectedFiles.length || missingFiles.length) {
    throw new Error(
      `dist allowlist mismatch; unexpected: ${unexpectedFiles.join(", ") || "none"}; missing: ${missingFiles.join(", ") || "none"}`,
    );
  }

  for (const artifact of manifest) {
    const relativePath = `${artifact.kind}/${artifact.sourceBasename}`;
    const [sourceBytes, emittedBytes] = await Promise.all([
      readFile(resolve(rootPath, relativePath)),
      readFile(resolve(distPath, relativePath)),
    ]);
    if (!sourceBytes.equals(emittedBytes)) {
      throw new Error(`Emitted artifact bytes differ from source: ${relativePath}`);
    }
  }

  for (const artifact of [...controlArtifacts, ...staticArtifacts]) {
    const [sourceBytes, emittedBytes] = await Promise.all([
      readFile(resolve(rootPath, artifact.sourcePath)),
      readFile(resolve(distPath, artifact.outputPath)),
    ]);
    if (!sourceBytes.equals(emittedBytes)) {
      throw new Error(`Deployment control artifact bytes differ from source: ${artifact.outputPath}`);
    }
  }

  const forbiddenSegments = new Set([
    "pipeline",
    "worker",
    "tests",
    "tests-js",
    "tests-e2e",
    "plans",
    ".git",
  ]);
  for (const file of files) {
    if (file.split("/").some((segment) => forbiddenSegments.has(segment))) {
      throw new Error(`Private source path entered dist: ${file}`);
    }
    if (/(^|\/)(\.env|.*\.(pem|key|p12))$/i.test(file)) {
      throw new Error(`Secret-like file entered dist: ${file}`);
    }
  }

  return {
    assetCount: manifest.length,
    files,
    unexpectedFiles,
    missingFiles,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const result = await verifyAstroDist();
  console.log(`Verified ${result.files.length} dist files (${result.assetCount} raw assets).`);
}
