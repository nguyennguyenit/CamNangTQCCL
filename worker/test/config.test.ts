import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig, type Env } from "../src/config";

// loadConfig không đụng KV; binding giả chỉ để khớp kiểu Env.
const base: Env = { TURNSTILE_SECRET: "s", RL: {} as unknown as KVNamespace };

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

describe("ALLOWED_ORIGINS", () => {
  it("tách danh sách phân cách dấu phẩy, bỏ khoảng trắng và mục rỗng", () => {
    expect(loadConfig({ ...base, ALLOWED_ORIGINS: " https://tqccl.com, https://www.tqccl.com ,," }).allowedOrigins).toEqual([
      "https://tqccl.com",
      "https://www.tqccl.com",
    ]);
  });
  it("thiếu hoặc rỗng -> danh sách rỗng (fail-closed), không mở thành '*'", () => {
    expect(loadConfig(base).allowedOrigins).toEqual([]);
    expect(loadConfig({ ...base, ALLOWED_ORIGINS: "" }).allowedOrigins).toEqual([]);
  });
  it("'*' là chế độ dev tường minh", () => {
    expect(loadConfig({ ...base, ALLOWED_ORIGINS: "*" }).allowedOrigins).toBe("*");
  });
  it("wrangler.toml khai đủ ba origin của site", () => {
    const wrangler = readFileSync(fileURLToPath(new URL("../wrangler.toml", import.meta.url)), "utf8");
    expect(wrangler).toContain('ALLOWED_ORIGINS = "https://tqccl.com,https://www.tqccl.com,https://tqccl.pages.dev"');
    expect(wrangler).not.toMatch(/^ALLOWED_ORIGIN\s*=/mu);
  });
});
