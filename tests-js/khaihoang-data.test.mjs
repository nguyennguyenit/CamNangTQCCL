import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8"));
const tactics = JSON.parse(await readFile(new URL("../data/tactics.json", import.meta.url), "utf8"));
const guideExpectations = JSON.parse(await readFile(new URL("./fixtures/khaihoang-guide-expectations.json", import.meta.url), "utf8"));

const rosterKey = (heroes) => [...heroes].sort().join("|");
const defenderKey = (rows) => rows.map(({ hero, unitType }) => `${hero} ${unitType || ""}`.trim()).join("|");
const expectedGuideHeroReferences = [
  "Bàng Thống", "Cam Ninh", "Chu Du", "Chu Thái", "Hoàng Nguyệt Anh", "Hứa Du", "Lưu Bị",
  "Quách Gia", "Quan Ngân Bình", "SP Chu Du", "SP Viên Thiệu", "Thái Sử Từ", "Triệu Vân",
  "Trình Phổ", "Trương Giác", "Trương Phi", "Tự Thụ",
].sort();

test("Khác Bình Tiến uses spears in both opening phases", () => {
  const team = data.teams.find((t) => t.title === "Gia Cát Khác · Quan Ngân Bình · Nhạc Tiến");
  assert.equal(team.unitType, "Thương");
  for (const hero of team.heroes) {
    assert.equal(hero.unitTypeBefore, "Thương");
    assert.equal(hero.unitTypeAfter, "Thương");
  }
});

test("sourced options are complete for each declared phase and preserve the roster", () => {
  assert.equal(data.season, "Binh Diễn Xuân Thu");
  for (const team of data.teams) {
    const variants = team.variants || [];
    assert.equal(new Set(variants.map((v) => v.id)).size, variants.length, team.title);
    for (const variant of variants) {
      const key = `${team.title}: ${variant.id}`;
      assert.ok(variant.id && variant.label && variant.region && variant.period && variant.note, key);
      assert.deepEqual(variant.heroes.map((h) => h.name).sort(), team.heroes.map((h) => h.name).sort(), key);
      assert.ok(variant.sources.length, key);
      for (const source of variant.sources) {
        assert.equal(new URL(source.url).protocol, "https:", key);
        assert.ok(source.label, key);
      }
      for (const phase of ["Before", "After"]) {
        const names = [];
        let populated = 0;
        for (const hero of variant.heroes) {
          const skills = phase === "Before" ? (hero.tacticBefore ? [hero.tacticBefore] : []) : hero.tacticsAfter || [];
          if (!skills.length) continue;
          populated++;
          assert.equal(skills.length, phase === "Before" ? 1 : 2, key);
          assert.equal(hero[`unitType${phase}`], variant.unitType, key);
          for (const name of skills) {
            const tactic = tactics.find((t) => t.viet === name);
            assert.ok(tactic, `${key}: unknown ${name}`);
            assert.notEqual(tactic.type, "Nội chính", key);
            if (tactic.troopFit.length) assert.ok(tactic.troopFit.includes(variant.unitType), `${key}: ${name}`);
            names.push(name);
          }
        }
        assert.ok(populated === 0 || populated === 3, `${key}: partial ${phase}`);
        assert.equal(new Set(names).size, names.length, `${key}: duplicate ${phase}`);
        const commander = variant[`commander${phase}`];
        if (commander) assert.ok(variant.heroes.some((h) => h.name === commander), key);
      }
    }
  }
});

