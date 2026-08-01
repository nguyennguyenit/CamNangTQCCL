import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const workflowUrl = new URL(
  "../../../.github/workflows/mcp-worker.yml",
  import.meta.url,
);
const monitorUrl = new URL(
  "../../../.github/workflows/mcp-edge-security-monitor.yml",
  import.meta.url,
);

describe("production Worker release workflow", () => {
  it("chỉ release khi manual dispatch main, sau protected approval và tuần tự", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("environment: mcp-production");
    expect(workflow).toContain("group: tqccl-mcp-production-release");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"');
    expect(workflow).toContain("deployments: read");
    const production = workflow.slice(workflow.indexOf("production-release:"));
    const protectedEnvironment = production.indexOf(
      "Verify protected production environment",
    );
    const edgeControl = production.indexOf("Verify live edge control");
    const upload = production.indexOf("Upload immutable Worker version");
    expect(protectedEnvironment).toBeGreaterThan(-1);
    expect(protectedEnvironment).toBeLessThan(edgeControl);
    expect(protectedEnvironment).toBeLessThan(upload);
    const protectionStep = production.slice(protectedEnvironment, edgeControl);
    expect(protectionStep).toContain("required_reviewers");
    expect(protectionStep).toContain("GH_TOKEN: ${{ github.token }}");
    expect(protectionStep).not.toContain("secrets.");
  });

  it("bootstrap lần đầu là opt-in và secret file tạm luôn được xóa", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    const production = workflow.slice(workflow.indexOf("production-release:"));
    expect(workflow).toContain("bootstrap_first_release:");
    expect(workflow).toContain("type: boolean");
    expect(workflow).toContain("default: false");
    expect(production).toContain("TQCCL_FIRST_RELEASE_BOOTSTRAP:");
    expect(production).toContain("--secrets-file");
    expect(production).toContain("umask 077");
    expect(production).toContain("trap cleanup EXIT");
    expect(production).not.toContain("echo $TQCCL_MCP_BEARER_CURRENT");
  });

  it("build/verify/gate/dry-run trước upload và release không dùng npm/R2", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    const production = workflow.slice(workflow.indexOf("production-release:"));
    const build = production.indexOf("build:worker-assets");
    const evidence = production.indexOf("verify:worker-assets");
    const workerd = production.indexOf("test:worker");
    const gate = production.indexOf("check:repository", evidence);
    const upload = production.indexOf("wrangler versions upload");
    const release = production.indexOf("release:worker");
    expect(build).toBeGreaterThan(-1);
    expect(evidence).toBeGreaterThan(build);
    expect(workerd).toBeGreaterThan(evidence);
    expect(gate).toBeGreaterThan(workerd);
    expect(upload).toBeGreaterThan(gate);
    expect(release).toBeGreaterThan(upload);
    expect(production).toContain("TQCCL_RELEASE_RUN_ID:");
    expect(production).toContain("if: always()");
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
