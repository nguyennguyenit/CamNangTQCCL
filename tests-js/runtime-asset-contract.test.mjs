import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const runtimeAssets = [
  ["teams.json", "array"],
  ["coexist.json", "array"],
  ["khaihoang.json", "object"],
  ["tactics.json", "array"],
  ["heroes-dict.json", "array"],
  ["books-dict.json", "array"],
  ["team-tier.json", "array"],
];

async function jsonAsset(name) {
  return JSON.parse(await readFile(new URL(`data/${name}`, root), "utf8"));
}

test("all runtime JSON assets exist, parse, and retain top-level shapes", async () => {
  for (const [name, shape] of runtimeAssets) {
    const url = new URL(`data/${name}`, root);
    assert.ok((await stat(url)).isFile(), `${name} must be a regular file`);
    const value = await jsonAsset(name);
    if (shape === "array") {
      assert.ok(Array.isArray(value), `${name} must contain an array`);
      assert.ok(value.length > 0, `${name} must not be empty`);
    } else {
      assert.equal(Array.isArray(value), false, `${name} must contain an object`);
      assert.equal(typeof value, "object");
      assert.notEqual(value, null);
    }
  }
});

test("team identifiers are unique and every tier row joins a team", async () => {
  const teams = await jsonAsset("teams.json");
  const teamTier = await jsonAsset("team-tier.json");
  const ids = teams.map((team) => team.id);
  const idSet = new Set(ids);

  assert.equal(idSet.size, ids.length, "team.id values must be unique");
  assert.ok(teams.every((team) => Array.isArray(team.heroes) && team.heroes.length > 0));
  assert.ok(teams.every((team) => team.source !== "do-uy"), "Đô Úy teams must stay hidden");
  for (const row of teamTier) {
    assert.equal(typeof row.teamId, "string");
    assert.ok(idSet.has(row.teamId), `unknown team-tier teamId: ${row.teamId}`);
    assert.ok(Array.isArray(row.rankings));
  }
});

test("published facets and modules do not expose the retired Đô Úy season", async () => {
  const facets = await jsonAsset("facets.json");
  assert.ok(facets.sources.every(({ value }) => value !== "do-uy"));

  const manifestSource = await readFile(new URL("src/lib/public-artifact-manifest.mjs", root), "utf8");
  assert.doesNotMatch(manifestSource, /entry\(["']js["'],\s*["']do-uy["']\)/);
});

test("app keeps six required JSON requests and team tier optional", async () => {
  const source = await readFile(new URL("js/app.js", root), "utf8");
  const required = [
    "teams.json",
    "coexist.json",
    "khaihoang.json",
    "tactics.json",
    "heroes-dict.json",
    "books-dict.json",
  ];

  for (const name of required) {
    assert.match(source, new RegExp(`loadJSON\\(["']\\.\\/data\\/${name.replace(".", "\\.")}["']\\)`));
    assert.doesNotMatch(source, new RegExp(`loadOptionalJSON\\(["']\\.\\/data\\/${name.replace(".", "\\.")}["']`));
  }
  assert.match(source, /loadOptionalJSON\(["']\.\/data\/team-tier\.json["'], \[\]\)/);
});

test("app preserves the nine-section hash contract and cross-section search seam", async () => {
  const source = await readFile(new URL("js/app.js", root), "utf8");
  const expectedSections = [
    "team-pk",
    "meta-cu",
    "coexist",
    "khaihoang",
    "heroes",
    "tactics",
    "recruit-tracker",
    "analyze",
    "roster-recommend",
  ];
  const sectionMatch = source.match(/const SECTIONS\s*=\s*\[([\s\S]*?)\]\s*;/);
  const actualSections = sectionMatch
    ? [...sectionMatch[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1])
    : [];

  assert.ok(sectionMatch, "SECTIONS array must remain observable");
  assert.deepEqual(actualSections, expectedSections);
  assert.match(source, /return SECTIONS\.includes\(name\) \? name : ["']team-pk["']/);
  assert.match(source, /sections\[name\]\?\.setSearch\(first\)/);
});
