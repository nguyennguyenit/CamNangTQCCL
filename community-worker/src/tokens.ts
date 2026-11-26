// Token API cá nhân (personal access token): sinh, băm, xác thực `Authorization: Bearer`.
// Token = `tqccl_pat_` + 32 byte ngẫu nhiên (base64url); D1 chỉ giữ SHA-256 hex.

import type { Ctx } from "./context";
import { ApiError } from "./http";
import { isBlocked } from "./moderation";

export const API_TOKEN_PREFIX = "tqccl_pat_";
export const API_TOKEN_MAX_ACTIVE = 10;
export const API_TOKEN_SCOPES = ["recruit:write"] as const;
export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];
/** Hạn cho phép khi tạo (ngày); null = không hạn. */
export const API_TOKEN_TTL_DAYS = [30, 90, 365, null] as const;
export const API_TOKEN_DEFAULT_TTL_DAYS = 90;
/** Token đã thu hồi / hết hạn quá số ngày này thì bị xoá khi chính chủ tạo token mới (không cần cron). */
export const API_TOKEN_PURGE_AFTER_DAYS = 30;

const LAST_USED_THROTTLE_MS = 600_000;
const BEARER_RE = /^Bearer\s+(\S+)$/iu;

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return API_TOKEN_PREFIX + btoa(bin).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

/** Token thô trong header Authorization; không có / không phải Bearer -> null. */
export function bearerToken(headers: Headers): string | null {
  return BEARER_RE.exec(headers.get("authorization") ?? "")?.[1] ?? null;
}

export interface TokenPrincipal {
  userId: string;
  tokenId: string;
}

interface TokenRow {
  id: string;
  user_id: string;
  scope: string;
  last_used_at: number | null;
  expires_at: number | null;
  revoked_at: number | null;
  banned_until: number | null;
  deleting_at: number | null;
}

/**
 * Xác thực Bearer cho đúng scope: thiếu/sai/thu hồi/hết hạn/sai scope -> 401 `invalid_token`;
 * user bị khoá hoặc đang xoá -> 403 `account_blocked`.
 */
export async function requireToken(c: Ctx, scope: ApiTokenScope): Promise<TokenPrincipal> {
  const invalid = new ApiError(401, "invalid_token", "Token không hợp lệ, đã thu hồi hoặc hết hạn");
  const token = bearerToken(c.req.raw.headers);
  if (!token?.startsWith(API_TOKEN_PREFIX)) throw invalid;
  const now = c.get("deps").now();
  const row = await c.env.DB.prepare(
    "select t.id, t.user_id, t.scope, t.last_used_at, t.expires_at, t.revoked_at, u.banned_until, u.deleting_at " +
      'from api_tokens t join "user" u on u.id = t.user_id where t.token_hash = ?',
  )
    .bind(await hashToken(token))
    .first<TokenRow>();
  if (!row || row.scope !== scope || row.revoked_at !== null || (row.expires_at !== null && row.expires_at <= now)) throw invalid;
  if (isBlocked({ bannedUntil: row.banned_until, deletingAt: row.deleting_at }, now)) {
    throw new ApiError(403, "account_blocked", "Tài khoản đang bị khoá");
  }
  if (row.last_used_at === null || now - row.last_used_at > LAST_USED_THROTTLE_MS) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare("update api_tokens set last_used_at = ? where id = ?")
        .bind(now, row.id)
        .run()
        .catch((err) => console.error("api_tokens last_used_at update failed", err)),
    );
  }
  return { userId: row.user_id, tokenId: row.id };
}
