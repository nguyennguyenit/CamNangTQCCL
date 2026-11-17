import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import {
  collectPins,
  compareManifests,
  main,
  normalizeContent,
  normalizePath,
  snapshotDirectory,
} from "../scripts/compare-locale-output.mjs";

const sha = (text) => createHash("sha256").update(text).digest("hex");
const hex = (seed) => sha(`seed:${seed}`);
const roots = [];
after(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

/** Dựng một thư mục output giả có đủ các pin mà bộ chuẩn hoá phải nhận ra. */
async function makeOutput({ gen, date, zhDate, policySeed = "p", extraHtml = "", files = {} }) {
  const root = await mkdtemp(join(tmpdir(), "locale-output-"));
  roots.push(root);
  const localizationInputs = hex(`inputs-${policySeed}`);
  const manifest = JSON.stringify({ generationId: gen, localizationInputsHash: `sha256:${localizationInputs}`, files: {} });
  const manifestSha = sha(manifest);
  const current = JSON.stringify({ generationId: gen, manifestSha256: manifestSha, schemaVersion: 1 });
  const wdGen = hex(`wd-${policySeed}`);
  const websiteDisplay = JSON.stringify({
    generationId: `site-localization:${wdGen}`,
    recommendedPin: { generationId: gen, manifestSha256: manifestSha },
    files: { "recommended/current.json": sha(current), [`recommended/${gen}/manifest.json`]: manifestSha },
  });
  const wdSha = sha(websiteDisplay);
  const pin = `<script type="application/json" id="website-display-publication">{"generationId":"site-localization:${wdGen}","sha256":"${wdSha}"}</script>`;
  const chip = (label, value) => `<p class="footer-chip"><span class="footer-dot" aria-hidden="true"></span>${label} ${value}</p>`;
  const all = {
    "index.html": `<html lang="vi">${pin}<a href="/data/recommended/${gen}/index.json">x</a>${chip("Dữ liệu cập nhật", date)}${extraHtml}</html>`,
    "zh/index.html": `<html lang="zh-Hans">${pin}${chip("数据更新于", zhDate)}</html>`,
    [`data/recommended/${gen}/manifest.json`]: manifest,
    [`data/recommended/${gen}/index.json`]: `{"teams":[]}`,
    "data/recommended/current.json": current,
    "data/website-display.json": websiteDisplay,
    "js/app.js": `// ${gen}`,
    ...files,
  };
  for (const [path, body] of Object.entries(all)) {
    if (body === null) continue;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), body);
  }
  return root;
}

const GEN_A = hex("gen-a");
const GEN_B = hex("gen-b");

test("pins: đọc generation, manifest, website-display và localizationInputsHash từ output", async () => {
  const root = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17" });
  const pins = await collectPins(root);
  const tokens = new Map(pins.map(({ token, value }) => [token, value]));
  assert.equal(tokens.get("<REC_GEN>"), GEN_A);
  assert.match(tokens.get("<REC_MANIFEST>"), /^[0-9a-f]{64}$/);
  assert.match(tokens.get("<REC_CURRENT>"), /^[0-9a-f]{64}$/);
  assert.match(tokens.get("<WD_SHA>"), /^[0-9a-f]{64}$/);
  assert.equal(tokens.get("<WD_GEN>"), hex("wd-p"));
  assert.equal(tokens.get("<LOC_INPUTS>"), hex("inputs-p"));
});

test("pins: output thiếu file pin thì không có pin, không lỗi", async () => {
  const root = await mkdtemp(join(tmpdir(), "locale-output-empty-"));
  roots.push(root);
  assert.deepEqual(await collectPins(root), []);
});

