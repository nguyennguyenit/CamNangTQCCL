import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCatalog, filterCatalog, filterOptions, addPicked, removePicked, pickedItems, pickerTree } from "../js/roster-picker.js";
import { treeToHtml } from "../js/view-tree.js";
import { bookLookupId } from "../js/lookup-ids.js";
import { createRosterIdResolver } from "../js/roster-id-resolve.js";
import { createInitialRosterScanState, serializeRosterScanState } from "../js/roster-scan-state.js";
import { toScanState } from "../js/roster-cloud-store.js";
import { createRosterServer, eventTarget, fakeLocks, fakeTimers, memoryStorage } from "./support/roster-fake-server.mjs";
import { createRosterSync } from "../js/roster-sync.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const heroesDict = load("heroes-dict.json");
const tacticsDict = load("tactics.json");
const books = load("books-dict.json");

const inventory = buildCatalog({ heroesDict, tacticsDict }, "inventory");
const editor = buildCatalog({ heroesDict, tacticsDict, books }, "editor");
const ids = (items) => items.map((item) => item.id);

test("1. tướng Ngụy + 5★ + cost 6: đúng tập con, cost so dạng số", () => {
  const expected = heroesDict.filter((hero) => hero.faction === "Ngụy" && hero.stars === 5 && Number(hero.cost) === 6);
  assert.ok(expected.length > 0);
  const got = filterCatalog(inventory, { kind: "heroes", faction: "Ngụy", stars: 5, cost: 6 }, "inventory");
  assert.deepEqual(ids(got).sort(), expected.map((hero) => hero.id).sort());
  // Giá trị từ ô chọn là chuỗi: cho cùng kết quả.
  assert.deepEqual(ids(filterCatalog(inventory, { kind: "heroes", faction: "Ngụy", stars: "5", cost: "6" }, "inventory")), ids(got));
  // Tên lưu là tên Việt chuẩn của từ điển.
  assert.deepEqual(got.map((item) => item.name).sort(), expected.map((hero) => hero.viet).sort());
});

test("2. chiến pháp policy inventory: không có INNATE/Tự mang; 29 mục source null nằm trong Khác", () => {
  const all = filterCatalog(inventory, { kind: "tactics" }, "inventory");
  const rawById = new Map(tacticsDict.map((row) => [row.id, row]));
  for (const item of all) assert.ok(!["INNATE", "Tự mang"].includes(rawById.get(item.id).source), item.id);
  assert.ok(!ids(all).includes("tactic:vo-song-thuong-tuong"));
  assert.equal(all.length, tacticsDict.filter((row) => row.source !== "INNATE" && row.source !== "Tự mang").length);
  const other = filterCatalog(inventory, { kind: "tactics", source: "other" }, "inventory");
  assert.equal(other.length, 29);
  assert.ok(other.every((item) => rawById.get(item.id).source === null));
  // Chọn INNATE trực tiếp trong bộ lọc cũng không ra gì.
  assert.equal(filterCatalog(inventory, { kind: "tactics", source: "INNATE" }, "inventory").length, 0);
  // quality null vào "Khác".
  const noQuality = filterCatalog(inventory, { kind: "tactics", quality: "other" }, "inventory");
  assert.ok(noQuality.length > 0 && noQuality.every((item) => rawById.get(item.id).quality === null));
  // Lọc loại + nguồn + bậc.
  assert.equal(filterCatalog(inventory, { kind: "tactics", type: "ACTIVE", source: "INHERITANCE", quality: "S" }, "inventory").length, 36);
});

test("2b. policy editor: Vô Song Thượng Tướng (Tự mang) chọn được; INNATE có trong danh mục", () => {
  const found = filterCatalog(editor, { kind: "tactics", query: "vo song thuong tuong" }, "editor");
  assert.ok(ids(found).includes("tactic:vo-song-thuong-tuong"));
  assert.equal(filterCatalog(editor, { kind: "tactics" }, "editor").length, tacticsDict.length);
  assert.equal(filterCatalog(editor, { kind: "tactics", source: "INNATE" }, "editor").length, tacticsDict.filter((row) => row.source === "INNATE" || row.source === "Tự mang").length);
  assert.deepEqual(filterOptions("editor", "tactics").source.map((option) => option.value).includes("INNATE"), true);
  assert.deepEqual(filterOptions("inventory", "tactics").source.map((option) => option.value).includes("INNATE"), false);
});

test("2c. binh thư policy editor: tìm và chọn được, ID book:<slug> khớp books-dict; inventory không có binh thư", () => {
  const all = filterCatalog(editor, { kind: "books" }, "editor");
  assert.equal(all.length, books.length);
  assert.deepEqual(ids(all), books.map(bookLookupId));
  const [first] = books;
  const byViet = filterCatalog(editor, { kind: "books", query: first.viet.toLowerCase() }, "editor");
  assert.ok(ids(byViet).includes(bookLookupId(first)));
  assert.equal(byViet.find((item) => item.id === bookLookupId(first)).name, first.viet);
  const byHan = filterCatalog(editor, { kind: "books", query: first.chinese }, "editor");
  assert.ok(ids(byHan).includes(bookLookupId(first)));
  assert.equal(filterCatalog(inventory, { kind: "books" }, "inventory").length, 0);
  assert.equal(inventory.some((item) => item.type === "books"), false);
});

