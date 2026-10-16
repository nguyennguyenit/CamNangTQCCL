import type { APIRoute, GetStaticPaths } from "astro";
import { llmsDocuments } from "../../lib/llms-documents.ts";

export const prerender = true;

const SUFFIX = /^\/llms\/(.+)\.txt$/u;

/** Mỗi file con của `llmsDocuments` một route: `/llms/<path>.txt`. */
export const getStaticPaths = (async () => {
  const { files } = await llmsDocuments(import.meta.env.SITE);
  return files.map((file) => ({ params: { path: file.path.match(SUFFIX)![1] } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ site, params }) => {
  const file = (await llmsDocuments(site!)).files.find((candidate) => candidate.path === `/llms/${params.path}.txt`);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
