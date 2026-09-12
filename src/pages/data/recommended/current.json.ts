import type { APIRoute } from 'astro';
import { recommendedPublicationSnapshot } from '../../../lib/recommended-reference-artifacts';

export const prerender = true;

export const GET: APIRoute = async () => {
  const snapshot = await recommendedPublicationSnapshot();
  return new Response(new Uint8Array(snapshot.currentBytes), {headers:{'Content-Type':'application/json; charset=utf-8'}});
};
