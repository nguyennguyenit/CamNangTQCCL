import { describe, expect, it } from "vitest";
import { parseAnalysis, REPORT_PROMPT } from "../src/analyze";
import { cleanup } from "../src/cleanup";
import { aggregateStats } from "../src/stats";
import type { AiConfig } from "../../shared/ai-config";
import { createHarness, imageForm, PNG_BYTES, seedSeason, seedTeam, TEST_CONFIG, TEST_GROUP, TEST_PROVIDER, type ApiJson, type Harness } from "./fakes";

const PAGE = "/doi-chuan/s18-abc/";

function modelReply(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    headers: { "content-type": "application/json" },
  });
}

async function analyze(h: Harness, as: "alice" | "bob" = "alice") {
  return h.request("/api/reports/analyze", { as, method: "POST", body: imageForm(PNG_BYTES, "image/png") });
}

/** Phân tích + gửi một chiến báo, trả id. */
async function submitReport(h: Harness, as: "alice" | "bob", body: Record<string, unknown> = {}) {
  const { uploadId } = await (await analyze(h, as)).json<ApiJson>();
  const res = await h.request("/api/reports", {
    as,
    json: { page: PAGE, lang: "vi", uploadId, result: "win", allyHeroes: ["曹操"], enemyHeroes: ["刘备"], ...body },
  });
  expect(res.status).toBe(201);
  return (await res.json<ApiJson>()).id as string;
}

describe("parseAnalysis", () => {
  it("chịu code fence, map kết quả chữ Hán, lọc tên rỗng/未知/quá dài/trùng, cắt còn 5", () => {
    const content =
      "```json\n" +
      JSON.stringify({
        result: "胜利",
        ally: { heroes: [" 曹操 ", "未知", "", "曹操", "郭嘉", "名".repeat(21), 7] },
        enemy: { heroes: ["刘备", "关羽", "张飞", "诸葛亮", "赵云", "马超"] },
        battleType: "攻城",
        notes: "",
      }) +
      "\n```";
    expect(parseAnalysis(content)).toEqual({
      result: "win",
      ally: { heroes: ["曹操", "郭嘉"] },
      enemy: { heroes: ["刘备", "关羽", "张飞", "诸葛亮", "赵云"] },
      battleType: "攻城",
      notes: null,
    });
  });

  it("result lạ -> null; thiếu phe -> mảng rỗng; không có JSON -> ném lỗi", () => {
    expect(parseAnalysis('{"result":"constructor"}')).toMatchObject({ result: null, ally: { heroes: [] }, enemy: { heroes: [] } });
    expect(parseAnalysis('{"result":"LOSS"}').result).toBe("loss");
    expect(() => parseAnalysis("không đọc được")).toThrow();
    expect(() => parseAnalysis("[1,2]")).toThrow();
  });

  it("prompt ép schema JSON và tên chữ Hán giản thể", () => {
    expect(REPORT_PROMPT).toContain('"result":"win"|"loss"|"draw"|null');
    expect(REPORT_PROMPT).toContain("简体中文");
  });
});

