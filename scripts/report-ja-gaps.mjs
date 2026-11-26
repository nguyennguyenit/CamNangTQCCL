#!/usr/bin/env node
// Báo cáo mục Tra cứu mà bản ja chưa đủ chữ: hồ sơ ja (`lookupProfile` dưới `withLocale("ja")`, cùng hàm dựng trang riêng) có khóa
// chữ Hán nguồn chưa có bản dịch máy trong `data/lookup-ja.json` (`untranslated`) hoặc bỏ phần chỉ có chữ Việt (`viOnly`); kèm
// bảng số tên Nhật `verified`/`derived` theo nhóm. Dùng chung bộ so hồ sơ và bộ chạy của `scripts/report-zh-gaps.mjs`.
// Không bổ sung bản dịch, chỉ báo cáo.
//
//   node scripts/report-ja-gaps.mjs            ghi docs/ja-gaps.md
//   node scripts/report-ja-gaps.mjs --check    báo lỗi (exit 1) nếu docs/ja-gaps.md không khớp dữ liệu hiện tại (`npm run verify` chạy lệnh này)
//
// Khi branch chưa bật `ja` trong `SITE_LOCALES`, script tự chạy lại trong tiến trình con có `scripts/preview-locale-hook.mjs`
// (nạp `js/i18n.js` với `ja`), nên báo cáo trước và sau khi bật `/ja/` là một.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SITE_LOCALES, withLocale } from "../js/i18n.js";
import { jaSeasonName } from "../js/ja-season-names.js";
import { lookupJaEntry } from "../js/lookup-detail.js";
import { lookupGroupLabels } from "../js/unified-lookup.js";
import { cell, groupTotals, localeGaps, runGapsReport } from "./report-zh-gaps.mjs";
import { previewLocaleNodeArgs } from "./preview-locale-hook.mjs";

// Biến môi trường JA_GAPS_REPORT_PATH chỉ để test trỏ sang file tạm.
export const JA_GAPS_REPORT_PATH = process.env.JA_GAPS_REPORT_PATH
  ? pathToFileURL(process.env.JA_GAPS_REPORT_PATH)
  : new URL("../docs/ja-gaps.md", import.meta.url);

const NAME_STATUSES = ["verified", "derived"];

/** Hồ sơ ja còn thiếu: có khóa chưa dịch hoặc bỏ phần chỉ có chữ Việt. */
const isJaGap = (profile) => Boolean(profile && (profile.viOnly || profile.untranslated?.length));

/** Mọi mục thiếu của bản ja: `{group, id, name, jaName, untranslated[], missing[]}` theo thứ tự nhóm rồi corpus. */
export function jaGaps(corpus) {
  return localeGaps(corpus, "ja", isJaGap).map(({ group, id, name, profile, missing }) => ({
    group, id, name, jaName: profile.titleVi, untranslated: [...profile.untranslated], missing,
  }));
}

/** Số tên Nhật theo trạng thái của từng nhóm: `{nhóm: {verified, derived, missing}}` (`missing` = mục không có trong lớp ja). */
export function nameStatusCounts(corpus) {
  return Object.fromEntries(Object.keys(groupTotals(corpus)).map((group) => {
    const counts = { verified: 0, derived: 0, missing: 0 };
    for (const item of corpus.groups[group]) {
      const status = lookupJaEntry(item.record)?.nameStatus;
      counts[NAME_STATUSES.includes(status) ? status : "missing"] += 1;
    }
    return [group, counts];
  }));
}

/**
 * Tên mùa bản ja theo registry mùa (`seasons.json` của generation Đội chuẩn đang pin), cùng thứ tự registry:
 * `[{code, nameRaw, ja}]`, `ja` là `null` khi mùa chưa có tên Nhật đã xác minh (trang ja giữ tên nguồn).
 */
export function jaSeasonRows(registry) {
  return (Array.isArray(registry?.seasonOptions) ? registry.seasonOptions : [])
    .filter((item) => typeof item?.nameRaw === "string" && item.nameRaw.trim())
    .map((item) => ({ code: item.displayCode || item.sourceSeasonId, nameRaw: item.nameRaw.trim(), ja: jaSeasonName(item.nameRaw) }));
}

