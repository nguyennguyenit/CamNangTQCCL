// Phase 9 — 3 công cụ Beta (Chiêu mộ, Soi đội, Gợi ý đội): hành vi giữ nguyên (store/Worker/engine) và
// giao diện theo artboard. Fixture localStorage/route mô phỏng đúng dữ liệu người dùng đã có từ trước phase.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { canonicalHeroId } from "../js/hero-identity.js";
import { buildSeasonCandidates, seasonTacticUsage } from "../js/roster-season-candidates.js";

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+4gZ8WQAAAABJRU5ErkJggg==",
  "base64",
);
/** Đổi mã màu token (`#a8202a`) sang dạng `rgb(...)` mà `getComputedStyle` trả về. */
function toRgb(value) {
  const hex = String(value).trim().replace(/^#/, "");
  const number = Number.parseInt(hex, 16);
  return `rgb(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255})`;
}

/**
 * Turnstile giả: `render` cấp token ngay như trước. `reset` KHÔNG tự cấp token (widget thật cũng chờ
 * người dùng giải lại) mà ghi lại container bị reset; `window.__turnstileSolve()` giả lập lần giải lại
 * và chỉ cấp token mới cho widget đã bị reset — không gọi reset thì không có token mới nào.
 */
const TURNSTILE_STUB = [
  "window.__turnstile={widgets:new Map(),resets:[],issued:0};",
  "window.turnstile={",
  "render:(node,options)=>{window.__turnstile.widgets.set(node,{options,pending:false});options.callback('fixture-token');},",
  "reset:(node)=>{window.__turnstile.resets.push(node);const widget=window.__turnstile.widgets.get(node);if(widget)widget.pending=true;},",
  "};",
  "window.__turnstileSolve=()=>{for(const widget of window.__turnstile.widgets.values()){if(!widget.pending)continue;widget.pending=false;widget.options.callback(`fixture-token-${++window.__turnstile.issued}`);}};",
].join("");

/** Số lần widget đã render trong `selector` bị reset (chỉ tính đúng container của widget đó). */
function turnstileResets(page, selector) {
  return page.evaluate((css) => {
    const box = document.querySelector(css);
    if (!box || !window.__turnstile?.widgets.has(box)) return -1;
    return window.__turnstile.resets.filter((node) => node === box).length;
  }, selector);
}

const WORKER_ROUTE = "https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/**";

/**
 * Đặt theme đã yêu cầu cho MỘT ca đo (không dựa vào việc bấm nút rồi hy vọng): ghi `theme` vào
 * localStorage đúng trước lần nạp trang kế tiếp, để ảnh/bằng chứng luôn đúng theme trong tên tệp.
 */
async function ensureTheme(page, theme) {
  await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
}

async function waitForBoot(page) {
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
}

/**
 * Gieo storage một lần cho mỗi ngữ cảnh test: chỉ ghi khi khóa còn trống, để tải lại trang
 * (reload) đọc đúng dữ liệu người dùng đã sửa chứ không bị fixture ghi đè trở lại.
 */
function seed(page, entries) {
  return page.addInitScript((rows) => {
    for (const [key, value] of Object.entries(rows)) {
      if (localStorage.getItem(key) !== null) continue;
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }, entries);
}

/** Ngày hôm nay theo giờ máy chạy test — khớp `todayLocalDate()` của công cụ. */
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Chiêu mộ: dữ liệu v1 người dùng đã có (chuyển sang v2 khi nạp) — một tài khoản, 1 lượt ngày hôm nay sau lần
 * ra 5★ gần nhất và 1 gói hạn giờ đã quá mốc 30 lượt. Ở v2 "Hôm nay x/4" đếm từ các lượt ghi ngày hôm nay
 * (không còn `dailyStates`), nên lượt không ra mang ngày hôm nay để giữ đúng các con số cũ: 1/30, hôm nay 1/4.
 */
const RECRUIT_FIXTURE = {
  schemaVersion: 1,
  activeAccountId: "acc_main",
  accounts: [{ id: "acc_main", name: "Tài khoản chính", createdAt: "2026-07-01T00:00:00.000Z" }],
  banners: [
    { id: "danh-tuong-pk", name: "Danh tướng PK", type: "normal", drawMode: "daily", hasFiveStar: true, pityLimit: 30, dailyCheapPullLimit: 4 },
    { id: "banner-limited", name: "Gói hạn giờ A", type: "limited", drawMode: "banner", hasFiveStar: true, pityLimit: 30 },
  ],
  pullEvents: [
    { id: "evt_five", accountId: "acc_main", bannerId: "danh-tuong-pk", pulls: 1, result: "fiveStar", date: "2026-07-09", heroName: "SP Lữ Mông", heroValueClass: "Chủ lực", pullCount: 30, drawSlot: "Miễn phí 1" },
    { id: "evt_miss", accountId: "acc_main", bannerId: "danh-tuong-pk", pulls: 1, result: "miss", date: todayIso() },
    { id: "evt_over", accountId: "acc_main", bannerId: "banner-limited", pulls: 31, result: "miss", date: "2026-07-10" },
  ],
};

/** Công cụ không còn dùng `prompt`/`confirm`/`alert`: mọi hộp thoại native bật lên đều là lỗi. */
function forbidNativeDialogs(page) {
  const opened = [];
  page.on("dialog", async (dialog) => {
    opened.push(dialog.type());
    await dialog.dismiss();
  });
  return opened;
}

const liveDailyPulls = (stored) => stored.pullEvents
  .filter((event) => !event.deletedAt && event.bannerId === "danh-tuong-pk" && event.result !== "set" && event.date === todayIso())
  .reduce((sum, event) => sum + event.pulls, 0);

test.describe("Chiêu mộ", () => {
  test("đồng hồ pity đọc từ store (kể cả quá mốc), nhật ký, và Đủ 4 kẹp theo lượt còn lại rồi Hoàn tác", async ({ page }) => {
    const apiCalls = [];
    await page.route("**/api/**", (route) => {
      apiCalls.push(route.request().url());
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    const nativeDialogs = forbidNativeDialogs(page);
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);

    const section = page.locator("#section-recruit-tracker");
    await expect(section.locator("h1.reference-title")).toHaveText("Theo dõi chiêu mộ");
    await expect(section.locator(".rt-account-bar #rt-account-select")).toHaveValue("acc_main");
    // Khách chưa từng đăng nhập: chip ☁ mời đăng nhập, không gọi /api/me.
    await expect(section.locator(".rt-sync")).toContainText("Chưa đồng bộ");
    await expect(section.locator(".rt-sync").getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
    await expect(section.locator(".tool-notice")).toContainText("Dữ liệu chỉ lưu trong trình duyệt này");

    // Hằng ngày: 1 lượt sau lần ra 5★ gần nhất -> 1/30, còn 29 lượt, hôm nay 1/4.
    const dailyMeter = section.locator(".rt-pity-block [role='meter']");
    await expect(dailyMeter).toHaveAttribute("aria-valuemin", "0");
    await expect(dailyMeter).toHaveAttribute("aria-valuemax", "30");
    await expect(dailyMeter).toHaveAttribute("aria-valuenow", "1");
    await expect(dailyMeter).toHaveAttribute("aria-valuetext", "1 / 30 lượt");
    await expect(section.locator(".rt-pity-value")).toHaveText("1");
    await expect(section.locator(".rt-pity-unit")).toHaveText("/ 30 lượt");
    await expect(section.locator(".rt-pity-meta")).toContainText("Còn 29 lượt tới mốc bảo hiểm");
    await expect(section.locator(".rt-pity-meta")).toContainText("Hôm nay 1/4");

    // Gói hạn giờ quá mốc: chữ hiện số thật, meter kẹp trong [0, limit], cảnh báo quy tắc vẫn hiện.
    const banner = section.locator(".rt-banner");
    await expect(banner).toHaveCount(1);
    await expect(banner.locator(".rt-banner-name")).toHaveText("Gói hạn giờ A");
    await expect(banner.locator(".rt-banner-count")).toHaveText("31/30");
    await expect(banner.locator("[role='meter']")).toHaveAttribute("aria-valuenow", "30");
    await expect(banner.locator("[role='meter']")).toHaveAttribute("aria-valuetext", "31 / 30 lượt");
    await expect(banner.locator(".rt-warning")).toHaveText("Kiểm tra lại dữ liệu/quy tắc game");

    // Nhật ký: dòng 5★ giữ số lượt tới 5★ của dữ liệu cũ, badge phân loại, tên gói.
    const fiveRow = section.locator(".rt-log-item[data-result='fiveStar']");
    await expect(fiveRow).toHaveCount(1);
    await expect(fiveRow.locator(".rt-log-text")).toHaveText("★ SP Lữ Mông · lượt 30");
    await expect(fiveRow.locator(".rt-value")).toHaveText("Chủ lực");
    await expect(fiveRow.locator(".rt-log-banner")).toContainText("Danh tướng PK");
    await expect(section.locator(".rt-stats")).toContainText("30");

    // "Đủ 4": một chạm ghi đúng số lượt còn lại hôm nay (3), cả hai nút nhanh khoá, toast có Hoàn tác.
    const fill = section.getByRole("button", { name: /^Đủ 4/ });
    await expect(fill).toHaveAttribute("aria-label", "Đủ 4 (ghi 3 lượt không ra)");
    await fill.click();
    await expect(section.locator(".rt-pity-value")).toHaveText("4");
    await expect(section.locator(".rt-pity-meta")).toContainText("Hôm nay 4/4");
    await expect(fill).toBeDisabled();
    await expect(section.getByRole("button", { name: /^2 miễn phí/ })).toBeDisabled();
    await expect(section.locator(".rt-today-hint")).toHaveText("Hôm nay đã ghi đủ 4 lượt.");
    await expect(section.locator(".rt-toast[role='status']")).toContainText("Đã ghi +3 lượt");
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tqcclRecruitTracker")));
    expect(stored.schemaVersion).toBe(2);
    expect(liveDailyPulls(stored)).toBe(4);

    await section.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await expect(section.locator(".rt-pity-value")).toHaveText("1");
    await expect(section.locator(".rt-pity-meta")).toContainText("Hôm nay 1/4");
    await expect(fill).toBeEnabled();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tqcclRecruitTracker")));
    expect(liveDailyPulls(stored)).toBe(1);
    expect(apiCalls).toEqual([]);
    expect(nativeDialogs).toEqual([]);
  });

  test("tài khoản mới: màn bắt đầu, một chạm Đủ 4 ghi 4 lượt và Hoàn tác xóa đúng 4 lượt đó", async ({ page }) => {
    const nativeDialogs = forbidNativeDialogs(page);
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);
    const section = page.locator("#section-recruit-tracker");

    const onboard = section.locator(".rt-onboard");
    await expect(onboard).toBeVisible();
    await expect(onboard).toContainText("Trong game bạn đang ở lượt mấy?");
    await onboard.locator("input[type='number']").fill("17");
    await onboard.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await expect(onboard).toBeHidden();
    await expect(section.locator(".rt-pity-value")).toHaveText("17");
    await expect(section.locator(".rt-log-item .rt-log-text")).toHaveText(["Đồng bộ 17 lượt"]);

    await section.getByRole("button", { name: /^Đủ 4/ }).click();
    await expect(section.locator(".rt-pity-value")).toHaveText("21");
    await expect(section.locator(".rt-toast")).toContainText("Đã ghi +4 lượt");
    await expect(section.locator(".rt-log-item .rt-log-text")).toHaveText(["+4 không ra", "Đồng bộ 17 lượt"]);
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tqcclRecruitTracker")));
    expect(liveDailyPulls(stored)).toBe(4);

    await section.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await expect(section.locator(".rt-pity-value")).toHaveText("17");
    await expect(section.locator(".rt-log-item .rt-log-text")).toHaveText(["Đồng bộ 17 lượt"]);
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tqcclRecruitTracker")));
    expect(liveDailyPulls(stored)).toBe(0);
    expect(nativeDialogs).toEqual([]);
  });

  test("menu ⋯ tài khoản: aria-expanded, Escape và Tab ra ngoài đóng; hộp thoại 5★ nhận focus và trả focus khi đóng", async ({ page }) => {
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);

    const section = page.locator("#section-recruit-tracker");
    const toggle = section.locator(".rt-account-toggle");
    const actions = section.locator(".rt-account-actions");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(actions).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "Đổi tên", exact: true })).toBeVisible();
    await expect(toggle).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(actions).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await section.locator("#rt-account-select").focus();
    await expect(actions).toBeHidden();

    // Hộp thoại 5★ lượt ngày: native `<dialog>`, focus vào ô đầu, Escape đóng và trả focus về nút đã mở.
    const fiveButton = section.locator(".rt-today .rt-five-btn");
    await fiveButton.click();
    const dialog = page.locator("dialog.rt-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2")).toHaveText("Ghi 5★ · Danh tướng PK");
    await expect(dialog.locator("select[name='hitAt']")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(fiveButton).toBeFocused();
    // Vùng bấm 44px trên mobile cho mọi nút hiện trong công cụ.
    const small = await section.evaluate((root) => [...root.querySelectorAll("button, select, input:not([type='file'])")]
      .filter((node) => node.offsetParent && !node.closest("dialog"))
      .filter((node) => node.getBoundingClientRect().height < 44)
      .map((node) => node.className));
    expect(small).toEqual([]);
  });

  test("nhập JSON hỏng: localStorage giữ nguyên, báo lỗi, công cụ vẫn ghi lượt được", async ({ page }) => {
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    const nativeDialogs = forbidNativeDialogs(page);
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);
    const section = page.locator("#section-recruit-tracker");
    const before = await page.evaluate(() => localStorage.getItem("tqcclRecruitTracker"));

    const broken = structuredClone(RECRUIT_FIXTURE);
    broken.pullEvents = [null];
    await section.locator(".rt-file").setInputFiles({ name: "hong.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(broken)) });

    await expect(section.locator(".rt-toast")).toContainText("Dữ liệu không hợp lệ.");
    await expect(page.locator("dialog.rt-dialog")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("tqcclRecruitTracker"))).toBe(before);
    await expect(section.locator(".rt-pity-value")).toHaveText("1");
    await section.getByRole("button", { name: /^2 miễn phí/ }).click();
    await expect(section.locator(".rt-pity-value")).toHaveText("3");
    expect(nativeDialogs).toEqual([]);
  });

  test("Có 5★ lượt ngày: chọn lượt trúng trong số lượt còn lại, nhật ký ghi tên tướng và số lượt tới 5★", async ({ page }) => {
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);
    const section = page.locator("#section-recruit-tracker");

    await section.locator(".rt-today .rt-five-btn").click();
    const dialog = page.locator("dialog.rt-dialog");
    // Hôm nay đã quay 1 lượt: còn 3 lượt để chọn; hộp thoại lượt ngày không có ô ngày.
    await expect(dialog.locator("select[name='hitAt'] option")).toHaveText(["Lượt 2/4 hôm nay", "Lượt 3/4 hôm nay", "Lượt 4/4 hôm nay"]);
    await expect(dialog.locator("input[type='date']")).toHaveCount(0);
    await dialog.locator("select[name='hitAt']").selectOption("2");
    await expect(dialog.locator("select[name='pullsAfter'] option")).toHaveCount(2);
    await dialog.locator("select[name='pullsAfter']").selectOption("0");
    await dialog.locator("input[name='heroName']").fill("SP Quan Vũ");
    await dialog.getByRole("button", { name: "Lưu 5★", exact: true }).click();
    await expect(dialog).toBeHidden();

    const row = section.locator(".rt-log-item").first();
    await expect(row.locator(".rt-log-text")).toHaveText("★ SP Quan Vũ · lượt 3");
    await expect(row.locator(".rt-log-date")).toHaveText(todayIso());
    await expect(row.locator(".rt-log-banner")).toContainText("Danh tướng PK");
    await expect(section.locator(".rt-pity-value")).toHaveText("0");
    await expect(section.locator(".rt-pity-meta")).toContainText("Hôm nay 3/4");
    // Khách vừa ghi 5★ đầu tiên trong phiên: lời mời đăng nhập hiện, "Để sau" nhớ lựa chọn.
    await expect(section.locator(".rt-invite")).toBeVisible();
    await section.locator(".rt-invite").getByRole("button", { name: "Để sau", exact: true }).click();
    await expect(section.locator(".rt-invite")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("tqcclRecruitTracker:invite"))).toBe("dismissed");
  });

  test("nhật ký: sửa và xóa bất kỳ dòng nào, pity tính lại ngay, Hoàn tác khôi phục dòng đã xóa", async ({ page }) => {
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    const nativeDialogs = forbidNativeDialogs(page);
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);
    const section = page.locator("#section-recruit-tracker");
    const missRow = section.locator(".rt-log-item[data-result='miss']").filter({ hasText: "Danh tướng PK" });

    await missRow.locator(".rt-log-edit").click();
    const dialog = page.locator("dialog.rt-dialog");
    await dialog.locator("input[name='pulls']").fill("3");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(section.locator(".rt-pity-value")).toHaveText("3");
    await expect(missRow.locator(".rt-log-text")).toHaveText("+3 không ra");

    await missRow.locator(".rt-log-delete").click();
    await expect(section.locator(".rt-pity-value")).toHaveText("0");
    await expect(missRow).toHaveCount(0);
    await section.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await expect(section.locator(".rt-pity-value")).toHaveText("3");
    await expect(missRow).toHaveCount(1);
    expect(nativeDialogs).toEqual([]);
  });

  test("gói hạn giờ: thêm bằng hộp thoại, đếm ngược hết hạn, +5, lưu trữ và xóa có hộp thoại xác nhận", async ({ page }) => {
    const nativeDialogs = forbidNativeDialogs(page);
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);
    const section = page.locator("#section-recruit-tracker");
    const dialog = page.locator("dialog.rt-dialog");
    const inThreeDays = (() => {
      const date = new Date();
      date.setDate(date.getDate() + 3);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    })();

    await section.getByRole("button", { name: "Thêm gói", exact: true }).click();
    await dialog.locator("input[name='name']").fill("Kỳ Tật Như Phong");
    await dialog.locator("input[name='expiresAt']").fill(inThreeDays);
    await dialog.getByRole("button", { name: "Thêm gói", exact: true }).click();

    const banner = section.locator(".rt-banner");
    await expect(banner.locator(".rt-banner-name")).toHaveText("Kỳ Tật Như Phong");
    await expect(banner.locator(".rt-banner-expiry")).toHaveText("còn 3 ngày");
    await banner.getByRole("button", { name: "+5", exact: true }).click();
    await expect(banner.locator(".rt-banner-count")).toHaveText("5/30");

    await banner.locator(".rt-menu-toggle").click();
    await banner.getByRole("button", { name: "Lưu trữ", exact: true }).click();
    await expect(section.locator(".rt-archived")).toBeVisible();
    await expect(section.locator(".rt-archived-summary")).toHaveText("Đã lưu trữ (1)");
    await section.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await expect(section.locator(".rt-archived")).toBeHidden();

    await banner.locator(".rt-menu-toggle").click();
    await banner.getByRole("button", { name: "Xóa gói", exact: true }).click();
    await expect(dialog.locator(".donate-dialog-lead")).toContainText('Xóa gói "Kỳ Tật Như Phong"?');
    await dialog.getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(banner).toHaveCount(0);
    await expect(section.locator(".rt-log-item")).toHaveCount(0);
    expect(nativeDialogs).toEqual([]);
  });

  test("qua nửa đêm khi trang còn mở: Hôm nay về 0/4 và nút nhanh bấm được lại", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 8, 27, 23, 59, 0) });
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);
    const section = page.locator("#section-recruit-tracker");
    await section.getByRole("button", { name: "Bắt đầu từ 0", exact: true }).click();
    const fill = section.getByRole("button", { name: /^Đủ 4/ });
    await fill.click();
    await expect(section.locator(".rt-pity-meta")).toContainText("Hôm nay 4/4");
    await expect(fill).toBeDisabled();

    await page.clock.runFor(2 * 60 * 1000);

    await expect(section.locator(".rt-pity-meta")).toContainText("Hôm nay 0/4");
    await expect(fill).toBeEnabled();
    await expect(fill).toHaveAttribute("aria-label", "Đủ 4 (ghi 4 lượt không ra)");
    // Bảo hiểm cộng dồn qua ngày.
    await expect(section.locator(".rt-pity-value")).toHaveText("4");
  });
});

