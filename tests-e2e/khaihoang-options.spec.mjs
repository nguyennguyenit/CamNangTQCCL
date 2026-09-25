import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { replaceWebsiteDisplayPin, websiteDisplayFixture } from "./fixtures/website-display-fixture.mjs";

const data = JSON.parse(await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8"));
/** Byte gốc của nguồn: pin trên trang chi tiết và hash trong bản phát hành đều so với byte này. */
const khaihoangSource = await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8");
const HAN = /[\u3400-\u9fff\uf900-\ufaff]/u;
const teamByTitle = (title) => data.teams.find((item) => item.title === title);

test.beforeEach(async ({ context }) => {
  await context.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue() : route.abort());
});

/** Route handle do build nhúng: URL chi tiết không bao giờ được suy lại từ title. */
async function routeHandles(request) {
  const html = await (await request.get("/khai-hoang/")).text();
  const match = html.match(/id="team-route-handles"[^>]*>([^<]+)<\/script>/);
  if (!match) throw new Error("Built Khai hoang page lacks the team route handle map");
  return JSON.parse(match[1]);
}

/** Đường dẫn chi tiết từ handle đã đóng băng, kèm query tự đủ trạng thái của một card. */
function detailPath(handles, teamId, query = {}) {
  const url = new URL(`http://127.0.0.1/khai-hoang/${encodeURIComponent(handles.k[teamId])}/`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

const khaihoangRequest = "**/data/khaihoang.json*";

/**
 * Danh sách: nguồn và bản hiển thị do fixture cấp, không đụng dữ liệu đã phát hành.
 * `keepLocalization` giữ nguyên giá trị của bản phát hành cho hợp đồng nội dung đã dịch.
 */
async function routeKhaihoang(page, payload, {keepLocalization = false} = {}) {
  const khaihoangBody = keepLocalization ? khaihoangSource : JSON.stringify(payload);
  const website = websiteDisplayFixture(
    {"data/khaihoang.json": khaihoangBody},
    {dropValuesFor: keepLocalization ? [] : ["data/khaihoang.json"]},
  );
  await page.route("**/data/website-display.json", (route) =>
    route.fulfill({contentType: "application/json", body: website.body}));
  await page.route(khaihoangRequest, (route) =>
    route.fulfill({contentType: "application/json", body: khaihoangBody}));
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/khai-hoang\/(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({response, body: replaceWebsiteDisplayPin(await response.text(), website.pin)});
  });
  await page.goto("/khai-hoang/");
}

const DETAIL_DOCUMENT = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/khai-hoang\/[^/?]+\/(?:\?.*)?$/;

/**
 * Trang chi tiết: byte nguồn Khai hoang giữ nguyên vì pin trên trang phải khớp; fixture chỉ làm
 * mới hash nguồn trong bản hiển thị và (mặc định) bỏ giá trị localization của Khai hoang để kiểm
 * cấu trúc độc lập với bản phát hành đang làm mới. `dropKhaihoangValues: false` dùng đúng bản
 * phát hành cho hợp đồng nội dung đã dịch.
 */
async function routeDetail(page, {dropKhaihoangValues = true} = {}) {
  const website = websiteDisplayFixture({"data/khaihoang.json": khaihoangSource}, {
    dropValuesFor: dropKhaihoangValues ? ["data/khaihoang.json"] : [],
  });
  await page.route("**/data/website-display.json", (route) =>
    route.fulfill({contentType: "application/json", body: website.body}));
  await page.route(DETAIL_DOCUMENT, async (route) => {
    const response = await route.fetch();
    await route.fulfill({response, body: replaceWebsiteDisplayPin(await response.text(), website.pin)});
  });
  return website;
}

test("every source option replaces only its card and restores the default", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeKhaihoang(page, data);
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  await expect(page.locator(".kh-season-context")).toHaveCount(0);
  for (const [index, team] of data.teams.entries()) {
    const card = page.locator(".kh-card").nth(index);
    const initial = await card.locator(".kh-build").textContent();
    const next = page.locator(".kh-card").nth((index + 1) % data.teams.length);
    const neighbor = await next.textContent();
    const neighborHref = await next.getByRole("link").first().getAttribute("href");
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
      await expect(next.getByRole("link").first()).toHaveAttribute("href", neighborHref);
      // Link của card đang chọn tự mang cặp đang hoạt động ngay khi đổi selector.
      for (const link of await card.getByRole("link").all()) {
        await expect(link).toHaveAttribute("href", new RegExp(`/khai-hoang/${handles.k[team.id]}/`));
        await expect(link).toHaveAttribute("href", new RegExp(`variant=${variant.id}`));
        await expect(link).toHaveAttribute("href", /from=/);
      }
    }
    if (team.variants?.length) {
      await select.selectOption("");
      await expect(card.locator(".kh-build")).toHaveText(initial);
      for (const link of await card.getByRole("link").all()) {
        await expect(link).not.toHaveAttribute("href", /variant=/);
      }
    }
  }
  // Chọn cấu hình không điều hướng khỏi danh sách.
  await expect(page.locator(".kh-card").first().getByRole("combobox")).toHaveCount(1);
  expect(new URL(page.url()).pathname).toBe("/khai-hoang/");
  expect(new URL(page.url()).hash).toBe("");
});

