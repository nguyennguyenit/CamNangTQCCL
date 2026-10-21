import { execFile } from "node:child_process";
import { readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildSeasonCandidates } from "../../../js/roster-season-candidates.js";
import { lookupProfilePath } from "../../../js/lookup-ids.js";
import {
  ArtifactContractError,
  MAX_ARTIFACT_BYTES,
  createDataManifest,
  validateDataSnapshot,
  validateManifest,
  type ArtifactName,
} from "../../src/data/artifact-contracts.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import {
  buildPublicationArtifacts,
  projectCatalogEntities,
  shardRecords,
} from "../../src/data/publication-builder.js";
import {
  PUBLICATION_SHARDED_FAMILIES,
  SHARD_TARGET_BYTES,
  isPublicationArtifactName,
} from "../../src/data/publication-projection.js";
import { publicSnapshotView } from "../../src/data/public-snapshot-view.js";
import { StaticAssetsDataSource, type AssetFetcher } from "../../src/data/static-assets-data-source.js";
import { stableStringify } from "../../src/domain/contracts.js";
import {
  buildRelease,
  editJson,
  removePublicationRoots,
  repositoryDataRoot,
  repositoryPublication,
  repositoryRoot,
  withBytes,
  writePackagedRoot,
  writeRawCheckout,
  type BuiltRelease,
  type RepositoryPublication,
} from "../fixtures/publication-sources.js";

let input: RepositoryPublication;
let release: BuiltRelease;

beforeAll(async () => {
  input = await repositoryPublication();
  release = await buildRelease(input);
}, 120_000);

afterAll(removePublicationRoots);

const decoder = new TextDecoder();
const json = (bytes: Uint8Array) => JSON.parse(decoder.decode(bytes)) as unknown;

describe("snapshot v3 identity and layout", () => {
  it("emits manifest v3 with fixed-grammar shard names under the artifact ceiling", () => {
    expect(release.manifest.schemaVersion).toBe(3);
    const names = release.manifest.artifacts.map((descriptor) => descriptor.name);
    expect(names.slice(0, 11)).toEqual([...release.all.keys()].slice(0, 11));
    const publicationNames = names.slice(11);
    expect(publicationNames.every(isPublicationArtifactName)).toBe(true);
    for (const family of PUBLICATION_SHARDED_FAMILIES) {
      const shards = publicationNames.filter((name) => name.startsWith(`${family}-`));
      expect(shards).toEqual(shards.map((_, index) => `${family}-${String(index).padStart(2, "0")}`));
      expect(shards.length).toBeGreaterThanOrEqual(1);
    }
    for (const descriptor of release.manifest.artifacts) {
      expect(descriptor.byteLength).toBeLessThanOrEqual(MAX_ARTIFACT_BYTES);
    }
    for (const [name, bytes] of release.build.artifacts) {
      if (PUBLICATION_SHARDED_FAMILIES.some((family) => name.startsWith(`${family}-`))) {
        expect(bytes.byteLength).toBeLessThanOrEqual(SHARD_TARGET_BYTES + 256 * 1024);
      }
    }
  });

  it("is deterministic and binds projection bytes plus upstream pins into releaseId", async () => {
    const again = await buildRelease(input);
    expect(again.manifest.releaseId).toBe(release.manifest.releaseId);
    for (const [name, bytes] of release.build.artifacts) expect(again.build.artifacts.get(name)).toEqual(bytes);

    const registryName = "reference-registry" as ArtifactName;
    const tampered = new Map(release.all);
    tampered.set(registryName, new TextEncoder().encode(`${stableStringify([{ ...(json(release.all.get(registryName)!) as unknown[])[0] as object, defaultSourceSeasonId: "x" }])}\n`));
    const otherManifest = await createDataManifest(tampered, { publication: release.build.meta });
    expect(otherManifest.releaseId).not.toBe(release.manifest.releaseId);

    const repinned = {
      ...release.build.meta,
      upstream: { ...release.build.meta.upstream, lookup: { generationId: `lookup:${"0".repeat(64)}` } },
    };
    expect((await createDataManifest(release.all, { publication: repinned })).releaseId).not.toBe(release.manifest.releaseId);
  }, 60_000);

  it("round-trips through validateDataSnapshot with a read model", async () => {
    const snapshot = await validateDataSnapshot(release.manifest, release.all);
    expect(snapshot.publication).toBeDefined();
    expect(snapshot.manifest.schemaVersion).toBe(3);
    const view = await publicSnapshotView(snapshot);
    expect(view.publication).toBe(snapshot.publication);
  });

  it("keeps exact v1/v2 identity (regression)", async () => {
    const legacy = new Map([...release.all].filter(([name]) => !isPublicationArtifactName(name)));
    const v2 = await createDataManifest(legacy);
    expect(v2.schemaVersion).toBe(2);
    expect(v2).not.toHaveProperty("publication");
    const fixture = new URL("../fixtures/release-snapshot/", import.meta.url);
    const v1 = new Map(
      await Promise.all(
        ["teams", "team-tier", "coexist", "heroes-dict", "tactics", "books-dict"].map(
          async (name) => [name as ArtifactName, new Uint8Array(await readFile(new URL(`${name}.json`, fixture)))] as const,
        ),
      ),
    );
    expect(await createDataManifest(v1)).toEqual(JSON.parse(await readFile(new URL("manifest.json", fixture), "utf8")));
    const snapshot = await validateDataSnapshot(v2, legacy);
    expect(snapshot.publication).toBeUndefined();
  });

  it("reports measured bytes", () => {
    const sizes = Object.fromEntries(release.manifest.artifacts.map((descriptor) => [descriptor.name, descriptor.byteLength]));
    // Printed for the layout decision recorded in publication-projection.ts.
    console.info("v3 artifact bytes", JSON.stringify(sizes));
    expect(Object.keys(sizes).length).toBeGreaterThan(11);
  });
});

