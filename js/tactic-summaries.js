// Bộ nạp số liệu "Trong cẩm nang" của hồ sơ chiến pháp.
//
// Số liệu tính lúc build trong chính generation Recommended đang pin (`tactic-summaries.json`, xem
// `pipeline/tactic_summaries.py`); trang chỉ tải manifest + đúng file này. Provenance phải khớp hash của hai kho
// Tra cứu đang phát (`tactics`, `heroes-dict`) vì số liệu trả ID tướng/chiến pháp để trang tự lấy tên.

import { loadVerifiedRecommendedManifest } from "./recommended-reference-state.js";

export const TACTIC_SUMMARY_SCHEMA_VERSION = 1;
export const TACTIC_SUMMARY_FILE = "tactic-summaries.json";

const isCount = (value) => Number.isInteger(value) && value >= 0;
const isId = (value, prefix) => typeof value === "string" && value.startsWith(prefix);

function invalid(message) {
  throw new Error(message);
}

function expectedHash(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) invalid(`Thiếu mã kho ${label} để đối chiếu số liệu`);
  return `sha256:${value}`;
}

function family(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.positions) || value.positions.length !== 3
    || !value.positions.every(isCount) || value.teams !== value.positions.reduce((sum, n) => sum + n, 0)) {
    invalid("Số liệu đội của chiến pháp không hợp lệ");
  }
  return { teams: value.teams, positions: [...value.positions] };
}

function ranked(items, key, prefix, total) {
  if (!Array.isArray(items)) invalid("Số liệu xếp hạng của chiến pháp không hợp lệ");
  return items.map((item) => {
    if (!item || !isId(item[key], prefix) || !isCount(item.teams) || item.teams < 1 || item.teams > total) {
      invalid("Số liệu xếp hạng của chiến pháp không hợp lệ");
    }
    return { id: item[key], teams: item.teams };
  });
}

function representative(teams) {
  if (!Array.isArray(teams) || teams.length < 1 || teams.length > 3) invalid("Đội tiêu biểu của chiến pháp không hợp lệ");
  return teams.map((team) => {
    if (!team || typeof team !== "object" || !isCount(team.position) || team.position > 2
      || typeof team.name !== "string" || !team.name.trim() || typeof team.seasonLabel !== "string"
      || !(team.score === null || Number.isFinite(team.score)) || !(team.heroId === null || isId(team.heroId, "hero:"))) {
      invalid("Đội tiêu biểu của chiến pháp không hợp lệ");
    }
    const common = { name: team.name, seasonLabel: team.seasonLabel, score: team.score, position: team.position, heroId: team.heroId };
    if (team.family === "recommended" && typeof team.sourceConfigId === "string" && team.sourceConfigId) {
      return { family: "recommended", ...common, sourceConfigId: team.sourceConfigId };
    }
    if (team.family === "other" && typeof team.legacyTeamId === "string" && team.legacyTeamId
      && (team.legacyVariantId === null || typeof team.legacyVariantId === "string")) {
      return { family: "other", ...common, legacyTeamId: team.legacyTeamId, legacyVariantId: team.legacyVariantId };
    }
    return invalid("Đội tiêu biểu của chiến pháp thiếu mã đội");
  });
}

/**
 * Kiểm cấu trúc và provenance trước khi render; sai ⇒ ném lỗi để khối hiện trạng thái lỗi thay vì số liệu nửa vời.
 * `tacticCatalogSha256`/`heroCatalogSha256`: hex của `data/tactics.json`/`data/heroes-dict.json` (từ publication).
 */
export function parseTacticSummaries(payload, { tacticCatalogSha256, heroCatalogSha256 } = {}) {
  if (!payload || typeof payload !== "object" || payload.schemaVersion !== TACTIC_SUMMARY_SCHEMA_VERSION) {
    invalid("Số liệu chiến pháp sai phiên bản");
  }
  if (payload.provenance?.tacticCatalogSha256 !== expectedHash(tacticCatalogSha256, "chiến pháp")
    || payload.provenance?.heroCatalogSha256 !== expectedHash(heroCatalogSha256, "tướng")) {
    invalid("Số liệu chiến pháp không khớp kho Tra cứu");
  }
  const summaries = payload.summaries;
  if (!summaries || typeof summaries !== "object" || Array.isArray(summaries)) invalid("Số liệu chiến pháp thiếu bảng");
  const parsed = {};
  for (const [identifier, entry] of Object.entries(summaries)) {
    if (!isId(identifier, "tactic:") || !entry || typeof entry !== "object") invalid("Số liệu chiến pháp thiếu trường");
    const standard = family(entry.standard);
    const other = family(entry.other);
    const total = standard.teams + other.teams;
    if (!total) invalid("Số liệu chiến pháp không có đội nào");
    parsed[identifier] = {
      standard,
      other,
      carriers: ranked(entry.carriers, "heroId", "hero:", total),
      companions: ranked(entry.companions, "tacticId", "tactic:", total),
      representative: representative(entry.representative),
    };
  }
  return parsed;
}

/** Promise dùng chung: nạp manifest đã pin rồi đúng file số liệu; lỗi thì xóa để lần mở sau thử lại. */
export function createTacticSummaryLoader({ pin, loadBytes, tacticCatalogSha256, heroCatalogSha256 }) {
  let pending = null;
  return function loadTacticSummaries() {
    if (!pending) {
      pending = loadVerifiedRecommendedManifest(pin, loadBytes)
        .then(({ load }) => load(TACTIC_SUMMARY_FILE))
        .then((payload) => parseTacticSummaries(payload, { tacticCatalogSha256, heroCatalogSha256 }))
        .catch((error) => { pending = null; throw error; });
    }
    return pending;
  };
}
