// TDD js/lookup-master.js — bốn nhóm Tra cứu catalog (Trang bị, Quân sư, Cải tạo binh chủng, Công trình) dạng
// danh sách + chi tiết: bộ lọc chip, thứ tự hiển thị, mục chọn mặc định, đặc kỹ độc quyền/chung, dấu "Gợi ý" suy từ
// `suggestedBuildVi`, tổng tài nguyên công trình và chi tiết theo hai ngôn ngữ.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildingHeadline,
  buildingTotals,
  commonSpecialsFor,
  isMasterGroup,
  masterDefaultId,
  masterDetailTree,
  masterDisplayItems,
  masterFacets,
  masterFilterHref,
  masterFilterMatches,
  masterFiltersFromQuery,
  masterFilterTree,
  masterResultTrees,
  masterSummaryTrees,
  masterTargetFor,
  qilueStrategiesForCard,
  troopEffectVersions,
  troopSuggestedIds,
} from "../js/lookup-master.js";
import { buildLookupCorpus, lookupPageSize, lookupSummaryTrees, searchLookupGroup } from "../js/unified-lookup.js";
import { treeToHtml } from "../js/view-tree.js";
import { qilueCardsDoc, qilueStrategiesDoc } from "./fixtures/lookup-bundle-fixtures.mjs";

const text = (trees) => trees.map(treeToHtml).join("");
const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const equipment = (id, nameVi, slotVi, qualityVi, han) => ({ id, nameVi, slotVi, qualityVi, aliasesVi: [], aliasesZh: [han], conditions: [], missingFields: [] });
const special = (id, nameVi, over = {}) => ({
  id, nameVi, equipmentId: null, exclusiveHeroId: null, slotVi: null, tierVi: "T1", descriptionVi: `Mô tả ${nameVi}`,
  acquisitionVi: ["Rèn"], aliasesVi: [], aliasesZh: [], conditions: [], missingFields: [], ...over,
});
const option = (slug, nameVi, tierVi, over = {}) => ({ id: `troop-option:dan-duong-binh:${slug}`, nameVi, tierVi, descriptionVi: `Mô tả ${nameVi}`, convertsToVi: null, ...over });

const CATALOG = {
  equipment: [
    equipment("equipment:y-thien-kiem", "Ỷ Thiên Kiếm", "Vũ khí", "Cam", "倚天劍"),
    equipment("equipment:bach-ngan-giap", "Bạch Ngân Giáp", "Phòng cụ", "Tím", "白銀甲"),
    equipment("equipment:dich-lo", "Đích Lô", "Tọa kỵ", "Cam", "的盧"),
  ],
  specials: [
    special("equipment-special:kien-co", "Kiên Cố", { equipmentId: "equipment:y-thien-kiem", tierVi: "T1", slotVi: "Vũ khí" }),
    special("equipment-special:gian-hung", "Gian Hùng", { equipmentId: "equipment:y-thien-kiem", exclusiveHeroId: "hero:tao-thao", tierVi: "T0", slotVi: "Vũ khí", aliasesZh: ["奸雄"] }),
    special("equipment-special:phu-chu", "Phù Chú", { tierVi: "T1" }),
    special("equipment-special:thach-phu", "Thạch Phu", { tierVi: "T2" }),
    special("equipment-special:thuan-ma", "Thuần Mã", { tierVi: "T2", slotVi: "Tọa kỵ" }),
    special("equipment-special:mo-coi", "Mồ Côi", { tierVi: "T3", slotVi: "Phòng cụ", equipmentId: "equipment:khong-co" }),
  ],
  advisors: [
    { id: "advisor:an-phuc", nameVi: "An Phủ", elementVi: "Phong", heroIds: ["hero:tao-thao"], effectVi: "Hiệu ứng quân sư", tacticPoints: 3, usageVi: "Bổ nhiệm", aliasesVi: [], aliasesZh: ["恩服"], conditions: [], missingFields: [] },
    { id: "advisor:nhan-tam", nameVi: "Nhân Tâm", elementVi: "Sơn", heroIds: [], effectVi: "Hiệu ứng khác", tacticPoints: 8, usageVi: null, aliasesVi: [], aliasesZh: ["仁心"], conditions: [], missingFields: [] },
  ],
  troopMods: [
    {
      id: "troop-mod:dan-duong", nameVi: "Đan Dương Binh", appliesToVi: "Pháp Quan Thuẫn", effectVi: "Hiệu ứng", troopLimitVi: ["Khiên binh"],
      suggestedBuildVi: "【Chuyển·Cầm Thương】+【Tập Võ】+【Không Có】→ Kết quả",
      conditions: [{ kind: "scenario", textVi: "Binh Diễn Xuân Thu" }],
      aliasesVi: [], aliasesZh: ["丹陽兵"], missingFields: [],
      revisions: [
        { effectiveDate: "2024-08-28", isCurrent: true, labelVi: "Bản hiện hành", textVi: "Nâng cấp hiện hành" },
        { effectiveDate: null, isCurrent: false, labelVi: "Bản gốc", textVi: "Nâng cấp gốc" },
      ],
      options: [
        option("a", "Chuyển·Cầm thương", "Đặc biệt", { convertsToVi: "Thương binh" }),
        option("b", "Tập võ", "Sơ cấp"),
        option("c", "Chỉnh quân", "Trung cấp"),
      ],
    },
    {
      id: "troop-mod:hoba", nameVi: "Hổ Báo Kỵ", appliesToVi: null, effectVi: "Hiệu ứng kỵ", troopLimitVi: ["Kỵ binh"], suggestedBuildVi: null,
      conditions: [], aliasesVi: [], aliasesZh: ["虎豹騎"], missingFields: [], revisions: [], options: [],
    },
    {
      id: "troop-mod:tien-dang", nameVi: "Tiên Đăng Tử Sĩ", appliesToVi: "Cung", effectVi: "Hiệu ứng cung", troopLimitVi: ["Cung binh"], suggestedBuildVi: null,
      conditions: [], aliasesVi: [], aliasesZh: ["先登死士"], missingFields: [], revisions: [], options: [],
    },
    {
      id: "troop-mod:dang-giap", nameVi: "Đằng Giáp Binh", appliesToVi: "Thuẫn", effectVi: "Hiệu ứng thuẫn", troopLimitVi: ["Khiên binh"], suggestedBuildVi: null,
      conditions: [], aliasesVi: [], aliasesZh: ["藤甲兵"], missingFields: [], revisions: [], options: [],
    },
  ],
  buildings: [
    {
      id: "building:bat-tran-do", nameVi: "Bát Trận Đồ", summaryVi: null, mainCityOnly: false, maxLevel: 2, aliasesVi: [], aliasesZh: ["八陣圖"], conditions: [], missingFields: [],
      levels: [
        { id: "building-level:bat-tran-do:2", level: 2, effectVi: "Giảm sát thương +6%", costs: { wood: 80000, stone: 80000, iron: 40000 }, durationVi: "6 giờ" },
        { id: "building-level:bat-tran-do:1", level: 1, effectVi: "Giảm sát thương +3%", costs: { wood: 32000, stone: 32000, iron: 16000 }, durationVi: "2 giờ" },
      ],
    },
    {
      id: "building:quan-xa", nameVi: "Quân Xá", summaryVi: "Tóm tắt", mainCityOnly: true, maxLevel: 1, aliasesVi: [], aliasesZh: ["軍舍"], conditions: [], missingFields: [],
      levels: [{ id: "building-level:quan-xa:1", level: 1, effectVi: "Mở khóa", costs: { wood: null, stone: 5, iron: null }, durationVi: "1 phút" }],
    },
  ],
};

