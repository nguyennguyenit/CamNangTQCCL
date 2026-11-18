import type { APIRoute } from "astro";
import { postsForLocale } from "../../lib/blog-posts.ts";
import { RSS_MIME, rssDocument } from "../../lib/blog-seo.ts";

export const prerender = true;

/** RSS bài viết tiếng Nhật. */
export const GET: APIRoute = async ({ site }) =>
  new Response(rssDocument("ja", await postsForLocale("ja"), site!), { headers: { "Content-Type": RSS_MIME } });
