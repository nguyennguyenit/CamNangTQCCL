#!/usr/bin/env node
// Báo cáo mục Tra cứu mà bản zh chưa đủ chữ: quét `lookupProfile(...).viOnly` trên toàn corpus (cùng hàm dựng hồ sơ mà trang
// riêng dùng) rồi so hồ sơ vi với hồ sơ zh của mục đó để liệt kê trường/mục bị bỏ. Không bổ sung dữ liệu zh, chỉ báo cáo.
//
//   node scripts/report-zh-gaps.mjs            ghi plans/261015-1658-seo-ai-render-san/reports/zh-gaps.md
//   node scripts/report-zh-gaps.mjs --check    báo lỗi (exit 1) nếu file trên không khớp dữ liệu hiện tại
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { withLocale } from "../js/i18n.js";
import { lookupEmpty, lookupProfile } from "../js/lookup-detail.js";
import { lookupGroupLabels } from "../js/unified-lookup.js";
import { lookupBuildCorpus } from "../src/lib/lookup-pages.ts";
import { LOOKUP_GROUP_SLUGS } from "../js/lookup-ids.js";

export const ZH_GAPS_REPORT_PATH = new URL("../plans/261015-1658-seo-ai-render-san/reports/zh-gaps.md", import.meta.url);

const EMPTY_VI = withLocale("vi", () => lookupEmpty());
const EMPTY_ZH = withLocale("zh", () => lookupEmpty());
const keysOf = (rows) => new Set((rows ?? []).map((row) => row.key));
const count = (rows) => (Array.isArray(rows) ? rows.length : 0);

/** Phần của hồ sơ vi mà hồ sơ zh không có: trường (theo khóa), số điều kiện/lịch sử, số phần tử con theo khóa. */
export function missingInZh(vi, zh) {
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
  const gaps = [];
  for (const group of Object.keys(LOOKUP_GROUP_SLUGS)) {
    for (const item of corpus.groups[group]) {
      const zh = withLocale("zh", () => lookupProfile(corpus, item.id));
      if (!zh?.viOnly) continue;
      const vi = withLocale("vi", () => lookupProfile(corpus, item.id));
      gaps.push({ group, id: item.id, name: item.nameVi, missing: missingInZh(vi, zh) });
    }
  }
  return gaps;
}

const cell = (value) => String(value).replace(/\|/g, "\\|");

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

async function main(argv) {
  const corpus = await lookupBuildCorpus();
  const totals = Object.fromEntries(Object.keys(LOOKUP_GROUP_SLUGS).map((group) => [group, corpus.groups[group].length]));
  const report = renderZhGapsReport(zhGaps(corpus), totals);
  if (argv.includes("--check")) {
    const current = await readFile(ZH_GAPS_REPORT_PATH, "utf8").catch(() => null);
    if (current !== report) {
      console.error("zh-gaps.md không khớp dữ liệu hiện tại: chạy `node scripts/report-zh-gaps.mjs`");
      return 1;
    }
    console.log("zh-gaps.md khớp dữ liệu hiện tại");
    return 0;
  }
  await writeFile(ZH_GAPS_REPORT_PATH, report);
  console.log(`zh-gaps.md: ${report.split("\n").length} dòng`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main(process.argv.slice(2));
