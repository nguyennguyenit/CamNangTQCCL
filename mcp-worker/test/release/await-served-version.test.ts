import { describe, expect, it } from "vitest";

import { awaitServedVersion } from "../../scripts/await-served-version.js";
import { WORKER_VERSION_HEADER } from "../../src/transport/worker-version-header.js";

const endpoint = new URL("https://mcp.example/mcp");

/** Fetcher trả lần lượt các version cho trước (null = không có header); hết danh sách thì lặp version cuối. */
function servedSequence(versions: Array<string | null>) {
  const seen: Request[] = [];
  let index = 0;
  const fetcher: typeof fetch = async (input, init) => {
    seen.push(new Request(input, init));
    const version = versions[Math.min(index++, versions.length - 1)] ?? null;
    return new Response(null, { status: 405, headers: version === null ? {} : { [WORKER_VERSION_HEADER]: version } });
  };
  return { fetcher, seen };
}

function clock() {
  let now = 0;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

describe("awaitServedVersion", () => {
  it("chờ tới khi production trả đúng version đủ số lần liên tiếp, lẫn version cũ thì đếm lại", async () => {
    // Ngay sau promote, edge còn trả xen kẽ version cũ (Dewee release 2026-10-15, run 38743557129).
    const { fetcher, seen } = servedSequence(["old", "new", "old", "new", "new", "new"]);
    const time = clock();
    await awaitServedVersion({ endpoint, bearer: "token", versionId: "new", consecutive: 3, timeoutMs: 60_000, fetcher, now: time.now, sleep: async (ms) => time.advance(ms) });
    expect(seen).toHaveLength(6);
    expect(seen.every((request) => request.headers.get("Authorization") === "Bearer token")).toBe(true);
  });

  it("ổn định kịp trước hạn thì qua; hết hạn mà vẫn version cũ thì báo lỗi", async () => {
    const { fetcher } = servedSequence(["old", "new"]);
    const time = clock();
    const tick: typeof fetch = async (input, init) => {
      time.advance(1_100);
      return fetcher(input, init);
    };
    await expect(
      awaitServedVersion({ endpoint, bearer: "token", versionId: "new", consecutive: 3, timeoutMs: 5_000, fetcher: tick, now: time.now, sleep: async (ms) => time.advance(ms) }),
    ).resolves.toBeUndefined();

    const stuck = servedSequence(["old"]);
    const stuckTime = clock();
    const stuckTick: typeof fetch = async (input, init) => {
      stuckTime.advance(1_100);
      return stuck.fetcher(input, init);
    };
    await expect(
      awaitServedVersion({ endpoint, bearer: "token", versionId: "new", consecutive: 3, timeoutMs: 5_000, fetcher: stuckTick, now: stuckTime.now, sleep: async (ms) => stuckTime.advance(ms) }),
    ).rejects.toThrow();
  });
});
