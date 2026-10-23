// "Đội của tôi" (/doi-cua-toi/) và nút "Lưu vào đội của tôi" ở các trang nguồn. `/api/me`, OAuth và `/api/roster` đi qua
// route intercept như tests-e2e/community.spec.mjs; máy chủ roster giả kiểm bản ghi bằng schema thật của Worker.
// Ma trận hàng 1–15 của plans/261021-0632-dong-bo-kho-va-doi-cua-toi/phase-06-my-teams-ui.md (hàng 15 ở tests-js/astro-dist-contract).
import { test, expect } from "@playwright/test";
import { createRosterServer } from "../tests-js/support/roster-fake-server.mjs";
import { fromRecommended, fromLegacy, fromKhaiHoang } from "../js/my-teams-sources.js";
import { ids, khaiHoangById, legacyById, recommendedById, admittedVariants } from "../tests-js/support/my-teams-fixtures.mjs";
import { ALICE, mockRoster, seedBox, seedTeam } from "./helpers/roster-mock.mjs";

const RECOMMENDED_ID = "s27-han-hanshi-gong-1";
const LEGACY_ID = "team-intro-4";
const LEGACY_VARIANT = admittedVariants.find((row) => row.legacyTeamId === LEGACY_ID && row.legacyVariantId).legacyVariantId;
const KHAI_HOANG_ID = "gia-cat-khac-sp-ma-sieu-phap-chinh";
const PENDING_KEY = "tqccl:my-teams:pending-save";

/** Bảng route {r,l,k} của chính trang build (cùng bảng mà /doi-cua-toi/ nhúng). */
async function routes(request) {
  const html = await (await request.get("/doi-cua-toi/")).text();
  return JSON.parse(html.match(/id="my-teams-routes"[^>]*>([^<]+)<\/script>/)[1].replaceAll("\\u003c", "<"));
}
const recommendedPath = (tables) => `/doi-chuan/${encodeURIComponent(tables.r[RECOMMENDED_ID])}/`;
const legacyPath = (tables) => `/doi-khac/${encodeURIComponent(tables.l[LEGACY_ID])}/`;
const khaiHoangPath = (tables) => `/khai-hoang/${encodeURIComponent(tables.k[KHAI_HOANG_ID])}/`;

const saveButton = (page) => page.locator("#team-detail-actions .mt-save-btn");
const saveDialog = (page) => page.locator("dialog.mt-dialog");
const liveTeams = (server) => server.live("team").map((row) => row.data);

/** Bấm nút lưu của trang nguồn rồi xác nhận hộp thoại (hộp + nhóm mặc định theo nguồn). */
async function saveFromDialog(page) {
  await saveButton(page).click();
  const dialog = saveDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.locator(".mt-toast")).toContainText("Đã lưu");
}

test.describe("1 · khách", () => {
  test("#1 /doi-cua-toi/ chưa đăng nhập: hộp mời đăng nhập, không gọi /api/roster", async ({ page }) => {
    const mock = await mockRoster(page, { signedIn: false });
    await page.goto("/doi-cua-toi/");
    await expect(page.locator("#my-teams .cm-signin")).toBeVisible();
    await expect(page.locator("#my-teams").getByRole("button", { name: "Đăng nhập bằng Google" })).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Đội của tôi");
    await expect.poll(() => mock.calls.some((call) => call.path === "/api/me")).toBe(true);
    expect(mock.calls.filter((call) => call.path === "/api/roster")).toEqual([]);
  });
});

