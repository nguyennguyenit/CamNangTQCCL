import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  validateControlPlaneRequirements,
  verifyControlPlaneLive,
} from "../../scripts/verify-control-plane.js";

const requirementsUrl = new URL(
  "../../infra/control-plane-requirements.json",
  import.meta.url,
);

async function requirements() {
  return JSON.parse(await readFile(requirementsUrl, "utf8"));
}

describe("hợp đồng control plane chỉ đọc", () => {
  it("chỉ giữ edge rate limit sau khi bỏ R2", async () => {
    const validated = validateControlPlaneRequirements(
      await requirements(),
    );
    expect(validated.controls.map(({ id }) => id)).toEqual([
      "edge-mcp-rate-limit",
    ]);
    expect(validated.productionEnabledOnlyWhenVerified).toBe(true);
  });

  it("xác minh live state bằng GET và không gửi credential trong URL", async () => {
    const seen: Array<{ url: string; method: string; authorization: string }> =
      [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      seen.push({
        url,
        method: init?.method ?? "GET",
        authorization: new Headers(init?.headers).get("Authorization") ?? "",
      });
      if (url.includes("http_ratelimit")) {
        return Response.json({
          success: true,
          result: {
            rules: [
              {
                description: "tqccl-mcp-rate-limit",
                enabled: true,
                action: "block",
                expression: 'http.request.uri.path eq "/mcp"',
                ratelimit: {
                  requests_per_period: 60,
                  period: 60,
                },
              },
            ],
          },
        });
      }
      throw new Error("unexpected endpoint");
    };

    await expect(
      verifyControlPlaneLive(await requirements(), {
        zoneId: "zone-id",
        apiToken: "private-token",
        fetcher,
      }),
    ).resolves.toEqual({ verified: true, controls: 1 });
    expect(seen.every(({ method }) => method === "GET")).toBe(true);
    expect(seen.every(({ url }) => !url.includes("private-token"))).toBe(true);
    expect(
      seen.every(
        ({ authorization }) => authorization === "Bearer private-token",
      ),
    ).toBe(true);
  });

  it("từ chối edge expression sai", async () => {
    const fetcher: typeof fetch = async () => Response.json({
      success: true,
      result: { rules: [{
        description: "tqccl-mcp-rate-limit",
        enabled: true,
        action: "block",
        expression: 'http.request.uri.path ne "/mcp"',
        ratelimit: { requests_per_period: 60, period: 60 },
      }] },
    });

    await expect(
      verifyControlPlaneLive(await requirements(), {
        zoneId: "zone-id",
        apiToken: "private-token",
        fetcher,
      }),
    ).rejects.toThrow();
  });
});
