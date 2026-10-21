/**
 * Builds the v3 publication projection from the same bytes the website verifiers accept.
 * Pure (bytes in, bytes out); Node ingress code reads files and calls `buildPublicationArtifacts`.
 * Layout and byte measurements: see the header of `publication-projection.ts`.
 */
import { loadWebsiteDisplay, localizeData } from "../../../js/website-display.js";
import { bookLookupId, createLookupIdResolver, lookupProfilePath } from "../../../js/lookup-ids.js";
import { innateHolderIndex } from "../../../js/lookup-innate-holders.js";
import { localePath } from "../../../js/i18n.js";
import { stableStringify } from "../domain/contracts.js";

import { MAX_ARTIFACT_BYTES, type ArtifactBytes, type ArtifactName, type ArtifactRecord } from "./artifact-contracts.js";
import { allowKhaiHoangTeam, allowOtherHolder, allowTierRanking } from "./team-source-allowlist.js";
import { verifyLookupPayloads } from "./lookup-bundle.js";
import {
  KIND_GROUP,
  MAX_SHARDS_PER_FAMILY,
  PublicationContractError,
  SHARD_TARGET_BYTES,
  UPSTREAM_SOURCE_KEYS,
  detailShardOrder,
  entityShardOrder,
  publicationArtifactNames,
  shardName,
  validatePublicationMeta,
  type CatalogGroup,
  type CatalogKind,
  type PublicationMeta,
  type PublicationShardFamily,
  type PublicationUpstream,
} from "./publication-projection.js";

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
const encoder = new TextEncoder();

export interface RecommendedGenerationBytes {
  current: Uint8Array;
  manifest: Uint8Array;
  /** Every file declared by the generation manifest except `manifest.json`. */
  files: ReadonlyMap<string, Uint8Array>;
}

export interface PublicationSources {
  recommended: RecommendedGenerationBytes;
  /** `pipeline/team-route-handles.json` bytes. */
  routeLedger: Uint8Array;
  /** `data/website-display.json` bytes. */
  websiteDisplay: Uint8Array;
  /** Website-public files that are not MCP artifacts: khaihoang.json, lookup-catalog.json, lookup-manifest.json. */
  sidecars: ReadonlyMap<string, Uint8Array>;
}

export interface PublicationBuild {
  artifacts: Map<string, Uint8Array>;
  meta: PublicationMeta;
}

type Json = Record<string, unknown>;

const fail = (message: string): never => {
  throw new PublicationContractError(message);
};

function parseJson(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    return fail(`${label} is not valid JSON`);
  }
}

