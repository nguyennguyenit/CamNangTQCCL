export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type HeroCanonicalId = `hero:${string}`;
export type TacticCanonicalId = `tactic:${string}`;
export type TeamCanonicalId = `team:${string}`;
export type CanonicalId = HeroCanonicalId | TacticCanonicalId | TeamCanonicalId;
export type HeroFamilyId = `hero-family:${string}`;
export type TacticFamilyId = `tactic-family:${string}`;
export type FamilyId = HeroFamilyId | TacticFamilyId;
export type CanonicalProjectionVersion = `projection:${string}`;
export type WorkflowBuildId = `build:${string}`;
export type WorkflowVersion = `workflow:${string}`;
export type NormalizationDigest = `sha256:${string}`;

export interface HeroIdentity {
  canonicalId: HeroCanonicalId;
  familyId: HeroFamilyId;
  displayName: string;
  variant: "base" | "sp" | "co" | "other";
}

export interface HeroSlot {
  slotId: `slot:${string}`;
  alternatives: readonly HeroCanonicalId[];
}

export interface CanonicalEntity {
  kind: "hero" | "tactic" | "team";
  canonicalId: CanonicalId;
  familyId?: FamilyId;
  displayName: string;
}

export interface ObservationEvidence {
  sourceScope: string;
  batchId?: string;
  fieldPresence?: readonly string[];
}

export interface StructuredObservation {
  observationId: string;
  entityKind: CanonicalEntity["kind"];
  observedText: string;
  evidence: ObservationEvidence;
}

export interface UnresolvedObservation {
  observationId: string;
  reason: "ambiguous" | "unknown" | "invalid";
  candidates: readonly CanonicalEntity[];
}

export interface ConfirmationDecision {
  observationId: string;
  canonicalId: CanonicalId;
  confirmed: true;
}

export interface ConfirmationBinding {
  workflowVersion: WorkflowVersion;
  normalizationDigest: NormalizationDigest;
  canonicalProjectionVersion: CanonicalProjectionVersion;
}

export interface BrowserScanConfirmation {
  confirmed: boolean;
}

export interface ProvenanceRef {
  releaseId: string;
  sourceId: string;
  recordId: string;
}

export interface OwnedHero {
  identity: HeroIdentity;
  redStars?: number;
  level?: number;
  provenance?: ProvenanceRef;
}

export interface OwnedTactic {
  canonicalId: TacticCanonicalId;
  displayName: string;
  provenance?: ProvenanceRef;
}

export interface LockedTeam {
  teamId: TeamCanonicalId;
  heroIds: readonly HeroCanonicalId[];
  tacticIds: readonly TacticCanonicalId[];
}

export interface RosterSnapshot {
  heroes: readonly OwnedHero[];
  tactics: readonly OwnedTactic[];
  lockedTeams: readonly LockedTeam[];
}

export interface TierRanking {
  tier: "T0" | "T0.5" | "T1" | "T1.5" | "T2" | "T3" | "untiered";
  mode: string;
  provenance: ProvenanceRef;
}

export interface TacticSelection {
  holderId: HeroCanonicalId;
  tacticId: TacticCanonicalId;
  alternativeFor?: TacticCanonicalId;
}

export interface TeamMatch {
  teamId: TeamCanonicalId;
  heroSlots: readonly HeroSlot[];
  tierRankings: readonly TierRanking[];
  tacticSelections: readonly TacticSelection[];
}

export interface ConflictDiagnostic {
  code: "missing-hero" | "missing-tactic" | "hero-conflict" | "tactic-conflict";
  entityIds: readonly CanonicalId[];
  message: string;
}

export interface ResultLimits {
  maxResults: number;
  maxDiagnostics: number;
}

export interface RecommendationRequest {
  roster: RosterSnapshot;
  confirmationBinding: ConfirmationBinding;
  expectedWorkflowVersion: WorkflowVersion;
  limits: ResultLimits;
  experimentalUntiered?: boolean;
}

export interface RecommendationResult {
  workflowVersion: WorkflowVersion;
  teams: readonly TeamMatch[];
  diagnostics: readonly ConflictDiagnostic[];
}

export interface ResultPage<T> {
  items: readonly T[];
  nextCursor?: string;
}

export interface DomainError {
  code: string;
  message: string;
  retryable: boolean;
  details?: JsonValue;
}

export class ContractValidationError extends Error {
  readonly code = "INVALID_DOMAIN_CONTRACT";

  constructor(message: string) {
    super(message);
    this.name = "ContractValidationError";
  }
}

const FORBIDDEN_FIELD_NAMES = new Set([
  "base64",
  "bearer",
  "blob",
  "image",
  "imagedataurl",
  "path",
  "providercredential",
  "providerkey",
  "providersecret",
  "token",
  "turnstiletoken",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContractValidationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ContractValidationError(`${label} must be an array`);
  }
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ContractValidationError(`${label} must be a non-empty string`);
  }
  return value;
}

function prefixedString<T extends string>(
  value: unknown,
  label: string,
  prefix: string,
): T {
  const parsed = string(value, label);
  if (!parsed.startsWith(prefix) || parsed.length === prefix.length) {
    throw new ContractValidationError(`${label} must start with ${prefix}`);
  }
  return parsed as T;
}

function optionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ContractValidationError(`${label} must be a finite number`);
  }
  return value;
}

function rejectForbiddenFields(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) {
    throw new ContractValidationError("cyclic values are not supported");
  }
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_FIELD_NAMES.has(key.toLowerCase())) {
      throw new ContractValidationError(`forbidden field: ${key}`);
    }
    rejectForbiddenFields(nested, seen);
  }
  seen.delete(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const allowed = new Set(expected);
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) {
    throw new ContractValidationError(`${label} contains unexpected field: ${unexpected}`);
  }
}

