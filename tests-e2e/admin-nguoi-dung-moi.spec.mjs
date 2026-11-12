import { test, expect } from "@playwright/test";
import { ADMIN, USER_ROWS, mockCommunityApi } from "./helpers/community-mock.mjs";

// Thiết kế mới khu Người dùng / Nhật ký của /quan-tri/ (artboard AdminAuditMoi, AdminUserBanMoi):
// nhật ký nhóm theo ngày theo múi giờ người xem, "Tải thêm" nối đúng nhóm ngày, hộp thoại khoá có dòng ngày hết
// khoá và nhãn nút theo thời hạn. "Bây giờ" cố định bằng page.clock để nhãn Hôm nay/Hôm qua và giờ hết khoá ổn định.

const NOW = new Date("2026-11-11T14:02:00.000Z"); // 21:02 11/11 ở Asia/Saigon (+07)

const ROOT_ACTOR = { id: "u9", role: "root", label: "Quản trị <qu***@example.com>" };
const MOD_ACTOR = { id: "u5", role: "moderator", label: "Tiểu Tướng Quân <ti***@example.com>" };
const entry = (id, createdAt, overrides = {}) => ({
  id,
  actor: ROOT_ACTOR,
  action: "post.update",
  target: { type: "post", id: "p1", label: "Bài mới" },
  subjectUserId: null,
  reason: null,
  meta: null,
  status: "ok",
  createdAt,
  ...overrides,
});

// 16:59Z và 17:01Z ngày 10/11: hai ngày khác nhau ở +07 (23:59 ngày 10 · 00:01 ngày 11), cùng ngày 10 ở UTC.
const PAGE_1 = [
  entry("e5", "2026-11-11T10:00:00.000Z", {
    actor: MOD_ACTOR,
    action: "user.ban",
    target: { type: "user", id: "u2", label: "ba***@example.com" },
    reason: "Spam quảng cáo bán tài khoản ở bình luận.",
    meta: { duration: "7d", until: 0, votesRemoved: 0, deploy: "pending" },
  }),
  entry("e4", "2026-11-10T17:01:00.000Z", {
    action: "user.role",
    target: { type: "user", id: "u3", label: "ti***@example.com" },
    meta: { from: "user", to: "moderator" },
  }),
  entry("e3", "2026-11-10T16:59:00.000Z", { action: "comment.delete", target: { type: "comment", id: "c1", label: "/doi-chuan/" }, status: "failed" }),
];
const PAGE_2 = [
  entry("e2", "2026-11-10T03:00:00.000Z", { action: "season.open", target: { type: "season", id: "PK-S27", label: "PK-S27" } }),
  entry("e1", "2026-11-08T03:20:00.000Z", { action: "user.delete", target: { type: "user", id: "u7", label: "ho***@example.com" }, status: "partial" }),
];

/** Nhật ký 2 trang (cursor "p2"); ghi lại query từng lần gọi. */
async function routeAuditPages(page) {
  const queries = [];
  await page.route((url) => url.pathname === "/api/admin/audit", (route) => {
    const url = new URL(route.request().url());
    queries.push(Object.fromEntries(url.searchParams));
    const second = url.searchParams.get("cursor") === "p2";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(second ? { items: PAGE_2, nextCursor: null } : { items: PAGE_1, nextCursor: "p2" }),
    });
  });
  return queries;
}

async function openAudit(page) {
  await page.clock.setFixedTime(NOW);
  await mockCommunityApi(page, { user: ADMIN });
  const queries = await routeAuditPages(page);
  await page.goto("/quan-tri/#nhat-ky");
  const panel = page.getByRole("region", { name: "Nhật ký", exact: true });
  await expect(panel.locator(".adm-audit-day").first()).toBeVisible();
  return { panel, queries };
}

/** [tiêu đề nhóm, [giờ của từng dòng]] theo thứ tự hiện. */
async function dayGroups(panel) {
  return panel.locator(".adm-audit-day").evaluateAll((groups) => groups.map((group) => [
    group.querySelector(".adm-audit-day-title").textContent,
    [...group.querySelectorAll(".adm-audit-time")].map((time) => time.textContent),
  ]));
}

