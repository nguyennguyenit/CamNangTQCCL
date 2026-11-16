import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG_COOLDOWN_MS, CATALOG_DEADLINE_MS, CATALOG_TTL_MS } from "../src/season-catalog";
import { catalogFiles, createHarness, DEFAULT_CATALOG, seasonOption, serveCatalog, type ApiJson, type Harness } from "./fakes";

// Kiểm qua route công khai GET /api/community-seasons (dùng loadSeasonCatalog) và POST đội (dùng findSeason) ở test route.
let h: Harness;
beforeEach(() => {
  h = createHarness();
});

const seasons = async () => {
  const res = await h.request("/api/community-seasons");
  return { status: res.status, body: await res.json<ApiJson & { current: string; seasons: { id: string; code: string; labelVi: string; labelZh: string }[] }>() };
};

/** Bộ file catalog với một file bị sửa (giữ nguyên hash ở các file khác). */
function tampered(name: "current.json" | "manifest.json" | "seasons.json", edit: (json: Record<string, unknown>) => unknown) {
  const files = catalogFiles(DEFAULT_CATALOG);
  const key = [...files.keys()].find((k) => k.endsWith(name))!;
  const json = JSON.parse(new TextDecoder().decode(files.get(key))) as Record<string, unknown>;
  files.set(key, new TextEncoder().encode(JSON.stringify(edit(json) ?? json)));
  return files;
}

describe("catalog mùa: đường đúng", () => {
  it("trả mùa theo thứ tự seasonOptions, current = defaultSourceSeasonId (khác phần tử đầu), nhãn có mã mùa", async () => {
    const { status, body } = await seasons();
    expect(status).toBe(200);
    expect(body.current).toBe("pk-s27");
    expect(body.seasons.map((s) => s.id)).toEqual(["og-兵演春秋", "pk-s27", "pk-s5", "s1", "s0", "s2"]);
    expect(body.seasons[2]).toEqual({ id: "pk-s5", code: "PK-S5", labelVi: "PK-S5 · Mùa pk-s5", labelZh: "PK-S5 · 赛季pk-s5" });
  });

  it("displayNameVi null -> nhãn Việt dùng nameRaw", async () => {
    h.catalog = { options: [{ ...seasonOption("s1"), displayNameVi: null }], defaultId: "s1" };
    expect((await seasons()).body.seasons[0]).toMatchObject({ labelVi: "S1 · 赛季s1", labelZh: "S1 · 赛季s1" });
  });
});

describe("catalog mùa: dữ liệu sai -> 503 (không đoán)", () => {
  const BAD: [string, () => Map<string, Uint8Array>][] = [
    ["sha256 manifest sai", () => tampered("manifest.json", (m) => ({ ...m, extra: 1 }))],
    ["seasons.json bị sửa (sai sha256/bytes)", () => tampered("seasons.json", (s) => ({ ...s, defaultSourceSeasonId: "s1" }))],
    ["current.json sai schemaVersion", () => tampered("current.json", (p) => ({ ...p, schemaVersion: 2 }))],
  ];
  for (const [name, files] of BAD) {
    it(name, async () => {
      const bad = files();
      h.catalogHandler = (url) => serveCatalog(bad, url);
      const { status, body } = await seasons();
      expect(status).toBe(503);
      expect(body.error.code).toBe("season_catalog_unavailable");
    });
  }

  const BAD_OPTIONS: [string, Record<string, unknown>[], string][] = [
    ["seasonOptions rỗng", [], "s1"],
    ["id trùng", [seasonOption("s1"), seasonOption("s1")], "s1"],
    ["id dài hơn 40", [seasonOption("a".repeat(41))], "a".repeat(41)],
    ["id bắt đầu bằng gạch ngang", [seasonOption("-x")], "-x"],
    ["id chữ hoa", [seasonOption("S1")], "S1"],
    ["id 'all'", [seasonOption("all")], "all"],
    ["default không thuộc danh sách", [seasonOption("s1")], "s9"],
  ];
  for (const [name, options, defaultId] of BAD_OPTIONS) {
    it(name, async () => {
      h.catalog = { options, defaultId };
      expect((await seasons()).status).toBe(503);
    });
  }

  it("manifest sai generationId / dedupKeyVersion", async () => {
    for (const edit of [(m: Record<string, unknown>) => ({ ...m, generationId: "b".repeat(64) }), (m: Record<string, unknown>) => ({ ...m, dedupKeyVersion: 2 })]) {
      const files = tampered("manifest.json", edit);
      // Ghim lại manifestSha256 cho khớp manifest đã sửa để chỉ còn lỗi định danh.
      const manifestKey = [...files.keys()].find((k) => k.endsWith("manifest.json"))!;
      const digest = await crypto.subtle.digest("SHA-256", files.get(manifestKey)!);
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const pin = JSON.parse(new TextDecoder().decode(files.get("current.json"))) as Record<string, unknown>;
      files.set("current.json", new TextEncoder().encode(JSON.stringify({ ...pin, manifestSha256: hex })));
      h = createHarness();
      h.catalogHandler = (url) => serveCatalog(files, url);
      expect((await seasons()).status).toBe(503);
    }
  });

  it("JSON hỏng và HTTP 500", async () => {
    h.catalogHandler = () => new Response("{not json", { status: 200 });
    expect((await seasons()).status).toBe(503);
    h = createHarness();
    h.catalogHandler = () => new Response("boom", { status: 500 });
    expect((await seasons()).status).toBe(503);
  });
});

describe("catalog mùa: deadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("site treo quá hạn chót -> 503 (fetch bị abort)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let aborted = false;
    // tsconfig lib chưa có Promise.withResolvers.
    h.catalogHandler = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        });
      });
    const pending = seasons();
    await vi.advanceTimersByTimeAsync(CATALOG_DEADLINE_MS);
    expect((await pending).status).toBe(503);
    expect(aborted).toBe(true);
  });
});

describe("catalog mùa: cache", () => {
  it("trong TTL không fetch lại; hết TTL đọc generation mới", async () => {
    await seasons();
    const after = h.catalogFetches;
    await seasons();
    expect(h.catalogFetches).toBe(after);
    h.catalog = { options: [...DEFAULT_CATALOG.options, seasonOption("pk-s29")], defaultId: "pk-s29", generationId: "c".repeat(64) };
    h.clock.now += CATALOG_TTL_MS;
    const { body } = await seasons();
    expect(body.current).toBe("pk-s29");
  });

  it("hết TTL mà refresh lỗi -> giữ bản cũ", async () => {
    await seasons();
    h.catalogHandler = () => new Response("down", { status: 503 });
    h.clock.now += CATALOG_TTL_MS;
    const { status, body } = await seasons();
    expect(status).toBe(200);
    expect(body.current).toBe("pk-s27");
  });

  it("chưa có bản + lỗi -> 503; trong cooldown không fetch lại; hết cooldown thử lại", async () => {
    h.catalogHandler = () => new Response("down", { status: 500 });
    expect((await seasons()).status).toBe(503);
    const after = h.catalogFetches;
    expect((await seasons()).status).toBe(503);
    expect(h.catalogFetches).toBe(after);
    h.catalogHandler = null;
    h.clock.now += CATALOG_COOLDOWN_MS;
    expect((await seasons()).status).toBe(200);
  });

  it("hai request đồng thời -> một lượt fetch chuỗi (3 file)", async () => {
    const [a, b] = await Promise.all([seasons(), seasons()]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(h.catalogFetches).toBe(3);
  });
});
