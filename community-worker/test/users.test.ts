// API người dùng: danh sách, chi tiết, khoá/mở khoá, cấp quyền, xoá (quy trình thử lại được) qua guard thật.

import { describe, expect, it } from "vitest";
import { encodeCursor } from "../src/http";
import { createHarness, PNG_BYTES, type Harness } from "./fakes";

const DAY = 86_400_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const json = async (res: Response): Promise<J> => res.json();

interface AuditRow {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  subject_user_id: string | null;
  reason: string | null;
  meta: string | null;
  status: string;
}

const audits = (h: Harness, action?: string) =>
  (action
    ? h.sqlite.prepare("select * from admin_audit where action = ? order by created_at, rowid").all(action)
    : h.sqlite.prepare("select * from admin_audit order by created_at, rowid").all()) as unknown as AuditRow[];
const row = (h: Harness, id: string) => h.sqlite.prepare('select * from "user" where id = ?').get(id) as J;
const count = (h: Harness, sql: string, ...args: (string | number)[]) =>
  (h.sqlite.prepare(`select count(*) as n from ${sql}`).get(...args) as { n: number }).n;

function insertUser(h: Harness, id: string, name: string, email: string, createdAt: string, role = "user") {
  h.sqlite
    .prepare('insert into "user" (id, name, email, emailVerified, image, createdAt, updatedAt, role) values (?, ?, ?, 1, null, ?, ?, ?)')
    .run(id, name, email, createdAt, createdAt, role);
}

const ban = (h: Harness, as: string, id: string, body: unknown = { duration: "7d", reason: "spam" }) =>
  h.request(`/api/admin/users/${id}/ban`, { as, json: body });
const unban = (h: Harness, as: string, id: string) => h.request(`/api/admin/users/${id}/unban`, { as, method: "POST" });
const setRole = (h: Harness, as: string, id: string, role: unknown) => h.request(`/api/admin/users/${id}/role`, { as, json: { role } });
const del = (h: Harness, as: string, id: string, confirmEmail: unknown) =>
  h.request(`/api/admin/users/${id}`, { as, method: "DELETE", json: { confirmEmail } });
const list = async (h: Harness, query = "", as = "admin") => json(await h.request(`/api/admin/users${query}`, { as }));

/** Chạy `before` ngay trước batch D1 kế tiếp thoả `match` (mô phỏng race giữa lúc đọc và lúc ghi). */
function beforeBatch(h: Harness, match: (sqls: string[]) => boolean, before: () => void, times = 1) {
  const real = h.env.DB;
  let left = times;
  h.env.DB = new Proxy(real, {
    get(target, prop) {
      if (prop !== "batch") return Reflect.get(target, prop) as unknown;
      return (stmts: { sql: string }[]) => {
        if (left > 0 && match(stmts.map((s) => s.sql))) {
          left--;
          before();
        }
        return target.batch(stmts as never);
      };
    },
  });
}

describe("quyền truy cập", () => {
  it("khách 401, user thường 403, staff 200 trên mọi endpoint đọc", async () => {
    const h = createHarness();
    for (const path of ["/api/admin/users", "/api/admin/users/u-bob"]) {
      expect((await h.request(path)).status).toBe(401);
      expect((await h.request(path, { as: "bob" })).status).toBe(403);
      expect((await h.request(path, { as: "moderator" })).status).toBe(200);
      expect((await h.request(path, { as: "admin" })).status).toBe(200);
    }
    expect((await h.request("/api/admin/users/khong-co", { as: "admin" })).status).toBe(404);
  });

  it("endpoint ghi: khách 401, user 403, KDV 403 ở khu root (role, xoá)", async () => {
    const h = createHarness();
    expect((await ban(h, "", "u-bob")).status).toBe(401);
    expect((await ban(h, "alice", "u-bob")).status).toBe(403);
    expect((await setRole(h, "moderator", "u-bob", "moderator")).status).toBe(403);
    expect((await del(h, "moderator", "u-bob", "bob@example.com")).status).toBe(403);
    expect((await setRole(h, "", "u-bob", "moderator")).status).toBe(401);
    expect((await del(h, "alice", "u-bob", "bob@example.com")).status).toBe(403);
    expect(audits(h)).toHaveLength(0);
  });
});

