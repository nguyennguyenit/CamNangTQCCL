// Đội khác chỉ có một mùa (mùa ghi trên các hàng `other-teams.json`): nhãn tĩnh thay ô chọn mùa, `?season=` bị bỏ qua,
// hàng `recommended` có nhãn "Đề cử" và đứng đầu; field vắng thì hành vi như cũ. Dữ liệu là bản ghi thật của
// generation đang pin được sao chép kèm field giả lập (không sửa generation).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { treeToHtml } from "../js/view-tree.js";
import { projectRecommendedRows, readRecommendedQuery, referenceSectionState } from "../js/recommended-reference-state.js";
import { detailBadges, recommendedListTrees } from "../js/recommended-reference-render.js";
import { otherTeamsSeasonId, referenceSeasonLabelTree } from "../js/team-filter-section.js";
import { safeReturnUrl } from "../js/team-detail-navigation.js";
import { recommendedSectionTrees } from "../src/lib/team-section-ssr.js";
import { TEAM_VIEW_GRID, TEAM_VIEW_TABLE } from "../js/team-view.js";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const GENERATION = json("src/data/recommended-reference/current.json").generationId;
const REFERENCE = `src/data/recommended-reference/${GENERATION}`;
const registry = json(`${REFERENCE}/seasons.json`);
const labels = registry.displayLabels;
// Generation thật đã mang `recommended`/`sourceSeasonIds`; bỏ hai field để có mẫu "field vắng", rồi gắn lại có kiểm soát.
const base = json(`${REFERENCE}/other-teams.json`).records
  .filter((row) => row.holders?.length)
  .slice(0, 6)
  .map(({ recommended, sourceSeasonIds, ...row }) => row);
assert.ok(base.length === 6, "cần đủ 6 hàng Đội khác mẫu");
const season = registry.seasonOptions.find((item) => item.sourceSeasonId === registry.defaultSourceSeasonId);
const key = (row) => row.legacyVariantId;
const html = (trees) => [].concat(trees).map(treeToHtml).join("");
const badgeCount = (markup) => (markup.match(/class="badge badge-band reference-recommended"/g) ?? []).length;
const keysIn = (markup) => [...markup.matchAll(/data-reference-key="([^"]*)"/g)].map((match) => match[1]);

// Hai hàng cuối (theo thứ tự nguồn) được đề cử: phải nhảy lên đầu, còn lại giữ thứ tự cũ.
const withFlags = (flagged) => base.map((row) => ({ ...row, sourceSeasonIds: [registry.defaultSourceSeasonId], recommended: flagged.includes(row) }));
const flagged = [base[4], base[5]];
const rows = withFlags(flagged);
const plainState = { season: "all", query: "", filters: {} };
const oldOrder = projectRecommendedRows(base.map((row) => ({ ...row })), plainState, labels).map(key);
const flaggedIds = oldOrder.filter((id) => flagged.some((row) => key(row) === id));

test("?season= bất kỳ trên Đội khác bị bỏ qua: đủ đội, không thông báo mùa, đủ kiểu giá trị lạ", () => {
  const plain = referenceSectionState("other", "https://x.test/doi-khac/", registry, null);
  for (const query of ["?season=pk-s24", "?season=khong-ton-tai", "?season=all", "?season=unknown", "?season=a&season=b", "?season="]) {
    const state = referenceSectionState("other", `https://x.test/doi-khac/${query}`, registry, null);
    assert.equal(state.season, "all", query);
    assert.deepEqual(state.notices, plain.notices, `${query}: không thêm thông báo mùa`);
    assert.deepEqual(projectRecommendedRows(rows, state, labels).map(key), projectRecommendedRows(rows, plain, labels).map(key), query);
    assert.equal(projectRecommendedRows(rows, state, labels).length, rows.length, `${query}: trang không rỗng`);
  }
  // Đội chuẩn giữ hành vi mùa: mùa có thật được giữ, mùa lạ lùi về mặc định kèm thông báo.
  const other = registry.seasonOptions.find((item) => item.sourceSeasonId !== registry.defaultSourceSeasonId);
  assert.equal(referenceSectionState("recommended", `https://x.test/doi-chuan/?season=${other.sourceSeasonId}`, registry, null).season, other.sourceSeasonId);
  const unknown = referenceSectionState("recommended", "https://x.test/doi-chuan/?season=khong-ton-tai", registry, null);
  assert.equal(unknown.season, registry.defaultSourceSeasonId);
  assert.match(unknown.notices.join(" "), /Mùa không tồn tại/);
  assert.equal(readRecommendedQuery("https://x.test/doi-khac/?season=pk-s24", registry).season, "pk-s24", "bộ đọc query chung không đổi");
});

