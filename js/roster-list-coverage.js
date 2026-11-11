// Độ phủ kho cho danh sách Đội chuẩn (#62): đọc kho đã lưu trên máy (không gọi mạng, không đồng bộ) và tính số
// món thiếu của từng đội theo `sourceConfigId`. Cùng bộ dựng đội (`buildSeasonCandidates`) và cùng luật đủ/thiếu
// (`buildRosterCoverage`) với khối "Độ phủ kho" của Gợi ý đội, nên hai nơi luôn ra cùng con số cho cùng kho.
// Module không có chữ hiển thị và không đụng DOM.
import { ROSTER_SCAN_STORAGE_KEY, deserializeRosterScanState } from "./roster-scan-state.js";
import { CLOUD_STORAGE_KEY, MAIN_BOX_ID, normalizeCloudState, toScanState } from "./roster-cloud-store.js";
import { applyTacticOverrides, buildSeasonCandidates } from "./roster-season-candidates.js";
import { buildRosterCoverage } from "./roster-coverage.js";
import { createTacticIdResolver } from "./lookup-ids.js";

const hasItems = (scan) => Boolean(scan?.ownedHeroes?.length || scan?.ownedTactics?.length);

/** Kho ở dạng trả ra: tướng, chiến pháp, và món bù người dùng đã chọn cho từng ô (như Gợi ý đội dùng). */
const rosterOf = (scan, source) => ({
  ownedHeroes: scan.ownedHeroes,
  ownedTactics: scan.ownedTactics,
  tacticOverrides: scan.tacticOverrides || [],
  source,
});

/** Tên Việt của từ điển → tên Hán gốc (`chinese`); dòng thiếu một trong hai bị bỏ. */
function chineseNames(dict) {
  const names = new Map();
  for (const row of dict || []) if (row?.viet && row?.chinese && !names.has(row.viet)) names.set(row.viet, row.chinese);
  return names;
}

/** Tên Hán của một món thiếu; ô tướng "A/B" đổi từng phần. Không tra đủ thì `null` (caller giữ tên gốc). */
function chineseNameOf(name, names) {
  const parts = String(name).split("/").map((part) => names.get(part.trim()));
  return parts.every(Boolean) ? parts.join("/") : null;
}

function readJson(storage, key) {
  const raw = storage.getItem(key);
  return typeof raw === "string" && raw ? JSON.parse(raw) : null;
}

/**
 * Kho đang có trên máy, theo đúng luật của Gợi ý đội:
 * - khách (`userId` rỗng): kho local `tqccl.rosterRecommend.scanState.v1`; cache cloud còn sót của ai đó không được đọc;
 * - đã đăng nhập: hộp `main` trong cache cloud của CHÍNH người đó; không có cache khớp thì coi như chưa có kho
 *   (kho local không thay thế kho tài khoản).
 * Trả `null` khi không có tướng lẫn chiến pháp, khi dữ liệu hỏng, hoặc khi storage bị chặn.
 *
 * @param {Pick<Storage, "getItem">|null} storage
 * @param {{userId?: string|null}} [options]
 * @returns {{ownedHeroes: object[], ownedTactics: object[], tacticOverrides: object[], source: "local"|"cloud"}|null}
 */
export function readOwnedRoster(storage, { userId = null } = {}) {
  if (!storage) return null;
  try {
    if (userId) {
      const state = normalizeCloudState(readJson(storage, CLOUD_STORAGE_KEY), userId);
      const scan = state ? toScanState(state, MAIN_BOX_ID) : null;
      return hasItems(scan) ? rosterOf(scan, "cloud") : null;
    }
    const raw = storage.getItem(ROSTER_SCAN_STORAGE_KEY);
    if (typeof raw !== "string" || !raw) return null;
    const scan = deserializeRosterScanState(JSON.parse(raw));
    return hasItems(scan) ? rosterOf(scan, "local") : null;
  } catch {
    return null;
  }
}

/**
 * Số món thiếu của từng đội Đội chuẩn thuộc mùa `seasonId`. Chỉ đội hạng mục Giao chiến đã đối chiếu đủ tướng mới có
 * mục (như khối Độ phủ kho); đội khác không có khóa trong `byConfigId` và danh sách không gắn badge cho chúng.
 *
 * @param {object} input
 * @param {object[]} input.records `index.json` của generation Đội chuẩn
 * @param {string} input.seasonId
 * @param {object[]} input.heroesDict
 * @param {object[]} input.tacticsDict
 * @param {{ownedHeroes: Array, ownedTactics: Array, tacticOverrides?: Array}|null} input.roster kết quả `readOwnedRoster`;
 *   món bù trong `tacticOverrides` được tính như ở khối Độ phủ kho (ô có món bù trong kho là đủ)
 * @returns {{byConfigId: Map<string, {missingCount: number, missing: Array<{kind: "hero"|"tactic", name: string, nameZh?: string, unresolved?: true}>}>, summary: {complete: number, total: number}}}
 *   `nameZh` là tên Hán của từ điển cho bản zh (vắng mặt khi không tra được)
 */
export function buildListCoverage({ records = [], seasonId, heroesDict = [], tacticsDict = [], roster = null } = {}) {
  const byConfigId = new Map();
  if (!roster || !seasonId) return { byConfigId, summary: { complete: 0, total: 0 } };
  const season = buildSeasonCandidates(records, seasonId, { heroesDict, tacticsDict });
  const coverage = buildRosterCoverage({
    seasonTeams: applyTacticOverrides(season.teams, roster.tacticOverrides),
    seasonTier: season.teamTier,
    ownedHeroes: roster.ownedHeroes,
    ownedTactics: roster.ownedTactics,
    tacticIdOf: createTacticIdResolver(tacticsDict),
  });
  const zhNames = { hero: chineseNames(heroesDict), tactic: chineseNames(tacticsDict) };
  const withChinese = (item) => {
    const nameZh = item.unresolved ? null : chineseNameOf(item.name, zhNames[item.kind]);
    return nameZh ? { ...item, nameZh } : item;
  };
  let complete = 0;
  for (const entry of coverage.teams) {
    byConfigId.set(entry.team.id, { missingCount: entry.missingCount, missing: entry.missing.map(withChinese) });
    if (entry.missingCount === 0) complete++;
  }
  return { byConfigId, summary: { complete, total: byConfigId.size } };
}
