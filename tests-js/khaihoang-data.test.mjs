import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTacticNameIndex } from "../js/lookup-ids.js";

const data = JSON.parse(await readFile(new URL("../data/khaihoang.json", import.meta.url), "utf8"));
const tactics = JSON.parse(await readFile(new URL("../data/tactics.json", import.meta.url), "utf8"));
const tacticId = createTacticNameIndex(tactics);
const guideExpectations = JSON.parse(await readFile(new URL("./fixtures/khaihoang-guide-expectations.json", import.meta.url), "utf8"));

const rosterKey = (heroes) => [...heroes].sort().join("|");
const defenderKey = (rows) => rows.map(({ hero, unitType }) => `${hero} ${unitType || ""}`.trim()).join("|");
const expectedGuideHeroReferences = [
  "Bàng Thống", "Cam Ninh", "Chu Du", "Chu Thái", "Hoàng Nguyệt Anh", "Hứa Du", "Lưu Bị",
  "Quách Gia", "Quan Ngân Bình", "SP Chu Du", "SP Viên Thiệu", "Thái Sử Từ", "Triệu Vân",
  "Trình Phổ", "Trương Giác", "Trương Phi", "Tự Thụ",
].sort();

// Reviewed phase-1 migration table: the 30 retired `displayNote` owners, each recorded as the
// destination field of its sentences. `null` means the field must be absent rather than empty, and
// the pair must reproduce the retired value sentence for sentence (59 sentences in total).
const noteMigration = [
  ["teams[0].variants[0]", "Pháp Chính mang Tiềm Long từ đầu; cần có Thôi Phong.", "Cấu hình hướng tới tài khoản nhiều hột; không suy các mốc mở đất cho mọi tài khoản."],
  ["teams[0].variants[1]", "Đổi vị trí Giải Phiền và Thịnh Khí; sau cấp 20 SP Mã Siêu dùng Bạo Lệ + Mau Giành.", null],
  ["teams[0].heroes[2]", "Sau cấp 20 để Pháp Chính làm chủ tướng.", null],
  ["teams[1].variants[0]", "Sau cấp 20 chuyển chủ tướng sang Quan Ngân Bình, Thanh Châu đặt trên Quan. Chỉnh Võ Lực Quan cao hơn Nhạc. Sĩ Tranh Tiên Phó chưa được xác nhận là alias của Nhanh Chân Tranh Đất.", null],
  ["teams[2].variants[0]", "Sau cấp 20 dùng Bát Môn thay Tiềm Long trên Gia Cát Khác. Giữ cấu hình Cung và Vô Đương, không đổi sang Kỵ.", null],
  ["teams[2].heroes[2]", "Sau cấp 20 để Gia Cát Khác làm chủ tướng.", null],
  ["teams[3]", null, "Thận trọng với thủ quân có tất trúng vì làm giảm lợi thế né tránh của Tả Từ. Mốc mở đất phụ thuộc hột tướng, trang bị, thủ quân và đội đánh hao."],
  ["teams[3].variants[0]", "Tam Thế ở Trương Xuân Hoa; Tả Từ mang cả Thịnh Khí + Sĩ Biệt thay Sợ Bóng Sợ Gió. Không trộn hai cấu hình. Chỉ có bộ hai chiêu, chưa chốt trước cấp 20 hoặc mạnh hơn mặc định.", null],
  ["teams[3].heroes[0]", "Cộng Trí Lực.", "Là nguồn sát thương chính của đội; ưu tiên Lục Tốn nhiều hột, kết quả phụ thuộc khả năng phát động chiến pháp."],
  ["teams[3].heroes[1]", "Cộng Trí Lực. Có thể thay Thịnh Khí Linh Địch bằng Sĩ Biệt Tam Nhật tùy thủ quân và độ đỏ; chọn một trong hai. Sau cấp 20 và thức tỉnh, nhận Tam Thế Trận từ Trương Xuân Hoa.", null],
  ["teams[3].heroes[2]", "Chỉnh Tốc Độ để hành động trước Lục Tốn, còn lại cộng Trí Lực; không có số điểm tốc cố định cho mọi tài khoản. Sau thức tỉnh chuyển Tam Thế sang Tả Từ, dùng Đoạt Hồn Hiệp Phách + Sợ Bóng Sợ Gió.", null],
  ["teams[4].variants[0]", "Chọn nhánh Bạo Lệ. Bách Kỵ đặt trên Hạ Hầu Uyên; Hoàng Nguyệt Anh mang Hổ Báo + Tam Thế. Đây là cấu hình Kỵ.", null],
  ["teams[5].variants[0]", "Chọn nhánh Cung: giữ Vô Đương ở Trần Cung, khác bản mặc định chuyển Kỵ.", null],
  ["teams[7].variants[0]", "Khương Duy mang Vô Đương trước cấp 20; sau cấp 20 Hạ Hầu Uyên dùng Mau Giành thay Nhất Kỵ. Đây là nhánh Cung.", null],
  ["teams[8].variants[0]", "SP Viên Thiệu đổi Nằm Gai sang Xế Đao; Trương Xuân Hoa đổi Thịnh Khí sang Thời Cơ. Chỉ có bộ hai chiêu.", null],
  ["teams[10].variants[0]", "Sau cấp 20 Nhạc Tiến mang Thanh Châu; Thái Văn Cơ mang Tạm Lánh + Cắt Xương. Sĩ Tranh Tiên Phó chưa được xác nhận là alias của Nhanh Chân Tranh Đất.", null],
  ["teams[11].variants[0]", "Thay Thịnh Khí bằng Sĩ Biệt khi chuẩn bị đất 6.", "Bản mặc định giữ Thịnh Khí để quét đất 5; đối chiếu thủ quân trước khi đánh."],
  ["teams[11].variants[1]", "Dùng bộ chiêu này ngay sau cấp 20. Giữ ba mức thích tính khác nhau để Võ Phong hoạt động.", null],
  ["teams[11].heroes[0]", "Chủ tướng trước và sau cấp 20; cộng toàn Thống Soái. Sau cấp 20 cần thức tỉnh. Giữ ba mức thích tính khác nhau để Võ Phong Trận hoạt động. Sau điện 7, có thể luyện Trình Phổ đến cấp 20 để thay làm chủ tướng, giữ Võ Phong và đổi Thịnh Khí sang Lâm Nguy Cứu Chủ.", null],
  ["teams[11].heroes[1]", "Cộng khoảng 15 điểm Tốc Độ, còn lại Võ Lực; chỉnh tốc theo thủ quân. Cần có Thôi Phong Đoạn Nhẫn; không nhầm với Phá Phong Đoạn Nhẫn.", "Ưu tiên đất Thương, tránh đội tất trúng hoặc hỗn loạn."],
  ["teams[11].heroes[2]", "Cộng toàn Thống Soái trong giai đoạn đầu; khi chuyển Trình Phổ đánh đất cao, đổi sang toàn Trí Lực.", "Đối chiếu phiên bản chiến pháp, hột tướng và thủ quân của mùa đang chơi."],
  ["teams[12].heroes[2]", "Đồng Lòng Hợp Sức (勠力同心): chiến pháp sự kiện Chủ động, xác suất 50%, trị liệu và tăng Thống Soái.", null],
  ["teams[13].heroes[0]", "Có thể thay bằng Pháp Chính; đội Gia Cát Khác · SP Mã Siêu · Pháp Chính đã có riêng. Chiến pháp sau cấp 20 dùng khi đã thức tỉnh.", null],
  ["teams[14]", "Ở cấu hình mặc định, Trương Xuân Hoa cộng Trí Lực. Phương án thay Kích Kỳ Nọa Quy bằng 疾風豪雨 (chưa xác nhận tên Việt) có cách cộng điểm riêng: Trương Xuân Hoa cộng Thống Soái trước cấp 20, Trí Lực sau cấp 20.", "Mốc mở đất phụ thuộc hột tướng, trang bị, thủ quân và đội đánh hao; không áp mốc nhanh nhất cho mọi tài khoản."],
  ["teams[14].heroes[0]", "Cộng Thống Soái.", null],
  ["teams[14].heroes[1]", "Chủ tướng trước và sau cấp 20; cộng Võ Lực.", "Là nguồn sát thương chính của đội, ưu tiên Trương Phi nhiều hột. Có thể thay Kích Kỳ Nọa Quy bằng Phá Quân Uy Thắng."],
  ["teams[14].heroes[2]", "Cộng Trí Lực.", null],
  ["teams[15].heroes[0]", "Chỉ có dữ liệu sau cấp 20; không suy ra bộ trước cấp 20.", null],
  ["teams[15].heroes[1]", "Chỉ có dữ liệu sau cấp 20; không suy ra bộ trước cấp 20.", null],
  ["teams[15].heroes[2]", "Chỉ có dữ liệu sau cấp 20; không suy ra bộ trước cấp 20.", null],
];

