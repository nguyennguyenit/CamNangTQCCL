// Quản lý token API cá nhân (cần cookie phiên): tạo (trả token thô đúng một lần), liệt kê, thu hồi.

import { Hono } from "hono";
import { requireUser, type AppEnv } from "../context";
import { ApiError } from "../http";
import { consumeRateLimit } from "../ratelimit";
import {
  API_TOKEN_DEFAULT_TTL_DAYS,
  API_TOKEN_MAX_ACTIVE,
  API_TOKEN_PURGE_AFTER_DAYS,
  API_TOKEN_TTL_DAYS,
  generateToken,
  hashToken,
} from "../tokens";
import { parseText, readJson } from "../validate";

const DAY_MS = 86_400_000;
const NAME_MAX = 40;

interface TokenRow {
  id: string;
  name: string;
  hint: string;
  scope: string;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
  revoked_at: number | null;
}

const COLUMNS = "id, name, hint, scope, created_at, last_used_at, expires_at, revoked_at";

const view = (r: TokenRow) => ({
  id: r.id,
  name: r.name,
  hint: r.hint,
  scope: r.scope,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
  expiresAt: r.expires_at,
  revokedAt: r.revoked_at,
});

function parseTtlDays(value: unknown): number | null {
  if (value === undefined) return API_TOKEN_DEFAULT_TTL_DAYS;
  if (!(API_TOKEN_TTL_DAYS as readonly unknown[]).includes(value)) {
    throw new ApiError(400, "invalid_expiresInDays", "expiresInDays phải là 30, 90, 365 hoặc null");
  }
  return value as number | null;
}

export const tokens = new Hono<AppEnv>();

tokens.get("/api/tokens", async (c) => {
  const { user } = await requireUser(c);
  const { results } = await c.env.DB.prepare(
    `select ${COLUMNS} from api_tokens where user_id = ? order by created_at desc, id desc`,
  )
    .bind(user.id)
    .all<TokenRow>();
  return c.json({ items: results.map(view) });
});

tokens.post("/api/tokens", async (c) => {
  const { user } = await requireUser(c);
  const input = await readJson(c.req.raw);
  const name = parseText(input.name, "name", 1, NAME_MAX);
  const ttlDays = parseTtlDays(input.expiresInDays);
  const deps = c.get("deps");
  const now = deps.now();
  const db = c.env.DB;
  await consumeRateLimit(db, "token_create", user.id, now);
  // Dọn cơ hội: chỉ token của chính user này đã thu hồi / hết hạn quá hạn lưu; token còn hiệu lực không bao giờ khớp.
  // Tra theo api_tokens_user_idx (user_id) nên chỉ đọc vài hàng token của user, không cần cron trigger.
  const purgeBefore = now - API_TOKEN_PURGE_AFTER_DAYS * DAY_MS;
  await db
    .prepare("delete from api_tokens where user_id = ? and ((revoked_at is not null and revoked_at < ?) or (expires_at is not null and expires_at < ?))")
    .bind(user.id, purgeBefore, purgeBefore)
    .run();
  const token = generateToken();
  const row: TokenRow = {
    id: deps.newId(),
    name,
    hint: token.slice(-4),
    scope: "recruit:write",
    created_at: now,
    last_used_at: null,
    expires_at: ttlDays === null ? null : now + ttlDays * DAY_MS,
    revoked_at: null,
  };
  // Kiểm trần ngay trong câu ghi: hai request song song không cùng qua được (D1 ghi tuần tự từng câu).
  const { meta } = await db
    .prepare(
      "insert into api_tokens (id, user_id, name, token_hash, hint, scope, created_at, expires_at) " +
        "select ?, ?, ?, ?, ?, ?, ?, ? where (select count(*) from api_tokens " +
        "where user_id = ? and revoked_at is null and (expires_at is null or expires_at > ?)) < ?",
    )
    .bind(row.id, user.id, row.name, await hashToken(token), row.hint, row.scope, row.created_at, row.expires_at, user.id, now, API_TOKEN_MAX_ACTIVE)
    .run();
  if (!meta.changes) {
    throw new ApiError(409, "token_limit", `Tối đa ${API_TOKEN_MAX_ACTIVE} token còn hiệu lực; thu hồi bớt token cũ`);
  }
  return c.json({ token, item: view(row) }, 201);
});

tokens.delete("/api/tokens/:id", async (c) => {
  const { user } = await requireUser(c);
  const id = c.req.param("id");
  const db = c.env.DB;
  // Thu hồi lại token đã thu hồi giữ mốc cũ (coalesce) để idempotent.
  const res = await db
    .prepare("update api_tokens set revoked_at = coalesce(revoked_at, ?) where id = ? and user_id = ?")
    .bind(c.get("deps").now(), id, user.id)
    .run();
  if (!res.meta.changes) throw new ApiError(404, "not_found", "Không tìm thấy token");
  return c.json({ ok: true });
});
