// Tối ưu CPU đường kiểm phiên: tái sử dụng Better Auth, bỏ getSession khi không có cookie,
// tắt kiểm schema lúc chạy (thay bằng explicitSchemaCheck ở đây).

import { SchemaMismatchError } from "@better-auth/core/db/internal";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createAuth, getSessionUser, hasSessionCookie } from "../src/auth";
import { createHarness, ORIGIN } from "./fakes";

const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;

/** Đếm mọi câu D1 được prepare (không riêng bảng session). */
function countQueries(env: { DB: D1Database }): { n: number } {
  const counter = { n: 0 };
  const orig = env.DB.prepare.bind(env.DB);
  env.DB.prepare = ((sql: string) => {
    counter.n++;
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
  it("không cookie / cookie lạ -> null, không câu D1 nào", async () => {
    const h = createHarness();
    const queries = countQueries(h.env);
    expect(await getSessionUser(h.env, new Headers())).toBeNull();
    expect(await getSessionUser(h.env, new Headers({ cookie: "theme=dark" }))).toBeNull();
    expect(queries.n).toBe(0);
  });

  it("GET /api/me không cookie -> user null, không câu D1 nào", async () => {
    const h = createHarness();
    const queries = countQueries(h.env);
    const app = createApp();
    const res = await app.request("/api/me", { headers: { origin: ORIGIN } }, h.env, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
    expect(queries.n).toBe(0);
  });
});

describe("schema Better Auth (thay kiểm lúc chạy đã tắt ở production)", () => {
  it("migration thật khớp schema Better Auth mong đợi", async () => {
    const h = createHarness();
    const check = (await createAuth(h.env, ORIGIN).$context).explicitSchemaCheck;
    expect(check).toBeTypeOf("function");
    await check?.();
  });

  it("lệch schema (thiếu cột) -> SchemaMismatchError", async () => {
    const h = createHarness();
    h.sqlite.exec('alter table "user" drop column ban_reason');
    const check = (await createAuth(h.env, ORIGIN).$context).explicitSchemaCheck;
    await expect(Promise.resolve(check?.())).rejects.toBeInstanceOf(SchemaMismatchError);
  });
});
