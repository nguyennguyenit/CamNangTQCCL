import { describe, expect, it } from "vitest";

import { realHandlers } from "../fixtures/real-handlers.js";

describe("tqccl_get_entity refNames", () => {
  it("mọi ID thực thể nhắc trong profile đều có tên hiển thị kèm theo (chiến pháp tự có, kế thừa…)", async () => {
    const sp = await realHandlers().call("tqccl_get_entity", { entityId: "hero:sp-tao-thao" });
    expect(sp.refNames?.["tactic:thua-thien-tinh-the"]).toBe("Thừa Thiên Tĩnh Thế");

    const base = await realHandlers().call("tqccl_get_entity", { entityId: "hero:tao-thao" });
    expect(base.refNames).toMatchObject({
      "tactic:loan-the-gian-hung": "Loạn Thế Gian Hùng",
      "tactic:mong-trung-thi-than": "Mộng Trung Thí Thần",
    });
    expect(base.refNames?.["hero:tao-thao"]).toBeUndefined();
  });

  it("locale zh trả tên Hán", async () => {
    const result = await realHandlers().call("tqccl_get_entity", { entityId: "hero:sp-tao-thao", locale: "zh" });
    expect(result.refNames?.["tactic:thua-thien-tinh-the"]).toBe("承天靖世");
  });

  it("chỉ gồm ID có thật trong catalog; không có ID nào thì không có refNames", async () => {
    const result = await realHandlers().call("tqccl_get_entity", { entityId: "hero:tao-thao" });
    for (const id of Object.keys(result.refNames ?? {})) {
      const entity = await realHandlers().call("tqccl_get_entity", { entityId: id });
      expect(entity.entity.entityId).toBe(id);
    }
    const book = await realHandlers().call("tqccl_get_entity", { entityId: "book:binh-hanh-quy-dao" });
    expect(book.refNames).toBeUndefined();
  });
});
