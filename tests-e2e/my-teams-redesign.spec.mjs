// "Đội của tôi" theo artboard DoiCuaToi (+ Mobile): trạng thái khách / đăng nhập / hộp chưa có kho / hộp có kho, xóa hộp ·
// nhóm · đội luôn hỏi lại bằng hộp xác nhận trong trang (`confirmInPage`, không `window.confirm`): Hủy và Escape không
// xóa và trả focus về nút Xóa, Xóa có xóa và focus sang chỗ còn lại; 390px không tràn ngang.
// `/api/roster` đi qua máy chủ giả kiểm bằng schema thật của Worker (tests-e2e/helpers/roster-mock.mjs).
import { test, expect } from "@playwright/test";
import { createRosterServer } from "../tests-js/support/roster-fake-server.mjs";
import { fromRecommended } from "../js/my-teams-sources.js";
import { ids, recommendedById } from "../tests-js/support/my-teams-fixtures.mjs";
import { ALICE, mockRoster, seedBox, seedTeam } from "./helpers/roster-mock.mjs";

const draftOf = (id, configId = "s27-han-hanshi-gong-1") => fromRecommended(recommendedById(configId), ids, { id }).draft;
const card = (page, id) => page.locator(`.mt-team[data-team-id="${id}"]`);
const confirmBox = (page) => page.locator("dialog.hop-xac-nhan");
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Hộp main (+ `boxes` khác), nhóm tự đặt tùy chọn, đội và kho; mở trang và chờ thẻ đội đầu tiên (nếu có). */
async function open(page, { teams = [], boxes = ["main"], groups = [], owned = [], path = "/doi-cua-toi/" } = {}) {
  const server = await createRosterServer({ userId: ALICE.id });
  for (const boxId of boxes) await seedBox(server, boxId);
  const at = Date.now() - 90_000;
  const iso = new Date(at).toISOString();
  for (const group of groups) {
    await server.seed({ kind: "group", id: group.id, updatedAt: at, deleted: false, data: { id: group.id, boxId: group.boxId ?? "main", name: group.name, order: 5, updatedAt: iso, deletedAt: "" } });
  }
  for (const entry of teams) await seedTeam(server, entry.draft, entry.options);
  for (const item of owned) {
    await server.seed({ kind: "owned", id: `main~${item}`, updatedAt: at, deleted: false, data: { id: `main~${item}`, boxId: "main", item, name: item, type: item.startsWith("hero:") ? "hero" : "tactic", updatedAt: iso, deletedAt: "" } });
  }
  const mock = await mockRoster(page, { server });
  // Mọi xác nhận phải nằm trong trang: hộp thoại native của trình duyệt là lỗi.
  page.on("dialog", (dialog) => {
    throw new Error(`Không được dùng hộp thoại native (${dialog.type()}): ${dialog.message()}`);
  });
  await page.goto(path);
  await expect(page.locator(".mt-boxbar")).toBeVisible();
  return mock;
}

