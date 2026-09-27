import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { replaceWebsiteDisplayPin, websiteDisplayFixture } from "./fixtures/website-display-fixture.mjs";

const data = JSON.parse(await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8"));
/** Byte gốc của nguồn: pin trên trang chi tiết và hash trong bản phát hành đều so với byte này. */
const khaihoangSource = await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8");
const HAN = /[\u3400-\u9fff\uf900-\ufaff]/u;
const teamByTitle = (title) => data.teams.find((item) => item.title === title);
/** Chip cấu hình của trang chi tiết (cùng nhóm chip `.kh-config-row` với thẻ danh sách). */
const detailChip = (page, variantId) => page.locator(`#team-detail-body .kh-config-chip[data-variant="${variantId}"]`);

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

/** Danh sách: nguồn và bản hiển thị do fixture cấp, không đụng dữ liệu đã phát hành. */
async function routeKhaihoang(page, payload) {
  const khaihoangBody = JSON.stringify(payload);
  const website = websiteDisplayFixture(
    {"data/khaihoang.json": khaihoangBody},
    {dropValuesFor: ["data/khaihoang.json"]},
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

/** Tên trong `.hn`: nhãn biến thể SP/CO/40Y đứng riêng trước tên như thẻ Đội chuẩn. */
const heroName = (name) => name.replace(/^(?:SP|CO|40Y)\s+/u, "");
/** Thẻ danh sách theo tên đội (tiêu đề thẻ là link tới trang chi tiết). */
const cardByTitle = (page, title) => page.locator(".kh-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
/** Tướng của build theo thứ tự hiển thị: chủ tướng trước cấp 20 (`commanderBefore`, thiếu thì tướng đầu) đứng đầu. */
const displayHeroes = (build) => {
  const main = build.heroes.find((hero) => hero.name === build.commanderBefore);
  return main ? [main, ...build.heroes.filter((hero) => hero !== main)] : build.heroes;
};
/** Chủ tướng trước / sau cấp 20: tướng đứng đầu; `commanderAfter` thiếu thì vẫn là tướng đứng đầu. */
const commanders = (build) => {
  const early = displayHeroes(build)[0].name;
  return { early, late: build.commanderAfter || early };
};

test("every version replaces only its card and restores the default", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeKhaihoang(page, data);
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  for (const [index, team] of data.teams.entries()) {
    const card = page.locator(".kh-card").nth(index);
    const initial = await card.locator(".kh-build").textContent();
    const next = page.locator(".kh-card").nth((index + 1) % data.teams.length);
    const neighbor = await next.textContent();
    const neighborHref = await next.getByRole("link").first().getAttribute("href");
    // Mọi thẻ có cùng hàng phiên bản; đội không có biến thể chỉ có chip "Mặc định" đang chọn.
    await expect(card.locator(".kh-config-row")).toHaveCount(1);
    await expect(card.locator(".kh-config-chip")).toHaveCount((team.variants?.length ?? 0) + 1);
    await expect(card.locator('.kh-config-chip[data-variant=""]')).toHaveAttribute("aria-pressed", "true");
    for (const variant of team.variants || []) {
      const chip = card.locator(`.kh-config-chip[data-variant="${variant.id}"]`);
      await expect(chip).toHaveText(variant.displayLabel);
      expect(variant.displayLabel).not.toMatch(/CN|Nhật|Hàn|Bahamut|S\d+/);
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(card.locator('.kh-config-chip[aria-pressed="true"]')).toHaveCount(1);
      await expect(card.locator(".kh-card-head .badge.unit")).toHaveText(variant.unitType);
      for (const [i, hero] of displayHeroes(variant).entries()) {
        const row = card.locator(".kh-build > .hero").nth(i);
        await expect(row.locator(".hn")).toHaveText(heroName(hero.name));
        await expect(row.locator(".tag")).toHaveText([hero.tacticBefore, ...(hero.tacticsAfter || [])].filter(Boolean));
        await expect(row.locator(".kh-label")).toHaveText([
          hero.tacticBefore ? "Trước" : null, hero.tacticsAfter?.length ? "Sau" : null,
        ].filter(Boolean));
      }
      await expect(next).toHaveText(neighbor);
      await expect(next.getByRole("link").first()).toHaveAttribute("href", neighborHref);
      // Link của card đang chọn tự mang cặp đang hoạt động ngay khi đổi phiên bản.
      for (const link of await card.getByRole("link").all()) {
        await expect(link).toHaveAttribute("href", new RegExp(`/khai-hoang/${handles.k[team.id]}/`));
        await expect(link).toHaveAttribute("href", new RegExp(`variant=${variant.id}`));
        await expect(link).toHaveAttribute("href", /from=/);
      }
    }
    if (team.variants?.length) {
      await card.locator('.kh-config-chip[data-variant=""]').click();
      await expect(card.locator('.kh-config-chip[data-variant=""]')).toHaveAttribute("aria-pressed", "true");
      await expect(card.locator(".kh-build")).toHaveText(initial);
      for (const link of await card.getByRole("link").all()) {
        await expect(link).not.toHaveAttribute("href", /variant=/);
      }
    }
  }
  // Chọn phiên bản không điều hướng khỏi danh sách.
  expect(new URL(page.url()).pathname).toBe("/khai-hoang/");
  expect(new URL(page.url()).hash).toBe("");
});

test("the list shows only teams and versions; notes, ratings, guides and shared references stay on the detail page", async ({ page }) => {
  const payload = structuredClone(data);
  payload.teams[0].guide = {overview: "Hướng dẫn chỉ thuộc trang chi tiết.", ratings: {land4: 9, overall: 8}};
  const variantOnlyIndex = payload.teams.findIndex((team) => !team.guide && team.variants?.length);
  payload.teams[variantOnlyIndex].variants[0].guide = {overview: "Không được dùng làm fallback."};
  payload.teams[variantOnlyIndex].openingNote = "Ghi chú mở đất không thuộc danh sách.";
  payload.teams[variantOnlyIndex].buildNote = "Ghi chú build không thuộc danh sách.";
  await routeKhaihoang(page, payload);
  const section = page.locator("#section-khaihoang");
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  await expect(section.locator(".kh-guide, .kh-ratings, .kh-build-note, .kh-opening-note, .kh-note, .detail-notes")).toHaveCount(0);
  await expect(section.locator(".cham-su-card, .kh-mines, .kh-mine-card")).toHaveCount(0);
  await expect(section.locator("h2")).toHaveCount(0);
  for (const text of ["Hướng dẫn chỉ thuộc trang chi tiết.", "Không được dùng làm fallback.", "Ghi chú mở đất không thuộc danh sách.", "Ghi chú build không thuộc danh sách.", "Đội Chạm Sứ", "Quân thủ", "Lưu ý nguồn", "Nguồn"]) {
    await expect(section).not.toContainText(text);
  }
});

test("cards in one grid row share the same height and footer line", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await routeKhaihoang(page, data);
  const boxes = await page.locator(".kh-card").evaluateAll((cards) => cards.map((card) => {
    const box = card.getBoundingClientRect();
    return { top: Math.round(box.top), height: Math.round(box.height), foot: Math.round(card.querySelector(".reference-card-foot").getBoundingClientRect().top) };
  }));
  const rows = new Map();
  for (const box of boxes) rows.set(box.top, [...(rows.get(box.top) || []), box]);
  expect(rows.size).toBeLessThan(boxes.length);
  for (const row of rows.values()) {
    expect(new Set(row.map((box) => box.height)).size).toBe(1);
    expect(new Set(row.map((box) => box.foot)).size).toBe(1);
  }
});

test("version selection works with keyboard on mobile without overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await routeKhaihoang(page, data);
  const team = data.teams.find((item) => item.variants?.length);
  const card = cardByTitle(page, team.title);
  // Chip phiên bản là button thật: bàn phím chọn bằng Tab + Enter.
  const chip = card.locator(`.kh-config-chip[data-variant="${team.variants[0].id}"]`);
  await chip.focus();
  await expect(chip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await card.screenshot({ path: testInfo.outputPath("mobile-option.png") });
});

test("each card links its title and Chi tiết to the same detail route", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeKhaihoang(page, data);
  const main = page.locator(".kh-card");
  await expect(main).toHaveCount(data.teams.length);
  for (let index = 0; index < await main.count(); index++) {
    const card = main.nth(index);
    const team = data.teams[index];
    await expect(card).not.toContainText(/Kazten|CN\/KR|Nguồn/);
    const links = card.getByRole("link");
    await expect(links).toHaveText([team.title, "Chi tiết"]);
    const href = await links.first().getAttribute("href");
    expect(href).toMatch(new RegExp(`/khai-hoang/${handles.k[team.id]}/`));
    expect(href).toMatch(/from=/);
    await expect(links.nth(1)).toHaveAttribute("href", href);
  }
});

test("the card stamp shows the overall rating, or a dashed empty stamp when the team is unrated", async ({ page }) => {
  await routeKhaihoang(page, data);
  const rated = data.teams.filter((team) => Number.isFinite(Number(team.guide?.ratings?.overall)));
  expect(rated.length).toBeGreaterThan(0);
  expect(rated.length).toBeLessThan(data.teams.length);
  for (const [index, team] of data.teams.entries()) {
    const stamp = page.locator(".kh-card").nth(index).locator(".kh-card-head .reference-score-wrap");
    const overall = Number(team.guide?.ratings?.overall);
    if (Number.isFinite(overall)) {
      await expect(stamp).not.toHaveClass(/is-missing/);
      await expect(stamp.locator(".reference-score")).toHaveText(String(overall).replace(".", ","));
    } else {
      await expect(stamp).toHaveClass(/is-missing/);
      await expect(stamp.locator(".reference-score")).toHaveText("—");
    }
  }
});

test("unit filter narrows the same rendered cards without touching their state", async ({ page }) => {
  await routeKhaihoang(page, data);
  const counts = new Map();
  for (const team of data.teams) counts.set(team.unitType, (counts.get(team.unitType) ?? 0) + 1);
  const all = page.locator(".kh-unit-chip").first();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".kh-unit-chip")).toHaveCount(counts.size + 1);
  await expect(page.locator(".kh-result-count")).toHaveText(`${data.teams.length} / ${data.teams.length} đội`);
  for (const [unit, count] of counts) {
    await page.locator(`.kh-unit-chip[data-unit="${unit}"]`).click();
    await expect(page.locator(`.kh-unit-chip[data-unit="${unit}"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");
    const visible = page.locator(".kh-card:visible");
    await expect(visible).toHaveCount(count);
    await expect(page.locator(".kh-result-count")).toHaveText(`${count} / ${data.teams.length} đội`);
    await expect(visible.locator(".kh-card-head .badge.unit")).toHaveText(Array(count).fill(unit));
  }
  await all.click();
  await expect(page.locator(".kh-card:visible")).toHaveCount(data.teams.length);
});

test("researched root builds mark their commanders and render stage-specific tactic slots", async ({ page }) => {
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
      // Chủ tướng trước (SP Chu Tuấn, đứng đầu) và sau cấp 20 (Gia Cát Khác) khác nhau.
      title: "SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác", before: "SP Chu Tuấn", after: "Gia Cát Khác",
      rows: [
        ["SP Chu Tuấn", ["Vô Đương Phi Quân", "Sợ Bóng Sợ Gió"]],
        ["Hạ Hầu Uyên", ["Lõa Y Huyết Chiến", "Thôi Phong Đoạn Nhẫn"]],
        ["Gia Cát Khác", ["Thịnh Khí Linh Địch", "Tiềm Long Trận"]],
      ],
    },
  ];
  for (const expected of cases) {
    const card = cardByTitle(page, expected.title);
    const rows = card.locator(".kh-build > .hero");
    await expect(rows).toHaveCount(3);
    // Chủ tướng trước cấp 20 (dòng đầu): ấn C sau tên. Đổi chủ tướng: thêm ấn trước nhãn "Sau" của chủ tướng sau cấp 20.
    if (!expected.before) {
      await expect(card.locator(".main-holder")).toHaveCount(1);
      await expect(rows.first().locator(".hero-name .main-holder")).toHaveAttribute("title", "Chủ tướng");
    } else {
      await expect(card.locator(".main-holder")).toHaveCount(2);
      await expect(rows.first().locator(".hero-name .main-holder")).toHaveAttribute("title", "Chủ tướng trước cấp 20");
      const lateRow = rows.filter({ has: page.locator(".hn", { hasText: heroName(expected.after) }) });
      await expect(lateRow.locator(".kh-after .main-holder")).toHaveAttribute("title", "Chủ tướng sau cấp 20");
    }
    for (const [index, [name, tactics]] of expected.rows.entries()) {
      const row = rows.nth(index);
      await expect(row.locator(".hn")).toHaveText(heroName(name));
      // Loại binh của build đã ở badge đầu thẻ: hàng tướng không lặp lại khi trùng loại binh đó.
      await expect(row.locator(".badge.unit.small")).toHaveCount(0);
      await expect(row.locator(".tag")).toHaveText(expected.before ? [tactics[0], ...tactics] : tactics);
    }
    if (!expected.before) await expect(card.locator(".kh-label").filter({ hasText: "Trước" })).toHaveCount(0);
  }
});

test("every version leads with its pre-level-20 commander marked after the name, plus a Sau mark when the commander changes", async ({ page }) => {
  await routeKhaihoang(page, data);
  for (const team of data.teams) {
    const card = cardByTitle(page, team.title);
    for (const [variantId, build] of [["", team], ...(team.variants || []).map((variant) => [variant.id, variant])]) {
      await card.locator(`.kh-config-chip[data-variant="${variantId}"]`).click();
      for (const commander of [build.commanderBefore, build.commanderAfter].filter(Boolean)) {
        expect(build.heroes.map((hero) => hero.name), `${team.id}/${variantId}`).toContain(commander);
      }
      const rows = card.locator(".kh-build > .hero");
      const { early, late } = commanders(build);
      await expect(rows.first().locator(".hn")).toHaveText(heroName(early));
      const rowOf = (name) => rows.filter({ has: page.locator(".hn", { hasText: new RegExp(`^${heroName(name)}$`) }) });
      if (early === late) {
        await expect(card.locator(".main-holder")).toHaveCount(1);
        await expect(rows.first().locator(".hero-name .main-holder")).toHaveCount(1);
      } else {
        await expect(card.locator(".main-holder")).toHaveCount(2);
        await expect(rows.first().locator(".hero-name .main-holder")).toHaveCount(1);
        await expect(rowOf(late).locator(".kh-after .main-holder, .hero-name .main-holder")).toHaveCount(1);
      }
    }
  }
});

test("a legacy mines-only payload renders an empty list without crashing", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error));
  await routeKhaihoang(page, data.mines);
  await expect(page.locator("#section-khaihoang .reference-title")).toHaveText("Khai hoang");
  await expect(page.locator(".kh-card")).toHaveCount(0);
  await expect(page.locator(".kh-mines, .cham-su-card")).toHaveCount(0);
  expect(errors).toEqual([]);
});

/* ---------- Trang chi tiết: hướng dẫn, ghi chú mở đất, URL và trạng thái lỗi ---------- */

test("detail fetches only the display publication and khaihoang.json, each once", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const requests = [];
  page.on("request", (req) => {
    const { pathname } = new URL(req.url());
    if (pathname.startsWith("/data/")) requests.push(pathname);
  });
  await page.goto(detailPath(handles, data.teams[0].id));
  await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#team-detail-body")).toBeVisible();
  expect(requests.sort()).toEqual(["/data/khaihoang.json", "/data/website-display.json"]);
});

test("detail owns ratings, the roster guide and shared references outside the rebuilt build", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Gia Cát Khác · Thái Sử Từ · Tả Từ");
  await routeDetail(page);
  await page.goto(detailPath(handles, target.id));

  await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await expect(page.locator("#team-detail-status")).toBeHidden();
  const body = page.locator("#team-detail-body");
  // Thứ tự khối: phiên bản + đội hình/ghi chú → điểm → hướng dẫn → Chạm Sứ → quân thủ mỏ; không còn mục lục thu gọn.
  await expect(body.locator(":scope > section > h2")).toHaveText(["Điểm đánh giá", "Hướng dẫn khai hoang", "Đội Chạm Sứ / Ăn vạ", "Quân thủ các mỏ"]);
  await expect(body.locator("details")).toHaveCount(0);
  const guide = body.locator(".kh-guide");
  await expect(guide).toContainText("Đất 4 · dễ → khó");
  await expect(body.locator(".kh-ratings-block")).toContainText("chưa chấm riêng từng bộ chiến pháp");

  // Điểm, hướng dẫn và tham khảo chung nằm ngoài subtree build: đổi phiên bản không dựng lại các node đó.
  await page.evaluate(() => { for (const node of document.querySelectorAll("#team-detail-body > section")) node.dataset.probe = "kept"; });
  const build = body.locator(".kh-detail-build");
  const beforeBuild = await build.textContent();
  await detailChip(page, target.variants[0].id).click();
  await expect(build).not.toHaveText(beforeBuild);
  await expect(body.locator(':scope > section[data-probe="kept"]')).toHaveCount(4);

  // Trang chi tiết không boot ứng dụng gốc; mục cha chỉ được đánh dấu khu vực (`true`), không phải trang hiện tại.
  await expect(page.locator('a[data-section="khaihoang"][aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveCount(0);
});

test("detail draws the six-mark rating bar only for teams with guide ratings", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeDetail(page);
  const withRatings = data.teams.filter((team) => team.guide?.ratings && Object.keys(team.guide.ratings).length);
  const unrated = data.teams.find((team) => !team.guide?.ratings);
  expect(withRatings.length).toBeGreaterThan(0);
  await page.goto(detailPath(handles, unrated.id));
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await expect(page.locator(".kh-ratings, .kh-ratings-block")).toHaveCount(0);
  for (const team of withRatings) {
    await page.goto(detailPath(handles, team.id));
    const bar = page.locator("#team-detail-body .kh-ratings");
    await expect(bar).toHaveCount(1);
    const marks = bar.locator(".kh-rating");
    const expected = [["Đất 4", "land4"], ["Đất 5", "land5"], ["Đất 6", "land6"], ["Đất 7–8", "land7to8"], ["Chuyển", "transition"], ["Tổng", "overall"]]
      .filter(([, key]) => Number.isFinite(Number(team.guide.ratings[key])));
    await expect(marks.locator(".kh-rating-label")).toHaveText(expected.map(([label]) => label));
    for (const [markIndex, [, key]] of expected.entries()) {
      const value = Number(team.guide.ratings[key]);
      const mark = marks.nth(markIndex);
      await expect(mark.locator(".kh-rating-value")).toHaveText(String(value).replace(".", ","));
      // Độ dài thanh là chính con số chia thang 10, không phải trang trí cố định.
      expect(await mark.locator(".kh-rating-fill").evaluate((node) => node.style.width)).toBe(`${Math.round(value * 10)}%`);
    }
    // Cột Tổng là mốc duy nhất dùng màu mực thay vì màu son.
    await expect(bar.locator(".kh-rating-fill-total")).toHaveCount(expected.some(([, key]) => key === "overall") ? 1 : 0);
  }
});

test("detail keeps every opening note with its owner and never borrows from the default build", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeDetail(page);

  const lucTon = teamByTitle("Lục Tốn · Tả Từ · Trương Xuân Hoa");
  await page.goto(detailPath(handles, lucTon.id));
  const body = page.locator("#team-detail-body");
  const notes = body.locator(".kh-build .detail-note-list");
  // Ghi chú mở đất của team và của tướng giữ đúng owner của build mặc định (ghi chú tướng mang nhãn tên tướng).
  await expect(notes.locator(".kh-opening-note:not(.detail-note-holder)")).toHaveText([lucTon.openingNote]);
  await expect(body).toContainText("Thận trọng với thủ quân có tất trúng");
  const heroOpening = notes.locator(".kh-opening-note.detail-note-holder");
  await expect(heroOpening.locator(".detail-note-owner")).toHaveText([lucTon.heroes[0].name]);
  await expect(heroOpening.locator(".detail-note-text")).toHaveText([lucTon.heroes[0].openingNote]);
  await expect(notes.locator(".kh-note .detail-note-text").first()).toHaveText(lucTon.heroes[0].buildNote);

  await detailChip(page, lucTon.variants[0].id).click();
  await expect(body.locator(".kh-build-note")).toHaveText(lucTon.variants[0].buildNote);
  await expect(body.locator(".kh-build-note")).not.toContainText(/Nguồn|Dengeki|S23/);
  await expect(body).not.toContainText(lucTon.openingNote);
  await expect(body.locator(".kh-opening-note")).toHaveCount(0);
  await expect(body.locator(".kh-note")).toHaveCount(0);

  const maSieu = teamByTitle("Gia Cát Khác · SP Mã Siêu · Pháp Chính");
  await page.goto(detailPath(handles, maSieu.id, { variant: "cn-thoi-phong" }));
  await expect(notes.locator(".kh-opening-note:not(.detail-note-holder)")).toHaveText([maSieu.variants[0].openingNote]);
  await expect(body.locator(".kh-build-note")).toHaveText(maSieu.variants[0].buildNote);
  await expect(body).not.toContainText("Nguồn mùa S23");
  await detailChip(page, "").click();
  await expect(body.locator(".kh-build")).not.toContainText("Pháp Chính mang Tiềm Long từ đầu");

  const chuThai = teamByTitle("Chu Thái · Trương Phi · Trương Xuân Hoa");
  await page.goto(detailPath(handles, chuThai.id));
  // Ghi chú build của team, không phải ghi chú mở đất hay ghi chú của variant.
  await expect(body.locator(".kh-build-note")).toHaveText(chuThai.buildNote);
  await expect(notes.locator(".kh-note").filter({ hasText: "Trương Xuân Hoa" }).locator(".detail-note-text")).toHaveText("Cộng Trí Lực.");
  await expect(notes.locator(".kh-note").filter({ hasText: "Nguồn sát thương chính" })).toHaveCount(0);
});

test("detail roles follow the build commanders and badge unit changes", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeDetail(page);
  const chuTuan = teamByTitle("SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác");
  await page.goto(detailPath(handles, chuTuan.id));
  const cards = page.locator("#team-detail-body .kh-hero-card");
  // Tướng đầu là chủ tướng trước cấp 20; chủ tướng sau cấp 20 mang ấn C ở nhãn "Chiến pháp sau".
  await expect(cards.locator(".detail-hero-role")).toHaveText(["Chủ tướng trước cấp 20", "Phó tướng", "Chủ tướng sau cấp 20"]);
  await expect(cards.first().locator(".hn")).toHaveText("Chu Tuấn");
  await expect(page.locator("#team-detail-body .kh-hero-card.is-main")).toHaveCount(1);
  await expect(page.locator("#team-detail-body .main-holder")).toHaveCount(2);
  await expect(cards.first().locator(".detail-hero-name .main-holder")).toHaveAttribute("title", "Chủ tướng trước cấp 20");
  await expect(cards.nth(2).locator(".kh-after .detail-hero-label .main-holder")).toHaveAttribute("title", "Chủ tướng sau cấp 20");

  const unitShift = data.teams.find((team) => team.heroes.some((hero) => hero.unitTypeBefore !== hero.unitTypeAfter));
  const hero = unitShift.heroes.find((item) => item.unitTypeBefore !== item.unitTypeAfter);
  await page.goto(detailPath(handles, unitShift.id));
  await expect(cards.filter({ has: page.locator(".hn", { hasText: heroName(hero.name) }) }).locator(".detail-hero-stat"))
    .toHaveText([hero.unitTypeBefore, hero.unitTypeAfter].join(" → "));
});

for (const width of [1280, 375]) {
  test(`detail Chạm Sứ groups keep content and order without source links at ${width}px`, async ({ page, request }, testInfo) => {
    const handles = await routeHandles(request);
    await page.setViewportSize({ width, height: 812 });
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
    ].map((team) => ({ ...team, sources: [{ label: "Bảng Khai hoang", url: "https://docs.google.com/spreadsheets/d/x/edit" }] }));
    await routeDetailSource(page, (payload) => { payload.chamSuTeams = chamSuTeams; });
    await page.goto(detailPath(handles, data.teams[0].id));
    await expect(page.getByRole("heading", { name: "Đội Chạm Sứ / Ăn vạ", exact: true })).toBeVisible();
    await expect(page.locator(".cham-su-card")).toHaveCount(chamSuTeams.length);
    for (const [index, team] of chamSuTeams.entries()) {
      const card = page.locator(".cham-su-card").nth(index);
      await expect(card.getByRole("heading")).toHaveText(team.title);
      await expect(card.locator(".cham-su-hero")).toHaveText(team.heroes.map((hero) => hero.name));
      await expect(card.locator(".cham-su-tactic")).toHaveText(team.heroes.map((hero) => hero.tactic));
      await expect(card.locator(".cham-su-note")).toHaveText(team.note);
      await expect(card.getByRole("link")).toHaveCount(0);
      await expect(card).not.toContainText("Nguồn");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator(".cham-su-card").first().screenshot({ path: testInfo.outputPath(`cham-su-${width}.png`) });
  });
}

for (const shape of ["missing", "empty"]) {
  test(`detail supports ${shape} Chạm Sứ data`, async ({ page, request }) => {
    const handles = await routeHandles(request);
    await routeDetailSource(page, (payload) => {
      if (shape === "missing") delete payload.chamSuTeams;
      else payload.chamSuTeams = [];
    });
    await page.goto(detailPath(handles, data.teams[0].id));
    await expect(page.getByRole("heading", { name: "Quân thủ các mỏ", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Đội Chạm Sứ \/ Ăn vạ/ })).toHaveCount(0);
    await expect(page.locator(".cham-su-card")).toHaveCount(0);
  });
}

test("detail mines render as a table on desktop and as one card per mine on mobile", async ({ page, request }) => {
  const handles = await routeHandles(request);
  await routeDetail(page);
  await page.goto(detailPath(handles, data.teams[0].id));
  await expect(page.locator(".kh-mines tbody tr")).toHaveCount(data.mines.length);
  await expect(page.locator(".kh-mines caption")).toHaveText("Quân thủ từng mỏ");
  const firstMine = data.mines[0];
  const row = page.locator(".kh-mines tbody tr").first();
  await expect(row.locator("th")).toHaveText(firstMine.name);
  await expect(row.locator(".kh-mine-hero")).toHaveText(firstMine.enemies.map((enemy) => enemy.hero));
  await expect(row.locator(".kh-mine-unit")).toHaveText(firstMine.enemies.map((enemy) => enemy.unitType));
  await expect(page.locator(".kh-table-frame")).toBeVisible();
  await expect(page.locator(".kh-mine-cards")).toBeHidden();

  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator(".kh-mine-cards")).toBeVisible();
  await expect(page.locator(".kh-table-frame")).toBeHidden();
  await expect(page.locator(".kh-mine-card")).toHaveCount(data.mines.length);
  await expect(page.locator(".kh-mine-card").first().locator("h3")).toHaveText(firstMine.name);
  await expect(page.locator(".kh-mine-enemy").first()).toHaveText(`${firstMine.enemies[0].hero} · ${firstMine.enemies[0].unitType}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
    await detailChip(page, variant.id).click();
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
  const cta = card.getByRole("link").first();
  await card.locator(`.kh-config-chip[data-variant="${first.id}"]`).click();
  const entryUrl = await cta.getAttribute("href");
  expect(entryUrl).toContain(`/khai-hoang/${handles.k[target.id]}/`);
  expect(entryUrl).toContain(`variant=${first.id}`);
  expect(entryUrl).toContain("from=");
  await cta.click();

  await expect(detailChip(page, first.id)).toHaveAttribute("aria-pressed", "true");
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
  await detailChip(page, second.id).click();
  const changed = new URL(page.url());
  expect(changed.pathname).toBe(entry.pathname);
  expect(changed.searchParams.get("variant")).toBe(second.id);
  expect(changed.searchParams.get("from")).toBe(from);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.locator("#team-detail-body .kh-build")).toContainText(second.buildNote);

  await page.reload();
  await expect(detailChip(page, second.id)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#team-detail-body .kh-build")).toContainText(second.buildNote);

  // Back về danh sách rồi Forward: entry lịch sử đã bị replaceState nên phải mở lại đúng
  // cấu hình vừa chọn, không quay về cấu hình lúc mới vào trang.
  await page.goBack();
  await expect(page.locator(".kh-card")).toHaveCount(data.teams.length);
  await page.goForward();
  await expect(detailChip(page, second.id)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#team-detail-body .kh-build")).toContainText(second.buildNote);

  // Chọn mặc định gỡ hẳn query `variant` nhưng vẫn giữ `from`.
  await detailChip(page, "").click();
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
  await expect(detailChip(page, "")).toHaveAttribute("aria-pressed", "true");
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
  await expect(body).toContainText("Thái Sử Từ · từ 3 đỏ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("detail-320-light.png"), fullPage: true });

  // Chọn cấu hình bằng bàn phím: chip là button thật (Enter), cùng nhóm chip với thẻ danh sách.
  const chip = detailChip(page, target.variants[0].id);
  await chip.focus();
  await expect(chip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(new URL(page.url()).searchParams.get("variant")).toBe(target.variants[0].id);
  await expect(body.locator(".kh-guide")).toContainText("Thái Sử Từ · từ 3 đỏ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(chip).toBeVisible();
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

  const dongLong = teamByTitle("SP Lô Trực · Thái Sử Từ · Trương Xuân Hoa");
  await page.goto(detailPath(handles, dongLong.id));
  await expect(body.locator(".kh-build")).toBeVisible();
  await expect(body.locator(".kh-build")).not.toContainText(HAN);
});

/* ---------- Phase 6: khung chi tiết dùng chung, thẻ tướng dùng chung, không hiển thị nguồn ---------- */

/** Nguồn Khai hoang thay được nội dung (byte nguồn vẫn phải khớp pin của trang). */
async function routeDetailSource(page, mutate) {
  const payload = structuredClone(data);
  mutate(payload);
  const body = JSON.stringify(payload);
  const website = websiteDisplayFixture(
    {"data/khaihoang.json": body},
    {dropValuesFor: ["data/khaihoang.json"]},
  );
  await page.route("**/data/website-display.json", (route) =>
    route.fulfill({contentType: "application/json", body: website.body}));
  await page.route(khaihoangRequest, (route) =>
    route.fulfill({contentType: "application/json", body}));
  // Trang chi tiết ghim sha256 của nguồn: thay pin theo đúng byte đã định tuyến.
  const sourceSha = createHash("sha256").update(body).digest("hex");
  await page.route(DETAIL_DOCUMENT, async (route) => {
    const response = await route.fetch();
    const html = replaceWebsiteDisplayPin(await response.text(), website.pin)
      .replace(/data-khaihoang-sha256="sha256:[0-9a-f]{64}"/, `data-khaihoang-sha256="sha256:${sourceSha}"`);
    await route.fulfill({response, body: html});
  });
}

test("detail header carries the unit badge, the shared build block and the panel actions", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Chu Thái · Trương Phi · Trương Xuân Hoa");
  await routeDetail(page);
  await page.goto(detailPath(handles, target.id));
  const body = page.locator("#team-detail-body");
  await expect(body).toBeVisible();

  // Huy hiệu loại binh của cấu hình đang chọn nằm ở đầu trang, ngoài subtree build.
  await expect(page.locator("#team-detail-root .detail-badges .badge.unit")).toHaveText(target.unitType);
  await expect(page.locator("#team-detail-root .detail-score")).toHaveCount(0);
  await expect(page.locator("#team-detail-root .detail-title-zh")).toHaveCount(0);

  // Thẻ tướng cùng khung trang chi tiết Đội chuẩn: tên, "Chiến pháp trước" rồi "Chiến pháp sau" đánh số.
  const first = body.locator(".kh-build .kh-hero-card").first();
  const lead = displayHeroes(target)[0];
  await expect(first.locator(".hn")).toHaveText("Trương Phi");
  // Trương Phi là chủ tướng trước và sau cấp 20: ấn C đứng sau tên.
  await expect(first.locator(".detail-hero-label")).toHaveText(["Chiến pháp trước", "Chiến pháp sau"]);
  await expect(first.locator(".detail-hero-name .main-holder")).toHaveAttribute("title", "Chủ tướng");
  await expect(first.locator(".detail-hero-role")).toHaveText("Chủ tướng");
  await expect(first.locator(".kh-before .detail-hero-tactics-vi")).toHaveText([lead.tacticBefore]);
  await expect(first.locator(".kh-after .detail-hero-tactics-vi")).toHaveText(lead.tacticsAfter);
  await expect(first.locator(".kh-after .detail-hero-tactics-index")).toHaveText(lead.tacticsAfter.map((_, index) => String(index + 1)));
  // Chiến pháp chỉ hiển thị: không nút, không link trong khối build.
  await expect(body.locator(".kh-build button, .kh-build a")).toHaveCount(0);

  // Hành động: chỉ còn sao chép liên kết.
  await expect(page.locator("#team-detail-root #team-copy-link")).toBeVisible();
  await expect(page.locator("#team-detail-root #team-copy-fallback")).toBeHidden();
  await expect(page.locator("#team-detail-root .detail-source-link")).toHaveCount(0);
});

test("detail never renders source links or labels, even when the payload carries them", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const target = teamByTitle("Chu Thái · Trương Phi · Trương Xuân Hoa");
  await routeDetailSource(page, (payload) => {
    const team = payload.teams.find((item) => item.id === target.id);
    team.sources = [
      {label: "Nguồn hỏng", url: "javascript:document.title='pwned'"},
      {label: "Nguồn thật", url: "https://example.test/nguon-that"},
    ];
    for (const group of payload.chamSuTeams) group.sources = [{label: "Nguồn Chạm Sứ", url: "https://example.test/cham-su"}];
  });
  await page.goto(detailPath(handles, target.id));
  await expect(page.locator("#team-detail-body")).toBeVisible();
  const root = page.locator("#team-detail-root");
  await expect(root.locator(".detail-source-link, a[href^='https://example.test'], a[href^='javascript:']")).toHaveCount(0);
  await expect(root).not.toContainText(/Nguồn hỏng|Nguồn thật|Nguồn Chạm Sứ|javascript:/);
  await expect(page).toHaveTitle(/^(?!pwned).*/);
});

test("panel hành động của chi tiết Khai hoang và Đội khác không tràn khỏi khung (P06-B1)", async ({ page, request }) => {
  // 51 lần tải trang chi tiết trong một test: máy CI chậm vượt ngân sách 30 s mặc định.
  test.slow();
  const handles = await routeHandles(request);
  const ids = data.teams.map((team) => team.id);
  expect(ids.length).toBe(17);
  const boxes = () => page.evaluate(() => [...document.querySelectorAll(".detail-score-panel a, .detail-score-panel button, .detail-score-panel input")]
    .map((node) => { const rect = node.getBoundingClientRect(); return { text: node.textContent.trim().slice(0, 24) || node.type, left: Math.round(rect.left), right: Math.round(rect.right) }; }));
  /** Hai hộp có giao nhau theo cả hai trục (bàn đo không bắt được tràn sang trái). */
  const overlaps = () => page.evaluate(() => {
    const title = document.querySelector(".detail-title, .detail-hero-title");
    const panel = document.querySelector(".detail-score-panel");
    if (!title || !panel) return false;
    const a = title.getBoundingClientRect(), b = panel.getBoundingClientRect();
    return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
  });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ids) {
      await page.goto(detailPath(handles, id));
      await expect(page.locator("#team-detail-body")).toBeVisible();
      const found = await boxes();
      expect(found.length, `${id} ${width}: panel có control`).toBeGreaterThan(0);
      for (const item of found) {
        expect(item.left, `${id} ${width} ${item.text}: mép trái`).toBeGreaterThanOrEqual(0);
        expect(item.right, `${id} ${width} ${item.text}: mép phải`).toBeLessThanOrEqual(width);
      }
      expect(await overlaps(), `${id} ${width}: panel không phủ đầu trang`).toBe(false);
    }
    // Đội khác: clipboard bị từ chối vẫn không tràn khỏi khung.
    await page.goto("/doi-khac/tan-ngo-thuong/");
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error("denied")); });
    await page.locator(".detail-copy-btn").first().click();
    await expect(page.locator(".detail-copy-fallback").first()).toBeVisible();
    for (const item of await boxes()) {
      expect(item.left, `doi-khac ${width} ${item.text}: mép trái`).toBeGreaterThanOrEqual(0);
      expect(item.right, `doi-khac ${width} ${item.text}: mép phải`).toBeLessThanOrEqual(width);
    }
  }
});