export function createHeroSlot(input: {
  slotId: HeroSlot["slotId"];
  alternatives: readonly HeroCanonicalId[];
}): HeroSlot {
  const slotId = prefixedString<HeroSlot["slotId"]>(input.slotId, "slotId", "slot:");
  if (!Array.isArray(input.alternatives) || input.alternatives.length === 0) {
    throw new ContractValidationError("alternatives must contain at least one canonical ID");
  }
  const alternatives = input.alternatives.map((id, index) =>
    prefixedString<HeroCanonicalId>(id, `alternatives[${index}]`, "hero:"),
  );
  if (new Set(alternatives).size !== alternatives.length) {
    throw new ContractValidationError("alternatives must be unique");
  }
  return { slotId, alternatives };
}

export function parseBrowserScanConfirmation(value: unknown): BrowserScanConfirmation {
  const input = record(value, "browser confirmation");
  if (typeof input.confirmed !== "boolean") {
    throw new ContractValidationError("confirmed must be a boolean");
  }
  return { confirmed: input.confirmed };
}

export function parseConfirmationBinding(value: unknown): ConfirmationBinding {
  const input = record(value, "confirmation binding");
  const keys = [
    "workflowVersion",
    "normalizationDigest",
    "canonicalProjectionVersion",
  ] as const;
  assertExactKeys(input, keys, "confirmation binding");
  return {
    workflowVersion: prefixedString<WorkflowVersion>(
      input.workflowVersion,
      keys[0],
      "workflow:",
    ),
    normalizationDigest: prefixedString<NormalizationDigest>(
      input.normalizationDigest,
      keys[1],
      "sha256:",
    ),
    canonicalProjectionVersion: prefixedString<CanonicalProjectionVersion>(
      input.canonicalProjectionVersion,
      keys[2],
      "projection:",
    ),
  };
}

function parseHeroIdentity(value: unknown, label: string): HeroIdentity {
  const input = record(value, label);
  const variant = string(input.variant, `${label}.variant`);
  if (!["base", "sp", "co", "other"].includes(variant)) {
    throw new ContractValidationError(`${label}.variant is invalid`);
  }
  return {
    canonicalId: prefixedString<HeroCanonicalId>(
      input.canonicalId,
      `${label}.canonicalId`,
      "hero:",
    ),
    familyId: prefixedString<HeroFamilyId>(
      input.familyId,
      `${label}.familyId`,
      "hero-family:",
    ),
    displayName: string(input.displayName, `${label}.displayName`),
    variant: variant as HeroIdentity["variant"],
  };
}

function parseProvenance(value: unknown, label: string): ProvenanceRef {
  const input = record(value, label);
  return {
    releaseId: string(input.releaseId, `${label}.releaseId`),
    sourceId: string(input.sourceId, `${label}.sourceId`),
    recordId: string(input.recordId, `${label}.recordId`),
  };
}

function parseOwnedHero(value: unknown, index: number): OwnedHero {
  const input = record(value, `heroes[${index}]`);
  const redStars = optionalFiniteNumber(input.redStars, `heroes[${index}].redStars`);
  const level = optionalFiniteNumber(input.level, `heroes[${index}].level`);
  const provenance =
    input.provenance === undefined
      ? undefined
      : parseProvenance(input.provenance, `heroes[${index}].provenance`);
  return {
    identity: parseHeroIdentity(input.identity, `heroes[${index}].identity`),
    ...(redStars === undefined ? {} : { redStars }),
    ...(level === undefined ? {} : { level }),
    ...(provenance === undefined ? {} : { provenance }),
  };
}

function parseOwnedTactic(value: unknown, index: number): OwnedTactic {
  const input = record(value, `tactics[${index}]`);
  const provenance =
    input.provenance === undefined
      ? undefined
      : parseProvenance(input.provenance, `tactics[${index}].provenance`);
  return {
    canonicalId: prefixedString<TacticCanonicalId>(
      input.canonicalId,
      `tactics[${index}].canonicalId`,
      "tactic:",
    ),
    displayName: string(input.displayName, `tactics[${index}].displayName`),
    ...(provenance === undefined ? {} : { provenance }),
  };
}

function canonicalIdArray<T extends CanonicalId>(
  value: unknown,
  label: string,
  prefix: string,
): T[] {
  return array(value, label).map((item, index) =>
    prefixedString<T>(item, `${label}[${index}]`, prefix),
  );
}

function parseLockedTeam(value: unknown, index: number): LockedTeam {
  const input = record(value, `lockedTeams[${index}]`);
  return {
    teamId: prefixedString<TeamCanonicalId>(
      input.teamId,
      `lockedTeams[${index}].teamId`,
      "team:",
    ),
    heroIds: canonicalIdArray<HeroCanonicalId>(
      input.heroIds,
      `lockedTeams[${index}].heroIds`,
      "hero:",
    ),
    tacticIds: canonicalIdArray<TacticCanonicalId>(
      input.tacticIds,
      `lockedTeams[${index}].tacticIds`,
      "tactic:",
    ),
  };
}

export function parseRosterSnapshot(value: unknown): RosterSnapshot {
  rejectForbiddenFields(value);
  const input = record(value, "roster snapshot");
  return {
    heroes: array(input.heroes, "heroes").map(parseOwnedHero),
    tactics: array(input.tactics, "tactics").map(parseOwnedTactic),
    lockedTeams: array(input.lockedTeams, "lockedTeams").map(parseLockedTeam),
  };
}

function canonicalJson(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ContractValidationError("JSON numbers must be finite");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) output[key] = canonicalJson(nested);
    }
    return output;
  }
  throw new ContractValidationError("value is not JSON serializable");
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalJson(value));
}
