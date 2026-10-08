import { z } from "zod";

import { buildSeasonCandidates } from "../../../js/roster-season-candidates.js";
import { KNOWLEDGE_BUNDLE, KNOWLEDGE_VERSION } from "../generated/knowledge-bundle.js";
import { resolvePlaybookKnowledge } from "../knowledge/resolve-playbook.js";
import {
  CONTEXT_FIELD_NAMES,
  KNOWLEDGE_TOOL_NAMES,
  KnowledgeError,
  WORKFLOW_IDS,
  type KnowledgeContext,
} from "../knowledge/rule-contracts.js";
import { PUBLIC_ERRORS, ResearchHandlerError, type ResearchErrorCode } from "./handler-error.js";
import { boundedText, commonResultSchema, workflowVersionSchema } from "./shared-schemas.js";
import { parseToolInput, type ToolContext } from "./tool-context.js";

const MAX_SEASON_OPTIONS = 64;
/** Cận output theo dataset: không bao giờ thấp hơn số rule thật nên không thể thành INTERNAL_ERROR khi parse. */
const MAX_REQUIRED_RULES = Math.max(64, KNOWLEDGE_BUNDLE.rules.filter((rule) => rule.kind === "invariant").length);
const MAX_GUIDANCE_RULES = Math.max(128, KNOWLEDGE_BUNDLE.rules.length);

/**
 * Context phẳng, không anyOf: fact vắng = chưa biết; tên trong `knownEmpty` = đã biết là trống (null trong knowledge core).
 */
const contextInputSchema = z
  .object({
    seasonal: z.boolean().optional().describe("Yêu cầu có tính theo mùa không."),
    configChanged: z.boolean().optional().describe("Cấu hình đội gốc đã bị đổi ô chưa."),
    rosterKnown: z.boolean().optional().describe("Kho của người dùng đã biết và rà soát chưa."),
    requireAvailable: z.boolean().optional().describe("Chỉ muốn đội xây được từ kho hiện có."),
    region: z.enum(["cn", "global", "vn"]).optional().describe("Server/khu vực áp dụng; bỏ trống = chưa biết."),
    locale: z.enum(["vi", "zh"]).optional().describe("Ngôn ngữ hiển thị."),
    ruleset: z.string().min(1).max(64).optional().describe("ID ruleset đã review."),
    sourceSeasonId: z.string().min(1).max(64).optional().describe("Mùa nguồn; mặc định lấy từ seasonSelection đã resolve."),
    externalCallsRemaining: z.number().int().min(0).max(1_000_000).optional().describe("Số lượt gọi ngoài còn lại."),
    knownEmpty: z
      .array(z.enum(CONTEXT_FIELD_NAMES))
      .max(9)
      .optional()
      .describe("Tên fact đã biết là trống (khác chưa biết)."),
  })
  .strict();

function toKnowledgeContext(context: z.infer<typeof contextInputSchema> | undefined): KnowledgeContext {
  if (context === undefined) return {};
  const { knownEmpty, ...facts } = context;
  const nulls = Object.fromEntries((knownEmpty ?? []).filter((name) => (facts as Record<string, unknown>)[name] === undefined).map((name) => [name, null]));
  return { ...nulls, ...facts } as KnowledgeContext;
}