test("Chạm Sứ groups match the separate sheet table without opening-team linkage", () => {
  // Google Sheet snapshot: tests/fixtures/khaihoang-cham-su-source.csv (2026-09-06).
  const expected = [
    [["Lữ Mông", "Bạch Mã Nghĩa Tòng"], ["Giả Hủ", "Ngụy Thư Tương Gian"]],
    [["Mã Siêu", "Lõa Y Huyết Chiến"], ["Hoàng Nguyệt Anh", "Phong Thi Trận"]],
    [["Trương Nhượng", "Văn Võ Song Toàn"], ["Hoàng Nguyệt Anh", "Phong Thi Trận"]],
    [["Tôn Thượng Hương", "Lõa Y Huyết Chiến"], ["Lăng Thống", "Phong Thi Trận"]],
    [["Thái Sử Từ", "Bách Kỵ Kiếp Doanh"], ["Lăng Thống", "Hổ Báo Kỳ"]],
    [["Hạ Hầu Uyên", "Lõa Y Huyết Chiến"], ["Tào Thuận", "Thiết Kỳ Khu Trì"]],
    [["Mã Siêu", "Lõa Y Huyết Chiến"], ["Lăng Thống", "Phong Thi Trận"]],
    [["Cam Ninh", "Phá Quân Uy Thắng"], ["Lăng Thống", "Phong Thi Trận"]],
  ];
  assert.ok(Array.isArray(data.chamSuTeams), "missing independent Chạm Sứ table");
  assert.deepEqual(data.chamSuTeams.map((t) => t.heroes.map((h) => [h.name, h.tactic])), expected);
  assert.equal(new Set(data.chamSuTeams.map((t) => t.id)).size, expected.length);
  for (const group of data.chamSuTeams) {
    assert.ok(group.id);
    assert.equal(group.title, group.heroes.map((h) => h.name).join(" · "));
    assert.match(group.note, /mang 1 lính/i);
    assert.equal(group.unitType, undefined);
    assert.ok(group.sources.length);
    for (const source of group.sources) {
      assert.ok(source.label);
      assert.equal(new URL(source.url).protocol, "https:");
    }
  }
  assert.match(data.chamSuTeams[0].note, /Điêu Thuyền, Hoàng Cái, Phùng Kỷ/);
  for (const team of data.teams) assert.equal(Object.hasOwn(team, "transforms"), false);
});

test("Yaojing opening guides stay on their three-hero roster, not on a tactic variant", () => {
  assert.equal(guideExpectations.length, 11);
  const byRoster = new Map(data.teams.map((team) => [rosterKey(team.heroes.map((hero) => hero.name)), team]));

  for (const expected of guideExpectations) {
    const team = byRoster.get(rosterKey(expected.heroes));
    assert.ok(team, `missing roster for ${expected.sourceName}`);
    assert.ok(team.guide, `missing guide for ${expected.sourceName}`);
    assert.deepEqual(
      [team.guide.ratings.land4, team.guide.ratings.land5, team.guide.ratings.land6,
        team.guide.ratings.land7to8, team.guide.ratings.transition, team.guide.ratings.overall],
      expected.ratings,
      expected.sourceName,
    );
    assert.ok(team.guide.overview, `${expected.sourceName}: overview`);
    assert.ok(team.guide.redRequirements?.length, `${expected.sourceName}: red requirements`);
    assert.equal(team.guide.defenders.land4.length, 8, `${expected.sourceName}: land 4 order`);
    assert.equal(team.guide.defenders.land5.length, 8, `${expected.sourceName}: land 5 order`);
    assert.ok(team.guide.defenders.warning, `${expected.sourceName}: warning`);
    assert.equal(defenderKey(team.guide.defenders.land4), expected.land4, `${expected.sourceName}: exact land 4 order`);
    assert.equal(defenderKey(team.guide.defenders.land5), expected.land5, `${expected.sourceName}: exact land 5 order`);
    assert.ok(team.guide.transitions?.length, `${expected.sourceName}: transitions`);
    assert.ok(team.guide.transitions.every((transition) => transition.steps?.length), `${expected.sourceName}: ordered steps`);
    for (const variant of team.variants || []) assert.equal(Object.hasOwn(variant, "guide"), false, `${expected.sourceName}: ${variant.id}`);
  }
});

test("opening-guide fields stay finite, curated, and separate from build variants", () => {
  const tacticNames = new Set(tactics.map((tactic) => tactic.viet));
  for (const team of data.teams) {
    const guide = team.guide;
    for (const variant of team.variants || []) assert.equal(Object.hasOwn(variant, "guide"), false, team.title);
    if (!guide) continue;
    for (const value of Object.values(guide.ratings || {})) assert.equal(Number.isFinite(value), true, team.title);
    for (const item of guide.redRequirements || []) {
      if (item.minimum !== undefined) assert.equal(Number.isFinite(item.minimum), true, team.title);
      if (item.recommended !== undefined) assert.equal(Number.isFinite(item.recommended), true, team.title);
      assert.equal(Object.hasOwn(item, "owned"), false, team.title);
    }
    for (const transition of guide.transitions || []) {
      for (const step of transition.steps || []) {
        if (step.mainCityLevel !== undefined) assert.equal(Number.isFinite(step.mainCityLevel), true, team.title);
        if (step.commandCost !== undefined) assert.equal(Number.isFinite(step.commandCost), true, team.title);
      }
    }
    for (const split of guide.splitTeams?.teams || []) {
      assert.ok(split.target, `${team.title}: split target`);
      assert.ok(split.heroes?.length || split.note, `${team.title}: split needs reviewed structure or prose`);
      for (const hero of split.heroes || []) for (const tactic of hero.tactics || []) {
        assert.ok(tacticNames.has(tactic), `${team.title}: unknown split tactic ${tactic}`);
      }
    }
  }
});

