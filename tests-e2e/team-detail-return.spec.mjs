// Nút "Quay lại" của trang chi tiết đội khi link nội bộ không còn mang `?from=`: đích lấy theo thứ tự history.state → `?from=`
// của link cũ → referrer cùng origin → sessionStorage theo trang → link họ đội dựng sẵn. Mỗi test đi qua đúng một đường vào trang
// chi tiết mà người dùng thật có (click thường, Cmd/Ctrl-click, reload, đổi ngôn ngữ, quay về sau đăng nhập, link cũ, skip-link).
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createEntityIndex, referenceTeam } from "../js/analyze-map.js";
import { encodeTeamParam } from "../js/analyze-state.js";
import { createBookNameIndex } from "../js/lookup-ids.js";

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const { generationId } = read("src/data/recommended-reference/current.json");
const generation = (name) => read(`src/data/recommended-reference/${generationId}/${name}`);
const { records } = generation("index.json");
const seasons = generation("seasons.json");
const khaiHoangTeams = read("data/khaihoang.json").teams;
/** Hai đội Khai hoang có chọn cấu hình: đủ cho hành trình "đang chọn đội A rồi mở đội B". */
const [teamA, teamB] = khaiHoangTeams.filter((team) => (team.variants || []).length);
const variantA = teamA.variants[0].id;
const variantB = teamB.variants[0].id;
const khaiHoangHandles = read("pipeline/team-route-handles.json").handles.khaihoang;
const khaiHoangRoute = (team) => `/khai-hoang/${encodeURIComponent(khaiHoangHandles[team.id])}/`;
const khaiHoangCard = (page, team) => page.locator(".kh-card").filter({
  has: page.locator(`.kh-config-row[aria-label="Chọn cấu hình ${team.title}"]`),
});
const pairOf = (team, variantId = "") => `/khai-hoang/?khTeam=${team.id}${variantId ? `&khVariant=${variantId}` : ""}`;

/** Đội đầu của danh sách: tên tướng chủ làm từ khóa tìm, lọc ra danh sách ngắn có đội đó; mùa của đội nằm trong URL. */
const row = records[0];
const season = row.sourceSeasonId;
const query = row.heroes[0].displayNameVi || row.heroes[0].nameRaw;
const filteredListUrl = `/doi-chuan/?season=${encodeURIComponent(season)}&q=${encodeURIComponent(query)}`;

