// API Đội cộng đồng: mùa, ảnh, đăng nguyên tử, hiển thị, danh sách, vote, xoá.

import { describe, expect, it } from "vitest";
import { createHarness, imageForm, PNG_BYTES, seedSeason, seedTeam, type Harness } from "./fakes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();

const DAY = 86_400_000;
const TEAMS = "/api/community-teams";
const PAGE = (id: string) => `/doi-cong-dong/${id}/`;

const teamBody = (uploadIds: string[], extra: Record<string, unknown> = {}) => ({
  title: "Đội Tào Tháo",
  heroes: ["hero:a", "hero:b", "hero:c"],
  tactics: [["tactic:1", "tactic:2"], ["tactic:3", "tactic:4"], ["tactic:5", "tactic:6"]],
  troop: "ky",
  playstyle: "Đánh nhanh thắng nhanh",
  lang: "vi",
  uploadIds,
  ...extra,
});

async function upload(h: Harness, as = "alice"): Promise<string> {
  const res = await h.request(`${TEAMS}/uploads`, { as, body: imageForm(PNG_BYTES, "image/png") });
  expect(res.status).toBe(200);
  return (await json(res)).uploadId;
}

async function submit(h: Harness, as = "alice", n = 1, extra: Record<string, unknown> = {}) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(await upload(h, as));
  return h.request(TEAMS, { as, json: teamBody(ids, extra) });
}

const count = (h: Harness, sql: string, ...args: (string | number)[]): number =>
  (h.sqlite.prepare(sql).get(...args) as { n: number }).n;
const teamKeys = (h: Harness) => [...h.objects.keys()].filter((k) => k.startsWith("community-teams/"));
const listIds = async (h: Harness, query = "", as?: string) =>
  (await json(await h.request(`${TEAMS}${query}`, { as }))).items.map((i: { id: string }) => i.id);

function seedReport(h: Harness, id: string, teamId: string, userId: string, status: string, withImage = true) {
  const key = withImage ? `reports/${id}.png` : null;
  h.sqlite
    .prepare(
      "insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, status, created_at) values (?, ?, 'vi', ?, ?, 'win', '[\"a\"]', '[]', ?, 1)",
    )
    .run(id, PAGE(teamId), userId, key, status);
  if (key) {
    h.sqlite
      .prepare("insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, 'report', ?, 'image/png', 1, 'attached', 1)")
      .run(`up-${id}`, userId, key);
    return h.env.MEDIA.put(key, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
  }
  return Promise.resolve();
}

function seedComment(h: Harness, id: string, teamId: string, userId: string) {
  h.sqlite
    .prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, ?, 'vi', ?, 'bình luận', 1)")
    .run(id, PAGE(teamId), userId);
}

function openSeason(h: Harness) {
  seedSeason(h, "s1");
}

