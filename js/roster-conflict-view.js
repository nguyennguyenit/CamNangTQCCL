// View model thuần cho mục "Đội dựng được nhưng tranh món": biến `conflictedTeams` của engine thành thẻ hiển thị.
// Engine chỉ trả id đội đang giữ món (`usedBy`); ở đây đổi id đó thành tên đọc được từ `portfolioTeams`
// (gồm cả đội khóa) và không bao giờ để lộ id thô. Không có chữ hiển thị: nhãn dự phòng và bộ dịch tên do UI truyền vào.

export const CONFLICT_CARD_LIMIT = 5;

const identity = (value) => value;
const defaultTeamLabel = (team) => team?.name ?? "";

/**
 * @param {object} result kết quả `recommendRoster` (`conflictedTeams`, `portfolioTeams`).
 * @param {object} [options]
 * @param {(team: object) => string} [options.teamLabel] tên đội (bản zh: tên chữ Hán của tướng).
 * @param {(name: string) => string} [options.heroName] tên tướng hiển thị.
 * @param {(name: string) => string} [options.tacticName] tên chiến pháp hiển thị.
 * @param {string} [options.fallbackHolder] nhãn khi không tìm thấy đội đang giữ.
 * @param {number} [options.limit] số thẻ tối đa.
 * @returns {{cards: Array<{teamId: string, team: object, label: string, tier: string, items: Array<{kind: "hero"|"tactic", name: string, holderLabel: string}>}>, hiddenCount: number}}
 */
export function buildConflictView(result, {
  teamLabel = defaultTeamLabel,
  heroName = identity,
  tacticName = identity,
  fallbackHolder = "",
  limit = CONFLICT_CARD_LIMIT,
} = {}) {
  const conflicted = result?.conflictedTeams || [];
  const holders = new Map();
  for (const entry of result?.portfolioTeams || []) {
    if (entry?.team?.id !== undefined) holders.set(entry.team.id, entry.team);
  }
  const holderLabel = (id) => {
    const team = holders.get(id);
    return (team && teamLabel(team)) || fallbackHolder;
  };
  const cards = conflicted.map((entry) => ({
    teamId: entry.team.id,
    team: entry.team,
    label: teamLabel(entry.team),
    tier: entry.tier || "",
    items: [
      ...(entry.sharedHeroes || []).map((item) => ({ kind: "hero", name: heroName(item.hero), holderLabel: holderLabel(item.usedBy) })),
      ...(entry.sharedTactics || []).map((item) => ({ kind: "tactic", name: tacticName(item.tactic), holderLabel: holderLabel(item.usedBy) })),
    ],
  }));
  const shownCount = Math.min(cards.length, Math.max(0, limit));
  return { cards: cards.slice(0, shownCount), hiddenCount: cards.length - shownCount };
}
