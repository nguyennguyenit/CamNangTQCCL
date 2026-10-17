// Nội dung của user bị khoá biến mất khỏi API CÔNG KHAI (bình luận, chiến báo, thống kê, ảnh), còn nguyên ở API admin,
// và hiện lại khi khoá hết hạn hoặc được mở.

import { describe, expect, it } from "vitest";
import { createHarness, PNG_BYTES, type Harness } from "./fakes";

const PAGE = "/doi-chuan/s18-abc/";
const IMAGE_KEY = "reports/r1.png";
const DAY = 86_400_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();

async function seed(h: Harness) {
  h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values ('c1', ?, 'vi', 'u-alice', 'bình luận của alice', 1)").run(PAGE);
  h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values ('c2', ?, 'vi', 'u-bob', 'bình luận của bob', 2)").run(PAGE);
  const report = h.sqlite.prepare(
    "insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, status, created_at) values (?, ?, 'vi', ?, ?, 'win', '[\"a\"]', '[\"x\"]', 'approved', ?)",
  );
  report.run("r1", PAGE, "u-alice", IMAGE_KEY, 1);
  report.run("r2", PAGE, "u-bob", null, 2);
  await h.env.MEDIA.put(IMAGE_KEY, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
}

const ban = (h: Harness, as: string, id: string, duration = "7d") =>
  h.request(`/api/admin/users/${id}/ban`, { as, json: { duration, reason: "spam" } });
const commentIds = async (h: Harness, as?: string) =>
  (await json(await h.request(`/api/comments?page=${PAGE}&lang=vi`, { as }))).items.map((i: { id: string }) => i.id);
const reportIds = async (h: Harness) => (await json(await h.request(`/api/reports?page=${PAGE}&lang=vi`))).items.map((i: { id: string }) => i.id);
const stats = async (h: Harness) => json(await h.request(`/api/reports/stats?page=${PAGE}`));

describe("ẩn nội dung của user bị khoá ở API công khai", () => {
  it("bình luận, chiến báo, thống kê biến mất; API admin vẫn có; hết hạn thì hiện lại", async () => {
    const h = createHarness();
    await seed(h);
    expect(await commentIds(h)).toEqual(["c2", "c1"]);
    expect(await reportIds(h)).toEqual(["r2", "r1"]);
    expect((await stats(h)).total).toBe(2);

    expect((await ban(h, "admin", "u-alice")).status).toBe(200);

    expect(await commentIds(h)).toEqual(["c2"]);
    expect(await commentIds(h, "bob")).toEqual(["c2"]);
    expect(await reportIds(h)).toEqual(["r2"]);
    expect((await stats(h)).total).toBe(1);

    // Staff vẫn thấy và xử lý.
    const adminComments = await json(await h.request("/api/admin/comments", { as: "moderator" }));
    expect(adminComments.items.map((i: { id: string }) => i.id)).toContain("c1");
    const adminReports = await json(await h.request("/api/admin/reports?status=approved", { as: "admin" }));
    expect(adminReports.items.map((i: { id: string }) => i.id).sort()).toEqual(["r1", "r2"]);

    // Hết hạn theo thời gian, không cần cron.
    h.clock.now += 7 * DAY;
    expect(await commentIds(h)).toEqual(["c2", "c1"]);
    expect(await reportIds(h)).toEqual(["r2", "r1"]);
    expect((await stats(h)).total).toBe(2);
  });

  it("mở khoá thì hiện lại; khoá vĩnh viễn thì ẩn mãi", async () => {
    const h = createHarness();
    await seed(h);
    await ban(h, "admin", "u-alice", "permanent");
    h.clock.now += 3650 * DAY;
    expect(await commentIds(h)).toEqual(["c2"]);
    h.clock.now -= 3650 * DAY;
    expect((await h.request("/api/admin/users/u-alice/unban", { as: "admin", method: "POST" })).status).toBe(200);
    expect(await commentIds(h)).toEqual(["c2", "c1"]);
    expect((await stats(h)).total).toBe(2);
  });

  it("user đang xoá cũng bị ẩn", async () => {
    const h = createHarness();
    await seed(h);
    h.sqlite.prepare('update "user" set deleting_at = 1 where id = ?').run("u-alice");
    expect(await commentIds(h)).toEqual(["c2"]);
    expect(await reportIds(h)).toEqual(["r2"]);
  });

  it("danh sách công khai phân trang vẫn đủ 20 dòng khi có nội dung bị ẩn xen kẽ", async () => {
    const h = createHarness();
    const insert = h.sqlite.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, ?, 'vi', ?, 'x', ?)");
    for (let i = 1; i <= 25; i++) insert.run(`c${String(i).padStart(2, "0")}`, PAGE, i % 2 ? "u-alice" : "u-bob", i);
    await ban(h, "admin", "u-alice");
    const first = await json(await h.request(`/api/comments?page=${PAGE}&lang=vi`));
    expect(first.items).toHaveLength(12);
    expect(first.items.every((i: { author: { id: string } }) => i.author.id === "u-bob")).toBe(true);
    expect(first.nextCursor).toBeNull();
  });
});

