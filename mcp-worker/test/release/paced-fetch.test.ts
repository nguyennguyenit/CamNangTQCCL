import { describe, expect, it, vi } from "vitest";

import { createPacedMcpFetcher } from "../../scripts/paced-mcp-fetch.js";

describe("createPacedMcpFetcher", () => {
  it("tuần tự hóa request /mcp theo khoảng cách an toàn", async () => {
    let now = 0;
    const starts: number[] = [];
    const waits: number[] = [];
    const fetcher = vi.fn<typeof fetch>(async () => {
      starts.push(now);
      return new Response(null, { status: 204 });
    });
    const paced = createPacedMcpFetcher({
      fetcher,
      minimumIntervalMs: 1_100,
      now: () => now,
      sleep: async (delayMs) => {
        waits.push(delayMs);
        now += delayMs;
      },
    });

    await Promise.all([
      paced("https://mcp.example/mcp"),
      paced("https://mcp.example/mcp"),
      paced("https://mcp.example/mcp"),
    ]);

    expect(starts).toEqual([0, 1_100, 2_200]);
    expect(waits).toEqual([1_100, 1_100]);
  });

  it("không trì hoãn health endpoint ngoài edge rule", async () => {
    let now = 0;
    const starts: number[] = [];
    const paced = createPacedMcpFetcher({
      fetcher: async () => {
        starts.push(now);
        return new Response(null, { status: 204 });
      },
      minimumIntervalMs: 1_100,
      now: () => now,
      sleep: async (delayMs) => {
        now += delayMs;
      },
    });

    await paced("https://mcp.example/healthz");
    await paced("https://mcp.example/healthz");

    expect(starts).toEqual([0, 0]);
  });

  it("không vượt quá 10 request trong bất kỳ cửa sổ 10 giây", async () => {
    let now = 0;
    const starts: number[] = [];
    const paced = createPacedMcpFetcher({
      fetcher: async () => {
        starts.push(now);
        return new Response(null, { status: 204 });
      },
      minimumIntervalMs: 1_100,
      now: () => now,
      sleep: async (delayMs) => {
        now += delayMs;
      },
    });

    await Promise.all(
      Array.from({ length: 25 }, () => paced("https://mcp.example/mcp")),
    );

    for (const end of starts) {
      expect(
        starts.filter((start) => start > end - 10_000 && start <= end).length,
      ).toBeLessThanOrEqual(10);
    }
  });
});
