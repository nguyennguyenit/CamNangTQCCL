import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
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
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";
import {
  GET as sitemapGet,
  SITEMAP_MIME,
  sitemapDocument,
  sitemapLocations,
} from "../src/pages/sitemap.xml.ts";
import { verifyAstroDist } from "../scripts/verify-astro-dist.mjs";
import { assertFrontendShellContract } from "./frontend-shell-contract-assertions.mjs";

const projectRoot = new URL("../", import.meta.url);

const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const LEGACY_TEAM_ID = "team-intro-0";
const LEGACY_HANDLE = "vinh-quang-thuong";
const LEGACY_ROUTE_SEGMENT = LEGACY_HANDLE;

const KHAIHOANG_TEAM_ID = "gia-cat-khac-sp-ma-sieu-phap-chinh";
const KHAIHOANG_HANDLE = KHAIHOANG_TEAM_ID;
const KHAIHOANG_ROUTE_SEGMENT = KHAIHOANG_HANDLE;
const KHAIHOANG_TITLE = "Gia Cát Khác · SP Mã Siêu · Pháp Chính";

const FIXTURE_ORIGIN = "https://tqccl.pages.dev";

/** The fixture dist mirrors the built sitemap: the root page plus every catalog route, XML-escaped. */
const fixtureSitemapXml = (locations) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locations.map((location) => `  <url>\n    <loc>${location}</loc>\n  </url>`).join("\n")}
</urlset>
`;

const FIXTURE_ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${FIXTURE_ORIGIN}/sitemap.xml\n`;

const FIXTURE_HEADERS = "/\n  Cache-Control: max-age=0\n";

/** Tám trang mục tĩnh của mô hình đường dẫn mới; 5 trang đầu có phạm vi mùa. */
const SECTION_PAGE_SPECS = [
  { path: "doi-chuan", section: "team-chuan", season: true },
  { path: "doi-khac", section: "team-khac", season: true },
  { path: "cung-ton", section: "coexist", season: true },
  { path: "khai-hoang", section: "khaihoang", season: false },
  { path: "tra-cuu", section: "lookup", season: false },
  { path: "theo-doi-chieu-mo", section: "recruit-tracker", season: false },
  { path: "soi-doi-tu-anh", section: "analyze", season: false },
  { path: "goi-y-doi-tu-kho", section: "roster-recommend", season: false },
];
const SECTION_LOCATIONS = SECTION_PAGE_SPECS.map(({ path }) => `${FIXTURE_ORIGIN}/${path}/`);
const SEASON_MARKER = {
  "heroes-dict": `sha256:${"0".repeat(64)}`,
  tactics: `sha256:${"0".repeat(64)}`,
};

/** Trang mục trong fixture mang đúng payload mà verifier khóa theo bảng của phase. */
function sectionPageHtml({ section, season, registry, pin, seasonHashes }) {
  return [
    `<!doctype html><body data-page-section="${section}">`,
    `<section id="section-${section}" class="section active"></section>`,
    season ? '<div id="season-controls"></div>' : "",
    `<script id="team-route-handles" type="application/json">${JSON.stringify(registry)}</script>`,
    `<script id="recommended-publication" type="application/json">${JSON.stringify(pin)}</script>`,
    season ? `<script id="season-artifact-hashes" type="application/json">${JSON.stringify(seasonHashes)}</script>` : "",
    '<script type="module" src="/js/app.js"></script>',
    "\n",
  ].join("");
}

/** Landing chỉ còn script chuyển tiếp hash cũ; không payload, không app.js. */
const LANDING_HTML = '<!doctype html><body><script id="legacy-route-redirect">(function(){})();</script>\n';