describe("ảnh chiến báo của user bị khoá", () => {
  const url = "/api/reports/r1/image";

  it("công khai: public, no-cache + ETag; If-None-Match khớp -> 304 kèm header", async () => {
    const h = createHarness();
    await seed(h);
    const ok = await h.request(url);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Cache-Control")).toBe("public, no-cache");
    const etag = ok.headers.get("ETag");
    expect(etag).toBe(`"${IMAGE_KEY}"`);
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG_BYTES);

    const notModified = await h.request(url, { headers: { "if-none-match": etag as string } });
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get("ETag")).toBe(etag);
    expect(notModified.headers.get("Cache-Control")).toBe("public, no-cache");
    expect(await notModified.text()).toBe("");

    const weak = await h.request(url, { headers: { "if-none-match": `"khac", W/${etag}` } });
    expect(weak.status).toBe(304);
    const stale = await h.request(url, { headers: { "if-none-match": '"khac"' } });
    expect(stale.status).toBe(200);
  });

  it("khoá tác giả: khách 404 kể cả khi If-None-Match khớp ETag cũ; staff vẫn xem (private, no-store); hết hạn thì công khai lại", async () => {
    const h = createHarness();
    await seed(h);
    const etag = (await h.request(url)).headers.get("ETag") as string;
    expect((await ban(h, "admin", "u-alice")).status).toBe(200);

    const guest = await h.request(url, { headers: { "if-none-match": etag } });
    expect(guest.status).toBe(404);
    expect(guest.headers.get("Cache-Control")).toBe("no-store");
    expect((await h.request(url)).status).toBe(404);
    expect((await h.request(url, { as: "bob" })).status).toBe(404);
    // Chủ đã bị huỷ phiên -> như khách.
    expect((await h.request(url, { as: "alice" })).status).toBe(404);

    const staff = await h.request(url, { as: "moderator" });
    expect(staff.status).toBe(200);
    expect(staff.headers.get("Cache-Control")).toBe("private, no-store");
    expect(staff.headers.get("ETag")).toBe(etag);
    const staff304 = await h.request(url, { as: "admin", headers: { "if-none-match": etag } });
    expect(staff304.status).toBe(304);
    expect(staff304.headers.get("ETag")).toBe(etag);
    expect(staff304.headers.get("Cache-Control")).toBe("private, no-store");

    h.clock.now += 7 * DAY;
    const back = await h.request(url, { headers: { "if-none-match": etag } });
    expect(back.status).toBe(304);
    expect(back.headers.get("Cache-Control")).toBe("public, no-cache");
  });

  it("ảnh chưa duyệt vẫn chỉ chủ/staff; ảnh thiếu -> 404", async () => {
    const h = createHarness();
    await seed(h);
    h.sqlite.prepare("update battle_reports set status = 'pending' where id = 'r1'").run();
    expect((await h.request(url)).status).toBe(404);
    expect((await h.request(url, { as: "alice" })).status).toBe(200);
    expect((await h.request(url, { as: "moderator" })).status).toBe(200);
    expect((await h.request("/api/reports/khong-co/image")).status).toBe(404);
  });
});
