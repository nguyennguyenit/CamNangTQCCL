// Bộ nạp số liệu "Trong cẩm nang" (Phase 7).
//
// Số liệu được tính lúc build trong chính generation Recommended đang pin (`hero-summaries.json`), nên
// trang hồ sơ chỉ tải manifest + đúng file này; KHÔNG tải `index.json`/`other-teams.json`/`seasons.json`.
// Manifest đã xác minh SHA-256 nên file nạp qua `load()` là bytes đúng generation; promise giữ trong bộ
// nhớ cho các lần mở sau và bị xóa khi lỗi để lần mở sau thử lại.

import { loadVerifiedRecommendedManifest } from "./recommended-reference-state.js";

export const HERO_SUMMARY_SCHEMA_VERSION = 1;
export const HERO_SUMMARY_FILE = "hero-summaries.json";

const isCount = (value) => Number.isInteger(value) && value >= 0;

function invalid(message) {
  throw new Error(message);
}

function assertItems(value, where) {
  if (!value || typeof value !== "object" || !isCount(value.teams) || !Array.isArray(value.items)) {
    invalid(`Số liệu ${where} không hợp lệ`);
  }
  for (const item of value.items) {
    if (!item || typeof item !== "object" || typeof item.name !== "string" || !item.name.trim()) {
      invalid(`Số liệu ${where} thiếu tên`);
    }
    if (!isCount(item.teams) || item.teams < 1 || item.teams > value.teams) invalid(`Số liệu ${where} sai số đội`);
  }
  return { teams: value.teams, items: value.items.map((item) => ({ name: item.name, teams: item.teams })) };
}

function assertFamily(value, where) {
  if (!value || typeof value !== "object" || !Array.isArray(value.positions) || value.positions.length !== 3
    || !value.positions.every(isCount) || !isCount(value.teams) || value.teams !== value.positions.reduce((sum, n) => sum + n, 0)) {
    invalid(`Số liệu ${where} không hợp lệ`);
  }
  return { teams: value.teams, positions: [...value.positions] };
}

function assertRepresentative(teams) {
  if (!Array.isArray(teams) || teams.length < 1 || teams.length > 3) invalid("Số liệu đội tiêu biểu không hợp lệ");
  return teams.map((team) => {
    if (!team || typeof team !== "object" || !isCount(team.position) || team.position > 2
      || typeof team.name !== "string" || !team.name.trim() || typeof team.seasonLabel !== "string"
      || !(team.score === null || Number.isFinite(team.score))) {
      invalid("Số liệu đội tiêu biểu không hợp lệ");
    }
    if (team.family === "recommended") {
      if (typeof team.sourceConfigId !== "string" || !team.sourceConfigId) invalid("Đội tiêu biểu thiếu mã cấu hình");
      return {
        family: "recommended", name: team.name, seasonLabel: team.seasonLabel, score: team.score,
        position: team.position, sourceConfigId: team.sourceConfigId,
      };
    }
    if (team.family === "other") {
      if (typeof team.legacyTeamId !== "string" || !team.legacyTeamId
        || !(team.legacyVariantId === null || typeof team.legacyVariantId === "string")) {
        invalid("Đội tiêu biểu thiếu mã đội khác");
      }
      return {
        family: "other", name: team.name, seasonLabel: team.seasonLabel, score: team.score,
        position: team.position, legacyTeamId: team.legacyTeamId, legacyVariantId: team.legacyVariantId,
      };
    }
    invalid("Đội tiêu biểu sai họ");
    return null;
  });
}

/**
 * Kiểm cấu trúc payload trước khi render (dữ liệu công khai nhưng vẫn là dữ liệu, không giả định hình dạng).
 * `catalogSha256` (hex, lấy từ `website-display.json` đã xác minh) phải khớp provenance: số liệu tính từ
 * đúng kho Tra cứu mà trang đang dùng, không thể là bản cũ của publication trước.
 * Sai cấu trúc ⇒ ném lỗi để khối hiện trạng thái lỗi thay vì vẽ số liệu nửa vời.
 */
export function parseHeroSummaries(payload, { catalogSha256 } = {}) {
  if (!payload || typeof payload !== "object" || payload.schemaVersion !== HERO_SUMMARY_SCHEMA_VERSION) {
    invalid("Số liệu Trong cẩm nang sai phiên bản");
  }
  const expected = typeof catalogSha256 === "string" && /^[0-9a-f]{64}$/.test(catalogSha256) ? `sha256:${catalogSha256}` : null;
  if (!expected) invalid("Thiếu mã kho Tra cứu để đối chiếu số liệu");
  if (payload.provenance?.catalogSha256 !== expected) invalid("Số liệu Trong cẩm nang không khớp kho Tra cứu");
  const summaries = payload.summaries;
  if (!summaries || typeof summaries !== "object" || Array.isArray(summaries)) invalid("Số liệu Trong cẩm nang thiếu bảng");
  const parsed = {};
  for (const [identifier, entry] of Object.entries(summaries)) {
    if (!identifier.startsWith("hero:") || !entry || typeof entry !== "object"
      || typeof entry.searchName !== "string" || !entry.searchName.trim() || !Array.isArray(entry.tactics)) {
      invalid("Số liệu Trong cẩm nang thiếu trường");
    }
    for (const item of entry.tactics) {
      if (!item || typeof item !== "object" || typeof item.name !== "string" || !item.name.trim() || !isCount(item.teams) || item.teams < 1) {
        invalid("Số liệu chiến pháp hay mang không hợp lệ");
      }
    }
    const standard = assertFamily(entry.standard, "đội chuẩn");
    const other = assertFamily(entry.other, "đội khác");
    if (standard.teams + other.teams === 0) invalid("Số liệu Trong cẩm nang không có đội nào");
    parsed[identifier] = {
      searchName: entry.searchName,
      standard,
      other,
      tactics: entry.tactics.map((item) => ({ name: item.name, teams: item.teams })),
      books: assertItems(entry.books, "binh thư"),
      statFocus: assertItems(entry.statFocus, "hướng điểm"),
      representative: assertRepresentative(entry.representative),
    };
  }
  return parsed;
}

/** Promise dùng chung: nạp manifest đã pin rồi đúng file số liệu; lỗi thì xóa để lần mở sau thử lại. */
export function createHeroSummaryLoader({ pin, loadBytes, catalogSha256 }) {
  let pending = null;
  return function loadHeroSummaries() {
    if (!pending) {
      pending = loadVerifiedRecommendedManifest(pin, loadBytes)
        .then(({ load }) => load(HERO_SUMMARY_FILE))
        .then((payload) => parseHeroSummaries(payload, { catalogSha256 }))
        .catch((error) => { pending = null; throw error; });
    }
    return pending;
  };
}