test("3. chọn tất cả 36 mục đang lọc: thêm đủ 36, món đã có không nhân đôi", () => {
  const filtered = filterCatalog(inventory, { kind: "tactics", type: "ACTIVE", source: "INHERITANCE", quality: "S" }, "inventory");
  assert.equal(filtered.length, 36);
  let state = createInitialRosterScanState();
  state = addPicked(state, filtered.slice(0, 3));
  assert.equal(state.ownedTactics.length, 3);
  state = addPicked(state, filtered);
  assert.equal(state.ownedTactics.length, 36);
  assert.deepEqual(state.ownedTactics.map((item) => item.name).sort(), filtered.map((item) => item.name).sort());
  assert.equal(new Set(state.ownedTactics.map((item) => item.name)).size, 36);
  assert.equal(state.ownedHeroes.length, 0);
  assert.equal(state.confirmed, false);
  assert.equal(pickedItems(state, filtered).length, 36);
});

test("4. bỏ chọn tất cả chỉ gỡ món đang lọc", () => {
  const filtered = filterCatalog(inventory, { kind: "tactics", type: "ACTIVE", source: "INHERITANCE", quality: "S" }, "inventory");
  const others = filterCatalog(inventory, { kind: "tactics", type: "PASSIVE" }, "inventory").slice(0, 4);
  const hero = filterCatalog(inventory, { kind: "heroes" }, "inventory")[0];
  let state = addPicked(createInitialRosterScanState(), [...filtered, ...others, hero]);
  state = removePicked(state, filtered);
  assert.deepEqual(state.ownedTactics.map((item) => item.name).sort(), others.map((item) => item.name).sort());
  assert.deepEqual(state.ownedHeroes.map((item) => item.name), [hero.name]);
  assert.equal(pickedItems(state, filtered).length, 0);
});

test("5. zh: tìm tên Hán khớp; kho lưu tên Việt chuẩn", () => {
  const hero = heroesDict.find((row) => row.id === "hero:sp-lu-mong");
  const found = filterCatalog(inventory, { kind: "heroes", query: "呂蒙" }, "inventory");
  assert.ok(ids(found).includes(hero.id));
  // Chữ giản thể trong aliases cũng khớp.
  assert.ok(ids(filterCatalog(inventory, { kind: "heroes", query: "吕蒙" }, "inventory")).includes(hero.id));
  // Hán-Việt không dấu.
  assert.ok(ids(filterCatalog(inventory, { kind: "heroes", query: "lu mong" }, "inventory")).includes(hero.id));
  const state = addPicked(createInitialRosterScanState(), found.filter((item) => item.id === hero.id));
  assert.equal(state.ownedHeroes[0].name, hero.viet);
  const tactic = tacticsDict.find((row) => row.source === "INHERITANCE");
  const han = filterCatalog(inventory, { kind: "tactics", query: tactic.chinese }, "inventory");
  assert.ok(ids(han).includes(tactic.id));
});

test("lọc tìm không dấu theo tên Việt và đếm đúng tập đang hiện", () => {
  const all = filterCatalog(inventory, { kind: "heroes" }, "inventory");
  assert.equal(all.length, heroesDict.length);
  const some = filterCatalog(inventory, { kind: "heroes", query: "  MÃ  " }, "inventory");
  assert.ok(some.length > 0 && some.length < all.length);
  assert.deepEqual(filterCatalog(inventory, { kind: "heroes", query: "zzzz-khong-co" }, "inventory"), []);
});

test("pickerTree: một hàng có nhãn, trạng thái đã chọn và giới hạn hiển thị", () => {
  const items = filterCatalog(inventory, { kind: "heroes", faction: "Ngụy", stars: 5, cost: 6 }, "inventory");
  const owned = new Set([items[0].id]);
  const tree = pickerTree({ items, selected: owned, label: (item) => item.name, limit: 5, idPrefix: "t" });
  const html = treeToHtml(tree);
  assert.equal((html.match(/<li /g) || []).length, 5);
  assert.match(html, /aria-pressed="true"/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, new RegExp(`data-picker-id="${items[0].id}"`));
});

/* ---------- 6. Khách chọn tất cả rồi đăng nhập + đồng ý gộp: đủ 36 owned trên cloud ---------- */
test("6. khách chọn tất cả 36 rồi đăng nhập, đồng ý gộp: 36 owned trên cloud, ID suy từ tên", async () => {
  const resolve = createRosterIdResolver({ heroesDict, tacticsDict });
  const filtered = filterCatalog(inventory, { kind: "tactics", type: "ACTIVE", source: "INHERITANCE", quality: "S" }, "inventory");
  // Kho khách lưu local dưới dạng nối tiếp (đúng như `saveState`), không có canonicalId.
  const local = serializeRosterScanState(addPicked(createInitialRosterScanState(), filtered));
  assert.equal(local.ownedTactics.length, 36);
  const server = await createRosterServer({ userId: "u-alice" });
  const sync = createRosterSync({
    storage: memoryStorage(),
    locks: fakeLocks(),
    api: server.api,
    loadSession: async () => ({ id: "u-alice", name: "Alice" }),
    signIn: async () => {},
    timers: fakeTimers(),
    doc: eventTarget({ visibilityState: "visible" }),
    win: eventTarget(),
    now: () => Date.UTC(2026, 9, 21, 8, 0, 0),
  });
  await sync.start();
  assert.equal(sync.mergeStatus(), "none");
  const merged = await sync.mergeLocal(local, resolve);
  assert.deepEqual(merged.localOnly.tactics, []);
  await sync.syncNow();
  const owned = server.live("owned");
  assert.equal(owned.length, 36);
  assert.deepEqual(owned.map((row) => row.data.item).sort(), ids(filtered).sort());
  assert.deepEqual(toScanState(sync.state(), "main").ownedTactics.map((item) => item.name).sort(), filtered.map((item) => item.name).sort());
});
