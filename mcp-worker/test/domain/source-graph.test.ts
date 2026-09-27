import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { L, currentLocale } from "../../../js/i18n.js";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const entrypoints = [
  "js/match-dict.js",
  "js/hanviet.js",
  "js/analyze-map.js",
  "js/roster-scan-map.js",
  "js/roster-scan-state.js",
  "js/team-recommend-engine.js",
] as const;

const forbidden = [
  /\b(?:window|document|localStorage|Image|canvas)\b/u,
  /(?:^|\/)js\/(?:analyze|roster-recommend-ui)\.js$/u,
  /(?:^|\/)worker\//u,
  /@modelcontextprotocol/u,
  /cloudflare|wrangler/u,
];
const forbiddenImports = /^(?:node:)?(?:fs|path)$/u;

function semanticClosure(): string[] {
  const visited = new Set<string>();
  const pending = entrypoints.map((entrypoint) => resolve(repositoryRoot, entrypoint));

  while (pending.length > 0) {
    const filename = pending.pop();
    if (!filename || visited.has(filename)) continue;
    visited.add(filename);
    const source = readFileSync(filename, "utf8");
    const staticImports = [
      ...source.matchAll(/^\s*import\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/gmu),
    ];
    const dynamicImports = [...source.matchAll(/\bimport\s*\(([^)]+)\)/gu)];
    expect(dynamicImports, `dynamic imports are unresolved in ${filename}`).toHaveLength(0);

    for (const match of staticImports) {
      const specifier = match[1];
      if (!specifier) continue;
      expect(specifier.startsWith("."), `package import ${specifier} in ${filename}`).toBe(true);
      pending.push(resolve(dirname(filename), specifier));
    }
  }

  return [...visited].map((filename) => relative(repositoryRoot, filename)).sort();
}

describe("legacy semantic source graph", () => {
  it("emits the actual transitive closure from declared entrypoints", () => {
    expect(semanticClosure()).toEqual([
      "js/analyze-map.js",
      "js/filters.js",
      "js/hanviet.js",
      "js/hero-identity.js",
      "js/i18n.js",
      "js/match-dict.js",
      "js/roster-scan-map.js",
      "js/roster-scan-state.js",
      "js/season-context.js",
      "js/team-recommend-engine.js",
    ]);
  });

  it("rejects browser, filesystem, Worker, Cloudflare, and MCP coupling", () => {
    for (const relativePath of semanticClosure()) {
      const source = readFileSync(resolve(repositoryRoot, relativePath), "utf8");
      for (const pattern of forbidden) {
        // js/i18n.js đọc `globalThis.document` có guard để lấy <html lang>; ngoài DOM phải về `vi`
        // (kiểm bằng hành vi cuối test) nên chỉ file này được miễn quy tắc biến toàn cục trình duyệt.
        if (relativePath === "js/i18n.js" && pattern === forbidden[0]) continue;
        expect(
          pattern.test(relativePath) || pattern.test(source),
          `${relativePath} matched forbidden ${pattern}`,
        ).toBe(false);
      }
      const specifiers = [
        ...source.matchAll(/^\s*import\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/gmu),
      ].map((match) => match[1]);
      expect(
        specifiers.some((specifier) => specifier && forbiddenImports.test(specifier)),
        `${relativePath} imports filesystem/path primitives`,
      ).toBe(false);
    }
    expect(globalThis).not.toHaveProperty("document");
    expect(currentLocale()).toBe("vi");
    expect(L("vi", "zh")).toBe("vi");
  });
});
