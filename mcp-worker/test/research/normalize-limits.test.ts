import { describe, expect, it } from "vitest";

import { formatToolResult } from "../../src/mcp/format-result.js";
import { PUBLIC_ERRORS } from "../../src/research/handler-error.js";
import { RESEARCH_CONTRACTS } from "../../src/research/research-contracts.js";
import { MAX_NORMALIZE_OBSERVATIONS, MAX_NORMALIZE_REQUEST_BYTES } from "../../src/research/shared-schemas.js";
import { MAX_RESULT_BYTES, MAX_STRUCTURED_CHARS } from "../../src/research/tool-context.js";
import { ResearchHandlerError } from "../../src/research/research-handlers.js";
import {
  buildAmbiguousExtras,
  buildMixedObservations,
  buildNameObservations,
  buildWorstCaseObservations,
  loadRosterEnv,
  loadRosterFixture,
  prepareForDomain,
  type Observation,
  type RosterEnv,
} from "../fixtures/normalize-full-roster.js";
import { buildCapObservations, rpcBody, utf8Bytes, type CapEntry } from "../fixtures/normalize-cap-request.js";
import { realHandlers } from "../fixtures/real-handlers.js";

const handlers = realHandlers();
const roster = loadRosterFixture();
const evidence = { sourceScope: "currentTurnImage" as const, batchId: "limits" };
const WORKER_RESULT_BYTES = 98_304;
/** K đã đo (TQCCL_MEASURE=1): 300 mục, id 32 ký tự, unresolved xấu nhất từ catalog; K lớn nhất ≤ 36 000 ký tự là 69. */
const GUARANTEED_UNRESOLVED = 60;

const normalize = (observations: unknown[]) => handlers.call("tqccl_normalize_entities", { observations: observations as never });
const failureOf = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as ResearchHandlerError);

/** observationId dài đúng 32 ký tự (trần của schema): ca xấu nhất cho phần echo `unresolved`. */
const longId = (prefix: string, index: number) => `${prefix}${index}-`.padEnd(32, "x");

/**
 * Mục chưa rõ xấu nhất có thể có từ catalog thật: tên catalog dài nhất đã biến đổi nhẹ để không khớp đúng (unknown),
 * ưu tiên mục được gợi ý đủ 5 candidates (`buildWorstCaseObservations`), id 32 ký tự, tướng có redStars + level.
 */
function unresolvedObservations(env: RosterEnv, count: number): Observation[] {
  return buildWorstCaseObservations(env, count).map((observation, index) => ({
    ...observation,
    observationId: longId("u", index),
    ...(observation.entityKind === "hero" ? { redStars: 5, level: 40 } : {}),
  }));
}

/** `count` mục đã giải quyết theo canonicalId (hero + tactic của catalog hiện tại). */
function idObservations(env: RosterEnv, count: number, prefix: string, kind?: "hero" | "tactic"): Observation[] {
  return [...env.kinds]
    .filter(([, entryKind]) => kind === undefined || entryKind === kind)
    .slice(0, count)
    .map(([canonicalId, entryKind], index) => ({ observationId: `${prefix}${index}`, entityKind: entryKind, canonicalId, evidence }));
}

