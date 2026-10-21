// Giả lập API cộng đồng dùng chung cho các spec e2e (page.route trên /api/**).
export const DETAIL_PATH = "/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/";
export const PAGE_KEY = DETAIL_PATH;
export const PLAYER = { id: "u1", name: "Lưu Bị", image: null, role: "user" };
export const ADMIN = { id: "u9", name: "Quản trị", email: "root@example.com", image: null, role: "root" };
export const MODERATOR = { id: "u5", name: "Kiểm duyệt A", email: "mod@example.com", image: null, role: "moderator" };

/** Hàng người dùng đúng hình dạng GET /api/admin/users (root thấy email thật). */
export const userRow = (overrides) => ({
  id: "u1", name: "Lưu Bị", email: "luubi@example.com", image: null,
  createdAt: "2026-08-01T08:00:00.000Z", lastSeenAt: "2026-10-16T08:00:00.000Z",
  role: "user", ban: null, deleting: false, counts: { comments: 3, reports: 2, feedback: 1, scanSamples: 0 },
  ...overrides,
});
export const USER_ROWS = () => [
  userRow(),
  userRow({ id: "u2", name: "Tào Tháo", email: "caocao@example.com", lastSeenAt: null, ban: { until: "2099-01-01T00:00:00.000Z", reason: "Spam quảng cáo", byRole: "root" }, counts: { comments: 0, reports: 0, feedback: 0, scanSamples: 0 } }),
  userRow({ id: "u3", name: "Quan Vũ", email: "quanvu@example.com", role: "moderator" }),
  userRow({ id: "u4", name: "Tôn Quyền", email: "tonquyen@example.com", ban: { until: null, reason: "Quấy rối", byRole: "moderator" } }),
  userRow({ id: "u6", name: "Gia Cát", email: "giacat@example.com", deleting: true }),
  userRow({ id: "u9", name: "Quản trị", email: "root@example.com", role: "root" }),
];
export const AUDIT_ROWS = () => [
  { id: "a3", actor: { id: "u9", role: "root", label: "Quản trị" }, action: "user.ban", target: { type: "user", id: "u2", label: "Tào Tháo" }, subjectUserId: "u2", reason: "Spam quảng cáo", meta: { until: null }, status: "ok", createdAt: "2026-10-16T09:00:00.000Z" },
  { id: "a2", actor: { id: "u9", role: "root", label: "Quản trị" }, action: "user.delete", target: { type: "user", id: "u7", label: "ba***@x.com" }, subjectUserId: "u7", reason: null, meta: { step: "r2" }, status: "partial", createdAt: "2026-10-16T08:00:00.000Z" },
  { id: "a1", actor: { id: "u9", role: "root", label: "Quản trị" }, action: "post.update", target: { type: "post", id: "p1", label: "Bài mới" }, subjectUserId: null, reason: null, meta: { deploy: "pending" }, status: "ok", createdAt: "2026-10-15T08:00:00.000Z" },
];
// PNG 1×1 hợp lệ: trình duyệt giải mã được nên bước thu nhỏ ảnh chạy thật.
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
export const EMPTY_STATS = { total: 0, wins: 0, losses: 0, draws: 0, winRate: null, topOpponents: [] };

/** Catalog mẫu mà GET /api/admin/ai/config trả (rút gọn từ shared/ai-models.ts). */
export const AI_PRESETS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    models: [{ modelId: "deepseek-flash", vision: true, effortStyle: "deepseek", efforts: ["off", "low", "high", "max"] }],
  },
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    endpoint: "https://opencode.ai/zen/v1/chat/completions",
    models: [
      { modelId: "deepseek-v4.1-flash", vision: true, effortStyle: "deepseek", efforts: ["off", "low", "high", "max"] },
      { modelId: "deepseek-v4-flash", vision: false, effortStyle: "deepseek", efforts: ["off", "low", "high", "max"] },
    ],
  },
];
export const AI_EFFORT_LEVELS = { deepseek: ["off", "low", "high", "max"], openai: ["none", "low", "medium", "high"], none: ["default"] };
export const AI_GROUP_NEEDS_VISION = { teamScan: true, rosterRecommend: true, explainSubstitute: false, battleReport: true };