export const getPlaybookInputSchema = z
  .object({
    intent: z.enum(WORKFLOW_IDS).describe("lookup = tra cứu; coexist = ghép đội từ kho; research = kiểm chứng cơ chế/meta."),
    stage: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/u).optional().describe("Giai đoạn trong workflow; bỏ trống để lấy mọi giai đoạn."),
    context: contextInputSchema.optional().describe("Fact đã biết; vắng = chưa biết, knownEmpty = đã biết là trống."),
    seasonSelection: z
      .object({
        mode: z.enum(["explicit", "session", "profile"]).describe("Nguồn lựa chọn mùa của consumer."),
        sourceSeasonId: z.string().min(1).max(128).describe("Mùa nguồn user/phiên/profile đã chọn."),
        status: z.enum(["confirmed", "assumed"]).optional().describe("Mặc định: explicit=confirmed; session/profile=assumed."),
      })
      .strict()
      .optional()
      .describe("Mùa nguồn consumer đã chọn; không hợp lệ thì về mặc định và báo lại. Research không gửi thì mùa giữ unknown."),
    locale: z.enum(["vi", "zh"]).optional().describe("Ngôn ngữ hiển thị/link; mặc định vi."),
    expectedKnowledgeVersion: z.string().min(1).max(128).optional().describe("knowledgeVersion client đang giữ."),
    expectedWorkflowVersion: workflowVersionSchema.optional().describe("Nếu gửi, phải khớp workflowVersion hiện hành."),
  })
  .strict();
export type GetPlaybookInput = z.infer<typeof getPlaybookInputSchema>;

const seasonSelectionOutput = z
  .object({
    mode: z.enum(["explicit", "session", "profile", "default"]).describe("Chế độ."),
    sourceSeasonId: boundedText.describe("Mùa nguồn."),
    label: boundedText.describe("Nhãn."),
    resolutionSource: z.enum(["caller", "registry-default", "registry-default-invalid-selection"]).describe("Cách resolve mùa."),
    selectionStatus: z.enum(["confirmed", "assumed"]).describe("confirmed hoặc assumed."),
    dataVersion: boundedText.describe("Nhãn dữ liệu."),
  })
  .strict();

const actionSchema = z
  .object({
    type: z.enum(["require-context", "disallow-claim", "show-warning", "prefer-output-format", "route-workflow"]).describe("Loại hành động."),
    fields: z.array(z.enum(CONTEXT_FIELD_NAMES)).max(8).optional().describe("Fact cần có (require-context)."),
    claim: boundedText.optional().describe("Claim bị cấm (disallow-claim)."),
    code: boundedText.optional().describe("Mã cảnh báo (show-warning)."),
    outputKey: boundedText.optional().describe("Khóa đầu ra (prefer-output-format)."),
    format: boundedText.optional().describe("Định dạng ưu tiên (prefer-output-format)."),
    workflow: z.enum(WORKFLOW_IDS).optional().describe("Workflow chuyển sang (route-workflow)."),
  })
  .strict();

const workflowOutputSchema = z
  .object({
    id: z.enum(WORKFLOW_IDS).describe("ID workflow."),
    title: boundedText.describe("Tên workflow."),
    summary: z.string().max(600).describe("Tóm tắt workflow."),
    stages: z
      .array(
        z
          .object({
            id: boundedText.describe("ID giai đoạn."),
            title: boundedText.describe("Tên giai đoạn."),
            goal: z.string().max(400).describe("Mục tiêu giai đoạn."),
          })
          .strict(),
      )
      .max(12)
      .describe("Các giai đoạn."),
    handoffs: z
      .array(
        z
          .object({
            to: z.enum(WORKFLOW_IDS).describe("Workflow nhận bàn giao."),
            when: z.string().max(300).describe("Khi nào bàn giao."),
            returnTo: z.enum(WORKFLOW_IDS).describe("Workflow quay về."),
          })
          .strict(),
      )
      .max(6)
      .describe("Bàn giao giữa workflow."),
  })
  .strict()
  .describe("Thẻ workflow.");

const publicRuleSchema = z
  .object({
    ruleId: boundedText.describe("ID rule."),
    revision: z.number().int().describe("Bản sửa."),
    kind: z.enum(["invariant", "guidance", "preference"]).describe("Loại rule."),
    stage: boundedText.nullable().describe("Giai đoạn."),
    title: z.string().max(120).describe("Tiêu đề."),
    explanation: z.string().max(1500).describe("Giải thích."),
    action: actionSchema.describe("Hành động rule."),
    sourceRefs: z.array(z.string().max(200)).max(8).describe("Nguồn của rule."),
  })
  .strict();

