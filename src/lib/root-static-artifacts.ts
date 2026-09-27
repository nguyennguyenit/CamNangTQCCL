import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import {
  PUBLIC_ARTIFACTS,
  artifactEntriesFor,
  validatePublicArtifactManifest,
} from "./public-artifact-manifest.mjs";
import {
  DEFAULT_RECOMMENDED_ROOT,
  recommendedPublicationSnapshot,
  type RecommendedPublicationSnapshot,
} from "./recommended-reference-artifacts.ts";

type ArtifactKind = "js" | "css" | "data";
type PublicArtifactManifest = Parameters<typeof validatePublicArtifactManifest>[0];

type ArtifactOptions = {
  rootDir?: string;
  manifest?: PublicArtifactManifest;
};

export const DEFAULT_PROJECT_ROOT = process.cwd();
const PRIVATE_DATA_SUBTREE = "sgsdeck";

const LOOKUP_FILES = ["heroes-dict.json", "tactics.json", "lookup-catalog.json", "lookup-manifest.json"] as const;
const lookupSnapshots = new Map<string, Promise<{
  generationId: string;
  manifest: { schemaVersion: number; generationId: string; files: Record<string, string> };
  files: Record<string, Buffer>;
}>>();
const WEBSITE_DISPLAY_FILE = "website-display.json";
type WebsiteDisplayDocument = {
  schemaVersion: number;
  generationId: string;
  sourceHashes: Record<string, string>;
  recommendedPin: { schemaVersion: number; generationId: string; manifestSha256: string };
  values: Record<string, string>;
};
export type WebsiteDisplayPublicationSnapshot = {
  document: WebsiteDisplayDocument;
  bytes: Buffer;
  pin: { generationId: string; sha256: string };
  recommended: RecommendedPublicationSnapshot;
  publicFiles: Record<string, Buffer>;
};
const websiteDisplaySnapshots = new Map<string, Promise<WebsiteDisplayPublicationSnapshot>>();

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function regularBytes(path: string, rootRealpath: string, expectedParent: string) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Lookup artifact must be a regular file: ${path}`);
  const resolved = await realpath(path);
  if (!withinRoot(resolved, rootRealpath) || dirname(resolved) !== expectedParent) {
    throw new Error(`Lookup artifact escapes its directory: ${path}`);
  }
  return readFile(resolved);
}

async function assertPromotionComplete(rootDir: string) {
  const output = join(rootDir, "pipeline", "lookup-output");
  if (await lstat(join(output, "promotion.lock")).catch(() => null)) {
    throw new Error("Lookup promotion is incomplete");
  }
  const transactions = join(output, "transactions");
  for (const entry of await readdir(transactions, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const journalPath = join(transactions, entry.name, "journal.json");
    const bytes = await readFile(journalPath).catch(() => null);
    if (!bytes) continue;
    const journal = JSON.parse(bytes.toString("utf8"));
    if (journal.state === "activation-prepared" || journal.state === "writing") {
      throw new Error("Lookup promotion is incomplete");
    }
  }
}

export function lookupPublicationSnapshot({ rootDir = DEFAULT_PROJECT_ROOT }: ArtifactOptions = {}) {
  const key = rootDir;
  const cached = lookupSnapshots.get(key);
  if (cached) return cached;
  const pending = (async () => {
    await assertPromotionComplete(rootDir);
    const rootRealpath = await realpath(rootDir);
    const dataDir = join(rootDir, "data");
    const dataRealpath = await realpath(dataDir);
    if (!withinRoot(dataRealpath, rootRealpath)) throw new Error("Lookup data directory escapes project root");
    const manifestPath = join(dataDir, "lookup-manifest.json");
    const firstManifestBytes = await regularBytes(manifestPath, rootRealpath, dataRealpath);
    let manifest;
    try { manifest = JSON.parse(firstManifestBytes.toString("utf8")); } catch { throw new Error("Lookup manifest is invalid JSON"); }
    const payloadNames = LOOKUP_FILES.filter((name) => name !== "lookup-manifest.json");
    if (
      !manifest || manifest.schemaVersion !== 1
      || Object.keys(manifest).sort().join(",") !== "files,generationId,schemaVersion"
      || Object.keys(manifest.files ?? {}).sort().join(",") !== [...payloadNames].sort().join(",")
    ) throw new Error("Lookup manifest shape is invalid");
    const files: Record<string, Buffer> = { "lookup-manifest.json": firstManifestBytes };
    for (const name of payloadNames) {
      const bytes = await regularBytes(join(dataDir, name), rootRealpath, dataRealpath);
      if (manifest.files[name] !== sha256(bytes)) throw new Error(`Lookup hash mismatch: ${name}`);
      files[name] = bytes;
    }
    const ordered = Object.fromEntries(Object.keys(manifest.files).sort().map((name) => [name, manifest.files[name]]));
    const expectedGeneration = `lookup:${sha256(Buffer.from(`${JSON.stringify(ordered)}\n`))}`;
    if (manifest.generationId !== expectedGeneration) throw new Error("Lookup generationId mismatch");
    const secondManifestBytes = await regularBytes(manifestPath, rootRealpath, dataRealpath);
    await assertPromotionComplete(rootDir);
    if (!firstManifestBytes.equals(secondManifestBytes)) throw new Error("Lookup manifest changed during capture");
    return Object.freeze({ generationId: manifest.generationId, manifest: Object.freeze(manifest), files: Object.freeze(files) });
  })();
  lookupSnapshots.set(key, pending);
  pending.catch(() => { if (lookupSnapshots.get(key) === pending) lookupSnapshots.delete(key); });
  return pending;
}
function withinRoot(candidate: string, root: string) {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

async function publicSourceEntries(
  kind: ArtifactKind,
  directory: string,
  directoryRealpath: string,
  rootRealpath: string,
) {
  const entries = await readdir(directory);
  if (kind !== "data" || !entries.includes(PRIVATE_DATA_SUBTREE)) return entries;

  const privatePath = join(directory, PRIVATE_DATA_SUBTREE);
  const privateStat = await lstat(privatePath);
  if (privateStat.isSymbolicLink() || !privateStat.isDirectory()) {
    throw new Error(`Private artifact subtree must be a real directory: data/${PRIVATE_DATA_SUBTREE}`);
  }
  const privateRealpath = await realpath(privatePath);
  if (!withinRoot(privateRealpath, rootRealpath) || dirname(privateRealpath) !== directoryRealpath) {
    throw new Error(`Private artifact subtree escapes project root: data/${PRIVATE_DATA_SUBTREE}`);
  }
  return entries.filter((entry) => entry !== PRIVATE_DATA_SUBTREE);
}

export async function validatePublicArtifactTree({
  rootDir = DEFAULT_PROJECT_ROOT,
  manifest = PUBLIC_ARTIFACTS,
  kinds = ["js", "css", "data"],
}: ArtifactOptions & { kinds?: ArtifactKind[] } = {}) {
  validatePublicArtifactManifest(manifest);
  const rootRealpath = await realpath(rootDir);
  for (const kind of kinds) {
    const directory = join(rootDir, kind);
    const directoryStat = await lstat(directory);
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
      throw new Error(`Public artifact directory must be a real directory: ${kind}`);
    }
    const directoryRealpath = await realpath(directory);
    if (!withinRoot(directoryRealpath, rootRealpath)) {
      throw new Error(`Public artifact directory escapes project root: ${kind}`);
    }
    const expected = artifactEntriesFor(kind, manifest)
      .map((artifact) => artifact.sourceBasename)
      .sort();
    const actual = (await publicSourceEntries(kind, directory, directoryRealpath, rootRealpath)).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Public artifact source set mismatch for ${kind}: expected ${expected.join(", ")}, got ${actual.join(", ")}`,
      );
    }
  }
}