test("Khác Bình Tiến uses spears in both opening phases", () => {
  const team = data.teams.find((t) => t.title === "Gia Cát Khác · Quan Ngân Bình · Nhạc Tiến");
  assert.equal(team.unitType, "Thương");
  for (const hero of team.heroes) {
    assert.equal(hero.unitTypeBefore, "Thương");
    assert.equal(hero.unitTypeAfter, "Thương");
  }
});

test("curated options are complete for each declared phase and preserve the roster", () => {
  assert.equal(data.season, "Binh Diễn Xuân Thu");
  for (const team of data.teams) {
    const variants = team.variants || [];
    assert.equal(new Set(variants.map((v) => v.id)).size, variants.length, team.title);
    for (const variant of variants) {
      const key = `${team.title}: ${variant.id}`;
      assert.ok(variant.id && variant.label && variant.region && variant.period && variant.note, key);
      assert.deepEqual(variant.heroes.map((h) => h.name).sort(), team.heroes.map((h) => h.name).sort(), key);
      assert.equal(Object.hasOwn(variant, "sources"), false, key);
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
            const tactic = tactics.find((t) => t.id === tacticId(name));
            assert.ok(tactic, `${key}: unknown ${name}`);
            assert.notEqual(tactic.type, "Nội chính", key);
            if (tactic.troopFit.length) {
              const compatibleUnits = tactic.troopFit.map((unit) => unit.replace(/ binh$/u, ""));
              assert.ok(compatibleUnits.includes(variant.unitType), `${key}: ${name}`);
            }
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
    assert.equal(Object.hasOwn(group, "sources"), false);
  }
  assert.match(data.chamSuTeams[0].note, /Điêu Thuyền, Hoàng Cái, Phùng Kỷ/);
  for (const team of data.teams) assert.equal(Object.hasOwn(team, "transforms"), false);
  for (const team of data.teams) assert.equal(Object.hasOwn(team, "sources"), false, team.title);
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
  // Tên lưu có thể là tên Việt cũ: bất biến là tên tra được ra một chiến pháp của danh mục.
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
        assert.ok(tacticId(tactic), `${team.title}: unknown split tactic ${tactic}`);
      }
    }
  }
});

