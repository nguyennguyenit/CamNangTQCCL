import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodType } from "zod";

import type { ResearchToolName } from "../research/research-contracts.js";
import {
  ResearchHandlerError,
  type ResearchHandlers,
} from "../research/research-handlers.js";
import { formatToolError, formatToolResult } from "./format-result.js";
import {
  TOOL_DEFINITIONS,
  type ToolDefinition,
} from "./tool-definitions.js";

export interface McpServerDependencies {
  handlers: ResearchHandlers;
}

type RuntimeRegisterTool = (
  name: string,
  config: {
    description: string;
    inputSchema: ZodType;
    outputSchema: ZodType;
    annotations: ToolAnnotations;
  },
  callback: (input: unknown) => Promise<CallToolResult>,
) => unknown;

const INVALID_TOOL_INPUT = "TQCCL_INVALID_TOOL_INPUT";

interface RuntimeMcpServerBoundary {
  validateToolInput: (...args: unknown[]) => Promise<unknown>;
  createToolError: (errorMessage: string) => CallToolResult;
}

function installSafeToolErrorBoundary(server: McpServer): void {
  // The SDK validates tool input before invoking the registered callback.
  // These hooks are private in its typings, so keep the compatibility boundary
  // isolated and protect it with an official Client integration test.
  const runtime = server as unknown as RuntimeMcpServerBoundary;
  const validateToolInput = runtime.validateToolInput.bind(server);

  runtime.validateToolInput = async (...args: unknown[]) => {
    try {
      return await validateToolInput(...args);
    } catch {
      throw new Error(INVALID_TOOL_INPUT);
    }
  };

  runtime.createToolError = (errorMessage: string) => {
    if (errorMessage === INVALID_TOOL_INPUT) {
      return formatToolError(
        new ResearchHandlerError(
          "INVALID_REQUEST",
          "Input validation failed.",
          false,
        ),
      );
    }
    return formatToolError(new Error("MCP request failed."));
  };
}

function registerTool(
  server: McpServer,
  handlers: ResearchHandlers,
  definition: ToolDefinition,
): void {
  const name: ResearchToolName = definition.name;
  // The SDK's callback type distributes a union of whole Zod schemas into an
  // unusable intersection. This boundary keeps runtime validation authoritative.
  const register = server.registerTool.bind(server) as unknown as RuntimeRegisterTool;
  register(
    name,
    {
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      annotations: definition.annotations,
    },
    async (input: unknown) => {
      try {
        const result = await handlers.call(name, input as never);
        return formatToolResult(name, result);
      } catch (error) {
        return formatToolError(error);
      }
    },
  );
}

export function registerTools(
  server: McpServer,
  handlers: ResearchHandlers,
): void {
  for (const definition of TOOL_DEFINITIONS) {
    registerTool(server, handlers, definition);
  }
}

export function createMcpServer({
  handlers,
}: McpServerDependencies): McpServer {
  const server = new McpServer({
    name: "tqccl-research",
    version: "0.1.0",
  });
  installSafeToolErrorBoundary(server);
  registerTools(server, handlers);
  return server;
}
