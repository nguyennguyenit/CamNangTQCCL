#!/usr/bin/env node
/**
 * control-tqccl — launch / doctor / drive / cleanup for the Cẩm Nang TQCCL static site.
 * Verification scaffolding: does not change product code, wrangler config, or production.
 */
import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const here = dirname(fileURLToPath(import.meta.url));
const NODE24 = join(homedir(), ".nvm/versions/node/v24.20.0/bin/node");
const ENGINE = { minMajor: 24, minMinor: 20, maxMajor: 25 };

function nodeMeetsEngine(version = process.versions.node) {
  const [major, minor] = version.split(".").map(Number);
  if (major > ENGINE.minMajor && major < ENGINE.maxMajor) return true;
  if (major === ENGINE.minMajor && minor >= ENGINE.minMinor) return true;
  return false;
}

function reexecIfNeeded() {
  if (nodeMeetsEngine()) return;
  if (!existsSync(NODE24)) {
    fail(
      `Need Node >=24.20.0 <25 (see .node-version). Current ${process.versions.node}. Install with nvm, then retry.`,
    );
  }
  const result = spawnSync(NODE24, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: `${dirname(NODE24)}:${process.env.PATH || ""}`,
    },
  });
  process.exit(result.status ?? 1);
}

reexecIfNeeded();

const { values: flags, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
  options: {
    port: { type: "string" },
    "run-id": { type: "string" },
    path: { type: "string" },
    role: { type: "string" },
    name: { type: "string" },
    value: { type: "string" },
    key: { type: "string" },
    css: { type: "string" },
    js: { type: "string" },
    level: { type: "string" },
    nth: { type: "string" },
    timeout: { type: "string" },
    feature: { type: "string" },
    entry: { type: "string" },
    json: { type: "boolean", default: false },
    "reuse-dist": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    boot: { type: "boolean", default: false },
    aria: { type: "boolean", default: false },
    headed: { type: "boolean", default: false },
    loose: { type: "boolean", default: false },
  },
});

const command = positionals[0];
const subcommand = positionals[1];

function fail(message, code = 1) {
  process.stderr.write(`control-tqccl: ${message}\n`);
  process.exit(code);
}

function repoRootFrom(start) {
  let dir = start;
  for (let i = 0; i < 12; i += 1) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.name === "cam-nang-tqccl") return dir;
      } catch {
        // keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  fail("Could not find the CamNangTQCCL repo root (package.json name cam-nang-tqccl).");
}

const repoRoot = repoRootFrom(resolve(here, "../.."));
const verifyHome = process.env.TQCCL_VERIFY_HOME || "/tmp/tqccl-verify";
const currentPath = join(verifyHome, "current-run");

function runIdNow() {
  return flags["run-id"] || process.env.TQCCL_VERIFY_RUN_ID || `run-${Date.now().toString(36)}`;
}

function runDirFor(id) {
  return join(verifyHome, "runs", id);
}

function evidenceDirFor(id) {
  return process.env.TQCCL_VERIFY_EVIDENCE || join(verifyHome, "evidence", id);
}

function readCurrentId() {
  if (flags["run-id"] || process.env.TQCCL_VERIFY_RUN_ID) return runIdNow();
  if (!existsSync(currentPath)) fail("No current verification run. Run `control-tqccl launch` first.");
  return readFileSync(currentPath, "utf8").trim();
}

