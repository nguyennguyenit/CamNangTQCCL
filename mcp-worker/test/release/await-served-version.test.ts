import { describe, expect, it } from "vitest";

import { awaitServedVersion } from "../../scripts/await-served-version.js";
import { WORKER_VERSION_HEADER } from "../../src/transport/worker-version-header.js";

const endpoint = new URL("https://mcp.example/mcp");

type Served = { status?: number; version: string | null };

/** Fetcher trả lần lượt các response cho trước (mặc định 405); hết danh sách thì lặp response cuối. */
function servedSequence(responses: Served[], onFetch: () => void = () => undefined) {
  const seen: Request[] = [];
  let index = 0;
  const fetcher: typeof fetch = async (input, init) => {
    onFetch();
    seen.push(new Request(input, init));
    const served = responses[Math.min(index++, responses.length - 1)] ?? { version: null };
    return new Response(null, {
      status: served.status ?? 405,
      headers: served.version === null ? {} : { [WORKER_VERSION_HEADER]: served.version },
    });
  };
  return { fetcher, seen };
}

function clock() {
  let now = 0;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

const v = (version: string | null, status?: number): Served => (status === undefined ? { version } : { status, version });

describe("awaitServedVersion", () => {
  it("chờ tới khi production trả đúng version đủ số lần liên tiếp, lẫn version cũ thì đếm lại", async () => {
    // Ngay sau promote, edge còn trả xen kẽ version cũ (release 2026-10-15, run 38743557129).
    const { fetcher, seen } = servedSequence([v("old"), v("new"), v("old"), v("new"), v("new"), v("new")]);
    const time = clock();
    const stats = await awaitServedVersion({ endpoint, bearer: "token", versionId: "new", consecutive: 3, minStableMs: 0, timeoutMs: 60_000, fetcher, now: time.now, sleep: async (ms) => time.advance(ms) });
    expect(seen).toHaveLength(6);
    expect(seen.every((request) => request.headers.get("Authorization") === "Bearer token")).toBe(true);
    expect(stats).toEqual({ probes: 6, otherVersion: 2, statuses: { "405": 6 } });
  });

  it("response 429 mang đúng header không được tính là đã phục vụ", async () => {
    // Worker gắn header version cả vào 429 RATE_LIMITED; chỉ 405 của GET mới chứng minh version đang phục vụ.
    const { fetcher } = servedSequence([v("new", 429), v("new", 429), v("new"), v("new"), v("new")]);
    const time = clock();
    const stats = await awaitServedVersion({ endpoint, bearer: "token", versionId: "new", consecutive: 3, minStableMs: 0, timeoutMs: 60_000, fetcher, now: time.now, sleep: async (ms) => time.advance(ms) });
    expect(stats).toEqual({ probes: 5, otherVersion: 0, statuses: { "405": 3, "429": 2 } });
  });

  it("chuỗi đúng phải kéo dài đủ lâu, không chỉ đủ số lần", async () => {
    // Run 38784835089: 5 lần đúng liên tiếp (~5,5 s) rồi verifier vẫn gặp response khác ngay sau đó.
    const time = clock();
    const { fetcher } = servedSequence([v("new")], () => time.advance(1_100));
    const stats = await awaitServedVersion({ endpoint, bearer: "token", versionId: "new", consecutive: 3, minStableMs: 10_000, timeoutMs: 60_000, fetcher, now: time.now, sleep: async (ms) => time.advance(ms) });
    // Chuỗi bắt đầu ở lần thăm dò đầu; mỗi vòng tốn 1,1 s fetch + 0,25 s nghỉ.
    expect(stats.probes).toBe(9);
  });

  it("ổn định kịp trước hạn thì qua; hết hạn mà vẫn version cũ thì báo lỗi", async () => {
    const time = clock();
    const { fetcher } = servedSequence([v("old"), v("new")], () => time.advance(1_100));
    await expect(
      awaitServedVersion({ endpoint, bearer: "token", versionId: "new", consecutive: 3, minStableMs: 0, timeoutMs: 5_000, fetcher, now: time.now, sleep: async (ms) => time.advance(ms) }),
    ).resolves.toMatchObject({ probes: 4 });

    const stuckTime = clock();
    const stuck = servedSequence([v("old")], () => stuckTime.advance(1_100));
    await expect(
      awaitServedVersion({ endpoint, bearer: "token", versionId: "new", consecutive: 3, minStableMs: 0, timeoutMs: 5_000, fetcher: stuck.fetcher, now: stuckTime.now, sleep: async (ms) => stuckTime.advance(ms) }),
    ).rejects.toThrow();
  });
});
