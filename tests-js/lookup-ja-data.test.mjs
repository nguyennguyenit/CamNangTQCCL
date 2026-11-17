// Lớp tiếng Nhật của Tra cứu: hợp đồng `data/lookup-ja.json` (docs/ja-lookup-data.md), nạp qua pin byte ở trình duyệt, kiểm
// cùng thế hệ/nguồn lúc build, và bộ tra tên Nhật của trang ja. Các hàm ở đây không phụ thuộc locale đang bật.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadLookupJa, validateLookupJaDocument, verifyKanjiVariants, verifyLookupJa } from "../js/lookup-data.js";
import { createJaNameResolver, readLookupJaPin } from "../js/website-display.js";
import { parseKanjiVariants } from "../js/shinjitai.js";
import { lookupJaPublicationSnapshot } from "../src/lib/root-static-artifacts.ts";

const bytesOf = (path) => new Uint8Array(readFileSync(new URL(`../${path}`, import.meta.url)));
const json = (path) => JSON.parse(Buffer.from(bytesOf(path)).toString("utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jaBytes = bytesOf("data/lookup-ja.json");
const manifest = json("data/lookup-manifest.json");
const pin = `sha256:${sha(jaBytes)}`;

test("tài liệu thật đúng hợp đồng và cùng thế hệ với lookup manifest", () => {
  const document = validateLookupJaDocument(json("data/lookup-ja.json"), { lookupGenerationId: manifest.generationId });
  assert.ok(Object.keys(document.entries).length > 1000);
});

test("nameOriginalLang (lang của tên gốc, tính lúc build) chỉ nhận zh-Hans/zh-Hant/zh; tài liệu cũ chưa có trường vẫn hợp lệ", () => {
  const base = json("data/lookup-ja.json");
  assert.ok(Object.values(base.entries).every((entry) => ["zh-Hans", "zh-Hant", "zh"].includes(entry.nameOriginalLang)));
  const legacy = structuredClone(base);
  for (const entry of Object.values(legacy.entries)) delete entry.nameOriginalLang;
  assert.doesNotThrow(() => validateLookupJaDocument(legacy, { lookupGenerationId: manifest.generationId }));
});

test("tài liệu lệch thế hệ, sai trạng thái tên, thừa khóa hay chữ rỗng bị từ chối", () => {
  const base = json("data/lookup-ja.json");
  const id = Object.keys(base.entries)[0];
  const expected = { lookupGenerationId: manifest.generationId };
  assert.throws(() => validateLookupJaDocument(base, { lookupGenerationId: "lookup:" + "0".repeat(64) }), /thế hệ/);
  const variants = [
    (doc) => { doc.entries[id].nameStatus = "guessed"; },
    (doc) => { doc.entries[id].nameOriginalLang = "zh-TW"; },
    (doc) => { doc.entries[id].sourceUrl = "https://example.invalid"; },
    (doc) => { doc.entries[id].texts = { effect: " " }; },
    (doc) => { doc.extra = true; },
    (doc) => { doc.notice.machineTranslated = false; },
    (doc) => { doc.prefixedTactics.push({ baseId: "hero:x", name: "転・x", prefix: "転" }); },
    (doc) => { delete doc.sources["data/tactics.json"]; },
  ];
  for (const mutate of variants) {
    const doc = structuredClone(base);
    mutate(doc);
    assert.throws(() => validateLookupJaDocument(doc, expected), Error);
  }
});

test("trình duyệt chỉ nhận đúng bytes của pin; bảng tự dạng phải khớp hash khai trong lookup-ja", async () => {
  const document = await verifyLookupJa(jaBytes, pin, { lookupGenerationId: manifest.generationId });
  await assert.rejects(verifyLookupJa(jaBytes, `sha256:${"0".repeat(64)}`, { lookupGenerationId: manifest.generationId }), /không khớp pin/);
  await assert.rejects(verifyLookupJa(jaBytes, "abc", { lookupGenerationId: manifest.generationId }), /Pin/);
  const variants = await verifyKanjiVariants(bytesOf("data/ja-kanji-variants.json"), document);
  assert.ok(parseKanjiVariants(variants));
  await assert.rejects(verifyKanjiVariants(new TextEncoder().encode("{}"), document), /không khớp/);
});

test("loadLookupJa đọc qua bộ nạp byte dùng chung: lookup-ja, lookup-manifest, và bảng tự dạng khi được hỏi", async () => {
  const requested = [];
  const files = {
    "data/lookup-ja.json": jaBytes,
    "data/lookup-manifest.json": bytesOf("data/lookup-manifest.json"),
    "data/ja-kanji-variants.json": bytesOf("data/ja-kanji-variants.json"),
  };
  const loadBytes = async (name) => { requested.push(name); return files[name]; };
  const plain = await loadLookupJa(loadBytes, pin);
  assert.equal(plain.variants, null);
  assert.deepEqual(requested.sort(), ["data/lookup-ja.json", "data/lookup-manifest.json"]);
  const full = await loadLookupJa(loadBytes, pin, { withVariants: true });
  assert.ok(full.variants.map);
  await assert.rejects(loadLookupJa(loadBytes, null), /Pin/);
});

test("pin đọc từ trang: thẻ JSON `#lookup-ja-pin`; thiếu hoặc hỏng thì null", () => {
  const doc = (text) => ({ querySelector: (selector) => (selector === "#lookup-ja-pin" && text !== null ? { textContent: text } : null) });
  assert.equal(readLookupJaPin(doc(JSON.stringify(pin))), pin);
  assert.equal(readLookupJaPin(doc(null)), null);
  assert.equal(readLookupJaPin(doc("{")), null);
  assert.equal(readLookupJaPin(doc("12")), null);
});

test("bộ tra tên Nhật: tên Việt/Hán-Việt → tên Nhật theo ID, chưa có tên Nhật thì đổi tự dạng, ô gộp A/B", () => {
  const dicts = [
    [{ id: "hero:a", viet: "Nhạc Tiến", hanViet: "Nhạc Tiến", chinese: "樂進" }, { id: "hero:b", viet: "Quốc Tướng", chinese: "國將" }],
    [{ id: "tactic:c", viet: "Không Tên", chinese: "" }],
  ];
  const resolve = createJaNameResolver(dicts, { entries: { "hero:a": { name: "楽進" } } }, parseKanjiVariants({ map: { 國: "国", 將: "将" } }));
  assert.equal(resolve("Nhạc Tiến"), "楽進");
  assert.equal(resolve("nhạc tiến (S)"), "楽進");
  assert.equal(resolve("Quốc Tướng"), "国将");
  assert.equal(resolve("Nhạc Tiến/Quốc Tướng"), "楽進/国将");
  assert.equal(resolve("Nhạc Tiến/Ai Đó"), null);
  assert.equal(resolve("Không Tên"), null);
  assert.equal(resolve.fromRaw("國士將風"), "国士将風");
});

test("build kiểm lớp ja với publication hiện tại và trả pin của đúng bytes", async () => {
  const snapshot = await lookupJaPublicationSnapshot();
  assert.equal(snapshot.pin, pin);
  assert.equal(snapshot.document.lookupGenerationId, manifest.generationId);
  assert.ok(Object.isFrozen(snapshot.variants));
});
