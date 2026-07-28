import { z } from "zod";

export const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_NORMALIZE_REQUEST_BYTES = 16 * 1024;
const boundedText = z.string().max(256);
const nonEmptyText = z.string().min(1).max(256);
const workflowVersion = z.string().startsWith("workflow:").max(512);
const canonicalId = z.union([
  z.string().startsWith("hero:").max(256),
  z.string().startsWith("tactic:").max(256),
  z.string().startsWith("team:").max(256),
]);
const heroId = z.string().startsWith("hero:").max(256);
const tacticId = z.string().startsWith("tactic:").max(256);
const teamId = z.string().startsWith("team:").max(256);
const familyId = z.string().startsWith("hero-family:").max(256);

function isBoundedJson(
  value: unknown,
  state = { nodes: 0 },
  depth = 0,
): boolean {
  state.nodes += 1;
  if (state.nodes > 500 || depth > 8) return false;
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value === "string") return value.length <= 256;
  if (Array.isArray(value)) {
    return (
      value.length <= 100 &&
      value.every((item) => isBoundedJson(item, state, depth + 1))
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      entries.length <= 100 &&
      entries.every(
        ([key, nested]) =>
          key.length <= 64 && isBoundedJson(nested, state, depth + 1),
      )
    );
  }
  return false;
}

const boundedUnknown = z.unknown().refine((value) => isBoundedJson(value));

