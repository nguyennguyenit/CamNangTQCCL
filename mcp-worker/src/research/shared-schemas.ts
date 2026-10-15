import { z } from "zod";
export const seasonId = z.string().min(1).max(128).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u).describe("ID ổn định.");
export const seasonContextSchema = z.object({scenarioId:seasonId,rulesetId:seasonId}).strict().describe("Cặp ID đã xác minh.");

export const MAX_REQUEST_BYTES = 256 * 1024;
export const MAX_NORMALIZE_REQUEST_BYTES = 16 * 1024;
export const boundedText = z
  .string()
  .max(256)
  .describe("Văn bản.");
export const nonEmptyText = z
  .string()
  .min(1)
  .max(256)
  .describe("Bắt buộc.");
export const workflowVersion = z
  .string()
  .startsWith("workflow:")
  .max(512)
  .describe(
    "Giữ nguyên workflowVersion.",
  );
export const canonicalId = z
  .string()
  .max(256)
  .regex(/^(hero|tactic|team):/u)
  .describe("ID hero:, tactic: hoặc team:.");
export const heroId = z
  .string()
  .startsWith("hero:")
  .max(256)
  .describe("ID tướng hero:.");
export const tacticId = z
  .string()
  .startsWith("tactic:")
  .max(256)
  .describe("ID chiến pháp tactic:.");
export const teamId = z
  .string()
  .startsWith("team:")
  .max(256)
  .describe("ID đội team:.");
export const familyId = z
  .string()
  .startsWith("hero-family:")
  .max(256)
  .describe("ID nhóm biến thể hero-family:.");

export function isBoundedJson(
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

export const boundedUnknown = z
  .unknown()
  .refine((value) => isBoundedJson(value))
  .describe("JSON bounded.");

/**
 * Model đôi khi serialize mảng thành chuỗi JSON trước khi gửi tool call — cùng
 * một model, cùng một tool, không tất định. Parse lại ở biên rồi giao cho schema
 * chặt bên trong, nên input rác vẫn bị từ chối thay vì bị nuốt thành mảng rỗng.
 *
 * Chỉ áp ở nơi đã quan sát được lỗi thật; xem ghi chú tại các schema khác.
 */
export function jsonArrayish<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      // Trả nguyên chuỗi để schema bên trong báo lỗi kiểu, không nuốt lỗi.
      return value;
    }
  }, inner);
}

/**
 * Cùng lý do với {@link jsonArrayish} cho số. Không dùng `z.coerce.number()`:
 * nó nhận cả `true`, `["3"]`, `"0x10"` và `"1e1"`, biến input rác thành kết quả
 * hợp lệ trông có vẻ đúng thay vì một lỗi rõ ràng mà agent có thể sửa.
 */
/**
 * `inner | null` mà JSON Schema công bố là `type: [<kiểu>, "null"]` thay vì `anyOf`:
 * schema đầu vào không được có `anyOf`/`oneOf` (mất ở `mcp-go`, OpenAI strict từ chối).
 * Validate bằng chính `inner`; kết quả parse giữ nguyên giá trị đã hợp lệ.
 */
export function nullableFlat<T extends z.ZodType>(inner: T, description: string) {
  const published = z.toJSONSchema(inner, { target: "draft-7" }) as Record<string, unknown>;
  const { $schema: _ignored, ...shape } = published;
  return z
    .any()
    .refine((value) => value === null || inner.safeParse(value).success)
    .meta({ ...shape, type: [shape.type as string, "null"], description });
}

export function decimalNumberish<T extends z.ZodType>(inner: T) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : value,
    inner,
  );
}

export function boundedRequest<T extends z.ZodType>(
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
    normalizationDigest: z
      .string()
      .startsWith("sha256b64:")
      .max(80)
      .describe(
        "Giữ nguyên digest normalize.",
      ),
    canonicalProjectionVersion: z
      .string()
      .startsWith("projection:")
      .max(64)
      .describe("Phiên bản phép chiếu."),
  })
  .strict()
  .describe(
    "Binding đã rà soát.",
  );

export const tacticAssignmentSchema = z
  .object({
    holderId: heroId,
    tacticId,
    slotIndex: z.number().int().nonnegative().optional().describe("Slot trên holder, bắt đầu 0."),
  })
  .strict();

export const evidenceSchema = z
  .object({
    sourceScope: z
      .enum([
        "currentTurnImage",
        "priorConfirmedNote",
        "manualCorrection",
      ])
      .describe("Phạm vi bằng chứng."),
    batchId: nonEmptyText.describe(
      "ID batch bằng chứng.",
    ),
    imageOrdinal: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Thứ tự ảnh, bắt đầu 0."),
    fieldPresence: z
      .array(nonEmptyText)
      .max(20)
      .optional()
      .describe("Tên field đã quan sát."),
    trust: z
      .literal("untrusted")
      .optional()
      .describe(
        "Nguồn untrusted.",
      ),
  })
  .strict()
  .describe("Nguồn observation.");

