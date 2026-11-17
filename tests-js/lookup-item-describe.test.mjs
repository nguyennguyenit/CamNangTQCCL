// Mô tả meta (cũng là `description` của JSON-LD) của trang riêng một mục Kỳ lược: đúng nhóm (không rơi vào nhánh công
// trình), dùng nhãn đóng của hợp đồng catalog, và bản zh không mang chữ Hán dịch từ tiếng Việt (docs/unified-lookup.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { describe } from "../src/lib/lookup-item-pages.ts";
import { buildLookupCorpus } from "../js/unified-lookup.js";
import { catalogDoc } from "./fixtures/lookup-bundle-fixtures.mjs";

const corpus = buildLookupCorpus({ catalog: catalogDoc() });
const meta = (id, locale) => describe("qilue", corpus.byId.get(id), locale, corpus);

test("meta thẻ kỳ lược: tên, nhãn thẻ, loại, đối tượng và hiệu ứng nguyên văn (vi); tên game, nhãn Trung và phương lược (zh)", () => {
  assert.equal(meta("qilue-card:bo-tri-thap-dien", "vi"), "Bố Trí Thập Diện — thẻ kỳ lược Mưu · Nhóm quân ta: Hiệp này Chiến Pháp Chủ Động tỉ lệ phát động tăng 10%");
  assert.equal(meta("qilue-card:bo-tri-thap-dien", "zh"), "設伏十面（奇略卡，謀·我軍群體）：可用于謀算、襲擾作战方略。");
  assert.equal(meta("qilue-card:cang-nhieu-cang-tot", "vi"), "Càng Nhiều Càng Tốt — thẻ kỳ lược Mưu · Hiếm · Toàn quân ta: Hiệu ứng hiếm Mưu");
  assert.equal(meta("qilue-card:an-tich-mang-thuong", "zh"), "芒碭隱蹤（奇略卡，濟·敵軍單體）。");
});

test("meta phương lược: nhãn phương lược và loại thẻ; bản zh không có chữ dịch", () => {
  assert.equal(meta("qilue-strategy:cuong-cong", "vi"), "Cường Công — phương lược kỳ lược, dùng thẻ Dũng, Phụ: Mô tả Cường Công");
  assert.equal(meta("qilue-strategy:cuong-cong", "zh"), "強攻（奇略·作战方略）：可装备勇、輔类奇略卡。");
});

test("meta kỳ lược không rơi vào nhánh công trình và bản zh không chứa chữ Hán dịch (hiệu ứng, mô tả, buff)", () => {
  for (const item of corpus.groups.qilue) {
    for (const locale of ["vi", "zh"]) {
      const text = meta(item.id, locale);
      assert.doesNotMatch(text, /công trình|建筑|cấp tối đa|最高/u, `${item.id} ${locale}`);
    }
    const zh = meta(item.id, "zh");
    for (const field of ["effectZh", "descriptionZh", "buffZh"]) {
      if (item.record[field]) assert.ok(!zh.includes(item.record[field]), `${item.id} zh meta chứa ${field}`);
    }
  }
});
