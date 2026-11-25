import { publicErrorDetails } from "./mcp/format-result.js";
import { access, open, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { KnowledgeError } from "./knowledge/rule-contracts.js";
import { searchRules } from "./knowledge/search-rules.js";
import { FilesystemDataSource } from "./data/filesystem-data-source.js";
import {
  createResearchHandlers,
  ResearchHandlerError,
} from "./research/research-handlers.js";
import {
  MAX_REQUEST_BYTES,
  RESEARCH_TOOL_NAMES,
  type ResearchToolName,
} from "./research/research-contracts.js";

export const CLI_ALIASES = {
  playbook: "tqccl_get_playbook",
  search: "tqccl_search",
  entity: "tqccl_get_entity",
  "find-teams": "tqccl_find_teams",
  team: "tqccl_get_team",
  normalize: "tqccl_normalize_entities",
  recommend: "tqccl_recommend_teams",
} as const satisfies Record<string, ResearchToolName>;

/** Lệnh chỉ có ở CLI, không phải MCP tool. */
export const CLI_ONLY_COMMANDS = { "search-rules": true } as const;

export interface ParsedCliArgs {
  help: boolean;
  handlerName?: ResearchToolName;
  /** `search-rules`: gọi thẳng knowledge core, không phải MCP tool. */
  searchRules?: true;
  input?: unknown;
  /** `--input -` / `--input-file`: nội dung được đọc async (có giới hạn) trong `runCli`, không trong `parseCliArgs`. */
  inputSource?: { kind: "file"; path: string } | { kind: "stdin" };
  dataRoot?: string;
}

export interface CliIo {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
  /** Nguồn cho `--input -`; mặc định `process.stdin`. */
  stdin?: AsyncIterable<Uint8Array | string> & { isTTY?: boolean };
}

class CliUsageError extends Error {
  constructor() {
    super("CLI_USAGE");
    this.name = "CliUsageError";
  }
}

function usageError(): never {
  throw new CliUsageError();
}

function isToolName(value: string): value is ResearchToolName {
  return (RESEARCH_TOOL_NAMES as readonly string[]).includes(value);
}

export function parseCliArgs(args: readonly string[]): ParsedCliArgs {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    if (args.length > 1) usageError();
    return { help: true };
  }

  const command = args[0];
  if (command === undefined) usageError();
  const searchRulesCommand = command in CLI_ONLY_COMMANDS;
  const handlerName = isToolName(command)
    ? command
    : CLI_ALIASES[command as keyof typeof CLI_ALIASES];
  if (handlerName === undefined && !searchRulesCommand) usageError();

  let input: unknown = {};
  let inputSource: ParsedCliArgs["inputSource"];
  let inputSeen = false;
  let dataRoot: string | undefined;
  for (let index = 1; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (value === undefined) usageError();
    if (option === "--input" || option === "--input-file") {
      // --input, --input - và --input-file loại trừ lẫn nhau và chỉ xuất hiện một lần.
      if (inputSeen) usageError();
      inputSeen = true;
      if (option === "--input-file") {
        if (value.trim() === "") usageError();
        inputSource = { kind: "file", path: resolve(value) };
      } else if (value === "-") {
        inputSource = { kind: "stdin" };
      } else {
        if (new TextEncoder().encode(value).byteLength > MAX_REQUEST_BYTES) {
          usageError();
        }
        try {
          input = JSON.parse(value);
        } catch {
          usageError();
        }
      }
    } else if (option === "--data-root" && value.trim() !== "") {
      dataRoot = resolve(value);
    } else {
      usageError();
    }
  }

  return {
    help: false,
    ...(handlerName === undefined ? { searchRules: true as const } : { handlerName }),
    input,
    ...(inputSource === undefined ? {} : { inputSource }),
    ...(dataRoot === undefined ? {} : { dataRoot }),
  };
}

function helpText(): string {
  const commands = Object.entries(CLI_ALIASES)
    .map(([alias, name]) => `  ${alias.padEnd(20)} ${name}`)
    .concat(`  ${"search-rules".padEnd(20)} (chỉ CLI) tra cứu knowledge rules`)
    .join("\n");
  return [
    "TQCCL research CLI",
    "",
    "Cách dùng:",
    "  npm run cli -- <lệnh> [--input '<JSON>' | --input - | --input-file <đường-dẫn>] [--data-root <thư-mục>]",
    "  --input - đọc JSON từ stdin; --input-file đọc từ file thường. Tối đa 256 KiB, UTF-8 không BOM.",
    "",
    "Lệnh:",
    commands,
    "",
  ].join("\n");
}