/**
 * Dữ liệu thật cho Soi đội: một Đội chuẩn của mùa mặc định có đủ tướng/chiến pháp/binh thư trong từ điển
 * và có Đội khác trùng ≥2 tướng. Trả phản hồi Worker giả (chữ Hán in trong ảnh: một ô chiến pháp `未知`,
 * một tướng lệch một chữ để thành "không chắc"), link `?doi=` và nhãn Việt/Trung của từng ô.
 */
async function analyzeFixture(page) {
  const fixture = await page.evaluate(async () => {
    const [{ createEntityIndex, diffTeam, referenceTeam }, { encodeTeamParam }] = await Promise.all([
      import("/js/analyze-map.js"),
      import("/js/analyze-state.js"),
    ]);
    const json = (path) => fetch(path).then((response) => response.json());
    const pin = JSON.parse(document.querySelector("#recommended-publication").textContent);
    const generation = (name) => json(`/data/recommended/${pin.generationId}/${name}`);
    const [seasons, index, other, heroes, tactics, books] = await Promise.all([
      generation("seasons.json"), generation("index.json"), generation("other-teams.json"),
      json("/data/heroes-dict.json"), json("/data/tactics.json"), json("/data/books-dict.json"),
    ]);
    const indexes = { hero: createEntityIndex(heroes, "hero"), tactic: createEntityIndex(tactics, "tactic"), book: createEntityIndex(books, "book") };
    const recordOf = (kind, id) => indexes[kind].byId.get(id);
    const compact = (value) => String(value || "").replace(/\s+/gu, "");
    // Chữ Giản thể như in trong game: alias không khoảng trắng khác `chinese`, không có thì `chinese`.
    const printed = (record) => (record.aliases || []).find((alias) => !/\s/u.test(alias) && alias !== record.chinese) ?? compact(record.chinese);
    for (const record of index.records.filter((item) => item.sourceSeasonId === seasons.defaultSourceSeasonId)) {
      const slots = referenceTeam(record).slots;
      if (slots.length !== 3) continue;
      const team = {
        heroes: slots.map((slot) => ({
          hero: slot.alternatives[0]?.canonicalId ?? null,
          tactics: [slot.tactics[0]?.ids[0] ?? null, slot.tactics[1]?.ids[0] ?? null],
          book: slot.book?.ids[0] ?? null,
        })),
      };
      const complete = team.heroes.every((member) =>
        recordOf("hero", member.hero) && member.tactics.every((id) => id && recordOf("tactic", id)) && member.book && recordOf("book", member.book));
      if (!complete) continue;
      const unsureIndex = team.heroes.findIndex((member, position) => position > 0 && compact(recordOf("hero", member.hero).chinese).length >= 4);
      const otherMatch = other.records.find((item) => diffTeam(team, item).heroHit >= 2);
      if (unsureIndex < 0 || !otherMatch) continue;
      const reads = team.heroes.map((member, position) => ({
        nameCn: position === unsureIndex
          ? `${compact(recordOf("hero", member.hero).chinese).slice(0, -1)}口`
          : printed(recordOf("hero", member.hero)),
        tacticsCn: member.tactics.map((id, slot) => (position === 0 && slot === 1 ? "未知" : printed(recordOf("tactic", id)))),
        booksCn: [printed(recordOf("book", member.book))],
        statFocusCn: "",
      }));
      const labels = (field) => team.heroes.map((member) => [
        recordOf("hero", member.hero)[field], ...member.tactics.map((id) => recordOf("tactic", id)[field]), recordOf("book", member.book)[field],
      ].map((value) => String(value).trim()));
      return {
        reads,
        season: seasons.defaultSourceSeasonId,
        doi: encodeTeamParam(team),
        name: record.displayNameVi,
        nameZh: record.nameZh,
        otherName: otherMatch.name,
        unsureIndex,
        labels: labels("viet"),
        labelsZh: labels("chinese"),
      };
    }
    return null;
  });
  expect(fixture, "cần một Đội chuẩn mùa mặc định trùng ≥2 tướng với Đội khác").not.toBeNull();
  return fixture;
}

