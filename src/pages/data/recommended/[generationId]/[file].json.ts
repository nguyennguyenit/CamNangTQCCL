import type { APIRoute, GetStaticPaths } from 'astro';
import { readRecommendedArtifact, recommendedStaticPaths } from '../../../../lib/recommended-reference-artifacts';

export const prerender = true;
export const getStaticPaths: GetStaticPaths = () => recommendedStaticPaths();

export const GET: APIRoute = async ({params}) => {
  const artifact = await readRecommendedArtifact(params.generationId,params.file);
  return new Response(new Uint8Array(artifact.bytes),{headers:{'Content-Type':artifact.mimeType}});
};
