import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bootWithProbe } from "./helpers/boot.mjs";
import { serveHtmlInTwoChunks } from "./helpers/stream.mjs";
import { ROSTER_SCAN_KEY, rosterOfFirstTeam } from "./helpers/roster-fixture.mjs";

// Trang danh sách đội dựng sẵn: khi trạng thái đầu của trình duyệt khớp mặc định thì nhận lại đúng các node đó
// (không nháy, không nhân đôi); lệch mặc định (URL khác, kiểu hiển thị khác) thì thay như cũ.

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const { generationId } = read("src/data/recommended-reference/current.json");
const defaultSeason = read(`src/data/recommended-reference/${generationId}/seasons.json`).defaultSourceSeasonId;
const defaultSeasonTeams = read(`src/data/recommended-reference/${generationId}/index.json`).records
  .filter((row) => row.sourceSeasonId === defaultSeason).length;
const survivors = (page) => page.evaluate(() => window.__ssrNodes.filter((node) => node.isConnected).length);

for (const [locale, prefix] of [["vi", ""], ["zh", "/zh"]]) {
  test(`${locale}: Đội chuẩn/Đội khác/Khai hoang/Cùng Tồn ở trạng thái mặc định giữ nguyên node dựng sẵn và chỉ một h1`, async ({ page }) => {
    for (const [path, selector] of [
      ["/doi-chuan/", ".reference-team-card"],
      ["/doi-khac/", ".reference-team-card"],
      ["/cung-ton/", ".coexist-team-card"],
      ["/khai-hoang/", ".kh-card"],
    ]) {
      const prerendered = await bootWithProbe(page, `${prefix}${path}`, selector);
      // Đội chuẩn dựng sẵn đủ đội của mùa mặc định (kể cả khi hơn một lượt 60 đội): client nhận lại cả danh sách, không dựng lại.
      if (path === "/doi-chuan/") expect(prerendered, `${path}: SSR phải đủ đội của mùa mặc định`).toBe(defaultSeasonTeams);
      expect(await survivors(page), `${path}: node dựng sẵn bị thay`).toBe(prerendered);
      await expect(page.locator(selector), `${path}: nhân đôi thẻ`).toHaveCount(prerendered);
      await expect(page.locator("h1"), path).toHaveCount(1);
      await page.unroute("**/js/app.js");
    }
  });
}