function obj(value: unknown, label: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Json;
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value as unknown[];
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const sha = async (bytes: Uint8Array) => `sha256:${await sha256Hex(bytes)}` as `sha256:${string}`;

// ---------------------------------------------------------------------------------------------
// Recommended generation (pure re-implementation of src/lib/recommended-reference-artifacts.ts checks)
// ---------------------------------------------------------------------------------------------

const GENERATION_FILE = /^(?:manifest|seasons|index|other-teams|hero-summaries|tactic-summaries|details-s-[0-9a-f]{64})\.json$/u;

interface VerifiedRecommended {
  pin: { schemaVersion: 1; generationId: string; manifestSha256: string };
  manifest: Json;
  index: Json[];
  other: Json[];
  seasons: Json;
  detailsByScope: Map<string, Json[]>;
}

async function verifyRecommended(source: RecommendedGenerationBytes): Promise<VerifiedRecommended> {
  const current = obj(parseJson(source.current, "Recommended current.json"), "Recommended current.json");
  if (
    Object.keys(current).sort().join(",") !== "generationId,manifestSha256,schemaVersion"
    || current.schemaVersion !== 1
    || typeof current.generationId !== "string" || !/^[0-9a-f]{64}$/u.test(current.generationId)
    || typeof current.manifestSha256 !== "string" || !/^[0-9a-f]{64}$/u.test(current.manifestSha256)
  ) fail("Recommended current selector is invalid");
  if ((await sha256Hex(source.manifest)) !== current.manifestSha256) fail("Recommended manifest hash mismatch");
  const manifest = obj(parseJson(source.manifest, "Recommended manifest"), "Recommended manifest");
  if (manifest.schemaVersion !== 1 || manifest.generationId !== current.generationId || manifest.dedupKeyVersion !== 1) {
    fail("Recommended manifest identity mismatch");
  }
  const declared = obj(manifest.files, "Recommended manifest.files");
  const scopes = list(manifest.allowedScopeKeys, "Recommended allowedScopeKeys") as string[];
  const required = [
    "index.json",
    "other-teams.json",
    "seasons.json",
    "hero-summaries.json",
    "tactic-summaries.json",
    ...scopes.map((key) => `details-${key}.json`),
  ].sort();
  const names = Object.keys(declared).sort();
  if (names.length === 0 || names.some((name) => name === "manifest.json" || !GENERATION_FILE.test(name)) || names.join("\0") !== required.join("\0")) {
    fail("Recommended file inventory is invalid");
  }
  if ([...source.files.keys()].sort().join("\0") !== names.join("\0")) fail("Recommended generation inventory mismatch");
  for (const name of names) {
    const bytes = source.files.get(name)!;
    const item = obj(declared[name], `Recommended manifest.files.${name}`);
    if (bytes.byteLength !== item.bytes || (await sha256Hex(bytes)) !== item.sha256) {
      fail(`Recommended artifact hash mismatch: ${name}`);
    }
  }
  const file = (name: string) => obj(parseJson(source.files.get(name)!, name), name);
  const index = list(file("index.json").records, "index.records").map((row, i) => obj(row, `index.records[${i}]`));
  const other = list(file("other-teams.json").records, "other-teams.records").map((row, i) => obj(row, `other-teams.records[${i}]`));
  const detailsByScope = new Map<string, Json[]>();
  for (const key of scopes) {
    detailsByScope.set(key, list(file(`details-${key}.json`).records, `details-${key}.records`).map((row, i) => obj(row, `details-${key}.records[${i}]`)));
  }
  return {
    pin: { schemaVersion: 1, generationId: current.generationId as string, manifestSha256: current.manifestSha256 as string },
    manifest,
    index,
    other,
    seasons: file("seasons.json"),
    detailsByScope,
  };
}

// ---------------------------------------------------------------------------------------------
// Route ledger (logic mirrors src/lib/team-detail-routes.ts; parity is pinned by a test)
// ---------------------------------------------------------------------------------------------

interface Ledger {
  generationId: string;
  legacyTeamsSha256: string;
  khaihoangSha256: string;
  recommended: Record<string, string>;
  legacy: Record<string, string>;
  khaiHoang: Record<string, string>;
}

const UNSAFE_IDENTIFIER = /[\u0000-\u001f\u007f/\\?#%:*"<>|\s]/u;

export function isRoutableIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && encoder.encode(value).byteLength <= 128
    && !UNSAFE_IDENTIFIER.test(value)
    && !value.startsWith(".")
    && !value.endsWith(".");
}

const SEASON_CODE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u;

export function recommendedRouteSegment(sourceSeasonCode: unknown, handle: string): string | null {
  return typeof sourceSeasonCode === "string" && SEASON_CODE.test(sourceSeasonCode)
    ? `${sourceSeasonCode.toLowerCase()}-${handle}`
    : null;
}

export const recommendedRoutePath = (segment: string) => `/doi-chuan/${encodeURIComponent(segment)}/`;
export const legacyRoutePath = (segment: string) => `/doi-khac/${encodeURIComponent(segment)}/`;
export const khaiHoangRoutePath = (segment: string) => `/khai-hoang/${encodeURIComponent(segment)}/`;

function parseLedger(bytes: Uint8Array): Ledger {
  const raw = obj(parseJson(bytes, "team route handle ledger"), "team route handle ledger");
  if (raw.schemaVersion !== 2) fail("team route handle ledger schemaVersion must be 2");
  const sha = /^sha256:[0-9a-f]{64}$/u;
  if (typeof raw.generationId !== "string" || !raw.generationId) fail("team route handle ledger needs a generationId");
  if (typeof raw.legacyTeamsSha256 !== "string" || !sha.test(raw.legacyTeamsSha256)) fail("ledger legacyTeamsSha256 is invalid");
  if (typeof raw.khaihoangSha256 !== "string" || !sha.test(raw.khaihoangSha256)) fail("ledger khaihoangSha256 is invalid");
  const handles = obj(raw.handles, "ledger handles");
  if (Object.keys(handles).sort().join(",") !== "khaihoang,legacy,recommended") fail("ledger handle families are invalid");
  const family = (key: string) => {
    const value = obj(handles[key], `ledger handles.${key}`);
    const output: Record<string, string> = {};
    for (const [id, handle] of Object.entries(value)) {
      if (typeof handle !== "string") fail(`ledger handle must be a string: ${key} ${id}`);
      output[id] = handle as string;
    }
    return output;
  };
  return {
    generationId: raw.generationId as string,
    legacyTeamsSha256: raw.legacyTeamsSha256 as string,
    khaihoangSha256: raw.khaihoangSha256 as string,
    recommended: family("recommended"),
    legacy: family("legacy"),
    khaiHoang: family("khaihoang"),
  };
}

function exactKeySet(actual: Record<string, string>, expected: Set<string>, label: string) {
  const missing = [...expected].filter((key) => !Object.hasOwn(actual, key));
  const unknown = Object.keys(actual).filter((key) => !expected.has(key));
  if (missing.length || unknown.length) fail(`route ledger ${label} handles differ from the pinned corpus`);
}

// ---------------------------------------------------------------------------------------------
// Catalog projection (allowlists)
// ---------------------------------------------------------------------------------------------

const HERO_FIELDS = ["faction", "stars", "cost", "stats", "troopApt", "roleTag", "roleTagViet", "isSP", "inheritTacticCn", "selfTacticCn"] as const;
const HERO_LOOKUP_FIELDS = [
  "advisorId", "cardPacks", "categoryVi", "civil", "civilInnatePoints", "collectibleBonusVi", "conditions",
  "exclusiveTitleVi", "flags", "growth", "inheritTacticId", "missingFields", "otherAptitudes", "redRulesVi",
  "revisions", "selfTacticId", "usageVi", "usageZh", "variant",
] as const;
const TACTIC_FIELDS = ["type", "quality", "target", "targetViet", "troopFit", "source", "sourceHeroCn", "effect", "effectViet"] as const;
const TACTIC_LOOKUP_FIELDS = [
  "acquiredFromVi", "activationRate", "conditions", "conflictsVi", "cooldown", "effectTypeVi", "effectZhSource", "exchangeConditionVi",
  "formerIds", "inheritedFromIds", "maxUsers", "missingFields", "pointCost", "revisions",
] as const;
const BOOK_FIELDS = ["effect", "effectViet", "effectVersion", "sourceNames"] as const;
const CATALOG_FIELDS = {
  equipment: ["slotVi", "qualityVi", "conditions", "missingFields"],
  advisors: ["effectVi", "elementVi", "usageVi", "heroIds", "tacticPoints", "conditions", "missingFields"],
  troopMods: ["effectVi", "appliesToVi", "troopLimitVi", "suggestedBuildVi", "options", "revisions", "conditions", "missingFields"],
  buildings: ["summaryVi", "mainCityOnly", "maxLevel", "levels", "conditions", "missingFields"],
  specials: ["equipmentId", "slotVi", "tierVi", "exclusiveHeroId", "descriptionVi", "acquisitionVi", "conditions", "missingFields"],
} as const;

function pick(source: Json, keys: readonly string[]): Json {
  const output: Json = {};
  for (const key of keys) if (Object.hasOwn(source, key) && source[key] !== undefined) output[key] = source[key];
  return output;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

function entity(kind: CatalogKind, id: string, nameVi: string, nameZh: string | null, hanViet: string | null, aliases: string[], profile: Json): ArtifactRecord {
  return { id, kind, group: KIND_GROUP[kind], nameVi, nameZh, hanViet, aliases: [...new Set(aliases)], profile };
}

export interface CatalogProjectionInput {
  heroes: readonly ArtifactRecord[];
  tactics: readonly ArtifactRecord[];
  books: readonly ArtifactRecord[];
  catalog: Json;
}

/** Allowlisted projection of the seven Tra cứu groups; unknown source fields are dropped, never copied. */
export function projectCatalogEntities(input: CatalogProjectionInput): ArtifactRecord[] {
  const output: ArtifactRecord[] = [];
  for (const hero of input.heroes) {
    const id = text(hero.id) ?? fail("hero record has no id");
    output.push(entity("hero", id, text(hero.viet) ?? fail(`hero ${id} has no name`), text(hero.chinese), text(hero.hanViet), strings(hero.aliases), {
      ...pick(hero, HERO_FIELDS),
      ...(hero.lookup === undefined ? {} : { lookup: pick(obj(hero.lookup, `${id}.lookup`), HERO_LOOKUP_FIELDS) }),
    }));
  }
  // Chiều ngược của selfTacticId, cùng quy tắc trang Tra cứu: bản ghi chiến pháp tự có thường không ghi tướng nguồn.
  const innateHolders: Map<string, string[]> = innateHolderIndex(input.heroes, input.tactics);
  for (const tactic of input.tactics) {
    const id = text(tactic.id) ?? fail("tactic record has no id");
    const innateHeroIds = innateHolders.get(id);
    output.push(entity("tactic", id, text(tactic.viet) ?? fail(`tactic ${id} has no name`), text(tactic.chinese), text(tactic.hanViet), strings(tactic.aliases), {
      ...pick(tactic, TACTIC_FIELDS),
      ...(innateHeroIds === undefined ? {} : { innateHeroIds }),
      ...(tactic.lookup === undefined ? {} : { lookup: pick(obj(tactic.lookup, `${id}.lookup`), TACTIC_LOOKUP_FIELDS) }),
    }));
  }
  const specialsByEquipment = new Map<string, string[]>();
  for (const special of list(input.catalog.specials, "catalog.specials").map((row, i) => obj(row, `catalog.specials[${i}]`))) {
    const owner = text(special.equipmentId);
    if (owner !== null) specialsByEquipment.set(owner, [...(specialsByEquipment.get(owner) ?? []), String(special.id)]);
  }
  const catalogRows = (key: keyof typeof CATALOG_FIELDS, kind: CatalogKind, extra?: (row: Json) => Json) => {
    for (const row of list(input.catalog[key], `catalog.${key}`).map((item, i) => obj(item, `catalog.${key}[${i}]`))) {
      const id = text(row.id) ?? fail(`catalog.${key} record has no id`);
      output.push(entity(kind, id, text(row.nameVi) ?? fail(`${id} has no name`), null, null, [...strings(row.aliasesVi), ...strings(row.aliasesZh)], {
        ...pick(row, CATALOG_FIELDS[key]),
        ...(extra?.(row) ?? {}),
      }));
    }
  };
  catalogRows("equipment", "equipment", (row) => ({ specialIds: (specialsByEquipment.get(String(row.id)) ?? []).sort() }));
  catalogRows("specials", "equipment-special");
  catalogRows("advisors", "advisor");
  catalogRows("troopMods", "troop-mod");
  catalogRows("buildings", "building");
  for (const book of input.books) {
    const id = bookLookupId(book);
    if (id === null) continue;
    output.push(entity("book", id, text(book.viet) ?? text(book.hanViet) ?? fail("book has no name"), text(book.chinese), text(book.hanViet), [...strings(book.sourceNames), ...strings(book.aliases)], pick(book, BOOK_FIELDS)));
  }
  const seen = new Set<string>();
  for (const record of output) {
    const id = record.id as string;
    if (seen.has(id)) fail(`duplicate catalog entity: ${id}`);
    seen.add(id);
    if (lookupProfilePath(id) === null) fail(`catalog entity id is not routable: ${id}`);
  }
  return output.sort(
    (left, right) => entityShardOrder(left) - entityShardOrder(right) || (left.id as string).localeCompare(right.id as string, "en"),
  );
}

// ---------------------------------------------------------------------------------------------
// Team projection
// ---------------------------------------------------------------------------------------------

const EMPTY_SLOT = new Set(["", "—", "-"]);
const rawKey = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/gu, "") : "");
const viKey = (value: unknown) => (typeof value === "string" ? value.normalize("NFC").trim().toLocaleLowerCase("vi") : "");

