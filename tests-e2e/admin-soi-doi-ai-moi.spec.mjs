import { test, expect } from "@playwright/test";
import { ADMIN, PNG_1X1, mockCommunityApi } from "./helpers/community-mock.mjs";

// Khu Soi đội (#soi-doi) và AI (#ai) của /quan-tri/ theo artboard AdminAnalyze · AdminAIFeatures.
// Mock chung chưa có `/api/admin/scan-*`: route riêng ở đây (route đăng ký sau được xét trước).

const read = (nameCn, tacticsCn, booksCn = []) => ({ nameCn, tacticsCn, booksCn, statFocusCn: "" });

/**
 * Mẫu chờ duyệt: tướng 1 đủ tên thật (có binh thư), không ô nào sửa. Tướng 2: AI chép 3 dòng chiến pháp (dòng đầu là
 * chiến pháp tự mang 神射 của Thái Sử Từ, bị bỏ như ở Soi đội) — ô A giữ nguyên, ô B đổi id; bỏ trống binh thư không
 * hiện vì AI không chép binh thư. Tướng 3: id tướng và binh thư lạ, ô A để trống (AI đọc không rõ), ô B giữ nguyên.
 */
const PENDING_SAMPLE = {
  id: "s1",
  screen: "battleReport",
  side: "left",
  lang: "vi",
  status: "pending",
  hasImage: true,
  createdAt: "2026-11-10T14:42:00.000Z",
  author: { name: "Tiểu Tướng Quân", image: null },
  aiRead: { heroes: [
    read("诸葛恪", ["武锋阵", "盛气凌敌"], ["兵行诡道"]),
    read("太史慈", ["神射", "摧锋断刃", "速乘其利"]),
    read("左慈", ["骁军定北", "临机制胜"]),
  ] },
  confirmed: { heroes: [
    { hero: "hero:gia-cat-khac", tactics: ["tactic:vo-phong-tran", "tactic:thinh-khi-linh-dich"], book: "book:binh-hanh-quy-dao" },
    // Ô A lưu id cũ `tactic:pha-phong-doan-nhan` (lookup.formerIds của Thôi Phong Đoạn Nhẫn): cùng chiến pháp AI đọc.
    { hero: "hero:thai-su-tu", tactics: ["tactic:pha-phong-doan-nhan", "tactic:vo-duong-phi-quan"], book: null },
    { hero: "hero:khong-co-that", tactics: [null, "tactic:thoi-co-chien-thang"], book: "book:khong-co-that" },
  ] },
};
const APPROVED_SAMPLE = { ...PENDING_SAMPLE, id: "s2", status: "approved" };
const STATS = [
  { screen: "battleReport", side: "left", events: 412, read: 1000, edited: 68, unclear: 21 },
  { screen: "other", side: "left", events: 1412, read: 350, edited: 50, unclear: 21 },
];

async function mockScan(page, { counts = { scanPending: 4 } } = {}) {
  const requests = [];
  await page.route((url) => url.pathname === "/api/admin/counts", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ reportsPending: 0, postsDraft: 0, feedbackNew: 0, feedbackDone: 0, teamsPending: 0, ...counts }),
  }));
  await page.route((url) => url.pathname === "/api/admin/scan-stats", (route) => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ days: 30, rows: STATS }),
  }));
  await page.route((url) => url.pathname === "/api/admin/scan-samples", (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    requests.push(status);
    const items = [PENDING_SAMPLE, APPROVED_SAMPLE].filter((sample) => sample.status === status);
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ items, nextCursor: null }) });
  });
  await page.route((url) => /^\/api\/admin\/scan-samples\/[^/]+\/image$/.test(url.pathname), (route) => route.fulfill({
    contentType: "image/png", body: PNG_1X1,
  }));
  return requests;
}

