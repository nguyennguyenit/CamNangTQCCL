// Better Auth thật (dialect D1 trên fake D1) + Google giả lập: chặn đăng nhập tài khoản bị khoá/đang xoá.

import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import { PERMANENT_BAN_UNTIL, signBanNotice } from "../src/moderation";
import { createHarness, ORIGIN, type ApiJson, type Harness } from "./fakes";

const EMAIL = "newbie@example.com";

interface Login {
  status: number;
  /** Cookie phiên nhận được ở callback (rỗng nếu không có phiên). */
  cookie: string;
  auth: ReturnType<typeof createAuth>;
  location: URL;
  sessions: number;
  user: Record<string, unknown> | null;
}

function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** Đăng nhập Google giả lập trên MỘT instance Better Auth (state cookie + verification phải cùng instance). */
interface LoginOptions {
  extraBody?: Record<string, unknown>;
  /** Chạy ngay sau khi hook session.create.before đọc trạng thái khoá (giả lập race). */
  afterHookRead?: () => void;
}

async function googleLogin(h: Harness, { extraBody = {}, afterHookRead }: LoginOptions = {}): Promise<Login> {
  const db = h.env.DB;
  const hookedDb = afterHookRead
    ? ({
        ...db,
        batch: db.batch.bind(db),
        prepare: (sql: string) => {
          const stmt = db.prepare(sql);
          if (!sql.includes("select banned_until, deleting_at")) return stmt;
          return {
            bind: (...values: unknown[]) => {
              const bound = stmt.bind(...values);
              return {
                first: async (...args: unknown[]) => {
                  const row = await (bound.first as (...a: unknown[]) => Promise<unknown>)(...args);
                  afterHookRead();
                  return row;
                },
              };
            },
          };
        },
      } as unknown as D1Database)
    : db;
  const env = { ...h.env, DB: hookedDb, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" };
  const auth = createAuth(env, ORIGIN);
  const ctx = await auth.$context;
  const google = (ctx.socialProviders as { id: string; validateAuthorizationCode: unknown; getUserInfo: unknown }[]).find((p) => p.id === "google");
  if (!google) throw new Error("google provider missing");
  google.validateAuthorizationCode = async () => ({ accessToken: "fake-access", tokenType: "Bearer" });
  google.getUserInfo = async () => ({
    user: { id: "google-newbie", name: "Newbie", email: EMAIL, emailVerified: true, image: null },
    data: { sub: "google-newbie" },
  });

  const start = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ provider: "google", callbackURL: "/ok", errorCallbackURL: "/err", ...extraBody }),
    }),
  );
  expect(start.status).toBe(200);
  const state = new URL(((await start.json()) as { url: string }).url).searchParams.get("state");
  const cb = await auth.handler(
    new Request(`${ORIGIN}/api/auth/callback/google?code=abc&state=${state}`, { headers: { cookie: cookieHeader(start) } }),
  );
  const user = h.sqlite.prepare('select * from "user" where email = ?').get(EMAIL) as Record<string, unknown> | undefined;
  const sessions = user ? Number((h.sqlite.prepare('select count(*) n from session where "userId" = ?').get(user.id as string) as { n: number }).n) : 0;
  return { status: cb.status, cookie: cookieHeader(cb), auth, location: new URL(cb.headers.get("location") ?? "", ORIGIN), sessions, user: user ?? null };
}

/** Tạo sẵn user Google (đăng nhập lần đầu) rồi trả id để thử các trạng thái khoá. */
async function existingUser(h: Harness): Promise<string> {
  const first = await googleLogin(h);
  expect(first.sessions).toBe(1);
  const id = first.user?.id as string;
  h.sqlite.prepare('delete from session where "userId" = ?').run(id);
  return id;
}

