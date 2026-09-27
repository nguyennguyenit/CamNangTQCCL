import type { APIRoute } from "astro";
import { postsForLocale } from "../lib/blog-posts.ts";
import { RSS_MIME, rssDocument } from "../lib/blog-seo.ts";

export const prerender = true;

/** RSS bài viết tiếng Việt; không có bài vẫn là feed hợp lệ (kênh rỗng). */
export const GET: APIRoute = async ({ site }) =>
  new Response(rssDocument("vi", await postsForLocale("vi"), site!), { headers: { "Content-Type": RSS_MIME } });
