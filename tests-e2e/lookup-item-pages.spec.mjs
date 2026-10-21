import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

// Trang riêng từng mục Tra cứu (/tra-cuu/<nhóm>/<slug>/): thẻ ở trang nhóm là link tới trang đó, click thường vẫn mở hộp
// thoại; trang riêng đọc được không cần JavaScript; trang nhóm dựng sẵn đủ mọi mục nhưng khi có JavaScript chỉ trang đầu hiện.
const LEDGER = JSON.parse(readFileSync(new URL("../pipeline/lookup-route-handles.json", import.meta.url), "utf8")).handles;
const GROUP_SLUG = { heroes: "tuong", tactics: "chien-phap", equipment: "trang-bi", advisors: "quan-su", "troop-mods": "cai-tao-binh-chung", buildings: "cong-trinh", books: "binh-thu" };
const LOCALES = [["vi", ""], ["zh", "/zh"]];
const itemPath = (group, id, prefix = "") => `${prefix}/tra-cuu/${GROUP_SLUG[group]}/${LEDGER[group][id]}/`;
const firstId = (group) => Object.keys(LEDGER[group])[0];

for (const [locale, prefix] of LOCALES) {
  test(`${locale}: thẻ tướng là link tới trang riêng, click thường mở hộp thoại tại chỗ`, async ({ page }) => {
    await page.goto(`${prefix}/tra-cuu/tuong/`);
    await expect(page.locator("body[data-boot=ready]")).toBeAttached();
    const card = page.locator("a[data-lookup-id]").first();
    const id = await card.getAttribute("data-lookup-id");
    await expect(card).toHaveAttribute("href", itemPath("heroes", id, prefix));
    await card.click();
    await expect(page.locator(".lookup-dialog")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tra-cuu/tuong/\\?id=`));
  });

  test(`${locale}: hàng bảng chiến pháp và danh sách catalog cũng là link tới trang riêng`, async ({ page }) => {
    for (const [group, selector] of [["tactics", ".lookup-table-name"], ["equipment", ".lookup-master-item"], ["buildings", ".lookup-master-item"], ["books", "a[data-lookup-id]"]]) {
      await page.goto(`${prefix}/tra-cuu/${GROUP_SLUG[group]}/`);
      await expect(page.locator("body[data-boot=ready]")).toBeAttached();
      const first = page.locator(selector).first();
      const id = await first.getAttribute("data-lookup-id");
      await expect(first).toHaveAttribute("href", itemPath(group, id, prefix));
    }
  });
}

test("Ctrl/Cmd + click để trình duyệt mở link trang riêng, không mở hộp thoại", async ({ page, context }) => {
  await page.goto("/tra-cuu/tuong/");
  await expect(page.locator("body[data-boot=ready]")).toBeAttached();
  const card = page.locator("a[data-lookup-id]").first();
  const href = await card.getAttribute("href");
  const popup = context.waitForEvent("page");
  await card.click({ modifiers: ["ControlOrMeta"] });
  const opened = await popup;
  await expect(opened).toHaveURL(new RegExp(`${href}$`, "u"));
  await expect(page.locator(".lookup-dialog")).toHaveCount(0);
});

test("link cũ ?id= vẫn mở hộp thoại hồ sơ trên trang nhóm", async ({ page }) => {
  const id = firstId("tactics");
  await page.goto(`/tra-cuu/chien-phap/?id=${encodeURIComponent(id)}`);
  await expect(page.locator(".lookup-dialog")).toBeVisible();
});

test("trang nhóm dựng sẵn đủ mọi mục; có JavaScript chỉ trang đầu hiện, sau boot DOM giữ đúng trang đầu", async ({ page }) => {
  const total = Object.keys(LEDGER.heroes).length;
  // Chặn app.js: giữ nguyên HTML dựng sẵn để xem trạng thái trước boot.
  await page.route("**/js/app.js", (route) => route.abort());
  await page.goto("/tra-cuu/tuong/");
  await expect(page.locator("a[data-lookup-id]")).toHaveCount(total);
  await expect(page.locator("a[data-lookup-id]").first()).toBeVisible();
  await expect(page.locator("a[data-lookup-id]").nth(60)).toBeHidden();
  await expect(page.locator(".lookup-more")).toBeVisible();
  await page.unroute("**/js/app.js");
  await page.reload();
  await expect(page.locator("body[data-boot=ready]")).toBeAttached();
  await expect(page.locator("a[data-lookup-id]")).toHaveCount(60);
  await page.locator(".lookup-more").click();
  await expect(page.locator("a[data-lookup-id]")).toHaveCount(120);
});

const needleEffect = { vi: /Hiệu ứng/u, zh: /效果/u };

for (const [locale, prefix] of LOCALES) {
  test(`${locale}: hộp thoại chiến pháp chữ Hán dịch mang cờ bản dịch (có JavaScript)`, async ({ page }) => {
    await page.goto(`${prefix}/tra-cuu/chien-phap/?id=tactic%3Atran-ap-khan-vang`);
    await expect(page.locator("body[data-boot=ready]")).toBeAttached();
    await expect(page.locator('.lookup-dialog .lookup-tactic-effect-head [data-zh-source="translation"]')).toHaveCount(1);
  });
}

test.describe("không có JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const [locale, prefix] of LOCALES) {
    test(`${locale}: trang nhóm hiện đủ mọi mục, không còn hàng "Xem thêm" vô tác dụng`, async ({ page }) => {
      await page.goto(`${prefix}/tra-cuu/chien-phap/`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("a[data-lookup-id]")).toHaveCount(Object.keys(LEDGER.tactics).length);
      await expect(page.locator("a[data-lookup-id]").last()).toBeVisible();
      await expect(page.locator(".lookup-more")).toBeHidden();
    });

    for (const [group, needle] of [
      ["heroes", { vi: /Chỉ số[\s\S]*Vũ lực/u, zh: /属性[\s\S]*武力/u }],
      ["tactics", { vi: /Hiệu ứng[\s\S]*Cách nhận/u, zh: /效果[\s\S]*获取方式/u }],
      ["books", { vi: /Hiệu ứng/u, zh: /效果/u }],
      ["equipment", { vi: /Đặc kỹ/u, zh: /特技/u }],
      ["advisors", { vi: /Võ tướng/u, zh: /武将/u }],
      ["troop-mods", { vi: /Hiệu quả/u, zh: /进阶/u }],
      ["buildings", { vi: /Theo cấp/u, zh: /按等级/u }],
    ]) {
      test(`${locale} ${group}: trang riêng của mục đọc được, có một h1 và link quay lại trang nhóm`, async ({ page }) => {
        const id = firstId(group);
        await page.goto(itemPath(group, id, prefix), { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).not.toBeEmpty();
        await expect(page.locator("[data-lookup-item-root]")).toContainText(needle[locale]);
        await expect(page.locator("a.detail-back-link")).toHaveAttribute("href", `${prefix}/tra-cuu/${GROUP_SLUG[group]}/`);
      });
    }

    // Cờ "chữ Hán dịch từ tiếng Việt" (lookup.effectZhSource.kind === "translation") có trong HTML tĩnh; mục source/capture không có.
    test(`${locale}: trang riêng chiến pháp chữ Hán dịch có cờ bản dịch, mục có nguồn hoặc chụp client không có`, async ({ page }) => {
      await page.goto(itemPath("tactics", "tactic:tran-ap-khan-vang", prefix), { waitUntil: "domcontentloaded" });
      await expect(page.locator('.lookup-tactic-effect-head [data-zh-source="translation"]')).toHaveCount(1);
      for (const id of ["tactic:ap-che", "tactic:tinh-bach-ma-nghia-tong"]) {
        await page.goto(itemPath("tactics", id, prefix), { waitUntil: "domcontentloaded" });
        await expect(page.locator("[data-lookup-item-root]")).toContainText(needleEffect[locale]);
        await expect(page.locator('[data-zh-source="translation"]')).toHaveCount(0);
      }
    });
  }
});

test("trang riêng chiến pháp: nút chọn phiên bản đổi đoạn hiệu ứng (có JavaScript)", async ({ page }) => {
  await page.goto("/tra-cuu/chien-phap/bach-ke-da-muu/");
  await expect(page.locator("body[data-boot=ready]")).toBeAttached();
  const buttons = page.locator(".lookup-version-button");
  expect(await buttons.count()).toBeGreaterThan(1);
  const panels = page.locator("[data-effect-panel]");
  await expect(panels.nth(0)).toBeVisible();
  await expect(panels.nth(1)).toBeHidden();
  await buttons.nth(1).click();
  await expect(panels.nth(0)).toBeHidden();
  await expect(panels.nth(1)).toBeVisible();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
});

test("trang riêng cải tạo binh chủng: chỉ một bản client, hướng dẫn mùa hiện ngay, không có nút phiên bản", async ({ page }) => {
  await page.goto("/tra-cuu/cai-tao-binh-chung/ho-bao-ky/");
  await expect(page.locator("body[data-boot=ready]")).toBeAttached();
  await expect(page.locator("[data-effect-tab]")).toHaveCount(0);
  await expect(page.locator('[data-effect-panel]:not([hidden])').first()).toContainText("Hổ Báo Kỵ");
});

test("trang riêng tướng: link tới chiến pháp là link trang riêng của chiến pháp", async ({ page }) => {
  await page.goto("/tra-cuu/tuong/luu-bi/");
  const link = page.locator("a[data-lookup-relation]").first();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/tra-cuu\/chien-phap\/[a-z0-9-]+\/$/u);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`, "u"));
  await expect(page.locator("h1")).toHaveCount(1);
});

