import { describe, expect, it } from "vitest";
import { createHarness, seedSeason, seedTeam, type ApiJson, type Harness } from "./fakes";

const PAGE = "/doi-chuan/s18-abc/";

async function postComment(h: Harness, as: "alice" | "bob" | "admin", body = "Đội mạnh", lang = "vi") {
  return h.request("/api/comments", { as, json: { page: PAGE, lang, body } });
}

describe("comments", () => {
  it("đăng cần đăng nhập; danh sách tách theo lang, mới nhất trước, canDelete theo người xem", async () => {
    const h = createHarness();
    expect((await h.request("/api/comments", { json: { page: PAGE, lang: "vi", body: "x" } })).status).toBe(401);

    const created = await postComment(h, "alice", "  thứ nhất  ");
    expect(created.status).toBe(201);
    expect(await created.json<ApiJson>()).toMatchObject({ body: "thứ nhất", lang: "vi", canDelete: true, author: { id: "u-alice", name: "Alice" } });
    h.clock.now += 1000;
    await postComment(h, "bob", "thứ hai");
    await postComment(h, "bob", "阵容很强", "zh");

    const vi = await (await h.request(`/api/comments?page=${PAGE}&lang=vi`, { as: "alice" })).json<ApiJson>();
    expect(vi.items.map((i: { body: string }) => i.body)).toEqual(["thứ hai", "thứ nhất"]);
    expect(vi.items.map((i: { canDelete: boolean }) => i.canDelete)).toEqual([false, true]);
    expect(vi.nextCursor).toBeNull();

    const zh = await (await h.request(`/api/comments?page=${PAGE}&lang=zh`)).json<ApiJson>();
    expect(zh.items).toHaveLength(1);
    expect(zh.items[0]).toMatchObject({ body: "阵容很强", canDelete: false });

    const asAdmin = await (await h.request(`/api/comments?page=${PAGE}&lang=vi`, { as: "admin" })).json<ApiJson>();
    expect(asAdmin.items.every((i: { canDelete: boolean }) => i.canDelete)).toBe(true);
  });

  it("phân trang 20/trang bằng con trỏ, không trùng/sót khi cùng thời điểm", async () => {
    const h = createHarness();
    for (let i = 0; i < 9; i++) await postComment(h, "alice", `c${i}`);
    h.clock.now += 3_600_000;
    for (let i = 9; i < 18; i++) await postComment(h, "alice", `c${i}`);
    h.clock.now += 3_600_000;
    for (let i = 18; i < 25; i++) await postComment(h, "bob", `c${i}`);
    const first = await (await h.request(`/api/comments?page=${PAGE}&lang=vi`)).json<ApiJson>();
    expect(first.items).toHaveLength(20);
    const second = await (await h.request(`/api/comments?page=${PAGE}&lang=vi&cursor=${first.nextCursor}`)).json<ApiJson>();
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const all = [...first.items, ...second.items].map((i: { body: string }) => i.body);
    expect(new Set(all).size).toBe(25);
  });

  it("xoá: người khác 403, tác giả và admin được; không tồn tại 404", async () => {
    const h = createHarness();
    const a = await (await postComment(h, "alice")).json<ApiJson>();
    const b = await (await postComment(h, "alice")).json<ApiJson>();
    expect((await h.request(`/api/comments/${a.id}`, { method: "DELETE" })).status).toBe(401);
    const denied = await h.request(`/api/comments/${a.id}`, { as: "bob", method: "DELETE" });
    expect(denied.status).toBe(403);
    expect((await h.request(`/api/comments/${a.id}`, { as: "alice", method: "DELETE" })).status).toBe(200);
    expect(await (await h.request(`/api/comments/${b.id}`, { as: "admin", method: "DELETE" })).json<ApiJson>()).toEqual({ ok: true });
    expect((await h.request(`/api/comments/${b.id}`, { as: "admin", method: "DELETE" })).status).toBe(404);
  });

  it("rate limit 10 bình luận/giờ/user: lượt 11 bị 429, giờ sau mở lại, user khác không bị ảnh hưởng", async () => {
    const h = createHarness();
    h.clock.now = Date.UTC(2026, 8, 27, 10, 0, 0);
    for (let i = 0; i < 10; i++) expect((await postComment(h, "alice")).status).toBe(201);
    h.clock.now = Date.UTC(2026, 8, 27, 10, 59, 30);
    const blocked = await postComment(h, "alice");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("30");
    expect((await blocked.json<ApiJson>()).error.code).toBe("rate_limited");
    expect((await postComment(h, "bob")).status).toBe(201);
    h.clock.now = Date.UTC(2026, 8, 27, 11, 0, 0);
    expect((await postComment(h, "alice")).status).toBe(201);
  });

  it("admin xem bình luận toàn site; người thường bị 403", async () => {
    const h = createHarness();
    await postComment(h, "alice");
    expect((await h.request("/api/admin/comments", { as: "bob" })).status).toBe(403);
    const res = await (await h.request("/api/admin/comments", { as: "admin" })).json<ApiJson>();
    expect(res.items[0]).toMatchObject({ page: PAGE, lang: "vi" });
  });
});

