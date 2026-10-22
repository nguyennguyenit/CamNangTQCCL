// GET /api/community-teams/export: một request trả mọi đội hiển thị công khai (mọi mùa) kèm analysis cho build Astro.

import { describe, expect, it } from "vitest";
import { createHarness, seedSeason, seedTeam, type Harness } from "./fakes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();

const EXPORT = "/api/community-teams/export";
const ids = (body: { items: { id: string }[] }) => body.items.map((i) => i.id);

const ITEM_KEYS = [
  "analysis",
  "approvedAt",
  "author",
  "commentCount",
  "createdAt",
  "downVotes",
  "evidenceCount",
  "heroes",
  "id",
  "imageCount",
  "points",
  "season",
  "tactics",
  "textLang",
  "title",
  "troop",
  "upVotes",
];

describe("export đội cộng đồng", () => {
  it("E1: chỉ đội approved, chưa xoá, tác giả không bị khoá/đang xoá; ban hết hạn và mùa đóng vẫn hiện", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    seedSeason(h, "s0", h.clock.now - 1000);
    await seedTeam(h, { id: "t1" });
    await seedTeam(h, { id: "t2", status: "pending" });
    await seedTeam(h, { id: "t3", status: "rejected" });
    await seedTeam(h, { id: "t4" });
    h.sqlite.prepare("update community_teams set deleting_at = 1 where id = 't4'").run();
    await seedTeam(h, { id: "t5", author: "u-bob" });
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(h.clock.now + 86_400_000, "u-bob");
    await seedTeam(h, { id: "t6", author: "u-admin" });
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(h.clock.now, "u-admin");
    await seedTeam(h, { id: "t7", author: "u-moderator" });
    h.sqlite.prepare('update "user" set deleting_at = 1 where id = ?').run("u-moderator");
    await seedTeam(h, { id: "t8", season: "s0" });

    const res = await h.request(EXPORT);
    expect(res.status).toBe(200);
    expect(ids(await json(res)).sort()).toEqual(["t1", "t6", "t8"]);
  });

  it("E2: đúng bộ khoá schema v1, author chỉ {id,name}, không lộ trường riêng", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1", author: "u-bob", images: 2 });
    const res = await h.request(EXPORT);
    const raw = await res.text();
    const body = JSON.parse(raw);
    expect(body.items).toHaveLength(1);
    const [item] = body.items;
    expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
    expect(Object.keys(item.author)).toEqual(["id", "name"]);
    expect(item).toMatchObject({ id: "t1", author: { id: "u-bob", name: "Bob" }, imageCount: 2, season: { id: "s1" } });
    for (const forbidden of ['"image":', "rejectReason", "email", "img.test", "object_key", "community-teams/"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("E2b: tên rỗng/toàn khoảng trắng -> author.name === null", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1", author: "u-bob" });
    await seedTeam(h, { id: "t2", author: "u-admin" });
    h.sqlite.prepare('update "user" set name = ? where id = ?').run("", "u-bob");
    h.sqlite.prepare('update "user" set name = ? where id = ?').run("   ", "u-admin");
    const body = await json(await h.request(EXPORT));
    expect(body.items).toHaveLength(2);
    for (const item of body.items) expect(item.author.name).toBeNull();
  });

  it("E3: approvedAt = reviewed_at (duyệt qua route) hoặc createdAt (seed); analysis đủ 6 khoá", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1", status: "pending", createdAt: h.clock.now - 5000 });
    await seedTeam(h, { id: "t2", createdAt: h.clock.now - 9000 });
    h.sqlite.prepare("update community_teams set strengths = 'Mạnh', counters = null where id = 't2'").run();
    const ok = await h.request("/api/admin/community-teams/t1/approve", { as: "moderator", json: {} });
    expect(ok.status).toBe(200);

    const body = await json(await h.request(EXPORT));
    const byId = Object.fromEntries(body.items.map((i: { id: string }) => [i.id, i]));
    expect(byId.t1.approvedAt).toBe(new Date(h.clock.now).toISOString());
    expect(byId.t1.createdAt).toBe(new Date(h.clock.now - 5000).toISOString());
    expect(byId.t2.approvedAt).toBe(byId.t2.createdAt);
    expect(Object.keys(byId.t2.analysis).sort()).toEqual(["counteredBy", "counters", "playstyle", "strengths", "substitutes", "weaknesses"]);
    expect(byId.t2.analysis).toEqual({
      playstyle: "Lối chơi thử nghiệm",
      strengths: "Mạnh",
      weaknesses: null,
      counters: null,
      counteredBy: null,
      substitutes: null,
    });
  });

  it("E4: created_at desc, cùng created_at thì id desc", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    const t = h.clock.now;
    await seedTeam(h, { id: "a", createdAt: t });
    await seedTeam(h, { id: "b", createdAt: t });
    await seedTeam(h, { id: "c", createdAt: t + 10 });
    await seedTeam(h, { id: "d", createdAt: t - 10 });
    expect(ids(await json(await h.request(EXPORT)))).toEqual(["c", "b", "a", "d"]);
  });

  it("E5: route không bị :id nuốt; no-store; khách gọi được; :id vẫn hoạt động", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    const res = await h.request(EXPORT);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await json(res)).schemaVersion).toBe(1);
    expect((await h.request("/api/community-teams/t1")).status).toBe(200);
  });

  it("E6: không có đội -> {schemaVersion:1, items:[]}", async () => {
    const h: Harness = createHarness();
    expect(await json(await h.request(EXPORT))).toEqual({ schemaVersion: 1, items: [] });
  });
});
