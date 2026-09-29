import { describe, expect, it } from "vitest";
import { createHarness, imageForm, PNG_BYTES, type ApiJson, type Harness } from "./fakes";

const IP = { "cf-connecting-ip": "203.0.113.7" };
const stats = (overrides: Record<string, unknown> = {}) => ({
  screen: "battleReport",
  side: "right",
  read: 12,
  edited: 3,
  unclear: 2,
  ...overrides,
});
const postStats = (h: Harness, json: unknown, ip = IP) => h.request("/api/scan-stats", { json, headers: ip });
const statRows = (h: Harness) => h.sqlite.prepare("select * from scan_stats order by day, screen, side").all() as Record<string, unknown>[];

const CONFIRMED_HEROES = [
  { hero: "hero:ling-tong", tactics: ["tactic:a-b", null], book: null },
  { hero: "hero:gan-ning", tactics: [null, null], book: "book:x1" },
  { hero: "hero:zhou-tai", tactics: ["tactic:c", "tactic:d"], book: null },
];

function payload(overrides: Record<string, unknown> = {}) {
  return {
    screen: "battleReport",
    side: "left",
    lang: "vi",
    aiRead: { heroes: [{ nameCn: "凌统", tacticsCn: ["百步穿杨", "疾风"], booksCn: [], statFocusCn: "" }] },
    confirmed: { heroes: CONFIRMED_HEROES },
    ...overrides,
  };
}

function sampleForm(p: unknown = payload()) {
  const form = imageForm(PNG_BYTES, "image/png");
  form.append("payload", typeof p === "string" ? p : JSON.stringify(p));
  return form;
}
const submit = (h: Harness, p?: unknown, as?: "alice" | "bob" | "admin") =>
  h.request("/api/scan-samples", { as, body: sampleForm(p) });

describe("POST /api/scan-stats", () => {
  it("ẩn danh gửi được; cộng dồn theo ngày UTC và (screen, side); sang ngày mới là dòng mới", async () => {
    const h = createHarness();
    expect((await postStats(h, stats())).status).toBe(201);
    expect((await postStats(h, stats({ read: 10, edited: 1, unclear: 0 }))).status).toBe(201);
    await postStats(h, stats({ side: "left" }));
    h.clock.now += 86_400_000;
    await postStats(h, stats());
    expect(statRows(h)).toEqual([
      { day: "2026-09-27", screen: "battleReport", side: "left", events: 1, cells_read: 12, cells_edited: 3, cells_unclear: 2 },
      { day: "2026-09-27", screen: "battleReport", side: "right", events: 2, cells_read: 22, cells_edited: 4, cells_unclear: 2 },
      { day: "2026-09-28", screen: "battleReport", side: "right", events: 1, cells_read: 12, cells_edited: 3, cells_unclear: 2 },
    ]);
  });

  it("body sai -> 400 và không ghi gì", async () => {
    const h = createHarness();
    for (const bodyJson of [
      stats({ screen: "x" }),
      stats({ side: "middle" }),
      stats({ read: 13 }),
      stats({ edited: -1 }),
      stats({ unclear: 1.5 }),
      stats({ read: "12" }),
      stats({ read: 2, unclear: 3 }),
      { screen: "other", side: "left" },
    ]) {
      expect((await postStats(h, bodyJson)).status).toBe(400);
    }
    expect(statRows(h)).toEqual([]);
  });

  it("60 lượt/giờ/IP: lượt 61 bị 429 và không ghi; IP khác vẫn gửi được", async () => {
    const h = createHarness();
    for (let i = 0; i < 60; i++) expect((await postStats(h, stats())).status).toBe(201);
    const res = await postStats(h, stats());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(statRows(h)[0].events).toBe(60);
    expect((await postStats(h, stats(), { "cf-connecting-ip": "198.51.100.9" })).status).toBe(201);
  });

  it("thiếu IP_HASH_SECRET -> 503 scan_stats_unavailable", async () => {
    const h = createHarness({ IP_HASH_SECRET: undefined });
    const res = await postStats(h, stats());
    expect(res.status).toBe(503);
    expect(((await res.json()) as ApiJson).error.code).toBe("scan_stats_unavailable");
  });
});

