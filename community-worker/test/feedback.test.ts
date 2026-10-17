import { describe, expect, it } from "vitest";
import { createHarness, ORIGIN, type ApiJson, type Harness } from "./fakes";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function feedback(overrides: Record<string, unknown> = {}) {
  return {
    kind: "bug",
    title: "Bảng tướng không lọc được",
    body: "Bấm lọc Ngụy thì danh sách trống.",
    email: "player@example.com",
    page: "/tra-cuu/",
    lang: "vi",
    turnstileToken: "ts-token",
    ...overrides,
  };
}

/** siteverify giả: token "ts-token" hợp lệ cho hostname site; token khác thất bại. */
function acceptTurnstile(h: Harness, hostname = new URL(ORIGIN).hostname) {
  h.setFetch(async (url, init) => {
    if (url !== SITEVERIFY) return new Response("unexpected", { status: 500 });
    const token = (init?.body as FormData).get("response");
    return Response.json(token === "ts-token" ? { success: true, hostname } : { success: false, "error-codes": ["invalid-input-response"] });
  });
}

function send(h: Harness, json: unknown, opts: { as?: "alice" | "bob" | "admin"; ip?: string } = {}) {
  return h.request("/api/feedback", { as: opts.as, json, headers: { "cf-connecting-ip": opts.ip ?? "203.0.113.7" } });
}

const siteverifyCalls = (h: Harness) => h.fetchCalls.filter((c) => c.url === SITEVERIFY).length;
const rows = (h: Harness) => h.sqlite.prepare("select * from feedback order by created_at, id").all() as Record<string, unknown>[];

