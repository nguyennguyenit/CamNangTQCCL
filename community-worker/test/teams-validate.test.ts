import { describe, expect, it } from "vitest";
import { ApiError, decodeCursor, paginateByKey } from "../src/http";
import {
  heroKey,
  parseHeroFilter,
  parseSeasonFilter,
  parseSeasonInput,
  parseTeamInput,
  parseTeamSort,
  parseVote,
  SEASON_ID_RE,
} from "../src/teams-validate";
import { communityTeamIdFromPage, PAGE_KEY_RE, parseId } from "../src/validate";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) {
      expect(e.status).toBe(400);
      return e.code;
    }
    throw e;
  }
  return "no_error";
}

const valid = () => ({
  title: "Đội cung kỵ",
  heroes: ["hero:a", "hero:b", "hero:c"],
  tactics: [
    ["tactic:t1", "tactic:t2"],
    ["tactic:t3", "tactic:t4"],
    ["tactic:t5", "tactic:t6"],
  ],
  troop: "cung",
  playstyle: "Đánh nhanh thắng nhanh.",
  strengths: "Mạnh",
  weaknesses: "",
  counters: null,
  counteredBy: "  Yếu  ",
  substitutes: undefined,
  lang: "vi",
  uploadIds: ["up-1", "up-2"],
});

