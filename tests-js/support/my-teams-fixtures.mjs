// Dữ liệu thật cho test "Đội của tôi": từ điển, thế hệ Đội chuẩn đang ghim, đội khác, Khai hoang. Không dựng dữ liệu
// giả ngoài các biến đổi nhỏ có chú thích tại chỗ dùng.

import { readFileSync } from "node:fs";
import { createLookupIdResolver } from "../../js/lookup-ids.js";
import { validateRosterRecord } from "./roster-fake-server.mjs";

const root = new URL("../../", import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));

export const heroesDict = readJson("data/heroes-dict.json");
export const tacticsDict = readJson("data/tactics.json");
export const booksDict = readJson("data/books-dict.json");
export const ids = createLookupIdResolver({ tactics: tacticsDict, books: booksDict, heroes: heroesDict });

const generationId = readJson("src/data/recommended-reference/current.json").generationId;
const generationDir = `src/data/recommended-reference/${generationId}/`;

/** Bản ghi đầy đủ của mọi cấu hình Đội chuẩn (`index.json` của thế hệ đã ghim). */
export const recommendedRecords = readJson(`${generationDir}index.json`).records;
export const recommendedById = (id) => {
  const record = recommendedRecords.find((row) => row.sourceConfigId === id);
  if (!record) throw new Error(`Không có cấu hình Đội chuẩn ${id}`);
  return structuredClone(record);
};

export const legacyTeams = readJson("data/teams.json");
export const legacyById = (id) => {
  const team = legacyTeams.find((row) => row.id === id);
  if (!team) throw new Error(`Không có đội khác ${id}`);
  return structuredClone(team);
};
/** Biến thể đội khác đã duyệt (`other-teams.json`): mỗi bản ghi có `legacyContent` riêng. */
export const admittedVariants = readJson(`${generationDir}other-teams.json`).records;

export const khaiHoang = readJson("data/khaihoang.json");
export const khaiHoangById = (id) => {
  const team = khaiHoang.teams.find((row) => row.id === id);
  if (!team) throw new Error(`Không có đội Khai hoang ${id}`);
  return structuredClone(team);
};

/** Bản ghi `team` đúng dạng gửi lên `/api/roster`, để kiểm bằng schema thật của Worker. */
export function toWireRecord(team, { boxId = "main", groupId = `${boxId}~ghep-team`, at = Date.UTC(2026, 9, 21, 8, 0, 0) } = {}) {
  const { id, boxId: _boxId, groupId: _groupId, updatedAt: _u, deletedAt: _d, ...body } = team;
  return {
    kind: "team",
    id,
    updatedAt: at,
    deleted: false,
    data: { id, boxId, groupId, ...body, updatedAt: new Date(at).toISOString(), deletedAt: "" },
  };
}

/** Kết quả kiểm của Worker cho một đội (`{ok: true}` khi hợp lệ). */
export const workerCheck = (team, options) => validateRosterRecord(toWireRecord(team, options));
