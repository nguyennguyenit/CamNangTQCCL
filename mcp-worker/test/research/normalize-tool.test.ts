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
