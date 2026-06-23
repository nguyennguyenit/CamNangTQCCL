import { describe, expect, it } from "vitest";
import { buildRequestBody } from "../src/model";

describe("vision prompt", () => {
  it("đọc binh thư vào booksCn riêng + cho phép đoán tướng từ chân dung khi tên vắng", () => {
    const body = buildRequestBody("vision-model", "data:image/jpeg;base64,abc");
    const text = (body.messages[0].content[0] as { text: string }).text;

    // B1: binh thư tách field riêng
    expect(text).toContain("booksCn");
    expect(text).toContain("KHÔNG đưa binh thư vào tacticsCn");
    // B0: cho phép suy đoán chân dung khi không có tên in + cờ
    expect(text).toContain("nameFromPortrait=true");
    expect(text).toContain("dùng 未知");
    // giữ guard chống nhầm dòng chọn tướng + binh chủng
    expect(text).toContain("Không dùng tên trong dòng #帅选择");
    expect(text).toContain("象兵");
  });
});