test.describe("trạng thái theo artboard", () => {
  test("khách: thẻ mời đăng nhập + lối vào 5 trang nguồn, không gọi /api/roster", async ({ page }) => {
    const mock = await mockRoster(page, { signedIn: false });
    await page.goto("/doi-cua-toi/");
    const guest = page.locator("#my-teams .mt-guest");
    await expect(guest.getByRole("heading", { name: "Đăng nhập để mở Đội của tôi" })).toBeVisible();
    await expect(guest.getByRole("button", { name: "Đăng nhập bằng Google" })).toBeVisible();
    await expect(guest).toContainText("tự lưu đúng một lần sau khi đăng nhập");
    await expect(page.locator(".mt-sources").getByRole("link")).toHaveText(["Đội chuẩn", "Đội khác", "Khai hoang", "Gợi ý đội", "Soi đội"]);
    await expect(page.locator(".mt-boxbar")).toHaveCount(0);
    expect(mock.calls.filter((call) => call.path === "/api/roster")).toEqual([]);
  });

  test("đăng nhập, hộp chưa có kho: thanh hộp báo chưa có kho, không nhãn thiếu món / ráp được", async ({ page }) => {
    await open(page, { teams: [{ draft: draftOf("team-a") }] });
    await expect(page.locator(".mt-boxinfo")).toHaveAttribute("data-stock", "no");
    await expect(page.locator(".mt-boxinfo")).toContainText("Hộp này chưa có kho.");
    await expect(page.locator(".mt-boxinfo").getByRole("link", { name: "Nhập kho ở Gợi ý đội" })).toHaveAttribute("href", "/goi-y-doi-tu-kho/");
    await expect(page.locator("#mt-box option:checked")).toHaveText("Hộp chính · 1 đội");
    await expect(card(page, "team-a").locator(".mt-miss, .mt-badge-short, .mt-badge-ready")).toHaveCount(0);
    await expect(page.locator(".mt-boxlock")).toHaveText("Hộp chính không xóa được");
    await expect(page.locator(".mt-group-default")).toHaveCount(2);
    await expect(page.locator(".mt-privacy")).toContainText("luôn hỏi lại trước khi xóa");
  });

  test("đăng nhập, hộp có kho: đếm kho, “Thiếu n món” + “chưa có trong kho”, đội đủ món thì “Ráp được”", async ({ page }) => {
    const short = draftOf("team-short");
    const ready = { ...draftOf("team-ready"), name: "Đủ món" };
    const items = ready.heroes.flatMap((hero) => [hero.hero, ...hero.tactics.map((slot) => slot.primary)]).filter(Boolean);
    // Đội "short" cùng nguồn nên cùng món: bỏ tướng đầu khỏi kho bằng cách đổi tướng đầu của nó sang một tướng khác.
    short.heroes[0] = { ...short.heroes[0], hero: "hero:ta-tu" };
    await open(page, { teams: [{ draft: short }, { draft: ready }], owned: items });
    const heroes = items.filter((item) => item.startsWith("hero:")).length;
    const tactics = items.length - heroes;
    await expect(page.locator(".mt-boxinfo")).toHaveAttribute("data-stock", "yes");
    await expect(page.locator(".mt-boxinfo-main")).toHaveText(`Kho của hộp: ${heroes} tướng · ${tactics} chiến pháp`);
    await expect(card(page, "team-short").locator(".mt-badge-short")).toHaveText("Thiếu 1 món trong kho");
    await expect(card(page, "team-short").locator("tbody tr").first().locator(".mt-miss")).toHaveText("chưa có trong kho");
    await expect(card(page, "team-ready").locator(".mt-badge-ready")).toHaveText("Ráp được");
    // Trình soạn: viên kho theo tướng + dòng tóm tắt món thiếu.
    await card(page, "team-short").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    await expect(form.locator(".mt-edit-hero").first().locator(".mt-pill")).toHaveText("1 món chưa có trong kho");
    await expect(form.locator(".mt-editor-sum")).toContainText("1 món chưa có trong kho: Tả Từ. Vẫn lưu được.");
    // Trình soạn mở tại chỗ: thẻ đội khác vẫn ở danh sách.
    await expect(card(page, "team-ready")).toBeVisible();
  });
});