describe("danh sách", () => {
  it("phân trang 20/trang theo createdAt ISO, không trùng/sót kể cả khi cùng createdAt cắt ngang ranh giới trang", async () => {
    const h = createHarness();
    // 22 user: n02/n03/n04 cùng createdAt -> hàng 19..21 (xếp theo id giảm dần) nằm ngang ranh giới trang 1.
    for (let i = 1; i <= 22; i++) {
      const hour = i >= 2 && i <= 4 ? 3 : i;
      insertUser(h, `u-n${String(i).padStart(2, "0")}`, `User ${i}`, `n${i}@x.io`, `2026-02-01T${String(hour).padStart(2, "0")}:00:00.000Z`);
    }
    const expected = (h.sqlite.prepare('select id from "user" order by "createdAt" desc, id desc').all() as { id: string }[]).map((r) => r.id);
    expect(expected).toHaveLength(26);

    const first = await list(h);
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await list(h, `?cursor=${first.nextCursor}`);
    expect(second.items).toHaveLength(6);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((i: { id: string }) => i.id);
    expect(ids).toEqual(expected);
    // Ranh giới thật sự cắt ngang nhóm cùng createdAt.
    expect(first.items.slice(-2).map((i: { id: string }) => i.id)).toEqual(["u-n04", "u-n03"]);
    expect(second.items[0].id).toBe("u-n02");
  });

  it("cursor hỏng hoặc ngoài miền Date -> 400 invalid_cursor (không ném 500)", async () => {
    const h = createHarness();
    for (const cursor of ["rac", encodeCursor({ t: 9_000_000_000_000_000, id: "x" }), encodeCursor({ t: -9_000_000_000_000_000, id: "x" })]) {
      const res = await h.request(`/api/admin/users?cursor=${cursor}`, { as: "admin" });
      expect(res.status).toBe(400);
      expect((await json(res)).error.code).toBe("invalid_cursor");
    }
  });

  it("q: % _ và \\ là ký tự thường, không khớp tất cả", async () => {
    const h = createHarness();
    insertUser(h, "u-pct", "Giảm 100% giá", "pct@x.io", "2026-02-01T00:00:00.000Z");
    insertUser(h, "u-us", "snake_case", "us@x.io", "2026-02-01T00:00:00.000Z");
    insertUser(h, "u-bs", "back\\slash", "bs@x.io", "2026-02-01T00:00:00.000Z");
    const ids = async (q: string, as = "admin") => (await list(h, `?q=${encodeURIComponent(q)}`, as)).items.map((i: { id: string }) => i.id);
    expect(await ids("%")).toEqual(["u-pct"]);
    expect(await ids("_")).toEqual(["u-us"]);
    expect(await ids("\\")).toEqual(["u-bs"]);
    expect(await ids("%", "moderator")).toEqual(["u-pct"]);
    expect(await ids("_", "moderator")).toEqual(["u-us"]);
    expect(await ids("\\", "moderator")).toEqual(["u-bs"]);
    expect(await ids("alice")).toEqual(["u-alice"]);
    expect(await ids("khong-ai-ten-vay")).toEqual([]);
  });

  it("lọc vai trò hiệu lực: root từ ADMIN_EMAILS thắng cột role; user/moderator loại root", async () => {
    const h = createHarness();
    // u-admin (email thuộc ADMIN_EMAILS) bị gán nhầm role='moderator' trong DB vẫn là root.
    h.sqlite.prepare("update \"user\" set role = 'moderator' where id = 'u-admin'").run();
    insertUser(h, "u-root2", "Other", "  OTHER@example.com ", "2026-02-01T00:00:00.000Z", "user");
    const ids = async (q: string) => (await list(h, q)).items.map((i: { id: string }) => i.id).sort();
    expect(await ids("?role=root")).toEqual(["u-admin", "u-root2"]);
    expect(await ids("?role=moderator")).toEqual(["u-moderator"]);
    expect(await ids("?role=user")).toEqual(["u-alice", "u-bob"]);
    const roles = Object.fromEntries((await list(h)).items.map((i: { id: string; role: string }) => [i.id, i.role]));
    expect(roles).toMatchObject({ "u-admin": "root", "u-root2": "root", "u-moderator": "moderator", "u-bob": "user" });
    const bad = await h.request("/api/admin/users?role=admin", { as: "admin" });
    expect(bad.status).toBe(400);
    expect((await json(bad)).error.code).toBe("invalid_role");
  });

  it("lọc trạng thái active/banned/deleting; khoá hết hạn tính là active", async () => {
    const h = createHarness();
    insertUser(h, "u-expired", "Expired", "e@x.io", "2026-02-01T00:00:00.000Z");
    h.sqlite.prepare('update "user" set banned_until = ?, ban_reason = ?, banned_by = ?, banned_by_role = ? where id = ?').run(h.clock.now + DAY, "spam", "u-admin", "root", "u-bob");
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(h.clock.now - 1, "u-expired");
    h.sqlite.prepare('update "user" set deleting_at = ? where id = ?').run(h.clock.now, "u-alice");
    const ids = async (status: string) => (await list(h, `?status=${status}`)).items.map((i: { id: string }) => i.id).sort();
    expect(await ids("banned")).toEqual(["u-bob"]);
    expect(await ids("deleting")).toEqual(["u-alice"]);
    expect(await ids("active")).toEqual(["u-admin", "u-expired", "u-moderator"]);
    const all = (await list(h)).items;
    expect(all.find((i: { id: string }) => i.id === "u-bob").ban).toEqual({ until: new Date(h.clock.now + DAY).toISOString(), reason: "spam", byRole: "root" });
    expect(all.find((i: { id: string }) => i.id === "u-expired").ban).toBeNull();
    expect(all.find((i: { id: string }) => i.id === "u-alice").deleting).toBe(true);
    expect(all.find((i: { id: string }) => i.id === "u-admin").deleting).toBe(false);
    expect((await h.request("/api/admin/users?status=zzz", { as: "admin" })).status).toBe(400);
  });

  it("KDV: email che + emailMasked; q theo tiền tố/nửa email không lộ; q = email đầy đủ (không phân biệt hoa thường) trả đúng user; root thấy đầy đủ", async () => {
    const h = createHarness();
    insertUser(h, "u-carol", "Zed", "carol.secret@gmail.com", "2026-02-01T00:00:00.000Z");
    const ids = async (q: string, as: string) => (await list(h, `?q=${encodeURIComponent(q)}`, as)).items.map((i: { id: string }) => i.id);

    const mod = await list(h, "", "moderator");
    for (const item of mod.items) {
      expect(item.emailMasked).toBe(true);
      expect(item.email).toContain("***");
    }
    expect(mod.items.find((i: { id: string }) => i.id === "u-carol").email).toBe("ca***@gmail.com");
    expect(JSON.stringify(mod)).not.toContain("carol.secret");
    expect(JSON.stringify(mod)).not.toContain("alice@example.com");

    expect(await ids("carol.s", "moderator")).toEqual([]);
    expect(await ids("secret", "moderator")).toEqual([]);
    expect(await ids("gmail", "moderator")).toEqual([]);
    expect(await ids("carol.secret@gmail", "moderator")).toEqual([]);
    expect(await ids("carol.secret@gmail.com", "moderator")).toEqual(["u-carol"]);
    expect(await ids("  CAROL.Secret@GMAIL.com ", "moderator")).toEqual(["u-carol"]);
    expect(await ids("Zed", "moderator")).toEqual(["u-carol"]);

    expect(await ids("carol.s", "admin")).toEqual(["u-carol"]);
    expect(await ids("gmail", "admin")).toEqual(["u-carol"]);
    const root = await list(h, "?q=carol", "admin");
    expect(root.items[0].email).toBe("carol.secret@gmail.com");
    expect(root.items[0].emailMasked).toBeUndefined();
  });

  it("mỗi dòng có ảnh, ngày đăng ký, lần hoạt động cuối, counts đúng", async () => {
    const h = createHarness();
    const now = h.clock.now;
    h.sqlite.prepare("update \"user\" set last_seen_at = ? where id = 'u-bob'").run(now - 5000);
    const c = h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, 'p', 'vi', 'u-bob', 'x', 1)");
    c.run("c1");
    c.run("c2");
    h.sqlite
      .prepare("insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values ('r1', 'p', 'vi', 'u-bob', 'win', '[]', '[]', 'pending', 1)")
      .run();
    h.sqlite.prepare("insert into feedback (id, kind, title, body, lang, user_id, status, created_at) values ('f1', 'bug', 't', 'b', 'vi', 'u-bob', 'new', 1)").run();
    h.sqlite
      .prepare("insert into scan_samples (id, user_id, screen, side, lang, ai_read, confirmed, status, created_at) values ('s1', 'u-bob', 'other', 'left', 'vi', '{}', '{}', 'pending', 1)")
      .run();
    const bob = (await list(h, "?q=Bob")).items[0];
    expect(bob).toMatchObject({
      id: "u-bob",
      name: "Bob",
      email: "bob@example.com",
      image: "https://img.test/bob.png",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: new Date(now - 5000).toISOString(),
      role: "user",
      ban: null,
      deleting: false,
      counts: { comments: 2, reports: 1, feedback: 1, scanSamples: 1 },
    });
    expect((await list(h, "?q=Alice")).items[0]).toMatchObject({ lastSeenAt: null, counts: { comments: 0, reports: 0, feedback: 0, scanSamples: 0 } });
  });
});

