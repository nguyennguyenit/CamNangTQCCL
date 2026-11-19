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
  if (!payload || typeof payload !== 'object') return { teams: [], completeRecords: [], byLegacyTeam: new Map() };
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
  // `legacyTeamId` → team chứa phương án đủ dữ liệu đó (mỗi đội gốc đúng một phương án).
  const byLegacyTeam = new Map(teams.flatMap((team) => team.completeRecords.map((record) => [record.legacyTeamId, team])));
  const index = { teams, completeRecords: teams.flatMap((team) => team.completeRecords), byLegacyTeam };
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

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Chỗ khác của từng tướng trong phương án `record` so với phương án đang xem `current` (cùng team nên cùng bộ tướng, ghép
 * theo `heroIdentityId`). `tacticDiffers[i]`/`bookDiffers[i]` đi theo đúng ô `tacticSlotsRaw[i]`/`bookSlotsRaw[i]`:
 * chiến pháp khác khi danh tính (`tacticIdentityIds[i]`) không có trong chiến pháp của tướng đó ở phương án đang xem (bỏ thứ
 * tự); binh thư khác khi tên không có trong binh thư của tướng đó, hoặc là binh thư chính (ô có chữ đầu tiên) mà binh thư
 * chính đang xem khác (cùng quy tắc khóa gộp nội bộ của builder: binh thư chính giữ vị trí, binh thư phụ bỏ thứ tự).
 * `changed`: tướng có ít nhất một ô khác.
 */
function holderDiffs(record, current) {
  const base = new Map((current.holders || []).map((holder) => [holder?.heroIdentityId, holder]));
  return (record.holders || []).map((holder) => {
    const other = base.get(holder?.heroIdentityId) || {};
    const tacticIds = new Set((other.tacticIdentityIds || []).filter(Boolean));
    const tacticDiffers = (holder.tacticSlotsRaw || []).map((raw, index) => {
      if (!trimmed(raw)) return false;
      const id = holder.tacticIdentityIds?.[index];
      return !(id && tacticIds.has(id));
    });
    const otherBooks = (other.bookSlotsRaw || []).map(trimmed).filter(Boolean);
    const bookNames = new Set(otherBooks);
    const books = holder.bookSlotsRaw || [];
    const primary = books.findIndex((name) => trimmed(name));
    const bookDiffers = books.map((name, index) => {
      const value = trimmed(name);
      if (!value) return false;
      return !bookNames.has(value) || (index === primary && value !== otherBooks[0]);
    });
    return { holder, tacticDiffers, bookDiffers, changed: [...tacticDiffers, ...bookDiffers].some(Boolean) };
  });
}

/**
 * Các phương án đủ dữ liệu khác cùng team với phương án của đội gốc `legacyTeamId`, theo `optionRank` (builder tính):
 * `[{record, holders}]` với `holders` là chỗ khác so với phương án đang xem (`holderDiffs`). Phương án không đủ dữ liệu,
 * không có trong payload, hoặc team chỉ có một phương án ⇒ `[]`. Dùng chung cho trang dựng sẵn (src/lib/team-ssr.ts) và
 * nhánh `?variant=` phía client (js/team-detail.js) nên hai đường dựng ra cùng khối.
 */
export function otherTeamOptions(payload, legacyTeamId) {
  const team = teamIndex(payload).byLegacyTeam.get(legacyTeamId);
  if (!team) return [];
  const current = team.completeRecords.find((record) => record.legacyTeamId === legacyTeamId);
  return team.completeRecords
    .filter((record) => record !== current)
    .map((record) => ({ record, holders: holderDiffs(record, current) }));
}
