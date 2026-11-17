import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndexes, isJaFixture, scoreFixture, type Fixture } from "../eval/score";
import type { AnalyzeResult, HeroRead } from "../src/schema";

const REPO = join(__dirname, "..", "..");

const indexes = buildIndexes({
  heroes: [
    { chinese: "关羽", viet: "Quan Vũ", selfTacticCn: "威震华夏" },
    { chinese: "张飞", viet: "Trương Phi" },
  ],
  tactics: [
    { chinese: "威震华夏", viet: "Uy Chấn Hoa Hạ" },
    { chinese: "刀出如霆", viet: "Đao Xuất Như Đình" },
    { chinese: "文武双全", viet: "Văn Võ Song Toàn" },
  ],
  books: [{ id: "book:giap-sat", chinese: "铁甲", viet: "Giáp Sắt" }],
});

const fixture: Fixture = {
  image: "x.jpg",
  source: "test",
  expected: {
    screen: "battleReport",
    sideCount: 2,
    sides: [
      { side: "left", heroes: [{ hero: "hero:quan-vu", tactics: ["tactic:dao-xuat-nhu-dinh", "tactic:van-vo-song-toan"], book: "book:giap-sat" }] },
      { side: "right", heroes: [{ hero: "hero:truong-phi", tactics: ["tactic:van-vo-song-toan", null], book: null }] },
    ],
  },
};

const hero = (nameCn: string, tacticsCn: string[], booksCn: string[] = []): HeroRead => ({ nameCn, tacticsCn, booksCn, statFocusCn: "" });

describe("scoreFixture", () => {
  it("đọc đúng hết: mọi ô trúng, dòng tự mang bị bỏ như editor, thứ tự A/B không quan trọng", () => {
    const got: AnalyzeResult = {
      screen: "battleReport",
      sides: [
        { side: "left", heroes: [hero("关羽", ["威震华夏", "文武双全", "刀出如霆"], ["铁甲"])] },
        { side: "right", heroes: [hero("张飞", ["文武双全"])] },
      ],
    };
    expect(scoreFixture(fixture, got, indexes)).toEqual({
      screen: { hit: 1, total: 1 },
      sides: { hit: 1, total: 1 },
      heroes: { hit: 2, total: 2 },
      // Ô kỳ vọng null của phe phải không được chấm.
      tactics: { hit: 3, total: 3 },
      books: { hit: 1, total: 1 },
    });
  });

  it("thiếu phe phải và tên không khớp chắc: tính là sai (người dùng phải sửa tay)", () => {
    const got: AnalyzeResult = { screen: "other", sides: [{ side: "left", heroes: [hero("关", ["刀出如霆"])] }] };
    const score = scoreFixture(fixture, got, indexes);
    expect(score.screen).toEqual({ hit: 0, total: 1 });
    expect(score.sides).toEqual({ hit: 0, total: 1 });
    expect(score.heroes).toEqual({ hit: 0, total: 2 });
    expect(score.tactics.total).toBe(3);
  });
  it("Worker lỗi (null): mọi ô sai; fixture không có screen/sideCount (xuất từ mẫu người dùng) thì không chấm hai mục đó", () => {
    const { sideCount: _count, screen: _screen, ...expected } = fixture.expected;
    const score = scoreFixture({ ...fixture, expected }, null, indexes);
    expect(score.screen).toEqual({ hit: 0, total: 0 });
    expect(score.sides).toEqual({ hit: 0, total: 0 });
    expect(score.heroes).toEqual({ hit: 0, total: 2 });
    expect(score.tactics).toEqual({ hit: 0, total: 3 });
    expect(score.books).toEqual({ hit: 0, total: 1 });
  });
});