test.describe("2–3 · lưu dở qua OAuth", () => {
  test("#2 lưu từ Đội chuẩn khi chưa đăng nhập → OAuth quay về → đội được lưu đúng một lần", async ({ page, request }) => {
    const tables = await routes(request);
    const mock = await mockRoster(page, { signedIn: false });
    await page.goto(recommendedPath(tables));
    await saveButton(page).click();
    // Khách: nháp (đã có id) được cất rồi đi đăng nhập; mock OAuth quay về chính trang này.
    await expect.poll(() => mock.calls.some((call) => call.path === "/api/auth/sign-in/social")).toBe(true);
    await expect(page.locator(".mt-toast")).toContainText("Đã lưu");
    await expect.poll(() => liveTeams(mock.server).length).toBe(1);
    const [team] = liveTeams(mock.server);
    expect(team.source.kind).toBe("recommended");
    expect(team.groupId).toBe("main~ghep-team");
    expect(await page.evaluate((key) => sessionStorage.getItem(key), PENDING_KEY)).toBeNull();
    // Tải lại: không lưu thêm lần nào.
    await page.reload();
    await page.waitForTimeout(500);
    expect(liveTeams(mock.server)).toHaveLength(1);
  });

  test("#3 như #2 nhưng POST trả 500 rồi tải lại: bản lưu dở còn, toast “Lưu lại”, lưu được ở lần sau", async ({ page, request }) => {
    const tables = await routes(request);
    const mock = await mockRoster(page, { signedIn: false });
    await page.goto(recommendedPath(tables));
    mock.failPosts(50, 500);
    await saveButton(page).click();
    const toast = page.locator(".mt-toast[data-kind='error']");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Lưu lại" })).toBeVisible();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), PENDING_KEY)).not.toBeNull();
    expect(liveTeams(mock.server)).toHaveLength(0);

    // Tải lại khi POST vẫn lỗi: bản lưu dở còn nguyên.
    await page.reload();
    await expect(page.locator(".mt-toast[data-kind='error']")).toBeVisible();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), PENDING_KEY)).not.toBeNull();

    // Hết lỗi: bấm “Lưu lại” trên toast → lưu, bản lưu dở bị xóa.
    mock.failPosts(0);
    await page.locator(".mt-toast[data-kind='error']").getByRole("button", { name: "Lưu lại" }).click();
    await expect(page.locator(".mt-toast[data-kind='success']")).toContainText("Đã lưu");
    expect(liveTeams(mock.server)).toHaveLength(1);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), PENDING_KEY)).toBeNull();
  });
});