describe("đăng nhập Google qua Better Auth thật", () => {
  it("user thường -> 302 callbackURL, 1 session, role user", async () => {
    const h = createHarness();
    const r = await googleLogin(h);
    expect(r.location.pathname).toBe("/ok");
    expect(r.sessions).toBe(1);
    expect(r.user?.role).toBe("user");
    expect(r.user?.banned_until).toBeNull();
  });

  it("user bị khoá -> errorCallbackURL ACCOUNT_BANNED + token không chứa lý do; /api/ban-notice trả lý do và hạn", async () => {
    const h = createHarness();
    const id = await existingUser(h);
    const until = Date.now() + 60_000;
    h.sqlite.prepare('update "user" set banned_until = ?, ban_reason = ? where id = ?').run(until, "spam quảng cáo", id);
    const r = await googleLogin(h);
    expect(r.location.pathname).toBe("/err");
    expect(r.location.searchParams.get("error")).toBe("ACCOUNT_BANNED");
    const token = r.location.searchParams.get("error_description") ?? "";
    expect(token).not.toContain("spam");
    expect(r.sessions).toBe(0);

    const res = await h.request(`/api/ban-notice?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ until: new Date(until).toISOString(), reason: "spam quảng cáo", deleting: false });
  });

  it("khoá vĩnh viễn -> until null", async () => {
    const h = createHarness();
    const id = await existingUser(h);
    h.sqlite.prepare('update "user" set banned_until = ?, ban_reason = ? where id = ?').run(PERMANENT_BAN_UNTIL, "vĩnh viễn", id);
    const r = await googleLogin(h);
    const token = r.location.searchParams.get("error_description") ?? "";
    expect(await (await h.request(`/api/ban-notice?token=${token}`)).json()).toEqual({ until: null, reason: "vĩnh viễn", deleting: false });
  });

  it("khoá đã hết hạn (giờ thật) -> đăng nhập bình thường", async () => {
    const h = createHarness();
    const id = await existingUser(h);
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(Date.now() - 1_000, id);
    const r = await googleLogin(h);
    expect(r.location.pathname).toBe("/ok");
    expect(r.sessions).toBe(1);
  });

  it("race: khoá chen sau khi hook đã đọc -> trigger chặn, 0 session, lần sau nhận ACCOUNT_BANNED", async () => {
    const h = createHarness();
    const id = await existingUser(h);
    const race = await googleLogin(h, {
      afterHookRead: () => h.sqlite.prepare('update "user" set banned_until = ?, ban_reason = ? where id = ?').run(Date.now() + 60_000, "race", id),
    });
    expect(race.status).toBe(500);
    expect(race.sessions).toBe(0);
    const next = await googleLogin(h);
    expect(next.status).toBe(302);
    expect(next.location.searchParams.get("error")).toBe("ACCOUNT_BANNED");
    expect(next.sessions).toBe(0);
  });

  it("trigger session chặn chèn trực tiếp cho user bị khoá", async () => {
    const h = createHarness();
    const id = await existingUser(h);
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(Date.now() + 60_000, id);
    expect(() =>
      h.sqlite
        .prepare('insert into session (id, expiresAt, token, createdAt, updatedAt, "userId") values (?, ?, ?, ?, ?, ?)')
        .run("direct", "2099-01-01T00:00:00.000Z", "direct-token", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", id),
    ).toThrow(/account_blocked/);
  });

  it("deleting_at -> ACCOUNT_UNAVAILABLE; notice báo deleting", async () => {
    const h = createHarness();
    const id = await existingUser(h);
    h.sqlite.prepare('update "user" set deleting_at = ? where id = ?').run(Date.now(), id);
    const r = await googleLogin(h);
    expect(r.location.searchParams.get("error")).toBe("ACCOUNT_UNAVAILABLE");
    expect(r.sessions).toBe(0);
    const token = r.location.searchParams.get("error_description") ?? "";
    const body = await (await h.request(`/api/ban-notice?token=${token}`)).json<ApiJson & { deleting: boolean }>();
    expect(body.deleting).toBe(true);
  });

  it("additionalData role=moderator khi đăng ký bằng Google không leo quyền", async () => {
    const h = createHarness();
    const r = await googleLogin(h, { extraBody: { additionalData: { role: "moderator", banned_until: 1, last_seen_at: 1 } } });
    expect(r.location.pathname).toBe("/ok");
    expect(r.user?.role).toBe("user");
    expect(r.user?.banned_until).toBeNull();
  });

  it("phiên đang đăng nhập không tự đặt được role/banned_until qua /update-user", async () => {
    const h = createHarness();
    const r = await googleLogin(h);
    expect(r.cookie).toContain("session_token");
    const attempts: Record<string, unknown> = { role: "moderator", banned_until: 1, ban_reason: "x", deleting_at: 1, last_seen_at: 5 };
    for (const [field, value] of Object.entries(attempts)) {
      const res = await r.auth.handler(
        new Request(`${ORIGIN}/api/auth/update-user`, {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/json", cookie: r.cookie },
          body: JSON.stringify({ [field]: value }),
        }),
      );
      expect(res.status, field).toBe(400);
      const body = (await res.json()) as { code?: string; message?: string };
      expect(body.code, `${field}: ${JSON.stringify(body)}`).toBe("FIELD_NOT_ALLOWED");
    }
    const row = h.sqlite.prepare('select role, banned_until, ban_reason, deleting_at, last_seen_at from "user" where email = ?').get(EMAIL);
    expect({ ...row }).toEqual({ role: "user", banned_until: null, ban_reason: null, deleting_at: null, last_seen_at: null });
  });
});

describe("phiên cũ với cookie thật qua getSessionUser mặc định", () => {
  it("200 trước; khoá/đang xoá (giữ dòng session) -> 401; xoá session -> 401", async () => {
    const h = createHarness();
    const login = await googleLogin(h);
    expect(login.cookie).toContain("session_token");
    const id = login.user?.id as string;
    // Không ghi đè getUser: đi qua getSessionUser thật -> currentUser -> toSessionUser.
    const app = createApp();
    const env = { ...h.env, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" };
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
    const call = () =>
      app.request(
        "/api/comments",
        {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/json", cookie: login.cookie },
          body: JSON.stringify({ page: "/doi-chuan/s18-abc/", lang: "vi", body: "xin chào" }),
        },
        env,
        ctx,
      );
    expect((await call()).status).toBe(201);

    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(Date.now() + 60_000, id);
    expect(Number((h.sqlite.prepare('select count(*) n from session where "userId" = ?').get(id) as { n: number }).n)).toBe(1);
    expect((await call()).status).toBe(401);

    h.sqlite.prepare('update "user" set banned_until = null where id = ?').run(id);
    expect((await call()).status).toBe(201);
    h.sqlite.prepare('update "user" set deleting_at = ? where id = ?').run(Date.now(), id);
    expect((await call()).status).toBe(401);

    h.sqlite.prepare('update "user" set deleting_at = null where id = ?').run(id);
    expect((await call()).status).toBe(201);
    h.sqlite.prepare('delete from session where "userId" = ?').run(id);
    expect((await call()).status).toBe(401);
  });

  it("vai trò đọc lại mỗi request: cấp/thu moderator và root từ ADMIN_EMAILS có hiệu lực ngay", async () => {
    const h = createHarness();
    const login = await googleLogin(h);
    const id = login.user?.id as string;
    const app = createApp();
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
    const call = (path: string, env: Record<string, unknown> = {}) =>
      app.request(path, { headers: { origin: ORIGIN, cookie: login.cookie } }, { ...h.env, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret", ...env }, ctx);
    const roleOf = async (env?: Record<string, unknown>) => (await (await call("/api/me", env)).json<ApiJson>()).user.role;

    expect((await call("/api/admin/counts")).status).toBe(403);
    expect(await roleOf()).toBe("user");

    h.sqlite.prepare('update "user" set role = ? where id = ?').run("moderator", id);
    expect((await call("/api/admin/counts")).status).toBe(200);
    expect((await call("/api/admin/ai/config")).status).toBe(403);
    expect(await roleOf()).toBe("moderator");
    // Root từ ADMIN_EMAILS thắng user.role.
    expect(await roleOf({ ADMIN_EMAILS: EMAIL })).toBe("root");

    h.sqlite.prepare('update "user" set role = ? where id = ?').run("user", id);
    expect((await call("/api/admin/counts")).status).toBe(403);
    expect(await roleOf()).toBe("user");
  });
});

describe("GET /api/ban-notice", () => {
  async function bannedToken(h: Harness, exp = Date.now() + 600_000, userId = "u-alice") {
    return signBanNotice(h.env.BETTER_AUTH_SECRET, { userId, exp });
  }

  it("token sai 1 ký tự / quá hạn / user không bị chặn -> 404", async () => {
    const h = createHarness();
    h.sqlite.prepare('update "user" set banned_until = ?, ban_reason = ? where id = ?').run(Date.now() + 60_000, "lý do", "u-alice");
    const good = await bannedToken(h);
    expect((await h.request(`/api/ban-notice?token=${good}`)).status).toBe(200);

    const [idPart, expPart, sig] = good.split(".");
    const flipped = `${idPart}.${Number(expPart) + 1}.${sig}`;
    expect((await h.request(`/api/ban-notice?token=${flipped}`)).status).toBe(404);
    const badSig = `${idPart}.${expPart}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
    expect((await h.request(`/api/ban-notice?token=${badSig}`)).status).toBe(404);
    expect((await h.request("/api/ban-notice")).status).toBe(404);

    // h.clock (2026-09-27) < exp thật -> dùng exp trong quá khứ so với h.clock
    const expired = await bannedToken(h, h.clock.now - 1);
    expect((await h.request(`/api/ban-notice?token=${expired}`)).status).toBe(404);

    const other = await signBanNotice("secret-khac", { userId: "u-alice", exp: Date.now() + 600_000 });
    expect((await h.request(`/api/ban-notice?token=${other}`)).status).toBe(404);

    const notBlocked = await bannedToken(h, Date.now() + 600_000, "u-bob");
    expect((await h.request(`/api/ban-notice?token=${notBlocked}`)).status).toBe(404);
  });
});
