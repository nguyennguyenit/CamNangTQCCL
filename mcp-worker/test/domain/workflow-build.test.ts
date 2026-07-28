import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectSemanticClosure,
  createWorkflowBuildId,
  validateWorkflowSourceManifest,
  type WorkflowSourceManifest,
} from "../../scripts/generate-workflow-build.js";

const temporaryDirectories: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tqccl-workflow-"));
  temporaryDirectories.push(root);
  mkdirSync(join(root, "src"));
  writeFileSync(
    join(root, "src/entry.ts"),
    'import { value } from "./semantic.js";\nexport const result = value;\n',
  );
  writeFileSync(join(root, "src/semantic.ts"), "export const value = 1;\n");
  writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
  const manifest: WorkflowSourceManifest = {
    version: 1,
    entrypoints: ["src/entry.ts"],
    semanticFiles: ["src/entry.ts", "src/semantic.ts"],
    buildInputs: ["package.json"],
    exclusions: [{ path: "test", reason: "Chỉ chứa kiểm thử." }],
  };
  return { root, manifest };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("workflow build identity", () => {
  it("thu thập đúng closure tĩnh và ánh xạ import .js về nguồn TypeScript", () => {
    const { root } = fixture();

    expect(collectSemanticClosure(root, ["src/entry.ts"])).toEqual([
      "src/entry.ts",
      "src/semantic.ts",
    ]);
  });

  it("không bỏ sót static import khi có comment quanh from", () => {
    const { root } = fixture();
    writeFileSync(
      join(root, "src/entry.ts"),
      'import { value } from /* gap */ "./semantic.js";\nexport { value };\n',
    );

    expect(collectSemanticClosure(root, ["src/entry.ts"])).toEqual([
      "src/entry.ts",
      "src/semantic.ts",
    ]);
  });

  it("từ chối manifest thiếu hoặc thừa nguồn ngữ nghĩa", () => {
    const { root, manifest } = fixture();

    expect(() =>
      validateWorkflowSourceManifest(root, {
        ...manifest,
        semanticFiles: ["src/entry.ts"],
      }),
    ).toThrow("semanticFiles");
    expect(() =>
      validateWorkflowSourceManifest(root, {
        ...manifest,
        semanticFiles: [...manifest.semanticFiles, "src/unreachable.ts"],
      }),
    ).toThrow("semanticFiles");
  });

  it("từ chối import động không thể xác định closure", () => {
    const { root } = fixture();
    for (const source of [
      'await import("./semantic.js");\n',
      'await import /* gap */ ("./semantic.js");\n',
    ]) {
      writeFileSync(join(root, "src/entry.ts"), source);
      expect(() => collectSemanticClosure(root, ["src/entry.ts"])).toThrow(
        "Dynamic import",
      );
    }
  });

  it("đổi build ID khi nguồn ngữ nghĩa hoặc build input đổi", () => {
    const { root, manifest } = fixture();
    const initial = createWorkflowBuildId(root, manifest);
    writeFileSync(join(root, "src/semantic.ts"), "export const value = 2;\n");
    const semanticChange = createWorkflowBuildId(root, manifest);
    writeFileSync(join(root, "package.json"), '{"type":"module","sideEffects":false}\n');
    const buildInputChange = createWorkflowBuildId(root, manifest);

    expect(semanticChange).not.toBe(initial);
    expect(buildInputChange).not.toBe(semanticChange);
    expect(readFileSync(join(root, "src/semantic.ts"), "utf8")).toContain("2");
  });
});
