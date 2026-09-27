// Pages Function: proxy same-origin /api/* -> community-worker, để cookie phiên Better Auth
// là first-party trên domain site (tqccl.com, www.tqccl.com, tqccl.pages.dev). Ưu tiên service binding COMMUNITY; không có thì
// dùng biến COMMUNITY_API_ORIGIN (vd https://tqccl-community.<tài-khoản>.workers.dev).

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface ProxyEnv {
  COMMUNITY?: Fetcher;
  COMMUNITY_API_ORIGIN?: string;
}

interface ProxyContext {
  request: Request;
  env: ProxyEnv;
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function onRequest({ request, env }: ProxyContext): Promise<Response> {
  const url = new URL(request.url);
  const origin = env.COMMUNITY_API_ORIGIN?.trim();
  if (!env.COMMUNITY && !origin) {
    return jsonError(503, "community_unavailable", "Dịch vụ cộng đồng chưa được cấu hình");
  }
  const target = env.COMMUNITY ? url : new URL(url.pathname + url.search, origin);
  const headers = new Headers(request.headers);
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  // redirect: "manual" để 302 của OAuth (kèm Set-Cookie) về thẳng trình duyệt.
  const forwarded = new Request(target.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
    redirect: "manual",
  });
  try {
    // Trả nguyên response: giữ mọi Set-Cookie, Location, Cache-Control của worker.
    return await (env.COMMUNITY ? env.COMMUNITY.fetch(forwarded) : fetch(forwarded));
  } catch {
    return jsonError(502, "community_unreachable", "Không kết nối được dịch vụ cộng đồng");
  }
}
