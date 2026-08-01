import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import type { DataSource } from "./data/data-source.js";
import {
  StaticAssetsDataSource,
  type AssetFetcher,
} from "./data/static-assets-data-source.js";
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
import {
  isWorkerVersionId,
  WORKER_VERSION_HEADER,
} from "./transport/worker-version-header.js";

export { WORKER_VERSION_HEADER } from "./transport/worker-version-header.js";

export interface WorkerVersionMetadata {
  id: string;
  tag?: string;
  timestamp?: string;
}

export interface WorkerEnvironment {
  ASSETS?: AssetFetcher;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
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

function authenticatedResponse(response: Response, versionId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(WORKER_VERSION_HEADER, versionId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
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
        assets: AssetFetcher;
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
    const assets = environment.ASSETS;
    if (assets === undefined) {
      throw new Error("Thiếu Static Assets binding.");
    }
    if (
      defaultDataSource === undefined ||
      defaultDataSource.assets !== assets
    ) {
      defaultDataSource = {
        assets,
        source: new StaticAssetsDataSource({ fetcher: assets }),
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

      const versionId = environment.CF_VERSION_METADATA?.id;
      if (!isWorkerVersionId(versionId)) {
        return jsonResponse(503, "SERVICE_MISCONFIGURED");
      }
      const respond = (response: Response) =>
        authenticatedResponse(response, versionId);

      const requestLimits = limits(configuration);
      const rate = requestLimits.rate.consume(
        authenticated.fingerprint,
        now(),
      );
      if (!rate.allowed) {
        return respond(jsonResponse(429, "RATE_LIMITED", {
          "Retry-After": String(rate.retryAfterSeconds),
        }));
      }
      const release = requestLimits.inFlight.acquire();
      if (release === null) {
        return respond(jsonResponse(429, "TOO_MANY_IN_FLIGHT", {
          "Retry-After": "1",
        }));
      }

      try {
        if (request.method === "GET" || request.method === "DELETE") {
          return respond(jsonResponse(405, "METHOD_NOT_ALLOWED"));
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
          return respond(
            await boundedResponse(response, configuration.maxResultBytes),
          );
        } finally {
          await server.close();
        }
      } catch (error) {
        if (error instanceof RequestGuardError) {
          return respond(jsonResponse(error.status, error.code));
        }
        return respond(jsonResponse(500, "INTERNAL_ERROR"));
      } finally {
        release();
      }
    },
  };
}

const worker = createWorker();

export default worker;
