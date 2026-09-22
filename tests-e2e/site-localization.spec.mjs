import { expect, test } from "@playwright/test";

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/u;
/** Detail routes come from the frozen inventory the build embedded, never from a re-derived slug. */
const routeHandles = async (request) => {
  const html = await (await request.get("/index.html")).text();
  const match = html.match(/id="team-route-handles"[^>]*>([^<]+)<\/script>/);
  if (!match) throw new Error("Built HTML lacks the team route handle map");
  return JSON.parse(match[1]);
};
const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+4gZ8WQAAAABJRU5ErkJggg==",
  "base64",
);

test("localization-red-note: Recommended detail renders reviewed Vietnamese notes", async ({ page, request }) => {
  const pin = await (await request.get("/data/recommended/current.json")).json();
  const index = await (await request.get(`/data/recommended/${pin.generationId}/index.json`)).json();
  const row = index.records.find((item) => item.displayNotes?.blocks?.some((block) => HAN.test(block.textRaw || "")));
  expect(row).toBeTruthy();

  const handles = await routeHandles(request);
  await page.goto(`/doi-chuan/${encodeURIComponent(handles.r[row.sourceConfigId])}/`);
  const notes = page.locator("#team-detail-body .detail-note");
  await expect(notes.first()).toBeVisible();
  const visible = (await notes.allTextContents()).join("\n");
  expect(visible).not.toMatch(HAN);
  await expect(page.locator("#team-detail-body .season-raw")).toHaveCount(0);
});

test("legacy detail renders its exact approved note instead of raw Han text", async ({ page, request }) => {
  const teams = await (await request.get("/data/teams.json")).json();
  const display = await (await request.get("/data/website-display.json")).json();
  const index = 160;
  const team = teams[index];
  const key = JSON.stringify([`data:data/teams.json:[${index}]`, `[${index}].notes`]);
  const approved = display.values[key];
  expect(approved).toBeTruthy();
  expect(approved).not.toMatch(HAN);
  expect(team.notes).toMatch(HAN);

  await page.goto(`/doi-khac/${encodeURIComponent((await routeHandles(request)).l[team.id])}/`);
  const body = page.locator("#team-detail-body");
  await expect(body).toContainText(approved);
  await expect(body).not.toContainText(team.notes);
});

test("localization-red-provider-error: Analyze does not expose upstream prose", async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", (route) => route.fulfill({
    contentType: "text/javascript",
    body: "window.turnstile={render:(_el,options)=>options.callback('test-token'),reset:()=>{}};",
  }));
  await page.route("https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/analyze", (route) => route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ error: "服务器内部错误" }),
  }));

  await page.goto("/#analyze");
  await page.locator("#section-analyze input[type=file]").setInputFiles({
    name: "team.png",
    mimeType: "image/png",
    buffer: transparentPng,
  });
  const button = page.getByRole("button", { name: "Soi đội", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  const status = page.locator("#section-analyze .ana-status.err");
  await expect(status).toBeVisible();
  await expect(status).not.toContainText("服务器内部错误");
  await expect(status).toHaveText("Không thể phân tích ảnh. Vui lòng thử lại.");
});
