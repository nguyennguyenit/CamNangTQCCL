// Bài viết blog: API công khai cho build tĩnh + CRUD/xuất bản của admin, upload và phục vụ media R2.

import { Hono } from "hono";
import { auditIfStmt, settleDeploy, writeAuditQuietly } from "../audit";
import { requireRoot, type AppEnv, type Ctx } from "../context";
import type { Env } from "../env";
import { ApiError, iso } from "../http";
import { consumeRateLimit } from "../ratelimit";
import { parseImageUpload, parseLang, parseOptionalText, parseSlug, parseText, readJson, SLUG_RE, type Lang } from "../validate";

export const POST_IMAGE_MAX_BYTES = 5_000_000;
const MEDIA_KEY_RE = /^posts\/[a-z0-9-]{1,64}\.(jpg|png|webp)$/u;

interface PostRow {
  id: string;
  slug: string;
  lang: Lang;
  translation_key: string | null;
  title: string;
  description: string;
  body_markdown: string;
  faq: string;
  tags: string;
  cover_image: string | null;
  status: "draft" | "published";
  author_name: string;
  published_at: number | null;
  updated_at: number;
  created_at: number;
}

export interface Post {
  id: string;
  slug: string;
  lang: Lang;
  translationKey: string | null;
  title: string;
  description: string;
  bodyMarkdown: string;
  faq: { q: string; a: string }[];
  tags: string[];
  coverImage: string | null;
  status: "draft" | "published";
  author: { name: string };
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export function toPost(row: PostRow): Post {
  return {
    id: row.id,
    slug: row.slug,
    lang: row.lang,
    translationKey: row.translation_key,
    title: row.title,
    description: row.description,
    bodyMarkdown: row.body_markdown,
    faq: JSON.parse(row.faq) as Post["faq"],
    tags: JSON.parse(row.tags) as string[],
    coverImage: row.cover_image,
    status: row.status,
    author: { name: row.author_name },
    publishedAt: iso(row.published_at),
    updatedAt: iso(row.updated_at) as string,
    createdAt: iso(row.created_at) as string,
  };
}

// ---- Validate nội dung bài ----

type PostFields = Pick<
  Post,
  "slug" | "lang" | "translationKey" | "title" | "description" | "bodyMarkdown" | "faq" | "tags" | "coverImage"
>;

function parseFaq(value: unknown): Post["faq"] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 30) throw new ApiError(400, "invalid_faq", "faq tối đa 30 mục");
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new ApiError(400, "invalid_faq", "Mục faq phải có q và a");
    const { q, a } = item as Record<string, unknown>;
    return { q: parseText(q, "faq", 1, 300), a: parseText(a, "faq", 1, 3000) };
  });
}

function parseTags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new ApiError(400, "invalid_tags", "tags tối đa 20 mục");
  return [...new Set(value.map((t) => parseText(t, "tags", 1, 40)))];
}

function parseCoverImage(value: unknown): string | null {
  const url = parseOptionalText(value, "coverImage", 500);
  if (url === null) return null;
  const local = url.startsWith("/api/media/") && MEDIA_KEY_RE.test(url.slice("/api/media/".length));
  if (!local && !/^https:\/\/[^\s"'<>]+$/u.test(url)) {
    throw new ApiError(400, "invalid_coverImage", "coverImage phải là /api/media/… hoặc URL https");
  }
  return url;
}

function parseTranslationKey(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !SLUG_RE.test(value)) {
    throw new ApiError(400, "invalid_translationKey", "translationKey không hợp lệ");
  }
  return value;
}

/** Validate đủ trường bài; dùng cho cả tạo mới và cập nhật (sau khi gộp với bản cũ). */
export function parsePostFields(input: Record<string, unknown>): PostFields {
  return {
    slug: parseSlug(input.slug),
    lang: parseLang(input.lang),
    translationKey: parseTranslationKey(input.translationKey),
    title: parseText(input.title, "title", 1, 200),
    description: parseText(input.description, "description", 1, 500),
    bodyMarkdown: parseText(input.bodyMarkdown, "bodyMarkdown", 1, 100_000),
    faq: parseFaq(input.faq),
    tags: parseTags(input.tags),
    coverImage: parseCoverImage(input.coverImage),
  };
}

