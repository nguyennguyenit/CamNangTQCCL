import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { repositoryDataRoot } from "../fixtures/publication-sources.js";
import { realHandlers } from "../fixtures/real-handlers.js";

const innateHeroIds = (result: { profile?: Record<string, unknown> | undefined }) => result.profile?.["innateHeroIds"] as string[] | undefined;

describe("tqccl_get_entity innateHeroIds", () => {
  it("chiến pháp tự có nêu tướng mang nó, kể cả khi bản ghi chiến pháp không ghi tướng nguồn", async () => {
    // Dewee 2026-10-15: sourceHeroCn rỗng nên agent trả lời "không rõ tướng sở hữu", dù tướng trỏ selfTacticId tới đây.
    // Trấn Áp Khăn Vàng chỉ có ở client Global (không có tướng nguồn); Chu Tuấn tự mang.
    const result = await realHandlers().call("tqccl_get_entity", { entityId: "tactic:tran-ap-khan-vang" });
    expect(innateHeroIds(result)).toEqual(["hero:chu-tuan"]);
    expect(result.refNames?.["hero:chu-tuan"]).toBe("Chu Tuấn");
  });

  it("tướng không có selfTacticId vẫn được tính khi tên Hán chiến pháp tự có khớp đúng một chiến pháp", async () => {
    const result = await realHandlers().call("tqccl_get_entity", { entityId: "tactic:thien-huong" });
    expect(innateHeroIds(result)).toContain("hero:tieu-kieu");
  });

  it("mọi tướng có selfTacticId đều nằm trong innateHeroIds của chiến pháp đó", async () => {
    const heroes = JSON.parse(await readFile(join(repositoryDataRoot, "heroes-dict.json"), "utf8")) as Array<{ id: string; lookup?: { selfTacticId?: string } }>;
    const linked = heroes.filter((hero) => hero.lookup?.selfTacticId);
    expect(linked.length).toBeGreaterThan(50);
    for (const hero of linked) {
      const tactic = await realHandlers().call("tqccl_get_entity", { entityId: hero.lookup!.selfTacticId! });
      expect(innateHeroIds(tactic), hero.id).toContain(hero.id);
    }
  });

  it("chiến pháp không là tự có của tướng nào thì không có innateHeroIds", async () => {
    const result = await realHandlers().call("tqccl_get_entity", { entityId: "tactic:an-ui-quan-dan" });
    expect(innateHeroIds(result)).toBeUndefined();
  });
});
