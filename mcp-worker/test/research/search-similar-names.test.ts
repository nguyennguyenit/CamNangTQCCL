import { describe, expect, it } from "vitest";

import { realHandlers } from "../fixtures/real-handlers.js";

type SearchKind = "hero" | "tactic" | "equipment" | "advisor" | "troopMod" | "building" | "book" | "team";

async function search(query: string, kinds?: SearchKind[], locale?: "vi" | "zh") {
  return realHandlers().call("tqccl_search", {
    query,
    ...(kinds ? { kinds } : {}),
    ...(locale ? { locale } : {}),
  });
}

const ids = (result: { similarNames?: Array<{ entityId: string }> | undefined }) =>
  (result.similarNames ?? []).map(({ entityId }) => entityId);

describe("tqccl_search similarNames khi không có kết quả", () => {
  it("tên không tồn tại: total vẫn 0, items rỗng, similarNames là tên có thật cùng loại, tối đa 5", async () => {
    for (const query of ["Phong Hỏa Liên Thiên", "Phong Hoa Lien Thien"]) {
      const result = await search(query, ["tactic"]);
      expect(result.total, query).toBe(0);
      expect(result.items, query).toEqual([]);
      expect(ids(result), query).toEqual(expect.arrayContaining(["tactic:hoa-thieu-lien-doanh", "tactic:phong-tro-hoa-the"]));
      expect(result.similarNames!.length, query).toBeLessThanOrEqual(5);
      expect(result.similarNames!.every(({ kind }) => kind === "tactic"), query).toBe(true);
    }
  });

  it("tên Hán không tồn tại so theo từng chữ Hán; locale zh trả tên Hán", async () => {
    const result = await search("烽火连天", ["tactic"], "zh");
    expect(result.total).toBe(0);
    expect(ids(result)).toContain("tactic:hoa-thieu-lien-doanh");
    expect(result.similarNames!.find(({ entityId }) => entityId === "tactic:hoa-thieu-lien-doanh")?.displayName).toMatch(/火/u);
  });

  it("gõ sai một chữ hoặc thêm chữ vẫn ra đúng tên ở đầu danh sách", async () => {
    expect(ids(await search("Liên Hoàng Kế", ["tactic"]))[0]).toBe("tactic:lien-hoan-ke");
    expect(ids(await search("CO Vô Song Đại Kiều", ["hero"]))[0]).toBe("hero:co-dai-kieu");
  });

  it("gõ có dấu: từ đúng dấu xếp trước từ chỉ trùng khi bỏ dấu (Long trước Lòng, Quan trước Quân)", async () => {
    const result = ids(await search("Quan Vũ Thanh Long"));
    const accentOnly = result.indexOf("building:thanh-phong-quan");
    expect(result).toContain("equipment:thanh-long-yen-nguyet-dao");
    expect(accentOnly === -1 || result.indexOf("equipment:thanh-long-yen-nguyet-dao") < accentOnly).toBe(true);
  });

  it("không có tên nào đủ gần thì không có similarNames", async () => {
    for (const query of ["Nguyệt Quang Bảo Hạp", "xyzzy"]) {
      const result = await search(query);
      expect(result.total, query).toBe(0);
      expect(result.similarNames, query).toBeUndefined();
    }
  });

  it("có kết quả khớp thì không kèm similarNames", async () => {
    const result = await search("Phong Hỏa", ["tactic"]);
    expect(result.total).toBeGreaterThan(0);
    expect(result.similarNames).toBeUndefined();
  });

  it("tôn trọng kinds: chỉ gợi ý đúng loại đã hỏi, không gợi ý đội", async () => {
    const heroes = await search("Phong Hỏa Liên Thiên", ["hero"]);
    expect((heroes.similarNames ?? []).every(({ kind }) => kind === "hero")).toBe(true);
    const teams = await search("Phong Hỏa Liên Thiên", ["team"]);
    expect(teams.total).toBe(0);
    expect(teams.similarNames).toBeUndefined();
  });
});
