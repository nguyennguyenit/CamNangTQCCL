#!/usr/bin/env node
// Báo cáo mục Tra cứu mà bản zh chưa đủ chữ: quét `lookupProfile(...).viOnly` trên toàn corpus (cùng hàm dựng hồ sơ mà trang
// riêng dùng) rồi so hồ sơ vi với hồ sơ zh của mục đó để liệt kê trường/mục bị bỏ. Không bổ sung dữ liệu zh, chỉ báo cáo.
// Các hàm so hồ sơ và chạy lệnh nhận locale nên `scripts/report-ja-gaps.mjs` (báo cáo bản ja) dùng lại.
//
//   node scripts/report-zh-gaps.mjs            ghi docs/zh-gaps.md
//   node scripts/report-zh-gaps.mjs --check    báo lỗi (exit 1) nếu docs/zh-gaps.md không khớp dữ liệu hiện tại (`npm run verify` chạy lệnh này)
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { withLocale } from "../js/i18n.js";
import { lookupEmpty, lookupProfile } from "../js/lookup-detail.js";
import { lookupGroupLabels } from "../js/unified-lookup.js";
import { LOOKUP_GROUP_SLUGS } from "../js/lookup-ids.js";

// Biến môi trường ZH_GAPS_REPORT_PATH chỉ để test trỏ sang file tạm.
export const ZH_GAPS_REPORT_PATH = process.env.ZH_GAPS_REPORT_PATH
  ? pathToFileURL(process.env.ZH_GAPS_REPORT_PATH)
  : new URL("../docs/zh-gaps.md", import.meta.url);

const EMPTY_VI = withLocale("vi", () => lookupEmpty());
const keysOf = (rows) => new Set((rows ?? []).map((row) => row.key));
const count = (rows) => (Array.isArray(rows) ? rows.length : 0);

/** Phần của hồ sơ vi mà hồ sơ zh không có: trường (theo khóa), số điều kiện/lịch sử, số phần tử con theo khóa. */
export function missingInZh(vi, zh) {
  return missingInLocale(vi, zh, "zh");
}

/** Phần của hồ sơ vi mà hồ sơ `locale` (`zh`, `ja`…) cùng mục không có; ô thành chữ trống của `locale` cũng tính là thiếu. */
export function missingInLocale(vi, zh, locale) {
  const EMPTY_ZH = withLocale(locale, () => lookupEmpty());
  const missing = [];
  for (const kind of ["fields", "aptitudes", "sections", "relations"]) {
    const kept = keysOf(zh[kind]);
    for (const row of vi[kind] ?? []) if (!kept.has(row.key)) missing.push(`${kind === "fields" ? "" : `${kind}:`}${row.key}`);
  }
  for (const kind of ["conditions", "revisions"]) {
    const lost = count(vi[kind]) - count(zh[kind]);
    if (lost > 0) missing.push(`${kind} (${lost})`);
  }
  const zhChildren = new Map((zh.children ?? []).map((child) => [child.key, child.items ?? []]));
  for (const child of vi.children ?? []) {
    const zhItems = zhChildren.get(child.key) ?? [];
    const lost = count(child.items) - zhItems.length;
    if (lost > 0) missing.push(`${child.key} (${lost})`);
    // Phần tử còn nhưng một thuộc tính chữ Việt đã thành ô trống ở bản zh (hiệu ứng/thời lượng của cấp công trình…).
    const emptied = new Map();
    for (const [index, item] of (child.items ?? []).slice(0, zhItems.length).entries()) {
      for (const [prop, value] of Object.entries(item)) {
        if (typeof value === "string" && value !== EMPTY_VI && zhItems[index][prop] === EMPTY_ZH) emptied.set(prop, (emptied.get(prop) ?? 0) + 1);
      }
    }
    for (const [prop, n] of emptied) missing.push(`${child.key}.${prop} (${n})`);
  }
  return missing;
}

/** Mọi mục có `viOnly` ở bản zh, theo thứ tự nhóm rồi thứ tự corpus: `{group, id, name, missing[]}`. */
export function zhGaps(corpus) {
  return localeGaps(corpus, "zh").map(({ group, id, name, missing }) => ({ group, id, name, missing }));
}

/**
 * Mọi mục mà hồ sơ `locale` còn thiếu (`isGap(hồ sơ)`, mặc định `viOnly`), theo thứ tự nhóm rồi thứ tự corpus:
 * `{group, id, name, profile, missing[]}` (`profile` là hồ sơ `locale`, `missing` so với hồ sơ vi).
 */