describe("phase 3: trần đầu vào normalize", () => {
  it("đúng N mục → OK; N+1 → INVALID_REQUEST chỉ báo observations; vượt byte → INVALID_REQUEST", async () => {
    const env = await loadRosterEnv();
    const tactics = [...env.kinds].filter(([, kind]) => kind === "tactic").map(([id]) => id);
    const make = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        observationId: `o${index}`,
        entityKind: "tactic" as const,
        canonicalId: tactics[index % tactics.length]!,
        evidence,
      }));
    expect(MAX_NORMALIZE_OBSERVATIONS).toBe(300);
    expect(MAX_NORMALIZE_REQUEST_BYTES).toBe(60_770);
    const ok = await normalize(make(MAX_NORMALIZE_OBSERVATIONS));
    expect(() => RESEARCH_CONTRACTS.tqccl_normalize_entities.output.parse(ok)).not.toThrow();
    const over = await failureOf(normalize(make(MAX_NORMALIZE_OBSERVATIONS + 1)));
    expect(over).toMatchObject({ code: "INVALID_REQUEST", fields: ["observations"] });
    const bytes = await failureOf(
      normalize(Array.from({ length: 250 }, (_, index) => ({ observationId: `b${index}`, entityKind: "hero", observedText: "x".repeat(256), evidence }))),
    );
    expect(bytes).toBeInstanceOf(ResearchHandlerError);
    expect(bytes).toMatchObject({ code: "INVALID_REQUEST" });
  });

  /** Tên catalog mà server tra ra đúng một canonicalId (đường tra tên), theo loại. */
  function resolvableNames(env: RosterEnv): { heroes: string[]; tactics: string[] } {
    const all: Observation[] = [...env.names].map(([id, name], index) => ({
      observationId: `p${index}`,
      entityKind: env.kinds.get(id)!,
      observedText: name,
      evidence,
    }));
    const ok = prepareForDomain(env.ctx, all).filter((o) => o.canonicalId !== undefined && o.reviewRequired === undefined);
    return {
      heroes: ok.filter((o) => o.entityKind === "hero").map((o) => o.observedText!),
      tactics: ok.filter((o) => o.entityKind === "tactic").map((o) => o.observedText!),
    };
  }

  /** Roster tỉ lệ thật (93 tướng : 145 chiến pháp), gửi TÊN, id 32 ký tự, tướng có redStars + level. */
  function proportionalResolved(env: RosterEnv, resolvedCount: number): Observation[] {
    const { heroes, tactics } = resolvableNames(env);
    const heroCount = Math.round((resolvedCount * 93) / 238);
    return [
      ...heroes.slice(0, heroCount).map((name, index) => ({ observationId: longId("rh", index), entityKind: "hero" as const, observedText: name, redStars: 5, level: 40, evidence })),
      ...tactics.slice(0, resolvedCount - heroCount).map((name, index) => ({ observationId: longId("rt", index), entityKind: "tactic" as const, observedText: name, evidence })),
    ];
  }

  async function measureRoster(unresolvedCount: number) {
    const env = await loadRosterEnv();
    const observations = [...proportionalResolved(env, 300 - unresolvedCount), ...unresolvedObservations(env, unresolvedCount)];
    expect(observations).toHaveLength(300);
    const result = await normalize(observations).catch((error: unknown) => error as ResearchHandlerError);
    if (result instanceof ResearchHandlerError) return { result: null, code: result.code, chars: Number.POSITIVE_INFINITY };
    const text = JSON.stringify(result);
    return { result, code: "OK", chars: text.length, bytes: Buffer.byteLength(text), unresolved: result.canonicalState.unresolved!.length };
  }

  it.runIf(process.env.TQCCL_MEASURE === "1")("đo K lớn nhất (300 mục, id 32, redStars+level) còn ≤ 36 000 ký tự", async () => {
    let lo = 0;
    let hi = 150;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if ((await measureRoster(mid)).chars <= MAX_STRUCTURED_CHARS * 0.9) lo = mid;
      else hi = mid - 1;
    }
    console.info("TQCCL_K_MAX", JSON.stringify({ k: lo, chars: (await measureRoster(lo)).chars, charsAtKPlus1: (await measureRoster(lo + 1)).chars }));
  });

  it("bảo đảm kích thước: 300 mục tỉ lệ thật (đường tra tên, id 32 ký tự, redStars+level) với 60 chưa rõ lọt 40 000 ký tự, 43 008 B và 98 304 B định dạng", async () => {
    const measured = await measureRoster(GUARANTEED_UNRESOLVED);
    console.info("TQCCL_GUARANTEE_300", JSON.stringify({ chars: measured.chars, bytes: measured.bytes, unresolved: measured.unresolved }));
    expect(measured.code).toBe("OK");
    expect(measured.unresolved).toBeGreaterThanOrEqual(GUARANTEED_UNRESOLVED);
    expect(measured.chars).toBeLessThanOrEqual(MAX_STRUCTURED_CHARS * 0.9);
    expect(measured.chars).toBeLessThan(MAX_STRUCTURED_CHARS);
    expect(measured.bytes!).toBeLessThanOrEqual(MAX_RESULT_BYTES);
    expect(Buffer.byteLength(JSON.stringify(formatToolResult(measured.result!)))).toBeLessThanOrEqual(WORKER_RESULT_BYTES);
  });

  it("số đo tham khảo (không ghim): 300 mục với 100 chưa rõ", async () => {
    const measured = await measureRoster(100);
    console.info("TQCCL_REFERENCE_300_100", JSON.stringify({ code: measured.code, chars: measured.chars }));
    expect(["OK", "RESULT_TOO_LARGE"]).toContain(measured.code);
  });

  it("ca toàn tên sai 300 mục → RESULT_TOO_LARGE có kiểu, nextAction hướng dẫn normalize", async () => {
    const env = await loadRosterEnv();
    const failure = await failureOf(normalize(unresolvedObservations(env, 300)));
    expect(failure).toBeInstanceOf(ResearchHandlerError);
    expect(failure).toMatchObject({ code: "RESULT_TOO_LARGE" });
    expect(PUBLIC_ERRORS.RESULT_TOO_LARGE.nextAction).toContain("normalize");
  });

  it("kho (a) 238 và (b) 263 chạy qua handler; normalize → recommend trả tên catalog", async () => {
    const env = await loadRosterEnv();
    const a = await normalize(buildNameObservations(env, roster));
    expect(a.canonicalState.heroes.length + a.canonicalState.tactics.length + a.canonicalState.unresolved!.length).toBeGreaterThanOrEqual(238 - 1);
    const b = await normalize(buildMixedObservations(env, roster));
    expect(b.canonicalState.unresolved!.length).toBeGreaterThanOrEqual(buildAmbiguousExtras(env).length);
    expect(() => RESEARCH_CONTRACTS.tqccl_normalize_entities.output.parse(b)).not.toThrow();

    // Người chơi chọn (pick) bản đúng cho các mục mơ hồ bằng canonicalId → kho 238 mục đã xác nhận.
    const stars = new Map(roster.heroes.map((hero, index) => [`h${index}`, hero.canonicalId]));
    const tacticIds = new Map(roster.tactics.map((id, index) => [`t${index}`, id]));
    const unresolvedIds = new Set((a.canonicalState.unresolved as Array<{ observationId: string }>).map((item) => item.observationId));
    const picked = buildNameObservations(env, roster).map((observation) => {
      if (!unresolvedIds.has(observation.observationId)) return observation;
      const canonicalId = stars.get(observation.observationId) ?? tacticIds.get(observation.observationId)!;
      const { observedText: _text, ...rest } = observation;
      return { ...rest, canonicalId };
    });
    const confirmed = await normalize(picked);
    expect(confirmed.reviewRequired).toBe(false);
    const recommended = await handlers.call("tqccl_recommend_teams", {
      expectedWorkflowVersion: confirmed.workflowVersion,
      canonicalState: confirmed.canonicalState,
      confirmationBinding: confirmed.confirmationBinding,
      sourceSeasonId: env.snapshot.publication!.seasons.defaultSourceSeasonId,
      maxTeams: 10,
      fullBox: true,
    });
    const heroes = recommended.portfolioTeams.flatMap((team) => team.heroes);
    expect(heroes.length).toBeGreaterThan(0);
    for (const hero of heroes) {
      expect(hero.displayName.length).toBeGreaterThan(0);
      expect(hero.displayName).toBe(env.names.get(hero.canonicalId));
    }
  });

  it("cảnh báo tối đa: 300 mục ảnh trùng hero lệch redStars/level → không INTERNAL_ERROR, output đúng schema", async () => {
    const env = await loadRosterEnv();
    const observations = idObservations(env, 150, "w", "hero").flatMap(({ canonicalId }, index) => [
      { observationId: `a${index}`, entityKind: "hero" as const, canonicalId, redStars: 1, level: 10, evidence },
      { observationId: `b${index}`, entityKind: "hero" as const, canonicalId, redStars: 2, level: 20, evidence },
    ]);
    expect(observations).toHaveLength(300);
    expect(env.names.size).toBeGreaterThan(0);
    const result = await normalize(observations);
    expect(() => RESEARCH_CONTRACTS.tqccl_normalize_entities.output.parse(result)).not.toThrow();
    // 300 cảnh báo chi tiết vượt trần 100 → 98 dòng đầu + đếm theo loại (summary:<loại>:<n>).
    expect(result.warnings).toHaveLength(100);
    expect(result.warnings.slice(-2).sort()).toEqual(["summary:conflicting-level:150", "summary:conflicting-redStars:150"]);
    expect(result.canonicalState.warnings).toEqual(result.warnings);
  });

  it("request đúng trần byte (escape ASCII toàn bộ, kèm _meta) lọt thân HTTP 64 KiB; hơn 1 byte → INVALID_REQUEST", async () => {
    const env = await loadRosterEnv();
    const entries: CapEntry[] = [
      ...roster.heroes.map(({ canonicalId }) => ({ canonicalId, kind: "hero" as const, displayName: env.names.get(canonicalId)! })),
      ...roster.tactics.map((canonicalId) => ({ canonicalId, kind: "tactic" as const, displayName: env.names.get(canonicalId)! })),
    ];
    const atCap = buildCapObservations(entries, MAX_NORMALIZE_REQUEST_BYTES);
    expect(utf8Bytes({ observations: atCap })).toBe(MAX_NORMALIZE_REQUEST_BYTES);
    const body = rpcBody(atCap);
    console.info("TQCCL_CAP_BODY", JSON.stringify({ bodyBytes: Buffer.byteLength(body), cap: 65_536 }));
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(65_536);
    const ok = await normalize(atCap);
    expect(() => RESEARCH_CONTRACTS.tqccl_normalize_entities.output.parse(ok)).not.toThrow();
    const over = await failureOf(normalize(buildCapObservations(entries, MAX_NORMALIZE_REQUEST_BYTES + 1)));
    expect(over).toMatchObject({ code: "INVALID_REQUEST" });
  });
});