describe("quyền ghi", () => {
  it("khách gọi mọi route ghi/riêng tư -> 401", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1" });
    const calls: [string, string, unknown?][] = [
      ["POST", `${TEAMS}/uploads`],
      ["POST", `${TEAMS}/uploads/x/analyze`],
      ["POST", TEAMS, teamBody(["x"])],
      ["PUT", `${TEAMS}/t1/vote`, { value: 1 }],
      ["DELETE", `${TEAMS}/t1`, {}],
      ["GET", "/api/me/community-teams"],
    ];
    for (const [method, path, body] of calls) {
      const res = await h.request(path, { method, json: body ?? (method === "GET" ? undefined : {}) });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});

describe("GET /api/community-seasons", () => {
  it("công khai: mùa mở + danh sách mới nhất trước; không mùa -> open null", async () => {
    const h = createHarness();
    const none = await json(await h.request("/api/community-seasons"));
    expect(none).toEqual({ open: null, seasons: [] });
    seedSeason(h, "s1", 5_000, 1_000);
    seedSeason(h, "s2", null, 9_000);
    const res = await json(await h.request("/api/community-seasons"));
    expect(res.open).toEqual({ id: "s2", labelVi: "Mùa s2", labelZh: "赛季s2", openedAt: new Date(9_000).toISOString() });
    expect(res.seasons.map((s: { id: string }) => s.id)).toEqual(["s2", "s1"]);
    expect(res.seasons[1].closedAt).toBe(new Date(5_000).toISOString());
  });
});

describe("không có mùa mở", () => {
  it("POST đội 409 season_not_open; danh sách []", async () => {
    const h = createHarness();
    const up = await upload(h);
    const res = await h.request(TEAMS, { as: "alice", json: teamBody([up]) });
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("season_not_open");
    expect(await listIds(h)).toEqual([]);
  });
});

describe("POST /api/community-teams/uploads", () => {
  it("lưu R2 pending/team-<id> + dòng uploads", async () => {
    const h = createHarness();
    const id = await upload(h);
    expect(h.objects.has(`pending/team-${id}`)).toBe(true);
    const row = h.sqlite.prepare("select * from uploads where id = ?").get(id) as Record<string, unknown>;
    expect(row).toMatchObject({ user_id: "u-alice", kind: "report", status: "pending", object_key: `pending/team-${id}` });
  });

  it("sai MIME 415, quá cỡ 413, 31 lần -> 429", async () => {
    const h = createHarness();
    const bad = await h.request(`${TEAMS}/uploads`, { as: "alice", body: imageForm(PNG_BYTES, "image/jpeg") });
    expect(bad.status).toBe(415);
    const big = new Uint8Array(1_500_001);
    big.set(PNG_BYTES);
    expect((await h.request(`${TEAMS}/uploads`, { as: "alice", body: imageForm(big, "image/png") })).status).toBe(413);
    for (let i = 0; i < 30; i++) await upload(h);
    const res = await h.request(`${TEAMS}/uploads`, { as: "alice", body: imageForm(PNG_BYTES, "image/png") });
    expect(res.status).toBe(429);
  });

  it("D1 lỗi -> xoá khoá R2", async () => {
    const h = createHarness();
    // Trigger chặn ghi uploads dựng lỗi D1 sau khi R2 đã lưu.
    h.sqlite.exec("create trigger boom before insert on uploads begin select raise(abort, 'boom'); end");
    const res = await h.request(`${TEAMS}/uploads`, { as: "alice", body: imageForm(PNG_BYTES, "image/png") });
    expect(res.status).toBe(500);
    expect(h.objects.size).toBe(0);
  });
});

describe("đăng đội", () => {
  it("thành công: 201, ảnh chép sang community-teams/, pending/team- bị xoá, không còn dòng uploads", async () => {
    const h = createHarness();
    openSeason(h);
    const res = await submit(h);
    expect(res.status).toBe(201);
    const { id, status } = await json(res);
    expect(status).toBe("pending");
    expect(h.objects.has(`community-teams/${id}/0.png`)).toBe(true);
    expect([...h.objects.keys()].filter((k) => k.startsWith("pending/"))).toEqual([]);
    expect(count(h, "select count(*) n from uploads")).toBe(0);
    expect(count(h, "select count(*) n from community_team_images where team_id = ?", id)).toBe(1);
    const row = h.sqlite.prepare("select * from community_teams where id = ?").get(id) as Record<string, unknown>;
    expect(row).toMatchObject({ author_id: "u-alice", status: "pending", season_id: "s1", hero_key: "hero:a,hero:b,hero:c", text_lang: "vi" });
  });

  it("server gán mùa: body season bị bỏ qua", async () => {
    const h = createHarness();
    openSeason(h);
    const { id } = await json(await submit(h, "alice", 1, { season: "x", status: "approved", author_id: "u-bob" }));
    expect(h.sqlite.prepare("select season_id, status, author_id from community_teams where id = ?").get(id)).toEqual({
      season_id: "s1",
      status: "pending",
      author_id: "u-alice",
    });
  });

  it("ảnh của người khác / đã dùng / upload chiến báo -> 409 image_missing", async () => {
    const h = createHarness();
    openSeason(h);
    const bobs = await upload(h, "bob");
    const stolen = await h.request(TEAMS, { as: "alice", json: teamBody([bobs]) });
    expect(stolen.status).toBe(409);
    expect((await json(stolen)).error.code).toBe("image_missing");

    const mine = await upload(h, "alice");
    expect((await h.request(TEAMS, { as: "alice", json: teamBody([mine]) })).status).toBe(201);
    const reused = await h.request(TEAMS, { as: "alice", json: teamBody([mine]) });
    expect(reused.status).toBe(409);
    expect((await json(reused)).error.code).toBe("image_missing");

    // upload của chiến báo: khoá pending/<id> (không có team-)
    h.sqlite
      .prepare("insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values ('rep1', 'u-alice', 'report', 'pending/rep1', 'image/png', 1, 'pending', 1)")
      .run();
    await h.env.MEDIA.put("pending/rep1", PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
    const rep = await h.request(TEAMS, { as: "alice", json: teamBody(["rep1"]) });
    expect(rep.status).toBe(409);
    expect((await json(rep)).error.code).toBe("image_missing");
    expect(count(h, "select count(*) n from community_teams")).toBe(1);
  });

  it("lỗi R2 ở ảnh thứ 2 -> không có dòng đội, không còn khoá community-teams/", async () => {
    const h = createHarness();
    openSeason(h);
    const ids = [await upload(h), await upload(h)];
    h.failR2On({ op: "put", nth: 2 });
    const res = await h.request(TEAMS, { as: "alice", json: teamBody(ids) });
    expect(res.status).toBe(500);
    expect(count(h, "select count(*) n from community_teams")).toBe(0);
    expect(teamKeys(h)).toEqual([]);
    // upload vẫn còn để thử lại
    expect(count(h, "select count(*) n from uploads")).toBe(2);
    expect((await h.request(TEAMS, { as: "alice", json: teamBody(ids) })).status).toBe(201);
  });

  it("hai POST cùng uploadIds song song -> một 201, một 409; R2 chỉ có ảnh của đội thắng", async () => {
    const h = createHarness();
    openSeason(h);
    const ids = [await upload(h)];
    const [a, b] = await Promise.all([
      h.request(TEAMS, { as: "alice", json: teamBody(ids) }),
      h.request(TEAMS, { as: "alice", json: teamBody(ids) }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const winner = (await json(a.status === 201 ? a : b)).id;
    expect(teamKeys(h)).toEqual([`community-teams/${winner}/0.png`]);
    expect(count(h, "select count(*) n from community_teams")).toBe(1);
    expect([...h.objects.keys()].filter((k) => k.startsWith("pending/"))).toEqual([]);
  });

  it("đóng mùa giữa preflight và batch -> 409 season_not_open, không có dòng đội/khoá", async () => {
    const h = createHarness();
    openSeason(h);
    const ids = [await upload(h)];
    h.beforeNextBatch(() => h.sqlite.prepare("update community_seasons set closed_at = 5 where id = 's1'").run());
    const res = await h.request(TEAMS, { as: "alice", json: teamBody(ids) });
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("season_not_open");
    expect(count(h, "select count(*) n from community_teams")).toBe(0);
    expect(teamKeys(h)).toEqual([]);
    expect(count(h, "select count(*) n from uploads")).toBe(1);
  });

  it("body sai -> 400; 6 đội/ngày -> 429 ở đội thứ 6", async () => {
    const h = createHarness();
    openSeason(h);
    const up = await upload(h);
    const bad = await h.request(TEAMS, { as: "alice", json: { ...teamBody([up]), heroes: ["hero:a"] } });
    expect(bad.status).toBe(400);
    for (let i = 0; i < 5; i++) expect((await submit(h)).status).toBe(201);
    expect((await submit(h)).status).toBe(429);
  });
});

describe("hiển thị", () => {
  it("đội pending: không trong danh sách; chi tiết 404 với bob/khách, 200 với alice và moderator; ảnh 404 với khách", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1", status: "pending" });
    expect(await listIds(h)).toEqual([]);
    expect((await h.request(`${TEAMS}/t1`)).status).toBe(404);
    expect((await h.request(`${TEAMS}/t1`, { as: "bob" })).status).toBe(404);
    const own = await json(await h.request(`${TEAMS}/t1`, { as: "alice" }));
    expect(own).toMatchObject({ id: "t1", status: "pending", author: { id: "u-alice" } });
    expect((await h.request(`${TEAMS}/t1`, { as: "moderator" })).status).toBe(200);

    expect((await h.request(`${TEAMS}/t1/images/0`)).status).toBe(404);
    expect((await h.request(`${TEAMS}/t1/images/0`, { as: "bob" })).status).toBe(404);
    const img = await h.request(`${TEAMS}/t1/images/0`, { as: "alice" });
    expect(img.status).toBe(200);
    expect(img.headers.get("Cache-Control")).toBe("private, no-store");
    expect(img.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(new Uint8Array(await img.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("đội approved: công khai, ảnh cache public; chi tiết đủ trường; rejectReason chỉ chủ/staff", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1", images: 2 });
    const guest = await json(await h.request(`${TEAMS}/t1`));
    expect(guest).toMatchObject({
      id: "t1",
      status: "approved",
      title: "Đội t1",
      heroes: ["hero:a", "hero:b", "hero:c"],
      heroKey: "hero:a,hero:b,hero:c",
      tactics: [["tactic:1", "tactic:2"], ["tactic:3", "tactic:4"], ["tactic:5", "tactic:6"]],
      troop: "ky",
      imageCount: 2,
      textLang: "vi",
      seasonOpen: true,
      myVote: 0,
      analysis: { playstyle: "Lối chơi thử nghiệm", strengths: null },
      author: { id: "u-alice", name: "Alice", image: null },
    });
    expect(guest.season).toMatchObject({ id: "s1" });
    expect("rejectReason" in guest).toBe(false);
    const img = await h.request(`${TEAMS}/t1/images/1`);
    expect(img.status).toBe(200);
    expect(img.headers.get("Cache-Control")).toBe("public, no-cache");
    expect((await h.request(`${TEAMS}/t1/images/2`)).status).toBe(404);
    expect((await h.request(`${TEAMS}/t1/images/9`)).status).toBe(404);
    const etag = img.headers.get("ETag") as string;
    expect((await h.request(`${TEAMS}/t1/images/1`, { headers: { "if-none-match": etag } })).status).toBe(304);
  });

  it("rejected: chủ và staff thấy rejectReason, khách 404", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1", status: "rejected", rejectReason: "thiếu ảnh" });
    expect((await h.request(`${TEAMS}/t1`)).status).toBe(404);
    expect((await json(await h.request(`${TEAMS}/t1`, { as: "alice" }))).rejectReason).toBe("thiếu ảnh");
    expect((await json(await h.request(`${TEAMS}/t1`, { as: "moderator" }))).rejectReason).toBe("thiếu ảnh");
  });

  it("author.id luôn là id tác giả thật dù tên trùng người xem", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1" });
    h.sqlite.prepare('update "user" set name = ? where id = ?').run("Alice", "u-bob");
    expect((await json(await h.request(`${TEAMS}/t1`, { as: "alice" }))).author.id).toBe("u-alice");
    const asBob = await json(await h.request(`${TEAMS}/t1`, { as: "bob" }));
    expect(asBob.author.id).toBe("u-alice");
    expect(asBob.author.id).not.toBe("u-bob");
    expect((await json(await h.request(`${TEAMS}/t1`))).author.id).toBe("u-alice");
  });

  it("myVote phản ánh phiếu của người xem", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1" });
    await h.request(`${TEAMS}/t1/vote`, { as: "bob", method: "PUT", json: { value: -1 } });
    expect((await json(await h.request(`${TEAMS}/t1`, { as: "bob" }))).myVote).toBe(-1);
    expect((await json(await h.request(`${TEAMS}/t1`, { as: "admin" }))).myVote).toBe(0);
  });

  it("user bị khoá: đội biến khỏi danh sách/chi tiết/ảnh công khai; chủ khoá không xem được; vote -> 404", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1" });
    expect(await listIds(h)).toEqual(["t1"]);
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(h.clock.now + DAY, "u-alice");
    expect(await listIds(h)).toEqual([]);
    expect((await h.request(`${TEAMS}/t1`)).status).toBe(404);
    expect((await h.request(`${TEAMS}/t1`, { as: "bob" })).status).toBe(404);
    expect((await h.request(`${TEAMS}/t1/images/0`)).status).toBe(404);
    expect((await h.request(`${TEAMS}/t1`, { as: "moderator" })).status).toBe(200);
    expect((await h.request(`${TEAMS}/t1/vote`, { as: "bob", method: "PUT", json: { value: 1 } })).status).toBe(404);
    h.clock.now += 2 * DAY;
    expect(await listIds(h)).toEqual(["t1"]);
  });
});

describe("danh sách", () => {
  it("Hot / Top / Mới đúng thứ tự", async () => {
    const h = createHarness();
    openSeason(h);
    const now = h.clock.now;
    await seedTeam(h, { id: "a", createdAt: now - DAY, upVotes: 100 });
    await seedTeam(h, { id: "b", createdAt: now - 3_600_000, upVotes: 1 });
    await seedTeam(h, { id: "c", createdAt: now - 600_000 });
    expect(await listIds(h, "?sort=hot")).toEqual(["a", "c", "b"]);
    expect(await listIds(h)).toEqual(["a", "c", "b"]);
    expect(await listIds(h, "?sort=top")).toEqual(["a", "b", "c"]);
    expect(await listIds(h, "?sort=new")).toEqual(["c", "b", "a"]);
    expect((await h.request(`${TEAMS}?sort=bogus`)).status).toBe(400);
  });

  it("item đủ trường; commentCount đếm bình luận của trang", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1", images: 2, upVotes: 3, downVotes: 1 });
    seedComment(h, "c1", "t1", "u-bob");
    seedComment(h, "c2", "t1", "u-alice");
    const [item] = (await json(await h.request(TEAMS))).items;
    expect(item).toMatchObject({
      id: "t1",
      title: "Đội t1",
      heroes: ["hero:a", "hero:b", "hero:c"],
      troop: "ky",
      author: { id: "u-alice", name: "Alice", image: null },
      upVotes: 3,
      downVotes: 1,
      evidenceCount: 0,
      points: 2,
      commentCount: 2,
      imageCount: 2,
      textLang: "vi",
    });
    expect(item.season).toMatchObject({ id: "s1" });
    expect(item.tactics).toHaveLength(3);
    expect(typeof item.createdAt).toBe("string");
  });

  it("lọc 1 và 3 tướng (3 tướng thứ tự khác vẫn khớp)", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "x", heroes: ["hero:a", "hero:b", "hero:c"] });
    await seedTeam(h, { id: "y", heroes: ["hero:a", "hero:d", "hero:e"], createdAt: h.clock.now - 1000 });
    expect((await listIds(h, "?sort=new&heroes=hero:a")).sort()).toEqual(["x", "y"]);
    expect(await listIds(h, "?sort=new&heroes=hero:b")).toEqual(["x"]);
    expect(await listIds(h, "?heroes=hero:c,hero:a,hero:b")).toEqual(["x"]);
    expect(await listIds(h, "?heroes=hero:a,hero:b,hero:e")).toEqual([]);
    expect((await h.request(`${TEAMS}?heroes=bogus`)).status).toBe(400);
  });

  it("21 đội -> trang 2 không trùng, không sót", async () => {
    const h = createHarness();
    openSeason(h);
    const now = h.clock.now;
    for (let i = 1; i <= 21; i++) await seedTeam(h, { id: `t${String(i).padStart(2, "0")}`, createdAt: now, images: 0 });
    for (const sort of ["hot", "top", "new"]) {
      const p1 = await json(await h.request(`${TEAMS}?sort=${sort}`));
      expect(p1.items).toHaveLength(20);
      expect(p1.nextCursor).toBeTruthy();
      const p2 = await json(await h.request(`${TEAMS}?sort=${sort}&cursor=${p1.nextCursor}`));
      expect(p2.nextCursor).toBeNull();
      const all = [...p1.items, ...p2.items].map((i: { id: string }) => i.id);
      expect(new Set(all).size).toBe(21);
    }
    expect((await h.request(`${TEAMS}?cursor=zzz`)).status).toBe(400);
  });

  it("season: mặc định mùa mở; id mùa cũ; all", async () => {
    const h = createHarness();
    seedSeason(h, "s0", 5);
    openSeason(h);
    await seedTeam(h, { id: "old", season: "s0" });
    await seedTeam(h, { id: "cur", season: "s1" });
    expect(await listIds(h)).toEqual(["cur"]);
    expect(await listIds(h, "?season=s0")).toEqual(["old"]);
    expect((await listIds(h, "?season=all&sort=new")).sort()).toEqual(["cur", "old"]);
    expect(await listIds(h, "?season=nope")).toEqual([]);
  });

  it("/api/me/community-teams: mọi trạng thái của mình kèm rejectReason", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "p", status: "pending", createdAt: 1 });
    await seedTeam(h, { id: "r", status: "rejected", rejectReason: "sai", createdAt: 2 });
    await seedTeam(h, { id: "b", author: "u-bob" });
    const res = await json(await h.request("/api/me/community-teams", { as: "alice" }));
    expect(res.items.map((i: { id: string }) => i.id)).toEqual(["r", "p"]);
    expect(res.items[0]).toMatchObject({ status: "rejected", rejectReason: "sai" });
    expect(res.nextCursor).toBeNull();
  });
});

