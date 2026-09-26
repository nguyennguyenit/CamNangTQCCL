import { normalizeText } from "./filters.js";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/gu;
const TRAILING_ANNOTATION = /\s*[\(（][^()（）]*[\)）]\s*$/u;
const VARIANT_PREFIX = /^(40Y|SP|CO)\s+/iu;

function cleanDisplayName(value) {
  if (typeof value !== "string") {
    throw new TypeError("Hero identity name must be a string");
  }
  let cleaned = value
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/gu, " ")
    .trim();
  while (TRAILING_ANNOTATION.test(cleaned)) {
    cleaned = cleaned.replace(TRAILING_ANNOTATION, "").trim();
  }
  return cleaned;
}

function slug(value) {
  const normalized = normalizeText(value)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (!normalized) throw new TypeError("Hero identity must contain a name");
  return normalized;
}

function variantOf(displayName) {
  const prefix = displayName.match(VARIANT_PREFIX)?.[1]?.toUpperCase();
  if (prefix === "40Y") return "other";
  if (prefix === "SP") return "sp";
  if (prefix === "CO") return "co";
  return "base";
}

function identity(displayName) {
  const cleaned = cleanDisplayName(displayName);
  const familyName = cleaned.replace(VARIANT_PREFIX, "");
  return Object.freeze({
    displayName: cleaned,
    canonicalId: `hero:${slug(cleaned)}`,
    familyId: `hero-family:${slug(familyName)}`,
    variant: variantOf(cleaned),
  });
}

export function canonicalHeroId(value) {
  return identity(value).canonicalId;
}

export function heroFamilyId(value) {
  return identity(value).familyId;
}

function primaryDisplayName(hero) {
  const named = cleanDisplayName(hero?.name || hero?.baseName || "");
  if (VARIANT_PREFIX.test(named)) return named;
  const baseName = cleanDisplayName(hero?.baseName || named);
  if (hero?.is40Y) return `40Y ${baseName}`;
  if (hero?.isSP) return `SP ${baseName}`;
  if (hero?.isCO) return `CO ${baseName}`;
  return named;
}

export function heroSlotAlternatives(value) {
  const names =
    typeof value === "string"
      ? value.split("/")
      : [
          ...primaryDisplayName(value).split("/"),
          ...(Array.isArray(value?.alternatives)
            ? value.alternatives.map((name) => {
                if (typeof name !== "string") {
                  throw new TypeError("Hero slot alternative must be a string");
                }
                return name;
              })
            : []),
        ];
  const seen = new Set();
  const alternatives = [];
  for (const name of names) {
    const parsed = identity(name);
    if (!seen.has(parsed.canonicalId)) {
      seen.add(parsed.canonicalId);
      alternatives.push(parsed);
    }
  }
  if (alternatives.length === 0) throw new TypeError("Hero slot needs an alternative");
  return alternatives;
}

export function normalizeHeroSlot(value) {
  const alternatives = heroSlotAlternatives(value);
  return Object.freeze({
    slotId: `slot:${alternatives.map(({ canonicalId }) => canonicalId).join("|")}`,
    alternatives,
  });
}
