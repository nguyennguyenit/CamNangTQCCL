import { normalizeText } from "../../../js/filters.js";
import { canonicalHeroId } from "../../../js/hero-identity.js";

export type DictionaryArtifact =
  | "heroes-dict"
  | "tactics"
  | "books-dict";

function slug(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/**
 * Canonical ID of a dictionary record. Heroes keep the hero-identity rule. Tactics/books use the published
 * `id` when the record has one (tactic ids are stable across display renames); only id-less records fall back
 * to the slug of the Vietnamese name.
 */
export function canonicalDictionaryId(
  artifact: DictionaryArtifact,
  displayName: string,
  recordId?: unknown,
): string {
  if (artifact === "heroes-dict") {
    return canonicalHeroId(displayName);
  }
  if (typeof recordId === "string" && recordId.trim() !== "") {
    return recordId.trim();
  }
  return `${artifact === "tactics" ? "tactic" : "book"}:${slug(displayName)}`;
}

interface TacticNameRow {
  readonly id?: unknown;
  readonly viet?: unknown;
  readonly hanViet?: unknown;
  readonly aliases?: unknown;
}

/**
 * Vietnamese tactic name → id. Tiers `viet` → `hanViet` → alias; the first tier with candidates decides (the current
 * display name beats a stale Hán-Việt spelling). Within it pick the row whose `id === "tactic:" + slug(name)`, else the
 * first candidate in catalog order. No candidate → null (callers keep their own fallback).
 */
export function createTacticNameResolver(
  rows: readonly TacticNameRow[],
): (name: string) => string | null {
  const byField: Array<Map<string, string[]>> = [new Map(), new Map(), new Map()];
  const add = (map: Map<string, string[]>, name: unknown, id: string): void => {
    if (typeof name !== "string") return;
    const key = slug(name);
    if (key === "") return;
    const ids = map.get(key);
    if (ids === undefined) map.set(key, [id]);
    else if (!ids.includes(id)) ids.push(id);
  };
  for (const row of rows) {
    if (typeof row.id !== "string" || row.id === "") continue;
    add(byField[0]!, row.viet, row.id);
    add(byField[1]!, row.hanViet, row.id);
    for (const alias of Array.isArray(row.aliases) ? row.aliases : []) add(byField[2]!, alias, row.id);
  }
  return (name) => {
    const key = slug(name);
    if (key === "") return null;
    const wanted = `tactic:${key}`;
    const ids = byField.map((map) => map.get(key) ?? []).find((list) => list.length > 0);
    if (ids === undefined) return null;
    return ids.includes(wanted) ? wanted : ids[0]!;
  };
}