export function localeGaps(corpus, locale, isGap = (profile) => Boolean(profile?.viOnly)) {
  const gaps = [];
  for (const group of Object.keys(LOOKUP_GROUP_SLUGS)) {
    for (const item of corpus.groups[group]) {
      const profile = withLocale(locale, () => lookupProfile(corpus, item.id));
      if (!isGap(profile)) continue;
      const vi = withLocale("vi", () => lookupProfile(corpus, item.id));
      gaps.push({ group, id: item.id, name: item.nameVi, profile, missing: missingInLocale(vi, profile, locale) });
    }
  }
  return gaps;
}

/** Số mục của từng nhóm trong corpus, theo thứ tự nhóm công bố. */
export const groupTotals = (corpus) => Object.fromEntries(Object.keys(LOOKUP_GROUP_SLUGS).map((group) => [group, corpus.groups[group].length]));

export const cell = (value) => String(value).replace(/\|/g, "\\|");

/** Markdown của báo cáo; `totals` là số mục mỗi nhóm của corpus. */
export function renderZhGapsReport(gaps, totals) {
  const labels = withLocale("vi", () => lookupGroupLabels("vi"));
  const lines = [
    "# Mục Tra cứu bản zh còn thiếu chữ",
    "",
    "Sinh bằng `node scripts/report-zh-gaps.mjs` (không sửa tay). Mục nằm đây khi `lookupProfile(...).viOnly` ở bản zh: hồ sơ zh bỏ phần chỉ có chữ Việt (điều kiện, lịch sử, mô tả, lựa chọn…) và hiện một dòng báo thiếu.",
    "Cột \"Phần thiếu\" so hồ sơ vi với hồ sơ zh của cùng mục.",
    "",
    `Tổng: ${gaps.length} / ${Object.values(totals).reduce((sum, value) => sum + value, 0)} mục.`,
    "",
    "| Nhóm | Mục thiếu | Tổng mục |",
    "|---|---:|---:|",
    ...Object.keys(totals).map((group) => `| ${labels[group]} | ${gaps.filter((gap) => gap.group === group).length} | ${totals[group]} |`),
    "",
  ];
  for (const group of Object.keys(totals)) {
    const rows = gaps.filter((gap) => gap.group === group);
    lines.push(`## ${labels[group]} (${group}): ${rows.length} / ${totals[group]}`, "");
    if (!rows.length) {
      lines.push("Không có mục nào thiếu.", "");
      continue;
    }
    lines.push("| Mã | Tên | Phần thiếu |", "|---|---|---|");
    for (const row of rows) lines.push(`| ${cell(row.id)} | ${cell(row.name)} | ${cell(row.missing.join(", ") || "(không xác định)")} |`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Chạy một báo cáo gap: dựng corpus của build, `render(corpus)` ra Markdown rồi ghi `reportPath` hoặc (với `--check`) so với
 * file hiện có. `command` là lệnh sinh lại in trong thông báo lỗi. Trả mã thoát.
 */
export async function runGapsReport({ argv, reportPath, render, command }) {
  // Thư viện corpus lấy gốc dự án từ cwd lúc nạp module: chuyển về gốc repo rồi mới nạp để chạy từ thư mục nào cũng ra cùng kết quả.
  process.chdir(fileURLToPath(new URL("..", import.meta.url)));
  const { lookupBuildCorpus } = await import("../src/lib/lookup-pages.ts");
  const report = render(await lookupBuildCorpus());
  const name = fileURLToPath(reportPath).split(/[\\/]/).at(-1);
  if (argv.includes("--check")) {
    const current = await readFile(reportPath, "utf8").catch(() => null);
    if (current !== report) {
      console.error(`${fileURLToPath(reportPath)} không có hoặc không khớp dữ liệu hiện tại: chạy \`${command}\``);
      return 1;
    }
    console.log(`${name} khớp dữ liệu hiện tại`);
    return 0;
  }
  await writeFile(reportPath, report);
  console.log(`${name}: ${report.split("\n").length} dòng`);
  return 0;
}

async function main(argv) {
  return runGapsReport({
    argv,
    reportPath: ZH_GAPS_REPORT_PATH,
    render: (corpus) => renderZhGapsReport(zhGaps(corpus), groupTotals(corpus)),
    command: "node scripts/report-zh-gaps.mjs",
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main(process.argv.slice(2));
