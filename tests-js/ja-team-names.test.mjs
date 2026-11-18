// Trang đội bản ja: tên tướng/chiến pháp đi qua bộ tra tên Nhật (theo mã, chữ chưa đối chiếu đổi tự dạng, tiền tố bản cải
// tạo theo `prefixedTactics`), bộ tra đăng ký riêng từng locale khi build dựng nhiều bản trong một tiến trình, và ghi chú
// chữ Trung của nguồn bị ẩn thay bằng dòng báo thiếu.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { treeToHtml } from "../js/view-tree.js";
import { parseKanjiVariants } from "../js/shinjitai.js";
import { createJaNameResolver, createRawNameResolver, localRecordName } from "../js/website-display.js";
import { setZhNameResolver, sourceName, sourcePrefixedTactic } from "../js/recommended-reference-state.js";
import { recommendedTeamDetailContent } from "../js/recommended-reference-render.js";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const textOf = (trees) => [].concat(trees).map(treeToHtml).join("").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const VARIANTS = parseKanjiVariants({ map: { 樂: "楽", 轉: "転", 國: "国", 將: "将", 鬥: "闘" } });
const DICTS = [
  [{ id: "hero:a", viet: "Nhạc Tiến", chinese: "樂進" }, { id: "hero:b", viet: "Quốc Tướng", chinese: "國將" }],
  [
    { id: "tactic:c", viet: "Dụng Võ Thông Thần", chinese: "用武通神" },
    { id: "tactic:d", viet: "Đấu Chí", chinese: "鬥志" },
  ],
];
const JA = {
  entries: { "hero:a": { name: "楽進" }, "tactic:c": { name: "用武通神" } },
  prefixedTactics: [{ baseId: "tactic:c", name: "転・神算鬼謀", prefix: "転" }],
};

test("bộ tra tên Nhật: chữ Hán nguồn về tên Nhật theo mã, tiền tố bản cải tạo theo prefixedTactics", () => {
  const resolve = createJaNameResolver(DICTS, JA, VARIANTS);
  // Chữ Hán nguồn (nguyên dạng hoặc đã đổi tự dạng) khớp `chinese` của từ điển → tên Nhật theo mã.
  assert.equal(resolve.fromRaw("樂進"), "楽進");
  assert.equal(resolve.fromRaw("國將"), "国将");
  // Chưa đối chiếu được: đổi tự dạng từng ký tự.
  assert.equal(resolve.fromRaw("樂國無雙"), "楽国無雙");
  // Bản cải tạo: tên kịch bản khi có, không thì `<tiền tố Nhật>・<tên Nhật>`; nhận cả dạng Việt và chữ Hán nguồn.
  assert.equal(resolve.fromRaw("轉·用武通神"), "転・神算鬼謀");
  assert.equal(resolve("Chuyển · Dụng Võ Thông Thần"), "転・神算鬼謀");
  assert.equal(resolve.prefixed("Thác", "Đấu Chí"), "拓・闘志");
  assert.equal(resolve.prefixed("精", "鬥志"), "精・闘志");
  assert.equal(resolve.prefixed("Tinh", "Không Có"), null);
  assert.equal(resolve.nameOf("hero:b"), "国将");
  assert.equal(resolve.nameOf("hero:zzz"), null);
});

test("bộ tra tên Nhật: tên Việt hiện hành thắng tên Hán-Việt trùng chữ của mục khác", () => {
  // "Lập Lờ Đánh Tráo" là `viet` của 移花接木 nhưng là `hanViet` cũ của 暗渡陳倉 (đứng trước trong danh mục).
  const resolve = createJaNameResolver(
    [
      [{ id: "tactic:x", chinese: "暗渡陳倉", viet: "Ám Độ Trần Thương", hanViet: "Lập Lờ Đánh Tráo" }],
      [{ id: "tactic:y", chinese: "移花接木", viet: "Lập Lờ Đánh Tráo", hanViet: "Di Hoa Tiếp Mộc" }],
    ],
    { entries: {} },
    VARIANTS,
  );
  assert.equal(resolve("Lập Lờ Đánh Tráo"), "移花接木");
  assert.equal(resolve("Ám Độ Trần Thương"), "暗渡陳倉");
  assert.equal(resolve("Di Hoa Tiếp Mộc"), "移花接木");
});

