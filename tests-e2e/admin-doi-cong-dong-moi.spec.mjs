import { test, expect } from "@playwright/test";
import { ADMIN, MODERATOR, mockCommunityApi } from "./helpers/community-mock.mjs";

// Khu Đội cộng đồng của /quan-tri/ theo thiết kế AdminTeamsMoi: dòng tổng dưới tiêu đề, nhóm nút chọn trạng thái,
// nút Xem/Ẩn phân tích, ghi chú theo trạng thái; không còn khối Mùa đang mở / form Mở mùa mới (mùa lấy từ Đội chuẩn).
// Hành vi duyệt/từ chối/gỡ (gọi API, lỗi theo mã) đã kiểm ở community-teams.spec.mjs.
const CURRENT_SEASON = { id: "pk-s27", labelVi: "PK-S27 · Hán Diễm Trường Minh", labelZh: "PK-S27 · 汉艳长明" };
const SEASONS = { current: CURRENT_SEASON.id, seasons: [{ id: "og-兵演春秋", labelVi: "OG · Binh Diễn Xuân Thu", labelZh: "OG · 兵演春秋" }, CURRENT_SEASON] };
const HEROES = ["hero:tao-thao", "hero:quan-vu", "hero:truong-phi"];
const TACTICS = [["tactic:binh-phong", "tactic:an-ui-quan-dan"], ["tactic:anh-thanh-tu-thu", "tactic:binh-vo-thuong-the"], ["tactic:bach-bo-xuyen-duong", "tactic:bach-ke-da-muu"]];
const adminTeam = (id, overrides = {}) => ({
  id, title: `Đội ${id}`, season: CURRENT_SEASON, heroes: HEROES, tactics: TACTICS, troop: "ky",
  author: { id: "u2", name: "Gia Cát", image: null, email: "gia***@example.com", emailMasked: true },
  upVotes: 0, downVotes: 0, evidenceCount: 0, points: 0, commentCount: 0, imageCount: 1, textLang: "vi",
  createdAt: "2026-10-10T08:00:00.000Z", status: "pending", rejectReason: null, deleting: false, ...overrides,
});
const teamDetail = (id) => ({
  ...adminTeam(id), status: "pending", heroKey: [...HEROES].sort().join(","), myVote: 0,
  analysis: { playstyle: "Mở đầu bằng khống chế.", strengths: "Mạnh đầu trận", weaknesses: null, counters: null, counteredBy: null, substitutes: null },
});
const panelOf = (page, name = "Đội cộng đồng") => page.getByRole("region", { name, exact: true });

test("bộ lọc trạng thái là nhóm nút aria-pressed: đổi lựa chọn gọi status= và đổi nhãn danh sách; dòng tổng theo teamsPending", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: MODERATOR,
    teams: { seasons: SEASONS, admin: [adminTeam("t1"), adminTeam("t2"), adminTeam("t3", { status: "approved" })] },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  const panel = panelOf(page);
  await expect(panel.getByText("2 đội chờ duyệt · đội chỉ hiện ở /doi-cong-dong/ sau khi được duyệt")).toBeVisible();
  const group = panel.getByRole("group", { name: "Trạng thái" });
  const buttons = group.getByRole("button");
  await expect(buttons).toHaveText(["Chờ duyệt", "Đã duyệt", "Bị từ chối", "Đang xoá dở"]);
  await expect(group.getByRole("button", { name: "Chờ duyệt" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("list", { name: "Đội chờ duyệt" }).locator(".adm-team")).toHaveCount(2);

  await group.getByRole("button", { name: "Đã duyệt" }).click();
  await expect(group.getByRole("button", { name: "Đã duyệt" })).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "Chờ duyệt" })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => calls.some((call) => call.path === "/api/admin/community-teams" && call.search.get("status") === "approved")).toBe(true);
  const approved = panel.getByRole("list", { name: "Đội đã duyệt" }).locator(".adm-team");
  await expect(approved).toHaveCount(1);
  await expect(approved.first()).toContainText("Gỡ đội cần nhập lý do; lý do được ghi vào nhật ký quản trị.");

  // Bấm lại nút đang chọn không tải lại danh sách.
  const before = calls.filter((call) => call.path === "/api/admin/community-teams").length;
  await group.getByRole("button", { name: "Đã duyệt" }).click();
  await group.getByRole("button", { name: "Bị từ chối" }).click();
  await expect(panel.getByText("Không có đội nào ở trạng thái này.")).toBeVisible();
  expect(calls.filter((call) => call.path === "/api/admin/community-teams").length).toBe(before + 1);

  // Duyệt xong, dòng tổng giảm theo số đếm mới.
  await group.getByRole("button", { name: "Chờ duyệt" }).click();
  await panel.locator(".adm-team").first().getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(panel.getByText("1 đội chờ duyệt · đội chỉ hiện ở /doi-cong-dong/ sau khi được duyệt")).toBeVisible();
});

