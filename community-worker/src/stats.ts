// Tổng hợp thống kê chiến báo đã duyệt của một trang (mọi ngôn ngữ).

import type { ReportResult } from "./validate";

export interface StatsRow {
  result: ReportResult;
  enemyHeroes: string[];
}

export interface OpponentStat {
  heroes: string[];
  count: number;
  wins: number;
}

export interface ReportStats {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  topOpponents: OpponentStat[];
}

export const TOP_OPPONENTS = 5;

/**
 * Đếm thắng/thua/hoà; winRate = wins/total (4 chữ số thập phân, null khi chưa có).
 * topOpponents gom theo TẬP tướng địch đã sắp xếp (thứ tự trong ảnh không quan trọng),
 * bỏ báo cáo không có tướng địch; xếp theo count giảm dần, rồi wins, rồi khoá tập.
 */
export function aggregateStats(rows: StatsRow[]): ReportStats {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  const groups = new Map<string, OpponentStat>();
  for (const row of rows) {
    if (row.result === "win") wins++;
    else if (row.result === "loss") losses++;
    else draws++;
    if (row.enemyHeroes.length === 0) continue;
    const heroes = [...new Set(row.enemyHeroes)].sort();
    const key = heroes.join("\u0000");
    const group = groups.get(key) ?? { heroes, count: 0, wins: 0 };
    group.count++;
    if (row.result === "win") group.wins++;
    groups.set(key, group);
  }
  const total = rows.length;
  const topOpponents = [...groups.values()]
    .sort(
      (a, b) =>
        b.count - a.count || b.wins - a.wins || a.heroes.join(",").localeCompare(b.heroes.join(",")),
    )
    .slice(0, TOP_OPPONENTS);
  return {
    total,
    wins,
    losses,
    draws,
    winRate: total === 0 ? null : Math.round((wins / total) * 10_000) / 10_000,
    topOpponents,
  };
}
