import type { APIRoute } from "astro";
import { loadBlogPosts } from "../lib/blog-posts.ts";
import { llmsDocument } from "../lib/blog-seo.ts";

export const prerender = true;

/** Tổng quan site cho trình thu thập AI (chuẩn llms.txt): mục chính và toàn bộ bài viết. */
export const GET: APIRoute = async ({ site }) =>
  new Response(llmsDocument(await loadBlogPosts(), site!), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