/** Markdown của báo cáo; `totals` là số mục mỗi nhóm của corpus, `names` là `nameStatusCounts`, `seasons` là `jaSeasonRows`. */
export function renderJaGapsReport(gaps, totals, names, seasons = []) {
  const labels = withLocale("vi", () => lookupGroupLabels("vi"));
  const groups = Object.keys(totals);
  const lines = [
    "# Mục Tra cứu bản ja còn thiếu bản dịch",
    "",
    "Sinh bằng `node scripts/report-ja-gaps.mjs` (không sửa tay). Mục nằm đây khi hồ sơ ja (`lookupProfile` dưới `withLocale(\"ja\")`) có khóa chữ Hán nguồn chưa có bản dịch máy trong `data/lookup-ja.json` (`untranslated`) hoặc bỏ phần chỉ có chữ Việt (`viOnly`); trang ja hiện một dòng báo thiếu.",
    "Cột \"Khóa chưa dịch\" là khóa `texts` còn vắng (bảng khóa ở [ja-lookup-data.md](ja-lookup-data.md)); cột \"Phần thiếu\" so hồ sơ vi với hồ sơ ja của cùng mục.",
    "",
    `Tổng: ${gaps.length} / ${Object.values(totals).reduce((sum, value) => sum + value, 0)} mục.`,
    "",
    "| Nhóm | Mục thiếu | Tổng mục |",
    "|---|---:|---:|",
    ...groups.map((group) => `| ${labels[group]} | ${gaps.filter((gap) => gap.group === group).length} | ${totals[group]} |`),
    "",
    "## Trạng thái tên Nhật",
    "",
    "`verified`: tên đã thấy trong nguồn Nhật (độ tin cao, gồm ảnh client Nhật). `derived`: đổi tự dạng từ chữ Hán nguồn hoặc nguồn chưa chắc; trang ja gắn nhãn 字形変換.",
    "",
    "| Nhóm | verified | derived | Không có tên Nhật | Tổng mục |",
    "|---|---:|---:|---:|---:|",
    ...groups.map((group) => `| ${labels[group]} | ${names[group].verified} | ${names[group].derived} | ${names[group].missing} | ${totals[group]} |`),
    "",
  ];
  if (seasons.length) {
    lines.push(
      "## Tên mùa",
      "",
      "Bản ja hiện tên mùa Nhật đã xác minh (`js/ja-season-names.js`, chiếu từ thuật ngữ có nguồn của `pipeline/ja-glossary.json`); ánh xạ theo tên mùa nguồn vì server Nhật đi sau một mùa. Mùa chưa có tên Nhật không tự dịch: ô chọn mùa và nhãn mùa hiện tên nguồn, trang dựng sẵn (trang mùa, trang đội) đổi tự dạng Nhật của tên nguồn.",
      "",
      `Có tên Nhật: ${seasons.filter((row) => row.ja).length} / ${seasons.length} mùa.`,
      "",
      "| Mã | Tên nguồn | Tên Nhật |",
      "|---|---|---|",
      ...seasons.map((row) => `| ${cell(row.code)} | ${cell(row.nameRaw)} | ${cell(row.ja ?? "— (chưa có)")} |`),
      "",
    );
  }
  for (const group of groups) {
    const rows = gaps.filter((gap) => gap.group === group);
    lines.push(`## ${labels[group]} (${group}): ${rows.length} / ${totals[group]}`, "");
    if (!rows.length) {
      lines.push("Không có mục nào thiếu.", "");
      continue;
    }
    lines.push("| Mã | Tên | Khóa chưa dịch | Phần thiếu |", "|---|---|---|---|");
    for (const row of rows) {
      lines.push(`| ${cell(row.id)} | ${cell(`${row.jaName} · ${row.name}`)} | ${cell(row.untranslated.join(", ") || "—")} | ${cell(row.missing.join(", ") || "—")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Registry mùa của generation Đội chuẩn đang pin (`src/data/recommended-reference/current.json`). */
function pinnedSeasonRegistry() {
  const read = (path) => JSON.parse(readFileSync(new URL(`../src/data/recommended-reference/${path}`, import.meta.url), "utf8"));
  return read(`${read("current.json").generationId}/seasons.json`);
}

async function main(argv) {
  if (!SITE_LOCALES.includes("ja")) {
    // `ja` chưa bật: chạy lại chính script trong tiến trình con nạp `js/i18n.js` có `ja` (xem đầu file).
    const result = spawnSync(process.execPath, [...previewLocaleNodeArgs(), "--experimental-strip-types", fileURLToPath(import.meta.url), ...argv], { stdio: "inherit" });
    if (result.error) throw result.error;
    return result.status ?? 1;
  }
  return runGapsReport({
    argv,
    reportPath: JA_GAPS_REPORT_PATH,
    render: (corpus) => renderJaGapsReport(jaGaps(corpus), groupTotals(corpus), nameStatusCounts(corpus), jaSeasonRows(pinnedSeasonRegistry())),
    command: "node scripts/report-ja-gaps.mjs",
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main(process.argv.slice(2));