function heroIndexes(heroes: readonly ArtifactRecord[]): HeroResolver {
  const byRaw = new Map<string, string>();
  const byVi = new Map<string, string>();
  for (const hero of heroes) {
    const id = String(hero.id);
    for (const name of [hero.chinese, ...strings(hero.aliases)]) {
      const key = rawKey(name);
      if (key && !byRaw.has(key)) byRaw.set(key, id);
    }
    for (const name of [hero.viet, hero.hanViet]) {
      const key = viKey(name);
      if (key && !byVi.has(key)) byVi.set(key, id);
    }
  }
  return (raw: unknown, vi: unknown) => byRaw.get(rawKey(raw)) ?? byVi.get(viKey(vi)) ?? null;
}

interface Resolver {
  tactic(raw: unknown, vi: unknown): string | null;
  book(raw: unknown, vi: unknown): string | null;
}
type HeroResolver = (raw: unknown, vi: unknown) => string | null;

function slotRefs(raws: unknown, vis: unknown, kinds: unknown, resolve: (raw: string | null, vi: string | null) => string | null) {
  const rawList = Array.isArray(raws) ? raws : [];
  const viList = Array.isArray(vis) ? vis : [];
  const kindList = Array.isArray(kinds) ? kinds : [];
  const length = Math.max(rawList.length, viList.length);
  const output: Array<{ slot: number; raw: string | null; vi: string | null; tacticId: string | null }> = [];
  for (let slot = 0; slot < length; slot += 1) {
    const raw = text(rawList[slot]);
    const vi = text(viList[slot]);
    if ((raw === null || EMPTY_SLOT.has(raw.trim())) && (vi === null || EMPTY_SLOT.has(vi.trim()))) continue;
    const kind = kindList[slot];
    output.push({ slot, raw, vi, tacticId: kind === undefined || kind === "tactic" ? resolve(raw, vi) : null });
  }
  return output;
}

