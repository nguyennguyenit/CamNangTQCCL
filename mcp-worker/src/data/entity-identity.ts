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

export function canonicalDictionaryId(
  artifact: DictionaryArtifact,
  displayName: string,
): string {
  if (artifact === "heroes-dict") {
    return canonicalHeroId(displayName);
  }
  return `${artifact === "tactics" ? "tactic" : "book"}:${slug(displayName)}`;
}
