import { describe, expect, it } from "vitest";
import { buildIndexes, scoreFixture, type Fixture } from "../eval/score";
import type { AnalyzeResult, HeroRead } from "../src/schema";

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
  books: [{ chinese: "铁甲", viet: "Giáp Sắt" }],
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
