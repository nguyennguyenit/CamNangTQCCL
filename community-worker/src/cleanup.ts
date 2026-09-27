// Dọn định kỳ (cron): ảnh chiến báo chờ gửi quá 24 giờ + bộ đếm rate limit hết hạn.

import type { Env } from "./env";

export const PENDING_TTL_MS = 24 * 3_600_000;

/** Xoá object R2 `pending/` và bản ghi upload pending quá hạn; xoá bộ đếm rate limit đã hết cửa sổ. */
export async function cleanup(env: Env, now: number): Promise<{ deletedObjects: number }> {
  const cutoff = now - PENDING_TTL_MS;
  let deletedObjects = 0;
  let cursor: string | undefined;
  do {
    const page = await env.MEDIA.list({ prefix: "pending/", cursor, limit: 1000 });
    const stale = page.objects.filter((o) => o.uploaded.getTime() < cutoff).map((o) => o.key);
    if (stale.length) {
      await env.MEDIA.delete(stale);
      deletedObjects += stale.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await env.DB.batch([
    env.DB.prepare("delete from uploads where status = 'pending' and created_at < ?").bind(cutoff),
    env.DB.prepare("delete from rate_limits where expires_at < ?").bind(now),
  ]);
  return { deletedObjects };
}