function boundedRequest<T extends z.ZodType>(
  schema: T,
  maxBytes = MAX_REQUEST_BYTES,
) {
  return schema.superRefine((value, context) => {
    try {
      if (
        new TextEncoder().encode(JSON.stringify(value)).byteLength >
        maxBytes
      ) {
        context.addIssue({
          code: "custom",
          message: "request exceeds byte limit",
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: "request is not serializable",
      });
    }
  });
}

export const confirmationBindingSchema = z
  .object({
    workflowVersion,
    normalizationDigest: z.string().startsWith("sha256:").max(80),
    canonicalProjectionVersion: z.string().startsWith("projection:").max(64),
  })
  .strict();

const evidenceSchema = z
  .object({
    sourceScope: z.enum([
      "currentTurnImage",
      "priorConfirmedNote",
      "manualCorrection",
    ]),
    batchId: nonEmptyText,
    imageOrdinal: z.number().int().nonnegative().optional(),
    fieldPresence: z.array(nonEmptyText).max(20).optional(),
    trust: z.literal("untrusted").optional(),
  })
  .strict();

export const structuredObservationSchema = z
  .object({
    observationId: nonEmptyText,
    entityKind: z.enum(["hero", "tactic", "team"]),
    observedText: boundedText.optional(),
    canonicalId: canonicalId.optional(),
    familyId: familyId.optional(),
    displayName: boundedText.optional(),
    redStars: z.number().finite().nullable().optional(),
    level: z.number().finite().nullable().optional(),
    reviewRequired: z.boolean().optional(),
    candidates: z.array(canonicalId).max(20).optional(),
    replacesCanonicalId: canonicalId.optional(),
    heroIds: z.array(heroId).max(20).nullable().optional(),
    tacticIds: z.array(tacticId).max(60).nullable().optional(),
    tacticAssignments: z
      .array(
        z
          .object({
            holderId: heroId,
            tacticId,
            slotIndex: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .max(60)
      .nullable()
      .optional(),
    trust: z.literal("untrusted").optional(),
    evidence: evidenceSchema,
  })
  .strict();

const canonicalHeroSchema = z
  .object({
    canonicalId: heroId,
    familyId,
    displayName: boundedText,
    redStars: z.number().finite().optional(),
    level: z.number().finite().optional(),
    confidence: boundedText.optional(),
    evidence: z.array(boundedUnknown).max(100).optional(),
  })
  .strict();

const canonicalTacticSchema = z
  .object({
    canonicalId: tacticId,
    displayName: boundedText,
    confidence: boundedText.optional(),
    evidence: z.array(boundedUnknown).max(100).optional(),
  })
  .strict();

const canonicalLockedTeamSchema = z
  .object({
    teamId,
    heroIds: z.array(heroId).max(20),
    tacticIds: z.array(tacticId).max(60),
    tacticAssignments: z
      .array(
        z
          .object({
            holderId: heroId,
            tacticId,
            slotIndex: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .max(60)
      .optional(),
  })
  .strict();

export const canonicalStateSchema = z
  .object({
    heroes: z.array(canonicalHeroSchema).max(500),
    tactics: z.array(canonicalTacticSchema).max(1_000),
    lockedTeams: z.array(canonicalLockedTeamSchema).max(10),
    unresolved: z.array(boundedUnknown).max(500).optional(),
    warnings: z.array(boundedText).max(100).optional(),
  })
  .strict();

const provenanceSchema = z
  .object({
    artifact: z.enum([
      "teams",
      "team-tier",
      "coexist",
      "heroes-dict",
      "tactics",
      "books-dict",
      "canonical-state",
    ]),
    recordId: boundedText.optional(),
    source: boundedText.optional(),
    updatedAt: boundedText.optional(),
    trust: z.literal("untrusted").optional(),
  })
  .strict();

const commonResultSchema = z.object({
  releaseId: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  dataVersion: z.string().regex(/^data:[a-f0-9]{12}$/u),
  workflowVersion,
  provenance: z.array(provenanceSchema).max(100),
  warnings: z.array(boundedText).max(100),
  truncated: z.boolean(),
  nextCursor: z.string().max(2_048).optional(),
});

const normalizeInputSchema = z
  .object({
    observations: z.array(structuredObservationSchema).max(100),
  })
  .strict();

const expectedWorkflowSchema = z.object({
  expectedWorkflowVersion: workflowVersion.optional(),
});

const requiredWorkflowSchema = z.object({
  expectedWorkflowVersion: workflowVersion,
});

const recommendationInputSchema = z
  .object({
    expectedWorkflowVersion: workflowVersion,
    canonicalState: canonicalStateSchema,
    confirmationBinding: confirmationBindingSchema,
    maxTeams: z.number().int().min(1).max(10).optional(),
    experimentalUntiered: z.boolean().optional(),
  })
  .strict();

const recordSchema = z.record(z.string(), z.unknown());

const versionOutputSchema = commonResultSchema.extend({
  artifacts: z
    .array(
      z
        .object({
          name: z.enum([
            "teams",
            "team-tier",
            "coexist",
            "heroes-dict",
            "tactics",
            "books-dict",
          ]),
          key: nonEmptyText,
          sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
          byteLength: z.number().int().nonnegative(),
          count: z.number().int().nonnegative(),
        })
        .strict(),
    )
    .length(6),
});

const normalizeOutputSchema = commonResultSchema.extend({
  canonicalState: canonicalStateSchema,
  observations: z.array(structuredObservationSchema).max(500),
  reviewRequired: z.boolean(),
  confirmationBinding: confirmationBindingSchema,
});

const searchInputSchema = expectedWorkflowSchema
  .extend({
    query: z.string().max(256),
    kinds: z
      .array(z.enum(["hero", "tactic", "team", "book"]))
      .max(4)
      .optional(),
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().max(2_048).optional(),
  })
  .strict();

const searchOutputSchema = commonResultSchema.extend({
  items: z
    .array(
      z
        .object({
          kind: z.enum(["hero", "tactic", "team", "book"]),
          canonicalId: nonEmptyText,
          recordId: nonEmptyText,
          displayName: boundedText,
          artifact: z.enum([
            "teams",
            "heroes-dict",
            "tactics",
            "books-dict",
          ]),
          trust: z.literal("untrusted"),
        })
        .strict(),
    )
    .max(50),
});

const teamInputSchema = requiredWorkflowSchema
  .extend({ teamId: nonEmptyText })
  .strict();

const teamOutputSchema = commonResultSchema.extend({
  team: recordSchema,
  tierRankings: z.array(recordSchema).max(20),
});

const matchInputSchema = requiredWorkflowSchema
  .extend({
    heroes: z
      .array(
        z
          .object({
            canonicalId: heroId,
            tacticIds: z.array(tacticId).max(20),
          })
          .strict(),
      )
      .max(20),
    minHeroes: z.number().int().min(1).max(3).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();

const recommendationOutputSchema = commonResultSchema.extend({
  teams: z.array(recordSchema).max(10),
  diagnostics: z.unknown(),
});

const matchOutputSchema = commonResultSchema.extend({
  matches: z
    .array(
      z
        .object({
          team: recordSchema,
          heroHit: z.number().int().nonnegative(),
          tacticHit: z.number().int().nonnegative(),
          total: z.number().int().nonnegative(),
        })
        .strict(),
    )
    .max(20),
});

const coexistOutputSchema = recommendationOutputSchema.extend({
  coexistReference: z.array(recordSchema).max(50),
});

const replacementInputSchema = recommendationInputSchema
  .extend({
    teamId: nonEmptyText,
    tacticName: nonEmptyText,
  })
  .strict();

const replacementOutputSchema = commonResultSchema.extend({
  teamId: nonEmptyText,
  tacticName: boundedText,
  replacements: z.array(boundedText).max(20),
});

export const RESEARCH_TOOL_NAMES = [
  "tqccl_get_data_version",
  "tqccl_normalize_entities",
  "tqccl_search",
  "tqccl_get_team",
  "tqccl_match_team",
  "tqccl_recommend_team",
  "tqccl_recommend_coexist",
  "tqccl_suggest_replacements",
] as const;

export type ResearchToolName = (typeof RESEARCH_TOOL_NAMES)[number];

export const RESEARCH_CONTRACTS = {
  tqccl_get_data_version: {
    input: boundedRequest(z.object({}).strict()),
    output: versionOutputSchema,
  },
  tqccl_normalize_entities: {
    input: boundedRequest(normalizeInputSchema, MAX_NORMALIZE_REQUEST_BYTES),
    output: normalizeOutputSchema,
  },
  tqccl_search: {
    input: boundedRequest(searchInputSchema),
    output: searchOutputSchema,
  },
  tqccl_get_team: {
    input: boundedRequest(teamInputSchema),
    output: teamOutputSchema,
  },
  tqccl_match_team: {
    input: boundedRequest(matchInputSchema),
    output: matchOutputSchema,
  },
  tqccl_recommend_team: {
    input: boundedRequest(recommendationInputSchema),
    output: recommendationOutputSchema,
  },
  tqccl_recommend_coexist: {
    input: boundedRequest(recommendationInputSchema),
    output: coexistOutputSchema,
  },
  tqccl_suggest_replacements: {
    input: boundedRequest(replacementInputSchema),
    output: replacementOutputSchema,
  },
} as const;

export type ResearchInput<Name extends ResearchToolName> = z.input<
  (typeof RESEARCH_CONTRACTS)[Name]["input"]
>;

export type ResearchOutput<Name extends ResearchToolName> = z.output<
  (typeof RESEARCH_CONTRACTS)[Name]["output"]
>;
