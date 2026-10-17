import { describe, expect, it, vi } from "vitest";

import {
  CloudflareDeploymentClient,
  CloudflareDeploymentError,
} from "../../scripts/cloudflare-deployment-client.js";

const accountId = "0123456789abcdef0123456789abcdef";
const workerName = "tqccl-mcp";
const priorVersionId = "11111111-2222-4333-8444-555555555555";
const candidateVersionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const runId = "github-123-1";

function response(result: unknown, status = 200): Response {
  return Response.json(
    { success: status >= 200 && status < 300, result },
    { status },
  );
}

describe("CloudflareDeploymentClient", () => {
  it("phân biệt Worker chưa có deployment với lỗi API", async () => {
    const noDeployment = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: "private-token",
      runId,
      fetcher: async () => response({ deployments: [] }),
    });
    await expect(noDeployment.readCurrentOptional()).resolves.toBeNull();

    const missingWorker = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: "private-token",
      runId,
      fetcher: async () => response(null, 404),
    });
    await expect(missingWorker.readCurrentOptional()).resolves.toBeNull();

    const apiFailure = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: "private-token",
      runId,
      fetcher: async () => response(null, 500),
    });
    await expect(apiFailure.readCurrentOptional()).rejects.toBeInstanceOf(
      CloudflareDeploymentError,
    );
  });

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
          annotations: { "workers/message": `TQCCL_RUN:${runId}:promote` },
          versions: [
            { version_id: candidateVersionId, percentage: 100 },
          ],
        }),
      );
    const client = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: "private-token",
      runId,
      fetcher,
    });

    const prior = await client.readCurrent();
    const deployed = await client.deployExclusive(candidateVersionId);

    expect(prior).toEqual({
      deploymentId: "deployment-prior",
      ownerTag: null,
      versions: [{ versionId: priorVersionId, percentage: 100 }],
    });
    expect(deployed).toEqual({
      deploymentId: "deployment-candidate",
      ownerTag: runId,
      versions: [{ versionId: candidateVersionId, percentage: 100 }],
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
        "workers/message": `TQCCL_RUN:${runId}:promote`,
      },
    });
  });

  it("tạo deployment smoke prior 100% và candidate 0%", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      response({
        id: "deployment-smoke",
        strategy: "percentage",
        annotations: { "workers/message": `TQCCL_RUN:${runId}:smoke` },
        versions: [
          { version_id: priorVersionId, percentage: 100 },
          { version_id: candidateVersionId, percentage: 0 },
        ],
      }),
    );
    const client = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: "private-token",
      runId,
      fetcher,
    });

    await expect(
      client.deployTest(priorVersionId, candidateVersionId),
    ).resolves.toEqual({
      deploymentId: "deployment-smoke",
      ownerTag: runId,
      versions: [
        { versionId: priorVersionId, percentage: 100 },
        { versionId: candidateVersionId, percentage: 0 },
      ],
    });
  });

  it("gắn annotation bootstrap riêng cho deployment đầu tiên", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      response({
        id: "deployment-bootstrap",
        strategy: "percentage",
        annotations: { "workers/message": `TQCCL_RUN:${runId}:bootstrap` },
        versions: [{ version_id: candidateVersionId, percentage: 100 }],
      }),
    );
    const client = new CloudflareDeploymentClient({
      accountId,
      workerName,
      apiToken: "private-token",
      runId,
      fetcher,
    });

    await client.deployExclusive(candidateVersionId, "bootstrap");
    const request = fetcher.mock.calls[0]![0] as Request;
    expect(await request.json()).toMatchObject({
      annotations: {
        "workers/message": `TQCCL_RUN:${runId}:bootstrap`,
      },
    });
  });

  it("từ chối response traffic split", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      response({
        id: "deployment-split",
        strategy: "percentage",
        annotations: { "workers/message": `TQCCL_RUN:${runId}:promote` },
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
      runId,
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
      runId,
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

  it("lỗi mang mã lý do cố định để ghi evidence, không mang nội dung upstream", async () => {
    const reasonOf = async (fetcher: typeof fetch, call: (client: CloudflareDeploymentClient) => Promise<unknown>) => {
      const client = new CloudflareDeploymentClient({ accountId, workerName, apiToken: "private-token", runId, fetcher });
      const error = await call(client).then(() => null, (caught: unknown) => caught);
      expect(error).toBeInstanceOf(CloudflareDeploymentError);
      return (error as CloudflareDeploymentError).reason;
    };
    expect(await reasonOf(async () => new Response("boom", { status: 502 }), (c) => c.readCurrent())).toBe("http-502");
    expect(await reasonOf(async () => { throw new TypeError("fetch failed"); }, (c) => c.readCurrent())).toBe("network");
    expect(await reasonOf(async () => Response.json({ success: false, result: null }), (c) => c.readCurrent())).toBe("envelope");
    expect(
      await reasonOf(
        async () => response({ id: "d", annotations: {}, versions: [{ version_id: candidateVersionId, percentage: 100 }] }),
        (c) => c.deployTest(priorVersionId, candidateVersionId),
      ),
    ).toBe("shape");
  });
});
