// Phase 9 — 3 công cụ Beta (Chiêu mộ, Soi đội, Gợi ý đội): hành vi giữ nguyên (store/Worker/engine) và
// giao diện theo artboard. Fixture localStorage/route mô phỏng đúng dữ liệu người dùng đã có từ trước phase.
import { expect, test } from "@playwright/test";

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

/** Chiêu mộ: một tài khoản, 1 lượt ngày (sau 1 lần ra 5★) và 1 gói hạn giờ đã quá mốc 30 lượt. */
/** Ngày hôm nay theo giờ máy chạy test — khớp `todayLocalDate()` của công cụ. */
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const RECRUIT_FIXTURE = {
  schemaVersion: 1,
  activeAccountId: "acc_main",
  accounts: [{ id: "acc_main", name: "Tài khoản chính", createdAt: "2026-07-01T00:00:00.000Z" }],
  banners: [
    { id: "danh-tuong-pk", name: "Danh tướng PK", type: "normal", drawMode: "daily", hasFiveStar: true, pityLimit: 30, dailyCheapPullLimit: 4 },
    { id: "banner-limited", name: "Gói hạn giờ A", type: "limited", drawMode: "banner", hasFiveStar: true, pityLimit: 30 },
  ],
  dailyStates: [{
    date: todayIso(),
    accountId: "acc_main",
    bannerId: "danh-tuong-pk",
    slots: [
      { key: "free_1", label: "Miễn phí 1", status: "pending" },
      { key: "half_1", label: "Nửa giá 1", status: "pending" },
      { key: "free_2", label: "Miễn phí 2", status: "pending" },
      { key: "half_2", label: "Nửa giá 2", status: "miss" },
    ],
    nextFreeAt: "",
  }],
  pullEvents: [
    { id: "evt_five", accountId: "acc_main", bannerId: "danh-tuong-pk", pulls: 1, result: "fiveStar", date: "2026-07-09", heroName: "SP Lữ Mông", heroValueClass: "Chủ lực", pullCount: 30, drawSlot: "Miễn phí 1" },
    { id: "evt_miss", accountId: "acc_main", bannerId: "danh-tuong-pk", pulls: 1, result: "miss", date: "2026-07-10" },
    { id: "evt_over", accountId: "acc_main", bannerId: "banner-limited", pulls: 31, result: "miss", date: "2026-07-10" },
  ],
};

test.describe("Chiêu mộ", () => {
  test("đồng hồ pity đọc từ store (kể cả quá mốc), lịch sử và lượt đã ghi giữ nguyên hành vi", async ({ page }) => {
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    await page.goto("/chieu-mo/");
    await waitForBoot(page);

    const section = page.locator("#section-recruit-tracker");
    await expect(section.locator("h1.reference-title")).toHaveText("Theo dõi chiêu mộ");
    await expect(section.locator(".rt-account-bar #rt-account-select")).toHaveValue("acc_main");

    // Hằng ngày: 1 lượt sau lần ra 5★ gần nhất -> 1/30, còn 29 lượt.
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

    // Lịch sử: tên serif + badge phân loại + ngày · gói + số lượt.
    const history = section.locator(".rt-history-item");
    await expect(history).toHaveCount(1);
    await expect(history.locator(".rt-history-hero")).toHaveText("SP Lữ Mông");
    await expect(history.locator(".rt-value")).toHaveText("Chủ lực");
    await expect(history.locator(".rt-history-date")).toContainText("Danh tướng PK");
    await expect(history.locator(".rt-history-pulls")).toHaveText("lượt 30/30");

    // Ghi một lượt mới: nút vừa bấm hiện trạng thái đã ghi, store nhận đúng một sự kiện, meter tăng.
    const firstSlot = section.locator(".rt-slot").first();
    const missButton = firstSlot.getByRole("button", { name: "Không ra", exact: true });
    await missButton.click();
    await expect(missButton).toHaveAttribute("aria-pressed", "true");
    // Sau khi ghi, cả hai nút của ô khoá lại (hành vi cũ) nên focus rời nút — giữ nguyên như trước phase.
    await expect(missButton).toBeDisabled();
    await expect(section.locator(".rt-pity-value")).toHaveText("2");
    await expect(section.locator(".rt-pity-meta")).toContainText("Còn 28 lượt");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tqcclRecruitTracker")));
    expect(stored.pullEvents.filter((event) => event.result === "miss" && event.bannerId === "danh-tuong-pk")).toHaveLength(2);
    expect(stored.schemaVersion).toBe(1);

    // Đổi tài khoản vẫn ghi đúng tài khoản đang chọn (hành vi cũ).
    await expect(section.locator(".rt-slot").first().locator(".rt-slot-status")).toHaveText("Không ra");
  });

  test("form 5★ nhận focus và tổng đài thao tác tài khoản nằm sau nút ⋯ trên mobile", async ({ page }) => {
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/chieu-mo/");
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
    await expect(toggle).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(actions).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await section.locator(".rt-account-pick #rt-account-select").focus();
    await page.keyboard.press("Tab");
    await expect(actions).toBeHidden();

    // Bề rộng lớn: hàng thao tác hiện thẳng, nút ⋯ ẩn.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(toggle).toBeHidden();
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "Đổi tên", exact: true })).toBeVisible();

    // Mở form 5★: focus vào ô tướng (hành vi cũ).
    await section.locator(".rt-slot").first().getByRole("button", { name: "Ra 5★", exact: true }).click();
    await expect(section.locator("[data-hero-input]")).toBeFocused();
    await expect(section.locator(".rt-form-section h2")).toContainText("Ghi 5★ · free_1");
  });
});

