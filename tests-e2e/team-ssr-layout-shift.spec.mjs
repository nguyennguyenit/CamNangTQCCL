import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildSeasonCandidates } from "../js/roster-season-candidates.js";
import { holdBoot } from "./helpers/boot.mjs";

// Khung bộ lọc của /doi-chuan/ và /doi-khac/ do build phát sẵn (ô chọn mùa, thanh công cụ, sidebar lọc có chip đã đếm). Spec này khóa
// hai điều bằng cách giữ `js/app.js` lại (bản dựng sẵn thuần), đo, thả app.js, chờ boot rồi đo lại:
//   1. Bố cục không nhảy: thẻ đội đầu tiên (và sidebar ở desktop) giữ nguyên x, width; y chỉ được dịch đúng bằng thanh gợi ý kho.
//   2. Khung dựng sẵn là đúng khung client dựng: `.reference-head` và `.reference-results` trước và sau boot bằng nhau ở trạng thái mặc định.
//
// Thanh kho (`.reference-roster-bar`, #181) là phần lệch duy nhất được chấp nhận và KHÔNG bị giấu: khách (kho trống) luôn thấy thanh gợi ý
// ngay sau boot, nên thẻ đầu của Đội chuẩn dịch xuống đúng bằng chiều cao thanh cộng gap của `.reference-results-body` (±1px). Có kho
// thì thanh hiện khi kho và từ điển tải xong, cùng một luật. Đội khác không có thanh kho nên không được lệch.

const TOLERANCE = 1;
const PAGES = [["/doi-chuan/", "Đội chuẩn"], ["/doi-khac/", "Đội khác"]];
const LOCALES = [["vi", ""], ["zh", "/zh"], ["ja", "/ja"]];
const VIEWPORTS = [["desktop 1440", { width: 1440, height: 900 }], ["mobile 390", { width: 390, height: 844 }]];

/**
 * Chuẩn bị đo, chạy giống hệt trước MỖI lần đo (font và CSS chưa xong làm lệch vài px, không phải lỗi bố cục):
 *   1. stylesheet đã áp (`link.sheet` khác null);
 *   2. ép layout, rồi nạp đúng font đã tính (computed) của chữ trong thẻ, sidebar và thanh công cụ;
 *   3. `document.fonts.ready`, rồi đọc trong `requestAnimationFrame`.
 * Trả toạ độ theo hệ của tài liệu (không phụ thuộc vị trí cuộn).
 */
async function measure(page, { sidebar }) {
  await page.waitForFunction(() => document.querySelector('link[href="/css/styles.css"]')?.sheet != null);
  expect(await page.evaluate(() => document.querySelector('link[href="/css/styles.css"]')?.sheet != null), "styles.css phải áp xong trước khi đo").toBe(true);
  return page.evaluate(async (withSidebar) => {
    void document.documentElement.offsetHeight;
    const wanted = new Map();
    const want = (node, text) => {
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (!trimmed) return;
      const style = getComputedStyle(node);
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      wanted.set(font, `${wanted.get(font) ?? ""} ${trimmed}`);
    };
    for (const selector of [".reference-team-card", ".reference-filters", ".reference-toolbar"]) {
      const root = document.querySelector(selector);
      if (!root) continue;
      for (const node of [root, ...root.querySelectorAll("*")]) {
        want(node, [...node.childNodes].filter((child) => child.nodeType === Node.TEXT_NODE).map((child) => child.textContent).join(""));
        if (node.placeholder) want(node, node.placeholder);
      }
    }
    await Promise.all([...wanted].map(([font, text]) => document.fonts.load(font, text)));
    await document.fonts.ready;
    return new Promise((resolve) => requestAnimationFrame(() => {
      const rect = (node) => {
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return { x: box.left + window.scrollX, y: box.top + window.scrollY, width: box.width, height: box.height };
      };
      const bar = document.querySelector(".reference-roster-bar");
      const body = document.querySelector(".reference-results-body");
      const barShown = bar && !bar.hidden && getComputedStyle(bar).display !== "none";
      resolve({
        card: rect(document.querySelector("[data-reference-key]")),
        sidebar: withSidebar ? rect(document.querySelector(".reference-filters")) : null,
        bar: barShown ? { height: bar.getBoundingClientRect().height, state: bar.dataset.state ?? null } : null,
        gap: Number.parseFloat(getComputedStyle(body).rowGap) || 0,
        scrollY: window.scrollY,
      });
    }));
  }, sidebar);
}

