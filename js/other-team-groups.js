// Danh sách Đội khác theo team: team = bộ 3 tướng + binh chủng (`teamGroups` của `other-teams.json`, builder tính), mỗi cấu
// hình khác chiến pháp/binh thư là một phương án có trang riêng. Website chỉ dùng phương án đủ dữ liệu (`completeVariantIds`,
// `dataComplete`); team không có phương án đủ dữ liệu (`representativeVariantId: null`) không có mục. Thứ tự team là
// `optionRank` của đại diện (Đề cử trước, rồi thứ tự ledger) do builder tính: JS dùng lại, không tính thứ tự lần hai.
// Hàm thuần dùng chung giữa bản dựng sẵn (`src/lib/team-section-ssr.js`) và trình duyệt (`js/team-filter-section.js`).

import { projectRecommendedRows, referenceFacetValues } from './recommended-reference-state.js';

/** Chỉ mục team theo payload (bất biến trong một lần publication). */
const indexes = new WeakMap();

const fail = (message) => { throw new Error(`Dữ liệu Đội khác không khớp: ${message}`); };

/**
 * Team có đại diện của payload, theo `optionRank` của đại diện: `{group, displayRecord, completeRecords}` với
 * `completeRecords` là mọi phương án đủ dữ liệu của team theo `optionRank` (gồm đại diện). Payload không có `teamGroups`
 * thì không có team. `teamGroups` trỏ tới phương án không có trong `records`, phương án thiếu dữ liệu, phương án của team
 * khác, hoặc đại diện ngoài phương án đủ dữ liệu thì ném lỗi: dữ liệu đã qua validator của builder và hash của trang, lệch là
 * lỗi publish, không lặng lẽ bỏ team.
 */
function teamIndex(payload) {
  if (!payload || typeof payload !== 'object') return { teams: [], completeRecords: [] };
  const cached = indexes.get(payload);
  if (cached) return cached;
  const records = Array.isArray(payload.records) ? payload.records : [];
  const groups = Array.isArray(payload.teamGroups) ? payload.teamGroups : [];
  const byVariant = new Map(records.map((record) => [record?.legacyVariantId, record]));
  const teams = [];
  for (const group of groups) {
    if (group?.representativeVariantId === null || group?.representativeVariantId === undefined) continue;
    const completeRecords = (Array.isArray(group.completeVariantIds) ? group.completeVariantIds : []).map((variantId) => {
      const record = byVariant.get(variantId);
      if (!record) fail(`phương án ${variantId} của team ${group.teamGroupId} không có trong records`);
      if (record.dataComplete !== true) fail(`phương án ${variantId} của team ${group.teamGroupId} thiếu dữ liệu`);
      if (record.teamGroupId !== group.teamGroupId) fail(`phương án ${variantId} thuộc team ${record.teamGroupId}, không phải ${group.teamGroupId}`);
      if (!Number.isInteger(record.optionRank)) fail(`phương án ${variantId} không có optionRank`);
      return record;
    }).sort((a, b) => a.optionRank - b.optionRank);
    const displayRecord = byVariant.get(group.representativeVariantId);
    if (!completeRecords.includes(displayRecord)) fail(`đại diện ${group.representativeVariantId} của team ${group.teamGroupId} không thuộc phương án đủ dữ liệu`);
    teams.push({ group, displayRecord, completeRecords });
  }
  teams.sort((a, b) => a.displayRecord.optionRank - b.displayRecord.optionRank);
  const index = { teams, completeRecords: teams.flatMap((team) => team.completeRecords) };
  indexes.set(payload, index);
  return index;
}

/**
 * Mục danh sách Đội khác của `state` (mùa, từ khóa, facet; cùng phép lọc với `projectRecommendedRows`):
 * `[{group, displayRecord, linkRecord, completeRecords, optionCount, href}]`, theo `optionRank` của đại diện.
 * Team khớp khi bất kỳ phương án đủ dữ liệu nào khớp. Thẻ luôn dựng bằng đại diện (`displayRecord`); `linkRecord` là
 * đại diện nếu đại diện khớp, không thì phương án khớp có `optionRank` nhỏ nhất, và `href = hrefFor(linkRecord)` trỏ trang
 * của chính phương án đó (vắng `hrefFor` thì `null`). `optionCount` là số phương án đủ dữ liệu của team.
 */
export function otherTeamListEntries(payload, state, labels, { hrefFor } = {}) {
  const { teams, completeRecords } = teamIndex(payload);
  if (!teams.length) return [];
  const matched = new Set(projectRecommendedRows(completeRecords, state, labels));
  const entries = [];
  for (const team of teams) {
    const linkRecord = matched.has(team.displayRecord) ? team.displayRecord : team.completeRecords.find((record) => matched.has(record));
    if (!linkRecord) continue;
    entries.push({
      group: team.group,
      displayRecord: team.displayRecord,
      linkRecord,
      completeRecords: team.completeRecords,
      optionCount: team.completeRecords.length,
      href: typeof hrefFor === 'function' ? hrefFor(linkRecord) : null,
    });
  }
  return entries;
}

/** Giá trị facet `key` của một mục team: hợp giá trị của mọi phương án đủ dữ liệu (bộ đếm facet đếm theo team). */
export function otherTeamFacetValues(entry, key) {
  return [...new Set((entry?.completeRecords || []).flatMap((record) => referenceFacetValues(record, key)))];
}
