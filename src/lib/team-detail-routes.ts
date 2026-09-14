import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_RECOMMENDED_ROOT, recommendedPublicationSnapshot, type RecommendedPublicationSnapshot } from './recommended-reference-artifacts.ts';
import { websiteDisplayPublicationSnapshot } from './root-static-artifacts.ts';

export const DEFAULT_TEAMS_PATH = join(process.cwd(), 'data/teams.json');

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

export interface RecommendedRouteEntry {
  sourceConfigId: string;
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

export interface TeamDetailRouteCatalog {
  generationId: string;
  manifestSha256: string;
  legacyTeamsSha256: string;
  recommended: RecommendedRouteEntry[];
  legacy: LegacyRouteEntry[];
  variants: AdmittedVariantEntry[];
  htmlPaths: string[];
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);

export const recommendedRoutePath = (sourceConfigId: string) => `/teams/recommended/${encodeURIComponent(sourceConfigId)}/`;
export const legacyRoutePath = (legacyTeamId: string) => `/teams/legacy/${encodeURIComponent(legacyTeamId)}/`;

async function readRegularFile(path: string) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Raw legacy teams artifact is not a regular file: ${path}`);
  return readFile(await realpath(path));
}

async function buildCatalogFromSnapshot(snapshot: RecommendedPublicationSnapshot, teamsBytes: Uint8Array): Promise<TeamDetailRouteCatalog> {
  const legacyTeamsSha256 = `sha256:${createHash('sha256').update(teamsBytes).digest('hex')}`;
  const declaredLegacyHash = snapshot.manifest.legacyTeamsHash;
  if (typeof declaredLegacyHash !== 'string' || declaredLegacyHash !== legacyTeamsSha256) {
    throw new Error(
      `Selected Recommended generation legacy teams hash does not match the raw originals: declared ${String(declaredLegacyHash)}, actual ${legacyTeamsSha256}`,
    );
  }

  const teams = JSON.parse(teamsBytes.toString());
  if (!Array.isArray(teams) || !teams.length) throw new Error('Raw legacy teams artifact must contain teams');
  const index = JSON.parse(Buffer.from(snapshot.files['index.json']).toString());
  const other = JSON.parse(Buffer.from(snapshot.files['other-teams.json']).toString());
  if (!Array.isArray(index?.records) || !Array.isArray(other?.records)) throw new Error('Selected Recommended publication is missing route records');

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
    return {
      sourceConfigId,
      routePath: recommendedRoutePath(sourceConfigId),
      htmlPath: `teams/recommended/${sourceConfigId}/index.html`,
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
    return {
      legacyTeamId,
      routePath: legacyRoutePath(legacyTeamId),
      htmlPath: `teams/legacy/${legacyTeamId}/index.html`,
      name: text(team.name),
      nickname: text(team.nickname),
      source: text(team.source),
      variantIds: [],
    };
  });

  for (const variant of variants) {
    if (!seenLegacy.has(variant.legacyTeamId)) {
      throw new Error(`Admitted variant references an unknown legacy team: ${variant.legacyTeamId}`);
    }
    const bucket = variantsByTeam.get(variant.legacyTeamId) ?? [];
    bucket.push(variant.legacyVariantId);
    variantsByTeam.set(variant.legacyTeamId, bucket);
  }
  for (const entry of legacy) entry.variantIds = variantsByTeam.get(entry.legacyTeamId) ?? [];

  const htmlPaths = [...recommended.map((entry) => entry.htmlPath), ...legacy.map((entry) => entry.htmlPath)].sort();
  if (new Set(htmlPaths).size !== htmlPaths.length) throw new Error('Duplicate team detail output path');

  return {
    generationId: snapshot.pin.generationId,
    manifestSha256: snapshot.pin.manifestSha256,
    legacyTeamsSha256,
    recommended,
    legacy,
    variants,
    htmlPaths,
  };
}

let defaultCatalog: Promise<TeamDetailRouteCatalog> | undefined;

export function teamDetailCatalog({
  recommendedRoot = DEFAULT_RECOMMENDED_ROOT,
  teamsPath = DEFAULT_TEAMS_PATH,
}: { recommendedRoot?: string; teamsPath?: string } = {}) {
  if (recommendedRoot === DEFAULT_RECOMMENDED_ROOT && teamsPath === DEFAULT_TEAMS_PATH) {
    return defaultCatalog ??= (async () => {
      const website = await websiteDisplayPublicationSnapshot();
      const teamsBytes = website.publicFiles['teams.json'];
      if (!teamsBytes) throw new Error('Website display snapshot does not pin data/teams.json');
      return buildCatalogFromSnapshot(website.recommended, teamsBytes);
    })();
  }
  return Promise.all([recommendedPublicationSnapshot(recommendedRoot), readRegularFile(teamsPath)])
    .then(([snapshot, teamsBytes]) => buildCatalogFromSnapshot(snapshot, teamsBytes));
}

export function findAdmittedVariant(catalog: TeamDetailRouteCatalog, legacyTeamId: unknown, legacyVariantId: unknown) {
  if (!isRoutableIdentifier(legacyTeamId) || !isRoutableIdentifier(legacyVariantId)) return null;
  return catalog.variants.find(
    (variant) => variant.legacyTeamId === legacyTeamId && variant.legacyVariantId === legacyVariantId,
  ) ?? null;
}

/** Exact generated HTML inventory used by both the build and the dist verifier. */
export async function teamDetailHtmlPaths(options?: { recommendedRoot?: string; teamsPath?: string }) {
  return (await teamDetailCatalog(options)).htmlPaths;
}