describe("chi tiết", () => {
  it("nội dung mới nhất, số liệu, nhật ký của riêng user; email che với KDV", async () => {
    const h = createHarness();
    const c = h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, 'p', 'vi', 'u-bob', ?, ?)");
    for (let i = 1; i <= 12; i++) c.run(`c${i}`, `bình luận ${i}`, i);
    const r = h.sqlite.prepare(
      "insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, status, created_at) values (?, 'p', 'vi', 'u-bob', ?, 'win', '[]', '[]', ?, ?)",
    );
    for (let i = 1; i <= 12; i++) r.run(`r${i}`, i === 12 ? "reports/r12.png" : null, i % 2 ? "pending" : "rejected", i);
    h.sqlite.prepare("insert into feedback (id, kind, title, body, lang, user_id, status, created_at) values ('f1', 'bug', 't', 'b', 'vi', 'u-bob', 'new', 1)").run();
    h.sqlite
      .prepare("insert into scan_samples (id, user_id, screen, side, lang, ai_read, confirmed, status, created_at) values ('s1', 'u-bob', 'other', 'left', 'vi', '{}', '{}', 'pending', 1)")
      .run();
    await ban(h, "admin", "u-bob");
    await ban(h, "admin", "u-alice");

    const detail = await json(await h.request("/api/admin/users/u-bob", { as: "admin" }));
    expect(detail.user).toMatchObject({ id: "u-bob", email: "bob@example.com", role: "user", counts: { comments: 12, reports: 12, feedback: 1, scanSamples: 1 } });
    expect(detail.user.ban).toMatchObject({ reason: "spam", byRole: "root" });
    expect(detail.comments).toHaveLength(10);
    expect(detail.comments[0]).toMatchObject({ id: "c12", body: "bình luận 12" });
    expect(detail.reports).toHaveLength(10);
    expect(detail.reports[0]).toMatchObject({ id: "r12", status: "rejected" });
    expect(detail.audit).toHaveLength(1);
    expect(detail.audit[0]).toMatchObject({ action: "user.ban", subjectUserId: "u-bob", reason: "spam", status: "ok" });

    const mod = await json(await h.request("/api/admin/users/u-bob", { as: "moderator" }));
    expect(mod.user.email).toBe("bo***@example.com");
    expect(mod.user.emailMasked).toBe(true);
    expect(JSON.stringify(mod)).not.toContain("bob@example.com");
  });
});

