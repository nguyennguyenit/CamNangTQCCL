// Ma trận phân quyền root / kiểm duyệt viên (KDV) / user / khách qua guard thật (harness đọc DB mỗi request).

import { describe, expect, it } from "vitest";
import { AI_GROUPS } from "../../shared/ai-config";
import { createHarness, imageForm, PNG_BYTES, TEST_GROUP, TEST_PROVIDER, type ApiJson, type Harness } from "./fakes";

const IMAGE_KEY = "scan-samples/s1.png";
const PENDING_KEY = "scan-samples/s2.png";

/** Dữ liệu hợp lệ cho mọi endpoint: kết quả khác 401/403 chỉ phụ thuộc quyền. */
async function seed(h: Harness) {
  h.sqlite
    .prepare(
      "insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values (?, '/doi-chuan/x/', 'vi', 'u-alice', 'win', '[]', '[]', 'pending', 1)",
    )
    .run("r1");
  h.sqlite
    .prepare(
      "insert into posts (id, slug, lang, title, description, body_markdown, faq, tags, status, author_name, updated_at, created_at) values ('p1', 'p1', 'vi', 't', '', '', '[]', '[]', 'draft', 'a', 1, 1)",
    )
    .run();
  h.sqlite.prepare("insert into feedback (id, kind, title, body, lang, status, created_at) values ('f1', 'bug', 't', 'b', 'vi', 'new', 1)").run();
  await h.env.MEDIA.put(IMAGE_KEY, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
  await h.env.MEDIA.put(PENDING_KEY, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
  const sample = h.sqlite.prepare(
    "insert into scan_samples (id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, created_at) values (?, 'u-alice', ?, 'battleReport', 'left', 'vi', '{}', '{\"heroes\":[]}', ?, 1)",
  );
  sample.run("s1", IMAGE_KEY, "approved");
  sample.run("s2", PENDING_KEY, "pending");
  h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values ('c1', '/doi-chuan/x/', 'vi', 'u-alice', 'hi', 1)").run();
}

type Who = "guest" | "bob" | "moderator" | "admin";
type Allowed = "staff" | "root";

interface Endpoint {
  method: string;
  path: string;
  allowed: Allowed;
  /** Mã thành công mong đợi (mặc định 200). */
  ok?: number;
  body?: () => { json?: unknown; body?: BodyInit };
  /** Trạng thái đã lưu sau khi thao tác thành công. */
  persisted?: (h: Harness) => void;
}

const POST_FIELDS = { slug: "bai-moi", lang: "vi", title: "Tiêu đề", description: "Tóm tắt", bodyMarkdown: "# Nội dung", faq: [], tags: [] };
const AI_BODY = { providers: [TEST_PROVIDER], groups: Object.fromEntries(AI_GROUPS.map((id) => [id, TEST_GROUP])) };

function table(h: Harness, name: string, id: string): object {
  return { ...(h.sqlite.prepare(`select * from ${name} where id = ?`).get(id) as object) };
}

/** Toàn bộ trạng thái ghi được của các bảng admin + R2 + KV, để chứng minh yêu cầu bị từ chối không đổi gì. */
function snapshot(h: Harness) {
  const dump = (name: string) => h.sqlite.prepare(`select * from ${name} order by id`).all().map((r) => ({ ...r }));
  return {
    tables: ["battle_reports", "scan_samples", "feedback", "posts", "comments", "uploads"].map(dump),
    objects: [...h.objects.keys()].sort(),
    ai: [...h.aiStore.entries()],
  };
}

/** Danh mục tường minh 22 endpoint admin (theo route trong src/routes). */
const INVENTORY = [
  "GET /api/admin/counts",
  "GET /api/admin/comments",
  "GET /api/admin/feedback",
  "POST /api/admin/feedback/f1/status",
  "GET /api/admin/reports",
  "POST /api/admin/reports/r1/approve",
  "POST /api/admin/reports/r1/reject",
  "GET /api/admin/scan-stats",
  "GET /api/admin/scan-samples",
  "GET /api/admin/scan-samples/s1/image",
  "POST /api/admin/scan-samples/s2/approve",
  "POST /api/admin/scan-samples/s2/reject",
  "GET /api/admin/scan-samples/s1/fixture",
  "GET /api/admin/ai/config",
  "PUT /api/admin/ai/config",
  "GET /api/admin/posts",
  "POST /api/admin/posts",
  "PUT /api/admin/posts/p1",
  "DELETE /api/admin/posts/p1",
  "POST /api/admin/posts/p1/publish",
  "POST /api/admin/posts/p1/unpublish",
  "POST /api/admin/uploads",
];

const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/api/admin/counts", allowed: "staff" },
  { method: "GET", path: "/api/admin/comments", allowed: "staff" },
  { method: "GET", path: "/api/admin/feedback", allowed: "staff" },
  {
    method: "POST",
    path: "/api/admin/feedback/f1/status",
    allowed: "staff",
    body: () => ({ json: { status: "done" } }),
    persisted: (h) => expect(table(h, "feedback", "f1")).toMatchObject({ status: "done" }),
  },
  { method: "GET", path: "/api/admin/reports", allowed: "staff" },
  {
    method: "POST",
    path: "/api/admin/reports/r1/approve",
    allowed: "staff",
    body: () => ({ json: {} }),
    persisted: (h) => expect(table(h, "battle_reports", "r1")).toMatchObject({ status: "approved", reject_reason: null, reviewed_at: h.clock.now }),
  },
  {
    method: "POST",
    path: "/api/admin/reports/r1/reject",
    allowed: "staff",
    body: () => ({ json: { reason: "sai" } }),
    persisted: (h) => expect(table(h, "battle_reports", "r1")).toMatchObject({ status: "rejected", reject_reason: "sai", reviewed_at: h.clock.now }),
  },
  { method: "GET", path: "/api/admin/scan-stats", allowed: "staff" },
  { method: "GET", path: "/api/admin/scan-samples", allowed: "staff" },
  { method: "GET", path: "/api/admin/scan-samples/s1/image", allowed: "staff" },
  {
    method: "POST",
    path: "/api/admin/scan-samples/s2/approve",
    allowed: "staff",
    body: () => ({ json: {} }),
    persisted: (h) => expect(table(h, "scan_samples", "s2")).toMatchObject({ status: "approved", image_key: PENDING_KEY, reviewed_at: h.clock.now }),
  },
  {
    method: "POST",
    path: "/api/admin/scan-samples/s2/reject",
    allowed: "staff",
    body: () => ({ json: {} }),
    persisted: (h) => {
      expect(table(h, "scan_samples", "s2")).toMatchObject({ status: "rejected", image_key: null, reviewed_at: h.clock.now });
      expect(h.objects.has(PENDING_KEY)).toBe(false);
    },
  },
  { method: "GET", path: "/api/admin/scan-samples/s1/fixture", allowed: "staff" },
  { method: "GET", path: "/api/admin/ai/config", allowed: "root" },
  { method: "PUT", path: "/api/admin/ai/config", allowed: "root", body: () => ({ json: AI_BODY }) },
  { method: "GET", path: "/api/admin/posts", allowed: "root" },
  { method: "POST", path: "/api/admin/posts", allowed: "root", ok: 201, body: () => ({ json: POST_FIELDS }) },
  { method: "PUT", path: "/api/admin/posts/p1", allowed: "root", body: () => ({ json: POST_FIELDS }) },
  {
    method: "DELETE",
    path: "/api/admin/posts/p1",
    allowed: "root",
    persisted: (h) => expect(h.sqlite.prepare("select count(*) n from posts where id = 'p1'").get()).toMatchObject({ n: 0 }),
  },
  {
    method: "POST",
    path: "/api/admin/posts/p1/publish",
    allowed: "root",
    body: () => ({ json: {} }),
    persisted: (h) => expect(table(h, "posts", "p1")).toMatchObject({ status: "published" }),
  },
  { method: "POST", path: "/api/admin/posts/p1/unpublish", allowed: "root", body: () => ({ json: {} }) },
  { method: "POST", path: "/api/admin/uploads", allowed: "root", ok: 201, body: () => ({ body: imageForm(PNG_BYTES, "image/png") }) },
];

function expected(endpoint: Endpoint, who: Who): number {
  if (who === "guest") return 401;
  if (who === "admin" || (who === "moderator" && endpoint.allowed === "staff")) return endpoint.ok ?? 200;
  return 403;
}

describe("ma trận quyền: 22 endpoint admin × khách/user/KDV/root", () => {
  it("bảng phủ đúng 22 endpoint admin (so tập method + path với danh mục tường minh)", () => {
    const covered = ENDPOINTS.map((e) => `${e.method} ${e.path}`);
    expect(new Set(covered).size).toBe(covered.length);
    expect([...covered].sort()).toEqual([...INVENTORY].sort());
  });

  for (const endpoint of ENDPOINTS) {
    for (const who of ["guest", "bob", "moderator", "admin"] as const) {
      it(`${endpoint.method} ${endpoint.path} — ${who} → ${expected(endpoint, who)}`, async () => {
        const h = createHarness();
        await seed(h);
        const before = snapshot(h);
        const res = await h.request(endpoint.path, {
          method: endpoint.method,
          ...(who === "guest" ? {} : { as: who }),
          ...endpoint.body?.(),
        });
        const status = expected(endpoint, who);
        expect(res.status, await res.clone().text()).toBe(status);
        // Bị từ chối: không đổi gì (D1, R2, KV); được phép: lưu đúng trạng thái.
        if (status === 401 || status === 403) expect(snapshot(h)).toEqual(before);
        else endpoint.persisted?.(h);
      });
    }
  }
});

describe("/api/admin/counts giữ nguyên hình dạng cho KDV", () => {
  it("KDV và root cùng nhận 5 trường đếm", async () => {
    const h = createHarness();
    await seed(h);
    const keys = ["feedbackDone", "feedbackNew", "postsDraft", "reportsPending", "scanPending"];
    for (const as of ["moderator", "admin"]) {
      expect(Object.keys(await (await h.request("/api/admin/counts", { as })).json<ApiJson>()).sort()).toEqual(keys);
    }
  });
});

describe("thu/cấp quyền có hiệu lực ngay (harness đọc DB mỗi request)", () => {
  it("thu moderator -> 403; cấp lại -> 200; user cấp moderator -> 200", async () => {
    const h = createHarness();
    expect((await h.request("/api/admin/counts", { as: "moderator" })).status).toBe(200);
    h.sqlite.prepare("update \"user\" set role = 'user' where id = 'u-moderator'").run();
    expect((await h.request("/api/admin/counts", { as: "moderator" })).status).toBe(403);
    expect((await h.request("/api/me", { as: "moderator" }).then((r) => r.json<ApiJson>())).user.role).toBe("user");
    h.sqlite.prepare("update \"user\" set role = 'moderator' where id = 'u-bob'").run();
    expect((await h.request("/api/admin/counts", { as: "bob" })).status).toBe(200);
  });

  it("root từ ADMIN_EMAILS thắng user.role: root có role='moderator' vẫn là root", async () => {
    const h = createHarness();
    h.sqlite.prepare("update \"user\" set role = 'moderator' where id = 'u-admin'").run();
    expect((await h.request("/api/me", { as: "admin" }).then((r) => r.json<ApiJson>())).user.role).toBe("root");
    expect((await h.request("/api/admin/ai/config", { as: "admin" })).status).toBe(200);
  });
});

describe("/api/me", () => {
  it("trả đúng 3 giá trị role; khoá user chỉ gồm id, name, email, image, role", async () => {
    const h = createHarness();
    for (const [as, role] of [["bob", "user"], ["moderator", "moderator"], ["admin", "root"]] as const) {
      const body = await (await h.request("/api/me", { as })).json<ApiJson>();
      expect(body.user.role).toBe(role);
      expect(Object.keys(body.user).sort()).toEqual(["email", "id", "image", "name", "role"]);
    }
  });
});

function addUser(h: Harness, id: string, email: string, role: "user" | "moderator") {
  h.sqlite
    .prepare('insert into "user" (id, name, email, emailVerified, image, createdAt, updatedAt, role) values (?, ?, ?, 1, null, ?, ?, ?)')
    .run(id, id, email, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", role);
  h.sqlite
    .prepare("insert into session (id, expiresAt, token, createdAt, updatedAt, userId) values (?, ?, ?, ?, ?, ?)")
    .run(`s-${id}`, "2099-01-01T00:00:00.000Z", id, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", id);
}

function addComment(h: Harness, id: string, userId: string) {
  h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, '/doi-chuan/x/', 'vi', ?, 'nội dung', 1)").run(id, userId);
}

function commentCount(h: Harness, id: string): number {
  return Number((h.sqlite.prepare("select count(*) n from comments where id = ?").get(id) as { n: number }).n);
}

describe("xoá bình luận: KDV chỉ với user thường", () => {
  async function setup() {
    const h = createHarness();
    addUser(h, "mod2", "mod2@example.com", "moderator");
    // role='user' nhưng email thuộc ADMIN_EMAILS: vẫn là root theo effectiveRole.
    addUser(h, "other", "other@example.com", "user");
    addComment(h, "c-alice", "u-alice");
    addComment(h, "c-mod", "u-moderator");
    addComment(h, "c-mod2", "mod2");
    addComment(h, "c-root", "u-admin");
    addComment(h, "c-other", "other");
    return h;
  }

  it("canDelete ở danh sách công khai và danh sách admin theo cùng chính sách, không lộ email tác giả", async () => {
    const h = await setup();
    const canDelete = async (path: string, as?: string) => {
      const res = await h.request(path, as ? { as } : {});
      const text = await res.text();
      expect(text).not.toContain("example.com");
      return Object.fromEntries(JSON.parse(text).items.map((i: { id: string; canDelete: boolean }) => [i.id, i.canDelete]));
    };
    for (const path of ["/api/comments?page=/doi-chuan/x/&lang=vi", "/api/admin/comments"]) {
      expect(await canDelete(path, "moderator"), path).toEqual({
        "c-alice": true, "c-mod": true, "c-mod2": false, "c-root": false, "c-other": false,
      });
      expect(await canDelete(path, "admin"), path).toEqual({
        "c-alice": true, "c-mod": true, "c-mod2": true, "c-root": true, "c-other": true,
      });
    }
    expect(await canDelete("/api/comments?page=/doi-chuan/x/&lang=vi", "bob")).toEqual({
      "c-alice": false, "c-mod": false, "c-mod2": false, "c-root": false, "c-other": false,
    });
    expect(Object.values(await canDelete("/api/comments?page=/doi-chuan/x/&lang=vi")).some(Boolean)).toBe(false);
  });

  it("KDV xoá được bình luận user thường và của chính mình; 403 với KDV khác, root, email thuộc ADMIN_EMAILS", async () => {
    const h = await setup();
    const del = (id: string, as: string) => h.request(`/api/comments/${id}`, { method: "DELETE", as });
    expect((await del("c-alice", "moderator")).status).toBe(200);
    expect((await del("c-mod", "moderator")).status).toBe(200);
    for (const id of ["c-mod2", "c-root", "c-other"]) {
      const res = await del(id, "moderator");
      expect(res.status, id).toBe(403);
      expect((await res.json<ApiJson>()).error.code).toBe("forbidden");
      expect(commentCount(h, id), id).toBe(1);
    }
    expect(commentCount(h, "c-alice") + commentCount(h, "c-mod")).toBe(0);
  });

  it("root xoá được mọi bình luận kể cả của KDV", async () => {
    const h = await setup();
    for (const id of ["c-mod2", "c-root", "c-alice"]) {
      expect((await h.request(`/api/comments/${id}`, { method: "DELETE", as: "admin" })).status).toBe(200);
      expect(commentCount(h, id), id).toBe(0);
    }
    expect(commentCount(h, "c-mod")).toBe(1);
  });

  it("tác giả được nâng thành KDV sau khi KDV khác đã đọc: DELETE kiểm lại trong SQL", async () => {
    const h = await setup();
    afterFirstRead(h, "where c.id = ?", () => h.sqlite.prepare("update \"user\" set role = 'moderator' where id = 'u-alice'").run());
    const res = await h.request("/api/comments/c-alice", { method: "DELETE", as: "moderator" });
    expect(res.status).toBe(403);
    expect(commentCount(h, "c-alice")).toBe(1);
  });

  it("tác giả đổi email thành ADMIN_EMAILS (không phân biệt hoa thường) sau khi KDV đã đọc: DELETE kiểm lại trong SQL", async () => {
    const h = await setup();
    afterFirstRead(h, "where c.id = ?", () => h.sqlite.prepare("update \"user\" set email = ' Other@Example.com ' where id = 'u-alice'").run());
    const res = await h.request("/api/comments/c-alice", { method: "DELETE", as: "moderator" });
    expect(res.status).toBe(403);
    expect(commentCount(h, "c-alice")).toBe(1);
  });
});

/** Chạy `effect` ngay sau lần `first()` đầu của câu lệnh chứa `marker` (giả lập race đọc -> ghi); trả hàm gỡ hook. */
function afterFirstRead(h: Harness, marker: string, effect: () => void): () => void {
  const original = h.env.DB;
  let fired = false;
  h.env.DB = {
    ...original,
    batch: original.batch.bind(original),
    prepare: (sql: string) => {
      const stmt = original.prepare(sql);
      if (!sql.includes(marker) || fired) return stmt;
      return {
        bind: (...values: unknown[]) => ({
          first: async (...args: unknown[]) => {
            const row = await (stmt.bind(...values).first as (...a: unknown[]) => Promise<unknown>)(...args);
            fired = true;
            effect();
            return row;
          },
        }),
      };
    },
  } as unknown as D1Database;
  return () => {
    h.env.DB = original;
  };
}

describe("ảnh chiến báo chưa duyệt", () => {
  it("KDV xem được của người khác (200); user khác 404", async () => {
    const h = createHarness();
    await h.env.MEDIA.put("reports/r1.png", PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
    h.sqlite
      .prepare(
        "insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, status, created_at) values ('r1', '/doi-chuan/x/', 'vi', 'u-alice', 'reports/r1.png', 'win', '[]', '[]', 'pending', 1)",
      )
      .run();
    expect((await h.request("/api/reports/r1/image", { as: "moderator" })).status).toBe(200);
    expect((await h.request("/api/reports/r1/image", { as: "admin" })).status).toBe(200);
    expect((await h.request("/api/reports/r1/image", { as: "alice" })).status).toBe(200);
    expect((await h.request("/api/reports/r1/image", { as: "bob" })).status).toBe(404);
    expect((await h.request("/api/reports/r1/image")).status).toBe(404);
  });
});

describe("KDV duyệt nội dung của chính mình", () => {
  function addReport(h: Harness, id: string, userId: string) {
    h.sqlite
      .prepare(
        "insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values (?, '/doi-chuan/x/', 'vi', ?, 'win', '[]', '[]', 'pending', 1)",
      )
      .run(id, userId);
  }
  async function addSample(h: Harness, id: string, userId: string, withImage = true) {
    const key = `scan-samples/${id}.png`;
    if (withImage) await h.env.MEDIA.put(key, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
    h.sqlite
      .prepare(
        "insert into scan_samples (id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, created_at) values (?, ?, ?, 'battleReport', 'left', 'vi', '{}', '{}', 'pending', 1)",
      )
      .run(id, userId, withImage ? key : null);
  }
  const row = (h: Harness, table: string, id: string) => ({ ...(h.sqlite.prepare(`select * from ${table} where id = ?`).get(id) as object) });

  it("chiến báo: KDV duyệt/từ chối của chính mình -> 200 và ghi trạng thái; của người khác 200", async () => {
    const h = createHarness();
    addReport(h, "own1", "u-moderator");
    addReport(h, "own2", "u-moderator");
    addReport(h, "other", "u-alice");
    expect((await h.request("/api/admin/reports/own1/approve", { as: "moderator", json: {} })).status).toBe(200);
    expect(row(h, "battle_reports", "own1")).toMatchObject({ status: "approved", reviewed_by: "u-moderator", reviewed_at: h.clock.now });
    expect((await h.request("/api/admin/reports/own2/reject", { as: "moderator", json: { reason: "x" } })).status).toBe(200);
    expect(row(h, "battle_reports", "own2")).toMatchObject({ status: "rejected", reject_reason: "x", reviewed_by: "u-moderator" });
    expect((await h.request("/api/admin/reports/other/approve", { as: "moderator", json: {} })).status).toBe(200);
    expect((await h.request("/api/admin/reports/khong-co/approve", { as: "moderator", json: {} })).status).toBe(404);
  });

  it("chiến báo: root tự duyệt chiến báo của mình -> 200", async () => {
    const h = createHarness();
    addReport(h, "mine", "u-admin");
    const res = await h.request("/api/admin/reports/mine/approve", { as: "admin", json: {} });
    expect(res.status).toBe(200);
    expect(row(h, "battle_reports", "mine")).toMatchObject({ status: "approved", reviewed_by: "u-admin" });
  });

  it("mẫu soi đội: KDV tự duyệt/từ chối mẫu của mình -> 200, ghi trạng thái, từ chối xoá ảnh", async () => {
    const h = createHarness();
    await addSample(h, "own", "u-moderator");
    await addSample(h, "own2", "u-moderator");
    expect((await h.request("/api/admin/scan-samples/own/approve", { as: "moderator", json: {} })).status).toBe(200);
    expect(row(h, "scan_samples", "own")).toMatchObject({ status: "approved", reviewed_by: "u-moderator", image_key: "scan-samples/own.png" });
    expect((await h.request("/api/admin/scan-samples/own2/reject", { as: "moderator", json: {} })).status).toBe(200);
    expect(row(h, "scan_samples", "own2")).toMatchObject({ status: "rejected", reviewed_by: "u-moderator", image_key: null });
    expect(h.objects.has("scan-samples/own2.png")).toBe(false);
  });

  it("mẫu soi đội: KDV tự duyệt mẫu không còn ảnh -> 409 image_missing", async () => {
    const h = createHarness();
    await addSample(h, "noimg", "u-moderator", false);
    const res = await h.request("/api/admin/scan-samples/noimg/approve", { as: "moderator", json: {} });
    expect(res.status).toBe(409);
    expect((await res.json<ApiJson>()).error.code).toBe("image_missing");
  });

  it("mẫu soi đội: KDV duyệt/từ chối mẫu người khác 200 và ghi trạng thái; root tự duyệt mẫu của mình 200", async () => {
    const h = createHarness();
    await addSample(h, "a", "u-alice");
    await addSample(h, "b", "u-alice");
    await addSample(h, "mine", "u-admin");
    expect((await h.request("/api/admin/scan-samples/a/approve", { as: "moderator", json: {} })).status).toBe(200);
    expect(row(h, "scan_samples", "a")).toMatchObject({ status: "approved", reviewed_by: "u-moderator", reviewed_at: h.clock.now, image_key: "scan-samples/a.png" });
    expect(h.objects.has("scan-samples/a.png")).toBe(true);
    expect((await h.request("/api/admin/scan-samples/b/reject", { as: "moderator", json: {} })).status).toBe(200);
    expect(row(h, "scan_samples", "b")).toMatchObject({ status: "rejected", reviewed_by: "u-moderator", reviewed_at: h.clock.now, image_key: null });
    expect(h.objects.has("scan-samples/b.png")).toBe(false);
    expect((await h.request("/api/admin/scan-samples/mine/approve", { as: "admin", json: {} })).status).toBe(200);
    expect(row(h, "scan_samples", "mine")).toMatchObject({ status: "approved", reviewed_by: "u-admin", reviewed_at: h.clock.now });
  });

  it("mẫu soi đội: UPDATE 0 dòng không báo thành công — mẫu bị xoá sau khi đọc -> 404, mất ảnh sau khi đọc -> 409 image_missing", async () => {
    const h = createHarness();
    await addSample(h, "gone", "u-alice");
    await addSample(h, "lost", "u-alice");
    await addSample(h, "gone2", "u-alice");
    const restore = afterFirstRead(h, "where s.id = ?", () => h.sqlite.prepare("delete from scan_samples where id = 'gone'").run());
    const approve = await h.request("/api/admin/scan-samples/gone/approve", { as: "admin", json: {} });
    expect(approve.status).toBe(404);
    restore();
    afterFirstRead(h, "where s.id = ?", () => h.sqlite.prepare("update scan_samples set image_key = null where id = 'lost'").run());
    const lost = await h.request("/api/admin/scan-samples/lost/approve", { as: "moderator", json: {} });
    expect(lost.status).toBe(409);
    expect((await lost.json<ApiJson>()).error.code).toBe("image_missing");
    expect(row(h, "scan_samples", "lost")).toMatchObject({ status: "pending" });
    // Reject: mẫu biến mất giữa lúc đọc và ghi -> 404, không trả "rejected".
    afterFirstRead(h, "where s.id = ?", () => h.sqlite.prepare("delete from scan_samples where id = 'gone2'").run());
    expect((await h.request("/api/admin/scan-samples/gone2/reject", { as: "admin", json: {} })).status).toBe(404);
  });
});

describe("email góp ý: server che cho KDV", () => {
  it("KDV nhận email che + emailMasked:true; root nhận đầy đủ, không có emailMasked; email null giữ null", async () => {
    const h = createHarness();
    h.sqlite.prepare("insert into feedback (id, kind, title, body, email, lang, status, created_at) values ('f-mail', 'bug', 't', 'b', 'player@example.com', 'vi', 'new', 2)").run();
    h.sqlite.prepare("insert into feedback (id, kind, title, body, lang, status, created_at) values ('f-none', 'bug', 't', 'b', 'vi', 'new', 1)").run();
    const get = async (as: string) => Object.fromEntries((await (await h.request("/api/admin/feedback", { as })).json<ApiJson>()).items.map((i) => [i.id, i]));

    const asMod = await get("moderator");
    expect(asMod["f-mail"]).toMatchObject({ email: "pl***@example.com", emailMasked: true });
    expect(asMod["f-none"]).toMatchObject({ email: null, emailMasked: true });
    expect(JSON.stringify(asMod)).not.toContain("player@example.com");

    const asRoot = await get("admin");
    expect(asRoot["f-mail"]).toMatchObject({ email: "player@example.com" });
    expect(asRoot["f-mail"]).not.toHaveProperty("emailMasked");
    expect(asRoot["f-none"]).toMatchObject({ email: null });
  });
});
