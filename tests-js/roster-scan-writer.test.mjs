import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyCloudState, mergeLocal, putRecord, toScanState } from "../js/roster-cloud-store.js";
import { createRosterIdResolver } from "../js/roster-id-resolve.js";
import { addCanonicalItem, createInitialRosterScanState, removeItem } from "../js/roster-scan-state.js";
import { createScanWriter, reconcileScanWithCloud } from "../js/roster-scan-writer.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const resolve = createRosterIdResolver({ heroesDict: load("heroes-dict.json"), tacticsDict: load("tactics.json") });
const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);

/** `sync.mutate` tối giản: chạy `fn` trên state giữ trong bộ nhớ, có thể treo bằng `gate`. */
function fakeSync(initial) {
  let state = initial;
  let clock = NOW;
  const fake = {
    gate: null,
    state: () => state,
    async mutate(fn) {
      if (fake.gate) await fake.gate;
      const next = fn(state, { now: (clock += 1) });
      const changed = next !== state;
      state = next;
      return { ok: true, changed };
    },
  };
  return fake;
}

const inventory = () => {
  let scan = createInitialRosterScanState();
  for (const name of ["Mã Siêu", "Tào Tháo"]) scan = addCanonicalItem(scan, "heroes", name);
  return scan;
};

test("M3. writer: xóa mềm theo chênh lệch kho UI (nạp từ cloud → lần ghi → lần ghi), bản cloud lạ không bị xóa", async () => {
  let { state } = mergeLocal(emptyCloudState("u-alice"), inventory(), resolve, { now: NOW });
  state = putRecord(state, { kind: "owned", id: "main~hero:ban-sau", boxId: "main", data: { item: "hero:ban-sau", name: "Tướng Bản Sau", type: "hero" } }, { now: NOW + 5 });
  const sync = fakeSync(state);
  const writer = createScanWriter({ sync, resolve, boxId: () => "main" });
  const loaded = toScanState(sync.state(), "main"); // UI không dựng được `hero:ban-sau`? Nó có trong cache nên hiện ra; mô phỏng UI cũ hơn bằng kho trước
  writer.rebase(toScanState(mergeLocal(emptyCloudState("u-alice"), inventory(), resolve, { now: NOW }).state, "main"));

  const next = removeItem(loaded, "heroes", "Tào Tháo");
  const result = await writer.write(next);
  assert.equal(result.idle, true);
  assert.equal(sync.state().records["owned:main~hero:tao-thao"].deleted, true);
  assert.equal(sync.state().records["owned:main~hero:ban-sau"].deleted, false, "món không có trong kho UI trước đó không bị xóa");
});

test("M3. writer: hai lần ghi liên tiếp dùng lần ghi trước làm previous; busy() đúng trong lúc chờ, idle chỉ ở lần cuối", async () => {
  const { state } = mergeLocal(emptyCloudState("u-alice"), inventory(), resolve, { now: NOW });
  const sync = fakeSync(state);
  const writer = createScanWriter({ sync, resolve, boxId: () => "main" });
  const baseline = toScanState(state, "main");
  writer.rebase(baseline);
  let release;
  sync.gate = new Promise((done) => (release = done));

  const withExtra = addCanonicalItem(baseline, "heroes", "SP Quách Gia");
  const first = writer.write(withExtra);
  const second = writer.write(removeItem(withExtra, "heroes", "SP Quách Gia"));
  assert.equal(writer.busy(), true, "đang ghi: UI phải hoãn nạp lại từ cache");
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual([a.idle, b.idle], [false, true]);
  assert.equal(writer.busy(), false);
  assert.equal(sync.state().records["owned:main~hero:sp-quach-gia"]?.deleted ?? "none", true, "lần ghi 2 xóa món mà lần ghi 1 vừa thêm (previous = lần ghi 1)");
});

test("H2. reconcile: món chỉ có trên máy này sống sót sau lần ghi cloud, cờ của món tương đương không bị ghi đè", async () => {
  const ui = { ...createInitialRosterScanState(), ownedHeroes: [{ name: "Mã Siêu", confidence: "high" }, { name: "曹纯", confidence: "low" }], confirmed: true };
  assert.equal(resolve.item("hero", ui.ownedHeroes[1]), null, "tiền đề: 曹纯 không đối chiếu được");
  const sync = fakeSync(emptyCloudState("u-alice"));
  const writer = createScanWriter({ sync, resolve, boxId: () => "main" });
  const { localOnly } = await writer.write(ui);
  assert.deepEqual(localOnly.heroes, ["曹纯"]);
  const merged = reconcileScanWithCloud(ui, toScanState(sync.state(), "main"), resolve);
  assert.deepEqual(merged.ownedHeroes.map((h) => `${h.name}/${h.confidence}`).sort(), ["Mã Siêu/high", "曹纯/low"]);
});

test("H2. reconcile: món đã xóa trên máy khác biến mất, món cloud mới xuất hiện, lockedTeams/overrides local-only được giữ", () => {
  const cloud = { ...createInitialRosterScanState(), ownedHeroes: [{ name: "Tào Tháo", confidence: "manual" }] };
  const ui = { ...createInitialRosterScanState(), ownedHeroes: [{ name: "Mã Siêu", confidence: "high" }] };
  assert.deepEqual(reconcileScanWithCloud(ui, cloud, resolve).ownedHeroes.map((h) => h.name), ["Tào Tháo"]);
});

test("M6. writer: boxId chụp lúc bắt đầu write(), đổi hộp trong lúc chờ không ghi nhầm hộp", async () => {
  let box = "main";
  const sync = fakeSync(emptyCloudState("u-alice"));
  const writer = createScanWriter({ sync, resolve, boxId: () => box });
  let release;
  sync.gate = new Promise((done) => (release = done));
  const pending = writer.write(inventory());
  box = "box-khac";
  release();
  await pending;
  assert.ok(sync.state().records["owned:main~hero:ma-sieu"], "ghi vào hộp lúc bắt đầu");
  assert.equal(sync.state().records["owned:box-khac~hero:ma-sieu"], undefined);
});
