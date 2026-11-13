// Trạng thái `/api/**` giả lập cho `compare-moi.mjs` (so ảnh 28 artboard Thiết kế mới): khách, người chơi đăng nhập,
// quản trị root, tài khoản bị khoá có hạn. Dựa trên mock e2e dùng chung + dữ liệu mẫu của community-samples.mjs.
import { ADMIN, AUDIT_ROWS, PLAYER, USER_ROWS } from '../../tests-e2e/helpers/community-mock.mjs';
import { AI_READ, COMMENTS, REPORTS, SAMPLES, SEASONS, TEAM_AUDIT, adminTeam, teamDetail, teamItem } from './community-samples.mjs';

/** Dữ liệu chung mọi trạng thái: mùa đang mở, 6 đội mẫu, chi tiết đội, chiến báo + bình luận, kết quả AI đọc ảnh. */
function baseMock() {
  return {
    comments: COMMENTS,
    reports: REPORTS,
    stats: { total: 2, wins: 1, losses: 1, draws: 0, winRate: 0.5, topOpponents: [] },
    teams: {
      seasons: SEASONS,
      list: { items: SAMPLES.map((_, index) => teamItem(index)), nextCursor: null },
      details: (id) => teamDetail(Math.max(0, Math.min(SAMPLES.length - 1, Number(String(id).slice(1)) - 1 || 0))),
      analyze: () => ({ body: { read: AI_READ } }),
      mine: { items: [], nextCursor: null },
      admin: [],
    },
  };
}

/** Trạng thái mock chọn được theo cặp; mỗi lần gọi trả bản mới (mock quản trị sửa mảng tại chỗ). */
export const MOCK_STATES = Object.freeze({
  khach: () => ({ ...baseMock(), user: null }),
  'dang-nhap': () => {
    const base = baseMock();
    return {
      ...base,
      user: PLAYER,
      teams: {
        ...base.teams,
        mine: { items: [
          teamItem(0, { status: 'pending', author: PLAYER }),
          teamItem(3, { status: 'rejected', rejectReason: 'Ảnh không thấy rõ chiến pháp của tướng thứ ba.', author: PLAYER }),
          teamItem(1, { status: 'approved', author: PLAYER }),
        ], nextCursor: null },
      },
    };
  },
  'quan-tri': () => {
    const base = baseMock();
    return {
      ...base,
      user: ADMIN,
      users: USER_ROWS(),
      auditItems: [...TEAM_AUDIT, ...AUDIT_ROWS()],
      teams: { ...base.teams, admin: [adminTeam(0), adminTeam(1), adminTeam(2)] },
    };
  },
  'bi-khoa': () => ({
    ...baseMock(),
    user: null,
    banNotice: { status: 200, body: { until: '2026-11-20T08:00:00.000Z', reason: 'Spam quảng cáo trong bình luận', deleting: false } },
  }),
});

/** `mock` của cặp → tuỳ chọn `mockCommunityApi`: tên trạng thái, hoặc `{ state, …ghi đè }` (ghi đè nông). */
export function mockOptions(mock = 'khach') {
  const { state = 'khach', ...overrides } = typeof mock === 'string' ? { state: mock } : mock;
  const make = MOCK_STATES[state];
  if (!make) throw new Error(`mock không hợp lệ: ${state} (chọn ${Object.keys(MOCK_STATES).join(' | ')})`);
  return { ...make(), ...overrides };
}
