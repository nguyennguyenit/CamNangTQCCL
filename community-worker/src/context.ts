// Kiểu Hono dùng chung + phụ thuộc có thể thay khi test (phiên, fetch, đồng hồ, id).

import type { Context } from "hono";
import type { SessionUser } from "./auth";
import { isAdminEmail, type Env } from "./env";
import { ApiError } from "./http";

export interface AppDeps {
  /** Đọc user từ cookie phiên (mặc định Better Auth). */
  getUser(env: Env, headers: Headers): Promise<SessionUser | null>;
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

export interface Viewer {
  user: SessionUser;
  isAdmin: boolean;
}

/** User hiện tại (tra phiên một lần mỗi request). */
export async function currentUser(c: Ctx): Promise<SessionUser | null> {
  let user = c.get("user");
  if (user === undefined) {
    user = await c.get("deps").getUser(c.env, c.req.raw.headers);
    c.set("user", user);
  }
  return user;
}

export async function requireUser(c: Ctx): Promise<Viewer> {
  const user = await currentUser(c);
  if (!user) throw new ApiError(401, "unauthorized", "Cần đăng nhập");
  return { user, isAdmin: isAdminEmail(c.env, user.email) };
}

export async function requireAdmin(c: Ctx): Promise<Viewer> {
  const viewer = await requireUser(c);
  if (!viewer.isAdmin) throw new ApiError(403, "forbidden", "Chỉ quản trị viên được thao tác");
  return viewer;
}

export const PAGE_SIZE = 20;