test.describe("nhật ký theo múi giờ Asia/Saigon", () => {
  test.use({ timezoneId: "Asia/Saigon" });

  test("nhóm theo ngày địa phương, nhãn Hôm nay/Hôm qua/ngày; Tải thêm nối nhóm, không lặp đầu nhóm", async ({ page }) => {
    const { panel, queries } = await openAudit(page);
    expect(await dayGroups(panel)).toEqual([
      ["Hôm nay · 11 thg 11, 2026", ["17:00", "00:01"]],
      ["Hôm qua · 10 thg 11, 2026", ["23:59"]],
    ]);
    // Đầu nhóm là tiêu đề h3 gắn nhãn cho danh sách của nhóm.
    await expect(panel.getByRole("list", { name: "Hôm qua · 10 thg 11, 2026" }).getByRole("listitem")).toHaveCount(1);
    await expect(panel.getByRole("status").filter({ hasText: "mới nhất lên trước" })).toContainText("Tất cả hành động");

    // Dòng khoá: icon + nhãn, đối tượng mono, thời hạn, lý do, người làm (tên · vai trò · email che), deploy chưa rõ.
    const ban = panel.locator(".adm-audit").filter({ hasText: "Khoá tài khoản" });
    await expect(ban).toContainText("Đối tượng: người dùng · ba***@example.com");
    await expect(ban.locator(".adm-audit-target-label[data-mono]")).toHaveText("ba***@example.com");
    await expect(ban).toContainText("Thời hạn: 7 ngày");
    await expect(ban.locator(".adm-audit-reason")).toHaveText("Lý do: Spam quảng cáo bán tài khoản ở bình luận.");
    await expect(ban.locator(".adm-audit-actor")).toContainText("Tiểu Tướng Quân");
    await expect(ban.locator(".adm-audit-actor")).toContainText("Kiểm duyệt viên");
    await expect(ban.locator(".adm-audit-actor")).toContainText("ti***@example.com");
    await expect(ban.locator(".adm-audit-actor")).not.toContainText("<");
    await expect(ban.locator(".adm-audit-icon")).toHaveAttribute("data-tone", "danger");
    await expect(ban.locator(".adm-audit-result")).toContainText("Thành công");
    await expect(ban.locator(".adm-audit-result")).toContainText("chưa rõ kết quả deploy");
    await expect(panel.locator(".adm-audit").filter({ hasText: "Đổi vai trò" })).toContainText("Người dùng → Kiểm duyệt viên");
    await expect(panel.locator(".adm-audit").filter({ hasText: "Xoá bình luận" }).locator(".cm-badge[data-status]")).toHaveText("Thất bại");

    await panel.getByRole("button", { name: "Tải thêm" }).click();
    await expect(panel.locator(".adm-audit")).toHaveCount(5);
    expect(queries.at(-1)).toEqual({ cursor: "p2" });
    expect(await dayGroups(panel)).toEqual([
      ["Hôm nay · 11 thg 11, 2026", ["17:00", "00:01"]],
      ["Hôm qua · 10 thg 11, 2026", ["23:59", "10:00"]],
      ["8 thg 11, 2026", ["10:20"]],
    ]);
    await expect(panel.getByRole("heading", { name: /^Hôm qua/ })).toHaveCount(1);
    await expect(panel.getByRole("button", { name: "Tải thêm" })).toBeHidden();

    // Đổi bộ lọc: tải lại từ đầu (không cursor), dòng tóm tắt theo hành động đã chọn.
    await panel.getByLabel("Hành động").selectOption("user.ban");
    await expect.poll(() => queries.at(-1)).toEqual({ action: "user.ban" });
    await expect(panel.getByRole("status").filter({ hasText: "mới nhất lên trước" })).toContainText("Khoá tài khoản");
  });
});

test.describe("nhật ký theo múi giờ UTC", () => {
  test.use({ timezoneId: "UTC" });

  test("16:59Z và 17:01Z cùng một ngày khi người xem ở UTC", async ({ page }) => {
    const { panel } = await openAudit(page);
    expect(await dayGroups(panel)).toEqual([
      ["Hôm nay · 11 thg 11, 2026", ["10:00"]],
      ["Hôm qua · 10 thg 11, 2026", ["17:01", "16:59"]],
    ]);
  });
});

/** Mở chi tiết Lưu Bị rồi hộp thoại Khoá. */
async function openBanDialog(page) {
  await page.clock.setFixedTime(NOW);
  const calls = await mockCommunityApi(page, { user: ADMIN, users: USER_ROWS() });
  await page.goto("/quan-tri/#nguoi-dung");
  const panel = page.getByRole("region", { name: "Người dùng", exact: true });
  await panel.locator(".adm-user-open", { hasText: "Lưu Bị" }).click();
  await panel.getByRole("button", { name: "Khoá…", exact: true }).click();
  return { calls, panel, dialog: page.getByRole("dialog", { name: "Khoá tài khoản" }) };
}