/** Ô thứ `field` (0 tướng, 1–2 chiến pháp A/B, 3 binh thư) của tướng `member` trong editor. */
const editorCell = (section, member, field) => section.locator(".ana-member").nth(member).locator(".ana-cell").nth(field);

/** Đếm request tới Worker soi ảnh (mọi method), kể cả khi trang không route. */
function countWorkerRequests(page) {
  const calls = [];
  page.on("request", (request) => { if (request.url().startsWith(WORKER_ROUTE.replace("/**", ""))) calls.push(request.url()); });
  return calls;
}

test.describe("Soi đội", () => {
  test("ảnh -> editor: ô không chắc/không rõ phải xác nhận, rồi đối chiếu Đội chuẩn + Đội khác với diff từng ô", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    const fixture = await analyzeFixture(page);
    let workerCalls = 0;
    await page.route(WORKER_ROUTE, (route) => { workerCalls += 1; return route.fulfill({ json: { heroes: fixture.reads } }); });

    const section = page.locator("#section-analyze");
    await expect(section.locator("h1.reference-title")).toHaveText("Soi đội từ ảnh");
    await expect(section.locator(".tool-notice")).toContainText("nhà cung cấp AI của site");
    await expect(section.locator("h2").first()).toHaveText("1 · Chọn ảnh");
    await expect(section.locator(".ana-drop")).toContainText("Kéo thả ảnh, dán (Ctrl+V) hoặc bấm để chọn");
    await expect(section.getByRole("button", { name: "Nhập tay", exact: true })).toBeVisible();
    await expect(section.locator(".ana-editor")).toBeHidden();

    const steps = section.locator(".ana-step");
    await expect(steps).toHaveCount(3);
    // Dấu ✓ là SVG trong span bọc — bước CHƯA XONG phải ẩn dấu. Bước 2 (Turnstile) xong ngay ở stub.
    await expect(steps.nth(0).locator(".ana-step-mark")).toBeHidden();
    await expect(steps.nth(1).locator(".ana-step-mark")).toBeVisible();
    await expect(steps.nth(2).locator(".ana-step-mark")).toBeHidden();
    await expect(section.locator(".ana-file-row")).toBeHidden();

    await section.locator("input[type=file]").setInputFiles({ name: "doi-hinh.png", mimeType: "image/png", buffer: transparentPng });
    await expect(steps.nth(0)).toHaveAttribute("data-state", "done");
    await expect(section.locator(".ana-file-name")).toHaveText("doi-hinh.png");
    await expect(section.locator(".ana-file-row")).toContainText("Đã nén · sẵn sàng gửi");

    const run = section.getByRole("button", { name: "Soi đội", exact: true });
    await expect(run).toBeEnabled();
    await run.click();

    // Editor: 3 tướng × (tướng + 2 chiến pháp + binh thư), điền sẵn từ chữ Worker chép.
    const editor = section.locator(".ana-editor");
    await expect(editor).toBeVisible();
    await expect(steps.nth(2)).toHaveAttribute("data-state", "done");
    await expect(steps.nth(1)).toHaveAttribute("data-state", "pending");
    await expect(editor.locator(".ana-cell-input")).toHaveCount(12);
    await expect(editorCell(section, 0, 0).locator("input")).toHaveValue(fixture.labels[0][0]);
    await expect(editorCell(section, 0, 1)).toHaveAttribute("data-state", "sure");
    // Ô chiến pháp B đọc được `未知`: không rõ, không bị dồn sang ô A.
    const unknownCell = editorCell(section, 0, 2);
    await expect(unknownCell).toHaveAttribute("data-state", "unknown");
    await expect(unknownCell.locator(".ana-cell-flag")).toHaveText("Không rõ");
    // Tên lệch một chữ: không chắc, kèm ứng viên gần nhất và chữ đọc được.
    const unsureCell = editorCell(section, fixture.unsureIndex, 0);
    await expect(unsureCell).toHaveAttribute("data-state", "unsure");
    await expect(unsureCell.locator(".ana-cell-flag")).toHaveText("Không chắc");
    await expect(unsureCell.locator(".ana-cell-raw")).toContainText(fixture.reads[fixture.unsureIndex].nameCn);
    const compare = section.getByRole("button", { name: "Đối chiếu", exact: true });
    await expect(compare).toBeDisabled();
    await expect(section.locator(".ana-ready-note")).toHaveText("Còn 2 ô cần xác nhận trước khi đối chiếu.");

    await unsureCell.getByRole("button", { name: fixture.labels[fixture.unsureIndex][0], exact: true }).click();
    await expect(unsureCell).toHaveAttribute("data-state", "sure");
    await expect(unsureCell.locator("input")).toHaveValue(fixture.labels[fixture.unsureIndex][0]);
    await expect(compare).toBeDisabled();
    await unknownCell.locator("input").fill(fixture.labels[0][2]);
    await unknownCell.locator("input").press("Tab");
    await expect(unknownCell).toHaveAttribute("data-state", "sure");
    await expect(compare).toBeEnabled();
    await compare.click();

    const standard = section.locator(".ana-group-standard");
    await expect(standard.locator(".ana-group-title")).toContainText("Đội chuẩn · ");
    const row = standard.locator(".ana-team-row").first();
    await expect(row.locator(".ana-team-link")).toHaveText(fixture.name);
    await expect(row.locator(".ana-team-hits")).toHaveText("3/3 tướng · 6/6 chiến pháp");
    await expect(row.locator(".ana-diff-tac[data-status=match]")).toHaveCount(6);
    await expect(row.locator(".ana-diff-book[data-status=match]")).toHaveCount(3);
    const other = section.locator(".ana-group-other");
    await expect(other.locator(".ana-group-title")).toHaveText("Đội khác · tham khảo");
    const otherRow = other.locator(".ana-team-row").filter({ hasText: fixture.otherName }).first();
    await expect(otherRow).toBeVisible();
    await expect(otherRow.locator(".ana-diff .ana-diff-hero").first()).toBeVisible();
    // Link chia sẻ nằm trên URL: chỉ ID canonical, có tiền tố phiên bản, cùng mùa đang so.
    const url = new URL(page.url());
    expect(url.searchParams.get("doi")).toBe(fixture.doi);
    expect(url.searchParams.get("season")).toBe(fixture.season);
    expect(workerCalls).toBe(1);

    // Hàng kết quả chỉ dùng giá trị token.
    const styles = await row.evaluate((node) => {
      const root = getComputedStyle(document.documentElement);
      const rowStyle = getComputedStyle(node);
      return {
        padding: `${rowStyle.paddingTop}/${rowStyle.paddingLeft}`,
        radius: rowStyle.borderRadius,
        border: rowStyle.borderTopColor,
        accent: root.getPropertyValue("--accent").trim(),
        linkFont: getComputedStyle(node.querySelector(".ana-team-link")).fontFamily,
      };
    });
    expect(styles.padding).toBe("14px/16px");
    expect(styles.radius).toBe("12px");
    expect(styles.border).toBe(toRgb(styles.accent));
    expect(styles.linkFont).toContain("Noto Serif Display");
    const text = await section.innerText();
    expect(text).not.toContain("📷");
    expect(text).not.toContain("⚠");

    // Thẻ PNG vẽ bằng chữ trên canvas và tải về được.
    const download = page.waitForEvent("download");
    await section.getByRole("button", { name: "Tải ảnh PNG", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("soi-doi.png");

    // Mở đội: trang chi tiết thật; link quay lại giữ đội + mùa.
    await row.locator(".ana-team-link").click();
    await expect(page).toHaveURL(/\/doi-chuan\//);
    await expect(page.locator("#team-detail-body")).toBeVisible();
  });

  test("Nhập tay không gọi Worker; đối chiếu ghi lịch sử trên máy, mở lại mục lịch sử như mở link", async ({ page }) => {
    const workerRequests = countWorkerRequests(page);
    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    const fixture = await analyzeFixture(page);
    const section = page.locator("#section-analyze");
    await expect(section.locator(".ana-history")).toBeHidden();
    await section.getByRole("button", { name: "Nhập tay", exact: true }).click();
    await expect(section.locator(".ana-editor")).toBeVisible();
    const compare = section.getByRole("button", { name: "Đối chiếu", exact: true });
    await expect(compare).toBeDisabled();
    await expect(section.locator(".ana-ready-note")).toHaveText("Còn 3 ô cần xác nhận trước khi đối chiếu.");
    for (const [member, labels] of fixture.labels.entries()) {
      for (const [field, label] of labels.entries()) {
        // Để trống có chủ đích: chiến pháp B của tướng 2 và binh thư của tướng 3.
        if ((member === 1 && field === 2) || (member === 2 && field === 3)) continue;
        const input = editorCell(section, member, field).locator("input");
        await input.fill(label);
        await input.press("Tab");
        await expect(editorCell(section, member, field)).toHaveAttribute("data-state", "sure");
      }
    }
    await expect(editorCell(section, 1, 2)).toHaveAttribute("data-state", "empty");
    await expect(compare).toBeEnabled();
    await compare.click();
    const row = section.locator(".ana-group-standard .ana-team-row").first();
    await expect(row.locator(".ana-team-link")).toHaveText(fixture.name);
    await expect(row.locator(".ana-team-hits")).toHaveText("3/3 tướng · 5/6 chiến pháp · 1 binh thư lệch");
    await expect(row.locator(".ana-diff-hero").nth(1).locator(".ana-diff-missing")).toContainText(fixture.labels[1][2]);
    await expect(row.locator(".ana-diff-book[data-status=missing]")).toHaveCount(1);
    const doi = new URL(page.url()).searchParams.get("doi");
    expect(doi).toMatch(/^v1\.[a-z0-9._-]+$/);

    // Lịch sử: chỉ đội + mùa + thời điểm, không ảnh/token.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tqccl.analyze.history.v1")));
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0]).sort()).toEqual(["doi", "savedAt", "season"]);
    expect(stored[0]).toMatchObject({ doi, season: fixture.season });

    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    await expect(section.locator(".ana-editor")).toBeHidden();
    const item = section.locator(".ana-history-item");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(fixture.labels[0][0]);
    await item.click();
    await expect(section.locator(".ana-group-standard .ana-team-row").first().locator(".ana-team-hits"))
      .toHaveText("3/3 tướng · 5/6 chiến pháp · 1 binh thư lệch");
    await expect(editorCell(section, 1, 2).locator("input")).toHaveValue("");
    expect(new URL(page.url()).searchParams.get("doi")).toBe(doi);
    expect(workerRequests).toEqual([]);
  });

  test("mở link ?doi=v1… dựng lại editor + diff mà không gọi Worker; link hỏng bị bỏ qua, editor rỗng", async ({ page }) => {
    const workerRequests = countWorkerRequests(page);
    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    const fixture = await analyzeFixture(page);

    await page.goto(`/soi-doi-tu-anh/?season=${encodeURIComponent(fixture.season)}&doi=${fixture.doi}`);
    await waitForBoot(page);
    const section = page.locator("#section-analyze");
    const row = section.locator(".ana-group-standard .ana-team-row").first();
    await expect(row.locator(".ana-team-link")).toHaveText(fixture.name);
    await expect(row.locator(".ana-team-hits")).toHaveText("3/3 tướng · 6/6 chiến pháp");
    await expect(section.locator(".ana-group-other .ana-team-row").filter({ hasText: fixture.otherName }).first()).toBeVisible();
    await expect(section.locator("#ana-season")).toHaveValue(fixture.season);
    for (const [member, labels] of fixture.labels.entries()) {
      for (const [field, label] of labels.entries()) {
        await expect(editorCell(section, member, field).locator("input")).toHaveValue(label);
      }
    }
    // Mở link chỉ xem lại, không ghi lịch sử.
    expect(await page.evaluate(() => localStorage.getItem("tqccl.analyze.history.v1"))).toBeNull();

    await page.goto("/soi-doi-tu-anh/?doi=v1.khong-co-tuong___.a___.b___");
    await waitForBoot(page);
    await expect(section.locator(".ana-editor")).toBeVisible();
    await expect(section.locator(".ana-compare")).toBeHidden();
    for (const input of await section.locator(".ana-cell-input").all()) await expect(input).toHaveValue("");
    await expect(page).toHaveURL("/soi-doi-tu-anh/");
    expect(workerRequests).toEqual([]);
  });

  test("bản /zh/ render: chữ UI qua L(), editor và kết quả dùng tên chữ Hán gốc", async ({ page }) => {
    const workerRequests = countWorkerRequests(page);
    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    const fixture = await analyzeFixture(page);
    await page.goto(`/zh/soi-doi-tu-anh/?season=${encodeURIComponent(fixture.season)}&doi=${fixture.doi}`);
    await waitForBoot(page);
    const section = page.locator("#section-analyze");
    await expect(section.locator("h1.reference-title")).toHaveText("截图识阵");
    await expect(section.getByRole("button", { name: "手动输入", exact: true })).toBeVisible();
    await expect(section.locator(".ana-editor .ana-card-title")).toHaveText("2 · 核对阵容");
    await expect(editorCell(section, 0, 0).locator("input")).toHaveValue(fixture.labelsZh[0][0]);
    await expect(section.locator(".ana-group-other .ana-group-title")).toHaveText("其他阵容 · 仅供参考");
    const row = section.locator(".ana-group-standard .ana-team-row").first();
    await expect(row.locator(".ana-team-hits")).toHaveText("3/3 名武将 · 6/6 个战法");
    if (fixture.nameZh) await expect(row.locator(".ana-team-link")).toHaveText(fixture.nameZh);
    expect(await section.innerText()).not.toMatch(/Đối chiếu|Nhập tay|Kiểm tra đội/u);
    expect(workerRequests).toEqual([]);
  });

  test("token Turnstile dùng một lần: widget reset sau lượt soi, nút chờ token mới rồi chạy lại được (N9-5)", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    const tokens = [];
    await page.route(WORKER_ROUTE, (route) => {
      tokens.push(route.request().postDataJSON().turnstileToken);
      return route.fulfill({ json: { heroes: [{ nameCn: "SP荀彧" }] } });
    });

    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    const section = page.locator("#section-analyze");
    const steps = section.locator(".ana-step");
    const run = section.getByRole("button", { name: "Soi đội", exact: true });
    const resets = () => turnstileResets(page, "#section-analyze .ana-turnstile");

    await section.locator("input[type=file]").setInputFiles({ name: "doi-hinh.png", mimeType: "image/png", buffer: transparentPng });
    await run.click();
    // Token dùng một lần: sau lượt chạy widget bị reset đúng một lần; người dùng giải lại thì nút mở.
    await expect.poll(resets).toBe(1);
    await expect(steps.nth(1)).toHaveAttribute("data-state", "pending");
    await page.evaluate(() => window.__turnstileSolve());
    await expect(run).toBeEnabled();

    // Widget cấp token mới -> nút dùng lại được và Worker nhận token mới, không phải token đã bỏ.
    await run.click();
    await expect.poll(() => tokens).toEqual(["fixture-token", "fixture-token-1"]);
  });

  test("đổi ảnh trong lúc đang soi: nút Soi đội mở lại sau khi giải Turnstile, kết quả ảnh cũ không hiện", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    let calls = 0;
    await page.route(WORKER_ROUTE, async (route) => {
      calls += 1;
      await held;
      await route.fulfill({ json: { heroes: [{ nameCn: "SP荀彧" }] } });
    });

    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    const section = page.locator("#section-analyze");
    const run = section.getByRole("button", { name: "Soi đội", exact: true });
    const resets = () => turnstileResets(page, "#section-analyze .ana-turnstile");
    const input = section.locator("input[type=file]");

    await input.setInputFiles({ name: "anh-cu.png", mimeType: "image/png", buffer: transparentPng });
    await run.click();
    await expect.poll(() => calls).toBe(1);
    await input.setInputFiles({ name: "anh-moi.png", mimeType: "image/png", buffer: transparentPng });
    await expect(section.locator(".ana-file-name")).toHaveText("anh-moi.png");

    release();
    await expect.poll(resets).toBe(1);
    await page.evaluate(() => window.__turnstileSolve());
    await expect(run).toBeEnabled();
    expect(await resets()).toBe(1);
    await expect(section.locator(".ana-editor")).toBeHidden();
    await expect(section.locator(".ana-compare")).toBeHidden();
  });
});