export const getPlaybookOutputSchema = commonResultSchema
  .extend({
    knowledgeVersion: boundedText.describe("Phiên bản bộ luật."),
    intent: z.enum(WORKFLOW_IDS).describe("Intent đã giải."),
    stage: boundedText.nullable().describe("Giai đoạn."),
    locale: z.enum(["vi", "zh"]).describe("Ngôn ngữ."),
    manifestVersion: z.number().int().describe("Phiên bản manifest."),
    capabilities: z
      .object({
        catalog: z.boolean().describe("Có tra cứu catalog."),
        reference: z.boolean().describe("Có đọc đội tham khảo."),
        recommend: z.boolean().describe("Có ghép đội."),
        locale: z.boolean().describe("Có hỗ trợ locale vi/zh."),
        collections: z.array(boundedText).max(8).describe("Collection đội tham khảo có sẵn."),
      })
      .strict()
      .describe("Khả năng của release; false trên v1/v2."),
    seasonSelection: seasonSelectionOutput.nullable().describe("null khi mùa chưa biết (research không gửi seasonSelection) hoặc release không có registry mùa."),
    rulesetResolution: z
      .object({
        status: z.enum(["resolved", "unresolved"]).describe("Trạng thái."),
        scenarioId: boundedText.nullable().describe("ID kịch bản."),
        rulesetId: boundedText.nullable().describe("ID ruleset."),
        reason: boundedText.describe("Lý do."),
        scenarios: z
          .array(
            z
              .object({
                scenarioId: boundedText.describe("ID kịch bản."),
                label: boundedText.describe("Nhãn."),
                rulesets: z.array(z.object({ rulesetId: boundedText.describe("ID ruleset."), label: boundedText.describe("Nhãn ruleset.") }).strict()).max(16).describe("Ruleset đã review."),
              })
              .strict(),
          )
          .max(16)
          .describe("Kịch bản đã review."),
      })
      .strict()
      .describe("Ruleset đã resolve hoặc unresolved; không suy từ nhãn mùa."),
    readiness: z
      .object({
        referenceAvailable: z.boolean().describe("Có dữ liệu tham khảo."),
        referenceFitReady: z.boolean().describe("Mùa có đội để ghép theo kho."),
        rulesetScoringReady: z.boolean().describe("Có ruleset đã review để chấm."),
        missingRequirements: z.array(boundedText).max(8).describe("Điều kiện còn thiếu."),
        warnings: z.array(boundedText).max(16).describe("Cảnh báo."),
      })
      .strict()
      .describe("Mức sẵn sàng ghép theo nguồn và chấm theo luật."),
    registry: z
      .object({
        defaultSourceSeasonId: boundedText.describe("Mùa mặc định của publish."),
        seasonOptions: z
          .array(
            z
              .object({
                sourceSeasonId: boundedText.describe("Mùa nguồn."),
                label: boundedText.describe("Nhãn."),
                displayNameVi: boundedText.describe("Tên Việt."),
                displayCode: boundedText.describe("Mã mùa."),
                status: boundedText.describe("Trạng thái."),
              })
              .strict(),
          )
          .max(MAX_SEASON_OPTIONS)
          .describe("Các mùa nguồn có thể chọn."),
        omittedSeasonOptions: z.number().int().nonnegative().describe("Số mùa bị bỏ."),
      })
      .strict()
      .nullable()
      .describe("Danh sách mùa nguồn rút gọn; null khi release không có registry."),
    workflow: workflowOutputSchema,
    requiredRules: z.array(publicRuleSchema.extend({ conditionStatus: z.enum(["met", "unresolved"]).describe("met = điều kiện đúng hoặc không có; unresolved = còn fact chưa biết.") }).strict()).max(MAX_REQUIRED_RULES).describe("Invariant bắt buộc."),
    guidance: z.array(publicRuleSchema).max(MAX_GUIDANCE_RULES).describe("Guidance của workflow/stage."),
    guidanceCount: z.number().int().nonnegative().describe("Số guidance trả về."),
    guidanceBytes: z.number().int().nonnegative().describe("Kích thước guidance."),
    guidanceTruncated: z.boolean().describe("Guidance đã bị cắt đuôi."),
    guidanceOmittedCount: z.number().int().nonnegative().describe("Số guidance bị bỏ."),
    unresolvedConditions: z
      .array(
        z
          .object({
            ruleId: boundedText.describe("ID rule chưa đủ fact."),
            kind: z.enum(["invariant", "guidance", "preference"]).describe("Loại rule."),
            missing: z.array(boundedText).max(16).describe("Fact còn thiếu."),
          })
          .strict(),
      )
      .max(MAX_GUIDANCE_RULES)
      .describe("Rule chưa đánh giá được vì thiếu fact."),
    nextTools: z
      .array(
        z
          .object({
            stage: boundedText.describe("Giai đoạn."),
            tool: z.enum(KNOWLEDGE_TOOL_NAMES).describe("Tên tool."),
            purpose: z.string().max(300).describe("Mục đích gọi."),
          })
          .strict(),
      )
      .max(24)
      .describe("Tool nên gọi tiếp (chỉ tool đã đăng ký và có khả năng trên release)."),
    outputChecklist: z.array(z.string().max(300)).max(24).describe("Checklist đầu ra."),
    errorRecovery: z
      .array(z.object({ code: boundedText.describe("Mã lỗi."), action: z.string().max(400).describe("Cách xử lý.") }).strict())
      .max(24)
      .describe("Cách xử lý từng mã lỗi."),
  })
  .strict();
