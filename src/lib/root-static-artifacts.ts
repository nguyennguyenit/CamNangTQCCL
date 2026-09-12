import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import {
  PUBLIC_ARTIFACTS,
  artifactEntriesFor,
  validatePublicArtifactManifest,
} from "./public-artifact-manifest.mjs";

type ArtifactKind = "js" | "css" | "data";
type PublicArtifactManifest = Parameters<typeof validatePublicArtifactManifest>[0];

type ArtifactOptions = {
  rootDir?: string;
  manifest?: PublicArtifactManifest;
};

export const DEFAULT_PROJECT_ROOT = process.cwd();
const PRIVATE_DATA_SUBTREE = "sgsdeck";

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

export async function readPublicArtifact({
  kind,
  routeParam,
  rootDir = DEFAULT_PROJECT_ROOT,
  manifest = PUBLIC_ARTIFACTS,
}: ArtifactOptions & { kind: ArtifactKind; routeParam?: string }) {
  validatePublicArtifactManifest(manifest);
  const artifact = artifactEntriesFor(kind, manifest)
    .find((candidate) => candidate.routeParam === routeParam);
  if (!artifact) {
    throw new Error(`Public artifact is not allowlisted: ${kind}/${routeParam}`);
  }

  const rootRealpath = await realpath(rootDir);
  const sourcePath = join(rootDir, kind, artifact.sourceBasename);
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
  if (!withinRoot(sourceRealpath, rootRealpath) || dirname(sourceRealpath) !== join(rootRealpath, kind)) {
    throw new Error(`Public artifact source escapes its allowlisted directory: ${sourcePath}`);
  }

  return {
    artifact,
    bytes: await readFile(sourceRealpath),
    mimeType: artifact.mimeType,
  };
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
  return Object.fromEntries(await Promise.all(names.map(async name => {
    const { bytes } = await readPublicArtifact({ ...options, kind: 'data', routeParam: name });
    return [name, 'sha256:' + createHash('sha256').update(bytes).digest('hex')];
  })));
}
