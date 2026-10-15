import {
  GUIDANCE_BYTE_TARGET,
  RESULT_CHAR_BUDGET,
  byteLength,
  fitGuidance,
  loadKnowledge,
  parseInput,
  selectRules,
  toPublicRule,
  toRequiredRule,
} from "./search-rules.js";
import {
  KnowledgeError,
  PlaybookInputSchema,
  type KnowledgeSource,
  type PublicRule,
  type RequiredRule,
  type UnresolvedCondition,
  type WorkflowCard,
  type WorkflowId,
} from "./rule-contracts.js";

export interface PlaybookKnowledge {
  knowledgeVersion: string;
  intent: WorkflowId;
  stage: string | null;
  workflow: Pick<WorkflowCard, "id" | "title" | "summary" | "stages" | "handoffs">;
  /** Mọi invariant active khớp workflow/stage/scope; không bao giờ bị cắt. */
  requiredRules: RequiredRule[];
  /** Toàn bộ guidance của workflow/stage; chỉ cắt đuôi khi vượt ngưỡng kích thước. */
  guidance: PublicRule[];
  guidanceCount: number;
  guidanceBytes: number;
  guidanceTruncated: boolean;
  guidanceOmittedCount: number;
  unresolvedConditions: UnresolvedCondition[];
  nextTools: WorkflowCard["nextTools"];
  outputChecklist: string[];
  errorRecovery: WorkflowCard["errorRecovery"];
}

export interface ResolvePlaybookOptions {
  knowledge?: KnowledgeSource;
  /** Ghi đè ngưỡng guidance (mặc định 16 KiB); chỉ dành cho test/calibration. */
  guidanceByteTarget?: number;
  /**
   * Số ký tự của phần kết quả ngoài playbook (envelope, mùa, registry, readiness...) do tầng tool đo.
   * Required + guidance phải vừa `RESULT_CHAR_BUDGET - reservedChars`.
   */
  reservedChars?: number;
}

/** Đệm cho knowledgeVersion/intent/stage và các trường guidance* (tên field, số đếm) trong output. */
const GUIDANCE_FIELDS_OVERHEAD = 400;

/**
 * Playbook thuần từ dataset knowledge. Chọn mùa và readiness do tầng tool (snapshot) bổ sung.
 * Error: INVALID_REQUEST, KNOWLEDGE_UNAVAILABLE, KNOWLEDGE_VERSION_CHANGED,
 * PLAYBOOK_NOT_FOUND (workflow/stage không có card), RULE_SCOPE_INVALID (required không vừa
 * ngân sách kết quả; details.reason = "required-overflow").
 */
export function resolvePlaybookKnowledge(
  input: unknown,
  options: ResolvePlaybookOptions = {},
): PlaybookKnowledge {
  const request = parseInput(PlaybookInputSchema, input);
  const knowledge = loadKnowledge(options.knowledge, request.expectedKnowledgeVersion);
  const stage = request.stage ?? null;
  const card = knowledge.bundle.workflows.workflows.find((entry) => entry.id === request.intent);
  if (card === undefined) {
    throw new KnowledgeError("PLAYBOOK_NOT_FOUND", `Không có playbook cho "${request.intent}".`, {
      intent: request.intent,
    });
  }
  if (stage !== null && !card.stages.some((entry) => entry.id === stage)) {
    throw new KnowledgeError("PLAYBOOK_NOT_FOUND", `Workflow "${card.id}" không có stage "${stage}".`, {
      intent: card.id,
      stage,
      stages: card.stages.map((entry) => entry.id),
    });
  }

  const selection = selectRules(knowledge.bundle, request.intent, stage, request.context ?? {});
  const requiredRules = selection.required.map(toRequiredRule);
  const workflow = {
    id: card.id,
    title: card.title,
    summary: card.summary,
    stages: card.stages,
    handoffs: card.handoffs,
  };
  const nextTools = stage === null ? card.nextTools : card.nextTools.filter((entry) => entry.stage === stage);
  // Phần không phải guidance: required không được cắt nên nó quyết định guidance còn bao nhiêu chỗ.
  const fixedBytes =
    byteLength({
      workflow,
      requiredRules,
      unresolvedConditions: selection.unresolved,
      nextTools,
      outputChecklist: card.outputChecklist,
      errorRecovery: card.errorRecovery,
    }) + GUIDANCE_FIELDS_OVERHEAD;
  const available = RESULT_CHAR_BUDGET - (options.reservedChars ?? 0) - fixedBytes;
  if (available < 0) {
    throw new KnowledgeError(
      "RULE_SCOPE_INVALID",
      "Required rules vượt ngân sách kết quả; chọn stage hẹp hơn thay vì cắt bớt.",
      { reason: "required-overflow", requiredBytes: byteLength(requiredRules), limit: RESULT_CHAR_BUDGET, stage },
    );
  }
  const allGuidance = selection.candidates.map(toPublicRule);
  const { kept, bytes } = fitGuidance(allGuidance, Math.min(options.guidanceByteTarget ?? GUIDANCE_BYTE_TARGET, available));

  return {
    knowledgeVersion: knowledge.version,
    intent: request.intent,
    stage,
    workflow,
    requiredRules,
    guidance: kept,
    guidanceCount: kept.length,
    guidanceBytes: bytes,
    guidanceTruncated: kept.length < allGuidance.length,
    guidanceOmittedCount: allGuidance.length - kept.length,
    unresolvedConditions: selection.unresolved,
    nextTools,
    outputChecklist: card.outputChecklist,
    errorRecovery: card.errorRecovery,
  };
}
