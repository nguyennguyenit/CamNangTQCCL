import { test, expect } from "@playwright/test";
import { PLAYER, PNG_1X1, mockCommunityApi } from "./helpers/community-mock.mjs";

// Hành vi của thiết kế mới Đội cộng đồng (artboard DoiCongDong*Moi, BanNoticeMoi): chip binh chủng thay select,
// xoá đội qua hộp xác nhận trong trang, thông báo khoá có ngày hết khoá / vĩnh viễn, một h1, trang /zh/.
const OPEN_SEASON = { id: "s1", labelVi: "Mùa 1", labelZh: "第一赛季", openedAt: "2026-10-01T00:00:00.000Z" };
const SEASONS = { open: OPEN_SEASON, seasons: [OPEN_SEASON] };
const HEROES = ["hero:tao-thao", "hero:quan-vu", "hero:truong-phi"];
const TACTICS = [["tactic:binh-phong", "tactic:an-ui-quan-dan"], ["tactic:anh-thanh-tu-thu", "tactic:binh-vo-thuong-the"], ["tactic:bach-bo-xuyen-duong", "tactic:bach-ke-da-muu"]];
const teamItem = (id, overrides = {}) => ({
  id, title: `Đội ${id}`, season: OPEN_SEASON, heroes: HEROES, tactics: TACTICS, troop: "ky", author: PLAYER,
  upVotes: 3, downVotes: 1, evidenceCount: 2, points: 6, commentCount: 4, imageCount: 1, textLang: "vi",
  createdAt: "2026-10-10T08:00:00.000Z", ...overrides,
});
const teamDetail = (id, overrides = {}) => ({
  ...teamItem(id), status: "approved", heroKey: [...HEROES].sort().join(","), myVote: 0, seasonOpen: true,
  analysis: { playstyle: "Mở đầu bằng khống chế.", strengths: null, weaknesses: null, counters: null, counteredBy: null, substitutes: null },
  ...overrides,
});
const MANUAL = [["Tào Tháo", "Binh Phong", "An Ủi Quân Dân"], ["Quan Vũ", "Anh Thành Tự Thủ", "Binh Vô Thường Thế"], ["Trương Phi", "Bách Phát Bách Trúng", "Bách Kế Đa Mưu"]];

