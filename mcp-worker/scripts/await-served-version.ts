import { setTimeout as delay } from "node:timers/promises";

import { WORKER_VERSION_HEADER } from "../src/transport/worker-version-header.js";

/**
 * Chờ production thật sự phục vụ `versionId` trước khi xác minh không override.
 *
 * Cloudflare trả về deployment mới ngay, nhưng edge còn phục vụ xen kẽ version cũ một lúc; verifier gặp
 * version cũ giữa chừng sẽ fail và kéo theo rollback (release 2026-10-15, run 38743557129). Mỗi lần thăm dò là
 * GET /mcp có bearer (405 kèm header version, không chạy tool); đi qua fetcher đã pacing nên không vượt edge rule.
 */
export async function awaitServedVersion(options: {
  endpoint: URL;
  bearer: string;
  versionId: string;
  fetcher: typeof fetch;
  consecutive?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}): Promise<void> {
  const consecutive = options.consecutive ?? 5;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((delayMs: number) => delay(delayMs));
  const deadline = now() + timeoutMs;
  let streak = 0;
  while (now() <= deadline) {
    const response = await options.fetcher(
      new Request(options.endpoint, { method: "GET", headers: { Authorization: `Bearer ${options.bearer}` } }),
    );
    await response.body?.cancel();
    streak = response.headers.get(WORKER_VERSION_HEADER) === options.versionId ? streak + 1 : 0;
    if (streak >= consecutive) return;
    // Fetcher pacing đã giãn request /mcp; nghỉ thêm để không quay vòng nhanh nếu fetcher không pacing.
    await sleep(250);
  }
  throw new Error("Production chưa phục vụ ổn định version mong đợi.");
}
