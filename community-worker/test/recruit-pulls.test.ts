import { describe, expect, it } from "vitest";
// @ts-expect-error -- module JS thuần của trang (không có .d.ts); test dùng để kiểm event server dựng hợp lệ với store v2.
import { createDefaultRecruitTrackerState, getFiveStarHistory, getRecruitTrackerSummary, mergeRecruitRecords } from "../../js/recruit-tracker-store.js";
import { RATE_RULES } from "../src/ratelimit";
import { createHarness, type Harness } from "./fakes";

interface WireRecord {
  kind: string;
  id: string;
  updatedAt: number;
  data: Record<string, unknown>;
}
interface PullsBody {
  accepted: number;
  duplicates: number;
  events: { key: string; id: string; date: string }[];
  daily: { date: string; used: number; limit: number };
  cursor: number;
  error: { code: string };
}

const T0 = Date.UTC(2026, 8, 27, 3, 0, 0); // 10:00 giờ VN

function account(id: string, name: string, extra: Record<string, unknown> = {}): WireRecord {
  const iso = new Date(T0).toISOString();
  return { kind: "account", id, updatedAt: T0, data: { id, name, createdAt: iso, updatedAt: iso, deletedAt: "", ...extra } };
}

async function seed(h: Harness, records: WireRecord[], as = "alice") {
  const res = await h.request("/api/recruit", { as, json: { records } });
  expect(res.status).toBe(200);
}

async function newToken(h: Harness, as = "alice", json: unknown = { name: "tqkh" }): Promise<{ token: string; id: string }> {
  const res = await h.request("/api/tokens", { as, json });
  expect(res.status).toBe(201);
  const body = await res.json<{ token: string; item: { id: string } }>();
  return { token: body.token, id: body.item.id };
}

/** Request như tool ngoài trình duyệt: không Origin, không cookie. */
async function send(h: Harness, token: string, json: unknown, headers: Record<string, string> = {}) {
  return h.request("/api/recruit/pulls", { json, headers: { origin: "", authorization: `Bearer ${token}`, ...headers } });
}

const pull = (key: string, at: number, extra: Record<string, unknown> = {}) => ({ key, at: new Date(at).toISOString(), fiveStar: false, ...extra });
const body = (pulls: unknown[], extra: Record<string, unknown> = {}) => ({ accountName: "HLxThanos", banner: "danh-tuong-pk", pulls, ...extra });

async function serverEvents(h: Harness, as = "alice"): Promise<WireRecord[]> {
  const res = await h.request("/api/recruit", { as });
  return (await res.json<{ records: WireRecord[] }>()).records.filter((r) => r.kind === "event");
}

async function setup(): Promise<{ h: Harness; token: string; tokenId: string }> {
  const h = createHarness();
  h.clock.now = T0 + 60_000;
  await seed(h, [account("acc_thanos", "HLxThanos"), account("acc_long", "HLxThanhLong")]);
  const { token, id } = await newToken(h);
  return { h, token, tokenId: id };
}

