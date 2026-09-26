import { describe, it, expect } from "vitest";
import { checkLimits, commitGlobalUsage, hashIp, timeKeys } from "../src/ratelimit";

// Mock KVNamespace tối thiểu (Map trong bộ nhớ, bỏ qua TTL).
function mockKV(seed: Record<string, string> = {}): any {
  const store = new Map(Object.entries(seed));
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
  };
}

const NOW = new Date("2026-06-22T19:30:00.000Z");
const CFG = { featureEnabled: true, rlPerHour: 3, dailyCap: 10, monthlyCap: 100 };

describe("timeKeys (mốc UTC)", () => {
  it("tách day/month/hour", () => {
    expect(timeKeys(NOW)).toEqual({ day: "2026-06-22", month: "2026-06", hourBucket: "2026-06-22T19" });
  });
});

describe("checkLimits (H5)", () => {
  it("cho qua khi dưới ngưỡng + CHỈ tăng per-IP (H2: chưa tăng global)", async () => {
    const kv = mockKV();
    const r = await checkLimits(kv, "ip1", NOW, CFG);
    expect(r.allowed).toBe(true);
    expect(await kv.get("h:2026-06-22T19:ip1")).toBe("1");
    // [H2] global daily/monthly CHƯA tăng (chờ sau Turnstile).
    expect(await kv.get("d:2026-06-22")).toBeNull();
    expect(await kv.get("m:2026-06")).toBeNull();
  });

  it("commitGlobalUsage tăng daily + monthly (sau Turnstile)", async () => {
    const kv = mockKV();
    await commitGlobalUsage(kv, NOW);
    expect(await kv.get("d:2026-06-22")).toBe("1");
    expect(await kv.get("m:2026-06")).toBe("1");
  });

  it("kill-switch: featureEnabled=false -> 503", async () => {
    const r = await checkLimits(mockKV(), "ip1", NOW, { ...CFG, featureEnabled: false });
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(503);
  });

  it("monthly cap chạm -> 503 (auto-disable)", async () => {
    const kv = mockKV({ "m:2026-06": "100" });
    const r = await checkLimits(kv, "ip1", NOW, CFG);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(503);
  });

  it("daily cap chạm -> 429", async () => {
    const kv = mockKV({ "d:2026-06-22": "10" });
    const r = await checkLimits(kv, "ip1", NOW, CFG);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(429);
  });

  it("per-IP/giờ chạm -> 429, KHÔNG đốt quota global", async () => {
    const kv = mockKV({ "h:2026-06-22T19:ip1": "3" });
    const r = await checkLimits(kv, "ip1", NOW, CFG);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(429);
    // daily/monthly không tăng khi bị chặn ở tầng IP.
    expect(await kv.get("d:2026-06-22")).toBeNull();
  });
});

describe("hashIp (HMAC có khoá, IPv6 gom /64)", () => {
  const SECRET = "secret-a-for-tests";
  const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  it("khác nhau với hai secret khác nhau", async () => {
    expect(await hashIp("203.0.113.7", SECRET)).not.toBe(await hashIp("203.0.113.7", "secret-b-for-tests"));
  });

  it("IPv6 cùng /64 cho cùng giá trị, khác /64 cho giá trị khác", async () => {
    const bucket = await hashIp("2001:db8:1:2::1", SECRET);
    expect(await hashIp("2001:db8:1:2:ffff::9", SECRET)).toBe(bucket);
    expect(await hashIp("2001:0DB8:0001:0002:0:0:0:abcd", SECRET)).toBe(bucket);
    expect(await hashIp("2001:db8:1:3::1", SECRET)).not.toBe(bucket);
    expect(await hashIp("2001:db8::1", SECRET)).not.toBe(bucket);
  });

  it("IPv4 tách theo từng địa chỉ", async () => {
    expect(await hashIp("203.0.113.7", SECRET)).not.toBe(await hashIp("203.0.113.8", SECRET));
    expect(await hashIp("203.0.113.7", SECRET)).toBe(await hashIp("203.0.113.7", SECRET));
  });

  it("không phải SHA-256 trần của IP", async () => {
    const ip = "203.0.113.7";
    const plain = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)));
    const hashed = await hashIp(ip, SECRET);
    expect(hashed).toMatch(/^[0-9a-f]{32}$/);
    expect(plain.startsWith(hashed)).toBe(false);
  });
});
