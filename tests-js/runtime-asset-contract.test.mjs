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
  ["season-registry.json", "array"],
  ["season-evidence.json", "array"],
  ["season-team-configs.json", "array", true],
  ["season-team-evaluations.json", "array", true],
  ["season-content-links.json", "array"],
];

async function jsonAsset(name) {
  return JSON.parse(await readFile(new URL(`data/${name}`, root), "utf8"));
}

test("season attribution is versioned and cannot imply an unverified ruleset", async () => {
  const registry = await jsonAsset("season-registry.json");
  const evidence = await jsonAsset("season-evidence.json");
  const proofById = new Map(evidence.map((proof) => [proof.id, proof]));
  assert.equal(proofById.size, evidence.length);
  for (const row of [...registry, ...evidence]) assert.equal(row.schemaVersion, 1);
  const scenario = registry.find((row) => row.id === "binh-dien-xuan-thu");
  assert.equal(scenario.reviewStatus, "reviewed");
  assert.deepEqual(scenario.rulesets, []);
  assert.ok(scenario.sourceMappings.every((mapping) => mapping.rulesetId === null));
  for (const ref of scenario.evidenceRefs) {
    assert.equal(proofById.get(ref)?.reviewStatus, "reviewed");
    assert.equal(proofById.get(ref)?.claim.kind, "scenario-attribution");
    assert.equal(proofById.get(ref)?.claim.rulesetId, null);
  }
});

test("all runtime JSON assets exist, parse, and retain top-level shapes", async () => {
  for (const [name, shape, allowEmpty = false] of runtimeAssets) {
    const url = new URL(`data/${name}`, root);
    assert.ok((await stat(url)).isFile(), `${name} must be a regular file`);
    const value = await jsonAsset(name);
    if (shape === "array") {
      assert.ok(Array.isArray(value), `${name} must contain an array`);
      if (!allowEmpty) assert.ok(value.length > 0, `${name} must not be empty`);
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


