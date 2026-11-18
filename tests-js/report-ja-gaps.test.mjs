// Báo cáo gap bản ja (`scripts/report-ja-gaps.mjs`): `--check` bắt file thiếu/sửa tay, file sinh lại khớp `docs/ja-gaps.md`, và
// bố cục bảng (mục thiếu theo nhóm, trạng thái tên Nhật, khóa chưa dịch) đúng hợp đồng.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderJaGapsReport } from "../scripts/report-ja-gaps.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "scripts/report-ja-gaps.mjs");
const run = (args, reportPath) => spawnSync(process.execPath, ["--experimental-strip-types", script, ...args], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, JA_GAPS_REPORT_PATH: reportPath },
});
const tmp = () => mkdtempSync(path.join(tmpdir(), "ja-gaps-"));

test("--check báo lỗi khi thiếu file và nêu đường dẫn", () => {
  const dir = tmp();
  const missing = path.join(dir, "absent.md");
  const result = run(["--check"], missing);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(missing), result.stderr);
  rmSync(dir, { recursive: true });
});

test("sinh lại khớp docs/ja-gaps.md; sửa tay một dòng thì --check đỏ", () => {
  const dir = tmp();
  const file = path.join(dir, "ja-gaps.md");
  assert.equal(run([], file).status, 0);
  assert.equal(readFileSync(file, "utf8"), readFileSync(path.join(root, "docs/ja-gaps.md"), "utf8"));
  assert.equal(run(["--check"], file).status, 0);
  const lines = readFileSync(file, "utf8").split("\n");
  lines[2] += " sửa tay";
  writeFileSync(file, lines.join("\n"));
  assert.equal(run(["--check"], file).status, 1);
  rmSync(dir, { recursive: true });
});

test("bố cục: tổng, bảng nhóm, bảng trạng thái tên Nhật, bảng mục thiếu có khóa chưa dịch", () => {
  const totals = { heroes: 2, tactics: 3, equipment: 0, advisors: 0, "troop-mods": 0, buildings: 0, books: 0 };
  const names = Object.fromEntries(Object.keys(totals).map((group) => [group, { verified: group === "heroes" ? 2 : 0, derived: group === "tactics" ? 3 : 0, missing: 0 }]));
  const gaps = [{ group: "tactics", id: "tactic:a|b", name: "Tên Việt", jaName: "名前", untranslated: ["effect"], missing: ["effect", "revisions (1)"] }];
  const report = renderJaGapsReport(gaps, totals, names);
  assert.match(report, /^# Mục Tra cứu bản ja còn thiếu bản dịch\n/u);
  assert.match(report, /Tổng: 1 \/ 5 mục\./u);
  assert.match(report, /\| Tướng \| 2 \| 0 \| 0 \| 2 \|/u);
  assert.match(report, /\| Chiến pháp \| 0 \| 3 \| 0 \| 3 \|/u);
  assert.match(report, /\| tactic:a\\\|b \| 名前 · Tên Việt \| effect \| effect, revisions \(1\) \|/u);
  assert.match(report, /## Tướng \(heroes\): 0 \/ 2\n\nKhông có mục nào thiếu\./u);
});
