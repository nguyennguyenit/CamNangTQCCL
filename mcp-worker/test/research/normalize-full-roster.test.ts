import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { createNormalizationDigest } from "../../src/domain/canonical-state.js";
import { normalizeObservations } from "../../src/domain/normalization-service.js";
import { RESEARCH_CONTRACTS } from "../../src/research/research-contracts.js";
import { MAX_STRUCTURED_CHARS } from "../../src/research/tool-context.js";
import {
  CANDIDATE_REQUEST_BYTE_CAP,
  buildAmbiguousExtras,
  buildIdObservations,
  buildMixedObservations,
  buildNameObservations,
  buildWorstCaseObservations,
  loadRosterEnv,
  loadRosterFixture,
  measure,
  prepareForDomain,
  projectCompact,
  type Observation,
  type RosterEnv,
} from "../fixtures/normalize-full-roster.js";
import { realHandlers } from "../fixtures/real-handlers.js";

const roster = loadRosterFixture();
const WORKFLOW_VERSION = (env: RosterEnv) => env.ctx.workflowVersion;

async function normalizeByName(env: RosterEnv, observations: readonly Observation[]) {
  return normalizeObservations({
    workflowVersion: WORKFLOW_VERSION(env),
    observations: prepareForDomain(env.ctx, observations) as never,
  });
}

describe("phase 1 characterization: kho 238 mục (#165)", () => {
  it("fixture là 93 tướng + 145 chiến pháp, observation dựng từ snapshot hiện tại", async () => {
    const env = await loadRosterEnv();
    expect(roster.heroes).toHaveLength(93);
    expect(roster.tactics).toHaveLength(145);
    const a = buildNameObservations(env, roster);
    expect(a).toHaveLength(238);
    expect(a.every((o) => o.canonicalId === undefined && typeof o.observedText === "string")).toBe(true);
    expect(buildAmbiguousExtras(env)).toHaveLength(25);
    expect(buildMixedObservations(env, roster)).toHaveLength(263);
  });

  it("Before 1 (đảo ở phase 3): handler nhận kho (a) 238 và (b) 263 mục", async () => {
    const env = await loadRosterEnv();
    for (const observations of [buildNameObservations(env, roster), buildMixedObservations(env, roster)]) {
      const result = await realHandlers().call("tqccl_normalize_entities", { observations: observations as never });
      expect(() => RESEARCH_CONTRACTS.tqccl_normalize_entities.output.parse(result)).not.toThrow();
      expect(result.canonicalState.heroes.length + result.canonicalState.tactics.length + result.canonicalState.unresolved!.length).toBeGreaterThanOrEqual(observations.length - 25);
    }
  });

  it("Before 2: domain với biến thể (c) → 93 tướng, 145 chiến pháp, không unresolved, redStars khớp", async () => {
    const env = await loadRosterEnv();
    const result = await normalizeObservations({
      workflowVersion: WORKFLOW_VERSION(env),
      observations: buildIdObservations(env, roster) as never,
    });
    const state = result.canonicalState;
    expect(state.heroes).toHaveLength(93);
    expect(state.tactics).toHaveLength(145);
    expect(state.unresolved ?? []).toEqual([]);
    expect(result.reviewRequired).toBe(false);
    const stars = new Map(roster.heroes.map((hero) => [hero.canonicalId, hero.redStars]));
    for (const hero of state.heroes) expect(hero.redStars, hero.canonicalId).toBe(stars.get(hero.canonicalId));
  });

  it("Before 3: digest bất biến khi bỏ displayName/evidence/confidence khỏi state", async () => {
    const env = await loadRosterEnv();
    const withUnresolved = await normalizeByName(env, buildMixedObservations(env, roster));
    for (const result of [
      await normalizeObservations({ workflowVersion: WORKFLOW_VERSION(env), observations: buildIdObservations(env, roster) as never }),
      withUnresolved,
    ]) {
      const state = result.canonicalState;
      const stripped = {
        ...state,
        heroes: state.heroes.map(({ displayName: _d, evidence: _e, confidence: _c, ...rest }) => rest),
        tactics: state.tactics.map(({ displayName: _d, evidence: _e, confidence: _c, ...rest }) => rest),
        unresolved: (state.unresolved ?? []).map((item) => {
          const { evidence: _evidence, ...rest } = item as Record<string, unknown>;
          return rest;
        }),
      };
      expect(await createNormalizationDigest(stripped as never)).toBe(result.confirmationBinding.normalizationDigest);
    }
    expect(withUnresolved.canonicalState.unresolved!.length).toBeGreaterThan(0);
  });

  it("bản sao withResolvedNames/withHeroFamilies trong harness trùng handler thật trên 55 mục", async () => {
    const env = await loadRosterEnv();
    // Handler hiện tại đã RESULT_TOO_LARGE từ ~75 mục (đầy đủ evidence/tên): lấy 30 tướng + 25 mục mơ hồ/không biết.
    const first100 = buildMixedObservations(env, roster).filter((_, i) => i < 30 || i >= 238);
    expect(first100).toHaveLength(55);
    const viaHandler = await realHandlers().call("tqccl_normalize_entities", { observations: first100 as never });
    const viaHarness = await normalizeByName(env, first100);
    expect(viaHandler.confirmationBinding.normalizationDigest).toBe(viaHarness.confirmationBinding.normalizationDigest);
    expect(viaHandler.canonicalState).toEqual(JSON.parse(JSON.stringify(projectCompact(env.ctx, viaHarness, first100).canonicalState)));
    expect(viaHandler.canonicalState.unresolved!.length).toBeGreaterThan(0);
  });
});

