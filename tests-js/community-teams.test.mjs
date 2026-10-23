import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COMMUNITY_TEAMS_INDEX_MIN,
  canonicalTeamPath,
  communityTeamPath,
  communityTeamsIndexable,
  fetchCommunityTeams,
  loadCommunityTeams,
  validateTeamsExport,
} from "../src/lib/community-teams.ts";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/community-teams-export.json", import.meta.url), "utf8"));
const ENV = { COMMUNITY_API_ORIGIN: "https://community.example" };
const respond = (body, init = {}) => async () =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200, ...init });
const clone = (value) => structuredClone(value);
const withItem = (overrides) => ({ schemaVersion: 1, items: [{ ...clone(FIXTURE.items[0]), ...overrides }] });

test("L1: không có COMMUNITY_API_ORIGIN → rỗng và không gọi mạng", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response("{}"); };
  assert.deepEqual(await fetchCommunityTeams({ env: {}, fetchImpl }), []);
  assert.deepEqual(await fetchCommunityTeams({ env: { COMMUNITY_API_ORIGIN: "  " }, fetchImpl }), []);
  assert.equal(calls, 0);
});

test("L2: có origin mà API/payload lỗi → dừng build", async () => {
  const fail = (fetchImpl, pattern) => assert.rejects(fetchCommunityTeams({ env: ENV, fetchImpl }), pattern);
  await fail(respond({}, { status: 503 }), /HTTP 503/);
  await fail(respond("<html>"), /not JSON/);
  await fail(respond({ schemaVersion: 2, items: [] }), /schemaVersion/);
  await fail(async () => { throw new Error("boom"); }, /boom/);

  const rejects = {
    "id sai": withItem({ id: "Bad_Id" }),
    "id path": withItem({ id: "../x" }),
    "id trùng": { schemaVersion: 1, items: [FIXTURE.items[0], FIXTURE.items[0]] },
    "heroes 2 phần tử": withItem({ heroes: ["hero:a", "hero:b"] }),
    "hero không có tiền tố": withItem({ heroes: ["hero:a", "hero:b", "c"] }),
    "tactics thiếu": withItem({ tactics: [["tactic:a", "tactic:b"], ["tactic:c", "tactic:d"]] }),
    "troop lạ": withItem({ troop: "x" }),
    "textLang en": withItem({ textLang: "en" }),
    "approvedAt sai": withItem({ approvedAt: "hôm qua" }),
    "createdAt sai": withItem({ createdAt: "nope" }),
    "thiếu playstyle": withItem({ analysis: { ...FIXTURE.items[0].analysis, playstyle: undefined } }),
    "playstyle rỗng": withItem({ analysis: { ...FIXTURE.items[0].analysis, playstyle: "" } }),
    "title rỗng": withItem({ title: "" }),
    "title quá dài": withItem({ title: "x".repeat(81) }),
    "imageCount 4": withItem({ imageCount: 4 }),
    "author.name không phải chuỗi": withItem({ author: { id: "u", name: 5 } }),
    "season thiếu labelZh": withItem({ season: { id: "s1", labelVi: "Mùa 1" } }),
    "items không phải mảng": { schemaVersion: 1, items: {} },
  };
  for (const [name, payload] of Object.entries(rejects)) {
    assert.throws(() => validateTeamsExport(payload), /Community teams export/, name);
  }
});

test("L3: fixture 10 đội → sắp createdAt desc, id desc; không còn khoá vote/author.id", async () => {
  const shuffled = { schemaVersion: 1, items: [...FIXTURE.items].reverse() };
  const teams = await fetchCommunityTeams({ env: ENV, fetchImpl: respond(shuffled) });
  assert.equal(teams.length, 10);
  assert.deepEqual(teams.map((team) => team.id), FIXTURE.items.map((item) => item.id));
  for (const team of teams) {
    for (const key of ["upVotes", "downVotes", "points", "commentCount", "evidenceCount"]) assert.ok(!(key in team), key);
    assert.deepEqual(Object.keys(team.author), ["name"]);
  }
  const zh = teams.find((team) => team.textLang === "zh");
  const vi = teams.find((team) => team.textLang === "vi");
  assert.equal(canonicalTeamPath(zh), `/zh/doi-cong-dong/${zh.id}/`);
  assert.equal(canonicalTeamPath(vi), `/doi-cong-dong/${vi.id}/`);
  assert.equal(communityTeamPath("a1", "zh"), "/zh/doi-cong-dong/a1/");
  assert.equal(communityTeamPath("a1", "vi"), "/doi-cong-dong/a1/");

  // Cùng createdAt: id giảm dần.
  const tie = { schemaVersion: 1, items: ["a", "c", "b"].map((id) => ({ ...clone(FIXTURE.items[0]), id })) };
  assert.deepEqual(validateTeamsExport(tie).map((team) => team.id), ["c", "b", "a"]);
});

test("L3b: author.name rỗng/khoảng trắng/null → null; có chữ thì trim", () => {
  const name = (value) => validateTeamsExport(withItem({ author: { id: "u", name: value } }))[0].author.name;
  assert.equal(name(""), null);
  assert.equal(name("   "), null);
  assert.equal(name(null), null);
  assert.equal(name("  Nguyên "), "Nguyên");
});

test("L4: ngưỡng index 10 id và memo một fetch cho nhiều lần gọi", async () => {
  assert.equal(COMMUNITY_TEAMS_INDEX_MIN, 10);
  assert.equal(communityTeamsIndexable(9), false);
  assert.equal(communityTeamsIndexable(10), true);

  const previousEnv = process.env.COMMUNITY_API_ORIGIN;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  process.env.COMMUNITY_API_ORIGIN = "https://memo.community.example";
  globalThis.fetch = async (input) => {
    calls += 1;
    assert.equal(String(input), "https://memo.community.example/api/community-teams/export");
    return new Response(JSON.stringify(FIXTURE));
  };
  try {
    const [first, second] = await Promise.all([loadCommunityTeams(), loadCommunityTeams()]);
    assert.equal(first, second);
    assert.equal(first.length, 10);
    await loadCommunityTeams();
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousEnv === undefined) delete process.env.COMMUNITY_API_ORIGIN;
    else process.env.COMMUNITY_API_ORIGIN = previousEnv;
  }
});
