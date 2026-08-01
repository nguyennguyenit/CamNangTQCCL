const VERSION_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;

export interface WorkerDeploymentSnapshot {
  deploymentId: string;
  ownerTag: string | null;
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
  runId: string;
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
      version.percentage < 0 ||
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
  const annotations =
    deployment.annotations === undefined
      ? null
      : record(deployment.annotations);
  const message = annotations?.["workers/message"];
  if (message !== undefined && typeof message !== "string") {
    throw new CloudflareDeploymentError();
  }
  const ownerTag =
    typeof message === "string"
      ? /^TQCCL_RUN:([A-Za-z0-9._:-]{1,128}):(?:bootstrap|smoke|promote|restore|rollback)$/u.exec(
          message,
        )?.[1] ?? null
      : null;
  return {
    deploymentId: deployment.id,
    ownerTag,
    versions,
  };
}

export class CloudflareDeploymentClient {
  readonly #endpoint: URL;
  readonly #apiToken: string;
  readonly #fetcher: typeof fetch;
  readonly #runId: string;

  constructor(options: CloudflareDeploymentClientOptions) {
    if (
      !/^[a-f0-9]{32}$/u.test(options.accountId) ||
      !/^[a-z0-9][a-z0-9_-]{0,62}$/u.test(options.workerName) ||
      !/^[A-Za-z0-9._:-]{1,128}$/u.test(options.runId) ||
      options.apiToken === ""
    ) {
      throw new CloudflareDeploymentError();
    }
    this.#endpoint = new URL(
      `/client/v4/accounts/${options.accountId}/workers/scripts/${encodeURIComponent(options.workerName)}/deployments`,
      "https://api.cloudflare.com",
    );
    this.#apiToken = options.apiToken;
    this.#runId = options.runId;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async #request(
    method: "GET" | "POST",
    body?: Record<string, unknown>,
    allowMissingWorker = false,
  ): Promise<unknown | null> {
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
      if (allowMissingWorker && response.status === 404) return null;
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

  async readCurrentOptional(): Promise<WorkerDeploymentSnapshot | null> {
    try {
      const response = await this.#request("GET", undefined, true);
      if (response === null) return null;
      const result = record(response);
      if (!Array.isArray(result.deployments)) {
        throw new Error("invalid deployments");
      }
      if (result.deployments.length === 0) return null;
      return parseDeployment(result.deployments[0]);
    } catch {
      throw new CloudflareDeploymentError();
    }
  }

  async readCurrent(): Promise<WorkerDeploymentSnapshot> {
    const current = await this.readCurrentOptional();
    if (current === null) throw new CloudflareDeploymentError();
    return current;
  }

  async #deploy(
    versions: WorkerDeploymentSnapshot["versions"],
    purpose: "bootstrap" | "smoke" | "promote" | "restore" | "rollback",
  ): Promise<WorkerDeploymentSnapshot> {
    return parseDeployment(
      await this.#request("POST", {
        strategy: "percentage",
        versions: versions.map((version) => ({
          version_id: version.versionId,
          percentage: version.percentage,
        })),
        annotations: {
          "workers/message": `TQCCL_RUN:${this.#runId}:${purpose}`,
        },
      }),
    );
  }

  async deployExclusive(
    versionId: string,
    purpose: "bootstrap" | "promote" | "restore" | "rollback" = "promote",
  ): Promise<WorkerDeploymentSnapshot> {
    if (!VERSION_ID_PATTERN.test(versionId)) {
      throw new CloudflareDeploymentError();
    }
    const deployed = await this.#deploy(
      [{ versionId, percentage: 100 }],
      purpose,
    );
    if (
      deployed.versions.length !== 1 ||
      deployed.versions[0]?.versionId !== versionId ||
      deployed.versions[0].percentage !== 100 ||
      deployed.ownerTag !== this.#runId
    ) {
      throw new CloudflareDeploymentError();
    }
    return deployed;
  }

  async deployTest(
    priorVersionId: string,
    candidateVersionId: string,
  ): Promise<WorkerDeploymentSnapshot> {
    if (
      !VERSION_ID_PATTERN.test(priorVersionId) ||
      !VERSION_ID_PATTERN.test(candidateVersionId) ||
      priorVersionId === candidateVersionId
    ) {
      throw new CloudflareDeploymentError();
    }
    const deployed = await this.#deploy(
      [
        { versionId: priorVersionId, percentage: 100 },
        { versionId: candidateVersionId, percentage: 0 },
      ],
      "smoke",
    );
    if (
      deployed.versions.length !== 2 ||
      deployed.versions[0]?.versionId !== priorVersionId ||
      deployed.versions[0].percentage !== 100 ||
      deployed.versions[1]?.versionId !== candidateVersionId ||
      deployed.versions[1].percentage !== 0 ||
      deployed.ownerTag !== this.#runId
    ) {
      throw new CloudflareDeploymentError();
    }
    return deployed;
  }

}
