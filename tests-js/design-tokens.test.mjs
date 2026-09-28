import assert from "node:assert/strict";
import test from "node:test";

import { contrastProblems, readTokens } from "../scripts/design-tokens.mjs";

/** Bộ token tối thiểu: một cặp nền/thẻ ở theme tối, ngưỡng khai trong `meta.contrast`. */
function tokensWith({ bg, panel, min }) {
  return {
    meta: { contrast: [{ theme: "dark", fg: "--panel", bg: "--bg", min, role: "nền thẻ ↔ nền trang" }] },
    color: {
      light: { bg: { var: "--bg", value: "#F3EEE3" }, panel: { var: "--panel", value: "#FFFCF5" } },
      dark: { bg: { var: "--bg", value: bg }, panel: { var: "--panel", value: panel } },
    },
  };
}

test("contrast gate: a dark pair below its threshold is reported with both values and the ratio", () => {
  const problems = contrastProblems(tokensWith({ bg: "#16140F", panel: "#201D18", min: 1.25 }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /dark/);
  assert.match(problems[0], /--panel/);
  assert.match(problems[0], /1\.10/);
  assert.match(problems[0], /1\.25/);
});

test("contrast gate: a pair at or above its threshold passes, measured on the dark value not the light one", () => {
  assert.deepEqual(contrastProblems(tokensWith({ bg: "#0F0E0C", panel: "#28251F", min: 1.25 })), []);
});

test("contrast gate: a pair naming an unknown token fails instead of being skipped", () => {
  const tokens = tokensWith({ bg: "#0F0E0C", panel: "#28251F", min: 1.25 });
  tokens.meta.contrast[0].fg = "--missing";
  assert.match(contrastProblems(tokens)[0], /--missing/);
});

test("committed tokens meet every declared contrast threshold", async () => {
  const tokens = await readTokens();
  assert.ok(tokens.meta.contrast.length > 0, "tokens.json phải khai ngưỡng tương phản");
  assert.deepEqual(contrastProblems(tokens), []);
});
