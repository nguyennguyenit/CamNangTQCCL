import { setTimeout as delay } from "node:timers/promises";

import { WORKER_VERSION_HEADER } from "../src/transport/worker-version-header.js";

/** Thống kê một lần chờ, ghi vào deployment evidence (không có nội dung response). */
export interface ServedVersionStats {
  probes: number;
  /** Số response 405 mang version khác (edge còn phục vụ version cũ). */
  otherVersion: number;
  /** Số response theo HTTP status. */
  statuses: Record<string, number>;
}

/**
 * Chờ production thật sự phục vụ `versionId` trước khi xác minh.
 *
 * Cloudflare trả về deployment mới ngay, nhưng edge còn phục vụ xen kẽ version cũ một lúc; verifier gặp
 * version cũ giữa chừng sẽ fail và kéo theo rollback (release 2026-10-15, run 38743557129). Mỗi lần thăm dò là
 * GET /mcp có bearer; chỉ 405 kèm đúng header mới tính, vì Worker gắn header version cả vào 429 RATE_LIMITED.
 * Đi qua fetcher đã pacing nên không vượt edge rule; gặp 429 thì nghỉ theo Retry-After (tối đa 60 giây).
 */
export async function awaitServedVersion(options: {
  endpoint: URL;
  bearer: string;
  versionId: string;
  fetcher: typeof fetch;
  consecutive?: number;
  /** Chuỗi đúng phải kéo dài ít nhất chừng này, tính từ response đúng đầu tiên của chuỗi. */
  minStableMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}): Promise<ServedVersionStats> {
  const consecutive = options.consecutive ?? 5;
  const minStableMs = options.minStableMs ?? 20_000;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((delayMs: number) => delay(delayMs));
  const deadline = now() + timeoutMs;
  const stats: ServedVersionStats = { probes: 0, otherVersion: 0, statuses: {} };
  let streak = 0;
  let streakStart = 0;
  while (now() <= deadline) {
    const response = await options.fetcher(
      new Request(options.endpoint, { method: "GET", headers: { Authorization: `Bearer ${options.bearer}` } }),
    );
    await response.body?.cancel();
    stats.probes += 1;
    stats.statuses[String(response.status)] = (stats.statuses[String(response.status)] ?? 0) + 1;
    const version = response.headers.get(WORKER_VERSION_HEADER);
    if (response.status === 405 && version !== null && version !== options.versionId) stats.otherVersion += 1;
    if (response.status === 405 && version === options.versionId) {
      if (streak === 0) streakStart = now();
      streak += 1;
    } else {
      streak = 0;
    }
    if (streak >= consecutive && now() - streakStart >= minStableMs) return stats;
    const retryAfter = response.status === 429 ? Number(response.headers.get("Retry-After")) : Number.NaN;
    // Fetcher pacing đã giãn request /mcp; nghỉ thêm để không quay vòng nhanh nếu fetcher không pacing.
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1_000 : 250);
  }
  throw new Error("Production chưa phục vụ ổn định version mong đợi.");
}