export type GetPlaybookOutput = z.infer<typeof getPlaybookOutputSchema>;

interface ScenarioRow {
  scenarioId: string;
  label: string;
  rulesets: Array<{ rulesetId: string; label: string }>;
}

function reviewedScenarios(ctx: ToolContext): ScenarioRow[] {
  const rows = ctx.snapshot.artifacts["season-registry"] ?? [];
  return rows
    .filter((row) => row.reviewStatus === "reviewed")
    .map((row) => ({
      scenarioId: String(row.id).slice(0, 256),
      label: String(row.labelVi ?? row.id).slice(0, 256),
      rulesets: (Array.isArray(row.rulesets) ? (row.rulesets as Array<Record<string, unknown>>) : [])
        .filter((rule) => rule.reviewStatus === "reviewed")
        .map((rule) => ({ rulesetId: String(rule.id).slice(0, 256), label: String(rule.label ?? rule.id).slice(0, 256) })),
    }));
}

const KNOWLEDGE_ERROR_MAP: Record<string, ResearchErrorCode> = {
  KNOWLEDGE_VERSION_CHANGED: "KNOWLEDGE_VERSION_CHANGED",
  KNOWLEDGE_UNAVAILABLE: "KNOWLEDGE_UNAVAILABLE",
  PLAYBOOK_NOT_FOUND: "PLAYBOOK_NOT_FOUND",
  INVALID_REQUEST: "INVALID_REQUEST",
  RULE_SCOPE_INVALID: "INVALID_REQUEST",
};

function mapKnowledgeError(error: unknown): never {
  if (error instanceof KnowledgeError) {
    // Required không vừa ngân sách kết quả: người gọi phải chia nhỏ bằng `stage`, không phải lỗi nội bộ.
    if (error.code === "RULE_SCOPE_INVALID" && error.details["reason"] === "required-overflow") {
      throw new ResearchHandlerError("RESULT_TOO_LARGE", `${PUBLIC_ERRORS.RESULT_TOO_LARGE.message} Gửi \`stage\` để chia nhỏ playbook.`);
    }
    const code = KNOWLEDGE_ERROR_MAP[error.code] ?? "INTERNAL_ERROR";
    throw new ResearchHandlerError(code, PUBLIC_ERRORS[code].message, code === "KNOWLEDGE_VERSION_CHANGED");
  }
  throw error;
}