describe("khoá", () => {
  it("root khoá: cột ban, session bị xoá, request kế tiếp của đích 401, đúng một dòng nhật ký", async () => {
    const h = createHarness();
    expect(count(h, 'session where "userId" = ?', "u-bob")).toBe(1);
    const res = await ban(h, "admin", "u-bob", { duration: "7d", reason: "  spam quảng cáo  " });
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: "u-bob", ban: { until: new Date(h.clock.now + 7 * DAY).toISOString(), reason: "spam quảng cáo", byRole: "root" } });
    expect(row(h, "u-bob")).toMatchObject({ banned_until: h.clock.now + 7 * DAY, ban_reason: "spam quảng cáo", banned_by: "u-admin", banned_by_role: "root" });
    expect(count(h, 'session where "userId" = ?', "u-bob")).toBe(0);
    expect((await h.request("/api/comments", { as: "bob", json: { page: "/doi-chuan/x/", lang: "vi", body: "hi" } })).status).toBe(401);
    expect((await json(await h.request("/api/me", { as: "bob" }))).user).toBeNull();

    const log = audits(h);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      action: "user.ban",
      actor_id: "u-admin",
      actor_role: "root",
      target_type: "user",
      target_id: "u-bob",
      subject_user_id: "u-bob",
      reason: "spam quảng cáo",
      status: "ok",
    });
    expect(JSON.parse(log[0].meta as string)).toMatchObject({ duration: "7d", until: h.clock.now + 7 * DAY });
    expect(JSON.stringify(log).toLowerCase()).not.toContain("bob@example.com");
    expect(JSON.stringify(log)).not.toContain("x-test-user");
  });

  it("thời hạn 1d/30d/permanent", async () => {
    const h = createHarness();
    await ban(h, "admin", "u-alice", { duration: "1d", reason: "r" });
    expect(row(h, "u-alice").banned_until).toBe(h.clock.now + DAY);
    await ban(h, "admin", "u-alice", { duration: "30d", reason: "r" });
    expect(row(h, "u-alice").banned_until).toBe(h.clock.now + 30 * DAY);
    const perm = await json(await ban(h, "admin", "u-alice", { duration: "permanent", reason: "r" }));
    expect(row(h, "u-alice").banned_until).toBe(8_640_000_000_000_000);
    expect(perm.ban.until).toBeNull();
  });

  it("đầu vào sai: 400 invalid_duration/invalid_reason; không có dòng nhật ký", async () => {
    const h = createHarness();
    for (const [body, code] of [
      [{ duration: "2d", reason: "x" }, "invalid_duration"],
      [{ reason: "x" }, "invalid_duration"],
      [{ duration: "7d" }, "invalid_reason"],
      [{ duration: "7d", reason: "   " }, "invalid_reason"],
      [{ duration: "7d", reason: "x".repeat(501) }, "invalid_reason"],
    ] as const) {
      const res = await ban(h, "admin", "u-bob", body);
      expect(res.status).toBe(400);
      expect((await json(res)).error.code).toBe(code);
    }
    expect(audits(h)).toHaveLength(0);
    expect(row(h, "u-bob").banned_until).toBeNull();
  });

  it("tự khoá 400 invalid_target; khoá root 403; không có user 404", async () => {
    const h = createHarness();
    for (const [as, id] of [["admin", "u-admin"], ["moderator", "u-moderator"]] as const) {
      const res = await ban(h, as, id);
      expect(res.status).toBe(400);
      expect((await json(res)).error.code).toBe("invalid_target");
    }
    expect((await ban(h, "moderator", "u-admin")).status).toBe(403);
    expect((await ban(h, "admin", "khong-co")).status).toBe(404);
    expect(row(h, "u-admin").banned_until).toBeNull();
    expect(audits(h)).toHaveLength(0);
  });

  it("root cũng không khoá được root khác (ADMIN_EMAILS, chuẩn hoá hoa thường/khoảng trắng)", async () => {
    const h = createHarness();
    insertUser(h, "u-root2", "Other", " Other@Example.com ", "2026-02-01T00:00:00.000Z");
    expect((await ban(h, "admin", "u-root2")).status).toBe(403);
    expect(row(h, "u-root2").banned_until).toBeNull();
    expect(audits(h)).toHaveLength(0);
  });

  it("đích đang xoá -> 409 user_deleting", async () => {
    const h = createHarness();
    h.sqlite.prepare('update "user" set deleting_at = 1 where id = ?').run("u-bob");
    const res = await ban(h, "admin", "u-bob");
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("user_deleting");
    expect(audits(h)).toHaveLength(0);
  });

  it("KDV khoá user thường được, ghi actor_role moderator + banned_by_role", async () => {
    const h = createHarness();
    expect((await ban(h, "moderator", "u-bob")).status).toBe(200);
    expect(row(h, "u-bob")).toMatchObject({ banned_by: "u-moderator", banned_by_role: "moderator" });
    expect(audits(h, "user.ban")[0]).toMatchObject({ actor_id: "u-moderator", actor_role: "moderator" });
    expect(count(h, 'session where "userId" = ?', "u-bob")).toBe(0);
  });

  it("KDV khoá KDV khác -> 403, không đổi gì, 0 dòng nhật ký, session còn", async () => {
    const h = createHarness();
    insertUser(h, "u-mod2", "Mod2", "mod2@example.com", "2026-02-01T00:00:00.000Z", "moderator");
    h.sqlite.prepare('insert into session (id, expiresAt, token, createdAt, updatedAt, userId) values (?, ?, ?, ?, ?, ?)').run("s-mod2", "2099-01-01T00:00:00.000Z", "mod2", "x", "x", "u-mod2");
    const res = await ban(h, "moderator", "u-mod2");
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("forbidden");
    expect(row(h, "u-mod2").banned_until).toBeNull();
    expect(count(h, 'session where "userId" = ?', "u-mod2")).toBe(1);
    expect(audits(h)).toHaveLength(0);
    // Root thì được.
    expect((await ban(h, "admin", "u-mod2")).status).toBe(200);
  });

  it("KDV không đè/rút ngắn/mở khoá do root đặt (còn hạn); khi khoá root đã hết hạn thì được", async () => {
    const h = createHarness();
    await ban(h, "admin", "u-bob", { duration: "permanent", reason: "root ban" });
    expect(audits(h)).toHaveLength(1);
    const before = row(h, "u-bob");
    const shorter = await ban(h, "moderator", "u-bob", { duration: "1d", reason: "ngắn hơn" });
    expect(shorter.status).toBe(403);
    expect((await unban(h, "moderator", "u-bob")).status).toBe(403);
    expect(row(h, "u-bob")).toEqual(before);
    expect(audits(h)).toHaveLength(1);

    await ban(h, "admin", "u-alice", { duration: "1d", reason: "root ban" });
    h.clock.now += 2 * DAY;
    expect((await ban(h, "moderator", "u-alice", { duration: "7d", reason: "mới" })).status).toBe(200);
    expect(row(h, "u-alice")).toMatchObject({ banned_by: "u-moderator", banned_by_role: "moderator", ban_reason: "mới" });
  });

  it("root đè khoá của KDV được; KDV đè khoá của KDV được", async () => {
    const h = createHarness();
    await ban(h, "moderator", "u-bob", { duration: "1d", reason: "kdv" });
    expect((await ban(h, "moderator", "u-bob", { duration: "7d", reason: "kdv lần 2" })).status).toBe(200);
    expect((await ban(h, "admin", "u-bob", { duration: "30d", reason: "root" })).status).toBe(200);
    expect(row(h, "u-bob")).toMatchObject({ banned_by_role: "root", ban_reason: "root" });
    expect(audits(h, "user.ban")).toHaveLength(3);
  });

  it("race: đích được nâng lên KDV ngay trước batch -> 403, không đổi cột, không nhật ký, session còn", async () => {
    const h = createHarness();
    beforeBatch(
      h,
      (sqls) => sqls.some((s) => s.includes("banned_until")),
      () => void h.sqlite.prepare("update \"user\" set role = 'moderator' where id = 'u-bob'").run(),
    );
    const res = await ban(h, "moderator", "u-bob");
    expect(res.status).toBe(403);
    expect(row(h, "u-bob")).toMatchObject({ role: "moderator", banned_until: null, ban_reason: null, banned_by: null, banned_by_role: null });
    expect(count(h, 'session where "userId" = ?', "u-bob")).toBe(1);
    expect(audits(h)).toHaveLength(0);
  });

  it("race: root đặt khoá vĩnh viễn ngay trước batch của KDV -> khoá của root không bị đè", async () => {
    const h = createHarness();
    beforeBatch(
      h,
      (sqls) => sqls.some((s) => s.includes("banned_until")),
      () =>
        void h.sqlite
          .prepare("update \"user\" set banned_until = 8640000000000000, ban_reason = 'root', banned_by = 'u-admin', banned_by_role = 'root' where id = 'u-bob'")
          .run(),
    );
    expect((await ban(h, "moderator", "u-bob")).status).toBe(403);
    expect(row(h, "u-bob")).toMatchObject({ ban_reason: "root", banned_by_role: "root" });
    expect(audits(h)).toHaveLength(0);
  });
});

