// API duyệt đội cộng đồng + quản trị mùa: duyệt/từ chối nguyên tử, audit đúng một dòng, xoá ảnh từ chối gọi lại được.

import { describe, expect, it } from "vitest";
import { createHarness, seedSeason, seedTeam, type Harness } from "./fakes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();

const ADMIN = "/api/admin/community-teams";
const SEASONS = "/api/admin/community-seasons";
const count = (h: Harness, sql: string, ...args: (string | number)[]): number => (h.sqlite.prepare(sql).get(...args) as { n: number }).n;
const audits = (h: Harness, action: string) =>
  h.sqlite.prepare("select * from admin_audit where action = ? order by created_at, id").all(action) as Record<string, unknown>[];
const teamKeys = (h: Harness) => [...h.objects.keys()].filter((k) => k.startsWith("community-teams/"));
const approve = (h: Harness, id: string, as = "moderator") => h.request(`${ADMIN}/${id}/approve`, { as, json: {} });
const reject = (h: Harness, id: string, as = "moderator", reason: unknown = "Ảnh mờ") => h.request(`${ADMIN}/${id}/reject`, { as, json: { reason } });

async function pending(): Promise<Harness> {
  const h = createHarness();
  seedSeason(h, "s1");
  await seedTeam(h, { id: "t1", status: "pending", images: 2 });
  return h;
}

describe("duyệt đội", () => {
  it("KDV duyệt -> đội vào danh sách công khai, đúng 1 audit team.approve với tác giả", async () => {
    const h = await pending();
    expect((await json(await h.request("/api/community-teams"))).items).toHaveLength(0);
    const res = await approve(h, "t1");
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ id: "t1", status: "approved", deploy: { ok: true, status: 200 } });
    expect((await json(await h.request("/api/community-teams"))).items.map((i: { id: string }) => i.id)).toEqual(["t1"]);
    const rows = audits(h, "team.approve");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ target_type: "team", target_id: "t1", target_label: "Đội t1", subject_user_id: "u-alice", actor_id: "u-moderator", status: "ok" });
    expect(h.sqlite.prepare("select status, reviewed_by, reviewed_at from community_teams where id = 't1'").get()).toMatchObject({
      status: "approved",
      reviewed_by: "u-moderator",
      reviewed_at: h.clock.now,
    });
  });

  it("KDV tự duyệt đội của mình được (quyết định 261016)", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1", status: "pending", author: "u-moderator" });
    expect((await approve(h, "t1")).status).toBe(200);
    expect(audits(h, "team.approve")).toHaveLength(1);
  });

  it("duyệt lại -> 409 not_pending, không thêm audit; id không có/đang xoá -> 404; user thường 403, khách 401", async () => {
    const h = await pending();
    expect((await approve(h, "t1")).status).toBe(200);
    const again = await approve(h, "t1");
    expect(again.status).toBe(409);
    expect((await json(again)).error.code).toBe("not_pending");
    expect(audits(h, "team.approve")).toHaveLength(1);
    expect((await approve(h, "nope")).status).toBe(404);
    await seedTeam(h, { id: "t2", status: "pending" });
    h.sqlite.prepare("update community_teams set deleting_at = 1 where id = 't2'").run();
    expect((await approve(h, "t2")).status).toBe(404);
    expect(audits(h, "team.approve")).toHaveLength(1);
    expect((await approve(h, "t1", "bob")).status).toBe(403);
    expect((await h.request(`${ADMIN}/t1/approve`, { json: {} })).status).toBe(401);
  });

  it("hai KDV duyệt cùng lúc -> một 200, một 409, đúng 1 audit", async () => {
    const h = await pending();
    h.sqlite.prepare('update "user" set role = \'moderator\' where id = \'u-bob\'').run();
    const res = await Promise.all([approve(h, "t1", "moderator"), approve(h, "t1", "bob")]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(audits(h, "team.approve")).toHaveLength(1);
  });

  it("cùng một KDV duyệt hai lần, đồng hồ cố định (cùng mili-giây) -> một 200, một 409, đúng 1 audit", async () => {
    const h = await pending();
    const res = await Promise.all([approve(h, "t1"), approve(h, "t1")]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(audits(h, "team.approve")).toHaveLength(1);
  });
});

