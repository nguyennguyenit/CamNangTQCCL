import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  V2_ARTIFACT_NAMES,
  createDataManifest,
  type ArtifactName,
  type DataManifest,
} from "../../src/data/artifact-contracts.js";
import {
  buildPublicationArtifacts,
  type PublicationBuild,
  type PublicationSources,
} from "../../src/data/publication-builder.js";
import {
  readPublicationSources,
  repositoryPublicationRoots,
} from "../../src/data/publication-source-reader.js";
import { stableStringify } from "../../src/domain/contracts.js";

export const repositoryRoot = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
export const repositoryDataRoot = join(repositoryRoot, "data");

export interface RepositoryPublication {
  objects: Map<ArtifactName, Uint8Array>;
  sources: PublicationSources;
}

let cached: Promise<RepositoryPublication> | undefined;

/** The repository's own verified publication inputs (real bytes; never copied into fixtures). */
export function repositoryPublication(): Promise<RepositoryPublication> {
  cached ??= (async () => ({
    objects: new Map(
      await Promise.all(
        V2_ARTIFACT_NAMES.map(async (name) => [name, new Uint8Array(await readFile(join(repositoryDataRoot, `${name}.json`)))] as const),
      ),
    ),
    sources: await readPublicationSources(repositoryPublicationRoots(repositoryDataRoot)),
  }))();
  return cached;
}

export interface BuiltRelease {
  build: PublicationBuild;
  manifest: DataManifest;
  all: Map<ArtifactName, Uint8Array>;
}

export async function buildRelease(input: RepositoryPublication): Promise<BuiltRelease> {
  const build = await buildPublicationArtifacts(input);
  const all = new Map<ArtifactName, Uint8Array>([...input.objects, ...build.artifacts] as Array<[ArtifactName, Uint8Array]>);
  return { build, all, manifest: await createDataManifest(all, { publication: build.meta }) };
}

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

/** Replace one JSON document's bytes while keeping everything else identical. */
export function withBytes(sources: PublicationSources, patch: Partial<Pick<PublicationSources, "routeLedger" | "websiteDisplay">>): PublicationSources {
  return { ...sources, ...patch };
}

export function editJson<T>(bytes: Uint8Array, edit: (value: T) => void): Uint8Array {
  const value = JSON.parse(new TextDecoder().decode(bytes)) as T;
  edit(value);
  return encode(value);
}

/** Write a packaged v3 root (manifest + artifacts) to a temp dir. */
export async function writePackagedRoot(release: BuiltRelease): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "tqccl-v3-root-"));
  roots.push(root);
  for (const [name, bytes] of release.all) await writeFile(join(root, `${name}.json`), bytes);
  await writeFile(join(root, "manifest.json"), `${stableStringify(release.manifest)}\n`);
  return root;
}

const roots: string[] = [];
export async function removePublicationRoots(): Promise<void> {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
}

/** A raw checkout shaped like the repository: data/, src/data/recommended-reference/, pipeline/. */
export async function writeRawCheckout(): Promise<{ root: string; dataRoot: string }> {
  const root = await mkdtemp(join(tmpdir(), "tqccl-v3-checkout-"));
  roots.push(root);
  const dataRoot = join(root, "data");
  await mkdir(dataRoot);
  for (const name of [...V2_ARTIFACT_NAMES, "khaihoang", "lookup-catalog", "lookup-manifest", "website-display"]) {
    await copyFile(join(repositoryDataRoot, `${name}.json`), join(dataRoot, `${name}.json`));
  }
  const recommended = join(root, "src/data/recommended-reference");
  await mkdir(recommended, { recursive: true });
  const current = JSON.parse(await readFile(join(repositoryRoot, "src/data/recommended-reference/current.json"), "utf8")) as { generationId: string };
  await copyFile(join(repositoryRoot, "src/data/recommended-reference/current.json"), join(recommended, "current.json"));
  const generation = join(recommended, current.generationId);
  await mkdir(generation);
  const source = join(repositoryRoot, "src/data/recommended-reference", current.generationId);
  for (const name of await readdir(source)) await copyFile(join(source, name), join(generation, name));
  await mkdir(join(root, "pipeline"));
  await copyFile(join(repositoryRoot, "pipeline/team-route-handles.json"), join(root, "pipeline/team-route-handles.json"));
  return { root, dataRoot };
}