describe("fixture ảnh client Nhật (alias tên Nhật)", () => {
  const read = (file: string) => JSON.parse(readFileSync(join(REPO, "data", file), "utf8"));
  const dicts = { heroes: read("heroes-dict.json"), tactics: read("tactics.json"), books: read("books-dict.json") };
  const lookupJa = read("lookup-ja.json");
  const baseIndexes = buildIndexes(dicts);
  const jaIndexes = buildIndexes(dicts, lookupJa.entries);
  const fixtureOf = (name: string) => JSON.parse(readFileSync(join(__dirname, "..", "eval", "fixtures", `${name}.json`), "utf8")) as Fixture;

  // Tên Nhật chép đúng chữ in trên ảnh: lấy `name` của mục lookup-ja theo ID canonical của đáp án.
  const jaName = (id: string) => lookupJa.entries[id].name as string;
  const canonicalName = (dict: Record<string, unknown>[], id: string) => (dict.find((r) => r.id === id) as { chinese: string }).chinese;

  const readOf = (fixture: Fixture, nameOf: (kind: "hero" | "tactic", id: string) => string): AnalyzeResult => ({
    screen: fixture.expected.screen!,
    sides: fixture.expected.sides.map((side) => ({
      side: side.side,
      heroes: side.heroes.map((h) => hero(nameOf("hero", h.hero), h.tactics.filter((t): t is string => !!t).map((t) => nameOf("tactic", t)))),
    })),
  });

  for (const name of ["battle-ja-1", "battle-ja-2"]) {
    it(`${name}: output chép đúng tên Nhật (kể cả SP) chấm 100% với alias, và nhận ra là fixture Nhật`, () => {
      const fixture = fixtureOf(name);
      expect(isJaFixture(fixture, name)).toBe(true);
      const got = readOf(fixture, (_, id) => jaName(id));
      const score = scoreFixture(fixture, got, jaIndexes);
      expect(score.heroes.hit).toBe(score.heroes.total);
      expect(score.tactics.hit).toBe(score.tactics.total);
      expect(score.heroes.total).toBeGreaterThan(0);
      expect(score.screen).toEqual({ hit: 1, total: 1 });
      // Không có alias thì chiến pháp tên Nhật (機転先決, 経天緯地...) không khớp: chính alias tạo ra điểm.
      expect(scoreFixture(fixture, got, baseIndexes).tactics.hit).toBeLessThan(score.tactics.total);
    });

    it(`${name}: output chép chữ Hán canonical vẫn khớp như cũ với chỉ mục có alias`, () => {
      const fixture = fixtureOf(name);
      const got = readOf(fixture, (kind, id) => canonicalName(kind === "hero" ? dicts.heroes : dicts.tactics, id));
      const withAlias = scoreFixture(fixture, got, jaIndexes);
      expect(withAlias).toEqual(scoreFixture(fixture, got, baseIndexes));
      expect(withAlias.heroes.hit).toBe(withAlias.heroes.total);
      expect(withAlias.tactics.hit).toBe(withAlias.tactics.total);
    });
  }

  it("fixture vi/zh: điểm không đổi giữa chỉ mục thường và chỉ mục alias; không bị coi là fixture Nhật", () => {
    for (const name of ["battle-vi-1", "battle-simplified-1", "battle-trad-1", "battle-trad-2", "team-detail-1"]) {
      const fixture = fixtureOf(name);
      expect(isJaFixture(fixture, name)).toBe(false);
      const got = readOf(fixture, (kind, id) => canonicalName(kind === "hero" ? dicts.heroes : dicts.tactics, id));
      expect(scoreFixture(fixture, got, jaIndexes)).toEqual(scoreFixture(fixture, got, baseIndexes));
    }
  });

  it("tên Nhật trùng chữ Hán nguồn của mục khác: chỉ mục ja chấm theo chủ tên Nhật, chỉ mục thường giữ như cũ", () => {
    // Bản Nhật gọi 固若金湯 là 金城湯池; 金城湯池 cũng là chữ Hán nguồn của tactic:kim-thanh-thang-tri (bản Nhật: 湯池鉄城).
    expect(jaIndexes.tactics.exact.get("金城湯池")).toBe("tactic:co-nhuoc-kim-thang");
    expect(jaIndexes.tactics.exact.get("湯池鉄城")).toBe("tactic:kim-thanh-thang-tri");
    expect(baseIndexes.tactics.exact.get("金城湯池")).toBe("tactic:kim-thanh-thang-tri");
  });

  it("trường locale: ja đánh dấu fixture Nhật dù tên không có -ja-", () => {
    expect(isJaFixture({ ...fixtureOf("battle-vi-1"), locale: "ja" }, "x")).toBe(true);
  });
});
