import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  lookupPublicationSnapshot,
  readPublicArtifact,
  seasonArtifactHashes,
  validatePublicArtifactTree,
} from "../src/lib/root-static-artifacts.ts";
import { verifyAstroDist } from "../scripts/verify-astro-dist.mjs";
import { assertFrontendShellContract } from "./frontend-shell-contract-assertions.mjs";

const projectRoot = new URL("../", import.meta.url);

const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const LEGACY_TEAM_ID = "team-intro-0";

async function writeRecommendedFixture(projectDir, distDir, { legacyTeamsHash } = {}) {
  const generationId = "1".repeat(64);
  const scope = `s-${"2".repeat(64)}`;
  const sourceRoot = join(projectDir, "src", "data", "recommended-reference");
  const generation = join(sourceRoot, generationId);
  const output = join(distDir, "data", "recommended", generationId);
  await mkdir(generation, { recursive: true });
  await mkdir(output, { recursive: true });
  const teamsBytes = jsonBytes([{
    id: LEGACY_TEAM_ID,
    source: "team-intro",
    name: "Đội gốc",
    nickname: null,
    heroes: [{ name: "Tuân Úc", tactics: [], books: [], alternatives: [], note: null }],
    counters: { good: [], avoid: [] },
    notes: null,
  }]);
  await mkdir(join(projectDir, "data"), { recursive: true });
  await writeFile(join(projectDir, "data", "teams.json"), teamsBytes);
  const payloads = {
    "seasons.json": jsonBytes({ schemaVersion: 1, seasonOptions: [], scopes: [] }),
    "index.json": jsonBytes({ schemaVersion: 1, records: [] }),
    "other-teams.json": jsonBytes({ schemaVersion: 1, records: [] }),
    [`details-${scope}.json`]: jsonBytes({ schemaVersion: 1, records: [] }),
  };
  const files = Object.fromEntries(Object.entries(payloads).map(([name, bytes]) => [name, { sha256: sha256(bytes), bytes: bytes.length }]));
  for (const [name, bytes] of Object.entries(payloads)) {
    await writeFile(join(generation, name), bytes);
    await writeFile(join(output, name), bytes);
  }
  const manifest = jsonBytes({
    schemaVersion: 1,
    generationId,
    dedupKeyVersion: 1,
    allowedScopeKeys: [scope],
    files,
    legacyTeamsHash: legacyTeamsHash ?? `sha256:${sha256(teamsBytes)}`,
  });
  await writeFile(join(generation, "manifest.json"), manifest);
  await writeFile(join(output, "manifest.json"), manifest);
  const current = jsonBytes({ schemaVersion: 1, generationId, manifestSha256: sha256(manifest) });
  await writeFile(join(sourceRoot, "current.json"), current);
  await mkdir(join(distDir, "data", "recommended"), { recursive: true });
  await writeFile(join(distDir, "data", "recommended", "current.json"), current);
  const pin = { schemaVersion: 1, generationId, manifestSha256: sha256(manifest) };
  await writeFile(join(distDir, "index.html"), `<!doctype html><script id="recommended-publication" type="application/json">${JSON.stringify(pin)}</script>\n`);
  await writeFile(join(distDir, "404.html"), '<!doctype html><h1 id="not-found-title">Không tìm thấy trang</h1>\n');
  await mkdir(join(distDir, "teams", "legacy", LEGACY_TEAM_ID), { recursive: true });
  await writeFile(
    join(distDir, "teams", "legacy", LEGACY_TEAM_ID, "index.html"),
    `<!doctype html><article id="team-detail-root" data-legacy-team-id="${LEGACY_TEAM_ID}" data-legacy-teams-sha256="sha256:${sha256(teamsBytes)}" data-generation-id="${generationId}" data-manifest-sha256="${sha256(manifest)}"></article>\n`,
  );
}