describe("POST /api/reports/analyze", () => {
  it("gửi ảnh tới model, lưu R2 pending/<uploadId>, trả analysis đã chuẩn hoá", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply('{"result":"败","ally":{"heroes":["曹操"]},"enemy":{"heroes":["刘备"]},"battleType":null,"notes":null}'));
    const res = await analyze(h);
    expect(res.status).toBe(200);
    const body = await res.json<ApiJson>();
    expect(body).toEqual({
      uploadId: expect.any(String),
      analysis: { result: "loss", ally: { heroes: ["曹操"] }, enemy: { heroes: ["刘备"] }, battleType: null, notes: null },
    });
    expect(h.objects.has(`pending/${body.uploadId}`)).toBe(true);
    const sent = JSON.parse(String(h.fetchCalls[0].init?.body));
    expect(sent.messages[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/u);
    expect(h.fetchCalls[0].url).toBe("https://api.deepseek.com/chat/completions");
    expect(sent.model).toBe("deepseek-flash");
  });

  it("model trả rác -> vẫn giữ upload với analysis rỗng; upstream 429 -> 503 và xoá ảnh", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("xin lỗi"));
    const ok = await (await analyze(h)).json<ApiJson>();
    expect(ok.analysis).toEqual({ result: null, ally: { heroes: [] }, enemy: { heroes: [] }, battleType: null, notes: null });
    h.setFetch(() => new Response("busy", { status: 429 }));
    const busy = await analyze(h);
    expect(busy.status).toBe(503);
    expect((await busy.json<ApiJson>()).error.code).toBe("ai_overloaded");
    expect([...h.objects.keys()]).toEqual([`pending/${ok.uploadId}`]);
  });

  it("từ chối MIME không khớp magic bytes, ảnh quá 1.5MB, kill-switch và chưa đăng nhập", async () => {
    const h = createHarness();
    const fake = await h.request("/api/reports/analyze", { as: "alice", method: "POST", body: imageForm(PNG_BYTES, "image/jpeg") });
    expect(fake.status).toBe(415);
    const big = new Uint8Array(1_500_001);
    big.set(PNG_BYTES);
    const tooBig = await h.request("/api/reports/analyze", { as: "alice", method: "POST", body: imageForm(big, "image/png") });
    expect(tooBig.status).toBe(413);
    expect((await h.request("/api/reports/analyze", { method: "POST", body: imageForm(PNG_BYTES, "image/png") })).status).toBe(401);
    const off = createHarness({ FEATURE_ENABLED: "false" });
    expect((await off.request("/api/reports/analyze", { as: "alice", method: "POST", body: imageForm(PNG_BYTES, "image/png") })).status).toBe(503);
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("chưa cấu hình AI (không có bản ghi / mọi mục tắt / chuỗi chiến báo rỗng / thiếu secret) -> 503 ai_not_configured, không lưu ảnh", async () => {
    const empty = createHarness();
    empty.aiStore.clear();
    const noSecret = createHarness({ AI_CONFIG_SECRET: undefined });
    const allOff = createHarness();
    const saveConfig = (h: Harness, config: AiConfig) =>
      h.request("/api/admin/ai/config", { as: "admin", method: "PUT", json: config });
    expect((await saveConfig(allOff, { ...TEST_CONFIG, providers: [{ ...TEST_PROVIDER, enabled: false }] })).status).toBe(200);
    const noChain = createHarness();
    expect(
      (await saveConfig(noChain, { ...TEST_CONFIG, groups: { ...TEST_CONFIG.groups, battleReport: { ...TEST_GROUP, chain: [] } } })).status,
    ).toBe(200);
    for (const h of [empty, noSecret, allOff, noChain]) {
      const res = await analyze(h);
      expect(res.status).toBe(503);
      expect((await res.json<ApiJson>()).error.code).toBe("ai_not_configured");
      expect(h.objects.size).toBe(0);
      expect(h.fetchCalls).toHaveLength(0);
    }
  });
});