describe("mở khoá", () => {
  it("root mở khoá: 4 cột về null, một dòng nhật ký user.unban kèm khoá cũ", async () => {
    const h = createHarness();
    await ban(h, "admin", "u-bob", { duration: "7d", reason: "spam" });
    const res = await unban(h, "admin", "u-bob");
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: "u-bob", ban: null });
    expect(row(h, "u-bob")).toMatchObject({ banned_until: null, ban_reason: null, banned_by: null, banned_by_role: null });
    const log = audits(h, "user.unban");
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actor_id: "u-admin", target_id: "u-bob", subject_user_id: "u-bob", status: "ok" });
    expect(JSON.parse(log[0].meta as string)).toMatchObject({ previousUntil: h.clock.now + 7 * DAY, previousByRole: "root", previousReason: "spam" });
  });

  it("KDV mở khoá do KDV đặt được", async () => {
    const h = createHarness();
    await ban(h, "moderator", "u-bob");
    expect((await unban(h, "moderator", "u-bob")).status).toBe(200);
    expect(row(h, "u-bob").banned_until).toBeNull();
    expect(audits(h, "user.unban")[0]).toMatchObject({ actor_role: "moderator" });
  });

  it("không bị khoá -> 409 not_banned, không nhật ký; đang xoá -> 409; không có user -> 404", async () => {
    const h = createHarness();
    const res = await unban(h, "admin", "u-bob");
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("not_banned");
    expect((await unban(h, "admin", "khong-co")).status).toBe(404);
    h.sqlite.prepare('update "user" set deleting_at = 1, banned_until = 5 where id = ?').run("u-alice");
    expect((await json(await unban(h, "admin", "u-alice"))).error.code).toBe("user_deleting");
    expect(audits(h)).toHaveLength(0);
  });

  it("KDV không mở khoá user là KDV hay root dù khoá do KDV đặt (ràng buộc đích trong SQL)", async () => {
    const h = createHarness();
    h.sqlite
      .prepare("update \"user\" set banned_until = ?, ban_reason = 'x', banned_by = 'u-moderator', banned_by_role = 'moderator', role = 'moderator' where id = 'u-bob'")
      .run(h.clock.now + DAY);
    expect((await unban(h, "moderator", "u-bob")).status).toBe(403);
    expect(row(h, "u-bob").banned_until).toBe(h.clock.now + DAY);
    expect(audits(h)).toHaveLength(0);
  });

  it("race: khoá bị thay bởi khoá của root ngay trước batch -> KDV 403, khoá còn nguyên, không dòng unban", async () => {
    const h = createHarness();
    await ban(h, "moderator", "u-bob");
    beforeBatch(
      h,
      (sqls) => sqls.some((s) => s.includes("banned_until")),
      () =>
        void h.sqlite
          .prepare("update \"user\" set banned_until = 8640000000000000, ban_reason = 'root', banned_by = 'u-admin', banned_by_role = 'root' where id = 'u-bob'")
          .run(),
    );
    expect((await unban(h, "moderator", "u-bob")).status).toBe(403);
    expect(row(h, "u-bob")).toMatchObject({ ban_reason: "root", banned_by_role: "root" });
    expect(audits(h, "user.unban")).toHaveLength(0);
  });

  it("race: root mở khoá khi khoá vừa bị thay -> 409, không dòng unban sai nội dung", async () => {
    const h = createHarness();
    await ban(h, "admin", "u-bob");
    beforeBatch(
      h,
      (sqls) => sqls.some((s) => s.includes("banned_until")),
      () => void h.sqlite.prepare("update \"user\" set banned_until = banned_until + 1000, ban_reason = 'khác' where id = 'u-bob'").run(),
    );
    const res = await unban(h, "admin", "u-bob");
    expect(res.status).toBe(409);
    expect(row(h, "u-bob").ban_reason).toBe("khác");
    expect(audits(h, "user.unban")).toHaveLength(0);
  });
});

describe("cấp/thu quyền KDV", () => {
  it("root cấp: request kế tiếp của đích vào /api/admin/reports; thu hồi -> 403; nhật ký from/to", async () => {
    const h = createHarness();
    expect((await h.request("/api/admin/reports", { as: "bob" })).status).toBe(403);
    const res = await setRole(h, "admin", "u-bob", "moderator");
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: "u-bob", role: "moderator" });
    expect(row(h, "u-bob").role).toBe("moderator");
    expect((await h.request("/api/admin/reports", { as: "bob" })).status).toBe(200);

    expect((await setRole(h, "admin", "u-bob", "user")).status).toBe(200);
    expect((await h.request("/api/admin/reports", { as: "bob" })).status).toBe(403);

    const log = audits(h, "user.role");
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ actor_id: "u-admin", target_id: "u-bob", subject_user_id: "u-bob", status: "ok" });
    expect(JSON.parse(log[0].meta as string)).toEqual({ from: "user", to: "moderator" });
    expect(JSON.parse(log[1].meta as string)).toEqual({ from: "moderator", to: "user" });
  });

  it("lỗi: role sai 400; tự đổi 400; đích là root 403; không đổi (409); không có user 404; đang xoá 409", async () => {
    const h = createHarness();
    expect((await json(await setRole(h, "admin", "u-bob", "admin"))).error.code).toBe("invalid_role");
    expect((await json(await setRole(h, "admin", "u-bob", "root"))).error.code).toBe("invalid_role");
    expect((await json(await setRole(h, "admin", "u-admin", "user"))).error.code).toBe("invalid_target");
    insertUser(h, "u-root2", "Other", "other@example.com", "2026-02-01T00:00:00.000Z");
    expect((await setRole(h, "admin", "u-root2", "moderator")).status).toBe(403);
    expect(row(h, "u-root2").role).toBe("user");
    expect((await json(await setRole(h, "admin", "u-bob", "user"))).error.code).toBe("role_unchanged");
    expect((await setRole(h, "admin", "khong-co", "user")).status).toBe(404);
    h.sqlite.prepare('update "user" set deleting_at = 1 where id = ?').run("u-alice");
    expect((await json(await setRole(h, "admin", "u-alice", "moderator"))).error.code).toBe("user_deleting");
    expect(row(h, "u-alice").role).toBe("user");
    expect(audits(h)).toHaveLength(0);
  });

  it("race: vai trò đổi giữa lúc đọc và ghi -> 409, không dòng nhật ký sai from", async () => {
    const h = createHarness();
    beforeBatch(
      h,
      (sqls) => sqls.some((s) => s.includes("role")),
      () => void h.sqlite.prepare("update \"user\" set role = 'moderator' where id = 'u-bob'").run(),
    );
    const res = await setRole(h, "admin", "u-bob", "moderator");
    expect(res.status).toBe(409);
    expect(audits(h, "user.role")).toHaveLength(0);
  });
});