interface TeamBuild {
  summary: ArtifactRecord;
  detail: ArtifactRecord;
  route: { id: string; vi: string };
}

function recommendedTeam(
  position: number,
  index: Json,
  detail: Json,
  segment: string,
  heroOf: HeroResolver,
  resolver: Resolver,
): TeamBuild {
  const id = String(index.sourceConfigId);
  const ref = `recommended:${id}`;
  for (const key of Object.keys(detail)) {
    if (stableStringify(detail[key]) !== stableStringify(index[key])) fail(`Recommended index and detail disagree: ${id}.${key}`);
  }
  const record: Json = {
    ...detail,
    sourceSeasonId: index.sourceSeasonId,
    sourceCategoryId: index.sourceCategoryId,
    sourceSeasonLabel: index.sourceSeasonLabel,
    subcategoryRaw: index.subcategoryRaw,
    tierOrder: index.tierOrder,
  };
  const heroes = list(record.heroes, `${id}.heroes`).map((value, holder) => {
    const hero = obj(value, `${id}.heroes[${holder}]`);
    return {
      holder,
      heroId: heroOf(hero.nameRaw, hero.displayNameVi),
      nameVi: text(hero.displayNameVi) ?? text(hero.nameRaw) ?? "",
      nameRaw: text(hero.nameRaw),
      role: text(hero.roleRaw),
      tactics: slotRefs(hero.tacticSlotsRaw, hero.tacticSlotsVi, hero.tacticSlotKinds, (raw, vi) => resolver.tactic(raw, vi)),
      books: slotRefs(hero.bookSlotsRaw, hero.bookSlotsVi, undefined, (raw, vi) => resolver.book(raw, vi)).map(({ tacticId, ...rest }) => ({ ...rest, bookId: tacticId })),
    };
  });
  const value = typeof record.value === "number" && Number.isFinite(record.value) ? record.value : null;
  return {
    summary: {
      ref,
      collection: "recommended",
      id,
      nameVi: text(record.displayNameVi) ?? text(record.nameZh) ?? id,
      nameZh: text(record.nameZh),
      nickname: null,
      sourceSeasonId: text(record.sourceSeasonId),
      sourceSeasonCode: text(record.sourceSeasonCode),
      sourceCategoryId: text(record.sourceCategoryId),
      tierRaw: text(record.tierRaw),
      tierOrder: typeof record.tierOrder === "number" ? record.tierOrder : null,
      score: value,
      factionRaw: text(record.factionRaw),
      unitTypes: strings(record.unitTypesRaw),
      translationStatus: text(record.sourceSeasonTranslationStatus),
      indexPosition: position,
      heroes: heroes.map(({ books: _books, ...hero }) => hero),
    },
    detail: {
      ref,
      collection: "recommended",
      id,
      record,
      resolved: { heroes: heroes.map(({ holder, heroId, tactics, books }) => ({ holder, heroId, tactics, books })) },
    },
    route: { id: ref, vi: recommendedRoutePath(segment) },
  };
}