const HEROES = [{ id: "hero:tao-thao", viet: "Tào Tháo", chinese: "曹操", iconUrl: null, aliases: [], lookup: {} }];

function corpus() {
  return buildLookupCorpus({ heroes: HEROES, catalog: CATALOG });
}

test("năm nhóm catalog dùng bố cục danh sách + chi tiết, nhóm khác thì không", () => {
  for (const group of ["equipment", "advisors", "troop-mods", "buildings", "qilue"]) assert.equal(isMasterGroup(group), true);
  for (const group of ["heroes", "tactics", "books"]) assert.equal(isMasterGroup(group), false);
});

test("cỡ trang theo nhóm: thẻ dày ngắn hơn, nhóm khác giữ 60", () => {
  assert.equal(lookupPageSize("equipment"), 24);
  assert.equal(lookupPageSize("advisors"), 18);
  assert.equal(lookupPageSize("heroes"), 60);
  const built = corpus();
  assert.equal(searchLookupGroup(built, { group: "equipment" }).items.length, 3);
});

test("chip lọc: ô trang bị theo thứ tự artboard, phẩm bật/tắt, số đếm tính trên cả nhóm", () => {
  const built = corpus();
  const [slot, quality] = masterFacets("equipment", built.groups.equipment, "vi");
  assert.equal(slot.hasAll, true);
  assert.equal(quality.hasAll, false);
  assert.deepEqual(slot.options.map((option) => [option.value, option.count]), [["Vũ khí", 1], ["Phòng cụ", 1], ["Tọa kỵ", 1]]);
  assert.deepEqual(quality.options.map((option) => [option.value, option.count, option.tone]), [["Cam", 2, "cam"], ["Tím", 1, "tim"]]);
  const [element] = masterFacets("advisors", built.groups.advisors, "vi");
  assert.deepEqual(element.options.map((option) => option.value), ["Phong", "Sơn"]);
  const [limit] = masterFacets("troop-mods", built.groups["troop-mods"], "vi");
  assert.deepEqual(limit.options.map((option) => [option.value, option.count]), [["Khiên binh", 2], ["Cung binh", 1], ["Kỵ binh", 1]]);
  const [scope] = masterFacets("buildings", built.groups.buildings, "vi");
  assert.deepEqual(scope.options.map((option) => [option.value, option.count]), [["main", 1], ["all", 1]]);
});

