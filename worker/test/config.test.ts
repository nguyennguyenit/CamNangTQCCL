import { describe, it, expect } from "vitest";
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
  it("FEATURE_ENABLED=false -> kill-switch", () => {
    expect(loadConfig({ ...base, FEATURE_ENABLED: "false" }).featureEnabled).toBe(false);
  });
});
