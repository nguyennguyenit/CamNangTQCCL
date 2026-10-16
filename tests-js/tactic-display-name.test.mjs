import test from "node:test";
import assert from "node:assert/strict";
import { createTacticDisplayName } from "../js/lookup-ids.js";
import { projectRecommendedRows, setTacticDisplayName, tacticDisplayName } from "../js/recommended-reference-state.js";

const tactics = [
  { id: "tactic:chan-hai-tu-canh", viet: "Bốn Bề Rung Động", hanViet: "Chấn Hãi Tứ Cảnh", chinese: "震駭四境", aliases: ["震骇四境"] },
  { id: "tactic:phong-thi-tran", viet: "Phong Thỉ Trận", hanViet: "Phong Thỉ Trận", chinese: "鋒矢陣", aliases: [] },
  { id: "tactic:di-hoa-tiep-moc", viet: "Lập Lờ Đánh Tráo", hanViet: "Di Hoa Tiếp Mộc", chinese: "移花接木", aliases: [] },
  { id: "tactic:lap-lo-danh-trao", viet: "Lập Lờ Đánh Tráo", hanViet: "Lập Lờ Đánh Tráo", chinese: "", aliases: [] },
];

test("tên chiến pháp lưu (Việt cũ, Hán-Việt hoặc chữ Hán nguồn) hiện đúng `viet` của danh mục", () => {
  const display = createTacticDisplayName(tactics);
  assert.equal(display("Chấn Hãi Tứ Cảnh"), "Bốn Bề Rung Động");
  assert.equal(display("Chấn Hãi Tứ Cảnh", "震駭四境"), "Bốn Bề Rung Động");
  assert.equal(display(null, "震骇四境"), "Bốn Bề Rung Động");
  assert.equal(display("Bốn Bề Rung Động"), "Bốn Bề Rung Động");
  // Tiền tố cải tạo giữ nguyên; ô nhiều lựa chọn tra từng phần.
  assert.equal(display("Tinh · Chấn Hãi Tứ Cảnh"), "Tinh · Bốn Bề Rung Động");
  assert.equal(display("Chấn Hãi Tứ Cảnh / Phong Thỉ Trận"), "Bốn Bề Rung Động / Phong Thỉ Trận");
  // Trùng `viet` ở hai mã: tên cũ vẫn về đúng mã của nó.
  assert.equal(display("Di Hoa Tiếp Mộc"), "Lập Lờ Đánh Tráo");
  // Không tra được thì giữ nguyên chuỗi lưu (kể cả tên ghép đội hình và văn xuôi).
  assert.equal(display("40Y Lữ Bố Cung (Tinh·Tiên Đăng Tử Sĩ)"), "40Y Lữ Bố Cung (Tinh·Tiên Đăng Tử Sĩ)");
  assert.equal(display("Không Có"), "Không Có");
  assert.equal(display(undefined), undefined);
});

test("bộ hiển thị của trang: bản vi đổi tên, chưa đặt bộ tra thì giữ nguyên, tìm bằng tên cũ hoặc mới đều ra đội", () => {
  try {
    assert.equal(tacticDisplayName("Chấn Hãi Tứ Cảnh"), "Chấn Hãi Tứ Cảnh");
    setTacticDisplayName(createTacticDisplayName(tactics));
    assert.equal(tacticDisplayName("Chấn Hãi Tứ Cảnh", "震駭四境"), "Bốn Bề Rung Động");
    assert.equal(tacticDisplayName("Chấn Hãi Tứ Cảnh", null, "zh"), "Chấn Hãi Tứ Cảnh");
    const row = {
      sourceConfigId: "cfg-1",
      displayNameVi: "Đội thử",
      heroes: [{ displayNameVi: "Tướng", nameRaw: "將", tacticSlotsRaw: ["震駭四境"], tacticSlotsVi: ["Chấn Hãi Tứ Cảnh"] }],
    };
    const find = (query) => projectRecommendedRows([row], { query, filters: {}, season: "all" }, {}).length;
    assert.equal(find("Bốn Bề Rung Động"), 1);
    assert.equal(find("Chấn Hãi Tứ Cảnh"), 1);
    assert.equal(find("không có tên này"), 0);
  } finally {
    setTacticDisplayName(null);
  }
});