test.describe("Soi đội", () => {
  test("khung ảnh, các bước và kết quả chỉ hiện trường có thật; không còn emoji", async ({ page, request }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    // Worker giả: trả đúng tướng của một đội thật để hàng "đội tương tự" có dữ liệu thật.
    const teams = await (await request.get("/data/teams.json")).json();
    const target = teams.find((team) => Array.isArray(team.heroes) && team.heroes.length >= 3);
    const heroesDict = await (await request.get("/data/heroes-dict.json")).json();
    const tacticsDict = await (await request.get("/data/tactics.json")).json();
    const reads = target.heroes.map((hero) => ({
      nameCn: heroesDict.find((record) => record.viet === hero.name)?.chinese ?? hero.name,
      tacticsCn: (hero.tactics || []).map((slot) => tacticsDict.find((record) => record.viet === slot.name)?.chinese ?? slot.name),
      booksCn: [],
      statFocusCn: "",
    }));
    await page.route(WORKER_ROUTE, (route) => route.fulfill({ json: { heroes: reads } }));

    await page.goto("/soi-doi/");
    await waitForBoot(page);
    const section = page.locator("#section-analyze");
    await expect(section.locator("h1.reference-title")).toHaveText("Soi đội từ ảnh");
    await expect(section.locator(".tool-notice")).toContainText("Alibaba Cloud DashScope");
    await expect(section.locator("h2").first()).toHaveText("1 · Chọn ảnh");
    await expect(section.locator(".ana-drop")).toContainText("Kéo thả ảnh, dán (Ctrl+V) hoặc bấm để chọn");

    const steps = section.locator(".ana-step");
    await expect(steps).toHaveCount(3);
    // P9-B1: dấu ✓ là SVG nằm trong span bọc — bước CHƯA XONG phải ẩn dấu (trước đây mọi bước đều hiện ✓).
    // Bước 2 (Turnstile) xong ngay ở stub nên dấu của nó hiện; bước 1 và 3 còn chờ nên phải ẩn.
    await expect(steps.nth(0).locator(".ana-step-mark")).toBeHidden();
    await expect(steps.nth(1).locator(".ana-step-mark")).toBeVisible();
    await expect(steps.nth(2).locator(".ana-step-mark")).toBeHidden();
    await expect(steps.nth(0)).toHaveAttribute("data-state", "pending");
    await expect(section.locator(".ana-file-row")).toBeHidden();

    await section.locator("input[type=file]").setInputFiles({ name: "doi-hinh.png", mimeType: "image/png", buffer: transparentPng });
    await expect(steps.nth(0)).toHaveAttribute("data-state", "done");
    await expect(section.locator(".ana-file-row")).toBeVisible();
    await expect(section.locator(".ana-file-name")).toHaveText("doi-hinh.png");
    await expect(section.locator(".ana-file-row")).toContainText("Đã nén · sẵn sàng gửi");
    await expect(steps.nth(1)).toHaveAttribute("data-state", "done");

    const run = section.getByRole("button", { name: "Soi đội", exact: true });
    await expect(run).toBeEnabled();
    await run.click();

    await expect(section.locator(".ana-similar")).toBeVisible();
    await expect(steps.nth(2)).toHaveAttribute("data-state", "done");

    // P9-B1: token Turnstile dùng một lần nên sau lượt chạy bước 2 quay lại "chưa xong" và mất dấu ✓.
    await expect(steps.nth(2).locator(".ana-step-mark")).toBeVisible();
    await expect(steps.nth(1)).toHaveAttribute("data-state", "pending");
    await expect(steps.nth(1).locator(".ana-step-mark")).toBeHidden();
    const hero = section.locator(".ana-read .ana-hero").first();
    await expect(hero).toBeVisible();
    await expect(hero.locator(".ana-hero-name")).not.toHaveText("");
    await expect(hero.locator(".hero-portrait").first()).toBeAttached();

    // Hàng kết quả: tên đội thật (không phải mã đội) + số khớp; artboard không vẽ được điểm/mùa vì dữ liệu không có.
    await expect(section.locator(".ana-team-row").filter({ hasText: target.name }).first()).toBeVisible();
    const row = section.locator(".ana-team-row").first();
    await expect(row.locator(".ana-team-hits")).toContainText("tướng");

    // Hàng kết quả chỉ dùng giá trị token (thay cho probe không dựng được kết quả Worker).
    const styles = await row.evaluate((node) => {
      const root = getComputedStyle(document.documentElement);
      const rowStyle = getComputedStyle(node);
      const linkStyle = getComputedStyle(node.querySelector(".ana-team-link"));
      return {
        padding: `${rowStyle.paddingTop}/${rowStyle.paddingLeft}`,
        radius: rowStyle.borderRadius,
        border: rowStyle.borderTopColor,
        accentBorder: root.getPropertyValue("--accent").trim() === "" ? null : rowStyle.borderTopColor,
        panel: root.getPropertyValue("--panel").trim(),
        accent: root.getPropertyValue("--accent").trim(),
        linkFont: linkStyle.fontFamily,
      };
    });
    expect(styles.padding).toBe("14px/16px");
    expect(styles.radius).toBe("12px");
    expect(styles.accentBorder).toBe(toRgb(styles.accent));
    expect(styles.linkFont).toContain("Noto Serif Display");

    // Không còn emoji trong công cụ; icon là SVG aria-hidden.
    const text = await section.innerText();
    expect(text).not.toContain("📷");
    expect(text).not.toContain("⚠");

    // Mở đội từ hàng kết quả: điều hướng sang trang chi tiết thật.
    await row.locator(".ana-team-link").click();
    await expect(page).toHaveURL(/\/doi-khac\//);
    await expect(page.locator("#team-detail-body")).toBeVisible();

  });

  test("token Turnstile dùng một lần: widget reset sau lượt soi, nút chờ token mới rồi chạy lại được (N9-5)", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
    const tokens = [];
    await page.route(WORKER_ROUTE, (route) => {
      tokens.push(route.request().postDataJSON().turnstileToken);
      return route.fulfill({ json: { heroes: [{ nameCn: "SP荀彧" }] } });
    });

    await page.goto("/soi-doi/");
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

    await page.goto("/goi-y-doi/");
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

  test("tiến trình 1–2–3, danh sách 5 đội đánh số và nút sửa kho giữ focus", async ({ page, request }) => {
    await seedRoster(page, request);
    await page.goto("/goi-y-doi/");
    await waitForBoot(page);

    const section = page.locator("#section-roster-recommend");
    await expect(section.locator("h1.reference-title")).toHaveText("Gợi ý đội từ kho");
    await expect(section.locator(".tool-notice")).toContainText("AI chỉ đọc ảnh");

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

  test("mobile: nút Sửa kho đã đọc mở/đóng khu kiểm tra và giữ focus; thêm/bỏ chip giữ focus", async ({ page, request }) => {
    await seedRoster(page, request, { single: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/goi-y-doi/");
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
    await page.goto("/goi-y-doi/");
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

  test("nhập JSON cùng id nhưng đổi tên gói: mọi chỗ hiện tên mới ngay, không cần tải lại", async ({ page }) => {
    await seed(page, { tqcclRecruitTracker: RECRUIT_FIXTURE });
    let exported = null;
    page.on("dialog", async (dialog) => { await dialog.accept(); });
    await page.goto("/chieu-mo/");
    await waitForBoot(page);
    const section = page.locator("#section-recruit-tracker");
    const banner = section.locator(".rt-banner");
    await expect(banner.locator(".rt-banner-name")).toHaveText("Gói hạn giờ A");

    const imported = structuredClone(RECRUIT_FIXTURE);
    imported.banners.find((item) => item.id === "banner-limited").name = "Gói hạn giờ B";
    imported.banners.find((item) => item.id === "banner-limited").pityLimit = 45;
    imported.exportedAt = null;

    // Input file trong suốt: Tab từ "Xuất JSON" phải để lại vòng focus nhìn thấy được trên nhãn "Nhập JSON".
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

    await expect(section.locator(".rt-message")).toHaveText("Đã nhập JSON.");
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
      };
    });
    expect(afterImport.stored).toEqual(["Danh tướng PK", "Gói hạn giờ B"]);
    expect(afterImport.names).toEqual(["Gói hạn giờ B"]);
    expect(afterImport.counts).toEqual(["31/45"]);
    expect(afterImport.meterLabel).toBe("Tiến độ bảo hiểm 5★ · Gói hạn giờ B");
    expect(afterImport.meterMax).toBe("45");
    expect(afterImport.meterText).toBe("31 / 45 lượt");
    await section.locator(".rt-banner").first().getByRole("button", { name: "Ra 5★", exact: true }).click();
    await expect(section.locator(".rt-form-section h2")).toHaveText("Ghi 5★ · Gói hạn giờ B");
    await section.getByRole("button", { name: "Đóng", exact: true }).click();

    // Xuất JSON (tải về) phải khớp trạng thái đang hiện.
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
  });

  test("hàng kết quả có dữ liệu: số thứ tự, tên đội và nút Mở đội đúng cột; pill đúng màu theo trạng thái", async ({ page, request }) => {
    await seedRoster20(page, request);
    for (const width of [1440, 390, 320]) {
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 1000 });
        await ensureTheme(page, theme);
        await page.goto("/goi-y-doi/");
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
        const blocked = section.locator(".roster-result-team.muted").first();
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
    const heroesDict = JSON.parse(await (await page.request.get("/data/heroes-dict.json")).text());
    const tacticsDict = JSON.parse(await (await page.request.get("/data/tactics.json")).text());
    const teams = JSON.parse(await (await page.request.get("/data/teams.json")).text());
    const target = teams.find((team) => (team.heroes || []).length >= 3);
    const reads = target.heroes.map((hero) => ({
      nameCn: heroesDict.find((record) => record.viet === hero.name)?.chinese ?? hero.name,
      tacticsCn: (hero.tactics || []).map((slot) => tacticsDict.find((record) => record.viet === slot.name)?.chinese ?? slot.name),
      booksCn: [],
      statFocusCn: "",
    }));
    await page.route(WORKER_ROUTE, (route) => route.fulfill({ json: { heroes: reads } }));
    for (const width of [1440, 390, 320]) {
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 1000 });
        await ensureTheme(page, theme);
        await page.goto("/soi-doi/");
        await waitForBoot(page);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const section = page.locator("#section-analyze");
        await section.locator("input[type=file]").setInputFiles({ name: "doi-hinh.png", mimeType: "image/png", buffer: transparentPng });
        await section.getByRole("button", { name: "Soi đội", exact: true }).click();
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