function allowlistedArtifact(kind: ArtifactKind, routeParam: string | undefined, manifest: PublicArtifactManifest) {
  validatePublicArtifactManifest(manifest);
  const artifact = artifactEntriesFor(kind, manifest).find((candidate) => candidate.routeParam === routeParam);
  if (!artifact) throw new Error(`Public artifact is not allowlisted: ${kind}/${routeParam}`);
  return artifact;
}

async function readAllowlistedBytes(
  kind: ArtifactKind,
  routeParam: string | undefined,
  rootDir: string,
  manifest: PublicArtifactManifest,
) {
  const artifact = allowlistedArtifact(kind, routeParam, manifest);
  const rootRealpath = await realpath(rootDir);
  const directory = join(rootDir, kind);
  const directoryRealpath = await realpath(directory);
  const sourcePath = join(directory, artifact.sourceBasename);
  let sourceStat;
  try {
    sourceStat = await lstat(sourcePath);
  } catch (error) {
    throw new Error(`Public artifact source is missing: ${sourcePath}`, { cause: error });
  }
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
    throw new Error(`Public artifact source must be a regular file, not a symlink: ${sourcePath}`);
  }
  const sourceRealpath = await realpath(sourcePath);
  if (!withinRoot(sourceRealpath, rootRealpath) || dirname(sourceRealpath) !== directoryRealpath) {
    throw new Error(`Public artifact source escapes its allowlisted directory: ${sourcePath}`);
  }
  return { artifact, bytes: await readFile(sourceRealpath), mimeType: artifact.mimeType };
}