// Trang chi tiết đội: ô chiến pháp / binh thư là link tới trang riêng của mục (không còn `?id=` trên trang nhóm).
for (const [locale, prefix] of LOCALES) {
  for (const [kind, selector, group] of [["chiến pháp", "a.detail-hero-tactics-item.is-link", "tactics"], ["binh thư", "a.detail-hero-books-item.is-link", "books"]]) {
    test(`${locale}: link ${kind} trên trang chi tiết đội dẫn tới trang riêng của mục`, async ({ page }) => {
      await page.goto(`${prefix}/doi-chuan/pk-s4-thuc-tri-cung/`);
      const link = page.locator(selector).first();
      await expect(link).toBeVisible();
      const href = await link.getAttribute("href");
      const slug = href.match(new RegExp(`^${prefix}/tra-cuu/${GROUP_SLUG[group]}/([a-z0-9-]+)/$`, "u"))?.[1];
      expect(slug, `href ${href} phải là trang riêng`).toBeTruthy();
      expect(Object.values(LEDGER[group]), `${slug} phải là slug của ledger`).toContain(slug);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`, "u"));
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("[data-lookup-item-root]")).toBeVisible();
    });
  }
}

test("?id= cũ trên trang nhóm vẫn mở hộp thoại cho chiến pháp, binh thư và tướng", async ({ page }) => {
  for (const [group, slug] of [["tactics", "chien-phap"], ["books", "binh-thu"], ["heroes", "tuong"]]) {
    await page.goto(`/tra-cuu/${slug}/?id=${encodeURIComponent(firstId(group))}`);
    await expect(page.locator(".lookup-dialog")).toBeVisible();
  }
});
