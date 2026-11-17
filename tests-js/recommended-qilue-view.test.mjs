// Ô kỳ lược trên trang chi tiết Đội chuẩn (`qilue` của bản ghi, xem pipeline/recommended_qilue.py): section "Kỳ lược"
// nằm giữa Đội hình và Ghi chú; phương lược + thẻ link tới trang riêng Tra cứu (`lookupItemPath`); bốn dạng hiển thị
// (có thứ tự kèm phương lược, có thứ tự không phương lược, không thứ tự, chép của đội khác); bản zh dùng `nameZh`;
// block ghi chú trùng (`hideNoteBlockId`) bị ẩn. Bản ghi là fixture: generation đang publish chưa có `qilue`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { treeToHtml, treeToText } from "../js/view-tree.js";
import { lookupItemPath } from "../js/lookup-ids.js";
import { setTeamRouteHandles } from "../js/team-detail-navigation.js";
import { qilueLookupTable, recommendedTeamDetailContent } from "../js/recommended-reference-render.js";

const catalog = JSON.parse(readFileSync(new URL("../data/lookup-catalog.json", import.meta.url), "utf8"));
const qilueTable = qilueLookupTable(catalog);

const OFFICIAL_NOTE = "作戰方略：謀算。奇略卡（第 2→6 回合）：設伏十面→背水列陣→楚歌四起→多多益善→合圍夾擊。";
const OFFICIAL_NOTE_VI = "Phương lược tác chiến: Mưu Toán. Thẻ Kỳ Lược (hiệp 2→6): Thiết Phục Thập Diện→Bối Thủy Liệt Trận→Sở Ca Tứ Khởi→Đa Đa Ích Thiện→Hợp Vi Giáp Kích.";
const hero = (nameRaw, displayNameVi) => ({ nameRaw, displayNameVi, tacticSlotsRaw: [], tacticSlotsVi: [], bookSlotsRaw: [], bookSlotsVi: [] });
const team = (sourceConfigId, displayNameVi, nameZh, qilue, blocks = []) => ({
  sourceConfigId,
  displayNameVi,
  nameZh,
  heroes: [hero("荀彧", "Tuân Úc"), hero("荀攸", "Tuân Du"), hero("郭嘉", "Quách Gia")],
  displayNotes: { schemaVersion: 1, blocks },
  ...(qilue ? { qilue } : {}),
});

const ORDERED_CARDS = [
  "qilue-card:bo-tri-thap-dien",
  "qilue-card:dan-tran-tu-chien",
  "qilue-card:so-ca-tu-khoi",
  "qilue-card:cang-nhieu-cang-tot",
  "qilue-card:hop-vay-giap-kich",
];
const LIST_CARDS = [
  "qilue-card:bo-tri-thap-dien",
  "qilue-card:bac-lang-chuy-tan",
  "qilue-card:lui-buoc-cong-thanh",
  "qilue-card:hop-vay-giap-kich",
  "qilue-card:so-ca-tu-khoi",
];
const official = team("s27-official-wumou-qi", "Ngũ Mưu Kỵ", "五謀騎", {
  strategyId: "qilue-strategy:muu-tinh", cardIds: ORDERED_CARDS, ordered: true, form: "official", hideNoteBlockId: "p-2",
}, [
  { id: "p-1", owner: "team", textRaw: "台服官方推薦指數 ★★★★★｜謀算方略", textVi: "Chỉ số đề xuất chính thức ★★★★★｜Phương lược Mưu Toán" },
  { id: "p-2", owner: "team", textRaw: OFFICIAL_NOTE, textVi: OFFICIAL_NOTE_VI },
]);
const fixed = team("s27-lp-zuolv-qiang", "Tả Lữ Thương", "左呂槍", {
  strategyId: null,
  cardIds: ["qilue-card:phong-lang-cu-tu", "qilue-card:can-quet-tay-ha", "qilue-card:pha-mui-giap-dich"],
  ordered: true,
  form: "fix",
});
const listed = team("s27-lp-wumou-ay", "Ngũ Mưu Thần", "五謀臣", {
  strategyId: null, cardIds: LIST_CARDS, ordered: false, form: "list",
}, [{ id: "p-1", owner: "team", textRaw: "奇略：設伏十面、博浪椎秦、功成身退、合圍夾擊、楚歌四起。", textVi: "Kỳ Lược: Thiết Phục Thập Diện, …" }]);
const copied = team("s27-lp-beifa-qiang", "Bắc Phạt Thương", "北伐槍", {
  strategyId: null, cardIds: [], ordered: false, form: "copy", copyFrom: ["s27-lp-wumou-ay"],
}, [{ id: "p-1", owner: "team", textRaw: "奇略：復刻五謀奇略。", textVi: "Kỳ Lược: tái hiện Kỳ Lược Ngũ Mưu." }]);
const plain = team("s27-plain", "Không kỳ lược", "無奇略", null, [{ id: "p-1", owner: "team", textRaw: "普通備註", textVi: "Ghi chú thường" }]);