describe("gửi + kiểm duyệt chiến báo", () => {
  it("upload của người khác không dùng được; gửi xong ảnh chuyển khỏi pending", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("{}"));
    const { uploadId } = await (await analyze(h, "alice")).json<ApiJson>();
    const stolen = await h.request("/api/reports", {
      as: "bob",
      json: { page: PAGE, lang: "vi", uploadId, result: "win", allyHeroes: ["曹操"], enemyHeroes: [] },
    });
    expect((await stolen.json<ApiJson>()).error.code).toBe("invalid_upload");
    const res = await h.request("/api/reports", {
      as: "alice",
      json: { page: PAGE, lang: "vi", uploadId, result: "win", allyHeroes: ["曹操"], enemyHeroes: [], note: " ghi chú ", season: "S18" },
    });
    const { id, status } = await res.json<ApiJson>();
    expect(status).toBe("pending");
    expect(h.objects.has(`pending/${uploadId}`)).toBe(false);
    expect(h.objects.has(`reports/${id}.png`)).toBe(true);
    // Upload đã dùng không gửi lại được.
    const again = await h.request("/api/reports", {
      as: "alice",
      json: { page: PAGE, lang: "vi", uploadId, result: "win", allyHeroes: ["曹操"], enemyHeroes: [] },
    });
    expect(again.status).toBe(400);
  });

  it("ảnh chưa duyệt chỉ chủ/admin xem; duyệt xong công khai và vào danh sách", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("{}"));
    const id = await submitReport(h, "alice");
    const url = `/api/reports/${id}/image`;
    expect((await h.request(url)).status).toBe(404);
    expect((await h.request(url, { as: "bob" })).status).toBe(404);
    const own = await h.request(url, { as: "alice" });
    expect(own.status).toBe(200);
    expect(own.headers.get("Cache-Control")).toBe("private, no-store");
    expect(own.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await own.arrayBuffer())).toEqual(PNG_BYTES);
    expect((await h.request(url, { as: "admin" })).status).toBe(200);

    expect((await (await h.request(`/api/reports?page=${PAGE}&lang=vi`)).json<ApiJson>()).items).toEqual([]);
    expect((await h.request(`/api/admin/reports/${id}/approve`, { as: "bob", method: "POST" })).status).toBe(403);
    expect((await h.request(`/api/admin/reports`, { as: "bob" })).status).toBe(403);
    const pending = await (await h.request(`/api/admin/reports?status=pending`, { as: "admin" })).json<ApiJson>();
    expect(pending.items.map((r: { id: string }) => r.id)).toEqual([id]);
    expect(await (await h.request(`/api/admin/reports/${id}/approve`, { as: "admin", method: "POST" })).json<ApiJson>()).toMatchObject({
      id,
      status: "approved",
    });

    const pub = await h.request(url);
    expect(pub.status).toBe(200);
    expect(pub.headers.get("Cache-Control")).toContain("public");
    const list = await (await h.request(`/api/reports?page=${PAGE}&lang=vi`)).json<ApiJson>();
    expect(list.items[0]).toMatchObject({ id, result: "win", allyHeroes: ["曹操"], enemyHeroes: ["刘备"], imageUrl: url, lang: "vi" });
    expect((await (await h.request(`/api/reports?page=${PAGE}&lang=zh`)).json<ApiJson>()).items).toEqual([]);
  });

  it("từ chối cần lý do; /api/me/reports hiện trạng thái + lý do", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("{}"));
    const id = await submitReport(h, "bob");
    expect((await h.request(`/api/admin/reports/${id}/reject`, { as: "admin", json: {} })).status).toBe(400);
    await h.request(`/api/admin/reports/${id}/reject`, { as: "admin", json: { reason: "Ảnh không rõ" } });
    const mine = await (await h.request("/api/me/reports", { as: "bob" })).json<ApiJson>();
    expect(mine.items[0]).toMatchObject({ id, status: "rejected", rejectReason: "Ảnh không rõ", page: PAGE });
    expect((await (await h.request("/api/me/reports", { as: "alice" })).json<ApiJson>()).items).toEqual([]);
    expect((await h.request(`/api/admin/reports/nope/approve`, { as: "admin", method: "POST" })).status).toBe(404);
  });

  it("rate limit phân tích 20 lần/ngày", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("{}"));
    for (let i = 0; i < 20; i++) expect((await analyze(h)).status).toBe(200);
    expect((await analyze(h)).status).toBe(429);
    expect(h.fetchCalls).toHaveLength(20);
  });

  it("analyze: trigger chặn insert uploads (giờ DB thật) -> lỗi, không có dòng uploads, không còn object R2", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("{}"));
    const bannedUntil = Date.now() + 60_000;
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(bannedUntil, "u-alice");
    h.clock.now = bannedUntil + 1; // guard coi như hết khoá, trigger (giờ DB) vẫn chặn
    const res = await analyze(h);
    expect(res.status).toBe(500);
    expect(h.objects.size).toBe(0);
    expect({ ...(h.sqlite.prepare("select count(*) n from uploads").get() as object) }).toEqual({ n: 0 });
  });

  it("batch lỗi (trigger chặn user bị khoá theo giờ DB thật) -> 500 và không còn ảnh reports/*", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("{}"));
    const { uploadId } = await (await analyze(h)).json<ApiJson>();
    // Guard chạy theo h.clock (đã quá hạn khoá) nhưng trigger chạy theo giờ DB thật (còn hạn): khe giữa hai đồng hồ.
    const bannedUntil = Date.now() + 60_000;
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(bannedUntil, "u-alice");
    h.clock.now = bannedUntil + 1;
    const res = await h.request("/api/reports", {
      as: "alice",
      json: { page: PAGE, lang: "vi", uploadId, result: "win", allyHeroes: ["曹操"], enemyHeroes: [] },
    });
    expect(res.status).toBe(500);
    expect([...h.objects.keys()].filter((k) => k.startsWith("reports/"))).toEqual([]);
    expect({ ...(h.sqlite.prepare("select count(*) n from battle_reports").get() as object) }).toEqual({ n: 0 });
  });
});