test("chuẩn hoá ngày build ở chip footer cả hai định dạng", () => {
  const vi = normalizeContent("index.html", Buffer.from('<p class="footer-chip"><span class="footer-dot" aria-hidden="true"></span>Dữ liệu cập nhật 17/11/2026</p>'), []);
  const zh = normalizeContent("zh/index.html", Buffer.from('<p class="footer-chip"><span class="footer-dot" aria-hidden="true"></span>数据更新于 2026-11-17</p>'), []);
  assert.match(vi.toString(), /Dữ liệu cập nhật <BUILD_DATE><\/p>$/);
  assert.match(zh.toString(), /数据更新于 <BUILD_DATE><\/p>$/);
  // Ngày nằm ngoài chip footer (nội dung bài, dữ liệu) giữ nguyên.
  const body = normalizeContent("index.html", Buffer.from("<p>Cập nhật 17/11/2026</p>"), []);
  assert.equal(body.toString(), "<p>Cập nhật 17/11/2026</p>");
});

test("chuẩn hoá pin: thay giá trị bằng token, đổi khóa đường dẫn generation", () => {
  const pins = [{ token: "<REC_GEN>", value: GEN_A }];
  assert.equal(normalizeContent("index.html", Buffer.from(`/data/recommended/${GEN_A}/x.json`), pins).toString(), "/data/recommended/<REC_GEN>/x.json");
  assert.equal(normalizePath(`data/recommended/${GEN_A}/x.json`, pins), "data/recommended/<REC_GEN>/x.json");
  assert.equal(normalizePath("data/teams.json", pins), "data/teams.json");
});

test("chuẩn hoá giữ nguyên byte file nhị phân không chứa pin", () => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x80]);
  assert.deepEqual(normalizeContent("og-image.png", bytes, [{ token: "<REC_GEN>", value: GEN_A }]), bytes);
});

test("snapshot bỏ js/** và hai build khác generation, ngày, mã nguồn js so ra 0 khác", async () => {
  const base = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17", policySeed: "a" });
  const head = await makeOutput({ gen: GEN_B, date: "18/11/2026", zhDate: "2026-11-18", policySeed: "b" });
  const baseManifest = await snapshotDirectory(base);
  const headManifest = await snapshotDirectory(head);
  assert.ok(!Object.keys(baseManifest.files).some((path) => path.startsWith("js/")));
  assert.ok(Object.hasOwn(baseManifest.files, "data/recommended/<REC_GEN>/index.json"));
  assert.equal(baseManifest.meta.generationId, GEN_A);
  const result = compareManifests(baseManifest, headManifest);
  assert.deepEqual({ added: result.added, removed: result.removed, changed: result.changed }, { added: [], removed: [], changed: [] });
  assert.equal(result.ok, true);
});

