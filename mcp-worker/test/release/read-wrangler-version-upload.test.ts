import { describe, expect, it } from "vitest";

import { parseWranglerVersionUpload } from "../../scripts/read-wrangler-version-upload.js";

const versionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("Wrangler version upload output", () => {
  it("đọc đúng một NDJSON version-upload record", () => {
    expect(
      parseWranglerVersionUpload(
        `${JSON.stringify({ type: "wrangler-session", version: 1 })}\n${JSON.stringify({ type: "version-upload", version_id: versionId })}\n`,
      ),
    ).toBe(versionId);
  });

  it("đọc deploy record riêng cho bootstrap đầu tiên", () => {
    expect(
      parseWranglerVersionUpload(
        JSON.stringify({ type: "deploy", version_id: versionId }),
        "deploy",
      ),
    ).toBe(versionId);
    expect(() =>
      parseWranglerVersionUpload(
        JSON.stringify({ type: "deploy", version_id: versionId }),
      ),
    ).toThrow();
  });

  it("từ chối thiếu, trùng hoặc malformed version ID", () => {
    expect(() => parseWranglerVersionUpload("{}\n")).toThrow();
    expect(() =>
      parseWranglerVersionUpload(
        `${JSON.stringify({ type: "version-upload", version_id: versionId })}\n${JSON.stringify({ type: "version-upload", version_id: versionId })}`,
      ),
    ).toThrow();
    expect(() =>
      parseWranglerVersionUpload(
        JSON.stringify({ type: "version-upload", version_id: "latest" }),
      ),
    ).toThrow();
  });
});