export const structuredObservationSchema = z
  .object({
    observationId: nonEmptyText.describe(
      "ID observation duy nhất.",
    ),
    entityKind: z
      .enum(["hero", "tactic", "team"])
      .describe("Loại thực thể."),
    observedText: boundedText
      .optional()
      .describe("Văn bản nguồn."),
    canonicalId: canonicalId.optional(),
    familyId: familyId.optional(),
    displayName: boundedText
      .optional()
      .describe("Tên quan sát được."),
    redStars: nullableFlat(z.number().finite(), "Sao đỏ; null nếu không đọc được.").optional(),
    level: nullableFlat(z.number().finite(), "Cấp độ; null nếu không đọc được.").optional(),
    reviewRequired: z
      .boolean()
      .optional()
      .describe("Cần xác nhận ambiguity."),
    candidates: z
      .array(canonicalId)
      .max(20)
      .optional()
      .describe("ID ứng viên còn mơ hồ."),
    replacesCanonicalId: canonicalId
      .optional()
      .describe("ID bị thay bởi correction."),
    heroIds: nullableFlat(z.array(heroId).max(20), "ID tướng đã quan sát.").optional(),
    tacticIds: nullableFlat(z.array(tacticId).max(60), "ID chiến pháp đã quan sát.").optional(),
    tacticAssignments: nullableFlat(z.array(tacticAssignmentSchema).max(60), "Gán chiến pháp theo holder/slot.").optional(),
    trust: z
      .literal("untrusted")
      .optional()
      .describe("Observation untrusted."),
    evidence: evidenceSchema,
  })
  .strict()
  .describe("Observation để chuẩn hóa.");

export const canonicalHeroSchema = z
  .object({
    canonicalId: heroId,
    familyId,
    displayName: boundedText.describe("Tên tướng canonical."),
    redStars: z
      .number()
      .finite()
      .optional()
      .describe("Sao đỏ đã chuẩn hóa."),
    level: z.number().finite().optional().describe("Cấp đã chuẩn hóa."),
    confidence: boundedText
      .optional()
      .describe("Độ tin cậy identity."),
    evidence: z
      .array(boundedUnknown)
      .max(100)
      .optional()
      .describe("Bằng chứng của tướng."),
  })
  .strict()
  .describe("Tướng đã chuẩn hóa.");

export const canonicalTacticSchema = z
  .object({
    canonicalId: tacticId,
    displayName: boundedText.describe(
      "Tên chiến pháp canonical.",
    ),
    confidence: boundedText
      .optional()
      .describe("Độ tin cậy identity."),
    evidence: z
      .array(boundedUnknown)
      .max(100)
      .optional()
      .describe("Bằng chứng chiến pháp."),
  })
  .strict()
  .describe("Chiến pháp đã chuẩn hóa.");

export const canonicalLockedTeamSchema = z
  .object({
    teamId,
    heroIds: z
      .array(heroId)
      .max(20)
      .describe("Tướng của đội đã khóa."),
    tacticIds: z
      .array(tacticId)
      .max(60)
      .describe("Chiến pháp của đội đã khóa."),
    tacticAssignments: z
      .array(
        z
          .object({
            holderId: heroId,
            tacticId,
            slotIndex: z
              .number()
              .int()
              .nonnegative()
              .optional()
              .describe("Slot trên holder, bắt đầu 0."),
          })
          .strict(),
      )
      .max(60)
      .optional()
      .describe("Chiến pháp theo holder."),
  })
  .strict()
  .describe("Đội đã khóa.");

export const canonicalStateSchema = z
  .object({
    seasonContext: seasonContextSchema.optional(),
    heroes: z
      .array(canonicalHeroSchema)
      .max(500)
      .describe("Danh sách canonical hero hiện có."),
    tactics: z
      .array(canonicalTacticSchema)
      .max(1_000)
      .describe("Danh sách canonical tactic hiện có."),
    lockedTeams: z
      .array(canonicalLockedTeamSchema)
      .max(10)
      .describe("Đội khóa, giữ tài nguyên."),
    unresolved: z
      .array(boundedUnknown)
      .max(500)
      .optional()
      .describe("Observation chưa rõ."),
    warnings: z
      .array(boundedText)
      .max(100)
      .optional()
      .describe("Cảnh báo chuẩn hóa."),
  })
  .strict()
  .describe("State đã chuẩn hóa.");

export const provenanceSchema = z
  .object({
    artifact: z
      .enum([
        "teams",
        "team-tier",
        "coexist",
        "heroes-dict",
        "tactics",
        "books-dict",
        "canonical-state",
        "season-team-configs", "season-team-evaluations", "season-content-links", "season-registry", "season-evidence",
        "catalog-entities", "reference-registry", "reference-team-index", "reference-team-details", "public-routes", "knowledge",
      ])
      .describe("Artifact nguồn."),
    recordId: boundedText
      .optional()
      .describe("ID record nguồn."),
    source: boundedText
      .optional()
      .describe("Tên nguồn."),
    updatedAt: boundedText
      .optional()
      .describe("Ngày cập nhật nguồn."),
    trust: z
      .literal("untrusted")
      .optional()
      .describe("Nguồn untrusted."),
  })
  .strict()
  .describe("Nguồn của kết quả.");

export const commonResultSchema = z.object({
  releaseId: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/u)
    .describe("SHA-256 đầy đủ của release."),
  dataVersion: z
    .string()
    .regex(/^data:[a-f0-9]{12}$/u)
    .describe("Nhãn dữ liệu để hiển thị."),
  workflowVersion,
  provenance: z
    .array(provenanceSchema)
    .max(100)
    .describe("Nguồn dữ liệu kết quả."),
  warnings: z
    .array(boundedText)
    .max(100)
    .describe("Cảnh báo cần hiển thị."),
  truncated: z
    .boolean()
    .describe("Kết quả đã bị cắt."),
  nextCursor: z
    .string()
    .max(2_048)
    .optional()
    .describe("Cursor đọc trang tiếp."),
});

export const workflowVersionSchema = workflowVersion;
