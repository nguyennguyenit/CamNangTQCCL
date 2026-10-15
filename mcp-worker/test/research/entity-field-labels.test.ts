import { describe, expect, it } from "vitest";

import { realHandlers } from "../fixtures/real-handlers.js";

describe("tqccl_get_entity fieldLabels", () => {
  it("tướng: nhãn binh chủng và chỉ số theo đúng nhãn trang Tra cứu, cho mọi khoá có trong profile", async () => {
    const result = await realHandlers().call("tqccl_get_entity", { entityId: "hero:lu-bo" });
    const profile = result.profile as { stats: Record<string, unknown>; troopApt: Record<string, unknown> };

    expect(result.fieldLabels?.troopApt).toEqual({
      ky: "Kỵ binh",
      thuan: "Khiên binh",
      cung: "Cung binh",
      thuong: "Thương binh",
      khiGioi: "Khí giới",
    });
    expect(Object.keys(result.fieldLabels?.troopApt ?? {}).sort()).toEqual(Object.keys(profile.troopApt).sort());
    expect(Object.keys(result.fieldLabels?.stats ?? {}).sort()).toEqual(Object.keys(profile.stats).sort());
    expect(result.fieldLabels?.stats?.["luc"]).toBe("Vũ lực");
  });

  it("locale zh trả nhãn tiếng Trung", async () => {
    const result = await realHandlers().call("tqccl_get_entity", { entityId: "hero:lu-bo", locale: "zh" });
    expect(result.fieldLabels?.troopApt?.["thuan"]).toBe("盾兵");
    expect(result.fieldLabels?.stats?.["tri"]).toBe("智力");
  });

  it("thực thể không có stats/troopApt thì không có fieldLabels", async () => {
    const result = await realHandlers().call("tqccl_get_entity", { entityId: "tactic:lien-hoan-ke" });
    expect(result.fieldLabels).toBeUndefined();
  });
});