const waitForBoot = (page) => expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
const teamSection = (page) => page.locator("#section-team-chuan");
const teamCard = (page) => teamSection(page).locator(`.reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
const backLink = (page) => page.locator("#team-return-link");
/** href của nút Quay lại dạng URL để so từng khóa, không phụ thuộc cách mã hóa dấu cách/Unicode của query. */
const returnUrl = async (page) => new URL(await backLink(page).getAttribute("href"), page.url());
/** Quay lại phải về đúng danh sách đã lọc ở bản ngôn ngữ `prefix`: cùng mùa, cùng từ khóa. */
const expectFilteredList = (url, prefix = "") => {
  expect(url.pathname).toBe(`${prefix}/doi-chuan/`);
  expect(url.searchParams.get("season")).toBe(season);
  expect(url.searchParams.get("q")).toBe(query);
};

/** Bảng route handle do build nhúng (`{r, l, k}`), cùng nguồn mà trang chi tiết dùng. */
async function routeHandles(request) {
  const html = await (await request.get("/doi-chuan/")).text();
  const match = html.match(/id="team-route-handles"[^>]*>([^<]+)<\/script>/);
  if (!match) throw new Error("Trang Đội chuẩn thiếu bảng route handle");
  return JSON.parse(match[1]);
}

/**
 * Chờ script trang chi tiết dựng xong đích Quay lại: HTML dựng sẵn đã có link mặc định (không `q`), nên chỉ khi link mang đúng
 * từ khóa của danh sách đã lọc mới biết `resolveDetailReturn` đã chạy.
 */
const settleFilteredReturn = (target) => expect.poll(async () => (await returnUrl(target)).searchParams.get("q")).toBe(query);

/** Từ danh sách Đội chuẩn đã lọc vào trang chi tiết bằng click thường (đã chờ app.js gắn xong để ghi snapshot). */
async function openDetailFromFilteredList(page) {
  await page.goto(filteredListUrl);
  await waitForBoot(page);
  await expect(teamCard(page)).toBeVisible();
  await teamCard(page).locator(".team-name a").click();
  await expect(page.locator("#team-detail-root")).toHaveAttribute("data-source-config-id", row.sourceConfigId);
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await settleFilteredReturn(page);
}

test("Đội chuẩn: click thường vào chi tiết có URL sạch, Quay lại đủ bộ lọc, reload giữ nguyên, về danh sách thì thẻ vẫn ở đó", async ({ page }) => {
  await openDetailFromFilteredList(page);
  // Link nội bộ chỉ là URL canonical; trạng thái danh sách đi theo referrer, rồi được ghim vào history.state.
  expect(new URL(page.url()).search).toBe("");
  expectFilteredList(await returnUrl(page));
  expect(await page.evaluate(() => history.state?.teamDetailReturn)).toBe(await backLink(page).getAttribute("href"));

  await page.reload();
  await settleFilteredReturn(page);
  expectFilteredList(await returnUrl(page));

  await backLink(page).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(query);
  expect(new URL(page.url()).searchParams.get("season")).toBe(season);
  await expect(teamCard(page)).toBeVisible();
});

test("Đội chuẩn: Cmd/Ctrl-click mở tab mới, Quay lại ở tab mới đọc đúng bộ lọc từ referrer", async ({ page, context }) => {
  await page.goto(filteredListUrl);
  await waitForBoot(page);
  await expect(teamCard(page)).toBeVisible();
  const popup = context.waitForEvent("page");
  await teamCard(page).locator(".team-name a").click({ modifiers: ["ControlOrMeta"] });
  const opened = await popup;
  await expect(opened.locator("#team-detail-root")).toHaveAttribute("data-source-config-id", row.sourceConfigId);
  expect(new URL(opened.url()).search).toBe("");
  // Tab mới không có history.state; đội này chưa có đích ghim trong phiên: đích chỉ có thể đến từ referrer.
  await expect.poll(async () => new URL(await backLink(opened).getAttribute("href"), opened.url()).searchParams.get("q")).toBe(query);
  expectFilteredList(await returnUrl(opened));
  expect(new URL(page.url()).pathname).toBe("/doi-chuan/");
});

for (const [locale, prefix, hreflang] of [["zh", "/zh", "zh-Hans"], ["ja", "/ja", "ja"]]) {
  test(`đổi ngôn ngữ trên trang chi tiết (vi → ${locale}): Quay lại là danh sách bản ${locale} còn bộ lọc`, async ({ page }) => {
    await openDetailFromFilteredList(page);
    expectFilteredList(await returnUrl(page));
    // Link đổi ngôn ngữ là link thật tới entry mới: không history.state, referrer là trang chi tiết bản Việt (không dùng được).
    await page.locator("#lang-picker-toggle").click();
    await page.locator(`.header-actions [data-lang-switch][hreflang="${hreflang}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/doi-chuan/[^/?]+/$`));
    await expect(page.locator("#team-detail-body")).toBeVisible();
    expect(new URL(page.url()).search).toBe("");
    await expect.poll(async () => (await returnUrl(page)).searchParams.get("q")).toBe(query);
    expectFilteredList(await returnUrl(page), prefix);

    await backLink(page).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/doi-chuan/\\?`));
    await expect(teamSection(page).locator(".reference-team-card").first()).toBeVisible();
    expect(new URL(page.url()).searchParams.get("q")).toBe(query);
  });
}

test("quay về sau đăng nhập Google (entry mới, referrer là accounts.google.com): Quay lại vẫn còn bộ lọc", async ({ page }) => {
  await openDetailFromFilteredList(page);
  expectFilteredList(await returnUrl(page));
  const detailUrl = page.url();
  // OAuth trả về đúng URL trang chi tiết sạch, nhưng là entry mới: history.state trống, referrer khác origin. Rời sang
  // `about:blank` trước để lần vào lại chắc chắn là một điều hướng mới, không phải tải lại cùng entry (tải lại giữ state và referrer).
  await page.goto("about:blank");
  await page.goto(detailUrl, { referer: "https://accounts.google.com/" });
  await expect(page.locator("#team-detail-root")).toHaveAttribute("data-source-config-id", row.sourceConfigId);
  await expect.poll(async () => (await returnUrl(page)).searchParams.get("q")).toBe(query);
  expectFilteredList(await returnUrl(page));
});

test("đã có đích ghim trong phiên, vào lại từ trang cùng site ngoài danh sách (Landing, trang riêng Tra cứu): Quay lại về link họ đội, không lấy đích cũ", async ({ page }) => {
  await openDetailFromFilteredList(page);
  const detailUrl = page.url();
  const { origin } = new URL(detailUrl);
  for (const referer of [`${origin}/`, `${origin}/tra-cuu/tuong/luu-bi/`]) {
    // Entry mới (không history.state) với referrer cùng origin nhưng không phải trang danh sách: sessionStorage vẫn còn đích
    // của lần vào từ danh sách đã lọc, nhưng người dùng vừa đi đường khác tới đây nên đích đó là sai.
    await page.goto("about:blank");
    await page.goto(detailUrl, { referer });
    await expect.poll(() => page.evaluate(() => history.state?.teamDetailReturn), { message: referer }).toBeNull();
    await expect(backLink(page)).toHaveAttribute("href", `/doi-chuan/?season=${encodeURIComponent(season)}`);
  }
  // Lần vào không có đích đã xoá đích cũ của đội này: đổi ngôn ngữ ngay sau đó (entry mới, referrer là chính trang chi tiết)
  // không được làm sống lại danh sách đã lọc của lần truy cập trước.
  const zhUrl = new URL(detailUrl);
  zhUrl.pathname = `/zh${zhUrl.pathname}`;
  await page.goto(zhUrl.href, { referer: detailUrl });
  await expect.poll(() => page.evaluate(() => history.state?.teamDetailReturn)).toBeNull();
  await expect(backLink(page)).toHaveAttribute("href", `/zh/doi-chuan/?season=${encodeURIComponent(season)}`);
});

test("link cũ ?from=: Quay lại đúng nguồn (kể cả kho), thanh địa chỉ hết from, skip-link rồi reload vẫn đúng", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const detailPath = `/doi-chuan/${encodeURIComponent(handles.r[row.sourceConfigId])}/`;
  const source = `${filteredListUrl}&kho=rap-duoc&xep=de-rap`;
  await page.goto(`${detailPath}?from=${encodeURIComponent(source)}`);
  const expectSource = async () => {
    const url = await returnUrl(page);
    expectFilteredList(url);
    expect(url.searchParams.get("kho")).toBe("rap-duoc");
    expect(url.searchParams.get("xep")).toBe("de-rap");
  };
  await expect.poll(async () => (await returnUrl(page)).searchParams.get("kho")).toBe("rap-duoc");
  await expectSource();
  await expect.poll(() => new URL(page.url()).searchParams.has("from")).toBe(false);
  expect(new URL(page.url()).search).toBe("");

  // Skip-link là điều hướng fragment: entry mới không có history.state, URL không còn from, referrer vẫn trống.
  // Đích chỉ còn sống trong sessionStorage theo trang.
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  expect(await page.evaluate(() => history.state)).toBeNull();
  await page.reload();
  await expect.poll(async () => (await returnUrl(page)).searchParams.get("kho")).toBe("rap-duoc");
  await expectSource();
});

test("goto không referrer: nút Quay lại giữ link họ đội dựng sẵn và history.state.teamDetailReturn === null (JS đã chạy)", async ({ page, request }) => {
  const handles = await routeHandles(request);
  const [legacyId] = Object.keys(handles.l);
  for (const [path, fallback] of [
    [`/doi-chuan/${encodeURIComponent(handles.r[row.sourceConfigId])}/`, `/doi-chuan/?season=${encodeURIComponent(season)}`],
    [`/doi-khac/${encodeURIComponent(handles.l[legacyId])}/`, "/doi-khac/"],
    [khaiHoangRoute(teamA), "/khai-hoang/"],
  ]) {
    await page.goto(path);
    await expect(backLink(page)).toHaveAttribute("href", fallback);
    // HTML dựng sẵn đã mang sẵn link mặc định, nên chỉ `null` (khác `undefined`) chứng minh script của trang đã chạy.
    await expect.poll(() => page.evaluate(() => history.state?.teamDetailReturn), { message: path }).toBeNull();
  }
});

test("Khai hoang: Cmd/Ctrl-click thẻ B khi URL danh sách còn cặp của A thì Quay lại ở tab mới là cặp của B, không phải A", async ({ page, context }) => {
  await page.goto("/khai-hoang/");
  await waitForBoot(page);
  await khaiHoangCard(page, teamA).locator(`.kh-config-chip[data-variant="${variantA}"]`).click();
  expect(new URL(page.url()).searchParams.get("khTeam")).toBe(teamA.id);
  expect(new URL(page.url()).searchParams.get("khVariant")).toBe(variantA);

  const popup = context.waitForEvent("page");
  await khaiHoangCard(page, teamB).locator(".kh-detail-link").click({ modifiers: ["ControlOrMeta"] });
  const opened = await popup;
  // Click có phím sửa không chạy đồng bộ cặp vào URL danh sách, nên referrer của tab mới vẫn mang cặp của A.
  await expect(backLink(opened)).toHaveAttribute("href", pairOf(teamB));
  expect(new URL(page.url()).searchParams.get("khTeam")).toBe(teamA.id);
});

test("Khai hoang: click thường sau khi chọn cấu hình B thì Quay lại mang khTeam=B&khVariant, giữ qua reload", async ({ page }) => {
  await page.goto("/khai-hoang/");
  await waitForBoot(page);
  await khaiHoangCard(page, teamB).locator(`.kh-config-chip[data-variant="${variantB}"]`).click();
  await khaiHoangCard(page, teamB).locator(".kh-detail-link").click();
  await expect(page.locator("#team-detail-body")).toBeVisible();
  expect([...new URL(page.url()).searchParams.keys()]).toEqual(["variant"]);
  const pair = pairOf(teamB, variantB);
  await expect(backLink(page)).toHaveAttribute("href", pair);
  expect(await page.evaluate(() => history.state?.teamDetailReturn)).toBe(pair);

  await page.reload();
  await expect(backLink(page)).toHaveAttribute("href", pair);
  await backLink(page).click();
  await expect(page).toHaveURL(pair);
});

test("Khai hoang: ?variant= lạ từ danh sách không lọt vào cặp Quay lại (chỉ khTeam của đội đang mở)", async ({ page }) => {
  await page.goto("/khai-hoang/");
  await waitForBoot(page);
  await khaiHoangCard(page, teamB).locator(`.kh-config-chip[data-variant="${variantB}"]`).click();
  // Danh sách tải trước một bản phát hành đã bỏ cấu hình: link của thẻ trỏ `?variant=` không còn tồn tại.
  const link = khaiHoangCard(page, teamB).locator(".kh-detail-link");
  await link.evaluate((node, href) => node.setAttribute("href", href), `${khaiHoangRoute(teamB)}?variant=khong-co-cau-hinh`);
  await link.click();
  await expect(page.locator("#team-detail-status [role='alert']")).toContainText("khong-co-cau-hinh");
  // URL danh sách lúc bấm mang khTeam=B&khVariant=<cấu hình đang chọn>; cấu hình lạ không phải chip thật nên cặp chỉ còn đội.
  await expect(backLink(page)).toHaveAttribute("href", pairOf(teamB));
});

/** Mọi link `<a>` trong DOM hiện tại mang query `from` (kể cả link đổi ngôn ngữ ở header/menu). */
const linksWithFrom = (page) => page.evaluate(() => [...document.querySelectorAll("a[href]")]
  .filter((link) => new URL(link.getAttribute("href"), location.href).searchParams.has("from"))
  .map((link) => link.getAttribute("href")));

/** `?doi=` dựng lại Soi đội từ một Đội chuẩn có đủ tướng, chiến pháp và binh thư trong từ điển (cùng cách `beta-tools.spec.mjs`). */
function soiDoiTeamParam() {
  const heroes = read("data/heroes-dict.json");
  const tactics = read("data/tactics.json");
  const books = read("data/books-dict.json");
  const indexes = { hero: createEntityIndex(heroes, "hero"), tactic: createEntityIndex(tactics, "tactic"), book: createEntityIndex(books, "book") };
  const bookIdOf = createBookNameIndex(books);
  const known = (kind, id) => indexes[kind].byId.get(id);
  for (const record of records.filter((item) => item.sourceSeasonId === seasons.defaultSourceSeasonId)) {
    const slots = referenceTeam(record, null, bookIdOf).slots;
    if (slots.length !== 3) continue;
    const team = {
      heroes: slots.map((slot) => ({
        hero: slot.alternatives[0]?.canonicalId ?? null,
        tactics: [slot.tactics[0]?.ids[0] ?? null, slot.tactics[1]?.ids[0] ?? null],
        book: slot.book?.ids[0] ?? null,
      })),
    };
    const complete = team.heroes.every((member) => known("hero", member.hero) && member.tactics.every((id) => id && known("tactic", id)) && member.book && known("book", member.book));
    if (complete) return encodeTeamParam(team);
  }
  throw new Error("Cần một Đội chuẩn mùa mặc định có đủ tướng, chiến pháp và binh thư trong từ điển");
}

test("sau hydrate và sau đổi bộ lọc: không link nào mang from (Đội chuẩn, Đội khác, Khai hoang, Tra cứu, Soi đội, link đổi ngôn ngữ)", async ({ page }) => {
  const expectNoFrom = async (where) => expect(await linksWithFrom(page), where).toEqual([]);

  await page.goto(`/doi-chuan/?season=${encodeURIComponent(season)}`);
  await waitForBoot(page);
  await expect(teamSection(page).locator(".reference-team-card").first()).toBeVisible();
  await expectNoFrom("Đội chuẩn sau hydrate");
  await teamSection(page).getByLabel("Tìm Đội chuẩn").fill(query);
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(query);
  await expect(teamCard(page).first()).toBeVisible();
  await expectNoFrom("Đội chuẩn sau khi lọc");

  await page.goto("/doi-khac/");
  await waitForBoot(page);
  await expect(page.locator("#section-team-khac .reference-team-card").first()).toBeVisible();
  await expectNoFrom("Đội khác sau hydrate");
  await page.locator('#section-team-khac .view-btn[data-view="bang"]').click();
  await expect(page.locator("#section-team-khac .reference-table tbody tr").first()).toBeVisible();
  await expectNoFrom("Đội khác sau khi đổi kiểu xem");

  await page.goto("/khai-hoang/");
  await waitForBoot(page);
  await expectNoFrom("Khai hoang sau hydrate");
  await khaiHoangCard(page, teamA).locator(`.kh-config-chip[data-variant="${variantA}"]`).click();
  await expect(khaiHoangCard(page, teamA).locator(".kh-detail-link")).toHaveAttribute("href", `${khaiHoangRoute(teamA)}?variant=${variantA}`);
  await expectNoFrom("Khai hoang sau khi chọn cấu hình");

  await page.goto("/tra-cuu/tuong/?id=hero%3Asp-lu-mong");
  await waitForBoot(page);
  await expect(page.locator("#section-lookup .cam-nang-team a").first()).toBeVisible();
  await expectNoFrom("Tra cứu (hồ sơ tướng dựng bằng trình duyệt)");

  await page.goto(`/soi-doi-tu-anh/?season=${encodeURIComponent(seasons.defaultSourceSeasonId)}&doi=${soiDoiTeamParam()}`);
  await waitForBoot(page);
  await expect(page.locator("#section-analyze .ana-group-standard .ana-team-row .ana-team-link").first()).toBeVisible();
  await expect(page.locator("#section-analyze .ana-team-link").first()).toHaveAttribute("href", /^\/doi-chuan\/[^/?#]+\/$/);
  await expectNoFrom("Soi đội");
});
