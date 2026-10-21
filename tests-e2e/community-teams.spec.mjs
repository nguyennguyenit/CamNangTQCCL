import { test, expect } from "@playwright/test";
import { ADMIN, MODERATOR, PLAYER, PNG_1X1, mockCommunityApi } from "./helpers/community-mock.mjs";

// Trang /doi-cong-dong/ chạy trên HTML tĩnh đã build; `/api/**` giả lập bằng helper dùng chung, từ điển tên là dữ liệu thật.
const OPEN_SEASON = { id: "s1", labelVi: "Mùa 1", labelZh: "第一赛季", openedAt: "2026-10-01T00:00:00.000Z" };
const SEASONS = { open: OPEN_SEASON, seasons: [OPEN_SEASON] };
const AUTHOR = { id: "u2", name: "Gia Cát", image: null };
const HEROES = ["hero:tao-thao", "hero:quan-vu", "hero:truong-phi"];
const TACTICS = [["tactic:binh-phong", "tactic:an-ui-quan-dan"], ["tactic:anh-thanh-tu-thu", "tactic:binh-vo-thuong-the"], ["tactic:bach-bo-xuyen-duong", "tactic:bach-ke-da-muu"]];

const teamItem = (id, overrides = {}) => ({
  id, title: `Đội ${id}`, season: OPEN_SEASON, heroes: HEROES, tactics: TACTICS, troop: "ky", author: AUTHOR,
  upVotes: 3, downVotes: 1, evidenceCount: 2, points: 2, commentCount: 4, imageCount: 1, textLang: "vi",
  createdAt: "2026-10-10T08:00:00.000Z", ...overrides,
});
const teamDetail = (id, overrides = {}) => ({
  ...teamItem(id), status: "approved", heroKey: [...HEROES].sort().join(","), myVote: 0, seasonOpen: true,
  analysis: { playstyle: "Mở đầu bằng khống chế.\nRồi dồn sát thương.", strengths: "Mạnh đầu trận", weaknesses: null, counters: null, counteredBy: null, substitutes: null },
  ...overrides,
});
const reportsFor = (lang) => [{
  id: "r1", result: "win", allyHeroes: ["刘备"], enemyHeroes: ["曹操"], note: "Thắng sát nút", season: null, lang,
  imageUrl: null, createdAt: "2026-10-12T08:00:00.000Z", author: AUTHOR,
}];
const commentsFor = (lang, body) => [{ id: "c1", body, lang, createdAt: "2026-10-12T08:00:00.000Z", author: AUTHOR, canDelete: false }];

test("danh sách: đổi sắp xếp gọi sort=top, lọc tướng gọi heroes=, Xem thêm dùng cursor và khử trùng id", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    teams: {
      seasons: SEASONS,
      list: (params) => (params.get("cursor") === "c2"
        ? { items: [teamItem("t2"), teamItem("t3")], nextCursor: null }
        : { items: [teamItem("t1"), teamItem("t2")], nextCursor: "c2" }),
    },
  });
  await page.goto("/doi-cong-dong/");
  const cards = page.locator(".cm-team-card");
  await expect(cards).toHaveCount(2);
  // Tên tướng theo bản Việt sau khi từ điển nạp xong; thẻ có ảnh đầu lazy.
  await expect(cards.first()).toContainText("Tào Tháo");
  await expect(cards.first().locator("img.cm-team-thumb")).toHaveAttribute("src", "/api/community-teams/t1/images/0");
  await expect(cards.first().locator("img.cm-team-thumb")).toHaveAttribute("loading", "lazy");
  await expect(cards.first()).toContainText("[VI]");
  const listCalls = () => calls.filter((call) => call.method === "GET" && call.path === "/api/community-teams");
  expect(listCalls()[0].search.get("season")).toBe("s1");
  expect(listCalls()[0].search.get("sort")).toBe("hot");

  await page.getByLabel("Sắp xếp").selectOption("top");
  await expect.poll(() => listCalls().some((call) => call.search.get("sort") === "top")).toBe(true);

  await page.getByLabel("Lọc theo tướng 1").fill("Tào Tháo");
  await page.getByLabel("Lọc theo tướng 1").blur();
  await expect.poll(() => listCalls().some((call) => call.search.get("heroes") === "hero:tao-thao")).toBe(true);

  await expect(page.locator("#cm-team-hero-options option").first()).toBeAttached();
  await expect(page.locator(".cm-team-grid")).not.toHaveAttribute("aria-busy", "true");
  await expect(cards).toHaveCount(2);
  await page.getByRole("button", { name: "Xem thêm" }).click();
  await expect.poll(() => listCalls().some((call) => call.search.get("cursor") === "c2")).toBe(true);
  await expect(cards).toHaveCount(3); // t2 trùng id không hiện lại
  await expect(page.getByRole("button", { name: "Xem thêm" })).toBeHidden();
});

