import { readFile, readdir } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { repositoryPublicationRoots } from "../../src/data/publication-source-reader.js";

const repositoryRoot = new URL("../../../", import.meta.url);
const workflowUrl = new URL(".github/workflows/mcp-release.yml", repositoryRoot);
const monitorUrl = new URL(".github/workflows/mcp-edge-security-monitor.yml", repositoryRoot);
const manifestUrl = new URL("mcp-worker/workflow-source-manifest.json", repositoryRoot);

function productionJob(workflow: string): string {
  return workflow.slice(workflow.indexOf("production-release:"));
}

/** `on.push.paths` theo thứ tự khai báo; repo không có YAML parser nên đọc theo thụt lề cố định. */
function pushPaths(workflow: string): string[] {
  const lines = workflow.split("\n");
  const start = lines.findIndex(line => line === "    paths:");
  expect(start).toBeGreaterThan(-1);
  const paths: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^ {6}- "([^"]+)"$/u.exec(line);
    if (match === null) break;
    paths.push(match[1]!);
  }
  return paths;
}

function globPattern(glob: string): RegExp {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index]!;
    if (glob.startsWith("**/", index)) {
      source += "(?:.*/)?";
      index += 2;
    } else if (glob.startsWith("**", index)) {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += char.replace(/[.+?^${}()|[\]\\]/gu, "\\$&");
    }
  }
  return new RegExp(`^${source}$`, "u");
}

/** Ngữ nghĩa paths của GitHub Actions: pattern khớp sau cùng quyết định, `!` loại trừ. */
function triggers(paths: readonly string[], file: string): boolean {
  let included = false;
  for (const path of paths) {
    const negated = path.startsWith("!");
    if (globPattern(negated ? path.slice(1) : path).test(file)) included = !negated;
  }
  return included;
}

async function firstFile(directory: URL): Promise<string> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const file = entries.find(entry => entry.isFile());
  expect(file).toBeDefined();
  return relative(fileURLToPath(repositoryRoot), `${file!.parentPath}/${file!.name}`);
}

