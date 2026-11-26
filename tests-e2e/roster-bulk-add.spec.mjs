// Gợi ý đội (/goi-y-doi-tu-kho/): thêm hàng loạt vào kho (#61).
// - "Tôi có tất cả món thiếu của đội này" ở mục Thiếu món: ghi vào kho đang dùng, đội chuyển sang đủ kho, có Hoàn tác.
// - "Dán danh sách tên" ở bảng chọn nhanh: đối chiếu → xem lại khớp / cần chọn / không nhận ra → xác nhận mới ghi.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildSeasonCandidates, recommendRoster } from "../js/roster-season-candidates.js";
import { ALICE, mockRoster, seedBox } from "./helpers/roster-mock.mjs";

const STORAGE_KEY = "tqccl.rosterRecommend.scanState.v1";
const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

async function waitForBoot(page) {
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
}

/** Gieo storage một lần cho mỗi ngữ cảnh: tải lại trang đọc đúng dữ liệu người dùng đã sửa. */
function seed(page, entries) {
  return page.addInitScript((rows) => {
    for (const [key, value] of Object.entries(rows)) {
      if (localStorage.getItem(key) !== null) continue;
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }, entries);
}

const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), STORAGE_KEY);

/**
 * Kho dựng từ đúng một Đội chuẩn của mùa mặc định, bỏ hai chiến pháp: đội nằm trong 5 thẻ đầu của mục Thiếu món
 * (đội thiếu ít đứng trước) với hai ô chiến pháp thiếu, và thêm đủ hai món thì đội "Có thể xây dựng ngay".
 */
function missingTwoFixture() {
  const { generationId } = read("src/data/recommended-reference/current.json");
  const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
  const { defaultSourceSeasonId } = read(`src/data/recommended-reference/${generationId}/seasons.json`);
  const tacticsDict = read("data/tactics.json");
  const season = buildSeasonCandidates(records, defaultSourceSeasonId, { heroesDict: read("data/heroes-dict.json"), tacticsDict });
  const recommend = (heroes, tactics) => recommendRoster({
    seasonTeams: season.teams,
    seasonTier: season.teamTier,
    legacyTeams: read("data/teams.json"),
    legacyTier: read("data/team-tier.json"),
    ownedHeroes: heroes.map((name) => ({ name })),
    ownedTactics: tactics.map((name) => ({ name })),
    lockedTeams: [],
    tacticsDict,
    mode: "meta",
    keepExistingTeams: true,
  });
  for (const team of season.teams.filter((item) => ["T0", "T0.5", "T1"].includes(item.tier))) {
    const heroes = team.heroes.map((hero) => hero.name);
    if (heroes.some((name) => name.includes("/"))) continue;
    const tactics = team.heroes.flatMap((hero) => hero.tactics.filter((tactic) => !tactic.unresolved && !(tactic.alternatives || []).length).map((tactic) => tactic.name));
    if (tactics.length < 4) continue;
    for (let i = 0; i < tactics.length; i++) {
      for (let j = i + 1; j < tactics.length; j++) {
        const dropped = [tactics[i], tactics[j]];
        const owned = tactics.filter((name) => !dropped.includes(name));
        const blocked = recommend(heroes, owned).blockedStrongTeams.slice(0, 5);
        const entry = blocked.find((item) => item.team.id === team.id);
        if (entry?.status !== "missing-tactic" || entry.missingTacticSlots.length !== 2) continue;
        const after = recommend(heroes, tactics).portfolioTeams.find((item) => item.team.id === team.id);
        if (after?.status !== "build-now") continue;
        return {
          team,
          dropped,
          state: {
            ownedHeroes: heroes.map((name) => ({ name })),
            ownedTactics: owned.map((name) => ({ name })),
            lockedTeams: [],
            confirmed: true,
            updatedAt: "2026-11-18T00:00:00.000Z",
          },
        };
      }
    }
  }
  throw new Error("no season team with two missing tactics in the first five Thiếu món cards");
}

