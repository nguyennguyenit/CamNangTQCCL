/**
 * Đội cộng đồng lúc build: một request `GET /api/community-teams/export` (schema v1) → trang tĩnh `/doi-cong-dong/<id>/`.
 * Fail-closed như blog (`blog-posts.ts`): không `COMMUNITY_API_ORIGIN` → không có đội, không gọi mạng; có origin mà API/payload
 * lỗi → dừng build (không bao giờ phát một dist thiếu đội do lỗi tạm thời). Chỉ giữ trường cần để render: số vote/điểm,
 * `author.id`, `evidenceCount`… bị bỏ để trang tĩnh không thể nhúng nhầm số liệu sống.
 */
import { localePath } from '../../js/i18n.js';
import { communityApiOrigin } from './blog-posts.ts';
import type { SiteLocale } from './locale-routes';

export const COMMUNITY_TEAMS_INDEX_MIN = 10;
export const COMMUNITY_TEAM_TROOPS = ['cung', 'khiGioi', 'ky', 'thuan', 'thuong'] as const;
export type CommunityTeamTroop = (typeof COMMUNITY_TEAM_TROOPS)[number];

export const COMMUNITY_TEAM_ANALYSIS_KEYS = ['strengths', 'weaknesses', 'counters', 'counteredBy', 'substitutes'] as const;

const TEAM_ID = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const TITLE_MAX = 80;

export interface CommunityTeamAnalysis {
  playstyle: string;
  strengths: string | null;
  weaknesses: string | null;
  counters: string | null;
  counteredBy: string | null;
  substitutes: string | null;
}

export interface CommunityTeam {
  id: string;
  title: string;
  season: { id: string; labelVi: string; labelZh: string };
  heroes: [string, string, string];
  tactics: [[string, string], [string, string], [string, string]];
  troop: CommunityTeamTroop;
  /** `null` khi Worker không có tên (rỗng/khoảng trắng); trang hiển thị chữ thay thế theo ngôn ngữ. */
  author: { name: string | null };
  imageCount: number;
  textLang: SiteLocale;
  createdAt: string;
  approvedAt: string;
  analysis: CommunityTeamAnalysis;
}

/** Đường dẫn trang đội theo ngôn ngữ trang (`/doi-cong-dong/<id>/` hoặc `/zh/doi-cong-dong/<id>/`). */
export function communityTeamPath(id: string, locale: SiteLocale): string {
  return localePath(`/doi-cong-dong/${id}/`, locale);
}

/** Bản được index của một đội: bản đúng ngôn ngữ văn bản người dùng. */
export function canonicalTeamPath(team: Pick<CommunityTeam, 'id' | 'textLang'>): string {
  return communityTeamPath(team.id, team.textLang);
}

/** Danh sách `/doi-cong-dong/` chỉ được index khi có đủ đội (đếm id duy nhất). */
export function communityTeamsIndexable(count: number): boolean {
  return count >= COMMUNITY_TEAMS_INDEX_MIN;
}

function fail(message: string): never {
  throw new Error(`Community teams export ${message}`);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, where: string): string {
  if (typeof value !== 'string') fail(`${where} must be a string`);
  return value;
}

function nonEmpty(value: unknown, where: string): string {
  const out = text(value, where);
  if (!out.trim()) fail(`${where} must not be empty`);
  return out;
}

function prefixedIds(value: unknown, prefix: string, count: number, where: string): string[] {
  if (!Array.isArray(value) || value.length !== count) fail(`${where} must hold ${count} ids`);
  return value.map((entry, index) => {
    const id = text(entry, `${where}[${index}]`);
    if (!id.startsWith(prefix) || id.length === prefix.length) fail(`${where}[${index}] must be a ${prefix} id`);
    return id;
  });
}

function timestamp(value: unknown, where: string): string {
  const out = text(value, where);
  if (!Number.isFinite(Date.parse(out))) fail(`${where} is not a date`);
  return out;
}

