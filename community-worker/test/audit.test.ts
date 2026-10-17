// Nhật ký quản trị: mọi thao tác ghi của root/KDV sinh đúng một dòng admin_audit phản ánh kết quả thật.

import { describe, expect, it } from "vitest";
import { AI_GROUPS } from "../../shared/ai-config";
import { sanitizeLabel } from "../src/audit";
import { createHarness, imageForm, PNG_BYTES, TEST_GROUP, TEST_PROVIDER, type ApiJson, type Harness } from "./fakes";

const IMAGE_KEY = "scan-samples/s1.png";
const PENDING_KEY = "scan-samples/s2.png";
const AI_BODY = { providers: [TEST_PROVIDER], groups: Object.fromEntries(AI_GROUPS.map((id) => [id, TEST_GROUP])) };
const POST_FIELDS = { slug: "bai-moi", lang: "vi", title: "Tiêu đề", description: "Tóm tắt", bodyMarkdown: "# Nội dung", faq: [], tags: [] };

interface AuditRow {
  id: string;
  actor_id: string;
  actor_role: string;
  actor_label: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  subject_user_id: string | null;
  reason: string | null;
  meta: string | null;
  status: string;
  created_at: number;
}

function audits(h: Harness, action?: string): AuditRow[] {
  const sql = action ? "select * from admin_audit where action = ? order by created_at, id" : "select * from admin_audit order by created_at, id";
  return (action ? h.sqlite.prepare(sql).all(action) : h.sqlite.prepare(sql).all()) as unknown as AuditRow[];
}

function metaOf(row: AuditRow): Record<string, unknown> {
  return row.meta ? (JSON.parse(row.meta) as Record<string, unknown>) : {};
}

