import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PUBLIC_ARTIFACTS } from "../src/lib/public-artifact-manifest.mjs";

const headersPath = new URL("../public/_headers", import.meta.url);
const cachePolicy = "public, max-age=0, must-revalidate";
const expectedRules = [
  "/",
  "/index.html",
  "/zh/*",
  "/doi-chuan/*",
  "/doi-khac/*",
  "/khai-hoang/*",
  "/cung-ton/*",
  "/tra-cuu/*",
  "/theo-doi-chieu-mo/*",
  "/soi-doi-tu-anh/*",
  "/goi-y-doi-tu-kho/*",
  "/chien-bao/*",
  "/doi-cong-dong/*",
  "/doi-cua-toi/*",
  "/quan-tri/*",
  "/chinh-sach-bao-mat/*",
  "/dieu-khoan-su-dung/*",
  "/quy-tac-cong-dong/*",
  "/mien-tru-trach-nhiem/*",
  "/bai-viet/*",
  "/rss.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/llms/*",
  "/my-teams-source-index.json",
  "/404.html",
  "/js/*",
  "/css/*",
  "/fonts/*",
  "/heroes/*",
  "/data/*",
  "/favicon.png",
  "/og-image.png",
  "/logo.png",
  "/logo-cam-nang.svg",
  "/donate-qr.png",
];

function parseHeaders(source) {
  const rules = new Map();
  let activePath;
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      activePath = line;
      assert.ok(activePath.startsWith("/"), `line ${index + 1}: path must start with /`);
      assert.ok(!rules.has(activePath), `line ${index + 1}: duplicate path`);
      rules.set(activePath, new Map());
      continue;
    }
    assert.ok(activePath, `line ${index + 1}: header has no path`);
    const match = line.trim().match(/^([^:]+):\s*(.+)$/);
    assert.ok(match, `line ${index + 1}: malformed header`);
    const name = match[1].toLowerCase();
    assert.ok(!rules.get(activePath).has(name), `line ${index + 1}: duplicate header`);
    rules.get(activePath).set(name, match[2]);
  }
  return rules;
}

function ruleMatches(rule, path) {
  if (!rule.endsWith("*")) return rule === path;
  return path.startsWith(rule.slice(0, -1));
}

function policyFor(rules, path) {
  const matched = [...rules]
    .filter(([rule]) => ruleMatches(rule, path))
    .map(([, headers]) => headers.get("cache-control"))
    .filter(Boolean);
  return matched.at(-1);
}

function visibleVersion({ policy, cachedVersion, deployedVersion, canRevalidate }) {
  if (!cachedVersion) return deployedVersion;
  const directives = new Set(policy.split(",").map((part) => part.trim()));
  if (directives.has("max-age=0") && directives.has("must-revalidate")) {
    return canRevalidate ? deployedVersion : null;
  }
  return cachedVersion;
}

test("_headers has exact mutable-asset revalidation rules", async () => {
  const rules = parseHeaders(await readFile(headersPath, "utf8"));
  assert.deepEqual([...rules.keys()], expectedRules);
  for (const headers of rules.values()) {
    assert.deepEqual(Object.fromEntries(headers), { "cache-control": cachePolicy });
  }
});

