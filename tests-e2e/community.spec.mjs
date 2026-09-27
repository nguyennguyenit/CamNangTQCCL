import { test, expect } from "@playwright/test";

// Khối cộng đồng chạy trên HTML tĩnh đã build; `/api/**` được giả lập bằng page.route nên spec không cần Worker.
const DETAIL_PATH = "/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/";
const PAGE_KEY = DETAIL_PATH;
const PLAYER = { id: "u1", name: "Lưu Bị", image: null, isAdmin: false };
const ADMIN = { id: "u9", name: "Quản trị", image: null, isAdmin: true };
// PNG 1×1 hợp lệ: trình duyệt giải mã được nên bước thu nhỏ ảnh chạy thật.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const EMPTY_STATS = { total: 0, wins: 0, losses: 0, draws: 0, winRate: null, topOpponents: [] };

/** Giả lập API cộng đồng; trả về nhật ký lời gọi để kiểm request body. */
async function mockCommunityApi(page, { user = null, stats = EMPTY_STATS, comments = [], reports = [], adminReports = [], adminFeedback = [], feedbackStatus = 201 } = {}) {
  const calls = [];
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
    if (method === "POST" && feedbackStatusMatch) return json({ id: feedbackStatusMatch[1], status: body.status });
    if (method === "GET" && url.pathname === "/api/admin/reports") return json({ items: adminReports, nextCursor: null });
    const approve = url.pathname.match(/^\/api\/admin\/reports\/([^/]+)\/approve$/);
    if (method === "POST" && approve) return json({ id: approve[1], status: "approved", rejectReason: null });
    if (method === "GET" && url.pathname.startsWith("/api/reports/") && url.pathname.endsWith("/image")) {
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 });
    }
    return json({ error: { code: "not_found", message: "not found" } }, 404);
  });
  return calls;
}

test("logged-out visitors see a sign-in prompt instead of the comment box", async ({ page }) => {
  const calls = await mockCommunityApi(page);
  await page.goto(DETAIL_PATH);

  const comments = page.locator("#community-root .cm-comments");
  await expect(comments.getByRole("heading", { name: "Bình luận" })).toBeVisible();
  await expect(comments.getByText("Đăng nhập để bình luận.")).toBeVisible();
  await expect(comments.locator("textarea")).toHaveCount(0);

  await comments.getByRole("button", { name: "Đăng nhập bằng Google" }).click();
  await expect.poll(() => calls.find((call) => call.path === "/api/auth/sign-in/social")?.body).toEqual({
    provider: "google",
    callbackURL: expect.stringContaining(DETAIL_PATH),
  });
  await expect(page).toHaveURL(/#oauth-mock$/);
});

test("signed-in players post a comment and only same-language comments are listed", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: PLAYER,
    comments: [
      { id: "c1", body: "Đội này mạnh ở mùa đầu.", lang: "vi", createdAt: "2026-09-20T08:00:00.000Z", author: { id: "u2", name: "Tào Tháo", image: null }, canDelete: false },
      { id: "c2", body: "这个阵容很强", lang: "zh", createdAt: "2026-09-21T08:00:00.000Z", author: { id: "u3", name: "孙权", image: null }, canDelete: false },
    ],
  });
  await page.goto(DETAIL_PATH);

  const comments = page.locator("#community-root .cm-comments");
  await expect(comments.locator(".cm-comment")).toHaveCount(1);
  await expect(comments).toContainText("Đội này mạnh ở mùa đầu.");
  await expect(comments).not.toContainText("这个阵容很强");
  // Header nhận phiên từ trang cộng đồng: nút tài khoản thay cho nút đăng nhập.
  await expect(page.locator("#community-auth .cm-auth-toggle")).toHaveAttribute("aria-label", "Tài khoản: Lưu Bị");

  await comments.getByLabel("Viết bình luận").fill("Mình dùng đội này thắng liền 5 trận.");
  await comments.getByRole("button", { name: "Gửi bình luận" }).click();

  await expect(comments.locator(".cm-comment").first()).toContainText("Mình dùng đội này thắng liền 5 trận.");
  await expect(comments.locator(".cm-comment")).toHaveCount(2);
  await expect(comments.getByRole("status")).toHaveText("Đã đăng bình luận.");
  expect(calls.find((call) => call.method === "POST" && call.path === "/api/comments")?.body).toEqual({
    page: PAGE_KEY,
    lang: "vi",
    body: "Mình dùng đội này thắng liền 5 trận.",
  });
});