/**
 * `outerHTML` của `.reference-head` và `.reference-results` sau khi bỏ những khác biệt có chủ đích giữa bản dựng sẵn và bản sau boot:
 * con của danh sách và của thanh kho (client vẽ lại), dấu chữ ký `data-ssr-signature` của danh sách (client gỡ khi nhận lại),
 * `hidden`/`data-state` của thanh kho, và `disabled`/`aria-disabled` của điều khiển (khung dựng sẵn bị khoá tới khi gắn sự kiện).
 */
const shellHtml = (page) => page.evaluate(() => {
  const strip = (root) => {
    for (const view of root.querySelectorAll(".reference-view")) {
      view.replaceChildren();
      view.removeAttribute("data-ssr-signature");
    }
    for (const bar of root.querySelectorAll(".reference-roster-bar")) {
      bar.replaceChildren();
      bar.removeAttribute("hidden");
      bar.removeAttribute("data-state");
    }
    for (const control of root.querySelectorAll("[disabled], [aria-disabled]")) {
      control.removeAttribute("disabled");
      control.removeAttribute("aria-disabled");
    }
    return root.outerHTML;
  };
  const take = (selector) => {
    const node = document.querySelector(selector);
    return node ? strip(node.cloneNode(true)) : null;
  };
  return { head: take(".reference-head"), results: take(".reference-results") };
});

/** Dấu trạng thái do script bảo vệ / app.js gắn lên mount (`data-ssr-source` là pin, không phải dấu trạng thái). */
const mountMarks = (page) => page.evaluate(() => {
  const mount = document.querySelector("#section-team-chuan, #section-team-khac");
  return mount.getAttributeNames().filter((name) => name.startsWith("data-ssr-") && name !== "data-ssr-source");
});

/** Chỗ khác nhau đầu tiên của hai chuỗi, đủ ngữ cảnh để đọc lỗi; null khi bằng nhau. */
function firstDifference(before, after) {
  if (before === after) return null;
  let at = 0;
  while (before[at] === after[at]) at += 1;
  return { at, before: before.slice(Math.max(0, at - 100), at + 160), after: after.slice(Math.max(0, at - 100), at + 160) };
}

/**
 * Các khẳng định chung cho hai lần đo; `expectBar`: có thanh kho hiện sau boot (Đội chuẩn) hay không (Đội khác).
 * Dùng `expect.soft` để một lần chạy báo đủ mọi chỗ lệch (x, y, width, sidebar, DOM) thay vì dừng ở chỗ đầu tiên.
 */
function expectStableLayout(label, before, after, { expectBar, sidebar }) {
  const dx = after.card.x - before.card.x;
  const dy = after.card.y - before.card.y;
  const dWidth = after.card.width - before.card.width;
  expect.soft(Math.abs(dx), `${label}: thẻ đầu lệch ngang ${dx}px`).toBeLessThanOrEqual(TOLERANCE);
  expect.soft(Math.abs(dWidth), `${label}: thẻ đầu đổi rộng ${dWidth}px`).toBeLessThanOrEqual(TOLERANCE);
  if (expectBar) {
    expect.soft(after.bar, `${label}: thanh gợi ý kho phải hiện ngay sau boot (#181)`).not.toBeNull();
    expect.soft(before.bar, `${label}: bản dựng sẵn chưa có thanh kho`).toBeNull();
  } else {
    expect.soft(after.bar, `${label}: Đội khác không có thanh kho`).toBeNull();
  }
  // Độ lệch dọc DUY NHẤT được phép: đúng chiều cao thanh kho cộng gap của thân kết quả.
  const barShift = after.bar ? after.bar.height + after.gap : 0;
  expect.soft(Math.abs(dy - barShift), `${label}: thẻ đầu lệch dọc ${dy}px, thanh kho + gap = ${barShift}px`).toBeLessThanOrEqual(TOLERANCE);
  if (sidebar) {
    for (const key of ["x", "y", "width", "height"]) {
      const delta = after.sidebar[key] - before.sidebar[key];
      expect.soft(Math.abs(delta), `${label}: sidebar lọc lệch ${key} ${delta}px`).toBeLessThanOrEqual(TOLERANCE);
    }
  }
}