async function seed(h: Harness) {
  const report = h.sqlite.prepare(
    "insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values (?, '/doi-chuan/x/', 'vi', ?, 'win', '[]', '[]', 'pending', 1)",
  );
  report.run("r1", "u-alice");
  report.run("r2", "u-alice");
  h.sqlite
    .prepare(
      "insert into posts (id, slug, lang, title, description, body_markdown, faq, tags, status, author_name, published_at, updated_at, created_at) values (?, ?, 'vi', ?, 'Mô tả', '# Nội dung', '[]', '[]', ?, 'a', ?, 1, 1)",
    )
    .run("p1", "p1", "Bản nháp", "draft", null);
  h.sqlite
    .prepare(
      "insert into posts (id, slug, lang, title, description, body_markdown, faq, tags, status, author_name, published_at, updated_at, created_at) values (?, ?, 'vi', ?, 'Mô tả', '# Nội dung', '[]', '[]', ?, 'a', ?, 1, 1)",
    )
    .run("p2", "p2", "Đã đăng", "published", 5);
  const fb = h.sqlite.prepare("insert into feedback (id, kind, title, body, lang, user_id, status, created_at) values (?, 'bug', ?, 'b', 'vi', ?, 'new', 1)");
  fb.run("f1", "Lỗi A", "u-bob");
  fb.run("f2", "Lỗi ẩn danh", null);
  await h.env.MEDIA.put(IMAGE_KEY, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
  await h.env.MEDIA.put(PENDING_KEY, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
  const sample = h.sqlite.prepare(
    "insert into scan_samples (id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, created_at) values (?, 'u-alice', ?, 'battleReport', 'left', 'vi', '{}', '{\"heroes\":[]}', 'pending', 1)",
  );
  sample.run("s1", IMAGE_KEY);
  sample.run("s2", PENDING_KEY);
  const comment = h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, '/doi-chuan/x/', 'vi', ?, 'nội dung', 1)");
  comment.run("c1", "u-alice");
  comment.run("c-mod", "u-moderator");
}

async function fresh(): Promise<Harness> {
  const h = createHarness();
  await seed(h);
  return h;
}

type Who = "admin" | "moderator";

interface Case {
  name: string;
  who: Who[];
  call: (h: Harness, who: Who) => Promise<Response>;
  expect: { action: string; targetType: string; targetId: string | null; subject: string | null; meta?: Record<string, unknown> };
  reason?: string;
}

const post = (path: string, json: unknown = {}) => (h: Harness, who: Who) => h.request(path, { as: who, json });

const CASES: Case[] = [
  { name: "report.approve", who: ["admin", "moderator"], call: post("/api/admin/reports/r1/approve"), expect: { action: "report.approve", targetType: "report", targetId: "r1", subject: "u-alice" } },
  {
    name: "report.reject",
    who: ["admin", "moderator"],
    call: post("/api/admin/reports/r1/reject", { reason: "ảnh mờ" }),
    expect: { action: "report.reject", targetType: "report", targetId: "r1", subject: "u-alice" },
    reason: "ảnh mờ",
  },
  {
    name: "comment.delete",
    who: ["admin", "moderator"],
    call: (h, who) => h.request("/api/comments/c1", { as: who, method: "DELETE" }),
    expect: { action: "comment.delete", targetType: "comment", targetId: "c1", subject: "u-alice" },
  },
  {
    name: "feedback.status (có tài khoản)",
    who: ["admin", "moderator"],
    call: post("/api/admin/feedback/f1/status", { status: "done" }),
    expect: { action: "feedback.status", targetType: "feedback", targetId: "f1", subject: "u-bob", meta: { status: "done" } },
  },
  {
    name: "feedback.status (ẩn danh)",
    who: ["admin", "moderator"],
    call: post("/api/admin/feedback/f2/status", { status: "done" }),
    expect: { action: "feedback.status", targetType: "feedback", targetId: "f2", subject: null, meta: { status: "done" } },
  },
  { name: "scan_sample.approve", who: ["admin", "moderator"], call: post("/api/admin/scan-samples/s2/approve"), expect: { action: "scan_sample.approve", targetType: "scan_sample", targetId: "s2", subject: "u-alice" } },
  { name: "scan_sample.reject", who: ["admin", "moderator"], call: post("/api/admin/scan-samples/s2/reject"), expect: { action: "scan_sample.reject", targetType: "scan_sample", targetId: "s2", subject: "u-alice" } },
  { name: "post.update (nháp, không deploy)", who: ["admin"], call: (h, who) => h.request("/api/admin/posts/p1", { as: who, method: "PUT", json: { title: "Mới" } }), expect: { action: "post.update", targetType: "post", targetId: "p1", subject: null } },
  {
    name: "post.update (đã đăng, deploy ok)",
    who: ["admin"],
    call: (h, who) => h.request("/api/admin/posts/p2", { as: who, method: "PUT", json: { title: "Mới" } }),
    expect: { action: "post.update", targetType: "post", targetId: "p2", subject: null, meta: { deploy: "ok" } },
  },
  { name: "post.delete (nháp)", who: ["admin"], call: (h, who) => h.request("/api/admin/posts/p1", { as: who, method: "DELETE" }), expect: { action: "post.delete", targetType: "post", targetId: "p1", subject: null } },
  {
    name: "post.delete (đã đăng)",
    who: ["admin"],
    call: (h, who) => h.request("/api/admin/posts/p2", { as: who, method: "DELETE" }),
    expect: { action: "post.delete", targetType: "post", targetId: "p2", subject: null, meta: { deploy: "ok" } },
  },
  { name: "post.publish", who: ["admin"], call: post("/api/admin/posts/p1/publish"), expect: { action: "post.publish", targetType: "post", targetId: "p1", subject: null, meta: { deploy: "ok" } } },
  { name: "post.unpublish", who: ["admin"], call: post("/api/admin/posts/p2/unpublish"), expect: { action: "post.unpublish", targetType: "post", targetId: "p2", subject: null, meta: { deploy: "ok" } } },
  {
    name: "post.upload",
    who: ["admin"],
    call: (h, who) => h.request("/api/admin/uploads", { as: who, body: imageForm(PNG_BYTES, "image/png") }),
    expect: { action: "post.upload", targetType: "upload", targetId: "id-0001", subject: null },
  },
  {
    name: "ai.config.update",
    who: ["admin"],
    call: (h, who) => h.request("/api/admin/ai/config", { as: who, method: "PUT", json: AI_BODY }),
    expect: { action: "ai.config.update", targetType: "ai_config", targetId: "ai:config", subject: null, meta: { providers: ["deepseek"], groups: [...AI_GROUPS] } },
  },
];

const ROLE: Record<Who, string> = { admin: "root", moderator: "moderator" };
const USER_ID: Record<Who, string> = { admin: "u-admin", moderator: "u-moderator" };

describe("mỗi thao tác ghi sinh đúng một dòng nhật ký", () => {
  for (const c of CASES) {
    for (const who of c.who) {
      it(`${c.name} bởi ${who}`, async () => {
        const h = await fresh();
        const res = await c.call(h, who);
        expect(res.status).toBeLessThan(300);
        const rows = audits(h);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toMatchObject({
          action: c.expect.action,
          target_type: c.expect.targetType,
          target_id: c.expect.targetId,
          subject_user_id: c.expect.subject,
          actor_id: USER_ID[who],
          actor_role: ROLE[who],
          reason: c.reason ?? null,
          status: "ok",
          created_at: h.clock.now,
        });
        if (c.expect.meta) expect(metaOf(row)).toMatchObject(c.expect.meta);
        else expect(metaOf(row).deploy).toBeUndefined();
      });
    }
  }

  it("post.create: target là bài mới, actor root", async () => {
    const h = await fresh();
    const res = await h.request("/api/admin/posts", { as: "admin", json: POST_FIELDS });
    expect(res.status).toBe(201);
    const id = ((await res.json()) as ApiJson).id;
    const rows = audits(h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "post.create", target_type: "post", target_id: id, subject_user_id: null, actor_role: "root", status: "ok" });
  });

  it("post.create trùng slug (409) không để lại dòng nhật ký", async () => {
    const h = await fresh();
    expect((await h.request("/api/admin/posts", { as: "admin", json: POST_FIELDS })).status).toBe(201);
    const res = await h.request("/api/admin/posts", { as: "admin", json: POST_FIELDS });
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiJson).error.code).toBe("slug_taken");
    expect(audits(h)).toHaveLength(1);
  });

  it("thao tác lặp hợp lệ mỗi lần một dòng", async () => {
    const h = await fresh();
    expect((await h.request("/api/admin/reports/r1/approve", { as: "admin", json: {} })).status).toBe(200);
    h.clock.now += 1000;
    expect((await h.request("/api/admin/reports/r1/approve", { as: "admin", json: {} })).status).toBe(200);
    expect(audits(h, "report.approve")).toHaveLength(2);
  });
});