test("report stats render the trust panel from approved reports", async ({ page }) => {
  await mockCommunityApi(page, {
    stats: { total: 4, wins: 3, losses: 1, draws: 0, winRate: 0.75, topOpponents: [{ heroes: ["曹操", "司马懿"], count: 2, wins: 1 }] },
    reports: [{
      id: "r1", result: "win", allyHeroes: ["刘备"], enemyHeroes: ["曹操"], note: "Thắng sát nút", season: null, lang: "vi",
      imageUrl: "/api/reports/r1/image", createdAt: "2026-09-22T08:00:00.000Z", author: { id: "u2", name: "Tào Tháo", image: null },
    }],
  });
  await page.goto(DETAIL_PATH);

  const reports = page.locator("#community-root .cm-reports");
  await expect(reports.getByRole("heading", { name: "Chiến báo thực chiến" })).toBeVisible();
  const stat = (label) => reports.locator(".cm-stat").filter({ has: page.getByText(label, { exact: true }) });
  await expect(stat("Số trận").locator(".cm-stat-value")).toHaveText("4");
  await expect(stat("Tỉ lệ thắng").locator(".cm-stat-value")).toHaveText(/75\s?%/);
  await expect(stat("Tỉ lệ thắng").locator(".cm-stat-detail")).toHaveText("3 thắng · 1 thua · 0 hoà");
  await expect(reports.locator(".cm-opponent")).toHaveText(/曹操 · 司马懿\s*2 trận · thắng 1/);
  await expect(reports.locator(".cm-report")).toContainText("Thắng sát nút");
});

test("report submission goes from image to AI-prefilled confirmation to pending review", async ({ page }) => {
  const calls = await mockCommunityApi(page, { user: PLAYER });
  await page.goto(DETAIL_PATH);

  const reports = page.locator("#community-root .cm-reports");
  await reports.getByRole("button", { name: "Gửi chiến báo" }).click();
  await reports.getByLabel("Chọn ảnh kết quả trận").setInputFiles({ name: "tran.png", mimeType: "image/png", buffer: PNG_1X1 });

  await expect(reports.getByLabel("Kết quả")).toHaveValue("win");
  await expect(reports.getByLabel("Tướng phe ta")).toHaveValue("刘备, 关羽");
  await expect(reports.getByLabel("Tướng đối thủ (nếu thấy)")).toHaveValue("曹操");
  const analyze = calls.find((call) => call.path === "/api/reports/analyze");
  expect(analyze.contentType).toContain("multipart/form-data");

  await reports.getByLabel("Tướng đối thủ (nếu thấy)").fill("曹操, 司马懿");
  await reports.getByLabel("Ghi chú (không bắt buộc)").fill("Trận thành");
  await reports.getByRole("button", { name: "Gửi để duyệt" }).click();

  await expect(reports.getByText("Đã gửi — đang chờ duyệt")).toBeFocused();
  expect(calls.find((call) => call.method === "POST" && call.path === "/api/reports")?.body).toEqual({
    page: PAGE_KEY,
    lang: "vi",
    uploadId: "up-1",
    result: "win",
    allyHeroes: ["刘备", "关羽"],
    enemyHeroes: ["曹操", "司马懿"],
    note: "Trận thành",
  });
});

test("community section degrades to a short notice when the API is unavailable", async ({ page }) => {
  await page.route((url) => url.pathname.startsWith("/api/"), (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "feature_disabled_other", message: "x" } }) }));
  await page.goto(DETAIL_PATH);
  await expect(page.locator("#community-root .cm-notice")).toHaveText("Tính năng cộng đồng tạm thời không khả dụng. Vui lòng thử lại sau.");
  await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
});