test("bộ tra theo locale: build đăng ký zh và ja riêng, sourceName chọn đúng bộ của bản đang dựng", () => {
  setZhNameResolver(createRawNameResolver(...DICTS), "zh");
  setZhNameResolver(createJaNameResolver(DICTS, JA, VARIANTS), "ja");
  try {
    assert.equal(sourceName("Nhạc Tiến", "vi"), "Nhạc Tiến");
    assert.equal(sourceName("Nhạc Tiến", "zh"), "樂進");
    assert.equal(sourceName("Nhạc Tiến", "ja"), "楽進");
    // Chữ Hán nguồn: bản zh giữ nguyên văn, bản ja ra tên Nhật.
    assert.equal(sourceName("樂進 · 國將", "zh"), "樂進 · 國將");
    assert.equal(sourceName("樂進", "ja"), "楽進");
    // Bản zh không có bộ dựng bản cải tạo: caller ghép tiền tố như cũ.
    assert.equal(sourcePrefixedTactic("Chuyển", "Dụng Võ Thông Thần", "zh"), undefined);
    assert.equal(sourcePrefixedTactic("Chuyển", "Dụng Võ Thông Thần", "ja"), "転・神算鬼謀");
    assert.equal(sourcePrefixedTactic("Chuyển", "Không Có", "ja"), "");
  } finally {
    setZhNameResolver(null);
  }
  assert.equal(sourceName("Nhạc Tiến", "ja"), "Nhạc Tiến", "gỡ hết bộ tra khi không truyền locale");
});

test("tên mục từ điển theo locale: vi tên Việt, zh chữ Hán, ja tên Nhật theo mã", () => {
  const ja = createJaNameResolver(DICTS, JA, VARIANTS);
  const record = DICTS[0][0];
  assert.equal(localRecordName(record, null, "vi"), "Nhạc Tiến");
  assert.equal(localRecordName(record, createRawNameResolver(...DICTS), "zh"), "樂進");
  assert.equal(localRecordName(record, null, "zh"), "樂進");
  assert.equal(localRecordName(record, ja, "ja"), "楽進");
  assert.equal(localRecordName({ id: "hero:x", viet: "Ai Đó" }, ja, "ja"), "Ai Đó");
});

test("trang chi tiết Đội chuẩn bản ja: tên Nhật, ghi chú chữ Trung ẩn và có dòng báo thiếu", () => {
  const generation = json("src/data/recommended-reference/current.json").generationId;
  const reference = `src/data/recommended-reference/${generation}`;
  const labels = json(`${reference}/seasons.json`).displayLabels;
  const dicts = ["heroes-dict", "tactics", "books-dict"].map((name) => json(`data/${name}.json`));
  const record = readdirSync(new URL(`../${reference}`, import.meta.url))
    .filter((name) => name.startsWith("details-s-"))
    .flatMap((name) => json(`${reference}/${name}`).records)
    .find((row) => row.heroes.length === 3 && row.displayNotes?.blocks?.some((block) => block.owner === "team" && /[㐀-鿿]/u.test(block.textRaw ?? "")));
  assert.ok(record, "generation phải có đội có ghi chú đội chữ Trung");
  const note = record.displayNotes.blocks.find((block) => block.owner === "team").textRaw.trim();
  const ja = createJaNameResolver(dicts, json("data/lookup-ja.json"), parseKanjiVariants(json("data/ja-kanji-variants.json")));
  setZhNameResolver(createRawNameResolver(...dicts), "zh");
  setZhNameResolver(ja, "ja");
  try {
    const zhText = textOf(recommendedTeamDetailContent(record, { labels, locale: "zh" }));
    const jaText = textOf(recommendedTeamDetailContent(record, { labels, locale: "ja" }));
    assert.ok(zhText.includes(note.slice(0, 12)), "bản zh vẫn hiện ghi chú nguồn");
    assert.ok(!jaText.includes(note.slice(0, 12)), "bản ja không hiện ghi chú chữ Trung");
    assert.match(jaText, /日本語訳がない/u);
    const mainName = ja.fromRaw(record.heroes[0].nameRaw.trim());
    // Tiền tố biến thể (SP/CO/40Y) là chip riêng nên so sau khi bỏ khoảng trắng.
    assert.ok(jaText.replace(/\s/gu, "").includes(mainName.replace(/\s/gu, "")), `bản ja hiện tên Nhật của chủ tướng (${mainName})`);
  } finally {
    setZhNameResolver(null);
  }
});
