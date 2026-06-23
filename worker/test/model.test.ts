import { describe, expect, it } from "vitest";
import { buildRequestBody } from "../src/model";

describe("vision prompt", () => {
  it("tells the model not to infer heroes from portraits or include military books", () => {
    const body = buildRequestBody("vision-model", "data:image/jpeg;base64,abc");
    const text = (body.messages[0].content[0] as { text: string }).text;

    expect(text).toContain("không đoán tên tướng từ chân dung");
    expect(text).toContain("dùng 未知");
    expect(text).toContain("Không dùng tên trong dòng #帅选择");
    expect(text).toContain("Không đưa binh thư");
  });
});
