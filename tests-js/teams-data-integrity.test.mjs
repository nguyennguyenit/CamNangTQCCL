// Toàn vẹn tên trong data/teams.json: chữ tiếng Việt dựng sẵn (NFC) và mọi tướng/chiến pháp của đội
// đều sở hữu được bằng bản ghi từ điển — trừ các tên đang chờ nguồn, mỗi tên kèm lý do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recommendTeams } from "../js/team-recommend-engine.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const teamsText = read("data/teams.json");
const teams = JSON.parse(teamsText);
const heroes = JSON.parse(read("data/heroes-dict.json"));
const tactics = JSON.parse(read("data/tactics.json"));

const NO_DICTIONARY_RECORD = "không có bản ghi từ điển";
const MASTER_DISCIPLE = "biến thể đệ tử bái sư, chưa có bản ghi từ điển";
const REFINED_TACTIC = "chiến pháp bản tinh, chưa có bản ghi từ điển";
const PENDING_SOURCE_NAMES = new Map([
  ["SP Lô Trực", NO_DICTIONARY_RECORD],
  ["Tiêu Chỉ", NO_DICTIONARY_RECORD],
  ["Đồng Tâm Hiệp Lực", NO_DICTIONARY_RECORD],
  ["Bái Sư Pháp Chính", MASTER_DISCIPLE],
  ["Bái Sư SP Tuân Úc", MASTER_DISCIPLE],
  ["Bái Sư Hứa Du", MASTER_DISCIPLE],
  ["Tinh·Phong Thi Trận", REFINED_TACTIC],
]);

function strings(value, path = "$", out = []) {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((item, index) => strings(item, `${path}[${index}]`, out));
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) strings(item, `${path}.${key}`, out);
  return out;
}

test("mọi chuỗi trong data/teams.json ở dạng NFC, không có dấu kết hợp rời", () => {
  const broken = strings(teams)
    .filter(([, text]) => text !== text.normalize("NFC") || /[\u0300-\u036f]/u.test(text))
    .map(([path, text]) => `${path}: ${text}`);
  assert.deepEqual(broken, []);
});

test("sở hữu đủ từ điển thì không đội nào bị chặn vì thiếu tướng/chiến pháp, trừ tên chờ nguồn", () => {
  const pending = [...PENDING_SOURCE_NAMES.keys()];
  const ownedHeroes = [...heroes.map((record) => record.viet).filter(Boolean), ...pending];
  const ownedTactics = [...tactics.map((record) => record.viet).filter(Boolean), ...pending];
  const blocked = [];
  for (const team of teams) {
    const result = recommendTeams({ teams: [team], teamTier: [], ownedHeroes, ownedTactics, mode: "redStars", maxTeams: 1 });
    for (const entry of result.blockedStrongTeams) {
      const names = [...(entry.missingHeroSlotNames ?? []).flat(), ...(entry.missingTactics ?? [])];
      blocked.push(`${team.id}: ${names.join(" / ")}`);
    }
  }
  assert.deepEqual(blocked, []);
});

test("danh sách chờ nguồn chỉ giữ tên còn dùng và thật sự chưa có trong từ điển", () => {
  const dictionary = new Set([...heroes, ...tactics].map((record) => record.viet));
  for (const [name, reason] of PENDING_SOURCE_NAMES) {
    assert.ok(reason.length > 0, name);
    assert.ok(teamsText.includes(name), `${name} không còn trong data/teams.json — bỏ khỏi danh sách chờ`);
    assert.equal(dictionary.has(name), false, `${name} đã có bản ghi từ điển — bỏ khỏi danh sách chờ`);
  }
});