test("Soi đội: đội xác nhận hiện tên tiếng Việt theo id, id lạ hiện id kèm nhãn chưa tra được", async ({ page }) => {
  await mockCommunityApi(page, { user: ADMIN });
  await mockScan(page);
  await page.goto("/quan-tri/#soi-doi");
  const panel = page.getByRole("region", { name: "Soi đội", exact: true });
  const sample = panel.locator('.adm-scan-sample[data-sample-id="s1"]');
  const table = sample.getByRole("table");
  await expect(table.getByRole("columnheader", { name: "Người dùng xác nhận" })).toBeVisible();
  const rows = table.locator("tbody > tr");
  await expect(rows).toHaveCount(3);

  // Tướng / chiến pháp / binh thư thật: tên Việt theo dữ liệu, không còn id thô.
  const first = rows.nth(0).getByRole("cell").nth(1);
  await expect(first.getByRole("listitem")).toHaveText(["Gia Cát Khác", "Võ Phong Trận", "Thịnh Khí Linh Địch", "Binh Hành Quỷ Đạo"]);
  await expect(first).not.toContainText("hero:");
  await expect(rows.nth(0).getByRole("cell").nth(0).getByRole("listitem")).toHaveText(["诸葛恪", "武锋阵", "盛气凌敌", "兵行诡道"]);

  // 3 dòng chiến pháp: cột AI đọc bỏ dòng tự mang như Soi đội; ô A không đổi thì không "đã sửa" (kể cả khi mẫu lưu
  // id cũ trong formerIds — hiện tên hiện hành), ô B đổi id thì có.
  await expect(rows.nth(1).getByRole("cell").nth(0).getByRole("listitem")).toHaveText(["太史慈", "摧锋断刃", "速乘其利"]);
  const second = rows.nth(1).getByRole("cell").nth(1);
  await expect(second.getByRole("listitem")).toHaveText(["Thái Sử Từ", "Thôi Phong Đoạn Nhẫn", "Vô Đương Phi Quân đã sửa"]);
  await expect(second.locator(".is-edited")).toHaveCount(1);
  await expect(rows.nth(0).locator(".is-edited")).toHaveCount(0);

  // Id lạ: giữ id + nhãn "chưa tra được" (title giải thích); ô hợp lệ cùng hàng vẫn ra tên. Ô tướng id lạ khác tướng AI
  // đọc chắc (左慈) vẫn là ô đã sửa như cột "% ô sửa". Ô AI đọc không rõ (骁军定北 không có trong dữ liệu) mà người
  // dùng để trống thì không tính là sửa; binh thư AI không chép thì không tính.
  const third = rows.nth(2).getByRole("cell").nth(1);
  const unknown = third.locator(".is-unresolved");
  await expect(unknown).toHaveCount(2);
  await expect(unknown.first()).toContainText("hero:khong-co-that");
  await expect(unknown.first()).toContainText("chưa tra được");
  await expect(unknown.first()).toHaveAttribute("title", /Không tra được tên/);
  await expect(unknown.first()).toHaveText("hero:khong-co-that chưa tra được đã sửa");
  await expect(unknown.first()).toHaveClass(/is-edited/);
  await expect(third.getByRole("listitem").nth(1)).toHaveText("Để trống");
  await expect(third).toContainText("Thời Cơ Chiến Thắng");
  await expect(third).toContainText("book:khong-co-that");
  await expect(third.locator(".is-edited")).toHaveCount(1);
  await expect(rows.nth(2).getByRole("rowheader")).toHaveText("Tướng 3");

  // Bảng tỷ lệ: phần trăm theo locale, số căn phải; dòng số ảnh chờ duyệt lấy từ /api/admin/counts.
  const stats = panel.getByRole("region", { name: "Tỷ lệ sửa / không rõ (ẩn danh)" }).getByRole("table");
  await expect(stats.locator("tbody tr").first()).toContainText("6,8%");
  await expect(stats.locator("tbody tr").nth(1)).toContainText("1.412");
  await expect(panel.getByText("4 ảnh chờ duyệt")).toBeVisible();
});