const qilueTeams = new Map([official, fixed, listed, copied].map((row) => [row.sourceConfigId, row]));
const SOURCE_SEGMENT = "pk-s27-ngu-muu-than-ay";
assert.ok(setTeamRouteHandles({ r: { [listed.sourceConfigId]: SOURCE_SEGMENT }, l: {}, k: {} }));

const detail = (record, locale = "vi", extra = {}) => recommendedTeamDetailContent(record, { qilueTable, qilueTeams, locale, ...extra });
const html = (trees) => [].concat(trees).map(treeToHtml).join("");
const qilueHtml = (trees) => html([].concat(trees).filter((tree) => /\bdetail-qilue\b/.test(tree?.attrs?.class ?? "")));
const hrefs = (markup) => [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
const cardPath = (id, locale = "vi") => `${locale === "zh" ? "/zh" : ""}${lookupItemPath(id)}`;
const rounds = (markup) => [...markup.matchAll(/class="detail-qilue-round-label">([^<]+)</g)].map((match) => match[1]);

test("bảng tra kỳ lược dựng từ lookup-catalog: đủ 5 phương lược + 40 thẻ, mỗi mã có tên vi/zh, loại và độ hiếm", () => {
  const ids = Object.keys(qilueTable);
  assert.equal(ids.filter((id) => id.startsWith("qilue-strategy:")).length, 5);
  assert.equal(ids.filter((id) => id.startsWith("qilue-card:")).length, 40);
  assert.deepEqual(qilueTable["qilue-card:bo-tri-thap-dien"], { nameVi: "Bố Trí Thập Diện", nameZh: "設伏十面", type: "muu", rarity: "common" });
  assert.equal(qilueTable["qilue-strategy:muu-tinh"].nameZh, "謀算");
  assert.throws(() => qilueLookupTable({ qilueStrategies: [] }), /qilueCards/);
});

test("dạng có thứ tự (official): chip phương lược + 5 ô Hiệp 2…6, mỗi thẻ link trang riêng Tra cứu, nhãn loại, dấu Hiếm", () => {
  const trees = detail(official);
  const markup = qilueHtml(trees);
  assert.ok(markup, "có section Kỳ lược");
  assert.match(markup, /<h2>Kỳ lược<\/h2>/);
  assert.match(markup, /class="detail-qilue-chip is-link" href="\/tra-cuu\/ky-luoc\/muu-tinh\/"[^>]*>Mưu tính</);
  assert.deepEqual(rounds(markup), ["Hiệp 2", "Hiệp 3", "Hiệp 4", "Hiệp 5", "Hiệp 6"]);
  assert.match(markup, /class="detail-qilue-rounds" data-count="5"/);
  assert.deepEqual(hrefs(markup), [cardPath("qilue-strategy:muu-tinh"), ...ORDERED_CARDS.map((id) => cardPath(id))]);
  const first = markup.match(/<li class="detail-qilue-round">.*?<\/li>/s)[0];
  assert.ok(first.includes("Hiệp 2") && first.includes("Bố Trí Thập Diện") && first.includes('data-tone="muu"') && first.includes(">Mưu<"));
  assert.equal((markup.match(/class="lookup-qilue-rare"/g) ?? []).length, 1, "chỉ Càng Nhiều Càng Tốt là thẻ hiếm");
  assert.match(markup, /Càng Nhiều Càng Tốt<\/span><span class="detail-qilue-marks"><span class="lookup-qilue-tag" data-tone="muu">Mưu<\/span><span class="lookup-qilue-rare">Hiếm</);
  assert.ok(!markup.includes("Nguồn không ghi thứ tự hiệp"));
});

test("dạng có thứ tự không phương lược (fix/bare 3 thẻ): không chip, đúng 3 ô Hiệp 2…4", () => {
  const markup = qilueHtml(detail(fixed));
  assert.ok(!markup.includes("detail-qilue-chip"));
  assert.ok(!markup.includes("detail-qilue-strategy"));
  assert.deepEqual(rounds(markup), ["Hiệp 2", "Hiệp 3", "Hiệp 4"]);
  assert.match(markup, /data-count="3"/);
  assert.equal((markup.match(/<li class="detail-qilue-round">/g) ?? []).length, 3);
});

test("dạng không thứ tự (list): chú thích 'Nguồn không ghi thứ tự hiệp' + chip thẻ, không có ô hiệp", () => {
  const markup = qilueHtml(detail(listed));
  assert.ok(markup.includes("Nguồn không ghi thứ tự hiệp"));
  assert.deepEqual(rounds(markup), []);
  assert.ok(!markup.includes("detail-qilue-rounds"));
  assert.deepEqual(hrefs(markup), LIST_CARDS.map((id) => cardPath(id)));
});

test("dạng chép (copy): 'Dùng kỳ lược của' + link trang đội nguồn, kèm ô kỳ lược của đội nguồn", () => {
  const markup = qilueHtml(detail(copied));
  assert.match(markup, /Dùng kỳ lược của:/);
  assert.match(markup, new RegExp(`<a class="detail-qilue-team" href="/doi-chuan/${SOURCE_SEGMENT}/"[^>]*>Ngũ Mưu Thần</a>`));
  assert.ok(markup.includes("Nguồn không ghi thứ tự hiệp"), "ô của đội nguồn (dạng list) hiện kèm");
  for (const id of LIST_CARDS) assert.ok(hrefs(markup).includes(cardPath(id)));
  // Đội nguồn không có kỳ lược trong generation (chưa republish): chỉ còn dòng link.
  const bare = new Map(qilueTeams);
  bare.set(listed.sourceConfigId, { ...listed, qilue: undefined });
  const linkOnly = qilueHtml(detail(copied, "vi", { qilueTeams: bare }));
  assert.match(linkOnly, /Dùng kỳ lược của:/);
  assert.ok(!linkOnly.includes("detail-qilue-card"));
  // Đội nguồn không có trong generation: dữ liệu hỏng, build dừng thay vì hiện link rỗng.
  assert.throws(() => detail(copied, "vi", { qilueTeams: new Map() }), /qilue copy source/);
});

test("bản zh: nhãn 奇略/回合, tên thẻ và phương lược theo nameZh, href có tiền tố /zh, không lộ chữ Việt của ô", () => {
  const markup = qilueHtml(detail(official, "zh"));
  assert.match(markup, /<h2>奇略<\/h2>/);
  assert.ok(markup.includes(">謀算<"));
  assert.ok(markup.includes("設伏十面") && markup.includes("多多益善"));
  assert.deepEqual(rounds(markup), ["第2回合", "第3回合", "第4回合", "第5回合", "第6回合"]);
  assert.ok(markup.includes(">謀<") && markup.includes(">稀有<"));
  assert.deepEqual(hrefs(markup), [cardPath("qilue-strategy:muu-tinh", "zh"), ...ORDERED_CARDS.map((id) => cardPath(id, "zh"))]);
  for (const vi of ["Kỳ lược", "Hiệp", "Mưu tính", "Bố Trí Thập Diện", "Hiếm"]) assert.ok(!markup.includes(vi), vi);
  const listedZh = qilueHtml(detail(listed, "zh"));
  assert.ok(listedZh.includes("来源未注明回合顺序"));
  const copiedZh = qilueHtml(detail(copied, "zh"));
  assert.match(copiedZh, new RegExp(`href="/zh/doi-chuan/${SOURCE_SEGMENT}/"[^>]*>五謀臣</a>`));
});

test("đội không có qilue (hoặc build không truyền bảng tra) thì không có section, ghi chú giữ nguyên", () => {
  for (const locale of ["vi", "zh"]) {
    const markup = html(detail(plain, locale));
    assert.ok(!markup.includes("detail-qilue"), locale);
    assert.ok(markup.includes(locale === "zh" ? "普通備註" : "Ghi chú thường"), locale);
  }
  const noTable = html(recommendedTeamDetailContent(official, { locale: "vi" }));
  assert.ok(!noTable.includes("detail-qilue"));
  assert.ok(noTable.includes(OFFICIAL_NOTE_VI), "không có section thì block ghi chú không bị ẩn");
});

test("block ghi chú trùng (hideNoteBlockId) bị ẩn trên trang chi tiết; block khác giữ; Kỳ lược nằm giữa Đội hình và Ghi chú", () => {
  for (const locale of ["vi", "zh"]) {
    const markup = html(detail(official, locale));
    assert.ok(!markup.includes(locale === "zh" ? OFFICIAL_NOTE : OFFICIAL_NOTE_VI), `${locale}: block p-2 bị ẩn`);
    assert.ok(markup.includes(locale === "zh" ? "台服官方推薦指數" : "Chỉ số đề xuất chính thức"), `${locale}: block p-1 còn`);
    const lineup = markup.indexOf(locale === "zh" ? "<h2>阵容</h2>" : "<h2>Đội hình</h2>");
    const qilue = markup.indexOf("detail-qilue");
    const notes = markup.indexOf("detail-notes");
    assert.ok(lineup >= 0 && lineup < qilue && qilue < notes, `${locale}: thứ tự Đội hình → Kỳ lược → Ghi chú`);
  }
  // Mã block không khớp thì không ẩn gì.
  const other = { ...official, qilue: { ...official.qilue, hideNoteBlockId: "p-9" } };
  assert.ok(html(detail(other)).includes(OFFICIAL_NOTE_VI));
});

test("chữ thuần (llms): section kỳ lược thu về một dòng gọn theo từng dạng", () => {
  const text = (record, locale = "vi") => treeToText(detail(record, locale, { plainText: true }));
  assert.ok(text(official).includes("Kỳ lược (Mưu tính): Hiệp 2 Bố Trí Thập Diện, Hiệp 3 Dàn Trận Tử Chiến, Hiệp 4 Sở Ca Tứ Khởi, Hiệp 5 Càng Nhiều Càng Tốt, Hiệp 6 Hợp Vây Giáp Kích"));
  assert.ok(text(fixed).includes("Kỳ lược: Hiệp 2 Phong Lang Cư Tư, Hiệp 3 Càn Quét Tây Hà, Hiệp 4 Phá Mũi Giáp Địch"));
  assert.ok(text(listed).includes("Kỳ lược: Bố Trí Thập Diện, Bác Lãng Chuy Tần, Lui Bước Công Thành, Hợp Vây Giáp Kích, Sở Ca Tứ Khởi. Nguồn không ghi thứ tự hiệp."));
  assert.ok(text(copied).includes("Dùng kỳ lược của: Ngũ Mưu Thần"));
  assert.ok(text(official, "zh").includes("奇略（謀算）：第2回合 設伏十面、第3回合 背水列陣、第4回合 楚歌四起、第5回合 多多益善、第6回合 合圍夾擊"));
  assert.ok(!text(official).includes("Hiếm"), "dòng gọn không kèm nhãn loại/độ hiếm");
});
