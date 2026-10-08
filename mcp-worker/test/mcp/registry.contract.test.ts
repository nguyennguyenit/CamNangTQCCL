import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { toJSONSchema } from "zod";

import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import {
  RESEARCH_CONTRACTS,
  RESEARCH_TOOL_NAMES,
} from "../../src/research/research-contracts.js";
import {
  ResearchHandlerError,
  createResearchHandlers,
  type ResearchHandlers,
} from "../../src/research/research-handlers.js";
import { createMcpServer } from "../../src/mcp/create-mcp-server.js";
import {
  formatToolError,
  formatToolResult,
} from "../../src/mcp/format-result.js";
import { MAX_RESULT_BYTES } from "../../src/research/tool-context.js";
import { TOOL_DEFINITIONS } from "../../src/mcp/tool-definitions.js";

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);

const connected: Array<{
  client: Client;
  server: ReturnType<typeof createMcpServer>;
}> = [];

afterEach(async () => {
  await Promise.all(
    connected.splice(0).map(async ({ client, server }) => {
      await client.close();
      await server.close();
    }),
  );
});

async function connect(handlers: ResearchHandlers) {
  const server = createMcpServer({ handlers });
  const client = new Client({
    name: "registry-contract-test",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  connected.push({ client, server });
  return { client, server };
}

function fieldsWithoutDescriptions(
  value: unknown,
  path = "$",
): string[] {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return [];
  }
  const schema = value as Record<string, unknown>;
  const missing: string[] = [];
  if (
    typeof schema.properties === "object" &&
    schema.properties !== null &&
    !Array.isArray(schema.properties)
  ) {
    for (const [name, property] of Object.entries(
      schema.properties as Record<string, unknown>,
    )) {
      const propertyPath = `${path}.${name}`;
      if (
        typeof property !== "object" ||
        property === null ||
        Array.isArray(property) ||
        typeof (property as Record<string, unknown>).description !==
          "string"
      ) {
        missing.push(propertyPath);
      }
      missing.push(...fieldsWithoutDescriptions(property, propertyPath));
    }
  }
  if (schema.items !== undefined) {
    missing.push(...fieldsWithoutDescriptions(schema.items, `${path}[]`));
  }
  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    const variants = schema[keyword];
    if (Array.isArray(variants)) {
      variants.forEach((variant, index) => {
        missing.push(
          ...fieldsWithoutDescriptions(
            variant,
            `${path}.${keyword}[${index}]`,
          ),
        );
      });
    }
  }
  return missing;
}