test("cards never render guides or opening notes, even when the payload carries them", async ({ page }) => {
  const payload = structuredClone(data);
  payload.teams[0].guide = {ratings: {}, defenders: {}, transitions: []};
  const variantOnlyIndex = payload.teams.findIndex((team) => !team.guide && team.variants?.length);
  payload.teams[variantOnlyIndex].variants[0].guide = {overview: "Không được dùng làm fallback."};
  payload.teams[variantOnlyIndex].openingNote = "Ghi chú mở đất không thuộc danh sách.";
  await routeKhaihoang(page, payload);
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  await expect(page.locator(".kh-guide")).toHaveCount(0);
  await expect(page.locator(".kh-guide-details")).toHaveCount(0);
  await expect(page.locator(".kh-opening-note")).toHaveCount(0);
  await expect(page.locator("#section-khaihoang")).not.toContainText("Ghi chú mở đất không thuộc danh sách.");
  await expect(page.locator("#section-khaihoang")).not.toContainText("Không được dùng làm fallback.");
});

test("source selection works with keyboard on mobile without overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await routeKhaihoang(page, data);
  const select = page.getByRole("combobox", { name: `Cấu hình ${data.teams[0].title}`, exact: true });
  await select.focus();
  // Native select type-ahead targets the neutral tactic-based option label.
  await page.keyboard.press(data.teams[0].variants[0].displayLabel[0].toLowerCase());
  await expect(select).toHaveValue(data.teams[0].variants[0].id);
  await expect(select).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".kh-card").first().screenshot({ path: testInfo.outputPath("mobile-option.png") });
});

test("curated tactical build notes stay visible without source provenance", async ({ page }) => {
  await routeKhaihoang(page, data);
  const lucTon = page.locator(".kh-card").filter({ has: page.getByRole("heading", {
    name: "Lục Tốn · Tả Từ · Trương Xuân Hoa", exact: true,
  }) });
  await expect(lucTon.locator(".kh-build-note")).toHaveCount(0);
  await lucTon.getByRole("combobox").selectOption("jp-s23-si-biet");
  await expect(lucTon.locator(".kh-build-note")).toContainText(/không trộn hai cấu hình/i);
  await expect(lucTon.locator(".kh-build-note")).not.toContainText(/Nguồn|Dengeki|S23/);

  const maSieu = page.locator(".kh-card").filter({ has: page.getByRole("heading", {
    name: "Gia Cát Khác · SP Mã Siêu · Pháp Chính", exact: true,
  }) });
  await maSieu.getByRole("combobox").selectOption("cn-thoi-phong");
  await expect(maSieu.locator(".kh-build-note")).toContainText("Pháp Chính mang Tiềm Long từ đầu; cần có Thôi Phong.");
  await maSieu.getByRole("combobox").selectOption("");
  await expect(maSieu.locator(".kh-build")).not.toContainText("Pháp Chính mang Tiềm Long từ đầu");

  const chuThai = teamByTitle("Chu Thái · Trương Phi · Trương Xuân Hoa");
  const chuThaiCard = page.locator(".kh-card").filter({ has: page.getByRole("heading", {
    name: chuThai.title, exact: true,
  }) });
  // Card hiển thị đúng ghi chú build của team, không phải ghi chú mở đất hay ghi chú của variant.
  await expect(chuThaiCard.locator(".kh-build-note")).toHaveText(chuThai.buildNote);
  await expect(chuThaiCard.locator(".hero").filter({ has: page.getByText("Trương Xuân Hoa", { exact: true }) }).locator(".kh-note")).toHaveText("Cộng Trí Lực.");
  await expect(chuThaiCard.locator(".kh-note").filter({ hasText: "Nguồn sát thương chính" })).toHaveCount(0);
});

