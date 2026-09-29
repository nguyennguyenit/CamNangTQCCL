// Trạng thái thuần của Soi đội (0-dep, testable): link chia sẻ `?doi=` và lịch sử trên máy.
// Cả hai chỉ mang ID canonical của đội đã xác nhận — không ảnh, không token, không chữ Hán thô.

import { TACTIC_SLOT_COUNT, TEAM_SIZE } from "./analyze-map.js";

/** Tiền tố phiên bản của `?doi=`; đổi định dạng thì tăng phiên bản, link cũ không đọc nhầm. */
export const TEAM_PARAM_VERSION = "v1";
/** Khoá URL của đội và mùa đối chiếu trên trang Soi đội. */
export const TEAM_QUERY_KEY = "doi";
export const SEASON_QUERY_KEY = "season";

// Mỗi tướng = `tướng_chiếnPhápA_chiếnPhápB_binhThư` (slug ID canonical, bỏ tiền tố loại; ô trống
// là chuỗi rỗng); 3 tướng nối bằng `.`. Chỉ dùng ký tự URLSearchParams không mã hoá (a-z 0-9 - _ .).
const FIELD_SEPARATOR = "_";
const FIELD_KINDS = ["hero", ...Array.from({ length: TACTIC_SLOT_COUNT }, () => "tactic"), "book"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PARAM_LENGTH = 1024;

function slugPart(id, kind) {
  if (id == null) return "";
  const prefix = `${kind}:`;
  if (typeof id !== "string" || !id.startsWith(prefix) || !SLUG.test(id.slice(prefix.length))) {
    throw new TypeError(`ID ${kind} không hợp lệ`);
  }
  return id.slice(prefix.length);
}

/**
 * Đội canonical `{heroes:[{hero, tactics:[id|null ×2], book}]}` -> giá trị `?doi=`.
 * Ném nếu đội sai hình dạng (thiếu tướng, ID không phải canonical).
 */
export function encodeTeamParam(team) {
  const heroes = team?.heroes;
  if (!Array.isArray(heroes) || heroes.length !== TEAM_SIZE) throw new TypeError("Đội phải có đủ 3 tướng");
  const segments = heroes.map((member) => {
    if (!member?.hero) throw new TypeError("Thiếu tướng");
    const ids = [member.hero, ...Array.from({ length: TACTIC_SLOT_COUNT }, (_, index) => member.tactics?.[index] ?? null), member.book ?? null];
    return ids.map((id, index) => slugPart(id, FIELD_KINDS[index])).join(FIELD_SEPARATOR);
  });
  return `${TEAM_PARAM_VERSION}.${segments.join(".")}`;
}

/**
 * Giá trị `?doi=` -> đội canonical, hoặc `null` khi link hỏng (sai phiên bản, sai hình dạng, ID
 * không còn trong từ điển). Link hỏng bị bỏ qua lặng lẽ: caller dựng editor rỗng.
 * @param {{hasId?: (id: string) => boolean}} [options] kiểm ID còn tồn tại trong từ điển
 */
export function decodeTeamParam(value, { hasId = () => true } = {}) {
  if (typeof value !== "string" || value.length > MAX_PARAM_LENGTH) return null;
  const [version, ...segments] = value.split(".");
  if (version !== TEAM_PARAM_VERSION || segments.length !== TEAM_SIZE) return null;
  const heroes = [];
  for (const segment of segments) {
    const parts = segment.split(FIELD_SEPARATOR);
    if (parts.length !== FIELD_KINDS.length) return null;
    const ids = [];
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      if (!part) {
        // Chỉ tướng là bắt buộc; chiến pháp/binh thư được để trống có chủ đích.
        if (index === 0) return null;
        ids.push(null);
        continue;
      }
      if (!SLUG.test(part)) return null;
      const id = `${FIELD_KINDS[index]}:${part}`;
      if (!hasId(id)) return null;
      ids.push(id);
    }
    heroes.push({ hero: ids[0], tactics: ids.slice(1, 1 + TACTIC_SLOT_COUNT), book: ids[ids.length - 1] });
  }
  return { heroes };
}

/* ---------- Lịch sử trên máy ---------- */

export const HISTORY_STORAGE_KEY = "tqccl.analyze.history.v1";
export const HISTORY_LIMIT = 10;

const SEASON_ID = /^[^\u0000-\u001f\u007f]{1,64}$/u;

function validEntry(entry) {
  return Boolean(entry) && typeof entry === "object" &&
    typeof entry.doi === "string" && decodeTeamParam(entry.doi) !== null &&
    (entry.season === null || (typeof entry.season === "string" && SEASON_ID.test(entry.season))) &&
    typeof entry.savedAt === "string" && Number.isFinite(Date.parse(entry.savedAt));
}

/** Chỉ giữ đúng ba trường của một mục; mục sai hình dạng bị bỏ. */
function cleanEntry(entry) {
  return { doi: entry.doi, season: entry.season, savedAt: entry.savedAt };
}

/** Thêm một mục lên đầu (cùng đội + cùng mùa thì thay mục cũ), giữ tối đa `HISTORY_LIMIT` mục. */
export function addHistoryEntry(entries, entry) {
  if (!validEntry(entry)) return (entries || []).filter(validEntry).slice(0, HISTORY_LIMIT);
  const rest = (entries || []).filter((item) => validEntry(item) && !(item.doi === entry.doi && item.season === entry.season));
  return [cleanEntry(entry), ...rest.map(cleanEntry)].slice(0, HISTORY_LIMIT);
}

/** Đọc lịch sử; storage bị chặn/JSON hỏng/mục lạ -> bỏ qua, không ném. */
export function readHistory(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(validEntry).map(cleanEntry).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Ghi lịch sử; lỗi storage (đầy, chế độ riêng tư) chỉ làm mất ghi nhớ, không chặn công cụ. */
export function writeHistory(storage, entries) {
  try {
    if (!entries.length) storage?.removeItem(HISTORY_STORAGE_KEY);
    else storage?.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
    return true;
  } catch {
    return false;
  }
}