describe("mixed generation and tampering", () => {
  it("rejects a website display pinned to another Recommended generation", async () => {
    const bad = withBytes(input.sources, {
      websiteDisplay: editJson<{ recommendedPin: { generationId: string } }>(input.sources.websiteDisplay, (value) => {
        value.recommendedPin.generationId = "0".repeat(64);
      }),
    });
    await expect(buildPublicationArtifacts({ objects: input.objects, sources: bad })).rejects.toThrow();
  });

  it("rejects a Recommended selector that points at another manifest", async () => {
    const bad = {
      ...input.sources,
      recommended: {
        ...input.sources.recommended,
        current: editJson<{ manifestSha256: string }>(input.sources.recommended.current, (value) => {
          value.manifestSha256 = "1".repeat(64);
        }),
      },
    };
    await expect(buildPublicationArtifacts({ objects: input.objects, sources: bad })).rejects.toThrow();
  });

  it("rejects a route ledger from another generation or another legacy corpus", async () => {
    const generation = withBytes(input.sources, {
      routeLedger: editJson<{ generationId: string }>(input.sources.routeLedger, (value) => {
        value.generationId = "2".repeat(64);
      }),
    });
    await expect(buildPublicationArtifacts({ objects: input.objects, sources: generation })).rejects.toThrow();
    const corpus = withBytes(input.sources, {
      routeLedger: editJson<{ legacyTeamsSha256: string }>(input.sources.routeLedger, (value) => {
        value.legacyTeamsSha256 = `sha256:${"3".repeat(64)}`;
      }),
    });
    await expect(buildPublicationArtifacts({ objects: input.objects, sources: corpus })).rejects.toThrow();
  });

  it("rejects a lookup catalog that is not the verified generation", async () => {
    const sidecars = new Map(input.sources.sidecars);
    sidecars.set("lookup-catalog.json", new TextEncoder().encode("{}"));
    await expect(buildPublicationArtifacts({ objects: input.objects, sources: { ...input.sources, sidecars } })).rejects.toThrow();
  });

  it("rejects a manifest whose pins disagree even when its identity is recomputed", async () => {
    const meta = release.build.meta;
    const mixed = {
      ...meta,
      upstream: {
        ...meta.upstream,
        websiteDisplay: {
          ...meta.upstream.websiteDisplay,
          recommendedPin: { ...meta.upstream.websiteDisplay.recommendedPin, generationId: "4".repeat(64) },
        },
      },
    };
    await expect(createDataManifest(release.all, { publication: mixed })).rejects.toBeInstanceOf(ArtifactContractError);
  });

  it("rejects registry upstream drift against the manifest", async () => {
    const registryName = "reference-registry" as ArtifactName;
    const [registry] = json(release.all.get(registryName)!) as Array<{ upstream: { lookup: { generationId: string } } }>;
    registry!.upstream.lookup.generationId = `lookup:${"5".repeat(64)}`;
    const all = new Map(release.all);
    all.set(registryName, new TextEncoder().encode(`${stableStringify([registry])}\n`));
    const manifest = await createDataManifest(all, { publication: release.build.meta });
    await expect(validateDataSnapshot(manifest, all)).rejects.toBeInstanceOf(ArtifactContractError);
  });

  it("rejects a release whose legacy artifact bytes differ from the projection's pins", async () => {
    const all = new Map(release.all);
    const teams = json(all.get("teams")!) as Array<Record<string, unknown>>;
    teams[0] = { ...teams[0]!, nickname: "changed" };
    all.set("teams", new TextEncoder().encode(JSON.stringify(teams)));
    const manifest = await createDataManifest(all, { publication: release.build.meta });
    await expect(validateDataSnapshot(manifest, all)).rejects.toBeInstanceOf(ArtifactContractError);
  });

  it("rejects wrong hashes, unknown or traversing shard names and a missing shard", async () => {
    const entityShard = "catalog-entities-00" as ArtifactName;
    const flipped = new Map(release.all);
    const bytes = new Uint8Array(flipped.get(entityShard)!);
    bytes[10] = bytes[10] === 0x61 ? 0x62 : 0x61;
    flipped.set(entityShard, bytes);
    await expect(validateDataSnapshot(release.manifest, flipped)).rejects.toBeInstanceOf(ArtifactContractError);

    const manifest = JSON.parse(JSON.stringify(release.manifest)) as { artifacts: Array<{ name: string; key: string }> };
    for (const bad of ["catalog-entities-99", "catalog-entities-0", "catalog-entities-00/../teams", "../catalog-entities-00", "catalog-entities-00.json"]) {
      const copy = JSON.parse(JSON.stringify(manifest)) as typeof manifest;
      copy.artifacts.find((descriptor) => descriptor.name === "catalog-entities-00")!.name = bad;
      await expect(validateManifest(copy)).rejects.toBeInstanceOf(ArtifactContractError);
    }
    const traversal = JSON.parse(JSON.stringify(manifest)) as typeof manifest;
    traversal.artifacts.find((descriptor) => descriptor.name === "catalog-entities-00")!.key = "../teams.json";
    await expect(validateManifest(traversal)).rejects.toBeInstanceOf(ArtifactContractError);

    const missing = new Map(release.all);
    missing.delete(entityShard);
    await expect(validateDataSnapshot(release.manifest, missing)).rejects.toBeInstanceOf(ArtifactContractError);
    const extra = new Map(release.all);
    extra.set("catalog-entities-77" as ArtifactName, new TextEncoder().encode("[]"));
    await expect(validateDataSnapshot(release.manifest, extra)).rejects.toBeInstanceOf(ArtifactContractError);
  });
});

