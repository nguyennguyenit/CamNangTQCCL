import { describe, expect, it } from "vitest";
import { createHarness, imageForm, PNG_BYTES, type ApiJson, type Harness } from "./fakes";

const BASE = {
  slug: "huong-dan-s18",
  lang: "vi",
  title: "Hướng dẫn S18",
  description: "Tóm tắt",
  bodyMarkdown: "# Nội dung",
  faq: [{ q: "Hỏi?", a: "Đáp." }],
  tags: ["s18", "s18", "meta"],
};

async function createPost(h: Harness, fields: Record<string, unknown> = {}) {
  return h.request("/api/admin/posts", { as: "admin", json: { ...BASE, ...fields } });
}

describe("posts", () => {
  it("tạo nháp chỉ admin; slug duy nhất theo (lang, slug); translationKey duy nhất theo lang", async () => {
    const h = createHarness();
    expect((await h.request("/api/admin/posts", { as: "alice", json: BASE })).status).toBe(403);
    const res = await createPost(h, { translationKey: "s18" });
    expect(res.status).toBe(201);
    expect(await res.json<ApiJson>()).toMatchObject({
      slug: "huong-dan-s18",
      status: "draft",
      tags: ["s18", "meta"],
      translationKey: "s18",
      author: { name: "Admin" },
      publishedAt: null,
      createdAt: "2026-09-27T10:00:00.000Z",
    });
    const dup = await createPost(h);
    expect(dup.status).toBe(409);
    expect((await dup.json<ApiJson>()).error.code).toBe("slug_taken");
    expect((await createPost(h, { lang: "zh", translationKey: "s18" })).status).toBe(201);
    const dupKey = await createPost(h, { slug: "khac", translationKey: "s18" });
    expect((await dupKey.json<ApiJson>()).error.code).toBe("translation_key_taken");
    expect((await createPost(h, { slug: "Bad Slug" })).status).toBe(400);
    expect((await createPost(h, { slug: "x", coverImage: "javascript:alert(1)" })).status).toBe(400);
  });

  it("publish gửi repository_dispatch, bài hiện ở API công khai; unpublish gỡ và gửi lần nữa", async () => {
    const h = createHarness();
    const post = await (await createPost(h)).json<ApiJson>();
    expect((await (await h.request("/api/posts")).json<ApiJson>()).items).toEqual([]);

    const pub = await (await h.request(`/api/admin/posts/${post.id}/publish`, { as: "admin", method: "POST" })).json<ApiJson>();
    expect(pub.post).toMatchObject({ status: "published", publishedAt: "2026-09-27T10:00:00.000Z" });
    expect(pub.deploy).toEqual({ ok: true, status: 200 });
    expect(h.fetchCalls).toHaveLength(1);
    const [{ url, init }] = h.fetchCalls;
    expect(url).toBe("https://api.github.com/repos/owner/repo/dispatches");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer gh-test-token");
    expect(JSON.parse(String(init?.body))).toEqual({ event_type: "blog-publish" });

    const list = await (await h.request("/api/posts")).json<ApiJson>();
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ bodyMarkdown: "# Nội dung", faq: [{ q: "Hỏi?", a: "Đáp." }] });
    expect((await h.request("/api/posts/vi/huong-dan-s18")).status).toBe(200);
    expect((await h.request("/api/posts/zh/huong-dan-s18")).status).toBe(404);

    await h.request(`/api/admin/posts/${post.id}/unpublish`, { as: "admin", method: "POST" });
    expect(h.fetchCalls).toHaveLength(2);
    expect((await (await h.request("/api/posts")).json<ApiJson>()).items).toEqual([]);
    expect((await h.request("/api/posts/vi/huong-dan-s18")).status).toBe(404);
  });

  it("deploy hook lỗi vẫn giữ trạng thái DB và báo trong response", async () => {
    const h = createHarness();
    h.setFetch(() => new Response("nope", { status: 500 }));
    const post = await (await createPost(h)).json<ApiJson>();
    const res = await h.request(`/api/admin/posts/${post.id}/publish`, { as: "admin", method: "POST" });
    expect(res.status).toBe(200);
    expect((await res.json<ApiJson>()).deploy).toEqual({ ok: false, status: 500, error: "deploy_hook_failed" });
    expect((await (await h.request("/api/posts")).json<ApiJson>()).items).toHaveLength(1);

    const noHook = createHarness({ GITHUB_DISPATCH_TOKEN: undefined });
    const p2 = await (await createPost(noHook)).json<ApiJson>();
    const r2 = await (await noHook.request(`/api/admin/posts/${p2.id}/publish`, { as: "admin", method: "POST" })).json<ApiJson>();
    expect(r2.deploy).toEqual({ ok: false, status: null, error: "deploy_hook_not_configured" });
  });

  it("PUT cập nhật từng phần; bài published đổi nội dung thì gọi hook, nháp thì không", async () => {
    const h = createHarness();
    const post = await (await createPost(h)).json<ApiJson>();
    const draft = await (await h.request(`/api/admin/posts/${post.id}`, { as: "admin", method: "PUT", json: { title: "Mới" } })).json<ApiJson>();
    expect(draft.post).toMatchObject({ title: "Mới", slug: "huong-dan-s18", bodyMarkdown: "# Nội dung" });
    expect(draft.deploy).toBeNull();
    expect(h.fetchCalls).toHaveLength(0);
    await h.request(`/api/admin/posts/${post.id}/publish`, { as: "admin", method: "POST" });
    await h.request(`/api/admin/posts/${post.id}`, { as: "admin", method: "PUT", json: { description: "Khác" } });
    expect(h.fetchCalls).toHaveLength(2);
    const other = await (await createPost(h, { slug: "bai-khac" })).json<ApiJson>();
    const clash = await h.request(`/api/admin/posts/${other.id}`, { as: "admin", method: "PUT", json: { slug: "huong-dan-s18" } });
    expect(clash.status).toBe(409);
  });

  it("upload ảnh bài viết: insert uploads bị chặn (trigger giờ DB thật) -> lỗi, không còn object R2", async () => {
    const h = createHarness();
    const bannedUntil = Date.now() + 60_000;
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(bannedUntil, "u-admin");
    h.clock.now = bannedUntil + 1;
    const res = await h.request("/api/admin/uploads", { as: "admin", method: "POST", body: imageForm(PNG_BYTES, "image/png") });
    expect(res.status).toBe(500);
    expect(h.objects.size).toBe(0);
    expect({ ...(h.sqlite.prepare("select count(*) n from uploads").get() as object) }).toEqual({ n: 0 });
  });

  it("upload ảnh bài viết -> url /api/media/<key> phục vụ đúng content-type + cache dài", async () => {
    const h = createHarness();
    expect((await h.request("/api/admin/uploads", { as: "alice", method: "POST", body: imageForm(PNG_BYTES, "image/png") })).status).toBe(403);
    const up = await h.request("/api/admin/uploads", { as: "admin", method: "POST", body: imageForm(PNG_BYTES, "image/png") });
    expect(up.status).toBe(201);
    const { url } = await up.json<ApiJson>();
    expect(url).toMatch(/^\/api\/media\/posts\/[a-z0-9-]+\.png$/u);
    const media = await h.request(url);
    expect(media.headers.get("Content-Type")).toBe("image/png");
    expect(media.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    // Không cho đọc ảnh chiến báo/pending qua đường media.
    await h.env.MEDIA.put("pending/x", PNG_BYTES);
    expect((await h.request("/api/media/pending/x")).status).toBe(404);
    expect((await h.request("/api/media/posts/..%2Fpending%2Fx")).status).toBe(404);
  });
});

describe("/api/me", () => {
  it("trả null khi chưa đăng nhập; role: root theo ADMIN_EMAILS không phân biệt hoa thường, moderator/user theo user.role", async () => {
    const h = createHarness();
    expect(await (await h.request("/api/me")).json<ApiJson>()).toEqual({ user: null });
    expect(await (await h.request("/api/me", { as: "admin" })).json<ApiJson>()).toEqual({
      user: { id: "u-admin", name: "Admin", email: "Admin@Example.com", image: null, role: "root" },
    });
    expect((await (await h.request("/api/me", { as: "bob" })).json<ApiJson>()).user.role).toBe("user");
    expect((await (await h.request("/api/me", { as: "moderator" })).json<ApiJson>()).user.role).toBe("moderator");
    expect((await h.request("/api/me")).headers.get("Cache-Control")).toBe("no-store");
  });
});