describe("từ chối đội", () => {
  it("thiếu/rỗng/quá dài lý do -> 400, đội còn pending, ảnh còn", async () => {
    const h = await pending();
    for (const body of [{}, { reason: "" }, { reason: "   " }, { reason: "x".repeat(501) }]) {
      expect((await h.request(`${ADMIN}/t1/reject`, { as: "moderator", json: body })).status).toBe(400);
    }
    expect(h.sqlite.prepare("select status from community_teams where id = 't1'").get()).toMatchObject({ status: "pending" });
    expect(teamKeys(h)).toHaveLength(2);
    expect(audits(h, "team.reject")).toHaveLength(0);
  });

  it("có lý do -> chủ thấy rejectReason, R2 + dòng ảnh bị xoá, imageCount 0, 1 audit có lý do", async () => {
    const h = await pending();
    const res = await reject(h, "t1");
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ id: "t1", status: "rejected", rejectReason: "Ảnh mờ" });
    expect(teamKeys(h)).toEqual([]);
    expect(count(h, "select count(*) n from community_team_images where team_id = 't1'")).toBe(0);
    const mine = await json(await h.request("/api/me/community-teams", { as: "alice" }));
    expect(mine.items[0]).toMatchObject({ id: "t1", status: "rejected", rejectReason: "Ảnh mờ", imageCount: 0 });
    const rows = audits(h, "team.reject");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ target_id: "t1", subject_user_id: "u-alice", reason: "Ảnh mờ", actor_id: "u-moderator" });
    expect((await reject(h, "t1")).status).toBe(409);
    expect(audits(h, "team.reject")).toHaveLength(1);
  });

  it("R2 lỗi -> 502 delete_incomplete, đội đã rejected, ảnh còn, 1 audit; gọi lại -> 200, ảnh hết, vẫn 1 audit", async () => {
    const h = await pending();
    h.failR2On({ op: "delete", nth: 1 });
    const res = await reject(h, "t1");
    expect(res.status).toBe(502);
    expect((await json(res)).error.code).toBe("delete_incomplete");
    expect(h.sqlite.prepare("select status, reject_reason from community_teams where id = 't1'").get()).toMatchObject({ status: "rejected", reject_reason: "Ảnh mờ" });
    expect(count(h, "select count(*) n from community_team_images where team_id = 't1'")).toBe(2);
    expect(audits(h, "team.reject")).toHaveLength(1);
    h.clock.now += 1000;
    const retry = await reject(h, "t1", "moderator", "Lý do khác");
    expect(retry.status).toBe(200);
    expect((await json(retry)).rejectReason).toBe("Ảnh mờ");
    expect(count(h, "select count(*) n from community_team_images where team_id = 't1'")).toBe(0);
    expect(teamKeys(h)).toEqual([]);
    expect(audits(h, "team.reject")).toHaveLength(1);
    expect((await reject(h, "t1")).status).toBe(409);
  });

  it("duyệt và từ chối cùng lúc -> một 200, một 409; duyệt thắng thì ảnh còn nguyên", async () => {
    for (const first of ["approve", "reject"] as const) {
      const h = await pending();
      const calls = first === "approve" ? [approve(h, "t1"), reject(h, "t1")] : [reject(h, "t1"), approve(h, "t1")];
      const res = await Promise.all(calls);
      expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
      const status = (h.sqlite.prepare("select status from community_teams where id = 't1'").get() as { status: string }).status;
      expect(audits(h, "team.approve").length + audits(h, "team.reject").length).toBe(1);
      if (status === "approved") expect(teamKeys(h)).toHaveLength(2);
      else expect(teamKeys(h)).toEqual([]);
    }
  });

  it("cùng một KDV từ chối hai lần, đồng hồ cố định -> một 200, một 409, đúng 1 audit", async () => {
    const h = await pending();
    const res = await Promise.all([reject(h, "t1"), reject(h, "t1")]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(audits(h, "team.reject")).toHaveLength(1);
  });

  it("đội đã duyệt không từ chối được (409), ảnh giữ nguyên", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1", status: "approved" });
    const res = await reject(h, "t1");
    expect(res.status).toBe(409);
    expect(teamKeys(h)).toHaveLength(1);
  });
});

describe("GET /api/admin/community-teams", () => {
  it("mặc định pending; lọc status; staff mới xem; email che cho KDV, đầy đủ cho root; kèm rejectReason", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1", status: "pending" });
    await seedTeam(h, { id: "t2", status: "approved" });
    await seedTeam(h, { id: "t3", status: "rejected", rejectReason: "sai" });
    const mod = await json(await h.request(ADMIN, { as: "moderator" }));
    expect(mod.items.map((i: { id: string }) => i.id)).toEqual(["t1"]);
    expect(mod.items[0].author).toMatchObject({ id: "u-alice", name: "Alice", emailMasked: true });
    expect(mod.items[0].author.email).not.toBe("alice@example.com");
    expect(mod.items[0]).toMatchObject({ status: "pending", rejectReason: null });
    const root = await json(await h.request(`${ADMIN}?status=rejected`, { as: "admin" }));
    expect(root.items).toHaveLength(1);
    expect(root.items[0]).toMatchObject({ id: "t3", status: "rejected", rejectReason: "sai" });
    expect(root.items[0].author.email).toBe("alice@example.com");
    expect(root.items[0].author.emailMasked).toBeUndefined();
    expect((await h.request(`${ADMIN}?status=all`, { as: "admin" })).status).toBe(400);
    expect((await h.request(ADMIN, { as: "bob" })).status).toBe(403);
    expect((await h.request(ADMIN)).status).toBe(401);
  });

  it("không lọc hiển thị (tác giả bị khoá vẫn thấy) và phân trang 20/trang", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    for (let i = 0; i < 22; i++) await seedTeam(h, { id: `t${String(i).padStart(2, "0")}`, status: "pending", images: 0, createdAt: 1000 + i });
    h.sqlite.prepare('update "user" set banned_until = 9999999999999 where id = \'u-alice\'').run();
    const first = await json(await h.request(ADMIN, { as: "admin" }));
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await json(await h.request(`${ADMIN}?cursor=${first.nextCursor}`, { as: "admin" }));
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(22);
  });

  it("status=deleting: chỉ đội xoá dở (mọi trạng thái), để staff gọi lại DELETE; các lọc khác bỏ đội xoá dở", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1", status: "pending" });
    await seedTeam(h, { id: "t2", status: "approved" });
    h.sqlite.prepare("update community_teams set deleting_at = 1 where id in ('t1', 't2')").run();
    await seedTeam(h, { id: "t3", status: "pending" });
    const deleting = await json(await h.request(`${ADMIN}?status=deleting`, { as: "moderator" }));
    expect(deleting.items.map((i: { id: string }) => i.id).sort()).toEqual(["t1", "t2"]);
    expect(deleting.items[0].deleting).toBe(true);
    const pendingList = await json(await h.request(ADMIN, { as: "moderator" }));
    expect(pendingList.items.map((i: { id: string }) => i.id)).toEqual(["t3"]);
    expect(pendingList.items[0].deleting).toBe(false);
    const counts = await json(await h.request("/api/admin/counts", { as: "moderator" }));
    expect(counts.teamsPending).toBe(1);
  });
});