test("main Khai hoang cards keep current-only wording and real detail links", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeKhaihoang(page, data);
  const main = page.locator(".kh-card");
  await expect(main).toHaveCount(data.teams.length);
  for (let index = 0; index < await main.count(); index++) {
    const card = main.nth(index);
    await expect(card).not.toContainText(/Kazten|CN\/KR|Nguồn:/);
    const links = card.getByRole("link");
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("href", new RegExp(`/khai-hoang/${handles.k[data.teams[index].id]}/`));
      await expect(link).toHaveAttribute("href", /from=/);
    }
    await expect(card.getByRole("link", { name: data.teams[index].title, exact: true })).toHaveCount(1);
    await expect(card.getByRole("link", { name: "Xem chi tiết", exact: true })).toHaveCount(1);
  }
  await expect(main.locator(".kh-guide, .kh-opening-note")).toHaveCount(0);
});

test("researched root builds render their stage-specific leaders, units, and tactic slots", async ({ page }) => {
  await routeKhaihoang(page, data);
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
    await expect(page.locator(".kh-guide")).toHaveCount(0);
  });
}

/* ---------- Trang chi tiết: hướng dẫn, ghi chú mở đất, URL và trạng thái lỗi ---------- */

test("detail owns the roster guide and keeps it open across variant changes", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Gia Cát Khác · Thái Sử Từ · Tả Từ");
  await routeDetail(page);
  await page.goto(detailPath(handles, target.id));

  await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await expect(page.locator("#team-detail-status")).toBeHidden();
  const guide = page.locator("#team-detail-body .kh-guide");
  await expect(guide).toHaveCount(1);
  await expect(guide).toContainText("Đánh giá chung cho bộ ba tướng; chưa chấm riêng từng bộ chiến pháp.");
  await expect(guide).toContainText("Đất 4 · dễ → khó");
  const details = guide.locator("details");
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  const before = await guide.textContent();

  // Hướng dẫn nằm ngoài subtree build: đổi cấu hình không dựng lại, không đóng mục.
  const build = page.locator("#team-detail-body .kh-detail-build");
  const beforeBuild = await build.textContent();
  await page.locator("#team-detail-body").getByRole("combobox").selectOption(target.variants[0].id);
  await expect(build).not.toHaveText(beforeBuild);
  await expect(guide).toHaveText(before);
  await expect(details).toHaveAttribute("open", "");
  await expect(guide.locator("summary")).toHaveCount(1);

  // Trang chi tiết không boot ứng dụng gốc.
  await expect(page.locator('a[data-section="khaihoang"][aria-current="page"]')).toHaveCount(1);
});

