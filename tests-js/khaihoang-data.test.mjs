import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8"));
const tactics = JSON.parse(await readFile(new URL("../data/tactics.json", import.meta.url), "utf8"));

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