test("không có mùa mở: ghi chú 'Chưa mở mùa' và không có tab Đăng đội", async ({ page }) => {
  await mockCommunityApi(page, { teams: { seasons: { open: null, seasons: [] } } });
  await page.goto("/doi-cong-dong/");
  await expect(page.getByText("Chưa mở mùa. Hiện chưa nhận đội mới.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng đội" })).toHaveCount(0);
});

test("/zh/doi-cong-dong/: tên tướng và chiến pháp tiếng Trung, [VI] trên văn bản/bình luận/chiến báo tiếng Việt", async ({ page }) => {
  await mockCommunityApi(page, {
    comments: commentsFor("vi", "Đội này mạnh ở mùa đầu."),
    reports: reportsFor("vi"),
    teams: { seasons: SEASONS, details: (id) => teamDetail(id) },
  });
  await page.goto("/zh/doi-cong-dong/?id=t1");
  const detail = page.locator(".cm-team-detail");
  await expect(detail).toContainText("曹操");
  await expect(detail).toContainText("關羽");
  await expect(detail).toContainText("兵鋒"); // tactic:binh-phong
  await expect(detail).not.toContainText("Tào Tháo");
  await expect(detail.locator(".cm-team-analysis .cm-lang-tag").first()).toHaveText("[VI]");
  await expect(detail.locator(".cm-team-text").first()).toContainText("Mở đầu bằng khống chế.");
  // Kho dùng chung vi/zh: bình luận và chiến báo tiếng Việt vẫn hiện ở bản zh, kèm nhãn.
  const comment = page.locator(".cm-comment");
  await expect(comment).toContainText("Đội này mạnh ở mùa đầu.");
  await expect(comment.locator(".cm-lang-tag")).toHaveText("[VI]");
  const report = page.locator(".cm-report").first();
  await expect(report).toContainText("Thắng sát nút");
  await expect(report.locator(".cm-lang-tag")).toHaveText("[VI]");
});

test("chi tiết mùa mở: vote gửi PUT {value:1} và cập nhật số; bấm lại huỷ phiếu", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: PLAYER,
    teams: {
      seasons: SEASONS,
      details: (id) => teamDetail(id),
      vote: (_id, body) => ({ body: { upVotes: body.value === 1 ? 4 : 3, downVotes: 1, points: body.value === 1 ? 3 : 2, myVote: body.value } }),
    },
  });
  await page.goto("/doi-cong-dong/?id=t1");
  const up = page.locator("button[data-vote='up']");
  await expect(up).toHaveText("▲ 3");
  await expect(up).toBeEnabled();
  await up.click();
  await expect(up).toHaveText("▲ 4");
  await expect(up).toHaveAttribute("aria-pressed", "true");
  const vote = calls.find((call) => call.method === "PUT" && call.path === "/api/community-teams/t1/vote");
  expect(vote.body).toEqual({ value: 1 });
  await up.click();
  await expect(up).toHaveText("▲ 3");
  expect(calls.filter((call) => call.method === "PUT").at(-1).body).toEqual({ value: 0 });
  // Mùa mở: có form chiến báo.
  await expect(page.locator(".cm-reports")).toContainText("Chiến báo");
  await expect(page.locator(".cm-archived")).toHaveCount(0);
  await expect(page.locator(".cm-reports input[type='file']")).toHaveCount(0);
  await page.locator(".cm-reports").getByRole("button", { name: "Gửi chiến báo", exact: true }).click();
  await expect(page.locator(".cm-reports input[type='file']")).toHaveCount(1);
});

test("chi tiết mùa đóng: tắt vote, không có form chiến báo, có ghi chú lưu trữ, bình luận vẫn gửi được", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: PLAYER,
    teams: { seasons: SEASONS, details: (id) => teamDetail(id, { seasonOpen: false }) },
  });
  await page.goto("/doi-cong-dong/?id=t1");
  await expect(page.locator("button[data-vote='up']")).toBeDisabled();
  await expect(page.locator("button[data-vote='down']")).toBeDisabled();
  await expect(page.getByText("Mùa đã đóng — không nhận bình chọn mới.")).toBeVisible();
  await expect(page.locator(".cm-archived")).toHaveText("Mùa đã lưu trữ — không nhận chiến báo mới.");
  await expect(page.locator(".cm-reports input[type='file']")).toHaveCount(0);
  await expect(page.locator(".cm-reports").getByRole("button", { name: "Gửi chiến báo", exact: true })).toHaveCount(0);

  const comments = page.locator(".cm-comments");
  await comments.getByLabel("Viết bình luận").fill("Đội này vẫn đáng xem.");
  await comments.getByRole("button", { name: "Gửi bình luận" }).click();
  await expect(comments.locator(".cm-comment").first()).toContainText("Đội này vẫn đáng xem.");
  expect(calls.find((call) => call.method === "POST" && call.path === "/api/comments").body).toEqual({
    page: "/doi-cong-dong/t1/", lang: "vi", body: "Đội này vẫn đáng xem.",
  });
});

