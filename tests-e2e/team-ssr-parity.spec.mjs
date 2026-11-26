import { test, expect } from "@playwright/test";

// DOM dựng sẵn mà trình duyệt nhận lại phải đúng bằng DOM trình duyệt tự dựng cho cùng URL: bỏ dấu `data-ssr-source`
// của HTML (page.route) thì client không nhận lại mà dựng từ dữ liệu; hai bản outerHTML phải trùng. Cả hai phía đều là DOM SAU boot
// nên spec này chỉ so khối danh sách; phép so khung dựng sẵn với khung sau boot nằm ở team-ssr-layout-shift.spec.mjs.
const LISTS = [
  ["/doi-chuan/", ".reference-view"],
  ["/doi-khac/", ".reference-view"],
  ["/cung-ton/", ".coexist-group-view"],
  ["/khai-hoang/", ".khaihoang"],
];

/** outerHTML của khối danh sách sau boot, bỏ phần chỉ phục vụ việc nhận lại (dấu chữ ký). */
async function listHtml(page, url, selector, { stripMarker }) {
  if (stripMarker) {
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      const body = (await response.text()).replace(/\sdata-ssr-source=/g, " data-no-ssr-source=");
      await route.fulfill({ response, body });
    });
  }
  await page.goto(url);
  await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
  // Bản dựng sẵn có đủ mọi đội của mùa mặc định (có thể hơn một lượt); client tự dựng chỉ hiện lượt đầu, nên bấm
  // "Xem thêm" tới hết để so cùng một danh sách.
  const more = page.locator("button.lookup-more");
  while (await more.count()) await more.click();
  const html = await page.evaluate((query) => {
    const node = document.querySelector(query);
    const clone = node.cloneNode(true);
    for (const marked of [clone, ...clone.querySelectorAll("[data-ssr-signature]")]) marked.removeAttribute("data-ssr-signature");
    return clone.outerHTML;
  }, selector);
  if (stripMarker) await expect(page.locator("main [data-no-ssr-source]")).toHaveCount(1);
  return html;
}

for (const [locale, prefix] of [["vi", ""], ["zh", "/zh"], ["ja", "/ja"]]) {
  for (const [path, selector] of LISTS) {
    test(`${locale} ${path}: DOM nhận lại từ bản dựng sẵn bằng DOM client tự dựng`, async ({ browser }) => {
      const adoptedPage = await (await browser.newContext()).newPage();
      const builtPage = await (await browser.newContext()).newPage();
      const adopted = await listHtml(adoptedPage, `${prefix}${path}`, selector, { stripMarker: false });
      const built = await listHtml(builtPage, `${prefix}${path}`, selector, { stripMarker: true });
      expect(adopted.length).toBeGreaterThan(500);
      expect(adopted).toBe(built);
    });
  }
}