test.describe("Gợi ý đội", () => {
  /** Seed giống người dùng đã đọc vài đội: đủ tướng/chiến pháp để engine trả về danh sách có đội xây được. */
  const seedRoster = async (page, request, { teams: limit = 20, single = false } = {}) => {
    const teams = await (await request.get("/data/teams.json")).json();
    const source = single ? [teams.find((team) => (team.heroes || []).length === 3)] : teams.slice(0, limit);
    await seed(page, {
      "tqccl.rosterRecommend.scanState.v1": {
        ownedHeroes: [...new Set(source.flatMap((team) => team.heroes.map((hero) => hero.name || hero.baseName)))].map((name) => ({ name })),
        ownedTactics: [...new Set(source.flatMap((team) => team.heroes.flatMap((hero) => (hero.tactics || []).map((tactic) => tactic.name))))].map((name) => ({ name })),
        lockedTeams: [],
        confirmed: false,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    });
  };

  test("token Turnstile dùng một lần: đọc ảnh kho chờ token mới rồi đọc lại được (N9-5)", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    const tokens = [];
    await page.route(WORKER_ROUTE, (route) => {
      tokens.push(route.request().postDataJSON().turnstileToken);
      return route.fulfill({ json: { heroes: [{ nameCn: "SP荀彧" }] } });
    });

    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    const card = section.locator(".roster-scan-card").first();
    const scan = section.getByRole("button", { name: "Đọc Tướng", exact: true });
    const resets = () => turnstileResets(page, "#section-roster-recommend .ana-turnstile");

    await card.locator('input[type="file"]').setInputFiles({ name: "kho.png", mimeType: "image/png", buffer: transparentPng });
    await scan.click();
    await expect(card.locator(".ana-note")).toContainText("Đã đọc xong");
    // Token dùng một lần: sau lượt đọc widget bị reset đúng một lần; người dùng giải lại để có token.
    await expect.poll(resets).toBe(1);
    // Chưa có token mới: bấm đọc bị chặn, không gọi Worker.
    await scan.click();
    await expect(card.locator(".ana-note")).toHaveText("Xác thực Turnstile trước.");
    expect(tokens).toEqual(["fixture-token"]);

    // Widget cấp token mới -> đọc lại được và Worker nhận token mới, không phải token đã bỏ.
    await page.evaluate(() => window.__turnstileSolve());
    await scan.click();
    await expect(card.locator(".ana-note")).toContainText("Đã đọc xong");
    expect(tokens).toEqual(["fixture-token", "fixture-token-1"]);
  });

  test("ba nút đọc ảnh không dùng chung một token: đang đọc thì khoá cả ba, nén ảnh lỗi không bỏ token", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    const tokens = [];
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route(WORKER_ROUTE, async (route) => {
      tokens.push(route.request().postDataJSON().turnstileToken);
      await held;
      return route.fulfill({ json: { heroes: [{ nameCn: "SP荀彧" }] } });
    });

    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    const [heroCard, tacticCard] = [section.locator(".roster-scan-card").nth(0), section.locator(".roster-scan-card").nth(1)];
    const scanHeroes = section.getByRole("button", { name: "Đọc Tướng", exact: true });
    const scanTactics = section.getByRole("button", { name: "Đọc Chiến pháp", exact: true });
    const resets = () => turnstileResets(page, "#section-roster-recommend .ana-turnstile");

    // Nén ảnh lỗi (tệp hỏng): chưa gửi gì nên widget không bị reset và token vẫn dùng được.
    await heroCard.locator('input[type="file"]').setInputFiles({ name: "hong.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
    await scanHeroes.click();
    await expect(heroCard.locator(".ana-note")).not.toHaveText(/Đang đọc/u);
    await expect(heroCard.locator(".ana-note")).not.toHaveText("");
    expect(await resets()).toBe(0);
    expect(tokens).toEqual([]);

    await heroCard.locator('input[type="file"]').setInputFiles({ name: "kho.png", mimeType: "image/png", buffer: transparentPng });
    await tacticCard.locator('input[type="file"]').setInputFiles({ name: "cp.png", mimeType: "image/png", buffer: transparentPng });
    await scanHeroes.click();
    await expect.poll(() => tokens.length).toBe(1);
    // Đang đọc: cả ba nút khoá; bấm nút thứ hai không gửi thêm request nào.
    await expect(scanTactics).toBeDisabled();
    await expect(section.getByRole("button", { name: /^Đọc / })).toHaveCount(3);
    for (const button of await section.getByRole("button", { name: /^Đọc / }).all()) await expect(button).toBeDisabled();
    await scanTactics.click({ force: true });
    release();
    await expect(heroCard.locator(".ana-note")).toContainText("Đã đọc xong");
    await expect(scanTactics).toBeEnabled();
    expect(tokens).toEqual(["fixture-token"]);
    await expect.poll(resets).toBe(1);

    // Token đã dùng: thẻ thứ hai phải chờ token mới.
    await scanTactics.click();
    await expect(tacticCard.locator(".ana-note")).toHaveText("Xác thực Turnstile trước.");
    expect(tokens).toEqual(["fixture-token"]);
  });

  test("tiến trình 1–2–3, danh sách 5 đội đánh số và nút sửa kho giữ focus", async ({ page, request }) => {
    await seedRoster(page, request);
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);

    const section = page.locator("#section-roster-recommend");
    await expect(section.locator("h1.reference-title")).toHaveText("Gợi ý đội từ kho");
    await expect(section.locator(".tool-notice")).toContainText("AI đọc ảnh, và chỉ giải thích món bù khi bạn hỏi");

    const steps = section.locator(".roster-step");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toHaveText("1 · Đọc kho");
    await expect(steps.nth(1)).toHaveText("2 · Kiểm tra");
    await expect(steps.nth(2)).toHaveText("3 · Gợi ý");
    await expect(steps.nth(0)).toHaveAttribute("data-state", "done");
    await expect(steps.nth(1)).toHaveAttribute("data-state", "current");
    await expect(section.locator(".roster-scan-card").first()).toContainText("BƯỚC 1");
    await expect(section.locator(".roster-scan-state").first()).toHaveText("Xong");

    await section.getByRole("button", { name: "Xác nhận dữ liệu đã đọc" }).click();
    await expect(steps.nth(1)).toHaveAttribute("data-state", "done");
    await expect(steps.nth(2)).toHaveAttribute("data-state", "current");

    await section.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();
    await expect(steps.nth(2)).toHaveAttribute("data-state", "done");
    const results = section.locator(".roster-results");
    await expect(results).toHaveCount(1);
    const firstList = results.locator(".roster-team-list").first();
    const numbered = firstList.locator(".roster-result-team");
    await expect(numbered.first()).toBeVisible();
    // Danh sách 5 đội đánh số liên tục từ 1 theo thứ tự engine trả về.
    const rowCount = await numbered.count();
    expect(rowCount).toBeGreaterThan(0);
    const ranks = await numbered.evaluateAll((nodes) => nodes.map((node) => node.querySelector(".roster-rank").textContent));
    expect(ranks).toEqual(Array.from({ length: rowCount }, (_, index) => String(index + 1)));
    await expect(numbered.first().locator(".roster-result-name")).not.toHaveText("");
    await expect(numbered.first().locator(".roster-status")).not.toHaveText("");

    // Hàng kết quả + pill trạng thái chỉ dùng giá trị token.
    const styles = await numbered.first().evaluate((node) => {
      const root = getComputedStyle(document.documentElement);
      const row = getComputedStyle(node);
      const pill = getComputedStyle(node.querySelector(".roster-status"));
      return {
        padding: `${row.paddingTop}/${row.paddingLeft}`,
        rankFont: getComputedStyle(node.querySelector(".roster-rank")).fontFamily,
        pillRadius: pill.borderRadius,
        pillHeight: pill.minHeight,
        pillBackground: pill.backgroundColor,
      };
    });
    expect(styles.padding).toBe("14px/16px");
    expect(styles.rankFont).toContain("Noto Serif Display");
    expect(styles.pillRadius).toBe("999px");
    expect(styles.pillHeight).toBe("24px");

    // Chi tiết cấu hình mở từ hàng kết quả (hành vi cũ).
    const openTeam = results.getByRole("button", { name: "Mở đội", exact: true }).first();
    if (await openTeam.count()) {
      await openTeam.click();
      await expect(page.locator("#team-detail-body")).toBeVisible();
    }
  });

  test("đội khóa có nút bỏ (giữ sau tải lại) và nút xóa toàn bộ kho đưa về Chưa đọc", async ({ page }) => {
    await seed(page, {
      "tqccl.rosterRecommend.scanState.v1": {
        ownedHeroes: [{ name: "Lưu Bị" }],
        ownedTactics: [{ name: "Nhân Đức" }],
        lockedTeams: [
          { teamName: "Đội khóa A", heroes: ["Lưu Bị"], tactics: ["Nhân Đức"] },
          { teamName: "Đội khóa B", heroes: ["Tào Tháo"], tactics: ["Hổ Báo Kỵ"] },
        ],
        confirmed: false,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    });
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    const lockedTeams = section.locator(".roster-locked-team");
    await expect(lockedTeams).toHaveCount(2);

    await lockedTeams.filter({ hasText: "Đội khóa A" }).getByRole("button", { name: "Bỏ đội Đội khóa A" }).click();
    await expect(lockedTeams).toHaveCount(1);
    await expect(lockedTeams).toContainText("Đội khóa B");
    await page.reload();
    await waitForBoot(page);
    await expect(lockedTeams).toHaveCount(1);
    await expect(lockedTeams).toContainText("Đội khóa B");

    page.once("dialog", (dialog) => dialog.accept());
    await section.getByRole("button", { name: "Xóa toàn bộ kho", exact: true }).click();
    await expect(section.locator(".roster-scan-count")).toHaveText(["Chưa đọc", "Chưa đọc", "Chưa đọc"]);
    await expect(lockedTeams).toHaveCount(0);
    await page.reload();
    await waitForBoot(page);
    await expect(section.locator(".roster-scan-count")).toHaveText(["Chưa đọc", "Chưa đọc", "Chưa đọc"]);
  });

  test("mobile: nút Sửa kho đã đọc mở/đóng khu kiểm tra và giữ focus; thêm/bỏ chip giữ focus", async ({ page, request }) => {
    await seedRoster(page, request, { single: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);

    const section = page.locator("#section-roster-recommend");
    const toggle = section.locator(".roster-review-toggle");
    const review = section.locator("#roster-review-area");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText("Sửa kho đã đọc");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(review).toBeHidden();

    await toggle.click();
    await expect(review).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(review).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(review).toBeVisible();

    // Xoá chip: focus chuyển sang chip kế tiếp, không rơi về BODY.
    const heroPanel = section.locator(".roster-review-panel").filter({ has: page.locator("h3", { hasText: "Tướng đã đọc" }) });
    const removes = heroPanel.locator(".roster-remove");
    await expect(removes).toHaveCount(3);
    await removes.nth(0).focus();
    await page.keyboard.press("Enter");
    await expect(removes).toHaveCount(2);
    await expect(removes.nth(0)).toBeFocused();

    // Thêm chip: nút "Thêm" giữ focus, ô nhập được xoá.
    const input = heroPanel.locator('input[placeholder="Thêm thủ công"]');
    await input.fill("Tướng thử nghiệm");
    const addButton = heroPanel.getByRole("button", { name: "Thêm", exact: true });
    await addButton.focus();
    await page.keyboard.press("Enter");
    await expect(heroPanel.locator(".roster-chip-list li")).toHaveCount(3);
    await expect(addButton).toBeFocused();
    await expect(input).toHaveValue("");
    await expect(heroPanel).toContainText("Tướng thử nghiệm");
  });

  test("mục Thiếu món ghi tên tướng thiếu theo slot, không lộ mã canonical", async ({ page, request }) => {
    await seedRoster(page, request);
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    await section.getByRole("button", { name: "Xác nhận dữ liệu đã đọc" }).click();
    await section.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();

    const missing = section.locator(".roster-missing-section");
    await expect(missing.locator("h3")).toHaveText("Thiếu món");
    const missingHeroes = missing.locator(".roster-missing-slot .roster-result-meta").filter({ hasText: /^Thiếu tướng / });
    await expect(missingHeroes.first()).toBeVisible();
    await expect(missing).not.toContainText("hero:");
    await expect(missing).not.toContainText("tactic:");
    const recommended = section.locator(".roster-team-list .roster-result-meta");
    await expect(recommended.first()).toBeVisible();
    for (const line of await recommended.allInnerTexts()) {
      if (line.startsWith("Chiến pháp:") || line.startsWith("Đã thay:")) expect(line).not.toContain("tactic:");
    }
  });

  /**
   * Kho dựng từ đúng một đội chuẩn của mùa mặc định: bỏ một chiến pháp của một tướng còn món khác ở
   * cấu hình cùng mùa, và có sẵn các món đó trong kho — đội rơi vào Thiếu món với món bù.
   */
  function seasonMissingFixture() {
    const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
    const { generationId } = read("src/data/recommended-reference/current.json");
    const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
    const { defaultSourceSeasonId } = read(`src/data/recommended-reference/${generationId}/seasons.json`);
    const dicts = { heroesDict: read("data/heroes-dict.json"), tacticsDict: read("data/tactics.json") };
    const { teams } = buildSeasonCandidates(records, defaultSourceSeasonId, dicts);
    const usage = seasonTacticUsage(teams);
    // Chế độ Meta chỉ xét T0–T1: đội ngoài bậc đó không vào Thiếu món.
    for (const team of teams.filter((item) => ["T0", "T0.5", "T1"].includes(item.tier))) {
      const teamTactics = team.heroes.flatMap((hero) => hero.tactics.map((tactic) => tactic.name));
      for (const hero of team.heroes) {
        const extras = [...(usage.get(canonicalHeroId(hero.name)) || new Map()).keys()].filter((name) => !teamTactics.includes(name));
        if (!hero.tactics.length || !extras.length) continue;
        const missing = hero.tactics[0].name;
        return {
          seasonId: defaultSourceSeasonId,
          team,
          hero: hero.name,
          missing,
          substitutes: extras,
          state: {
            ownedHeroes: team.heroes.map((item) => ({ name: item.name })),
            ownedTactics: [...teamTactics.filter((name) => name !== missing), ...extras].map((name) => ({ name })),
            lockedTeams: [],
            confirmed: true,
            updatedAt: "2026-09-29T00:00:00.000Z",
          },
        };
      }
    }
    throw new Error("no season team with a substitutable tactic");
  }

  test("mùa mặc định, Thiếu món: Vì sao? gọi Worker không ảnh, Dùng món này rồi Bỏ món thay, Tôi có…, đổi mùa ghi URL", async ({ page }) => {
    const fixture = seasonMissingFixture();
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    const bodies = [];
    await page.route(WORKER_ROUTE, (route) => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ json: { explanation: "Món bù không có hiệu ứng hồi phục như món gốc." } });
    });
    await seed(page, { "tqccl.rosterRecommend.scanState.v1": fixture.state });
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    const season = section.getByLabel("Mùa bạn đang chơi");
    await expect(season).toBeEnabled();
    await expect(season).toHaveValue(fixture.seasonId);
    await section.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();

    const card = section.locator(".roster-missing").filter({ hasText: fixture.team.name });
    const slot = card.locator(".roster-missing-slot").filter({ hasText: `Thiếu chiến pháp ${fixture.missing} (${fixture.hero})` });
    await expect(slot).toBeVisible();
    const firstSubstitute = slot.locator(".roster-substitutes li").first();
    const substitute = await firstSubstitute.locator(".roster-substitute-name").innerText();
    expect(fixture.substitutes).toContain(substitute);

    await firstSubstitute.getByRole("button", { name: "Vì sao?" }).click();
    await expect(firstSubstitute.locator(".roster-explain")).toHaveText("Món bù không có hiệu ứng hồi phục như món gốc.");
    expect(bodies).toHaveLength(1);
    expect(bodies[0].mode).toBe("explainSubstitute");
    expect(bodies[0]).not.toHaveProperty("image");
    expect(bodies[0].context).toMatchObject({ locale: "vi", hero: fixture.hero, missing: { name: fixture.missing }, substitute: { name: substitute } });
    // Cùng câu hỏi lần hai dùng kết quả đã có, không tốn thêm lượt Worker.
    await firstSubstitute.getByRole("button", { name: "Vì sao?" }).click();
    expect(bodies).toHaveLength(1);

    await firstSubstitute.getByRole("button", { name: `Dùng ${substitute} thay ${fixture.missing}` }).click();
    const portfolio = section.locator(".roster-results section").first();
    const row = portfolio.locator(".roster-result-team").filter({ hasText: fixture.team.name });
    await expect(row).toContainText(`Đã thay: ${fixture.missing} → ${substitute}`);
    await expect(section.locator(".roster-missing").filter({ hasText: fixture.team.name })).toHaveCount(0);
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("tqccl.rosterRecommend.scanState.v1")));
    expect((await stored()).tacticOverrides).toEqual([expect.objectContaining({ teamId: fixture.team.id, tactic: substitute })]);

    await row.getByRole("button", { name: "Bỏ món thay" }).click();
    await expect(slot).toBeVisible();
    expect((await stored()).tacticOverrides).toEqual([]);

    await slot.getByRole("button", { name: `Tôi có chiến pháp ${fixture.missing}` }).click();
    await expect(portfolio.locator(".roster-result-team").filter({ hasText: fixture.team.name }).locator(".roster-status")).toHaveText("Có thể xây dựng ngay");
    expect((await stored()).ownedTactics.map((item) => item.name)).toContain(fixture.missing);

    await season.selectOption("pk-s28");
    await expect(page).toHaveURL(/\/goi-y-doi-tu-kho\/\?season=pk-s28$/);
    await expect(section.locator(".roster-results")).toHaveCount(0);
    await page.reload();
    await waitForBoot(page);
    await expect(season).toHaveValue("pk-s28");
  });

  test("kho rỗng: nút Xác nhận khoá, bước Kiểm tra và Gợi ý còn chờ", async ({ page }) => {
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    await expect(section.locator(".roster-scan-count")).toHaveText(["Chưa đọc", "Chưa đọc", "Chưa đọc"]);
    await expect(section.getByRole("button", { name: "Xác nhận dữ liệu đã đọc" })).toBeDisabled();
    await expect(section.getByRole("button", { name: "Gợi ý 5 đội", exact: true })).toBeDisabled();
    await expect(section.locator('.roster-step[data-step="scan"]')).toHaveAttribute("data-state", "current");
    await expect(section.locator('.roster-step[data-step="review"]')).toHaveAttribute("data-state", "pending");
    await expect(section.locator('.roster-step[data-step="suggest"]')).toHaveAttribute("data-state", "pending");
  });

  test("Nên thêm: đủ 5 đội khóa và không đội nào thêm được là hai câu khác nhau", async ({ page }) => {
    const lockedTeams = [1, 2, 3, 4, 5].map((index) => ({
      teamName: `Đội khóa ${index}`,
      heroes: [`Tướng khóa ${index}`],
      tactics: [`Chiến pháp khóa ${index}`],
    }));
    await seed(page, {
      "tqccl.rosterRecommend.scanState.v1": {
        ownedHeroes: [{ name: "Lưu Bị" }],
        ownedTactics: [{ name: "Nhân Đức" }],
        lockedTeams,
        confirmed: false,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    });
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    const addSection = section.locator(".roster-results section").filter({ has: page.locator("h3", { hasText: "Nên thêm" }) });
    const suggest = async () => {
      await section.getByRole("button", { name: "Xác nhận dữ liệu đã đọc" }).click();
      await section.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();
    };

    await suggest();
    await expect(section.locator(".roster-team-list").first().locator(".roster-result-team")).toHaveCount(5);
    await expect(addSection.locator(".roster-empty")).toHaveText("Đã đủ 5 đội.");

    // Bỏ hết đội khóa: kho chỉ còn một tướng, không đội nào xây được.
    const removeButtons = section.locator(".roster-locked-team").getByRole("button", { name: /^Bỏ đội / });
    while (await removeButtons.count()) await removeButtons.first().click();
    await suggest();
    const noneText = (await addSection.locator(".roster-empty").innerText()).trim();
    expect(noneText).not.toBe("");
    expect(noneText).not.toContain("Đã đủ");
  });

  test("ô chọn ảnh: không lộ input file hệ thống, mỗi thẻ có nút Chọn ảnh mở hộp chọn tệp", async ({ page }) => {
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    const cards = section.locator(".roster-scan-card");
    await expect(cards).toHaveCount(3);
    await expect(section.locator('input[type="file"]:visible')).toHaveCount(0);
    for (let index = 0; index < 3; index++) {
      const pick = cards.nth(index).getByRole("button", { name: "Chọn ảnh", exact: true });
      await expect(pick).toBeVisible();
      const chooser = page.waitForEvent("filechooser");
      await pick.click();
      await (await chooser).setFiles({ name: `kho-${index}.png`, mimeType: "image/png", buffer: transparentPng });
      await expect(cards.nth(index)).toContainText(`kho-${index}.png`);
    }
  });

  test("tên đọc từ ảnh không khớp từ điển có dấu kiểm tra và nằm đầu danh sách", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    await page.route(WORKER_ROUTE, (route) => route.fulfill({ json: { heroes: [{ nameCn: "SP荀彧" }, { nameCn: "陌生武将" }] } }));
    await seed(page, {
      "tqccl.rosterRecommend.scanState.v1": {
        ownedHeroes: [{ name: "Lưu Bị", confidence: "high" }, { name: "Tào Tháo", confidence: "manual" }],
        ownedTactics: [],
        lockedTeams: [],
        confirmed: false,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    });
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    const card = section.locator(".roster-scan-card").first();
    await card.locator('input[type="file"]').setInputFiles({ name: "kho.png", mimeType: "image/png", buffer: transparentPng });
    await section.getByRole("button", { name: "Đọc Tướng", exact: true }).click();
    await expect(card.locator(".ana-note")).toContainText("Đã đọc xong");

    const heroPanel = section.locator(".roster-review-panel").filter({ has: page.locator("h3", { hasText: "Tướng đã đọc" }) });
    const chips = heroPanel.locator(".roster-chip-list li");
    await expect(chips).toHaveCount(4);
    await expect(chips.filter({ hasText: "kiểm tra" })).toHaveCount(1);
    await expect(chips.first()).toContainText("kiểm tra");
    await expect(chips.first().getByText("kiểm tra", { exact: true })).toBeVisible();
    for (const name of ["Lưu Bị", "Tào Tháo", "Tuân Úc"]) {
      await expect(chips.filter({ hasText: name })).not.toContainText("kiểm tra");
    }
  });
});