describe("ingress", () => {
  it("FilesystemDataSource reads a packaged v3 root and rejects hash, symlink and stray-file tampering", async () => {
    const root = await writePackagedRoot(release);
    const snapshot = await new FilesystemDataSource({ dataRoot: root }).load();
    expect(snapshot.releaseId).toBe(release.manifest.releaseId);
    expect(snapshot.publication?.entities.length).toBeGreaterThan(0);

    const flipped = await writePackagedRoot(release);
    const shardPath = join(flipped, "reference-team-details-00.json");
    const bytes = await readFile(shardPath);
    bytes[10] = bytes[10] === 0x61 ? 0x62 : 0x61;
    await writeFile(shardPath, bytes);
    await expect(new FilesystemDataSource({ dataRoot: flipped }).load()).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });

    const linked = await writePackagedRoot(release);
    await rm(join(linked, "public-routes.json"));
    await symlink(join(root, "public-routes.json"), join(linked, "public-routes.json"));
    await expect(new FilesystemDataSource({ dataRoot: linked }).load()).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });

    const stray = await writePackagedRoot(release);
    await writeFile(join(stray, "catalog-entities-42.json"), "[]");
    await expect(new FilesystemDataSource({ dataRoot: stray }).load()).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
  });

  it("FilesystemDataSource builds the same v3 release from a raw repository checkout", async () => {
    const { dataRoot } = await writeRawCheckout();
    const snapshot = await new FilesystemDataSource({ dataRoot }).load();
    expect(snapshot.manifest.schemaVersion).toBe(3);
    expect(snapshot.releaseId).toBe(release.manifest.releaseId);
  }, 60_000);

  it("FilesystemDataSource refuses a raw checkout with a drifted Recommended generation", async () => {
    const { root, dataRoot } = await writeRawCheckout();
    const ledger = join(root, "pipeline/team-route-handles.json");
    await writeFile(ledger, editJson<{ generationId: string }>(await readFile(ledger), (value) => { value.generationId = "6".repeat(64); }));
    await expect(new FilesystemDataSource({ dataRoot }).load()).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
  }, 60_000);

  it("the repository data root itself loads as v3 (CLI default)", async () => {
    const snapshot = await new FilesystemDataSource({ dataRoot: repositoryDataRoot }).load();
    expect(snapshot.manifest.schemaVersion).toBe(3);
    expect(snapshot.publication).toBeDefined();
  }, 60_000);

  function fetcher(assets: ReadonlyMap<string, Uint8Array>): AssetFetcher {
    return {
      async fetch(request) {
        const bytes = assets.get(new URL(request.url).pathname);
        return bytes === undefined
          ? new Response(null, { status: 404 })
          : new Response(bytes.slice(), { status: 200, headers: { "Content-Length": String(bytes.byteLength) } });
      },
    };
  }

  function assetsOf(built: BuiltRelease) {
    return new Map<string, Uint8Array>([
      ["/manifest.json", new TextEncoder().encode(`${stableStringify(built.manifest)}\n`)],
      ...[...built.all].map(([name, bytes]) => [`/${name}.json`, bytes] as const),
    ]);
  }

  it("StaticAssetsDataSource derives the inventory from the validated manifest only", async () => {
    const assets = assetsOf(release);
    const snapshot = await new StaticAssetsDataSource({ fetcher: fetcher(assets) }).load();
    expect(snapshot.releaseId).toBe(release.manifest.releaseId);
    expect(snapshot.publication?.teams.length).toBeGreaterThan(0);

    const missing = new Map(assets);
    missing.delete("/reference-team-details-00.json");
    await expect(new StaticAssetsDataSource({ fetcher: fetcher(missing) }).load()).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });

    // A v3 manifest paired with another release's shard bytes (mixed inventory).
    const mixed = new Map(assets);
    const other = await buildRelease({
      ...input,
      sources: withBytes(input.sources, { routeLedger: input.sources.routeLedger }),
    });
    mixed.set("/public-routes.json", other.all.get("reference-registry" as ArtifactName)!);
    await expect(new StaticAssetsDataSource({ fetcher: fetcher(mixed) }).load()).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });

    const requested: string[] = [];
    const spy: AssetFetcher = { fetch: (request) => { requested.push(new URL(request.url).pathname); return fetcher(assets).fetch(request); } };
    await new StaticAssetsDataSource({ fetcher: spy }).load();
    expect(requested.sort()).toEqual([...assets.keys()].sort());
  });
});

