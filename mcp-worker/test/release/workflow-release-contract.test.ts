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
  it("chỉ release khi manual dispatch xác nhận exact main SHA và tuần tự", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("production_sha:");
    expect(workflow).toContain("confirm_production:");
    expect(workflow).toContain("inputs.confirm_production == true");
    expect(workflow).toContain("group: tqccl-mcp-production-release");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"');
    expect(workflow).toContain('test "$TQCCL_APPROVED_SHA" = "$GITHUB_SHA"');
    expect(workflow).toContain(
      'test "$TQCCL_APPROVED_SHA" = "$(git rev-parse origin/main)"',
    );
    expect(workflow).toContain(
      '[[ "$TQCCL_APPROVED_SHA" =~ ^[0-9a-f]{40}$ ]]',
    );
    expect(workflow).not.toContain("environment: mcp-production");
    expect(workflow).not.toContain("deployments: read");
    const production = workflow.slice(workflow.indexOf("production-release:"));
    const manualApproval = production.indexOf("Verify manual exact-SHA approval");
    const edgeControl = production.indexOf("Verify live edge control");
    const upload = production.indexOf("Upload immutable Worker version");
    expect(manualApproval).toBeGreaterThan(-1);
    expect(manualApproval).toBeLessThan(edgeControl);
    expect(manualApproval).toBeLessThan(upload);
    const approvalStep = production.slice(manualApproval, edgeControl);
    expect(approvalStep).not.toContain("secrets.");
  });

  it("bootstrap lần đầu là opt-in và secret file tạm luôn được xóa", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    const production = workflow.slice(workflow.indexOf("production-release:"));
    expect(workflow).toContain("bootstrap_first_release:");
    expect(workflow).toContain("type: boolean");
    expect(workflow).toContain("default: false");
    expect(production).toContain("TQCCL_FIRST_RELEASE_BOOTSTRAP:");
    expect(production).toContain("--secrets-file");
    expect(production).toContain("id: bootstrap_upload");
    expect(production).toContain("id: version_upload");
    expect(production).toContain("if: inputs.bootstrap_first_release");
    expect(production).toContain("if: ${{ !inputs.bootstrap_first_release }}");
    expect(production).toContain("npx wrangler deploy --strict");
    expect(production).toContain("npx wrangler versions upload --strict");
    expect(production).toContain(
      'npm run read:worker-version-upload -- "$WRANGLER_OUTPUT_FILE_PATH" deploy',
    );
    expect(production).toContain("umask 077");
    expect(production).toContain("trap cleanup EXIT");
    expect(production).not.toContain("echo $TQCCL_MCP_BEARER_CURRENT");
    const normalUpload = production.slice(
      production.indexOf("id: version_upload"),
      production.indexOf("Apply Worker Custom Domain"),
    );
    expect(normalUpload).not.toContain("TQCCL_MCP_BEARER_CURRENT");
  });

  it("áp dụng Custom Domain và rehearsal rollback là opt-in normal-only", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    const production = workflow.slice(workflow.indexOf("production-release:"));
    const preflight = production.indexOf("preflight:worker-release");
    const upload = production.indexOf("wrangler versions upload");
    const triggers = production.indexOf("wrangler triggers deploy");
    const readiness = production.indexOf("Wait for Worker Custom Domain readiness");
    const release = production.indexOf("release:worker");
    expect(workflow).toContain("rehearse_rollback:");
    expect(production).toContain("TQCCL_REHEARSE_ROLLBACK:");
    expect(production).toContain(
      'test "${{ inputs.rehearse_rollback }}" = "false"',
    );
    expect(preflight).toBeGreaterThan(-1);
    expect(preflight).toBeLessThan(upload);
    expect(triggers).toBeGreaterThan(upload);
    expect(readiness).toBeGreaterThan(triggers);
    expect(production).toContain("deadline=$((SECONDS + 120))");
    expect(production).toContain("while ((SECONDS < deadline))");
    expect(production).toContain("--write-out '%{http_code}'");
    expect(production).toContain('if [[ "$status" == "200" ]]');
    expect(readiness).toBeLessThan(release);
    expect(triggers).toBeLessThan(release);
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
