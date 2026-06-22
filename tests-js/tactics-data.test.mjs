// TDD data/tactics.json — manual tactic details entered from in-game screenshots.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tactics = JSON.parse(await readFile(new URL("../data/tactics.json", import.meta.url), "utf8"));

test("Toàn Quân Đồng Lòng has in-game details", () => {
  const tactic = tactics.find((item) => item.viet === "Toàn Quân Đồng Lòng");

  assert.ok(tactic, "missing tactic");
  assert.equal(tactic.chinese, "众志成城");
  assert.equal(tactic.hanViet, "Chúng Chí Thành Thành");
  assert.equal(tactic.quality, "S");
  assert.equal(tactic.type, "Chỉ huy");
  assert.equal(tactic.pending, undefined);
  assert.match(tactic.effect, /18%→36%/);
  assert.match(tactic.effect, /治疗率48%→96%/);
  assert.match(tactic.effect, /谋略伤害/);
});

const inGameVietnameseTactics = [
  {
    chinese: "所向披靡",
    viet: "Đánh Đâu Thắng Đó",
    type: "Chủ động",
    target: "Tập thể địch (3 người)",
    effect: "Chuẩn bị 1 hiệp, phát động 1 lần tấn công Binh Đao cho toàn thể quân địch (tỷ lệ sát thương 123%→246%)",
  },
  {
    chinese: "克敌制胜",
    viet: "Khắc Địch Chế Thắng",
    type: "Đột kích",
    target: "Một quân địch",
    effect: "Sau khi tấn công thường, gây thêm cho mục tiêu tấn công 1 lần sát thương Mưu Lược (tỉ lệ sát thương 90%→180%, bị Trí Lực ảnh hưởng); Nếu mục tiêu đang mang ít nhất 1 trong 3 trạng thái: Bỏ Chạy, Trúng Độc hoặc Đốt Cháy, thì sẽ có 85% xác suất khiến mục tiêu rơi vào trạng thái Suy Nhược, duy trì 1 hiệp",
  },
  {
    chinese: "合军聚众",
    viet: "Hợp Quân Tụ Chúng",
    type: "Bị động",
    target: "Tôi",
    effect: "Trong chiến đấu, bản thân mỗi hiệp hồi phục Binh Lực nhất định (tỷ lệ Trị Liệu 62%→124%, chịu ảnh hưởng thuộc tính cao hơn trong: Thống Soái hoặc Trí Lực)",
  },
  {
    chinese: "盛气凌敌",
    viet: "Thịnh Khí Linh Địch",
    type: "Chỉ huy",
    target: "Tập thể địch (2 người)",
    effect: "2 hiệp đầu, làm cho tập thể quân địch (2 người) mỗi hiệp đều có 45%→90% xác suất rơi vào trạng thái Giao Binh Khí, không thể tiến hành tấn công thường",
  },
  {
    chinese: "破阵摧坚",
    viet: "Phá Trận Thôi Kiên",
    type: "Chủ động",
    target: "Tập thể địch (2 người)",
    effect: "Chuẩn bị 1 hiệp, khiến thuộc tính chiến đấu của nhóm địch (2 người) giảm 40→80 điểm (bị Võ Lực ảnh hưởng), duy trì 2 hiệp, và phát động 1 lần tấn công Binh Đao lên nhóm địch (tỷ lệ sát thương 79%→158%)",
  },
  {
    chinese: "折冲御侮",
    viet: "Đánh Bại Quân Địch",
    type: "Đột kích",
    target: "Một quân địch",
    effect: "Sau khi tấn công thường, làm cho cá thể quân địch ngẫu nhiên giảm 100 điểm Thống Soái và Trí Lực, duy trì 2 hiệp; nếu bản thân không phải là Tướng Chính, sẽ khiến Tướng Chính quân ta nhận thêm 2 lần Chống Đỡ, duy trì 2 hiệp",
  },
];

test("six tactics match Vietnamese in-game screenshots", () => {
  for (const expected of inGameVietnameseTactics) {
    const matches = tactics.filter((item) => item.chinese === expected.chinese);
    assert.equal(matches.length, 1, `${expected.chinese} must have one record`);
    for (const field of ["viet", "type", "target", "effect"]) {
      assert.equal(matches[0][field], expected[field], `${expected.chinese}.${field}`);
    }
  }
});

test("generated data keeps Đánh Bại Quân Địch references", async () => {
  for (const file of ["teams.json", "khaihoang.json", "coexist.json", "facets.json"]) {
    const content = await readFile(new URL(`../data/${file}`, import.meta.url), "utf8");
    assert.match(content, /Đánh Bại Quân Địch/, file);
  }
});