function loadRun(id = readCurrentId()) {
  const file = join(runDirFor(id), "run.json");
  if (!existsSync(file)) fail(`Run state missing: ${file}. Launch this instance first.`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function saveRun(run) {
  mkdirSync(run.dir, { recursive: true });
  writeFileSync(join(run.dir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
}

function gitHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return "unknown";
  return result.stdout.trim();
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolveWait, rejectWait) => {
    const attempt = () => {
      const socket = createConnection({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolveWait();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() > deadline) rejectWait(new Error(`Port ${port} did not open within ${timeoutMs}ms`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: "manual" });
  const body = await response.text();
  return { status: response.status, body, headers: Object.fromEntries(response.headers) };
}

function portOwnerPids(port) {
  const pids = new Set();
  const ss = spawnSync("ss", ["-ltnp"], { encoding: "utf8" });
  if (ss.stdout) {
    for (const line of ss.stdout.split("\n")) {
      if (!new RegExp(`:${port}\\b`).test(line)) continue;
      for (const match of line.matchAll(/pid=(\d+)/g)) pids.add(Number(match[1]));
    }
  }
  if (pids.size === 0) {
    const lsof = spawnSync("lsof", ["-iTCP:" + port, "-sTCP:LISTEN", "-n", "-P", "-t"], { encoding: "utf8" });
    for (const line of (lsof.stdout || "").trim().split("\n")) {
      const pid = Number(line.trim());
      if (pid) pids.add(pid);
    }
  }
  if (pids.size === 0) {
    const fuser = spawnSync("fuser", [`${port}/tcp`], { encoding: "utf8" });
    const blob = `${fuser.stdout || ""} ${fuser.stderr || ""}`;
    for (const match of blob.matchAll(/(\d+)/g)) pids.add(Number(match[1]));
  }
  return [...pids];
}

function descendants(rootPid) {
  const result = spawnSync("ps", ["-eo", "pid,ppid", "--no-headers"], { encoding: "utf8" });
  const children = new Map();
  if (result.status === 0) {
    for (const line of result.stdout.trim().split("\n")) {
      const [pid, ppid] = line.trim().split(/\s+/).map(Number);
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(pid);
    }
  }
  const out = new Set([rootPid]);
  const stack = [rootPid];
  while (stack.length) {
    const pid = stack.pop();
    for (const child of children.get(pid) || []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}

function killTree(pid) {
  if (!pid || !pidAlive(pid)) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

async function killTreeWait(pid, timeoutMs = 8000) {
  if (!pid) return;
  killTree(pid);
  const deadline = Date.now() + timeoutMs;
  while (pidAlive(pid) && Date.now() < deadline) await sleep(150);
  if (pidAlive(pid)) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // gone
      }
    }
  }
}

function runNpm(args, extra = {}) {
  const npm = join(dirname(process.execPath), "npm");
  const result = spawnSync(existsSync(npm) ? npm : "npm", args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: `${dirname(process.execPath)}:${process.env.PATH || ""}`,
    },
    ...extra,
  });
  if (result.status !== 0) fail(`npm ${args.join(" ")} failed with exit ${result.status}`);
}

function missingNeedles(body, needles) {
  return needles.filter((needle) => !body.includes(needle));
}

async function siteUsable(url) {
  const home = await fetchText(url);
  if (home.status !== 200) return { ok: false, reason: `GET / → ${home.status}` };
  const homeMissing = missingNeedles(home.body, ["Cẩm Nang", "Tam Quốc Chí", "Mùa này chơi đội nào?"]);
  if (homeMissing.length) {
    return { ok: false, reason: `GET / missing ${homeMissing.join(", ")}` };
  }
  const teams = await fetchText(new URL("/doi-chuan/", url));
  if (teams.status !== 200) return { ok: false, reason: `GET /doi-chuan/ → ${teams.status}` };
  // Searchbox `Tìm Đội chuẩn` is created after app.js boot; SSR already has the section, h1, and team cards.
  const teamMissing = missingNeedles(teams.body, ['id="section-team-chuan"', "Đội chuẩn", "reference-team-card"]);
  if (teamMissing.length) {
    return { ok: false, reason: `GET /doi-chuan/ missing ${teamMissing.join(", ")}` };
  }
  return { ok: true, home, teams };
}

async function cmdLaunch() {
  mkdirSync(verifyHome, { recursive: true });
  const id = runIdNow();
  const port = Number(flags.port || process.env.TQCCL_VERIFY_PORT || 4175);
  const dir = runDirFor(id);
  const evidenceDir = evidenceDirFor(id);
  mkdirSync(dir, { recursive: true });
  mkdirSync(evidenceDir, { recursive: true });

  if (existsSync(currentPath) && !flags.force) {
    const existingId = readFileSync(currentPath, "utf8").trim();
    if (existingId && existingId !== id) {
      try {
        const existing = loadRun(existingId);
        if (pidAlive(existing.pid)) {
          fail(
            `A verification run is already current (${existingId} on ${existing.url}). Pass --force to clean it up first, or set TQCCL_VERIFY_RUN_ID / --port for a parallel instance.`,
          );
        }
      } catch {
        // stale pointer
      }
    }
  }
  if (flags.force && existsSync(currentPath)) {
    try {
      await cmdCleanup({ keepCurrentPointer: false, silent: true });
    } catch {
      // best effort before relaunch
    }
  }
  mkdirSync(dir, { recursive: true });
  mkdirSync(evidenceDir, { recursive: true });

  const owners = portOwnerPids(port);
  if (owners.length && !flags.force) {
    fail(`Port ${port} is already in use by pid(s) ${owners.join(", ")}. Choose --port or clean up that run.`);
  }

  if (!existsSync(join(repoRoot, "node_modules/astro"))) runNpm(["ci"]);
  const playwrightCli = join(repoRoot, "node_modules/playwright/cli.js");
  if (!existsSync(playwrightCli)) fail("Playwright is missing. From the repo root run: npm ci");
  const install = spawnSync(process.execPath, [playwrightCli, "install", "chromium"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH || ""}` },
  });
  if (install.status !== 0) fail("playwright install chromium failed");

  const distIndex = join(repoRoot, "dist/index.html");
  if (!flags["reuse-dist"] || !existsSync(distIndex)) {
    runNpm(["run", "build"]);
  }
  if (!existsSync(distIndex)) fail("dist/index.html missing after build");

  const previewLog = join(dir, "preview.log");
  const fs = await import("node:fs");
  fs.writeFileSync(previewLog, "");
  const logStream = fs.openSync(previewLog, "a");
  const astro = join(repoRoot, "node_modules/astro/bin/astro.mjs");
  const child = spawn(
    process.execPath,
    [astro, "preview", "--ignore-lock", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: repoRoot,
      detached: true,
      stdio: ["ignore", logStream, logStream],
      env: {
        ...process.env,
        PATH: `${dirname(process.execPath)}:${process.env.PATH || ""}`,
      },
    },
  );
  child.unref();
  const run = {
    runId: id,
    dir,
    evidenceDir,
    port,
    url: `http://127.0.0.1:${port}`,
    pid: child.pid,
    pgid: child.pid,
    repoRoot,
    gitHead: gitHead(),
    node: process.versions.node,
    startedAt: new Date().toISOString(),
    previewLog,
    profileDir: join(dir, "browser-profile"),
    lastUrl: null,
    dist: distIndex,
  };
  saveRun(run);
  writeFileSync(currentPath, `${id}\n`);

  try {
    await waitForPort(port, 30_000);
    const deadline = Date.now() + 30_000;
    let usable;
    while (Date.now() < deadline) {
      usable = await siteUsable(run.url);
      if (usable.ok) break;
      await sleep(300);
    }
    if (!usable?.ok) {
      await killTreeWait(run.pid);
      rmSync(dir, { recursive: true, force: true });
      if (existsSync(currentPath) && readFileSync(currentPath, "utf8").trim() === id) rmSync(currentPath, { force: true });
      fail(`Preview opened but was not usable: ${usable?.reason || "unknown"}`);
    }
  } catch (error) {
    await killTreeWait(run.pid);
    fail(`Launch failed: ${error.message}`);
  }

  const payload = {
    ok: true,
    runId: id,
    url: run.url,
    pid: run.pid,
    gitHead: run.gitHead,
    evidenceDir,
    ready: "GET / shows Cẩm Nang landing; GET /doi-chuan/ includes Tìm Đội chuẩn",
  };
  if (flags.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else {
    process.stdout.write(`launched ${id}\n`);
    process.stdout.write(`url ${run.url}\n`);
    process.stdout.write(`pid ${run.pid}\n`);
    process.stdout.write(`gitHead ${run.gitHead}\n`);
    process.stdout.write(`evidence ${evidenceDir}\n`);
  }
}

function doctorReport(run) {
  const report = {
    ok: true,
    runId: run.runId,
    url: run.url,
    pid: run.pid,
    gitHead: run.gitHead,
    liveGitHead: gitHead(),
    evidenceDir: run.evidenceDir,
    checks: [],
  };
  const note = (ok, name, detail) => {
    report.checks.push({ ok, name, detail });
    if (!ok) report.ok = false;
  };
  note(pidAlive(run.pid), "process", pidAlive(run.pid) ? `pid ${run.pid} alive` : `pid ${run.pid} not running`);
  const owners = portOwnerPids(run.port);
  const family = descendants(run.pid);
  const owned = owners.length > 0 && owners.every((pid) => family.has(pid));
  note(
    owned,
    "port",
    owners.length
      ? `:${run.port} owned by pid(s) ${owners.join(", ")} (launch family ${[...family].join(", ")})`
      : `:${run.port} has no listener`,
  );
  note(run.gitHead === report.liveGitHead, "build-revision", `launch ${run.gitHead} / HEAD ${report.liveGitHead}`);
  note(existsSync(run.dist), "dist", run.dist);
  note(nodeMeetsEngine(run.node), "node", run.node);
  return report;
}

async function cmdDoctor() {
  const run = loadRun();
  const report = doctorReport(run);
  try {
    const usable = await siteUsable(run.url);
    report.checks.push({
      ok: usable.ok,
      name: "usable",
      detail: usable.ok ? "landing + Đội chuẩn HTML identity present" : usable.reason,
    });
    if (!usable.ok) report.ok = false;
  } catch (error) {
    report.checks.push({ ok: false, name: "usable", detail: error.message });
    report.ok = false;
  }
  if (flags.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    for (const check of report.checks) {
      process.stdout.write(`${check.ok ? "ok" : "FAIL"}  ${check.name}: ${check.detail}\n`);
    }
    process.stdout.write(`url ${run.url}\n`);
    process.stdout.write(`evidence ${run.evidenceDir}\n`);
  }
  if (!report.ok) process.exit(1);
}

function evidencePath(run, rel) {
  if (!rel) fail("Need --path for this command");
  const resolved = isAbsolute(rel) ? rel : join(run.evidenceDir, rel);
  if (!resolved.startsWith(run.evidenceDir) && !isAbsolute(rel)) {
    fail("Evidence path escaped the evidence directory");
  }
  mkdirSync(dirname(resolved), { recursive: true });
  return resolved;
}

function recordIndex(run, kind, rel, extra = {}) {
  const line = {
    at: new Date().toISOString(),
    kind,
    path: rel,
    url: run.lastUrl,
    feature: flags.feature || null,
    entry: flags.entry || null,
    ...extra,
  };
  appendFileSync(join(run.evidenceDir, "INDEX.jsonl"), `${JSON.stringify(line)}\n`);
}

async function loadPlaywright() {
  const entry = join(repoRoot, "node_modules/playwright/index.mjs");
  if (!existsSync(entry)) fail("Playwright missing under repo node_modules. Run launch first.");
  return import(pathToFileURL(entry).href);
}

function locatorFor(page, opts = flags) {
  if (opts.css) {
    let loc = page.locator(opts.css);
    if (opts.nth != null) loc = loc.nth(Number(opts.nth));
    return loc;
  }
  if (opts.role) {
    const options = {};
    if (opts.name) {
      options.name = opts.name;
      options.exact = !opts.loose;
    }
    if (opts.level) options.level = Number(opts.level);
    let loc = page.getByRole(opts.role, options);
    if (opts.nth != null) loc = loc.nth(Number(opts.nth));
    return loc;
  }
  if (opts.name) {
    let loc = page.getByLabel(opts.name, { exact: !opts.loose });
    if (opts.nth != null) loc = loc.nth(Number(opts.nth));
    return loc;
  }
  fail("Need --role and --name, or --css, or --name (label)");
}

function localPath(pathValue) {
  if (!pathValue) fail("Need --path");
  if (/^https?:/i.test(pathValue)) {
    const url = new URL(pathValue);
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      fail(`Refusing non-local URL ${pathValue}. Pass a site path such as /doi-chuan/.`);
    }
    return url.pathname + url.search + url.hash;
  }
  if (!pathValue.startsWith("/")) fail(`Path must start with / (got ${pathValue})`);
  return pathValue;
}

async function withPage(fn) {
  const run = loadRun();
  const health = doctorReport(run);
  if (!health.ok) fail(`Instance is not worth driving. Run doctor.\n${JSON.stringify(health, null, 2)}`);
  const { chromium } = await loadPlaywright();
  mkdirSync(run.profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(run.profileDir, {
    headless: !flags.headed,
    viewport: { width: 1280, height: 800 },
    locale: "vi-VN",
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--host-resolver-rules=MAP challenges.cloudflare.com ~NOTFOUND",
    ],
  });
  try {
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      if (local) return route.continue();
      return route.abort();
    });
    const page = context.pages()[0] || await context.newPage();
    if ((!page.url() || page.url() === "about:blank") && run.lastUrl) {
      await page.goto(run.lastUrl, { waitUntil: "domcontentloaded" });
    }
    const result = await fn(page, run);
    run.lastUrl = page.url();
    saveRun(run);
    return result;
  } finally {
    await context.close();
  }
}

async function cmdBrowser() {
  const action = subcommand;
  if (!action) fail("Usage: control-tqccl browser <goto|click|fill|press|wait|snapshot|screenshot|text|url|eval>");
  const timeout = Number(flags.timeout || 15_000);

  const result = await withPage(async (page, run) => {
    if (action === "goto") {
      const pathValue = localPath(flags.path);
      await page.goto(new URL(pathValue, run.url).href, { waitUntil: "domcontentloaded", timeout });
      return { url: page.url(), title: await page.title() };
    }
    if (action === "click") {
      await locatorFor(page).click({ timeout });
      return { url: page.url() };
    }
    if (action === "fill") {
      if (flags.value == null) fail("fill needs --value");
      await locatorFor(page).fill(flags.value, { timeout });
      return { value: flags.value };
    }
    if (action === "press") {
      if (!flags.key) fail("press needs --key");
      if (flags.role || flags.css || flags.name) await locatorFor(page).press(flags.key, { timeout });
      else await page.keyboard.press(flags.key);
      return { key: flags.key };
    }
    if (action === "wait") {
      if (flags.boot) {
        await page.locator("body[data-boot='ready']").waitFor({ state: "attached", timeout });
        return { boot: "ready" };
      }
      await locatorFor(page).waitFor({ state: "visible", timeout });
      return { visible: true };
    }
    if (action === "snapshot") {
      const rel = flags.path || "snapshot.aria.yml";
      const dest = evidencePath(run, rel);
      const snapshot = await page.locator("body").ariaSnapshot();
      writeFileSync(dest, snapshot);
      recordIndex(run, "aria", rel, { bytes: snapshot.length });
      return { path: dest };
    }
    if (action === "screenshot") {
      const rel = flags.path || "screenshot.png";
      const dest = evidencePath(run, rel);
      await page.screenshot({ path: dest, fullPage: true });
      recordIndex(run, "screenshot", rel);
      return { path: dest };
    }
    if (action === "text") {
      const text = (await locatorFor(page).innerText({ timeout })).trim();
      return { text };
    }
    if (action === "url") {
      return { url: page.url() };
    }
    if (action === "eval") {
      if (!flags.js) fail("eval needs --js");
      const value = await page.evaluate(flags.js);
      return { value };
    }
    fail(`Unknown browser action ${action}`);
  });

  if (flags.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    for (const [key, value] of Object.entries(result || {})) {
      process.stdout.write(`${key} ${typeof value === "string" ? value : JSON.stringify(value)}\n`);
    }
  }
}

async function cmdCleanup(opts = {}) {
  const silent = opts.silent;
  let id;
  try {
    id = readCurrentId();
  } catch (error) {
    if (silent) return;
    throw error;
  }
  const file = join(runDirFor(id), "run.json");
  let run = null;
  if (existsSync(file)) run = JSON.parse(readFileSync(file, "utf8"));
  if (run?.pid) await killTreeWait(run.pid);
  const evidenceDir = run?.evidenceDir || evidenceDirFor(id);
  rmSync(runDirFor(id), { recursive: true, force: true });
  if (!opts.keepCurrentPointer && existsSync(currentPath)) {
    const current = readFileSync(currentPath, "utf8").trim();
    if (current === id) rmSync(currentPath, { force: true });
  }
  const payload = {
    ok: true,
    cleanedRunId: id,
    evidenceDir,
    evidencePresent: existsSync(evidenceDir),
  };
  if (silent) return payload;
  if (flags.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else {
    process.stdout.write(`cleaned ${id}\n`);
    process.stdout.write(`evidence ${evidenceDir} present=${payload.evidencePresent}\n`);
  }
}

const help = `control-tqccl — verification CLI for the Cẩm Nang TQCCL static site

Usage:
  control-tqccl launch [--port 4175] [--run-id ID] [--reuse-dist] [--force]
  control-tqccl doctor [--json]
  control-tqccl browser goto --path /doi-chuan/
  control-tqccl browser wait --boot
  control-tqccl browser click --role link --name "Chi tiết" --nth 0
  control-tqccl browser fill --role searchbox --name "Tìm Đội chuẩn" --value "Lưu Bị"
  control-tqccl browser press --key Escape
  control-tqccl browser text --role heading --level 1
  control-tqccl browser screenshot --path doi-chuan/list.png --feature doi-chuan
  control-tqccl browser snapshot --aria --path doi-chuan/list.aria.yml --feature doi-chuan
  control-tqccl browser url
  control-tqccl browser eval --js "document.body.dataset.boot"
  control-tqccl cleanup

drive is an alias of browser. Never pass production URLs. Evidence survives cleanup.
`;

const verbs = { launch: cmdLaunch, doctor: cmdDoctor, browser: cmdBrowser, drive: cmdBrowser, cleanup: cmdCleanup };
if (!command || command === "help" || command === "--help" || command === "-h") {
  process.stdout.write(help);
  process.exit(command ? 0 : 1);
}
if (!verbs[command]) fail(`Unknown command ${command}\n${help}`);
await verbs[command]();
