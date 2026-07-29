import type { DeploymentState } from "./publish-data-release.js";

const VERSION_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;

export interface WorkerDeploymentSnapshot {
  deploymentId: string;
  versions: Array<{
    versionId: string;
    percentage: number;
  }>;
}

export class CloudflareDeploymentError extends Error {
  constructor() {
    super("Không thể quản lý Worker deployment.");
    this.name = "CloudflareDeploymentError";
  }
}

interface CloudflareDeploymentClientOptions {
  accountId: string;
  workerName: string;
  apiToken: string;
  fetcher?: typeof fetch;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CloudflareDeploymentError();
  }
  return value as Record<string, unknown>;
}

function parseDeployment(value: unknown): WorkerDeploymentSnapshot {
  const deployment = record(value);
  if (
    typeof deployment.id !== "string" ||
    deployment.id === "" ||
    deployment.strategy !== "percentage" ||
    !Array.isArray(deployment.versions) ||
    deployment.versions.length < 1 ||
    deployment.versions.length > 2
  ) {
    throw new CloudflareDeploymentError();
  }
  const versions = deployment.versions.map((value) => {
    const version = record(value);
    if (
      typeof version.version_id !== "string" ||
      !VERSION_ID_PATTERN.test(version.version_id) ||
      typeof version.percentage !== "number" ||
      !Number.isFinite(version.percentage) ||
      version.percentage <= 0 ||
      version.percentage > 100
    ) {
      throw new CloudflareDeploymentError();
    }
    return {
      versionId: version.version_id,
      percentage: version.percentage,
    };
  });
  const total = versions.reduce(
    (sum, version) => sum + version.percentage,
    0,
  );
  if (Math.abs(total - 100) > Number.EPSILON) {
    throw new CloudflareDeploymentError();
  }
  return { deploymentId: deployment.id, versions };
}

export class CloudflareDeploymentClient {
  readonly #endpoint: URL;
  readonly #apiToken: string;
  readonly #fetcher: typeof fetch;

  constructor(options: CloudflareDeploymentClientOptions) {
    if (
      !/^[a-f0-9]{32}$/u.test(options.accountId) ||
      !/^[a-z0-9][a-z0-9_-]{0,62}$/u.test(options.workerName) ||
      options.apiToken === ""
    ) {
      throw new CloudflareDeploymentError();
    }
    this.#endpoint = new URL(
      `/client/v4/accounts/${options.accountId}/workers/scripts/${encodeURIComponent(options.workerName)}/deployments`,
      "https://api.cloudflare.com",
    );
    this.#apiToken = options.apiToken;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async #request(
    method: "GET" | "POST",
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await this.#fetcher(
        new Request(this.#endpoint, {
          method,
          headers: {
            Authorization: `Bearer ${this.#apiToken}`,
            Accept: "application/json",
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
      if (!response.ok) throw new Error("request failed");
      const envelope = record(await response.json());
      if (envelope.success !== true || envelope.result === undefined) {
        throw new Error("invalid envelope");
      }
      return envelope.result;
    } catch {
      throw new CloudflareDeploymentError();
    }
  }

  async readCurrent(): Promise<WorkerDeploymentSnapshot> {
    try {
      const result = record(await this.#request("GET"));
      if (!Array.isArray(result.deployments) || result.deployments.length < 1) {
        throw new Error("missing deployment");
      }
      return parseDeployment(result.deployments[0]);
    } catch {
      throw new CloudflareDeploymentError();
    }
  }

  async #deploy(
    versions: WorkerDeploymentSnapshot["versions"],
    message: string,
  ): Promise<WorkerDeploymentSnapshot> {
    return parseDeployment(
      await this.#request("POST", {
        strategy: "percentage",
        versions: versions.map((version) => ({
          version_id: version.versionId,
          percentage: version.percentage,
        })),
        annotations: {
          "workers/message": message,
          "workers/triggered_by": "deployment",
        },
      }),
    );
  }

  async deployExclusive(versionId: string): Promise<DeploymentState> {
    if (!VERSION_ID_PATTERN.test(versionId)) {
      throw new CloudflareDeploymentError();
    }
    const deployed = await this.#deploy(
      [{ versionId, percentage: 100 }],
      "Activate immutable TQCCL MCP release",
    );
    if (
      deployed.versions.length !== 1 ||
      deployed.versions[0]?.versionId !== versionId ||
      deployed.versions[0].percentage !== 100
    ) {
      throw new CloudflareDeploymentError();
    }
    return {
      versionId,
      percentage: 100,
      activeVersions: 1,
    };
  }

}