describe("projection allowlist", () => {
  it("drops non-allowlisted and private fields instead of copying records", () => {
    const entities = projectCatalogEntities({
      heroes: [{ id: "hero:a", viet: "A", chinese: "甲", hanViet: "Giáp", aliases: ["甲"], iconUrl: "https://x", linkScore: 1, pending: false, sgsdeckPath: "data/sgsdeck/x", privateNote: "secret", stats: { luc: 1 }, lookup: { variant: "base", leaked: "secret" } }],
      tactics: [{ id: "tactic:t", viet: "T", chinese: "戰", effect: "e", internalReview: "secret", lookup: { revisions: [], hidden: 1, effectZhSource: { kind: "translation" } } }],
      books: [{ viet: "Sách", chinese: "書", effect: "e", effectViet: "v", editorNote: "secret" }],
      catalog: {
        equipment: [{ id: "equipment:e", nameVi: "E", aliasesVi: [], aliasesZh: ["裝"], conditions: [], missingFields: [], slotVi: "Vũ khí", qualityVi: "Cam", reviewer: "secret" }],
        specials: [{ id: "equipment-special:s", nameVi: "S", equipmentId: "equipment:e", aliasesVi: [], aliasesZh: [], slotVi: "Vũ khí", tierVi: "T0", conditions: [], missingFields: [], sgsdeck: "secret" }],
        advisors: [],
        troopMods: [],
        buildings: [],
      },
    });
    const text = JSON.stringify(entities);
    for (const forbidden of ["secret", "sgsdeck", "iconUrl", "linkScore", "pending", "leaked", "hidden"]) {
      expect(text).not.toContain(forbidden);
    }
    expect(entities.map((entity) => entity.id).sort()).toEqual(["book:sach", "equipment-special:s", "equipment:e", "hero:a", "tactic:t"]);
    const equipment = entities.find((entity) => entity.id === "equipment:e")!;
    expect((equipment.profile as { specialIds: string[] }).specialIds).toEqual(["equipment-special:s"]);
    const tactic = entities.find((entity) => entity.id === "tactic:t")!;
    expect(tactic.profile).toHaveProperty("lookup", { revisions: [], effectZhSource: { kind: "translation" } });
  });

  it("never serializes the private subtree or non-allowlisted dictionary fields into artifacts", () => {
    for (const [name, bytes] of release.build.artifacts) {
      const text = decoder.decode(bytes);
      expect(text, name).not.toContain("sgsdeck");
      expect(text, name).not.toContain("iconUrl");
      expect(text, name).not.toContain("linkScore");
    }
  });

  it("shards deterministically by byte budget", () => {
    const records = Array.from({ length: 10 }, (_, index) => ({ id: `r${index}`, pad: "x".repeat(SHARD_TARGET_BYTES / 4) }));
    const shards = shardRecords(records, "catalog-entities");
    expect(shards.length).toBeGreaterThan(1);
    expect(shards.flat()).toEqual(records);
    expect(shardRecords(records, "catalog-entities")).toEqual(shards);
    expect(() => shardRecords([], "catalog-entities")).toThrow();
  });
});

