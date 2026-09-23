import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_RECOMMENDED_ROOT, recommendedPublicationSnapshot, type RecommendedPublicationSnapshot } from './recommended-reference-artifacts.ts';
import { websiteDisplayPublicationSnapshot } from './root-static-artifacts.ts';

export const DEFAULT_TEAMS_PATH = join(process.cwd(), 'data/teams.json');
export const DEFAULT_HANDLES_PATH = join(process.cwd(), 'pipeline/team-route-handles.json');

/** Identifiers become filesystem paths and URL segments, so only opaque single segments are routable. */
const UNSAFE_IDENTIFIER = /[\u0000-\u001f\u007f/\\?#%:*"<>|\s]/;
export function isRoutableIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && Buffer.byteLength(value) <= 128
    && !UNSAFE_IDENTIFIER.test(value)
    && !value.startsWith('.')
    && !value.endsWith('.');
}

/** A season code only contributes a path segment when it is dash-separated alphanumerics. */
const SEASON_CODE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
function routeSeasonSegment(sourceSeasonCode: unknown) {
  return typeof sourceSeasonCode === 'string' && SEASON_CODE.test(sourceSeasonCode)
    ? sourceSeasonCode.toLowerCase()
    : null;
}

export interface RecommendedRouteEntry {
  sourceConfigId: string;
  routeSegment: string;
  routePath: string;
  htmlPath: string;
  safeScopeKey: string;
  displayNameVi: string | null;
  nameZh: string | null;
  value: number | null;
  tierRaw: string | null;
  sourceSeasonId: string | null;
  sourceSeasonCode: string | null;
  sourceSeasonNameVi: string | null;
  sourceSeasonTranslationStatus: string | null;
  sourceCategoryId: string | null;
  sourceCategoryNameVi: string | null;
  sourceUrl: string | null;
}

export interface LegacyRouteEntry {
  legacyTeamId: string;
  routeSegment: string;
  routePath: string;
  htmlPath: string;
  name: string | null;
  nickname: string | null;
  source: string | null;
  variantIds: string[];
}

export interface AdmittedVariantEntry {
  legacyTeamId: string;
  legacyVariantId: string;
  legacyContentSha256: string | null;
}

export interface KhaiHoangRouteEntry {
  khaiHoangTeamId: string;
  handle: string;
  title: string;
  routeSegment: string;
  routePath: string;
  htmlPath: string;
  sourceSha256: string;
}

export interface TeamDetailRouteCatalog {
  generationId: string;
  manifestSha256: string;
  legacyTeamsSha256: string;
  khaiHoangSha256: string;
  recommended: RecommendedRouteEntry[];
  legacy: LegacyRouteEntry[];
  /** Frozen Khai hoang routes emitted with Recommended and legacy detail pages. */
  khaiHoang: KhaiHoangRouteEntry[];
  variants: AdmittedVariantEntry[];
  htmlPaths: string[];
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);

export const recommendedRoutePath = (routeSegment: string) => `/doi-chuan/${encodeURIComponent(routeSegment)}/`;
export const legacyRoutePath = (routeSegment: string) => `/doi-khac/${encodeURIComponent(routeSegment)}/`;
export const khaiHoangRoutePath = (routeSegment: string) => `/khai-hoang/${encodeURIComponent(routeSegment)}/`;

