import type { APIRoute } from "astro";
import { mySourceIndex, mySourceIndexJson } from "../lib/my-teams-source-index.ts";
import { websiteDisplayPublicationSnapshot } from "../lib/root-static-artifacts.ts";

export const prerender = true;

/** `{ "kind:key": contentHash }` của mọi đội có thể lưu vào "Đội của tôi" — chỉ `/doi-cua-toi/` tải để báo "Bản gốc đã cập nhật". */
export const GET: APIRoute = async () =>
  new Response(mySourceIndexJson(mySourceIndex(await websiteDisplayPublicationSnapshot())), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