test("URL quay lại không mang season của Đội khác, Đội chuẩn vẫn giữ", () => {
  assert.equal(safeReturnUrl("/doi-khac/?season=pk-s24&q=vien"), "/doi-khac/?q=vien");
  assert.equal(safeReturnUrl("/zh/doi-khac/?season=pk-s24&view=bang", { origin: "https://x.test" }), "/zh/doi-khac/?view=bang");
  assert.equal(safeReturnUrl("/doi-chuan/?season=pk-s24&q=vien"), "/doi-chuan/?season=pk-s24&q=vien");
});

test("hàng recommended đứng đầu, thứ tự cũ giữ trong mỗi nhóm; field vắng thì không đổi thứ tự", () => {
  const state = referenceSectionState("other", "https://x.test/doi-khac/", registry, null);
  const ordered = projectRecommendedRows(rows, state, labels).map(key);
  assert.deepEqual(ordered.slice(0, 2), flaggedIds);
  assert.deepEqual(ordered.slice(2), oldOrder.filter((id) => !flaggedIds.includes(id)));
  // Không có field `recommended` / `sourceSeasonIds` (generation chưa cập nhật): y như trước.
  const legacy = base.map((row) => { const { recommended, sourceSeasonIds, ...rest } = row; return rest; });
  assert.deepEqual(projectRecommendedRows(legacy, state, labels).map(key), oldOrder);
  // `recommended: false` cũng không đổi thứ tự.
  assert.deepEqual(projectRecommendedRows(withFlags([]), state, labels).map(key), oldOrder);
  // Hàng Đội chuẩn (có `sourceConfigId`) không bị tác động dù mang field này.
  const standard = [
    { sourceConfigId: "b", tierOrder: 2, listIndex: 1, value: 1, recommended: true, heroes: [] },
    { sourceConfigId: "a", tierOrder: 1, listIndex: 0, value: 1, heroes: [] },
  ];
  assert.deepEqual(projectRecommendedRows(standard, plainState, labels).map((row) => row.sourceConfigId), ["a", "b"]);
});

