// Bộ ảnh chuẩn Soi đội: gọi AI thật cho từng ảnh trong eval/images theo fixture eval/fixtures/*.json, chấm
// trên ID canonical (score.ts) và in độ chính xác theo loại màn hình × trường + thời gian p50/p95.
//
//   cd worker
//   EVAL_ENDPOINT=https://api.deepseek.com/chat/completions EVAL_API_KEY=… EVAL_MODEL=deepseek-flash \
//     npm run eval:vision -- [--effort off|high|…] [--runs 3] [--only battle-vi-1] [--save base] [--from base]
//
// --save <nhãn>: lưu output AI vào eval/.cache/<nhãn>/ để chấm lại (--from <nhãn>) mà không tốn token khi chỉ
// sửa từ điển/bộ khớp. --effort mặc định EVAL_EFFORT hoặc "off". Model trong catalog (shared/ai-models.ts)
// tự lấy kiểu tham số suy luận; model ngoài catalog đặt EVAL_EFFORT_STYLE=deepseek|openai|none.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { DEFAULT_TIMEOUT_MS, MAX_BUDGET_MS, type AiRoute } from "../../shared/ai-config";
import { AI_PRESETS, type EffortStyle } from "../../shared/ai-models";
import { callModel } from "../src/model";
import type { AnalyzeResult } from "../src/schema";
import { addScore, buildIndexes, emptyScore, percentile, scoreFixture, type Fixture, type FixtureScore, type Tally } from "./score";

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = join(EVAL_DIR, "..", "..");

const { values: args } = parseArgs({
  options: {
    effort: { type: "string" },
    runs: { type: "string", default: "1" },
    only: { type: "string" },
    save: { type: "string" },
    from: { type: "string" },
  },
});

function route(): AiRoute {
  const endpoint = process.env.EVAL_ENDPOINT;
  const apiKey = process.env.EVAL_API_KEY;
  const modelId = process.env.EVAL_MODEL;
  if (!endpoint || !apiKey || !modelId) throw new Error("Thiếu EVAL_ENDPOINT / EVAL_API_KEY / EVAL_MODEL");
  const catalog = AI_PRESETS.flatMap((preset) => preset.models).find((model) => model.modelId === modelId);
  const effortStyle = (process.env.EVAL_EFFORT_STYLE as EffortStyle | undefined) ?? catalog?.effortStyle ?? "none";
  const effort = args.effort ?? process.env.EVAL_EFFORT ?? (effortStyle === "none" ? "default" : "off");
  const timeoutMs = Number(process.env.EVAL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  return {
    group: "teamScan",
    targets: [{ label: "eval", endpoint, apiKey, modelId, effortStyle, effort }],
    timeoutMs,
    budgetMs: Math.min(MAX_BUDGET_MS, timeoutMs),
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

async function dataUri(file: string): Promise<string> {
  const mime = MIME[file.split(".").pop()?.toLowerCase() ?? ""];
  if (!mime) throw new Error(`Định dạng ảnh không hỗ trợ: ${file}`);
  return `data:${mime};base64,${(await readFile(join(EVAL_DIR, "images", file))).toString("base64")}`;
}

interface Run {
  result: AnalyzeResult | null;
  ms: number | null;
  error?: string;
}

async function readOnce(fixture: Fixture, aiRoute: AiRoute): Promise<Run> {
  const started = Date.now();
  try {
    const result = (await callModel(await dataUri(fixture.image), { route: aiRoute }, "analyzeTeamImage")) as AnalyzeResult;
    return { result, ms: Date.now() - started };
  } catch (e) {
    return { result: null, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

const cell = ({ hit, total }: Tally) => `${total ? `${((hit / total) * 100).toFixed(1)}%` : "n/a"} (${hit}/${total})`.padEnd(18);

async function main() {
  const [heroes, tactics, books] = await Promise.all(
    ["heroes-dict.json", "tactics.json", "books-dict.json"].map((file) => readJson<Record<string, unknown>[]>(join(REPO_DIR, "data", file))),
  );
  const indexes = buildIndexes({ heroes, tactics, books });
  const names = (await readdir(join(EVAL_DIR, "fixtures")))
    .filter((file) => file.endsWith(".json"))
    .map((file) => basename(file, ".json"))
    .filter((name) => !args.only || name === args.only)
    .sort();
  if (!names.length) throw new Error("Không có fixture nào");
  const runs = Math.max(1, Number(args.runs) || 1);
  const aiRoute = args.from ? null : route();
  if (aiRoute) {
    const target = aiRoute.targets[0];
    console.log(`Model ${target.modelId} · effort ${target.effort} · timeout ${aiRoute.timeoutMs} ms · ${runs} lượt/ảnh`);
  } else {
    console.log(`Chấm lại output đã lưu: eval/.cache/${args.from}/`);
  }

  const byScreen = new Map<string, { images: number; score: FixtureScore }>();
  const latencies: number[] = [];
  let failures = 0;
  for (const name of names) {
    const fixture = await readJson<Fixture>(join(EVAL_DIR, "fixtures", `${name}.json`));
    const cacheFile = (label: string) => join(EVAL_DIR, ".cache", label, `${name}.json`);
    const done: Run[] = [];
    if (args.from) {
      done.push(...(await readJson<Run[]>(cacheFile(args.from))));
    } else {
      // Tuần tự: một nhà cung cấp, tránh tự gây 429 và giữ số đo thời gian sạch.
      for (let run = 0; run < runs; run++) done.push(await readOnce(fixture, aiRoute!));
    }
    if (args.save) {
      await mkdir(dirname(cacheFile(args.save)), { recursive: true });
      await writeFile(cacheFile(args.save), `${JSON.stringify(done, null, 2)}\n`);
    }
    // Fixture xuất từ mẫu người dùng chưa gắn loại màn hình: gom riêng tới khi người duyệt điền `screen`.
    const screen = fixture.expected.screen ?? "chưa-gắn";
    const bucket = byScreen.get(screen) ?? { images: 0, score: emptyScore() };
    for (const run of done) {
      bucket.images += 1;
      bucket.score = addScore(bucket.score, scoreFixture(fixture, run.result, indexes));
      if (run.ms !== null) latencies.push(run.ms);
      if (run.error) {
        failures += 1;
        console.log(`  ✗ ${name}: ${run.error}`);
      }
    }
    byScreen.set(screen, bucket);
  }

  const header = ["screen".padEnd(14), "lượt".padEnd(6), ...["màn hình", "số phe", "tướng", "chiến pháp", "binh thư"].map((h) => h.padEnd(18))];
  console.log(`\n${header.join("")}`);
  let total = emptyScore();
  let images = 0;
  for (const [screen, { images: count, score }] of [...byScreen].sort(([a], [b]) => a.localeCompare(b))) {
    total = addScore(total, score);
    images += count;
    console.log([screen.padEnd(14), String(count).padEnd(6), ...[score.screen, score.sides, score.heroes, score.tactics, score.books].map(cell)].join(""));
  }
  console.log(["tổng".padEnd(14), String(images).padEnd(6), ...[total.screen, total.sides, total.heroes, total.tactics, total.books].map(cell)].join(""));
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  console.log(`\nThời gian: p50 ${p50 ?? "n/a"} ms · p95 ${p95 ?? "n/a"} ms · lỗi ${failures}/${images}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