test("Đội chuẩn: tìm chiến pháp từ chip của thẻ dựng sẵn vẫn hoạt động (sự kiện được gắn)", async ({ page }) => {
  await bootWithProbe(page, "/doi-chuan/", ".reference-team-card");
  const chip = page.locator(".reference-team-card button[data-tactic-search]").first();
  const value = await chip.getAttribute("data-tactic-search");
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(value).replace(/%20/g, "(?:\\+|%20)")}`));
});

test("Đội chuẩn: URL lệch mặc định (kiểu hiển thị khác) thay danh sách như cũ, không để lại thẻ dựng sẵn", async ({ page }) => {
  const prerendered = await bootWithProbe(page, "/doi-chuan/?view=bang", ".reference-team-card");
  expect(prerendered).toBeGreaterThan(0);
  expect(await survivors(page)).toBe(0);
  await expect(page.locator(".reference-team-card")).toHaveCount(0);
  await expect(page.locator(".reference-table tbody tr").first()).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
});

// Thân dựng sẵn là trạng thái mặc định: trang mở ở trạng thái khác thì danh sách mặc định không được hiện (và bấm được)
// suốt lúc app.js còn tải dữ liệu; trạng thái mặc định thì hiện ngay; app.js dựng xong thì danh sách hiện lại.
const STALE_CASES = [
  ["Đội chuẩn: mùa khác trong URL", "/doi-chuan/?season=pk-s24", "#section-team-chuan .reference-view", null, true],
  ["Đội chuẩn: kiểu Bảng đã lưu", "/doi-chuan/", "#section-team-chuan .reference-view", "bang", true],
  ["Đội chuẩn: giá trị lưu lạ vẫn là Thẻ", "/doi-chuan/", "#section-team-chuan .reference-view", "cards", false],
  ["Đội khác: bộ lọc trong URL", "/zh/doi-khac/?faction=thuc", "#section-team-khac .reference-view", null, true],
  ["Cùng Tồn: kịch bản trong URL", "/cung-ton/?scenario=x", "#section-coexist > .coexist-group-view", null, true],
  ["Khai hoang: cặp đang chọn trong URL", "/khai-hoang/?khTeam=x&khVariant=y", "#section-khaihoang .kh-team-view", null, true],
  // `kho`/`xep` chỉ thêm badge/đổi thứ tự khi máy có kho: người không có kho vẫn thấy ngay danh sách dựng sẵn.
  ["Đội chuẩn: kho và xep trong URL (không phải trạng thái khác mặc định)", "/doi-chuan/?kho=rap-duoc&xep=de-rap", "#section-team-chuan .reference-view", null, false],
  ["Đội chuẩn: kho kèm bộ lọc khác vẫn là trạng thái khác mặc định", "/doi-chuan/?q=x&kho=rap-duoc", "#section-team-chuan .reference-view", null, true],
  ["Khai hoang: mặc định", "/khai-hoang/", "#section-khaihoang .kh-team-view", null, false],
];
for (const [name, url, selector, storedView, hidden] of STALE_CASES) {
  test(`${name}: danh sách dựng sẵn ${hidden ? "ẩn" : "hiện"} trước khi app.js chạy`, async ({ page }) => {
    if (storedView) await page.addInitScript((value) => localStorage.setItem("tqccl.teamView.v1", value), storedView);
    await bootWithProbe(page, url, selector, async () => {
      expect(await page.locator(selector).evaluate((node) => getComputedStyle(node).visibility)).toBe(hidden ? "hidden" : "visible");
    });
    await expect(page.locator("[data-ssr-stale]")).toHaveCount(0);
  });
}

test("Đội chuẩn: nhận lại danh sách dựng sẵn thì link chi tiết là URL sạch, không mang nguồn quay lại", async ({ page }) => {
  await bootWithProbe(page, "/doi-chuan/", ".reference-team-card");
  const hrefs = await page.locator(".reference-team-card a[data-team-detail-link]").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, "link chi tiết Đội chuẩn là URL canonical trần").toMatch(/^\/doi-chuan\/[^/?#]+\/$/);
  }
});

test("Đội chuẩn: ?kho=&xep= khi máy chưa có kho vẫn nhận lại nguyên node dựng sẵn (chữ ký không còn URL)", async ({ page }) => {
  const prerendered = await bootWithProbe(page, "/doi-chuan/?kho=rap-duoc&xep=de-rap", ".reference-team-card");
  expect(prerendered).toBe(defaultSeasonTeams);
  expect(await survivors(page), "node dựng sẵn bị thay").toBe(prerendered);
  await expect(page.locator(".reference-team-card")).toHaveCount(prerendered);
  // Chưa biết mùa có độ phủ hay không (máy chưa có kho): giữ `kho`/`xep` trên URL.
  expect(new URL(page.url()).search).toBe("?kho=rap-duoc&xep=de-rap");
});

// Nút dựng sẵn chưa có sự kiện: khoá đến khi trình duyệt gắn xong (bấm lúc đó không được "im lặng").
const CONTROLS = [
  ["/doi-chuan/", ".reference-team-card", ".reference-team-card button[data-tactic-search]"],
  ["/doi-khac/", ".reference-team-card", ".reference-team-card button[data-tactic-search]"],
  ["/khai-hoang/", ".kh-card", ".kh-config-chip, .kh-unit-chip"],
];
for (const [path, selector, controls] of CONTROLS) {
  test(`${path}: nút dựng sẵn bị khoá trước khi app.js gắn sự kiện và mở lại sau đó`, async ({ page }) => {
    await bootWithProbe(page, path, selector, async () => {
      const state = await page.evaluate((query) => [...document.querySelectorAll(query)].map((node) => [node.disabled, node.getAttribute("aria-disabled")]), controls);
      expect(state.length, `${path}: phải có nút dựng sẵn`).toBeGreaterThan(0);
      for (const [disabled, ariaDisabled] of state) {
        expect(disabled).toBe(true);
        expect(ariaDisabled).toBe("true");
      }
    });
    const after = await page.evaluate((query) => [...document.querySelectorAll(query)].filter((node) => node.disabled || node.hasAttribute("aria-disabled")).length, controls);
    expect(after, `${path}: nút còn bị khoá sau khi boot`).toBe(0);
  });
}

test("Khai hoang: nhận lại danh sách dựng sẵn không tháo/gắn lại nó (focus của người đã tab vào thẻ được giữ)", async ({ page }) => {
  await bootWithProbe(page, "/khai-hoang/", ".kh-card", async () => {
    await page.evaluate(() => {
      const link = document.querySelector(".kh-card a.kh-title-link");
      link.focus();
      window.__focused = link;
      window.__khRoot = document.querySelector(".khaihoang");
    });
  });
  expect(await page.evaluate(() => window.__khRoot.isConnected && document.activeElement === window.__focused)).toBe(true);
});

test("Đội chuẩn: lỗi dữ liệu hiện ở đầu mục, trước các thẻ dựng sẵn", async ({ page }) => {
  await page.route("**/data/recommended/**", (route) => route.abort());
  await page.goto("/doi-chuan/");
  await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
  const errorFirst = await page.evaluate(() => {
    const error = document.querySelector("main .error");
    const card = document.querySelector("main .reference-team-card");
    return Boolean(error) && (!card || Boolean(error.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(errorFirst).toBe(true);
});

// ---------- Khung lọc dựng sẵn (thanh công cụ, sidebar lọc, ô chọn mùa, "Xem thêm") ----------
// HTML dựng sẵn có luôn khung bộ lọc quanh danh sách nên bố cục không nhảy khi app.js boot. Điều khiển của khung bị khoá tới lúc
// app.js gắn xong; client giữ nguyên node khung (đầu mục, khung kết quả, danh sách) và chỉ thay con của ô chọn mùa, thanh công cụ
// và sidebar trong cùng một task, nên focus của người đã tab vào thẻ không mất.
const REFERENCE_PAGES = [["/doi-chuan/", true], ["/doi-khac/", false]];
/** Điều khiển của khung (không tính nút nằm trong danh sách thẻ). */
const SHELL_CONTROLS = ".reference-head select, .reference-toolbar :is(button, input), .reference-filters :is(button, input, select), .reference-more button";

for (const [path, hasSeasonSelect] of REFERENCE_PAGES) {
  test(`${path}: khung lọc dựng sẵn có mặt và bị khoá trước khi app.js chạy, dùng được sau boot`, async ({ page }) => {
    await bootWithProbe(page, path, ".reference-team-card", async () => {
      await expect(page.locator(".reference-toolbar")).toHaveCount(1);
      await expect(page.locator("aside.reference-filters")).toHaveCount(1);
      await expect(page.locator(".reference-head select")).toHaveCount(hasSeasonSelect ? 1 : 0);
      const state = await page.evaluate((query) => [...document.querySelectorAll(query)].map((node) => [node.tagName, node.disabled, node.getAttribute("aria-disabled")]), SHELL_CONTROLS);
      expect(state.length, `${path}: phải có điều khiển của khung`).toBeGreaterThanOrEqual(10);
      for (const [tag, disabled, ariaDisabled] of state) {
        expect(disabled, tag).toBe(true);
        expect(ariaDisabled, tag).toBe("true");
      }
    });
    // Sau boot: không điều khiển nào của khung còn bị khoá; riêng "Xóa lọc" tự vô hiệu vì chưa có lọc nào (không mang aria-disabled).
    const left = await page.evaluate((query) => [...document.querySelectorAll(query)]
      .filter((node) => node.hasAttribute("aria-disabled") || (node.disabled && !node.matches(".clear-btn"))).length, SHELL_CONTROLS);
    expect(left, `${path}: điều khiển của khung còn bị khoá sau boot`).toBe(0);
    await expect(page.locator(".reference-search-input")).toBeEnabled();
    await expect(page.locator(".view-btn").first()).toBeEnabled();
    await expect(page.locator(".reference-filters .fchip").first()).toBeEnabled();
    await expect(page.locator(".reference-filters .clear-btn")).toBeDisabled();
    await expect(page.locator(".reference-filters .clear-btn")).not.toHaveAttribute("aria-disabled");
    if (hasSeasonSelect) await expect(page.locator(".reference-head select")).toBeEnabled();
    // Khung trước boot đã đúng khung sau boot ở trạng thái mặc định: "Xem thêm" của Đội khác (60 team đầu trên hơn 60 team) vẫn có nút.
    if (!hasSeasonSelect) await expect(page.locator(".reference-more button.lookup-more")).toBeEnabled();
  });

  test(`${path}: client giữ nguyên node khung dựng sẵn, chỉ thay con của ô chọn mùa, thanh công cụ và sidebar`, async ({ page }) => {
    const kept = ".reference-head, .reference-browser, .reference-results, .reference-toolbar, aside.reference-filters, .reference-results-body, .reference-view, .reference-team-card";
    const prerendered = await bootWithProbe(page, path, `${kept}${hasSeasonSelect ? ", label.reference-season-field" : ""}`);
    expect(await survivors(page), `${path}: node khung dựng sẵn bị thay`).toBe(prerendered);
    await expect(page.locator(".reference-toolbar .reference-search-input")).toBeEnabled();
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test(`${path}: tab vào link của thẻ đầu trước boot thì sau boot focus vẫn ở đó`, async ({ page }) => {
    await bootWithProbe(page, path, ".reference-team-card", async () => {
      // Điều khiển của khung bị khoá nên Tab bỏ qua chúng; tới link đầu tiên của thẻ đầu tiên.
      for (let step = 0; step < 80; step += 1) {
        await page.keyboard.press("Tab");
        if (await page.evaluate(() => document.activeElement?.matches(".reference-team-card a"))) break;
      }
      expect(await page.evaluate(() => document.activeElement?.matches(".reference-team-card a"))).toBe(true);
      await page.evaluate(() => { window.__focused = document.activeElement; });
    });
    expect(await page.evaluate(() => window.__focused.isConnected && document.activeElement === window.__focused)).toBe(true);
  });
}

// Trang mở ở trạng thái khác mặc định: số đếm, chip, nút kiểu hiển thị, ô chọn mùa và huy hiệu "Đang diễn ra" của khung dựng sẵn
// sẽ sai, nên ẩn (vẫn giữ chỗ) tới khi app.js dựng đúng; sau boot hiện đúng theo URL.
const STALE_PARTS = ".reference-filters .chip-row, .reference-filters .clear-btn, .reference-filter-head, .reference-count, .reference-view-toggle, .reference-search-input, label.reference-season-field > *";
const SHELL_STALE_CASES = [
  ["Đội chuẩn: bộ lọc trong URL", `/doi-chuan/?faction=${encodeURIComponent("Thục")}`, null,
    (page) => expect(page.locator('.fchip[data-focus-key="faction:Thục"]')).toHaveAttribute("aria-pressed", "true")],
  ["Đội chuẩn: mùa khác trong URL", "/doi-chuan/?season=pk-s24", null,
    async (page) => {
      await expect(page.locator("#section-team-chuan select")).toHaveValue("pk-s24");
      await expect(page.locator(".reference-season-status")).toBeHidden();
    }],
  ["Đội chuẩn: tất cả mùa", "/doi-chuan/?season=all", null,
    (page) => expect(page.locator("#section-team-chuan select")).toHaveValue("all")],
  ["Đội khác: kiểu Bảng đã lưu", "/doi-khac/", "bang",
    (page) => expect(page.locator(".view-btn-bang")).toHaveAttribute("aria-pressed", "true")],
];
for (const [name, url, storedView, check] of SHELL_STALE_CASES) {
  test(`${name}: chip, số đếm, nút kiểu hiển thị, ô chọn mùa và huy hiệu ẩn (giữ chỗ) trước boot, hiện đúng theo URL sau boot`, async ({ page }) => {
    if (storedView) await page.addInitScript((value) => localStorage.setItem("tqccl.teamView.v1", value), storedView);
    await bootWithProbe(page, url, ".reference-team-card", async () => {
      const hidden = await page.evaluate((query) => [...document.querySelectorAll(query)].map((node) => [node.className?.baseVal ?? node.className ?? node.tagName, getComputedStyle(node).visibility]), STALE_PARTS);
      expect(hidden.length, `${url}: phải có phần phụ thuộc trạng thái`).toBeGreaterThan(0);
      for (const [part, visibility] of hidden) expect(visibility, `${url}: ${part}`).toBe("hidden");
      // Giữ chỗ: khung vẫn chiếm chỗ (ẩn bằng visibility, không bằng display).
      for (const selector of [".reference-toolbar", "aside.reference-filters"]) {
        const box = await page.locator(selector).boundingBox();
        expect(box?.height ?? 0, `${url}: ${selector} phải giữ chỗ`).toBeGreaterThan(20);
      }
    });
    await check(page);
    // Nút "Xóa lọc" khi không có gì để xóa vẫn ẩn theo kiểu sẵn có (`.clear-btn:disabled`, giữ chỗ): không tính là còn ẩn vì dấu stale.
    const stillHidden = await page.evaluate((query) => [...document.querySelectorAll(query)].filter((node) => getComputedStyle(node).visibility === "hidden" && !node.matches(".clear-btn:disabled")).length, STALE_PARTS);
    expect(stillHidden, `${url}: phần khung còn ẩn sau boot`).toBe(0);
    await expect(page.locator("[data-ssr-stale]")).toHaveCount(0);
  });
}

// HTML về dần qua mạng: script bảo vệ phải chạy TRƯỚC khi nút nào của thân dựng sẵn được tạo. Đặt nó sau mount thì khung (ô chọn mùa,
// huy hiệu "Đang diễn ra", chip, số đếm) ở trạng thái mặc định hiện sai mùa/bộ lọc suốt lúc danh sách còn đang về. Máy chủ cục bộ cắt HTML
// ngay trước danh sách và giữ đoạn sau (`serveHtmlInTwoChunks`); đo ở khoảng giữa hai đoạn, rồi thả đoạn sau để trang boot.
const STREAM_CUT = '<div class="reference-view" data-ssr-signature=';
const STREAM_CASES = [
  ["Đội chuẩn: mùa khác trong URL", "/doi-chuan/", "?season=pk-s24", true],
  ["Đội chuẩn: bộ lọc trong URL", "/doi-chuan/", `?faction=${encodeURIComponent("Thục")}`, true],
  ["Đội khác: bộ lọc trong URL", "/doi-khac/", `?faction=${encodeURIComponent("Thục")}`, false],
];
/** Phần phụ thuộc trạng thái của khung và `visibility` đã tính của từng phần. */
const staleParts = (page) => page.evaluate((query) => [...document.querySelectorAll(query)].map((node) => [node.className?.baseVal ?? node.className ?? node.tagName, getComputedStyle(node).visibility]), STALE_PARTS);

for (const [name, path, query, hasSeasonSelect] of STREAM_CASES) {
  test(`${name}: HTML về dần, khung đã ở trạng thái stale ngay ở đoạn đầu khi danh sách còn chưa về`, async ({ page, baseURL }) => {
    const stream = await serveHtmlInTwoChunks(baseURL, { documentPath: path, cutBefore: STREAM_CUT });
    const url = `${path}${query}`;
    try {
      await page.goto(`${stream.origin}${url}`, { waitUntil: "commit" });
      // Đoạn đầu mới tới sidebar lọc: khung đã có trong DOM, danh sách thì chưa.
      await page.locator("aside.reference-filters").waitFor({ state: "attached" });
      await page.waitForFunction(() => document.querySelector('link[href="/css/styles.css"]')?.sheet != null);
      await expect(page.locator(".reference-view"), `${url}: đoạn đầu phải dừng trước danh sách`).toHaveCount(0);
      // Trình phân tích HTML dừng ở script nên script đứng trước khung đã chạy xong khi khung vào DOM; không cần chờ.
      await expect(page.locator(".section[data-ssr-stale]"), `${url}: khung đã vào DOM mà script bảo vệ chưa chạy`).toHaveCount(1);
      const parts = await staleParts(page);
      expect(parts.length, `${url}: phải có phần phụ thuộc trạng thái`).toBeGreaterThan(0);
      for (const [part, visibility] of parts) expect(visibility, `${url}: ${part} đang hiện ở trạng thái mặc định`).toBe("hidden");
      if (hasSeasonSelect) {
        await expect(page.locator("label.reference-season-field select"), `${url}: ô chọn mùa mặc định đang hiện`).toHaveCSS("visibility", "hidden");
        await expect(page.locator(".reference-season-status"), `${url}: huy hiệu "Đang diễn ra" đang hiện`).toHaveCSS("visibility", "hidden");
      }
      // Đoạn sau về: trang boot và dựng đúng trạng thái của URL; không phần nào của khung còn ẩn.
      stream.release();
      await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
      await expect(page.locator("[data-ssr-stale]")).toHaveCount(0);
      if (query.startsWith("?season=")) await expect(page.locator("#section-team-chuan select")).toHaveValue("pk-s24");
      const stillHidden = (await staleParts(page)).filter(([part, visibility]) => visibility === "hidden" && !/clear-btn/.test(part));
      expect(stillHidden, `${url}: phần khung còn ẩn sau boot`).toEqual([]);
    } finally {
      await stream.close();
    }
  });
}

test("Đội chuẩn: HTML về dần ở trạng thái mặc định (URL trống) thì khung hiện đủ, không dấu stale", async ({ page, baseURL }) => {
  const stream = await serveHtmlInTwoChunks(baseURL, { documentPath: "/doi-chuan/", cutBefore: STREAM_CUT });
  try {
    await page.goto(`${stream.origin}/doi-chuan/`, { waitUntil: "commit" });
    await page.locator("aside.reference-filters").waitFor({ state: "attached" });
    await page.waitForFunction(() => document.querySelector('link[href="/css/styles.css"]')?.sheet != null);
    await expect(page.locator(".reference-view")).toHaveCount(0);
    await expect(page.locator("[data-ssr-stale]")).toHaveCount(0);
    const parts = await staleParts(page);
    expect(parts.length).toBeGreaterThan(0);
    // "Xóa lọc" tự vô hiệu khi chưa có lọc (`.clear-btn:disabled`, giữ chỗ): không thuộc dấu stale.
    for (const [part, visibility] of parts.filter(([part]) => !/clear-btn/.test(part))) expect(visibility, `mặc định: ${part} bị ẩn`).toBe("visible");
    stream.release();
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
  } finally {
    await stream.close();
  }
});

// Dữ liệu Đội chuẩn/Đội khác không tải được: không điều khiển chết nào của khung được hiện, danh sách (bản dựng sẵn) chiếm cả hàng.
for (const [path, hasSeasonSelect] of REFERENCE_PAGES) {
  test(`${path}: dữ liệu không tải được thì khung lọc chết bị ẩn, danh sách đọc được chiếm cả hàng`, async ({ page }) => {
    await page.route("**/data/recommended/**", (route) => route.abort());
    await page.goto(path);
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
    await expect(page.locator("main .error")).toBeAttached();
    await expect(page.locator(".section[data-ssr-failed]")).toHaveCount(1);
    for (const selector of [".reference-toolbar", ".reference-filters", "label.reference-season-field", ".reference-more"]) {
      const hidden = await page.locator(selector).evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).display === "none"));
      expect(hidden, `${path}: ${selector} phải ẩn`).toBe(true);
    }
    await expect(page.locator(".reference-team-card").first()).toBeVisible();
    const widths = await page.evaluate(() => [".reference-results", ".reference-results-body"].map((selector) => document.querySelector(selector).getBoundingClientRect().width));
    expect(Math.abs(widths[0] - widths[1]), `${path}: danh sách phải chiếm cả hàng (${widths})`).toBeLessThanOrEqual(1);
    if (!hasSeasonSelect) await expect(page.locator(".reference-season-static")).toBeVisible();
  });
}

// Quay lại từ trang chi tiết trên mobile khi panel lọc đang mở: snapshot ghi `disclosures.filters = true`; panel phải mở sẵn trong
// HTML dựng sẵn (trước boot) để lúc app.js mở lại panel, thân danh sách (và thẻ đầu trong đó) không bị đẩy xuống. Lọc/sắp theo kho
// (`?kho=`/`?xep=`) hoãn khôi phục thẻ đích, focus và cuộn tới khi kho tới, nhưng panel không phụ thuộc danh sách nên vẫn mở ngay: mở
// muộn thì nó đẩy danh sách xuống đúng lúc kho tới.

/**
 * Đo khi quay lại danh sách trên mobile, so với đầu mục (không phụ thuộc cuộn): panel lọc có mở không, cao bao nhiêu và đầu thân danh sách
 * ở đâu. Thanh kho nằm TRONG thân và hiện sau boot theo trạng thái kho trên máy (không thuộc khung dựng sẵn), nên đo đầu thân chứ không đo
 * thẻ đầu.
 */
const measureBack = (page) => page.evaluate(() => {
  const section = document.querySelector("#section-team-chuan");
  const filters = section.querySelector("aside.reference-filters");
  const body = section.querySelector(".reference-results-body");
  const origin = section.getBoundingClientRect().top;
  return {
    display: getComputedStyle(filters).display,
    panel: Math.round(filters.getBoundingClientRect().height),
    body: Math.round(body.getBoundingClientRect().top - origin),
  };
});

/** Cổng giữ request cho tới khi `open()`. */
const gate = () => {
  let open;
  const promise = new Promise((resolve) => { open = resolve; });
  return { promise, open };
};

/**
 * Request chỉ kho cần: `loadLookupPayload` (`js/app.js`) đọc manifest trước khi kiểm hai từ điển, nên giữ manifest là giữ kho. Không giữ chính
 * `heroes-dict`/`tactics`: mô hình mùa của boot cũng đọc chúng, giữ chúng sẽ chặn cả boot.
 */
const ROSTER_ONLY_REQUESTS = ["/data/lookup-manifest.json"];

for (const query of ["", "?kho=rap-duoc", "?xep=de-rap"]) {
  test(`Đội chuẩn trên mobile${query ? ` (${query})` : ""}: quay lại khi panel lọc đang mở thì panel mở sẵn trước boot và danh sách không bị đẩy khi boot`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`/doi-chuan/${query}`);
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
    await page.locator("#section-team-chuan .filter-collapse-toggle").click();
    await expect(page.locator("#section-team-chuan aside.reference-filters")).toBeVisible();
    await page.locator("#section-team-chuan .reference-team-card a[data-team-detail-link]").first().click();
    await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
    const appGate = gate();
    await page.route("**/js/app.js", async (route) => { await appGate.promise; await route.continue(); });
    await page.goBack({ waitUntil: "commit" });
    await page.locator(".site-footer").waitFor({ state: "attached" });
    expect(new URL(page.url()).search, "URL quay lại giữ nguyên lọc/sắp theo kho").toBe(query);
    const before = await measureBack(page);
    expect(before.display, "panel lọc phải mở sẵn trước boot").not.toBe("none");
    expect(before.panel, "panel lọc phải có chiều cao thật trước boot").toBeGreaterThan(100);
    appGate.open();
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
    // Khách: kho trả về (rỗng) ngay sau boot rồi bước khôi phục bị hoãn mới chạy; đo sau đó để bắt cả độ lệch của nó.
    await expect(page.locator(".reference-roster-bar")).toHaveAttribute("data-state", "empty");
    const after = await measureBack(page);
    expect(after.display, "panel lọc vẫn mở sau boot").not.toBe("none");
    expect(Math.abs(after.panel - before.panel), `panel đổi cao ${after.panel - before.panel}px khi boot`).toBeLessThanOrEqual(1);
    expect(Math.abs(after.body - before.body), `danh sách bị đẩy ${after.body - before.body}px khi boot`).toBeLessThanOrEqual(1);
    await expect(page.locator("#section-team-chuan .filter-collapse-toggle")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("[data-ssr-filters-open]")).toHaveCount(0);
    await context.close();
  });
}

// Máy có kho: kho tới muộn vì manifest Tra cứu còn đang tải (ở khách thì kho trả về ngay trong cùng task với boot nên không quan sát được).
// Bước khôi phục bị hoãn tới lúc đó chỉ gồm thẻ đích/focus/cuộn; panel lọc phải còn mở NGAY SAU boot, không đóng khi boot kết thúc rồi mới
// mở lại khi kho tới, nên đầu thân danh sách không dịch ở cả hai thời điểm.
test("Đội chuẩn trên mobile (?kho=, máy có kho): ngay sau boot, lúc kho chưa tới, panel lọc vẫn mở và đầu thân danh sách không dịch", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [ROSTER_SCAN_KEY, JSON.stringify(rosterOfFirstTeam())]);
  const page = await context.newPage();
  const appGate = gate();
  const rosterGate = gate();
  try {
    await page.goto("/doi-chuan/?kho=rap-duoc");
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
    await expect(page.locator(".reference-roster-bar")).toHaveAttribute("data-state", "ready");
    await page.locator("#section-team-chuan .filter-collapse-toggle").click();
    await expect(page.locator("#section-team-chuan aside.reference-filters")).toBeVisible();
    await page.locator("#section-team-chuan .reference-team-card a[data-team-detail-link]").first().click();
    await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
    await page.route("**/js/app.js", async (route) => { await appGate.promise; await route.continue(); });
    // Kho chỉ tới khi manifest tải xong: giữ nó lại để quan sát trang trong lúc kho chưa tới.
    await page.route((url) => ROSTER_ONLY_REQUESTS.includes(url.pathname), async (route) => { await rosterGate.promise; await route.continue(); });
    await page.goBack({ waitUntil: "commit" });
    await page.locator(".site-footer").waitFor({ state: "attached" });
    const before = await measureBack(page);
    expect(before.display, "panel lọc phải mở sẵn trước boot").not.toBe("none");
    expect(before.panel, "panel lọc phải có chiều cao thật trước boot").toBeGreaterThan(100);
    appGate.open();
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
    await expect(page.locator(".reference-roster-bar"), "kho chưa tới nên thanh kho chưa hiện").toHaveJSProperty("hidden", true);
    const atBoot = await measureBack(page);
    expect(atBoot.display, "panel lọc phải còn mở ngay sau boot, lúc kho chưa tới").not.toBe("none");
    expect(Math.abs(atBoot.panel - before.panel), `panel đổi cao ${atBoot.panel - before.panel}px khi boot`).toBeLessThanOrEqual(1);
    expect(Math.abs(atBoot.body - before.body), `danh sách bị đẩy ${atBoot.body - before.body}px khi boot`).toBeLessThanOrEqual(1);
    await expect(page.locator("[data-ssr-filters-open]")).toHaveCount(0);
    await expect(page.locator("#section-team-chuan .filter-collapse-toggle")).toHaveAttribute("aria-expanded", "true");
    rosterGate.open();
    await expect(page.locator(".reference-roster-bar")).toHaveAttribute("data-state", "ready");
    // Kho tới: panel vẫn mở (bước hoãn không đóng/mở lại nó). Đầu thân danh sách lúc này dịch vì phần phụ thuộc kho hiện muộn (huy hiệu
    // số bộ lọc `kho` làm thanh công cụ cao thêm, thanh kho): cùng loại với #181, không thuộc việc mở panel nên không đo ở đây.
    const after = await measureBack(page);
    expect(after.display, "panel lọc vẫn mở khi kho tới").not.toBe("none");
    expect(Math.abs(after.panel - before.panel), `panel đổi cao ${after.panel - before.panel}px khi kho tới`).toBeLessThanOrEqual(1);
    await expect(page.locator("#section-team-chuan .filter-collapse-toggle")).toHaveAttribute("aria-expanded", "true");
  } finally {
    appGate.open();
    rosterGate.open();
    await context.close();
  }
});