const execFileAsync = promisify(execFile);

/** Ask the website's own route catalog (src/lib/team-detail-routes.ts) in a Node subprocess, so Astro-side code never enters this typecheck. */
async function websiteRouteCatalog() {
  const script = `import {teamDetailCatalog} from "./src/lib/team-detail-routes.ts"; const c = await teamDetailCatalog(); console.log(JSON.stringify({recommended: c.recommended.map(e => [e.sourceConfigId, e.routePath]), legacy: c.legacy.map(e => [e.legacyTeamId, e.routePath]), khaiHoang: c.khaiHoang.map(e => [e.khaiHoangTeamId, e.routePath]), variants: c.variants.map(v => v.legacyTeamId)}));`;
  const { stdout } = await execFileAsync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], { cwd: repositoryRoot, maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout) as { recommended: Array<[string, string]>; legacy: Array<[string, string]>; khaiHoang: Array<[string, string]>; variants: string[] };
}

describe("route and locale parity", () => {
  it("entity routes equal the Tra cứu profile paths for vi and zh", async () => {
    const { publication } = await validateDataSnapshot(release.manifest, release.all);
    const model = publication!;
    const kinds = new Set(model.entities.map((entity) => entity.kind));
    expect([...kinds].sort()).toEqual(["advisor", "book", "building", "equipment", "equipment-special", "hero", "tactic", "troop-mod"]);
    for (const entity of model.entities) {
      const vi = lookupProfilePath(entity.id)!;
      expect(entity.pagePath).toEqual({ vi, zh: `/zh${vi}` });
      expect(vi.startsWith("/tra-cuu/")).toBe(true);
      expect(vi).toContain(`?id=${encodeURIComponent(entity.id)}`);
    }
    expect(model.getEntity("hero:sp-lu-mong")?.pagePath.vi).toBe("/tra-cuu/tuong/?id=hero%3Asp-lu-mong");
  });

  it("team routes equal the website's handle-ledger route catalog", async () => {
    const { publication } = await validateDataSnapshot(release.manifest, release.all);
    const model = publication!;
    const catalog = await websiteRouteCatalog();
    for (const [sourceConfigId, routePath] of catalog.recommended) {
      const team = model.getTeam(`recommended:${sourceConfigId}`)!;
      expect(team.pagePath).toEqual({ vi: routePath, zh: `/zh${routePath}` });
    }
    for (const [khaiHoangTeamId, routePath] of catalog.khaiHoang) {
      expect(model.getTeam(`khaihoang:${khaiHoangTeamId}`)!.pagePath.vi).toBe(routePath);
    }
    const admitted = new Set(catalog.variants);
    const other = model.teams.filter((team) => team.collection === "other");
    expect(other.length).toBeGreaterThan(0);
    for (const team of other) {
      const entry = catalog.legacy.find(([legacyTeamId]) => legacyTeamId === team.id)!;
      expect(admitted.has(team.id)).toBe(true);
      expect(team.pagePath).toEqual({ vi: entry[1], zh: `/zh${entry[1]}` });
    }
    expect(model.teams.filter((team) => team.collection === "recommended").length).toBe(catalog.recommended.length);
  });
});

