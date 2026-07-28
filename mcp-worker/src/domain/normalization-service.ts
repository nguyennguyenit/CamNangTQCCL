import {
  CANONICAL_PROJECTION_VERSION,
  createNormalizationDigest,
  type CanonicalHeroState,
  type CanonicalLockedTeamState,
  type CanonicalState,
  type CanonicalTacticState,
} from "./canonical-state.js";
import type {
  CanonicalId,
  ConfirmationBinding,
  HeroCanonicalId,
  HeroFamilyId,
  StructuredObservation,
  TacticCanonicalId,
  TeamCanonicalId,
  WorkflowVersion,
} from "./contracts.js";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/gu;
const MAX_LABEL_LENGTH = 256;
const MAX_OBSERVATIONS = 500;
const COLLECTION_LIMITS = {
  candidates: 20,
  heroIds: 20,
  tacticIds: 60,
  tacticAssignments: 60,
  fieldPresence: 20,
} as const;
const SOURCE_PRIORITY = {
  priorConfirmedNote: 1,
  currentTurnImage: 2,
  manualCorrection: 3,
} as const;

type NormalizationObservation = StructuredObservation;

export interface NormalizationResult {
  canonicalState: CanonicalState;
  observations: NormalizationObservation[];
  warnings: string[];
  reviewRequired: boolean;
  confirmationBinding: ConfirmationBinding;
}

export interface NormalizeObservationsRequest {
  workflowVersion: WorkflowVersion | string;
  observations: readonly NormalizationObservation[];
}

interface RankedObservation {
  observation: NormalizationObservation;
  priority: number;
}

function sanitizeLabel(value: string | undefined): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_LABEL_LENGTH);
}

function priority(observation: NormalizationObservation): number {
  return SOURCE_PRIORITY[observation.evidence.sourceScope];
}

function present(
  observation: NormalizationObservation,
  field: keyof NormalizationObservation,
): boolean {
  return Object.hasOwn(observation, field);
}

function highestPriorityValues(
  observations: readonly RankedObservation[],
  field: keyof NormalizationObservation,
): RankedObservation[] {
  const presentValues = observations.filter(({ observation }) =>
    present(observation, field),
  );
  const highest = Math.max(0, ...presentValues.map(({ priority: rank }) => rank));
  return presentValues.filter(({ priority: rank }) => rank === highest);
}

function selectText(
  observations: readonly RankedObservation[],
  field: "displayName" | "familyId",
): string {
  const selected = highestPriorityValues(observations, field)
    .map(({ observation }) => observation[field])
    .find((value): value is string => typeof value === "string");
  return sanitizeLabel(selected);
}

function selectNumber(
  observations: readonly RankedObservation[],
  field: "redStars" | "level",
  canonicalId: string,
  warnings: string[],
): number | undefined {
  const values = highestPriorityValues(observations, field)
    .map(({ observation }) => observation[field])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (new Set(values).size > 1) {
    warnings.push(`conflicting-${field}:${canonicalId}`);
  }
  return values.length === 0 ? undefined : Math.max(...values);
}

function evidenceFor(observations: readonly RankedObservation[]): unknown[] {
  return observations
    .map(({ observation }) => ({
      observationId: sanitizeLabel(observation.observationId),
      ...observation.evidence,
      batchId: sanitizeLabel(observation.evidence.batchId),
      trust: "untrusted",
    }))
    .sort(
      (left, right) =>
        SOURCE_PRIORITY[right.sourceScope] - SOURCE_PRIORITY[left.sourceScope] ||
        String(left.batchId).localeCompare(String(right.batchId)) ||
        (left.imageOrdinal ?? -1) - (right.imageOrdinal ?? -1) ||
        left.observationId.localeCompare(right.observationId),
    );
}

function canonicalHero(
  canonicalId: HeroCanonicalId,
  observations: readonly RankedObservation[],
  warnings: string[],
): CanonicalHeroState {
  const familyId = selectText(observations, "familyId");
  if (!familyId.startsWith("hero-family:")) {
    throw new TypeError(`Hero observation ${canonicalId} needs a hero family ID`);
  }
  const redStars = selectNumber(observations, "redStars", canonicalId, warnings);
  const level = selectNumber(observations, "level", canonicalId, warnings);
  return {
    canonicalId,
    familyId: familyId as HeroFamilyId,
    displayName: selectText(observations, "displayName"),
    confidence: observations.some(
      ({ observation }) => observation.evidence.sourceScope === "manualCorrection",
    )
      ? "manual"
      : "high",
    evidence: evidenceFor(observations),
    ...(redStars === undefined ? {} : { redStars }),
    ...(level === undefined ? {} : { level }),
  };
}