test("season bundle publishes exactly five sidecars with the shared resolver", async () => {
  assert.deepEqual(artifactEntriesFor("data").filter((entry) => entry.routeParam.startsWith("season-")).map((entry) => entry.routeParam).sort(), ["season-content-links", "season-evidence", "season-registry", "season-team-configs", "season-team-evaluations"]);
  assert.ok(artifactEntriesFor("js").some((entry) => entry.routeParam === "season-context"));
});

test("seasonal registry and evidence routes are explicit runtime artifacts", async () => {
  const seasonal = artifactEntriesFor("data").filter((entry) =>
    ["season-registry", "season-evidence"].includes(entry.routeParam));
  assert.deepEqual(seasonal.map((entry) => entry.routeParam).sort(), ["season-evidence", "season-registry"]);
  for (const entry of seasonal) {
    assert.equal(entry.publicationClass, "runtime");
    assert.equal(entry.mimeType, "application/json; charset=utf-8");
    assert.ok(Array.isArray(JSON.parse(await readFile(new URL(`data/${entry.sourceBasename}`, projectRoot), "utf8"))));
  }
});

test("season sidecars without manifest entries reject source inventory", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "tqccl-season-inventory-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(rootDir, { recursive: true, force: true }));
  });
  await mkdir(join(rootDir, "data"));
  for (const name of ["season-registry", "season-evidence"]) {
    await writeFile(join(rootDir, "data", `${name}.json`), "[]\n");
  }
  await assert.rejects(validatePublicArtifactTree({ rootDir, manifest: [], kinds: ["data"] }), /source set mismatch/i);
});

test("manifest explicitly classifies every published root artifact", async () => {
  const expectedByKind = {};
  for (const kind of ["js", "css", "data"]) {
    const directory = new URL(`${kind}/`, projectRoot);
    const names = (await import("node:fs/promises"))
      .readdir(directory)
      .then((entries) => entries
        .filter((entry) => kind !== "data" || entry !== "sgsdeck")
        .sort());
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

test("artifact tree accepts only the optional private SGSDeck data subtree", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "tqccl-astro-private-data-"));
  const outsideDir = await mkdtemp(join(tmpdir(), "tqccl-astro-private-outside-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all([
      rm(rootDir, { recursive: true, force: true }),
      rm(outsideDir, { recursive: true, force: true }),
    ]);
  });
  await mkdir(join(rootDir, "data"));
  await writeFile(join(rootDir, "data", "fixture.json"), "{}\n");
  const manifest = [{
    kind: "data",
    routeParam: "fixture",
    sourceBasename: "fixture.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  }];

  await mkdir(join(rootDir, "data", "sgsdeck"));
  await writeFile(join(rootDir, "data", "sgsdeck", "manifest.json"), "{}\n");
  await validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] });

  await mkdir(join(rootDir, "data", "other-private"));
  await assert.rejects(
    validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] }),
    /source set mismatch/i,
  );
  await import("node:fs/promises").then(({ rm }) =>
    rm(join(rootDir, "data", "other-private"), { recursive: true, force: true }));

  await import("node:fs/promises").then(({ rm }) =>
    rm(join(rootDir, "data", "sgsdeck"), { recursive: true, force: true }));
  await writeFile(join(rootDir, "data", "sgsdeck"), "not a directory\n");
  await assert.rejects(
    validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] }),
    /private artifact subtree|real directory/i,
  );

  await import("node:fs/promises").then(({ rm }) => rm(join(rootDir, "data", "sgsdeck")));
  await symlink(outsideDir, join(rootDir, "data", "sgsdeck"), "dir");
  await assert.rejects(
    validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] }),
    /private artifact subtree|real directory|escapes/i,
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
  await mkdir(join(projectDir, "public"));
  await mkdir(join(distDir, "data"));
  await writeFile(join(projectDir, "data", "fixture.json"), "{}\n");
  await writeFile(join(projectDir, "public", "_headers"), "/\n  Cache-Control: max-age=0\n");
  await writeFile(join(distDir, "index.html"), "<!doctype html>\n");
  await writeFile(join(distDir, "_headers"), "/\n  Cache-Control: max-age=0\n");
  const favicon = await readFile(new URL("public/favicon.png", projectRoot));
  await writeFile(join(projectDir, "public", "favicon.png"), favicon);
  await writeFile(join(distDir, "favicon.png"), favicon);
  await writeRecommendedFixture(projectDir, distDir);

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
  await writeFile(join(distDir, "_headers"), "tampered\n");
  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest,
    }),
    /control artifact bytes differ/i,
  );
  await writeFile(join(distDir, "_headers"), "/\n  Cache-Control: max-age=0\n");
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

