#!/usr/bin/env node
// So output build theo từng file để chứng minh refactor locale không đổi một byte nào của bản vi/zh.
//
//   node scripts/compare-locale-output.mjs snapshot [--root dist] [--out .cache/locale-baseline/head.json]
//                                                   [--allow-locale ja]… [--label <ghi chú>]
//   node scripts/compare-locale-output.mjs compare  [--base .cache/locale-baseline/base.json]
//                                                   [--head .cache/locale-baseline/head.json]
//                                                   [--allow-locale ja]… [--allow-file <đường dẫn>]…
//
// `snapshot` băm SHA-256 từng file output (trừ `js/**`: mã nguồn copy thô, đổi theo refactor, hành vi do test giữ)
// sau khi chuẩn hoá các giá trị đổi theo lần build chứ không theo nội dung:
//   1. ngày build ở chip footer (`dd/mm/yyyy` bản vi, `yyyy-mm-dd` bản zh) → `<BUILD_DATE>`;
//   2. pin generation: generation Recommended, hash manifest/current.json của nó, `localizationInputsHash`,
//      hash và generation của `data/website-display.json` → token cố định, kể cả trong đường dẫn file. Sửa file bị
//      policy localization ghim buộc publish lại nên sinh generation mới dù nội dung đội không đổi;
//   3. chỉ khi `--allow-locale <mã>`: bỏ hreflang/`og:locale:alternate`/khối sitemap của locale đó, gộp cụm nút
//      chuyển ngôn ngữ thành `<LANG_SWITCH>` và bỏ qua file dưới `<mã>/`.
// `compare` in danh sách file thêm/mất/đổi và thoát mã 1 nếu có thay đổi ngoài allowlist.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_ROOT = "dist";
export const DEFAULT_BASE = ".cache/locale-baseline/base.json";
export const DEFAULT_HEAD = ".cache/locale-baseline/head.json";
const MANIFEST_SCHEMA = 1;
const EXCLUDED_PREFIXES = Object.freeze(["js/"]);
const HEX64 = /^[0-9a-f]{64}$/;
const LOCALE_CODE = /^[a-z]{2,3}$/;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function readOptional(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label}: JSON không hợp lệ (${error.message})`);
  }
}

/**
 * Pin của một output: cặp `{token, value}` với `value` là chuỗi hex 64 ký tự xuất hiện trong output và đổi theo
 * lần publish localization. Thiếu file pin (fixture, output rỗng) thì không có pin tương ứng.
 */
export async function collectPins(root) {
  const pins = [];
  const add = (token, value) => {
    if (typeof value === "string" && HEX64.test(value)) pins.push({ token, value });
  };
  const currentBytes = await readOptional(join(root, "data/recommended/current.json"));
  if (currentBytes) {
    const current = parseJson(currentBytes, "data/recommended/current.json");
    add("<REC_GEN>", current.generationId);
    add("<REC_MANIFEST>", current.manifestSha256);
    add("<REC_CURRENT>", sha256(currentBytes));
    if (HEX64.test(String(current.generationId))) {
      const manifestBytes = await readOptional(join(root, "data/recommended", current.generationId, "manifest.json"));
      if (manifestBytes) {
        const manifest = parseJson(manifestBytes, "manifest.json của generation Recommended");
        add("<LOC_INPUTS>", String(manifest.localizationInputsHash ?? "").replace(/^sha256:/, ""));
      }
    }
  }
  const websiteBytes = await readOptional(join(root, "data/website-display.json"));
  if (websiteBytes) {
    const website = parseJson(websiteBytes, "data/website-display.json");
    add("<WD_SHA>", sha256(websiteBytes));
    add("<WD_GEN>", String(website.generationId ?? "").replace(/^site-localization:/, ""));
  }
  return pins;
}

function replacePins(text, pins) {
  let output = text;
  for (const { token, value } of pins) output = output.split(value).join(token);
  return output;
}

/** Đường dẫn file sau chuẩn hoá pin (`data/recommended/<gen>/…` → `data/recommended/<REC_GEN>/…`). */
export function normalizePath(relPath, pins) {
  return replacePins(relPath, pins);
}

const BUILD_DATE = /(<p class="footer-chip">(?:(?!<\/p>)[\s\S])*?<\/span>[^<]*? )(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})(<\/p>)/g;

function stripLocale(text, locale) {
  const code = escapeRegExp(locale);
  return text
    .replace(new RegExp(`<link rel="alternate" hreflang="${code}(?:-[A-Za-z]+)?" href="[^"]*">`, "g"), "")
    .replace(new RegExp(`<meta property="og:locale:alternate" content="${code}_[A-Z]{2}">`, "g"), "")
    .replace(new RegExp(`^[ \\t]*<xhtml:link rel="alternate" hreflang="${code}(?:-[A-Za-z]+)?" href="[^"]*"\\/>\\r?\\n?`, "gm"), "")
    .replace(new RegExp(`^[ \\t]*<url>\\s*<loc>https?:\\/\\/[^/<]+\\/${code}\\/[^<]*<\\/loc>[\\s\\S]*?<\\/url>\\r?\\n?`, "gm"), "");
}

