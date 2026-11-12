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