// ---- Kích hoạt build lại site ----

export interface DeployResult {
  ok: boolean;
  status: number | null;
  error?: string;
}

// Pages `tqccl` là project direct upload (không có Deploy hook): gửi repository_dispatch để
// workflow .github/workflows/pages-deploy.yml build + deploy lại site từ main.
export const DEPLOY_EVENT_TYPE = "blog-publish";

/** Gọi GitHub repository_dispatch; lỗi chỉ báo trong response, không rollback DB. */
export async function triggerDeploy(env: Env, fetchImpl: typeof fetch): Promise<DeployResult> {
  const repo = env.GITHUB_REPOSITORY?.trim();
  if (!env.GITHUB_DISPATCH_TOKEN || !repo || !/^[\w.-]+\/[\w.-]+$/u.test(repo)) {
    return { ok: false, status: null, error: "deploy_hook_not_configured" };
  }
  try {
    const resp = await fetchImpl(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "tqccl-community-worker",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: DEPLOY_EVENT_TYPE }),
    });
    return resp.ok ? { ok: true, status: resp.status } : { ok: false, status: resp.status, error: "deploy_hook_failed" };
  } catch {
    return { ok: false, status: null, error: "deploy_hook_unreachable" };
  }
}

// ---- Truy vấn ----

async function findPost(env: Env, id: string): Promise<PostRow> {
  const row = await env.DB.prepare("select * from posts where id = ?").bind(id).first<PostRow>();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy bài viết");
  return row;
}

/** Chạy batch ghi (câu ghi + dòng nhật ký); vi phạm unique (lang, slug)/(lang, translation_key) -> 409. */
async function writePost(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  try {
    await db.batch(stmts);
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    if (/UNIQUE/iu.test(message)) {
      if (/translation_key/iu.test(message)) {
        throw new ApiError(409, "translation_key_taken", "translationKey đã dùng cho bài khác cùng ngôn ngữ");
      }
      throw new ApiError(409, "slug_taken", "Slug đã tồn tại trong ngôn ngữ này");
    }
    throw e;
  }
}

/** Thao tác có kích hoạt deploy: dòng nhật ký vào D1 cùng batch với `meta.deploy = 'pending'`, rồi cập nhật đúng dòng đó. */
function deployMeta(meta: Record<string, unknown>, dispatch: boolean): Record<string, unknown> {
  return dispatch ? { ...meta, deploy: "pending" } : meta;
}

async function settle(c: Ctx, auditId: string, meta: Record<string, unknown>, deploy: DeployResult): Promise<void> {
  try {
    await settleDeploy(c, auditId, meta, deploy);
  } catch (error) {
    // Bài và deploy đã xong: không đổi phản hồi thành lỗi; dòng giữ `deploy: pending` (kết quả chưa rõ).
    console.error("admin_audit deploy settle failed", auditId, error);
  }
}

export const posts = new Hono<AppEnv>();

posts.get("/api/posts", async (c) => {
  const { results } = await c.env.DB.prepare(
    "select * from posts where status = 'published' order by published_at desc, id desc",
  ).all<PostRow>();
  return c.json({ items: results.map(toPost) });
});

posts.get("/api/posts/:lang/:slug", async (c) => {
  const lang = parseLang(c.req.param("lang"));
  const slug = parseSlug(c.req.param("slug"));
  const row = await c.env.DB.prepare("select * from posts where lang = ? and slug = ? and status = 'published'")
    .bind(lang, slug)
    .first<PostRow>();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy bài viết");
  return c.json(toPost(row));
});

posts.get("/api/admin/posts", async (c) => {
  await requireRoot(c);
  const { results } = await c.env.DB.prepare("select * from posts order by updated_at desc, id desc").all<PostRow>();
  return c.json({ items: results.map(toPost) });
});