describe("POST /api/admin/community-seasons", () => {
  const body = (id: string) => ({ id, labelVi: `Mùa ${id}`, labelZh: `赛季${id}` });

  it("root mở A rồi B: A đóng, B mở; audit season.open meta.previous", async () => {
    const h = createHarness();
    const a = await h.request(SEASONS, { as: "admin", json: body("a") });
    expect(a.status).toBe(201);
    expect(await json(a)).toEqual({ id: "a", labelVi: "Mùa a", labelZh: "赛季a", openedAt: new Date(h.clock.now).toISOString(), closedAt: null, previous: null });
    h.clock.now += 1000;
    const b = await h.request(SEASONS, { as: "admin", json: body("b") });
    expect(b.status).toBe(201);
    expect((await json(b)).previous).toBe("a");
    expect(h.sqlite.prepare("select closed_at from community_seasons where id = 'a'").get()).toMatchObject({ closed_at: h.clock.now });
    expect(h.sqlite.prepare("select closed_at from community_seasons where id = 'b'").get()).toMatchObject({ closed_at: null });
    const listed = await json(await h.request("/api/community-seasons"));
    expect(listed.open.id).toBe("b");
    const rows = audits(h, "season.open");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ target_type: "season", target_id: "b", target_label: "b", subject_user_id: null, actor_id: "u-admin" });
    expect(JSON.parse(rows[1].meta as string)).toEqual({ previous: "a" });
    expect(JSON.parse(rows[0].meta as string)).toEqual({ previous: null });
  });

  it("trùng id -> 409 season_exists, mùa đang mở không đổi, không audit mới", async () => {
    const h = createHarness();
    seedSeason(h, "a", 5, 1);
    seedSeason(h, "b");
    const res = await h.request(SEASONS, { as: "admin", json: body("a") });
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("season_exists");
    expect(h.sqlite.prepare("select closed_at from community_seasons where id = 'b'").get()).toMatchObject({ closed_at: null });
    expect(audits(h, "season.open")).toHaveLength(0);
  });

  it("mùa khác được mở chen giữa lúc đọc và batch -> 409 season_conflict, không đổi gì, không audit", async () => {
    const h = createHarness();
    seedSeason(h, "a");
    h.beforeNextBatch(() => {
      h.sqlite.prepare("update community_seasons set closed_at = 5 where closed_at is null").run();
      h.sqlite.prepare("insert into community_seasons (id, label_vi, label_zh, opened_at) values ('x', 'x', 'x', 6)").run();
    });
    const res = await h.request(SEASONS, { as: "admin", json: body("b") });
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("season_conflict");
    expect(h.sqlite.prepare("select id from community_seasons where closed_at is null").get()).toMatchObject({ id: "x" });
    expect(count(h, "select count(*) n from community_seasons where id = 'b'")).toBe(0);
    expect(audits(h, "season.open")).toHaveLength(0);
  });

  it("KDV 403, user 403, khách 401, id sai 400; không đổi gì", async () => {
    const h = createHarness();
    seedSeason(h, "a");
    expect((await h.request(SEASONS, { as: "moderator", json: body("b") })).status).toBe(403);
    expect((await h.request(SEASONS, { as: "bob", json: body("b") })).status).toBe(403);
    expect((await h.request(SEASONS, { json: body("b") })).status).toBe(401);
    expect((await h.request(SEASONS, { as: "admin", json: body("Bad Id") })).status).toBe(400);
    expect((await h.request(SEASONS, { as: "admin", json: body("all") })).status).toBe(400);
    expect(count(h, "select count(*) n from community_seasons")).toBe(1);
    expect(h.sqlite.prepare("select closed_at from community_seasons where id = 'a'").get()).toMatchObject({ closed_at: null });
  });
});