describe("thống kê", () => {
  it("aggregateStats gom đối thủ theo tập tướng đã sắp xếp", () => {
    const stats = aggregateStats([
      { result: "win", enemyHeroes: ["刘备", "关羽", "张飞"] },
      { result: "loss", enemyHeroes: ["张飞", "刘备", "关羽"] },
      { result: "win", enemyHeroes: ["关羽", "张飞", "刘备"] },
      { result: "draw", enemyHeroes: ["孙权"] },
      { result: "win", enemyHeroes: [] },
    ]);
    expect(stats).toEqual({
      total: 5,
      wins: 3,
      losses: 1,
      draws: 1,
      winRate: 0.6,
      topOpponents: [
        { heroes: ["关羽", "刘备", "张飞"].sort(), count: 3, wins: 2 },
        { heroes: ["孙权"], count: 1, wins: 0 },
      ],
    });
    expect(aggregateStats([])).toEqual({ total: 0, wins: 0, losses: 0, draws: 0, winRate: null, topOpponents: [] });
  });

  it("API chỉ tính chiến báo đã duyệt, gộp mọi ngôn ngữ", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("{}"));
    const a = await submitReport(h, "alice", { result: "win", lang: "vi" });
    const b = await submitReport(h, "bob", { result: "loss", lang: "zh", enemyHeroes: ["刘备"] });
    await submitReport(h, "bob", { result: "loss" });
    for (const id of [a, b]) await h.request(`/api/admin/reports/${id}/approve`, { as: "admin", method: "POST" });
    const stats = await (await h.request(`/api/reports/stats?page=${PAGE}`)).json<ApiJson>();
    expect(stats).toEqual({
      total: 2,
      wins: 1,
      losses: 1,
      draws: 0,
      winRate: 0.5,
      topOpponents: [{ heroes: ["刘备"], count: 2, wins: 1 }],
    });
  });
});

describe("cron dọn dẹp", () => {
  it("xoá ảnh pending quá 24 giờ, giữ ảnh mới và ảnh đã gửi", async () => {
    const h = createHarness();
    h.setFetch(() => modelReply("{}"));
    const old = await (await analyze(h)).json<ApiJson>();
    await submitReport(h, "bob");
    h.clock.now += 20 * 3_600_000;
    const fresh = await (await analyze(h)).json<ApiJson>();
    h.clock.now += 5 * 3_600_000;
    const { deletedObjects } = await cleanup(h.env, h.clock.now);
    expect(deletedObjects).toBe(1);
    expect(h.objects.has(`pending/${old.uploadId}`)).toBe(false);
    expect(h.objects.has(`pending/${fresh.uploadId}`)).toBe(true);
    expect([...h.objects.keys()].some((k) => k.startsWith("reports/"))).toBe(true);
    const rows = h.sqlite.prepare("select id from uploads where status = 'pending'").all();
    expect(rows.map((r) => r.id)).toEqual([fresh.uploadId]);
  });
});