describe("registry công cụ MCP", () => {
  it("dùng lại đúng bảy schema object P* và annotation cố định", () => {
    expect(TOOL_DEFINITIONS.map(({ name }) => name)).toEqual(
      RESEARCH_TOOL_NAMES,
    );
    expect(new Set(TOOL_DEFINITIONS.map(({ name }) => name)).size).toBe(7);

    for (const definition of TOOL_DEFINITIONS) {
      expect(definition.inputSchema).toBe(
        RESEARCH_CONTRACTS[definition.name].input,
      );
      // Schema công bố hợp nhất nhánh thành công và nhánh lỗi vào một object,
      // vì MCP bắt outputSchema phải kiểu object và SDK bỏ im lặng mọi union.
      expect(definition.outputSchema).not.toBe(
        RESEARCH_CONTRACTS[definition.name].output,
      );
      expect(
        definition.outputSchema.safeParse({
          error: {
            code: "INVALID_REQUEST",
            message: "Yêu cầu không hợp lệ.",
            nextAction: "Kiểm tra input theo schema công cụ rồi thử lại.",
            retryable: false,
            fields: ["limit"],
          },
        }).success,
      ).toBe(true);
      expect(definition.outputSchema.safeParse({ lac: "de" }).success).toBe(
        false,
      );
      expect(definition.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  it("chỉ công bố đúng bảy tên, schema gốc object phẳng và mô tả mở đầu theo mẫu", async () => {
    const handlers = createResearchHandlers({ dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }) });
    const { client } = await connect(handlers);
    const { tools } = await client.listTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "tqccl_get_playbook",
      "tqccl_search",
      "tqccl_get_entity",
      "tqccl_find_teams",
      "tqccl_get_team",
      "tqccl_normalize_entities",
      "tqccl_recommend_teams",
    ]);
    const forbidden = /"(oneOf|anyOf|allOf|\$ref|\$defs|definitions)"/u;
    for (const tool of tools) {
      expect(tool.inputSchema.type, tool.name).toBe("object");
      expect(JSON.stringify(tool.inputSchema), tool.name).not.toMatch(forbidden);
      const head = new TextDecoder().decode(new TextEncoder().encode(tool.description ?? "").slice(0, 200));
      expect(head, tool.name).toMatch(/^Khi dùng:/u);
      expect(head, tool.name).toContain("Trả về:");
      expect(head, tool.name).toContain("Có thể lỗi:");
      // Cả danh sách lỗi nằm trong 200 byte đầu: client chỉ hiển thị phần đầu mô tả.
      expect(new TextEncoder().encode(tool.description ?? "").byteLength, tool.name).toBeLessThanOrEqual(200);
    }
  });

  it("mô tả đầy đủ cách dùng, kết quả, lỗi và mọi field public", () => {
    for (const definition of TOOL_DEFINITIONS) {
      expect(definition.description).toContain("Khi dùng:");
      expect(definition.description).toContain("Trả về:");
      expect(definition.description).toContain("Có thể lỗi:");

      const input = toJSONSchema(definition.inputSchema, {
        target: "draft-7",
      });
      const output = toJSONSchema(definition.outputSchema, {
        target: "draft-7",
      });
      expect(
        fieldsWithoutDescriptions(
          input,
          `${definition.name}.input`,
        ),
      ).toEqual([]);
      // Output: tools/list chỉ công bố mô tả field cấp gốc (xem slim-tool-list.ts), nên chỉ bắt buộc ở đó.
      const rootOutput = {
        properties: (output as { properties: Record<string, unknown> }).properties,
      };
      expect(
        fieldsWithoutDescriptions(
          { properties: Object.fromEntries(Object.entries(rootOutput.properties).map(([key, value]) => [key, { description: (value as { description?: string }).description }])) },
          `${definition.name}.output`,
        ),
      ).toEqual([]);
    }
  });

  it("tạo server mới chưa kết nối ở mỗi lần gọi factory", () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const first = createMcpServer({ handlers });
    const second = createMcpServer({ handlers });

    expect(first).not.toBe(second);
    expect(first.isConnected()).toBe(false);
    expect(second.isConnected()).toBe(false);
  });

  it("liệt kê và gọi catalog dùng chung qua client chính thức", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const { client } = await connect(handlers);

    const listed = await client.listTools();
    expect(listed.tools.map(({ name }) => name)).toEqual(RESEARCH_TOOL_NAMES);
    for (const tool of listed.tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }

    const called = await client.callTool({
      name: "tqccl_get_playbook",
      arguments: { intent: "lookup" },
    });
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({
      releaseId: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      dataVersion: expect.stringMatching(/^data:[a-f0-9]{12}$/),
    });
  });

  it("text content là JSON tương đương structuredContent và vẫn vừa giới hạn kích thước", () => {
    const payload = {
      releaseId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      dataVersion: "data:aaaaaaaaaaaa",
      workflowVersion: "workflow:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      truncated: false,
      warnings: [],
      query: "Quan Vũ",
      results: [{ label: "Chiến pháp \"Uy\"" }],
    };
    const formatted = formatToolResult(payload);
    const [block] = formatted.content as Array<{ type: string; text: string }>;
    expect(block!.type).toBe("text");
    expect(JSON.parse(block!.text)).toEqual(formatted.structuredContent);
    expect(formatted.content).toHaveLength(1);
  });

  it("giữ tổng text + structuredContent tối đa dưới trần phản hồi Worker", () => {
    // Mỗi kết quả tối đa MAX_RESULT_BYTES; text lặp lại nên cả hai phải vừa trần phản hồi với biên JSON-escape.
    expect(MAX_RESULT_BYTES * 2 * 1.1).toBeLessThan(98_304);
  });

  it("ánh xạ lỗi handler thành lỗi protocol hợp lệ đã làm sạch", async () => {
    const handlers = {
      async call() {
        throw new ResearchHandlerError(
          "DATA_UNAVAILABLE",
          "private path /tmp/secret and source payload",
          true,
        );
      },
    } as ResearchHandlers;
    const { client } = await connect(handlers);

    const result = await client.callTool({
      name: "tqccl_get_playbook",
      arguments: { intent: "lookup" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        code: "DATA_UNAVAILABLE",
        message: "Dữ liệu nghiên cứu hiện không khả dụng.",
        nextAction:
          "Thử lại sau; nếu lỗi tiếp diễn, kiểm tra readiness và release hiện hành.",
        retryable: true,
      },
    });
    expect(JSON.stringify(result.content)).toContain("DATA_UNAVAILABLE");
    expect(JSON.stringify(result.content)).toContain("Thử lại sau");
    expect(JSON.stringify(result)).not.toContain("/tmp/secret");
    expect(JSON.stringify(result)).not.toContain("source payload");
  });

  it("làm sạch lỗi input bị SDK chặn trước handler", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const { client } = await connect(handlers);

    const result = await client.callTool({
      name: "tqccl_search",
      arguments: {
        query: 123,
        secret: "TOP_SECRET_TOKEN",
      },
    });

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          code: "INVALID_REQUEST",
          message:
            "Yêu cầu không hợp lệ. Trường sai: query, input. Có trường không có trong schema; chỉ gửi các trường được khai báo.",
          nextAction: "Kiểm tra input theo schema công cụ rồi thử lại.",
          retryable: false,
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("TOP_SECRET_TOKEN");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("expected string");
  });

  it("giao được envelope lỗi cho client đã cache outputSchema", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const { client } = await connect(handlers);

    // Host thật luôn liệt kê tool trước. Bước này bật validator phía client cho
    // structuredContent của MỌI kết quả, kể cả isError — bỏ qua nó thì đường
    // lỗi chạy qua một client không validate và hợp đồng thật không được kiểm.
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(7);
    expect(tools.every(({ outputSchema }) => outputSchema !== undefined)).toBe(
      true,
    );

    for (const { name } of tools) {
      const result = await client.callTool({
        name,
        arguments: { khong_ton_tai: "x" },
      });

      expect(result.isError).toBe(true);
      expect(
        (result.structuredContent as { error?: { code?: string } }).error?.code,
      ).toBe("INVALID_REQUEST");
    }

    // Đường thành công vẫn qua đúng validator đó.
    const ok = await client.callTool({
      name: "tqccl_get_playbook",
      arguments: { intent: "lookup" },
    });
    expect(ok.isError).not.toBe(true);
    expect(
      (ok.structuredContent as { releaseId: string }).releaseId,
    ).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("nêu field sai khi SDK từ chối input trước handler", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const { client } = await connect(handlers);

    const result = await client.callTool({
      name: "tqccl_search",
      arguments: { query: "x", limit: "abc" },
    });
    const document = result.structuredContent as {
      error: { code: string; message: string; fields?: string[] };
    };

    expect(document.error.code).toBe("INVALID_REQUEST");
    expect(document.error.fields).toEqual(["limit"]);
    expect(document.error.message).toContain("limit");
  });

  it("nêu field lồng nhau khi SDK từ chối input trước handler", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const { client } = await connect(handlers);

    const result = await client.callTool({
      name: "tqccl_find_teams",
      arguments: {
        collection: "engine",
        heroes: [{ canonicalId: "hero:tuong-a", tacticIds: "khong-phai-mang" }],
      },
    });
    const document = result.structuredContent as {
      error: { fields?: string[] };
    };

    expect(document.error.fields).toContain("heroes[0].tacticIds");
  });

  it("không rò giá trị hay khoá lạ qua danh sách field", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const { client } = await connect(handlers);

    const result = await client.callTool({
      name: "tqccl_search",
      arguments: { query: 123, secret: "TOP_SECRET_TOKEN" },
    });

    expect(JSON.stringify(result)).not.toContain("TOP_SECRET_TOKEN");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("làm sạch lỗi SDK không thuộc validation", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const { client } = await connect(handlers);

    const result = await client.callTool({
      name: "PRIVATE_UNKNOWN_TOOL",
      arguments: {},
    });

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Không thể hoàn tất yêu cầu.",
          nextAction:
            "Thử lại một lần; nếu lỗi tiếp diễn, báo mã INTERNAL_ERROR cho vận hành.",
          retryable: false,
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_UNKNOWN_TOOL");
    expect(JSON.stringify(result)).not.toContain("not found");
  });

  it("cung cấp recovery action cố định cho mọi mã lỗi mà không dùng private message", () => {
    const codes = [
      "INVALID_REQUEST",
      "DATA_UNAVAILABLE",
      "WORKFLOW_VERSION_CHANGED",
      "CONFIRMATION_REQUIRED",
      "CURSOR_INVALID",
      "RESULT_TOO_LARGE",
      "INTERNAL_ERROR",
      "CAPABILITY_UNAVAILABLE",
      "ENTITY_NOT_FOUND",
      "REFERENCE_NOT_FOUND",
      "REFERENCE_SCOPE_INVALID",
      "KNOWLEDGE_VERSION_CHANGED",
      "KNOWLEDGE_UNAVAILABLE",
      "PLAYBOOK_NOT_FOUND",
    ] as const;

    for (const code of codes) {
      const result = formatToolError(
        new ResearchHandlerError(
          code,
          `private-${code}-payload`,
          code === "DATA_UNAVAILABLE",
        ),
      );
      const document = result.structuredContent as {
        error: {
          code: string;
          message: string;
          nextAction: string;
          retryable: boolean;
        };
      };
      expect(document.error).toMatchObject({
        code,
        retryable: code === "DATA_UNAVAILABLE",
      });
      expect(document.error.message.length).toBeGreaterThan(0);
      expect(document.error.nextAction.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toContain(`private-${code}`);
    }

    expect(formatToolError(new Error("private-unknown"))).toMatchObject({
      structuredContent: {
        error: {
          code: "INTERNAL_ERROR",
          retryable: false,
        },
      },
    });
    expect(
      JSON.stringify(formatToolError(new Error("private-unknown"))),
    ).not.toContain("private-unknown");
  });

  it("surfaces offending field paths without leaking submitted values", () => {
    const result = formatToolError(
      new ResearchHandlerError("INVALID_REQUEST", "private-payload", false, [
        "limit",
        "heroes[0].tacticIds",
      ]),
    );
    const document = result.structuredContent as {
      error: { code: string; fields?: string[] };
    };

    expect(document.error.fields).toEqual(["limit", "heroes[0].tacticIds"]);
    expect(JSON.stringify(result)).toContain("heroes[0].tacticIds");
    expect(JSON.stringify(result)).not.toContain("private-payload");
    expect(result.content[0]?.type).toBe("text");
    expect(String((result.content[0] as { text: string }).text)).toContain(
      "limit",
    );
  });

  it("omits the fields key when no field is implicated", () => {
    const result = formatToolError(
      new ResearchHandlerError("REFERENCE_NOT_FOUND", "private-payload"),
    );
    const document = result.structuredContent as {
      error: Record<string, unknown>;
    };

    expect(document.error).not.toHaveProperty("fields");
  });
});

