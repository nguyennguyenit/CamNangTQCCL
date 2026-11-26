// Đội khác chỉ có một mùa (mùa ghi trên các hàng `other-teams.json`): nhãn tĩnh thay ô chọn mùa, `?season=` bị bỏ qua.
// Danh sách là team (bộ 3 tướng + binh chủng) dựng từ phương án đại diện; thứ tự là `optionRank` của đại diện do builder
// tính (Đề cử trước), nên team có đại diện đề cử đứng đầu và mang nhãn "Đề cử". Dữ liệu là bản ghi thật của generation
// đang pin; mẫu nhỏ chỉ lấy một phần team thật (không sửa generation).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { treeToHtml } from "../js/view-tree.js";
import { projectRecommendedRows, readRecommendedQuery, referenceSectionState } from "../js/recommended-reference-state.js";
import { otherTeamListEntries } from "../js/other-team-groups.js";
import { detailBadges, recommendedListTrees } from "../js/recommended-reference-render.js";
import { otherTeamsSeasonId, referenceSeasonLabelTree } from "../js/team-filter-section.js";
import { jaSeasonName } from "../js/ja-season-names.js";
import { safeReturnUrl } from "../js/team-detail-navigation.js";
import { recommendedSectionTrees } from "../src/lib/team-section-ssr.js";
import { TEAM_VIEW_GRID, TEAM_VIEW_TABLE } from "../js/team-view.js";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const GENERATION = json("src/data/recommended-reference/current.json").generationId;
const REFERENCE = `src/data/recommended-reference/${GENERATION}`;
const registry = json(`${REFERENCE}/seasons.json`);
const labels = registry.displayLabels;
const payload = json(`${REFERENCE}/other-teams.json`);
const byVariant = new Map(payload.records.map((row) => [row.legacyVariantId, row]));
const repOf = (group) => byVariant.get(group.representativeVariantId);
// Kỳ vọng dựng thẳng từ `teamGroups`: team có đại diện, theo optionRank của đại diện.
const teams = payload.teamGroups.filter((group) => group.representativeVariantId !== null).sort((a, b) => repOf(a).optionRank - repOf(b).optionRank);
const recommendedTeams = teams.filter((group) => repOf(group).recommended === true);
assert.ok(recommendedTeams.length >= 2 && teams.length - recommendedTeams.length >= 6, "cần team đề cử và team thường trong dữ liệu thật");

/** Payload con giữ nguyên record và group thật của `groups` (mọi phương án của team, cả phương án thiếu dữ liệu). */
const subPayload = (groups, mapRecord = (row) => row) => {
  const ids = new Set(groups.map((group) => group.teamGroupId));
  return { ...payload, records: payload.records.filter((row) => ids.has(row.teamGroupId)).map(mapRecord), teamGroups: groups };
};
// Hai team đề cử + sáu team thường, cố ý xếp team thường lên trước trong `teamGroups`: thứ tự phải theo optionRank.
const sampleGroups = [...teams.filter((group) => !recommendedTeams.includes(group)).slice(0, 6), ...recommendedTeams.slice(0, 2)];
const sample = subPayload(sampleGroups);
const sampleOrder = [...sampleGroups].sort((a, b) => repOf(a).optionRank - repOf(b).optionRank).map((group) => group.representativeVariantId);
const flaggedIds = recommendedTeams.slice(0, 2).map((group) => group.representativeVariantId);
// Field `recommended` vắng (generation cũ): không nhãn Đề cử, thứ tự vẫn là optionRank.
const bare = subPayload(sampleGroups, ({ recommended, ...row }) => row);
const rows = sample.records;
const season = registry.seasonOptions.find((item) => item.sourceSeasonId === registry.defaultSourceSeasonId);
const key = (entry) => entry.displayRecord.legacyVariantId;
const html = (trees) => [].concat(trees).map(treeToHtml).join("");
const badgeCount = (markup) => (markup.match(/class="badge badge-band reference-recommended"/g) ?? []).length;
const keysIn = (markup) => [...markup.matchAll(/data-reference-key="([^"]*)"/g)].map((match) => match[1]);
const SEASON_PREFIX = { vi: "Mùa", zh: "赛季", ja: "シーズン" };
const RECOMMENDED = { vi: "Đề cử", zh: "推荐", ja: "おすすめ" };

