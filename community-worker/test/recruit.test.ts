import { describe, expect, it } from "vitest";
import { RATE_RULES } from "../src/ratelimit";
import { RECRUIT_MAX_RECORDS } from "../src/routes/recruit";
import { createHarness, type Harness } from "./fakes";

interface WireRecord {
  kind: string;
  id: string;
  updatedAt: number;
  data: Record<string, unknown>;
}
interface PullBody {
  records: WireRecord[];
  cursor: number;
  more: boolean;
}
interface PushBody {
  accepted: number;
  cursor: number;
}

const T0 = Date.UTC(2026, 8, 1, 8, 0, 0);

function rec(kind: string, id: string, updatedAt: number, extra: Record<string, unknown> = {}): WireRecord {
  return { kind, id, updatedAt, data: { id, updatedAt: new Date(updatedAt).toISOString(), deletedAt: "", ...extra } };
}

async function push(h: Harness, as: "alice" | "bob", records: unknown) {
  return h.request("/api/recruit", { as, json: { records } });
}

async function pull(h: Harness, as: "alice" | "bob", since?: number): Promise<PullBody> {
  const res = await h.request(`/api/recruit${since === undefined ? "" : `?since=${since}`}`, { as });
  expect(res.status).toBe(200);
  return res.json<PullBody>();
}

