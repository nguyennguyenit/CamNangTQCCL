import type {
  CanonicalProjectionVersion,
  ConfirmationBinding,
  HeroCanonicalId,
  HeroFamilyId,
  NormalizationDigest,
  TacticCanonicalId,
  TeamCanonicalId,
  WorkflowBuildId,
  WorkflowVersion,
} from "./contracts.js";

export const CANONICAL_PROJECTION_VERSION =
  "projection:v1" satisfies CanonicalProjectionVersion;

export interface CanonicalHeroState {
  canonicalId: HeroCanonicalId;
  familyId: HeroFamilyId;
  displayName: string;
  redStars?: number;
  level?: number;
  confidence?: string;
  evidence?: readonly unknown[];
}

export interface CanonicalTacticState {
  canonicalId: TacticCanonicalId;
  displayName: string;
  confidence?: string;
  evidence?: readonly unknown[];
}

export interface CanonicalLockedTeamState {
  teamId: TeamCanonicalId;
  heroIds: readonly HeroCanonicalId[];
  tacticIds: readonly TacticCanonicalId[];
  tacticAssignments?: readonly {
    holderId: HeroCanonicalId;
    tacticId: TacticCanonicalId;
    slotIndex?: number;
  }[];
}

export interface CanonicalState {
  heroes: readonly CanonicalHeroState[];
  tactics: readonly CanonicalTacticState[];
  lockedTeams: readonly CanonicalLockedTeamState[];
  unresolved?: readonly unknown[];
  warnings?: readonly string[];
}

export interface CanonicalStateInput {
  heroes: ReadonlyArray<{
    canonicalId: string;
    familyId: string;
    displayName?: string;
    redStars?: number;
    level?: number;
    confidence?: string;
    evidence?: readonly unknown[];
  }>;
  tactics: ReadonlyArray<{
    canonicalId: string;
    displayName?: string;
    confidence?: string;
    evidence?: readonly unknown[];
  }>;
  lockedTeams: ReadonlyArray<{
    teamId: string;
    heroIds: readonly string[];
    tacticIds: readonly string[];
    tacticAssignments?: readonly {
      holderId: string;
      tacticId: string;
      slotIndex?: number;
    }[];
  }>;
  unresolved?: readonly unknown[];
  warnings?: readonly string[];
}

interface CanonicalProjection {
  canonicalProjectionVersion: typeof CANONICAL_PROJECTION_VERSION;
  reviewRequired: boolean;
  heroes: Array<{
    canonicalId: string;
    familyId: string;
    redStars?: number;
    level?: number;
  }>;
  tactics: string[];
  lockedTeams: Array<{
    teamId: string;
    heroIds: string[];
    tacticIds: string[];
    tacticAssignments?: Array<{
      holderId: string;
      tacticId: string;
      slotIndex?: number;
    }>;
  }>;
}

const DIGEST_DOMAIN = "tqccl:canonical-state:v1\u0000";

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeUnicode(value: string): string {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isFinite(next) || next < 0xdc00 || next > 0xdfff) {
        throw new TypeError("Canonical JSON strings must contain valid Unicode");
      }
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError("Canonical JSON strings must contain valid Unicode");
    }
  }
  return value.normalize("NFC");
}

function canonicalJson(value: unknown): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return normalizeUnicode(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON numbers must be finite");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [normalizeUnicode(key), nested] as const)
      .sort(([left], [right]) => compareCodeUnits(left, right));
    for (const [key, nested] of entries) {
      if (Object.hasOwn(output, key)) {
        throw new TypeError(`Canonical JSON contains a duplicate normalized key: ${key}`);
      }
      output[key] = canonicalJson(nested);
    }
    return output;
  }
  throw new TypeError("Canonical state must contain JSON values only");
}

export function canonicalizeCanonicalState(value: unknown): string {
  return JSON.stringify(canonicalJson(value));
}

export function projectCanonicalState(state: CanonicalStateInput): CanonicalProjection {
  return {
    canonicalProjectionVersion: CANONICAL_PROJECTION_VERSION,
    reviewRequired: (state.unresolved?.length ?? 0) > 0,
    heroes: state.heroes
      .map((hero) => ({
        canonicalId: hero.canonicalId,
        familyId: hero.familyId,
        ...(hero.redStars === undefined ? {} : { redStars: hero.redStars }),
        ...(hero.level === undefined ? {} : { level: hero.level }),
      }))
      .sort((left, right) => compareCodeUnits(left.canonicalId, right.canonicalId)),
    tactics: state.tactics
      .map(({ canonicalId }) => canonicalId)
      .sort(compareCodeUnits),
    lockedTeams: state.lockedTeams.map((team) => ({
      teamId: team.teamId,
      heroIds: [...team.heroIds],
      tacticIds: [...team.tacticIds],
      ...(team.tacticAssignments === undefined
        ? {}
        : {
            tacticAssignments: team.tacticAssignments.map((assignment) => ({
              holderId: assignment.holderId,
              tacticId: assignment.tacticId,
              ...(assignment.slotIndex === undefined
                ? {}
                : { slotIndex: assignment.slotIndex }),
            })),
          }),
    })),
  };
}

export async function createNormalizationDigest(
  state: CanonicalStateInput,
): Promise<NormalizationDigest> {
  const input = new TextEncoder().encode(
    `${DIGEST_DOMAIN}${canonicalizeCanonicalState(projectCanonicalState(state))}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export function createWorkflowVersion(
  releaseId: string,
  workflowBuildId: WorkflowBuildId | string,
): WorkflowVersion {
  if (!releaseId || !workflowBuildId) {
    throw new TypeError("Workflow version inputs must be non-empty");
  }
  return `workflow:${releaseId}:${workflowBuildId}`;
}

export async function verifyConfirmationBinding(
  binding: {
    workflowVersion: string;
    normalizationDigest: string;
    canonicalProjectionVersion: string;
  },
  state: CanonicalStateInput,
  workflowVersion: WorkflowVersion | string,
): Promise<boolean> {
  if (
    binding.workflowVersion !== workflowVersion ||
    binding.canonicalProjectionVersion !== CANONICAL_PROJECTION_VERSION
  ) {
    return false;
  }
  return binding.normalizationDigest === (await createNormalizationDigest(state));
}
