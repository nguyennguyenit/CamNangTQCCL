// Độ phủ kho cho danh sách Đội chuẩn (#62): đọc kho đã lưu trên máy (không gọi mạng, không đồng bộ) và tính số
// món thiếu của từng đội theo `sourceConfigId`. Cùng bộ dựng đội (`buildSeasonCandidates`) và cùng luật đủ/thiếu
// (`buildRosterCoverage`) với khối "Độ phủ kho" của Gợi ý đội, nên hai nơi luôn ra cùng con số cho cùng kho.
// Module không có chữ hiển thị và không đụng DOM.
import { ROSTER_SCAN_STORAGE_KEY, deserializeRosterScanState } from "./roster-scan-state.js";
import { CLOUD_STORAGE_KEY, MAIN_BOX_ID, normalizeCloudState, toScanState } from "./roster-cloud-store.js";
import { buildSeasonCandidates } from "./roster-season-candidates.js";
import { buildRosterCoverage } from "./roster-coverage.js";
import { createTacticIdResolver } from "./lookup-ids.js";

const hasItems = (scan) => Boolean(scan?.ownedHeroes?.length || scan?.ownedTactics?.length);

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
 * @returns {{ownedHeroes: object[], ownedTactics: object[], source: "local"|"cloud"}|null}
 */
export function readOwnedRoster(storage, { userId = null } = {}) {
  if (!storage) return null;
  try {
    if (userId) {
      const state = normalizeCloudState(readJson(storage, CLOUD_STORAGE_KEY), userId);
      const scan = state ? toScanState(state, MAIN_BOX_ID) : null;
      return hasItems(scan) ? { ownedHeroes: scan.ownedHeroes, ownedTactics: scan.ownedTactics, source: "cloud" } : null;
    }
    const raw = storage.getItem(ROSTER_SCAN_STORAGE_KEY);
    if (typeof raw !== "string" || !raw) return null;
    const scan = deserializeRosterScanState(JSON.parse(raw));
    return hasItems(scan) ? { ownedHeroes: scan.ownedHeroes, ownedTactics: scan.ownedTactics, source: "local" } : null;
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
 * @param {{ownedHeroes: Array, ownedTactics: Array}|null} input.roster kết quả `readOwnedRoster`
 * @returns {{byConfigId: Map<string, {missingCount: number, missing: Array<{kind: "hero"|"tactic", name: string, unresolved?: true}>}>, summary: {complete: number, total: number}}}
 */
export function buildListCoverage({ records = [], seasonId, heroesDict = [], tacticsDict = [], roster = null } = {}) {
  const byConfigId = new Map();
  if (!roster || !seasonId) return { byConfigId, summary: { complete: 0, total: 0 } };
  const season = buildSeasonCandidates(records, seasonId, { heroesDict, tacticsDict });
  const coverage = buildRosterCoverage({
    seasonTeams: season.teams,
    seasonTier: season.teamTier,
    ownedHeroes: roster.ownedHeroes,
    ownedTactics: roster.ownedTactics,
    tacticIdOf: createTacticIdResolver(tacticsDict),
  });
  let complete = 0;
  for (const entry of coverage.teams) {
    byConfigId.set(entry.team.id, { missingCount: entry.missingCount, missing: entry.missing });
    if (entry.missingCount === 0) complete++;
  }
  return { byConfigId, summary: { complete, total: byConfigId.size } };
}