function validateTeam(raw: unknown, index: number): CommunityTeam {
  const where = `items[${index}]`;
  if (!isRecord(raw)) fail(`${where} must be an object`);
  const id = text(raw.id, `${where}.id`);
  if (!TEAM_ID.test(id)) fail(`${where}.id is not a team id: ${id}`);
  const title = nonEmpty(raw.title, `${where}.title`);
  if (Array.from(title).length > TITLE_MAX) fail(`${where}.title exceeds ${TITLE_MAX} characters`);
  if (!isRecord(raw.season)) fail(`${where}.season must be an object`);
  const season = {
    id: text(raw.season.id, `${where}.season.id`),
    labelVi: text(raw.season.labelVi, `${where}.season.labelVi`),
    labelZh: text(raw.season.labelZh, `${where}.season.labelZh`),
  };
  const heroes = prefixedIds(raw.heroes, 'hero:', 3, `${where}.heroes`) as CommunityTeam['heroes'];
  if (!Array.isArray(raw.tactics) || raw.tactics.length !== 3) fail(`${where}.tactics must hold 3 pairs`);
  const tactics = raw.tactics.map((pair, position) => prefixedIds(pair, 'tactic:', 2, `${where}.tactics[${position}]`)) as CommunityTeam['tactics'];
  const troop = raw.troop;
  if (!COMMUNITY_TEAM_TROOPS.includes(troop as CommunityTeamTroop)) fail(`${where}.troop is not a known troop`);
  if (!isRecord(raw.author)) fail(`${where}.author must be an object`);
  const rawAuthorName = raw.author.name;
  if (rawAuthorName !== null) text(rawAuthorName, `${where}.author.name`);
  const authorName = typeof rawAuthorName === 'string' ? rawAuthorName.trim() || null : null;
  const imageCount = raw.imageCount;
  if (!Number.isInteger(imageCount) || (imageCount as number) < 0 || (imageCount as number) > 3) fail(`${where}.imageCount must be an integer 0-3`);
  const textLang = raw.textLang;
  if (textLang !== 'vi' && textLang !== 'zh') fail(`${where}.textLang must be vi or zh`);
  if (!isRecord(raw.analysis)) fail(`${where}.analysis must be an object`);
  const analysis: CommunityTeamAnalysis = {
    playstyle: nonEmpty(raw.analysis.playstyle, `${where}.analysis.playstyle`),
    strengths: null,
    weaknesses: null,
    counters: null,
    counteredBy: null,
    substitutes: null,
  };
  for (const key of COMMUNITY_TEAM_ANALYSIS_KEYS) {
    const value = raw.analysis[key];
    if (value !== null && typeof value !== 'string') fail(`${where}.analysis.${key} must be a string or null`);
    analysis[key] = value;
  }
  return {
    id,
    title,
    season,
    heroes,
    tactics,
    troop: troop as CommunityTeamTroop,
    author: { name: authorName },
    imageCount: imageCount as number,
    textLang,
    createdAt: timestamp(raw.createdAt, `${where}.createdAt`),
    approvedAt: timestamp(raw.approvedAt, `${where}.approvedAt`),
    analysis,
  };
}

/** Mới nhất trước; cùng thời điểm thì id giảm dần (khớp thứ tự của API, ổn định dù API đổi thứ tự). */
function byNewest(a: CommunityTeam, b: CommunityTeam) {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

/** Payload `GET /api/community-teams/export` → đội đã kiểm; sai schema là lỗi build. */
export function validateTeamsExport(payload: unknown): CommunityTeam[] {
  if (!isRecord(payload)) fail('must be an object');
  if (payload.schemaVersion !== 1) fail(`schemaVersion must be 1 (got ${String(payload.schemaVersion)})`);
  if (!Array.isArray(payload.items)) fail('items must be an array');
  const teams = payload.items.map(validateTeam);
  const seen = new Set<string>();
  for (const team of teams) {
    if (seen.has(team.id)) fail(`repeats team id: ${team.id}`);
    seen.add(team.id);
  }
  return teams.sort(byNewest);
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export async function fetchCommunityTeams({
  env = process.env,
  fetchImpl = fetch,
}: { env?: Record<string, string | undefined>; fetchImpl?: FetchLike } = {}): Promise<CommunityTeam[]> {
  const origin = communityApiOrigin(env);
  if (!origin) return [];
  let response: Response;
  try {
    response = await fetchImpl(new URL('/api/community-teams/export', origin), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Community teams fetch failed: ${(error as Error).message}`);
  }
  if (!response.ok) throw new Error(`Community teams fetch failed: HTTP ${response.status}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    fail('response is not JSON');
  }
  return validateTeamsExport(payload);
}

let memo: { origin: string | null; teams: Promise<CommunityTeam[]> } | null = null;

/** Một lần gọi API cho cả lần build: hai route trang đội, trang danh sách và sitemap dùng chung kết quả. */
export function loadCommunityTeams(): Promise<CommunityTeam[]> {
  const origin = communityApiOrigin();
  if (!memo || memo.origin !== origin) memo = { origin, teams: fetchCommunityTeams() };
  return memo.teams;
}