test("dist verifier admits exactly the catalog team pages, the 404 and no stale publication", async (t) => {
  const { rm } = await import("node:fs/promises");
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-astro-teams-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-astro-teams-dist-"));
  t.after(async () => {
    await Promise.all([
      rm(projectDir, { recursive: true, force: true }),
      rm(distDir, { recursive: true, force: true }),
    ]);
  });
  const manifest = [];
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "_headers"), "/\n  Cache-Control: max-age=0\n");
  await writeFile(join(distDir, "_headers"), "/\n  Cache-Control: max-age=0\n");
  const favicon = await readFile(new URL("public/favicon.png", projectRoot));
  await writeFile(join(projectDir, "public", "favicon.png"), favicon);
  await writeFile(join(distDir, "favicon.png"), favicon);
  await writeRecommendedFixture(projectDir, distDir);
  const verify = () => verifyAstroDist({
    projectRoot: new URL(`file://${projectDir}/`),
    distDir: new URL(`file://${distDir}/`),
    manifest,
  });

  const result = await verify();
  assert.ok(result.files.includes(`teams/legacy/${LEGACY_TEAM_ID}/index.html`));
  assert.ok(result.files.includes("404.html"));

  await rm(join(distDir, "404.html"));
  await assert.rejects(verify(), /missing: 404\.html/i);
  await writeFile(join(distDir, "404.html"), '<!doctype html><h1 id="not-found-title">Không tìm thấy trang</h1>\n');

  await mkdir(join(distDir, "teams", "legacy", "team-khong-co"), { recursive: true });
  await writeFile(join(distDir, "teams", "legacy", "team-khong-co", "index.html"), "<!doctype html>\n");
  await assert.rejects(verify(), /unexpected: teams\/legacy\/team-khong-co\/index\.html/i);
  await rm(join(distDir, "teams", "legacy", "team-khong-co"), { recursive: true });

  // Each legacy publication pin is independently enforced while identity/raw pins remain valid.
  const legacyPagePath = join(distDir, "teams", "legacy", LEGACY_TEAM_ID, "index.html");
  const validLegacyPage = await readFile(legacyPagePath, "utf8");
  await writeFile(legacyPagePath, validLegacyPage.replace(/\sdata-generation-id="[^"]+"/, ""));
  await assert.rejects(verify(), /lacks its validated pin/i);
  await writeFile(
    legacyPagePath,
    validLegacyPage.replace(/data-manifest-sha256="[^"]+"/, `data-manifest-sha256="${"0".repeat(64)}"`),
  );
  await assert.rejects(verify(), /lacks its validated pin/i);

  // A selected publication built from different raw originals must fail the build.
  const stale = await mkdtemp(join(tmpdir(), "tqccl-astro-teams-stale-"));
  const staleDist = await mkdtemp(join(tmpdir(), "tqccl-astro-teams-stale-dist-"));
  t.after(async () => {
    await Promise.all([
      rm(stale, { recursive: true, force: true }),
      rm(staleDist, { recursive: true, force: true }),
    ]);
  });
  await writeRecommendedFixture(stale, staleDist, { legacyTeamsHash: `sha256:${"9".repeat(64)}` });
  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${stale}/`),
      distDir: new URL(`file://${staleDist}/`),
      manifest,
    }),
    /legacy teams hash/i,
  );
});

