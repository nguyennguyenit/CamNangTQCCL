import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDateVi, formatBuildDate } from "../src/lib/build-date.ts";

test("ngày build theo giờ Việt Nam, không theo UTC", () => {
  // 16:59 UTC = 23:59 cùng ngày ở Việt Nam (UTC+7).
  assert.equal(formatBuildDate(new Date("2026-09-25T16:59:00Z")), "25/09/2026");
  // 17:01 UTC = 00:01 hôm sau ở Việt Nam.
  assert.equal(formatBuildDate(new Date("2026-09-25T17:01:00Z")), "26/09/2026");
  // Giao thừa năm: 31/12 18:00 UTC thành 01/01 năm sau.
  assert.equal(formatBuildDate(new Date("2025-12-31T18:00:00Z")), "01/01/2026");
  assert.equal(formatBuildDate(new Date("2026-01-01T00:30:00+07:00")), "01/01/2026");
});

test("mọi trang dùng chung một mốc đã memo", () => {
  const first = buildDateVi();
  assert.match(first, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(buildDateVi(), first, "gọi lần hai phải trả đúng mốc đã tính");
  assert.equal(first, formatBuildDate(new Date()), "mốc memo là ngày hôm nay theo giờ Việt Nam");
});