describe("GET /api/admin/scan-stats", () => {
  it("chỉ admin; tổng theo cửa sổ 7/30/90, mặc định 30, days lạ -> 400", async () => {
    const h = createHarness();
    const insert = h.sqlite.prepare("insert into scan_stats values (?, ?, ?, ?, ?, ?, ?)");
    insert.run("2026-09-27", "battleReport", "left", 2, 24, 4, 2); // hôm nay
    insert.run("2026-09-27", "teamDetail", "left", 1, 12, 0, 0);
    insert.run("2026-09-20", "battleReport", "left", 1, 12, 1, 1); // 7 ngày trước: ngoài cửa sổ 7
    insert.run("2026-08-01", "battleReport", "left", 5, 60, 6, 6); // ngoài 30, trong 90
    insert.run("2026-05-01", "battleReport", "left", 9, 9, 9, 9); // ngoài 90

    expect((await h.request("/api/admin/scan-stats")).status).toBe(401);
    expect((await h.request("/api/admin/scan-stats", { as: "alice" })).status).toBe(403);

    const get = async (q: string) => (await (await h.request(`/api/admin/scan-stats${q}`, { as: "admin" })).json()) as { days: number; rows: unknown[] };
    expect(await get("?days=7")).toEqual({
      days: 7,
      rows: [
        { screen: "battleReport", side: "left", events: 2, read: 24, edited: 4, unclear: 2 },
        { screen: "teamDetail", side: "left", events: 1, read: 12, edited: 0, unclear: 0 },
      ],
    });
    const d30 = await get("");
    expect(d30.days).toBe(30);
    expect(d30.rows[0]).toMatchObject({ events: 3, read: 36 });
    expect((await get("?days=90")).rows[0]).toMatchObject({ events: 8, read: 96, edited: 11, unclear: 9 });
    expect((await h.request("/api/admin/scan-stats?days=15", { as: "admin" })).status).toBe(400);
  });
});