describe("vote", () => {
  const vote = (h: Harness, id: string, value: unknown, as = "bob") =>
    h.request(`${TEAMS}/${id}/vote`, { as, method: "PUT", json: { value } });

  it("1 -> đổi -1 -> bỏ 0; trả đếm đọc lại", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1" });
    expect(await json(await vote(h, "t1", 1))).toEqual({ upVotes: 1, downVotes: 0, points: 1, myVote: 1 });
    expect(await json(await vote(h, "t1", -1))).toEqual({ upVotes: 0, downVotes: 1, points: -1, myVote: -1 });
    expect(await json(await vote(h, "t1", 0))).toEqual({ upVotes: 0, downVotes: 0, points: 0, myVote: 0 });
    expect(await json(await vote(h, "t1", 0))).toEqual({ upVotes: 0, downVotes: 0, points: 0, myVote: 0 });
    expect((await vote(h, "t1", 5)).status).toBe(400);
  });

  it("tác giả vote đội mình -> 403 own_team; đội pending -> 404; không tồn tại -> 404", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1" });
    await seedTeam(h, { id: "p1", status: "pending" });
    const own = await vote(h, "t1", 1, "alice");
    expect(own.status).toBe(403);
    expect((await json(own)).error.code).toBe("own_team");
    expect((await vote(h, "p1", 1)).status).toBe(404);
    expect((await vote(h, "nope", 1)).status).toBe(404);
    expect(count(h, "select count(*) n from community_team_votes")).toBe(0);
  });

  it("mùa đã đóng: vote và bỏ vote -> 409 season_closed", async () => {
    const h = createHarness();
    seedSeason(h, "s0", 5);
    await seedTeam(h, { id: "t1", season: "s0" });
    for (const value of [1, 0]) {
      const res = await vote(h, "t1", value);
      expect(res.status).toBe(409);
      expect((await json(res)).error.code).toBe("season_closed");
    }
    // phiếu cũ không bị bỏ sau khi mùa đóng
    h.sqlite.prepare("insert into community_team_votes (team_id, user_id, value, created_at) values ('t1', 'u-bob', 1, 1)").run();
    expect((await vote(h, "t1", 0)).status).toBe(409);
    expect(count(h, "select count(*) n from community_team_votes")).toBe(1);
  });

  it("vote 'đang bay': user bị khoá sau requireUser -> không ghi, 401", async () => {
    const h = createHarness();
    openSeason(h);
    await seedTeam(h, { id: "t1" });
    h.afterNextGetUser(() => h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(h.clock.now + DAY, "u-bob"));
    const res = await vote(h, "t1", 1);
    expect(res.status).toBe(401);
    expect(count(h, "select count(*) n from community_team_votes")).toBe(0);
    expect(count(h, "select up_votes n from community_teams where id = 't1'")).toBe(0);
  });
});

