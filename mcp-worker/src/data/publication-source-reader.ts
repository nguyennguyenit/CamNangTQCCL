import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { MAX_ARTIFACT_BYTES } from "./artifact-contracts.js";
import type { PublicationSources } from "./publication-builder.js";

const GENERATION = /^[0-9a-f]{64}$/u;
const SIDECARS = ["khaihoang.json", "lookup-catalog.json", "lookup-manifest.json"] as const;

/** Where a raw repository checkout keeps the publication inputs, relative to its `data/` directory. */
export interface PublicationRoots {
  dataRoot: string;
  recommendedRoot: string;
  routeLedgerPath: string;
  lookupRouteLedgerPath: string;
}

export function repositoryPublicationRoots(dataRoot: string): PublicationRoots {
  const root = resolve(dataRoot, "..");
  return {
    dataRoot: resolve(dataRoot),
    recommendedRoot: resolve(root, "src/data/recommended-reference"),
    routeLedgerPath: resolve(root, "pipeline/team-route-handles.json"),
    lookupRouteLedgerPath: resolve(root, "pipeline/lookup-route-handles.json"),
  };
}

async function regularBytes(path: string): Promise<Uint8Array> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_ARTIFACT_BYTES) {
    throw new Error("invalid publication input");
  }
  return new Uint8Array(await readFile(path));
}

/** A raw checkout publishes through Recommended when its `current.json` selector exists. */
export async function hasRecommendedPublication(roots: PublicationRoots): Promise<boolean> {
  return (await lstat(resolve(roots.recommendedRoot, "current.json")).catch(() => null)) !== null;
}

/**
 * Read the exact bytes a v3 build verifies. No directory is chosen by mtime: the selector names the
 * generation, symlinks and non-regular entries are refused, and the selector is re-read to detect change.
 */
export async function readPublicationSources(roots: PublicationRoots): Promise<PublicationSources> {
  const currentPath = resolve(roots.recommendedRoot, "current.json");
  const current = await regularBytes(currentPath);
  const selector: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(current));
  const generationId = (selector as { generationId?: unknown } | null)?.generationId;
  if (typeof generationId !== "string" || !GENERATION.test(generationId)) throw new Error("invalid Recommended selector");
  const generation = resolve(roots.recommendedRoot, generationId);
  const info = await lstat(generation);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("invalid Recommended generation directory");
  const entries = await readdir(generation, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) throw new Error("invalid Recommended generation entry");
  const files = new Map<string, Uint8Array>();
  let manifest: Uint8Array | undefined;
  for (const entry of entries) {
    const bytes = await regularBytes(resolve(generation, entry.name));
    if (entry.name === "manifest.json") manifest = bytes;
    else files.set(entry.name, bytes);
  }
  if (manifest === undefined) throw new Error("Recommended generation has no manifest");
  const sidecars = new Map<string, Uint8Array>();
  for (const name of SIDECARS) sidecars.set(name, await regularBytes(resolve(roots.dataRoot, name)));
  const [websiteDisplay, routeLedger, lookupRouteLedger, reread] = await Promise.all([
    regularBytes(resolve(roots.dataRoot, "website-display.json")),
    regularBytes(roots.routeLedgerPath),
    regularBytes(roots.lookupRouteLedgerPath),
    regularBytes(currentPath),
  ]);
  if (reread.byteLength !== current.byteLength || reread.some((byte, index) => byte !== current[index])) {
    throw new Error("Recommended selector changed during capture");
  }
  return { recommended: { current, manifest, files }, routeLedger, lookupRouteLedger, websiteDisplay, sidecars };
}
