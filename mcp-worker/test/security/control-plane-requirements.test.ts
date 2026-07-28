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
  it("khóa đủ owner, evidence, failure và rollback cho bốn control", async () => {
    const validated = validateControlPlaneRequirements(
      await requirements(),
    );
    expect(validated.controls.map(({ id }) => id)).toEqual([
      "edge-mcp-rate-limit",
      "release-bucket-lock",
      "release-bucket-events",
      "pointer-bucket-events",
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
      if (url.endsWith("/lock")) {
        return Response.json({
          success: true,
          result: {
            rules: [
              {
                enabled: true,
                prefix: "",
                condition: { type: "Age", maxAgeSeconds: 2592000 },
              },
            ],
          },
        });
      }
      return Response.json({
        success: true,
        result: {
          queues: [
            {
              queueName: "tqccl-security-events",
              rules: [
                {
                  actions: [
                    "PutObject",
                    "CopyObject",
                    "DeleteObject",
                    "CompleteMultipartUpload",
                  ],
                },
              ],
            },
          ],
        },
      });
    };

    await expect(
      verifyControlPlaneLive(await requirements(), {
        accountId: "account-id",
        zoneId: "zone-id",
        releaseBucket: "release-bucket",
        pointerBucket: "pointer-bucket",
        apiToken: "private-token",
        fetcher,
      }),
    ).resolves.toEqual({ verified: true, controls: 4 });
    expect(seen.every(({ method }) => method === "GET")).toBe(true);
    expect(seen.every(({ url }) => !url.includes("private-token"))).toBe(true);
    expect(
      seen.every(
        ({ authorization }) => authorization === "Bearer private-token",
      ),
    ).toBe(true);
  });

  it("không ghép nhầm expression hoặc actions từ queue không liên quan", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("http_ratelimit")) {
        return Response.json({
          success: true,
          result: {
            rules: [
              {
                description: "tqccl-mcp-rate-limit",
                enabled: true,
                action: "block",
                expression: 'http.request.uri.path ne "/mcp"',
                ratelimit: {
                  requests_per_period: 60,
                  period: 60,
                },
              },
            ],
          },
        });
      }
      if (url.endsWith("/lock")) {
        return Response.json({
          success: true,
          result: {
            rules: [
              {
                enabled: true,
                prefix: "",
                condition: { type: "Age", maxAgeSeconds: 2592000 },
              },
            ],
          },
        });
      }
      return Response.json({
        success: true,
        result: {
          queues: [
            { queueName: "tqccl-security-events", rules: [] },
            {
              queueName: "unrelated",
              rules: [
                {
                  actions: [
                    "PutObject",
                    "CopyObject",
                    "DeleteObject",
                    "CompleteMultipartUpload",
                  ],
                },
              ],
            },
          ],
        },
      });
    };

    await expect(
      verifyControlPlaneLive(await requirements(), {
        accountId: "account-id",
        zoneId: "zone-id",
        releaseBucket: "release-bucket",
        pointerBucket: "pointer-bucket",
        apiToken: "private-token",
        fetcher,
      }),
    ).rejects.toThrow();
  });
});
