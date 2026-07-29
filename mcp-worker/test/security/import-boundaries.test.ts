import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

function moduleSpecifiers(filename: string, source: string): string[] {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers: string[] = [];
  const addSpecifier = (specifier: string): void => {
    if (specifier.startsWith("node:")) {
      throw new Error(`Worker graph imports Node module: ${specifier}`);
    }
    specifiers.push(specifier);
  };
  const visit = (node: ts.Node): void => {
    const dynamicImportArgument = ts.isCallExpression(node)
      ? node.arguments[0]
      : undefined;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addSpecifier(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      (node.arguments.length !== 1 ||
        dynamicImportArgument === undefined ||
        !ts.isStringLiteral(dynamicImportArgument))
    ) {
      throw new Error("Worker graph có dynamic import không thể đóng.");
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      dynamicImportArgument !== undefined &&
      ts.isStringLiteral(dynamicImportArgument)
    ) {
      addSpecifier(dynamicImportArgument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
}

function workerClosure(): string[] {
  const pending = [resolve(packageRoot, "src/worker.ts")];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const filename = pending.pop();
    if (filename === undefined || visited.has(filename)) continue;
    visited.add(filename);
    const source = readFileSync(filename, "utf8");
    for (const specifier of moduleSpecifiers(filename, source)) {
      if (specifier.startsWith(".")) {
        const imported = resolve(dirname(filename), specifier);
        const typescript = imported.replace(/\.js$/u, ".ts");
        pending.push(existsSync(typescript) ? typescript : imported);
      }
    }
  }
  return [...visited].map((path) => relative(packageRoot, path)).sort();
}

describe("Worker import boundaries", () => {
  it("không kéo Node, publisher, media hoặc mutation vào runtime graph", () => {
    const closure = workerClosure();
    expect(closure).not.toContain("scripts/publish-data-release.ts");
    expect(closure).not.toContain("scripts/r2-release-store.ts");
    expect(closure.some((path) => path.includes("/release/"))).toBe(false);
    for (const path of closure) {
      const source = readFileSync(resolve(packageRoot, path), "utf8");
      expect(source, path).not.toMatch(/from\s+["']node:/u);
      expect(path, path).not.toMatch(
        /(?:^|\/)(?:vision|image|crawler|rag|memory)(?:\/|[.-])/iu,
      );
      expect(source, path).not.toMatch(
        /\b(?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*(?:bucket|r2)[A-Za-z_$\d]*\s*(?:\.|\[\s*["'])(?:put|delete)(?:["']\s*\])?\s*\(/iu,
      );
    }
  });
});