test("bộ lọc giao nhau giữa các khía cạnh và áp trước khi cắt trang", () => {
  const built = corpus();
  const filter = (selected) => (item) => masterFilterMatches("equipment", item.record, selected);
  assert.deepEqual(searchLookupGroup(built, { group: "equipment", filter: filter({ slot: "Vũ khí" }) }).items.map((item) => item.id), ["equipment:y-thien-kiem"]);
  assert.equal(searchLookupGroup(built, { group: "equipment", filter: filter({ quality: "Cam" }) }).total, 2);
  assert.equal(searchLookupGroup(built, { group: "equipment", filter: filter({ slot: "Phòng cụ", quality: "Cam" }) }).total, 0);
  assert.equal(searchLookupGroup(built, { group: "equipment", filter: filter({ slot: "", quality: "" }) }).total, 3);
  const buildings = (selected) => (item) => masterFilterMatches("buildings", item.record, selected);
  assert.deepEqual(searchLookupGroup(built, { group: "buildings", filter: buildings({ scope: "main" }) }).items.map((item) => item.id), ["building:quan-xa"]);
});

test("hàng chip lọc: chip bật theo bộ lọc, 'Tất cả' bật khi chưa chọn", () => {
  const built = corpus();
  const html = treeToHtml(masterFilterTree("equipment", built.groups.equipment, { slot: "Vũ khí" }, "vi"));
  assert.match(html, /data-facet="slot" data-value="" ?>/);
  assert.match(html, /aria-pressed="false" data-facet="slot" data-value=""/);
  assert.match(html, /aria-pressed="true" data-facet="slot" data-value="Vũ khí"/);
  assert.match(html, /aria-pressed="false" data-facet="quality" data-value="Cam" data-tone="cam"/);
  assert.match(html, /<span class="lookup-filter-divider"/);
  const none = treeToHtml(masterFilterTree("equipment", built.groups.equipment, {}, "vi"));
  assert.match(none, /aria-pressed="true" data-facet="slot" data-value=""/);
});

test("cải tạo binh chủng gom theo binh chủng Khiên → Cung → Thương → Kỵ, mục chọn mặc định là mục đầu theo thứ tự hiển thị", () => {
  const built = corpus();
  const items = built.groups["troop-mods"];
  assert.deepEqual(masterDisplayItems("troop-mods", items).map((item) => item.id), ["troop-mod:dan-duong", "troop-mod:dang-giap", "troop-mod:tien-dang", "troop-mod:hoba"]);
  assert.equal(masterDefaultId("troop-mods", items), "troop-mod:dan-duong");
  assert.equal(masterDefaultId("equipment", built.groups.equipment), "equipment:y-thien-kiem");
  assert.equal(masterDefaultId("equipment", []), null);
  const html = text(masterResultTrees("troop-mods", items, "vi", { selectedId: "troop-mod:dang-giap" }));
  assert.match(html, /Khiên binh<span class="lookup-row-group-count"> · 2<\/span>/);
  assert.match(html, /aria-current="true"[^>]*><span class="lookup-row-glyph"[^>]*>藤/);
  assert.match(html, /Chưa có đội hình tham khảo/);
});

test("mục tiêu của mã hồ sơ: trang bị mở chính nó, đặc kỹ có cha mở trang bị cha, đặc kỹ mồ côi mở riêng, mã lạ là null", () => {
  const built = corpus();
  assert.deepEqual(masterTargetFor(built, "equipment:y-thien-kiem"), { item: built.byId.get("equipment:y-thien-kiem"), targetId: "equipment:y-thien-kiem" });
  const child = masterTargetFor(built, "equipment-special:gian-hung");
  assert.equal(child.item.id, "equipment:y-thien-kiem");
  assert.equal(child.targetId, "equipment-special:gian-hung");
  assert.equal(masterTargetFor(built, "equipment-special:phu-chu").item.id, "equipment-special:phu-chu");
  assert.equal(masterTargetFor(built, "equipment-special:mo-coi").item.id, "equipment-special:mo-coi");
  assert.equal(masterTargetFor(built, "equipment:khong-co"), null);
});

test("đặc kỹ chung của một trang bị: không gắn trang bị nào, cùng ô hoặc không phân ô, bậc mạnh nhất trước", () => {
  const built = corpus();
  const weapon = commonSpecialsFor(built.byId.get("equipment:y-thien-kiem").record, CATALOG.specials);
  assert.deepEqual(weapon.map((item) => item.id), ["equipment-special:phu-chu", "equipment-special:thach-phu"]);
  const mount = commonSpecialsFor(built.byId.get("equipment:dich-lo").record, CATALOG.specials);
  assert.deepEqual(mount.map((item) => item.id), ["equipment-special:phu-chu", "equipment-special:thach-phu", "equipment-special:thuan-ma"]);
});

test("chi tiết trang bị: đặc kỹ độc quyền xếp T0 trước, link tướng, đặc kỹ chung và đặc kỹ được mở được tô", () => {
  const built = corpus();
  const item = built.byId.get("equipment:y-thien-kiem");
  const html = treeToHtml(masterDetailTree("equipment", item, built, "vi", { targetId: "equipment-special:gian-hung" }));
  assert.ok(html.indexOf("Gian Hùng") < html.indexOf("Kiên Cố"), "T0 đứng trước T1");
  assert.match(html, /Độc quyền khi <a class="lookup-detail-link" href="\/tra-cuu\/tuong\/tao-thao\/">Tào Tháo<\/a> trang bị/);
  assert.match(html, /class="lookup-special is-target"[^>]*data-special-id="equipment-special:gian-hung"/);
  assert.match(html, /Đặc kỹ chung có thể rèn/);
  assert.match(html, /2 đặc kỹ chung dùng cho mọi trang bị cùng loại/);
  assert.match(html, /href="\/tra-cuu\/trang-bi\/"[^>]*data-lookup-back/);
  assert.doesNotMatch(html, /sentinel/);
});

