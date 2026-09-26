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
export type NormalizationDigest = `sha256b64:${string}`;

export interface CanonicalEntity {
  kind: "hero" | "tactic" | "team";
  canonicalId: CanonicalId;
  familyId?: FamilyId;
  displayName: string;
}

export interface ObservationEvidence {
  sourceScope: "currentTurnImage" | "priorConfirmedNote" | "manualCorrection";
  batchId: string;
  imageOrdinal?: number;
  fieldPresence?: readonly string[];
  trust?: "untrusted";
}

export interface StructuredObservation {
  observationId: string;
  entityKind: CanonicalEntity["kind"];
  observedText?: string;
  canonicalId?: CanonicalId;
  familyId?: FamilyId;
  displayName?: string;
  redStars?: number | null;
  level?: number | null;
  reviewRequired?: boolean;
  candidates?: readonly CanonicalId[];
  replacesCanonicalId?: CanonicalId;
  heroIds?: readonly HeroCanonicalId[] | null;
  tacticIds?: readonly TacticCanonicalId[] | null;
  tacticAssignments?:
    | readonly {
        holderId: HeroCanonicalId;
        tacticId: TacticCanonicalId;
        slotIndex?: number;
      }[]
    | null;
  trust?: "untrusted";
  evidence: ObservationEvidence;
}

export interface ConfirmationBinding {
  workflowVersion: WorkflowVersion;
  normalizationDigest: NormalizationDigest;
  canonicalProjectionVersion: CanonicalProjectionVersion;
}

export class ContractValidationError extends Error {
  readonly code = "INVALID_DOMAIN_CONTRACT";

  constructor(message: string) {
    super(message);
    this.name = "ContractValidationError";
  }
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
