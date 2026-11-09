// Tối ưu CPU đường kiểm phiên: tái sử dụng Better Auth, bỏ getSession khi không có cookie, cookieCache.

import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createAuth, getSessionUser, hasSessionCookie, takeSessionSetCookies } from "../src/auth";
import { createHarness, ORIGIN } from "./fakes";

const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;

function sessionReads(env: { DB: D1Database }): { n: number } {
  const counter = { n: 0 };
  const orig = env.DB.prepare.bind(env.DB);
  env.DB.prepare = ((sql: string) => {
    if (/from\s+"session"/iu.test(sql)) counter.n++;
    return orig(sql);
  }) as typeof env.DB.prepare;
  return counter;
}

describe("hasSessionCookie", () => {
  it("chỉ nhận cookie phiên Better Auth, kể cả tiền tố __Secure-", () => {
    expect(hasSessionCookie(new Headers())).toBe(false);
    expect(hasSessionCookie(new Headers({ cookie: "other=1" }))).toBe(false);
    expect(hasSessionCookie(new Headers({ cookie: "better-auth.session_token_extra=x" }))).toBe(false);
    expect(hasSessionCookie(new Headers({ cookie: "better-auth.session_token=abc" }))).toBe(true);
    expect(hasSessionCookie(new Headers({ cookie: "a=1; __Secure-better-auth.session_token=abc" }))).toBe(true);
  });
});

describe("createAuth", () => {
  it("tái sử dụng một instance theo env + origin; env khác thì instance khác", () => {
    const h = createHarness();
    const a = createAuth(h.env, ORIGIN);
    expect(createAuth(h.env, ORIGIN)).toBe(a);
    expect(createAuth(h.env, "https://www.tqccl.com")).not.toBe(a);
    expect(createAuth({ ...h.env }, ORIGIN)).not.toBe(a);
  });
});

describe("getSessionUser", () => {
  it("không cookie / cookie lạ -> null, không đụng DB", async () => {
    const h = createHarness();
    const reads = sessionReads(h.env);
    expect(await getSessionUser(h.env, new Headers())).toBeNull();
    expect(await getSessionUser(h.env, new Headers({ cookie: "theme=dark" }))).toBeNull();
    expect(reads.n).toBe(0);
    expect(takeSessionSetCookies(new Headers())).toEqual([]);
  });

  it("GET /api/me không cookie không đọc session", async () => {
    const h = createHarness();
    const reads = sessionReads(h.env);
    const app = createApp();
    const res = await app.request("/api/me", { headers: { origin: ORIGIN } }, h.env, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
    expect(reads.n).toBe(0);
  });
});
