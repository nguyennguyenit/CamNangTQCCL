import { describe, expect, it } from "vitest";
import { RATE_RULES } from "../src/ratelimit";
import { D1_FREE_QUERIES_PER_INVOCATION, ROSTER_CAPS, ROSTER_MAX_BATCH, ROSTER_MAX_LIVE, ROSTER_MAX_RETAINED } from "../src/routes/roster";
import { createHarness, type Harness } from "./fakes";

interface Wire {
  kind: string;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown>;
}
interface PulledRecord {
  kind: string;
  id: string;
  boxId: string | null;
  updatedAt: number;
  rev: number;
  deleted: boolean;
  data: Record<string, unknown>;
}
interface PullBody {
  userId: string;
  records: PulledRecord[];
  cursor: number;
  more: boolean;
}
interface Result {
  kind: string;
  id: string;
  outcome: string;
  code?: string;
  server?: PulledRecord;
}
interface PushBody {
  results: Result[];
  cursor: number;
}
interface Row {
  kind: string;
  id: string;
  box_id: string | null;
  updated_at: number;
  rev: number;
  deleted: number;
  payload: string;
}

type Who = "alice" | "bob";
const UID: Record<Who, string> = { alice: "u-alice", bob: "u-bob" };
const T0 = Date.UTC(2026, 8, 1, 8, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;

// ---- dựng bản ghi ----
const live = (kind: string, id: string, ts: number, extra: Record<string, unknown>): Wire => ({
  kind,
  id,
  updatedAt: ts,
  deleted: false,
  data: { id, updatedAt: iso(ts), deletedAt: "", ...extra },
});
const box = (id: string, ts: number, name = "Hộp") => live("box", id, ts, { name });
const group = (boxId: string, id: string, ts: number, name = "Nhóm", order = 0) => live("group", id, ts, { boxId, name, order });
const owned = (boxId: string, item: string, ts: number, name = "Tào Tháo") =>
  live("owned", `${boxId}~${item}`, ts, { boxId, item, name, type: item.startsWith("hero:") ? "hero" : "tactic" });
const tombstone = (kind: string, id: string, ts: number, boxId: string): Wire => ({
  kind,
  id,
  updatedAt: ts,
  deleted: true,
  data: { id, updatedAt: iso(ts), deletedAt: iso(ts), boxId },
});

const slot = (hero: string) => ({
  hero,
  slotState: "ok",
  rawName: "",
  heroAlternatives: [],
  redStars: null,
  tactics: [
    { primary: "tactic:a", alternatives: [], rawName: "" },
    { primary: null, alternatives: [], rawName: "" },
  ],
  books: [],
  bookType: "",
  troopNote: "",
  statNote: "",
  gearNote: "",
});
function teamData(id: string, boxId: string, groupId: string, extra: Record<string, unknown> = {}) {
  return {
    boxId,
    groupId,
    name: "Đội 1",
    seasonId: "s18",
    tierLabel: "T1",
    replacesTeamId: null,
    heroes: [slot("hero:tao-thao"), slot("hero:luu-bi"), slot("hero:ton-quyen")],
    notes: { general: "", strengths: "", goodAgainst: "", avoid: "" },
    userAlternatives: [],
    source: { kind: "recommended", key: "abc~v1", contentHash: "0123456789abcdef" },
    ...extra,
  };
}
const team = (id: string, boxId: string, groupId: string, ts: number, extra: Record<string, unknown> = {}): Wire =>
  live("team", id, ts, teamData(id, boxId, groupId, extra));

// ---- gọi API ----
const push = (h: Harness, as: Who, records: unknown, expectedUserId: unknown = UID[as]) =>
  h.request("/api/roster", { as, json: { expectedUserId, records } });
async function ok(h: Harness, as: Who, records: Wire[]): Promise<PushBody> {
  const res = await push(h, as, records);
  expect(res.status).toBe(200);
  return res.json<PushBody>();
}
/** Đẩy theo khúc ROSTER_MAX_BATCH như client; trả outcome của mọi khúc theo thứ tự. */
async function okChunked(h: Harness, as: Who, records: Wire[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < records.length; i += ROSTER_MAX_BATCH) out.push(...outcomes(await ok(h, as, records.slice(i, i + ROSTER_MAX_BATCH))));
  return out;
}
async function pull(h: Harness, as: Who, query = ""): Promise<PullBody> {
  const res = await h.request(`/api/roster${query}`, { as });
  expect(res.status).toBe(200);
  return res.json<PullBody>();
}
const outcomes = (body: PushBody) => body.results.map((r) => (r.code ? `${r.outcome}:${r.code}` : r.outcome));

// ---- đọc/seed DB ----
const rowOf = (h: Harness, as: Who, kind: string, id: string) =>
  h.sqlite.prepare("select kind, id, box_id, updated_at, rev, deleted, payload from roster_records where user_id = ? and kind = ? and id = ?").get(UID[as], kind, id) as unknown as Row | undefined;
const countOf = (h: Harness, as: Who, where = "1 = 1") =>
  (h.sqlite.prepare(`select count(*) as n from roster_records where user_id = ? and ${where}`).get(UID[as]) as { n: number }).n;

/** Chèn nhanh `n` dòng cùng kind (payload tối giản; ghi LWW/cap/quota không đọc payload dòng khác). */
function seed(h: Harness, as: Who, opts: { kind: string; boxId: string | null; prefix: string; n: number; deleted: 0 | 1 }) {
  h.sqlite
    .prepare(
      `with recursive n(i) as (select 1 union all select i + 1 from n where i < ?)
       insert into roster_records (user_id, kind, id, box_id, updated_at, rev, deleted, payload)
       select ?, ?, ? || i, ?, 1, (select coalesce(max(rev), 0) from roster_records where user_id = ?) + i, ?, '{}' from n`,
    )
    .run(opts.n, UID[as], opts.kind, opts.prefix, opts.boxId, UID[as], opts.deleted);
}

/** Hộp + hai nhóm mặc định (như ensureBoxDefaults). */
const boxWithDefaults = (boxId: string, ts: number): Wire[] => [
  box(boxId, ts),
  group(boxId, `${boxId}~khai-hoang`, ts, "Khai Hoang", 0),
  group(boxId, `${boxId}~ghep-team`, ts, "Ghép Team", 1),
];

async function withMain(h: Harness, as: Who = "alice", ts = T0) {
  const body = await ok(h, as, boxWithDefaults("main", ts));
  expect(outcomes(body)).toEqual(["applied", "applied", "applied"]);
}

describe("roster sync", () => {
  it("1. cần đăng nhập; user bị khóa có phiên -> 401 unauthorized", async () => {
    const h = createHarness();
    for (const res of [await h.request("/api/roster"), await h.request("/api/roster", { json: { expectedUserId: "u-alice", records: [] } })]) {
      expect(res.status).toBe(401);
      expect((await res.json<{ error: { code: string } }>()).error.code).toBe("unauthorized");
    }
    h.sqlite.prepare('update "user" set banned_until = ? where id = ?').run(h.clock.now + 60_000, "u-alice");
    expect((await h.request("/api/roster", { as: "alice" })).status).toBe(401);
    expect((await push(h, "alice", [])).status).toBe(401);
  });

  it("2. đẩy rồi kéo since=0: đúng bản ghi theo rev, cursor = rev lớn nhất", async () => {
    const h = createHarness();
    await withMain(h);
    const pushed = await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 1), team("team-1", "main", "main~ghep-team", T0 + 2)]);
    expect(outcomes(pushed)).toEqual(["applied", "applied"]);
    const page = await pull(h, "alice", "?since=0");
    expect(page.records.map((r) => `${r.kind}:${r.id}`)).toEqual([
      "box:main",
      "group:main~khai-hoang",
      "group:main~ghep-team",
      "owned:main~hero:tao-thao",
      "team:team-1",
    ]);
    expect(page.records.map((r) => r.rev)).toEqual([1, 2, 3, 4, 5]);
    expect(page.cursor).toBe(5);
    expect(page.userId).toBe("u-alice");
    expect(pushed.cursor).toBe(5);
    expect(page.more).toBe(false);
    expect(page.records[0]).toMatchObject({ boxId: null, updatedAt: T0, deleted: false, data: { id: "main", name: "Hộp" } });
    expect(page.records[3].boxId).toBe("main");
    expect((await pull(h, "alice", "?since=5")).records).toEqual([]);
    expect((await pull(h, "alice", "?since=5")).cursor).toBe(5);
  });

  it("3. ?kinds=owned,box không trả team/group", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 1), team("team-1", "main", "main~ghep-team", T0 + 2)]);
    const page = await pull(h, "alice", "?kinds=owned,box");
    expect(page.records.map((r) => r.kind).sort()).toEqual(["box", "owned"]);
    expect((await h.request("/api/roster?kinds=owned,nope", { as: "alice" })).status).toBe(400);
  });

  it("4. LWW: bản cũ hơn sau bản mới -> conflict kèm server", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 200, "Tào Tháo mới")]);
    const body = await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 100, "Tào Tháo cũ")]);
    expect(outcomes(body)).toEqual(["conflict"]);
    expect(body.results[0].server).toMatchObject({ kind: "owned", updatedAt: T0 + 200, boxId: "main", deleted: false, data: { name: "Tào Tháo mới" } });
    expect(rowOf(h, "alice", "owned", "main~hero:tao-thao")?.updated_at).toBe(T0 + 200);
  });

  it("5. gửi lại đúng bản đã lưu -> already-applied, không cấp rev mới", async () => {
    const h = createHarness();
    await withMain(h);
    const rec = owned("main", "hero:tao-thao", T0 + 5);
    const first = await ok(h, "alice", [rec]);
    expect(outcomes(first)).toEqual(["applied"]);
    // Cùng nội dung nhưng thứ tự khóa khác: vẫn là bản đã lưu.
    const shuffled: Wire = { ...rec, data: Object.fromEntries(Object.entries(rec.data).reverse()) };
    const again = await ok(h, "alice", [rec, shuffled]);
    expect(outcomes(again)).toEqual(["already-applied", "already-applied"]);
    expect(again.cursor).toBe(first.cursor);
    expect(rowOf(h, "alice", "owned", "main~hero:tao-thao")?.rev).toBe(first.cursor);
  });

  it("6. cùng updatedAt, payload khác -> conflict, server giữ bản đang có", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 5, "Bản A")]);
    const body = await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 5, "Bản B")]);
    expect(outcomes(body)).toEqual(["conflict"]);
    expect(body.results[0].server?.data.name).toBe("Bản A");
    expect(JSON.parse(rowOf(h, "alice", "owned", "main~hero:tao-thao")?.payload ?? "{}").name).toBe("Bản A");
  });

  it("7. xóa mềm: deleted = 1, payload thu gọn; bản sống cũ hơn gửi lại -> conflict", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 5)]);
    // Bản xóa gửi kèm dữ liệu thừa: server chỉ giữ {id, updatedAt, deletedAt, boxId}.
    const del = tombstone("owned", "main~hero:tao-thao", T0 + 10, "main");
    del.data.name = "thừa";
    expect(outcomes(await ok(h, "alice", [del]))).toEqual(["applied"]);
    const row = rowOf(h, "alice", "owned", "main~hero:tao-thao");
    expect(row?.deleted).toBe(1);
    expect(JSON.parse(row?.payload ?? "{}")).toEqual({ id: "main~hero:tao-thao", updatedAt: iso(T0 + 10), deletedAt: iso(T0 + 10), boxId: "main" });
    const stale = await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 6)]);
    expect(outcomes(stale)).toEqual(["conflict"]);
    expect(stale.results[0].server).toMatchObject({ deleted: true });
    expect(rowOf(h, "alice", "owned", "main~hero:tao-thao")?.deleted).toBe(1);
    // Hồi sinh bằng bản mới hơn thì được.
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 11)]))).toEqual(["applied"]);
    expect(rowOf(h, "alice", "owned", "main~hero:tao-thao")?.deleted).toBe(0);
  });

  it("8. phân trang 501 bản ghi: trang 1 more=true, trang 2 phần còn lại", async () => {
    const h = createHarness();
    const all = [box("main", T0), ...Array.from({ length: 500 }, (_, i) => owned("main", `hero:h${i}`, T0 + 1))];
    expect((await okChunked(h, "alice", all)).every((o) => o === "applied")).toBe(true);
    const p1 = await pull(h, "alice", "?since=0");
    expect(p1.records).toHaveLength(500);
    expect(p1.more).toBe(true);
    expect(p1.cursor).toBe(500);
    const p2 = await pull(h, "alice", `?since=${p1.cursor}`);
    expect(p2.records).toHaveLength(1);
    expect(p2.more).toBe(false);
    expect(p2.records[0].rev).toBe(501);
  });

  it("9. cô lập user, kể cả xóa hộp của alice không chạm bản ghi của bob cùng box_id", async () => {
    const h = createHarness();
    for (const who of ["alice", "bob"] as const) {
      await ok(h, who, [box("main", T0), box("box-x", T0), owned("box-x", "hero:tao-thao", T0 + 1, `Của ${who}`)]);
    }
    expect((await pull(h, "bob", "?since=0")).records).toHaveLength(3);
    expect(outcomes(await ok(h, "alice", [tombstone("box", "box-x", T0 + 10, "box-x")]))).toEqual(["applied"]);
    expect(countOf(h, "alice", "box_id = 'box-x'")).toBe(0);
    expect(countOf(h, "bob", "box_id = 'box-x'")).toBe(1);
    expect(rowOf(h, "bob", "box", "box-x")?.deleted).toBe(0);
    expect((await pull(h, "bob", "?since=0")).records.map((r) => r.rev)).toEqual([1, 2, 3]);
  });

  it("10. expectedUserId khác cookie -> 409 user_mismatch, không ghi gì", async () => {
    const h = createHarness();
    const res = await push(h, "alice", [box("main", T0)], "u-bob");
    expect(res.status).toBe(409);
    expect((await res.json<{ error: { code: string } }>()).error.code).toBe("user_mismatch");
    expect(countOf(h, "alice")).toBe(0);
    expect(countOf(h, "bob")).toBe(0);
  });

  it("11. batch lẫn applied/conflict/rejected: mỗi bản đúng outcome, bản hợp lệ vẫn được ghi", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 100)]);
    const body = await ok(h, "alice", [
      owned("main", "hero:luu-bi", T0 + 1, "Lưu Bị"),
      owned("main", "hero:tao-thao", T0 + 50),
      { ...owned("main", "hero:ton-quyen", T0 + 1), kind: "nope" },
      owned("main", "tactic:xyz", T0 + 2, "Chiến pháp"),
    ]);
    expect(outcomes(body)).toEqual(["applied", "conflict", "rejected:schema", "applied"]);
    expect(body.results.map((r) => r.id)).toEqual(["main~hero:luu-bi", "main~hero:tao-thao", "main~hero:ton-quyen", "main~tactic:xyz"]);
    expect(rowOf(h, "alice", "owned", "main~hero:luu-bi")).toBeTruthy();
    expect(rowOf(h, "alice", "owned", "main~tactic:xyz")).toBeTruthy();
    expect(rowOf(h, "alice", "owned", "main~hero:ton-quyen")).toBeUndefined();
  });

  it("12. updatedAt > now + 5 phút -> rejected clock_skew; đúng 5 phút vẫn qua", async () => {
    const h = createHarness();
    await withMain(h, "alice", h.clock.now - 10);
    const body = await ok(h, "alice", [
      owned("main", "hero:tao-thao", h.clock.now + 5 * 60_000 + 1),
      owned("main", "hero:luu-bi", h.clock.now + 5 * 60_000),
    ]);
    expect(outcomes(body)).toEqual(["rejected:clock_skew", "applied"]);
    expect(rowOf(h, "alice", "owned", "main~hero:tao-thao")).toBeUndefined();
  });

  it("13. bản ghi con vào hộp không tồn tại / đã xóa -> rejected box_missing", async () => {
    const h = createHarness();
    const missing = await ok(h, "alice", [owned("box-nope", "hero:tao-thao", T0), team("team-1", "box-nope", "box-nope~ghep-team", T0)]);
    expect(outcomes(missing)).toEqual(["rejected:box_missing", "rejected:box_missing"]);
    await ok(h, "alice", [box("box-x", T0)]);
    await ok(h, "alice", [tombstone("box", "box-x", T0 + 5, "box-x")]);
    const gone = await ok(h, "alice", [owned("box-x", "hero:tao-thao", T0 + 6)]);
    expect(outcomes(gone)).toEqual(["rejected:box_missing"]);
    expect(countOf(h, "alice", "kind <> 'box'")).toBe(0);
  });

  it("14. xóa hộp hợp lệ: hộp thành bản xóa, bản ghi con bị xóa hẳn, kết quả không đếm dòng con", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [
      ...boxWithDefaults("box-x", T0),
      owned("box-x", "hero:tao-thao", T0 + 1),
      team("team-1", "box-x", "box-x~ghep-team", T0 + 1),
      { ...live("season", "box-x", T0 + 1, { boxId: "box-x", seasonId: "s18" }) },
    ]);
    const body = await ok(h, "alice", [tombstone("box", "box-x", T0 + 10, "box-x")]);
    expect(body.results).toHaveLength(1);
    expect(outcomes(body)).toEqual(["applied"]);
    expect(rowOf(h, "alice", "box", "box-x")).toMatchObject({ deleted: 1, box_id: null, updated_at: T0 + 10 });
    expect(JSON.parse(rowOf(h, "alice", "box", "box-x")?.payload ?? "{}")).toMatchObject({ id: "box-x", deletedAt: iso(T0 + 10) });
    expect(countOf(h, "alice", "box_id = 'box-x'")).toBe(0);
    expect(countOf(h, "alice", "box_id = 'main'")).toBe(2); // hộp khác không bị chạm
  });

  it("15. xóa hộp đến muộn (server sống ở 200, xóa gửi 100) -> conflict, không bản ghi con nào bị xóa", async () => {
    const h = createHarness();
    await ok(h, "alice", [...boxWithDefaults("box-x", T0 + 200), owned("box-x", "hero:tao-thao", T0 + 201)]);
    const body = await ok(h, "alice", [tombstone("box", "box-x", T0 + 100, "box-x")]);
    expect(outcomes(body)).toEqual(["conflict"]);
    expect(body.results[0].server).toMatchObject({ kind: "box", deleted: false });
    expect(countOf(h, "alice", "box_id = 'box-x'")).toBe(3);
    expect(rowOf(h, "alice", "box", "box-x")?.deleted).toBe(0);
  });

  it("16. xóa box:main gửi kèm bản ghi con: main bị rejected, bản ghi con vẫn ghi", async () => {
    const h = createHarness();
    await withMain(h);
    const body = await ok(h, "alice", [tombstone("box", "main", T0 + 10, "main"), owned("main", "hero:tao-thao", T0 + 11)]);
    expect(outcomes(body)).toEqual(["rejected:default_protected", "applied"]);
    expect(rowOf(h, "alice", "box", "main")?.deleted).toBe(0);
    expect(rowOf(h, "alice", "owned", "main~hero:tao-thao")).toBeTruthy();
  });

  it("17. tạo hộp + hai nhóm mặc định + đội trong cùng request (bất kể thứ tự mảng) -> tất cả applied", async () => {
    const h = createHarness();
    const records = [
      team("team-1", "box-x", "box-x~ghep-team", T0 + 1),
      owned("box-x", "hero:tao-thao", T0 + 1),
      group("box-x", "box-x~ghep-team", T0, "Ghép Team", 1),
      group("box-x", "box-x~khai-hoang", T0, "Khai Hoang", 0),
      box("box-x", T0),
    ];
    const body = await ok(h, "alice", records);
    expect(outcomes(body)).toEqual(["applied", "applied", "applied", "applied", "applied"]);
    expect(body.results.map((r) => r.id)).toEqual(records.map((r) => r.id));
  });

  it("18. xóa hộp + ghi bản ghi con cùng request, cả hai thứ tự -> bản con box_missing", async () => {
    for (const childFirst of [true, false]) {
      const h = createHarness();
      await ok(h, "alice", [box("box-x", T0), box("box-y", T0)]);
      const del = tombstone("box", "box-x", T0 + 10, "box-x");
      const child = owned("box-x", "hero:tao-thao", T0 + 11);
      const body = await ok(h, "alice", childFirst ? [child, del] : [del, child]);
      expect(outcomes(body)).toEqual(childFirst ? ["rejected:box_missing", "applied"] : ["applied", "rejected:box_missing"]);
      expect(countOf(h, "alice", "box_id = 'box-x'")).toBe(0);
    }
  });

  it("19. xóa nhóm G có 3 đội sống: đội chuyển sang ghep-team với rev mới riêng từng đội, máy khác kéo về thấy", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [group("main", "grp-g", T0 + 1, "Nhóm G", 2)]);
    await ok(h, "alice", [
      team("team-1", "main", "grp-g", T0 + 2),
      team("team-2", "main", "grp-g", T0 + 3000),
      team("team-3", "main", "grp-g", T0 + 4),
      team("team-other", "main", "main~khai-hoang", T0 + 4),
    ]);
    const before = (await pull(h, "alice", "?since=0")).cursor;
    const del = await ok(h, "alice", [tombstone("group", "grp-g", T0 + 100, "main")]);
    expect(outcomes(del)).toEqual(["applied"]);
    expect(del.results).toHaveLength(1);
    expect(rowOf(h, "alice", "group", "grp-g")?.deleted).toBe(1);
    const moved = await pull(h, "alice", `?since=${before}&kinds=team`);
    expect(moved.records.map((r) => r.id).sort()).toEqual(["team-1", "team-2", "team-3"]);
    const revs = moved.records.map((r) => r.rev);
    expect(new Set(revs).size).toBe(3);
    expect(Math.min(...revs)).toBeGreaterThan(before);
    for (const r of moved.records) expect(r.data.groupId).toBe("main~ghep-team");
    const byId = Object.fromEntries(moved.records.map((r) => [r.id, r]));
    // updatedAt = max(hiện có, mốc xóa nhóm); payload.updatedAt đi theo cột.
    expect(byId["team-1"].updatedAt).toBe(T0 + 100);
    expect(byId["team-1"].data.updatedAt).toBe(iso(T0 + 100));
    expect(byId["team-2"].updatedAt).toBe(T0 + 3000);
    expect(byId["team-2"].data.updatedAt).toBe(iso(T0 + 3000));
    expect(rowOf(h, "alice", "team", "team-other")?.payload).toContain('"groupId":"main~khai-hoang"');
    // Đội đã chuyển vẫn sống và hợp lệ khi gửi lại bản sửa.
    expect(outcomes(await ok(h, "alice", [team("team-1", "main", "main~ghep-team", T0 + 200)]))).toEqual(["applied"]);
  });

  it("20. xóa nhóm đến muộn -> conflict, không đội nào bị chuyển", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [group("main", "grp-g", T0 + 200, "Nhóm G", 2)]);
    await ok(h, "alice", [team("team-1", "main", "grp-g", T0 + 201)]);
    const body = await ok(h, "alice", [tombstone("group", "grp-g", T0 + 100, "main")]);
    expect(outcomes(body)).toEqual(["conflict"]);
    expect(JSON.parse(rowOf(h, "alice", "team", "team-1")?.payload ?? "{}").groupId).toBe("grp-g");
    expect(rowOf(h, "alice", "group", "grp-g")?.deleted).toBe(0);
  });

  it("21. ghi đội vào nhóm đã xóa / nhóm của hộp khác / nhóm không có -> rejected group_missing", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [...boxWithDefaults("box-x", T0), group("main", "grp-g", T0, "G", 2)]);
    await ok(h, "alice", [tombstone("group", "grp-g", T0 + 5, "main")]);
    const body = await ok(h, "alice", [
      team("team-1", "main", "grp-g", T0 + 6),
      team("team-2", "main", "box-x~ghep-team", T0 + 6),
      team("team-3", "main", "grp-khong-co", T0 + 6),
      team("team-4", "main", "main~ghep-team", T0 + 6),
    ]);
    expect(outcomes(body)).toEqual(["rejected:group_missing", "rejected:group_missing", "rejected:group_missing", "applied"]);
  });

  it("22. đổi boxId của nhóm/đội/món đang sống -> rejected box_changed", async () => {
    const h = createHarness();
    await ok(h, "alice", [...boxWithDefaults("main", T0), ...boxWithDefaults("box-x", T0), group("main", "grp-g", T0, "G", 2)]);
    await ok(h, "alice", [team("team-1", "main", "main~ghep-team", T0 + 1)]);
    const body = await ok(h, "alice", [
      group("box-x", "grp-g", T0 + 5, "G", 2),
      team("team-1", "box-x", "box-x~ghep-team", T0 + 5),
      { ...live("season", "main", T0 + 5, { boxId: "box-x", seasonId: "s18" }), id: "main" },
    ]);
    // season id phải bằng boxId nên bản thứ ba hỏng schema; hai bản đầu là box_changed.
    expect(outcomes(body)).toEqual(["rejected:box_changed", "rejected:box_changed", "rejected:schema"]);
    expect(rowOf(h, "alice", "group", "grp-g")?.box_id).toBe("main");
    expect(rowOf(h, "alice", "team", "team-1")?.box_id).toBe("main");
    // Bản xóa cũng không đổi hộp.
    expect(outcomes(await ok(h, "alice", [tombstone("team", "team-1", T0 + 9, "box-x")]))).toEqual(["rejected:box_changed"]);
    expect(rowOf(h, "alice", "team", "team-1")?.deleted).toBe(0);
  });

  it("23. nhóm mặc định không xóa được -> rejected default_protected", async () => {
    const h = createHarness();
    await withMain(h);
    const body = await ok(h, "alice", [
      tombstone("group", "main~khai-hoang", T0 + 5, "main"),
      tombstone("group", "main~ghep-team", T0 + 5, "main"),
    ]);
    expect(outcomes(body)).toEqual(["rejected:default_protected", "rejected:default_protected"]);
    expect(countOf(h, "alice", "deleted = 1")).toBe(0);
  });

  it("24. quota sống 20 000: bản xóa không tính; hồi sinh khi đầy bị rejected quota; xóa và sửa vẫn được", async () => {
    const h = createHarness();
    await withMain(h);
    seed(h, "alice", { kind: "owned", boxId: "main", prefix: "main~hero:seed", n: ROSTER_MAX_LIVE - 3, deleted: 0 });
    expect(countOf(h, "alice", "deleted = 0")).toBe(ROSTER_MAX_LIVE);
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:moi", T0 + 5)]))).toEqual(["rejected:quota"]);
    // Sửa bản đã sống khi đầy: được.
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:seed2", T0 + 5)]))).toEqual(["applied"]);
    expect(outcomes(await ok(h, "alice", [tombstone("owned", "main~hero:seed1", T0 + 10, "main")]))).toEqual(["applied"]);
    expect(countOf(h, "alice", "deleted = 0")).toBe(ROSTER_MAX_LIVE - 1);
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:moi", T0 + 11)]))).toEqual(["applied"]);
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:seed1", T0 + 12)]))).toEqual(["rejected:quota"]);
    expect(rowOf(h, "alice", "owned", "main~hero:seed1")?.deleted).toBe(1);
  });

  it("25. cap 20 hộp / 50 nhóm mỗi hộp / 500 đội: tạo mới, hồi sinh, hai batch đồng thời không vượt cap", async () => {
    const h = createHarness();
    // Hộp: 19 hộp sống (main + 18) -> hai request đồng thời tạo hộp thứ 20: đúng một bản thắng.
    await okChunked(h, "alice", [box("main", T0), ...Array.from({ length: ROSTER_CAPS.box - 2 }, (_, i) => box(`box-${i}`, T0))]);
    expect(countOf(h, "alice", "kind = 'box' and deleted = 0")).toBe(ROSTER_CAPS.box - 1);
    const racing = await Promise.all([push(h, "alice", [box("box-r1", T0 + 1)]), push(h, "alice", [box("box-r2", T0 + 1)])]);
    const raced = (await Promise.all(racing.map((r) => r.json<PushBody>()))).flatMap((b) => outcomes(b)).sort();
    expect(raced).toEqual(["applied", "rejected:cap"]);
    expect(countOf(h, "alice", "kind = 'box' and deleted = 0")).toBe(ROSTER_CAPS.box);
    expect(outcomes(await ok(h, "alice", [box("box-over", T0 + 2)]))).toEqual(["rejected:cap"]);
    // Hồi sinh hộp đã xóa khi đầy cũng bị cap; xóa một hộp thì tạo/hồi sinh lại được.
    await ok(h, "alice", [tombstone("box", "box-0", T0 + 3, "box-0")]);
    expect(outcomes(await ok(h, "alice", [box("box-over", T0 + 4)]))).toEqual(["applied"]);
    expect(outcomes(await ok(h, "alice", [box("box-0", T0 + 5)]))).toEqual(["rejected:cap"]);
    expect(countOf(h, "alice", "kind = 'box' and deleted = 0")).toBe(ROSTER_CAPS.box);

    // Nhóm: 50 mỗi hộp (đếm riêng từng hộp).
    const g = Array.from({ length: ROSTER_CAPS.group }, (_, i) => group("main", `grp-${i}`, T0, `G${i}`, i));
    expect((await okChunked(h, "alice", g)).every((o) => o === "applied")).toBe(true);
    expect(outcomes(await ok(h, "alice", [group("main", "grp-over", T0 + 1)]))).toEqual(["rejected:cap"]);
    expect(outcomes(await ok(h, "alice", [group("box-1", "grp-over", T0 + 1)]))).toEqual(["applied"]);
    await ok(h, "alice", [tombstone("group", "grp-0", T0 + 2, "main")]);
    expect(outcomes(await ok(h, "alice", [group("main", "grp-0", T0 + 3)]))).toEqual(["applied"]);
    expect(outcomes(await ok(h, "alice", [group("main", "grp-over-2", T0 + 4)]))).toEqual(["rejected:cap"]);

    // Đội: 500 mỗi user; hai batch đồng thời tại 499.
    await ok(h, "alice", boxWithDefaults("box-2", T0));
    seed(h, "alice", { kind: "team", boxId: "box-2", prefix: "team-seed", n: ROSTER_CAPS.team - 1, deleted: 0 });
    const t = await Promise.all([
      push(h, "alice", [team("team-r1", "box-2", "box-2~ghep-team", T0 + 1)]),
      push(h, "alice", [team("team-r2", "box-2", "box-2~ghep-team", T0 + 1)]),
    ]);
    const teamOut = (await Promise.all(t.map((r) => r.json<PushBody>()))).flatMap((b) => outcomes(b)).sort();
    expect(teamOut).toEqual(["applied", "rejected:cap"]);
    expect(countOf(h, "alice", "kind = 'team' and deleted = 0")).toBe(ROSTER_CAPS.team);
  });

  it("26. trần giữ lại 40 000 khóa: khóa mới bị rejected retained_cap; sửa/xóa khóa cũ vẫn được", async () => {
    const h = createHarness();
    await withMain(h);
    seed(h, "alice", { kind: "owned", boxId: "main", prefix: "main~hero:old", n: ROSTER_MAX_RETAINED - 4, deleted: 1 });
    expect(countOf(h, "alice")).toBe(ROSTER_MAX_RETAINED - 1);
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:a", T0 + 5)]))).toEqual(["applied"]); // khóa thứ 40 000
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:b", T0 + 5)]))).toEqual(["rejected:retained_cap"]);
    // Xóa/sửa khóa đã có, hồi sinh khóa đã xóa: vẫn được.
    expect(outcomes(await ok(h, "alice", [tombstone("owned", "main~hero:a", T0 + 6, "main")]))).toEqual(["applied"]);
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:a", T0 + 7)]))).toEqual(["applied"]);
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:old1", T0 + 7)]))).toEqual(["applied"]);
    // Luân phiên tạo/xóa khóa mới vẫn không qua trần.
    expect(outcomes(await ok(h, "alice", [owned("main", "hero:c", T0 + 8)]))).toEqual(["rejected:retained_cap"]);
    expect(countOf(h, "alice")).toBe(ROSTER_MAX_RETAINED);
  });

  it("27. bản xóa cho khóa chưa từng tồn tại -> rejected not_found", async () => {
    const h = createHarness();
    await withMain(h);
    const body = await ok(h, "alice", [
      tombstone("owned", "main~hero:chua-co", T0 + 5, "main"),
      tombstone("team", "team-chua-co", T0 + 5, "main"),
      tombstone("box", "box-chua-co", T0 + 5, "box-chua-co"),
    ]);
    expect(outcomes(body)).toEqual(["rejected:not_found", "rejected:not_found", "rejected:not_found"]);
    expect(rowOf(h, "alice", "owned", "main~hero:chua-co")).toBeUndefined();
  });

  it("28. trần byte: đếm byte sau JSON escape, chữ Hán đa byte, tổng data 16 384 B", async () => {
    const h = createHarness();
    await withMain(h);
    const base = teamData("team-1", "main", "main~ghep-team");
    // Tổng `data`: 16 384 B không bị chặn vì byte; 16 385 B thì `bytes` (bản có khóa thừa nên 16 384 chết ở schema).
    const padded = (target: number) => {
      const withPad = { id: "team-1", updatedAt: iso(T0 + 1), deletedAt: "", ...base, pad: "" };
      const need = target - bytes(JSON.stringify(withPad));
      return live("team", "team-1", T0 + 1, { ...base, pad: "x".repeat(need) });
    };
    expect(bytes(JSON.stringify(padded(16_384).data))).toBe(16_384);
    expect(bytes(JSON.stringify(padded(16_385).data))).toBe(16_385);
    expect(outcomes(await ok(h, "alice", [padded(16_384), padded(16_385)]))).toEqual(["rejected:schema", "rejected:bytes"]);
    // Trường chữ: 2 000 B của notes (chữ Hán 3 B, `"` sau escape 2 B).
    const notes = (general: string) => team("team-1", "main", "main~ghep-team", T0 + 2, { notes: { general, strengths: "", goodAgainst: "", avoid: "" } });
    const out = await ok(h, "alice", [
      notes("曹".repeat(666)), // 1 998 B
      { ...notes("曹".repeat(667)), id: "team-2", data: { ...notes("曹".repeat(667)).data, id: "team-2" } }, // 2 001 B
    ]);
    expect(outcomes(out)).toEqual(["applied", "rejected:bytes"]);
    expect(outcomes(await ok(h, "alice", [notes('"'.repeat(1000))].map((r) => ({ ...r, updatedAt: T0 + 3, data: { ...r.data, updatedAt: iso(T0 + 3) } }))))).toEqual(["applied"]);
    const over = notes('"'.repeat(1001));
    expect(outcomes(await ok(h, "alice", [{ ...over, updatedAt: T0 + 4, data: { ...over.data, updatedAt: iso(T0 + 4) } }]))).toEqual(["rejected:bytes"]);
    // name 180 B: 60 chữ Hán qua, 61 chữ Hán không.
    const named = (n: number, id: string, ts: number) => team(id, "main", "main~ghep-team", ts, { name: "曹".repeat(n) });
    expect(outcomes(await ok(h, "alice", [named(60, "team-3", T0 + 5), named(61, "team-4", T0 + 5)]))).toEqual(["applied", "rejected:bytes"]);
    // rawName 80 B và các kind nhỏ (owned name quá 180 B).
    const raw = team("team-5", "main", "main~ghep-team", T0 + 6);
    ((raw.data.heroes as Record<string, unknown>[])[0] as Record<string, unknown>).rawName = "曹".repeat(27); // 81 B
    expect(outcomes(await ok(h, "alice", [raw, owned("main", "hero:dai", T0 + 6, "曹".repeat(61))]))).toEqual(["rejected:bytes", "rejected:bytes"]);
  });

  it("29. source.key chứa javascript: hoặc ký tự ngoài regex -> rejected; khóa hợp lệ qua", async () => {
    const h = createHarness();
    await withMain(h);
    const withKey = (id: string, key: string) =>
      team(id, "main", "main~ghep-team", T0 + 1, { source: { kind: "legacy", key, contentHash: "" } });
    const body = await ok(h, "alice", [
      withKey("team-1", "javascript:alert(1)"),
      withKey("team-2", "a b"),
      withKey("team-3", "<img>"),
      withKey("team-4", "x".repeat(129)),
      withKey("team-5", "doi-khac~bien-the.2"),
      team("team-6", "main", "main~ghep-team", T0 + 1, { source: { kind: "evil", key: "ok", contentHash: "" } }),
    ]);
    expect(outcomes(body)).toEqual(["rejected:schema", "rejected:schema", "rejected:schema", "rejected:bytes", "applied", "rejected:schema"]);
  });

  it("30. rate limit: push 600/giờ, pull 1 200/giờ -> 429, tính theo user", async () => {
    const h = createHarness();
    expect(RATE_RULES.roster_push).toEqual({ limit: 600, windowMs: 3_600_000 });
    expect(RATE_RULES.roster_pull).toEqual({ limit: 1200, windowMs: 3_600_000 });
    for (let i = 0; i < RATE_RULES.roster_push.limit; i++) expect((await push(h, "alice", [])).status).toBe(200);
    const blocked = await push(h, "alice", [box("main", T0)]);
    expect(blocked.status).toBe(429);
    expect((await blocked.json<{ error: { code: string } }>()).error.code).toBe("rate_limited");
    expect((await push(h, "bob", [box("main", T0)])).status).toBe(200);
    expect(countOf(h, "alice")).toBe(0);
    for (let i = 0; i < RATE_RULES.roster_pull.limit; i++) expect((await h.request("/api/roster", { as: "alice" })).status).toBe(200);
    expect((await h.request("/api/roster", { as: "alice" })).status).toBe(429);
    expect((await h.request("/api/roster", { as: "bob" })).status).toBe(200);
  });

  it("31. xóa tài khoản qua đường xóa hiện có -> roster_records của user mất theo cascade", async () => {
    const h = createHarness();
    await withMain(h, "bob");
    await withMain(h, "alice");
    await ok(h, "bob", [owned("main", "hero:tao-thao", T0 + 1), team("team-1", "main", "main~ghep-team", T0 + 1)]);
    expect(countOf(h, "bob")).toBe(5);
    const res = await h.request("/api/admin/users/u-bob", { as: "admin", method: "DELETE", json: { confirmEmail: "bob@example.com" } });
    expect(res.status).toBe(200);
    expect(countOf(h, "bob")).toBe(0);
    expect(countOf(h, "alice")).toBe(3);
  });

  it("M2. lô tối đa ROSTER_MAX_BATCH bản ghi xấu nhất (xóa nhóm = ghi + chẩn đoán + MOVE_TEAMS) dưới trần 50 câu D1 mỗi lần gọi của gói Free", async () => {
    const h = createHarness();
    await withMain(h);
    seed(h, "alice", { kind: "group", boxId: "main", prefix: "grp-g", n: ROSTER_MAX_BATCH, deleted: 0 });
    // Đếm mọi câu D1 của request: câu chạy riêng (first/all/run/raw) và từng câu trong batch().
    let queries = 0;
    const db = h.env.DB as unknown as Record<string, unknown>;
    const countStatement = (stmt: object): object =>
      new Proxy(stmt, {
        get(target, prop) {
          const value = Reflect.get(target, prop) as unknown;
          if (typeof value !== "function") return value;
          if (prop === "bind") return (...args: unknown[]) => countStatement((value as (...a: unknown[]) => object).apply(target, args));
          if (prop === "first" || prop === "all" || prop === "run" || prop === "raw") {
            return (...args: unknown[]) => {
              queries += 1;
              return (value as (...a: unknown[]) => unknown).apply(target, args);
            };
          }
          return (value as (...a: unknown[]) => unknown).bind(target);
        },
      });
    const prepare = (db.prepare as (sql: string) => object).bind(db);
    const batch = (db.batch as (stmts: unknown[]) => Promise<unknown>).bind(db);
    db.prepare = (sql: string) => countStatement(prepare(sql));
    db.batch = (stmts: unknown[]) => {
      queries += stmts.length;
      return batch(stmts);
    };
    const records = Array.from({ length: ROSTER_MAX_BATCH }, (_, i) => tombstone("group", `grp-g${i + 1}`, T0 + 10, "main"));
    const body = await ok(h, "alice", records);
    expect(outcomes(body).filter((o) => o !== "applied")).toEqual([]);
    // Harness đọc phiên bằng 1 câu; Better Auth thật có thể tốn thêm (đọc session, user, gia hạn phiên): chừa 4 câu.
    const BETTER_AUTH_EXTRA = 4;
    expect(queries + BETTER_AUTH_EXTRA).toBeLessThanOrEqual(D1_FREE_QUERIES_PER_INVOCATION);
  });

  it("L3. câu ghi bị bỏ qua không rõ lý do: trả conflict kèm bản đang lưu (200), không phải 500", async () => {
    const h = createHarness();
    await withMain(h);
    await ok(h, "alice", [owned("main", "hero:tao-thao", T0 + 5)]);
    const db = h.env.DB as unknown as { batch: (stmts: unknown[]) => Promise<unknown>; prepare: (sql: string) => unknown };
    const batch = db.batch.bind(db);
    db.batch = (stmts) => {
      stmts[0] = db.prepare("select 1 as x"); // câu ghi không ghi gì, không có lý do nào trong chẩn đoán
      return batch(stmts);
    };
    const res = await push(h, "alice", [owned("main", "hero:tao-thao", T0 + 9, "Tào Tháo mới")]);
    expect(res.status).toBe(200);
    const body = await res.json<PushBody>();
    expect(body.results[0].outcome).toBe("conflict");
    expect(body.results[0].server).toMatchObject({ kind: "owned", id: "main~hero:tao-thao", updatedAt: T0 + 5 });
  });

  it("L4. data lồng quá sâu -> rejected schema (200), không RangeError/500", async () => {
    const h = createHarness();
    await withMain(h);
    const rec = owned("main", "hero:tao-thao", T0 + 1);
    const depth = 20_000;
    // JSON.stringify của chính test cũng tràn ngăn xếp ở độ sâu này: dựng thân JSON bằng chuỗi.
    const nested = `${'{"a":'.repeat(depth)}"x"${"}".repeat(depth)}`;
    const body = `{"expectedUserId":"u-alice","records":[${JSON.stringify(rec).replace(/"name":"[^"]*"/u, `"name":${nested}`)}]}`;
    const res = await h.request("/api/roster", { as: "alice", body, headers: { "content-type": "application/json" } });
    expect(res.status).toBe(200);
    expect(outcomes(await res.json<PushBody>())).toEqual(["rejected:schema"]);
  });

  it("L5. câu chẩn đoán không bind lại payload (tối đa 16 KiB) của đội", async () => {
    const h = createHarness();
    await withMain(h);
    const db = h.env.DB as unknown as { batch: (stmts: { sql: string; params: unknown[] }[]) => Promise<unknown> };
    const batch = db.batch.bind(db);
    const diag: { sql: string; params: unknown[] }[] = [];
    db.batch = (stmts) => {
      diag.push(...stmts.filter((s) => s.sql.includes("left join roster_records r")));
      return batch(stmts);
    };
    await ok(h, "alice", [team("team-1", "main", "main~ghep-team", T0 + 2)]);
    expect(diag).toHaveLength(1);
    expect(diag[0].params.some((p) => typeof p === "string" && p.startsWith("{"))).toBe(false);
  });

  // ---- ngoài ma trận: cấu trúc thân, id, ký tự điều khiển ----
  it("thân sai cấu trúc -> 400; since sai -> 400; id/ký tự điều khiển/khóa lạ từng bản -> rejected schema", async () => {
    const h = createHarness();
    await withMain(h);
    for (const json of [
      { expectedUserId: "u-alice" },
      { expectedUserId: "u-alice", records: {} },
      { records: [] },
      { expectedUserId: "u-alice", records: Array.from({ length: ROSTER_MAX_BATCH + 1 }, () => 1) },
    ]) {
      expect((await h.request("/api/roster", { as: "alice", json })).status).toBe(400);
    }
    expect((await h.request("/api/roster", { as: "alice", body: "{", headers: { "content-type": "application/json" } })).status).toBe(400);
    expect((await h.request("/api/roster?since=abc", { as: "alice" })).status).toBe(400);
    const lineBreak = owned("main", "hero:tao-thao", T0 + 1, "Tào\nTháo\tx");
    const control = owned("main", "hero:luu-bi", T0 + 1, "Lưu\u0007Bị");
    const upper = { ...owned("main", "hero:ton-quyen", T0 + 1), id: "main~Hero:ton-quyen" };
    const extra = owned("main", "hero:chu-du", T0 + 1);
    extra.data.sneaky = "x";
    const badTime = owned("main", "hero:gia-cat", T0 + 1);
    badTime.data.updatedAt = iso(T0 + 2);
    const stars = live("owned", "main~hero:quan-vu", T0 + 1, { boxId: "main", item: "hero:quan-vu", name: "Quan Vũ", type: "hero", redStars: 6 });
    const body = await ok(h, "alice", [lineBreak, control, upper, extra, badTime, stars, "not-an-object" as unknown as Wire]);
    expect(outcomes(body)).toEqual(["applied", "rejected:schema", "rejected:schema", "rejected:schema", "rejected:schema", "rejected:schema", "rejected:schema"]);
    expect(body.results[6]).toMatchObject({ kind: null, id: null });
  });

  it("override/locked với CJK + tiếng Việt: id dùng SHA-256(teamId) 16 hex; sai hash hoặc id thô -> rejected schema", async () => {
    const h = createHarness();
    await withMain(h);
    const keyOf = async (text: string) =>
      [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16);
    const teamId = "yxms-010-周劭蜀弓";
    const key = await keyOf(teamId);
    const ovr = (id: string, extra: Record<string, unknown> = {}) =>
      live("override", id, T0 + 1, { boxId: "main", teamId, heroIndex: 0, slotIndex: 1, tactic: "Thần Tốc 疾风", ...extra });
    const lockKey = await keyOf("khóa-周");
    const lockedRec = live("locked", `main~${lockKey}`, T0 + 1, {
      boxId: "main",
      teamId,
      configId: teamId,
      teamName: "Đội 周劭蜀弓",
      heroes: ["Chu Thiệu 周劭", "Tào Tháo"],
      tactics: ["Thần Tốc 疾风"],
      seasonContext: { scenarioId: "mùa-一", rulesetId: "luật-二" },
    });
    const body = await ok(h, "alice", [
      ovr(`main~${key}~0~1`),
      ovr(`main~${await keyOf("khác")}~0~1`),
      ovr(`main~${teamId}~0~1`),
      lockedRec,
    ]);
    expect(outcomes(body)).toEqual(["applied", "rejected:schema", "rejected:schema", "applied"]);
    const page = await pull(h, "alice", "?since=0");
    const got = page.records.find((r) => r.kind === "override");
    expect(got?.id).toBe(`main~${key}~0~1`);
    expect(got?.data).toMatchObject({ teamId, tactic: "Thần Tốc 疾风" });
  });
});