it('keeps complete discovery below budget and validates correlated errors in every advertised JSON schema',async()=>{
 const {Ajv}=await import('ajv');const ajv=new Ajv({strict:false,allErrors:true});
 const {client}=await connect(createResearchHandlers({dataSource:new FilesystemDataSource({dataRoot:fixtureRoot})}));
 const catalog=await client.listTools();
 const listBytes=Buffer.byteLength(JSON.stringify({jsonrpc:'2.0',id:1,result:catalog}));
 // Trần tools/list: 90 KiB (Worker cho phép 96 KiB mỗi phản hồi); vượt nghĩa là schema output phình, hãy slim chứ không nâng trần.
 expect(listBytes).toBeLessThan(90*1024);
 for(const tool of catalog.tools){const out=tool.outputSchema as {properties:Record<string,Record<string,unknown>>};for(const [name,property] of Object.entries(out.properties)){if(name!=='error')expect(typeof property.description,`${tool.name}.${name}`).toBe('string');}expect(JSON.stringify(out.properties).match(/"description"/gu)?.length??0,tool.name).toBeLessThanOrEqual(Object.keys(out.properties).length+1);}
 const common={message:'Safe',nextAction:'Choose',retryable:false};
 const choices={kind:'team-config',teamId:'team-a',configIds:['config-a','config-b'],totalCount:2,omittedCount:0};
 const valid=[{error:{...common,code:'INVALID_REQUEST'}},{error:{...common,code:'CONFIG_AMBIGUOUS',choices}},{error:{...common,code:'CANDIDATE_LIMIT_EXCEEDED',limits:{maxCandidates:500,candidateCount:501}}}];
 const invalid=[{error:{...common,code:'CONFIG_AMBIGUOUS'}},{error:{...common,code:'CANDIDATE_LIMIT_EXCEEDED'}},{error:{...common,code:'INVALID_REQUEST',choices}},{error:{...common,code:'CONFIG_AMBIGUOUS',choices,limits:{maxCandidates:500,candidateCount:501}}},{error:{...common,code:'CANDIDATE_LIMIT_EXCEEDED',retryable:true,limits:{maxCandidates:500,candidateCount:501}}},{error:{...common,code:'INVALID_REQUEST',extra:'not allowed'}}];
 for(const tool of catalog.tools){ajv.compile(tool.inputSchema);const validate=ajv.compile(tool.outputSchema!);for(const value of valid)expect(validate(value),`${tool.name}: ${JSON.stringify(validate.errors)}`).toBe(true);for(const value of invalid)expect(validate(value),`${tool.name} accepted invalid error`).toBe(false);}
});