describe("thất bại / bị chặn", () => {
  const MISSING: [string, string, string, unknown?][] = [
    ["report approve", "POST", "/api/admin/reports/nope/approve", {}],
    ["report reject", "POST", "/api/admin/reports/nope/reject", { reason: "x" }],
    ["comment delete", "DELETE", "/api/comments/nope"],
    ["feedback status", "POST", "/api/admin/feedback/nope/status", { status: "done" }],
    ["scan approve", "POST", "/api/admin/scan-samples/nope/approve", {}],
    ["scan reject", "POST", "/api/admin/scan-samples/nope/reject", {}],
    ["post update", "PUT", "/api/admin/posts/nope", { title: "x" }],
    ["post delete", "DELETE", "/api/admin/posts/nope"],
    ["post publish", "POST", "/api/admin/posts/nope/publish", {}],
    ["post unpublish", "POST", "/api/admin/posts/nope/unpublish", {}],
  ];
  for (const [name, method, path, json] of MISSING) {
    it(`id không tồn tại (${name}) -> 404, 0 dòng`, async () => {
      const h = await fresh();
      const res = await h.request(path, { as: "admin", method, ...(json === undefined ? {} : { json }) });
      expect(res.status).toBe(404);
      expect(audits(h)).toHaveLength(0);
    });
  }

  it("KDV tự duyệt chiến báo của mình -> 200, 1 dòng, subject = chính KDV", async () => {
    const h = await fresh();
    h.sqlite.prepare("update battle_reports set user_id = 'u-moderator' where id = 'r1'").run();
    const res = await h.request("/api/admin/reports/r1/approve", { as: "moderator", json: {} });
    expect(res.status).toBe(200);
    const rows = audits(h, "report.approve");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: "u-moderator", actor_role: "moderator", subject_user_id: "u-moderator", status: "ok" });
  });

  it("KDV tự duyệt/từ chối mẫu soi đội của mình -> 200, mỗi thao tác 1 dòng", async () => {
    const h = await fresh();
    h.sqlite.prepare("update scan_samples set user_id = 'u-moderator' where id = 's2'").run();
    expect((await h.request("/api/admin/scan-samples/s2/approve", { as: "moderator", json: {} })).status).toBe(200);
    expect((await h.request("/api/admin/scan-samples/s2/reject", { as: "moderator", json: {} })).status).toBe(200);
    expect(audits(h, "scan_sample.approve")).toHaveLength(1);
    expect(audits(h, "scan_sample.reject")).toHaveLength(1);
    expect(audits(h)[0]).toMatchObject({ subject_user_id: "u-moderator" });
  });

  it("duyệt mẫu soi đội không còn ảnh -> 409, 0 dòng", async () => {
    const h = await fresh();
    h.sqlite.prepare("update scan_samples set image_key = null where id = 's2'").run();
    expect((await h.request("/api/admin/scan-samples/s2/approve", { as: "admin", json: {} })).status).toBe(409);
    expect(audits(h)).toHaveLength(0);
  });

  it("KDV xoá bình luận của KDV khác -> 403, 0 dòng, bình luận còn; xoá của chính mình -> 0 dòng", async () => {
    const h = await fresh();
    h.sqlite.prepare('update "user" set role = \'moderator\' where id = \'u-alice\'').run();
    expect((await h.request("/api/comments/c1", { as: "moderator", method: "DELETE" })).status).toBe(403);
    expect(audits(h)).toHaveLength(0);
    expect(h.sqlite.prepare("select count(*) n from comments where id = 'c1'").get()).toMatchObject({ n: 1 });
    expect((await h.request("/api/comments/c-mod", { as: "moderator", method: "DELETE" })).status).toBe(200);
    expect(audits(h)).toHaveLength(0);
  });

  it("scan reject: R2 xoá lỗi -> 1 dòng failed, mẫu giữ trạng thái và ảnh", async () => {
    const h = await fresh();
    h.r2Error = new Error("r2 down");
    const res = await h.request("/api/admin/scan-samples/s2/reject", { as: "admin", json: {} });
    expect(res.status).toBe(500);
    h.r2Error = null;
    const rows = audits(h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "scan_sample.reject", status: "failed", target_id: "s2", subject_user_id: "u-alice" });
    expect(metaOf(rows[0])).toMatchObject({ step: "r2" });
    expect(h.sqlite.prepare("select status, image_key from scan_samples where id = 's2'").get()).toMatchObject({ status: "pending", image_key: PENDING_KEY });
    expect(h.objects.has(PENDING_KEY)).toBe(true);
  });

  it("scan reject: ảnh đã xoá rồi D1 lỗi -> 1 dòng partial", async () => {
    const h = await fresh();
    (h.env.DB as unknown as { batch: () => Promise<never> }).batch = async () => {
      throw new Error("d1 down");
    };
    const res = await h.request("/api/admin/scan-samples/s2/reject", { as: "admin", json: {} });
    expect(res.status).toBe(500);
    const rows = audits(h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "scan_sample.reject", status: "partial", subject_user_id: "u-alice" });
    expect(metaOf(rows[0])).toMatchObject({ step: "d1" });
    expect(h.objects.has(PENDING_KEY)).toBe(false);
  });

  it("ai PUT: KV lỗi -> 1 dòng failed, KV không đổi", async () => {
    const h = await fresh();
    const before = [...h.aiStore.entries()];
    h.kvError = new Error("kv down");
    const res = await h.request("/api/admin/ai/config", { as: "admin", method: "PUT", json: AI_BODY });
    expect(res.status).toBe(500);
    h.kvError = null;
    const rows = audits(h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "ai.config.update", status: "failed" });
    expect(metaOf(rows[0])).toMatchObject({ step: "kv" });
    expect([...h.aiStore.entries()]).toEqual(before);
  });

  it("ai PUT: KV xong nhưng ghi nhật ký lỗi -> lỗi nổi lên, không gán nhãn failed của KV", async () => {
    const h = await fresh();
    h.sqlite.exec("drop table admin_audit");
    const res = await h.request("/api/admin/ai/config", { as: "admin", method: "PUT", json: AI_BODY });
    expect(res.status).toBe(500);
  });

  it("publish: GitHub trả 500 -> 1 dòng partial cùng id, meta.deploy ghi status", async () => {
    const h = await fresh();
    h.setFetch(() => new Response("boom", { status: 500 }));
    const res = await h.request("/api/admin/posts/p1/publish", { as: "admin", json: {} });
    expect(res.status).toBe(200);
    const rows = audits(h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "post.publish", status: "partial", target_id: "p1" });
    expect(metaOf(rows[0]).deploy).toMatchObject({ ok: false, status: 500 });
    expect(h.sqlite.prepare("select status from posts where id = 'p1'").get()).toMatchObject({ status: "published" });
  });

  it("publish: thiếu cấu hình deploy hoặc mạng lỗi -> partial", async () => {
    const unconfigured = createHarness({ GITHUB_DISPATCH_TOKEN: undefined });
    await seed(unconfigured);
    expect((await unconfigured.request("/api/admin/posts/p1/publish", { as: "admin", json: {} })).status).toBe(200);
    expect(audits(unconfigured)[0]).toMatchObject({ status: "partial" });
    expect(metaOf(audits(unconfigured)[0]).deploy).toMatchObject({ ok: false, status: null });

    const down = await fresh();
    down.setFetch(() => {
      throw new Error("network");
    });
    expect((await down.request("/api/admin/posts/p1/publish", { as: "admin", json: {} })).status).toBe(200);
    expect(audits(down)).toHaveLength(1);
    expect(audits(down)[0]).toMatchObject({ status: "partial" });
  });

  it("upload: R2 lỗi -> 1 dòng failed (step r2)", async () => {
    const h = await fresh();
    h.r2Error = new Error("r2 down");
    expect((await h.request("/api/admin/uploads", { as: "admin", body: imageForm(PNG_BYTES, "image/png") })).status).toBe(500);
    h.r2Error = null;
    const rows = audits(h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "post.upload", status: "failed" });
    expect(metaOf(rows[0])).toMatchObject({ step: "r2" });
  });

  it("upload: D1 lỗi, xoá bù thành công -> failed; xoá bù lỗi -> partial", async () => {
    const h = await fresh();
    (h.env.DB as unknown as { batch: () => Promise<never> }).batch = async () => {
      throw new Error("d1 down");
    };
    expect((await h.request("/api/admin/uploads", { as: "admin", body: imageForm(PNG_BYTES, "image/png") })).status).toBe(500);
    expect(audits(h)).toHaveLength(1);
    expect(audits(h)[0]).toMatchObject({ action: "post.upload", status: "failed" });
    expect(metaOf(audits(h)[0])).toMatchObject({ step: "d1" });
    expect([...h.objects.keys()].filter((k) => k.startsWith("posts/"))).toHaveLength(0);

    const h2 = await fresh();
    (h2.env.DB as unknown as { batch: () => Promise<never> }).batch = async () => {
      h2.r2Error = new Error("r2 down");
      throw new Error("d1 down");
    };
    expect((await h2.request("/api/admin/uploads", { as: "admin", body: imageForm(PNG_BYTES, "image/png") })).status).toBe(500);
    h2.r2Error = null;
    expect(audits(h2)).toHaveLength(1);
    expect(audits(h2)[0]).toMatchObject({ action: "post.upload", status: "partial" });
    expect([...h2.objects.keys()].filter((k) => k.startsWith("posts/"))).toHaveLength(1);
  });

  it("xoá bình luận: lỗi ghi nhật ký -> cả batch rollback, bình luận còn", async () => {
    const h = await fresh();
    h.sqlite.exec("drop table admin_audit");
    expect((await h.request("/api/comments/c1", { as: "admin", method: "DELETE" })).status).toBe(500);
    expect(h.sqlite.prepare("select count(*) n from comments where id = 'c1'").get()).toMatchObject({ n: 1 });
  });

  it("xoá bài: lỗi ghi nhật ký -> bài còn", async () => {
    const h = await fresh();
    h.sqlite.exec("drop table admin_audit");
    expect((await h.request("/api/admin/posts/p1", { as: "admin", method: "DELETE" })).status).toBe(500);
    expect(h.sqlite.prepare("select count(*) n from posts where id = 'p1'").get()).toMatchObject({ n: 1 });
  });

  it("sửa bài nháp không để lại meta.deploy pending", async () => {
    const h = await fresh();
    await h.request("/api/admin/posts/p1", { as: "admin", method: "PUT", json: { title: "Mới" } });
    expect(audits(h)[0].meta ?? "").not.toContain("pending");
  });

  it("sửa bài đã đăng: GitHub 500 -> partial, cùng một dòng", async () => {
    const h = await fresh();
    h.setFetch(() => new Response("boom", { status: 500 }));
    const res = await h.request("/api/admin/posts/p2", { as: "admin", method: "PUT", json: { title: "Mới" } });
    expect(res.status).toBe(200);
    expect(audits(h)).toHaveLength(1);
    expect(audits(h)[0]).toMatchObject({ status: "partial" });
    expect(metaOf(audits(h)[0]).deploy).toMatchObject({ ok: false, status: 500 });
  });
});

