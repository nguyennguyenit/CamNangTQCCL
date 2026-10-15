import { describe, expect, it } from "vitest";

import { realHandlers } from "../fixtures/real-handlers.js";

const tacticsOf = (heroes: ReadonlyArray<Record<string, unknown>> | undefined, hero: string) =>
  (heroes?.find(({ nameVi }) => nameVi === hero)?.["tactics"] as Array<{ vi?: string | null }> | undefined)?.map(({ vi }) => vi);

describe("tqccl_get_team build ở mọi section", () => {
  it("section guide kèm build của chính đội đó, trùng với overview", async () => {
    const reference = { collection: "khaihoang" as const, khaiHoangTeamId: "gia-cat-khac-quan-ngan-binh-nhac-tien" };
    const overview = await realHandlers().call("tqccl_get_team", { reference });
    const guide = await realHandlers().call("tqccl_get_team", { reference, section: "guide" });

    expect(guide.guide).toBeDefined();
    expect(guide.build?.ref).toBe(overview.team?.ref);
    expect(guide.build?.heroes).toEqual(overview.team?.heroes);
    expect(tacticsOf(guide.build?.heroes, "Gia Cát Khác")).toEqual(["Thịnh Khí Linh Địch", "Tiềm Long Trận"]);
  });

  it("section phân trang (notes) cũng kèm build", async () => {
    const reference = { collection: "recommended" as const, sourceConfigId: "og-bingyan-40y-lvbu-b" };
    const overview = await realHandlers().call("tqccl_get_team", { reference });
    const notesSection = overview.sections?.find(({ name }) => name === "notes");
    expect(notesSection).toBeDefined();
    const notes = await realHandlers().call("tqccl_get_team", { reference, section: "notes" });
    expect(notes.build?.heroes).toEqual(overview.team?.heroes);
  });

  it("overview không lặp build (đã có team)", async () => {
    const overview = await realHandlers().call("tqccl_get_team", {
      reference: { collection: "khaihoang", khaiHoangTeamId: "gia-cat-khac-quan-ngan-binh-nhac-tien" },
    });
    expect(overview.team).toBeDefined();
    expect(overview.build).toBeUndefined();
  });
});