function canonicalTactic(
  canonicalId: TacticCanonicalId,
  observations: readonly RankedObservation[],
): CanonicalTacticState {
  return {
    canonicalId,
    displayName: selectText(observations, "displayName"),
    confidence: observations.some(
      ({ observation }) => observation.evidence.sourceScope === "manualCorrection",
    )
      ? "manual"
      : "high",
    evidence: evidenceFor(observations),
  };
}

function grouped(
  observations: readonly NormalizationObservation[],
  kind: "hero" | "tactic" | "team",
): Map<string, RankedObservation[]> {
  const groups = new Map<string, RankedObservation[]>();
  for (const observation of observations) {
    if (
      observation.entityKind !== kind ||
      observation.reviewRequired ||
      !observation.canonicalId
    ) {
      continue;
    }
    const expectedPrefix =
      kind === "hero" ? "hero:" : kind === "tactic" ? "tactic:" : "team:";
    if (!observation.canonicalId.startsWith(expectedPrefix)) continue;
    const current = groups.get(observation.canonicalId) ?? [];
    current.push({ observation, priority: priority(observation) });
    groups.set(observation.canonicalId, current);
  }
  return groups;
}

function selectCanonicalIds(
  observations: readonly RankedObservation[],
  field: "heroIds" | "tacticIds",
  prefix: "hero:" | "tactic:",
): { values: string[]; conflict: boolean } {
  const selectedValues = highestPriorityValues(observations, field)
    .map(({ observation }) => observation[field])
    .filter((value) => value === null || Array.isArray(value));
  const signatures = new Set(
    selectedValues.map((value) => JSON.stringify(value === null ? null : [...value])),
  );
  if (signatures.size > 1) return { values: [], conflict: true };
  const selected = selectedValues[0];
  if (selected === null || selected === undefined) {
    return { values: [], conflict: false };
  }
  const values = [...selected];
  if (
    values.some(
      (value) =>
        typeof value !== "string" ||
        !value.startsWith(prefix) ||
        value.length === prefix.length,
    ) ||
    new Set(values).size !== values.length
  ) {
    throw new TypeError(`Locked team ${field} contains invalid canonical IDs`);
  }
  return { values, conflict: false };
}

function canonicalLockedTeam(
  canonicalId: TeamCanonicalId,
  observations: readonly RankedObservation[],
): { team: CanonicalLockedTeamState; conflict: boolean } {
  const heroes = selectCanonicalIds(observations, "heroIds", "hero:");
  const tactics = selectCanonicalIds(observations, "tacticIds", "tactic:");
  const assignmentValues = highestPriorityValues(
    observations,
    "tacticAssignments",
  )
    .map(({ observation }) => observation.tacticAssignments)
    .filter((value) => value === null || Array.isArray(value));
  const assignmentSignatures = new Set(
    assignmentValues.map((value) =>
      JSON.stringify(value === null ? null : value),
    ),
  );
  const selectedAssignments = assignmentValues[0];
  let assignmentConflict = false;
  const assignedTactics = new Set<TacticCanonicalId>();
  const assignedSlots = new Set<string>();
  const tacticAssignments =
    selectedAssignments === null || selectedAssignments === undefined
      ? undefined
      : selectedAssignments.map((assignment) => {
          if (
            !assignment.holderId.startsWith("hero:") ||
            assignment.holderId.length === "hero:".length ||
            !assignment.tacticId.startsWith("tactic:") ||
            assignment.tacticId.length === "tactic:".length ||
            (assignment.slotIndex !== undefined &&
              (!Number.isInteger(assignment.slotIndex) ||
                assignment.slotIndex < 0))
          ) {
            throw new TypeError("Locked team tactic assignment is invalid");
          }
          const slotKey =
            assignment.slotIndex === undefined
              ? null
              : `${assignment.holderId}:${assignment.slotIndex}`;
          if (
            !heroes.values.includes(assignment.holderId) ||
            !tactics.values.includes(assignment.tacticId) ||
            assignedTactics.has(assignment.tacticId) ||
            (slotKey !== null && assignedSlots.has(slotKey))
          ) {
            assignmentConflict = true;
          }
          assignedTactics.add(assignment.tacticId);
          if (slotKey !== null) assignedSlots.add(slotKey);
          return {
            holderId: assignment.holderId,
            tacticId: assignment.tacticId,
            ...(assignment.slotIndex === undefined
              ? {}
              : { slotIndex: assignment.slotIndex }),
          };
        });
  return {
    team: {
      teamId: canonicalId,
      heroIds: heroes.values as HeroCanonicalId[],
      tacticIds: tactics.values as TacticCanonicalId[],
      ...(tacticAssignments === undefined ? {} : { tacticAssignments }),
    },
    conflict:
      heroes.conflict ||
      tactics.conflict ||
      assignmentSignatures.size > 1 ||
      assignmentConflict,
  };
}