describe("không rò thông tin", () => {
  it("ai.config.update không chứa apiKey/endpoint", async () => {
    const h = await fresh();
    const body = { providers: [{ ...TEST_PROVIDER, apiKey: "sk-super-secret-key" }], groups: AI_BODY.groups };
    expect((await h.request("/api/admin/ai/config", { as: "admin", method: "PUT", json: body })).status).toBe(200);
    const dump = JSON.stringify(audits(h, "ai.config.update"));
    expect(dump).not.toContain("sk-super-secret-key");
    expect(dump).not.toContain("test-key");
    expect(dump).not.toContain(TEST_PROVIDER.endpoint);
    expect(dump).not.toContain("https://");
  });

  it("actor_label/target_label không chứa email đầy đủ (kể cả khi tên/tiêu đề là email)", async () => {
    const h = await fresh();
    h.sqlite.prepare('update "user" set name = ? where id = \'u-admin\'').run("liên hệ admin@example.com");
    h.sqlite.prepare("update posts set title = ? where id = 'p2'").run("Gửi tới secret.person@gmail.com ngay");
    h.sqlite.prepare("update feedback set title = ? where id = 'f1'").run("bob@example.com bị lỗi");
    expect((await h.request("/api/admin/posts/p2/unpublish", { as: "admin", json: {} })).status).toBe(200);
    expect((await h.request("/api/admin/feedback/f1/status", { as: "admin", json: { status: "done" } })).status).toBe(200);
    expect((await h.request("/api/admin/reports/r1/approve", { as: "moderator", json: {} })).status).toBe(200);
    const rows = audits(h);
    expect(rows.length).toBe(3);
    for (const row of rows) {
      for (const label of [row.actor_label, row.target_label ?? ""]) {
        expect(label).not.toContain("admin@example.com");
        expect(label).not.toContain("secret.person@gmail.com");
        expect(label).not.toContain("bob@example.com");
        expect(label).not.toContain("mod@example.com");
      }
    }
    expect(rows[0].actor_label).toContain("ad***@example.com");
    expect(rows[0].target_label).toContain("se***@gmail.com");
  });

  it("sanitizeLabel che mọi email, cắt độ dài", () => {
    expect(sanitizeLabel("a@b.co và long.name@example.org!")).toBe("a***@b.co và lo***@example.org!");
    expect(sanitizeLabel("không email")).toBe("không email");
    expect(sanitizeLabel("x".repeat(500))?.length).toBeLessThanOrEqual(120);
    expect(sanitizeLabel(null)).toBeNull();
  });
});

