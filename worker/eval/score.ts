// Chấm một lượt đọc ảnh (output Worker mode `analyzeTeamImage`) so với fixture bộ ảnh chuẩn.
// Chấm trên ID canonical sau khi qua CÙNG bộ khớp từ điển của Soi đội (`draftFromRead`), nên con số
// là thứ người dùng thực sự thấy: ô "Không chắc"/"Không rõ" tính là sai (người dùng phải sửa tay).

import { createEntityIndex, draftFromRead } from "../../js/analyze-map.js";
import type { AnalyzeResult, ScreenKind, SideId } from "../src/schema";

export interface ExpectedMember {
  hero: string;
  /** Chiến pháp đã học A/B (không gồm tự mang); null = không chấm ô đó. */
  tactics: [string | null, string | null];
  book: string | null;
}

export interface Fixture {
  image: string;
  source: string;
  expected: {
    /** Loại màn hình người duyệt đã xác nhận; thiếu thì không chấm (fixture xuất từ mẫu người dùng chỉ có nhãn AI tự đoán). */
    screen?: ScreenKind;
    /** Số phe trong ảnh; thiếu thì không chấm phát hiện phe (vd fixture xuất từ mẫu người dùng chỉ có một phe). */
    sideCount?: number;
    sides: { side: SideId; heroes: ExpectedMember[] }[];
  };
}

/** Đếm đúng/tổng của một trường. */
export interface Tally {
  hit: number;
  total: number;
}

export interface FixtureScore {
  screen: Tally;
  sides: Tally;
  heroes: Tally;
  tactics: Tally;
  books: Tally;
}

type Dict = Record<string, unknown>[];
export interface Dicts {
  heroes: Dict;
  tactics: Dict;
  books: Dict;
}
/** Chỉ mục từ điển theo loại (`createEntityIndex` của js/analyze-map.js), dùng chung cho mọi fixture. */
export interface Indexes {
  heroes: unknown;
  tactics: unknown;
  books: unknown;
}

export function buildIndexes(dicts: Dicts): Indexes {
  return {
    heroes: createEntityIndex(dicts.heroes, "hero"),
    tactics: createEntityIndex(dicts.tactics, "tactic"),
    books: createEntityIndex(dicts.books, "book"),
  };
}

const tally = (hit: boolean): Tally => ({ hit: hit ? 1 : 0, total: 1 });
const EMPTY: Tally = { hit: 0, total: 0 };

export function addTally(a: Tally, b: Tally): Tally {
  return { hit: a.hit + b.hit, total: a.total + b.total };
}

export function emptyScore(): FixtureScore {
  return { screen: EMPTY, sides: EMPTY, heroes: EMPTY, tactics: EMPTY, books: EMPTY };
}

export function addScore(a: FixtureScore, b: FixtureScore): FixtureScore {
  return {
    screen: addTally(a.screen, b.screen),
    sides: addTally(a.sides, b.sides),
    heroes: addTally(a.heroes, b.heroes),
    tactics: addTally(a.tactics, b.tactics),
    books: addTally(a.books, b.books),
  };
}

/**
 * Chấm một kết quả. `got = null` (Worker lỗi/422) -> mọi ô của fixture tính là sai.
 * Tướng so theo vị trí trong phe (主将 trước); chiến pháp so theo tập của từng vị trí (thứ tự A/B không
 * quan trọng khi đối chiếu đội); binh thư so theo vị trí. Ô kỳ vọng null không được chấm.
 */
export function scoreFixture(fixture: Fixture, got: AnalyzeResult | null, indexes: Indexes): FixtureScore {
  const { expected } = fixture;
  let score: FixtureScore = {
    ...emptyScore(),
    screen: expected.screen === undefined ? EMPTY : tally(got?.screen === expected.screen),
    sides: expected.sideCount === undefined ? EMPTY : tally(got?.sides.length === expected.sideCount),
  };
  for (const side of expected.sides) {
    const read = got?.sides.find((s) => s.side === side.side);
    const draft = draftFromRead({ heroes: read?.heroes ?? [] }, indexes);
    side.heroes.forEach((want, index) => {
      const member = draft.heroes[index];
      const gotTactics = new Set(member?.tactics.map((cell: { id: string | null }) => cell.id).filter(Boolean));
      const wantTactics = want.tactics.filter((id): id is string => Boolean(id));
      score = addScore(score, {
        ...emptyScore(),
        heroes: tally(member?.hero.id === want.hero),
        tactics: { hit: wantTactics.filter((id) => gotTactics.has(id)).length, total: wantTactics.length },
        books: want.book ? tally(member?.book.id === want.book) : EMPTY,
      });
    });
  }
  return score;
}

/** Phân vị (0..1) của danh sách số; rỗng -> null. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}