function unresolvedObservation(observation: NormalizationObservation): unknown {
  return {
    observationId: sanitizeLabel(observation.observationId),
    entityKind: observation.entityKind,
    observedText: sanitizeLabel(observation.observedText),
    candidates: [...(observation.candidates ?? [])],
    reason: observation.reviewRequired ? "ambiguous" : "unknown",
    trust: "untrusted",
    evidence: {
      ...observation.evidence,
      batchId: sanitizeLabel(observation.evidence.batchId),
      trust: "untrusted",
    },
  };
}

function validateObservation(observation: NormalizationObservation): void {
  if (!observation.observationId || !observation.evidence?.batchId) {
    throw new TypeError("Observation ID and evidence batch ID are required");
  }
  if (!Object.hasOwn(SOURCE_PRIORITY, observation.evidence.sourceScope)) {
    throw new TypeError("Observation source scope is invalid");
  }
  if (observation.canonicalId) {
    const expectedPrefix =
      observation.entityKind === "hero"
        ? "hero:"
        : observation.entityKind === "tactic"
          ? "tactic:"
          : "team:";
    if (
      !observation.canonicalId.startsWith(expectedPrefix) ||
      observation.canonicalId.length === expectedPrefix.length
    ) {
      throw new TypeError(
        `${observation.entityKind} observation has a canonical ID from the wrong namespace`,
      );
    }
  }
  if (
    observation.familyId !== undefined &&
    (!observation.familyId.startsWith("hero-family:") ||
      observation.familyId.length === "hero-family:".length)
  ) {
    throw new TypeError("Hero family ID is invalid");
  }
  for (const field of ["redStars", "level"] as const) {
    const value = observation[field];
    if (value !== undefined && value !== null && !Number.isFinite(value)) {
      throw new TypeError(`Observation ${field} must be finite`);
    }
  }
  for (const field of [
    "candidates",
    "heroIds",
    "tacticIds",
    "tacticAssignments",
  ] as const) {
    const value = observation[field];
    if (
      Array.isArray(value) &&
      value.length > COLLECTION_LIMITS[field]
    ) {
      throw new RangeError(
        `Observation ${field} exceeds ${COLLECTION_LIMITS[field]} items`,
      );
    }
  }
  if (
    (observation.evidence.fieldPresence?.length ?? 0) >
    COLLECTION_LIMITS.fieldPresence
  ) {
    throw new RangeError(
      `Observation fieldPresence exceeds ${COLLECTION_LIMITS.fieldPresence} items`,
    );
  }
}