posts.post("/api/admin/posts", async (c) => {
  const viewer = await requireRoot(c);
  const { user } = viewer;
  const f = parsePostFields(await readJson(c.req.raw));
  const { now, newId } = c.get("deps");
  const id = newId();
  const at = now();
  await writePost(c.env.DB, [
    c.env.DB.prepare(
      "insert into posts (id, slug, lang, translation_key, title, description, body_markdown, faq, tags, cover_image, status, author_id, author_name, published_at, updated_at, created_at) " +
        "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, null, ?, ?)",
    ).bind(
      id, f.slug, f.lang, f.translationKey, f.title, f.description, f.bodyMarkdown,
      JSON.stringify(f.faq), JSON.stringify(f.tags), f.coverImage, user.id, user.name, at, at,
    ),
    auditIfStmt(
      c,
      viewer,
      { action: "post.create", targetType: "post", targetId: id, targetLabel: f.title, meta: { slug: f.slug, lang: f.lang }, status: "ok" },
      "select 1 from posts where id = ? and author_id = ? and created_at = ?",
      [id, user.id, at],
    ),
  ]);
  return c.json(toPost(await findPost(c.env, id)), 201);
});

posts.put("/api/admin/posts/:id", async (c) => {
  const viewer = await requireRoot(c);
  const id = c.req.param("id");
  const currentRow = await findPost(c.env, id);
  const current = toPost(currentRow);
  const input = await readJson(c.req.raw);
  // Cập nhật từng phần: trường không gửi giữ giá trị cũ.
  const f = parsePostFields({ ...current, ...input });
  const { now, newId } = c.get("deps");
  const at = now();
  // Bài đang public đổi nội dung -> build lại để HTML tĩnh cập nhật.
  const dispatch = currentRow.status === "published";
  const auditId = newId();
  const meta = { slug: f.slug, lang: f.lang };
  await writePost(c.env.DB, [
    c.env.DB.prepare(
      "update posts set slug = ?, lang = ?, translation_key = ?, title = ?, description = ?, body_markdown = ?, faq = ?, tags = ?, cover_image = ?, updated_at = ? where id = ?",
    ).bind(
      f.slug, f.lang, f.translationKey, f.title, f.description, f.bodyMarkdown,
      JSON.stringify(f.faq), JSON.stringify(f.tags), f.coverImage, at, id,
    ),
    auditIfStmt(
      c,
      viewer,
      { id: auditId, action: "post.update", targetType: "post", targetId: id, targetLabel: f.title, meta: deployMeta(meta, dispatch), status: "ok" },
      "select 1 from posts where id = ? and updated_at = ? and slug = ? and lang = ?",
      [id, at, f.slug, f.lang],
    ),
  ]);
  const post = toPost(await findPost(c.env, id));
  const deploy = dispatch ? await triggerDeploy(c.env, c.get("deps").fetchImpl) : null;
  if (deploy) await settle(c, auditId, meta, deploy);
  return c.json({ post, deploy });
});

posts.delete("/api/admin/posts/:id", async (c) => {
  const viewer = await requireRoot(c);
  const row = await findPost(c.env, c.req.param("id"));
  const dispatch = row.status === "published";
  const auditId = c.get("deps").newId();
  const meta = { slug: row.slug, lang: row.lang, status: row.status };
  // Nhật ký đặt TRƯỚC DELETE trong cùng batch (sau DELETE không còn gì chứng minh yêu cầu này đã xoá); điều kiện
  // đủ quyền của DELETE chỉ là bài còn tồn tại. Lỗi ghi nhật ký -> rollback cả batch.
  await c.env.DB.batch([
    auditIfStmt(
      c,
      viewer,
      { id: auditId, action: "post.delete", targetType: "post", targetId: row.id, targetLabel: row.title, meta: deployMeta(meta, dispatch), status: "ok" },
      "select 1 from posts where id = ?",
      [row.id],
    ),
    c.env.DB.prepare("delete from posts where id = ?").bind(row.id),
  ]);
  const deploy = dispatch ? await triggerDeploy(c.env, c.get("deps").fetchImpl) : null;
  if (deploy) await settle(c, auditId, meta, deploy);
  return c.json({ ok: true, deploy });
});