test.describe("hộp thoại khoá (Asia/Saigon)", () => {
  test.use({ timezoneId: "Asia/Saigon" });

  test("ngày hết khoá và nhãn nút theo thời hạn; lý do bắt buộc; gửi {duration, reason}", async ({ page }) => {
    const { calls, panel, dialog } = await openBanDialog(page);
    await expect(dialog).toContainText("Lưu Bị");
    await expect(dialog).toContainText("luubi@example.com");
    await expect(dialog).toContainText("Người bị khoá sẽ:");
    const until = dialog.locator(".adm-ban-until");
    await expect(dialog.getByRole("radio", { name: "1 ngày" })).toBeChecked();
    await expect(until).toHaveText("Tự mở khoá lúc 21:02 12 thg 11, 2026 nếu khoá ngay bây giờ.");
    await expect(dialog.getByRole("button", { name: "Khoá 1 ngày" })).toBeVisible();

    for (const [label, text, button] of [
      ["7 ngày", "Tự mở khoá lúc 21:02 18 thg 11, 2026 nếu khoá ngay bây giờ.", "Khoá 7 ngày"],
      ["30 ngày", "Tự mở khoá lúc 21:02 11 thg 12, 2026 nếu khoá ngay bây giờ.", "Khoá 30 ngày"],
      ["Vĩnh viễn", "Không tự hết hạn; chỉ mở khoá bằng tay ở trang này.", "Khoá vĩnh viễn"],
    ]) {
      await dialog.getByRole("radio", { name: label }).check();
      await expect(until).toHaveText(text);
      await expect(dialog.getByRole("button", { name: button })).toBeVisible();
    }

    // Lý do bắt buộc: không gửi, báo lỗi, ô lý do được đánh dấu.
    await dialog.getByRole("button", { name: "Khoá vĩnh viễn" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Cần nhập lý do khoá.");
    await expect(dialog.getByLabel("Lý do")).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((call) => call.path === "/api/admin/users/u1/ban")).toBe(false);

    await dialog.getByLabel("Lý do").fill("  Lăng mạ người chơi khác  ");
    await expect(dialog.locator(".adm-ban-counter")).toHaveText("27/500");
    await dialog.getByRole("radio", { name: "30 ngày" }).check();
    await dialog.getByRole("button", { name: "Khoá 30 ngày" }).click();
    await expect.poll(() => calls.find((call) => call.path === "/api/admin/users/u1/ban")?.body).toEqual({
      duration: "30d",
      reason: "Lăng mạ người chơi khác",
    });
    await expect(dialog).toBeHidden();
    await expect(panel.getByText("Đã khoá tài khoản.")).toBeVisible();
  });
});

test.describe("hộp thoại khoá (UTC)", () => {
  test.use({ timezoneId: "UTC" });

  test("giờ hết khoá hiện theo múi giờ người xem", async ({ page }) => {
    const { dialog } = await openBanDialog(page);
    await dialog.getByRole("radio", { name: "7 ngày" }).check();
    await expect(dialog.locator(".adm-ban-until")).toHaveText("Tự mở khoá lúc 14:02 18 thg 11, 2026 nếu khoá ngay bây giờ.");
  });
});

test("Người dùng: bảng có vai trò, trạng thái + dòng hạn khoá, đóng góp, chip Bạn; dòng đếm không đoán tổng", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const users = USER_ROWS();
  await mockCommunityApi(page, { user: ADMIN, users });
  await page.goto("/quan-tri/#nguoi-dung");
  const panel = page.getByRole("region", { name: "Người dùng", exact: true });
  const rows = panel.locator(".adm-user");
  await expect(rows).toHaveCount(6);
  await expect(panel.getByRole("status").filter({ hasText: "Mới đăng ký lên trước" })).toContainText("6 người dùng");
  await expect(rows.filter({ hasText: "Tào Tháo" }).locator(".adm-user-ban-line")).toHaveText(/^Khoá đến .+ · do quản trị viên$/);
  await expect(rows.filter({ hasText: "Tôn Quyền" }).locator(".adm-user-ban-line")).toHaveText("Khoá vĩnh viễn · do kiểm duyệt viên");
  await expect(rows.filter({ hasText: "Quan Vũ" }).locator(".adm-role-badge")).toHaveText("Kiểm duyệt viên");
  await expect(rows.filter({ hasText: "root@example.com" }).locator(".adm-you")).toHaveText("Bạn");
  await expect(rows.filter({ hasText: "root@example.com" }).locator(".adm-role-badge")).toHaveAttribute("data-role", "root");
  await expect(rows.first().locator(".adm-user-counts")).toContainText("3 bình luận");
  await expect(panel.getByLabel("Tìm kiếm")).toHaveAttribute("placeholder", "Tên hoặc email");

  // Còn trang sau: chỉ nói số đã tải.
  const statuses = [];
  await page.route((url) => url.pathname === "/api/admin/users", (route) => {
    statuses.push(new URL(route.request().url()).searchParams.get("status"));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: users.slice(0, 2), nextCursor: "c2" }) });
  });
  await panel.getByRole("group", { name: "Trạng thái" }).getByRole("button", { name: "Bình thường" }).click();
  await expect(rows).toHaveCount(2);
  await expect(panel.getByRole("status").filter({ hasText: "Mới đăng ký lên trước" })).toContainText("Đã tải 2 người dùng");
  await expect(panel.getByRole("button", { name: "Tải thêm" })).toBeVisible();
  expect(statuses).toEqual(["active"]);
});