async function defaultDataRoot(): Promise<string> {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDirectory, "../../data"),
    resolve(moduleDirectory, "../../../../data"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Thử layout tiếp theo; nguồn TypeScript và bản build có độ sâu khác nhau.
    }
  }
  return candidates[0]!;
}

function writeJson(io: CliIo, value: unknown): void {
  io.stdout.write(`${JSON.stringify(value)}\n`);
}

function errorDocument(
  code: string,
  message: string,
  retryable: boolean,
  details: object = {},
): unknown {
  return { error: { code, message, retryable, ...details } };
}

/** Đọc theo chunk, dừng ngay khi vượt `MAX_REQUEST_BYTES` (không nạp trọn file/stdin vào bộ nhớ). */
async function readBounded(chunks: AsyncIterable<Uint8Array | string>): Promise<Buffer> {
  const parts: Buffer[] = [];
  let total = 0;
  for await (const chunk of chunks) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    total += buffer.byteLength;
    if (total > MAX_REQUEST_BYTES) usageError();
    parts.push(buffer);
  }
  return Buffer.concat(parts);
}

/** Chỉ nhận regular file (từ chối thư mục, FIFO, thiết bị); đọc tối đa `MAX_REQUEST_BYTES + 1` byte. */
async function openRegularFile(path: string): Promise<AsyncIterable<Uint8Array>> {
  if (!(await stat(path)).isFile()) usageError();
  const handle = await open(path, "r");
  try {
    if (!(await handle.stat()).isFile()) usageError();
  } catch (error) {
    await handle.close();
    throw error;
  }
  return handle.createReadStream({ start: 0, end: MAX_REQUEST_BYTES, highWaterMark: 64 * 1024 });
}

/** UTF-8 hợp lệ, không BOM, một tài liệu JSON. */
function decodeJsonDocument(bytes: Uint8Array): unknown {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) usageError();
  return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
}

export async function runCli(
  args: readonly string[],
  io: CliIo = { stdout: process.stdout, stderr: process.stderr },
): Promise<number> {
  let parsed: ParsedCliArgs;
  const usageFailure = (): number => {
    writeJson(io, errorDocument("CLI_USAGE", "Tham số CLI không hợp lệ.", false));
    return 2;
  };
  try {
    parsed = parseCliArgs(args);
    if (parsed.inputSource !== undefined) {
      const source = parsed.inputSource;
      const stdin = io.stdin ?? process.stdin;
      // TTY tương tác không bao giờ đóng: từ chối thay vì treo chờ người gõ.
      if (source.kind === "stdin" && stdin.isTTY === true) usageError();
      const bytes = await readBounded(source.kind === "file" ? await openRegularFile(source.path) : stdin);
      parsed = { ...parsed, input: decodeJsonDocument(bytes) };
    }
  } catch {
    return usageFailure();
  }

  if (parsed.help) {
    io.stdout.write(helpText());
    return 0;
  }

  if (parsed.searchRules) {
    try {
      writeJson(io, searchRules(parsed.input));
      return 0;
    } catch (error) {
      if (error instanceof KnowledgeError) {
        writeJson(io, errorDocument(error.code, error.message, error.code === "KNOWLEDGE_VERSION_CHANGED"));
        return 1;
      }
      writeJson(io, errorDocument("INTERNAL_ERROR", "Không thể hoàn tất yêu cầu.", false));
      return 1;
    }
  }

  try {
    const dataRoot = parsed.dataRoot ?? (await defaultDataRoot());
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot }),
    });
    const result = await handlers.call(
      parsed.handlerName!,
      parsed.input as never,
    );
    writeJson(io, result);
    return 0;
  } catch (error) {
    if (error instanceof ResearchHandlerError) {
      writeJson(
        io,
        errorDocument(error.code, error.message, error.retryable, publicErrorDetails(error)),
      );
    } else {
      writeJson(
        io,
        errorDocument(
          "INTERNAL_ERROR",
          "Không thể hoàn tất yêu cầu.",
          false,
        ),
      );
    }
    return 1;
  }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  process.exitCode = await runCli(args);
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