/** Giả lập API cộng đồng; trả về nhật ký lời gọi để kiểm request body. */
export async function mockCommunityApi(page, { user = null, stats = EMPTY_STATS, comments = [], reports = [], adminReports = [], adminComments = [], adminFeedback = [], feedbackStatus = 201, aiConfig = { providers: [], groups: {} }, users = [], auditItems = [], banNotice = null, failures = {}, gates = {}, teams = null, myReports = [] } = {}) {
  const calls = [];
  // Bản lưu phía "server" của tab AI: có key thật, API chỉ trả keyLast4.
  let storedAi = aiConfig;
  const aiView = () => ({
    providers: storedAi.providers.map(({ apiKey, ...rest }) => ({ ...rest, keyLast4: apiKey.slice(-4) })),
    groups: storedAi.groups,
    presets: AI_PRESETS,
    effortLevels: AI_EFFORT_LEVELS,
    groupNeedsVision: AI_GROUP_NEEDS_VISION,
  });
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const contentType = request.headers()["content-type"] || "";
    const body = contentType.includes("application/json") ? request.postDataJSON() : null;
    calls.push({ method, path: url.pathname, search: url.searchParams, body, contentType });
    const json = (payload, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

    if (method === "GET" && url.pathname === "/api/me") return json({ user });
    if (method === "POST" && url.pathname === "/api/auth/sign-in/social") {
      return json({ url: `${url.origin}${DETAIL_PATH}#oauth-mock`, redirect: true });
    }
    if (method === "GET" && url.pathname === "/api/comments") return json({ items: comments, nextCursor: null });
    if (method === "POST" && url.pathname === "/api/comments") {
      return json({ id: "c-new", body: body.body, lang: body.lang, createdAt: "2026-09-27T08:00:00.000Z", author: user, canDelete: true }, 201);
    }
    if (method === "GET" && url.pathname === "/api/me/reports") return json({ items: myReports, nextCursor: null });
    if (method === "GET" && url.pathname === "/api/reports/stats") return json(stats);
    if (method === "GET" && url.pathname === "/api/reports") return json({ items: reports, nextCursor: null });
    if (method === "POST" && url.pathname === "/api/reports/analyze") {
      return json({
        uploadId: "up-1",
        analysis: { result: "win", ally: { heroes: ["刘备", "关羽"] }, enemy: { heroes: ["曹操"] }, battleType: null, notes: null },
      });
    }
    if (method === "POST" && url.pathname === "/api/reports") return json({ id: "r-new", status: "pending" }, 201);
    if (method === "POST" && url.pathname === "/api/feedback") {
      return feedbackStatus === 201 ? json({ ok: true }, 201) : json({ error: { code: "rate_limited", message: "x" } }, feedbackStatus);
    }
    if (method === "GET" && url.pathname === "/api/admin/feedback") {
      const status = url.searchParams.get("status");
      return json({ items: adminFeedback.filter((item) => !status || item.status === status), nextCursor: null });
    }
    const feedbackStatusMatch = url.pathname.match(/^\/api\/admin\/feedback\/([^/]+)\/status$/);
    if (method === "POST" && feedbackStatusMatch) {
      const entry = adminFeedback.find((item) => item.id === feedbackStatusMatch[1]);
      if (entry) entry.status = body.status;
      return json({ id: feedbackStatusMatch[1], status: body.status });
    }
    if (method === "GET" && url.pathname === "/api/admin/reports") return json({ items: adminReports.filter((r) => r.status === "pending"), nextCursor: null });
    if (method === "GET" && url.pathname === "/api/admin/comments") return json({ items: adminComments, nextCursor: null });
    if (method === "GET" && url.pathname === "/api/admin/counts") {
      return json({
        reportsPending: adminReports.filter((r) => r.status === "pending").length,
        postsDraft: 0,
        feedbackNew: adminFeedback.filter((f) => f.status === "new").length,
        feedbackDone: adminFeedback.filter((f) => f.status === "done").length,
        scanPending: 0,
        teamsPending: (teams?.admin ?? []).filter((t) => t.status === "pending" && !t.deleting).length,
      });
    }
    if (method === "GET" && url.pathname === "/api/ban-notice") {
      return banNotice ? json(banNotice.body, banNotice.status) : json({ error: { code: "not_found", message: "x" } }, 404);
    }
    if (method === "GET" && url.pathname === "/api/admin/audit") {
      const action = url.searchParams.get("action");
      return json({ items: auditItems.filter((item) => !action || item.action === action), nextCursor: null });
    }
    if (method === "GET" && url.pathname === "/api/admin/users") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const role = url.searchParams.get("role");
      const state = url.searchParams.get("status");
      const items = users.filter((u) => (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        && (!role || u.role === role)
        && (!state || (state === "deleting" ? u.deleting : state === "banned" ? u.ban && !u.deleting : !u.ban && !u.deleting)));
      return json({ items, nextCursor: null });
    }
    const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)(?:\/(ban|unban|role))?$/);
    if (userMatch) {
      const target = users.find((u) => u.id === userMatch[1]);
      const action = userMatch[2] || (method === "DELETE" ? "delete" : "detail");
      if (gates[action]) await gates[action];
      const failure = failures[action]?.shift();
      if (failure) {
        failure.apply?.(target);
        return json({ error: { code: failure.code, message: "x" } }, failure.status);
      }
      if (!target) return json({ error: { code: "not_found", message: "x" } }, 404);
      if (action === "detail") {
        return json({
          user: target,
          comments: [{ id: "c1", page: "/doi-chuan/", lang: "vi", body: "Bình luận gần đây", createdAt: "2026-10-10T08:00:00.000Z" }],
          reports: [{ id: "r1", page: "/doi-khac/", lang: "vi", result: "win", status: "approved", rejectReason: null, imageUrl: null, createdAt: "2026-10-11T08:00:00.000Z" }],
          audit: auditItems.filter((a) => a.subjectUserId === target.id),
        });
      }
      if (action === "ban") {
        target.ban = { until: body.duration === "permanent" ? null : "2099-01-01T00:00:00.000Z", reason: body.reason, byRole: user?.role };
        return json({ id: target.id, ban: target.ban });
      }
      if (action === "unban") {
        target.ban = null;
        return json({ id: target.id, ban: null });
      }
      if (action === "role") {
        target.role = body.role;
        return json({ id: target.id, role: target.role });
      }
      users.splice(users.indexOf(target), 1);
      return json({ ok: true, removedObjects: 0 });
    }
    if (method === "GET" && url.pathname === "/api/admin/ai/config") return json(aiView());
    if (method === "PUT" && url.pathname === "/api/admin/ai/config") {
      const previous = new Map(storedAi.providers.map((p) => [p.id, p.apiKey]));
      storedAi = { providers: body.providers.map((p) => ({ ...p, apiKey: p.apiKey || previous.get(p.id) })), groups: body.groups };
      return json(aiView());
    }
    // Quản trị đội: `teams.admin` là danh sách có trạng thái (duyệt/từ chối đổi tại chỗ); `teams.adminResult(action, id, body)`
    // trả {status, body} để ép lỗi; `teams.openSeason(body)` trả {status, body} cho POST /api/admin/community-seasons.
    if (teams && url.pathname === "/api/admin/community-teams" && method === "GET") {
      const wanted = url.searchParams.get("status") || "pending";
      const items = teams.admin.filter((t) => (wanted === "deleting" ? t.deleting : t.status === wanted && !t.deleting));
      return json({ items, nextCursor: null });
    }
    const adminTeam = url.pathname.match(/^\/api\/admin\/community-teams\/([^/]+)\/(approve|reject)$/);
    if (teams && method === "POST" && adminTeam) {
      const [, teamId, action] = adminTeam;
      const forced = teams.adminResult?.(action, teamId, body);
      if (forced) return json(forced.body, forced.status ?? 200);
      const target = teams.admin.find((t) => t.id === teamId);
      if (!target) return json({ error: { code: "not_found", message: "x" } }, 404);
      target.status = action === "approve" ? "approved" : "rejected";
      target.rejectReason = action === "reject" ? body.reason : null;
      return json({ id: teamId, status: target.status, ...(action === "reject" ? { rejectReason: body.reason } : {}) });
    }
    if (teams && method === "POST" && url.pathname === "/api/admin/community-seasons") {
      const result = teams.openSeason?.(body) ?? { status: 201, body: { id: body.id, labelVi: body.labelVi, labelZh: body.labelZh, openedAt: "2026-10-21T00:00:00.000Z", closedAt: null, previous: null } };
      return json(result.body, result.status ?? 201);
    }
    if (teams && url.pathname.startsWith("/api/") && (url.pathname === "/api/community-seasons" || url.pathname.startsWith("/api/community-teams") || url.pathname === "/api/me/community-teams")) {
      const pick = (value, ...args) => (typeof value === "function" ? value(...args) : value);
      if (method === "GET" && url.pathname === "/api/community-seasons") return json(pick(teams.seasons, url.searchParams) ?? { open: null, seasons: [] });
      if (method === "GET" && url.pathname === "/api/me/community-teams") return json(pick(teams.mine, url.searchParams) ?? { items: [], nextCursor: null });
      if (method === "GET" && url.pathname === "/api/community-teams") return json(pick(teams.list, url.searchParams) ?? { items: [], nextCursor: null });
      if (method === "POST" && url.pathname === "/api/community-teams/uploads") return json({ uploadId: `tu-${calls.filter((c) => c.path === url.pathname).length}` }, 201);
      const analyzeMatch = url.pathname.match(/^\/api\/community-teams\/uploads\/([^/]+)\/analyze$/);
      if (method === "POST" && analyzeMatch) {
        const result = pick(teams.analyze, analyzeMatch[1]) ?? { status: 200, body: { read: { screen: "team", sides: [] } } };
        return json(result.body, result.status ?? 200);
      }
      if (method === "POST" && url.pathname === "/api/community-teams") {
        const result = pick(teams.create, body) ?? { status: 201, body: { id: "t-new", status: "pending" } };
        return json(result.body, result.status ?? 201);
      }
      const teamMatch = url.pathname.match(/^\/api\/community-teams\/([^/]+)(?:\/(vote|images\/\d+))?$/);
      if (teamMatch) {
        const [, teamId, sub] = teamMatch;
        if (method === "GET" && sub?.startsWith("images/")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 });
        if (method === "PUT" && sub === "vote") {
          const result = pick(teams.vote, teamId, body) ?? { status: 200, body: { upVotes: 1, downVotes: 0, points: 1, myVote: body.value } };
          return json(result.body, result.status ?? 200);
        }
        if (method === "DELETE" && !sub) {
          const result = pick(teams.remove, teamId) ?? { status: 200, body: { ok: true } };
          return json(result.body, result.status ?? 200);
        }
        if (method === "GET" && !sub) {
          const detail = pick(teams.details, teamId);
          return detail ? json(detail) : json({ error: { code: "not_found", message: "x" } }, 404);
        }
      }
    }
    const approve = url.pathname.match(/^\/api\/admin\/reports\/([^/]+)\/approve$/);
    if (method === "POST" && approve) {
      const report = adminReports.find((r) => r.id === approve[1]);
      if (report) report.status = "approved";
      return json({ id: approve[1], status: "approved", rejectReason: null });
    }
    if (method === "GET" && url.pathname.startsWith("/api/reports/") && url.pathname.endsWith("/image")) {
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 });
    }
    return json({ error: { code: "not_found", message: "not found" } }, 404);
  });
  return calls;
}
