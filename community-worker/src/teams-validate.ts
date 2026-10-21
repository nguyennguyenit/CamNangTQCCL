// Kiểm tra đầu vào Đội cộng đồng: mùa, đội, vote, bộ lọc danh sách. Id tướng/CP chỉ kiểm định dạng + không trùng.

import { ApiError } from "./http";
import { parseId, parseLang, parseText, type Lang } from "./validate";

export const SEASON_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/u;
export const TROOPS = ["cung", "khiGioi", "ky", "thuan", "thuong"] as const;
export type Troop = (typeof TROOPS)[number];
export const TEAM_SORTS = ["hot", "new", "top"] as const;
export type TeamSort = (typeof TEAM_SORTS)[number];

const TEAM_HEROES = 3;
const TACTICS_PER_HERO = 2;
const MAX_UPLOADS = 3;
const UPLOAD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/u;

const bad = (code: string, message: string) => new ApiError(400, code, message);

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Như parseText nhưng báo lỗi dưới `code` cố định. */
function text(value: unknown, code: string, label: string, min: number, max: number): string {
  try {
    return parseText(value, label, min, max);
  } catch (e) {
    if (e instanceof ApiError) throw bad(code, e.message);
    throw e;
  }
}

function optionalText(value: unknown, label: string): string | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  return text(value, "invalid_text", label, 1, 2000);
}

export interface TeamInput {
  title: string;
  heroes: string[];
  tactics: string[][];
  troop: Troop;
  playstyle: string;
  strengths: string | null;
  weaknesses: string | null;
  counters: string | null;
  counteredBy: string | null;
  substitutes: string | null;
  lang: Lang;
  uploadIds: string[];
}

export interface SeasonInput {
  id: string;
  labelVi: string;
  labelZh: string;
}

/** 3 id tướng đã sắp xếp, nối bằng ',' (khoá tìm đội cùng bộ tướng). */
export function heroKey(heroes: readonly string[]): string {
  return [...heroes].sort().join(",");
}

function parseHeroes3(value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== TEAM_HEROES) {
    throw bad("invalid_heroes", `heroes phải có đúng ${TEAM_HEROES} tướng`);
  }
  const heroes = value.map((h) => parseId(h, "hero", "heroes"));
  if (new Set(heroes).size !== heroes.length) throw bad("invalid_heroes", "heroes có tướng trùng");
  return heroes;
}

function parseTactics(value: unknown): string[][] {
  if (!Array.isArray(value) || value.length !== TEAM_HEROES) {
    throw bad("invalid_tactics", `tactics phải có ${TEAM_HEROES} cặp chiến pháp`);
  }
  const pairs = value.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== TACTICS_PER_HERO) {
      throw bad("invalid_tactics", `mỗi tướng phải có đúng ${TACTICS_PER_HERO} chiến pháp`);
    }
    return pair.map((t) => parseId(t, "tactic", "tactics"));
  });
  if (new Set(pairs.flat()).size !== TEAM_HEROES * TACTICS_PER_HERO) {
    throw bad("invalid_tactics", "tactics có chiến pháp trùng trong đội");
  }
  return pairs;
}

function parseTroop(value: unknown): Troop {
  if (!TROOPS.includes(value as Troop)) throw bad("invalid_troop", `troop phải là ${TROOPS.join(", ")}`);
  return value as Troop;
}

function parseUploadIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_UPLOADS) {
    throw bad("invalid_uploads", `uploadIds phải có 1–${MAX_UPLOADS} ảnh`);
  }
  const ids = value.map((id) => {
    if (typeof id !== "string" || !UPLOAD_ID_RE.test(id)) throw bad("invalid_uploads", "uploadId không hợp lệ");
    return id;
  });
  if (new Set(ids).size !== ids.length) throw bad("invalid_uploads", "uploadIds có ảnh trùng");
  return ids;
}

export function parseTeamInput(input: unknown): TeamInput {
  if (!isObject(input)) throw bad("invalid_body", "Nội dung không hợp lệ");
  return {
    title: text(input.title, "invalid_title", "title", 1, 80),
    heroes: parseHeroes3(input.heroes),
    tactics: parseTactics(input.tactics),
    troop: parseTroop(input.troop),
    playstyle: text(input.playstyle, "invalid_text", "playstyle", 10, 3000),
    strengths: optionalText(input.strengths, "strengths"),
    weaknesses: optionalText(input.weaknesses, "weaknesses"),
    counters: optionalText(input.counters, "counters"),
    counteredBy: optionalText(input.counteredBy, "counteredBy"),
    substitutes: optionalText(input.substitutes, "substitutes"),
    lang: parseLang(input.lang),
    uploadIds: parseUploadIds(input.uploadIds),
  };
}

export function parseSeasonInput(input: unknown): SeasonInput {
  if (!isObject(input)) throw bad("invalid_body", "Nội dung không hợp lệ");
  // `all` là giá trị lọc "mọi mùa" của danh sách (`parseSeasonFilter`), không được làm id mùa.
  if (typeof input.id !== "string" || !SEASON_ID_RE.test(input.id) || input.id === "all") {
    throw bad("invalid_season", "id mùa phải là slug a-z0-9- (tối đa 40 ký tự, khác 'all')");
  }
  return {
    id: input.id,
    labelVi: text(input.labelVi, "invalid_season", "labelVi", 1, 60),
    labelZh: text(input.labelZh, "invalid_season", "labelZh", 1, 60),
  };
}

export function parseVote(value: unknown): 1 | -1 | 0 {
  if (value !== 1 && value !== -1 && value !== 0) throw bad("invalid_vote", "value phải là 1, -1 hoặc 0");
  return value;
}

/** Thiếu/rỗng -> hot. */
export function parseTeamSort(value: unknown): TeamSort {
  if (value === undefined || value === null || value === "") return "hot";
  if (!TEAM_SORTS.includes(value as TeamSort)) throw bad("invalid_sort", `sort phải là ${TEAM_SORTS.join(", ")}`);
  return value as TeamSort;
}

/** Query `hero=hero:a,hero:b`: 0–3 id tướng đúng định dạng, không trùng. */
export function parseHeroFilter(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value !== "string") throw bad("invalid_hero", "hero phải là chuỗi");
  const heroes = value.split(",").map((h) => parseId(h, "hero", "hero"));
  if (heroes.length > TEAM_HEROES || new Set(heroes).size !== heroes.length) {
    throw bad("invalid_hero", `hero tối đa ${TEAM_HEROES} id khác nhau`);
  }
  return heroes;
}

/** Query `season`: thiếu -> null (mùa đang mở); `all`; hoặc id mùa. */
export function parseSeasonFilter(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (value === "all") return "all";
  if (typeof value !== "string" || !SEASON_ID_RE.test(value)) throw bad("invalid_season", "season không hợp lệ");
  return value;
}
