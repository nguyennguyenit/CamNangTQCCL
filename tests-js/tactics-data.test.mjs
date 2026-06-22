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
