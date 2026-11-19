import { describe, expect, it } from "vitest";

import { normalizedCanonicalStateSchema } from "../../src/research/shared-schemas.js";
import { ResearchHandlerError, summarizeWarnings } from "../../src/research/research-handlers.js";
import { realHandlers } from "../fixtures/real-handlers.js";

const handlers = realHandlers();
const evidence = (sourceScope: "currentTurnImage" | "manualCorrection" = "currentTurnImage") => ({ sourceScope, batchId: "review" });
const byName = (observationId: string, entityKind: "hero" | "tactic", observedText: string, sourceScope?: "manualCorrection", extra: object = {}) => ({
  observationId,
  entityKind,
  observedText,
  evidence: evidence(sourceScope),
  ...extra,
});
const normalize = (observations: unknown[]) => handlers.call("tqccl_normalize_entities", { observations: observations as never });

describe("review H1: resolvedIds chỉ có canonicalId server tra tên; observationId ≤ 64", () => {
  it("mục client gửi sẵn canonicalId không được echo; mục tra tên thì có", async () => {
    const result = await normalize([
      { observationId: "given", entityKind: "hero", canonicalId: "hero:vuong-di", evidence: evidence() },
      byName("looked", "hero", "40Y Lữ Bố"),
      byName("tactic", "tactic", "Mê Hoặc"),
    ]);
    expect(result.canonicalState.heroes.map((hero) => hero.canonicalId)).toEqual(["hero:40y-lu-bo", "hero:vuong-di"]);
    expect(result).not.toHaveProperty("observations");
    expect(result.resolvedIds).toEqual([null, "hero:40y-lu-bo", "tactic:me-hoac"]);
  });

  it("observationId dài đúng 64 ký tự được nhận, 65 bị từ chối kèm tên field", async () => {
    const ok = await normalize([byName("a".repeat(64), "hero", "Vương Dị")]);
    expect(ok.resolvedIds).toEqual(["hero:vuong-di"]);
    const failure = await normalize([byName("a".repeat(65), "hero", "Vương Dị")]).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ResearchHandlerError);
    expect(failure).toMatchObject({ code: "INVALID_REQUEST", fields: ["observations[0].observationId"] });
  });
});

describe("review M1: resolvedIds khớp state cuối theo vị trí", () => {
  it("id trùng nhưng khác canonicalId → chỉ nằm trong unresolved, không có trong observations", async () => {
    const result = await normalize([byName("x", "hero", "40Y Lữ Bố"), byName("x", "hero", "Vương Dị"), byName("ok", "tactic", "Mê Hoặc")]);
    const unresolved = result.canonicalState.unresolved as Array<{ observationId: string }>;
    expect(unresolved.map((item) => item.observationId)).toContain("x");
    expect(result.resolvedIds).toEqual([null, null, "tactic:me-hoac"]);
  });

  it("ảnh rồi manual cùng id: chỉ còn mục khớp state, không lặp id", async () => {
    const result = await normalize([byName("x", "hero", "40Y Lữ Bố"), byName("x", "hero", "Vương Dị", "manualCorrection")]);
    expect(result.canonicalState.heroes.map((hero) => hero.canonicalId)).toEqual(["hero:vuong-di"]);
    expect(result.resolvedIds).toEqual([null, "hero:vuong-di"]);
  });

  it("replacesCanonicalId: mục bị thay không còn trong observations", async () => {
    const result = await normalize([
      byName("a", "hero", "40Y Lữ Bố"),
      byName("b", "hero", "Vương Dị", "manualCorrection", { replacesCanonicalId: "hero:40y-lu-bo" }),
    ]);
    expect(result.canonicalState.heroes.map((hero) => hero.canonicalId)).toEqual(["hero:vuong-di"]);
    expect(result.resolvedIds).toEqual([null, "hero:vuong-di"]);
  });
});

describe("review M2: candidates không trùng", () => {
  it("21 observation trùng id xen kẽ hai hero → không INTERNAL_ERROR, candidates còn 2", async () => {
    const observations = Array.from({ length: 21 }, (_, index) => byName("x", "hero", index % 2 === 0 ? "40Y Lữ Bố" : "Vương Dị"));
    const result = await normalize(observations);
    const entry = (result.canonicalState.unresolved as Array<{ observationId: string; candidates: string[] }>).find((item) => item.observationId === "x")!;
    expect([...entry.candidates].sort()).toEqual(["hero:40y-lu-bo", "hero:vuong-di"]);
  });
});

describe("review M3: summarizeWarnings giữ chi tiết đầu + đếm summary:<kind>:<n>", () => {
  it("≤ 100 cảnh báo giữ nguyên", () => {
    const warnings = Array.from({ length: 100 }, (_, index) => `conflicting-level:hero:h${index}`);
    expect(summarizeWarnings(warnings)).toEqual(warnings);
  });

  it("> 100: 100 − số loại cảnh báo đầu + một dòng đếm mỗi loại", () => {
    const warnings = [
      ...Array.from({ length: 150 }, (_, index) => `conflicting-redStars:hero:h${index}`),
      ...Array.from({ length: 150 }, (_, index) => `conflicting-level:hero:h${index}`),
      "conflicting-identity:12",
    ];
    const summary = summarizeWarnings(warnings);
    expect(summary).toHaveLength(100);
    expect(summary.slice(0, 97)).toEqual(warnings.slice(0, 97));
    expect(summary.slice(97)).toEqual(["summary:conflicting-redStars:150", "summary:conflicting-level:150", "summary:conflicting-identity:1"]);
  });
});

describe("review L2: schema output không quảng cáo displayName/confidence/evidence", () => {
  it("hero/tactic của normalize từ chối các field này", () => {
    const base = { tactics: [], lockedTeams: [] };
    const hero = { canonicalId: "hero:a", familyId: "hero-family:a" };
    expect(normalizedCanonicalStateSchema.safeParse({ ...base, heroes: [hero] }).success).toBe(true);
    for (const extra of [{ displayName: "x" }, { confidence: "high" }, { evidence: [] }]) {
      expect(normalizedCanonicalStateSchema.safeParse({ ...base, heroes: [{ ...hero, ...extra }] }).success).toBe(false);
      expect(normalizedCanonicalStateSchema.safeParse({ heroes: [], lockedTeams: [], tactics: [{ canonicalId: "tactic:a", ...extra }] }).success).toBe(false);
    }
  });
});
