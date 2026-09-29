// Ứng dụng Hono: Better Auth ở /api/auth/*, chặn CSRF theo Origin, lỗi JSON chuẩn, gắn các route.

import { Hono } from "hono";
import { createAuth, getSessionUser } from "./auth";
import { currentUser, type AppDeps, type AppEnv } from "./context";
import { isAdminEmail, requestOrigin, trustedOrigins } from "./env";
import { ApiError, errorResponse } from "./http";
import { ai } from "./routes/ai";
import { feedback } from "./routes/feedback";
import { comments } from "./routes/comments";
import { posts } from "./routes/posts";
import { recruit } from "./routes/recruit";
import { reports } from "./routes/reports";

export const defaultDeps: AppDeps = {
  getUser: getSessionUser,
  authHandler: (env, request) => createAuth(env, requestOrigin(env, request)).handler(request),
  fetchImpl: (input, init) => fetch(input, init),
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
};

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

export function createApp(overrides: Partial<AppDeps> = {}) {
  const deps: AppDeps = { ...defaultDeps, ...overrides };
  const app = new Hono<AppEnv>();

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      const res = errorResponse(err.status, err.code, err.message);
      if (err.retryAfter) res.headers.set("Retry-After", String(err.retryAfter));
      return res;
    }
    console.error("community-worker error", c.req.method, c.req.path, err);
    return errorResponse(500, "internal_error", "Lỗi máy chủ, thử lại sau");
  });
  app.notFound(() => errorResponse(404, "not_found", "Không tìm thấy"));

  app.use("*", async (c, next) => {
    c.set("deps", deps);
    await next();
  });

  // Better Auth tự kiểm Origin/CSRF và rate limit cho các route của nó.
  app.on(["GET", "POST"], "/api/auth/*", (c) => deps.authHandler(c.env, c.req.raw));

  app.use("/api/*", async (c, next) => {
    if (!SAFE_METHODS.includes(c.req.method)) {
      // Trình duyệt luôn gửi Origin cho POST/PUT/DELETE: khác origin tin cậy -> chặn CSRF.
      const origin = c.req.header("origin");
      const fetchSite = c.req.header("sec-fetch-site");
      if ((origin && !trustedOrigins(c.env).includes(origin)) || fetchSite === "cross-site") {
        throw new ApiError(403, "forbidden_origin", "Origin không được phép");
      }
    }
    await next();
    if (!c.res.headers.has("Cache-Control")) c.res.headers.set("Cache-Control", "no-store");
  });

  app.get("/api/me", async (c) => {
    const user = await currentUser(c);
    return c.json({
      user: user
        ? { id: user.id, name: user.name, email: user.email, image: user.image, isAdmin: isAdminEmail(c.env, user.email) }
        : null,
    });
  });

  app.route("/", comments);
  app.route("/", feedback);
  app.route("/", reports);
  app.route("/", posts);
  app.route("/", recruit);
  app.route("/", ai);
  return app;
}
