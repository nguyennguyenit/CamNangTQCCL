import { env } from "cloudflare:workers";

import {
  ARTIFACT_NAMES,
  createDataManifest,
  type ArtifactName,
} from "../../src/data/artifact-contracts.js";

import books from "../../../data/books-dict.json?raw";
import coexist from "../../../data/coexist.json?raw";
import heroes from "../../../data/heroes-dict.json?raw";
import tactics from "../../../data/tactics.json?raw";
import teamTier from "../../../data/team-tier.json?raw";
import teams from "../../../data/teams.json?raw";

const artifactText: Record<ArtifactName, string> = {
  teams,
  "team-tier": teamTier,
  coexist,
  "heroes-dict": heroes,
  tactics,
  "books-dict": books,
};

export async function seedProductionR2(): Promise<void> {
  const objects = new Map(
    ARTIFACT_NAMES.map((name) => [
      name,
      new TextEncoder().encode(artifactText[name]),
    ]),
  );
  const manifest = await createDataManifest(objects);
  const digest = manifest.releaseId.slice("sha256:".length);
  const prefix = `releases/${digest}`;

  await env.TQCCL_RELEASE_BUCKET.put(
    `${prefix}/manifest.json`,
    JSON.stringify(manifest),
  );
  await Promise.all(
    manifest.artifacts.map((descriptor) =>
      env.TQCCL_RELEASE_BUCKET.put(
        `${prefix}/${descriptor.key}`,
        objects.get(descriptor.name)!,
      ),
    ),
  );
  await env.TQCCL_POINTER_BUCKET.put(
    "current.json",
    JSON.stringify({
      schemaVersion: 1,
      releaseId: manifest.releaseId,
      manifestKey: `${prefix}/manifest.json`,
    }),
  );
}