test("chi tiết trang bị bản zh: chữ Hán, nhãn Trung, bỏ mô tả chỉ có tiếng Việt và báo một dòng", () => {
  const built = corpus();
  const item = built.byId.get("equipment:y-thien-kiem");
  const html = treeToHtml(masterDetailTree("equipment", item, built, "zh", { targetId: item.id }));
  assert.match(html, /倚天劍/);
  assert.match(html, /专属特技/);
  assert.match(html, /曹操<\/a>装备时专属/);
  assert.doesNotMatch(html, /Mô tả|Độc quyền|Nguồn/);
  assert.match(html, /部分说明暂无中文原文/);
});

test("quân sư: thẻ ghi tên tướng và hệ, chi tiết có hàng tướng + điểm chiến pháp + hiệu quả + cách dùng", () => {
  const built = corpus();
  const card = text(masterResultTrees("advisors", built.groups.advisors, "vi", { selectedId: "advisor:an-phuc", byId: built.byId }));
  assert.match(card, /Tào Tháo · hệ Phong/);
  assert.match(card, /aria-current="true"[^>]*data-tone="phong"|data-tone="phong"[^>]*aria-current="true"/);
  assert.match(card, />hệ Sơn</);
  const html = treeToHtml(masterDetailTree("advisors", built.byId.get("advisor:an-phuc"), built, "vi"));
  assert.match(html, /<dt>Võ tướng<\/dt><dd>.*Tào Tháo/);
  assert.match(html, /Điểm chiến pháp/);
  assert.match(html, /Hiệu quả/);
  assert.match(html, /Cách dùng/);
  const noHero = treeToHtml(masterDetailTree("advisors", built.byId.get("advisor:nhan-tam"), built, "vi"));
  assert.doesNotMatch(noHero, /Võ tướng/);
  assert.doesNotMatch(noHero, /Cách dùng/);
});

test("dấu 'Gợi ý' suy từ tên trong 【…】 của suggestedBuildVi: khớp không dấu/hoa thường, tên lạ bỏ qua, không có gợi ý thì không dấu nào", () => {
  const built = corpus();
  const [mod] = built.groups["troop-mods"];
  assert.deepEqual([...troopSuggestedIds(mod.record)], ["troop-option:dan-duong-binh:a", "troop-option:dan-duong-binh:b"]);
  assert.equal(troopSuggestedIds({ suggestedBuildVi: null, options: mod.record.options }).size, 0);
  assert.equal(troopSuggestedIds({ suggestedBuildVi: "【Chuyển·Cầm thương】", options: [] }).size, 0);
  const html = treeToHtml(masterDetailTree("troop-mods", mod, built, "vi"));
  assert.equal([...html.matchAll(/is-suggested/g)].length, 2);
  assert.match(html, /Khung son = lộ trình gợi ý/);
  assert.match(html, /Gợi ý build/);
  assert.match(html, /Chuyển thành Thương binh/);
  assert.match(html, /Cây cải tạo · 3 lựa chọn/);
  const bare = treeToHtml(masterDetailTree("troop-mods", built.byId.get("troop-mod:hoba"), built, "vi"));
  assert.doesNotMatch(bare, /Gợi ý build|Khung son|is-suggested/);
});

test("phiên bản hiệu quả: bản hiện hành kèm ngày trước, bản gốc sau; chỉ một bản thì không có thẻ chuyển", () => {
  const built = corpus();
  const versions = troopEffectVersions(built.byId.get("troop-mod:dan-duong").record);
  assert.deepEqual(versions.map((version) => version.label), ["Bản hiện hành · 2024-08-28", "Bản gốc"]);
  const html = treeToHtml(masterDetailTree("troop-mods", built.byId.get("troop-mod:dan-duong"), built, "vi"));
  assert.match(html, /aria-pressed="true" data-effect-tab="0"/);
  assert.match(html, /aria-pressed="false" data-effect-tab="1"/);
  assert.match(html, /data-effect-panel="1" hidden/);
  const single = treeToHtml(masterDetailTree("troop-mods", built.byId.get("troop-mod:hoba"), built, "vi"));
  assert.doesNotMatch(single, /data-effect-tab/);
  assert.match(single, /Hiệu quả/);
});