test.describe("xóa luôn hỏi lại trong trang", () => {
  test("xóa đội: Hủy và Escape không xóa, focus về nút Xóa; Xóa có xóa, focus sang tên nhóm", async ({ page }) => {
    const mock = await open(page, { teams: [{ draft: draftOf("team-del") }, { draft: draftOf("team-keep", "s27-han-hanshi-gong-1") }] });
    const remove = card(page, "team-del").getByRole("button", { name: "Xóa", exact: true });

    await remove.click();
    const box = confirmBox(page);
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute("role", "alertdialog");
    await expect(box.getByRole("heading")).toHaveText(/Xóa đội “.+”\?/u);
    await expect(box.getByRole("button", { name: "Hủy" })).toBeFocused();
    await box.getByRole("button", { name: "Hủy" }).click();
    await expect(box).toHaveCount(0);
    await expect(card(page, "team-del")).toBeVisible();
    await expect(remove).toBeFocused();

    await remove.click();
    await expect(confirmBox(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirmBox(page)).toHaveCount(0);
    await expect(card(page, "team-del")).toBeVisible();
    await expect(remove).toBeFocused();
    expect(mock.server.live("team").map((row) => row.id).sort()).toEqual(["team-del", "team-keep"]);

    await remove.click();
    await confirmBox(page).getByRole("button", { name: "Xóa đội" }).click();
    await expect(confirmBox(page)).toHaveCount(0);
    await expect(card(page, "team-del")).toHaveCount(0);
    await expect(page.locator('[data-group-id="main~ghep-team"] .mt-group-name')).toBeFocused();
    await expect.poll(() => mock.server.live("team").map((row) => row.id)).toEqual(["team-keep"]);
  });

  test("xóa đội thất bại: hộp giữ mở, nêu lý do bằng role=alert; Hủy thì đội còn", async ({ page }) => {
    const mock = await open(page, { teams: [{ draft: draftOf("team-fail") }] });
    mock.failPosts(50, 500);
    await card(page, "team-fail").getByRole("button", { name: "Xóa", exact: true }).click();
    const box = confirmBox(page);
    await box.getByRole("button", { name: "Xóa đội" }).click();
    await expect(box.getByRole("alert")).toBeVisible();
    await expect(box).toBeVisible();
    mock.failPosts(0);
    await box.getByRole("button", { name: "Hủy" }).click();
    await expect(box).toHaveCount(0);
  });

  test("xóa nhóm: Hủy và Escape không xóa, focus về nút Xóa nhóm; Xóa có xóa, đội về Ghép Team, focus sang Ghép Team", async ({ page }) => {
    const mock = await open(page, {
      teams: [{ draft: draftOf("team-in-group"), options: { groupId: "grp-cong-thanh" } }],
      groups: [{ id: "grp-cong-thanh", name: "Công thành" }],
    });
    const group = page.locator('.mt-group[data-group-id="grp-cong-thanh"]');
    const remove = group.getByRole("button", { name: "Xóa nhóm" });

    await remove.click();
    await expect(confirmBox(page)).toContainText("1 đội trong nhóm sẽ chuyển về Ghép Team");
    await confirmBox(page).getByRole("button", { name: "Hủy" }).click();
    await expect(remove).toBeFocused();

    await remove.click();
    await page.keyboard.press("Escape");
    await expect(confirmBox(page)).toHaveCount(0);
    await expect(group).toBeVisible();
    await expect(remove).toBeFocused();

    await remove.click();
    await confirmBox(page).getByRole("button", { name: "Xóa nhóm" }).click();
    await expect(group).toHaveCount(0);
    await expect(page.locator('[data-group-id="main~ghep-team"] .mt-team')).toHaveCount(1);
    await expect(page.locator('[data-group-id="main~ghep-team"] .mt-group-name')).toBeFocused();
    await expect.poll(() => mock.server.live("team")[0].data.groupId).toBe("main~ghep-team");
  });

  test("xóa hộp: Hủy và Escape không xóa, focus về nút Xóa hộp; Xóa có xóa, về Hộp chính, focus ô chọn hộp", async ({ page }) => {
    const mock = await open(page, { boxes: ["main", "box-phu"], teams: [{ draft: draftOf("team-phu"), options: { boxId: "box-phu", groupId: "box-phu~ghep-team" } }] });
    await page.locator("#mt-box").selectOption("box-phu");
    const remove = page.getByRole("button", { name: "Xóa hộp" });

    await remove.click();
    await expect(confirmBox(page)).toContainText("mất 1 đội");
    await confirmBox(page).getByRole("button", { name: "Hủy" }).click();
    await expect(remove).toBeFocused();

    await remove.click();
    await page.keyboard.press("Escape");
    await expect(confirmBox(page)).toHaveCount(0);
    await expect(remove).toBeFocused();
    await expect(page.locator("#mt-box")).toHaveValue("box-phu");

    await remove.click();
    await confirmBox(page).getByRole("button", { name: "Xóa hộp" }).click();
    await expect(page.locator("#mt-box")).toHaveValue("main");
    await expect(page.locator("#mt-box")).toBeFocused();
    await expect.poll(() => mock.server.live("box").map((row) => row.id)).toEqual(["main"]);
  });
});

test.describe("không mất bản soạn", () => {
  const nameField = (page) => page.locator("form.mt-editor").getByLabel("Tên đội");
  const discardBox = (page) => confirmBox(page).filter({ hasText: "Bỏ thay đổi chưa lưu?" });

  test("đổi ô Hộp khi đang sửa: có thay đổi thì hỏi, Hủy giữ bản soạn và hộp; không thay đổi thì đổi luôn", async ({ page }) => {
    await open(page, { boxes: ["main", "box-phu"], teams: [{ draft: draftOf("team-x") }] });
    await card(page, "team-x").getByRole("button", { name: "Sửa", exact: true }).click();
    await nameField(page).fill("Tên đang sửa");
    await page.locator("#mt-box").selectOption("box-phu");
    await expect(discardBox(page)).toBeVisible();
    await discardBox(page).getByRole("button", { name: "Hủy" }).click();
    await expect(page.locator("#mt-box")).toHaveValue("main");
    await expect(nameField(page)).toHaveValue("Tên đang sửa");

    await page.locator("#mt-box").selectOption("box-phu");
    await discardBox(page).getByRole("button", { name: "Bỏ thay đổi" }).click();
    await expect(page.locator("#mt-box")).toHaveValue("box-phu");
    await expect(page.locator("form.mt-editor")).toHaveCount(0);

    // Không thay đổi: không hỏi.
    await page.locator("#mt-box").selectOption("main");
    await card(page, "team-x").getByRole("button", { name: "Sửa", exact: true }).click();
    await expect(page.locator("form.mt-editor")).toBeVisible();
    await page.locator("#mt-box").selectOption("box-phu");
    await expect(page.locator("#mt-box")).toHaveValue("box-phu");
    await expect(confirmBox(page)).toHaveCount(0);
    await expect(page.locator("form.mt-editor")).toHaveCount(0);
  });

  test("bấm Sửa đội khác khi đang sửa: có thay đổi thì hỏi, Hủy giữ bản soạn; không thay đổi thì mở luôn", async ({ page }) => {
    await open(page, { teams: [{ draft: draftOf("team-a") }, { draft: draftOf("team-b") }] });
    await card(page, "team-a").getByRole("button", { name: "Sửa", exact: true }).click();
    await nameField(page).fill("Bản soạn A");
    await card(page, "team-b").getByRole("button", { name: "Sửa", exact: true }).click();
    await discardBox(page).getByRole("button", { name: "Hủy" }).click();
    await expect(page.locator("form.mt-editor")).toHaveAttribute("data-team-id", "team-a");
    await expect(nameField(page)).toHaveValue("Bản soạn A");

    await card(page, "team-b").getByRole("button", { name: "Sửa", exact: true }).click();
    await discardBox(page).getByRole("button", { name: "Bỏ thay đổi" }).click();
    await expect(page.locator("form.mt-editor")).toHaveAttribute("data-team-id", "team-b");

    await card(page, "team-a").getByRole("button", { name: "Sửa", exact: true }).click();
    await expect(page.locator("form.mt-editor")).toHaveAttribute("data-team-id", "team-a");
    await expect(confirmBox(page)).toHaveCount(0);
  });

  test("Tạo hộp khi đang sửa: có thay đổi thì hỏi, Hủy không mở hộp thoại tạo; không thay đổi thì mở luôn", async ({ page }) => {
    await open(page, { teams: [{ draft: draftOf("team-c") }] });
    await card(page, "team-c").getByRole("button", { name: "Sửa", exact: true }).click();
    await nameField(page).fill("Bản soạn C");
    await page.getByRole("button", { name: "Tạo hộp", exact: true }).click();
    await discardBox(page).getByRole("button", { name: "Hủy" }).click();
    await expect(page.locator("dialog.mt-dialog")).toHaveCount(0);
    await expect(nameField(page)).toHaveValue("Bản soạn C");

    // Bỏ thay đổi: mở hộp thoại tạo; tạo xong thì sang hộp mới, trình soạn đóng.
    await page.getByRole("button", { name: "Tạo hộp", exact: true }).click();
    await discardBox(page).getByRole("button", { name: "Bỏ thay đổi" }).click();
    await page.locator("#mt-prompt-input").fill("Hộp mới");
    await page.locator("dialog.mt-dialog").getByRole("button", { name: "Tạo hộp", exact: true }).click();
    await expect(page.locator("#mt-box")).toHaveValue(/^box-/u);
    await expect(page.locator("form.mt-editor")).toHaveCount(0);

    // Không thay đổi: mở hộp thoại tạo luôn.
    await page.locator("#mt-box").selectOption("main");
    await card(page, "team-c").getByRole("button", { name: "Sửa", exact: true }).click();
    await page.getByRole("button", { name: "Tạo hộp", exact: true }).click();
    await expect(page.locator("dialog.mt-dialog")).toBeVisible();
    await expect(confirmBox(page)).toHaveCount(0);
  });

  test("Xóa hộp khi đang sửa có thay đổi: hỏi trước, Hủy giữ hộp và bản soạn; Bỏ thay đổi rồi xác nhận thì về Hộp chính", async ({ page }) => {
    const mock = await open(page, { boxes: ["main", "box-phu"], teams: [{ draft: draftOf("team-phu"), options: { boxId: "box-phu", groupId: "box-phu~ghep-team" } }] });
    await page.locator("#mt-box").selectOption("box-phu");
    await card(page, "team-phu").getByRole("button", { name: "Sửa", exact: true }).click();
    await nameField(page).fill("Bản soạn hộp phụ");
    await page.getByRole("button", { name: "Xóa hộp" }).click();
    await expect(discardBox(page)).toBeVisible();
    await discardBox(page).getByRole("button", { name: "Hủy" }).click();
    await expect(confirmBox(page)).toHaveCount(0);
    await expect(page.locator("#mt-box")).toHaveValue("box-phu");
    await expect(nameField(page)).toHaveValue("Bản soạn hộp phụ");
    expect(mock.server.live("box").map((row) => row.id).sort()).toEqual(["box-phu", "main"]);

    await page.getByRole("button", { name: "Xóa hộp" }).click();
    await discardBox(page).getByRole("button", { name: "Bỏ thay đổi" }).click();
    await confirmBox(page).filter({ hasText: "mất 1 đội" }).getByRole("button", { name: "Xóa hộp" }).click();
    await expect(page.locator("#mt-box")).toHaveValue("main");
    await expect(page.locator("form.mt-editor")).toHaveCount(0);
    await expect.poll(() => mock.server.live("box").map((row) => row.id)).toEqual(["main"]);
  });

  test("bấm Sửa trên thẻ của đội vừa bị xóa ở máy khác: không mở trình soạn, thẻ biến mất, không lỗi", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const mock = await open(page, { teams: [{ draft: draftOf("team-con") }, { draft: draftOf("team-mat") }] });
    // Đang sửa (không đổi gì): đồng bộ nền không vẽ lại danh sách, nên thẻ của đội bị xóa vẫn còn trên trang.
    await card(page, "team-con").getByRole("button", { name: "Sửa", exact: true }).click();
    await expect(page.locator("form.mt-editor")).toBeVisible();
    const at = Date.now();
    const iso = new Date(at).toISOString();
    await mock.server.seed({ kind: "team", id: "team-mat", updatedAt: at, deleted: true, data: { id: "team-mat", boxId: "main", updatedAt: iso, deletedAt: iso } });
    const pulls = mock.calls.filter((call) => call.method === "GET" && call.path === "/api/roster").length;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => mock.calls.filter((call) => call.method === "GET" && call.path === "/api/roster").length).toBeGreaterThan(pulls);
    await page.waitForTimeout(300);
    await expect(card(page, "team-mat")).toBeVisible();

    await card(page, "team-mat").getByRole("button", { name: "Sửa", exact: true }).click();
    await expect(card(page, "team-mat")).toHaveCount(0);
    await expect(page.locator("form.mt-editor")).toHaveCount(0);
    await expect(card(page, "team-con")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("xóa nhóm đang chứa đội đang sửa: trình soạn còn, lưu thì đội vào Ghép Team (không ghi id nhóm đã xóa)", async ({ page }) => {
    const mock = await open(page, {
      teams: [{ draft: draftOf("team-g"), options: { groupId: "grp-sap-xoa" } }],
      groups: [{ id: "grp-sap-xoa", name: "Sắp xóa" }],
    });
    await card(page, "team-g").getByRole("button", { name: "Sửa", exact: true }).click();
    await nameField(page).fill("Sửa xong");
    await page.locator('.mt-group[data-group-id="grp-sap-xoa"]').getByRole("button", { name: "Xóa nhóm" }).click();
    await confirmBox(page).getByRole("button", { name: "Xóa nhóm" }).click();
    await expect(page.locator('[data-group-id="grp-sap-xoa"]')).toHaveCount(0);
    await expect(nameField(page)).toHaveValue("Sửa xong");
    await page.locator("form.mt-editor").getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.locator("form.mt-editor")).toHaveCount(0);
    await expect(page.locator("#my-teams .mt-status")).toHaveText("Đã lưu thay đổi.");
    await expect.poll(() => mock.server.live("team")[0].data.name).toBe("Sửa xong");
    expect(mock.server.live("team")[0].data.groupId).toBe("main~ghep-team");
  });
});

test.describe("trình soạn và bảng chọn", () => {
  test("mùa cũ ngoài seasons.json giữ nguyên khi lưu; câu báo đã lưu ở vùng status", async ({ page }) => {
    const mock = await open(page, { teams: [{ draft: { ...draftOf("team-mua"), seasonId: "s0-mua-rat-cu" } }] });
    await card(page, "team-mua").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    await expect(form.getByLabel("Mùa")).toHaveValue("s0-mua-rat-cu");
    await form.getByLabel("Tên đội").fill("Đội mùa cũ");
    await form.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.locator("#my-teams .mt-status")).toHaveText("Đã lưu thay đổi.");
    await expect(card(page, "team-mua").locator(".mt-saved")).toHaveText("Đã lưu thay đổi.");
    await expect.poll(() => mock.server.live("team")[0].data.name).toBe("Đội mùa cũ");
    expect(mock.server.live("team")[0].data.seasonId).toBe("s0-mua-rat-cu");
  });

  test("đội thiếu dữ liệu không có “Ráp được” dù đủ kho; binh thư không có nhãn kho; tướng/chiến pháp có", async ({ page }) => {
    const full = draftOf("team-full");
    const items = full.heroes.flatMap((hero) => [hero.hero, ...hero.tactics.map((slot) => slot.primary)]).filter(Boolean);
    const partial = structuredClone({ ...full, id: "team-partial", name: "Thiếu ô" });
    partial.heroes[2].tactics[1] = { primary: null, alternatives: [], rawName: "" };
    await open(page, { teams: [{ draft: full }, { draft: partial }], owned: items });
    await expect(card(page, "team-full").locator(".mt-badge-ready")).toHaveText("Ráp được");
    await expect(card(page, "team-partial").locator(".mt-badge-ready, .mt-badge-short")).toHaveCount(0);

    await card(page, "team-full").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    await form.locator('[data-picker-key="0-books"]').click();
    const picker = form.locator(".mt-picker");
    await expect(picker.locator(".mt-picker-opt").first()).toBeVisible();
    await expect(picker.locator(".mt-miss, .mt-have")).toHaveCount(0);
    await picker.getByRole("button", { name: "Xong", exact: true }).click();
    await form.locator('[data-picker-key="0-t0"]').click();
    // Chiến pháp: mỗi món có nhãn kho (có / chưa có).
    await expect(form.locator(".mt-picker .mt-picker-opt").first().locator(".mt-miss, .mt-have")).toHaveCount(1);
  });

  test("bảng chọn: aria-controls, phím mũi tên, bộ lọc gọn (chip-loc), Bỏ khi bảng đang mở thì đóng bảng", async ({ page }) => {
    await open(page, { teams: [{ draft: draftOf("team-loc") }] });
    await card(page, "team-loc").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    const opener = form.locator('[data-picker-key="0-t0"]');
    await opener.click();
    const picker = form.locator(".mt-picker");
    await expect(opener).toHaveAttribute("aria-controls", (await picker.getAttribute("id")) ?? "");
    const search = picker.getByRole("searchbox", { name: "Tìm chiến pháp" });
    await expect(search).toHaveAttribute("aria-controls", (await picker.locator(".mt-picker-list").getAttribute("id")) ?? "");
    await expect(search).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(picker.locator(".mt-picker-opt").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(picker.locator(".mt-picker-opt").nth(1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(search).toBeFocused();

    // Bộ lọc gọn: thu gọn sẵn, mở ra là hàng chip; chọn "Bị động" thì mọi kết quả là chiến pháp bị động.
    const toggle = picker.locator(".mt-picker-filter-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAccessibleName("Bộ lọc");
    await expect(picker.locator(".mt-picker-filters")).toBeHidden();
    const before = await picker.locator(".mt-picker-hint").textContent();
    await toggle.click();
    await expect(picker.locator(".mt-picker-filters")).toBeVisible();
    const passive = picker.getByRole("group", { name: "Loại" }).getByRole("button", { name: "Bị động" });
    await passive.click();
    await expect(passive).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveAccessibleName("Bộ lọc (1 đang bật)");
    await expect(toggle.locator(".fchip-count")).toHaveText("1");
    await expect(picker.locator(".mt-picker-hint")).not.toHaveText(before ?? "");
    await expect(picker.getByRole("group", { name: "Thế lực" })).toHaveCount(0);

    // "Bỏ" món chính khi bảng của ô đó đang mở: bảng đóng, ô trống.
    await form.locator(".mt-edit-hero").first().locator(".mt-slot").nth(2).locator(".mt-slot-actions").getByRole("button", { name: /^Bỏ/ }).click();
    await expect(form.locator(".mt-picker")).toHaveCount(0);
    await expect(form.locator(".mt-edit-hero").first().locator(".mt-slot").nth(2).locator(".mt-slot-empty")).toBeVisible();
    await expect(form.locator('[data-picker-key="0-t0"]')).toBeFocused();
  });
});

test.describe("390px", () => {
  for (const locale of ["vi", "zh"]) {
    test(`không tràn ngang: khách, danh sách, trình soạn, bảng chọn, hộp xác nhận (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const prefix = locale === "zh" ? "/zh" : "";
      await mockRoster(page, { signedIn: false });
      await page.goto(`${prefix}/doi-cua-toi/`);
      await expect(page.locator(".mt-guest")).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);

      await page.unrouteAll({ behavior: "ignoreErrors" });
      await open(page, { teams: [{ draft: draftOf("team-m") }], groups: [{ id: "grp-dai-ten", name: "Nhóm có tên rất dài để thử xuống dòng ở màn hình hẹp" }], path: `${prefix}/doi-cua-toi/` });
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      const edit = locale === "zh" ? "编辑" : "Sửa";
      await card(page, "team-m").getByRole("button", { name: edit, exact: true }).click();
      const form = page.locator("form.mt-editor");
      await expect(form).toBeVisible();
      // Mobile: tướng là khung thu gọn, tướng 1 mở sẵn.
      await expect(form.locator("details.mt-edit-hero").first()).toHaveAttribute("open", "");
      await expect(form.locator("details.mt-edit-hero").nth(1)).not.toHaveAttribute("open", "");
      await form.locator('[data-picker-key="0-t1"]').click();
      await expect(form.locator(".mt-picker")).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page.keyboard.press("Escape");
      await expect(form.locator(".mt-picker")).toHaveCount(0);
      await expect(form.locator('[data-picker-key="0-t1"]')).toBeFocused();
      await form.getByRole("button", { name: locale === "zh" ? "取消" : "Hủy", exact: true }).click();
      await card(page, "team-m").getByRole("button", { name: locale === "zh" ? "删除" : "Xóa", exact: true }).click();
      await expect(confirmBox(page)).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }
});