describe("xoá tài khoản", () => {
  const BOB = "u-bob";

  async function seedBob(h: Harness) {
    const put = (key: string) => h.env.MEDIA.put(key, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
    await Promise.all(["reports/r1.png", "pending/up2", "scan-samples/s1.png", "posts/keep.png", "reports/alice.png"].map(put));
    h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values ('c1', 'p', 'vi', ?, 'x', 1)").run(BOB);
    const rep = h.sqlite.prepare(
      "insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, status, reviewed_by, created_at) values (?, 'p', 'vi', ?, ?, 'win', '[]', '[]', 'approved', ?, 1)",
    );
    rep.run("r1", BOB, "reports/r1.png", null);
    rep.run("r-alice", "u-alice", "reports/alice.png", BOB); // báo cáo của alice do bob từng duyệt
    const up = h.sqlite.prepare("insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, ?, ?, 'image/png', 1, ?, 1)");
    up.run("up1", BOB, "report", "reports/r1.png", "attached"); // trùng khoá với battle_reports.image_key
    up.run("up2", BOB, "report", "pending/up2", "pending");
    up.run("up3", BOB, "post", "posts/keep.png", "attached");
    h.sqlite
      .prepare("insert into scan_samples (id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, created_at) values ('s1', ?, 'scan-samples/s1.png', 'other', 'left', 'vi', '{}', '{}', 'pending', 1)")
      .run(BOB);
    h.sqlite
      .prepare("insert into scan_samples (id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, reviewed_by, created_at) values ('s-alice', 'u-alice', null, 'other', 'left', 'vi', '{}', '{}', 'rejected', ?, 1)")
      .run(BOB);
    h.sqlite.prepare("insert into recruit_records (user_id, kind, id, updated_at, rev, payload) values (?, 'account', 'a1', 1, 1, '{}')").run(BOB);
    h.sqlite.prepare('insert into account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") values (?, ?, ?, ?, ?, ?)').run("acc1", "g1", "google", BOB, "x", "x");
    h.sqlite
      .prepare("insert into posts (id, slug, lang, title, description, body_markdown, faq, tags, status, author_id, author_name, updated_at, created_at) values ('p1', 'p1', 'vi', 't', '', '![](posts/keep.png)', '[]', '[]', 'published', ?, 'Bob', 1, 1)")
      .run(BOB);
    h.sqlite.prepare("insert into feedback (id, kind, title, body, email, lang, user_id, status, created_at) values ('f1', 'bug', 't', 'nội dung góp ý', 'bob@example.com', 'vi', ?, 'new', 1)").run(BOB);
    h.sqlite.prepare("insert into feedback (id, kind, title, body, lang, status, created_at) values ('f2', 'bug', 't', 'của khách', 'vi', 'new', 1)").run();
  }

  /** Bọc MEDIA.delete để ghi lại từng lần gọi (mảng khoá). */
  function recordDeletes(h: Harness, failOnCall?: number) {
    const calls: string[][] = [];
    const real = h.env.MEDIA;
    h.env.MEDIA = new Proxy(real, {
      get(target, prop) {
        if (prop !== "delete") return Reflect.get(target, prop) as unknown;
        return async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          calls.push(list);
          if (failOnCall !== undefined && calls.length === failOnCall) throw new Error("r2 chunk failed");
          return target.delete(list);
        };
      },
    });
    return calls;
  }

  it("xác nhận sai email -> 400 confirm_mismatch; không đổi gì", async () => {
    const h = createHarness();
    for (const bad of ["bob@example.org", "", undefined, 5]) {
      const res = await del(h, "admin", BOB, bad);
      expect(res.status).toBe(400);
      expect(["confirm_mismatch", "invalid_confirmEmail"]).toContain((await json(res)).error.code);
    }
    expect(row(h, BOB).deleting_at).toBeNull();
    expect(audits(h)).toHaveLength(0);
  });

  it("tự xoá 400 invalid_target; root 403; không có user 404", async () => {
    const h = createHarness();
    expect((await json(await del(h, "admin", "u-admin", "admin@example.com"))).error.code).toBe("invalid_target");
    insertUser(h, "u-root2", "Other", "other@example.com", "2026-02-01T00:00:00.000Z");
    expect((await del(h, "admin", "u-root2", "other@example.com")).status).toBe(403);
    expect((await del(h, "admin", "khong-co", "x@x.io")).status).toBe(404);
    expect(row(h, "u-root2")).toBeTruthy();
    expect(audits(h)).toHaveLength(0);
  });

  it("đích đang bị khoá còn hạn -> 409 user_banned; không bắt đầu xoá; khoá hết hạn thì xoá được", async () => {
    const h = createHarness();
    await ban(h, "admin", BOB, { duration: "permanent", reason: "spam" });
    const res = await del(h, "admin", BOB, "bob@example.com");
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("user_banned");
    expect(row(h, BOB).deleting_at).toBeNull();
    expect(audits(h, "user.delete.start")).toHaveLength(0);

    await ban(h, "admin", "u-alice", { duration: "1d", reason: "x" });
    h.clock.now += 2 * DAY;
    expect((await del(h, "admin", "u-alice", "alice@example.com")).status).toBe(200);
  });

  it("thành công: dữ liệu + ảnh báo cáo/soi đội biến mất; ảnh bài viết còn, chuyển cho root; góp ý ẩn danh; nhật ký start + ok", async () => {
    const h = createHarness();
    await seedBob(h);
    const calls = recordDeletes(h);
    const res = await del(h, "admin", BOB, "  BOB@Example.com ");
    expect(res.status).toBe(200);
    expect((await json(res)).ok).toBe(true);

    expect(row(h, BOB)).toBeUndefined();
    for (const table of ["comments", "battle_reports", "scan_samples", "recruit_records", "uploads"]) {
      expect(count(h, `${table} where user_id = ?`, BOB)).toBe(0);
    }
    expect(count(h, 'session where "userId" = ?', BOB)).toBe(0);
    expect(count(h, 'account where "userId" = ?', BOB)).toBe(0);
    expect(count(h, "uploads where kind = 'report' and user_id = ?", BOB)).toBe(0);
    expect(h.objects.has("reports/r1.png")).toBe(false);
    expect(h.objects.has("pending/up2")).toBe(false);
    expect(h.objects.has("scan-samples/s1.png")).toBe(false);
    // Của người khác / ảnh bài viết còn nguyên.
    expect(h.objects.has("posts/keep.png")).toBe(true);
    expect(h.objects.has("reports/alice.png")).toBe(true);
    expect(h.sqlite.prepare("select user_id, kind from uploads where id = 'up3'").get()).toMatchObject({ user_id: "u-admin", kind: "post" });
    // Khoá R2 trùng giữa uploads và battle_reports chỉ xoá một lần, không có khoá bài viết.
    const deleted = calls.flat();
    expect(deleted.sort()).toEqual(["pending/up2", "reports/r1.png", "scan-samples/s1.png"]);
    // Bài viết giữ tên tác giả; góp ý ẩn danh nhưng còn nội dung; tham chiếu người duyệt về null.
    expect(h.sqlite.prepare("select author_id, author_name from posts where id = 'p1'").get()).toMatchObject({ author_id: null, author_name: "Bob" });
    expect(h.sqlite.prepare("select user_id, email, body from feedback where id = 'f1'").get()).toMatchObject({ user_id: null, email: null, body: "nội dung góp ý" });
    expect(h.sqlite.prepare("select body from feedback where id = 'f2'").get()).toMatchObject({ body: "của khách" });
    expect(h.sqlite.prepare("select reviewed_by from battle_reports where id = 'r-alice'").get()).toMatchObject({ reviewed_by: null });
    expect(h.sqlite.prepare("select reviewed_by from scan_samples where id = 's-alice'").get()).toMatchObject({ reviewed_by: null });

    const start = audits(h, "user.delete.start");
    const done = audits(h, "user.delete");
    expect(start).toHaveLength(1);
    expect(done).toHaveLength(1);
    expect(start[0]).toMatchObject({ actor_id: "u-admin", actor_role: "root", target_type: "user", target_id: BOB, subject_user_id: BOB, status: "ok" });
    expect(done[0]).toMatchObject({ target_id: BOB, subject_user_id: BOB, target_label: "bo***@example.com", status: "ok" });
    expect(JSON.parse(done[0].meta as string)).toMatchObject({ objects: 3, comments: 1, reports: 1 });
    expect(JSON.stringify(audits(h)).toLowerCase()).not.toContain("bob@example.com");
  });

  it("lỗi R2 -> 502 delete_incomplete, user giữ deleting_at, audit failed; thử lại hoàn tất, không nhân đôi dòng start", async () => {
    const h = createHarness();
    await seedBob(h);
    h.r2Error = new Error("r2 down");
    const first = await del(h, "admin", BOB, "bob@example.com");
    expect(first.status).toBe(502);
    expect((await json(first)).error.code).toBe("delete_incomplete");
    expect(row(h, BOB).deleting_at).toBe(h.clock.now);
    expect(count(h, 'session where "userId" = ?', BOB)).toBe(0);
    expect(count(h, "comments where user_id = ?", BOB)).toBe(1);
    expect(audits(h, "user.delete.start")).toHaveLength(1);
    const failed = audits(h, "user.delete");
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ status: "failed" });
    expect(JSON.parse(failed[0].meta as string)).toMatchObject({ step: "r2" });
    // Trong lúc đang xoá: bob không đăng nhập được, nội dung bị ẩn.
    expect((await json(await h.request("/api/me", { as: "bob" }))).user).toBeNull();

    h.r2Error = null;
    h.clock.now += 1000;
    const second = await del(h, "admin", BOB, "bob@example.com");
    expect(second.status).toBe(200);
    expect(row(h, BOB)).toBeUndefined();
    expect(h.objects.has("reports/r1.png")).toBe(false);
    expect(audits(h, "user.delete.start")).toHaveLength(1);
    expect(audits(h, "user.delete").map((r) => r.status)).toEqual(["failed", "ok"]);
  });

  it("D1 lỗi ở batch cuối sau khi R2 đã xoá -> 500, một dòng partial step d1, user còn deleting_at; thử lại hoàn tất", async () => {
    const h = createHarness();
    await seedBob(h);
    const real = h.env.DB;
    let fail = true;
    h.env.DB = new Proxy(real, {
      get(target, prop) {
        if (prop !== "batch") return Reflect.get(target, prop) as unknown;
        return (stmts: { sql: string }[]) => {
          if (fail && stmts.some((s) => s.sql.includes('delete from "user"'))) {
            fail = false;
            return Promise.reject(new Error("d1 down"));
          }
          return target.batch(stmts as never);
        };
      },
    });
    const first = await del(h, "admin", BOB, "bob@example.com");
    expect(first.status).toBe(500);
    expect(h.objects.has("reports/r1.png")).toBe(false);
    expect(row(h, BOB).deleting_at).not.toBeNull();
    const partial = audits(h, "user.delete");
    expect(partial).toHaveLength(1);
    expect(partial[0]).toMatchObject({ status: "partial" });
    expect(JSON.parse(partial[0].meta as string)).toMatchObject({ step: "d1", removed: 3, total: 3 });

    const second = await del(h, "admin", BOB, "bob@example.com");
    expect(second.status).toBe(200);
    expect(row(h, BOB)).toBeUndefined();
    expect(audits(h, "user.delete").map((r) => r.status)).toEqual(["partial", "ok"]);
  });

  it("đang xoá + khoá còn hạn vẫn cho thử lại (không bị 409 user_banned)", async () => {
    const h = createHarness();
    await seedBob(h);
    h.r2Error = new Error("r2 down");
    await del(h, "admin", BOB, "bob@example.com");
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(h.clock.now + DAY, BOB);
    h.r2Error = null;
    expect((await del(h, "admin", BOB, "bob@example.com")).status).toBe(200);
  });

  it("nhiều lô R2 (>1000 khoá): lô sau lỗi sau khi lô đầu đã xoá; thử lại hoàn tất", async () => {
    const h = createHarness();
    const ins = h.sqlite.prepare("insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, 'report', ?, 'image/png', 1, 'pending', 1)");
    h.sqlite.exec("begin");
    for (let i = 0; i < 1001; i++) {
      const key = `pending/k${String(i).padStart(4, "0")}`;
      ins.run(`up${i}`, BOB, key);
      h.objects.set(key, { bytes: PNG_BYTES, contentType: "image/png", uploaded: new Date(0) });
    }
    h.sqlite.exec("commit");
    const calls = recordDeletes(h, 2);
    const first = await del(h, "admin", BOB, "bob@example.com");
    expect(first.status).toBe(502);
    expect(calls.map((c) => c.length)).toEqual([1000, 1]);
    expect(h.objects.size).toBe(1);
    expect(row(h, BOB).deleting_at).not.toBeNull();
    expect(audits(h, "user.delete")[0]).toMatchObject({ status: "failed" });
    expect(JSON.parse(audits(h, "user.delete")[0].meta as string)).toMatchObject({ step: "r2" });

    const second = await del(h, "admin", BOB, "bob@example.com");
    expect(second.status).toBe(200);
    expect(h.objects.size).toBe(0);
    expect(row(h, BOB)).toBeUndefined();
    expect(audits(h, "user.delete.start")).toHaveLength(1);
    expect(audits(h, "user.delete").map((r) => r.status)).toEqual(["failed", "ok"]);
  });

  it("race: hai yêu cầu cùng bắt đầu xoá -> đúng một dòng user.delete.start", async () => {
    const h = createHarness();
    await seedBob(h);
    // Chạy batch khởi đầu hai lần liên tiếp: lần hai là yêu cầu đồng thời thua cuộc.
    const real = h.env.DB;
    let doubled = false;
    h.env.DB = new Proxy(real, {
      get(target, prop) {
        if (prop !== "batch") return Reflect.get(target, prop) as unknown;
        return async (stmts: { sql: string }[]) => {
          const out = await target.batch(stmts as never);
          if (!doubled && stmts.some((s) => s.sql.includes("set deleting_at"))) {
            doubled = true;
            await target.batch(stmts as never);
          }
          return out;
        };
      },
    });
    expect((await del(h, "admin", BOB, "bob@example.com")).status).toBe(200);
    expect(doubled).toBe(true);
    expect(audits(h, "user.delete.start")).toHaveLength(1);
  });

  it("race: batch hoàn tất chạy hai lần (thử lại đồng thời) -> chỉ một dòng user.delete ok, phản hồi 200", async () => {
    const h = createHarness();
    await seedBob(h);
    const real = h.env.DB;
    let doubled = false;
    h.env.DB = new Proxy(real, {
      get(target, prop) {
        if (prop !== "batch") return Reflect.get(target, prop) as unknown;
        return async (stmts: { sql: string }[]) => {
          const out = await target.batch(stmts as never);
          if (!doubled && stmts.some((s) => s.sql.includes('delete from "user"'))) {
            doubled = true;
            await target.batch(stmts as never);
          }
          return out;
        };
      },
    });
    const res = await del(h, "admin", BOB, "bob@example.com");
    expect(res.status).toBe(200);
    expect(doubled).toBe(true);
    expect(audits(h, "user.delete").filter((r) => r.status === "ok")).toHaveLength(1);
    expect(row(h, BOB)).toBeUndefined();
  });

  it("race: đích được đặt khoá còn hạn ngay trước batch khởi đầu -> không xoá, 409, không dòng start, session còn", async () => {
    const h = createHarness();
    beforeBatch(
      h,
      (sqls) => sqls.some((s) => s.includes("set deleting_at")),
      () => void h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(8_640_000_000_000_000, BOB),
    );
    const res = await del(h, "admin", BOB, "bob@example.com");
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("user_banned");
    expect(row(h, BOB).deleting_at).toBeNull();
    expect(count(h, 'session where "userId" = ?', BOB)).toBe(1);
    expect(audits(h)).toHaveLength(0);
  });

  it("user đã xoá xong: gọi lại -> 404", async () => {
    const h = createHarness();
    expect((await del(h, "admin", BOB, "bob@example.com")).status).toBe(200);
    expect((await del(h, "admin", BOB, "bob@example.com")).status).toBe(404);
  });
});

describe("nhật ký: bộ lọc action cho thao tác người dùng", () => {
  it("/api/admin/audit?action= nhận user.ban, user.unban, user.role, user.delete.start, user.delete", async () => {
    const h = createHarness();
    await ban(h, "admin", "u-bob");
    await unban(h, "admin", "u-bob");
    await setRole(h, "admin", "u-alice", "moderator");
    await del(h, "admin", "u-bob", "bob@example.com");
    for (const [action, n] of [["user.ban", 1], ["user.unban", 1], ["user.role", 1], ["user.delete.start", 1], ["user.delete", 1]] as const) {
      const res = await h.request(`/api/admin/audit?action=${action}`, { as: "admin" });
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.items).toHaveLength(n);
      expect(body.items[0].action).toBe(action);
    }
  });
});
