import { describe, expect, it } from "vitest";

import {
  excludeDeletedReviewableFiles,
  verifyExceptionalSecretFilesRemoved,
  verifyRepositoryHasNoHighConfidenceSecrets,
} from "../../scripts/check-local-secret-files.js";

describe("exceptional local secret files", () => {
  it("không đọc tracked file đã bị xóa trong migration worktree", () => {
    expect(
      excludeDeletedReviewableFiles(
        ["kept.ts", "deleted.ts", "untracked.txt"],
        ["deleted.ts"],
      ),
    ).toEqual(["kept.ts", "untracked.txt"]);
  });
  it("quét cả đường dẫn ignored và chặn release khi còn file", async () => {
    const listFiles = async () => [
      "mcp-worker/.release-secrets/pointer-token",
      "mcp-worker/operator.release-secret",
    ];
    await expect(
      verifyExceptionalSecretFilesRemoved({ listFiles }),
    ).rejects.toThrow("secret");
  });

  it("đạt khi mọi file secret tạm đã được dọn", async () => {
    await expect(
      verifyExceptionalSecretFilesRemoved({ listFiles: async () => [] }),
    ).resolves.toEqual({ verified: true, files: 0 });
  });

  it("quét nội dung tracked/untracked và chặn credential có độ tin cậy cao", async () => {
    const token = ["ghp", "_abcdefghijklmnopqrstuvwxyzABCDEFGHIJ"].join("");
    await expect(
      verifyRepositoryHasNoHighConfidenceSecrets({
        files: ["tracked.ts", "untracked.txt"],
        readBytes: async (path) =>
          new TextEncoder().encode(path === "tracked.ts" ? token : "safe"),
      }),
    ).rejects.toThrow("credential");
  });
});
