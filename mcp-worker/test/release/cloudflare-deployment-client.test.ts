import { describe, expect, it, vi } from "vitest";

import {
  CloudflareDeploymentClient,
  CloudflareDeploymentError,
} from "../../scripts/cloudflare-deployment-client.js";

const accountId = "0123456789abcdef0123456789abcdef";
const workerName = "tqccl-mcp";
const priorVersionId = "11111111-2222-4333-8444-555555555555";
const candidateVersionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function response(result: unknown, status = 200): Response {
  return Response.json(
    { success: status >= 200 && status < 300, result },
    { status },
  );
}

describe("CloudflareDeploymentClient", () => {
  it("đọc deployment hiện tại và deploy đúng một version ở 100%", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          deployments: [
            {
              id: "deployment-prior",
              strategy: "percentage",
              versions: [
                { version_id: priorVersionId, percentage: 100 },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          id: "deployment-candidate",
          strategy: "percentage",
          versions: [
            { version_id: candidateVersionId, percentage: 100 },
          ],
        }),
      );
    const client = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: "private-token",
      fetcher,
    });

    const prior = await client.readCurrent();
    const deployed = await client.deployExclusive(candidateVersionId);

    expect(prior).toEqual({
      deploymentId: "deployment-prior",
      versions: [{ versionId: priorVersionId, percentage: 100 }],
    });
    expect(deployed).toEqual({
      versionId: candidateVersionId,
      percentage: 100,
      activeVersions: 1,
    });
    const deployRequest = fetcher.mock.calls[1]![0] as Request;
    expect(deployRequest.method).toBe("POST");
    expect(deployRequest.url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/deployments`,
    );
    expect(deployRequest.headers.get("Authorization")).toBe(
      "Bearer private-token",
    );
    expect(await deployRequest.json()).toEqual({
      strategy: "percentage",
      versions: [{ version_id: candidateVersionId, percentage: 100 }],
      annotations: {
        "workers/message": "Activate immutable TQCCL MCP release",
        "workers/triggered_by": "deployment",
      },
    });
  });

  it("từ chối response traffic split", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      response({
        id: "deployment-split",
        strategy: "percentage",
        versions: [
          { version_id: priorVersionId, percentage: 50 },
          { version_id: candidateVersionId, percentage: 50 },
        ],
      }),
    );
    const client = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: "private-token",
      fetcher,
    });

    await expect(client.deployExclusive(candidateVersionId)).rejects.toBeInstanceOf(
      CloudflareDeploymentError,
    );
  });

  it("không làm lộ token hoặc upstream body khi API lỗi", async () => {
    const token = "super-private-token";
    const client = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: token,
      fetcher: async () =>
        new Response(`upstream includes ${token}`, { status: 500 }),
    });

    try {
      await client.readCurrent();
      throw new Error("expected failure");
    } catch (error) {
      expect(String(error)).toBe("CloudflareDeploymentError: Không thể quản lý Worker deployment.");
      expect(String(error)).not.toContain(token);
      expect(String(error)).not.toContain("upstream");
    }
  });
});