test("?season= bất kỳ trên Đội khác bị bỏ qua: đủ team, không thông báo mùa, đủ kiểu giá trị lạ", () => {
  const plain = referenceSectionState("other", "https://x.test/doi-khac/", registry, null);
  const expected = otherTeamListEntries(payload, plain, labels).map(key);
  assert.deepEqual(expected, teams.map((group) => group.representativeVariantId));
  for (const query of ["?season=pk-s24", "?season=khong-ton-tai", "?season=all", "?season=unknown", "?season=a&season=b", "?season="]) {
    const state = referenceSectionState("other", `https://x.test/doi-khac/${query}`, registry, null);
    assert.equal(state.season, "all", query);
    assert.deepEqual(state.notices, plain.notices, `${query}: không thêm thông báo mùa`);
    assert.deepEqual(otherTeamListEntries(payload, state, labels).map(key), expected, `${query}: đủ team, cùng thứ tự`);
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

test("team có đại diện đề cử đứng đầu theo optionRank; field recommended vắng thì không đổi thứ tự", () => {
  const state = referenceSectionState("other", "https://x.test/doi-khac/", registry, null);
  const entries = otherTeamListEntries(payload, state, labels);
  const flags = entries.map((entry) => entry.displayRecord.recommended === true);
  assert.equal(flags.filter(Boolean).length, recommendedTeams.length);
  assert.equal(flags.indexOf(false), recommendedTeams.length, "mọi team đề cử đứng trước team thường");
  assert.deepEqual(otherTeamListEntries(sample, state, labels).map(key), sampleOrder);
  assert.deepEqual(sampleOrder.slice(0, 2), flaggedIds);
  assert.deepEqual(otherTeamListEntries(bare, state, labels).map(key), sampleOrder, "không có field recommended: vẫn optionRank");
  // Hàng Đội chuẩn (có `sourceConfigId`) không bị tác động dù mang field này.
  const standard = [
    { sourceConfigId: "b", tierOrder: 2, listIndex: 1, value: 1, recommended: true, heroes: [] },
    { sourceConfigId: "a", tierOrder: 1, listIndex: 0, value: 1, heroes: [] },
  ];
  assert.deepEqual(projectRecommendedRows(standard, { season: "all", query: "", filters: {} }, labels).map((row) => row.sourceConfigId), ["a", "b"]);
});

for (const locale of ["vi", "zh", "ja"]) {
  test(`Đội khác dựng sẵn (${locale}): nhãn mùa tĩnh từ registry, không ô chọn, nhãn Đề cử trên đúng team, team đề cử đứng đầu`, () => {
    const markup = html(recommendedSectionTrees({ family: "other", payload: sample, registry, locale }));
    // Bản ja: tên mùa Nhật đã xác minh (mùa Đội khác hiện là PK-S27 = 漢焔不滅), thiếu thì tên nguồn như bản zh.
    const name = locale === "vi" ? season.displayNameVi : locale === "ja" ? jaSeasonName(season.nameRaw) ?? season.nameRaw : season.nameRaw;
    if (locale === "ja" && season.sourceSeasonId === "pk-s27") assert.equal(name, "漢焔不滅");
    assert.ok(markup.includes(`<div class="reference-season-field reference-season-static"><span class="reference-season-label">${SEASON_PREFIX[locale]}</span> <span class="reference-season-name">${name}</span></div>`));
    assert.doesNotMatch(markup, /<select|<option|Tất cả|Chưa rõ mùa|全部|赛季不明/u);
    assert.equal(badgeCount(markup), flaggedIds.length);
    assert.ok(markup.includes(`reference-recommended">${RECOMMENDED[locale]}</span>`));
    assert.deepEqual(keysIn(markup), sampleOrder);
    // Không có field: không nhãn Đề cử, cùng thứ tự.
    const plain = html(recommendedSectionTrees({ family: "other", payload: bare, registry, locale }));
    assert.equal(badgeCount(plain), 0);
    assert.deepEqual(keysIn(plain), sampleOrder);
  });

  test(`nhãn Đề cử có ở thẻ, thẻ gọn và bảng (${locale})`, () => {
    const state = referenceSectionState("other", "https://x.test/doi-khac/", registry, null);
    const entries = otherTeamListEntries(sample, state, labels);
    for (const mode of [null, TEAM_VIEW_GRID, TEAM_VIEW_TABLE]) {
      const markup = html(recommendedListTrees(entries, { family: "other", mode, labels, mountId: "m", locale }));
      assert.equal(badgeCount(markup), flaggedIds.length, `${locale}/${mode}`);
      assert.ok(markup.replace(/<[^>]+>/g, " ").includes(RECOMMENDED[locale]));
      assert.deepEqual(keysIn(markup), sampleOrder, `${locale}/${mode}: mỗi team một mục`);
    }
  });

  test(`huy hiệu trang chi tiết Đội khác (${locale}): chỉ hiện khi đội được đề cử`, () => {
    const on = html(detailBadges({ ...rows[0], referenceRecommended: true }, null, { locale }));
    const off = html(detailBadges({ ...rows[0], referenceRecommended: undefined }, null, { locale }));
    assert.equal(badgeCount(on), 1);
    assert.equal(badgeCount(off), 0);
    assert.ok(on.includes(RECOMMENDED[locale]));
  });
}

test("Đội chuẩn dựng sẵn không có nhãn mùa tĩnh; mùa Đội khác không xác định được hoặc registry không có thì không có nhãn", () => {
  const standard = html(recommendedSectionTrees({ family: "recommended", rows: [], registry, locale: "vi" }));
  assert.doesNotMatch(standard, /reference-season-static/);
  assert.equal(referenceSeasonLabelTree({ defaultSourceSeasonId: "khong-co", seasonOptions: [] }, rows), null);
  assert.equal(referenceSeasonLabelTree({}, rows), null);
  assert.equal(referenceSeasonLabelTree(registry, []), null);
  assert.equal(referenceSeasonLabelTree(registry, rows.map(({ sourceSeasonIds, ...row }) => row)), null, "hàng chưa gắn mùa");
  const mixed = rows.map((row, index) => (index ? row : { ...row, sourceSeasonIds: ["pk-s26"] }));
  assert.equal(otherTeamsSeasonId(mixed), null, "hai mùa thì không có nhãn");
  const unknown = subPayload(sampleGroups, (row) => ({ ...row, sourceSeasonIds: ["khong-co"] }));
  const other = html(recommendedSectionTrees({ family: "other", payload: unknown, registry, locale: "vi" }));
  assert.doesNotMatch(other, /reference-season-static/);
});

test("nhãn mùa Đội khác đi theo mùa của dữ liệu Đội khác, không theo mùa mặc định của Đội chuẩn", () => {
  assert.equal(otherTeamsSeasonId(rows), registry.defaultSourceSeasonId);
  const other = registry.seasonOptions.find((item) => item.sourceSeasonId !== registry.defaultSourceSeasonId && item.displayNameVi);
  // Biên tập đổi mùa mặc định sang mùa khác mà chưa chạy lại dedup: nhãn vẫn là mùa của các hàng Đội khác.
  const moved = { ...registry, defaultSourceSeasonId: other.sourceSeasonId };
  const markup = html(recommendedSectionTrees({ family: "other", payload: sample, registry: moved, locale: "vi" }));
  assert.ok(markup.includes(`<span class="reference-season-name">${season.displayNameVi}</span>`));
  assert.ok(!markup.includes(`<span class="reference-season-name">${other.displayNameVi}</span>`));
  assert.equal(otherTeamsSeasonId(payload.records), "pk-s27");
});
