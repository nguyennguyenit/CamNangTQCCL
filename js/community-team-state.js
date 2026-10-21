// Hàm thuần của trang Đội cộng đồng (không đụng DOM, không gọi mạng): kiểm form → body API, chọn phe
// từ kết quả AI, đọc chế độ từ query, gộp trang danh sách, câu cảnh báo đội tương tự.

/** Binh chủng mà API chấp nhận (thứ tự hiển thị). */
export const TROOPS = Object.freeze(['cung', 'khiGioi', 'ky', 'thuan', 'thuong']);

const TEAM_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const OPTIONAL_FIELDS = ['strengths', 'weaknesses', 'counters', 'counteredBy', 'substitutes'];
const TITLE_MAX = 80;
const PLAYSTYLE_MIN = 10;
const TEXT_MAX = 3000;
const OPTIONAL_MAX = 2000;
const MAX_UPLOADS = 3;

/** Lỗi form có `code` trùng mã lỗi API để UI dùng chung bảng thông báo. */
export class TeamFormError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'TeamFormError';
    this.code = code;
  }
}

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');
/** Độ dài theo code point, khớp `validate.ts` của server (không tính theo UTF-16). */
const length = (text) => Array.from(text).length;
const sureId = (cell) => (cell?.state === 'sure' && typeof cell.id === 'string' && cell.id ? cell.id : null);

/**
 * Nháp đã xác nhận + các ô nhập → body `POST /api/community-teams` (không có `season`: server gán mùa mở).
 * Ném `TeamFormError` (mã `invalid_*` như API) khi thiếu hoặc trùng.
 */
export function teamPayloadFromDraft(draft, fields) {
  const members = Array.isArray(draft?.heroes) ? draft.heroes : [];
  const heroes = members.map((member) => sureId(member?.hero));
  if (members.length !== 3 || heroes.some((id) => !id) || new Set(heroes).size !== 3) {
    throw new TeamFormError('invalid_heroes');
  }
  const tactics = members.map((member) => (Array.isArray(member.tactics) ? member.tactics : []).slice(0, 2).map(sureId));
  if (tactics.some((pair) => pair.length !== 2 || pair.some((id) => !id)) || new Set(tactics.flat()).size !== 6) {
    throw new TeamFormError('invalid_tactics');
  }
  const title = trimmed(fields?.title);
  if (!title || length(title) > TITLE_MAX) throw new TeamFormError('invalid_title');
  if (!TROOPS.includes(fields?.troop)) throw new TeamFormError('invalid_troop');
  const playstyle = trimmed(fields?.playstyle);
  if (length(playstyle) < PLAYSTYLE_MIN || length(playstyle) > TEXT_MAX) throw new TeamFormError('invalid_text');
  const optional = {};
  for (const key of OPTIONAL_FIELDS) {
    const value = trimmed(fields?.[key]);
    if (length(value) > OPTIONAL_MAX) throw new TeamFormError('invalid_text');
    optional[key] = value;
  }
  const uploadIds = Array.isArray(fields?.uploadIds) ? fields.uploadIds : [];
  if (uploadIds.length < 1 || uploadIds.length > MAX_UPLOADS || new Set(uploadIds).size !== uploadIds.length) {
    throw new TeamFormError('invalid_uploads');
  }
  return {
    title,
    heroes,
    tactics,
    troop: fields.troop,
    playstyle,
    ...optional,
    lang: fields?.lang === 'zh' ? 'zh' : 'vi',
    uploadIds: [...uploadIds],
  };
}

/**
 * Chọn một phe của kết quả đã `normalizeTeamRead`: không đọc được/0 phe → `{heroes: []}` (nháp rỗng);
 * 1 phe → phe đó; 2 phe → phe `choice` (`left`/`right`) hoặc `null` khi cần người dùng chọn.
 */
export function pickSide(normalized, choice) {
  const sides = Array.isArray(normalized?.sides) ? normalized.sides : [];
  if (!sides.length) return { heroes: [] };
  if (sides.length === 1) return sides[0];
  return sides.find((entry) => entry.side === choice) ?? null;
}

/** `location.search` → `{mode: 'list'|'detail'|'new'|'mine', id}`. `id` chỉ nhận định dạng id server. */
export function modeFromSearch(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  const id = params.get('id');
  if (id !== null && TEAM_ID_RE.test(id)) return { mode: 'detail', id };
  if (params.get('new') === '1') return { mode: 'new', id: null };
  if (params.get('mine') === '1') return { mode: 'mine', id: null };
  return { mode: 'list', id: null };
}

/** Nối trang kế tiếp vào danh sách, bỏ item có id đã có (trang lệch khi có đội mới). Không đổi đầu vào. */
export function mergePage(items, next) {
  const seen = new Set(items.map((item) => item.id));
  const merged = [...items];
  for (const item of next) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

/** Câu cảnh báo "đã có N đội cùng 3 tướng"; `''` khi chưa có đội nào. */
export function similarWarning(count, locale) {
  const n = Number(count) || 0;
  if (n <= 0) return '';
  return locale === 'zh'
    ? `已有 ${n} 个相同三名武将的阵容。你仍可发布，但建议先看看是否重复。`
    : `Đã có ${n} đội cùng 3 tướng. Bạn vẫn có thể đăng, nhưng nên xem trước để tránh trùng.`;
}