describe("read model", () => {
  let model: NonNullable<Awaited<ReturnType<typeof validateDataSnapshot>>["publication"]>;
  beforeAll(async () => {
    model = (await validateDataSnapshot(release.manifest, release.all)).publication!;
  });

  it("searches all seven Tra cứu groups by Vi, Han and Han-Viet names", () => {
    const groups = new Set(model.entities.map((entity) => entity.group));
    expect([...groups].sort()).toEqual(["advisors", "books", "buildings", "equipment", "heroes", "tactics", "troop-mods"]);
    const equipment = model.entities.find((entity) => entity.kind === "equipment")!;
    expect(model.searchCatalog(equipment.nameVi, { kinds: ["equipment"] }).items[0]?.entity.id).toBe(equipment.id);
    const hero = model.entities.find((entity) => entity.kind === "hero" && entity.nameZh && entity.hanViet)!;
    expect(model.searchCatalog(hero.nameZh!, { kinds: ["hero"] }).items.map((item) => item.entity.id)).toContain(hero.id);
    expect(model.searchCatalog(hero.hanViet!, { kinds: ["hero"] }).items.map((item) => item.entity.id)).toContain(hero.id);
    const page = model.searchCatalog("", { groups: ["advisors"], limit: 5, offset: 2 });
    expect(page.items).toHaveLength(5);
    expect(page.total).toBeGreaterThan(5);
  });

  it("keeps equipment specials, advisor, troop-mod and building detail fields", () => {
    const special = model.entities.find((entity) => entity.kind === "equipment-special" && entity.profile.equipmentId)!;
    expect(special.profile.equipmentId).toBeTruthy();
    const building = model.entities.find((entity) => entity.kind === "building")!;
    expect(Array.isArray(building.profile.levels)).toBe(true);
    const troop = model.entities.find((entity) => entity.kind === "troop-mod")!;
    expect(troop.profile.effectVi).toBeTruthy();
    const advisor = model.entities.find((entity) => entity.kind === "advisor")!;
    expect(advisor.profile.effectVi).toBeTruthy();
  });

  it("exposes the Recommended season registry and collections", () => {
    const { seasons } = model;
    expect(seasons.seasonOptions.some((option) => option.sourceSeasonId === seasons.defaultSourceSeasonId)).toBe(true);
    expect(seasons.collections.map((collection) => collection.id)).toEqual(["recommended", "other", "khaihoang", "engine"]);
    expect(seasons.categories.length).toBeGreaterThan(0);
  });

  it("finds Recommended teams with source season, tier and holder/slot detail", () => {
    const season = model.seasons.defaultSourceSeasonId;
    const page = model.findTeams({ collection: "recommended", sourceSeasonId: season, limit: 5 });
    expect(page.total).toBeGreaterThan(0);
    for (const team of page.items) {
      expect(team.sourceSeasonId).toBe(season);
      expect(team.sourceCategoryId).toBeTruthy();
      expect(team.heroes.length).toBeGreaterThan(0);
      expect(team.heroes[0]).toHaveProperty("holder", 0);
    }
    const detail = model.getTeam(page.items[0]!.ref)!;
    expect(detail.collection).toBe("recommended");
    const resolved = detail.resolved as { heroes: Array<{ holder: number; tactics: Array<{ slot: number }> }> };
    expect(resolved.heroes.length).toBe(page.items[0]!.heroes.length);
    const ids = page.items[0]!.heroes.map((hero) => hero.heroId).filter((id): id is string => id !== null);
    if (ids.length > 0) expect(model.findTeams({ heroIds: ids, collection: "recommended", sourceSeasonId: season }).items.map((team) => team.ref)).toContain(page.items[0]!.ref);
    expect(model.findTeams({ sourceSeasonId: "no-such-season" }).total).toBe(0);
  });

  it("Other teams are admitted variants with alternatives and tactic refs, not raw legacy", () => {
    const other = model.findTeams({ collection: "other", limit: 100 });
    expect(other.total).toBe(model.seasons.collections.find((collection) => collection.id === "other")!.count);
    const detail = model.getTeam(other.items[0]!.ref)!;
    const variants = detail.variants as Array<{ variantId: string; content: unknown; resolved: { heroes: Array<{ alternatives: unknown[]; tactics: Array<{ tacticId?: string | null; alternatives: unknown[] }> }> } }>;
    expect(variants.length).toBeGreaterThan(0);
    expect(variants[0]!.variantId).toMatch(/^v-/u);
    expect(variants[0]!.resolved.heroes[0]).toHaveProperty("alternatives");
    expect(variants[0]!.resolved.heroes[0]!.tactics[0]).toHaveProperty("tacticId");
  });

  it("Khai hoang detail carries the localized team and does not pull chamSuTeams/mines unless linked", () => {
    const first = model.findTeams({ collection: "khaihoang", limit: 1 }).items[0]!;
    const detail = model.getTeam(first.ref)!;
    expect(detail.team).toBeDefined();
    expect(JSON.stringify(detail)).not.toContain("chamSuTeams");
    expect(first.pagePath.vi.startsWith("/khai-hoang/")).toBe(true);
  });

  it("serves raw Recommended records that drive buildSeasonCandidates exactly like the website index", async () => {
    const generationId = (json(input.sources.recommended.current) as { generationId: string }).generationId;
    const index = (json(input.sources.recommended.files.get("index.json")!) as { records: Array<Record<string, unknown>> }).records;
    const heroesDict = json(input.objects.get("heroes-dict")!) as unknown[];
    const tacticsDict = json(input.objects.get("tactics")!) as unknown[];
    expect(generationId).toMatch(/^[0-9a-f]{64}$/u);
    for (const option of model.seasons.seasonOptions.slice(0, 6)) {
      const website = buildSeasonCandidates(index, option.sourceSeasonId, { heroesDict, tacticsDict });
      const mcp = buildSeasonCandidates([...model.recommendSourceRecords(option.sourceSeasonId)], option.sourceSeasonId, { heroesDict, tacticsDict });
      expect(mcp).toEqual(website);
    }
    const season = model.seasons.defaultSourceSeasonId;
    const mapped = buildSeasonCandidates([...model.recommendSourceRecords(season)], season, { heroesDict, tacticsDict });
    expect(mapped.diagnostics.total).toBeGreaterThan(0);
  });
});
