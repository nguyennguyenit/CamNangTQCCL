import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseCliArgs, runCli, type CliIo } from "../src/cli.js";
import { MAX_REQUEST_BYTES } from "../src/research/research-contracts.js";
import { buildIdObservations, loadRosterEnv, loadRosterFixture } from "./fixtures/normalize-full-roster.js";

let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "tqccl-cli-input-"));
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

async function run(args: string[], stdin?: Uint8Array | string | Readable): Promise<Run> {
  let stdout = "";
  let stderr = "";
  const io: CliIo = {
    stdout: { write: (chunk: string | Uint8Array) => ((stdout += String(chunk)), true) },
    stderr: { write: (chunk: string | Uint8Array) => ((stderr += String(chunk)), true) },
    ...(stdin === undefined
      ? {}
      : { stdin: stdin instanceof Readable ? stdin : Readable.from([typeof stdin === "string" ? Buffer.from(stdin) : stdin]) }),
  };
  return { code: await runCli(args, io), stdout, stderr };
}

const usageError = (result: Run) => {
  expect(result.code).toBe(2);
  expect(JSON.parse(result.stdout)).toMatchObject({ error: { code: "CLI_USAGE" } });
};

const evidence = { sourceScope: "currentTurnImage", batchId: "cli" };
const smallBody = JSON.stringify({
  observations: [{ observationId: "o1", entityKind: "hero", canonicalId: "hero:tao-thao", evidence }],
});

describe("CLI input sources (#165)", () => {
  it("parseCliArgs nhận --input-file và --input - và loại trừ lẫn nhau", () => {
    expect(parseCliArgs(["normalize", "--input-file", "x.json"])).toMatchObject({ inputSource: { kind: "file" } });
    expect(parseCliArgs(["normalize", "--input", "-"])).toMatchObject({ inputSource: { kind: "stdin" } });
    expect(() => parseCliArgs(["normalize", "--input", "-", "--input-file", "x.json"])).toThrow();
    expect(() => parseCliArgs(["normalize", "--input", "{}", "--input", "{}"])).toThrow();
    expect(() => parseCliArgs(["normalize", "--input-file", "a.json", "--input-file", "b.json"])).toThrow();
    expect(() => parseCliArgs(["normalize", "--input", "{}", "--input-file", "x.json"])).toThrow();
  });

  it("--input-file và --input - cho kết quả byte-giống --input", async () => {
    const file = join(directory, "body.json");
    await writeFile(file, smallBody);
    const inline = await run(["normalize", "--input", smallBody]);
    expect(inline.code).toBe(0);
    expect((await run(["normalize", "--input-file", file])).stdout).toBe(inline.stdout);
    expect((await run(["normalize", "--input", "-"], smallBody)).stdout).toBe(inline.stdout);
  });

  it("kho 238 mục chạy normalize → recommend qua --input -", async () => {
    const env = await loadRosterEnv();
    const observations = buildIdObservations(env, loadRosterFixture());
    const normalize = await run(["normalize", "--input", "-"], JSON.stringify({ observations }));
    expect(normalize.code).toBe(0);
    const normalized = JSON.parse(normalize.stdout);
    expect(normalized.reviewRequired).toBe(false);
    const recommend = await run(
      ["recommend", "--input", "-"],
      JSON.stringify({
        expectedWorkflowVersion: normalized.workflowVersion,
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
        sourceSeasonId: env.snapshot.publication!.seasons.defaultSourceSeasonId,
        maxTeams: 10,
        fullBox: true,
      }),
    );
    expect(recommend.code).toBe(0);
    const heroes = JSON.parse(recommend.stdout).portfolioTeams.flatMap((team: { heroes: unknown[] }) => team.heroes) as Array<{
      canonicalId: string;
      displayName: string;
    }>;
    expect(heroes.length).toBeGreaterThan(0);
    for (const hero of heroes) expect(hero.displayName).toBe(env.names.get(hero.canonicalId));
  });

  it("file quá 256 KiB, thư mục/thiết bị, thiếu file, BOM, UTF-8 hỏng → CLI_USAGE", async () => {
    const big = join(directory, "big.json");
    await writeFile(big, " ".repeat(MAX_REQUEST_BYTES + 1));
    usageError(await run(["normalize", "--input-file", big]));
    const exact = join(directory, "exact.json");
    await writeFile(exact, `${smallBody}${" ".repeat(MAX_REQUEST_BYTES - smallBody.length)}`);
    expect((await run(["normalize", "--input-file", exact])).code).toBe(0);
    usageError(await run(["normalize", "--input-file", directory]));
    usageError(await run(["normalize", "--input-file", devNull]));
    usageError(await run(["normalize", "--input-file", join(directory, "missing.json")]));
    const bom = join(directory, "bom.json");
    await writeFile(bom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(smallBody)]));
    usageError(await run(["normalize", "--input-file", bom]));
    const bad = join(directory, "bad.json");
    await writeFile(bad, Buffer.from([0x7b, 0xff, 0xfe, 0x7d]));
    usageError(await run(["normalize", "--input-file", bad]));
  });

  it("stdin vượt trần, BOM, UTF-8 hỏng, JSON hỏng hoặc rỗng → CLI_USAGE", async () => {
    usageError(await run(["normalize", "--input", "-"], " ".repeat(MAX_REQUEST_BYTES + 1)));
    usageError(await run(["normalize", "--input", "-"], Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(smallBody)])));
    usageError(await run(["normalize", "--input", "-"], Buffer.from([0x7b, 0xff, 0x7d])));
    usageError(await run(["normalize", "--input", "-"], "{"));
    usageError(await run(["normalize", "--input", "-"], ""));
  });

  it("--input - khi stdin là TTY → CLI_USAGE, không chờ đọc", async () => {
    const tty = Object.assign(Readable.from([Buffer.from(smallBody)]), { isTTY: true });
    usageError(await run(["normalize", "--input", "-"], tty));
    expect(tty.readableFlowing).toBeNull();
  });
});