test("Soi đội mobile 390: bảng tỷ lệ và bảng đối chiếu xếp dọc, không tràn ngang", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCommunityApi(page, { user: ADMIN });
  await mockScan(page);
  await page.goto("/quan-tri/#soi-doi");
  const panel = page.getByRole("region", { name: "Soi đội", exact: true });
  const sample = panel.locator('.adm-scan-sample[data-sample-id="s1"]');
  await expect(sample.locator("tbody > tr").nth(2).getByRole("rowheader")).toBeVisible();
  await expect(sample.locator(".is-unresolved").first()).toBeVisible();
  await expect(panel.getByRole("group", { name: "Trạng thái" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Soi đội: bộ lọc Trạng thái là nhóm nút chọn một, đổi nhóm thì tải đúng trạng thái", async ({ page }) => {
  await mockCommunityApi(page, { user: ADMIN });
  const requests = await mockScan(page);
  await page.goto("/quan-tri/#soi-doi");
  const panel = page.getByRole("region", { name: "Soi đội", exact: true });
  const group = panel.getByRole("group", { name: "Trạng thái" });
  const pending = group.getByRole("button", { name: "Chờ duyệt" });
  const approved = group.getByRole("button", { name: "Đã duyệt" });
  await expect(pending).toHaveAttribute("aria-pressed", "true");
  await expect(approved).toHaveAttribute("aria-pressed", "false");
  await expect(panel.locator(".adm-scan-sample")).toHaveCount(1);
  await expect(panel.getByRole("button", { name: "Duyệt", exact: true })).toBeVisible();

  await approved.click();
  await expect(approved).toHaveAttribute("aria-pressed", "true");
  await expect(pending).toHaveAttribute("aria-pressed", "false");
  await expect(panel.locator('.adm-scan-sample[data-sample-id="s2"]')).toBeVisible();
  await expect(panel.getByRole("button", { name: "Tải fixture" })).toBeVisible();
  expect(requests).toEqual(["pending", "approved"]);
});

test("Soi đội bản Trung: tên xác nhận theo chữ Hán của dữ liệu", async ({ page }) => {
  await mockCommunityApi(page, { user: ADMIN });
  await mockScan(page);
  await page.goto("/zh/quan-tri/#soi-doi");
  const sample = page.locator('.adm-scan-sample[data-sample-id="s1"]');
  const first = sample.locator("tbody > tr").first().getByRole("cell").nth(1);
  await expect(first.getByRole("listitem").first()).toHaveText("諸葛恪");
  await expect(first).toContainText("武鋒陣");
  await expect(sample.locator("tbody > tr").nth(2)).toContainText("未能识别");
});

/* ---------- AI: phần Tính năng ---------- */

const LINK = (providerId, modelId, effort = "off") => ({ providerId, modelId, effort });
const AI_CONFIG = {
  providers: [
    { id: "ds", label: "DeepSeek", preset: "deepseek", endpoint: "https://api.deepseek.com/chat/completions", apiKey: "sk-a1f3", enabled: true, extraModels: [] },
    { id: "off", label: "Dự phòng", preset: "", endpoint: "https://api.example-ai.com/v1/chat/completions", apiKey: "sk-47d0", enabled: false,
      extraModels: [{ modelId: "vision-lite", vision: true, effortStyle: "none", efforts: ["default"] }] },
  ],
  groups: {
    teamScan: { chain: [LINK("ds", "deepseek-flash"), LINK("off", "vision-lite", "default")], timeoutMs: 45_000, budgetMs: 90_000 },
    rosterRecommend: { chain: [LINK("ds", "deepseek-flash")], timeoutMs: 60_000, budgetMs: 120_000 },
    explainSubstitute: { chain: [], timeoutMs: 30_000, budgetMs: 60_000 },
    battleReport: { chain: [LINK("off", "vision-lite", "default")], timeoutMs: 45_000, budgetMs: 45_000 },
  },
};

test("AI: thẻ tóm tắt suy trạng thái từ cấu hình, cảnh báo mắt xích dùng nhà cung cấp tắt, hai nút Lưu", async ({ page }) => {
  const calls = await mockCommunityApi(page, { user: ADMIN, aiConfig: structuredClone(AI_CONFIG) });
  await page.goto("/quan-tri/#ai");
  const panel = page.getByRole("region", { name: "AI", exact: true });
  const summary = panel.getByRole("list", { name: "Tình trạng từng tính năng" });
  const cards = summary.getByRole("button");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText("Chạy được");
  await expect(cards.nth(0)).toContainText("2 mắt xích · trần 90 s");
  // Chuỗi rỗng hoặc chỉ còn nhà cung cấp đang tắt: báo lỗi.
  await expect(cards.nth(2)).toContainText("Báo lỗi");
  await expect(cards.nth(3)).toContainText("Báo lỗi");
  await expect(panel.locator('[data-group="battleReport"]')).toContainText("Chưa cấu hình — tính năng báo lỗi");

  const scan = panel.locator('[data-group="teamScan"]');
  await expect(scan).toContainText("Lỗi hoặc hết timeout thì thử mắt xích 2");
  await expect(scan.locator('[data-link="1"]')).toContainText("Nhà cung cấp đang tắt: mắt xích này bị bỏ qua khi chạy.");
  await expect(scan.locator('[data-link="0"]')).not.toContainText("Nhà cung cấp đang tắt");
  await expect(scan.getByLabel("Model của mắt xích 1")).toHaveValue("deepseek-flash");

  // Bật nhà cung cấp tắt: nhóm Đọc ảnh chiến báo chạy được ngay, có dòng báo thay đổi chưa lưu.
  await panel.getByRole("list", { name: "Nhà cung cấp", exact: true }).locator(":scope > li").nth(1).getByRole("button", { name: "Bật" }).click();
  await expect(cards.nth(3)).toContainText("Chạy được");
  await expect(panel.getByRole("status")).toHaveText("Có thay đổi chưa lưu — bấm Lưu để áp dụng.");

  // Thẻ tóm tắt đưa tới thẻ nhóm mà không đổi hash của khu.
  await cards.nth(1).click();
  await expect(panel.locator("#cm-ai-group-rosterRecommend-title")).toBeFocused();
  await expect(page).toHaveURL(/#ai$/);

  // Nút Lưu ở thanh cuối ghi cấu hình như nút đầu khu.
  const saves = panel.getByRole("button", { name: "Lưu", exact: true });
  await expect(saves).toHaveCount(2);
  await saves.last().click();
  await expect(panel.getByRole("status")).toContainText("Đã lưu");
  expect(calls.filter((call) => call.method === "PUT")).toHaveLength(1);
});

test("AI mobile: thẻ nhóm thu gọn được, lỗi ở nhóm đang thu thì mở nhóm và đưa focus vào ô lỗi", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await mockCommunityApi(page, { user: ADMIN, aiConfig: structuredClone(AI_CONFIG) });
  await page.goto("/quan-tri/#ai");
  const panel = page.getByRole("region", { name: "AI", exact: true });
  await expect(panel.getByRole("list", { name: "Tình trạng từng tính năng" })).toBeHidden();
  const toggle = (id) => panel.locator(`[data-group="${id}"] [data-action="toggle-group"]`);
  await expect(toggle("teamScan")).toHaveAttribute("aria-expanded", "true");
  await expect(toggle("battleReport")).toHaveAttribute("aria-expanded", "false");
  await expect(toggle("battleReport")).toContainText("1 mắt xích · timeout 45 s · trần 45 s");
  await expect(panel.locator("#cm-ai-group-battleReport-body")).toBeHidden();
  await expect(panel.getByLabel("Nhà cung cấp của mắt xích 1").first()).toBeVisible();

  await toggle("battleReport").click();
  await expect(toggle("battleReport")).toHaveAttribute("aria-expanded", "true");
  await expect(toggle("battleReport")).toBeFocused();
  await panel.locator("#cm-ai-battleReport-budget").fill("10");
  await toggle("battleReport").click();
  await expect(panel.locator("#cm-ai-group-battleReport-body")).toBeHidden();

  await panel.getByRole("button", { name: "Lưu", exact: true }).first().click();
  await expect(panel.getByRole("status")).toContainText("trần tổng phải là số giây nguyên");
  await expect(panel.locator("#cm-ai-battleReport-budget")).toBeFocused();
  await expect(panel.locator("#cm-ai-battleReport-budget")).toHaveAttribute("aria-invalid", "true");
  expect(calls.some((call) => call.method === "PUT")).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("AI: qua mốc 680px khi đang ở một ô của chuỗi thì focus giữ đúng ô sau khi vẽ lại", async ({ page }) => {
  await mockCommunityApi(page, { user: ADMIN, aiConfig: structuredClone(AI_CONFIG) });
  await page.goto("/quan-tri/#ai");
  const panel = page.getByRole("region", { name: "AI", exact: true });
  const budget = panel.locator("#cm-ai-battleReport-budget");
  await budget.focus();

  // Desktop → hẹp: nhóm Đọc ảnh chiến báo (mặc định thu ở mobile) được mở sẵn, focus vẫn ở ô Trần tổng.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.locator('[data-group="battleReport"] [data-action="toggle-group"]')).toHaveAttribute("aria-expanded", "true");
  await expect(panel.locator("#cm-ai-battleReport-budget")).toBeFocused();

  // Hẹp → desktop với focus ở nút Bỏ của mắt xích: vẽ lại vẫn focus nút đó.
  const remove = panel.locator('[data-group="teamScan"] [data-link="1"] [data-action="remove"]');
  await remove.focus();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(panel.locator(".adm-ai-chain-head").first()).toBeVisible();
  await expect(panel.locator('[data-group="teamScan"] [data-link="1"] [data-action="remove"]')).toBeFocused();

  // Nút thu gọn không còn ở desktop: focus về tiêu đề nhóm.
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.locator('[data-group="rosterRecommend"] [data-action="toggle-group"]').focus();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(panel.locator("#cm-ai-group-rosterRecommend-title")).toBeFocused();
});
