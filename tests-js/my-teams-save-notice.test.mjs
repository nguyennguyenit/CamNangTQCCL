// Toast "Đã lưu": tên chưa đối chiếu (sửa được trong Đội của tôi) và nội dung bị bỏ vì vượt trần (không có trong đội
// đã lưu) là hai thông báo khác nhau; nội dung bị bỏ không được báo như thể sửa được.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unresolvedNotice } from "../js/my-teams-save-button.js";
import { withLocale } from "../js/i18n.js";
import { fromRecommended } from "../js/my-teams-sources.js";
import { ids, recommendedById } from "./support/my-teams-fixtures.mjs";

const name = (field) => ({ field, rawName: "某", reason: "unresolved" });
const cut = (field) => ({ field, rawName: "x", reason: "over-limit" });

test("không có gì để báo: chuỗi rỗng", () => {
  assert.equal(unresolvedNotice([]), "");
  assert.equal(unresolvedNotice(undefined), "");
});

test("dòng ghi chú bị bỏ được báo là không được lưu, không nói 'sửa trong Đội của tôi'", () => {
  const { unresolved } = fromRecommended(recommendedById("s27-lp-juma-gong-ay"), ids, { id: "t" });
  const notes = unresolved.filter((item) => item.field === "notes.general").length;
  assert.ok(notes >= 1);
  const text = unresolvedNotice(unresolved);
  assert.match(text, new RegExp(`${notes} dòng ghi chú vượt giới hạn dung lượng nên không được lưu`));
  assert.ok(text.includes("bản đầy đủ vẫn ở trang nguồn"));
  assert.equal(text.includes("chưa đối chiếu"), unresolved.some((item) => item.reason !== "over-limit"));
});

test("ba loại đếm riêng: tên chưa đối chiếu, ghi chú bị bỏ, phương án thay bị bỏ", () => {
  const text = unresolvedNotice([name("heroes[0].hero"), name("heroes[1].tactics[0]"), cut("notes.general"), cut("heroes[0].tactics[1].alternatives")]);
  assert.ok(text.includes("Có 2 mục chưa đối chiếu được, bạn có thể sửa trong Đội của tôi."));
  assert.ok(text.includes("1 dòng ghi chú vượt giới hạn dung lượng nên không được lưu"));
  assert.ok(text.includes("1 phương án thay vượt giới hạn nên không được lưu."));
});

test("bản zh dùng chữ Trung", () => {
  const text = withLocale("zh", () => unresolvedNotice([name("heroes[0].hero"), cut("notes.general")]));
  assert.ok(text.includes("1 项未能匹配"));
  assert.ok(text.includes("1 行备注超出容量上限"));
  assert.ok(!/[à-ỹ]/u.test(text));
});
