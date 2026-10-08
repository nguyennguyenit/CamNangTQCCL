import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { realSource } from "./helpers.js";

const repoRoot = join(fileURLToPath(new URL("../../..", import.meta.url)));
const ledgerPath = join(
  repoRoot,
  "plans/260927-1727-mcp-skill-redesign/reports/rule-migration-ledger.md",
);

interface LedgerRow {
  file: string;
  lines: [number, number] | null;
  ruleIds: string[];
  kinds: string[];
  review: string;
}

function parseLedger(): LedgerRow[] {
  return readFileSync(ledgerPath, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| ---") && !line.startsWith("| Source file:line"))
    .map((line) => {
      const cells = line.split(/(?<!\\)\|/u).map((cell) => cell.trim());
      const source = cells[1] ?? "";
      const split = source.lastIndexOf(":");
      const file = source.slice(0, split);
      const range = /^(\d+)(?:-(\d+))?$/u.exec(source.slice(split + 1));
      return {
        file,
        lines: range === null ? null : [Number(range[1]), Number(range[2] ?? range[1])],
        ruleIds: [...(cells[3] ?? "").matchAll(/`([a-z0-9-]+)`/gu)].map((match) => match[1] ?? ""),
        kinds: (cells[4] ?? "").split(",").map((kind) => kind.trim()),
        review: cells[5] ?? "",
      };
    });
}

const SKILL_FILES = [
  ".agents/skills/tqccl-research/SKILL.md",
  ".agents/skills/tqccl-research/references/evidence-and-region-rules.md",
  ".agents/skills/tqccl-research/references/report-template.md",
  ".agents/skills/tqccl-coexist-team-builder/SKILL.md",
  ".agents/skills/tqccl-coexist-team-builder/references/coexist-team-rules.md",
  ".agents/skills/tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md",
  ".agents/skills/tqccl-coexist-team-builder/references/chat-context-team-notes.md",
  ".agents/skills/tqccl-lookup/SKILL.md",
  ".agents/skills/tqccl-lookup/references/tool-routing.md",
];
const OBLIGATION = /\b(must|never|always|do not|don't|required|exactly|only)\b|không được|bắt buộc/iu;

describe("rule migration ledger", () => {
  const rows = parseLedger();
  const rulesById = new Map(realSource.bundle.rules.map((rule) => [rule.id, rule]));

  it("has rows and every row is pending owner review", () => {
    expect(rows.length).toBeGreaterThan(50);
    for (const row of rows) expect(row.review).toBe("pending");
  });

  it("every ruleId exists in the dataset and the kind column matches it (no silent downgrade)", () => {
    for (const row of rows) {
      expect(row.ruleIds.length).toBeGreaterThan(0);
      expect(row.kinds).toHaveLength(row.ruleIds.length);
      row.ruleIds.forEach((id, index) => {
        expect(rulesById.has(id), `${row.file}: ${id}`).toBe(true);
        expect(rulesById.get(id)?.kind, `${row.file}: ${id}`).toBe(row.kinds[index]);
      });
    }
  });

  it("every rule in the dataset is traced to at least one ledger row", () => {
    const traced = new Set(rows.flatMap((row) => row.ruleIds));
    expect([...rulesById.keys()].filter((id) => !traced.has(id))).toEqual([]);
  });

  it("every obligation line of the migrated skills falls inside a ledger row range", () => {
    const missing: string[] = [];
    for (const file of SKILL_FILES) {
      const source = readFileSync(join(repoRoot, file), "utf8").split("\n");
      const ranges = rows.flatMap((row) => (row.file === file && row.lines !== null ? [row.lines] : []));
      let inFence = false;
      source.forEach((text, index) => {
        if (text.startsWith("```")) inFence = !inFence;
        if (inFence || !OBLIGATION.test(text)) return;
        const line = index + 1;
        if (!ranges.some(([from, to]) => line >= from && line <= to)) missing.push(`${file}:${line} ${text.trim().slice(0, 80)}`);
      });
    }
    expect(missing).toEqual([]);
  });

  it("every ledger row of the skills has a source line range inside the file", () => {
    for (const row of rows.filter((entry) => SKILL_FILES.includes(entry.file))) {
      const total = readFileSync(join(repoRoot, row.file), "utf8").split("\n").length;
      expect(row.lines, row.file).not.toBeNull();
      expect(row.lines?.[1] ?? 0, row.file).toBeLessThanOrEqual(total);
    }
  });

  it("obligation-bearing rows never map to guidance-only rules without a note", () => {
    const text = readFileSync(ledgerPath, "utf8");
    for (const line of text.split("\n").filter((entry) => entry.startsWith("| ") && !entry.startsWith("| ---"))) {
      const cells = line.split(/(?<!\\)\|/u).map((cell) => cell.trim());
      const kinds = (cells[4] ?? "").split(",").map((kind) => kind.trim());
      if (kinds.every((kind) => kind === "guidance")) {
        expect(cells[6]?.length ?? 0, line.slice(0, 80)).toBeGreaterThan(0);
      }
    }
  });
});
