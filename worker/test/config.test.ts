import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveEndpoint, loadConfig } from "../src/config";

const base: any = { QWEN_API_KEY: "k", TURNSTILE_SECRET: "s", RL: {} };

describe("resolveEndpoint (hỗ trợ cả 2 region)", () => {
  it("mặc định intl (Singapore)", () => {
    expect(resolveEndpoint(base)).toContain("dashscope-intl");
  });
  it("REGION=cn -> mainland", () => {
    expect(resolveEndpoint({ ...base, REGION: "cn" })).toContain("dashscope.aliyuncs.com");
    expect(resolveEndpoint({ ...base, REGION: "cn" })).not.toContain("intl");
  });
  it("MODEL_ENDPOINT override hẳn REGION", () => {
    expect(resolveEndpoint({ ...base, REGION: "cn", MODEL_ENDPOINT: "https://x/y" })).toBe("https://x/y");
  });
  it("REGION lạ -> fallback intl", () => {
    expect(resolveEndpoint({ ...base, REGION: "moon" })).toContain("dashscope-intl");
  });
});

describe("loadConfig", () => {
  it("default featureEnabled=true + cap số", () => {
    const c = loadConfig(base);
    expect(c.featureEnabled).toBe(true);
    expect(c.dailyCap).toBeGreaterThan(0);
  });
  it("default model là Qwen vision", () => {
    expect(loadConfig(base).modelId).toBe("qwen3.7-plus");
  });
  it("FEATURE_ENABLED=false -> kill-switch", () => {
    expect(loadConfig({ ...base, FEATURE_ENABLED: "false" }).featureEnabled).toBe(false);
  });
});

describe("wrangler production vars", () => {
  const wranglerPath = fileURLToPath(new URL("../wrangler.toml", import.meta.url));
  const wrangler = readFileSync(wranglerPath, "utf8");

  it("không trỏ sang Coding endpoint thay cho DashScope Model Studio", () => {
    expect(wrangler).not.toContain("coding-intl.dashscope.aliyuncs.com");
    expect(wrangler).toContain('REGION = "intl"');
  });

  it("dùng model vision cho phân tích ảnh", () => {
    expect(wrangler).toContain('MODEL_ID = "qwen3.7-plus"');
  });
});
