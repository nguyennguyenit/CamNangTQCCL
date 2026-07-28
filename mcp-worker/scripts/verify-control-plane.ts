import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CONTROL_IDS = [
  "edge-mcp-rate-limit",
  "release-bucket-lock",
  "release-bucket-events",
  "pointer-bucket-events",
] as const;

interface ControlRequirement {
  id: (typeof CONTROL_IDS)[number];
  owner: string;
  evidenceOwner: string;
  endpoint: string;
  expected: Record<string, unknown>;
  failureBehavior: string;
  rollbackBehavior: string;
}

export interface ControlPlaneRequirements {
  schemaVersion: 1;
  productionEnabledOnlyWhenVerified: true;
  controls: ControlRequirement[];
}

export interface LiveVerificationOptions {
  accountId: string;
  zoneId: string;
  releaseBucket: string;
  pointerBucket: string;
  apiToken: string;
  fetcher?: typeof fetch;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requireText(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Control plane requirement không hợp lệ.");
  }
  return value;
}

export function validateControlPlaneRequirements(
  input: unknown,
): ControlPlaneRequirements {
  const root = record(input);
  if (
    root?.schemaVersion !== 1 ||
    root.productionEnabledOnlyWhenVerified !== true ||
    !Array.isArray(root.controls) ||
    root.controls.length !== CONTROL_IDS.length
  ) {
    throw new Error("Control plane requirements không hợp lệ.");
  }

  const controls = root.controls.map((value, index) => {
    const control = record(value);
    const expectedId = CONTROL_IDS[index];
    const expected = record(control?.expected);
    if (
      control === null ||
      expectedId === undefined ||
      control.id !== expectedId ||
      expected === null
    ) {
      throw new Error("Control plane requirements không hợp lệ.");
    }
    return {
      id: expectedId,
      owner: requireText(control.owner),
      evidenceOwner: requireText(control.evidenceOwner),
      endpoint: requireText(control.endpoint),
      expected,
      failureBehavior: requireText(control.failureBehavior),
      rollbackBehavior: requireText(control.rollbackBehavior),
    };
  });

  return {
    schemaVersion: 1,
    productionEnabledOnlyWhenVerified: true,
    controls,
  };
}

function substituteEndpoint(
  endpoint: string,
  options: LiveVerificationOptions,
): string {
  const values: Record<string, string> = {
    account_id: options.accountId,
    zone_id: options.zoneId,
    release_bucket: options.releaseBucket,
    pointer_bucket: options.pointerBucket,
  };
  return endpoint.replace(/\{([a-z_]+)\}/gu, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === "") {
      throw new Error("Thiếu định danh control plane.");
    }
    return encodeURIComponent(value);
  });
}

async function getResult(
  endpoint: string,
  options: LiveVerificationOptions,
): Promise<Record<string, unknown>> {
  const response = await (options.fetcher ?? fetch)(
    `https://api.cloudflare.com/client/v4${substituteEndpoint(endpoint, options)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${options.apiToken}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) throw new Error("Không thể đọc control plane.");
  const envelope = record(await response.json());
  const result = record(envelope?.result);
  if (envelope?.success !== true || result === null) {
    throw new Error("Phản hồi control plane không hợp lệ.");
  }
  return result;
}

function verifyRate(
  result: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  if (!Array.isArray(result.rules)) return false;
  return result.rules.some((value) => {
    const rule = record(value);
    const rate = record(rule?.ratelimit);
    return (
      rule !== null &&
      rule.description === expected.ruleDescription &&
      rule.enabled === true &&
      rule.action === expected.action &&
      rule.expression === expected.expression &&
      rate?.requests_per_period === expected.maximumRequests &&
      rate?.period === expected.periodSeconds
    );
  });
}

function verifyLock(
  result: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  if (!Array.isArray(result.rules)) return false;
  return result.rules.some((value) => {
    const rule = record(value);
    const condition = record(rule?.condition);
    return (
      rule?.enabled === true &&
      rule.prefix === expected.prefix &&
      condition?.type === "Age" &&
      typeof condition.maxAgeSeconds === "number" &&
      typeof expected.minimumRetentionSeconds === "number" &&
      condition.maxAgeSeconds >= expected.minimumRetentionSeconds
    );
  });
}

function verifyEvents(
  result: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  const expectedActions = expected.actions;
  if (!Array.isArray(result.queues) || !Array.isArray(expectedActions)) {
    return false;
  }
  return result.queues.some((queueValue) => {
    const queue = record(queueValue);
    if (
      typeof queue?.queueName !== "string" ||
      typeof expected.queueNamePrefix !== "string" ||
      !queue.queueName.startsWith(expected.queueNamePrefix) ||
      !Array.isArray(queue.rules)
    ) {
      return false;
    }
    const observed = new Set<string>();
    for (const ruleValue of queue.rules) {
      const rule = record(ruleValue);
      if (!Array.isArray(rule?.actions)) continue;
      for (const action of rule.actions) {
        if (typeof action === "string") observed.add(action);
      }
    }
    return expectedActions.every(
      (action) => typeof action === "string" && observed.has(action),
    );
  });
}

export async function verifyControlPlaneLive(
  input: unknown,
  options: LiveVerificationOptions,
): Promise<{ verified: true; controls: number }> {
  const requirements = validateControlPlaneRequirements(input);
  if (options.apiToken === "") {
    throw new Error("Thiếu credential chỉ đọc.");
  }
  for (const control of requirements.controls) {
    const result = await getResult(control.endpoint, options);
    const verified =
      control.id === "edge-mcp-rate-limit"
        ? verifyRate(result, control.expected)
        : control.id === "release-bucket-lock"
          ? verifyLock(result, control.expected)
          : verifyEvents(result, control.expected);
    if (!verified) {
      throw new Error(`Control ${control.id} không đạt trạng thái yêu cầu.`);
    }
  }
  return { verified: true, controls: requirements.controls.length };
}

async function main(): Promise<void> {
  try {
    const requirements = JSON.parse(
      await readFile(
        new URL("../infra/control-plane-requirements.json", import.meta.url),
        "utf8",
      ),
    );
    validateControlPlaneRequirements(requirements);
    if (process.argv[2] === "--live") {
      await verifyControlPlaneLive(requirements, {
        accountId: process.env["CLOUDFLARE_ACCOUNT_ID"] ?? "",
        zoneId: process.env["CLOUDFLARE_ZONE_ID"] ?? "",
        releaseBucket: process.env["TQCCL_RELEASE_BUCKET_NAME"] ?? "",
        pointerBucket: process.env["TQCCL_POINTER_BUCKET_NAME"] ?? "",
        apiToken: process.env["CLOUDFLARE_API_TOKEN"] ?? "",
      });
      process.stderr.write("Control plane live đã được xác minh.\n");
    } else if (process.argv[2] === "--artifact-only") {
      process.stderr.write("Control plane artifact hợp lệ.\n");
    } else {
      throw new Error("Cách dùng không hợp lệ.");
    }
  } catch {
    process.stderr.write("Xác minh control plane thất bại.\n");
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