test("every retained build note has a curated public counterpart", () => {
  for (const team of data.teams) {
    for (const build of [team, ...(team.variants || [])]) {
      if (build.note) assert.ok(build.displayNote, `${team.title}: missing curated build note`);
    }
  }
});

test("new guide hero references are the reviewed canonical set", () => {
  const referenced = new Set();
  for (const team of data.teams) {
    for (const item of team.guide?.redRequirements || []) if (item.hero) referenced.add(item.hero);
    for (const transition of team.guide?.transitions || []) {
      for (const step of transition.steps || []) for (const hero of step.trainHeroes || []) referenced.add(hero);
    }
  }
  assert.deepEqual([...referenced].sort(), expectedGuideHeroReferences);
});

test("Yaojing guide details preserve named minimums and note-only split advice", () => {
  const byRoster = new Map(data.teams.map((team) => [rosterKey(team.heroes.map((hero) => hero.name)), team]));
  for (const expected of guideExpectations) {
    const guide = byRoster.get(rosterKey(expected.heroes))?.guide;
    if (expected.minimum) assert.deepEqual(guide.redRequirements.find((item) => item.hero === expected.minimum.hero)?.minimum, expected.minimum.minimum);
    if (expected.splitNote) assert.equal(guide.splitTeams.note, expected.splitNote);
  }
});

test("researched opening builds retain their observed stage-specific commanders and tactics", () => {
  const team7 = data.teams.find((team) => team.title === "Trương Xuân Hoa · Lữ Bố · Tả Từ");
  assert.equal(team7.commanderBefore, undefined);
  assert.equal(team7.commanderAfter, "Trương Xuân Hoa");
  for (const [hero, tacticsAfter] of [
    ["Trương Xuân Hoa", ["Thịnh Khí Linh Địch", "Võ Phong Trận"]],
    ["Lữ Bố", ["Thôi Phong Đoạn Nhẫn", "Mau Giành Lợi Thế"]],
    ["Tả Từ", ["Lâm Nguy Cứu Chủ", "Tạm Lánh Sóng Gió"]],
  ]) {
    const build = team7.heroes.find((item) => item.name === hero);
    assert.equal(build.unitTypeBefore, undefined, hero);
    assert.equal(build.tacticBefore, undefined, hero);
    assert.equal(build.unitTypeAfter, "Cung", hero);
    assert.deepEqual(build.tacticsAfter, tacticsAfter, hero);
  }

  const team9 = data.teams.find((team) => team.title === "SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác");
  assert.equal(team9.commanderBefore, "SP Chu Tuấn");
  assert.equal(team9.commanderAfter, "Gia Cát Khác");
  for (const [hero, tacticBefore, tacticsAfter] of [
    ["SP Chu Tuấn", "Vô Đương Phi Quân", ["Vô Đương Phi Quân", "Sợ Bóng Sợ Gió"]],
    ["Hạ Hầu Uyên", "Lõa Y Huyết Chiến", ["Lõa Y Huyết Chiến", "Thôi Phong Đoạn Nhẫn"]],
    ["Gia Cát Khác", "Thịnh Khí Linh Địch", ["Thịnh Khí Linh Địch", "Tiềm Long Trận"]],
  ]) {
    const build = team9.heroes.find((item) => item.name === hero);
    assert.equal(build.unitTypeBefore, "Cung", hero);
    assert.equal(build.tacticBefore, tacticBefore, hero);
    assert.equal(build.unitTypeAfter, "Cung", hero);
    assert.deepEqual(build.tacticsAfter, tacticsAfter, hero);
  }
});