/** Legacy team content (admitted variants): hero alternatives, slot alternatives, tactic refs. */
function resolveLegacyContent(content: Json, heroOf: HeroResolver, resolver: Resolver) {
  return list(content.heroes, "legacyContent.heroes").map((value, holder) => {
    const hero = obj(value, `legacyContent.heroes[${holder}]`);
    const named = (items: unknown, kind: "tactic" | "book") =>
      (Array.isArray(items) ? items : []).map((item, slot) => {
        const row = obj(item, `legacyContent.heroes[${holder}].${kind}s[${slot}]`);
        const resolve = (vi: string | null) => (kind === "tactic" ? resolver.tactic(null, vi) : resolver.book(null, vi));
        return {
          slot,
          vi: text(row.name),
          [`${kind}Id`]: resolve(text(row.name)),
          alternatives: strings(row.alternatives).map((vi) => ({ vi, [`${kind}Id`]: resolve(vi) })),
        };
      });
    return {
      holder,
      heroId: heroOf(null, hero.name),
      alternatives: strings(hero.alternatives).map((vi) => ({ vi, heroId: heroOf(null, vi) })),
      tactics: named(hero.tactics, "tactic"),
      books: named(hero.books, "book"),
    };
  });
}

function otherTeams(
  rows: Json[],
  visibleLegacy: Set<string>,
  ledger: Ledger,
  heroOf: HeroResolver,
  resolver: Resolver,
): TeamBuild[] {
  const byTeam = new Map<string, Json[]>();
  for (const row of rows) {
    const teamId = String(row.legacyTeamId);
    if (!visibleLegacy.has(teamId)) continue;
    byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), row]);
  }
  return [...byTeam].map(([teamId, variants]) => {
    const handle = ledger.legacy[teamId];
    if (!isRoutableIdentifier(handle)) return fail(`legacy team has no routable handle: ${teamId}`);
    const ref = `other:${teamId}`;
    const first = variants[0]!;
    const holders = list(first.holders, `${teamId}.holders`).map((value, holder) => {
      const item = obj(value, `${teamId}.holders[${holder}]`);
      return {
        holder,
        heroId: heroOf(null, item.displayNameVi) ?? heroOf(item.nameRaw, item.nameRaw),
        nameVi: text(item.displayNameVi) ?? text(item.nameRaw) ?? "",
        nameRaw: text(item.nameRaw),
        role: null,
        tactics: slotRefs(item.tacticSlotsRaw, item.tacticSlotsRaw, undefined, (_raw, vi) => resolver.tactic(null, vi)).map((slot) => ({ ...slot, raw: null })),
      };
    });
    return {
      summary: {
        ref,
        collection: "other",
        id: teamId,
        nameVi: text(first.name) ?? teamId,
        nameZh: null,
        nickname: text(first.nickname),
        sourceSeasonId: null,
        sourceSeasonCode: null,
        sourceCategoryId: null,
        tierRaw: text(first.historicalTier),
        tierOrder: null,
        score: null,
        factionRaw: text(first.faction),
        unitTypes: strings(first.unit),
        translationStatus: null,
        indexPosition: null,
        heroes: holders,
      },
      detail: {
        ref,
        collection: "other",
        id: teamId,
        variants: variants.map((variant) => {
          const content = obj(variant.legacyContent, `${teamId}.legacyContent`);
          return {
            variantId: String(variant.legacyVariantId),
            contentSha256: text(variant.legacyContentSha256),
            classification: text(variant.classification),
            name: text(variant.name),
            nickname: text(variant.nickname),
            faction: text(variant.faction),
            unit: strings(variant.unit),
            origin: text(variant.origin),
            source: text(variant.source),
            sourceLabel: text(variant.sourceLabel),
            sourceState: text(variant.sourceState),
            sourceSeasonIds: Array.isArray(variant.sourceSeasonIds) ? variant.sourceSeasonIds : null,
            seasonAttribution: variant.seasonAttribution ?? [],
            historicalTier: text(variant.historicalTier),
            historicalRankings: (Array.isArray(variant.historicalRankings) ? variant.historicalRankings : []).map(allowTierRanking),
            holders: (Array.isArray(variant.holders) ? variant.holders : []).map(allowOtherHolder),
            content,
            resolved: { heroes: resolveLegacyContent(content, heroOf, resolver) },
          };
        }),
      },
      route: { id: ref, vi: legacyRoutePath(handle) },
    };
  });
}