/** Every object node in the document, paired with its path (`teams[0].variants[1]`). */
const objectNodes = (value, path = "", out = []) => {
  if (!value || typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value)) {
    const childPath = Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) out.push([childPath, child]);
    objectNodes(child, childPath, out);
  }
  return out;
};

test("every retired display note keeps its sentences in exactly one owner field", () => {
  const owners = objectNodes(data)
    .filter(([, node]) => Object.hasOwn(node, "buildNote") || Object.hasOwn(node, "openingNote"))
    .map(([path]) => path);
  assert.deepEqual(owners.sort(), noteMigration.map(([path]) => path).sort());

  let sentences = 0;
  for (const [path, build, opening] of noteMigration) {
    const owner = path.replace(/\[(\d+)\]/g, ".$1").split(".").reduce((node, key) => node[key], data);
    assert.deepEqual([owner.buildNote ?? null, owner.openingNote ?? null], [build, opening], path);
    sentences += [build, opening].filter(Boolean).join(" ").split(/(?<=\.)\s+/)
      .filter((sentence) => sentence.trim()).length;
  }
  assert.equal(sentences, 59);
});

test("the retired displayNote field is gone from the whole document", () => {
  const offenders = objectNodes(data)
    .filter(([, node]) => Object.hasOwn(node, "displayNote"))
    .map(([path]) => `${path}.displayNote`);
  assert.deepEqual(offenders, []);
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
