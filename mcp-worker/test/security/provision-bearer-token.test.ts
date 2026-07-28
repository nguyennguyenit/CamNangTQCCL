import { describe, expect, it } from "vitest";

import {
  provisionBearerToken,
  type SecretSink,
} from "../../scripts/provision-bearer-token.js";

describe("cấp bearer vào managed secret sink", () => {
  it("tạo ít nhất 256 bit và chỉ truyền token qua stdin của sink", async () => {
    let received:
      | {
          command: string;
          args: readonly string[];
          token: string;
        }
      | undefined;
    const sink: SecretSink = async (command, args, token) => {
      received = { command, args, token };
    };

    await provisionBearerToken(
      {
        secretName: "TQCCL_MCP_BEARER_CURRENT",
        configPath: "wrangler.jsonc",
      },
      sink,
    );

    expect(received).toBeDefined();
    expect(received!.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(received!.args.join(" ")).not.toContain(received!.token);
    expect(received!.command).toBe("wrangler");
    expect(received!.args).toEqual([
      "secret",
      "put",
      "TQCCL_MCP_BEARER_CURRENT",
      "--config",
      "wrangler.jsonc",
    ]);
  });

  it("từ chối tên secret và đường dẫn config không rõ ràng", async () => {
    const sink: SecretSink = async () => {
      throw new Error("không được gọi");
    };
    await expect(
      provisionBearerToken(
        { secretName: "bad secret", configPath: "wrangler.jsonc" },
        sink,
      ),
    ).rejects.toThrow();
    await expect(
      provisionBearerToken(
        { secretName: "VALID_NAME", configPath: "" },
        sink,
      ),
    ).rejects.toThrow();
  });
});
