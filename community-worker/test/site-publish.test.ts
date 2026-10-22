// repository_dispatch `site-publish`: gửi đúng ở 5 điểm đổi hiển thị công khai, không gửi ở nơi khác, lỗi không rollback.

import { describe, expect, it } from "vitest";
import { createHarness, seedSeason, seedTeam, type Harness } from "./fakes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();

const ADMIN = "/api/admin/community-teams";
const DAY = 86_400_000;

const audit = (h: Harness, action: string) => {
  const rows = h.sqlite.prepare("select * from admin_audit where action = ? order by created_at, rowid").all(action) as unknown as {
    status: string;
    meta: string | null;
  }[];
  return rows.map((r) => ({ status: r.status, meta: r.meta ? JSON.parse(r.meta) : null }));
};

const approve = (h: Harness, id: string) => h.request(`${ADMIN}/${id}/approve`, { as: "moderator", json: {} });
const reject = (h: Harness, id: string) => h.request(`${ADMIN}/${id}/reject`, { as: "moderator", json: { reason: "Ảnh mờ" } });
const delTeam = (h: Harness, id: string, as: string) => h.request(`/api/community-teams/${id}`, { as, method: "DELETE", json: { reason: "spam" } });
const ban = (h: Harness, as: string, id: string, body: unknown = { duration: "7d", reason: "spam" }) =>
  h.request(`/api/admin/users/${id}/ban`, { as, json: body });
const unban = (h: Harness, as: string, id: string) => h.request(`/api/admin/users/${id}/unban`, { as, method: "POST" });
const delUser = (h: Harness, id: string, email: string) => h.request(`/api/admin/users/${id}`, { as: "admin", method: "DELETE", json: { confirmEmail: email } });

async function withPending(): Promise<Harness> {
  const h = createHarness();
  seedSeason(h, "s1");
  await seedTeam(h, { id: "t1", status: "pending" });
  return h;
}

describe("site-publish: duyệt", () => {
  it("D1: approve gửi đúng 1 event; audit meta.deploy ok; approve lần hai 409 không thêm fetch", async () => {
    const h = await withPending();
    const res = await approve(h, "t1");
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: "t1", status: "approved", deploy: { ok: true, status: 200 } });
    expect(h.fetchCalls).toHaveLength(1);
    expect(JSON.parse(String(h.fetchCalls[0].init?.body))).toEqual({ event_type: "site-publish" });
    expect(audit(h, "team.approve")).toEqual([{ status: "ok", meta: { deploy: "ok" } }]);
    expect((await approve(h, "t1")).status).toBe(409);
    expect(h.fetchCalls).toHaveLength(1);
  });

  it("D2: reject không gửi; reject gọi lại sau R2 lỗi cũng không", async () => {
    const h = await withPending();
    expect((await reject(h, "t1")).status).toBe(200);
    expect(h.fetchCalls).toHaveLength(0);

    const h2 = await withPending();
    h2.failR2On({ op: "delete", nth: 1 });
    expect((await reject(h2, "t1")).status).toBe(502);
    h2.clock.now += 1000; // lần gọi lại chỉ nhận khi lần chốt trước ở mili-giây khác
    expect((await reject(h2, "t1")).status).toBe(200);
    expect(h2.fetchCalls).toHaveLength(0);
    expect(audit(h2, "team.reject")[0].meta).toBeNull();
  });
});

describe("site-publish: xoá đội", () => {
  it("D3: chủ xoá -> 1 fetch; staff xoá -> 1 fetch + audit byAuthor/deploy ok", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    expect((await delTeam(h, "t1", "alice")).status).toBe(200);
    expect(h.fetchCalls).toHaveLength(1);

    const h2 = createHarness();
    seedSeason(h2, "s1");
    await seedTeam(h2, { id: "t1" });
    expect((await delTeam(h2, "t1", "moderator")).status).toBe(200);
    expect(h2.fetchCalls).toHaveLength(1);
    const [row] = audit(h2, "team.delete");
    expect(row.status).toBe("ok");
    expect(row.meta).toMatchObject({ deploy: "ok" });
    expect(row.meta.byAuthor).toBeTruthy();
  });

  it("D3: R2 lỗi -> 502 nhưng đã 1 fetch; gọi lại -> 200 không thêm fetch", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    h.failR2On({ op: "delete", nth: 1 });
    expect((await delTeam(h, "t1", "alice")).status).toBe(502);
    expect(h.fetchCalls).toHaveLength(1);
    expect((await delTeam(h, "t1", "alice")).status).toBe(200);
    expect(h.fetchCalls).toHaveLength(1);
  });

  it("D3: chủ gặp has_evidence 409 -> 0 fetch", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    h.sqlite
      .prepare(
        "insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, status, created_at) values ('rp1', '/doi-cong-dong/t1/', 'vi', 'u-bob', null, 'win', '[\"a\"]', '[]', 'approved', 1)",
      )
      .run();
    const res = await delTeam(h, "t1", "alice");
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("has_evidence");
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("M1: chủ xoá đội pending/rejected -> 0 fetch; staff xoá pending -> 0 fetch, audit không deploy; staff xoá approved -> 1 fetch", async () => {
    for (const status of ["pending", "rejected"] as const) {
      const h = createHarness();
      seedSeason(h, "s1");
      await seedTeam(h, { id: "t1", status });
      expect((await delTeam(h, "t1", "alice")).status).toBe(200);
      expect(h.fetchCalls).toHaveLength(0);
    }
    const h2 = createHarness();
    seedSeason(h2, "s1");
    await seedTeam(h2, { id: "t1", status: "pending" });
    const res = await delTeam(h2, "t1", "moderator");
    expect(res.status).toBe(200);
    expect(h2.fetchCalls).toHaveLength(0);
    const [row] = audit(h2, "team.delete");
    expect(row.status).toBe("ok");
    expect(row.meta.deploy).toBeUndefined();
    const h3 = createHarness();
    seedSeason(h3, "s1");
    await seedTeam(h3, { id: "t1", status: "approved" });
    expect((await delTeam(h3, "t1", "moderator")).status).toBe(200);
    expect(h3.fetchCalls).toHaveLength(1);
  });

  it("Low2: dispatch timeout -> ok:false, xoá vẫn hoàn tất, fetch có signal", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    h.setFetch(() => {
      throw new DOMException("timeout", "TimeoutError");
    });
    const res = await delTeam(h, "t1", "moderator");
    expect(res.status).toBe(200);
    expect((await json(res)).deploy).toMatchObject({ ok: false });
    expect(h.fetchCalls[0].init?.signal).toBeInstanceOf(AbortSignal);
    expect(h.sqlite.prepare("select count(*) as n from community_teams where id = 't1'").get()).toEqual({ n: 0 });
  });

  it("Low3: chỉ staff nhận `deploy`; chủ nhận {ok:true}", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    expect(await json(await delTeam(h, "t1", "alice"))).toEqual({ ok: true });
    const h2 = createHarness();
    seedSeason(h2, "s1");
    await seedTeam(h2, { id: "t1" });
    expect((await json(await delTeam(h2, "t1", "moderator"))).deploy).toMatchObject({ ok: true });
  });
});