test("công trình: tổng tài nguyên bỏ ô trống, hiệu ứng cấp cuối cho số nổi bật, bảng theo cấp tăng dần và cấp cuối được đánh dấu", () => {
  const built = corpus();
  const record = built.byId.get("building:bat-tran-do").record;
  assert.deepEqual(buildingTotals(record.levels), { wood: 112000, stone: 112000, iron: 56000 });
  assert.deepEqual(buildingTotals(built.byId.get("building:quan-xa").record.levels), { wood: null, stone: 5, iron: null });
  assert.equal(buildingHeadline(record.levels), "+6%");
  assert.equal(buildingHeadline([{ level: 1, effectVi: "Mở khóa" }]), null);
  assert.equal(buildingHeadline([{ level: 2, effectVi: "Sản lượng đá +15000/giờ" }, { level: 1, effectVi: "Sản lượng đá +100/giờ" }]), "+15000/giờ");
  const html = treeToHtml(masterDetailTree("buildings", built.byId.get("building:bat-tran-do"), built, "vi"));
  assert.ok(html.indexOf('<th scope="row"') < html.indexOf(">2</th>"));
  assert.match(html, /Tổng tài nguyên lên cấp 2: gỗ 112\.000 · đá 112\.000 · sắt 56\.000/);
  assert.match(html, /class="lookup-level-row is-max"/);
  assert.match(html, /Hiệu quả cấp max/);
  assert.match(html, /Thời gian cấp max/);
  assert.match(html, /6 giờ/);
  const sparse = treeToHtml(masterDetailTree("buildings", built.byId.get("building:quan-xa"), built, "vi"));
  assert.doesNotMatch(sparse, /null|undefined|NaN/);
  assert.match(sparse, /Tổng tài nguyên lên cấp 1: đá 5/);
});

test("công trình bản zh: đổi đơn vị thời gian, bỏ hiệu ứng chữ Việt", () => {
  const built = corpus();
  const html = treeToHtml(masterDetailTree("buildings", built.byId.get("building:bat-tran-do"), built, "zh"));
  assert.match(html, /6 小时/);
  assert.match(html, /升至 2 级总资源/);
  assert.doesNotMatch(html, /Giảm sát thương|giờ/);
});

test("dòng trạng thái của bốn nhóm: ô được lọc đổi đơn vị, phần đuôi tách ra để desktop ẩn", () => {
  assert.equal(treeToHtml(masterSummaryTrees("equipment", 31, "vi", { slot: "Vũ khí" }).at(1) ?? ""), " vũ khí");
  assert.equal(plain(text(lookupSummaryTrees("equipment", 114, "vi"))), "114 trang bị · màu thẻ theo phẩm chất");
  assert.equal(plain(text(lookupSummaryTrees("advisors", 39, "vi"))), "39 kỹ năng quân sư · chia theo hệ");
  assert.equal(plain(text(lookupSummaryTrees("buildings", 41, "vi"))), "41 công trình · cấp tối đa bên phải");
  assert.equal(plain(text(lookupSummaryTrees("equipment", 114, "zh"))), "114 件装备 · 卡片颜色按品质");
  assert.equal(plain(text(lookupSummaryTrees("heroes", 5, "vi"))), "5 tướng · bấm để mở hồ sơ · ảnh chân dung từ nguồn game");
  assert.match(text(masterSummaryTrees("troop-mods", 16, "vi")), /<span class="lookup-summary-tail">/);
});

test("thẻ trang bị: đầu thẻ theo phẩm, số đặc kỹ độc quyền, bản zh dùng chữ Hán và nhãn Trung", () => {
  const built = corpus();
  const vi = text(masterResultTrees("equipment", built.groups.equipment, "vi", { selectedId: "equipment:y-thien-kiem" }));
  assert.match(vi, /data-lookup-id="equipment:y-thien-kiem" data-tone="cam" aria-current="true"/);
  assert.match(vi, /2 đặc kỹ độc quyền/);
  assert.match(vi, /Chỉ đặc kỹ chung/);
  assert.match(vi, />倚天</);
  const zh = text(masterResultTrees("equipment", built.groups.equipment, "zh", { selectedId: null }));
  assert.match(zh, /2 个专属特技/);
  assert.match(zh, /倚天劍/);
  assert.doesNotMatch(zh, /Vũ khí|đặc kỹ/);
});