test.describe("4–7 · lưu từ trang nguồn", () => {
  test("#4 người dùng chưa từng dùng Gợi ý: hộp main và hai nhóm mặc định có trước khi lưu đội đầu tiên", async ({ page, request }) => {
    const tables = await routes(request);
    const mock = await mockRoster(page);
    expect(mock.server.live("box")).toHaveLength(0);
    await page.goto(recommendedPath(tables));
    await saveFromDialog(page);
    expect(mock.server.live("box").map((row) => row.id)).toEqual(["main"]);
    expect(mock.server.live("group").map((row) => row.id).sort()).toEqual(["main~ghep-team", "main~khai-hoang"]);
    // Trong cùng request, hộp và nhóm đứng trước đội.
    const kinds = mock.posts().flatMap((call) => call.body.records.map((record) => record.kind));
    expect(kinds.indexOf("team")).toBeGreaterThan(kinds.lastIndexOf("group"));
    expect(kinds.indexOf("box")).toBeLessThan(kinds.indexOf("group"));
  });

  test("#5 lưu từ Đội chuẩn, Đội khác và Khai hoang khi đã đăng nhập: đúng nhóm, dữ liệu khớp nguồn", async ({ page, request }) => {
    const tables = await routes(request);
    const mock = await mockRoster(page);
    await page.goto(recommendedPath(tables));
    await saveFromDialog(page);
    await page.goto(legacyPath(tables));
    await saveFromDialog(page);
    await page.goto(khaiHoangPath(tables));
    await saveFromDialog(page);
    const byKind = Object.fromEntries(liveTeams(mock.server).map((team) => [team.source.kind, team]));
    expect(Object.keys(byKind).sort()).toEqual(["khaihoang", "legacy", "recommended"]);
    expect(byKind.recommended.groupId).toBe("main~ghep-team");
    expect(byKind.legacy.groupId).toBe("main~ghep-team");
    expect(byKind.khaihoang.groupId).toBe("main~khai-hoang");
    // Dữ liệu khớp bộ chuyển nguồn (id nháp do trình duyệt sinh nên so phần còn lại).
    const { id: _a, ...recommended } = byKind.recommended;
    const expectedRecommended = fromRecommended(recommendedById(RECOMMENDED_ID), ids, { id: "x" }).draft;
    expect(recommended.heroes).toEqual(expectedRecommended.heroes);
    expect(recommended.source).toEqual(expectedRecommended.source);
    expect(byKind.legacy.heroes).toEqual(fromLegacy(legacyById(LEGACY_ID), ids, { legacyTeamId: LEGACY_ID, id: "x" }).draft.heroes);
    expect(byKind.khaihoang.heroes).toEqual(fromKhaiHoang(khaiHoangById(KHAI_HOANG_ID), null, ids, { id: "x" }).draft.heroes);
  });

  test("#6 /doi-khac/<x>/?variant=v → Lưu: đội của biến thể, key x~v", async ({ page, request }) => {
    const tables = await routes(request);
    const mock = await mockRoster(page);
    await page.goto(`${legacyPath(tables)}?variant=${LEGACY_VARIANT}`);
    await expect(page.locator("#team-detail-body")).toBeVisible();
    await saveFromDialog(page);
    const [team] = liveTeams(mock.server);
    expect(team.source).toMatchObject({ kind: "legacy", key: `${LEGACY_ID}~${LEGACY_VARIANT}` });
    const variant = admittedVariants.find((row) => row.legacyTeamId === LEGACY_ID && row.legacyVariantId === LEGACY_VARIANT);
    const expected = fromLegacy({ ...variant.legacyContent, notes: legacyById(LEGACY_ID).notes }, ids, { legacyTeamId: LEGACY_ID, legacyVariantId: LEGACY_VARIANT, id: "x" }).draft;
    expect(team.heroes).toEqual(expected.heroes);
    // Hash chép từ chỉ mục build, nên khớp chỉ mục.
    const index = await (await request.get("/my-teams-source-index.json")).json();
    expect(team.source.contentHash).toBe(index[`legacy:${LEGACY_ID}~${LEGACY_VARIANT}`]);
  });

  test("#7 Khai hoang đổi chip biến thể rồi Lưu: đội của biến thể đang hiện", async ({ page, request }) => {
    const tables = await routes(request);
    const mock = await mockRoster(page);
    const variant = khaiHoangById(KHAI_HOANG_ID).variants[0];
    await page.goto(khaiHoangPath(tables));
    await page.locator(`[data-variant="${variant.id}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`variant=${variant.id}`));
    await saveFromDialog(page);
    const [team] = liveTeams(mock.server);
    expect(team.source.key).toBe(`${KHAI_HOANG_ID}~${variant.id}`);
    expect(team.heroes).toEqual(fromKhaiHoang(khaiHoangById(KHAI_HOANG_ID), variant, ids, { id: "x" }).draft.heroes);
  });
});

/* ---------- Gợi ý đội và Soi đội ---------- */

const seedLocal = (page, entries) =>
  page.addInitScript((rows) => {
    for (const [key, value] of Object.entries(rows)) if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
  }, entries);

test.describe("5 · Gợi ý đội và Soi đội", () => {
  test("#5 Gợi ý đội: nút lưu trên thẻ kết quả, đội khớp lựa chọn đang hiện", async ({ page, request }) => {
    const mock = await mockRoster(page, { signedIn: false });
    const teams = await (await request.get("/data/teams.json")).json();
    const source = teams.slice(0, 20);
    await seedLocal(page, {
      "tqccl.rosterRecommend.scanState.v1": {
        ownedHeroes: [...new Set(source.flatMap((team) => team.heroes.map((hero) => hero.name || hero.baseName)))].map((name) => ({ name })),
        ownedTactics: [...new Set(source.flatMap((team) => team.heroes.flatMap((hero) => (hero.tactics || []).map((tactic) => tactic.name))))].map((name) => ({ name })),
        lockedTeams: [],
        confirmed: false,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    });
    await page.goto("/goi-y-doi-tu-kho/");
    const section = page.locator("#section-roster-recommend");
    await section.getByRole("button", { name: "Xác nhận dữ liệu đã đọc" }).click();
    await section.getByRole("button", { name: "Gợi ý 5 đội", exact: true }).click();
    const row = section.locator(".roster-result-team").first();
    const name = await row.locator(".roster-result-name").innerText();
    // Khách bấm lưu → đăng nhập (mock) → quay về chính trang → tự lưu đúng một lần.
    await row.getByRole("button", { name: "Lưu vào đội của tôi" }).click();
    await expect(page.locator(".mt-toast[data-kind='success']")).toContainText("Đã lưu");
    await expect.poll(() => liveTeams(mock.server).length).toBe(1);
    const [team] = liveTeams(mock.server);
    expect(["recommended", "legacy"]).toContain(team.source.kind);
    expect(team.name).toBeTruthy();
    expect(name).toContain(team.name.split(" ")[0]);
    expect(team.heroes.length).toBeGreaterThan(0);
  });

  test("#5 Soi đội: nút lưu sau khi đội đã xác nhận (đội analyze, không hash, không link nguồn)", async ({ page }) => {
    const mock = await mockRoster(page);
    const { encodeTeamParam } = await import("../js/analyze-state.js");
    const heroes = ["hero:luu-bi", "hero:quan-vu", "hero:truong-phi"];
    const dict = (await import("../tests-js/support/my-teams-fixtures.mjs"));
    const heroIds = heroes.filter((id) => dict.heroesDict.some((row) => row.id === id));
    expect(heroIds).toHaveLength(3);
    const tactic = dict.tacticsDict.find((row) => row.source !== "INNATE").id;
    const { bookRowId } = await import("../js/lookup-ids.js");
    const book = dict.booksDict.map(bookRowId).find(Boolean);
    const doi = encodeTeamParam({ heroes: heroIds.map((hero) => ({ hero, tactics: [tactic, tactic], book })) });
    await page.goto(`/soi-doi-tu-anh/?doi=${encodeURIComponent(doi)}`);
    const compare = page.locator("#section-analyze .ana-compare");
    await expect(compare).toBeVisible();
    await compare.getByRole("button", { name: "Lưu vào đội của tôi" }).click();
    await saveDialog(page).getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.locator(".mt-toast[data-kind='success']")).toContainText("Đã lưu");
    const [team] = liveTeams(mock.server);
    expect(team.source.kind).toBe("analyze");
    expect(team.source.contentHash).toBe("");
    expect(team.heroes.map((hero) => hero.hero)).toEqual(heroIds);
    expect(team.groupId).toBe("main~ghep-team");
  });
});

/* ---------- Trang /doi-cua-toi/ ---------- */

import { heroesDict } from "../tests-js/support/my-teams-fixtures.mjs";

const NOW = () => Date.now();
const recommendedDraft = (id, configId = RECOMMENDED_ID, options = {}) => fromRecommended(recommendedById(configId), ids, { id, ...options }).draft;
const card = (page, id) => page.locator(`.mt-team[data-team-id="${id}"]`);
const heroName = (id) => heroesDict.find((row) => row.id === id).viet;

/** Máy chủ giả có hộp main + một đội đã lưu; trả `{mock}` đã mở `/doi-cua-toi/`. */
async function openWithTeams(page, teams, { path = "/doi-cua-toi/", mockOptions = {}, boxes = ["main"] } = {}) {
  const server = await createRosterServer({ userId: ALICE.id });
  for (const boxId of boxes) await seedBox(server, boxId);
  for (const entry of teams) await seedTeam(server, entry.draft, entry.options);
  const mock = await mockRoster(page, { server, ...mockOptions });
  await page.goto(path);
  return mock;
}

test.describe("8–9 · soạn đội", () => {
  test("#8 sửa đội (tên, chiến pháp chọn bằng bảng chọn editor, ghi chú) rồi tải lại: thay đổi còn", async ({ page }) => {
    const draft = recommendedDraft("team-edit-1");
    await openWithTeams(page, [{ draft }]);
    await expect(card(page, "team-edit-1")).toBeVisible();
    await card(page, "team-edit-1").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    await expect(form).toBeVisible();

    // Bộ đếm byte cùng cách đếm với server: chữ Hán 3 B mỗi ký tự.
    const name = form.getByLabel("Tên đội");
    await name.fill("Đội 曹操");
    await expect(name.locator("xpath=following-sibling::span[contains(@class,'mt-bytes')]")).toHaveText(`${new TextEncoder().encode("Đội 曹操").length} / 180 B`);
    await form.getByLabel("Ghi chú chung").fill("Ghi chú đã sửa");

    // Chọn chiến pháp cho ô 1 của tướng 1 bằng bảng chọn policy editor (có cả chiến pháp tự mang).
    const hero = form.locator(".mt-edit-hero").first();
    await hero.locator(".mt-slot").nth(1).getByRole("button", { name: /Đổi|Chọn/ }).click();
    const picker = page.locator("dialog.mt-picker-dialog");
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("radio")).toHaveCount(0);
    await picker.getByLabel("Tìm trong danh mục").fill("Nhân Đức");
    await picker.locator(".roster-picker-item").first().click();
    await expect(picker).toBeHidden();

    await form.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.locator("form.mt-editor")).toHaveCount(0);
    await expect(card(page, "team-edit-1").locator(".mt-team-name")).toHaveText("Đội 曹操");

    await page.reload();
    await expect(card(page, "team-edit-1").locator(".mt-team-name")).toHaveText("Đội 曹操");
    await expect(card(page, "team-edit-1")).toContainText("Ghi chú đã sửa");
    await expect(card(page, "team-edit-1")).toContainText("Nhân Đức");
  });

  test("#8 lưu lỗi: role=alert nêu lý do, nội dung giữ nguyên, nút đổi thành “Lưu lại” và lưu được lần sau", async ({ page }) => {
    const draft = recommendedDraft("team-edit-2");
    const mock = await openWithTeams(page, [{ draft }]);
    await card(page, "team-edit-2").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    // Vượt trần: bị chặn trước khi gọi mạng, nêu đúng trường.
    await form.getByLabel("Tên đội").fill("x".repeat(181));
    await form.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Tên đội");
    await expect(form.getByLabel("Tên đội")).toHaveValue("x".repeat(181));
    // Mạng lỗi: nội dung còn, nút “Lưu lại”.
    await form.getByLabel("Tên đội").fill("Tên mới");
    mock.failPosts(20, 500);
    await form.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Chưa lưu được");
    await expect(form.getByLabel("Tên đội")).toHaveValue("Tên mới");
    mock.failPosts(0);
    await form.getByRole("button", { name: "Lưu lại", exact: true }).click();
    await expect(page.locator("form.mt-editor")).toHaveCount(0);
    expect(mock.server.live("team")[0].data.name).toBe("Tên mới");
  });

  test("#9 conflict: role=alert, hiện cả bản server lẫn bản đang soạn, nội dung soạn giữ nguyên; giữ bản của tôi thì lưu được", async ({ page }) => {
    const draft = recommendedDraft("team-conflict");
    const mock = await openWithTeams(page, [{ draft }]);
    await card(page, "team-conflict").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    await form.getByLabel("Tên đội").fill("Bản của tôi");
    // Máy khác ghi bản mới hơn trong lúc đang soạn.
    await seedTeam(mock.server, { ...draft, name: "Bản máy khác" }, { at: NOW() + 120_000 });
    await form.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(form.getByRole("alert").first()).toContainText("vừa được sửa ở nơi khác");
    const conflict = form.locator("[data-conflict]");
    await expect(conflict.getByRole("region", { name: "Bản trên máy chủ" })).toContainText("Bản máy khác");
    await expect(conflict.getByRole("region", { name: "Bản đang soạn" })).toContainText("Bản của tôi");
    await expect(form.getByLabel("Tên đội")).toHaveValue("Bản của tôi");

    await conflict.getByRole("button", { name: "Giữ bản của tôi" }).click();
    await expect(page.locator("form.mt-editor")).toHaveCount(0);
    expect(mock.server.live("team")[0].data.name).toBe("Bản của tôi");
  });

  test("#9 conflict: giữ bản trên máy chủ thì bỏ bản soạn", async ({ page }) => {
    const draft = recommendedDraft("team-conflict-2");
    const mock = await openWithTeams(page, [{ draft }]);
    await card(page, "team-conflict-2").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    await form.getByLabel("Tên đội").fill("Bản của tôi");
    await seedTeam(mock.server, { ...draft, name: "Bản máy khác" }, { at: NOW() + 120_000 });
    await form.getByRole("button", { name: "Lưu", exact: true }).click();
    await form.locator("[data-conflict]").getByRole("button", { name: "Giữ bản trên máy chủ" }).click();
    await expect(card(page, "team-conflict-2").locator(".mt-team-name")).toHaveText("Bản máy khác");
  });
});

test.describe("9b · hộp mới", () => {
  test("#9b lưu đội vào hộp mới tạo: hai nhóm mặc định của hộp đó có trước khi lưu (cùng request tạo hộp)", async ({ page, request }) => {
    const tables = await routes(request);
    const mock = await openWithTeams(page, []);
    await page.getByRole("button", { name: "Tạo hộp", exact: true }).click();
    await page.locator("#mt-prompt-input").fill("Hộp thử");
    await page.locator("dialog.mt-dialog").getByRole("button", { name: "Tạo hộp", exact: true }).click();
    await expect(page.locator("#mt-box")).toHaveValue(/^box-/u);
    const boxId = await page.locator("#mt-box").inputValue();
    expect(mock.server.live("group").filter((row) => row.boxId === boxId).map((row) => row.id).sort()).toEqual([`${boxId}~ghep-team`, `${boxId}~khai-hoang`]);
    // Hộp và hai nhóm đi cùng một request.
    const create = mock.posts().find((call) => call.body.records.some((record) => record.kind === "box" && record.id === boxId));
    expect(create.body.records.filter((record) => record.kind === "group").map((record) => record.id).sort()).toEqual([`${boxId}~ghep-team`, `${boxId}~khai-hoang`]);

    await page.goto(recommendedPath(tables));
    await saveButton(page).click();
    const dialog = saveDialog(page);
    await dialog.getByLabel("Hộp").selectOption(boxId);
    await expect(dialog.getByLabel("Nhóm")).toHaveValue(`${boxId}~ghep-team`);
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.locator(".mt-toast")).toContainText("Đã lưu");
    const [team] = liveTeams(mock.server);
    expect([team.boxId, team.groupId]).toEqual([boxId, `${boxId}~ghep-team`]);
  });
});

test.describe("9c · link nguồn", () => {
  for (const locale of ["vi", "zh"]) {
    test(`#9c link nguồn mở đúng trang và đúng biến thể (${locale})`, async ({ page, request }) => {
      const tables = await routes(request);
      const prefix = locale === "zh" ? "/zh" : "";
      const hanId = recommendedRecordsWithHan();
      const variant = khaiHoangById(KHAI_HOANG_ID).variants[0];
      const teams = [
        { draft: recommendedDraft("team-link-r") },
        { draft: recommendedDraft("team-link-han", hanId) },
        { draft: fromLegacy({ ...admittedVariants.find((row) => row.legacyTeamId === LEGACY_ID && row.legacyVariantId === LEGACY_VARIANT).legacyContent, notes: legacyById(LEGACY_ID).notes }, ids, { legacyTeamId: LEGACY_ID, legacyVariantId: LEGACY_VARIANT, id: "team-link-l" }).draft },
        { draft: fromKhaiHoang(khaiHoangById(KHAI_HOANG_ID), variant, ids, { id: "team-link-k" }).draft, options: { groupId: "main~khai-hoang" } },
      ];
      await openWithTeams(page, teams, { path: `${prefix}/doi-cua-toi/` });
      const href = (id) => card(page, id).locator(".mt-source-link").getAttribute("href");
      expect(await href("team-link-r")).toBe(`${prefix}/doi-chuan/${tables.r[RECOMMENDED_ID]}/`);
      expect(await href("team-link-han")).toBe(`${prefix}/doi-chuan/${encodeURIComponent(tables.r[hanId])}/`);
      expect(await href("team-link-l")).toBe(`${prefix}/doi-khac/${tables.l[LEGACY_ID]}/?variant=${LEGACY_VARIANT}`);
      expect(await href("team-link-k")).toBe(`${prefix}/khai-hoang/${tables.k[KHAI_HOANG_ID]}/?variant=${variant.id}`);

      await card(page, "team-link-k").locator(".mt-source-link").click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/khai-hoang/${tables.k[KHAI_HOANG_ID]}/\\?variant=${variant.id}$`));
      await expect(page.locator(`[data-variant="${variant.id}"][aria-pressed="true"]`).first()).toBeVisible();
    });
  }
});

import { recommendedRecords } from "../tests-js/support/my-teams-fixtures.mjs";
const recommendedRecordsWithHan = () => recommendedRecords.map((row) => row.sourceConfigId).find((id) => /[^\x00-\x7f]/u.test(id));

test.describe("10–13 · cảnh báo, nhãn, dữ liệu hỏng", () => {
  test("#10 hai đội trùng tướng: cảnh báo hiện; đánh dấu thay thế thì không", async ({ page }) => {
    const a = recommendedDraft("team-dup-a");
    const b = { ...recommendedDraft("team-dup-b"), name: "Bản sao" };
    const mock = await openWithTeams(page, [{ draft: a }, { draft: b }]);
    await expect(page.locator(".mt-dups")).toContainText("trùng tướng hoặc chiến pháp chính");
    await expect(card(page, "team-dup-a").locator(".mt-badge-dup")).toBeVisible();
    // Đánh dấu "Thay thế cho đội" trong trình soạn → hết cảnh báo.
    await card(page, "team-dup-b").getByRole("button", { name: "Sửa", exact: true }).click();
    const form = page.locator("form.mt-editor");
    await form.getByLabel("Thay thế cho đội").selectOption("team-dup-a");
    await form.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.locator("form.mt-editor")).toHaveCount(0);
    await expect(page.locator(".mt-dups")).toHaveCount(0);
    await expect(card(page, "team-dup-a").locator(".mt-badge-dup")).toHaveCount(0);
    expect(mock.server.live("team").find((row) => row.id === "team-dup-b").data.replacesTeamId).toBe("team-dup-a");
  });

  test("#11 món không có trong kho của hộp: nhãn “chưa có trong kho”", async ({ page }) => {
    const draft = recommendedDraft("team-missing");
    const owned = draft.heroes.map((hero) => hero.hero).filter(Boolean);
    const server = await createRosterServer({ userId: ALICE.id });
    await seedBox(server);
    await seedTeam(server, draft);
    // Kho của hộp chỉ có tướng đầu tiên.
    const seededAt = NOW() - 60_000; // một lần đọc đồng hồ: updatedAt và data.updatedAt phải trùng ms (schema)
    await server.seed({
      kind: "owned",
      id: `main~${owned[0]}`,
      updatedAt: seededAt,
      deleted: false,
      data: { id: `main~${owned[0]}`, boxId: "main", item: owned[0], name: heroName(owned[0]), type: "hero", updatedAt: new Date(seededAt).toISOString(), deletedAt: "" },
    });
    await mockRoster(page, { server });
    await page.goto("/doi-cua-toi/");
    const rows = card(page, "team-missing").locator("tbody tr");
    await expect(rows.first().locator("td").first().locator(".mt-badge-missing")).toHaveCount(0);
    await expect(rows.nth(1).locator("td").first().locator(".mt-badge-missing")).toHaveText("chưa có trong kho");
    expect(await card(page, "team-missing").locator(".mt-badge-missing").count()).toBeGreaterThan(owned.length - 1);
  });

  test("#12 contentHash khác chỉ mục: “Bản gốc đã cập nhật” + link nguồn đúng; hash khớp thì không có nhãn", async ({ page, request }) => {
    const tables = await routes(request);
    const stale = recommendedDraft("team-stale");
    const index = await (await request.get("/my-teams-source-index.json")).json();
    const sameKey = `recommended:${stale.source.key}`;
    expect(index[sameKey]).toBe(stale.source.contentHash);
    const old = { ...stale, source: { ...stale.source, contentHash: "0123456789abcdef" } };
    const fresh = recommendedDraft("team-fresh", "s27-han-hanshi-gong-1");
    await openWithTeams(page, [{ draft: old }, { draft: fresh }]);
    await expect(card(page, "team-stale").locator(".mt-badge-updated")).toHaveText("Bản gốc đã cập nhật");
    await expect(card(page, "team-stale").locator(".mt-source-link")).toHaveAttribute("href", `/doi-chuan/${tables.r[RECOMMENDED_ID]}/`);
    // Đội "mới" cùng nguồn, hash khớp: không nhãn. (Cùng id nguồn nên dùng đội thứ hai có hash khớp.)
    await expect(card(page, "team-fresh").locator(".mt-badge-updated")).toHaveCount(0);
  });

  test("#13 bản ghi đội hỏng từ server: bị bỏ qua kèm thông báo, các đội khác vẫn hiện", async ({ page }) => {
    const server = await createRosterServer({ userId: ALICE.id });
    await seedBox(server);
    await seedTeam(server, recommendedDraft("team-good"));
    server.rows.set("team:team-bad", { kind: "team", id: "team-bad", boxId: "main", updatedAt: NOW() - 1000, rev: server.rev + 1, deleted: false, data: { id: "team-bad", boxId: "main", groupId: "main~ghep-team", heroes: "không phải mảng" } });
    await mockRoster(page, { server });
    await page.goto("/doi-cua-toi/");
    await expect(card(page, "team-good")).toBeVisible();
    await expect(page.locator(".mt-team")).toHaveCount(1);
    await expect(page.locator("[data-skipped]")).toContainText("1 bản ghi đội bị hỏng");
  });
});

test.describe("quản lý hộp, nhóm, đội", () => {
  test("nhóm: thêm, đổi tên, chuyển đội, xóa nhóm (xác nhận nêu số đội, đội về Ghép Team); nhóm mặc định và hộp main không xóa được", async ({ page }) => {
    const mock = await openWithTeams(page, [{ draft: recommendedDraft("team-grp") }]);
    await expect(page.locator('[data-group-id="main~ghep-team"]').getByRole("button", { name: /Xóa nhóm|Đổi tên/ })).toHaveCount(0);
    await expect(page.locator('[data-group-id="main~khai-hoang"]').getByRole("button", { name: /Xóa nhóm|Đổi tên/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Xóa hộp" })).toHaveCount(0);

    await page.getByLabel("Thêm nhóm").fill("Công thành");
    await page.getByRole("button", { name: "Thêm nhóm", exact: true }).click();
    const group = page.locator('.mt-group[aria-label="Công thành"]');
    await expect(group).toBeVisible();
    const groupId = await group.getAttribute("data-group-id");
    expect(groupId).toMatch(/^grp-/u);

    await group.getByRole("button", { name: "Đổi tên" }).click();
    await page.locator("#mt-prompt-input").fill("Công thành 2");
    await page.locator("dialog.mt-dialog").getByRole("button", { name: "Lưu tên" }).click();
    await expect(page.locator(`[data-group-id="${groupId}"] .mt-group-name`)).toContainText("Công thành 2");

    await card(page, "team-grp").getByLabel(/Chuyển nhóm/).selectOption(groupId);
    await expect(page.locator(`[data-group-id="${groupId}"] .mt-team`)).toHaveCount(1);
    expect(mock.server.live("team")[0].data.groupId).toBe(groupId);

    await page.locator(`[data-group-id="${groupId}"]`).getByRole("button", { name: "Xóa nhóm" }).click();
    const dialog = page.locator("dialog.mt-dialog");
    await expect(dialog).toContainText("1 đội trong nhóm sẽ chuyển về Ghép Team");
    await dialog.getByRole("button", { name: "Xóa nhóm" }).click();
    await expect(page.locator(`[data-group-id="${groupId}"]`)).toHaveCount(0);
    await expect(page.locator('[data-group-id="main~ghep-team"] .mt-team')).toHaveCount(1);
    expect(mock.server.live("team")[0].data.groupId).toBe("main~ghep-team");
  });

  test("hộp: đổi tên, xóa có xác nhận nêu số đội sẽ mất; xóa đội có xác nhận", async ({ page }) => {
    const mock = await openWithTeams(page, [{ draft: recommendedDraft("team-boxed"), options: { boxId: "box-phu", groupId: "box-phu~ghep-team" } }, { draft: recommendedDraft("team-main", "s27-han-hanshi-gong-1") }], { boxes: ["main", "box-phu"] });
    await page.locator("#mt-box").selectOption("box-phu");
    await page.getByRole("button", { name: "Đổi tên hộp" }).click();
    await page.locator("#mt-prompt-input").fill("Hộp B");
    await page.locator("dialog.mt-dialog").getByRole("button", { name: "Lưu tên" }).click();
    await expect(page.locator("#mt-box option:checked")).toHaveText("Hộp B");

    // Xóa đội: hủy thì còn, xác nhận thì mất.
    await card(page, "team-boxed").getByRole("button", { name: "Xóa", exact: true }).click();
    await page.locator("dialog.mt-dialog").getByRole("button", { name: "Hủy" }).click();
    await expect(card(page, "team-boxed")).toBeVisible();

    await page.getByRole("button", { name: "Xóa hộp" }).click();
    const dialog = page.locator("dialog.mt-dialog");
    await expect(dialog).toContainText("mất 1 đội");
    await dialog.getByRole("button", { name: "Xóa hộp" }).click();
    await expect(page.locator("#mt-box")).toHaveValue("main");
    await expect(page.locator("#mt-box option")).toHaveCount(1);
    expect(mock.server.live("box").map((row) => row.id)).toEqual(["main"]);
    expect(mock.server.live("team").map((row) => row.id)).toEqual(["team-main"]);
  });
});

test.describe("14 · zh + mobile", () => {
  test("#14 /zh/doi-cua-toi/ ở 390px: nhãn tiếng Trung, không tràn ngang, bảng thành thẻ xếp dọc", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTeams(page, [{ draft: recommendedDraft("team-zh") }], { path: "/zh/doi-cua-toi/" });
    await expect(page.locator("h1")).toHaveText("我的阵容");
    await expect(card(page, "team-zh").getByRole("button", { name: "编辑", exact: true })).toBeVisible();
    await expect(card(page, "team-zh").locator(".mt-source-link")).toHaveText("查看原版");
    await expect(page.getByRole("button", { name: "新建仓库" })).toBeVisible();
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    // Bảng đội xếp dọc: ô đầu của hàng chiếm trọn bề rộng thẻ.
    const cell = card(page, "team-zh").locator("tbody td").first();
    const [cellBox, cardBox] = await Promise.all([cell.boundingBox(), card(page, "team-zh").boundingBox()]);
    expect(cellBox.width).toBeGreaterThan(cardBox.width * 0.8);
    // Trình soạn cũng không tràn ngang.
    await card(page, "team-zh").getByRole("button", { name: "编辑", exact: true }).click();
    await expect(page.locator("form.mt-editor")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    // Hộp thoại chọn món ở 390px.
    await page.locator(".mt-edit-hero").first().locator(".mt-slot").first().getByRole("button").first().click();
    await expect(page.locator("dialog.mt-picker-dialog")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test("#14 trang nguồn zh: nút lưu bằng tiếng Trung, hộp thoại lưu không tràn ở 390px", async ({ page, request }) => {
    const tables = await routes(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await mockRoster(page);
    await page.goto(`/zh${recommendedPath(tables)}`);
    const button = saveButton(page);
    await expect(button).toHaveText("保存到我的阵容");
    await button.click();
    await expect(saveDialog(page)).toBeVisible();
    await expect(saveDialog(page).getByRole("button", { name: "保存", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