describe("site-publish: khoá / xoá tài khoản", () => {
  it("D4: ban -> 1 fetch, meta giữ duration/until/votesRemoved + deploy; bị từ chối -> 0", async () => {
    const h = createHarness();
    const res = await ban(h, "admin", "u-bob");
    expect(res.status).toBe(200);
    expect(h.fetchCalls).toHaveLength(1);
    expect(audit(h, "user.ban")).toEqual([
      { status: "ok", meta: { duration: "7d", until: h.clock.now + 7 * DAY, votesRemoved: 0, deploy: "ok" } },
    ]);

    const h2 = createHarness();
    await ban(h2, "admin", "u-bob", { duration: "permanent", reason: "root ban" });
    h2.fetchCalls.length = 0;
    expect((await ban(h2, "moderator", "u-bob", { duration: "1d", reason: "ngắn hơn" })).status).toBe(403);
    expect(h2.fetchCalls).toHaveLength(0);
  });

  it("D4: unban -> 1 fetch, audit deploy ok; not_banned 409 -> 0", async () => {
    const h = createHarness();
    await ban(h, "admin", "u-bob");
    h.fetchCalls.length = 0;
    expect((await unban(h, "admin", "u-bob")).status).toBe(200);
    expect(h.fetchCalls).toHaveLength(1);
    const [row] = audit(h, "user.unban");
    expect(row.status).toBe("ok");
    expect(row.meta).toMatchObject({ previousReason: "spam", deploy: "ok" });

    h.fetchCalls.length = 0;
    expect((await unban(h, "admin", "u-bob")).status).toBe(409);
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("D5: xoá user pha 1 -> 1 fetch, user.delete.start deploy ok; R2 lỗi 502 rồi gọi lại -> không thêm fetch", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1", author: "u-alice" });
    h.failR2On({ op: "delete", nth: 1 });
    expect((await delUser(h, "u-alice", "alice@example.com")).status).toBe(502);
    expect(h.fetchCalls).toHaveLength(1);
    expect(audit(h, "user.delete.start")).toEqual([{ status: "ok", meta: { deploy: "ok" } }]);
    expect((await delUser(h, "u-alice", "alice@example.com")).status).toBe(200);
    expect(h.fetchCalls).toHaveLength(1);
  });
});

describe("site-publish: không gửi / lỗi", () => {
  it("D6: đổi vai trò và mở mùa không gửi", async () => {
    const h = createHarness();
    expect((await h.request("/api/admin/users/u-bob/role", { as: "admin", json: { role: "moderator" } })).status).toBe(200);
    seedSeason(h, "s1");
    const season = await h.request("/api/admin/community-seasons", { as: "admin", json: { id: "s2", labelVi: "Mùa 2", labelZh: "赛季2" } });
    expect(season.status).toBe(201);
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("D7: dispatch 500 -> approve vẫn 200, audit partial; fetch ném -> unreachable; thiếu token -> not_configured, 0 fetch", async () => {
    const h = await withPending();
    h.setFetch(() => new Response("x", { status: 500 }));
    const res = await approve(h, "t1");
    expect(res.status).toBe(200);
    expect((await json(res)).deploy).toMatchObject({ ok: false, status: 500 });
    expect(h.sqlite.prepare("select status from community_teams where id = 't1'").get()).toEqual({ status: "approved" });
    expect(audit(h, "team.approve")).toEqual([{ status: "partial", meta: { deploy: { ok: false, status: 500 } } }]);

    const h2 = await withPending();
    h2.setFetch(() => {
      throw new Error("network");
    });
    expect((await json(await approve(h2, "t1"))).deploy.error).toBe("deploy_hook_unreachable");

    const h3 = createHarness({ GITHUB_DISPATCH_TOKEN: "" });
    seedSeason(h3, "s1");
    await seedTeam(h3, { id: "t1", status: "pending" });
    expect((await json(await approve(h3, "t1"))).deploy.error).toBe("deploy_hook_not_configured");
    expect(h3.fetchCalls).toHaveLength(0);
  });
});