async function readRegularFile(path: string) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Raw artifact is not a regular file: ${path}`);
  return readFile(await realpath(path));
}

/** Frozen handle inventory: bare handles per family, reviewed once and never derived from names again. */
interface TeamRouteHandleLedger {
  generationId: string;
  legacyTeamsSha256: string;
  khaiHoangSha256: string;
  recommended: Record<string, string>;
  legacy: Record<string, string>;
  khaiHoang: Record<string, string>;
}

const LEDGER_SCHEMA_VERSION = 2;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

const plainObject = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

function parseHandleLedger(raw: unknown, path: string): TeamRouteHandleLedger {
  if (!plainObject(raw)) throw new Error(`Team route handle ledger must be an object: ${path}`);
  if (raw.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    throw new Error(`Team route handle ledger schemaVersion must be ${LEDGER_SCHEMA_VERSION}: ${path}`);
  }
  const generationId = raw.generationId;
  if (typeof generationId !== 'string' || !generationId) {
    throw new Error(`Team route handle ledger needs a generationId: ${path}`);
  }
  const legacyTeamsSha256 = raw.legacyTeamsSha256;
  if (typeof legacyTeamsSha256 !== 'string' || !SHA256_DIGEST.test(legacyTeamsSha256)) {
    throw new Error(`Team route handle ledger needs a sha256 legacyTeamsSha256: ${path}`);
  }
  const khaiHoangSha256 = raw.khaihoangSha256;
  if (typeof khaiHoangSha256 !== 'string' || !SHA256_DIGEST.test(khaiHoangSha256)) {
    throw new Error(`Team route handle ledger needs a sha256 khaihoangSha256: ${path}`);
  }
  const handles = raw.handles;
  if (!plainObject(handles)) throw new Error(`Team route handle ledger needs a handles object: ${path}`);
  const families: Record<'recommended' | 'legacy' | 'khaiHoang', Record<string, string>> = {
    recommended: {},
    legacy: {},
    khaiHoang: {},
  };
  const familyKeys = [['recommended', 'recommended'], ['legacy', 'legacy'], ['khaiHoang', 'khaihoang']] as const;
  const missingFamilies = familyKeys.filter(([, key]) => !Object.hasOwn(handles, key)).map(([family]) => family);
  const unknownFamilies = Object.keys(handles).filter((key) => !familyKeys.some(([, known]) => known === key));
  if (missingFamilies.length || unknownFamilies.length) {
    throw new Error(
      `Team route handle ledger handle families must be exactly ${familyKeys.map(([, key]) => key).join(', ')}: `
      + `${path} (missing ${missingFamilies.join(', ') || 'none'}; unknown ${unknownFamilies.join(', ') || 'none'})`,
    );
  }
  for (const [family, key] of familyKeys) {
    const value = handles[key];
    if (!plainObject(value)) {
      throw new Error(`Team route handle ledger handle family must be an object: ${path} (${key})`);
    }
    for (const [id, handle] of Object.entries(value)) {
      if (typeof handle !== 'string') {
        throw new Error(`Team route handle ledger handle must be a string: ${path} (${key} ${id})`);
      }
      families[family][id] = handle;
    }
  }
  return { generationId, legacyTeamsSha256, khaiHoangSha256, ...families };
}

/** Exact key-set comparison that names the keys which are missing or no longer selected. */
function exactKeySet(actual: Record<string, string>, expected: Set<string>, label: string) {
  const missing = [...expected].filter((key) => !Object.hasOwn(actual, key)).sort();
  if (missing.length) {
    throw new Error(`Team route handle ledger is missing handles for ${missing.length} ${label}: ${missing.join(', ')}`);
  }
  const unknown = Object.keys(actual).filter((key) => !expected.has(key)).sort();
  if (unknown.length) {
    throw new Error(`Team route handle ledger has ${unknown.length} unknown ${label} handle key(s): ${unknown.join(', ')}`);
  }
}

/** Emitted paths are the route identity, so a repeat is a build failure rather than a silent overwrite. */
function distinctRoutePaths(entries: Array<{ routePath: string; key: string }>, label: string) {
  const byPath = new Map<string, string[]>();
  for (const { routePath, key } of entries) {
    byPath.set(routePath, [...(byPath.get(routePath) ?? []), key]);
  }
  for (const [routePath, keys] of byPath) {
    if (keys.length > 1) {
      throw new Error(`Team route handle ledger has duplicate ${label} route paths: ${routePath} (${keys.join(', ')})`);
    }
  }
}

async function buildCatalogFromSnapshot(
  snapshot: RecommendedPublicationSnapshot,
  teamsBytes: Uint8Array,
  ledgerBytes: Uint8Array,
  handlesPath: string,
  khaiHoangBytes: Uint8Array,
  khaiHoangOrigin: string,
): Promise<TeamDetailRouteCatalog> {
  const legacyTeamsSha256 = `sha256:${createHash('sha256').update(teamsBytes).digest('hex')}`;
  const declaredLegacyHash = snapshot.manifest.legacyTeamsHash;
  if (typeof declaredLegacyHash !== 'string' || declaredLegacyHash !== legacyTeamsSha256) {
    throw new Error(
      `Selected Recommended generation legacy teams hash does not match the raw originals: declared ${String(declaredLegacyHash)}, actual ${legacyTeamsSha256}`,
    );
  }

  const ledger = parseHandleLedger(JSON.parse(ledgerBytes.toString()), handlesPath);
  if (ledger.generationId !== snapshot.pin.generationId) {
    throw new Error(
      `Team route handle ledger generationId differs from the selected Recommended generation: ${ledger.generationId} != ${snapshot.pin.generationId}`,
    );
  }
  if (ledger.legacyTeamsSha256 !== legacyTeamsSha256) {
    throw new Error(
      `Team route handle ledger legacyTeamsSha256 differs from the raw originals: ${ledger.legacyTeamsSha256} != ${legacyTeamsSha256}`,
    );
  }

  const khaiHoangSha256 = `sha256:${createHash('sha256').update(khaiHoangBytes).digest('hex')}`;
  if (ledger.khaiHoangSha256 !== khaiHoangSha256) {
    throw new Error(
      `Team route handle ledger khaihoangSha256 differs from the pinned Khai hoang source: ${ledger.khaiHoangSha256} != ${khaiHoangSha256} (${khaiHoangOrigin})`,
    );
  }
  const khaiHoangDocument = JSON.parse(Buffer.from(khaiHoangBytes).toString());
  const khaiHoangTeams = khaiHoangDocument?.teams;
  if (!Array.isArray(khaiHoangTeams) || !khaiHoangTeams.length) {
    throw new Error(`Raw Khai hoang artifact must contain teams: ${khaiHoangOrigin}`);
  }
  const khaiHoangIds: string[] = [];
  const seenKhaiHoangIds = new Set<string>();
  for (const team of khaiHoangTeams as Array<Record<string, unknown>>) {
    const id = team?.id;
    if (typeof id !== 'string' || !id) throw new Error(`Khai hoang team has no id: ${khaiHoangOrigin}`);
    if (seenKhaiHoangIds.has(id)) throw new Error(`Duplicate Khai hoang identifier: ${id}`);
    seenKhaiHoangIds.add(id);
    khaiHoangIds.push(id);
  }
  exactKeySet(ledger.khaiHoang, new Set(khaiHoangIds), 'Khai hoang team');
  const khaiHoang: KhaiHoangRouteEntry[] = khaiHoangTeams.map((team: Record<string, unknown>, index: number) => {
    const khaiHoangTeamId = khaiHoangIds[index];
    const handle = ledger.khaiHoang[khaiHoangTeamId];
    if (!isRoutableIdentifier(handle)) {
      throw new Error(
        `Team route handle ledger handle is not routable: Khai hoang ${khaiHoangTeamId} -> ${JSON.stringify(handle)}`,
      );
    }
    const title = text(team.title);
    if (!title) throw new Error(`Khai hoang team ${khaiHoangTeamId} has no title`);
    return {
      khaiHoangTeamId,
      handle,
      title,
      routeSegment: handle,
      routePath: khaiHoangRoutePath(handle),
      htmlPath: `khai-hoang/${handle}/index.html`,
      sourceSha256: khaiHoangSha256,
    };
  });
  distinctRoutePaths(
    khaiHoang.map((entry) => ({ routePath: entry.routePath, key: entry.khaiHoangTeamId })),
    'Khai hoang',
  );

  const teams = JSON.parse(teamsBytes.toString());
  if (!Array.isArray(teams) || !teams.length) throw new Error('Raw legacy teams artifact must contain teams');
  const index = JSON.parse(Buffer.from(snapshot.files['index.json']).toString());
  const other = JSON.parse(Buffer.from(snapshot.files['other-teams.json']).toString());
  if (!Array.isArray(index?.records) || !Array.isArray(other?.records)) throw new Error('Selected Recommended publication is missing route records');

  exactKeySet(
    ledger.recommended,
    new Set(index.records.map((row: Record<string, unknown>) => String(row.sourceConfigId))),
    'Recommended',
  );
  exactKeySet(
    ledger.legacy,
    new Set(teams.map((team: Record<string, unknown>) => String(team.id))),
    'legacy team',
  );

  const scopeKeys = new Set<string>(Array.isArray(snapshot.manifest.allowedScopeKeys) ? snapshot.manifest.allowedScopeKeys as string[] : []);
  const seenRecommended = new Set<string>();
  const recommended: RecommendedRouteEntry[] = index.records.map((row: Record<string, unknown>) => {
    const sourceConfigId = row.sourceConfigId;
    if (!isRoutableIdentifier(sourceConfigId)) throw new Error(`Unroutable Recommended identifier: ${String(sourceConfigId)}`);
    if (seenRecommended.has(sourceConfigId)) throw new Error(`Duplicate Recommended identifier: ${sourceConfigId}`);
    seenRecommended.add(sourceConfigId);
    const safeScopeKey = row.safeScopeKey;
    if (typeof safeScopeKey !== 'string' || !scopeKeys.has(safeScopeKey)) {
      throw new Error(`Recommended row ${sourceConfigId} points at an undeclared detail scope`);
    }
    const seasonSegment = routeSeasonSegment(row.sourceSeasonCode);
    if (!seasonSegment) {
      throw new Error(`Recommended row ${sourceConfigId} has no usable season code for its route segment`);
    }
    const handle = ledger.recommended[sourceConfigId];
    if (!isRoutableIdentifier(handle)) {
      throw new Error(`Team route handle ledger handle is not routable: Recommended ${sourceConfigId} -> ${JSON.stringify(handle)}`);
    }
    const routeSegment = `${seasonSegment}-${handle}`;
    return {
      sourceConfigId,
      routeSegment,
      routePath: recommendedRoutePath(routeSegment),
      htmlPath: `doi-chuan/${routeSegment}/index.html`,
      safeScopeKey,
      displayNameVi: text(row.displayNameVi),
      nameZh: text(row.nameZh),
      value: typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null,
      tierRaw: text(row.tierRaw),
      sourceSeasonId: text(row.sourceSeasonId),
      sourceSeasonCode: text(row.sourceSeasonCode),
      sourceSeasonNameVi: text(row.sourceSeasonNameVi),
      sourceSeasonTranslationStatus: text(row.sourceSeasonTranslationStatus),
      sourceCategoryId: text(row.sourceCategoryId),
      sourceCategoryNameVi: text(row.sourceCategoryNameVi),
      sourceUrl: text(row.sourceUrl),
    };
  });

  const variantsByTeam = new Map<string, string[]>();
  const seenPairs = new Set<string>();
  const variants: AdmittedVariantEntry[] = other.records.map((row: Record<string, unknown>) => {
    const legacyTeamId = row.legacyTeamId;
    const legacyVariantId = row.legacyVariantId;
    if (!isRoutableIdentifier(legacyTeamId) || !isRoutableIdentifier(legacyVariantId)) {
      throw new Error(`Unroutable admitted variant identifier: ${String(legacyTeamId)}/${String(legacyVariantId)}`);
    }
    const pair = `${legacyTeamId}|${legacyVariantId}`;
    if (seenPairs.has(pair)) throw new Error(`Duplicate admitted variant pair: ${pair}`);
    seenPairs.add(pair);
    return { legacyTeamId, legacyVariantId, legacyContentSha256: text(row.legacyContentSha256) };
  });

  const seenLegacy = new Set<string>();
  const legacy: LegacyRouteEntry[] = teams.map((team: Record<string, unknown>) => {
    const legacyTeamId = team.id;
    if (!isRoutableIdentifier(legacyTeamId)) throw new Error(`Unroutable legacy identifier: ${String(legacyTeamId)}`);
    if (seenLegacy.has(legacyTeamId)) throw new Error(`Duplicate legacy identifier: ${legacyTeamId}`);
    seenLegacy.add(legacyTeamId);
    const routeSegment = ledger.legacy[legacyTeamId];
    if (!isRoutableIdentifier(routeSegment)) {
      throw new Error(`Team route handle ledger handle is not routable: legacy ${legacyTeamId} -> ${JSON.stringify(routeSegment)}`);
    }
    return {
      legacyTeamId,
      routeSegment,
      routePath: legacyRoutePath(routeSegment),
      htmlPath: `doi-khac/${routeSegment}/index.html`,
      name: text(team.name),
      nickname: text(team.nickname),
      source: text(team.source),
      variantIds: [],
    };
  });

  distinctRoutePaths(recommended.map((entry) => ({ routePath: entry.routePath, key: entry.sourceConfigId })), 'Recommended');
  distinctRoutePaths(legacy.map((entry) => ({ routePath: entry.routePath, key: entry.legacyTeamId })), 'legacy');

  for (const variant of variants) {
    if (!seenLegacy.has(variant.legacyTeamId)) {
      throw new Error(`Admitted variant references an unknown legacy team: ${variant.legacyTeamId}`);
    }
    const bucket = variantsByTeam.get(variant.legacyTeamId) ?? [];
    bucket.push(variant.legacyVariantId);
    variantsByTeam.set(variant.legacyTeamId, bucket);
  }
  for (const entry of legacy) entry.variantIds = variantsByTeam.get(entry.legacyTeamId) ?? [];

  // All three families are emitted: the Khai hoang routes ship together with their page, entry
  // and asset registration, so the inventory and the dist verifier stay in one contract.
  const htmlPaths = [
    ...recommended.map((entry) => entry.htmlPath),
    ...legacy.map((entry) => entry.htmlPath),
    ...khaiHoang.map((entry) => entry.htmlPath),
  ].sort();
  if (new Set(htmlPaths).size !== htmlPaths.length) throw new Error('Duplicate team detail output path');

  return {
    generationId: snapshot.pin.generationId,
    manifestSha256: snapshot.pin.manifestSha256,
    legacyTeamsSha256,
    khaiHoangSha256,
    recommended,
    legacy,
    khaiHoang,
    variants,
    htmlPaths,
  };
}

let defaultCatalog: Promise<TeamDetailRouteCatalog> | undefined;

export interface TeamDetailCatalogOptions {
  recommendedRoot?: string;
  teamsPath?: string;
  handlesPath?: string;
  khaiHoangPath?: string;
  khaiHoangBytes?: Uint8Array;
}

export function teamDetailCatalog({
  recommendedRoot = DEFAULT_RECOMMENDED_ROOT,
  teamsPath = DEFAULT_TEAMS_PATH,
  handlesPath = DEFAULT_HANDLES_PATH,
  khaiHoangPath,
  khaiHoangBytes,
}: TeamDetailCatalogOptions = {}) {
  if (
    recommendedRoot === DEFAULT_RECOMMENDED_ROOT
    && teamsPath === DEFAULT_TEAMS_PATH
    && handlesPath === DEFAULT_HANDLES_PATH
    && khaiHoangPath === undefined
    && khaiHoangBytes === undefined
  ) {
    return defaultCatalog ??= (async () => {
      const website = await websiteDisplayPublicationSnapshot();
      const teamsBytes = website.publicFiles['teams.json'];
      if (!teamsBytes) throw new Error('Website display snapshot does not pin data/teams.json');
      const khaiHoangBytes = website.publicFiles['khaihoang.json'];
      if (!khaiHoangBytes) throw new Error('Website display snapshot does not pin data/khaihoang.json');
      return buildCatalogFromSnapshot(
        website.recommended,
        teamsBytes,
        await readRegularFile(handlesPath),
        handlesPath,
        khaiHoangBytes,
        'verified website display publication (data/khaihoang.json)',
      );
    })();
  }
  // A custom root owns its Khai hoang source: never fall back to the repository file for a fixture.
  const khaiHoangSource: Promise<Uint8Array> = khaiHoangBytes !== undefined
    ? Promise.resolve(khaiHoangBytes)
    : khaiHoangPath !== undefined
      ? readRegularFile(khaiHoangPath)
      : Promise.reject(new Error(
        'A custom team detail root must supply its own Khai hoang source: pass khaiHoangPath or khaiHoangBytes',
      ));
  return Promise.all([
    recommendedPublicationSnapshot(recommendedRoot),
    readRegularFile(teamsPath),
    readRegularFile(handlesPath),
    khaiHoangSource,
  ]).then(([snapshot, teamsBytes, ledgerBytes, resolvedKhaiHoang]) => buildCatalogFromSnapshot(
    snapshot,
    teamsBytes,
    ledgerBytes,
    handlesPath,
    resolvedKhaiHoang,
    khaiHoangPath ?? 'injected Khai hoang bytes',
  ));
}

export function findAdmittedVariant(catalog: TeamDetailRouteCatalog, legacyTeamId: unknown, legacyVariantId: unknown) {
  if (!isRoutableIdentifier(legacyTeamId) || !isRoutableIdentifier(legacyVariantId)) return null;
  return catalog.variants.find(
    (variant) => variant.legacyTeamId === legacyTeamId && variant.legacyVariantId === legacyVariantId,
  ) ?? null;
}

/** Exact generated HTML inventory used by both the build and the dist verifier. */
export async function teamDetailHtmlPaths(options?: TeamDetailCatalogOptions) {
  return (await teamDetailCatalog(options)).htmlPaths;
}