const fixture = missingTwoFixture();

test.describe("Tôi có tất cả món thiếu của đội này", () => {
  test("khách: thêm đủ món thiếu vào kho local, đội chuyển sang Có thể xây dựng ngay; Hoàn tác gỡ đúng các món đó", async ({ page }) => {
    await seed(page, { [STORAGE_KEY]: fixture.state });
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    await expect(section.getByLabel("Mùa bạn đang chơi")).toBeEnabled();
    await section.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();

    const card = section.locator(".roster-missing").filter({ hasText: fixture.team.name });
    await expect(card.locator(".roster-pill").filter({ hasText: "Thiếu 2 món" })).toBeVisible();
    // Đội thiếu đúng một món không có nút thêm tất cả (đã có nút "Tôi có…" của món đó).
    for (const single of await section.locator(".roster-missing").filter({ hasText: "Thiếu 1 món" }).all()) {
      await expect(single.locator(".roster-add-all")).toHaveCount(0);
    }
    await card.getByRole("button", { name: `Tôi có tất cả món thiếu của đội này: ${fixture.team.name}, 2 món` }).click();

    const portfolio = section.locator(".roster-portfolio");
    const row = portfolio.locator(".roster-result-team").filter({ hasText: fixture.team.name });
    await expect(row.locator(".roster-status")).toHaveText("Có thể xây dựng ngay");
    await expect(section.locator(".roster-missing").filter({ hasText: fixture.team.name })).toHaveCount(0);
    const undoBar = section.locator(".roster-undo-bar");
    await expect(undoBar).toContainText(`Đã thêm 2 món của đội ${fixture.team.name} vào kho.`);
    await expect(undoBar).toBeFocused();
    const owned = (await stored(page)).ownedTactics.map((item) => item.name);
    for (const name of fixture.dropped) expect(owned).toContain(name);
    expect((await stored(page)).confirmed).toBe(true);

    await undoBar.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(undoBar).toHaveText("Đã gỡ 2 món vừa thêm.");
    await expect(section.locator(".roster-missing").filter({ hasText: fixture.team.name })).toBeVisible();
    await expect(portfolio.locator(".roster-result-team").filter({ hasText: fixture.team.name })).toHaveCount(0);
    expect((await stored(page)).ownedTactics.map((item) => item.name).sort()).toEqual(fixture.state.ownedTactics.map((item) => item.name).sort());
  });

  test("đã đăng nhập: ghi vào hộp đang chọn trên tài khoản, nêu tên hộp; Hoàn tác xoá đúng hai bản ghi", async ({ page }) => {
    const mock = await mockRoster(page, { user: ALICE });
    await seedBox(mock.server, "main");
    await seedBox(mock.server, "box-phu");
    // Dấu "có thể đang đăng nhập": trang chỉ hỏi `/api/me` khi có dấu này.
    await seed(page, { [STORAGE_KEY]: fixture.state, "tqccl:community-session": "1" });
    // Lần đầu có kho tài khoản: đồng ý gộp kho trên máy vào hộp chính.
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    await expect(section.locator(".roster-sync-status")).toHaveText(/Đã đồng bộ với tài khoản/);
    await expect(section.getByLabel("Hộp kho")).toHaveValue("main");
    const liveTactics = () => mock.server.live("owned").filter((row) => row.boxId === "main" && row.data.type === "tactic").map((row) => row.data.name);
    await expect.poll(() => liveTactics().length).toBe(fixture.state.ownedTactics.length);

    await section.getByRole("button", { name: "Xác nhận dữ liệu đã đọc" }).click();
    await section.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();
    const card = section.locator(".roster-missing").filter({ hasText: fixture.team.name });
    await card.getByRole("button", { name: `Tôi có tất cả món thiếu của đội này: ${fixture.team.name}, 2 món` }).click();
    const undoBar = section.locator(".roster-undo-bar");
    await expect(undoBar).toContainText(`Đã thêm 2 món của đội ${fixture.team.name} vào hộp “Hộp chính”.`);
    await expect(section.locator(".roster-portfolio .roster-result-team").filter({ hasText: fixture.team.name }).locator(".roster-status")).toHaveText("Có thể xây dựng ngay");
    await expect.poll(() => fixture.dropped.every((name) => liveTactics().includes(name))).toBe(true);
    expect(mock.server.live("owned").filter((row) => row.boxId === "box-phu")).toEqual([]);

    await undoBar.getByRole("button", { name: "Hoàn tác" }).click();
    await expect.poll(() => fixture.dropped.some((name) => liveTactics().includes(name))).toBe(false);
    expect(liveTactics().length).toBe(fixture.state.ownedTactics.length);
  });
});

