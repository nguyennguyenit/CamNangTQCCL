import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RATE_RULES } from "../src/ratelimit";
import { API_TOKEN_MAX_ACTIVE } from "../src/tokens";
import { createHarness, type Harness } from "./fakes";

interface TokenView {
  id: string;
  name: string;
  hint: string;
  scope: string;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
}
interface CreateBody {
  token: string;
  item: TokenView;
}

const DAY = 86_400_000;

async function create(h: Harness, as: string, json: unknown = { name: "tqkh", expiresInDays: 90 }) {
  return h.request("/api/tokens", { as, json });
}

async function created(h: Harness, as = "alice", json?: unknown): Promise<CreateBody> {
  const res = await create(h, as, json);
  expect(res.status).toBe(201);
  return res.json<CreateBody>();
}

async function list(h: Harness, as = "alice"): Promise<TokenView[]> {
  const res = await h.request("/api/tokens", { as });
  expect(res.status).toBe(200);
  return (await res.json<{ items: TokenView[] }>()).items;
}

const rows = (h: Harness) => h.sqlite.prepare("select * from api_tokens order by created_at, id").all() as Record<string, unknown>[];

describe("token API cá nhân: quản lý", () => {
  it("cần đăng nhập cho tạo, liệt kê, thu hồi", async () => {
    const h = createHarness();
    expect((await h.request("/api/tokens")).status).toBe(401);
    expect((await create(h, "")).status).toBe(401);
    expect((await h.request("/api/tokens/x", { method: "DELETE" })).status).toBe(401);
  });

  it("tạo trả token thô một lần; DB chỉ giữ SHA-256; liệt kê không lộ token/hash", async () => {
    const h = createHarness();
    const body = await created(h);
    expect(body.token).toMatch(/^tqccl_pat_[A-Za-z0-9_-]{43}$/u);
    expect(body.item).toMatchObject({ name: "tqkh", scope: "recruit:write", hint: body.token.slice(-4), lastUsedAt: null, revokedAt: null });
    expect(body.item.expiresAt).toBe(h.clock.now + 90 * DAY);
    const [row] = rows(h);
    expect(row.token_hash).toBe(createHash("sha256").update(body.token).digest("hex"));
    expect(JSON.stringify(rows(h))).not.toContain(body.token);
    const items = await list(h);
    expect(items).toEqual([body.item]);
    expect(JSON.stringify(items)).not.toContain(String(row.token_hash));
    const second = await created(h);
    expect(second.token).not.toBe(body.token);
  });

  it.each([
    [30, 30 * DAY],
    [365, 365 * DAY],
    [null, null],
  ])("hạn %s ngày", async (days, ttl) => {
    const h = createHarness();
    const { item } = await created(h, "alice", { name: "a", expiresInDays: days });
    expect(item.expiresAt).toBe(ttl === null ? null : h.clock.now + ttl);
  });

  it("thiếu expiresInDays -> mặc định 90 ngày", async () => {
    const h = createHarness();
    const { item } = await created(h, "alice", { name: "a" });
    expect(item.expiresAt).toBe(h.clock.now + 90 * DAY);
  });

  it.each([
    ["hạn lạ", { name: "a", expiresInDays: 7 }],
    ["hạn chuỗi", { name: "a", expiresInDays: "90" }],
    ["thiếu tên", { expiresInDays: 90 }],
    ["tên rỗng", { name: "  ", expiresInDays: 90 }],
    ["tên quá dài", { name: "x".repeat(41), expiresInDays: 90 }],
  ])("body không hợp lệ -> 400 (%s)", async (_label, json) => {
    const h = createHarness();
    expect((await create(h, "alice", json)).status).toBe(400);
    expect(rows(h)).toEqual([]);
  });

  it(`tối đa ${API_TOKEN_MAX_ACTIVE} token còn hiệu lực; thu hồi/hết hạn không tính`, async () => {
    const h = createHarness();
    const first = await created(h, "alice", { name: "short", expiresInDays: 30 });
    for (let i = 1; i < API_TOKEN_MAX_ACTIVE; i++) await created(h);
    const full = await create(h, "alice");
    expect(full.status).toBe(409);
    expect((await full.json<{ error: { code: string } }>()).error.code).toBe("token_limit");
    expect((await h.request(`/api/tokens/${first.item.id}`, { as: "alice", method: "DELETE" })).status).toBe(200);
    await created(h);
    h.clock.now += 31 * DAY;
    expect((await create(h, "alice")).status).toBe(409);
    expect((await create(h, "bob")).status).toBe(201);
  });

  it("tạo token dọn token của chính user đã thu hồi/hết hạn quá hạn lưu; giữ token hợp lệ và của người khác", async () => {
    const h = createHarness();
    const old = { revoked: await created(h, "alice", { name: "old-revoked" }), expired: await created(h, "alice", { name: "old-expired", expiresInDays: 30 }) };
    const stale = await created(h, "alice", { name: "recent-revoked" });
    const active = await created(h, "alice", { name: "active", expiresInDays: null });
    const bobOld = await created(h, "bob", { name: "bob-old", expiresInDays: 30 });
    expect((await h.request(`/api/tokens/${old.revoked.item.id}`, { as: "alice", method: "DELETE" })).status).toBe(200);
    h.clock.now += 31 * DAY; // old-expired hết hạn 1 ngày trước, old-revoked thu hồi 31 ngày trước
    expect((await h.request(`/api/tokens/${stale.item.id}`, { as: "alice", method: "DELETE" })).status).toBe(200);
    // Chưa tạo token mới thì chưa dọn.
    expect(rows(h)).toHaveLength(5);
    h.clock.now += 30 * DAY; // old-expired quá 30 ngày kể từ hết hạn; recent-revoked mới 30 ngày (chưa quá)
    await created(h, "alice", { name: "new" });
    const names = rows(h).map((r) => r.name);
    expect(names).not.toContain("old-revoked");
    expect(names).not.toContain("old-expired");
    expect(names).toEqual(expect.arrayContaining(["recent-revoked", "active", "bob-old", "new"]));
    expect(rows(h)).toHaveLength(4);
    expect(bobOld.item.id).toBeTruthy();
    expect((await list(h)).find((t) => t.id === active.item.id)?.revokedAt).toBeNull();
  });

  it("tạo song song sát trần: chỉ một request qua, không vượt trần", async () => {
    const h = createHarness();
    for (let i = 1; i < API_TOKEN_MAX_ACTIVE; i++) await created(h);
    const statuses = (await Promise.all([create(h, "alice"), create(h, "alice")])).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(rows(h)).toHaveLength(API_TOKEN_MAX_ACTIVE);
  });

  it("thu hồi chỉ token của mình; token người khác/không có -> 404; thu hồi lại giữ mốc cũ", async () => {
    const h = createHarness();
    const { item } = await created(h);
    expect((await h.request(`/api/tokens/${item.id}`, { as: "bob", method: "DELETE" })).status).toBe(404);
    expect((await h.request("/api/tokens/nope", { as: "alice", method: "DELETE" })).status).toBe(404);
    const revokedAt = h.clock.now;
    expect((await h.request(`/api/tokens/${item.id}`, { as: "alice", method: "DELETE" })).status).toBe(200);
    h.clock.now += 1000;
    expect((await h.request(`/api/tokens/${item.id}`, { as: "alice", method: "DELETE" })).status).toBe(200);
    expect((await list(h))[0].revokedAt).toBe(revokedAt);
  });

  it("liệt kê chỉ token của mình, mới nhất trước", async () => {
    const h = createHarness();
    const a1 = await created(h, "alice", { name: "a1" });
    h.clock.now += 1000;
    const a2 = await created(h, "alice", { name: "a2" });
    await created(h, "bob", { name: "b" });
    expect((await list(h)).map((t) => t.id)).toEqual([a2.item.id, a1.item.id]);
  });

  it("chặn tạo token khác origin", async () => {
    const h = createHarness();
    const res = await h.request("/api/tokens", { as: "alice", json: { name: "a" }, headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
    expect(rows(h)).toEqual([]);
  });

  it("rate limit tạo token theo user", async () => {
    const h = createHarness();
    const { limit } = RATE_RULES.token_create;
    for (let i = 0; i < limit; i++) {
      const { item } = await created(h);
      await h.request(`/api/tokens/${item.id}`, { as: "alice", method: "DELETE" });
    }
    expect((await create(h, "alice")).status).toBe(429);
  });

  it("xoá tài khoản -> token của user mất theo cascade", async () => {
    const h = createHarness();
    await created(h, "bob");
    await created(h, "alice");
    const res = await h.request("/api/admin/users/u-bob", { as: "admin", method: "DELETE", json: { confirmEmail: "bob@example.com" } });
    expect(res.status).toBe(200);
    expect(rows(h).map((r) => r.user_id)).toEqual(["u-alice"]);
  });
});