test("đăng đội: chip binh chủng chọn bằng bàn phím, danh sách kiểm tra cập nhật, body gửi đúng mã binh chủng", async ({ page }) => {
  const calls = await mockCommunityApi(page, { user: PLAYER, teams: { seasons: SEASONS } });
  await page.goto("/doi-cong-dong/?new=1");
  await page.locator("#cm-team-image-0").setInputFiles({ name: "team.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByRole("button", { name: "Đọc bằng AI" }).first()).toBeVisible();
  for (const [heroIndex, row] of MANUAL.entries()) {
    for (const [position, value] of row.entries()) {
      const cell = page.locator(`#cm-team-cell-${heroIndex}-${position}`);
      await cell.fill(value);
      await cell.dispatchEvent("change");
    }
  }
  await expect(page.locator(".cm-team-done")).toContainText("Đủ 9/9 ô");
  await page.locator("#cm-team-title-input").fill("Đội chọn binh bằng phím");
  await page.locator("#cm-team-playstyle").fill("Đủ dài để qua kiểm tra lối chơi.");

  const group = page.getByRole("group", { name: "Binh chủng" });
  const radios = group.getByRole("radio");
  await expect(radios).toHaveCount(5);
  await expect(page.locator("select#cm-team-troop")).toHaveCount(0);
  const check = page.getByRole("list", { name: "Kiểm tra trước khi gửi" });
  await expect(check).toContainText("Chưa chọn");

  // Tab vào nhóm (một tab stop), Space chọn, mũi tên đổi lựa chọn: Cung → Khí giới → Kỵ.
  await page.locator("#cm-team-title-input").focus();
  await page.keyboard.press("Tab");
  await expect(group.getByRole("radio", { name: "Cung" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(group.getByRole("radio", { name: "Cung" })).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Kỵ" })).toBeChecked();
  await expect(group.getByRole("radio", { name: "Cung" })).not.toBeChecked();
  await expect(check).toContainText("Kỵ");
  // Chip đang chọn vẽ trạng thái trên mặt chip (nền --select).
  const face = group.locator("label.chip-chon", { hasText: "Kỵ" }).locator(".chip-chon-mat");
  const selectBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--select").trim());
  expect(await face.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  expect(selectBg).not.toBe("");

  await page.getByRole("button", { name: "Gửi để duyệt" }).click();
  await expect.poll(() => calls.find((call) => call.method === "POST" && call.path === "/api/community-teams")?.body.troop).toBe("ky");
});

test("đăng đội: chưa chọn binh chủng thì chặn gửi và đưa focus vào nhóm chip", async ({ page }) => {
  const calls = await mockCommunityApi(page, { user: PLAYER, teams: { seasons: SEASONS } });
  await page.goto("/doi-cong-dong/?new=1");
  await page.locator("#cm-team-image-0").setInputFiles({ name: "team.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByRole("button", { name: "Đọc bằng AI" }).first()).toBeVisible();
  for (const [heroIndex, row] of MANUAL.entries()) {
    for (const [position, value] of row.entries()) {
      const cell = page.locator(`#cm-team-cell-${heroIndex}-${position}`);
      await cell.fill(value);
      await cell.dispatchEvent("change");
    }
  }
  await page.locator("#cm-team-title-input").fill("Đội thiếu binh chủng");
  await page.locator("#cm-team-playstyle").fill("Đủ dài để qua kiểm tra lối chơi.");
  await page.getByRole("button", { name: "Gửi để duyệt" }).click();
  await expect(page.getByText("Hãy chọn binh chủng.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Binh chủng" }).getByRole("radio", { name: "Cung" })).toBeFocused();
  expect(calls.some((call) => call.method === "POST" && call.path === "/api/community-teams")).toBe(false);
});

test("chi tiết: chủ đội xoá qua hộp xác nhận — Huỷ không xoá và trả focus, Xoá đội gọi DELETE rồi về Đội của tôi", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: PLAYER,
    teams: { seasons: SEASONS, details: (id) => teamDetail(id), mine: { items: [], nextCursor: null }, remove: () => ({ body: { ok: true } }) },
  });
  let nativeDialogs = 0;
  page.on("dialog", (dialog) => {
    nativeDialogs += 1;
    dialog.dismiss();
  });
  await page.goto("/doi-cong-dong/?id=t1");
  const remove = page.getByRole("button", { name: "Xoá đội" });
  await remove.click();
  const dialog = page.getByRole("alertdialog", { name: "Xoá đội “Đội t1”?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Ảnh và dữ liệu đi kèm cũng bị xoá. Không hoàn tác được.");
  await expect(dialog.getByRole("button", { name: "Huỷ" })).toBeFocused();
  await dialog.getByRole("button", { name: "Huỷ" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(remove).toBeFocused();
  expect(calls.some((call) => call.method === "DELETE")).toBe(false);

  await remove.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá đội" }).click();
  await expect(page).toHaveURL(/\?mine=1$/);
  await expect(page.locator(".cm-team-flash")).toHaveText("Đã xoá đội.");
  expect(calls.filter((call) => call.method === "DELETE" && call.path === "/api/community-teams/t1")).toHaveLength(1);
  expect(nativeDialogs).toBe(0);
});

test("Đội của tôi: Escape đóng hộp không xoá; Xoá đội gỡ thẻ và cập nhật bảng Tình trạng", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: PLAYER,
    teams: {
      seasons: SEASONS,
      mine: { items: [teamItem("m1", { status: "pending" }), teamItem("m2", { status: "approved" })], nextCursor: null },
      remove: () => ({ body: { ok: true } }),
    },
  });
  await page.goto("/doi-cong-dong/?mine=1");
  const cards = page.locator(".cm-team-mine-card");
  await expect(cards).toHaveCount(2);
  const tally = page.locator(".cm-team-tally");
  await expect(tally.locator("[data-status='pending'] .cm-team-tally-num")).toHaveText("1");

  await cards.nth(0).getByRole("button", { name: "Xoá" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  await expect(cards).toHaveCount(2);

  await cards.nth(0).getByRole("button", { name: "Xoá" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá đội" }).click();
  await expect(cards).toHaveCount(1);
  await expect(tally.locator("[data-status='pending'] .cm-team-tally-num")).toHaveText("0");
  expect(calls.filter((call) => call.method === "DELETE").map((call) => call.path)).toEqual(["/api/community-teams/m1"]);
});

test.describe("thông báo khoá tài khoản", () => {
  test.use({ timezoneId: "Asia/Ho_Chi_Minh" });

  test("khoá có hạn: dòng ngày hết khoá, lý do, gợi ý, link Quy tắc cộng đồng, nút đóng cùng hàng", async ({ page }) => {
    await mockCommunityApi(page, { banNotice: { status: 200, body: { until: "2026-11-20T08:00:00.000Z", reason: "Spam quảng cáo trong bình luận", deleting: false } } });
    await page.goto("/doi-cong-dong/?error=ACCOUNT_BANNED&error_description=tok");
    const notice = page.locator("#community-auth .cm-auth-notice");
    const alert = notice.getByRole("alert");
    await expect(alert.locator(".cm-auth-notice-title")).toHaveText("Tài khoản đã bị khoá đến 15:00 20 thg 11, 2026.");
    await expect(alert).toContainText("Lý do: Spam quảng cáo trong bình luận");
    await expect(notice).toContainText("Bạn vẫn đọc được cẩm nang khi chưa đăng nhập.");
    await expect(notice.getByRole("link", { name: "Xem Quy tắc cộng đồng" })).toHaveAttribute("href", "/quy-tac-cong-dong/");
    const close = notice.getByRole("button", { name: "Đóng thông báo" });
    const [titleBox, closeBox] = [await alert.locator(".cm-auth-notice-title").boundingBox(), await close.boundingBox()];
    expect(closeBox.y).toBeLessThan(titleBox.y + titleBox.height);
    await close.click();
    await expect(notice).toHaveCount(0);
  });

  test("khoá vĩnh viễn (until null) và bản zh; mobile 390 không tràn ngang", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockCommunityApi(page, { banNotice: { status: 200, body: { until: null, reason: "Quấy rối", deleting: false } } });
    await page.goto("/doi-cong-dong/?error=ACCOUNT_BANNED&error_description=tok");
    const alert = page.locator("#community-auth").getByRole("alert");
    await expect(alert.locator(".cm-auth-notice-title")).toHaveText("Tài khoản đã bị khoá vĩnh viễn.");
    await expect(alert).not.toContainText("đến");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const box = await page.locator(".cm-auth-notice").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    await page.goto("/zh/doi-cong-dong/?error=ACCOUNT_BANNED&error_description=tok");
    await expect(page.locator("#community-auth").getByRole("alert").locator(".cm-auth-notice-title")).toHaveText("账号已被永久封禁。");
    await expect(page.locator(".cm-auth-notice").getByRole("link", { name: "查看社区规则" })).toHaveAttribute("href", "/zh/quy-tac-cong-dong/");
  });
});

test("một h1: danh sách là \"Đội cộng đồng\", chi tiết ?id= ẩn đầu trang và lấy tên đội làm h1", async ({ page }) => {
  await mockCommunityApi(page, {
    user: PLAYER,
    teams: {
      seasons: SEASONS,
      list: { items: [teamItem("t1"), teamItem("t2", { imageCount: 0 })], nextCursor: null },
      details: (id) => teamDetail(id),
    },
  });
  await page.goto("/doi-cong-dong/");
  await expect(page.locator(".cm-team-card")).toHaveCount(2);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Đội cộng đồng");
  // Thẻ không ảnh có trạng thái riêng.
  await expect(page.locator(".cm-team-card").nth(1).locator(".cm-team-card-media[data-empty='true']")).toContainText("Chưa có ảnh đội");
  await page.locator(".cm-team-card").first().getByRole("link", { name: "Đội t1", exact: true }).click();
  await expect(page).toHaveURL(/\?id=t1$/);
  await expect(page.locator(".cm-team-detail")).toBeVisible();
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await expect(page.locator("h1:visible")).toHaveText("Đội t1");
  await expect(page.locator(".cm-team-detail").getByRole("heading", { level: 2, name: "Đội hình" })).toBeVisible();
});

test("/zh/doi-cong-dong/: đầu trang, thanh lọc, thẻ và form đều có chữ Trung", async ({ page }) => {
  await mockCommunityApi(page, { user: PLAYER, teams: { seasons: SEASONS, list: { items: [teamItem("t1")], nextCursor: null } } });
  await page.goto("/zh/doi-cong-dong/");
  await expect(page.locator("h1")).toHaveText("社区阵容");
  await expect(page.locator("#cm-team-kicker")).toHaveText("社区 · 第一赛季进行中");
  await expect(page.getByRole("group", { name: "排序" }).getByRole("button", { name: "热门" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cm-team-card").first()).toContainText("曹操");
  await page.getByRole("link", { name: "发布阵容" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "发布新阵容" })).toBeVisible();
  await expect(page.getByRole("group", { name: "兵种" }).getByRole("radio")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "提交审核" })).toBeVisible();
});