function sanitizeObservation(
  observation: NormalizationObservation,
): NormalizationObservation {
  return {
    observationId: sanitizeLabel(observation.observationId),
    entityKind: observation.entityKind,
    ...(observation.observedText === undefined
      ? {}
      : { observedText: sanitizeLabel(observation.observedText) }),
    ...(observation.canonicalId === undefined
      ? {}
      : { canonicalId: observation.canonicalId }),
    ...(observation.familyId === undefined
      ? {}
      : { familyId: observation.familyId }),
    ...(observation.displayName === undefined
      ? {}
      : { displayName: sanitizeLabel(observation.displayName) }),
    ...(observation.redStars === undefined
      ? {}
      : { redStars: observation.redStars }),
    ...(observation.level === undefined ? {} : { level: observation.level }),
    ...(observation.reviewRequired === undefined
      ? {}
      : { reviewRequired: observation.reviewRequired }),
    ...(observation.candidates === undefined
      ? {}
      : { candidates: [...observation.candidates] }),
    ...(observation.replacesCanonicalId === undefined
      ? {}
      : { replacesCanonicalId: observation.replacesCanonicalId }),
    ...(observation.heroIds === undefined
      ? {}
      : {
          heroIds:
            observation.heroIds === null ? null : [...observation.heroIds],
        }),
    ...(observation.tacticIds === undefined
      ? {}
      : {
          tacticIds:
            observation.tacticIds === null ? null : [...observation.tacticIds],
        }),
    ...(observation.tacticAssignments === undefined
      ? {}
      : {
          tacticAssignments:
            observation.tacticAssignments === null
              ? null
              : observation.tacticAssignments.map((assignment) => ({
                  holderId: assignment.holderId,
                  tacticId: assignment.tacticId,
                  ...(assignment.slotIndex === undefined
                    ? {}
                    : { slotIndex: assignment.slotIndex }),
                })),
        }),
    trust: "untrusted",
    evidence: {
      sourceScope: observation.evidence.sourceScope,
      batchId: sanitizeLabel(observation.evidence.batchId),
      ...(observation.evidence.imageOrdinal === undefined
        ? {}
        : { imageOrdinal: observation.evidence.imageOrdinal }),
      ...(observation.evidence.fieldPresence === undefined
        ? {}
        : {
            fieldPresence: observation.evidence.fieldPresence
              .map((field) => sanitizeLabel(field))
              .filter(Boolean),
          }),
      trust: "untrusted",
    },
  };
}

