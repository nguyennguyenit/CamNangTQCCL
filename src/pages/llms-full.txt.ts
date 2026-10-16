import type { APIRoute } from "astro";
import { llmsDocuments } from "../lib/llms-documents.ts";

export const prerender = true;

/** Mọi file llms con nối theo thứ tự cố định (một nguồn với `/llms/**`). */
export const GET: APIRoute = async ({ site }) =>
  new Response((await llmsDocuments(site!)).full, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
