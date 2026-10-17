import { describe, expect, it } from "vitest";
import { toSessionUser, type SessionUserRow } from "../src/auth";
import { BAN_DURATIONS, isBlocked, maskEmail, PERMANENT_BAN_UNTIL, signBanNotice, verifyBanNotice, visibleUserSql } from "../src/moderation";
import { createHarness, type ApiJson } from "./fakes";

describe("maskEmail", () => {
  it("giữ 2 ký tự đầu phần local", () => {
    expect(maskEmail("nguyen@gmail.com")).toBe("ng***@gmail.com");
  });
  it("local ngắn: 1 ký tự", () => {
    expect(maskEmail("ab@x.io")).toBe("a***@x.io");
    expect(maskEmail("a@x.io")).toBe("a***@x.io");
    expect(maskEmail("abc@x.io")).toBe("ab***@x.io");
  });
  it("không có @ -> che hết", () => {
    expect(maskEmail("khong-hop-le")).toBe("***");
  });
});

describe("isBlocked", () => {
  const now = 1_000_000;
  it("đúng mốc banned_until", () => {
    expect(isBlocked({ bannedUntil: now + 1, deletingAt: null }, now)).toBe(true);
    expect(isBlocked({ bannedUntil: now, deletingAt: null }, now)).toBe(false);
    expect(isBlocked({ bannedUntil: now - 1, deletingAt: null }, now)).toBe(false);
    expect(isBlocked({ bannedUntil: null, deletingAt: null }, now)).toBe(false);
  });
  it("vĩnh viễn và đang xoá luôn chặn", () => {
    expect(isBlocked({ bannedUntil: PERMANENT_BAN_UNTIL, deletingAt: null }, now)).toBe(true);
    expect(isBlocked({ bannedUntil: null, deletingAt: 5 }, now)).toBe(true);
  });
});

describe("hằng số và SQL dùng chung", () => {
  it("BAN_DURATIONS", () => {
    expect(BAN_DURATIONS).toEqual({ "1d": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000, permanent: null });
  });
  it("visibleUserSql theo alias, một tham số bind", () => {
    const sql = visibleUserSql("u");
    expect(sql).toBe("(u.banned_until is null or u.banned_until <= ?) and u.deleting_at is null");
    expect(sql.split("?")).toHaveLength(2);
  });
});

describe("toSessionUser", () => {
  const row: SessionUserRow = { id: "u1", name: "N", email: "n@x.io", image: null, role: "moderator", banned_until: null, deleting_at: null, last_seen_at: 7 };
  it("map tên trường và vai trò", () => {
    expect(toSessionUser(row, 100)).toEqual({ id: "u1", name: "N", email: "n@x.io", image: null, role: "moderator", lastSeenAt: 7 });
    expect(toSessionUser({ ...row, role: "gì đó" }, 100)?.role).toBe("user");
    expect(toSessionUser(null, 100)).toBeNull();
  });
  it("null khi khoá còn hạn hoặc đang xoá; hết hạn thì trả user", () => {
    expect(toSessionUser({ ...row, banned_until: 101 }, 100)).toBeNull();
    expect(toSessionUser({ ...row, banned_until: 100 }, 100)).not.toBeNull();
    expect(toSessionUser({ ...row, deleting_at: 1 }, 100)).toBeNull();
  });
});