export function websiteDisplayPublicationSnapshot({
  rootDir = DEFAULT_PROJECT_ROOT,
  manifest = PUBLIC_ARTIFACTS,
}: ArtifactOptions = {}) {
  const key = rootDir;
  const cached = websiteDisplaySnapshots.get(key);
  if (cached) return cached;
  const pending = (async () => {
    const display = await readAllowlistedBytes("data", "website-display", rootDir, manifest);
    let document: WebsiteDisplayDocument;
    try {
      document = JSON.parse(display.bytes.toString("utf8"));
    } catch {
      throw new Error("Website display artifact is invalid JSON");
    }
    if (
      !document
      || Object.keys(document).sort().join(",") !== "generationId,recommendedPin,schemaVersion,sourceHashes,values"
      || document.schemaVersion !== 1
      || !/^site-localization:[0-9a-f]{64}$/.test(document.generationId)
      || !document.sourceHashes
      || !document.values
    ) throw new Error("Website display artifact shape is invalid");

    const recommendedRoot = rootDir === DEFAULT_PROJECT_ROOT
      ? DEFAULT_RECOMMENDED_ROOT
      : join(rootDir, "src", "data", "recommended-reference");
    const recommended = await recommendedPublicationSnapshot(recommendedRoot);
    if (
      document.recommendedPin.schemaVersion !== recommended.pin.schemaVersion
      || document.recommendedPin.generationId !== recommended.pin.generationId
      || document.recommendedPin.manifestSha256 !== recommended.pin.manifestSha256
    ) throw new Error("Website display Recommended pin mismatch");

    const publicFiles: Record<string, Buffer> = { [WEBSITE_DISPLAY_FILE]: display.bytes };
    const allowedData = new Set<string>(artifactEntriesFor("data", manifest).map((entry) => entry.sourceBasename));
    for (const [relativePath, expectedHash] of Object.entries(document.sourceHashes)) {
      if (!/^data\/[^/]+\.json$/.test(relativePath)) throw new Error("Website display source path is invalid");
      const basename = relativePath.slice("data/".length);
      if (!allowedData.has(basename) || basename === WEBSITE_DISPLAY_FILE) {
        throw new Error(`Website display source is not allowlisted: ${relativePath}`);
      }
      const route = basename.slice(0, -".json".length);
      const source = await readAllowlistedBytes("data", route, rootDir, manifest);
      if (expectedHash !== sha256(source.bytes)) throw new Error(`Website display source hash mismatch: ${relativePath}`);
      publicFiles[basename] = source.bytes;
    }
    const reread = await readAllowlistedBytes("data", "website-display", rootDir, manifest);
    if (!reread.bytes.equals(display.bytes)) throw new Error("Website display artifact changed during capture");
    return Object.freeze({
      document: Object.freeze(document),
      bytes: display.bytes,
      pin: Object.freeze({ generationId: document.generationId, sha256: sha256(display.bytes) }),
      recommended,
      publicFiles: Object.freeze(publicFiles),
    });
  })();
  websiteDisplaySnapshots.set(key, pending);
  pending.catch(() => {
    if (websiteDisplaySnapshots.get(key) === pending) websiteDisplaySnapshots.delete(key);
  });
  return pending;
}

export async function readPublicArtifact({
  kind,
  routeParam,
  rootDir = DEFAULT_PROJECT_ROOT,
  manifest = PUBLIC_ARTIFACTS,
}: ArtifactOptions & { kind: ArtifactKind; routeParam?: string }) {
  const artifact = allowlistedArtifact(kind, routeParam, manifest);
  if (kind === "data") {
    if (artifactEntriesFor("data", manifest).some((entry) => entry.routeParam === "website-display")) {
      const display = await websiteDisplayPublicationSnapshot({ rootDir, manifest });
      const captured = display.publicFiles[artifact.sourceBasename];
      if (captured) return { artifact, bytes: captured, mimeType: artifact.mimeType };
    }
    if (LOOKUP_FILES.includes(artifact.sourceBasename as typeof LOOKUP_FILES[number])) {
      const snapshot = await lookupPublicationSnapshot({ rootDir, manifest });
      return { artifact, bytes: snapshot.files[artifact.sourceBasename], mimeType: artifact.mimeType };
    }
  }
  return readAllowlistedBytes(kind, routeParam, rootDir, manifest);
}

export async function staticPathsFor(kind: ArtifactKind, options: ArtifactOptions = {}) {
  await validatePublicArtifactTree({ ...options, kinds: [kind] });
  return artifactEntriesFor(kind, options.manifest)
    .map((artifact) => ({
      params: { file: artifact.routeParam },
      props: { routeParam: artifact.routeParam },
    }));
}

/** Byte hashes pin the browser season model to this exact static publication. */
export async function seasonArtifactHashes(options: ArtifactOptions = {}) {
  const names = ['season-registry', 'season-evidence', 'season-team-configs', 'season-team-evaluations', 'season-content-links', 'teams', 'coexist', 'heroes-dict', 'tactics', 'books-dict'];
  const lookup = await lookupPublicationSnapshot(options);
  return Object.fromEntries(await Promise.all(names.map(async name => {
    if (name === "heroes-dict" || name === "tactics") {
      return [name, `sha256:${lookup.manifest.files[`${name}.json`]}`];
    }
    const { bytes } = await readPublicArtifact({ ...options, kind: 'data', routeParam: name });
    return [name, 'sha256:' + createHash('sha256').update(bytes).digest('hex')];
  })));
}

/** Byte hash pins the lookup page's Binh thư group (`books-dict`, outside the lookup manifest) to this publication. */
export async function lookupBooksHash(options: ArtifactOptions = {}) {
  const { bytes } = await readPublicArtifact({ ...options, kind: 'data', routeParam: 'books-dict' });
  return 'sha256:' + createHash('sha256').update(bytes).digest('hex');
}
