import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { buildCatalog, filterCatalog } from "../js/roster-picker.js";
import { bookRowId, createBookNameIndex } from "../js/lookup-ids.js";

const root = new URL("../", import.meta.url);
const books = JSON.parse(readFileSync(new URL("data/books-dict.json", root), "utf8"));

test("T1. đổi tên Việt binh thư: id lưu cũ vẫn hiện đúng tên mới trong bảng chọn, và tên cũ vẫn dẫn về cùng id", () => {
  const [first, ...rest] = books;
  const savedId = bookRowId(first);
  assert.ok(savedId, "fixture binh thư phải có id đóng băng");
  const renamed = [{ ...first, viet: "Tên Mới Hoàn Toàn", aliases: [...(first.aliases || []), first.viet] }, ...rest];
  const catalog = buildCatalog({ books: renamed }, "editor");
  const found = filterCatalog(catalog, { kind: "books", query: "tên mới hoàn toàn" }, "editor").find((item) => item.id === savedId);
  assert.equal(found?.name, "Tên Mới Hoàn Toàn");
  assert.equal(createBookNameIndex(renamed)(first.viet), savedId);
});

test("T2. không file nào trong js/ hay tests-js/ còn dùng bookLookupId (trừ khẳng định đã xóa)", () => {
  const offenders = [];
  for (const dir of ["js", "tests-js"]) {
    for (const name of readdirSync(new URL(`${dir}/`, root))) {
      if (!name.endsWith(".js") && !name.endsWith(".mjs")) continue;
      if (name === "roster-client-book-ids.test.mjs" || name === "lookup-ids.test.mjs") continue;
      if (readFileSync(new URL(`${dir}/${name}`, root), "utf8").includes("bookLookupId")) offenders.push(`${dir}/${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});