describe("token thông báo khoá", () => {
  it("ký/xác minh, sai secret/quá hạn/hỏng -> null", async () => {
    const token = await signBanNotice("s", { userId: "u.1", exp: 2000 });
    expect(await verifyBanNotice("s", token, 1000)).toBe("u.1");
    expect(await verifyBanNotice("s", token, 2000)).toBeNull();
    expect(await verifyBanNotice("khac", token, 1000)).toBeNull();
    expect(await verifyBanNotice("s", "a.b", 1000)).toBeNull();
    expect(await verifyBanNotice("s", `${token}.x`, 1000)).toBeNull();
    expect(await verifyBanNotice("s", "!!!.1.!!!", 1000)).toBeNull();
  });
  it("tách miền HMAC: chữ ký HMAC(secret, body) không tiền tố bị từ chối", async () => {
    const token = await signBanNotice("s", { userId: "u.1", exp: 2000 });
    const [idPart, expPart] = token.split(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("s"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const raw = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${idPart}.${expPart}`)));
    const b64 = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
    expect(await verifyBanNotice("s", `${idPart}.${expPart}.${b64}`, 1000)).toBeNull();
  });
});

// Mốc khoá dùng giờ thật: trigger chạy theo đồng hồ DB, không theo h.clock.
describe("trigger chặn ghi của user bị khoá (migration 0006)", () => {
  const insertUpload = (h: ReturnType<typeof createHarness>, userId: string) =>
    h.sqlite
      .prepare("insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, 'report', ?, 'image/png', 1, 'pending', 1)")
      .run(`up-${Math.random()}`, userId, `pending/${Math.random()}`);
  const insertReport = (h: ReturnType<typeof createHarness>, userId: string) =>
    h.sqlite
      .prepare("insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, status, created_at) values (?, 'p', 'vi', ?, 'k', 'win', '[]', '[]', 'pending', 1)")
      .run(`r-${Math.random()}`, userId);
  const insertSample = (h: ReturnType<typeof createHarness>, userId: string) =>
    h.sqlite
      .prepare("insert into scan_samples (id, user_id, screen, side, lang, ai_read, confirmed, status, created_at) values (?, ?, 'other', 'left', 'vi', '{}', '{}', 'pending', 1)")
      .run(`sc-${Math.random()}`, userId);
  const inserts = { uploads: insertUpload, battle_reports: insertReport, scan_samples: insertSample };

  for (const [table, insert] of Object.entries(inserts)) {
    it(`${table}: chặn khi khoá còn hạn / vĩnh viễn / đang xoá; không chặn khi hết hạn hoặc user thường`, () => {
      const h = createHarness();
      expect(() => insert(h, "u-alice")).not.toThrow();
      h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(Date.now() + 60_000, "u-alice");
      expect(() => insert(h, "u-alice")).toThrow(/account_blocked/);
      expect(() => insert(h, "u-bob")).not.toThrow();
      h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(PERMANENT_BAN_UNTIL, "u-alice");
      expect(() => insert(h, "u-alice")).toThrow(/account_blocked/);
      h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(Date.now() - 1_000, "u-alice");
      expect(() => insert(h, "u-alice")).not.toThrow();
      h.sqlite.prepare('update "user" set banned_until = null, deleting_at = ? where id = ?').run(1, "u-alice");
      expect(() => insert(h, "u-alice")).toThrow(/account_blocked/);
    });
  }
});

describe("guard thật trong harness (đọc session -> user từ DB)", () => {
  const comment = (h: ReturnType<typeof createHarness>, as = "alice") =>
    h.request("/api/comments", { as, json: { page: "/doi-chuan/s18-abc/", lang: "vi", body: "xin chào" } });

  it("user có session bị khoá qua SQL -> request kế tiếp 401; hết hạn theo h.clock -> 200", async () => {
    const h = createHarness();
    expect((await comment(h)).status).toBe(201);
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(h.clock.now + 60_000, "u-alice");
    const blocked = await comment(h);
    expect(blocked.status).toBe(401);
    expect((await blocked.json<ApiJson>()).error.code).toBe("unauthorized");
    expect((await (await h.request("/api/me", { as: "alice" })).json<{ user: unknown }>()).user).toBeNull();
    h.clock.now += 60_001;
    expect((await comment(h)).status).toBe(201);
  });

  it("đang xoá -> 401; xoá session -> 401; token lạ -> 401", async () => {
    const h = createHarness();
    h.sqlite.prepare('update "user" set deleting_at = ? where id = ?').run(1, "u-bob");
    expect((await comment(h, "bob")).status).toBe(401);
    h.sqlite.prepare('delete from session where "userId" = ?').run("u-alice");
    expect((await comment(h)).status).toBe(401);
    expect((await comment(h, "khong-ton-tai")).status).toBe(401);
  });

  it("vai trò đọc từ DB và đi qua toSessionUser", async () => {
    const h = createHarness();
    const me = await h.request("/api/me", { as: "moderator" });
    expect((await me.json<ApiJson>()).user.id).toBe("u-moderator");
    const role = h.sqlite.prepare('select role from "user" where id = ?').get("u-moderator") as { role: string };
    expect(role.role).toBe("moderator");
  });

  it("last_seen_at: ghi lần đầu qua waitUntil, không ghi lại trong 10 phút, ghi lại sau đó", async () => {
    const h = createHarness();
    const seen = () => (h.sqlite.prepare('select last_seen_at from "user" where id = ?').get("u-alice") as { last_seen_at: number | null }).last_seen_at;
    expect(seen()).toBeNull();
    await h.request("/api/me", { as: "alice" });
    await h.settle();
    const first = h.clock.now;
    expect(seen()).toBe(first);
    h.clock.now += 599_000;
    await h.request("/api/me", { as: "alice" });
    await h.settle();
    expect(seen()).toBe(first);
    h.clock.now += 2_000;
    await h.request("/api/me", { as: "alice" });
    await h.settle();
    expect(seen()).toBe(h.clock.now);
  });

  it("lỗi cập nhật last_seen_at không làm hỏng request", async () => {
    const h = createHarness();
    h.sqlite.exec('create trigger fail_seen before update of last_seen_at on "user" begin select raise(abort, \'boom\'); end');
    const res = await h.request("/api/me", { as: "alice" });
    await h.settle();
    expect(res.status).toBe(200);
  });
});

describe("harness: lỗi R2/KV chèn được", () => {
  it("r2Error làm put/delete ném; kvError làm put KV ném", async () => {
    const h = createHarness();
    h.r2Error = new Error("r2 down");
    await expect(h.env.MEDIA.put("k", new Uint8Array([1]))).rejects.toThrow("r2 down");
    await expect(h.env.MEDIA.delete("k")).rejects.toThrow("r2 down");
    h.r2Error = null;
    await expect(h.env.MEDIA.put("k", new Uint8Array([1]))).resolves.toBeUndefined();
    h.kvError = new Error("kv down");
    await expect(h.env.AI_KV.put("k", "v")).rejects.toThrow("kv down");
    h.kvError = null;
    await expect(h.env.AI_KV.put("k", "v")).resolves.toBeUndefined();
  });
});
