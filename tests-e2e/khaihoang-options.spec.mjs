import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { replaceWebsiteDisplayPin, websiteDisplayFixture } from "./fixtures/website-display-fixture.mjs";

const data = JSON.parse(await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8"));
const HAN = /[\u3400-\u9fff\uf900-\ufaff]/u;

test.beforeEach(async ({ context }) => {
  await context.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue() : route.abort());
});

test("every source option replaces only its card and restores the default", async ({ page }) => {
  await page.goto("/#khaihoang");
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  await expect(page.locator(".kh-season-context")).toHaveCount(0);
  for (const [index, team] of data.teams.entries()) {
    const card = page.locator(".kh-card").nth(index);
    const initial = await card.locator(".kh-build").textContent();
    const next = page.locator(".kh-card").nth((index + 1) % data.teams.length);
    const neighbor = await next.textContent();
    const select = card.getByRole("combobox");
    await expect(select).toHaveCount(team.variants?.length ? 1 : 0);
    for (const variant of team.variants || []) {
      await expect(select.locator(`option[value="${variant.id}"]`)).toHaveText(variant.displayLabel);
      expect(variant.displayLabel).not.toMatch(/CN|Nhật|Hàn|Bahamut|S\d+/);
      await select.selectOption(variant.id);
      await expect(card.locator(".card-head .badge")).toHaveText(variant.unitType);
      await expect(card.locator(".kh-transforms")).toHaveCount(0);
      for (const [i, hero] of variant.heroes.entries()) {
        const row = card.locator(".hero").nth(i);
        await expect(row.locator(".hn")).toHaveText(hero.name);
        await expect(row.locator(".tag")).toHaveText([hero.tacticBefore, ...(hero.tacticsAfter || [])].filter(Boolean));
        await expect(row.locator(".kh-label")).toHaveText([
          hero.tacticBefore ? "Trước" : null, hero.tacticsAfter?.length ? "Sau" : null,
        ].filter(Boolean));
      }
      await expect(next).toHaveText(neighbor);
    }
    if (team.variants?.length) {
      await select.selectOption("");
      await expect(card.locator(".kh-build")).toHaveText(initial);
    }
  }
});

test("source selection works with keyboard on mobile without overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/#khaihoang");
  const select = page.getByRole("combobox", { name: `Cấu hình ${data.teams[0].title}`, exact: true });
  await select.focus();
  // Native select type-ahead targets the neutral tactic-based option label.
  await page.keyboard.press(data.teams[0].variants[0].displayLabel[0].toLowerCase());
  await expect(select).toHaveValue(data.teams[0].variants[0].id);
  await expect(select).toBeFocused();
  await expect(page.locator(".kh-card").first().locator(".kh-guide")).toHaveCount(data.teams[0].guide ? 1 : 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".kh-card").first().screenshot({ path: testInfo.outputPath("mobile-option.png") });
});

test("roster guide persists while a tactic variant changes", async ({ page }) => {
  await page.goto("/#khaihoang");
  const team = data.teams.find((item) => item.title === "Gia Cát Khác · Thái Sử Từ · Tả Từ");
  const card = page.locator(".kh-card").filter({ has: page.getByRole("heading", { name: team.title, exact: true }) });
  const guide = card.locator(".kh-guide");
  await expect(guide).toContainText("Đánh giá chung cho bộ ba tướng; chưa chấm riêng từng bộ chiến pháp.");
  await expect(guide).toContainText("Đất 4 · dễ → khó");
  const details = guide.locator("details");
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  const before = await guide.textContent();
  await card.getByRole("combobox").selectOption(team.variants[0].id);
  await expect(guide).toHaveText(before);
  await expect(details).toHaveAttribute("open", "");
});

test("curated tactical build notes stay visible without source provenance", async ({ page }) => {
  await page.goto("/#khaihoang");
  const team = data.teams.find((item) => item.title === "Lục Tốn · Tả Từ · Trương Xuân Hoa");
  const card = page.locator(".kh-card").filter({ has: page.getByRole("heading", { name: team.title, exact: true }) });

  await expect(card.locator(".kh-build-note")).toContainText("Thận trọng với thủ quân có tất trúng");
  await card.getByRole("combobox").selectOption("jp-s23-si-biet");
  await expect(card.locator(".kh-build-note")).toContainText(/không trộn hai cấu hình/i);
  await expect(card.locator(".kh-build-note")).not.toContainText(/Nguồn|Dengeki|S23/);

  const maSieu = page.locator(".kh-card").filter({ has: page.getByRole("heading", {
    name: "Gia Cát Khác · SP Mã Siêu · Pháp Chính", exact: true,
  }) });
  await maSieu.getByRole("combobox").selectOption("cn-thoi-phong");
  await expect(maSieu.locator(".kh-build-note")).toContainText("Cấu hình hướng tới tài khoản nhiều hột");
  await maSieu.getByRole("combobox").selectOption("");
  await expect(maSieu.locator(".kh-build")).not.toContainText("Cấu hình hướng tới tài khoản nhiều hột");

  const chuThai = page.locator(".kh-card").filter({ has: page.getByRole("heading", {
    name: "Chu Thái · Trương Phi · Trương Xuân Hoa", exact: true,
  }) });
  await expect(chuThai.locator(".kh-build-note")).toContainText("Ở cấu hình mặc định, Trương Xuân Hoa cộng Trí Lực.");
  await expect(chuThai.locator(".kh-build-note")).toContainText(
    "Phương án thay Kích Kỳ Nọa Quy bằng chiến pháp có tên gốc mang nghĩa “gió mạnh, mưa lớn” (chưa xác nhận tên Việt) có cách cộng điểm riêng: Trương Xuân Hoa cộng Thống Soái trước cấp 20, Trí Lực sau cấp 20.",
  );
  await expect(chuThai.locator(".kh-build-note")).not.toContainText(HAN);
  await expect(chuThai.locator(".hero").filter({ has: page.getByText("Trương Xuân Hoa", { exact: true }) }).locator(".kh-note")).toHaveText("Cộng Trí Lực.");
});