describe("xoá đội", () => {
  const del = (h: Harness, id: string, as: string, body: unknown = {}) =>
    h.request(`${TEAMS}/${id}`, { as, method: "DELETE", json: body });

  async function fullTeam(h: Harness, id = "t1", author = "u-alice") {
    await seedTeam(h, { id, author, images: 2 });
    seedComment(h, `c-${id}-1`, id, "u-bob");
    seedComment(h, `c-${id}-2`, id, author);
    await seedReport(h, `rp-${id}`, id, "u-bob", "pending");
  }

  const everythingGone = (h: Harness, id = "t1") => {
    expect(count(h, "select count(*) n from community_teams where id = ?", id)).toBe(0);
    expect(count(h, "select count(*) n from community_team_images where team_id = ?", id)).toBe(0);
    expect(count(h, "select count(*) n from comments where page_key = ?", PAGE(id))).toBe(0);
    expect(count(h, "select count(*) n from battle_reports where page_key = ?", PAGE(id))).toBe(0);
    expect(count(h, "select count(*) n from uploads")).toBe(0);
    expect([...h.objects.keys()]).toEqual([]);
  };

  it("chủ xoá: bình luận + chiến báo + ảnh R2 (đội và chiến báo) biến mất", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h);
    const res = await del(h, "t1", "alice");
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
    everythingGone(h);
  });

  it("chiến báo đã duyệt của bob -> chủ xoá 409 has_evidence, dữ liệu nguyên vẹn; pending/rejected không chặn", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h);
    await seedReport(h, "rp-ok", "t1", "u-bob", "approved");
    const res = await del(h, "t1", "alice");
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("has_evidence");
    expect(count(h, "select count(*) n from community_teams where id = 't1' and deleting_at is null")).toBe(1);
    expect(count(h, "select count(*) n from battle_reports")).toBe(2);
    expect(h.objects.size).toBe(4); // 2 ảnh đội + 2 ảnh chiến báo

    const h2 = createHarness();
    openSeason(h2);
    await fullTeam(h2);
    await seedReport(h2, "rp-rej", "t1", "u-bob", "rejected");
    expect((await del(h2, "t1", "alice")).status).toBe(200);
    everythingGone(h2);
  });

  it("chiến báo đã duyệt của chính chủ không chặn", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h);
    await seedReport(h, "rp-own", "t1", "u-alice", "approved");
    expect((await del(h, "t1", "alice")).status).toBe(200);
    everythingGone(h);
  });

  it("bob xoá đội alice -> 404; moderator xoá đội admin -> 404; khách 401", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h, "t1", "u-alice");
    await fullTeam(h, "t2", "u-admin");
    expect((await del(h, "t1", "bob", { reason: "x" })).status).toBe(404);
    expect((await del(h, "t2", "moderator", { reason: "vi phạm" })).status).toBe(404);
    expect(count(h, "select count(*) n from community_teams")).toBe(2);
    expect(count(h, "select count(*) n from admin_audit")).toBe(0);
    expect((await del(h, "nope", "alice")).status).toBe(404);
  });

  it("moderator xoá đội alice (có bằng chứng) với lý do -> 200 + 1 audit team.delete có meta theo tác giả; thiếu lý do -> 400", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h);
    await seedReport(h, "rp-ok", "t1", "u-bob", "approved");
    const missing = await del(h, "t1", "moderator");
    expect(missing.status).toBe(400);
    expect(count(h, "select count(*) n from community_teams")).toBe(1);
    expect(count(h, "select count(*) n from admin_audit")).toBe(0);

    const res = await del(h, "t1", "moderator", { reason: "spam" });
    expect(res.status).toBe(200);
    everythingGone(h);
    const rows = h.sqlite.prepare("select * from admin_audit").all() as Record<string, string>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "team.delete", target_id: "t1", subject_user_id: "u-alice", reason: "spam", actor_id: "u-moderator" });
    expect(JSON.parse(rows[0].meta)).toEqual({
      byAuthor: {
        "u-alice": { comments: 1, reports: 0 },
        "u-bob": { comments: 1, reports: 2 },
      },
      deploy: "ok",
    });
  });

  it("root xoá được đội của người khác (kể cả của moderator), có audit", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h, "t1", "u-moderator");
    expect((await del(h, "t1", "admin", { reason: "gỡ" })).status).toBe(200);
    everythingGone(h);
    expect(count(h, "select count(*) n from admin_audit where action = 'team.delete'")).toBe(1);
  });

  it("xoá dở: R2 lỗi -> 502 delete_incomplete, đội ẩn mọi nơi; duyệt chiến báo cũ rồi gọi lại -> 200", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h);
    h.failR2On({ op: "delete", nth: 2 });
    const res = await del(h, "t1", "alice");
    expect(res.status).toBe(502);
    expect((await json(res)).error.code).toBe("delete_incomplete");
    expect(count(h, "select count(*) n from community_teams where id = 't1' and deleting_at is not null")).toBe(1);
    expect(teamKeys(h)).toEqual([]); // ảnh đội đã xoá ở lần gọi 1
    expect(await listIds(h)).toEqual([]);
    expect((await h.request(`${TEAMS}/t1`, { as: "alice" })).status).toBe(404);
    expect((await h.request(`${TEAMS}/t1`, { as: "moderator" })).status).toBe(404);
    expect((await h.request(`${TEAMS}/t1/vote`, { as: "bob", method: "PUT", json: { value: 1 } })).status).toBe(404);
    const mine = await json(await h.request("/api/me/community-teams", { as: "alice" }));
    expect(mine.items.map((i: { id: string; deleting: boolean }) => [i.id, i.deleting])).toEqual([["t1", true]]);

    // staff duyệt một chiến báo cũ của bob trên trang: không làm chủ bị chặn khi gọi lại
    expect((await h.request("/api/admin/reports/rp-t1/approve", { as: "moderator", method: "POST" })).status).toBe(200);
    const retry = await del(h, "t1", "alice");
    expect(retry.status).toBe(200);
    everythingGone(h);
  });

  it("xoá dở bởi staff: gọi lại không ghi audit lần hai", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h);
    h.failR2On({ op: "delete", nth: 1 });
    expect((await del(h, "t1", "moderator", { reason: "spam" })).status).toBe(502);
    expect(count(h, "select count(*) n from admin_audit where action = 'team.delete'")).toBe(1);
    expect((await del(h, "t1", "moderator", { reason: "spam" })).status).toBe(200);
    expect(count(h, "select count(*) n from admin_audit where action = 'team.delete'")).toBe(1);
    everythingGone(h);
    // sau khi xoá xong đội không còn -> 404
    expect((await del(h, "t1", "moderator", { reason: "spam" })).status).toBe(404);
  });

  it("người không có quyền không làm tiếp được đội đang xoá dở", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h);
    h.failR2On({ op: "delete", nth: 1 });
    expect((await del(h, "t1", "alice")).status).toBe(502);
    expect((await del(h, "t1", "bob")).status).toBe(404);
    expect(count(h, "select count(*) n from community_teams")).toBe(1);
  });

  it("đổi vai trò giữa chừng: alice thành moderator ngay trước batch chốt -> 404, không xoá gì", async () => {
    const h = createHarness();
    openSeason(h);
    await fullTeam(h);
    const before = h.objects.size;
    h.beforeNextBatch(() => h.sqlite.prepare('update "user" set role = \'moderator\' where id = ?').run("u-alice"));
    const res = await del(h, "t1", "moderator", { reason: "spam" });
    expect(res.status).toBe(404);
    expect(count(h, "select count(*) n from community_teams where id = 't1' and deleting_at is null")).toBe(1);
    expect(count(h, "select count(*) n from comments")).toBe(2);
    expect(count(h, "select count(*) n from battle_reports")).toBe(1);
    expect(count(h, "select count(*) n from admin_audit")).toBe(0);
    expect(h.objects.size).toBe(before);
  });
});