test("khách bấm vote → lời mời đăng nhập; chủ đội không vote được đội mình", async ({ page }) => {
  const calls = await mockCommunityApi(page, { teams: { seasons: SEASONS, details: (id) => teamDetail(id) } });
  await page.goto("/doi-cong-dong/?id=t1");
  await page.locator("button[data-vote='up']").click();
  await expect(page.locator(".cm-team-guest").getByText("Đăng nhập để bình chọn.")).toBeVisible();
  await expect(page.locator(".cm-team-guest").getByRole("button", { name: "Đăng nhập bằng Google" })).toBeVisible();
  expect(calls.some((call) => call.method === "PUT")).toBe(false);

  const owner = await page.context().newPage();
  await mockCommunityApi(owner, { user: { ...PLAYER, id: "u2" }, teams: { seasons: SEASONS, details: (id) => teamDetail(id) } });
  await owner.goto("/doi-cong-dong/?id=t1");
  await expect(owner.locator("button[data-vote='up']")).toBeDisabled();
  await expect(owner.getByText("Bạn không thể bình chọn cho đội của mình.")).toBeVisible();
  await expect(owner.getByRole("button", { name: "Xoá đội" })).toBeVisible();
});

const AI_READ = {
  screen: "teamDetail",
  sides: [{
    side: "left",
    heroes: [
      { nameCn: "曹操", tacticsCn: ["兵鋒", "撫輯軍氏"], booksCn: ["铁甲"], statFocusCn: "" },
      { nameCn: "關羽", tacticsCn: ["嬰城自守", "兵無常勢"], booksCn: [], statFocusCn: "" },
      { nameCn: "張飛", tacticsCn: ["百步穿楊", "百計多謀"], booksCn: [], statFocusCn: "" },
    ],
  }],
};

async function uploadAndRead(page) {
  await page.locator("#cm-team-image-0").setInputFiles({ name: "team.png", mimeType: "image/png", buffer: PNG_1X1 });
  const read = page.getByRole("button", { name: "Đọc bằng AI" }).first();
  await expect(read).toBeEnabled();
  await read.click();
}

test("đăng đội: AI điền 3 tướng + 6 CP, ô unsure phải xác nhận, cảnh báo đội tương tự, body có id và không có season", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: PLAYER,
    teams: {
      seasons: SEASONS,
      analyze: () => ({ body: { read: AI_READ } }),
      list: (params) => (params.get("heroes") ? { items: [teamItem("t9", { title: "Đội đã có" })], nextCursor: null } : { items: [], nextCursor: null }),
    },
  });
  await page.goto("/doi-cong-dong/?new=1");
  await expect(page.getByText(/Mùa 1/).first()).toBeVisible();
  await uploadAndRead(page);
  await expect(page.locator("#cm-team-cell-0-0")).toHaveValue("Tào Tháo");
  await expect(page.locator("#cm-team-cell-1-0")).toHaveValue("Quan Vũ");
  await expect(page.locator("#cm-team-cell-2-0")).toHaveValue("Trương Phi");
  await expect(page.locator("#cm-team-cell-0-1")).toHaveValue("Binh Phong");
  await expect(page.locator("#cm-team-cell-2-2")).toHaveValue("Bách Kế Đa Mưu");
  // Ô đọc không chắc: để trống, kèm nút gợi ý, bị đánh dấu.
  await expect(page.locator("#cm-team-cell-0-2")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".cm-team-cell[data-state='unsure']")).toHaveCount(1);
  await expect(page.locator(".cm-team-similar-warning")).toContainText("1 đội");

  await page.locator("#cm-team-title-input").fill("Đội Tào Quan Trương");
  await page.locator("#cm-team-troop").selectOption("ky");
  await page.locator("#cm-team-playstyle").fill("Mở đầu bằng khống chế rồi dồn sát thương.");
  await page.getByRole("button", { name: "Gửi để duyệt" }).click();
  await expect(page.getByText("Còn ô chưa chắc chắn: hãy chọn gợi ý hoặc sửa lại tên.")).toBeVisible();
  expect(calls.some((call) => call.method === "POST" && call.path === "/api/community-teams")).toBe(false);

  await page.locator(".cm-team-candidate").first().click();
  await expect(page.locator("#cm-team-cell-0-2")).toHaveValue("An Ủi Quân Dân");
  await page.getByRole("button", { name: "Gửi để duyệt" }).click();
  await expect(page.locator(".cm-team-view[data-mode='mine']")).toBeVisible();
  await expect(page.getByText("Đã gửi đội, đang chờ quản trị viên duyệt.")).toBeVisible();

  const created = calls.find((call) => call.method === "POST" && call.path === "/api/community-teams");
  expect(created.body).toEqual({
    title: "Đội Tào Quan Trương",
    heroes: HEROES,
    tactics: [["tactic:binh-phong", "tactic:an-ui-quan-dan"], ["tactic:anh-thanh-tu-thu", "tactic:binh-vo-thuong-the"], ["tactic:bach-bo-xuyen-duong", "tactic:bach-ke-da-muu"]],
    troop: "ky",
    playstyle: "Mở đầu bằng khống chế rồi dồn sát thương.",
    strengths: "", weaknesses: "", counters: "", counteredBy: "", substitutes: "",
    lang: "vi",
    uploadIds: ["tu-1"],
  });
  expect(created.body).not.toHaveProperty("season");
});