describe("POST /api/feedback", () => {
  it("khách ẩn danh qua Turnstile: lưu D1 trạng thái new và gửi thư có Reply-To", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    const res = await send(h, feedback({ title: "  Bảng tướng không lọc được  " }));
    expect(res.status).toBe(201);
    expect(await res.json<ApiJson>()).toEqual({ ok: true });

    expect(rows(h)).toEqual([
      expect.objectContaining({
        kind: "bug",
        title: "Bảng tướng không lọc được",
        body: "Bấm lọc Ngụy thì danh sách trống.",
        email: "player@example.com",
        page: "/tra-cuu/",
        lang: "vi",
        user_id: null,
        status: "new",
      }),
    ]);
    const verify = h.fetchCalls.find((c) => c.url === SITEVERIFY)!;
    expect((verify.init?.body as FormData).get("secret")).toBe("ts-secret");
    expect((verify.init?.body as FormData).get("remoteip")).toBe("203.0.113.7");

    await h.settle();
    expect(h.mails).toHaveLength(1);
    const mail = h.mails[0];
    expect(mail).toMatchObject({
      to: "owner@example.com",
      from: { email: "gopy@tqccl.com", name: "TQCCL Góp ý" },
      replyTo: "player@example.com",
      subject: "[TQCCL][Báo cáo lỗi] Bảng tướng không lọc được",
    });
    expect(mail.text).toContain("Bấm lọc Ngụy thì danh sách trống.");
    expect(mail.text).toContain("https://tqccl.com/tra-cuu/");
    expect(mail.text).toContain("Ẩn danh");
    expect(mail.html).toBeUndefined();
  });

  it("không để email: thư không có Reply-To", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    expect((await send(h, feedback({ email: "", kind: "other" }))).status).toBe(201);
    await h.settle();
    expect(h.mails[0].replyTo).toBeUndefined();
    expect(h.mails[0].subject).toBe("[TQCCL][Khác] Bảng tướng không lọc được");
    expect(rows(h)[0].email).toBeNull();
  });

  it("khách ẩn danh thiếu token -> 403 và không gọi siteverify; token sai hoặc sai hostname -> 403; không lưu gì", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    const missing = await send(h, feedback({ turnstileToken: undefined }));
    expect(missing.status).toBe(403);
    expect((await missing.json<ApiJson>()).error.code).toBe("turnstile_required");
    expect(siteverifyCalls(h)).toBe(0);

    const wrong = await send(h, feedback({ turnstileToken: "forged" }));
    expect(wrong.status).toBe(403);
    expect((await wrong.json<ApiJson>()).error.code).toBe("turnstile_failed");

    acceptTurnstile(h, "evil.example");
    expect((await send(h, feedback())).status).toBe(403);
    expect(rows(h)).toEqual([]);
    await h.settle();
    expect(h.mails).toEqual([]);
  });

  it("siteverify không phản hồi -> 403, không lưu", async () => {
    const h = createHarness();
    h.setFetch(() => {
      throw new Error("network down");
    });
    expect((await send(h, feedback())).status).toBe(403);
    expect(rows(h)).toEqual([]);
  });

  it("dữ liệu sai -> 400 với mã theo trường", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    const cases: [Record<string, unknown>, string][] = [
      [{ kind: "spam" }, "invalid_kind"],
      [{ title: "" }, "invalid_title"],
      [{ title: "x".repeat(121) }, "invalid_title"],
      [{ body: "   " }, "invalid_body"],
      [{ body: "x".repeat(4001) }, "invalid_body"],
      [{ email: "không-phải-email" }, "invalid_email"],
      [{ page: "https://evil.example/" }, "invalid_page"],
      [{ page: "//evil.example/" }, "invalid_page"],
      [{ lang: "en" }, "invalid_lang"],
    ];
    for (const [override, code] of cases) {
      const res = await send(h, feedback(override));
      expect(res.status, code).toBe(400);
      expect((await res.json<ApiJson>()).error.code).toBe(code);
    }
    expect(rows(h)).toEqual([]);
    expect(siteverifyCalls(h)).toBe(0);
  });

  it("biên độ dài: tiêu đề 120 và nội dung 4000 ký tự được nhận", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    expect((await send(h, feedback({ title: "Đ".repeat(120), body: "阵".repeat(4000) }))).status).toBe(201);
  });

  it("khách ẩn danh: 5 lượt/giờ/IP, lượt 6 bị 429; IP khác và giờ sau vẫn gửi được", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    h.clock.now = Date.UTC(2026, 8, 27, 10, 0, 0);
    for (let i = 0; i < 5; i++) expect((await send(h, feedback())).status).toBe(201);
    const blocked = await send(h, feedback());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("3600");
    // Bị chặn trước khi tốn một lượt siteverify.
    expect(siteverifyCalls(h)).toBe(5);
    expect((await send(h, feedback(), { ip: "198.51.100.1" })).status).toBe(201);
    h.clock.now = Date.UTC(2026, 8, 27, 11, 0, 0);
    expect((await send(h, feedback())).status).toBe(201);
  });

  it("IPv6 cùng dải /64 dùng chung một bộ đếm", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    for (let i = 0; i < 5; i++) expect((await send(h, feedback(), { ip: `2001:db8:1:2::${i + 1}` })).status).toBe(201);
    expect((await send(h, feedback(), { ip: "2001:db8:1:2:abcd::9" })).status).toBe(429);
    expect((await send(h, feedback(), { ip: "2001:db8:1:3::1" })).status).toBe(201);
  });

  it("đã đăng nhập: không cần Turnstile, lưu user_id, 10 lượt/giờ", async () => {
    const h = createHarness();
    h.clock.now = Date.UTC(2026, 8, 27, 10, 0, 0);
    for (let i = 0; i < 10; i++) {
      expect((await send(h, feedback({ turnstileToken: undefined }), { as: "alice" })).status).toBe(201);
    }
    expect((await send(h, feedback({ turnstileToken: undefined }), { as: "alice" })).status).toBe(429);
    expect(siteverifyCalls(h)).toBe(0);
    expect(rows(h)[0].user_id).toBe("u-alice");
    await h.settle();
    expect(h.mails[0].text).toContain("Alice");
    expect(h.mails[0].text).toContain("alice@example.com");
  });

  it("gửi thư lỗi: vẫn 201 và góp ý đã lưu", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    h.mailError = Object.assign(new Error("daily limit"), { code: "E_DAILY_LIMIT_EXCEEDED" });
    expect((await send(h, feedback())).status).toBe(201);
    await h.settle();
    expect(rows(h)).toHaveLength(1);
    expect(h.mails).toEqual([]);
  });

  it("thiếu binding thư: vẫn 201 và lưu", async () => {
    const h = createHarness({ FEEDBACK_MAIL: undefined });
    acceptTurnstile(h);
    expect((await send(h, feedback())).status).toBe(201);
    await h.settle();
    expect(rows(h)).toHaveLength(1);
  });

  it("thiếu TURNSTILE_SECRET hoặc IP_HASH_SECRET: khách ẩn danh 503, người đã đăng nhập vẫn gửi được", async () => {
    for (const missing of ["TURNSTILE_SECRET", "IP_HASH_SECRET"] as const) {
      const h = createHarness({ [missing]: undefined });
      acceptTurnstile(h);
      const res = await send(h, feedback());
      expect(res.status, missing).toBe(503);
      expect((await res.json<ApiJson>()).error.code).toBe("feedback_unavailable");
      expect((await send(h, feedback(), { as: "bob" })).status).toBe(201);
    }
  });

  it("origin lạ bị chặn CSRF", async () => {
    const h = createHarness();
    acceptTurnstile(h);
    const res = await h.request("/api/feedback", { json: feedback(), headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
    expect(rows(h)).toEqual([]);
  });
});

