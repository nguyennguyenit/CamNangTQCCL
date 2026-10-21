// AI nháp từ ảnh đội cộng đồng: kill-switch, cấu hình, quyền sở hữu upload, ánh xạ lỗi, rate limit riêng + trần site.

import { describe, expect, it } from "vitest";
import type { AiConfig } from "../../shared/ai-config";
import { createHarness, imageForm, PNG_BYTES, TEST_CONFIG, TEST_GROUP, type Harness } from "./fakes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();
const TEAMS = "/api/community-teams";
const DAY = 86_400_000;

const modelReply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { headers: { "content-type": "application/json" } });

const READ = {
  screen: "teamDetail",
  sides: [
    {
      side: "left",
      heroes: [
        { nameCn: "曹操", tacticsCn: ["奇谋", "连环计", "未知"], booksCn: ["孙子兵法"], statFocusCn: "全智力" },
        { nameCn: "郭嘉", tacticsCn: ["遗计"], booksCn: [], statFocusCn: "" },
      ],
    },
  ],
};

async function upload(h: Harness, as = "alice"): Promise<string> {
  const res = await h.request(`${TEAMS}/uploads`, { as, body: imageForm(PNG_BYTES, "image/png") });
  return (await json(res)).uploadId;
}
const analyze = (h: Harness, id: string, as = "alice") => h.request(`${TEAMS}/uploads/${id}/analyze`, { as, method: "POST" });

async function withUpload(h: Harness) {
  h.setFetch(() => modelReply(JSON.stringify(READ)));
  return upload(h);
}

describe("POST /api/community-teams/uploads/:id/analyze", () => {
  it("kill-switch -> 503 feature_disabled", async () => {
    const h = createHarness({ FEATURE_ENABLED: "false" });
    const id = await upload(h);
    const res = await analyze(h, id);
    expect(res.status).toBe(503);
    expect((await json(res)).error.code).toBe("feature_disabled");
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("nhóm teamScan rỗng -> 503 ai_not_configured (nhóm khác vẫn có)", async () => {
    const h = createHarness();
    const id = await upload(h);
    const config: AiConfig = { ...TEST_CONFIG, groups: { ...TEST_CONFIG.groups, teamScan: { ...TEST_GROUP, chain: [] } } };
    expect((await h.request("/api/admin/ai/config", { as: "admin", method: "PUT", json: config })).status).toBe(200);
    const res = await analyze(h, id);
    expect(res.status).toBe(503);
    expect((await json(res)).error.code).toBe("ai_not_configured");
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("upload của người khác, upload chiến báo, id lạ -> 404", async () => {
    const h = createHarness();
    const bobs = await upload(h, "bob");
    expect((await analyze(h, bobs, "alice")).status).toBe(404);
    h.sqlite
      .prepare("insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values ('rep1', 'u-alice', 'report', 'pending/rep1', 'image/png', 1, 'pending', 1)")
      .run();
    await h.env.MEDIA.put("pending/rep1", PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
    expect((await analyze(h, "rep1")).status).toBe(404);
    expect((await analyze(h, "nope")).status).toBe(404);
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("JSON hợp lệ -> read đúng hợp đồng; gửi đúng ảnh + route teamScan", async () => {
    const h = createHarness();
    const id = await withUpload(h);
    const res = await analyze(h, id);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      read: {
        screen: "teamDetail",
        sides: [
          {
            side: "left",
            heroes: [
              { nameCn: "曹操", tacticsCn: ["奇谋", "连环计", "未知"], booksCn: ["孙子兵法"], statFocusCn: "全智力" },
              { nameCn: "郭嘉", tacticsCn: ["遗计"], booksCn: [], statFocusCn: "" },
            ],
          },
        ],
      },
    });
    const sent = JSON.parse(String(h.fetchCalls[0].init?.body));
    expect(sent.messages[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/u);
    expect(h.objects.has(`pending/team-${id}`)).toBe(true);
  });

  it("nội dung không parse được -> {screen:'other', sides:[]}, upload còn", async () => {
    const h = createHarness();
    const id = await withUpload(h);
    h.setFetch(() => modelReply("xin lỗi, không đọc được"));
    const res = await analyze(h, id);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ read: { screen: "other", sides: [] } });
    expect(h.objects.has(`pending/team-${id}`)).toBe(true);
    expect(h.sqlite.prepare("select count(*) n from uploads").get()).toEqual({ n: 1 });
  });

  it("response rỗng -> 502 ai_unavailable; upstream 429 -> 503 ai_overloaded; 5xx -> 502; upload luôn còn", async () => {
    const h = createHarness();
    const id = await withUpload(h);
    h.setFetch(() => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { headers: { "content-type": "application/json" } }));
    const empty = await analyze(h, id);
    expect(empty.status).toBe(502);
    expect((await json(empty)).error.code).toBe("ai_unavailable");

    h.setFetch(() => new Response("busy", { status: 429 }));
    const busy = await analyze(h, id);
    expect(busy.status).toBe(503);
    expect((await json(busy)).error.code).toBe("ai_overloaded");

    h.setFetch(() => new Response("boom", { status: 500 }));
    const down = await analyze(h, id);
    expect(down.status).toBe(502);
    expect((await json(down)).error.code).toBe("ai_unavailable");

    expect(h.objects.has(`pending/team-${id}`)).toBe(true);
    expect(h.sqlite.prepare("select count(*) n from uploads").get()).toEqual({ n: 1 });
  });

  it("fetch ném lỗi mạng -> 502 ai_unavailable, upload còn", async () => {
    const h = createHarness();
    const id = await withUpload(h);
    h.setFetch(() => {
      throw new TypeError("bug");
    });
    const res = await analyze(h, id);
    expect(res.status).toBe(502);
    expect((await json(res)).error.code).toBe("ai_unavailable");
    expect(h.objects.has(`pending/team-${id}`)).toBe(true);
  });

  it("team_analyze tách khỏi analyze: 20/ngày/user, quota analyze của chiến báo không ảnh hưởng", async () => {
    const h = createHarness();
    const id = await withUpload(h);
    const windowStart = Math.floor(h.clock.now / DAY) * DAY;
    h.sqlite.prepare("insert into rate_limits (key, count, expires_at) values (?, 20, ?)").run(`analyze:u-alice:${windowStart}`, windowStart + DAY);
    expect((await analyze(h, id)).status).toBe(200);
    for (let i = 0; i < 19; i++) expect((await analyze(h, id)).status).toBe(200);
    const res = await analyze(h, id);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    // user khác không bị ảnh hưởng bởi trần riêng của alice
    const bobs = await upload(h, "bob");
    expect((await analyze(h, bobs, "bob")).status).toBe(200);
  });

  it("trần team_analyze_global hết -> 429 cho user khác, không gọi model", async () => {
    const h = createHarness();
    const id = await withUpload(h);
    const windowStart = Math.floor(h.clock.now / DAY) * DAY;
    h.sqlite.prepare("insert into rate_limits (key, count, expires_at) values (?, 300, ?)").run(`team_analyze_global:site:${windowStart}`, windowStart + DAY);
    const res = await analyze(h, id);
    expect(res.status).toBe(429);
    expect(h.fetchCalls).toHaveLength(0);
    const bobs = await upload(h, "bob");
    expect((await analyze(h, bobs, "bob")).status).toBe(429);
    // ngày mới: trần reset
    h.clock.now += DAY;
    expect((await analyze(h, id)).status).toBe(200);
  });
});
