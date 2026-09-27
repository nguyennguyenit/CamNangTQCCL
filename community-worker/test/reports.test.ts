import { describe, expect, it } from "vitest";
import { parseAnalysis, REPORT_PROMPT } from "../src/analyze";
import { cleanup } from "../src/cleanup";
import { aggregateStats } from "../src/stats";
import { createHarness, imageForm, PNG_BYTES, type ApiJson, type Harness } from "./fakes";

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
    expect(h.fetchCalls[0].url).toContain("dashscope-intl");
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
