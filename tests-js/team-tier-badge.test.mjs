import { test } from "node:test";
import assert from "node:assert/strict";
import { bestTier, tierClass } from "../js/render.js";

test("nhiều nguồn lệch -> bậc tốt nhất (T số nhỏ nhất)", () => {
  const rankings = [
    { source: "a", tier: "T1", updatedAt: "2026-06-20" },
    { source: "b", tier: "T0.5", updatedAt: "2026-06-26" },
    { source: "c", tier: "T2", updatedAt: "2026-06-10" },
  ];
  assert.equal(bestTier(rankings), "T0.5");
});

test("1 nguồn -> chính nó", () => {
  assert.equal(bestTier([{ source: "a", tier: "T0", updatedAt: "x" }]), "T0");
});

test("rỗng / null -> null (không badge)", () => {
  assert.equal(bestTier([]), null);
  assert.equal(bestTier(null), null);
});

test("tierClass: chấm -> gạch (T0.5 -> t-05)", () => {
  assert.equal(tierClass("T0"), "t-0");
  assert.equal(tierClass("T0.5"), "t-05");
  assert.equal(tierClass("T1.5"), "t-15");
  assert.equal(tierClass("T3"), "t-3");
});