test("bản zh catalog: chữ Hán nguồn/bản dịch thay chữ Việt; bản dịch mang cờ ở thẻ và chi tiết; phần chưa có chữ Hán bị ẩn kèm dòng báo", () => {
  const [adv, other] = CATALOG.advisors;
  const advisors = [
    { ...adv, effectZh: "動員：譯文", zhSource: { kind: "translation" } },
    { ...other, effectZh: "被動：原文", zhSource: { kind: "source" } },
  ];
  const [dan, ...troops] = CATALOG.troopMods;
  const troop = {
    ...dan, effectZh: "將盾兵進階", appliesToZh: "法關盾", suggestedBuildZh: null, zhSource: { kind: "translation" },
    options: dan.options.map((option, index) => (index === 0
      ? { ...option, nameZh: "轉·持槍", descriptionZh: "將槍兵進階", zhSource: { kind: "source" } }
      : { ...option, nameZh: null, descriptionZh: null, zhSource: null })),
  };
  const [bat, ...buildings] = CATALOG.buildings;
  const building = {
    ...bat, summaryVi: "Tóm tắt", summaryZh: "降低傷害", zhSource: { kind: "translation" },
    levels: bat.levels.map((level) => ({ ...level, effectZh: `降低傷害+${level.level * 3}%`, durationZh: `${level.level}小時` })),
  };
  const built = buildLookupCorpus({ heroes: HEROES, catalog: { ...CATALOG, advisors, troopMods: [troop, ...troops], buildings: [building, ...buildings] } });

  const cards = text(masterResultTrees("advisors", built.groups.advisors, "zh", { byId: built.byId }));
  assert.match(cards, /動員：譯文/);
  assert.match(cards, /被動：原文/);
  assert.equal([...cards.matchAll(/data-zh-source="translation"/g)].length, 1, "chỉ thẻ có bản dịch mang cờ");
  assert.doesNotMatch(text(masterResultTrees("advisors", built.groups.advisors, "vi", { byId: built.byId })), /data-zh-source|譯文/);
  assert.match(treeToHtml(masterDetailTree("advisors", built.byId.get(adv.id), built, "zh")), /data-zh-source="translation"/);
  assert.doesNotMatch(treeToHtml(masterDetailTree("advisors", built.byId.get(other.id), built, "zh")), /data-zh-source/);

  const troopHtml = treeToHtml(masterDetailTree("troop-mods", built.byId.get(troop.id), built, "zh"));
  assert.match(troopHtml, /轉·持槍/);
  assert.match(troopHtml, /进阶树 · 1 个选项/);
  assert.match(troopHtml, /部分说明暂无中文原文/);
  assert.doesNotMatch(troopHtml, /Pháp Quan Thuẫn|Mô tả|Hiệu ứng/);

  const buildingHtml = treeToHtml(masterDetailTree("buildings", built.byId.get(building.id), built, "zh"));
  assert.match(buildingHtml, /降低傷害\+6%/);
  assert.match(buildingHtml, /2小時/);
  assert.match(buildingHtml, /data-zh-source="translation"/);
  assert.doesNotMatch(buildingHtml, /部分说明暂无中文原文|Tóm tắt|giờ/);
});

/* ---------- Kỳ lược ---------- */

const qilueCorpus = () => buildLookupCorpus({ catalog: { ...CATALOG, qilueStrategies: qilueStrategiesDoc(), qilueCards: qilueCardsDoc() } });

test("kỳ lược là nhóm danh sách + chi tiết: phương lược đứng đầu, thẻ theo loại Dũng → Mưu → Phụ → Sách → Tế, hiếm trước thường", () => {
  assert.equal(isMasterGroup("qilue"), true);
  const built = qilueCorpus();
  assert.deepEqual(built.groups.qilue.map((item) => item.id), [
    "qilue-strategy:cuong-cong", "qilue-strategy:muu-tinh", "qilue-strategy:quay-nhieu",
    "qilue-card:chi-khi-ngap-tran",
    "qilue-card:cang-nhieu-cang-tot", "qilue-card:am-do-tran-thuong", "qilue-card:bo-tri-thap-dien",
    "qilue-card:bac-lang-chuy-tan",
    "qilue-card:cong-lao-hien-hach",
    "qilue-card:an-tich-mang-thuong",
  ]);
  assert.equal(masterDefaultId("qilue", built.groups.qilue), "qilue-strategy:cuong-cong");
});

test("kỳ lược: chip lọc loại thẻ (có 'Tất cả', màu theo loại) và độ hiếm (bật/tắt); lọc loại chỉ giữ thẻ, giao với độ hiếm", () => {
  const built = qilueCorpus();
  const [type, rarity] = masterFacets("qilue", built.groups.qilue, "vi");
  assert.equal(type.hasAll, true);
  assert.equal(rarity.hasAll, false);
  assert.deepEqual(type.options.map((option) => [option.value, option.label, option.count, option.tone]), [
    ["dung", "Dũng", 1, "dung"], ["muu", "Mưu", 3, "muu"], ["phu", "Phụ", 1, "phu"], ["sach", "Sách", 1, "sach"], ["te", "Tế", 1, "te"],
  ]);
  assert.deepEqual(rarity.options.map((option) => [option.value, option.label, option.count]), [["common", "Thường", 4], ["rare", "Hiếm", 3]]);
  const [typeZh, rarityZh] = masterFacets("qilue", built.groups.qilue, "zh");
  assert.deepEqual(typeZh.options.map((option) => option.label), ["勇", "謀", "輔", "策", "濟"]);
  assert.deepEqual(rarityZh.options.map((option) => option.label), ["普通", "稀有"]);

  const filter = (selected) => (item) => masterFilterMatches("qilue", item.record, selected);
  const ids = (selected) => searchLookupGroup(built, { group: "qilue", filter: filter(selected) }).items.map((item) => item.id);
  assert.deepEqual(ids({ type: "muu" }), ["qilue-card:cang-nhieu-cang-tot", "qilue-card:am-do-tran-thuong", "qilue-card:bo-tri-thap-dien"]);
  assert.deepEqual(ids({ type: "muu", rarity: "rare" }), ["qilue-card:cang-nhieu-cang-tot"]);
  assert.deepEqual(ids({ rarity: "rare" }), ["qilue-card:chi-khi-ngap-tran", "qilue-card:cang-nhieu-cang-tot", "qilue-card:cong-lao-hien-hach"]);
  assert.equal(ids({}).length, 10);

  const html = treeToHtml(masterFilterTree("qilue", built.groups.qilue, { type: "muu" }, "vi"));
  assert.match(html, /aria-label="Lọc kỳ lược"/);
  assert.match(html, /aria-pressed="true" data-facet="type" data-value="muu" data-tone="muu"/);
  assert.match(html, /data-facet="type" data-value=""[^>]*>Tất cả<span class="fchip-count">10</);
});