describe("parseTeamInput", () => {
  it("nhận đầu vào hợp lệ, trim, rỗng -> null", () => {
    expect(parseTeamInput(valid())).toEqual({
      title: "Đội cung kỵ",
      heroes: ["hero:a", "hero:b", "hero:c"],
      tactics: [
        ["tactic:t1", "tactic:t2"],
        ["tactic:t3", "tactic:t4"],
        ["tactic:t5", "tactic:t6"],
      ],
      troop: "cung",
      playstyle: "Đánh nhanh thắng nhanh.",
      strengths: "Mạnh",
      weaknesses: null,
      counters: null,
      counteredBy: "Yếu",
      substitutes: null,
      lang: "vi",
      uploadIds: ["up-1", "up-2"],
    });
  });

  it("không phải object -> invalid_body", () => {
    for (const v of [null, undefined, "x", []]) expect(codeOf(() => parseTeamInput(v))).toBe("invalid_body");
  });

  it("title: biên 1–80 ký tự (code point), bắt buộc", () => {
    expect(codeOf(() => parseTeamInput({ ...valid(), title: "" }))).toBe("invalid_title");
    expect(codeOf(() => parseTeamInput({ ...valid(), title: "   " }))).toBe("invalid_title");
    expect(codeOf(() => parseTeamInput({ ...valid(), title: 5 }))).toBe("invalid_title");
    expect(codeOf(() => parseTeamInput({ ...valid(), title: "a".repeat(81) }))).toBe("invalid_title");
    expect(codeOf(() => parseTeamInput({ ...valid(), title: "a" }))).toBe("no_error");
    expect(codeOf(() => parseTeamInput({ ...valid(), title: "赵".repeat(80) }))).toBe("no_error");
  });

  it("playstyle: biên 10–3000", () => {
    expect(codeOf(() => parseTeamInput({ ...valid(), playstyle: "a".repeat(9) }))).toBe("invalid_text");
    expect(codeOf(() => parseTeamInput({ ...valid(), playstyle: "a".repeat(10) }))).toBe("no_error");
    expect(codeOf(() => parseTeamInput({ ...valid(), playstyle: "a".repeat(3000) }))).toBe("no_error");
    expect(codeOf(() => parseTeamInput({ ...valid(), playstyle: "a".repeat(3001) }))).toBe("invalid_text");
    expect(codeOf(() => parseTeamInput({ ...valid(), playstyle: undefined }))).toBe("invalid_text");
  });

  it("các trường tuỳ chọn: tối đa 2000 ký tự, sai kiểu -> invalid_text", () => {
    for (const field of ["strengths", "weaknesses", "counters", "counteredBy", "substitutes"]) {
      expect(codeOf(() => parseTeamInput({ ...valid(), [field]: "a".repeat(2000) }))).toBe("no_error");
      expect(codeOf(() => parseTeamInput({ ...valid(), [field]: "a".repeat(2001) }))).toBe("invalid_text");
      expect(codeOf(() => parseTeamInput({ ...valid(), [field]: 3 }))).toBe("invalid_text");
    }
  });

  it("heroes: đúng 3, không trùng, đúng định dạng id", () => {
    const heroes = (h: unknown) => ({ ...valid(), heroes: h });
    expect(codeOf(() => parseTeamInput(heroes(["hero:a", "hero:b"])))).toBe("invalid_heroes");
    expect(codeOf(() => parseTeamInput(heroes(["hero:a", "hero:b", "hero:c", "hero:d"])))).toBe("invalid_heroes");
    expect(codeOf(() => parseTeamInput(heroes(["hero:a", "hero:b", "hero:a"])))).toBe("invalid_heroes");
    expect(codeOf(() => parseTeamInput(heroes(["hero:a", "hero:b", "tactic:c"])))).toBe("invalid_heroes");
    expect(codeOf(() => parseTeamInput(heroes(["hero:a", "hero:b", "hero:C"])))).toBe("invalid_heroes");
    expect(codeOf(() => parseTeamInput(heroes(["hero:a", "hero:b", "<script>"])))).toBe("invalid_heroes");
    expect(codeOf(() => parseTeamInput(heroes("hero:a,hero:b,hero:c")))).toBe("invalid_heroes");
    expect(codeOf(() => parseTeamInput(heroes(undefined)))).toBe("invalid_heroes");
  });

  it("tactics: 3 cặp, không trùng trong cả đội (kể cả giữa hai tướng), đúng định dạng", () => {
    const tactics = (t: unknown) => ({ ...valid(), tactics: t });
    expect(codeOf(() => parseTeamInput(tactics(undefined)))).toBe("invalid_tactics");
    expect(codeOf(() => parseTeamInput(tactics([["tactic:t1", "tactic:t2"]])))).toBe("invalid_tactics");
    expect(
      codeOf(() =>
        parseTeamInput(
          tactics([["tactic:t1", "tactic:t2"], ["tactic:t3"], ["tactic:t5", "tactic:t6"]]),
        ),
      ),
    ).toBe("invalid_tactics");
    expect(
      codeOf(() =>
        parseTeamInput(
          tactics([["tactic:t1", "tactic:t1"], ["tactic:t3", "tactic:t4"], ["tactic:t5", "tactic:t6"]]),
        ),
      ),
    ).toBe("invalid_tactics");
    expect(
      codeOf(() =>
        parseTeamInput(
          tactics([["tactic:t1", "tactic:t2"], ["tactic:t2", "tactic:t4"], ["tactic:t5", "tactic:t6"]]),
        ),
      ),
    ).toBe("invalid_tactics");
    expect(
      codeOf(() =>
        parseTeamInput(
          tactics([["tactic:t1", "tactic:t2"], ["hero:x", "tactic:t4"], ["tactic:t5", "tactic:t6"]]),
        ),
      ),
    ).toBe("invalid_tactics");
  });

  it("troop: chỉ cung/khiGioi/ky/thuan/thuong", () => {
    for (const t of ["cung", "khiGioi", "ky", "thuan", "thuong"]) {
      expect(parseTeamInput({ ...valid(), troop: t }).troop).toBe(t);
    }
    for (const t of ["xe", "", undefined, 1, "Cung"]) {
      expect(codeOf(() => parseTeamInput({ ...valid(), troop: t }))).toBe("invalid_troop");
    }
  });

  it("lang: vi hoặc zh", () => {
    expect(parseTeamInput({ ...valid(), lang: "zh" }).lang).toBe("zh");
    expect(codeOf(() => parseTeamInput({ ...valid(), lang: "en" }))).toBe("invalid_lang");
  });

  it("uploadIds: 1–3, khác nhau, chuỗi id an toàn", () => {
    const up = (u: unknown) => ({ ...valid(), uploadIds: u });
    expect(codeOf(() => parseTeamInput(up([])))).toBe("invalid_uploads");
    expect(codeOf(() => parseTeamInput(up(["a", "b", "c", "d"])))).toBe("invalid_uploads");
    expect(codeOf(() => parseTeamInput(up(["a", "a"])))).toBe("invalid_uploads");
    expect(codeOf(() => parseTeamInput(up([1])))).toBe("invalid_uploads");
    expect(codeOf(() => parseTeamInput(up(["a/b"])))).toBe("invalid_uploads");
    expect(codeOf(() => parseTeamInput(up("a")))).toBe("invalid_uploads");
    expect(codeOf(() => parseTeamInput(up(undefined)))).toBe("invalid_uploads");
    expect(codeOf(() => parseTeamInput(up(["a"])))).toBe("no_error");
    expect(codeOf(() => parseTeamInput(up(["a", "b", "c"])))).toBe("no_error");
  });
});