describe("bình luận trên trang đội cộng đồng", () => {
  const TEAM = "/doi-cong-dong/t1/";
  const post = (h: Harness, as: "alice" | "bob", page = TEAM, lang = "vi") => h.request("/api/comments", { as, json: { page, lang, body: "hay" } });
  const post2 = (h: Harness, as: "alice" | "bob", lang: string, page = TEAM) => h.request("/api/comments", { as, json: { page, lang, body: `n-${lang}` } });

  it("mùa đóng vẫn 201; đội pending -> 404; đội đang xoá -> 404", async () => {
    const h = createHarness();
    seedSeason(h, "s0", 5);
    await seedTeam(h, { id: "t1", season: "s0" });
    await seedTeam(h, { id: "t2", status: "pending", season: "s0" });
    await seedTeam(h, { id: "t3", season: "s0" });
    h.sqlite.prepare("update community_teams set deleting_at = 1 where id = 't3'").run();
    expect((await post(h, "bob")).status).toBe(201);
    const pending = await post(h, "bob", "/doi-cong-dong/t2/");
    expect(pending.status).toBe(404);
    expect((await pending.json<ApiJson>()).error.code).toBe("not_found");
    expect((await post(h, "bob", "/doi-cong-dong/t3/")).status).toBe(404);
    expect((await post(h, "bob", "/doi-cong-dong/khong-co/")).status).toBe(404);
    expect(h.sqlite.prepare("select count(*) as n from comments").get()).toMatchObject({ n: 1 });
  });

  it("GET gộp vi + zh (item vẫn có lang); đội pending -> []; đội chuẩn vẫn lọc lang", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    await seedTeam(h, { id: "t2", status: "pending" });
    h.clock.now += 1000;
    await post2(h, "bob", "vi");
    h.clock.now += 1000;
    await post2(h, "bob", "zh");
    h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values ('cp', '/doi-cong-dong/t2/', 'vi', 'u-bob', 'x', 1)").run();
    for (const lang of ["vi", "zh"]) {
      const res = await (await h.request(`/api/comments?page=${TEAM}&lang=${lang}`)).json<ApiJson>();
      expect(res.items.map((i: { lang: string }) => i.lang)).toEqual(["zh", "vi"]);
    }
    expect((await (await h.request("/api/comments?page=/doi-cong-dong/t2/&lang=vi")).json<ApiJson>()).items).toEqual([]);
    await postComment(h, "alice", "chuẩn vi");
    await postComment(h, "alice", "chuẩn zh", "zh");
    const std = await (await h.request(`/api/comments?page=${PAGE}&lang=zh`)).json<ApiJson>();
    expect(std.items.map((i: { body: string }) => i.body)).toEqual(["chuẩn zh"]);
  });
});