test("built dist is allowlisted and every emitted asset is byte-identical", async () => {
  const result = await verifyAstroDist({
    projectRoot: new URL("../", import.meta.url),
    distDir: new URL("../dist/", import.meta.url),
  });

  assert.equal(result.assetCount, PUBLIC_ARTIFACTS.length);
  assert.ok(result.files.includes("index.html"));
  assert.ok(result.files.includes("_headers"));
  assert.equal(result.unexpectedFiles.length, 0);
  assert.deepEqual(
    await readFile(new URL("../dist/_headers", import.meta.url)),
    await readFile(new URL("../public/_headers", import.meta.url)),
  );
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assertFrontendShellContract(html, {
    stylesheetPattern: /<link[^>]+rel=["']stylesheet["'][^>]+href=["']\/css\/styles\.css["']/,
    scriptPattern: /<script[^>]+type=["']module["'][^>]+src=["']\/js\/app\.js["'][^>]*><\/script>/,
  });
  assert.doesNotMatch(html, /_astro\//);
});

const LOOKUP_FILES = ["heroes-dict.json", "lookup-catalog.json", "lookup-manifest.json", "tactics.json"];
const SEASON_SIDECARS = ["season-registry", "season-evidence", "season-team-configs", "season-team-evaluations", "season-content-links"];
const dataEntry = (routeParam) => ({
  kind: "data",
  routeParam,
  sourceBasename: `${routeParam}.json`,
  publicationClass: "runtime",
  mimeType: "application/json; charset=utf-8",
});

async function writeLookupBundle(dataDir, overrides = {}) {
  const payloads = {
    "heroes-dict.json": jsonBytes([{ id: "hero:a", viet: "Tướng A" }]),
    "tactics.json": jsonBytes([{ id: "tactic:a", viet: "Chiến pháp A" }]),
    "lookup-catalog.json": jsonBytes({ schemaVersion: 1, equipment: [], specials: [] }),
    ...overrides,
  };
  const files = {};
  for (const name of Object.keys(payloads).sort()) files[name] = sha256(payloads[name]);
  const manifest = {
    schemaVersion: 1,
    generationId: `lookup:${sha256(Buffer.from(`${JSON.stringify(files)}\n`))}`,
    files,
  };
  payloads["lookup-manifest.json"] = jsonBytes(manifest);
  await mkdir(dataDir, { recursive: true });
  for (const [name, bytes] of Object.entries(payloads)) await writeFile(join(dataDir, name), bytes);
  return { payloads, manifest };
}

async function lookupRoot(t, prefix) {
  const rootDir = await mkdtemp(join(tmpdir(), prefix));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(rootDir, { recursive: true, force: true }));
  });
  const bundle = await writeLookupBundle(join(rootDir, "data"));
  return { rootDir, ...bundle };
}

test("manifest adds the lookup modules and data artifacts without dropping completed entries", () => {
  const byRoute = Object.fromEntries(PUBLIC_ARTIFACTS.map((entry) => [`${entry.kind}/${entry.routeParam}`, entry]));
  for (const routeParam of ["lookup-data", "unified-lookup", "lookup-detail", "recommended-reference-state", "recommended-reference-render", "app", "hero-list", "tactics"]) {
    assert.equal(byRoute[`js/${routeParam}`]?.publicationClass, "runtime", `js/${routeParam}`);
  }
  for (const routeParam of ["lookup-catalog", "lookup-manifest", "heroes-dict", "tactics", ...SEASON_SIDECARS]) {
    const entry = byRoute[`data/${routeParam}`];
    assert.equal(entry?.publicationClass, "runtime", `data/${routeParam}`);
    assert.equal(entry.mimeType, "application/json; charset=utf-8");
    assert.equal(entry.sourceBasename, `${routeParam}.json`);
  }
  validatePublicArtifactManifest(PUBLIC_ARTIFACTS);
});