describe("admin feedback", () => {
  async function seed(h: Harness) {
    acceptTurnstile(h);
    await send(h, feedback({ kind: "bug", title: "Lỗi A" }));
    h.clock.now += 1000;
    await send(h, feedback({ kind: "wrong_info", title: "Sai B", page: "/zh/doi-chuan/", lang: "zh" }), { as: "bob" });
    h.clock.now += 1000;
    await send(h, feedback({ kind: "feature", title: "Ý C", email: "" }));
  }

  it("chỉ admin xem được; khách 401, người thường 403", async () => {
    const h = createHarness();
    expect((await h.request("/api/admin/feedback")).status).toBe(401);
    expect((await h.request("/api/admin/feedback", { as: "bob" })).status).toBe(403);
    expect((await h.request("/api/admin/feedback/id-0001/status", { as: "bob", json: { status: "done" } })).status).toBe(403);
  });

  it("liệt kê mới nhất trước, lọc theo trạng thái và loại", async () => {
    const h = createHarness();
    await seed(h);
    const all = await (await h.request("/api/admin/feedback", { as: "admin" })).json<ApiJson>();
    expect(all.items.map((i) => i.title)).toEqual(["Ý C", "Sai B", "Lỗi A"]);
    expect(all.items[1]).toMatchObject({
      kind: "wrong_info",
      page: "/zh/doi-chuan/",
      lang: "zh",
      status: "new",
      email: "player@example.com",
      author: { id: "u-bob", name: "Bob" },
    });
    expect(all.items[0]).toMatchObject({ email: null, author: null });
    expect(all.items[1]).not.toHaveProperty("emailMasked");
    expect(all.nextCursor).toBeNull();

    const bugs = await (await h.request("/api/admin/feedback?kind=bug", { as: "admin" })).json<ApiJson>();
    expect(bugs.items.map((i) => i.title)).toEqual(["Lỗi A"]);
    expect((await h.request("/api/admin/feedback?kind=spam", { as: "admin" })).status).toBe(400);
    expect((await h.request("/api/admin/feedback?status=archived", { as: "admin" })).status).toBe(400);
  });

  it("đổi trạng thái new ⇄ done; lọc theo trạng thái phản ánh thay đổi; id lạ 404, trạng thái lạ 400", async () => {
    const h = createHarness();
    await seed(h);
    const first = (await (await h.request("/api/admin/feedback", { as: "admin" })).json<ApiJson>()).items[0];
    const done = await h.request(`/api/admin/feedback/${first.id}/status`, { as: "admin", json: { status: "done" } });
    expect(done.status).toBe(200);
    expect(await done.json<ApiJson>()).toMatchObject({ id: first.id, status: "done" });

    const pending = await (await h.request("/api/admin/feedback?status=new", { as: "admin" })).json<ApiJson>();
    expect(pending.items.map((i) => i.title)).toEqual(["Sai B", "Lỗi A"]);
    const handled = await (await h.request("/api/admin/feedback?status=done", { as: "admin" })).json<ApiJson>();
    expect(handled.items.map((i) => i.title)).toEqual(["Ý C"]);

    expect((await h.request(`/api/admin/feedback/${first.id}/status`, { as: "admin", json: { status: "new" } })).status).toBe(200);
    expect((await (await h.request("/api/admin/feedback?status=done", { as: "admin" })).json<ApiJson>()).items).toEqual([]);

    expect((await h.request("/api/admin/feedback/nope/status", { as: "admin", json: { status: "done" } })).status).toBe(404);
    expect((await h.request(`/api/admin/feedback/${first.id}/status`, { as: "admin", json: { status: "archived" } })).status).toBe(400);
  });

  it("phân trang 20/trang bằng con trỏ", async () => {
    const h = createHarness();
    for (let i = 0; i < 25; i++) {
      expect((await send(h, feedback({ title: `G${i}`, turnstileToken: undefined }), { as: "alice" })).status).toBe(201);
      h.clock.now += 600_000; // 6 lượt/giờ, dưới giới hạn 10/giờ của người đăng nhập
    }
    const first = await (await h.request("/api/admin/feedback", { as: "admin" })).json<ApiJson>();
    expect(first.items).toHaveLength(20);
    const second = await (await h.request(`/api/admin/feedback?cursor=${first.nextCursor}`, { as: "admin" })).json<ApiJson>();
    expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map((i) => i.title)).size).toBe(25);
  });
});
