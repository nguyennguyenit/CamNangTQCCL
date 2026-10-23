import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "scripts/report-zh-gaps.mjs");
const run = (args, { reportPath, cwd = root } = {}) =>
  spawnSync(process.execPath, ["--experimental-strip-types", script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...(reportPath ? { ZH_GAPS_REPORT_PATH: reportPath } : { ZH_GAPS_REPORT_PATH: "" }) },
  });
const tmp = () => mkdtempSync(path.join(tmpdir(), "zh-gaps-"));

test("--check on a missing report fails and names the path", () => {
  const dir = tmp();
  const missing = path.join(dir, "absent.md");
  const result = run(["--check"], { reportPath: missing });
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(missing), result.stderr);
  rmSync(dir, { recursive: true });
});

test("--check fails after a report line is edited, passes after regenerating", () => {
  const dir = tmp();
  const file = path.join(dir, "zh-gaps.md");
  assert.equal(run([], { reportPath: file }).status, 0);
  assert.equal(run(["--check"], { reportPath: file }).status, 0);
  const lines = readFileSync(file, "utf8").split("\n");
  lines[4] += " sửa tay";
  writeFileSync(file, lines.join("\n"));
  assert.equal(run(["--check"], { reportPath: file }).status, 1);
  assert.equal(run([], { reportPath: file }).status, 0);
  assert.equal(run(["--check"], { reportPath: file }).status, 0);
  rmSync(dir, { recursive: true });
});

test("default report path is docs/zh-gaps.md, not under plans/", async () => {
  const { ZH_GAPS_REPORT_PATH } = await import("../scripts/report-zh-gaps.mjs");
  assert.ok(ZH_GAPS_REPORT_PATH.pathname.endsWith("/docs/zh-gaps.md"));
  assert.ok(!ZH_GAPS_REPORT_PATH.pathname.includes("/plans/"));
  assert.ok(existsSync(ZH_GAPS_REPORT_PATH));
});

test("generation is byte-identical across runs and working directories", () => {
  const dir = tmp();
  const a = path.join(dir, "a.md");
  const b = path.join(dir, "b.md");
  assert.equal(run([], { reportPath: a }).status, 0);
  assert.equal(run([], { reportPath: b, cwd: dir }).status, 0);
  assert.ok(readFileSync(a).equals(readFileSync(b)));
  rmSync(dir, { recursive: true });
});

test("npm run verify gates on the zh-gaps check", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts.verify.includes("report-zh-gaps.mjs --check"));
});
