import type { APIContext, APIRoute } from "astro";
import { teamDetailCatalog } from "../lib/team-detail-routes.ts";

export const prerender = true;

export const SITEMAP_MIME = "application/xml; charset=utf-8";

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** A sitemap only publishes absolute URLs, so a missing or non-http(s) configured origin is a build failure. */
function requireOrigin(site: string | URL | undefined) {
  let parsed: URL;
  try {
    parsed = new URL(site instanceof URL ? site.href : String(site ?? ""));
  } catch {
    throw new Error("Sitemap needs the absolute `site` origin declared in astro.config");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Sitemap origin must be http(s): ${parsed.protocol}`);
  }
  return parsed.origin;
}

/** Root first, then every catalog route in a stable order; a repeat or a retired family stops the build. */
export function sitemapLocations(site: string | URL | undefined, routePaths: readonly string[]) {
  const origin = requireOrigin(site);
  const locations = [new URL("/", origin).href];
  for (const routePath of [...routePaths].sort()) locations.push(new URL(routePath, origin).href);
  const seen = new Set<string>();
  for (const location of locations) {
    const { pathname } = new URL(location);
    if (pathname === "/teams" || pathname.startsWith("/teams/")) {
      throw new Error(`Sitemap must not publish the retired route family: ${location}`);
    }
    if (seen.has(location)) throw new Error(`Sitemap publishes a duplicate URL: ${location}`);
    seen.add(location);
  }
  return locations;
}

export function sitemapDocument(site: string | URL | undefined, routePaths: readonly string[]) {
  const entries = sitemapLocations(site, routePaths)
    .map((location) => `  <url>\n    <loc>${location.replace(/[&<>"']/gu, (character) => XML_ESCAPES[character]!)}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export const GET: APIRoute = async ({ site }: APIContext) => {
  const catalog = await teamDetailCatalog();
  const routePaths = [...catalog.recommended, ...catalog.legacy, ...catalog.khaiHoang].map((entry) => entry.routePath);
  return new Response(sitemapDocument(site, routePaths), {
    headers: { "Content-Type": SITEMAP_MIME },
  });
};