for (const [locale, prefix] of LOCALES) {
  for (const [path, name] of PAGES) {
    for (const [viewport, size] of VIEWPORTS) {
      test(`${name} ${locale} ${viewport}px: khung dựng sẵn không làm bố cục nhảy khi boot và khớp DOM bản client`, async ({ page }) => {
        const label = `${prefix}${path} @${size.width}`;
        await page.setViewportSize(size);
        const release = await holdBoot(page, `${prefix}${path}`);
        expect(await page.locator(".reference-results").count(), `${label}: bản dựng sẵn phải mang khung lọc (.reference-results)`).toBe(1);
        const beforeHtml = await shellHtml(page);
        expect(await mountMarks(page), `${label}: trạng thái mặc định không có dấu trạng thái trước boot`).toEqual([]);
        const sidebar = size.width >= 1024;
        const before = await measure(page, { sidebar });
        if (sidebar) expect(before.sidebar?.width ?? 0, `${label}: sidebar dựng sẵn phải có chỗ ở desktop`).toBeGreaterThan(0);

        release();
        await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
        // Khách: thanh gợi ý kho hiện chắc chắn ngay sau boot (phiên giả trả null, kho trống); chờ nó trước khi đo lại.
        if (path === "/doi-chuan/") await expect(page.locator(".reference-roster-bar")).toHaveAttribute("data-state", "empty");
        const after = await measure(page, { sidebar });
        const afterHtml = await shellHtml(page);
        expect.soft(await mountMarks(page), `${label}: boot xong không còn dấu trạng thái`).toEqual([]);

        expectStableLayout(label, before, after, { expectBar: path === "/doi-chuan/", sidebar });
        expect.soft(firstDifference(beforeHtml.head, afterHtml.head), `${label}: .reference-head sau boot khác bản dựng sẵn`).toBeNull();
        expect.soft(firstDifference(beforeHtml.results, afterHtml.results), `${label}: .reference-results sau boot khác bản dựng sẵn`).toBeNull();
      });
    }
  }
}

// Máy có kho: thanh kho hiện khi kho và từ điển tải xong, vẫn là phần lệch dọc duy nhất và vẫn đúng bằng chiều cao thanh cộng gap.
const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const { generationId } = read("src/data/recommended-reference/current.json");
const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
const { defaultSourceSeasonId } = read(`src/data/recommended-reference/${generationId}/seasons.json`);
const dicts = { heroesDict: read("data/heroes-dict.json"), tacticsDict: read("data/tactics.json") };
const SCAN_KEY = "tqccl.rosterRecommend.scanState.v1";

/** Kho vừa đủ ráp một đội của mùa mặc định (cùng cách dựng với `rosterFor` của bai-viet-kho-redesign.spec.mjs). */
function rosterOfFirstTeam() {
  const [record] = records.filter((item) => item.sourceSeasonId === defaultSourceSeasonId);
  const { teams } = buildSeasonCandidates([record], defaultSourceSeasonId, dicts);
  const heroes = new Set();
  const tactics = new Set();
  for (const team of teams) {
    for (const hero of team.heroes) {
      heroes.add(hero.name);
      for (const tactic of hero.tactics) if (!tactic.unresolved) tactics.add(tactic.name);
    }
  }
  return { ownedHeroes: [...heroes].map((name) => ({ name })), ownedTactics: [...tactics].map((name) => ({ name })), lockedTeams: [], confirmed: true, updatedAt: "2026-11-11T00:00:00.000Z" };
}

for (const [viewport, size] of VIEWPORTS) {
  test(`Đội chuẩn vi ${viewport}px, máy có kho: thanh kho hiện sau khi kho tải xong là độ lệch dọc duy nhất, đúng bằng chiều cao thanh + gap`, async ({ page }) => {
    const roster = rosterOfFirstTeam();
    expect(roster.ownedHeroes.length, "kho giả phải có tướng").toBeGreaterThan(0);
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SCAN_KEY, JSON.stringify(roster)]);
    await page.setViewportSize(size);
    const release = await holdBoot(page, "/doi-chuan/");
    expect(await page.locator(".reference-results").count(), `/doi-chuan/ có kho @${size.width}: bản dựng sẵn phải mang khung lọc (.reference-results)`).toBe(1);
    const sidebar = size.width >= 1024;
    const before = await measure(page, { sidebar });
    release();
    await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
    await expect(page.locator(".reference-roster-bar")).toHaveAttribute("data-state", "ready");
    const after = await measure(page, { sidebar });
    expectStableLayout(`/doi-chuan/ có kho @${size.width}`, before, after, { expectBar: true, sidebar });
  });
}
