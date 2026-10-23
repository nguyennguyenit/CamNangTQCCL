import { test } from "node:test";
import assert from "node:assert/strict";
import { boxLabel } from "../js/my-teams-ui.js";

test("L2. boxLabel: main đã đổi tên hiện tên đã lưu; main tên mặc định hiện nhãn theo ngôn ngữ; hộp khác giữ tên", () => {
  assert.equal(boxLabel({ id: "main", name: "Kho chính của tôi" }), "Kho chính của tôi");
  assert.equal(boxLabel({ id: "main", name: "Hộp chính" }), "Hộp chính");
  assert.equal(boxLabel({ id: "main", name: "" }), "Hộp chính");
  assert.equal(boxLabel({ id: "box-ab12", name: "Hộp phụ" }), "Hộp phụ");
});
