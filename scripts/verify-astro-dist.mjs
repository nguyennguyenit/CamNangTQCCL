import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import astroConfig from "../astro.config.mjs";
import { PUBLIC_ARTIFACTS, validatePublicArtifactManifest } from "../src/lib/public-artifact-manifest.mjs";
import { websiteDisplayPublicationSnapshot } from "../src/lib/root-static-artifacts.ts";
import { recommendedPublicationSnapshot } from "../src/lib/recommended-reference-artifacts.ts";
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";
import { SECTION_PATHS, sitemapDocument } from "../src/pages/sitemap.xml.ts";

export const DEPLOYMENT_CONTROL_ARTIFACTS = Object.freeze([
  Object.freeze({ sourcePath: "public/_headers", outputPath: "_headers" }),
]);

export const STATIC_PUBLIC_ARTIFACTS = Object.freeze([
  Object.freeze({ sourcePath: "public/favicon.png", outputPath: "favicon.png" }),
  Object.freeze({ sourcePath: "public/robots.txt", outputPath: "robots.txt" }),
]);

/** Thư mục public tĩnh phải được copy nguyên trạng vào dist: danh sách file khớp và từng byte khớp. */
export const STATIC_PUBLIC_DIRECTORIES = Object.freeze([
  Object.freeze({ sourcePath: "public/fonts", outputPath: "fonts" }),
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
  staticDirectories = STATIC_PUBLIC_DIRECTORIES,
} = {}) {
  validatePublicArtifactManifest(manifest);
  const rootPath = fileURLToPath(projectRoot);
  const distPath = fileURLToPath(distDir);
  const hasWebsiteDisplay = manifest.some((entry) => entry.kind === "data" && entry.routeParam === "website-display");
  const website = hasWebsiteDisplay ? await websiteDisplayPublicationSnapshot({rootDir: rootPath, manifest}) : null;
  const recommended = website?.recommended ?? await recommendedPublicationSnapshot(resolve(rootPath, "src/data/recommended-reference"));
  const catalog = await teamDetailCatalog({
    recommendedRoot: resolve(rootPath, "src/data/recommended-reference"),
    teamsPath: resolve(rootPath, "data/teams.json"),
    handlesPath: resolve(rootPath, "pipeline/team-route-handles.json"),
    // A verifier root is always explicit: the pinned Khai hoang source comes from the same root.
    khaiHoangPath: resolve(rootPath, "data/khaihoang.json"),
  });
  if (catalog.generationId !== recommended.pin.generationId) {
    throw new Error("Team detail catalog and emitted Recommended generation differ");
  }
  const recommendedFiles = [
    "data/recommended/current.json",
    ...Object.keys(recommended.files).map((name) => `data/recommended/${recommended.pin.generationId}/${name}`),
  ];
  const expectedAssets = manifest.map((artifact) =>
    `${artifact.kind}/${artifact.sourceBasename}`);
  // Font self-host là thư mục public tĩnh: dist phải có đúng danh sách file và đúng từng byte.
  const staticDirectoryFiles = [];
  for (const directory of staticDirectories) {
    const files = await listFiles(resolve(rootPath, directory.sourcePath));
    if (!files.length) throw new Error(`static public directory is empty: ${directory.sourcePath}`);
    for (const file of files) staticDirectoryFiles.push([`${directory.sourcePath}/${file}`, `${directory.outputPath}/${file}`]);
  }
  const sectionHtmlPaths = SECTION_PATHS.map((path) => `${path.slice(1)}index.html`);
  const expectedFiles = [
    "index.html",
    "404.html",
    "sitemap.xml",
    ...sectionHtmlPaths,
    ...catalog.htmlPaths,
    ...expectedAssets,
    ...recommendedFiles,
    ...controlArtifacts.map((artifact) => artifact.outputPath),
    ...staticArtifacts.map((artifact) => artifact.outputPath),
    ...staticDirectoryFiles.map(([, outputPath]) => outputPath),
  ].sort();
  const files = await listFiles(distPath);
  // Route segments may be emitted percent-encoded; identity is the decoded path.
  const decodePath = (file) => {
    try {
      return decodeURIComponent(file);
    } catch {
      return file;
    }
  };
  const emittedByDecodedPath = new Map(files.map((file) => [decodePath(file), file]));
  const unexpectedFiles = files.filter((file) => !expectedFiles.includes(decodePath(file)));
  const missingFiles = expectedFiles.filter((file) => !emittedByDecodedPath.has(file));
  if (unexpectedFiles.length || missingFiles.length) {
    throw new Error(
      `dist allowlist mismatch; unexpected: ${unexpectedFiles.join(", ") || "none"}; missing: ${missingFiles.join(", ") || "none"}`,
    );
  }
  if (emittedByDecodedPath.size !== files.length) throw new Error("dist contains colliding team detail paths");

  // Byte equality with the build-owned generator enforces valid structure, exact absolute
  // origins, and the absence of query/hash drift without maintaining a second XML parser.
  const sitemapXml = await readFile(resolve(distPath, "sitemap.xml"), "utf8");
  const sitemapRoutePaths = [
    ...SECTION_PATHS,
    ...[...catalog.recommended, ...catalog.legacy, ...catalog.khaiHoang].map((entry) => entry.routePath),
  ];
  const expectedSitemapXml = sitemapDocument(astroConfig.site, sitemapRoutePaths);
  if (sitemapXml !== expectedSitemapXml) {
    throw new Error("dist sitemap.xml does not match the generated document");
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
  // Landing chỉ có script chuyển tiếp hash cũ; mọi payload của app.js thuộc về 8 trang mục.
  const readPage = async (decodedPath) => readFile(resolve(distPath, emittedByDecodedPath.get(decodedPath)), "utf8");
  const landing = await readPage("index.html");
  for (const forbidden of ['id="team-route-handles"', 'id="season-artifact-hashes"', 'id="season-controls"', 'src="/js/app.js"']) {
    if (landing.includes(forbidden)) throw new Error(`Landing must not carry the section payload: ${forbidden}`);
  }
  if (!landing.includes('id="legacy-route-redirect"')) throw new Error("Landing lacks the inline legacy route redirect");
  const expectedRegistry = {
    r: Object.fromEntries(catalog.recommended.map((entry) => [entry.sourceConfigId, entry.routeSegment])),
    l: Object.fromEntries(catalog.legacy.map((entry) => [entry.legacyTeamId, entry.routeSegment])),
    k: Object.fromEntries(catalog.khaiHoang.map((entry) => [entry.khaiHoangTeamId, entry.handle])),
  };
  // Bảng payload của phase: cả 8 trang mục nhận `{r,l,k}`; chỉ 5 trang có phạm vi mùa.
  const SEASON_SECTION_PATHS = new Set(["/doi-chuan/", "/doi-khac/", "/cung-ton/", "/soi-doi/", "/goi-y-doi/"]);
  const seasonHashesMarkers = [];
  for (const sectionPath of SECTION_PATHS) {
    const htmlPath = `${sectionPath.slice(1)}index.html`;
    const season = SEASON_SECTION_PATHS.has(sectionPath);
    const page = await readPage(htmlPath);
    if (!page.includes('src="/js/app.js"')) throw new Error(`Section page does not load the section application: ${htmlPath}`);
    const pageSection = page.match(/<body[^>]*\bdata-page-section="([a-z-]+)"/);
    if (!pageSection) throw new Error(`Section page does not declare its page section: ${htmlPath}`);
    if (!page.includes(`id="section-${pageSection[1]}"`)) throw new Error(`Section page lacks its own mount: ${htmlPath}`);
    const registryMatch = page.match(/id="team-route-handles"[^>]*>([^<]+)<\/script>/);
    if (!registryMatch) throw new Error(`Section page lacks the team route handle registry: ${htmlPath}`);
    if (JSON.stringify(JSON.parse(registryMatch[1])) !== JSON.stringify(expectedRegistry)) {
      throw new Error(`Section page team route handle registry differs from the catalog: ${htmlPath}`);
    }
    const embedded = page.match(/id="recommended-publication"[^>]*>([^<]+)<\/script>/);
    if (!embedded) throw new Error(`Section page lacks the Recommended publication pin: ${htmlPath}`);
    const embeddedPin = JSON.parse(embedded[1]);
    if (
      embeddedPin.schemaVersion !== recommended.pin.schemaVersion
      || embeddedPin.generationId !== recommended.pin.generationId
      || embeddedPin.manifestSha256 !== recommended.pin.manifestSha256
    ) throw new Error(`Section page Recommended pin differs from emitted generation: ${htmlPath}`);
    if (website) {
      const embeddedWebsite = page.match(/id="website-display-publication"[^>]*>([^<]+)<\/script>/);
      if (!embeddedWebsite || JSON.stringify(JSON.parse(embeddedWebsite[1])) !== JSON.stringify(website.pin)) {
        throw new Error(`Section page lacks the website display publication pin: ${htmlPath}`);
      }
    }
    const seasonMarker = page.match(/id="season-artifact-hashes"[^>]*>([^<]+)<\/script>/);
    if (season && !seasonMarker) throw new Error(`Season section page lacks its season artifact hashes: ${htmlPath}`);
    if (season && !page.includes('id="season-controls"')) throw new Error(`Season section page lacks its season controls mount: ${htmlPath}`);
    if (!season && seasonMarker) throw new Error(`Section page must not carry season artifact hashes: ${htmlPath}`);
    if (!season && page.includes('id="season-controls"')) throw new Error(`Section page must not carry a season controls mount: ${htmlPath}`);
    if (seasonMarker) seasonHashesMarkers.push(JSON.parse(seasonMarker[1]));
  }

  // Mỗi trang chi tiết phải pin đúng identity đã validate, và không nạp app gốc.
  const pages = [
    ...catalog.recommended.map((entry) => ({
      path: entry.htmlPath,
      entry: "/js/team-detail.js",
      pins: [
        `data-source-config-id="${entry.sourceConfigId}"`,
        `data-scope-key="${entry.safeScopeKey}"`,
        `data-generation-id="${catalog.generationId}"`,
        `data-manifest-sha256="${catalog.manifestSha256}"`,
      ],
    })),
    ...catalog.legacy.map((entry) => ({
      path: entry.htmlPath,
      entry: "/js/team-detail.js",
      pins: [
        `data-legacy-team-id="${entry.legacyTeamId}"`,
        `data-legacy-teams-sha256="${catalog.legacyTeamsSha256}"`,
        `data-generation-id="${catalog.generationId}"`,
        `data-manifest-sha256="${catalog.manifestSha256}"`,
      ],
    })),
    ...catalog.khaiHoang.map((entry) => ({
      path: entry.htmlPath,
      entry: "/js/khaihoang-detail.js",
      pins: [
        `data-family="khaihoang"`,
        `data-khaihoang-team-id="${entry.khaiHoangTeamId}"`,
        `data-khaihoang-sha256="${catalog.khaiHoangSha256}"`,
      ],
    })),
  ];
  for (let start = 0; start < pages.length; start += 64) {
    await Promise.all(pages.slice(start, start + 64).map(async ({ path, entry, pins }) => {
      const page = await readPage(path);
      for (const pin of pins) {
        if (!page.includes(pin)) throw new Error(`Team detail page lacks its validated pin: ${path} (${pin})`);
      }
      if (!page.includes(`src="${entry}"`)) {
        throw new Error(`Team detail page does not load its own entry: ${path} (${entry})`);
      }
      if (website) {
        const pageWebsite = page.match(/id="website-display-publication"[^>]*>([^<]+)<\/script>/);
        if (!pageWebsite || JSON.stringify(JSON.parse(pageWebsite[1])) !== JSON.stringify(website.pin)) {
          throw new Error(`Team detail page lacks the website display publication pin: ${path}`);
        }
      }
      if (page.includes('src="/js/app.js"')) throw new Error(`Team detail page boots the root application: ${path}`);
    }));
  }
  const notFound = await readPage("404.html");
  if (!notFound.includes('id="not-found-title"')) throw new Error("Static 404 page lacks its not-found heading");
  if (notFound.includes('src="/js/app.js"') || notFound.includes('src="/js/team-detail.js"') || notFound.includes('src="/js/khaihoang-detail.js"')) {
    throw new Error("Static 404 page must not boot application entries");
  }
  if (!/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']noindex["'])[^>]*>/iu.test(notFound)) {
    throw new Error("Static 404 page must declare robots=noindex");
  }
  if (/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/iu.test(notFound)) {
    throw new Error("Static 404 page must not declare a canonical URL");
  }
  if (/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/iu.test(notFound)) {
    throw new Error("Static 404 page must not declare og:url");
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
    if (!seasonHashesMarkers.length) throw new Error("No section page carries the season-artifact-hashes generation pin");
    for (const seasonHashes of seasonHashesMarkers) {
      for (const name of ["heroes-dict", "tactics"]) {
        if (seasonHashes[name] !== `sha256:${lookupManifest.files[`${name}.json`]}`) {
          throw new Error("Built HTML season-artifact-hashes differs from lookup generation");
        }
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

  for (const [sourcePath, outputPath] of staticDirectoryFiles) {
    const [sourceBytes, emittedBytes] = await Promise.all([
      readFile(resolve(rootPath, sourcePath)),
      readFile(resolve(distPath, outputPath)),
    ]);
    if (!sourceBytes.equals(emittedBytes)) {
      throw new Error(`Static public file bytes differ from source: ${outputPath}`);
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
    staticFileCount: staticDirectoryFiles.length,
    files,
    unexpectedFiles,
    missingFiles,
    lookupGenerationId,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const result = await verifyAstroDist();
  console.log(`Verified ${result.files.length} dist files (${result.assetCount} raw assets, ${result.staticFileCount} static public files).`);
}