describe("POST /api/scan-samples", () => {
  it("cần đăng nhập", async () => {
    const h = createHarness();
    expect((await submit(h, payload())).status).toBe(401);
  });

  it("thành công: lưu R2 scan-samples/<id>.png + D1 pending", async () => {
    const h = createHarness();
    const res = await submit(h, payload(), "alice");
    expect(res.status).toBe(201);
    const body = (await res.json()) as ApiJson;
    expect(body.status).toBe("pending");
    expect(h.objects.get(`scan-samples/${body.id}.png`)?.contentType).toBe("image/png");
    const row = h.sqlite.prepare("select * from scan_samples").get() as Record<string, string>;
    expect(row).toMatchObject({ id: body.id, user_id: "u-alice", status: "pending", side: "left", screen: "battleReport", lang: "vi" });
    expect(JSON.parse(row.confirmed).heroes).toHaveLength(3);
  });

  it("payload sai -> 400 và không lưu gì", async () => {
    const h = createHarness();
    const heroes: Record<string, unknown>[] = CONFIRMED_HEROES;
    const withHeroes = (mutate: (hs: Record<string, unknown>[]) => Record<string, unknown>[]) =>
      payload({ confirmed: { heroes: mutate(structuredClone(heroes)) } });
    const cases: unknown[] = [
      "không phải json",
      payload({ screen: "x" }),
      payload({ side: "mid" }),
      payload({ lang: "en" }),
      payload({ aiRead: { heroes: [] } }),
      payload({ aiRead: { heroes: Array.from({ length: 7 }, () => ({ nameCn: "凌统" })) } }),
      payload({ confirmed: { heroes: heroes.slice(0, 2) } }),
      withHeroes((hs) => [{ ...hs[0], hero: "tactic:a" }, hs[1], hs[2]]), // sai loại ID ở vị trí tướng
      withHeroes((hs) => [{ ...hs[0], hero: "hero:Ling Tong" }, hs[1], hs[2]]),
      withHeroes((hs) => [{ ...hs[0], tactics: ["hero:a", null] }, hs[1], hs[2]]),
      withHeroes((hs) => [{ ...hs[0], tactics: ["tactic:a"] }, hs[1], hs[2]]),
      withHeroes((hs) => [{ ...hs[0], book: "tactic:a" }, hs[1], hs[2]]),
    ];
    for (const p of cases) expect((await submit(h, p, "alice")).status, JSON.stringify(p)?.slice(0, 80)).toBe(400);
    expect(h.objects.size).toBe(0);
    expect(h.sqlite.prepare("select count(*) as n from scan_samples").get()).toEqual({ n: 0 });
  });

  it("aiRead: cắt chuỗi 40 ký tự, ≤3 chiến pháp", async () => {
    const h = createHarness();
    const long = "文".repeat(60);
    const res = await submit(h, payload({ aiRead: { heroes: [{ nameCn: long, tacticsCn: ["a", "b", "c", "d"] }] } }), "alice");
    expect(res.status).toBe(201);
    const row = h.sqlite.prepare("select ai_read from scan_samples").get() as { ai_read: string };
    const hero = JSON.parse(row.ai_read).heroes[0];
    expect([...hero.nameCn]).toHaveLength(40);
    expect(hero.tacticsCn).toEqual(["a", "b", "c"]);
  });

  it("thiếu payload hoặc ảnh sai định dạng -> lỗi, không lưu", async () => {
    const h = createHarness();
    expect((await h.request("/api/scan-samples", { as: "alice", body: imageForm(PNG_BYTES, "image/png") })).status).toBe(400);
    const wrong = new FormData();
    wrong.append("image", new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "x.png", { type: "image/png" }));
    wrong.append("payload", JSON.stringify(payload()));
    expect((await h.request("/api/scan-samples", { as: "alice", body: wrong })).status).toBe(415);
    expect(h.objects.size).toBe(0);
  });

  it("10 lượt/ngày/user: lượt 11 bị 429 và không lưu ảnh; user khác vẫn gửi được", async () => {
    const h = createHarness();
    for (let i = 0; i < 10; i++) expect((await submit(h, payload(), "alice")).status).toBe(201);
    expect((await submit(h, payload(), "alice")).status).toBe(429);
    expect(h.objects.size).toBe(10);
    expect((await submit(h, payload(), "bob")).status).toBe(201);
  });
});