describe("xoá bình luận", () => {
  it("chủ tự xoá -> 0 dòng", async () => {
    const h = await fresh();
    expect((await h.request("/api/comments/c1", { as: "alice", method: "DELETE" })).status).toBe(200);
    expect(audits(h)).toHaveLength(0);
  });

  it("root xoá bình luận của chính mình -> 0 dòng", async () => {
    const h = await fresh();
    h.sqlite.prepare("update comments set user_id = 'u-admin' where id = 'c1'").run();
    expect((await h.request("/api/comments/c1", { as: "admin", method: "DELETE" })).status).toBe(200);
    expect(audits(h)).toHaveLength(0);
  });

  it("KDV xoá bình luận của user thường -> 1 dòng, subject = tác giả", async () => {
    const h = await fresh();
    expect((await h.request("/api/comments/c1", { as: "moderator", method: "DELETE" })).status).toBe(200);
    const rows = audits(h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "comment.delete", subject_user_id: "u-alice", actor_role: "moderator" });
  });
});

describe("GET /api/admin/audit", () => {
  function insertRows(h: Harness, n: number) {
    const stmt = h.sqlite.prepare(
      "insert into admin_audit (id, actor_id, actor_role, actor_label, action, target_type, target_id, subject_user_id, status, created_at) values (?, 'u-admin', 'root', 'Admin <ad***@example.com>', ?, 'report', ?, 'u-alice', 'ok', ?)",
    );
    for (let i = 0; i < n; i++) stmt.run(`a-${String(i).padStart(3, "0")}`, i % 2 ? "report.reject" : "report.approve", `r${i}`, 1000 + Math.floor(i / 2));
  }

  it("khách 401, user 403, KDV 403, root 200", async () => {
    const h = await fresh();
    expect((await h.request("/api/admin/audit")).status).toBe(401);
    expect((await h.request("/api/admin/audit", { as: "bob" })).status).toBe(403);
    expect((await h.request("/api/admin/audit", { as: "moderator" })).status).toBe(403);
    const res = await h.request("/api/admin/audit", { as: "admin" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as ApiJson).items).toEqual([]);
  });

  it("trả hình dạng đầy đủ, mới nhất trước", async () => {
    const h = await fresh();
    await h.request("/api/admin/reports/r1/reject", { as: "moderator", json: { reason: "mờ" } });
    h.clock.now += 1000;
    await h.request("/api/admin/feedback/f1/status", { as: "admin", json: { status: "done" } });
    const body = (await (await h.request("/api/admin/audit", { as: "admin" })).json()) as { items: Record<string, unknown>[]; nextCursor: string | null };
    expect(body.nextCursor).toBeNull();
    expect(body.items.map((i) => i.action)).toEqual(["feedback.status", "report.reject"]);
    expect(body.items[1]).toMatchObject({
      actor: { id: "u-moderator", role: "moderator", label: "Moderator <mo***@example.com>" },
      action: "report.reject",
      target: { type: "report", id: "r1" },
      subjectUserId: "u-alice",
      reason: "mờ",
      status: "ok",
    });
    expect(typeof body.items[1].createdAt).toBe("string");
    expect(body.items[0].meta).toEqual({ status: "done" });
  });

  it("lọc theo action", async () => {
    const h = await fresh();
    insertRows(h, 6);
    const body = (await (await h.request("/api/admin/audit?action=report.reject", { as: "admin" })).json()) as { items: { action: string }[] };
    expect(body.items).toHaveLength(3);
    expect(body.items.every((i) => i.action === "report.reject")).toBe(true);
    expect((await h.request("/api/admin/audit?action=bad%20action", { as: "admin" })).status).toBe(400);
  });

  it("phân trang 20/trang qua 25 dòng, không trùng, không sót (kể cả cùng created_at)", async () => {
    const h = await fresh();
    insertRows(h, 25);
    const first = (await (await h.request("/api/admin/audit", { as: "admin" })).json()) as { items: { id: string }[]; nextCursor: string | null };
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBeTruthy();
    const second = (await (await h.request(`/api/admin/audit?cursor=${first.nextCursor}`, { as: "admin" })).json()) as { items: { id: string }[]; nextCursor: string | null };
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(25);
    expect(ids).toEqual([...ids].sort().reverse());
    expect((await h.request("/api/admin/audit?cursor=%%%", { as: "admin" })).status).toBe(400);
  });

  it("lọc kèm phân trang", async () => {
    const h = await fresh();
    insertRows(h, 50);
    const first = (await (await h.request("/api/admin/audit?action=report.approve", { as: "admin" })).json()) as { items: { id: string }[]; nextCursor: string | null };
    expect(first.items).toHaveLength(20);
    const second = (await (await h.request(`/api/admin/audit?action=report.approve&cursor=${first.nextCursor}`, { as: "admin" })).json()) as { items: { id: string }[]; nextCursor: string | null };
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
  });
});
