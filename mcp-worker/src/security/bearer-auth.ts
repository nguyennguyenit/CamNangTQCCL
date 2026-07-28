const MIN_TOKEN_BYTES = 32;
const MAX_OVERLAP_MS = 15 * 60_000;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

export class BearerAuthError extends Error {
  constructor(
    readonly code: "AUTH_CONFIG_INVALID" | "UNAUTHORIZED",
  ) {
    super(
      code === "AUTH_CONFIG_INVALID"
        ? "Cấu hình xác thực không hợp lệ."
        : "Không được phép.",
    );
    this.name = "BearerAuthError";
  }
}

export interface BearerConfigurationInput {
  currentToken?: unknown;
  nextToken?: unknown;
  nextTokenNotAfter?: unknown;
}

export interface ValidatedBearerConfiguration {
  readonly currentToken: string;
  readonly nextToken?: string;
  readonly nextTokenNotAfterMs?: number;
}

export interface AuthenticatedBearer {
  slot: "current" | "next";
  fingerprint: string;
}

function decodedByteLength(value: string): number {
  if (!BASE64URL_PATTERN.test(value)) return -1;
  try {
    const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    return atob(padded).length;
  } catch {
    return -1;
  }
}

function isStrongToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    decodedByteLength(value) >= MIN_TOKEN_BYTES
  );
}

function invalidConfiguration(): never {
  throw new BearerAuthError("AUTH_CONFIG_INVALID");
}

export function validateBearerConfiguration(
  input: BearerConfigurationInput,
  nowMs = Date.now(),
): ValidatedBearerConfiguration {
  if (!isStrongToken(input.currentToken) || !Number.isFinite(nowMs)) {
    invalidConfiguration();
  }

  const hasNext = input.nextToken !== undefined;
  const hasExpiry = input.nextTokenNotAfter !== undefined;
  if (hasNext !== hasExpiry) invalidConfiguration();
  if (!hasNext) return { currentToken: input.currentToken };

  if (
    !isStrongToken(input.nextToken) ||
    input.nextToken === input.currentToken ||
    typeof input.nextTokenNotAfter !== "string"
  ) {
    invalidConfiguration();
  }
  const nextTokenNotAfterMs = Date.parse(input.nextTokenNotAfter);
  if (
    !Number.isFinite(nextTokenNotAfterMs) ||
    nextTokenNotAfterMs <= nowMs ||
    nextTokenNotAfterMs > nowMs + MAX_OVERLAP_MS
  ) {
    invalidConfiguration();
  }

  return {
    currentToken: input.currentToken,
    nextToken: input.nextToken,
    nextTokenNotAfterMs,
  };
}

export function parseBearer(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer ([A-Za-z0-9_-]+)$/u.exec(header);
  return match?.[1] ?? null;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function fingerprint(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function authenticateBearer(
  header: string | undefined,
  configuration: ValidatedBearerConfiguration,
): Promise<AuthenticatedBearer> {
  const presented = parseBearer(header);
  if (presented === null) throw new BearerAuthError("UNAUTHORIZED");

  const [presentedDigest, currentDigest, nextDigest] = await Promise.all([
    digest(presented),
    digest(configuration.currentToken),
    digest(configuration.nextToken ?? configuration.currentToken),
  ]);
  const currentMatches = equalBytes(presentedDigest, currentDigest);
  const nextMatches =
    configuration.nextToken !== undefined &&
    equalBytes(presentedDigest, nextDigest);

  if (!currentMatches && !nextMatches) {
    throw new BearerAuthError("UNAUTHORIZED");
  }
  return {
    slot: currentMatches ? "current" : "next",
    fingerprint: fingerprint(presentedDigest),
  };
}