export async function normalizeObservations({
  workflowVersion,
  observations,
}: NormalizeObservationsRequest): Promise<NormalizationResult> {
  if (observations.length > MAX_OBSERVATIONS) {
    throw new RangeError(
      `Normalization observations exceed ${MAX_OBSERVATIONS} items`,
    );
  }
  observations.forEach(validateObservation);
  const sanitizedObservations = observations.map(sanitizeObservation);
  const warnings: string[] = [];
  const correctedObservationIds = new Set<string>();
  const replacedCanonicalIds = new Set<CanonicalId>();
  for (const observation of sanitizedObservations) {
    if (observation.evidence.sourceScope !== "manualCorrection") continue;
    correctedObservationIds.add(observation.observationId);
    if (observation.replacesCanonicalId !== undefined) {
      replacedCanonicalIds.add(observation.replacesCanonicalId);
    }
  }
  const active = sanitizedObservations.filter(
    (observation) =>
      observation.evidence.sourceScope === "manualCorrection" ||
      (!correctedObservationIds.has(observation.observationId) &&
        (observation.canonicalId === undefined ||
          !replacedCanonicalIds.has(observation.canonicalId))),
  );
  const observationsById = new Map<string, NormalizationObservation[]>();
  for (const observation of active) {
    const values = observationsById.get(observation.observationId) ?? [];
    values.push(observation);
    observationsById.set(observation.observationId, values);
  }
  const identitySelections = new Map<
    string,
    { priority: number; canonicalIds: Set<CanonicalId> }
  >();
  const identityConflicts = new Map<string, NormalizationObservation[]>();
  for (const [observationId, values] of observationsById) {
    const withCanonicalId = values.filter(
      (observation): observation is NormalizationObservation & {
        canonicalId: CanonicalId;
      } => observation.canonicalId !== undefined,
    );
    const highestPriority = Math.max(
      0,
      ...withCanonicalId.map((observation) => priority(observation)),
    );
    const canonicalIds = new Set(
      withCanonicalId
        .filter((observation) => priority(observation) === highestPriority)
        .map(({ canonicalId }) => canonicalId),
    );
    if (canonicalIds.size > 0) {
      identitySelections.set(observationId, {
        priority: highestPriority,
        canonicalIds,
      });
    }
    if (canonicalIds.size > 1) {
      identityConflicts.set(
        observationId,
        withCanonicalId.filter(
          (observation) => priority(observation) === highestPriority,
        ),
      );
    }
  }
  const processable = active.filter((observation) => {
    if (identityConflicts.has(observation.observationId)) return false;
    const selection = identitySelections.get(observation.observationId);
    if (!selection) return true;
    if (observation.canonicalId) {
      return selection.canonicalIds.has(observation.canonicalId);
    }
    return priority(observation) >= selection.priority;
  });
  const heroGroups = grouped(processable, "hero");
  const tacticGroups = grouped(processable, "tactic");
  const teamGroups = grouped(processable, "team");
  const conflictingHeroFamilies = new Set<string>();
  for (const [canonicalId, values] of heroGroups) {
    const familyIds = highestPriorityValues(values, "familyId")
      .map(({ observation }) => observation.familyId)
      .filter((familyId): familyId is HeroFamilyId => familyId !== undefined);
    if (new Set(familyIds).size > 1) {
      conflictingHeroFamilies.add(canonicalId);
      warnings.push(`conflicting-familyId:${canonicalId}`);
    }
  }
  const heroes = [...heroGroups.entries()]
    .filter(([canonicalId]) => !conflictingHeroFamilies.has(canonicalId))
    .map(([canonicalId, values]) =>
      canonicalHero(canonicalId as HeroCanonicalId, values, warnings),
    )
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  const tactics = [...tacticGroups.entries()]
    .map(([canonicalId, values]) =>
      canonicalTactic(canonicalId as TacticCanonicalId, values),
    )
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  const unresolved = processable
    .filter((observation) => observation.reviewRequired || !observation.canonicalId)
    .map(unresolvedObservation);
  for (const [observationId, values] of identityConflicts) {
    warnings.push(`conflicting-identity:${observationId}`);
    unresolved.push({
      observationId,
      entityKind: values[0]?.entityKind ?? "hero",
      candidates: values
        .map(({ canonicalId }) => canonicalId)
        .filter((canonicalId): canonicalId is CanonicalId => canonicalId !== undefined),
      reason: "ambiguous",
      trust: "untrusted",
    });
  }
  for (const canonicalId of conflictingHeroFamilies) {
    unresolved.push({
      observationId: `conflict:${canonicalId}:familyId`,
      entityKind: "hero",
      candidates: [canonicalId as HeroCanonicalId],
      reason: "ambiguous",
      trust: "untrusted",
    });
  }
  const lockedTeamResults = [...teamGroups.entries()]
    .map(([canonicalId, values]) =>
      canonicalLockedTeam(canonicalId as TeamCanonicalId, values),
    );
  let lockedTeams = lockedTeamResults
    .filter(({ conflict }) => !conflict)
    .map(({ team }) => team);
  for (const { team, conflict } of lockedTeamResults) {
    if (!conflict) continue;
    warnings.push(`conflicting-locked-team-membership:${team.teamId}`);
    unresolved.push({
      observationId: `conflict:${team.teamId}`,
      entityKind: "team",
      candidates: [team.teamId],
      reason: "ambiguous",
      trust: "untrusted",
    });
  }
  const lockedOwners = new Map<string, Set<TeamCanonicalId>>();
  for (const team of lockedTeams) {
    for (const resourceId of [...team.heroIds, ...team.tacticIds]) {
      const owners = lockedOwners.get(resourceId) ?? new Set<TeamCanonicalId>();
      owners.add(team.teamId);
      lockedOwners.set(resourceId, owners);
    }
  }
  const overlappingTeamIds = new Set<TeamCanonicalId>();
  for (const [resourceId, teamIds] of lockedOwners) {
    if (teamIds.size < 2) continue;
    teamIds.forEach((teamId) => overlappingTeamIds.add(teamId));
    warnings.push(`conflicting-locked-resource:${resourceId}`);
    unresolved.push({
      observationId: `conflict:${resourceId}`,
      entityKind: "team",
      candidates: [...teamIds],
      reason: "ambiguous",
      trust: "untrusted",
    });
  }
  lockedTeams = lockedTeams.filter(
    ({ teamId }) => !overlappingTeamIds.has(teamId),
  );
  const canonicalState: CanonicalState = {
    heroes,
    tactics,
    lockedTeams,
    unresolved,
    warnings,
  };
  const confirmationBinding: ConfirmationBinding = {
    workflowVersion: workflowVersion as WorkflowVersion,
    normalizationDigest: await createNormalizationDigest(canonicalState),
    canonicalProjectionVersion: CANONICAL_PROJECTION_VERSION,
  };
  return {
    canonicalState,
    observations: sanitizedObservations,
    warnings,
    reviewRequired: unresolved.length > 0,
    confirmationBinding,
  };
}

export function requiresConfirmation(_result: NormalizationResult): boolean {
  return true;
}

export async function applyConfirmedCorrections(
  result: NormalizationResult,
  corrections: readonly NormalizationObservation[],
): Promise<NormalizationResult> {
  return normalizeObservations({
    workflowVersion: result.confirmationBinding.workflowVersion,
    observations: [...result.observations, ...corrections],
  });
}