test.describe("Dán danh sách tên", () => {
  const TEN_NAMES = "1. Tào Tháo\nLưu Bị, Quan Vũ; Gia Cát Lượng\nChu Duu\n吕布\nTriệu Vân\tMã Siêu\nTôn Quyền\nXyz Không Có";

  test("tiêu chí #61: dán 10 tên có 2 tên sai → xem lại trước khi ghi, xác nhận thì 8 món vào kho, 2 tên ở lại để sửa", async ({ page }) => {
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const picker = page.locator("#section-roster-recommend .roster-picker");
    const toggle = picker.getByRole("button", { name: "Dán danh sách tên" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const input = picker.getByLabel("Danh sách tên");
    await expect(input).toBeFocused();
    await input.fill(TEN_NAMES);
    await picker.getByRole("button", { name: "Đối chiếu", exact: true }).click();

    const review = picker.getByRole("region", { name: "Kết quả đối chiếu" });
    await expect(review.locator(".roster-paste-summary")).toHaveText("8 khớp · 0 cần chọn · 2 không nhận ra");
    await expect(review.locator('[data-group="matched"] .roster-paste-name')).toHaveText(["Tào Tháo", "Lưu Bị", "Quan Vũ", "Gia Cát Lượng", "Lữ Bố", "Triệu Vân", "Mã Siêu", "Tôn Quyền"]);
    await expect(review.locator('[data-group="matched"] .roster-paste-row').filter({ hasText: "Lữ Bố" })).toContainText("từ “吕布”");
    await expect(review.locator('[data-group="unrecognized"] .roster-paste-name')).toHaveText(["“Chu Duu”", "“Xyz Không Có”"]);
    // Chưa ghi gì trước khi xác nhận.
    expect((await stored(page)).ownedHeroes ?? []).toEqual([]);

    await review.getByRole("button", { name: "Thêm 8 món vào kho" }).click();
    const status = picker.locator(".roster-paste-status");
    await expect(status).toHaveText("Đã thêm 8 món vào kho. 2 tên không nhận ra vẫn còn trong ô để sửa.");
    await expect(status).toBeFocused();
    await expect(input).toHaveValue("Chu Duu\nXyz Không Có");
    await expect(review).toBeHidden();
    expect((await stored(page)).ownedHeroes.map((item) => item.name)).toEqual(["Tào Tháo", "Lưu Bị", "Quan Vũ", "Gia Cát Lượng", "Lữ Bố", "Triệu Vân", "Mã Siêu", "Tôn Quyền"]);
    await expect(picker.locator(".roster-picker-count")).toContainText("đã chọn 8");

    // Sửa một tên rồi đối chiếu lại: món đã có không đếm lại.
    await input.fill("Chu Du\nTào Tháo");
    await picker.getByRole("button", { name: "Đối chiếu", exact: true }).click();
    await expect(review.locator('[data-group="matched"] .roster-paste-row').filter({ hasText: "Tào Tháo" })).toContainText("đã có trong kho");
    await review.getByRole("button", { name: "Thêm 1 món vào kho" }).click();
    expect((await stored(page)).ownedHeroes).toHaveLength(9);
  });

  test("tên mơ hồ nằm ở Cần chọn, mặc định Bỏ qua; chọn thì thêm đúng món đã chọn; sửa chữ thì phải đối chiếu lại; Hủy không ghi", async ({ page }) => {
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const picker = page.locator("#section-roster-recommend .roster-picker");
    await picker.getByRole("button", { name: "Dán danh sách tên" }).click();
    const input = picker.getByLabel("Danh sách tên");
    await input.fill("truong bao\nBách Phát Bách Trúng\nBinh Phong");
    await picker.getByRole("button", { name: "Đối chiếu", exact: true }).click();
    const review = picker.getByRole("region", { name: "Kết quả đối chiếu" });
    await expect(review.locator(".roster-paste-summary")).toHaveText("1 khớp · 1 cần chọn · 0 không nhận ra");
    await expect(review.locator('[data-group="innate"]')).toContainText("Bách Phát Bách Trúng");
    const choice = review.getByLabel("“truong bao”");
    await expect(choice).toHaveValue("");
    await expect(choice.locator("option")).toHaveText(["Bỏ qua", "Trương Bào · Tướng", "Trương Bảo Khăn Vàng · Tướng"]);
    await expect(review.getByRole("button", { name: "Thêm 1 món vào kho" })).toBeEnabled();

    // Hủy: không ghi gì.
    await review.getByRole("button", { name: "Hủy" }).click();
    await expect(review).toBeHidden();
    expect((await stored(page)).ownedTactics ?? []).toEqual([]);

    await picker.getByRole("button", { name: "Đối chiếu", exact: true }).click();
    await choice.selectOption({ label: "Trương Bảo Khăn Vàng · Tướng" });
    await expect(review.getByRole("button", { name: "Thêm 2 món vào kho" })).toBeEnabled();
    // Sửa chữ sau khi đối chiếu: kết quả cũ bị bỏ, phải đối chiếu lại.
    await input.press("End");
    await input.pressSequentially(" ");
    await expect(review).toBeHidden();
    await picker.getByRole("button", { name: "Đối chiếu", exact: true }).click();
    await choice.selectOption({ label: "Trương Bảo Khăn Vàng · Tướng" });
    await review.getByRole("button", { name: "Thêm 2 món vào kho" }).click();
    const state = await stored(page);
    expect(state.ownedHeroes.map((item) => item.name)).toEqual(["Trương Bảo Khăn Vàng"]);
    expect(state.ownedTactics.map((item) => item.name)).toEqual(["Binh Phong"]);
  });

  test("bản zh: chữ UI tiếng Trung, nhận tên chữ Hán giản/phồn, hiện tên chữ Hán; kho vẫn lưu tên Việt chuẩn", async ({ page }) => {
    await page.goto("/zh/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const picker = page.locator("#section-roster-recommend .roster-picker");
    await picker.getByRole("button", { name: "粘贴名称列表" }).click();
    await picker.getByLabel("名称列表").fill("曹操，刘备、關羽\n周瑜瑜");
    await picker.getByRole("button", { name: "核对", exact: true }).click();
    const review = picker.getByRole("region", { name: "核对结果" });
    await expect(review.locator(".roster-paste-summary")).toHaveText("3 项匹配 · 0 项需选择 · 1 项无法识别");
    await expect(review.locator('[data-group="matched"] .roster-paste-name')).toHaveText(["曹操", "劉備", "關羽"]);
    await expect(review).not.toContainText("Tào Tháo");
    await review.getByRole("button", { name: "将 3 项加入库存" }).click();
    await expect(picker.locator(".roster-paste-status")).toHaveText("已将 3 项加入库存。1 个无法识别的名称仍保留在输入框中，可修改。");
    expect((await stored(page)).ownedHeroes.map((item) => item.name)).toEqual(["Tào Tháo", "Lưu Bị", "Quan Vũ"]);
  });

  test("bản ja: ô dán và ô tìm nhận tên Nhật (関羽) và chữ Hán tự dạng Nhật (蔡文姫), hiện tên Nhật; kho vẫn lưu tên Việt chuẩn", async ({ page }) => {
    await page.goto("/ja/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const picker = page.locator("#section-roster-recommend .roster-picker");
    await picker.locator(".roster-picker-search").fill("関羽");
    await expect(picker.locator(".roster-picker-name").first()).toHaveText("関羽");
    await picker.locator(".roster-paste-toggle").click();
    await picker.locator(".roster-paste-input").fill("関羽\n蔡文姫\n存在しない名前");
    await picker.locator(".roster-paste-match").click();
    const review = picker.getByRole("region", { name: "照合結果" });
    await expect(review.locator(".roster-paste-summary")).toHaveText("一致 2 件 · 要選択 0 件 · 認識できない名前 1 件");
    await expect(review.locator('[data-group="matched"] .roster-paste-name')).toHaveText(["関羽", "蔡琰"]);
    await review.getByRole("button", { name: "2 件を在庫に追加" }).click();
    await expect(picker.locator(".roster-paste-status")).toContainText("2 件を在庫に追加しました。");
    expect((await stored(page)).ownedHeroes.map((item) => item.name)).toEqual(["Quan Vũ", "Thái Văn Cơ"]);
  });
});

test.describe("390px", () => {
  for (const locale of ["vi", "zh"]) {
    for (const theme of ["light", "dark"]) {
      test(`${locale}, theme ${theme}: ô dán và nút thêm tất cả không tràn ngang, vùng bấm ≥ 44px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await seed(page, { [STORAGE_KEY]: fixture.state });
        const prefix = locale === "zh" ? "/zh" : "";
        await page.goto(`${prefix}/goi-y-doi-tu-kho/`);
        await waitForBoot(page);
        const section = page.locator("#section-roster-recommend");
        const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth);
        const minHeight = (locator) => locator.evaluateAll((nodes) => Math.min(...nodes.map((node) => node.getBoundingClientRect().height)));

        const picker = section.locator(".roster-picker");
        await picker.locator(".roster-paste-toggle").click();
        await picker.locator(".roster-paste-input").fill(locale === "zh" ? "曹操\n刘备\ntruong bao\n不存在的名字很长很长很长很长很长很长很长很长" : "Tào Tháo\nLưu Bị\ntruong bao\nMột cái tên rất dài không có trong danh mục của trò chơi");
        await picker.locator(".roster-paste-match").click();
        await expect(picker.locator(".roster-paste-review")).toBeVisible();
        expect(await noOverflow()).toBe(true);
        expect(await minHeight(picker.locator(".roster-paste-toggle, .roster-paste-match, .roster-paste-confirm, .roster-paste-cancel, .roster-paste-choice select"))).toBeGreaterThanOrEqual(44);
        await picker.locator(".roster-paste").screenshot({ path: testInfo.outputPath(`paste-390-${locale}-${theme}.png`) });

        await section.locator(".roster-actionbar-main .ana-btn.primary").click();
        const card = section.locator(".roster-missing").filter({ has: page.locator(".roster-add-all") }).first();
        await expect(card).toBeVisible();
        expect(await noOverflow()).toBe(true);
        expect(await minHeight(card.locator(".roster-add-all"))).toBeGreaterThanOrEqual(44);
        await card.screenshot({ path: testInfo.outputPath(`add-all-390-${locale}-${theme}.png`) });
        await card.locator(".roster-add-all").click();
        const undoBar = section.locator(".roster-undo-bar");
        await expect(undoBar).toBeVisible();
        expect(await noOverflow()).toBe(true);
        expect(await minHeight(undoBar.locator("button"))).toBeGreaterThanOrEqual(44);
        await undoBar.screenshot({ path: testInfo.outputPath(`undo-390-${locale}-${theme}.png`) });
      });
    }
  }
});