function khaiHoangTeams(
  document: Json,
  ledger: Ledger,
  seasonId: string | null,
  heroOf: HeroResolver,
  resolver: Resolver,
): TeamBuild[] {
  return list(document.teams, "khaihoang.teams").map((value, index) => {
    const team = obj(value, `khaihoang.teams[${index}]`);
    const id = text(team.id) ?? fail("Khai hoang team has no id");
    const handle = ledger.khaiHoang[id];
    if (!isRoutableIdentifier(handle)) return fail(`Khai hoang team has no routable handle: ${id}`);
    const ref = `khaihoang:${id}`;
    const heroes = list(team.heroes, `${id}.heroes`).map((heroValue, holder) => {
      const hero = obj(heroValue, `${id}.heroes[${holder}]`);
      const after = strings(hero.tacticsAfter);
      const before = text(hero.tacticBefore);
      return {
        holder,
        heroId: heroOf(null, hero.name),
        nameVi: text(hero.name) ?? "",
        nameRaw: null,
        role: null,
        tactics: (after.length ? after : before === null ? [] : [before]).map((vi, slot) => ({ slot, raw: null, vi, tacticId: resolver.tactic(null, vi) })),
      };
    });
    return {
      summary: {
        ref,
        collection: "khaihoang",
        id,
        nameVi: text(team.title) ?? id,
        nameZh: null,
        nickname: null,
        sourceSeasonId: seasonId,
        sourceSeasonCode: null,
        sourceCategoryId: null,
        tierRaw: null,
        tierOrder: null,
        score: null,
        factionRaw: null,
        unitTypes: strings([team.unitType]),
        translationStatus: null,
        indexPosition: null,
        heroes,
      },
      detail: {
        ref,
        collection: "khaihoang",
        id,
        season: text(document.season),
        seasonNote: text(document.seasonNote),
        team: allowKhaiHoangTeam(team),
        resolved: {
          heroes: heroes.map(({ holder, heroId, tactics }) => ({ holder, heroId, tactics })),
          variants: (Array.isArray(team.variants) ? team.variants : []).map((variant, variantIndex) => {
            const row = obj(variant, `${id}.variants[${variantIndex}]`);
            return {
              id: text(row.id),
              heroes: (Array.isArray(row.heroes) ? row.heroes : []).map((heroValue, holder) => {
                const hero = obj(heroValue, `${id}.variants[${variantIndex}].heroes[${holder}]`);
                const names = strings(hero.tacticsAfter ?? hero.tactics);
                return { holder, heroId: heroOf(null, hero.name), tactics: names.map((vi, slot) => ({ slot, raw: null, vi, tacticId: resolver.tactic(null, vi) })) };
              }),
            };
          }),
        },
      },
      route: { id: ref, vi: khaiHoangRoutePath(handle) },
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Sharding and output
// ---------------------------------------------------------------------------------------------

const encodeArtifact = (records: readonly unknown[]) => encoder.encode(`${stableStringify(records)}\n`);

/** Deterministic greedy fill over already-sorted records; see the layout decision in publication-projection.ts. */
export function shardRecords<T>(records: readonly T[], family: PublicationShardFamily): T[][] {
  const shards: T[][] = [];
  let current: T[] = [];
  let size = 3;
  for (const record of records) {
    const bytes = encoder.encode(stableStringify(record)).byteLength + 1;
    if (current.length > 0 && size + bytes > SHARD_TARGET_BYTES) {
      shards.push(current);
      current = [];
      size = 3;
    }
    current.push(record);
    size += bytes;
  }
  if (current.length > 0) shards.push(current);
  if (shards.length === 0) fail(`${family} has no records`);
  if (shards.length > MAX_SHARDS_PER_FAMILY) fail(`${family} needs more than ${MAX_SHARDS_PER_FAMILY} shards`);
  return shards;
}

const UPSTREAM_FILES: Record<(typeof UPSTREAM_SOURCE_KEYS)[number], string> = {
  "books-dict": "books-dict.json",
  "heroes-dict": "heroes-dict.json",
  khaihoang: "khaihoang.json",
  "lookup-catalog": "lookup-catalog.json",
  "lookup-manifest": "lookup-manifest.json",
  tactics: "tactics.json",
  teams: "teams.json",
};

export interface PublicationBuildInput {
  /** The eleven v1/v2 artifact bytes of the same release. */
  objects: ArtifactBytes;
  sources: PublicationSources;
}

/**
 * Verify every upstream generation, refuse mixed generations, project the allowlisted public data and
 * return deterministic artifact bytes plus the manifest metadata that makes them part of the release.
 */
export async function buildPublicationArtifacts(input: PublicationBuildInput): Promise<PublicationBuild> {
  const { objects, sources } = input;
  const need = (name: ArtifactName) => objects.get(name) ?? fail(`missing legacy artifact ${name}`);
  const sidecar = (name: string) => sources.sidecars.get(name) ?? fail(`missing public source ${name}`);

  // 1. lookup generation through the website's own validator.
  await verifyLookupPayloads(sidecar("lookup-manifest.json"), {
    "heroes-dict.json": need("heroes-dict"),
    "tactics.json": need("tactics"),
    "lookup-catalog.json": sidecar("lookup-catalog.json"),
  }).catch(() => fail("lookup generation is not verified"));
  const lookupManifest = obj(parseJson(sidecar("lookup-manifest.json"), "lookup-manifest.json"), "lookup-manifest.json");

  // 2. Recommended generation, exact inventory.
  const recommended = await verifyRecommended(sources.recommended);

  // 3. website display: pin + every source hash, before any translation layer is applied.
  const display = obj(parseJson(sources.websiteDisplay, "website-display.json"), "website-display.json");
  const displayHash = await sha256Hex(sources.websiteDisplay);
  const dataFiles = new Map<string, Uint8Array>();
  for (const file of Object.values(UPSTREAM_FILES)) {
    dataFiles.set(`data/${file}`, objects.get(file.slice(0, -5) as ArtifactName) ?? sources.sidecars.get(file) ?? new Uint8Array());
  }
  for (const name of ["coexist", "season-content-links"] as const) dataFiles.set(`data/${name}.json`, need(name));
  let publication;
  try {
    publication = await loadWebsiteDisplay(
      { generationId: String(display.generationId), sha256: displayHash },
      async (path: string) => {
        if (path === "website-display.json") return sources.websiteDisplay;
        const bytes = dataFiles.get(path);
        if (bytes === undefined || bytes.byteLength === 0) throw new Error("source is not pinned");
        return bytes;
      },
      recommended.pin,
    );
  } catch {
    return fail("website display publication does not match the pinned sources or Recommended generation");
  }

  // 4. route ledger.
  const ledger = parseLedger(sources.routeLedger);
  const legacyTeamsSha = await sha(need("teams"));
  const khaiBytes = sidecar("khaihoang.json");
  const khaiSha = await sha(khaiBytes);
  if (ledger.generationId !== recommended.pin.generationId) fail("route ledger generation differs from Recommended generation");
  if (ledger.legacyTeamsSha256 !== legacyTeamsSha || recommended.manifest.legacyTeamsHash !== legacyTeamsSha) {
    fail("legacy teams bytes differ from the ledger or the Recommended generation");
  }
  if (ledger.khaihoangSha256 !== khaiSha) fail("Khai hoang bytes differ from the route ledger pin");

  // 5. parsed corpora.
  const heroes = list(parseJson(need("heroes-dict"), "heroes-dict"), "heroes-dict").map((row, i) => obj(row, `heroes-dict[${i}]`));
  const tactics = list(parseJson(need("tactics"), "tactics"), "tactics").map((row, i) => obj(row, `tactics[${i}]`));
  const books = list(parseJson(need("books-dict"), "books-dict"), "books-dict").map((row, i) => obj(row, `books-dict[${i}]`));
  const catalog = obj(parseJson(sidecar("lookup-catalog.json"), "lookup-catalog.json"), "lookup-catalog.json");
  const legacyTeams = list(parseJson(need("teams"), "teams"), "teams").map((row, i) => obj(row, `teams[${i}]`));
  const khaiDocument = obj(
    localizeData(publication, "data/khaihoang.json", parseJson(khaiBytes, "khaihoang.json"), "vi"),
    "khaihoang.json",
  );

  // 6. ledger exact key sets.
  exactKeySet(ledger.recommended, new Set(recommended.index.map((row) => String(row.sourceConfigId))), "Recommended");
  exactKeySet(ledger.legacy, new Set(legacyTeams.map((team) => String(team.id))), "legacy");
  exactKeySet(ledger.khaiHoang, new Set(list(khaiDocument.teams, "khaihoang.teams").map((team) => String(obj(team, "team").id))), "Khai hoang");

  // 7. projection.
  const entities = projectCatalogEntities({ heroes, tactics, books, catalog });
  const resolver = createLookupIdResolver({ tactics, books } as never);
  const heroOf = heroIndexes(heroes);
  const scopeKeys = new Set(recommended.detailsByScope.keys());
  const detailBySourceId = new Map<string, Json>();
  for (const [scope, rows] of recommended.detailsByScope) {
    for (const row of rows) {
      const id = String(row.sourceConfigId);
      if (detailBySourceId.has(id)) fail(`duplicate Recommended detail: ${id}`);
      detailBySourceId.set(id, { ...row, __scope: scope });
    }
  }
  const teams: TeamBuild[] = [];
  for (const [position, row] of recommended.index.entries()) {
    const id = String(row.sourceConfigId);
    if (!isRoutableIdentifier(id)) fail(`unroutable Recommended identifier: ${id}`);
    const scoped = detailBySourceId.get(id) ?? fail(`Recommended row has no detail: ${id}`);
    const { __scope, ...detail } = scoped;
    if (__scope !== row.safeScopeKey || !scopeKeys.has(String(row.safeScopeKey))) fail(`Recommended row points at the wrong detail scope: ${id}`);
    const handle = ledger.recommended[id];
    const segment = isRoutableIdentifier(handle) ? recommendedRouteSegment(row.sourceSeasonCode, handle) : null;
    if (segment === null) fail(`Recommended row has no routable segment: ${id}`);
    teams.push(recommendedTeam(position, row, detail, segment as string, heroOf, resolver));
  }
  if (detailBySourceId.size !== recommended.index.length) fail("Recommended details and index disagree");
  const visibleLegacy = new Set(legacyTeams.filter((team) => team.source !== "do-uy").map((team) => String(team.id)));
  teams.push(...otherTeams(recommended.other, visibleLegacy, ledger, heroOf, resolver));
  const seasons = list(recommended.seasons.seasonOptions, "seasons.seasonOptions").map((row, i) => obj(row, `seasonOptions[${i}]`));
  const khaiSeason = text(khaiDocument.season);
  const khaiSeasonId = khaiSeason === null ? null : (seasons.find((option) => option.displayNameVi === khaiSeason)?.sourceSeasonId as string | undefined) ?? null;
  teams.push(...khaiHoangTeams(khaiDocument, ledger, khaiSeasonId, heroOf, resolver));

  const upstream: PublicationUpstream = {
    recommended: recommended.pin,
    lookup: { generationId: String(lookupManifest.generationId) },
    websiteDisplay: { generationId: String(display.generationId), sha256: `sha256:${displayHash}`, recommendedPin: recommended.pin },
    routeLedger: { generationId: ledger.generationId, sha256: await sha(sources.routeLedger) },
    sources: Object.fromEntries(
      await Promise.all(UPSTREAM_SOURCE_KEYS.map(async (key) => {
        const file = UPSTREAM_FILES[key];
        const bytes = objects.get(file.slice(0, -5) as ArtifactName) ?? sources.sidecars.get(file) ?? fail(`missing ${file}`);
        return [key, await sha(bytes)] as const;
      })),
    ) as PublicationUpstream["sources"],
  };

  // 8. registry.
  const labels = (obj(recommended.seasons.displayLabels ?? {}, "seasons.displayLabels") as Record<string, Record<string, string>>);
  const scopes = list(recommended.seasons.scopes, "seasons.scopes").map((row, i) => obj(row, `scopes[${i}]`));
  const categoryIds = [...new Set(scopes.map((scope) => String(scope.sourceCategoryId)))].sort();
  const visibleEngine = legacyTeams.length - legacyTeams.filter((team) => team.source === "do-uy").length;
  const count = (collection: string) => teams.filter((team) => team.summary.collection === collection).length;
  const registry = {
    schemaVersion: 1,
    upstream,
    defaultSourceSeasonId: recommended.seasons.defaultSourceSeasonId,
    seasonOptions: seasons.map((option) => ({
      ...pick(option, ["sourceSeasonId", "label", "nameRaw", "displayNameVi", "displayCode", "sourceOrder", "status", "translationStatus"]),
      advertisedCountRaw: typeof option.advertisedCountRaw === "number" ? option.advertisedCountRaw : null,
    })),
    categories: categoryIds.map((sourceCategoryId) => ({ sourceCategoryId, nameVi: text(labels.category?.[sourceCategoryId]) })),
    scopes: scopes.map((scope) => ({
      ...pick(scope, ["sourceSeasonId", "sourceCategoryId", "state"]),
      advertisedCountRaw: typeof scope.advertisedCountRaw === "number" ? scope.advertisedCountRaw : null,
      observedCardCount: typeof scope.observedCardCount === "number" ? scope.observedCardCount : null,
    })),
    displayLabels: labels,
    collections: [
      { id: "recommended", count: count("recommended"), descriptionVi: "Đội chuẩn theo mùa nguồn (source-reference), có điểm/bậc gốc." },
      { id: "other", count: count("other"), descriptionVi: "Biến thể đội cũ đã được nhận (admitted), không phải kho cũ thô." },
      { id: "khaihoang", count: count("khaihoang"), descriptionVi: "Đội Khai hoang công khai." },
      { id: "engine", count: visibleEngine, descriptionVi: "Kho đội cũ của engine (đọc từ artifact v1/v2)." },
    ],
  };

  // 9. routes.
  const routes = [
    ...entities.map((record) => {
      const vi = lookupProfilePath(record.id as string) as string;
      return { id: record.id, kind: "entity", vi, zh: localePath(vi, "zh") };
    }),
    ...teams.map((team) => ({ id: team.route.id, kind: "team", vi: team.route.vi, zh: localePath(team.route.vi, "zh") })),
  ];
  const routePaths = new Set<string>();
  for (const route of routes) {
    if (route.kind === "team" && routePaths.has(route.vi)) fail(`duplicate team route path: ${route.vi}`);
    routePaths.add(route.vi);
  }
  routes.sort((left, right) => String(left.id).localeCompare(String(right.id), "en"));

  // 10. shard + encode.
  const sortedTeams = [...teams].sort(
    (left, right) =>
      detailShardOrder(left.detail) - detailShardOrder(right.detail)
      || String(left.detail.ref).localeCompare(String(right.detail.ref), "en"),
  );
  const entityShards = shardRecords(entities, "catalog-entities");
  const detailShards = shardRecords(sortedTeams.map((team) => team.detail), "reference-team-details");
  const index = [...teams.map((team) => team.summary)].sort(
    (left, right) =>
      detailShardOrder(left) - detailShardOrder(right) || String(left.ref).localeCompare(String(right.ref), "en"),
  );
  const meta = validatePublicationMeta({
    schemaVersion: 1,
    upstream,
    shards: { "catalog-entities": entityShards.length, "reference-team-details": detailShards.length },
  });
  const artifacts = new Map<string, Uint8Array>();
  entityShards.forEach((shard, i) => artifacts.set(shardName("catalog-entities", i), encodeArtifact(shard)));
  detailShards.forEach((shard, i) => artifacts.set(shardName("reference-team-details", i), encodeArtifact(shard)));
  artifacts.set("reference-registry", encodeArtifact([registry]));
  artifacts.set("reference-team-index", encodeArtifact(index));
  artifacts.set("public-routes", encodeArtifact(routes));
  for (const [name, bytes] of artifacts) {
    if (bytes.byteLength > MAX_ARTIFACT_BYTES) fail(`publication artifact ${name} exceeds the artifact limit`);
  }
  // Fixed manifest order.
  const ordered = new Map<string, Uint8Array>();
  for (const name of publicationArtifactNames(meta.shards)) ordered.set(name, artifacts.get(name)!);
  return { artifacts: ordered, meta };
}

export type { CatalogGroup };