function collapseLanguageSwitch(text) {
  return text
    .replace(/<([a-zA-Z][\w-]*)\b[^>]*\sdata-lang-switcher\b[^>]*>[\s\S]*?<\/\1>/g, "<LANG_SWITCH>")
    .replace(/<a\b[^>]*\sdata-lang-switch\b[^>]*>[\s\S]*?<\/a>/g, "<LANG_SWITCH>")
    .replace(/(?:<LANG_SWITCH>)+/g, "<LANG_SWITCH>");
}

/**
 * Bytes của một file sau chuẩn hoá. Làm việc trên chuỗi latin1 (ánh xạ 1-1 byte ↔ ký tự) nên file nhị phân
 * không chứa pin giữ nguyên byte; mọi mẫu chuẩn hoá đều là ASCII.
 */
export function normalizeContent(relPath, bytes, pins, { allowLocales = [], collapseSwitch = false } = {}) {
  let text = bytes.toString("latin1");
  text = text.replace(BUILD_DATE, "$1<BUILD_DATE>$2");
  text = replacePins(text, pins);
  for (const locale of allowLocales) text = stripLocale(text, locale);
  if (collapseSwitch) text = collapseLanguageSwitch(text);
  return Buffer.from(text, "latin1");
}

function validateLocales(locales) {
  for (const locale of locales) {
    if (!LOCALE_CODE.test(locale)) throw new Error(`--allow-locale nhận mã ngôn ngữ chữ thường (vd. ja), nhận "${locale}"`);
  }
  return [...new Set(locales)].sort();
}

const isExcluded = (relPath, allowLocales) =>
  EXCLUDED_PREFIXES.some((prefix) => relPath.startsWith(prefix))
  || allowLocales.some((locale) => relPath.startsWith(`${locale}/`));

