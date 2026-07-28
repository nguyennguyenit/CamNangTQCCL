import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import type { DataSource } from "./data/data-source.js";
import {
  R2DataSource,
  type ReadObject,
} from "./data/r2-data-source.js";
import { createMcpServer } from "./mcp/create-mcp-server.js";
import { createResearchHandlers } from "./research/research-handlers.js";
import {
  BearerAuthError,
  authenticateBearer,
  validateBearerConfiguration,
} from "./security/bearer-auth.js";
import {
  readBoundedJson,
  RequestGuardError,
  validateInitializeProtocol,
  validateMcpRequestHead,
} from "./security/request-guards.js";
import {
  InFlightLimiter,
  TokenRateLimiter,
} from "./security/request-limits.js";

interface R2ObjectBodyReader {
  readonly etag?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2BucketReader {
  get(key: string): Promise<R2ObjectBodyReader | null>;
}

export interface WorkerEnvironment {
  TQCCL_POINTER_BUCKET?: R2BucketReader;
  TQCCL_RELEASE_BUCKET?: R2BucketReader;
  TQCCL_MCP_BEARER_CURRENT?: string;
  TQCCL_MCP_BEARER_NEXT?: string;
  TQCCL_MCP_NEXT_TOKEN_NOT_AFTER?: string;
  TQCCL_MCP_ALLOWED_ORIGINS?: string;
  TQCCL_MCP_MAX_BODY_BYTES?: string;
  TQCCL_MCP_MAX_RESULT_BYTES?: string;
  TQCCL_MCP_RATE_MAX?: string;
  TQCCL_MCP_RATE_WINDOW_MS?: string;
  TQCCL_MCP_MAX_IN_FLIGHT?: string;
}

interface WorkerRuntimeOptions {
  createDataSource?: (environment: WorkerEnvironment) => DataSource;
  rateLimiter?: TokenRateLimiter;
  inFlightLimiter?: InFlightLimiter;
  now?: () => number;
}

interface RuntimeConfiguration {
  allowedOrigins: string[];
  maxBodyBytes: number;
  maxResultBytes: number;
  rateMax: number;
  rateWindowMs: number;
  maxInFlight: number;
}

function jsonResponse(
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function positiveInteger(value: string | undefined): number {
  if (value === undefined || !/^[1-9][0-9]*$/u.test(value)) {
    throw new Error("Cấu hình số không hợp lệ.");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("Cấu hình số không hợp lệ.");
  }
  return parsed;
}

function runtimeConfiguration(
  environment: WorkerEnvironment,
): RuntimeConfiguration {
  return {
    allowedOrigins: (environment.TQCCL_MCP_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxBodyBytes: positiveInteger(environment.TQCCL_MCP_MAX_BODY_BYTES),
    maxResultBytes: positiveInteger(environment.TQCCL_MCP_MAX_RESULT_BYTES),
    rateMax: positiveInteger(environment.TQCCL_MCP_RATE_MAX),
    rateWindowMs: positiveInteger(environment.TQCCL_MCP_RATE_WINDOW_MS),
    maxInFlight: positiveInteger(environment.TQCCL_MCP_MAX_IN_FLIGHT),
  };
}

async function readR2Object(
  bucket: R2BucketReader,
  key: string,
): Promise<ReadObject | null> {
  const object = await bucket.get(key);
  if (object === null) return null;
  return {
    bytes: new Uint8Array(await object.arrayBuffer()),
    ...(object.etag === undefined ? {} : { etag: object.etag }),
  };
}

function createR2DataSource(environment: WorkerEnvironment): DataSource {
  const pointerBucket = environment.TQCCL_POINTER_BUCKET;
  const releaseBucket = environment.TQCCL_RELEASE_BUCKET;
  if (pointerBucket === undefined || releaseBucket === undefined) {
    throw new Error("Thiếu R2 binding.");
  }
  return new R2DataSource({
    pointerReader: {
      readCurrent: () => readR2Object(pointerBucket, "current.json"),
    },
    releaseReader: {
      readKnownObject: (key) => readR2Object(releaseBucket, key),
    },
  });
}

async function boundedResponse(
  response: Response,
  maxResultBytes: number,
): Promise<Response> {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxResultBytes) {
    return jsonResponse(500, "RESULT_TOO_LARGE");
  }
  return new Response(bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function createWorker(options: WorkerRuntimeOptions = {}) {
  const now = options.now ?? Date.now;
  let defaultDataSource:
    | {
        pointer: R2BucketReader;
        release: R2BucketReader;
        source: DataSource;
      }
    | undefined;
  let defaultLimits:
    | {
        key: string;
        rate: TokenRateLimiter;
        inFlight: InFlightLimiter;
      }
    | undefined;

  function dataSource(environment: WorkerEnvironment): DataSource {
    if (options.createDataSource !== undefined) {
      return options.createDataSource(environment);
    }
    const pointer = environment.TQCCL_POINTER_BUCKET;
    const release = environment.TQCCL_RELEASE_BUCKET;
    if (pointer === undefined || release === undefined) {
      throw new Error("Thiếu R2 binding.");
    }
    if (
      defaultDataSource === undefined ||
      defaultDataSource.pointer !== pointer ||
      defaultDataSource.release !== release
    ) {
      defaultDataSource = {
        pointer,
        release,
        source: createR2DataSource(environment),
      };
    }
    return defaultDataSource.source;
  }

  function limits(configuration: RuntimeConfiguration) {
    if (
      options.rateLimiter !== undefined &&
      options.inFlightLimiter !== undefined
    ) {
      return {
        rate: options.rateLimiter,
        inFlight: options.inFlightLimiter,
      };
    }
    const key = [
      configuration.rateMax,
      configuration.rateWindowMs,
      configuration.maxInFlight,
    ].join(":");
    if (defaultLimits?.key !== key) {
      defaultLimits = {
        key,
        rate: new TokenRateLimiter({
          maxRequests: configuration.rateMax,
          windowMs: configuration.rateWindowMs,
        }),
        inFlight: new InFlightLimiter(configuration.maxInFlight),
      };
    }
    return {
      rate: options.rateLimiter ?? defaultLimits.rate,
      inFlight: options.inFlightLimiter ?? defaultLimits.inFlight,
    };
  }

  return {
    async fetch(
      request: Request,
      environment: WorkerEnvironment,
    ): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        if (request.method !== "GET") {
          return jsonResponse(405, "METHOD_NOT_ALLOWED");
        }
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      if (url.pathname !== "/mcp") return jsonResponse(404, "NOT_FOUND");

      let configuration: RuntimeConfiguration;
      try {
        configuration = runtimeConfiguration(environment);
        validateMcpRequestHead(request, {
          allowedOrigins: configuration.allowedOrigins,
          maxBodyBytes: configuration.maxBodyBytes,
        });
      } catch (error) {
        if (error instanceof RequestGuardError) {
          return jsonResponse(error.status, error.code);
        }
        return jsonResponse(503, "SERVICE_MISCONFIGURED");
      }

      let authenticated;
      try {
        const bearerConfiguration = validateBearerConfiguration(
          {
            currentToken: environment.TQCCL_MCP_BEARER_CURRENT,
            nextToken: environment.TQCCL_MCP_BEARER_NEXT,
            nextTokenNotAfter: environment.TQCCL_MCP_NEXT_TOKEN_NOT_AFTER,
          },
          now(),
        );
        authenticated = await authenticateBearer(
          request.headers.get("Authorization") ?? undefined,
          bearerConfiguration,
        );
      } catch (error) {
        if (
          error instanceof BearerAuthError &&
          error.code === "UNAUTHORIZED"
        ) {
          return jsonResponse(401, "UNAUTHORIZED", {
            "WWW-Authenticate": "Bearer",
          });
        }
        return jsonResponse(503, "SERVICE_MISCONFIGURED");
      }

      const requestLimits = limits(configuration);
      const rate = requestLimits.rate.consume(
        authenticated.fingerprint,
        now(),
      );
      if (!rate.allowed) {
        return jsonResponse(429, "RATE_LIMITED", {
          "Retry-After": String(rate.retryAfterSeconds),
        });
      }
      const release = requestLimits.inFlight.acquire();
      if (release === null) {
        return jsonResponse(429, "TOO_MANY_IN_FLIGHT", {
          "Retry-After": "1",
        });
      }

      try {
        if (request.method === "GET" || request.method === "DELETE") {
          return jsonResponse(405, "METHOD_NOT_ALLOWED");
        }
        const parsedBody = await readBoundedJson(
          request,
          configuration.maxBodyBytes,
        );
        validateInitializeProtocol(parsedBody);
        const handlers = createResearchHandlers({
          dataSource: dataSource(environment),
        });
        const server = createMcpServer({ handlers });
        const transport =
          new WebStandardStreamableHTTPServerTransport({
            enableJsonResponse: true,
          });
        try {
          await server.connect(transport);
          const response = await transport.handleRequest(request, {
            parsedBody,
          });
          return await boundedResponse(
            response,
            configuration.maxResultBytes,
          );
        } finally {
          await server.close();
        }
      } catch (error) {
        if (error instanceof RequestGuardError) {
          return jsonResponse(error.status, error.code);
        }
        return jsonResponse(500, "INTERNAL_ERROR");
      } finally {
        release();
      }
    },
  };
}

const worker = createWorker();

export default worker;
