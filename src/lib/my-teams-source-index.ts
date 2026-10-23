/**
 * Chỉ mục hash nguồn của "Đội của tôi": `{ "kind:key": contentHash }` cho mọi đội mà nút "Lưu vào Đội của tôi" có thể chép —
 * Đội chuẩn, Đội khác (đội gốc và biến thể đã duyệt) và Khai hoang (đội mặc định và biến thể). Trang `/doi-cua-toi/` tải
 * `/my-teams-source-index.json` để báo "Bản gốc đã cập nhật" khi hash đã lưu lệch hash hiện tại; trang chi tiết nhúng cùng hash
 * trong payload lưu đội (`team-save-payload`). Hash tính bằng đúng hàm của `js/my-teams-sources.js` trên dữ liệu đã ghim
 * của lần build (thế hệ Đội chuẩn, `teams.json`, `khaihoang.json` của `websiteDisplayPublicationSnapshot`).
 */
import { khaiHoangSourceHash, legacySourceHash, recommendedSourceHash, sourceKeyPart, variantKey } from '../../js/my-teams-sources.js';
import type { WebsiteDisplayPublicationSnapshot } from './root-static-artifacts.ts';

const json = (bytes: Uint8Array) => JSON.parse(Buffer.from(bytes).toString('utf8'));

export type MyTeamsSourceIndex = Record<string, string>;

export function mySourceIndex(website: Pick<WebsiteDisplayPublicationSnapshot, 'publicFiles' | 'recommended'>): MyTeamsSourceIndex {
  const entries: Array<[string, string]> = [];

  const records: Array<Record<string, any>> = json(website.recommended.files['index.json'])?.records ?? [];
  for (const record of records) {
    entries.push([`recommended:${sourceKeyPart(record.sourceConfigId)}`, recommendedSourceHash(record)]);
  }

  const teams: Array<Record<string, any>> = json(website.publicFiles['teams.json']);
  const notesOf = new Map(teams.map((team) => [team.id, team.notes]));
  for (const team of teams) entries.push([`legacy:${variantKey(team.id, null)}`, legacySourceHash(team)]);
  const admitted: Array<Record<string, any>> = json(website.recommended.files['other-teams.json'])?.records ?? [];
  for (const row of admitted) {
    if (!row.legacyVariantId || !row.legacyContent) continue;
    // Nội dung đúng như trang biến thể đang hiện (js/team-detail.js `loadLegacy`): `legacyContent` + ghi chú của đội gốc.
    const content = { ...row.legacyContent, notes: notesOf.get(row.legacyTeamId) };
    entries.push([`legacy:${variantKey(row.legacyTeamId, row.legacyVariantId)}`, legacySourceHash(content)]);
  }

  const khaiHoang: { teams: Array<Record<string, any>> } = json(website.publicFiles['khaihoang.json']);
  for (const team of khaiHoang.teams) {
    entries.push([`khaihoang:${variantKey(team.id, null)}`, khaiHoangSourceHash(team, null)]);
    for (const variant of team.variants ?? []) {
      entries.push([`khaihoang:${variantKey(team.id, variant.id)}`, khaiHoangSourceHash(team, variant)]);
    }
  }

  const seen = new Set<string>();
  for (const [key] of entries) {
    if (seen.has(key)) throw new Error(`Chỉ mục nguồn Đội của tôi có khóa trùng: ${key}`);
    seen.add(key);
  }
  // Thứ tự khóa cố định: cùng dữ liệu cho cùng byte.
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

/** Byte của `/my-teams-source-index.json`: JSON gọn, khóa đã sắp. */
export const mySourceIndexJson = (index: MyTeamsSourceIndex) => `${JSON.stringify(index)}\n`;