async function listFiles(root) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(entry.parentPath ?? entry.path, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Output có symlink: ${relative(root, full)}`);
    if (entry.isFile()) files.push(relative(root, full).split(sep).join("/"));
  }
  return files.sort();
}

/**
 * Manifest của một thư mục output: `files` = `{đường dẫn chuẩn hoá: sha256}` theo quy tắc 1–2 (cộng bỏ phần của
 * locale khai `--allow-locale`), `languageSwitchAgnostic` = cùng hash nhưng gộp cụm nút chuyển ngôn ngữ. Baseline
 * chụp một lần vẫn so được với build có thêm locale: `compare --allow-locale` dùng bảng thứ hai ở cả hai phía.
 */
export async function snapshotDirectory(root, { allowLocales = [], label = null } = {}) {
  const locales = validateLocales(allowLocales);
  const absolute = resolve(root);
  const pins = await collectPins(absolute);
  const files = {};
  const languageSwitchAgnostic = {};
  for (const relPath of await listFiles(absolute)) {
    if (isExcluded(relPath, locales)) continue;
    const key = normalizePath(relPath, pins);
    if (Object.hasOwn(files, key)) throw new Error(`Hai file trùng đường dẫn sau chuẩn hoá: ${key}`);
    const bytes = await readFile(join(absolute, relPath));
    files[key] = sha256(normalizeContent(relPath, bytes, pins, { allowLocales: locales }));
    languageSwitchAgnostic[key] = sha256(normalizeContent(relPath, bytes, pins, { allowLocales: locales, collapseSwitch: true }));
  }
  const generationId = pins.find((pin) => pin.token === "<REC_GEN>")?.value ?? null;
  return {
    meta: {
      schemaVersion: MANIFEST_SCHEMA,
      label,
      generationId,
      allowLocales: locales,
      excluded: [...EXCLUDED_PREFIXES, ...locales.map((locale) => `${locale}/`)],
      fileCount: Object.keys(files).length,
      filesSha256: sha256(JSON.stringify(files)),
    },
    files,
    languageSwitchAgnostic,
  };
}

/** File dữ liệu riêng của locale được thêm: `data/<tên có token mã locale>.json` (vd. `data/lookup-ja.json`). */
const isLocaleDataFile = (relPath, locale) =>
  new RegExp(`^data/(?:[^/]*[-_.])?${escapeRegExp(locale)}(?:[-_.][^/]*)?\\.json$`).test(relPath);

/** So hai manifest; `ok` false khi có file đổi/mất/thêm ngoài allowlist. */
export function compareManifests(base, head, { allowLocales = [], allowFiles = [] } = {}) {
  const locales = validateLocales(allowLocales);
  for (const manifest of [base, head]) {
    const snapshotLocales = manifest?.meta?.allowLocales ?? [];
    const uncovered = snapshotLocales.filter((locale) => !locales.includes(locale));
    if (uncovered.length) throw new Error(`Manifest chụp với --allow-locale ${uncovered.join(",")}; compare phải khai cùng --allow-locale`);
  }
  // Có --allow-locale: so bảng đã gộp nút chuyển ngôn ngữ (thêm locale làm cụm nút đổi ở mọi trang).
  const table = locales.length ? "languageSwitchAgnostic" : "files";
  const baseFiles = base[table] ?? {};
  const headFiles = head[table] ?? {};
  const added = Object.keys(headFiles).filter((path) => !Object.hasOwn(baseFiles, path)).sort();
  const removed = Object.keys(baseFiles).filter((path) => !Object.hasOwn(headFiles, path)).sort();
  const changed = Object.keys(baseFiles).filter((path) => Object.hasOwn(headFiles, path) && baseFiles[path] !== headFiles[path]).sort();
  const allowed = new Set(allowFiles);
  const addAllowed = (path) => allowed.has(path)
    || locales.some((locale) => path.startsWith(`${locale}/`) || isLocaleDataFile(path, locale));
  const violations = [
    ...changed.filter((path) => !allowed.has(path)),
    ...removed.filter((path) => !allowed.has(path)),
    ...added.filter((path) => !addAllowed(path)),
  ].sort();
  return { added, removed, changed, violations, ok: violations.length === 0 };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { allowLocales: [], allowFiles: [] };
  const single = { "--root": "root", "--out": "out", "--base": "base", "--head": "head", "--label": "label" };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!(flag in single) && flag !== "--allow-locale" && flag !== "--allow-file") throw new Error(`Tham số lạ: ${flag}`);
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} thiếu giá trị`);
    if (flag === "--allow-locale") options.allowLocales.push(value);
    else if (flag === "--allow-file") options.allowFiles.push(value);
    else options[single[flag]] = value;
    index += 1;
  }
  return { command, options };
}

function printList(title, paths, limit = 50) {
  console.log(`${title}: ${paths.length}`);
  for (const path of paths.slice(0, limit)) console.log(`  ${path}`);
  if (paths.length > limit) console.log(`  … và ${paths.length - limit} file khác`);
}

export async function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv);
  if (command === "snapshot") {
    const manifest = await snapshotDirectory(options.root ?? DEFAULT_ROOT, { allowLocales: options.allowLocales, label: options.label ?? null });
    const out = options.out ?? DEFAULT_HEAD;
    const body = `${JSON.stringify(manifest, null, 2)}\n`;
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, body);
    console.log(`Đã ghi ${out}: ${manifest.meta.fileCount} file, filesSha256 ${manifest.meta.filesSha256}, manifest sha256 ${sha256(body)}`);
    return 0;
  }
  if (command === "compare") {
    const load = async (path) => parseJson(await readFile(path), path);
    const base = await load(options.base ?? DEFAULT_BASE);
    const head = await load(options.head ?? DEFAULT_HEAD);
    const result = compareManifests(base, head, options);
    console.log(`base ${base.meta?.fileCount ?? "?"} file (${base.meta?.label ?? "không nhãn"}), head ${head.meta?.fileCount ?? "?"} file (${head.meta?.label ?? "không nhãn"})`);
    printList("Đổi", result.changed);
    printList("Thêm", result.added);
    printList("Mất", result.removed);
    printList("Ngoài allowlist", result.violations);
    console.log(result.ok ? "OK: không có thay đổi ngoài allowlist" : "LỖI: có thay đổi ngoài allowlist");
    return result.ok ? 0 : 1;
  }
  throw new Error(`Lệnh phải là snapshot hoặc compare, nhận "${command ?? ""}"`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }, (error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
