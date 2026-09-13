import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PUBLIC_ARTIFACTS } from "../src/lib/public-artifact-manifest.mjs";

const headersPath = new URL("../public/_headers", import.meta.url);
const cachePolicy = "public, max-age=0, must-revalidate";
const expectedRules = ["/", "/index.html", "/js/*", "/css/*", "/data/*", "/favicon.png"];

function parseHeaders(source) {
  const rules = new Map();
  let activePath;
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      activePath = line;
      assert.ok(activePath.startsWith("/"), `line ${index + 1}: path must start with /`);
      assert.ok(!rules.has(activePath), `line ${index + 1}: duplicate path`);
      rules.set(activePath, new Map());
      continue;
    }
    assert.ok(activePath, `line ${index + 1}: header has no path`);
    const match = line.trim().match(/^([^:]+):\s*(.+)$/);
    assert.ok(match, `line ${index + 1}: malformed header`);
    const name = match[1].toLowerCase();
    assert.ok(!rules.get(activePath).has(name), `line ${index + 1}: duplicate header`);
    rules.get(activePath).set(name, match[2]);
  }
  return rules;
}

function ruleMatches(rule, path) {
  if (!rule.endsWith("*")) return rule === path;
  return path.startsWith(rule.slice(0, -1));
}

function policyFor(rules, path) {
  const matched = [...rules]
    .filter(([rule]) => ruleMatches(rule, path))
    .map(([, headers]) => headers.get("cache-control"))
    .filter(Boolean);
  return matched.at(-1);
}

function visibleVersion({ policy, cachedVersion, deployedVersion, canRevalidate }) {
  if (!cachedVersion) return deployedVersion;
  const directives = new Set(policy.split(",").map((part) => part.trim()));
  if (directives.has("max-age=0") && directives.has("must-revalidate")) {
    return canRevalidate ? deployedVersion : null;
  }
  return cachedVersion;
}

test("_headers has exact mutable-asset revalidation rules", async () => {
  const rules = parseHeaders(await readFile(headersPath, "utf8"));
  assert.deepEqual([...rules.keys()], expectedRules);
  for (const headers of rules.values()) {
    assert.deepEqual(Object.fromEntries(headers), { "cache-control": cachePolicy });
  }
});

test("_headers covers every published shell and mutable raw asset", async () => {
  const rules = parseHeaders(await readFile(headersPath, "utf8"));
  const publicPaths = [
    "/",
    "/index.html",
    "/favicon.png",
    ...PUBLIC_ARTIFACTS.map((artifact) => `/${artifact.kind}/${artifact.sourceBasename}`),
    "/data/recommended/current.json",
    `/data/recommended/${"1".repeat(64)}/manifest.json`,
    `/data/recommended/${"1".repeat(64)}/details-s-${"2".repeat(64)}.json`,
  ];
  for (const path of publicPaths) {
    assert.equal(policyFor(rules, path), cachePolicy, `${path} must revalidate`);
  }
  for (const path of ["/pipeline/private.py", "/worker/src/index.ts", "/tests/example.py", "/plans/plan.md"]) {
    assert.equal(policyFor(rules, path), undefined, `${path} must not match a public rule`);
  }
});

test("cache policy models fresh clients and whole-artifact rollback", async () => {
  const rules = parseHeaders(await readFile(headersPath, "utf8"));
  const policy = policyFor(rules, "/js/app.js");
  assert.equal(visibleVersion({
    policy,
    cachedVersion: null,
    deployedVersion: "current",
    canRevalidate: true,
  }), "current");
  assert.equal(visibleVersion({
    policy,
    cachedVersion: "failed",
    deployedVersion: "known-good",
    canRevalidate: true,
  }), "known-good");
  assert.equal(visibleVersion({
    policy,
    cachedVersion: "failed",
    deployedVersion: "known-good",
    canRevalidate: false,
  }), null);
});
