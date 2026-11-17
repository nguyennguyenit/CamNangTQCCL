// Ô kỳ lược trên trang chi tiết Đội chuẩn qua đúng đường build (`src/lib/team-ssr.ts`): bảng tra kỳ lược dựng từ
// lookup-catalog.json đã pin của publication, đội nguồn của dạng chép tra trong index cùng generation; thứ tự section
// Đội hình → Kỳ lược → Ghi chú; chữ llms có dòng kỳ lược gọn. Bản ghi thật của generation + `qilue` fixture (generation
// đang publish chưa có `qilue`).
import assert from "node:assert/strict";
import { test } from "node:test";
import { recommendedDetailParts, recommendedDetailText } from "../src/lib/team-ssr.ts";
import { websiteDisplayPublicationSnapshot } from "../src/lib/root-static-artifacts.ts";
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";

const parse = (bytes) => JSON.parse(Buffer.from(bytes).toString("utf8"));
const OFFICIAL = "s27-official-wumou-qi";
const COPY = "s27-lp-beifa-qiang";
const COPY_SOURCE = "s27-lp-wumou-ay";

async function detailRecord(sourceConfigId) {
  const website = await websiteDisplayPublicationSnapshot();
  const row = parse(website.recommended.files["index.json"]).records.find((item) => item.sourceConfigId === sourceConfigId);
  assert.ok(row, `${sourceConfigId} có trong generation`);
  const record = parse(website.recommended.files[`details-${row.safeScopeKey}.json`]).records.find((item) => item.sourceConfigId === sourceConfigId);
  return structuredClone(record);
}

async function officialRecord() {
  const record = await detailRecord(OFFICIAL);
  const block = record.displayNotes.blocks.find((item) => item.textRaw.startsWith("作戰方略：謀算。奇略卡"));
  assert.ok(block, "ghi chú nguồn có đoạn kỳ lược chính thức");
  record.qilue = {
    strategyId: "qilue-strategy:muu-tinh",
    cardIds: ["bo-tri-thap-dien", "dan-tran-tu-chien", "so-ca-tu-khoi", "cang-nhieu-cang-tot", "hop-vay-giap-kich"].map((slug) => `qilue-card:${slug}`),
    ordered: true,
    form: "official",
    hideNoteBlockId: block.id,
  };
  return { record, block };
}

test("trang chi tiết dựng sẵn: Đội hình → Kỳ lược → Ghi chú, ô hiệp link Tra cứu, block trùng bị ẩn (vi + zh)", async () => {
  const { record, block } = await officialRecord();
  for (const locale of ["vi", "zh"]) {
    const { bodyHtml } = await recommendedDetailParts(record, null, locale);
    const lineup = bodyHtml.indexOf(locale === "zh" ? "<h2>阵容</h2>" : "<h2>Đội hình</h2>");
    const qilue = bodyHtml.indexOf('class="detail-section detail-qilue"');
    const notes = bodyHtml.indexOf("detail-notes");
    assert.ok(lineup >= 0 && lineup < qilue && qilue < notes, `${locale}: thứ tự section`);
    const prefix = locale === "zh" ? "/zh" : "";
    assert.ok(bodyHtml.includes(`href="${prefix}/tra-cuu/ky-luoc/bo-tri-thap-dien/"`), `${locale}: link thẻ Hiệp 2`);
    assert.ok(bodyHtml.includes(`href="${prefix}/tra-cuu/ky-luoc/muu-tinh/"`), `${locale}: link phương lược`);
    assert.ok(bodyHtml.includes(locale === "zh" ? "第2回合" : "Hiệp 2"));
    assert.ok(!bodyHtml.includes(locale === "zh" ? block.textRaw : block.textVi), `${locale}: block ghi chú trùng bị ẩn`);
  }
});

test("chữ llms: dòng kỳ lược gọn thay cho lưới ô, block trùng không lặp lại", async () => {
  const { record, block } = await officialRecord();
  const text = await recommendedDetailText(record, null, "vi");
  assert.ok(text.includes("Kỳ lược (Mưu tính): Hiệp 2 Bố Trí Thập Diện, Hiệp 3 Dàn Trận Tử Chiến, Hiệp 4 Sở Ca Tứ Khởi, Hiệp 5 Càng Nhiều Càng Tốt, Hiệp 6 Hợp Vây Giáp Kích"), text);
  assert.ok(!text.includes(block.textVi));
  assert.ok(text.indexOf("Kỳ lược (Mưu tính)") < text.indexOf("Ghi chú"), "dòng kỳ lược đứng trước Ghi chú");
});

test("dạng chép: link tới trang đội nguồn tra theo sourceConfigId trong cùng generation", async () => {
  const record = await detailRecord(COPY);
  record.qilue = { strategyId: null, cardIds: [], ordered: false, form: "copy", copyFrom: [COPY_SOURCE] };
  const catalog = await teamDetailCatalog();
  const entry = catalog.recommended.find((item) => item.sourceConfigId === COPY_SOURCE);
  for (const locale of ["vi", "zh"]) {
    const { bodyHtml } = await recommendedDetailParts(record, null, locale);
    assert.ok(bodyHtml.includes(`href="${locale === "zh" ? "/zh" : ""}${entry.routePath}"`), `${locale}: link đội nguồn`);
    assert.ok(bodyHtml.includes(locale === "zh" ? "沿用此队奇略：" : "Dùng kỳ lược của:"), locale);
  }
});