test("main Khai hoang cards keep current-only wording and ordered transition steps", async ({ page }) => {
  await page.goto("/#khaihoang");
  const main = page.locator(".kh-card");
  for (let index = 0; index < await main.count(); index++) {
    await expect(main.nth(index)).not.toContainText(/Kazten|CN\/KR|Nguồn:/);
  }
  await expect(main.getByRole("link")).toHaveCount(0);

  const card = main.filter({ has: page.getByRole("heading", { name: "Trương Xuân Hoa · Lữ Bố · Tả Từ", exact: true }) });
  const details = card.locator(".kh-guide-details");
  await details.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(details.locator("ol").filter({ hasText: "Ôn Hầu Cung" })).toHaveCount(0);
  await expect(details).toContainText("Thành chính 7 · Luyện Hứa Du");
  await expect(details).toContainText("Thành chính 8 · 18 thống ngự · Đủ 18 thống ngự thì thêm Hứa Du.");
  await expect(details).toContainText("48 giờ · Tháo chiến pháp để tích thống ngự.");
});

test("long guides fit the 320px boundary", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/#khaihoang");
  const card = page.locator(".kh-card").filter({ has: page.getByRole("heading", { name: "Gia Cát Khác · Thái Sử Từ · Tả Từ", exact: true }) });
  await card.locator(".kh-guide-details summary").click();
  await expect(card).toContainText("Thái Sử Từ · từ 3 đỏ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("researched root builds render their stage-specific leaders, units, and tactic slots", async ({ page }) => {
  await page.goto("/#khaihoang");
  const cases = [
    {
      title: "Trương Xuân Hoa · Lữ Bố · Tả Từ", before: null, after: "Trương Xuân Hoa",
      rows: [
        ["Trương Xuân Hoa", ["Thịnh Khí Linh Địch", "Võ Phong Trận"]],
        ["Lữ Bố", ["Thôi Phong Đoạn Nhẫn", "Mau Giành Lợi Thế"]],
        ["Tả Từ", ["Lâm Nguy Cứu Chủ", "Tạm Lánh Sóng Gió"]],
      ],
    },
    {
      title: "SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác", before: "SP Chu Tuấn", after: "Gia Cát Khác",
      rows: [
        ["SP Chu Tuấn", ["Vô Đương Phi Quân", "Sợ Bóng Sợ Gió"]],
        ["Hạ Hầu Uyên", ["Lõa Y Huyết Chiến", "Thôi Phong Đoạn Nhẫn"]],
        ["Gia Cát Khác", ["Thịnh Khí Linh Địch", "Tiềm Long Trận"]],
      ],
    },
  ];
  for (const expected of cases) {
    const card = page.locator(".kh-card").filter({ has: page.getByRole("heading", { name: expected.title, exact: true }) });
    await expect(card.locator(".kh-commander")).toHaveText([
      expected.before ? `Chủ tướng trước cấp 20: ${expected.before}` : null,
      `Chủ tướng sau cấp 20: ${expected.after}`,
    ].filter(Boolean));
    const rows = card.locator(".kh-build > .heroes > .hero");
    await expect(rows).toHaveCount(3);
    for (const [index, [name, tactics]] of expected.rows.entries()) {
      await expect(rows.nth(index).locator(".hn")).toHaveText(name);
      await expect(rows.nth(index).locator(".badge.unit.small")).toHaveText(
        expected.before ? ["Cung", "Cung"] : "Cung",
      );
      await expect(rows.nth(index).locator(".tag")).toHaveText(
        expected.before ? [tactics[0], ...tactics] : tactics,
      );
    }
    if (!expected.before) await expect(card.locator(".kh-label").filter({ hasText: "Trước" })).toHaveCount(0);
  }
});

