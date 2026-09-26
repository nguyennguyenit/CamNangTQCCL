// Kiểu hiển thị của hai trang danh sách đội (Đội chuẩn / Đội khác): Thẻ 2 cột, Lưới 4 cột, Bảng.
// Thứ tự quyết định: query `view` của URL > giá trị đã lưu > mặc định Thẻ.
// Tên khóa theo quy ước `tqccl…vN` như js/roster-scan-state.js; lỗi storage chỉ làm mất ghi nhớ,
// không bao giờ chặn render.

export const TEAM_VIEW_STORAGE_KEY = 'tqccl.teamView.v1';
export const TEAM_VIEW_TABLE = 'bang';
export const TEAM_VIEW_CARDS = 'the';
export const TEAM_VIEW_GRID = 'luoi';

/** Giá trị hợp lệ duy nhất của `view`; tra bằng own-property nên chuỗi lạ không lọt qua. */
const VIEWS = Object.freeze({
  [TEAM_VIEW_CARDS]: TEAM_VIEW_CARDS,
  [TEAM_VIEW_GRID]: TEAM_VIEW_GRID,
  [TEAM_VIEW_TABLE]: TEAM_VIEW_TABLE,
});

/** `'the'` / `'luoi'` / `'bang'` khi hợp lệ, `null` khi thiếu hoặc không hợp lệ. */
export function canonicalTeamView(value) {
  return typeof value === 'string' && Object.hasOwn(VIEWS, value) ? VIEWS[value] : null;
}

/** Giá trị đã lưu trong storage; storage lỗi hoặc giá trị hỏng đều trả `null`. */
export function readStoredTeamView(storage) {
  try {
    return canonicalTeamView(storage?.getItem(TEAM_VIEW_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Ghi lựa chọn đang dùng; giá trị lạ về mặc định Thẻ. Trả `false` khi storage không ghi được. */
export function writeStoredTeamView(storage, view) {
  const canonical = canonicalTeamView(view) || TEAM_VIEW_CARDS;
  try {
    storage?.setItem(TEAM_VIEW_STORAGE_KEY, canonical);
    return true;
  } catch {
    return false;
  }
}

/** Kiểu hiển thị đang dùng: URL thắng storage, thiếu cả hai thì Thẻ. */
export function resolveTeamView(urlView, storage) {
  return canonicalTeamView(urlView) || readStoredTeamView(storage) || TEAM_VIEW_CARDS;
}