/* ---------- Vòng sửa P09: huỷ kết quả khi kho đổi, nhập JSON cùng id, bố cục hàng có dữ liệu ---------- */

test.describe("Vòng sửa P09", () => {
  const seedRoster20 = async (page, request) => {
    const teams = await (await request.get("/data/teams.json")).json();
    const source = teams.slice(0, 20);
    await seed(page, {
      "tqccl.rosterRecommend.scanState.v1": {
        ownedHeroes: [...new Set(source.flatMap((team) => team.heroes.map((hero) => hero.name || hero.baseName)))].map((name) => ({ name })),
        ownedTactics: [...new Set(source.flatMap((team) => team.heroes.flatMap((hero) => (hero.tactics || []).map((tactic) => tactic.name))))].map((name) => ({ name })),
        lockedTeams: [],
        confirmed: false,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    });
  };

  const expectInvalidated = async (page, section) => {
    await expect(section.locator(".roster-results")).toHaveCount(0);
    await expect(section.locator('.roster-step[data-step="suggest"]')).toHaveAttribute("data-state", "pending");
    await expect(section.getByRole("button", { name: "Gợi ý 5 đội", exact: true })).toBeDisabled();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tqccl.rosterRecommend.scanState.v1")));
    expect(stored.confirmed).toBe(false);
  };

  test("mọi thay đổi kho (bỏ, thêm, đọc ảnh) huỷ kết quả gợi ý cũ ngay lập tức", async ({ page, request }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    await page.route(WORKER_ROUTE, (route) => route.fulfill({ json: { heroes: [{ nameCn: "SP荀彧" }] } }));
    await seedRoster20(page, request);
    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    const confirm = section.getByRole("button", { name: "Xác nhận dữ liệu đã đọc" });
    const recommend = section.getByRole("button", { name: "Gợi ý 5 đội", exact: true });

    await confirm.click();
    await recommend.click();
    await expect(section.locator(".roster-results")).toHaveCount(1);
    await expect(section.locator('.roster-step[data-step="suggest"]')).toHaveAttribute("data-state", "done");
    await expect(recommend).toBeEnabled();

    // 1) Bỏ một chip: kết quả biến mất, tiến trình không còn "xong", nút Gợi ý khoá lại.
    const heroPanel = section.locator(".roster-review-panel").filter({ has: page.locator("h3", { hasText: "Tướng đã đọc" }) });
    const removes = heroPanel.locator(".roster-remove");
    await removes.first().focus();
    await page.keyboard.press("Enter");
    await expectInvalidated(page, section);
    await expect(removes.first()).toBeFocused();
    await confirm.click();
    await recommend.click();
    await expect(section.locator(".roster-results")).toHaveCount(1);

    // 2) Thêm một chip thủ công.
    const input = heroPanel.locator('input[placeholder="Thêm thủ công"]');
    await input.fill("Tướng thử nghiệm");
    const add = heroPanel.getByRole("button", { name: "Thêm", exact: true });
    await add.focus();
    await page.keyboard.press("Enter");
    await expectInvalidated(page, section);
    await expect(add).toBeFocused();
    await confirm.click();
    await recommend.click();
    await expect(section.locator(".roster-results")).toHaveCount(1);

    // 3) Đọc ảnh thành công cũng là thay đổi kho.
    await section.locator('.roster-scan-card input[type="file"]').first().setInputFiles({ name: "kho.png", mimeType: "image/png", buffer: transparentPng });
    await section.getByRole("button", { name: "Đọc Tướng", exact: true }).click();
    await expect(section.locator(".roster-scan-card").first()).toContainText("Đã đọc xong");
    await expectInvalidated(page, section);

    // Xác nhận lại thì gợi ý chạy được trên kho đã đổi.
    await confirm.click();
    await recommend.click();
    await expect(section.locator(".roster-results")).toHaveCount(1);

    // Tải lại trang: trạng thái đã lưu vẫn đúng.
    await page.reload();
    await waitForBoot(page);
    await expect(section.locator(".roster-review-panel").first()).toBeVisible();
  });

  test("nhập JSON gộp theo bản sửa mới nhất: gói cùng id đổi tên hiện tên mới ngay, không cần tải lại", async ({ page }) => {
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    let exported = null;
    const nativeDialogs = forbidNativeDialogs(page);
    await page.goto("/theo-doi-chieu-mo/");
    await waitForBoot(page);
    const section = page.locator("#section-recruit-tracker");
    const banner = section.locator(".rt-banner");
    await expect(banner.locator(".rt-banner-name")).toHaveText("Gói hạn giờ A");

    // Nhập là GỘP (không ghi đè): bản trong file phải mới hơn bản tại chỗ mới thắng. File v1 không có
    // `updatedAt`, nên gói đổi tên mang `createdAt` mới hơn (dữ liệu tại chỗ không có mốc = cũ nhất).
    const imported = structuredClone(RECRUIT_FIXTURE);
    const importedBanner = imported.banners.find((item) => item.id === "banner-limited");
    importedBanner.name = "Gói hạn giờ B";
    importedBanner.pityLimit = 45;
    importedBanner.createdAt = "2026-07-02T00:00:00.000Z";
    imported.exportedAt = null;

    // Input file trong suốt trong menu ⋯: Tab từ "Xuất JSON" phải để lại vòng focus nhìn thấy được trên "Nhập JSON".
    await section.locator(".rt-account-toggle").click();
    await section.getByRole("button", { name: "Xuất JSON", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(section.locator(".rt-file")).toBeFocused();
    const importRing = await section.locator(".rt-import").evaluate((label) => {
      const style = getComputedStyle(label);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(importRing.style).toBe("solid");
    expect(importRing.width).toBeGreaterThan(0);
    await section.locator(".rt-file").setInputFiles({
      name: "tracker.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imported)),
    });

    // Hộp thoại xác nhận trong trang (không `confirm()`), kèm số bản ghi của file.
    const dialog = page.locator("dialog.rt-dialog");
    await expect(dialog.locator("h2")).toHaveText("Gộp dữ liệu từ file?");
    await expect(dialog.locator(".donate-dialog-lead")).toContainText("File có 1 tài khoản, 2 đợt chiêu mộ, 3 lượt quay.");
    await dialog.getByRole("button", { name: "Gộp dữ liệu", exact: true }).click();
    await expect(section.locator(".rt-toast")).toContainText("Đã nhập JSON.");
    const afterImport = await page.evaluate(() => {
      const banners = [...document.querySelectorAll("#section-recruit-tracker .rt-banner")];
      return {
        count: banners.length,
        names: banners.map((node) => node.querySelector(".rt-banner-name").textContent),
        counts: banners.map((node) => node.querySelector(".rt-banner-count").textContent),
        meterLabel: banners[0]?.querySelector("[role='meter']")?.getAttribute("aria-label"),
        meterMax: banners[0]?.querySelector("[role='meter']")?.getAttribute("aria-valuemax"),
        meterText: banners[0]?.querySelector("[role='meter']")?.getAttribute("aria-valuetext"),
        stored: JSON.parse(localStorage.getItem("tqcclRecruitTracker")).banners.map((item) => item.name),
        events: JSON.parse(localStorage.getItem("tqcclRecruitTracker")).pullEvents.length,
      };
    });
    expect(afterImport.stored).toEqual(["Danh tướng PK", "Gói hạn giờ B"]);
    expect(afterImport.names).toEqual(["Gói hạn giờ B"]);
    expect(afterImport.counts).toEqual(["31/45"]);
    expect(afterImport.meterLabel).toBe("Tiến độ bảo hiểm 5★ · Gói hạn giờ B");
    expect(afterImport.meterMax).toBe("45");
    expect(afterImport.meterText).toBe("31 / 45 lượt");
    // Lượt cùng id không nhân đôi khi gộp.
    expect(afterImport.events).toBe(3);
    await section.locator(".rt-banner").first().locator(".rt-five-btn").click();
    await expect(dialog.locator("h2")).toHaveText("Ghi 5★ · Gói hạn giờ B");
    await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(dialog).toBeHidden();

    // Xuất JSON (tải về) phải khớp trạng thái đang hiện.
    await section.locator(".rt-account-toggle").click();
    const download = await Promise.all([
      page.waitForEvent("download"),
      section.getByRole("button", { name: "Xuất JSON", exact: true }).click(),
    ]).then(([item]) => item);
    exported = JSON.parse(await new Promise((resolve) => download.createReadStream().then((stream) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    })));
    expect(exported.banners.find((item) => item.id === "banner-limited").name).toBe("Gói hạn giờ B");

    await page.reload();
    await waitForBoot(page);
    const afterReload = await page.evaluate(() => ({
      dom: document.querySelector("#section-recruit-tracker .rt-banner-name")?.textContent ?? null,
      stored: JSON.parse(localStorage.getItem("tqcclRecruitTracker")).banners.map((item) => item.name),
    }));
    expect(afterReload).toEqual({ dom: "Gói hạn giờ B", stored: ["Danh tướng PK", "Gói hạn giờ B"] });
    expect(nativeDialogs).toEqual([]);
  });

  test("hàng kết quả có dữ liệu: số thứ tự, tên đội và nút Mở đội đúng cột; pill đúng màu theo trạng thái", async ({ page, request }) => {
    await seedRoster20(page, request);
    for (const width of [1440, 390, 320]) {
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 1000 });
        await ensureTheme(page, theme);
        await page.goto("/goi-y-doi-tu-kho/");
        await waitForBoot(page);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const section = page.locator("#section-roster-recommend");
        await section.getByRole("button", { name: "Xác nhận dữ liệu đã đọc" }).click();
        await section.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();
        const ranked = section.locator(".roster-result-team").filter({ has: page.locator(".roster-rank") }).first();
        await expect(ranked).toBeVisible();
        const geometry = await ranked.evaluate((node) => {
          const rect = (selector) => {
            const el = node.querySelector(selector);
            return el ? { x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, w: el.getBoundingClientRect().width } : null;
          };
          return { rank: rect(".roster-rank"), main: rect(".roster-result-main"), action: rect(".ana-link-btn"), name: rect(".roster-result-name") };
        });
        expect(geometry.rank.x).toBeLessThan(geometry.main.x);
        expect(geometry.name.w).toBeGreaterThan(100);
        expect(geometry.action).not.toBeNull();
        if (width > 680) expect(geometry.action.x).toBeGreaterThan(geometry.main.x);
        else expect(geometry.action.y).toBeGreaterThan(geometry.name.y);
        const blocked = section.locator(".roster-result-team.roster-missing").first();
        if (await blocked.count()) {
          const blockedName = await blocked.locator(".roster-result-name").evaluate((node) => node.getBoundingClientRect().width);
          expect(blockedName).toBeGreaterThan(100);
        }
        // Pill trạng thái phải ăn rule màu (trước vòng sửa thiếu `data-status` nên rơi về cặp trung tính).
        const pill = ranked.locator(".roster-status");
        const styles = await pill.evaluate((node) => {
          const root = getComputedStyle(document.documentElement);
          return {
            status: node.dataset.status,
            background: getComputedStyle(node).backgroundColor,
            color: getComputedStyle(node).color,
            panel3: root.getPropertyValue("--panel-3").trim(),
            good: root.getPropertyValue("--good").trim(),
          };
        });
        expect(styles.status).toBe("build-now");
        expect(toRgb(styles.panel3)).toBe(styles.background);
        expect(toRgb(styles.good)).toBe(styles.color);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({
          path: `.cache/design-compare/phase-09-populated/roster-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  });

  test("Soi đội có kết quả: chụp ảnh bằng chứng 1440/390/320 cả hai theme", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    const fixture = await analyzeFixture(page);
    for (const width of [1440, 390, 320]) {
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 1000 });
        await ensureTheme(page, theme);
        // Kết quả dựng từ link chia sẻ: editor đủ ô + hai nhóm đối chiếu có diff.
        await page.goto(`/soi-doi-tu-anh/?season=${encodeURIComponent(fixture.season)}&doi=${fixture.doi}`);
        await waitForBoot(page);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const section = page.locator("#section-analyze");
        await expect(section.locator(".ana-team-row").first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({
          path: `.cache/design-compare/phase-09-populated/analyze-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  });
});

/**
 * Turnstile giả lỗi như widget thật (ví dụ 110200 khi domain không nằm trong allowlist): cấp token rồi báo lỗi;
 * widget thật ném `TurnstileError` ra ngoài khi trang không có `error-callback` hoặc callback không trả `true`.
 */
const TURNSTILE_ERROR_STUB = [
  "window.turnstile={",
  "render:(node,options)=>{options.callback('fixture-token');setTimeout(()=>{",
  "const handler=options['error-callback'];",
  "if(typeof handler!=='function'||handler('110200')!==true)throw new Error('[Cloudflare Turnstile] Error: 110200.');",
  "},0);},",
  "reset:()=>{},",
  "};",
].join("");

test.describe("Turnstile báo lỗi", () => {
  test("Soi đội: không có lỗi trang, báo câu tiếng Việt và bỏ token", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_ERROR_STUB }));
    let workerCalls = 0;
    await page.route(WORKER_ROUTE, (route) => { workerCalls += 1; return route.fulfill({ json: { heroes: [] } }); });

    await page.goto("/soi-doi-tu-anh/");
    await waitForBoot(page);
    const section = page.locator("#section-analyze");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(pageErrors).toEqual([]);
    await expect(section.locator(".ana-status")).toHaveText("Xác thực chống bot không thành công. Tải lại trang rồi thử lại.");
    await expect(section.locator(".ana-step").nth(1)).toHaveAttribute("data-state", "pending");
    await section.locator("input[type=file]").setInputFiles({ name: "doi-hinh.png", mimeType: "image/png", buffer: transparentPng });
    await expect(section.locator(".ana-step").nth(0)).toHaveAttribute("data-state", "done");
    await expect(section.getByRole("button", { name: "Soi đội", exact: true })).toBeDisabled();
    expect(workerCalls).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test("Gợi ý đội: không có lỗi trang, báo câu tiếng Việt và bỏ token", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_ERROR_STUB }));
    let workerCalls = 0;
    await page.route(WORKER_ROUTE, (route) => { workerCalls += 1; return route.fulfill({ json: { heroes: [] } }); });

    await page.goto("/goi-y-doi-tu-kho/");
    await waitForBoot(page);
    const section = page.locator("#section-roster-recommend");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(pageErrors).toEqual([]);
    await expect(section.locator(".roster-controls .ana-status")).toHaveText("Xác thực chống bot không thành công. Tải lại trang rồi thử lại.");
    const card = section.locator(".roster-scan-card").first();
    await card.locator('input[type="file"]').setInputFiles({ name: "kho.png", mimeType: "image/png", buffer: transparentPng });
    await section.getByRole("button", { name: "Đọc Tướng", exact: true }).click();
    await expect(card.locator(".ana-note")).toHaveText("Xác thực Turnstile trước.");
    expect(workerCalls).toBe(0);
    expect(pageErrors).toEqual([]);
  });
});
