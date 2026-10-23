// Ghi kho Gợi ý đội của người đã đăng nhập vào cache cloud (`js/roster-cloud-store.js`) cho `js/roster-recommend-ui.js`.
// Giữ hai điều mà UI cần nhưng không nên tự theo dõi:
// - `previous`: kho UI ngay trước mỗi lần ghi (nạp từ cloud hoặc lần ghi trước), để xóa mềm CHỈ theo chênh lệch;
// - `busy()`: còn lần ghi đang chờ → UI không nạp lại từ cache (sẽ kéo `state` lùi về trước thao tác kế tiếp).

import { emptyCloudState, mergeLocal, writeScanState } from "./roster-cloud-store.js";

const byName = (list) => new Map((list || []).map((item) => [item.name, item]));

/**
 * Kho UI sau khi cloud đổi/ghi xong: lấy bản cloud (`cloudScan`, từ `toScanState`) làm gốc nhưng
 * - món UI vẫn giữ `confidence`/cờ khi cloud có món cùng tên (tương đương, không ghi đè);
 * - món "chỉ có trên máy này" (không đối chiếu được, không bao giờ lên cloud) được giữ nguyên từ kho UI.
 * Món có trên UI mà cloud không còn (xóa từ máy khác) thì mất như trước.
 */
export function reconcileScanWithCloud(ui, cloudScan, resolve) {
  const localOnly = mergeLocal(emptyCloudState("local"), ui, resolve, { groups: false, now: 0 }).localOnly;
  const merge = (key, names) => {
    const mine = byName(ui?.[key]);
    const fromCloud = (cloudScan[key] || []).map((item) => {
      const own = mine.get(item.name);
      if (!own) return item;
      const { redStars: _stale, ...rest } = own;
      return { ...rest, ...(Number.isFinite(item.redStars) ? { redStars: item.redStars } : {}) };
    });
    const known = new Set(fromCloud.map((item) => item.name));
    const kept = (ui?.[key] || []).filter((item) => names.includes(item.name) && !known.has(item.name));
    return [...fromCloud, ...kept];
  };
  const teamKey = (team) => team.teamName;
  const lockedKnown = new Set((cloudScan.lockedTeams || []).map(teamKey));
  const lockedKept = (ui?.lockedTeams || []).filter((team) => localOnly.lockedTeams.includes(team.teamName) && !lockedKnown.has(teamKey(team)));
  const overridesKept = (ui?.tacticOverrides || []).filter((item) => localOnly.overrides.includes(`${item.teamId}`));
  const overrideKey = (item) => `${item.teamId}|${item.heroIndex}|${item.slotIndex}`;
  const overrideKnown = new Set((cloudScan.tacticOverrides || []).map(overrideKey));
  return {
    ...cloudScan,
    ownedHeroes: merge("ownedHeroes", localOnly.heroes),
    ownedTactics: merge("ownedTactics", localOnly.tactics),
    lockedTeams: [...(cloudScan.lockedTeams || []), ...lockedKept],
    tacticOverrides: [...(cloudScan.tacticOverrides || []), ...overridesKept.filter((item) => !overrideKnown.has(overrideKey(item)))],
  };
}

export function createScanWriter({ sync, resolve, boxId }) {
  let pending = 0;
  let baseline = null;
  return {
    /** UI vừa nạp kho từ cache cloud: đây là mốc cho chênh lệch kế tiếp. */
    rebase(scan) {
      baseline = scan;
    },
    busy: () => pending > 0,
    /** Ghi `next`; trả `{outcome, localOnly, idle}` (`idle`: không còn lần ghi nào đang chờ). */
    async write(next) {
      const box = boxId(); // chụp trước khi chờ khóa: đổi hộp lúc đang ghi không làm ghi nhầm hộp
      const previous = baseline;
      baseline = next;
      pending += 1;
      let localOnly = null;
      try {
        const outcome = await sync.mutate((cloudState, { now }) => {
          const written = writeScanState(cloudState, box, next, resolve, { now, previous, groups: false }); // Gợi ý đội không kéo `group`: không dựng lại nhóm mặc định
          localOnly = written.localOnly;
          return written.state;
        });
        return { outcome, localOnly, idle: pending === 1 };
      } finally {
        pending -= 1;
      }
    },
  };
}