test("_headers covers every published shell and mutable raw asset", async () => {
  const rules = parseHeaders(await readFile(headersPath, "utf8"));
  const publicPaths = [
    "/",
    "/index.html",
    "/favicon.png",
    "/og-image.png",
    "/logo.png",
    "/logo-cam-nang.svg",
    "/donate-qr.png",
    ...PUBLIC_ARTIFACTS.map((artifact) => `/${artifact.kind}/${artifact.sourceBasename}`),
    "/fonts/be-vietnam-pro-400-latin.woff2",
    "/fonts/noto-serif-display-700-vietnamese.woff2",
    "/fonts/OFL.txt",
    "/heroes/tao-ngang.webp",
    "/data/recommended/current.json",
    `/data/recommended/${"1".repeat(64)}/manifest.json`,
    `/data/recommended/${"1".repeat(64)}/details-s-${"2".repeat(64)}.json`,
    "/404.html",
    "/doi-chuan/pk-s24-tu-ma-phi-hung/",
    "/doi-chuan/pk-s24-tu-ma-phi-hung/index.html",
    "/doi-khac/hoang-ma-thuong/",
    "/doi-khac/hoang-ma-thuong/index.html",
    "/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/",
    "/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/index.html",
    // Trang cộng đồng (noindex) vẫn là HTML tĩnh phải revalidate.
    ...["chien-bao", "doi-cong-dong", "doi-cua-toi", "quan-tri"].flatMap((page) => [`/${page}/`, `/${page}/index.html`]),
    // Trang đội cộng đồng dựng lúc build: cùng luật `/doi-cong-dong/*` và `/zh/*`.
    "/doi-cong-dong/3f2c-team/",
    "/doi-cong-dong/3f2c-team/index.html",
    "/zh/doi-cong-dong/3f2c-team/",
    // Trang chính sách (bảo mật là URL khai với màn hình đồng ý OAuth của Google).
    ...["chinh-sach-bao-mat", "dieu-khoan-su-dung", "quy-tac-cong-dong", "mien-tru-trach-nhiem"]
      .flatMap((page) => [`/${page}/`, `/${page}/index.html`]),
    // Mọi trang mục mới đều phải revalidate như nhau.
    ...["doi-chuan", "doi-khac", "cung-ton", "khai-hoang", "tra-cuu", "theo-doi-chieu-mo", "soi-doi-tu-anh", "goi-y-doi-tu-kho"]
      .flatMap((section) => [`/${section}/`, `/${section}/index.html`]),
    // Blog: danh sách, bài (vi/zh), feed và llms.txt đổi mỗi lần xuất bản.
    "/bai-viet/",
    "/bai-viet/cach-danh-dat/index.html",
    "/zh/bai-viet/",
    "/zh/bai-viet/kai-huang/",
    "/rss.xml",
    "/zh/rss.xml",
    "/llms.txt",
    "/llms-full.txt",
    "/llms/doi-chuan/pk-s24.txt",
    "/llms/tra-cuu/tuong.txt",
    // Chỉ mục hash nguồn của Đội của tôi đổi cùng mỗi lần phát hành dữ liệu đội.
    "/my-teams-source-index.json",
    // Bản tiếng Trung: Landing, trang mục, ba họ trang chi tiết và trang cộng đồng dưới cùng một quy tắc.
    "/zh/",
    "/zh/index.html",
    ...["doi-chuan", "doi-khac", "cung-ton", "khai-hoang", "tra-cuu", "theo-doi-chieu-mo", "soi-doi-tu-anh", "goi-y-doi-tu-kho", "chien-bao", "doi-cong-dong", "doi-cua-toi", "quan-tri", "chinh-sach-bao-mat", "dieu-khoan-su-dung", "quy-tac-cong-dong", "mien-tru-trach-nhiem"]
      .flatMap((section) => [`/zh/${section}/`, `/zh/${section}/index.html`]),
    "/zh/doi-chuan/pk-s24-tu-ma-phi-hung/index.html",
    "/zh/doi-khac/hoang-ma-thuong/",
    "/zh/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/index.html",
  ];
  for (const path of publicPaths) {
    assert.equal(policyFor(rules, path), cachePolicy, `${path} must revalidate`);
  }
  for (const path of ["/pipeline/private.py", "/worker/src/index.ts", "/tests/example.py", "/plans/plan.md"]) {
    assert.equal(policyFor(rules, path), undefined, `${path} must not match a public rule`);
  }
  // The retired route family is no longer a published detail page, so no rule may claim it.
  for (const path of ["/teams/recommended/team-epoddo/", "/teams/legacy/team-intro-4/", "/teams/"]) {
    assert.equal(policyFor(rules, path), undefined, `${path} must not match a public rule`);
  }
});

test("cache policy models fresh clients and whole-artifact rollback", async () => {
  const rules = parseHeaders(await readFile(headersPath, "utf8"));
  const policy = policyFor(rules, "/js/app.js");
  assert.equal(visibleVersion({
    policy,
    cachedVersion: null,
    deployedVersion: "current",
    canRevalidate: true,
  }), "current");
  assert.equal(visibleVersion({
    policy,
    cachedVersion: "failed",
    deployedVersion: "known-good",
    canRevalidate: true,
  }), "known-good");
  assert.equal(visibleVersion({
    policy,
    cachedVersion: "failed",
    deployedVersion: "known-good",
    canRevalidate: false,
  }), null);
});
