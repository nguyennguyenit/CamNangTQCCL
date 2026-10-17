// Kiểu Hono dùng chung + phụ thuộc có thể thay khi test (phiên, fetch, đồng hồ, id).

import type { Context } from "hono";
import { toSessionUser, type SessionUser, type SessionUserRow } from "./auth";
import { isAdminEmail, type Env } from "./env";
import { ApiError } from "./http";

export interface AppDeps {
  /** Đọc dòng user thô từ cookie phiên (mặc định Better Auth); khoá do toSessionUser quyết định. */
  getUser(env: Env, headers: Headers): Promise<SessionUserRow | null>;
  /** Xử lý /api/auth/* (mặc định Better Auth handler). */
  authHandler(env: Env, request: Request): Promise<Response>;
  fetchImpl: typeof fetch;
  now(): number;
  newId(): string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    deps: AppDeps;
    user: SessionUser | null | undefined;
  };
}

export type Ctx = Context<AppEnv>;

export type Role = "root" | "moderator" | "user";

export interface Viewer {
  user: SessionUser;
  role: Role;
}

const LAST_SEEN_THROTTLE_MS = 600_000;

/** User hiện tại (tra phiên một lần mỗi request); tài khoản bị khoá/đang xoá -> null. */
export async function currentUser(c: Ctx): Promise<SessionUser | null> {
  let user = c.get("user");
  if (user === undefined) {
    const deps = c.get("deps");
    const now = deps.now();
    user = toSessionUser(await deps.getUser(c.env, c.req.raw.headers), now);
    c.set("user", user);
    if (user && (user.lastSeenAt === null || now - user.lastSeenAt > LAST_SEEN_THROTTLE_MS)) {
      c.executionCtx.waitUntil(
        c.env.DB.prepare('update "user" set last_seen_at = ? where id = ?')
          .bind(now, user.id)
          .run()
          .catch((err) => console.error("last_seen_at update failed", err)),
      );
    }
  }
  return user;
}

/** Vai trò hiệu lực: root (ADMIN_EMAILS) thắng `user.role`. */
export function effectiveRole(env: Env, user: SessionUser): Role {
  return isAdminEmail(env, user.email) ? "root" : user.role;
}

export async function requireUser(c: Ctx): Promise<Viewer> {
  const user = await currentUser(c);
  if (!user) throw new ApiError(401, "unauthorized", "Cần đăng nhập");
  return { user, role: effectiveRole(c.env, user) };
}

/** Root hoặc kiểm duyệt viên. */
export async function requireStaff(c: Ctx): Promise<Viewer> {
  const viewer = await requireUser(c);
  if (viewer.role === "user") throw new ApiError(403, "forbidden", "Chỉ quản trị viên được thao tác");
  return viewer;
}

/** Chỉ root (ADMIN_EMAILS). */
export async function requireRoot(c: Ctx): Promise<Viewer> {
  const viewer = await requireUser(c);
  if (viewer.role !== "root") throw new ApiError(403, "forbidden", "Chỉ quản trị viên được thao tác");
  return viewer;
}

export const PAGE_SIZE = 20;