async function setPublished(c: Ctx, published: boolean) {
  const viewer = await requireRoot(c);
  const row = await findPost(c.env, c.req.param("id") ?? "");
  const { now, newId } = c.get("deps");
  const at = now();
  const status = published ? "published" : "draft";
  // Giữ publishedAt gốc khi xuất bản lại; gỡ xuất bản thì xoá mốc.
  const publishedAt = published ? (row.published_at ?? at) : null;
  const auditId = newId();
  const meta = { slug: row.slug, lang: row.lang };
  await c.env.DB.batch([
    c.env.DB.prepare("update posts set status = ?, published_at = ?, updated_at = ? where id = ?").bind(status, publishedAt, at, row.id),
    auditIfStmt(
      c,
      viewer,
      { id: auditId, action: published ? "post.publish" : "post.unpublish", targetType: "post", targetId: row.id, targetLabel: row.title, meta: deployMeta(meta, true), status: "ok" },
      "select 1 from posts where id = ? and status = ? and updated_at = ?",
      [row.id, status, at],
    ),
  ]);
  const post = toPost(await findPost(c.env, row.id));
  const deploy = await triggerDeploy(c.env, c.get("deps").fetchImpl);
  await settle(c, auditId, meta, deploy);
  return c.json({ post, deploy });
}

posts.post("/api/admin/posts/:id/publish", (c) => setPublished(c, true));
posts.post("/api/admin/posts/:id/unpublish", (c) => setPublished(c, false));

posts.post("/api/admin/uploads", async (c) => {
  const viewer = await requireRoot(c);
  const { user } = viewer;
  const image = await parseImageUpload(c.req.raw, "image", POST_IMAGE_MAX_BYTES);
  const { now, newId } = c.get("deps");
  const at = now();
  await consumeRateLimit(c.env.DB, "upload", user.id, at);
  const id = newId();
  const key = `posts/${id}.${image.ext}`;
  const entry = { action: "post.upload", targetType: "upload", targetId: id, targetLabel: key };
  try {
    await c.env.MEDIA.put(key, image.bytes, { httpMetadata: { contentType: image.contentType } });
  } catch (e) {
    await writeAuditQuietly(c, viewer, { ...entry, status: "failed", meta: { step: "r2" } });
    throw e;
  }
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, 'post', ?, ?, ?, 'attached', ?)",
      ).bind(id, user.id, key, image.contentType, image.bytes.length, at),
      auditIfStmt(
        c,
        viewer,
        { ...entry, status: "ok" },
        "select 1 from uploads where id = ? and user_id = ? and kind = 'post' and object_key = ?",
        [id, user.id, key],
      ),
    ]);
  } catch (e) {
    // Không để ảnh mồ côi trong R2 khi D1 lỗi; xoá bù lỗi -> partial (ảnh mồ côi còn lại).
    let cleaned = true;
    try {
      await c.env.MEDIA.delete(key);
    } catch {
      cleaned = false;
    }
    await writeAuditQuietly(c, viewer, { ...entry, status: cleaned ? "failed" : "partial", meta: { step: "d1", ...(cleaned ? {} : { orphan: key }) } });
    throw e;
  }
  return c.json({ url: `/api/media/${key}` }, 201);
});

// Media bài viết công khai; khoá chứa id ngẫu nhiên nên cache vĩnh viễn.
posts.get("/api/media/*", async (c) => {
  const key = decodeURIComponent(c.req.path.slice("/api/media/".length));
  if (!MEDIA_KEY_RE.test(key)) throw new ApiError(404, "not_found", "Không tìm thấy tệp");
  const object = await c.env.MEDIA.get(key);
  if (!object) throw new ApiError(404, "not_found", "Không tìm thấy tệp");
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ETag: object.httpEtag,
    },
  });
});
