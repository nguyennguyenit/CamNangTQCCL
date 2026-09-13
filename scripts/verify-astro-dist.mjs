import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PUBLIC_ARTIFACTS, validatePublicArtifactManifest } from "../src/lib/public-artifact-manifest.mjs";
import { recommendedPublicationSnapshot } from "../src/lib/recommended-reference-artifacts.ts";

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
  const recommended = await recommendedPublicationSnapshot(resolve(rootPath, "src/data/recommended-reference"));
  const recommendedFiles = [
    "data/recommended/current.json",
    ...Object.keys(recommended.files).map((name) => `data/recommended/${recommended.pin.generationId}/${name}`),
  ];
  const expectedAssets = manifest.map((artifact) =>
    `${artifact.kind}/${artifact.sourceBasename}`);
  const expectedFiles = [
    "index.html",
    ...expectedAssets,
    ...recommendedFiles,
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

  const currentOutput = await readFile(resolve(distPath, "data/recommended/current.json"));
  if (!currentOutput.equals(recommended.currentBytes)) {
    throw new Error("Emitted Recommended current selector differs from source");
  }
  for (const [name, bytes] of Object.entries(recommended.files)) {
    const emitted = await readFile(resolve(distPath, `data/recommended/${recommended.pin.generationId}/${name}`));
    if (!emitted.equals(bytes)) throw new Error(`Emitted Recommended artifact differs from source: ${name}`);
  }
  const html = await readFile(resolve(distPath, "index.html"), "utf8");
  const embedded = html.match(/id="recommended-publication"[^>]*>([^<]+)<\/script>/);
  if (!embedded) throw new Error("Built HTML lacks the Recommended publication pin");
  const embeddedPin = JSON.parse(embedded[1]);
  if (
    embeddedPin.schemaVersion !== recommended.pin.schemaVersion
    || embeddedPin.generationId !== recommended.pin.generationId
    || embeddedPin.manifestSha256 !== recommended.pin.manifestSha256
  ) {
    throw new Error("Built HTML Recommended pin differs from emitted generation");
  }

  let lookupGenerationId = null;
  const lookupRoutes = new Set(manifest.filter((artifact) => artifact.kind === "data").map((artifact) => artifact.routeParam));
  if (lookupRoutes.has("lookup-manifest")) {
    let lookupManifest;
    try {
      lookupManifest = JSON.parse(await readFile(resolve(distPath, "data/lookup-manifest.json"), "utf8"));
    } catch {
      throw new Error("Emitted lookup manifest is invalid");
    }
    const payloadNames = ["heroes-dict.json", "tactics.json", "lookup-catalog.json"];
    if (
      lookupManifest?.schemaVersion !== 1
      || Object.keys(lookupManifest.files ?? {}).sort().join(",") !== [...payloadNames].sort().join(",")
    ) throw new Error("Emitted lookup manifest shape is invalid");
    for (const name of payloadNames) {
      const bytes = await readFile(resolve(distPath, `data/${name}`));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (lookupManifest.files[name] !== actual) throw new Error(`Emitted ${name} leaves lookup manifest generation`);
    }
    const ordered = Object.fromEntries(Object.keys(lookupManifest.files).sort().map((name) => [name, lookupManifest.files[name]]));
    const derived = "lookup:" + createHash("sha256").update(`${JSON.stringify(ordered)}\n`).digest("hex");
    if (lookupManifest.generationId !== derived) throw new Error("Emitted lookup generation is invalid");
    const seasonMarker = html.match(/id="season-artifact-hashes"[^>]*>([^<]+)<\/script>/);
    if (!seasonMarker) throw new Error("Built HTML lacks season-artifact-hashes generation pin");
    const seasonHashes = JSON.parse(seasonMarker[1]);
    for (const name of ["heroes-dict", "tactics"]) {
      if (seasonHashes[name] !== `sha256:${lookupManifest.files[`${name}.json`]}`) {
        throw new Error("Built HTML season-artifact-hashes differs from lookup generation");
      }
    }
    lookupGenerationId = lookupManifest.generationId;
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
    lookupGenerationId,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const result = await verifyAstroDist();
  console.log(`Verified ${result.files.length} dist files (${result.assetCount} raw assets).`);
}
