import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../../../", import.meta.url);
const files = [
  "README.md",
  "docs/mcp-research-server.md",
  "docs/deployment-guide.md",
  "docs/system-architecture.md",
  "docs/codebase-summary.md",
  "docs/code-standards.md",
  "docs/project-roadmap.md",
] as const;

describe("evergreen Worker Static Assets docs", () => {
  it("không còn runbook R2/pointer/CAS/force-refresh đã retire", async () => {
    const text = (
      await Promise.all(
        files.map((file) => readFile(new URL(file, repositoryRoot), "utf8")),
      )
    ).join("\n");
    expect(text).not.toMatch(
      /stage:data-release|activate:data-release|build:data-release|promotion-receipt|TQCCL-MCP-Force-Refresh|R2DataSource|pointer CAS|R2 binding/iu,
    );
  });

  it("mô tả đúng bundle, nhịp mùa và exact-version rollback", async () => {
    const guide = await readFile(
      new URL("docs/mcp-research-server.md", repositoryRoot),
      "utf8",
    );
    expect(guide).toContain("Worker Static Assets");
    expect(guide).toContain("ba tháng");
    expect(guide).toContain("prior `100%` + candidate `0%`");
    expect(guide).toContain("Version Override");
    expect(guide).toContain("npm run build:worker-assets");
    expect(guide).toContain("npm run release:worker");
  });
});