describe("heroKey", () => {
  it("sắp xếp rồi nối bằng dấu phẩy, không phụ thuộc thứ tự", () => {
    expect(heroKey(["hero:c", "hero:a", "hero:b"])).toBe("hero:a,hero:b,hero:c");
    expect(heroKey(["hero:b", "hero:c", "hero:a"])).toBe(heroKey(["hero:a", "hero:b", "hero:c"]));
  });
});

describe("parseSeasonInput", () => {
  it("nhận id slug + nhãn 1–60", () => {
    expect(parseSeasonInput({ id: "s1-2026", labelVi: " Mùa 1 ", labelZh: "赛季一" })).toEqual({
      id: "s1-2026",
      labelVi: "Mùa 1",
      labelZh: "赛季一",
    });
  });
  it("từ chối id/nhãn sai", () => {
    const ok = { id: "s1", labelVi: "a", labelZh: "b" };
    expect(codeOf(() => parseSeasonInput({ ...ok, id: "-s1" }))).toBe("invalid_season");
    expect(codeOf(() => parseSeasonInput({ ...ok, id: "S1" }))).toBe("invalid_season");
    expect(codeOf(() => parseSeasonInput({ ...ok, id: "a".repeat(41) }))).toBe("invalid_season");
    expect(codeOf(() => parseSeasonInput({ ...ok, id: 5 }))).toBe("invalid_season");
    expect(codeOf(() => parseSeasonInput({ ...ok, labelVi: "" }))).toBe("invalid_season");
    expect(codeOf(() => parseSeasonInput({ ...ok, labelZh: "a".repeat(61) }))).toBe("invalid_season");
    expect(codeOf(() => parseSeasonInput({ ...ok, labelZh: "a".repeat(60) }))).toBe("no_error");
    expect(codeOf(() => parseSeasonInput(null))).toBe("invalid_body");
  });
  it("SEASON_ID_RE", () => {
    expect(SEASON_ID_RE.test("s18")).toBe(true);
    expect(SEASON_ID_RE.test("s-18")).toBe(true);
    expect(SEASON_ID_RE.test("s_18")).toBe(false);
  });
});

describe("parseVote / parseTeamSort / parseHeroFilter / parseSeasonFilter", () => {
  it("parseVote chỉ nhận 1, -1, 0", () => {
    expect(parseVote(1)).toBe(1);
    expect(parseVote(-1)).toBe(-1);
    expect(parseVote(0)).toBe(0);
    for (const v of [2, "1", null, undefined, 0.5, NaN]) expect(codeOf(() => parseVote(v))).toBe("invalid_vote");
  });

  it("parseTeamSort mặc định hot", () => {
    expect(parseTeamSort(undefined)).toBe("hot");
    expect(parseTeamSort("")).toBe("hot");
    expect(parseTeamSort("new")).toBe("new");
    expect(parseTeamSort("top")).toBe("top");
    expect(codeOf(() => parseTeamSort("best"))).toBe("invalid_sort");
  });

  it("parseHeroFilter: rỗng -> [], tối đa 3 id đúng định dạng, không trùng", () => {
    expect(parseHeroFilter(undefined)).toEqual([]);
    expect(parseHeroFilter("")).toEqual([]);
    expect(parseHeroFilter("hero:a")).toEqual(["hero:a"]);
    expect(parseHeroFilter("hero:a,hero:b,hero:c")).toEqual(["hero:a", "hero:b", "hero:c"]);
    expect(codeOf(() => parseHeroFilter("hero:a,hero:b,hero:c,hero:d"))).toBe("invalid_hero");
    expect(codeOf(() => parseHeroFilter("hero:a,hero:a"))).toBe("invalid_hero");
    expect(codeOf(() => parseHeroFilter("hero:A"))).toBe("invalid_hero");
    expect(codeOf(() => parseHeroFilter("tactic:a"))).toBe("invalid_hero");
    expect(codeOf(() => parseHeroFilter("hero:a,"))).toBe("invalid_hero");
  });

  it("parseSeasonFilter: mặc định null (mùa mở), 'all', hoặc id mùa", () => {
    expect(parseSeasonFilter(undefined)).toBeNull();
    expect(parseSeasonFilter("")).toBeNull();
    expect(parseSeasonFilter("all")).toBe("all");
    expect(parseSeasonFilter("s18")).toBe("s18");
    expect(codeOf(() => parseSeasonFilter("S 18"))).toBe("invalid_season");
  });
});