describe("admin scan-samples", () => {
  async function seed(h: Harness, as: "alice" | "bob" = "alice") {
    return ((await (await submit(h, payload(), as)).json()) as ApiJson).id;
  }
  const adminPost = (h: Harness, path: string) => h.request(path, { as: "admin", method: "POST" });

  it("người không phải admin -> 403; chưa đăng nhập -> 401 (mọi route admin)", async () => {
    const h = createHarness();
    const id = await seed(h);
    const base = `/api/admin/scan-samples`;
    for (const [method, path] of [
      ["GET", base],
      ["GET", `${base}/${id}/image`],
      ["GET", `${base}/${id}/fixture`],
      ["POST", `${base}/${id}/approve`],
      ["POST", `${base}/${id}/reject`],
    ]) {
      expect((await h.request(path, { as: "alice", method })).status, path).toBe(403);
      expect((await h.request(path, { method })).status, path).toBe(401);
    }
    expect(h.sqlite.prepare("select status from scan_samples").get()).toEqual({ status: "pending" });
  });

  it("liệt kê theo trạng thái (mặc định pending) kèm tác giả; status sai -> 400; phân trang", async () => {
    const h = createHarness();
    const first = await seed(h);
    h.clock.now += 1000;
    const second = await seed(h, "bob");
    await adminPost(h, `/api/admin/scan-samples/${first}/approve`);

    const pending = (await (await h.request("/api/admin/scan-samples", { as: "admin" })).json()) as ApiJson;
    expect(pending.items.map((i) => i.id)).toEqual([second]);
    expect(pending.items[0]).toMatchObject({ status: "pending", side: "left", author: { name: "Bob", image: "https://img.test/bob.png" } });
    expect(pending.items[0]).toHaveProperty("aiRead.heroes");
    expect(pending.nextCursor).toBeNull();
    const approved = (await (await h.request("/api/admin/scan-samples?status=approved", { as: "admin" })).json()) as ApiJson;
    expect(approved.items.map((i) => i.id)).toEqual([first]);
    expect((await h.request("/api/admin/scan-samples?status=zzz", { as: "admin" })).status).toBe(400);

    // 21 mẫu pending -> trang đầu 20 + con trỏ
    h.sqlite.prepare("delete from scan_samples").run();
    for (let i = 0; i < 21; i++) {
      h.clock.now += 1000;
      await seed(h, i % 2 ? "bob" : "alice");
      h.sqlite.prepare("update rate_limits set count = 0").run();
    }
    const page1 = (await (await h.request("/api/admin/scan-samples", { as: "admin" })).json()) as ApiJson;
    expect(page1.items).toHaveLength(20);
    const page2 = (await (await h.request(`/api/admin/scan-samples?cursor=${page1.nextCursor}`, { as: "admin" })).json()) as ApiJson;
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });

  it("ảnh chưa duyệt: admin xem no-store; ảnh sai id -> 404", async () => {
    const h = createHarness();
    const id = await seed(h);
    const res = await h.request(`/api/admin/scan-samples/${id}/image`, { as: "admin" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-type")).toBe("image/png");
    expect((await h.request("/api/admin/scan-samples/nope/image", { as: "admin" })).status).toBe(404);
  });

  it("approve -> approved; id không có -> 404", async () => {
    const h = createHarness();
    const id = await seed(h);
    expect(await (await adminPost(h, `/api/admin/scan-samples/${id}/approve`)).json()).toEqual({ id, status: "approved" });
    expect(h.sqlite.prepare("select status, reviewed_by from scan_samples").get()).toEqual({ status: "approved", reviewed_by: "u-admin" });
    expect((await adminPost(h, "/api/admin/scan-samples/nope/approve")).status).toBe(404);
  });

  it("reject xoá ảnh R2 và image_key=null; sau đó ảnh 404, không duyệt lại được (409)", async () => {
    const h = createHarness();
    const id = await seed(h);
    expect(h.objects.has(`scan-samples/${id}.png`)).toBe(true);
    expect((await adminPost(h, `/api/admin/scan-samples/${id}/reject`)).status).toBe(200);
    expect(h.objects.size).toBe(0);
    expect(h.sqlite.prepare("select status, image_key from scan_samples").get()).toEqual({ status: "rejected", image_key: null });
    expect((await h.request(`/api/admin/scan-samples/${id}/image`, { as: "admin" })).status).toBe(404);
    expect((await adminPost(h, `/api/admin/scan-samples/${id}/approve`)).status).toBe(409);
  });

  it("fixture: chỉ approved còn ảnh, đúng hình dạng C5 (không có screen AI tự đoán, không có sideCount)", async () => {
    const h = createHarness();
    const id = await seed(h);
    const url = `/api/admin/scan-samples/${id}/fixture`;
    expect((await h.request(url, { as: "admin" })).status).toBe(409); // chưa duyệt
    await adminPost(h, `/api/admin/scan-samples/${id}/approve`);
    const res = await h.request(url, { as: "admin" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      image: `${id}.png`,
      source: `scan-sample ${id}`,
      expected: { sides: [{ side: "left", heroes: CONFIRMED_HEROES }] },
    });
    // Approved nhưng mất ảnh (vd. bị xoá tay) -> 409 rõ ràng
    h.sqlite.prepare("update scan_samples set image_key = null").run();
    const gone = await h.request(url, { as: "admin" });
    expect(gone.status).toBe(409);
    expect(((await gone.json()) as ApiJson).error.code).toBe("image_missing");
    expect((await h.request("/api/admin/scan-samples/nope/fixture", { as: "admin" })).status).toBe(404);
  });
});
