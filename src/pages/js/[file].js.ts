import type { APIRoute, GetStaticPaths } from "astro";
import { readPublicArtifact, staticPathsFor } from "../../lib/root-static-artifacts";

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () => staticPathsFor("js");

export const GET: APIRoute = async ({ params }) => {
  const artifact = await readPublicArtifact({ kind: "js", routeParam: params.file });
  return new Response(new Uint8Array(artifact.bytes), {
    headers: { "Content-Type": artifact.mimeType },
  });
};
