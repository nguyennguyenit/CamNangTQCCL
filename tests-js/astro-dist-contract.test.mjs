import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  PUBLIC_ARTIFACTS,
  artifactEntriesFor,
  validatePublicArtifactManifest,
} from "../src/lib/public-artifact-manifest.mjs";
import {
  readPublicArtifact,
  validatePublicArtifactTree,
} from "../src/lib/root-static-artifacts.ts";
import { verifyAstroDist } from "../scripts/verify-astro-dist.mjs";
import { assertFrontendShellContract } from "./frontend-shell-contract-assertions.mjs";

const projectRoot = new URL("../", import.meta.url);

test("manifest explicitly classifies every published root artifact", async () => {
  const expectedByKind = {};
  for (const kind of ["js", "css", "data"]) {
    const directory = new URL(`${kind}/`, projectRoot);
    const names = (await import("node:fs/promises"))
      .readdir(directory)
      .then((entries) => entries.sort());
    expectedByKind[kind] = await names;
  }

  validatePublicArtifactManifest(PUBLIC_ARTIFACTS);
  for (const kind of ["js", "css", "data"]) {
    const entries = artifactEntriesFor(kind);
    assert.deepEqual(
      entries.map((entry) => entry.sourceBasename).sort(),
      expectedByKind[kind],
    );
    assert.equal(new Set(entries.map((entry) => entry.routeParam)).size, entries.length);
    assert.ok(entries.every((entry) => !entry.routeParam.includes(".")));
  }

  const dataClasses = Object.fromEntries(
    artifactEntriesFor("data").map((entry) => [entry.sourceBasename, entry.publicationClass]),
  );
  for (const name of [
    "teams.json",
    "coexist.json",
    "khaihoang.json",
    "tactics.json",
    "heroes-dict.json",
    "books-dict.json",
    "team-tier.json",
  ]) {
    assert.equal(dataClasses[name], "runtime");
  }
  assert.equal(dataClasses["facets.json"], "legacy-public/build-input");
  assert.equal(dataClasses["tactics-generic.json"], "legacy-public/build-input");
});

test("manifest rejects route collisions, extension mistakes, and unknown kinds", () => {
  const valid = {
    kind: "data",
    routeParam: "teams",
    sourceBasename: "teams.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  };

  assert.throws(
    () => validatePublicArtifactManifest([valid, { ...valid }]),
    /duplicate/i,
  );
  assert.throws(
    () => validatePublicArtifactManifest([{ ...valid, routeParam: "teams.json" }]),
    /extensionless/i,
  );
  assert.throws(
    () => validatePublicArtifactManifest([{ ...valid, kind: "private" }]),
    /kind/i,
  );
  assert.throws(
    () => validatePublicArtifactManifest([{ ...valid, sourceBasename: "../teams.json" }]),
    /basename/i,
  );
});

test("artifact reader returns exact bytes and rejects unknown, missing, and symlink sources", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "tqccl-astro-artifacts-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(rootDir, { recursive: true, force: true }));
  });
  await mkdir(join(rootDir, "data"));
  await writeFile(join(rootDir, "data", "fixture.json"), "{\"ok\":true}\n");
  const manifest = [{
    kind: "data",
    routeParam: "fixture",
    sourceBasename: "fixture.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  }];

  const artifact = await readPublicArtifact({
    kind: "data",
    routeParam: "fixture",
    rootDir,
    manifest,
  });
  assert.equal(artifact.bytes.toString(), "{\"ok\":true}\n");
  assert.equal(artifact.mimeType, "application/json; charset=utf-8");

  await assert.rejects(
    readPublicArtifact({ kind: "data", routeParam: "unknown", rootDir, manifest }),
    /not allowlisted/i,
  );
  await writeFile(join(rootDir, "outside.json"), "{}");
  await symlink(join(rootDir, "outside.json"), join(rootDir, "data", "fixture-link.json"));
  await assert.rejects(
    readPublicArtifact({
      kind: "data",
      routeParam: "fixture-link",
      rootDir,
      manifest: [{ ...manifest[0], routeParam: "fixture-link", sourceBasename: "fixture-link.json" }],
    }),
    /symlink|regular file/i,
  );
  await assert.rejects(
    readPublicArtifact({
      kind: "data",
      routeParam: "missing",
      rootDir,
      manifest: [{ ...manifest[0], routeParam: "missing", sourceBasename: "missing.json" }],
    }),
    /missing|ENOENT/i,
  );
});

