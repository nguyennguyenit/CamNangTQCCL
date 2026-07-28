import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodType } from "zod";

import type { ResearchToolName } from "../research/research-contracts.js";
import type { ResearchHandlers } from "../research/research-handlers.js";
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
  registerTools(server, handlers);
  return server;
}