test("đăng đội: AI trả 503 → thông báo theo mã, nhập tay vẫn gửi được", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: PLAYER,
    teams: {
      seasons: SEASONS,
      analyze: () => ({ status: 503, body: { error: { code: "ai_unavailable", message: "upstream boom" } } }),
    },
  });
  await page.goto("/doi-cong-dong/?new=1");
  await uploadAndRead(page);
  const status = page.locator(".cm-team-image-slot").first().getByRole("status");
  await expect(status).not.toContainText("upstream boom");
  await expect(status).not.toHaveText("");
  await expect(status).toContainText(/AI|dịch vụ/i);

  const manual = [["Tào Tháo", "Binh Phong", "An Ủi Quân Dân"], ["Quan Vũ", "Anh Thành Tự Thủ", "Binh Vô Thường Thế"], ["Trương Phi", "Bách Phát Bách Trúng", "Bách Kế Đa Mưu"]];
  for (const [heroIndex, row] of manual.entries()) {
    for (const [position, value] of row.entries()) {
      const input = page.locator(`#cm-team-cell-${heroIndex}-${position}`);
      await input.fill(value);
      await input.dispatchEvent("change");
    }
  }
  await page.locator("#cm-team-title-input").fill("Đội nhập tay");
  await page.locator("#cm-team-troop").selectOption("cung");
  await page.locator("#cm-team-playstyle").fill("Nhập tay vì AI đang bận.");
  await page.getByRole("button", { name: "Gửi để duyệt" }).click();
  await expect.poll(() => calls.find((call) => call.method === "POST" && call.path === "/api/community-teams")?.body.heroes).toEqual(HEROES);
  expect(calls.find((call) => call.method === "POST" && call.path === "/api/community-teams").body.tactics.flat()).toHaveLength(6);
});

test("đăng đội: chữ gõ không tra được được giữ lại, đánh dấu invalid và chặn gửi kèm thông báo theo ô", async ({ page }) => {
  const calls = await mockCommunityApi(page, { user: PLAYER, teams: { seasons: SEASONS } });
  await page.goto("/doi-cong-dong/?new=1");
  const input = page.locator("#cm-team-cell-0-0");
  await input.fill("qqq");
  await input.dispatchEvent("change");
  await expect(input).toHaveValue("qqq");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#cm-team-cell-0-0")).toHaveJSProperty("value", "qqq");
  await page.getByRole("button", { name: "Gửi để duyệt" }).click();
  await expect(page.getByText("Không tìm thấy “qqq” trong danh sách", { exact: false })).toBeVisible();
  await expect(input).toBeFocused();
  expect(calls.some((call) => call.method === "POST" && call.path === "/api/community-teams")).toBe(false);
});