for (const locale of ["vi", "zh"]) {
  test(`Đội khác dựng sẵn (${locale}): nhãn mùa tĩnh từ registry, không ô chọn, nhãn Đề cử trên đúng hàng, hàng đề cử đứng đầu`, () => {
    const markup = html(recommendedSectionTrees({ family: "other", rows, registry, locale }));
    const name = locale === "zh" ? season.nameRaw : season.displayNameVi;
    const prefix = locale === "zh" ? "赛季" : "Mùa";
    assert.ok(markup.includes(`<div class="reference-season-field reference-season-static"><span class="reference-season-label">${prefix}</span> <span class="reference-season-name">${name}</span></div>`));
    assert.doesNotMatch(markup, /<select|<option|Tất cả|Chưa rõ mùa|全部|赛季不明/u);
    assert.equal(badgeCount(markup), flagged.length);
    assert.ok(markup.includes(`reference-recommended">${locale === "zh" ? "推荐" : "Đề cử"}</span>`));
    const keys = keysIn(markup);
    assert.deepEqual(keys.slice(0, 2), flaggedIds);
    assert.equal(keys.length, rows.length);
    // Không có field: không nhãn Đề cử, thứ tự cũ.
    const bare = html(recommendedSectionTrees({ family: "other", rows: base, registry, locale }));
    assert.equal(badgeCount(bare), 0);
    assert.deepEqual(keysIn(bare), oldOrder);
  });

  test(`nhãn Đề cử có ở thẻ, thẻ gọn và bảng (${locale})`, () => {
    const state = referenceSectionState("other", "https://x.test/doi-khac/", registry, null);
    const filtered = projectRecommendedRows(rows, state, labels);
    for (const mode of [null, TEAM_VIEW_GRID, TEAM_VIEW_TABLE]) {
      const markup = html(recommendedListTrees(filtered, { family: "other", mode, labels, mountId: "m", locale }));
      assert.equal(badgeCount(markup), flagged.length, `${locale}/${mode}`);
      assert.ok(markup.replace(/<[^>]+>/g, " ").includes(locale === "zh" ? "推荐" : "Đề cử"));
    }
  });

  test(`huy hiệu trang chi tiết Đội khác (${locale}): chỉ hiện khi đội được đề cử`, () => {
    const on = html(detailBadges({ ...base[0], referenceRecommended: true }, null, { locale }));
    const off = html(detailBadges({ ...base[0] }, null, { locale }));
    assert.equal(badgeCount(on), 1);
    assert.equal(badgeCount(off), 0);
    assert.ok(on.includes(locale === "zh" ? "推荐" : "Đề cử"));
  });
}

test("Đội chuẩn dựng sẵn không có nhãn mùa tĩnh; mùa Đội khác không xác định được hoặc registry không có thì không có nhãn", () => {
  const standard = html(recommendedSectionTrees({ family: "recommended", rows: [], registry, locale: "vi" }));
  assert.doesNotMatch(standard, /reference-season-static/);
  assert.equal(referenceSeasonLabelTree({ defaultSourceSeasonId: "khong-co", seasonOptions: [] }, rows), null);
  assert.equal(referenceSeasonLabelTree({}, rows), null);
  assert.equal(referenceSeasonLabelTree(registry, []), null);
  assert.equal(referenceSeasonLabelTree(registry, base), null, "hàng chưa gắn mùa");
  const mixed = rows.map((row, index) => (index ? row : { ...row, sourceSeasonIds: ["pk-s26"] }));
  assert.equal(otherTeamsSeasonId(mixed), null, "hai mùa thì không có nhãn");
  const unknown = rows.map((row) => ({ ...row, sourceSeasonIds: ["khong-co"] }));
  const other = html(recommendedSectionTrees({ family: "other", rows: unknown, registry, locale: "vi" }));
  assert.doesNotMatch(other, /reference-season-static/);
});

test("nhãn mùa Đội khác đi theo mùa của dữ liệu Đội khác, không theo mùa mặc định của Đội chuẩn", () => {
  assert.equal(otherTeamsSeasonId(rows), registry.defaultSourceSeasonId);
  const other = registry.seasonOptions.find((item) => item.sourceSeasonId !== registry.defaultSourceSeasonId && item.displayNameVi);
  // Biên tập đổi mùa mặc định sang mùa khác mà chưa chạy lại dedup: nhãn vẫn là mùa của các hàng Đội khác.
  const moved = { ...registry, defaultSourceSeasonId: other.sourceSeasonId };
  const markup = html(recommendedSectionTrees({ family: "other", rows, registry: moved, locale: "vi" }));
  assert.ok(markup.includes(`<span class="reference-season-name">${season.displayNameVi}</span>`));
  assert.ok(!markup.includes(`<span class="reference-season-name">${other.displayNameVi}</span>`));
  const real = json(`${REFERENCE}/other-teams.json`).records;
  assert.equal(otherTeamsSeasonId(real), "pk-s27");
});
