import { env } from "cloudflare:workers";

import {
  ARTIFACT_NAMES,
  createDataManifest,
  type ArtifactName,
} from "../../src/data/artifact-contracts.js";

import books from "./release-snapshot/books-dict.json";
import coexist from "./release-snapshot/coexist.json";
import heroes from "./release-snapshot/heroes-dict.json";
import tactics from "./release-snapshot/tactics.json";
import teamTier from "./release-snapshot/team-tier.json";
import teams from "./release-snapshot/teams.json";

const artifacts: Record<ArtifactName, unknown> = {
  teams,
  "team-tier": teamTier,
  coexist,
  "heroes-dict": heroes,
  tactics,
  "books-dict": books,
};

declare module "cloudflare:workers" {
  interface ProvidedEnv {
    TQCCL_POINTER_BUCKET: R2Bucket;
    TQCCL_RELEASE_BUCKET: R2Bucket;
  }
}

export async function seedFixtureR2(): Promise<void> {
  const objects = new Map(
    ARTIFACT_NAMES.map((name) => [
      name,
      new TextEncoder().encode(JSON.stringify(artifacts[name])),
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

