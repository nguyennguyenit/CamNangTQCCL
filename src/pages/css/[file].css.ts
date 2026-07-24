import type { APIRoute, GetStaticPaths } from "astro";
import { readPublicArtifact, staticPathsFor } from "../../lib/root-static-artifacts";

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () => staticPathsFor("css");

export const GET: APIRoute = async ({ params }) => {
  const artifact = await readPublicArtifact({ kind: "css", routeParam: params.file });
  return new Response(new Uint8Array(artifact.bytes), {
    headers: { "Content-Type": artifact.mimeType },
  });
};