test("admin approves a pending report through the API", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: ADMIN,
    adminReports: [{
      id: "r7", result: "loss", allyHeroes: ["刘备"], enemyHeroes: ["曹操"], note: null, season: null, lang: "vi",
      imageUrl: null, createdAt: "2026-09-25T08:00:00.000Z", author: { id: "u2", name: "Tào Tháo", image: null },
      page: PAGE_KEY, status: "pending", rejectReason: null,
    }],
  });
  await page.goto("/quan-tri/");

  await expect(page.getByRole("tab", { name: "Duyệt chiến báo" })).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel");
  await expect(panel.locator(".cm-admin-report")).toHaveCount(1);
  await panel.getByRole("button", { name: "Duyệt", exact: true }).click();

  await expect.poll(() => calls.some((call) => call.method === "POST" && call.path === "/api/admin/reports/r7/approve")).toBe(true);
  await expect(panel.locator(".cm-admin-report")).toHaveCount(0);
  await expect(panel.getByText("Không còn chiến báo nào chờ duyệt.")).toBeVisible();
});

/* ---------- Góp ý, sửa lỗi (nút ở footer) ---------- */

/** Stub Turnstile: widget cấp ngay token "fixture-token"; đếm số lần script được nạp. */
async function stubTurnstile(page) {
  const loads = { count: 0 };
  await page.route("https://challenges.cloudflare.com/**", (route) => {
    loads.count += 1;
    return route.fulfill({
      contentType: "application/javascript",
      body: "window.turnstile={render(box,o){o.callback('fixture-token');return 'w'},reset(){}};",
    });
  });
  return loads;
}

