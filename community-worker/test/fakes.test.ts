import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createFakeD1 } from "./fakes";

function seedUser(sqlite: DatabaseSync, id: string) {
  sqlite
    .prepare(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values (?, ?, ?, 0, ?, ?)`)
    .run(id, id, `${id}@x.test`, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
}

describe("fake D1 hợp đồng", () => {
  it("hai batch() song song không lồng transaction và cho kết quả như chạy tuần tự", async () => {
    const { d1, sqlite } = createFakeD1();
    for (const id of ["u1", "u2", "u3", "u4"]) seedUser(sqlite, id);
    const del = (id: string) => d1.prepare(`delete from "user" where id = ?`).bind(id);
    const [a, b] = await Promise.all([d1.batch([del("u1"), del("u2")]), d1.batch([del("u3"), del("u4")])]);
    expect(a.map((r) => r.meta.changes)).toEqual([1, 1]);
    expect(b.map((r) => r.meta.changes)).toEqual([1, 1]);
    expect(sqlite.prepare(`select count(*) n from "user"`).get()).toEqual({ n: 0 });
  });

  it("delete … returning trả đúng dòng và meta.changes = số dòng xoá", async () => {
    const { d1, sqlite } = createFakeD1();
    for (const id of ["u1", "u2", "u3"]) seedUser(sqlite, id);
    const [res] = await d1
      .batch([d1.prepare(`delete from "user" where id in (?, ?) returning id`).bind("u1", "u2")]);
    expect((res.results as { id: string }[]).map((r) => r.id).sort()).toEqual(["u1", "u2"]);
    expect(res.meta.changes).toBe(2);
    const single = await d1.prepare(`delete from "user" where id = ? returning id`).bind("u3").all<{ id: string }>();
    expect(single.results).toEqual([{ id: "u3" }]);
    expect(single.meta.changes).toBe(1);
  });

  it("select thuần báo changes = 0 (không dính số dòng của câu ghi trước đó)", async () => {
    const { d1, sqlite } = createFakeD1();
    seedUser(sqlite, "u1");
    await d1.prepare(`delete from "user" where id = ?`).bind("u1").run();
    const res = await d1.prepare(`select id from "user"`).all();
    expect(res.meta.changes).toBe(0);
  });

  it("batch lỗi giữa chừng rollback toàn bộ và batch sau vẫn chạy được", async () => {
    const { d1, sqlite } = createFakeD1();
    seedUser(sqlite, "u1");
    seedUser(sqlite, "u2");
    await expect(
      d1.batch([
        d1.prepare(`delete from "user" where id = ?`).bind("u1"),
        d1.prepare(`insert into no_such_table (x) values (1)`),
      ]),
    ).rejects.toThrow();
    expect(sqlite.prepare(`select count(*) n from "user"`).get()).toEqual({ n: 2 });
    const [r] = await d1.batch([d1.prepare(`delete from "user" where id = ?`).bind("u2")]);
    expect(r.meta.changes).toBe(1);
  });
});