test("kỳ lược: bộ lọc đọc từ query (chỉ giá trị có thật của nhóm) và link sang danh sách đã lọc", () => {
  const built = qilueCorpus();
  assert.deepEqual(masterFiltersFromQuery("qilue", "?type=muu&utm_source=x", built.groups.qilue), { type: "muu" });
  assert.deepEqual(masterFiltersFromQuery("qilue", "?type=muu&rarity=rare", built.groups.qilue), { type: "muu", rarity: "rare" });
  assert.deepEqual(masterFiltersFromQuery("qilue", "?type=khac&rarity=", built.groups.qilue), {});
  assert.deepEqual(masterFiltersFromQuery("qilue", "?type=muu&type=dung", built.groups.qilue), {}, "khóa lặp bị bỏ");
  assert.deepEqual(masterFiltersFromQuery("equipment", "?slot=V%C5%A9+kh%C3%AD", built.groups.equipment), { slot: "Vũ khí" });
  assert.equal(masterFilterHref("qilue", "type", "muu"), "/tra-cuu/ky-luoc/?type=muu");
});

test("kỳ lược: danh sách chia khối Phương lược rồi từng loại thẻ; hàng ghi nhãn nhóm, loại có màu, dấu Hiếm", () => {
  const built = qilueCorpus();
  const html = text(masterResultTrees("qilue", built.groups.qilue, "vi", { selectedId: "qilue-strategy:cuong-cong" }));
  assert.match(html, /<h2 class="lookup-row-group-title">Phương lược<span class="lookup-row-group-count"> · 3<\/span><\/h2>/);
  assert.match(html, /<h2 class="lookup-row-group-title">Thẻ Mưu<span class="lookup-row-group-count"> · 3<\/span><\/h2>/);
  assert.ok(html.indexOf("Thẻ Dũng") < html.indexOf("Thẻ Mưu") && html.indexOf("Thẻ Mưu") < html.indexOf("Thẻ Tế"));
  assert.match(html, /data-lookup-id="qilue-strategy:cuong-cong" aria-current="true"/);
  assert.match(html, /Cường Công<\/span><span class="lookup-row-sub">Phương lược · thẻ Dũng, Phụ<\/span>/);
  assert.match(html, /<span class="lookup-qilue-tag" data-tone="muu">Mưu<\/span>/);
  assert.equal([...html.matchAll(/class="lookup-qilue-rare"/g)].length, 3);
  assert.match(html, /Bố Trí Thập Diện<\/span><span class="lookup-row-sub">Thẻ kỳ lược · Nhóm quân ta<\/span>/);
  assert.match(html, /<span class="lookup-row-zh" lang="zh-Hant">設伏十面<\/span>/);
  assert.match(html, /href="\/tra-cuu\/ky-luoc\/bo-tri-thap-dien\/"/);

  const zh = text(masterResultTrees("qilue", built.groups.qilue, "zh", {}));
  assert.match(zh, />作战方略<span class="lookup-row-group-count"> · 3/);
  assert.match(zh, />謀卡<span class="lookup-row-group-count"> · 3/);
  assert.match(zh, /設伏十面<\/span><span class="lookup-row-sub">奇略卡 · 我軍群體<\/span>/);
  assert.match(zh, />稀有</);
  assert.doesNotMatch(zh, /Phương lược|Thẻ kỳ lược|Nhóm quân ta|Hiếm|lookup-row-zh/);
});

test("kỳ lược: phương lược dùng được của một thẻ tính từ cardTypes", () => {
  const built = qilueCorpus();
  const ids = (id) => qilueStrategiesForCard(built, built.byId.get(id).record).map((item) => item.id);
  assert.deepEqual(ids("qilue-card:bo-tri-thap-dien"), ["qilue-strategy:muu-tinh", "qilue-strategy:quay-nhieu"]);
  assert.deepEqual(ids("qilue-card:bac-lang-chuy-tan"), ["qilue-strategy:cuong-cong", "qilue-strategy:muu-tinh"]);
  assert.deepEqual(ids("qilue-card:an-tich-mang-thuong"), []);
});