test("khách ẩn danh gửi góp ý qua Turnstile nạp khi mở hộp thoại", async ({ page }) => {
  const calls = await mockCommunityApi(page);
  const turnstile = await stubTurnstile(page);
  await page.goto("/doi-chuan/");

  const opener = page.locator(".site-footer [data-feedback-open]");
  await expect(opener).toHaveText(/Góp ý, sửa lỗi/);
  await expect(page.locator("script[src*='turnstile']")).toHaveCount(0);
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "Góp ý, sửa lỗi" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("script[src*='turnstile']")).toHaveCount(1);
  await expect(dialog.getByLabel("Loại")).toHaveValue("feature");
  await expect(dialog.getByLabel("Loại").locator("option")).toHaveText(["Đề xuất tính năng", "Báo cáo lỗi", "Thông tin sai", "Khác"]);

  await dialog.getByLabel("Loại").selectOption("bug");
  await dialog.getByLabel("Tiêu đề").fill("Bảng tướng không lọc được");
  await dialog.getByLabel("Nội dung").fill("Bấm lọc Ngụy thì danh sách trống.");
  await dialog.getByLabel(/Email/).fill("player@example.com");
  await dialog.getByRole("button", { name: "Gửi góp ý" }).click();

  await expect(dialog.getByRole("status")).toHaveText("Cảm ơn bạn! Góp ý đã được gửi.");
  const sent = calls.find((call) => call.method === "POST" && call.path === "/api/feedback");
  expect(sent.body).toEqual({
    kind: "bug",
    title: "Bảng tướng không lọc được",
    body: "Bấm lọc Ngụy thì danh sách trống.",
    email: "player@example.com",
    page: "/doi-chuan/",
    lang: "vi",
    turnstileToken: "fixture-token",
  });
  await expect(dialog.getByLabel("Tiêu đề")).toHaveValue("");
  expect(turnstile.count).toBe(1);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("góp ý: thiếu tiêu đề/nội dung thì không gửi; lỗi 429 giữ nguyên nội dung đã nhập", async ({ page }) => {
  const calls = await mockCommunityApi(page, { feedbackStatus: 429 });
  await stubTurnstile(page);
  await page.goto("/doi-chuan/");
  await page.locator(".site-footer [data-feedback-open]").click();
  const dialog = page.getByRole("dialog", { name: "Góp ý, sửa lỗi" });

  await dialog.getByRole("button", { name: "Gửi góp ý" }).click();
  await expect(dialog.getByLabel("Tiêu đề")).toHaveAttribute("aria-invalid", "true");
  expect(calls.some((call) => call.path === "/api/feedback")).toBe(false);

  await dialog.getByLabel("Tiêu đề").fill("Sai chỉ số");
  await dialog.getByLabel("Nội dung").fill("Chỉ số Trí sai.");
  await dialog.getByRole("button", { name: "Gửi góp ý" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.");
  await expect(dialog.getByLabel("Tiêu đề")).toHaveValue("Sai chỉ số");
});

test("người đã đăng nhập: email điền sẵn, không nạp Turnstile", async ({ page }) => {
  const calls = await mockCommunityApi(page, { user: { ...PLAYER, email: "luubi@example.com" } });
  const turnstile = await stubTurnstile(page);
  await page.goto("/zh/doi-chuan/");
  await page.locator(".site-footer [data-feedback-open]").click();
  const dialog = page.getByRole("dialog", { name: "意见反馈" });
  await expect(dialog.getByLabel(/邮箱/)).toHaveValue("luubi@example.com");

  await dialog.getByLabel("标题").fill("数据有误");
  await dialog.getByLabel("内容").fill("武将属性不对");
  await dialog.getByRole("button", { name: "提交反馈" }).click();
  await expect(dialog.getByRole("status")).toHaveText("感谢反馈！已成功提交。");
  const sent = calls.find((call) => call.method === "POST" && call.path === "/api/feedback");
  expect(sent.body).toEqual({ kind: "feature", title: "数据有误", body: "武将属性不对", email: "luubi@example.com", page: "/zh/doi-chuan/", lang: "zh" });
  expect(turnstile.count).toBe(0);
});

test("admin xem góp ý, lọc theo trạng thái và đánh dấu đã xử lý", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: ADMIN,
    adminFeedback: [
      { id: "f2", kind: "wrong_info", title: "Sai chỉ số", body: "Chỉ số Trí sai.", email: null, page: "/zh/tra-cuu/", lang: "zh", status: "new", createdAt: "2026-09-26T08:00:00.000Z", author: null },
      { id: "f1", kind: "bug", title: "Lỗi lọc", body: "Danh sách trống.", email: "player@example.com", page: "/doi-chuan/", lang: "vi", status: "done", createdAt: "2026-09-25T08:00:00.000Z", author: { id: "u2", name: "Tào Tháo" } },
    ],
  });
  await page.goto("/quan-tri/");
  await page.getByRole("tab", { name: "Góp ý" }).click();
  const panel = page.getByRole("tabpanel", { name: "Góp ý" });

  await expect(panel.getByLabel("Trạng thái")).toHaveValue("new");
  await expect(panel.locator(".cm-feedback-item")).toHaveCount(1);
  const item = panel.locator(".cm-feedback-item").first();
  await expect(item).toContainText("Sai chỉ số");
  await expect(item).toContainText("Thông tin sai");
  await expect(item.getByRole("link", { name: "/zh/tra-cuu/" })).toHaveAttribute("href", "/zh/tra-cuu/");

  await item.getByRole("button", { name: "Đánh dấu đã xử lý" }).click();
  await expect.poll(() => calls.find((call) => call.path === "/api/admin/feedback/f2/status")?.body).toEqual({ status: "done" });
  await expect(item.getByRole("button", { name: "Đánh dấu chưa xử lý" })).toBeVisible();

  await panel.getByLabel("Trạng thái").selectOption("");
  await expect(panel.locator(".cm-feedback-item")).toHaveCount(2);
  const answered = panel.locator(".cm-feedback-item").nth(1);
  await expect(answered).toContainText("Tào Tháo");
  await expect(answered.getByRole("link", { name: "player@example.com" })).toHaveAttribute("href", /^mailto:player@example\.com/);
});