// Right-hand groups from source-260906-1413-khaihoang-google-sheet.csv,
// rows 21–22 and 30–31; alternatives span the first pair in the HTML source.
const chamSuTeams = [
  {
    id: "lu-mong-gia-hu", title: "Lữ Mông – Giả Hủ",
    heroes: [{ name: "Lữ Mông", tactic: "Bạch Mã Nghĩa Tòng" }, { name: "Giả Hủ", tactic: "Ngụy Thư Tương Gian" }],
    note: "mang 1 lính. Tướng thay thế: Điêu Thuyền, Hoàng Cái, Phùng Kỷ.",
  },
  {
    id: "ton-thuong-huong-lang-thong", title: "Tôn Thượng Hương – Lăng Thống",
    heroes: [{ name: "Tôn Thượng Hương", tactic: "Lõa Y Huyết Chiến" }, { name: "Lăng Thống", tactic: "Phong Thi Trận" }],
    note: "mang 1 lính",
  },
].map((team) => ({ ...team, sources: [{
  label: "Bảng Khai hoang", url: "https://docs.google.com/spreadsheets/d/1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw/edit#gid=562317106",
}] }));

async function routeKhaihoang(page, payload) {
  const khaihoangBody = JSON.stringify(payload);
  const website = websiteDisplayFixture(
    {"data/khaihoang.json": khaihoangBody},
    {dropValuesFor: Array.isArray(payload) ? ["data/khaihoang.json"] : []},
  );
  await page.route("**/data/website-display.json", (route) =>
    route.fulfill({contentType: "application/json", body: website.body}));
  await page.route("**/data/khaihoang.json*", (route) =>
    route.fulfill({contentType: "application/json", body: khaihoangBody}));
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({response, body: replaceWebsiteDisplayPin(await response.text(), website.pin)});
  });
  await page.goto("/#khaihoang");
}

test("empty parent guides and variant-only guides do not create a roster guide", async ({ page }) => {
  const payload = structuredClone(data);
  payload.teams[0].guide = { ratings: {}, defenders: {}, transitions: [] };
  const variantOnlyIndex = payload.teams.findIndex((team) => !team.guide && team.variants?.length);
  payload.teams[variantOnlyIndex].variants[0].guide = { overview: "Không được dùng làm fallback." };
  await routeKhaihoang(page, payload);
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  await expect(page.locator(".kh-card").nth(0).locator(".kh-guide")).toHaveCount(0);
  await expect(page.locator(".kh-card").nth(variantOnlyIndex).locator(".kh-guide")).toHaveCount(0);
});

for (const width of [1280, 375]) {
  test(`standalone Chạm Sứ groups preserve source content and order at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 812 });
    await routeKhaihoang(page, { ...data, chamSuTeams });
    await expect(page.getByRole("heading", { name: "Đội Chạm Sứ / Ăn vạ", exact: true })).toBeVisible();
    await expect(page.locator(".kh-section-title")).toHaveText([
      "Đội hình khai hoang đề xuất", "Đội Chạm Sứ / Ăn vạ", "Quân thủ các mỏ",
    ]);
    await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
    await expect(page.locator(".cham-su-card")).toHaveCount(chamSuTeams.length);
    await expect(page.getByText("Chuyển hình đề xuất", { exact: true })).toHaveCount(0);
    for (const [index, team] of chamSuTeams.entries()) {
      const card = page.locator(".cham-su-card").nth(index);
      await expect(card.getByRole("heading")).toHaveText(team.title);
      await expect(card.locator(".hn")).toHaveText(team.heroes.map((hero) => hero.name));
      await expect(card.locator(".tag")).toHaveText(team.heroes.map((hero) => hero.tactic));
      await expect(card.locator(".kh-build-note")).toHaveText(team.note);
      await expect(card.getByRole("combobox")).toHaveCount(0);
      await expect(card.locator(".kh-label, .badge.unit")).toHaveCount(0);
      const link = card.getByRole("link", { name: team.sources[0].label, exact: true });
      await expect(link).toHaveAttribute("href", team.sources[0].url);
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator(".cham-su-card").first().screenshot({ path: testInfo.outputPath(`cham-su-${width}.png`) });
  });
}

for (const shape of ["missing", "empty", "legacy"]) {
  test(`Khai hoang supports ${shape} Chạm Sứ data`, async ({ page }) => {
    const { chamSuTeams: ignored, ...withoutChamSu } = data;
    const payload = shape === "legacy" ? data.mines
      : shape === "empty" ? { ...withoutChamSu, chamSuTeams: [] } : withoutChamSu;
    await routeKhaihoang(page, payload);
    await expect(page.getByRole("heading", { name: "Quân thủ các mỏ", exact: true })).toBeVisible();
    await expect(page.locator(".mine")).toHaveCount(data.mines.length);
    await expect(page.locator(".kh-card")).toHaveCount(shape === "legacy" ? 0 : data.teams.length);
    await expect(page.getByRole("heading", { name: "Đội Chạm Sứ / Ăn vạ", exact: true })).toHaveCount(0);
    await expect(page.locator(".cham-su-card")).toHaveCount(0);
    await expect(page.getByText("Chuyển hình đề xuất", { exact: true })).toHaveCount(0);
  });
}