test("đăng đội: server trả invalid_title → thông báo theo mã và focus ô tiêu đề", async ({ page }) => {
  await mockCommunityApi(page, {
    user: PLAYER,
    teams: { seasons: SEASONS, create: () => ({ status: 400, body: { error: { code: "invalid_title", message: "x" } } }) },
  });
  await page.goto("/doi-cong-dong/?new=1");
  await page.locator("#cm-team-image-0").setInputFiles({ name: "team.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByRole("button", { name: "Đọc bằng AI" }).first()).toBeEnabled();
  const manual = [["Tào Tháo", "Binh Phong", "An Ủi Quân Dân"], ["Quan Vũ", "Anh Thành Tự Thủ", "Binh Vô Thường Thế"], ["Trương Phi", "Bách Phát Bách Trúng", "Bách Kế Đa Mưu"]];
  for (const [heroIndex, row] of manual.entries()) {
    for (const [position, value] of row.entries()) {
      const cell = page.locator(`#cm-team-cell-${heroIndex}-${position}`);
      await cell.fill(value);
      await cell.dispatchEvent("change");
    }
  }
  await page.locator("#cm-team-title-input").fill("Đội hợp lệ phía client");
  await page.locator("#cm-team-troop").selectOption("cung");
  await page.locator("#cm-team-playstyle").fill("Nhập tay đủ dài để qua kiểm client.");
  await page.getByRole("button", { name: "Gửi để duyệt" }).click();
  await expect(page.getByText("Hãy nhập tiêu đề (tối đa 80 ký tự).")).toBeVisible();
  await expect(page.locator("#cm-team-title-input")).toBeFocused();
  await expect(page.getByRole("button", { name: "Gửi để duyệt" })).toBeEnabled();
});

test("Của tôi: trạng thái + lý do từ chối, xoá trả has_evidence hiện thông báo, xoá thành công gỡ thẻ", async ({ page }) => {
  await mockCommunityApi(page, {
    user: PLAYER,
    teams: {
      seasons: SEASONS,
      mine: { items: [
        teamItem("m1", { status: "pending", author: PLAYER }),
        teamItem("m2", { status: "rejected", rejectReason: "Ảnh không rõ", author: PLAYER }),
        teamItem("m3", { status: "approved", author: PLAYER }),
      ], nextCursor: null },
      remove: (id) => (id === "m3"
        ? { status: 409, body: { error: { code: "has_evidence", message: "x" } } }
        : { body: { ok: true } }),
    },
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/doi-cong-dong/?mine=1");
  const cards = page.locator(".cm-team-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Đang chờ duyệt");
  await expect(cards.nth(1)).toContainText("Bị từ chối");
  await expect(cards.nth(1)).toContainText("Ảnh không rõ");

  await cards.nth(2).getByRole("button", { name: "Xoá" }).click();
  await expect(page.getByText("Đội đã có chiến báo được duyệt của người khác; liên hệ quản trị để gỡ.")).toBeVisible();
  await expect(cards).toHaveCount(3);
  await cards.nth(1).getByRole("button", { name: "Xoá" }).click();
  await expect(cards).toHaveCount(2);
});

test("menu tài khoản có Đội cộng đồng; /chien-bao/ có link tới trang; Chiến báo của tôi mở /doi-cong-dong/?id=", async ({ page }) => {
  await mockCommunityApi(page, {
    user: PLAYER,
    myReports: [{
      id: "r5", page: "/doi-cong-dong/t1/", lang: "vi", result: "win", status: "approved", rejectReason: null,
      allyHeroes: ["刘备"], enemyHeroes: ["曹操"], note: null, imageUrl: null, createdAt: "2026-10-12T08:00:00.000Z",
    }],
  });
  await page.goto("/chien-bao/");
  await expect(page.locator(".cm-intro, main").getByRole("link", { name: "Đội cộng đồng" }).first()).toHaveAttribute("href", "/doi-cong-dong/");
  await expect(page.getByRole("link", { name: "Mở trang đội" })).toHaveAttribute("href", "/doi-cong-dong/?id=t1");

  await page.locator("#community-auth .cm-auth-toggle").click();
  const menu = page.locator("#community-auth");
  await expect(menu.getByRole("link", { name: "Đội cộng đồng" })).toHaveAttribute("href", "/doi-cong-dong/");
  await expect(menu.getByRole("link", { name: "Đội của tôi" })).toHaveAttribute("href", "/doi-cong-dong/?mine=1");
});

test("của tôi: đội xoá dở hiện trạng thái + Thử xoá tiếp; 502 delete_incomplete báo lỗi, thử lại xong thì gỡ thẻ", async ({ page }) => {
  let attempts = 0;
  const calls = await mockCommunityApi(page, {
    user: PLAYER,
    teams: {
      seasons: SEASONS,
      mine: { items: [
        teamItem("m1", { status: "approved", author: PLAYER, deleting: true }),
        teamItem("m2", { status: "approved", author: PLAYER, deleting: false }),
      ], nextCursor: null },
      remove: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 502, body: { error: { code: "delete_incomplete", message: "x" } } }
          : { body: { ok: true } };
      },
    },
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/doi-cong-dong/?mine=1");
  const cards = page.locator(".cm-team-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Đang xoá dở");
  await expect(cards.nth(0)).not.toContainText("Đã duyệt");
  await expect(cards.nth(1)).not.toContainText("Đang xoá dở");
  await expect(cards.nth(1).getByRole("button", { name: "Thử xoá tiếp" })).toHaveCount(0);

  await cards.nth(0).getByRole("button", { name: "Thử xoá tiếp" }).click();
  await expect(page.getByText("Xoá chưa hoàn tất")).toBeVisible();
  await expect(cards).toHaveCount(2);
  await cards.nth(0).getByRole("button", { name: "Thử xoá tiếp" }).click();
  await expect(cards).toHaveCount(1);
  expect(calls.filter((call) => call.method === "DELETE" && call.path === "/api/community-teams/m1")).toHaveLength(2);
});

/* ---------- Quản trị: /quan-tri/#doi-cong-dong ---------- */
const adminTeam = (id, overrides = {}) => teamItem(id, {
  author: { id: "u2", name: "Gia Cát", image: null, email: "gia***@example.com", emailMasked: true },
  status: "pending", rejectReason: null, deleting: false, ...overrides,
});
const teamsNav = (page) => page.getByRole("navigation", { name: "Khu quản trị" }).getByRole("link", { name: "Đội cộng đồng" });

test("quản trị (KDV): badge teamsPending, duyệt gửi approve rồi badge giảm, từ chối cần lý do, không có khối mùa", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: MODERATOR,
    teams: { seasons: SEASONS, admin: [adminTeam("t1"), adminTeam("t2")] },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  await expect(teamsNav(page).locator(".adm-nav-count")).toHaveText("2, 2 đội chờ");
  const panel = page.getByRole("region", { name: "Đội cộng đồng", exact: true });
  const rows = panel.locator(".adm-team");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Đội t1");
  await expect(rows.first()).toContainText("gia***@example.com");
  await expect(rows.first()).toContainText("Tào Tháo");
  await expect(rows.first()).toContainText("Mùa 1");
  await expect(panel.getByText("Mùa đang mở")).toHaveCount(0);
  expect(calls.filter((call) => call.path === "/api/admin/community-seasons")).toEqual([]);

  await rows.first().getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect.poll(() => calls.some((call) => call.method === "POST" && call.path === "/api/admin/community-teams/t1/approve")).toBe(true);
  await expect(rows).toHaveCount(1);
  await expect(teamsNav(page).locator(".adm-nav-count")).toHaveText("1, 1 đội chờ");

  await rows.first().getByRole("button", { name: "Từ chối" }).click();
  await rows.first().getByRole("button", { name: "Xác nhận từ chối" }).click();
  await expect(panel.getByText("Hãy nhập lý do từ chối.")).toBeVisible();
  expect(calls.filter((call) => call.path.endsWith("/reject"))).toEqual([]);
  await rows.first().getByLabel("Lý do từ chối").fill("Ảnh không rõ");
  await rows.first().getByRole("button", { name: "Xác nhận từ chối" }).click();
  await expect.poll(() => calls.find((call) => call.path === "/api/admin/community-teams/t2/reject")?.body).toEqual({ reason: "Ảnh không rõ" });
  await expect(rows).toHaveCount(0);
  await expect(teamsNav(page).locator(".adm-nav-count")).toBeHidden();
});

test("quản trị: 409 not_pending làm mới hàng; lọc trạng thái gọi status=; hàng mở rộng xem phân tích", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: ADMIN,
    teams: {
      seasons: SEASONS,
      details: (id) => teamDetail(id),
      admin: [adminTeam("t1"), adminTeam("t3", { status: "approved" })],
      adminResult: (action, id) => (id === "t1" ? { status: 409, body: { error: { code: "not_pending", message: "x" } } } : null),
    },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  const panel = page.getByRole("region", { name: "Đội cộng đồng", exact: true });
  await expect(panel.locator(".adm-team")).toHaveCount(1);
  await panel.locator(".adm-team").first().getByText("Xem phân tích").click();
  await expect(panel.locator(".adm-team").first()).toContainText("Mở đầu bằng khống chế");
  await panel.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "không còn chờ duyệt" })).toBeVisible();
  await expect(panel.locator(".adm-team")).toHaveCount(1);

  await panel.getByLabel("Trạng thái").selectOption("approved");
  await expect.poll(() => calls.some((call) => call.path === "/api/admin/community-teams" && call.search.get("status") === "approved")).toBe(true);
  await expect(panel.locator(".adm-team")).toHaveCount(1);
  await expect(panel.locator(".adm-team").first()).toContainText("Đội t3");
  await expect(panel.locator(".adm-team").first().getByRole("button", { name: "Duyệt", exact: true })).toHaveCount(0);
});

