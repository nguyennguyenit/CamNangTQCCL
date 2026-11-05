import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const text = readFileSync(new URL("../.github/workflows/mcp-gate.yml", import.meta.url), "utf8");

// Text-based: the repo has no YAML parser. Top-level keys sit at column 0,
// `on:` children at 2 spaces, jobs at 2 spaces under `jobs:`.
function block(source, header, indent) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line === header);
  assert.notEqual(start, -1, `missing block ${header.trim()}`);
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && line.search(/\S/) <= indent) break;
    out.push(line);
  }
  return out.join("\n");
}

const on = block(text, "on:", 0);
const jobs = block(text, "jobs:", 0);

function listUnder(source, key) {
  const body = block(source, `  ${key}:`, 2);
  return [...body.matchAll(/^\s+- "?([^"\n]+)"?\s*$/gm)].map((m) => m[1]);
}

test("full gate does not trigger on push", () => {
  assert.doesNotMatch(on, /^ {2}push:/m);
});

test("pull_request paths include agent-knowledge and every previous path", () => {
  const paths = listUnder(on, "pull_request");
  for (const p of [
    "agent-knowledge/**", ".node-version", ".github/workflows/mcp-gate.yml", ".github/workflows/mcp-release.yml",
    ".github/workflows/mcp-edge-security-monitor.yml", "data/**", "pipeline/**", "js/**",
    "css/**", "public/**", "mcp-worker/**", "package.json", "package-lock.json",
    "playwright.config.*", "scripts/**", "astro.config.*", "src/**", "tsconfig.json",
    "tests/**", "tests-e2e/**", "tests-js/**", "worker/**", "docs/zh-gaps.md",
  ]) {
    assert.ok(paths.includes(p), `pull_request.paths lacks ${p}`);
  }
});

test("a weekly schedule exists", () => {
  const schedule = block(on, "  schedule:", 2);
  const cron = schedule.match(/cron:\s*"([^"]+)"/);
  assert.ok(cron, "schedule[0].cron missing");
  const fields = cron[1].trim().split(/\s+/);
  assert.equal(fields.length, 5);
  assert.notEqual(fields[4], "*", "day-of-week must be fixed for a weekly run");
});

test("credential-free-release-gate uses no secrets, vars or environment", () => {
  const job = block(jobs, "  credential-free-release-gate:", 2);
  assert.ok(job.length > 0);
  assert.doesNotMatch(job, /secrets\./);
  assert.doesNotMatch(job, /vars\./);
  assert.doesNotMatch(job, /^\s*environment:/m);
});