describe("recruit sync", () => {
  it("cần đăng nhập cho cả GET và POST", async () => {
    const h = createHarness();
    expect((await h.request("/api/recruit")).status).toBe(401);
    expect((await h.request("/api/recruit", { json: { records: [rec("event", "e1", T0)] } })).status).toBe(401);
  });

  it("ghi rồi kéo lại đủ bản ghi, theo thứ tự rev, con trỏ = rev lớn nhất", async () => {
    const h = createHarness();
    const records = [rec("account", "a1", T0, { name: "Chính" }), rec("banner", "b1", T0 + 1), rec("event", "e1", T0 + 2, { pulls: 3 })];
    const res = await push(h, "alice", records);
    expect(res.status).toBe(200);
    expect(await res.json<PushBody>()).toEqual({ accepted: 3, cursor: 3 });

    const body = await pull(h, "alice");
    expect(body).toEqual({ records, cursor: 3, more: false });
    expect((await pull(h, "alice", 3)).records).toEqual([]);
    expect((await pull(h, "alice", 1)).records.map((r) => r.id)).toEqual(["b1", "e1"]);
  });

  it("LWW: bản cũ hơn/bằng không ghi đè, bản mới hơn thì ghi và chỉ dòng được ghi mới tăng rev", async () => {
    const h = createHarness();
    await push(h, "alice", [rec("event", "e1", T0 + 100, { pulls: 1 }), rec("event", "e2", T0 + 100, { pulls: 2 })]);

    const stale = await push(h, "alice", [rec("event", "e1", T0 + 50, { pulls: 9 }), rec("event", "e2", T0 + 100, { pulls: 9 })]);
    expect(await stale.json<PushBody>()).toEqual({ accepted: 0, cursor: 2 });
    expect((await pull(h, "alice")).records.map((r) => r.data.pulls)).toEqual([1, 2]);

    const newer = await push(h, "alice", [rec("event", "e1", T0 + 50, { pulls: 7 }), rec("event", "e2", T0 + 200, { pulls: 4 })]);
    expect(await newer.json<PushBody>()).toEqual({ accepted: 1, cursor: 3 });
    const after = await pull(h, "alice", 2);
    expect(after.records).toEqual([rec("event", "e2", T0 + 200, { pulls: 4 })]);
    expect(after.cursor).toBe(3);
  });

  it("không tin rev/trường lạ do client gửi; cùng id khác kind là hai bản ghi", async () => {
    const h = createHarness();
    const res = await push(h, "alice", [{ ...rec("account", "x", T0), rev: 999 }, rec("banner", "x", T0)]);
    expect(await res.json<PushBody>()).toEqual({ accepted: 2, cursor: 2 });
    const body = await pull(h, "alice");
    expect(body.records.map((r) => `${r.kind}:${r.id}`)).toEqual(["account:x", "banner:x"]);
    expect(body.records[0]).not.toHaveProperty("rev");
  });

  it("phân trang 500 bản ghi theo since, cờ more", async () => {
    const h = createHarness();
    const all = Array.from({ length: 1200 }, (_, i) => rec("event", `e${String(i).padStart(4, "0")}`, T0 + i));
    for (let i = 0; i < all.length; i += 500) expect((await push(h, "alice", all.slice(i, i + 500))).status).toBe(200);

    const seen: string[] = [];
    let since = 0;
    const pages: boolean[] = [];
    for (;;) {
      const page = await pull(h, "alice", since);
      seen.push(...page.records.map((r) => r.id));
      pages.push(page.more);
      since = page.cursor;
      if (!page.more) break;
    }
    expect(pages).toEqual([true, true, false]);
    expect(seen).toEqual(all.map((r) => r.id));
    expect(since).toBe(1200);
  });

  it("dữ liệu tách theo user, rev đếm riêng từng user", async () => {
    const h = createHarness();
    await push(h, "alice", [rec("event", "e1", T0), rec("event", "e2", T0)]);
    const bob = await push(h, "bob", [rec("event", "e1", T0 + 5, { pulls: 2 })]);
    expect(await bob.json<PushBody>()).toEqual({ accepted: 1, cursor: 1 });
    expect((await pull(h, "bob")).records).toEqual([rec("event", "e1", T0 + 5, { pulls: 2 })]);
    expect((await pull(h, "alice")).records.map((r) => r.data.pulls)).toEqual([undefined, undefined]);
  });

  it.each([
    ["records không phải mảng", { records: "x" }],
    ["thiếu records", {}],
    ["kind sai", { records: [{ ...rec("event", "e1", T0), kind: "hero" }] }],
    ["id rỗng", { records: [rec("event", "", T0)] }],
    ["id quá dài", { records: [rec("event", "e".repeat(101), T0)] }],
    ["data.id khác id", { records: [{ ...rec("event", "e1", T0), id: "e2" }] }],
    ["updatedAt không khớp data.updatedAt", { records: [{ ...rec("event", "e1", T0), updatedAt: T0 + 1 }] }],
    ["updatedAt không phải số nguyên", { records: [{ ...rec("event", "e1", T0), updatedAt: T0 + 0.5 }] }],
    ["data là mảng", { records: [{ kind: "event", id: "e1", updatedAt: T0, data: [] }] }],
    ["data quá 4 KB", { records: [rec("event", "e1", T0, { note: "x".repeat(4100) })] }],
    ["quá 500 bản ghi", { records: Array.from({ length: 501 }, (_, i) => rec("event", `e${i}`, T0)) }],
  ])("body không hợp lệ -> 400 (%s)", async (_label, json) => {
    const h = createHarness();
    const res = await h.request("/api/recruit", { as: "alice", json });
    expect(res.status).toBe(400);
    expect((await res.json<{ error: { code: string } }>()).error.code).toMatch(/^invalid_/u);
    expect((await pull(h, "alice")).records).toEqual([]);
  });

  it("since sai -> 400", async () => {
    const h = createHarness();
    for (const since of ["-1", "abc", "1.5", "99999999999999999999"]) {
      expect((await h.request(`/api/recruit?since=${since}`, { as: "alice" })).status).toBe(400);
    }
  });

  it("vượt trần bản ghi mỗi user -> 413; sửa bản ghi đã có vẫn được", async () => {
    const h = createHarness();
    const insert = h.sqlite.prepare(
      "insert into recruit_records (user_id, kind, id, updated_at, rev, payload) values ('u-alice', 'event', ?, ?, ?, '{}')",
    );
    for (let i = 0; i < RECRUIT_MAX_RECORDS; i++) insert.run(`s${i}`, T0, i + 1);

    const over = await push(h, "alice", [rec("event", "new", T0)]);
    expect(over.status).toBe(413);
    expect((await over.json<{ error: { code: string } }>()).error.code).toBe("recruit_quota_exceeded");

    const edit = await push(h, "alice", [rec("event", "s0", T0 + 1)]);
    expect(await edit.json<PushBody>()).toEqual({ accepted: 1, cursor: RECRUIT_MAX_RECORDS + 1 });
  });

  it("chặn POST khác origin", async () => {
    const h = createHarness();
    const res = await h.request("/api/recruit", {
      as: "alice",
      json: { records: [rec("event", "e1", T0)] },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect((await pull(h, "alice")).records).toEqual([]);
  });

  it("rate limit lượt ghi theo user", async () => {
    const h = createHarness();
    h.clock.now = Date.UTC(2026, 8, 27, 10, 0, 0);
    const { limit } = RATE_RULES.recruit_push;
    for (let i = 0; i < limit; i++) expect((await push(h, "alice", [])).status).toBe(200);
    expect((await push(h, "alice", [rec("event", "e1", T0)])).status).toBe(429);
    expect((await push(h, "bob", [rec("event", "e1", T0)])).status).toBe(200);
  });
});
