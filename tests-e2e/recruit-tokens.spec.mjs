// Token API cá nhân trên Theo dõi chiêu mộ: tạo (token thô hiện đúng một lần), liệt kê, thu hồi hai bước, lỗi trần
// `token_limit`; đóng hộp thoại hoặc đăng xuất không để token thô lại trong DOM. `/api/*` giả lập theo hợp đồng của
// `docs/community-worker.md` (không cần community-worker thật).
import { expect, test } from "@playwright/test";

const USER = { id: "u-alice", name: "Alice", role: "user" };
const RAW_TOKEN = "tqk_e2e_raw_token_value";

/** Server token giả trong bộ nhớ: đủ để kiểm luồng UI, không mô phỏng băm hay rate limit. */
async function mockCommunity(page, { tokenLimitAfter = Infinity } = {}) {
  const tokens = [];
  const session = { user: USER };
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: session.user } }));
  await page.route("**/api/recruit?**", (route) => route.fulfill({ json: { records: [], cursor: 0, more: false } }));
  await page.route("**/api/recruit", (route) => route.fulfill({ json: { cursor: 0, accepted: 0 } }));
  await page.route("**/api/tokens**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path === "/api/tokens") {
      return route.fulfill({ json: { items: [...tokens].reverse() } });
    }
    if (request.method() === "POST" && path === "/api/tokens") {
      if (tokens.filter((item) => item.revokedAt === null).length >= tokenLimitAfter) {
        return route.fulfill({ status: 409, json: { error: { code: "token_limit", message: "token limit" } } });
      }
      const body = request.postDataJSON();
      const now = Date.now();
      const item = {
        id: `t-${tokens.length + 1}`,
        name: body.name,
        hint: "alue",
        scope: "recruit:pulls",
        createdAt: now,
        lastUsedAt: null,
        expiresAt: body.expiresInDays === null ? null : now + body.expiresInDays * 86_400_000,
        revokedAt: null,
      };
      tokens.push(item);
      return route.fulfill({ status: 201, json: { token: RAW_TOKEN, item } });
    }
    const match = path.match(/^\/api\/tokens\/([^/]+)$/);
    if (request.method() === "DELETE" && match) {
      const item = tokens.find((entry) => entry.id === decodeURIComponent(match[1]));
      if (!item) return route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
      item.revokedAt ??= Date.now();
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 405, json: { error: { code: "method_not_allowed", message: "" } } });
  });
  await page.addInitScript(() => localStorage.setItem("tqccl:community-session", "1"));
  return { tokens, session };
}

const dialog = (page) => page.locator("dialog.rt-dialog");

/** Mở menu ⋯ của tài khoản tracker rồi chọn mục token (mục chỉ hiện khi phiên đã xác nhận, nên thử lại tới khi có). */
async function chooseTokenMenuItem(page) {
  const toggle = page.locator(".rt-account-toggle");
  const item = page.getByRole("button", { name: "Token API cho công cụ", exact: true });
  await expect(async () => {
    if (!(await item.isVisible())) await toggle.click();
    await expect(item).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await item.click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("heading", { name: "Token API" })).toBeVisible();
}

async function openTokenDialog(page) {
  await page.goto("/theo-doi-chieu-mo/");
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
  await chooseTokenMenuItem(page);
}

test("tạo token: token thô hiện một lần, danh sách có token mới; thu hồi cần bấm hai lần", async ({ page }) => {
  const { tokens } = await mockCommunity(page);
  await openTokenDialog(page);
  await expect(dialog(page).getByText("Chưa có token nào.")).toBeVisible();

  await dialog(page).getByLabel("Tên").fill("tqkh-e2e");
  await dialog(page).getByLabel("Hạn dùng").selectOption("30");
  await dialog(page).getByRole("button", { name: "Tạo token" }).click();
  const secret = dialog(page).locator("#rt-token-secret");
  await expect(secret).toHaveValue(RAW_TOKEN);
  await expect(secret).toBeFocused();
  await expect(dialog(page).getByRole("status")).toHaveText("Đã tạo token.");
  const row = dialog(page).locator(".rt-token-item", { hasText: "tqkh-e2e" });
  await expect(row).toHaveAttribute("data-status", "active");
  await expect(row).toContainText("…alue");
  await expect(row).toContainText("Chưa dùng");
  expect(tokens).toHaveLength(1);
  expect(tokens[0].expiresAt - tokens[0].createdAt).toBe(30 * 86_400_000);

  // Thu hồi hai bước: lần đầu chỉ đổi nhãn, chưa gọi API.
  const revoke = row.getByRole("button", { name: "Thu hồi token tqkh-e2e" });
  await revoke.click();
  await expect(revoke).toHaveText("Xác nhận thu hồi");
  expect(tokens[0].revokedAt).toBeNull();
  await revoke.click();
  await expect(dialog(page).getByRole("status")).toHaveText("Đã thu hồi token tqkh-e2e.");
  await expect(row).toHaveAttribute("data-status", "revoked");
  await expect(row.getByRole("button")).toHaveCount(0);
  expect(tokens[0].revokedAt).not.toBeNull();
});

test("đủ 10 token còn hiệu lực: báo lỗi token_limit, không hiện token", async ({ page }) => {
  await mockCommunity(page, { tokenLimitAfter: 0 });
  await openTokenDialog(page);
  await dialog(page).getByRole("button", { name: "Tạo token" }).click();
  await expect(dialog(page).getByRole("status")).toHaveText("Đã đủ 10 token còn hiệu lực. Hãy thu hồi bớt token cũ rồi tạo lại.");
  await expect(dialog(page).locator(".rt-token-reveal")).toBeHidden();
  await expect(dialog(page).locator("#rt-token-secret")).toHaveValue("");
});

test("đóng hộp thoại hoặc đăng xuất: token thô không còn trong DOM", async ({ page }) => {
  const { session } = await mockCommunity(page);
  await openTokenDialog(page);
  await dialog(page).getByRole("button", { name: "Tạo token" }).click();
  await expect(dialog(page).locator("#rt-token-secret")).toHaveValue(RAW_TOKEN);
  await dialog(page).getByRole("button", { name: "Đóng" }).first().click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator("#rt-token-secret")).toHaveCount(0);
  expect(await page.content()).not.toContain(RAW_TOKEN);

  // Mở lại rồi phiên hết hạn (401 khi đồng bộ lại): hộp thoại đóng, token thô biến mất.
  await chooseTokenMenuItem(page);
  await dialog(page).getByRole("button", { name: "Tạo token" }).click();
  await expect(dialog(page).locator("#rt-token-secret")).toHaveValue(RAW_TOKEN);
  session.user = null;
  await page.unroute("**/api/recruit?**");
  await page.route("**/api/recruit?**", (route) => route.fulfill({ status: 401, json: { error: { code: "unauthorized", message: "" } } }));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator("#rt-token-secret")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Token API cho công cụ", exact: true })).toBeHidden();
});