describe("POST /api/recruit/pulls (token API)", () => {
  it("ghi lượt free + nửa giá thành event schema v2; client gộp được, 5★ có tên, lượt không ra không ghi tên", async () => {
    const { h, token } = await setup();
    const res = await send(h, token, body([pull("cycle1-free", T0), pull("cycle1-half", T0 + 9000, { fiveStar: true, hero: "Tào Tháo", heroValueClass: "Chủ lực" })]));
    expect(res.status).toBe(200);
    const out = await res.json<PullsBody>();
    expect(out).toMatchObject({
      accepted: 2,
      duplicates: 0,
      events: [
        { key: "cycle1-free", id: "evt_ext_cycle1-free", date: "2026-09-27" },
        { key: "cycle1-half", id: "evt_ext_cycle1-half", date: "2026-09-27" },
      ],
      daily: { date: "2026-09-27", used: 2, limit: 4 },
    });
    const events = await serverEvents(h);
    expect(events.map((e) => e.data)).toEqual([
      {
        id: "evt_ext_cycle1-free",
        accountId: "acc_thanos",
        bannerId: "danh-tuong-pk",
        date: "2026-09-27",
        drawKind: "daily",
        pulls: 1,
        result: "miss",
        heroName: "",
        heroValueClass: "",
        note: "",
        occurredAt: new Date(T0).toISOString(),
        createdAt: new Date(T0).toISOString(),
        updatedAt: new Date(h.clock.now).toISOString(),
        deletedAt: "",
      },
      expect.objectContaining({ id: "evt_ext_cycle1-half", result: "fiveStar", heroName: "Tào Tháo", heroValueClass: "Chủ lực", note: "" }),
    ]);
    expect(out.cursor).toBe(4); // 2 tài khoản + 2 event, rev tăng dần theo user

    // Trình duyệt kéo về và gộp: hai lượt đều hợp lệ với store v2.
    const state = mergeRecruitRecords(createDefaultRecruitTrackerState(), [account("acc_thanos", "HLxThanos"), ...events], { now: h.clock.now });
    expect(state.pullEvents).toHaveLength(2);
    expect(getFiveStarHistory(state).map((row: { heroName: string; pullCount: number }) => [row.heroName, row.pullCount])).toEqual([["Tào Tháo", 2]]);
    const summary = getRecruitTrackerSummary(state, { accountId: "acc_thanos", date: "2026-09-27" });
    expect(summary.daily).toMatchObject({ todayDone: 2, remainingToday: 2, pity: { pullsSinceFiveStar: 0 } });
  });

  it("5★ không ghi phân loại -> mặc định 'Chưa phân loại'", async () => {
    const { h, token } = await setup();
    expect((await send(h, token, body([pull("k-five-01", T0, { fiveStar: true, hero: "Lưu Bị" })]))).status).toBe(200);
    expect((await serverEvents(h))[0].data).toMatchObject({ heroName: "Lưu Bị", heroValueClass: "Chưa phân loại" });
  });

  it("lượt cùng `at` trong một lô vẫn giữ thứ tự (occurredAt +1 ms)", async () => {
    const { h, token } = await setup();
    await send(h, token, body([pull("same-at-1", T0), pull("same-at-2", T0)]));
    expect((await serverEvents(h)).map((e) => e.data.occurredAt)).toEqual([new Date(T0).toISOString(), new Date(T0 + 1).toISOString()]);
  });

  it("gửi lại cùng key -> duplicates, không ghi lại (kể cả event đã bị xoá trên UI)", async () => {
    const { h, token } = await setup();
    await send(h, token, body([pull("retry-key-1", T0)]));
    const [first] = await serverEvents(h);
    // User xoá trên UI: event mang deletedAt, updatedAt mới hơn.
    const later = T0 + 120_000;
    await seed(h, [{ ...first, updatedAt: later, data: { ...first.data, updatedAt: new Date(later).toISOString(), deletedAt: new Date(later).toISOString() } }]);
    h.clock.now = later + 1000;
    const res = await send(h, token, body([pull("retry-key-1", T0), pull("retry-key-2", T0 + 5000)]));
    expect(await res.json<PullsBody>()).toMatchObject({ accepted: 1, duplicates: 1, daily: { used: 1 } });
    const events = await serverEvents(h);
    expect(events.find((e) => e.id === "evt_ext_retry-key-1")?.data.deletedAt).not.toBe("");
  });

  it("vượt 4 lượt rẻ/ngày/tài khoản (tính cả lượt ghi trên web) -> 409, không ghi gì của lô", async () => {
    const { h, token } = await setup();
    const iso = new Date(T0 - 3_600_000).toISOString();
    await seed(h, [
      {
        kind: "event",
        id: "evt_web",
        updatedAt: T0 - 3_600_000,
        data: { id: "evt_web", accountId: "acc_thanos", bannerId: "danh-tuong-pk", date: "2026-09-27", drawKind: "daily", pulls: 2, result: "miss", heroName: "", heroValueClass: "", note: "", occurredAt: iso, createdAt: iso, updatedAt: iso, deletedAt: "" },
      },
    ]);
    const over = await send(h, token, body([pull("over-key-1", T0), pull("over-key-2", T0 + 1), pull("over-key-3", T0 + 2)]));
    expect(over.status).toBe(409);
    expect((await over.json<PullsBody>()).error.code).toBe("daily_limit");
    expect((await serverEvents(h)).map((e) => e.id)).toEqual(["evt_web"]);
    // Tài khoản khác, ngày khác không bị ảnh hưởng; đủ đúng 4 thì nhận.
    expect((await send(h, token, body([pull("fill-key-1", T0), pull("fill-key-2", T0 + 1)]))).status).toBe(200);
    expect((await send(h, token, body([pull("long-key-1", T0)], { accountName: "HLxThanhLong" }))).status).toBe(200);
    expect((await send(h, token, body([pull("next-day", T0 + 86_400_000)]))).status).toBe(200);
    expect((await send(h, token, body([pull("fifth-key", T0 + 3)]))).status).toBe(409);
  });

  it("event cùng key xuất hiện giữa lúc kiểm và lúc ghi (vd đã xoá trên UI) -> duplicate, không ghi đè", async () => {
    const { h, token } = await setup();
    const iso = new Date(T0).toISOString();
    const tombstone = JSON.stringify({ id: "evt_ext_race-key-1", accountId: "acc_thanos", bannerId: "danh-tuong-pk", date: "2026-09-27", drawKind: "daily", pulls: 1, result: "miss", heroName: "", heroValueClass: "", note: "", occurredAt: iso, createdAt: iso, updatedAt: iso, deletedAt: iso });
    h.beforeNextBatch(() => {
      h.sqlite.prepare("insert into recruit_records (user_id, kind, id, updated_at, rev, payload) values ('u-alice', 'event', 'evt_ext_race-key-1', ?, 99, ?)").run(T0, tombstone);
    });
    const res = await send(h, token, body([pull("race-key-1", T0), pull("race-key-2", T0 + 1)]));
    expect(res.status).toBe(200);
    const out = await res.json<Omit<PullsBody, "events"> & { events: { duplicate: boolean }[] }>();
    expect(out).toMatchObject({ accepted: 1, duplicates: 1 });
    expect(out.events.map((e) => e.duplicate)).toEqual([true, false]);
    const row = h.sqlite.prepare("select rev, payload from recruit_records where id = 'evt_ext_race-key-1'").get() as { rev: number; payload: string };
    expect(row).toEqual({ rev: 99, payload: tombstone });
  });

  it("lô khác ghi cùng tài khoản/ngày giữa lúc kiểm và lúc ghi: không vượt 4, lô này 409 và không ghi gì; gửi lại lô đã nhận vẫn 200", async () => {
    const { h, token } = await setup();
    const accepted = [pull("other-001", T0), pull("other-002", T0 + 1)];
    expect((await send(h, token, body(accepted))).status).toBe(200);
    const iso = new Date(T0).toISOString();
    // Lô song song (client khác) commit 1 lượt sau khi lô dưới đã qua bước kiểm sớm.
    h.beforeNextBatch(() => {
      const data = { id: "evt_other", accountId: "acc_thanos", bannerId: "danh-tuong-pk", date: "2026-09-27", drawKind: "daily", pulls: 1, result: "miss", heroName: "", heroValueClass: "", note: "", occurredAt: iso, createdAt: iso, updatedAt: iso, deletedAt: "" };
      h.sqlite.prepare("insert into recruit_records (user_id, kind, id, updated_at, rev, payload) values ('u-alice', 'event', 'evt_other', ?, 50, ?)").run(T0, JSON.stringify(data));
    });
    const res = await send(h, token, body([pull("late-001", T0 + 2), pull("late-002", T0 + 3)]));
    expect(res.status).toBe(409);
    expect((await res.json<PullsBody>()).error.code).toBe("daily_limit");
    expect((await serverEvents(h)).map((e) => e.id).sort()).toEqual(["evt_ext_other-001", "evt_ext_other-002", "evt_other"]);
    // Ngày đã đủ 3 lượt, nhưng gửi lại lô đã nhận (toàn trùng) không bị chặn.
    const retry = await send(h, token, body(accepted));
    expect(retry.status).toBe(200);
    expect(await retry.json<PullsBody>()).toMatchObject({ accepted: 0, duplicates: 2, daily: { used: 3 } });
  });

  it("gửi lại lô đã nhận khi ngày đã vượt 4 (ghi từ web) vẫn 200, không ghi gì", async () => {
    const { h, token } = await setup();
    const lot = [pull("retry-full-1", T0)];
    expect((await send(h, token, body(lot))).status).toBe(200);
    const iso = new Date(T0).toISOString();
    await seed(h, [
      { kind: "event", id: "evt_web_many", updatedAt: T0, data: { id: "evt_web_many", accountId: "acc_thanos", bannerId: "danh-tuong-pk", date: "2026-09-27", drawKind: "daily", pulls: 4, result: "miss", heroName: "", heroValueClass: "", note: "", occurredAt: iso, createdAt: iso, updatedAt: iso, deletedAt: "" } },
    ]);
    const retry = await send(h, token, body(lot));
    expect(retry.status).toBe(200);
    expect(await retry.json<PullsBody>()).toMatchObject({ accepted: 0, duplicates: 1, daily: { used: 5 } });
  });

  it("ngày theo timeZone, mặc định Asia/Ho_Chi_Minh; timeZone lạ -> 400", async () => {
    const { h, token } = await setup();
    const evening = Date.UTC(2026, 8, 27, 17, 30, 0); // 00:30 ngày 28 giờ VN
    const vn = await send(h, token, body([pull("tz-default", evening)]));
    expect((await vn.json<PullsBody>()).events[0].date).toBe("2026-09-28");
    const utc = await send(h, token, body([pull("tz-utc-key", evening)], { timeZone: "UTC" }));
    expect((await utc.json<PullsBody>()).events[0].date).toBe("2026-09-27");
    const bad = await send(h, token, body([pull("tz-bad-key", evening)], { timeZone: "Mars/Olympus" }));
    expect(bad.status).toBe(400);
  });

  it("tài khoản theo tên: khớp chính xác (trim, NFC), bỏ tài khoản đã xoá; không có -> 404; trùng tên -> 409", async () => {
    const { h, token } = await setup();
    await seed(h, [account("acc_ho", "HLxHắcHổ"), account("acc_old", "CầnVươngz", { deletedAt: new Date(T0).toISOString() })]);
    const nfd = "HLxHắcHổ".normalize("NFD");
    expect((await send(h, token, body([pull("nfd-name", T0)], { accountName: ` ${nfd} ` }))).status).toBe(200);
    expect((await serverEvents(h))[0].data.accountId).toBe("acc_ho");
    const missing = await send(h, token, body([pull("deleted-acc", T0)], { accountName: "CầnVươngz" }));
    expect(missing.status).toBe(404);
    expect((await missing.json<PullsBody>()).error.code).toBe("account_not_found");
    expect((await send(h, token, body([pull("lower-case", T0)], { accountName: "hlxthanos" }))).status).toBe(404);
    await seed(h, [account("acc_dup", "HLxThanos")]);
    const dup = await send(h, token, body([pull("dup-name", T0)]));
    expect(dup.status).toBe(409);
    expect((await dup.json<PullsBody>()).error.code).toBe("account_ambiguous");
  });

  it.each([
    ["banner khác", body([pull("k-banner-1", T0)], { banner: "gioi-han" })],
    ["thiếu pulls", body([])],
    ["quá 4 lượt", body([1, 2, 3, 4, 5].map((i) => pull(`k-many-${i}`, T0 + i)))],
    ["key ngắn", body([pull("short", T0)])],
    ["key ký tự lạ", body([pull("có dấu cách", T0)])],
    ["key trùng trong lô", body([pull("same-key-1", T0), pull("same-key-1", T0 + 1)])],
    ["at sai", body([{ key: "k-at-bad-1", at: "hôm qua", fiveStar: false }])],
    ["5★ thiếu tên", body([pull("k-hero-01", T0, { fiveStar: true })])],
    ["tên tướng quá dài", body([pull("k-hero-02", T0, { fiveStar: true, hero: "x".repeat(41) })])],
    ["phân loại lạ", body([pull("k-class-1", T0, { fiveStar: true, hero: "Lưu Bị", heroValueClass: "Top" })])],
    ["fiveStar không phải boolean", body([pull("k-bool-01", T0, { fiveStar: "yes" })])],
    ["thiếu accountName", { banner: "danh-tuong-pk", pulls: [pull("k-acc-001", T0)] }],
  ])("body không hợp lệ -> 400 (%s)", async (_label, json) => {
    const { h, token } = await setup();
    expect((await send(h, token, json)).status).toBe(400);
    expect(await serverEvents(h)).toEqual([]);
  });

  it("token sai/thiếu/thu hồi/hết hạn -> 401; user bị khoá -> 403", async () => {
    const { h, token, tokenId } = await setup();
    const ok = body([pull("auth-key-1", T0)]);
    expect((await h.request("/api/recruit/pulls", { json: ok, headers: { origin: "" } })).status).toBe(401);
    expect((await send(h, "tqccl_pat_" + "A".repeat(43), ok)).status).toBe(401);
    expect((await send(h, "khong-dung-dinh-dang", ok)).status).toBe(401);

    h.sqlite.prepare("update \"user\" set banned_until = ? where id = 'u-alice'").run(h.clock.now + 60_000);
    const banned = await send(h, token, ok);
    expect(banned.status).toBe(403);
    expect((await banned.json<PullsBody>()).error.code).toBe("account_blocked");
    h.sqlite.prepare("update \"user\" set banned_until = null where id = 'u-alice'").run();

    expect((await h.request(`/api/tokens/${tokenId}`, { as: "alice", method: "DELETE" })).status).toBe(200);
    expect((await send(h, token, ok)).status).toBe(401);

    const short = await newToken(h, "alice", { name: "ngắn", expiresInDays: 30 });
    expect((await send(h, short.token, ok)).status).toBe(200);
    h.clock.now += 30 * 86_400_000;
    expect((await send(h, short.token, body([pull("auth-key-2", T0)]))).status).toBe(401);
  });

  it("chỉ /pulls nhận Bearer: cookie trên /pulls -> 401, Bearer trên /api/recruit -> 401", async () => {
    const { h, token } = await setup();
    expect((await h.request("/api/recruit/pulls", { as: "alice", json: body([pull("cookie-only", T0)]) })).status).toBe(401);
    const raw = await h.request("/api/recruit", { headers: { origin: "", authorization: `Bearer ${token}` } });
    expect(raw.status).toBe(401);
    expect(await serverEvents(h)).toEqual([]);
  });

  it("Bearer không cần Origin; Bearer kèm cookie phiên + Origin lạ vẫn bị chặn CSRF", async () => {
    const { h, token } = await setup();
    expect((await send(h, token, body([pull("evil-origin", T0)]), { origin: "https://evil.example", "sec-fetch-site": "cross-site" })).status).toBe(200);
    const withCookie = await send(h, token, body([pull("with-cookie", T0 + 1)]), {
      origin: "https://evil.example",
      cookie: "__Secure-better-auth.session_token=abc",
    });
    expect(withCookie.status).toBe(403);
    expect((await serverEvents(h)).map((e) => e.id)).toEqual(["evt_ext_evil-origin"]);
  });

  it("token của bob chỉ ghi vào tracker của bob", async () => {
    const { h } = await setup();
    await seed(h, [account("acc_b", "HLxThanos")], "bob");
    const bob = await newToken(h, "bob");
    expect((await send(h, bob.token, body([pull("bob-key-1", T0)]))).status).toBe(200);
    expect(await serverEvents(h, "alice")).toEqual([]);
    expect((await serverEvents(h, "bob"))[0].data.accountId).toBe("acc_b");
  });

  it("cập nhật last_used_at của token (nền)", async () => {
    const { h, token, tokenId } = await setup();
    await send(h, token, body([pull("used-key-1", T0)]));
    await h.settle();
    const row = h.sqlite.prepare("select last_used_at from api_tokens where id = ?").get(tokenId) as { last_used_at: number };
    expect(row.last_used_at).toBe(h.clock.now);
  });

  it("rate limit theo user", async () => {
    const { h, token } = await setup();
    const { limit } = RATE_RULES.recruit_token_push;
    for (let i = 0; i < limit; i++) expect((await send(h, token, body([pull("rate-key-0", T0)]))).status).toBe(200);
    expect((await send(h, token, body([pull("rate-key-1", T0)]))).status).toBe(429);
  });
});