/** Font self-host là thư mục public tĩnh; fixture dist phải có bản sao byte-equal ở cả hai phía. */
async function writeStaticFonts(projectDir, distDir) {
  const source = await readdir(new URL("public/fonts/", projectRoot));
  assert.ok(source.includes("OFL.txt"), "public/fonts phải kèm giấy phép OFL");
  await mkdir(join(projectDir, "public", "fonts"), { recursive: true });
  await mkdir(join(distDir, "fonts"), { recursive: true });
  for (const name of source) {
    const bytes = await readFile(new URL(`public/fonts/${name}`, projectRoot));
    await writeFile(join(projectDir, "public", "fonts", name), bytes);
    await writeFile(join(distDir, "fonts", name), bytes);
  }
}

/** Ảnh tĩnh của public (favicon, ảnh chia sẻ og:image) được copy nguyên byte như Astro làm. */
async function writeStaticImages(projectDir, distDir) {
  for (const name of ["favicon.png", "og-image.png"]) {
    const bytes = await readFile(new URL(`public/${name}`, projectRoot));
    await writeFile(join(projectDir, "public", name), bytes);
    await writeFile(join(distDir, name), bytes);
  }
}

/** Head metadata is read back by attribute so tag order never decides the contract. */
const tagAttribute = (tag, name) => tag?.match(new RegExp(`${name}=["']([^"']*)["']`, "u"))?.[1] ?? null;
const linkHref = (html, rel) => tagAttribute(html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, "u"))?.[0], "href");
const metaContent = (html, key) => tagAttribute(html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "u"))?.[0], "content");