test("detail keeps every opening note with its owner and never borrows from the default build", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeDetail(page);

  const lucTon = teamByTitle("Lục Tốn · Tả Từ · Trương Xuân Hoa");
  await page.goto(detailPath(handles, lucTon.id));
  const body = page.locator("#team-detail-body");
  // Ghi chú mở đất của team và của tướng đang giữ đúng owner của build mặc định.
  await expect(body.locator(".kh-build > .kh-opening-note")).toHaveText([lucTon.openingNote]);
  await expect(body).toContainText("Thận trọng với thủ quân có tất trúng");
  await expect(body.locator(".hero .kh-opening-note")).toHaveText([lucTon.heroes[0].openingNote]);
  await expect(body.locator(".hero .kh-note").first()).toHaveText(lucTon.heroes[0].buildNote);

  await body.getByRole("combobox").selectOption(lucTon.variants[0].id);
  await expect(body.locator(".kh-build-note")).toHaveText(lucTon.variants[0].buildNote);
  await expect(body).not.toContainText(lucTon.openingNote);
  await expect(body.locator(".kh-opening-note")).toHaveCount(0);
  await expect(body.locator(".kh-note")).toHaveCount(0);

  const maSieu = teamByTitle("Gia Cát Khác · SP Mã Siêu · Pháp Chính");
  await page.goto(detailPath(handles, maSieu.id, { variant: "cn-thoi-phong" }));
  await expect(body.locator(".kh-build > .kh-opening-note")).toHaveText([maSieu.variants[0].openingNote]);
  await expect(body.locator(".kh-build-note")).toHaveText(maSieu.variants[0].buildNote);
  await expect(body).not.toContainText("Nguồn mùa S23");
});

test("teams without a guide render build and notes only, with no empty guide group", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Gia Cát Khác · SP Mã Siêu · Pháp Chính");
  await routeDetail(page);
  await page.goto(detailPath(handles, target.id));
  const body = page.locator("#team-detail-body");
  await expect(body.locator(".kh-build")).toHaveCount(1);
  await expect(body.locator(".kh-guide")).toHaveCount(0);
  for (const variant of target.variants) {
    await body.getByRole("combobox").selectOption(variant.id);
    await expect(body.locator(".kh-build")).toHaveCount(1);
    await expect(body.locator(".kh-guide")).toHaveCount(0);
  }
  // Payload guide rỗng hoặc chỉ có ở variant không tạo nhóm hướng dẫn.
  const probe = await page.evaluate(async () => {
    const {khaihoangGuide} = await import("/js/render.js");
    return {
      empty: khaihoangGuide({ratings: {}, defenders: {}, transitions: []}) === null,
      absent: khaihoangGuide(undefined) === null,
      rendered: Boolean(khaihoangGuide({overview: "Có hướng dẫn"})),
    };
  });
  expect(probe).toEqual({empty: true, absent: true, rendered: true});
});

test("detail URL keeps variant and from in sync across select, reload and history", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Gia Cát Khác · Thái Sử Từ · Tả Từ");
  const [first, second] = target.variants;
  await page.goto("/khai-hoang/");
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  // Mở chi tiết từ card đang chọn cấu hình, đúng như primary-click ngoài danh sách.
  const card = page.locator(".kh-card").filter({ has: page.getByRole("heading", { name: target.title, exact: true }) });
  const cta = card.getByRole("link", { name: "Xem chi tiết", exact: true });
  await card.getByRole("combobox").selectOption(first.id);
  const entryUrl = await cta.getAttribute("href");
  expect(entryUrl).toContain(`/khai-hoang/${handles.k[target.id]}/`);
  expect(entryUrl).toContain(`variant=${first.id}`);
  expect(entryUrl).toContain("from=");
  await cta.click();

  const select = page.locator("#team-detail-body").getByRole("combobox");
  await expect(select).toHaveValue(first.id);
  // `from` là URL root an toàn mang đúng cặp đang chọn; nút quay lại dùng nguyên giá trị đó.
  const entry = new URL(page.url());
  const from = entry.searchParams.get("from");
  expect(from.startsWith("/")).toBe(true);
  expect(from).toContain("/khai-hoang/?");
  expect(from).toContain(`khTeam=${target.id}`);
  expect(from).toContain(`khVariant=${first.id}`);
  await expect(page.locator("#team-return-link")).toHaveAttribute("href", from);

  // Đổi cấu hình thay query của chính trang, giữ nguyên `from` và không tạo lịch sử mới.
  const historyLength = await page.evaluate(() => history.length);
  await select.selectOption(second.id);
  const changed = new URL(page.url());
  expect(changed.pathname).toBe(entry.pathname);
  expect(changed.searchParams.get("variant")).toBe(second.id);
  expect(changed.searchParams.get("from")).toBe(from);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.locator("#team-detail-body .kh-build")).toContainText(second.buildNote);

  await page.reload();
  await expect(page.locator("#team-detail-body").getByRole("combobox")).toHaveValue(second.id);
  await expect(page.locator("#team-detail-body .kh-build")).toContainText(second.buildNote);

  // Back về danh sách rồi Forward: entry lịch sử đã bị replaceState nên phải mở lại đúng
  // cấu hình vừa chọn, không quay về cấu hình lúc mới vào trang.
  await page.goBack();
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  await page.goForward();
  await expect(page.locator("#team-detail-body").getByRole("combobox")).toHaveValue(second.id);
  await expect(page.locator("#team-detail-body .kh-build")).toContainText(second.buildNote);

  // Chọn mặc định gỡ hẳn query `variant` nhưng vẫn giữ `from`.
  await page.locator("#team-detail-body").getByRole("combobox").selectOption("");
  const restored = new URL(page.url());
  expect(restored.searchParams.has("variant")).toBe(false);
  expect(restored.searchParams.get("from")).toBe(from);
});