export async function handleGetPlaybook(ctx: ToolContext, rawInput: unknown): Promise<GetPlaybookOutput> {
  const input = parseToolInput(getPlaybookInputSchema, rawInput);
  ctx.ensureExpectedWorkflow(input.expectedWorkflowVersion);

  const publication = ctx.snapshot.publication;
  const warnings = [...ctx.snapshot.warnings];
  const missing: string[] = [];
  const readinessWarnings: string[] = [];

  // Mùa nguồn: caller → mặc định của registry; id lạ → mặc định + báo (như website).
  let seasonSelection: z.infer<typeof seasonSelectionOutput> | null = null;
  let registry: GetPlaybookOutput["registry"] = null;
  let referenceFitReady = false;
  if (publication === undefined) {
    missing.push("publication-v3");
  } else {
    const seasons = publication.seasons;
    const label = (id: string) => seasons.seasonOptions.find((option) => option.sourceSeasonId === id)?.label ?? id;
    const valid = (id: string) => seasons.seasonOptions.some((option) => option.sourceSeasonId === id);
    const requested = input.seasonSelection;
    if (requested !== undefined && valid(requested.sourceSeasonId)) {
      seasonSelection = {
        mode: requested.mode,
        sourceSeasonId: requested.sourceSeasonId,
        label: label(requested.sourceSeasonId),
        resolutionSource: "caller",
        selectionStatus: requested.status ?? (requested.mode === "explicit" ? "confirmed" : "assumed"),
        dataVersion: ctx.dataVersion,
      };
    } else if (requested !== undefined || input.intent !== "research") {
      if (requested !== undefined) readinessWarnings.push("season-selection-invalid-using-default");
      seasonSelection = {
        mode: "default",
        sourceSeasonId: seasons.defaultSourceSeasonId,
        label: label(seasons.defaultSourceSeasonId),
        resolutionSource: requested === undefined ? "registry-default" : "registry-default-invalid-selection",
        selectionStatus: "assumed",
        dataVersion: ctx.dataVersion,
      };
    } else {
      readinessWarnings.push("season-unknown-research-without-selection");
    }
    const shown = seasons.seasonOptions.slice(0, MAX_SEASON_OPTIONS);
    registry = {
      defaultSourceSeasonId: seasons.defaultSourceSeasonId,
      seasonOptions: shown.map((option) => ({
        sourceSeasonId: option.sourceSeasonId,
        label: option.label,
        displayNameVi: option.displayNameVi,
        displayCode: option.displayCode,
        status: option.status,
      })),
      omittedSeasonOptions: seasons.seasonOptions.length - shown.length,
    };
    if (seasonSelection === null) {
      if (input.intent !== "research") missing.push("source-season");
    } else {
      const built = buildSeasonCandidates(
        publication.recommendSourceRecords(seasonSelection.sourceSeasonId) as never,
        seasonSelection.sourceSeasonId,
        { heroesDict: ctx.snapshot.artifacts["heroes-dict"] as never, tacticsDict: ctx.snapshot.artifacts.tactics as never },
      ) as { teams: unknown[] };
      referenceFitReady = built.teams.length > 0;
      if (!referenceFitReady) missing.push("season-source-teams");
    }
  }

  // Ruleset: chỉ resolved khi caller nêu một ruleset đã review; không suy từ nhãn mùa.
  const scenarios = reviewedScenarios(ctx);
  const wantedRuleset = input.context?.ruleset ?? null;
  const baseContext = toKnowledgeContext(input.context);
  let ruleset: GetPlaybookOutput["rulesetResolution"] = {
    status: "unresolved",
    scenarioId: null,
    rulesetId: null,
    reason: scenarios.some((scenario) => scenario.rulesets.length > 0)
      ? "no-ruleset-selected"
      : "no-reviewed-rulesets",
    scenarios,
  };
  if (wantedRuleset !== null) {
    const scenario = scenarios.find((entry) => entry.rulesets.some((rule) => rule.rulesetId === wantedRuleset));
    if (scenario !== undefined) {
      ruleset = { status: "resolved", scenarioId: scenario.scenarioId, rulesetId: wantedRuleset, reason: "reviewed-ruleset", scenarios };
    } else {
      ruleset = { ...ruleset, reason: "ruleset-not-reviewed" };
    }
  }
  const rulesetScoringReady = ruleset.status === "resolved";
  if (!rulesetScoringReady) missing.push("reviewed-ruleset");

  const knowledgeContext: KnowledgeContext = {
    ...baseContext,
    // Mùa mặc định/giả định không phải fact đã xác nhận: để unknown thay vì làm điều kiện rule thành "true/false".
    ...(baseContext.sourceSeasonId === undefined && seasonSelection?.selectionStatus === "confirmed"
      ? { sourceSeasonId: seasonSelection.sourceSeasonId }
      : {}),
    ...(baseContext.locale === undefined && input.locale !== undefined ? { locale: input.locale } : {}),
  };
  const available = new Set<string>(KNOWLEDGE_TOOL_NAMES);
  if (publication === undefined) {
    // v1/v2: chỉ collection engine dùng được; tool catalog/reference/recommend v3 thì không.
    for (const name of ["tqccl_search", "tqccl_get_entity", "tqccl_recommend_teams"]) available.delete(name);
  }
  const collections = publication?.seasons.collections.map((collection) => collection.id) ?? ["engine"];

  const head = {
    ...ctx.commonResult([{ artifact: "knowledge" }, ...(publication === undefined ? [] : [{ artifact: "reference-registry" }])]),
    warnings,
    manifestVersion: ctx.snapshot.manifest.schemaVersion,
    locale: input.locale ?? "vi",
    capabilities: {
      catalog: publication !== undefined,
      reference: publication !== undefined,
      recommend: publication !== undefined,
      locale: publication !== undefined,
      collections,
    },
    seasonSelection,
    rulesetResolution: ruleset,
    readiness: {
      referenceAvailable: publication !== undefined && publication.seasons.seasonOptions.length > 0,
      referenceFitReady,
      rulesetScoringReady,
      missingRequirements: missing,
      warnings: readinessWarnings,
    },
    registry,
  };
  // Phần ngoài playbook đã dùng bao nhiêu ký tự của trần 40.000; playbook chỉ được dùng phần còn lại.
  const reservedChars = JSON.stringify(head).length;

  let knowledge;
  try {
    knowledge = resolvePlaybookKnowledge(
      {
        intent: input.intent,
        ...(input.stage === undefined ? {} : { stage: input.stage }),
        context: knowledgeContext,
        ...(input.expectedKnowledgeVersion === undefined ? {} : { expectedKnowledgeVersion: input.expectedKnowledgeVersion }),
      },
      { reservedChars },
    );
  } catch (error) {
    mapKnowledgeError(error);
  }

  return {
    ...head,
    knowledgeVersion: knowledge.knowledgeVersion ?? KNOWLEDGE_VERSION,
    intent: input.intent,
    stage: knowledge.stage,
    workflow: knowledge.workflow,
    requiredRules: knowledge.requiredRules,
    guidance: knowledge.guidance,
    guidanceCount: knowledge.guidanceCount,
    guidanceBytes: knowledge.guidanceBytes,
    guidanceTruncated: knowledge.guidanceTruncated,
    guidanceOmittedCount: knowledge.guidanceOmittedCount,
    unresolvedConditions: knowledge.unresolvedConditions,
    nextTools: knowledge.nextTools.filter((entry) => available.has(entry.tool)),
    outputChecklist: knowledge.outputChecklist,
    errorRecovery: knowledge.errorRecovery,
  } as GetPlaybookOutput;
}