test("lookup publication snapshot returns the verified four-file bundle", async (t) => {
  const { rootDir, payloads, manifest } = await lookupRoot(t, "tqccl-lookup-snapshot-");
  const snapshot = await lookupPublicationSnapshot({ rootDir });

  assert.equal(snapshot.generationId, manifest.generationId);
  assert.deepEqual(snapshot.manifest, manifest);
  assert.deepEqual(Object.keys(snapshot.files).sort(), LOOKUP_FILES);
  for (const [name, bytes] of Object.entries(payloads)) {
    assert.deepEqual(Buffer.from(snapshot.files[name]), bytes);
  }
  assert.deepEqual(await lookupPublicationSnapshot({ rootDir }), snapshot);
});

test("lookup publication snapshot rejects incoherent, incomplete and symlinked bundles", async (t) => {
  const cases = {
    "tampered payload": async (dataDir) => writeFile(join(dataDir, "tactics.json"), jsonBytes([{ id: "tactic:mixed" }])),
    "digest rewritten in manifest": async (dataDir) => {
      const manifest = JSON.parse(await readFile(join(dataDir, "lookup-manifest.json"), "utf8"));
      manifest.files["heroes-dict.json"] = "0".repeat(64);
      await writeFile(join(dataDir, "lookup-manifest.json"), jsonBytes(manifest));
    },
    "generation id not derived from digests": async (dataDir) => {
      const manifest = JSON.parse(await readFile(join(dataDir, "lookup-manifest.json"), "utf8"));
      manifest.generationId = `lookup:${"1".repeat(64)}`;
      await writeFile(join(dataDir, "lookup-manifest.json"), jsonBytes(manifest));
    },
    "missing catalog payload": async (dataDir) => {
      await import("node:fs/promises").then(({ rm }) => rm(join(dataDir, "lookup-catalog.json")));
    },
    "manifest declaring itself": async (dataDir) => {
      const manifest = JSON.parse(await readFile(join(dataDir, "lookup-manifest.json"), "utf8"));
      manifest.files["lookup-manifest.json"] = "0".repeat(64);
      await writeFile(join(dataDir, "lookup-manifest.json"), jsonBytes(manifest));
    },
    "symlinked payload": async (dataDir, outsideDir) => {
      const { rm } = await import("node:fs/promises");
      const planted = join(outsideDir, "heroes-dict.json");
      await writeFile(planted, jsonBytes([{ id: "hero:outside" }]));
      await rm(join(dataDir, "heroes-dict.json"));
      await symlink(planted, join(dataDir, "heroes-dict.json"));
    },
  };
  for (const [label, mutate] of Object.entries(cases)) {
    const { rootDir } = await lookupRoot(t, "tqccl-lookup-invalid-");
    const outsideDir = await mkdtemp(join(tmpdir(), "tqccl-lookup-outside-"));
    t.after(async () => {
      await import("node:fs/promises").then(({ rm }) => rm(outsideDir, { recursive: true, force: true }));
    });
    await mutate(join(rootDir, "data"), outsideDir);
    await assert.rejects(lookupPublicationSnapshot({ rootDir }), /lookup/i, label);
  }
});

test("season hashes and data routes serve the pinned lookup generation", async (t) => {
  const { rootDir, payloads, manifest } = await lookupRoot(t, "tqccl-lookup-pin-");
  const dataDir = join(rootDir, "data");
  const names = [...SEASON_SIDECARS, "teams", "coexist", "books-dict"];
  for (const name of names) await writeFile(join(dataDir, `${name}.json`), jsonBytes([]));
  const artifactManifest = [...names, "heroes-dict", "tactics", "lookup-catalog", "lookup-manifest"].map(dataEntry);

  const hashes = await seasonArtifactHashes({ rootDir, manifest: artifactManifest });
  assert.equal(hashes["heroes-dict"], `sha256:${manifest.files["heroes-dict.json"]}`);
  assert.equal(hashes["tactics"], `sha256:${manifest.files["tactics.json"]}`);

  await writeFile(join(dataDir, "heroes-dict.json"), jsonBytes([{ id: "hero:promoted-mid-build" }]));
  const rehashed = await seasonArtifactHashes({ rootDir, manifest: artifactManifest });
  assert.deepEqual(rehashed, hashes);
  const served = await readPublicArtifact({ kind: "data", routeParam: "heroes-dict", rootDir, manifest: artifactManifest });
  assert.deepEqual(Buffer.from(served.bytes), payloads["heroes-dict.json"]);
});