test("artifact tree rejects symlinked directories and source-set drift", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "tqccl-astro-tree-"));
  const outsideDir = await mkdtemp(join(tmpdir(), "tqccl-astro-outside-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all([
      rm(rootDir, { recursive: true, force: true }),
      rm(outsideDir, { recursive: true, force: true }),
    ]);
  });
  await writeFile(join(outsideDir, "fixture.json"), "{}\n");
  await symlink(
    `../${outsideDir.split("/").at(-1)}`,
    join(rootDir, "data"),
    "dir",
  );
  const manifest = [{
    kind: "data",
    routeParam: "fixture",
    sourceBasename: "fixture.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  }];
  await assert.rejects(
    validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] }),
    /real directory|escapes/i,
  );

  const driftRoot = await mkdtemp(join(tmpdir(), "tqccl-astro-drift-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) =>
      rm(driftRoot, { recursive: true, force: true }));
  });
  await mkdir(join(driftRoot, "data"));
  await writeFile(join(driftRoot, "data", "fixture.json"), "{}\n");
  await writeFile(join(driftRoot, "data", "unexpected.json"), "{}\n");
  await assert.rejects(
    validatePublicArtifactTree({ rootDir: driftRoot, manifest, kinds: ["data"] }),
    /source set mismatch/i,
  );
});

test("dist verifier rejects missing, unexpected, and symlinked output", async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-astro-verify-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-astro-verify-dist-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all([
      rm(projectDir, { recursive: true, force: true }),
      rm(distDir, { recursive: true, force: true }),
    ]);
  });
  const manifest = [{
    kind: "data",
    routeParam: "fixture",
    sourceBasename: "fixture.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  }];
  await mkdir(join(projectDir, "data"));
  await mkdir(join(distDir, "data"));
  await writeFile(join(projectDir, "data", "fixture.json"), "{}\n");
  await writeFile(join(distDir, "index.html"), "<!doctype html>\n");

  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest,
    }),
    /missing: data\/fixture\.json/i,
  );

  await writeFile(join(distDir, "data", "fixture.json"), "{}\n");
  await writeFile(join(distDir, "unexpected.txt"), "private\n");
  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest,
    }),
    /unexpected: unexpected\.txt/i,
  );

  const { rm } = await import("node:fs/promises");
  await rm(join(distDir, "unexpected.txt"));
  await symlink(join(projectDir, "data", "fixture.json"), join(distDir, "fixture-link.json"));
  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest,
    }),
    /must not contain symlinks/i,
  );
});

test("built dist is allowlisted and every emitted asset is byte-identical", async () => {
  const result = await verifyAstroDist({
    projectRoot: new URL("../", import.meta.url),
    distDir: new URL("../dist/", import.meta.url),
  });

  assert.equal(result.assetCount, PUBLIC_ARTIFACTS.length);
  assert.ok(result.files.includes("index.html"));
  assert.equal(result.unexpectedFiles.length, 0);
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assertFrontendShellContract(html, {
    stylesheetPattern: /<link[^>]+rel=["']stylesheet["'][^>]+href=["']\/css\/styles\.css["']/,
    scriptPattern: /<script[^>]+type=["']module["'][^>]+src=["']\/js\/app\.js["'][^>]*><\/script>/,
  });
  assert.doesNotMatch(html, /_astro\//);
});