test("compare báo file đổi, thêm, mất và exit lỗi", async () => {
  const base = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17", files: { "old.html": "x" } });
  const head = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17", extraHtml: "<p>mới</p>", files: { "new.html": "y" } });
  const result = compareManifests(await snapshotDirectory(base), await snapshotDirectory(head));
  assert.deepEqual(result.changed, ["index.html"]);
  assert.deepEqual(result.added, ["new.html"]);
  assert.deepEqual(result.removed, ["old.html"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.violations.sort(), ["index.html", "new.html", "old.html"]);
});

test("--allow-file cho phép đúng file liệt kê", async () => {
  const base = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17" });
  const head = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17", files: { "robots.txt": "User-agent: *" } });
  const result = compareManifests(await snapshotDirectory(base), await snapshotDirectory(head), { allowFiles: ["robots.txt"] });
  assert.deepEqual(result.added, ["robots.txt"]);
  assert.equal(result.ok, true);
});

test("--allow-locale ja: bỏ hreflang/og/sitemap/nút chuyển ngôn ngữ của ja và file dưới ja/", async () => {
  const sitemap = (extra) => `<urlset>\n  <url>\n    <loc>https://tqccl.com/</loc>\n    <xhtml:link rel="alternate" hreflang="vi" href="https://tqccl.com/"/>\n${extra.link}  </url>\n${extra.url}</urlset>`;
  const switcher = (links) => `<nav data-lang-switcher class="x">${links}</nav>`;
  const viLink = '<a class="lang-switch" href="/zh/" hreflang="zh-Hans" lang="zh-Hans" aria-label="Xem bản tiếng Trung (中文)" data-lang-switch>中文</a>';
  const jaLink = '<a class="lang-switch" href="/ja/" hreflang="ja" lang="ja" aria-label="Xem bản tiếng Nhật" data-lang-switch>日本語</a>';
  const base = await makeOutput({
    gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17",
    extraHtml: `<meta property="og:locale:alternate" content="zh_CN">${switcher(viLink)}`,
    files: { "sitemap.xml": sitemap({ link: "", url: "" }) },
  });
  const head = await makeOutput({
    gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17",
    extraHtml: `<meta property="og:locale:alternate" content="zh_CN"><meta property="og:locale:alternate" content="ja_JP"><link rel="alternate" hreflang="ja" href="https://tqccl.com/ja/">${switcher(viLink + jaLink)}`,
    files: {
      "sitemap.xml": sitemap({
        link: '    <xhtml:link rel="alternate" hreflang="ja" href="https://tqccl.com/ja/"/>\n',
        url: '  <url>\n    <loc>https://tqccl.com/ja/</loc>\n  </url>\n',
      }),
      "ja/index.html": "<html lang=\"ja\"></html>",
      "data/lookup-ja.json": "{}",
    },
  });
  const baseManifest = await snapshotDirectory(base);
  const strict = compareManifests(baseManifest, await snapshotDirectory(head));
  assert.equal(strict.ok, false);
  const headManifest = await snapshotDirectory(head, { allowLocales: ["ja"] });
  assert.ok(!Object.keys(headManifest.files).some((path) => path.startsWith("ja/")));
  assert.deepEqual(headManifest.meta.allowLocales, ["ja"]);
  const result = compareManifests(baseManifest, headManifest, { allowLocales: ["ja"] });
  assert.deepEqual(result.changed, []);
  assert.deepEqual(result.added, ["data/lookup-ja.json"]);
  assert.equal(result.ok, true);
  // Head chụp có --allow-locale mà compare không khai thì báo lỗi dùng sai, không âm thầm cho qua.
  assert.throws(() => compareManifests(baseManifest, headManifest), /allow-locale/);
});

test("--allow-locale không cho thêm file ngoài ja/ và dữ liệu ja", async () => {
  const base = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17" });
  const head = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17", files: { "data/extra.json": "{}" } });
  const result = compareManifests(await snapshotDirectory(base), await snapshotDirectory(head, { allowLocales: ["ja"] }), { allowLocales: ["ja"] });
  assert.deepEqual(result.violations, ["data/extra.json"]);
  assert.equal(result.ok, false);
});

test("CLI: snapshot ghi manifest, compare trả 0 khi trùng và 1 khi khác, 2 khi sai tham số", async () => {
  const base = await makeOutput({ gen: GEN_A, date: "17/11/2026", zhDate: "2026-11-17" });
  const head = await makeOutput({ gen: GEN_B, date: "18/11/2026", zhDate: "2026-11-18", extraHtml: "<p>khác</p>" });
  const out = await mkdtemp(join(tmpdir(), "locale-manifest-"));
  roots.push(out);
  const log = console.log;
  console.log = () => {};
  try {
    assert.equal(await main(["snapshot", "--root", base, "--out", join(out, "base.json"), "--label", "base"]), 0);
    assert.equal(await main(["snapshot", "--root", base, "--out", join(out, "same.json")]), 0);
    assert.equal(await main(["snapshot", "--root", head, "--out", join(out, "head.json")]), 0);
    assert.equal(await main(["compare", "--base", join(out, "base.json"), "--head", join(out, "same.json")]), 0);
    assert.equal(await main(["compare", "--base", join(out, "base.json"), "--head", join(out, "head.json")]), 1);
  } finally {
    console.log = log;
  }
  await assert.rejects(main(["compare", "--bogus", "x"]), /Tham số lạ/);
  await assert.rejects(main(["nope"]), /snapshot hoặc compare/);
  await assert.rejects(main(["snapshot", "--allow-locale", "JA"]), /mã ngôn ngữ/);
});
