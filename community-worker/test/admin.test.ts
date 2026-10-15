import { describe, expect, it } from "vitest";
import { createHarness, type ApiJson, type Harness } from "./fakes";

function seed(h: Harness) {
  const report = h.sqlite.prepare(
    "insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values (?, '/doi-chuan/x/', 'vi', 'u-alice', 'win', '[]', '[]', ?, 1)",
  );
  for (const [id, status] of [["r1", "pending"], ["r2", "pending"], ["r3", "approved"], ["r4", "rejected"]]) report.run(id, status);
  const post = h.sqlite.prepare(
    "insert into posts (id, slug, lang, title, description, body_markdown, faq, tags, status, author_name, updated_at, created_at) values (?, ?, 'vi', 't', '', '', '[]', '[]', ?, 'a', 1, 1)",
  );
  for (const [id, status] of [["p1", "draft"], ["p2", "published"], ["p3", "draft"], ["p4", "draft"]]) post.run(id, id, status);
  const fb = h.sqlite.prepare("insert into feedback (id, kind, title, body, lang, status, created_at) values (?, 'bug', 't', 'b', 'vi', ?, 1)");
  for (const [id, status] of [["f1", "new"], ["f2", "done"], ["f3", "done"]]) fb.run(id, status);
  const sample = h.sqlite.prepare(
    "insert into scan_samples (id, user_id, screen, side, lang, ai_read, confirmed, status, created_at) values (?, 'u-alice', 'battleReport', 'left', 'vi', '{}', '{}', ?, 1)",
  );
  for (const [id, status] of [["s1", "pending"], ["s2", "approved"]]) sample.run(id, status);
}

describe("GET /api/admin/counts", () => {
  it("chỉ admin xem được; khách 401, người thường 403", async () => {
    const h = createHarness();
    expect((await h.request("/api/admin/counts")).status).toBe(401);
    expect((await h.request("/api/admin/counts", { as: "bob" })).status).toBe(403);
  });

  it("đếm đúng theo trạng thái của từng bảng, bỏ qua trạng thái khác", async () => {
    const h = createHarness();
    seed(h);
    const res = await h.request("/api/admin/counts", { as: "admin" });
    expect(res.status).toBe(200);
    expect(await res.json<ApiJson>()).toEqual({ reportsPending: 2, postsDraft: 3, feedbackNew: 1, feedbackDone: 2, scanPending: 1 });
  });

  it("bảng trống trả 0", async () => {
    const h = createHarness();
    expect(await (await h.request("/api/admin/counts", { as: "admin" })).json<ApiJson>()).toEqual({
      reportsPending: 0, postsDraft: 0, feedbackNew: 0, feedbackDone: 0, scanPending: 0,
    });
  });
});
