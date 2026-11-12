// Hộp xác nhận trong trang dùng chung (js/inline-confirm.js, component `hop-xac-nhan`): nhãn cho trình đọc màn hình,
// focus mặc định vào Huỷ, Tab vòng trong hộp, Escape / Huỷ trả `false` và trả focus về nút đã mở, thao tác lỗi giữ hộp mở.
// Chưa trang nào dùng helper nên spec nạp module vào trang chủ rồi mở hộp từ một nút tạm.
import { test, expect } from "@playwright/test";

/** Gắn nút mở vào trang; bấm nút gọi `confirmInPage(options)` và ghi kết quả vào `window.__confirmResults`. */
async function mountOpener(page, { failFirst = false, danger = true } = {}) {
  await page.goto("/");
  await page.evaluate(async ({ failFirst, danger }) => {
    const { confirmInPage } = await import("/js/inline-confirm.js");
    window.__confirmResults = [];
    window.__confirmRuns = 0;
    const opener = document.createElement("button");
    opener.type = "button";
    opener.id = "mo-hop-xac-nhan";
    opener.textContent = "Xoá đội thử";
    opener.addEventListener("click", async () => {
      const result = await confirmInPage({
        title: "Xoá đội “Vũ Tung Úc”?",
        message: "Ảnh và dữ liệu đi kèm cũng bị xoá. Không hoàn tác được.",
        confirmLabel: "Xoá đội",
        danger,
        onConfirm: async () => {
          window.__confirmRuns += 1;
          return failFirst && window.__confirmRuns === 1 ? "Máy chủ bận, thử lại." : undefined;
        },
      });
      window.__confirmResults.push(result);
    });
    document.querySelector("main").prepend(opener);
  }, { failFirst, danger });
  return page.locator("#mo-hop-xac-nhan");
}

test("hộp xác nhận có nhãn, focus vào Huỷ, Tab vòng trong hộp", async ({ page }) => {
  const opener = await mountOpener(page);
  await opener.click();
  const dialog = page.getByRole("alertdialog", { name: "Xoá đội “Vũ Tung Úc”?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription("Ảnh và dữ liệu đi kèm cũng bị xoá. Không hoàn tác được.");
  const cancel = dialog.getByRole("button", { name: "Huỷ" });
  const confirm = dialog.getByRole("button", { name: "Xoá đội" });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
});

test("Escape và Huỷ trả false, đóng hộp, trả focus về nút đã mở", async ({ page }) => {
  const opener = await mountOpener(page);
  await opener.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog.hop-xac-nhan")).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Huỷ" }).click();
  await expect(page.locator("dialog.hop-xac-nhan")).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => [window.__confirmResults, window.__confirmRuns])).toEqual([[false, false], 0]);
});

test("thao tác lỗi giữ hộp mở và báo bằng role=alert; lần sau thành công thì đóng và trả true", async ({ page }) => {
  const opener = await mountOpener(page, { failFirst: true });
  await opener.click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Xoá đội" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Máy chủ bận, thử lại.");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Xoá đội" })).toBeFocused();

  await dialog.getByRole("button", { name: "Xoá đội" }).click();
  await expect(page.locator("dialog.hop-xac-nhan")).toHaveCount(0);
  expect(await page.evaluate(() => [window.__confirmResults, window.__confirmRuns])).toEqual([[true], 2]);
});

test("nút xác nhận nguy hiểm đạt tương phản chữ ở cả hai theme; danger:false là hộp thoại thường", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    const opener = await mountOpener(page);
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    await opener.click();
    const colors = await page.locator(".hop-xac-nhan-xoa").evaluate((node) => {
      const style = getComputedStyle(node);
      return [style.color, style.backgroundColor];
    });
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).map(Number);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const [fg, bg] = colors.map(luminance);
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    expect(ratio, `${theme}: ${colors.join(" trên ")}`).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press("Escape");
  }

  const opener = await mountOpener(page, { danger: false });
  await opener.click();
  await expect(page.getByRole("dialog", { name: "Xoá đội “Vũ Tung Úc”?" })).toBeVisible();
  await expect(page.locator(".hop-xac-nhan .ana-btn.primary")).toHaveText("Xoá đội");
});

test("bấm đúp nút mở không đóng hộp ngay; bấm nền (nhấn và thả trên nền) sau đó mới đóng và trả false", async ({ page }) => {
  const opener = await mountOpener(page);
  await opener.dblclick();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  // Đợi qua khoảng bỏ qua bấm nền rồi kiểm hộp vẫn mở.
  await page.waitForTimeout(400);
  await expect(dialog).toBeVisible();
  // Nhấn trong hộp rồi thả ở nền (kéo chọn chữ) không đóng hộp.
  const box = await dialog.locator(".hop-xac-nhan-tieu-de").boundingBox();
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  // Bấm nền thật: đóng như Huỷ.
  await page.mouse.click(5, 5);
  await expect(page.locator("dialog.hop-xac-nhan")).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => [window.__confirmResults, window.__confirmRuns])).toEqual([[false], 0]);
});
