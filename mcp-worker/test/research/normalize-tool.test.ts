import { describe, expect, it } from "vitest";

import { heroFamilyId } from "../../../js/hero-identity.js";
import { realHandlers } from "../fixtures/real-handlers.js";

const evidence = { batchId: "batch-1", sourceScope: "manualCorrection" as const };

describe("tqccl_normalize_entities hero family", () => {
  it("suy familyId từ canonicalId của tướng khi agent không gửi (agent không biết hero-family:)", async () => {
    const result = await realHandlers().call("tqccl_normalize_entities", {
      observations: [
        { observationId: "o1", entityKind: "hero", canonicalId: "hero:tao-thao", displayName: "Tào Tháo", evidence },
        { observationId: "o2", entityKind: "hero", canonicalId: "hero:sp-tao-thao", displayName: "SP Tào Tháo", evidence },
      ],
    });

    const families = Object.fromEntries(result.canonicalState.heroes.map((hero) => [hero.canonicalId, hero.familyId]));
    expect(families).toEqual({
      "hero:tao-thao": heroFamilyId("Tào Tháo"),
      "hero:sp-tao-thao": heroFamilyId("SP Tào Tháo"),
    });
    // Bản thường và SP cùng một family, nên khoá theo family vẫn đúng.
    expect(families["hero:tao-thao"]).toBe(families["hero:sp-tao-thao"]);
  });

  it("canonicalId tướng không có trong dữ liệu → INVALID_REQUEST chỉ ra field, không phải INTERNAL_ERROR", async () => {
    await expect(
      realHandlers().call("tqccl_normalize_entities", {
        observations: [
          { observationId: "o1", entityKind: "hero", canonicalId: "hero:khong-ton-tai", displayName: "X", evidence },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST", fields: ["observations[0].canonicalId"] });
  });

  it("familyId gửi lên lệch với tướng → INVALID_REQUEST, không tự sửa", async () => {
    await expect(
      realHandlers().call("tqccl_normalize_entities", {
        observations: [
          {
            observationId: "o1",
            entityKind: "hero",
            canonicalId: "hero:tao-thao",
            familyId: "hero-family:lu-bo",
            displayName: "Tào Tháo",
            evidence,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST", fields: ["observations[0].familyId"] });
  });
});

describe("tqccl_normalize_entities name resolution", () => {
  const text = (observationId: string, entityKind: "hero" | "tactic", observedText: string) => ({
    observationId,
    entityKind,
    observedText,
    evidence: { batchId: "turn-1", sourceScope: "currentTurnImage" as const },
  });
  const unresolvedOf = (result: { canonicalState: { unresolved?: unknown[] | undefined } }) =>
    Object.fromEntries(
      ((result.canonicalState.unresolved ?? []) as Array<{ observationId: string; reason: string; candidates: string[] }>).map(
        ({ observationId, reason, candidates }) => [observationId, { reason, candidates: [...candidates].sort() }],
      ),
    );

  it("tên gõ khớp đúng một tướng/chiến pháp (kể cả bản 40Y/SP/CO ghi rõ) được nhận luôn, không cần tqccl_search", async () => {
    const result = await realHandlers().call("tqccl_normalize_entities", {
      observations: [
        text("h1", "hero", "40Y Lữ Bố"),
        text("h2", "hero", "vương dị"),
        text("h3", "hero", "CO Đại Kiều"),
        text("t1", "tactic", "Mê Hoặc"),
        text("t2", "tactic", "Hổ Báo Kỵ"),
      ],
    });

    expect(result.canonicalState.heroes.map(({ canonicalId, familyId }) => [canonicalId, familyId])).toEqual([
      ["hero:40y-lu-bo", heroFamilyId("Lữ Bố")],
      ["hero:co-dai-kieu", heroFamilyId("Đại Kiều")],
      ["hero:vuong-di", heroFamilyId("Vương Dị")],
    ]);
    expect(result.canonicalState.heroes.find(({ canonicalId }) => canonicalId === "hero:vuong-di")?.displayName).toBe("Vương Dị");
    expect(result.canonicalState.tactics.map(({ canonicalId }) => canonicalId)).toEqual(["tactic:ho-bao-ky", "tactic:me-hoac"]);
    expect(result.canonicalState.unresolved).toEqual([]);
    expect(result.reviewRequired).toBe(false);
  });

  it("tên bản thường khi tộc còn bản 40Y/SP/CO → ambiguous kèm mọi bản, không tự chọn", async () => {
    const result = await realHandlers().call("tqccl_normalize_entities", {
      observations: [text("h1", "hero", "Lữ Bố"), text("h2", "hero", "Pháp Chính"), text("h3", "hero", "Tiểu Kiều")],
    });

    expect(result.canonicalState.heroes).toEqual([]);
    expect(unresolvedOf(result)).toEqual({
      h1: { reason: "ambiguous", candidates: ["hero:40y-lu-bo", "hero:lu-bo"] },
      h2: { reason: "ambiguous", candidates: ["hero:phap-chinh", "hero:sp-phap-chinh"] },
      h3: { reason: "ambiguous", candidates: ["hero:co-tieu-kieu", "hero:tieu-kieu"] },
    });
    expect(result.reviewRequired).toBe(true);
  });

  it("tên không khớp đúng → unknown, gợi ý từ lõi search nếu có khớp một phần; sai loại không lấy", async () => {
    const result = await realHandlers().call("tqccl_normalize_entities", {
      observations: [text("t1", "tactic", "Phong Hỏa Liên Thiên"), text("t2", "tactic", "Hỏa Thiêu"), text("h1", "hero", "Mê Hoặc")],
    });

    const unresolved = unresolvedOf(result);
    expect(unresolved.t1).toEqual({ reason: "unknown", candidates: [] });
    expect(unresolved.t2?.reason).toBe("unknown");
    expect(unresolved.t2?.candidates).toContain("tactic:hoa-thieu-lien-doanh");
    expect(unresolved.t2?.candidates.every((id) => id.startsWith("tactic:"))).toBe(true);
    expect(unresolved.h1).toEqual({ reason: "unknown", candidates: [] });
  });

  it("canonicalId agent gửi vẫn thắng tên; candidates/reviewRequired agent gửi giữ nguyên", async () => {
    const result = await realHandlers().call("tqccl_normalize_entities", {
      observations: [
        { ...text("h1", "hero", "Lữ Bố"), canonicalId: "hero:lu-bo" },
        { ...text("h2", "hero", "Pháp Chính"), reviewRequired: true, candidates: ["hero:phap-chinh"] },
      ],
    });

    expect(result.canonicalState.heroes.map(({ canonicalId }) => canonicalId)).toEqual(["hero:lu-bo"]);
    expect(unresolvedOf(result)).toEqual({ h2: { reason: "ambiguous", candidates: ["hero:phap-chinh"] } });
  });
});

describe("tqccl_normalize_entities request contract", () => {
  const observation = { observationId: "o1", entityKind: "hero" as const, canonicalId: "hero:tao-thao" as const, evidence };

  it("nhận expectedWorkflowVersion như sáu tool còn lại; lệch thì WORKFLOW_VERSION_CHANGED", async () => {
    const first = await realHandlers().call("tqccl_normalize_entities", { observations: [observation] });
    const pinned = await realHandlers().call("tqccl_normalize_entities", {
      expectedWorkflowVersion: first.workflowVersion,
      observations: [observation],
    });
    expect(pinned.confirmationBinding).toEqual(first.confirmationBinding);

    await expect(
      realHandlers().call("tqccl_normalize_entities", {
        expectedWorkflowVersion: `${first.workflowVersion}x`,
        observations: [observation],
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_CHANGED" });
  });

  it("key lạ ở gốc báo field `input` và nói rõ là trường ngoài schema, không lặp tên key client tự đặt", async () => {
    const error = await realHandlers()
      .call("tqccl_normalize_entities", { observations: [observation], tacticAssignments: [] } as never)
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "INVALID_REQUEST", fields: ["input"] });
    expect((error as Error).message).toContain("không có trong schema");
    expect((error as Error).message).not.toContain("tacticAssignments");
  });
});
