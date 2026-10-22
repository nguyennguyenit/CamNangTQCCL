import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hookSource = path.join(repoRoot, ".githooks", "pre-push");
const ZERO = "0".repeat(40);
const SHA = "a".repeat(40);

// Throwaway git repo + fake npm/python3 that log "<dir> <tool> <args>" and
// exit 1 when the line contains $FAIL_ON.
function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), "pre-push-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  mkdirSync(path.join(root, "mcp-worker", "node_modules"), { recursive: true });
  mkdirSync(path.join(root, "community-worker", "node_modules"), { recursive: true });
  writeFileSync(path.join(root, ".gitignore"), "node_modules/\n");
  writeFileSync(path.join(root, "README"), "x\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  const bin = path.join(root, ".fakebin");
  mkdirSync(bin);
  for (const tool of ["npm", "python3"]) {
    writeFileSync(
      path.join(bin, tool),
      `#!/bin/sh\nline="$(basename "$PWD") ${tool} $*"\necho "$line" >> "$LOG"\n[ -n "$FAIL_ON" ] && case "$line" in *"$FAIL_ON"*) exit 1;; esac\nexit 0\n`,
    );
    chmodSync(path.join(bin, tool), 0o755);
  }
  git("config", "core.excludesFile", "/dev/null");
  writeFileSync(path.join(root, ".git", "info", "exclude"), ".fakebin/\nhook.log\npre-push\n");
  copyFileSync(hookSource, path.join(root, "pre-push"));
  chmodSync(path.join(root, "pre-push"), 0o755);
  const log = path.join(root, "hook.log");
  const run = (stdin, env = {}) => {
    const r = spawnSync("bash", [path.join(root, "pre-push"), "origin", "git@example.com:x.git"], {
      cwd: root,
      input: stdin,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LOG: log, FAIL_ON: "", ...env },
    });
    const lines = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
    return { ...r, lines };
  };
  return { root, run, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const push = (remoteRef) => `refs/heads/work ${SHA} ${remoteRef} ${ZERO}\n`;

test("hook is tracked executable with a bash shebang", () => {
  const out = execFileSync("git", ["ls-files", "-s", ".githooks/pre-push"], { cwd: repoRoot, encoding: "utf8" });
  assert.match(out, /^100755 /);
  assert.equal(readFileSync(hookSource, "utf8").split("\n")[0], "#!/usr/bin/env bash");
});

test("first failing command stops the hook", () => {
  const s = sandbox();
  try {
    const r = s.run(push("refs/heads/feature"), { FAIL_ON: "check:local-secrets" });
    assert.notEqual(r.status, 0);
    assert.equal(r.lines.length, 1);
  } finally { s.cleanup(); }
});

test("all commands passing runs every step in order and exits 0", () => {
  const s = sandbox();
  try {
    const r = s.run(push("refs/heads/feature"));
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.lines, [
      "mcp-worker npm run --silent check:local-secrets",
      "mcp-worker npm run --silent check:workflow-build",
      "mcp-worker npm run --silent check:knowledge-bundle",
      "mcp-worker npm run --silent typecheck",
      "community-worker npm test --silent",
      "community-worker npm run --silent typecheck",
      path.basename(s.root) + " python3 -m unittest discover -s tests",
    ]);
  } finally { s.cleanup(); }
});

test("check:local-secrets is the first step", () => {
  const s = sandbox();
  try {
    const r = s.run(push("refs/heads/feature"));
    assert.match(r.lines[0], /check:local-secrets/);
  } finally { s.cleanup(); }
});

test("branch deletion and tag pushes exit 0 without running anything", () => {
  const s = sandbox();
  try {
    let r = s.run(`(delete) ${ZERO} refs/heads/x ${SHA}\n`);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.lines.length, 0);
    r = s.run(`refs/tags/v1 ${SHA} refs/tags/v1 ${ZERO}\n`);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.lines.length, 0);
  } finally { s.cleanup(); }
});

test("dirty working tree is refused before any command", () => {
  const s = sandbox();
  try {
    writeFileSync(path.join(s.root, "README"), "changed\n");
    let r = s.run(push("refs/heads/feature"));
    assert.equal(r.status, 1);
    assert.equal(r.lines.length, 0);
    assert.match(r.stderr, /git stash -u/);
    execFileSync("git", ["checkout", "README"], { cwd: s.root });
    writeFileSync(path.join(s.root, "untracked.txt"), "u\n");
    r = s.run(push("refs/heads/feature"));
    assert.equal(r.status, 1);
    assert.equal(r.lines.length, 0);
  } finally { s.cleanup(); }
});

test("missing node_modules is refused with npm ci guidance", () => {
  const s = sandbox();
  try {
    rmSync(path.join(s.root, "community-worker", "node_modules"), { recursive: true });
    const r = s.run(push("refs/heads/feature"));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /npm ci/);
    assert.equal(r.lines.length, 0);
  } finally { s.cleanup(); }
});

test("pushing to main also runs build and verify after the always-on steps", () => {
  const s = sandbox();
  try {
    const main = s.run(push("refs/heads/main"));
    assert.equal(main.status, 0, main.stderr);
    const n = main.lines.length;
    assert.match(main.lines[n - 2], /npm run build$/);
    assert.match(main.lines[n - 1], /npm run verify$/);
    assert.match(main.lines[n - 3], /python3 -m unittest/);
    rmSync(path.join(s.root, "hook.log"));
    const other = s.run(push("refs/heads/feature"));
    assert.equal(other.status, 0, other.stderr);
    assert.ok(!other.lines.some((l) => / run (build|verify)$/.test(l)));
  } finally { s.cleanup(); }
});