test("Xem phân tích: nút aria-expanded mở vùng phân tích, tải chi tiết một lần; ảnh thứ 2 trở đi hiện trong vùng", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: MODERATOR,
    teams: { seasons: SEASONS, details: (id) => teamDetail(id), admin: [adminTeam("t1", { imageCount: 3 })] },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  const row = panelOf(page).locator(".adm-team").first();
  await expect(row.locator(".adm-team-thumb")).toContainText("3 ảnh");
  await expect(row.getByRole("list", { name: "Ba tướng của đội" }).getByRole("listitem")).toHaveCount(3);
  await expect(row).toContainText("Tào Tháo");
  await expect(row.locator(".adm-team-chip")).toHaveText(["Kỵ", "Tiếng Việt"]);

  const toggle = row.getByRole("button", { name: "Xem phân tích" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const regionId = await toggle.getAttribute("aria-controls");
  const region = page.locator(`#${regionId}`);
  await expect(region).toBeHidden();
  await toggle.click();
  const hide = row.getByRole("button", { name: "Ẩn phân tích" });
  await expect(hide).toHaveAttribute("aria-expanded", "true");
  await expect(region).toContainText("Chiến pháp theo tướng");
  await expect(region.locator(".adm-team-tactics > li")).toHaveCount(3);
  await expect(region.locator(".adm-team-fields dt")).toHaveText(["Lối chơi", "Điểm mạnh"]);
  await expect(region.locator(".adm-team-fields dd").first()).toHaveText("Mở đầu bằng khống chế.");
  await expect(region).toContainText("Đội có 3 ảnh: ảnh 1 đã hiện ở thẻ, ảnh 2–3 ở dưới.");
  await expect(region.locator(".adm-team-images img")).toHaveCount(2);

  await hide.click();
  await expect(region).toBeHidden();
  await row.getByRole("button", { name: "Xem phân tích" }).click();
  await expect(region).toBeVisible();
  expect(calls.filter((call) => call.method === "GET" && call.path === "/api/community-teams/t1")).toHaveLength(1);
});

test("ghi chú theo trạng thái: đội bị từ chối hiện lý do; đội xoá dở hiện lý do gỡ cũ và Thử xoá tiếp điền sẵn lý do", async ({ page }) => {
  await mockCommunityApi(page, {
    user: ADMIN,
    teams: {
      seasons: SEASONS,
      admin: [
        adminTeam("t4", { status: "rejected", rejectReason: "Ảnh không rõ" }),
        adminTeam("t5", { status: "approved", deleting: true, rejectReason: "Đội trùng" }),
      ],
    },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  const panel = panelOf(page);
  const group = panel.getByRole("group", { name: "Trạng thái" });
  await group.getByRole("button", { name: "Bị từ chối" }).click();
  const rejected = panel.getByRole("list", { name: "Đội bị từ chối" }).locator(".adm-team").first();
  await expect(rejected.locator(".adm-team-note")).toHaveText("Lý do từ chối: Ảnh không rõ");
  await expect(rejected.getByRole("button", { name: "Duyệt", exact: true })).toHaveCount(0);

  await group.getByRole("button", { name: "Đang xoá dở" }).click();
  const deleting = panel.getByRole("list", { name: "Đội đang xoá dở" }).locator(".adm-team").first();
  await expect(deleting.locator(".adm-team-note")).toContainText("Lần gỡ trước chưa xong");
  await expect(deleting.locator(".adm-team-note")).toContainText("“Đội trùng”");
  await deleting.getByRole("button", { name: "Thử xoá tiếp" }).click();
  await expect(deleting.getByLabel("Lý do gỡ")).toHaveValue("Đội trùng");
});

test("root: khu đội cộng đồng không có khối mùa hay form Mở mùa mới, vẫn có bộ lọc và danh sách", async ({ page }) => {
  const calls = await mockCommunityApi(page, { user: ADMIN, teams: { seasons: SEASONS, admin: [] } });
  await page.goto("/quan-tri/#doi-cong-dong");
  const panel = panelOf(page);
  await expect(panel.getByRole("group", { name: "Trạng thái" })).toBeVisible();
  await expect(panel.locator("#adm-season-form")).toHaveCount(0);
  await expect(panel.locator(".adm-season")).toHaveCount(0);
  await expect(panel.getByRole("heading", { name: "Mùa đang mở" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Mở mùa mới…" })).toHaveCount(0);
  expect(calls.filter((call) => call.path.startsWith("/api/community-seasons") || call.path === "/api/admin/community-seasons")).toEqual([]);
});

test("/zh/quan-tri/: khu đội cộng đồng hiện chữ Trung (dòng tổng, bộ lọc, nút phân tích), không có khối mùa", async ({ page }) => {
  await mockCommunityApi(page, { user: ADMIN, teams: { seasons: SEASONS, admin: [adminTeam("t1")] } });
  await page.goto("/zh/quan-tri/#doi-cong-dong");
  const panel = panelOf(page, "社区阵容");
  await expect(panel.getByText("1 个阵容待审核 · 阵容通过审核后才会显示在 /zh/doi-cong-dong/")).toBeVisible();
  await expect(panel.getByRole("group", { name: "状态" }).getByRole("button")).toHaveText(["待审核", "已通过", "未通过", "删除未完成"]);
  const row = panel.locator(".adm-team").first();
  await expect(row.getByRole("button", { name: "查看分析" })).toBeVisible();
  await expect(row.locator(".adm-team-chip")).toHaveText(["骑", "越南语"]);
  await expect(row).toContainText("PK-S27 · 汉艳长明");
  await expect(panel.locator("#adm-season-form")).toHaveCount(0);
});

test("mobile 390: danh sách đội chờ duyệt (kể cả vùng phân tích đang mở) không tràn ngang", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCommunityApi(page, {
    user: MODERATOR,
    teams: { seasons: SEASONS, admin: [adminTeam("t1"), adminTeam("t2")], details: (id) => teamDetail(id) },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  const panel = panelOf(page);
  const teams = panel.getByRole("list", { name: "Đội chờ duyệt" }).locator(".adm-team");
  await expect(teams).toHaveCount(2);
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noOverflow()).toBe(true);
  await teams.first().getByRole("button", { name: "Xem phân tích" }).click();
  await expect(teams.first().getByText("Mở đầu bằng khống chế.")).toBeVisible();
  expect(await noOverflow()).toBe(true);
});
