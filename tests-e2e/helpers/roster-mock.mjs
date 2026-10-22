// Giả lập `/api/me`, OAuth và `/api/roster` cho e2e "Đội của tôi". Máy chủ giả là CHÍNH `tests-js/support/roster-fake-server.mjs`
// (kiểm bản ghi bằng schema thật của Worker), nên đội client dựng sai dạng sẽ bị `rejected` ngay trong e2e.
import { createRosterServer } from "../../tests-js/support/roster-fake-server.mjs";

export const ALICE = { id: "u-alice", name: "Lưu Bị", email: "luubi@example.com", image: null, role: "user" };

/**
 * @param server máy chủ giả dùng chung giữa nhiều page/context (mô phỏng hai máy); mặc định tạo mới
 * @param signedIn người dùng hiện có phiên (`null` = khách; `/api/auth/sign-in/social` đặt lại thành `user`)
 * @returns {{server, calls, state, failNextPost(status), failPosts(count, status)}}
 */
export async function mockRoster(page, { server, user = ALICE, signedIn = true, indexOverride = null } = {}) {
  const roster = server ?? (await createRosterServer({ userId: user.id }));
  const state = { signedIn, failPost: [] };
  const calls = [];
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const json = (payload, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    calls.push({ method, path: url.pathname, search: url.search, body: method === "POST" ? safeJson(request) : null });
    if (url.pathname === "/api/me" && method === "GET") return json({ user: state.signedIn ? user : null });
    if (url.pathname === "/api/auth/sign-in/social" && method === "POST") {
      const callback = request.postDataJSON()?.callbackURL ?? `${url.origin}/`;
      state.signedIn = true;
      return json({ url: callback, redirect: true });
    }
    if (url.pathname === "/api/auth/sign-out" && method === "POST") {
      state.signedIn = false;
      return json({ ok: true });
    }
    if (url.pathname === "/api/roster") {
      if (!state.signedIn) return json({ error: { code: "unauthorized", message: "Cần đăng nhập" } }, 401);
      if (method === "POST" && state.failPost.length) return json({ error: { code: "internal", message: "x" } }, state.failPost.shift());
      try {
        const body = await roster.api(`${url.pathname}${url.search}`, { method, json: method === "POST" ? request.postDataJSON() : undefined });
        return json(body);
      } catch (error) {
        return json({ error: { code: error.code ?? "internal", message: String(error.message) } }, error.status || 500);
      }
    }
    // Các API cộng đồng khác của trang (bình luận, chiến báo…) không phải đối tượng test này.
    if (url.pathname.startsWith("/api/comments")) return json({ items: [], nextCursor: null });
    if (url.pathname.startsWith("/api/reports")) return json({ items: [], nextCursor: null, total: 0, wins: 0, losses: 0, draws: 0, winRate: null, topOpponents: [] });
    return json({ error: { code: "not_mocked", message: url.pathname } }, 404);
  });
  if (indexOverride) {
    await page.route("**/my-teams-source-index.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(indexOverride) }));
  }
  return {
    server: roster,
    calls,
    state,
    /** `count` lần POST `/api/roster` kế tiếp trả `status` (mặc định 500). */
    failPosts(count = 1, status = 500) {
      state.failPost = Array.from({ length: count }, () => status);
    },
    /** Các lời gọi POST `/api/roster` đã nhận (thân JSON). */
    posts: () => calls.filter((call) => call.method === "POST" && call.path === "/api/roster"),
  };
}

function safeJson(request) {
  try {
    return request.postDataJSON();
  } catch {
    return null;
  }
}

/** Đặt một đội đã lưu thẳng lên máy chủ giả (máy khác đã ghi). `team` = đội đã chuẩn hóa có `id`. */
export async function seedTeam(server, team, { boxId = "main", groupId = `${boxId}~ghep-team`, at = Date.now() - 60_000 } = {}) {
  const { id, boxId: _b, groupId: _g, updatedAt: _u, deletedAt: _d, ...body } = team;
  await server.seed({
    kind: "team",
    id,
    updatedAt: at,
    deleted: false,
    data: { id, boxId, groupId, ...body, updatedAt: new Date(at).toISOString(), deletedAt: "" },
  });
}

/** Hộp + hai nhóm mặc định trên máy chủ giả. */
export async function seedBox(server, boxId = "main", { name = boxId === "main" ? "Hộp chính" : "Hộp phụ", at = Date.now() - 120_000 } = {}) {
  const iso = (ms) => new Date(ms).toISOString();
  await server.seed({ kind: "box", id: boxId, updatedAt: at, deleted: false, data: { id: boxId, name, updatedAt: iso(at), deletedAt: "" } });
  for (const [suffix, groupName, order] of [["khai-hoang", "Khai Hoang", 0], ["ghep-team", "Ghép Team", 1]]) {
    await server.seed({ kind: "group", id: `${boxId}~${suffix}`, updatedAt: at, deleted: false, data: { id: `${boxId}~${suffix}`, boxId, name: groupName, order, updatedAt: iso(at), deletedAt: "" } });
  }
}