/** robots.txt, the sitemap and every canonical are locked to the single configured origin. */
async function configuredSite() {
  const source = await readFile(new URL("../astro.config.mjs", import.meta.url), "utf8");
  const match = source.match(/site:\s*["'](https?:\/\/[^"']+)["']/u);
  assert.ok(match, "astro.config.mjs must declare an absolute site origin");
  return match[1];
}

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
    "hero-summaries.json": jsonBytes({ schemaVersion: 1, provenance: {
      catalogSha256: `sha256:${"0".repeat(64)}`,
      recommendedJoin: "heroes[].nameRaw ↔ chinese|aliases", otherJoin: "holders[].nameRaw ↔ hanViet",
      unmatchedSlots: { recommended: 0, other: 0 }, ambiguousSlots: { recommended: 0, other: 0 },
    }, summaries: {} }),
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
  const registry = {
    r: {},
    l: { [LEGACY_TEAM_ID]: LEGACY_HANDLE },
    k: { [KHAIHOANG_TEAM_ID]: KHAIHOANG_HANDLE },
  };
  await writeFile(join(distDir, "index.html"), LANDING_HTML);
  for (const spec of SECTION_PAGE_SPECS) {
    await mkdir(join(distDir, spec.path), { recursive: true });
    await writeFile(join(distDir, spec.path, "index.html"), sectionPageHtml({ ...spec, registry, pin, seasonHashes: SEASON_MARKER }));
  }
  await writeFile(
    join(distDir, "404.html"),
    '<!doctype html><head><meta name="robots" content="noindex"></head><h1 id="not-found-title">Không tìm thấy trang</h1>\n',
  );
  // The route cutover reads its frozen handles from the ledger of the same project root.
  await mkdir(join(projectDir, "pipeline"), { recursive: true });
  const khaiHoangBytes = jsonBytes({ teams: [{ id: KHAIHOANG_TEAM_ID, title: KHAIHOANG_TITLE }] });
  await writeFile(join(projectDir, "data", "khaihoang.json"), khaiHoangBytes);
  const ledger = {
    schemaVersion: 2,
    generationId,
    legacyTeamsSha256: `sha256:${sha256(teamsBytes)}`,
    khaihoangSha256: `sha256:${sha256(khaiHoangBytes)}`,
    note: "Handle URL đã review; gán một lần, không suy lại từ displayNameVi.",
    handles: {
      recommended: {},
      legacy: { [LEGACY_TEAM_ID]: LEGACY_HANDLE },
      khaihoang: { [KHAIHOANG_TEAM_ID]: KHAIHOANG_HANDLE },
    },
  };
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(ledger));
  // robots.txt is a static public artifact; the sitemap is derived from the same frozen catalog.
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "robots.txt"), FIXTURE_ROBOTS);
  await writeFile(join(distDir, "robots.txt"), FIXTURE_ROBOTS);
  const sitemap = fixtureSitemapXml([
    `${FIXTURE_ORIGIN}/`,
    ...[
      ...SECTION_LOCATIONS,
      `${FIXTURE_ORIGIN}/doi-khac/${LEGACY_ROUTE_SEGMENT}/`,
      `${FIXTURE_ORIGIN}/khai-hoang/${KHAIHOANG_ROUTE_SEGMENT}/`,
    ].sort(),
  ]);
  await writeFile(join(distDir, "sitemap.xml"), sitemap);
  await mkdir(join(distDir, "doi-khac", LEGACY_ROUTE_SEGMENT), { recursive: true });
  await writeFile(
    join(distDir, "doi-khac", LEGACY_ROUTE_SEGMENT, "index.html"),
    `<!doctype html><article id="team-detail-root" data-legacy-team-id="${LEGACY_TEAM_ID}" data-legacy-teams-sha256="sha256:${sha256(teamsBytes)}" data-generation-id="${generationId}" data-manifest-sha256="${sha256(manifest)}"></article><script type="module" src="/js/team-detail.js"></script>\n`,
  );
  await mkdir(join(distDir, "khai-hoang", KHAIHOANG_ROUTE_SEGMENT), { recursive: true });
  await writeFile(
    join(distDir, "khai-hoang", KHAIHOANG_ROUTE_SEGMENT, "index.html"),
    `<!doctype html><article id="team-detail-root" data-family="khaihoang" data-khaihoang-team-id="${KHAIHOANG_TEAM_ID}" data-khaihoang-sha256="sha256:${sha256(khaiHoangBytes)}"></article><script type="module" src="/js/khaihoang-detail.js"></script>\n`,
  );
  return { ledger, generationId, manifest, sitemap };
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
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "index.html"), "<!doctype html>\n");
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
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
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
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
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  const fixture = await writeRecommendedFixture(projectDir, distDir);
  const verify = () => verifyAstroDist({
    projectRoot: new URL(`file://${projectDir}/`),
    distDir: new URL(`file://${distDir}/`),
    manifest,
  });

  const result = await verify();
  assert.ok(result.files.includes(`doi-khac/${LEGACY_ROUTE_SEGMENT}/index.html`));
  assert.ok(result.files.includes("404.html"));
  assert.ok(!result.files.some((file) => file.startsWith("teams/")));
  await writeFile(join(distDir, "sitemap.xml"), fixture.sitemap.replaceAll(FIXTURE_ORIGIN, "https://wrong.example"));
  await assert.rejects(verify(), /sitemap.*generated document/i);
  await writeFile(join(distDir, "sitemap.xml"), fixture.sitemap.replace("</loc>", "?q=wrong</loc>"));
  await assert.rejects(verify(), /sitemap.*generated document/i);
  await writeFile(join(distDir, "sitemap.xml"), fixture.sitemap.replace("</urlset>", "<broken></urlset>"));
  await assert.rejects(verify(), /sitemap.*generated document/i);
  await writeFile(join(distDir, "sitemap.xml"), fixture.sitemap);
  const validNotFound = await readFile(join(distDir, "404.html"), "utf8");
  await writeFile(join(distDir, "404.html"), validNotFound.replace('<meta name="robots" content="noindex">', ""));
  await assert.rejects(verify(), /404.*noindex/i);
  await writeFile(
    join(distDir, "404.html"),
    validNotFound.replace(
      "</head>",
      '<link rel="canonical" href="https://tqccl.pages.dev/404/"><meta property="og:url" content="https://tqccl.pages.dev/404/"></head>',
    ),
  );
  await assert.rejects(verify(), /404.*canonical|404.*og:url/i);
  await writeFile(join(distDir, "404.html"), validNotFound);

  await rm(join(distDir, "404.html"));
  await assert.rejects(verify(), /missing: 404\.html/i);
  await writeFile(join(distDir, "404.html"), validNotFound);

  // The verifier's inventory is the ledger's frozen segment, not a path it re-derives.
  const relocated = { ...fixture.ledger, handles: { ...fixture.ledger.handles, legacy: { [LEGACY_TEAM_ID]: "hoang-ma-thuong" } } };
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(relocated));
  await assert.rejects(verify(), /missing: doi-khac\/hoang-ma-thuong\/index\.html/i);
  await assert.rejects(verify(), /unexpected: doi-khac\/vinh-quang-thuong\/index\.html/i);
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(fixture.ledger));

  // A relocated Khai hoang handle moves that page too: the frozen segment is the inventory.
  const relocatedKhaiHoang = { ...fixture.ledger, handles: { ...fixture.ledger.handles, khaihoang: { [KHAIHOANG_TEAM_ID]: "khai-hoang-doi-ten" } } };
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(relocatedKhaiHoang));
  await assert.rejects(verify(), /missing: khai-hoang\/khai-hoang-doi-ten\/index\.html/i);
  await assert.rejects(verify(), /unexpected: khai-hoang\/gia-cat-khac-sp-ma-sieu-phap-chinh\/index\.html/i);
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(fixture.ledger));

  // Every Khai hoang page pins its own identity, its source hash and its own entry.
  const khaiHoangPagePath = join(distDir, "khai-hoang", KHAIHOANG_ROUTE_SEGMENT, "index.html");
  const validKhaiHoangPage = await readFile(khaiHoangPagePath, "utf8");
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace(`data-khaihoang-team-id="${KHAIHOANG_TEAM_ID}"`, 'data-khaihoang-team-id="team-doi-ten"'));
  await assert.rejects(verify(), /lacks its validated pin/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace(/data-khaihoang-sha256="[^"]+"/u, `data-khaihoang-sha256="sha256:${"0".repeat(64)}"`));
  await assert.rejects(verify(), /lacks its validated pin/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace('src="/js/khaihoang-detail.js"', 'src="/js/app.js"'));
  await assert.rejects(verify(), /does not load its own entry|boots the root application/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage);

  // Hai trang chi tiết cùng <title> hoặc cùng meta description thì tab/kết quả tìm kiếm không phân biệt được.
  const legacyDetailPath = join(distDir, "doi-khac", LEGACY_ROUTE_SEGMENT, "index.html");
  const validLegacyDetail = await readFile(legacyDetailPath, "utf8");
  const withHead = (html, title, description) => html.replace("<!doctype html>", `<!doctype html><head><title>${title}</title><meta name="description" content="${description}"></head>`);
  await writeFile(legacyDetailPath, withHead(validLegacyDetail, "Đội A — Đội khác", "Mô tả A"));
  await writeFile(khaiHoangPagePath, withHead(validKhaiHoangPage, "Đội B — Khai hoang", "Mô tả B"));
  await verify();
  await writeFile(khaiHoangPagePath, withHead(validKhaiHoangPage, "Đội A — Đội khác", "Mô tả B"));
  await assert.rejects(verify(), /duplicate <title>.*Đội A — Đội khác/i);
  await writeFile(khaiHoangPagePath, withHead(validKhaiHoangPage, "Đội B — Khai hoang", "Mô tả A"));
  await assert.rejects(verify(), /duplicate meta description.*Mô tả A/i);
  await writeFile(legacyDetailPath, validLegacyDetail);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage);

  await mkdir(join(distDir, "doi-khac", "team-khong-co"), { recursive: true });
  await writeFile(join(distDir, "doi-khac", "team-khong-co", "index.html"), "<!doctype html>\n");
  await assert.rejects(verify(), /unexpected: doi-khac\/team-khong-co\/index\.html/i);
  await rm(join(distDir, "doi-khac", "team-khong-co"), { recursive: true });

  // A page still emitted under the retired route family is not part of the inventory.
  await mkdir(join(distDir, "teams", "legacy", LEGACY_TEAM_ID), { recursive: true });
  await writeFile(join(distDir, "teams", "legacy", LEGACY_TEAM_ID, "index.html"), "<!doctype html>\n");
  await assert.rejects(verify(), /unexpected: teams\/legacy\/team-intro-0\/index\.html/i);
  await rm(join(distDir, "teams"), { recursive: true });

  // Each legacy publication pin is independently enforced while identity/raw pins remain valid.
  const legacyPagePath = join(distDir, "doi-khac", LEGACY_ROUTE_SEGMENT, "index.html");
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
  // Font self-host đi kèm giấy phép và nằm trong allowlist dist.
  assert.ok(result.files.includes("fonts/be-vietnam-pro-400-latin.woff2"));
  assert.ok(result.files.includes("fonts/OFL.txt"));
  // The Khai hoang page ships with its own entry: both must exist in the emitted dist.
  assert.ok(result.files.includes("js/khaihoang-detail.js"));
  assert.ok(result.files.includes("khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/index.html"));
  assert.equal(result.unexpectedFiles.length, 0);
  assert.deepEqual(
    await readFile(new URL("../dist/_headers", import.meta.url)),
    await readFile(new URL("../public/_headers", import.meta.url)),
  );
  const html = await readFile(new URL("../dist/doi-chuan/index.html", import.meta.url), "utf8");
  assertFrontendShellContract(html, {
    stylesheetPattern: /<link[^>]+rel=["']stylesheet["'][^>]+href=["']\/css\/styles\.css["']/,
    scriptPattern: /<script[^>]+type=["']module["'][^>]+src=["']\/js\/app\.js["'][^>]*><\/script>/,
    section: "team-chuan",
  });
  assert.doesNotMatch(html, /_astro\//);
  // Landing là trang riêng: không nạp app.js, chỉ có script chuyển tiếp hash cũ.
  const landing = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(landing, /_astro\//);
  assert.match(landing, /id=["']legacy-route-redirect["']/);
  // Script chặn phải chứa nguyên thân hàm thuần của js/legacy-routes.js, không phải bản sao rời.
  assert.match(landing, /function resolveLegacyRoute\(/);
  assert.match(landing, /addEventListener\(['"]hashchange['"]/);
  assert.doesNotMatch(landing, /src=["']\/js\/app\.js["']/);
  assert.doesNotMatch(landing, /id=["']team-route-handles["']/);
  assert.doesNotMatch(landing, /id=["']season-artifact-hashes["']/);
  // Landing chỉ có một h1 (tiêu đề hero); tên thương hiệu ở header là span, không phải h1 thứ hai.
  assert.equal((landing.match(/<h1\b/g) ?? []).length, 1);
  assert.match(landing, /<span class="brand-text"><span class="site-title">/);
  // Panel menu thả là danh sách link (disclosure) nên không khai aria-haspopup.
  assert.doesNotMatch(landing, /aria-haspopup/);
  assert.doesNotMatch(html, /aria-haspopup/);
  // Nguồn gốc QR (lệnh sinh + phiên bản qrcode) phải ra dist trong comment ngay đầu SVG;
  // frontmatter của DownloadQr.astro không được build xuất ra nên không tính.
  const qrProvenance = landing.match(/class="landing-qr-frame"[^>]*>\s*<svg\b[^>]*>\s*<!--([\s\S]*?)-->/)?.[1] ?? "";
  assert.ok(
    qrProvenance.includes('npx --yes qrcode@1.5.4 -t svg "https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true"'),
    "QR SVG in dist/index.html lacks the generation command comment",
  );
  assert.match(qrProvenance, /qrcode@1\.5\.4/);
  // Bộ lọc điểm đã bỏ từ Phase 5: mô tả /doi-chuan/ không còn nhắc "điểm".
  assert.match(html, /<meta name="description" content="Danh sách đội hình Đội chuẩn theo dữ liệu SGSDeck Recommended, lọc theo phe, loại binh và mùa nguồn\."/);
});

test("built dist declares canonical, article metadata, robots and the catalog sitemap", async () => {
  const site = await configuredSite();
  const origin = new URL(site).origin;
  const rootHref = new URL("/", origin).href;
  const read = (relative) => readFile(new URL(`../dist/${relative}`, import.meta.url), "utf8");
  const catalog = await teamDetailCatalog();

  const index = await read("index.html");
  assert.equal(linkHref(index, "canonical"), rootHref);
  assert.equal(metaContent(index, "og:url"), rootHref);
  assert.equal(metaContent(index, "og:type"), "website");

  for (const entry of [catalog.recommended[0], catalog.legacy[0], catalog.khaiHoang[0]]) {
    assert.ok(entry, "the catalog must publish all three detail families");
    const html = await read(entry.htmlPath);
    const canonical = new URL(entry.routePath, origin).href;
    assert.equal(linkHref(html, "canonical"), canonical, entry.htmlPath);
    assert.equal(metaContent(html, "og:url"), canonical, entry.htmlPath);
    assert.equal(metaContent(html, "og:type"), "article", entry.htmlPath);
  }

  const notFound = await read("404.html");
  assert.equal(metaContent(notFound, "robots"), "noindex");
  assert.equal(linkHref(notFound, "canonical"), null);
  assert.equal(metaContent(notFound, "og:url"), null);

  const robots = await read("robots.txt");
  assert.deepEqual(
    await readFile(new URL("../dist/robots.txt", import.meta.url)),
    await readFile(new URL("../public/robots.txt", import.meta.url)),
  );
  assert.deepEqual(
    robots.split(/\r?\n/u).filter(Boolean),
    ["User-agent: *", "Allow: /", `Sitemap: ${rootHref}sitemap.xml`],
  );
  assert.doesNotMatch(robots, /Disallow/iu);

  const sitemap = await read("sitemap.xml");
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
  const locations = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/gu)].map(([, location]) => location);
  // Release baseline: Landing, 8 trang mục, 1366 Recommended, 166 legacy và 17 Khai hoang.
  assert.equal(locations.length, 1558);
  assert.deepEqual(
    locations,
    [rootHref, ...[
      ...SECTION_PAGE_SPECS.map(({ path }) => `/${path}/`),
      ...[...catalog.recommended, ...catalog.legacy, ...catalog.khaiHoang].map((entry) => entry.routePath),
    ].sort().map((path) => new URL(path, origin).href)],
  );
  for (const location of locations) {
    const url = new URL(location);
    assert.equal(url.origin, origin, location);
    assert.equal(url.pathname.startsWith("/teams/"), false, location);
  }
});

test("every canonical page declares site name, Vietnamese locale and an absolute og:image shipped in dist", async () => {
  const origin = new URL(await configuredSite()).origin;
  const sitemap = await readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
  const pages = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/gu)].map(([, location]) => new URL(location).pathname);
  const images = new Set();
  for (const pathname of pages) {
    const html = await readFile(new URL(`../dist${pathname}index.html`, import.meta.url), "utf8");
    assert.ok(linkHref(html, "canonical"), pathname);
    assert.equal(metaContent(html, "og:site_name"), "Cẩm Nang Tam Quốc Chí", pathname);
    assert.equal(metaContent(html, "og:locale"), "vi_VN", pathname);
    const image = metaContent(html, "og:image");
    assert.ok(image, `${pathname} lacks og:image`);
    const url = new URL(image);
    assert.equal(url.origin, origin, pathname);
    images.add(url.pathname);
  }
  for (const pathname of images) {
    const info = await stat(new URL(`../dist${pathname}`, import.meta.url));
    assert.ok(info.isFile() && info.size > 0, `${pathname} must ship in dist`);
  }
});

test("sitemap endpoint publishes exactly the root page plus the catalog routes", async () => {
  const site = await configuredSite();
  const origin = new URL(site).origin;
  const catalog = await teamDetailCatalog();
  const response = await sitemapGet({ site: new URL(site) });

  assert.equal(response.headers.get("content-type"), SITEMAP_MIME);
  const xml = await response.text();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/u);
  assert.doesNotMatch(xml, /<lastmod>|<changefreq>|<priority>/u);

  const locations = [...xml.matchAll(/<loc>([^<]*)<\/loc>/gu)].map(([, location]) => location);
  const routePaths = [
    ...SECTION_PAGE_SPECS.map(({ path }) => `/${path}/`),
    ...[...catalog.recommended, ...catalog.legacy, ...catalog.khaiHoang].map((entry) => entry.routePath),
  ];
  assert.equal(catalog.recommended.length, 1366);
  assert.equal(catalog.legacy.length, 166);
  assert.equal(catalog.khaiHoang.length, 17);
  assert.equal(locations.length, 1558);
  assert.deepEqual(
    locations,
    [new URL("/", origin).href, ...routePaths.sort().map((path) => new URL(path, origin).href)],
  );
  assert.equal(new Set(locations).size, locations.length);
  assert.equal(locations.filter((location) => new URL(location).pathname.startsWith("/teams/")).length, 0);
});

test("sitemap endpoint fails closed on a missing origin, duplicates and the retired family", async () => {
  await assert.rejects(sitemapGet({ site: undefined }), /origin/iu);
  await assert.rejects(sitemapGet({ site: new URL("file:///tmp/site") }), /http/iu);
  assert.throws(() => sitemapLocations("not a url", ["/"]), /origin/iu);
  assert.throws(() => sitemapLocations(FIXTURE_ORIGIN, ["/doi-chuan/a/", "/doi-chuan/a/"]), /duplicate/iu);
  assert.throws(() => sitemapLocations(FIXTURE_ORIGIN, ["/teams/legacy/team-intro-0/"]), /retired/iu);
});

test("sitemap XML escapes loc metacharacters", () => {
  // `&` and `'` survive URL normalization in a path, so the emitted text must escape them.
  const xml = sitemapDocument(FIXTURE_ORIGIN, ["/doi-chuan/a&b'c/"]);
  assert.match(xml, /<loc>https:\/\/tqccl\.pages\.dev\/doi-chuan\/a&amp;b&apos;c\/<\/loc>/u);
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/u);
});

test("dist verifier locks the emitted sitemap to the catalog route set", async (t) => {
  const { rm } = await import("node:fs/promises");
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-sitemap-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-sitemap-dist-"));
  t.after(async () => {
    await Promise.all([
      rm(projectDir, { recursive: true, force: true }),
      rm(distDir, { recursive: true, force: true }),
    ]);
  });
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  await writeRecommendedFixture(projectDir, distDir);
  const verify = () => verifyAstroDist({
    projectRoot: new URL(`file://${projectDir}/`),
    distDir: new URL(`file://${distDir}/`),
    manifest: [],
  });

  await verify();
  const root = `${FIXTURE_ORIGIN}/`;
  const detail = `${FIXTURE_ORIGIN}/doi-khac/${LEGACY_ROUTE_SEGMENT}/`;
  const khaiHoang = `${FIXTURE_ORIGIN}/khai-hoang/${KHAIHOANG_ROUTE_SEGMENT}/`;
  // Generator: root trước, rồi toàn bộ route (trang mục + chi tiết) đã sort.
  const sitemapFor = (locations) => fixtureSitemapXml([root, ...[...locations].sort()]);
  const catalogLocations = [...SECTION_LOCATIONS, detail, khaiHoang];
  const complete = sitemapFor(catalogLocations);
  const without = (location) => sitemapFor(catalogLocations.filter((item) => item !== location));
  const rejected = {
    "the root page is missing": fixtureSitemapXml([...catalogLocations].sort()),
    "a section page is missing": without(SECTION_LOCATIONS[0]),
    "a legacy route is missing": without(detail),
    "a Khai hoang route is missing": without(khaiHoang),
    "the retired family is published": sitemapFor([...catalogLocations, `${FIXTURE_ORIGIN}/teams/legacy/${LEGACY_TEAM_ID}/`]),
    "a URL is published twice": sitemapFor([...catalogLocations, khaiHoang]),
  };
  for (const [label, xml] of Object.entries(rejected)) {
    await writeFile(join(distDir, "sitemap.xml"), xml);
    await assert.rejects(verify(), /sitemap/i, label);
  }
  await writeFile(join(distDir, "sitemap.xml"), complete);
  await verify();

  // A shell or payload served as sitemap.xml is not a sitemap.
  await writeFile(join(distDir, "sitemap.xml"), "<!doctype html>\n");
  await assert.rejects(verify(), /sitemap/i);
  await writeFile(join(distDir, "sitemap.xml"), complete);
  await verify();

  // robots.txt stays a byte-identical copy of its reviewed source.
  await writeFile(join(distDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
  await assert.rejects(verify(), /robots\.txt/i);
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

test("dist verifier byte-locks the self-hosted font directory", async (t) => {
  const { rm } = await import("node:fs/promises");
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-fonts-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-fonts-dist-"));
  t.after(async () => {
    await Promise.all([
      rm(projectDir, { recursive: true, force: true }),
      rm(distDir, { recursive: true, force: true }),
    ]);
  });
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  await writeRecommendedFixture(projectDir, distDir);
  const verify = () => verifyAstroDist({
    projectRoot: new URL(`file://${projectDir}/`),
    distDir: new URL(`file://${distDir}/`),
    manifest: [],
  });

  const result = await verify();
  assert.ok(result.staticFileCount >= 16, "mọi file font + giấy phép phải nằm trong allowlist dist");
  assert.ok(result.files.includes("fonts/OFL.txt"));

  // Sửa nội dung một file font trong dist là lệch byte với nguồn đã review.
  await writeFile(join(distDir, "fonts", "OFL.txt"), "tampered\n");
  await assert.rejects(verify(), /fonts\/OFL\.txt/i);
  await writeStaticFonts(projectDir, distDir);

  // File lạ trong dist/fonts không được lọt qua allowlist.
  await writeFile(join(distDir, "fonts", "extra.woff2"), "x");
  await assert.rejects(verify(), /unexpected: fonts\/extra\.woff2/i);
  await rm(join(distDir, "fonts", "extra.woff2"));

  // Thiếu một file font đã publish cũng chặn.
  await rm(join(distDir, "fonts", "OFL.txt"));
  await assert.rejects(verify(), /missing: fonts\/OFL\.txt/i);
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
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  await writeRecommendedFixture(projectDir, distDir);
  // Pin mùa sống ở cả 5 trang mục có phạm vi mùa; fixture phải đổi đồng bộ mọi trang.
  const marker = async (hashes) => {
    for (const spec of SECTION_PAGE_SPECS.filter((entry) => entry.season)) {
      const pagePath = join(distDir, spec.path, "index.html");
      const html = await readFile(pagePath, "utf8");
      const stripped = html.replace(/<script id="season-artifact-hashes"[^>]*>[^<]*<\/script>\n?/, "");
      await writeFile(pagePath, `${stripped.trimEnd()}<script id="season-artifact-hashes" type="application/json">${JSON.stringify(hashes)}</script>\n`);
    }
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
  const pagePath = join(fixture.distDir, "doi-chuan", "index.html");
  const html = await readFile(pagePath, "utf8");
  await writeFile(pagePath, html.replace(/"generationId":"[0-9a-f]{64}"/, `"generationId":"${"3".repeat(64)}"`));
  await assert.rejects(fixture.verify(), /Recommended/i);
});
