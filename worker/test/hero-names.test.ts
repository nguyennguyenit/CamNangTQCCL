import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HERO_NAMES_CN } from "../src/hero-names";

interface HeroEntry {
  chinese: string;
  aliases?: string[];
}

const heroes: HeroEntry[] = JSON.parse(
  readFileSync(new URL("../../data/heroes-dict.json", import.meta.url), "utf8"),
);

/** Tên Giản thể gửi cho model: alias không khoảng trắng khác `chinese`, không có thì `chinese` bỏ khoảng trắng. */
function promptName(hero: HeroEntry): string {
  const simplified = (hero.aliases || []).find((alias) => !/\s/u.test(alias) && alias !== hero.chinese);
  return simplified ?? hero.chinese.replace(/\s+/gu, "");
}

describe("HERO_NAMES_CN", () => {
  it("khớp đúng từng tướng trong data/heroes-dict.json", () => {
    expect(new Set(HERO_NAMES_CN)).toEqual(new Set(heroes.map(promptName)));
    expect(HERO_NAMES_CN).toHaveLength(heroes.length);
  });

  it("không tên nào có khoảng trắng", () => {
    expect(HERO_NAMES_CN.filter((name) => /\s/u.test(name))).toEqual([]);
  });
});
