// js/analyze-state.js — link chia sẻ `?doi=` (chỉ ID canonical, có phiên bản) và lịch sử trên máy.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  addHistoryEntry,
  decodeTeamParam,
  encodeTeamParam,
  readHistory,
  writeHistory,
} from "../js/analyze-state.js";

const TEAM = {
  heroes: [
    { hero: "hero:sp-tuan-uc", tactics: ["tactic:me-hoac", null], book: "book:giap-sat" },
    { hero: "hero:quan-vu", tactics: [null, "tactic:doat-hon-hiep-phach"], book: null },
    { hero: "hero:truong-phi", tactics: [null, null], book: null },
  ],
};
const KNOWN = new Set([
  "hero:sp-tuan-uc", "hero:quan-vu", "hero:truong-phi",
  "tactic:me-hoac", "tactic:doat-hon-hiep-phach", "book:giap-sat",
]);
const hasId = (id) => KNOWN.has(id);

test("encode/decode ?doi=: round-trip giữ đúng ô, có tiền tố phiên bản, không cần mã hoá URL", () => {
  const value = encodeTeamParam(TEAM);
  assert.ok(value.startsWith("v1."));
  assert.match(value, /^[a-z0-9._-]+$/);
  assert.doesNotMatch(value, /[\u3400-\u9fff]/u);
  // URLSearchParams không đổi giá trị (link đọc được, không %xx).
  const params = new URLSearchParams({ doi: value });
  assert.equal(params.toString(), `doi=${value}`);
  assert.deepEqual(decodeTeamParam(params.get("doi"), { hasId }), TEAM);
});

test("encodeTeamParam từ chối đội sai hình dạng hoặc ID không canonical", () => {
  assert.throws(() => encodeTeamParam({ heroes: TEAM.heroes.slice(0, 2) }));
  assert.throws(() => encodeTeamParam({ heroes: [{ ...TEAM.heroes[0], hero: null }, ...TEAM.heroes.slice(1)] }));
  assert.throws(() => encodeTeamParam({ heroes: [{ ...TEAM.heroes[0], hero: "曹操" }, ...TEAM.heroes.slice(1)] }));
  assert.throws(() => encodeTeamParam({ heroes: [{ ...TEAM.heroes[0], tactics: ["hero:quan-vu", null] }, ...TEAM.heroes.slice(1)] }));
});

test("decodeTeamParam: link hỏng trả null (bỏ qua lặng lẽ)", () => {
  const good = encodeTeamParam(TEAM);
  const broken = [
    null,
    "",
    "v1",
    good.replace(/^v1\./u, "v2."), // phiên bản lạ
    good.replace(/^v1\./u, ""), // thiếu phiên bản
    good.split(".").slice(0, 3).join("."), // thiếu một tướng
    `${good}.hero_a_b_c`, // thừa một tướng
    good.replace("sp-tuan-uc_", "sp-tuan-uc__"), // sai số ô
    good.replace("sp-tuan-uc", ""), // tướng trống
    good.replace("sp-tuan-uc", "SP-Tuan-Uc"), // chữ hoa
    good.replace("sp-tuan-uc", "荀彧"), // chữ Hán thô
    good.replace("sp-tuan-uc", "sp-tuan-uc%20"),
    `v1.${"a".repeat(2000)}`,
  ];
  for (const value of broken) assert.equal(decodeTeamParam(value, { hasId }), null, String(value));
  // ID không còn trong từ điển (tướng đã đổi tên...) cũng là link hỏng.
  assert.equal(decodeTeamParam(good, { hasId: (id) => id !== "book:giap-sat" }), null);
});

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

const entry = (index, season = "pk-s28") => ({
  doi: encodeTeamParam({ heroes: [{ ...TEAM.heroes[0], hero: `hero:tuong-${index}` }, ...TEAM.heroes.slice(1)] }),
  season,
  savedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
});

test("lịch sử: mới nhất lên đầu, tối đa 10 mục, cùng đội + cùng mùa thay mục cũ", () => {
  let history = [];
  for (let index = 0; index < 12; index++) history = addHistoryEntry(history, entry(index));
  assert.equal(HISTORY_LIMIT, 10);
  assert.equal(history.length, 10);
  assert.equal(history[0].doi, entry(11).doi);
  assert.equal(history.at(-1).doi, entry(2).doi);
  // Mở lại đội cũ -> đưa lên đầu, không nhân đôi.
  const again = { ...entry(5), savedAt: "2026-09-29T00:00:00.000Z" };
  history = addHistoryEntry(history, again);
  assert.equal(history.length, 10);
  assert.deepEqual(history[0], again);
  assert.equal(history.filter((item) => item.doi === again.doi).length, 1);
  // Cùng đội khác mùa là mục riêng.
  history = addHistoryEntry(history, entry(5, "pk-s27"));
  assert.equal(history.filter((item) => item.doi === again.doi).length, 2);
  // Mục sai hình dạng không được thêm.
  assert.deepEqual(addHistoryEntry(history, { doi: "v9.x", season: null, savedAt: "x" }), history);
});

test("lịch sử: chỉ lưu đội + mùa + thời điểm; đọc bỏ qua JSON hỏng, mục lạ và storage lỗi", () => {
  const storage = memoryStorage();
  const history = addHistoryEntry([], { ...entry(1), image: "data:image/png;base64,AAAA", token: "t" });
  assert.equal(writeHistory(storage, history), true);
  const saved = JSON.parse(storage.data.get(HISTORY_STORAGE_KEY));
  assert.deepEqual(Object.keys(saved[0]).sort(), ["doi", "savedAt", "season"]);
  assert.deepEqual(readHistory(storage), history);

  assert.deepEqual(readHistory(memoryStorage({ [HISTORY_STORAGE_KEY]: "{hỏng" })), []);
  assert.deepEqual(readHistory(memoryStorage({ [HISTORY_STORAGE_KEY]: JSON.stringify({}) })), []);
  const mixed = [entry(1), { doi: "v1.x", season: "a", savedAt: "2026-01-01" }, { ...entry(2), savedAt: "không phải ngày" }, entry(3)];
  assert.deepEqual(readHistory(memoryStorage({ [HISTORY_STORAGE_KEY]: JSON.stringify(mixed) })), [entry(1), entry(3)]);
  const tooMany = Array.from({ length: 15 }, (_, index) => entry(index));
  assert.equal(readHistory(memoryStorage({ [HISTORY_STORAGE_KEY]: JSON.stringify(tooMany) })).length, 10);

  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("blocked"); } };
  assert.deepEqual(readHistory(blocked), []);
  assert.equal(writeHistory(blocked, history), false);
  assert.deepEqual(readHistory(null), []);
  // Xoá hết lịch sử bỏ hẳn khoá.
  writeHistory(storage, []);
  assert.equal(storage.data.has(HISTORY_STORAGE_KEY), false);
});