test("unknown variants warn and offer the default build instead of pretending", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Lục Tốn · Tả Từ · Trương Xuân Hoa");
  await routeDetail(page);
  await page.goto(detailPath(handles, target.id, { variant: "khong-co-cau-hinh", from: "/khai-hoang/" }));

  const status = page.locator("#team-detail-status");
  await expect(status.locator('[role="alert"]')).toContainText("khong-co-cau-hinh");
  await expect(page.locator("#team-detail-body")).toBeHidden();
  await expect(page.locator("#team-detail-body .kh-build")).toHaveCount(0);
  const fallback = page.locator("#team-detail-default-variant");
  await expect(fallback).toHaveAttribute("href", /\/khai-hoang\/[^?]+\/\?/);
  const href = await fallback.getAttribute("href");
  expect(href).not.toContain("variant=");
  expect(href).toContain("from=");
  await expect(page.locator("#team-detail-retry")).toHaveCount(0);

  await fallback.click();
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await expect(page.locator("#team-detail-body").getByRole("combobox")).toHaveValue("");
  await expect(new URL(page.url()).searchParams.has("variant")).toBe(false);

  const foreign = teamByTitle("Gia Cát Khác · SP Mã Siêu · Pháp Chính").variants[0].id;
  await page.goto(detailPath(handles, target.id, {variant: foreign}));
  await expect(page.locator("#team-detail-status [role='alert']")).toContainText(foreign);
  await expect(page.locator("#team-detail-body")).toBeHidden();
});

