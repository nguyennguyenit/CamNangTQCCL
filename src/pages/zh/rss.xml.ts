import type { APIRoute } from "astro";
import { postsForLocale } from "../../lib/blog-posts.ts";
import { RSS_MIME, rssDocument } from "../../lib/blog-seo.ts";

export const prerender = true;

/** RSS bài viết tiếng Trung. */
export const GET: APIRoute = async ({ site }) =>
  new Response(rssDocument("zh", await postsForLocale("zh"), site!), { headers: { "Content-Type": RSS_MIME } });
