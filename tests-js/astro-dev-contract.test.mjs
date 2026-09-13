import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForServer(url, process, output) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (process.exitCode !== null && process.exitCode !== 0) {
      throw new Error(`Astro dev exited early (${process.exitCode}):\n${output.join("")}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for Astro dev:\n${output.join("")}`);
}

async function waitForExit(process, output) {
  if (process.exitCode !== null) return process.exitCode;
  return new Promise((resolve, reject) => {
    process.once("error", reject);
    process.once("exit", resolve);
    setTimeout(() => {
      reject(new Error(`Timed out waiting for process exit:\n${output.join("")}`));
    }, 5_000).unref();
  });
}

async function serverIsReachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(250) });
    return true;
  } catch {
    return false;
  }
}

async function waitForServerStop(url, output) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!(await serverIsReachable(url))) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for server shutdown:\n${output.join("")}`);
}

async function stopManagedDevServer({ astroBin, cwd, url, child, output }) {
  if (child.exitCode === null) child.kill("SIGTERM");
  if (!(await serverIsReachable(url))) return;

  const stopOutput = [];
  const stopper = spawn(astroBin, ["dev", "stop"], {
    cwd,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  stopper.stdout.on("data", (chunk) => stopOutput.push(chunk.toString()));
  stopper.stderr.on("data", (chunk) => stopOutput.push(chunk.toString()));
  const exitCode = await waitForExit(stopper, stopOutput);
  assert.equal(exitCode, 0, `Astro dev stop failed:\n${stopOutput.join("")}`);
  await waitForServerStop(url, [...output, ...stopOutput]);
}

test("Astro dev preserves module resolution, MIME types, refresh, and exact JSON bytes", async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "tqccl-astro-dev-"));
  const fixtureUrl = new URL(`file://${fixtureRoot}/`);
  for (const path of ["src", "js", "css", "data"]) {
    await cp(new URL(`../${path}/`, import.meta.url), new URL(`${path}/`, fixtureUrl), { recursive: true });
  }
  for (const path of ["astro.config.mjs", "tsconfig.json"]) {
    await cp(new URL(`../${path}`, import.meta.url), new URL(path, fixtureUrl));
  }
  await symlink(new URL("../node_modules/", import.meta.url), new URL("node_modules", fixtureUrl), "dir");
  const privateSentinel = "lookup-private-sentinel";
  const privateFiles = [
    "pipeline/lookup-identity.json",
    "pipeline/lookup-translations.json",
    "pipeline/lookup-inputs/sentinel.txt",
    "pipeline/lookup-output/sentinel.txt",
    "data/sgsdeck/sentinel.txt",
  ];
  for (const privateFile of privateFiles) {
    const target = new URL(privateFile, fixtureUrl);
    await mkdir(new URL(".", target), { recursive: true });
    await writeFile(target, privateSentinel);
  }

  const port = await availablePort();
  const output = [];
  const astroBin = new URL("../node_modules/.bin/astro", import.meta.url).pathname;
  const child = spawn(astroBin, ["dev", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: fixtureRoot,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  t.after(async () => {
    try {
      await stopManagedDevServer({
        astroBin,
        cwd: fixtureRoot,
        url: `http://127.0.0.1:${port}`,
        child,
        output,
      });
    } finally {
      await import("node:fs/promises").then(({ rm }) =>
        rm(fixtureRoot, { recursive: true, force: true }));
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl, child, output);

  const appSource = await readFile(new URL("js/app.js", fixtureUrl), "utf8");
  const appResponse = await fetch(`${baseUrl}/js/app.js`);
  assert.equal(appResponse.status, 200);
  assert.match(appResponse.headers.get("content-type") || "", /text\/javascript/);
  const appBody = await appResponse.text();
  const relativeImports = [...appSource.matchAll(/\bfrom\s+["']\.\/([^"']+)["']/g)]
    .map((match) => match[1]);
  assert.ok(relativeImports.length > 0, "fixture app must exercise relative imports");
  for (const importedFile of relativeImports) {
    assert.ok(
      appBody.includes(`./${importedFile}`) || appBody.includes(`/js/${importedFile}`),
      `dev response must preserve a resolvable import for ${importedFile}`,
    );
    assert.equal((await fetch(`${baseUrl}/js/${importedFile}`)).status, 200);
  }

  const stylesheetHeaders = {
    Accept: "text/css,*/*;q=0.1",
    "Sec-Fetch-Dest": "style",
  };
  const cssResponse = await fetch(`${baseUrl}/css/styles.css`, {
    headers: stylesheetHeaders,
  });
  assert.equal(cssResponse.status, 200);
  assert.match(cssResponse.headers.get("content-type") || "", /text\/css/);
  assert.ok((await cssResponse.text()).length > 0);

  const jsonResponse = await fetch(`${baseUrl}/data/teams.json`);
  assert.equal(jsonResponse.status, 200);
  assert.match(jsonResponse.headers.get("content-type") || "", /application\/json/);
  assert.deepEqual(
    Buffer.from(await jsonResponse.arrayBuffer()),
    await readFile(new URL("data/teams.json", fixtureUrl)),
  );
  const privateUrls = [
    "/pipeline/lookup-identity.json",
    "/pipeline/lookup-translations.json?raw",
    "/pipeline/lookup-inputs/sentinel.txt?import",
    "/pipeline/lookup-output/sentinel.txt",
    "/data/sgsdeck/sentinel.txt",
    `/@fs/${fixtureRoot}/pipeline/lookup-inputs/sentinel.txt?raw`,
    `/@fs/${fixtureRoot}/pipeline/LOOKUP-identity.json?raw`,
    `/@fs/${fixtureRoot}/data/SGSDECK/sentinel.txt?raw`,
    "/data/%2e%2e/pipeline/lookup-output/sentinel.txt",
  ];
  for (const privateUrl of privateUrls) {
    const response = await fetch(`${baseUrl}${privateUrl}`);
    const body = await response.text();
    assert.equal(response.status, 404, `private artifact must be denied: ${privateUrl}`);
    assert.equal(body.includes(privateSentinel), false, `private bytes leaked: ${privateUrl}`);
  }

  const jsRefreshMarker = "fixture-js-refresh";
  await writeFile(
    new URL("js/app.js", fixtureUrl),
    `${appSource}\n// ${jsRefreshMarker}\n`,
  );
  const refreshedJs = await fetch(`${baseUrl}/js/app.js?after-edit=1`);
  assert.match(await refreshedJs.text(), new RegExp(jsRefreshMarker));

  const cssSource = await readFile(new URL("css/styles.css", fixtureUrl), "utf8");
  const cssRefreshMarker = "fixture-css-refresh";
  await writeFile(
    new URL("css/styles.css", fixtureUrl),
    `${cssSource}\n/* ${cssRefreshMarker} */\n`,
  );
  const refreshedCss = await fetch(`${baseUrl}/css/styles.css?after-edit=1`, {
    headers: stylesheetHeaders,
  });
  assert.match(await refreshedCss.text(), new RegExp(cssRefreshMarker));

  const refreshedBytes = Buffer.from('[{"fixture":"refreshed"}]\n');
  await writeFile(new URL("data/teams.json", fixtureUrl), refreshedBytes);
  const refreshed = await fetch(`${baseUrl}/data/teams.json?after-edit=1`);
  assert.deepEqual(Buffer.from(await refreshed.arrayBuffer()), refreshedBytes);

  assert.equal((await fetch(`${baseUrl}/data/not-allowlisted.json`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/pipeline/build_json.py`)).status, 404);
});

test("Astro preview serves exact built assets with browser MIME types", async (t) => {
  const projectRoot = new URL("../", import.meta.url);
  const port = await availablePort();
  const output = [];
  const astroBin = new URL("../node_modules/.bin/astro", import.meta.url).pathname;
  const child = spawn(
    astroBin,
    ["preview", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  t.after(async () => {
    if (child.exitCode === null) child.kill("SIGTERM");
    await waitForExit(child, output);
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl, child, output);
  for (const [urlPath, sourcePath, contentType] of [
    ["/js/app.js", "js/app.js", /text\/javascript/],
    ["/css/styles.css", "css/styles.css", /text\/css/],
    ["/data/teams.json", "data/teams.json", /application\/json/],
  ]) {
    const response = await fetch(`${baseUrl}${urlPath}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", contentType);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      await readFile(new URL(sourcePath, projectRoot)),
    );
  }
  assert.equal((await fetch(`${baseUrl}/pipeline/build_json.py`)).status, 404);
});