test("kỳ lược: hồ sơ thẻ có tên, chữ Hán, loại, độ hiếm, đối tượng, hiệu ứng nguyên văn và link phương lược dùng được", () => {
  const built = qilueCorpus();
  const html = treeToHtml(masterDetailTree("qilue", built.byId.get("qilue-card:bo-tri-thap-dien"), built, "vi"));
  assert.match(html, /class="lookup-detail lookup-detail-qilue"/);
  assert.match(html, /<h2 class="lookup-detail-title" id="lookup-detail-title">Bố Trí Thập Diện<\/h2><span class="lookup-detail-zh" lang="zh-Hant">設伏十面<\/span>/);
  assert.match(html, /<span class="lookup-detail-eyebrow">Kỳ lược · Thẻ kỳ lược<\/span>/);
  assert.match(html, /<dt>Loại<\/dt><dd><span class="lookup-qilue-tag" data-tone="muu">Mưu<\/span><\/dd>/);
  assert.match(html, /<dt>Độ hiếm<\/dt><dd>Thường<\/dd>/);
  assert.match(html, /<dt>Đối tượng<\/dt><dd>Nhóm quân ta<\/dd>/);
  assert.match(html, /<p class="lookup-detail-prose">Hiệp này Chiến Pháp Chủ Động tỉ lệ phát động tăng 10%<\/p>/);
  assert.match(html, /Dùng được với phương lược/);
  assert.match(html, /<a class="lookup-detail-link" href="\/tra-cuu\/ky-luoc\/muu-tinh\/">Mưu tính<\/a>/);
  assert.match(html, /<a class="lookup-detail-link" href="\/tra-cuu\/ky-luoc\/quay-nhieu\/">Quấy nhiễu<\/a>/);
  assert.doesNotMatch(html, /cuong-cong/);
  assert.match(html, /Mùa Hán Diễm Trường Minh \(PK-S27, client 24\.547\)/);
  assert.doesNotMatch(html, /data-zh-source/);

  const rare = treeToHtml(masterDetailTree("qilue", built.byId.get("qilue-card:cang-nhieu-cang-tot"), built, "vi"));
  assert.match(rare, /<span class="badge lookup-qilue-rare">Hiếm<\/span>/);
  assert.match(rare, /<dt>Độ hiếm<\/dt><dd>Hiếm<\/dd>/);

  const none = treeToHtml(masterDetailTree("qilue", built.byId.get("qilue-card:an-tich-mang-thuong"), built, "vi"));
  assert.doesNotMatch(none, /Dùng được với phương lược/);
});

test("kỳ lược bản zh: tên game nameZh, nhãn theo hợp đồng, hiệu ứng effectZh mang cờ dịch, không còn chữ Việt", () => {
  const built = qilueCorpus();
  const html = treeToHtml(masterDetailTree("qilue", built.byId.get("qilue-card:bo-tri-thap-dien"), built, "zh", { page: true }));
  assert.match(html, /<h1 class="lookup-detail-title" id="lookup-detail-title">設伏十面<\/h1>/);
  assert.doesNotMatch(html, /lookup-detail-zh/);
  assert.match(html, /<dt>类型<\/dt><dd><span class="lookup-qilue-tag" data-tone="muu">謀<\/span><\/dd>/);
  assert.match(html, /<dt>稀有度<\/dt><dd>普通<\/dd>/);
  assert.match(html, /<dt>目标<\/dt><dd>我軍群體<\/dd>/);
  assert.match(html, /本回合主動戰法發動率提升 10%/);
  assert.match(html, /data-zh-source="translation"/);
  assert.match(html, /href="\/zh\/tra-cuu\/ky-luoc\/muu-tinh\/">謀算<\/a>/);
  assert.match(html, /漢焰長明賽季（PK-S27，客戶端 24\.547）/);
  assert.doesNotMatch(html, /Hiệp này|Nhóm quân ta|Mưu tính|Thẻ kỳ lược|data-lookup-back/);
});

test("kỳ lược: hồ sơ phương lược có mô tả, buff mỗi thẻ và hai loại thẻ link sang danh sách đã lọc", () => {
  const built = qilueCorpus();
  const html = treeToHtml(masterDetailTree("qilue", built.byId.get("qilue-strategy:muu-tinh"), built, "vi"));
  assert.match(html, /<span class="lookup-detail-eyebrow">Kỳ lược · Phương lược<\/span>/);
  assert.match(html, /Mô tả Mưu tính/);
  assert.match(html, /Hiệu quả mỗi thẻ/);
  assert.match(html, /Mỗi trang bị 1 Kỳ Lược, buff Mưu tính/);
  assert.match(html, /<a class="lookup-qilue-type-link" href="\/tra-cuu\/ky-luoc\/\?type=muu" data-tone="muu"><span class="lookup-qilue-tag" data-tone="muu">Mưu<\/span> · 3 thẻ<\/a>/);
  assert.match(html, /href="\/tra-cuu\/ky-luoc\/\?type=phu"[^>]*>.*Phụ<\/span> · 1 thẻ<\/a>/);
  assert.match(html, /Tên khác: Mưu Toán/);

  const zh = treeToHtml(masterDetailTree("qilue", built.byId.get("qilue-strategy:muu-tinh"), built, "zh"));
  assert.match(zh, /謀算說明/);
  assert.match(zh, /謀算加成/);
  assert.match(zh, /href="\/zh\/tra-cuu\/ky-luoc\/\?type=muu"/);
  assert.match(zh, /謀<\/span> · 3 张/);
  assert.match(zh, /data-zh-source="translation"/);
  assert.doesNotMatch(zh, /Mô tả|Mưu Toán|Phương lược/);
});

test("kỳ lược: dòng trạng thái theo loại thẻ đang lọc", () => {
  assert.equal(plain(text(lookupSummaryTrees("qilue", 45, "vi"))), "45 kỳ lược · màu theo loại thẻ");
  assert.equal(plain(text(masterSummaryTrees("qilue", 8, "vi", { type: "muu" }))), "8 thẻ Mưu · màu theo loại thẻ");
  assert.equal(plain(text(masterSummaryTrees("qilue", 8, "zh", { type: "muu" }))), "8 张謀卡 · 颜色按卡牌类型");
});