test("quản trị: gỡ đội đã duyệt cần lý do, gọi DELETE {reason}; 404 báo không đủ quyền", async ({ page }) => {
  const calls = await mockCommunityApi(page, {
    user: MODERATOR,
    teams: {
      seasons: SEASONS,
      admin: [adminTeam("t3", { status: "approved" }), adminTeam("t4", { status: "approved" })],
      remove: (id) => (id === "t4"
        ? { status: 404, body: { error: { code: "not_found", message: "x" } } }
        : { body: { ok: true } }),
    },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  const panel = page.getByRole("region", { name: "Đội cộng đồng", exact: true });
  await panel.getByLabel("Trạng thái").selectOption("approved");
  const rows = panel.locator(".adm-team");
  await expect(rows).toHaveCount(2);
  await rows.first().getByRole("button", { name: "Gỡ đội" }).click();
  await rows.first().getByRole("button", { name: "Xác nhận gỡ" }).click();
  await expect(panel.getByText("Hãy nhập lý do gỡ.")).toBeVisible();
  expect(calls.filter((call) => call.method === "DELETE")).toEqual([]);
  await rows.first().getByLabel("Lý do gỡ").fill("Vi phạm quy tắc");
  await rows.first().getByRole("button", { name: "Xác nhận gỡ" }).click();
  await expect.poll(() => calls.find((call) => call.method === "DELETE" && call.path === "/api/community-teams/t3")?.body).toEqual({ reason: "Vi phạm quy tắc" });
  await expect(rows).toHaveCount(1);

  await rows.first().getByRole("button", { name: "Gỡ đội" }).click();
  await rows.first().getByLabel("Lý do gỡ").fill("x");
  await rows.first().getByRole("button", { name: "Xác nhận gỡ" }).click();
  await expect(panel.getByText("Bạn không đủ quyền gỡ đội này.")).toBeVisible();
});

test("quản trị: lọc 'Đang xoá dở' liệt kê đội xoá dở, Thử xoá tiếp gọi DELETE {reason}; 502 giữ nút để thử lại", async ({ page }) => {
  let attempts = 0;
  const calls = await mockCommunityApi(page, {
    user: ADMIN,
    teams: {
      seasons: SEASONS,
      admin: [adminTeam("t5", { status: "approved", deleting: true })],
      remove: (id) => {
        attempts += 1;
        return attempts === 1
          ? { status: 502, body: { error: { code: "delete_incomplete", message: "x" } } }
          : { body: { ok: true } };
      },
    },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  const panel = page.getByRole("region", { name: "Đội cộng đồng", exact: true });
  await panel.getByLabel("Trạng thái").selectOption("deleting");
  await expect.poll(() => calls.some((call) => call.path === "/api/admin/community-teams" && call.search.get("status") === "deleting")).toBe(true);
  const row = panel.locator(".adm-team").first();
  await expect(row).toContainText("Đội t5");
  await expect(row.getByRole("button", { name: "Duyệt", exact: true })).toHaveCount(0);
  await row.getByRole("button", { name: "Thử xoá tiếp" }).click();
  await row.getByLabel("Lý do gỡ").fill("Dọn dở");
  await row.getByRole("button", { name: "Xác nhận gỡ" }).click();
  await expect(panel.getByText("Xoá chưa hoàn tất")).toBeVisible();
  await expect(row.getByRole("button", { name: "Xác nhận gỡ" })).toBeEnabled();
  await row.getByRole("button", { name: "Xác nhận gỡ" }).click();
  await expect(panel.locator(".adm-team")).toHaveCount(0);
  const deletes = calls.filter((call) => call.method === "DELETE" && call.path === "/api/community-teams/t5");
  expect(deletes.map((call) => call.body)).toEqual([{ reason: "Dọn dở" }, { reason: "Dọn dở" }]);
});

test("quản trị (root): khối Mùa đang mở, xác nhận rồi POST đúng body; 409 season_exists hiện thông báo", async ({ page }) => {
  let attempts = 0;
  const calls = await mockCommunityApi(page, {
    user: ADMIN,
    teams: {
      seasons: SEASONS,
      admin: [],
      openSeason: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 409, body: { error: { code: "season_exists", message: "x" } } }
          : { status: 201, body: { id: "s2", labelVi: "Mùa 2", labelZh: "第二赛季", openedAt: "2026-10-21T00:00:00.000Z", closedAt: null, previous: "s1" } };
      },
    },
  });
  await page.goto("/quan-tri/#doi-cong-dong");
  const panel = page.getByRole("region", { name: "Đội cộng đồng", exact: true });
  const block = panel.locator(".adm-season");
  await expect(block).toContainText("Mùa đang mở");
  await expect(block).toContainText("Mùa 1");
  await expect(block).toContainText("第一赛季");
  await block.getByLabel("Mã mùa").fill("s2");
  await block.getByLabel("Tên mùa (Việt)").fill("Mùa 2");
  await block.getByLabel("Tên mùa (Trung)").fill("第二赛季");
  await block.getByRole("button", { name: "Mở mùa mới…" }).click();
  const dialog = page.getByRole("dialog", { name: "Mở mùa mới" });
  await expect(dialog).toContainText("Mùa 1 sẽ bị lưu trữ");
  await dialog.getByRole("button", { name: "Xác nhận mở mùa" }).click();
  await expect.poll(() => calls.find((call) => call.method === "POST" && call.path === "/api/admin/community-seasons")?.body)
    .toEqual({ id: "s2", labelVi: "Mùa 2", labelZh: "第二赛季" });
  await expect(panel.getByText("Mã mùa này đã tồn tại.")).toBeVisible();

  await block.getByRole("button", { name: "Mở mùa mới…" }).click();
  await page.getByRole("dialog", { name: "Mở mùa mới" }).getByRole("button", { name: "Xác nhận mở mùa" }).click();
  await expect(block).toContainText("Mùa 2");
  await expect(panel.getByText("Đã mở mùa mới.")).toBeVisible();
});

test("nhật ký: team.approve / season.open có nhãn hành động và loại đối tượng vi + zh", async ({ page }) => {
  const auditItems = [
    { id: "a2", actor: { id: "u9", role: "root", label: "Quản trị" }, action: "season.open", target: { type: "season", id: "s2", label: "Mùa 2" }, subjectUserId: null, reason: null, meta: { previous: "s1" }, status: "ok", createdAt: "2026-10-21T09:00:00.000Z" },
    { id: "a1", actor: { id: "u9", role: "root", label: "Quản trị" }, action: "team.approve", target: { type: "team", id: "t1", label: "Đội t1" }, subjectUserId: "u2", reason: null, meta: {}, status: "ok", createdAt: "2026-10-21T08:00:00.000Z" },
  ];
  await mockCommunityApi(page, { user: ADMIN, auditItems });
  await page.goto("/quan-tri/#nhat-ky");
  const vi = page.getByRole("region", { name: "Nhật ký", exact: true }).locator(".adm-audit");
  await expect(vi.nth(0)).toContainText("Mở mùa mới");
  await expect(vi.nth(0)).toContainText("Đối tượng: mùa · Mùa 2");
  await expect(vi.nth(1)).toContainText("Duyệt đội cộng đồng");
  await expect(vi.nth(1)).toContainText("Đối tượng: đội cộng đồng · Đội t1");
  await page.goto("/zh/quan-tri/#nhat-ky");
  const zh = page.getByRole("region", { name: "日志", exact: true }).locator(".adm-audit");
  await expect(zh.nth(0)).toContainText("开启新赛季");
  await expect(zh.nth(0)).toContainText("对象：赛季 · Mùa 2");
  await expect(zh.nth(1)).toContainText("通过社区阵容");
  await expect(zh.nth(1)).toContainText("对象：社区阵容 · Đội t1");
});

test("quản trị: link từ hàng chờ bình luận/chiến báo với page /doi-cong-dong/<id>/ mở /doi-cong-dong/?id=<id>", async ({ page }) => {
  await mockCommunityApi(page, {
    user: ADMIN,
    adminComments: [{ id: "c1", page: "/doi-cong-dong/t1/", lang: "vi", body: "Bình luận", createdAt: "2026-10-12T08:00:00.000Z", author: AUTHOR, canDelete: true }],
    adminReports: [{
      id: "r7", result: "loss", allyHeroes: ["刘备"], enemyHeroes: ["曹操"], note: null, season: null, lang: "zh",
      imageUrl: null, createdAt: "2026-09-25T08:00:00.000Z", author: AUTHOR, page: "/doi-cong-dong/t1/", status: "pending", rejectReason: null,
    }],
  });
  await page.goto("/quan-tri/#chien-bao");
  await expect(page.locator("#adm-panel-reports .adm-path")).toHaveAttribute("href", "/zh/doi-cong-dong/?id=t1");
  await page.goto("/quan-tri/#binh-luan");
  await expect(page.locator("#adm-panel-comments .adm-path")).toHaveAttribute("href", "/doi-cong-dong/?id=t1");
});