describe("production Worker release workflow", () => {
  it("push lên main chạm mọi đầu vào của Worker thì release", async () => {
    const paths = pushPaths(await readFile(workflowUrl, "utf8"));
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8")) as {
      entrypoints: string[];
      semanticFiles: string[];
      buildInputs: string[];
    };
    const roots = repositoryPublicationRoots(fileURLToPath(new URL("data/", repositoryRoot)));
    const repositoryPath = (path: string) => relative(fileURLToPath(repositoryRoot), path);
    const inputs = [
      ...manifest.entrypoints,
      ...manifest.semanticFiles,
      ...manifest.buildInputs,
      "data/teams.json",
      "mcp-worker/wrangler.jsonc",
      "mcp-worker/src/generated/knowledge-bundle.ts",
      ".github/workflows/mcp-release.yml",
      await firstFile(new URL("agent-knowledge/", repositoryRoot)),
      `${repositoryPath(roots.recommendedRoot)}/current.json`,
      repositoryPath(roots.routeLedgerPath),
      repositoryPath(roots.lookupRouteLedgerPath),
    ];
    for (const input of inputs) {
      expect(triggers(paths, input), `push.paths thiếu ${input}`).toBe(true);
    }
    for (const ignored of ["data/sgsdeck/raw.json", "mcp-worker/test/x.test.ts", "mcp-worker/README.md", "docs/deployment.md"]) {
      expect(triggers(paths, ignored), `push.paths không được chứa ${ignored}`).toBe(false);
    }
  });

  it("chỉ release từ main: push, hoặc dispatch xác nhận exact SHA; tuần tự, không huỷ giữa chừng", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    expect(workflow).toMatch(/^ {2}push:\n {4}branches: \[main\]$/mu);
    expect(workflow).toContain(
      "if: github.ref == 'refs/heads/main' && (github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && inputs.confirm_production == true))",
    );
    expect(workflow).toContain("group: tqccl-mcp-production-release");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toMatch(/timeout-minutes: \d+/u);
    expect(workflow).not.toContain("environment: mcp-production");
    const production = productionJob(workflow);
    const manualApproval = production.indexOf("Verify manual exact-SHA approval");
    const target = production.indexOf("id: tip");
    const edgeControl = production.indexOf("Verify live edge control");
    expect(manualApproval).toBeGreaterThan(-1);
    expect(manualApproval).toBeLessThan(target);
    const approvalStep = production.slice(manualApproval, target);
    expect(approvalStep).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(approvalStep).toContain('[[ "$TQCCL_APPROVED_SHA" =~ ^[0-9a-f]{40}$ ]]');
    expect(approvalStep).toContain('test "$TQCCL_APPROVED_SHA" = "$GITHUB_SHA"');
    expect(approvalStep).toContain('test "$TQCCL_APPROVED_SHA" = "$(git rev-parse origin/main)"');
    expect(production.slice(manualApproval, edgeControl)).not.toContain("secrets.");
  });

  it("push không có inputs vẫn truyền đúng \"true\"/\"false\" cho script release", async () => {
    const production = productionJob(await readFile(workflowUrl, "utf8"));
    expect(production).toContain("TQCCL_FIRST_RELEASE_BOOTSTRAP: ${{ inputs.bootstrap_first_release || false }}");
    expect(production).toContain("TQCCL_REHEARSE_ROLLBACK: ${{ inputs.rehearse_rollback || false }}");
    expect(production).not.toMatch(/: \$\{\{ inputs\.(?:bootstrap_first_release|rehearse_rollback) \}\}/u);
  });

  it("run bị bỏ qua vì có push mới hơn đang chờ không chạy bước nào sau khi chọn target", async () => {
    const production = productionJob(await readFile(workflowUrl, "utf8"));
    const steps = production.slice(production.indexOf("id: tip")).split(/\n {6}- /u).slice(1);
    expect(steps.length).toBeGreaterThan(10);
    for (const step of steps) {
      expect(step, step.split("\n")[0]).toContain("steps.tip.outputs.release == 'true'");
    }
  });

  it("bootstrap lần đầu là opt-in và secret file tạm luôn được xóa", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    const production = productionJob(workflow);
    expect(workflow).toContain("bootstrap_first_release:");
    expect(production).toContain("--secrets-file");
    expect(production).toContain("if: steps.tip.outputs.release == 'true' && env.TQCCL_FIRST_RELEASE_BOOTSTRAP == 'true'");
    expect(production).toContain("if: steps.tip.outputs.release == 'true' && env.TQCCL_FIRST_RELEASE_BOOTSTRAP != 'true'");
    expect(production).toContain("umask 077");
    expect(production).toContain("trap cleanup EXIT");
    expect(production).not.toContain("echo $TQCCL_MCP_BEARER_CURRENT");
    const normalUpload = production.slice(
      production.indexOf("id: version_upload"),
      production.indexOf("Apply Worker Custom Domain"),
    );
    expect(normalUpload).not.toContain("TQCCL_MCP_BEARER_CURRENT");
  });

  it("gate Worker, dry-run, preflight trước upload; Custom Domain sẵn sàng trước promote", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    const production = productionJob(workflow);
    const order = [
      "build:worker-assets",
      "verify:worker-assets",
      "npm run check",
      "test:worker",
      "deploy:dry-run",
      "verify-control-plane.ts --live",
      "preflight:worker-release",
      "wrangler versions upload",
      "wrangler triggers deploy",
      "Wait for Worker Custom Domain readiness",
      "release:worker",
    ].map(marker => production.indexOf(marker));
    expect(order.every(index => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));
    expect(production).toContain("TQCCL_RELEASE_RUN_ID:");
    expect(workflow).not.toMatch(/npm publish|stage:data-release|activate:data-release/u);
    expect(workflow).not.toMatch(/TQCCL_R2_|R2_BUCKET/u);
  });

  it("monitor chỉ đọc edge control", async () => {
    const monitor = await readFile(monitorUrl, "utf8");
    expect(monitor).toContain("MCP edge security monitor");
    expect(monitor).toContain("verify-control-plane.ts --live");
    expect(monitor).not.toMatch(/R2|BUCKET|AWS_/u);
  });
});