test("detail fails closed on loading, source hash, network and unsafe return sources", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Gia Cát Khác · Thái Sử Từ · Tả Từ");
  const detailUrl = detailPath(handles, target.id, { from: "https://ke-gian.example/#khaihoang" });
  await routeDetail(page);

  // Loading: nguồn trả chậm, trạng thái tải phải hiện trước nội dung.
  await page.route(khaihoangRequest, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto(detailUrl, {waitUntil: "domcontentloaded"});
  await expect(page.locator("#team-detail-status")).toHaveText("Đang tải chi tiết…");
  await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#team-detail-body")).toBeVisible();
  // `from` ngoài origin bị loại: nút quay lại về danh sách Khai hoang.
  await expect(page.locator("#team-return-link")).toHaveAttribute("href", "/khai-hoang/");

  // Hash lệch: byte nguồn khác pin trên trang thì không render nội dung nguồn.
  await page.unroute(khaihoangRequest);
  await page.route(khaihoangRequest, (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({...data, teams: data.teams.map((team) => ({...team, title: "Nội dung chưa xác minh"}))}),
  }));
  await page.reload();
  await expect(page.locator("#team-detail-status [role='alert']")).toContainText("đã thay đổi");
  await expect(page.locator("#team-detail-body")).toBeHidden();
  await expect(page.locator("#team-detail-body .kh-build")).toHaveCount(0);
  await expect(page.locator("#team-detail-status")).not.toContainText("Nội dung chưa xác minh");

  // Lỗi mạng: giữ retry và nút quay lại.
  await page.unroute(khaihoangRequest);
  await page.route(khaihoangRequest, (route) => route.abort("failed"));
  await page.reload();
  await expect(page.locator("#team-detail-status [role='alert']")).toContainText("Không tải được chi tiết khai hoang.");
  await expect(page.locator("#team-detail-retry")).toHaveCount(1);
  await expect(page.locator("#team-return-link")).toBeVisible();
  await expect(page.locator("#team-detail-body")).toBeHidden();

  // Bản hiển thị không khớp pin: cũng dừng ở trạng thái xác minh, không dựng dữ liệu thô.
  await page.unroute(khaihoangRequest);
  await page.route("**/data/website-display.json", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({schemaVersion: 1, generationId: "site-localization:" + "0".repeat(64), values: {}, sourceHashes: {}}),
  }));
  await page.reload();
  await expect(page.locator("#team-detail-status [role='alert']")).toContainText("Không thể xác minh dữ liệu khai hoang.");
  await expect(page.locator("#team-detail-body")).toBeHidden();

  // Thử lại sau khi nguồn đã đúng phải dựng được nội dung.
  await page.unroute("**/data/website-display.json");
  await routeDetail(page);
  await page.locator("#team-detail-retry").click();
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await expect(page.locator("#team-detail-body .kh-build")).toHaveCount(1);
});

test("detail stays readable at 320px in both themes with keyboard selection", async ({ page, request }, testInfo) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Gia Cát Khác · Thái Sử Từ · Tả Từ");
  await routeDetail(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(detailPath(handles, target.id));

  const body = page.locator("#team-detail-body");
  await body.locator(".kh-guide-details summary").click();
  await expect(body).toContainText("Thái Sử Từ · từ 3 đỏ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("detail-320-light.png"), fullPage: true });

  // Chọn cấu hình bằng bàn phím trên select native (type-ahead như danh sách).
  const select = body.getByRole("combobox");
  await select.focus();
  await expect(select).toBeFocused();
  await page.keyboard.press(target.variants[0].displayLabel[0].toLowerCase());
  await expect(select).toHaveValue(target.variants[0].id);
  await expect(new URL(page.url()).searchParams.get("variant")).toBe(target.variants[0].id);
  await expect(body.locator(".kh-guide-details")).toHaveAttribute("open", "");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(select).toBeVisible();
  await expect(body.locator(".kh-build")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("detail-320-dark.png"), fullPage: true });

  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("localized notes never render source Chinese characters", async ({ page, request }) => {
  const handles = await routeHandles(request);
  // Cần bản phát hành đã localization cho trường ghi chú mới; fixture không bỏ giá trị ở đây.
  await routeDetail(page, {dropKhaihoangValues: false});
  const chuThai = teamByTitle("Chu Thái · Trương Phi · Trương Xuân Hoa");
  await page.goto(detailPath(handles, chuThai.id));
  const body = page.locator("#team-detail-body");
  await expect(body).toBeVisible();
  await expect(body.locator(".kh-build-note")).toContainText(
    "Phương án thay Kích Kỳ Nọa Quy bằng chiến pháp có tên gốc mang nghĩa “gió mạnh, mưa lớn” (chưa xác nhận tên Việt)",
  );
  await expect(body).not.toContainText(HAN);

  await routeKhaihoang(page, data, {keepLocalization: true});
  const dongLong = page.locator(".kh-card").filter({ has: page.getByRole("heading", {
    name: "SP Lô Trực · Thái Sử Từ · Trương Xuân Hoa", exact: true,
  }) });
  await expect(dongLong.locator(".kh-note")).not.toContainText(HAN);
});