describe("PAGE_KEY_RE / communityTeamIdFromPage", () => {
  it("nhận page key đội cộng đồng (id harness và uuid) và các page cũ", () => {
    for (const ok of [
      "/doi-cong-dong/id-0001/",
      "/doi-cong-dong/3f2504e0-4f89-41d3-9a0c-0305e82c3301/",
      "/doi-chuan/s18-abc/",
      "/khai-hoang/0-team-9/",
    ]) {
      expect(PAGE_KEY_RE.test(ok)).toBe(true);
    }
  });
  it("từ chối rỗng, hoa, thiếu / cuối, lồng, quá dài, tiền tố locale", () => {
    for (const bad of [
      "/doi-cong-dong/",
      "/doi-cong-dong//",
      "/doi-cong-dong/ID-1/",
      "/doi-cong-dong/id-1",
      "/doi-cong-dong/-id/",
      "/doi-cong-dong/a/b/",
      `/doi-cong-dong/a${"b".repeat(64)}/`,
      "/zh/doi-cong-dong/id-1/",
    ]) {
      expect(PAGE_KEY_RE.test(bad)).toBe(false);
    }
    expect(PAGE_KEY_RE.test(`/doi-cong-dong/a${"b".repeat(63)}/`)).toBe(true);
  });
  it("communityTeamIdFromPage trả id hoặc null", () => {
    expect(communityTeamIdFromPage("/doi-cong-dong/id-0001/")).toBe("id-0001");
    expect(communityTeamIdFromPage("/doi-chuan/s18-abc/")).toBeNull();
    expect(communityTeamIdFromPage("/doi-cong-dong/")).toBeNull();
    expect(communityTeamIdFromPage("/doi-cong-dong/ID/")).toBeNull();
  });
});

describe("parseId (chuyển từ scan.ts)", () => {
  it("kiểm định dạng theo loại, mã lỗi theo field", () => {
    expect(parseId("hero:lu-bu", "hero", "hero")).toBe("hero:lu-bu");
    expect(codeOf(() => parseId("tactic:x", "hero", "hero"))).toBe("invalid_hero");
    expect(codeOf(() => parseId(`hero:${"a".repeat(120)}`, "hero", "heroes"))).toBe("invalid_heroes");
    expect(codeOf(() => parseId(5, "book", "book"))).toBe("invalid_book");
  });
});

describe("paginateByKey", () => {
  const rows = (...pairs: [number, string][]) => pairs.map(([hot_rank, id]) => ({ hot_rank, id }));

  it("không quá limit -> không cursor", () => {
    const r = paginateByKey(rows([5, "b"], [5, "a"]), 2, "hot_rank");
    expect(r.rows).toHaveLength(2);
    expect(r.nextCursor).toBeNull();
  });

  it("cắt còn limit và cursor = [giá trị khoá của dòng cuối, id], kể cả giá trị âm", () => {
    const r = paginateByKey(rows([-7, "c"], [-7, "b"], [-9, "a"]), 2, "hot_rank");
    expect(r.rows.map((x) => x.id)).toEqual(["c", "b"]);
    expect(decodeCursor(r.nextCursor)).toEqual({ t: -7, id: "b" });
  });

  it("giá trị khoá bằng nhau thì id phân xử: trang kế bắt đầu đúng sau dòng cuối", () => {
    const all = rows([5, "d"], [5, "c"], [5, "b"], [5, "a"], [3, "z"]); // order by hot_rank desc, id desc
    const page1 = paginateByKey(all.slice(0, 3), 2, "hot_rank");
    const cursor = decodeCursor(page1.nextCursor);
    expect(cursor).toEqual({ t: 5, id: "c" });
    const next = all.filter((r) => r.hot_rank < cursor!.t || (r.hot_rank === cursor!.t && r.id < cursor!.id));
    expect(next.map((r) => r.id)).toEqual(["b", "a", "z"]);
  });
});