async function lookupDistFixture(t) {
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-lookup-dist-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-lookup-dist-out-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all([rm(projectDir, { recursive: true, force: true }), rm(distDir, { recursive: true, force: true })]);
  });
  const { payloads, manifest } = await writeLookupBundle(join(projectDir, "data"));
  await mkdir(join(distDir, "data"), { recursive: true });
  for (const [name, bytes] of Object.entries(payloads)) await writeFile(join(distDir, "data", name), bytes);
  await mkdir(join(projectDir, "public"), { recursive: true });
  const headers = "/\n  Cache-Control: max-age=0\n";
  await writeFile(join(projectDir, "public", "_headers"), headers);
  await writeFile(join(distDir, "_headers"), headers);
  const favicon = await readFile(new URL("public/favicon.png", projectRoot));
  await writeFile(join(projectDir, "public", "favicon.png"), favicon);
  await writeFile(join(distDir, "favicon.png"), favicon);
  await writeRecommendedFixture(projectDir, distDir);
  const marker = async (hashes) => {
    const html = await readFile(join(distDir, "index.html"), "utf8");
    const stripped = html.replace(/<script id="season-artifact-hashes"[^>]*>[^<]*<\/script>\n?/, "");
    await writeFile(join(distDir, "index.html"), `${stripped.trimEnd()}<script id="season-artifact-hashes" type="application/json">${JSON.stringify(hashes)}</script>\n`);
  };
  await marker({
    "heroes-dict": `sha256:${manifest.files["heroes-dict.json"]}`,
    tactics: `sha256:${manifest.files["tactics.json"]}`,
  });
  return {
    projectDir,
    distDir,
    payloads,
    manifest,
    marker,
    verify: () => verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest: ["heroes-dict", "tactics", "lookup-catalog", "lookup-manifest"].map(dataEntry),
    }),
  };
}

test("dist verifier accepts one lookup generation across HTML, routes and emitted bytes", async (t) => {
  const fixture = await lookupDistFixture(t);
  const result = await fixture.verify();
  assert.equal(result.lookupGenerationId, fixture.manifest.generationId);
  assert.equal(result.unexpectedFiles.length, 0);
});

test("dist verifier rejects HTML pinned to an older generation than the emitted routes", async (t) => {
  const fixture = await lookupDistFixture(t);
  await fixture.marker({
    "heroes-dict": `sha256:${sha256(jsonBytes([{ id: "hero:previous-generation" }]))}`,
    tactics: `sha256:${fixture.manifest.files["tactics.json"]}`,
  });
  await assert.rejects(fixture.verify(), /generation|season-artifact-hashes/i);
});

test("dist verifier rejects emitted dictionaries that leave the lookup manifest", async (t) => {
  const fixture = await lookupDistFixture(t);
  const desynced = jsonBytes([{ id: "hero:desynced" }]);
  await writeFile(join(fixture.projectDir, "data", "heroes-dict.json"), desynced);
  await writeFile(join(fixture.distDir, "data", "heroes-dict.json"), desynced);
  await fixture.marker({
    "heroes-dict": `sha256:${sha256(desynced)}`,
    tactics: `sha256:${fixture.manifest.files["tactics.json"]}`,
  });
  await assert.rejects(fixture.verify(), /lookup manifest|generation/i);
});

test("dist verifier still enforces the Recommended publication pin alongside lookup checks", async (t) => {
  const fixture = await lookupDistFixture(t);
  const html = await readFile(join(fixture.distDir, "index.html"), "utf8");
  await writeFile(join(fixture.distDir, "index.html"), html.replace(/"generationId":"[0-9a-f]{64}"/, `"generationId":"${"3".repeat(64)}"`));
  await assert.rejects(fixture.verify(), /Recommended/i);
});
