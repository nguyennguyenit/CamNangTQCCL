import { describe, expect, it, vi } from "vitest";

import {
  assertCredentialFreeEnvironment,
  REPOSITORY_GATE_COMMANDS,
  runRepositoryGate,
} from "../../scripts/check-repository.js";

describe("repository release gate", () => {
  it("bao phủ MCP, Astro/dist/E2E, JS, Python, Vision Worker và dry-run", () => {
    expect(REPOSITORY_GATE_COMMANDS.map(({ label }) => label)).toEqual([
      "mcp-worker",
      "astro-build",
      "astro-dist",
      "astro-e2e",
      "root-js",
      "python-fallback",
      "vision-worker-tests",
      "vision-worker-typecheck",
      "mcp-worker-dry-run",
    ]);
    expect(REPOSITORY_GATE_COMMANDS.every(({ command }) => command !== "sh")).toBe(
      true,
    );
  });

  it("từ chối credential release trong build/test và dừng ở gate lỗi đầu tiên", async () => {
    expect(() =>
      assertCredentialFreeEnvironment({
        CLOUDFLARE_API_TOKEN: "private",
      }),
    ).toThrow("credential");
    for (const name of [
      "TQCCL_R2_RELEASE_ACCESS_KEY_ID",
      "TQCCL_R2_RELEASE_SECRET_ACCESS_KEY",
      "TQCCL_R2_POINTER_ACCESS_KEY_ID",
      "TQCCL_R2_POINTER_SECRET_ACCESS_KEY",
      "CLOUDFLARE_CONTROL_PLANE_READ_TOKEN",
      "TQCCL_WORKER_DEPLOY_API_TOKEN",
    ]) {
      expect(() =>
        assertCredentialFreeEnvironment({ [name]: "private" }),
      ).toThrow("credential");
    }

    const runner = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("gate failed"));
    await expect(runRepositoryGate({ runner, environment: {} })).rejects.toThrow(
      "gate failed",
    );
    expect(runner).toHaveBeenCalledTimes(2);
  });
});