describe("chiến báo trên trang đội cộng đồng", () => {
  const TEAM_PAGE = "/doi-cong-dong/t1/";
  const reportCount = (h: Harness) =>
    (h.sqlite.prepare("select coalesce(sum(count), 0) as n from rate_limits where key like 'report:u-bob:%'").get() as { n: number }).n;
  const reportKeys = (h: Harness) => [...h.objects.keys()].filter((k) => k.startsWith("reports/"));

  async function upload(h: Harness, as: "alice" | "bob" = "bob"): Promise<string> {
    return (await (await analyze(h, as)).json<ApiJson>()).uploadId as string;
  }
  const send = (h: Harness, as: "alice" | "bob", uploadId: string, extra: Record<string, unknown> = {}, page = TEAM_PAGE) =>
    h.request("/api/reports", { as, json: { page, lang: "vi", uploadId, result: "win", allyHeroes: ["曹操"], enemyHeroes: ["刘备"], ...extra } });

  it("đội approved mùa mở -> 201, season = mùa của đội dù client gửi khác", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    const id = await upload(h);
    const res = await send(h, "bob", id, { season: "khac" });
    expect(res.status).toBe(201);
    const reportId = (await res.json<ApiJson>()).id as string;
    expect(h.sqlite.prepare("select season, page_key from battle_reports where id = ?").get(reportId)).toMatchObject({ season: "s1", page_key: TEAM_PAGE });
    expect(h.sqlite.prepare("select status from uploads where id = ?").get(id)).toMatchObject({ status: "attached" });
  });

  it("đội pending -> 404; mùa đóng -> 409 season_closed; upload còn pending, không rate limit, gửi lại vào đội chuẩn được", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    seedSeason(h, "s0", 5);
    await seedTeam(h, { id: "t1", status: "pending" });
    await seedTeam(h, { id: "t2", season: "s0" });
    const id = await upload(h);
    const before = reportCount(h);
    const missing = await send(h, "bob", id);
    expect(missing.status).toBe(404);
    expect((await missing.json<ApiJson>()).error.code).toBe("not_found");
    const closed = await send(h, "bob", id, {}, "/doi-cong-dong/t2/");
    expect(closed.status).toBe(409);
    expect((await closed.json<ApiJson>()).error.code).toBe("season_closed");
    expect(h.sqlite.prepare("select status from uploads where id = ?").get(id)).toMatchObject({ status: "pending" });
    expect(h.objects.has(`pending/${id}`)).toBe(true);
    expect(reportKeys(h)).toEqual([]);
    expect(reportCount(h)).toBe(before);
    expect((await send(h, "bob", id, {}, PAGE)).status).toBe(201);
  });

  it("mùa đóng giữa preflight và batch -> 409, upload vẫn pending, không còn ảnh reports/", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    const id = await upload(h);
    h.beforeNextBatch(() => void h.sqlite.prepare("update community_seasons set closed_at = 9 where id = 's1'").run());
    const res = await send(h, "bob", id);
    expect(res.status).toBe(409);
    expect((await res.json<ApiJson>()).error.code).toBe("season_closed");
    expect(h.sqlite.prepare("select status from uploads where id = ?").get(id)).toMatchObject({ status: "pending" });
    expect(h.objects.has(`pending/${id}`)).toBe(true);
    expect(reportKeys(h)).toEqual([]);
    expect(h.sqlite.prepare("select count(*) as n from battle_reports").get()).toMatchObject({ n: 0 });
  });

  it("đội bị gỡ giữa preflight và batch -> 404, upload vẫn pending", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    const id = await upload(h);
    h.beforeNextBatch(() => void h.sqlite.prepare("update community_teams set deleting_at = 9 where id = 't1'").run());
    expect((await send(h, "bob", id)).status).toBe(404);
    expect(h.sqlite.prepare("select status from uploads where id = ?").get(id)).toMatchObject({ status: "pending" });
    expect(reportKeys(h)).toEqual([]);
  });

  it("khoá pending/team-… không dùng được làm chiến báo -> 400 invalid_upload", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    const sent = await h.request("/api/community-teams/uploads", { as: "bob", method: "POST", body: imageForm(PNG_BYTES, "image/png") });
    expect(sent.status).toBeLessThan(300);
    const row = h.sqlite.prepare("select id, object_key from uploads where object_key like 'pending/team-%'").get() as { id: string; object_key: string };
    const res = await send(h, "bob", row.id);
    expect(res.status).toBe(400);
    expect((await res.json<ApiJson>()).error.code).toBe("invalid_upload");
    expect(h.sqlite.prepare("select status from uploads where id = ?").get(row.id)).toMatchObject({ status: "pending" });
  });

  it("danh sách + stats trang cộng đồng gộp vi và zh; đội pending -> rỗng; đội chuẩn vẫn lọc lang", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    await seedTeam(h, { id: "t3", status: "pending" });
    const ins = h.sqlite.prepare(
      "insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values (?, ?, ?, 'u-bob', 'win', '[\"a\"]', '[\"x\"]', 'approved', ?)",
    );
    ins.run("rv", TEAM_PAGE, "vi", 1);
    ins.run("rz", TEAM_PAGE, "zh", 2);
    ins.run("pv", "/doi-cong-dong/t3/", "vi", 3);
    ins.run("sv", PAGE, "vi", 4);
    ins.run("sz", PAGE, "zh", 5);
    const ids = async (page: string, lang = "vi") =>
      (await (await h.request(`/api/reports?page=${page}&lang=${lang}`)).json<ApiJson>()).items.map((i: { id: string }) => i.id);
    expect(await ids(TEAM_PAGE)).toEqual(["rz", "rv"]);
    expect(await ids(TEAM_PAGE, "zh")).toEqual(["rz", "rv"]);
    expect(await ids("/doi-cong-dong/t3/")).toEqual([]);
    expect(await ids(PAGE)).toEqual(["sv"]);
    expect(((await (await h.request(`/api/reports/stats?page=${TEAM_PAGE}`)).json()) as { total: number }).total).toBe(2);
    expect(((await (await h.request("/api/reports/stats?page=/doi-cong-dong/t3/")).json()) as { total: number }).total).toBe(0);
    expect(((await (await h.request(`/api/reports/stats?page=${PAGE}`)).json()) as { total: number }).total).toBe(2);
  });

  it("duyệt chiến báo thắng của bob -> evidence_count 1; chiến báo của tác giả -> không đổi", async () => {
    const h = createHarness();
    seedSeason(h, "s1");
    await seedTeam(h, { id: "t1" });
    const bobReport = (await (await send(h, "bob", await upload(h))).json<ApiJson>()).id as string;
    const aliceReport = (await (await send(h, "alice", await upload(h, "alice"))).json<ApiJson>()).id as string;
    const evidence = () => (h.sqlite.prepare("select evidence_count as n from community_teams where id = 't1'").get() as { n: number }).n;
    expect((await h.request(`/api/admin/reports/${aliceReport}/approve`, { as: "admin", method: "POST" })).status).toBe(200);
    expect(evidence()).toBe(0);
    expect((await h.request(`/api/admin/reports/${bobReport}/approve`, { as: "admin", method: "POST" })).status).toBe(200);
    expect(evidence()).toBe(1);
  });
});