describe("phase 1 đo kích thước thiết kế phase 2 (không ghim byte)", () => {
  // Đo, không phải kiểm hồi quy: chỉ chạy khi `TQCCL_MEASURE=1` (binary search chậm). Gate dùng runIf, không phải skip.
  it.runIf(process.env.TQCCL_MEASURE === "1")("đo (a) 238, (b) 263 và ca xấu nhất; chốt trần", async () => {
    const env = await loadRosterEnv();
    const report: Record<string, unknown> = {};

    for (const [label, observations] of [
      ["a-238", buildNameObservations(env, roster)],
      ["b-263", buildMixedObservations(env, roster)],
    ] as const) {
      const startedAt = performance.now();
      const normalized = await normalizeByName(env, observations);
      const normalizeMs = Math.round(performance.now() - startedAt);
      const compact = projectCompact(env.ctx, normalized, observations);
      const state = compact.canonicalState as { unresolved: Array<{ reason: string }> };
      report[label] = {
        normalizeMs,
        request: measure({ observations }),
        result: measure(compact),
        unresolved: state.unresolved.length,
        ambiguous: state.unresolved.filter((item) => item.reason === "ambiguous").length,
        unknown: state.unresolved.filter((item) => item.reason === "unknown").length,
        resolvedIds: (compact.resolvedIds as Array<string | null>).filter((id) => id !== null).length,
      };
    }

    // Ca xấu nhất: tên dài nhất, toàn unknown. Bước dò thật không tạo đủ 5 candidates/mục, nên dựng chặn trên: thay
    // `candidates` của mỗi unresolved bằng k canonicalId dài nhất trong catalog (k = 5 hoặc 3).
    const longestIds = [...env.names.keys()].sort((left, right) => right.length - left.length || left.localeCompare(right));
    const worstAt = async (n: number, k: number) => {
      const observations = buildWorstCaseObservations(env, n);
      const normalized = await normalizeByName(env, observations);
      const state = normalized.canonicalState as unknown as { unresolved: Array<Record<string, unknown>> };
      state.unresolved = state.unresolved.map((item) => ({ ...item, reason: "unknown", candidates: longestIds.slice(0, k) }));
      const compact = projectCompact(env.ctx, normalized, observations);
      return {
        n,
        k,
        request: measure({ observations }),
        result: measure(compact),
        unresolved: state.unresolved.length,
      };
    };
    let lo = 1;
    let hi = env.names.size;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure({ observations: buildWorstCaseObservations(env, mid) }).bytes <= CANDIDATE_REQUEST_BYTE_CAP) lo = mid;
      else hi = mid - 1;
    }
    report["requestCapBytes"] = CANDIDATE_REQUEST_BYTE_CAP;
    report["catalogNames"] = env.names.size;
    report["maxNAtRequestCap"] = lo;
    for (const k of [5, 3]) {
      report[`k${k}-at-request-cap`] = await worstAt(lo, k);
      // N lớn nhất (≤ lo) có kết quả ≤ 90 % × 40 000 = 36 000 ký tự.
      let nLo = 1;
      let nHi = lo;
      while (nLo < nHi) {
        const mid = Math.ceil((nLo + nHi) / 2);
        if ((await worstAt(mid, k)).result.chars <= MAX_STRUCTURED_CHARS * 0.9) nLo = mid;
        else nHi = mid - 1;
      }
      report[`k${k}-largest-N-within-36000`] = await worstAt(nLo, k);
    }
    console.info("TQCCL_NORMALIZE_SIZE", JSON.stringify(report));

    expect((report["a-238"] as { result: { chars: number } }).result.chars).toBeGreaterThan(0);
    expect((report["k5-at-request-cap"] as { unresolved: number }).unresolved).toBeGreaterThan(0);
  }, 120_000);
});
