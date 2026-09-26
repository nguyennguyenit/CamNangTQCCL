const MCP_METHODS = new Set(["GET", "POST", "DELETE"]);

export class RequestGuardError extends Error {
  constructor(
    readonly status: 400 | 403 | 405 | 406 | 413 | 415,
    readonly code:
      | "METHOD_NOT_ALLOWED"
      | "ORIGIN_NOT_ALLOWED"
      | "CONTENT_TYPE_NOT_ALLOWED"
      | "CONTENT_ENCODING_NOT_ALLOWED"
      | "NOT_ACCEPTABLE"
      | "BODY_TOO_LARGE"
      | "INVALID_CONTENT_LENGTH"
      | "INVALID_JSON"
      | "PROTOCOL_VERSION_NOT_SUPPORTED",
  ) {
    super("Request MCP không hợp lệ.");
    this.name = "RequestGuardError";
  }
}

export const SELECTED_MCP_PROTOCOL_VERSION = "2025-11-25";

export function validateInitializeProtocol(body: unknown): void {
  const messages = Array.isArray(body) ? body : [body];
  for (const message of messages) {
    if (
      typeof message !== "object" ||
      message === null ||
      Array.isArray(message) ||
      (message as Record<string, unknown>).method !== "initialize"
    ) {
      continue;
    }
    const params = (message as Record<string, unknown>).params;
    if (
      typeof params !== "object" ||
      params === null ||
      Array.isArray(params) ||
      (params as Record<string, unknown>).protocolVersion !==
        SELECTED_MCP_PROTOCOL_VERSION
    ) {
      throw new RequestGuardError(
        400,
        "PROTOCOL_VERSION_NOT_SUPPORTED",
      );
    }
  }
}

export interface McpRequestGuardOptions {
  allowedOrigins: readonly string[];
  maxBodyBytes: number;
}

function mediaTypes(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.split(";", 1)[0]!.trim().toLowerCase())
    .filter(Boolean);
}

export function validateMcpRequestHead(
  request: Request,
  options: McpRequestGuardOptions,
): void {
  if (!MCP_METHODS.has(request.method)) {
    throw new RequestGuardError(405, "METHOD_NOT_ALLOWED");
  }

  const origin = request.headers.get("Origin");
  if (origin !== null && !options.allowedOrigins.includes(origin)) {
    throw new RequestGuardError(403, "ORIGIN_NOT_ALLOWED");
  }

  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    if (!/^(0|[1-9][0-9]*)$/u.test(declaredLength)) {
      throw new RequestGuardError(400, "INVALID_CONTENT_LENGTH");
    }
    if (Number(declaredLength) > options.maxBodyBytes) {
      throw new RequestGuardError(413, "BODY_TOO_LARGE");
    }
  }

  if (request.method !== "POST") return;

  const contentType = request.headers.get("Content-Type");
  if (
    contentType === null ||
    mediaTypes(contentType)[0] !== "application/json"
  ) {
    throw new RequestGuardError(415, "CONTENT_TYPE_NOT_ALLOWED");
  }
  const contentEncoding = request.headers.get("Content-Encoding");
  if (
    contentEncoding !== null &&
    contentEncoding.trim().toLowerCase() !== "identity"
  ) {
    throw new RequestGuardError(415, "CONTENT_ENCODING_NOT_ALLOWED");
  }
  const accept = request.headers.get("Accept");
  if (accept !== null) {
    const accepted = mediaTypes(accept);
    if (
      !accepted.includes("*/*") &&
      !accepted.includes("application/json") &&
      !accepted.includes("text/event-stream")
    ) {
      throw new RequestGuardError(406, "NOT_ACCEPTABLE");
    }
  }
}

export async function readBoundedJson(
  request: Request,
  maxBodyBytes: number,
): Promise<unknown> {
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) {
    throw new Error("maxBodyBytes phải là số nguyên dương.");
  }
  if (request.body === null) {
    throw new RequestGuardError(400, "INVALID_JSON");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBodyBytes) {
        await reader.cancel();
        throw new RequestGuardError(413, "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: false,
      }).decode(bytes),
    );
  } catch {
    throw new RequestGuardError(400, "INVALID_JSON");
  }
}
